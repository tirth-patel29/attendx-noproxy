# Attendance Gateway — Client Integration Guide

> The authoritative contract for **anyone building a client** (e.g. the student Flutter
> APK) that talks to `https://api.atmyhome.tech`. Read the whole document before writing
> code. **⛔ MUST** rules are security-critical.

Version-guarded to match the **juke-box release** of the backend. Build the APK yourself
from this guide + the public OpenAPI at `api.atmyhome.tech/docs`.

---

## 0. The security model (read this first)

Every phone is treated as hostile. The client is only ever a *claim generator* — the
**server-side judge is the single source of truth**. Nothing you harden on the client can
*invent* a PRESENT; it can only present a claim the judge accepts. So the real guarantees
are server-side:

- the **per-device `secret_hmac_key`** (minted at bind, only on your device) is required to
  produce a valid HMAC;
- the claim must use a **server-issued, single-use nonce**;
- the **token** you present must have been live at the moment you claim you saw it
  (membership) and the timestamp must be fresh (no replays / forged times).

Client hardening (C++ FFI black box, `--obfuscate`, secure storage, biometric-at-boot) is
**layered deterrence** — it makes a modder's job much harder, it does **not** make the APK
"mathematically unremovable." If you need that, the real answer is OS attestation
(Play Integrity), documented but out of scope here.

### The four gates

| Gate | What proves it | Where it runs |
|---|---|---|
| **G1 Hardware Tattoo** | `device_id_hash` (SHA-256 of hardware UUID) matches the bound device | client + server |
| **G2 Biometric Flesh Lock** | OS fingerprint / FaceID (`local_auth`) — the only "human" check | **client only** (boolean) |
| **G3 Visual Micro-Twitch** | you scanned a token that was live at your claimed instant | client + server |
| **G4 Crypto Time-Stamp** | HMAC-SHA256 seal over a fresh, server-anchored timestamp | client (**inside C++ FFI**) + server |

---

## 1. API key — required on every request

A client must present a shared **API key** minted from the Admin console
(`admin.atmyhome.tech → API Keys`). Sent on **every** request; without it → `401 ERR_AUTH_MISSING`.

```
X-Api-Key: ag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- It is a **licensing / throttle gate, not identity.** Anyone who can read the binary can
  extract it. Revoke + rotate if it leaks.
- Embed at build time: `--dart-define=API_KEY=ag_...` (see §0 of the pipeline).
- Build URL too: `--dart-define=API_BASE_URL=https://api.atmyhome.tech`.

---


## 1.5 Measured latency profile (tune against this)

From the reference deployment (`scripts/latency_test.py`, n≈30, public internet):

| Layer | p50 | p95 | worst |
|---|---|---|---|
| TCP connect (:443) | ~91 ms | ~95 ms | ~97 ms |
| Server handling (`/latency-ping`) | ~1.4 ms | ~3–9 ms | — |
| DB round-trip (`SELECT 1`) | ~1.4 ms | ~3–9 ms | — |
| **Full gated path** (`/student/status`) | ~370 ms | **~470 ms** | ~1.0–1.1 s |

**Reads:**
- The server + DB are ~1.4 ms — effectively free. The ~370–470 ms is **entirely the
  network/tunnel path** (Cloudflare -> cloudflared -> reverse proxies). Your network may
  differ — measure with `python3 scripts/latency_test.py 40` from your actual location.
- The claim gate is already **latency-agnostic**: anchored timestamp + membership + a
  freshness window (`maxAckDelayMs` default **5000**, `clockToleranceMs` default **500**) tuned
  to fit a ~1.5 s worst-case round-trip while rejecting stale replays. Do NOT re-introduce
  an absolute 250 ms window — it will fail on this path.

**Why you must anchor to the challenge timestamp (§7.1):**
On a ~470 ms p95 path, an absolute `claimed - birth ≤ 250 ms` gate is untouchable: the
round-trip *alone* exceeds the window, so any honest claim fails. By setting
`client_claimed_time = challenge.server_time_ms + elapsed`, the server compares your claim
against its OWN clock taken a moment earlier — the network never matters for the timestamp.

## 2. THE CHRONOLOGICAL CLIENT FLOW

This is the exact sequence a correct client follows, from first launch to a PRESENT.

```
 ╔═══════════════════════════ THE CLIENT FLOW ═══════════════════════════╗
 ║                                                                        ║
 ║  [1] HARDWARE IDENTITY  (once)                                         ║
 ║      hardware UUID -> KeyStore -> SHA-256 -> device_id_hash              ║
 ║      provision OR login OR bind (server mints secret_hmac_key)          ║
 ║                                                                        ║
 ║  [2] BOOT: BIOMETRIC + AUTO-LOGIN (every launch)                       ║
 ║      keychain unlock -> Gate-2 biometric prompt -> auto-login           ║
 ║      (a device that reaches the scanner has proven flesh)              ║
 ║                                                                        ║
 ║  [3] MIN-RTT TIME SYNC  (background + before every scan)               ║
 ║      take N /time-sync samples, keep the lowest-RTT drift              ║
 ║                                                                        ║
 ║  [4] USER HITS "MARK ATTENDANCE" -> SCANNER                            ║
 ║      Gate-3 subliminal-flash loop: ignore anchors, catch the flash     ║
 ║      (wait out one full 3s window in case of a miss)                   ║
 ║                                                                        ║
 ║  [5] GATE-4 SEALING (inside C++ FFI)                                   ║
 ║      fetch challenge (nonce + server_time_ms)                          ║
 ║      C++lib: compute True Time + HMAC over canonical string -> {t,sig} ║
 ║      Dart POSTs /claim-attendance                                      ║
 ║                                                                        ║
 ║  [6] HANDLE THE RESPONSE                                               ║
 ║      200 PRESENT -> success | error.code ERR_* -> recovery action      ║
 ╚═══════════════════════════════════════════════════════════════════════╝
```

### STEP 1 — Hardware identity & provisioning (once per device)

**⛔ MUST:** `device_id_hash` is `SHA-256` of a **hardware-stable UUID generated once** and
held in the OS KeyStore/Keychain (Android Keystore / iOS Keychain). It must **survive
reinstalls** as the binding — never `randomUUID()` on every launch.

1. Meaning once: generate `uuid4()`, store in `flutter_secure_storage`
   (`AppConstants.storageDeviceId`), compute `device_id_hash = sha256hex(uuid)`.
2. Provisioning (under `X-Api-Key`):
   - `POST /api/v1/student/status` `{id: roll}` → registered / bound?
   - `POST /api/v1/student/register` `{id, name, password}` → `201` (student JWT in `access_token`).
   - `POST /api/v1/student/login` → `access_token` (for existing students).
   - `POST /api/v1/student/device/bind` (`Authorization: Bearer <jwt>`, body `{device_id_hash}`)
     → returns the **`secret_hmac_key` (64 hex)**. Store ONLY in secure storage; it leaves
     the device only into the C++ sealing lib.
   - `POST /api/v1/student/password/set` when the server reports `has_password: false`.

Persist the session (KeyStore): `access_token`, `student_uuid`, `roll_no`, `secret_hmac_key`,
`device_id_hash`.

### STEP 2 — Boot: Gate-2 biometric + auto-login

**Recommended placement — mandatory, at boot, BEFORE any network init:**

```
1. unlock secure keychain (load credentials)
2. ⛔ GATE-2 biometric prompt (local_auth). Fail -> block the session.
3. only then: start network (time sync, Rest client, socket)
4. if a valid session exists -> auto-login to Home; else -> sign-in
```

Rationale: Gate 2 is the **only flesh check** in the system. An unattended / mounted /
automated phone dead-ends at the prompt. Also re-prompt per attendance is fine
(defense-in-depth) but the boot prompt is mandatory.

### STEP 3 — Min-RTT time sync (Gate-4 prerequisite)

`GET /api/v1/time-sync` → `{ server_epoch }`. **Do not trust a single sample** — on a
proxied/tunnelled backend a one-off sample is asymmetric and jittery. The reference client:

- takes **N ≥ 3** samples,
- keeps the sample with the **smallest RTT** (least queueing ⇒ truest half-trip),
- keeps a **drift offset** `driftOff = server_epoch + rtt/2 − t1`,
- re-syncs continuously (≈ every 5 min) and **always before a scan**.

The drift is used for the UI "clock synced" indicator and as a fallback; the authoritative
timestamp comes from the challenge (STEP 5).

### STEP 4 — The subliminal-flash camera loop (Gate 3)

The projector rotates: an **anchor** `ATTN:<session_uuid>` (no token, shown most of the time)
and a **flash** `ATTN:<session_uuid>:<token>` (token = 4-char base62, shown briefly each
3 s cycle). The token is **shared** by the whole class (not consumed per claim).

**⛔ MUST — parse the full 3 s window (~90 frames @30fps):**
- Ignore anchors (record the session).
- Keep decoding the whole window so the brief flash is not missed.
- Capture the **first payload with a token**; submit that exact token.
- **Never re-fetch a token from the server** — sign the one the lens saw (a re-fetch breaks
  the HMAC).
- If a whole window elapses with no flash, surface "No flash in this window — keep holding
  steady" and keep scanning (the next anchor auto-re-arms the window).

Reference reader (conceptual):
```text
loop:
  raw = decode_frame()
  if raw starts with "ATTN:" and session is a 36-char uuid:
     (session, token) = split(raw)
     if token empty:            -> anchor; remember session; keep scanning
     else if 1..4 chars (base62): -> FLASH; feed Gate 4; submit; exit
```

**Anti-stream note:** the projector may render the flash in **isoluminant chroma** (see
`docs/PROJECTOR_ISOLUMINANCE.md`) so that a 4:2:0 video stream crushes the boundaries.
Your local camera decodes it via raw chroma; your scanner logic is unchanged — just decode
normally and treat a token ≥ 1 char as valid flash. If isolation breaks against some
cameras, keep the anchor B/W and only the token frame isoluminant.

### STEP 5 — Gate-4 cryptographic sealing (C++ FFI black box)

Two sub-steps:

**(a) Authoritative timestamp + nonce (over HTTP, Dart side):**
```
POST /api/v1/sessions/{session_uuid}/challenge
   -> { "nonce": "...", "server_time_ms": <epoch ms>, "issued_at_epoch": <...>,
        "expires_at_epoch": <...> }
```
Record `tBefore = localNow` before the call, `tAfter` after. Then
`client_claimed_time = server_time_ms + (tAfter − tBefore)` (Layer-2 anchor — immune to
device-clock drift and infra RTT).

**(b) Seal inside the native library (do NOT build the canonical string in Dart):**
Pass the opaque inputs to the C++ FFI function (Appendix A). It computes True Time and the
HMAC-SHA256 and returns `(client_claimed_time, hmac_hex)`. Dart only forwards these into the
claim payload.

```
POST /api/v1/claim-attendance        (X-Api-Key + Authorization: Bearer <student JWT>)
{
  "session_uuid":       "...",
  "student_uuid":       "...",
  "token_val":          "Ab3d",
  "client_claimed_time": <from FFI>,
  "device_id_hash":     "<sha256 hex>",
  "nonce":              "<from challenge>",
  "hmac_signature":     <from FFI>
}
```

### STEP 6 — Handle the response

Success (200) is unenveloped:
```json
{ "status":"PRESENT", "message":"Attendance verified", "verification_delta_ms": 42, "ledger_uuid":"..." }
```
`"already logged"` is also a 200 success (idempotent) — don't show it as an error; lock the
button for ~1 s to prevent double-submit.

Every failure is the standardized envelope — **branch on `error.code`** (see
`docs/ERROR_DICTIONARY.md`):

| code | HTTP | client UI |
|---|---|---|
| `ERR_HW_MISMATCH` | 403 | Route user to Admin Desk for a device reset / re-bind. No auto-retry. |
| `ERR_SIG_INVALID` | 401 | "Security verification failed." Re-scan once; if persistent, force re-login. |
| `ERR_STREAM_DETECTED` | 412 | "Attendance window closed / streaming detected." Re-scan; point at the LCD. |
| `ERR_TOKEN_EXPIRED` | 406 | "Token expired — re-scan the live projector now." |
| `ERR_NONCE_USED` | 400 | Silently fetch a fresh nonce + resubmit once. |
| `ERR_NONCE_INVALID` | 400 | Fetch a fresh nonce + retry. |
| `ERR_AUTH_MISSING` | 401 | Re-login; ensure `X-Api-Key` is embedded. |
| `ERR_RATE_LIMIT` | 429 | Back off per `Retry-After`. |

---

## Appendix A — C++ FFI sealing pipeline (Step 1 of the brief)

Goal: move Gate-4 (True-Time + HMAC-SHA256) out of Dart into an obfuscation-friendly native
library, so decompilers can't trivially read or skip the seal.

### A.1 Layout
```
app/
  android/app/src/main/cpp/
    CMakeLists.txt
    ffi_gate.cc
    ffi_gate.h
  lib/core/crypto/ffi_gate.dart     # dart:ffi bindings (only API surface in Dart)
```
Build the native lib as a **static** library and let Flutter bundle it (recommended on
Android) or as a shared `.so` you open with `DynamicLibrary.open('libffi_gate.so')`.

### A.2 CMakeLists.txt (Android)
```cmake
cmake_minimum_required(VERSION 3.10)
project(ffi_gate)

add_library(ffi_gate SHARED ffi_gate.cc)
target_compile_features(ffi_gate PUBLIC cxx_std_17)
# AES/crypto is your own; for HMAC-SHA256 you may vendor a compact implementation
# (e.g. a single-file SHA-256) to avoid pulling OpenSSL into the APK.

# Keep symbols obfuscated where possible; ship with -O2 -fvisibility=hidden
target_compile_options(ffi_gate PRIVATE -O2 -fvisibility=hidden -fno-stack-protector)
```
Reference the build from `app/android/app/build.gradle.kts`:
```kotlin
android {
  externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt") } }
}
```

### A.3 The C ABI (what Dart calls)
The function returns a single heap buffer (so Dart can't inspect intermediate HMAC state).
Keep the canonical string construction **inside** the library so Dart never forms it.

```c
// ffi_gate.h
typedef struct {
  const char* session_uuid;
  const char* student_uuid;
  const char* token_val;
  const char* device_id_hash;
  const char* nonce;
  const char* secret_hmac_key;   // hex key, read from KeyStore by Dart, passed in
  double      drift_offset_ms;   // from min-RTT sync (or 0 when server-anchored)
  int64_t     server_now_ms;     // server_time_ms from the challenge (authoritative)
} Gate4Input;

typedef struct {
  int64_t client_claimed_time_ms; // True Time the server should compare
  char    hmac_hex[65];           // hex lowercase HMAC-SHA256
} Gate4Output;

// Allocates the output; caller frees with ffi_gate_free_output().
Gate4Output* ffi_gate_seal(const Gate4Input* in);
void         ffi_gate_free_output(Gate4Output* out);
```

### A.4 True-Time semantics inside C
Prefer the **server-anchored** path (robust on a high-latency backend):
```c
int64_t now_local_ms(void);                       // std::chrono::system_clock
int64_t claim = in->server_now_ms + (now_local_ms() - /* captured just before challenge */);
```
Fallback (no challenge time): `claim = now_local_ms() + (int64_t)in->drift_offset_ms;`

### A.5 The canonical string + HMAC (inside the library only)
```text
canonical = "{session_uuid}|{student_uuid}|{token_val}|{client_claimed_time}|{device_id_hash}|{nonce}"
signature = HMAC_SHA256(hexDecode(secret_hmac_key), canonical)   // lowercase hex
```
No Dart code ever constructs this string; Dart only forwards the six opaque inputs and reads
`{client_claimed_time, hmac_hex}` back.

### A.6 Dart side (minimal, obfuscated-safe)
```dart
final lib = DynamicLibrary.open('libffi_gate.so');
final seal = lib.lookupFunction<Pointer<Gate4Output> Function(Pointer<Gate4Input>),
                                Pointer<Gate4Output> Function(Pointer<Gate4Input>)>('ffi_gate_seal');
// Allocate Gate4Input, fill pointers, call seal, read output, free.
```

### A.7 Build & strengthen
- `flutter build apk --release --obfuscate --split-debug-info=build/symbols \
  --dart-define=API_BASE_URL=... --dart-define=API_KEY=...`
- Strip debug symbols from the `.so` (`-g0` / `strip`), keep `--split-debug-info` locally.
- **Honest scope:** this is layered deterrence. The `.so` is extractable and a Frida hook at
  the FFI boundary can still read inputs/outputs, and the `secret_hmac_key` crosses that
  boundary each call. It makes naive decompile + "skip the biometric/HMAC" patches much
  harder and deters casual modders. It does **not** provide the mathematical guarantee a
  student cannot forge — that is the server's job (nonce + per-device secret + token
  membership). For true anti-modding against adversaries, add **Play Integrity / SafetyNet
  attestation** (out of scope here).

---

## Appendix B — Security responsibilities (client checklist)

- ✅ `X-Api-Key` on **every** request.
- ✅ Gate-2 biometric at **boot, before network init**.
- ✅ `secret_hmac_key` + `device_id_hash` in the **secure keychain only**; pass the key into
  C++ at seal time, never persist it in Dart.
- ✅ Anchor `client_claimed_time` to `challenge.server_time_ms + elapsed` (robust to RTT/clock).
- ✅ Keep the Gate-3 loop running the **full 3 s window**; sign the **exact scanned token**.
- ✅ Use only the **server-issued nonce**, once.
- ✅ Branch on `error.code`; map every failure to a message + recovery action.
- ✅ Re-decode the flash normally even if the projector is isoluminant (§4).
- ❌ Never show stack traces / HMAC / UUIDs / nonces / KeyStore internals in the UI.
- ❌ No manual "token refresh" button (bypasses Gate 3).