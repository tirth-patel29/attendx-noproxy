-- ============================================================
-- PHASE 3: Database Migration - Zero-Trust Attendance Gateway
-- Academic Hierarchy Update
-- ============================================================

CREATE TABLE IF NOT EXISTS colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(college_id, code)
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(department_id, code)
);

-- Upgrade existing divisions table
ALTER TABLE divisions
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS academic_year INTEGER,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID REFERENCES divisions(division_id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20),
    start_roll VARCHAR(15),
    end_roll VARCHAR(15),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade existing students table
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS joining_year INTEGER,
    ADD COLUMN IF NOT EXISTS current_academic_year INTEGER,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add performance indices
CREATE INDEX IF NOT EXISTS idx_departments_college ON departments (college_id);
CREATE INDEX IF NOT EXISTS idx_branches_department ON branches (department_id);
CREATE INDEX IF NOT EXISTS idx_divisions_branch ON divisions (branch_id);
CREATE INDEX IF NOT EXISTS idx_batches_division ON batches (division_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students (batch_id);
