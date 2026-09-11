-- ============================================================
-- 010_db_optimization.sql
-- Safe, repeatable indexes, referential-integrity repair, and cleanup
-- for the current Zero-Trust Attendance Gateway schema.
-- ============================================================

-- ------------------------------------------------------------------
-- ATTENDANCE LEDGER
-- ------------------------------------------------------------------
-- Session attendance counts and PRESENT-only dashboard aggregates.
CREATE INDEX IF NOT EXISTS idx_ledger_session_status
    ON attendance_ledger (session_uuid, status);

-- Student attendance history: filtered by student, newest records first.
CREATE INDEX IF NOT EXISTS idx_ledger_student_logged
    ON attendance_ledger (student_uuid, server_logged_time DESC);

-- Daily verification-status dashboard.
CREATE INDEX IF NOT EXISTS idx_ledger_logged_status
    ON attendance_ledger (server_logged_time DESC, status);

-- ------------------------------------------------------------------
-- COURSE SESSIONS
-- ------------------------------------------------------------------
-- Professor session list, newest first.
CREATE INDEX IF NOT EXISTS idx_sessions_prof_created
    ON course_sessions (prof_uuid, created_at DESC);

-- Current-lecture lookup for a professor/course/date.
CREATE INDEX IF NOT EXISTS idx_sessions_prof_course_date_created
    ON course_sessions (prof_uuid, course_code, session_date, created_at DESC);

-- Seven-day trend and today's session-activity dashboard.
CREATE INDEX IF NOT EXISTS idx_sessions_date
    ON course_sessions (session_date);

-- Active-sessions dashboard, ordered by newest first.
CREATE INDEX IF NOT EXISTS idx_sessions_active_created
    ON course_sessions (created_at DESC)
    WHERE is_active = TRUE;

-- ------------------------------------------------------------------
-- TOKENS, CHALLENGES, AND AUDIT LOGS
-- ------------------------------------------------------------------
-- Token lookup, expiry cleanup, and active-token retrieval per session.
CREATE INDEX IF NOT EXISTS idx_tokens_session_expiry
    ON active_tokens (session_uuid, expires_at_epoch);
CREATE INDEX IF NOT EXISTS idx_tokens_expiry
    ON active_tokens (expires_at_epoch);

-- Atomic nonce consume/replay check and bounded cleanup scans.
CREATE INDEX IF NOT EXISTS idx_challenges_session_nonce
    ON crypto_challenges (session_uuid, challenge_nonce);
CREATE INDEX IF NOT EXISTS idx_challenges_unused_expiry
    ON crypto_challenges (expires_at_epoch)
    WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_challenges_used_at
    ON crypto_challenges (used_at_epoch)
    WHERE used = TRUE;

-- Recent activity dashboard.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC);

-- ------------------------------------------------------------------
-- ACADEMIC HIERARCHY AND TIMETABLE
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_assignments_prof_schedule
    ON teacher_assignments (prof_uuid, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_assignments_course
    ON teacher_assignments (course_code);
CREATE INDEX IF NOT EXISTS idx_students_division
    ON students (division_id);
CREATE INDEX IF NOT EXISTS idx_courses_division
    ON courses (division_id);
CREATE INDEX IF NOT EXISTS idx_departments_college
    ON departments (college_id);
CREATE INDEX IF NOT EXISTS idx_branches_department
    ON branches (department_id);
CREATE INDEX IF NOT EXISTS idx_divisions_branch
    ON divisions (branch_id);
CREATE INDEX IF NOT EXISTS idx_batches_division
    ON batches (division_id);

-- ------------------------------------------------------------------
-- REPAIR LEGACY COURSE-SESSION REFERENCES, THEN ADD THE FK
--
-- Old data contains sessions (for example EE201) created before their
-- course row existed. Preserve those sessions and their attendance by
-- creating a clearly marked course placeholder. Update its title and
-- division through the admin UI afterwards if required.
-- ------------------------------------------------------------------
INSERT INTO courses (course_code, title, division_id)
SELECT
    cs.course_code,
    'Legacy course: ' || cs.course_code,
    (
        SELECT ta.division_id
        FROM teacher_assignments AS ta
        WHERE ta.course_code = cs.course_code
        ORDER BY ta.assignment_id
        LIMIT 1
    )
FROM course_sessions AS cs
LEFT JOIN courses AS c
    ON c.course_code = cs.course_code
WHERE cs.course_code IS NOT NULL
  AND c.course_code IS NULL
GROUP BY cs.course_code
ON CONFLICT (course_code) DO NOTHING;

-- RESTRICT is deliberate: deleting a course must not silently delete
-- historical sessions, tokens, and attendance records.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_sessions_course_code'
          AND conrelid = 'public.course_sessions'::regclass
    ) THEN
        ALTER TABLE course_sessions
            ADD CONSTRAINT fk_sessions_course_code
            FOREIGN KEY (course_code)
            REFERENCES courses(course_code)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- A division name only needs to be unique within its branch.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'divisions_name_key'
          AND conrelid = 'public.divisions'::regclass
    ) THEN
        ALTER TABLE divisions DROP CONSTRAINT divisions_name_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_divisions_branch_name'
          AND conrelid = 'public.divisions'::regclass
    ) THEN
        ALTER TABLE divisions
            ADD CONSTRAINT uq_divisions_branch_name UNIQUE (branch_id, name);
    END IF;
END $$;

-- ------------------------------------------------------------------
-- MAINTENANCE FUNCTIONS
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM active_tokens AS t
    WHERE t.expires_at_epoch < (EXTRACT(EPOCH FROM NOW()) * 1000 - 60000)
      AND NOT EXISTS (
          SELECT 1
          FROM course_sessions AS s
          WHERE s.session_uuid = t.session_uuid
            AND s.is_active = TRUE
      );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_used_challenges() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM crypto_challenges
    WHERE (used = TRUE
           AND used_at_epoch < EXTRACT(EPOCH FROM NOW()) * 1000 - 3600000)
       OR (used = FALSE
           AND expires_at_epoch < EXTRACT(EPOCH FROM NOW()) * 1000 - 3600000);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION run_db_maintenance() RETURNS TEXT AS $$
DECLARE
    tokens_cleaned INTEGER;
    challenges_cleaned INTEGER;
BEGIN
    tokens_cleaned := cleanup_expired_tokens();
    challenges_cleaned := cleanup_used_challenges();
    RETURN format('Cleaned %s expired tokens, %s used challenges',
                  tokens_cleaned, challenges_cleaned);
END;
$$ LANGUAGE plpgsql;
