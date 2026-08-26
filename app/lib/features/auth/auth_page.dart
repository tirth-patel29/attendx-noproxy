import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/app_constants.dart';
import '../../core/services/api_service.dart';
import '../../core/services/storage_service.dart';
import '../../core/services/device_service.dart';
import '../../shared/theme/app_theme.dart';
import '../home/home_shell.dart';

enum _Step { id, register, setPassword, login, binding }

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});
  @override State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _idCtrl   = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _pwCtrl   = TextEditingController();
  final _cPwCtrl  = TextEditingController();

  _Step _step = _Step.id;
  bool  _busy = false;
  bool  _obscure = true;
  String? _error;

  static final _idRx = RegExp(r'^[0-9]{2}[A-Z]{3}[0-9]{3}$');
  String get _id => _idCtrl.text.trim().toUpperCase();

  void _setErr(String? e) => setState(() { _error = e; _busy = false; });

  Future<void> _checkId() async {
    if (!_idRx.hasMatch(_id)) {
      _setErr('Enter a valid college ID (e.g. 24BCS001)'); return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final s   = await ApiService.studentStatus(_id);
      final ex  = s['exists'] == true;
      final hpw = s['has_password'] == true;
      setState(() {
        _busy = false;
        _step = !ex ? _Step.register : (hpw ? _Step.login : _Step.setPassword);
      });
    } catch (e) { _setErr(e.toString()); }
  }

  Future<void> _register() async {
    if (_nameCtrl.text.trim().isEmpty) { _setErr('Name is required'); return; }
    if (_pwCtrl.text.length < 8)       { _setErr('Password must be 8+ characters'); return; }
    if (_pwCtrl.text != _cPwCtrl.text) { _setErr('Passwords do not match'); return; }
    setState(() { _busy = true; _error = null; });
    try {
      final r = await ApiService.studentRegister(
          id: _id, name: _nameCtrl.text.trim(), password: _pwCtrl.text);
      await _finish(r);
    } catch (e) { _setErr(e.toString()); }
  }

  Future<void> _setPassword() async {
    if (_pwCtrl.text.length < 8)       { _setErr('Password must be 8+ characters'); return; }
    if (_pwCtrl.text != _cPwCtrl.text) { _setErr('Passwords do not match'); return; }
    setState(() { _busy = true; _error = null; });
    try {
      await ApiService.studentSetPassword(id: _id, newPassword: _pwCtrl.text);
      _pwCtrl.clear(); _cPwCtrl.clear();
      setState(() { _busy = false; _step = _Step.login; });
    } catch (e) { _setErr(e.toString()); }
  }

  Future<void> _login() async {
    if (_pwCtrl.text.isEmpty) { _setErr('Enter your password'); return; }
    setState(() { _busy = true; _error = null; });
    try {
      final r = await ApiService.studentLogin(id: _id, password: _pwCtrl.text);
      await _finish(r);
    } catch (e) { _setErr(e.toString()); }
  }

  Future<void> _finish(Map<String, dynamic> r) async {
    setState(() { _step = _Step.binding; _busy = true; _error = null; });
    try {
      final token  = r['access_token'] as String;
      final uuid   = r['student_uuid'] as String;
      final roll   = (r['roll_no'] as String?) ?? _id;
      final name   = (r['name'] as String?) ?? '';
      final dHash  = await DeviceService.getDeviceIdHash();
      final bound  = await ApiService.bindDevice(token: token, deviceIdHash: dHash);
      final hmac   = (bound['secret_hmac_key'] ?? bound['hmac_key'] ?? '').toString();
      await StorageService.saveToken(token);
      await StorageService.saveStudentUuid(uuid);
      await StorageService.saveRollNo(roll);
      await StorageService.saveName(name);
      await StorageService.saveDeviceId(dHash);
      if (hmac.isNotEmpty) await StorageService.saveHmac(hmac);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeShell()));
    } catch (e) { _setErr(e.toString()); }
  }

  @override
  void dispose() {
    _idCtrl.dispose(); _nameCtrl.dispose();
    _pwCtrl.dispose(); _cPwCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Center(
                child: Container(
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(colors: [kPrimary, kPrimaryVar]),
                    boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.4), blurRadius: 24, offset: const Offset(0, 8))],
                  ),
                  child: const Icon(Icons.shield_rounded, color: Colors.white, size: 40),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                _step == _Step.id          ? 'Sign In'         :
                _step == _Step.register    ? 'Create Account'  :
                _step == _Step.setPassword ? 'Set Password'    :
                _step == _Step.login       ? 'Welcome Back'    :
                                             'Securing Deviceâ€¦',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'Attendance Gateway Â· ${AppConstants.emailDomain}',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 32),

              if (_step == _Step.binding) ...[
                const Center(child: CircularProgressIndicator(color: kPrimary)),
                const SizedBox(height: 16),
                const Text('Binding this device to your accountâ€¦',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: kTextMuted, fontSize: 13)),
              ] else ...[

                // College ID
                TextField(
                  controller: _idCtrl,
                  enabled: _step == _Step.id,
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
                    LengthLimitingTextInputFormatter(8),
                  ],
                  decoration: InputDecoration(
                    hintText: 'College ID â€” e.g. 24BCS001',
                    prefixIcon: const Icon(Icons.badge_outlined, color: kTextMuted),
                    suffixIcon: _step != _Step.id
                        ? IconButton(
                            icon: const Icon(Icons.close, color: kTextMuted, size: 18),
                            onPressed: () => setState(() {
                              _step = _Step.id; _error = null;
                              _pwCtrl.clear(); _cPwCtrl.clear(); _nameCtrl.clear();
                            }))
                        : null,
                  ),
                  onChanged: (v) {
                    final up = v.toUpperCase();
                    if (up != v) {
                      _idCtrl.value = _idCtrl.value.copyWith(
                          text: up, selection: TextSelection.collapsed(offset: up.length));
                    }
                  },
                  onSubmitted: _step == _Step.id ? (_) => _checkId() : null,
                ),

                if (_step == _Step.register) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      hintText: 'Full Name',
                      prefixIcon: Icon(Icons.person_outline, color: kTextMuted),
                    ),
                  ),
                ],

                if (_step != _Step.id) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _pwCtrl,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      hintText: _step == _Step.setPassword ? 'New Password' : 'Password',
                      prefixIcon: const Icon(Icons.lock_outline, color: kTextMuted),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                            color: kTextMuted, size: 20),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    onSubmitted: _step == _Step.login ? (_) => _login() : null,
                  ),
                ],

                if (_step == _Step.register || _step == _Step.setPassword) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _cPwCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      hintText: 'Confirm Password',
                      prefixIcon: Icon(Icons.lock_outline, color: kTextMuted),
                    ),
                  ),
                ],

                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: kDanger.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(children: [
                      const Icon(Icons.error_outline, color: kDanger, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_error!, style: const TextStyle(color: kDanger, fontSize: 13))),
                    ]),
                  ),
                ],

                const SizedBox(height: 22),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _busy ? null : switch (_step) {
                      _Step.id          => _checkId,
                      _Step.register    => _register,
                      _Step.setPassword => _setPassword,
                      _Step.login       => _login,
                      _Step.binding     => null,
                    },
                    child: _busy
                        ? const SizedBox(height: 20, width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(switch (_step) {
                            _Step.id          => 'Continue â†’',
                            _Step.register    => 'Create Account',
                            _Step.setPassword => 'Set Password',
                            _Step.login       => 'Sign In',
                            _Step.binding     => 'â€¦',
                          }),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}