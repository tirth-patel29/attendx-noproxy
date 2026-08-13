// src/services/tokenCache.ts
// In-memory cache for active ephemeral tokens (Gate 3).
//
// The metronome mints a fresh token every 3s per session and persists it to
// `active_tokens`. Every student claim used to re-read that row from Postgres
// (a per-claim SELECT that churns the pool). Under a 70-node class herd that is
// wasteful. Tokens are short-lived and read-mostly, so we keep a first-class
// in-memory tier:
//
//   - written on every mint (and hydrated for running sessions at boot)
//   - read-first on every verification; the DB is the source of truth and a
//     fallback ONLY on cache miss (so a cache eviction can never reject a
//     legitimate token)
//   - entries are evicted lazily once past their expiry (validity + grace)
//   - this is a performance cache, NOT the source of truth — reads never treat
//     "not in cache" as "invalid"
import { config } from '../config';

export interface CachedToken {
  session_uuid: string;
  token_val: string;
  created_at_epoch: number;
  expires_at_epoch: number;
}

export class TokenCache {
  private map = new Map<string, CachedToken>();
  // Keep an entry for token validity + grace so a claim just past the boundary
  // can still be resolved against the cache before the judge's DB fallback.
  private readonly graceMs: number;

  constructor() {
    this.graceMs = config.judge.tokenValidityWindowMs + 5000;
  }

  private key(session: string, token: string) {
    return `${session}:${token}`;
  }

  set(t: CachedToken): void {
    if (Date.now() > t.expires_at_epoch) return;
    this.map.set(this.key(t.session_uuid, t.token_val), t);
  }

  /** Look up a live (unexpired) token. Returns null if absent OR expired. */
  get(session: string, token: string): CachedToken | null {
    const hit = this.map.get(this.key(session, token));
    if (!hit) return null;
    if (Date.now() > hit.expires_at_epoch) {
      this.map.delete(this.key(session, token));
      return null;
    }
    return hit;
  }

  /** Bulk-hydrate the cache from the DB (e.g. at boot for live sessions). */
  hydrate(rows: CachedToken[]): void {
    for (const r of rows) this.set(r);
  }

  /** Bound memory: drop expired entries periodically. Safe at any time. */
  evictExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.map) {
      if (now > v.expires_at_epoch + this.graceMs) this.map.delete(k);
    }
  }
}

export const tokenCache = new TokenCache();
