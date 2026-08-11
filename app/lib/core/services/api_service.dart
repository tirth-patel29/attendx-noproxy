// lib/core/services/api_service.dart
// API service for communicating with the attendance-backend
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';
import 'package:attendance_gateway/core/services/time_sync_service.dart';
import 'package:attendance_gateway/core/services/crypto_service.dart';

class ApiService {
  static const String _baseUrl = AppConstants.baseUrl;
  static Dio? _dio;
  static final TimeSyncService _timeSync = TimeSyncService();

  static Dio get _client {
    _dio ??= Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));
    return _dio!;
  }

  /// Initialize the API service
  static Future<void> initialize() async {
    await _timeSync.initialize();
    // Initial time sync
    await _timeSync.syncTime();
    _timeSync.startPeriodicSync();
  }

  /// Dispose resources
  static void dispose() {
    _timeSync.dispose();
    _dio?.close();
    _dio = null;
  }

  // ===== Time Sync =====

  /// Sync time with server using Cristian's Algorithm
  static Future<bool> syncTime({int retries = AppConstants.timeSyncRetries}) async {
    return await _timeSync.syncTime(retries: retries);
  }

  /// Get current estimated server time in milliseconds
  static int getEstimatedServerTimeMs() {
    return _timeSync.getEstimatedServerTimeMs();
  }

  // ===== Time Sync Endpoint =====

  /// GET /api/v1/time-sync
  /// Returns server epoch time for Cristian's Algorithm
  static Future<Map<String, dynamic>> timeSync() async {
    try {
      final response = await _client.get(AppConstants.timeSyncEndpoint);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Time sync failed: ${e.message}', e.response?.statusCode);
    }
  }

  // ===== Session Management =====

  /// POST /api/v1/sessions/start
  /// Start a new attendance session (professor only)
  static Future<Map<String, dynamic>> startSession({
    required String courseCode,
    required String profUuid,
    String? sessionDate,
  }) async {
    try {
      final response = await _client.post(
        AppConstants.startSessionEndpoint,
        data: {
          'course_code': courseCode,
          'prof_uuid': profUuid,
          if (sessionDate != null) 'session_date': sessionDate,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Start session failed: ${e.message}', e.response?.statusCode);
    }
  }

  /// POST /api/v1/sessions/:sessionUuid/stop
  /// Stop a session (professor only)
  static Future<Map<String, dynamic>> stopSession(String sessionUuid) async {
    try {
      final response = await _client.post(
        '${AppConstants.sessionTokensEndpoint}/$sessionUuid/stop',
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Stop session failed: ${e.message}', e.response?.statusCode);
    }
  }

  /// GET /api/v1/sessions/:sessionUuid/tokens
  /// Get active tokens for a session (debug)
  static Future<Map<String, dynamic>> getSessionTokens(String sessionUuid) async {
    try {
      final response = await _client.get(
        '${AppConstants.sessionTokensEndpoint}/$sessionUuid/tokens',
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Get tokens failed: ${e.message}', e.response?.statusCode);
    }
  }

  /// GET /api/v1/sessions/:sessionUuid/attendance
  /// Get attendance records for a session (professor view)
  static Future<Map<String, dynamic>> getSessionAttendance(String sessionUuid) async {
    try {
      final response = await _client.get(
        '${AppConstants.sessionTokensEndpoint}/$sessionUuid/attendance',
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Get attendance failed: ${e.message}', e.response?.statusCode);
    }
  }

  // ===== Student auth (self-registration + device binding) =====

  /// POST /student/status — does this ID exist? does it have a password?
  static Future<Map<String, dynamic>> studentStatus(String id) async {
    try {
      final response = await _client.post(AppConstants.studentStatusEndpoint, data: {'id': id});
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Status check failed: ${e.message}', e.response?.statusCode);
    }
  }

  /// POST /student/register — create the account (only when not exists).
  static Future<Map<String, dynamic>> studentRegister({required String id, required String name, required String password}) async {
    try {
      final response = await _client.post(AppConstants.studentRegisterEndpoint, data: {'id': id, 'name': name, 'password': password});
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Registration failed: ${e.message}', e.response?.statusCode);
    }
  }

  /// POST /student/password/set — first-time or admin-forgot password set.
  static Future<Map<String, dynamic>> studentSetPassword({required String id, required String newPassword}) async {
    try {
      final response = await _client.post(AppConstants.studentPasswordSetEndpoint, data: {'id': id, 'new_password': newPassword});
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Could not set password: ${e.message}', e.response?.statusCode);
    }
  }

  /// POST /student/login — returns student JWT + identity.
  static Future<Map<String, dynamic>> studentLogin({required String id, required String password}) async {
    try {
      final response = await _client.post(AppConstants.studentLoginEndpoint, data: {'id': id, 'password': password});
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Login failed: ${e.message}', e.response?.statusCode);
    }
  }

  /// POST /student/device/bind (student JWT) — mints + stores the HMAC signer
  /// server-side and returns it for the KeyStore. This is where the device's
  /// permanent hardware identity is created (SRS §1 Phase 1).
  static Future<Map<String, dynamic>> studentBindDevice({required String accessToken, required String deviceIdHash}) async {
    try {
      final response = await _client.post(
        AppConstants.studentBindEndpoint,
        data: {'device_id_hash': deviceIdHash},
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Device binding failed: ${e.message}', e.response?.statusCode);
    }
  }

  // ===== Device Registration / Provisioning =====

  /// POST /api/v1/devices/register
  /// Register a device to a student (Gate 1 binding)
  static Future<Map<String, dynamic>> registerDevice({
    required String studentUuid,
    required String deviceIdHash,
  }) async {
    try {
      final response = await _client.post(
        AppConstants.deviceRegisterEndpoint,
        data: {
          'student_uuid': studentUuid,
          'device_id_hash': deviceIdHash,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Device registration failed: ${e.message}', e.response?.statusCode);
    }
  }

  /// POST /api/v1/provision
  /// Full SRS provisioning: roll number + the HMAC secret issued by the Admin
  /// Console (student detail panel) + this device's hardware hash.
  /// The server validates the pair, binds the device (Gate 1) and returns the
  /// student's UUID for storage. 401 on wrong secret, 409 if already bound
  /// elsewhere (admin must reset-device first).
  static Future<Map<String, dynamic>> provision({
    required String rollNo,
    required String secretHmacKey,
    required String deviceIdHash,
  }) async {
    try {
      final response = await _client.post(
        AppConstants.provisionEndpoint,
        data: {
          'roll_no': rollNo,
          'secret_hmac_key': secretHmacKey,
          'device_id_hash': deviceIdHash,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Provisioning failed: ${e.message}', e.response?.statusCode);
    }
  }

  // ===== Crypto Challenge (Gate 4) =====

  /// POST /api/v1/sessions/:sessionUuid/challenge
  /// Request a fresh single-use nonce from the server for the HMAC wax seal.
  /// This is server-issued (SRS §6) so the server can prove claim freshness
  /// and reject replays. Returns { nonce, issued_at_epoch, expires_at_epoch }.
  static Future<Map<String, dynamic>> getChallenge(String sessionUuid) async {
    try {
      final response = await _client.post(
        '${AppConstants.challengeEndpoint}/$sessionUuid/challenge',
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Get challenge failed: ${e.message}', e.response?.statusCode);
    }
  }

  // ===== Attendance Claim =====

  /// POST /api/v1/claim-attendance
  /// Main 4-gate attendance claim endpoint
  static Future<Map<String, dynamic>> claimAttendance({
    required String sessionUuid,
    required String studentUuid,
    required String tokenVal,
    required int clientClaimedTime,
    required String deviceIdHash,
    required String nonce,
    required String hmacSignature,
  }) async {
    try {
      final response = await _client.post(
        AppConstants.claimAttendanceEndpoint,
        data: {
          'session_uuid': sessionUuid,
          'student_uuid': studentUuid,
          'token_val': tokenVal,
          'client_claimed_time': clientClaimedTime,
          'device_id_hash': deviceIdHash,
          'nonce': nonce,
          'hmac_signature': hmacSignature,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException('Claim attendance failed: ${e.message}', e.response?.statusCode);
    }
  }

  /// High-level claim attendance method (handles crypto + time sync)
  static Future<Map<String, dynamic>> submitAttendance({
    required String sessionUuid,
    required String studentUuid,
    required String tokenVal,
    required String deviceIdHash,
    String? nonce,
  }) async {
    // Ensure time is synced
    if (!_timeSync.isTimeSyncFresh()) {
      await _timeSync.syncTime();
    }

    // Get HMAC key
    final hmacKey = await SecureStorageService.getHmacKey();
    if (hmacKey == null) {
      throw ApiException('HMAC key not found. Please provision device first.');
    }

    // Get current estimated server time (client claimed time)
    final clientClaimedTime = _timeSync.getEstimatedServerTimeMs();

    // Get server-issued challenge nonce (SRS §6). The server persists it to
    // crypto_challenges with single-use semantics; a locally generated nonce
    // would be rejected by the judge as invalid_or_expired_nonce.
    final challenge = await getChallenge(sessionUuid);
    final challengeNonce = (challenge['nonce'] as String?) ?? CryptoService.generateNonce();

    // Get device ID hash
    final deviceId = await SecureStorageService.getDeviceId();
    if (deviceId == null) {
      throw ApiException('Device ID not found. Please provision device first.');
    }
    final deviceIdHash = deviceId;

    // Compute HMAC signature
    final hmacSignature = CryptoService.computeHmac(
      secretHmacKey: hmacKey,
      sessionUuid: sessionUuid,
      studentUuid: studentUuid,
      tokenVal: tokenVal,
      clientClaimedTime: clientClaimedTime,
      deviceIdHash: deviceIdHash,
      nonce: challengeNonce,
    );

    // Submit claim
    return await claimAttendance(
      sessionUuid: sessionUuid,
      studentUuid: studentUuid,
      tokenVal: tokenVal,
      clientClaimedTime: clientClaimedTime,
      deviceIdHash: deviceIdHash,
      nonce: challengeNonce,
      hmacSignature: hmacSignature,
    );
  }

  // ===== Health =====

  static Future<bool> checkHealth() async {
    try {
      final response = await _client.get('/health');
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

/// Custom exception for API errors
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => 'ApiException: $message${statusCode != null ? ' (status: $statusCode)' : ''}';
}