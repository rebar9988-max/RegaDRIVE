-- RegaDRIVE student accounts — applied ONLY to the separate student D1 database `regadrive-students`
-- (binding STUDENT_DB). Never apply to `regadrive-db` (owner /dr database, binding DB).
-- Reviewed from docs/student-auth/student-schema.proposed.sql (PR #33). Forward-only.
-- No plaintext secrets: passwords are PBKDF2 hashes, codes and session tokens are SHA-256 hashes.

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email_normalized) BETWEEN 6 AND 254 AND email_normalized = lower(email_normalized) COLLATE BINARY),
  display_name TEXT NOT NULL DEFAULT '' CHECK (length(display_name) <= 60),
  password_hash TEXT NOT NULL CHECK (password_hash LIKE 'pbkdf2-sha256$%'),
  lang TEXT NOT NULL DEFAULT 'ckb' CHECK (lang IN ('ckb','kmr','ar','de')),
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_students_unverified ON students(email_verified_at, created_at);

-- One-time 6-digit codes for e-mail verification and password reset.
CREATE TABLE IF NOT EXISTS email_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_email_challenges_student ON email_challenges(student_id, purpose, created_at);
CREATE INDEX IF NOT EXISTS idx_email_challenges_expiry ON email_challenges(expires_at);

CREATE TABLE IF NOT EXISTS student_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_student_sessions_student ON student_sessions(student_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_student_sessions_expiry ON student_sessions(expires_at);

-- Opt-in backup of the learner's local progress (the device copy always stays the primary copy).
CREATE TABLE IF NOT EXISTS student_progress (
  student_id TEXT PRIMARY KEY NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json) AND length(payload_json) <= 262144),
  version INTEGER NOT NULL CHECK (version >= 1),
  updated_at INTEGER NOT NULL
);

-- Security events without IP addresses, e-mail addresses, codes or passwords. Retention: 90 days.
CREATE TABLE IF NOT EXISTS student_auth_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (length(event_type) <= 40),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_student_auth_events_created ON student_auth_events(created_at);

-- Shared, durable rate-limit counters (isolate memory is not reliable). Buckets hold hashed keys only. Retention: 24 h.
CREATE TABLE IF NOT EXISTS student_rate_events (
  bucket TEXT NOT NULL CHECK (length(bucket) <= 100),
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_student_rate_events ON student_rate_events(bucket, at);
CREATE INDEX IF NOT EXISTS idx_student_rate_events_at ON student_rate_events(at);
