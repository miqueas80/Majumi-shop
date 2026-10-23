CREATE TABLE IF NOT EXISTS majumi_ai_usage (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_majumi_ai_usage_updated ON majumi_ai_usage(updated_at);
