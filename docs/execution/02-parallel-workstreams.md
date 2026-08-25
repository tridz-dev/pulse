# Parallel Workstreams

Workstreams describe ownership; merge waves in
[Dependency map](01-dependency-map.md) still control integration. A lane is not
permission to bypass a dependency.

## Lane A: Baseline and acceptance data

Tasks:

- S0-T00 Environment preflight
- S0-T04 Conditional feature-bench repair
- S0-T01 Baseline verification
- S0-T03 Acceptance fixture specification
- S1-T06 Implement acceptance fixtures

Write ownership:

- `docs/execution/acceptance-fixture.md`
- `pulse/demo/`
- `pulse/seed/`
- `pulse/commands.py`

The specification is docs-only in W0. Demo code changes wait until lifecycle,
generation, scoring, and immutability are integrated. This prevents fixtures
from encoding the prototype's item-level score.

## Lane B: Run schema and scheduling

Tasks:

- S0-T02 Current model inventory
- S1-T00 Domain package and test scaffold
- S1-T01 Lifecycle schema and migration
- S1-T02 Schedule schema and migration
- S4-T01 Run snapshot schema
- S1-T03 Scheduling policy and idempotent generation
- S1-T07 Deadline finalization job

Write ownership:

- `docs/execution/model-inventory.md`
- `pulse/domain/__init__.py`, `pulse/tests/__init__.py`, and the smoke test only
  during S1-T00
- run/template/assignment DocType JSON and controllers named by the active card
- their patch files
- `pulse/domain/scheduling.py`
- `pulse/tasks.py`
- focused scheduling/generation tests

S1-T01, S1-T02, and S4-T01 are sequential even inside this lane. The scheduler
task begins only after their merged schema is available. S1-T07 follows S1-T03
because both edit `pulse/tasks.py`.

## Lane C: Compliance and score adapter

Tasks:

- S1-T04 Compliance policy and score adapter
- S2-T02 Personal and inherited score endpoints

Write ownership:

- `pulse/domain/compliance.py`
- focused compliance tests
- `pulse/api/scores.py`

This lane owns the score response contract. Analytics callers consume it; they
do not reimplement compliance classification in SQL. The legacy Score Snapshot
schema is not redesigned in the first milestone.

## Lane D: Hierarchy and permission scope

Tasks:

- S2-T00 Hierarchy scope resolver
- S2-T03 Hierarchy roll-up correctness
- S5-T02 Escalation target resolver

Write ownership:

- `pulse/domain/hierarchy.py`
- `pulse/api/permissions.py`
- focused hierarchy/permission tests
- `pulse/api/operations.py` only during S2-T03 integration

Permission scope and escalation target resolution are separate interfaces.
This lane must fail closed on malformed/cyclic hierarchy data.

## Lane E: Execution and audit behavior

Tasks:

- S1-T05 My Work submission contract
- S4-T03 Immutable finalized runs

Write ownership:

- `pulse/api/tasks.py`
- `pulse/pulse_core/doctype/sop_run/sop_run.py`
- submission and immutability tests
- My Work page/service/types only during S1-T05

This lane consumes lifecycle/compliance rules. It does not calculate scores.

## Lane F: Manager queries

Tasks:

- S3-T01 Scoped failure list API
- S3-T02 Trends and period filters

Write ownership:

- S3-T01: `pulse/api/operations.py` and its tests
- S3-T02: `pulse/api/insights.py` and its tests

These tasks may run in parallel after the shared score and scope interfaces are
merged. Keep analytics read-only and never duplicate deadline or compliance
rules in page-specific SQL.

## Lane G: Frontend product surfaces

Tasks:

- S2-T01 Gauge orientation
- S2-T04 Manager drill entry points
- S3-T03 Mission Control first view
- S3-T04 Analytics filters and trend view

Write ownership:

- S2-T01: `frontend/src/components/shared/Gauge.tsx`
- S2-T04: Dashboard/Operations, operations service, shared score breakdown, and
  the shared types it needs
- S3-T03: Operations, score service, and the shared types it needs
- S3-T04: Insights, insights service/filters, and the shared types it needs

S2-T04, S3-T03, and S3-T04 are sequential because they overlap product pages or
shared types. Mock data is allowed for local component work only after the
backend response is frozen, and the done check must use the real endpoint.

## Lane H: Post-milestone design

Tasks:

- S4-T02 Event timeline design
- S4-T04 Effective-dated hierarchy design
- S5-T01 Snooze policy model
- S5-T03 Manager follow-up work
- S6-T01 Generic evaluation template design
- S6-T02 Required gate contract
- S6-T03 One-step linked completion

Write ownership is documentation only until a task is explicitly promoted.
These tasks may not add speculative external-system interfaces to the first
milestone implementation.

## Lane I: Setup and administration

Tasks:

- S1-T08 Template command API
- S2-T05 People and hierarchy command API
- S1-T09 Assignment command API
- S1-T10 Template editor UI
- S2-T06 Hierarchy setup UI
- S1-T11 Assignment UI

Write ownership:

- template API/editor: `pulse/api/templates.py`, Templates page/service
- hierarchy API/UI: `pulse/api/people.py`, Team page, people service
- assignment API/UI: `pulse/api/assignments.py`, then Templates page/service

Backend APIs have separate files and may run in parallel when their dependencies
allow. Template editor and hierarchy UI may run together; assignment UI follows
the template editor because both edit Templates. Keep task-specific frontend
types in their service modules so these lanes do not collide on the global type
file.

## Collision rule

Before dispatch, the integration owner copies every task's exact allowed files
into the agent brief and compares them with all active agents. If any file or
DocType directory overlaps, sequence the tasks or assign both to one owner.

Broad labels such as `frontend/src/services/`, `tests if available`, or
`migration files` are not acceptable dispatch scopes. Replace them with exact
paths when creating the agent brief.
