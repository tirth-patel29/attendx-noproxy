// src/services/bootstrap.ts
// ============================================================================
// ADMIN BOOTSTRAP — reliable, configurable admin initialization.
// ----------------------------------------------------------------------------
// The original design seeded the default admin through a one-off migration with
// a hardcoded password hash — fragile and not configurable. This service makes
// initialization deterministic and environment-driven:
//
//   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='S3cure!Pass' \
//     ADMIN_NAME='System Admin' node dist/index.js
//
// On every boot:
//   - If ADMIN_EMAIL/ADMIN_PASSWORD are set, the admin is upserted: created if
//     missing, or its password ROTATED to the env value if it already exists.
//   - bcryptjs is used to hash — exactly the same library the login route uses,
//     so there is never a hash-format mismatch between seed and runtime.
//   - If the env vars are unset, the seed from migrations/005_admin_seed.sql
//     remains as a documented fallback (and the admin can set a new password
//     via POST /api/v1/admin/change-password).
// ============================================================================

import bcrypt from 'bcryptjs';
import { query } from '../utils/db';
import { config } from '../config';

export async function ensureDefaultAdmin(): Promise<void> {
  const { email, password, name } = config.admin;
  if (!email || !password) {
    console.log('[bootstrap] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin upsert '
      + '(using migration seed, if any)');
    return;
  }

  const hash = await bcrypt.hash(password, 12);

  const existing = await query(
    `SELECT admin_uuid FROM admin_users WHERE email = $1`,
    [email]
  );

  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO admin_users (email, password_hash, name) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [email, hash, name]
    );
    console.log(`[bootstrap] Admin created: ${email}`);
  } else {
    // Rotate to the configured password (ensures deployments can always
    // recover/rotate the admin credential via env).
    await query(
      `UPDATE admin_users SET password_hash = $1, name = $2 WHERE email = $3`,
      [hash, name, email]
    );
    console.log(`[bootstrap] Admin password rotated by env: ${email}`);
  }
}