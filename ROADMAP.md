# ROADMAP — Zero-Trust Cryptographic Attendance Gateway

Order of work. Each phase is boring, reviewable, and — critically — **power-cut safe**:
whatever we ship must survive `atmyhome.tech` losing power mid-step.

Legend: `[ ]` todo · `[x]` done · `>` currently in progress

---

## Phase 0 — Foundation (scaffold + context) `>` NOW

We are here. The goal is a repo that documents *why*, a homelab-aware deployment baseline,
and a shared understanding before any real code.

- [x] SRS ingested into `docs/` (the 19-page blueprint).
- [x] `CONTEXT.md` written (gates, stack, homelab constraints).
- [x] Monorepo scaffold (`docs`, `deploy`, `migrations`, `backend`, `app`, `scripts`).
- [ ] **Push this repo to Gitea** on the homelab (or wherever the group lives).
- [ ] Decide access model: do the other group members clone from Gitea (LAN/Tailscale) or
      GitHub? *This depends on how you want to link the homelab Gitea to the group.*
- [ ] Write `docs/CONTRIBUTING.md` (branch/label/PR protocol for the group).
- [ ] Pin the **exact** self-hosted Supabase versions that fit 8GB RAM.

## Phase 1 — Database & schema (Supabase on the homelab)

Prove the storage layer survives the hardware before building on it.

- [ ] Author full schema from the SRS into `migrations/` (students, professors,
      course_sessions, active_tokens, attendance_ledger + indices + `RollNumber` domain).
- [ ] Tune Postgres for 8GB (`shared_buffers`, `work_mem`, `max_connections`) — see `deploy/`.
- [ ] Bind-mount data on the SSD; wire automated nightly backup to the 500GB WD.
- [ ] Stand up a `supabase` Portainer stack on the proxycore network.
- [ ] Expose `supabase.atmyhome.tech` via proxycore.
- [ ] **Power-cut drill #1**: force-reboot the homelab, confirm DB comes back clean,
      confirm a recent backup exists. (Do this early — it's cheap now, expensive later.)

## Phase 2 — Backend judge + metronome (Node/TS)

- [ ] `GET /api/v1/time-sync` (returns `server_epoch`).
- [ ] Socket.io/WS metronome: mint a base62 token every 3s, broadcast, persist to
      `active_tokens`.
- [ ] `POST /api/v1/claim-attendance` implementing all 4 gates (hardware match, HMAC verify,
      token lookup, 250ms latency check) + unique-claim handling.
- [ ] Professor portal: start/stop session, live QR, attendance table, 1-click device reset.
- [ ] Unit tests for the judge (honest/fast/streamed/forged cases from the SRS state matrix).

## Phase 3 — Flutter client (4 gates + pre-check UI)

- [ ] Provisioning flow: hardware UUID generation → secure storage → bind to server account.
- [ ] Cristian's Algorithm time calibration on boot (`DriftOffset`).
- [ ] Pre-check UI (4 checkpoints), `local_auth` flesh check, `mobile_scanner`.
- [ ] `assembleVerificationPacket` + HMAC wax seal + dispatch.
- [ ] Result UI per the state machine (green PRESENT / hardware mismatch / stream detected…).
- [ ] Run on a physical Android test device (the whole point — must work on real phones).

## Phase 4 — Integrate + demo readiness

- [ ] End-to-end class-flow smoke test (prof → QR twitch → scan → verdict).
- [ ] **Power-cut drill #2**: full outage + restore, verify zero corruption + backups load.
- [ ] Load sanity: simulate ~70 concurrent claims against the judge on the i3-6000T / 8GB.
- [ ] Performance + security review against the SRS state machine matrix.
- [ ] Prepare the demo script + fallback story ("what if power dies during the demo").

## Phase 5 — Polish / submission

- [ ] Final SRS↔implemented traceability.
- [ ] Screenshots / demo video / architecture re-plot for the report.
- [ ] Write-up: the homelab constraints we engineered around (great report material).

---

## Suggested next step (do this first)

**Stand up the repo in Gitea and lock the deployment baseline.**

Concretely, tell me how you want to wire Gitea, and I'll generate the push commands.
Everything else in Phase 0 depends on the repo being somewhere the group can reach.
