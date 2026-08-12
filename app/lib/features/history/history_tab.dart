// lib/features/history/history_tab.dart
// History — ATTENDANCE OVERVIEW: % circle, present/missed, subject bars, log.
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
        color: kPrimary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          children: [
            Text('ATTENDANCE OVERVIEW', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: kPrimary, letterSpacing: 0.5)),
            const SizedBox(height: 20),
            if (_loading)
              const Padding(padding: EdgeInsets.only(top: 80), child: Center(child: CircularProgressIndicator(color: kPrimary)))
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
    return Column(children: [
      const SizedBox(height: 50),
      const Icon(Icons.cloud_off, size: 46, color: Color(0xFFB4B8C7)),
      const SizedBox(height: 12),
      Text(_error ?? 'Something went wrong', textAlign: TextAlign.center, style: const TextStyle(color: kTextSecondary)),
      const SizedBox(height: 16),
      FilledButton(onPressed: _fetch, child: Text('Retry')),
    ]);
  }

  List<Widget> _buildContent() {
    final s = (_data?['summary'] as Map?) ?? {};
    final present = (s['present'] as num?)?.toInt() ?? 0;
    final missed = (s['total_missed'] as num?)?.toInt() ?? 0;
    final percent = (s['percent'] as num?)?.toDouble() ?? 0;
    final perCourse = (_data?['per_course'] as List?) ?? [];
    final records = (_data?['records'] as List?) ?? [];

    return [
      // Overall progress circle
      Center(
        child: SizedBox(
          width: 170, height: 170,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 170, height: 170,
                child: CircularProgressIndicator(
                  value: (percent / 100).clamp(0, 1),
                  strokeWidth: 12,
                  backgroundColor: kSurface,
                  color: kPrimary,
                  strokeCap: StrokeCap.round,
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('${percent.toStringAsFixed(1)}%',
                      style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: kPrimary)),
                  Text('Overall Attendance', style: TextStyle(fontSize: 12, color: kTextSecondary)),
                ],
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 22),

      // Present / Missed cards
      Row(
        children: [
          Expanded(child: _statCard(Icons.check_circle_outline, 'Present', present.toString(), kSuccess)),
          const SizedBox(width: 12),
          Expanded(child: _statCard(Icons.cancel_outlined, 'Missed', missed.toString(), kDanger)),
        ],
      ),
      const SizedBox(height: 24),

      // Subject breakdown
      Text('Subjects', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: kPrimary)),
      const SizedBox(height: 12),
      if (perCourse.isEmpty)
        GlassCard(child: Text('No data yet.', style: Theme.of(context).textTheme.bodySmall))
      else
        ...perCourse.map((c) {
          final title = (c['title'] as String?) ?? (c['course_code'] as String? ?? '');
          final pr = (c['present'] as num?)?.toInt() ?? 0;
          final hd = (c['held'] as num?)?.toInt() ?? 0;
          final pct = hd > 0 ? ((pr / hd) * 100).clamp(0, 100).toDouble() : 0.0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              child: Row(
                children: [
                  Expanded(
                    child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: kPrimary), overflow: TextOverflow.ellipsis),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 120,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: pct / 100,
                        minHeight: 9,
                        backgroundColor: kSurface,
                        valueColor: const AlwaysStoppedAnimation(kPrimary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(width: 42, child: Text('${pct.round()}%', textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w800, color: kPrimary))),
                ],
              ),
            ),
          );
        }).toList(),
      const SizedBox(height: 24),

      // Activity log
      Text('Activity Log', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: kPrimary)),
      const SizedBox(height: 12),
      if (records.isEmpty)
        GlassCard(child: Text('No records yet.', style: Theme.of(context).textTheme.bodySmall))
      else
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: records.take(40).map((r) {
              final title = (r['course_title'] as String?) ?? (r['course_code'] as String? ?? 'Lecture');
              final when = fmtDateTime((r['server_logged_time'] as String?) ?? (r['session_date'] as String?));
              final delta = (r['verification_delta_ms'] as num?)?.toInt() ?? 0;
              return ListTile(
                dense: true,
                leading: Container(
                  width: 38, height: 38,
                  decoration: BoxDecoration(color: kSuccess.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(11)),
                  child: const Icon(Icons.verified_outlined, color: kSuccess, size: 19),
                ),
                title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: kPrimary, fontSize: 13.5)),
                subtitle: Text('$when  ·  Δ ${delta}ms', style: const TextStyle(fontSize: 11.5, color: kTextSecondary)),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: kSuccess.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                  child: Text('VERIFIED', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: kSuccess)),
                ),
              );
            }).toList(),
          ),
        ),
    ];
  }

  Widget _statCard(IconData icon, String label, String value, Color color) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: kPrimary)),
          Text(label, style: const TextStyle(fontSize: 12.5, color: kTextSecondary)),
        ],
      ),
    );
  }
}