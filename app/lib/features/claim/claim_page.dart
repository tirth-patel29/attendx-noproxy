import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/services/api_service.dart';
import '../../core/services/storage_service.dart';
import '../../core/services/crypto_service.dart';
import '../../core/services/device_service.dart';
import '../../shared/theme/app_theme.dart';
import '../scan/scanner_page.dart';

enum _ClaimState { idle, scanning, claiming, success, failed }

class ClaimPage extends StatefulWidget {
  const ClaimPage({super.key});
  @override State<ClaimPage> createState() => _ClaimPageState();
}

class _ClaimPageState extends State<ClaimPage> {
  _ClaimState _s = _ClaimState.idle;
  String? _rollNo;
  String? _msg;
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    StorageService.getRollNo().then((v) { if (mounted) setState(() => _rollNo = v); });
  }

  Future<void> _scan() async {
    setState(() { _s = _ClaimState.scanning; _msg = null; _result = null; });
    final payload = await Navigator.of(context).push<ScannedPayload>(
      MaterialPageRoute(builder: (_) => const ScannerPage()),
    );
    if (!mounted) return;
    if (payload == null) { setState(() => _s = _ClaimState.idle); return; }
    _claim(payload);
  }

  Future<void> _claim(ScannedPayload p) async {
    setState(() { _s = _ClaimState.claiming; _msg = 'Verifying identity…'; });
    try {
      final token   = await StorageService.getToken() ?? '';
      final uuid    = await StorageService.getStudentUuid() ?? '';
      final hmacKey = await StorageService.getHmac() ?? '';
      final dId     = await StorageService.getDeviceId() ?? await DeviceService.getDeviceIdHash();

      setState(() => _msg = 'Requesting challenge…');
      final ch    = await ApiService.getChallenge(p.sessionUuid);
      final nonce = (ch['nonce'] as String?) ?? CryptoService.nonce();
      final raw   = ch['server_time_ms'] ?? ch['issued_at_epoch'];
      final sTime = raw is num ? raw.toInt() : await ApiService.getServerTimeMs();

      setState(() => _msg = 'Computing HMAC…');
      final sig = CryptoService.hmac(
        key: hmacKey, sessionUuid: p.sessionUuid, studentUuid: uuid,
        tokenVal: p.tokenVal, claimedTime: sTime, deviceIdHash: dId, nonce: nonce,
      );

      setState(() => _msg = 'Submitting claim…');
      final res = await ApiService.claimAttendance(
        sessionUuid: p.sessionUuid, studentUuid: uuid, tokenVal: p.tokenVal,
        clientClaimedTime: sTime, deviceIdHash: dId, nonce: nonce, hmacSig: sig,
      );
      setState(() { _s = _ClaimState.success; _result = res; _msg = null; });
    } catch (e) {
      setState(() { _s = _ClaimState.failed; _msg = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mark Attendance')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _identityCard(),
            const SizedBox(height: 28),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _identityCard() {
    final initial = (_rollNo?.isNotEmpty == true) ? _rollNo![0].toUpperCase() : '?';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: kSurface2)),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: const BoxDecoration(shape: BoxShape.circle,
              gradient: LinearGradient(colors: [kPrimary, kPrimaryVar])),
          child: Center(child: Text(initial,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
        ),
        const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(_rollNo ?? 'Unknown',
              style: const TextStyle(color: kText, fontWeight: FontWeight.w700)),
          Text('${_rollNo?.toLowerCase() ?? ''}@${AppConstants.emailDomain}'
              .replaceFirst('null@', '—@'),
              style: const TextStyle(color: kTextMuted, fontSize: 11)),
        ]),
        const Spacer(),
        const Icon(Icons.verified_rounded, color: kSuccess, size: 18),
      ]),
    );
  }

  Widget _body() {
    switch (_s) {
      case _ClaimState.claiming:
        return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const CircularProgressIndicator(color: kPrimary),
          const SizedBox(height: 20),
          Text(_msg ?? 'Processing…', style: const TextStyle(color: kTextMuted, fontSize: 13)),
        ]);

      case _ClaimState.success:
        return _resultCard(ok: true);

      case _ClaimState.failed:
        return _resultCard(ok: false);

      default:
        return Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
              ),
              child: const Column(children: [
                Icon(Icons.qr_code_scanner_rounded, color: kPrimary, size: 60),
                SizedBox(height: 14),
                Text('Ready to Scan',
                    style: TextStyle(color: kText, fontSize: 18, fontWeight: FontWeight.w800)),
                SizedBox(height: 8),
                Text('Point at the QR code on the classroom projector',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: kTextMuted, fontSize: 13, height: 1.5)),
              ]),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _scan,
              icon: const Icon(Icons.qr_code_scanner_rounded),
              label: const Text('Scan QR Code'),
              style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 15)),
            ),
          ],
        );
    }
  }

  Widget _resultCard({required bool ok}) {
    final delta = _result?['verification_delta_ms'];
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: (ok ? kSuccess : kDanger).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: (ok ? kSuccess : kDanger).withValues(alpha: 0.3)),
        ),
        child: Column(children: [
          Icon(ok ? Icons.check_circle_rounded : Icons.cancel_rounded,
              color: ok ? kSuccess : kDanger, size: 60),
          const SizedBox(height: 14),
          Text(ok ? 'Attendance Verified!' : 'Verification Failed',
              style: TextStyle(color: ok ? kSuccess : kDanger,
                  fontSize: 18, fontWeight: FontWeight.w800)),
          if (ok && delta != null) ...[
            const SizedBox(height: 6),
            Text('Delta: ${delta}ms',
                style: TextStyle(color: ok ? kSuccess : kDanger, fontSize: 12)),
          ],
          if (!ok && _msg != null) ...[
            const SizedBox(height: 8),
            Text(_msg!, textAlign: TextAlign.center,
                style: const TextStyle(color: kTextMuted, fontSize: 12)),
          ],
        ]),
      ),
      const SizedBox(height: 20),
      OutlinedButton.icon(
        onPressed: () => setState(() { _s = _ClaimState.idle; _result = null; _msg = null; }),
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('Scan Again'),
        style: OutlinedButton.styleFrom(
            foregroundColor: kPrimary, side: const BorderSide(color: kPrimary)),
      ),
    ]);
  }
}