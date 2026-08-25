# First-Milestone Domain Contracts

Status: frozen planning contract for S1-S4 implementation

This document removes decisions from implementation task cards. Agents may
suggest a change in their handoff, but must not silently choose a different
meaning. If this document and older prototype code disagree, this document is
the target and the prototype is legacy behavior.

## 1. Module seams

Keep the core rules behind three focused interfaces rather than repeating them
inside whitelisted endpoints, scheduled jobs, and pages.

| Module | Interface responsibility | Adapters/callers |
| --- | --- | --- |
| Compliance policy | Classify one generated run and aggregate run counts | score APIs, snapshots, insights |
| Scheduling policy | Resolve local schedule windows into UTC `opens_at`, `due_at`, and a stable `schedule_key` | scheduler and on-demand generator |
| Hierarchy scope | Resolve the people visible below one employee | permissions, scores, failures, operations |

Pure calculations belong under `pulse/domain/`. Frappe database access remains
in the existing scheduler, permission, and API modules. Tests should exercise
the domain interfaces directly and add a small Frappe integration test where
persistence or permissions matter.

Do not introduce ports for future WhatsApp, Telegram, ERP, or POS adapters in
the first milestone. Those seams become real when a second adapter is actually
implemented.

### Tenancy and setup boundary

The first milestone treats one Frappe site as one Pulse organisation. Do not add
an Organisation DocType or cross-tenant rows. Frappe login users may be
provisioned outside Pulse initially, but an authorised Pulse administrator must
be able to manage departments, employee profiles/reporting lines, SOP
templates, schedules, and assignments from the Pulse frontend. User invitation
and polished onboarding remain later work.

## 2. Run identity and schedule

An assignment occurrence is identified by:

```text
assignment + schedule_key
```

`schedule_key` is a stable local schedule-window key, not the scheduler job's
execution timestamp. `run_key` is the globally unique persisted key derived
from assignment + schedule key. Generation must be idempotent against
`run_key`. Add an `assignment` link to `SOP Run`; template + employee + date is
not sufficient because a person can hold more than one assignment for the same
template.

The first recurring schedule contract is:

- the template supplies frequency, local start time, and completion window;
- the assignment may override time zone, local start time, and completion
  window;
- assignment override wins, then template value, then the Frappe site time
  zone for migrated records;
- `opens_at` is when work becomes actionable and the run is generated;
- `due_at` is `opens_at + completion_window`;
- both timestamps and the effective time zone are frozen on the run;
- a retry produces the same `schedule_key` and no duplicate logical run;
- future runs are not pre-generated.

Store datetimes using Frappe's normal UTC persistence and convert at the
scheduling interface. Do not compare a `Date` field with the server's current
date to decide whether a run failed.

## 3. Lifecycle and compliance result

Operational state and compliance result are separate concepts.

### Operational status

The built-in lifecycle is:

```text
Open -> In Progress -> Completed
  \          \-> Completed
   \-> Locked
```

`Overdue` is a derived condition (`now > due_at` while not completed), not a
separate score. In the first milestone, crossing the deadline freezes a Failed
result and locks normal submission. Frappe Workflow may later allow a linked
late-completion/amendment path, but it must not redefine deadline or compliance
semantics.

### Compliance result

Persist or expose one of:

- `Pending`: generated and neither completed nor past due;
- `Passed`: `completed_at <= due_at`;
- `Failed`: deadline elapsed before a valid completion.

Read interfaces classify against `completed_at`, `due_at`, and the supplied
evaluation instant, so a five-minute scheduler interval never delays a score
change. The deadline-finalization job materializes that derived failure and
locks normal submission idempotently.

A normal completion endpoint must never turn a `Failed` result into `Passed`.
If late completion is added later, it is recorded as an amendment/event while
the original failed proof remains intact.

Checklist item progress remains submission detail. It never creates a partial
compliance score in the first milestone.

## 4. Score and no-data semantics

For a selected period and scope:

```text
eligible = Passed runs + Failed runs
score = Passed runs / eligible runs
```

Rules:

- each eligible SOP run has equal weight;
- `Pending` runs before their deadline are excluded;
- assignments without a generated run are excluded;
- no eligible runs means `score: null`, never zero;
- return `passed_runs`, `failed_runs`, and `eligible_runs` with every score so
  the gauge is explainable;
- storage and backend transport use fractions from `0.0` to `1.0`;
- the frontend alone formats a fraction as `0` to `100%`;
- evaluation outcomes never enter this calculation.

For the first milestone, inherited score is run-weighted across all eligible
runs in the descendant subtree. Personal score uses only the selected person's
runs. Do not recursively average manager averages and do not create a default
combined personal/team score.

## 5. Period semantics

Day, week, month, and custom ranges select runs by their frozen `due_at` in the
viewer's requested/effective time zone. Week starts Monday for the initial
contract. Custom ranges are inclusive local dates converted to a half-open UTC
range.

Current failure attention and historical period score are separate queries:

- period score answers what happened within the selected range;
- the first milestone attention list shows failed runs in the requested range;
- true unresolved/resolved state requires the later corrective-action/event
  work and must not be inferred from a later successful run.

## 6. Hierarchy and permission semantics

The first hierarchy is the active `reports_to` tree.

- personal scope contains exactly the selected employee;
- inherited scope contains active descendants and excludes the manager's own
  runs;
- subtree scope used for operational drill-down contains the manager plus
  active descendants only when the caller explicitly asks for both;
- executives may request organisation scope through the same resolver;
- every endpoint applies the hierarchy scope before aggregation or pagination;
- permission scope and notification/escalation target resolution remain
  separate interfaces.

A malformed cycle must fail closed and be reported; traversal must not recurse
forever.

## 7. Run snapshot contract

At generation, freeze enough display and attribution data to explain the run
without following mutable masters:

- assignment identity;
- template identity, title, and available version marker;
- employee identity and display name;
- manager path as stable employee identifiers plus display labels;
- department and branch labels;
- `opens_at`, `due_at`, effective time zone, frequency, and completion window;
- checklist rows and evidence requirements;
- applicable scoring/snooze policy markers that exist at generation time.

Backfill existing prototype records as best effort and label incomplete
snapshots; do not invent historical values that cannot be recovered.

### Exact first-milestone field ownership

Use these field names so separate schema agents do not invent incompatible
variants:

| DocType | Field | Frappe type / rule |
| --- | --- | --- |
| SOP Template | `schedule_timezone` | Data; valid IANA time-zone name |
| SOP Template | `local_start_time` | Time |
| SOP Template | `completion_window_minutes` | Int; positive |
| SOP Assignment | `schedule_timezone_override` | Data; optional valid IANA name |
| SOP Assignment | `local_start_time_override` | Time; optional |
| SOP Assignment | `completion_window_minutes_override` | Int; optional positive |
| SOP Run lifecycle | `compliance_result` | Select: Pending / Passed / Failed |
| SOP Run lifecycle | `completed_at` | Datetime; read-only outside domain action |
| SOP Run schedule | `assignment` | Link to SOP Assignment |
| SOP Run schedule | `schedule_key` | Data; indexed local window key |
| SOP Run schedule | `run_key` | Data; globally unique assignment/window key |
| SOP Run schedule | `opens_at`, `due_at` | Datetime; frozen |
| SOP Run schedule | `effective_timezone` | Data; frozen IANA name |
| SOP Run snapshot | `template_title_snapshot` | Data |
| SOP Run snapshot | `template_modified_snapshot` | Datetime; initial version marker |
| SOP Run snapshot | `employee_name_snapshot` | Data |
| SOP Run snapshot | `manager_path_snapshot` | JSON |
| SOP Run snapshot | `department_snapshot`, `branch_snapshot` | Data |
| SOP Run snapshot | `frequency_snapshot` | Data |
| SOP Run snapshot | `completion_window_minutes_snapshot` | Int |
| SOP Run snapshot | `snapshot_is_complete` | Check |

`manager_path_snapshot` is JSON containing stable employee IDs and display
labels from direct manager upward. Existing copied run-item rows remain the
checklist snapshot. `period_date`, `closed_at`, totals, and item progress may
remain as compatibility fields during migration, but new domain rules do not
depend on them.

## 8. First backend response contract

A score response must be explicit enough that the frontend does not infer
meaning from `combined_score`:

```text
{
  scope: "personal" | "inherited",
  subject: <employee id>,
  score: <0.0..1.0 | null>,
  passed_runs: <integer>,
  failed_runs: <integer>,
  eligible_runs: <integer>,
  period: { type, start, end, timezone }
}
```

Compatibility keys may remain temporarily, but new frontend work must consume
the explicit contract. Every compatibility key must have a removal note in the
handoff.

### Score Snapshot is a projection

`Score Snapshot` is a replaceable legacy cache; `SOP Run` remains authoritative.
Do not redesign its schema in the first milestone. New score, roll-up, and trend
interfaces calculate explicit passed/failed/eligible counts from runs. Existing
`own_score`, `team_score`, `combined_score`, item totals, and item completion
fields remain only for temporary prototype compatibility and must not be used
by new callers. Cache redesign becomes a separate performance task after the
correct interfaces are measured.

## 9. Minimum contract test matrix

The first milestone is not mergeable without tests for:

1. no generated run -> `null` score;
2. generated pending before due -> `null` score;
3. completed before due -> 1 passed, score `1.0`;
4. completion exactly at due passes; incomplete after due fails with score `0.0`;
5. normal completion after failure cannot rewrite the frozen Failed result;
6. one passed + one failed -> score `0.5`;
7. generator retry -> one run for assignment + schedule key;
8. same employee/template through two assignments -> two distinct logical
   runs;
9. hierarchy roll-up counts descendant runs once each;
10. manager personal score remains separate from inherited score;
11. no-data descendant does not lower inherited score;
12. out-of-scope failure is not returned;
13. later template/hierarchy changes do not rewrite a generated run snapshot;
14. 0 renders red/left and 1 renders green/right in the gauge.
15. concurrent deadline finalization and submission cannot produce both Passed
    and Failed outcomes.

## 10. First Mission Control ordering

The first milestone has no criticality weights or failure-resolution workflow.
Order the attention list by:

1. longest overdue duration first;
2. then highest repeat-failure count for the same SOP/person in the selected
   period;
3. then oldest `due_at`;
4. then run ID for a deterministic tie-break.

Label this list “Failed runs” rather than “Unresolved work”. A later S5 task may
add criticality, corrective-action ownership, and explicit resolution state.
