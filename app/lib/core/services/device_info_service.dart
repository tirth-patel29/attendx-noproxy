// lib/core/services/device_info_service.dart
// Device info service for getting hardware UUID (Gate 1)
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import 'dart:convert';
import 'package:crypto/crypto.dart';

class DeviceInfoService {
  static final _uuid = Uuid();

  /// Get the hardware UUID for this device
  /// On Android: Android ID (Settings.Secure.ANDROID_ID)
  /// On iOS: identifierForVendor
  static Future<String> getHardwareUuid() async {
    final deviceInfo = DeviceInfoPlugin();
    
    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await deviceInfo.androidInfo;
        return androidInfo.id; // Android ID
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return iosInfo.identifierForVendor ?? _uuid.v4();
      }
    } catch (e) {
      // Fallback to random UUID if device info fails
      return _uuid.v4();
    }
    
    return _uuid.v4();
  }

  /// Get SHA-256 hash of hardware UUID for storage/transmission
  static Future<String> getDeviceIdHash() async {
    final hardwareUuid = await getHardwareUuid();
    final bytes = utf8.encode(hardwareUuid);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// Get a display name for the device
  static Future<String> getDeviceDisplayName() async {
    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await deviceInfo.androidInfo;
        return '${androidInfo.brand} ${androidInfo.model}';
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return '${iosInfo.name} (${iosInfo.model})';
      }
    } catch (e) {
      return 'Unknown Device';
    }
    return 'Unknown Device';
  }
}