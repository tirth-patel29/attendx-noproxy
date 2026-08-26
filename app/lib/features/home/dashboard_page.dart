import 'package:flutter/material.dart';
import '../../core/services/api_service.dart';
import '../../core/services/storage_service.dart';
import '../../core/services/crypto_service.dart';
import '../../core/services/device_service.dart';
import '../../shared/theme/app_theme.dart';
import '../scan/scanner_page.dart';

enum _ClaimState { idle, claiming, success, failed }

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});
  @override State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  String _name = '', _rollNo = '';
  double _pct = 0;
  int _present = 0;
  bool _loading = true;

  _ClaimState _cs = _ClaimState.idle;
  String? _claimMsg;
  Map<String, dynamic>? _claimResult;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    _name   = await StorageService.getName()   ?? '';
    _rollNo = await StorageService.getRollNo() ?? '';
    try {
      final token = await StorageService.getToken() ?? '';
      if (token.isNotEmpty) {
        final d = await ApiService.getAttendance(token);
        final s = (d['summary'] as Map?) ?? {};
        if (mounted) setState(() {
          _pct     = (s['percent'] as num?)?.toDouble() ?? 0;
          _present = (s['present'] as num?)?.toInt() ?? 0;
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _startScan() async {
    // Reset claim state
    setState(() { _cs = _ClaimState.idle; _claimMsg = null; _claimResult = null; });

    // Open scanner DIRECTLY — no intermediate page
    final payload = await Navigator.of(context).push<ScannedPayload>(
      MaterialPageRoute(builder: (_) => const ScannerPage()),
    );
    if (!mounted || payload == null) return;

    // Run claim immediately after scan
    setState(() { _cs = _ClaimState.claiming; _claimMsg = 'Verifying…'; });
    try {
      final token   = await StorageService.getToken() ?? '';
      final uuid    = await StorageService.getStudentUuid() ?? '';
      final hmacKey = await StorageService.getHmac() ?? '';
      final dId     = await StorageService.getDeviceId() ?? await DeviceService.getDeviceIdHash();

      setState(() => _claimMsg = 'Syncing clock…');
      final ch    = await ApiService.getChallenge(payload.sessionUuid);
      final nonce = (ch['nonce'] as String?) ?? CryptoService.nonce();
      final raw   = ch['server_time_ms'] ?? ch['issued_at_epoch'];
      final sTime = raw is num ? raw.toInt() : await ApiService.getServerTimeMs();

      setState(() => _claimMsg = 'Signing…');
      final sig = CryptoService.hmac(
        key: hmacKey, sessionUuid: payload.sessionUuid, studentUuid: uuid,
        tokenVal: payload.tokenVal, claimedTime: sTime, deviceIdHash: dId, nonce: nonce,
      );

      setState(() => _claimMsg = 'Submitting…');
      final res = await ApiService.claimAttendance(
        sessionUuid: payload.sessionUuid, studentUuid: uuid, tokenVal: payload.tokenVal,
        clientClaimedTime: sTime, deviceIdHash: dId, nonce: nonce, hmacSig: sig,
      );

      setState(() { _cs = _ClaimState.success; _claimResult = res; _claimMsg = null; });

      // Refresh attendance data after success
      _load();
    } catch (e) {
      setState(() { _cs = _ClaimState.failed; _claimMsg = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final first = _name.isEmpty ? 'Student' : _name.split(' ').first;
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load, color: kPrimary,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [

              // Greeting row
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Hello, $first 👋', style: Theme.of(context).textTheme.headlineMedium),
                  if (_rollNo.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(_rollNo, style: const TextStyle(color: kTextMuted, fontSize: 12)),
                  ],
                ])),
                Container(
                  width: 44, height: 44,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(colors: [kPrimary, kPrimaryVar]),
                  ),
                  child: Center(child: Text(
                    first.isNotEmpty ? first[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                  )),
                ),
              ]),
              const SizedBox(height: 22),

              // Attendance ring card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [kPrimary, kPrimaryVar],
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8))],
                ),
                child: Row(children: [
                  SizedBox(width: 80, height: 80,
                    child: Stack(alignment: Alignment.center, children: [
                      CircularProgressIndicator(
                        value: _loading ? null : (_pct / 100).clamp(0.0, 1.0),
                        strokeWidth: 8,
                        backgroundColor: Colors.white24,
                        valueColor: const AlwaysStoppedAnimation(Colors.white),
                        strokeCap: StrokeCap.round,
                      ),
                      if (!_loading) Text('${_pct.round()}%',
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                  const SizedBox(width: 18),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('ATTENDANCE', style: TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.5)),
                    const SizedBox(height: 4),
                    Text('$_present lectures', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                    const Text('marked present', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ])),
                ]),
              ),
              const SizedBox(height: 20),

              // ── Scan button / Claim result ──────────────────────────────────
              if (_cs == _ClaimState.idle || _cs == _ClaimState.success || _cs == _ClaimState.failed) ...[
                // Success banner
                if (_cs == _ClaimState.success) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: kSuccess.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: kSuccess.withValues(alpha: 0.3)),
                    ),
                    child: Row(children: [
                      const Icon(Icons.check_circle_rounded, color: kSuccess, size: 28),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Attendance Verified!', style: TextStyle(color: kSuccess, fontWeight: FontWeight.w800, fontSize: 15)),
                        if (_claimResult?['verification_delta_ms'] != null)
                          Text('Delta: ${_claimResult!["verification_delta_ms"]}ms',
                              style: const TextStyle(color: kSuccess, fontSize: 12)),
                      ])),
                    ]),
                  ),
                ],

                // Failed banner
                if (_cs == _ClaimState.failed) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: kDanger.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: kDanger.withValues(alpha: 0.3)),
                    ),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Icon(Icons.cancel_rounded, color: kDanger, size: 24),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Verification Failed', style: TextStyle(color: kDanger, fontWeight: FontWeight.w800)),
                        if (_claimMsg != null) Text(_claimMsg!, style: const TextStyle(color: kDanger, fontSize: 11)),
                      ])),
                    ]),
                  ),
                ],

                // Scan button
                FilledButton.icon(
                  onPressed: _startScan,
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 22),
                  label: Text(_cs == _ClaimState.failed ? 'Retry Scan' : 'Scan for Attendance'),
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
              ] else if (_cs == _ClaimState.claiming) ...[
                // Claiming progress
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: kSurface2),
                  ),
                  child: Column(children: [
                    const CircularProgressIndicator(color: kPrimary),
                    const SizedBox(height: 14),
                    Text(_claimMsg ?? 'Processing…',
                        style: const TextStyle(color: kTextMuted, fontSize: 13)),
                  ]),
                ),
              ],

              const SizedBox(height: 20),

              // Info card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: kSurface, borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: kSurface2),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Row(children: [
                    Icon(Icons.info_outline, color: kPrimary, size: 15),
                    SizedBox(width: 7),
                    Text('How it works', style: TextStyle(color: kText, fontWeight: FontWeight.w700, fontSize: 13)),
                  ]),
                  const SizedBox(height: 10),
                  ...const [
                    ('🔐', 'Your device is bound to your account'),
                    ('📱', 'Tap scan → camera opens immediately'),
                    ('⚡', 'Attendance verified via HMAC-SHA256 in <250ms'),
                  ].map((s) => Padding(
                    padding: EdgeInsets.only(bottom: 7),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(s.$1, style: TextStyle(fontSize: 14)),
                      SizedBox(width: 10),
                      Expanded(child: Text(s.$2, style: TextStyle(color: kTextMuted, fontSize: 12, height: 1.4))),
                    ]),
                  )).toList(),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}