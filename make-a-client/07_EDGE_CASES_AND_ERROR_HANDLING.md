# 07 — Edge Cases, Physical Realities & Error Recovery Protocols

Classroom attendance takes place in noisy physical environments: crowded lecture halls with weak Wi-Fi, glary projectors, shaking hands, and students scanning simultaneously.

This guide outlines every physical and operational edge case and defines the exact protocol the Flutter client must follow.

---

## 1. The Missed Flash Edge Case (The 100ms Window)

### 1.1 The Physical Reality
The optical rotating token flashes for only **100 milliseconds** once every 3.0 seconds. 
What happens if the student sneezes, the phone auto-focuses at that exact instant, or the frame rate drops?

### 1.2 Non-Negotiable Client Rule: NEVER FAIL ON A MISSED FLASH!
If the camera does not catch the flash during a 3-second cycle:
1. **Maintain Session Lock**: The scanner **MUST NOT** reset, throw an error, or pop the screen.
2. **Retain Amber Viewfinder**: Keep the reticle amber (`SESSION ANCHOR LOCKED`).
3. **Subtle Helper Text**: After 3.5 seconds of seeing the anchor without catching a flash, display a soft helper text:
   *"Missed flash — hold steady, catching next cycle in 2 seconds…"*
4. **Auto-Catch Next Cycle**: The scanner naturally catches the flash on the very next 3.0-second rotation.

```dart
// scanner_controller.dart snippet
Timer? _missedCycleTimer;

void onAnchorDetected(String sessionUuid) {
  _lockedSessionUuid = sessionUuid;
  
  // Reset 3.5s cycle watchdog
  _missedCycleTimer?.cancel();
  _missedCycleTimer = Timer(const Duration(milliseconds: 3500), () {
    if (mounted && !_isFlashCaught) {
      setState(() {
        _helperMessage = 'Hold steady! Catching the next 100ms flash…';
      });
    }
  });
}
```

---

## 2. Weak Wi-Fi & Bufferbloat in Large Lecture Halls

### 2.1 The Thundering Herd Problem
When 80 students scan the same projector at 10:00 AM, the classroom Wi-Fi access point experiences immediate TCP congestion and packet delay (bufferbloat).

### 2.2 How AttendX Protects Honest Students
Traditional systems fail because network upload latency exceeds their timeout. AttendX solves this using **Time Anchoring**:

1. When the student's camera captures the 100ms flash, the app records the local stopwatch:
   $$\text{scan\_instant} = \text{Stopwatch.elapsedMilliseconds}$$
2. The app requests a challenge nonce:
   $$\text{server\_time} = \text{challenge.server\_time\_ms}$$
3. The app computes:
   $$\text{client\_claimed\_time} = \text{server\_time} + (\text{Stopwatch.elapsedMilliseconds} - \text{scan\_instant})$$

Even if the HTTP POST request sits in a Wi-Fi buffer for 1.5 seconds, the cryptographic timestamp reflects the **exact millisecond the optical scan occurred**! The server verifies the token against that anchored millisecond, not the network delivery time.

### 2.3 Client Network Retry Discipline
- Set HTTP timeout to **6.0 seconds**.
- If a socket timeout or `SocketException` occurs:
  - Auto-retry once with a 300ms jittered delay.
  - Do not force the user to re-scan the QR code if the flash was already captured!

---

## 3. Clock Jitter & OS Power-Saving Drift

### 3.1 The Problem
Android and iOS aggressively throttle background timers and NTP daemons to save battery. A phone's internal clock can drift by $\pm 300\text{ ms}$ over a few hours of sleep.

### 3.2 The Calibration Protocol
1. **On Boot**: Run `TimeSyncService.synchronize()` immediately upon app launch.
2. **Pre-Flight Refresh**: When the user taps **[MARK ATTENDANCE]**, check if the last time-sync was more than 10 minutes ago. If so, fire a single background `GET /api/v1/time-sync` probe to refresh the drift offset before the camera opens.
3. If the minimum RTT is $> 350\text{ ms}$ (indicating severe satellite/2G connection lag), show a subtle warning: *"High network latency detected. Use campus Wi-Fi or 5G for best verification."*

---

## 4. Hardware Mismatch & Phone Replacement

### 4.1 When Does This Occur?
1. **Account Sharing Attempt**: Student A logs into Student B's phone $\rightarrow$ BLOCKED.
2. **Legitimate Phone Upgrade**: Student bought a new phone or performed a factory reset $\rightarrow$ Hardware UUID changes.

### 4.2 Handling Protocol (`ERR_HW_MISMATCH` / HTTP 403)
When the server returns `ERR_HW_MISMATCH`:
1. **DO NOT** clear credentials or delete the student account.
2. Present the **Hardware Lock Mismatch Screen**:
   - Status Icon: `Icons.phonelink_lock` in Crimson.
   - Message: *"This student account (24DCS093) is bound to another physical phone. To prevent proxy attendance, accounts cannot be transferred without administrative authorization."*
   - Clear Action Steps:
     1. Visit your college department admin desk.
     2. Show your student ID card.
     3. Request an administrator to click **[RESET HARDWARE LOCK]** on the Admin Console.
     4. Once reset, tap **[Re-bind This Device]**.

---

## 5. Glare, Darkness & Distance in Lecture Halls

### 5.1 Projector Glare & Washed Out Colors
Classroom projectors vary wildly: some are ultra-bright LCD projectors in dim rooms, while others are low-contrast VGA beams in sunlit rooms.

### 5.2 Mobile Camera Configuration
In `mobile_scanner`:
1. **Detection Speed**: Always set `DetectionSpeed.unrestricted`. Never throttle frame processing, or you will miss the 100ms flash!
2. **Torch / Flashlight**: Provide an easily accessible Flashlight toggle button in the top-right corner of the scanner HUD. In dark lecture halls, turning on the torch can illuminate paper notes but avoid reflecting directly into the projector lens.
3. **Tap-to-Focus**: Allow the user to tap the reticle to force the lens to refocus on the projector screen if sitting in the back row.

---

## 6. Comprehensive Error Code Matrix & Client Actions

| Error Code | HTTP | What Happened | Required Client Action |
|---|---|---|---|
| `ERR_STREAM_DETECTED` | **412** | Verification latency exceeded 250ms. Codec relay lag detected. | Vibrate harsh warning. Show: *"Live stream detected. Point camera directly at classroom screen."* Provide [Re-scan] button. |
| `ERR_TOKEN_EXPIRED` | **406** | Visual token rotated before claim payload was processed. | Automatically keep scanner active to catch next flash. |
| `ERR_HW_MISMATCH` | **403** | Phone does not match `bound_device_id`. | Route to Hardware Mismatch Recovery Screen. |
| `ERR_SIG_INVALID` | **401** | HMAC-SHA256 wax seal failed server verification. | Check if `secret_hmac_key` exists. If corrupted, force re-login. |
| `ERR_NONCE_USED` | **400** | Nonce was already consumed. | Fetch fresh nonce and retry claim silently once. |
| `ERR_AUTH_MISSING` | **401** | Missing `X-Api-Key` or student JWT expired. | Refresh JWT or route to login screen. |
| `ERR_RATE_LIMIT` | **429** | Too many requests submitted in short burst. | Back off for 1.5 seconds and retry. |

---

## 7. Live Testing & Verification

For hands-on testing of these edge cases, you can test directly against the live **Teacher Portal at `https://portal.atmyhome.tech`** or use the local simulator. See [**`08_TESTING_AND_VERIFICATION_GUIDE.md`**](file:///d:/attendx-noproxy/make-a-client/08_TESTING_AND_VERIFICATION_GUIDE.md) for full instructions on launching a test session and testing against live metronome tokens!
