# Current Model Inventory

Status: S0-T02 evidence baseline, 2026-08-26

This document maps the current Pulse prototype to the canonical vocabulary in
[CONTEXT.md](../../CONTEXT.md) and the frozen [domain
contracts](06-domain-contracts.md). It describes current behavior; it does not
make that behavior a compatibility promise.

## Core DocTypes

| Current DocType | Current purpose | Canonical mapping | First-milestone gap |
| --- | --- | --- | --- |
| `Pulse Role` | Business-facing role label | Role metadata | Keep; permissions still resolve through Frappe roles and a Pulse scope resolver. |
| `Pulse Department` | Flat department record | Organization metadata | Keep; it is not the reporting hierarchy. |
| `Pulse Employee` | User profile with `reports_to`, department, branch, and role | Person and single-manager hierarchy node | Keep as hierarchy source. Add command APIs and defensive cycle-safe traversal. Historical runs must not depend on live hierarchy fields. |
| `SOP Template` | Title, department, frequency, owner role, active dates, checklist rows | SOP definition | Add timezone, local start, completion window, and version/snapshot seams. `Custom` currently has no generation path. |
| `SOP Checklist Item` | Child rows for text, input type, weight, and evidence | Checklist progress detail | Keep outside first-milestone compliance scoring. Item completion must not create partial compliance credit. |
| `SOP Assignment` | Active template-to-employee link | Assignment | Add schedule overrides and stable assignment identity. Current duplicate guard only covers active template/employee pairs. |
| `SOP Run` | Generated employee/template/date checklist with `Open/Closed/Locked` status | Run | Add assignment, schedule/run keys, UTC opens/due/completed timestamps, separate operational status and compliance result, and immutable snapshots. |
| `SOP Run Item` | Copied checklist rows with `Pending/Completed/Missed` state | Run progress/evidence | Keep as run detail. It is not the unit of compliance scoring. |
| `Score Snapshot` | Hourly Day-only cache of own/team/combined item scores | Replaceable score projection | Keep as a legacy cache during migration; do not treat as source of truth or redesign in the first milestone. |
| `Corrective Action` | Follow-up record linked to run/employee | Future follow-up work | Out of the first vertical slice except for preserving compatibility. |

Normal `Pulse Employee` saves reject reporting cycles, but recursive readers do
not all protect themselves against already-corrupt/imported data.

## Current lifecycle and scheduling

- Scheduler wiring lives in `pulse/hooks.py`; generation and score jobs live in
  `pulse/tasks.py`.
- Daily, weekly, and monthly generators select active templates and assignments
  using calendar dates. Weekly means Monday and monthly means day one.
- Current generation uniqueness is `template + employee + period_date`.
  Assignment identity is not part of the key.
- A generated run copies checklist rows, but not template title/version,
  employee display name, manager path, department, branch, timezone, or
  schedule/deadline facts.
- A daily overdue job locks earlier `period_date` runs and marks pending items
  missed. There is no frozen `due_at`, five-minute deadline finalizer, or
  query-time effective classification.
- `complete_run` changes an open run to `Closed` even when checklist items are
  still pending. Item updates and run completion are allowed for the owner or
  direct manager.

Target migration: use `run_key = assignment + schedule_key`, materialize UTC
`opens_at` and `due_at`, keep operational status separate from
`Pending/Passed/Failed`, and make finalized compliance records immutable.

## Current scoring and hierarchy

Current scoring in `pulse/api/scores.py` is item based:

```text
own_score = completed_items / total_items
combined_score = average(own_score, recursively averaged team_score)
```

Pending work therefore lowers the score before its deadline, and no items
returns `0.0`. Team values recursively average averages. The target contract is
binary run compliance: pending runs are excluded, no eligible runs returns
`null`, and inherited scores are calculated from descendant passed/failed run
counts without recursive average bias. Personal and inherited responses remain
separate.

`pulse/api/permissions.py` applies role-based row filters to runs, snapshots,
and corrective actions. Executives/admins see the site, Leaders see recursive
subtrees, Managers see direct reports, and Users see themselves. Separate API
modules reimplement parts of this logic, producing inconsistencies; notably the
task mutation guard only recognizes an owner or direct manager. A shared,
cycle-safe permission/scope resolver is required.

## API capability inventory

| Module | Capability | Mode | Contract gap |
| --- | --- | --- | --- |
| `pulse/api/auth.py` | Current employee and roles | Read | Preserve through the hierarchy/permission abstraction. |
| `pulse/api/tasks.py` | List runs, run detail, update item, close run | Read/write | Legacy lifecycle, direct-manager mutation, no immutable binary submission contract. |
| `pulse/api/scores.py` | Personal/team/all-team scores and failure analytics | Read | Item scoring, combined score, recursive averages, no `null` no-data state. |
| `pulse/api/operations.py` | Hierarchy overview and run breakdown | Read | Consumes legacy combined scores and live hierarchy. |
| `pulse/api/insights.py` | Trends, comparisons, distribution, missed items | Read | Uses legacy snapshots/item completion and duplicated scope logic. |
| `pulse/api/templates.py` | Template list and checklist items | Read only | No create/update template commands. |
| `pulse/api/demo.py` | Demo status/install/clear | Read/write, admin | Fixture behavior must be updated only after new schema exists. |

Missing command APIs: template create/update, assignment create/deactivate,
department/person create/update, and reporting-line changes.

## Frontend surface inventory

Routes are declared in `frontend/src/App.tsx` under `/pulse`.

| Surface | Current behavior | Mode | Gap |
| --- | --- | --- | --- |
| Dashboard | Gauge plus own/team/combined score and failure summary | Read; demo controls can write | Uses combined score, synthetic trend labels, and renders missing data as zero. |
| My Tasks | Lists runs, updates items, closes runs | Read/write | Uses `Open/Closed/Locked`; no binary submit/finalize contract. |
| Team | Direct/all-team score tables | Read | Uses own/team/combined legacy response. |
| Operations | Recursive organization tree and employee drill route | Read | Uses live hierarchy and combined scores. |
| User Profile | Gauge, own/team cards, runs, breakdown | Read; corrective-action flag is inert | Uses combined/item score contract. |
| Templates | Lists templates and printable checklist | Read only | “Create Template” has no handler; no editor or assignment flow. |
| Insights | Period/filter analytics widgets | Read | Item-completion and legacy snapshot analytics. |

There is no frontend service, type, or usable UI for people/hierarchy setup,
template writes, or assignments. Sidebar search and notification controls are
also inert but are not milestone setup blockers.

`frontend/src/components/shared/Gauge.tsx` currently maps the low/left side to
green and high/right side to red. It must be reversed and gain a distinct
`null` state. `frontend/src/types/index.ts` encodes the same legacy lifecycle
and score response shapes used by the pages.

## Likely migrations and compatibility work

S1/S4 schema work will likely require:

1. lifecycle and compliance fields on `SOP Run`, with an explicit legacy-data
   mapping for `Open/Closed/Locked`;
2. schedule policy fields on template and assignment;
3. assignment, schedule key, unique run key, UTC opens/due/completed timestamps,
   and effective timezone on runs;
4. immutable template/person/hierarchy/schedule snapshot fields on runs;
5. indexes for deadline finalization, assignment/schedule idempotency, employee
   period queries, and compliance aggregation;
6. compatibility adapters while frontend and analytics move off
   `combined_score`, item totals, and date-only semantics.

The first milestone does not need to replace `Score Snapshot`, build generic
quality/evaluation templates, add snooze/escalations, or implement multiple
managers. Schema and service boundaries must leave those additions possible.

## Primary risks

- A late completion can become `Closed` before the daily lock job runs.
- Managers can mutate subordinate evidence through operator endpoints.
- Live hierarchy/template edits can reinterpret old data because snapshots are
  absent.
- Several analytics endpoints treat a stale cache as authoritative.
- Setup cannot be completed from the product frontend.
- Backend scope logic is duplicated and can disagree across endpoints.
