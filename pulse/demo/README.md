# Pulse Demo Data

Realistic demo data for a three-branch QSR (quick-service restaurant) chain.
Run it on any fresh Pulse installation to get a fully populated site with
users, org hierarchy, SOPs, historical runs, scores, and corrective actions.

---

## How to load

```bash
# Preferred — bench CLI command
bench --site <site> pulse-load-demo

# Alternative — bench execute
bench --site <site> execute pulse.demo.seed.seed_demo_data
```

## How to clear

```bash
bench --site <site> pulse-clear-demo

# or
bench --site <site> execute pulse.demo.seed.clear_demo_data
```

> Both operations are **idempotent**: loading skips records that already exist;
> clearing only removes what the seeder created.

---

## Data overview

| DocType | Records | Notes |
|---|---|---|
| **User** | 19 | One Frappe user per employee. Password: `Demo@123` |
| **Pulse Role** | 4 | Operator · Supervisor · Area Manager · Executive |
| **Pulse Department** | 7 | Kitchen · Front-of-House · Procurement · Finance · Operations · Management · Security |
| **Pulse Employee** | 19 | Full org with hierarchy and branch assignments |
| **SOP Template** | 6 | 5 daily checklists + 1 weekly deep clean |
| **SOP Checklist Item** | 22 | Steps embedded in each template |
| **SOP Assignment** | 12 | Each relevant employee assigned to their templates |
| **SOP Run** | ~400 | One run per assignment per applicable day over 40 days |
| **SOP Run Item** | ~1 500 | Individual step outcomes per run (Completed / Missed) |
| **Score Snapshot** | ~390 | Daily own/team/combined scores per employee |
| **Corrective Action** | 18 | Actions raised on runs with missed steps |

> Run counts vary slightly because the date window is **relative** —
> always 40 days ending yesterday — so every fresh install gets current data.

---

## Organisation chart

```
Ramesh Agarwal  (Chairman · Executive · HQ)
└── Priya Sharma  (MD · Executive · HQ)
    ├── Vikram Patel  (RM North · Area Manager)
    │   ├── Rahul Nair  (BM N1 · Supervisor · Branch N1)
    │   │   ├── Kavitha Raj  (Sup N1 · Supervisor · Branch N1)
    │   │   │   ├── Arun Bhat      (Chef N1 · Operator · Branch N1)
    │   │   │   ├── Pooja Reddy    (Chef N2 · Operator · Branch N2)
    │   │   │   ├── Ravi Verma     (Cashier N1 · Operator · Branch N1)
    │   │   │   └── Mohan Das      (Cleaner N1 · Operator · Branch N1)
    │   └── Meera Iyer  (BM N2 · Supervisor · Branch N2)
    │       └── Deepak Singh  (Sup N2 · Supervisor · Branch N2)
    │           └── Neha Gupta     (Cashier N2 · Operator · Branch N2)
    ├── Anita Das  (RM South · Area Manager)
    │   └── Suresh Kumar  (BM S1 · Supervisor · Branch S1)
    │       └── Lakshmi Menon  (Sup S1 · Supervisor · Branch S1)
    │           ├── Sunita Devi    (Cleaner S1 · Operator · Branch S1)
    │           └── Vijay Singh    (Driver · Operator · Branch S1)
    ├── Rajesh Mehta   (Purchase · Operator · HQ)
    └── Anjali Kapoor  (Finance · Operator · HQ)
```

---

## SOP templates

| Title | Department | Frequency | Assigned role | Steps |
|---|---|---|---|---|
| Kitchen Open Checklist | Kitchen | Daily | Operator | 4 |
| Kitchen Close Checklist | Kitchen | Daily | Operator | 4 |
| Cashier Daily Checklist | Front-of-House | Daily | Operator | 4 |
| Store Clean Checklist | Operations | Daily | Operator | 4 |
| Supervisor Daily Review | Operations | Daily | Supervisor | 3 |
| Weekly Deep Clean | Operations | Weekly | Operator | 3 |

---

## Assignments

| Template | Assigned to |
|---|---|
| Kitchen Open Checklist | chef.n1, chef.n2 |
| Kitchen Close Checklist | chef.n1, chef.n2 |
| Cashier Daily Checklist | cashier.n1, cashier.n2 |
| Store Clean Checklist | cleaner.n1, cleaner.s1 |
| Weekly Deep Clean | cleaner.n1 |
| Supervisor Daily Review | sup.n1, sup.n2, sup.s1 |

---

## User accounts

All accounts use password **`Demo@123`**.

| Email | Name | Role | Branch |
|---|---|---|---|
| `chairman@pm.local` | Ramesh Agarwal | Executive | HQ |
| `md@pm.local` | Priya Sharma | Executive | HQ |
| `rm.north@pm.local` | Vikram Patel | Area Manager | North Region |
| `rm.south@pm.local` | Anita Das | Area Manager | South Region |
| `bm.n1@pm.local` | Rahul Nair | Supervisor | Branch N1 |
| `bm.n2@pm.local` | Meera Iyer | Supervisor | Branch N2 |
| `bm.s1@pm.local` | Suresh Kumar | Supervisor | Branch S1 |
| `sup.n1@pm.local` | Kavitha Raj | Supervisor | Branch N1 |
| `sup.n2@pm.local` | Deepak Singh | Supervisor | Branch N2 |
| `sup.s1@pm.local` | Lakshmi Menon | Supervisor | Branch S1 |
| `chef.n1@pm.local` | Arun Bhat | Operator | Branch N1 |
| `chef.n2@pm.local` | Pooja Reddy | Operator | Branch N2 |
| `cashier.n1@pm.local` | Ravi Verma | Operator | Branch N1 |
| `cashier.n2@pm.local` | Neha Gupta | Operator | Branch N2 |
| `cleaner.n1@pm.local` | Mohan Das | Operator | Branch N1 |
| `cleaner.s1@pm.local` | Sunita Devi | Operator | Branch S1 |
| `purchase@pm.local` | Rajesh Mehta | Operator | HQ |
| `finance@pm.local` | Anjali Kapoor | Operator | HQ |
| `driver@pm.local` | Vijay Singh | Operator | Branch S1 |

---

## Completion variance

Deliberately varied per user to produce realistic score distributions:

| User | Rate |
|---|---|
| Chairman, MD | 100% |
| Regional Managers | 95% |
| Finance | 95% |
| Branch Managers, Chef N1, Sup N1 | 92% |
| Purchase, Sup S1 | 90% |
| BM N2, Cashier N1 | 88–88% |
| Sup N2, Cleaner N1 | 85% |
| Cleaner S1, Cashier N2 | 80–82% |
| Chef N2 | 78% |
| Driver | 75% |

---

## Source files

| File | Purpose |
|---|---|
| `data.py` | All static definitions (users, templates, assignments, rates) |
| `seed.py` | Seeder logic — `seed_demo_data()` and `clear_demo_data()` |
| `README.md` | This file |

---

## Acceptance fixture (S1-T06)

A separate, deterministic fixture used for first-milestone acceptance tests.
It is independent of the QSR demo data above; do not mix the two on one site.

### How to load

```bash
# Preferred — bench CLI command
bench --site <site> pulse-load-acceptance-fixture

# Alternative — bench execute
bench --site <site> execute pulse.demo.seed.seed_acceptance_fixture
```

### How to clear

```bash
bench --site <site> pulse-clear-acceptance-fixture

# or
bench --site <site> execute pulse.demo.seed.clear_acceptance_fixture
```

> Both operations are **idempotent**: loading skips records that already exist;
> clearing only removes the records the fixture seeder created.

### Data overview

| DocType | Records | Notes |
|---|---|---|
| **User** | 5 | Acceptance fixture users. Password: `Demo@123` |
| **Pulse Role** | 4 | Reuses existing Operator · Supervisor · Area Manager · Executive records |
| **Pulse Department** | 1 | `Operations` |
| **Pulse Employee** | 5 | Three-level reporting line + one unassigned operator |
| **SOP Template** | 2 | `Opening Hygiene Round` · `Closeout Audit` |
| **SOP Assignment** | 2 | Both assigned to Owen Patel: `A1` and `A2` |
| **SOP Run** | 3 | Passed · Failed · Pending |

### Organisation chart

```
Maya Iyer        (Executive)
└── Dev Shah      (Area Manager)
    └── Lina Fernandez  (Supervisor)
        └── Owen Patel   (Operator)

Nora Singh       (Operator, no assignment / outside scope)
```

Static context: Department `Operations`, Branch `North Branch`, Time zone `Asia/Kolkata`.

### Assignments

| Identity | Template | Assigned to | Local start | Window |
|---|---|---|---|---|
| `A1` | Opening Hygiene Round | Owen Patel | 08:30 | 45 minutes |
| `A2` | Closeout Audit | Owen Patel | 18:00 | 60 minutes |

### Run cases

| Run key | Assignment | Date | Result |
|---|---|---|---|
| `A1:2026-08-24` | A1 | 2026-08-24 | Passed |
| `A2:2026-08-24` | A2 | 2026-08-24 | Failed |
| `A1:2026-08-25` | A1 | 2026-08-25 | Pending |

Nora Singh has no generated or eligible runs.

### User accounts

All accounts use password **`Demo@123`**.

| Email | Name | Role | Expected personal score | Expected inherited score |
|---|---|---|---|---|
| `maya.iyer@pulse.test` | Maya Iyer | Executive | `null` | `0.5` |
| `dev.shah@pulse.test` | Dev Shah | Area Manager | `null` | `0.5` |
| `lina.fernandez@pulse.test` | Lina Fernandez | Supervisor | `null` | `0.5` |
| `owen.patel@pulse.test` | Owen Patel | Operator | `0.5` | `0.5` |
| `nora.singh@pulse.test` | Nora Singh | Operator | `null` | `null` |

### Score contract for the selected period

- **Owen Patel** — passed runs: `1`, failed runs: `1`, eligible runs: `2`, pending runs excluded from score: `1`. Personal score `0.5`.
- **Nora Singh** — passed runs: `0`, failed runs: `0`, eligible runs: `0`. Personal and inherited scores are `null` (not zero).
- **Maya Iyer / Dev Shah / Lina Fernandez** — inherited score `0.5`; personal score `null` because they have no own eligible runs in this fixture.
