# Implementation Plan

## Overview

This task list implements the zero-trust timestamp validation bugfix using the exploratory bugfix workflow. The fix eliminates the critical security vulnerability where clients can manipulate timestamps to bypass temporal verification (Gate 4) by shifting to server-side timestamp capture.

**Workflow Phases:**
1. **Explore** - Write tests BEFORE fix to understand the bug (Bug Condition)
2. **Preserve** - Write tests for non-buggy behavior (Preservation Requirements)
3. **Implement** - Apply the fix with understanding (Expected Behavior)
4. **Validate** - Verify fix works and doesn't break anything

---

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Client Timestamp Manipulation Attack
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the timestamp manipulation vulnerability
  - **Scoped PBT Approach**: Test concrete attack scenarios (past timestamp, future timestamp, extreme latency forgery) to ensure reproducibility
  - Create test file: `backend/src/__tests__/bugfix/timestamp-security.exploration.test.ts`
  - Test implementation details from Bug Condition in design:
    - **Test Case 1**: Past Timestamp Attack - Submit claim with `client_claimed_time` set to 30 minutes ago with fresh token
    - **Test Case 2**: Future Timestamp Attack - Submit claim with `client_claimed_time` set to 10 minutes in future
    - **Test Case 3**: Extreme Latency Forgery - Submit claim with `client_claimed_time` exactly at token birth to fake zero latency
    - **Test Case 4**: Replay Window Extension - Replay claim with stale `client_claimed_time` but fresh nonce
  - The test assertions should match the Expected Behavior Properties from design:
    - Assert that unfixed code ACCEPTS forged timestamps (vulnerability confirmed)
    - Assert that unfixed code calculates `verificationDeltaMs` from client timestamp (forgeable)
    - Assert that temporal gate can be bypassed with arbitrary timestamps
  - Run test on UNFIXED code against current `/api/v1/time/validate` endpoint
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause:
    - Record which attack scenarios succeed on unfixed code
    - Record actual `verificationDeltaMs` values (should reflect forged timing)
    - Record whether temporal gate is bypassed for each scenario
  - Mark task complete when test is written, run, and failure is documented
  - _Bug_Condition: C(X) = X.client_claimed_time IS_PROVIDED AND server.uses(X.client_claimed_time) IN [hmac_verification, latency_calculation]_
  - _Expected_Behavior: Server captures serverReceivedAt, uses it for all verification, ignores client_claimed_time_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Temporal Security Gates
  - **IMPORTANT**: Follow observation-first methodology
  - Create test file: `backend/src/__tests__/bugfix/timestamp-security.preservation.test.ts`
  - Observe behavior on UNFIXED code for non-buggy inputs (non-temporal verification):
    - Run legitimate claims with valid HMAC and observe HMAC validation passes
    - Run claims with invalid HMAC and observe rejection with ERR_SIG_INVALID
    - Run claims with reused nonce and observe rejection with ERR_NONCE_USED
    - Run claims with mismatched device_id_hash and observe rejection with ERR_HW_MISMATCH
    - Run claims with invalid token and observe rejection with ERR_TOKEN_EXPIRED
    - Run duplicate claims (same session_uuid + student_uuid) and observe idempotent ledger insertion
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - **PBT 1**: HMAC Verification Preservation - Generate 100 random claims with valid/invalid HMAC, verify same acceptance/rejection logic
    - **PBT 2**: Nonce Single-Use Preservation - Generate random claims, verify second submission with same nonce is rejected
    - **PBT 3**: Hardware Binding Preservation - Generate claims with mismatched device_id_hash, verify ERR_HW_MISMATCH
    - **PBT 4**: Token Membership Preservation - Generate claims with non-existent tokens, verify ERR_TOKEN_EXPIRED
    - **PBT 5**: Ledger Idempotency Preservation - Generate duplicate claims, verify single ledger insertion
    - **PBT 6**: Audit Logging Preservation - Generate various claim types, verify audit events logged with same structure
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Preservation: All non-temporal gates (HMAC, nonce, hardware, token) must behave identically_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Implement server-side timestamp capture and validation

  - [ ] 3.1 Update `/api/v1/time/validate` endpoint to capture server timestamp
    - Open file: `backend/src/routes/attendance.ts`
    - Locate the `POST /time/validate` route handler
    - Add `const serverReceivedAt = Date.now();` as the first line in the handler (zero-trust timestamp capture)
    - Extract `client_claimed_time` from `req.body` but mark it as optional/deprecated
    - Add debug logging: `console.debug('Client claimed time: ${client_claimed_time}, Server received: ${serverReceivedAt}, Drift: ${serverReceivedAt - client_claimed_time}ms');`
    - Update `judgeService.processClaim()` call to pass `server_received_at: serverReceivedAt` instead of `client_claimed_time`
    - Add response header: `res.setHeader('X-Timestamp-Mode', 'server-captured');`
    - Add `server_received_at` and `timestamp_mode: 'server'` fields to success response JSON
    - Keep `client_claimed_time` in request schema for backward compatibility (Phase 1 migration strategy)
    - _Bug_Condition: isBugCondition(input) = input.client_claimed_time IS_PROVIDED_
    - _Expected_Behavior: serverReceivedAt = Date.now() at request entry, used for all verification_
    - _Preservation: Response structure maintains existing fields, adds new fields_
    - _Requirements: 2.1, 2.5_

  - [ ] 3.2 Update judge service to use server timestamps
    - Open file: `backend/src/services/judge.ts`
    - Locate the `AttendanceClaimPayload` interface
    - Change `client_claimed_time: number` to `server_received_at: number`
    - Add comment: `// Server-captured timestamp at request receipt (ms since epoch)`
    - Remove misleading "TrueObservedTime" comment if present
    - Update `processClaim()` method signature to accept `server_received_at` in payload
    - Update HMAC verification call to pass `server_received_at` instead of `client_claimed_time`
    - Update latency calculation: `verificationDeltaMs = server_received_at - birth` (not `client_claimed_time - birth`)
    - Update freshness check (Rule a): Change all references from `claimed` to `server_received_at`
    - Update membership check (Rule b): Change all references from `claimed` to `server_received_at`
    - Update ledger insertion: Store `server_received_at` in `client_claimed_time` column (Phase 1 reuse, rename in Phase 3)
    - Update audit logging: Log `server_received_at` and add `timestamp_mode: "server"` to audit payload
    - _Bug_Condition: isBugCondition(input) where input controls timestamp_
    - _Expected_Behavior: All verification uses server_received_at, never trusts client timestamp_
    - _Preservation: HMAC structure, nonce validation, hardware binding logic unchanged_
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ] 3.3 Update HMAC verification to use server timestamp
    - Open file: `backend/src/utils/crypto.ts`
    - Locate the `verifyHmac()` function
    - Update canonical payload structure to accept `server_received_at` instead of `client_claimed_time`
    - Construct canonical string: `${session_uuid}|${student_uuid}|${token_val}|${server_received_at}|${device_id_hash}|${nonce}`
    - Maintain field order consistency (same order, different source)
    - Add comment documenting that timestamp is now server-controlled
    - _Bug_Condition: isBugCondition(input) where HMAC uses client timestamp_
    - _Expected_Behavior: HMAC canonical string uses server_received_at only_
    - _Preservation: Canonical string structure and field order unchanged_
    - _Requirements: 2.2_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Server-Side Timestamp Control
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (server controls timestamps)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run exploration test: `backend/src/__tests__/bugfix/timestamp-security.exploration.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify that forged client timestamps are now ignored:
      - Past timestamp attack should fail HMAC verification or temporal gate
      - Future timestamp attack should fail HMAC verification or temporal gate
      - Extreme latency forgery should show actual server latency, not forged
      - Replay window extension should fail based on serverReceivedAt freshness
    - Verify `verificationDeltaMs` reflects actual server timing (serverReceivedAt - tokenBirth)
    - Verify audit logs show `timestamp_mode: "server"` and `serverReceivedAt` values
    - Document that counterexamples from task 1 are now properly handled
    - _Expected_Behavior: For all inputs where C(X) holds, server controls timestamp and uses it for verification_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Temporal Security Gates
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation test suite: `backend/src/__tests__/bugfix/timestamp-security.preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify all property-based tests still pass:
      - HMAC verification logic produces same outcomes (valid/invalid)
      - Nonce single-use enforcement unchanged (ERR_NONCE_USED)
      - Hardware binding validation unchanged (ERR_HW_MISMATCH)
      - Token membership validation unchanged (ERR_TOKEN_EXPIRED)
      - Ledger idempotency unchanged (single insertion per session+student)
      - Audit logging structure unchanged (same fields, additional timestamp info)
    - Confirm all non-temporal security gates function identically
    - _Preservation: HMAC, nonce, hardware, token gates behave exactly as before fix_
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Create comprehensive test suites

  - [ ] 4.1 Create fix checking unit tests
    - Create test file: `backend/src/__tests__/unit/timestamp-fix-checking.test.ts`
    - Test server timestamp capture at entry point of `/time/validate` endpoint
    - Test that `serverReceivedAt` is passed correctly to `judgeService.processClaim()`
    - Test HMAC verification with server timestamp in canonical string
    - Test latency calculation using `serverReceivedAt - tokenBirth`
    - Test freshness check logic with `serverReceivedAt` variable
    - Test membership check logic with `serverReceivedAt` variable
    - Test that `client_claimed_time` from request body is ignored (not used in verification)
    - Test audit logging includes both `serverReceivedAt` and `client_claimed_time` (for comparison)
    - Test response includes `server_received_at` and `timestamp_mode` fields
    - _Expected_Behavior: All unit tests validate server controls timestamps_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 4.2 Create fix checking property-based tests
    - Create test file: `backend/src/__tests__/property/timestamp-fix-pbt.test.ts`
    - Use fast-check or similar PBT library for TypeScript
    - Generate random attendance claims with forged timestamps (past, future, extreme values)
    - Verify all are handled using `serverReceivedAt` (client timestamp ignored)
    - Generate random valid claims and verify `verificationDeltaMs` is always calculated from server timestamp
    - Generate edge cases: serverReceivedAt at boundaries (clockTolerance, maxAckDelay)
    - Verify response always includes `server_received_at` and `timestamp_mode: "server"`
    - _Expected_Behavior: Universal property holds - server timestamp used for all verification_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 4.3 Create integration tests for full claim flow
    - Create test file: `backend/src/__tests__/integration/timestamp-integration.test.ts`
    - Test full claim flow with legitimate client (valid HMAC using server timestamp)
    - Test full claim flow with modded APK (forged timestamp in payload) - should fail HMAC verification
    - Test migration path: client sends `client_claimed_time` but server ignores it
    - Test backward compatibility: old clients with accurate clocks continue to work
    - Test audit trail: verify all claim attempts are logged with correct timestamp source
    - Test concurrent claims: verify `serverReceivedAt` is captured independently per request
    - Test performance: verify server timestamp capture adds negligible latency (<1ms)
    - _Expected_Behavior: End-to-end flows work correctly with server timestamps_
    - _Preservation: Legitimate clients continue to work (success rate ≥95%)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 5. Update client integration documentation

  - [ ] 5.1 Create/update CLIENT_INTEGRATION_GUIDE.md
    - Create file: `docs/CLIENT_INTEGRATION_GUIDE.md`
    - Add section: "API Contract Changes - Zero-Trust Timestamp Validation"
    - Document deprecation notice:
      - `client_claimed_time` is deprecated and ignored by server
      - Clients SHOULD omit it in new implementations
      - Existing clients MAY continue sending it (backwards compatibility Phase 1)
    - Document new integration pattern:
      - Server captures `serverReceivedAt` automatically
      - Clients no longer need to provide timestamp in HMAC calculation
      - Response includes `server_received_at` for client reference
    - Document migration path:
      - **Phase 1** (Current): Server accepts `client_claimed_time`, ignores it, uses `serverReceivedAt`
      - **Phase 2** (Future): Server requires clients to omit `client_claimed_time` or sends error
      - **Phase 3** (Future): Remove field entirely from schema
    - Document response changes:
      - Added fields: `server_received_at`, `timestamp_mode`
      - Added header: `X-Timestamp-Mode: server-captured`
    - Document expected client behavior:
      - Legitimate clients with synchronized clocks will continue working
      - Modded APKs with forged timestamps will fail HMAC or temporal gate
    - _Expected_Behavior: Clients understand new server-side timestamp control_
    - _Requirements: 2.5_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test` (or equivalent)
  - Verify all exploration tests pass (bug is fixed)
  - Verify all preservation tests pass (no regressions)
  - Verify all fix checking tests pass (implementation correct)
  - Verify all integration tests pass (end-to-end flows work)
  - Verify no TypeScript compilation errors
  - Run linter and fix any issues
  - Review test coverage - aim for 100% coverage on modified files
  - If any tests fail, investigate root cause and fix before proceeding
  - Document any edge cases discovered during testing
  - Ask user for review and feedback on implementation

---

## Testing Strategy Summary

### Phase 1: Exploration (Task 1)
- **Goal**: Demonstrate the bug exists on unfixed code
- **Approach**: Write tests that simulate timestamp manipulation attacks
- **Expected**: Tests FAIL on unfixed code (vulnerability confirmed)
- **Output**: Counterexamples documenting the security flaw

### Phase 2: Preservation (Task 2)
- **Goal**: Capture baseline behavior for non-temporal gates
- **Approach**: Observe and test HMAC, nonce, hardware, token validation on unfixed code
- **Expected**: Tests PASS on unfixed code (baseline established)
- **Output**: Property-based tests that must continue passing after fix

### Phase 3: Implementation (Tasks 3-5)
- **Goal**: Fix the bug by implementing server-side timestamp capture
- **Approach**: Modify endpoint, service, and crypto utils to use serverReceivedAt
- **Expected**: Exploration tests now PASS, preservation tests still PASS
- **Output**: Fixed code that enforces zero-trust timestamp validation

### Phase 4: Validation (Task 6)
- **Goal**: Confirm fix works and no regressions introduced
- **Approach**: Run complete test suite including unit, property, and integration tests
- **Expected**: 100% test pass rate, coverage on modified files
- **Output**: Production-ready fix with comprehensive test coverage

---

## Notes

- **Critical**: Task 1 MUST be completed BEFORE implementing the fix (exploratory testing)
- **Critical**: Task 2 MUST be completed BEFORE implementing the fix (baseline preservation)
- **Critical**: Tasks 3.4 and 3.5 re-run the SAME tests from tasks 1 and 2 (no new tests)
- **Migration**: Phase 1 maintains backward compatibility (clients can still send client_claimed_time)
- **Security**: After fix, modded APKs with forged timestamps will fail HMAC or temporal gate
- **Performance**: Expected latency overhead <1ms (Date.now() is native call)
- **Monitoring**: Track claim success rate, HMAC failure rate, verificationDeltaMs distribution
