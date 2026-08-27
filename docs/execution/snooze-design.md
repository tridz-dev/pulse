# Snooze Policy Design

Status: design contract for S5-T01 implementation

## Overview

Snooze is an optional, opt-in mechanism that allows a run's deadline to be deferred
without changing its compliance result semantics. An employee may request to extend
the deadline for a SOP run; the extension is governed by a multi-level policy that
defines who can snooze, why, and for how long.

This design preserves the frozen scoring contract in 06-domain-contracts.md: snooze
does not invent new compliance states or change how runs are classified during
deadline finalization. It works by deferring the effective deadline; scoring treats
a snoozed run the same as any Pending run before its (extended) deadline.

## 1. Policy Hierarchy

Snooze policy is configurable at four levels, with lower levels overriding higher:

| Level | Location | Scope |
| --- | --- | --- |
| Organisation | Site-level default | Applies to all SOPs unless overridden |
| Role | Pulse Role document | Applies to assignments with that owner_role |
| Hierarchy node | Pulse Department or direct manager | Applies to descendants in the reporting tree |
| SOP Template | SOP Template document | Applies only to this template, highest precedence |

At run generation, the effective policy is determined by resolving overrides in this
order (first match wins):
1. SOP Template snooze_policy field (if populated)
2. Template's owner_role → Pulse Role snooze_policy (if populated)
3. Employee's department → Pulse Department snooze_policy (if populated)
4. Organisation-level snooze_policy setting

Policy resolution is frozen at generation time in the run's snapshot.

## 2. Policy Configuration Fields

Each policy level stores a single structured policy document or configuration:

### Policy Attributes

- **snooze_allowed** (boolean, required): Whether snoozing is permitted for this
  scope. Default: false (opt-in).

- **snooze_requires_approval** (boolean, required): Whether a snooze request must
  be approved by a designated authority before taking effect. Default: true.

- **snooze_approval_role** (Link to Pulse Role, optional): Role required to approve
  snooze requests. If blank, the employee's direct manager approves. If specified,
  users in that role can approve.

- **snooze_reason_options** (Table with rows: `reason_code`, `reason_label`):
  Predefined snooze reasons (e.g., "Resource Unavailable", "Awaiting Input",
  "Technical Issue", "Leave Approved"). If empty, free-text only.

- **snooze_allow_free_text** (boolean, required): Allow employees to enter custom
  reasons beyond predefined options. Default: true.

- **max_snooze_duration_hours** (Int, positive, optional): Maximum duration in
  hours for a single snooze. If blank, no limit. Example: 48 (hours).

- **max_snooze_count_per_month** (Int, positive, optional): Maximum number of
  snoozes allowed per month per employee per SOP template. If blank, unlimited.
  Example: 3.

- **max_total_snooze_minutes_per_month** (Int, positive, optional): Maximum total
  snooze duration (summed across all snoozes) per month per employee per SOP
  template. If blank, unlimited. Example: 2880 (48 hours).

- **snooze_extends_past_completion_window** (boolean): If true, snooze can extend
  the deadline beyond the original completion_window_minutes. If false, snooze can
  only shorten the effective deadline (not typical). Default: true.

## 3. Snooze Lifecycle Fields

These fields are added to `SOP Run` to track and enforce snoozing:

### Snapshot Fields (frozen at generation)

- **snooze_policy_marker** (JSON, read-only): Snapshot of the effective snooze
  policy at run generation, including all attributes above. Enables historical
  audits even if policy changes later.

- **snooze_policy_enabled_snapshot** (boolean, read-only): Whether snooze was
  permitted at generation time.

### Operational Fields

- **snooze_status** (Select: None / Active / Expired / Revoked, default: None):
  Current state of snooze for this run.
  - **None**: Run has never been snoozed or snooze was revoked.
  - **Active**: Run is currently under snooze; deadline extended to snooze_until.
  - **Expired**: Snooze window closed; deadline finalization processed the expired
    snooze.
  - **Revoked**: Snooze was cancelled before expiration (e.g., by manager).

- **snooze_until** (Datetime, optional): Extended deadline if snoozed. Null if
  snooze_status = None. Must be >= due_at. Updated each time a new snooze is
  applied.

- **snooze_requested_at** (Datetime, optional): When the most recent snooze was
  requested.

- **snooze_requested_by** (Link to Pulse Employee, optional): Employee who
  requested the snooze.

- **snooze_reason** (Data, optional): Why the snooze was requested (matches a
  predefined reason_code or free-text string).

- **snooze_approved_at** (Datetime, optional): When snooze was approved (null if
  snooze_requires_approval = false or snooze_status = None).

- **snooze_approved_by** (Link to Pulse Employee, optional): User who approved the
  snooze.

- **snooze_count** (Int, default: 0): Total number of times this run has been
  snoozed (including active, expired, and revoked snoozes).

- **snooze_audit_trail** (Table with columns: `requested_at`, `requested_by`,
  `reason`, `requested_duration_minutes`, `approved_at`, `approved_by`,
  `snooze_until`, `expires_at`, `status`): Immutable log of all snooze requests
  for this run, including rejected and revoked ones. Enables full audit trail.

## 4. Snooze Request and Duration Behavior

### Snooze Request Lifecycle

1. **Employee initiates**: Snooze request submitted with reason and desired extension
   duration (hours or minutes).

2. **Validation**:
   - Check snooze_policy_enabled_snapshot: if false, reject.
   - Check max_snooze_duration_hours: if requested duration exceeds, reject or cap.
   - Check max_snooze_count_per_month: if employee already used max snoozes this
     month, reject.
   - Check max_total_snooze_minutes_per_month: if total snooze this month would
     exceed limit, reject or reduce duration.
   - Check snooze_reason: if not in predefined list and free-text not allowed,
     reject.

3. **Approval** (if snooze_requires_approval = true):
   - Route to snooze_approval_role or employee's manager.
   - Approver accepts or rejects.
   - If rejected, return to initial state.

4. **Activation**: Once approved (or if approval not required):
   - Set snooze_status = Active.
   - Calculate snooze_until = now + requested_duration.
   - Record snooze_requested_at, snooze_requested_by, snooze_approved_at (if
     applicable).
   - Append entry to snooze_audit_trail.
   - Update snooze_count += 1.

### Duration Calculation

- **Snooze extension formula**: `snooze_until = max(now + duration, due_at + min_extension_minutes)`
  - The new deadline is at least the current time plus requested duration.
  - Cannot be less than original due_at (no retroactive deadlines).

- **Example**: Run due at 2024-02-15 14:00, now is 2024-02-15 15:30 (30 min overdue),
  employee requests 4-hour snooze:
  - snooze_until = max(2024-02-15 19:30, 2024-02-15 14:00) = 2024-02-15 19:30 (in
    practice, respects the 4-hour from now)

### Snooze Revocation

- Manager or snooze_approval_role can revoke an active snooze at any time.
- Set snooze_status = Revoked.
- Record in snooze_audit_trail.
- Run reverts to original due_at for deadline finalization purposes.

## 5. Scoring Semantics

This section defines how snoozed runs participate in compliance scoring, preserving
the frozen contract in 06-domain-contracts.md.

### Scoring Algorithm (No Changes Required)

The existing scoring logic remains unchanged:

```
eligible = Passed runs + Failed runs
score = Passed runs / eligible runs
```

Where:
- `Passed`: compliance_result = Passed (completed_at <= due_at)
- `Failed`: compliance_result = Failed (deadline elapsed before completion)
- `Pending`: excluded from eligible (runs before their deadline)

### Classification During Snooze Window

While `snooze_status = Active` and `now < snooze_until`:
- The run is treated as **Pending** for scoring purposes.
- It is excluded from the eligible run count.
- It does not affect the score (neither passes nor fails).
- The run may still be marked operationally as "Overdue" in UI (past original due_at),
  but compliance classification remains Pending.

### Classification After Snooze Expires

Once `now >= snooze_until`:

1. **If still not completed**: The deadline finalization job sets
   `compliance_result = Failed` and `snooze_status = Expired`.
   - The run enters the eligible set as a failed run.
   - Score is recalculated if this is the first failure or a state change.

2. **If completed before snooze_until**: Compliance classification is determined by
   the original due_at:
   - If `completed_at <= due_at`: `compliance_result = Passed` (green: employee
     completed within the original deadline).
   - If `due_at < completed_at <= snooze_until`: `compliance_result = Failed` (red:
     employee missed the original deadline, even though snooze was granted). This is
     intentional: snooze defers the "now fails" moment, not the "completion is
     considered on-time" criterion.

### Scoring Scenarios

| Scenario | SNooze Status | Now vs Due At | Completed At | Compliance Result | In Eligible Set? | Score Impact |
| --- | --- | --- | --- | --- | --- | --- |
| Never snoozed, on time | None | now < due | < due | Passed | Yes | +1 pass |
| Never snoozed, late | None | now >= due | > due | Failed | Yes | +1 fail |
| Snoozed, within window, not done | Active | due < now < snooze_until | not yet | Pending | No | None (excluded) |
| Snoozed, window expires, not done | Expired | now >= snooze_until | not yet | Failed | Yes | +1 fail |
| Snoozed, complete before snooze_until, after original due | Active | due < now < snooze_until | between due and snooze_until | Failed | Yes | +1 fail |
| Snoozed, complete within snooze_until, before original due | Active | now < snooze_until | < due | Passed | Yes | +1 pass |

### Period Scoring

Period-based scoring (e.g., "score for the month of March") selects runs by their
frozen `due_at`, not snooze_until:

- A run with due_at in March appears in March's score, regardless of snooze_until.
- This ensures historical period scores remain stable (the due_at never changes).
- If snooze_until extends into April, the run still belongs to March's period but
  the compliance result may be finalized in April.

## 6. Snooze Audit and Visibility

### Audit Trail

- Every snooze request, approval, and revocation is logged in snooze_audit_trail
  (immutable).
- This enables:
  - Manager review of snooze patterns (early warning of resource/execution issues).
  - Compliance audits (does the policy prevent abuse?).
  - Late feedback (if a snooze is revoked due to improved availability).

### Who Can View/Action Snoozes

- **Employee**: Can view their own snooze requests and audit trail.
- **Direct Manager** (or snooze_approval_role if configured): Can view, approve,
  reject, or revoke snooze requests for their direct reports.
- **Department Head / Hierarchy above**: Can view snooze trends in their subtree
  (if needed for risk assessment).
- **Pulse Admin**: Full view and override capability.

## 7. Why This Design Does Not Break Scoring Fundamentals

**Done check**: "A later implementation can add snooze without changing compliance
scoring fundamentals."

This design achieves that by:

1. **No new compliance states**: Snooze does not invent states beyond Pending/Passed/Failed.

2. **Scoring logic unchanged**: The eligible run calculation, score formula, and
   period semantics remain identical. Scoring only consults:
   - `compliance_result` (Pending/Passed/Failed)
   - `completed_at`
   - `due_at`
   - Current evaluation instant

3. **Deadline deferral, not state change**: Snooze defers when a run's compliance
   result is finalized, not what that result is. If a run completes after
   snooze_until, it is Failed—because it missed the original deadline. Snooze only
   postpones the moment the system applies that failure.

4. **Backward-compatible**: Runs generated before snooze was implemented have
   `snooze_policy_marker = null` and `snooze_status = None`. Scoring treats them
   identically to new runs without snooze.

5. **Snapshot-based policy**: Policy is frozen at run generation. Later changes to
   policy do not affect scoring of historical runs. Scoring remains deterministic.

## 8. Future Extensions (Out of Scope)

- **Snooze chains**: Requesting another snooze after first snooze expires.
- **Escalation on snooze**: Notify hierarchy if a run is snoozed too many times.
- **Snooze reason analytics**: Dashboards showing most common snooze reasons per team.
- **Snooze delegation**: One person requesting snooze on behalf of another.
- **Approval workflows**: Multi-step approval chains (e.g., manager then director).

These may be added in later milestones without changing the core snooze model.

## 9. Implementation Notes for DocType Design (When Promoted)

When DocTypes are designed and implemented, follow these field ownership rules:

**New DocType: Snooze Policy**
- Name: "Snooze Policy"
- Parent link from: Pulse Role, Pulse Department, SOP Template, and organisation settings
- Fields: snooze_allowed, snooze_requires_approval, snooze_approval_role,
  snooze_reason_options (table), snooze_allow_free_text, max_snooze_duration_hours,
  max_snooze_count_per_month, max_total_snooze_minutes_per_month,
  snooze_extends_past_completion_window

**Modified DocType: Pulse Role**
- Add field: "snooze_policy" (Link to Snooze Policy, optional)

**Modified DocType: Pulse Department**
- Add field: "snooze_policy" (Link to Snooze Policy, optional)

**Modified DocType: SOP Template**
- Add field: "snooze_policy" (Link to Snooze Policy, optional)

**Modified DocType: SOP Run**
- Add fields: snooze_policy_marker (JSON), snooze_policy_enabled_snapshot (Check),
  snooze_status (Select), snooze_until (Datetime), snooze_requested_at (Datetime),
  snooze_requested_by (Link), snooze_reason (Data), snooze_approved_at (Datetime),
  snooze_approved_by (Link), snooze_count (Int), snooze_audit_trail (Table)

**New table child: Snooze Audit Row**
- Parent: SOP Run (in snooze_audit_trail)
- Fields: requested_at, requested_by, reason, requested_duration_minutes,
  approved_at, approved_by, snooze_until, expires_at, status (Select:
  Approved/Rejected/Revoked/Expired)
