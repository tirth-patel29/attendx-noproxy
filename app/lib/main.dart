// lib/main.dart
// Attendance Gateway — light-mode, professional UI + auto-login gate.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/time_sync_service.dart';
import 'package:attendance_gateway/features/auth/student_auth_page.dart';
import 'package:attendance_gateway/features/home/home_shell.dart';

// ---- light, professional palette ------------------------------------------
const kBg = Color(0xFFFFFFFF);      // pure white
const kSurface = Color(0xFFF4F5F8); // cool light gray card surface
const kPrimary = Color(0xFF2B2B5E); // deep indigo (buttons + typography)
const kAccent = Color(0xFF2B2B5E);
const kAccentCyan = Color(0xFF5B67D6); // soft indigo accent
const kSuccess = Color(0xFF2ECC71); // status green
const kDanger = Color(0xFFE74C3C);
const kTextMuted = Color(0xFF8A8FA3);

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
      themeMode: ThemeMode.light,
      home: const BootGate(),
    );
  }
}

ThemeData _buildTheme() {
  return ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    scaffoldBackgroundColor: kBg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: kPrimary,
      primary: kPrimary,
      secondary: kAccentCyan,
      onPrimary: Colors.white,
      surface: kSurface,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: kBg,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      foregroundColor: kPrimary,
      titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: kPrimary, letterSpacing: 0.5),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: Color(0xFFE7E9F0))),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kBg,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
      hintStyle: const TextStyle(color: kTextMuted),
      labelStyle: const TextStyle(color: kTextMuted),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE0E3EC)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: kPrimary, width: 1.6),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: kPrimary.withValues(alpha: 0.08),
      surfaceTintColor: Colors.transparent,
      height: 64,
      labelTextStyle: WidgetStatePropertyAll(
        const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kPrimary),
      ),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final sel = states.contains(WidgetState.selected);
        return IconThemeData(color: sel ? kPrimary : const Color(0xFFB4B8C7), size: 25);
      }),
    ),
    textTheme: const TextTheme(
      headlineSmall: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: kPrimary),
      titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kPrimary),
      titleSmall: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: kPrimary),
      bodyMedium: TextStyle(fontSize: 14, color: Color(0xFF3A3F58)),
      bodySmall: TextStyle(fontSize: 12, color: Color(0xFF9AA0B4)),
    ),
  );
}

/// Auto-login splash: bound session exists -> calibrate network clock (Cristian)
/// and jump to the Home shell; otherwise sign-in.
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
      return const Scaffold(
        backgroundColor: kBg,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shield_outlined, size: 72, color: kPrimary),
              SizedBox(height: 16),
              Text('Attendance Gateway', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: kPrimary, letterSpacing: 0.5)),
              SizedBox(height: 24),
              SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3, color: kPrimary)),
            ],
          ),
        ),
      );
    }
    return _authed ? const HomeShell() : const StudentAuthPage();
  }
}