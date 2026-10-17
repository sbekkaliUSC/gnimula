# Project audit trail

Current direction: a public browser-based analog EDA workbench with intent-aware
autocomplete and background in-app action capture. See [the plan](PLAN.md).
The bootstrap entries below record the initial, narrower scope and its revision.

## 2026-10-17 UTC — repository bootstrap

- Established a new repository on a host-backed directory that persists across
  development-container rebuilds.
- Added independent project instructions, a folder map, implementation plan, local
  artifact exclusions, and an optional single-project VS Code workspace.
- Prepared the project for a private GitHub remote and inclusion in the existing
  multi-root workspace. No application, simulator, model integration, or training
  data has been added at this stage.
- No private application files or existing Git history were copied.

## 2026-10-16 PDT — spelling correction

- Corrected the project name to **Gnimula**.
- Renamed the local repository directory and focused workspace file, and updated
  the multi-root workspace, project instructions, README, and documentation paths.
- Renamed the private GitHub repository to `sbekkaliUSC/gnimula` and updated the
  local origin URL and Git safe-directory entry.
- Earlier paths in this document now use the corrected spelling for navigation.
  Existing commits and their original messages remain intact.
- Validation: both workspace files parse and resolve correctly; no misspelled
  names remain in current project files or filenames; Git origin and the
  safe-directory entry use the new path; GitHub confirms the repository is private.

## 2026-10-16 PDT — public EDA product clarification

- The user expanded the product direction to a website anyone can try, with the
  VS Code look and a broad analog-design workflow. The user will arrange a domain.
  A VS Code-derived web shell is an option to evaluate.
- Replaced the amplifier-and-tutorial-centered plan with an end-to-end EDA scope:
  schematic, simulation, layout, verification, and export, supported by implicit
  intent inference and editor-native autocomplete for repetitive operations.
- Specified background capture of in-app actions, design revisions, suggestions,
  user responses, and engineering outcomes. Distinguished recorded actions from
  inferred intent and future model-training use.
- Recorded the user's approximate 80-hour Virtuoso workload and 2-hour target
  as motivation and a product ambition, not measured performance.
- Rewrote the README, project/agent instructions, component docs, examples guide,
  and plan; added architecture and action-data specifications. Private
  implementation and corpus assets remain outside the repository.
- This change is documentation only. No app, collection service, deployment,
  domain configuration, or performance result was created.
- Validation: all 10 Markdown files were checked, all 11 relative documentation
  links resolve, and `git diff --check` passes. No runtime tests apply to this
  documentation-only revision.

## 2026-10-16 PDT — product identity and persistent action data

- Aligned current documentation and repository metadata around the Gnimula
  identity. Kept internal business context outside distributable project files.
- Made durable action storage explicit: acknowledged records must survive page
  reloads and service restarts, retries must deduplicate, and backups need a
  demonstrated restore. Console logging is insufficient.
- Added scoped correction memory and a planned demonstration of its effect on a
  later suggestion. Recording data and demonstrating adaptation are separately
  observable behaviors; neither implies model-weight training.
- Defined public source submission as an inspected snapshot without private
  development history. The development repository remains private.
- This update changes documentation and repository metadata. Runtime action
  logging, persistence, and correction memory are not implemented yet.
- Validation: current tracked files were checked for internal branding and corpus
  references; all 11 relative documentation links resolve; whitespace checks pass.
  GitHub confirms the updated description and private repository visibility.

## 2026-10-16 PDT — service and circuit foundation

- Implemented the independent structured circuit model, netlist generation,
  connectivity checks, reversible completion operations, and scoped preferences.
- Added Cloudflare D1 guest projects, revisions, action events with deduplication,
  correction memory, inference routing, and private R2 artifacts. Provisioned the
  two new storage resources and applied the initial schema.
- Added an isolated ngspice subprocess service. Simulation integration and browser
  behavior are still undergoing validation; no production success is claimed yet.
- The founder enabled Workers Paid and requested traffic-driven scaling. Removed
  global inference/simulation daily caps and routed simulator requests by guest,
  with idle shutdown. Platform resource ceilings and individual job bounds remain.
- Validation: TypeScript check and four circuit/model tests pass, including
  correction-dependent placements and rejection of malformed circuit input.

## 2026-10-16 PDT — working browser loop and hosted solver

- Built the independent React/SVG workbench: editable devices/wires, concept
  rectangles, properties, project import/export, revision history, undo/redo,
  completion previews, preference memory, simulation settings and measured plots.
- Deployed HTTPS on gnimula.stream and www, with D1, private R2, Workers AI binding,
  and per-guest simulator containers. Cloudflare accepted a 6,000 basic-instance
  ceiling; this is not a measured concurrency result or preallocated capacity.
- Browser QA passed project edits, model-fallback proposal application and undo,
  memory surviving reload and changing later placement (X=640 without, X=700
  with 220-unit spacing), guest isolation (404 across ownership), event retry
  deduplication, stale-save rejection (409), and exported-design restoration.
- A hosted AC run used actual ngspice: operating output 1.45852771 V; 87 ms solver
  time, excluding startup/network latency. The first model call used the explicit
  pattern fallback; provider-format handling is being investigated separately.
- Numerical tests passed RC gain/phase against the analytic transfer function,
  gain invariance under halved excitation, DC transfer, transient samples, and
  rejection of unsafe directives / excessive sweep duration. TypeScript builds.
- Visual inspection found mobile inspector access and a wire path crossing a
  source symbol; corrected panel controls and routing. Capture remains scoped to
  meaningful actions, with documented limits rather than raw keystroke logging.

### Hosted inference verification

- Enabled JSON response mode and handled structured response values. The hosted
  model now selects actual candidates; browser QA reports **workers-ai** instead
  of the pattern fallback. No extra API key is needed for the runtime binding.
- Repeated the full browser flow after this fix: actual model suggestion,
  application/undo, durable correction, changed later suggestion with memory,
  ownership, event deduplication, stale-write rejection and export/restore all
  pass with no browser JavaScript errors. Hosted ngspice returned the same
  1.45852771 V operating output (143 ms solver execution in this run).
- Preserved the deterministic fallback and its distinct label for provider
  outages. Added `scripts/browser-qa.py` as a reproducible hosted check.

### Recovery and interaction checks

- Exercised actual property editing, a device drag, undo, rectangle drawing,
  UI file export/import, and mobile inspector opening/closing on the deployed app.
- Disconnected the browser during an edit, reconnected, reloaded, and verified
  the local draft was saved to the cloud. The visual check exposed a redundant
  conflict notice when a draft had already reached the server; identical snapshots
  now clear the acknowledged local draft without reporting a conflict.
- Kept zoom controls available on narrow screens and removed internal object IDs
  from the inspector's ordinary description.

### Concurrent visitors and artifact restoration

- Two independent guest sessions ran hosted ngspice requests concurrently through
  separate worker identities; both returned the expected 1.45852771 V output.
- Read back the actual private R2 revision snapshot and solver artifact through
  authenticated object access. Verified the artifact includes ngspice results and
  generated netlist, then restored the archived circuit through the normal import
  API and compared its document exactly.
- Test guest records were deleted after the checks. No user data or credentials
  were added to the source repository. Production remains a preview with generic
  models and concept geometry, not PDK-backed signoff.

## 2026-10-17 — goal, assistant and reference foundations

Added independent public-source metadata, read-only GitHub/Hugging Face browsing,
HF dataset-row search, persistent project goals/PDK context, chat and attached
reference records. Replaced forced candidate ranking with structured model edits
and explicit abstention. Ask mode cannot emit edits; proposals retain revision
and context versions. Reference text is treated as untrusted evidence.

Implemented conservative flat SPICE import and Gnimula JSON import. Unsupported
PDK models, hierarchy and control commands fail conversion instead of being
silently dropped or replaced. Original source text can remain a private reference.

Validation: TypeScript check and 10 tests passed, including connectivity-preserving
parameter edits, deletion cleanup, abstention, rejected invalid model edits,
generic SPICE round trips, and provider path validation. UI integration and hosted
verification are in progress; this entry does not claim deployment yet.

## 2026-10-17 — chat and library workbench

Added a persistent goal editor, Ask/Edit chat, detailed operation previews, and
Library as a first-class editor tab. Library searches the public source catalog,
GitHub repositories, and Hugging Face datasets; browses directories and small
text files; and pages/searches dataset rows. Source links, file versions where
returned, row coordinates, and supplied license information accompany attachments.
Supported imports create a new project and keep the source attached. Native GDS,
PDK-dependent decks and other unsupported formats are identified as references.

TypeScript and production asset build passed. Hosted verification follows.

## 2026-10-17 — hosted assistant/library verification

Verified on the public Worker with disposable, isolated QA guest sessions:

- Real Llama inference proposed only RD = 22 kΩ; Apply changed that parameter,
  preserved six devices and wiring, and Undo restored RD = 10 kΩ.
- Ask mode emitted no proposal. Conversation and goal survived browser reload.
- A privately attached tuning note specifying RD = 18 kΩ produced that exact edit.
  A subsequent goal change made the old proposal fail acceptance with HTTP 409.
- Selecting VDD with a goal to leave the design unchanged produced no edit. One
  explanation incorrectly implied an unapplied target had already been met; the
  grounding prompt was tightened. This is a functional check, not an assessment
  establishing general engineering accuracy of the model's prose.
- GitHub repository search, Hugging Face directories, README text, dataset splits
  and rows returned successfully from the deployed Worker. Full-text row search
  encountered an upstream loading index; the API now reports that state and avoids
  caching upstream errors. Row browsing remains usable independently.
- Catalog artifact filtering, reference attachment, editable-import preview and
  importing the RC filter all worked through the browser. The imported circuit
  ran on hosted ngspice. A SKY130 include deck was rejected rather than degraded.
- Reference records include original text, source metadata and a content hash.
  Project export includes goal, references and recent conversation. Cross-guest
  access to the new context endpoint returned 404. Mobile chat controls remained
  visible. No browser JavaScript errors were observed in the successful flow.

Fixed hosted-provider redirects by following only approved public text-service
hosts, rejecting other redirects. Eleven tests cover structured edits, abstention,
import preservation/rejection, provider path/redirect bounds and index-loading
errors. Production build passes. Browser QA is reproducible with
`python3 scripts/browser-qa.py` (requires the optional Playwright environment).
Runtime captures are ignored rather than committed with visitor data.

Scope: this release does not ingest an entire corpus. It adds public source/record
discovery and user-selected attachments/imports. Native GDS/Xschem/Magic conversion,
installed foundry models, executable vector imports and autonomous agent tool use
remain unsupported. Simulator allocation was not changed.

Final deployed Worker version: `bb52cb41-f5f9-4f93-b941-cfd88a7be947`.
The final goal/abstention check returned “No modifications suggested as per the
current goal.” The imported RC circuit measured −2.9921 dB at 15,848.93 Hz,
consistent with its calculated 15,915.49 Hz cutoff and −3.0103 dB corner gain.
Final browser checks reported no JavaScript errors. Full-text Hugging Face record
search remained unverified: upstream reported a loading index and subsequent
requests timed out. Directory/file/row browsing and catalog filtering passed;
this release does not claim successful full-text retrieval for that cold index.
All source changes are committed and pushed; runtime screenshots and guest data
remain outside Git.


## 2026-10-17 — Data controls without the persistent banner

User requested a quieter workbench. Removed the persistent data notice and renamed the status-bar entry to **Privacy & data**, opening the existing disclosure and controls. Stored training preferences, default opt-out, export and deletion remain unchanged. Adjusted the mobile inspector position for the removed banner. Validation: TypeScript check; browser verification follows with the library update.

## 2026-10-17 — Installed transistor models for browser-ready public circuits

Added current sources, optional explicit MOS body terminals and a closed set of SKY130 1.8 V NFET/PFET models. The simulator image fetches eight model sources plus their license from a pinned public SkyWater commit, checks each SHA-256, and installs the typical-corner subset at build time. Visitors never execute downloaded control scripts or supply runtime model paths. Existing generic devices remain supported, including mixed circuits with consistent width/length scaling.

Validation: real ngspice gain changes with transistor width and with body bias; arbitrary model names and include paths fail validation. Existing RC AC/DC/transient numeric checks still pass. This is a two-device simulation-model integration, not a full PDK installation or foundry layout verification.

## 2026-10-17 — Direct-use Library

Replaced raw file browsing as the main visitor flow with fourteen direct-use items: nine connected circuits and five circuit tools. Complete designs open into a new project with a prepared testbench, installed model choice, source reference and starting assistant goal; Open & run measures them immediately. Testbench/signal/layout tools use the current design and normal undo. Public GitHub/Hugging Face file links can be prepared without downloading or uploading. Unsupported formats are not advertised as ready designs.

The featured public sources are one pinned official ngspice band-pass example and three independently fetched SKY130 op-amp records. The latter measured 29.8143, 31.3746 and 31.4657 dB at 1 Hz using their prepared single-input AC circuits. Screening also found many structurally valid but poorly performing source circuits; upstream counts are not treated as validated designs. Original graph fields, testbench values and reported metrics are retained separately. No private corpus has been copied into this application.

Local verification: all sixteen TypeScript tests pass, eight Python numerical/boundary checks pass, and all nine advertised circuits produce samples in the built deployment container. The existing editor, persistence and proposal checks still pass. Hosted browser verification will be recorded after deployment.


## 2026-10-17 — Hosted Library release verified

Production Worker version: `a53e45ff-f4fa-49a5-a0dd-2bcb9b03962c`. Evidence: [library verification](verification/library-2026-10-17/results.json).

The hosted browser opened the official GitHub band-pass circuit with one click, ran it, and matched its measured gain to the analytical transfer function across the sweep. The public SKY130 op-amp action produced 1,001 samples and 31.4657 dB at 1 Hz using the installed models. Source and goal records persisted, the previous project remained intact, signal/testbench changes and layout blocks supported undo, and invalid source URLs created no partial projects. A public GitHub file link also prepared directly.

The checks covered the fourteen Library entries, source/model filtering, reload, direct-use workflows on desktop/mobile, guest isolation, and privacy controls without a banner. Training starts off and explicit changes survive reload. Real hosted Llama editing, Apply/Undo and Ask mode still pass. Both final browser suites reported zero JavaScript errors. Successful disposable QA sessions were deleted by the scripts.

Verification prompted fixes for delayed checkbox feedback and a stale displayed goal when switching between projects with equal context versions. Goal and PDK display now update immediately; mobile opening leaves the circuit visible. Simulation responses are kept with their originating project if a user switches during a run. Authoritative testbench text is placed before graph data in dataset reference excerpts. One earlier browser attempt timed out waiting for a plot; direct hosted simulation and both subsequent full Library checks succeeded. Its cause was not established, so the results are not a load or uptime guarantee.

The ready set is deliberately small: nine circuits (including three variants from one public op-amp family) and five circuit tools. It is not a conversion of all upstream records. Native GDS/Xschem, arbitrary hierarchy/models and imported vector formats still need adapters. Layout blocks remain concept geometry; the model package is a selected SKY130 simulation subset, not manufacturing verification.


## 2026-10-17 — Remove guest-deletion UI

Removed the whole-guest deletion button, its confirmation dialog and the unused frontend handler at the owner's request. Export and training controls remain in Privacy & data. The authenticated session-deletion endpoint and 30-day scheduled cleanup remain implemented. No stored user records were changed.

Validation: TypeScript and the production bundle build pass; the frontend no longer contains the deletion action or dialog. Hosted verification follows deployment.


## 2026-10-17 — New-session training default

New guest sessions now start with future training eligibility enabled, as requested by the owner. The existing Privacy & data panel explains the setting and lets visitors turn it off; there is no banner or popup. Existing guest preferences are returned unchanged, with no migration or bulk update. The legacy trainingOptIn field is an eligibility setting and must not be treated as proof of an affirmative opt-in. No training job was started and no user data was exported for training.

Validation: TypeScript and production build pass. Added a disposable-guest browser check for a pre-release disabled session, the new default, persistent opt-out, working export, and absence of the removed deletion button. Hosted execution follows deployment.


## 2026-10-17 — Hosted privacy controls verified

Production Worker version: `2c73e970-75f4-4d42-9dce-5fec744ac339`. [Hosted evidence](verification/privacy-2026-10-17/results.json) records the disposable-guest checks. A guest created before deployment retained its disabled training setting; a new guest began enabled. Turning the new guest's setting off survived reload and session refresh, and its project export correctly reported the disabled setting. The workbench has no whole-session deletion button or banner; the Privacy & data explanation and preference remain accessible. The browser reported zero JavaScript errors. QA removed only its own disposable guest sessions.

The release changes future training eligibility, not model weights: no training run or training-data export was performed. Existing user records and retention schedules were not rewritten.


## 2026-10-17 — Separate workbench status, settings and legal information

Moved service-level controls out of the editor status bar. The bottom-left Settings gear and Ctrl/Cmd+, open distinct Editor and Data controls sections. The existing autocomplete and project-memory switches are connected to Editor settings; training preference, guest-session information and export live in Data controls. Help → Legal & privacy contains the collection/retention explanation, preview-use terms and public dependency/source notices. Settings also links there for narrow screens. The status bar now shows save/sync state and the active workbench mode; the unused UTF-8 indicator was removed.

Training defaults, stored preferences, retention, and backend deletion behavior were not changed. Dialog focus stays within the open panel, Escape closes it, and editor keyboard shortcuts are suspended while a dialog is open.

Validation: TypeScript and production build pass. Disposable-guest browser checks using the candidate built assets against the hosted API passed on desktop and mobile: setting persistence, export, Help and Settings navigation, legal section links, focus containment, keyboard shortcut, and no horizontal overflow. Both screenshot sizes were visually inspected; zero JavaScript errors. Production deployment and verification follow.


## 2026-10-17 — Hosted settings navigation verified

Production Worker version: `20bea8b3-0476-4747-aa08-72737d6eed35`. [Hosted browser evidence](verification/settings-2026-10-17/results.json) confirms the new Settings → Data controls path, training preference persistence, project/activity export, Help → Legal & privacy sections and the link back to data controls. Keyboard focus containment and Ctrl/Cmd+, were exercised with Control on Chromium; desktop and 390-pixel mobile layouts passed without horizontal dialog overflow. The status bar no longer contains privacy controls or UTF-8. No JavaScript errors were reported, and only disposable QA guests were removed.

## 2026-10-17 — Live public circuit catalog

Replaced the Library's fixed-list entry point with live Hugging Face record search and GitHub repository/file discovery. Prepared examples remain under Starter circuits; measurements and layout blocks live under Circuit tools. Search supports provider, collection, dataset configuration/partition, paging and source discovery. Source metadata and public links remain attached to each imported project. An Open & explain action opens an Ask-mode draft grounded in the imported design and source; model-generated edits still require review and simulation.

The verified SKY130 collection contains 130,409 records across one representation's partitions (89,708 train), including parameter variants and failed designs. Alternate configurations are not counted as additional circuits. This is searchable public supply, not a claim of unique topologies, exclusive data or validated electrical behavior. Each displayed Hugging Face row passes the existing strict preparation checks before receiving Ready status. Unsupported native formats remain explicit source references. GitHub selections pin the tree revision; dataset selections carry row fingerprints and reject changed records.

Backend validation: all 23 unit tests and TypeScript pass. Live source checks prepared the first SKY130 page and an official ngspice example. Added an independently implemented seeded Playwright monkey harness (07f9ae5), without copying private code. Hosted navigation, randomized testing and adaptive agent usability trials follow this candidate implementation.

## 2026-10-17 — First browser findings and corrective work

The deployed catalog exposed a Worker fetch invocation/redirect compatibility issue that local provider tests missed; the public fetch helper now preserves the global receiver and handles bounded provider redirects. A second upstream issue remains separate: Hugging Face's full-text index for the large SKY130 dataset reports that it is loading. Added a recoverable unavailable state instead of misleading zero-match copy, and began a reproducible metadata-only D1 index for that public collection.

The first adaptive browser agent completed the starter SKY130 import, simulation, capacitor edit and second simulation, and preserved the previous project. It found a real inspector bug when selecting a component while viewing the netlist. Explorer component selection now opens the schematic and its correct property inspector, with a focused view. Added Focus selected device for large generated schematics and a visible Concept layout capability boundary. Automatic schematic placement remains a generated grid, not the original author's drawing.

The same agent found inaccurate assistant prose (sweep density described as total samples, a small-signal gain generalized across frequency, and a large capacitor change described as modest). Deterministic model context now includes actual sample count, endpoints and full-row gain extrema, stale-result status, visible references, and explicit parameter-change factors. These are grounding improvements, not proof that Llama explanations are always correct. Hosted retests follow.

## 2026-10-17 — Public metadata index imported

Applied migration 0003 and loaded 130,409 SKY130 metadata records into D1 (train 89,708; validation 19,116; test 19,402; failed 2,183). The import contains public identifiers, topology, source and PDK only. Public Parquet files and generated SQL stay under ignored runtime; the committed manifest records byte sizes and SHA-256 hashes. SQL was verified in local SQLite before remote import; the remote completion manifest confirms the same counts. The database after import is approximately 24.6 MB. Search examples in train: 51,133 amplifier records; 1,197 current-mirror records; 378 differential records. These counts include variants, and a failed or incompatible source remains ineligible for direct opening.

## 2026-10-17 — Adaptive testing refinements

Two independent agents navigated the hosted UI using rendered controls/screenshots, without implementation or internal API knowledge for user tasks. They completed source discovery/import, real simulation, explanation, parameter edits, undo, preserved-project checks and mobile Library navigation. The second agent found that the publisher's first supported current-mirror result describes a testbench containing only one MOS device. Added a narrow deterministic warning for mirror labels with fewer than two MOS devices, retained in both the result and saved source notes. Gnimula does not relabel or fabricate the original circuit. Ready means the circuit can be prepared, not that its publisher category or performance is verified.

The first agent's last AI answer fixed the sample-count and frequency-range errors but still converted 4e-14 F incorrectly. Added exact engineering-unit strings (including 0.04 pF), SI quantities and change factors to the supplied model context. No further model call was used to claim this eliminates arithmetic errors. Attached JSON testbenches are displayed as readable SPICE; underlying source records are preserved. Library results now appear above more of the source-detail controls, with readable publisher categories and a separate source identifier; opening Library gives it the full editor width.

## 2026-10-17 — Final catalog release verified and published

Production Worker version: `522e934c-5bf0-47e5-92d5-b911f16a2db3`. The final hosted regression passed live counts/pagination, readable source testbench, source fingerprint/provenance, preserved prior projects, real SKY130 simulation, the direct Simulation setup controls, indexed metadata search, recursive GitHub preparation, repository discovery, explicit unsupported formats and 390-pixel layout. No browser JavaScript errors were reported. Production build and 35 unit tests passed.

The randomized browser runs completed 740 interactions and 23 persistence checkpoints; initial provider/configuration failures were corrected and rechecked. Two adaptive browser-agent trials completed the tested design/simulation/edit/undo workflows and their final targeted corrections. The original AI unit-conversion error and publisher topology mismatch remain in the evidence, with bounded mitigations rather than claims of general correctness. All disposable guest sessions were removed, including recovery of two failed harness cleanup calls; no existing visitor record was changed.

See [consolidated results](verification/catalog-2026-10-17/RESULTS.md), [hosted assertions](verification/catalog-2026-10-17/results.json), [monkey evidence](verification/monkey-2026-10-17/RESULTS.md), [engineering-agent trial](verification/usability-2026-10-17/REPORT.md), and [student-agent trial](verification/student-ux-2026-10-17/REPORT.md). Implementation, infrastructure, corrective changes and evidence were committed in separate steps and pushed to the existing remote.

## 2026-10-17 — Keyboard and pointer canvas navigation

Added independently authored navigation based on public Xschem interaction
conventions: pointer-centered wheel zoom, Space/left-drag and middle-drag pan,
Shift-scroll pan, arrows, F fit, Shift+F focus, +/- zoom and drag-box zoom (Z or
right-drag). Ctrl+Z remains Undo. Capture-phase gestures work over devices, pins,
wires and layout rectangles without starting an edit. Pan uses unsnapped screen
motion; small box drags are ignored. Cancel, lost capture and window blur clear
transient gesture state. Fields/dialogs retain normal input behavior. Gesture
summaries go through the event outbox without changing document revisions; a
project guard prevents delayed viewport events from being logged in another
project. Toolbar and keyboard zoom share the same 10–800% bounds.

Initial validation: TypeScript and production build pass; all 38 tests pass,
including pointer-anchor invariance, reversible zoom, unsnapped pan and bounded
fit math. Hosted browser validation and deployment are pending in this commit.

Navigation validation completed and published: candidate and deployed Chromium
checks pass, including device/pin/wire pan capture, letterboxed pointer anchoring,
box-jitter rejection, chat/dialog isolation, unchanged document/revision, persisted
viewport events, and normal edit/undo after navigation. No AI/simulation calls or
JS exceptions; disposable QA guests deleted. Worker version
`f8e383e4-90cd-426b-9151-baa496a995be`.
See [navigation evidence](verification/navigation-2026-10-17/RESULTS.md) and
`scripts/navigation-qa.py`. Physical trackpad and touchscreen hardware were not tested.

## 2026-10-17 — ADC search diagnosis

Reproduced `adc` in the default public collection: 50 training-split matches;
first 12 blocked by AC-only SKY130 testbench preparation. Inspected the three base
records: two need bipolar devices/models and PWL/PULSE support; the third has no
input excitation in its generated testbench. Corrected the misleading generic
format footer and made the transient rejection specific. No conversion was
performed or circuit correctness inferred from publisher convergence flags.
See [inspection and recommended adapters](verification/adc-import-audit-2026-10-17/RESULTS.md).

ADC diagnostic correction is deployed as Worker
`fc589dfd-9324-4eb6-b0be-48601700a6af`; 38 tests and build passed. Live Library
search verified all 12 first-page messages and unchanged source-only status;
no JS exceptions, QA guest cleaned up. This release changes diagnostics only.


## 2026-10-17 — General library usability requirement clarified

The user clarified that the ADC search exemplifies a general product problem:
selecting a library result should lead to a usable design without manual format,
dependency or compatibility work. Updated PLAN and ARCHITECTURE around a general
preparation service, broader design representation, reusable converters and
agent-assisted setup, cached validated outputs, and distinct edit/simulation
capabilities. The ADC audit remains a diagnostic example, not an ADC-specific
product commitment. Referenced Cadence's public Spice In documentation for its
format and device-mapping requirements. Documentation only: no new import
capability or preparation agent is claimed as implemented by this change.


## 2026-10-17 — Public source publication

The user authorized making the Gnimula source repository public. Prepared the
current source as an independently rooted public history, preserving development
history privately. Checked 257 tracked files for common credential patterns;
none were flagged. Runtime directories, credentials and real user records are
not tracked. Added a repeatable tracked-source publication script and documented
the public URL. Source publication does not itself select a project license.
Final public visibility and anonymous access are verified after publication.

Publication verified: `https://github.com/sbekkaliUSC/gnimula` is PUBLIC, and
unauthenticated GitHub API and raw README requests both returned HTTP 200. The
public source started from an independent root commit; its 258 tracked files
matched the prepared development source tree. Development history remains in a
private repository, with the workspace origin updated accordingly. The tracked
publication script supports subsequent source updates without exposing that
history. No application deployment change was needed.


## 2026-10-17 — Workbench UI corrections

Removed the generic-model advisory from circuit Problems; model identity remains
in component properties and simulation context. All inspector tabs now retain the
same responsive width. Replaced the assistant's native mode select with a dark,
keyboard-accessible menu (selection, arrows, Home/End, Escape, outside click and
focus return). These corrections are separate from the source-preparation work.

### 2026-10-17 — Preserve source devices and hierarchy

- Added a declarative source adapter with named model-backed terminals, original
  node names, subcircuits, model/parameter cards, and PULSE/PWL/SIN/EXP sources.
  Missing models remain explicit simulation issues; editable devices are retained.
- Added generic block symbols and editable instance parameters. Source commands
  never enter executable decks. ngspice independently validates accepted syntax.
- Validation: TypeScript and 43 Node tests; seven ngspice tests, including numerical
  equality of flat and hierarchical transient circuits and a model-backed BJT sweep.
  Library integration and production rollout follow separately.

### 2026-10-17 — SKY130 device-package expansion

- Extended the existing pinned, checksum-verified SKY130 installation with NPN
  and PNP model cards, their typical-corner coefficients and required parasitic
  definitions. Preserved the fourth substrate terminal rather than treating
  model-backed BJT instances as three-terminal devices.
- Two public transient records (dataset rows 43969 and 43971) now produce 615 and
  611 ngspice samples, respectively. This verifies import and simulation execution,
  not the publisher's ADC topology label or adequate testbench stimulus.
- Ten Python integration checks pass, including existing SKY130 width/body effects.

### 2026-10-17 — Resumable library preparation

- Added per-guest Durable Object preparation jobs and D1 job records. Source
  retrieval, dependencies, adaptation and publication are separate durable stages;
  refresh/restart resumes saved progress. Creation and publication are idempotent.
- Resolve bounded relative includes at the source's pinned repository revision;
  preserve originals, dependency hashes and adapter version. Public conversions
  are reusable in R2; guest projects and activity remain separate.
- Library now exposes Prepare & open, progress, recovery and completed projects.
  A source-format failure searches actual repository electrical files. Workers AI
  may recommend a candidate; the user chooses ambiguous native-file counterparts.
  No inferred conversion is silently substituted for the selected circuit.
- Added Sources with original files, model cards, unresolved setup, and in-app
  public model attachment. The source's sweep and waveforms are preserved; source
  quality warnings are separate from parser or simulation success.
- Validation before deployment: 47 Node tests, TypeScript, Vite build, ten Python
  ngspice tests; all five provisioned BJT models return finite DC sweep data.
  Browser validation and hosted job checks are recorded separately below.

### 2026-10-17 — Hosted rollout and assistant integration

- Hosted durable jobs passed reload recovery, idempotent creation, separate-guest
  access checks, source preservation and cached conversion reuse. First hosted
  simulation reached the previous image during Cloudflare's gradual rollout.
  Added an explicit simulator protocol response so this interval is a retryable
  service state, not a misleading source-format error.
- Extended validated assistant edits/context to model-backed instance parameters
  and explicit waveforms. A source waveform hides inactive generated-sine controls.
- Browser checks confirm stable Chat/Assist/Properties/Memory widths at 1440 and
  1100 pixels, a dark keyboard-operable mode menu, and 80 rapid view/panel switches
  without page errors. Final live simulation and publication checks follow.

### 2026-10-17 — Source identity edge cases and live verification

- The full hosted check now passes, including the imported 36-component public
  circuit's real transient simulation, browser reload during preparation, cached
  reuse, idempotent creation and cross-session isolation. Disposable QA sessions
  were removed after the checks.
- Final adapter review preserves optional BJT substrate terminals and the OFF
  flag, selects a unique hierarchy root independently of definition order, and
  requests an identifying testbench for ambiguous cell libraries. Duplicating an
  imported device retains its SPICE reference prefix and avoids case-insensitive
  reference collisions. Bumped the adapter cache version for these changes.
- TypeScript and 52 Node tests pass. Updated operational, architecture and model
  attribution documentation to distinguish delivered preparation from remaining
  native-format interoperability work. Final adapter deployment and evidence
  publication follow this commit.

### 2026-10-17 — Source preparation release verification

Deployed implementation `2b3bc23` as Worker version
`e05bc9fc-bde6-4409-a100-2936e9a377a3`. The complete hosted browser check passed
again on this deployment, including actual ngspice measurements for the imported
public source and 80 rapid view/panel switches without page errors. The simulator
image is on protocol 2; no additional image rollout was required for this final
adapter update. Test sessions were deleted successfully.

Saved reproducible checks, source simulation measurements and disposable-session
screenshots in [release evidence](verification/source-preparation-2026-10-17/RESULTS.md).
The release supports broader declarative electrical sources and associated-file
recovery, not universal native-layout conversion. Development commits are pushed
to the private origin; the inspected tracked tree is published separately using
the source publication script.

### 2026-10-17 — MOS logic demo foundation

Prioritized the requested schematic-to-post-layout demo. Added independently
constructed two-transistor inverter and 12-transistor static CMOS XOR examples,
with explicit SKY130 bodies, pulse vectors and a 20 fF load. Added a bounded
physical generator and real Magic extraction using a pinned public SKY130
technology file; model and technology provenance/licenses stay with the source.
The layout is generated from current schematic terminal connectivity and sizes.

Local container checks passed for both circuits: zero Magic DRC violations,
extracted MOS connectivity/types/W/L matching the schematic, and eight settled
truth samples passing before and after extraction. XOR extraction produced 45
parasitic capacitors; measured worst delay changed from 118.3 ps to 220.2 ps.
Inverter delay changed from 80.6 ps to 92.7 ps. These are typical-corner results
for the supplied testbench, not a foundry signoff or performance claim about
another process. Extraction includes geometric capacitance, not distributed wire
resistance. TypeScript and 54 Node tests pass.

Added a persisted, revision-checked agent tool controller for building the
schematic, measuring, generating layout, checking/extracting and post-layout
simulation. UI integration and hosted agent verification are still in progress.

### 2026-10-17 — Guided logic demo workbench

Added Logic demo with an AI task field, one-step or end-to-end execution, saved
stage progress, schematic/layout previews, measured truth table and switching-edge
waveform comparison. The agent invokes bounded tools and its decisions and tool
results are persisted in the work log and chat. Generated layout and schematic
changes are ordinary saved revisions. Geometry edits invalidate extraction;
electrical edits invalidate the baseline and subsequent physical work.

TypeScript, 54 Node tests and the production frontend build pass. Hosted schema
migration and deployment follow; no hosted agent completion is claimed yet.

### 2026-10-17 — Hosted physical loop and edit invalidation

Hosted XOR validation passed on Worker `115a4ebe-dfa0-45af-8451-5ec74ace77e3`
after the container image provisioned: all five real Workers AI tool selections,
12 extracted MOS devices, 45 parasitic capacitors, zero loaded Magic DRC
violations, matching connectivity/dimensions, and eight passing settled samples
covering all four input combinations. Schematic/extracted worst delays were
118.3304/220.2230 ps. Reload recovery, artifact downloads and guest isolation
passed without browser errors. The initial browser attempt encountered the
asynchronous container rollout; the successful run required no retries.

Added physical regression checks for both built-ins, broken geometry rejection
and load sensitivity. All 13 Python checks pass inside the production simulator
image, alongside 55 Node tests, TypeScript and frontend build. Fixed workflow
refresh after edits so old success results disappear and rechecking becomes
available without reload. The comparison now rejects incompatible supply,
stimulus or analysis edits instead of applying fixed thresholds silently. Physical
canvas units and editing snap now reflect the 10 nm coordinate system. The final
hosted edit/inverter check follows deployment of these refinements.

The next hosted XOR run also completed all engineering stages. Its extended QA
stopped on an ambiguous test selector shared by the navigation icon and preview
tab; scoped that selector to the preview tabs. Added a typed 422 response for
invalid comparison testbenches so the browser receives the specific recovery
message rather than a generic server error. TypeScript and production build pass.


### 2026-10-17 — Logic demo release verified

Final hosted validation passed on Worker
`125d5fee-e60b-485f-890d-2f0e61108e30` (implementation `94e9cd2`). Both XOR and
inverter completed all five real model/tool calls. Browser editing invalidated
stale extraction without reload; electrical edits invalidated the baseline;
stale revision requests failed. Reload, artifact download and guest-isolation
checks passed with zero browser errors and no rollout retries. The inverter's
measured delays were 80.6407 ps schematic and 92.6657 ps extracted, with two
matching MOS devices and zero loaded Magic DRC violations. All disposable
sessions were removed.

Saved [release evidence and demo instructions](verification/logic-demo-2026-10-17/RESULTS.md),
including measured outputs, model tool decisions and screenshots. The final
numerical suite has 13 passing Python tests; 55 Node tests, TypeScript and build
pass. Development changes are pushed separately from the inspected public source
snapshot. The demo is bounded to the documented physical/testbench flow; broad
native-format interoperability remains outside this deadline-focused release.
