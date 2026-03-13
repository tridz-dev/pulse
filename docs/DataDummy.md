# Dummy Data Seeding Plan

> Populate the Pulse app with realistic demo data so all pages (Dashboard, MyTasks, MyTeam, Operations, UserProfile, Templates) render with meaningful content and 30 days of historical execution data.

**Install with demo:** On first-time site setup, the Frappe setup wizard shows a **Pulse** slide with a **“Load demo data for Pulse”** checkbox; if checked, demo data is loaded when the wizard completes. For already-set-up sites you can use the in-app **"Load demo data"** button on the Dashboard (System Manager / PM Admin) or CLI (see below). Full plan: **[DEMO_DATA_INSTALL_PLAN.md](DEMO_DATA_INSTALL_PLAN.md)**.

---

## Prerequisites

- Site: `processwise.localhost`
- Bench: `/workspace/development/edge16`
- All DocTypes exist (confirmed via MCP schema check)
- System roles exist: `PM Admin`, `PM Executive`, `PM Leader`, `PM Manager`, `PM User`; default **PM Role** (business role) records exist: Operator, Supervisor, Area Manager, Executive
- Script runs as **Administrator**. Load demo via setup wizard (first-time) or CLI:
  - `bench --site <site> process-meter-load-demo`  
  - or `bench --site <site> execute pulse.seed.seed.seed_dummy_data`

---

## Data Model Summary

```
PM Department
  |
PM Employee (hierarchy via reports_to, linked to User)
  |
SOP Template --> SOP Checklist Item (child table)
  |
SOP Assignment (employee <-> template)
  |
SOP Run --> SOP Run Item (child table)
  |
Score Snapshot (per employee, per period)
  |
Corrective Action (linked to SOP Run)
```

---

## Step 1: Frappe Users (10 users)

Create 10 Frappe `User` records with password `admin`. Assign **system roles** (permission layer). Each user’s **PM Employee** record links to a **PM Role** (business role: Operator, Supervisor, Area Manager, Executive) for display.

| Email | Full Name | PM Role (business) | System role |
|-------|-----------|--------------------|-------------|
| `ceo@pm.local` | Rajan Mehta | Executive | PM Executive |
| `am.north@pm.local` | Priya Sharma | Area Manager | PM Leader |
| `am.south@pm.local` | Vikram Patel | Area Manager | PM Leader |
| `sup.n1@pm.local` | Anita Das | Supervisor | PM Manager |
| `sup.n2@pm.local` | Rahul Nair | Supervisor | PM Manager |
| `sup.s1@pm.local` | Meera Iyer | Supervisor | PM Manager |
| `op.n1a@pm.local` | Suresh Kumar | Operator | PM User |
| `op.n1b@pm.local` | Kavitha Raj | Operator | PM User |
| `op.n2a@pm.local` | Deepak Singh | Operator | PM User |
| `op.s1a@pm.local` | Lakshmi Menon | Operator | PM User |

All users also get `System Manager` temporarily to avoid permission issues during seeding.

---

## Step 2: PM Departments (3)

| department_name | description |
|-----------------|-------------|
| Operations | Housekeeping, cleaning, daily SOPs |
| Security | Facility security and access control |
| Management | Administrative and oversight functions |

---

## Step 3: PM Employees (10, with hierarchy)

```
Rajan Mehta (Executive)
├── Priya Sharma (Area Manager, North)
│   ├── Anita Das (Supervisor, Branch N1)
│   │   ├── Suresh Kumar (Operator, Branch N1)
│   │   └── Kavitha Raj (Operator, Branch N1)
│   └── Rahul Nair (Supervisor, Branch N2)
│       └── Deepak Singh (Operator, Branch N2)
└── Vikram Patel (Area Manager, South)
    └── Meera Iyer (Supervisor, Branch S1)
        └── Lakshmi Menon (Operator, Branch S1)
```

`pulse_role` is a **Link** to **PM Role** (values: Operator, Supervisor, Area Manager, Executive).

| employee_name | user | pulse_role (PM Role name) | branch | department | reports_to |
|---------------|------|------------------------|--------|------------|------------|
| Rajan Mehta | ceo@pm.local | Executive | HQ | Management | -- |
| Priya Sharma | am.north@pm.local | Area Manager | North Region | Management | Rajan Mehta |
| Vikram Patel | am.south@pm.local | Area Manager | South Region | Management | Rajan Mehta |
| Anita Das | sup.n1@pm.local | Supervisor | Branch N1 | Operations | Priya Sharma |
| Rahul Nair | sup.n2@pm.local | Supervisor | Branch N2 | Operations | Priya Sharma |
| Meera Iyer | sup.s1@pm.local | Supervisor | Branch S1 | Security | Vikram Patel |
| Suresh Kumar | op.n1a@pm.local | Operator | Branch N1 | Operations | Anita Das |
| Kavitha Raj | op.n1b@pm.local | Operator | Branch N1 | Operations | Anita Das |
| Deepak Singh | op.n2a@pm.local | Operator | Branch N2 | Operations | Rahul Nair |
| Lakshmi Menon | op.s1a@pm.local | Operator | Branch S1 | Security | Meera Iyer |

Create top-down (Executive first) so `reports_to` links resolve.

---

## Step 4: SOP Templates (5, with checklist items)

### T1: Morning Store Prep (Daily, Operations, Operator)

| # | description | item_type | weight | evidence_required |
|---|-------------|-----------|--------|-------------------|
| 1 | Unlock all entry doors | Checkbox | 1.0 | None |
| 2 | Turn on lighting in all zones | Checkbox | 1.0 | None |
| 3 | Check fire extinguisher seals | Checkbox | 1.5 | Photo |
| 4 | Sweep and mop entrance lobby | Checkbox | 1.0 | None |
| 5 | Verify restroom supplies stocked | Checkbox | 1.0 | Photo |
| 6 | Record lobby temperature | Numeric | 1.0 | None |

### T2: Evening Closing Checklist (Daily, Operations, Operator)

| # | description | item_type | weight | evidence_required |
|---|-------------|-----------|--------|-------------------|
| 1 | Empty all trash bins | Checkbox | 1.0 | None |
| 2 | Lock all entry/exit doors | Checkbox | 1.5 | None |
| 3 | Set alarm system | Checkbox | 2.0 | Photo |
| 4 | Turn off non-essential lighting | Checkbox | 1.0 | None |

### T3: Weekly Deep Clean (Weekly, Operations, Operator)

| # | description | item_type | weight | evidence_required |
|---|-------------|-----------|--------|-------------------|
| 1 | Deep clean all restrooms | Checkbox | 2.0 | Photo |
| 2 | Polish lobby floor | Checkbox | 1.5 | Photo |
| 3 | Clean HVAC vents | Checkbox | 1.0 | None |
| 4 | Sanitize all door handles | Checkbox | 1.0 | None |
| 5 | Inspect and clean parking area | Checkbox | 1.0 | None |

### T4: Supervisor Daily Review (Daily, Management, Supervisor)

| # | description | item_type | weight | evidence_required |
|---|-------------|-----------|--------|-------------------|
| 1 | Review team task completion | Checkbox | 2.0 | None |
| 2 | Spot-check one completed SOP | Checkbox | 1.5 | Photo |
| 3 | Log incidents or escalations | Checkbox | 1.0 | None |

### T5: Security Patrol (Daily, Security, Operator)

| # | description | item_type | weight | evidence_required |
|---|-------------|-----------|--------|-------------------|
| 1 | Walk full perimeter | Checkbox | 1.5 | None |
| 2 | Check all CCTV cameras operational | Checkbox | 2.0 | Photo |
| 3 | Verify visitor log entries | Checkbox | 1.0 | None |
| 4 | Test emergency exits | Checkbox | 1.5 | None |

All templates: `active_from = 2026-02-01`, `is_active = 1`.

---

## Step 5: SOP Assignments (12)

| employee | templates |
|----------|-----------|
| Suresh Kumar (Operator, N1) | Morning Store Prep, Evening Closing |
| Kavitha Raj (Operator, N1) | Morning Store Prep, Weekly Deep Clean |
| Deepak Singh (Operator, N2) | Morning Store Prep, Evening Closing |
| Lakshmi Menon (Operator, S1) | Security Patrol |
| Anita Das (Supervisor, N1) | Supervisor Daily Review |
| Rahul Nair (Supervisor, N2) | Supervisor Daily Review |
| Meera Iyer (Supervisor, S1) | Supervisor Daily Review |

Total: 12 active assignments.

---

## Step 6: SOP Runs (30 days of history)

Generate runs for **2026-02-10 to 2026-03-12** (31 days) for all daily assignments, and weekly runs on each Monday.

### Completion patterns (to create realistic variance)

| Employee | Completion rate | Pattern |
|----------|----------------|---------|
| Suresh Kumar | ~90% | Strong performer, misses 1-2 items occasionally |
| Kavitha Raj | ~75% | Good but inconsistent, misses a few items per run |
| Deepak Singh | ~60% | Struggles, frequent missed items |
| Lakshmi Menon | ~85% | Security patrol mostly complete |
| Anita Das | ~95% | Diligent supervisor |
| Rahul Nair | ~80% | Decent supervisor |
| Meera Iyer | ~90% | Good supervisor |

### Run statuses

- Runs from 2026-02-10 to 2026-03-11: `Closed` or `Locked` (past days)
- Runs for 2026-03-12 (today): `Open` with partial completion
- Locked runs: about 10% of past runs (simulating overdue auto-lock), with remaining items marked `Missed`

### Estimated volume

- Daily assignments: 7 employees x ~31 days = ~217 daily runs
- Weekly assignments (Kavitha): ~4-5 weekly runs
- Total: **~222 SOP Runs**, each with 3-6 run items = **~1,000 SOP Run Items**

---

## Step 7: Score Snapshots

After creating all runs, compute and insert Score Snapshots for each employee for each day in the range.

- `period_type = "Day"` for each date
- `period_type = "Week"` for each Monday (W07 through W11)
- `period_type = "Month"` for Feb and Mar

Score calculation:
- `own_score` = completed_items / total_items across all runs for that period
- `team_score` = average of direct reports' `combined_score` (0 if no reports)
- `combined_score` = average of own_score and team_score (or just own_score if leaf node)

### Estimated volume

- 10 employees x 31 days = 310 Day snapshots
- 10 employees x 5 weeks = 50 Week snapshots
- 10 employees x 2 months = 20 Month snapshots
- Total: **~380 Score Snapshots**

---

## Step 8: Corrective Actions (15-20)

Create corrective actions for runs where items were missed, spread across the date range.

| status | count | notes |
|--------|-------|-------|
| Closed | 5 | Resolved in past, resolution text filled, resolved_at set |
| Resolved | 4 | Resolved but not yet formally closed |
| In Progress | 4 | Actively being worked on |
| Open | 5 | Recent, not yet addressed |

Raised by supervisors, assigned to the operator whose run had missed items. Priority distribution: 3 Critical, 5 High, 5 Medium, 5 Low.

---

## Implementation

### Single script: `process_meter/seed/seed.py`

```bash
# Run via:
bench --site processwise.localhost execute pulse.seed.seed.seed_dummy_data
```

The script should:

1. Check if data already exists (skip if PM Employee count > 0)
2. Create Users (with password `admin`, send_welcome_email=0)
3. Create PM Departments
4. Create PM Employees (top-down for hierarchy)
5. Create SOP Templates with child checklist items
6. Create SOP Assignments
7. Generate SOP Runs with randomized completion patterns
   - Use `random.seed(42)` for reproducibility
   - For each run item, randomly mark as Completed or Pending based on the employee's completion rate
   - Set `completed_at` timestamps spread throughout the day
   - Compute `total_items`, `completed_items`, `progress` on each run
8. Compute and insert Score Snapshots (Day, Week, Month)
9. Create Corrective Actions
10. `frappe.db.commit()` at the end

### Cleanup script: `process_meter/seed/seed.py :: clear_dummy_data()`

A companion function to delete all seeded data in reverse dependency order:
1. Corrective Action
2. Score Snapshot
3. SOP Run (cascade deletes SOP Run Items)
4. SOP Assignment
5. SOP Template (cascade deletes SOP Checklist Items)
6. PM Employee
7. PM Department
8. Users matching `*@pm.local`

```bash
bench --site processwise.localhost execute pulse.seed.seed.clear_dummy_data
```

---

## Expected result

After seeding, every frontend page should show:

| Page | What it shows |
|------|---------------|
| **Dashboard** | Gauges with own/team/combined scores; failure analytics chart with top missed tasks |
| **MyTasks** | Today's open runs with checklist items (partially completed) |
| **MyTeam** | Direct reports' scores (for supervisors/managers logged in) |
| **Operations** | Full org tree with scores rolling up from operators to CEO |
| **UserProfile** | Drill into any employee: 30-day score trend, run breakdown |
| **Templates** | 5 active SOP templates with checklist items |
| **Insights** | Org score trend, completion rate, dept/branch comparison, top performers, etc. |

**Insights date range:** Seed data uses **2026-02-10** to **2026-03-12**. On the Insights page, use the **"Demo data"** preset in the date filter, or **"Last 90 days"** if your system date is within that window, so charts and KPIs show data.

---

## Data volume summary

| DocType | Count |
|---------|-------|
| User (new) | 10 |
| PM Department | 3 |
| PM Employee | 10 |
| SOP Template | 5 |
| SOP Checklist Item | ~23 |
| SOP Assignment | 12 |
| SOP Run | ~222 |
| SOP Run Item | ~1,000 |
| Score Snapshot | ~380 |
| Corrective Action | ~18 |
| **Total records** | **~1,683** |
