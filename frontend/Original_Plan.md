**SOP-Based Hierarchical Process Management System**

*Functional architecture and foundational data model*

| Intent | A checklist-driven operating system for recurring SOP execution, KPI roll-up, and hierarchical visibility. |
| ----- | ----- |
| **Implementation direction** | Generic design with Frappe-style DocType thinking kept in mind. |

**This document defines** what is being built, why the checklist-instance model is important, how scoring and hierarchy roll-up work, what core entities are needed, and how the first version can be visualized and extended.

# **1\. Product overview**

The system is a process management and operational KPI solution built around recurring SOP execution. Each person receives checklist-based work relevant to their role and period, such as daily, weekly, or monthly activities. Completion of those checklist items produces an individual score. Scores roll upward through the reporting hierarchy so that supervisors, managers, area heads, and leadership can see both their own execution and the operational health of the teams below them.

* Primary operating model for version 1: person-to-person assignment.  
* Primary business fit: restaurants, retail, branch operations, office facilities, field operations, and similar recurring process environments.  
* Core outcome: turn SOP compliance into a measurable KPI system rather than a static document library.

# **2\. Core functional idea**

| Layer | What it represents | Example | Why it matters |
| ----- | ----- | ----- | ----- |
| SOP Template | A reusable process definition | Kitchen opening checklist | Defines standard operating expectation |
| Checklist Item | An individual step inside the SOP | Switch on exhaust, sanitize counters | Atomic action that can be completed or missed |
| SOP Run / Checklist Run | The actual occurrence for a specific date or period | Kitchen opening checklist for 12 Mar | Stores execution history and enables KPI calculation |
| Hierarchy Roll-up | Aggregation of scores upward | Supervisor sees cleaners, CEO sees branches | Makes execution visible at management level |

# **3\. Design principles**

* Keep template definition separate from actual execution records.  
* Treat scoring as a data-calculation layer based on actual completion only.  
* Keep deadline rules, lock rules, and late-completion rules outside the scoring model.  
* Allow hierarchy visibility at every level without losing drill-down to the individual task level.  
* Support recurring operations first; support more complex assignment patterns later.

# **4\. Template vs instance model**

A template defines what should happen. An instance records what actually happened. This distinction is essential. Without instances, the system may know the checklist structure but cannot reliably show what was completed on a given day, what was missed, who completed it, or how the score changed over time.

## **Simple analogy**

| ERP-style analogy | Template side | Instance side |
| ----- | ----- | ----- |
| Quality | Quality Inspection Template | Quality Inspection |
| Projects | Project Template | Generated project / task execution |
| Subscriptions | Plan | Generated invoice |
| This solution | SOP Template | SOP Run / Checklist Run |

## **Practical example**

Template: 'Kitchen cleaning checklist' with three items. Instance: 'Kitchen cleaning checklist for 12 March 2026 assigned to Cleaner A'. Cleaner A completes two items and misses one. The instance stores 2/3 completion for that date. That instance is what feeds the score.

# **5\. Recommended core modules / entities**

| Entity | Purpose |
| ----- | ----- |
| Hierarchy Node or Employee Mapping | Defines reporting structure. In a simple first version this can be represented by a manager field on the user/employee. |
| SOP Template | Top-level process definition. Can include title, department, role relevance, frequency, active status, and optional owner. |
| SOP Checklist Item | Child items under the template. Each item can include description, sequence, optional weight, and optional evidence requirement. |
| SOP Assignment | Links a template to a person. In future this can expand to role, branch, or team-based assignment. |
| SOP Schedule Rule | Defines when an SOP should generate runs: daily, weekly, monthly, shift-based, or custom recurrence. |
| SOP Run | Generated execution record for a specific period and assigned person. |
| SOP Run Item | Generated checklist items inside each run. Stores status, completion time, notes, and evidence. |
| Score Snapshot | Optional summary table storing precomputed own, team, and combined scores for faster dashboarding. |

# **6\. Suggested foundational data model**

## **6.1 Hierarchy**

For the first version, the cleanest model is a person-to-person reporting chain. Each person points to an immediate manager. This creates a tree that can be traversed upward for score roll-up and downward for drill-down.

| Field | Example | Notes |
| ----- | ----- | ----- |
| person / employee | Cleaner A | Primary person record |
| reports\_to | Supervisor 1 | Immediate manager |
| branch / location | Branch 12 | Optional but useful for filtering |
| role | Cleaner | Useful for reporting and assignment |
| is\_active | Yes | Prevents retired hierarchy nodes from affecting current scoring |

## **6.2 SOP Template**

| Field | Example | Notes |
| ----- | ----- | ----- |
| template\_name | Kitchen opening SOP | Human-readable title |
| department | Operations | Optional classification |
| frequency\_type | Daily | Could be daily/weekly/monthly/custom |
| active\_from / active\_to | 2026-03-01 / blank | Controls generation period |
| owner\_role | Cleaner | Role relevance only; assignment still person-based in v1 |
| is\_active | Yes | Only active templates generate runs |

## **6.3 SOP Checklist Item**

| Field | Example | Notes | V1 or later |
| ----- | ----- | ----- | ----- |
| description | Sanitize counters | Actual checklist step | V1 |
| idx / sequence | 10 | Display order | V1 |
| weight | 2 | Supports weighted scoring | Later or optional in V1 |
| evidence\_required | Photo | Can remain disabled initially | Later |
| item\_type | Checkbox | Could expand to numeric/yes-no/photo | Later |

## **6.4 Assignment and Schedule**

Assignments should be separate from templates. This allows the same SOP template to be assigned to multiple people without duplicating the template.

| Entity | Key fields | Example | Purpose |
| ----- | ----- | ----- | ----- |
| SOP Assignment | template, person, active | Kitchen opening \-\> Cleaner A | Defines who should receive the SOP |
| Schedule Rule | frequency, day logic, recurrence | Daily at start of day | Defines when runs are generated |
| Run Generator | template \+ assignment \+ date | 12 Mar generation job | Creates actual execution records |

## **6.5 SOP Run and SOP Run Item**

| Record | Key fields | Status examples | Why needed |
| ----- | ----- | ----- | ----- |
| SOP Run | template, person, period\_date, status | Open / Closed / Locked | One execution record for one person and one period |
| SOP Run Item | run, template\_item, status, completed\_at | Pending / Completed / Missed | Stores actual execution of each checklist item |

# **7\. Scoring model**

Scoring should remain simple and explainable in the first version. The score engine should calculate from actual run data only. Validation logic, deadline logic, and locking logic should remain separate.

## **7.1 Individual score**

For a selected period, the person's own score is:

**own\_score \= completed\_run\_items / total\_run\_items**

## **7.2 Team aggregate score**

For a manager, the team aggregate score is calculated from all active subordinates in the reporting tree for the selected period. The simplest version is an average of each subordinate's own score. Later versions may use weighted roll-up by branch size, headcount, criticality, or task volume.

**team\_score \= average(own\_score of all subordinates in scope)**

## **7.3 Combined score**

Managers should be able to view their own score and team score separately, while also having a combined operational score for a high-level KPI.

**combined\_score \= blend(own\_score, team\_score)**

For version 1, the blend can be a simple average when both exist. If a role has no own checklist load, the combined score can default to the team score.

## **7.4 Suggested scoring rules for version 1**

* Each checklist item is counted equally unless weighting is explicitly enabled.  
* Only generated run items are part of the denominator.  
* A missed or locked item remains incomplete and therefore lowers score.  
* Score is always calculated within a period such as today, week, month, or custom range.

# **8\. Hierarchy aggregation logic**

Hierarchy aggregation should flow from the lowest level upward. Every person has an own score. Managers additionally receive a team score built from direct and indirect reports.

| Level | Own score | Team score source | What they see |
| ----- | ----- | ----- | ----- |
| Cleaner | From own runs | None or not applicable | Own execution |
| Supervisor | From own runs | Cleaners under them | Own \+ team |
| Area Manager | From own runs | Supervisors and their teams | Own \+ team \+ drill-down |
| CEO / Leadership | Optional own runs | Whole reporting tree in scope | High-level operational view with drill-down |

For implementation, this usually means traversing the reporting tree recursively. In a Frappe-friendly design, precomputing score snapshots by period can reduce dashboard load.

# **9\. Visualization and dashboard approach**

Visualization should support both quick executive scanning and operational drill-down.

| Visualization | Best used for | Audience |
| ----- | ----- | ----- |
| Gauge / speedometer | Combined operational score at a glance | Leadership, branch heads |
| Trend line | Score movement over day/week/month | Managers, operations review |
| Bar chart by person/team | Compare teams or branches | Managers, regional heads |
| Heatmap / missed task matrix | Locate failure areas quickly | Operations teams |
| Hierarchy drill-down cards | Move from CEO to branch to person | Leadership and auditors |

## **Recommended dashboard views**

* My Tasks: open runs and checklist completion for the logged-in person.  
* My Score: own score by selected period.  
* My Team: direct reports with score, status, and exceptions.  
* Operations Overview: combined operational score for the reporting tree.  
* Exception View: people, branches, or SOPs with persistent low completion.

# **10\. Validation layer kept separate from scoring**

The system should treat scoring and validation as separate concerns. Scoring answers what happened. Validation controls whether a user is still allowed to mark a checklist item complete.

| Concern | Examples | Should affect scoring formula directly? |
| ----- | ----- | ----- |
| Scoring | Completed items, total generated items | Yes |
| Validation | Cut-off time, lock after tomorrow 10 AM, late completion window | No |
| Workflow control | Notifications, escalations, reminders | No |

Example: a daily checklist generated for 12 March may be completable until 13 March at 10:00 AM. After that, the run item becomes locked or missed. The score still comes from the final state of the run item, not from time arithmetic inside the score formula.

# **11\. Future extensions**

* Assignment to branch, location, department, or role in addition to person-based assignment.  
* Weighted scoring by item importance or business criticality.  
* Evidence capture such as photos, notes, signatures, or file attachments.  
* Escalation rules for overdue, incomplete, or repeatedly missed checklist items.  
* Branch-level and region-level operational hierarchy separate from HR reporting hierarchy.  
* Shared assignments where one SOP can be jointly completed by multiple users.  
* Advanced item types such as numeric readings, yes/no checks, or conditional follow-up tasks.

# **12\. Recommended first-phase scope**

| In scope for phase 1 | Reason | Keep out for now |
| ----- | ----- | ----- |
| Person-based hierarchy, SOP templates, checklist items, assignments, recurring run generation, run item completion, own/team/combined scores, basic dashboard | This is enough to prove the KPI roll-up model and operational visibility | Branch assignment, complex weighting, shared completion, advanced validation, evidence-heavy flows |

# **13\. Proposed Frappe-friendly DocType list**

Keeping the design generic but implementation-ready for Frappe, the following DocTypes are a strong starting point.

| DocType | Purpose |
| ----- | ----- |
| SOP Template | Master definition of an SOP |
| SOP Template Item | Child table for checklist items |
| SOP Assignment | Who gets which SOP |
| SOP Schedule Rule | How and when generation happens |
| SOP Run | Execution header for a specific period and person |
| SOP Run Item | Execution child items and status |
| Score Snapshot | Optional precomputed KPI summary |

# **14\. Closing summary**

This solution is not just a checklist app. It is an operating framework that turns recurring SOP execution into measurable organizational performance. The strongest foundation is a template-plus-instance model, person-based assignment, clean reporting hierarchy, explainable scoring, and separate validation rules. Built this way, the system starts simple but can grow naturally into a broader operations platform across branches, departments, and leadership levels.