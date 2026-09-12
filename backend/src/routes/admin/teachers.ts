import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../utils/db';
import { auditService } from '../../services/audit';

export const adminTeachersRouter = Router();

const teacherCreate = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  department: z.string().min(1).max(100).optional(),
  department_id: z.string().uuid().nullable().optional(),
  password: z.string().min(8).max(128),
});

const teacherUpdate = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  department: z.string().min(1).max(100).optional(),
  department_id: z.string().uuid().nullable().optional(),
});

const resetPwSchema = z.object({
  password: z.string().min(8).max(128),
});

// GET /teachers
adminTeachersRouter.get('/teachers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT p.prof_uuid, p.email, p.name, p.department, p.department_id,
             d.name AS department_name, c.name AS college_name,
             p.password_hash IS NOT NULL AS has_login,
             COUNT(a.assignment_id)::int AS assignment_count
      FROM professors p
      LEFT JOIN departments d ON d.id = p.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
      LEFT JOIN teacher_assignments a ON a.prof_uuid = p.prof_uuid
      GROUP BY p.prof_uuid, d.name, c.name
      ORDER BY p.name
    `);
    res.json(
      r.rows.map((row) => ({
        id: row.prof_uuid,
        email: row.email,
        name: row.name,
        department: row.department,
        department_id: row.department_id ?? null,
        department_name: row.department_name ?? null,
        college_name: row.college_name ?? null,
        has_login: row.has_login,
        assignment_count: row.assignment_count,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /teachers
adminTeachersRouter.post('/teachers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = teacherCreate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    const { email, name, department_id, password } = parsed.data;
    let department = parsed.data.department || '';

    // If department_id is provided, resolve name from departments table
    if (department_id) {
      const d = await query(`SELECT name FROM departments WHERE id = $1`, [department_id]);
      if (d.rows.length > 0 && !department) {
        department = d.rows[0].name;
      }
    }
    if (!department) department = 'General';

    const hash = await bcrypt.hash(password, 12);
    const r = await query(
      `INSERT INTO professors (email, name, department, department_id, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING prof_uuid`,
      [email, name, department, department_id || null, hash]
    );
    await auditService.log('TEACHER_CREATE', (req as any).admin?.sub, { prof_uuid: r.rows[0].prof_uuid, email });
    res.status(201).json({ id: r.rows[0].prof_uuid, email, name, department, department_id: department_id || null });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A teacher with that email already exists' });
    next(err);
  }
});

// PUT /teachers/:uuid
adminTeachersRouter.put('/teachers/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = teacherUpdate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    const { email, name, department_id } = parsed.data;
    let department = parsed.data.department || '';

    if (department_id) {
      const d = await query(`SELECT name FROM departments WHERE id = $1`, [department_id]);
      if (d.rows.length > 0 && !department) {
        department = d.rows[0].name;
      }
    }

    const r = await query(
      `UPDATE professors 
       SET email=$1, name=$2, department=COALESCE(NULLIF($3, ''), department), department_id=$4 
       WHERE prof_uuid=$5 RETURNING prof_uuid`,
      [email, name, department, department_id || null, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await auditService.log('TEACHER_UPDATE', (req as any).admin?.sub, { prof_uuid: req.params.uuid, email });
    res.json({ id: req.params.uuid, email, name, department, department_id: department_id || null });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A teacher with that email already exists' });
    next(err);
  }
});

// POST /teachers/:uuid/reset-password
adminTeachersRouter.post('/teachers/:uuid/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resetPwSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Password must be 8+ characters' });
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const r = await query(
      `UPDATE professors SET password_hash=$1 WHERE prof_uuid=$2 RETURNING prof_uuid, email`,
      [hash, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await auditService.log('TEACHER_RESET_PW', (req as any).admin?.sub, { prof_uuid: req.params.uuid, email: r.rows[0].email });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /teachers/:uuid
adminTeachersRouter.delete('/teachers/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`DELETE FROM professors WHERE prof_uuid=$1 RETURNING prof_uuid, email`, [req.params.uuid]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await auditService.log('TEACHER_DELETE', (req as any).admin?.sub, { prof_uuid: req.params.uuid, email: r.rows[0].email });
    res.json({ message: 'Teacher deleted' });
  } catch (err) {
    next(err);
  }
});
