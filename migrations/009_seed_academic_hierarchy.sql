-- ============================================================
-- PHASE 3: Database Migration - Zero-Trust Attendance Gateway
-- Seed Academic Hierarchy (DEPSTAR, CSPIT)
-- ============================================================

DO $$ 
DECLARE
    depstar_id UUID;
    cspit_id UUID;
    dept_eng_depstar UUID;
    dept_eng_cspit UUID;
    branch_ce_depstar UUID;
    div_ce_24_depstar UUID;
BEGIN
    -- 1. COLLEGES
    INSERT INTO colleges (name, code) VALUES ('DEPSTAR', 'D') RETURNING id INTO depstar_id;
    INSERT INTO colleges (name, code) VALUES ('CSPIT', 'C') RETURNING id INTO cspit_id;

    -- 2. DEPARTMENTS
    INSERT INTO departments (college_id, name, code) VALUES (depstar_id, 'Engineering', 'ENG') RETURNING id INTO dept_eng_depstar;
    INSERT INTO departments (college_id, name, code) VALUES (cspit_id, 'Engineering', 'ENG') RETURNING id INTO dept_eng_cspit;

    -- 3. BRANCHES for DEPSTAR
    INSERT INTO branches (department_id, name, code) VALUES (dept_eng_depstar, 'Computer Engineering', 'CE') RETURNING id INTO branch_ce_depstar;
    INSERT INTO branches (department_id, name, code) VALUES (dept_eng_depstar, 'Computer Science', 'CS');
    INSERT INTO branches (department_id, name, code) VALUES (dept_eng_depstar, 'Information Technology', 'IT');
    INSERT INTO branches (department_id, name, code) VALUES (dept_eng_depstar, 'Artificial Intelligence & Machine Learning', 'AIML');

    -- 3. BRANCHES for CSPIT
    INSERT INTO branches (department_id, name, code) VALUES (dept_eng_cspit, 'Computer Engineering', 'CE');
    INSERT INTO branches (department_id, name, code) VALUES (dept_eng_cspit, 'Computer Science', 'CS');
    INSERT INTO branches (department_id, name, code) VALUES (dept_eng_cspit, 'Information Technology', 'IT');
    INSERT INTO branches (department_id, name, code) VALUES (dept_eng_cspit, 'Artificial Intelligence & Machine Learning', 'AIML');

    -- 4. DIVISIONS
    -- Assuming academic year 2024 for 3rd year students
    INSERT INTO divisions (name, branch_id, code, academic_year) VALUES ('CE 3rd Year (2024)', branch_ce_depstar, 'CE', 2024) RETURNING division_id INTO div_ce_24_depstar;
    
    -- 5. BATCHES
    -- CE1
    INSERT INTO batches (division_id, name, code, start_roll, end_roll) 
    VALUES (div_ce_24_depstar, 'CE1', 'CE1', '24DCE071', '24DCE075');
    
    -- CE2
    INSERT INTO batches (division_id, name, code, start_roll, end_roll) 
    VALUES (div_ce_24_depstar, 'CE2', 'CE2', '24DCE076', '24DCE151');
    
    -- D2D
    INSERT INTO batches (division_id, name, code, start_roll, end_roll) 
    VALUES (div_ce_24_depstar, 'D2D', 'D2D', 'D25D152', 'D25D179');

END $$;
