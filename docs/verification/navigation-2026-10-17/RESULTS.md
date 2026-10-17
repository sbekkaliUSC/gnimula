# Canvas navigation — 2026-10-17

Implemented and deployed at https://gnimula.stream.
Worker version: `f8e383e4-90cd-426b-9151-baa496a995be`.
Implementation commit: `2739483`.

## Behavior

Mouse wheel and trackpad scroll zoom around the pointer. Ctrl-wheel / browser
trackpad pinch zoom the canvas without changing page zoom. Space + left-drag,
middle-drag, Shift-scroll, and arrows pan. F fits; Shift+F or Ctrl+Shift+F focuses
selected devices/shapes. +/- and Shift+Z zoom; Z then drag or right-drag fits a
region. Both dimensions of a zoom-box drag must reach 8 CSS pixels. Ctrl+Z keeps
Undo. Toolbar controls use the same camera and 10–800% zoom limits.

These independently implemented browser controls draw on the public
[Xschem command guide](https://xschem.sourceforge.io/stefan/xschem_man/commands.html).
They do not provide complete Xschem bindings: Space is temporary pan while held,
Shift+F is a focus alias, Shift-scroll is pan, and Ctrl+Z remains browser-editor
Undo. There is no native Xschem runtime dependency.

## Verification

- `npm test`: **38/38 passed**; includes anchor invariance at zoom bounds,
  reversible zoom, sub-grid pan and centered fit bounds.
- `npm run check` and `npm run build`: passed.
- `GNIMULA_QA_LOCAL_ASSETS=1 python3 scripts/navigation-qa.py`: passed using the
  candidate frontend against the hosted API with a disposable guest.
- `python3 scripts/navigation-qa.py`: **passed on the deployed site**.
  [Recorded checks](browser-checks.json).

Chromium exercised wheel/Control-wheel zoom at an off-center pointer, toolbar
zoom, Space-drag over a device and a pin in Wire mode, middle-drag over a wire,
Shift-scroll, arrows, +/- reversal, fit/focus, box zoom, 3 px right-drag jitter,
Escape and window blur, chat typing, dialog shortcuts, and concept-layout zoom.
A 760 px-wide browser additionally verified pointer anchoring with SVG letterboxing.

The untouched circuit and its revision remained identical after navigation, and
23 coalesced viewport events reached D1 in the live run. A subsequent normal
component drag still edited the design; after further navigation, Ctrl+Z restored
that edit. No model or simulation calls occurred, and there were no JavaScript
exceptions. Each QA guest and its records were deleted at the end.

Trackpad behavior was checked through browser wheel/Control-wheel events, not on
physical Windows/macOS trackpad hardware. Touchscreen multi-touch gestures were
not added or tested. The test establishes the implemented navigation behavior,
not a broader EDA capability or complete editor-parity claim.
