import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { config } from '../config';

/**
 * Generate a random base62 token
 */
export function generateToken(length: number, charset: string): string {
  let result = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

/**
 * Generate a cryptographically secure random HMAC key (32 bytes = 64 hex chars)
 */
export function generateHmacKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Verify HMAC signature using timing-safe comparison
 * 
 * Expected payload format from client:
 * {
 *   session_uuid: string,
 *   student_uuid: string,
 *   token_val: string,
 *   client_claimed_time: number,  // TrueObservedTime in ms
 *   device_id_hash: string,
 *   nonce: string                 // challenge_nonce from crypto_challenges
 * }
 * 
 * Server computes: HMAC_SHA256(secret_hmac_key, canonical_string)
 * where canonical_string = `${session_uuid}|${student_uuid}|${token_val}|${client_claimed_time}|${device_id_hash}|${nonce}`
 */
export function verifyHmac(
  secretHmacKey: string,
  payload: {
    session_uuid: string;
    student_uuid: string;
    token_val: string;
    client_claimed_time: number;
    device_id_hash: string;
    nonce: string;
  },
  providedHmac: string
): boolean {
  const canonicalString = [
    payload.session_uuid,
    payload.student_uuid,
    payload.token_val,
    payload.client_claimed_time.toString(),
    payload.device_id_hash,
    payload.nonce,
  ].join('|');

  const expectedHmac = createHmac('sha256', Buffer.from(secretHmacKey, 'hex'))
    .update(canonicalString)
    .digest('hex');

  // Timing-safe comparison
  const providedBuffer = Buffer.from(providedHmac, 'hex');
  const expectedBuffer = Buffer.from(expectedHmac, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Compute HMAC for testing/debugging
 */
export function computeHmac(
  secretHmacKey: string,
  payload: {
    session_uuid: string;
    student_uuid: string;
    token_val: string;
    client_claimed_time: number;
    device_id_hash: string;
    nonce: string;
  }
): string {
  const canonicalString = [
    payload.session_uuid,
    payload.student_uuid,
    payload.token_val,
    payload.client_claimed_time.toString(),
    payload.device_id_hash,
    payload.nonce,
  ].join('|');

  return createHmac('sha256', Buffer.from(secretHmacKey, 'hex'))
    .update(canonicalString)
    .digest('hex');
}

/**
 * SHA-256 hash for device ID (Gate 1)
 */
export function hashDeviceId(deviceId: string): string {
  return createHmac('sha256', 'attendance-gateway-salt') // In production, use proper salt from config
    .update(deviceId)
    .digest('hex');
}

/**
 * Generate a challenge nonce (16 bytes = 32 hex chars)
 */
export function generateChallengeNonce(): string {
  return randomBytes(16).toString('hex');
}