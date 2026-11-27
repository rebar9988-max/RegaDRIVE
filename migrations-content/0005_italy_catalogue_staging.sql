-- Private staging for the supplied Italian catalogue (7,020 true/false questions) and its draft
-- Sorani (ckb) and Duhok Badini (kmr_arab) translations.
--
-- This table is never read by a learner route and can never publish anything:
--   * publish_status is fixed to 'unpublished' by a CHECK constraint;
--   * a language status can only become 'approved' together with a named human reviewer and a date;
--   * the source wording, answer key and hashes are immutable once staged (trigger below).
-- Rights for the source text and images, Class B eligibility, chapter mapping, explanations and legal
-- references are still unverified; the regular italy_content import and the /dr review gates apply
-- before any item can reach a learner. The rows themselves are loaded from a private package outside
-- this public repository (scripts/build-italy-staging-sql.mjs), never committed.
CREATE TABLE IF NOT EXISTS italy_catalogue_staging (
  source_id TEXT PRIMARY KEY CHECK (length(source_id) BETWEEN 1 AND 16),
  country TEXT NOT NULL DEFAULT 'IT' CHECK (country = 'IT'),
  license_class TEXT NOT NULL DEFAULT 'B',
  source_row_sha256 TEXT NOT NULL CHECK (length(source_row_sha256) = 64),
  batch TEXT NOT NULL,
  question_it TEXT NOT NULL CHECK (length(question_it) > 0),
  correct_answer INTEGER NOT NULL CHECK (correct_answer IN (0, 1)),
  answer_original TEXT NOT NULL CHECK (answer_original IN ('VERO', 'FALSO')),
  source_page INTEGER,
  source_group TEXT,
  image TEXT,
  image_sha256 TEXT CHECK (image_sha256 IS NULL OR length(image_sha256) = 64),
  ckb TEXT,
  kmr_arab TEXT,
  translation_notes TEXT,
  ckb_status TEXT NOT NULL DEFAULT 'pending' CHECK (ckb_status IN ('pending', 'needs_revision', 'approved')),
  kmr_arab_status TEXT NOT NULL DEFAULT 'pending' CHECK (kmr_arab_status IN ('pending', 'needs_revision', 'approved')),
  reviewer_name TEXT,
  review_date TEXT,
  review_notes TEXT,
  publish_status TEXT NOT NULL DEFAULT 'unpublished' CHECK (publish_status = 'unpublished'),
  staged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((correct_answer = 1) = (answer_original = 'VERO')),
  CHECK (
    (ckb_status <> 'approved' AND kmr_arab_status <> 'approved')
    OR (reviewer_name IS NOT NULL AND length(trim(reviewer_name)) > 1 AND review_date IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_italy_catalogue_staging_batch ON italy_catalogue_staging(batch);
CREATE INDEX IF NOT EXISTS idx_italy_catalogue_staging_status ON italy_catalogue_staging(ckb_status, kmr_arab_status);

-- The source record is the reference a reviewer compares against: it may never change in place.
CREATE TRIGGER IF NOT EXISTS italy_catalogue_staging_source_immutable
BEFORE UPDATE OF source_id, source_row_sha256, question_it, correct_answer, answer_original, image, image_sha256
ON italy_catalogue_staging
BEGIN
  SELECT RAISE(ABORT, 'italy_catalogue_staging source record is immutable');
END;
