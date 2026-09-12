import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../utils/db';
import { auditService } from '../../services/audit';

export const adminTeachersRouter = Router();

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

const resetPwSchema = z.object({
  password: z.string().min(8).max(128),
});

// GET /teachers
adminTeachersRouter.get('/teachers', async (_req: Request, res: Response, next: NextFunction) => {
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
    res.json(
      r.rows.map((row) => ({
        id: row.prof_uuid,
        email: row.email,
        name: row.name,
        department: row.department,
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
    const { email, name, department, password } = parsed.data;
    const hash = await bcrypt.hash(password, 12);
    const r = await query(
      `INSERT INTO professors (email, name, department, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING prof_uuid`,
      [email, name, department, hash]
    );
    await auditService.log('TEACHER_CREATE', (req as any).admin?.sub, { prof_uuid: r.rows[0].prof_uuid, email });
    res.status(201).json({ id: r.rows[0].prof_uuid, email, name, department });
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
    const { email, name, department } = parsed.data;
    const r = await query(
      `UPDATE professors SET email=$1, name=$2, department=$3 WHERE prof_uuid=$4 RETURNING prof_uuid`,
      [email, name, department, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await auditService.log('TEACHER_UPDATE', (req as any).admin?.sub, { prof_uuid: req.params.uuid, email });
    res.json({ id: req.params.uuid, email, name, department });
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
      `UPDATE professors SET password_hash=$1 WHERE prof_uuid=$2 RETURNING prof_uuid`,
      [hash, req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await auditService.log('TEACHER_PASSWORD_RESET', (req as any).admin?.sub, { prof_uuid: req.params.uuid });
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /teachers/:uuid
adminTeachersRouter.delete('/teachers/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`DELETE FROM professors WHERE prof_uuid=$1 RETURNING prof_uuid`, [req.params.uuid]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    await auditService.log('TEACHER_DELETE', (req as any).admin?.sub, { prof_uuid: req.params.uuid });
    res.json({ message: 'Teacher deleted' });
  } catch (err) {
    next(err);
  }
});
