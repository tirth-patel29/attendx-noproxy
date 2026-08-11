// lib/features/home/home_shell.dart
// Root shell: two-tab light-mode layout (Home / History). Account & Security
// is a pushed route reached from the Home header, not a tab.
import 'package:flutter/material.dart';
import 'package:attendance_gateway/features/home/dashboard_tab.dart';
import 'package:attendance_gateway/features/history/history_tab.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  final List<Widget> _tabs = const [DashboardTab(), HistoryTab()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.bar_chart_outlined), selectedIcon: Icon(Icons.bar_chart), label: 'History'),
        ],
      ),
    );
  }
}
