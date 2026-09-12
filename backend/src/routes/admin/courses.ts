import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../utils/db';
import { auditService } from '../../services/audit';

export const adminCoursesRouter = Router();

const courseCreate = z.object({
  course_code: z.string().min(1).max(20),
  title: z.string().min(1).max(100),
  division_id: z.string().uuid().optional().nullable(),
});

// GET /courses
adminCoursesRouter.get('/courses', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`
      SELECT c.course_code, c.title, c.division_id, d.name AS division_name,
             (SELECT COUNT(*) FROM teacher_assignments a WHERE a.course_code = c.course_code)::int AS assignment_count
      FROM courses c LEFT JOIN divisions d ON d.division_id = c.division_id
      ORDER BY c.course_code
    `);
    res.json(
      r.rows.map((row) => ({
        id: row.course_code,
        course_code: row.course_code,
        title: row.title,
        division_id: row.division_id,
        division_name: row.division_name,
        assignment_count: row.assignment_count,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /courses
adminCoursesRouter.post('/courses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = courseCreate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    const { course_code, title, division_id } = parsed.data;
    const r = await query(
      `INSERT INTO courses (course_code, title, division_id) VALUES ($1, $2, $3) RETURNING course_code`,
      [course_code, title, division_id ?? null]
    );
    await auditService.log('COURSE_CREATE', (req as any).admin?.sub, { course_code: r.rows[0].course_code });
    res.status(201).json({ id: course_code, course_code, title, division_id: division_id ?? null });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Course code already exists' });
    next(err);
  }
});

// PUT /courses/:code
adminCoursesRouter.put('/courses/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = courseCreate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const { course_code, title, division_id } = parsed.data;
    const r = await query(
      `UPDATE courses SET course_code=$1, title=$2, division_id=$3 WHERE course_code=$4 RETURNING course_code`,
      [course_code, title, division_id ?? null, req.params.code]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    await auditService.log('COURSE_UPDATE', (req as any).admin?.sub, { course_code: r.rows[0].course_code });
    res.json({ id: course_code, course_code, title, division_id: division_id ?? null });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Course code already exists' });
    next(err);
  }
});

// DELETE /courses/:code
adminCoursesRouter.delete('/courses/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(`DELETE FROM courses WHERE course_code=$1 RETURNING course_code`, [req.params.code]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    await auditService.log('COURSE_DELETE', (req as any).admin?.sub, { course_code: req.params.code });
    res.json({ message: 'Course deleted' });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(409).json({ error: 'Course has active assignments' });
    next(err);
  }
});
