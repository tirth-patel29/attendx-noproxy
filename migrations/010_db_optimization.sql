-- ============================================================
-- 010_db_optimization.sql
-- Performance indexes, FK fixes, constraint corrections, and
-- cleanup functions for the Zero-Trust Attendance Gateway.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ===========================================================================
-- 1. CRITICAL MISSING INDEXES — attendance_ledger
--    This table had ZERO indexes beyond PK + UNIQUE constraint.
--    Every dashboard aggregation was doing a full sequential scan.
-- ===========================================================================

-- Used by: dashboard attendance-trend, verification-split, session attendance counts
CREATE INDEX IF NOT EXISTS idx_ledger_session_status
    ON attendance_ledger (session_uuid, status);

-- Used by: verification-split (WHERE server_logged_time >= NOW() - INTERVAL '1 day')
CREATE INDEX IF NOT EXISTS idx_ledger_logged_time
    ON attendance_ledger (server_logged_time DESC);

-- Used by: student attendance history lookups
CREATE INDEX IF NOT EXISTS idx_ledger_student
    ON attendance_ledger (student_uuid);

-- ===========================================================================
-- 2. CRITICAL MISSING INDEXES — course_sessions
--    Every teacher dashboard query filters on prof_uuid, session_date,
--    is_active, or course_code — none were indexed.
-- ===========================================================================

-- Used by: teacher sessions list, summary, attendance-trend, stop-session
CREATE INDEX IF NOT EXISTS idx_sessions_prof
    ON course_sessions (prof_uuid, session_date DESC);

-- Used by: dashboard session-activity (WHERE session_date = CURRENT_DATE)
CREATE INDEX IF NOT EXISTS idx_sessions_date
    ON course_sessions (session_date);

-- Used by: admin stats (COUNT WHERE is_active = TRUE), active-sessions endpoint
-- Partial index: only indexes the few active rows, not the entire table.
CREATE INDEX IF NOT EXISTS idx_sessions_active
    ON course_sessions (is_active) WHERE is_active = TRUE;

-- Used by: session start duplicate check, summary joins
CREATE INDEX IF NOT EXISTS idx_sessions_course
    ON course_sessions (course_code);

-- ===========================================================================
-- 3. MISSING INDEX — active_tokens
--    Token cleanup (DELETE WHERE session_uuid AND expires_at_epoch < now)
--    and token lookup both filter on session_uuid first.
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_tokens_session
    ON active_tokens (session_uuid, expires_at_epoch);

-- ===========================================================================
-- 4. STANDALONE audit_logs INDEX
--    The existing composite index (session_uuid, created_at) cannot serve
--    a standalone ORDER BY created_at DESC query (recent-activity endpoint).
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC);

-- Also index event_type for filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type
    ON audit_logs (event_type);

-- ===========================================================================
-- 5. FOREIGN KEY — course_sessions.course_code → courses.course_code
--    Currently a bare VARCHAR with no referential integrity.
-- ===========================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_sessions_course_code'
          AND table_name = 'course_sessions'
    ) THEN
        ALTER TABLE course_sessions
            ADD CONSTRAINT fk_sessions_course_code
            FOREIGN KEY (course_code) REFERENCES courses(course_code)
            ON DELETE CASCADE;
    END IF;
END $$;

-- ===========================================================================
-- 6. FIX divisions UNIQUE constraint
--    The current UNIQUE(name) is too strict — two branches should both be
--    able to have a "Division A". Change to UNIQUE(branch_id, name).
--    Only safe if no duplicate (branch_id, name) pairs exist.
-- ===========================================================================

-- Drop the old overly-strict constraint (name alone)
DO $$
BEGIN
    -- The constraint name from 004 is the default: divisions_name_key
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'divisions_name_key'
          AND table_name = 'divisions'
    ) THEN
        ALTER TABLE divisions DROP CONSTRAINT divisions_name_key;
    END IF;
END $$;

-- Add the correct scoped uniqueness
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'uq_divisions_branch_name'
          AND table_name = 'divisions'
    ) THEN
        ALTER TABLE divisions
            ADD CONSTRAINT uq_divisions_branch_name UNIQUE (branch_id, name);
    END IF;
END $$;

-- ===========================================================================
-- 7. CLEANUP FUNCTIONS
--    Callable by a backend cron or pg_cron to prevent unbounded table growth.
-- ===========================================================================

-- Purge expired tokens that are no longer needed for verification.
-- The judge uses findToken() which looks up by (session_uuid, token_val)
-- regardless of expiry, but only for ACTIVE sessions. Once a session is
-- stopped, its tokens are dead weight.
CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS INTEGER AS $$
DECLARE
    deleted INTEGER;
BEGIN
    DELETE FROM active_tokens
    WHERE expires_at_epoch < (EXTRACT(EPOCH FROM NOW()) * 1000 - 60000)  -- expired > 1 min ago
      AND session_uuid NOT IN (
          SELECT session_uuid FROM course_sessions WHERE is_active = TRUE
      );
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- Purge used/expired crypto challenges (nonces). Once used or expired,
-- they serve no purpose except forensics (which audit_logs already covers).
CREATE OR REPLACE FUNCTION cleanup_used_challenges() RETURNS INTEGER AS $$
DECLARE
    deleted INTEGER;
BEGIN
    DELETE FROM crypto_challenges
    WHERE (used = TRUE AND used_at_epoch < (EXTRACT(EPOCH FROM NOW()) * 1000 - 3600000))  -- used > 1 hr ago
       OR (used = FALSE AND expires_at_epoch < (EXTRACT(EPOCH FROM NOW()) * 1000 - 3600000));  -- expired > 1 hr ago
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- Master cleanup: call both. Returns a summary.
CREATE OR REPLACE FUNCTION run_db_maintenance() RETURNS TEXT AS $$
DECLARE
    tokens_cleaned INTEGER;
    challenges_cleaned INTEGER;
BEGIN
    tokens_cleaned := cleanup_expired_tokens();
    challenges_cleaned := cleanup_used_challenges();
    RETURN format('Cleaned %s expired tokens, %s used challenges', tokens_cleaned, challenges_cleaned);
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- 8. GRANT cleanup functions to the app role
-- ===========================================================================
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO anon;
GRANT EXECUTE ON FUNCTION cleanup_used_challenges() TO anon;
GRANT EXECUTE ON FUNCTION run_db_maintenance() TO anon;
GRANT DELETE ON active_tokens, crypto_challenges TO anon;
