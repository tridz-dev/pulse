# Pulse — Agent Reference

Frappe app + React SPA that tracks SOP execution across a multi-branch organisation
and converts daily operational activity into measurable, hierarchical performance signals.

**Bench root:** `/workspace/development/edge16`
**Site:** `pulse.localhost`
**App path:** `apps/pulse/`
**Frontend:** `apps/pulse/frontend/`

---

## Concept

Pulse closes the "accountability gap" between ground-level task execution and C-Suite KPIs.

```
Operator completes checklist items
        ↓
SOP Run is scored (own_score)
        ↓
Supervisor inherits team average (team_score)
        ↓
Area Manager inherits their subtree average
        ↓
Executive sees org-wide health
```

Every missed step degrades the combined score of every manager in the reporting line — making
failure visible at any level in real time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Frappe 16 (Python) |
| Database | MariaDB (via Frappe ORM + raw SQL for analytics) |
| Frontend | React 19, React Router 7, Vite 5 |
| Styling | Tailwind CSS 4, shadcn/ui (Radix), Base UI |
| Charts | Recharts |
| Gauges | Custom SVG (`Gauge.tsx`), `requestAnimationFrame` |
| Icons | Lucide React |
| Fonts | Geist Variable (body), DM Mono (metrics) |
| Frappe SDK | `frappe-js-sdk` |
| Client data cache | TanStack React Query v5 (`src/lib/queryClient.ts`, `pulseQueryKeys`) |

---

## Repository layout

```
pulse/
├── AGENTS.md                   # ← this file
├── FEATURES.md                 # Product features and semantics
├── skills/                     # Structured skill documentation
│   └── _index.json             # Skill catalog
├── frontend/                   # React SPA
│   └── src/
│       ├── pages/              # Top-level route pages
│       ├── components/         # Shared UI components
│       ├── services/           # Frappe API client wrappers
│       ├── types/index.ts      # All TypeScript types
│       └── lib/
│           ├── frappe-sdk.ts   # frappe-js-sdk singleton
│           └── queryClient.ts   # TanStack Query + `pulseQueryKeys`
└── pulse/                      # Frappe app
    ├── api/                    # Whitelisted Python methods
    │   ├── auth.py             # get_current_employee
    │   ├── permissions.py      # Row-level query conditions
    │   ├── tasks.py            # Run CRUD + item completion
    │   ├── scores.py           # Score calculation + Redis-cached helpers
    │   ├── operations.py       # Hierarchy tree + breakdown
    │   ├── insights.py         # Analytics (SQL aggregations)
    │   ├── templates.py        # SOP template catalog
    │   ├── demo.py             # Admin demo data API
    │   ├── go.py               # Pulse Go home summary
    │   ├── notifications.py    # In-app notifications API
    │   ├── pulse_cache.py      # Clear Redis API caches
    │   └── pulse_cache_invalidate.py  # doc_events → clear caches
    ├── commands.py             # bench CLI commands
    ├── hooks.py                # Frappe hooks: scheduler, permissions, install
    ├── install.py              # after_install: roles, default records
    ├── tasks.py                # Scheduled jobs
    ├── demo/                   # Canonical demo data
    │   ├── data.py             # Static definitions (users, templates, rates)
    │   ├── seed.py             # seed_demo_data(), clear_demo_data()
    │   └── README.md           # Data table + usage
    ├── seed/                   # Backward-compat shim → imports from demo/
    ├── pulse_core/doctype/     # Core transactional DocTypes
    └── pulse_setup/doctype/    # Setup/config DocTypes
```

---

## DocTypes

### Setup DocTypes (`pulse_setup`)

#### Pulse Role
Maps business role names to Frappe system roles.

| Field | Type | Notes |
|---|---|---|
| `role_name` | Data | PK display name (e.g. "Operator") |
| `level` | Int | Hierarchy level (1=Operator … 4=Executive) |
| `alias` | Data | Short display label (shown in UI) |
| `description` | Small Text | |
| `system_role` | Link→Role | Frappe Role used for permission checks |

Default records created at install:

| role_name | level | system_role |
|---|---|---|
| Operator | 1 | Pulse User |
| Supervisor | 2 | Pulse Manager |
| Area Manager | 3 | Pulse Leader |
| Executive | 4 | Pulse Executive |

#### Pulse Department
Simple master for department grouping.

| Field | Type |
|---|---|
| `department_name` | Data (PK) |
| `description` | Small Text |
| `is_active` | Check |

#### Pulse Employee
Central employee profile linked to a Frappe User.

| Field | Type | Notes |
|---|---|---|
| `employee_name` | Data | Display name |
| `user` | Link→User | Frappe login account |
| `pulse_role` | Link→Pulse Role | Business role |
| `branch` | Data | Branch / location |
| `department` | Link→Pulse Department | |
| `reports_to` | Link→Pulse Employee | Builds org hierarchy |
| `is_active` | Check | |
| `avatar_url` | Data | Profile image |

Auto-naming: `PLS-EMP-####`

---

### Core DocTypes (`pulse_core`)

#### SOP Template
Master definition of a repeating checklist.

| Field | Type | Notes |
|---|---|---|
| `title` | Data | |
| `department` | Link→Pulse Department | |
| `frequency_type` | Select | Daily / Weekly / Monthly / Custom |
| `owner_role` | Link→Pulse Role | Which role executes this SOP |
| `active_from` | Date | |
| `active_to` | Date | Blank = open-ended |
| `is_active` | Check | |
| `schedule_kind` | Select | CalendarDay / TimeOfDay / Interval |
| `schedule_time` | Time | For TimeOfDay scheduling |
| `schedule_days_of_week` | Data | Comma-separated weekday indices (0=Monday) |
| `interval_minutes` | Int | For Interval scheduling |
| `open_run_policy` | Select | AllowMultiple / RequirePreviousClosed |
| `grace_minutes` | Int | Default 30 minutes |
| `checklist_items` | Table→SOP Checklist Item | Child rows |

#### SOP Checklist Item _(child of SOP Template)_

| Field | Type | Notes |
|---|---|---|
| `description` | Data | Step text |
| `sequence` | Int | Ordering |
| `weight` | Float | Score weight (default 1.0) |
| `item_type` | Select | Checkbox / Numeric / Photo |
| `evidence_required` | Select | None / Photo (deprecated, use proof fields) |
| `instructions` | Small Text | Detailed instructions for operator |
| `item_key` | Data | Unique key for rules and prerequisites |
| `outcome_mode` | Select | SimpleCompletion / PassFail / Numeric / PhotoProof |
| `proof_requirement` | Select | None / Optional / Required |
| `proof_media_type` | Select | Image / File / Any |
| `proof_capture_mode` | Select | Any / CameraOnly |
| `prerequisite_item_key` | Data | Key of prerequisite item |
| `prerequisite_trigger` | Select | None / AnyOutcome / OutcomeFail / OutcomePass |

#### SOP Assignment
Links a SOP Template to a specific Pulse Employee.

| Field | Type |
|---|---|
| `template` | Link→SOP Template |
| `employee` | Link→Pulse Employee |
| `is_active` | Check |

The scheduler reads active assignments to generate runs.

#### SOP Run
One execution instance of a template for one employee on one date.

| Field | Type | Notes |
|---|---|---|
| `template` | Link→SOP Template | |
| `employee` | Link→Pulse Employee | |
| `period_date` | Date | |
| `period_datetime` | Datetime | For TimeOfDay/Interval runs |
| `status` | Select | Open / Closed / Locked |
| `total_items` | Int | Set by before_save hook |
| `completed_items` | Int | Counted from run_items |
| `passed_items` | Int | Items with Pass outcome |
| `failed_items` | Int | Items with Fail outcome |
| `missed_items` | Int | Items marked Missed |
| `progress` | Percent | `(completed + missed) / total` |
| `score` | Percent | `passed / (total - not_applicable)` |
| `closed_at` | Datetime | Set when status→Closed |
| `run_items` | Table→SOP Run Item | |

**Status lifecycle:**

```
Open  ──[employee completes]──→  Closed
Open  ──[day passes, overdue]──→  Locked  (Pending items → Missed)
```

#### SOP Run Item _(child of SOP Run)_

| Field | Type | Notes |
|---|---|---|
| `checklist_item` | Data | Step description (denormalised) |
| `item_key` | Data | Unique key from template |
| `instructions` | Small Text | Instructions for operator |
| `weight` | Float | Copied from template |
| `item_type` | Select | Checkbox / Numeric / Photo |
| `outcome_mode` | Select | SimpleCompletion / PassFail / Numeric / PhotoProof |
| `status` | Select | Pending / Completed / Missed / NotApplicable |
| `outcome` | Select | Pass / Fail / NotApplicable |
| `failure_remark` | Small Text | Reason for failure |
| `completed_at` | Datetime | |
| `numeric_value` | Float | For Numeric items |
| `notes` | Small Text | Free-text notes |
| `evidence` | Attach | File upload |
| `evidence_required` | Select | None / Photo (deprecated) |
| `proof_requirement` | Select | None / Optional / Required |
| `proof_media_type` | Select | Image / File / Any |
| `proof_capture_mode` | Select | Any / CameraOnly |
| `proof_captured_at` | Datetime | When evidence was captured |
| `prerequisite_item_key` | Data | Key of prerequisite |
| `prerequisite_trigger` | Select | None / AnyOutcome / OutcomeFail / OutcomePass |

#### Score Snapshot
Cached per-employee score for a period. Written by the hourly scheduler.

| Field | Type | Notes |
|---|---|---|
| `employee` | Link→Pulse Employee | |
| `period_type` | Select | Day / Week / Month |
| `period_key` | Data | "YYYY-MM-DD" for Day; "YYYY-MM-DD to YYYY-MM-DD" for Week/Month |
| `own_score` | Float | 0–1: this employee's item completion |
| `team_score` | Float | 0–1: avg combined_score of direct reports |
| `combined_score` | Float | Average of own + team (or just own if no reports) |
| `total_items` | Int | Items in scope |
| `completed_items` | Int | |
| `computed_at` | Datetime | |

#### Corrective Action
Raised when a run has missed checklist items.

| Field | Type | Notes |
|---|---|---|
| `run` | Link→SOP Run | Source run |
| `run_item_ref` | Data | Missed step description |
| `description` | Small Text | |
| `status` | Select | Open / In Progress / Resolved / Closed |
| `assigned_to` | Link→Pulse Employee | Employee accountable |
| `raised_by` | Link→Pulse Employee | Supervisor who raised it |
| `priority` | Select | Critical / High / Medium / Low |
| `resolution` | Small Text | |
| `resolved_at` | Datetime | |

#### SOP Follow-up Rule
Automated rules that trigger actions when SOP items fail.

| Field | Type | Notes |
|---|---|---|
| `source_template` | Link→SOP Template | Template to watch |
| `trigger_on` | Select | ItemOutcomeFail |
| `source_item_key` | Data | Specific item key to watch |
| `action` | Select | CreateRun |
| `target_template` | Link→SOP Template | Template to create run for |
| `target_assignee` | Select | SameEmployee / EmployeesManager |
| `is_active` | Check | |

Auto-naming: `SOP-RULE-#####`

#### SOP Rule Execution Log
Tracks execution of follow-up rules to ensure idempotency.

| Field | Type | Notes |
|---|---|---|
| `rule` | Link→SOP Follow-up Rule | |
| `source_run_item` | Link→SOP Run Item | Item that triggered the rule |
| `target_run` | Link→SOP Run | Run created by the rule |
| `executed_at` | Datetime | |
| `status` | Select | Success / Failed |

#### Pulse Notification
In-app notification system for alerts and updates.

| Field | Type | Notes |
|---|---|---|
| `recipient` | Link→Pulse Employee | |
| `title` | Data | |
| `body` | Small Text | |
| `notification_type` | Select | RunAlert / ItemFail / FollowUpCreated / System / Custom |
| `severity` | Select | Info / Warning / Critical |
| `priority` | Select | Low / Normal / High / Urgent |
| `source_doctype` | Data | Originating DocType |
| `source_name` | Data | Originating document name |
| `is_read` | Check | |
| `read_at` | Datetime | |

Auto-naming: `PNOT-#####`

---

## Scoring Logic

```
own_score = completed_items / total_items   (for period)

team_score = mean(combined_score of active direct reports with load)

combined_score:
  if team_score > 0 and own total_items > 0:  (own + team) / 2
  elif team_score > 0:                         team_score
  else:                                        own_score
```

Scores propagate **bottom-up**: leaf employees have `team_score = 0`, combined = own.
Each level's combined_score feeds its manager's team_score.

Score brackets used in insights distribution histogram:

| Bracket | Range |
|---|---|
| Exceptional | ≥ 90% |
| Strong | 80–89% |
| Moderate | 60–79% |
| At Risk | 40–59% |
| Critical | < 40% |

---

## Permission Model

Five Frappe roles (created at install):

| Frappe Role | Business Role | Visibility scope |
|---|---|---|
| Pulse User | Operator | Own SOP Runs only |
| Pulse Manager | Supervisor | Own + direct reports |
| Pulse Leader | Area Manager | Full subtree (recursive) |
| Pulse Executive | Executive | Entire organisation |
| Pulse Admin | Admin | Everything (same as Administrator) |

Row-level conditions are registered in `hooks.py → permission_query_conditions`:

```python
permission_query_conditions = {
    "SOP Run": "pulse.api.permissions.sop_run_conditions",
    "Score Snapshot": "pulse.api.permissions.score_snapshot_conditions",
    "Corrective Action": "pulse.api.permissions.corrective_action_conditions",
    "Pulse Notification": "pulse.api.permissions.pulse_notification_conditions",
}
```

The condition functions (`permissions.py`) inject WHERE clauses into Frappe's list queries
based on the logged-in user's employee record and role.

---

## API (Whitelisted Methods)

All callable as `/api/method/pulse.api.<module>.<method>` with a valid Frappe session.

### `auth.py`
| Method | Purpose |
|---|---|
| `get_current_employee()` | Current user's Pulse Employee + role info. Returns synthetic admin profile for System Manager/Pulse Admin without an employee record |

### `tasks.py`
| Method | Purpose |
|---|---|
| `get_my_runs(date?)` | Today's SOP Runs for the current user |
| `get_runs_for_employee(employee, date?)` | Runs for a specific employee (manager access) |
| `get_run_details(run_name)` | Full run + all items for checklist runner |
| `update_run_item(run_item_name, status, notes?, numeric_value?, outcome?, failure_remark?)` | Toggle item Pending↔Completed. Validates ownership |
| `upload_run_item_evidence(run_item_name, file)` | Upload evidence file for a run item |
| `complete_run(run_name)` | Mark run Closed |

### `scores.py`
| Method | Purpose |
|---|---|
| `get_score_for_user(employee, date?, period_type?)` | Single employee score snapshot |
| `get_team_scores(manager_employee, date?, period_type?)` | Scores for direct reports |
| `get_all_team_scores(employee, date?, period_type?)` | Org-wide (Executive) or subtree (Area Manager) |
| `get_failure_analytics(manager_employee, date?)` | Top 5 most-missed tasks across subtree, last 30 days |

### `operations.py`
| Method | Purpose |
|---|---|
| `get_operations_overview(top_employee, date?, period_type?)` | Full hierarchy tree with scores. Recursive. |
| `get_user_run_breakdown(employee, date?, period_type?)` | Runs grouped by template for the ScoreBreakdown sheet |
| `get_hierarchy_breakdown(top_employee, date?, period_type?)` | Full hierarchy with per-user breakdown (heavy) |

### `insights.py`
All accept `department`, `branch`, `employee` filters. Scope is enforced by role.

| Method | Returns |
|---|---|
| `get_insight_departments()` | List of department names |
| `get_insight_branches()` | Distinct branches in scope |
| `get_score_trends(start?, end?, period_type?, ...)` | `[{date, avg_score, employee_count}]` |
| `get_department_comparison(date?, period_type?, ...)` | `[{department, avg_score, headcount}]` |
| `get_branch_comparison(date?, period_type?, ...)` | `[{branch, avg_score, headcount}]` |
| `get_top_bottom_performers(date?, period_type?, limit?, ...)` | `{top: [...], bottom: [...]}` |
| `get_template_performance(start?, end?, ...)` | Completion rate per SOP template |
| `get_completion_trend(start?, end?, ...)` | Daily `{date, completed, total, rate}` |
| `get_corrective_action_summary(...)` | `{by_status, by_priority, avg_resolution_hours}` |
| `get_day_of_week_heatmap(start?, end?, ...)` | `[{day_name, day_num, avg_rate}]` |
| `get_score_distribution(date?, period_type?, ...)` | `[{bracket, count}]` histogram |
| `get_most_missed_items(start?, end?, limit?, ...)` | `[{checklist_item, template_title, department, misses}]` |
| `get_employees_by_department(department, date?, period_type?)` | Employees + scores for a department |
| `get_employees_by_branch(branch, date?, period_type?)` | Employees + scores for a branch |

### `templates.py`
| Method | Purpose |
|---|---|
| `get_all_templates()` | List all active SOP Templates |
| `get_template_items(template_name)` | Ordered checklist items for a template |

### `go.py`
| Method | Purpose |
|---|---|
| `get_home_summary()` | Pulse Go home: open runs today, overdue open runs, team open (Redis-cached per employee + date key) |

### `notifications.py`
| Method | Purpose |
|---|---|
| `get_my_notifications(limit?, unread_only?)` | Notifications for the current employee |
| `mark_notification_read(name)` | Mark one notification read |
| `mark_all_read()` | Mark all read |

### `demo.py`
| Method | Purpose |
|---|---|
| `get_demo_status()` | Whether current user can load/clear demo and whether demo exists |
| `install_demo_data(enqueue?)` | Load demo data (admin only, optionally background) |
| `clear_demo_data()` | Remove all demo data (admin only) |

---

## Caching (Redis + browser)

### Server (`@redis_cache`)

Repeated reads hit Redis for the TTL. Cleared via `pulse.api.pulse_cache.clear_pulse_api_redis_caches()`.

| Symbol | Module | TTL | Role |
|---|---:|---|---|
| `_calculate_score_snapshot` | `scores.py` | 120s | Per-employee score snapshot computation |
| `_failure_analytics_cached` | `scores.py` | 240s | Failure analytics payload |
| `_fetch_runs_for_employee_raw` | `tasks.py` | 60s | Runs for employee + date |
| `_pulse_home_summary_cached` | `go.py` | 90s | Go home headline counts |

**Doc events:** `hooks.py` registers `pulse.api.pulse_cache_invalidate.on_sop_run_saved` and `on_sop_run_item_saved` on **SOP Run** and **SOP Run Item** `on_update` to clear these caches after checklist edits.

**Insights** methods take complex filters; they rely on DB/`Score Snapshot` and client-side React Query bundling (`staleTime` 120s), not `@redis_cache` on each endpoint.

### Client (TanStack React Query)

`QueryClientProvider` in `App.tsx` uses defaults from `src/lib/queryClient.ts` (`staleTime` 60s, `gcTime` 10m, refetch on window focus). Keys live in `pulseQueryKeys`. Closing **ChecklistRunner** invalidates `myRuns`, dashboard queries, and Go home summary.

---

## Scheduler Tasks

Registered in `hooks.py → scheduler_events`:

| Frequency | Function | What it does |
|---|---|---|
| `all_15_minutes` | `pulse.tasks.every_quarter_hour` | TimeOfDay + Interval run generation (15-min window) |
| `daily` | `pulse.tasks.daily` | CalendarDay runs + `lock_overdue_runs()` |
| `hourly` | `pulse.tasks.hourly` | `cache_score_snapshots()` — upsert today's Score Snapshot for all employees |
| `weekly` | `pulse.tasks.weekly` | `generate_weekly_runs()` — creates runs on Mondays only |
| `monthly` | `pulse.tasks.monthly` | `generate_monthly_runs()` — creates runs on the 1st only |

**generate_*_runs:** reads all active `SOP Assignment` records where the linked template
matches the frequency. For each assignment, creates one `SOP Run` if none exists yet for
that (template, employee, date/period) triple.

**TimeOfDay runs:** Match window `(schedule_time, schedule_time + 15m]`. Uses `schedule_days_of_week`
to determine which days to generate. Unique key: `(template, employee, period_datetime)`.

**Interval runs:** Creates runs every N minutes based on `interval_minutes`.

**lock_overdue_runs:** Finds all `Open` runs where `period_datetime + grace_minutes < now`
(or calendar-day rule if no period_datetime). Sets all `Pending` items to `Missed`, sets
run status to `Locked`.

**cache_score_snapshots:** Calls `_calculate_score_snapshot()` for every active employee
and upserts the `Score Snapshot` DocType. Live calculation is still used for API calls
(snapshots are a read-optimisation for Insights SQL queries).

---

## Frontend Pages & Routes

Base path: `/pulse` (configured via `website_route_rules` in `hooks.py`)

| Route | Page | Role access | Purpose |
|---|---|---|---|
| `/` | `Dashboard.tsx` | All | Own score gauge, today's run summary, failure analytics |
| `/tasks` | `MyTasks.tsx` | All | Today's SOP Runs; tap to open checklist runner |
| `/operator` | — | — | Redirects to `/go/checklists` |
| `/go` | `GoHomePage.tsx` | All | Pulse Go: snapshot counts (cached API + React Query) |
| `/go/checklists` | `GoChecklistsPage.tsx` | All | Today’s runs; shares `myRuns` query key with desk **My Tasks** |
| `/go/alerts` | `GoAlertsPage.tsx` | All | In-app notifications |
| `/go/me` | `GoMePage.tsx` | All | Operator profile stub |
| `/team` | `Team.tsx` | Manager+ | Direct reports with scores and status |
| `/operations` | `Operations.tsx` | Leader+ | Full org tree; date/period picker; drill by node |
| `/operations/:userId` | `UserProfile.tsx` | Leader+ | Per-employee detail: runs, scores, charts |
| `/insights` | `Insights.tsx` | Leader+ | Analytics: trends, heatmap, distribution, top/bottom |
| `/templates` | `Templates.tsx` | All | SOP template catalog; printable checklists |

### Key Components

| Component | Location | Purpose |
|---|---|---|
| `AppLayout` | `components/layout/` | Sidebar + topbar shell, theme toggle |
| `OperatorLayout` | `components/layout/` | Simplified layout for operator mode |
| `PulseGoLayout` | `components/layout/` | Pulse Go routes: tab bar + outlet |
| `GoTabBar` | `components/layout/` | Bottom navigation for Go |
| `Sidebar` | `components/layout/` | Role-aware nav links |
| `Gauge` | `components/shared/` | SVG needle gauge, `requestAnimationFrame` animation |
| `ScoreBreakdown` | `components/shared/` | Slide-over sheet showing run breakdown by template |
| `InsightsFilters` | `components/insights/` | Department / branch / employee / date filter bar |
| `RunCard` | `components/tasks/` | Shows progress (indigo) and score (green/amber/red) |
| `ChecklistRunner` | `components/tasks/` | Handles proof capture and Pass/Fail outcomes |

### Data flow

```
frappe-js-sdk (lib/frappe-sdk.ts)
    ↓
services/*.ts  →  pulse.api.*  (whitelisted Frappe methods)
    ↓
TanStack Query (lib/queryClient.ts, pulseQueryKeys) — staleTime / invalidation
    ↓
React pages / components
```

`AuthContext.tsx` wraps the app and calls `get_current_employee()` on mount.
Unauthenticated users are redirected to the Frappe login page.

---

## Data Flow Diagram

```
                    ┌─────────────────────────────────┐
                    │        Frappe Scheduler          │
                    │  all_15_min / daily / hourly /   │
                    │  weekly / monthly                │
                    └──────────────┬──────────────────┘
                                   │ generates
                    ┌──────────────▼──────────────────┐
  SOP Template ───► │           SOP Run                │ ◄─── SOP Assignment
  (checklist)       │  Open → Closed (by employee)     │      (template × employee)
                    │        → Locked (overdue)        │
                    └──────────────┬──────────────────┘
                                   │ contains
                    ┌──────────────▼──────────────────┐
                    │         SOP Run Item             │
                    │  Pending → Completed / Missed    │
                    │  → NotApplicable                 │
                    └──────────────┬──────────────────┘
                                   │ aggregated by
                    ┌──────────────▼──────────────────┐
                    │        Score Snapshot            │
                    │  own / team / combined (0–1)     │
                    └──────────────┬──────────────────┘
                                   │ rolled up
                    ┌──────────────▼──────────────────┐
                    │      Pulse Employee hierarchy    │
                    │  Operator → Supervisor → AM →   │
                    │  Executive                       │
                    └──────────────┬──────────────────┘
                                   │ consumed by
                    ┌──────────────▼──────────────────┐
                    │        React SPA                 │
                    │  Dashboard / Operations /        │
                    │  Insights / MyTasks / Team       │
                    │  / Operator                      │
                    └─────────────────────────────────┘
```

---

## Bench Commands

```bash
# Demo data
bench --site pulse.localhost pulse-load-demo
bench --site pulse.localhost pulse-clear-demo

# Or via execute
bench --site pulse.localhost execute pulse.demo.seed.seed_demo_data
bench --site pulse.localhost execute pulse.demo.seed.clear_demo_data

# Run scheduler tasks manually
bench --site pulse.localhost execute pulse.tasks.daily
bench --site pulse.localhost execute pulse.tasks.generate_daily_runs
bench --site pulse.localhost execute pulse.tasks.lock_overdue_runs
bench --site pulse.localhost execute pulse.tasks.cache_score_snapshots

# Check data counts
bench --site pulse.localhost mariadb -e "
  SELECT 'Pulse Employee' as t, COUNT(*) FROM \`tabPulse Employee\`
  UNION ALL SELECT 'SOP Template', COUNT(*) FROM \`tabSOP Template\`
  UNION ALL SELECT 'SOP Assignment', COUNT(*) FROM \`tabSOP Assignment\`
  UNION ALL SELECT 'SOP Run', COUNT(*) FROM \`tabSOP Run\`
  UNION ALL SELECT 'SOP Run Item', COUNT(*) FROM \`tabSOP Run Item\`
  UNION ALL SELECT 'Score Snapshot', COUNT(*) FROM \`tabScore Snapshot\`
  UNION ALL SELECT 'Corrective Action', COUNT(*) FROM \`tabCorrective Action\`;"
```

---

## Demo Data

See `pulse/demo/README.md` for the full account table.

| DocType | Count | Notes |
|---|---|---|
| User | 19 | All with `Demo@123` |
| Pulse Role | 4 | Operator · Supervisor · Area Manager · Executive |
| Pulse Department | 7 | Kitchen · Front-of-House · Procurement · Finance · Operations · Management · Security |
| Pulse Employee | 19 | Full 4-level hierarchy across 3 branches + HQ |
| SOP Template | 6 | 5 daily + 1 weekly |
| SOP Checklist Item | 22 | Embedded in templates |
| SOP Assignment | 12 | Template × employee pairs |
| SOP Run | ~400 | 40 days of history (relative window ending yesterday) |
| SOP Run Item | ~1 500 | Per-step outcomes |
| Score Snapshot | ~390 | Daily aggregates |
| Corrective Action | 18 | Varied status/priority |

**Org hierarchy (QSR chain):**

```
Ramesh Agarwal (Chairman · Executive · HQ)
└── Priya Sharma (MD · Executive · HQ)
    ├── Vikram Patel (RM North · Area Manager · North Region)
    │   ├── Rahul Nair (BM N1 · Supervisor · Branch N1)
    │   │   └── Kavitha Raj (Sup N1 · Supervisor · Branch N1)
    │   │       ├── Arun Bhat   (Chef N1 · Operator · Branch N1)
    │   │       ├── Pooja Reddy (Chef N2 · Operator · Branch N2)
    │   │       ├── Ravi Verma  (Cashier N1 · Operator · Branch N1)
    │   │       └── Mohan Das   (Cleaner N1 · Operator · Branch N1)
    │   └── Meera Iyer (BM N2 · Supervisor · Branch N2)
    │       └── Deepak Singh (Sup N2 · Supervisor · Branch N2)
    │           └── Neha Gupta (Cashier N2 · Operator · Branch N2)
    ├── Anita Das (RM South · Area Manager · South Region)
    │   └── Suresh Kumar (BM S1 · Supervisor · Branch S1)
    │       └── Lakshmi Menon (Sup S1 · Supervisor · Branch S1)
    │           ├── Sunita Devi (Cleaner S1 · Operator · Branch S1)
    │           └── Vijay Singh (Driver · Operator · Branch S1)
    ├── Rajesh Mehta  (Purchase · Operator · HQ)
    └── Anjali Kapoor (Finance · Operator · HQ)
```

---

## Install Flow

1. `bench get-app pulse <repo>`
2. `bench --site <site> install-app pulse`
3. `after_install` fires → creates 5 system roles, 4 Pulse Role records, 3 default departments
4. Setup wizard prompts to optionally load demo data (`setup_wizard_complete` → `pulse.setup.setup_wizard.setup_demo`)
5. Or post-install: `bench --site <site> pulse-load-demo`

---

## Skills Directory

This repository includes a `.agents/skills/` directory containing structured
knowledge for AI agents working on the Pulse codebase.

### Available Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `pulse-admin` | Org management (branches, employees, departments) | Creating/managing organizational structure |
| `browserless-testing` | Docker browser automation | Testing UI when local Chrome fails |
| `frappe-pulse-dev` | Full development guide | Building features, fixing bugs, general dev |

### Using Skills

1. Check `.agents/skills/<name>/SKILL.md` for detailed guidance
2. Skills contain API patterns, code examples, and troubleshooting
3. Each skill has `scripts/`, `references/`, and `assets/` as needed

### Skill Locations (in priority order)

- **Project level:** `.agents/skills/` (this repo)
- **User level:** `~/.config/agents/skills/` or `~/.kimi/skills/`

Consult relevant skills before making changes — they capture patterns
and gotchas from previous development sessions.

---

## Testing with Browserless (Docker)

When running in a Docker environment, the standard Playwright browser launch may fail due to sandbox restrictions. Use the **browserless** service via REST API instead.

### Docker Compose Setup

```yaml
browserless:
  image: ghcr.io/browserless/chromium:latest
  ports:
    - 3000:3000
  environment:
    - CONNECTION_TIMEOUT=60000
    - MAX_CONCURRENT_SESSIONS=10
    - TOKEN=123  # Optional authentication
```

### Connection Details

| Property | Value |
|----------|-------|
| **Internal URL** | `http://192.168.97.1:3000` (host IP from container) |
| **Health Check** | `http://192.168.97.1:3000/pressure?token=123` |
| **Token** | `123` (if configured) |

> Note: The hostname `browserless` is not resolvable from within the container due to Docker DNS limitations. Use the host IP `192.168.97.1` instead.

### Screenshot API

```bash
# Basic screenshot
curl -X POST "http://192.168.97.1:3000/screenshot?token=123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://192.168.97.5:8001/pulse",
    "waitFor": 3000,
    "viewport": {"width": 1400, "height": 900}
  }' \
  --output screenshot.png

# With session cookies (logged-in pages)
curl -X POST "http://192.168.97.1:3000/screenshot?token=123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://192.168.97.5:8001/pulse/admin/branches",
    "cookies": [
      {"name": "sid", "value": "<session_id>", "domain": "192.168.97.5", "path": "/"},
      {"name": "system_user", "value": "yes", "domain": "192.168.97.5", "path": "/"}
    ],
    "waitFor": 4000,
    "viewport": {"width": 1400, "height": 900}
  }'
```

### Content API (HTML)

```bash
curl -X POST "http://192.168.97.1:3000/content?token=123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://192.168.97.5:8001/pulse",
    "viewport": {"width": 1280, "height": 720}
  }'
```

### Function API (Custom Scripts)

```bash
curl -X POST "http://192.168.97.1:3000/function?token=123" \
  -H "Content-Type: application/javascript" \
  -d 'module.exports = async ({ page }) => {
    await page.goto("http://192.168.97.5:8001/pulse");
    await page.fill("#login_email", "chairman@pm.local");
    await page.fill("#login_password", "Demo@123");
    await page.click(".btn-login");
    await page.waitForTimeout(3000);
    return { url: page.url(), title: await page.title() };
  };'
```

### Demo Login Credentials

| Email | Password | Role |
|-------|----------|------|
| `chairman@pm.local` | `Demo@123` | Executive |
| `md@pm.local` | `Demo@123` | Executive |
| `rm.north@pm.local` | `Demo@123` | Area Manager |
| `bm.n1@pm.local` | `Demo@123` | Supervisor |
| `chef.n1@pm.local` | `Demo@123` | Operator |

---

## Phase 7: Data Import/Export & Advanced Features

**Status:** 🔄 Planned

This phase adds comprehensive data import/export capabilities and advanced UI/UX features.

### Phase 7 Features

| Feature | Description | Status |
|---------|-------------|--------|
| Import/Export APIs | Backend APIs for bulk data import/export | Planned |
| Import Templates | CSV/Excel templates for data migration | Planned |
| Export Reports | PDF, Excel, CSV export for insights | Planned |
| Follow-up Rules Management | UI for managing SOP Follow-up Rules | Planned |
| Theme Toggle | Light/Dark mode switch | Planned |
| Desktop Notifications | Browser-based notifications | Planned |

### Phase 7 APIs

#### `import_export.py` (Planned)

| Method | Purpose |
|---|---|
| `import_data(doctype, data, format?)` | Import data from CSV/Excel |
| `export_data(doctype, filters?, format?)` | Export data to CSV/Excel |
| `get_import_template(doctype)` | Download import template |
| `validate_import_data(doctype, data)` | Validate data before import |

#### `reports.py` (Planned)

| Method | Purpose |
|---|---|
| `export_insights_report(report_type, format, filters?)` | Export insights as PDF/Excel/CSV |
| `generate_pdf_report(report_config)` | Generate PDF report |
| `schedule_report(report_config, schedule)` | Schedule automated report delivery |

### Phase 7 Frontend Routes

| Route | Page | Purpose |
|---|---|---|
| `/admin/import` | `DataImport.tsx` | Import data from CSV/Excel |
| `/admin/export` | `DataExport.tsx` | Export data and reports |
| `/admin/follow-up-rules` | `FollowUpRules.tsx` | Manage SOP Follow-up Rules |
| `/settings` | `Settings.tsx` | User settings including theme toggle |

### Phase 7 Components

| Component | Location | Purpose |
|---|---|---|
| `ThemeToggle` | `components/shared/` | Light/dark mode switch |
| `NotificationManager` | `components/shared/` | Desktop notification handler |
| `DataImporter` | `components/admin/` | CSV/Excel upload and preview |
| `FollowUpRuleEditor` | `components/admin/` | CRUD for SOP Follow-up Rules |
| `ReportExporter` | `components/insights/` | Export controls for reports |

---

## Testing Status

### Current Test Results

**Regression Testing:** 12/13 tests passing

```
✅ Login: chairman@pm.local
✅ Get Branches
✅ Get Employees  
✅ Get Departments
✅ Get Assignments
✅ Get Assignment Options
✅ Get Corrective Actions
✅ Get CA Summary
✅ Get System Settings (fixed - was syntax error)
❌ Get Roles - Status: 500
✅ Global Search
✅ Quick Actions
✅ Get Employee Hierarchy
```

### Known Issues
1. `get_roles` API returns 500 - needs debugging
2. Pulse Settings DocType doesn't exist - API returns defaults

---

## Open Items

- [ ] Phase 7: Data Import/Export & Advanced Features
- [ ] Real-time run updates (WebSocket / Server-Sent Events)
- [ ] AI failure prediction from historical trends
- [ ] Offline PWA with sync on reconnect
- [ ] End-to-end test suite
