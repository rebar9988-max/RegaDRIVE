-- RegaDRIVE-only FreeModel quota. No billing, no student data.
CREATE TABLE IF NOT EXISTS ai_freemodel_monthly_quota (
  month TEXT PRIMARY KEY NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0 CHECK (requests >= 0),
  reserved_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0)
);
