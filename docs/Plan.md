# Pulse — Full Frappe Implementation Plan

> **Goal**: Convert the working React PoC (mock data + local state) into a production-grade Frappe v16 application with proper DocTypes, permissions, whitelisted APIs, Frappe session auth, and a React frontend consuming real data via `frappe-js-sdk`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Structure](#2-module-structure)
3. [DocType Definitions](#3-doctype-definitions)
4. [Roles & Permissions](#4-roles--permissions)
5. [Backend API (Whitelisted Methods)](#5-backend-api-whitelisted-methods)
6. [Scheduled Tasks](#6-scheduled-tasks)
7. [Frontend Integration](#7-frontend-integration)
8. [Migration & Seed Data](#8-migration--seed-data)
9. [Task Breakdown](#9-task-breakdown)
10. [Progress Tracker](#10-progress-tracker)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  React Frontend (Vite + Tailwind + Shadcn)               │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐       │
│  │  Pages      │  │ Components │  │ Services     │       │
│  │  Dashboard  │  │ Gauge      │  │ (frappe-js   │       │
│  │  MyTasks    │  │ ScoreBreak │  │   -sdk)      │       │
│  │  MyTeam     │  │ Layout     │  │              │       │
│  │  Operations │  │            │  │  db.getDoc() │       │
│  │  Templates  │  │            │  │  call.post() │       │
│  │  UserProfile│  │            │  │  auth.*      │       │
│  └────────────┘  └────────────┘  └──────┬───────┘       │
│                                          │ HTTP/Cookie   │
└──────────────────────────────────────────┼───────────────┘
                                           │
┌──────────────────────────────────────────┼───────────────┐
│  Frappe v16 Backend                      │               │
│  ┌───────────────────────────────────────▼─────────┐     │
│  │  API Layer (whitelisted methods)                 │     │
│  │  pulse.api.dashboard                     │     │
│  │  pulse.api.tasks                         │     │
│  │  pulse.api.scores                        │     │
│  │  pulse.api.operations                    │     │
│  └─────────────────────┬───────────────────────────┘     │
│                        │                                  │
│  ┌─────────────────────▼───────────────────────────┐     │
│  │  DocTypes (ORM)                                  │     │
│  │  PM Employee  │  SOP Template  │  SOP Run        │     │
│  │  SOP Item     │  SOP Assignment│  SOP Run Item   │     │
│  │  Score Snapshot│ Corrective Action               │     │
│  └─────────────────────┬───────────────────────────┘     │
│                        │                                  │
│  ┌─────────────────────▼───────────────────────────┐     │
│  │  Scheduler                                       │     │
│  │  daily: generate_daily_runs, lock_overdue_runs   │     │
│  │  hourly: cache_score_snapshots                   │     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

**Key Decisions**:
- Use Frappe's `User` doctype for authentication; create a **PM Employee** doctype to hold org-specific fields (role, branch, reports-to hierarchy).
- Score calculation is **server-side** via whitelisted API, optionally cached in **Score Snapshot** for performance.
- All business logic (score rollups, hierarchy traversal) lives in Python, not in the frontend.
- Frontend talks to backend exclusively through `frappe-js-sdk` — no direct DB access.

---

## 2. Module Structure

The Frappe app will have **two modules** for clean separation:

```
process_meter/
├── process_meter/
│   ├── __init__.py
│   ├── hooks.py
│   ├── modules.txt              # "Pulse\nPulse Setup"
│   ├── patches.txt
│   │
│   ├── process_meter/           # Module: "Pulse" (core operations)
│   │   ├── doctype/
│   │   │   ├── sop_template/
│   │   │   ├── sop_checklist_item/    (child table)
│   │   │   ├── sop_assignment/
│   │   │   ├── sop_run/
│   │   │   ├── sop_run_item/          (child table)
│   │   │   ├── score_snapshot/
│   │   │   └── corrective_action/
│   │   └── report/                    (future: built-in reports)
│   │
│   ├── pulse_setup/                # Module: "Pulse Setup" (config & org structure)
│   │   └── doctype/
│   │       ├── pm_employee/
│   │       └── pm_department/
│   │
│   ├── api/                     # Whitelisted API endpoints
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── tasks.py
│   │   ├── scores.py
│   │   ├── operations.py
│   │   └── templates.py
│   │
│   └── tasks.py                 # Scheduler jobs (cron)
│
└── frontend/                    # React app (existing)
```

---

## 3. DocType Definitions

### 3.1 PM Employee

> Links a Frappe `User` to org structure. This is the backbone of the hierarchy.

| Field               | Type        | Options / Notes                              | Required |
| ------------------- | ----------- | -------------------------------------------- | -------- |
| `employee_name`     | Data        | Full name (auto from linked user)            | Yes      |
| `user`              | Link        | `User` — Frappe login identity               | Yes      |
| `pulse_role`           | Select      | `Operator, Supervisor, Area Manager, Executive` | Yes   |
| `branch`            | Data        | e.g. "Branch 1", "Region North"              | No       |
| `department`        | Link        | `PM Department`                              | No       |
| `reports_to`        | Link        | `PM Employee` — the manager                  | No       |
| `is_active`         | Check       | Default 1                                    | Yes      |
| `avatar_url`        | Attach Image| Profile photo                                | No       |

**Naming**: `employee_name` (autoname: `field:employee_name` or `format:PM-EMP-{####}`)

**Key Behaviours**:
- `validate()`: Ensure no circular `reports_to` chain.
- `on_update()`: Clear score cache for changed hierarchy paths.
- Virtual field `subordinates` — not stored, computed on read via API.

---

### 3.2 PM Department

> Simple master data for departments/areas.

| Field          | Type   | Options / Notes             | Required |
| -------------- | ------ | --------------------------- | -------- |
| `department_name` | Data | e.g. "Operations", "Security" | Yes    |
| `description`  | Small Text | Optional notes             | No       |
| `is_active`    | Check  | Default 1                   | Yes      |

**Naming**: `field:department_name`

---

### 3.3 SOP Template

> Master definition of a standard operating procedure checklist.

| Field             | Type        | Options / Notes                              | Required |
| ----------------- | ----------- | -------------------------------------------- | -------- |
| `title`           | Data        | e.g. "Morning Store Prep"                    | Yes      |
| `department`      | Link        | `PM Department`                              | No       |
| `frequency_type`  | Select      | `Daily, Weekly, Monthly, Custom`             | Yes      |
| `owner_role`      | Select      | `Operator, Supervisor, Area Manager, Executive` | No    |
| `active_from`     | Date        | When this template becomes effective         | Yes      |
| `active_to`       | Date        | Optional end date                            | No       |
| `is_active`       | Check       | Default 1                                    | Yes      |
| `checklist_items` | Table       | `SOP Checklist Item` (child)                 | Yes      |

**Naming**: `format:SOP-TMPL-{####}`

---

### 3.4 SOP Checklist Item (Child Table)

> Individual task within an SOP Template. Stored as rows inside `SOP Template.checklist_items`.

| Field               | Type     | Options / Notes                            | Required |
| ------------------- | -------- | ------------------------------------------ | -------- |
| `description`       | Data     | The task instruction text                  | Yes      |
| `sequence`          | Int      | Ordering (10, 20, 30...)                   | Yes      |
| `weight`            | Float    | Scoring weight (default 1.0)               | Yes      |
| `item_type`         | Select   | `Checkbox, Numeric, Photo`                 | Yes      |
| `evidence_required` | Select   | `None, Photo`                              | No       |

---

### 3.5 SOP Assignment

> Maps which employee is responsible for which template.

| Field        | Type   | Options / Notes           | Required |
| ------------ | ------ | ------------------------- | -------- |
| `template`   | Link   | `SOP Template`            | Yes      |
| `employee`   | Link   | `PM Employee`             | Yes      |
| `is_active`  | Check  | Default 1                 | Yes      |

**Naming**: `format:SOP-ASGN-{####}`

**Uniqueness**: Server-side validation — no duplicate active assignment for (employee, template).

---

### 3.6 SOP Run

> A specific instance of a template execution for a given period. Created by scheduler or manually.

| Field          | Type     | Options / Notes                             | Required |
| -------------- | -------- | ------------------------------------------- | -------- |
| `template`     | Link     | `SOP Template`                              | Yes      |
| `employee`     | Link     | `PM Employee`                               | Yes      |
| `period_date`  | Date     | The date/period this run covers             | Yes      |
| `status`       | Select   | `Open, Closed, Locked`                      | Yes      |
| `run_items`    | Table    | `SOP Run Item` (child)                      | Yes      |
| `total_items`  | Int      | Computed on save (read only)                | No       |
| `completed_items` | Int   | Computed on save (read only)                | No       |
| `progress`     | Percent  | Computed `(completed_items / total_items) * 100` (read only) | No |
| `closed_at`    | Datetime | Timestamp when run was closed               | No       |

**Naming**: `format:SOP-RUN-{#####}`

**Workflow**:
```
Open  →  Closed  (employee submits)
Open  →  Locked  (scheduler auto-locks overdue runs at end of day)
Closed →  Locked  (scheduler locks after grace period)
```

**Key Behaviours**:
- `validate()`: Only the assigned employee (or their manager) can modify.
- `on_update()`: Recalculate `total_items`, `completed_items`, `progress`.
- `before_save()`: If `status` changes to `Closed`, set `closed_at`.

---

### 3.7 SOP Run Item (Child Table)

> A single checklist item within an `SOP Run`. Stored as rows inside `SOP Run.run_items`.

| Field               | Type        | Options / Notes                           | Required |
| ------------------- | ----------- | ----------------------------------------- | -------- |
| `checklist_item`    | Data        | Reference to original SOP Checklist Item desc | Yes  |
| `weight`            | Float       | Copied from template item at run creation | Yes      |
| `item_type`         | Select      | `Checkbox, Numeric, Photo`                | Yes      |
| `status`            | Select      | `Pending, Completed, Missed`              | Yes      |
| `completed_at`      | Datetime    | When marked complete                      | No       |
| `numeric_value`     | Float       | For Numeric type items                    | No       |
| `notes`             | Small Text  | Optional comments by employee             | No       |
| `evidence`          | Attach Image| Photo proof upload                        | No       |
| `evidence_required` | Select      | `None, Photo` (copied from template)      | No       |

---

### 3.8 Score Snapshot

> Cached performance scores per employee per period. Recalculated by scheduler or on-demand.

| Field               | Type    | Options / Notes                           | Required |
| ------------------- | ------- | ----------------------------------------- | -------- |
| `employee`          | Link    | `PM Employee`                             | Yes      |
| `period_type`       | Select  | `Day, Week, Month`                        | Yes      |
| `period_key`        | Data    | e.g. `2026-03-12`, `2026-W11`, `2026-03` | Yes      |
| `own_score`         | Float   | 0.0 to 1.0                               | Yes      |
| `team_score`        | Float   | 0.0 to 1.0 (0 if no team)                | Yes      |
| `combined_score`    | Float   | 0.0 to 1.0                               | Yes      |
| `total_items`       | Int     | Total checklist items in period           | Yes      |
| `completed_items`   | Int     | Items marked completed                    | Yes      |
| `computed_at`       | Datetime| Last calculation timestamp                | Yes      |

**Naming**: `format:PM-SCORE-{#####}`

**Uniqueness**: Unique on `(employee, period_type, period_key)`. On recalculation, update existing record.

---

### 3.9 Corrective Action

> Tracks flagged failures and the corrective action loop.

| Field            | Type        | Options / Notes                          | Required |
| ---------------- | ----------- | ---------------------------------------- | -------- |
| `run`            | Link        | `SOP Run`                                | Yes      |
| `run_item_ref`   | Data        | Reference to specific missed item desc   | No       |
| `description`    | Small Text  | What went wrong / what needs fixing      | Yes      |
| `status`         | Select      | `Open, In Progress, Resolved, Closed`    | Yes      |
| `assigned_to`    | Link        | `PM Employee` — who must fix it          | Yes      |
| `raised_by`      | Link        | `PM Employee` — who flagged it           | No       |
| `priority`       | Select      | `Low, Medium, High, Critical`            | No       |
| `resolution`     | Small Text  | How it was resolved                      | No       |
| `resolved_at`    | Datetime    | When resolved                            | No       |
| `evidence`       | Attach Image| Resolution proof photo                   | No       |

**Naming**: `format:PM-CA-{#####}`

---

## 4. Roles & Permissions

### 4.1 Custom Roles

| Role               | Description                                       |
| ------------------ | ------------------------------------------------- |
| `PM User`          | Front-line worker (Cleaner equivalent). Executes checklists. |
| `PM Manager`       | Manages a branch/team. Views team scores, flags failures. |
| `PM Leader`        | Regional manager. Full operations view, template management. |
| `PM Executive`     | C-Suite. Full read access, org-wide analytics.    |
| `PM Admin`         | System admin. Full CRUD on all DocTypes.          |

### 4.2 Permission Matrix

| DocType            | PM User | PM Manager | PM Leader | PM Executive | PM Admin |
| ------------------ | ----------- | ------------- | --------------- | ------------ | -------- |
| PM Employee        | Read (own)  | Read (team)   | Read (region)   | Read (all)   | Full     |
| PM Department      | Read        | Read          | Read            | Read         | Full     |
| SOP Template       | Read        | Read          | Read + Write    | Read         | Full     |
| SOP Checklist Item | Read        | Read          | Read + Write    | Read         | Full     |
| SOP Assignment     | Read (own)  | Read (team)   | Read + Write    | Read         | Full     |
| SOP Run            | Read + Write (own) | Read (team) | Read (region) | Read (all) | Full |
| SOP Run Item       | Read + Write (own) | Read (team) | Read (region) | Read (all) | Full |
| Score Snapshot     | Read (own)  | Read (team)   | Read (region)   | Read (all)   | Full     |
| Corrective Action  | Read (own)  | Read + Write  | Read + Write    | Read         | Full     |

### 4.3 Row-Level Security

Implemented via `permission_query_conditions` in `hooks.py`:

- **PM User**: Can only see their own `SOP Run`, `Score Snapshot`, and `Corrective Action` docs.
- **PM Manager**: Can see docs belonging to their direct subordinates.
- **PM Leader**: Can see docs for all employees under their region subtree.
- **PM Executive**: Can see all docs.

```python
# hooks.py (excerpt)
permission_query_conditions = {
    "SOP Run": "pulse.api.permissions.sop_run_conditions",
    "Score Snapshot": "pulse.api.permissions.score_snapshot_conditions",
    "Corrective Action": "pulse.api.permissions.corrective_action_conditions",
}
```

---

## 5. Backend API (Whitelisted Methods)

Each API module provides a focused set of endpoints. All decorated with `@frappe.whitelist()`.

### 5.1 `pulse.api.auth`

| Method                  | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `get_current_employee`  | Returns the `PM Employee` record for the logged-in user, including role, branch, reports_to. |

```python
@frappe.whitelist()
def get_current_employee():
    user = frappe.session.user
    emp = frappe.db.get_value("Pulse Employee",
        {"user": user, "is_active": 1},
        ["name", "employee_name", "pulse_role", "branch", "reports_to", "avatar_url", "department"],
        as_dict=True
    )
    if not emp:
        frappe.throw("No active PM Employee record found for this user.")
    return emp
```

### 5.2 `pulse.api.tasks`

| Method               | Params                          | Description                              |
| -------------------- | ------------------------------- | ---------------------------------------- |
| `get_my_runs`        | `date`                          | Get all SOP Runs for current user on date. Returns run + template + progress. |
| `get_run_details`    | `run_name`                      | Full run with all items for the checklist runner sheet. |
| `update_run_item`    | `run_item_name, status, notes?, evidence?, numeric_value?` | Toggle item Pending/Completed. Validates ownership. |
| `complete_run`       | `run_name`                      | Mark run as Closed. Validates all required evidence attached. |

### 5.3 `pulse.api.scores`

| Method                  | Params                              | Description                              |
| ----------------------- | ----------------------------------- | ---------------------------------------- |
| `get_score_for_user`    | `employee, date, period_type`       | Calculate or return cached score snapshot for one employee. |
| `get_team_scores`       | `manager_employee, date, period_type` | Scores for all direct reports of a manager. |
| `get_failure_analytics` | `manager_employee, date`            | Top 5 most-missed tasks across the manager's subtree (last 30 days). |

**Score Calculation Logic** (ported from `api/index.ts`):
1. Get all `SOP Run` records for `employee` in the date range determined by `period_type`.
2. Count total items and completed items across all runs → `own_score`.
3. Recursively calculate `combined_score` for all subordinates → `team_score`.
4. `combined_score = avg(own_score, team_score)` if both exist, else whichever is available.

### 5.4 `pulse.api.operations`

| Method                    | Params                              | Description                              |
| ------------------------- | ----------------------------------- | ---------------------------------------- |
| `get_operations_overview` | `top_employee, date, period_type`   | Build the full hierarchy tree with scores for the Operations page. |
| `get_user_run_breakdown`  | `employee, date, period_type`       | Detailed run breakdown grouped by template for the ScoreBreakdown sheet. |
| `get_hierarchy_breakdown` | `top_employee, date, period_type`   | Full hierarchy with per-user breakdown (heavy endpoint, used for deep drill-down). |

### 5.5 `pulse.api.templates`

| Method               | Params             | Description                              |
| -------------------- | ------------------ | ---------------------------------------- |
| `get_all_templates`  | —                  | List all active SOP Templates (uses standard `db.getDocList` on frontend, but this provides extra fields). |
| `get_template_items` | `template_name`    | Ordered checklist items for a template.  |
| `create_template`    | `{...fields}`      | Create new SOP Template with items (Area Manager+ only). |

> **Note**: For simple CRUD (read template, read employee), the frontend can use `db.getDoc()` / `db.getDocList()` directly via `frappe-js-sdk`. Whitelisted methods are only needed for complex aggregation, score calculation, and hierarchy traversal.

---

## 6. Scheduled Tasks

Defined in `hooks.py` → `scheduler_events`:

### 6.1 Daily: `generate_daily_runs`

**Runs at**: 00:05 (start of day)

**Logic**:
1. Find all active `SOP Assignment` records where the linked `SOP Template` has `frequency_type = 'Daily'` and today is within `active_from` / `active_to`.
2. For each assignment, check if a `SOP Run` already exists for today.
3. If not, create a new `SOP Run` with `status = 'Open'` and populate `run_items` from the template's `checklist_items`.

### 6.2 Daily: `lock_overdue_runs`

**Runs at**: 23:55 (end of day)

**Logic**:
1. Find all `SOP Run` where `period_date < today` and `status = 'Open'`.
2. For each, mark any remaining `Pending` items as `Missed`.
3. Set run `status = 'Locked'`.

### 6.3 Hourly: `cache_score_snapshots`

**Logic**:
1. For all active `PM Employee` records, calculate the `Day` score for today.
2. Upsert into `Score Snapshot` with `period_key = today's date`.
3. Optionally also compute `Week` and `Month` snapshots.

### 6.4 Weekly: `generate_weekly_runs`

**Runs at**: Monday 00:05

Similar to daily but for `frequency_type = 'Weekly'` templates.

### 6.5 Monthly: `generate_monthly_runs`

**Runs at**: 1st of month 00:05

Similar to daily but for `frequency_type = 'Monthly'` templates.

---

## 7. Frontend Integration

### 7.1 Install `frappe-js-sdk`

```bash
cd frontend
npm install frappe-js-sdk
```

### 7.2 Create SDK Singleton

**`frontend/src/lib/frappe-sdk.ts`**:
```typescript
import { FrappeApp } from 'frappe-js-sdk';

const frappeUrl = import.meta.env.VITE_FRAPPE_URL || '';

export const frappe = new FrappeApp(frappeUrl);
export const auth = frappe.auth();
export const db = frappe.db();
export const call = frappe.call();
export const file = frappe.file();
```

### 7.3 Replace AuthContext

Replace the mock user-switching `AuthContext` with real Frappe session auth:

```typescript
// Simplified flow
const employee = await call.get('pulse.api.auth.get_current_employee');
setCurrentEmployee(employee.message);
```

- `currentUser` becomes `currentEmployee` (a `PM Employee` record).
- Remove mock user list / switch-user dropdown.
- Add login redirect if `frappe.session.user === 'Guest'`.

### 7.4 Create Service Layer

Replace `frontend/src/api/index.ts` (mock) with a real service layer:

```
frontend/src/services/
├── auth.ts          # get_current_employee
├── tasks.ts         # getMyRuns, getRunDetails, updateRunItem, completeRun
├── scores.ts        # getScoreForUser, getTeamScores, getFailureAnalytics
├── operations.ts    # getOperationsOverview, getUserRunBreakdown
└── templates.ts     # getAllTemplates, getTemplateItems
```

Each service file wraps `call.get()` / `call.post()` / `db.getDocList()` calls:

```typescript
// Example: services/tasks.ts
import { call, db } from '@/lib/frappe-sdk';

export async function getMyRuns(date: string) {
  const res = await call.get('pulse.api.tasks.get_my_runs', { date });
  return res.message;
}

export async function updateRunItem(
  runItemName: string,
  status: string,
  evidence?: File
) {
  const res = await call.post('pulse.api.tasks.update_run_item', {
    run_item_name: runItemName,
    status,
  });
  return res.message;
}
```

### 7.5 Update Types

Replace `frontend/src/types/index.ts` with types that match Frappe DocType field names (snake_case):

```typescript
export interface PMEmployee {
  name: string;
  employee_name: string;
  user: string;
  pulse_role: 'Operator' | 'Supervisor' | 'Area Manager' | 'Executive';
  branch?: string;
  department?: string;
  reports_to?: string;
  is_active: boolean;
  avatar_url?: string;
}

export interface SOPTemplate {
  name: string;
  title: string;
  department?: string;
  frequency_type: 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  owner_role?: string;
  active_from: string;
  active_to?: string;
  is_active: boolean;
  checklist_items: SOPChecklistItem[];
}

// ... etc for all DocTypes
```

### 7.6 Page-by-Page Migration

| Page         | Mock API Call                    | Frappe Replacement                                    |
| ------------ | -------------------------------- | ----------------------------------------------------- |
| Dashboard    | `api.getScoreForUser()`          | `call.get('pulse.api.scores.get_score_for_user', {...})` |
| Dashboard    | `api.getTeamScores()`            | `call.get('pulse.api.scores.get_team_scores', {...})` |
| Dashboard    | `api.getFailureAnalytics()`      | `call.get('pulse.api.scores.get_failure_analytics', {...})` |
| MyTasks      | `api.getMyRuns()`                | `call.get('pulse.api.tasks.get_my_runs', {...})` |
| MyTasks      | `api.getRunDetails()`            | `call.get('pulse.api.tasks.get_run_details', {...})` |
| MyTasks      | `api.updateRunItemStatus()`      | `call.post('pulse.api.tasks.update_run_item', {...})` |
| MyTasks      | `api.completeRun()`              | `call.post('pulse.api.tasks.complete_run', {...})` |
| MyTeam       | `api.getTeamScores()`            | `call.get('pulse.api.scores.get_team_scores', {...})` |
| Operations   | `api.getOperationsOverview()`    | `call.get('pulse.api.operations.get_operations_overview', {...})` |
| UserProfile  | multiple calls                   | Combination of score + task + team APIs               |
| Templates    | `api.getAllTemplates()`           | `db.getDocList('SOP Template', {...})` or custom API  |
| Templates    | `api.getTemplateItems()`         | `db.getDoc('SOP Template', name)` → read `checklist_items` child table |
| ScoreBreakdown | `api.getUserRunBreakdown()`    | `call.get('pulse.api.operations.get_user_run_breakdown', {...})` |

### 7.7 File Upload for Evidence

Use `frappe-js-sdk`'s `file.uploadFile()`:

```typescript
import { file } from '@/lib/frappe-sdk';

const uploadResponse = await file.uploadFile(
  selectedFile,
  {
    isPrivate: true,
    doctype: 'SOP Run',
    docname: runName,
    fieldname: 'evidence',
  }
);
```

The `evidence` field on `SOP Run Item` (type `Attach Image`) stores the uploaded file URL.

### 7.8 Vite Proxy Config

Update `vite.config.ts` to proxy API calls to the Frappe backend in development:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/assets': 'http://localhost:8000',
    },
  },
});
```

---

## 8. Migration & Seed Data

### 8.1 After Install Hook

Create `process_meter/install.py` with `after_install()` to:

1. Create the custom roles (`PM User`, `PM Manager`, `PM Leader`, `PM Executive`, `PM Admin`).
2. Create default `PM Department` entries (`Operations`, `Security`, `Management`).
3. Optionally create demo `PM Employee` records matching the PoC mock data.

### 8.2 Fixtures

Export roles and default department records as fixtures for portability:

```python
# hooks.py
fixtures = [
    {"dt": "Role", "filters": [["name", "like", "PM %"]]},
    {"dt": "Pulse Department"},
]
```

---

## 9. Task Breakdown

Tasks are organized in execution order. Each task is a small, atomic unit of work.

### Phase 1: Foundation (Backend DocTypes & Structure)

| #    | Task                                              | Est.  |
| ---- | ------------------------------------------------- | ----- |
| 1.1  | Add "Pulse Setup" module to `modules.txt`            | 5 min |
| 1.2  | Create `PM Department` DocType                    | 15 min|
| 1.3  | Create `PM Employee` DocType with all fields      | 30 min|
| 1.4  | Create `SOP Checklist Item` child DocType         | 15 min|
| 1.5  | Create `SOP Template` DocType with child table    | 30 min|
| 1.6  | Create `SOP Assignment` DocType                   | 15 min|
| 1.7  | Create `SOP Run Item` child DocType               | 20 min|
| 1.8  | Create `SOP Run` DocType with child table         | 30 min|
| 1.9  | Create `Score Snapshot` DocType                   | 20 min|
| 1.10 | Create `Corrective Action` DocType                | 20 min|
| 1.11 | Create custom roles (`PM User`, etc.)              | 15 min|
| 1.12 | Configure permissions on all DocTypes              | 30 min|
| 1.13 | Add row-level security (permission_query_conditions) | 30 min|

### Phase 2: Backend API

| #    | Task                                              | Est.  |
| ---- | ------------------------------------------------- | ----- |
| 2.1  | Create `api/__init__.py` package                  | 5 min |
| 2.2  | Implement `api/auth.py` — `get_current_employee`  | 15 min|
| 2.3  | Implement `api/tasks.py` — `get_my_runs`          | 30 min|
| 2.4  | Implement `api/tasks.py` — `get_run_details`      | 20 min|
| 2.5  | Implement `api/tasks.py` — `update_run_item`      | 30 min|
| 2.6  | Implement `api/tasks.py` — `complete_run`         | 20 min|
| 2.7  | Implement `api/scores.py` — `get_score_for_user` (recursive scoring engine) | 45 min|
| 2.8  | Implement `api/scores.py` — `get_team_scores`     | 20 min|
| 2.9  | Implement `api/scores.py` — `get_failure_analytics` | 30 min|
| 2.10 | Implement `api/operations.py` — `get_operations_overview` (hierarchy tree) | 45 min|
| 2.11 | Implement `api/operations.py` — `get_user_run_breakdown` | 30 min|
| 2.12 | Implement `api/operations.py` — `get_hierarchy_breakdown` | 30 min|
| 2.13 | Implement `api/templates.py` — template CRUD helpers | 20 min|
| 2.14 | Implement `api/permissions.py` — row-level query conditions | 30 min|

### Phase 3: Scheduler

| #    | Task                                              | Est.  |
| ---- | ------------------------------------------------- | ----- |
| 3.1  | Implement `tasks.py` — `generate_daily_runs`      | 30 min|
| 3.2  | Implement `tasks.py` — `lock_overdue_runs`        | 20 min|
| 3.3  | Implement `tasks.py` — `cache_score_snapshots`    | 30 min|
| 3.4  | Implement `tasks.py` — `generate_weekly_runs`     | 15 min|
| 3.5  | Implement `tasks.py` — `generate_monthly_runs`    | 15 min|
| 3.6  | Register all scheduler events in `hooks.py`       | 10 min|

### Phase 4: Frontend Integration

| #    | Task                                              | Est.  |
| ---- | ------------------------------------------------- | ----- |
| 4.1  | Install `frappe-js-sdk`, create `lib/frappe-sdk.ts` | 15 min|
| 4.2  | Update `vite.config.ts` with API proxy            | 10 min|
| 4.3  | Rewrite `types/index.ts` to match DocType schemas | 30 min|
| 4.4  | Create `services/auth.ts`                         | 15 min|
| 4.5  | Rewrite `store/AuthContext.tsx` for Frappe sessions | 30 min|
| 4.6  | Create `services/tasks.ts`                        | 20 min|
| 4.7  | Create `services/scores.ts`                       | 20 min|
| 4.8  | Create `services/operations.ts`                   | 20 min|
| 4.9  | Create `services/templates.ts`                    | 15 min|
| 4.10 | Migrate `Dashboard.tsx` to use real services       | 30 min|
| 4.11 | Migrate `MyTasks.tsx` + ChecklistRunner            | 30 min|
| 4.12 | Migrate `MyTeam.tsx`                               | 20 min|
| 4.13 | Migrate `Operations.tsx`                           | 25 min|
| 4.14 | Migrate `UserProfile.tsx`                          | 25 min|
| 4.15 | Migrate `Templates.tsx`                            | 20 min|
| 4.16 | Migrate `ScoreBreakdown.tsx`                       | 20 min|
| 4.17 | Add file upload to ChecklistRunner (evidence)      | 30 min|
| 4.18 | Delete `mock/db.ts` and old `api/index.ts`         | 5 min |

### Phase 5: Setup & Polish

| #    | Task                                              | Est.  |
| ---- | ------------------------------------------------- | ----- |
| 5.1  | Create `install.py` with `after_install` hook      | 30 min|
| 5.2  | Configure `hooks.py` — apps screen, fixtures, scheduler | 20 min|
| 5.3  | Seed demo data (departments, employees, templates, assignments) | 30 min|
| 5.4  | End-to-end testing — login, view dashboard, complete task, check scores | 60 min|
| 5.5  | Fix permissions edge cases / row-level bugs        | 30 min|
| 5.6  | Update `AGENTS.md` and `frontend/AGENT.MD` docs   | 15 min|

---

## 10. Progress Tracker

Copy this table into a working doc or issue tracker. Update status as you go.

| #     | Task                                           | Status      | Notes |
| ----- | ---------------------------------------------- | ----------- | ----- |
| **Phase 1: Foundation** | | | |
| 1.1   | Add "Pulse Setup" module                          | `done`      | |
| 1.2   | Create PM Department DocType                   | `pending`   | |
| 1.3   | Create PM Employee DocType                     | `pending`   | |
| 1.4   | Create SOP Checklist Item (child)              | `pending`   | |
| 1.5   | Create SOP Template DocType                    | `pending`   | |
| 1.6   | Create SOP Assignment DocType                  | `pending`   | |
| 1.7   | Create SOP Run Item (child)                    | `pending`   | |
| 1.8   | Create SOP Run DocType                         | `pending`   | |
| 1.9   | Create Score Snapshot DocType                  | `pending`   | |
| 1.10  | Create Corrective Action DocType               | `pending`   | |
| 1.11  | Create custom roles                            | `pending`   | |
| 1.12  | Configure permissions                          | `pending`   | |
| 1.13  | Row-level security                             | `pending`   | |
| **Phase 2: Backend API** | | | |
| 2.1   | Create api package                             | `pending`   | |
| 2.2   | api/auth.py                                    | `pending`   | |
| 2.3   | api/tasks.py — get_my_runs                     | `pending`   | |
| 2.4   | api/tasks.py — get_run_details                 | `pending`   | |
| 2.5   | api/tasks.py — update_run_item                 | `pending`   | |
| 2.6   | api/tasks.py — complete_run                    | `pending`   | |
| 2.7   | api/scores.py — recursive scoring              | `pending`   | |
| 2.8   | api/scores.py — get_team_scores                | `pending`   | |
| 2.9   | api/scores.py — get_failure_analytics          | `pending`   | |
| 2.10  | api/operations.py — hierarchy tree             | `pending`   | |
| 2.11  | api/operations.py — user run breakdown         | `pending`   | |
| 2.12  | api/operations.py — hierarchy breakdown        | `pending`   | |
| 2.13  | api/templates.py                               | `pending`   | |
| 2.14  | api/permissions.py                             | `pending`   | |
| **Phase 3: Scheduler** | | | |
| 3.1   | generate_daily_runs                            | `pending`   | |
| 3.2   | lock_overdue_runs                              | `pending`   | |
| 3.3   | cache_score_snapshots                          | `pending`   | |
| 3.4   | generate_weekly_runs                           | `pending`   | |
| 3.5   | generate_monthly_runs                          | `pending`   | |
| 3.6   | Register scheduler in hooks.py                 | `pending`   | |
| **Phase 4: Frontend Integration** | | | |
| 4.1   | Install frappe-js-sdk, create sdk singleton    | `pending`   | |
| 4.2   | Vite proxy config                              | `pending`   | |
| 4.3   | Rewrite types to match DocTypes                | `pending`   | |
| 4.4   | services/auth.ts                               | `pending`   | |
| 4.5   | Rewrite AuthContext for Frappe sessions         | `pending`   | |
| 4.6   | services/tasks.ts                              | `pending`   | |
| 4.7   | services/scores.ts                             | `pending`   | |
| 4.8   | services/operations.ts                         | `pending`   | |
| 4.9   | services/templates.ts                          | `pending`   | |
| 4.10  | Migrate Dashboard.tsx                          | `pending`   | |
| 4.11  | Migrate MyTasks.tsx                            | `pending`   | |
| 4.12  | Migrate MyTeam.tsx                             | `pending`   | |
| 4.13  | Migrate Operations.tsx                         | `pending`   | |
| 4.14  | Migrate UserProfile.tsx                        | `pending`   | |
| 4.15  | Migrate Templates.tsx                          | `pending`   | |
| 4.16  | Migrate ScoreBreakdown.tsx                     | `pending`   | |
| 4.17  | Add evidence file upload                       | `pending`   | |
| 4.18  | Delete mock/db.ts and old api/index.ts         | `pending`   | |
| **Phase 5: Setup & Polish** | | | |
| 5.1   | Create install.py after_install hook           | `pending`   | |
| 5.2   | Configure hooks.py fully                       | `pending`   | |
| 5.3   | Seed demo data                                 | `pending`   | |
| 5.4   | End-to-end testing                             | `pending`   | |
| 5.5   | Fix permissions edge cases                     | `pending`   | |
| 5.6   | Update documentation                           | `pending`   | |

---

**Total estimated effort**: ~20 hours across all phases.

**Recommended execution order**: Phase 1 → Phase 2 → Phase 3 → Phase 5.1–5.3 → Phase 4 → Phase 5.4–5.6

Start with the backend foundation so DocTypes exist before writing APIs against them, then wire up the frontend last when all endpoints are available to test against.
