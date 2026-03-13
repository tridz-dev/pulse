# Seed Execution Step Log

> Step-by-step execution log for QSR chain dummy data seeding.

---

## Commands

```bash
# Seed (run once)
bench --site processwise.localhost execute pulse.seed.seed.seed_dummy_data

# Clear (to re-seed)
bench --site processwise.localhost execute pulse.seed.seed.clear_dummy_data
```

---

## Step 1: Execution Plan

- Created `docs/SEED_EXECUTION_PLAN.md` with QSR hierarchy, role mapping, and test credentials.

---

## Step 2: Seed Module

- Created `process_meter/seed/__init__.py`
- Created `process_meter/seed/data.py` — USERS, HIERARCHY, DEPARTMENTS, SOP_TEMPLATES, ASSIGNMENTS, COMPLETION_RATE
- Created `process_meter/seed/seed.py` — seed_dummy_data(), clear_dummy_data(), and all _create_* helpers

---

## Step 3: Users

- 19 Frappe User records created
- Email pattern: `*@pm.local`
- Password: `Demo@123`
- Roles: PM User, PM Manager, PM Leader, PM Executive (system roles per user); PM Role (Operator, Supervisor, Area Manager, Executive) for business display; + System Manager

---

## Step 4: Departments

- 5 PM Departments: Kitchen, Front-of-House, Procurement, Finance, Operations
- (Install may have created Operations, Security, Management earlier; seed uses its own set)

---

## Step 5: Employees

- 19 PM Employee records
- Hierarchy: Chairman → MD → RMs → Branch Managers → Supervisors → Operators (Chef, Cashier, Cleaner, etc.)
- Departments and branches assigned per role

---

## Step 6: SOP Templates

- 6 templates: Kitchen Open, Kitchen Close, Cashier Daily, Store Clean, Supervisor Daily Review, Weekly Deep Clean
- Each with 3–4 checklist items (description, sequence, weight, item_type, evidence_required)

---

## Step 7: SOP Assignments

- 12 assignments mapping employees to templates
- Chefs: Kitchen Open/Close; Cashiers: Cashier Daily; Cleaners: Store Clean + Weekly Deep Clean; Supervisors: Supervisor Daily Review

---

## Step 8: SOP Runs

- Date range: 2026-02-10 to 2026-03-12
- Daily and Weekly templates
- Completion variance per user (60%–95%)
- Today’s runs: Status Open, some items Pending
- Past runs: Status Closed or Locked, items Completed or Missed

---

## Step 9: Score Snapshots

- Day-level snapshots per employee per date
- own_score, team_score, combined_score computed from runs
- Team roll-up for managers

---

## Step 10: Corrective Actions

- ~18 Corrective Actions linked to runs with missed items
- Status mix: Open, In Progress, Resolved, Closed
- Priority mix: Low, Medium, High, Critical

---

## Step 11: Run

```bash
bench --site processwise.localhost execute pulse.seed.seed.seed_dummy_data
```

- Exit code: 0
- PM Employee count: 19

---

## Step 12: Browser Test

- URL: http://localhost:8001/process_meter
- Login: `chef.n1@pm.local` / `Demo@123`
- **Dashboard**: Execution Health, 7 completed tasks, 8 assigned tasks
- **My Tasks**: Kitchen Open Checklist, Kitchen Close Checklist
- **Operations**: Correctly restricted for Operator (Area Manager/Executive only)

---

## Step 13: Role-Based Testing (Chairman → Executive → All Levels)

| Role | User | Password | Dashboard | My Tasks | My Team | Operations | SOP Templates |
|------|------|----------|-----------|----------|---------|------------|---------------|
| **Chairman (Executive)** | chairman@pm.local | Demo@123 | ✅ | ✅ | ✅ | ✅ Full | ✅ |
| **MD (Executive)** | md@pm.local | Demo@123 | ✅ | ✅ | ✅ | ✅ Full | ✅ |
| **Area Manager** | rm.north@pm.local | Demo@123 | ✅ | ✅ | ✅ | ✅ Full | ✅ |
| **Supervisor** | bm.n1@pm.local | Demo@123 | ✅ | ✅ | ✅ | ❌ Hidden | ✅ |
| **Operator** | chef.n1@pm.local | Demo@123 | ✅ | ✅ | ❌ Hidden | ❌ Restricted | ❌ Hidden |
| **Administrator** | Administrator | admin | ✅ | ✅ | ✅ | ⚠️ Restricted* | ✅ |

\* Administrator has no PM Employee record; app resolves `currentUser` from PM Employee only. For full Operations access, link Administrator to a PM Employee or add PM Admin handling.

---

## Result

All steps completed. App is populated with QSR chain demo data and verified via browser. Role-based access control behaves as designed across Chairman/Executive, Area Manager, Supervisor, and Operator.
