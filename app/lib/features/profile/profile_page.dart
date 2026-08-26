import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/app_constants.dart';
import '../../core/services/storage_service.dart';
import '../../shared/theme/app_theme.dart';
import '../auth/auth_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  String _name = '', _rollNo = '', _uuid = '';
  @override void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final n = await StorageService.getName()       ?? '';
    final r = await StorageService.getRollNo()     ?? '';
    final u = await StorageService.getStudentUuid() ?? '';
    if (mounted) setState(() { _name = n; _rollNo = r; _uuid = u; });
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: const Text('Sign Out', style: TextStyle(color: kText)),
        content: const Text('Are you sure you want to sign out?', style: TextStyle(color: kTextMuted)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel', style: TextStyle(color: kTextMuted))),
          TextButton(onPressed: () => Navigator.pop(ctx, true),  child: const Text('Sign Out', style: TextStyle(color: kDanger))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await StorageService.clearAll();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const AuthPage()), (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final initial = _name.isNotEmpty ? _name[0].toUpperCase() : '?';
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(child: Container(
            width: 80, height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(colors: [kPrimary, kPrimaryVar]),
              boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.35), blurRadius: 20)],
            ),
            child: Center(child: Text(initial,
                style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800))),
          )),
          const SizedBox(height: 12),
          Center(child: Text(_name.isEmpty ? 'Student' : _name,
              style: const TextStyle(color: kText, fontSize: 20, fontWeight: FontWeight.w800))),
          if (_rollNo.isNotEmpty) Center(child: Text(
            '$_rollNo@${AppConstants.emailDomain}',
            style: const TextStyle(color: kTextMuted, fontSize: 12),
          )),
          const SizedBox(height: 28),

          _section('Account', [
            _row('Student ID', _rollNo.isEmpty ? '—' : _rollNo),
            _divider(),
            _row('Email', _rollNo.isEmpty ? '—' : '$_rollNo@${AppConstants.emailDomain}'),
          ]),
          const SizedBox(height: 14),

          _section('Device', [
            _rowTap('Device UUID',
              _uuid.isEmpty ? '—' : '${_uuid.substring(0, 8)}…${_uuid.substring(_uuid.length - 4)}',
              () {
                Clipboard.setData(ClipboardData(text: _uuid));
                ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('UUID copied to clipboard')));
              }),
          ]),
          const SizedBox(height: 24),

          Container(
            decoration: BoxDecoration(
              color: kDanger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kDanger.withValues(alpha: 0.25)),
            ),
            child: ListTile(
              leading: const Icon(Icons.logout_rounded, color: kDanger),
              title: const Text('Sign Out', style: TextStyle(color: kDanger, fontWeight: FontWeight.w700)),
              onTap: _logout,
            ),
          ),
          const SizedBox(height: 20),
          const Center(child: Text('Attendance Gateway v1.0',
              style: TextStyle(color: kTextMuted, fontSize: 11))),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> rows) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title.toUpperCase(), style: const TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
      const SizedBox(height: 8),
      Container(
        decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: kSurface2)),
        child: Column(children: rows),
      ),
    ],
  );

  Widget _divider() => const Divider(height: 1, indent: 16, endIndent: 16);

  Widget _row(String label, String val) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(children: [
      Text(label, style: const TextStyle(color: kTextMuted, fontSize: 13)),
      const Spacer(),
      Text(val, style: const TextStyle(color: kText, fontWeight: FontWeight.w600, fontSize: 13)),
    ]),
  );

  Widget _rowTap(String label, String val, VoidCallback onTap) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(14),
    child: _row(label, val),
  );
}