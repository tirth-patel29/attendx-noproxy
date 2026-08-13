import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { judgeService } from '../services/judge';
import { metronomeService } from '../services/metronome';
import { query } from '../utils/db';
import { requireApiKey } from '../utils/apiKey';
import { sendError } from '../utils/apiError';
import { config } from '../config';
import { z } from 'zod';

const router = Router();

/**
 * requireProfessor — the session endpoints are OWNED operations.
 * Decodes the professor JWT (issued by /api/v1/auth/login) and attaches
 * req.professor. The client NEVER supplies prof_uuid: identity comes from the
 * token, so a teacher can only ever create/see THEIR OWN sessions.
 */
export function requireProfessor(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return sendError(res, 401, 'ERR_AUTH_MISSING', 'Missing or invalid JWT/API Key.');
  try {
    const decoded = jwt.verify(auth.slice(7), config.jwtSecret || 'dev-secret-change-in-production-min-32-chars-long') as {
      sub: string; email: string; name: string; role: string;
    };
    if (decoded.role !== 'professor') return sendError(res, 403, 'ERR_FORBIDDEN', 'Professor access required.');
    (req as any).professor = decoded;
    next();
  } catch {
    return sendError(res, 401, 'ERR_AUTH_MISSING', 'Invalid or expired token.');
  }
}

async function ensureOwnSession(sessionUuid: string, profUuid: string): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM course_sessions WHERE session_uuid = $1 AND prof_uuid = $2`,
    [sessionUuid, profUuid]
  );
  return r.rows.length > 0;
}

// Validation schemas
const claimAttendanceSchema = z.object({
  session_uuid: z.string().uuid(),
  student_uuid: z.string().uuid(),
  token_val: z.string().length(4), // SRS: 4-character base62 rotating token
  client_claimed_time: z.number().int().positive(),
  device_id_hash: z.string().length(64),
  nonce: z.string().length(32),
  hmac_signature: z.string().length(64),
});

const sessionStartSchema = z.object({
  course_code: z.string().min(1).max(20),
  prof_uuid: z.string().uuid().optional(), // legacy — ALWAYS overridden by JWT identity
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const deviceRegisterSchema = z.object({
  student_uuid: z.string().uuid(),
  device_id_hash: z.string().length(64),
});

// Self-service provisioning (SRS §1 Phase 1 "The Blood Oath"): the student
// enters their roll number + the HMAC secret handed to them by the Admin
// Console during onboarding. The server validates the pair and binds this
// device as the hardware tattoo.
const provisionSchema = z.object({
  roll_no: z.string().regex(/^[0-9]{2}[A-Z]{3}[0-9]{3}$/),
  secret_hmac_key: z.string().length(64),
  device_id_hash: z.string().length(64),
});

// ===== Helpers to shape DB rows into frontend-friendly contract =====

function shapeProfessor(row: any) {
  return {
    id: row.prof_uuid,
    email: row.email,
    name: row.name,
    department: row.department,
  };
}

async function shapeSession(row: any) {
  const counts = await query(
    `SELECT
       (SELECT COUNT(*) FROM students) AS total_students,
       (SELECT COUNT(*) FROM attendance_ledger WHERE session_uuid = $1 AND status = 'PRESENT') AS present_count`,
    [row.session_uuid]
  );
  return {
    id: row.session_uuid,
    course_code: row.course_code,
    professor_id: row.prof_uuid,
    session_date: row.session_date,
    is_active: row.is_active,
    created_at: row.created_at,
    total_students: parseInt(counts.rows[0].total_students, 10),
    present_count: parseInt(counts.rows[0].present_count, 10),
  };
}

/**
 * GET /api/v1/time-sync
 * Server epoch time for Cristian's Algorithm clock synchronization.
 * Micro-optimized fast path: pure in-memory epoch — no DB, no heavy middleware.
 * `Cache-Control: no-store` keeps every calibration fresh for drift accuracy.
 */
router.get('/time-sync', async (_req: Request, res: Response) => {
  const serverEpoch = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    server_epoch: serverEpoch,
    server_iso: new Date(serverEpoch).toISOString(),
  });
});

/**
 * GET /api/v1/professors
 * List all professors (for the portal's session-create dropdown)
 */
router.get('/professors', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`SELECT prof_uuid, email, name, department FROM professors ORDER BY name`);
    res.json(result.rows.map(shapeProfessor));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/professors/:profUuid
 * Single professor
 */
router.get('/professors/:profUuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profUuid } = req.params;
    const result = await query(
      `SELECT prof_uuid, email, name, department FROM professors WHERE prof_uuid = $1`,
      [profUuid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Professor not found' });
    }
    res.json(shapeProfessor(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions
 * My sessions — ALWAYS filtered to the authenticated professor (JWT).
 * A teacher never sees another teacher's sessions.
 */
router.get('/sessions', requireProfessor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const professorId = (req as any).professor.sub as string;
    const result = await query(
      `SELECT session_uuid, course_code, prof_uuid, session_date, is_active, created_at
       FROM course_sessions WHERE prof_uuid = $1 ORDER BY created_at DESC`,
      [professorId]
    );
    const shaped = await Promise.all(result.rows.map(shapeSession));
    res.json(shaped);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:sessionUuid
 * Single session (ownership-checked)
 */
router.get('/sessions/:sessionUuid', requireProfessor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;
    const owns = await ensureOwnSession(sessionUuid, (req as any).professor.sub);
    if (!owns) return res.status(404).json({ error: 'Session not found' });
    const result = await query(
      `SELECT session_uuid, course_code, prof_uuid, session_date, is_active, created_at
       FROM course_sessions WHERE session_uuid = $1`,
      [sessionUuid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(await shapeSession(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sessions/start
 * Professor starts a new session — the PROFESSOR IDENTITY COMES FROM THE JWT.
 * The client-sent prof_uuid (if any) is ignored, which closes the
 * "teacher creates a session as another teacher" hole.
 */
router.post('/sessions/start', requireProfessor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = sessionStartSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors });
    }

    const { course_code, session_date } = parseResult.data;
    const prof_uuid = (req as any).professor.sub as string; // identity from token — never the client
    const date = session_date || new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO course_sessions (course_code, prof_uuid, session_date, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING *`,
      [course_code, prof_uuid, date]
    );

    const session = result.rows[0];

    // Start metronome for this session
    await metronomeService.startSession(session.session_uuid);

    res.status(201).json({
      ...(await shapeSession(session)),
      metronome_started: true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sessions/:sessionUuid/stop
 * Professor stops a session (ownership-checked, stops metronome)
 */
router.post('/sessions/:sessionUuid/stop', requireProfessor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;

    const owns = await ensureOwnSession(sessionUuid, (req as any).professor.sub);
    if (!owns) return res.status(404).json({ error: 'Session not found' });

    await query(
      `UPDATE course_sessions SET is_active = FALSE WHERE session_uuid = $1 AND prof_uuid = $2 RETURNING *`,
      [sessionUuid, (req as any).professor.sub]
    );

    metronomeService.stopSession(sessionUuid);

    res.json({ id: sessionUuid, stopped: true, is_active: false });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:sessionUuid/tokens
 * Current active tokens for a session (the 3s rotating QR payload)
 */
router.get('/sessions/:sessionUuid/tokens', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;
    const tokens = await metronomeService.getActiveTokens(sessionUuid);
    res.json({ session_uuid: sessionUuid, tokens });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/professor/timetable
 * The authenticated professor's lectures from the admin-created timetable.
 * `week` = all 7 days for the professor (also used by the app), `today` is the
 * server-date day_of_week. Each entry carries course + division so the portal
 * can render "Today's lectures" and start attendance for them directly.
 */
router.get('/professor/timetable', requireProfessor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profUuid = (req as any).professor.sub as string;
    const r = await query(
      `SELECT a.assignment_id, a.course_code, c.title AS course_title, a.division_id,
              d.name AS division_name, a.day_of_week,
              to_char(a.start_time, 'HH24:MI') AS start_time,
              to_char(a.end_time, 'HH24:MI') AS end_time
       FROM teacher_assignments a
       JOIN courses c ON c.course_code = a.course_code
       JOIN divisions d ON d.division_id = a.division_id
       WHERE a.prof_uuid = $1
       ORDER BY a.day_of_week, a.start_time`,
      [profUuid]
    );
    const todayDow = new Date().getDay(); // 0=Sun..6=Sat
    res.json({
      today_dow: todayDow,
      today: r.rows.filter((x) => x.day_of_week === todayDow),
      week: r.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/professor/summary
 * Per-course attendance analytics for the authenticated professor:
 * sessions run, last session date, present count, total students (their
 * division roster) — powers the "my subjects" analytics cards.
 */
router.get('/professor/summary', requireProfessor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profUuid = (req as any).professor.sub as string;
    const r = await query(
      `SELECT c.course_code, c.title,
              COUNT(DISTINCT cs.session_uuid)::int AS sessions_total,
              COUNT(DISTINCT cs.session_uuid) FILTER (WHERE cs.is_active)::int AS sessions_active,
              MAX(cs.session_date)::text AS last_session_date,
              COUNT(DISTINCT al.ledger_uuid)::int AS present_count,
              (SELECT COUNT(*) FROM students s
               WHERE s.division_id = c.division_id)::int AS total_students
       FROM courses c
       JOIN teacher_assignments a ON a.course_code = c.course_code AND a.prof_uuid = $1
       LEFT JOIN course_sessions cs ON cs.course_code = c.course_code AND cs.prof_uuid = $1
       LEFT JOIN attendance_ledger al ON al.session_uuid = cs.session_uuid AND al.status = 'PRESENT'
       GROUP BY c.course_code, c.title, c.division_id
       ORDER BY c.course_code`,
      [profUuid]
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sessions/:sessionUuid/challenge
 * Issue a fresh cryptographic challenge nonce for Gate 4 (SRS §6).
 * The nonce is persisted to crypto_challenges with a short TTL and marked
 * single-use per session. The client includes it in the HMAC-wax-seal so the
 * server can prove the claim is fresh and non-replayable.
 */
router.post('/sessions/:sessionUuid/challenge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;

    // Ensure the session exists and is active
    const sessionCheck = await query(
      `SELECT session_uuid FROM course_sessions WHERE session_uuid = $1 AND is_active = TRUE`,
      [sessionUuid]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    const { generateChallengeNonce } = await import('../utils/crypto');
    const nonce = generateChallengeNonce();
    const now = Date.now();
    const ttlMs = config.judge.tokenValidityWindowMs * 2; // e.g. 10s

    const result = await query(
      `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch, used)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING challenge_nonce, issued_at_epoch, expires_at_epoch`,
      [sessionUuid, nonce, now, now + ttlMs]
    );

    const challenge = result.rows[0];
    // Server returns its authoritative epoch so the client can anchor its
    // claimed timestamp to the SERVER clock (Layer-2: kills the noisy-client-
    // clock + snapshot-before-challenge staleness bug).
    res.json({
      session_uuid: sessionUuid,
      server_time_ms: now,
      nonce: challenge.challenge_nonce,
      issued_at_epoch: challenge.issued_at_epoch,
      expires_at_epoch: challenge.expires_at_epoch,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:sessionUuid/attendance
 * Attendance records for a session (professor view, ownership-checked)
 */
router.get('/sessions/:sessionUuid/attendance', requireProfessor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;
    const owns = await ensureOwnSession(sessionUuid, (req as any).professor.sub);
    if (!owns) return res.status(404).json({ error: 'Session not found' });
    const records = await judgeService.getSessionAttendance(sessionUuid);
    // Align with frontend contract: bare array with id / student_roll_no / student_email
    const shaped = records.map((r: any) => ({
      id: r.ledger_uuid,
      session_id: r.session_uuid,
      student_roll_no: r.roll_no,
      student_email: r.email,
      client_claimed_time: r.client_claimed_time,
      server_logged_time: r.server_logged_time,
      verification_delta_ms: r.verification_delta_ms,
      status: r.status,
    }));
    res.json(shaped);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/students/:studentUuid/attendance
 * A student's attendance history
 */
router.get('/students/:studentUuid/attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentUuid } = req.params;
    const records = await judgeService.getStudentAttendance(studentUuid);
    res.json(records);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/claim-attendance
 * Main 4-gate attendance claim endpoint
 */
router.post('/claim-attendance', requireApiKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = claimAttendanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const payload = parseResult.data;
    const result = await judgeService.processClaim(payload);

    // PRESENT is a success (200) — not an error envelope.
    if (result.status === 'PRESENT') {
      res.json(result);
      return;
    }

    // Any other outcome is a standardized error envelope carrying the semantic
    // zero-trust code (see docs/ERROR_DICTIONARY.md).
    const statusMap: Record<string, number> = {
      ERR_HW_MISMATCH: 403,        // Gate 1 — unregistered hardware
      ERR_SIG_INVALID: 401,        // Gate 4 — forged/corrupted HMAC
      ERR_STREAM_DETECTED: 412,    // Gate 4 — photonic intercept lag > 250ms
      ERR_TOKEN_EXPIRED: 406,      // Gate 3 — visual token expired/invalid
      ERR_NONCE_USED: 400,         // Gate 4 — nonce replayed
      ERR_NONCE_INVALID: 400,      // Gate 4 — nonce invalid/expired
      ERR_NOT_FOUND: 404,          // Gate 1 — unknown student
    };
    const code = result.code ?? 'ERR_UNKNOWN';
    const status = statusMap[code] ?? 400;
    if (result.code === 'ERR_STREAM_DETECTED' && result.verification_delta_ms !== undefined) {
      sendError(res, status, code, result.message, { latencyMs: result.verification_delta_ms });
    } else {
      sendError(res, status, code, result.message);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/provision
 * Self-service provisioning — SRS §1 Phase 1 ("The Blood Oath").
 * Validates roll_no + the admin-issued HMAC secret, then binds this device as
 * the hardware tattoo (Gate 1). 401 wrong secret / student not found,
 * 409 device already bound to a different student (admin must reset-device).
 */
router.post('/provision', requireApiKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = provisionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors });
    }

    const { roll_no, secret_hmac_key, device_id_hash } = parseResult.data;

    // Look up the student by roll number AND verify the admin-issued secret
    // (constant-time HMAC comparison is overkill for a provisioning secret;
    // a simple equality check is acceptable here because the secret is 256-bit).
    const studentRes = await query(
      `SELECT student_uuid, roll_no, bound_device_id FROM students
       WHERE roll_no = $1 AND secret_hmac_key = $2`,
      [roll_no, secret_hmac_key]
    );

    if (studentRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid roll number or provisioning secret' });
    }

    const student = studentRes.rows[0];

    // Already bound to this device → idempotent success
    if (student.bound_device_id === device_id_hash) {
      return res.json({ provisioned: true, student_uuid: student.student_uuid, roll_no: student.roll_no });
    }

    // Bound to a DIFFERENT device → the admin must reset-device first
    if (student.bound_device_id) {
      return res.status(409).json({
        error: 'Device already bound elsewhere — the admin must unlock the student (device reset) to re-provision',
      });
    }

    await query(
      `UPDATE students SET bound_device_id = $1, updated_at = NOW() WHERE student_uuid = $2`,
      [device_id_hash, student.student_uuid]
    );

    // Audit the provisioning event
    await query(
      `INSERT INTO audit_logs (event_type, actor_uuid, payload, user_agent)
       VALUES ('PROVISION', $1, $2, 'attendance-mobile')`,
      [student.student_uuid, JSON.stringify({ roll_no, device_id_hash_bind: true })]
    );

    res.status(201).json({ provisioned: true, student_uuid: student.student_uuid, roll_no: student.roll_no });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/devices/register
 * Register a device to a student (Gate 1 binding)
 */
router.post('/devices/register', requireApiKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = deviceRegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors });
    }

    const { student_uuid, device_id_hash } = parseResult.data;

    const result = await query(
      `UPDATE students SET bound_device_id = $1, updated_at = NOW()
       WHERE student_uuid = $2 AND (bound_device_id IS NULL OR bound_device_id = $1)
       RETURNING student_uuid, roll_no, bound_device_id`,
      [device_id_hash, student_uuid]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Device already bound to different student or student not found' });
    }

    res.json({ registered: true, ...result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/health
 */
router.get('/health', async (_req: Request, res: Response) => {
  const dbHealthy = await (await import('../utils/db')).checkDbHealth();
  res.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    db: dbHealthy ? 'connected' : 'disconnected',
  });
});

export default router;