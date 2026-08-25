# Acceptance Fixture Specification

Status: documentation only, frozen for S1-T06 fixture implementation

This file defines a deterministic demo fixture for the first-milestone contract.
It is intentionally specific so a later engineer can build the fixture without
making new product decisions. It does not change any prototype fixture code.

## Fixture scope

The fixture must model:

1. one exact three-level hierarchy plus one unassigned person;
2. two assignments with stable schedule keys and local schedule values;
3. one passed run, one failed run, one pending run, and one person with no
   eligible run;
4. explicit personal and inherited scores, including `1.0`, `0.0`, `0.5`, and
   `null`;
5. immutable finalized-run snapshot behavior after a template and manager
   change.

All names, dates, and keys below are fixed and must be used as written.

## Canonical hierarchy

Use this exact three-level reporting line:

- Executive: `Maya Iyer` with login user `maya.iyer@pulse.test`
- Area Manager: `Dev Shah` with login user `dev.shah@pulse.test`
- Supervisor: `Lina Fernandez` with login user `lina.fernandez@pulse.test`

The person at the bottom of the tree is the run owner:

- Operator: `Owen Patel` with login user `owen.patel@pulse.test`

The extra no-eligible-run person is outside the assignment scope:

- Operator: `Nora Singh` with login user `nora.singh@pulse.test`

Required reporting path at fixture creation time:

`Maya Iyer -> Dev Shah -> Lina Fernandez -> Owen Patel`

Required static context at fixture creation time:

- Department: `Operations`
- Branch: `North Branch`
- Time zone: `Asia/Kolkata`

## Assignments and schedule keys

Create exactly two assignments.

### Assignment A1

- Assignment identity: `A1`
- Template name: `Opening Hygiene Round`
- Assigned person: `Owen Patel`
- Local start time: `08:30`
- Deadline / completion window: `45 minutes`
- Schedule key for the generated window: `2026-08-24T08:30:00+05:30/PT45M`

### Assignment A2

- Assignment identity: `A2`
- Template name: `Closeout Audit`
- Assigned person: `Owen Patel`
- Local start time: `18:00`
- Deadline / completion window: `60 minutes`
- Schedule key for the generated window: `2026-08-24T18:00:00+05:30/PT60M`

The local schedule values are part of the fixture contract. The generated run
must freeze the effective time zone as `Asia/Kolkata`, and the schedule key must
remain stable on retry.

## Run set

Generate exactly these four subject cases:

### 1. Passed run

- Run key: `A1::2026-08-24T08:30:00+05:30/PT45M`
- Assignment: `A1`
- Person: `Owen Patel`
- Result: `Passed`
- Completion timing: completed before `due_at`
- Personal score for Owen on the selected period: `1.0`
- Eligible runs for Owen on the selected period: `1`

### 2. Failed run

- Run key: `A2::2026-08-24T18:00:00+05:30/PT60M`
- Assignment: `A2`
- Person: `Owen Patel`
- Result: `Failed`
- Completion timing: not completed by `due_at`
- Personal score for Owen on the selected period: `0.0`
- Eligible runs for Owen on the selected period: `1`

### 3. Pending run

- Run key: `A1::2026-08-25T08:30:00+05:30/PT45M`
- Assignment: `A1`
- Person: `Owen Patel`
- Result: `Pending`
- Completion timing: generated and still before due
- Personal score for Owen on the selected period: `0.5`
- Eligible runs for Owen on the selected period: `2`

The `0.5` value is the mixed two-run case: one passed run and one failed run are
eligible in the selected period, so the score is `1 / 2 = 0.5`. The pending run
is excluded from the denominator while still existing as a generated run.

### 4. No eligible run

- Person: `Nora Singh`
- Assignment: none
- Result: no generated or eligible run
- Personal score for Nora on the selected period: `null`
- Inherited score for Nora on the selected period: `null`
- Eligible runs for Nora on the selected period: `0`

## Expected visibility and score contract

Use the selected period that contains the two eligible Owen runs and the pending
Owen run, with the selected viewer context noted below.

### Executive viewer

Viewer: `Maya Iyer`

- Allowed visibility: organization scope
- Personal score for Maya: `null`
- Inherited score for Maya: `0.5`
- Visible people: `Maya Iyer`, `Dev Shah`, `Lina Fernandez`, `Owen Patel`
- Not visible as a score subject with eligible runs: `Nora Singh`

### Area Manager viewer

Viewer: `Dev Shah`

- Allowed visibility: subtree scope
- Personal score for Dev: `null`
- Inherited score for Dev: `0.5`
- Visible people: `Dev Shah`, `Lina Fernandez`, `Owen Patel`
- Excluded from inherited scope: `Dev Shah` personal runs do not count unless he
  has his own assignment in a later fixture

### Supervisor viewer

Viewer: `Lina Fernandez`

- Allowed visibility: subtree scope
- Personal score for Lina: `null`
- Inherited score for Lina: `0.5`
- Visible people: `Lina Fernandez`, `Owen Patel`

### Operator viewer with runs

Viewer: `Owen Patel`

- Allowed visibility: personal scope for own runs
- Personal score for Owen: `0.5`
- Inherited score for Owen: `0.5`
- Visible people: `Owen Patel`
- Explicit score breakdown:
  - passed runs: `1`
  - failed runs: `1`
  - eligible runs: `2`
  - pending runs excluded from score: `1`

### Person with no eligible run

Viewer / subject: `Nora Singh`

- Allowed visibility: personal scope only
- Personal score: `null`
- Inherited score: `null`
- Visible people: `Nora Singh`
- Explicit score breakdown:
  - passed runs: `0`
  - failed runs: `0`
  - eligible runs: `0`

## Snapshot immutability check

After both generated runs exist, mutate the live masters and verify the
historical run snapshots do not change.

Perform these later master changes:

1. change `Opening Hygiene Round` template title to `Opening Hygiene Round v2`;
2. change the assigned manager path so `Lina Fernandez` now reports to a new
   manager instead of `Dev Shah`;
3. change the department label to `Ops Services`;
4. change the branch label to `North Hub`;
5. change the site or user timezone context used for future scheduling.

The finalized run proof must remain immutable. For every already-generated run,
the frozen snapshot must still show:

- template identity and template title as they were at generation time;
- person identity and person display name as they were at generation time;
- reporting path as the original `Maya Iyer -> Dev Shah -> Lina Fernandez -> Owen Patel`;
- department as `Operations`;
- branch as `North Branch`;
- effective time zone as `Asia/Kolkata`;
- schedule facts, including local start time, completion window, and schedule
  key, exactly as originally generated;
- due timestamp and opens timestamp derived from the original frozen schedule.

The fixture is correct only if historical runs continue to render and score from
their frozen facts after the live masters have changed.

## Acceptance notes

- The fixture must explicitly contain `1.0`, `0.0`, `0.5`, and `null` score
  cases.
- The pending run must stay excluded from the denominator.
- The no-eligible-run case must stay `null`, not zero.
- A later S1-T06 implementation should be able to build the fixture from this
  document alone without deciding names, keys, or score semantics.
