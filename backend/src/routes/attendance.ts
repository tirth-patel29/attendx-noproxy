import { Router, Request, Response, NextFunction } from 'express';
import { judgeService } from '../services/judge';
import { metronomeService } from '../services/metronome';
import { query } from '../utils/db';
import { config } from '../config';
import { z } from 'zod';

const router = Router();

// Validation schemas
const claimAttendanceSchema = z.object({
  session_uuid: z.string().uuid(),
  student_uuid: z.string().uuid(),
  token_val: z.string().length(6),
  client_claimed_time: z.number().int().positive(),
  device_id_hash: z.string().length(64),
  nonce: z.string().length(32),
  hmac_signature: z.string().length(64),
});

const sessionStartSchema = z.object({
  course_code: z.string().min(1).max(20),
  prof_uuid: z.string().uuid(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const deviceRegisterSchema = z.object({
  student_uuid: z.string().uuid(),
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
 * Server epoch time for Cristian's Algorithm clock synchronization
 */
router.get('/time-sync', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const serverEpoch = Date.now();
    res.json({
      server_epoch: serverEpoch,
      server_iso: new Date(serverEpoch).toISOString(),
    });
  } catch (err) {
    next(err);
  }
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
 * GET /api/v1/sessions?professor_id=xxx
 * List sessions (optionally filtered by professor)
 */
router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const professorId = req.query.professor_id as string | undefined;
    let result;
    if (professorId) {
      result = await query(
        `SELECT session_uuid, course_code, prof_uuid, session_date, is_active, created_at
         FROM course_sessions WHERE prof_uuid = $1 ORDER BY created_at DESC`,
        [professorId]
      );
    } else {
      result = await query(
        `SELECT session_uuid, course_code, prof_uuid, session_date, is_active, created_at
         FROM course_sessions ORDER BY created_at DESC`
      );
    }
    const shaped = await Promise.all(result.rows.map(shapeSession));
    res.json(shaped);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:sessionUuid
 * Single session
 */
router.get('/sessions/:sessionUuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;
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
 * Professor starts a new session (creates course_session + starts metronome)
 */
router.post('/sessions/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = sessionStartSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors });
    }

    const { course_code, prof_uuid, session_date } = parseResult.data;
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
 * Professor stops a session (stops metronome)
 */
router.post('/sessions/:sessionUuid/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;

    await query(
      `UPDATE course_sessions SET is_active = FALSE WHERE session_uuid = $1 RETURNING *`,
      [sessionUuid]
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
 * GET /api/v1/sessions/:sessionUuid/attendance
 * Attendance records for a session (professor view) — returns bare array
 */
router.get('/sessions/:sessionUuid/attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;
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
router.post('/claim-attendance', async (req: Request, res: Response, next: NextFunction) => {
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

    const statusMap: Record<string, number> = {
      PRESENT: 200,
      HARDWARE_MISMATCH: 403,
      STREAM_DETECTED: 403,
      FORGED_RESPONSE: 403,
      EXPIRED_TOKEN: 410,
      INVALID_CLAIM: 404,
    };

    res.status(statusMap[result.status] || 400).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/devices/register
 * Register a device to a student (Gate 1 binding)
 */
router.post('/devices/register', async (req: Request, res: Response, next: NextFunction) => {
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