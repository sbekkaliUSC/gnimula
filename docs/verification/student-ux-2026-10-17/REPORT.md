# Student browser usability trial — 2026-10-17

This was an adaptive AI-agent browser trial of the public `https://gnimula.stream` UI, not a human usability study. The tester read repository instructions and the browser harness, but did not inspect application implementation, browser storage, network responses, or private APIs to choose user actions. Navigation decisions used rendered screenshots and accessibility snapshots. The only direct API operation is deletion of this tester's own disposable guest at cleanup.

Initial deployment supplied by the coordinator: `5cf8c136`. Browser: Chromium 140.0.7339.16, independent in-memory guest context, desktop 1440×1000 and mobile-size viewport 390×844. Mobile testing used a narrow desktop browser viewport, not a physical touch device. Test scope: discover an online current-mirror example, understand its source/models/setup, run it; find a simple RC example, edit resistance, run and undo; check narrow-screen Library navigation. Budget used: one AI Ask request and three simulation invocations.

## Outcomes

| Task | Observed outcome |
| --- | --- |
| Find an online current mirror | Partial. Search found 1,197 publisher metadata matches and the readiness filter exposed runnable records. The first ready record, `analogtobi_0123`, was labeled current-mirror bias but contains one NMOS and an AC-coupled gain stage. The task did not establish actual current mirroring. |
| Open and understand source/model/setup | Open succeeded. Expanded attachment explains generated positions, selected output, supplied testbench as source of truth, isolated AC excitation, and excluded publisher scripts. SKY130 typical-model installation is visible. The raw source was difficult to read as escaped JSON in the narrow chat pane. |
| Run online record | Passed mechanically: AC sweep, 1,001 samples, operating output 163 mV, solver time 677 ms, result revision r0. This measures that prepared circuit, not current-mirror behavior. |
| RC resistance edit/run/undo | Passed: R1 1,000 Ω → 2,000 Ω, successful r1 AC result, then Undo restores 1,000 Ω at r2. Old r1 result explicitly says the circuit changed and requests a new run. |
| 390 px Library navigation | Passed for the tested navigation: Library rail icon, all three section tabs, search, filters, vertical scroll and card actions remain reachable. |

## Actual action chronology

Times below are UTC from the interaction log. The numbered `.txt` files capture the rendered accessibility tree and `.png` files capture the live browser. Some screenshots follow immediately after the corresponding snapshot, so loading states may advance slightly between them.

1. **08:11:40–08:11:54** — Opened the public homepage. The initial loading message resolved to the common-source-amplifier workbench. [Workbench](02-workbench.png).
2. **08:12:03–08:12:14** — Opened Settings → Data controls and turned off the initially checked “Use my data for model training” checkbox. [Disabled preference](05-training-disabled.png). Persistence is rechecked at cleanup.
3. **08:12:15–08:12:23** — Opened the circuit library, used the default Hugging Face / SKY130 collection, typed `current mirror`, and pressed Search. There were 1,197 matches in the selected train partition. The first six records were Source only, with “Signal source is ambiguous”; ready records followed below. [Search](07-current-mirror-search.png), [complete visible-text snapshot](07-current-mirror-search.txt).
4. **08:12:34–08:12:35** — Checked “Ready on this page” and opened the first remaining record, `analogtobi_0123`. The original project remained in the project selector. [Open schematic](09-mirror-open.png).
5. **08:12:48–08:12:54** — Expanded `analogtobi_0123.json`, then Source text, then opened the generated netlist tab. The original source URL and preparation caveats were available. The one-NMOS circuit did not match a conventional current mirror. [Source notes](10-source-attachment.png), [source formatting](11-source-text.png), [generated netlist](12-generated-netlist.png).
6. **08:13:08–08:13:16** — Chose “Ask · explain only” and asked whether this was actually a current mirror and what source, model, input/output and analysis to use. The app answered that it was not a current mirror; it identified analogtobi, SKY130 1.8 V typical, VSIG, R0.n and an AC gain testbench. No edit was requested or applied. [Explanation](14-ai-explanation.png).
7. **08:13:32–08:13:47** — Pressed Run first simulation. The UI showed a busy state, then a measured AC response with 1,001 samples, 163 mV operating output and 677 ms solver time. [Result](16-imported-result.png).
8. **08:14:01–08:14:07** — Opened Library → Starter circuits, searched `RC low-pass`, and opened the sole matching RC low-pass filter. The description stated a 15.9 kHz corner; the schematic showed R1 1 kΩ and C1 10 nF. [Starter search](18-rc-found.txt), [RC schematic](19-rc-open.png).
9. **08:14:18–08:14:21** — Pressed Run simulation. The baseline AC result showed 201 samples, 22 ms solver time and revision r0. [Baseline result](20-rc-baseline.png).
10. **08:14:31–08:14:40** — Selected R1 in the Explorer. Properties opened automatically and exposed Resistance (Ω) plus simulation controls. Replaced `1000` with `2000`, then Tab. Schematic label became 2 kΩ and revision advanced to r1. [Properties](21-r1-properties.png), [changed value](22-r1-changed.png).
11. **08:14:41–08:14:44** — Pressed Run analysis. A new r1 AC result showed 201 samples and 38 ms solver time. [Changed response](23-rc-changed-result.png).
12. **08:14:53–08:14:54** — Pressed the toolbar Undo button. The result stayed at r1 with an explicit stale-result message for current revision r2. Selecting R1 confirmed 1,000 Ω and the schematic label 1 kΩ. [Stale-result state](24-undo-result-state.png), [restored value](25-undo-restored-resistance.png). No fourth simulation was run.
13. **08:15:05–08:15:33** — Resized to 390×844. Closed the overlaid Properties inspector, opened Library from the rail, changed to Starter circuits, searched `RC`, and scrolled through the cards. The Library controls and actions fit the narrow viewport. [Online Library](27-mobile-library.png), [starter Library](29-mobile-starters.png), [scrolled actions](31-mobile-rc-actions.png).

## Confusion and concrete fixes suggested by the initial trial

1. **High: publisher category can mislead the discovery task.** The first ready `current mirror` result is a one-NMOS gain stage, and the app's own explanation corrects the category only after opening and asking. Preserve the publisher metadata, visibly label it as publisher-provided, and add a deterministic warning when the prepared topology cannot be a current mirror. Treat model explanation as help, not category validation. The source record itself was not corrected by this trial.
2. **Medium: useful search results start too far below the heading.** At desktop size, source controls and several explanatory blocks place the first cards around the bottom of the viewport; six unopenable matches precede ready ones. At 390 px, the initial online view does not show a result card. Compact the default controls, put technical details behind a disclosure, and prioritize or clearly expose runnable matches. Keep the distinction between page-local readiness and collection-wide search explicit.
3. **Medium: source is accessible but not student-readable.** The import notes are helpful; expanding Source text reveals escaped JSON and long SPICE strings in a narrow panel. Provide a formatted testbench preview and concise source/model/analysis summary while retaining raw source and provenance.
4. **Medium: simulation setup is easier to discover through Properties than Simulation.** Before the first run, the Simulation view shows a generic empty state and run action. A student must discover Properties for analysis/input/output controls. Expose a direct setup affordance in the Simulation view.
5. **Low: short `RC` search is broad.** The mobile starter query `RC` returned seven cards, including Common-source amplifier and SKY130 op-amp variants. Exact title/topology matches should rank first; explain broader matches or use token matching where appropriate. The more specific desktop query `RC low-pass` worked well.
6. **Low: chart precision for learning.** The RC chart visibly changed and the edit/run path worked, but the result summary did not show a measured corner frequency. The stated task goal asks the student to compare with 1/(2πRC). A cursor readout or measured corner would make that comparison easier. This trial does not claim a numerically verified corner from the plotted image.

What worked well: accessible control labels; reversible direct property edit; clearly labeled result revisions; explicit stale-result notice; circuit preparation caveats; visible model status; preserved projects; and compact, reachable mobile Library controls.

## Evidence handling

Only public rendered UI, the tester's synthetic prompt, and the tester's disposable circuit values are recorded. No cookies, credentials, account exports or browser storage are saved. The attachment's public source URL is recorded in the UI evidence; this report makes no independent source-license or upstream-data-quality claim. Full raw public-source JSON is omitted from sanitized text snapshots; the screenshots show its UI presentation. `interaction.jsonl` is the action chronology, not a network trace. `scripts/student-ux-qa.py` is a UI interaction harness with a separate context and evidence directory.

## Follow-up verification on deployment 543c6f30

At 08:17:44–08:18:12 UTC, reloaded the same guest and repeated the online search at 390×844. No further AI requests or simulations were used.

- The first ready card now shows a visible warning that its publisher category is current_mirror_bias, while the prepared testbench contains one MOS device, and states that the label is preserved without topology verification or repair. The warning is readable before all three open actions. [Mobile warning](34-final-warning-mobile-card.png), [rendered warning text](33-final-warning.txt). This addresses the misleading certainty, but does not fix or validate the upstream category.
- Category names are readable headings and the publisher record ID remains visible. Source details and partition controls are collapsed by default. The desktop Library opens without the Chat pane, with more width available for the cards; the captured follow-up screen shows the warning and actions after scrolling. [Desktop follow-up](35-final-library-desktop.png).
- The 390 px online search, readiness checkbox, warning and card actions remain usable. The library is substantially less crowded. [Mobile follow-up](32-final-mobile-library.png).
- Settings → Data controls still shows training unchecked after the reload. [Persisted preference](36-training-remains-disabled.png), [accessible checkbox state](36-training-remains-disabled.txt).

The coordinator reported a later source-text formatting change, but this tester did not verify that later change; the source-formatting finding above belongs to the initial deployment.

## Guest cleanup

At 08:18:24 UTC the original running harness sent DELETE /api/session without the required Origin header and received HTTP 403. Its old log recorded successful command execution, not successful deletion. The guest remained open. The harness file was corrected for future runs to send Origin and reject non-200 cleanup responses.

At the coordinator's instruction, the tester used the visible Project name field to rename only the disposable RC project to `student-ux-cleanup-20261017-b265` at 08:19:44 UTC, and observed Saved to cloud. This uniquely identifies the tester's guest for coordinator-managed cleanup; the other two expected projects are analogtobi_0123 and Common-source amplifier. No runtime injection, cookies or browser-storage inspection were used. The coordinator confirmed recovery: matched only this guest by the unique QA project name, creation minute 08:11, training-off state, expected three project names and RC revision 3; reissued only that guest credential; the normal DELETE API returned HTTP 200; guest absence and associated storage cleanup were verified. This tester then closed the browser without further navigation or reload. No session identifiers or credentials are included in this evidence.
