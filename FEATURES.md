# Pulse Features

## Product Overview

**Pulse is a frontline operations accountability system** — a Process KPI Engine that sits between "people doing daily work" and "management wanting measurable operational performance."

It answers the critical questions that keep operations leaders awake at night:
- *Are standard procedures actually being followed?*
- *Which branches, departments, or teams are slipping?*
- *Which missed steps are hurting performance most?*
- *Where should managers intervene before problems escalate?*

---

## What Pulse Is (Product Category)

| Category | Description |
|----------|-------------|
| **Operations Management Software** | For tracking recurring operational work |
| **SOP / Checklist Execution Platform** | Converts paper procedures into digital, trackable runs |
| **Process Compliance & Accountability System** | Links execution to hierarchy, making failure visible |
| **Frontline Operations Analytics Product** | Turns ground-level activity into management KPIs |
| **Operational Performance Intelligence Tool** | Pattern recognition across time, location, and teams |

**One-line positioning:**
> *"Pulse makes recurring operational work measurable, attributable, and visible across the reporting chain."*

---

## The Problem Pulse Solves

### The Accountability Gap

Most organizations with distributed operations face a critical disconnect:

```
SOP exists on paper        →    Task may or may not be done
         ↓                            ↓
Leadership has no visibility   →   Issues noticed only after
                                    customer complaints,
                                    audit failures, or
                                    service breakdowns
```

**Pulse closes this gap** by:
1. Creating trackable execution instances from every SOP
2. Rolling performance up the hierarchy automatically
3. Making operational health visible in real-time

### Why Other Tools Don't Work

| Tool Type | Designed For | Why It Fails for Operations |
|-----------|--------------|----------------------------|
| **Project Management** (Jira, Asana) | One-off projects with deliverables | Operations are *recurring*, not projects |
| **Task Managers** (Todoist, Trello) | Individual ad-hoc tasks | No hierarchy rollup, no compliance tracking |
| **BPM Engines** (Camunda) | Process automation | Operations need *human judgment*, not automation |
| **BI Dashboards** (Tableau) | Data visualization | No operational data capture mechanism |

Pulse is specifically built for **recurring SOP execution** with **hierarchical accountability**.

---

## Core Features

### 1. SOP Template System

**What it is:** Master definitions of repeating checklists with configurable steps, scheduling, and requirements.

**Why it exists:** Standardization prevents "every branch does it differently" drift.

**Key capabilities:**
- Checklist items with descriptions, instructions, sequence
- Item types: Checkbox, Numeric, Photo
- Outcome modes: Simple Completion, Pass/Fail, Numeric, Photo Proof
- Proof requirements: Optional, Required, with media type control
- Prerequisites: Items that unlock based on previous item outcomes
- Frequency: Daily, Weekly, Monthly, Custom
- Advanced scheduling: Time-of-day, Interval-based

**Real-world use:**
- *QSR:* Kitchen opening checklist (6:00 AM daily, 8 steps, photo proof required for temp checks)
- *Retail:* Store closing procedure (10:00 PM daily, cash count + security sweep)
- *Facilities:* Equipment rounds (every 2 hours, numeric readings logged)

---

### 2. SOP Assignment & Run Generation

**What it is:** Links templates to specific employees, with automated run creation based on schedule.

**Why it exists:** Clear ownership + automated tracking = no "I thought someone else did it."

**Key capabilities:**
- Assignment links template → employee
- Automatic run generation via scheduler
- Multiple schedule types: CalendarDay, TimeOfDay, Interval
- Grace periods for late completion
- Open run policies (allow multiple vs. require previous closed)

**Real-world use:**
```
Template: "Kitchen Open Checklist"
Assigned to: Chef N1, Chef N2
Schedule: Daily at 6:00 AM
Result: Every day at 6:00 AM, each chef gets a new SOP Run
```

---

### 3. Checklist Execution & Evidence Capture

**What it is:** Operator interface for completing checklist items with support for notes, numeric values, and photo evidence.

**Why it exists:** Execution without proof is just a checkbox. Evidence enables audit and accountability.

**Key capabilities:**
- Step-by-step checklist runner
- Photo upload with camera-only enforcement
- Pass/Fail outcome marking
- Failure remarks for non-compliance
- Progress tracking (completed/pending/missed)
- Prerequisites that conditionally show/hide items

**Real-world use:**
- *Hygiene check:* "Check refrigerator temperature" → Photo of thermometer → Mark Pass/Fail
- *Safety round:* "Verify fire extinguisher gauge" → Photo → Add note if pressure low
- *Opening procedure:* Count cash drawer → Enter numeric value → Mark complete

---

### 4. Run Lifecycle & Status Management

**What it is:** Tracks SOP runs from creation through completion or overdue locking.

**Why it exists:** Time-bound accountability — if it's not done on time, it becomes a miss.

**Key capabilities:**
- Status flow: Open → Closed (completed) or Locked (overdue)
- Automatic locking when grace period expires
- Pending items automatically marked Missed on lock
- Closed runs are immutable (audit trail)
- Progress and score calculation

**Real-world use:**
```
6:00 AM: Run created (Open)
8:30 AM: Chef completes 6 of 8 items, marks run Closed
          (2 items remain Pending — acceptable if grace allows)

OR

6:00 AM: Run created (Open)
7:00 AM: Grace period expires (30 min)
        Run automatically Locked
        2 Pending items marked Missed
        Manager notified of missed items
```

---

### 5. Hierarchical Scoring System

**What it is:** Converts execution into KPIs that roll up from operators to executives.

**Why it exists:** An operator's miss should affect their supervisor's score. This creates organizational pressure for follow-through.

**Score types:**
- **own_score:** Individual's direct task completion %
- **team_score:** Average of direct reports' combined scores
- **combined_score:** Rollup metric (own + team averaged)

**Propagation:**
```
Operator (Leaf):     combined = own_score
                           ↓
Supervisor:          combined = (own_score + team_score) / 2
                           ↓
Area Manager:        combined = (own_score + team_score) / 2
                           ↓
Executive:           combined = (own_score + team_score) / 2
```

**Score brackets:**
| Bracket | Range | Meaning |
|---------|-------|---------|
| Exceptional | ≥ 90% | Exceeds expectations |
| Strong | 80-89% | Solid performance |
| Moderate | 60-79% | Needs attention |
| At Risk | 40-59% | Intervention required |
| Critical | < 40% | Urgent action needed |

**Real-world use:**
- *Operator dashboard:* "Your score today: 85% (Strong)"
- *Supervisor dashboard:* "Team score: 78% — 2 operators at risk"
- *Area manager:* "North Region: 82% — Branch N1 declining"
- *Executive:* "Org-wide: 84% — Procurement dept critical at 52%"

---

### 6. Role-Based Visibility

**What it is:** Four-level hierarchy that determines what data each user can see and modify.

**Why it exists:** Frontline staff see their tasks. Managers see their teams. Executives see the org. No information overload, no permission gaps.

| Level | Role | Visibility |
|-------|------|------------|
| 1 | Operator | Own runs only |
| 2 | Supervisor | Own + direct reports |
| 3 | Area Manager | Full subtree (recursive) |
| 4 | Executive | Entire organization |

**Real-world use:**
- *Cashier (Operator):* Sees their daily checklist, their score, nothing else
- *Branch Supervisor:* Sees their own work + 4 cashiers' status and scores
- *Regional Manager:* Sees 3 branches, 15 employees, regional trends
- *MD (Executive):* Sees all 50 branches, trends, comparisons, insights

---

### 7. Team & Operations Views

**What it is:** Manager interfaces for monitoring team performance and drilling into hierarchy.

**Why it exists:** Managers need quick answers: "How's my team doing? Who needs help?"

**Key capabilities:**
- **Team page:** Direct reports with scores, status, quick actions
- **Operations tree:** Expandable org hierarchy with scores at each level
- **User profiles:** Per-employee detail: runs, scores, trends, breakdown
- **Score breakdown:** Slide-over showing per-template contribution to score

**Real-world use:**
- Morning huddle: Supervisor opens Team page, sees 2 operators with low scores
- Weekly review: Area manager expands Operations tree, identifies underperforming branch
- Performance review: Manager opens User Profile, shows 30-day trend and missed items

---

### 8. Insights & Analytics

**What it is:** Data-driven dashboards for pattern recognition and decision support.

**Why it exists:** Firefighting is reactive. Insights enable proactive management.

**Available analytics:**
- **Score trends:** Performance over time (line chart)
- **Department comparison:** Which departments excel or struggle (bar chart)
- **Branch comparison:** Cross-location performance (bar chart)
- **Top/bottom performers:** Identify stars and those needing support
- **Template performance:** Which SOPs have lowest completion (improvement opportunities)
- **Completion trend:** Daily completion rates over time
- **Day-of-week heatmap:** Are Mondays worse? Fridays? (pattern detection)
- **Score distribution:** How many employees in each bracket (histogram)
- **Most-missed items:** Top 10 checklist items being skipped (prioritize fixes)
- **Corrective actions:** Resolution time, open/closed counts

**Real-world use:**
- *Trend:* "Kitchen scores declining over past 2 weeks — investigate"
- *Comparison:* "Branch N1 (92%) vs Branch S1 (78%) — what's different?"
- *Heatmap:* "Completion drops 15% on Fridays — staffing issue?"
- *Most-missed:* "Item 'Check freezer seal' missed 45 times — equipment issue?"

---

### 9. Corrective Actions

**What it is:** Track remediation of missed items with assignment, priority, and resolution workflow.

**Why it exists:** Finding problems is only half the battle. Fixing them closes the loop.

**Key capabilities:**
- Raise actions from missed run items
- Assign to specific employees
- Priority levels: Critical, High, Medium, Low
- Status workflow: Open → In Progress → Resolved → Closed
- Resolution notes and timestamps
- Trail from action back to source run item

**Real-world use:**
```
Run: Kitchen Open Checklist
Missed: "Refrigerator temp check"
↓
Supervisor raises Corrective Action
Assigned to: Chef N1
Priority: High (food safety)
↓
Chef N1 investigates, fixes thermometer, logs resolution
Status: Resolved
↓
Supervisor reviews, marks Closed
```

---

### 10. Follow-Up Rules (Automation)

**What it is:** Automated rules that trigger actions when SOP items fail.

**Why it exists:** Reduce manual oversight — automatically create follow-up work when issues are detected.

**Key capabilities:**
- Trigger: Item outcome = Fail
- Action: Create new SOP Run (for same or different template)
- Target assignee: Same employee or their manager
- Execution logging (idempotent — won't duplicate)

**Real-world use:**
```
Rule: "If hygiene check fails, create manager inspection"
Trigger: Chef marks "Refrigerator temp" as Fail
Action: SOP Run created for "Manager Food Safety Inspection"
Assigned to: Chef's supervisor
Result: Manager must verify and sign off
```

---

### 11. In-App Notifications

**What it is:** Alert system for operational events without email dependency.

**Why it exists:** Keep users informed without inbox noise. Critical alerts get attention; routine updates don't spam.

**Key capabilities:**
- Notification types: RunAlert, ItemFail, FollowUpCreated, System, Custom
- Severity levels: Info, Warning, Critical
- Priority: Low, Normal, High, Urgent
- Read/unread tracking with timestamps
- Source document linking (click to view)

**Real-world use:**
- *Warning:* "Kitchen Open Checklist overdue — 15 minutes to lock"
- *Critical:* "Temperature check FAILED — immediate action required"
- *Info:* "Weekly Deep Clean scheduled for tomorrow"

---

### 12. Demo Data System

**What it is:** Realistic seed data for testing, demos, and development.

**Why it exists:** Stakeholders need to see the system with real-looking data. Developers need consistent test scenarios.

**Demo dataset:**
- 19 users across 4-level hierarchy
- 3 branches + HQ (QSR chain scenario)
- 6 SOP templates (5 daily + 1 weekly)
- ~400 SOP runs over 40 days
- ~390 score snapshots
- 18 corrective actions
- Varied completion rates (75-100%) for realistic distributions

**Usage:**
```bash
bench --site pulse.localhost pulse-load-demo
bench --site pulse.localhost pulse-clear-demo
```

---

## Product Maturity

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

### Roadmap (Open Items)

- [ ] Photo evidence upload (file storage)
- [ ] Real-time updates (WebSocket/SSE)
- [ ] AI failure prediction (historical trend analysis)
- [ ] Offline PWA with sync
- [ ] End-to-end test suite

---

## Target Industries & Use Cases

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

## Why Companies Choose Pulse

| Need | How Pulse Delivers |
|------|-------------------|
| **Compliance** | Audit trail of every SOP execution with evidence |
| **Consistency** | Same standards across all branches/teams |
| **Accountability** | Hierarchical scoring creates ownership |
| **Visibility** | Real-time operational health at every level |
| **Auditability** | Complete history: who did what, when, with proof |
| **Multi-site control** | Compare branches, spot outliers, standardize best practices |
| **Proactive management** | Trends and alerts before issues become crises |

---

## Feature Impact Summary

| Feature | What It Solves | Business Impact |
|---------|----------------|-----------------|
| SOP Templates | "Procedures exist only on paper" | Standardization across locations |
| Assignments | "I thought someone else would do it" | Clear ownership |
| Evidence Capture | "We can't prove it was done" | Audit readiness |
| Hierarchical Scoring | "Management doesn't feel the pain of frontline misses" | Organizational accountability |
| Insights | "We're always firefighting" | Proactive pattern detection |
| Corrective Actions | "Issues get reported but not fixed" | Closed-loop remediation |
| Role-Based Views | "Information overload or gaps" | Right data to right people |

---

*Pulse: Turning frontline execution into executive visibility.*
