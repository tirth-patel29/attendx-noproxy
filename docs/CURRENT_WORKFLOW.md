# ZERO-TRUST ATTENDANCE GATEWAY: CURRENT WORKFLOW

## PHASE 1: Architecture & Schema Plan

---

## 1. Supabase SQL Schema Plan

### Tables

#### admin_users
- `admin_uuid` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `email` VARCHAR(120) UNIQUE NOT NULL
- `password_hash` VARCHAR(128) NOT NULL
- `name` VARCHAR(100) NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT NOW()

#### divisions
- `division_id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `name` VARCHAR(50) NOT NULL -- e.g., "Computer Engineering - Div A"

#### courses
- `course_code` VARCHAR(20) PRIMARY KEY
- `title` VARCHAR(100) NOT NULL
- `division_id` UUID REFERENCES divisions(division_id) ON DELETE CASCADE

#### professors
- `prof_uuid` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `email` VARCHAR(120) UNIQUE NOT NULL
- `password_hash` VARCHAR(128) NOT NULL
- `name` VARCHAR(100) NOT NULL
- `department` VARCHAR(50) NOT NULL

#### teacher_assignments (Timetable)
- `assignment_id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `prof_uuid` UUID REFERENCES professors(prof_uuid) ON DELETE CASCADE
- `course_code` VARCHAR(20) REFERENCES courses(course_code) ON DELETE CASCADE
- `division_id` UUID REFERENCES divisions(division_id) ON DELETE CASCADE
- `day_of_week` SMALLINT NOT NULL -- 0=Sunday, 1=Monday, ...
- `start_time` TIME NOT NULL
- `end_time` TIME NOT NULL

#### students
- `student_uuid` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `roll_no` VARCHAR(15) UNIQUE NOT NULL
- `email` VARCHAR(120) UNIQUE NOT NULL
- `name` VARCHAR(100) NOT NULL
- `division_id` UUID REFERENCES divisions(division_id) ON DELETE CASCADE
- `bound_device_id` VARCHAR(255) NULL  -- Hardware tattoo
- `secret_hmac_key` VARCHAR(64) NULL
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()

#### course_sessions (for context, read-only)
- `session_uuid` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `course_code` VARCHAR(20) REFERENCES courses(course_code)
- `prof_uuid` UUID REFERENCES professors(prof_uuid)
- `session_date` DATE NOT NULL DEFAULT CURRENT_DATE
- `is_active` BOOLEAN DEFAULT TRUE
- `created_at` TIMESTAMPTZ DEFAULT NOW()

#### active_tokens (for context, read-only)
- `token_uuid` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `session_uuid` UUID REFERENCES course_sessions(session_uuid) ON DELETE CASCADE
- `token_val` VARCHAR(8) NOT NULL
- `created_at_epoch` BIGINT NOT NULL
- `expires_at_epoch` BIGINT NOT NULL

#### attendance_ledger (for context, read-only)
- `ledger_uuid` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `session_uuid` UUID REFERENCES course_sessions(session_uuid) ON DELETE CASCADE
- `student_uuid` UUID REFERENCES students(student_uuid) ON DELETE CASCADE
- `client_claimed_time` BIGINT NOT NULL
- `server_logged_time` TIMESTAMPTZ DEFAULT NOW()
- `verification_delta_ms` INT NOT NULL
- `status` VARCHAR(15) DEFAULT 'PRESENT'

---

## 2. React/Vite App Architecture Plan

### Admin Portal (admin-dashboard)
- Stack: React 18+, Vite, TypeScript
- Secure login (Supabase JWT/session)
- Hierarchy & Provisioning Screens:
  - Teachers CRUD
  - Students CRUD
  - Courses CRUD
  - Divisions CRUD
- Timetable Management
  - Table/grid UI for day-of-week x period blocks
  - Assignment: Teacher <-> Course <-> Division <-> Time
- Hardware Lock Security Terminal:
  - Student search (by roll no/email)
  - Show `bound_device_id`, click [RESET HARDWARE LOCK] → sets `bound_device_id` to NULL

### Teacher Portal (teacher-dashboard)
- Stack: React 18+, Vite, TypeScript
- Secure login (credentials provisioned by admin)
- Today's Schedule
  - Query `teacher_assignments` by prof_uuid and weekday
  - Show only today's lectures
- [INITIATE ATTENDANCE] button
  - Triggers backend: allocates `session_uuid`, starts metronome
- Projector Mode (Split Screen)
  - **Left 70%:** QR code, live-updating every 3s (Supabase WS, NO FLASHING, NO CSS PATTERNS)
  - **Right 30%:** Real-time roster of `attendance_ledger` stream (WS): Roll No / Name / Verification Latency

---

## 3. Important Implementation Rules
- No direct sign-up for Professors/Teachers: provisioned by admin only.
- No UI gimmicks or CSS moiré simulation.
- Projector QR code is only visually static (not flashing); only data updates every 3s.
- "Shame Air-Gap" logic must be invocable only by admin, never exposed in teacher UI.

---

## Phase 1 status: COMPLETE — Ready for schema implementation approval.

## PHASE 2: DATABASE MIGRATION — COMPLETE (commit ffcf9b8)

### Executed & verified against live Supabase (`supabase-db`, PGPASSWORD auth)
- Created tables: `admin_users`, `divisions`, `courses`, `teacher_assignments`
- `ALTER TABLE professors` ADD `password_hash`
- `ALTER TABLE students` ADD `name`, `division_id` (+ backfill name from email)
- 4 performance indices: assignments by (prof,day), assignments by course, students by division, courses by division
- Verified: 13 public tables present; both upgraded tables show new columns.
- Migration file: `migrations/004_phase2_hierarchy.sql` (idempotent)

### Phase 2 status: COMPLETE — awaiting approval for Phase 3 (Admin Portal).

