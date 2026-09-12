# 📱 AttendX — Client Developer Kit (Make A Client)

Welcome to the **AttendX Client Development Kit**. This directory contains the complete architectural blueprints, cryptographic specifications, API contracts, and full Flutter implementation guides to build a production-grade Android / iOS student client for AttendX.

---

## 🧭 Guide Roadmap

Read and follow these documents in sequential order:

| Document | Purpose | Key Topics |
|---|---|---|
| [**00_OVERVIEW_AND_ARCHITECTURE.md**](file:///d:/attendx-noproxy/make-a-client/00_OVERVIEW_AND_ARCHITECTURE.md) | **System Architecture & Prerequisites** | 4-Gate security model, API endpoints, `X-Api-Key`, recommended Flutter dependencies (`pubspec.yaml`), project structure. |
| [**01_AUTHENTICATION_AND_DEVICE_BINDING.md**](file:///d:/attendx-noproxy/make-a-client/01_AUTHENTICATION_AND_DEVICE_BINDING.md) | **Gate 1 & Gate 2: Device Binding & Biometrics** | Hardware UUID generation, SHA-256 device fingerprinting, biometric authentication (`local_auth`), student signup/login, and Secure KeyStore HMAC minting. |
| [**02_DUAL_STATE_QR_SCANNING_MECHANISM.md**](file:///d:/attendx-noproxy/make-a-client/02_DUAL_STATE_QR_SCANNING_MECHANISM.md) | **Gate 3: Continuous Dual-State QR Scanner** | How the projector works (2.9s Static Anchor + 0.1s Rotating Flash), continuous optical scanning loop using `mobile_scanner`, state transitions, and haptic feedback. |
| [**03_CRISTIAN_TIME_SYNC_AND_CHALLENGE.md**](file:///d:/attendx-noproxy/make-a-client/03_CRISTIAN_TIME_SYNC_AND_CHALLENGE.md) | **Time Synchronization & Challenge Nonce** | Cristian's algorithm for sub-millisecond server clock alignment, min-RTT sampling, and single-use challenge nonce fetching. |
| [**04_GATE_4_HMAC_SIGNING_AND_CLAIM.md**](file:///d:/attendx-noproxy/make-a-client/04_GATE_4_HMAC_SIGNING_AND_CLAIM.md) | **Gate 4: HMAC Wax Seal & Claim Submission** | Canonical string generation (`session|student|token|time|device|nonce`), HMAC-SHA256 signing, `POST /api/v1/claim-attendance`, and standardized error envelope handling. |
| [**05_FULL_FLUTTER_APP_MEGA_PROMPT.md**](file:///d:/attendx-noproxy/make-a-client/05_FULL_FLUTTER_APP_MEGA_PROMPT.md) | **The AI Mega-Prompt** | Ready-to-copy mega-prompt to feed into Cursor / Claude / Gemini to scaffold or complete the entire Flutter app with all 4 gates. |
| [**06_SIGNIN_SIGNUP_AND_ONBOARDING_FLOW.md**](file:///d:/attendx-noproxy/make-a-client/06_SIGNIN_SIGNUP_AND_ONBOARDING_FLOW.md) | **Sign-In, Sign-Up & Device Binding Lifecycle** | Roll number format parsing (`24DCS093`), status probe (`POST /status`), new student registration vs returning login, and hardware lock mismatch recovery. |
| [**07_EDGE_CASES_AND_ERROR_HANDLING.md**](file:///d:/attendx-noproxy/make-a-client/07_EDGE_CASES_AND_ERROR_HANDLING.md) | **Edge Cases, Physical Noise & Error Recovery** | Missed 100ms flash handling (no failure/auto-catch), lecture hall Wi-Fi bufferbloat, time anchoring, OS sleep drift, and glare mitigation. |
| [**08_TESTING_AND_VERIFICATION_GUIDE.md**](file:///d:/attendx-noproxy/make-a-client/08_TESTING_AND_VERIFICATION_GUIDE.md) | **Local Projector Simulator & Testing Checklist** | Standalone HTML projector simulator (test without a live class), 4-gate verification checklist, and debug logs. |
| [**DESIGN.md**](file:///d:/attendx-noproxy/make-a-client/DESIGN.md) | **UI/UX Design System & Wireframes** | Tactical zero-trust aesthetic, color tokens (midnight, neon cyan, amber lock, emerald verified), scanner reticle states, verdict modals, and Dart theme code. |

---

## ⚡ Quick Specs

- **Production API Server:** `https://api.atmyhome.tech`
- **Classroom Projector URL:** `https://portal.atmyhome.tech`
- **Admin Console (for API Keys & Device Resets):** `https://admin.atmyhome.tech`
- **Server Verification Window:** $\le 250\text{ ms}$
- **Metronome Cycle:** $3000\text{ ms}$ ($2900\text{ ms}$ Anchor + $100\text{ ms}$ Flash)
- **HMAC Digest:** HMAC-SHA256 (64-character hexadecimal)
