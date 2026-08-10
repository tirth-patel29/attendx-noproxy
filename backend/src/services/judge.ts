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
   * Process an attendance claim through all 4 gates.
   *
   * Implements the SRS §5 judge ordering exactly:
   *   1. Gate 1 — hardware tattoo match (X-Device-HW-Key equivalent)
   *   2. Gate 4 — HMAC wax seal verified FIRST (forgeries never touch token state)
   *   3. Gate 3 — token lookup (non-destructive: the whole class shares each token)
   *   4. Gate 4 — latency: delta = observed - token_birth must be 0..250ms
   *               (negative = forged clock, >250ms = live-stream artifact)
   *   5. nonce single-use verification
   *   6. Commit to ledger (UNIQUE(session, student) makes re-claims idempotent)
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
    if (student.bound_device_id && student.bound_device_id !== payload.device_id_hash) {
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 1,
        result: 'HARDWARE_MISMATCH',
        expected: student.bound_device_id,
        received: payload.device_id_hash,
      });
      return { status: 'HARDWARE_MISMATCH', message: 'Device not registered to this student' };
    }

    // ===== GATE 4: HMAC wax seal (verified before touching token state) =====
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

    // ===== GATE 3: Visual Micro-Twitch (3s rotating token, non-destructive) =====
    const token = await metronomeService.verifyToken(payload.session_uuid, payload.token_val);

    if (!token) {
      const tokenCheck = await query(
        `SELECT * FROM active_tokens WHERE session_uuid = $1 AND token_val = $2`,
        [payload.session_uuid, payload.token_val]
      );
      if (tokenCheck.rows.length === 0) {
        // Token never existed, already rotated out, expired, or wrong session
        await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
          gate: 3,
          result: 'EXPIRED_TOKEN',
          token: payload.token_val,
        });
        return { status: 'EXPIRED_TOKEN', message: 'Token expired, re-scan the projector' };
      }
      // Exists but expired
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 3,
        result: 'EXPIRED_TOKEN',
        reason: 'expired',
        token: payload.token_val,
      });
      return { status: 'EXPIRED_TOKEN', message: 'Token expired, re-scan the projector' };
    }

    // ===== GATE 4: The 250ms Stream Kill-Window (SRS §3 Proof 2) =====
    // delta = TrueObservedTime − TokenBirthTime.
    // Reject deltas > 250ms (live-stream artifact) AND negative deltas
    // (impossible: the lens cannot witness a token before the server minted it —
    // negative delta means the client clock was manipulated).
    const verificationDeltaMs = payload.client_claimed_time - token.created_at_epoch;
    if (verificationDeltaMs < 0 || verificationDeltaMs > config.judge.maxLatencyMs) {
      await this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 4,
        result: 'STREAM_DETECTED',
        delta_ms: verificationDeltaMs,
      });
      return {
        status: 'STREAM_DETECTED',
        message: `Stream artifact detected (${verificationDeltaMs}ms > ${config.judge.maxLatencyMs}ms window)`,
        verification_delta_ms: verificationDeltaMs,
      };
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
      return { status: 'FORGED_RESPONSE', message: 'Challenge nonce already used (replay)' };
    }

    // Mark nonce as used (single-use, replay protection)
    await query(
      `UPDATE crypto_challenges SET used = TRUE, used_at_epoch = $1 WHERE challenge_uuid = $2`,
      [Date.now(), nonceRes.rows[0].challenge_uuid]
    );

    // ===== ALL GATES PASSED =====
    // Commit to the master ledger. The UNIQUE(session_uuid, student_uuid)
    // constraint makes repeat claims idempotent (SRS §5: duplicate -> 200
    // "Attendance already logged"). The token is intentionally NOT deleted:
    // the whole class shares each 3s token within its validity window.
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
      already_logged: ledgerRes.rows.length === 0,
    });

    return {
      status: 'PRESENT',
      message: ledgerRes.rows.length === 0 ? 'Attendance already logged' : 'Attendance verified',
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