# Bugfix Requirements Document

## Introduction

The attendance validation system currently contains a critical architectural security flaw that violates the zero-trust security model. The server accepts and trusts a client-provided timestamp (`client_claimed_time`) during the attendance claim validation process. This enables a modded APK to submit arbitrary timestamps to bypass the temporal verification gate in the 4-gate security model, completely undermining the zero-trust architecture documented in the SRS.

**Affected Endpoint:** `POST /api/v1/time/validate`

**Security Impact:** HIGH - Complete bypass of temporal verification gate

**Bug Condition:** `C(X) = X.client_claimed_time is provided by client`

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the client submits an attendance claim with `client_claimed_time` parameter THEN the server accepts and uses this client-provided timestamp in HMAC verification

1.2 WHEN the client submits an attendance claim with `client_claimed_time` parameter THEN the server uses this client-provided timestamp in latency verification checks (temporal gate)

1.3 WHEN a modded APK submits arbitrary past or future timestamps in `client_claimed_time` THEN the server trusts these timestamps and validates them as if they were authentic

1.4 WHEN the server performs temporal verification THEN it calculates latency using `client_claimed_time` from the request, enabling temporal gate bypass

### Expected Behavior (Correct)

2.1 WHEN the client initiates attendance validation THEN the system SHALL capture the timestamp exclusively on the server side at the moment the validation request is received

2.2 WHEN the server performs HMAC verification THEN the system SHALL use only server-captured timestamps, never accepting client-provided time values

2.3 WHEN the server performs latency verification (temporal gate) THEN the system SHALL calculate latency using exclusively server-side timestamps

2.4 WHEN a modded APK attempts to manipulate timestamps THEN the system SHALL reject the claim because the server controls all time values used in verification

2.5 WHEN the client sends validation requests THEN the system SHALL NOT accept, process, or trust any `client_claimed_time` parameter

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the client provides valid nonce and HMAC values THEN the system SHALL CONTINUE TO verify HMAC correctness

3.2 WHEN all 4 gates pass verification (temporal, cryptographic, geospatial, behavioral) THEN the system SHALL CONTINUE TO grant the attendance token

3.3 WHEN geospatial verification is performed THEN the system SHALL CONTINUE TO validate location data

3.4 WHEN behavioral analysis is performed THEN the system SHALL CONTINUE TO analyze usage patterns

3.5 WHEN legitimate clients submit attendance claims within the allowed time window THEN the system SHALL CONTINUE TO accept valid claims

3.6 WHEN the nonce has expired or been reused THEN the system SHALL CONTINUE TO reject the claim

## Bug Condition Analysis

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type AttendanceValidationRequest
  OUTPUT: boolean
  
  // Returns true when client controls the timestamp
  RETURN X.client_claimed_time IS PROVIDED BY CLIENT
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - Server-Side Timestamp Control
FOR ALL X WHERE isBugCondition(X) DO
  result ← validateAttendance'(X)
  server_timestamp ← captureServerTimestamp()
  
  ASSERT result.timestamp_source = "SERVER_ONLY" AND
         result.hmac_verification_uses_server_time = TRUE AND
         result.latency_verification_uses_server_time = TRUE AND
         X.client_claimed_time IS IGNORED
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - Non-timestamp verification unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT validateAttendance(X).hmac_valid = validateAttendance'(X).hmac_valid AND
         validateAttendance(X).nonce_valid = validateAttendance'(X).nonce_valid AND
         validateAttendance(X).geo_valid = validateAttendance'(X).geo_valid AND
         validateAttendance(X).behavioral_valid = validateAttendance'(X).behavioral_valid
END FOR
```

**Note:** Since the bug condition applies to ALL current validation requests (all contain `client_claimed_time`), the preservation focus is on ensuring the other three gates (cryptographic, geospatial, behavioral) continue to function identically.

## Counterexample

A modded APK can currently exploit this vulnerability:

```typescript
// Modded APK attack - submits timestamp from 30 minutes ago
const maliciousRequest = {
  nonce: "valid_nonce_123",
  client_claimed_time: Date.now() - (30 * 60 * 1000), // 30 minutes ago
  hmac: calculateHMAC(Date.now() - (30 * 60 * 1000) + "valid_nonce_123")
};

// Server incorrectly trusts this timestamp
// Result: Temporal gate bypassed
```

After the fix, the server will ignore `client_claimed_time` and use its own timestamp, causing the HMAC to fail verification.
