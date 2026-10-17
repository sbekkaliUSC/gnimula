# ADC search and portability audit — 2026-10-17

Reproduced the default Library search for `adc` on the live site using a disposable
QA guest. It returned 50 metadata matches in the training partition. All 12 records
on the first page were source-only with `No supported complete AC testbench found.`
The first page includes three base circuit IDs and parameter variants, not 12
independent designs. The QA session and its records were deleted after inspection.

## Actual blockers

Inspected complete `with_testbench/train` rows 43969, 43970 and 43971 from
[pphilip/analog-circuits-sky130](https://huggingface.co/datasets/pphilip/analog-circuits-sky130).

| Source | Devices in source graph | Further findings |
| --- | --- | --- |
| [analogtobi_0815](https://huggingface.co/datasets/pphilip/analog-circuits-sky130/viewer/with_testbench/train?row=43969) | 14 NPN, 6 resistors | SKY130 NPN model; PULSE clocks and PWL input; transient comparator testbench |
| [analogtobi_0816](https://huggingface.co/datasets/pphilip/analog-circuits-sky130/viewer/with_testbench/train?row=43970) | 8 NMOS | Generated testbench explicitly reports no input ports; no signal excitation; transient comparator testbench |
| [analogtobi_0818](https://huggingface.co/datasets/pphilip/analog-circuits-sky130/viewer/with_testbench/train?row=43971) | 10 NPN, 7 resistors | SKY130 NPN model; PWL input; transient comparator testbench |

The graph counts exclude added supplies, bias sources, clocks and output load
capacitors. All three are publisher-labelled `adc`; that label and convergence
flag do not establish that each record is a complete functioning ADC. No source
circuit was simulated during this audit, and no electrical-function conclusion
is claimed. In 0815 the generated clock period is 1 us while the simulation stops
at 200 ns; that setup also needs review for a meaningful clocked measurement.

Gnimula already has a transient simulator path. The immediate failure is narrower:
`prepareSky130Record` only extracts an AC testbench. Extending that extractor
alone would expose further unsupported components/waveforms. The document,
rendering, import and model installation currently support SKY130 1.8 V NFET/PFET,
not the NPN model above. Voltage sources represent DC, AC magnitude and simple
SIN, not PWL/PULSE. The current runnable-circuit contract also expects an input
voltage source, so current-input blocks need an explicit measurement setup.

## Case-specific capability findings

Scope clarification: this audit illustrates the broader library preparation gap.
It does not make ADC support the next product milestone. The general requirement
and implementation direction are in [the product plan](../../PLAN.md#library-requirement-find-a-design-and-use-it).

1. Separate ability to inspect/edit a source schematic from availability of a
   complete runnable testbench; preserve unsupported device identities.
2. Add reusable transient-testbench, PWL/PULSE and appropriate bipolar-device
   adapters, including simulator models, rendering and property editing.
3. Detect missing excitation and questionable generated testbench assumptions;
   preserve the supplied circuit and distinguish proposed testbench repairs.
4. For less regular sources, an on-demand preparation agent can inspect the
   source/dependencies, propose mappings or testbench edits and invoke existing
   validators/simulator tools. Check device types, pin connectivity and parameters
   before/after; compare behavior against the original where runnable. Cache a
   validated conversion by source hash, dependency versions and adapter version.
   Successful simulation alone does not prove equivalence or ADC functionality.

Repeated known syntax should use deterministic adapters. An AI conversion cannot
preserve a device type or stimulus the editor's representation cannot express.
AI is useful for writing adapters and resolving varied source packaging; it is
not needed on every use of an already supported format.

## Small correction in this change

Replaced the blanket "format" footer with a reference to compatibility details.
The known transient-testbench rejection now explicitly identifies the AC-only
SKY130 preparation path, while noting possible further device/waveform gaps.
This does not add ADC, bipolar, PULSE/PWL or new import support.

Validation: all 38 existing tests and the production TypeScript/Vite build pass.
Deployed Worker `fc589dfd-9324-4eb6-b0be-48601700a6af`. A live Chromium Library
search for `adc` verified 50 total matches, 12 specific transient-testbench
messages on the first page, removal of the generic format footer, no newly enabled
imports and no JavaScript exceptions. The verification guest was deleted.
