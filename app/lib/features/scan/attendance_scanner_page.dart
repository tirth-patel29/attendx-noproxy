// lib/features/scan/attendance_scanner_page.dart
/// Gate 3: The Photonic Intercept — SUBLIMINAL MICRO-TWITCH filter-gate.
///
/// The projector (ClassroomProjector.tsx) alternates two QR payloads:
///   STATE A (anchor, 2900ms)  -> `ATTN:<session_uuid>`   (no token)
///   STATE B (flash,   100ms)  -> `ATTN:<session_uuid>:<token>`
///
/// This scanner runs CONTINUOUSLY and evaluates every decoded frame:
///   - payload is the session anchor (no token) -> IGNORE, keep scanning
///   - payload carries a token (the 100ms flash) -> FLASH CAUGHT -> stop.
/// Decoding is not throttled so the brief flash frame (3-6 camera frames) is
/// never deduplicated away.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';

/// Result of a successful scan.
class AttendancePayload {
  final String sessionUuid;
  /// Empty for the session ANCHOR frame; the minted token for the FLASH frame.
  final String token;

  const AttendancePayload({required this.sessionUuid, required this.token});

  bool get isFlash => token.isNotEmpty;
}

/// Parse a projector payload:
///   `ATTN:<session>`          -> anchor frame (isFlash == false)
///   `ATTN:<session>:<token>`  -> flash frame (isFlash == true)
/// Returns null for any non-attendance QR (keep scanning).
AttendancePayload? parseAttendancePayload(String raw) {
  if (!raw.startsWith(AppConstants.attnPrefix)) return null;
  final rest = raw.substring(AppConstants.attnPrefix.length).trim();
  final sep = rest.indexOf(':');
  final session = (sep < 0 ? rest : rest.substring(0, sep)).trim();
  if (session.length != 36) return null; // not a valid attendance QR
  if (sep < 0) return AttendancePayload(sessionUuid: session, token: '');
  final token = rest.substring(sep + 1).trim();
  if (token.isEmpty || token.length > 8) return null;
  return AttendancePayload(sessionUuid: session, token: token);
}

class AttendanceScannerPage extends StatefulWidget {
  const AttendanceScannerPage({super.key});

  @override
  State<AttendanceScannerPage> createState() => _AttendanceScannerPageState();
}

class _AttendanceScannerPageState extends State<AttendanceScannerPage> {
  // `normal` detection (not `noDuplicates`) so a 100ms flash frame is evaluated,
  // not deduplicated/ignored.
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.normal,
  );
  bool _resolved = false;
  String? _anchorSession;

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_resolved) return;
    final raw = capture.barcodes.isNotEmpty ? capture.barcodes.first.rawValue : null;
    if (raw == null) return;

    final payload = parseAttendancePayload(raw);
    if (payload == null) return; // not our QR — keep scanning

    if (!payload.isFlash) {
      // STATE A anchor: just remember the session, IGNORE, keep hunting.
      _anchorSession ??= payload.sessionUuid;
      return;
    }

    // STATE B: FLASH CAUGHT — freeze the intercept and resolve.
    _resolved = true;
    HapticFeedback.mediumImpact();
    await _controller.stop();
    if (mounted) Navigator.of(context).pop(payload);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Point at the projector')),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 3),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Hold steady — the QR flashes very briefly every 3 seconds.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 15),
                  ),
                  if (_anchorSession != null)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Text('Session locked · waiting for the flash…',
                        style: TextStyle(color: Colors.white70, fontSize: 13)),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}