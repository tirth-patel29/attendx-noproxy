# PROJECT PLAN — Zero-Trust Cryptographic Student Attendance Gateway

**Project:** Zero-Trust Cryptographic Student Attendance Gateway  
**Team:** College Software Group (4 members)  
**Repository:** `het/attendance-gateway` on Gitea (homelab)  
**Target Environment:** Homelab — i3-6000T, 8GB RAM, power-cut-prone  
**Start Date:** 2026-08-06  
**Target Demo Date:** TBD (aim for 4-6 weeks)

---

## EXECUTIVE SUMMARY

We are building a **self-hosted attendance system** that cryptographically proves a student is physically in the classroom at scan time. The system uses **four security gates**:

1. **Hardware Tattoo** — UUID locked in Secure Enclave (prevents account sharing)
2. **Biometric Flesh Lock** — OS-level thumbprint/FaceID before camera opens (prevents proxy devices)
3. **Visual Micro-Twitch** — 3-second rotating QR token (defeats static photos)
4. **Cryptographic Time-Stamp** — 250ms kill window via Cristian's Algorithm + HMAC (defeats live streams)

**Tech Stack:**
- **Client:** Flutter (Dart) with `flutter_secure_storage`, `local_auth`, `mobile_scanner`, `crypto`
- **Backend:** Node.js/TypeScript (Express + Socket.io for metronome + REST API)
- **Database/Auth/Realtime:** Self-hosted Supabase (PostgreSQL + GoTrue + PostgREST + Realtime)
- **Deployment:** Homelab via Portainer + proxycore (nginx + cloudflared tunnel)
- **Domain:** `supabase.atmyhome.tech`, `atmyhome.tech`

**Constraints:**
- 8GB RAM total, running 8 Docker stacks already
- Power cuts are real — durability > speed
- Must survive blackout with zero data corruption
- Network: `proxynet` (Docker), `proxycore` (reverse proxy)

---

## DETAILED PHASE BREAKDOWN

---

### PHASE 0: FOUNDATION & REPO SETUP (Week 1, Days 1-3) ✅ MOSTLY DONE

| ID | Task | Owner | Status | Dependencies | Deliverable |
|----|------|-------|--------|--------------|-------------|
| 0.1 | Ingest SRS (19-page PDF) into repo | AI | ✅ Done | — | `docs/SRS_ZeroTrust_Attendance.pdf` |
| 0.2 | Write CONTEXT.md (gates, stack, homelab constraints) | AI | ✅ Done | 0.1 | `CONTEXT.md` |
| 0.3 | Scaffold monorepo structure | AI | ✅ Done | — | `/docs, /deploy, /migrations, /backend, /app, /scripts` |
| 0.4 | Write Supabase deploy compose (8GB-tuned, power-cut safe) | AI | ✅ Done | — | `deploy/supabase/docker-compose.yml` |
| 0.5 | Write backup script (nightly pg_dump to 500GB WD) | AI | ✅ Done | — | `scripts/backup.sh` |
| 0.6 | Write schema migration (students, professors, sessions, tokens, ledger) | AI | ✅ Done | 0.1 | `migrations/001_schema.sql` |
| 0.7 | Write ROADMAP.md | AI | ✅ Done | — | `ROADMAP.md` |
| 0.8 | **Create PROJECT_PLAN.md (this file)** | AI | 🔄 In Progress | — | `PROJECT_PLAN.md` |
| 0.9 | Push repo to Gitea (`het/attendance-gateway`) | AI | ⏳ Pending | 0.8 | Repo live on `http://gitea:3000/het/attendance-gateway` |
| 0.10 | Write CONTRIBUTING.md (branch/PR protocol) | AI | ⏳ Pending | 0.9 | `docs/CONTRIBUTING.md` |
| 0.11 | Pin exact Supabase image versions in compose | AI | ⏳ Pending | 0.4 | Updated `docker-compose.yml` with pinned tags |
| 0.12 | Verify Gitea access for all team members (Tailscale + SSH) | Team | ⏳ Pending | 0.9 | All can clone/push |

**Milestone 0:** Repo live on Gitea, all foundation docs committed, team can clone.

---

### PHASE 1: DATABASE & SCHEMA ON HOMELAB (Week 1-2, Days 3-7)

| ID | Task | Owner | Status | Dependencies | Deliverable |
|----|------|-------|--------|--------------|-------------|
| 1.1 | Review & finalize schema with team | Team | ⏳ Pending | 0.11 | Approved `migrations/001_schema.sql` |
| 1.2 | Apply schema to Supabase DB (run migration) | AI | ⏳ Pending | 1.1 | Tables created in `supabase.atmyhome.tech` |
| 1.3 | Verify indices & constraints (unique_attendance_claim, etc.) | AI | ⏳ Pending | 1.2 | `idx_tokens_fast_lookup`, `idx_student_auth` working |
| 1.4 | Configure Postgres for 8GB (shared_buffers=384MB, work_mem=16MB, max_conn=100) | AI | ⏳ Pending | 1.2 | Postgres tuned, running stable |
| 1.5 | Bind-mount DB data to SSD (`/mnt/data/supabase/db`) | AI | ✅ Done | — | Persists across reboots |
| 1.6 | Set up nightly backup cron (02:30 → 500GB WD) | AI | ⏳ Pending | 1.5 | `scripts/backup.sh` in crontab |
| 1.7 | Test backup restore (spin up test DB from dump) | AI | ⏳ Pending | 1.6 | Verified restore works |
| 1.8 | Expose `supabase.atmyhome.tech` via NPM + cloudflared | AI | ⏳ Pending | 1.2 | HTTPS works end-to-end |
| 1.9 | **Power-Cut Drill #1** — Force reboot homelab, verify: DB up, schema intact, backup exists | Team + AI | ⏳ Pending | 1.4-1.7 | Documented recovery time, zero corruption |
| 1.10 | Seed test data (2 professors, 5 students, 1 course session) | AI | ⏳ Pending | 1.3 | Test data in DB for Phase 2 |

**Milestone 1:** Supabase fully operational on homelab, schema applied, backups verified, survives power cut.

---

### PHASE 2: BACKEND JUDGE + METRONOME (Week 2-3, Days 8-14)

| ID | Task | Owner | Status | Dependencies | Deliverable |
|----|------|-------|--------|--------------|-------------|
| 2.1 | Initialize Node/TS project in `/backend` | AI | ⏳ Pending | 1.10 | `package.json`, `tsconfig.json`, ESLint, Prettier |
| 2.2 | Implement `GET /api/v1/time-sync` → returns `server_epoch` | AI | ⏳ Pending | 2.1 | Endpoint tested with curl |
| 2.3 | Implement Socket.io metronome (3s token mint → WS broadcast → persist to `active_tokens`) | AI | ⏳ Pending | 2.2 | Tokens mint every 3s, visible in DB |
| 2.4 | Implement `POST /api/v1/claim-attendance` (all 4 gates) | AI | ⏳ Pending | 2.3 | Gate logic: HW match, HMAC verify, token lookup, 250ms check |
| 2.5 | Handle thundering herd (70 concurrent claims) — connection pooling, idempotency | AI | ⏳ Pending | 2.4 | Load test passes |
| 2.6 | Professor portal (React/TS): start/stop session, live QR, attendance table, 1-click device reset | AI | ⏳ Pending | 2.3 | Web UI at `/portal` |
| 2.7 | Unit tests for judge (honest, bad WiFi, WhatsApp photo, Discord stream, Postman spoof, friend login) | AI | ⏳ Pending | 2.4 | All 6 SRS state-matrix cases pass |
| 2.8 | Integration test: full flow (portal → metronome → claim → verdict) | AI | ⏳ Pending | 2.6 | End-to-end works |
| 2.9 | API documentation (OpenAPI/Swagger) | AI | ⏳ Pending | 2.8 | `docs/api-spec.yaml` |
| 2.10 | Deploy backend to homelab (Docker, Portainer stack, proxynet) | AI | ⏳ Pending | 2.8 | Backend live at `api.atmyhome.tech` |

**Milestone 2:** Backend judge + metronome + portal live, all tests passing, deployed on homelab.

---

### PHASE 3: FLUTTER CLIENT (Week 3-5, Days 15-30)

| ID | Task | Owner | Status | Dependencies | Deliverable |
|----|------|-------|--------|--------------|-------------|
| 3.1 | Initialize Flutter project in `/app` | Team | ⏳ Pending | 2.9 | `pubspec.yaml` with all deps |
| 3.2 | Implement hardware UUID (Gate 1): `flutter_secure_storage` + KeyStore/Keychain | Team | ⏳ Pending | 3.1 | UUID persists across reinstalls |
| 3.3 | Implement Cristian's Algorithm time sync (Gate 4 prep) | Team | ⏳ Pending | 3.2 | `DriftOffset` calculated on boot |
| 3.4 | Pre-check UI (4 checkpoints: HW, Time, Biometric, Env) | Team | ⏳ Pending | 3.3 | Visual loading screen with checkmarks |
| 3.5 | Implement biometric flesh lock (Gate 2): `local_auth` | Team | ⏳ Pending | 3.4 | Camera opens only after OS auth |
| 3.6 | Implement QR scanner (Gate 3): `mobile_scanner` at 30fps | Team | ⏳ Pending | 3.5 | Scans 3s rotating token |
| 3.7 | Implement HMAC wax seal + packet assembly (Gate 4) | Team | ⏳ Pending | 3.3, 3.6 | `assembleVerificationPacket` matches SRS |
| 3.8 | Result UI per state machine (PRESENT / HW mismatch / Stream / Forged / Expired) | Team | ⏳ Pending | 3.7 | Visual feedback for each case |
| 3.9 | Test on physical Android device (real hardware, real camera) | Team | ⏳ Pending | 3.8 | **Must work on real phone** |
| 3.10 | Test all 6 attack vectors from SRS matrix on device | Team | ⏳ Pending | 3.9 | Videos/screenshots of each |

**Milestone 3:** Flutter app runs on physical device, implements all 4 gates + pre-check, passes SRS attack matrix.

---

### PHASE 4: INTEGRATION & DEMO READINESS (Week 5-6, Days 31-40)

| ID | Task | Owner | Status | Dependencies | Deliverable |
|----|------|-------|--------|--------------|-------------|
| 4.1 | End-to-end class flow smoke test (prof → QR twitch → scan → verdict) | Team + AI | ⏳ Pending | 2.10, 3.9 | Full flow works in classroom |
| 4.2 | **Power-Cut Drill #2** — Full outage during demo, verify recovery | Team | ⏳ Pending | 1.9, 4.1 | Documented: DB intact, backups load, <2min recovery |
| 4.3 | Load test: 70 concurrent claims on i3-6000T / 8GB | AI | ⏳ Pending | 2.5, 4.1 | P99 latency, error rate documented |
| 4.4 | Security review vs SRS state matrix (all 6 vectors) | AI | ⏳ Pending | 2.7, 3.10 | No regressions |
| 4.5 | Performance tuning (Postgres, Node pool, Flutter frame rate) | AI | ⏳ Pending | 4.3 | Meets latency budgets |
| 4.6 | Demo script + fallback story ("power dies during demo") | Team | ⏳ Pending | 4.2 | Written script, backup plan |
| 4.7 | Record demo video (prof portal + student app) | Team | ⏳ Pending | 4.1 | 2-3 min video for submission |
| 4.8 | Architecture diagram update (actual vs planned) | AI | ⏳ Pending | 4.5 | `docs/architecture-final.svg` |

**Milestone 4:** Demo-ready, load-tested, power-cut resilient, documented.

---

### PHASE 5: POLISH & SUBMISSION (Week 6-7, Days 41-48)

| ID | Task | Owner | Status | Dependencies | Deliverable |
|----|------|-------|--------|--------------|-------------|
| 5.1 | Final SRS ↔ implemented traceability matrix | Team | ⏳ Pending | 4.4 | `docs/traceability.md` |
| 5.2 | Clean up code (lint, format, remove debug, add comments) | Team | ⏳ Pending | 4.8 | Clean repo |
| 5.3 | Write project report (architecture, constraints, results, homelab challenges) | Team | ⏳ Pending | 5.1 | `REPORT.md` or PDF |
| 5.4 | Prepare presentation slides (10 min + 5 min Q&A) | Team | ⏳ Pending | 5.3 | `presentation.pdf` |
| 5.5 | Final repo tag `v1.0-demo` | AI | ⏳ Pending | 5.2 | Git tag on Gitea |
| 5.6 | Backup final DB + code to 500GB WD | AI | ⏳ Pending | 5.5 | Disaster recovery ready |

**Milestone 5:** Submission-ready, all docs complete, repo tagged.

---

## GANTT-STYLE TIMELINE

```
Week 1 (Aug 6-12):    ████ Phase 0 (Foundation) ████ ████ Phase 1 (DB) ███
Week 2 (Aug 13-19):   ████ Phase 1 cont. ████ ████ Phase 2 (Backend) ███
Week 3 (Aug 20-26):   ████████████ Phase 2 complete ████ Phase 3 (Flutter) ███
Week 4 (Aug 27-Sep 2): ████████████████ Phase 3 ██████████████████████
Week 5 (Sep 3-9):     ██████ Phase 3 wrap ██████ Phase 4 (Integration) ████
Week 6 (Sep 10-16):   ██████████ Phase 4 ██████████ Phase 5 (Polish) ████
Week 7 (Sep 17-23):   ██████████ Phase 5 ████████████████████████████
```

---

## RESPONSIBILITY MATRIX (RACI)

| Task Area | AI Assistant | Team Member 1 | Team Member 2 | Team Member 3 |
|-----------|--------------|---------------|---------------|---------------|
| Repo/Git/Infra | **R** | A | C | C |
| Supabase/DB | **R** | A | C | I |
| Backend (Node/TS) | **R** | C | **R** | C |
| Flutter App | C | **R** | **R** | A |
| Testing/Attack Vectors | **R** | C | **R** | **R** |
| Docs/Report | **R** | A | C | C |
| Demo/Video | C | **R** | **R** | A |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

---

## DEFINITION OF DONE (per phase)

| Phase | Criteria |
|-------|----------|
| 0 | Repo on Gitea, all foundation docs, team can clone, CI/CD pipeline skeleton |
| 1 | Supabase on homelab, schema applied, backups automated & tested, survives power cut |
| 2 | Backend API + metronome + portal deployed, all 6 attack vector tests pass |
| 3 | Flutter app on physical device, all 4 gates + pre-check work, passes attack tests |
| 4 | E2E flow works, load test passes, power-cut drill #2 passes, demo script ready |
| 5 | Report, slides, video, tagged release, final backup complete |

---

## RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Power cut corrupts DB | High | Critical | fsync=on, nightly backups, power-cut drills, SSD bind-mount |
| 8GB RAM OOM kills containers | Medium | High | Memory limits on all containers, swap enabled, monitoring |
| Flutter biometric fails on some devices | Medium | High | Test on 3+ devices, fallback to PIN if biometric unavailable |
| Network latency >250ms on campus WiFi | Medium | High | Test on real campus WiFi, tune threshold if needed |
| Team member unavailable | Medium | Medium | Cross-train, pair programming, documented handoffs |
| Supabase version incompatibility | Low | High | Pin exact image versions, test upgrades in staging |

---

## SUCCESS METRICS

| Metric | Target |
|--------|--------|
| False accept rate (stream/photo) | 0% (per SRS 250ms window) |
| False reject rate (honest student) | <1% |
| P99 claim latency (70 concurrent) | <500ms |
| Power-cut recovery time | <2 minutes |
| Demo uptime | 100% during presentation |
| Code coverage (backend) | >80% |
| All 6 SRS attack vectors blocked | ✅ Verified |

---

## NEXT IMMEDIATE ACTIONS (Today/Tomorrow)

1. **Push PROJECT_PLAN.md to Gitea** — I'll do this now
2. **Team reviews plan** — Add comments/suggestions in Gitea issues
3. **Finalize schema** — Any changes to `migrations/001_schema.sql`?
4. **Apply schema to live Supabase** — I'll run the migration
5. **Start Phase 2 (Backend)** — Initialize Node/TS project

---

## HOW TO TRACK PROGRESS

- **Gitea Issues:** One issue per task ID (e.g., `#1.2 Apply schema`)
- **Project Board:** Kanban columns: Backlog → Ready → In Progress → Review → Done
- **Daily Standup (async):** Post in Gitea issue comments or Telegram
- **Weekly Review:** Sunday evening, update this plan with actuals

---

## APPENDIX: COMMANDS I'LL RUN FOR YOU

### Database Management
```bash
# Apply migration
docker exec supabase-db psql -U supabase_admin -d postgres -f /migrations/001_schema.sql

# Query attendance
docker exec supabase-db psql -U supabase_admin -d postgres -c "SELECT * FROM attendance_ledger;"

# Backup now
docker exec supabase-db pg_dump -U postgres postgres > /tmp/backup_$(date +%Y%m%d).sql
```

### Backend Deploy
```bash
# Build & deploy backend stack via Portainer
docker build -t attendance-backend ./backend
docker compose -f deploy/backend/docker-compose.yml up -d
```

### Flutter Build
```bash
cd app && flutter build apk --release
```

---

*This plan is a living document. Update it as we learn. The goal is not to follow it perfectly, but to have a shared map so we never wonder "what's next?"*

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-06  
**Next Review:** 2026-08-07 (tomorrow)