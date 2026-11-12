-- RegaDRIVE D1 schema v5: licence rights and verification, media provenance, reusable 3D scenes,
-- version-controlled updates of licensed wording, import rollback records, country separation.
-- Forward-only and additive (no table is dropped, no row is deleted). LOCAL TESTING ONLY until the owner
-- approves the production content database (docs/OWNER_ACTIVATION.md). Never apply remotely without approval.

-- ── Country separation (Germany / Italy never share a bank or a licence) ─────────────────────────
ALTER TABLE questions ADD COLUMN country TEXT NOT NULL DEFAULT 'DE' CHECK (country IN ('DE','IT'));
ALTER TABLE content_licenses ADD COLUMN country TEXT NOT NULL DEFAULT 'DE' CHECK (country IN ('DE','IT'));
CREATE INDEX idx_questions_country ON questions(country, publication_status);

-- ── Licence rights and verification ──────────────────────────────────────────────────────────────
-- A licence is usable only as 'verified'. Every right is OFF until the owner confirms it from the signed
-- contract; nothing is assumed (translation and own-media rights in particular).
ALTER TABLE content_licenses ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','verified','suspended','expired','revoked'));
ALTER TABLE content_licenses ADD COLUMN verified_by TEXT;
ALTER TABLE content_licenses ADD COLUMN verified_at INTEGER;
ALTER TABLE content_licenses ADD COLUMN right_question_text INTEGER NOT NULL DEFAULT 0 CHECK (right_question_text IN (0,1));
ALTER TABLE content_licenses ADD COLUMN right_official_media INTEGER NOT NULL DEFAULT 0 CHECK (right_official_media IN (0,1));
ALTER TABLE content_licenses ADD COLUMN right_translation INTEGER NOT NULL DEFAULT 0 CHECK (right_translation IN (0,1));
ALTER TABLE content_licenses ADD COLUMN right_own_media INTEGER NOT NULL DEFAULT 0 CHECK (right_own_media IN (0,1));
ALTER TABLE content_licenses ADD COLUMN right_online INTEGER NOT NULL DEFAULT 0 CHECK (right_online IN (0,1));
ALTER TABLE content_licenses ADD COLUMN right_offline INTEGER NOT NULL DEFAULT 0 CHECK (right_offline IN (0,1));
ALTER TABLE content_licenses ADD COLUMN catalogue_versions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(catalogue_versions));
ALTER TABLE content_licenses ADD COLUMN license_classes TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(license_classes));
ALTER TABLE content_licenses ADD COLUMN attribution_text TEXT;

CREATE TRIGGER trg_license_verified_ins BEFORE INSERT ON content_licenses
WHEN NEW.status = 'verified' AND (NEW.verified_by IS NULL OR length(trim(NEW.verified_by)) = 0 OR NEW.verified_at IS NULL OR length(trim(NEW.evidence_ref)) = 0)
BEGIN SELECT RAISE(ABORT, 'a verified licence needs the owner, the date and the contract reference'); END;

CREATE TRIGGER trg_license_verified_upd BEFORE UPDATE ON content_licenses
WHEN NEW.status = 'verified' AND (NEW.verified_by IS NULL OR length(trim(NEW.verified_by)) = 0 OR NEW.verified_at IS NULL OR length(trim(NEW.evidence_ref)) = 0)
BEGIN SELECT RAISE(ABORT, 'a verified licence needs the owner, the date and the contract reference'); END;

-- Losing the licence (suspended, expired, revoked, back to draft) hides everything that depends on it at once.
CREATE TRIGGER trg_license_lost_hides_content AFTER UPDATE OF status ON content_licenses
WHEN NEW.status <> 'verified' AND OLD.status = 'verified'
BEGIN UPDATE questions SET publication_status = 'hidden' WHERE license_id = NEW.id AND publication_status = 'published'; END;

-- A question and its licence belong to the same country.
CREATE TRIGGER trg_question_license_country BEFORE INSERT ON questions
WHEN NEW.license_id IS NOT NULL AND NEW.country IS NOT (SELECT country FROM content_licenses WHERE id = NEW.license_id)
BEGIN SELECT RAISE(ABORT, 'question and licence must belong to the same country'); END;

-- Licensed content is published only under a verified licence that is in force today, covers this catalogue
-- release, grants the question text for online use, and grants translation when Sorani text is attached.
CREATE TRIGGER trg_publish_requires_license_rights BEFORE UPDATE OF publication_status ON questions
WHEN NEW.publication_status = 'published' AND NEW.source_type = 'licensed_official' AND NOT EXISTS (
  SELECT 1 FROM content_licenses l
  WHERE l.id = NEW.license_id AND l.status = 'verified' AND l.country = NEW.country
    AND l.right_question_text = 1 AND l.right_online = 1
    AND l.valid_from <= CAST(strftime('%s','now') AS INTEGER) * 1000
    AND (l.valid_until IS NULL OR l.valid_until > CAST(strftime('%s','now') AS INTEGER) * 1000)
    AND EXISTS (SELECT 1 FROM json_each(l.catalogue_versions) WHERE value = NEW.catalogue_version)
    AND (l.right_translation = 1 OR (length(NEW.prompt_ckb) = 0 AND length(NEW.explanation_ckb) = 0
         AND NOT EXISTS (SELECT 1 FROM answer_options o WHERE o.question_id = NEW.id AND length(o.text_ckb) > 0)))
)
BEGIN SELECT RAISE(ABORT, 'licensed content needs a verified licence in force that covers this catalogue release and these rights'); END;

-- A Sorani translation of licensed wording is approved only when the licence grants translation.
CREATE TRIGGER trg_translation_needs_right_ins BEFORE INSERT ON question_translations
WHEN NEW.status = 'approved' AND (SELECT source_type FROM questions WHERE id = NEW.question_id) = 'licensed_official'
 AND NOT EXISTS (SELECT 1 FROM content_licenses l JOIN questions q ON q.license_id = l.id WHERE q.id = NEW.question_id AND l.status = 'verified' AND l.right_translation = 1)
BEGIN SELECT RAISE(ABORT, 'the licence does not grant translation of this content'); END;

CREATE TRIGGER trg_translation_needs_right_upd BEFORE UPDATE OF status ON question_translations
WHEN NEW.status = 'approved' AND (SELECT source_type FROM questions WHERE id = NEW.question_id) = 'licensed_official'
 AND NOT EXISTS (SELECT 1 FROM content_licenses l JOIN questions q ON q.license_id = l.id WHERE q.id = NEW.question_id AND l.status = 'verified' AND l.right_translation = 1)
BEGIN SELECT RAISE(ABORT, 'the licence does not grant translation of this content'); END;

-- ── Version-controlled updates of licensed wording ───────────────────────────────────────────────
-- The live row may change only to content that is already recorded as a version (new catalogue release or a
-- rollback to an earlier one). The earlier trigger refused every change, which made updates impossible.
DROP TRIGGER trg_licensed_wording_immutable;
CREATE TRIGGER trg_licensed_wording_versioned BEFORE UPDATE OF prompt_de, question_code, points ON questions
WHEN OLD.source_type = 'licensed_official'
 AND (NEW.prompt_de IS NOT OLD.prompt_de OR NEW.question_code IS NOT OLD.question_code OR NEW.points IS NOT OLD.points)
 AND (NEW.question_code IS NOT OLD.question_code OR NEW.content_hash IS OLD.content_hash
      OR NOT EXISTS (SELECT 1 FROM question_versions v WHERE v.question_id = NEW.id AND v.content_hash = NEW.content_hash))
BEGIN SELECT RAISE(ABORT, 'licensed official wording changes only to a recorded version; the official number never changes'); END;

-- Any change of content takes the question offline until it is approved and published again.
CREATE TRIGGER trg_content_change_unpublishes AFTER UPDATE OF content_hash ON questions
WHEN NEW.content_hash IS NOT OLD.content_hash
BEGIN UPDATE questions SET publication_status = 'hidden', stage = 'DRAFT', review_status = 'draft' WHERE id = NEW.id; END;

-- ── Import rollback (the batch table keeps its history; a rollback is its own record) ────────────
CREATE TABLE import_rollbacks (
  batch_id TEXT PRIMARY KEY REFERENCES import_batches(id),
  rolled_back_by TEXT NOT NULL CHECK (length(rolled_back_by) > 0),
  reason TEXT NOT NULL CHECK (length(reason) > 0),
  questions_removed INTEGER NOT NULL DEFAULT 0 CHECK (questions_removed >= 0),
  questions_restored INTEGER NOT NULL DEFAULT 0 CHECK (questions_restored >= 0),
  created_at INTEGER NOT NULL
);

-- ── Media provenance, scenario sheets, reusable 3D scenes, variants ──────────────────────────────
CREATE TABLE scenario_sheets (
  id TEXT PRIMARY KEY,
  description_de TEXT NOT NULL CHECK (length(description_de) > 0),
  signs TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(signs)),
  legal_refs TEXT NOT NULL CHECK (json_valid(legal_refs) AND json_array_length(legal_refs) > 0),
  expected_behaviour_de TEXT NOT NULL CHECK (length(expected_behaviour_de) > 0),
  approved_by TEXT,
  approved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE scenario_questions (
  scenario_id TEXT NOT NULL REFERENCES scenario_sheets(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (scenario_id, question_id)
);

-- Self-made, reusable building blocks (road segments, junctions, vehicles, signs, camera rig …).
CREATE TABLE scene_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('road','junction','roundabout','motorway','crossing','vehicle','sign','character','environment','rig')),
  tool TEXT NOT NULL CHECK (length(tool) > 0),
  source_file TEXT NOT NULL CHECK (length(source_file) > 0),
  author TEXT NOT NULL CHECK (length(author) > 0),
  third_party_assets TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(third_party_assets)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL
);

CREATE TABLE media_provenance (
  media_id TEXT PRIMARY KEY REFERENCES media_assets(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK (origin IN ('original_regadrive','licensed')),
  author TEXT NOT NULL CHECK (length(author) > 0),
  tool TEXT,
  source_file TEXT,
  third_party_assets TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(third_party_assets)),
  ai_generated INTEGER NOT NULL DEFAULT 0 CHECK (ai_generated IN (0,1)),
  scenario_id TEXT REFERENCES scenario_sheets(id),
  created_at INTEGER NOT NULL,
  -- Original work proves itself with the tool and the editable source; licensed media is tied to its licence.
  CHECK (origin <> 'original_regadrive' OR (tool IS NOT NULL AND length(tool) > 0 AND source_file IS NOT NULL AND length(source_file) > 0))
);
CREATE TRIGGER trg_media_origin_matches_license BEFORE INSERT ON media_provenance
WHEN (NEW.origin = 'licensed') IS NOT ((SELECT license_id FROM media_assets WHERE id = NEW.media_id) IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'licensed media carries a licence id; original media carries none'); END;

CREATE TABLE media_scene_use (
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL REFERENCES scene_library(id) ON DELETE RESTRICT,
  PRIMARY KEY (media_id, scene_id)
);

-- Delivery variants of one picture or clip (poster frame, small thumbnail, second video container).
CREATE TABLE media_variants (
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('poster','thumbnail','mp4','webm')),
  variant_media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY (media_id, role),
  CHECK (media_id <> variant_media_id)
);

-- Media may be attached to a licensed question only when the licence grants that kind of media:
-- official media needs right_official_media, RegaDRIVE's own media needs right_own_media.
CREATE TRIGGER trg_question_media_needs_right BEFORE INSERT ON question_media
WHEN (SELECT source_type FROM questions WHERE id = NEW.question_id) = 'licensed_official' AND NOT EXISTS (
  SELECT 1 FROM questions q JOIN content_licenses l ON l.id = q.license_id JOIN media_assets m ON m.id = NEW.media_id
  WHERE q.id = NEW.question_id AND ((m.license_id IS NOT NULL AND l.right_official_media = 1) OR (m.license_id IS NULL AND l.right_own_media = 1))
)
BEGIN SELECT RAISE(ABORT, 'the licence does not grant this kind of media for licensed questions'); END;

-- A question is published only when every attached picture or clip has its provenance on record and a passed
-- driving-instructor review of exactly this file (content_reviews.content_hash = media sha256).
CREATE TRIGGER trg_publish_requires_media_review BEFORE UPDATE OF publication_status ON questions
WHEN NEW.publication_status = 'published' AND EXISTS (
  SELECT 1 FROM question_media qm JOIN media_assets m ON m.id = qm.media_id
  WHERE qm.question_id = NEW.id AND (
    NOT EXISTS (SELECT 1 FROM media_provenance p WHERE p.media_id = m.id)
    OR NOT EXISTS (SELECT 1 FROM content_reviews r WHERE r.content_kind = 'media' AND r.content_id = m.id AND r.stage = 'EDUCATIONAL_REVIEW'
                   AND r.role = 'driving_instructor' AND r.outcome = 'pass' AND r.content_hash = m.sha256)
  )
)
BEGIN SELECT RAISE(ABORT, 'every attached media file needs provenance and a passed instructor review of this exact file'); END;
