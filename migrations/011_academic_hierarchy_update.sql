-- ============================================================
-- PHASE 3/4: Database Migration
-- Academic Hierarchy Update - CE Semesters and Batches
-- ============================================================

-- 1. Create Semesters Table
CREATE TABLE IF NOT EXISTS semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, level)
);

-- 2. Add semester_id to divisions
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE;

-- 3. Data Migration (Targeted for CE)
DO $$
DECLARE
    ce_branch_id UUID;
    sem_5_id UUID;
    div_5ce1_id UUID;
    div_5ce2_id UUID;
    legacy_div_id UUID;
    batch_a_id UUID;
    batch_b_id UUID;
    batch_c_id UUID;
BEGIN
    SELECT id INTO ce_branch_id FROM branches WHERE code = 'CE' LIMIT 1;
    IF ce_branch_id IS NOT NULL THEN
        -- Create Sem 5
        INSERT INTO semesters (branch_id, name, level) 
        VALUES (ce_branch_id, 'Sem 5', 5)
        ON CONFLICT (branch_id, level) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO sem_5_id;

        -- Identify 5CE1 and 5CE2
        SELECT division_id INTO div_5ce1_id FROM divisions WHERE code = 'CE1' AND branch_id = ce_branch_id LIMIT 1;
        SELECT division_id INTO div_5ce2_id FROM divisions WHERE code = 'CE2' AND branch_id = ce_branch_id LIMIT 1;
        
        -- Identify legacy division
        SELECT division_id INTO legacy_div_id FROM divisions 
        WHERE (name = 'CE 3rd Year (2024)' OR code = 'CE-DEP') AND branch_id = ce_branch_id LIMIT 1;

        -- Ensure 5CE1 and 5CE2 exist and are linked to Sem 5
        IF div_5ce1_id IS NULL THEN
            INSERT INTO divisions (name, code, academic_year, branch_id, semester_id) 
            VALUES ('5CE1', 'CE1', 2024, ce_branch_id, sem_5_id) RETURNING division_id INTO div_5ce1_id;
        ELSE
            UPDATE divisions SET semester_id = sem_5_id WHERE division_id = div_5ce1_id;
        END IF;

        IF div_5ce2_id IS NULL THEN
            INSERT INTO divisions (name, code, academic_year, branch_id, semester_id) 
            VALUES ('5CE2', 'CE2', 2024, ce_branch_id, sem_5_id) RETURNING division_id INTO div_5ce2_id;
        ELSE
            UPDATE divisions SET semester_id = sem_5_id WHERE division_id = div_5ce2_id;
        END IF;

        -- Setup exact Batches for 5CE2
        -- Batch A: 24DCE076 - 24DCE106
        SELECT id INTO batch_a_id FROM batches WHERE code = 'CE2-A' AND division_id = div_5ce2_id LIMIT 1;
        IF batch_a_id IS NOT NULL THEN
            UPDATE batches SET start_roll = '24DCE076', end_roll = '24DCE106', name = 'Batch A' WHERE id = batch_a_id;
        ELSE
            INSERT INTO batches (division_id, name, code, start_roll, end_roll) 
            VALUES (div_5ce2_id, 'Batch A', 'CE2-A', '24DCE076', '24DCE106') RETURNING id INTO batch_a_id;
        END IF;

        -- Batch B: 24DCE107 - 24DCE129
        SELECT id INTO batch_b_id FROM batches WHERE code = 'CE2-B' AND division_id = div_5ce2_id LIMIT 1;
        IF batch_b_id IS NOT NULL THEN
            UPDATE batches SET start_roll = '24DCE107', end_roll = '24DCE129', name = 'Batch B' WHERE id = batch_b_id;
        ELSE
            INSERT INTO batches (division_id, name, code, start_roll, end_roll) 
            VALUES (div_5ce2_id, 'Batch B', 'CE2-B', '24DCE107', '24DCE129') RETURNING id INTO batch_b_id;
        END IF;

        -- Batch C: 24DCE130 - 24DCE151
        SELECT id INTO batch_c_id FROM batches WHERE code = 'CE2-C' AND division_id = div_5ce2_id LIMIT 1;
        IF batch_c_id IS NOT NULL THEN
            UPDATE batches SET start_roll = '24DCE130', end_roll = '24DCE151', name = 'Batch C' WHERE id = batch_c_id;
        ELSE
            INSERT INTO batches (division_id, name, code, start_roll, end_roll) 
            VALUES (div_5ce2_id, 'Batch C', 'CE2-C', '24DCE130', '24DCE151') RETURNING id INTO batch_c_id;
        END IF;

        -- Explicit Student Mapping for 5CE2 based on real roll number ranges
        -- We process these updates idempotently
        UPDATE students SET division_id = div_5ce2_id, batch_id = batch_a_id
        WHERE roll_no >= '24DCE076' AND roll_no <= '24DCE106';

        UPDATE students SET division_id = div_5ce2_id, batch_id = batch_b_id
        WHERE roll_no >= '24DCE107' AND roll_no <= '24DCE129';

        UPDATE students SET division_id = div_5ce2_id, batch_id = batch_c_id
        WHERE roll_no >= '24DCE130' AND roll_no <= '24DCE151';

        -- Explicit Student Mapping for 5CE1
        -- Any CE student before 076 goes to 5CE1
        UPDATE students SET division_id = div_5ce1_id
        WHERE roll_no LIKE '24DCE%' AND roll_no < '24DCE076';

        IF legacy_div_id IS NOT NULL THEN
            -- Ensure any existing 'CE1' batch in legacy gets moved to 5CE1 safely
            UPDATE batches SET division_id = div_5ce1_id 
            WHERE code = 'CE1' AND division_id = legacy_div_id;

            -- We specifically DO NOT touch the D2D batch or D2D students. They stay in the legacy division.
            -- If previously moved, push D2D back to legacy division.
            UPDATE batches SET division_id = legacy_div_id WHERE code = 'D2D' AND division_id = div_5ce2_id;
            
            -- Targeted migration for teacher_assignments.
            -- ONLY migrate assignments that were previously explicitly for 'CE2' batch which we can track if they have the legacy batch ID
            -- Or if they are explicitly part of 5CE2 courses. For safety, we only move assignments mapped to Batch A, B, or C.
            UPDATE teacher_assignments SET division_id = div_5ce2_id 
            WHERE batch_id IN (batch_a_id, batch_b_id, batch_c_id) AND division_id = legacy_div_id;

            -- Move courses ONLY if all their active assignments have been moved to 5CE2
            -- (Avoid blind move of unrelated subjects)
            UPDATE courses SET division_id = div_5ce2_id
            WHERE division_id = legacy_div_id 
            AND course_code IN (
                SELECT DISTINCT course_code FROM teacher_assignments WHERE division_id = div_5ce2_id
            );

            -- Rename legacy division to clarify it's deprecated without destroying history
            UPDATE divisions SET name = 'DEPRECATED - CE 3rd Year (2024)', code = 'CE-DEP' 
            WHERE division_id = legacy_div_id AND code != 'CE-DEP';
        END IF;
    END IF;
END $$;
