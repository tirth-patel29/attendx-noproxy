// src/services/tokenCache.ts
// In-memory ring-buffer cache for active ephemeral tokens (Gate 3).
//
// The metronome mints tokens aligned to 3s epoch boundaries. Under classroom
// loads, querying Postgres on every student scan generates severe connection churn.
// This in-memory tier provides:
//   - O(1) membership lookup for the 4-gate Judge service
//   - Grace-window support so legitimate claims near epoch boundaries resolve instantly
//   - Ring-buffer history per session (keeps recent tokens for audit/membership)
//   - Memory-bounded automatic lazy eviction
import { config } from '../config';

export interface CachedToken {
  session_uuid: string;
  token_val: string;
  created_at_epoch: number;
  expires_at_epoch: number;
}

export class TokenCache {
  // Key: `${session_uuid}:${token_val}`
  private map = new Map<string, CachedToken>();
  // Session ring buffer: session_uuid -> array of recent tokens
  private sessionHistory = new Map<string, CachedToken[]>();
  // Keep an entry for token validity + grace so claims just past the boundary
  // resolve against memory before the judge falls back to Postgres.
  private readonly graceMs: number;

  constructor() {
    this.graceMs = config.judge.tokenValidityWindowMs + 5000;
  }

  private key(session: string, token: string): string {
    return `${session}:${token}`;
  }

  set(t: CachedToken): void {
    const now = Date.now();
    if (now > t.expires_at_epoch + this.graceMs) return;

    this.map.set(this.key(t.session_uuid, t.token_val), t);

    // Update session ring buffer (keep last 10 tokens = ~30s history)
    const history = this.sessionHistory.get(t.session_uuid) ?? [];
    if (!history.some(h => h.token_val === t.token_val && h.created_at_epoch === t.created_at_epoch)) {
      history.push(t);
      if (history.length > 10) history.shift();
      this.sessionHistory.set(t.session_uuid, history);
    }
  }

  /**
   * Look up a token by (session, token). Checks within validity + grace window.
   * Does NOT prematurely delete so concurrent students scanning the same flash
   * never experience cache eviction race conditions.
   */
  find(session: string, token: string): CachedToken | null {
    const hit = this.map.get(this.key(session, token));
    if (!hit) return null;
    if (Date.now() > hit.expires_at_epoch + this.graceMs) {
      this.map.delete(this.key(session, token));
      return null;
    }
    return hit;
  }

  /**
   * Look up a live (unexpired) token. Returns null if absent OR past validity.
   * Kept for backward compatibility with existing callers.
   */
  get(session: string, token: string): CachedToken | null {
    const hit = this.find(session, token);
    if (!hit) return null;
    if (Date.now() > hit.expires_at_epoch) {
      return null;
    }
    return hit;
  }

  /** Get recent tokens for a session from the in-memory ring buffer. */
  getRecentTokens(session: string): CachedToken[] {
    const now = Date.now();
    const list = this.sessionHistory.get(session) ?? [];
    return list.filter(t => now <= t.expires_at_epoch + this.graceMs);
  }

  /** Bulk-hydrate the cache from the DB (e.g. at boot for live sessions). */
  hydrate(rows: CachedToken[]): void {
    for (const r of rows) this.set(r);
  }

  /** Clear session cache when session ends */
  clearSession(session: string): void {
    const history = this.sessionHistory.get(session) ?? [];
    for (const item of history) {
      this.map.delete(this.key(session, item.token_val));
    }
    this.sessionHistory.delete(session);
  }

  /** Bound memory: drop expired entries periodically. Safe at any time. */
  evictExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.map) {
      if (now > v.expires_at_epoch + this.graceMs) {
        this.map.delete(k);
      }
    }
    for (const [sessionId, history] of this.sessionHistory) {
      const active = history.filter(t => now <= t.expires_at_epoch + this.graceMs);
      if (active.length === 0) {
        this.sessionHistory.delete(sessionId);
      } else {
        this.sessionHistory.set(sessionId, active);
      }
    }
  }
}

export const tokenCache = new TokenCache();
