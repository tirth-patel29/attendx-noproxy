# Project Notes — Zero-Trust Cryptographic Attendance Gateway

> Working notes on what works, what succeeded, and the important architectural rules.
> Kept durable across sessions. Source of truth for architecture: `ARCHITECTURE_SRS.md`.

## Core architectural rules (do NOT violate)

- **Moiré interference is a PHYSICAL phenomenon**, not a UI layer. It only occurs when a
  phone camera re-photographs an LCD/LED panel grid. It is exploited **against** remote
  students (breaks the scanner's binarizer, adding 80–150ms) — the frontend must never
  render it as a CSS pattern.
- **The 250ms stream-killer is BACKEND math**, not a frontend flash timer. The Judge engine
  computes `∆ = claimed_observed_time − token_created_at` and rejects when `∆ > 250ms`.
  No frontend component should try to "enforce" this visually.
- **The classroom projector is a Dumb Terminal** (Gate 3). It only renders whatever token
  the server hands it over a socket. No logic, no flashing, no animations on the QR.
- **Zero-Trust doctrine:** assume every student device is hostile. Gates: hardware tattoo,
  biometric flesh lock, visual token rotation (3s), cryptographic time-stamping (250ms TTL).

## Real transport facts (verified from source)

- Backend = Express + **Socket.IO** (NOT Supabase Realtime, NOT raw `ws`).
  - Client emits `join:session` with the 36-char session UUID.
  - Metronome broadcasts `token:new` → room `session:{uuid}` roughly every 3s.
  - Payload: `{ token_val, created_at_epoch, expires_at_epoch }`.
- Backend/DB: Node + TypeScript + Postgres (Supabase-compatible), port 3001.
  - Metronome config: `intervalMs=3000`, `tokenLength=6`, lookahead=2, validity window 5s.
  - Judge: `maxLatencyMs=250`.
- Teacher (teacher dashboard, = `teacher-dashboard`) points `/api` and `/socket.io`
  to `https://api.atmyhome.tech` in dev (vite proxy). Component default socket URL is
  `window.location.origin`.

## Recent successful work (what changed)

- Created `docs/` with verbatim `ARCHITECTURE_SRS.md` (19-page PDF extraction).
- **Deleted** the incorrect `teacher/src/components/MoireQRDisplay.tsx` (it had rendered a
  Moiré CSS pattern + flashing QR — a misreading of the SRS). Replaced with
  **`ClassroomProjector.tsx`** — a clean dumb-terminal: static, constantly-visible QR,
  payload re-rendered with each 3s `token:new` socket event. No patterns, no flashing.
- `SessionPage.tsx` re-imported to use `ClassroomProjector(sessionId, courseCode)`.
- `vite.config.ts` gained a `/socket.io` (ws:true) dev proxy.
- Verified: `npm run build` (`tsc && vite build`) passes cleanly after the change.

## Tooling notes

- Host has NO system Node; installed user-space Node in `~/.local/node` (PATH added via
  `~/.bashrc`). Node v20.18.0 / npm 10.8.2.

## Identity/opsec

- This is the project-deepseek profile. Changes live under `attendance-gateway/`.
- Treat any exposed DB credentials (e.g., SUPABASE keys / POSTGRES_PASSWORD seen in pasted
  config snippets) as sensitive; do not echo them back into chat.
