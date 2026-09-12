# 08 — Client Testing, Verification Checklist & Projector Simulator

This guide provides testing tools and verification checklists so your teammate can test the entire Flutter app locally on their desk before taking it into an actual college classroom.

---

## 1. The Local Projector Simulator (Test Without a Live Class)

To test the **Gate 3 Dual-State Scanning** and **Gate 4 Claiming** without needing a professor to start an active lecture, save this single-file HTML page as `test_projector.html` on your laptop and open it in Google Chrome.

### `test_projector.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AttendX Projector Simulator</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <style>
    body {
      background: #0B0F19;
      color: #F8FAFC;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: #111827;
      padding: 32px;
      border-radius: 24px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
      text-align: center;
      border: 1px solid #334155;
    }
    canvas {
      background: white;
      padding: 16px;
      border-radius: 16px;
      margin: 20px 0;
    }
    .status {
      font-weight: 700;
      letter-spacing: 1px;
      padding: 8px 16px;
      border-radius: 9999px;
      display: inline-block;
      font-size: 14px;
    }
    .anchor { background: #374151; color: #9CA3AF; }
    .flash { background: #065F46; color: #34D399; }
    .mono { font-family: monospace; color: #00F2FE; }
  </style>
</head>
<body>
  <div class="card">
    <h2>AttendX Projector Simulator</h2>
    <div id="statusBadge" class="status anchor">STATE 1: ANCHOR (2.9s)</div>
    <br/>
    <canvas id="qrCanvas"></canvas>
    <div class="mono" id="payloadDisplay">ATTN:...</div>
  </div>

  <script>
    // Mock Session UUID
    const sessionUuid = "550e8400-e29b-41d4-a716-446655440000";
    const canvas = document.getElementById('qrCanvas');
    const badge = document.getElementById('statusBadge');
    const payload = document.getElementById('payloadDisplay');

    function renderQr(text) {
      QRCode.toCanvas(canvas, text, { width: 340, margin: 2 });
      payload.innerText = text;
    }

    function generateToken() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
      let res = '';
      for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
      return res;
    }

    function cycle() {
      // 1. ANCHOR STATE (2.9 Seconds)
      const anchorPayload = `ATTN:${sessionUuid}`;
      badge.className = "status anchor";
      badge.innerText = "STATE 1: ANCHOR (2.9s)";
      renderQr(anchorPayload);

      // 2. FLASH STATE (0.1 Seconds / 100ms)
      setTimeout(() => {
        const token = generateToken();
        const flashPayload = `ATTN:${sessionUuid}:${token}`;
        badge.className = "status flash";
        badge.innerText = "⚡ STATE 2: TOKEN FLASH (100ms)";
        renderQr(flashPayload);
      }, 2900);
    }

    // Run cycle every 3000ms
    cycle();
    setInterval(cycle, 3000);
  </script>
</body>
</html>
```

---

## 2. Step-by-Step Verification Checklist

Test each item sequentially on a physical Android or iOS device:

### Gate 1: Hardware Tattoo
- [ ] Install app fresh. Check that a random UUIDv4 is generated and persisted to Secure Storage.
- [ ] Verify `DeviceService.getDeviceIdHash()` returns a valid 64-character hex SHA-256 string.
- [ ] Attempt login on Device A $\rightarrow$ binds successfully.
- [ ] Attempt login on Device B with the same roll number $\rightarrow$ server rejects with HTTP 403 `ERR_HW_MISMATCH`.
- [ ] Verify app displays the "Hardware Mismatch / Device Locked" screen.

### Gate 2: Biometric Flesh Lock
- [ ] Ensure phone has fingerprint or Face ID enrolled.
- [ ] Tap **[MARK ATTENDANCE]** $\rightarrow$ Native OS biometric dialog appears.
- [ ] Cancel biometric dialog $\rightarrow$ Camera viewfinder does **NOT** open.
- [ ] Authenticate with fingerprint $\rightarrow$ Camera opens immediately.

### Gate 3: Dual-State QR Scanning
- [ ] Point camera at the projector simulator or live classroom projector.
- [ ] Verify viewfinder brackets turn **Amber Gold** when viewing the static anchor (`ATTN:<session_uuid>`).
- [ ] Verify text updates to *"SESSION ANCHOR LOCKED — Hold camera steady"*.
- [ ] Verify phone vibrates with a heavy pulse when the 100ms flash occurs.
- [ ] Verify camera immediately stops and closes.

### Gate 4: Cryptographic Wax Seal & Verification Latency
- [ ] Verify Cristian's time sync runs and reports RTT $< 100\text{ ms}$.
- [ ] Verify challenge nonce is fetched from `POST /api/v1/sessions/:id/challenge`.
- [ ] Verify canonical string is pipe-delimited in the exact order:
  `session|student|token|time|device|nonce`.
- [ ] Verify HMAC-SHA256 signature is a 64-char lowercase hex string.
- [ ] Verify server returns HTTP 200 `{"status": "PRESENT"}` with `verification_delta_ms <= 250`.
- [ ] Verify Verdict Sheet displays the animated green checkmark and latency gauge.
