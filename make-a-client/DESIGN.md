# AttendX Mobile Client — Complete UI/UX Design System & Specification (DESIGN.md)

> **Visual Direction**: "Tactical Zero-Trust" — A high-contrast, cyberpunk-inspired, military-grade security interface. Deep obsidian voids, glowing neon telemetry, tactile haptic sensations, and instant visual state transitions.

---

## 1. Design Philosophy & Sensory Experience

AttendX treats attendance as an immutable cryptographic event. The UI should make the student feel like they are operating a specialized hardware authenticator (like a YubiKey or Secure Enclave HUD) rather than filling out a generic campus form.

### Sensory Pillars
1. **Luminous Hierarchy**: Important visual signals (e.g. `SESSION LOCKED`, `PRESENT`) emit glowing neon borders and colored ambient drop-shadows against deep void surfaces.
2. **Tactile Physicality**: Every security transition is coupled with haptic feedback:
   - *Anchor Locked*: 10ms light selection click (`HapticFeedback.selectionClick()`).
   - *100ms Flash Captured*: 45ms heavy impact double-pulse (`HapticFeedback.heavyImpact()`).
   - *Claim Verified (`PRESENT`)*: Rhythmic triple-pulse confirmation.
   - *Security Error*: Harsh buzz (`HapticFeedback.vibrate()`).
3. **Sub-Millisecond Telemetry**: Always show real-time network latency, Cristian's drift offset, and active verification windows. Transparency builds trust.
4. **Zero Latency UI**: Animations must never delay scanning or claiming. UI operates at 60/120 FPS with hardware acceleration.

---

## 2. Complete Design Tokens

### 2.1 Color Palette

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          ATTENDX COLOR TOKENS                          │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ Token Name        │ Hex Value         │ Role & Semantics               │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ voidBackground    │ #070A12           │ Deepest obsidian backdrop      │
│ surfaceVoid       │ #0D121F           │ Base app surface / scaffold    │
│ surfaceCard       │ #151D2E           │ Cards, AppBars, Containers     │
│ surfaceElevated   │ #1E293B           │ Interactive tiles, inputs      │
│ surfaceBorder     │ #334155           │ 1px subtle divider lines       │
│ borderSubtle      │ #1E293B           │ Inactive element borders       │
│                                                                        │
│ neonCyan          │ #00F2FE           │ Primary accent, reticle search │
│ electricBlue      │ #4FACFE           │ Secondary accent, gradients    │
│ anchorAmber       │ #F59E0B           │ Optical Anchor Locked state    │
│ anchorAmberGlow   │ #D97706           │ Ambient glow for anchor        │
│ verifiedEmerald   │ #10B981           │ Gate passed, PRESENT verdict   │
│ verifiedEmeraldGlow│#059669           │ Ambient glow for success       │
│ alertCrimson      │ #EF4444           │ Mismatch, stream detected      │
│ alertCrimsonGlow  │ #DC2626           │ Error glow                     │
│                                                                        │
│ textPrimary       │ #F8FAFC           │ 100% white, maximum contrast   │
│ textSecondary     │ #94A3B8           │ Muted slate captions & labels  │
│ textTertiary      │ #64748B           │ Inactive / placeholder text    │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### 2.2 Gradients & Shadows
- **Primary Hero Gradient**:
  `LinearGradient(colors: [Color(0xFF00F2FE), Color(0xFF4FACFE)], begin: Alignment.topLeft, end: Alignment.bottomRight)`
- **Success Emerald Gradient**:
  `LinearGradient(colors: [Color(0xFF10B981), Color(0xFF059669)], begin: Alignment.topLeft, end: Alignment.bottomRight)`
- **Anchor Amber Gradient**:
  `LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFD97706)], begin: Alignment.topLeft, end: Alignment.bottomRight)`
- **Neon Cyan Glow**:
  `BoxShadow(color: Color(0x6600F2FE), blurRadius: 16, spreadRadius: 1)`
- **Anchor Amber Glow**:
  `BoxShadow(color: Color(0x66F59E0B), blurRadius: 20, spreadRadius: 2)`
- **Emerald Success Glow**:
  `BoxShadow(color: Color(0x6610B981), blurRadius: 24, spreadRadius: 2)`

---

## 3. Typography Hierarchy

| Style Token | Font Family | Size | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `displayVerdict` | Inter / Outfit | 34sp | ExtraBold (800) | -0.5 | `PRESENT`, `VERIFIED` |
| `headlineScreen` | Inter / Outfit | 22sp | Bold (700) | 0.0 | Screen headers |
| `titleCard` | Inter / Outfit | 16sp | SemiBold (600) | 0.1 | Course title, Student name |
| `bodyMain` | Inter / Outfit | 14sp | Regular (400) | 0.2 | General instructions |
| `captionMuted` | Inter / Outfit | 12sp | Medium (500) | 0.4 | Timestamps, status subtitles |
| `monoRollNo` | JetBrains / Roboto Mono | 18sp | Bold (700) | 1.2 | Roll Number: `24DCS093` |
| `monoToken` | JetBrains / Roboto Mono | 20sp | ExtraBold (800) | 2.0 | Visual Token: `K9x2` |
| `monoLatency` | JetBrains / Roboto Mono | 13sp | SemiBold (600) | 0.8 | Telemetry: `Δ = 42ms (≤250ms)` |

---

## 4. Component Deep Dive & Specifications

### 4.1 Student Identity Card (`IdentityCard`)
Located at the top of the dashboard. Serves as visual proof of the bound identity.

```text
┌─────────────────────────────────────────────────────────────┐
│  ┌─────┐   Tirth Patel                           🟢 SYNCED │
│  │  T  │   24DCS093 • CE 3rd Year (CE1)          (38ms RTT)│
│  └─────┘   DEPSTAR • Computer Engineering                   │
└─────────────────────────────────────────────────────────────┘
```

- **Avatar**: 48x48dp rounded circle with `primaryGradient` background. Centered white uppercase initial.
- **Roll Number & Batch Badge**: Roll number in bold monospace with a pill badge displaying `Batch CE1` or `Batch CE2`.
- **Clock Sync Indicator**:
  - Pulsing 8dp circular dot (Emerald Green).
  - Label: `SYNCED` (`38ms RTT`).
  - Tapping opens a bottom drawer showing Cristian's drift calibration telemetry.

---

### 4.2 Tactical Dual-State Optical Reticle (`TacticalReticle`)

The optical reticle coordinates the scanning flow:

```text
       ┌──                                              ──┐
            • • • • • • • • • • • • • • • • • • • • • 
            •                                       •
            •                                       •
            •             [  Q R  ]                 •
            •           (PROJECTOR)                 •
            •                                       •
            • • • • • • • • • • • • • • • • • • • • • 
       └──                                              ──┘
```

#### State 1: Searching (`state == ReticleState.searching`)
- **Corner Brackets**: Electric Cyan (`#00F2FE`), 36dp arm length, 4dp thickness, rounded corners.
- **Scanline Beam**: 2dp horizontal gradient bar traveling vertically inside the reticle in an infinite 1.8s ease-in-out loop.
- **Bottom Banner**: Dark container with Cyan radar icon and `ALIGN WITH PROJECTOR`.

#### State 2: Session Anchor Locked (`state == ReticleState.anchorLocked`)
- **Visual Trigger**: Camera detects `ATTN:<session_uuid>`.
- **Corner Brackets**: Instantly animate color from Cyan to **Amber Gold** (`#F59E0B`).
- **Glow**: Amber outer ambient glow expands (`blurRadius: 24`).
- **Scanline**: Freezes in the center, pulsing softly.
- **Bottom Banner**:
  - Background shifts to `#78350F` (Dark Amber) with `#F59E0B` border.
  - Icon: `Icons.lock_clock` (Pulsing).
  - Headline: `SESSION ANCHOR LOCKED` (Bold 13sp).
  - Subtext: *"Hold camera steady! Capturing the 100ms token flash…"*
- **Haptics**: Subtle 10ms click vibration.

#### State 3: Flash Captured (`state == ReticleState.flashCaptured`)
- **Visual Trigger**: Camera detects `ATTN:<session_uuid>:<token_val>`.
- **Effect**:
  - Screen flashes white for 60ms.
  - Reticle brackets snap to **Emerald Green** (`#10B981`) with heavy outer glow.
  - Camera stream freezes on current frame.
- **Haptics**: High-impact double vibration (`HapticFeedback.heavyImpact()`).
- **Transition**: Immediately routes to Claim Processing Sheet.

---

### 4.3 Gate 4 Latency Gauge (`LatencyGauge`)
Shown on the claim verification bottom sheet to prove zero-trust latency compliance:

```text
Verification Delta: 42 ms (Acceptance Window: ≤ 250 ms)
[████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
 0ms      50ms     100ms    150ms    200ms    250ms (Limit)
```

- **Progress Bar**:
  - $\le 100\text{ ms}$: Emerald Green (`#10B981`) — *Ultra-low direct optical line-of-sight*.
  - $101 - 200\text{ ms}$: Amber (`#F59E0B`) — *Standard classroom distance*.
  - $201 - 250\text{ ms}$: Orange (`#F97316`) — *Near cutoff threshold*.
  - $> 250\text{ ms}$: Crimson (`#EF4444`) — *REJECTED: Proxy stream detected*.

---

### 4.4 Attendance Claim Verdict Modal (`VerdictSheet`)

#### Success State (`200 OK`)
```text
┌─────────────────────────────────────────────────────────────┐
│                            ═══                              │
│                                                             │
│                         ┌───────┐                           │
│                         │   ✔   │                           │
│                         └───────┘                           │
│                    ATTENDANCE VERIFIED                      │
│                         [ PRESENT ]                         │
│                                                             │
│  ⚡ Verification Latency: 42 ms                              │
│  [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] (Limit ≤250ms)│
│                                                             │
│  Lecture: CE302 - Operating Systems (Lab CE1)               │
│  Session: 550e8400-e29b-41d4-a716-446655440000              │
│  Ledger Record: #9a1b2c3d-4e5f-6789                         │
│  Timestamp: 2026-09-13 10:35:12 AM IST                      │
│                                                             │
│  [ DONE ]                                                   │
└─────────────────────────────────────────────────────────────┘
```

#### Failure State (`ERR_STREAM_DETECTED` / `412`)
```text
┌─────────────────────────────────────────────────────────────┐
│                            ═══                              │
│                                                             │
│                         ┌───────┐                           │
│                         │   ⚠   │                           │
│                         └───────┘                           │
│                     STREAM DETECTED                         │
│                                                             │
│  Photonic latency (312 ms) exceeded the 250 ms threshold.   │
│  Video streaming over Discord, Zoom, or WhatsApp introduces │
│  compression lag and is cryptographically blocked.          │
│                                                             │
│  You must be physically in the classroom scanning the direct│
│  projector screen.                                          │
│                                                             │
│  [ RE-SCAN PROJECTOR NOW ]                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Screen-by-Screen Layout Specifications

### Screen 1: Welcome & Roll Number Discovery
- **Hero Graphic**: AttendX illuminated shield logo with animated glowing boundary.
- **Title**: *"Student Identity Gateway"*.
- **Subtitle**: *"Enter your roll number to access attendance credentials."*
- **Input Field**:
  - Monospace text formatting.
  - Auto-capitalization (`24dcs093` $\rightarrow$ `24DCS093`).
  - Instant live chip detection (displays `DEPSTAR • Computer Science` once 8 chars entered).
- **CTA Button**: Full-width Cyan Gradient button: `CONTINUE →`.

### Screen 2: Student Home Dashboard
- **Top Bar**:
  - AttendX logo on left.
  - Status pill on right: `🟢 SYNCED (38ms)`.
- **Identity Hero Card**: Name, Roll Number, Branch, Academic Year.
- **Active Lecture Card**:
  - Real-time display of current lecture: Course Title, Professor, Room Number, Time remaining.
  - Tag: `Theory (All Batches)` vs `Lab Session (Batch CE1)`.
- **Primary Hero Action**:
  - Huge centered circular scanner button with pulsing neon cyan outer ring:
    `[ 📷 MARK ATTENDANCE ]`.
- **Recent History**: Last 5 attendance records with verified timestamps and latency indicators.

### Screen 3: Dual-State Scanner Screen
- Fullscreen camera viewfinder.
- Top navigation bar: Back button, Lecture title, Flashlight/Torch toggle button.
- Centered `TacticalReticle` widget.
- Dynamic bottom status card transitioning from Cyan searching to Amber locked.
- Tap-to-focus indicator with expanding concentric circles.

---

## 6. Complete Production Dart Widget Implementations

### 6.1 `TacticalReticle` Custom Widget (`tactical_reticle.dart`)

```dart
import 'package:flutter/material.dart';

enum ReticleState { searching, anchorLocked, flashCaptured }

class TacticalReticle extends StatefulWidget {
  final ReticleState state;
  final double size;

  const TacticalReticle({
    super.key,
    required this.state,
    this.size = 280,
  });

  @override
  State<TacticalReticle> createState() => _TacticalReticleState();
}

class _TacticalReticleState extends State<TacticalReticle> with SingleTickerProviderStateMixin {
  late AnimationController _scanlineCtrl;

  @override
  void initState() {
    super.initState();
    _scanlineCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _scanlineCtrl.dispose();
    super.dispose();
  }

  Color get _reticleColor {
    switch (widget.state) {
      case ReticleState.searching:
        return const Color(0xFF00F2FE); // Neon Cyan
      case ReticleState.anchorLocked:
        return const Color(0xFFF59E0B); // Amber Gold
      case ReticleState.flashCaptured:
        return const Color(0xFF10B981); // Emerald Green
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        width: widget.size,
        height: widget.size,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: _reticleColor.withOpacity(widget.state == ReticleState.anchorLocked ? 0.35 : 0.15),
              blurRadius: widget.state == ReticleState.anchorLocked ? 28 : 14,
              spreadRadius: 2,
            )
          ],
        ),
        child: Stack(
          children: [
            // Corner Bracket Painter
            CustomPaint(
              size: Size(widget.size, widget.size),
              painter: _CornerBracketPainter(color: _reticleColor),
            ),

            // Animated Scanline (Only active during searching)
            if (widget.state == ReticleState.searching)
              AnimatedBuilder(
                animation: _scanlineCtrl,
                builder: (context, child) {
                  return Positioned(
                    top: 14 + (_scanlineCtrl.value * (widget.size - 28)),
                    left: 14,
                    right: 14,
                    child: Container(
                      height: 2.5,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.transparent,
                            _reticleColor.withOpacity(0.8),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _CornerBracketPainter extends CustomPainter {
  final Color color;
  const _CornerBracketPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const arm = 34.0;
    const radius = 14.0;

    // Top-Left
    final pathTL = Path()
      ..moveTo(0, arm)
      ..lineTo(0, radius)
      ..arcToPoint(const Offset(radius, 0), radius: const Radius.circular(radius))
      ..lineTo(arm, 0);
    canvas.drawPath(pathTL, paint);

    // Top-Right
    final pathTR = Path()
      ..moveTo(size.width - arm, 0)
      ..lineTo(size.width - radius, 0)
      ..arcToPoint(Offset(size.width, radius), radius: const Radius.circular(radius))
      ..lineTo(size.width, arm);
    canvas.drawPath(pathTR, paint);

    // Bottom-Left
    final pathBL = Path()
      ..moveTo(0, size.height - arm)
      ..lineTo(0, size.height - radius)
      ..arcToPoint(Offset(radius, size.height), radius: const Radius.circular(radius))
      ..lineTo(arm, size.height);
    canvas.drawPath(pathBL, paint);

    // Bottom-Right
    final pathBR = Path()
      ..moveTo(size.width - arm, size.height)
      ..lineTo(size.width - radius, size.height)
      ..arcToPoint(Offset(size.width, size.height - radius), radius: const Radius.circular(radius))
      ..lineTo(size.width, size.height - arm);
    canvas.drawPath(pathBR, paint);
  }

  @override
  bool shouldRepaint(covariant _CornerBracketPainter oldDelegate) => oldDelegate.color != color;
}
```

---

### 6.2 `LatencyGauge` Custom Widget (`latency_gauge.dart`)

```dart
import 'package:flutter/material.dart';

class LatencyGauge extends StatelessWidget {
  final int deltaMs;
  final int thresholdMs;

  const LatencyGauge({
    super.key,
    required this.deltaMs,
    this.thresholdMs = 250,
  });

  Color get _statusColor {
    if (deltaMs <= 100) return const Color(0xFF10B981); // Emerald
    if (deltaMs <= 200) return const Color(0xFFF59E0B); // Amber
    if (deltaMs <= 250) return const Color(0xFFF97316); // Orange
    return const Color(0xFFEF4444); // Crimson
  }

  @override
  Widget build(BuildContext context) {
    final double ratio = (deltaMs / thresholdMs).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF151D2E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.bolt, color: _statusColor, size: 18),
                  const SizedBox(width: 6),
                  Text(
                    'Verification Latency (Δ)',
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                  ),
                ],
              ),
              Text(
                '$deltaMs ms',
                style: TextStyle(
                  color: _statusColor,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 8,
              backgroundColor: const Color(0xFF1E293B),
              valueColor: AlwaysStoppedAnimation<Color>(_statusColor),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('0 ms (Direct)', style: TextStyle(color: Colors.grey, fontSize: 11)),
              Text('Limit: $thresholdMs ms', style: const TextStyle(color: Colors.grey, fontSize: 11)),
            ],
          )
        ],
      ),
    );
  }
}
```
