// lib/shared/utils/extensions.dart
// Useful extensions for the app

extension StringExtensions on String {
  /// Truncate string to max length
  String truncate(int maxLength, {String suffix = '...'}) {
    if (length <= maxLength) return this;
    return substring(0, maxLength - suffix.length) + suffix;
  }

  /// Check if string is a valid UUID
  bool get isValidUuid {
    final uuidRegExp = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      caseSensitive: false,
    );
    return uuidRegExp.hasMatch(this);
  }

  /// Truncate to 8 chars for display
  String get shortUuid => length > 8 ? '${substring(0, 8)}...' : this;
}

extension IntExtensions on int {
  /// Format milliseconds as mm:ss
  String get mmss {
    final minutes = (this / 60000).floor();
    final seconds = ((this % 60000) / 1000).floor();
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  /// Format as human-readable duration
  String get durationString {
    if (this < 1000) return '${this}ms';
    if (this < 60000) return '${(this / 1000).toStringAsFixed(1)}s';
    if (this < 3600000) return '${(this / 60000).floor()}m ${((this % 60000) / 1000).floor()}s';
    return '${(this / 3600000).floor()}h ${((this % 3600000) / 60000).floor()}m';
  }
}

extension DateTimeExtensions on DateTime {
  /// Format as HH:mm:ss
  String get timeString {
    return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}:${second.toString().padLeft(2, '0')}';
  }

  /// Format as ISO string without milliseconds
  String get isoNoMs => toIso8601String().split('.').first;
}

extension IterableExtensions<T> on Iterable<T> {
  /// Safe firstOrNull
  T? get firstOrNull => isEmpty ? null : first;
}