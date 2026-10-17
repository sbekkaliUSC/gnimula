# Gnimula adaptive student usability test — 2026-10-17

## Outcome

A fresh guest found a public SKY130 op amp in Starter circuits, opened it without downloading files, simulated it, asked for an explanation, changed its load capacitor, simulated again, and verified that the earlier project remained intact. Live catalog browsing and **Open & run** also worked. The final candidate fixed the initially failing text search and incorrect component inspector. The assistant's explanation improved after fixes, but still made a factor-of-ten engineering-unit conversion error.

The interface did **not** demonstrate physical implementation or tapeout. Its empty layout is explicitly a concept editor in arbitrary grid units. The supported checks exclude PDK DRC/LVS, and the visible layout export is SVG. The assistant correctly said schematic-to-layout generation, DRC, LVS, extraction, and manufacturing signoff require external tools or foundry review.

## Method and scope

- Agent operated Chromium 140 through an interactive Python Playwright session at `https://gnimula.stream`, at 1440 × 1000 pixels. The reusable harness is [`scripts/usability-qa.py`](../../../scripts/usability-qa.py).
- This was adaptive interaction, not a predetermined assertion suite: screenshots and rendered accessibility trees determined each next action. No app implementation, private app state, or API responses were read to navigate. `AGENTS.md` was read.
- Candidates were reported by the implementing agent as Workers `cd584357`, `d0ef8386`, and final `5cf8c136`. These are deployment notices, not browser-derived version assertions.
- Fresh disposable guest; training disabled before app tasks. A later reload retained the disabled setting. Downloads were disabled in the browser and no download was initiated. No real user data was used.
- Total explicit AI requests: **3**. Total simulations: **3**. Autocomplete was disabled before the sole manual circuit edit to bound AI activity. No additional simulation was needed for the final assistant retest because the r1 measurement persisted.
- Browser cookies/session identifiers remained in memory and were never written into this evidence directory. Cleanup and final retest are recorded below.
- [`interaction.jsonl`](interaction.jsonl) contains timestamped selected UI actions. Numbered `.png` and `.txt` files preserve screenshots and rendered accessibility snapshots. Early filenames describe the intended checkpoint; snapshots 21/22 occurred during asynchronous project switching, so use settled checkpoints 24/25 for preservation evidence.

## Adaptive chronology

| UTC | Observed UI and next decision | Evidence |
| --- | --- | --- |
| 08:01:33–58 | Homepage opened a six-device common-source amplifier. Settings → Data controls revealed training enabled by default. Turned it off. | [Home](02-home.png), [training off](04-training-disabled.png) |
| 08:01:59–08:02:17 | Library defaulted to Online circuits / SKY130. It showed duplicate provider-unavailable notices and “No matching results.” Searching `amplifier` also failed. Followed the visible Starter circuits fallback. | [Initial outage](05-library.png), [search failure](06-amplifier-search.png) |
| 08:02:29–40 | Starter search `op amp` returned three public Hugging Face variants. Expanded “About this design,” saw source identity `analogtobi_1824_s015`, and opened variant 1. The workbench contained 23 components, an attached source reference, installed SKY130 models, and a second project entry. | [Source and choices](09-public-opamp-about.png), [opened circuit](10-public-opamp-open.png) |
| 08:02:45–08:03:02 | Clicked Run simulation. The measured AC result showed 810 mV output, 1,001 samples, 1,175 ms solver time, and revision r0. | [Baseline](12-baseline-result.png) |
| 08:03:20–41 | Selected Ask mode and asked for exact setup, result explanation, and a modest load change. While waiting, disabled autocomplete and opened the visible generated netlist. The response correctly named supply, bias, drive, output, and corner, but misstated the sample count and frequency response; it suggested a roughly 30× load change. | [Exact response and visible netlist](14-visible-netlist.txt) |
| 08:03:56–08:04:23 | Clicked CL in Explorer from the netlist view, then Properties. Unexpectedly received layout fields and an `undefined` net label. Recovered by switching to schematic, reselecting CL, and reading its capacitance field. | [Wrong inspector](16-load-property-fields.png), [correct inspector](18-correct-load-properties.png) |
| 08:04:30–34 | Changed CL from `3.382419e-14 F` to `4e-14 F` (about +18.3%). The previous result was explicitly stale. Reran simulation: r1, 810 mV, 1,001 samples, 3,404 ms. | [Stale result](19-edited-before-rerun.png), [new result](20-edited-result.png) |
| 08:04:57–08:05:00 | Switched to the original project and waited for loading: r0, six components, original 3.3 V supply, 10 kΩ RD, 10/1 µm M1, 1.25 V input, 10 pF CL. Returned to the edited op amp and verified CL `4e-14 F`, r1. | [Original preserved](24-prior-project-verified.png), [edit preserved](25-edited-project-verified.png) |
| 08:05:13–17 | Reloaded after the implementing agent's deployment notice. Online browsing now showed real records: 89,708 in the selected split, 130,409 across its representation, and explicit warnings that variants are not unique topologies. | [Recovered browse](26-online-recovered.png) |
| 08:05:30–08:06:28 | Searched `amplifier`. The search timed out/faulted after a wait; visible Retry source also failed. The new error clearly said the source could not load and offered a starter fallback. | [Improved error](28-online-amplifier-results.png), [retry result](30-search-retry-settled.txt) |
| 08:06:35–43 | Cleared the query and recovered browse. Open & run on first listed operational amplifier `ocb_sky130_101_00176` created a third project and completed simulation: r0, 184.8 mV, 1,001 samples, 2,045 ms. Its gain curve remained below 0 dB; importer readiness was not useful amplifier performance. | [Live online import and simulation](31-live-online-open-run.png) |
| 08:06:55–08:07:06 | Explored Layout, File, Help → Quick start. Layout was empty; controls only offered layered drawing. The footer said arbitrary grid units and geometry guides, not PDK DRC/LVS. File offered SPICE and layout SVG, not GDSII. Quick start reinforced the signoff limit. | [Layout/export boundary](33-file-menu.png), [help](35-quick-start.png) |
| 08:07:18–41 | Asked the assistant about schematic-to-layout, units/devices, DRC, LVS, extraction, GDSII, and signoff. It correctly placed physical generation/verification/signoff outside Gnimula; it omitted the explicit GDSII/real-device-units answers and gave no concrete handoff. | [Capability answer](37-tapeout-answer.png), [full text](37-tapeout-answer.txt) |

## Findings and concrete fixes

| Priority | Finding | Concrete UX fix | Status in this test |
| --- | --- | --- | --- |
| Fixed during test | A normal `amplifier` search initially failed although live browsing worked. Retry repeated the failure. | Repair the search path and state its matching scope accurately. | Final candidate returned 51,133 matching metadata records by the 2.5-second checkpoint; metadata-only scope and index date are disclosed. See 39. |
| Fixed during test | Selecting a schematic component while viewing the netlist yielded layout controls, blank heading, and `undefined` net label. | Resolve the inspector from selected object type and consistently reveal its values. | Identical Netlist → Explorer CL interaction now switches to schematic, opens correct properties, and focuses CL. See 40. |
| High, partly fixed | First assistant answer misstated sample count and flat gain, suggested ~30× capacitance, and used an internal ID. Final answer fixed these but converted `4e-14 F` to `0.4 pF`, which is ten times too large; correct is `0.04 pF`. | Provide total samples, points/decade, gain endpoints, visible reference names, and **deterministically formatted engineering-unit values**. Do not rely on the model to perform unit conversion. | Corrected counts/endpoints/reference and a 10% suggestion verified. Unit-conversion defect remains in the final observed answer. See 45. |
| Medium, partly fixed | Imported schematic opens at 48%, with tiny labels and many overlapping routes. Switching projects retained the zoom. | Support focus-on-selected, per-project fit, net labels, and stage grouping. | Focus-on-selected now works and CL is readable at 250%. Whole-circuit readability remains a limitation. See 40. |
| Medium, improved | A blank layout plus “Problems 0” gave weak guidance; limitation text was small and remote. | Put capability boundaries directly above the canvas and offer an explicit external implementation handoff. | Final candidate adds prominent text explaining independent geometry and unavailable PDK DRC/LVS/fabrication export. No concrete external handoff was demonstrated. See 44. |
| Medium | Library presents dataset identities and machine-learning partition names ahead of circuit behavior; users must interpret near-identical variants without topology sketches or suitability information. | Default to a short human-readable circuit name and topology summary; move split/configuration details into source metadata while preserving honest counts and provenance. | Observed. |
| Medium | A load change produces a fresh curve but no visible prior-curve overlay or exact gain/bandwidth comparison, making the learning effect hard to quantify from this view. | Offer a compare-to-previous-run action and numeric measured deltas tied to revisions. | No comparison control observed in tested views. |
| Low | Capacitance is editable only as SI scientific notation, although the schematic displays pF. | Add engineering-unit entry or an adjacent conversion preview (e.g. `0.04 pF`). | Observed. |
| Fixed during test | Initial source outage looked like “No matching results” and repeated the same error banner. | Dedicated error state with Retry and starter fallback. | New error state verified in screenshot 28. |

## Supported result and physical boundary

The evidence supports direct public-circuit opening, editable schematic values, prepared AC testbenches using installed SKY130 typical transistor models, measured simulations, revision staleness, and preservation of separate projects. Catalog “Ready to open” means import preparation passed; the online example's measured negative gain demonstrates why readiness must not be presented as electrical qualification.

No PDK physical geometry, physical units, schematic-generated placement/routing, foundry DRC/LVS, parasitic extraction, GDSII delivery, or manufacturing signoff was demonstrated. A student can explore a circuit here, then needs an external physical-design flow and foundry requirements. The test did not fabricate a layout or claim a tapeout.

## Final retest and cleanup

Final retest ran 08:11:42–08:13:02 UTC after reloading the final candidate:

- [`39-final-search.png`](39-final-search.png): `amplifier` search returned real prepared records and 51,133 matching circuit metadata records, rather than an outage. Scope is explicitly identifiers, topology, upstream source and PDK metadata, not full netlist text.
- [`40-final-component-inspector.png`](40-final-component-inspector.png): the exact earlier selection path now works; CL displays `4e-14 F` and `0.04 pF` at readable zoom. Saved r1 edits persisted across reloads.
- [`41-final-reference-details.png`](41-final-reference-details.png): attached-source details now explain generated coordinates, preserved four-terminal devices, prepared single-input AC setup, excluded publisher scripts, and disabled supply AC excitation. This makes import changes inspectable.
- [`44-final-layout-boundary.png`](44-final-layout-boundary.png): the capability limit is visible above the canvas instead of only in a small footer/help text.
- [`45-final-assistant-answer.png`](45-final-assistant-answer.png), [exact text](45-final-assistant-answer.txt): third and last AI request correctly distinguished 100 points/decade and 1,001 total samples; gave 31.47 dB at 1 Hz and −20.89 dB at 10 GHz; used CL; and suggested `4.4e-14 F`, a 10% increase. It incorrectly called current `4e-14 F` “0.4 pF.” This remains an observed accuracy limitation. No fourth AI request was sent and no proposed change was applied.

At 08:13:23 UTC the harness attempted the explicitly authorized `DELETE /api/session`, which returned **HTTP 403**. It then closed the browser because close had been queued before checking deletion success. This was a test-harness cleanup failure. Its action log's `ok: true` for `cleanup` means only that the old command branch ran; the actual HTTP result was 403.

Cleanup was subsequently recovered by the implementing agent. It uniquely matched the synthetic component, creation minute, disabled-training setting, and exactly the three expected project names; rotated only that disposable guest's credential; called the normal DELETE API with **HTTP 200**; and verified that the guest was gone, including associated object/database records. No identifiers or credentials are included here. The browser is closed and this test guest has been removed.

The harness now sends the Origin header and refuses a close after failed cleanup. The revised harness passed Python compilation; its new cleanup guard was not separately exercised against a new guest.
