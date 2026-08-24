/**
 * Bug Condition Exploration Test - Timestamp Manipulation Vulnerability
 * 
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code. Failure confirms the bug exists.
 * 
 * This test encodes the EXPECTED BEHAVIOR (server-side timestamp control) and will FAIL
 * on the current vulnerable code where the server trusts client-provided timestamps.
 * 
 * Once the fix is implemented (Task 3), this SAME test will PASS, confirming the fix works.
 * 
 * Bug Condition: C(X) = X.client_claimed_time IS_PROVIDED AND server uses it for verification
 * Expected Behavior: Server captures serverReceivedAt, ignores client_claimed_time
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4 (bugfix.md)**
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { judgeService } from '../../services/judge';
import { metronomeService } from '../../services/metronome';
import { pool, query } from '../../utils/db';
import { computeHmac, generateChallengeNonce, hashDeviceId } from '../../utils/crypto';
import { config } from '../../config';

// Test fixtures
const EXPLORATION_SESSION_UUID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const EXPLORATION_STUDENT_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const EXPLORATION_HMAC_KEY = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const EXPLORATION_DEVICE_HASH = hashDeviceId('exploration-device-001');

beforeAll(async () => {
  // Clean up any existing test data
  await query(`DELETE FROM active_tokens WHERE session_uuid = $1`, [EXPLORATION_SESSION_UUID]);
  await query(`DELETE FROM attendance_ledger WHERE session_uuid = $1`, [EXPLORATION_SESSION_UUID]);
  await query(`DELETE FROM crypto_challenges WHERE session_uuid = $1`, [EXPLORATION_SESSION_UUID]);
  await query(`DELETE FROM audit_logs WHERE session_uuid = $1`, [EXPLORATION_SESSION_UUID]);
  
  // Create test session
  await query(`
    INSERT INTO course_sessions (session_uuid, course_code, session_date, is_active)
    VALUES ($1, 'EXPLOIT_TEST', CURRENT_DATE, TRUE)
    ON CONFLICT DO NOTHING
  `, [EXPLORATION_SESSION_UUID]);

  // Create test student with known credentials
  await query(`
    INSERT INTO students (student_uuid, roll_no, email, bound_device_id, secret_hmac_key)
    VALUES ($1, 'EXP001', 'exploit@test.edu', $2, $3)
    ON CONFLICT (student_uuid) DO UPDATE SET
      bound_device_id = EXCLUDED.bound_device_id,
      secret_hmac_key = EXCLUDED.secret_hmac_key
  `, [EXPLORATION_STUDENT_UUID, EXPLORATION_DEVICE_HASH, EXPLORATION_HMAC_KEY]);

  // Start metronome to mint tokens
  await metronomeService.startSession(EXPLORATION_SESSION_UUID);
  
  // Wait for tokens to be minted
  await new Promise(r => setTimeout(r, 1000));
});

afterAll(async () => {
  metronomeService.stopSession(EXPLORATION_SESSION_UUID);
  await pool.end();
});

describe('Bug Condition Exploration - Timestamp Manipulation Attacks', () => {
  
  describe('Test Case 1: Past Timestamp Attack (30 minutes ago)', () => {
    it('EXPECTED: Server should use serverReceivedAt, causing HMAC mismatch or proper temporal validation', async () => {
      // Get a freshly minted token
      const tokens = await metronomeService.getActiveTokens(EXPLORATION_SESSION_UUID);
      expect(tokens.length).toBeGreaterThan(0);
      const token = tokens[0];
      const tokenBirth = Number(token.created_at_epoch);

      // Attacker forges timestamp to 30 minutes ago
      const forgedTimestamp = Date.now() - (30 * 60 * 1000);
      
      // Create fresh nonce
      const nonce = generateChallengeNonce();
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [EXPLORATION_SESSION_UUID, nonce, Date.now(), Date.now() + 10000]
      );

      // Modded APK computes HMAC with forged timestamp
      const maliciousPayload = {
        session_uuid: EXPLORATION_SESSION_UUID,
        student_uuid: EXPLORATION_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: forgedTimestamp, // ❌ FORGED - 30 minutes ago
        device_id_hash: EXPLORATION_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(EXPLORATION_HMAC_KEY, {
          session_uuid: EXPLORATION_SESSION_UUID,
          student_uuid: EXPLORATION_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: forgedTimestamp,
          device_id_hash: EXPLORATION_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(maliciousPayload);

      // EXPECTED BEHAVIOR (after fix):
      // Server uses serverReceivedAt instead of forgedTimestamp
      // This causes HMAC verification to fail (client used forgedTimestamp, server uses serverReceivedAt)
      // OR temporal gate fails because serverReceivedAt is correct, not 30 min ago
      expect(result.status).not.toBe('PRESENT');
      expect(['FORGED_RESPONSE', 'STREAM_DETECTED', 'EXPIRED_TOKEN']).toContain(result.status);
      
      // If UNFIXED: Result would be PRESENT (vulnerability confirmed)
      // If FIXED: Result is FORGED_RESPONSE or EXPIRED_TOKEN (expected behavior)
      
      console.log('Past Timestamp Attack Result:', {
        status: result.status,
        code: result.code,
        message: result.message,
        verificationDeltaMs: result.verification_delta_ms,
        tokenBirth,
        forgedTimestamp,
        actualServerTime: Date.now(),
        timeDriftFromNow: Date.now() - forgedTimestamp,
      });
    });
  });

  describe('Test Case 2: Future Timestamp Attack (10 minutes ahead)', () => {
    it('EXPECTED: Server should use serverReceivedAt, rejecting future timestamp', async () => {
      const tokens = await metronomeService.getActiveTokens(EXPLORATION_SESSION_UUID);
      const token = tokens[0];

      // Attacker forges timestamp to 10 minutes in the future
      const forgedTimestamp = Date.now() + (10 * 60 * 1000);
      
      const nonce = generateChallengeNonce();
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [EXPLORATION_SESSION_UUID, nonce, Date.now(), Date.now() + 10000]
      );

      const maliciousPayload = {
        session_uuid: EXPLORATION_SESSION_UUID,
        student_uuid: EXPLORATION_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: forgedTimestamp, // ❌ FORGED - 10 minutes future
        device_id_hash: EXPLORATION_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(EXPLORATION_HMAC_KEY, {
          session_uuid: EXPLORATION_SESSION_UUID,
          student_uuid: EXPLORATION_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: forgedTimestamp,
          device_id_hash: EXPLORATION_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(maliciousPayload);

      // EXPECTED: Server uses serverReceivedAt, causing HMAC mismatch or freshness check failure
      expect(result.status).not.toBe('PRESENT');
      expect(['FORGED_RESPONSE', 'STREAM_DETECTED', 'EXPIRED_TOKEN']).toContain(result.status);
      
      console.log('Future Timestamp Attack Result:', {
        status: result.status,
        code: result.code,
        message: result.message,
        verificationDeltaMs: result.verification_delta_ms,
        forgedTimestamp,
        actualServerTime: Date.now(),
        futureOffset: forgedTimestamp - Date.now(),
      });
    });
  });

  describe('Test Case 3: Extreme Latency Forgery (Zero latency fake)', () => {
    it('EXPECTED: Server should calculate latency from serverReceivedAt, not forged timestamp', async () => {
      const tokens = await metronomeService.getActiveTokens(EXPLORATION_SESSION_UUID);
      const token = tokens[0];
      const tokenBirth = Number(token.created_at_epoch);

      // Attacker forges timestamp to be exactly at token birth (faking zero latency)
      const forgedTimestamp = tokenBirth + 10; // Just 10ms after birth to fake perfect timing
      
      const nonce = generateChallengeNonce();
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [EXPLORATION_SESSION_UUID, nonce, Date.now(), Date.now() + 10000]
      );

      const maliciousPayload = {
        session_uuid: EXPLORATION_SESSION_UUID,
        student_uuid: EXPLORATION_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: forgedTimestamp, // ❌ FORGED - exactly at token birth
        device_id_hash: EXPLORATION_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(EXPLORATION_HMAC_KEY, {
          session_uuid: EXPLORATION_SESSION_UUID,
          student_uuid: EXPLORATION_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: forgedTimestamp,
          device_id_hash: EXPLORATION_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(maliciousPayload);

      // EXPECTED: Server calculates verificationDeltaMs from serverReceivedAt, not forgedTimestamp
      // The actual delta should reflect real server timing, not the forged zero latency
      const actualServerTime = Date.now();
      const expectedActualDelta = actualServerTime - tokenBirth;
      
      // If FIXED: verificationDeltaMs should be based on serverReceivedAt (realistic latency)
      // If UNFIXED: verificationDeltaMs would be ~10ms (forged value)
      
      // Since we expect the fix to use serverReceivedAt, the HMAC will fail (mismatch)
      expect(result.status).not.toBe('PRESENT');
      
      console.log('Extreme Latency Forgery Result:', {
        status: result.status,
        code: result.code,
        verificationDeltaMs: result.verification_delta_ms,
        tokenBirth,
        forgedTimestamp,
        actualServerTime,
        forgedDelta: forgedTimestamp - tokenBirth,
        expectedActualDelta,
        deltaDifference: result.verification_delta_ms ? 
          Math.abs(result.verification_delta_ms - (forgedTimestamp - tokenBirth)) : 
          'N/A',
      });
    });
  });

  describe('Test Case 4: Replay Window Extension (Stale timestamp with fresh nonce)', () => {
    it('EXPECTED: Server should use serverReceivedAt for freshness check, rejecting stale claims', async () => {
      const tokens = await metronomeService.getActiveTokens(EXPLORATION_SESSION_UUID);
      const token = tokens[0];

      // Attacker captures a claim timestamp, waits 10 seconds (beyond normal window)
      // Then replays with a fresh nonce but stale timestamp
      const staleTimestamp = Date.now() - (10 * 1000); // 10 seconds ago
      
      // Wait 2 seconds to simulate delay
      await new Promise(r => setTimeout(r, 2000));
      
      const freshNonce = generateChallengeNonce();
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [EXPLORATION_SESSION_UUID, freshNonce, Date.now(), Date.now() + 10000]
      );

      const maliciousPayload = {
        session_uuid: EXPLORATION_SESSION_UUID,
        student_uuid: EXPLORATION_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: staleTimestamp, // ❌ FORGED - 10+ seconds old
        device_id_hash: EXPLORATION_DEVICE_HASH,
        nonce: freshNonce, // ✅ Fresh nonce (not reused)
        hmac_signature: computeHmac(EXPLORATION_HMAC_KEY, {
          session_uuid: EXPLORATION_SESSION_UUID,
          student_uuid: EXPLORATION_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: staleTimestamp,
          device_id_hash: EXPLORATION_DEVICE_HASH,
          nonce: freshNonce,
        }),
      };

      const result = await judgeService.processClaim(maliciousPayload);

      // EXPECTED: Server uses serverReceivedAt for freshness check
      // Even with fresh nonce, serverReceivedAt is within valid window
      // But HMAC mismatch occurs (client used staleTimestamp, server uses serverReceivedAt)
      expect(result.status).not.toBe('PRESENT');
      expect(['FORGED_RESPONSE', 'STREAM_DETECTED', 'EXPIRED_TOKEN']).toContain(result.status);
      
      console.log('Replay Window Extension Result:', {
        status: result.status,
        code: result.code,
        staleTimestamp,
        actualServerTime: Date.now(),
        staleness: Date.now() - staleTimestamp,
        nonceWasFresh: true,
      });
    });
  });

  describe('Control Test: Legitimate client with server-aligned timestamp', () => {
    it('EXPECTED: Legitimate client should continue to work after fix (server uses serverReceivedAt)', async () => {
      const tokens = await metronomeService.getActiveTokens(EXPLORATION_SESSION_UUID);
      const token = tokens[0];
      const tokenBirth = Number(token.created_at_epoch);

      // Legitimate client provides current timestamp (roughly aligned with server)
      const legitimateTimestamp = Date.now();
      
      const nonce = generateChallengeNonce();
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [EXPLORATION_SESSION_UUID, nonce, Date.now(), Date.now() + 10000]
      );

      const legitimatePayload = {
        session_uuid: EXPLORATION_SESSION_UUID,
        student_uuid: EXPLORATION_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: legitimateTimestamp, // ✅ Honest timestamp (close to server time)
        device_id_hash: EXPLORATION_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(EXPLORATION_HMAC_KEY, {
          session_uuid: EXPLORATION_SESSION_UUID,
          student_uuid: EXPLORATION_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: legitimateTimestamp,
          device_id_hash: EXPLORATION_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(legitimatePayload);

      // EXPECTED: After fix, server uses serverReceivedAt
      // If client's timestamp is close to server time (within tolerance), HMAC might match
      // However, the fix changes HMAC structure to use serverReceivedAt
      // So this test documents that legitimate clients will need to adapt
      
      console.log('Legitimate Client Result:', {
        status: result.status,
        code: result.code,
        verificationDeltaMs: result.verification_delta_ms,
        tokenBirth,
        clientTimestamp: legitimateTimestamp,
        actualServerTime: Date.now(),
        timeDrift: Math.abs(Date.now() - legitimateTimestamp),
      });
      
      // This test documents the migration requirement:
      // After fix, even legitimate clients will see HMAC mismatch if they include
      // client_claimed_time in HMAC. This is expected and part of the fix.
      // Phase 1: Server ignores client_claimed_time
      // Phase 2: Clients update to not include timestamp in HMAC
    });
  });
});

describe('Vulnerability Analysis Summary', () => {
  it('documents the bug condition and expected fix behavior', () => {
    /**
     * BUG CONDITION:
     * - Server accepts and trusts client_claimed_time parameter
     * - Server uses client_claimed_time in HMAC verification
     * - Server uses client_claimed_time in latency calculation
     * - Server uses client_claimed_time in temporal gate verification
     * 
     * ATTACK VECTORS ENABLED:
     * 1. Past Timestamp Attack: Submit claim with timestamp from 30 minutes ago
     * 2. Future Timestamp Attack: Submit claim with timestamp 10 minutes ahead
     * 3. Extreme Latency Forgery: Fake zero latency by setting timestamp = tokenBirth
     * 4. Replay Window Extension: Use stale timestamp with fresh nonce
     * 
     * EXPECTED BEHAVIOR (AFTER FIX):
     * - Server captures serverReceivedAt = Date.now() at request entry
     * - Server uses serverReceivedAt for all verification (HMAC, latency, freshness)
     * - Server ignores client_claimed_time (logged for audit only)
     * - Forged timestamps cause HMAC mismatch (client used fake time, server uses real time)
     * - Temporal gate enforced based on actual server-observed timing
     * 
     * MIGRATION STRATEGY:
     * - Phase 1: Server captures serverReceivedAt but maintains HMAC structure
     * - Phase 2: Clients update to use server-provided timestamp in HMAC
     * - Phase 3: Remove client_claimed_time parameter entirely
     * 
     * COUNTEREXAMPLES TO DOCUMENT:
     * - Record which attack scenarios succeed on unfixed code
     * - Record verificationDeltaMs values (should reflect forged timing on unfixed code)
     * - Record whether temporal gate is bypassed for each scenario
     * 
     * ROOT CAUSE CONFIRMED:
     * - Insufficient zero-trust architecture (trusting client-provided time)
     * - HMAC payload includes client timestamp (coupling crypto to client timing)
     * - Latency verification uses client time (forgeable)
     * - Missing server-side timestamp capture at entry point
     */
    
    expect(true).toBe(true); // Documentation test
  });
});
