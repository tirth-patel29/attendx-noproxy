// lib/features/vault/vault_tab.dart
// Tab 3 — Security & profile vault: identity card, cryptographic enclave
// status, secure logout.
import 'package:flutter/material.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/features/auth/student_auth_page.dart';
import 'package:attendance_gateway/main.dart';
import 'package:attendance_gateway/shared/widgets/glass_card.dart';

class VaultTab extends StatefulWidget {
  const VaultTab({super.key});

  @override
  State<VaultTab> createState() => _VaultTabState();
}

class _VaultTabState extends State<VaultTab> {
  bool _loading = true;
  String? _name, _rollNo, _division, _deviceHash;
  bool _hmacReady = false;
  bool _bound = false;
  String? _email;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final name = await SecureStorageService.getStudentName();
      final roll = await SecureStorageService.getStudentRollNo();
      final device = await SecureStorageService.getDeviceId();
      final hmac = await SecureStorageService.getHmacKey();
      final bound = await SecureStorageService.getBoundDeviceId();
      String? division;
      // Best-effort server truth for the division badge.
      try {
        final token = await SecureStorageService.getAccessToken();
        if (token != null && token.isNotEmpty) {
          final data = await ApiService.getStudentAttendance(accessToken: token);
          division = (data['profile'] as Map?)?['division_name'] as String?;
        }
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _name = name;
        _rollNo = roll;
        _deviceHash = device;
        _hmacReady = hmac != null && hmac.isNotEmpty;
        _bound = bound != null && bound.isNotEmpty;
        _division = division;
        _email = roll != null ? '${roll.toLowerCase()}@charusat.edu.in' : null;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Truncate the synthetic hardware UUID for privacy: aaaaaaaa…cdef
  String _truncate(String? hash) {
    if (hash == null || hash.isEmpty) return 'Not bound';
    if (hash.length <= 12) return hash;
    return '${hash.substring(0, 8)}…${hash.substring(hash.length - 4)}';
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: const Text('Sign out?'),
        content: const Text('This clears the secure session from this device. Your attendance history stays on the server.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (ok != true) return;
    await SecureStorageService.clearAll();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const StudentAuthPage()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        children: [
          Text('Security', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 2),
          Text('Identity & cryptographic enclave', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 18),

          if (_loading)
            const Padding(padding: EdgeInsets.only(top: 60), child: Center(child: CircularProgressIndicator()))
          else ...[
            // Identity card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF16213E), Color(0xFF0E3A5F)]),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 54, height: 54,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [kAccent, kAccentCyan]),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Icon(Icons.person, color: Colors.white.withValues(alpha: 0.9)),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_name ?? 'Student', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                            const SizedBox(height: 2),
                            Text(_email ?? '—', style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _kv('Roll No', _rollNo ?? '—'),
                      const SizedBox(width: 32),
                      _kv('Division', _division ?? '—'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Cryptographic enclave status
            Text('Cryptographic enclave', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            GlassCard(
              child: Column(
                children: [
                  _row(Icons.devices_other, 'Bound hardware UUID', _truncate(_deviceHash),
                      valueColor: _bound ? kSuccess : kDanger, ok: _bound),
                  const Divider(color: Colors.white10, height: 1),
                  _row(Icons.key_outlined, 'HMAC-SHA256 signer', _hmacReady ? 'In KeyStore' : 'Missing',
                      valueColor: _hmacReady ? kSuccess : kDanger, ok: _hmacReady),
                  const Divider(color: Colors.white10, height: 1),
                  _row(Icons.schedule, 'Latency kill window', '≤ 250ms', valueColor: kAccentCyan, ok: true),
                  const Divider(color: Colors.white10, height: 1),
                  _row(Icons.verified_user_outlined, 'Biometric flesh lock', 'OS local_auth', valueColor: kAccentCyan, ok: true),
                ],
              ),
            ),
            const SizedBox(height: 22),

            Text('Session', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            GlassCard(
              padding: EdgeInsets.zero,
              child: ListTile(
                leading: Icon(Icons.logout, color: kDanger.withValues(alpha: 0.9)),
                title: const Text('Sign out', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
                subtitle: const Text('Clear tokens from this device', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, color: Color(0xFF64748B)),
                onTap: _logout,
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: Text('v1.1.0 · Zero-Trust Cryptographic Attendance Gateway',
                  style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.4))),
            ),
          ],
        ],
      ),
    );
  }

  Widget _kv(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, letterSpacing: 1, color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
        const SizedBox(height: 3),
        Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      ],
    );
  }

  Widget _row(IconData icon, String label, String value, {required Color valueColor, required bool ok}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          Icon(icon, size: 20, color: ok ? valueColor : const Color(0xFF64748B)),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13.5, color: Color(0xFFCBD5E1)))),
          Text(value, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: valueColor)),
        ],
      ),
    );
  }
}