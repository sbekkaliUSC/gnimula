# Public circuit catalog and browser verification — 2026-10-17

Gnimula now searches public circuit records and source repositories instead of limiting the Library to its 14 prepared items. Online circuits is the entry point; the original nine starter circuits and five tools remain separate. Supported results open as editable circuits with their testbenches, model configuration and source attribution. Unsupported formats remain explicit references.

## Supply and search

- **130,409 SKY130 records** indexed in D1 across four partitions, including parameter variants and failed source designs. The default train partition has 89,708 records. Alternate dataset representations are not counted as extra circuits.
- The metadata index searches identifiers, topology, source and PDK. It is not a full-netlist or semantic search. It removes dependence on the upstream full-text index, which was unavailable during this work.
- Matching source rows are fetched and prepared before being offered as ready. Changed identities and row fingerprints are checked. Readiness establishes import compatibility, not publisher-category correctness or measured performance.
- GitHub repository discovery, recursive circuit-file filtering and direct preparation are live. Hugging Face supports dataset discovery, actual configuration/partition selection and pagination. CircuitFormer's discovered partition reported 49,352 records; this is not a claim that every format opens.
- [Index provenance](index-manifest.json) records the public Parquet inputs, hashes, row counts and search-field scope. Public metadata indexing does not include guest projects or private data.

## Verification

The production build and 35 unit tests passed. [Hosted catalog regression](results.json) covers live counts, paging, indexed search, source fingerprints, direct opening, preserved projects, real SKY130 simulation, GitHub search/preparation, source-only formats and narrow-screen navigation. [Direct-use regression](direct-use-results.json) additionally checks the analytic band-pass transfer function, SKY130 model behavior, measurement undo, body connections, reload, settings and guest isolation.

The [seeded monkey](../monkey-2026-10-17/RESULTS.md) completed **740 interactions across 780 attempted action slots**, with **23 successful save/reload checkpoints**. No uncaught JavaScript exception or lost document was observed. Provider 502 and dataset-configuration 400 failures were retained in the evidence, corrected and rechecked; they are not hidden behind the stability result.

Two independent adaptive browser agents used screenshots and rendered controls, without source-code or private-state knowledge to perform user tasks:

- [Engineering workflow and correction retest](../usability-2026-10-17/REPORT.md): source import, simulation, explanation, capacitor edit, rerun, preserved projects and physical-layout capability investigation.
- [Student discovery and RC workflow](../student-ux-2026-10-17/REPORT.md): online search, source inspection, simulation, resistance edit, simulation, undo and 390-pixel navigation.

These are AI-agent trials, not a substitute for human user research. Only disposable training-excluded guests were used. Two harness cleanup calls initially omitted the required Origin header; those guests were uniquely verified and removed through the normal deletion API using replacement credentials. The harnesses were corrected. Existing visitor records were not changed.

## Findings and resulting changes

| Finding | Change / remaining limit |
| --- | --- |
| Public fetch worked locally but failed in Worker runtime | Preserved global receiver; bounded provider redirects; hosted checks added. |
| Upstream text index unavailable | Added reproducible D1 metadata index and honest outage/retry states. |
| CircuitFormer preset used a nonexistent partition | Discover configuration/partition from the provider. |
| Netlist selection opened layout properties | Explorer selection now opens the correct schematic inspector and focuses the device. |
| Large imported drawing difficult to read | Focus selected device and automatic Explorer focus; original drawing coordinates are still unavailable and generated routing can overlap. |
| Results too far below controls | Compact library, expandable source details, full editor width, readable publisher categories. |
| Source testbench shown as escaped JSON | Render the SPICE testbench as readable source text while retaining the full attached record. |
| Current-mirror publisher label contradicted one-MOS testbench | Preserve source and label; display a structural mismatch warning before opening and in setup notes. |
| Assistant confused AC density/sample count and gain range | Supply exact stored sample count, sweep semantics, endpoints, extrema and stale-result state. Retest corrected those facts. |
| Assistant still converted 4e-14 F incorrectly | Supply deterministic engineering-unit strings, including 0.04 pF. No subsequent model call establishes this eliminates arithmetic errors. |
| Simulation controls hard to find | Added a direct Simulation setup button. |
| Physical flow could imply more than the app provides | Visible Concept layout boundary. No PDK DRC/LVS, extraction, GDS output or manufacturing signoff is implemented. |

Final deployment and check results are recorded in the audit trail. Provider availability, dataset quality, supported formats and model-answer accuracy remain real constraints. This release does not claim millions of unique usable circuits, verified topology classification, or successful tapeout.
