-- ============================================================
-- PHASE 4: Database Migration - Zero-Trust Attendance Gateway
-- Timetable Batches & Teacher Department Mapping
-- ============================================================

-- 1. Add batch_id to teacher_assignments (NULL = whole division theory, NOT NULL = specific lab batch)
ALTER TABLE public.teacher_assignments
    ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;

-- 2. Add batch_id to course_sessions (tracking active batch attendance)
ALTER TABLE public.course_sessions
    ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;

-- 3. Add department_id to professors (link teacher to academic department)
ALTER TABLE public.professors
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 4. Create performance indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_batch ON public.teacher_assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_course_sessions_batch ON public.course_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_professors_department ON public.professors(department_id);
