import { config } from '../config';
import { query, transaction } from '../utils/db';
import { generateToken } from '../utils/crypto';

export interface TokenRecord {
  token_uuid: string;
  session_uuid: string;
  token_val: string;
  created_at_epoch: number;
  expires_at_epoch: number;
}

export interface ActiveToken {
  token_val: string;
  created_at_epoch: number;
  expires_at_epoch: number;
}

/**
 * Metronome Service
 * 
 * Mints a new base62 token every 3 seconds for each active session.
 * Tokens are persisted to `active_tokens` table and broadcast via Socket.io.
 * 
 * Design:
 * - Runs as a background interval (not tied to HTTP requests)
 * - Pre-mints tokens (lookahead) to handle clock skew
 * - Cleans up expired tokens periodically
 * - Survives restarts (state is in DB)
 */
export class MetronomeService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private io: any = null; // Socket.io server instance

  setSocketIO(io: any) {
    this.io = io;
  }

  /**
   * Start metronome for a specific session
   */
  async startSession(sessionUuid: string): Promise<void> {
    if (this.intervals.has(sessionUuid)) {
      console.log(`Metronome already running for session ${sessionUuid}`);
      return;
    }

    // Mint initial tokens (current + lookahead)
    await this.mintTokens(sessionUuid, config.metronome.lookaheadTokens + 1);

    // Set up interval
    const interval = setInterval(async () => {
      try {
        await this.mintTokens(sessionUuid, 1);
        await this.cleanupExpiredTokens(sessionUuid);
      } catch (err) {
        console.error(`Metronome error for session ${sessionUuid}:`, err);
      }
    }, config.metronome.intervalMs);

    this.intervals.set(sessionUuid, interval);
    console.log(`Metronome started for session ${sessionUuid}`);
  }

  /**
   * Stop metronome for a session
   */
  stopSession(sessionUuid: string): void {
    const interval = this.intervals.get(sessionUuid);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(sessionUuid);
      console.log(`Metronome stopped for session ${sessionUuid}`);
    }
  }

  /**
   * Stop all metronomes
   */
  stopAll(): void {
    for (const [sessionUuid, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    console.log('All metronomes stopped');
  }

  /**
   * Mint N tokens for a session
   */
  private async mintTokens(sessionUuid: string, count: number): Promise<TokenRecord[]> {
    const now = Date.now();
    const tokens: TokenRecord[] = [];

    for (let i = 0; i < count; i++) {
      const createdAt = now + (i * config.metronome.intervalMs);
      const tokenVal = generateToken(config.metronome.tokenLength, config.metronome.tokenCharset);
      const expiresAt = createdAt + config.judge.tokenValidityWindowMs;

      const res = await query<TokenRecord>(
        `INSERT INTO active_tokens (session_uuid, token_val, created_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [sessionUuid, tokenVal, createdAt, expiresAt]
      );

      if (res.rows.length > 0) {
        tokens.push(res.rows[0]);
        // Broadcast to connected clients
        if (this.io) {
          this.io.to(`session:${sessionUuid}`).emit('token:new', {
            token_val: tokenVal,
            created_at_epoch: createdAt,
            expires_at_epoch: expiresAt,
          });
        }
      }
    }

    return tokens;
  }

  /**
   * Clean up expired tokens for a session
   */
  private async cleanupExpiredTokens(sessionUuid: string): Promise<void> {
    const now = Date.now();
    await query(
      `DELETE FROM active_tokens WHERE session_uuid = $1 AND expires_at_epoch < $2`,
      [sessionUuid, now]
    );
  }

  /**
   * Get current active tokens for a session (for debugging/monitoring)
   */
  async getActiveTokens(sessionUuid: string): Promise<ActiveToken[]> {
    const now = Date.now();
    const res = await query<ActiveToken>(
      `SELECT token_val, created_at_epoch, expires_at_epoch
       FROM active_tokens
       WHERE session_uuid = $1 AND expires_at_epoch > $2
       ORDER BY created_at_epoch ASC`,
      [sessionUuid, now]
    );
    return res.rows;
  }

  /**
   * Verify a token is valid and not used (for claim-attendance)
   * Returns the token record if valid, null otherwise
   */
  async verifyAndConsumeToken(sessionUuid: string, tokenVal: string, clientClaimedTime: number): Promise<TokenRecord | null> {
    const now = Date.now();
    
    // 1. Find token
    const res = await query<TokenRecord>(
      `SELECT * FROM active_tokens 
       WHERE session_uuid = $1 AND token_val = $2 AND expires_at_epoch > $3`,
      [sessionUuid, tokenVal, now]
    );

    if (res.rows.length === 0) {
      return null; // Token not found or expired
    }

    const token = res.rows[0];

    // 2. Check latency (Cristian's Algorithm tolerance)
    // Server receives claim at 'now', token was created at token.created_at_epoch
    // The drift is now - token.created_at_epoch - clientClaimedTime
    // Actually: verification_delta_ms = client_claimed_time - token.created_at_epoch
    // We need |verification_delta_ms| <= maxLatencyMs (250ms)
    
    const verificationDeltaMs = clientClaimedTime - token.created_at_epoch;
    if (Math.abs(verificationDeltaMs) > config.judge.maxLatencyMs) {
      console.log(`Token ${tokenVal} failed latency check: delta=${verificationDeltaMs}ms`);
      return null; // Outside 250ms window
    }

    // 3. Mark token as consumed (delete it so it can't be reused)
    await query(
      `DELETE FROM active_tokens WHERE token_uuid = $1`,
      [token.token_uuid]
    );

    return token;
  }
}

// Singleton instance
export const metronomeService = new MetronomeService();