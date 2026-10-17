-- Public source metadata only; unrelated to private projects or training records.
CREATE VIRTUAL TABLE IF NOT EXISTS public_circuit_search USING fts5(
 repo UNINDEXED, config UNINDEXED, split UNINDEXED, row_idx UNINDEXED,
 circuit_id, topology, source_dataset, pdk, tokenize='unicode61'
);
CREATE TABLE IF NOT EXISTS catalog_index_snapshots (
 repo TEXT NOT NULL, config TEXT NOT NULL, record_count INTEGER NOT NULL,
 splits_json TEXT NOT NULL, retrieved_at TEXT NOT NULL, source_revision TEXT NOT NULL,
 PRIMARY KEY (repo, config)
);
