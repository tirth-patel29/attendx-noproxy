import { query, transaction } from '../utils/db';
import { metronomeService } from './metronome';
import { verifyHmac, hashDeviceId } from '../utils/crypto';
import { config } from '../config';

export interface AttendanceClaimPayload {
  session_uuid: string;
  student_uuid: string;
  token_val: string;
  client_claimed_time: number;  // TrueObservedTime in ms (client's clock)
  device_id_hash: string;       // SHA-256 of hardware UUID (Gate 1)
  nonce: string;                // Challenge nonce from crypto_challenges (Gate 4)
  hmac_signature: string;       // HMAC-SHA256 of canonical string (Gate 4)
}

export interface AttendanceResult {
  status: 'PRESENT' | 'HARDWARE_MISMATCH' | 'STREAM_DETECTED' | 'FORGED_RESPONSE' | 'EXPIRED_TOKEN' | 'INVALID_CLAIM';
  message: string;
  verification_delta_ms?: number;
  ledger_uuid?: string;
}

/**
 * Judge Service — The 4-Gate Verification Engine
 * 
 * Implements the SRS state machine for attendance claims:
 * 
 * Gate 1: Hardware Tattoo — device_id_hash matches bound_device_id in students table
 * Gate 2: Biometric Flesh Lock — verified on client (local_auth), not server
 * Gate 3: Visual Micro-Twitch — token_val matches active_tokens for session (3s rotating)
 * Gate 4: Cryptographic Time-Stamp — HMAC verifies + |client_claimed_time - token_birth| <= 250ms
 * 
 * Attack vectors handled (per SRS state matrix):
 * - Honest student → PRESENT
 * - Bad WiFi (latency) → EXPIRED_TOKEN or PRESENT (if within 250ms)
 * - WhatsApp photo (static QR) → EXPIRED_TOKEN (token rotated)
 * - Discord stream (live relay) → STREAM_DETECTED (latency > 250ms)
 * - Postman spoof (replay) → FORGED_RESPONSE (HMAC fails or nonce reused)
 * - Friend's phone (device mismatch) → HARDWARE_MISMATCH
 */
export class JudgeService {
  /**
   * Process an attendance claim through all 4 gates
   */
  async processClaim(payload: AttendanceClaimPayload): Promise<AttendanceResult> {
    // First, get student record to check Gate 1 and get HMAC key
    const studentRes = await query(
      `SELECT student_uuid, roll_no, bound_device_id, secret_hmac_key
       FROM students WHERE student_uuid = $1`,
      [payload.student_uuid]
    );

    if (studentRes.rows.length === 0) {
      return { status: 'INVALID_CLAIM', message: 'Student not found' };
    }

    const student = studentRes.rows[0];

    // ===== GATE 1: Hardware Tattoo =====
    // Client sends device_id_hash = SHA-256(hardware_UUID)
    // Server compares with bound_device_id in students table
    if (student.bound_device_id && student.bound_device_id !== payload.device_id_hash) {
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 1,
        result: 'HARDWARE_MISMATCH',
        expected: student.bound_device_id,
        received: payload.device_id_hash,
      });
      return { status: 'HARDWARE_MISMATCH', message: 'Device not registered to this student' };
    }

    // ===== GATE 3: Visual Micro-Twitch (3s rotating token) =====
    // Verify token exists, is valid, and consume it
    const token = await metronomeService.verifyAndConsumeToken(
      payload.session_uuid,
      payload.token_val,
      payload.client_claimed_time
    );

    if (!token) {
      // Check why it failed
      const now = Date.now();
      const tokenCheck = await query(
        `SELECT * FROM active_tokens WHERE session_uuid = $1 AND token_val = $2`,
        [payload.session_uuid, payload.token_val]
      );

      if (tokenCheck.rows.length === 0) {
        // Token never existed or already consumed
        await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
          gate: 3,
          result: 'EXPIRED_TOKEN',
          token: payload.token_val,
        });
        return { status: 'EXPIRED_TOKEN', message: 'Token expired or already used' };
      }

      const dbToken = tokenCheck.rows[0];
      const delta = payload.client_claimed_time - dbToken.created_at_epoch;
      if (Math.abs(delta) > config.judge.maxLatencyMs) {
        // Token exists but latency too high (Gate 4 would also catch this)
        await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
          gate: 3,
          result: 'STREAM_DETECTED',
          delta_ms: delta,
        });
        return { status: 'STREAM_DETECTED', message: 'Latency exceeds 250ms window', verification_delta_ms: delta };
      }

      // Token exists but already consumed (replay attack)
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 3,
        result: 'FORGED_RESPONSE',
        reason: 'token_already_consumed',
      });
      return { status: 'FORGED_RESPONSE', message: 'Token already consumed' };
    }

    // ===== GATE 4: Cryptographic Time-Stamp =====
    // Verify HMAC signature
    const hmacValid = verifyHmac(student.secret_hmac_key, {
      session_uuid: payload.session_uuid,
      student_uuid: payload.student_uuid,
      token_val: payload.token_val,
      client_claimed_time: payload.client_claimed_time,
      device_id_hash: payload.device_id_hash,
      nonce: payload.nonce,
    }, payload.hmac_signature);

    if (!hmacValid) {
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 4,
        result: 'FORGED_RESPONSE',
        reason: 'hmac_invalid',
      });
      return { status: 'FORGED_RESPONSE', message: 'Invalid cryptographic signature' };
    }

    // Verify nonce (from crypto_challenges) - single use
    const nonceRes = await query(
      `SELECT challenge_uuid, used FROM crypto_challenges 
       WHERE session_uuid = $1 AND challenge_nonce = $2 AND expires_at_epoch > $3`,
      [payload.session_uuid, payload.nonce, Date.now()]
    );

    if (nonceRes.rows.length === 0) {
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 4,
        result: 'FORGED_RESPONSE',
        reason: 'invalid_or_expired_nonce',
      });
      return { status: 'FORGED_RESPONSE', message: 'Invalid or expired challenge nonce' };
    }

    if (nonceRes.rows[0].used) {
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 4,
        result: 'FORGED_RESPONSE',
        reason: 'nonce_reused',
      });
      return { status: 'FORGED_RESPONSE', message: 'Challenge nonce already used' };
    }

    // Mark nonce as used
    await query(
      `UPDATE crypto_challenges SET used = TRUE, used_at_epoch = $1 WHERE challenge_uuid = $2`,
      [Date.now(), nonceRes.rows[0].challenge_uuid]
    );

    // Verify latency again with precise delta
    const verificationDeltaMs = payload.client_claimed_time - token.created_at_epoch;
    if (Math.abs(verificationDeltaMs) > config.judge.maxLatencyMs) {
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 4,
        result: 'STREAM_DETECTED',
        delta_ms: verificationDeltaMs,
      });
      return { status: 'STREAM_DETECTED', message: 'Latency exceeds 250ms window', verification_delta_ms: verificationDeltaMs };
    }

    // ===== ALL GATES PASSED =====
    // Record in attendance_ledger
    const ledgerRes = await query(
      `INSERT INTO attendance_ledger (session_uuid, student_uuid, client_claimed_time, verification_delta_ms, status)
       VALUES ($1, $2, $3, $4, 'PRESENT')
       ON CONFLICT (session_uuid, student_uuid) DO NOTHING
       RETURNING ledger_uuid`,
      [payload.session_uuid, payload.student_uuid, payload.client_claimed_time, verificationDeltaMs]
    );

    let ledgerUuid: string | undefined;
    if (ledgerRes.rows.length > 0) {
      ledgerUuid = ledgerRes.rows[0].ledger_uuid;
    } else {
      // Duplicate claim (already present) - check existing
      const existing = await query(
        `SELECT ledger_uuid FROM attendance_ledger WHERE session_uuid = $1 AND student_uuid = $2`,
        [payload.session_uuid, payload.student_uuid]
      );
      if (existing.rows.length > 0) {
        ledgerUuid = existing.rows[0].ledger_uuid;
      }
    }

    await this.logAudit('CLAIM_SUCCESS', payload.student_uuid, payload.session_uuid, {
      gate: 'all_passed',
      ledger_uuid: ledgerUuid,
      verification_delta_ms: verificationDeltaMs,
    });

    return {
      status: 'PRESENT',
      message: 'Attendance verified',
      verification_delta_ms: verificationDeltaMs,
      ledger_uuid: ledgerUuid,
    };
  }

  /**
   * Log audit event
   */
  private async logAudit(
    eventType: string,
    actorUuid: string | null,
    sessionUuid: string | null,
    payload: Record<string, any>
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs (event_type, actor_uuid, session_uuid, payload, source_ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [eventType, actorUuid, sessionUuid, JSON.stringify(payload), null, 'attendance-backend']
      );
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  /**
   * Get attendance records for a session
   */
  async getSessionAttendance(sessionUuid: string) {
    const res = await query(
      `SELECT al.ledger_uuid, al.student_uuid, s.roll_no, s.email, 
              al.client_claimed_time, al.server_logged_time, 
              al.verification_delta_ms, al.status
       FROM attendance_ledger al
       JOIN students s ON al.student_uuid = s.student_uuid
       WHERE al.session_uuid = $1
       ORDER BY al.server_logged_time ASC`,
      [sessionUuid]
    );
    return res.rows;
  }

  /**
   * Get student's attendance history
   */
  async getStudentAttendance(studentUuid: string) {
    const res = await query(
      `SELECT al.*, cs.course_code, cs.session_date
       FROM attendance_ledger al
       JOIN course_sessions cs ON al.session_uuid = cs.session_uuid
       WHERE al.student_uuid = $1
       ORDER BY al.server_logged_time DESC`,
      [studentUuid]
    );
    return res.rows;
  }
}

// Singleton
export const judgeService = new JudgeService();