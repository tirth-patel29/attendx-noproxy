// lib/main.dart
// Attendance Gateway — sign in gate + premium dark shell.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/time_sync_service.dart';
import 'package:attendance_gateway/features/auth/student_auth_page.dart';
import 'package:attendance_gateway/features/home/home_shell.dart';

// ---- premium dark palette -------------------------------------------------
const kBg = Color(0xFF0A0F1E);
const kSurface = Color(0xFF141B2E);
const kAccent = Color(0xFF7C3AED);
const kAccentCyan = Color(0xFF4CC9F0);
const kSuccess = Color(0xFF34D399);
const kDanger = Color(0xFFFB7185);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.initialize();
  await SecureStorageService.isProvisioned(); // ensure KeyStore is ready
  runApp(const ProviderScope(child: AttendanceGatewayApp()));
}

class AttendanceGatewayApp extends StatelessWidget {
  const AttendanceGatewayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Attendance Gateway',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(Brightness.dark),
      darkTheme: _buildTheme(Brightness.dark),
      themeMode: ThemeMode.dark,
      home: const BootGate(),
    );
  }
}

ThemeData _buildTheme(Brightness _) {
  final scheme = ColorScheme.fromSeed(
    seedColor: kAccent,
    brightness: Brightness.dark,
    surface: kSurface,
  ).copyWith(primary: kAccent, secondary: kAccentCyan, onPrimary: Colors.white);

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: kBg,
    fontFamily: 'Inter',
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      foregroundColor: Colors.white,
      titleTextStyle: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white),
    ),
    cardTheme: CardThemeData(
      color: kSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
      hintStyle: const TextStyle(color: Color(0xFF64748B)),
      labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.10)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: kAccent, width: 1.6),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kAccent,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: const Color(0xFF0D1424),
      indicatorColor: kAccent.withValues(alpha: 0.18),
      height: 68,
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.85)),
      ),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final sel = states.contains(WidgetState.selected);
        return IconThemeData(color: sel ? kAccentCyan : const Color(0xFF64748B), size: 26);
      }),
    ),
    textTheme: const TextTheme(
      headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white),
      titleMedium: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white),
      bodyMedium: TextStyle(fontSize: 14, color: Color(0xFFCBD5E1)),
      bodySmall: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
    ),
  );
}

/// Auto-login splash: if a bound session exists in the KeyStore, calibrate the
/// network clock (Cristian's Algorithm) and jump straight to the Dashboard.
/// Otherwise land on the sign-in screen.
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
        await TimeSyncService().syncTime(); // calibrate drift before claims
      } catch (_) {/* non-fatal */}
    }
    if (!mounted) return;
    setState(() {
      _authed = authed;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shield_moon_outlined, size: 72, color: kAccent),
              SizedBox(height: 16),
              Text('Attendance Gateway', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
              SizedBox(height: 24),
              SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3)),
            ],
          ),
        ),
      );
    }
    return _authed ? const HomeShell() : const StudentAuthPage();
  }
}