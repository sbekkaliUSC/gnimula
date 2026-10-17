# Browser monkey results — October 17, 2026

The hosted candidates during this iteration were exercised using fresh disposable guest sessions
with the real deployed frontend and API. Four principal runs covered **720 random
action slots**, **680 completed interactions**, and **20 save/reload checkpoints**.
All guests were removed after testing. No existing visitor session was accessed.

| Seed | Slots | Completed interactions | State/reload checkpoints | Runtime result |
| --- | ---: | ---: | ---: | --- |
| [101](seed-101.json) | 180 | 169 | 5/5 | Passed; no JavaScript or HTTP errors |
| [202](seed-202.json) | 180 | 166 | 5/5 | Failed strict server check: provider search returned 502 |
| [303](seed-303.json) | 180 | 167 | 5/5 | Passed; no JavaScript or HTTP errors |
| [404](seed-404.json) | 180 | 178 | 5/5 | Passed runtime checks; one catalog configuration request returned 400 |

The total completed-interaction count is **680** (169 + 166 + 167 + 178); 40
attempts were unavailable/obstructed controls and were logged separately. The
seed-404 run specifically included 18 device/shape placement operations and reached
26 saved revisions, exercising actual document mutation rather than only navigation.
Every saved document retained its hash and visible revision after reload. Wire
references, object-ID uniqueness, finite geometry, visible schematic-symbol count
and stored event-ID uniqueness passed. No uncaught JavaScript exception, lost
document, or unexpected external navigation was observed.

## Findings sent to implementation

1. Selecting the global public-corpus search produced a real `/api/library/discover`
   502 in seed 202: “The public provider is temporarily unavailable. Retry this source
   shortly.” The Library displayed retry and SKY130 collection recovery actions.
   The editor remained usable and all persistence checks passed. This is retained
   as a service failure, not hidden by the overall editor stability result.
2. Selecting CircuitFormer records requested the `default` configuration / `train`
   split for `touhid314/cktformer-dataset`, which returned 400: “That configuration/split
   does not exist in this dataset.” The URL is retained in seed-404 evidence. This
   preset needs discovery of the provider's actual configuration/splits.

## Test scope and harness adjustments

The randomized choices exercised menus, panels, keyboard shortcuts, component
placement, layout rectangles, canvas clicks and drags, field inputs, undo/redo,
library navigation and viewport resizing between 390 and 1600 pixels. No paid AI
or simulator request was needed during these chaos runs; separate workflow checks
must cover those services and electrical correctness.

Early runs attempted some controls behind the narrow-screen Chat panel. A screenshot
confirmed the panel had a visible close control; this was a harness hit-testing
issue, not an application crash. The final harness samples hit-testable controls,
scopes inputs to the active dialog, closes the mobile inspector before explicit
canvas operations, and identifies placement tools using their actual tooltips.
It records full obstruction diagnostics and screenshots for the first five failed
interactions. One intermediate seed-404 attempt stopped at step 30 because the
harness reused its `kind` argument name in trace metadata. That harness bug was
fixed before the complete seed-404 rerun above; it was not an application failure.

Full action traces and screenshots remain under `runtime/monkey-101`,
`runtime/monkey-202`, `runtime/monkey-303`, and `runtime/monkey-404-retry`.
`runtime/monkey-obstruction` contains the additional 40-step mobile diagnostic.
The committed JSON files retain sanitized summaries and actual error responses.
These sampled runs do not demonstrate foundry tapeout capability, exhaustive
concurrency correctness, or complete action replay.

## Final candidate recheck

Candidate **`5cf8c136`** was tested after the catalog fixes. The earlier failures
above remain recorded as the pre-fix evidence.

- [Seed 505](seed-505.json): **60/60 completed random interactions**, all three
  save/reload checkpoints passed, eight persisted edit revisions, no JavaScript
  exception, HTTP error, or notification. The disposable guest was removed.
- [Direct UI catalog recheck](catalog-recheck.json): selecting **CircuitFormer
  records** now returns HTTP 200 and discovers the actual `default` / `validation`
  partition, displaying **49,352 records**. The earlier invalid `train` assumption
  no longer occurs.
- Searching **current mirror** in the SKY130 collection returns HTTP 200 with
  **1,197 matching metadata records** and 12 rendered cards. The UI explains that
  this is an indexed metadata search, that parameter variants may share topologies,
  and that records are fetched from the provider before use.

The targeted checks are reproducible with `scripts/monkey-catalog-recheck.py`.
Screenshots are in `runtime/monkey-circuitformer-recheck.png` and
`runtime/monkey-current-mirror-recheck.png`. Across the principal and final chaos
runs, there were **780 action slots, 740 completed interactions, and 23 successful
save/reload checkpoints**. The 502 observed in the earlier global-provider search
is still disclosed; these final targeted checks do not establish that external
providers cannot time out again.
