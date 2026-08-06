# QUICK REFERENCE — Attendance Gateway

**Repo:** `het/attendance-gateway` on Gitea (`http://gitea:3000/het/attendance-gateway`)  
**Clone:** `git clone http://gitea:3000/het/attendance-gateway.git`  
**Supabase:** `https://supabase.atmyhome.tech` (all 7 services healthy)  
**Backend API:** `https://api.atmyhome.tech` (4-gate judge + metronome)  
**Professor Portal:** `https://portal.atmyhome.tech` (React/MUI dashboard)  
**Homelab SSH:** `ssh hetp@<tailscale-ip>` (port 22) → `su -` for root (pass: 7567@Het)

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