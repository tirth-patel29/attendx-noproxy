// src/routes/admin.ts
// ============================================================================
// ADMIN CONSOLE — "Top of the Database" (Zero-Trust Attendance Gateway)
// ----------------------------------------------------------------------------
// Mounted at:
//   /api/v1/admin/login   (public, admin login -> JWT role 'admin')
//   /api/v1/admin/*       (protected by requireAdmin)
//
// Governs the whole college hierarchy:
//   - teachers      (professors): create, edit, delete, reset password
//   - students      : create, edit, delete + security-sensitive operations
//                    (device reset = unbind hardware tattoo, HMAC rotation)
//   - divisions     : academic structure
//   - courses       : classes, each bound to a division
//   - assignments   : the timetable (teacher x course x division x day/time)
//
// Security-sensitive mutations (device reset / HMAC rotate / password reset)
// are written to the append-only audit_logs table for forensics.
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../utils/db';
import { config } from '../config';
import { generateHmacKey } from '../utils/crypto';
import { generateApiKey } from '../utils/apiKey';
import { sendError } from '../utils/apiError';
import { academicRouter } from './academic';
import { academicResolver } from '../services/academic_resolver';

const JWT_SECRET = config.jwtSecret || 'dev-secret-change-in-production-min-32-chars-long';

// ---------------------------------------------------------------------------
// Auth: requireAdmin middleware (attached in index.ts to the protected router)
// ---------------------------------------------------------------------------
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return sendError(res, 401, 'ERR_AUTH_MISSING', 'Missing or invalid JWT/API Key.');
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as {
      sub: string;
      email: string;
      name: string;
      role: string;
    };
    if (decoded.role !== 'admin') {
      return sendError(res, 403, 'ERR_FORBIDDEN', 'Admin access required.');
    }
    (req as any).admin = decoded;
    next();
  } catch (err) {
    return sendError(res, 401, 'ERR_AUTH_MISSING', 'Invalid or expired token.');
  }
}

// ---------------------------------------------------------------------------
// Append-only audit trail
// ---------------------------------------------------------------------------
async function audit(
  actorUuid: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (event_type, actor_uuid, payload) VALUES ($1, $2, $3)`,
      [eventType, actorUuid, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('audit log write failed:', err);
  }
}

// ---------------------------------------------------------------------------
// PUBLIC: Admin login
// ---------------------------------------------------------------------------
export const adminPublicRouter = Router();

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

adminPublicRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    const { email, password } = parsed.data;

    const r = await query(`SELECT * FROM admin_users WHERE email = $1`, [email]);
    if (r.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const admin = r.rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { sub: admin.admin_uuid, email: admin.email, name: admin.name, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    const refreshToken = jwt.sign(
      { sub: admin.admin_uuid, type: 'refresh', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: admin.admin_uuid, email: admin.email, name: admin.name, role: 'admin' },
    });
  } catch (err) {
    next(err);
  }
});

// POST /login/refresh — silent token rotation
adminPublicRouter.post('/login/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });
    const decoded = jwt.verify(refresh_token, JWT_SECRET) as { sub: string; type: string; role: string };
    if (decoded.type !== 'refresh' || decoded.role !== 'admin') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    const r = await query(`SELECT admin_uuid, email, name FROM admin_users WHERE admin_uuid = $1`, [decoded.sub]);
    if (r.rows.length === 0) return res.status(401).json({ error: 'Admin not found' });
    const admin = r.rows[0];
    const accessToken = jwt.sign(
      { sub: admin.admin_uuid, email: admin.email, name: admin.name, role: 'admin' },
      JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({ access_token: accessToken });
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Refresh token expired' });
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ---------------------------------------------------------------------------
// PROTECTED: CRUD router
// ---------------------------------------------------------------------------
export const adminRouter = Router();

adminRouter.use('/academic', academicRouter);

// ---- Validation schemas ----
const teacherCreate = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  department: z.string().min(1).max(50),
  password: z.string().min(8).max(128),
});
const teacherUpdate = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  department: z.string().min(1).max(50),
});
const resetPwSchema = z.object({ password: z.string().min(8).max(128) });

const studentCreate = z.object({
  roll_no: z.string().regex(/^(?:D)?\d{2}[A-Z]{1,4}\d{3}$/i, 'Invalid roll number format (e.g. 24BCS001, 24DCE071)'),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  division_id: z.string().uuid().optional().nullable(),
  batch_id: z.string().uuid().optional().nullable(),
});
const studentUpdate = z.object({
  roll_no: z.string().regex(/^(?:D)?\d{2}[A-Z]{1,4}\d{3}$/i),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  division_id: z.string().uuid().optional().nullable(),
  batch_id: z.string().uuid().optional().nullable(),
});

const divisionCreate = z.object({ name: z.string().min(1).max(50) });
const courseCreate = z.object({ course_code: z.string().min(1).max(20), title: z.string().min(1).max(100), division_id: z.string().uuid().optional().nullable() });

const assignmentCreate = z.object({
  prof_uuid: z.string().uuid(),
  course_code: z.string().min(1).max(20),
  division_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

// ===========================================================================
// Dashboard stats
// ===========================================================================
const changePasswordSchema = z.object({ current_password: z.string().min(1), new_password: z.string().min(8).max(128) });

/**
 * POST /admin/change-password — rotate the signed-in admin's password.
 * Root-cause fix for reliable admin lifecycle: the default seeded credential
 * must be changeable without DB access.
 */
adminRouter.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const admin = (req as any).admin as { sub: string };
    const { current_password, new_password } = parsed.data;

    const r = await query(`SELECT password_hash FROM admin_users WHERE admin_uuid = $1`, [admin.sub]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });

    if (!(await bcrypt.compare(current_password, r.rows[0].password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await query(`UPDATE admin_users SET password_hash = $1 WHERE admin_uuid = $2`, [hash, admin.sub]);
    await audit(admin.sub, 'ADMIN_PASSWORD_CHANGE', { admin_uuid: admin.sub });
    res.json({ message: 'Password changed' });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM professors) AS teachers,
        (SELECT COUNT(*) FROM students) AS students,
        (SELECT COUNT(*) FROM divisions) AS divisions,
        (SELECT COUNT(*) FROM courses) AS courses,
        (SELECT COUNT(*) FROM teacher_assignments) AS assignments,
        (SELECT COUNT(*) FROM course_sessions WHERE is_active = TRUE) AS active_sessions
    `);
    const row = r.rows[0];
    res.json({
      teachers: parseInt(row.teachers, 10),
      students: parseInt(row.students, 10),
      divisions: parseInt(row.divisions, 10),
      courses: parseInt(row.courses, 10),
      assignments: parseInt(row.assignments, 10),
      active_sessions: parseInt(row.active_sessions, 10),
    });
  } catch (err) {
    next(err);
  }
});

// ===========================================================================
// DASHBOARD AGGREGATIONS
// ===========================================================================

adminRouter.get('/dashboard/attendance-trend', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT 
        to_char(cs.session_date, 'Mon DD') as day,
        ROUND((COUNT(DISTINCT al.ledger_uuid)::float / NULLIF(SUM(
          (SELECT COUNT(*) FROM students s JOIN courses c ON c.division_id = s.division_id WHERE c.course_code = cs.course_code)
        ), 0) * 100)::numeric, 0)::int as rate
      FROM course_sessions cs
      LEFT JOIN attendance_ledger al ON al.session_uuid = cs.session_uuid AND al.status = 'PRESENT'
      WHERE cs.session_date >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY cs.session_date
      ORDER BY cs.session_date ASC
    `);
    // If the database has no data, return a default week to avoid empty charts
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
});

adminRouter.get('/dashboard/verification-split', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT status as name, COUNT(*)::int as value
      FROM attendance_ledger
      WHERE server_logged_time >= NOW() - INTERVAL '1 day'
      GROUP BY status
    `);
    if (r.rows.length === 0) {
      return res.json([{ name: 'NO_DATA', value: 1 }]);
    }
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/dashboard/recent-activity', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT event_type, payload, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 10
    `);
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/dashboard/department-stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT 
        d.name as department,
        COUNT(DISTINCT s.student_uuid)::int as students,
        COUNT(DISTINCT c.course_code)::int as courses
      FROM departments d
      LEFT JOIN branches b ON b.department_id = d.id
      LEFT JOIN divisions div ON div.branch_id = b.id
      LEFT JOIN students s ON s.division_id = div.division_id
      LEFT JOIN courses c ON c.division_id = div.division_id
      GROUP BY d.name
      ORDER BY students DESC
    `);
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/dashboard/session-activity', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as sessions
      FROM course_sessions
      WHERE session_date = CURRENT_DATE
      GROUP BY hour
      ORDER BY hour ASC
    `);
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/dashboard/active-sessions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT 
        cs.session_uuid as id,
        cs.course_code as subject,
        p.name as faculty,
        'Active' as status,
        COALESCE(c.division_id, 'Unknown') as division,
        (SELECT COUNT(*) FROM attendance_ledger al WHERE al.session_uuid = cs.session_uuid AND al.status = 'PRESENT')::int as present,
        (SELECT COUNT(*) FROM students s JOIN courses c2 ON c2.division_id = s.division_id WHERE c2.course_code = cs.course_code)::int as total
      FROM course_sessions cs
      LEFT JOIN professors p ON p.prof_uuid = cs.prof_uuid
      LEFT JOIN courses c ON c.course_code = cs.course_code
      WHERE cs.is_active = TRUE
      ORDER BY cs.created_at DESC
      LIMIT 10
    `);
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

// ===========================================================================
// TEACHERS (professors)
// ===========================================================================
adminRouter.get('/teachers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT p.prof_uuid, p.email, p.name, p.department,
             p.password_hash IS NOT NULL AS has_login,
             COUNT(a.assignment_id)::int AS assignment_count
      FROM professors p
      LEFT JOIN teacher_assignments a ON a.prof_uuid = p.prof_uuid
      GROUP BY p.prof_uuid
      ORDER BY p.name
    `);
    res.json(r.rows.map((row) => ({
      id: row.prof_uuid,
      email: row.email,
      name: row.name,
      department: row.department,
      has_login: row.has_login,
      assignment_count: row.assignment_count,
    })));
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/teachers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = teacherCreate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    const { email, name, department, password } = parsed.data;
    const hash = await bcrypt.hash(password, 12);
    const r = await query(
      `INSERT INTO professors (email, name, department, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING prof_uuid`, [email, name, department, hash]
    );
    await audit((req as any).admin.sub, 'TEACHER_CREATE', { prof_uuid: r.rows[0].prof_uuid, email });
    res.status(201).json({ id: r.rows[0].prof_uuid, email, name, department });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A teacher with that email already exists' });
    next(err);
  }
});

adminRouter.put('/teachers/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = teacherUpdate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    const { email, name, department } = parsed.data;
    const r = await query(
      `UPDATE professors SET email=$1, name=$2, department=$3 WHERE prof_uuid=$4 RETURNING prof_uuid`,
      [email, name, department, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await audit((req as any).admin.sub, 'TEACHER_UPDATE', { prof_uuid: req.params.uuid, email });
    res.json({ id: req.params.uuid, email, name, department });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A teacher with that email already exists' });
    next(err);
  }
});

adminRouter.post('/teachers/:uuid/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resetPwSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Password must be 8+ characters' });
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const r = await query(
      `UPDATE professors SET password_hash=$1 WHERE prof_uuid=$2 RETURNING prof_uuid`,
      [hash, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await audit((req as any).admin.sub, 'TEACHER_PASSWORD_RESET', { prof_uuid: req.params.uuid });
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/teachers/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`DELETE FROM professors WHERE prof_uuid=$1 RETURNING prof_uuid`, [req.params.uuid]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await audit((req as any).admin.sub, 'TEACHER_DELETE', { prof_uuid: req.params.uuid });
    res.json({ message: 'Teacher deleted' });
  } catch (err) {
    next(err);
  }
});

// ===========================================================================
// STUDENTS (roster + hardware/HMAC management)
// ===========================================================================
adminRouter.get('/students', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT s.student_uuid, s.roll_no, s.email, s.name, s.bound_device_id,
             s.secret_hmac_key, s.division_id, d.name AS division_name, 
             s.batch_id, b.name AS batch_name,
             br.name AS branch_name, dept.name AS department_name, c.name AS college_name,
             s.created_at, s.password_hash IS NOT NULL AS has_password
      FROM students s
      LEFT JOIN divisions d ON d.division_id = s.division_id
      LEFT JOIN batches b ON b.id = s.batch_id
      LEFT JOIN branches br ON d.branch_id = br.id
      LEFT JOIN departments dept ON br.department_id = dept.id
      LEFT JOIN colleges c ON dept.college_id = c.id
      ORDER BY s.roll_no
    `);
    res.json(r.rows.map((row) => ({
      id: row.student_uuid,
      roll_no: row.roll_no,
      email: row.email,
      name: row.name,
      division_id: row.division_id,
      division_name: row.division_name,
      batch_id: row.batch_id,
      batch_name: row.batch_name,
      branch_name: row.branch_name,
      department_name: row.department_name,
      college_name: row.college_name,
      bound_device_id: row.bound_device_id,
      has_password: row.has_password,
      // Mask long secrets for the dashboard list; full value via GET detail
      secret_hmac_key: row.secret_hmac_key ? `${row.secret_hmac_key.slice(0, 8)}…${row.secret_hmac_key.slice(-4)}` : null,
      is_bound: Boolean(row.bound_device_id),
      created_at: row.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/students/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `SELECT s.student_uuid, s.roll_no, s.email, s.name, s.bound_device_id, s.secret_hmac_key,
              s.division_id, d.name AS division_name,
              s.batch_id, b.name AS batch_name, 
              br.name AS branch_name, dept.name AS department_name, c.name AS college_name,
              s.created_at, s.updated_at
       FROM students s 
       LEFT JOIN divisions d ON d.division_id = s.division_id
       LEFT JOIN batches b ON b.id = s.batch_id
       LEFT JOIN branches br ON d.branch_id = br.id
       LEFT JOIN departments dept ON br.department_id = dept.id
       LEFT JOIN colleges c ON dept.college_id = c.id
       WHERE s.student_uuid = $1`, [req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const row = r.rows[0];
    res.json({
      id: row.student_uuid,
      roll_no: row.roll_no,
      email: row.email,
      name: row.name,
      division_id: row.division_id,
      division_name: row.division_name,
      batch_id: row.batch_id,
      batch_name: row.batch_name,
      branch_name: row.branch_name,
      department_name: row.department_name,
      college_name: row.college_name,
      bound_device_id: row.bound_device_id,
      secret_hmac_key: row.secret_hmac_key,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/students', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = studentCreate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    let { roll_no, email, name, division_id, batch_id } = parsed.data;

    // Resolve academic identity if not explicitly provided
    if (!batch_id || !division_id) {
      try {
        const resolved = await academicResolver.resolveStudentIdentity(roll_no);
        batch_id = batch_id || resolved.batch_id || null;
        division_id = division_id || resolved.division_id || null;
      } catch (err) {
        console.warn('Could not auto-resolve student identity:', err);
      }
    }

    const secret = generateHmacKey(); // fresh Gate-4 signer for the new student
    const r = await query(
      `INSERT INTO students (roll_no, email, name, division_id, batch_id, secret_hmac_key)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING student_uuid`,
      [roll_no, email, name, division_id ?? null, batch_id ?? null, secret]
    );
    await audit((req as any).admin.sub, 'STUDENT_CREATE', { student_uuid: r.rows[0].student_uuid, roll_no });
    res.status(201).json({ id: r.rows[0].student_uuid, roll_no, email, name, division_id: division_id ?? null, batch_id: batch_id ?? null, secret_hmac_key: secret });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Duplicate roll number or email' });
    next(err);
  }
});

adminRouter.put('/students/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = studentUpdate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    let { roll_no, email, name, division_id, batch_id } = parsed.data;

    // Resolve academic identity if not explicitly provided
    if (!batch_id || !division_id) {
      try {
        const resolved = await academicResolver.resolveStudentIdentity(roll_no);
        batch_id = batch_id || resolved.batch_id || null;
        division_id = division_id || resolved.division_id || null;
      } catch (err) {
        console.warn('Could not auto-resolve student identity:', err);
      }
    }

    const r = await query(
      `UPDATE students SET roll_no=$1, email=$2, name=$3, division_id=$4, batch_id=$5, updated_at=NOW()
       WHERE student_uuid=$6 RETURNING student_uuid`,
      [roll_no, email, name, division_id ?? null, batch_id ?? null, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    await audit((req as any).admin.sub, 'STUDENT_UPDATE', { student_uuid: req.params.uuid, roll_no });
    res.json({ message: 'Student updated' });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Duplicate roll number or email' });
    next(err);
  }
});

adminRouter.delete('/students/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`DELETE FROM students WHERE student_uuid=$1 RETURNING student_uuid`, [req.params.uuid]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    await audit((req as any).admin.sub, 'STUDENT_DELETE', { student_uuid: req.params.uuid });
    res.json({ message: 'Student deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /students/:uuid/reset-device
 * Gate-1 recovery: unbind the old hardware tattoo (bound_device_id -> NULL) AND
 * rotate the Gate-4 HMAC signer so the OLD device can no longer sign packets.
 * The student re-provisions on their working device. Forensically audit logged.
 */
adminRouter.post('/students/:uuid/reset-device', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newSecret = generateHmacKey();
    const r = await query(
      `UPDATE students SET bound_device_id = NULL, secret_hmac_key = $1, updated_at = NOW()
       WHERE student_uuid = $2 RETURNING student_uuid, roll_no, secret_hmac_key`,
      [newSecret, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const row = r.rows[0];
    await audit((req as any).admin.sub, 'DEVICE_RESET', {
      student_uuid: req.params.uuid,
      roll_no: row.roll_no,
      new_secret_hmac_key: newSecret,
    });
    res.json({
      message: 'Device unbound and HMAC rotated. Student must re-provision.',
      roll_no: row.roll_no,
      secret_hmac_key: newSecret,
      bound_device_id: null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /students/:uuid/rotate-hmac
 * Rotate the Gate-4 signer without unbinding hardware (used when a key may have leaked).
 */
adminRouter.post('/students/:uuid/rotate-hmac', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newSecret = generateHmacKey();
    const r = await query(
      `UPDATE students SET secret_hmac_key = $1, updated_at = NOW()
       WHERE student_uuid = $2 RETURNING student_uuid, roll_no, secret_hmac_key`,
      [newSecret, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const row = r.rows[0];
    await audit((req as any).admin.sub, 'HMAC_ROTATE', { student_uuid: req.params.uuid, roll_no: row.roll_no });
    res.json({ message: 'HMAC key rotated', roll_no: row.roll_no, secret_hmac_key: newSecret });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /students/:uuid/forgot-password
 * Admin-initiated password reset (physical verification — SRS "Shame Air-Gap"
 * philosophy applied to credentials). Clears password_hash so the NEXT time the
 * student opens the app they are prompted to set a new password (twice), which
 * is then stored. Audit logged.
 */
adminRouter.post('/students/:uuid/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `UPDATE students SET password_hash = NULL, updated_at = NOW() WHERE student_uuid = $1 RETURNING roll_no`,
      [req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    await audit((req as any).admin.sub, 'STUDENT_FORGOT_PASSWORD', {
      student_uuid: req.params.uuid,
      roll_no: r.rows[0].roll_no,
    });
    res.json({ message: 'Password cleared — the student can now set a new one in the app' });
  } catch (err) {
    next(err);
  }
});



// ===========================================================================
// COURSES (classes)
// ===========================================================================
adminRouter.get('/courses', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT c.course_code, c.title, c.division_id, d.name AS division_name,
             (SELECT COUNT(*) FROM teacher_assignments a WHERE a.course_code = c.course_code)::int AS assignment_count
      FROM courses c LEFT JOIN divisions d ON d.division_id = c.division_id
      ORDER BY c.course_code`);
    res.json(r.rows.map((row) => ({ id: row.course_code, course_code: row.course_code, title: row.title, division_id: row.division_id, division_name: row.division_name, assignment_count: row.assignment_count })));
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/courses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = courseCreate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { course_code, title, division_id } = parsed.data;
    const r = await query(
      `INSERT INTO courses (course_code, title, division_id) VALUES ($1,$2,$3) RETURNING course_code`,
      [course_code, title, division_id ?? null]
    );
    await audit((req as any).admin.sub, 'COURSE_CREATE', { course_code: r.rows[0].course_code });
    res.status(201).json({ id: course_code, course_code, title, division_id: division_id ?? null });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Course code already exists' });
    next(err);
  }
});

adminRouter.put('/courses/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = courseCreate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const { course_code, title, division_id } = parsed.data;
    const r = await query(
      `UPDATE courses SET course_code=$1, title=$2, division_id=$3 WHERE course_code=$4 RETURNING course_code`,
      [course_code, title, division_id ?? null, req.params.code]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    await audit((req as any).admin.sub, 'COURSE_UPDATE', { course_code: r.rows[0].course_code });
    res.json({ id: course_code, course_code, title, division_id: division_id ?? null });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Course code already exists' });
    next(err);
  }
});

adminRouter.delete('/courses/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`DELETE FROM courses WHERE course_code=$1 RETURNING course_code`, [req.params.code]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    await audit((req as any).admin.sub, 'COURSE_DELETE', { course_code: req.params.code });
    res.json({ message: 'Course deleted' });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(409).json({ error: 'Course has active assignments' });
    next(err);
  }
});

// ===========================================================================
// ASSIGNMENTS (the timetable)
// ===========================================================================
adminRouter.get('/assignments', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT a.assignment_id, a.prof_uuid, p.name AS teacher_name, p.email AS teacher_email,
             a.course_code, c.title AS course_title, a.division_id, d.name AS division_name,
             a.day_of_week, to_char(a.start_time, 'HH24:MI') AS start_time,
             to_char(a.end_time, 'HH24:MI') AS end_time
      FROM teacher_assignments a
      JOIN professors p ON p.prof_uuid = a.prof_uuid
      JOIN courses c ON c.course_code = a.course_code
      JOIN divisions d ON d.division_id = a.division_id
      ORDER BY a.day_of_week, a.start_time`);
    res.json(r.rows.map((row) => ({
      id: row.assignment_id,
      prof_uuid: row.prof_uuid,
      teacher_name: row.teacher_name,
      teacher_email: row.teacher_email,
      course_code: row.course_code,
      course_title: row.course_title,
      division_id: row.division_id,
      division_name: row.division_name,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
    })));
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/assignments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = assignmentCreate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { prof_uuid, course_code, division_id, day_of_week, start_time, end_time } = parsed.data;
    const r = await query(
      `INSERT INTO teacher_assignments (prof_uuid, course_code, division_id, day_of_week, start_time, end_time)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING assignment_id`,
      [prof_uuid, course_code, division_id, day_of_week, start_time, end_time]
    );
    await audit((req as any).admin.sub, 'ASSIGNMENT_CREATE', { assignment_id: r.rows[0].assignment_id });
    res.status(201).json({ id: r.rows[0].assignment_id });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Referenced teacher/course/division not found' });
    next(err);
  }
});

adminRouter.put('/assignments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = assignmentCreate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const { prof_uuid, course_code, division_id, day_of_week, start_time, end_time } = parsed.data;
    const r = await query(
      `UPDATE teacher_assignments SET prof_uuid=$1, course_code=$2, division_id=$3, day_of_week=$4, start_time=$5, end_time=$6
       WHERE assignment_id=$7 RETURNING assignment_id`,
      [prof_uuid, course_code, division_id, day_of_week, start_time, end_time, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    await audit((req as any).admin.sub, 'ASSIGNMENT_UPDATE', { assignment_id: r.rows[0].assignment_id });
    res.json({ message: 'Assignment updated' });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/assignments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`DELETE FROM teacher_assignments WHERE assignment_id=$1 RETURNING assignment_id`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    await audit((req as any).admin.sub, 'ASSIGNMENT_DELETE', { assignment_id: req.params.id });
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// API Keys console — mint shared client keys (transport gate for the APK)
//   GET  /api/v1/admin/api-keys            -> list (never the raw key)
//   POST /api/v1/admin/api-keys            -> mint {label} (raw shown once)
//   POST /api/v1/admin/api-keys/:uuid/revoke
// ---------------------------------------------------------------------------
adminRouter.get('/api-keys', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `SELECT key_uuid, label, prefix, status, created_at, last_used_at
       FROM api_keys ORDER BY created_at DESC`
    );
    res.json({ keys: r.rows });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = z.object({ label: z.string().min(1).max(64) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid label' });
  try {
    const { raw, hash, prefix } = generateApiKey();
    const actor = (req as any).admin?.sub || 'admin';
    const ins = await query(
      `INSERT INTO api_keys (key_hash, prefix, label, created_by) VALUES ($1,$2,$3,$4)
       RETURNING key_uuid, created_at`,
      [hash, prefix, parsed.data.label, actor]
    );
    await audit(actor, 'API_KEY_CREATE', { label: parsed.data.label, key_uuid: ins.rows[0].key_uuid, prefix });
    res.status(201).json({
      key_uuid: ins.rows[0].key_uuid,
      label: parsed.data.label,
      prefix,
      api_key: raw,                                    // shown exactly once
      created_at: ins.rows[0].created_at,
      note: 'Store this key now — it cannot be retrieved again.',
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/api-keys/:uuid/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `UPDATE api_keys SET status = 'revoked' WHERE key_uuid = $1 RETURNING key_uuid`,
      [req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Key not found' });
    await audit((req as any).admin?.sub || 'admin', 'API_KEY_REVOKE', { key_uuid: req.params.uuid });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default {
  adminPublicRouter,
  adminRouter,
  requireAdmin,
};
