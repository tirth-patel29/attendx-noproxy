-- ============================================================
-- 011_security_rls_and_performance.sql
-- Enables Row Level Security (RLS) across all public tables,
-- grants service_role full management policies,
-- secures function search_path, and removes redundant indexes.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. FUNCTION SEARCH_PATH IMMUTABILITY
-- Prevents search_path injection security vulnerabilities.
-- ------------------------------------------------------------------
ALTER FUNCTION public.cleanup_used_challenges() SET search_path = public, pg_temp;
ALTER FUNCTION public.run_db_maintenance() SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_tokens() SET search_path = public, pg_temp;

-- ------------------------------------------------------------------
-- 2. INDEX OPTIMIZATIONS
-- Drop duplicate identical indexes to eliminate wasted write WAL churn.
-- ------------------------------------------------------------------
DROP INDEX IF EXISTS idx_tokens_session_expiry;
DROP INDEX IF EXISTS idx_challenges_session_nonce;
DROP INDEX IF EXISTS idx_api_keys_hash;

-- Missing foreign key index on teacher_assignments
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_division_id
    ON public.teacher_assignments (division_id);

-- ------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) ON ALL PUBLIC TABLES
-- Protects data from unauthorized access via PostgREST / anon API key.
-- Direct connections (postgres / supabase_admin) bypass RLS by default.
-- Service_role retains full management access.
-- ------------------------------------------------------------------
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'course_sessions', 'active_tokens', 'attendance_ledger',
        'device_fingerprints', 'professors', 'admin_users',
        'courses', 'teacher_assignments', 'biometric_templates',
        'crypto_challenges', 'audit_logs', 'divisions',
        'api_keys', 'colleges', 'departments', 'branches',
        'batches', 'students'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "service_role_manage_%s" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "service_role_manage_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;
