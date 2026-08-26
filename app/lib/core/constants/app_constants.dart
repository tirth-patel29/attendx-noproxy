class AppConstants {
  static const String baseUrl     = 'https://api.atmyhome.tech';
  static const String apiKey      = 'ag_ebLWGBdNzn_mEzmhGOLUfJLyHKFOBu9K';
  static const String emailDomain = 'charusat.edu.in';

  static const String epStudentStatus   = '/api/v1/student/status';
  static const String epStudentRegister = '/api/v1/student/register';
  static const String epStudentLogin    = '/api/v1/student/login';
  static const String epStudentSetPw    = '/api/v1/student/password/set';
  static const String epStudentBind     = '/api/v1/student/device/bind';
  static const String epStudentAttend   = '/api/v1/student/attendance';
  static const String epTimeSync        = '/api/v1/time-sync';
  static const String epClaim           = '/api/v1/claim-attendance';
  static const String epSessions        = '/api/v1/sessions';

  static const String keyHmac        = 'hmac_key';
  static const String keyDeviceId    = 'device_id';
  static const String keyStudentUuid = 'student_uuid';
  static const String keyRollNo      = 'student_roll_no';
  static const String keyName        = 'student_name';
  static const String keyToken       = 'student_token';

  static const String attnPrefix = 'ATTN:';
  static const int    metronomeMs = 3000;
}