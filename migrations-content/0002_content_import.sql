-- RegaDRIVE D1 schema v2: licensed content import, media, translations, versions, reviews.
-- LOCAL TESTING ONLY. Production database is disabled; never apply remotely without explicit owner approval.

-- Question extensions -------------------------------------------------------
ALTER TABLE questions ADD COLUMN answer_type TEXT NOT NULL DEFAULT 'choice' CHECK (answer_type IN ('choice','number'));
ALTER TABLE questions ADD COLUMN numeric_answer REAL;
ALTER TABLE questions ADD COLUMN catalogue_version TEXT;
ALTER TABLE questions ADD COLUMN content_hash TEXT;
ALTER TABLE questions ADD COLUMN stage TEXT NOT NULL DEFAULT 'DRAFT'
  CHECK (stage IN ('DRAFT','SOURCE_CHECK','LICENSE_CHECK','TRANSLATION_REVIEW','EDUCATIONAL_REVIEW','APPROVED','PUBLISHED'));
CREATE INDEX idx_questions_hash ON questions(content_hash);
CREATE INDEX idx_questions_stage ON questions(stage, publication_status);

-- Answer shape must match the answer type.
CREATE TRIGGER trg_questions_number_answer BEFORE INSERT ON questions
WHEN NEW.answer_type = 'number' AND NEW.numeric_answer IS NULL
BEGIN SELECT RAISE(ABORT, 'number questions need numeric_answer'); END;

-- Licensed official German wording is immutable: changes must arrive as a new version.
CREATE TRIGGER trg_licensed_wording_immutable BEFORE UPDATE OF prompt_de, question_code, points ON questions
WHEN OLD.source_type = 'licensed_official'
 AND (NEW.prompt_de IS NOT OLD.prompt_de OR NEW.question_code IS NOT OLD.question_code OR NEW.points IS NOT OLD.points)
BEGIN SELECT RAISE(ABORT, 'licensed official wording is immutable; import a new version'); END;

CREATE TRIGGER trg_licensed_options_immutable BEFORE UPDATE OF text_de, is_correct ON answer_options
WHEN (SELECT source_type FROM questions WHERE id = OLD.question_id) = 'licensed_official'
BEGIN SELECT RAISE(ABORT, 'licensed official answer options are immutable; import a new version'); END;

-- Review evidence -------------------------------------------------------------
CREATE TABLE content_reviews (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  content_kind TEXT NOT NULL CHECK (content_kind IN ('question','lesson','sign','vocabulary','media')),
  stage TEXT NOT NULL CHECK (stage IN ('SOURCE_CHECK','LICENSE_CHECK','TRANSLATION_REVIEW','EDUCATIONAL_REVIEW','APPROVED')),
  reviewer TEXT NOT NULL CHECK (length(reviewer) > 0),
  role TEXT NOT NULL CHECK (role IN ('automated','driving_instructor','sorani_translator','content_owner')),
  outcome TEXT NOT NULL CHECK (outcome IN ('pass','fail')),
  evidence_ref TEXT NOT NULL CHECK (length(evidence_ref) > 0),
  content_hash TEXT,
  created_at INTEGER NOT NULL,
  -- Human stages can never be signed off automatically.
  CHECK (stage IN ('SOURCE_CHECK','LICENSE_CHECK') OR role <> 'automated')
);
CREATE INDEX idx_reviews_content ON content_reviews(content_id, stage);

-- No automatic publication: publishing needs a passed, owner APPROVED review of the current content.
CREATE TRIGGER trg_publish_requires_approval_ins BEFORE INSERT ON questions
WHEN NEW.publication_status = 'published'
BEGIN SELECT RAISE(ABORT, 'new questions are always inserted hidden'); END;

CREATE TRIGGER trg_publish_requires_approval_upd BEFORE UPDATE OF publication_status ON questions
WHEN NEW.publication_status = 'published' AND (
  NEW.stage NOT IN ('APPROVED','PUBLISHED')
  OR NOT EXISTS (SELECT 1 FROM content_reviews r WHERE r.content_id = NEW.id AND r.stage = 'APPROVED' AND r.outcome = 'pass'
                 AND r.role = 'content_owner' AND (NEW.content_hash IS NULL OR r.content_hash = NEW.content_hash))
  OR (NEW.source_type = 'licensed_official' AND NEW.license_id IS NULL)
)
BEGIN SELECT RAISE(ABORT, 'publication requires an owner APPROVED review of this exact content'); END;

-- Translations (Sorani editing without touching the German original) ---------
CREATE TABLE question_translations (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  field TEXT NOT NULL CHECK (field IN ('prompt','explanation','option:a','option:b','option:c','option:d','option:e','media_alt')),
  locale TEXT NOT NULL CHECK (locale IN ('ckb')),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 4000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved')),
  translator TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (question_id, field, locale)
);

-- Media -------------------------------------------------------------------------
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  storage_key TEXT NOT NULL UNIQUE CHECK (storage_key GLOB 'media/[0-9a-f]*.*'),
  sha256 TEXT NOT NULL UNIQUE CHECK (length(sha256) = 64),
  mime TEXT NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp','video/mp4','video/webm')),
  bytes INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 26214400),
  width INTEGER, height INTEGER, duration_ms INTEGER,
  license_id TEXT REFERENCES content_licenses(id),
  uploaded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE question_media (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('stimulus','poster')),
  position INTEGER NOT NULL DEFAULT 0,
  alt_de TEXT NOT NULL CHECK (length(alt_de) > 0),
  alt_ckb TEXT,
  PRIMARY KEY (question_id, media_id, role)
);

-- Version history (every import that changes content creates a new version) -----
CREATE TABLE question_versions (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  content_hash TEXT NOT NULL,
  catalogue_version TEXT,
  snapshot TEXT NOT NULL CHECK (json_valid(snapshot)),
  import_batch_id TEXT REFERENCES import_batches(id),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (question_id, version),
  UNIQUE (question_id, content_hash)
);

-- Import batches and their errors -----------------------------------------------
CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL CHECK (format IN ('json','csv','manual')),
  file_name TEXT,
  file_sha256 TEXT,
  uploaded_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('validated','committed','rejected')),
  rows_total INTEGER NOT NULL CHECK (rows_total >= 0),
  rows_new INTEGER NOT NULL DEFAULT 0,
  rows_update INTEGER NOT NULL DEFAULT 0,
  rows_duplicate INTEGER NOT NULL DEFAULT 0,
  rows_invalid INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  committed_at INTEGER,
  CHECK (status <> 'committed' OR rows_invalid = 0)
);
CREATE UNIQUE INDEX idx_import_batches_file ON import_batches(file_sha256) WHERE status = 'committed';

CREATE TABLE import_errors (
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  field TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('error','warning'))
);
CREATE INDEX idx_import_errors_batch ON import_errors(batch_id, row_index);
