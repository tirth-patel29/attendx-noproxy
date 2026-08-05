# Zero-Trust Cryptographic Attendance Gateway

A college **software-group project**: a self-hosted attendance system that cryptographically
proves a student is physically in the classroom at scan time — beaten only by the speed of
light and the laws of video codecs.

- **Client**: Flutter (4 security gates + pre-check UI)
- **Backend**: Node/TypeScript (metronome + judge + REST/WS)
- **Data**: Self-hosted Supabase (Postgres + Auth + Realtime)
- **Deployment**: homelab (8GB RAM, power-cut-prone) via Portainer + proxycore

> **Started**: 2026-08-05 · **Master blueprint**: `docs/` (SRS) · **Why**: `CONTEXT.md`

---

## TL;DR — how it works

1. Prof opens the **portal**, picks a course, hits **START**.
2. Server mints a **random token every 3s** and pushes it over WebSocket to a live QR.
3. Student opens the **app** → pre-check (hardware + time-sync + biometric) → scans QR.
4. App HMAC-signs `rollNo + trueObservedTime`, sends it with the hardware key.
5. Server verifies **4 gates**; if the observed-vs-token delta is `≤250ms`, mark **PRESENT**.

## Repo layout

See `CONTEXT.md §6`. Fastest map:

| Path | What |
|---|---|
| `CONTEXT.md` | Full context: gates, stack, **homelab constraints** |
| `ROADMAP.md` | Milestones & next steps |
| `docs/` | SRS + architecture + ops |
| `migrations/` | Postgres schema |
| `deploy/supabase/` | Self-hosted Supabase compose tuned for 8GB + backups |
| `backend/` | Node/TS judge + metronome + portal |
| `app/` | Flutter client |
| `scripts/` | Homelab ops (backup, status, restart) |

## Quickstart (local dev)

```bash
# 1. Backend
cd backend && npm install && npm run dev

# 2. Database (dev: any Postgres or local Supabase)
#    Dev defaults via .env.example

# 3. Flutter app
cd app && flutter pub get && flutter run
```

## Running on the homelab

Everything power-cut-aware is in `deploy/`. See `deploy/supabase/README.md` and
`ROADMAP.md` for the exact bring-up and restart-after-blackout steps.

---

## Contributing (group protocol)

- Branch per feature: `feat/<what>`
- Every change must state its **homelab impact** (RAM/mem, power-cut behavior, backup).
- Schema changes go in `migrations/` with an up/down pair.
- See `docs/CONTRIBUTING.md` (to be written) and `ROADMAP.md`.

## Status

**Phase 0 — Foundation** (in progress): repo scaffold, CONTEXT, ROADMAP, deploy baseline,
SRS ingest. See `ROADMAP.md`.
