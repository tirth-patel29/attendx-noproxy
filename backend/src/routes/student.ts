// src/routes/student.ts
// ============================================================================
// STUDENT SELF-REGISTRATION & DEVICE-BOUND AUTH (SRS §1 Phase 1)
// ----------------------------------------------------------------------------
// The student identity is `{roll_no}@charusat.edu.in`.
//
// Flow (mirrors the Flutter client):
//   1. POST /student/status      {id}          → exists? has_password?
//   2. POST /student/register    {id,name,password}   (if !exists)
//   3. POST /student/password/set {id,new_password}   (if exists && !has_password
//                                           — includes admin "forgot password")
//   4. POST /student/login       {id,password} → student JWT
//   5. POST /student/device/bind (JWT) {device_id_hash}
//                                          → mints secret_hmac_key NOW (only at
//                                            first device bind, never at account
//                                            creation), stores it in the DB and
//                                            hands it to the app's KeyStore.
//
// Forgot-password lifecycle: admin clears password_hash (admin route
// POST /admin/students/:uuid/forgot-password) → the app sees has_password=false
// → student sets a new password twice.
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../utils/db';
import { sendError } from '../utils/apiError';
import { config } from '../config';
import { generateHmacKey } from '../utils/crypto';
import { judgeService } from '../services/judge';

const JWT_SECRET = config.jwtSecret || 'dev-secret-change-in-production-min-32-chars-long';
const STUDENT_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || 'charusat.edu.in';

function studentEmail(rollNo: string): string {
  return `${rollNo.toLowerCase()}@${STUDENT_DOMAIN.toLowerCase()}`;
}

/** Resolve the bare id OR `id@domain` to a rolls number. */
function normalizeId(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.includes('@')) return trimmed.split('@')[0];
  return trimmed;
}

function signStudent(student: { student_uuid: string; roll_no: string; email: string; name: string }) {
  const accessToken = jwt.sign(
    { sub: student.student_uuid, roll_no: student.roll_no, email: student.email, name: student.name, role: 'student' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  return accessToken;
}

import { requireStudent } from '../utils/auth';
export { requireStudent };

const router = Router();

const idSchema = z.object({ id: z.string().min(3).max(40) });
const registerSchema = z.object({
  id: z.string().regex(/^[0-9]{2}[A-Z]{3}[0-9]{3}$/, 'ID must look like 24BCS001'),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});
const setPasswordSchema = z.object({
  id: z.string().regex(/^[0-9]{2}[A-Z]{3}[0-9]{3}$/),
  new_password: z.string().min(8).max(128),
});
const loginSchema = z.object({ id: z.string().min(3).max(40), password: z.string().min(1) });
const bindSchema = z.object({ device_id_hash: z.string().length(64) });

// 1. STATUS — does this college ID exist, and does it have a password yet?
router.post('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = idSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid ID' });
    const rollNo = normalizeId(parsed.data.id);
    const r = await query(
      `SELECT roll_no, password_hash IS NOT NULL AS has_password FROM students WHERE roll_no = $1`,
      [rollNo]
    );
    if (r.rows.length === 0) return res.json({ exists: false, has_password: false });
    res.json({ exists: true, has_password: r.rows[0].has_password });
  } catch (err) {
    next(err);
  }
});

// 2. REGISTER — self-registration when the ID is not in the DB yet.
// Email is derived deterministically: {id}@charusat.edu.in
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { id, name, password } = parsed.data;
    const rollNo = normalizeId(id);
    const email = studentEmail(rollNo);

    const exists = await query(`SELECT roll_no FROM students WHERE roll_no = $1`, [rollNo]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'This ID is already registered' });

    const hash = await bcrypt.hash(password, 12);
    const r = await query(
      `INSERT INTO students (roll_no, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING student_uuid, roll_no, email, name`,
      [rollNo, email, name, hash]
    );
    const student = r.rows[0];
    await query(
      `INSERT INTO audit_logs (event_type, actor_uuid, payload) VALUES ('STUDENT_REGISTER', $1, $2)`,
      [student.student_uuid, JSON.stringify({ roll_no: student.roll_no }) ]
    );
    res.status(201).json({ student_uuid: student.student_uuid, roll_no: student.roll_no, email: student.email, name: student.name, access_token: signStudent(student) });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Duplicate roll number or email' });
    next(err);
  }
});

// 3. SET PASSWORD — allowed ONLY when the password is unset (NULL), i.e.
//    first-time setup or after an admin "forgot password" reset.
router.post('/password/set', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = setPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Password must be 8+ characters' });
    const rollNo = normalizeId(parsed.data.id);

    const r = await query(
      `SELECT student_uuid FROM students WHERE roll_no = $1 AND password_hash IS NULL`,
      [rollNo]
    );
    if (r.rows.length === 0) {
      return res.status(409).json({ error: 'Password already set — use login' });
    }

    const hash = await bcrypt.hash(parsed.data.new_password, 12);
    await query(`UPDATE students SET password_hash = $1, updated_at = NOW() WHERE student_uuid = $2`, [hash, r.rows[0].student_uuid]);
    await query(
      `INSERT INTO audit_logs (event_type, actor_uuid, payload) VALUES ('STUDENT_PASSWORD_SET', $1, $2)`,
      [r.rows[0].student_uuid, JSON.stringify({ roll_no: rollNo })]
    );
    res.json({ message: 'Password set — you can now log in' });
  } catch (err) {
    next(err);
  }
});

// 4. LOGIN — validates bcrypt password; returns a student JWT.
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const rollNo = normalizeId(parsed.data.id);

    const r = await query(
      `SELECT student_uuid, roll_no, email, name, password_hash, bound_device_id FROM students WHERE roll_no = $1`,
      [rollNo]
    );
    if (r.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const student = r.rows[0];
    if (!student.password_hash) return res.status(403).json({ error: 'NO_PASSWORD_SET', message: 'Set a password first' });

    if (!(await bcrypt.compare(parsed.data.password, student.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      student_uuid: student.student_uuid,
      roll_no: student.roll_no,
      email: student.email,
      name: student.name,
      is_device_bound: Boolean(student.bound_device_id),
      access_token: signStudent(student),
    });
  } catch (err) {
    next(err);
  }
});

// 5. DEVICE BIND — first authenticated action. Mints the Gate-1 hardware
//    tattoo (bound_device_id) AND the Gate-4 HMAC signer in the same step,
//    then returns the secret to the client's secure storage.
router.post('/device/bind', requireStudent, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = bindSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid device hash' });
    const student = (req as any).student as { sub: string; roll_no: string };
    const { device_id_hash } = parsed.data;

    const r = await query(
      `SELECT student_uuid, bound_device_id, secret_hmac_key FROM students WHERE student_uuid = $1`,
      [student.sub]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const row = r.rows[0];

    if (row.bound_device_id && row.bound_device_id !== device_id_hash) {
      return res.status(409).json({ error: 'This student is bound to a different device — the admin must unlock (device reset)' });
    }

    // First bind: mint the HMAC signer NOW (never at account creation).
    let secret = row.secret_hmac_key;
    if (row.bound_device_id !== device_id_hash) {
      if (!secret) secret = generateHmacKey();
      await query(
        `UPDATE students SET bound_device_id = $1, secret_hmac_key = $2, updated_at = NOW() WHERE student_uuid = $3`,
        [device_id_hash, secret, student.sub]
      );
      judgeService.invalidateStudent(student.sub);
      await query(
        `INSERT INTO audit_logs (event_type, actor_uuid, payload) VALUES ('DEVICE_BIND', $1, $2)`,
        [student.sub, JSON.stringify({ roll_no: student.roll_no, device_bound: true })]
      );
    }

    res.json({ bound: true, student_uuid: row.student_uuid, roll_no: row.roll_no, secret_hmac_key: secret });
  } catch (err) {
    next(err);
  }
});

// 6. ATTENDANCE HISTORY + ANALYTICS (student JWT) — powers the History tab.
router.get('/attendance', requireStudent, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = (req as any).student as { sub: string; roll_no: string };

    const prof = await query(
      `SELECT s.name, s.roll_no, s.email, s.bound_device_id, s.secret_hmac_key, s.created_at,
              d.name AS division_name
       FROM students s
       LEFT JOIN divisions d ON d.division_id = s.division_id
       WHERE s.student_uuid = $1`,
      [student.sub]
    );
    if (prof.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const profile = prof.rows[0];

    const rec = await query(
      `SELECT a.session_uuid, a.verification_delta_ms, a.status,
              a.client_claimed_time, a.server_logged_time,
              s.course_code, s.session_date, c.title AS course_title
       FROM attendance_ledger a
       JOIN course_sessions s ON s.session_uuid = a.session_uuid
       JOIN courses c ON c.course_code = s.course_code
       WHERE a.student_uuid = $1
       ORDER BY a.server_logged_time DESC
       LIMIT 200`,
      [student.sub]
    );
    const records = rec.rows;

    // Denominator: every session (≤ today) for courses of the student's division.
    const held = await query(
      `SELECT COUNT(*)::int AS held
       FROM course_sessions s
       JOIN courses c ON c.course_code = s.course_code
       WHERE c.division_id = (SELECT division_id FROM students WHERE student_uuid = $1)
         AND s.session_date <= CURRENT_DATE`,
      [student.sub]
    );
    const present = records.length;
    const heldCount = held.rows[0]?.held ?? 0;
    const percent = heldCount > 0 ? Math.round((present / heldCount) * 1000) / 10 : 0;

    const perCourse = await query(
      `SELECT s.course_code, MAX(c.title) AS title, COUNT(a.*)::int AS present,
              (SELECT COUNT(*) FROM course_sessions ss
                 JOIN courses cc ON cc.course_code = ss.course_code
                WHERE cc.course_code = s.course_code
                  AND cc.division_id = (SELECT division_id FROM students WHERE student_uuid = $1)
                  AND ss.session_date <= CURRENT_DATE)::int AS held
       FROM attendance_ledger a
       JOIN course_sessions s ON s.session_uuid = a.session_uuid
       JOIN courses c ON c.course_code = s.course_code
       WHERE a.student_uuid = $1
       GROUP BY s.course_code
       ORDER BY s.course_code`,
      [student.sub]
    );

    res.json({
      profile: {
        name: profile.name,
        roll_no: profile.roll_no,
        email: profile.email,
        bound_device_id: profile.bound_device_id,
        has_hmac_key: Boolean(profile.secret_hmac_key),
        division_name: profile.division_name,
        joined_at: profile.created_at,
      },
      summary: { present, total_held: heldCount, percent, total_missed: Math.max(heldCount - present, 0) },
      per_course: perCourse.rows,
      records,
    });
  } catch (err) {
    next(err);
  }
});

export default router;