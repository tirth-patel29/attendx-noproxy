# 04 — Gate 4 Cryptographic Signing & Attendance Claim

This guide details the final cryptographic assembly: calculating the **Gate 4 HMAC-SHA256 Wax Seal**, submitting the payload to `/api/v1/claim-attendance`, and handling the standardized server verification response.

---

## 1. The Canonical String Format

To ensure both client and server compute identical cryptographic hashes without serialization ambiguities, AttendX uses an explicit **pipe-delimited canonical string**:

$$\text{canonical\_string} = \text{session\_uuid} \mid \text{student\_uuid} \mid \text{token\_val} \mid \text{client\_claimed\_time} \mid \text{device\_id\_hash} \mid \text{nonce}$$

### 1.1 Field Definitions & Ordering

| Index | Field | Description | Example |
|---|---|---|---|
| 0 | `session_uuid` | 36-char lowercase UUID of current lecture | `550e8400-e29b-41d4-a716-446655440000` |
| 1 | `student_uuid` | 36-char lowercase UUID of student | `6fa85f64-5717-4562-b3fc-2c963f66afa6` |
| 2 | `token_val` | 4-8 char base62 visual token from flash | `K9x2` |
| 3 | `client_claimed_time` | Calibrated server epoch timestamp (ms as string) | `1726190400215` |
| 4 | `device_id_hash` | 64-char hex SHA-256 hash of hardware UUID | `e3b0c44298fc1c149afbf4c8996fb92427ae...` |
| 5 | `nonce` | Single-use challenge nonce from challenge endpoint | `9f83b2a1c0d4e5f67890abcdef123456` |

**Example Canonical String:**
```text
550e8400-e29b-41d4-a716-446655440000|6fa85f64-5717-4562-b3fc-2c963f66afa6|K9x2|1726190400215|e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855|9f83b2a1c0d4e5f67890abcdef123456
```

---

## 2. Computing the HMAC-SHA256 Signature

1. Retrieve the student's `secret_hmac_key` (stored during device binding).
2. Decode the 64-character hex key string into raw bytes (32 bytes).
3. Compute `Hmac(sha256, keyBytes).convert(utf8.encode(canonicalString))`.
4. Output signature as a **lowercase 64-character hex string**.

### Dart Implementation (`crypto_service.dart`)

```dart
import 'dart:convert';
import 'package:convert/convert.dart';
import 'package:crypto/crypto.dart';

class CryptoService {
  /// Computes the Gate-4 HMAC-SHA256 signature
  static String computeHmacSignature({
    required String secretHmacKeyHex,
    required String sessionUuid,
    required String studentUuid,
    required String tokenVal,
    required int clientClaimedTimeMs,
    required String deviceIdHash,
    required String nonce,
  }) {
    // 1. Build canonical pipe-separated string
    final canonicalString = [
      sessionUuid,
      studentUuid,
      tokenVal,
      clientClaimedTimeMs.toString(),
      deviceIdHash,
      nonce,
    ].join('|');

    // 2. Decode hex HMAC key
    final keyBytes = hex.decode(secretHmacKeyHex);

    // 3. Compute HMAC-SHA256
    final hmacSha256 = Hmac(sha256, keyBytes);
    final digest = hmacSha256.convert(utf8.encode(canonicalString));

    return hex.encode(digest.bytes);
  }
}
```

---

## 3. Submitting the Attendance Claim

### Endpoint: `POST /api/v1/claim-attendance`

```http
POST /api/v1/claim-attendance
Host: api.atmyhome.tech
X-Api-Key: ag_live_xxxxxxxxxxxxxxxxxxxx
Authorization: Bearer <student_jwt>
Content-Type: application/json

{
  "session_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "student_uuid": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
  "token_val": "K9x2",
  "client_claimed_time": 1726190400215,
  "device_id_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "challenge_nonce": "9f83b2a1c0d4e5f67890abcdef123456",
  "hmac_signature": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

### 3.1 Success Response (200 OK)
```json
{
  "status": "PRESENT",
  "message": "Attendance verified and recorded",
  "verification_delta_ms": 45,
  "ledger_uuid": "9a1b2c3d-4e5f-6789-0abc-def123456789"
}
```
* Note: If attendance was already claimed earlier in the lecture, the server returns 200 OK with `"message": "already logged"`. Treat this as a success!

---

## 4. Standardized Error Handling

Every non-200 response uses AttendX's standardized error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERR_STREAM_DETECTED",
    "message": "Proxy Stream Detected. Photonic intercept lag exceeded the 250ms threshold.",
    "latency_ms": 312
  }
}
```

### Error Code Handling Matrix

| Error Code | HTTP Status | Root Cause | Client UI Action |
|---|---|---|---|
| `ERR_HW_MISMATCH` | **403** | Phone is not the device bound to this student. | Show: *"Hardware Mismatch. Please contact your college administrator to reset your device binding."* |
| `ERR_STREAM_DETECTED` | **412** | Verification latency $\Delta > 250\text{ ms}$. Codec stream delay detected. | Show: *"Stream Detected. You must be physically in class scanning the direct projector screen."* Offer re-scan. |
| `ERR_TOKEN_EXPIRED` | **406** | The 100ms flash rotated or expired before claim arrived. | Show: *"Token expired. Point camera back at projector to capture next flash."* Auto re-scan. |
| `ERR_NONCE_USED` | **400** | Nonce was already consumed (anti-replay). | Silently fetch a fresh challenge nonce and retry claim once. |
| `ERR_SIG_INVALID` | **401** | HMAC wax seal mismatch. | Show: *"Cryptographic signature rejected."* Check `secret_hmac_key`. |
| `ERR_AUTH_MISSING` | **401** | Missing `X-Api-Key` or expired student JWT. | Re-authenticate student. |

---

## 5. Production Dart Implementation (`claim_service.dart`)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../services/crypto_service.dart';

class ClaimResult {
  final bool success;
  final String status;
  final String message;
  final int? deltaMs;
  final String? errorCode;

  const ClaimResult({
    required this.success,
    required this.status,
    required this.message,
    this.deltaMs,
    this.errorCode,
  });
}

class ClaimService {
  static Future<ClaimResult> claimAttendance({
    required String baseUrl,
    required String apiKey,
    required String studentJwt,
    required String sessionUuid,
    required String studentUuid,
    required String tokenVal,
    required int clientClaimedTimeMs,
    required String deviceIdHash,
    required String challengeNonce,
    required String secretHmacKeyHex,
  }) async {
    // 1. Compute Gate-4 HMAC Wax Seal
    final signature = CryptoService.computeHmacSignature(
      secretHmacKeyHex: secretHmacKeyHex,
      sessionUuid: sessionUuid,
      studentUuid: studentUuid,
      tokenVal: tokenVal,
      clientClaimedTimeMs: clientClaimedTimeMs,
      deviceIdHash: deviceIdHash,
      nonce: challengeNonce,
    );

    // 2. Dispatch Claim Payload
    final body = jsonEncode({
      'session_uuid': sessionUuid,
      'student_uuid': studentUuid,
      'token_val': tokenVal,
      'client_claimed_time': clientClaimedTimeMs,
      'device_id_hash': deviceIdHash,
      'challenge_nonce': challengeNonce,
      'hmac_signature': signature,
    });

    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/claim-attendance'),
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': 'Bearer $studentJwt',
        'Content-Type': 'application/json',
      },
      body: body,
    );

    final data = jsonDecode(response.body);

    if (response.statusCode == 200) {
      return ClaimResult(
        success: true,
        status: data['status'] ?? 'PRESENT',
        message: data['message'] ?? 'Attendance marked successfully',
        deltaMs: data['verification_delta_ms'],
      );
    } else {
      final err = data['error'] ?? {};
      return ClaimResult(
        success: false,
        status: 'FAILED',
        message: err['message'] ?? 'Attendance verification failed',
        errorCode: err['code'] ?? 'ERR_UNKNOWN',
        deltaMs: err['latency_ms'],
      );
    }
  }
}
```
