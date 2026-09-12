import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../utils/db';
import { generateHmacKey } from '../../utils/crypto';
import { academicResolver } from '../../services/academic_resolver';
import { auditService } from '../../services/audit';
import { judgeService } from '../../services/judge';

export const adminStudentsRouter = Router();

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

// GET /students
adminStudentsRouter.get('/students', async (_req: Request, res: Response, next: NextFunction) => {
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
    res.json(
      r.rows.map((row) => ({
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
        secret_hmac_key: row.secret_hmac_key ? `${row.secret_hmac_key.slice(0, 8)}…${row.secret_hmac_key.slice(-4)}` : null,
        is_bound: Boolean(row.bound_device_id),
        created_at: row.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /students/:uuid
adminStudentsRouter.get('/students/:uuid', async (req: Request, res: Response, next: NextFunction) => {
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
       WHERE s.student_uuid = $1`,
      [req.params.uuid]
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

// POST /students
adminStudentsRouter.post('/students', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = studentCreate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    let { roll_no, email, name, division_id, batch_id } = parsed.data;

    if (!batch_id || !division_id) {
      try {
        const resolved = await academicResolver.resolveStudentIdentity(roll_no);
        batch_id = batch_id || resolved.batch_id || null;
        division_id = division_id || resolved.division_id || null;
      } catch (err) {
        console.warn('Could not auto-resolve student identity:', err);
      }
    }

    const secret = generateHmacKey();
    const r = await query(
      `INSERT INTO students (roll_no, email, name, division_id, batch_id, secret_hmac_key)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING student_uuid`,
      [roll_no, email, name, division_id ?? null, batch_id ?? null, secret]
    );
    await auditService.log('STUDENT_CREATE', (req as any).admin?.sub, { student_uuid: r.rows[0].student_uuid, roll_no });
    res.status(201).json({
      id: r.rows[0].student_uuid,
      roll_no,
      email,
      name,
      division_id: division_id ?? null,
      batch_id: batch_id ?? null,
      secret_hmac_key: secret,
    });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Duplicate roll number or email' });
    next(err);
  }
});

// PUT /students/:uuid
adminStudentsRouter.put('/students/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = studentUpdate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    let { roll_no, email, name, division_id, batch_id } = parsed.data;

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
    await auditService.log('STUDENT_UPDATE', (req as any).admin?.sub, { student_uuid: req.params.uuid, roll_no });
    res.json({ message: 'Student updated' });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Duplicate roll number or email' });
    next(err);
  }
});

// DELETE /students/:uuid
adminStudentsRouter.delete('/students/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`DELETE FROM students WHERE student_uuid=$1 RETURNING student_uuid`, [req.params.uuid]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    await auditService.log('STUDENT_DELETE', (req as any).admin?.sub, { student_uuid: req.params.uuid });
    res.json({ message: 'Student deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /students/:uuid/reset-device
adminStudentsRouter.post('/students/:uuid/reset-device', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newSecret = generateHmacKey();
    const r = await query(
      `UPDATE students SET bound_device_id = NULL, secret_hmac_key = $1, updated_at = NOW()
       WHERE student_uuid = $2 RETURNING student_uuid, roll_no, secret_hmac_key`,
      [newSecret, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    judgeService.invalidateStudent(req.params.uuid);
    const row = r.rows[0];
    await auditService.log('DEVICE_RESET', (req as any).admin?.sub, {
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

// POST /students/:uuid/rotate-hmac
adminStudentsRouter.post('/students/:uuid/rotate-hmac', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newSecret = generateHmacKey();
    const r = await query(
      `UPDATE students SET secret_hmac_key = $1, updated_at = NOW()
       WHERE student_uuid = $2 RETURNING student_uuid, roll_no, secret_hmac_key`,
      [newSecret, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    judgeService.invalidateStudent(req.params.uuid);
    const row = r.rows[0];
    await auditService.log('HMAC_ROTATE', (req as any).admin?.sub, { student_uuid: req.params.uuid, roll_no: row.roll_no });
    res.json({ message: 'HMAC key rotated', roll_no: row.roll_no, secret_hmac_key: newSecret });
  } catch (err) {
    next(err);
  }
});

// POST /students/:uuid/forgot-password
adminStudentsRouter.post('/students/:uuid/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `UPDATE students SET password_hash = NULL, updated_at = NOW() WHERE student_uuid = $1 RETURNING roll_no`,
      [req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    await auditService.log('STUDENT_FORGOT_PASSWORD', (req as any).admin?.sub, {
      student_uuid: req.params.uuid,
      roll_no: r.rows[0].roll_no,
    });
    res.json({ message: 'Password cleared — the student can now set a new one in the app' });
  } catch (err) {
    next(err);
  }
});
