// src/utils/auth.ts
// ============================================================================
// UNIFIED JWT AUTHENTICATION MIDDLEWARE
// ----------------------------------------------------------------------------
// Provides role-based access control across Admin, Professor, and Student roles
// with standardized zero-trust error responses.
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { sendError } from './apiError';

export const JWT_SECRET = config.jwtSecret || 'dev-secret-change-in-production-min-32-chars-long';

export interface DecodedUser {
  sub: string;
  email?: string;
  name?: string;
  role: 'admin' | 'professor' | 'student' | string;
  roll_no?: string;
  [key: string]: unknown;
}

/**
 * Verifies a JWT Bearer token and checks for the allowed role(s).
 */
export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return sendError(res, 401, 'ERR_AUTH_MISSING', 'Missing or invalid JWT/API Key.');
    }

    try {
      const token = auth.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedUser;

      if (!decoded.role || !roles.includes(decoded.role)) {
        const requiredRoleName = roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' or ');
        return sendError(res, 403, 'ERR_FORBIDDEN', `${requiredRoleName} access required.`);
      }

      // Attach decoded user to req.user as well as legacy role-specific fields
      (req as any).user = decoded;
      if (decoded.role === 'admin') (req as any).admin = decoded;
      if (decoded.role === 'professor') (req as any).professor = decoded;
      if (decoded.role === 'student') (req as any).student = decoded;

      next();
    } catch (err) {
      return sendError(res, 401, 'ERR_AUTH_MISSING', 'Invalid or expired token.');
    }
  };
}

export const requireAdmin = requireRole('admin');
export const requireProfessor = requireRole('professor');
export const requireStudent = requireRole('student');
