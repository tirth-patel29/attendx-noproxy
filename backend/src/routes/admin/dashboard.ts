import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../utils/db';

export const adminDashboardRouter = Router();

// GET /stats
adminDashboardRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
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

// GET /dashboard/attendance-trend
adminDashboardRouter.get('/dashboard/attendance-trend', async (_req: Request, res: Response, next: NextFunction) => {
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

// GET /dashboard/verification-split
adminDashboardRouter.get('/dashboard/verification-split', async (_req: Request, res: Response, next: NextFunction) => {
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

// GET /dashboard/recent-activity
adminDashboardRouter.get('/dashboard/recent-activity', async (_req: Request, res: Response, next: NextFunction) => {
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

// GET /dashboard/department-stats
adminDashboardRouter.get('/dashboard/department-stats', async (_req: Request, res: Response, next: NextFunction) => {
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

// GET /dashboard/session-activity
adminDashboardRouter.get('/dashboard/session-activity', async (_req: Request, res: Response, next: NextFunction) => {
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

// GET /dashboard/active-sessions
adminDashboardRouter.get('/dashboard/active-sessions', async (_req: Request, res: Response, next: NextFunction) => {
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
