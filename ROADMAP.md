# ROADMAP — Zero-Trust Cryptographic Attendance Gateway

Order of work. Each phase is boring, reviewable, and — critically — **power-cut safe**:
whatever we ship must survive `atmyhome.tech` losing power mid-step.

Legend: `[ ]` todo · `[x]` done · `>` currently in progress

---

## Phase 0 — Foundation (scaffold + context) ✅ COMPLETE

- [x] SRS ingested into `docs/` (the 19-page blueprint).
- [x] `CONTEXT.md` written (gates, stack, homelab constraints).
- [x] Monorepo scaffold (`docs`, `deploy`, `migrations`, `backend`, `app`, `scripts`).
- [x] **Push this repo to Gitea** → `het/attendance-gateway` live at `http://gitea:3000/het/attendance-gateway`
- [x] Access model decided: Team clones via Tailscale + SSH to homelab Gitea
- [x] Write `docs/CONTRIBUTING.md` (branch/label/PR protocol + homelab impact statement)
- [x] Gitea issue template for task tracking (`.gitea/issue_template/task.md`)
- [x] **PROJECT_PLAN.md** created with detailed phases, timeline, RACI, risks, success metrics
- [ ] Pin the **exact** self-hosted Supabase versions that fit 8GB RAM (in compose)

## Phase 1 — Database & schema (Supabase on the homelab) 🔄 IN PROGRESS

- [x] Author full schema from the SRS into `migrations/` (students, professors,
      course_sessions, active_tokens, attendance_ledger + indices + `RollNumber` domain).
- [x] Migration 001 applied to live Supabase DB.
- [x] Migration 002 applied (device_fingerprints, biometric_templates, crypto_challenges, audit_logs).
- [x] Migration 003 applied (seed: 2 professors, 5 students, 2 sessions, 4 tokens).
- [x] Verify indices & constraints (unique_attendance_claim, idx_tokens_fast_lookup, idx_student_auth working).
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
