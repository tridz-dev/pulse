# C5 · Coverage Model — Scoping Document

> **STATUS: SCOPING ONLY. DO NOT IMPLEMENT FROM THIS DOCUMENT.**
> This is a product/fairness policy question, not an engineering call. Section 3
> lists explicit open questions that require a human decision before any
> implementation task is created. No task in Section 4 should be picked up
> until that sign-off happens. This document does not itself authorize any
> code change.

## 0. What the code actually does today (verified)

- `SOP Assignment` (`pulse/pulse_core/doctype/sop_assignment/sop_assignment.json`)
  binds exactly one `template` to exactly one `employee`. Fields beyond that
  are schedule overrides (timezone, start time, completion window) and
  `is_active`. **There is no shift, roster, date-range validity, or leave
  field on this DocType.**
- `Pulse Employee` (`pulse/pulse_setup/doctype/pulse_employee/pulse_employee.json`)
  has a single `is_active` checkbox and nothing else that models
  availability, leave, or temporary status. There is no leave calendar, no
  "on leave from/to" field.
- Run generation (`pulse/tasks.py:_active_assignments_for_frequency`) filters
  only on `SOP Assignment.is_active` and `SOP Template.is_active` — it does
  **not** check `Pulse Employee.is_active`. This means deactivating an
  employee (`pulse/api/people.py:deactivate_employee`) does **not** stop runs
  generating against their still-active assignments; there is no cascade.
  `pulse/api/assignments.py:deactivate_assignment` is a separate, manual
  action a manager must take per-assignment. This is a related gap worth
  flagging to the human alongside C5, not something this doc proposes fixing
  on its own.
- Scoring is driven by `pulse/domain/compliance.py:classify_runs`, which is
  pure and DB-free: a run's `compliance_result` is `Passed`/`Failed` once
  stored (immutable), or `Pending`, in which case a Pending run whose
  `due_at` has passed `evaluation_instant` is **read-time-derived as
  Failed** for scoring only (nothing is written back at read time). A
  Pending run before `due_at` is simply excluded from `eligible_runs`. This
  is the exact mechanism that turns "Arun didn't do it because he wasn't
  there" into "Arun failed": his run generates, sits Pending, passes its
  `due_at` with zero completed items, and is derived Failed the next time
  anyone reads a score.
- The legacy `_calculate_score_snapshot` in `pulse/api/scores.py` sums
  `total_items`/`completed_items` across all runs for an employee in a
  period with no absence concept either; it is marked LEGACY/superseded by
  `classify_runs` but still wired into Insights/Operations, so any coverage
  fix must eventually reconcile with it or accept it will be replaced.

**Minimum surface a coverage concept must touch to change a real scoring
outcome:** the run's `compliance_result` (to stop it deriving to Failed) or
the run's eligibility for the denominator (to exclude it from
`classify_runs`'s `eligible_runs` entirely) — plus something upstream, at or
before run generation, if the goal is for someone else to actually do the
checklist. Nothing else in the current codebase reacts to absence.

## 1. The product question

**Does "coverage" mean (a) fairly not-blaming someone for a checklist that
didn't happen, or (b) making sure the checklist happens anyway via someone
else? These are different problems and the two most obvious model shapes
solve different halves of it.**

### Option A — "Mark absent" (after-the-fact scoring correction)

A manager marks a specific employee absent for a specific date or date
range, before or after the runs in question have generated. Runs generated
for that employee in that window are pulled out of `eligible_runs` (not
scored, not counted Failed, not counted Passed) but remain visible in an
org/manager view as "uncovered" — the checklist itself did not get done by
anyone, and a manager needs to see that, distinct from "employee failed
personally."

- **Data model:** smallest version needs one new thing — either (i) a new
  `Coverage Exception` / `Absence` DocType (employee, date range, reason,
  marked_by, created_at) that scoring joins against, or (ii) a new field
  directly on `SOP Run` (e.g. `excluded_reason` = "Absence") set by a
  whitelisted API that also nudges `compliance_result` to something
  `classify_runs` treats as non-eligible (a new terminal state, or simply
  leaving it Pending and teaching `classify_runs` to never read-time-derive
  a run flagged as excluded).
- **Does NOT solve:** the checklist still doesn't get done by anyone. This
  is a scoring-fairness patch only. If the business needs the kitchen
  actually opened correctly regardless of who's rostered, Option A alone is
  not sufficient — it just stops punishing the absent person for it.
- **Smallest viable version:** a manager-only whitelisted endpoint that,
  given employee + date range + optional reason, marks the runs already
  generated for that window as excluded from scoring (works only on runs
  not yet finalized — see Section 2), plus a flag surfaced in Operations /
  Mission Control so "0 eligible, 1 uncovered" is visibly different from "0
  eligible, 0 runs" or a real Passed/Failed.

### Option B — "Delegate/reassign" (coverage before generation)

Before runs generate, a manager reassigns an `SOP Assignment` to a
substitute employee for a date range. Runs then generate for the substitute
instead of the original assignee, and the checklist is actually expected to
get done.

- **Data model:** needs either (i) a date-range-scoped override on `SOP
  Assignment` (a `substitute_employee` + `valid_from`/`valid_to` triple that
  `_active_assignments_for_frequency` must consult at generation time), or
  (ii) a first-class `Assignment Delegation` DocType linking the original
  assignment, the substitute, and a window, which generation joins against.
  This is a materially larger change than Option A: it touches the run
  generation query itself (currently a flat filter on
  `is_active`/`frequency_type`), needs to decide what "historical runs
  preserve the effective assignment context at generation time" (a stated
  CONTEXT.md invariant) means when the *effective* assignee is a delegate,
  and needs UI for a manager to actually set this up per employee per
  date — which is more roster/scheduling surface than exists anywhere in
  this codebase today (there is no shift or roster concept at all).
- **Does NOT solve:** unplanned, same-day absence — a manager who wakes up
  to a sick call has no "before generation" window left if the run already
  generated for that morning. Option B only works for absences known in
  advance.
- **Smallest viable version:** a `substitute` field + `valid_from`/`valid_to`
  on `SOP Assignment`, consulted by `_active_assignments_for_frequency`
  when resolving which employee a run is generated for, no new DocType. Still
  a bigger lift than Option A because it changes generation logic, not just
  scoring logic.

### Option C — Hybrid: reassignment when planned, mark-absent as the
unplanned correction

Use Option B when a manager knows in advance (vacation, scheduled shift
swap); use Option A when they don't (sick call, no-show discovered after the
fact). This mirrors how real rosters actually work and is the only option of
the three that addresses both halves of the C5 problem — fairness *and*
coverage of the work — but it is the sum of both options' costs, not a
shortcut.

## 2. Recommendation

**Ship Option A first, narrowly scoped to runs that are not yet finalized,
as a standalone change. Treat Option B (or the full Option C hybrid) as a
distinct, larger fast-follow, not a phase of the same task.**

Justification:

- **(a) Engineering cost:** Option A is the smallest true fix — one new
  field or small DocType, one whitelisted endpoint, one read/query change in
  `classify_runs` or its caller to exclude flagged runs, and a UI affordance
  for "uncovered." Option B requires touching run generation itself plus
  building rudimentary roster/delegation UI that doesn't exist in any form
  today — a much larger and riskier surface for a single scoping cycle.
- **(b) CONTEXT.md invariants:** Option A does not violate "not-yet-generated
  runs have no score" (untouched) or "historical runs preserve the effective
  template/assignment/deadline/hierarchy context at generation time" — the
  run's stored assignment/employee context is never rewritten; it is only
  excluded from the scoring denominator, which is exactly the kind of
  adjustment `classify_runs` already models via its `eligible_runs`
  concept. Option B, by contrast, would need to define what "effective
  assignment context" means when a substitute is filled in, which risks
  quietly rewriting or contradicting that invariant if done carelessly —
  another reason to keep it out of the first cut.
- **(c) Does it solve C5 or only partially:** Only partially, and that must
  be said plainly to whoever signs off. Option A fixes the *fairness*
  half — Arun is no longer scored as negligent for something outside his
  control. It does **not** fix the *coverage* half — nobody is on the hook
  to actually open the kitchen that day. If the business's real complaint is
  "the checklist didn't happen," Option A alone will look like it solved C5
  and hasn't. This must be called out explicitly to the reviewer, not
  glossed over — if the business need is "the work still happens," Option A
  is not sufficient and B/C must be prioritized instead.
- **(d) Audit/immutability (C8 interaction):** This is the sharpest edge and
  needs explicit precision. `CONTEXT.md` states finalized records are
  immutable and corrections use linked amendments. Recommendation: **mark-
  absent should only be permitted on runs whose `compliance_result` is still
  `Pending` (i.e., not yet stored as Passed or Failed) or on the read-time-
  derived-Failed state before it has been persisted as a finalized
  `Failed`.** It must **not** silently rewrite a run that has already been
  stored/finalized as `Failed` or included in an already-computed
  `Score Snapshot`. If the product decision is that managers also need to
  correct *already-finalized* Failed runs retroactively (e.g. discovered a
  week later that someone was out), that is a distinct, higher-risk feature
  and should be implemented as a genuine linked amendment record (a new
  `Coverage Amendment` pointing at the original `SOP Run` / `Score
  Snapshot`, per the C8 gap this repo already has open), not as a silent
  mutation of the original run. **This document does not resolve which of
  the two (Pending-only vs. amendment-of-finalized) the product wants —
  that is Open Question 1 below and must be answered before any
  implementation starts.**

## 3. Open questions requiring explicit human sign-off

These are policy calls, not engineering defaults. Do not let an
implementation task pick an answer unilaterally.

1. **Retroactive scope:** Can "mark absent" ever touch a run whose
   `compliance_result` is already finalized as `Passed` or `Failed` (and
   possibly already rolled into a `Score Snapshot`)? If yes, this requires a
   genuine amendment record (C8), not a field flip, and is a bigger feature
   than the "smallest viable version" described above. If no, mark-absent
   is only effective for Pending/not-yet-finalized runs and managers must be
   told "too late" for anything older.
2. **How far back can a manager retroactively mark absence?** Same day only?
   Same week? Unlimited? This directly gates the answer to Q1 and to how
   the UI should message the cutoff.
3. **Who can request it?** Can an employee request their own absence be
   marked (self-service, pending manager approval), or is this
   manager-initiated only in v1?
4. **Evidence requirement:** Does marking someone absent require an attached
   reason/evidence (e.g. linked to an HR leave record, if one ever exists),
   or is manager say-so alone sufficient? This has real audit-defensibility
   implications given C8 is already flagged as a procurement blocker for
   audit-focused customers.
5. **What "uncovered" looks like to the org, not just the individual:** Once
   a run is excluded from an employee's denominator, is it still surfaced
   anywhere as an operational gap ("nobody opened the kitchen") — to whom,
   and does it feed into a *manager's* or *location's* score at all, or does
   it just vanish from all scoring entirely? The doc assumes it should
   remain visible somewhere; the human should confirm that's actually
   wanted and decide where.
6. **Relationship to the employee `is_active` cascade gap:** Separately from
   coverage, deactivating a `Pulse Employee` today does not deactivate their
   `SOP Assignment`s, so runs keep generating for inactive employees. Should
   fixing that cascade be bundled into this task, treated as a prerequisite,
   or logged as an entirely separate defect? (Recommendation: separate
   defect — it's a correctness bug independent of the coverage policy
   question, but the human should decide priority.)
7. **Interaction with Option B/C for the fast-follow:** If the human wants
   coverage (not just fairness) sooner rather than later, does that change
   the priority of shipping Option A first at all, or would they rather wait
   and scope Option C as a single combined effort? This changes the shape of
   Section 4 below.

## 4. Bounded implementation task list (Option A only)

**DO NOT START any of these tasks until a human has answered the open
questions in Section 3, in particular Q1 (retroactive/finalized scope), Q2
(lookback window), Q3 (who can request), and Q4 (evidence requirement).**
Task order assumes those answers land as: Pending-only (no amendment of
finalized runs), manager-initiated, bounded lookback, reason optional.
Revise the list if the answers differ.

1. **Data model** — add a minimal way to record an absence exclusion.
   Simplest form: a `coverage_excluded` (Check) + `coverage_excluded_reason`
   (Small Text) + `coverage_marked_by` (Link to User) pair of fields on
   `SOP Run`, set only while `compliance_result` is `Pending`. (Avoids a new
   DocType for v1; revisit as a dedicated `Coverage Exception` DocType only
   if Q7's fast-follow makes reporting across runs necessary.)
2. **Scoring exclusion** — teach `pulse/domain/compliance.py:classify_runs`
   (or its caller) to skip any run with `coverage_excluded` set entirely
   (not counted Passed, Failed, or Pending) regardless of `due_at`. This is
   a pure-function change with unit tests mirroring the existing
   Passed/Failed/Pending test cases.
3. **Whitelisted endpoint** — a manager-scoped API (mirroring the
   permission pattern in `pulse/api/assignments.py`'s
   `_check_assignment_write_permission`) that, given employee + date range
   (and optional reason), finds matching `SOP Run` rows still `Pending` and
   sets the three fields from Task 1. Must reject runs already
   Passed/Failed per Q1's answer, with a clear error distinguishing "too
   late, already finalized" from "not found."
4. **Visibility surface** — expose `coverage_excluded` runs distinctly in
   whatever Operations/Mission Control view currently shows Passed/Failed
   counts, so "uncovered" is visibly different from "no runs" and from a
   real personal Failed. Depends on Task 2/3 landing first.
5. **Legacy path reconciliation** — check whether
   `pulse/api/scores.py:_calculate_score_snapshot` (LEGACY, still wired to
   Insights/Operations per its own comment) needs the same exclusion logic
   or whether it's acceptable to leave it inconsistent given it's already
   marked for removal. This needs a human/eng-lead call, not a default.
