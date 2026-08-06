// src/services/auth.ts
import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../utils/db';
import { config } from '../config';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const JWT_SECRET = config.jwtSecret || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '8h';
const REFRESH_EXPIRES_IN = '7d';

// Generate tokens
function generateTokens(professor: { prof_uuid: string; email: string; name: string }) {
  const accessToken = jwt.sign(
    { sub: professor.prof_uuid, email: professor.email, name: professor.name, role: 'professor' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  const refreshToken = jwt.sign(
    { sub: professor.prof_uuid, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
  return { accessToken, refreshToken };
}

// Verify access token
export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { sub: string; email: string; name: string; role: string };
}

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors });
    }

    const { email, password } = parseResult.data;

    // For now, use a simple password check - in production use bcrypt
    // Demo passwords: prof123 for both professors
    const result = await query(
      `SELECT prof_uuid, email, name, department FROM professors WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const professor = result.rows[0];

    // Simple password check (in production, use bcrypt.compare)
    if (password !== 'prof123') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(professor);

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: professor.prof_uuid,
        email: professor.email,
        name: professor.name,
        department: professor.department,
        role: 'professor',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refresh_token, JWT_SECRET) as { sub: string; type: string };
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const result = await query(
      `SELECT prof_uuid, email, name, department FROM professors WHERE prof_uuid = $1`,
      [decoded.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Professor not found' });
    }

    const { accessToken, refreshToken } = generateTokens(result.rows[0]);
    res.json({ access_token: accessToken, refresh_token: refreshToken });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    next(err);
  }
});

// GET /api/v1/auth/me - Get current user from token
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const decoded = verifyAccessToken(token);

    const result = await query(
      `SELECT prof_uuid, email, name, department FROM professors WHERE prof_uuid = $1`,
      [decoded.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Professor not found' });
    }

    res.json({
      id: result.rows[0].prof_uuid,
      email: result.rows[0].email,
      name: result.rows[0].name,
      department: result.rows[0].department,
      role: 'professor',
    });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
});

// POST /api/v1/auth/logout (client-side only, but kept for API consistency)
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;