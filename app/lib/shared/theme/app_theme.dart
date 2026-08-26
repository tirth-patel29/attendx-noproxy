import 'package:flutter/material.dart';

const kPrimary    = Color(0xFF6366F1);
const kPrimaryVar = Color(0xFF818CF8);
const kSuccess    = Color(0xFF10B981);
const kDanger     = Color(0xFFEF4444);
const kWarning    = Color(0xFFF59E0B);
const kBg         = Color(0xFF0F172A);
const kSurface    = Color(0xFF1E293B);
const kSurface2   = Color(0xFF334155);
const kText       = Color(0xFFF8FAFC);
const kTextMuted  = Color(0xFF94A3B8);

ThemeData buildTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: kBg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: kPrimary,
      primary: kPrimary,
      secondary: kSuccess,
      surface: kSurface,
      brightness: Brightness.dark,
      error: kDanger,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: kSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      foregroundColor: kText,
      titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kText),
    ),
    cardTheme: CardThemeData(
      color: kSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF334155)),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurface2,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kPrimary, width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kDanger)),
      hintStyle: const TextStyle(color: kTextMuted, fontSize: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        elevation: 0,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: kSurface,
      indicatorColor: kPrimary.withValues(alpha: 0.15),
      surfaceTintColor: Colors.transparent,
      height: 64,
      labelTextStyle: const WidgetStatePropertyAll(
        TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      ),
      iconTheme: WidgetStateProperty.resolveWith((s) {
        final sel = s.contains(WidgetState.selected);
        return IconThemeData(color: sel ? kPrimary : kTextMuted, size: 24);
      }),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: kText),
      headlineMedium: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: kText),
      headlineSmall: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kText),
      titleLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: kText),
      titleMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kText),
      bodyLarge: TextStyle(fontSize: 15, color: kTextMuted),
      bodyMedium: TextStyle(fontSize: 13, color: kTextMuted),
      bodySmall: TextStyle(fontSize: 12, color: kTextMuted),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: kSurface2,
      contentTextStyle: const TextStyle(color: kText, fontSize: 13),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
    dividerTheme: const DividerThemeData(color: Color(0xFF334155), space: 1),
  );
}