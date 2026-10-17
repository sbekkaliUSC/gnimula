> Historical release evidence. The dedicated screen and links described below
> were superseded by ordinary Chat/editor engineering tools later on 2026-10-17.

# AI-driven MOS logic demo — 2026-10-17

Available at **https://gnimula.stream/?demo=xor**. Click **Start AI XOR demo**.
Choose the inverter card first for the two-transistor version. A new project
preserves existing work. Once a demo project is open, use **Run next AI step** to
present one stage at a time or **Continue demo** to complete the sequence.

## Verified release

Implementation `94e9cd2`, Worker `125d5fee-e60b-485f-890d-2f0e61108e30`.
Simulator protocol 3, image digest
`sha256:3d6a690444fde73af9b44f8bd8654edb5ce053e510d42682dbab29785d0a46e9`.
Cloudflare image provisioning lagged the first Worker deploy. The final hosted
check completed without rollout retries. Both circuits used actual Workers AI
calls, real Magic checks/extraction and real ngspice measurements.

| Circuit | MOS devices | Extracted capacitors | Magic DRC violations | Schematic worst delay | Extracted worst delay |
| --- | ---: | ---: | ---: | ---: | ---: |
| Static complementary XOR | 12 | 45 | 0 | 118.3304 ps | 220.2230 ps |
| CMOS inverter | 2 | 5 | 0 | 80.6407 ps | 92.6657 ps |

Both pass eight settled samples, covering every input combination, before and
after extraction. Extracted MOS terminals, types and dimensions match the
schematic. The testbench uses 1.8 V, typical SKY130 models, 20 fF output load,
100 ps input edges and a 160 ns transient. Worst delay is the maximum measured
input-to-output 50%-VDD crossing delay across the supplied transitions. It is
not a characterization across all possible slew, load or process corners.

## Present the loop

1. Start the XOR demo. The work log shows the model's next-tool reason and the
   actual result, also reflected in Chat. The schematic contains individual MOS
   devices, not abstract XOR/AND/OR gate blocks.
2. Watch the schematic truth test complete, followed by physical geometry.
   Inspect **Layout**; wheel zoom and Space + left-drag navigation work there.
3. Show **Layout connectivity: Match** and the measured Magic DRC count.
4. At completion, select **Waveforms → Zoom first switching edge**. Scroll the
   center pane enough to show the whole plot. Dashed purple is the schematic
   output; solid green is the extracted result. The increased delay is measured.
5. Scroll to the truth table and work log. Open **Extracted SPICE** or download
   GDS, Magic source and extracted SPICE. Reload to demonstrate saved progress.

The model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. It selects from bounded
engineering tools and supplies sizing/load parameters when building. New code
constructs the canonical circuit and deterministic physical rectangles. Magic
checks/extracts that geometry; ngspice measures it. The AI does not freehand every
polygon, and this is not a general synthesis agent.

## Validation

- 55 Node tests and TypeScript/production build pass.
- 13 Python tests pass inside the production simulator image. They include
  both real physical flows, a deleted-poly failure that cannot substitute a
  schematic result, and increased delay when the external load is increased.
- Hosted browser QA completes the XOR with all five model-selected tools and
  no page errors; the inverter completes the same five tools through the API.
- Reload preserves geometry, results and work log. All three artifacts download.
  A different guest cannot read the workflow or artifacts.
- Dragging an actual physical shape invalidates extraction and post-layout
  measurements without reload and enables rechecking. Electrical edits invalidate
  the baseline as well. Stale tool requests receive a revision conflict.
- Disposable QA sessions were removed after validation.

Reproduce with `scripts/logic-demo-qa.py`, `tests/logic_test.py` and README's
container test instructions. [Hosted checks](hosted-checks.json) retain actual
model decisions and measured output samples; [Python results](physical-suite.txt)
record the numerical/physical suite.

## Boundaries

Physical coordinates are 10 nm per unit. The generator uses dedicated M1 terminal
corridors and M2 net tracks; it prioritizes explicit, checkable connectivity over
compact placement or optimized timing. The 12T topology does not imply that this
generated layout is area- or speed-optimal.

Post-layout simulation uses freshly extracted devices, junction geometry and
geometric capacitances. Distributed wire resistance is not extracted. The
connectivity check compares flat MOS records; it is not full hierarchical LVS.
Zero errors means zero reported violations under the loaded public Magic SKY130
rules, not manufacturing signoff. No process-corner/temperature sweep, antenna,
electromigration or full tapeout certification is claimed.

## Screenshots

- [Start](demo-start.png)
- [Editable MOS schematic](demo-schematic.png)
- [Generated physical geometry](demo-layout.png)
- [Completed loop](demo-complete.png)
- [Measured switching-edge comparison](demo-edge.png)
