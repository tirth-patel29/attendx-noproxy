-- 007_api_keys.sql
-- Shared client API keys (transport-level gate for the client APK).
-- Only the SHA-256 *hash* of the key is ever stored — the raw key is shown to
-- the admin exactly once at mint time. Any active key authenticates a client
-- request (X-Api-Key header). Revocable per key.
CREATE TABLE IF NOT EXISTS api_keys (
  key_uuid     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash     TEXT NOT NULL UNIQUE,        -- sha256 hex of the raw key
  prefix       TEXT NOT NULL,               -- first chars, for the console UI
  label        TEXT NOT NULL,               -- human name e.g. "student-apk"
  status       TEXT NOT NULL DEFAULT 'active',  -- active | revoked
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
