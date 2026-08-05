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

-- Basic anon role needs SELECT/INSERT on the tables the app uses via PostgREST.
-- Tighten this down in Phase 3 once the backend role model is pinned.
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE ON
  students, course_sessions, active_tokens, attendance_ledger, professors
  TO anon;
