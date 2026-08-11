// lib/features/home/dashboard_tab.dart
// Tab 1 — Home / Mark Attendance.
import 'package:flutter/material.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/time_sync_service.dart';
import 'package:attendance_gateway/features/claim/claim_page.dart';
import 'package:attendance_gateway/shared/widgets/glass_card.dart';
import 'package:attendance_gateway/main.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  String _name = '';
  String _rollNo = '';
  String? _division;
  bool _loaded = false;
  bool _deviceBound = false;
  bool _clockSynced = false;
  bool _hasHmac = false;
  bool _starting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final name = await SecureStorageService.getStudentName() ?? '';
    final roll = await SecureStorageService.getStudentRollNo() ?? '';
    final division = await SecureStorageService.getStudentDivision();
    final bound = await SecureStorageService.getBoundDeviceId();
    final hmac = await SecureStorageService.getHmacKey();
    var synced = false;
    try {
      synced = TimeSyncService().isTimeSyncFresh();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _name = name;
      _rollNo = roll;
      _division = division;
      _deviceBound = bound != null && bound.isNotEmpty;
      _hasHmac = hmac != null && hmac.isNotEmpty;
      _clockSynced = synced;
      _loaded = true;
    });
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> _markAttendance() async {
    setState(() => _starting = true);
    // The claim flow runs Gate 2 Biometric Flesh Lock + the camera
    // filter-gate + Gate 4 crypto seal before submitting.
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ClaimPage()));
    if (mounted) setState(() => _starting = false);
  }

  Widget _chip(IconData icon, String label, bool ok) {
    final color = ok ? kSuccess : const Color(0xFF64748B);
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        children: [
          // Header — greeting + identity
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_greeting, style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 2),
                    Text(
                      _name.isEmpty ? 'Student' : _name.split(' ').first,
                      style: Theme.of(context).textTheme.headlineSmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      children: [
                        _identityChip(Icons.badge_outlined, _rollNo.isEmpty ? '—' : _rollNo),
                        if (_division != null && _division!.isNotEmpty)
                          _identityChip(Icons.groups_outlined, _division!),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [kAccent, kAccentCyan]),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(Icons.qr_code_scanner, color: Colors.white, size: 28),
              ),
            ],
          ),
          const SizedBox(height: 22),

          // Hero card — attendance readiness
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF3B1D8F), Color(0xFF0E3A5F)],
              ),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
              boxShadow: [
                BoxShadow(color: kAccent.withValues(alpha: 0.35), blurRadius: 32, offset: const Offset(0, 14)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(color: kSuccess, shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: kSuccess, blurRadius: 10, spreadRadius: 2)]),
                    ),
                    const SizedBox(width: 8),
                    Text('Attendance Ready', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white.withValues(alpha: 0.95))),
                  ],
                ),
                const SizedBox(height: 10),
                Text('A lecture session is live for your division' + ( _loaded && !_deviceBound ? ' — sign in to bind this device first' : ''),
                    style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.75), height: 1.4)),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0E3A5F),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    onPressed: _starting ? null : _markAttendance,
                    icon: _starting
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.fingerprint),
                    label: Text('Mark Attendance — Fingerprint', style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          // System status
          Text('System status', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          Row(
            children: [
              _chip(Icons.lock_outline, _deviceBound ? 'Device bound' : 'Not bound', _deviceBound),
              const Spacer(),
              _chip(Icons.schedule, _clockSynced ? 'Clock synced' : 'Syncing…', _clockSynced),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _chip(Icons.verified_user_outlined, _hasHmac ? 'HMAC signer ready' : 'HMAC missing', _hasHmac),
              const Spacer(),
              _chip(Icons.hdr_strong, 'Latency ≤ 250ms', true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _identityChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: const Color(0xFF94A3B8)),
          const SizedBox(width: 5),
          Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFCBD5E1))),
        ],
      ),
    );
  }
}