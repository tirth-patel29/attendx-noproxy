import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/services/api_service.dart';
import '../../core/services/storage_service.dart';
import '../../shared/theme/app_theme.dart';

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});
  @override State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override void initState() { super.initState(); _fetch(); }

  Future<void> _fetch() async {
    setState(() { _loading = true; _error = null; });
    try {
      final token = await StorageService.getToken() ?? '';
      final d = await ApiService.getAttendance(token);
      setState(() { _data = d; _loading = false; });
    } catch (e) { setState(() { _error = e.toString(); _loading = false; }); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance History'),
          actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _fetch)]),
      body: _loading ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : _error != null ? _buildError()
          : _buildContent(),
    );
  }

  Widget _buildError() => Center(child: Padding(
    padding: const EdgeInsets.all(24),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.cloud_off_outlined, color: kTextMuted, size: 48),
      const SizedBox(height: 12),
      Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: kTextMuted, fontSize: 13)),
      const SizedBox(height: 16),
      FilledButton(onPressed: _fetch, child: const Text('Retry')),
    ]),
  ));

  Widget _buildContent() {
    final s = (_data?['summary'] as Map?) ?? {};
    final pct = (s['percent'] as num?)?.toDouble() ?? 0;
    final present = (s['present'] as num?)?.toInt() ?? 0;
    final missed  = (s['total_missed'] as num?)?.toInt() ?? 0;
    final courses = (_data?['per_course'] as List?) ?? [];
    final records = (_data?['records'] as List?) ?? [];

    return RefreshIndicator(
      onRefresh: _fetch, color: kPrimary,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(child: SizedBox(width: 150, height: 150,
            child: Stack(alignment: Alignment.center, children: [
              CircularProgressIndicator(
                value: (pct / 100).clamp(0.0, 1.0), strokeWidth: 12,
                backgroundColor: kSurface, color: kPrimary, strokeCap: StrokeCap.round,
              ),
              Column(mainAxisSize: MainAxisSize.min, children: [
                Text('${pct.toStringAsFixed(1)}%',
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: kPrimary)),
                const Text('attendance', style: TextStyle(fontSize: 11, color: kTextMuted)),
              ]),
            ]),
          )),
          const SizedBox(height: 18),

          Row(children: [
            _stat('Present', present.toString(), kSuccess),
            const SizedBox(width: 12),
            _stat('Missed', missed.toString(), kDanger),
          ]),
          const SizedBox(height: 22),

          if (courses.isNotEmpty) ...[
            const Text('By Subject', style: TextStyle(color: kText, fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 10),
            ...courses.map((c) {
              final title = (c['title'] as String?) ?? (c['course_code'] as String?) ?? '';
              final pr = (c['present'] as num?)?.toInt() ?? 0;
              final hd = (c['held'] as num?)?.toInt() ?? 1;
              final p  = (pr / hd).clamp(0.0, 1.0);
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: kSurface2)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(title, style: const TextStyle(color: kText, fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis)),
                    Text('$pr/$hd', style: const TextStyle(color: kTextMuted, fontSize: 11)),
                    const SizedBox(width: 8),
                    Text('${(p * 100).round()}%', style: TextStyle(
                        color: p < 0.75 ? kDanger : kSuccess, fontWeight: FontWeight.w700, fontSize: 12)),
                  ]),
                  const SizedBox(height: 8),
                  ClipRRect(borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(value: p, minHeight: 6, backgroundColor: kSurface2,
                        valueColor: AlwaysStoppedAnimation(p < 0.75 ? kDanger : kPrimary))),
                ]),
              );
            }).toList(),
            const SizedBox(height: 22),
          ],

          if (records.isNotEmpty) ...[
            const Text('Activity Log', style: TextStyle(color: kText, fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 10),
            ...records.take(30).map((r) {
              final title = (r['course_title'] as String?) ?? (r['course_code'] as String?) ?? 'Lecture';
              String when = '';
              try {
                final raw = r['server_logged_time'] ?? r['session_date'];
                if (raw != null) when = DateFormat('dd MMM · HH:mm').format(DateTime.parse(raw.toString()).toLocal());
              } catch (_) {}
              final delta = (r['verification_delta_ms'] as num?)?.toInt();
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: kSurface2)),
                child: Row(children: [
                  Container(width: 34, height: 34,
                    decoration: BoxDecoration(color: kSuccess.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(9)),
                    child: const Icon(Icons.check_rounded, color: kSuccess, size: 17)),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title, style: const TextStyle(color: kText, fontWeight: FontWeight.w600, fontSize: 13)),
                    if (when.isNotEmpty) Text(when, style: const TextStyle(color: kTextMuted, fontSize: 11)),
                  ])),
                  if (delta != null)
                    Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(color: kSuccess.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                      child: Text('${delta}ms', style: const TextStyle(color: kSuccess, fontSize: 9, fontWeight: FontWeight.w700))),
                ]),
              );
            }).toList(),
          ],
        ],
      ),
    );
  }

  Widget _stat(String label, String val, Color c) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: kSurface2)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(val, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: c)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: kTextMuted, fontSize: 12)),
      ]),
    ),
  );
}