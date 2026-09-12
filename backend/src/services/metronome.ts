import { config } from '../config';
import { query } from '../utils/db';
import { generateToken } from '../utils/crypto';
import { tokenCache } from './tokenCache';

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

export interface EpochBroadcastPayload {
  session_uuid: string;
  epoch: number;
  current_token: string;
  current_start: number;
  next_token: string;
  next_start: number;
  interval_ms: number;
  flash_duration_ms: number;
  server_time_ms: number;
}

/**
 * Metronome Service — High-Precision, Zero-Thrash Epoch Metronome
 * 
 * Mints base62 tokens aligned to absolute Unix millisecond boundaries (epoch = floor(now / intervalMs)).
 * Features:
 * - Deterministic epoch-aligned time grids (no interval wander)
 * - Lookahead pipeline: streams both current + upcoming token to eliminate socket jitter
 * - High-speed in-memory ring buffer (sub-millisecond Gate 3/4 validation)
 * - Throttled DB persistence to prevent Postgres write thrashing
 * - Backward compatibility with legacy `token:new` socket listeners
 */
export class MetronomeService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private io: any = null; // Socket.io server instance

  constructor() {
    // Background memory & DB cleanup runs every 60s instead of every 3s,
    // reducing DB write churn by >95% while keeping memory strictly bounded.
    this.cleanupInterval = setInterval(() => {
      tokenCache.evictExpired();
      this.purgeExpiredDbTokens().catch((err) => {
        console.error('Metronome periodic DB purge error:', err);
      });
    }, 60000);
  }

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

    // Mint initial tokens (current epoch + lookahead epochs)
    await this.mintTokens(sessionUuid, config.metronome.lookaheadTokens + 1);

    // Set up interval aligned to metronome period
    const interval = setInterval(async () => {
      try {
        await this.mintTokens(sessionUuid, 2); // Ensure current + next epoch are always buffered
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
      tokenCache.clearSession(sessionUuid);
      console.log(`Metronome stopped for session ${sessionUuid}`);
    }
  }

  /**
   * Stop all metronomes
   */
  stopAll(): void {
    for (const [sessionUuid, interval] of this.intervals) {
      clearInterval(interval);
      tokenCache.clearSession(sessionUuid);
    }
    this.intervals.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('All metronomes stopped');
  }

  /**
   * Mint tokens for an absolute epoch window
   */
  private async mintTokens(sessionUuid: string, count: number): Promise<TokenRecord[]> {
    const intervalMs = config.metronome.intervalMs;
    const now = Date.now();
    const currentEpoch = Math.floor(now / intervalMs);
    const tokens: TokenRecord[] = [];

    for (let i = 0; i < count; i++) {
      const epoch = currentEpoch + i;
      const createdAt = epoch * intervalMs;
      const expiresAt = createdAt + config.judge.tokenValidityWindowMs;

      // Check if we already have this epoch in memory to avoid redundant work
      const existingInCache = tokenCache.getRecentTokens(sessionUuid)
        .find(t => t.created_at_epoch === createdAt);

      if (existingInCache) {
        tokens.push(existingInCache as TokenRecord);
        continue;
      }

      const tokenVal = generateToken(config.metronome.tokenLength, config.metronome.tokenCharset);

      const res = await query<TokenRecord>(
        `INSERT INTO active_tokens (session_uuid, token_val, created_at_epoch, expires_at_epoch)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [sessionUuid, tokenVal, createdAt, expiresAt]
      );

      const record = res.rows[0] ?? {
        token_uuid: `mem-${sessionUuid}-${createdAt}`,
        session_uuid: sessionUuid,
        token_val: tokenVal,
        created_at_epoch: createdAt,
        expires_at_epoch: expiresAt,
      };

      tokens.push(record);

      // Mirror into memory ring-buffer
      tokenCache.set({
        session_uuid: sessionUuid,
        token_val: record.token_val,
        created_at_epoch: record.created_at_epoch,
        expires_at_epoch: record.expires_at_epoch,
      });
    }

    // Broadcast both legacy and lookahead payloads
    if (this.io && tokens.length > 0) {
      const currentToken = tokens[0];
      const nextToken = tokens[1] ?? tokens[0];

      // 1. High-precision lookahead event for ClassroomProjector 2.0
      const epochPayload: EpochBroadcastPayload = {
        session_uuid: sessionUuid,
        epoch: currentEpoch,
        current_token: currentToken.token_val,
        current_start: currentToken.created_at_epoch,
        next_token: nextToken.token_val,
        next_start: nextToken.created_at_epoch,
        interval_ms: intervalMs,
        flash_duration_ms: 100,
        server_time_ms: now,
      };
      this.io.to(`session:${sessionUuid}`).emit('token:epoch', epochPayload);

      // 2. Legacy event for existing clients
      this.io.to(`session:${sessionUuid}`).emit('token:new', {
        token_val: currentToken.token_val,
        created_at_epoch: currentToken.created_at_epoch,
        expires_at_epoch: currentToken.expires_at_epoch,
      });
    }

    return tokens;
  }

  /**
   * Periodic DB cleanup of old expired tokens (called every 60s, not every 3s)
   */
  private async purgeExpiredDbTokens(): Promise<void> {
    const threshold = Date.now() - (config.judge.tokenValidityWindowMs + 30000);
    await query(
      `DELETE FROM active_tokens WHERE expires_at_epoch < $1`,
      [threshold]
    );
  }

  /**
   * Clean up expired tokens for a specific session
   */
  private async cleanupExpiredTokens(sessionUuid: string): Promise<void> {
    const now = Date.now();
    await query(
      `DELETE FROM active_tokens WHERE session_uuid = $1 AND expires_at_epoch < $2`,
      [sessionUuid, now]
    );
  }

  /**
   * Get current active tokens for a session (for debugging/monitoring/tests)
   */
  async getActiveTokens(sessionUuid: string): Promise<ActiveToken[]> {
    const cached = tokenCache.getRecentTokens(sessionUuid);
    const now = Date.now();
    const activeFromCache = cached
      .filter(t => t.expires_at_epoch > now)
      .map(t => ({
        token_val: t.token_val,
        created_at_epoch: t.created_at_epoch,
        expires_at_epoch: t.expires_at_epoch,
      }));

    if (activeFromCache.length > 0) {
      return activeFromCache;
    }

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
   * Look up a token by (session, value) REGARDLESS of current expiry, cache-first
   * with DB fallback. Used by the Layer-3 judge to test whether the token was
   * LIVE at the *claimed* instant (membership), not just whether it is still
   * live *now*. Returns the row or null if it never existed / was already purged.
   */
  async findToken(sessionUuid: string, tokenVal: string): Promise<TokenRecord | null> {
    const cached = tokenCache.find(sessionUuid, tokenVal);
    if (cached) return cached as TokenRecord;

    const res = await query<TokenRecord>(
      `SELECT * FROM active_tokens WHERE session_uuid = $1 AND token_val = $2`,
      [sessionUuid, tokenVal]
    );
    if (res.rows[0]) {
      tokenCache.set({
        session_uuid: sessionUuid,
        token_val: res.rows[0].token_val,
        created_at_epoch: res.rows[0].created_at_epoch,
        expires_at_epoch: res.rows[0].expires_at_epoch,
      });
    }
    return res.rows[0] ?? null;
  }

  /**
   * Verify a token is live using the in-memory cache first, falling back to
   * Postgres only on a cache miss.
   */
  async verifyTokenCached(sessionUuid: string, tokenVal: string): Promise<TokenRecord | null> {
    const cached = tokenCache.get(sessionUuid, tokenVal);
    if (cached) return cached as TokenRecord;
    return this.verifyToken(sessionUuid, tokenVal);
  }

  /**
   * Verify a token is live (exists + not yet expired) WITHOUT consuming it.
   */
  async verifyToken(sessionUuid: string, tokenVal: string): Promise<TokenRecord | null> {
    const cached = tokenCache.get(sessionUuid, tokenVal);
    if (cached) return cached as TokenRecord;

    const now = Date.now();
    const res = await query<TokenRecord>(
      `SELECT * FROM active_tokens
       WHERE session_uuid = $1 AND token_val = $2 AND expires_at_epoch > $3`,
      [sessionUuid, tokenVal, now]
    );
    if (res.rows[0]) {
      tokenCache.set({
        session_uuid: sessionUuid,
        token_val: res.rows[0].token_val,
        created_at_epoch: res.rows[0].created_at_epoch,
        expires_at_epoch: res.rows[0].expires_at_epoch,
      });
    }
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