# Pulse Product Plan

Status: planning baseline

This document records the product decisions and domain rules agreed during the initial Pulse discovery session. It is the working reference for implementation planning. The product is intentionally small at first, but the underlying language and boundaries should not prevent the system from growing into integrations, richer evaluations, and multiple communication channels.

For scoped execution by multiple agents, use the linked [Execution Pack](execution/README.md).

## 1. Product thesis

Pulse is the simplest way for an organisation that has implemented operating procedures to see whether those procedures are actually being followed.

The primary experience is a single, understandable compliance gauge:

- a high score is good;
- the left side of the gauge is red, the middle is orange/yellow, and the right side is green;
- leaders can drill from the organisation or their inherited team score to the responsible person, SOP, run, and evidence;
- people can switch from inherited team health to their own SOPs.

Pulse is an accountability and monitoring layer. It owns SOP definitions, assignments, execution runs, submissions, compliance scoring, and the audit trail around those records. It is not the source of truth for HR, ERP, POS, inventory, or other operational systems.

## 2. First customer and first milestone

The initial customer is a small or mid-sized organisation that recently introduced SOPs and now struggles to monitor them. Examples include service companies, restaurants, shops, and teams with several levels of responsibility.

The first milestone is a usable product for a company with roughly three or four hierarchy levels. A user must be able to:

1. create an organisation hierarchy;
2. create a recurring SOP and assign it;
3. generate a due run at the correct time-zone-aware deadline;
4. submit one run successfully and leave another incomplete;
5. see the compliance gauge change;
6. drill into the missed or failed SOP; and
7. see enough trend and failure analytics to decide what needs attention.

Onboarding can remain simple and direct in the first milestone. A polished setup wizard is a later usability improvement, not a reason to delay the vertical slice.

## 3. Product boundaries

### Primary module: SOP Compliance

This is the first product surface. It answers: “Did the assigned work happen on time?”

It contains SOP templates, assignments, schedules, generated runs, submissions, deadlines, compliance scoring, hierarchy roll-up, failure propagation, notifications, and mission control.

### Separate module: Evaluations and other templates

Quality checks are one example of a broader need. They should not be mixed into the compliance gauge or named as if “quality” were the only use case.

Pulse should eventually provide a generic template/evaluation model that can support quality checks, approvals, inspections, evidence capture, and other organisation-defined checklists.

The two dimensions remain separate by default:

- compliance: was the SOP completed on time?
- evaluation/outcome: what was the result of the work?

An SOP can be completed with 100% compliance while its evaluation fails. There is no combined score in the first milestone. A later overview may display the two sections together, but the domain models and dashboards remain independently understandable.

## 4. Canonical domain language

| Term | Meaning |
| --- | --- |
| Organisation | The customer boundary containing people, hierarchy, policies, and records. |
| Hierarchy | The canonical reporting tree used to assign responsibility and roll scores upward. |
| Person | A member of the organisation who may own, perform, approve, or receive notifications for work. |
| SOP Template | A versioned definition of recurring or on-demand work. |
| SOP Assignment | The relationship between an SOP template and a responsible person, team, or scope. |
| SOP Run | One generated occurrence of an assignment for a particular schedule window. |
| Compliance | The binary execution dimension: a run is either completed on time or not. |
| Evaluation | A separate result dimension such as pass/fail, a numeric threshold, a selectable outcome, or evidence review. |
| Gate | A required evaluation, approval, evidence, location, or external confirmation that can block completion. |
| Evidence | A file, photo, note, location, external reference, or other proof attached to a run or evaluation. |
| Event | An immutable fact received from a person, Pulse, or an external system. |
| Action | A requested side effect such as a notification, webhook, message, or external record update. |
| Mission Control | The manager-facing view of current health, unresolved work, ownership, duration, and next action. |

## 5. Domain rules and invariants

### Compliance scoring

- The first score is a binary execution score at the SOP run level.
- A run that has not yet been generated because it is not due is excluded from the denominator and has no score.
- Once a run is generated, it is eligible for scoring.
- A completed submission before the deadline contributes 100%.
- A run that reaches its due time without a valid completion contributes 0% and is overdue/failed according to lifecycle state.
- There is no partial completion score in the first milestone. Checklist items support the submission experience but do not independently affect the compliance score.
- If a customer needs independent partial outcomes, those are modelled as separate SOPs until a later scoring model is deliberately introduced.
- Initial aggregation is equally weighted. Future configuration may apply weights or criticality bias by SOP, department, branch, or business area.

The gauge must be reversed from the current prototype orientation: green represents the high end of the score.

Supported periods are day, week, month, and custom date range. A rolling three-month view is a useful later preset.

### Scheduling and runs

- Schedules are time-zone aware. “8:00 AM” means 8:00 AM in the relevant organisation, branch, or assignment time zone.
- The scheduling model should support daily, weekly, monthly, exact due times, and optional grace periods.
- On-demand SOPs are supported by the model but are not the normal first-use case.
- A run is created when its schedule says it is due, not months in advance.
- A generated run freezes the effective SOP version, checklist, assignment, deadline, and relevant policy values.

### Lifecycle and snooze

The initial lifecycle should be stable and understandable: not generated, open, in progress, completed, overdue, failed, and locked where applicable. Organisations may later configure transitions through Frappe Workflow, while Pulse retains ownership of deadline, overdue, score, and escalation semantics.

Snooze is an optional policy, not a universal default:

- it can be enabled per organisation, role, hierarchy level, or SOP;
- it may require a reason selected from a list, free text, or both;
- it may require approval;
- it may limit duration or number of snoozes;
- while valid, the snoozed run is temporarily excluded from scoring;
- after the new deadline, it becomes overdue and scores zero if incomplete.

Advanced snooze controls should be hidden behind an advanced settings section so the default setup remains simple.

### Failure, ownership, and escalation

A failure can produce one or more outcomes:

- notify the responsible person or an escalation target;
- notify a department head, manager, or custom group;
- create additional work for a manager;
- trigger both notification and additional work.

The default escalation target is the direct boss in the canonical hierarchy. An SOP or policy may override this to a higher level or a group. Group targets must support both standard hierarchy groups and custom notification groups.

Repeated failures, rising failure rates, overdue duration, and unresolved work may trigger alerts and mission-control actions.

The next successful run improves current health but does not erase the historical failure. Current health and unresolved history are separate views.

Equivalent active generated work should be deduplicated while every triggering event remains auditable.

### Hierarchy and permissions

- The first model is one canonical boss/reporting chain with no overlapping cross-hierarchy relationships.
- The data model should not make future multiple-manager relationships impossible.
- Scores roll upward through the hierarchy. A leader’s default view is the inherited health of the subtree below them.
- A personal-score view is always available as a separate toggle.
- Hierarchy changes are effective-dated.
- A generated run snapshots the responsible person, manager path, department, branch, and relevant hierarchy context. Historical runs remain attributed to the context in which they were generated.
- Future runs use the new hierarchy.

Permission resolution should be an abstraction from the beginning, implemented on top of Frappe’s permission model where possible. The resolver should be able to combine roles, hierarchy scope, department/branch scope, SOP policy, and explicit overrides.

### History and auditability

Submitted, failed, and otherwise finalized runs are immutable proof records. Corrections should use amendments or linked adjustments rather than changing the original transaction.

The event timeline should append facts such as generation, opening, submission, snooze, approval, overdue, failure, escalation, external completion, and evaluation attachment. A current run projection may be optimised for reads, but the timeline is the audit source for what happened.

Retention and scrubbing can become an organisation policy with a scheduled queue later. The initial default is to preserve history.

### Evaluations, gates, and evidence

Evaluations are independent from compliance and should use generic, neutral templates. The first useful input types are pass/fail, selectable outcomes, numeric or percentage values, thresholds, text, and evidence attachments.

Maker-checker and approval policies should use Frappe Workflow where it fits. If a required gate is not satisfied, the submission remains incomplete and the SOP run can fail. If an evaluation submission is the only required action, it should complete the linked SOP in one step rather than forcing duplicate submissions.

Future policies may require camera-only capture, geo-fencing, location records, evidence, or external confirmation. These are extension points, not first-milestone requirements.

## 6. Analytics contract

The primary drill path is:

`organisation → hierarchy node → department/branch → person → SOP template → run → checklist/evidence/event`

The first analytics contract should expose:

- current compliance gauge;
- submitted, overdue, failed, and snoozed rates;
- trend over time;
- score and failure comparison by hierarchy node;
- weakest subtree and contribution to inherited score;
- most-failed SOPs and repeated failures;
- late submission and completion-time patterns;
- unresolved failures, time to resolution, and escalation count;
- evidence or external-confirmation gaps where relevant.

Mission Control should prioritise “what needs attention first” using criticality, overdue duration, affected people, repeated failure, unresolved status, and hierarchy impact. The default scope is the manager’s subtree.

## 7. UX and information architecture

The product should make the common path obvious and keep complexity behind advanced settings.

Initial surfaces:

- My Work: today’s and upcoming runs, overdue items, and simple submission;
- Mission Control: inherited score, failing areas, owners, duration, and next actions;
- SOP Templates: create, version, schedule, assign, and configure policies;
- Evaluations/Templates: separate generic evaluation and checklist capabilities;
- Analytics: trends and drill-down;
- Administration: organisation, hierarchy, roles, groups, and advanced settings.

The front end owns the complete first-milestone workflow and must work on mobile widths. A responsive PWA is the initial channel. WhatsApp, Telegram, notifications, and external links are later entry points into the same domain actions.

## 8. Architecture direction

Pulse should remain a Frappe application with a focused domain layer and a frontend that calls explicit APIs rather than reaching directly into persistence details.

The architecture should preserve these boundaries:

- Frappe owns authentication, roles, permissions, workflows, files, background jobs, and persistence primitives.
- Pulse owns SOP scheduling semantics, run generation, compliance scoring, hierarchy roll-up, escalation policy, and domain events.
- External systems remain authoritative for their own operational records. Pulse consumes idempotent inbound events and emits idempotent outbound actions.
- An external event and an outbound action should both be immutable and traceable. Retries must not create duplicate logical completions.

The current repository already contains the initial SOP, assignment, run, scoring, corrective-action, hierarchy, and frontend surfaces. The plan is to consolidate behavior around the rules above rather than introduce a second parallel model.

## 9. Vertical-slice delivery plan

### Slice 1 — Reliable execution

Recurring SOP template, assignment, time-zone-aware due generation, binary submission, overdue handling, and the basic My Work surface.

### Slice 2 — Hierarchy health

Canonical hierarchy, inherited and personal gauges, equal-weight roll-up, reversed red-to-green gauge, and drill-down from organisation to failed run.

### Slice 3 — Mission Control and analytics

Failure lists, ownership, duration, current-vs-history distinction, trends, hierarchy comparison, SOP rankings, and the first prioritised manager view.

### Slice 4 — Snooze and escalation

Policy-controlled snooze, reason capture, limits, notification targets, custom groups, higher-level overrides, and manager follow-up work.

### Slice 5 — Immutable history

Version-frozen runs, append-only timeline, finalized proof records, effective-dated hierarchy context, and safe correction/amendment behavior.

### Slice 6 — Generic evaluations and gates

Neutral evaluation templates, pass/fail and numeric policies, evidence, approvals, blocking gates, and one-step linked completion.

### Slice 7 — Workflow and integrations

Configurable Frappe Workflow templates, inbound external events, outbound actions, attachments, webhooks, and scheduled retry/retention queues.

### Slice 8 — Additional channels

Mobile/PWA refinement followed by WhatsApp, Telegram, deep links, and lightweight forms that reuse the same permissions and domain actions.

## 10. First-slice acceptance test

An implementation is ready for the first milestone when a clean site can demonstrate this scenario:

1. Create a company with three hierarchy levels and at least two people.
2. Create and assign a daily SOP with a local due time.
3. Generate one due run and complete it.
4. Generate a second due run and leave it incomplete past the deadline.
5. Confirm the completed run contributes 100% and the missed run contributes 0%.
6. Confirm the leader’s inherited gauge rolls up the result and the personal toggle shows the correct personal view.
7. Drill down from the gauge to the person, SOP, and run causing the loss.
8. Confirm the run’s effective template and hierarchy context remain inspectable after a later template or hierarchy change.

## 11. Explicit non-goals for the first milestone

- weighted or criticality-based scoring;
- partial completion scoring;
- combined compliance-plus-evaluation score;
- overlapping multi-manager hierarchy;
- full onboarding wizard;
- WhatsApp or Telegram execution;
- camera-only capture and geo-fencing;
- broad ERP/POS integrations;
- arbitrary workflow designer beyond a stable lifecycle and an integration seam.

These are not rejected ideas. They are deliberately held behind the first usable vertical slice.

## 12. Open extension points to protect

- configurable score weights and criticality;
- multiple hierarchy relationships;
- generic evaluation policies and custom outcome values;
- required gates and maker-checker approvals;
- evidence, camera, and location constraints;
- event-driven failure chains and generated manager work;
- external events and outbound actions;
- retention/scrubbing and scheduled queues;
- additional channels and offline/mobile execution.

When a new feature is proposed, first decide whether it belongs to compliance, evaluation, permissions, workflow, events/actions, or presentation. Keeping those boundaries clear is more important than predicting every future field.
