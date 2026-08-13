import dotenv from 'dotenv';
dotenv.config();

/**
 * CORS_ORIGIN supports a comma-separated list of allowed origins:
 *   CORS_ORIGIN="https://portal.atmyhome.tech,https://admin.atmyhome.tech"
 * When unset, same-origin requests are allowed (empty array = no cross-origin).
 */
function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database (PostgreSQL / Supabase)
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    // Connection pool: sized for high-concurrency claim herds. Each claim now
    // runs ~2 fast statements (atomic nonce UPDATE + ledger INSERT) plus one
    // PK-indexed student read; keep healthy headroom above peak contention.
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  // Metronome settings (SRS §1 Phase 2: cryptographically random base62 token,
  // 4 characters, rotated every 3 seconds) — all env-tunable.
  metronome: {
    intervalMs: parseInt(process.env.METRONOME_INTERVAL_MS || '3000', 10),
    tokenLength: parseInt(process.env.METRONOME_TOKEN_LENGTH || '4', 10),
    tokenCharset:
      process.env.METRONOME_TOKEN_CHARSET ||
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', // base62
    lookaheadTokens: parseInt(process.env.METRONOME_LOOKAHEAD_TOKENS || '2', 10),
  },

  // Judge settings (SRS §3 Proof 2: the 250ms Universal Stream Kill-Window)
  judge: {
    maxLatencyMs: parseInt(process.env.JUDGE_MAX_LATENCY_MS || '250', 10),
    tokenValidityWindowMs: parseInt(process.env.JUDGE_TOKEN_VALIDITY_WINDOW_MS || '5000', 10),
  },

  // CORS — allow list for the Express API and the Socket.IO handshake
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars-long',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Admin bootstrap (reliable, configurable admin initialization)
  // When ADMIN_EMAIL + ADMIN_PASSWORD are set, the server ensures the admin
  // exists on boot — creating it or rotating its password every restart.
  admin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'System Admin',
  },
};