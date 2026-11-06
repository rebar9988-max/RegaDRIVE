-- RegaDRIVE D1 schema v1. LOCAL TESTING ONLY: production database is disabled (DATABASE_PRODUCTION_ENABLED=false).
-- Never apply remotely without explicit owner approval (docs/OWNER_ACTIVATION.md).
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email_verified_at INTEGER,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE student_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  avatar_key TEXT,
  lang_mode TEXT NOT NULL DEFAULT 'bi' CHECK (lang_mode IN ('bi','ckb','de')),
  privacy_settings TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(privacy_settings)),
  created_at INTEGER NOT NULL
);

CREATE TABLE email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify','reset','change_email')),
  new_email TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_email_verifications_user ON email_verifications(user_id);

CREATE TABLE authorized_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX idx_devices_user ON authorized_devices(user_id, revoked_at);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES authorized_devices(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (expires_at > created_at)
);
CREATE INDEX idx_sessions_user ON sessions(user_id, revoked_at);

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  state TEXT NOT NULL CHECK (state IN ('NOT_PURCHASED','PAYMENT_PENDING','ACTIVE_LIFETIME','PAYMENT_FAILED','REFUNDED','REVOKED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (provider, provider_ref)
);
CREATE INDEX idx_orders_user ON purchase_orders(user_id);

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,                 -- provider event id = idempotency key
  order_id TEXT REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  signature_verified INTEGER NOT NULL CHECK (signature_verified IN (0,1)),
  received_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE TABLE student_entitlements (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('NOT_PURCHASED','PAYMENT_PENDING','ACTIVE_LIFETIME','PAYMENT_FAILED','REFUNDED','REVOKED')),
  order_id TEXT REFERENCES purchase_orders(id),
  updated_at INTEGER NOT NULL
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  title_ckb TEXT NOT NULL, title_de TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Grundstoff','Zusatzstoff'))
);

CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  title_ckb TEXT NOT NULL, title_de TEXT NOT NULL,
  body_json TEXT NOT NULL CHECK (json_valid(body_json)),
  content_version TEXT NOT NULL,
  publication_status TEXT NOT NULL DEFAULT 'hidden' CHECK (publication_status IN ('published','hidden'))
);

CREATE TABLE content_licenses (
  id TEXT PRIMARY KEY,
  licensor TEXT NOT NULL,
  scope TEXT NOT NULL,
  valid_from INTEGER NOT NULL,
  valid_until INTEGER,
  evidence_ref TEXT NOT NULL
);

CREATE TABLE traffic_signs (
  id TEXT PRIMARY KEY,
  stvo_number TEXT NOT NULL UNIQUE,
  name_ckb TEXT NOT NULL, name_de TEXT NOT NULL,
  meaning_ckb TEXT NOT NULL, meaning_de TEXT NOT NULL,
  media_key TEXT
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  question_code TEXT UNIQUE,
  points INTEGER CHECK (points IN (2,3,4,5)),
  category_type TEXT NOT NULL CHECK (category_type IN ('Grundstoff','Zusatzstoff')),
  license_classes TEXT NOT NULL CHECK (json_valid(license_classes)),
  source_type TEXT NOT NULL CHECK (source_type IN ('original','licensed_official')),
  license_id TEXT REFERENCES content_licenses(id),
  content_version TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','pending','approved')),
  publication_status TEXT NOT NULL DEFAULT 'hidden' CHECK (publication_status IN ('published','hidden')),
  prompt_ckb TEXT NOT NULL, prompt_de TEXT NOT NULL,
  explanation_ckb TEXT NOT NULL, explanation_de TEXT NOT NULL,
  sign_id TEXT REFERENCES traffic_signs(id),
  media_key TEXT,
  -- Licensed official questions must reference a licence; original ones must not claim an official code.
  CHECK ((source_type = 'licensed_official' AND license_id IS NOT NULL) OR (source_type = 'original' AND question_code IS NULL))
);
CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_questions_filter ON questions(category_type, points, publication_status);

CREATE TABLE answer_options (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  text_ckb TEXT NOT NULL, text_de TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  PRIMARY KEY (question_id, option_id),
  UNIQUE (question_id, position)
);

CREATE TABLE vocabulary (
  id TEXT PRIMARY KEY,
  term_de TEXT NOT NULL,
  article TEXT CHECK (article IN ('der','die','das')),
  term_ckb TEXT NOT NULL,
  note_ckb TEXT, note_de TEXT
);

CREATE TABLE learning_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  last_answered_at INTEGER,
  PRIMARY KEY (user_id, question_id),
  CHECK (correct_count <= attempts)
);

CREATE TABLE practice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);
-- One scored answer per question per session (no duplicate scoring).
CREATE TABLE practice_answers (
  session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  correct INTEGER NOT NULL CHECK (correct IN (0,1)),
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, question_id)
);

CREATE TABLE mock_exam_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rules_version TEXT NOT NULL,
  total_points INTEGER NOT NULL,
  error_points INTEGER NOT NULL CHECK (error_points >= 0),
  passed INTEGER NOT NULL CHECK (passed IN (0,1)),
  taken_at INTEGER NOT NULL
);
CREATE INDEX idx_exam_user ON mock_exam_results(user_id, taken_at);

CREATE TABLE bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE security_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  detail TEXT CHECK (detail IS NULL OR json_valid(detail)),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_user ON security_audit_logs(user_id, created_at);

CREATE TABLE owner_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
