import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:convert/convert.dart';

class CryptoService {
  static String deviceHash(String raw) =>
      sha256.convert(utf8.encode(raw)).toString();

  static String nonce() {
    final b = List.generate(16, (_) => Random.secure().nextInt(256));
    return hex.encode(b);
  }

  static String hmac({
    required String key,
    required String sessionUuid,
    required String studentUuid,
    required String tokenVal,
    required int claimedTime,
    required String deviceIdHash,
    required String nonce,
  }) {
    final msg = '$sessionUuid|$studentUuid|$tokenVal|$claimedTime|$deviceIdHash|$nonce';
    final keyBytes = hex.decode(key);
    final h = Hmac(sha256, keyBytes);
    return hex.encode(h.convert(utf8.encode(msg)).bytes);
  }
}