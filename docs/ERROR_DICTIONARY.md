# Attendance Gateway — Standardized Error Dictionary

Every failed request (`4xx`/`5xx`) from `https://api.atmyhome.tech` returns the
**same JSON envelope**, regardless of which route produced it:

```json
{
  "success": false,
  "error": {
    "code": "ERR_STREAM_DETECTED",
    "message": "Proxy Stream Detected. Photonic intercept lag exceeded the 250ms threshold.",
    "latency_ms": 310,
    "details": {}
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | always `false` for errors |
| `error.code` | string | machine-readable, stable code (table below) |
| `error.message` | string | human-readable explanation |
| `error.latency_ms` | number · optional | included only when relevant (e.g. stream detection) |
| `error.details` | object · optional | debugging metadata (only set where useful) |

> Enforcement: handlers that need a specific code emit it directly; a
> **response-normalization layer** rewrites *any* other non-2xx body into this
> shape (inferring `code` from the HTTP status), so the envelope is guaranteed
> on every route. `2xx` responses are never wrapped.

---

## The zero-trust error codes

### Gate 1 — Hardware / Identity

| Code | HTTP | Trigger | Required client UI action |
|---|---|---|---|
| `ERR_HW_MISMATCH` | **403** | Unregistered hardware. The `device_id_hash` does not match the device bound to this student (`students.bound_device_id`). | **Route user to Admin Desk for a hardware reset / re-bind.** Do not auto-retry. Offer "Contact administrator to reset my device." |
| `ERR_SIG_INVALID` | **401** | Cryptographic rejection. The HMAC-SHA256 wax seal is forged or corrupted (Gate 4). | Show "Security verification failed." Auto-suppress retry spam (re-scan once, then stop). If persistent, force re-login (re-mint HMAC). |
| `ERR_NOT_FOUND` | **404** | The student or session does not exist (Gate 1 lookup, or any unknown resource). | "Session ended or not found — check the projector." Refresh the active-session view. |

### Gate 3 — Time & Optics

| Code | HTTP | Trigger | Required client UI action |
|---|---|---|---|
| `ERR_STREAM_DETECTED` | **412** | Timestamp **freshness** rejected: the claimed time is too old/stale (> `maxAckDelayMs`) or impossibly in the future (a relay/replay or a forged/fabricated clock). No longer an absolute `≤250ms` window — see the Layer-3 note below. **Includes `latency_ms`.** | Show "Attendance window closed / streaming detected." Advise pointing the camera at the LCD — do not screen-share. Re-scan. |
| `ERR_TOKEN_EXPIRED` | **406** | The scanned visual token is expired or invalid (rotated or never existed). | "Token expired — please re-scan the live projector now." Trigger a fresh scan. |
| `ERR_NONCE_USED` | **400** | Anti-replay triggered. Challenge nonce already consumed. | Auto-fetch a **fresh** nonce and resubmit (once), silently. |
| `ERR_NONCE_INVALID` | **400** | Challenge nonce invalid or expired (never issued / not for this session / timed out). | Fetch a fresh nonce from `/sessions/{id}/challenge` and retry. |

### General / Auth / Limits

| Code | HTTP | Trigger | Required client UI action |
|---|---|---|---|
| `ERR_AUTH_MISSING` | **401** | Missing or invalid JWT **or** missing/invalid `X-Api-Key`. | "Session expired / not authenticated — please sign in again." Re-login and ensure the client key is embedded. |
| `ERR_FORBIDDEN` | **403** | Authenticated but wrong role (e.g. a student hitting an admin route). | Show "Access denied." Route to the correct portal. |
| `ERR_BAD_REQUEST` | **400** | Malformed payload / validation failed on a generic route. | Show the first validation message inline; fix the input. |
| `ERR_VALIDATION` | **422** | Reserved for schema-validation responses (currently routes use 400). | Same as `ERR_BAD_REQUEST`. |
| `ERR_CONFLICT` | **409** | Duplicate / conflicting state (e.g. roll already registered). | "Already registered — sign in instead." or surface the conflicting field. |
| `ERR_RATE_LIMIT` | **429** | Too many requests from one client within the window. Honor `Retry-After`. | Exponential back-off; show "Please wait a moment." |
| `ERR_INTERNAL` | **500** | Unexpected server error (production hides the stack). | "Something went wrong — try again." Log it server-side. |
| `ERR_UNAVAILABLE` | **503** | Service/degraded. | "Service temporarily unavailable — retry." |
| `ERR_UNKNOWN` | (varies) | Fallback for an unrecognized non-2xx status. | Treat like `ERR_INTERNAL`. |

---

## Examples (as seen by the Flutter client)

**Hardware mismatch (Gate 1):**
```json
HTTP 403
{"success":false,"error":{"code":"ERR_HW_MISMATCH","message":"Unregistered hardware. Your account is bound to a different physical device."}}
```

**Stream / stale-or-forged timestamp (Gate 4):**
```json
HTTP 412
{"success":false,"error":{"code":"ERR_STREAM_DETECTED","message":"Attendance window closed or timestamp rejected — re-scan the live projector.","latency_ms":310}}
```

**Expired visual token (Gate 3):**
```json
HTTP 406
{"success":false,"error":{"code":"ERR_TOKEN_EXPIRED","message":"Token expired, re-scan the projector"}}
```

**Replay / nonce consumed (Gate 4):**
```json
HTTP 400
{"success":false,"error":{"code":"ERR_NONCE_USED","message":"Challenge nonce already used (replay)"}}
```

---

---

## How the 250ms window was redesigned (latency-agnostic)

The strict `claimed − birth ∈ [0,250]` window broke under a multi-hop proxied +
tunnel backend (on-demand proxy → reverse proxy → cloudflared): a single noisy
Cristian sample and a snapshot-before-challenge bug pushed honest claimed times
out of range. The judge now enforces **token-epoch membership + freshness**, which
are immune to infrastructure RTT:

1. **Freshness** — `now − claimed ≤ maxAckDelayMs` (default **5 s**, tuned to measured ~470 ms p95 / worst ~1.5 s RTT) and `claimed ≤ now + clockToleranceMs`: kills replay / forged / far-old timestamps.
2. **Membership** — the submitted token must have been **live at the claimed instant**: `birth − clockTolerance ≤ claimed < birth + validity + clockTolerance` (`clockToleranceMs` default **500 ms**). A static-photo screenshot or an old/rotated token fails this.
3. **Anchor** — the client sets `claimed = challenge.server_time_ms + elapsed`, rooting the timestamp in the server's own clock one hop before signing.

A physically present student therefore always passes; replaying an old token or
stamping a stale/forged time still fails. `JUDGE_CLOCK_TOLERANCE_MS` and
`JUDGE_MAX_ACK_DELAY_MS` are the documented, deliberate config knobs.

## Client integration rules

1. **Branch on `error.code`, never on the HTTP status alone.** `400`/`401`/`403`/`412`
   each carry *multiple* distinct codes with different UI behaviors.
2. **`success === false` is the single success/failure signal.** Do not parse
   variants like `{error: "text"}` — the envelope is the only contract now.
3. **`latency_ms` appears only where it has meaning** (stream detection). When
   present, it mirrors the rejected `verification_delta_ms`.
4. **Every failure must render a message + a recovery action** — see the
   "Required client UI action" column. Never surface raw codes/stack traces.
5. Docs are public and current at:
   `https://git.atmyhome.tech/het/attendance-gateway/src/branch/main/docs/ERROR_DICTIONARY.md`