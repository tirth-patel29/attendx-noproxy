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
      // For demo purposes, we'll create a mock student UUID
      // In reality, this would call a provisioning endpoint
      final studentUuid = CryptoService.generateToken(length: 36); // Not real UUID
      
      await SecureStorageService.saveStudentUuid(studentUuid);
      await SecureStorageService.saveStudentRollNo(_rollNoController.text);
      
      // Generate and save HMAC key
      final hmacKey = CryptoService.generateHmacKey();
      await SecureStorageService.saveHmacKey(hmacKey);
      
      // Get and save device ID
      final deviceIdHash = await DeviceInfoService.getDeviceIdHash();
      await SecureStorageService.saveDeviceId(deviceIdHash);
      
      setState(() {
        _studentUuid = studentUuid;
        _isLoading = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Provisioned successfully!')),
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

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _claimResult = null;
    });

    try {
      // Get session UUID (in real app, this would be selected from a list)
      // For demo, we'll fetch the active session
      final sessions = await ApiService.getSessionTokens('');
      
      // For demo, we'll use a mock session
      // In real app, this would come from a session list
      final sessionUuid = 'demo-session-uuid'; // Would be real UUID
      
      // Run pre-check
      final precheck = PrecheckOrchestrator();
      final precheckPassed = await precheck.runPrecheck(
        studentUuid: _studentUuid!,
        sessionUuid: sessionUuid,
        tokenVal: '', // Will be fetched during precheck
      );

      if (!precheckPassed) {
        setState(() {
          _isLoading = false;
          _errorMessage = precheck.errorMessage ?? 'Pre-check failed';
        });
        return;
      }

      // Submit claim
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
            
            // Provisioning or Claim section
            if (_studentUuid == null) ...[
              _buildProvisioningForm(),
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

  Widget _buildProvisioningForm() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Device Provisioning',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                'Enter your roll number to provision this device for the first time.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _rollNoController,
                decoration: const InputDecoration(
                  labelText: 'Roll Number',
                  hintText: 'e.g., 24BCS001',
                  prefixIcon: Icon(Icons.badge),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your roll number';
                  }
                  if (!RegExp(r'^[0-9]{2}[A-Z]{3}[0-9]{3}$').hasMatch(value)) {
                    return 'Invalid roll number format (e.g., 24BCS001)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : _provisionStudent,
                  icon: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.verified_user),
                  label: Text(_isLoading ? 'Provisioning...' : 'Provision Device'),
                ),
              ),
            ],
          ),
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