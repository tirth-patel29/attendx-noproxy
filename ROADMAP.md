# ROADMAP — Zero-Trust Cryptographic Attendance Gateway

Order of work. Each phase is boring, reviewable, and — critically — **power-cut safe**:
whatever we ship must survive `atmyhome.tech` losing power mid-step.

Legend: `[ ]` todo · `[x]` done · `>` currently in progress

---

## Phase 0 — Foundation (scaffold + context) ✅ COMPLETE

- [x] SRS ingested into `docs/` (the 19-page blueprint).
- [x] `CONTEXT.md` written (gates, stack, homelab constraints).
- [x] Monorepo scaffold (`docs`, `deploy`, `migrations`, `backend`, `app`, `scripts`).
- [x] **Push this repo to Gitea** → `het/attendance-gateway` live at `http://gitea:3000/het/attendance-gateway`
- [x] Access model decided: Team clones via Tailscale + SSH to homelab Gitea
- [x] Write `docs/CONTRIBUTING.md` (branch/label/PR protocol + homelab impact statement)
- [x] Gitea issue template for task tracking (`.gitea/issue_template/task.md`)
- [x] **PROJECT_PLAN.md** created with detailed phases, timeline, RACI, risks, success metrics
- [ ] Pin the **exact** self-hosted Supabase versions that fit 8GB RAM (in compose)

## Phase 1 — Database & schema (Supabase on the homelab) ✅ COMPLETE

- [x] Author full schema from the SRS into `migrations/` (students, professors,
      course_sessions, active_tokens, attendance_ledger + indices + `RollNumber` domain).
- [x] Migration 001 applied to live Supabase DB.
- [x] Migration 002 applied (device_fingerprints, biometric_templates, crypto_challenges, audit_logs).
- [x] Migration 003 applied (seed: 2 professors, 5 students, 2 sessions, 4 tokens).
- [x] Verify indices & constraints (unique_attendance_claim, idx_tokens_fast_lookup, idx_student_auth working).
- [x] Tune Postgres for 8GB (`shared_buffers`, `work_mem`, `max_connections`) — see `deploy/`.
- [x] Bind-mount data on the SSD; wire automated nightly backup to the 500GB WD.
- [x] Stand up a `supabase` Portainer stack on the proxycore network.
- [x] Expose `supabase.atmyhome.tech` via proxycore.
- [x] **Power-cut drill #1**: force-reboot the homelab, confirm DB comes back clean,
      confirm a recent backup exists. (Do this early — it's cheap now, expensive later.)

## Phase 2 — Backend judge + metronome (Node/TS) ✅ COMPLETE

- [x] `GET /api/v1/time-sync` (returns `server_epoch`).
- [x] Socket.io/WS metronome: mint a base62 token every 3s, broadcast, persist to `active_tokens`.
- [x] `POST /api/v1/claim-attendance` implementing all 4 gates (hardware match, HMAC verify, token lookup, 250ms latency check) + unique-claim handling.
- [x] Unit tests for the judge (honest/fast/streamed/forged cases from the SRS state matrix).
- [x] Docker image built and deployed on homelab (`attendance-backend:latest`, proxynet).
- [x] All 6 SRS attack vectors verified blocked.
- [x] Public at `https://api.atmyhome.tech`

## Phase 3 — Flutter client (4 gates + pre-check UI) ✅ SCAFFOLD COMPLETE

- [x] Provisioning flow: hardware UUID generation → secure storage → bind to server account.
- [x] Cristian's Algorithm time calibration on boot (`DriftOffset`).
- [x] Pre-check UI (4 checkpoints), `local_auth` flesh check, `mobile_scanner` placeholders.
- [x] `assembleVerificationPacket` + HMAC wax seal + dispatch.
- [x] Result UI per the state machine (green PRESENT / hardware mismatch / stream detected…).
- [ ] Run on a physical Android test device (the whole point — must work on real phones).
- [ ] Integrate with live backend `api.atmyhome.tech` end-to-end.

## Phase 4 — Teacher Web Portal (React + Vite + Tailwind) ✅ DEPLOYED

- [x] Dashboard: list sessions, start/stop, view today's schedule, QR projector
- [x] Dual-state projector: 2.9s static session anchor + 100ms rotating token flash (anti-stream)
- [x] Session page: live rotating token, attendance table with latency delta, CSV export
- [x] Auth: JWT login with refresh token, protected routes
- [x] Modern UI: Tailwind CSS + Radix UI / shadcn components
- [x] API integration: connected to `https://api.atmyhome.tech`
- [x] Deployed: `https://portal.atmyhome.tech`
- [x] Healthcheck: `/health` endpoint

## Phase 5 — Academic Hierarchy & Batches (Migrations 004–012) ✅ COMPLETE

- [x] Multi-tier academic tree: Colleges → Departments → Branches → Divisions → Batches
- [x] Roll number derivation & range definition: `batches.start_roll` to `batches.end_roll`
- [x] Faculty department mapping: `professors.department_id` linked to `departments.id`
- [x] Timetable batch slots: `teacher_assignments.batch_id` supports Theory (`null`, all batches) vs Lab (specific batch)
- [x] Teacher Portal timetable display with Theory/Lab badges
- [x] Admin Console CRUD for all hierarchy entities and batch-aware scheduling

## Phase 6 — Flutter Mobile Client (Hardware Binding & Gates) ✅ SCAFFOLDED

- [ ] `flutter pub get` → `flutter build apk --release`
- [ ] Test on physical Android (provision with roll no)
- [ ] Verify 4-gate flow: hardware UUID → biometric → QR scan → crypto timestamp
- [ ] Verify PRESENT verdict against live backend

## Phase 7 — Hardening & Demo Readiness

- [x] CI/CD pipeline via GitHub Actions on AWS EC2
- [x] Reverse-proxy setup via host Caddy with automated Let's Encrypt TLS
- [ ] End-to-end class-flow smoke test with physical mobile devices
- [ ] Concurrency testing: simulate 70+ claims against the judge
- [ ] Prepare the demo script

---

## ✅ Current System Status

| Component | Status | URL |
|-----------|--------|-----|
| **Attendance Gateway** (Node/TS) | ✅ 4-gate judge + metronome + Admin API | `https://api.atmyhome.tech` |
| **Admin Console** (React/Vite) | ✅ Hierarchy, Timetable, Batches, Hardware Reset | `https://admin.atmyhome.tech` |
| **Teacher Portal** (React/Vite) | ✅ Schedule & Dual-State Projector | `https://portal.atmyhome.tech` |
| **Database** (PostgreSQL/Supabase) | ✅ 12 migrations applied & indexed | Direct Cloud Connection |
| **Mobile App** (Flutter) | ✅ 4-gate client | `app/` |

> **Admin console** — "top of the database": manage teachers (CRUD + password reset),
> students (CRUD + **device reset** = unbind hardware tattoo + rotate Gate-4 HMAC, and
> standalone HMAC rotation), divisions, courses and the teacher timetable
> (`teacher_assignments`). All security-sensitive ops are audit-logged (DEVICE_RESET,
> HMAC_ROTATE, TEACHER_PASSWORD_RESET, …) to `audit_logs`. Default admin seed:
> `admin@atmyhome.tech` / `Admin@123` (CHANGE after first login).

---

## 🎯 Next Actions for Team

### Teammate 1 (Mobile): Build & Test Flutter APK
```bash
git clone http://gitea:3000/het/attendance-gateway.git
cd attendance-gateway/app
flutter pub get
flutter build apk --release
# Install on physical Android, provision with roll number (e.g., 24BCS001)
```

### Teammate 2 (Professor): Test Teacher
1. Open `https://teacher.atmyhome.tech`
2. Login with professor credentials
3. Create a session → "Show QR Code"
4. Have Teammate 1 scan with Flutter app
5. Verify "PRESENT" appears on both teacher and app

### Everyone: Power-Cut Drill #2
```bash
# On homelab (as root)
reboot
# Verify:
# - All 7 Supabase containers Up
# - Backend container Up  
# - Teacher container Up
# - DB schema intact
# - Recent backup on 500GB WD
```

---

All code is committed to Gitea. Teammates clone, build locally, test against live endpoints.