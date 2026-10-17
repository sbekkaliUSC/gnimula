# Examples and demonstration

Both starters are independently authored in `backend/shared/circuit.ts`; there is
no external circuit dataset or PDK dependency.

- **Common-source amplifier:** 3.3 V supply, 10 kΩ drain resistor, W/L 10/1 µm
  generic NMOS, input bias 1.25 V, and 10 pF output load. Expected operating
  output is approximately 1.4585 V and low-frequency gain 16.3604 dB with the
  included Level-1 model. Changing model/device values changes those results.
- **NMOS current mirror:** two generic NMOS devices, reference/load resistors,
  and a source sweep. Useful for dimension matching and repeated placement.
- **Blank:** construct a small circuit from the toolbar and wire terminal dots.

Concept layout rectangles illustrate editing and pattern continuation, not a
physically verified implementation of either schematic. Layout and schematic are
independent documents in the same project.

For the memory demo, request a repeated NMOS placement at default spacing 160,
save a project spacing of 220, reload, and request another continuation. Compare
with memory disabled. Measure acceptance, correction effort, and solver outcomes
separately; no 40× time-saving result is established by this demonstration.
