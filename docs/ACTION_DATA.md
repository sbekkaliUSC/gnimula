# Background action capture

The first implementation captures and stores in-app action records. The detailed
contract below remains the target; this section records current boundaries.

## Current implementation and retention

- D1 also stores project goals, selected PDK context, chat messages and attached
  reference text/metadata. These share the project ownership and 30-day guest
  retention boundary. Model calls include recent chat and bounded reference
  excerpts; attachments remain private and are not published with the source.
- D1 stores commands, navigation/selection, suggestions, decisions, memories, and
  simulation lifecycle records. R2 adds circuit snapshots and solver artifacts.
- Browser commands include object changes, client ID, sequence, timestamps, actor,
  and design revision. Large changes split into chunks. Server events use receipt
  order and revision rather than inventing a client sequence.
- The outbox persists locally until durable acknowledgement. Reload recovers it;
  only the active project's pending queue is actively retried. Reopen an inactive
  project to retry its pending records. Cross-tab writes use revision conflicts.
- Export includes the design, preferences, goal, references, latest 100 chat messages, and up to 20,000 events, with a
  truncation flag. Project restoration is tested; full event replay tooling and
  external database backup restoration are not implemented in this release.
- Guest sessions and active records expire after 30 days. Daily cleanup removes
  expired D1 records and R2 artifacts. The UI does not offer whole-session
  deletion; authenticated `DELETE /api/session` remains implemented and removes
  the current guest's active data. Managed recovery backups may retain it for
  their recovery window.
- The settings gear opens **Settings → Data controls**, with the training preference, guest-session information and project/activity export. **Help → Legal & privacy** contains the privacy explanation, preview terms and third-party notices. Future model-training eligibility is enabled for new guest sessions; the checkbox can turn it off.
  Existing sessions keep their stored setting, including opt-outs. No training job
  currently consumes live records. The legacy API/database field names
  `trainingOptIn` / `training_opt_in` now represent eligibility, not evidence of
  an affirmative consent action. A default setting alone does not establish
  permission for every future use; training exports must apply the eligibility
  and provenance checks described below.
- Pointer trajectories, raw keystrokes, unrelated browser activity, and credentials
  are not collected. Drag-end geometry is captured. Not every visual panel control
  is a separate event; the implementation does not claim exhaustive pointer replay.


## Coverage and purpose

Capture user activity inside the app while the person works, without requiring
manual narration or labeling. The goal is a faithful sequence of engineering
operations and their context, not just page-view analytics or accepted AI answers.

Durable storage is a core requirement. Retain action sequences, design revisions,
corrections, suggestion outcomes, and referenced engineering results beyond the
browser session under the defined retention policy. These records are a product
asset for replay, evaluation, adaptation, and eligible future training; ordinary
console logs or an in-memory buffer do not satisfy the requirement.

| Event family | Examples and context |
| --- | --- |
| Library | Prepared design/source selected; original content and preparation provenance; circuit-tool changes and undo |
| Project lifecycle | Create/open/import/save/export; project and revision IDs |
| Editor changes | Place, delete, move, rotate, connect, disconnect, route, copy/paste, change parameters; object IDs and exact edits |
| Interaction context | Selection, tool changes, commands/shortcuts, focus, zoom/pan, property inspection, and drag start/update/end |
| Engineering jobs | Requested settings and input revision, start, failure, completion, result references |
| AI interaction | Context revision, generated and displayed proposals, edits, acceptance, dismissal, cancellation, and subsequent undo |
| Explicit communication | In-app task requests, constraints, corrections, and feedback when supplied |
| Recovery | Local queue checkpoints, acknowledged event ranges, and resynchronization |

Record state-changing commands faithfully. High-frequency pointer and viewport
updates may be batched or compacted with their start/end and timing retained;
document any sampling and do not claim exact pointer replay if it is unavailable.
Keyboard input is represented as editor commands or submitted field edits, not a
general-purpose raw keystroke log. Capture paste results as design edits rather
than reading unrelated clipboard contents.

## Event contract

Each event needs a schema version, stable event ID, session and project IDs,
actor type (human, model, or system), client sequence and timestamp, server
receipt time, event type, and the applicable design revision. Mutation events
reference affected objects and the operation payload needed for replay. Keep
snapshots/checkpoints for recovery without duplicating the entire design in every
event. Where several clients edit a project, the server must define the canonical
revision order rather than relying on wall-clock timestamps.

Link suggestions to a proposal ID, model/configuration version, exact context
revision, and the later user decision. A missing response is not necessarily a
rejection: the user may navigate away or close the tab. Distinguish explicit
dismissal, expiration, cancellation, acceptance, modified acceptance, and undo.
Store rendered suggestion content and relevant structured context for assessment.

## Reliability

Queue events locally with stable IDs, send in batches, acknowledge stored ranges,
and retry without duplicating records. Track gaps rather than silently claiming
complete capture. Persist projects and events independently of disposable worker
files. A capture outage should be visible and recoverable without blocking normal
editing when local work can continue. Replaying a trace must reproduce the
recorded design revisions for the operations the editor supports.

Acknowledge batches only after durable commit. Maintain backups of records and
referenced artifacts, and exercise a restore. Verify that reloads, worker/server
restarts, and retried batches preserve acknowledged events without duplicates.
Distinguish pending local records from server-confirmed storage in diagnostics.

## Persistent correction memory

Preserve explicit corrections with their source event IDs, user/project scope,
relevant objects or operation type, creation time, and later updates. Store
derived memory separately from the observed action stream. A dismissal alone
does not identify a reusable preference; keep uncertain interpretations marked
as inferences rather than silently promoting them to instructions.

Retrieve applicable corrections for later suggestions, including after reopening
a project. Let users inspect, amend, and remove saved corrections. Record which
memory items were used for each suggestion so their influence can be assessed.
Keep private memory isolated between users and honor deletion across derived
records and future exports.

The demonstration should show a correction surviving a reload and changing a
later relevant suggestion, with a memory-disabled comparison where feasible.
This demonstrates application-level adaptation when successful; logging alone
does not demonstrate it and no model-weight training is implied.

## Intent, labels, and data use

Keep observed actions, model-inferred intent, and verified engineering outcomes
as separate fields. Accepting an edit is evidence of a user choice; it is not proof
that the circuit works. Undo and corrections matter. Do not use a model's earlier
guess as a supposedly independent ground-truth label.

Action history supports autocomplete context, debugging, replay, product
evaluation, and potentially future training. Future training exports should have
clear provenance, data-use eligibility, and project/user-separated evaluation
splits. Recording sessions does not imply continual online weight training.

Keep the background collection explanation accessible through **Help → Legal & privacy**, with a direct link from Settings. Scope it to Gnimula;
exclude passwords, credentials, unrelated browser/OS activity, and other users'
projects. Define retention and export/deletion behavior, and separate operational
session storage from optional secondary model-training use. Do not publish raw
user designs or traces with the source repository. Redact sensitive content before
it reaches logs or a model provider, and apply project/session access boundaries
to both events and referenced artifacts.

## Measures

Track valid task completion, human working time, number of manual operations,
correction/undo effort, inference latency, capture completeness, and simulation
or verification outcomes. These measures can test the 80-to-2-hour ambition over
time. A high autocomplete acceptance rate alone cannot establish that improvement.

Canvas navigation emits `viewport.changed` records with the starting/final camera,
source gesture, action and update count. Continuous wheel/key/drag updates are
coalesced after 250 ms idle; pointer release flushes the gesture. Navigation does
not create a design revision or trigger edit autocomplete. Delayed records for a
project that has already been closed are discarded instead of attached to the new
project. These records describe viewport changes, not full pointer trajectories.

Source preparations record the requested public locator and completed stages in
session-owned job records. Publication emits `project.prepared` with source,
preparation notes, simulation issues and cache reuse; opening emits
`library.preparation.opened`. The initial revision retains the full imported
structure and original source reference. Model attachments use
`source.models.attached`; source-definition changes are marked in the event and
recovered from the saved revision, rather than truncating a large model deck into
an event. Public conversion caches contain only fetched public source material,
not guest goals, chat, private projects or behavioral records.


Ordinary Chat stores model-proposed engineering calls, model identity, revision,
context and execution cursor in proposals. Accepted calls record actual outcomes
in `engineering_workflows`, chat, runs and `engineering.tool.completed` events.
The actor distinguishes model-proposed calls from direct toolbar operations.
Generated document edits retain ordinary revision snapshots. Private artifacts
follow project ownership and guest retention. These records describe proposals
and measured outcomes, not private reasoning traces or unmeasured success.
