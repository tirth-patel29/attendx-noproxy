# 01 — Authentication, Gate 1 & Gate 2 (Device Binding & Biometrics)

This guide covers initial student identity setup, the **Gate 1 Hardware Tattoo**, and the **Gate 2 Biometric Flesh Lock**.

---

## 1. Gate 1: The Hardware Tattoo

### 1.1 What is the Hardware Tattoo?
To prevent students from sharing credentials or logging into multiple devices, each student account is permanently bound to a single physical device.

1. On first app launch, the app generates a random UUIDv4 and stores it in the device's **Secure Enclave** (`flutter_secure_storage` with `AndroidOptions(encryptedSharedPreferences: true)` and iOS Keychain accessibility).
2. The app computes:
   $$\text{device\_id\_hash} = \text{SHA-256}(\text{raw\_hardware\_uuid})$$
3. During the initial device binding step, this `device_id_hash` is registered with the server in `students.bound_device_id`.
4. Any subsequent request from a different device hash returns HTTP 403 `ERR_HW_MISMATCH`.

### 1.2 Dart Implementation (`device_service.dart`)

```dart
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class DeviceService {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _keyHardwareUuid = 'attendx_hardware_uuid';

  /// Retrieves existing Hardware UUID or generates and persists a new one.
  static Future<String> getOrCreateHardwareUuid() async {
    String? uuid = await _storage.read(key: _keyHardwareUuid);
    if (uuid == null || uuid.isEmpty) {
      uuid = const Uuid().v4();
      await _storage.write(key: _keyHardwareUuid, value: uuid);
    }
    return uuid;
  }

  /// Computes SHA-256 hash of the hardware UUID for network transmission.
  static Future<String> getDeviceIdHash() async {
    final rawUuid = await getOrCreateHardwareUuid();
    final bytes = utf8.encode(rawUuid);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }
}
```

---

## 2. Gate 2: Biometric Flesh Lock

### 2.1 Why Biometrics?
Gate 2 stops the "phone mule" attack (a student handing their phone to a classmate to scan for them).
Before the camera opens, the app asks the operating system: *"Is the registered owner holding this phone right now?"*

### 2.2 Dart Implementation (`biometric_service.dart`)

```dart
import 'package:local_auth/local_auth.dart';

class BiometricService {
  static final LocalAuthentication _auth = LocalAuthentication();

  /// Prompts for biometric authentication (Fingerprint / Face ID).
  /// Returns true only if the user successfully authenticates.
  static Future<bool> authenticate() async {
    final canCheck = await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
    if (!canCheck) {
      // If hardware has no biometrics, fall back to device PIN/passcode
      return await _auth.authenticate(
        localizedReason: 'Verify identity to mark attendance',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
        ),
      );
    }

    try {
      return await _auth.authenticate(
        localizedReason: 'Authenticate your biometric flesh lock',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } catch (e) {
      return false;
    }
  }
}
```

---

## 3. Student Registration, Login & Device Binding

### 3.1 Step A: Registration (`POST /api/v1/student/register`)
If the student does not have an account yet:

```http
POST /api/v1/student/register
Host: api.atmyhome.tech
X-Api-Key: ag_live_xxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "id": "24DCS093",
  "name": "Tirth Patel",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "student": {
      "student_uuid": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
      "roll_no": "24DCS093",
      "name": "Tirth Patel",
      "email": "24dcs093@charusat.edu.in",
      "bound": false
    }
  }
}
```

---

### 3.2 Step B: Login (`POST /api/v1/student/login`)
When an existing student signs in:

```http
POST /api/v1/student/login
Host: api.atmyhome.tech
X-Api-Key: ag_live_xxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "id": "24DCS093",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "student": {
      "student_uuid": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
      "roll_no": "24DCS093",
      "name": "Tirth Patel",
      "bound_device_id": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
}
```

---

### 3.3 Step C: Device Binding (`POST /api/v1/student/device/bind`)

> [!IMPORTANT]
> This is the single most critical onboarding step. When the student logs in for the first time, their phone binds its hardware hash. The server generates a unique **64-character hex `secret_hmac_key`** and returns it to the client.
> **The client MUST store this key in Secure Storage immediately!**

```http
POST /api/v1/student/device/bind
Host: api.atmyhome.tech
X-Api-Key: ag_live_xxxxxxxxxxxxxxxxxxxx
Authorization: Bearer <student_jwt_token>
Content-Type: application/json

{
  "device_id_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "bound": true,
  "student_uuid": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
  "roll_no": "24DCS093",
  "secret_hmac_key": "4a7d3f8e02b1c69a5e8f1d4c7b2a9e0f3d6c9b2a5e8f1d4c7b2a9e0f3d6c9b2a"
}
```

### 3.4 Persisting Identity in Secure Storage

```dart
await storage.write(key: 'jwt_token', value: res['data']['token']);
await storage.write(key: 'student_uuid', value: res['student_uuid']);
await storage.write(key: 'roll_no', value: res['roll_no']);
await storage.write(key: 'secret_hmac_key', value: res['secret_hmac_key']);
```

---

## 4. What Happens If A Student Gets A New Phone?

If a student loses their phone or upgrades:
1. They try to claim attendance from the new phone $\rightarrow$ Server returns HTTP 403 `ERR_HW_MISMATCH`.
2. The student visits their college department admin desk.
3. The Admin opens `https://admin.atmyhome.tech/students`, finds the student roll number, and clicks **[RESET HARDWARE LOCK]**.
4. The server clears `students.bound_device_id` and revokes the old `secret_hmac_key`.
5. The student re-authenticates on their new phone, which triggers `POST /api/v1/student/device/bind` to bind the new device and securely receive a fresh HMAC key.
