# Deployment — portable Docker, nginx as infrastructure only

This project ships **portable Docker images**. Nothing in the code or images is
hardcoded to this homelab; the current infrastructure is only a set of default
environment values.

## The three apps

| App | Source | Image | Default port |
|-----|--------|-------|--------------|
| Backend (API + judge + metronome + admin API) | `backend/` | `attendance-backend` | 3001 |
| Professor Teacher (React/Vite) | `teacher/` | `attendance-teacher` | 3000 |
| Admin Console (React/Vite) | `admin/` | `attendance-admin` | 3000 |

## Option A — standalone server (no reverse proxy)

```bash
# 1. Point the backend at ANY PostgreSQL (Supabase, RDS, self-hosted)
export DB_HOST=db.example.com DB_PORT=5432 DB_NAME=attendance
export DB_USER=attendance DB_PASSWORD='change-me'
export JWT_SECRET=$(openssl rand -hex 32)

# 2. Bootstrap the admin account reliably on every boot
export ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='S3cure!'

# 3. Build + run (exposes ports via the ports override)
docker compose -f docker-compose.yml -f docker-compose.ports.yml up -d --build
```

- Teacher: `http://localhost:3000` — backend `/api` + `/socket.io` proxied by nginx.
- Admin: `http://localhost:3002` (port override).
- Backend: `http://localhost:3001` (health `/health`).

## Option B — behind an nginx-proxy / docker-gen (this homelab)

Each stack lives in its own directory next to its source
(`/home/hetp/docker-stacks/attendance-*`) with `deploy/<app>/docker-compose.yml`:

```bash
cd <stack-dir>
CACHE_BUST=$(date +%s) docker compose up -d --build
```

Set `VIRTUAL_HOST=<your.domain>` and the docker-gen reverse proxy routes by
container label. The nginx config is generated from `nginx.conf.template` by the
official nginx entrypoint (envsubst) — the **only** knob is
`BACKEND_UPSTREAM` (default `attendance-backend:3001`).

## Key environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DB_HOST/PORT/NAME/USER/PASSWORD/SSL` | PostgreSQL connection | — |
| `CORS_ORIGIN` | Comma-separated allowed origins (Express + Socket.IO) | empty (= same-origin ok) |
| `JWT_SECRET` | Token signing secret | dev value (change!) |
| `ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME` | Reliable admin upsert on boot | — |
| `METRONOME_INTERVAL_MS` | Token rotation period (SRS: 3000) | 3000 |
| `METRONOME_TOKEN_LENGTH` | Token length (SRS: 4) | 4 |
| `METRONOME_TOKEN_CHARSET` | base62 charset | A-Za-z0-9 |
| `JUDGE_MAX_LATENCY_MS` | The 250ms Stream Kill-Window | 250 |
| `BACKEND_UPSTREAM` | nginx `proxy_pass` target for teacher/admin | `attendance-backend:3001` |
| `VIRTUAL_HOST_*` | docker-gen routing labels | — |

> **Note on `ADMIN_PASSWORD`:** when set, the backend **re-rotates** the admin
> password to this value on every boot — so it overrides any password changed in
> the Admin Console UI. For production: bootstrap once with the env vars, then
> **remove `ADMIN_PASSWORD` from the environment** so UI-changed passwords stick.
> (The admin can always rotate it in-app via *Account → Change password*.)

## Rebuild → deploy cycle (any app)

```bash
# code change → build image → recreate container
cd attendance-gateway            # this repo
# sync changed source to the stack dir (or build from the repo directly in Option A)
CACHE_BUST=$(date +%s) docker compose up -d --build <service>
```

## Mobile client

The Flutter app is built against any backend via a compile-time define:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com
```

### ⚠️ Android biometrics (Gate 2) — REQUIRED platform fix
`local_auth` only works on Android if the host activity extends
`FlutterFragmentActivity` (a plain `FlutterActivity` throws and the fingerprint
prompt never appears — symptom: "biometric doesn't ask, error after scanning QR").

Generate the platform folders once and commit them (also required for CI):

```bash
cd app
flutter create .                          # creates android/ ios/ etc.
# then edit android/app/src/main/kotlin/**/MainActivity.kt:
```

```kotlin
// androidx.activity requires androidx-activity; io.flutter requires 2.x
import io.flutter.embedding.android.FlutterFragmentActivity
class MainActivity : FlutterFragmentActivity()
```

`android/app/src/main/AndroidManifest.xml`:

```xml
<manifest ...>
    <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
    <application ...>
      <activity android:name=".MainActivity"
                android:exported="true"
                android:launchMode="singleTop"
                android:theme="@style/LaunchTheme">
      ...
```

(Target SDK 31+ removes the need for a separate `USE_FINGERPRINT`; keep
`USE_BIOMETRIC`.)

### QR payload grammar (Subliminal Micro-Twitch, Gate 3)
The projector alternates two frames; the app's scanner filter-gate hunts for the
**flash only**:
- STATE A (anchor, 2900ms): `ATTN:<session_uuid>` — the app IGNORES these.
- STATE B (flash, 100ms): `ATTN:<session_uuid>:<token>` — FLASH CAUGHT → scan,
  apply drift + HMAC, POST.
Deliberately no REST re-poll of the token on the client (would break the HMAC).

## Note on the homelab-specific wiring

The current deployment additionally uses:
- an external docker network (`proxynet`) shared with the reverse proxies,
- `nginx-proxy-ondemand` labels for wake-on-demand,
- Cloudflare tunnel → Nginx Proxy Manager → `arr-proxy` (docker-gen) → container.

All of that lives in deployment files (`deploy/*/docker-compose.yml`) and env
values only — never in application code.