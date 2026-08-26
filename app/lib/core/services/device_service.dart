import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

class DeviceService {
  static Future<String> getDeviceIdHash() async {
    final info = DeviceInfoPlugin();
    String raw;
    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        raw = (await info.androidInfo).id;
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        raw = (await info.iosInfo).identifierForVendor ?? 'fallback';
      } else {
        raw = 'fallback-device';
      }
    } catch (_) { raw = 'fallback-device'; }
    return sha256.convert(utf8.encode(raw)).toString();
  }
}