import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../core/constants/app_constants.dart';
import '../../shared/theme/app_theme.dart';

class ScannedPayload {
  final String sessionUuid;
  final String tokenVal;
  const ScannedPayload({required this.sessionUuid, required this.tokenVal});
}

ScannedPayload? _parseQr(String raw) {
  if (!raw.startsWith(AppConstants.attnPrefix)) return null;
  final rest  = raw.substring(AppConstants.attnPrefix.length);
  final colon = rest.indexOf(':');
  if (colon < 0) return null;
  final session = rest.substring(0, colon).trim();
  final token   = rest.substring(colon + 1).trim();
  if (session.length != 36) return null;
  if (token.isEmpty || token.length > 8) return null;
  return ScannedPayload(sessionUuid: session, tokenVal: token);
}

class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});
  @override State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> with WidgetsBindingObserver {
  MobileScannerController? _ctrl;
  bool _permGranted  = false;
  bool _permAsked    = false;
  bool _resolved     = false;
  bool _torch        = false;
  String? _lockedSession;
  Timer? _huntTimer;
  bool  _noFlash     = false;

  static const _huntDuration =
      Duration(milliseconds: AppConstants.metronomeMs + 1500);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _askPerm();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_ctrl == null || _resolved) return;
    if (state == AppLifecycleState.paused)  _ctrl!.stop();
    if (state == AppLifecycleState.resumed) _ctrl!.start().catchError((_) {});
  }

  Future<void> _askPerm() async {
    final status = await Permission.camera.request();
    if (!mounted) return;
    setState(() { _permAsked = true; _permGranted = status.isGranted; });
    if (status.isGranted) _startCtrl();
  }

  void _startCtrl() {
    _ctrl?.dispose();
    _ctrl = MobileScannerController(
      formats: [BarcodeFormat.qrCode],
      detectionSpeed: DetectionSpeed.normal,
      returnImage: false,
    );
    _ctrl!.start().catchError((e) => debugPrint('Scanner start: $e'));
    if (mounted) setState(() {});
  }

  void _armHunt(String session) {
    if (_resolved) return;
    if (_lockedSession == session && !_noFlash && (_huntTimer?.isActive ?? false)) return;
    _huntTimer?.cancel();
    setState(() { _lockedSession = session; _noFlash = false; });
    _huntTimer = Timer(_huntDuration, () {
      if (mounted) setState(() => _noFlash = true);
    });
  }

  Future<void> _onDetect(BarcodeCapture cap) async {
    if (_resolved) return;
    final raw = cap.barcodes.isNotEmpty ? cap.barcodes.first.rawValue : null;
    if (raw == null) return;
    final p = _parseQr(raw);
    if (p == null) return;
    // anchor (no real token)
    if (p.tokenVal.isEmpty) { _armHunt(p.sessionUuid); return; }
    // cross-session flash
    if (_lockedSession != null && p.sessionUuid != _lockedSession) {
      _armHunt(p.sessionUuid); return;
    }
    _resolved = true;
    _huntTimer?.cancel();
    HapticFeedback.mediumImpact();
    await _ctrl?.stop();
    if (mounted) Navigator.of(context).pop(p);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _huntTimer?.cancel();
    _ctrl?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan QR Code'),
        actions: [
          if (_permGranted && _ctrl != null)
            IconButton(
              icon: Icon(_torch ? Icons.flash_on : Icons.flash_off,
                  color: Colors.white),
              onPressed: () async {
                await _ctrl?.toggleTorch();
                if (mounted) setState(() => _torch = !_torch);
              },
            ),
        ],
      ),
      body: !_permAsked
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : !_permGranted
              ? _buildPermDenied()
              : _buildScanner(),
    );
  }

  Widget _buildScanner() {
    if (_ctrl == null) {
      return const Center(child: CircularProgressIndicator(color: kPrimary));
    }
    return Stack(fit: StackFit.expand, children: [
      MobileScanner(
        controller: _ctrl!,
        onDetect: _onDetect,
        errorBuilder: (ctx, err, _) => _buildCameraError(err),
      ),

      // Viewfinder overlay
      Center(
        child: Container(
          width: 260, height: 260,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white24),
          ),
          child: Stack(children: [
            _corner(t: 0, l: 0), _corner(t: 0, r: 0),
            _corner(b: 0, l: 0), _corner(b: 0, r: 0),
          ]),
        ),
      ),

      // Status pill
      if (_lockedSession != null)
        Positioned(
          top: 12, left: 0, right: 0,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                  color: const Color(0x99000000),
                  borderRadius: BorderRadius.circular(20)),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(
                    _noFlash ? Icons.pause_circle_outline : Icons.radar,
                    color: Colors.white70, size: 16,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _noFlash ? 'Waiting for next tokenâ€¦' : 'Session locked â€” hunting flash',
                    style: const TextStyle(
                        color: Colors.white, fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                ]),
                if (!_noFlash) ...[
                  const SizedBox(height: 6),
                  SizedBox(
                    width: 100,
                    child: LinearProgressIndicator(
                      minHeight: 2,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation(Colors.white),
                    ),
                  ),
                ],
              ]),
            ),
          ),
        ),

      // Bottom hint
      Positioned(
        bottom: 0, left: 0, right: 0,
        child: Container(
          color: const Color(0xDD000000),
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 32),
          child: const Text(
            'Point at the classroom projector QR.\nHold steady â€” token rotates every 3 s.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
          ),
        ),
      ),
    ]);
  }

  Widget _corner({double? t, double? b, double? l, double? r}) {
    return Positioned(
      top: t, bottom: b, left: l, right: r,
      child: Container(
        width: 28, height: 28,
        decoration: BoxDecoration(
          border: Border(
            top:    t != null ? const BorderSide(color: kPrimary, width: 3) : BorderSide.none,
            bottom: b != null ? const BorderSide(color: kPrimary, width: 3) : BorderSide.none,
            left:   l != null ? const BorderSide(color: kPrimary, width: 3) : BorderSide.none,
            right:  r != null ? const BorderSide(color: kPrimary, width: 3) : BorderSide.none,
          ),
          borderRadius: BorderRadius.only(
            topLeft:     (t != null && l != null) ? const Radius.circular(4) : Radius.zero,
            topRight:    (t != null && r != null) ? const Radius.circular(4) : Radius.zero,
            bottomLeft:  (b != null && l != null) ? const Radius.circular(4) : Radius.zero,
            bottomRight: (b != null && r != null) ? const Radius.circular(4) : Radius.zero,
          ),
        ),
      ),
    );
  }

  Widget _buildCameraError(MobileScannerException err) {
    return Container(
      color: Colors.black,
      child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline, color: Colors.orange, size: 48),
        const SizedBox(height: 12),
        const Text('Camera error', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('${err.errorCode}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
        const SizedBox(height: 20),
        FilledButton(onPressed: _startCtrl, child: const Text('Retry')),
      ])),
    );
  }

  Widget _buildPermDenied() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.camera_alt_outlined, color: kTextMuted, size: 64),
          const SizedBox(height: 20),
          const Text('Camera Permission Required',
              style: TextStyle(color: kText, fontSize: 18, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center),
          const SizedBox(height: 10),
          const Text('Camera access is needed to scan the attendance QR code.',
              style: TextStyle(color: kTextMuted), textAlign: TextAlign.center),
          const SizedBox(height: 24),
          FilledButton(onPressed: _askPerm, child: const Text('Grant Permission')),
          const SizedBox(height: 10),
          TextButton(
              onPressed: openAppSettings,
              child: const Text('Open Settings', style: TextStyle(color: kTextMuted))),
        ]),
      ),
    );
  }
}