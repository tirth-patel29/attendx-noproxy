# Attendance Gateway — Client Integration Guide

> **The authoritative contract for anyone building a client** (Flutter, native Android/iOS, React Native, etc.) that talks to `https://api.atmyhome.tech`.
>
> Read this **entire document** before writing code. **⛔ MUST** rules are security-critical and non-negotiable.
>
> Version: **2026-08-21** — matches backend commit `025b9f8` (Gitea: `het/attendance-gateway`)

---

## 0. Architecture & Security Model (Read First)

### 0.1 The Threat Model

**Every client device is assumed hostile.** Students will try to:
- Spoof GPS / location
- Run the app on an emulator / rooted device
- Replay a screenshot of a QR code from home
- Relay a live stream via Discord / WhatsApp / Meet
- Patch the APK to skip biometric checks
- Forge HMAC signatures by extracting the secret key

**The server is the only source of truth.** The client is merely a *claim generator* — it produces a cryptographic claim that the server's **Judge Service** validates. Nothing you harden on the client can *invent* a `PRESENT`; it can only present a claim the judge accepts.

### 0.2 The Four Gates (All Must Pass)

| Gate | Name | What Proves It | Where It Runs |
|------|------|----------------|---------------|
| **G1** | **Hardware Tattoo** | `device_id_hash` (SHA-256 of hardware UUID) matches the bound device in `students.bound_device_id` | Client generates hash → Server validates |
| **G2** | **Biometric Flesh Lock** | OS fingerprint / FaceID (`local_auth` → boolean `true`) | **Client only** — the *only* "human" check |
| **G3** | **Visual Micro-Twitch** | You scanned a token that was **live at your claimed instant** (membership) | Client scans → Server validates token liveness |
| **G4** | **Crypto Time-Stamp** | HMAC-SHA256 seal over a **server-anchored** timestamp + fresh nonce | **Client (inside C++ FFI)** signs → Server verifies |

> **Client hardening** (C++ FFI black box, `--obfuscate`, secure storage, biometric-at-boot) is **layered deterrence** — it makes a modder's job much harder, it does **not** make the APK "mathematically unforgeable." If you need that guarantee, the real answer is **OS attestation** (Play Integrity / App Attest), documented in §9 but out of scope for this guide.

---

## 1. Prerequisites & Build Configuration

### 1.1 API Key (Required on Every Request)

A client must present a shared **API key** minted from the Admin console (`admin.atmyhome.tech → API Keys`).

```http
X-Api-Key: ag_xxx...xxxx
```

- Sent on **every** request (including `/time-sync`, `/latency-ping`, `/claim-attendance`, etc.)
- Missing/expired/revoked → `401 ERR_AUTH_MISSING`
- It is a **licensing / throttle gate, not identity.** Anyone who can read the binary can extract it. Revoke + rotate if it leaks.
- **Embed at build time:**
  ```bash
  flutter build apk --release \
    --dart-define=API_BASE_URL=https://api.atmyhome.tech \
    --dart-define=API_KEY=ag_xxx...xxxx \
    --obfuscate --split-debug-info=build/symbols
  ```

### 1.2 API Base URL

```
https://api.atmyhome.tech
```
All endpoints are under `/api/v1/...` — use the full base URL + path.

### 1.3 OpenAPI / Swagger

Interactive docs: **https://api.atmyhome.tech/docs**  
Raw spec: **https://api.atmyhome.tech/openapi.json**

Use this to generate typed clients (Dart, Kotlin, Swift, TypeScript).

---

## 2. Measured Latency Profile (Tune Against This)

From the reference deployment (`scripts/latency_test.py`, n≈30, public internet):

| Layer | p50 | p95 | Worst |
|-------|-----|-----|-------|
| TCP connect (:443) | ~91 ms | ~95 ms | ~97 ms |
| Server handling (`/latency-ping`) | ~1.4 ms | ~3–9 ms | — |
| DB round-trip (`SELECT 1`) | ~1.4 ms | ~3–9 ms | — |
| **Full gated path** (`/student/status`) | ~370 ms | **~470 ms** | ~1.0–1.1 s |

**Key takeaways:**
- The server + DB are ~1.4 ms — effectively free. The ~370–470 ms is **entirely the network/tunnel path** (Cloudflare → cloudflared → reverse proxies). Your network may differ — measure with `python3 scripts/latency_test.py 40` from your actual location.
- The claim gate is **latency-agnostic**: anchored timestamp + membership + a freshness window (`maxAckDelayMs` default **5000**, `clockToleranceMs` default **500**) tuned to fit a ~1.5 s worst-case round-trip while rejecting stale replays.
- **Do NOT re-introduce an absolute 250 ms window** — it will fail on this path.

**Why you MUST anchor to the challenge timestamp (§7.1):**  
On a ~470 ms p95 path, an absolute `claimed - birth ≤ 250 ms` gate is untouchable: the round-trip *alone* exceeds the window, so any honest claim fails. By setting `client_claimed_time = challenge.server_time_ms + elapsed`, the server compares your claim against its OWN clock taken a moment earlier — the network never matters for the timestamp.

---

## 3. Chronological Client Flow (The Exact Sequence)

```
 ╔═══════════════════════════ THE CLIENT FLOW ═══════════════════════════╗
 ║                                                                        ║
 ║  [1] HARDWARE IDENTITY  (once per device lifetime)                     ║
 ║      hardware UUID → KeyStore → SHA-256 → device_id_hash               ║
 ║      provision → login → bind (server mints secret_hmac_key)           ║
 ║                                                                        ║
 ║  [2] BOOT: BIOMETRIC + AUTO-LOGIN (every launch)                       ║
 ║      keychain unlock → Gate-2 biometric prompt → auto-login            ║
 ║      (a device that reaches the scanner has proven flesh)             ║
 ║                                                                        ║
 ║  [3] MIN-RTT TIME SYNC (background + before every scan)                ║
 ║      take N /time-sync samples, keep the lowest-RTT drift             ║
 ║                                                                        ║
 ║  [4] USER HITS "MARK ATTENDANCE" → SCANNER                             ║
 ║      Gate-3 subliminal-flash loop: ignore anchors, catch the flash    ║
 ║      (wait out one full 3s window in case of a miss)                  ║
 ║                                                                        ║
 ║  [5] GATE-4 SEALING (inside C++ FFI)                                   ║
 ║      fetch challenge (nonce + server_time_ms)                          ║
 ║      C++lib: compute True Time + HMAC over canonical string → {t,sig} ║
 ║      Dart POSTs /claim-attendance                                      ║
 ║                                                                        ║
 ║  [6] HANDLE THE RESPONSE                                               ║
 ║      200 PRESENT → success | error.code ERR_* → recovery action        ║
 ╚═══════════════════════════════════════════════════════════════════════╝
```

---

## 4. STEP 1 — Hardware Identity & Provisioning (Once Per Device)

### 4.1 Device ID Generation

**⛔ MUST:** `device_id_hash` is `SHA-256` of a **hardware-stable UUID generated once** and held in the OS KeyStore/Keychain (Android Keystore / iOS Keychain). It must **survive reinstalls** as the binding — never `randomUUID()` on every launch.

```dart
// Pseudocode
final uuid = await FlutterSecureStorage.read(key: 'device_uuid') ?? 
             (() { final u = Uuid().v4(); FlutterSecureStorage.write(key: 'device_uuid', value: u); return u; })();
final deviceIdHash = sha256.convert(utf8.encode(uuid)).toString();
```

### 4.2 Provisioning Flow (All Under `X-Api-Key`)

| Step | Endpoint | Request | Response |
|------|----------|---------|----------|
| 1. Check status | `POST /api/v1/student/status` | `{ "id": "24DCE051" }` | `{ registered: true, bound: true, has_password: true }` |
| 2. Register (if new) | `POST /api/v1/student/register` | `{ id, name, email, division_id?, password }` | `201 { access_token, student_uuid }` |
| 3. Login (if existing) | `POST /api/v1/student/login` | `{ id, password }` | `200 { access_token, student_uuid }` |
| 4. Bind device | `POST /api/v1/student/device/bind` (Bearer JWT) | `{ device_id_hash }` | `201 { secret_hmac_key: "64_hex_chars" }` |
| 5. Set password (if needed) | `POST /api/v1/student/password/set` (Bearer JWT) | `{ password }` | `200 { message: "Password set" }` |

**Persist securely** (KeyStore/Keychain): `access_token`, `student_uuid`, `roll_no`, `secret_hmac_key`, `device_id_hash`.

---

## 5. STEP 2 — Boot: Gate-2 Biometric + Auto-Login

### 5.1 Mandatory Placement

**⛔ MUST run at app boot, BEFORE any network init:**

```dart
// Pseudocode - runs in main() before runApp()
Future<void> bootSequence() async {
  // 1. Unlock secure keychain (load credentials from KeyStore)
  final creds = await SecureStorage.loadAll();
  
  // 2. ⛔ GATE-2 biometric prompt (local_auth) - MANDATORY
  final didAuth = await LocalAuthentication.authenticate(
    localizedReason: 'Prove you are the enrolled student',
    options: const AuthenticationOptions(
      biometricOnly: true,
      stickyAuth: true,
    ),
  );
  if (!didAuth) {
    // Block the session - show "Biometric required" screen
    runApp(BiometricRequiredScreen());
    return;
  }
  
  // 3. Only then: start network (time sync, REST client, socket)
  await TimeSyncService.startContinuousSync();
  ApiClient.init(creds.accessToken);
  
  // 4. Auto-login or show sign-in
  if (creds.hasValidSession) {
    runApp(HomeScreen());
  } else {
    runApp(SignInScreen());
  }
}
```

**Rationale:** Gate 2 is the **only flesh check** in the system. An unattended / mounted / automated phone dead-ends at the prompt. Re-prompt per attendance is optional (defense-in-depth) but the boot prompt is mandatory.

---

## 6. STEP 3 — Min-RTT Time Sync (Gate-4 Prerequisite)

### 6.1 Why Not a Single Sample?

On a proxied/tunnelled backend (Cloudflare → cloudflared → reverse proxies), a single Cristian's sample is asymmetric and jittery. The return path is NOT exactly `rtt/2`.

### 6.2 Reference Algorithm

```dart
class TimeSyncService {
  static int? _driftOffsetMs; // server_time - local_time
  
  static Future<void> sync({int samples = 5}) async {
    int bestDrift = 0;
    int bestRtt = 999999;
    
    for (int i = 0; i < samples; i++) {
      final t1 = DateTime.now().millisecondsSinceEpoch;
      final resp = await http.get('$BASE/api/v1/time-sync');
      final t4 = DateTime.now().millisecondsSinceEpoch;
      
      if (resp.statusCode != 200) continue;
      final serverEpoch = jsonDecode(resp.body)['server_epoch'] as int;
      final rtt = t4 - t1;
      
      // Cristian's estimate: server_time = server_epoch + rtt/2
      // drift = server_time - local_time_at_t1
      final drift = (serverEpoch + rtt ~/ 2) - t1;
      
      if (rtt < bestRtt) {
        bestRtt = rtt;
        bestDrift = drift;
      }
      
      // Small delay between samples
      await Future.delayed(const Duration(milliseconds: 50));
    }
    
    _driftOffsetMs = bestDrift; // Keep the lowest-RTT sample
  }
  
  static int getEstimatedServerTimeMs() {
    return DateTime.now().millisecondsSinceEpoch + (_driftOffsetMs ?? 0);
  }
}
```

- Run **continuously in background** (≈ every 5 min)
- **Always re-sync right before a scan** (step 4 → 5 transition)
- The drift is used for UI "clock synced" indicator and as a fallback; the **authoritative timestamp comes from the challenge** (Step 5a).

---

## 7. STEP 4 — The Subliminal-Flash Camera Loop (Gate 3)

### 7.1 What the Projector Shows

The projector rotates every 3 seconds:
- **Anchor (2900 ms):** `ATTN:<session_uuid>` — no token, shown most of the time
- **Flash (100 ms):** `ATTN:<session_uuid>:<token>` — 4-char base62 token, shown briefly

The token is **shared** by the whole class (not consumed per claim).

### 7.2 Camera Loop Requirements

**⛔ MUST — parse the full 3 s window (~90 frames @30fps):**

```dart
// Pseudocode - runs in a tight loop while "Mark Attendance" screen is open
Future<String?> scanLoop(String expectedSession) async {
  final controller = CameraController(...);
  await controller.initialize();
  await controller.startImageStream((image) async {
    final results = await _decodeFrame(image);
    for (final result in results) {
      if (!result.startsWith('ATTN:')) continue;
      
      final parts = result.split(':');
      if (parts.length < 2) continue;
      
      final session = parts[1];
      if (session != expectedSession) continue; // wrong session
      
      if (parts.length == 2) {
        // Anchor frame - no token yet, keep scanning
        continue;
      }
      
      final token = parts[2];
      if (token.length >= 1 && token.length <= 4) {
        // FLASH! Found the token
        return token; // Exit loop, proceed to Gate 4
      }
    }
  });
  
  // Wait full 3s window before giving up
  await Future.delayed(const Duration(seconds: 3));
  throw NoFlashException('No flash in this window — keep holding steady');
}
```

**Critical rules:**
- **Ignore anchors** (record the session, keep scanning)
- **Never re-fetch a token from the server** — sign the one the lens saw (a re-fetch breaks the HMAC)
- If a whole 3s window elapses with no flash, surface "No flash in this window — keep holding steady" and keep scanning

### 7.3 Anti-Stream Note

The projector may render the flash in **isoluminant chroma** (see `docs/PROJECTOR_ISOLUMINANCE.md`) so that a 4:2:0 video stream crushes the boundaries. Your local camera decodes it via raw chroma; your scanner logic is unchanged — just decode normally and treat a token ≥ 1 char as valid flash.

---

## 8. STEP 5 — Gate-4 Cryptographic Sealing (C++ FFI Black Box)

### 8.1 Sub-step 5a: Authoritative Timestamp + Nonce (Dart Side)

```dart
// Called right before scanning completes, or immediately after token capture
Future<ChallengeResponse> fetchChallenge(String sessionUuid) async {
  final tBefore = DateTime.now().millisecondsSinceEpoch;
  final resp = await http.post(
    '$BASE/api/v1/sessions/$sessionUuid/challenge',
    headers: { 'X-Api-Key': apiKey, 'Authorization': 'Bearer $accessToken' },
  );
  final tAfter = DateTime.now().millisecondsSinceEpoch;
  
  if (resp.statusCode != 200) throw Exception('Challenge failed: ${resp.body}');
  
  final data = jsonDecode(resp.body);
  final serverTimeMs = data['server_time_ms'] as int; // Authoritative!
  final elapsed = tAfter - tBefore;
  
  // Layer-2 anchor: immune to device-clock drift + infra RTT
  final clientClaimedTime = serverTimeMs + (tAfter - tBefore);
  
  return ChallengeResponse(
    nonce: data['nonce'] as String,
    serverTimeMs: serverTimeMs,
    clientClaimedTime: clientClaimedTime,
    issuedAt: data['issued_at_epoch'] as int,
    expiresAt: data['expires_at_epoch'] as int,
  );
}
```

### 8.2 Sub-step 5b: Seal Inside Native Library (C++ FFI)

**⛔ MUST:** The canonical string construction + HMAC-SHA256 happens **inside the native library**. Dart only forwards opaque inputs and reads `{client_claimed_time, hmac_hex}` back.

#### 8.2.1 Android CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.10)
project(ffi_gate)

add_library(ffi_gate SHARED ffi_gate.cc)
target_compile_features(ffi_gate PUBLIC cxx_std_17)
# Use a compact SHA-256 implementation (single-file) to avoid OpenSSL bloat
target_compile_options(ffi_gate PRIVATE -O2 -fvisibility=hidden -fno-stack-protector)
```

Reference from `app/android/app/build.gradle.kts`:
```kotlin
android {
  externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt") } }
}
```

#### 8.2.2 The C ABI (ffi_gate.h)

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

#### 8.2.3 True-Time Semantics Inside C++

```cpp
// Prefer the SERVER-ANCHORED path (robust on high-latency backend):
int64_t now_local_ms() {
  using namespace std::chrono;
  return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

int64_t compute_claim_time(const Gate4Input* in) {
  int64_t now = now_local_ms();
  // server_now_ms captured just before challenge request
  return in->server_now_ms + (now - /* captured just before challenge */);
}
```

Fallback (no challenge time): `claim = now_local_ms() + (int64_t)in->drift_offset_ms;`

#### 8.2.4 Canonical String + HMAC (Inside Library Only)

```text
canonical = "{session_uuid}|{student_uuid}|{token_val}|{client_claimed_time}|{device_id_hash}|{nonce}"
signature = HMAC_SHA256(hexDecode(secret_hmac_key), canonical)   // lowercase hex
```

**No Dart code ever constructs this string.** Dart only forwards the six opaque inputs and reads `{client_claimed_time, hmac_hex}` back.

#### 8.2.5 Dart FFI Binding (Minimal)

```dart
final lib = DynamicLibrary.open('libffi_gate.so');
final seal = lib.lookupFunction<
    Pointer<Gate4Output> Function(Pointer<Gate4Input>),
    Pointer<Gate4Output> Function(Pointer<Gate4Input>)
>('ffi_gate_seal');

// Allocate Gate4Input, fill pointers, call seal, read output, free.
```

### 8.3 Build & Strengthen

```bash
flutter build apk --release \
  --obfuscate --split-debug-info=build/symbols \
  --dart-define=API_BASE_URL=https://api.atmyhome.tech \
  --dart-define=API_KEY=ag_xxx...xxxx
```

- Strip debug symbols from the `.so` (`-g0` / `strip`), keep `--split-debug-info` locally.
- **Honest scope:** this is layered deterrence. The `.so` is extractable and a Frida hook at the FFI boundary can still read inputs/outputs, and the `secret_hmac_key` crosses that boundary each call. It makes naive decompile + "skip the biometric/HMAC" patches much harder and deters casual modders. It does **not** provide the mathematical guarantee a student cannot forge — that is the server's job (nonce + per-device secret + token membership). For true anti-modding against adversaries, add **Play Integrity / App Attest** (see §9).

---

## 9. STEP 6 — Handle the Response

### 9.1 Success (200) — Unenveloped

```json
{
  "status": "PRESENT",
  "message": "Attendance verified",
  "verification_delta_ms": 42,
  "ledger_uuid": "xxx..."
}
```

- `"already logged"` is also a **200 success** (idempotent) — don't show it as an error; lock the button for ~1 s to prevent double-submit.

### 9.2 Failures — Standardized Envelope

Every failure returns the standardized envelope — **branch on `error.code`** (see `docs/ERROR_DICTIONARY.md`):

| code | HTTP | Client UI Action |
|------|------|------------------|
| `ERR_HW_MISMATCH` | 403 | Route user to Admin Desk for a device reset / re-bind. No auto-retry. |
| `ERR_SIG_INVALID` | 401 | "Security verification failed." Re-scan once; if persistent, force re-login. |
| `ERR_STREAM_DETECTED` | 412 | "Attendance window closed / streaming detected." Re-scan; point at the LCD. |
| `ERR_TOKEN_EXPIRED` | 406 | "Token expired — re-scan the live projector now." |
| `ERR_NONCE_USED` | 400 | Silently fetch a fresh nonce + resubmit once. |
| `ERR_NONCE_INVALID` | 400 | Fetch a fresh nonce + retry. |
| `ERR_AUTH_MISSING` | 401 | Re-login; ensure `X-Api-Key` is embedded. |
| `ERR_RATE_LIMIT` | 429 | Back off per `Retry-After`. |
| `ERR_BAD_REQUEST` | 400 | Show `error.message` (validation details). |
| `ERR_NOT_FOUND` | 404 | Resource missing (session, student, etc.). |
| `ERR_FORBIDDEN` | 403 | Not authorized for this action. |

---

## 10. API Reference (Quick Lookup)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/time-sync` | GET | X-Api-Key | Cristian's time sync (server epoch) |
| `/api/v1/latency-ping` | GET | X-Api-Key | Deep latency breakdown |
| `/api/v1/professor/current-lecture` | GET | Bearer (prof) | Auto-detect current lecture (IST) |
| `/api/v1/professor/timetable` | GET | Bearer (prof) | Weekly timetable + today |
| `/api/v1/sessions/start` | POST | Bearer (prof) | Start attendance session |
| `/api/v1/sessions/:id/challenge` | POST | Bearer (prof) | Get nonce + server_time_ms |
| `/api/v1/claim-attendance` | POST | X-Api-Key + Bearer (student) | Submit attendance claim |
| `/api/v1/time/validate` | POST | X-Api-Key | **Headless server-side validation** |
| `/api/v1/student/status` | POST | X-Api-Key | Check registration/binding |
| `/api/v1/student/register` | POST | X-Api-Key | Self-register |
| `/api/v1/student/login` | POST | X-Api-Key | Student login |
| `/api/v1/student/device/bind` | POST | Bearer (student) | Bind device, get HMAC key |
| `/api/v1/student/password/set` | POST | Bearer (student) | Set initial password |

Full interactive docs: **https://api.atmyhome.tech/docs**

---

## 11. Error Dictionary (Complete)

See `docs/ERROR_DICTIONARY.md` for the full machine-readable table. Key codes above in §9.2.

---

## 12. Testing Checklist (Before Shipping)

| Test | Expected |
|------|----------|
| Fresh install → boot → biometric prompt appears before any network | ✅ |
| Valid credentials → login → auto-login on next boot | ✅ |
| Wrong password → 401 `ERR_AUTH_MISSING` with proper UI | ✅ |
| Time sync runs continuously, re-syncs before scan | ✅ |
| Camera loop runs full 3s window, catches flash | ✅ |
| Flash token captured → challenge fetched → C++ seal → claim submitted | ✅ |
| Valid claim → 200 PRESENT | ✅ |
| Duplicate claim → 200 "already logged" | ✅ |
| Wrong password → 401 with proper UI (no crash) | ✅ |
| Screenshot of old QR → 406 `ERR_TOKEN_EXPIRED` | ✅ |
| Discord/Meet stream relay → 412 `ERR_STREAM_DETECTED` | ✅ |
| Nonce reuse → 400 `ERR_NONCE_USED` (silent retry works) | ✅ |
| Missing API key → 401 `ERR_AUTH_MISSING` | ✅ |
| Revoked API key → 401 | ✅ |
| Biometric cancel → blocked session | ✅ |
| App backgrounded during scan → resumes correctly | ✅ |
| Network flaky (high latency) → still passes (anchored timestamp) | ✅ |

---

## 13. Appendix: C++ FFI Reference Implementation

See **Appendix A** in the original guide (§8.2) for complete `CMakeLists.txt`, `ffi_gate.h`, `ffi_gate.cc`, and Dart binding code.

---

## 14. Appendix: Play Integrity / App Attest (True Anti-Modding)

If you need **cryptographic proof** that the claim came from a genuine, unmodified app on real hardware:

### Android (Play Integrity)
1. Enable Play Integrity API in Google Play Console
2. Client requests nonce → `IntegrityManager.requestIntegrityToken(nonce)`
3. Server sends token to `playintegrity.googleapis.com/v1/token:decode`
4. Verify `deviceIntegrity: ["MEETS_DEVICE_INTEGRITY", "MEETS_BASIC_INTEGRITY"]`
5. Verify `appIntegrity: "PLAY_RECOGNIZED"` (your package name + cert)
6. Only accept claims with a **valid, fresh integrity token**

### iOS (App Attest)
1. Generate attestation key: `DCAppAttestService.shared.generateKey()`
2. Attest key: `attestKey(_, clientDataHash:)` → produces `attestation`
3. Server verifies attestation against Apple's root CA
4. Each claim: `generateAssertion(_, clientDataHash:)` → produces `assertion`
5. Server verifies assertion with the attested public key

**This is the only way to get a mathematical guarantee the claim came from a genuine device + app.** The C++ FFI + obfuscation is deterrence; attestation is proof.

---

## 15. Quick Start (Copy-Paste)

```bash
# 1. Clone & configure
git clone https://git.atmyhome.tech/het/attendance-gateway
cd attendance-gateway

# 2. Get API key from admin console
# Admin → API Keys → Create → copy key

# 3. Build Flutter APK
cd app
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.atmyhome.tech \
  --dart-define=API_KEY=ag_your_key_here \
  --obfuscate --split-debug-info=build/symbols

# 4. Install on test device
adb install build/app/outputs/flutter-apk/app-release.apk

# 5. Test flow
# - Boot → biometric prompt → auto-login
# - Time sync indicator shows "synced"
# - "Mark Attendance" → camera opens → flash caught → PRESENT
```

---

## 16. Support & Updates

- **Backend repo:** https://git.atmyhome.tech/het/attendance-gateway
- **OpenAPI spec:** https://api.atmyhome.tech/openapi.json
- **Swagger UI:** https://api.atmyhome.tech/docs
- **Error dictionary:** `docs/ERROR_DICTIONARY.md`
- **Projector isoluminance spec:** `docs/PROJECTOR_ISOLUMINANCE.md`
- **Latency probe:** `scripts/latency_test.py`

**When the backend updates,** check the commit log for breaking changes. The OpenAPI spec is always the source of truth for request/response shapes.

---

*End of Client Integration Guide v2026-08-21*