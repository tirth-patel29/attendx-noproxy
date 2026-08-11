// lib/shared/utils/formatters.dart
const List<String> _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/// ISO-8601 -> localized "11 Aug 2026, 09:05" (no intl dependency).
String fmtDateTime(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return iso;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${dt.day} ${_months[dt.month - 1]} ${dt.year}, ${two(dt.hour)}:${two(dt.minute)}';
}

/// Compact "11 Aug, 09:05".
String fmtDateTimeShort(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return iso;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${dt.day} ${_months[dt.month - 1]}, ${two(dt.hour)}:${two(dt.minute)}';
}
