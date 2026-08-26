import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/services/storage_service.dart';
import 'features/auth/auth_page.dart';
import 'features/home/home_shell.dart';
import 'shared/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: kSurface,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  runApp(const AttendanceGatewayApp());
}

class AttendanceGatewayApp extends StatelessWidget {
  const AttendanceGatewayApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Attendance',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      themeMode: ThemeMode.dark,
      home: const BootPage(),
    );
  }
}

class BootPage extends StatefulWidget {
  const BootPage({super.key});
  @override State<BootPage> createState() => _BootPageState();
}

class _BootPageState extends State<BootPage> {
  @override
  void initState() { super.initState(); _check(); }

  Future<void> _check() async {
    await Future.delayed(const Duration(milliseconds: 400));
    final ok = await StorageService.isLoggedIn();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => ok ? const HomeShell() : const AuthPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 88, height: 88,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(colors: [kPrimary, kPrimaryVar]),
              boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.4), blurRadius: 30)],
            ),
            child: const Icon(Icons.shield_rounded, size: 48, color: Colors.white),
          ),
          const SizedBox(height: 20),
          const Text('Attendance Gateway',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: kText)),
          const SizedBox(height: 6),
          const Text('Zero-Trust  Cryptographic',
              style: TextStyle(fontSize: 12, color: kTextMuted, letterSpacing: 0.5)),
          const SizedBox(height: 42),
          const SizedBox(width: 28, height: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: kPrimary)),
        ]),
      ),
    );
  }
}