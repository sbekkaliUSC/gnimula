# Randomized browser verification

`scripts/monkey-qa.py` exercises the workbench through real Playwright mouse,
keyboard, selection and input events. It is an independent browser implementation,
not a copy or translation of another application's test harness.

Run from the repository root after building the candidate:

```sh
python3 scripts/monkey-qa.py --seed 101 --steps 180
```

`GNIMULA_QA_URL` selects the service (defaults to `https://gnimula.stream`).
`GNIMULA_QA_LOCAL_ASSETS=1` serves the built `dist/` frontend through browser request
interception while retaining the selected service's API. This is useful before
deployment; it does not validate a backend that has not yet been deployed.
`--output` selects an artifact directory, otherwise `runtime/monkey-SEED` is used.

Each run creates an isolated anonymous browser session, excludes it from future
training, and deletes only that disposable guest's active data on completion.
No existing cookies or visitor sessions are loaded. At most two AI calls and two
simulation requests reach the service by default. Random automatic assistance is
disabled; a request interceptor enforces the budget if chaotic interactions enable
it again. Test-budget responses are identified separately from server failures.

The random distribution includes buttons, menus, editor shortcuts, component
placement, canvas dragging, layout geometry, checkboxes, numerical/text fields,
selectors and desktop/mobile resizing. Invalid numeric values deliberately exercise
validation. Locator races are logged, rather than mistaken for application crashes.
These do not count as completed actions.

Every 45 actions, the test saves and reloads, compares the persisted document hash,
checks visible revision and symbol count, validates wire references, object IDs
and finite geometry, and checks stored event-ID uniqueness. Uncaught JavaScript
errors, lost documents, unexpected navigation, or server errors fail the run.
Snapshots and `replay.jsonl` retain the chosen labels, coordinates and actions for
debugging. The seed reproduces action choices; network timing and changing remote
search results may change the specific controls available. This is sampled chaos
coverage, not proof of correct electrical behavior or foundry readiness.

Results and remaining issues are recorded in [RESULTS.md](RESULTS.md). A passing
run means the structural, persistence, runtime and server-error checks passed;
HTTP 4xx responses remain in the evidence for review because invalid operations
are part of the random inputs. Passing does not mean every catalog request worked.
