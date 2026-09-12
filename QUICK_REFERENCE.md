# QUICK REFERENCE — Attendance Gateway

**Production Environment:** Dedicated AWS EC2 (~7 GB RAM, 2 vCPUs) + EBS gp3 SSD  
**Architecture:** Host Caddy (Auto-SSL) ➔ Docker Containers (`backend:3001`, `teacher:3010`, `admin:3020`) + Supabase PostgreSQL  
**Live Production Endpoints:**
- **API Server:** `https://api.atmyhome.tech` (4-gate judge + metronome + Admin API + Swagger UI at `/docs`)  
- **Admin Console:** `https://admin.atmyhome.tech` (React/Vite — faculty departments, students/HMAC, academic hierarchy, batches, timetable, API keys)  
- **Teacher Portal:** `https://portal.atmyhome.tech` (React/Vite — timetable schedule, dual-state projector QR, real-time attendance ledger stream)  

**Production Quick Deploy:**
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ports.yml up -d --build
```

**Admin Bootstrap:** Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.production` for initial boot; once initialized, unset `ADMIN_PASSWORD` so that in-app password rotations remain persistent.

**Token protocol (SRS):** 4-char base62 rotating token every 3s · 250ms Stream Kill-Window (`0 ≤ observed − birth ≤ 250ms`) · dual-state classroom projector (2.9s static anchor `ATTN:<session_uuid>` + 100ms flash `TOKEN:<token_val>`) · tokens are **NOT consumed** (whole class shares each token; ledger UNIQUE(session, student) prevents double-marking) · status codes: PRESENT 200, HARDWARE_MISMATCH 403, STREAM_DETECTED/EXPIRED_TOKEN 412, FORGED_RESPONSE 401, INVALID_CLAIM 404 · nonces come from `/sessions/:uuid/challenge` (single-use, server-issued).

**Provisioning (mobile):** `POST /api/v1/provision` with `roll_no` + admin-issued 64-char HMAC secret + device hash (SRS "Blood Oath"). Verify with `scripts/live_flow_test.py "<admin-password>"` (25 live checks).

**Student self-registration (charusat identity):**
| Endpoint | Purpose |
|---|---|
| `POST /api/v1/student/status` `{id}` | exists? has_password? |
| `POST /api/v1/student/register` `{id,name,password}` | self-register (email auto `id@charusat.edu.in`), returns student JWT |
| `POST /api/v1/student/login` `{id,password}` | login → student JWT (30d) |
| `POST /api/v1/student/password/set` `{id,new_password}` | first-time / post-forgot password set |
| `POST /api/v1/student/device/bind` (JWT) `{device_id_hash}` | **mints HMAC signer + binds device** (Gate 1 + Gate 4 at once), returns secret to KeyStore |
| Admin: `POST /admin/students/:uuid/forgot-password` | clears hash → app shows set-password screen |
| Admin: `GET /admin/students` | now returns `has_password`; search in UI |

**Teacher ownership (fundamental auth fix):** `POST /sessions/start`, `GET /sessions`, `GET/POST /sessions/:id`, `POST /sessions/:id/stop`, `GET /sessions/:id/attendance` all require the professor JWT and are scoped to it — `prof_uuid` in the request body is IGNORED (identity comes from the token). Teacher views: `GET /professor/timetable` (today + week, returns `batch_id` and `batch_name`) and `GET /professor/summary` (per-subject analytics).

---

## ADMIN CONSOLE (top of the database)

**Login:** `POST /api/v1/admin/login` (JWT `role: 'admin'`) · refresh `POST /api/v1/admin/login/refresh`

Protected routes (all under `/api/v1/admin/`, require `Authorization: Bearer <admin-jwt>`):
| Resource | Endpoints | Notes |
|----------|-----------|-------|
| Stats | `GET /stats` | Active sessions, student counts, verification health |
| Teachers (professors) | `GET/POST /teachers`, `PUT/DELETE /teachers/:uuid`, `POST /teachers/:uuid/reset-password` | Supports `department_id` academic department mapping |
| Students | `GET/POST /students`, `GET/PUT/DELETE /students/:uuid`, `POST /students/:uuid/reset-device`, `POST /students/:uuid/rotate-hmac` | Hardware lock reset unbinds device + rotates HMAC |
| Academic Colleges | `GET/POST /academic/colleges`, `PUT/DELETE /academic/colleges/:id` | e.g. DEPSTAR, CSPIT, BDPIAS |
| Academic Departments | `GET/POST /academic/departments`, `PUT/DELETE /academic/departments/:id` | e.g. Engineering, Pharmacy |
| Academic Branches | `GET/POST /academic/branches`, `PUT/DELETE /academic/branches/:id` | e.g. DCE, DCS |
| Academic Divisions | `GET/POST /academic/divisions`, `PUT/DELETE /academic/divisions/:id` | e.g. CE 3rd Year |
| Academic Batches | `GET/POST /academic/batches`, `PUT/DELETE /academic/batches/:id` | e.g. CE1, start_roll: 24DCE001, end_roll: 24DCE075 |
| Courses | `GET/POST /courses`, `PUT/DELETE /courses/:code` | |
| Timetable (Assignments) | `GET/POST /assignments`, `PUT/DELETE /assignments/:id` | Supports `batch_id`: `null` = Theory (All Batches), UUID = Lab |
| API Keys | `GET/POST /keys`, `DELETE /keys/:uuid` | Mints `X-Api-Key` tokens for client access |

**Security-sensitive ops** (`reset-device`, `rotate-hmac`, password resets, deletes) write an
append-only `audit_logs` row. `reset-device` **unbinds the hardware tattoo AND rotates the
Gate-4 HMAC** so the old device is permanently locked out — the student re-provisions.

**Re-deploy:** `cd /home/hetp/docker-stacks/attendance-admin && CACHE_BUST=$(date +%s) docker compose up -d --build`

---

## KEY COMMANDS (I run these for you)

### Database
```bash
# Apply migration
docker exec supabase-db psql -U supabase_admin -d postgres -f /migrations/001_schema.sql

# Query attendance
docker exec supabase-db psql -U supabase_admin -d postgres -c "SELECT * FROM attendance_ledger;"

# Backup now
docker exec supabase-db pg_dump -U postgres postgres > /tmp/backup_$(date +%Y%m%d).sql

# Check DB status
docker exec supabase-db psql -U supabase_admin -d postgres -c "\l"
```

### Supabase Stack
```bash
# View logs
docker logs supabase-auth --tail 20
docker logs supabase-realtime --tail 20

# Restart service
docker restart supabase-auth supabase-realtime

# Full stack status
docker ps --filter name=supabase --format "table {{.Names}}\t{{.Status}}"
```

### Backend (when deployed)
```bash
# Build
docker build -t attendance-backend ./backend

# Deploy via compose
docker compose -f deploy/backend/docker-compose.yml up -d

# Logs
docker logs attendance-backend --tail 50
```

### Flutter
```bash
cd app && flutter pub get
cd app && flutter run
cd app && flutter build apk --release
```

---

## TASK TEMPLATE (create issue in Gitea)
```
Phase: 1
Task ID: 1.2
Description: Apply schema migration to live Supabase

Acceptance Criteria:
- [ ] students table created
- [ ] professors table created
- [ ] attendance_ledger table created
- [ ] indices created

Homelab Impact:
- RAM delta: 0
- Power-cut behavior: No change
- Backup impact: Schema migration — re-backup after
- Rollback plan: Restore from pre-migration backup
```

---

## PHASE STATUS (as of 2026-08-06)

| Phase | Status | Next Action |
|-------|--------|-------------|
| 0 Foundation | ✅ **COMPLETE** | — |
| 1 Database/Schema | ✅ **COMPLETE** | — |
| 2 Backend | ✅ **COMPLETE** | — |
| 3 Flutter Client | 🔄 **SCAFFOLD COMPLETE** | Build APK on teammate laptop, test on physical device |
| 4 Professor Teacher | ✅ **DEPLOYED** | `https://teacher.atmyhome.tech` live |
| 5 Integration | ⏳ | End-to-end test with live backend |
| 6 Hardening | ⏳ | Power-cut drill #2, load test |
| 7 Polish | ⏳ | Demo prep |

---

## IMMEDIATE NEXT STEPS (Tomorrow)

1. **Team reviews Flutter scaffold** on Gitea
2. **Teammate builds APK** on their laptop:
   ```bash
   git clone http://gitea:3000/het/attendance-gateway.git
   cd attendance-gateway/app
   flutter pub get
   flutter build apk --release
   ```
3. **Test on physical Android device** — scan QR from live backend at `api.atmyhome.tech`
4. **End-to-end integration test** — professor starts session, student scans, verdict PRESENT
5. **Run Power-Cut Drill #1** — force reboot homelab, verify DB + backups

---

## CONTACT / ESCALATION

- **Architecture questions:** Ask in Gitea issue, tag @AI
- **Urgent (prod down):** Telegram team lead
- **Blocked >30 min:** Pair program, open `help wanted` issue

---

*Keep this file updated. It's the team's dashboard.*