import 'package:attendance_gateway/core/services/api_service.dart';

// lib/features/profile/profile_page.dart
// Profile — student-facing identity and settings. Clean, simple, no crypto.
import 'package:flutter/material.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/main.dart';
import 'package:attendance_gateway/features/history/history_tab.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  String _name = '';
  String _rollNo = '';
  String _email = '';
  String _division = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final name = await SecureStorageService.getStudentName() ?? '';
    final roll = await SecureStorageService.getStudentRollNo() ?? '';
    final email = '$roll@charusat.edu.in';
    final div = await _getDivision();
    if (!mounted) return;
    setState(() {
      _name = name;
      _rollNo = roll;
      _email = email;
      _division = div ?? '';
      _loading = false;
    });
  }

  Future<String?> _getDivision() async {
    try {
      final token = await SecureStorageService.getAccessToken();
      if (token == null || token.isEmpty) return null;
      final data = await ApiService.getStudentAttendance(accessToken: token);
      return (data['profile'] as Map?)?['division_name'] as String?;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Center(
                  child: Container(
                    width: 80, height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(colors: [kPrimary, kAccentCyan]),
                    ),
                    child: const Icon(Icons.person, color: Colors.white, size: 40),
                  ),
                ),
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    _name.isEmpty ? 'Student' : _name,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: kPrimary),
                  ),
                ),
                Center(
                  child: Text(
                    _rollNo.isEmpty ? '—' : _rollNo,
                    style: const TextStyle(fontSize: 15, color: kTextMuted),
                  ),
                ),
                const SizedBox(height: 28),

                const Text('Student Details', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: kPrimary)),
                const SizedBox(height: 12),

                _infoCard('Student ID', _rollNo.isEmpty ? '—' : _rollNo),
                _infoCard('University Email', _email),
                _infoCard('Course', _division.isEmpty ? '—' : _division),

                const SizedBox(height: 32),
                _actionCard(Icons.bar_chart_outlined, 'Attendance History', () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const HistoryTab()),
                  );
                }),
                const SizedBox(height: 16),

                // Soft divider
                Container(height: 1, color: const Color(0xFFE7E9F0)),

                const SizedBox(height: 16),
                const Center(child: Text('Secure Attendance Gateway', style: TextStyle(fontSize: 12, color: kTextMuted))),
                const SizedBox(height: 24),
              ],
            ),
    );
  }

  Widget _infoCard(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE7E9F0)),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: kTextMuted, fontSize: 13))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, color: kPrimary)),
        ],
      ),
    );
  }

  Widget _actionCard(IconData icon, String label, VoidCallback onTap) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE7E9F0)),
      ),
      child: ListTile(
        leading: Icon(icon, color: kPrimary),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, color: kPrimary)),
        trailing: const Icon(Icons.chevron_right, color: kTextMuted),
        onTap: onTap,
      ),
    );
  }
}