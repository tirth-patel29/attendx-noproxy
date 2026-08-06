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
  device_id_hash: z.string().length(64), // SHA-256 hex
  nonce: z.string().length(32), // 16 bytes hex
  hmac_signature: z.string().length(64), // HMAC-SHA256 hex
});

const timeSyncResponseSchema = z.object({
  server_epoch: z.number(),
  server_iso: z.string(),
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

/**
 * GET /api/v1/time-sync
 * Returns server epoch time for Cristian's Algorithm clock synchronization
 * Client uses this to calculate drift_offset = server_epoch - client_epoch
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
 * POST /api/v1/claim-attendance
 * Main 4-gate attendance claim endpoint
 */
router.post('/claim-attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate payload
    const parseResult = claimAttendanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const payload = parseResult.data;
    const result = await judgeService.processClaim(payload);

    // Map status to HTTP status
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
      ...session,
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

    res.json({ session_uuid: sessionUuid, stopped: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:sessionUuid/tokens
 * Debug endpoint: get current active tokens for a session
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
 * Get attendance records for a session (professor view)
 */
router.get('/sessions/:sessionUuid/attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionUuid } = req.params;
    const records = await judgeService.getSessionAttendance(sessionUuid);
    res.json({ session_uuid: sessionUuid, count: records.length, records });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/devices/register
 * Register a device to a student (Gate 1 binding)
 * Called during initial provisioning
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
 * Health check endpoint
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