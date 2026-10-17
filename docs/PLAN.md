# Gnimula product and implementation plan

## Product direction

Build a public website where an engineer or student can perform analog design
through a familiar VS Code-style interface. The product scope includes projects,
schematics, simulation, layout, verification, and export. AI autocomplete infers
likely next operations from what the person is doing and reduces repetitive
editor work. A prompt-driven assistant can supplement that interaction.

Present the product as Gnimula throughout the app, public documentation, source
submission, and demonstration. The public preview is hosted at https://gnimula.stream. Keep internal business context
outside the public project and implement the product independently.

The founder's reference is approximately 80 hours spent on a Virtuoso workload.
The ambition is comparable work in approximately 2 hours.
Neither this speedup nor full product parity has been demonstrated. The first
build should show a complete representative workflow and honestly identify the
parts it supports.

## Core interaction

1. Open or create a project and work directly in the schematic or layout editor.
2. Record actions and revisions as the user places, connects, edits, or inspects.
3. Use current structure, selection, constraints, and recent actions to infer a
   likely continuation, such as finishing repeated connections or placements.
4. Preview a concrete edit. The user accepts, adjusts, dismisses, or ignores it.
5. Apply accepted edits through normal editor commands, with undo and validation.
6. Simulate or run supported checks, then inspect results against the objective.
7. Save and export the design; retain the action sequence and suggestion outcomes
   under the applicable data-use settings.

Background capture and durable storage are part of this loop from the first
editor implementation. Preserve actions and outcomes beyond the current session
for replay, evaluation, and appropriately scoped correction memory. Training on
retained activity is a later, separate operation; no automatic online weight
updates are implied.

## First release status

The workbench, editors, persistent event pipeline, preference memory, candidate
previews, isolated ngspice integration, and public hosting are implemented.
Validation results and limitations are recorded in [the audit](AUDIT.md). Concept
layout editing is present; manufacturing verification and general synthesis remain
future work. The sequence below defines the broader milestones.

## Build sequence

| Milestone | Concrete result |
| --- | --- |
| Web workbench | Publicly reachable browser UI with a VS Code Dark Modern-style shell and a sample project; domain can be attached later |
| Editor and event foundation | Stable design objects, normal editing commands, undo/redo, revisioning, background action capture, and reconnect-safe sync |
| Schematic autocomplete | A real repeated operation completed from implicit context, with preview, acceptance/revision/dismissal, and stale-result handling |
| Correction memory | A saved correction survives a reload and influences a later relevant suggestion; its source and scope remain inspectable |
| Engineering loop | Netlist generation, measured simulation results, and errors attached to the correct revision; the user can iterate and export |
| Layout workflow | Basic placement/routing and completion of a repeated layout operation, with the checks actually supported clearly identified |
| Public service readiness | Persistent projects and events, session isolation, bounded guest compute, collection disclosure and data controls, and a usable hosted demo |
| Demonstration and evaluation | A coherent engineering task with and without assistance; documented time, correction effort, engineering results, and known gaps |

The hackathon should prioritize a coherent task through these capabilities over
many disconnected mock screens. Maintain the full product direction while making
each delivered capability real. Do not label a layout as signoff-clean unless the
app has actually run the relevant checks with appropriate rules and models.

## Architecture choices

- TypeScript browser frontend; React is a candidate for a custom workbench.
- Evaluate a VS Code-derived web shell before deciding whether a fork saves time.
  Compare custom EDA canvas integration, browser deployment, maintenance, and
  third-party distribution requirements. A fork is not a product requirement.
- Keep the design model, command/event layer, and autocomplete contract separate
  from the workbench shell so that choosing a shell does not redefine the product.
- Backend services may use Python/FastAPI and/or TypeScript. Run simulation in
  isolated workers and store project/event data durably for public use.
- Select a model using actual structured-edit quality, latency, and cost on these
  workflows. Workers AI proposes validated structured edits, answers questions, or abstains.

See [architecture](ARCHITECTURE.md) and [action data](ACTION_DATA.md).

## Evaluation and supporting features

Measure valid task completion and total human effort, including fixing incorrect
suggestions. Track autocomplete acceptance, subsequent edits and undo, latency,
and engineering outcomes separately. Acceptance alone is not correctness.

For the adaptation demonstration, record a specific correction, reopen the
session, and perform a different operation to which the correction applies. Show
the retrieved memory and its effect on the suggestion. Compare with memory
disabled when feasible. Describe this as persistent application memory; merely
storing actions does not establish improved behavior or weight training.

Tutorial search, video classification, and Jev remain possible supporting work.
They should earn their place by improving a workflow; they are no longer the
center of the demonstration. If a classifier is tried, evaluate it on reviewed
examples and record uncertainty and actual usage.

## Next product work

The first release uses independent amplifier/current-mirror examples, generic and selected SKY130 MOS
models, React/SVG, Workers AI, D1/private R2, and per-guest ngspice containers.
Next: evaluate actual engineering workflows, broaden candidate operations, add
PDK-backed checks and project accounts, and validate end-to-end task time.
The domain is connected. Prepare public source from an
inspected snapshot in a separate repository; keep development history private.
Licensing and final submission details remain distinct from public app access.

Chat, goals and a ready-to-use Library supplement the editor. Circuit setup,
selected SKY130 model installation, public-source preparation and testbench
selection run inside Gnimula. The next library milestone is general source
preparation and interoperability, as specified below. Current native-format
conversion remains limited; the target is not implemented merely by changing
labels or adding a search provider.

## Library requirement: find a design and use it

The user's requirement concerns the entire library experience. The ADC search
was an example of the gap, not a request to specialize the product in ADCs.
A visitor should select a design and begin working with it while Gnimula handles
source retrieval, dependencies, format conversion, symbols, model mapping and
appropriate testbench setup. Rewording an unsupported-format message or expanding
search counts does not satisfy this requirement.

The primary path is Search → Open (or Prepare & open while work is required) →
an appropriate editable workspace. Longer preparation runs report actual progress,
survive reloads, and produce a reusable prepared artifact. Known source conversions
use established parsers and tools. A preparation agent handles variable packaging,
dependency resolution and mapping decisions through those tools, with explicit
checks before offering the result. Do not advertise that path before it exists.

The source architecture must represent more than the original small set of
hard-coded devices: preserve hierarchy, device/model identity, named pins,
parameters and analysis setup. Native source artifacts and corresponding editor
views belong to the same project. A layout opens as layout; a testbench attaches
to the appropriate circuit. Ability to inspect/edit and readiness to simulate
are distinct capabilities, so missing simulation setup need not block access to
usable design content. An opaque model block must retain its identity and known
pins; displaying it is not a claim that it can be simulated or edited internally.

Keep compatibility setup inside the app. Ask the user only for information or
access the app cannot obtain, such as a missing private model or an ambiguous
engineering choice. A genuine unresolved dependency needs a specific explanation
and recovery path. Preserve the original design and distinguish conversion from
an electrically different repair or redesign. Cache validated preparations by
source, dependency and converter versions so later visitors do not repeat work.

Evaluate diverse source families and engineering tasks. Measure the proportion
of selected results reaching an editable workspace and a valid simulation,
preparation latency, manual interventions and preservation of circuit structure.
Search result counts and permissive imports alone are not success measures.
ADC samples may be regression fixtures within this broader effort. See the
architecture's proposed preparation service and its current implementation boundary.
