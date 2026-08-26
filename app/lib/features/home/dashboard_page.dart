import 'package:flutter/material.dart';
import '../../core/services/api_service.dart';
import '../../core/services/storage_service.dart';
import '../../shared/theme/app_theme.dart';
import '../claim/claim_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});
  @override State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  String _name = '', _rollNo = '';
  double _pct = 0;
  int _present = 0;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    _name   = await StorageService.getName()  ?? '';
    _rollNo = await StorageService.getRollNo() ?? '';
    try {
      final token = await StorageService.getToken() ?? '';
      final d = await ApiService.getAttendance(token);
      final s = (d['summary'] as Map?) ?? {};
      if (mounted) setState(() {
        _pct     = (s['percent'] as num?)?.toDouble() ?? 0;
        _present = (s['present'] as num?)?.toInt() ?? 0;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
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
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Hello, $first 👋', style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 2),
                  Text(_rollNo, style: const TextStyle(color: kTextMuted, fontSize: 12)),
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
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Overall Attendance',
                        style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                    const SizedBox(height: 4),
                    Text('$_present lectures',
                        style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                    const Text('marked present',
                        style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ]),
                ]),
              ),
              const SizedBox(height: 18),

              FilledButton.icon(
                onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ClaimPage())),
                icon: const Icon(Icons.qr_code_scanner_rounded, size: 22),
                label: const Text('Scan for Attendance'),
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
              ),
              const SizedBox(height: 14),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: kSurface, borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: kSurface2),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Row(children: [
                    Icon(Icons.info_outline, color: kPrimary, size: 16),
                    SizedBox(width: 8),
                    Text('How it works', style: TextStyle(color: kText, fontWeight: FontWeight.w700, fontSize: 13)),
                  ]),
                  const SizedBox(height: 12),
                  ...const [
                    ('🔐', 'Your device is cryptographically bound to your account'),
                    ('📱', 'Scan the QR code on the classroom projector'),
                    ('⚡', 'Verified in under 250ms with HMAC-SHA256'),
                  ].map((s) => Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(s.$1, style: TextStyle(fontSize: 14)),
                      SizedBox(width: 10),
                      Expanded(child: Text(s.$2,
                          style: TextStyle(color: kTextMuted, fontSize: 12, height: 1.4))),
                    ]),
                  )),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}