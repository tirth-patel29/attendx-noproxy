// lib/features/gates/gate1_hardware_tattoo.dart
/// Gate 1: Hardware Tattoo
/// Device UUID locked in Secure Enclave (KeyStore/Keychain)
/// Prevents account sharing across devices

import 'package:attendance_gateway/core/constants/app_constants.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/device_info_service.dart';
import 'package:attendance_gateway/core/services/crypto_service.dart';
import 'package:attendance_gateway/core/services/api_service.dart';

enum Gate1Status {
  notProvisioned,
  deviceMatches,
  deviceMismatch,
  notBound,
}

class Gate1HardwareTattoo {
  /// Check if the current device matches the bound device for a student
  /// 
  /// Returns Gate1Status:
  /// - notProvisioned: Student has no bound device yet
  /// - deviceMatches: Current device matches the bound device
  /// - deviceMismatch: Current device is different from bound device
  /// - notBound: Student has no bound device (can bind)
  static Future<Gate1Status> checkGate1(String studentUuid) async {
    // Get bound device ID from server
    final boundDeviceId = await SecureStorageService.getBoundDeviceId();
    
    if (boundDeviceId == null) {
      // Student has no bound device - can provision this device
      return Gate1Status.notProvisioned;
    }

    // Get current device hash
    final currentDeviceHash = await DeviceInfoService.getDeviceIdHash();

    if (boundDeviceId == currentDeviceHash) {
      return Gate1Status.deviceMatches;
    } else {
      return Gate1Status.deviceMismatch;
    }
  }

  /// Provision this device for a student (bind device ID)
  /// Called during initial setup or device reset
  static Future<bool> provisionDevice(String studentUuid) async {
    try {
      final deviceIdHash = await DeviceInfoService.getDeviceIdHash();
      
      // Register device with server
      final result = await ApiService.registerDevice(
        studentUuid: studentUuid,
        deviceIdHash: deviceIdHash,
      );

      if (result['registered'] == true) {
        // Store locally
        await SecureStorageService.saveBoundDeviceId(result['bound_device_id']);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Get display info for Gate 1 UI
  static Future<Map<String, dynamic>> getGate1Info(String studentUuid) async {
    final status = await checkGate1(studentUuid);
    final deviceName = await DeviceInfoService.getDeviceDisplayName();
    final deviceIdHash = await DeviceInfoService.getDeviceIdHash();
    final boundDeviceId = await SecureStorageService.getBoundDeviceId();

    String title, message, icon;
    bool isPassed = false;

    switch (status) {
      case Gate1Status.deviceMatches:
        title = AppConstants.gate1Title;
        message = 'This device is registered to your account';
        icon = '✅';
        isPassed = true;
        break;
      case Gate1Status.deviceMismatch:
        title = AppConstants.gate1Title;
        message = 'This device is not registered. Please contact admin for device reset.';
        icon = '❌';
        isPassed = false;
        break;
      case Gate1Status.notProvisioned:
        title = AppConstants.gate1Title;
        message = 'No device registered. This device will be registered on first claim.';
        icon = 'ℹ️';
        isPassed = false;
        break;
      case Gate1Status.notBound:
        title = AppConstants.gate1Title;
        message = 'Device binding required';
        icon = '🔗';
        isPassed = false;
        break;
    }

    return {
      'title': title,
      'description': AppConstants.gate1Description,
      'message': message,
      'icon': icon,
      'isPassed': isPassed,
      'deviceName': deviceName,
      'deviceIdHash': deviceIdHash,
      'boundDeviceId': boundDeviceId,
      'status': status.name,
    };
  }

  /// Reset device binding (admin function)
  static Future<void> resetDeviceBinding() async {
    await SecureStorageService.saveBoundDeviceId('');
  }
}