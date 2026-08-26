# Pulse First Milestone — Resume Ledger

Last updated: 2026-08-27, Asia/Kolkata

This is the authoritative handoff for the paused implementation run. Start
here, then follow the linked contracts and status board.

**2026-08-27 update:** the state described through most of this file (only a
handful of worktrees provisioned, no product code merged) is stale. As of this
update, 27 of ~35 backlog tasks are merged into `track/pulse-first-milestone`,
and all of waves W1 through W5 — the entire actively-planned first-milestone
scope — are code-complete; see the "First-milestone waves" table in
`07-execution-status.md`, which already reflected this correctly and was left
unchanged. The original runtime-verification bench, `pulse-w1w5-verify`, no
longer exists in the bench registry (confirmed via `mh list`). A fresh
disposable bench, `pulse-w1w5-reverify`, was provisioned from
`track/pulse-first-milestone` (same branch/HEAD) and re-verification was rerun
in full — see the new dated entry at the end of section 7 and section 9 below
for exact results. Separately, and not covered by this update: the 26 stale
`agent/*` task worktrees/branches are being reconciled/cleaned up, and the
legacy compatibility-only analytics endpoints from S2-T02 are being reviewed
for removal, both by other agents in parallel — neither is done as of this
writing.

## 1. Where to start

Use the host integration worktree:

```bash
cd /Users/safwan/Code/Docker/frappe_docker/development/tracks/PulseFirstMilestone/integration
git status --short
sed -n '1,260p' docs/execution/START-HERE.md
sed -n '1,260p' docs/execution/07-execution-status.md
```

Do not implement in the original checkout or inside a bench app checkout.

- Original clean checkout: `/Users/safwan/Code/Experiments/Pulse/pulse`
- Track root: `/Users/safwan/Code/Docker/frappe_docker/development/tracks/PulseFirstMilestone`
- Integration worktree: `<track root>/integration`
- Independent task worktrees: `<track root>/worktrees/`
- Integration branch: `track/pulse-first-milestone`
- Planning baseline commit: `bd6b00d docs: add Pulse execution and domain plan`
- Host-worktree/handoff commit: `9f639fe docs: record host-worktree execution handoff`
- Bootstrap branch retaining that commit: `bootstrap/pulse-first-milestone`
- No implementation branch has been pushed to a remote yet.

## 2. Canonical product and execution sources

Read these in order:

1. [Agent guide](../../AGENTS.md)
2. [Domain context](../../CONTEXT.md)
3. [Product plan](../PRODUCT_PLAN.md)
4. [Frozen first-milestone contracts](06-domain-contracts.md)
5. [Current prototype inventory](model-inventory.md)
6. [Dependency map](01-dependency-map.md)
7. [Scoped task backlog](03-task-backlog.md)
8. [Execution status board](07-execution-status.md)
9. [Acceptance and handoff](05-acceptance-and-handoff.md)

The frozen contracts override legacy prototype behavior and older notes.

## 3. Product decisions already captured

The planning/grill findings are already consolidated in `CONTEXT.md`,
`docs/PRODUCT_PLAN.md`, and `06-domain-contracts.md`. The critical decisions are:

- One Frappe site is one Pulse organization for the first milestone.
- `Pulse Employee.reports_to` is the initial single-manager hierarchy.
- Departments and branches are metadata; reporting hierarchy drives inherited
  responsibility. Multiple managers remain a future seam.
- The primary product is SOP compliance: generated run completed on time or
  failed. Checklist item progress does not create partial compliance credit.
- Operational status and compliance result are separate.
- Built-in operational lifecycle: `Open -> In Progress -> Completed`, with
  `Locked` after deadline finalization.
- Compliance result: `Pending`, `Passed`, or `Failed`.
- A run passes when `completed_at <= due_at`; it fails after due time without a
  valid completion. A normal late submission cannot turn Failed into Passed.
- Ungenerated work has no score. Generated Pending work is excluded. Passed is
  1, Failed is 0, and no eligible runs returns `null`, not zero.
- Personal and inherited scores stay separate. The default manager view is
  inherited health; users can switch to personal.
- Inherited scores are run-weighted descendant totals, not averages of manager
  averages. Initial run weights are equal; future configurable weights remain a
  documented seam.
- Gauge orientation is low/red on the left and high/green on the right. A
  `null` no-data state must be visually distinct from 0% failure.
- Run identity is `assignment + schedule_key`; persisted `run_key` is unique.
- Template frequency/start/window and assignment overrides resolve in the
  assignment -> template -> site-time-zone order. Opens/due timestamps are
  frozen in UTC on generated runs.
- Runs are generated only when actionable, not far in advance.
- Finalized run proof is immutable. Template, person, reporting path,
  department/branch, timezone, and schedule facts are snapshotted so later
  edits do not reinterpret history.
- The first permission layer builds on Frappe roles but goes through a shared,
  cycle-safe hierarchy/scope resolver. Future user/SOP-specific policy can be
  added behind that abstraction.
- Setup must become usable from the Pulse frontend: people/hierarchy,
  templates/schedules, and assignments. User invitation and a polished wizard
  are later work.
- Snooze, escalation, failure-triggered SOPs, notifications, integrations,
  geofencing/camera-only evidence, maker-checker, and generic evaluation/form
  templates are planned but not part of the first compliance vertical slice.
- Quality/evaluation is an independent generic template/evaluation module, not
  mixed into the compliance gauge. Required linked evaluations may later gate
  completion and support one-step linked completion.
- Historical submitted documents are retained and immutable. Retention/scrub
  policy is a later decision.

## 4. Repository artifacts completed

Commit `bd6b00d` contains:

- canonical `AGENTS.md` and Claude entry point `CLAUDE.md`;
- `CONTEXT.md` and `DOCKER_BENCH.md`;
- `docs/PRODUCT_PLAN.md`;
- the linked execution pack `docs/execution/00` through `07`;
- `docs/execution/model-inventory.md`, completing S0-T02;
- `ops/workspaces.json` for Pulse/Frappe version 16.

The model inventory maps all ten current core DocTypes, APIs, frontend
surfaces, legacy scoring/lifecycle behavior, missing setup commands, likely
migrations, and risks.

Commit `9f639fe` records three intentional planning edits:

```text
M docs/execution/00-operating-model.md
M docs/execution/01-dependency-map.md
M docs/execution/07-execution-status.md
```

They record the user-directed workflow change: development happens in
independent host worktrees without a live bench; a disposable bench is required
only for migrations, site-writing tests, scheduler/runtime checks, and manual
acceptance. They are committed on the integration branch and need no further
bootstrap action before worker-task review.

## 5. Git/worktree topology

**Stale as of 2026-08-27:** the table below describes the original bootstrap
snapshot (four worktrees, nothing merged). That is no longer the state of the
integration branch — 27/35 backlog tasks and all of W1-W5 are merged into
`track/pulse-first-milestone` (see `07-execution-status.md`'s "Worker
handoffs awaiting integration" table for the full merged-commit list). The 26
`agent/*` task worktrees/branches accumulated since this snapshot are being
reconciled/cleaned up by a separate agent as of this writing; their outcome is
not yet known and is not recorded here. Do not treat the row below as current.

All worktrees are based on `bd6b00d`:

| Branch | Host path | Assigned task | Current state |
| --- | --- | --- | --- |
| `track/pulse-first-milestone` | `<track root>/integration` | Integration | Handoff and execution-gate docs committed at `9f639fe`; no product code |
| `agent/s0-t03-fixture` | `<track root>/worktrees/s0-t03-fixture` | S0-T03 acceptance fixture spec | Clean; GPT worker stopped before editing |
| `agent/s1-t00-scaffold` | `<track root>/worktrees/s1-t00-scaffold` | S1-T00 package/test scaffold | Three untracked files created by Kimi; not reviewed or committed |
| `agent/s1-t01-lifecycle` | `<track root>/worktrees/s1-t01-lifecycle` | S1-T01 lifecycle schema/migration | Clean; Antigravity worker stopped before editing |
| `agent/s2-t01-gauge` | `<track root>/worktrees/s2-t01-gauge` | S2-T01 gauge orientation/null state | Clean; OpenCode worker stopped before editing |

The partial S1-T00 files are:

```text
pulse/domain/__init__.py
pulse/tests/__init__.py
pulse/tests/test_smoke.py
```

The two initializers are empty. `test_smoke.py` currently uses
`unittest.TestCase` and an always-true test. This was resolved during
integration (see `07-execution-status.md`'s merged-commit table, S1-T00
`62d35cb`) — it is no longer open.

## 6. Agent pool and observed health

Configured worker lanes:

| Lane | Runtime/model | State/evidence |
| --- | --- | --- |
| Codex subagent | `gpt-5.4`, medium reasoning (closest available runtime to requested GPT-5.4 mini medium) | Healthy; completed read-only model inventory; paused S0-T03 worker was shut down cleanly |
| Kimi CLI | Kimi CLI 0.38.0 | Healthy for read-only work; completed frontend inventory. CLI rejects `--prompt` combined with `--auto` or `--yolo`; use plain `kimi -p`. S1-T00 left partial files before pause |
| Antigravity | `gemini-3.6-flash-low`, effort low | Healthy; completed API inventory. Paused S1-T01 produced no changes and its process is stopped |
| OpenCode Go | `opencode-go/minimax-m3` | Healthy; completed a bounded scheduler inventory in under one minute. M2.7 was removed after two stale runs with no output |
| Execution fallback | `claude -p` Haiku | Use only if configured worker lanes fail/out of tokens |
| Final external review | `claude -p` Sonnet, medium | Required after integrated implementation and tests, before Codex final review |

All active worker processes were stopped at the user's pause request. A process
scan found no remaining `agy`, `opencode run`, or `kimi -p` process. Do not
assume any worker session will resume; dispatch a fresh bounded prompt against
the existing task worktree.

Parallelism rule: keep all healthy lanes occupied whenever dependency-ready
tasks have disjoint write sets. Each run gets exactly one task card and bounded
allowed files. The integration owner reviews every diff and commits/merges it.
Stop and replace a worker that loops, goes silent without measurable activity,
or expands beyond scope.

## 7. Bench and Docker state

Protected reference:

- Bench: `/workspace/benches/pulse-reference`
- Site: `pulse-reference.local`
- Frappe: `16.31.0`, branch `version-16`
- Pulse: `0.0.1`, main commit `a1c3c6c`
- Web/socket: 8091/9011 through `pulse-reference-proxy`
- Redis DB: 11
- Backend ping returned HTTP 200.
- Built Pulse JS and CSS assets returned HTTP 200.
- A supported database/config/public/private backup was created at
  `2026-08-26 00:27` under the reference site's private backups.
- Never migrate, seed, run write-capable tests on, or tear down this reference.

Shared registry issue:

- Redis DB indexes 0 through 15 are all reserved by registered benches.
- A previous `mh new --dry-run` selected invalid default DB 16, attempted a
  denied `/etc/hosts` write despite dry-run, and originally found no reference
  database backup. The backup issue is now fixed; capacity and dry-run side
  effect remain unresolved.
- `mh audit --json` found no unregistered directories/databases/Redis keys, but
  several old entries are stuck in `provisioning` with no live process.
- `sa-pos-opening-closing-full` was identified as a possible cleanup candidate,
  but it was NOT torn down. No bench, database, worktree, registry entry, or
  Redis DB was deleted/reclaimed.
- A safe alternative was identified but not executed: create a Pulse-scoped
  Redis container on `frappe_docker_devcontainer_default` with more than 16 DBs
  and provision with explicit `REDIS_HOST`, allowing allocated DB 16 without
  touching another bench. Validate multihand support before using this route.

User-directed Docker stop completed, without teardown:

- all ten `huf_production-*` containers are stopped;
- `night-mode-tokens-proxy` is stopped;
- containers, volumes, databases, worktrees, and registry entries remain
  recoverable and were not removed;
- shared Pulse/Frappe devcontainer, MariaDB, Redis, pgvector,
  `docker-socket-proxy`, and `pulse-reference-proxy` remain running.

Development policy from the user: agents write code in independent host
worktrees. Do not keep a live bench per agent. Merge reviewed work into the
integration/test branch, then use one multihand Frappe 16 bench whenever an
integration gate needs migration/runtime/manual testing.

**2026-08-27 re-verification entry:** the bench used for the original W1-W5
verification, `pulse-w1w5-verify`, no longer exists in the bench registry
(confirmed via `mh list`). A fresh disposable bench, `pulse-w1w5-reverify`,
was provisioned from `track/pulse-first-milestone` (same branch, current
HEAD) and full re-verification was rerun:

- Backend test suite: 82/82 tests pass, 0 failures, 0 errors — same count as
  the original verification — but only after running `bench
  pulse-clear-demo`, `bench purge-jobs`, and `bench
  pulse-clear-acceptance-fixture` first. The disposable bench's underlying
  reference-restore backup carried over 448 stale SOP Run records, 20 stale
  Pulse Employee records, and 522 queued background jobs baked into the
  backup itself. This is a real infrastructure issue: the reference backup
  used by `mh new --from-reference` is contaminated with old test/demo
  residue and should be re-created clean at some point.
- Frontend: `yarn typecheck` passes clean.
- Acceptance fixture: loaded cleanly after the same demo-data sweep;
  `get_compliance_score` for Owen Patel (`PLS-EMP-1304`) returns exactly
  `{"score": 0.5, "passed_runs": 1, "failed_runs": 1, "eligible_runs": 2}`
  for 2026-08-24 personal scope, matching the spec's central case exactly.
  Nora Singh (`PLS-EMP-1305`) returns `score: null` in both personal and
  inherited scope, also exactly per spec.
- The bench is left running at `http://localhost:8001/pulse` (port 8001, not
  8091/8081/8082 — moved during setup because of a container
  port-publishing constraint: only ports 8000-8005 and 9000-9005 are
  reachable from the host, and this bench's assigned port 8082 was not one
  of them, so its Procfile's `bench serve --port` line was changed to 8001),
  seeded with the full demo dataset via `bench pulse-load-demo`.
  `Administrator`/`Demo@123`, and the same password for every seeded
  account.

## 8. Verification already performed

- `git diff --check` passed for the planning baseline and current model
  inventory.
- All ten existing core DocType JSON files are mapped in
  `model-inventory.md`.
- Documentation task IDs/links and dependency graph were reviewed earlier.
- Frappe 16 reference backend and frontend assets are reachable as described
  above.
- Host frontend typecheck was attempted but could not run because frontend
  dependencies are not installed (`tsc: command not found`). Do not record it
  as passing.
- No backend tests, migrations, scheduler jobs, or site-writing tests have run
  on the new branch.
- No first-milestone product implementation has been merged yet.

## 9. Current dependency/gate state

- S0-T02 current-model inventory: verified.
- S0-T03 acceptance fixture specification: ready, not implemented.
- `P0-code`: recorded as verified in the uncommitted integration docs because
  contracts are acknowledged, S0-T02 is complete, and host worktrees are ready.
- S0-T00/S0-T04 bench preflight/repair: active but incomplete.
- S0-T01 runtime baseline: partial evidence only; not verified.
- `P0-runtime`: blocked until a disposable bench can safely allocate and the
  runtime preflight/baseline reruns.
- **Stale as of 2026-08-27**: the line below ("not merged and not
  runtime-verified") described the original bootstrap snapshot. It no longer
  holds. W1/W2/W3/W4/W5 product work: merged (27/35 backlog tasks) and
  runtime-verified — re-verified again on 2026-08-27 on the disposable bench
  `pulse-w1w5-reverify` (backend 82/82 tests, frontend `yarn typecheck`
  clean, acceptance fixture exact match). See section 7's 2026-08-27 entry
  and `07-execution-status.md`'s "First-milestone waves" table for details.

## 10. Exact resume sequence

**Stale as of 2026-08-27:** the numbered sequence below is the original
bootstrap plan and has largely already happened — W1-W5 are merged and
re-verified (see sections 7 and 9). It is kept for historical record of the
intended process, not as a live to-do list. Outstanding, not covered by this
sequence: the 26 `agent/*` worktree/branch cleanup and the S2-T02 legacy
compatibility-endpoint removal review, both in progress by other agents as of
this writing, plus the Sonnet/Codex final review referenced in step 10 below.

1. In the integration worktree, read this ledger and confirm `git status` is
   clean at the committed handoff snapshot.
2. Review the partial S1-T00 files in `worktrees/s1-t00-scaffold`; adjust the
   smoke-test base if required, perform a safe syntax review, commit on
   `agent/s1-t00-scaffold`, then cherry-pick into integration.
3. Redispatch four bounded workers in parallel:
   - GPT: S0-T03 in `worktrees/s0-t03-fixture`;
   - Kimi: finish/review S1-T00 or take the next disjoint small task after it is
     integrated;
   - Antigravity Flash Low: S1-T01 in `worktrees/s1-t01-lifecycle`;
   - OpenCode Go MiniMax M3: S2-T01 in `worktrees/s2-t01-gauge`.
4. Inspect every worktree with `git status`, `git diff --check`, and a full diff.
   Reject scope expansion. Commit one task per branch and cherry-pick into the
   integration branch in dependency order.
5. Continue W1 after S1-T01: run S1-T02 sequentially because it overlaps
   `SOP Run` schema, then S4-T01. Keep S1-T00 and S2-T01 parallel where safe.
6. Do static/host checks in worktrees. Do not claim Frappe tests/migrations pass
   without a bench.
7. At the first migration gate, use `frappe-multihand` to provision one
   disposable Frappe 16 bench from the integrated Git branch. Resolve Redis
   capacity safely first; do not allocate DB 16 against default 16-DB Redis and
   do not clean another bench without explicit approval.
8. Run migrations, focused tests, and wave gates on that integrated bench.
   Sync later commits through Git only—never copy files into `apps/pulse`.
9. Continue dependency-mapped waves through the usable frontend vertical slice,
   acceptance fixture, analytics, and manual scenarios.
10. Run the required `claude -p` Sonnet medium review, fix findings, then perform
    the Codex requirement-by-requirement final audit.
11. Leave the final disposable Frappe 16 bench running for manual testing; do
    not tear it down without the user's approval.

## 11. Completion is still unproven

**Updated 2026-08-27:** the code-complete and runtime-verification parts of
this are now done — all of W1-W5 is merged, and re-verification on a fresh
bench (`pulse-w1w5-reverify`) confirmed the backend test suite (82/82),
frontend typecheck, and the acceptance-fixture score contract all still pass
on current HEAD. What is still outstanding: the required Claude Sonnet medium
review and the final Codex requirement-by-requirement audit have not been
run against this merged state. The 26 `agent/*` worktree/branch cleanup and
the S2-T02 legacy-endpoint removal review are in progress by other agents in
parallel; do not infer either is finished from this update. None of this
should be read as the full milestone (including those final reviews) being
complete.
