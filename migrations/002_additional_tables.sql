-- ============================================================
-- Zero-Trust Cryptographic Attendance Gateway — additional tables
-- Migration 002: Adds device_fingerprints, biometric_templates, crypto_challenges, audit_logs
-- Run AFTER 001_schema.sql
-- ============================================================

-- TABLE 6: Device fingerprints (Gate 1 hardware binding history)
CREATE TABLE device_fingerprints (
  fingerprint_uuid  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_uuid      UUID REFERENCES students(student_uuid) ON DELETE CASCADE,
  device_id_hash    VARCHAR(64) NOT NULL,          -- SHA-256 of hardware UUID
  platform          VARCHAR(20) NOT NULL,          -- 'android' / 'ios'
  app_version       VARCHAR(20),
  os_version        VARCHAR(20),
  first_seen        TIMESTAMPTZ DEFAULT NOW(),
  last_seen         TIMESTAMPTZ DEFAULT NOW(),
  is_current        BOOLEAN DEFAULT TRUE,
  UNIQUE(student_uuid, device_id_hash)
);

-- TABLE 7: Biometric templates (Gate 2 — stored as encrypted blobs, never plaintext)
CREATE TABLE biometric_templates (
  template_uuid     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_uuid      UUID REFERENCES students(student_uuid) ON DELETE CASCADE,
  encrypted_blob    BYTEA NOT NULL,                -- AES-256-GCM encrypted
  nonce             BYTEA NOT NULL,                -- 12-byte nonce for GCM
  alg               VARCHAR(20) NOT NULL DEFAULT 'AES-256-GCM',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  is_active         BOOLEAN DEFAULT TRUE
);

-- TABLE 8: Crypto challenges (Gate 4 — server-issued nonces for timestamp protocol)
CREATE TABLE crypto_challenges (
  challenge_uuid    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uuid      UUID REFERENCES course_sessions(session_uuid) ON DELETE CASCADE,
  challenge_nonce   VARCHAR(32) NOT NULL,          -- 16-byte hex
  issued_at_epoch   BIGINT NOT NULL,               -- server epoch ms
  expires_at_epoch  BIGINT NOT NULL,               -- +5s typical
  used              BOOLEAN DEFAULT FALSE,
  used_at_epoch     BIGINT,
  UNIQUE(session_uuid, challenge_nonce)
);

-- TABLE 9: Audit log (append-only, for forensics & dispute resolution)
CREATE TABLE audit_logs (
  log_uuid          BIGSERIAL PRIMARY KEY,
  event_type        VARCHAR(30) NOT NULL,          -- 'CLAIM_ATTEMPT', 'DEVICE_RESET', 'SESSION_START', etc.
  actor_uuid        UUID,                          -- student_uuid or prof_uuid
  session_uuid      UUID REFERENCES course_sessions(session_uuid),
  payload           JSONB NOT NULL,                -- full request/response
  source_ip         INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Partition audit_logs by month for retention (optional, Phase 4+)
-- CREATE TABLE audit_logs_2026_08 PARTITION OF audit_logs FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- CRITICAL PERFORMANCE INDICES (to survive ~70 concurrent POSTs)
CREATE INDEX idx_device_fingerprints_student ON device_fingerprints (student_uuid, is_current);
CREATE INDEX idx_biometric_student ON biometric_templates (student_uuid, is_active);
CREATE INDEX idx_crypto_challenges_session ON crypto_challenges (session_uuid, used, expires_at_epoch);
CREATE INDEX idx_audit_logs_session_time ON audit_logs (session_uuid, created_at DESC);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs (actor_uuid, created_at DESC);

-- Grant permissions to anon role (tighten in Phase 3)
GRANT SELECT, INSERT, UPDATE ON
  device_fingerprints, biometric_templates, crypto_challenges, audit_logs
  TO anon;