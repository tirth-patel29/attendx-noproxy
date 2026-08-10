-- ============================================================
-- 005_admin_seed.sql
-- Bootstrap the first Admin Console account.
-- Default credential (CHANGE AFTER FIRST LOGIN):
--   email:    admin@atmyhome.tech
--   password: Admin@123
-- Idempotent: will not overwrite an existing account.
-- ============================================================

INSERT INTO admin_users (email, password_hash, name)
VALUES (
  'admin@atmyhome.tech',
  '$2b$12$e.65d.bYAlzP0ia5NUVyw.VXVZLB0iciOJ98NgLzBeH7OJscyZLY.',
  'System Admin'
)
ON CONFLICT (email) DO NOTHING;
