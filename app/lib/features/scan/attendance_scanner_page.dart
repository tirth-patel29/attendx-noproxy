// lib/features/scan/attendance_scanner_page.dart
/// Gate 3: the Photonic Intercept.
/// Real camera scanner (mobile_scanner) that reads the classroom projector's
/// QR payload `ATTN:<session_uuid>:<token>` (see portal ClassroomProjector).
/// The moment a frame decodes, the scanner stops (SRS Phase 3 "Shutter
/// Freeze") and pops with the intercepted session + token.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';

/// Result of a successful scan.
class AttendancePayload {
  final String sessionUuid;
  final String token;

  const AttendancePayload({required this.sessionUuid, required this.token});
}

/// Parse a projector payload string: `ATTN:<session_uuid>:<token>`.
/// Returns null if the payload is not a valid attendance QR.
AttendancePayload? parseAttendancePayload(String raw) {
  if (!raw.startsWith(AppConstants.attnPrefix)) return null;
  final parts = raw.substring(AppConstants.attnPrefix.length).split(':');
  if (parts.length != 2) return null;
  final sessionUuid = parts[0].trim();
  final token = parts[1].trim();
  if (sessionUuid.length != 36) return null; // UUIDv4
  if (token.isEmpty || token.length > 8) return null;
  return AttendancePayload(sessionUuid: sessionUuid, token: token);
}

class AttendanceScannerPage extends StatefulWidget {
  const AttendanceScannerPage({super.key});

  @override
  State<AttendanceScannerPage> createState() => _AttendanceScannerPageState();
}

class _AttendanceScannerPageState extends State<AttendanceScannerPage> {
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _resolved = false;

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_resolved) return;
    final raw = capture.barcodes.isNotEmpty ? capture.barcodes.first.rawValue : null;
    if (raw == null) return;

    final payload = parseAttendancePayload(raw);
    if (payload == null) return; // not our QR — keep scanning

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
      appBar: AppBar(title: const Text('Scan the projector QR')),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          // Simple corner-frame overlay
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
          const Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Point at the classroom projector.\nThe QR refreshes every 3 seconds.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }
}