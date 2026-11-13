-- /dr Content Review & Approval: human review records for the Verkehrszeichen release (signs + sign quiz).
-- Additive and idempotent. Touches only the admin tables (dr_*); never student data. Applied by the owner.
-- A row is a review decision by a named human reviewer, recorded by the signed-in owner. Rows are never
-- updated or deleted: a withdrawn decision gets revoked_at (kept for the audit history).
CREATE TABLE IF NOT EXISTS dr_content_reviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id     TEXT    NOT NULL,
  content_kind   TEXT    NOT NULL CHECK (content_kind IN ('sign','signQuiz')),
  content_hash   TEXT    NOT NULL,
  content_version TEXT   NOT NULL,
  stage          TEXT    NOT NULL CHECK (stage IN ('TRANSLATION_REVIEW','EDUCATIONAL_REVIEW','APPROVED')),
  outcome        TEXT    NOT NULL CHECK (outcome IN ('pass','fail')),
  reviewer_name  TEXT    NOT NULL,
  reviewer_role  TEXT    NOT NULL CHECK (reviewer_role IN ('sorani_translator','driving_instructor','content_owner')),
  reviewed_on    TEXT    NOT NULL,
  evidence_ref   TEXT    NOT NULL,
  note           TEXT    NOT NULL DEFAULT '',
  rules_version  TEXT,
  recorded_by    TEXT    NOT NULL,
  recorded_at    INTEGER NOT NULL,
  revoked_at     INTEGER,
  revoked_by     TEXT,
  revoke_reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_dr_content_reviews_item ON dr_content_reviews (content_id, stage, recorded_at);
