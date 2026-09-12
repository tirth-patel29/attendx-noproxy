import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../utils/db';
import { auditService } from '../../services/audit';

export const adminAssignmentsRouter = Router();

const assignmentCreate = z.object({
  prof_uuid: z.string().uuid(),
  course_code: z.string().min(1).max(20),
  division_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

// GET /assignments
adminAssignmentsRouter.get('/assignments', async (_req: Request, res: Response, next: NextFunction) => {
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
      ORDER BY a.day_of_week, a.start_time
    `);
    res.json(
      r.rows.map((row) => ({
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
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /assignments
adminAssignmentsRouter.post('/assignments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = assignmentCreate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    }
    const { prof_uuid, course_code, division_id, day_of_week, start_time, end_time } = parsed.data;
    const r = await query(
      `INSERT INTO teacher_assignments (prof_uuid, course_code, division_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING assignment_id`,
      [prof_uuid, course_code, division_id, day_of_week, start_time, end_time]
    );
    await auditService.log('ASSIGNMENT_CREATE', (req as any).admin?.sub, { assignment_id: r.rows[0].assignment_id });
    res.status(201).json({ id: r.rows[0].assignment_id });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Referenced teacher/course/division not found' });
    next(err);
  }
});

// PUT /assignments/:id
adminAssignmentsRouter.put('/assignments/:id', async (req: Request, res: Response, next: NextFunction) => {
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
    await auditService.log('ASSIGNMENT_UPDATE', (req as any).admin?.sub, { assignment_id: r.rows[0].assignment_id });
    res.json({ message: 'Assignment updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /assignments/:id
adminAssignmentsRouter.delete('/assignments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `DELETE FROM teacher_assignments WHERE assignment_id=$1 RETURNING assignment_id`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    await auditService.log('ASSIGNMENT_DELETE', (req as any).admin?.sub, { assignment_id: req.params.id });
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    next(err);
  }
});
