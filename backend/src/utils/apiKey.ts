// src/utils/apiKey.ts
// Shared client API-key plumbing.
//
// Model: an admin mints a key in the console (POST /admin/api-keys); the raw
// key is handed to a consumer who embeds it in their client (the student APK
// built with --dart-define=API_KEY=...). Every client request presents the key
// via the `X-Api-Key` header; the backend hashes it and looks it up. It is a
// transport-level gate — per-user JWT identity (student/professor/admin) sits
// on top and is unchanged.
//
// Security note: an embedded shared secret is extractable from the binary, so
// this is a licensing/throttling gate, NOT identity. That is the intended model
// ("one generated key, works for whoever wires it up").
import { createHash, randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { query } from './db';

const RAW_PREFIX = 'ag';
const RAW_BYTES = 24;

/** Deterministic SHA-256 of a raw key. Only this is persisted. */
export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Generate a fresh key: `ag_<base64url>`. Returns raw (show once) + hash + prefix. */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `${RAW_PREFIX}_${randomBytes(RAW_BYTES).toString('base64url')}`;
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 12) };
}

/**
 * Express middleware. Accepts `X-Api-Key: <key>` (primary) or
 * `Authorization: Bearer <key>` (fallback). Rejects with 401 if missing,
 * unknown, or revoked.
 */
export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers['x-api-key'];
    let raw: string | undefined;
    if (typeof header === 'string' && header.length > 0) {
      raw = header;
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      raw = req.headers.authorization.slice(7);
    }

    if (!raw) {
      res.status(401).json({
        error: 'missing_api_key',
        message: 'An API key is required. Set the X-Api-Key header.',
      });
      return;
    }

    const hash = hashApiKey(raw);
    const r = await query(
      `SELECT key_uuid, label, prefix, status, last_used_at
       FROM api_keys
       WHERE key_hash = $1 AND status = 'active'`,
      [hash],
    );
    if (!r.rows.length) {
      res.status(401).json({ error: 'invalid_api_key' });
      return;
    }

    // Fire-and-forget usage heartbeat (do not block the request on it).
    query('UPDATE api_keys SET last_used_at = now() WHERE key_uuid = $1', [r.rows[0].key_uuid]).catch(() => {});

    (req as any).apiKey = r.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
