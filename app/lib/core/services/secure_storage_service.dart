// lib/core/services/secure_storage_service.dart
// Secure storage service using flutter_secure_storage
// Handles: HMAC key, device ID, drift offset, student credentials
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';

class SecureStorageService {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  // HMAC Key (32 bytes = 64 hex chars)
  static Future<void> saveHmacKey(String hmacKey) async {
    await _storage.write(key: AppConstants.storageHmacKey, value: hmacKey);
  }

  static Future<String?> getHmacKey() async {
    return await _storage.read(key: AppConstants.storageHmacKey);
  }

  // Device ID (SHA-256 of hardware UUID)
  static Future<void> saveDeviceId(String deviceId) async {
    await _storage.write(key: AppConstants.storageDeviceId, value: deviceId);
  }

  static Future<String?> getDeviceId() async {
    return await _storage.read(key: AppConstants.storageDeviceId);
  }

  // Drift offset (milliseconds from Cristian's Algorithm)
  static Future<void> saveDriftOffset(int driftOffsetMs) async {
    await _storage.write(key: AppConstants.storageDriftOffset, value: driftOffsetMs.toString());
  }

  static Future<int> getDriftOffset() async {
    final value = await _storage.read(key: AppConstants.storageDriftOffset);
    return value != null ? int.parse(value) : 0;
  }

  // Bound device ID (Gate 1 - SHA-256 of hardware UUID)
  static Future<void> saveBoundDeviceId(String boundDeviceId) async {
    await _storage.write(key: AppConstants.storageBoundDeviceId, value: boundDeviceId);
  }

  static Future<String?> getBoundDeviceId() async {
    return await _storage.read(key: AppConstants.storageBoundDeviceId);
  }

  // Student UUID
  static Future<void> saveStudentUuid(String studentUuid) async {
    await _storage.write(key: AppConstants.storageStudentUuid, value: studentUuid);
  }

  static Future<String?> getStudentUuid() async {
    return await _storage.read(key: AppConstants.storageStudentUuid);
  }

  // Student Roll Number
  static Future<void> saveStudentRollNo(String rollNo) async {
    await _storage.write(key: AppConstants.storageStudentRollNo, value: rollNo);
  }

  static Future<String?> getStudentRollNo() async {
    return await _storage.read(key: AppConstants.storageStudentRollNo);
  }

  // Student access token (JWT from /student/login|register)
  static Future<void> saveStudentName(String name) async {
    await _storage.write(key: 'student_name', value: name);
  }

  static Future<String?> getStudentName() async {
    return await _storage.read(key: 'student_name');
  }

  static Future<void> saveStudentDivision(String division) async {
    await _storage.write(key: 'student_division', value: division);
  }

  static Future<String?> getStudentDivision() async {
    return await _storage.read(key: 'student_division');
  }

  static Future<void> saveAccessToken(String token) async {
    await _storage.write(key: 'student_access_token', value: token);
  }

  static Future<String?> getAccessToken() async {
    return await _storage.read(key: 'student_access_token');
  }

  // Clear all (for device reset / logout)
  static Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  // Check if provisioned (has HMAC key and device ID)
  static Future<bool> isProvisioned() async {
    final hmacKey = await getHmacKey();
    final deviceId = await getDeviceId();
    return hmacKey != null && deviceId != null;
  }
}