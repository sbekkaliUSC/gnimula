# Deployment and operations

The public service is https://gnimula.stream. Cloudflare Worker `gnimula` owns the
apex and www custom domains; www redirects to the apex. The Workers preview URL
also works. Keep different origins' guest cookies separate.

## Deploy

Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the calling process. Never
write them to source or use a global key in browser code.

```sh
npm ci
node scripts/cloudflare.mjs
npm run build
npx wrangler deploy
```

Provisioning is idempotent for the named D1 database and private R2 bucket. It
applies the initial create-if-absent schema. Future schema changes must use new
migration files and `wrangler d1 migrations apply gnimula-main --remote`.
Containers need Workers Paid, Docker, and Account/Containers Edit permission on
the deploy token. Domain, Worker, D1 and R2 permissions must cover these resources.
Workers AI uses the runtime binding; no provider token is shipped to visitors.

The simulator runs one container identity per guest, sleeps after one idle minute,
and permits two simultaneous subprocesses per container. Each process has a
12-second wall deadline and separate scratch directory. There is no global daily
simulation allowance or one-container bottleneck. The deployment ceiling is 6,000
basic instances, matching the published default concurrent CPU/memory envelope;
actual account/platform capacity can differ. This is a ceiling, not preallocation
or a load-test result. Increasing traffic starts workers on demand and incurs
usage costs. No automatic instance resizing or account quota increase is implied.

New guest creation and autocomplete have burst controls. They do not impose a
site-wide daily visitor or inference allowance. Projects currently have size
bounds (120 devices, 400 wires, 500 shapes) and a 15-project guest limit.

## Recovery and retention

- D1 is the source of truth for projects, revisions, events, proposals, memories,
  and simulation records. Private R2 stores immutable revision snapshots and
  simulation inputs/results; it is not publicly listable.
- Cloudflare D1 Time Travel supplies managed database recovery. Configure external
  backups before treating this preview as long-term production design storage.
- Project/activity export can restore the design into a new guest project. It
  does not reassign another guest's cookies or impersonate their action history.
  Activity export currently caps at 20,000 records and explicitly reports when
  the cap may have truncated the export.
- Guests expire after 30 days. The daily cleanup removes expired active records
  and R2 objects. Authenticated `DELETE /api/session` removes the current
  guest's active records; there is no whole-session deletion control in the UI.
  Browser QA uses this endpoint only for its own disposable guest sessions.
- Application source is committed separately. Runtime databases, R2 contents,
  guest credentials, and browser QA state never belong in Git.

## Check behavior, not just health

`/api/health` confirms routing and configured service names, not model/simulator
availability. Verify an actual ngspice run and an actual goal-driven model proposal, plus Ask-mode abstention. Provider failures must leave the design unchanged.

Browser QA should cover edit/save/reload, apply/undo, memory enabled/disabled,
separate guest ownership, stale writes, event retry deduplication, export/restore,
mobile panel access, and simultaneous visitors. Record results in the audit.

## Known boundaries

No PDK signoff, native GDS import, extracted layout-to-schematic checking, arbitrary SPICE import,
collaborative multi-user project editing, cross-device guest login, or live weight
training. Browser tabs with the same guest cookie may view a project; optimistic
revision checks reject conflicting saves instead of silently merging them.

Public provider APIs are anonymous and may rate-limit this service. No GitHub or Hugging Face user accounts/tokens are requested. Remote source files are read as bounded text, never executed. The visitor Library serves a small prepared set. It does not claim the upstream corpus is fully converted or hosted. The simulator image builds its pinned SKY130 model subset automatically; keep the checksum lock and upstream license with deployments. For local SKY130 checks, run `python3 backend/simulator/install_models.py runtime/models` and set `GNIMULA_MODELS_DIR` to that absolute directory.
