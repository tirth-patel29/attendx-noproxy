import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/app_constants.dart';

class StorageService {
  static const _s = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<void>    saveToken(String v)       => _s.write(key: AppConstants.keyToken, value: v);
  static Future<String?> getToken()                => _s.read(key: AppConstants.keyToken);
  static Future<void>    saveStudentUuid(String v)  => _s.write(key: AppConstants.keyStudentUuid, value: v);
  static Future<String?> getStudentUuid()           => _s.read(key: AppConstants.keyStudentUuid);
  static Future<void>    saveRollNo(String v)       => _s.write(key: AppConstants.keyRollNo, value: v);
  static Future<String?> getRollNo()                => _s.read(key: AppConstants.keyRollNo);
  static Future<void>    saveName(String v)         => _s.write(key: AppConstants.keyName, value: v);
  static Future<String?> getName()                  => _s.read(key: AppConstants.keyName);
  static Future<void>    saveHmac(String v)         => _s.write(key: AppConstants.keyHmac, value: v);
  static Future<String?> getHmac()                  => _s.read(key: AppConstants.keyHmac);
  static Future<void>    saveDeviceId(String v)     => _s.write(key: AppConstants.keyDeviceId, value: v);
  static Future<String?> getDeviceId()              => _s.read(key: AppConstants.keyDeviceId);
  static Future<void>    clearAll()                 => _s.deleteAll();

  static Future<bool> isLoggedIn() async {
    final t = await getToken();
    final u = await getStudentUuid();
    return t != null && t.isNotEmpty && u != null && u.isNotEmpty;
  }
}