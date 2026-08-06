// lib/core/services/crypto_service.dart
/// Cryptographic service for HMAC-SHA256 and related operations
/// Implements Gate 4: Cryptographic Time-Stamp wax seal
import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:convert/convert.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';

class CryptoService {
  static const String _hmacAlgorithm = 'HmacSHA256';
  static final Random _random = Random.secure();

  /// Generate a cryptographically secure HMAC key (32 bytes = 64 hex chars)
  static String generateHmacKey() {
    final bytes = List<int>.generate(AppConstants.hmacKeyLength, (_) => _random.nextInt(256));
    return hex.encode(bytes);
  }

  /// Generate a cryptographically secure nonce (16 bytes = 32 hex chars)
  static String generateNonce() {
    final bytes = List<int>.generate(AppConstants.nonceLength, (_) => _random.nextInt(256));
    return hex.encode(bytes);
  }

  /// Generate a random token (base62, 6 chars by default)
  static String generateToken({int length = AppConstants.tokenLength}) {
    const charset = AppConstants.tokenCharset;
    final random = Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)]).join();
  }

  /// Compute HMAC-SHA256 signature
  /// 
  /// Canonical string format (per SRS):
  /// `${session_uuid}|${student_uuid}|${token_val}|${client_claimed_time}|${device_id_hash}|${nonce}`
  static String computeHmac({
    required String secretHmacKey,
    required String sessionUuid,
    required String studentUuid,
    required String tokenVal,
    required int clientClaimedTime,
    required String deviceIdHash,
    required String nonce,
  }) {
    final canonicalString = [
      sessionUuid,
      studentUuid,
      tokenVal,
      clientClaimedTime.toString(),
      deviceIdHash,
      nonce,
    ].join('|');

    final key = hex.decode(secretHmacKey);
    final hmac = Hmac(sha256, key);
    final digest = hmac.convert(utf8.encode(canonicalString));
    return hex.encode(digest.bytes);
  }

  /// Verify HMAC signature using constant-time comparison
  static bool verifyHmac({
    required String secretHmacKey,
    required String sessionUuid,
    required String studentUuid,
    required String tokenVal,
    required int clientClaimedTime,
    required String deviceIdHash,
    required String nonce,
    required String providedHmac,
  }) {
    final expectedHmac = computeHmac(
      secretHmacKey: secretHmacKey,
      sessionUuid: sessionUuid,
      studentUuid: studentUuid,
      tokenVal: tokenVal,
      clientClaimedTime: clientClaimedTime,
      deviceIdHash: deviceIdHash,
      nonce: nonce,
    );

    return _constantTimeEquals(expectedHmac, providedHmac);
  }

  /// Constant-time string comparison to prevent timing attacks
  static bool _constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    int result = 0;
    for (int i = 0; i < a.length; i++) {
      result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return result == 0;
  }

  /// SHA-256 hash for device ID (Gate 1)
  static String hashDeviceId(String deviceId) {
    final bytes = utf8.encode(deviceId);
    final digest = sha256.convert(bytes);
    return hex.encode(digest.bytes);
  }
}