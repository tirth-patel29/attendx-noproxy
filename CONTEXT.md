# CONTEXT — Zero-Trust Cryptographic Student Attendance Gateway

> **One-paragraph framing**: This is a college software-group project that proves a student
> is physically in the classroom at the moment attendance is taken — not by trusting the
> phone (a phone can be spoofed, shared, or live-streamed), but by combining hardware
> binding, biometrics, a 3-second rotating visual token, and the physical speed limit of
> network physics. It is being **self-hosted on a homelab**, which shapes every deployment
> decision.

---

## 1. The problem we are solving

Traditional attendance apps trust the *client device*. That trust is the attack surface:

| Attack | How it's beaten |
|---|---|
| GPS spoofing | We don't use GPS at all — visual + crypto proof only |
| Static QR photo shared on WhatsApp | Token rotates every 3 seconds (Gate 3) |
| Live-streaming the board to a friend | 250ms cryptographic time window (Gate 4) |
| Logging in on someone else's phone | Hardware tattoo binding (Gate 1) |
| Friend carrying your phone for you | Biometric flesh check (Gate 2) |

**Core principle: Zero-Trust. We assume every student device is hostile and trying to
cheat. The system separates "in the room" from "in the hostel" using physics.**

## 2. The four gates (the verification pipeline)

1. **Gate 1 — Hardware tattoo**: On first launch the app generates a UUID and locks it in
   the Secure Enclave (KeyStore/Keychain). This `X-Device-HW-Key` is sent on every request;
   a mismatch → HTTP 403. *Kills account sharing.*
2. **Gate 2 — Biometric flesh lock**: `local_auth` asks the OS "is this thumb the phone's
   owner?" before the camera opens. *Kills the mule (proxy) attack.*
3. **Gate 3 — Visual micro-twitch**: server mints a random token every 3s and pushes it
   over WebSocket to the professor's projector QR. *Kills static/photographed QR.*
4. **Gate 4 — Crypto time-stamp (250ms kill window)**: app syncs its clock via Cristian's
   Algorithm, sets `TrueObservedTime = local + drift`, HMAC-SHA256-signs
   `RollNo + TrueObservedTime`, and the server rejects any token where
   `ObservedTime − TokenBirth > 250ms`. *Kills live streams — video codec + network +
   Moiré scan can't beat 250ms.*

## 3. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Mobile client | **Flutter / Dart** | `flutter_secure_storage`, `local_auth`, `mobile_scanner`, `crypto` |
| Backend judge + metronome | **Node.js / TypeScript** | WebSocket metronome, HMAC verification, REST API |
| Database + Auth + Realtime | **Supabase** (Postgres) | self-hosted on the homelab |
| Professor web teacher | React / plain TS dashboard | QR broadcast + attendance view + 1-click device reset |
| Reverse proxy + tunnel | proxycore (home) | NPM + on-demand proxy + cloudflared → `atmyhome.tech` |

## 4. Production Infrastructure: Dedicated AWS EC2 (~7 GB RAM)

> **Deployment Reality**: AttendX is deployed in production on a dedicated **AWS EC2 instance with ~7 GB RAM** (e.g. `t3.large` or `t4g.large`, 2 vCPUs) and AWS EBS (gp3) SSD storage.

### Production Environment Profile
- **Compute**: AWS EC2 instance (2 vCPUs, 8 GB / ~7 GB usable RAM)
- **Storage**: AWS EBS (gp3) SSD volume with automated snapshot capabilities
- **OS**: Ubuntu / Debian LTS (headless)
- **Reverse Proxy**: Host Nginx with Let's Encrypt (Certbot) TLS termination and WebSocket upgrade support
- **Domain**: Cloud-routed domain (e.g., `api.yourdomain.com`, `teacher.yourdomain.com`, `admin.yourdomain.com`)

### Performance & Architectural Advantages on EC2
1. **Dedicated ~7 GB Memory Pool**:
   - In production, memory is dedicated strictly to AttendX (`backend`, `teacher`, `admin`, and `postgres`).
   - PostgreSQL is tuned with `shared_buffers = 1792MB` and `effective_cache_size = 5120MB`, keeping the active session rosters, token caches, and student indexes resident in memory.
2. **Datacenter Latency & Low Clock Jitter**:
   - Replaces multi-hop residential tunnels (which suffered from ~470ms p95 RTT) with direct AWS network connectivity (20–60ms campus Wi-Fi / 5G RTT).
   - Clock drift over Cristian's Algorithm is minimized, ensuring Gate 4 cryptographic timestamps are validated with high precision.
3. **Cloud SLA & Durability**:
   - High availability (99.99% AWS infrastructure SLA) replaces home blackout vulnerability.
   - Durability is guaranteed through EBS block-level durability, automated snapshots, and off-site S3 database dumps.

### Historical Roots: Why the Zero-Trust Architecture Is So Resilient
The initial prototype was designed for a power-cut-prone 8 GB homelab. This heritage is the reason the system retains robust durability guarantees:
- PostgreSQL transactions maintain atomic integrity (`fsync=on`, `synchronous_commit=on`).
- Nonces in `crypto_challenges` use atomic single-query updates to eliminate race conditions.
- Automated cleanup functions (`run_db_maintenance()`) purge ephemeral tokens and challenges every 5 minutes to prevent storage bloat.

## 5. What "done" looks like (group-project scope)

- [ ] Backend with `time-sync`, `metronome` (WS token mint every 3s), `claim-attendance`
      judge endpoint, professor teacher
- [ ] Supabase self-hosted on the homelab with the full schema + indices
- [ ] Flutter app implementing all 4 gates + the pre-check UI
- [ ] A live class flow demo: prof starts session → QR twitches → student scans → verdict
- [ ] A documented ability to lose power and come back with zero corruption and recent backups

---

## 6. Repo layout (where things live)

```
attendance-gateway/
├── CONTEXT.md          # this file — the "why"
├── ROADMAP.md          # the "how / when"
├── README.md           # entry point + quickstart
├── docs/               # SRS, architecture, security notes, homelab ops
├── migrations/         # SQL schema
├── deploy/             # docker-compose + env + backup scripts (homelab)
├── backend/            # Node/TS judge + metronome + teacher
├── app/                # Flutter client stub
└── scripts/            # ops helpers (backup, status, restart)
```

**Rule of the repo**: the homelab is a first-class citizen. Every PR/task must answer
"what happens to this on a power cut / at 8GB RAM?"
