// src/routes/admin.ts
// ============================================================================
// ADMIN CONSOLE — "Top of the Database" (Zero-Trust Attendance Gateway)
// ----------------------------------------------------------------------------
// Assembled from modular sub-routers under ./admin/
//
// Mounted at:
//   /api/v1/admin/login   (public, admin login -> JWT role 'admin')
//   /api/v1/admin/*       (protected by requireAdmin)
// ============================================================================

import { Router } from 'express';
import { requireAdmin } from '../utils/auth';
import { academicRouter } from './academic';
import { adminAuthPublicRouter, adminAuthProtectedRouter } from './admin/auth';
import { adminDashboardRouter } from './admin/dashboard';
import { adminTeachersRouter } from './admin/teachers';
import { adminStudentsRouter } from './admin/students';
import { adminCoursesRouter } from './admin/courses';
import { adminAssignmentsRouter } from './admin/assignments';
import { adminApiKeysRouter } from './admin/apiKeys';

// Public admin router (login & token refresh)
export const adminPublicRouter = Router();
adminPublicRouter.use('/', adminAuthPublicRouter);

// Protected admin router (all mutations & management)
export const adminRouter = Router();

// Academic hierarchy (colleges -> departments -> branches -> divisions -> batches)
adminRouter.use('/academic', academicRouter);

// Modular domain routers
adminRouter.use('/', adminAuthProtectedRouter);
adminRouter.use('/', adminDashboardRouter);
adminRouter.use('/', adminTeachersRouter);
adminRouter.use('/', adminStudentsRouter);
adminRouter.use('/', adminCoursesRouter);
adminRouter.use('/', adminAssignmentsRouter);
adminRouter.use('/', adminApiKeysRouter);

export { requireAdmin };

export default {
  adminPublicRouter,
  adminRouter,
  requireAdmin,
};
