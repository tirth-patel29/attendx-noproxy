# Zero-Trust Timestamp Validation Bugfix Design

## Overview

This design addresses a critical security vulnerability in the attendance validation system where the server trusts client-provided timestamps (`client_claimed_time`), enabling modded APKs to bypass temporal verification. The fix implements true zero-trust architecture by capturing all timestamps exclusively on the server side at the moment validation requests are received.

**Key Changes:**
- Remove `client_claimed_time` parameter from validation API
- Capture `serverReceivedAt` timestamp at request entry point
- Use server timestamps for all HMAC and latency verification
- Maintain backward compatibility with migration path
- Preserve all other security gates (hardware, cryptographic, geospatial, behavioral)

**Security Impact:** Eliminates complete bypass of temporal verification gate (HIGH severity)

## Glossary

- **Bug_Condition (C)**: The condition where client controls timestamps - occurs when `client_claimed_time` is provided by client and trusted by server
- **Property (P)**: The desired zero-trust behavior - server captures and uses only its own timestamps for all verification
- **Preservation**: All non-temporal verification logic (HMAC structure, nonce validation, hardware binding, token membership) must remain unchanged
- **serverReceivedAt**: The server-side timestamp captured at the exact moment the validation request enters the endpoint handler
- **tokenBirth**: The `created_at_epoch` timestamp when metronome minted a token
- **verificationDeltaMs**: The delta `serverReceivedAt - tokenBirth` used for latency analysis and audit logging
- **Zero-Trust Architecture**: Security model where no client-provided data is trusted without server-side verification
- **Temporal Gate**: Gate 4 in the 4-gate security model - verifies timing relationship between request receipt and token birth

## Bug Details

### Bug Condition

The bug manifests when the client submits any attendance claim with the `client_claimed_time` parameter. The server accepts this client-controlled timestamp and uses it in both HMAC verification and latency calculation, enabling a modded APK to submit arbitrary timestamps to bypass temporal verification.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AttendanceValidationRequest
  OUTPUT: boolean
  
  RETURN input.client_claimed_time IS_PROVIDED
         AND server.uses(input.client_claimed_time) IN [hmac_verification, latency_calculation]
         AND NOT server.validates_timestamp_authenticity(input.client_claimed_time)
END FUNCTION
```

### Examples

**Example 1: Modded APK with Past Timestamp**
- **Input**: `{ client_claimed_time: Date.now() - (30 * 60 * 1000), token_val: "ABC1", nonce: "valid_nonce" }`
- **Current Behavior**: Server accepts timestamp from 30 minutes ago, uses it in HMAC and latency checks, grants attendance
- **Expected Behavior**: Server ignores client timestamp, uses its own `serverReceivedAt`, HMAC fails due to mismatch

**Example 2: Modded APK with Future Timestamp**
- **Input**: `{ client_claimed_time: Date.now() + (10 * 60 * 1000), token_val: "XYZ9", nonce: "valid_nonce" }`
- **Current Behavior**: Server accepts future timestamp, temporal gate passes with fabricated timing
- **Expected Behavior**: Server uses its own timestamp, temporal verification based on actual receipt time

**Example 3: Legitimate Client**
- **Input**: Legitimate APK submitting claim within 5-second window
- **Current Behavior**: Works correctly (timestamp happens to be accurate)
- **Expected Behavior**: MUST continue to work - server captures timestamp at receipt, validates based on actual timing

**Example 4: Replay Attack**
- **Input**: Attacker captures valid request and replays with original `client_claimed_time`
- **Current Behavior**: Fails on nonce reuse (correct), but temporal gate could be bypassed with new nonce
- **Expected Behavior**: Server timestamp ensures temporal gate failure even with fresh nonce

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- HMAC verification MUST continue to validate cryptographic signatures (Gate 4 cryptographic component)
- Nonce single-use enforcement MUST continue to prevent replay attacks (Gate 4 anti-replay component)
- Hardware binding MUST continue to validate device_id_hash matches bound_device_id (Gate 1)
- Token membership validation MUST continue to verify token exists and was live (Gate 3)
- Geospatial verification MUST continue to validate location data when implemented (Gate 2 future)
- Behavioral analysis MUST continue to analyze usage patterns when implemented (Gate 2 future)
- Audit logging MUST continue to record all claim attempts with outcomes
- Idempotent ledger insertion MUST continue (UNIQUE constraint on session_uuid, student_uuid)

**Scope:**
All inputs that involve attendance validation will experience the timestamp capture change, but the core security logic for cryptographic verification, nonce validation, hardware binding, and token membership MUST remain functionally identical. The only change is **who** provides the timestamp used in verification - shifting from client-controlled to server-controlled.

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Insufficient Zero-Trust Architecture**: The original implementation accepted `client_claimed_time` as a convenience parameter for client-side timestamping without recognizing it as a security vulnerability. The parameter was intended to help with latency calculation but became a trust boundary violation.

2. **HMAC Payload Includes Client Timestamp**: The HMAC signature includes `client_claimed_time` in its canonical string, creating a dependency where both client and server must use the same timestamp. This design couples cryptographic verification to client-provided timing.

3. **Latency Verification Uses Client Time**: The temporal gate calculates `verificationDeltaMs = client_claimed_time - tokenBirth`, trusting that `client_claimed_time` represents when the client genuinely observed the token. A modded APK can forge this value.

4. **Missing Server-Side Timestamp Capture**: The `/time/validate` endpoint receives the request but immediately trusts `client_claimed_time` rather than capturing `Date.now()` at the entry point and using that as the authoritative timestamp.

5. **API Contract Design Flaw**: The API was designed with `client_claimed_time` as a required field in the payload schema, embedding the vulnerability into the public contract.

## Correctness Properties

Property 1: Bug Condition - Server-Side Timestamp Control

_For any_ attendance validation request where `client_claimed_time` was previously provided by the client, the fixed validation endpoint SHALL capture the timestamp exclusively on the server side (`serverReceivedAt = Date.now()`) at the moment the request is received, and SHALL use this server timestamp for all verification logic including HMAC validation and latency calculation, completely ignoring any client-provided time values.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Non-Temporal Verification Gates

_For any_ attendance validation request, the fixed validation logic SHALL perform HMAC verification, nonce single-use enforcement, hardware binding validation, and token membership validation with exactly the same logic and outcomes as the original implementation, preserving all cryptographic, anti-replay, hardware tattoo, and token lookup behaviors.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix involves removing client timestamp trust and implementing server-side timestamp capture.

**File**: `backend/src/routes/attendance.ts`

**Endpoint**: `POST /time/validate`

**Specific Changes**:

1. **Capture Server Timestamp at Entry Point**:
   - Add `const serverReceivedAt = Date.now();` as the first line in the `/time/validate` handler
   - This timestamp represents the authoritative "when" for verification

2. **Remove client_claimed_time from Payload Usage**:
   - Stop extracting `client_claimed_time` from `req.body` for verification purposes
   - Mark the field as deprecated in schema validation
   - Use `serverReceivedAt` in all downstream verification calls

3. **Update Judge Service Call**:
   - Pass `serverReceivedAt` to `judgeService.processClaim()` instead of `client_claimed_time`
   - Modify payload to use server timestamp

4. **Maintain Backward Compatibility (Phase 1)**:
   - Keep `client_claimed_time` in schema as optional (not required)
   - Accept it in payload but ignore it (logged for audit only)
   - Add response header `X-Timestamp-Mode: server-captured` to signal new behavior

5. **Update Response Structure**:
   - Add `server_received_at` field to success response
   - Include `timestamp_mode: "server"` in response body
   - Maintain existing `verification_delta_ms` calculation using server timestamp

**File**: `backend/src/services/judge.ts`

**Interface**: `AttendanceClaimPayload`

**Specific Changes**:

1. **Modify AttendanceClaimPayload Interface**:
   - Change `client_claimed_time: number` to `server_received_at: number`
   - Add comment: "// Server-captured timestamp at request receipt (ms since epoch)"
   - Remove misleading "TrueObservedTime" comment

2. **Update processClaim Method Signature**:
   - Accept `server_received_at` in payload instead of `client_claimed_time`
   - Use `server_received_at` for all timing calculations

3. **Update HMAC Verification Call**:
   - Pass `server_received_at` to `verifyHmac()` in the canonical payload
   - Ensure HMAC structure uses server timestamp: `{ session_uuid, student_uuid, token_val, server_received_at, device_id_hash, nonce }`

4. **Update Latency Calculation**:
   - Change `verificationDeltaMs = claimed - birth` to `verificationDeltaMs = server_received_at - birth`
   - This now represents actual server-observed latency, not client-claimed latency

5. **Update Freshness Check (Rule a)**:
   - Change all references from `claimed` to `server_received_at` in freshness validation
   - `if (server_received_at > now + tol || now - server_received_at > config.judge.maxAckDelayMs)`

6. **Update Membership Check (Rule b)**:
   - Change all references from `claimed` to `server_received_at` in token membership validation
   - `if (server_received_at < birth - tol || server_received_at >= birthWindowEnd + tol)`

7. **Update Ledger Insertion**:
   - Store `server_received_at` in `client_claimed_time` column (column rename in future migration)
   - Add `server_received_at` as separate field in ledger if schema supports it

8. **Update Audit Logging**:
   - Log `server_received_at` in all audit events
   - Include `timestamp_mode: "server"` in audit payload

**File**: `backend/src/utils/crypto.ts`

**Function**: `verifyHmac()`

**Specific Changes**:

1. **Update Canonical Payload Structure**:
   - Accept `server_received_at` in payload parameter instead of `client_claimed_time`
   - Construct canonical string: `${session_uuid}|${student_uuid}|${token_val}|${server_received_at}|${device_id_hash}|${nonce}`

2. **Maintain Field Order Consistency**:
   - Keep the same field order to preserve HMAC structure
   - Document that timestamp is now server-controlled

**File**: `docs/CLIENT_INTEGRATION_GUIDE.md` (to be created/updated)

**Section**: API Contract Changes

**Specific Changes**:

1. **Deprecation Notice**:
   - Document that `client_claimed_time` is deprecated and ignored
   - Clients SHOULD omit it in new implementations
   - Existing clients MAY continue sending it (backwards compatibility)

2. **New Integration Pattern**:
   - Clients MUST send HMAC with `server_received_at` placeholder set to `0` or omit timestamp from HMAC
   - Alternatively: Server provides `/challenge` endpoint that returns pre-computed HMAC data

3. **Migration Path**:
   - **Phase 1** (Current): Server accepts `client_claimed_time`, ignores it, uses `serverReceivedAt`, validates with server timestamp
   - **Phase 2** (Future): Server requires clients to omit `client_claimed_time` or sends error if present
   - **Phase 3** (Future): Remove field entirely from schema

### Alternative: Challenge-Response Architecture

An alternative approach that preserves cryptographic soundness without changing HMAC structure:

**Challenge-Response Flow**:
1. Client requests challenge: `GET /sessions/:sessionUuid/challenge`
2. Server responds with: `{ nonce, server_time, expires_at }`
3. Client constructs HMAC with `server_time` from challenge (not local time)
4. Client submits claim with `nonce` and HMAC
5. Server validates using its challenge record (timestamp already known)

**Benefits**:
- No timestamp in claim payload at all
- HMAC uses server-provided timestamp from challenge
- Backward incompatible (requires client update)

**Decision**: Implement direct server-side capture first (simpler, no protocol change), consider challenge-response for Phase 2 if needed.

### Database Schema Considerations

**Current Schema**:
```sql
CREATE TABLE attendance_ledger (
  ledger_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uuid UUID NOT NULL REFERENCES course_sessions(session_uuid),
  student_uuid UUID NOT NULL REFERENCES students(student_uuid),
  client_claimed_time BIGINT,
  server_logged_time TIMESTAMP DEFAULT NOW(),
  verification_delta_ms INT,
  status VARCHAR(20) NOT NULL,
  UNIQUE(session_uuid, student_uuid)
);
```

**Migration Path**:
- **Phase 1**: Reuse `client_claimed_time` column to store `serverReceivedAt` (no schema change needed)
- **Phase 2**: Rename column to `server_received_at_epoch` for clarity
- **Phase 3**: Add separate `client_claimed_time` column for audit/comparison purposes

**No immediate schema changes required** - column semantics change but type remains compatible.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate a modded APK submitting forged timestamps to the UNFIXED `/time/validate` endpoint. Run these tests on the current vulnerable code to observe that temporal gate bypass succeeds, confirming the vulnerability is exploitable.

**Test Cases**:

1. **Past Timestamp Attack Test**: Submit a claim with `client_claimed_time` set to 30 minutes in the past with a freshly minted token. Assert that the unfixed code ACCEPTS the claim (vulnerability confirmed). The fixed code MUST reject this because the HMAC won't match (client used old timestamp, server uses current timestamp).

2. **Future Timestamp Attack Test**: Submit a claim with `client_claimed_time` set to 10 minutes in the future. Assert that the unfixed code ACCEPTS the claim if the token is valid (vulnerability confirmed). The fixed code MUST use `serverReceivedAt`, making the timestamp mismatch fail HMAC verification.

3. **Extreme Latency Forgery Test**: Submit a claim with `client_claimed_time` exactly at token birth (`tokenBirth + 10ms`) to fake zero latency. Assert that the unfixed code accepts it with near-zero `verificationDeltaMs` (vulnerability confirmed). The fixed code MUST calculate latency based on actual `serverReceivedAt - tokenBirth`.

4. **Replay Window Extension Test**: Capture a legitimate claim, wait 10 seconds (beyond normal freshness window), replay with original `client_claimed_time` but new nonce. Assert that the unfixed code accepts it if the token is still valid (vulnerability confirmed). The fixed code MUST reject based on `serverReceivedAt` freshness check.

**Expected Counterexamples**:
- Unfixed code will grant attendance for claims with forged past/future timestamps
- `verificationDeltaMs` will reflect the forged timing, not actual server timing
- Temporal gate will be completely bypassable with arbitrary `client_claimed_time` values
- Possible causes confirmed: server trusts client timestamp, HMAC uses client timestamp, latency calculated from client timestamp

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (client attempts to control timestamp), the fixed function produces the expected behavior (server controls timestamp).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  // input.client_claimed_time is forged (past, future, or manipulated)
  serverReceivedAt := captureServerTimestamp()
  result := processClaimFixed(input, serverReceivedAt)
  
  ASSERT result.timestamp_used = serverReceivedAt
  ASSERT result.hmac_verified_with_server_timestamp = TRUE
  ASSERT result.verification_delta_ms = (serverReceivedAt - tokenBirth)
  ASSERT input.client_claimed_time IS_IGNORED
  ASSERT result.status IN ['PRESENT', 'FORGED_RESPONSE', 'EXPIRED_TOKEN', 'STREAM_DETECTED']
    // Depends on whether HMAC matches, token valid, timing within bounds
END FOR
```

**Test Cases**:

1. **Server Timestamp Used for HMAC Test**: Submit a claim with valid HMAC computed using `serverReceivedAt` (simulate fixed client). Assert that the fixed code accepts the claim and `verificationDeltaMs` reflects actual server timing.

2. **Client Timestamp Ignored Test**: Submit a claim with `client_claimed_time` set to a forged value AND valid HMAC for server timestamp. Assert that `client_claimed_time` appears in audit logs but is not used in any verification logic.

3. **Latency Calculated from Server Time Test**: Mock `Date.now()` to control `serverReceivedAt`, submit claim, assert that `verificationDeltaMs = serverReceivedAt - tokenBirth` regardless of any client-provided timestamp.

4. **Freshness Check Uses Server Time Test**: Mock `serverReceivedAt` to be `now + 600ms` (within tolerance), submit claim, assert that freshness check passes. Then mock `serverReceivedAt` to be `now + 6000ms` (beyond maxAckDelay), assert that freshness check fails with `ERR_STREAM_DETECTED`.

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold in terms of affecting other gates, the fixed function produces the same security outcomes as the original function for non-temporal verification.

**Pseudocode:**
```
FOR ALL input WHERE validInput(input) DO
  // Valid input means: legitimate token, valid HMAC, hardware match, fresh nonce
  resultOriginal := processClaimOriginal(input)
  resultFixed := processClaimFixed(input)
  
  // Security gates other than temporal should behave identically
  ASSERT resultOriginal.hmac_valid = resultFixed.hmac_valid
  ASSERT resultOriginal.nonce_valid = resultFixed.nonce_valid
  ASSERT resultOriginal.hardware_match = resultFixed.hardware_match
  ASSERT resultOriginal.token_membership = resultFixed.token_membership
  ASSERT resultOriginal.ledger_idempotent = resultFixed.ledger_idempotent
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-temporal aspects of verification

**Test Plan**: Observe behavior on UNFIXED code first for HMAC validation, nonce validation, hardware binding, token lookup, and ledger insertion, then write property-based tests capturing that behavior. Verify the fixed code produces identical outcomes for these gates.

**Test Cases**:

1. **HMAC Verification Preservation Test**: Generate 100 random valid attendance claims with correct HMAC signatures (computed with appropriate timestamp). Assert that both unfixed and fixed code validate HMAC successfully when signature is correct, and reject when signature is invalid.

2. **Nonce Single-Use Preservation Test**: Submit the same claim twice (same nonce). Assert that both unfixed and fixed code accept the first claim and reject the second with `ERR_NONCE_USED`.

3. **Hardware Binding Preservation Test**: Generate claims with mismatched `device_id_hash` (not matching `bound_device_id`). Assert that both unfixed and fixed code reject with `ERR_HW_MISMATCH`.

4. **Token Membership Preservation Test**: Generate claims with non-existent token values. Assert that both unfixed and fixed code reject with `ERR_TOKEN_EXPIRED`.

5. **Ledger Idempotency Preservation Test**: Submit duplicate claims (same session_uuid + student_uuid). Assert that both unfixed and fixed code insert once and return "Attendance already logged" on subsequent attempts.

6. **Audit Logging Preservation Test**: Submit various claims (valid, invalid, failed gates). Assert that both unfixed and fixed code log audit events with same structure and content (except timestamp source field).

### Unit Tests

- Test server timestamp capture at entry point of `/time/validate` endpoint
- Test that `serverReceivedAt` is passed correctly to `judgeService.processClaim()`
- Test HMAC verification with server timestamp in canonical string
- Test latency calculation using `serverReceivedAt - tokenBirth`
- Test freshness check logic with `serverReceivedAt` variable
- Test membership check logic with `serverReceivedAt` variable
- Test that `client_claimed_time` from request body is ignored (not used in verification)
- Test audit logging includes both `serverReceivedAt` and `client_claimed_time` (for comparison)
- Test response includes `server_received_at` and `timestamp_mode` fields

### Property-Based Tests

- Generate random attendance claims with forged timestamps (past, future, extreme values) and verify all are handled using `serverReceivedAt`
- Generate random valid claims and verify `verificationDeltaMs` is always calculated from server timestamp
- Generate random game states (active sessions, expired tokens, used nonces) and verify non-temporal gates behave identically
- Generate random hardware binding scenarios and verify Gate 1 logic is preserved
- Generate random HMAC validity scenarios and verify Gate 4 cryptographic verification is preserved

### Integration Tests

- Test full claim flow with legitimate client (valid HMAC using server timestamp placeholder)
- Test full claim flow with modded APK (forged timestamp in payload) - should fail HMAC verification
- Test migration path: client sends `client_claimed_time` but server ignores it
- Test backward compatibility: old clients continue to work if HMAC structure updated
- Test audit trail: verify all claim attempts are logged with correct timestamp source
- Test performance: verify server timestamp capture adds negligible latency (<1ms)
- Test concurrent claims: verify `serverReceivedAt` is captured independently per request

## Migration and Rollout Strategy

### Phase 1: Server-Side Fix (Immediate)

**Objective**: Deploy server-side timestamp capture without requiring client changes.

**Steps**:
1. Implement `serverReceivedAt = Date.now()` capture in `/time/validate`
2. Update `judgeService.processClaim()` to use server timestamp
3. Keep `client_claimed_time` in schema as optional (backward compatibility)
4. Add response headers and fields indicating new behavior
5. Deploy server update (zero downtime, existing clients continue working)

**Client Impact**: 
- **Existing clients with honest timestamps**: Continue working (HMAC happens to match)
- **Modded APKs with forged timestamps**: Start failing (HMAC mismatch)
- **No client update required immediately**

### Phase 2: Client Update (Follow-up)

**Objective**: Update legitimate clients to align with new server behavior.

**Steps**:
1. Update APK to omit `client_claimed_time` from payload
2. Update HMAC calculation to use server-provided timestamp from challenge (if using challenge-response)
3. Update client integration guide with new API contract
4. Release updated APK to students

**Timeline**: 2-4 weeks after Phase 1 deployment

### Phase 3: Strict Enforcement (Future)

**Objective**: Remove deprecated `client_claimed_time` field entirely.

**Steps**:
1. Server returns error if `client_claimed_time` is present in payload
2. Remove field from schema validation
3. Rename database column from `client_claimed_time` to `server_received_at_epoch`

**Timeline**: 3-6 months after Phase 2 (when all clients updated)

### Rollback Plan

If issues arise during Phase 1:
1. Revert to trusting `client_claimed_time` (old behavior)
2. Investigate HMAC mismatch root cause
3. Consider alternative approaches (challenge-response, timestamp synchronization)

**Rollback Criteria**:
- Legitimate client success rate drops below 95%
- False positive rate for temporal gate exceeds 5%
- Performance degradation exceeds 10ms p95 latency

### Monitoring and Observability

**Metrics to Track**:
- Claim success rate (overall and by error code)
- `verification_delta_ms` distribution (before vs after fix)
- HMAC verification failure rate
- Temporal gate rejection rate (`ERR_STREAM_DETECTED`, `ERR_TOKEN_EXPIRED`)
- Audit log entries with `timestamp_mode: server` vs `timestamp_mode: client`

**Alerting**:
- Alert if claim success rate drops >10% after deployment
- Alert if `ERR_SIG_INVALID` rate increases significantly (indicates HMAC mismatch issues)
- Alert if `verificationDeltaMs` values become unrealistic (indicates timestamp capture bug)

## Security Analysis

### Attack Surface Changes

**Before Fix**:
- Attacker controls `client_claimed_time` parameter
- Temporal gate can be bypassed with arbitrary timestamps
- Latency calculation is meaningless (forged)
- HMAC includes client-controlled time value

**After Fix**:
- Attacker cannot control timestamp used in verification
- Temporal gate enforced based on actual server-observed timing
- Latency calculation reflects real network/processing delay
- HMAC uses server-controlled timestamp (clients must adapt)

### Remaining Attack Vectors

1. **Clock Skew Attack**: If client and server clocks are significantly out of sync, legitimate clients may fail. **Mitigation**: `clockToleranceMs = 500ms` provides cushion.

2. **Network Latency Attack**: High latency (>5 seconds) will cause legitimate claims to fail freshness check. **Mitigation**: `maxAckDelayMs = 5000ms` is generous enough for real deployments.

3. **Token Prediction Attack**: Attacker tries to predict future tokens to pre-compute HMAC. **Mitigation**: Tokens are cryptographically random (not predictable).

4. **Replay Attack**: Attacker captures and replays valid request. **Mitigation**: Nonce single-use enforcement (unchanged).

5. **HMAC Key Compromise**: Attacker obtains student's `secret_hmac_key` and computes valid signatures. **Mitigation**: Out of scope for this fix (key management issue).

### Zero-Trust Compliance

After the fix:
- ✅ **Server never trusts client time values** - timestamp captured server-side only
- ✅ **All verification uses server-controlled data** - HMAC, latency, freshness all server-authoritative
- ✅ **Client cannot manipulate temporal gate** - forged timestamps are ignored
- ✅ **Audit trail reflects actual server timing** - `serverReceivedAt` logged for all claims
- ✅ **Defense in depth maintained** - 4 gates remain independent (hardware, crypto, token, temporal)

## Performance Considerations

### Added Latency

- **Timestamp capture**: `Date.now()` is a native call, <0.1ms overhead
- **No additional database queries**: Reuses existing queries
- **No additional cryptographic operations**: HMAC structure unchanged (same fields, different source)

**Expected Impact**: <1ms added latency (negligible)

### Database Impact

- **No schema changes required in Phase 1**: Reuse `client_claimed_time` column
- **No additional writes**: Ledger insertion unchanged
- **No additional reads**: Queries unchanged

**Expected Impact**: Zero database performance change

### Memory and CPU

- **Single integer variable added**: `serverReceivedAt` (8 bytes per request)
- **No additional loops or iterations**: Logic flow unchanged
- **No additional string manipulation**: Canonical HMAC string construction identical

**Expected Impact**: Negligible memory and CPU overhead

### Scalability

The fix maintains O(1) complexity for all operations. No new bottlenecks introduced. Server-side timestamp capture is inherently more scalable than trusting client timestamps (no validation overhead).

## Open Questions and Risks

### Open Questions

1. **HMAC Migration Strategy**: Should we support both old (client timestamp) and new (server timestamp) HMAC signatures during transition?
   - **Recommendation**: No - deploy server fix immediately, let HMAC mismatches occur for modded APKs only. Legitimate clients with accurate clocks will continue working.

2. **Challenge-Response Adoption**: Should we implement challenge-response architecture for Phase 2?
   - **Recommendation**: Evaluate after Phase 1 deployment. If legitimate client success rate is high (>95%), stick with direct server capture. If issues arise, consider challenge-response.

3. **Timestamp in Ledger**: Should we rename `client_claimed_time` column or add new `server_received_at_epoch` column?
   - **Recommendation**: Reuse column in Phase 1 (zero migration cost), rename in Phase 3 after client migration complete.

4. **Backward Compatibility Duration**: How long should we maintain optional `client_claimed_time` in schema?
   - **Recommendation**: 6 months (two academic semesters), giving ample time for all clients to update.

### Risks

1. **Risk: Legitimate Clients Fail HMAC Verification**
   - **Likelihood**: Low (if client clocks are synchronized)
   - **Impact**: High (attendance claims rejected)
   - **Mitigation**: Phase 1 should show immediate impact on modded APKs only. Monitor success rate closely. If issues arise, implement challenge-response in Phase 2.

2. **Risk: Clock Tolerance Too Tight**
   - **Likelihood**: Medium (real deployments have jitter)
   - **Impact**: Medium (increased false positives)
   - **Mitigation**: Current `clockToleranceMs = 500ms` is based on measured deployment profile. Tune if needed.

3. **Risk: Client Update Adoption Slow**
   - **Likelihood**: Medium (students may not update APK)
   - **Impact**: Low (Phase 1 works without client update)
   - **Mitigation**: Maintain backward compatibility in Phase 1/2, only enforce in Phase 3.

4. **Risk: Audit Logs Missing Client Timestamp for Forensics**
   - **Likelihood**: Low (we can log both)
   - **Impact**: Medium (less debugging info)
   - **Mitigation**: Continue logging `client_claimed_time` from request body in audit logs (ignored for verification, kept for analysis).

## Success Criteria

The fix is considered successful if:

1. ✅ **Security**: Modded APKs with forged timestamps are rejected (HMAC mismatch or temporal gate failure)
2. ✅ **Functionality**: Legitimate clients continue to successfully claim attendance (success rate ≥95%)
3. ✅ **Performance**: Added latency is <1ms p95
4. ✅ **Zero-Trust**: All verification uses server-controlled timestamps (no client time values trusted)
5. ✅ **Auditability**: Audit logs reflect server timing accurately
6. ✅ **Preservation**: All non-temporal security gates function identically (HMAC validation, nonce enforcement, hardware binding, token membership)
7. ✅ **Monitoring**: Metrics show clear distinction between legitimate claims and attack attempts

## Appendix: Code Snippets

### Before (Vulnerable)

```typescript
// routes/attendance.ts - BEFORE (vulnerable)
router.post('/time/validate', requireApiKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_uuid, student_uuid, token_val, device_id_hash, nonce, hmac_signature, client_claimed_time } = req.body;
    
    // BUG: Trusting client timestamp
    const result = await judgeService.processClaim({
      session_uuid,
      student_uuid,
      token_val,
      client_claimed_time, // ❌ Client-controlled
      device_id_hash,
      nonce,
      hmac_signature,
    });
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

### After (Fixed)

```typescript
// routes/attendance.ts - AFTER (fixed)
router.post('/time/validate', requireApiKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ Capture server timestamp at entry point (zero-trust)
    const serverReceivedAt = Date.now();
    
    const { session_uuid, student_uuid, token_val, device_id_hash, nonce, hmac_signature, client_claimed_time } = req.body;
    
    // Log client timestamp for audit (ignored for verification)
    if (client_claimed_time) {
      console.debug(`Client claimed time: ${client_claimed_time}, Server received: ${serverReceivedAt}, Drift: ${serverReceivedAt - client_claimed_time}ms`);
    }
    
    const result = await judgeService.processClaim({
      session_uuid,
      student_uuid,
      token_val,
      server_received_at: serverReceivedAt, // ✅ Server-controlled
      device_id_hash,
      nonce,
      hmac_signature,
    });
    
    // Signal new behavior to client
    res.setHeader('X-Timestamp-Mode', 'server-captured');
    res.json({
      ...result,
      server_received_at: serverReceivedAt,
      timestamp_mode: 'server',
    });
  } catch (err) {
    next(err);
  }
});
```

### HMAC Verification Changes

```typescript
// services/judge.ts - BEFORE
const hmacValid = verifyHmac(student.secret_hmac_key, {
  session_uuid: payload.session_uuid,
  student_uuid: payload.student_uuid,
  token_val: payload.token_val,
  client_claimed_time: payload.client_claimed_time, // ❌ Client-controlled
  device_id_hash: payload.device_id_hash,
  nonce: payload.nonce,
}, payload.hmac_signature);

// services/judge.ts - AFTER
const hmacValid = verifyHmac(student.secret_hmac_key, {
  session_uuid: payload.session_uuid,
  student_uuid: payload.student_uuid,
  token_val: payload.token_val,
  server_received_at: payload.server_received_at, // ✅ Server-controlled
  device_id_hash: payload.device_id_hash,
  nonce: payload.nonce,
}, payload.hmac_signature);
```

### Latency Calculation Changes

```typescript
// services/judge.ts - BEFORE
const verificationDeltaMs = payload.client_claimed_time - birth; // ❌ Forgeable

// services/judge.ts - AFTER
const verificationDeltaMs = payload.server_received_at - birth; // ✅ Authentic
```
