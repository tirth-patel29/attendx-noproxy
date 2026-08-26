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

ScannedPayload? parseAttendanceQr(String raw) {
  if (!raw.startsWith(AppConstants.attnPrefix)) return null;
  final rest = raw.substring(AppConstants.attnPrefix.length);
  final colon = rest.indexOf(':');
  if (colon < 0) return null;
  final session = rest.substring(0, colon).trim();
  final token = rest.substring(colon + 1).trim();
  if (session.length != 36) return null;
  if (token.isEmpty || token.length > 8) return null;
  return ScannedPayload(sessionUuid: session, tokenVal: token);
}

class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});
  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> with WidgetsBindingObserver {
  MobileScannerController? _ctrl;
  bool _permOk = false;
  bool _resolved = false;
  bool _torch = false;
  bool _starting = false;
  int _retryCount = 0;
  String? _errMsg;
  String? _lockedSession;
  Timer? _huntTimer;
  bool _noFlash = false;

  static const _huntMs = Duration(milliseconds: AppConstants.metronomeMs + 1500);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (_ctrl == null || _resolved) return;
    if (s == AppLifecycleState.paused) _ctrl!.stop();
    if (s == AppLifecycleState.resumed) _startCam();
  }

  Future<void> _init() async {
    final st = await Permission.camera.request();
    if (!mounted) return;
    if (!st.isGranted) { setState(() => _permOk = false); return; }
    setState(() => _permOk = true);
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _resetCtrl(); });
  }

  Future<void> _resetCtrl() async {
    _ctrl?.dispose();
    _ctrl = MobileScannerController(
      formats: [BarcodeFormat.qrCode],
      detectionSpeed: DetectionSpeed.normal,
      returnImage: false,
    );
    if (mounted) setState(() {});
    await Future.delayed(const Duration(milliseconds: 600));
    if (mounted) _startCam();
  }

  Future<void> _startCam() async {
    if (_ctrl == null || _resolved || _starting) return;
    _starting = true;
    try {
      await _ctrl!.start();
      if (mounted) setState(() { _errMsg = null; _retryCount = 0; });
    } catch (e) {
      _retryCount++;
      if (_retryCount < 5) {
        final delay = Duration(milliseconds: 400 * _retryCount);
        _starting = false;
        await Future.delayed(delay);
        if (mounted) _startCam();
        return;
      }
      if (mounted) setState(() => _errMsg = 'Camera failed. Close other camera apps and retry.');
    } finally {
      _starting = false;
    }
  }

  void _arm(String session) {
    if (_resolved) return;
    if (_lockedSession == session && !_noFlash && (_huntTimer?.isActive ?? false)) return;
    _huntTimer?.cancel();
    setState(() { _lockedSession = session; _noFlash = false; });
    _huntTimer = Timer(_huntMs, () { if (mounted) setState(() => _noFlash = true); });
  }

  Future<void> _onDetect(BarcodeCapture cap) async {
    if (_resolved) return;
    final raw = cap.barcodes.isNotEmpty ? cap.barcodes.first.rawValue : null;
    if (raw == null || raw.isEmpty) return;
    final p = parseAttendanceQr(raw);
    if (p == null) return;
    if (p.tokenVal.isEmpty) { _arm(p.sessionUuid); return; }
    if (_lockedSession != null && p.sessionUuid != _lockedSession) { _arm(p.sessionUuid); return; }
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
          if (_ctrl != null)
            IconButton(
              icon: Icon(_torch ? Icons.flash_on : Icons.flash_off, color: Colors.white),
              onPressed: () async {
                await _ctrl?.toggleTorch();
                if (mounted) setState(() => _torch = !_torch);
              },
            ),
        ],
      ),
      body: !_permOk
          ? _noPerm()
          : _errMsg != null
              ? _camErr()
              : _ctrl == null
                  ? const Center(child: CircularProgressIndicator(color: kPrimary))
                  : _scanner(),
    );
  }

  Widget _scanner() {
    return Stack(fit: StackFit.expand, children: [
      MobileScanner(
        controller: _ctrl!,
        onDetect: _onDetect,
        errorBuilder: (ctx, err) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && !_resolved && !_starting && _retryCount < 5) _startCam();
          });
          return Container(
            color: Colors.black,
            child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const SizedBox(width: 32, height: 32,
                  child: CircularProgressIndicator(color: kPrimary, strokeWidth: 2.5)),
              const SizedBox(height: 14),
              const Text('Starting camera...', style: TextStyle(color: Colors.white70, fontSize: 13)),
            ])),
          );
        },
      ),
      ColorFiltered(
        colorFilter: const ColorFilter.mode(Colors.black54, BlendMode.srcOut),
        child: Stack(fit: StackFit.expand, children: [
          Container(color: Colors.transparent),
          Center(child: Container(
            width: 260, height: 260,
            decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(20)),
          )),
        ]),
      ),
      Center(child: SizedBox(width: 260, height: 260,
        child: Stack(children: [
          _c(t: 0, l: 0), _c(t: 0, r: 0),
          _c(b: 0, l: 0), _c(b: 0, r: 0),
        ]),
      )),
      if (_lockedSession != null)
        Positioned(top: 16, left: 0, right: 0,
          child: Center(child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(color: const Color(0xCC000000), borderRadius: BorderRadius.circular(20)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(_noFlash ? Icons.pause_circle_outline : Icons.radar, color: Colors.white70, size: 16),
              const SizedBox(width: 6),
              Text(
                _noFlash ? 'Waiting for next token...' : 'Session locked - hunting flash',
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ]),
          )),
        ),
      Positioned(
        bottom: 0, left: 0, right: 0,
        child: Container(
          color: const Color(0xDD000000),
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 36),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (_lockedSession != null && !_noFlash) ...[
              SizedBox(width: 120, child: ClipRRect(borderRadius: BorderRadius.circular(2),
                child: const LinearProgressIndicator(minHeight: 3, backgroundColor: Colors.white24,
                    valueColor: AlwaysStoppedAnimation(kPrimary)))),
              const SizedBox(height: 10),
            ],
            const Text(
              'Point at the classroom projector QR code.\nHold steady - token rotates every 3 seconds.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
            ),
          ]),
        ),
      ),
    ]);
  }

  Widget _c({double? t, double? b, double? l, double? r}) {
    return Positioned(top: t, bottom: b, left: l, right: r,
      child: Container(width: 28, height: 28,
        decoration: BoxDecoration(
          border: Border(
            top:    t != null ? const BorderSide(color: kPrimary, width: 3) : BorderSide.none,
            bottom: b != null ? const BorderSide(color: kPrimary, width: 3) : BorderSide.none,
            left:   l != null ? const BorderSide(color: kPrimary, width: 3) : BorderSide.none,
            right:  r != null ? const BorderSide(color: kPrimary, width: 3) : BorderSide.none,
          ),
          borderRadius: BorderRadius.only(
            topLeft:     (t != null && l != null) ? const Radius.circular(6) : Radius.zero,
            topRight:    (t != null && r != null) ? const Radius.circular(6) : Radius.zero,
            bottomLeft:  (b != null && l != null) ? const Radius.circular(6) : Radius.zero,
            bottomRight: (b != null && r != null) ? const Radius.circular(6) : Radius.zero,
          ),
        ),
      ),
    );
  }

  Widget _noPerm() => Center(child: Padding(padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.camera_alt_outlined, color: kTextMuted, size: 64),
      const SizedBox(height: 20),
      const Text('Camera Permission Required',
          style: TextStyle(color: kText, fontSize: 18, fontWeight: FontWeight.w700),
          textAlign: TextAlign.center),
      const SizedBox(height: 10),
      const Text('Camera access is needed to scan the QR code.',
          style: TextStyle(color: kTextMuted), textAlign: TextAlign.center),
      const SizedBox(height: 24),
      FilledButton(onPressed: _init, child: const Text('Grant Permission')),
      const SizedBox(height: 10),
      TextButton(onPressed: openAppSettings,
          child: const Text('Open Settings', style: TextStyle(color: kTextMuted))),
    ]),
  ));

  Widget _camErr() => Center(child: Padding(padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.error_outline, color: kDanger, size: 56),
      const SizedBox(height: 16),
      const Text('Camera Error', style: TextStyle(color: kText, fontSize: 16, fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Text(_errMsg ?? '', style: const TextStyle(color: kTextMuted, fontSize: 12), textAlign: TextAlign.center),
      const SizedBox(height: 24),
      FilledButton(
        onPressed: () { setState(() { _errMsg = null; _retryCount = 0; }); _resetCtrl(); },
        child: const Text('Retry'),
      ),
    ]),
  ));
}
