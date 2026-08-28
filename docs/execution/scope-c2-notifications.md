# Scope: C2 — Notifications ("Nothing reaches the user outside the app")

Source: `docs/execution/product-gap-analysis.md`, finding C2.

## 0. Current state (read before scoping)

- `frontend/src/components/layout/Topbar.tsx`: the bell renders a real dropdown but its body is
  hardcoded to `"No new notifications"`. There is no notifications store, no API call, no unread
  badge. The comment in the file already flags this: wire it once a service exists.
- `pulse/domain/escalation.py`: `resolve_escalation_target(employee)` resolves WHO (the employee's
  active `reports_to` manager) should hear about a failed run. It is pure — no delivery, no
  caller. `docs/execution/escalation-design.md` confirms: "Wire resolver output to notification
  system (separate module)" is explicitly listed as future work, not yet done.
- `pulse/api/operations.py::create_corrective_action_for_run` already calls
  `resolve_escalation_target` today, but only to pick a default `assigned_to` for a
  manager-initiated Corrective Action — not to notify anyone. `get_failure_list` defines "failure"
  as `SOP Run.compliance_result == "Failed"`.
- `pulse/tasks.py::finalize_overdue_runs` runs every 5 minutes (`hooks.py` `scheduler_events.cron`:
  `*/5 * * * *`) and is the sole place a run transitions from `Pending` to `Failed`+`Locked` once
  `due_at` has passed. **This means the "overdue" detection job already exists** — there is no
  need to write a second scheduled job that separately polls for overdue runs; the notification
  hook belongs inside (or immediately after) this existing finalizer, at the moment it flips a run
  to Failed.
- `pulse/hooks.py`: no `notification_config`, no `doc_events`, no existing scheduled job related to
  notifications. `scheduler_events` currently has `daily`, `hourly`, `weekly`, `monthly`, and one
  `cron` entry (`finalize_overdue_runs`).
- Grep for `frappe.sendmail`, `frappe.publish_realtime`, `frappe.share` across `pulse/` returns
  nothing — no notification-adjacent code exists anywhere in the app today. This is a greenfield
  build, not a refactor.
- No doctype under `pulse/pulse_core/doctype/` is notification-related (confirmed: `corrective_action`,
  `score_snapshot`, `sop_assignment`, `sop_checklist_item`, `sop_run`, `sop_run_item`,
  `sop_template` — that's the full list).
- `SOP Run` (`pulse/pulse_core/doctype/sop_run/sop_run.json`) has the fields this spec needs:
  `employee` (Link, Pulse Employee), `due_at` (Datetime), `status` (Open/In Progress/Completed/
  Locked), `compliance_result` (Pending/Passed/Failed), `template_title_snapshot`,
  `employee_name_snapshot`, `completed_at`. There is no separate "overdue" status — overdue is
  `status != Completed` and `due_at < now`, which is exactly what `finalize_overdue_runs`
  already queries (`compliance_result == "Pending" and due_at <= evaluation_instant`).
- `pulse/api/corrective_actions.py` is the most recent API convention reference (built this
  branch): whitelisted functions with a docstring giving the exact response-contract shape,
  scope-filtered via `get_scope_for_user()`, permission checks factored into a private
  `_check_*_permission()` helper, camelCase keys in the JSON response (`assignedTo`,
  `assignedToName`, `resolvedAt`) even though the doctype fields are snake_case. Notification
  endpoints should follow this exact shape.

## 1. Channel choice: email only for v1

**Recommendation: email only.** In-app (the bell, once wired to real data) + email is the full v1
scope. Push and SMS/WhatsApp are explicitly a later phase.

Justification:

- **Email is the only channel with zero new infrastructure.** Frappe ships `frappe.sendmail()`
  out of the box — it uses the site's configured Email Account, handles templating, queues via
  the Email Queue doctype, and retries. No third-party account, no API key, no webhook receiver to
  build. This is a pure "call an existing function" job.
- **Push requires a service worker.** Finding C4 (checked in the gap analysis, referenced here for
  scoping boundary) already establishes the frontend is not currently a PWA. Web push needs a
  service worker, a push subscription flow, and VAPID key management — none of which exist. Adding
  that is a separate, larger track, not a corollary of "add notifications."
- **SMS/WhatsApp need a paid gateway.** Twilio, MSG91, or the WhatsApp Business API all require
  external account setup, per-message cost, delivery-status webhooks, and (for WhatsApp)
  template pre-approval with Meta. That is a vendor-integration decision with cost and compliance
  implications that should not be smuggled into a notification-delivery scoping doc — it deserves
  its own scoping pass if/when the business decides to pay for it.
- **In-app is not a separate "channel" here** — it's the same event firing a write to a
  notification log that the (currently-stub) bell reads. It rides along with email at near-zero
  marginal cost once the doctype and endpoints exist (Task 1 below), so it is included in v1 by
  default, not scoped separately.

v1 = in-app bell (real data) + email. v2+ (not this scope) = push, SMS, WhatsApp, user-configurable
channel preference.

## 2. Trigger points

Four events, all derived from state changes already modeled in this codebase — no new "event bus"
is being invented, just call sites at existing state transitions.

### T1 — SOP Run becomes overdue / is marked Failed

- **Where it fires today:** `pulse/tasks.py::finalize_overdue_runs`, which already runs every 5
  minutes via `hooks.py`'s `scheduler_events["cron"]["*/5 * * * *"]`. This function is the single
  place a run flips from `compliance_result == "Pending"` to `"Failed"` (with `status` becoming
  `"Locked"`) once `due_at` has passed.
- **No new scheduled job needed.** The existing cron entry is the correct integration point — do
  not add a second poller. The notification call belongs inside the loop in
  `finalize_overdue_runs`, right after `run.save()` succeeds for each `run_name`, using the fields
  already loaded (`run.employee`, `run.due_at`, `run.template_title_snapshot`,
  `run.employee_name_snapshot`).
- **Recipients:** the operator (`run.employee`) — "your checklist is overdue" — and, since the run
  is now Failed, the escalation target from `resolve_escalation_target(run.employee)` (the direct
  manager) — "X's checklist failed."
- This single trigger point covers "becomes overdue" and "marked failed" as one event, because in
  this codebase's data model they are the same transition (there's no separate "overdue but not
  yet failed" state — `due_at` passing is what defines failure via this finalizer).

### T2 — Escalation resolved for a failed run

- **Where it fires:** immediately after T1, when `resolve_escalation_target(run.employee)` returns
  a non-`None` manager. This is the integration point `escalation-design.md` calls out by name:
  "Wire resolver output to notification system (separate module)." Today `resolve_escalation_target`
  has no caller in `pulse/tasks.py` at all — its only caller is
  `create_corrective_action_for_run`'s default-assignee logic, which is a different concern
  (who a CA defaults to, not who gets told about a failure).
- **Recipient:** the resolved manager only. If resolution returns `None` (no manager, employee
  inactive), no escalation email is sent — this is not an error, per the resolver's documented
  contract.
- This is listed as a distinct trigger from T1 because it has its own template (manager-facing,
  not operator-facing) and its own "no target" no-op path, even though both fire from the same
  `finalize_overdue_runs` pass.

### T3 — Corrective Action created / assigned

- **Where it fires:** `pulse/api/operations.py::create_corrective_action_for_run`, at the point the
  new Corrective Action document is inserted, after `assigned_to` is resolved (either passed
  explicitly or defaulted via `resolve_escalation_target`).
- **Recipient:** the CA's `assigned_to` employee — "you've been assigned corrective action work on
  run X."

### T4 — Corrective Action marked Resolved/Closed

- **Where it fires:** `pulse/api/corrective_actions.py::update_corrective_action`, at the point
  `status` transitions to `"Resolved"` or `"Closed"` (where `resolved_at` is set).
- **Recipient:** the CA's `raised_by` employee (the manager who opened it) — "CA on run X was
  resolved." Not the `assigned_to` employee, since they're the one closing it.

## 3. Delivery mechanism

### Email

Use `frappe.sendmail()` directly at each trigger point above. Do not build a custom SMTP client
or queue. `frappe.sendmail()` already writes to Frappe's Email Queue doctype, which handles retry
and delivery tracking. Each trigger's call site passes `recipients=[user_email_for(employee)]`,
`subject`, and `message` (template text — see Section 4). Note `Pulse Employee` will need to be
checked for a `user`/email-carrying field to resolve an actual send-to address; if `Pulse Employee`
has no linked `User`/email field today, that resolution helper is part of Task 3's scope, not a
new open question to defer.

### In-app bell — backing doctype

**Recommendation: a new lightweight `Pulse Notification` doctype, not core `Notification Log`.**

Reasoning: `Notification Log` is Frappe core's doctype for the standard desk bell (used by
`notification_config` / `frappe.desk.notifications`), and its permission model is built around
`for_user` + is generally readable by any logged-in user for their own rows, with no concept of
this app's role-gated scoping (`Pulse Admin` / `Pulse Leader` / `Pulse Manager` /
`get_scope_for_user()`). Every other doctype in this app (`SOP Run`, `Corrective Action`, `Score
Snapshot`, `Pulse Employee`) has a custom `permission_query_conditions` entry in `hooks.py` scoping
rows to what the caller should see. Piggybacking on `Notification Log` means either fighting its
default permission behavior or bypassing DocType permissions entirely and trusting the whitelisted
endpoint's own scope check — which is exactly the pattern this app already uses elsewhere (see
`corrective_action_conditions` in `pulse/api/permissions.py`), so a dedicated doctype that follows
the same convention is more consistent than adapting a core doctype not designed for this
permission shape.

`Pulse Notification` fields (naming only — no JSON to write, this is scoping, not implementation):

- `recipient` — Link, Pulse Employee
- `kind` — Select: `Run Overdue | Escalation | CA Assigned | CA Resolved` (mirrors T1–T4)
- `title` — Data (in-app line, see Section 4)
- `reference_doctype` / `reference_name` — Dynamic Link back to the SOP Run or Corrective Action,
  so clicking the bell item can deep-link
- `is_read` — Check, default 0
- `created_at` — implicit (`creation` field is sufficient; no separate field needed)

### Whitelisted endpoints (frontend bell)

Following `pulse/api/corrective_actions.py`'s exact convention — whitelisted function, docstring
giving the JSON response contract up front, scoped via the caller's own employee identity (not
`get_scope_for_user()`, since notifications are always self-scoped — a manager doesn't see their
reports' notifications, only their own):

```
pulse/api/notifications.py

@frappe.whitelist()
def list_notifications(unread_only: bool = False, page: int = 1, page_size: int = 20) -> dict:
    """
    {
        "items": [
            {
                "name": <Pulse Notification name>,
                "kind": <str>,
                "title": <str>,
                "referenceDoctype": <str>,
                "referenceName": <str>,
                "isRead": <bool>,
                "createdAt": <datetime>,
            }, ...
        ],
        "unreadCount": <int>,
        "page": <int>, "page_size": <int>, "total": <int>,
    }
    """

@frappe.whitelist()
def mark_notification_read(name: str) -> dict:
    """Marks one Pulse Notification as read. Caller must be its recipient."""

@frappe.whitelist()
def mark_all_notifications_read() -> dict:
    """Convenience bulk action for the bell's "mark all read" affordance."""
```

## 4. Template set

Terse, specific, no marketing language — matching this codebase's existing docstring/copy tone
(e.g. `get_failure_list`'s "what's broken" framing, `update_corrective_action`'s plain
"Resolution text is required when marking a CA as resolved" style).

**T1a — operator, run overdue**
- Email subject: `Overdue: {template_title_snapshot}`
- Email body: `Your {template_title_snapshot} checklist was due at {due_at} and has not been completed. It is now marked Failed.`
- In-app line: `{template_title_snapshot} — overdue, marked Failed.`

**T1b — escalation target (manager), run failed** *(same firing as T1, different recipient — see T2)*
- Email subject: `Failed: {employee_name_snapshot}'s {template_title_snapshot}`
- Email body: `{employee_name_snapshot} did not complete {template_title_snapshot} by {due_at}. Run: {run_name}.`
- In-app line: `{employee_name_snapshot} missed {template_title_snapshot}.`

**T3 — Corrective Action assigned**
- Email subject: `Corrective action assigned: {run.template_title_snapshot}`
- Email body: `You've been assigned a corrective action on run {run_name}: {description}`
- In-app line: `New corrective action assigned — {run.template_title_snapshot}.`

**T4 — Corrective Action resolved**
- Email subject: `Resolved: corrective action on {run.template_title_snapshot}`
- Email body: `{assigned_to_name} marked the corrective action on run {run_name} as {status}.`
- In-app line: `Corrective action on {run.template_title_snapshot} — {status}.`

## 5. Opt-in / quiet hours

**Recommendation: not in v1.** Every notification enumerated above is operationally necessary —
"your checklist is overdue" is not discretionary noise the recipient should be able to silence, and
these are QSR shift workers/managers who are explicitly *not* at a desk to see in-app state, which
is the entire premise of C2. Adding a preferences/quiet-hours model now would be scoping ahead of
an actual complaint.

**Flagged for v2, not forgotten:** once volume grows (e.g. an employee with many overdue runs in
one 5-minute window, or a manager who escalates for a large team), quiet-hours and per-kind
opt-out become legitimate. Do not build the preference infrastructure until that's a real problem —
but note it here so it isn't rediscovered as a surprise later.

## 6. Bounded implementation task list (dependency-ordered)

- **Task 1 — backend: `Pulse Notification` doctype + list/mark-read endpoints.**
  (Sonnet — doctype design decision, permission-model call, matches an existing convention but
  requires judgment on field shape and read-scoping.)
  Creates `pulse/pulse_core/doctype/pulse_notification/` and `pulse/api/notifications.py`
  (`list_notifications`, `mark_notification_read`, `mark_all_notifications_read`). No other task
  can start until this lands — it's the shared substrate.

- **Task 2 — backend: hook T1/T2 into `finalize_overdue_runs`.**
  (Haiku, mechanical once Task 1's doctype exists — this is "call
  `resolve_escalation_target`, then insert a `Pulse Notification` row and call
  `frappe.sendmail()`" at a well-defined point in an existing function.)
  Depends on Task 1. Backend-parallel with Task 3.

- **Task 3 — backend: hook T3/T4 into `operations.py`/`corrective_actions.py`.**
  (Haiku, mechanical — same pattern as Task 2, different call sites:
  `create_corrective_action_for_run` and `update_corrective_action`.)
  Depends on Task 1. Backend-parallel with Task 2.

- **Task 4 — frontend: Topbar bell becomes real.**
  (Haiku, once Task 1's endpoints exist — replace the hardcoded "No new notifications" string
  with a call to `list_notifications`, render `unreadCount` as a badge, wire "mark read" on
  click.)
  Depends on Task 1 only (does not need Tasks 2/3 to be functionally correct, though it will show
  no data until they land — reasonable to sequence after 2/3 anyway so there's something to see
  when testing).

Dependency graph: Task 1 blocks Tasks 2, 3, 4. Tasks 2 and 3 are independent of each other. Task 4
can start as soon as Task 1 lands but is more useful to verify after 2/3.
