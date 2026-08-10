# QUICK REFERENCE — Attendance Gateway

**Repo:** `het/attendance-gateway` on Gitea (`http://gitea:3000/het/attendance-gateway`)  
**Clone:** `git clone http://gitea:3000/het/attendance-gateway.git`  
**Supabase:** `https://supabase.atmyhome.tech` (all 7 services healthy)  
**Backend API:** `https://api.atmyhome.tech` (4-gate judge + metronome + **Admin API**)  
**Admin Console:** `https://admin.atmyhome.tech` (React/MUI — manage teachers, students/HMAC, divisions, courses, timetable)  
**Professor Portal:** `https://portal.atmyhome.tech` (React/MUI — dumb-terminal projector)  
**Homelab SSH:** `hetp@192.168.0.108` (port 22) → `su -` for root (pass: 7567@Hetp)

**Default Admin seed:** `admin@atmyhome.tech` / `Admin@123` (CHANGE after first login — env-driven bootstrap: `ADMIN_EMAIL`/`ADMIN_PASSWORD` upsert on every boot; remove `ADMIN_PASSWORD` env to keep in-app changes)**

**Token protocol (SRS):** 4-char base62 rotating token every 3s · 250ms Stream Kill-Window (`0 ≤ observed − birth ≤ 250ms`) · tokens are **NOT consumed** (whole class shares each token; ledger UNIQUE(session, student) prevents double-marking) · status codes: PRESENT 200, HARDWARE_MISMATCH 403, STREAM_DETECTED/EXPIRED_TOKEN 412, FORGED_RESPONSE 401, INVALID_CLAIM 404 · nonces come from `/sessions/:uuid/challenge` (single-use, server-issued).

**Provisioning (mobile):** `POST /api/v1/provision` with `roll_no` + admin-issued 64-char HMAC secret + device hash (SRS "Blood Oath"). Verify with `scripts/live_flow_test.py "<admin-password>"` (20 live checks).

---

## ADMIN CONSOLE (top of the database)

**Login:** `POST /api/v1/admin/login` (JWT `role: 'admin'`) · refresh `POST /api/v1/admin/login/refresh`

Protected routes (all under `/api/v1/admin/`, require `Authorization: Bearer <admin-jwt>`):
| Resource | Endpoints |
|----------|-----------|
| Stats | `GET /stats` |
| Teachers (professors) | `GET/POST /teachers`, `PUT/DELETE /teachers/:uuid`, `POST /teachers/:uuid/reset-password` |
| Students | `GET/POST /students`, `GET/PUT/DELETE /students/:uuid`, `POST /students/:uuid/reset-device`, `POST /students/:uuid/rotate-hmac` |
| Divisions | `GET/POST /divisions`, `PUT/DELETE /divisions/:uuid` |
| Courses | `GET/POST /courses`, `PUT/DELETE /courses/:code` |
| Timetable | `GET/POST /assignments`, `PUT/DELETE /assignments/:id` |

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
| 4 Professor Portal | ✅ **DEPLOYED** | `https://portal.atmyhome.tech` live |
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