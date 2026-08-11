// lib/features/account/account_settings_page.dart
// Account & Security — clean settings list, biometric toggle, crypto enclave,
// sign-out. Light mode. (v1.2.0 footer.)
import 'package:flutter/material.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/device_info_service.dart';
import 'package:attendance_gateway/main.dart';
import 'package:attendance_gateway/features/auth/student_auth_page.dart';

class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage({super.key});

  @override
  State<AccountSettingsPage> createState() => _AccountSettingsPageState();
}

class _AccountSettingsPageState extends State<AccountSettingsPage> {
  bool _biometrics = true;
  String? _deviceHash;
  bool _hmac = false;
  String _rollNo = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    String? hash = _deviceHash;
    var hmac = _hmac;
    final roll = await SecureStorageService.getStudentRollNo() ?? '';
    try { hash = await DeviceInfoService.getDeviceIdHash(); } catch (_) {}
    final k = await SecureStorageService.getHmacKey();
    hmac = k != null && k.isNotEmpty;
    if (!mounted) return;
    setState(() { _deviceHash = hash; _hmac = hmac; _rollNo = roll; });
  }

  String _truncate(String? h) {
    if (h == null || h.isEmpty) return 'Not bound';
    if (h.length <= 12) return h;
    return '${h.substring(0, 8)}…${h.substring(h.length - 4)}';
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating));
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?', style: TextStyle(color: kPrimary, fontWeight: FontWeight.w800)),
        content: const Text('This clears the secure session from this device. Your history stays on the server.'),
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
    return Scaffold(
      appBar: AppBar(title: const Text('ACCOUNT & SECURITY')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _section('General'),
          _tile(Icons.bar_chart, 'View Attendance History', () => _toast('Open the History tab (bottom nav) to view analytics.')),
          _tile(Icons.description_outlined, 'Security Logs', () => _toast('No event logs on this device — audit lives server-side.')),
          const SizedBox(height: 20),

          _section('Authentication'),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _biometrics,
            onChanged: (v) => setState(() => _biometrics = v),
            secondary: const Icon(Icons.fingerprint, color: kPrimary),
            title: const Text('Device Biometrics', style: TextStyle(fontWeight: FontWeight.w700, color: kPrimary)),
            subtitle: const Text('Require fingerprint / Face ID to mark attendance', style: TextStyle(fontSize: 12, color: kTextMuted)),
            activeTrackColor: kPrimary,
            activeThumbColor: Colors.white,
          ),
          const SizedBox(height: 8),

          _section('Cryptographic Enclave Details'),
          GlassRow(Icons.devices_other, 'Hardware UUID', _truncate(_deviceHash), _deviceHash != null && _deviceHash != 'Not bound'),
          const Divider(height: 1, color: Color(0xFFE7E9F0)),
          GlassRow(Icons.key_outlined, 'HMAC-SHA256 signer', 'In KeyStore', _hmac),
          const Divider(height: 1, color: Color(0xFFE7E9F0)),
          GlassRow(Icons.schedule, 'Latency kill window', '≤ 250 ms', true),
          const Divider(height: 1, color: Color(0xFFE7E9F0)),
          GlassRow(Icons.verified_user_outlined, 'Identity', '${_rollNo.isEmpty ? '—' : _rollNo + '@charusat.edu.in'}', true),
          const SizedBox(height: 28),

          // Sign Out
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: kPrimary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16)),
              onPressed: _logout,
              child: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
          const SizedBox(height: 18),
          const Center(child: Text('v1.2.0 · Secure Attendance Gateway', style: TextStyle(fontSize: 11.5, color: Color(0xFFB4B8C7)))),
        ],
      ),
    );
  }

  Widget _section(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 11.5, letterSpacing: 1.2, fontWeight: FontWeight.w800, color: kTextMuted)),
    );
  }

  Widget _tile(IconData icon, String title, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE7E9F0))),
      child: ListTile(
        leading: Icon(icon, color: kPrimary),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: kPrimary, fontSize: 14.5)),
        trailing: const Icon(Icons.chevron_right, color: Color(0xFFB4B8C7)),
        onTap: onTap,
      ),
    );
  }
}

class GlassRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool ok;
  const GlassRow(this.icon, this.label, this.value, this.ok);

  @override
  Widget build(BuildContext context) {
    final color = ok ? kSuccess : kDanger;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 13),
      child: Row(children: [
        Icon(icon, size: 20, color: ok ? kPrimary : color),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 13.5, color: Color(0xFF3A3F58)))),
        Text(value, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: color)),
      ]),
    );
  }
}