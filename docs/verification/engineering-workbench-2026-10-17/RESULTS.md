# Ordinary workbench engineering tools

The recording scenario is independent of the product. The dedicated circuit
screen, fixed stage progression and circuit-name routing were removed. The normal
Chat proposes generic tools; the normal Schematic, Layout, Simulation and Netlist
views expose their outputs. Inverter and XOR are ordinary library examples.

The current document supplies device connectivity and dimensions, stimulus,
probe and analysis settings. The model can compose a declarative netlist for a
blank project. There is no runtime XOR/NAND truth function or selected-template
action. The expected logic functions appear only in test assertions.

## Verification

The local suite passes 57 Node checks, TypeScript/build and 14 real
Magic/ngspice Python checks. It includes inverter, XOR and an independently
specified NAND; changed load/duration; broken-geometry rejection; and external
capacitor-name collisions. Physical extraction preserves the schematic's MOS
connections/types/dimensions and produces actual parasitic capacitances and GDS.

Hosted validation uses `scripts/engineering-qa.py` and disposable guest sessions.
It checks ordinary Library/Chat/editor interactions, creation from an explicitly supplied independent netlist, settled functional samples, artifact ownership, reload persistence,
stale results, proposal dismissal and ordinary parameter edits. The final run passed with zero browser errors; see [the recorded checks](hosted-qa.json).

## Observed model failure

The first hosted structural test found four MOS devices, matching extraction and
zero DRC violations in a model-created circuit called NAND. Inspecting its actual
netlist and waveform showed it behaved as an inverter: the second PMOS reused
the first input, and the second NMOS had shorted source/drain. That run did **not**
establish NAND functionality. Its [raw structural check](initial-structural-check.json)
and [waveform](initial-nand-wiring-error.png) are retained.

The hosted test now checks actual output levels for all input combinations.
General netlist guidance distinguishes functionality from successful simulation
or connectivity matching. Schema-constrained responses and one validation-error
correction attempt reduce malformed proposals. Neither is proof that an arbitrary
model-generated circuit implements a requested function.

## Scope

Physical generation supports 1–16 flat installed SKY130 1.8 V MOS devices,
W=1–8 µm and L=0.15–1 µm, with grounded NMOS bodies and external voltage sources
and load capacitors. Geometry prioritizes reproducible connectivity, not area or
performance optimization. Extraction includes capacitance and junction geometry,
not distributed interconnect resistance or manufacturing signoff.

Reported crossing delays use the first following output midpoint crossing after
a pulsed input midpoint crossing; thresholds come from measured ranges. This is
a disclosed heuristic, not exhaustive timing characterization. Functional
assertions in QA use settled measured outputs separately.

## Final hosted run

Worker `c3467aa2-56d1-4414-9f3d-ad4c01ae208f` passed the ordinary UI flow.

| Circuit | MOS | Extracted capacitances | DRC violations | Schematic crossing delay | Extracted crossing delay |
| --- | ---: | ---: | ---: | ---: | ---: |
| XOR | 12 | 45 | 0 | 119.8 ps | 221.0 ps |
| NAND | 4 | 13 | 0 | 65.2 ps | 86.0 ps |

Both circuits passed eight settled functional samples before and after extraction.
NAND used a supplied independent netlist, not free-form topology invention.
Reload, downloads, guest isolation, stale-result rejection, proposal dismissal
and ordinary 40 fF parameter editing passed. All disposable guests were removed.
[Ordinary Simulation view](xor-comparison.png) · [Ordinary Layout view](xor-layout.png).

Further improvements were stopped at the user’s request. The ordinary UI and
existing circuit examples remain deployed for the recording.
