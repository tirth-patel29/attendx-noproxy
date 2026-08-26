import 'package:dio/dio.dart';
import '../constants/app_constants.dart';

class ApiService {
  static final _dio = Dio(BaseOptions(
    baseUrl: AppConstants.baseUrl,
    connectTimeout: const Duration(seconds: 12),
    receiveTimeout: const Duration(seconds: 12),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Api-Key': AppConstants.apiKey,
    },
  ));

  static Options _auth(String token) =>
      Options(headers: {'Authorization': 'Bearer $token'});

  static String _errMsg(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final err = data['error'];
      if (err is Map) return err['message']?.toString() ?? 'Request failed';
      return err?.toString() ?? data['message']?.toString() ?? 'Request failed';
    }
    return e.message ?? 'Network error';
  }

  static Future<Map<String, dynamic>> studentStatus(String id) async {
    try {
      final r = await _dio.post(AppConstants.epStudentStatus, data: {'id': id});
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) { throw _errMsg(e); }
  }

  static Future<Map<String, dynamic>> studentRegister({
    required String id, required String name, required String password,
  }) async {
    try {
      final r = await _dio.post(AppConstants.epStudentRegister,
          data: {'id': id, 'name': name, 'password': password});
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) { throw _errMsg(e); }
  }

  static Future<Map<String, dynamic>> studentLogin({
    required String id, required String password,
  }) async {
    try {
      final r = await _dio.post(AppConstants.epStudentLogin,
          data: {'id': id, 'password': password});
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) { throw _errMsg(e); }
  }

  static Future<void> studentSetPassword({
    required String id, required String newPassword,
  }) async {
    try {
      await _dio.post(AppConstants.epStudentSetPw,
          data: {'id': id, 'new_password': newPassword});
    } on DioException catch (e) { throw _errMsg(e); }
  }

  static Future<Map<String, dynamic>> bindDevice({
    required String token, required String deviceIdHash,
  }) async {
    try {
      final r = await _dio.post(AppConstants.epStudentBind,
          data: {'device_id_hash': deviceIdHash}, options: _auth(token));
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) { throw _errMsg(e); }
  }

  static Future<Map<String, dynamic>> getAttendance(String token) async {
    try {
      final r = await _dio.get(AppConstants.epStudentAttend, options: _auth(token));
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) { throw _errMsg(e); }
  }

  static Future<int> getServerTimeMs() async {
    try {
      final t0 = DateTime.now().millisecondsSinceEpoch;
      final r  = await _dio.get(AppConstants.epTimeSync);
      final t1 = DateTime.now().millisecondsSinceEpoch;
      final raw = r.data['server_time_ms'] ?? r.data['epoch_ms'] ?? r.data['time_ms'];
      if (raw is num) return raw.toInt() + (t1 - t0) ~/ 2;
      return t1;
    } catch (_) { return DateTime.now().millisecondsSinceEpoch; }
  }

  static Future<Map<String, dynamic>> getChallenge(String sessionUuid) async {
    try {
      final r = await _dio.post('${AppConstants.epSessions}/$sessionUuid/challenge');
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) { throw _errMsg(e); }
  }

  static Future<Map<String, dynamic>> claimAttendance({
    required String sessionUuid,
    required String studentUuid,
    required String tokenVal,
    required int clientClaimedTime,
    required String deviceIdHash,
    required String nonce,
    required String hmacSig,
  }) async {
    try {
      final r = await _dio.post(AppConstants.epClaim, data: {
        'session_uuid':        sessionUuid,
        'student_uuid':        studentUuid,
        'token_val':           tokenVal,
        'client_claimed_time': clientClaimedTime,
        'device_id_hash':      deviceIdHash,
        'nonce':               nonce,
        'hmac_signature':      hmacSig,
      });
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) { throw _errMsg(e); }
  }
}