-- ============================================================
-- Zero-Trust Cryptographic Attendance Gateway — schema
-- Source: SRS (docs/) §2 "Complete Relational Database Schema"
-- Applied automatically on first DB boot via docker-entrypoint-initdb.d
-- ============================================================

-- Custom domain for standardized roll numbers (e.g. 24BCP182)
CREATE DOMAIN RollNumber AS VARCHAR(15)
  CHECK (VALUE ~ '^[0-9]{2}[A-Z]{3}[0-9]{3}$');

-- TABLE 1: Students (the ledger of who owns which hardware + signing key)
CREATE TABLE students (
  student_uuid     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no          RollNumber UNIQUE NOT NULL,
  email            VARCHAR(120) UNIQUE NOT NULL,
  bound_device_id  VARCHAR(255),            -- Gate 1: the hardware "tattoo"
  secret_hmac_key  VARCHAR(64) NOT NULL,    -- Gate 4: cryptographic signer
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 2: Professors (who can start sessions & reset devices)
CREATE TABLE professors (
  prof_uuid    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(120) UNIQUE NOT NULL,
  name         VARCHAR(100) NOT NULL,
  department   VARCHAR(50) NOT NULL
);

-- TABLE 3: Course sessions (the metronome's "active class")
CREATE TABLE course_sessions (
  session_uuid   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code    VARCHAR(20) NOT NULL,
  prof_uuid      UUID REFERENCES professors(prof_uuid) ON DELETE CASCADE,
  session_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 4: Ephemeral tokens (the Metronome cache — 3s rotating)
CREATE TABLE active_tokens (
  token_uuid        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uuid      UUID REFERENCES course_sessions(session_uuid) ON DELETE CASCADE,
  token_val         VARCHAR(8) NOT NULL,
  created_at_epoch  BIGINT NOT NULL,
  expires_at_epoch  BIGINT NOT NULL
);

-- TABLE 5: The master attendance ledger
CREATE TABLE attendance_ledger (
  ledger_uuid          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uuid         UUID REFERENCES course_sessions(session_uuid) ON DELETE CASCADE,
  student_uuid         UUID REFERENCES students(student_uuid) ON DELETE CASCADE,
  client_claimed_time  BIGINT NOT NULL,                     -- TrueObservedTime (ms)
  server_logged_time   TIMESTAMPTZ DEFAULT NOW(),
  verification_delta_ms INT NOT NULL,                       -- ObservedTime − TokenBirth
  status               VARCHAR(15) DEFAULT 'PRESENT',
  CONSTRAINT unique_attendance_claim UNIQUE(session_uuid, student_uuid)
);

-- CRITICAL PERFORMANCE INDICES (to survive ~70 concurrent POSTs)
CREATE INDEX idx_tokens_fast_lookup ON active_tokens (token_val, created_at_epoch);
CREATE INDEX idx_student_auth ON students (roll_no, bound_device_id);

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
CREATE INDEX idx_tokens_fast_lookup ON active_tokens (token_val, created_at_epoch);
CREATE INDEX idx_student_auth ON students (roll_no, bound_device_id);
CREATE INDEX idx_device_fingerprints_student ON device_fingerprints (student_uuid, is_current);
CREATE INDEX idx_biometric_student ON biometric_templates (student_uuid, is_active);
CREATE INDEX idx_crypto_challenges_session ON crypto_challenges (session_uuid, used, expires_at_epoch);
CREATE INDEX idx_audit_logs_session_time ON audit_logs (session_uuid, created_at DESC);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs (actor_uuid, created_at DESC);

-- Basic anon role needs SELECT/INSERT on the tables the app uses via PostgREST.
-- Tighten this down in Phase 3 once the backend role model is pinned.
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE ON
  students, course_sessions, active_tokens, attendance_ledger, professors,
  device_fingerprints, biometric_templates, crypto_challenges, audit_logs
  TO anon;
