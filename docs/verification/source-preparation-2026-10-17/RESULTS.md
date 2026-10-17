# Public source preparation — 2026-10-17

Gnimula now prepares public electrical sources into editable projects through
durable jobs. This expands the original primitive-only import path to named
model-backed devices, hierarchical subcircuits, model/parameter definitions and
source waveforms. Originals, dependencies and preparation notes stay with the
project. Missing simulation setup does not discard an otherwise editable circuit.

Verified at `https://gnimula.stream` on Worker version
`e05bc9fc-bde6-4409-a100-2936e9a377a3`, from implementation commit `2b3bc23`.
The simulator image advertises protocol 2. An earlier image-rollout mismatch
was fixed and the complete hosted check passed again on this final deployment.

## Verification

| Check | Result |
| --- | --- |
| TypeScript and Node | Type checking passed; 52 tests passed |
| Local ngspice integration | Ten tests passed, including hierarchical/flat RC equivalence and SKY130 behavior |
| Installed BJT subset | All five provisioned devices returned finite 41-point DC sweeps |
| Public source row 43969 | Preserved 36 components, including 14 model-backed NPN instances; 615 transient samples |
| Public source row 43971 | Preserved 26 components, including ten model-backed NPN instances; 611 transient samples |
| Hosted preparation | Reload during processing, completed project recovery and measured ngspice transient response passed |
| Persistence and isolation | Cache reuse, idempotent request retry and cross-guest job rejection passed |
| UI geometry | Chat, Assist, Properties and Memory retain the same inspector/main/explorer widths at 1440 and 1100 px |
| Assistant mode menu | Dark rendering, selection, keyboard operation and Escape passed |
| Rapid UI exercise | 80 view/panel switches, no browser page errors |

The public records come from the `with_testbench/train` partition of
[pphilip/analog-circuits-sky130](https://huggingface.co/datasets/pphilip/analog-circuits-sky130).
Measured local ranges and model identity are in
[public-source-simulations.json](public-source-simulations.json). Hosted checks
are summarized in [browser-checks.json](browser-checks.json) and can be rerun with
`python3 scripts/preparation-qa.py`. It creates and deletes disposable guest
sessions; it does not use an existing visitor's session or project.

The final adapter also checks optional BJT substrate terminals and OFF flags,
hierarchy-root selection independent of definition order, and imported-device
duplication. Ambiguous cell libraries require an identifying source/testbench.
Cache version `source-project-2` prevents reuse of older conversion semantics.

## User-visible corrections

- Library offers **Prepare & open**, actual progress, recovery and completed jobs.
- **Sources** groups original files, dependencies, model definitions and setup.
- Removed the generic-model advisory from Problems. Model identity remains in
  relevant properties and simulation information.
- Assistant mode uses the app's dark menu. Chat/Assist switching preserves width.

Screenshots: [assistant menu](assistant-mode.png), [prepared source](prepared-sources.png).

## Boundaries

Successful parsing and simulation do not verify a publisher's claimed topology
or testbench adequacy. The public examples retain their original timing; a run
shorter than a full clock period is noted, not silently extended. A third inspected
record, row 43970, opens with its missing stimulus and disconnected pin reported.

There is no universal native-layout conversion. For supported public text sources
without a direct adapter, preparation searches actual associated electrical files
and may use Workers AI to rank them. The user confirms a counterpart; similarity
does not establish equivalence. GDS/Xschem geometry adapters, arbitrary PDK
installation and manufacturing verification remain outside this release.

Source control commands are preserved as reference text and never executed.
Dependency graphs and simulator execution are bounded. This check is a functional
release validation, not a throughput/load benchmark or exhaustive format survey.
