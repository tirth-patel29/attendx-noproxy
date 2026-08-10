// lib/core/constants/app_constants.dart
/// Centralized constants for the Attendance Gateway Flutter client.
///
/// The API base URL is compile-time configurable so the same codebase builds
/// against any deployment:
///   flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com
/// Defaults to the reference deployment.
class AppConstants {
  // API endpoints
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.atmyhome.tech',
  );
  static const String timeSyncEndpoint = '/api/v1/time-sync';
  static const String claimAttendanceEndpoint = '/api/v1/claim-attendance';
  static const String startSessionEndpoint = '/api/v1/sessions/start';
  static const String sessionTokensEndpoint = '/api/v1/sessions';
  static const String deviceRegisterEndpoint = '/api/v1/devices/register';
  static const String provisionEndpoint = '/api/v1/provision';
  static const String challengeEndpoint = '/api/v1/sessions'; // + /:uuid/challenge
  // Student self-registration/auth (SRS §1 Phase 1 + charusat identity)
  static const String studentStatusEndpoint = '/api/v1/student/status';
  static const String studentRegisterEndpoint = '/api/v1/student/register';
  static const String studentLoginEndpoint = '/api/v1/student/login';
  static const String studentPasswordSetEndpoint = '/api/v1/student/password/set';
  static const String studentBindEndpoint = '/api/v1/student/device/bind';
  static const String studentEmailDomain = String.fromEnvironment('STUDENT_EMAIL_DOMAIN', defaultValue: 'charusat.edu.in');

  // Metronome (SRS §1 Phase 2: 4-character base62 token every 3s)
  static const int metronomeIntervalMs = 3000;
  static const int tokenLength = 4;
  static const String tokenCharset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // base62

  // Judge settings (SRS §3: the 250ms Universal Stream Kill-Window)
  static const int maxLatencyMs = 250;
  static const int tokenValidityWindowMs = 5000;

  // Projector QR payload: ATTN:<session_uuid>:<token>
  static const String attnPrefix = 'ATTN:';

  // Crypto
  static const int hmacKeyLength = 32; // bytes
  static const int nonceLength = 16; // bytes
  static const String hmacAlgorithm = 'HmacSHA256';

  // Storage keys
  static const String storageHmacKey = 'hmac_key';
  static const String storageDeviceId = 'device_id';
  static const String storageDriftOffset = 'drift_offset_ms';
  static const String storageBoundDeviceId = 'bound_device_id';
  static const String storageStudentUuid = 'student_uuid';
  static const String storageStudentRollNo = 'student_roll_no';

  // QR scanner
  static const double qrScanTimeout = 10.0; // seconds

  // Time sync (Cristian's Algorithm)
  static const int timeSyncRetries = 3;
  static const Duration timeSyncInterval = Duration(minutes: 5);

  // UI
  static const Duration precheckStepDelay = Duration(milliseconds: 800);
  static const Duration gateAnimationDuration = Duration(milliseconds: 300);

  // Gate statuses (matching SRS state machine)
  static const String statusPresent = 'PRESENT';
  static const String statusHardwareMismatch = 'HARDWARE_MISMATCH';
  static const String statusStreamDetected = 'STREAM_DETECTED';
  static const String statusForgedResponse = 'FORGED_RESPONSE';
  static const String statusExpiredToken = 'EXPIRED_TOKEN';
  static const String statusInvalidClaim = 'INVALID_CLAIM';

  // Gate 1: Hardware Tattoo
  static const String gate1Title = 'Hardware Tattoo';
  static const String gate1Description = 'Device UUID locked in Secure Enclave';

  // Gate 2: Biometric Flesh Lock
  static const String gate2Title = 'Biometric Flesh Lock';
  static const String gate2Description = 'OS-level thumbprint/FaceID verification';

  // Gate 3: Visual Micro-Twitch
  static const String gate3Title = 'Visual Micro-Twitch';
  static const String gate3Description = '3-second rotating QR token';

  // Gate 4: Cryptographic Time-Stamp
  static const String gate4Title = 'Cryptographic Time-Stamp';
  static const String gate4Description = '250ms crypto window via Cristian\'s Algorithm + HMAC-SHA256';
}