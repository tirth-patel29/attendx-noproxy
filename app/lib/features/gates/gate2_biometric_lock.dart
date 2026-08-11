// lib/features/gates/gate2_biometric_lock.dart
/// Gate 2: Biometric Flesh Lock
/// OS-level thumbprint/FaceID before camera opens
/// Prevents proxy devices (someone else using your phone)

import 'package:local_auth/local_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';

enum Gate2Status {
  notAvailable,
  notEnrolled,
  locked,
  unlocked,
  failed,
}

class Gate2BiometricLock {
  static final LocalAuthentication _auth = LocalAuthentication();

  /// Check if biometric authentication is available on this device
  static Future<bool> isBiometricAvailable() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      return canCheck && isDeviceSupported;
    } catch (e) {
      return false;
    }
  }

  /// Get available biometric types
  static Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (e) {
      return [];
    }
  }

  /// Authenticate with biometrics (Gate 2)
  /// Returns true if authentication succeeded
  static Future<bool> authenticate({
    String reason = 'Verify your identity to mark attendance',
    bool useErrorDialogs = true,
    bool stickyAuth = true,
  }) async {
    try {
      final available = await isBiometricAvailable();
      if (!available) {
        return false;
      }

      final authenticated = await _auth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          biometricOnly: true,
          useErrorDialogs: useErrorDialogs,
          stickyAuth: stickyAuth,
        ),
      );
      return authenticated;
    } catch (e) {
      return false;
    }
  }

  /// Check Gate 2 status
  static Future<Gate2Status> checkGate2() async {
    final available = await isBiometricAvailable();
    if (!available) return Gate2Status.notAvailable;

    final biometrics = await getAvailableBiometrics();
    if (biometrics.isEmpty) return Gate2Status.notEnrolled;

    return Gate2Status.locked;
  }

  /// Get display info for Gate 2 UI
  static Future<Map<String, dynamic>> getGate2Info() async {
    final status = await checkGate2();
    final biometrics = await getAvailableBiometrics();

    String title = AppConstants.gate2Title;
    String message;
    String icon;
    bool isPassed = false;

    switch (status) {
      case Gate2Status.unlocked:
        message = 'Biometric verified';
        icon = '✅';
        isPassed = true;
        break;
      case Gate2Status.locked:
        message = 'Tap to verify with ${_biometricLabel()}';
        icon = '🔒';
        isPassed = false;
        break;
      case Gate2Status.notEnrolled:
        message = 'No biometric enrolled. Set up FaceID/TouchID in device settings.';
        icon = '⚠️';
        isPassed = false;
        break;
      case Gate2Status.notAvailable:
        message = 'Biometric authentication not available on this device.';
        icon = '⚠️';
        isPassed = false;
        break;
      case Gate2Status.failed:
        message = 'Authentication failed. Please try again.';
        icon = '❌';
        isPassed = false;
        break;
    }

    return {
      'title': title,
      'description': AppConstants.gate2Description,
      'message': message,
      'icon': icon,
      'isPassed': isPassed,
      'availableBiometrics': biometrics.map((b) => b.name).toList(),
      'status': status.name,
    };
  }

  static String _biometricLabel() {
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return 'Face ID';
      case TargetPlatform.android:
        return 'Fingerprint';
      default:
        return 'biometric';
    }
  }
}