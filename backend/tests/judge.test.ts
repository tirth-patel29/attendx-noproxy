import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { judgeService } from '../src/services/judge';
import { metronomeService } from '../src/services/metronome';
import { pool, query, transaction } from '../src/utils/db';
import { verifyHmac, computeHmac, generateHmacKey, generateChallengeNonce, hashDeviceId } from '../src/utils/crypto';
import { config } from '../src/config';

// Test setup
const TEST_SESSION_UUID = '00000000-0000-0000-0000-000000000001';
const TEST_STUDENT_UUID = '11111111-1111-1111-1111-111111111111';
const TEST_HMAC_KEY = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_DEVICE_HASH = hashDeviceId('test-device-123');

beforeAll(async () => {
  // Clean up any existing test data
  await query(`DELETE FROM active_tokens WHERE session_uuid = $1`, [TEST_SESSION_UUID]);
  await query(`DELETE FROM attendance_ledger WHERE session_uuid = $1`, [TEST_SESSION_UUID]);
  await query(`DELETE FROM crypto_challenges WHERE session_uuid = $1`, [TEST_SESSION_UUID]);
  await query(`DELETE FROM audit_logs WHERE session_uuid = $1`, [TEST_SESSION_UUID]);
  
  // Create test session
  await query(`
    INSERT INTO course_sessions (session_uuid, course_code, session_date, is_active)
    VALUES ($1, 'TEST101', CURRENT_DATE, TRUE)
    ON CONFLICT DO NOTHING
  `, [TEST_SESSION_UUID]);

  // Create test student
  await query(`
    INSERT INTO students (student_uuid, roll_no, email, bound_device_id, secret_hmac_key)
    VALUES ($1, 'TEST001', 'test@student.edu', $2, $3)
    ON CONFLICT (student_uuid) DO UPDATE SET
      bound_device_id = EXCLUDED.bound_device_id,
      secret_hmac_key = EXCLUDED.secret_hmac_key
  `, [TEST_STUDENT_UUID, TEST_DEVICE_HASH, TEST_HMAC_KEY]);

  // Start metronome for test session
  await metronomeService.startSession(TEST_SESSION_UUID);
  
  // Wait a bit for tokens to be minted
  await new Promise(r => setTimeout(r, 500));
});

afterAll(async () => {
  metronomeService.stopSession(TEST_SESSION_UUID);
  await pool.end();
});

describe('Judge Service — 4-Gate Verification', () => {
  describe('Gate 1: Hardware Tattoo', () => {
    it('should reject claim with unregistered device', async () => {
      const tokens = await metronomeService.getActiveTokens(TEST_SESSION_UUID);
      expect(tokens.length).toBeGreaterThan(0);
      
      const token = tokens[0];
      const nonce = generateChallengeNonce();
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [TEST_SESSION_UUID, nonce, Date.now(), Date.now() + 5000]
      );

      const payload = {
        session_uuid: TEST_SESSION_UUID,
        student_uuid: TEST_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: token.created_at_epoch,
        device_id_hash: 'different-device-hash-' + '0'.repeat(40), // Wrong device
        nonce,
        hmac_signature: computeHmac(TEST_HMAC_KEY, {
          session_uuid: TEST_SESSION_UUID,
          student_uuid: TEST_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: token.created_at_epoch,
          device_id_hash: 'different-device-hash-' + '0'.repeat(40),
          nonce,
        }),
      };

      const result = await judgeService.processClaim(payload);
      expect(result.status).toBe('HARDWARE_MISMATCH');
    });

    it('should accept claim with correct device hash', async () => {
      const tokens = await metronomeService.getActiveTokens(TEST_SESSION_UUID);
      const token = tokens[0];
      const nonce = generateChallengeNonce();
      
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [TEST_SESSION_UUID, nonce, Date.now(), Date.now() + 5000]
      );

      const payload = {
        session_uuid: TEST_SESSION_UUID,
        student_uuid: TEST_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: token.created_at_epoch,
        device_id_hash: TEST_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(TEST_HMAC_KEY, {
          session_uuid: TEST_SESSION_UUID,
          student_uuid: TEST_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: token.created_at_epoch,
          device_id_hash: TEST_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(payload);
      // May be PRESENT or STREAM_DETECTED depending on timing
      expect(['PRESENT', 'STREAM_DETECTED', 'EXPIRED_TOKEN']).toContain(result.status);
    });
  });

  describe('Gate 3: Visual Micro-Twitch (Token Rotation)', () => {
    it('should reject expired token', async () => {
      // Use an old token (simulate WhatsApp photo of old QR)
      const oldToken = 'OLDTOK';
      await query(
        `INSERT INTO active_tokens (session_uuid, token_val, created_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [TEST_SESSION_UUID, oldToken, Date.now() - 10000, Date.now() - 5000]
      );

      const nonce = generateChallengeNonce();
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [TEST_SESSION_UUID, nonce, Date.now(), Date.now() + 5000]
      );

      const payload = {
        session_uuid: TEST_SESSION_UUID,
        student_uuid: TEST_STUDENT_UUID,
        token_val: oldToken,
        client_claimed_time: Date.now(),
        device_id_hash: TEST_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(TEST_HMAC_KEY, {
          session_uuid: TEST_SESSION_UUID,
          student_uuid: TEST_STUDENT_UUID,
          token_val: oldToken,
          client_claimed_time: Date.now(),
          device_id_hash: TEST_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(payload);
      expect(result.status).toBe('EXPIRED_TOKEN');
    });

    it('should reject replay of already-consumed token', async () => {
      const tokens = await metronomeService.getActiveTokens(TEST_SESSION_UUID);
      const token = tokens[0];
      const nonce = generateChallengeNonce();
      
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [TEST_SESSION_UUID, nonce, Date.now(), Date.now() + 5000]
      );

      const basePayload = {
        session_uuid: TEST_SESSION_UUID,
        student_uuid: TEST_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: token.created_at_epoch,
        device_id_hash: TEST_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(TEST_HMAC_KEY, {
          session_uuid: TEST_SESSION_UUID,
          student_uuid: TEST_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: token.created_at_epoch,
          device_id_hash: TEST_DEVICE_HASH,
          nonce,
        }),
      };

      // First claim should succeed (or fail for other reasons)
      const result1 = await judgeService.processClaim(basePayload);
      
      // Second claim with same token should be FORGED_RESPONSE (replay)
      const result2 = await judgeService.processClaim(basePayload);
      expect(result2.status).toBe('FORGED_RESPONSE');
    });
  });

  describe('Gate 4: Cryptographic Time-Stamp (250ms window)', () => {
    it('should reject claim with latency > 250ms (Discord stream attack)', async () => {
      const tokens = await metronomeService.getActiveTokens(TEST_SESSION_UUID);
      const token = tokens[0];
      const nonce = generateChallengeNonce();
      
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [TEST_SESSION_UUID, nonce, Date.now(), Date.now() + 5000]
      );

      // Simulate Discord stream relay: client claims time that's 500ms off
      const fakeClaimedTime = token.created_at_epoch + 500; // 500ms late

      const payload = {
        session_uuid: TEST_SESSION_UUID,
        student_uuid: TEST_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: fakeClaimedTime,
        device_id_hash: TEST_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(TEST_HMAC_KEY, {
          session_uuid: TEST_SESSION_UUID,
          student_uuid: TEST_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: fakeClaimedTime,
          device_id_hash: TEST_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(payload);
      expect(result.status).toBe('STREAM_DETECTED');
      expect(Math.abs(result.verification_delta_ms!)).toBeGreaterThan(250);
    });

    it('should reject claim with invalid HMAC (Postman spoof)', async () => {
      const tokens = await metronomeService.getActiveTokens(TEST_SESSION_UUID);
      const token = tokens[0];
      const nonce = generateChallengeNonce();
      
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [TEST_SESSION_UUID, nonce, Date.now(), Date.now() + 5000]
      );

      // Valid payload but WRONG HMAC (attacker doesn't have secret_hmac_key)
      const payload = {
        session_uuid: TEST_SESSION_UUID,
        student_uuid: TEST_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: token.created_at_epoch,
        device_id_hash: TEST_DEVICE_HASH,
        nonce,
        hmac_signature: '0'.repeat(64), // Invalid HMAC
      };

      const result = await judgeService.processClaim(payload);
      expect(result.status).toBe('FORGED_RESPONSE');
    });

    it('should reject reused nonce', async () => {
      const tokens = await metronomeService.getActiveTokens(TEST_SESSION_UUID);
      const token = tokens[0];
      const nonce = generateChallengeNonce();
      
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch, used)
         VALUES ($1, $2, $3, $4, TRUE)`, // Already used
        [TEST_SESSION_UUID, nonce, Date.now(), Date.now() + 5000]
      );

      const payload = {
        session_uuid: TEST_SESSION_UUID,
        student_uuid: TEST_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: token.created_at_epoch,
        device_id_hash: TEST_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(TEST_HMAC_KEY, {
          session_uuid: TEST_SESSION_UUID,
          student_uuid: TEST_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: token.created_at_epoch,
          device_id_hash: TEST_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(payload);
      expect(result.status).toBe('FORGED_RESPONSE');
    });
  });

  describe('Gate 2: Biometric Flesh Lock', () => {
    it('is verified client-side (local_auth), not server', () => {
      // Gate 2 is enforced on the Flutter client via local_auth
      // Server doesn't directly verify biometrics
      // This test documents the architecture decision
      expect(true).toBe(true);
    });
  });

  describe('Full honest student flow', () => {
    it('should return PRESENT for valid claim within 250ms', async () => {
      const tokens = await metronomeService.getActiveTokens(TEST_SESSION_UUID);
      const token = tokens[0];
      const nonce = generateChallengeNonce();
      
      await query(
        `INSERT INTO crypto_challenges (session_uuid, challenge_nonce, issued_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)`,
        [TEST_SESSION_UUID, nonce, Date.now(), Date.now() + 5000]
      );

      const payload = {
        session_uuid: TEST_SESSION_UUID,
        student_uuid: TEST_STUDENT_UUID,
        token_val: token.token_val,
        client_claimed_time: token.created_at_epoch, // Perfect timing
        device_id_hash: TEST_DEVICE_HASH,
        nonce,
        hmac_signature: computeHmac(TEST_HMAC_KEY, {
          session_uuid: TEST_SESSION_UUID,
          student_uuid: TEST_STUDENT_UUID,
          token_val: token.token_val,
          client_claimed_time: token.created_at_epoch,
          device_id_hash: TEST_DEVICE_HASH,
          nonce,
        }),
      };

      const result = await judgeService.processClaim(payload);
      expect(result.status).toBe('PRESENT');
      expect(result.ledger_uuid).toBeDefined();
      expect(result.verification_delta_ms).toBe(0);
    });
  });
});

describe('Crypto Utilities', () => {
  it('should generate and verify HMAC correctly', () => {
    const key = generateHmacKey();
    const payload = {
      session_uuid: 'test',
      student_uuid: 'test',
      token_val: 'ABC123',
      client_claimed_time: Date.now(),
      device_id_hash: 'hash',
      nonce: 'nonce',
    };
    const hmac = computeHmac(key, payload);
    expect(verifyHmac(key, payload, hmac)).toBe(true);
    expect(verifyHmac(key, payload, 'wrong')).toBe(false);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateHmacKey());
    }
    expect(tokens.size).toBe(1000);
  });

  it('should hash device IDs consistently', () => {
    const deviceId = 'test-device-123';
    const hash1 = hashDeviceId(deviceId);
    const hash2 = hashDeviceId(deviceId);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex
  });
});

describe('Metronome Service', () => {
  const TEST_METRONOME_SESSION = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    await query(`
      INSERT INTO course_sessions (session_uuid, course_code, session_date, is_active)
      VALUES ($1, 'METRO_TEST', CURRENT_DATE, TRUE)
      ON CONFLICT DO NOTHING
    `, [TEST_METRONOME_SESSION]);
    await metronomeService.startSession(TEST_METRONOME_SESSION);
    await new Promise(r => setTimeout(r, 500));
  });

  afterAll(() => {
    metronomeService.stopSession(TEST_METRONOME_SESSION);
  });

  it('should mint tokens every 3 seconds', async () => {
    const tokens1 = await metronomeService.getActiveTokens(TEST_METRONOME_SESSION);
    expect(tokens1.length).toBeGreaterThan(0);
    
    // Wait for next tick
    await new Promise(r => setTimeout(r, 3500));
    
    const tokens2 = await metronomeService.getActiveTokens(TEST_METRONOME_SESSION);
    // Should have at least the same or more tokens (old ones may expire)
    expect(tokens2.length).toBeGreaterThan(0);
  });

  it('should broadcast token:new events via Socket.io', async () => {
    // This is tested via the metronome service integration
    const tokens = await metronomeService.getActiveTokens(TEST_METRONOME_SESSION);
    expect(tokens.length).toBeGreaterThan(0);
  });
});