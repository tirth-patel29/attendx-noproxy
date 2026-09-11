// src/routes/attendance.ts
import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { judgeService } from "../services/judge";
import { metronomeService } from "../services/metronome";
import { query } from "../utils/db";
import { requireApiKey } from "../utils/apiKey";
import { sendError } from "../utils/apiError";
import { config } from "../config";
import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}
const router = Router();

export function requireProfessor(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return sendError(
      res,
      401,
      "ERR_AUTH_MISSING",
      "Missing or invalid JWT/API Key.",
    );
  try {
    const decoded = jwt.verify(
      auth.slice(7),
      config.jwtSecret || "dev-secret-change-in-production-min-32-chars-long",
    ) as {
      sub: string;
      email: string;
      name: string;
      role: string;
    };
    if (decoded.role !== "professor")
      return sendError(res, 403, "ERR_FORBIDDEN", "Professor access required.");
    (req as any).professor = decoded;
    next();
  } catch {
    return sendError(res, 401, "ERR_AUTH_MISSING", "Invalid or expired token.");
  }
}

async function ensureOwnSession(
  sessionUuid: string,
  profUuid: string,
): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM course_sessions WHERE session_uuid = $1 AND prof_uuid = $2`,
    [sessionUuid, profUuid],
  );
  return r.rows.length > 0;
}

const claimAttendanceSchema = z.object({
  session_uuid: z.string().uuid(),
  student_uuid: z.string().uuid(),
  token_val: z.string().length(4),
  client_claimed_time: z.number().int().positive(),
  device_id_hash: z.string().length(64),
  nonce: z.string().length(32),
  hmac_signature: z.string().length(64),
});

const sessionStartSchema = z.object({
  course_code: z.string().min(1).max(20),
  prof_uuid: z.string().uuid().optional(),
  session_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const deviceRegisterSchema = z.object({
  student_uuid: z.string().uuid(),
  device_id_hash: z.string().length(64),
});

const provisionSchema = z.object({
  roll_no: z.string().regex(/^[0-9]{2}[A-Z]{3}[0-9]{3}$/),
  secret_hmac_key: z.string().length(64),
  device_id_hash: z.string().length(64),
});

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
    `SELECT (SELECT COUNT(*) FROM students) AS total_students, (SELECT COUNT(*) FROM attendance_ledger WHERE session_uuid = $1 AND status = 'PRESENT') AS present_count`,
    [row.session_uuid],
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

router.get("/time-sync", async (_req: Request, res: Response) => {
  const serverEpoch = Date.now();
  res.setHeader("Cache-Control", "no-store");
  res.json({
    server_epoch: serverEpoch,
    server_iso: new Date(serverEpoch).toISOString(),
  });
});

router.get("/latency-ping", async (_req: Request, res: Response) => {
  const t0 = process.hrtime.bigint();
  const serverNow = Date.now();
  let dbUs: number | null = null;
  try {
    const td = process.hrtime.bigint();
    await query("SELECT 1 AS ok");
    dbUs = Number((process.hrtime.bigint() - td) / 1000n);
  } catch {}
  const totalUs = Number((process.hrtime.bigint() - t0) / 1000n);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    server_epoch: serverNow,
    server_iso: new Date(serverNow).toISOString(),
    db_echo_us: dbUs,
    origin_handled_us: totalUs,
    middleware_us: dbUs !== null ? totalUs - dbUs : null,
    breakdown: {
      db_roundtrip_us: dbUs,
      app_overhead_us: dbUs !== null ? totalUs - dbUs : null,
      server_total_us: totalUs,
    },
  });
});

router.get(
  "/professors",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `SELECT prof_uuid, email, name, department FROM professors ORDER BY name`,
      );
      res.json(result.rows.map(shapeProfessor));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/professors/:profUuid",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { profUuid } = req.params;
      const result = await query(
        `SELECT prof_uuid, email, name, department FROM professors WHERE prof_uuid = $1`,
        [profUuid],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Professor not found" });
      res.json(shapeProfessor(result.rows[0]));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/sessions",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const professorId = (req as any).professor.sub as string;
      const result = await query(
        `SELECT session_uuid, course_code, prof_uuid, session_date, is_active, created_at FROM course_sessions WHERE prof_uuid = $1 ORDER BY created_at DESC`,
        [professorId],
      );
      const shaped = await Promise.all(result.rows.map(shapeSession));
      res.json(shaped);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/sessions/:sessionUuid",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isUuid(req.params.sessionUuid))
        return res.status(404).json({ error: "Session not found" });
      const { sessionUuid } = req.params;
      const owns = await ensureOwnSession(
        sessionUuid,
        (req as any).professor.sub,
      );
      if (!owns) return res.status(404).json({ error: "Session not found" });
      const result = await query(
        `SELECT session_uuid, course_code, prof_uuid, session_date, is_active, created_at FROM course_sessions WHERE session_uuid = $1`,
        [sessionUuid],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Session not found" });
      res.json(await shapeSession(result.rows[0]));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/sessions/start",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = sessionStartSchema.safeParse(req.body);
      if (!parseResult.success)
        return res
          .status(400)
          .json({
            error: "Invalid payload",
            details: parseResult.error.flatten().fieldErrors,
          });
      const { course_code, session_date } = parseResult.data;
      const prof_uuid = (req as any).professor.sub as string;
      const date = session_date || new Date().toISOString().split("T")[0];
      const result = await query(
        `INSERT INTO course_sessions (course_code, prof_uuid, session_date, is_active) VALUES ($1, $2, $3, TRUE) RETURNING *`,
        [course_code, prof_uuid, date],
      );
      const session = result.rows[0];
      await metronomeService.startSession(session.session_uuid);
      res
        .status(201)
        .json({ ...(await shapeSession(session)), metronome_started: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/sessions/:sessionUuid/stop",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isUuid(req.params.sessionUuid))
        return res.status(404).json({ error: "Session not found" });
      const { sessionUuid } = req.params;
      const owns = await ensureOwnSession(
        sessionUuid,
        (req as any).professor.sub,
      );
      if (!owns) return res.status(404).json({ error: "Session not found" });
      await query(
        `UPDATE course_sessions SET is_active = FALSE WHERE session_uuid = $1 AND prof_uuid = $2 RETURNING *`,
        [sessionUuid, (req as any).professor.sub],
      );
      metronomeService.stopSession(sessionUuid);
      res.json({ id: sessionUuid, stopped: true, is_active: false });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/sessions/:sessionUuid/tokens",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isUuid(req.params.sessionUuid))
        return res.status(404).json({ error: "Session not found" });
      const { sessionUuid } = req.params;
      const tokens = await metronomeService.getActiveTokens(sessionUuid);
      res.json({ session_uuid: sessionUuid, tokens });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/professor/timetable",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profUuid = (req as any).professor.sub as string;
      const r = await query(
        `SELECT a.assignment_id, a.course_code, c.title AS course_title, a.division_id, d.name AS division_name, a.day_of_week, to_char(a.start_time, 'HH24:MI') AS start_time, to_char(a.end_time, 'HH24:MI') AS end_time FROM teacher_assignments a JOIN courses c ON c.course_code = a.course_code JOIN divisions d ON d.division_id = a.division_id WHERE a.prof_uuid = $1 ORDER BY a.day_of_week, a.start_time`,
        [profUuid],
      );
      const todayDow = new Date().getDay();
      res.json({
        today_dow: todayDow,
        today: r.rows.filter((x) => x.day_of_week === todayDow),
        week: r.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/professor/summary",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profUuid = (req as any).professor.sub as string;
      const r = await query(
        `SELECT c.course_code, c.title, COUNT(DISTINCT cs.session_uuid)::int AS sessions_total, COUNT(DISTINCT cs.session_uuid) FILTER (WHERE cs.is_active)::int AS sessions_active, MAX(cs.session_date)::text AS last_session_date, COUNT(DISTINCT al.ledger_uuid)::int AS present_count, (SELECT COUNT(*) FROM students s WHERE s.division_id = c.division_id)::int AS total_students FROM courses c JOIN teacher_assignments a ON a.course_code = c.course_code AND a.prof_uuid = $1 LEFT JOIN course_sessions cs ON cs.course_code = c.course_code AND cs.prof_uuid = $1 LEFT JOIN attendance_ledger al ON al.session_uuid = cs.session_uuid AND al.status = 'PRESENT' GROUP BY c.course_code, c.title, c.division_id ORDER BY c.course_code`,
        [profUuid],
      );
      res.json(r.rows);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/professor/attendance-trend",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profUuid = (req as any).professor.sub as string;
      const r = await query(
        `SELECT 
          to_char(cs.session_date, 'Mon DD') as day,
          ROUND((COUNT(DISTINCT al.ledger_uuid)::float / NULLIF(SUM(
            (SELECT COUNT(*) FROM students s JOIN courses c ON c.division_id = s.division_id WHERE c.course_code = cs.course_code)
          ), 0) * 100)::numeric, 0)::int as rate
        FROM course_sessions cs
        LEFT JOIN attendance_ledger al ON al.session_uuid = cs.session_uuid AND al.status = 'PRESENT'
        WHERE cs.prof_uuid = $1 AND cs.session_date >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY cs.session_date
        ORDER BY cs.session_date ASC`,
        [profUuid],
      );
      if (r.rows.length === 0) {
        const empty = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { day: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }), rate: 0 };
        });
        return res.json(empty);
      }
      res.json(r.rows);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/sessions/:sessionUuid/challenge",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isUuid(req.params.sessionUuid))
        return res.status(404).json({ error: "Session not found" });
      const { sessionUuid } = req.params;
      const sessionCheck = await query(
        `SELECT session_uuid FROM course_sessions WHERE session_uuid = $1 AND is_active = TRUE`,
        [sessionUuid],
      );
      if (sessionCheck.rows.length === 0)
        return res.status(404).json({ error: "Active session not found" });
      const { generateChallengeNonce } = await import("../utils/crypto");
      const nonce = generateChallengeNonce();
      const now = Date.now();
      const ttlMs = config.judge.tokenValidityWindowMs * 2;
      const result = await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch, used) VALUES ($1, $2, $3, $4, FALSE) RETURNING challenge_nonce, issued_at_epoch, expires_at_epoch`,
        [sessionUuid, nonce, now, now + ttlMs],
      );
      const challenge = result.rows[0];
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
  },
);

router.get(
  "/sessions/:sessionUuid/attendance",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isUuid(req.params.sessionUuid))
        return res.status(404).json({ error: "Session not found" });
      const { sessionUuid } = req.params;
      const owns = await ensureOwnSession(
        sessionUuid,
        (req as any).professor.sub,
      );
      if (!owns) return res.status(404).json({ error: "Session not found" });
      const records = await judgeService.getSessionAttendance(sessionUuid);
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
  },
);

router.get(
  "/students/:studentUuid/attendance",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentUuid } = req.params;
      const records = await judgeService.getStudentAttendance(studentUuid);
      res.json(records);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/claim-attendance",
  requireApiKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = claimAttendanceSchema.safeParse(req.body);
      if (!parseResult.success)
        return res
          .status(400)
          .json({
            error: "Invalid payload",
            details: parseResult.error.flatten().fieldErrors,
          });
      const payload = parseResult.data;
      const result = await judgeService.processClaim(payload);
      if (result.status === "PRESENT") res.json(result);
      else
        res
          .status(400)
          .json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
              latency_ms: result.verification_delta_ms,
              details: {},
            },
          });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/provision-device",
  requireApiKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = provisionSchema.safeParse(req.body);
      if (!parseResult.success)
        return res
          .status(400)
          .json({
            error: "Invalid payload",
            details: parseResult.error.flatten().fieldErrors,
          });
      const { roll_no, secret_hmac_key, device_id_hash } = parseResult.data;
      const studentRes = await query(
        `SELECT student_uuid, roll_no, secret_hmac_key, bound_device_id FROM students WHERE roll_no = $1`,
        [roll_no],
      );
      if (studentRes.rows.length === 0)
        return res.status(404).json({ error: "Student not found" });
      const student = studentRes.rows[0];
      if (student.secret_hmac_key !== secret_hmac_key)
        return res.status(401).json({ error: "Invalid provisioning secret" });
      if (student.bound_device_id && student.bound_device_id !== device_id_hash)
        return res
          .status(409)
          .json({ error: "Student already bound to a different device" });
      const result = await query(
        `UPDATE students SET bound_device_id = $1, updated_at = NOW() WHERE student_uuid = $2 RETURNING student_uuid, roll_no, bound_device_id`,
        [device_id_hash, student.student_uuid],
      );
      res
        .status(201)
        .json({
          provisioned: true,
          student_uuid: student.student_uuid,
          roll_no: student.roll_no,
        });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/professor/current-lecture",
  requireProfessor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profUuid = (req as any).professor.sub as string;
      const serverNow = new Date();
      const serverDow = serverNow.getDay();
      const serverTime = serverNow.toTimeString().slice(0, 5);
      const serverDate = serverNow.toISOString().split("T")[0];
      const r = await query(
        `SELECT a.assignment_id, a.course_code, c.title AS course_title, a.division_id, d.name AS division_name, a.day_of_week, to_char(a.start_time, 'HH24:MI') AS start_time, to_char(a.end_time, 'HH24:MI') AS end_time FROM teacher_assignments a JOIN courses c ON c.course_code = a.course_code JOIN divisions d ON d.division_id = a.division_id WHERE a.prof_uuid = $1 AND a.day_of_week = $2 AND a.start_time <= $3::time AND a.end_time > $3::time ORDER BY a.start_time LIMIT 1`,
        [profUuid, serverDow, serverTime],
      );
      if (r.rows.length === 0) {
        return res.json({
          has_lecture: false,
          message: "No lecture scheduled at this time",
          server_time: serverNow.toISOString(),
          server_dow: serverDow,
          server_time_hm: serverTime,
          server_date: serverDate,
        });
      }
      const assignment = r.rows[0];
      const sessionRes = await query(
        `SELECT session_uuid, course_code, session_date, is_active, created_at FROM course_sessions WHERE prof_uuid = $1 AND course_code = $2 AND session_date = $3 ORDER BY created_at DESC LIMIT 1`,
        [profUuid, assignment.course_code, serverDate],
      );
      let active_session = null;
      if (sessionRes.rows.length > 0 && sessionRes.rows[0].is_active) {
        active_session = {
          session_id: sessionRes.rows[0].session_uuid,
          course_code: sessionRes.rows[0].course_code,
          session_date: sessionRes.rows[0].session_date,
          is_active: sessionRes.rows[0].is_active,
          started_at: sessionRes.rows[0].created_at,
        };
      }
      res.json({
        has_lecture: true,
        assignment: {
          assignment_id: assignment.assignment_id,
          course_code: assignment.course_code,
          course_title: assignment.course_title,
          division_id: assignment.division_id,
          division_name: assignment.division_name,
          start_time: assignment.start_time,
          end_time: assignment.end_time,
        },
        active_session,
        server_time: serverNow.toISOString(),
        server_dow: serverDow,
        server_time_hm: serverTime,
        server_date: serverDate,
        time_until_end_minutes: Math.max(
          0,
          Math.floor(
            (new Date(
              serverDate + "T" + assignment.end_time + ":00",
            ).getTime() -
              serverNow.getTime()) /
              60000,
          ),
        ),
      });
    } catch (err) {
      next(err);
    }
  },
);



router.post(
  "/devices/register",
  requireApiKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = deviceRegisterSchema.safeParse(req.body);
      if (!parseResult.success)
        return res
          .status(400)
          .json({
            error: "Invalid payload",
            details: parseResult.error.flatten().fieldErrors,
          });
      const { student_uuid, device_id_hash } = parseResult.data;
      const result = await query(
        `UPDATE students SET bound_device_id = $1, updated_at = NOW() WHERE student_uuid = $2 AND (bound_device_id IS NULL OR bound_device_id = $1) RETURNING student_uuid, roll_no, bound_device_id`,
        [device_id_hash, student_uuid],
      );
      if (result.rows.length === 0)
        return res
          .status(409)
          .json({
            error:
              "Device already bound to different student or student not found",
          });
      res.json({ registered: true, ...result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/health", async (_req: Request, res: Response) => {
  const dbHealthy = await (await import("../utils/db")).checkDbHealth();
  res.json({
    status: dbHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    db: dbHealthy ? "connected" : "disconnected",
  });
});

export default router;
