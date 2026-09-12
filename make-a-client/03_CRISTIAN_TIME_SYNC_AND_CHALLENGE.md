# 03 — Time Synchronization (Cristian's Algorithm) & Challenge Nonce

Because AttendX enforces a **$\le 250\text{ ms}$ verification window**, student phone system clocks cannot simply be trusted (`DateTime.now()` can drift by seconds or be maliciously altered by the user).

This document explains how to synchronize time with sub-millisecond precision and retrieve single-use cryptographic challenge nonces.

---

## 1. Cristian's Algorithm Time Synchronization

### 1.1 The Math
When the client calls `GET /api/v1/time-sync`, it records:
1. $t_0$: Local client epoch timestamp (ms) immediately before firing the HTTP request.
2. $T_{\text{server}}$: The `server_epoch` (ms) returned by the backend in the JSON payload.
3. $t_1$: Local client epoch timestamp (ms) immediately upon receiving the response.

Assuming symmetric network propagation:
$$\text{Round Trip Time (RTT)} = t_1 - t_0$$
$$\text{Estimated Server Time at } t_1 = T_{\text{server}} + \frac{\text{RTT}}{2}$$
$$\text{Drift Offset} = \left( T_{\text{server}} + \frac{\text{RTT}}{2} \right) - t_1$$

For any future moment:
$$\text{True Server Time} = \text{DateTime.now().millisecondsSinceEpoch} + \text{Drift Offset}$$

### 1.2 Multi-Sample Minimum RTT Filtering
To eliminate network jitter spikes on mobile Wi-Fi / 5G, fire 3 to 5 rapid requests and keep the sample with the **lowest RTT**.

---

## 2. Challenge Nonce Protocol

### 2.1 Why Challenge Nonces?
To defeat replay attacks (capturing a valid signed packet and resending it 2 seconds later), the server requires a **single-use cryptographic nonce** issued specifically for that session.

### 2.2 Endpoint: `POST /api/v1/sessions/:id/challenge`

```http
POST /api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/challenge
Host: api.atmyhome.tech
X-Api-Key: ag_live_xxxxxxxxxxxxxxxxxxxx
Authorization: Bearer <student_jwt>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "challenge_nonce": "9f83b2a1c0d4e5f67890abcdef123456",
    "issued_at_epoch": 1726190400123,
    "server_time_ms": 1726190400123,
    "expires_at_epoch": 1726190405123
  }
}
```

* **`challenge_nonce`**: 32-character hexadecimal random nonce.
* **`server_time_ms`**: Precise server timestamp at issuance.
* **Single-use rule**: The server marks this nonce as `used = true` the instant it is verified. If submitted a second time, it triggers HTTP 400 `ERR_NONCE_USED`.

---

## 3. Production Dart Implementation (`time_sync_service.dart`)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class TimeSyncResult {
  final int driftOffsetMs;
  final int minRttMs;

  const TimeSyncResult({
    required this.driftOffsetMs,
    required this.minRttMs,
  });
}

class TimeSyncService {
  static int _cachedDriftOffsetMs = 0;
  static bool _hasSynced = false;

  /// Returns current calibrated server time in milliseconds.
  static int get currentServerTimeMs {
    return DateTime.now().millisecondsSinceEpoch + _cachedDriftOffsetMs;
  }

  /// Runs multi-sample Cristian's Algorithm against /api/v1/time-sync.
  static Future<TimeSyncResult> synchronize({
    required String baseUrl,
    required String apiKey,
    int samples = 3,
  }) async {
    int lowestRtt = 999999;
    int optimalDrift = 0;

    for (int i = 0; i < samples; i++) {
      final t0 = DateTime.now().millisecondsSinceEpoch;

      try {
        final response = await http.get(
          Uri.parse('$baseUrl/api/v1/time-sync'),
          headers: {
            'X-Api-Key': apiKey,
            'Accept': 'application/json',
          },
        ).timeout(const Duration(seconds: 3));

        final t1 = DateTime.now().millisecondsSinceEpoch;

        if (response.statusCode == 200) {
          final json = jsonDecode(response.body);
          final serverEpoch = (json['server_epoch'] as num).toInt();

          final rtt = t1 - t0;
          final estimatedServerAtT1 = serverEpoch + (rtt ~/ 2);
          final drift = estimatedServerAtT1 - t1;

          if (rtt < lowestRtt) {
            lowestRtt = rtt;
            optimalDrift = drift;
          }
        }
      } catch (_) {
        // Retry sample on transient timeout
      }

      // Small 50ms pause between probe samples
      await Future.delayed(const Duration(milliseconds: 50));
    }

    _cachedDriftOffsetMs = optimalDrift;
    _hasSynced = true;

    return TimeSyncResult(
      driftOffsetMs: optimalDrift,
      minRttMs: lowestRtt,
    );
  }
}
```
