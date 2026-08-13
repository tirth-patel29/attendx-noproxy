// src/utils/apiError.ts
// Standardized error envelope for the whole API.
//
// Every failed request (4xx/5xx) returns EXACTLY:
//   {
//     "success": false,
//     "error": {
//       "code": "ERR_XXX",
//       "message": "human-readable",
//       "latency_ms": 310,            // only where relevant (stream detection)
//       "details": { ... }            // optional debug metadata
//     }
//   }
//
// Two enforcement layers:
//   1. Explicit: handlers can `sendError(res, status, code, message, opts)` or
//      `next(new ApiError(status, code, message, opts))`.
//   2. Safety net: the response-normalizer middleware in index.ts rewrites ANY
//      non-2xx payload that isn't already enveloped into the shape above
//      (inferring a code from the HTTP status). This guarantees uniformity
//      across every route without touching every call site.
import { Request, Response } from 'express';

export interface ErrorDetails {
  code: string;
  message: string;
  latency_ms?: number;
  details?: Record<string, unknown>;
}

export interface Envelope {
  success: boolean;
  error?: ErrorDetails;
}

/** Map an HTTP status to the zero-trust error dictionary code (fallback). */
export function inferErrorCode(status: number): string {
  switch (status) {
    case 400: return 'ERR_BAD_REQUEST';
    case 401: return 'ERR_AUTH_MISSING';
    case 403: return 'ERR_FORBIDDEN';
    case 404: return 'ERR_NOT_FOUND';
    case 406: return 'ERR_TOKEN_EXPIRED';
    case 409: return 'ERR_CONFLICT';
    case 412: return 'ERR_STREAM_DETECTED';
    case 422: return 'ERR_VALIDATION';
    case 429: return 'ERR_RATE_LIMIT';
    case 500: return 'ERR_INTERNAL';
    case 502: return 'ERR_BAD_GATEWAY';
    case 503: return 'ERR_UNAVAILABLE';
    default: return 'ERR_UNKNOWN';
  }
}

/** Thrown or `next()`-ed; the final handler turns it into the envelope. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  latencyMs?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    opts: { details?: Record<string, unknown>; latencyMs?: number } = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = opts.details;
    this.latencyMs = opts.latencyMs;
  }
}

/** Explicit helper: respond immediately with a standardized envelope. */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  opts: { details?: Record<string, unknown>; latencyMs?: number } = {},
): void {
  const error: ErrorDetails = { code, message };
  if (opts.latencyMs !== undefined) error.latency_ms = opts.latencyMs;
  if (opts.details !== undefined && Object.keys(opts.details).length > 0) {
    error.details = opts.details;
  }
  res.status(status).json({ success: false, error });
}

/**
 * Normalize an arbitrary non-2xx payload into the envelope.
 * Used by the safety-net middleware — idempotent for already-enveloped bodies.
 */
export function normalizeErrorBody(body: unknown, status: number): Envelope {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    // Already enveloped -> pass through unchanged.
    if (b.success === false && b.error && typeof b.error === 'object') {
      return b as unknown as Envelope;
    }
    // Handler already provided a code + message (e.g. { error: 'CODE', message }).
    const rawError = b.error;
    if (rawError && typeof rawError === 'object') {
      const e = rawError as Record<string, unknown>;
      if (typeof e.code === 'string') {
        return {
          success: false,
          error: {
            code: e.code,
            message: (e.message as string) || 'Request failed',
            ...(typeof e.latency_ms === 'number' ? { latency_ms: e.latency_ms } : {}),
            ...(e.details ? { details: e.details as Record<string, unknown> } : {}),
          },
        };
      }
    }
    // Plain string error or message -> infer the code from the status.
    const msg =
      (typeof rawError === 'string' && rawError) ||
      (typeof b.message === 'string' && b.message) ||
      'Request failed';
    return { success: false, error: { code: inferErrorCode(status), message: msg } };
  }
  // Non-object (e.g. text) — Express .json() only sends objects, but be safe.
  return {
    success: false,
    error: { code: inferErrorCode(status), message: String(body ?? 'Request failed') },
  };
}

/** Convenience for auth middleware: extract best-effort client IP. */
export function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.length) return cf;
  return req.ip || 'unknown';
}