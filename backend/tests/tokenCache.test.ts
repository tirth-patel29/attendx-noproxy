import { describe, it, expect, beforeEach } from 'vitest';
import { TokenCache } from '../src/services/tokenCache';

describe('TokenCache - In-Memory Ring Buffer & Hot-Path Lookup', () => {
  let cache: TokenCache;

  beforeEach(() => {
    cache = new TokenCache();
  });

  it('stores and retrieves unexpired tokens via find and get', () => {
    const now = Date.now();
    cache.set({
      session_uuid: 'session-1',
      token_val: 'A1B2',
      created_at_epoch: now,
      expires_at_epoch: now + 5000,
    });

    const hit = cache.get('session-1', 'A1B2');
    expect(hit).not.toBeNull();
    expect(hit?.token_val).toBe('A1B2');

    const found = cache.find('session-1', 'A1B2');
    expect(found).not.toBeNull();
    expect(found?.token_val).toBe('A1B2');
  });

  it('allows find() during the grace window even if past nominal expires_at_epoch', () => {
    const now = Date.now();
    // Token nominally expired 500ms ago, but well within the 10000ms grace window
    cache.set({
      session_uuid: 'session-1',
      token_val: 'GRACE1',
      created_at_epoch: now - 5500,
      expires_at_epoch: now - 500,
    });

    // get() requires unexpired
    const unexpired = cache.get('session-1', 'GRACE1');
    expect(unexpired).toBeNull();

    // find() allows grace window membership resolution for Layer-3 Judge
    const inGrace = cache.find('session-1', 'GRACE1');
    expect(inGrace).not.toBeNull();
    expect(inGrace?.token_val).toBe('GRACE1');
  });

  it('maintains a ring buffer of recent tokens per session', () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      cache.set({
        session_uuid: 'session-ring',
        token_val: `TOK${i}`,
        created_at_epoch: now + (i * 3000),
        expires_at_epoch: now + (i * 3000) + 6000,
      });
    }

    const recent = cache.getRecentTokens('session-ring');
    expect(recent.length).toBe(5);
    expect(recent[0].token_val).toBe('TOK0');
    expect(recent[4].token_val).toBe('TOK4');
  });

  it('clears session tokens completely on clearSession', () => {
    const now = Date.now();
    cache.set({
      session_uuid: 'session-kill',
      token_val: 'DIE1',
      created_at_epoch: now,
      expires_at_epoch: now + 5000,
    });

    cache.clearSession('session-kill');
    expect(cache.find('session-kill', 'DIE1')).toBeNull();
    expect(cache.getRecentTokens('session-kill')).toHaveLength(0);
  });
});
