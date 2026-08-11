// lib/features/history/history_tab.dart
// Tab 2 — Attendance history & analytics (fed by GET /student/attendance).
import 'package:flutter/material.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/main.dart';
import 'package:attendance_gateway/shared/widgets/glass_card.dart';
import 'package:attendance_gateway/shared/utils/formatters.dart';

class HistoryTab extends StatefulWidget {
  const HistoryTab({super.key});

  @override
  State<HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<HistoryTab> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() { _loading = true; _error = null; });
    try {
      final token = await SecureStorageService.getAccessToken();
      if (token == null || token.isEmpty) {
        setState(() { _loading = false; _error = 'No session token'; });
        return;
      }
      final data = await ApiService.getStudentAttendance(accessToken: token);
      if (!mounted) return;
      setState(() { _data = data; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _fetch,
        color: kAccent,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          children: [
            Text('Attendance', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 2),
            Text('Marked sessions & analytics', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 18),
            if (_loading)
              const Padding(padding: EdgeInsets.only(top: 80), child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              _buildError()
            else
              ..._buildContent(),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Column(
      children: [
        const SizedBox(height: 60),
        const Icon(Icons.cloud_off, size: 48, color: Color(0xFF64748B)),
        const SizedBox(height: 12),
        Text(_error ?? 'Something went wrong', textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF94A3B8))),
        const SizedBox(height: 16),
        FilledButton(onPressed: _fetch, child: const Text('Retry')),
      ],
    );
  }

  List<Widget> _buildContent() {
    final summary = (_data?['summary'] as Map?) ?? {};
    final present = (summary['present'] as num?)?.toInt() ?? 0;
    final held = (summary['total_held'] as num?)?.toInt() ?? 0;
    final missed = (summary['total_missed'] as num?)?.toInt() ?? 0;
    final percent = (summary['percent'] as num?)?.toDouble() ?? 0;
    final perCourse = (_data?['per_course'] as List?) ?? [];
    final records = (_data?['records'] as List?) ?? [];

    return [
      // Summary cards
      Row(
        children: [
          Expanded(
            flex: 3,
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF7C3AED), Color(0xFF4CC9F0)]),
                borderRadius: BorderRadius.circular(22),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(percent.toStringAsFixed(1) + '%',
                      style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: Colors.white)),
                  const SizedBox(height: 4),
                  const Text('Attendance', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white70)),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(flex: 2, child: _statCard('Present', present.toString(), kSuccess, Icons.check_circle_outline)),
          const SizedBox(width: 12),
          Expanded(flex: 2, child: _statCard('Missed', missed.toString(), kDanger, Icons.cancel_outlined)),
        ],
      ),
      const SizedBox(height: 22),

      // Subject breakdown
      Text('By subject', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      if (perCourse.isEmpty)
        GlassCard(child: Text('No attendance yet — mark your first session from the Home tab.',
            style: Theme.of(context).textTheme.bodySmall))
      else
        ...perCourse.map((c) {
          final title = (c['title'] as String?) ?? (c['course_code'] as String? ?? '');
          final pr = (c['present'] as num?)?.toInt() ?? 0;
          final hd = (c['held'] as num?)?.toInt() ?? 0;
          final pct = hd > 0 ? ((pr / hd) * 100).clamp(0, 100).toDouble() : 0.0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14), overflow: TextOverflow.ellipsis)),
                      Text('$pr/$hd', style: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: pct / 100,
                      minHeight: 8,
                      backgroundColor: Colors.white.withValues(alpha: 0.07),
                      valueColor: const AlwaysStoppedAnimation(kAccentCyan),
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      const SizedBox(height: 22),

      // Activity log
      Text('Activity log', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      if (records.isEmpty)
        GlassCard(child: Text('No records yet.', style: Theme.of(context).textTheme.bodySmall))
      else
        ...[
          GlassCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: records.take(50).map((r) {
                final title = (r['course_title'] as String?) ?? (r['course_code'] as String? ?? '');
                final when = fmtDateTimeShort((r['server_logged_time'] as String?) ?? (r['session_date'] as String?));
                final delta = (r['verification_delta_ms'] as num?)?.toInt() ?? 0;
                return ListTile(
                  dense: true,
                  leading: Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(color: kSuccess.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.verified_outlined, color: kSuccess, size: 20),
                  ),
                  title: Text(title ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: Text(when, style: Theme.of(context).textTheme.bodySmall),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _badge('VERIFIED', kSuccess),
                      const SizedBox(height: 2),
                      Text('Δ ${delta}ms', style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
    ];
  }

  Widget _statCard(String label, String value, Color color, IconData icon) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white)),
          Text(label, style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.4)),
    );
  }
}