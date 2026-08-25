# Task Backlog

Each task is intentionally narrow. Give a small agent one task at a time.

Before dispatching S1-S4 work, read the frozen
[domain contracts](06-domain-contracts.md). The card tells the agent where to
change code; the contract tells it what the change means. `P0` means S0-T00 and
S0-T02 are complete and the contract has been acknowledged.

## S0 Foundation

### S0-T00 Environment preflight

Goal: prove the declared Pulse workspace and reference bench are registered,
identifiable, healthy enough to inspect, and have a supported path for future
feature-bench allocation.

Dependencies: none.

Allowed files:

- `DOCKER_BENCH.md`, only if the live canonical path differs
- handoff note only otherwise

Steps:

1. Run the canonical multihand `doctor`, `list`, and status checks read-only.
2. Confirm the `pulse` entry exists in `/workspace/benches/workspaces.json`.
3. Confirm `pulse-reference` is a persistent registry entry and its
   `BENCH_IDENTITY.md` matches site/app/ports.
4. Confirm the CLI reports enough safe capacity for the next disposable bench,
   or record capacity as a blocker.
5. If any identity/manifest/registry item is missing, stop product work and
   open a separate bench-bootstrap/repair task. Never hand-roll provisioning.

Done checks:

- Canonical CLI path and bench identity are recorded.
- Workspace, registry, and identity agree.
- Feature-bench capacity is either confirmed or explicitly blocked.

Non-goals:

- Do not create, repair, refresh, or tear down a bench in this read-only task.
- Do not mutate the reference site.

### S0-T01 Baseline verification

Goal: prove the current bench, site, frontend, and demo data still work before
behavior changes begin.

Dependencies: verified S0-T00; S0-T04 if the preflight activated it.

Allowed files:

- `DOCKER_BENCH.md`
- docs only, if verification steps need clarification

Steps:

1. Start or inspect the `pulse-reference` bench.
2. Verify the ping API.
3. Verify the `/pulse` frontend loads.
4. Confirm demo data exists and count employees, templates, assignments, runs.
5. Record any broken baseline as a blocker.

Done checks:

- Bench status is known.
- Site URL and current port are recorded in the handoff.
- Demo counts are recorded.

Non-goals:

- Do not fix product logic.
- Do not change schema.

### S0-T04 Conditional feature-bench repair

Goal: restore a supported disposable-bench path when S0-T00 proves the current
registry, capacity, or reference-backup state cannot provision safely.

Activation: only after a blocked S0-T00 handoff. This task is currently
activated because the 2026-08-25 dry run selected Redis DB 16 and found no
reference database backup; it also attempted an `/etc/hosts` write despite
`--dry-run` and was denied.

Dependencies: blocked S0-T00 outcome and explicit user approval before tearing
down or cleaning any existing bench/resource.

Allowed files:

- `DOCKER_BENCH.md`, only for durable corrected instructions
- no application code

Steps:

1. Run read-only `mh audit`, `mh list`, and registry/reference identity checks.
2. Identify stale/failed benches or reservations that consume ports/Redis DBs;
   do not clean them without explicit approval and ownership review.
3. Ensure `pulse-reference` has a current supported backup for
   `--from-reference`; creating the backup is allowed only as the declared
   repair action and must not reseed/change reference data.
4. Recover capacity through approved `mh` repair/teardown or a properly
   isolated Redis plan. Never allocate DB 16 on a default 0-15 Redis setup.
5. Resolve or formally classify the `mh doctor` Docker-daemon warning for this
   container execution path.
6. Ensure the multihand dry-run path is side-effect free; repair/report the
   attempted `/etc/hosts` write outside the Pulse repo rather than ignoring it.
7. Rerun a no-create provisioning dry run and then rerun S0-T00.

Done checks:

- `mh` dry run selects valid, unreserved ports and Redis DBs.
- A usable reference database backup is found.
- Registry/identity remain consistent and S0-T00 verifies on rerun.
- Dry run performs no writes and no unexplained doctor failure remains.
- Every cleanup action and recoverability outcome is recorded.

Non-goals:

- Do not hand-edit registry allocations, flush shared Redis, reseed the
  reference site, or tear down any bench without approval.
- Do not patch shared multihand tooling as part of a Pulse application task.

### S0-T02 Current model inventory

Goal: document current DocTypes and APIs against the product vocabulary.

Dependencies: none.

Allowed files:

- `docs/execution/model-inventory.md`

Steps:

1. Inspect SOP, employee, score, operations, tasks, and insights code.
2. Map current fields to canonical terms in `CONTEXT.md`.
3. Call out mismatches, especially item-level scoring versus run-level scoring.
4. List migrations likely required for S1 and S4.
5. Mark each frontend surface/API as read-only or write-capable; explicitly note
   inert setup controls and missing command endpoints.

Done checks:

- `model-inventory.md` exists.
- Every current core DocType is mapped or marked out of scope.

Non-goals:

- Do not edit code.

### S0-T03 Acceptance fixture specification

Goal: specify deterministic demo records and expected outcomes without changing
prototype fixtures before the new schema exists.

Dependencies: S0-T01, S0-T02.

Allowed files:

- `docs/execution/acceptance-fixture.md`

Steps:

1. Name the exact three-level hierarchy and login users.
2. Define two assignments, their local start/deadline values, and stable
   schedule keys.
3. Define one passed run, one failed run, one pending run, and one person with
   no eligible run.
4. Record expected personal/inherited scores and allowed visibility for each
   user.
5. Record the snapshot mutation check: change a template and manager after run
   generation and state what historical values must remain.

Done checks:

- Expected `1.0`, `0.0`, `0.5`, and `null` score cases are written down.
- S1-T06 can implement the fixture without making a product decision.

Non-goals:

- Do not build onboarding wizard behavior.
- Do not edit demo code in this task.

## S1 Reliable Execution

### S1-T00 Domain package and test scaffold

Goal: create the shared package initializers once and prove Frappe discovers
the app test package before parallel domain agents start.

Dependencies: P0.

Allowed files:

- `pulse/domain/__init__.py`
- `pulse/tests/__init__.py`
- `pulse/tests/test_smoke.py`

Steps:

1. Create empty/minimal package initializers without exporting speculative
   interfaces.
2. Add one harmless smoke test that proves the Pulse test package is collected.
3. Run that focused test on the assigned disposable bench.

Done checks:

- The focused smoke test is discovered and passes.
- Later agents do not need to edit either initializer.

Non-goals:

- Do not implement compliance, scheduling, hierarchy, fixtures, or schema.

### S1-T01 Lifecycle schema and migration

Goal: separate operational status from the immutable compliance result.

Dependencies: P0.

Allowed files:

- `pulse/pulse_core/doctype/sop_run/`
- `pulse/pulse_core/patches/v1_2/migrate_run_lifecycle.py`
- `pulse/pulse_core/patches/v1_2/__init__.py`
- `pulse/patches.txt`
- `pulse/pulse_core/doctype/sop_run/test_sop_run.py`

Steps:

1. Add operational statuses `Open`, `In Progress`, `Completed`, and `Locked`.
2. Add compliance results `Pending`, `Passed`, and `Failed`.
3. Add `completed_at`; retain `closed_at` only as a documented compatibility
   field until consumers migrate.
4. Migrate `Closed` to `Completed`; keep legacy `Open` and `Locked` records
   readable. Do not guess pass/fail before S1-T02 supplies a deadline.
5. Test allowed field values and legacy status migration.

Done checks:

- Existing Open/Closed/Locked records migrate without loss.
- Operational status and compliance result can vary independently.
- No endpoint or frontend change is included yet.
- The handoff records how to recover if the data patch fails partway.

Non-goals:

- Do not add configurable Frappe Workflow yet.
- Do not model `Overdue` as a blocking stored status.

### S1-T02 Schedule schema and migration

Goal: add the exact schedule identity and frozen deadline fields required by the
scheduling contract.

Dependencies: S1-T01.

Allowed files:

- `pulse/pulse_core/doctype/sop_template/`
- `pulse/pulse_core/doctype/sop_assignment/`
- `pulse/pulse_core/doctype/sop_run/`
- `pulse/pulse_core/patches/v1_2/migrate_run_schedule.py`
- `pulse/pulse_core/patches/v1_2/__init__.py`
- `pulse/patches.txt`
- `pulse/pulse_core/doctype/sop_run/test_sop_run_schedule.py`

Steps:

1. Add the exact template and assignment schedule fields named in
   `06-domain-contracts.md`.
2. On the run add `assignment`, `schedule_key`, unique `run_key`, `opens_at`,
   `due_at`, and `effective_timezone`.
3. Use assignment override -> template -> Frappe site time zone precedence.
4. Backfill legacy runs as best effort and leave an explicit incomplete marker
   where historical timing cannot be recovered.

Done checks:

- Clean-site and legacy-record migrations pass on a disposable bench.
- Schema can represent two assignments for one employee/template without
  logical-key collision.
- The handoff records backfill limitations and a rollback/recovery path.

Non-goals:

- Do not build snooze.
- Do not build branch timezone overrides unless necessary for the default.
- Do not implement generation in this task.

### S1-T03 Scheduling policy and idempotent generation

Goal: make scheduled run generation safe to retry.

Dependencies: S1-T00, S4-T01.

Allowed files:

- `pulse/tasks.py`
- `pulse/domain/scheduling.py`
- `pulse/tests/test_scheduling.py`
- `pulse/tests/test_run_generation.py`

Steps:

1. Implement a pure scheduling interface that returns `opens_at`, `due_at`, and
   `schedule_key` from frozen inputs.
2. Generate only runs whose `opens_at` has arrived.
3. Derive `run_key` from assignment + schedule key and enforce it under retries.
4. Copy checklist and snapshot fields prepared by S4-T01.
5. Keep daily, weekly, and monthly adapters thin around the same interface.

Done checks:

- Running the generator twice creates one logical run.
- Two distinct assignments for the same employee/template can each create a
  run.
- Tests use fixed instants and at least two time zones.

Non-goals:

- Do not pre-generate months of future runs.

### S1-T04 Compliance policy and score adapter

Goal: move first-milestone scoring to run-level compliance.

Dependencies: S1-T00, S1-T02 and P0.

Allowed files:

- `pulse/api/scores.py`
- `pulse/domain/compliance.py`
- `pulse/tests/test_compliance.py`
- `pulse/tests/test_scores.py`

Steps:

1. Implement one pure interface that classifies generated runs and aggregates
   passed/failed counts at a supplied evaluation instant.
2. Return `null` when there are no eligible runs.
3. Keep fractions in the `0.0..1.0` range and include passed, failed, and
   eligible run counts.
4. Compute the new response from authoritative runs; do not redesign or depend
   on `Score Snapshot` in this task.
5. Keep old endpoint/cache compatibility keys temporarily but mark them for
   removal.

Done checks:

- One completed run and one missed generated run yields 50% for that scope.
- A not-yet-generated future assignment does not reduce score.
- A pending generated run before its deadline does not reduce score.
- A late completion attempt cannot rewrite a frozen compliance failure.

Non-goals:

- Do not add weighted scoring.
- Do not add partial completion scoring.
- Do not edit insights, operations, or frontend files in this task.

### S1-T07 Deadline finalization job

Goal: make a generated Pending run become a frozen failure when its UTC deadline
passes, safely under scheduler retries.

Dependencies: S1-T03, S1-T04.

Allowed files:

- `pulse/tasks.py`
- `pulse/hooks.py`
- `pulse/tests/test_deadline_finalization.py`

Steps:

1. Replace date-only locking with a query for Pending runs whose `due_at` is at
   or before a supplied/current UTC instant.
2. Apply the compliance interface and persist Failed plus Locked without using
   checklist-item percentages.
3. Make repeated execution a no-op after the first finalization.
4. Register the job on a five-minute cron schedule; tests call the function
   directly with a fixed instant and do not wait for the scheduler.

Done checks:

- A Pending run before due remains Pending.
- A Pending run at/after due becomes Failed and Locked once.
- Passed and already Failed runs are unchanged.
- Running the finalizer twice produces the same stored result.

Non-goals:

- Do not send notifications, create corrective actions, or implement snooze.
- Do not run a scheduler worker against `pulse-reference`.

### S1-T05 My Work submission contract

Goal: make a person able to complete assigned work in the frontend and backend.

Dependencies: S1-T07.

Allowed files:

- `pulse/api/tasks.py`
- `frontend/src/pages/MyTasks.tsx`
- `frontend/src/services/tasks.ts`
- `frontend/src/types/index.ts`

Steps:

1. List open and overdue runs for the current user.
2. Allow Open -> In Progress and Open/In Progress -> Completed.
3. On completion before the deadline, set `completed_at` and mark compliance
   Passed. Reject normal completion after the result is frozen as Failed.
4. Evaluate with server time inside a locked/serialized update so the deadline
   job and submission cannot finalize contradictory results.
5. Preserve checklist item capture as detail, not partial score.
6. Update My Work types/labels from legacy Closed semantics and return enough
   state for an immediate refresh.

Done checks:

- User can complete an open run.
- Score changes after completion.
- A failed run cannot be changed to Passed through normal submission.
- Completion exactly at the deadline follows the `completed_at <= due_at`
  contract, and a concurrency test produces one final result.

Non-goals:

- Do not add maker-checker approvals.

### S1-T06 Implement acceptance fixtures

Goal: implement the deterministic W4 fixture specified by S0-T03 against the
integrated lifecycle.

Dependencies: S1-T05, S4-T03, S0-T03.

Allowed files:

- `pulse/demo/data.py`
- `pulse/demo/seed.py`
- `pulse/demo/README.md`
- compatibility shims under `pulse/seed/` only if needed
- `pulse/commands.py` only if the public command changes

Steps:

1. Implement the named hierarchy, assignments, schedule values, and runs from
   `acceptance-fixture.md`.
2. Keep seed and clear idempotent.
3. Produce passed, failed, pending, and no-data cases without relying on the
   wall clock.
4. Document expected score and login for each fixture user.

Done checks:

- Seed twice produces the same logical records.
- Clear then seed restores the exact expected scenario.
- Expected 1.0/0.0/0.5/null cases are confirmed through the real score endpoint.

Non-goals:

- Do not add onboarding behavior.
- Do not mutate `pulse-reference`; verify on a disposable bench.

### S1-T08 Template command API

Goal: let authorised users create and edit the recurring SOP definition used by
the first milestone.

Dependencies: S1-T02, S2-T00.

Allowed files:

- `pulse/api/templates.py`
- `pulse/tests/test_template_commands.py`

Steps:

1. Add create/update commands for title, department, owner role, active dates,
   frequency, the exact schedule fields, and ordered checklist rows.
2. Validate positive completion window, time-zone name, required checklist
   content, and supported first-milestone frequencies.
3. Enforce Frappe roles explicitly; read endpoints must not imply write access.
4. Preserve generated-run snapshots when a template is later edited.

Done checks:

- An authorised caller can create and update a daily template.
- Invalid schedule/checklist input is rejected with a useful message.
- An unauthorised Pulse User cannot write.
- Editing a template does not modify an existing run snapshot.

Non-goals:

- Do not implement formal template-version documents, workflow templates, or
  on-demand SOPs in this task.

### S1-T09 Assignment command API

Goal: assign a template to an in-scope active employee with optional schedule
overrides and safe deactivation.

Dependencies: S1-T08, S2-T05.

Allowed files:

- `pulse/api/assignments.py`
- `pulse/tests/test_assignment_commands.py`

Steps:

1. List assignments and eligible active employees inside the caller's allowed
   scope.
2. Create an assignment with optional exact schedule override fields.
3. Reject an accidental duplicate active assignment with the same template,
   employee, and effective overrides; allow a deliberately different schedule.
4. Deactivate rather than delete an assignment that may have historical runs.

Done checks:

- Authorised caller can create, list, and deactivate an in-scope assignment.
- Out-of-scope employee assignment is rejected.
- Retry with identical values does not create a duplicate active assignment.
- Existing generated runs remain linked after deactivation.

Non-goals:

- Do not assign departments/roles as dynamic scopes or bulk import assignments.

### S1-T10 Template editor UI

Goal: make the existing Create Template control functional for the complete
first-milestone template and schedule.

Dependencies: S1-T08.

Allowed files:

- `frontend/src/pages/Templates.tsx`
- `frontend/src/services/templates.ts`

Steps:

1. Add create/edit UI for core template fields, daily/weekly/monthly schedule,
   and ordered checklist rows.
2. Keep schedule validation errors next to the relevant field.
3. Hide the editor when the caller lacks write permission.
4. Keep service-specific request/response types in `templates.ts`.

Done checks:

- Create Template opens a working editor and a saved template appears in list.
- Edit updates future configuration without rewriting historical runs.
- Editor works at mobile width and frontend typecheck/build pass.

Non-goals:

- Do not build a generic form builder or polished onboarding wizard.

### S1-T11 Assignment UI

Goal: let an authorised user assign/deactivate a template from the Pulse
frontend without opening a raw DocType list.

Dependencies: S1-T09, S1-T10, S2-T06.

Allowed files:

- `frontend/src/pages/Templates.tsx`
- `frontend/src/services/templates.ts`
- `frontend/src/services/assignments.ts`

Steps:

1. Show current assignments from template detail.
2. Add an employee picker and simple Assign action.
3. Put time-zone/start/window overrides behind a collapsed Advanced section.
4. Allow safe deactivation with a clear historical-data message.

Done checks:

- An authorised user can assign a template to an in-scope employee.
- Default assignment requires no advanced configuration.
- Deactivation removes future generation but preserves generated runs.
- Mobile layout and frontend typecheck/build pass.

Non-goals:

- Do not add bulk assignment, groups, or user invitation.

## S2 Hierarchy Health

### S2-T00 Hierarchy scope resolver

Goal: provide one reusable hierarchy/permission scope interface before score,
failure, and analytics endpoints diverge.

Dependencies: S1-T00.

Allowed files:

- `pulse/domain/hierarchy.py`
- `pulse/api/permissions.py`
- `pulse/tests/test_hierarchy_scope.py`
- `pulse/tests/test_permissions.py`

Steps:

1. Resolve personal, descendants-only inherited, manager-plus-descendants, and
   executive organisation scopes from active `reports_to` records.
2. Apply role and current-user checks at the permission adapter.
3. Detect hierarchy cycles and fail closed.
4. Return stable employee IDs; presentation metadata belongs to callers.

Done checks:

- Manager cannot resolve a sibling subtree.
- Executive organisation scope uses the same interface.
- Inactive employees are excluded and a cycle cannot recurse forever.

Non-goals:

- Do not implement notification targets or multiple managers.

### S2-T01 Gauge orientation

Goal: reverse the gauge so high score is green and low score is red.

Dependencies: P0.

Allowed files:

- `frontend/src/components/shared/Gauge.tsx`

Steps:

1. Reverse gradient stops.
2. Reverse solid color thresholds.
3. Confirm labels still read 0 left to 100 right.
4. Check dashboard and team score use the new color semantics.

Done checks:

- 98 displays green on the right.
- 0 displays red on the left.
- A null/no-data value is visually distinct from 0% failure.

Non-goals:

- Do not redesign the dashboard.

### S2-T02 Personal versus inherited score API

Goal: expose personal compliance separately from inherited subtree health.

Dependencies: S1-T04, S2-T00.

Allowed files:

- `pulse/api/scores.py`
- `pulse/tests/test_score_endpoints.py`

Steps:

1. Expose the response shape in `06-domain-contracts.md` for personal scope.
2. Expose the same shape for descendants-only inherited scope.
3. Apply S2-T00 before reading or aggregating runs.
4. Remove `combined_score` from the default meaning while retaining any
   compatibility key only with a removal note.

Done checks:

- Manager can see inherited score.
- Same manager can toggle or request personal score.
- API no longer relies on ambiguous combined score for default view.

Non-goals:

- Do not implement weighted subtree scoring.

### S2-T03 Hierarchy roll-up correctness

Goal: make scores roll upward through the canonical `reports_to` tree.

Dependencies: S2-T02.

Allowed files:

- `pulse/api/scores.py`
- `pulse/tests/test_score_rollup.py`

Steps:

1. Compute subtree membership from active employees.
2. Aggregate each eligible descendant run exactly once; do not average manager
   averages.
3. Keep direct personal score separate.
4. Handle employees with no generated runs without unfairly lowering score.

Done checks:

- A missed operator run lowers the supervisor inherited score.
- The same missed run contributes upward to higher managers.
- A manager with no own runs still has inherited score.
- Descendants with no eligible runs do not lower the score.

Non-goals:

- Do not support multi-manager hierarchy yet.

### S2-T04 Manager drill entry points

Goal: allow a manager to move from gauge to the failing person, SOP, and run.

Dependencies: S2-T03, S3-T01.

Allowed files:

- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Operations.tsx`
- `frontend/src/components/shared/ScoreBreakdown.tsx`
- `frontend/src/services/operations.ts`
- `frontend/src/types/index.ts`

Steps:

1. Integrate the real S3-T01 response and show failing people/nodes.
2. Link each failure row to run detail or an equivalent focused view.
3. Preserve the personal/inherited distinction in labels.
4. Keep mobile layout usable.

Done checks:

- Manager can identify which missed run caused score loss.
- User can navigate without needing raw DocType list pages.

Non-goals:

- Do not build full analytics dashboard here.

### S2-T05 People and hierarchy command API

Goal: let a Pulse administrator manage departments and the single reporting
tree while reusing existing Frappe login users.

Dependencies: S2-T00.

Allowed files:

- `pulse/api/people.py`
- `pulse/tests/test_people_commands.py`

Steps:

1. List unlinked enabled Frappe Users suitable for selection.
2. Create/list departments.
3. Create/update Pulse Employee profile, role, branch, department, active flag,
   and `reports_to`.
4. Restrict writes to Pulse Admin for the first milestone and reject self/cycle
   reporting relationships using the hierarchy interface.
5. Never delete an employee with historical runs; deactivate or reassign.

Done checks:

- Admin can build a three-level hierarchy from existing users.
- Duplicate user links, self-reporting, and cycles are rejected.
- Non-admin write is rejected and reads remain scope-limited.
- A hierarchy change affects future runs while old run snapshots stay intact.

Non-goals:

- Do not create/invite Frappe Users, support multiple managers, or add an
  Organisation DocType.

### S2-T06 Hierarchy setup UI

Goal: expose the first-milestone department/person/reporting setup inside the
Pulse frontend.

Dependencies: S2-T05.

Allowed files:

- `frontend/src/pages/Team.tsx`
- `frontend/src/services/people.ts`

Steps:

1. Add an admin-only setup mode to create departments and employee profiles
   from existing login users.
2. Let the admin select role, department, branch, and one manager.
3. Show server validation for duplicate users and hierarchy cycles.
4. Keep service-specific types in `people.ts` and preserve the existing score
   view for non-admin users.

Done checks:

- Admin can create a three-level hierarchy without raw DocType pages.
- Non-admin users cannot see write controls.
- Existing Team score view still loads.
- Mobile layout and frontend typecheck/build pass.

Non-goals:

- Do not add invitations, imports, org charts, or multi-manager UI.

## S3 Drilldown and Analytics

### S3-T01 Scoped failure list API

Goal: return failed runs in a selected period for a manager subtree.

Dependencies: S1-T04, S2-T00.

Allowed files:

- `pulse/api/operations.py`
- `pulse/tests/test_failure_list.py`

Steps:

1. Query failed runs using the compliance policy result and selected range.
2. Include run, person, template snapshot title, due time, overdue duration,
   operational status, and compliance result.
3. Scope results to the requesting manager permission boundary.
4. Keep results stable and paginatable.

Done checks:

- Missed runs appear in manager scope.
- Out-of-scope employee failures do not appear.
- Pagination is applied after permission scope, with deterministic ordering.

Non-goals:

- Do not create notifications.
- Do not label the result unresolved; explicit resolution arrives with S5.

### S3-T02 Trends and period filters

Goal: provide one backend period/range implementation for score trends.

Dependencies: S1-T04, S2-T00.

Allowed files:

- `pulse/api/insights.py`
- `pulse/domain/periods.py`
- `pulse/tests/test_periods.py`
- `pulse/tests/test_insights.py`

Steps:

1. Verify day, week, month behavior.
2. Add or fix custom range behavior.
3. Keep period calculations timezone-aware where run deadlines are involved.
4. Select runs by frozen `due_at` and return explicit score/count points shaped
   for charting.

Done checks:

- Backend supports day/week/month/custom consistently.
- Score denominator follows generated runs in the selected period.

Non-goals:

- Do not add weighted score presets.

### S3-T03 Mission Control first view

Goal: give managers a prioritized view of what needs attention now.

Dependencies: S2-T04, S3-T01.

Allowed files:

- `frontend/src/pages/Operations.tsx`
- `frontend/src/services/scores.ts`
- `frontend/src/types/index.ts`

Steps:

1. Show current inherited score.
2. Show failed runs using the deterministic ordering in
   `06-domain-contracts.md`.
3. Show weakest subtree or person.
4. Show most repeated failed SOPs.
5. Keep the first view compact and operational.

Done checks:

- Manager can answer "what should I look at first?"
- Each item links to a person, SOP, or run.

Non-goals:

- Do not build action automation yet.

### S3-T04 Analytics filters and trend view

Goal: connect the period/trend backend to the existing Insights page without
expanding Mission Control.

Dependencies: S3-T02, S3-T03.

Allowed files:

- `frontend/src/pages/Insights.tsx`
- `frontend/src/services/insights.ts`
- `frontend/src/components/insights/InsightsFilters.tsx`
- `frontend/src/types/index.ts`

Steps:

1. Integrate day, week, month, and custom range controls with S3-T02.
2. Show score and passed/failed/eligible counts without using item progress.
3. Preserve null/no-data separately from 0%.
4. Keep drill links consistent with S2-T04.

Done checks:

- Each period control requests and renders the intended range.
- A null point is not charted or labelled as a 0% failure.
- Typecheck and frontend build pass.

Non-goals:

- Do not add rolling presets, weighted scores, or new ranking rules.

## S4 History and Audit

### S4-T01 Run snapshot fields

Goal: freeze effective context on generated runs.

Dependencies: S1-T02.

Allowed files:

- `pulse/pulse_core/doctype/sop_run/`
- `pulse/pulse_core/patches/v1_2/add_run_snapshots.py`
- `pulse/pulse_core/patches/v1_2/__init__.py`
- `pulse/patches.txt`
- `pulse/pulse_core/doctype/sop_run/test_sop_run_snapshot.py`

Steps:

1. Add the exact snapshot fields listed in `06-domain-contracts.md`.
2. Backfill existing runs as best effort and mark incomplete history.
3. Leave new-run population to S1-T03.

Done checks:

- Later hierarchy or template changes do not hide what the run meant when
  generated.
- The handoff records incomplete backfill cases and recovery steps.

Non-goals:

- Do not design the full event store here.

### S4-T02 Event timeline design

Goal: design an append-only event timeline for run history.

Dependencies: S1-T05, S4-T01.

Allowed files:

- `docs/adr/` or `docs/execution/`

Steps:

1. List required event types.
2. Decide minimal DocType shape.
3. Decide whether current projection remains on `SOP Run`.
4. Record idempotency and external event implications.

Done checks:

- Design is clear enough to implement as separate tasks.

Non-goals:

- Do not implement event storage unless promoted.

### S4-T03 Immutable finalized runs

Goal: prevent silent mutation of completed, failed, or locked proof records.

Dependencies: S1-T05, S4-T01.

Allowed files:

- `pulse/pulse_core/doctype/sop_run/`
- `pulse/api/tasks.py`

Steps:

1. Treat Passed, Failed, and explicitly Locked runs as finalized proof.
2. Block unsafe edits and normal late completion after finalization.
3. Reserve explicit linked amendments/admin corrections as the future-safe
   path; do not silently mutate the original.

Done checks:

- A finalized run cannot be edited through normal submission flow.
- Existing generation and submission still work.

Non-goals:

- Do not implement retention scrubbing.

### S4-T04 Effective-dated hierarchy design

Goal: specify how scheduled reporting-line changes affect future scope without
rewriting historical run attribution.

Dependencies: S4-T01, S2-T00.

Allowed files:

- `docs/execution/hierarchy-history-design.md`

Steps:

1. Define effective-from/effective-to semantics for a single reporting line.
2. Define how future generation chooses the manager path in force at
   `opens_at`.
3. Define migration from the current direct `reports_to` field.
4. Record how multiple-manager support could be added later without enabling it
   now.

Done checks:

- A future implementation can answer manager-at-time without guessing.
- Existing run snapshots remain the source for historical attribution.

Non-goals:

- Do not implement hierarchy history or multiple managers in this design task.

## S5 Snooze and Escalation

### S5-T01 Snooze policy model

Goal: model optional snooze with hidden advanced controls.

Dependencies: S1-T02, S4-T01.

Allowed files:

- design doc first, then DocTypes only if promoted

Steps:

1. Define org, role, hierarchy, and SOP-level policy fields.
2. Define reason options, free text, approval, limit, and duration behavior.
3. Define scoring semantics while snoozed and after new deadline.

Done checks:

- A later implementation can add snooze without changing compliance scoring
  fundamentals.

Non-goals:

- Do not make snooze default for all SOPs.

### S5-T02 Escalation target resolver

Goal: define and implement the first escalation target rules.

Dependencies: S2-T00.

Allowed files:

- `pulse/api/permissions.py`
- future resolver module under `pulse/`
- design doc if needed

Steps:

1. Default target is direct boss.
2. Support an override to higher manager or custom group in design.
3. Keep permission and notification target resolution separate.

Done checks:

- For a failed operator run, the supervisor can be resolved.
- Overrides are designed even if not fully implemented.

Non-goals:

- Do not send WhatsApp or Telegram messages.

### S5-T03 Manager follow-up work

Goal: create a future-safe path for failures that generate manager work.

Dependencies: S5-T01, S5-T02.

Allowed files:

- `pulse/pulse_core/doctype/corrective_action/`
- `pulse/api/operations.py`
- frontend operations page if promoted

Steps:

1. Map current `Corrective Action` to the new domain language.
2. Decide when a failed SOP creates follow-up work.
3. Link follow-up work to the source run and event.

Done checks:

- Manager work can be traced back to the failed SOP run.

Non-goals:

- Do not implement arbitrary automation chains yet.

## S6 Evaluations and Gates

### S6-T01 Generic evaluation template design

Goal: design neutral templates for quality-like checks without calling the
module "quality" only.

Dependencies: S4-T01.

Allowed files:

- `docs/execution/evaluations-design.md`
- ADR only if choosing a hard-to-reverse structure

Steps:

1. Define evaluation template, evaluation run, result, and evidence terms.
2. Support pass/fail, select, numeric, percentage, threshold, text, and file.
3. Keep compliance score separate.

Done checks:

- Design supports quality checks without making quality the product boundary.

Non-goals:

- Do not add combined compliance/evaluation score.

### S6-T02 Required gate contract

Goal: define how required evaluations, approvals, evidence, location, or
external confirmation block SOP completion.

Dependencies: S6-T01.

Allowed files:

- `docs/execution/evaluations-design.md`

Steps:

1. Define gate status.
2. Define blocking behavior when required gate is missing.
3. Define how Frappe Workflow may handle maker-checker.

Done checks:

- A future agent can implement required gates without guessing.

Non-goals:

- Do not implement geofencing or camera-only capture.

### S6-T03 One-step linked completion

Goal: design the case where completing the linked evaluation completes the SOP
run without duplicate submission.

Dependencies: S6-T02, S1-T05.

Allowed files:

- design doc first

Steps:

1. Define when an evaluation is the only required action.
2. Define how successful evaluation marks the linked SOP run complete.
3. Define failure behavior when the evaluation is required but incomplete.

Done checks:

- The design removes duplicate submission steps for simple linked evaluations.

Non-goals:

- Do not merge compliance and evaluation dashboards.
