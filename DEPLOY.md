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

## Production Deployment (AWS EC2 / Cloud VM with ~7 GB RAM)

AttendX is designed to run in production on an **AWS EC2 instance (e.g., t3.large or t4g.large with 2 vCPUs and 8 GB / ~7 GB usable RAM)** or any equivalent cloud VPS with an attached EBS gp3 SSD volume.

### 1. Architecture on EC2

```text
[ Students / Teachers / Admin ]
               │
               ▼ (HTTPS: 443 / WSS)
    [ Host Nginx + Let's Encrypt SSL ]
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
:3001       :3000       :3002
(Backend)  (Teacher)    (Admin)
   │
   ▼
[ PostgreSQL / Supabase Container ]
   (Tuned for ~7 GB memory on SSD)
```

- **Security Groups:** Expose only **Port 80 (HTTP)**, **Port 443 (HTTPS)**, and **Port 22 (SSH - restricted to your IP/Bastion)** to the public internet. Ports 3000, 3001, 3002, and 5432 should remain bound to `127.0.0.1` and accessed only via the local Nginx reverse proxy.
- **Persistent Storage:** Attach an AWS EBS (gp3) volume mounted at `/var/lib/docker` or directly bound to the database volume.

---

### 2. PostgreSQL Tuning for 7 GB RAM (Production)

With ~7 GB dedicated RAM available to the host, PostgreSQL can be tuned to cache the active attendance working set in RAM while utilizing SSD I/O parallelism:

| Parameter | 7 GB Production Setting | Rationale |
|---|---|---|
| `shared_buffers` | `1792MB` | Allocates ~25% of RAM directly to the Postgres page buffer cache. |
| `effective_cache_size` | `5120MB` | Informs query planner that ~70% of memory is available for caching. |
| `work_mem` | `32MB` | Faster in-memory sorts and hash joins for roster queries. |
| `maintenance_work_mem` | `256MB` | Accelerates index builds, VACUUM, and cleanup functions. |
| `max_connections` | `100` | Ample headroom for backend pooling and admin connections. |
| `wal_buffers` | `16MB` | Buffers WAL writes to prevent I/O bottlenecks during mass check-ins. |
| `checkpoint_completion_target` | `0.9` | Smooths out disk writes over time on EBS gp3. |
| `random_page_cost` | `1.1` | Tells planner fast random reads are available on SSD. |
| `effective_io_concurrency` | `200` | Leverages SSD concurrent I/O capabilities. |

If running Postgres in Docker, pass these flags in `command:` or inside your `postgresql.conf`:
```bash
postgres -c shared_buffers=1792MB -c effective_cache_size=5120MB -c work_mem=32MB \
         -c maintenance_work_mem=256MB -c max_connections=100 -c wal_buffers=16MB \
         -c checkpoint_completion_target=0.9 -c random_page_cost=1.1 -c effective_io_concurrency=200
```

---

### 3. Deploying with Docker Compose on EC2

Create your production environment file `.env.production`:

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=attendance
DB_USER=attendance
DB_PASSWORD=<GENERATE_A_STRONG_RANDOM_PASSWORD>
DB_SSL=false

# Security & Admin Bootstrap
JWT_SECRET=<GENERATE_A_64_CHAR_HEX_SECRET>
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<TEMPORARY_INITIAL_PASSWORD>
ADMIN_NAME="System Administrator"

# Verification & Metronome Settings
METRONOME_INTERVAL_MS=3000
METRONOME_TOKEN_LENGTH=4
JUDGE_MAX_LATENCY_MS=250
JUDGE_TOKEN_VALIDITY_WINDOW_MS=5000

# CORS & Domain Configuration
CORS_ORIGIN=https://teacher.yourdomain.com,https://admin.yourdomain.com,https://api.yourdomain.com
BACKEND_UPSTREAM=backend:3001
```

Launch the stack using the base compose file with the ports override:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ports.yml up -d --build
```

Verify that all containers are healthy:
```bash
docker compose ps
curl -s http://127.0.0.1:3001/health
```

> **Security Reminder:** Once the initial admin user is created on first boot, remove `ADMIN_PASSWORD` from `.env.production` so that any passwords rotated in the Admin Console remain persistent across container restarts.

---

### 4. Host Nginx Reverse Proxy & SSL Setup

Install Nginx and Certbot on your EC2 host:
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

Configure `/etc/nginx/sites-available/attendx`:

```nginx
# --- Backend API & Socket.IO ---
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# --- Teacher Portal (Projector & Live Sessions) ---
server {
    server_name teacher.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# --- Admin Console ---
server {
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and acquire Let's Encrypt certificates:
```bash
sudo ln -s /etc/nginx/sites-available/attendx /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com -d teacher.yourdomain.com -d admin.yourdomain.com
```

---

### 5. Automated Systemd Service on EC2

To ensure the stack boots automatically upon server reboot:

Create `/etc/systemd/system/attendx.service`:
```ini
[Unit]
Description=AttendX Docker Compose Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/attendx-noproxy
ExecStart=/usr/bin/docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ports.yml up -d
ExecStop=/usr/bin/docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ports.yml down

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable attendx.service
```

---

## Option B — Legacy Homelab Setup (Reference Only)

The original prototyping deployment ran on a local homelab behind `proxycore` and `cloudflared`.
Each stack lived in its own directory (`/home/hetp/docker-stacks/attendance-*`) with `deploy/<app>/docker-compose.yml`:

```bash
cd <stack-dir>
CACHE_BUST=$(date +%s) docker compose up -d --build
```

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