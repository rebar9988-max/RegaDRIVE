-- RegaDRIVE /dr owner control center (owner-approved 2026-11-07: production D1 `regadrive-db` for the admin panel).
-- Admin-only tables. Student tables from 0001/0002 stay unused while DATABASE_PRODUCTION_ENABLED=false.
-- Idempotent (IF NOT EXISTS) so it can be applied on its own to the production database.

CREATE TABLE IF NOT EXISTS dr_login_codes (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','step_up')),
  session_hash TEXT,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at INTEGER,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS dr_login_codes_created ON dr_login_codes(created_at);

CREATE TABLE IF NOT EXISTS dr_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  last_seen_at INTEGER NOT NULL,
  step_up_until INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS dr_feature_states (
  key TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('ON','OFF','LOCKED')),
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dr_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('allowed','denied','failed')),
  detail TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail)),
  ip TEXT
);
CREATE INDEX IF NOT EXISTS dr_audit_log_at ON dr_audit_log(at);

CREATE TABLE IF NOT EXISTS dr_rate_events (
  bucket TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS dr_rate_events_bucket ON dr_rate_events(bucket, at);

CREATE TABLE IF NOT EXISTS dr_backups (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  snapshot TEXT NOT NULL CHECK (json_valid(snapshot))
);

-- Server-side configuration that cannot live in wrangler.jsonc (e.g. the RegaDRIVE-only, sending-restricted mail key).
CREATE TABLE IF NOT EXISTS dr_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
