// lib/features/home/dashboard_tab.dart
// Home — minimal light UI: welcome, health pills, active session, scan, recent.
import 'package:flutter/material.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/time_sync_service.dart';
import 'package:attendance_gateway/features/profile/profile_page.dart';
import 'package:attendance_gateway/features/claim/claim_page.dart';
import 'package:attendance_gateway/main.dart';
import 'package:attendance_gateway/shared/utils/formatters.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  String _name = '';
  String _rollNo = '';
  bool _clockSynced = false;
  bool _secure = false;
  bool _starting = false;
  List<dynamic> _recent = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final name = await SecureStorageService.getStudentName() ?? '';
    final roll = await SecureStorageService.getStudentRollNo() ?? '';
    final bound = await SecureStorageService.getBoundDeviceId();
    final hmac = await SecureStorageService.getHmacKey();
    var synced = false;
    try { synced = TimeSyncService().isTimeSyncFresh(); } catch (_) {}
    try {
      final token = await SecureStorageService.getAccessToken();
      if (token != null && token.isNotEmpty) {
        final data = await ApiService.getStudentAttendance(accessToken: token);
        _recent = (data['records'] as List?) ?? const [];
      }
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _name = name;
      _rollNo = roll;
      _clockSynced = synced;
      _secure = (bound != null && bound.isNotEmpty) && (hmac != null && hmac.isNotEmpty);
    });
  }

  Future<void> _markAttendance() async {
    setState(() => _starting = true);
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ClaimPage()));
    if (mounted) setState(() => _starting = false);
  }

  Widget _healthPill(String label, bool ok) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: ok ? kSuccess.withValues(alpha: 0.10) : kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ok ? kSuccess.withValues(alpha: 0.35) : const Color(0xFFE7E9F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 9, color: ok ? kSuccess : const Color(0xFFB4B8C7)),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: ok ? kPrimary : kTextMuted)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final firstName = _name.isEmpty ? 'there' : _name.split(' ').first;
    return SafeArea(
      child: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            children: [
              const SizedBox(height: 4),
              // Centered avatar + welcome
              Center(
                child: Container(
                  width: 72, height: 72,
                  decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [kPrimary, kAccentCyan])),
                  child: const Icon(Icons.person, color: Colors.white, size: 40),
                ),
              ),
              const SizedBox(height: 12),
              Center(child: Text('Welcome, $firstName!', style: Theme.of(context).textTheme.headlineSmall)),
              Center(child: Text(_rollNo.isEmpty ? '' : _rollNo, style: Theme.of(context).textTheme.bodySmall)),
              const SizedBox(height: 16),

              // Health pills
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _healthPill('Sync OK', _clockSynced),
                  const SizedBox(width: 8),
                  _healthPill('Secure OK', _secure),
                  const SizedBox(width: 8),
                  _healthPill('Lat Fast', true),
                ],
              ),
              const SizedBox(height: 20),

              // Active Session card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [kPrimary, kAccentCyan]),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.25), blurRadius: 24, offset: const Offset(0, 12))],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.circle, size: 9, color: kSuccess, /* pulsing dot */),
                        const SizedBox(width: 8),
                        const Text('Active Session Live', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text('CHARUSAT', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 2)),
                    const SizedBox(height: 4),
                    Text('Division: CSE-A', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Scan button
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 17),
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                  onPressed: _starting ? null : _markAttendance,
                  icon: _starting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.qr_code_scanner),
                  label: const Text('Scan for Attendance'),
                ),
              ),
              const SizedBox(height: 22),

              // Recent records
              Text('Recent Records', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              if (_recent.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(16)),
                  child: Text('No records yet — scan a live session to get started.', style: Theme.of(context).textTheme.bodySmall),
                )
              else
                ..._recent.take(4).map((r) {
                  final title = (r['course_title'] as String?) ?? (r['course_code'] as String? ?? 'Lecture');
                  final when = fmtDateTimeShort((r['server_logged_time'] as String?) ?? (r['session_date'] as String?));
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(14)),
                    child: Row(
                      children: [
                        Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(color: kSuccess.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Icons.check, color: kSuccess, size: 18),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: kPrimary))),
                        Text(when, style: const TextStyle(fontSize: 12.5, color: kTextMuted)),
                      ],
                    ),
                  );
                }).toList(),
            ],
          ),
          // Settings gear -> Account & Security
          Positioned(
            top: 0,
            right: 4,
            child: IconButton(
              icon: const Icon(Icons.settings_outlined, color: kPrimary),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProfilePage())),
            ),
          ),
        ],
      ),
    );
  }
}