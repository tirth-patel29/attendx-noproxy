# 00 — System Architecture & Client Prerequisites

> **Core Philosophy**: Attendance in AttendX is a verifiable physical event, not a trusted checkbox. The server assumes every client device is potentially hostile, running on an emulator, or attempting to replay recorded credentials.

---

## 1. The Threat Model & The 4 Security Gates

Every attendance claim submitted by the student client must pass four sequential security gates before the server writes a `PRESENT` verdict to PostgreSQL:

```text
Student Device                                           AttendX Backend (api.atmyhome.tech)
┌──────────────────────────────────────┐                ┌───────────────────────────────────┐
│ Gate 1: Hardware UUID in KeyStore   │                │ Gate 1: Database Hardware Check   │
│ SHA-256(Hardware UUID)              │ ─────────────> │ matches students.bound_device_id? │
└──────────────────────────────────────┘                └───────────────────────────────────┘
┌──────────────────────────────────────┐
│ Gate 2: Biometric Flesh Check       │ (Client-side OS check before camera opens)
│ local_auth fingerprint/FaceID        │ Kills proxy attendance (friends taking phone)
└──────────────────────────────────────┘
┌──────────────────────────────────────┐                ┌───────────────────────────────────┐
│ Gate 3: Dual-State QR Optical Scan  │                │ Gate 3: Metronome Token Liveness  │
│ 2.9s Anchor + 100ms Rotating Flash   │ ─────────────> │ token active at claimed instant?  │
└──────────────────────────────────────┘                └───────────────────────────────────┘
┌──────────────────────────────────────┐                ┌───────────────────────────────────┐
│ Gate 4: Cryptographic HMAC Wax Seal │                │ Gate 4: Zero-Trust Latency Judge  │
│ HMAC-SHA256(canonical_string, key)  │ ─────────────> │ Timing Safe Equal & Δ ≤ 250 ms    │
└──────────────────────────────────────┘                └───────────────────────────────────┘
```

| Gate | Name | Purpose | What Proves It |
|---|---|---|---|
| **Gate 1** | **Hardware Tattoo** | Prevents account sharing | Secure hardware UUID hashed with SHA-256 bound to student record. |
| **Gate 2** | **Biometric Flesh Lock** | Prevents phone mule attacks | Native OS fingerprint or FaceID prompt must succeed before camera opens. |
| **Gate 3** | **Visual Micro-Twitch** | Prevents static photos & screenshots | Dual-state projector: camera locks onto 2.9s anchor, captures 100ms rotating token. |
| **Gate 4** | **Crypto Timestamp** | Prevents live video relays (Discord/Meet) | HMAC-SHA256 signature verified within server's strict 250ms latency window. |

---

## 2. Production Endpoints & Access Control

### 2.1 Base URL
All API requests must target the production backend:
```text
https://api.atmyhome.tech
```

### 2.2 Client API Key (`X-Api-Key`)
Every HTTP request to `https://api.atmyhome.tech` (except public health checks) **MUST** include the `X-Api-Key` header:

```http
X-Api-Key: ag_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

* How to get an API Key:
  1. Login to the Admin Console at `https://admin.atmyhome.tech`.
  2. Navigate to **API Keys** in the sidebar.
  3. Click **Generate New Key**, enter label `Mobile App - Production`.
  4. Copy the full secret key (`ag_live_...`).

> [!IMPORTANT]
> If `X-Api-Key` is missing or invalid, the backend will reject the request with HTTP 401 `ERR_AUTH_MISSING`.

---

## 3. Recommended Flutter Dependencies (`pubspec.yaml`)

Your Flutter app should include the following core dependencies:

```yaml
name: attendx_client
description: AttendX Student Attendance Client
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  
  # HTTP & Networking
  http: ^1.2.0
  
  # Cryptography & Hashing
  crypto: ^3.0.3
  convert: ^3.1.1
  
  # Hardware & Secure KeyStore
  flutter_secure_storage: ^9.0.0
  device_info_plus: ^9.1.2
  uuid: ^4.3.3
  
  # Biometric Authentication (Gate 2)
  local_auth: ^2.1.8
  
  # High-Speed QR Scanner (Gate 3)
  mobile_scanner: ^5.1.1
  
  # Permissions & Feedback
  permission_handler: ^11.3.0
  flutter_vibrate: ^1.3.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
```

---

## 4. Recommended Flutter Architecture

To keep the client robust, modular, and maintainable, use a feature-first clean architecture:

```text
lib/
├── main.dart                          # App initialization, time-sync trigger, routing
├── core/
│   ├── constants/
│   │   ├── api_constants.dart         # Base URL, API Key, Route paths
│   │   └── security_constants.dart    # Token prefix 'ATTN:', 250ms threshold
│   ├── network/
│   │   ├── api_client.dart            # HTTP client injecting X-Api-Key & Bearer JWT
│   │   └── error_handler.dart         # AttendX standardized error envelope parser
│   └── services/
│       ├── storage_service.dart       # flutter_secure_storage wrapper (JWT, UUID, HMAC key)
│       ├── device_service.dart        # Gate 1 hardware tattoo & device fingerprinting
│       ├── biometric_service.dart     # Gate 2 local_auth biometric verification
│       ├── time_sync_service.dart     # Cristian's algorithm client-server clock offset
│       └── crypto_service.dart        # Gate 4 canonical string assembly & HMAC-SHA256
└── features/
    ├── auth/
    │   ├── login_page.dart            # Student roll number & password login
    │   └── register_page.dart         # Initial account registration & enrollment
    ├── scanner/
    │   ├── dual_state_scanner_page.dart # Continuous optical loop (Anchor vs Flash)
    │   └── scanner_overlay.dart       # Interactive visual focus reticle
    └── claim/
        ├── claim_controller.dart      # Challenge fetch → HMAC signing → API dispatch
        └── claim_result_sheet.dart    # PRESENT badge or Error Recovery guidance
```
