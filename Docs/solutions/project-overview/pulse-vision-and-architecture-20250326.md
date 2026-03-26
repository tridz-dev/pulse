---
module: Pulse
date: 2025-03-26
problem_type: documentation
component: project_overview
severity: informational
tags: [pulse, overview, vision, architecture, sop, operations]
---

# Pulse: Vision and Architecture

> **"Pulse makes recurring operational work measurable, attributable, and visible across the reporting chain."**

---

## Executive Summary

**Pulse is a frontline operations accountability system** — a Process KPI Engine that sits between "people doing daily work" and "management wanting measurable operational performance."

Pulse converts daily operational activity into measurable, hierarchical performance signals. It is a **Frappe 16 + React 19 SPA** designed for multi-branch organizations that need to track Standard Operating Procedure (SOP) execution across their operational hierarchy.

### What Pulse Is (Product Category)

| Category | Description |
|----------|-------------|
| **Operations Management Software** | For tracking recurring operational work |
| **SOP / Checklist Execution Platform** | Converts paper procedures into digital, trackable runs |
| **Process Compliance & Accountability System** | Links execution to hierarchy, making failure visible |
| **Frontline Operations Analytics Product** | Turns ground-level activity into management KPIs |
| **Operational Performance Intelligence Tool** | Pattern recognition across time, location, and teams |

### Target Users

- **Operators** — Frontline staff completing daily checklists
- **Supervisors** — Branch managers monitoring team execution
- **Area Managers** — Regional leaders tracking multiple branches
- **Executives** — Leadership viewing organization-wide operational health

---

## Problem Statement: The Accountability Gap

Most organizations with distributed operations face a critical disconnect:

```
SOP exists on paper        →    Task may or may not be done
         ↓                            ↓
Leadership has no visibility   →   Issues noticed only after
                                    customer complaints,
                                    audit failures, or
                                    service breakdowns
```

As stated in the product documentation:

> *"Pulse closes the 'accountability gap' between ground-level task execution and C-Suite KPIs. Every missed step degrades the combined score of every manager in the reporting line — making failure visible at any level in real time."*

### Why Other Tools Don't Work

| Tool Type | Designed For | Why It Fails for Operations |
|-----------|--------------|----------------------------|
| **Project Management** (Jira, Asana) | One-off projects with deliverables | Operations are *recurring*, not projects |
| **Task Managers** (Todoist, Trello) | Individual ad-hoc tasks | No hierarchy rollup, no compliance tracking |
| **BPM Engines** (Camunda) | Process automation | Operations need *human judgment*, not automation |
| **BI Dashboards** (Tableau) | Data visualization | No operational data capture mechanism |

Pulse is specifically built for **recurring SOP execution** with **hierarchical accountability**.

---

## Solution Architecture

### Core Concept: Hierarchical Score Propagation

Pulse closes the accountability gap through a bottom-up scoring system:

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

### Score Types

| Score Type | Definition |
|------------|------------|
| **own_score** | Individual's direct task completion % |
| **team_score** | Average of direct reports' combined scores |
| **combined_score** | Rollup metric (own + team averaged) |

**Score Propagation Logic:**

```
Operator (Leaf):     combined = own_score
                           ↓
Supervisor:          combined = (own_score + team_score) / 2
                           ↓
Area Manager:        combined = (own_score + team_score) / 2
                           ↓
Executive:           combined = (own_score + team_score) / 2
```

### Score Brackets

| Bracket | Range | Meaning |
|---------|-------|---------|
| Exceptional | ≥ 90% | Exceeds expectations |
| Strong | 80-89% | Solid performance |
| Moderate | 60-79% | Needs attention |
| At Risk | 40-59% | Intervention required |
| Critical | < 40% | Urgent action needed |

### Data Flow Architecture

```mermaid
flowchart TD
    A[Frappe Scheduler<br/>all_15_min / daily / hourly /<br/>weekly / monthly] -->|generates| B[SOP Run]
    C[SOP Template] -->|defines| B
    D[SOP Assignment<br/>template × employee] -->|creates| B
    B -->|contains| E[SOP Run Item]
    E -->|aggregated by| F[Score Snapshot]
    F -->|rolled up| G[Pulse Employee Hierarchy<br/>Operator → Supervisor → AM → Executive]
    G -->|consumed by| H[React SPA<br/>Dashboard / Operations /<br/>Insights / MyTasks / Team]
    
    B -.->|Open → Closed| B
    B -.->|→ Locked (overdue)| B
    E -.->|Pending → Completed / Missed| E
```

### Key Entities

#### SOP Template
Master definitions of repeating checklists with configurable steps, scheduling, and requirements.

- Checklist items with descriptions, instructions, sequence
- Item types: Checkbox, Numeric, Photo
- Outcome modes: Simple Completion, Pass/Fail, Numeric, Photo Proof
- Frequency: Daily, Weekly, Monthly, Custom
- Advanced scheduling: Time-of-day, Interval-based

#### SOP Run
One execution instance of a template for one employee on one date.

**Status Lifecycle:**
```
Open  ──[employee completes]──→  Closed
Open  ──[day passes, overdue]──→  Locked  (Pending items → Missed)
```

#### Score Snapshot
Cached per-employee score for a period (Day/Week/Month). Written by the hourly scheduler.

### Role-Based Visibility

| Level | Role | Visibility |
|-------|------|------------|
| 1 | Operator | Own runs only |
| 2 | Supervisor | Own + direct reports |
| 3 | Area Manager | Full subtree (recursive) |
| 4 | Executive | Entire organization |

---

## Technology Stack

### Backend

| Component | Technology |
|-----------|------------|
| **Framework** | Frappe 16 (Python) |
| **Database** | MariaDB (via Frappe ORM + raw SQL for analytics) |
| **Cache** | Redis (for API response caching) |
| **Scheduler** | Frappe Scheduler (cron-based task execution) |

### Frontend

| Component | Technology |
|-----------|------------|
| **Framework** | React 19 |
| **Build Tool** | Vite 5 |
| **Routing** | React Router 7 |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | shadcn/ui (Radix), Base UI |
| **Charts** | Recharts |
| **Data Fetching** | TanStack React Query v5 |
| **Frappe SDK** | frappe-js-sdk |
| **Icons** | Lucide React |
| **Fonts** | Geist Variable (body), DM Mono (metrics) |

### Caching Strategy

**Server-side (Redis `@redis_cache`):**

| Symbol | Module | TTL | Role |
|--------|--------|-----|------|
| `_calculate_score_snapshot` | `scores.py` | 120s | Per-employee score snapshot computation |
| `_failure_analytics_cached` | `scores.py` | 240s | Failure analytics payload |
| `_fetch_runs_for_employee_raw` | `tasks.py` | 60s | Runs for employee + date |
| `_pulse_home_summary_cached` | `go.py` | 90s | Go home headline counts |

**Client-side (TanStack React Query):**
- `staleTime`: 60s
- `gcTime`: 10m
- Refetch on window focus enabled

---

## Key Differentiators

### Why Companies Choose Pulse

| Need | How Pulse Delivers |
|------|-------------------|
| **Compliance** | Audit trail of every SOP execution with evidence |
| **Consistency** | Same standards across all branches/teams |
| **Accountability** | Hierarchical scoring creates ownership |
| **Visibility** | Real-time operational health at every level |
| **Auditability** | Complete history: who did what, when, with proof |
| **Multi-site control** | Compare branches, spot outliers, standardize best practices |
| **Proactive management** | Trends and alerts before issues become crises |

### Comparison with Alternative Tools

| | **Pulse** | **Project management (PM) tools** | **Task managers** | **BPM / workflow engines** |
|---|------------------|-----------------------------------|-------------------|----------------------------|
| **Focus** | Execution of **recurring** procedures (SOPs, checklists) | One-off **projects** and deliverables | Ad-hoc **tasks** and to-dos | **Process design** and automation |
| **Unit of work** | SOP runs (template × employee × period) | Projects, milestones, issues | Tasks, subtasks | Processes, activities, cases |
| **Metrics** | Completion %, scores, trends by org/branch/dept | Burndown, velocity, status | Done vs pending | Cycle time, SLA, throughput |
| **Audience** | Operations, area managers, leadership | PMs, delivery teams | Individuals, small teams | Process owners, IT |
| **Typical use** | "Did we do the opening checklist today?" | "Is the launch on track?" | "What do I need to do?" | "How long does approval take?" |

Pulse does **not** replace Jira, Asana, or Camunda. It complements them by focusing on **recurring operational execution** and **role-based visibility** over hierarchies and geography.

---

## Target Industries

### QSR / Restaurant Chains
- Opening/closing checklists
- Food safety hygiene protocols
- Temperature logging
- Cash handling procedures
- Deep cleaning schedules

### Retail / Multi-Location Stores
- Store readiness checks
- Merchandising compliance
- Opening/closing procedures
- Security sweeps
- Inventory counts

### Facilities / Maintenance
- Equipment rounds
- Preventive maintenance
- Safety inspections
- Site readiness
- Environmental checks

### Healthcare Support (Non-Clinical)
- Housekeeping protocols
- Equipment sterilization checks
- Ward preparation
- Support service compliance

### Logistics / Warehousing
- Loading/unloading checks
- Safety inspections
- Equipment checks
- Shift handover procedures

---

## Business Impact

### Feature Impact Summary

| Feature | What It Solves | Business Impact |
|---------|----------------|-----------------|
| SOP Templates | "Procedures exist only on paper" | Standardization across locations |
| Assignments | "I thought someone else would do it" | Clear ownership |
| Evidence Capture | "We can't prove it was done" | Audit readiness |
| Hierarchical Scoring | "Management doesn't feel the pain of frontline misses" | Organizational accountability |
| Insights | "We're always firefighting" | Proactive pattern detection |
| Corrective Actions | "Issues get reported but not fixed" | Closed-loop remediation |
| Role-Based Views | "Information overload or gaps" | Right data to right people |

### Real-World Impact Examples

- **Standardization:** "Kitchen scores declining over past 2 weeks — investigate"
- **Comparison:** "Branch N1 (92%) vs Branch S1 (78%) — what's different?"
- **Pattern Detection:** "Completion drops 15% on Fridays — staffing issue?"
- **Issue Prioritization:** "Item 'Check freezer seal' missed 45 times — equipment issue?"

### Core Questions Answered

Pulse answers the critical questions that keep operations leaders awake at night:

- *Are standard procedures actually being followed?*
- *Which branches, departments, or teams are slipping?*
- *Which missed steps are hurting performance most?*
- *Where should managers intervene before problems escalate?*

---

## Demo Data Reference

Pulse includes a comprehensive demo dataset for testing and demonstrations:

| DocType | Count | Notes |
|---------|-------|-------|
| User | 19 | All with `Demo@123` |
| Pulse Role | 4 | Operator · Supervisor · Area Manager · Executive |
| Pulse Department | 7 | Kitchen · Front-of-House · Procurement · Finance · Operations · Management · Security |
| Pulse Employee | 19 | Full 4-level hierarchy across 3 branches + HQ |
| SOP Template | 6 | 5 daily + 1 weekly |
| SOP Checklist Item | 22 | Embedded in templates |
| SOP Assignment | 12 | Template × employee pairs |
| SOP Run | ~400 | 40 days of history (relative window ending yesterday) |
| SOP Run Item | ~1,500 | Per-step outcomes |
| Score Snapshot | ~390 | Daily aggregates |
| Corrective Action | 18 | Varied status/priority |

### Demo Login Credentials

| Email | Password | Role |
|-------|----------|------|
| `chairman@pm.local` | `Demo@123` | Executive |
| `md@pm.local` | `Demo@123` | Executive |
| `rm.north@pm.local` | `Demo@123` | Area Manager |
| `bm.n1@pm.local` | `Demo@123` | Supervisor |
| `chef.n1@pm.local` | `Demo@123` | Operator |

---

## Summary

> *"Pulse: Turning frontline execution into executive visibility."*

Pulse is beyond concept stage — it's an **early productized operational platform** with:

| Component | Status |
|-----------|--------|
| Data model | Complete (12 DocTypes) |
| Role model | 4 levels + admin |
| Scoring model | Bottom-up propagation |
| Scheduler | Multi-frequency (15min to monthly) |
| UI routes | 7 main pages + operator mode |
| Analytics | 12 insight endpoints |
| Demo data | Full QSR chain scenario |

---

## References

- **Product Features:** `/workspace/development/edge16/apps/pulse/FEATURES.md`
- **Project README:** `/workspace/development/edge16/apps/pulse/README.md`
- **Technical Reference:** `/workspace/development/edge16/apps/pulse/AGENTS.md`
- **Demo Data:** `/workspace/development/edge16/apps/pulse/pulse/demo/README.md`
