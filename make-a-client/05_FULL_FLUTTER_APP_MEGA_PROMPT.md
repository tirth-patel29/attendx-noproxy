# 05 — The Complete Flutter App Mega-Prompt (Copy-Paste Ready)

> **Instructions for Teammate**: Copy everything inside the block below and paste it directly into your AI coding agent (Cursor, Claude 3.5 Sonnet, Gemini, Windsurf, or Copilot). It contains the complete specification, mathematical rules, and API contracts required to build or finish the AttendX Flutter mobile app.

---

```markdown
# MEGA-PROMPT: Build the AttendX Zero-Trust Student Client in Flutter

You are an expert Flutter & Mobile Security engineer. Your task is to build the production mobile client application for **AttendX**, a zero-trust cryptographic classroom attendance gateway.

---

## 1. System Context & Security Model

AttendX verifies that a student is physically present in the classroom using **four mandatory security gates**:
1. **Gate 1 (Hardware Tattoo)**: Device-bound UUID stored in Secure Enclave, hashed via SHA-256 (`device_id_hash`). Prevents account sharing across devices.
2. **Gate 2 (Biometric Flesh Lock)**: Local OS fingerprint / Face ID prompt (`local_auth`) required before the camera can scan. Prevents proxy attendance (friends taking someone's phone).
3. **Gate 3 (Dual-State Optical QR Scan)**: Classroom projector switches every 3.0s between:
   - **Static Anchor (2.9s)**: `ATTN:<session_uuid>` (Phone cameras lock focus and exposure).
   - **Rotating Token Flash (0.1s / 100ms)**: `ATTN:<session_uuid>:<token_val>` (Sub-second optical seal).
   Camera continuously scans at high speed to capture the 100ms flash.
4. **Gate 4 (Cryptographic Timestamp & HMAC Wax Seal)**: Time calibrated via Cristian's Algorithm against `/api/v1/time-sync`. Canonical string `${session_uuid}|${student_uuid}|${token_val}|${client_claimed_time}|${device_id_hash}|${nonce}` is signed with HMAC-SHA256 using the student's bound `secret_hmac_key`. The server rejects any claim where latency $\Delta > 250\text{ ms}$.

---

## 2. API Endpoints & Configuration

- **Base URL**: `https://api.atmyhome.tech`
- **Mandatory Header on ALL Requests**: `X-Api-Key: <ADMIN_PROVISIONED_API_KEY>`
- **Student Auth Header**: `Authorization: Bearer <student_jwt_token>`

### Core Endpoints:
1. `POST /api/v1/student/register`
   - Body: `{"id": "24DCS093", "name": "Student Name", "password": "Pass"}`
   - Returns: `data.token`, `data.student`
2. `POST /api/v1/student/login`
   - Body: `{"id": "24DCS093", "password": "Pass"}`
   - Returns: `data.token`, `data.student.bound_device_id`
3. `POST /api/v1/student/device/bind` (Requires Bearer JWT)
   - Body: `{"device_id_hash": "<SHA256_OF_HARDWARE_UUID>"}`
   - Returns: `bound: true, secret_hmac_key: "<64_CHAR_HEX_KEY>", student_uuid: "<UUID>", roll_no: "<ROLL>"`
   - **MUST** store `secret_hmac_key` securely in `flutter_secure_storage`!
4. `GET /api/v1/time-sync`
   - Returns: `{"server_epoch": 1726190400000}`
5. `POST /api/v1/sessions/:session_uuid/challenge` (Requires Bearer JWT)
   - Returns: `{"data": {"challenge_nonce": "...", "server_time_ms": 1726190400123}}`
6. `POST /api/v1/claim-attendance` (Requires Bearer JWT)
   - Body:
     ```json
     {
       "session_uuid": "...",
       "student_uuid": "...",
       "token_val": "...",
       "client_claimed_time": 1726190400123,
       "device_id_hash": "...",
       "challenge_nonce": "...",
       "hmac_signature": "..."
     }
     ```
   - Success (200 OK): `{"status": "PRESENT", "verification_delta_ms": 42}`
   - Error (4xx): Standardized error envelope: `{"success": false, "error": {"code": "ERR_...", "message": "..."}}`

---

## 3. Required Project Structure & Dependencies

### `pubspec.yaml`
```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0
  crypto: ^3.0.3
  convert: ^3.1.1
  flutter_secure_storage: ^9.0.0
  uuid: ^4.3.3
  local_auth: ^2.1.8
  mobile_scanner: ^5.1.1
  permission_handler: ^11.3.0
```

### Folder Architecture
```text
lib/
├── main.dart
├── core/
│   ├── api_client.dart          # HTTP client automatically injecting X-Api-Key and Bearer JWT
│   ├── storage_service.dart     # flutter_secure_storage for JWT, UUID, HMAC key
│   ├── device_service.dart      # Generates/retrieves UUIDv4, returns SHA-256 hash
│   ├── biometric_service.dart   # local_auth Gate 2 prompt
│   ├── time_sync_service.dart   # Cristian's algorithm clock calibration (lowest RTT sample)
│   └── crypto_service.dart      # HMAC-SHA256 signature generator
└── features/
    ├── auth/                    # Login, Register, Device Binding check
    ├── scan/                    # High-speed dual-state optical scanner
    └── claim/                   # Fetch challenge, sign HMAC, submit claim, show PRESENT verdict
```

---

## 4. Key Implementation Rules (Must Follow)

### A. Dual-State Scanner (`mobile_scanner`)
- Must configure `detectionSpeed: DetectionSpeed.unrestricted`.
- In `onDetect`:
  - If raw code starts with `ATTN:` and contains **NO second colon**:
    - Extract `session_uuid = raw.substring(5)`.
    - Set state: **Anchor Locked**. Change viewfinder border from Cyan to Amber. Show: *"Session Locked! Hold steady for token flash..."*.
  - If raw code starts with `ATTN:` and contains a **second colon**:
    - Extract `session_uuid` and `token_val`.
    - **Flash Caught!** Immediately trigger `HapticFeedback.heavyImpact()`, stop camera, and return payload.

### B. Gate 4 HMAC-SHA256 Calculation
- Exact canonical string:
  ```dart
  final canonical = '$sessionUuid|$studentUuid|$tokenVal|${clientClaimedTimeMs.toString()}|$deviceIdHash|$nonce';
  ```
- Key is decoded from 64-char hex string:
  ```dart
  final keyBytes = hex.decode(secretHmacKeyHex);
  final hmac = Hmac(sha256, keyBytes);
  final signature = hex.encode(hmac.convert(utf8.encode(canonical)).bytes);
  ```

### C. Standardized Error Handling
- `ERR_HW_MISMATCH` (403): Prompt user to visit the college admin desk for a device lock reset.
- `ERR_STREAM_DETECTED` (412): Show *"Stream Detected: Delta exceeded 250ms. You must scan the live projector."*
- `ERR_TOKEN_EXPIRED` (406): Automatically re-arm scanner for next flash.
- `ERR_NONCE_USED` (400): Silently fetch fresh challenge nonce and retry once.

### D. UI Styling
- Deep dark theme (`#0D1117` background, `#161B22` surface, `#238636` success green, `#58A6FF` primary blue, `#F0883E` amber lock).
- Haptic feedback on all critical events (scan lock, flash capture, present verdict).

Please generate clean, null-safe, fully typed Dart code implementing this entire architecture.
```
