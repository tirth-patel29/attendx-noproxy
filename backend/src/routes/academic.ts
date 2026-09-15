import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../utils/db';
import { academicResolver } from '../services/academic_resolver';

export const academicReadRouter = Router();
export const academicWriteRouter = Router();

// ===========================================================================
// ERROR HANDLER HELPERS
// ===========================================================================
function handlePgError(err: any, res: Response, next: NextFunction, entityName: string) {
  if (err?.code === '23505') {
    // Unique violation
    return res.status(409).json({ error: `A ${entityName} with that name or code already exists.` });
  }
  if (err?.code === '23503') {
    // Foreign key violation
    return res.status(409).json({ error: `Cannot delete ${entityName} because it has associated records.` });
  }
  next(err);
}

// ===========================================================================
// HIERARCHY RESOLUTION
// ===========================================================================
academicReadRouter.get('/resolve/:roll_no', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identity = await academicResolver.resolveStudentIdentity(req.params.roll_no);
    res.json(identity);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ===========================================================================
// COLLEGES
// ===========================================================================
academicReadRouter.get('/colleges', async (_req, res, next) => {
  try {
    const r = await query('SELECT * FROM colleges ORDER BY name');
    res.json(r.rows);
  } catch (err) { next(err); }
});

const collegeSchema = z.object({ name: z.string().min(1).max(100), code: z.string().min(1).max(10) });

academicWriteRouter.post('/colleges', async (req, res, next) => {
  try {
    const parsed = collegeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { name, code } = parsed.data;
    const r = await query(`INSERT INTO colleges (name, code) VALUES ($1, $2) RETURNING *`, [name, code]);
    res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A college with this name or code already exists.' });
    next(err);
  }
});

academicWriteRouter.put('/colleges/:id', async (req, res, next) => {
  try {
    const parsed = collegeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { name, code } = parsed.data;
    const r = await query(`UPDATE colleges SET name=$1, code=$2, updated_at=NOW() WHERE id=$3 RETURNING *`, [name, code, req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A college with this name or code already exists.' });
    next(err);
  }
});

academicWriteRouter.delete('/colleges/:id', async (req, res, next) => {
  try {
    const r = await query(`DELETE FROM colleges WHERE id=$1 RETURNING id`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(409).json({ error: 'Cannot delete college because it has associated departments.' });
    next(err);
  }
});

// ===========================================================================
// DEPARTMENTS
// ===========================================================================
academicReadRouter.get('/departments', async (req, res, next) => {
  try {
    const { college_id } = req.query;
    let sql = `
      SELECT d.*, c.name as college_name 
      FROM departments d 
      JOIN colleges c ON d.college_id = c.id
    `;
    const params: any[] = [];
    if (college_id) {
      sql += ` WHERE d.college_id = $1`;
      params.push(college_id);
    }
    sql += ` ORDER BY c.name, d.name`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { next(err); }
});

const deptSchema = z.object({ college_id: z.string().uuid(), name: z.string().min(1), code: z.string().min(1) });

academicWriteRouter.post('/departments', async (req, res, next) => {
  try {
    const parsed = deptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { college_id, name, code } = parsed.data;
    const r = await query(`INSERT INTO departments (college_id, name, code) VALUES ($1, $2, $3) RETURNING *`, [college_id, name, code]);
    res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A department with this name or code already exists in this college.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced college does not exist.' });
    next(err);
  }
});

academicWriteRouter.put('/departments/:id', async (req, res, next) => {
  try {
    const parsed = deptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { college_id, name, code } = parsed.data;
    const r = await query(`UPDATE departments SET college_id=$1, name=$2, code=$3, updated_at=NOW() WHERE id=$4 RETURNING *`, [college_id, name, code, req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A department with this name or code already exists in this college.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced college does not exist.' });
    next(err);
  }
});

academicWriteRouter.delete('/departments/:id', async (req, res, next) => {
  try {
    const r = await query(`DELETE FROM departments WHERE id=$1 RETURNING id`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(409).json({ error: 'Cannot delete department because it has associated branches.' });
    next(err);
  }
});

// ===========================================================================
// BRANCHES
// ===========================================================================
academicReadRouter.get('/branches', async (req, res, next) => {
  try {
    const { department_id } = req.query;
    let sql = `
      SELECT b.*, d.name as department_name, c.name as college_name 
      FROM branches b 
      JOIN departments d ON b.department_id = d.id 
      JOIN colleges c ON d.college_id = c.id
    `;
    const params: any[] = [];
    if (department_id) {
      sql += ` WHERE b.department_id = $1`;
      params.push(department_id);
    }
    sql += ` ORDER BY c.name, d.name, b.name`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { next(err); }
});

const branchSchema = z.object({ department_id: z.string().uuid(), name: z.string().min(1), code: z.string().min(1) });

academicWriteRouter.post('/branches', async (req, res, next) => {
  try {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { department_id, name, code } = parsed.data;
    const r = await query(`INSERT INTO branches (department_id, name, code) VALUES ($1, $2, $3) RETURNING *`, [department_id, name, code]);
    res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A branch with this name or code already exists in this department.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced department does not exist.' });
    next(err);
  }
});

academicWriteRouter.put('/branches/:id', async (req, res, next) => {
  try {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { department_id, name, code } = parsed.data;
    const r = await query(`UPDATE branches SET department_id=$1, name=$2, code=$3, updated_at=NOW() WHERE id=$4 RETURNING *`, [department_id, name, code, req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A branch with this name or code already exists in this department.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced department does not exist.' });
    next(err);
  }
});

academicWriteRouter.delete('/branches/:id', async (req, res, next) => {
  try {
    const r = await query(`DELETE FROM branches WHERE id=$1 RETURNING id`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(409).json({ error: 'Cannot delete branch because it has associated divisions.' });
    next(err);
  }
});

// ===========================================================================
// SEMESTERS
// ===========================================================================
academicReadRouter.get('/semesters', async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    let sql = `
      SELECT s.*, b.name as branch_name, d.name as department_name, c.name as college_name 
      FROM semesters s 
      JOIN branches b ON s.branch_id = b.id 
      JOIN departments d ON b.department_id = d.id 
      JOIN colleges c ON d.college_id = c.id
    `;
    const params: any[] = [];
    if (branch_id) {
      sql += ` WHERE s.branch_id = $1`;
      params.push(branch_id);
    }
    sql += ` ORDER BY c.name, d.name, b.name, s.level`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { next(err); }
});

const semesterSchema = z.object({
  branch_id: z.string().uuid(),
  name: z.string().min(1).max(50),
  level: z.number().int()
});

academicWriteRouter.post('/semesters', async (req, res, next) => {
  try {
    const parsed = semesterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { branch_id, name, level } = parsed.data;
    const r = await query(
      `INSERT INTO semesters (branch_id, name, level) VALUES ($1, $2, $3) RETURNING *`, 
      [branch_id, name, level]
    );
    res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A semester with this level already exists in this branch.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced branch does not exist.' });
    next(err);
  }
});

academicWriteRouter.put('/semesters/:id', async (req, res, next) => {
  try {
    const parsed = semesterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { branch_id, name, level } = parsed.data;
    const r = await query(
      `UPDATE semesters SET branch_id=$1, name=$2, level=$3, updated_at=NOW() WHERE id=$4 RETURNING *`, 
      [branch_id, name, level, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A semester with this level already exists in this branch.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced branch does not exist.' });
    next(err);
  }
});

academicWriteRouter.delete('/semesters/:id', async (req, res, next) => {
  try {
    const r = await query(`DELETE FROM semesters WHERE id=$1 RETURNING id`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(409).json({ error: 'Cannot delete semester because it has associated divisions.' });
    next(err);
  }
});

// ===========================================================================
// DIVISIONS
// ===========================================================================
academicReadRouter.get('/divisions', async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    let sql = `
      SELECT div.*, s.name as semester_name, s.level as semester_level, b.name as branch_name, d.name as department_name, c.name as college_name 
      FROM divisions div 
      LEFT JOIN semesters s ON div.semester_id = s.id
      LEFT JOIN branches b ON div.branch_id = b.id OR s.branch_id = b.id
      LEFT JOIN departments d ON b.department_id = d.id 
      LEFT JOIN colleges c ON d.college_id = c.id
    `;
    const params: any[] = [];
    if (branch_id) {
      sql += ` WHERE div.branch_id = $1 OR s.branch_id = $1`;
      params.push(branch_id);
    }
    sql += ` ORDER BY c.name, d.name, b.name, s.level, div.academic_year DESC, div.name`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { next(err); }
});

const divisionSchema = z.object({ 
  branch_id: z.string().uuid().optional().nullable(),
  semester_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  academic_year: z.number().int().optional().nullable()
});

academicWriteRouter.post('/divisions', async (req, res, next) => {
  try {
    const parsed = divisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { branch_id, semester_id, name, code, academic_year } = parsed.data;
    const r = await query(
      `INSERT INTO divisions (branch_id, semester_id, name, code, academic_year) VALUES ($1, $2, $3, $4, $5) RETURNING *`, 
      [branch_id ?? null, semester_id ?? null, name, code ?? null, academic_year ?? null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A division with this name or code already exists in this branch.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced branch does not exist.' });
    next(err);
  }
});

academicWriteRouter.put('/divisions/:id', async (req, res, next) => {
  try {
    const parsed = divisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { branch_id, semester_id, name, code, academic_year } = parsed.data;
    const r = await query(
      `UPDATE divisions SET branch_id=$1, semester_id=$2, name=$3, code=$4, academic_year=$5, updated_at=NOW() WHERE division_id=$6 RETURNING *`, 
      [branch_id ?? null, semester_id ?? null, name, code ?? null, academic_year ?? null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A division with this name or code already exists in this branch.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced branch does not exist.' });
    next(err);
  }
});

academicWriteRouter.delete('/divisions/:id', async (req, res, next) => {
  try {
    const r = await query(`DELETE FROM divisions WHERE division_id=$1 RETURNING division_id`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(409).json({ error: 'Cannot delete division because it has associated batches, courses, or students.' });
    next(err);
  }
});

// ===========================================================================
// BATCHES
// ===========================================================================
academicReadRouter.get('/batches', async (req, res, next) => {
  try {
    const { division_id } = req.query;
    let sql = `
      SELECT b.*, div.name as division_name, br.name as branch_name 
      FROM batches b 
      LEFT JOIN divisions div ON b.division_id = div.division_id 
      LEFT JOIN branches br ON div.branch_id = br.id
    `;
    const params: any[] = [];
    if (division_id) {
      sql += ` WHERE b.division_id = $1`;
      params.push(division_id);
    }
    sql += ` ORDER BY br.name, div.name, b.name`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { next(err); }
});

const batchSchema = z.object({ 
  division_id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  start_roll: z.string().optional().nullable(),
  end_roll: z.string().optional().nullable()
});

academicWriteRouter.post('/batches', async (req, res, next) => {
  try {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { division_id, name, code, start_roll, end_roll } = parsed.data;
    const r = await query(
      `INSERT INTO batches (division_id, name, code, start_roll, end_roll) VALUES ($1, $2, $3, $4, $5) RETURNING *`, 
      [division_id, name, code ?? null, start_roll ?? null, end_roll ?? null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A batch with this name or code already exists in this division.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced division does not exist.' });
    next(err);
  }
});

academicWriteRouter.put('/batches/:id', async (req, res, next) => {
  try {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { division_id, name, code, start_roll, end_roll } = parsed.data;
    const r = await query(
      `UPDATE batches SET division_id=$1, name=$2, code=$3, start_roll=$4, end_roll=$5, updated_at=NOW() WHERE id=$6 RETURNING *`, 
      [division_id, name, code ?? null, start_roll ?? null, end_roll ?? null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A batch with this name or code already exists in this division.' });
    if (err?.code === '23503') return res.status(409).json({ error: 'Referenced division does not exist.' });
    next(err);
  }
});

academicWriteRouter.delete('/batches/:id', async (req, res, next) => {
  try {
    const r = await query(`DELETE FROM batches WHERE id=$1 RETURNING id`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    if (err?.code === '23503') return res.status(409).json({ error: 'Cannot delete batch because it has associated students.' });
    next(err);
  }
});

export const academicRouter = Router();
academicRouter.use(academicReadRouter);
academicRouter.use(academicWriteRouter);

export default academicRouter;
