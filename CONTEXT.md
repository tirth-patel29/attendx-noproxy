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

## 4. Homelab constraints (THE context that matters)

> **You are running on a homelab that can lose power mid-demo.** This is not a managed
> cloud. Everything below is a *design requirement* because of it.

### Hardware profile
- **CPU**: Intel i3-6000T (2 cores / 4 threads, ~2.9GHz)
- **RAM**: 8 GB DDR4 (2×4GB, dual channel)
- **Storage**:
  - 256 GB SSD (boot / fast & active DB)
  - 500 GB WD (S.M.A.R.T.) — bulk / backups
  - 256 GB Seagate (S.M.A.R.T.) — secondary / redundancy
- **OS**: headless Debian, Tailscale for SSH
- **Orchestration**: Portainer (Docker stacks) — 8 stacks currently: *arr stack, web tools,
  **proxycore** (2 reverse proxies + cloudflared tunnel, network `proxycore`)*, and a
  Hermes stack that includes **Gitea**.

### Consequence → decisions
- **8 GB RAM is TIGHT.** Supabase is heavy. We must (a) tune Postgres to a small footprint,
  (b) consider running Postgres+API+Realtime minimal, (c) cap container memory via
  `mem_limit`, and (d) give the rest of the homelab headroom. We should NOT install the
  full Supabase CLI stack blind.
- **Power cuts are real.** We plan for it instead of hoping:
  - Postgres `fsync=on` (no data-destroying fast settings)
  - Bind-mount DB volume to the **SSD** (survives reboot)
  - **Automated nightly backups** to the 500GB WD
  - **restart_policy: unless-stopped** everywhere; `restart: always` on Postgres
  - A documented restart routine (which of the 8 stacks to bring up after blackout)
  - The proxycore network must route to the new Supabase stack by **service name**, not
    container IP, so IPs survive restarts.
- **Certificate/hostname**: expose via `supabase.atmyhome.tech` through proxycore +
  cloudflared, TLS terminated at the tunnel/proxy.

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
