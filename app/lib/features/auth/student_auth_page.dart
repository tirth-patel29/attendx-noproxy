// lib/features/auth/student_auth_page.dart
// Student self-registration & login (SRS §1 Phase 1 + charusat identity).
// 
// Flow:
// 1. Enter college ID (e.g. 24BCS001) — server resolves {id}@charusat.edu.in
// 2. Branch by status:
// !exists      -> Register (name + password twice)
// exists & no pw -> Set password (twice) — also used after an admin
// "forgot password" tap
// exists & pw  -> Login (password)
// 3. First successful auth binds THIS device: the server mints the HMAC
// permanent signer, stores it in the DB and returns it into the KeyStore.
// 4. Continue to the attendance ClaimPage.
// 
// The HMAC secret is NEVER generated on the phone — it is minted server-side
// during bind so the DB and the device stay in sync.

import 'package:flutter/material.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/device_info_service.dart';
import 'package:attendance_gateway/features/claim/claim_page.dart';

class StudentAuthPage extends StatefulWidget {
  const StudentAuthPage({super.key});

  @override
  State<StudentAuthPage> createState() => _StudentAuthPageState();
}

enum _Step { id, register, setPassword, login, binding }

class _StudentAuthPageState extends State<StudentAuthPage> {
  final _idController = TextEditingController();
  final _nameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  _Step _step = _Step.id;
  bool _exists = true;
  bool _busy = false;
  String? _error;

  String get _id => _idController.text.trim().toUpperCase();

  Future<void> _checkId() async {
    if (!_idRegExp.hasMatch(_id)) {
      setState(() => _error = 'Enter a valid college ID (e.g. 24BCS001)');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final status = await ApiService.studentStatus(_id);
      setState(() {
        _exists = status['exists'] == true;
        _step = !_exists ? _Step.register : (status['has_password'] == true ? _Step.login : _Step.setPassword);
      });
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _register() async {
    if (_passwordController.text.length < 8 || _passwordController.text != _confirmController.text) {
      setState(() => _error = 'Password must be 8+ characters and match');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final r = await ApiService.studentRegister(id: _id, name: _nameController.text.trim(), password: _passwordController.text);
      final token = r['access_token'] as String;
      await _bindAndGo(token, r['student_uuid'] as String, r['roll_no'] as String);
    } catch (e) {
      setState(() => _error = '$e');
      setState(() => _busy = false);
    }
  }

  Future<void> _setPassword() async {
    if (_passwordController.text.length < 8 || _passwordController.text != _confirmController.text) {
      setState(() => _error = 'Password must be 8+ characters and match');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      await ApiService.studentSetPassword(id: _id, newPassword: _passwordController.text);
      _passwordController.clear();
      _confirmController.clear();
      setState(() => _step = _Step.login);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _login() async {
    setState(() { _busy = true; _error = null; });
    try {
      final r = await ApiService.studentLogin(id: _id, password: _passwordController.text);
      final token = r['access_token'] as String;
      await _bindAndGo(token, r['student_uuid'] as String, r['roll_no'] as String);
    } catch (e) {
      setState(() => _error = '$e');
      setState(() => _busy = false);
    }
  }

  /// Wrap up auth: ensure this device is bound and the HMAC signer is in the
  /// KeyStore, then open the ClaimPage.
  Future<void> _bindAndGo(String token, String studentUuid, String rollNo) async {
    setState(() => _step = _Step.binding);
    final deviceIdHash = await DeviceInfoService.getDeviceIdHash();
    final bound = await ApiService.studentBindDevice(accessToken: token, deviceIdHash: deviceIdHash);

    await SecureStorageService.saveStudentUuid(studentUuid);
    await SecureStorageService.saveStudentRollNo(rollNo);
    await SecureStorageService.saveHmacKey(bound['secret_hmac_key'] as String);
    await SecureStorageService.saveDeviceId(deviceIdHash);
    await SecureStorageService.saveBoundDeviceId(deviceIdHash);
    await SecureStorageService.saveAccessToken(token);

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const ClaimPage()),
    );
  }

  static final RegExp _idRegExp = RegExp(r'^[0-9]{2}[A-Z]{3}[0-9]{3}$');

  @override
  void dispose() {
    _idController.dispose(); _nameController.dispose();
    _passwordController.dispose(); _confirmController.dispose();
    super.dispose();
  }

  Widget _field(TextEditingController c, String label, {String? hint, bool obscure = false, TextInputType? kb}) {
    return TextField(
      controller: c,
      obscureText: obscure,
      keyboardType: kb,
      decoration: InputDecoration(labelText: label, hintText: hint, border: const OutlineInputBorder()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (_step) {
      _Step.id => 'Attendance Gateway',
      _Step.register => 'Create your account',
      _Step.setPassword => 'Set your password',
      _Step.login => 'Welcome back',
      _Step.binding => 'Securing this device…',
    };

    return Scaffold(
      appBar: AppBar(title: const Text('Attendance Gateway')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text(
              'Sign in with your college ID — ${AppConstants.studentEmailDomain}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
            ),
            const SizedBox(height: 20),

            if (_step == _Step.id || _step == _Step.register || _step == _Step.setPassword || _step == _Step.login) ...[
              _field(_idController, 'College ID', hint: '24BCS001', kb: TextInputType.text, obscure: false),
              const SizedBox(height: 14),
            ],

            if (_step == _Step.register) ...[
              _field(_nameController, 'Full name', hint: 'e.g. Ananya Shah'),
              const SizedBox(height: 14),
            ],

            if (_step == _Step.register || _step == _Step.login || _step == _Step.setPassword) ...[
              _field(_passwordController,
                _step == _Step.setPassword ? 'New password' : 'Password',
                obscure: true),
              const SizedBox(height: 14),
            ],

            if (_step == _Step.register || _step == _Step.setPassword) ...[
              _field(_confirmController, 'Confirm password', obscure: true),
              const SizedBox(height: 14),
            ],

            if (_error != null) ...[
              Card(
                color: Colors.red.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_error!, style: const TextStyle(color: Colors.red)),
                ),
              ),
              const SizedBox(height: 14),
            ],

            if (_step == _Step.binding) ...[
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text('Minting your device HMAC signer…', textAlign: TextAlign.center),
                  ]),
                ),
              ),
            ] else ...[
              FilledButton.icon(
                onPressed: _busy ? null : switch (_step) {
                  _Step.id => () => _checkId(),
                  _Step.register => () => _register(),
                  _Step.setPassword => () => _setPassword(),
                  _Step.login => () => _login(),
                  _Step.binding => null,
                },
                icon: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : Icon(switch (_step) {
                        _Step.id => Icons.arrow_forward,
                        _Step.register => Icons.person_add,
                        _Step.setPassword => Icons.password,
                        _Step.login => Icons.login,
                        _Step.binding => Icons.verified_user,
                      }),
                label: Text(switch (_step) {
                  _Step.id => 'Continue',
                  _Step.register => 'Create account',
                  _Step.setPassword => 'Set password',
                  _Step.login => 'Sign in',
                  _Step.binding => '…',
                }),
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
              ),
              const SizedBox(height: 10),
              if (_step != _Step.id)
                TextButton(
                  onPressed: () {
                    setState(() {
                      _step = _Step.id;
                      _error = null;
                      _passwordController.clear();
                      _confirmController.clear();
                      _nameController.clear();
                    });
                  },
                  child: const Text('← Use a different ID'),
                ),
            ],
          ],
        ),
      ),
    );
  }
}