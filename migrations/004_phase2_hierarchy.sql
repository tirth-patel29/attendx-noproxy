-- ============================================================
-- PHASE 2: Database Migration - Zero-Trust Attendance Gateway
-- Admin & Teacher hierarchy (per CURRENT_WORKFLOW.md)
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. ADMIN USERS (superuser table - Admin Portal only)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    admin_uuid    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- 2. DIVISIONS (academic structure, e.g. "Computer Engineering - Div A")
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS divisions (
    division_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL UNIQUE
);

-- ------------------------------------------------------------------
-- 3. COURSES (each course belongs to one division)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    course_code VARCHAR(20) PRIMARY KEY,
    title       VARCHAR(100) NOT NULL,
    division_id UUID REFERENCES divisions(division_id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------
-- 4. PROFESSORS (UPGRADE: add password_hash for provisioned logins)
-- ------------------------------------------------------------------
ALTER TABLE professors
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128);

-- ------------------------------------------------------------------
-- 5. TEACHER ASSIGNMENTS (The Timetable - core routing table)
--    Links prof_uuid -> course_code -> division_id on a day/time block
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prof_uuid     UUID REFERENCES professors(prof_uuid) ON DELETE CASCADE NOT NULL,
    course_code   VARCHAR(20) REFERENCES courses(course_code) ON DELETE CASCADE NOT NULL,
    division_id   UUID REFERENCES divisions(division_id) ON DELETE CASCADE NOT NULL,
    day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    CONSTRAINT chk_time_order CHECK (end_time > start_time)
);

-- ------------------------------------------------------------------
-- 6. STUDENTS (UPGRADE: add name + division_id)
-- ------------------------------------------------------------------
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(division_id) ON DELETE SET NULL;

-- Backfill name for existing students (derived from email local-part)
UPDATE students SET name = split_part(email, '@', 1) WHERE name IS NULL;

-- ------------------------------------------------------------------
-- PERFORMANCE INDICES for timetable + roster lookups
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_assignments_prof_day
    ON teacher_assignments (prof_uuid, day_of_week);
CREATE INDEX IF NOT EXISTS idx_assignments_course
    ON teacher_assignments (course_code);
CREATE INDEX IF NOT EXISTS idx_students_division
    ON students (division_id);
CREATE INDEX IF NOT EXISTS idx_courses_division
    ON courses (division_id);
