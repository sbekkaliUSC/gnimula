# Gnimula

A browser circuit-design workbench with goal-aware chat, shared engineering tools, autocomplete, and a searchable public circuit library.

**Try it: [gnimula.stream](https://gnimula.stream)**

Open a circuit, place and connect devices, measure its response, and continue
edits with a previewed suggestion informed by your goal and attached references. The familiar dark workbench includes
schematic, layout, simulation, properties, history, and generated SPICE
views. Nothing needs to be installed by visitors.

## Work from a circuit and a goal

Open a circuit from **Library**, edit it directly, or start a blank project and
ask **Chat** to create one. In Edit mode the assistant can propose a netlist,
schematic simulation, physical layout generation, verification, or extracted
simulation. Review the proposed tools and click **Run tools**. Each operation
uses the current project and appears in its normal Schematic, Layout, Simulation
or Netlist view. Stop between tools, inspect results, edit, or undo as needed.

The Layout toolbar exposes the same generation, verification and post-layout
simulation tools directly. Simulation compares schematic and extracted waveforms
using the project's actual stimuli, probes and analysis range. Netlist offers
schematic/extracted views; GDS, Magic source and extracted SPICE are available
after extraction. Geometry edits invalidate extraction; electrical or analysis
edits invalidate measurements. Reload retains results and unfinished tool proposals.

Physical generation currently supports small flat SKY130 MOS circuits with
external voltage sources and load capacitors. It derives geometry from device
connections and dimensions. The library's inverter and XOR are ordinary circuit
examples; the tools do not select a topology or enforce a circuit-specific sequence.

## What works

- Place, move, rotate, connect, duplicate, and delete MOS devices, resistors,
  capacitors, voltage/current sources, and grounds. Edit parameters with explicit units.
- Draw and edit layered rectangles; inspect net labels and basic geometry guides.
- State a persistent project goal and discuss the circuit in a Code-style chat panel.
  Ask mode explains; Edit mode proposes validated, undoable changes. The assistant
  can abstain instead of forcing a repetitive placement.
- Open a wired circuit from **Library** with one click, or choose **Open & run** to
  launch its testbench. The previous project stays saved. Models, connections,
  source attribution and assistant context are prepared automatically.
- Search public GitHub/Hugging Face sources, then **Prepare & open**. Preparation
  runs durably through retrieval, dependency resolution, conversion and publication.
  Reloads retain progress; completed projects remain in Library.
- Preserve named subcircuit ports, hierarchy, model cards and pulse/PWL stimuli.
  An editable circuit can open while missing simulation setup remains visible.
  **Sources** shows originals, dependencies and setup; add public model files there.
- Choose among thirteen starter circuits: nine independent examples, an official
  ngspice band-pass example from GitHub, and three public SKY130 op-amp records
  from Hugging Face. Search and filter these prepared designs by source or model.
- Apply AC/DC testbenches, a sine input or concept-layout contact/via blocks directly
  to the current design. These edits support undo. Paste a supported public circuit
  file link to let Gnimula fetch and prepare it without a download/upload workflow.
- Use installed SKY130 typical NFET/PFET and selected NPN/PNP models, including separate body
  connections and current sources. Source records and preparation notes stay with
  the project; original dataset metrics are not substituted for fresh measurements.
- Accept, dismiss, undo, and redo edits. Stale proposals cannot overwrite a newer
  cloud revision. Saved revisions can be restored as new edits.
- Remember project-specific spacing and MOS-width corrections. Preferences survive
  reload and influence later proposals; they can be disabled or deleted.
- Run real ngspice AC, DC, and transient analyses in isolated server processes.
  Plots and solver output identify the circuit revision and measurement units.
- Save projects and action records in Cloudflare D1, with private R2 circuit
  snapshots and simulation artifacts. Local drafts and event queues survive
  reloads; server acknowledgement deduplicates retries.
- Import/export JSON designs and activity, and export SPICE or layout SVG.
- Open the settings gear for Editor and Data controls. Help → Legal & privacy
  holds the privacy explanation, preview terms and dependency notices.

This is an early workbench, not a foundry signoff tool. Simulation supports generic Level-1 MOS and a pinned
SKY130 typical MOS/BJT subset and supported source model cards. Manually drawn layouts use a concept canvas. Generated physical layouts use 10 nm
coordinates, the public SKY130 Magic technology, DRC, exact flat MOS
connectivity/type/dimension comparison, extraction and GDS export. Post-layout
simulation includes geometric capacitances and junction geometry; distributed
wire resistance, comprehensive signoff/LVS, corner sweeps and general-purpose
analog synthesis are not implemented. The founder's 80-hour-to-2-hour
ambition remains a target, not a measured result.

## Try the assistant and reference loop

1. Open **Chat** and save a goal, for example: “Tune amplifier values without adding
   voltage sources or changing the topology.”
2. In Edit mode ask: “Set RD to 22 kΩ. Preserve wiring and other values.” Review the
   proposed parameter change, apply it, simulate, and undo if needed.
3. Switch to Ask mode to discuss the measured response without producing edits.
4. Open **Library** and click **Open & run** on the RC filter or a SKY130 op amp.
   The new project already has its source, model and testbench connected.
5. Choose **Use & run** on Frequency response or the 10 kHz input signal to measure
   the current circuit. Undo restores its previous setup.
6. Save a spacing or MOS-width preference in Memory; goals, preferences, messages
   and attached references survive reload within the guest session.

The assistant is Llama 3.3 70B on Workers AI. It receives structured circuit data,
connectivity, recent actions, messages, goals, preferences and reference excerpts.
It does not receive a live screenshot, execute arbitrary tools, browse autonomously,
or retrain its weights. In Edit mode it can propose five bounded engineering tools and records their actual results. The Library searches public circuit records and repository files. The preparation
agent may rank actual electrical-source candidates for unsupported native files;
it does not invent a netlist or silently replace a design. Hierarchical SPICE is
supported. Native GDS/Xschem geometry conversion and full PDK installation remain
unimplemented; associated electrical files can be selected inside preparation.
PDK context alone does not change device models or enable foundry checks; physical generation explicitly installs and invokes its documented SKY130 toolchain.

## Development

Node 22+, npm, Python 3.9+, and ngspice are required for the checks below.
Docker is needed for container deployment and the physical-flow checks. Magic is built at a pinned revision in the simulator image. Dependencies are pinned in the lockfile.

```sh
npm ci
npm test
python3 tests/simulator_test.py
python3 backend/simulator/install_models.py runtime/models
GNIMULA_MODELS_DIR="$PWD/runtime/models" python3 tests/sky130_test.py
npm run build
```

For the actual Magic/ngspice regression suite:

```sh
docker build -f backend/simulator/Dockerfile -t gnimula-simulator .
docker run --rm --entrypoint python -e PYTHONPATH=/app -e GNIMULA_MODELS_DIR=/app/models \
  -v "$PWD/tests:/tests:ro" gnimula-simulator -m unittest discover -s /tests -p '*_test.py'
```

For local API/editor development:

```sh
npx wrangler d1 migrations apply gnimula-main --local
GNIMULA_MODELS_DIR="$PWD/runtime/models" python3 backend/simulator/server.py
# In an ignored .dev.vars file, set LOCAL_SIMULATOR=http://127.0.0.1:8080
npm run api:dev
# Another terminal:
npm run dev
```

The Vite editor proxies API traffic to port 8790. Model access depends on Cloudflare authentication. If inference fails, the assistant
reports failure and leaves the design unchanged; there is no forced pattern fallback.

See [operations](docs/OPERATIONS.md) for deployment, [architecture](docs/ARCHITECTURE.md)
for implementation, [action data](docs/ACTION_DATA.md) for collection/retention, and
[the audit](docs/AUDIT.md) for validation evidence.

## Folder map

| Folder | Purpose |
| --- | --- |
| `frontend/` | React workbench, SVG editors, plots, local draft/event sync |
| `backend/` | Worker API, circuit model, D1 schema, Python ngspice service |
| `examples/` | Independently authored circuit examples |
| `tests/` | Circuit and numerical simulator checks |
| `scripts/` | Cloudflare provisioning and deployment support |
| `docs/` | Product direction, implementation, operations, audit |

Use `gnimula.code-workspace` for a focused VS Code window, or the project folder
in the existing multi-root workspace. Removing its workspace entry does not delete
this repository.

## Source sharing

The public source repository is [sbekkaliUSC/gnimula](https://github.com/sbekkaliUSC/gnimula).
It contains the application source and distributable verification fixtures, with
its own history. Development history, local configuration and user records stay
private. A project license has not yet been selected; dependency notices are
listed in [third-party notices](docs/THIRD_PARTY.md).

Maintainers publish committed source snapshots using
`python3 scripts/publish-source.py --push`. The script exports only tracked files,
checks for known credential patterns and private references, and preserves the
public repository's separate history. It never pushes development history.
This app is implemented independently from new source and public dependencies.

### Search public circuits

Library → Online circuits searches Hugging Face dataset records and GitHub circuit files. The default SKY130 source has 130,409 records across its partitions, including parameter variants; the app shows source counts and checks each displayed record for supported models and a usable testbench. Open supported results directly, run them, or open an assistant explanation grounded in the imported source. Starter circuits and Circuit tools remain available separately. Sources needing conversion enter preparation, with associated electrical-file choices where available and specific setup diagnostics. Public supply is not an exclusive dataset, and the preview does not provide manufacturing tapeout/signoff.

### Navigate the editors

Hover or focus the schematic/concept-layout canvas to use its shortcuts:

| Action | Gesture |
| --- | --- |
| Zoom around the pointer | Mouse wheel / trackpad scroll; pinch also zooms |
| Pan without a middle button | Hold Space and drag with the left button |
| Pan with scrolling | Shift + scroll (horizontal or vertical) |
| Pan with keys | Arrow keys; Shift + arrows for larger steps |
| Fit the circuit / selection | F / Shift+F (Ctrl+Shift+F also focuses selection) |
| Zoom in / out | + / −; Shift+Z also zooms in |
| Zoom into a region | Z, then left-drag a box; or right-drag |
| Cancel a gesture | Escape |

Middle-button drag and the hand tool remain available. Ctrl+Z retains Undo.
Navigation shortcuts leave chat, property fields, and dialogs alone. Wheel zoom
is anchored to the pointer; toolbar zoom is centered. These are independently
implemented browser interactions informed by the [public Xschem command guide](https://xschem.sourceforge.io/stefan/xschem_man/commands.html), not a native editor dependency or complete shortcut parity.
