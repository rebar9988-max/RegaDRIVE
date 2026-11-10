-- Student-only D1 schema. Apply ONLY to a separate student D1 database after review.
-- Never apply to regadrive-db (owner /dr database).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
 id TEXT PRIMARY KEY NOT NULL,
 email_normalized TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 email_verified_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_students_created ON students(created_at);

CREATE TABLE IF NOT EXISTS email_challenges (
 id TEXT PRIMARY KEY NOT NULL,
 student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify_email','reset_password')),
 code_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_challenges_student ON email_challenges(student_id, purpose, expires_at);

CREATE TABLE IF NOT EXISTS student_sessions (
 id TEXT PRIMARY KEY NOT NULL,
 student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_student_sessions_student ON student_sessions(student_id, expires_at);

CREATE TABLE IF NOT EXISTS student_progress (
 student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 item_key TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version >= 1),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(student_id, item_key)
);

CREATE TABLE IF NOT EXISTS student_auth_events (
 id TEXT PRIMARY KEY NOT NULL,
 student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
 event_type TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_student_auth_events_created ON student_auth_events(created_at);
