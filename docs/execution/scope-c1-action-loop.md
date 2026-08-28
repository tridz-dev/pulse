# C1 Scope: Action Loop for Failed Runs (Mission Control)

Status: scoping spec only — no code in this document is to be treated as merged.
Traces to: `docs/execution/product-gap-analysis.md` C1 — "There is no action loop —
the product only reports."

## 0. Summary decision

**Route every C1 action (acknowledge, assign, waive-with-reason, snooze, escalate)
through Corrective Action (CA). Do not add any new field to SOP Run, and do not
give any C1 action write access to `compliance_result`.**

Reasoning is in section 2. The short version: `docs/execution/06-domain-contracts.md`
§3 says a normal completion endpoint must never turn `Failed` into `Passed`, and
§5 says "true unresolved/resolved state requires the later corrective-action/event
work and must not be inferred from a later successful run." That is a direct
instruction that resolution state lives outside SOP Run. SOP Run's frozen fields
(`compliance_result`, `completed_at`, `due_at`, snapshot fields) are the scoring
record of what happened; CA is the mutable record of what management did about it.
Keeping them separate means C1 ships without touching the scoring contract at all,
so nothing here needs sign-off against the frozen scoring rules — it is purely
additive.

The one exception: **snooze** is a deadline mechanism, not a follow-up-tracking
mechanism, per `snooze-design.md`. It cannot be modeled as a CA because it changes
which classification a *still-open* run receives at finalization (Pending vs
Failed), which is a SOP Run scheduling concern, not a post-hoc annotation on an
already-`Failed` run. Snooze is therefore out of scope for "acting on a failure
already in the Failed list" — see §1 and §2.5 for why it's handled differently
and is **not part of this C1 slice**.

## 1. What already exists vs what's missing

### escalation-design.md / `pulse/domain/escalation.py`

**Exists:** `resolve_escalation_target(employee) -> str | None`, a pure function
that returns an employee's direct manager (`reports_to`), or `None` if the
employee/manager is missing or inactive. Already consumed by
`create_corrective_action_for_run` in `pulse/api/operations.py` as the default
`assigned_to` when a manager doesn't specify one.

**Missing:** Everything that turns "I know who the target is" into "escalation
happened." No endpoint exists to trigger an escalation as a distinct action (as
opposed to CA creation defaulting its assignee via this resolver). No
notification delivery (explicitly out of scope per the doc's own "Non-Goals"
section — deferred to a separate module, cross-referenced as S-C2 in the gap
analysis). No record that a given failure was "escalated" as a distinct
disclosed action separate from "a CA got created."

### snooze-design.md

**Exists:** A complete design for a `Snooze Policy` DocType, new fields on SOP
Run (`snooze_status`, `snooze_until`, `snooze_requested_at`, etc.), and scoring
semantics that keep Pending/Passed/Failed untouched. Nothing implemented.

**Missing:** Everything — no DocType, no fields, no endpoints, no UI. This is a
materially bigger and riskier piece of work than the other four actions because
it requires new SOP Run fields, a new policy DocType, and careful integration
with the deadline-finalization job. It also only applies to runs *before* they
are finalized as Failed — by the time a run shows up in the "Failed runs" list
this C1 task targets, snooze no longer makes sense for that run (it's already
past its deadline and already scored Failed). **Recommendation: descope full
snooze implementation from this C1 slice.** Section 2.4 below still specifies
the minimal "snooze" affordance the gap analysis is actually asking for (a
lightweight per-row defer/dismiss so a manager isn't nagged by the same failure
every session), which is intentionally NOT the deadline-deferral mechanism in
snooze-design.md and should not be confused with it.

### Corrective Action doctype + `pulse/api/corrective_actions.py` +
`create_corrective_action_for_run`

**Exists (this is the majority of the action loop already):**
- DocType: `run` (Link, reqd), `run_item_ref`, `description` (reqd), `status`
  (Select: Open/In Progress/Resolved/Closed, default Open), `assigned_to` (Link,
  reqd), `raised_by`, `priority` (Low/Medium/High/Critical), `resolution`,
  `resolved_at`, `evidence`.
- `create_corrective_action_for_run(run_name, description, priority, assigned_to)`:
  manager-only, validates run is Failed, checks scope, defaults `assigned_to` via
  `resolve_escalation_target`, sets `raised_by` from caller.
- `list_corrective_actions(status, assigned_to, page, page_size)`: scoped list.
- `update_corrective_action(name, status, resolution, assigned_to)`: scoped
  update, enforces `resolution` text required when moving to Resolved/Closed,
  auto-stamps `resolved_at`.
- `corrective_action_conditions` row-level permission function already wired in
  `pulse/api/permissions.py` (assigned_to/raised_by in caller's scope).

**Missing:** A "Waived" disposition (waive-with-reason is a distinct outcome from
Resolved — see §2.2), an "Acknowledged" disposition, a `waive_reason` /
`acknowledged_at` field, and the wiring from the Operations "Failed runs" list
row to any of this. Nothing in the frontend calls `create_corrective_action_for_run`
or `update_corrective_action` today — Operations.tsx's failed-run row only opens
a read-only detail Sheet (confirmed in §4).

### SOP Run doctype

Fields are exactly: `template`, `employee`, `period_date`, `status` (Open/In
Progress/Completed/Locked), `compliance_result` (Pending/Passed/Failed,
read-only), `completed_at` (read-only), `closed_at` (deprecated), assignment/
schedule/snapshot fields, `run_items`, `total_items`, `completed_items`,
`progress`. No field on SOP Run currently represents "someone looked at this" or
"someone decided this doesn't need action." That's intentional per the domain
contract, and this spec preserves it — see §2.

## 2. State model

For each action: does it touch SOP Run, or route through CA; what's the minimum
field addition; who can perform it.

### 2.1 Acknowledge

- **Target:** Corrective Action only. SOP Run is untouched — `compliance_result`
  stays Failed forever, as required.
- **Model:** Acknowledge is "a manager has seen this failure and is tracking it,"
  which is exactly what CA already represents at creation time. Rather than
  invent a fourth thing, **acknowledging a failure is defined as: creating a CA
  for that run if one doesn't exist yet** (via the existing
  `create_corrective_action_for_run`), or, if a CA already exists, doing nothing
  state-changing (the CA's mere existence at status=Open already *is* the
  acknowledgment). No new field needed. The one gap: the frontend has no way to
  tell "has any CA been created for this run" from `get_failure_list`'s response
  today — see §3.1 for the minimal endpoint change to expose that.
- **Field addition:** None on CA either. `status=Open` at creation already means
  "acknowledged, not yet resolved."
- **Permission:** Same as CA creation today — Pulse Admin / Pulse Leader / Pulse
  Manager (`_check_corrective_action_write_permission`), scoped to the failed
  employee being in caller's `get_scope_for_user()`. Operators cannot acknowledge
  their own failures (matches existing CA create permission, which has no
  Pulse User branch).

### 2.2 Waive-with-reason

- **Target:** Corrective Action only. SOP Run's `compliance_result` is never
  touched — a normal completion endpoint must never turn Failed into Passed
  (06-domain-contracts.md §3), and waiving is explicitly not a completion, it's
  a management decision that no further corrective work is needed despite the
  failure standing.
- **Model:** Waive is a *disposition* on a CA distinct from "Resolved" (Resolved
  implies the underlying problem got fixed; Waived means "we've decided not to
  chase this one, here's why" — e.g. a false failure, a one-off exception, a
  duplicate). Reusing "Resolved" for this would lose that distinction and would
  be misleading in reporting (a waived failure did not get corrected).
- **Field addition:** Extend the existing `status` Select on Corrective Action
  with a new value: `Open\nIn Progress\nResolved\nClosed\nWaived`. Add one new
  field: `waive_reason` (Small Text, required when status is set to Waived —
  same pattern `update_corrective_action` already uses for `resolution` being
  required on Resolved/Closed). No new DocType, no new SOP Run field.
- **Permission:** Manager+ only (same set as CA write: Pulse Admin / Pulse
  Leader / Pulse Manager). Waiving is a compliance-adjacent decision an Operator
  should never be able to make on their own failure — do not extend
  `_can_update_corrective_action`'s scope check to allow self-service waive.

### 2.3 Assign (to a Corrective Action, or directly to an employee)

- **Target:** Corrective Action only — this is already fully supported.
  "Assign to a CA" and "assign directly to an employee" collapse into the same
  operation: `assigned_to` on the CA. If no CA exists yet for the run, assigning
  is create-CA-with-assigned_to (reuses `create_corrective_action_for_run`'s
  `assigned_to` param, already implemented). If a CA exists, re-assigning is
  `update_corrective_action(name, assigned_to=...)`, already implemented.
- **Field addition:** None. Already fully built at the API layer.
- **Permission:** Same as CA write (Pulse Admin/Leader/Manager), scope-checked
  against both current and new assignee already in
  `update_corrective_action`/`_can_update_corrective_action`. No changes needed.
- **Note:** This is the one action in this list that is 100% ready today except
  for frontend wiring (§4) and the acknowledge-detection gap in §3.1.

### 2.4 Snooze (lightweight per-row defer — NOT the deadline-extension mechanism)

- **Target:** Corrective Action only, and only in the narrow sense of "stop
  surfacing this failure in the manager's attention list for N days." This is
  deliberately **not** `snooze-design.md`'s mechanism (deferring `due_at`/
  changing Pending vs Failed classification pre-finalization). By the time a run
  is in the Failed list, its `compliance_result` is already frozen Failed;
  nothing about deadline-deferral applies anymore. What the gap analysis is
  actually asking for here is: "let a manager say 'don't show me this again
  until next week' without pretending it's resolved."
- **Model:** Add `snooze_until` (Datetime, optional) to Corrective Action. When
  set and in the future, `list_corrective_actions` / `get_failure_list` (or a
  thin wrapper join, see §3.2) filters the row out of the default "needs
  attention" view but the underlying CA and the underlying SOP Run
  `compliance_result=Failed` are both untouched.
- **Field addition:** One field, `snooze_until` (Datetime), on Corrective Action.
  A CA must exist to snooze it — snoozing, like acknowledging, implicitly
  creates the CA first if missing.
- **Permission:** Same as CA write (Manager+). Do not reuse the term "snooze" in
  API/DocType naming in a way that collides with the future
  `snooze-design.md` implementation — name the field/endpoint distinctly (see
  §3.4, `defer_until` is suggested to avoid confusion during later
  reconciliation with real snooze work).
- **Explicit call-out:** If/when `snooze-design.md` is implemented against SOP
  Run, this CA-level `defer_until` field remains valid and orthogonal (it defers
  *attention*, not *deadline*) and should not be merged with it.

### 2.5 Escalate

- **Target:** Corrective Action only, using `domain/escalation.py`'s resolver.
  SOP Run untouched.
- **Model:** "Escalate" = create (or update) a CA whose `assigned_to` is set to
  `resolve_escalation_target(employee)` rather than the caller's own choice, AND
  mark that this specific CA's assignment happened via escalation (as opposed to
  a manager manually picking an assignee) so it's distinguishable in reporting
  and so a notification can be triggered off it. `create_corrective_action_for_run`
  already defaults to the escalation target when `assigned_to` is omitted — but
  there's no signal today that this happened *because* someone clicked
  "Escalate" versus the manager simply not specifying an assignee.
- **Field addition:** One boolean, `escalated` (Check, default 0) on Corrective
  Action, set true only when the CA was created/updated via the dedicated
  escalate action (§3.3). This is the hook a future notification-delivery module
  (S-C2, cross-referenced below) can watch for ("when `escalated` flips true,
  notify `assigned_to`"). Notification delivery itself remains out of scope here
  per escalation-design.md's own Non-Goals section.
- **Permission:** Manager+ only (same set). The escalation *target* (the manager
  being escalated to) is not granted any special action-trigger permission here
  — they simply gain visibility/write access to the CA once assigned, via the
  existing `corrective_action_conditions` scope logic (their own employee name
  now appears in the CA's `assigned_to`, which is already inside their own scope
  by construction of `resolve_escalation_target`).

### Summary table

| Action | Touches SOP Run? | New field(s) | Who |
|---|---|---|---|
| Acknowledge | No | None (CA existence = ack) | Admin/Leader/Manager |
| Assign | No | None (already built) | Admin/Leader/Manager |
| Waive-with-reason | No | CA.status += "Waived"; CA.waive_reason | Admin/Leader/Manager |
| Snooze (defer attention) | No | CA.snooze_until (name: defer_until) | Admin/Leader/Manager |
| Escalate | No | CA.escalated (Check) | Admin/Leader/Manager |

## 3. Required API surface

All new/extended endpoints live in `pulse/api/corrective_actions.py` (extending
the file that already owns CA mutation) and follow the exact response-shape and
permission-check conventions of `update_corrective_action` /
`list_corrective_actions` (camelCase JSON keys, `_check_corrective_action_write_permission`,
scope check via `get_scope_for_user` + `_can_update_corrective_action`).

### 3.1 Extend `get_failure_list` (in `pulse/api/operations.py`) with CA linkage

Add a `has_corrective_action` (bool) and `corrective_action` (str | None) field
to each item, resolved by a single extra `frappe.get_all("Corrective Action",
filters={"run": ["in", [run names on this page]]}, fields=["run", "name",
"status"])` batched query (not N+1) after the existing `rows` fetch. Response
item shape gains:

```
{
    ...existing fields...,
    "corrective_action": <CA name or null>,
    "corrective_action_status": <CA status or null>,
}
```

This is what lets the frontend row menu (§4) know whether to show "Acknowledge /
Create CA" vs "View CA" and whether Waive/Snooze/Escalate apply to an existing
CA vs need to create one first.

### 3.2 Extend `update_corrective_action` for Waive and Snooze

No new endpoint — extend the existing signature:

```python
@frappe.whitelist()
def update_corrective_action(
    name: str,
    status: str | None = None,      # now accepts "Waived" too
    resolution: str | None = None,
    assigned_to: str | None = None,
    waive_reason: str | None = None,   # new
    defer_until: str | None = None,    # new — datetime string
) -> dict:
```

Behavior additions:
- `status="Waived"` requires `waive_reason` (mirrors the existing
  Resolved/Closed → `resolution` requirement); sets `ca.waive_reason` and
  `ca.resolved_at` is left untouched (waiving is not resolving).
- `defer_until` sets `ca.defer_until` directly; no status change required, so it
  can be combined with any other update or called alone.
- Response gains `"waiveReason"` and `"deferUntil"` keys, following the existing
  camelCase convention.

### 3.3 New endpoint: `escalate_corrective_action`

```python
@frappe.whitelist()
def escalate_corrective_action(run_name: str, existing_ca: str | None = None) -> dict:
    """Escalate a failed run: create or re-assign its CA to the employee's
    escalation target (resolve_escalation_target), and flag ca.escalated = 1.

    Args:
        run_name: SOP Run name (must be Failed, same validation as
            create_corrective_action_for_run).
        existing_ca: If the run already has a CA, its name — re-assigns and
            flags that CA instead of creating a second one for the same run.

    Returns:
        {
            "name": <CA name>,
            "assignedTo": <employee id>,
            "assignedToName": <employee_name>,
            "escalated": true,
        }

    Raises:
        frappe.PermissionError / frappe.DoesNotExistError / frappe.ValidationError,
        same conditions as create_corrective_action_for_run, plus:
        frappe.ValidationError if resolve_escalation_target(employee) returns None
        (no manager to escalate to).
    """
```

Internally: reuses `_check_corrective_action_write_permission`, the same run/
scope validation as `create_corrective_action_for_run`, calls
`resolve_escalation_target(employee)` and throws if `None` (there is no one to
escalate to — this is a real, user-facing error state, not a silent no-op).
Either creates a new CA (via the same insert path as
`create_corrective_action_for_run`, with `escalated=1`) or updates
`existing_ca.assigned_to` + `existing_ca.escalated = 1`.

### 3.4 DocType JSON changes (Corrective Action)

- `status` options: `"Open\nIn Progress\nResolved\nClosed\nWaived"`.
- New field `waive_reason` (Small Text), placed after `resolution` in
  `field_order`.
- New field `defer_until` (Datetime), placed after `waive_reason`.
- New field `escalated` (Check, default `"0"`), placed after `priority`.

No changes to `permissions` block — existing role grants (Admin/Leader/Manager
write, Executive/User read) already cover these new fields since they're on the
same DocType.

## 4. Required frontend surface

### 4.1 Where actions attach

Today `Operations.tsx`'s "Failed runs" card (`sortedFailures.map(...)`, lines
~322–359) renders each row as a plain `div` with an `onClick` that opens a
read-only detail `Sheet` (lines 446–519, explicitly badged "Read Only"). There
is no per-row action affordance at all today.

**Minimum UI:** add a per-row action menu using the existing
`DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent` primitives from
`src/components/ui/dropdown-menu.tsx` — the same pattern already used in
`Topbar.tsx`'s notification and identity dropdowns. A small icon-button trigger
(e.g. `MoreVertical` from lucide-react) added to the row's right side, next to
the existing `StatusChip`/repeat-count badges, with `e.stopPropagation()` so it
doesn't also trigger the row's existing "open detail sheet" click. This keeps
the failure row itself click-to-detail as today, and adds actions via the menu
— no new inline buttons needed, avoiding row clutter given repeat-fail rows
already carry two chips.

Menu items (conditionally rendered per `has_corrective_action` from §3.1):
- No CA yet: "Acknowledge" (creates CA via `create_corrective_action_for_run`
  with a default description), "Assign to…" (opens a small employee picker,
  then calls `create_corrective_action_for_run` with `assigned_to`), "Escalate"
  (`escalate_corrective_action`), "Waive…" (opens reason input, then
  `create_corrective_action_for_run` + immediate `update_corrective_action`
  status=Waived — or, cleaner, extend `create_corrective_action_for_run` to
  accept an initial status/waive_reason in a follow-up task if this two-call
  round trip proves awkward in practice).
- CA exists: "View Corrective Action" (opens existing CA detail — new, small,
  read/write sheet, reusing the existing detail-Sheet visual pattern but with
  editable status/assignee/resolution), "Reassign…", "Waive…", "Escalate",
  "Snooze until…" (date picker, then `defer_until` update).

The Run Detail Sheet (lines 446–519) should also grow the same action set at
its bottom (replacing/augmenting the current single "Close Details" button),
since it's the natural place for a user who opened the sheet before deciding to
act — but the row menu is the primary, lower-friction path per the gap
analysis's "manager can't act on any of them" framing.

### 4.2 Confirmation / disclosure — where ImpactStrip attaches

`src/components/shared/impact-strip.tsx`'s `ImpactStrip` component exists
precisely for "this action changes a compliance number, here's the before/
after" (its default styling already uses a `border-l-waive` accent color,
suggesting it was designed with waive-like actions in mind).

Per §2, **acknowledge, assign, and the CA-level "snooze" (defer attention) do
not change any compliance number** — they only affect CA bookkeeping, so they
need no `ImpactStrip` and can proceed on a normal confirm-and-toast basis (or no
confirm at all for acknowledge/assign, which are low-stakes and reversible).

**Waive** and **escalate** are the two that warrant `ImpactStrip`:
- **Waive:** even though `compliance_result` itself never changes (still
  Failed, per the frozen-scoring rule), waiving changes how that failure reads
  operationally — it moves a run out of "needs corrective work" bookkeeping.
  Wire `ImpactStrip` into the waive confirmation dialog showing
  `impactCount` = count of open/unresolved failures for that employee/template
  before this waive, `deltaDisplay` = same count after (i.e., -1), and
  `message` explicitly stating the compliance score itself is unaffected
  ("Waiving does not change the Failed result or this period's score — it only
  marks the follow-up as not requiring further action") so a manager doesn't
  mistakenly believe waiving improves the number. This is the single most
  important place to prevent a false mental model, since "waive" is the action
  most likely to be misread as "make this pass."
- **Escalate:** `ImpactStrip` here should show the *load* impact on the
  escalation target rather than a score delta — `impactCount` = the target
  manager's current open-CA count before, `deltaDisplay` = count after (+1),
  `message` naming the target ("This will add 1 open corrective action to
  [Manager Name]'s queue"). This isn't a compliance-score change but is still a
  "here's the consequence before you commit" disclosure the pattern is built
  for.

Both dialogs should be built as small modal forms (reason textarea for waive,
confirm-only for escalate since the target is system-resolved not user-chosen)
that render `ImpactStrip` above the confirm button, fetching the "before" counts
via a lightweight call to `list_corrective_actions` filtered by
`assigned_to`/employee before showing the dialog.

## 5. Bounded implementation task list

Dependency graph: Task 1 gates 2 and 3 (schema + list-endpoint changes land
first); 2 and 3 can run in parallel once 1 lands; 4 depends on 1+2+3's endpoints
existing; 5 depends on 4's dialogs existing (or can be built in the same pass as
4's waive/escalate dialogs, so 4 and 5 are really one frontend task split for
sizing — listed separately for clarity but assign to the same session if
preferred).

- **Task 1 — Backend schema + acknowledge/waive/get_failure_list linkage
  (Sonnet).** Reasoning: requires deciding exact field placement/order in the
  CA DocType JSON, adding `has_corrective_action`/`corrective_action` to
  `get_failure_list` without introducing N+1 queries, and extending
  `update_corrective_action`'s validation branching for the new `Waived` status
  + `waive_reason` requirement. Non-mechanical judgment calls live here (this is
  the same reasoning already spelled out in §2/§3 above, so a Sonnet task should
  be handed this document directly rather than re-deriving it).
  - Deliverables: `corrective_action.json` diff (status options, `waive_reason`,
    `defer_until`, `escalated` fields), `get_failure_list` diff,
    `update_corrective_action` diff.

- **Task 2 — `defer_until` snooze-attention update (Haiku, blocked on Task 1).**
  Mechanical once Task 1's `update_corrective_action` pattern for adding a
  simple optional field exists — this task only needs to thread `defer_until`
  through the same function (already included in Task 1's signature above, so
  in practice Task 2 may already be satisfied by Task 1; keep as a separate task
  only if Task 1 is scoped to just Waived to keep it smaller). If split: add
  `defer_until` param + response key, and add a `hide_deferred: bool` param to
  `list_corrective_actions` / `get_failure_list` that filters out CAs whose
  `defer_until` is in the future.

- **Task 3 — `escalate_corrective_action` endpoint (Haiku, blocked on Task 1,
  can run in parallel with Task 2).** Mechanical: mirrors
  `create_corrective_action_for_run`'s existing validation/scope-check
  structure almost line for line, swapping in `resolve_escalation_target` as
  the only assignment path and setting `escalated=1`. Cross-reference: the
  `escalated` flag this task sets is the intended trigger point for S-C2's
  notification delivery scoping (escalation-design.md explicitly defers
  notification delivery); this task does NOT send any notification itself, it
  only sets the flag and returns the resolved target so S-C2 can be built
  against it later without touching this endpoint again.

- **Task 4 — Frontend per-row action menu (Haiku, blocked on Tasks 1–3's
  endpoints existing).** Add the `DropdownMenu` per failed-run row per §4.1,
  wire Acknowledge/Assign/View-CA to existing endpoints, wire the employee
  picker for Assign/Reassign. Mechanical once endpoints exist and the
  `DropdownMenu`/`Sheet` primitives are the ones already used elsewhere in this
  codebase (Topbar.tsx as the reference pattern).

- **Task 5 — Waive and Escalate confirmation dialogs with `ImpactStrip` wired
  in (Haiku, blocked on Task 4's menu existing, or built together with it).**
  Build the two modal forms described in §4.2, fetch "before" counts via
  `list_corrective_actions`, render `ImpactStrip` with the specified
  `impactCount`/`deltaDisplay`/`message` content, then call
  `update_corrective_action(status="Waived", waive_reason=...)` or
  `escalate_corrective_action(...)` on confirm.

Parallelizable: {Task 2, Task 3} after Task 1. Sequential: 1 → {2,3} → 4 → 5 (or
4 and 5 merged into one frontend pass, still sequential after 1–3).
