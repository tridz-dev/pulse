# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _
from frappe.utils import now_datetime

from pulse.api.notifications import notify_ca_assigned
from pulse.api.permissions import get_scope_for_user, _get_employee_for_user
from pulse.domain.escalation import resolve_escalation_target


def _check_corrective_action_write_permission():
	"""Only roles with create/write permission on Corrective Action may mutate."""
	user = frappe.session.user
	if user == "Administrator":
		return
	roles = frappe.get_roles(user)
	if "Pulse Admin" in roles or "Pulse Leader" in roles or "Pulse Manager" in roles:
		return
	frappe.throw(
		_("Not permitted. Only Pulse Admin, Pulse Leader, or Pulse Manager can update Corrective Actions."),
		frappe.PermissionError,
	)


def _employee_name_for_link(employee_id: str) -> str | None:
	"""Get employee_name for a Pulse Employee ID."""
	if not employee_id:
		return None
	return frappe.db.get_value("Pulse Employee", employee_id, "employee_name")


def _can_update_corrective_action(ca_name: str, scope: list[str]) -> bool:
	"""Check if caller has permission to update this corrective action.

	A caller can update a CA if:
	- The CA's assigned_to or raised_by employee is in their scope (following the same
	  authorization pattern as create_corrective_action_for_run).
	"""
	ca = frappe.db.get_value(
		"Corrective Action",
		ca_name,
		["assigned_to", "raised_by"],
		as_dict=True,
	)
	if not ca:
		return False

	# Caller can update if they have scope over the assigned_to or raised_by employee
	return ca.get("assigned_to") in scope or ca.get("raised_by") in scope


@frappe.whitelist()
def list_corrective_actions(
	status: str | None = None,
	assigned_to: str | None = None,
	page: int = 1,
	page_size: int = 20
) -> dict:
	"""Return paginated Corrective Actions scoped to the caller.

	A caller should only see Corrective Actions for employees within their scope,
	mirroring how get_failure_list handles scoping. Optional status and assigned_to
	filters can be applied.

	Args:
		status: Optional status filter (Open, In Progress, Resolved, Closed).
		assigned_to: Optional assigned_to employee filter.
		page: Page number (1-indexed).
		page_size: Number of items per page.

	Returns:
		{
			"items": [
				{
					"name": <CA name>,
					"run": <run name>,
					"description": <description>,
					"status": <status>,
					"priority": <priority>,
					"assignedTo": <employee id>,
					"assignedToName": <employee_name>,
					"raisedBy": <employee id>,
					"raisedByName": <employee_name>,
					"resolvedAt": <datetime or null>,
				},
				...
			],
			"page": <int>,
			"page_size": <int>,
			"total": <int>,
		}
	"""
	page = int(page) or 1
	page_size = int(page_size) or 20

	visible_scope = list(get_scope_for_user())
	if not visible_scope:
		return {"items": [], "page": page, "page_size": page_size, "total": 0}

	# Build filters for scope: caller can see CAs where assigned_to or raised_by
	# is in their scope (matching corrective_action_conditions from permissions.py)
	filters = [
		[
			["assigned_to", "in", visible_scope],
			"or",
			["raised_by", "in", visible_scope],
		]
	]

	# Apply optional status filter
	if status:
		filters.append(["status", "=", status])

	# Apply optional assigned_to filter
	if assigned_to:
		if assigned_to not in visible_scope:
			frappe.throw(
				_("Not permitted. Employee '{0}' is outside your scope.").format(assigned_to),
				frappe.PermissionError,
			)
		filters.append(["assigned_to", "=", assigned_to])

	# Count total matching
	total = frappe.db.count("Corrective Action", filters=filters)

	# Fetch paginated rows
	rows = frappe.get_all(
		"Corrective Action",
		filters=filters,
		fields=[
			"name",
			"run",
			"description",
			"status",
			"priority",
			"assigned_to",
			"raised_by",
			"resolved_at",
		],
		order_by="modified desc, name asc",
		limit_start=(page - 1) * page_size,
		limit_page_length=page_size,
	)

	# Build response with denormalized employee names
	items = []
	for row in rows:
		items.append({
			"name": row["name"],
			"run": row["run"],
			"description": row["description"],
			"status": row["status"],
			"priority": row.get("priority"),
			"assignedTo": row["assigned_to"],
			"assignedToName": _employee_name_for_link(row["assigned_to"]),
			"raisedBy": row["raised_by"],
			"raisedByName": _employee_name_for_link(row["raised_by"]),
			"resolvedAt": row.get("resolved_at"),
		})

	return {"items": items, "page": page, "page_size": page_size, "total": total}


@frappe.whitelist()
def update_corrective_action(
	name: str,
	status: str | None = None,
	resolution: str | None = None,
	assigned_to: str | None = None,
	waive_reason: str | None = None,
	defer_until: str | None = None,
) -> dict:
	"""Update an existing Corrective Action.

	Only roles with write permission on Corrective Action may call this endpoint.
	The caller must have scope over the CA's assigned_to or raised_by employee.

	If status is being set to "Resolved" or "Closed", the resolved_at timestamp
	is automatically set to the current time if not already set. Resolution text
	is required when marking a CA as resolved or closed. If status is being set
	to "Waived", waive_reason is required instead; resolved_at is intentionally
	left untouched, since waiving is a distinct disposition from resolving (the
	underlying problem was not fixed, management just decided not to chase it).

	Args:
		name: Name of the Corrective Action to update.
		status: Optional new status (Open, In Progress, Resolved, Closed, Waived).
		resolution: Optional resolution text (required if status is Resolved/Closed).
		assigned_to: Optional new assigned_to employee.
		waive_reason: Optional waive reason text (required if status is Waived).
		defer_until: Optional datetime string to set ca.defer_until. Independent of
			status - can be combined with any other update, or passed alone with
			no status change at all.

	Returns:
		{
			"name": <CA name>,
			"status": <status>,
			"resolution": <resolution>,
			"resolvedAt": <datetime or null>,
			"assignedTo": <employee id>,
			"waiveReason": <waive reason or null>,
			"deferUntil": <datetime or null>,
		}

	Raises:
		frappe.PermissionError: If caller lacks write permission or scope.
		frappe.DoesNotExistError: If the CA does not exist.
		frappe.ValidationError: If validation fails (e.g., resolution required for resolved status,
			waive_reason required for Waived status).
	"""
	_check_corrective_action_write_permission()

	if not name:
		frappe.throw(_("Corrective Action name is required."))

	# Fetch the existing CA
	ca = frappe.get_doc("Corrective Action", name)
	if not ca:
		frappe.throw(
			_("Corrective Action '{0}' does not exist.").format(name),
			frappe.DoesNotExistError,
		)

	# Verify caller has permission to update this CA (scope check)
	scope = get_scope_for_user(frappe.session.user)
	if not _can_update_corrective_action(name, scope):
		frappe.throw(
			_("Not permitted. Corrective Action '{0}' is outside your scope.").format(name),
			frappe.PermissionError,
		)

	# Update status if provided
	if status is not None:
		valid_statuses = ["Open", "In Progress", "Resolved", "Closed", "Waived"]
		if status not in valid_statuses:
			frappe.throw(
				_("Status must be one of {0}. Got '{1}'.").format(
					", ".join(valid_statuses), status
				),
			)
		ca.status = status

		# If marking as resolved/closed, auto-set resolved_at and require resolution text
		resolved_statuses = ["Resolved", "Closed"]
		if status in resolved_statuses:
			if not resolution:
				frappe.throw(
					_("Resolution text is required when marking a Corrective Action as '{0}'.").format(status),
				)
			ca.resolution = resolution
			if not ca.resolved_at:
				ca.resolved_at = now_datetime()
		elif status == "Waived":
			if not waive_reason:
				frappe.throw(
					_("Waive reason is required when marking a Corrective Action as 'Waived'."),
				)
			ca.waive_reason = waive_reason
			# Deliberately do NOT touch ca.resolved_at here: waiving is not resolving.
			# Resolved/resolved_at implies the underlying problem got fixed; Waived
			# means management decided not to chase it despite the failure standing.

	# Update resolution if provided (without changing status)
	elif resolution is not None:
		ca.resolution = resolution

	# Update assigned_to if provided
	if assigned_to is not None:
		# Verify the provided assignee exists and is active
		if not frappe.db.exists("Pulse Employee", {"name": assigned_to, "is_active": 1}):
			frappe.throw(
				_("Assigned employee '{0}' does not exist or is inactive.").format(assigned_to),
				frappe.DoesNotExistError,
			)
		# Verify the assignee is within the caller's scope — a manager may only
		# reassign to someone they can already see, not to an arbitrary employee
		# elsewhere in the org.
		if assigned_to not in scope:
			frappe.throw(
				_("Not permitted. Employee '{0}' is outside your scope.").format(assigned_to),
				frappe.PermissionError,
			)
		ca.assigned_to = assigned_to

	# Update defer_until if provided, independent of status changes
	if defer_until is not None:
		ca.defer_until = defer_until

	# Save the updated CA
	ca.save(ignore_permissions=True)

	# Notify newly-assigned employee for a plain reassignment (assigned_to changed
	# with no status change in this same call). Status-change flows are handled by
	# the T4 block below instead, so this and T4 never both fire for one call.
	if assigned_to is not None and status is None:
		notify_ca_assigned(ca.name, ca.run, assigned_to)

	# T4 — Notify raised_by employee if CA was just marked Resolved or Closed
	if status is not None and status in ("Resolved", "Closed"):
		try:
			# Fetch run's template title
			run_template_title = frappe.db.get_value(
				"SOP Run",
				ca.run,
				"template_title_snapshot",
			)

			# Get assigned_to employee's name
			assigned_to_name = _employee_name_for_link(ca.assigned_to)

			# Resolve raised_by employee's user and email
			raised_by_user = frappe.db.get_value(
				"Pulse Employee",
				ca.raised_by,
				"user",
			)
			raised_by_email = None
			if raised_by_user:
				raised_by_email = frappe.db.get_value("User", raised_by_user, "email")

			# Create in-app notification for raised_by
			frappe.get_doc({
				"doctype": "Pulse Notification",
				"recipient": ca.raised_by,
				"kind": "CA Resolved",
				"title": f"Corrective action on {run_template_title} — {ca.status}.",
				"reference_doctype": "Corrective Action",
				"reference_name": ca.name,
			}).insert(ignore_permissions=True)

			# Send email to raised_by if email found
			if raised_by_email:
				frappe.sendmail(
					recipients=[raised_by_email],
					subject=f"Resolved: corrective action on {run_template_title}",
					message=f"{assigned_to_name} marked the corrective action on run {ca.run} as {ca.status}.",
				)
			else:
				frappe.logger("corrective_actions").warning(
					f"Could not resolve email for raised_by {ca.raised_by} on corrective action {ca.name}"
				)
		except Exception as e:
			# Log notification failure but do not crash the operation
			frappe.logger("corrective_actions").error(
				f"Notification insert/send failed for corrective action {ca.name}: {str(e)}"
			)

	return {
		"name": ca.name,
		"status": ca.status,
		"resolution": ca.resolution,
		"resolvedAt": ca.resolved_at,
		"assignedTo": ca.assigned_to,
		"waiveReason": ca.waive_reason,
		"deferUntil": ca.defer_until,
	}


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
	_check_corrective_action_write_permission()

	if not run_name:
		frappe.throw(_("SOP Run name is required."))

	# Verify the run exists and is failed (same validation as create_corrective_action_for_run)
	run_row = frappe.db.get_value(
		"SOP Run",
		run_name,
		["name", "employee", "compliance_result"],
		as_dict=True,
	)
	if not run_row:
		frappe.throw(
			_("SOP Run '{0}' does not exist.").format(run_name),
			frappe.DoesNotExistError,
		)
	if run_row["compliance_result"] != "Failed":
		frappe.throw(
			_(
				"Corrective action can only be created for failed SOP runs. Run '{0}' has "
				"compliance result '{1}'."
			).format(run_name, run_row["compliance_result"]),
		)

	# Verify the caller has permission to create work for this employee (scope check)
	failed_employee = run_row["employee"]
	scope = get_scope_for_user(frappe.session.user)
	if failed_employee not in scope:
		frappe.throw(
			_(
				"Not permitted. Employee '{0}' (from run '{1}') is outside your scope."
			).format(failed_employee, run_name),
			frappe.PermissionError,
		)

	# Resolve the escalation target for this employee
	assigned_to = resolve_escalation_target(failed_employee)
	if not assigned_to:
		frappe.throw(
			_(
				"Cannot escalate corrective action: employee '{0}' has no active manager "
				"or escalation target."
			).format(failed_employee),
			frappe.ValidationError,
		)

	# Handle existing_ca case: update the existing CA
	if existing_ca:
		ca = frappe.get_doc("Corrective Action", existing_ca)
		if not ca:
			frappe.throw(
				_("Corrective Action '{0}' does not exist.").format(existing_ca),
				frappe.DoesNotExistError,
			)

		# Verify the CA is actually linked to this run
		if ca.run != run_name:
			frappe.throw(
				_(
					"Corrective Action '{0}' is not linked to run '{1}'. "
					"It belongs to run '{2}'."
				).format(existing_ca, run_name, ca.run),
				frappe.ValidationError,
			)

		# Update the CA with escalation target and flag
		ca.assigned_to = assigned_to
		ca.escalated = 1
		ca.save(ignore_permissions=True)
		notify_ca_assigned(ca.name, run_name, assigned_to, kind="Escalation")
	else:
		# Create a new CA with escalation target and flag
		raised_by = _get_employee_for_user(frappe.session.user)
		if not raised_by:
			frappe.throw(
				_("Current user is not linked to a Pulse Employee. Cannot raise corrective action."),
			)

		doc = frappe.get_doc(
			{
				"doctype": "Corrective Action",
				"run": run_name,
				"description": _("Escalation: {0}").format(run_name),
				"status": "Open",
				"assigned_to": assigned_to,
				"raised_by": raised_by,
				"priority": "Medium",
				"escalated": 1,
			}
		)
		doc.insert(ignore_permissions=True)
		ca = doc
		notify_ca_assigned(ca.name, run_name, assigned_to, kind="Escalation")

	# Get the resolved employee name for the response
	assigned_to_name = _employee_name_for_link(ca.assigned_to)

	return {
		"name": ca.name,
		"assignedTo": ca.assigned_to,
		"assignedToName": assigned_to_name,
		"escalated": True,
	}
