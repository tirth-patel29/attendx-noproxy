import { query } from '../utils/db';
import { metronomeService } from './metronome';
import { auditService } from './audit';
import { verifyHmac } from '../utils/crypto';
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
  /** Standardized zero-trust error code (see docs/ERROR_DICTIONARY.md). */
  code?: string;
  message: string;
  verification_delta_ms?: number;
  ledger_uuid?: string;
}

interface CachedStudent {
  student_uuid: string;
  roll_no: string;
  bound_device_id: string | null;
  secret_hmac_key: string;
  cached_at: number;
}

/**
 * Judge Service — Ultra-Low Latency 4-Gate Verification Engine
 * 
 * Gate 1: Hardware Tattoo — device_id_hash matches bound_device_id (Fast RAM / DB read)
 * Gate 2: Biometric Flesh Lock — verified on client (local_auth)
 * Gate 3: Visual Micro-Twitch — token_val matches live in-memory metronome ring buffer (0 ms)
 * Gate 4: Cryptographic Seal & Single-RTT Atomic CTE (1 combined DB round trip)
 */
export class JudgeService {
  // In-memory student cache (5-minute TTL) to avoid per-claim DB reads
  private studentCache = new Map<string, CachedStudent>();
  private readonly studentTtlMs = 5 * 60 * 1000;

  /** Invalidate cached student record when device or credentials change */
  invalidateStudent(studentUuid: string): void {
    this.studentCache.delete(studentUuid);
  }

  /** Retrieve student record (cache-first to eliminate DB round trip) */
  private async getStudent(studentUuid: string): Promise<CachedStudent | null> {
    const cached = this.studentCache.get(studentUuid);
    const now = Date.now();
    if (cached && (now - cached.cached_at < this.studentTtlMs)) {
      return cached;
    }

    const res = await query(
      `SELECT student_uuid, roll_no, bound_device_id, secret_hmac_key
       FROM students WHERE student_uuid = $1`,
      [studentUuid]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const record: CachedStudent = {
      student_uuid: row.student_uuid,
      roll_no: row.roll_no,
      bound_device_id: row.bound_device_id,
      secret_hmac_key: row.secret_hmac_key,
      cached_at: now,
    };
    this.studentCache.set(studentUuid, record);
    return record;
  }

  /**
   * Process an attendance claim through all 4 gates in a SINGLE database round trip.
   */
  async processClaim(payload: AttendanceClaimPayload): Promise<AttendanceResult> {
    // 1. Get student record (Cache-first: 0ms on warm path)
    const student = await this.getStudent(payload.student_uuid);
    if (!student) {
      return { status: 'INVALID_CLAIM', code: 'ERR_NOT_FOUND', message: 'Student not found' };
    }

    // ===== GATE 1: Hardware Tattoo (In-Memory Comparison: 0.001ms) =====
    if (student.bound_device_id && student.bound_device_id !== payload.device_id_hash) {
      this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 1,
        result: 'HARDWARE_MISMATCH',
        expected: student.bound_device_id,
        received: payload.device_id_hash,
      });
      return { status: 'HARDWARE_MISMATCH', code: 'ERR_HW_MISMATCH', message: 'Device not registered to this student' };
    }

    // ===== GATE 4: HMAC Wax Seal (In-Memory CPU Crypto: 0.05ms) =====
    const hmacValid = verifyHmac(student.secret_hmac_key, {
      session_uuid: payload.session_uuid,
      student_uuid: payload.student_uuid,
      token_val: payload.token_val,
      client_claimed_time: payload.client_claimed_time,
      device_id_hash: payload.device_id_hash,
      nonce: payload.nonce,
    }, payload.hmac_signature);

    if (!hmacValid) {
      this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 4,
        result: 'FORGED_RESPONSE',
        reason: 'hmac_invalid',
      });
      return { status: 'FORGED_RESPONSE', code: 'ERR_SIG_INVALID', message: 'Invalid cryptographic signature' };
    }

    // ===== GATE 3+4: Token-epoch membership + freshness (In-Memory Ring Buffer: 0.01ms) =====
    const now = Date.now();
    const tokenObj = await metronomeService.findToken(payload.session_uuid, payload.token_val);
    if (!tokenObj) {
      this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 3, result: 'EXPIRED_TOKEN', reason: 'unknown_token', token: payload.token_val,
      });
      return { status: 'EXPIRED_TOKEN', code: 'ERR_TOKEN_EXPIRED', message: 'Token not found — re-scan the live projector flash.' };
    }

    const birth = Number(tokenObj.created_at_epoch);
    const birthWindowEnd = tokenObj.expires_at_epoch
      ? Number(tokenObj.expires_at_epoch)
      : birth + config.judge.tokenValidityWindowMs;
    const tol = config.judge.clockToleranceMs;
    const claimed = payload.client_claimed_time;
    const verificationDeltaMs = claimed - birth;

    // (a) Freshness
    if (claimed > now + tol || now - claimed > config.judge.maxAckDelayMs) {
      this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 4,
        result: 'STREAM_DETECTED',
        reason: claimed > now + tol ? 'future_timestamp' : 'stale_timestamp',
        delta_ms: verificationDeltaMs,
      });
      return {
        status: 'STREAM_DETECTED',
        code: 'ERR_STREAM_DETECTED',
        message: 'Attendance window closed or timestamp rejected — re-scan the live projector.',
        verification_delta_ms: verificationDeltaMs,
      };
    }

    // (b)+(c) Membership — was this token current at the claimed instant?
    if (claimed < birth - tol || claimed >= birthWindowEnd + tol) {
      this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 3,
        result: 'EXPIRED_TOKEN',
        reason: 'token_not_current_at_claimed_time',
        delta_ms: verificationDeltaMs,
      });
      return {
        status: 'EXPIRED_TOKEN',
        code: 'ERR_TOKEN_EXPIRED',
        message: 'The scanned token is no longer current — re-scan the live projector flash.',
        verification_delta_ms: verificationDeltaMs,
      };
    }

    // ===== ALL CHECKS PASSED: SINGLE-ROUND-TRIP ATOMIC TRANSACTION =====
    // Atomically consumes the nonce and commits to attendance_ledger in ONE query.
    // Eliminates multiple sequential database round-trips over the WAN.
    const atomicRes = await query<{
      challenge_uuid: string | null;
      new_ledger_uuid: string | null;
      existing_ledger_uuid: string | null;
    }>(
      `WITH consumed_nonce AS (
         UPDATE crypto_challenges
         SET used = TRUE, used_at_epoch = $1
         WHERE session_uuid = $2 AND challenge_nonce = $3
           AND used = FALSE AND expires_at_epoch > $1
         RETURNING challenge_uuid
       ),
       inserted_claim AS (
         INSERT INTO attendance_ledger (session_uuid, student_uuid, client_claimed_time, verification_delta_ms, status)
         SELECT $2, $4, $5, $6, 'PRESENT'
         WHERE EXISTS (SELECT 1 FROM consumed_nonce)
         ON CONFLICT (session_uuid, student_uuid) DO NOTHING
         RETURNING ledger_uuid
       )
       SELECT 
         (SELECT challenge_uuid FROM consumed_nonce) AS challenge_uuid,
         (SELECT ledger_uuid FROM inserted_claim) AS new_ledger_uuid,
         (SELECT al.ledger_uuid FROM attendance_ledger al WHERE al.session_uuid = $2 AND al.student_uuid = $4 LIMIT 1) AS existing_ledger_uuid`,
      [now, payload.session_uuid, payload.nonce, payload.student_uuid, payload.client_claimed_time, verificationDeltaMs]
    );

    const outcome = atomicRes.rows[0];

    // Nonce was invalid, expired, or already used
    if (!outcome || !outcome.challenge_uuid) {
      // Diagnostic check for precise error classification (only on failure)
      const exists = await query(
        `SELECT used FROM crypto_challenges WHERE session_uuid = $1 AND challenge_nonce = $2`,
        [payload.session_uuid, payload.nonce]
      );
      const reused = exists.rows.length > 0 && exists.rows[0].used === true;
      this.logAudit('CLAIM_ATTEMPT', payload.student_uuid, payload.session_uuid, {
        gate: 4,
        result: 'FORGED_RESPONSE',
        reason: reused ? 'nonce_reused' : 'invalid_or_expired_nonce',
      });
      return {
        status: 'FORGED_RESPONSE',
        code: reused ? 'ERR_NONCE_USED' : 'ERR_NONCE_INVALID',
        message: reused ? 'Challenge nonce already used (replay)' : 'Invalid or expired challenge nonce',
      };
    }

    // Success! Resolve ledger UUID (newly inserted or existing duplicate)
    const ledgerUuid = outcome.new_ledger_uuid ?? outcome.existing_ledger_uuid ?? undefined;
    const isAlreadyLogged = !outcome.new_ledger_uuid;

    // Asynchronous non-blocking audit logging (0ms added to client response)
    this.logAudit('CLAIM_SUCCESS', payload.student_uuid, payload.session_uuid, {
      gate: 'all_passed',
      ledger_uuid: ledgerUuid,
      verification_delta_ms: verificationDeltaMs,
      already_logged: isAlreadyLogged,
    });

    return {
      status: 'PRESENT',
      message: isAlreadyLogged ? 'Attendance already logged' : 'Attendance verified',
      verification_delta_ms: verificationDeltaMs,
      ledger_uuid: ledgerUuid,
    };
  }

  /**
   * Log audit event (non-blocking fire-and-forget to preserve sub-50ms latency)
   */
  private logAudit(
    eventType: string,
    actorUuid: string | null,
    sessionUuid: string | null,
    payload: Record<string, any>
  ): void {
    auditService.log(eventType, actorUuid, payload, {
      sessionUuid,
      userAgent: 'attendance-backend',
    }).catch((err) => {
      console.error('Asynchronous audit log write failed:', err);
    });
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