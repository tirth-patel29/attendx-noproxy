// lib/features/scan/attendance_scanner_page.dart
// Gate 3: The Photonic Intercept — SUBLIMINAL MICRO-TWITCH filter-gate.
//
// The projector (ClassroomProjector.tsx) alternates two QR payloads:
//   STATE A (anchor, 2900ms)  -> `ATTN:<session_uuid>`   (no token)
//   STATE B (flash,   100ms)  -> `ATTN:<session_uuid>:<token>`
//
// This scanner requests the OS camera permission up-front (no black-screen-!
// crash), runs CONTINUOUSLY and evaluates every decoded frame:
//   - payload is the session anchor (no token) -> IGNORE, keep scanning
//   - payload carries a token (the 100ms flash) -> FLASH CAUGHT -> stop.
// Decoding is not throttled so the brief flash frame is never deduped away.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
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
AttendancePayload? parseAttendancePayload(String raw) {
  if (!raw.startsWith(AppConstants.attnPrefix)) return null;
  final rest = raw.substring(AppConstants.attnPrefix.length).trim();
  final sep = rest.indexOf(':');
  final session = (sep < 0 ? rest : rest.substring(0, sep)).trim();
  if (session.length != 36) return null;
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
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.normal,
  );

  bool _resolved = false;
  String? _anchorSession;
  bool _requested = false;
  late PermissionStatus _permission = PermissionStatus.granted; // optimistic

  @override
  void initState() {
    super.initState();
    _ensurePermission();
  }

  Future<void> _ensurePermission() async {
    if (_requested) return;
    _requested = true;
    final status = await Permission.camera.request();
    if (!mounted) return;
    setState(() => _permission = status);
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_resolved) return;
    final raw = capture.barcodes.isNotEmpty ? capture.barcodes.first.rawValue : null;
    if (raw == null) return;
    final payload = parseAttendancePayload(raw);
    if (payload == null) return;
    if (!payload.isFlash) {
      _anchorSession ??= payload.sessionUuid;
      return;
    }
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
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_requested && !_permission.isGranted) {
      return _buildPermissionDenied();
    }
    if (!_requested) {
      return const Center(child: CircularProgressIndicator());
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
          errorBuilder: (context, error, stackTrace) => Container(
            color: const Color(0xFF0A0F1E),
            alignment: Alignment.center,
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, color: Colors.amber, size: 44),
                const SizedBox(height: 12),
                const Text('Camera is unavailable', textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text('$error', textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white54, fontSize: 12)),
              ],
            ),
          ),
        ),
        const Center(
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border.fromBorderSide(BorderSide(color: Colors.white, width: 3)),
              borderRadius: BorderRadius.all(Radius.circular(16)),
            ),
            child: SizedBox(width: 260, height: 260),
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
    );
  }

  Widget _buildPermissionDenied() {
    final isPermanentlyDenied = _permission.isPermanentlyDenied;
    return Container(
      color: const Color(0xFF0A0F1E),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.no_photography_outlined, color: Color(0xFF64748B), size: 56),
          const SizedBox(height: 16),
          const Text('Camera permission needed',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text(
            'Marking attendance requires the camera to read the projector flash. '
            'Grant access and try again.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF94A3B8), height: 1.4),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: isPermanentlyDenied ? openAppSettings : _ensurePermission,
            icon: const Icon(Icons.settings_outlined),
            label: Text(isPermanentlyDenied ? 'Open settings' : 'Grant permission'),
          ),
        ],
      ),
    );
  }
}