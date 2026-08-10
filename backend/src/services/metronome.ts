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
   * Verify a token is live (exists + not yet expired) WITHOUT consuming it.
   *
   * Per SRS §1 Phase 3/5 the token is SHARED: the entire class scans the same
   * rotating token inside its validity window. Tradecraft is enforced purely by
   * the 250ms latency check and the UNIQUE(session_uuid, student_uuid) ledger
   * constraint — never by deleting the token after a single claim (that would
   * let one student's packet DoS the other 69).
   *
   * Returns the token record if live, null otherwise.
   */
  async verifyToken(sessionUuid: string, tokenVal: string): Promise<TokenRecord | null> {
    const now = Date.now();
    const res = await query<TokenRecord>(
      `SELECT * FROM active_tokens
       WHERE session_uuid = $1 AND token_val = $2 AND expires_at_epoch > $3`,
      [sessionUuid, tokenVal, now]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Verify a token and that it is NOT expired (legacy alias kept for tests).
   */
  async verifyAndConsumeToken(sessionUuid: string, tokenVal: string): Promise<TokenRecord | null> {
    return this.verifyToken(sessionUuid, tokenVal);
  }
}

// Singleton instance
export const metronomeService = new MetronomeService();