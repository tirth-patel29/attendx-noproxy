-- ============================================================
-- Test data seed for Phase 2 development
-- Run after migrations 001 + 002
-- ============================================================

-- ===== 2 Professors =====
INSERT INTO professors (email, name, department) VALUES
  ('prof.alex@college.edu', 'Prof. Alex Chen', 'Computer Science'),
  ('prof.maria@college.edu', 'Prof. Maria Santos', 'Electrical Engineering')
ON CONFLICT (email) DO NOTHING;

-- ===== 5 Students (with HMAC keys for Gate 4) =====
-- Using dummy HMAC keys (64 hex chars = 32 bytes)
INSERT INTO students (roll_no, email, bound_device_id, secret_hmac_key) VALUES
  ('24BCS001', 'alice@student.college.edu', NULL, 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef'),
  ('24BCS002', 'bob@student.college.edu', NULL, 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01'),
  ('24BEE001', 'carol@student.college.edu', NULL, 'c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef012'),
  ('24BEE002', 'david@student.college.edu', NULL, 'd4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0123'),
  ('24BCS003', 'eve@student.college.edu', NULL, 'e5f67890123456789abcdef0123456789abcdef0123456789abcdef01234')
ON CONFLICT (roll_no) DO NOTHING;

-- ===== 2 Course Sessions + Ephemeral tokens =====
DO $$
DECLARE
  v_alex UUID;
  v_maria UUID;
  v_session1 UUID;
  v_session2 UUID;
BEGIN
  SELECT prof_uuid INTO v_alex FROM professors WHERE email = 'prof.alex@college.edu';
  SELECT prof_uuid INTO v_maria FROM professors WHERE email = 'prof.maria@college.edu';

  -- Insert sessions and capture UUIDs using separate inserts
  INSERT INTO course_sessions (course_code, prof_uuid, session_date, is_active) VALUES
    ('CS101', v_alex, CURRENT_DATE, TRUE)
  ON CONFLICT DO NOTHING
  RETURNING session_uuid INTO v_session1;

  INSERT INTO course_sessions (course_code, prof_uuid, session_date, is_active) VALUES
    ('EE201', v_maria, CURRENT_DATE, TRUE)
  ON CONFLICT DO NOTHING
  RETURNING session_uuid INTO v_session2;

  -- If sessions already existed, fetch them
  IF v_session1 IS NULL THEN
    SELECT session_uuid INTO v_session1 FROM course_sessions WHERE course_code = 'CS101' LIMIT 1;
  END IF;
  IF v_session2 IS NULL THEN
    SELECT session_uuid INTO v_session2 FROM course_sessions WHERE course_code = 'EE201' LIMIT 1;
  END IF;

  -- ===== Ephemeral tokens for active sessions (3s rotating) =====
  INSERT INTO active_tokens (session_uuid, token_val, created_at_epoch, expires_at_epoch) VALUES
    (v_session1, '7X9K2M', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, (EXTRACT(EPOCH FROM NOW())::BIGINT + 3) * 1000),
    (v_session1, '4P8Q1R', (EXTRACT(EPOCH FROM NOW())::BIGINT + 3) * 1000, (EXTRACT(EPOCH FROM NOW())::BIGINT + 6) * 1000),
    (v_session2, '9L2W5Z', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, (EXTRACT(EPOCH FROM NOW())::BIGINT + 3) * 1000),
    (v_session2, '3H7Y0N', (EXTRACT(EPOCH FROM NOW())::BIGINT + 3) * 1000, (EXTRACT(EPOCH FROM NOW())::BIGINT + 6) * 1000);

  RAISE NOTICE 'Seeded: 2 professors, 2 sessions, 5 students, 4 tokens';
END $$;