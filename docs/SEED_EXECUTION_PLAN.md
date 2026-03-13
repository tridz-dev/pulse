# Seed Execution Plan — QSR Chain Dummy Data

> Step-by-step plan to populate Pulse with QSR (Quick Service Restaurant) chain demo data. Tracks progress and documents each phase.

---

## Context

**QSR Chain Structure:**
- Chairman (top)
- MD (Managing Director)
- Regional Managers (RMs)
- Branch Managers
- Supervisors
- Operators: Chef, Cashier, Purchase Manager, Finance Manager, Cleaner, Driver

**PM Role Mapping:**
| QSR Role | pulse_role |
|----------|---------|
| Chairman, MD | Executive |
| Regional Manager | Area Manager |
| Branch Manager, Supervisor | Supervisor |
| Chef, Cashier, Cleaner, Purchase Manager, Finance Manager, Driver | Operator |

---

## Execution Steps

| # | Step | Status | Notes |
|---|------|--------|-------|
| 1 | Create SEED_EXECUTION_PLAN.md | done | This file |
| 2 | Create process_meter/seed/ module | done | __init__.py, seed.py, data.py |
| 3 | Create Users (19 QSR users) | done | chairman@pm.local, md@pm.local, etc. |
| 4 | Create PM Departments | done | Kitchen, Front-of-House, Procurement, Finance, Operations |
| 5 | Create PM Employees (19, hierarchy) | done | Top-down creation |
| 6 | Create SOP Templates (6) | done | Kitchen open, Kitchen close, Cashier, Cleaner, etc. |
| 7 | Create SOP Assignments | done | 12 assignments |
| 8 | Create SOP Runs (30 days) | done | ~250 runs with completion variance |
| 9 | Create Score Snapshots | done | Day per employee |
| 10 | Create Corrective Actions | done | ~18 actions |
| 11 | Run bench execute | done | `pulse.seed.seed.seed_dummy_data` |
| 12 | Browser test at /pulse | done | Login chef.n1@pm.local, Dashboard + My Tasks verified |

---

## QSR Hierarchy (20 employees)

```
Chairman (Executive)
└── MD (Executive)
    ├── RM North (Area Manager)
    │   ├── Branch Manager N1 (Supervisor)
    │   │   ├── Supervisor N1 (Supervisor)
    │   │   │   ├── Chef N1 (Operator)
    │   │   │   ├── Cashier N1 (Operator)
    │   │   │   └── Cleaner N1 (Operator)
    │   │   └── Chef N2 (Operator) [also at N1 branch]
    │   └── Branch Manager N2 (Supervisor)
    │       └── Supervisor N2 (Supervisor)
    │           └── Cashier N2 (Operator)
    └── RM South (Area Manager)
        └── Branch Manager S1 (Supervisor)
            └── Supervisor S1 (Supervisor)
                ├── Cleaner S1 (Operator)
                └── Driver (Operator)
    └── Purchase Manager (Operator, HQ)
    └── Finance Manager (Operator, HQ)
```

---

## Run Command

```bash
cd /workspace/development/edge16
bench --site processwise.localhost execute pulse.seed.seed_dummy_data
```

## Clear Command

```bash
bench --site processwise.localhost execute pulse.seed.clear_dummy_data
```

---

## Test Credentials (password: Demo@123)

| User | Role | Test as |
|------|------|---------|
| chairman@pm.local | Executive | Full org view |
| md@pm.local | Executive | Full org view |
| rm.north@pm.local | Area Manager | North region |
| bm.n1@pm.local | Supervisor | Branch N1 team |
| chef.n1@pm.local | Operator | Own tasks only |
