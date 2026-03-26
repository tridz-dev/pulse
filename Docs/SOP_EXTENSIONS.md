# Pulse — SOP extensions (agent reference addendum)

This document supplements `AGENTS.md` for evidence, scheduling, conditional rules, scoring, and operator UI.

## Run metrics (`SOP Run`)

| Field | Formula / meaning |
|-------|-------------------|
| `progress` | `(completed_items + missed_items) / total_items` (operational closure) |
| `score` | `passed_items / (total_items − items with outcome NotApplicable)` (compliance) |
| Counters | `SOPRun.before_save` recomputes `completed_items`, `passed_items`, `failed_items`, `missed_items` |

`pulse.api.scores._calculate_score_snapshot` weights each run’s stored `score` by `total_items` for **own_score** (not raw completion ratio).

## Scheduler (`hooks.py`)

| Job | Function |
|-----|----------|
| `all_15_minutes` | `pulse.tasks.every_quarter_hour` — TimeOfDay + Interval run generation |
| `daily` | `pulse.tasks.daily` — CalendarDay runs + `lock_overdue_runs` |
| `hourly` | `cache_score_snapshots` |

**TimeOfDay:** `schedule_time` + `schedule_days_of_week` (0 = Monday). Match window `(t, t+15m]`. Unique key: `(template, employee, period_datetime)`.

**lock_overdue_runs:** Uses `period_datetime + grace_minutes` when `period_datetime` is set; else calendar-day rule.

## API (`pulse.api.tasks`)

- `get_my_runs` / `get_runs_for_employee` — `period_date` filter, sort by `period_datetime`; returns `progress`, `score`, `period_datetime`.
- `get_run_details` — Extended item fields (`item_key`, proof/outcome fields) and run `progress` / `score`.
- `update_run_item` — `outcome`, `failure_remark`, `file_url`; validates PassFail and required proof on Completed.
- `upload_run_item_evidence` — Multipart `file`, form `run_item_name`.
- `complete_run` — Rejects if any item still `Pending`; validates outcomes/proof.

## Rules engine

- DocTypes: **SOP Follow-up Rule**, **SOP Rule Execution Log**.
- Trigger: `SOPRunItem.on_update` on first transition to **Completed** + **Fail** (idempotent via log).

## Frontend

- Route **`/pulse/operator`** — `OperatorLayout` + `OperatorPage`; Pulse Users see **Operator** in the main sidebar.
- **My Tasks** — `RunCard` shows progress (indigo) and score (green/amber/red); `ChecklistRunner` handles proof and Pass/Fail.

## Patches

- `pulse.pulse_core.patches.v1_2.sop_extensions_data` — Backfill `item_key`, proof mapping, sync run items from template order.
