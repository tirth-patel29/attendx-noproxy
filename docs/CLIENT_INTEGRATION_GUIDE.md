# Attendance Gateway — Client Integration Guide

> This is the contract for **anyone building a client** (e.g. the student Flutter APK)
> that talks to `https://api.atmyhome.tech`. Read it fully before writing code.
> The security-critical rules are marked **⛔ MUST**.

---

## 1. What a client is

A client is an app a student runs on a phone. It:

1. authenticates the student,
2. binds that student to this specific device,
3. reads a live QR from the classroom projector,
4. cryptographically seals the claim, and
5. submits it within a 250 ms window.

The only way the backend marks a student **PRESENT** is if the claim passes all **4 gates**:

| Gate | What proves it | Where it runs |
|---|---|---|
| **G1 Hardware Tattoo** | `device_id_hash` matches the device bound to the student | client + server |
| **G2 Biometric Flesh Lock** | OS-level fingerprint / FaceID reject (`local_auth`) | **client only** (a boolean) |
| **G3 Visual Micro-Twitch** | the QR token you scanned is a live, unexpired server token | client + server |
| **G4 Crypto Time-Stamp** | HMAC-SHA256 seal + `claim_time − token_birth ∈ [0, 250] ms` | client + server |

The backend treats every device as hostile. G2 is the only "is a human holding the phone"
check — hence the order matters (see §4).

---

## 2. API key — required on every request

A client must present a **shared API key** minted from the Admin console
(`admin.atmyhome.tech → API Keys`). The backend verifies it on the client surface;
**without it every client call is rejected `401 missing_api_key`**.

**⛔ MUST:** send it on **every** request:

```
X-Api-Key: ag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- It is a **licensing / throttle gate, NOT identity.** Anyone who can read the binary
  can extract it. Real identity is the per-student JWT (§3). If it leaks, revoke it in the
  console and mint a new one, then rebuild the client.
- Do **not** build it as a per-user credential. It is one shared key for the whole client app.

Embedded at build time in the reference Flutter client:

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.atmyhome.tech \
  --dart-define=API_KEY=ag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 3. Student identity & provisioning (SRS self-registration)

There is **one authoritative identity per device**, stored in the OS KeyStore/Keychain:

| Stored value | Meaning |
|---|---|
| `access_token` | student JWT from `/api/v1/student/login` |
| `student_uuid` | the student's primary key |
| `roll_no` | e.g. `24DCE091` |
| `secret_hmac_key` | the Gate-4 signing key, **minted by the server at device bind** |
| `device_id_hash` | `SHA-256(hardware UUID)` — the Gate-1 tattoo |
| `bound_device_id` | the server-recorded `device_id_hash` for this student |

Flow (all under `X-Api-Key`, in this order):

1. `POST /api/v1/student/status` — check whether the roll is registered / bound.
2. `POST /api/v1/student/register` — self-register with college identity.
3. `POST /api/v1/student/login` — get the **student JWT** (`Authorization: Bearer`).
4. `POST /api/v1/student/device/bind` — send `device_id_hash`; the server returns a
   fresh `secret_hmac_key`. Store it **only in the secure keychain** and keep it secret.
5. `POST /api/v1/student/password/set` — set/reset the password (e.g. after admin
   forgot-password clears it).

**⛔ MUST:** `device_id_hash` is `SHA-256` of a **hardware-stable UUID** generated once and
kept in the KeyStore (never `randomUUID()` on every launch — it must survive reinstalls as
the binding). The `secret_hmac_key` is used to sign every claim (§6) and must never leave
the device.

---

## 4. Biometric (Gate 2) — when to do it

Gate 2 is the **Biometric Flesh Lock**: `local_auth` / `localAuthentication` returns a
boolean whether the OS verified the student's fingerprint or FaceID.

**Recommended placement — at app boot, BEFORE initializing anything else:**

```
1. Unlock the secure keychain (load access_token, student_uuid, secret_hmac_key, device_id_hash)
2. ⛔ Gate 2 — prompt for Biometric (fingerprint / FaceID). If it fails → block the session.
3. Only then: initialize network (time sync, Rest client, socket).
4. Only then: auto-login / navigate to Home.
```

Rationale:
- It is the **only flesh check** in the whole system; run it as the earliest human gate.
- An unattended phone (mount, screen-share, bot) cannot auto-attend — the app dead-ends
  at the prompt unless a real finger/face unlocks it.
- Signing the claim without ever proving flesh is a **forgery vector** (the judge can't tell
  a human from a scripted signer for G2 — that is the client's job).

> If you also want a per-attendance prompt (defense-in-depth), the reference client re-runs
> Gate 2 during the claim pre-check. Both are valid; the **boot-time prompt is mandatory**.

---

## 5. Network time — Cristian's Algorithm (Gate 4 prerequisite)

The client signs a timestamp in the **server's** clock domain. You must estimate true server
time before any claim.

1. `GET /api/v1/time-sync` → `{ "server_time_ms": 1720000000000 }`.
2. Measure request send/receive (`RTT`), estimate
   `server_now = server_time_ms + RTT/2`.
3. Keep a **drift offset** (`server_now − local_now`) and re-sync periodically (≈ every 5 min)
   and always before a claim.

**Recommended (Layer-2 — the robust path):** anchor the timestamp to the **server's own
clock from the challenge round-trip** (see §7.1): `client_claimed_time = challenge.server_time_ms + elapsed_since_request`.
This is immune to device-clock drift and to high/jittery RTT from a proxied/tunnelled backend.

**⛔ MUST (if you use the drift path):** the timestamp you sign must be a **fresh min-RTT
Cristian estimate** taken at the moment of signing — never a single noisy sample or a stale
wall-clock read. A wrong or stale clock is how a client gets rejected (or flagged
`STREAM_DETECTED`).

---

## 6. The QR / metronome protocol (Gate 3) — the 3-second window

This is the part you asked about explicitly, so read closely.

### The projector's output ("dumb terminal")

The class projector shows a rotating QR. Its payload is always:

```
ATTN:<session_uuid>[:<token>]
```

- **Session (anchor frame)** — `ATTN:<session_uuid>` with **no** token. This is shown most
  of the time and simply identifies the session.
- **Token (flash frame)** — `ATTN:<session_uuid>:<token>` where `<token>` is **exactly 4
  chars** from the base62 alphabet `A–Z a–z 0–9`. The projector flashes this token briefly
  inside each cycle, then returns to the anchor.

### The cadence

- The server's metronome mints a **new token every 3000 ms** per session.
- Each token is **valid for 5000 ms** (`expires_at_epoch = created + 5000`).
- The token is **shared** — the whole class scans the same rotating token; it is NOT
  consumed by a single claim (one student's packet must not lock out 69 others).

**⛔ MUST — parse the whole 3-second window / ~90 frames:**

At ~30 fps a 3 s cycle is ~90 camera frames. The token frame may only occupy a handful of
frames. Therefore:

1. **Never stop at the first QR** — the first QR you see is usually the anchor
   (`ATTN:<session>`, no token). Discard it (record the session if empty).
2. **Keep decoding continuously for the full window** so the flash is not missed. The
   reference scanner keeps a running loop and only "resolves" when it decodes a payload
   WITH a token whose `token.length ∈ [1..4]` (the base62 flash).
3. Treat any payload that has **no token** as an anchor update; treat the **first payload
   with a token** as the flash to submit.

Reference reader logic (conceptual):

```text
loop:
  raw = decode_frame()
  if raw starts with "ATTN:" and session_uuid is a 36-char UUID:
     (session, token) = split(raw)
     if token is empty:  -> this is the anchor; remember session_uuid; keep scanning
     else if token length in 1..4 (base62):  -> THIS IS THE FLASH
           capture token; feed Gate 4; submit; break out of loop   [case-sensitive]
```

**⛔ MUST — sign the token you SAW, never a re-fetched one:**
After the scanner captures a token, do **not** go back to the server to fetch "the current
token." The whole point of Gate 4 is that the HMAC is over the *exact* token the lens
witnessed. If you re-fetch, you may sign a *different* token than the LCD showed, and the
server's HMAC check fails. Captured → sealed → submitted, in one pass.

**Reference client behavior (already hardened):**
The reference Flutter scanner enforces exactly this window. Once it locks onto a session
(the first anchor frame), it waits out **one full metronome cycle** (3 s + margin, ~4.2 s)
and refuses to refresh that deadline on subsequent anchors. If the token flash is captured
within the window it submits immediately; if a whole window elapses with no flash it shows
a **"No flash in this window — keep holding steady"** state (it does not silently scan
forever). The next anchor frame auto-re-arms the window, so it self-recovers.

### Don't let the client UI cheat

- Do **not** implement a "refresh token button" — that defeats Gate 3.
- The scanner must ignore duplicated frames and **prevent double-submit** (see §8).

---

## 7. Claiming attendance — exact wire contract

### 7.1 Get a server nonce + authoritative time (Gate 4)

```
GET /api/v1/sessions/{session_uuid}/challenge
   -> Status 200
   -> { "nonce": "<challenge_nonce>", "server_time_ms": <epoch ms>,
        "issued_at_epoch": <epoch ms>, "expires_at_epoch": <epoch ms> }
```

`server_time_ms` (== `issued_at_epoch`) is the **server's authoritative clock**. Use it to
anchor your claim timestamp: after receiving the challenge, set
`client_claimed_time = server_time_ms + (local_ms now − local_ms when the request was sent)`.

**⛔ MUST:** use the **server-issued nonce**. A locally generated nonce is rejected as
`FORGED_RESPONSE`. The nonce is **single-use** — it is marked used once you submit.

### 7.2 Sign the canonical string (HMAC-SHA256)

The HMAC key is the student's `secret_hmac_key` (§3). Build exactly:

```text
canonical = "{session_uuid}|{student_uuid}|{token_val}|{client_claimed_time}|{device_id_hash}|{nonce}"
signature = HMAC_SHA256(secret_hmac_key, canonical)     // hex-encoded lowercase
```

- `session_uuid` — from the QR anchor/flash.
- `student_uuid` — the authenticated student.
- `token_val` — the **4-char flash token** captured in §6.
- `client_claimed_time` — **ms epoch**, a fresh Cristian estimate taken at signing time (§5).
- `device_id_hash` — SHA-256 of the hardware UUID (§3).
- `nonce` — from §7.1.

### 7.3 Submit

```
POST /api/v1/claim-attendance
X-Api-Key: ag_...
Authorization: Bearer <student JWT>
Content-Type: application/json

{
  "session_uuid":      "<uuid>",
  "student_uuid":      "<uuid>",
  "token_val":         "Ab3d",
  "client_claimed_time": 1720000000123,
  "device_id_hash":    "<sha256 hex>",
  "nonce":             "<hex>",
  "hmac_signature":    "<hex>"
}
```

### 7.4 The judge gate — token-epoch membership + freshness (latency-agnostic)

The server no longer rejects on an absolute `claimed − birth ≤ 250 ms`. It enforces:

- **Freshness:** `now − claimed ≤ maxAckDelayMs` (server now vs your claimed time; default 8 s)
  and `claimed ≤ now + clockToleranceMs` (no forged future timestamps).
- **Membership:** the submitted token must have been **live at your claimed instant**:
  `token.birth − clockTolerance ≤ claimed < token.birth + validity + clockTolerance`
  (defaults: `clockToleranceMs` 400, `tokenValidityWindowMs` 5000).

A physically present student always passes — this window is immune to infra RTT; it only
rejects stale/forged timestamps and tokens that were NOT current at the claimed moment
(static photos and old-token replays). Because tokens rotate every 3 s, a relay can only
ever be ~one token stale, so streaming/photo attacks stay bounded.

---

## 8. Response codes a client must handle

| HTTP | `status` field | Meaning / client action |
|---|---|---|
| 200 | `PRESENT` | Success. `message` is `"Attendance verified"` or `"Attendance already logged"` (idempotent/dedup). |
| 401 | `missing_api_key` / `invalid_api_key` | Client key wrong/missing. Fix the build-time key. |
| 401 | (JWT) | Student token expired → re-login. |
| 403 | `FORGED_RESPONSE` | HMAC or nonce invalid. Re-scan (your seal was wrong). |
| 403/412 | `STREAM_DETECTED` | Replay/live-relay or your clock drifted. Re-sync time, re-scan. |
| 403/412 | `EXPIRED_TOKEN` | Token rotated (you were too slow or watched a static photo). Re-scan the live flash. |
| 403/412 | `HARDWARE_MISMATCH` | This device isn't bound to this student. Re-bind / admin device reset. |
| 404 | `INVALID_CLAIM` | Student or session not found. |

**⛔ MUST — idempotency:** a single claim may legitimately return `PRESENT` with message
`"Attendance already logged"`. Treat that as **success**, not an error, and **prevent
double-submitting** in the UI (lock the "Mark Attendance" flow while a claim is in flight
and for ~1 s after).

---

## 9. Security responsibilities (client-side checklist)

- ✅ Send `X-Api-Key` on **every** request.
- ✅ Gate 2 biometric at **boot, before network init**.
- ✅ Store `secret_hmac_key` + `device_id_hash` in the **secure keychain only**.
- ✅ Sign the **exact scanned token**, never a re-fetched one.
- ✅ Use a **fresh Cristian`timestamp** at signing time.
- ✅ Use only the **server-issued nonce**, once.
- ✅ Parse the **full 3 s window** so the flash is never missed.
- ✅ Never print stack traces, HMAC, UUIDs, nonces, or KeyStore info to the student UI.
- ❌ No manual "token refresh" — that bypasses Gate 3.
- ❌ Never expose cryptographic internals in the UI (keep the UX simple).
