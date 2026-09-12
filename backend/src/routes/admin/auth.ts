import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../utils/db';
import { JWT_SECRET } from '../../utils/auth';
import { auditService } from '../../services/audit';

export const adminAuthPublicRouter = Router();
export const adminAuthProtectedRouter = Router();

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});

// POST /login
adminAuthPublicRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
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

// POST /login/refresh
adminAuthPublicRouter.post('/login/refresh', async (req: Request, res: Response, next: NextFunction) => {
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
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ access_token: accessToken });
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Refresh token expired' });
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /change-password
adminAuthProtectedRouter.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
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
    await auditService.log('ADMIN_PASSWORD_CHANGE', admin.sub, { admin_uuid: admin.sub });
    res.json({ message: 'Password changed' });
  } catch (err) {
    next(err);
  }
});
