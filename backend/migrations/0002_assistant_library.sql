CREATE TABLE IF NOT EXISTS project_context (
 project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 goal TEXT NOT NULL DEFAULT '', pdk TEXT NOT NULL DEFAULT 'generic',
 version INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 role TEXT NOT NULL, content TEXT NOT NULL, proposal_id TEXT,
 revision INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_project ON chat_messages(project_id,created_at);
CREATE TABLE IF NOT EXISTS project_references (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 name TEXT NOT NULL, source_url TEXT NOT NULL, provider TEXT NOT NULL,
 metadata TEXT NOT NULL, content TEXT NOT NULL, artifact_key TEXT,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS references_project ON project_references(project_id,created_at);
