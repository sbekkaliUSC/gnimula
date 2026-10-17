CREATE TABLE IF NOT EXISTS engineering_workflows (
 project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 data TEXT NOT NULL DEFAULT '{}', lock_id TEXT, lock_until INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL
);
