// lib/main.dart
// Attendance Gateway — Premium Material 3 Dark Theme + Auto-login Gate
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/time_sync_service.dart';
import 'package:attendance_gateway/features/auth/student_auth_page.dart';
import 'package:attendance_gateway/features/home/home_shell.dart';

// Premium Dark Theme Palette
const kPrimary = Color(0xFF6366F1); // Indigo-500
const kPrimaryDark = Color(0xFF4F46E5); // Indigo-600
const kPrimaryLight = Color(0xFF818CF8); // Indigo-400
const kSecondary = Color(0xFF10B981); // Emerald-500
const kBackground = Color(0xFF0F172A); // Slate-900
const kSurface = Color(0xFF1E293B); // Slate-800
const kSurfaceLight = Color(0xFF334155); // Slate-700
const kSurfaceDark = Color(0xFF0F172A); // Slate-900
const kTextPrimary = Color(0xFFF8FAFC); // Slate-50
const kTextSecondary = Color(0xFF94A3B8); // Slate-400
const kSuccess = Color(0xFF10B981); // Emerald-500
const kDanger = Color(0xFFEF4444); // Red-500
const kWarning = Color(0xFFF59E0B); // Amber-500

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.initialize();
  await SecureStorageService.isProvisioned();
  runApp(const ProviderScope(child: AttendanceGatewayApp()));
}

class AttendanceGatewayApp extends StatelessWidget {
  const AttendanceGatewayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Attendance Gateway',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(),
      themeMode: ThemeMode.dark,
      home: const BootGate(),
    );
  }
}

ThemeData _buildTheme() {
  return ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    scaffoldBackgroundColor: kBackground,
    colorScheme: ColorScheme.fromSeed(
      seedColor: kPrimary,
      primary: kPrimary,
      secondary: kSecondary,
      surface: kSurface,
      brightness: Brightness.dark,
      error: kDanger,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: kSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      foregroundColor: kTextPrimary,
      titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: kTextPrimary),
    ),
    cardTheme: CardThemeData(
      color: kSurface,
      elevation: 2,
      margin: const EdgeInsets.all(12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurfaceLight,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
      hintStyle: const TextStyle(color: kTextSecondary),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: kSurfaceDark, width: 1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: kPrimary, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        elevation: 0,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: kSurface,
      indicatorColor: kPrimary.withValues(alpha: 0.15),
      surfaceTintColor: Colors.transparent,
      height: 68,
      labelTextStyle: WidgetStatePropertyAll(
        const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
      ),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final sel = states.contains(WidgetState.selected);
        return IconThemeData(color: sel ? kPrimary : kTextSecondary, size: 26);
      }),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: kTextPrimary, letterSpacing: -0.5),
      headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: kTextPrimary, letterSpacing: -0.3),
      headlineSmall: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: kTextPrimary),
      titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kTextPrimary),
      titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: kTextPrimary),
      titleSmall: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kTextPrimary),
      bodyLarge: TextStyle(fontSize: 16, color: kTextSecondary),
      bodyMedium: TextStyle(fontSize: 14, color: kTextSecondary),
      bodySmall: TextStyle(fontSize: 12, color: kTextSecondary),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        elevation: 0,
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: kSurfaceDark,
      contentTextStyle: const TextStyle(color: kTextPrimary),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}

class BootGate extends StatefulWidget {
  const BootGate({super.key});

  @override
  State<BootGate> createState() => _BootGateState();
}

class _BootGateState extends State<BootGate> {
  bool _checking = true;
  bool _authed = false;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    String? token;
    String? uuid;
    try {
      token = await SecureStorageService.getAccessToken();
      uuid = await SecureStorageService.getStudentUuid();
    } catch (_) {}
    final authed = token != null && token.isNotEmpty && uuid != null && uuid.isNotEmpty;
    if (authed) {
      try {
        await TimeSyncService().syncTime();
      } catch (_) {}
    }
    if (!mounted) return;
    setState(() { _authed = authed; _checking = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return Scaffold(
        backgroundColor: kBackground,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 96, height: 96,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(colors: [kPrimary, kSecondary]),
                  boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.4), blurRadius: 30)],
                ),
                child: const Icon(Icons.shield, size: 52, color: Colors.white),
              ),
              const SizedBox(height: 24),
              const Text('Attendance Gateway', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: kTextPrimary, letterSpacing: 0.5)),
              const SizedBox(height: 16),
              const Text('Verifying...', style: TextStyle(fontSize: 14, color: kTextSecondary)),
              const SizedBox(height: 32),
              SizedBox(width: 32, height: 32, child: CircularProgressIndicator(strokeWidth: 3, color: kPrimary)),
            ],
          ),
        ),
      );
    }
    return _authed ? const HomeShell() : const StudentAuthPage();
  }
}