# AttendX Mobile Client — UI/UX Design System (DESIGN.md)

This document defines the visual identity, color tokens, typography scales, motion design, and component specifications for the **AttendX Student Mobile Application**.

---

## 1. Design Philosophy: "Tactical Zero-Trust"

AttendX is not a generic university form. It is a **cryptographic presence verification terminal**. 
The visual aesthetic reflects this:
- **High-contrast dark mode**: Deep midnight void surfaces with electric accents.
- **Visual state transparency**: The student always sees their hardware lock status, clock calibration, and optical lock state.
- **Physicality & Haptics**: High-impact vibrations on optical lock and claim verification create confidence that the physical scan succeeded.
- **Distraction-free ergonomics**: One-tap primary actions, large touch targets, zero clutter.

---

## 2. Color Palette & Design Tokens

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          ATTENDX COLOR TOKENS                          │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ Role              │ Hex Value         │ Description                    │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ Background Void   │ #0B0F19           │ Main app background            │
│ Surface 1         │ #111827           │ Cards, AppBars, Containers     │
│ Surface 2         │ #1F2937           │ Elevated cards, active states  │
│ Surface Border    │ #374151           │ Subtle 1px dividers & borders  │
│ Primary Cyan      │ #00F2FE           │ Active reticle, buttons, glows │
│ Primary Blue      │ #4FACFE           │ Gradient companion to Cyan     │
│ Anchor Amber      │ #F59E0B           │ Session Locked status, warning │
│ Verified Emerald  │ #10B981           │ Gate passed, PRESENT verdict   │
│ Alert Crimson     │ #EF4444           │ Hardware mismatch, stream drop │
│ Text Primary      │ #F9FAFB           │ 100% white, high-legibility    │
│ Text Secondary    │ #9CA3AF           │ Muted slate subtitles          │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### Gradients
- **Brand Primary Gradient:** `LinearGradient(colors: [Color(0xFF00F2FE), Color(0xFF4FACFE)])`
- **Verified Success Gradient:** `LinearGradient(colors: [Color(0xFF10B981), Color(0xFF059669)])`
- **Locked Amber Gradient:** `LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFD97706)])`

---

## 3. Typography Scale

Use **`Outfit`** or **`Inter`** for user-interface elements, and **Monospace** for cryptographic symbols, tokens, roll numbers, and timestamps.

| Style | Font Family | Size | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| **Display Large** | Outfit / Inter | 32sp | Bold (700) | -0.5 | Verification Verdict (`PRESENT`) |
| **Headline Medium**| Outfit / Inter | 22sp | SemiBold (600) | 0.0 | Screen Titles, Section Headers |
| **Title Medium** | Outfit / Inter | 16sp | Medium (500) | 0.1 | Card Titles, Student Name |
| **Body Regular** | Outfit / Inter | 14sp | Regular (400) | 0.2 | Descriptions, Help Text |
| **Code / Mono** | JetBrains / Roboto | 15sp | Bold (700) | 1.0 | Roll Number (`24DCS093`), Tokens (`K9x2`) |
| **Timestamp Mono** | JetBrains / Roboto | 12sp | Medium (500) | 0.5 | Latency Delta (`Δ = 42ms`), Epochs |

---

## 4. Component Specifications

### 4.1 Student Identity Card
The top hero element on the student dashboard:
- **Left**: Circular gradient avatar with student's first initial.
- **Center**:
  - Student Name (Title Medium, `#F9FAFB`).
  - Roll Number in Monospace with academic batch badge (e.g., `24DCS093 • Batch CE1`).
- **Right**:
  - Pulsing status pill: Green dot + `SYNCED` indicating Cristian's clock drift is within acceptable tolerance ($\pm 15\text{ ms}$).

### 4.2 The Dual-State Optical Scanner Reticle
The centerpiece of the scanning experience:
- **Dimensions:** $280\text{ dp} \times 280\text{ dp}$ centered square with rounded corners ($16\text{ dp}$).
- **State 1: Searching for Projector**:
  - Reticle border: `Color(0xFF00F2FE)` (Neon Cyan, $3.5\text{ dp}$ width).
  - Scanline: Subtle animated horizontal beam moving top-to-bottom.
  - Bottom Banner: `ALIGN WITH PROJECTOR` (Cyan icon).
- **State 2: Anchor Locked (`ATTN:<session_uuid>`)**:
  - Reticle border: `Color(0xFFF59E0B)` (Amber Gold) with animated outer glow.
  - Scanline freezes.
  - Bottom Banner turns Amber: `SESSION LOCKED` + *"Hold steady! Waiting for the 100ms rotating token flash..."*.
  - Audio/Haptic feedback: Subtle tick vibration.
- **State 3: Flash Captured (`ATTN:<session_uuid>:<token_val>`)**:
  - Instant screen flash pulse.
  - Heavy haptic vibration (`HapticFeedback.heavyImpact()`).
  - Reticle border turns Emerald Green.
  - Immediate transition to claim screen.

### 4.3 Biometric Flesh Lock Sheet
Triggered automatically before the camera viewfinder activates:
- Bottom sheet modal with rounded top corners ($24\text{ dp}$).
- Glowing biometric fingerprint icon.
- Copy: *"Biometric Flesh Check — Authenticate your identity to open attendance scanner"*.
- Buttons: `Authenticate with Biometrics` / `Use Device Passcode`.

### 4.4 Attendance Claim Verdict Bottom Sheet
Displays immediately after the backend validates the claim:
- **Success (`200 OK`)**:
  - Big animated checkmark icon inside emerald circle.
  - Headline: `ATTENDANCE RECORDED` (Bold 24sp).
  - Verdict Badge: `PRESENT` (Deep emerald background, white text).
  - Latency Gauge:
    - Displays: `⚡ Verification Delta: 42 ms`
    - Subtext: `Within 250ms zero-trust security window`.
  - Details: Session ID, Server Timestamp, Ledger Record UUID.
  - Auto-dismiss countdown bar (3 seconds) or `Done` button.
- **Failure (`4xx Error Envelope`)**:
  - Crimson alert shield icon.
  - Headline: `VERIFICATION FAILED`.
  - Specific error guidance card:
    - If `ERR_STREAM_DETECTED`: *"Proxy Stream Detected. Latency was 310ms (limit 250ms). You must scan the live classroom projector screen in person."*
    - If `ERR_HW_MISMATCH`: *"Hardware Mismatch. This account is locked to another device. Please contact your department admin to reset your hardware lock."*

---

## 5. Screen Wireframes & Layouts

### Screen 1: Roll Number Entry & Welcome
```text
┌──────────────────────────────────────┐
│ [AttendX Logo]                       │
│                                      │
│ Welcome to AttendX                   │
│ Enter your University Roll Number    │
│ to sign in or enroll.                │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 24DCS093                         │ │  <- Monospace auto-uppercase input
│ └──────────────────────────────────┘ │
│                                      │
│ [ CONTINUE -> ]                      │  <- Cyan gradient primary button
│                                      │
│ 🔒 Protected by 4-Gate Zero-Trust    │
└──────────────────────────────────────┘
```

### Screen 2: Student Dashboard
```text
┌──────────────────────────────────────┐
│ [Avatar] Tirth Patel         🟢 SYNC │
│ 24DCS093 • CE 3rd Year (CE1)         │
├──────────────────────────────────────┤
│ 📅 TODAY'S ACTIVE LECTURE            │
│ ┌──────────────────────────────────┐ │
│ │ CE302: Operating Systems         │ │
│ │ Prof. Dr. Sharma • Lab Session   │ │
│ │ 10:30 AM - 12:30 PM • Lab 402    │ │
│ └──────────────────────────────────┘ │
│                                      │
│                ┌───┐                 │
│                │ 📷 │                 │
│                └───┘                 │
│         [ MARK ATTENDANCE ]          │  <- Big prominent CTA button
│                                      │
│ ⚡ Latency Calibration: 38ms RTT     │
└──────────────────────────────────────┘
```

### Screen 3: Dual-State Scanner Screen
```text
┌──────────────────────────────────────┐
│ < Back           Scan Projector [⚡] │
│                                      │
│           ┌──────────────┐           │
│           │ ┌          ┐ │           │
│           │              │           │
│           │      QR      │           │
│           │              │           │
│           │ └          ┘ │           │
│           └──────────────┘           │
│             (Reticle)                │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 🔒 SESSION LOCKED                │ │  <- Turns Amber when Anchor detected
│ │ Hold steady! Waiting for flash…  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## 6. Complete Dart Theme Implementation (`app_theme.dart`)

```dart
import 'package:flutter/material.dart';

class AttendXTheme {
  // Color Palette
  static const Color background = Color(0xFF0B0F19);
  static const Color surface1 = Color(0xFF111827);
  static const Color surface2 = Color(0xFF1F2937);
  static const Color surfaceBorder = Color(0xFF374151);

  static const Color primaryCyan = Color(0xFF00F2FE);
  static const Color primaryBlue = Color(0xFF4FACFE);
  static const Color anchorAmber = Color(0xFFF59E0B);
  static const Color verifiedEmerald = Color(0xFF10B981);
  static const Color alertCrimson = Color(0xFFEF4444);

  static const Color textPrimary = Color(0xFFF9FAFB);
  static const Color textSecondary = Color(0xFF9CA3AF);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primaryCyan, primaryBlue],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient successGradient = LinearGradient(
    colors: [verifiedEmerald, Color(0xFF059669)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Theme Data
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: background,
      colorScheme: const ColorScheme.dark(
        primary: primaryCyan,
        surface: surface1,
        error: alertCrimson,
        onSurface: textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surface1,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryCyan,
          foregroundColor: Colors.black,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface2,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: surfaceBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: surfaceBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: primaryCyan, width: 2),
        ),
        hintStyle: const TextStyle(color: textSecondary),
      ),
    );
  }
}
```
