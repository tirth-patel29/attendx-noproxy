# Headless Attendance API Gateway — Implementation Plan

> **Status:** Draft for review · **Author:** Hermes · **Date:** 2026-08-12

## Goal

Turn the existing attendance backend into a **stable, fully-documented, API-first product** so that *any* client (Flutter APK, teacher web, admin console, or a third-party app) can be built purely against a versioned REST API — with an **API-key developer console**, crystal-clear **documentation**, and standard error/response contracts. This stops the APK-build bottleneck: clients become thin shells over documented HTTP.

## Why now

- APK builds keep failing on Flutter/Android toolchain; nobody should need Flutter to integrate.
- The backend + 4-gate crypto logic is already solid and tested (`live_flow_test.py` 25/25). It just isn't *documented* or *consumable* as a product.
- Hardcoding an **app API key** (issued from a console) + per-user login is a clean, familiar model for third-party clients.

## Operating principles

1. **Never break v1.** Add a new versioned surface (`/api/v2`) with a consistent envelope; keep `/api/v1` working for the two deployed dashboards and the existing APK.
2. **One authoritative identity.** Student identity = `student_uuid` + `roll_no` in Postgres (already true). Every client reads/writes it via the API, never by hardcoding IDs.
3. **App key ≠ user key.** Two layers: *who is the app* (API key) and *who is the user* (bearer token). Both required on user-scoped calls.
4. **Cryptographic math unchanged.** The 4 gates (KeyStore UUID → HMAC seal → Cristian time → ≤250ms TTL) stay exactly as implemented.
5. **Docs are generated once, kept in the repo, re-usable on any host.**

---

## Part A — Architecture

### A1. API surface & versioning

```
/api/v1/...   # existing routes — left untouched (dashboards, current APK)
/api/v2/...   # NEW — consistent envelope, app-key auth, full params/returns, documented
/docs         # NEW — OpenAPI (Swagger/ReDoc) + human guide
/console      # NEW — developer console (issue/manage API keys)
```

- `/api/v2` mounts a thin translation layer reusing the same service logic as v1 (avoid duplication; share validation + DB code).
- A **base-path router** picks v1 vs v2 by prefix.

### A2. Two-token auth model

| Token | What it identifies | How it's obtained | Sent as |
|-------|--------------------|-------------------|---------|
| **App access token** | the *application* (e.g. "Student APK", "College Web") | `client_id`+`client_secret` from the console → `POST /api/v2/oauth/token` | `Authorization: Bearer <app_token>` |
| **User bearer token** | the *person* (student/teacher/admin) | `/api/v2/auth/login` etc. | `Authorization: Bearer <user_token>` (or `X-User-Token`) |

- App token carries `{ app_id, scopes:[...], type:'app' }`. User token carries `{ sub, role, type:'user' }`.
- Both claims are checked separately; an endpoint declares `auth: required_app + required_role`.
- App secrets are stored **hashed** (bcrypt) and shown to the owner **once** at creation.

### A3. Response envelope (uniform everywhere in v2)

```json
// success
{ "ok": true, "data": { ... } }
// error
{ "ok": false, "error": { "code": "TOKEN_EXPIRED", "message": "...", "field": "roll_no", "retryable": true } }
```

### A4. Error-code catalogue (simplified set)

`BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT,
INVALID_ROLE, APP_KEY_INVALID, APP_KEY_REVOKED, RATE_LIMITED,
STUDENT_NOT_FOUND, STUDENT_NOT_BOUND, BIOMETRIC_REQUIRED,
TOKEN_EXPIRED, TOKEN_USED, WINDOW_CLOSED, WRONG_CLASSROOM,
INVALID_QR, CLAIM_FAILED, LATENCY_TOO_HIGH, NETWORK_TIMEOUT, INTERNAL`

Each maps to an HTTP status + `retryable` bool. (See docs/error-codes.)

### A5. Data model additions (Postgres)

```sql
api_apps (
  id            uuid pk default gen_random_uuid(),
  client_id     text unique not null,          -- e.g. "app_live_..." 
  secret_hash   text not null,                 -- bcrypt of client_secret
  name          text not null,
  owner_uuid    uuid references admins,
  scopes        text[] default '{student,teacher}',
  rate_limit     int  default 2000,            -- per-minute
  revoked       bool default false,
  created_at    timestamptz default now(),
  last_used_at  timestamptz,
  description   text
);
api_app_log (
  id bigserial pk,
  app_id uuid references api_apps,
  path text, method text, status int, ip inet,
  at timestamptz default now()
);
```

### A6. Console placement

Add a **Developer / API Keys** section to the existing **Admin React dashboard** (no new deploy target). Routes: create app (shows secret once), list apps, revoke/rotate, view usage log. Guarded by `requireAdmin`. A standalone browser client can then hit the console API endpoints directly.

---

## Part B — v2 Endpoint Catalog (params + returns)

> Conventions: all `POST` bodies JSON. `Authorization: Bearer <app_token>` on every call; `X-User-Token: <user_token>` for user-scoped. `X-Client-Id` optional (device uuid hash).

### Meta
| Method | Path | Params | Returns |
|---|---|---|---|
| GET | `/api/v2/ping` | – | `{ ok, data:{ ts, api, version } }` |
| GET | `/api/v2/time` | – | `{ ok, data:{ server_time_ms, server_tz } }` (Cristian reference) |
| GET | `/api/v2/health` | – | liveness/readiness |

### OAuth / app
| Method | Path | Params | Returns |
|---|---|---|---|
| POST | `/api/v2/oauth/token` | `client_id, client_secret, grant_type=client_credentials` | `{ access_token, token_type, expires_in, scopes }` |

### Student auth (self-registration, bind)
| Method | Path | Params | Returns |
|---|---|---|---|
| POST | `/api/v2/auth/status` | `roll_no` | `{ exists, password_set, bound, device_id_hash }` |
| POST | `/api/v2/auth/register` | `roll_no, name?, email?, password` | `{ student_uuid, access_token }` |
| POST | `/api/v2/auth/password/set` | `roll_no, password` | ok / STUDENT_NOT_FOUND |
| POST | `/api/v2/auth/login` | `roll_no, password` | `{ student_uuid, roll_no, name, access_token, user_token }` |
| POST | `/api/v2/auth/refresh` | `refresh_token` | new access token |
| POST | `/api/v2/device/bind` | `roll_no, device_id_hash, device_cert?` | `{ hmac_secret }` (minted at bind; stored hashed) |
| GET | `/api/v2/auth/me` | user token | full profile + bound state |

### Sessions (teacher)
| Method | Path | Params | Returns |
|---|---|---|---|
| POST | `/api/v2/sessions/start` | `course_code, prof creds` | `{ session_uuid, qr_seed }` |
| POST | `/api/v2/sessions/:id/stop` | – | `{ ended, present_count }` |
| GET | `/api/v2/sessions/:id/tokens` | `?count=N` | 3s base62 tokens stream (WebSocket `/api/v2/ws/sessions/:id`) |
| GET | `/api/v2/professor/timetable` | user token | upcoming classes |
| GET | `/api/v2/professor/summary` | user token | per-session summary |

### Claims (student — the cryptographic core)
| Method | Path | Params | Returns |
|---|---|---|---|
| POST | `/api/v2/claim` | `session_uuid, token, client_time_ms, student_uuid, signature` | `{ status:"PRESENT", ledger_uuid, verification_delta_ms }` |

`signature = HMAC_SHA256(hmac_secret, "ATTN:" + session_uuid + ":" + token + ":" + client_time_ms)`
Server: verifies HMAC, then rejects if `(server_now - token_birth) > 250ms` → `LATENCY_TOO_HIGH`; token single-use (nonce table) → `TOKEN_USED`.

### History (student)
| Method | Path | Params | Returns |
|---|---|---|---|
| GET | `/api/v2/students/me/attendance` | user token | `{ summary:{present,total_held,total_missed,percent}, per_course:[], records:[{course,time,verification_delta_ms,status}] }` |

### Admin
| Method | Path | Params | Returns |
|---|---|---|---|
| CRUD | `/api/v2/admin/divisions`, `/courses`, `/teachers`, `/students` | admin user token | standard CRUD |
| POST | `/api/v2/admin/students/:uuid/reset-device` | – | unpair hardware |
| POST | `/api/v2/admin/students/:uuid/forgot-password` | – | clear password hash |
| POST | `/api/v2/admin/students/:uuid/rotate-hmac` | – | re-mint HMAC |
| GET/POST | `/api/v2/console/apps` … | admin | create/list/revoke/rotate API keys + usage log |

---

## Part C — Client-auth flow (what the docs teach)

1. **Onboard the app:** register app in console → get `client_id`+`client_secret` → call `/oauth/token` → store **app token** (this is the "hardcoded key" for the team's own APK; third parties use OAuth).
2. **Log the student in:** ID + password → user token; `/device/bind` → HMAC secret (Keystore/Keychain on mobile).
3. **Before scanning:** `GET /api/v2/time` + pace RTT → derive network clock (Cristian).
4. **Scan:** read `ATTN:<session>:<token>` flash from projector.
5. **Seal + submit:** build HMAC over the tuple with the local timestamp, POST `/claim`.
6. **Judge:** server rejects if Δ > 250ms; returns `PRESENT` + delta.

---

## Part D — Documentation deliverables

1. **`docs/openapi.yaml`** — full OpenAPI 3.1 spec (paths, schemas, errors, auth). Source of truth.
2. **Doc site** (`docs/`) — ReDoc (single-file, no build) rendering the OpenAPI + an `index.md` guide:
   - Quickstart / build a client in 10 minutes (curl)
   - Auth guide (app key + user token)
   - The 4 gates explained in plain language + the ≤250ms rule
   - Endpoint reference with curl + Dart/JS/Python examples
   - Error-code table
   - Changelog per version
3. **Postman collection** (`docs/attendance.postman_collection.json`) for click-through.
4. **(Later)** Generated SDKs from OpenAPI (`openapi-generator-cli`) for Dart/TypeScript/Python.

---

## Part E — Milestones (bite-sized)

### M0 · Foundation
- Add `api_apps` + `api_app_log` migration (003-style numbered migration).
- Service: `createApp, listApps, revokeApp, rotateAppSecret, authorizeApp`.
- Console endpoints (admin-guarded).

### M1 · v2 skeleton + envelverror contract
- `/api/v2` base router; `ok`/`error` envelope helper; standardized error codes + HTTP mapping.
- App-key auth middleware (`requireApp`), user-token middleware (`requireUser`) sharing the existing JWT verify.
- `/ping`, `/time`, `/health`.

### M2 · Student auth + device bind on v2
- `/auth/status, register, password/set, login, refresh, me` and `/device/bind` (HMAC minted).
- Mirror existing student.ts logic into shared service; v1 keeps calling the same service.

### M3 · Session + claim on v2
- `/sessions/*` (teacher) and `/claim` with full HMAC–TTL judgment.
- Wire the existing `PrecheckOrchestrator`/claim logic; add nonce single-use.
- `/students/me/attendance`.

### M4 · Documentation
- Write `docs/openapi.yaml`, `index.md`, error table, curl live examples.
- Postman collection. Add examples to `scripts/` (`docs/scripts/curl/*.sh`).

### M5 · Validation + console UI
- Extend `scripts/live_flow_test.py` to a new `v2` scenario using a real app key (register app → token → student → bind → claim → history).
- Add **Developer / API Keys** panel to the admin React dashboard.
- Rotate/revoke + usage log screens.

---

## Part F — Files likely to change

- **Backend**
  - Create: `src/routes/v2/*.ts` (meta.ts, auth.ts, sessions.ts, claim.ts, history.ts, console.ts), `src/lib/errors.ts`, `src/lib/appAuth.ts`, `src/lib/envelope.ts`, `src/controllers/v2/*`
  - Modify: `src/index.ts` (mount `/api/v2`, `/docs`), share service logic; `src/db/migrations/*`
- **Docs**
  - Create: `docs/openapi.yaml`, `docs/index.md`, `docs/error-codes.md`, `docs/attendance.postman_collection.json`, `docs/scripts/curl/*.sh`
- **Admin dashboard**
  - Modify: add Developer/API Keys panel (`attendance-admin`)
- **Tests**
  - Modify: `scripts/live_flow_test.py` (add v2 scenario)

---

## Part G — Validation / verification

1. `live_flow_test.py --api v2 --app-key <real>` → full happy path (token→login→bind→claim→«PRESENT»→history) passes.
2. Negative tests: `TOKEN_EXPIRED`, `LATENCY_TOO_HIGH` (simulate 300ms), `TOKEN_USED` (replay), `APP_KEY_REVOKED`, `RATE_LIMITED`.
3. Every `docs/scripts/curl/*.sh` example runs verbatim against staging and returns documented JSON.
4. Doc site renders OpenAPI with all paths + param descriptions; ReDoc loads with no errors.
5. v1 still green (`live_flow_test.py` 25/25 unchanged) — no regression.

---

## Part H — Risks / tradeoffs / open questions

- **Risks:** API surface sprawl (mitigate: translation layer reuses v1 services); exposing `hmac_secret`/tokens (mitigate: mint once, hash at rest, TLS-only, rate-limited); console abuse (admin-guarded + rate limits + audit log).
- **Tradeoff:** two auth tokens add integration friction but keep "app identity" vs "person identity" clean for third-party clients.
- **Open questions for you:**
  1. Do you want the docs site served publicly at e.g. `api.atmyhome.tech/docs`, or private (same Cloudflare auth as the console)?
  2. Is the **API key** meant to be a *per-application* key (one for "Student APK", one for "Teacher Web") — the model assumed here — or per-install?
  3. Should third-party client *registration* be open (self-serve) or admin-gated only?
  4. Keep `/api/v1` indefinitely, or set a deprecation date once v2 is used by the official APK? (Recommend: keep both, mark v1 deprecated.)
  5. Single doc host (ReDoc over static file) vs a built React docs app?

---
**Next action after your sign-off:** implement M0+M1 (DB migration, envelope+error contract, app-key auth, `/ping /time /health`) and commit, then proceed M2→M5.
