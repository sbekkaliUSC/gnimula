CREATE TABLE preparation_jobs (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 input TEXT NOT NULL,
 stage TEXT NOT NULL DEFAULT 'queued',
 detail TEXT NOT NULL DEFAULT '{}',
 project_id TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX preparation_by_session ON preparation_jobs(session_id, updated_at DESC);
