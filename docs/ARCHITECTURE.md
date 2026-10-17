# Browser EDA architecture

## Implemented system

```text
React workbench + SVG editors
    -> structured circuit commands -> undo + draft + local action outbox
    -> same-origin Worker API -> guest ownership + revision checks
    -> D1 (projects, revisions, goals, chat, references, actions, memory, proposals, runs)
    -> private R2 (immutable circuit snapshots, simulation artifacts)

Design state + goals + actions + conversation + reference excerpts
    -> Workers AI structured edits or abstention -> operation validation
    -> revision-bound preview -> accept / dismiss -> normal editable design

Circuit connectivity -> generated SPICE -> per-guest Cloudflare Container
    -> isolated ngspice subprocess -> revision-linked measurements and plots
```

The TypeScript/React shell is purpose-built. A VS Code fork was considered but
would add desktop/extension-host complexity without providing an EDA document,
canvas, or simulator. The editor and service share a typed circuit model.

## Design and operations

Stable component IDs, terminals, wires, layout rectangles, analysis configuration,
and revision numbers form the document. Union-find derives electrical nets from
explicit terminal connections. MOS bodies use explicit fourth terminals when present; legacy three-terminal devices tie body to source. Device rotations
change displayed terminal coordinates but preserve terminal identity.

Editor commands record object upserts/deletions, revision boundaries, actor and
client IDs, and context events. Pointer moves are summarized at drag end. Undo
and redo create new revisions; they never rewind the cloud revision counter.
Imports validate the complete document. Exports include project data, optional
activity, SPICE, or geometry SVG.

## Autocomplete and correction memory

The model receives complete circuit objects and connections, generated SPICE,
supported-check results, selected IDs, recent structured events with actor origins,
explicit goals, preferences, recent conversation, recent proposals, and the latest
simulation's revision and sampled measurements. It can explain, abstain, or emit
supported component, wire, shape and analysis edits. Ask mode discards edits.
The server validates operations and the resulting document before creating a
proposal. Model failure never becomes a silently selected template.

Chat persists in D1. The model sees the latest ten prior messages. Reference
context includes the latest twelve attachments, up to 5,000 characters each;
truncation and omitted-reference counts are explicit in the prompt. Attached text
and imported source material are evidence, not model instructions. Native binary
files are not interpreted, and no autonomous network or shell tool is exposed.

Preference records are explicit, scoped to the project, inspectable, and deletable.
They influence candidate construction before ranking. Their IDs accompany the
proposal; correction source events are linked when available. This is retrieval
of application memory, not continual weight updates.

Proposals bind to a saved revision and a goal/reference context version. The API rejects stale acceptance. Editing
remains available during inference; results for an old local revision are ignored.
Acceptance is briefly serialized with edits to avoid losing an intervening change.

## Engineering and storage

Server-side checks reject invalid references, unsupported device values, and
unconnected terminals before simulation. The Python service only accepts generated
netlist syntax, uses no shell, and builds trusted analysis commands. Scratch files
are temporary, child processes have memory/CPU/file bounds and a wall deadline,
and the container has no outbound network access. Guest identities route to
independent container instances that sleep when idle.

D1 owns persistent state. Revision snapshots and solver artifacts are additionally
written to private R2 using immutable names. Service restarts do not remove them.
Event retries deduplicate by guest/event ID and are acknowledged only after D1
commits. Local drafts and pending events survive browser reload; conflicting
cloud revisions are rejected rather than merged silently.

## Public boundaries

The Worker serves HTTPS, checks mutation origins, uses HttpOnly guest cookies,
hashes cookie secrets in storage, and checks ownership on every project route.
The status bar shows editor state and save/sync status. The settings gear opens
Editor and Data controls sections; Help opens Legal & privacy. Both destinations
remain accessible from Settings on narrow screens.
Guests can export their project/activity and manage future training eligibility.
New guest sessions start with training enabled; existing preferences are preserved.
The UI has no whole-session deletion action. The authenticated session-deletion
API remains available, and expired guest records still undergo scheduled cleanup. See [action data](ACTION_DATA.md) and [operations](OPERATIONS.md).

Ordinary projects have connectivity and concept-layout geometry checks. The
bounded logic flow below adds real SKY130 Magic DRC/extraction and GDS export.
Full foundry signoff and an established design-time speedup remain unproven.

## Ready-to-use library and source preparation

The main Library contains eleven prepared circuits and five tools. Circuit actions
open a new project, its goal and source reference in one D1 transaction; existing
projects are saved before switching. **Open & run** also requests a fresh simulation.
The original source, hashes, model/row revisions and preparation notes are retained.
Measurement and layout tools use ordinary undoable commands on the current design,
recording the library item alongside exact document changes. The canvas fits the
whole design on open.

Prepared public content is independently fetched from GitHub and Hugging Face,
stored in `backend/data`, and attributed. Catalog filters operate on this ready
set. The older bounded provider search/browse endpoints remain available to service
code, but raw repository listings are no longer the visitor's primary workflow.
A public circuit file URL can be fetched and prepared automatically; fixed provider
hosts, byte limits and strict parsers constrain it. Unsupported formats fail before
creating a project, with no partial imports or silent device-model replacement.

The SKY130 adapter reads the supplied flat testbench as authoritative. Separate graph
fields and reported metrics can disagree with it. It preserves transistor model,
W/L, current sources and four-terminal connections, selects the documented input
and output, and prepares a single-input AC sweep. Other voltage-source AC excitation
is disabled to isolate signal gain. Noise/PSRR/temperature control scripts remain
source evidence and are never executed. Three featured source variants measured
29.8–31.5 dB at 1 Hz with this preparation; these are starting designs, not verified
production amplifiers. Their results do not establish the quality of the entire
upstream corpus.

The simulator image installs a SHA-256-verified typical-corner subset from a pinned
public SkyWater repository commit. It retains license headers, license text and a
manifest. Only `sky130_fd_pr__nfet_01v8` and `sky130_fd_pr__pfet_01v8` are installed.
Their fixed model include is added by the service; arbitrary includes and user
scripts remain prohibited. Mixed generic/foundry devices use consistent geometric
scaling. This is a simulation-model integration, not full PDK/DRC/LVS support.

The public SPICE adapter accepts supported flat R/C, voltage/current sources,
recognized models and sweeps. The official ngspice band-pass example's global
flat ground alias is normalized and its output probe selected automatically;
publisher control/measurement scripts are retained but not executed. Gnimula JSON
can retain the full editable document. Binary/native schematic or layout formats,
arbitrary hierarchy/model decks and imported vector files need further adapters.
The Library never counts upstream records as ready-to-use circuits.

## Live circuit catalog

`catalog-service.ts` resolves public GitHub repositories/recursive trees and Hugging Face dataset configurations, splits, rows and full-text search. The browser loads bounded pages instead of downloading entire datasets. A bounded five-minute public response cache reduces repeated provider calls. Partial upstream errors retain navigation and warnings; repository/file/record counts have distinct labels.

`GET /api/library/discover` searches; `GET /api/library/prepare` previews preparation. `POST /api/projects` accepts a validated `catalogSelection` and prepares the source before atomically creating the project, initial revision, goal and reference. GitHub selections pin source revisions; HF selections verify row fingerprints. Raw publisher control scripts are never executed. The existing importer and simulator model allowlist remain authoritative; no AI fabricates missing models or connections to make an import pass.

The Online circuits tab is a federated source browser, not a local copy of every circuit. Provider availability and supported artifact formats constrain which records can open. Starter circuits are a separate prepared collection. Concept layout remains exploratory geometry: it does not provide PDK DRC/LVS, extraction, GDS generation or foundry signoff.

The primary SKY130 collection additionally has a metadata-only D1 FTS5 index (`public_circuit_search`). `scripts/index-public-catalog.py` projects public Parquet identity/topology/PDK/source columns, preserves split-relative row positions, records file SHA-256 provenance, validates the generated SQL locally and publishes a completion manifest last. The 2026-10-17 snapshot indexes 130,409 records; no user project or netlist content enters this index. Queries match metadata, not the full source text. Matching source rows are still fetched and checked before offering a prepared circuit, with stale circuit-ID mismatches omitted. Other datasets use their provider's search. This avoids dependence on a cold/unavailable upstream full-text index for the main collection.


## General source preparation target

The broader library requirements are in
[the product plan](PLAN.md#library-requirement-find-a-design-and-use-it).
The first durable implementation is described below. These requirements also
cover future native-format adapters and engineering validation; they do not imply
that every public format can already be converted.

A durable preparation job should resolve a selected source revision and its
artifact/dependency manifest, detect supported views, invoke format adapters,
construct symbols and connectivity, resolve models and testbench configuration,
validate the resulting project, and publish the prepared artifact. Resume jobs
after reloads and retain useful diagnostics. Keep editable, simulatable and
validated capabilities separate. Do not require an AC gain testbench merely to
open a circuit or infer that a layout archive is a schematic.

Build a representation with typed devices and model-backed subcircuit instances,
named terminals, hierarchy, parameters, stimuli and analyses, plus preserved
native artifacts. Use native converters where appropriate instead of requiring a
language model to reconstruct every file. The preparation agent chooses and
configures bounded tools, reads source documentation, and proposes mappings or
repairs. It does not deploy arbitrary production code on a visitor's request.
New tool/model capabilities still require normal implementation and validation.

Check terminal identity, connectivity, device/model types and parameters across
conversion. Validate tool execution and compare reference behavior when a
runnable original exists. Running a simulator successfully is not proof of
semantic equivalence. Separate proposed repairs from faithful imports. Store
source hashes, dependency revisions, mapping decisions and tool versions in each
prepared artifact; invalidate caches when these change. Reuse public-source
preparations, while keeping private designs/dependencies scoped to their owner.

The UX must expose genuine preparation progress and actionable missing inputs.
A broader search result list with disabled import actions is discovery only;
it does not meet the intended find-and-use experience. Prioritizing prepared
results can improve responsiveness, but does not replace broader preparation.

As an industry reference, Cadence's [Spice In documentation](https://support1.cadence.com/public/docs/content/11719040.html)
describes CDL/SPICE/Spectre/HSpice import and device/reference-library mappings.
That illustrates the infrastructure behind a mature import experience, rather
than a guarantee that arbitrary public files are directly runnable.

## Implemented source preparation (2026-10-17)

`Preparation` is a Durable Object with alarms for retrieval, dependencies,
adaptation and publication. D1 owns per-session job state; R2 stores intermediate
source bundles. The browser polls progress but is not the job scheduler. Each job
has an idempotency key and deterministic project ID. A transaction publishes the
project, revision, source reference, event and completed job together.

The declarative adapter preserves named model-backed terminals, node aliases,
subcircuits, model/parameter cards and source waveforms. Relative includes resolve
inside the pinned public repository, with cycle, depth and size bounds. Public
prepared artifacts are keyed by source/dependency contents and adapter version.
The cache is never used for uploaded private projects. Unsupported native formats
can offer actual associated electrical files. Workers AI ranks those file paths;
selection still requires confirmation because file similarity is not equivalence.
GDS/Xschem geometry conversion itself is not implemented.

`Sources` groups original files and setup with the project. Model attachment is
validated and saved through the normal revision/event path. Missing models or
connections block simulation rather than replacing the selected design. Source
control commands are never executed. ngspice independently validates generated
declarative syntax inside its bounded container process. Installed SKY130 model
files are pinned and checksum verified, including MOS/BJT typical dependencies.

Worker activation precedes container image rollout. A simulator protocol header
keeps new source projects from using an old image silently during that interval;
the UI receives a retryable service response until the image supports them.


## Shared engineering tools

Ordinary Chat proposes validated tools alongside the existing edit-operation
schema. A tool proposal contains ordered calls and a revision/context snapshot;
it does not run until accepted. `create_circuit` imports a declarative netlist
composed by the model. `simulate`, `generate_layout`, `verify_layout`, and
`simulate_extracted` operate on the current document. The same backend powers
the normal editor toolbar. There is no dedicated circuit screen, saved stage
machine, template selection tool, or mandatory progression.

`engineering.ts` derives probes, stimuli, analysis, device identities, connections
and W/L from the document. The Python generator derives diffusion/poly, contacts,
taps, wells, M1 terminal corridors and M2 net tracks from that data. Each physical
grid unit is 10 nm. The generated shapes are editable document rectangles. The
inverter and XOR live in `examples/` as ordinary library data. Independent NAND
regressions exercise the same code with different names, connectivity and timing.

Pinned Magic runs the public SKY130 technology against these rectangles, producing
Magic source, GDS, extracted SPICE and DRC output. The bounded checker compares
flat MOS type, gate, body, unordered drain/source, W and L. Extracted simulation
rejects mismatches and DRC violations, replaces schematic MOS lines with actual
extracted devices/capacitances, and retains external stimuli, load and analysis.
There is no hardcoded truth function or circuit-specific testbench in the tools.
Transient measurements report voltage ranges and matched input/output midpoint
crossings, with the heuristic disclosed. This is not exhaustive timing analysis.

D1 `engineering_workflows` stores fingerprints, tool outcomes and measurements.
Electrical/analysis changes invalidate measurements; geometry changes invalidate
extraction. A project lease, proposal lease and optimistic revision checks prevent
concurrent calls from overwriting newer work. Proposal cursors allow reload and
explicit continuation; a failed check stops subsequent tools. Each created design
or generated layout is an ordinary revision, with undo and durable snapshots.
Chat, events and runs record actual outcomes. Private R2 artifacts use owner-checked
routes. Protocol 4 is required. Extraction includes capacitance and junction
geometry, not distributed wire resistance or manufacturing signoff.

Migration 0006 creates a separate state table so a prior Worker can serve traffic
until rollout. Historical logic-workflow records are not interpreted as current
engineering results. Their project documents remain accessible.
