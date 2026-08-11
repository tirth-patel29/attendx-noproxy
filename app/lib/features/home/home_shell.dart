// lib/features/home/home_shell.dart
// Root shell: modern 3-tab layout (Home / History / Security Vault).
import 'package:flutter/material.dart';
import 'package:attendance_gateway/features/home/dashboard_tab.dart';
import 'package:attendance_gateway/features/history/history_tab.dart';
import 'package:attendance_gateway/features/vault/vault_tab.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  final List<Widget> _tabs = const [
    DashboardTab(),
    HistoryTab(),
    VaultTab(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.space_dashboard_outlined), selectedIcon: Icon(Icons.space_dashboard), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.query_stats_outlined), selectedIcon: Icon(Icons.query_stats), label: 'History'),
          NavigationDestination(icon: Icon(Icons.shield_outlined), selectedIcon: Icon(Icons.shield), label: 'Security'),
        ],
      ),
    );
  }
}