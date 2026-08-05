# Supabase self-host deployment — homelab ops guide

This directory is the **power-cut-aware** baseline for running Supabase on the
attendance-gateway homelab.

## Why this shape (short version)

The default `supabase/docker` stack ships Studio, Analytics, Vector, Functions, etc.
On an **8GB box already running 7 other stacks**, that is too heavy and wastes RAM we
don't have. This baseline is **minimal**:

- **db** (Postgres 15) — the source of truth
- **kong** — one entrypoint/routing
- **auth** (GoTrue) — the Auth service
- **rest** (PostgREST) — auto-REST from schema
- **realtime** — the realtime/WebSocket channel (the 3s metronome)

RAM cap for the whole stack ≈ **3GB max**, DB pinned to 1.5GB on one core, so the rest
of the homelab (proxycore, arr, hermes/Gitea, etc.) keeps breathing.

## One-time bring-up

```bash
cd deploy/supabase
cp .env.example .env          # then fill in secrets
docker network create proxycore   # run once, only if it doesn't exist
docker compose --env-file .env -p supabase up -d
docker compose --env-file .env -p supabase ps   # inspect
```

Attach it to your existing `proxycore` network so the reverse proxy / cloudflared can
route `supabase.atmyhome.tech` straight to `kong:8000`.

## Exposing it (proxycore)

Add a proxy host in the NPM web UI:

- Domain: `supabase.atmyhome.tech`
- Forward: `supabase-kong` (service name) : `8000`
- TLS: full (cert via cloudflared / Cloudflare tunnel)

**Always forward by the docker service/container NAME, never a fixed IP** — container
IPs are assigned on restart and will change during power cuts.

## Power-cut routine (IMPORTANT — read this)

### After any unexpected reboot
1. SSH in: `ssh <user>@<tailscale-ip>` (Tailscale).
2. Check docker: `docker ps` — confirm all 8 stacks + the `supabase` stack are back.
3. If `supabase` isn't up: `docker compose --env-file .env -p supabase start`.
4. Verify DB: `docker exec supabase-db pg_isready -U postgres`.
5. Spot-check `kong` responds: `curl -I http://localhost:8000`.

Because every service is `restart: unless-stopped` and Postgres is `restart: always`,
after the host boots and Docker starts, everything should come back on its own.

### What we do NOT do
- We **do not** run `postgres` with `fsync=off` / `synchronous_commit=off` just to be
  faster. On a power-cut-prone box that risks corrupting the only copy of the data.
  Durable > fast here.

## Backups (nightly → 500GB WD)

Run `scripts/backup.sh` from the repo root on a cron. It dumps the DB and copies a
rotating set to the WD mount (`/mnt/wd` is a suggested mountpoint; adjust in the script).

```bash
# crontab -e  (as the docker user)
30 2 * * *  /workspace/attendance-gateway/scripts/backup.sh >> /var/log/attendance-backup.log 2>&1
```

Backups are your real safety net for a power cut that *also* corrupts the SSD. Keep at
least 7 daily + 4 weekly.

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | The stack (this file) |
| `.env.example` | All secrets/keys to fill in |
| `volumes/api/kong.yml` | Kong route declarations |
| `../migrations/` | Postgres schema applied on first DB boot |

> **TODO (Phase 1)**: pin exact image tag versions, write the ledger/demo seed data, and
> add a `watchtower`-style auto-update *only if* we accept the risk — on a power-cut box,
> auto-updating Postgres unattended is usually a bad idea. Prefer manual pinned upgrades.
