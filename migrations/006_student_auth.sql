-- ============================================================
-- 006_student_auth.sql
-- Student self-registration & device-bound auth (SRS §1 Phase 1)
-- ------------------------------------------------------------
-- - students.password_hash: bcrypt hash for app login
--   (NULL = password not set yet -> app shows "set password")
-- - students.secret_hmac_key: now generated at DEVICE-BIND time,
--   not at account creation (we cannot mint the device HMAC until
--   the student registers from their actual phone).
-- ============================================================

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128);

ALTER TABLE students
    ALTER COLUMN secret_hmac_key DROP NOT NULL;