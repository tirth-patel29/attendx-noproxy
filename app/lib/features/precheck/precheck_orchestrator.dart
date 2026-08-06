// lib/features/precheck/precheck_orchestrator.dart
/// Pre-check Orchestrator
/// Runs all 4 gates in sequence with UI animations
/// Matches the SRS pre-check flow

import 'package:flutter/foundation.dart';
import 'package:attendance_gateway/features/gates/gate1_hardware_tattoo.dart';
import 'package:attendance_gateway/features/gates/gate2_biometric_lock.dart';
import 'package:attendance_gateway/features/gates/gate3_visual_twitch.dart';
import 'package:attendance_gateway/features/gates/gate4_crypto_timestamp.dart';
import 'package:attendance_gateway/core/services/api_service.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/device_info_service.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';

enum PrecheckPhase {
  idle,
  gate1,
  gate2,
  gate3,
  gate4,
  complete,
  failed,
}

class PrecheckOrchestrator extends ChangeNotifier {
  PrecheckPhase _currentPhase = PrecheckPhase.idle;
  String _studentUuid = '';
  String _sessionUuid = '';
  String _tokenVal = '';
  Map<String, dynamic> _gate1Result = {};
  Map<String, dynamic> _gate2Result = {};
  Map<String, dynamic> _gate3Result = {};
  Map<String, dynamic> _gate4Result = {};
  String? _errorMessage;
  int _progress = 0;

  PrecheckPhase get currentPhase => _currentPhase;
  String get studentUuid => _studentUuid;
  String get sessionUuid => _sessionUuid;
  String get tokenVal => _tokenVal;
  Map<String, dynamic> get gate1Result => _gate1Result;
  Map<String, dynamic> get gate2Result => _gate2Result;
  Map<String, dynamic> get gate3Result => _gate3Result;
  Map<String, dynamic> get gate4Result => _gate4Result;
  String? get errorMessage => _errorMessage;
  int get progress => _progress;
  bool get isComplete => _currentPhase == PrecheckPhase.complete;
  bool get hasFailed => _currentPhase == PrecheckPhase.failed;

  /// Start the pre-check sequence for a student and session
  Future<bool> runPrecheck({
    required String studentUuid,
    required String sessionUuid,
    required String tokenVal,
  }) async {
    _studentUuid = studentUuid;
    _sessionUuid = sessionUuid;
    _tokenVal = tokenVal;
    _errorMessage = null;
    _progress = 0;

    try {
      // Phase 1: Gate 1 - Hardware Tattoo
      _currentPhase = PrecheckPhase.gate1;
      _progress = 25;
      notifyListeners();
      await Future.delayed(AppConstants.precheckStepDelay);
      
      final gate1Result = await Gate1HardwareTattoo.checkGate1(studentUuid);
      _gate1Result = await Gate1HardwareTattoo.getGate1Info(studentUuid);
      
      if (gate1Result == Gate1Status.deviceMismatch) {
        _errorMessage = 'Device mismatch: This device is not registered to your account.';
        _currentPhase = PrecheckPhase.failed;
        notifyListeners();
        return false;
      }
      // If notProvisioned, we can still proceed (device will be bound on first claim)

      // Phase 2: Gate 2 - Biometric Flesh Lock
      _currentPhase = PrecheckPhase.gate2;
      _progress = 50;
      notifyListeners();
      await Future.delayed(AppConstants.precheckStepDelay);

      final biometricAuth = await Gate2BiometricLock.authenticate(
        reason: 'Verify your identity to mark attendance',
      );
      
      if (!biometricAuth) {
        _errorMessage = 'Biometric authentication failed. Please try again.';
        _currentPhase = PrecheckPhase.failed;
        notifyListeners();
        return false;
      }
      
      _gate2Result = await Gate2BiometricLock.getGate2Info();

      // Phase 3: Gate 3 - Visual Micro-Twitch
      _currentPhase = PrecheckPhase.gate3;
      _progress = 75;
      notifyListeners();
      await Future.delayed(AppConstants.precheckStepDelay);

      final token = await Gate3VisualTwitch.getCurrentToken(_sessionUuid);
      if (token == null || token.isEmpty) {
        _errorMessage = 'No active token. Please wait for the metronome to mint a new token.';
        _currentPhase = PrecheckPhase.failed;
        notifyListeners();
        return false;
      }
      
      _gate3Result = await Gate3VisualTwitch.getGate3Info(_sessionUuid);

      // Phase 4: Gate 4 - Cryptographic Time-Stamp
      _currentPhase = PrecheckPhase.gate4;
      _progress = 90;
      notifyListeners();
      await Future.delayed(AppConstants.precheckStepDelay);

      // Ensure time is synced
      if (!_timeSync.isTimeSyncFresh()) {
        final synced = await _timeSync.syncTime();
        if (!synced) {
          _errorMessage = 'Time synchronization failed. Please check network and try again.';
          _currentPhase = PrecheckPhase.failed;
          notifyListeners();
          return false;
        }
      }
      
      _gate4Result = await Gate4CryptoTimestamp.getGate4Info();

      // All gates passed!
      _currentPhase = PrecheckPhase.complete;
      _progress = 100;
      notifyListeners();
      
      await Future.delayed(AppConstants.precheckStepDelay);
      return true;
      
    } catch (e) {
      _errorMessage = 'Pre-check failed: $e';
      _currentPhase = PrecheckPhase.failed;
      notifyListeners();
      return false;
    }
  }

  /// Submit the attendance claim after all pre-checks pass
  Future<Map<String, dynamic>?> submitClaim() async {
    if (_currentPhase != PrecheckPhase.complete) {
      _errorMessage = 'Pre-check not complete';
      return null;
    }

    try {
      // Get current token
      final token = await Gate3VisualTwitch.getCurrentToken(_sessionUuid);
      if (token == null) {
        _errorMessage = 'No active token available';
        return null;
      }

      // Get required data
      final hmacKey = await SecureStorageService.getHmacKey();
      if (hmacKey == null) {
        _errorMessage = 'HMAC key not found';
        return null;
      }

      final deviceIdHash = await DeviceInfoService.getDeviceIdHash();
      final nonce = CryptoService.generateNonce();
      final clientClaimedTime = TimeSyncService().getEstimatedServerTimeMs();

      // Compute HMAC
      final hmacSignature = CryptoService.computeHmac(
        secretHmacKey: hmacKey!,
        sessionUuid: _sessionUuid,
        studentUuid: _studentUuid,
        tokenVal: _tokenVal,
        clientClaimedTime: TimeSyncService().getEstimatedServerTimeMs(),
        deviceIdHash: await DeviceInfoService.getDeviceIdHash(),
        nonce: CryptoService.generateNonce(),
      );

      // Submit claim
      final result = await ApiService.claimAttendance(
        sessionUuid: _sessionUuid,
        studentUuid: _studentUuid,
        tokenVal: token!,
        clientClaimedTime: TimeSyncService().getEstimatedServerTimeMs(),
        deviceIdHash: await DeviceInfoService.getDeviceIdHash(),
        nonce: CryptoService.generateNonce(),
        hmacSignature: hmacSignature,
      );

      return result;
    } catch (e) {
      _errorMessage = 'Claim submission failed: $e';
      return null;
    }
  }

  void reset() {
    _currentPhase = PrecheckPhase.idle;
    _studentUuid = '';
    _sessionUuid = '';
    _tokenVal = '';
    _gate1Result = {};
    _gate2Result = {};
    _gate3Result = {};
    _gate4Result = {};
    _errorMessage = null;
    _progress = 0;
    notifyListeners();
  }

  TimeSyncService get _timeSync => TimeSyncService();
}