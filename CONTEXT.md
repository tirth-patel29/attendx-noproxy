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
| Backend judge + metronome | **Node.js / TypeScript** | WebSocket metronome, HMAC verification, REST API, port 3001 |
| Database + Auth + Storage | **Supabase / PostgreSQL** | Cloud Supabase / dedicated Postgres with 12 structured migrations |
| Teacher Web Portal | **React / Vite + Tailwind** | Schedule, dual-state projector QR, live attendance stream, port 3010 |
| Admin Console | **React / Vite + Tailwind** | Academic hierarchy, batch timetable, faculty provisioning, device reset, port 3020 |
| Reverse proxy + TLS | **Caddy / Nginx** | Host-level reverse proxy with Let's Encrypt SSL → `atmyhome.tech` |

## 4. Production Infrastructure: Dedicated AWS EC2 (~7 GB RAM)

> **Deployment Reality**: AttendX is deployed in production on a dedicated **AWS EC2 instance with ~7 GB RAM** (e.g. `t3.large` or `t4g.large`, 2 vCPUs) and AWS EBS (gp3) SSD storage.

### Production Environment Profile
- **Compute**: AWS EC2 instance (2 vCPUs, 8 GB / ~7 GB usable RAM)
- **Storage**: AWS EBS (gp3) SSD volume with automated snapshot capabilities
- **OS**: Ubuntu / Debian LTS (headless)
- **Reverse Proxy**: Host Caddy / Nginx with automated Let's Encrypt TLS termination and WebSocket support
- **Domain**: Cloud-routed domain (`api.atmyhome.tech`, `portal.atmyhome.tech`, `admin.atmyhome.tech`)

### Performance & Architectural Advantages on EC2
1. **Dedicated ~7 GB Memory Pool**:
   - In production, memory is dedicated strictly to AttendX (`backend`, `teacher`, `admin`, and `postgres`).
   - PostgreSQL is tuned with `shared_buffers = 1792MB` and `effective_cache_size = 5120MB`, keeping active session rosters, token caches, and student indexes resident in memory.
2. **Datacenter Latency & Low Clock Jitter**:
   - Replaces multi-hop residential tunnels with direct AWS network connectivity (20–60ms campus Wi-Fi / 5G RTT).
   - Clock drift over Cristian's Algorithm is minimized, ensuring Gate 4 cryptographic timestamps are validated with high precision.
3. **Cloud SLA & Durability**:
   - High availability (99.99% AWS infrastructure SLA) replaces home blackout vulnerability.
   - Durability is guaranteed through EBS block-level durability, automated snapshots, and off-site database dumps.

### Historical Roots: Why the Zero-Trust Architecture Is So Resilient
The initial prototype was designed for a power-cut-prone 8 GB homelab. This heritage is the reason the system retains robust durability guarantees:
- PostgreSQL transactions maintain atomic integrity (`fsync=on`, `synchronous_commit=on`).
- Nonces in `crypto_challenges` use atomic single-query updates to eliminate race conditions.
- Automated cleanup functions (`run_db_maintenance()`) purge ephemeral tokens and challenges every 5 minutes to prevent storage bloat.

## 5. What "done" looks like (Implementation Status)

- [x] Backend with `time-sync`, `metronome` (WS token mint every 3s), `claim-attendance` judge endpoint, and full Admin/Teacher APIs.
- [x] Database: PostgreSQL/Supabase schema with 12 idempotent migrations and optimized indexes.
- [x] Academic hierarchy & timetable: full tree (Colleges, Departments, Branches, Divisions, Batches) with batch-level timetable slotting (Theory vs Lab).
- [x] Teacher Portal (`teacher/`): Today's schedule, dual-state projector QR (2.9s anchor + 100ms flash), live attendance ledger stream.
- [x] Admin Console (`admin/`): Hardware lock unlock/reset, API key generation, faculty provisioning, and academic hierarchy management.
- [x] Flutter mobile app (`app/`): 4-gate verification flow, Cristian's drift calculation, and secure storage.
- [x] Production deployment: AWS EC2 hosting with automated CI/CD pipeline and SSL on `atmyhome.tech`.

---

## 6. Repo layout (where things live)

```text
attendx-noproxy/
├── CONTEXT.md          # this file — the "why"
├── ROADMAP.md          # completed milestones & future enhancements
├── README.md           # repository entry point & overview
├── QUICK_REFERENCE.md  # developer cheat sheet & API summaries
├── docs/               # client integration guide, error dictionary, contributing
├── migrations/         # PostgreSQL migrations (001_schema through 012_...)
├── deploy/             # docker-compose + env + Caddy reverse-proxy configs
├── backend/            # Node.js / TypeScript judge + metronome + API server
├── admin/              # Admin Console (React + Vite)
├── teacher/            # Teacher Portal (React + Vite)
├── app/                # Flutter student mobile client
└── scripts/            # ops & automated verification scripts
```

**Rule of the repo**: verify, don't trust. Every PR/task must preserve the 4-gate security model and the 250ms verification window semantics.
