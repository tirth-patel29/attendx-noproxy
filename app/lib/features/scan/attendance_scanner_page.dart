// lib/features/scan/attendance_scanner_page.dart
// Gate 3 Photonic Intercept scanner — proper lifecycle for mobile_scanner 5.x
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';

class AttendancePayload {
  final String sessionUuid;
  final String token;
  const AttendancePayload({required this.sessionUuid, required this.token});
  bool get isFlash => token.isNotEmpty;
}

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
  static const double _maxZoom = 4.0;

  late final MobileScannerController _controller;

  bool _resolved = false;
  bool _permissionRequested = false;
  bool _permissionGranted = false;
  bool _torchOn = false;
  double _zoom = 1.0;
  String? _anchorSession;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      formats: [BarcodeFormat.qrCode],
      detectionSpeed: DetectionSpeed.normal,
      returnImage: false,
    )..start().then((_) {
        if (mounted) {
          setState(() => _permissionGranted = true);
        }
      }).catchError((_) {
        // Permission might not be granted yet
        if (mounted) {
          _ensurePermission();
        }
      });
  }

  Future<void> _ensurePermission() async {
    if (_permissionRequested) return;
    _permissionRequested = true;

    if (await Permission.camera.request().isGranted) {
      _permissionGranted = true;
      try {
        await _controller.start();
      } catch (e) {
        if (mounted) setState(() {});
      }
    }
    if (mounted) setState(() {});
  }

  Future<void> _setZoom(double z) async {
    final clamped = z.clamp(1.0, _maxZoom);
    setState(() => _zoom = clamped);
    try { await _controller.setZoomScale(clamped); } catch (_) {}
  }

  Future<void> _toggleTorch() async {
    try {
      await _controller.toggleTorch();
      if (mounted) setState(() => _torchOn = !_torchOn);
    } catch (e) {
      // Torch not supported or error
    }
  }

  Future<void> _reScan() async {
    try { await _controller.start(); }
    catch (e) {
      await _controller.stop();
      await _controller.start();
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Scanning active — hold steady for the flash.'),
      behavior: SnackBarBehavior.floating,
    ));
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
      appBar: AppBar(title: const Text('Scan QR Code'), leading: const BackButton()),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (!_permissionRequested) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_permissionRequested && !_permissionGranted) {
      return _buildPermissionDenied();
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              color: const Color(0xFF101321),
              alignment: Alignment.center,
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.error_outline, color: Colors.amber, size: 44),
                const SizedBox(height: 12),
                const Text('Camera Error', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text('${error.runtimeType}', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white54, fontSize: 12)),
              ]),
            );
          },
        ),

        Center(
          child: Container(
            width: 250, height: 250,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 1.5),
            ),
            child: const _CornerGuides(),
          ),
        ),
        if (_anchorSession != null)
          const Align(
            alignment: Alignment.topCenter,
            child: Padding(
              padding: EdgeInsets.only(top: 14),
              child: Chip(
                label: Text('Flash locked', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                backgroundColor: Colors.black45,
                side: BorderSide.none,
              ),
            ),
          ),

        Positioned(right: 10, top: 110, bottom: 130, child: _ZoomSlider(zoom: _zoom, onChanged: _setZoom)),

        Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            width: double.infinity,
            color: const Color(0xFF101321),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: _toggleTorch,
                      icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off, color: Colors.white, size: 26),
                    ),
                    const SizedBox(width: 16),
                    TextButton.icon(
                      onPressed: _reScan,
                      style: TextButton.styleFrom(foregroundColor: Colors.white),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Re-scan', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Align QR inside the guides. Hold steady.',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPermissionDenied() {
    // For newer permission_handler, isPermanentlyDenied is a Future
    return Container(
      color: const Color(0xFFF4F5F8),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(28),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.no_photography_outlined, color: Color(0xFFB4B8C7), size: 56),
        const SizedBox(height: 16),
        const Text('Camera permission needed', style: TextStyle(color: Color(0xFF2B2B5E), fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text('Marking attendance requires the camera to read the projector flash.',
            textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF8A8FA3))),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: () { _ensurePermission(); },
          icon: const Icon(Icons.camera_alt_outlined),
          label: const Text('Grant permission'),
        ),
      ]),
    );
  }
}

class _CornerGuides extends StatelessWidget {
  const _CornerGuides();

  @override
  Widget build(BuildContext context) {
    const c = Color(0xFF2B2B5E);
    const l = 26.0, t = 4.0;
    final corner = (Alignment a) => Positioned(
      width: l, height: l,
      left: a.x == -1 ? 0 : null, right: a.x == 1 ? 0 : null,
      top: a.y == -1 ? 0 : null, bottom: a.y == 1 ? 0 : null,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            left: a.x == -1 ? const BorderSide(color: c, width: t) : BorderSide.none,
            top: a.y == -1 ? const BorderSide(color: c, width: t) : BorderSide.none,
            right: a.x == 1 ? const BorderSide(color: c, width: t) : BorderSide.none,
            bottom: a.y == 1 ? const BorderSide(color: c, width: t) : BorderSide.none,
          ),
        ),
      ),
    );
    return Stack(children: [
      corner(const Alignment(-1, -1)), corner(const Alignment(1, -1)),
      corner(const Alignment(-1, 1)), corner(const Alignment(1, 1)),
    ]);
  }
}

class _ZoomSlider extends StatelessWidget {
  final double zoom;
  final ValueChanged<double> onChanged;
  const _ZoomSlider({required this.zoom, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final h = constraints.maxHeight;
      double yFor(double z) => h * (1 - (z - 1) / 3.0);

      void handle(Offset local) {
        final dy = local.dy.clamp(0.0, h);
        final z = 4.0 - (3.0 * dy / h);
        onChanged(z);
      }

      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onVerticalDragUpdate: (d) => handle(d.localPosition),
        onTapDown: (d) => handle(d.localPosition),
        child: SizedBox(
          width: 44,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(width: 4, height: h, decoration: BoxDecoration(color: Colors.white30, borderRadius: BorderRadius.circular(4))),
              Positioned(
                top: yFor(zoom) - 12,
                child: Container(
                  width: 26, height: 26,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8),
                      boxShadow: [BoxShadow(color: Colors.black38, blurRadius: 6)]),
                  child: const Icon(Icons.drag_indicator, size: 16, color: Color(0xFF2B2B5E)),
                ),
              ),
              Positioned(left: 2, top: yFor(4) - 8, child: const _mark('4x')),
              Positioned(left: 2, top: yFor(2) - 8, child: const _mark('2x')),
              Positioned(left: 2, top: yFor(1) - 8, child: const _mark('1x')),
            ],
          ),
        ),
      );
    });
  }
}

class _mark extends StatelessWidget {
  final String label;
  const _mark(this.label);
  @override
  Widget build(BuildContext context) {
    return Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800, shadows: [Shadow(color: Colors.black54, blurRadius: 3)]));
  }
}