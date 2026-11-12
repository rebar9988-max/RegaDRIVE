-- RegaDRIVE content database (D1 regadrive-content, binding CONTENT_DB). Owner-approved 2026-11-12.
-- Content tables only: no student, session or payment table lives here. Student accounts are in regadrive-students;
-- payments stay off. Every statement below is copied verbatim from migrations/0001_init.sql
-- (enforced by tests/migrations.check.mjs). Forward-only.
PRAGMA foreign_keys = ON;

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
