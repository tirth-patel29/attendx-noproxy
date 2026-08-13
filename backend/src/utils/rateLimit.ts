// src/utils/rateLimit.ts
// Lightweight in-memory fixed-window rate limiter.
//
// Returns the standardized `429 ERR_RATE_LIMIT` envelope. Thresholds are
// intentionally generous so a legit classroom herd (dozens of claims in a few
// seconds) is never throttled — this is a broad abuse/hammering guard, not a
// per-user quota.
import { Request, Response, NextFunction } from 'express';
import { sendError, clientIp } from './apiError';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  skip?: (req: Request) => boolean;
}

export function rateLimit(opts: RateLimitOptions = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 600; // 600 req/min/IP -> won't trip a classroom herd
  const skip = opts.skip;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    if (skip && skip(req)) return next();

    const key = clientIp(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return sendError(res, 429, 'ERR_RATE_LIMIT', 'Too many requests. Please wait.');
    }

    // Opportunistic cleanup to bound memory.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k);
      }
    }
    next();
  };
}
