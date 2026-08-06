# QUICK REFERENCE — Attendance Gateway

**Repo:** `het/attendance-gateway` on Gitea (`http://gitea:3000/het/attendance-gateway`)  
**Clone:** `git clone http://gitea:3000/het/attendance-gateway.git`  
**Supabase:** `https://supabase.atmyhome.tech` (all 7 services healthy)  
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
| 1 Database/Schema | 🔄 **IN PROGRESS** | Postgres tuning + backup setup + power-cut drill |
| 2 Backend | ⏳ Waiting | Start after Phase 1 |
| 3 Flutter | ⏳ Waiting | Start after Phase 2 |
| 4 Integration | ⏳ Waiting | — |
| 5 Polish | ⏳ Waiting | — |

---

## IMMEDIATE NEXT STEPS (Tomorrow)

1. **Team reviews PROJECT_PLAN.md** on Gitea
2. **Postgres 8GB tuning** (shared_buffers=384MB, work_mem=16MB, max_conn=100)
3. **Set up nightly backup cron** (02:30 → 500GB WD)
4. **Test backup restore** (spin up test DB from dump)
5. **Power-Cut Drill #1** — force reboot, verify recovery
6. **Start Phase 2** — initialize Node/TS backend

---

## CONTACT / ESCALATION

- **Architecture questions:** Ask in Gitea issue, tag @AI
- **Urgent (prod down):** Telegram team lead
- **Blocked >30 min:** Pair program, open `help wanted` issue

---

*Keep this file updated. It's the team's dashboard.*