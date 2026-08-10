// lib/features/claim/claim_page.dart
/// Main claim attendance page - ties together all 4 gates
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/device_info_service.dart';
import 'package:attendance_gateway/core/services/crypto_service.dart';
import 'package:attendance_gateway/features/precheck/precheck_orchestrator.dart';
import 'package:attendance_gateway/features/scan/attendance_scanner_page.dart';
import 'package:attendance_gateway/features/gates/gate1_hardware_tattoo.dart';
import 'package:attendance_gateway/features/gates/gate2_biometric_lock.dart';
import 'package:attendance_gateway/features/gates/gate3_visual_twitch.dart';
import 'package:attendance_gateway/features/gates/gate4_crypto_timestamp.dart';
import 'package:attendance_gateway/shared/utils/extensions.dart';

class ClaimPage extends ConsumerStatefulWidget {
  const ClaimPage({super.key});

  @override
  ConsumerState<ClaimPage> createState() => _ClaimPageState();
}

class _ClaimPageState extends ConsumerState<ClaimPage> {
  final _rollNoController = TextEditingController();
  final _secretController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String? _studentUuid;
  String? _sessionUuid;
  String? _tokenVal;
  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic>? _claimResult;

  @override
  void initState() {
    super.initState();
    _loadStudentInfo();
  }

  Future<void> _loadStudentInfo() async {
    // Check if already provisioned
    final provisioned = await SecureStorageService.isProvisioned();
    if (provisioned) {
      final studentUuid = await SecureStorageService.getStudentUuid();
      final rollNo = await SecureStorageService.getStudentRollNo();
      if (studentUuid != null) {
        setState(() {
          _studentUuid = studentUuid;
          _rollNoController.text = rollNo ?? '';
        });
      }
    }
  }

  Future<void> _provisionStudent() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      // SRS §1 Phase 1 "The Blood Oath": submit roll_no + the admin-issued HMAC
      // secret. The server validates the pair and binds this device (Gate 1).
      final deviceIdHash = await DeviceInfoService.getDeviceIdHash();
      final result = await ApiService.provision(
        rollNo: _rollNoController.text.trim().toUpperCase(),
        secretHmacKey: _secretController.text.trim(),
        deviceIdHash: deviceIdHash,
      );

      await SecureStorageService.saveStudentUuid(result['student_uuid'] as String);
      await SecureStorageService.saveStudentRollNo(result['roll_no'] as String);
      await SecureStorageService.saveHmacKey(_secretController.text.trim());
      await SecureStorageService.saveDeviceId(deviceIdHash);
      await SecureStorageService.saveBoundDeviceId(deviceIdHash);

      setState(() {
        _studentUuid = result['student_uuid'] as String;
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Device provisioned & hardware-bound!')),
        );
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Provisioning failed: $e')),
        );
      }
    }
  }

  Future<void> _claimAttendance() async {
    if (_studentUuid == null) {
      setState(() => _errorMessage = 'Please provision first');
      return;
    }

    // Gate 3: Photonic Intercept — scan the projector's ATTN QR.
    final payload = await Navigator.of(context).push<AttendancePayload>(
      MaterialPageRoute(builder: (_) => const AttendanceScannerPage()),
    );
    if (payload == null || !mounted) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _claimResult = null;
      _sessionUuid = payload.sessionUuid;
      _tokenVal = payload.token;
    });

    try {
      // Run the SRS pre-check pipeline (Gates 1→4) with the intercepted token.
      final precheck = PrecheckOrchestrator();
      final precheckPassed = await precheck.runPrecheck(
        studentUuid: _studentUuid!,
        sessionUuid: payload.sessionUuid,
        tokenVal: payload.token,
      );

      if (!precheckPassed) {
        setState(() {
          _isLoading = false;
          _errorMessage = precheck.errorMessage ?? 'Pre-check failed';
        });
        return;
      }

      // Submit claim (server nonce + HMAC wax seal + 250ms judgment)
      final result = await precheck.submitClaim();

      setState(() {
        _isLoading = false;
        _claimResult = result;
        _errorMessage = null;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Claim failed: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance Gateway'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => _showSettingsDialog(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Zero-Trust Attendance',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Cryptographic proof of physical presence',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Provisioning is handled by StudentAuthPage — if this device has
            // no identity stored, route the student back to sign in.
            if (_studentUuid == null) ...[
              _buildReauth(),
            ] else ...[
              _buildClaimSection(),
            ],
            
            const SizedBox(height: 16),
            
            // Error/Result display
            if (_errorMessage != null) ...[
              Card(
                color: Colors.red[50],
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            
            if (_claimResult != null) ...[
              _buildResultCard(),
            ],
            
            const SizedBox(height: 16),
            
            // 4 Gates status display
            _buildGatesStatus(),
          ],
        ),
      ),
    );
  }

  Widget _buildReauth() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Not signed in', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text(
              'Sign in with your college ID to bind this device and mark attendance.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const StudentAuthPage()),
                ),
                icon: const Icon(Icons.login),
                label: const Text('Sign in / register'),
              ),
            ),
          ],
        ),
      ),
    );
  }
              Widget _buildClaimSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.verified_user, color: Colors.green),
                const SizedBox(width: 8),
                Text(
                  'Provisioned as ${_rollNoController.text}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isLoading ? null : _claimAttendance,
                icon: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.qr_code_scanner),
                label: Text(_isLoading ? 'Scanning & Verifying...' : 'Mark Attendance'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard() {
    if (_claimResult == null) return const SizedBox.shrink();
    
    final success = _claimResult!['status'] == 'PRESENT';
    
    return Card(
      color: success ? Colors.green[50] : Colors.red[50],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  success ? Icons.check_circle : Icons.cancel,
                  color: success ? Colors.green : Colors.red,
                  size: 32,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    success ? 'Attendance Verified!' : 'Attendance Failed',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: success ? Colors.green : Colors.red,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_claimResult!['verification_delta_ms'] != null)
              Text(
                'Verification Delta: ${_claimResult!['verification_delta_ms']}ms',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            if (_claimResult!['ledger_uuid'] != null)
              Text(
                'Record: ${_claimResult!['ledger_uuid'].toString().shortUuid}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildGatesStatus() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Security Gates Status',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            _buildGateStatusTile(
              title: AppConstants.gate1Title,
              description: AppConstants.gate1Description,
              icon: '🔐',
              status: _studentUuid != null ? 'Ready' : 'Not Provisioned',
              color: _studentUuid != null ? Colors.green : Colors.orange,
            ),
            _buildGateStatusTile(
              title: AppConstants.gate2Title,
              description: AppConstants.gate2Description,
              icon: '👆',
              status: 'Requires Biometric',
              color: Colors.blue,
            ),
            _buildGateStatusTile(
              title: AppConstants.gate3Title,
              description: AppConstants.gate3Description,
              icon: '📱',
              status: 'Waiting for Token',
              color: Colors.purple,
            ),
            _buildGateStatusTile(
              title: AppConstants.gate4Title,
              description: AppConstants.gate4Description,
              icon: '🔏',
              status: 'Requires Time Sync',
              color: Colors.orange,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGateStatusTile({
    required String title,
    required String description,
    required String icon,
    required String status,
    required Color color,
  }) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: color.withOpacity(0.1),
        child: Text(icon, style: const TextStyle(fontSize: 20)),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(description, style: const TextStyle(fontSize: 12)),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          status,
          style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12),
        ),
      ),
      dense: true,
    );
  }

  void _showSettingsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Settings'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('Reset Device Provisioning'),
              subtitle: const Text('Unbind this device from your account'),
              onTap: () async {
                Navigator.pop(context);
                await SecureStorageService.clearAll();
                setState(() => _studentUuid = null);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Device provisioning reset')),
                  );
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.sync),
              title: const Text('Force Time Sync'),
              onTap: () async {
                Navigator.pop(context);
                await TimeSyncService().syncTime();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Time sync initiated')),
                  );
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _rollNoController.dispose();
    super.dispose();
  }
}