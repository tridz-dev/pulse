# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _
from frappe.utils import now_datetime

from pulse.api.permissions import get_scope_for_user, _get_employee_for_user


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
) -> dict:
	"""Update an existing Corrective Action.

	Only roles with write permission on Corrective Action may call this endpoint.
	The caller must have scope over the CA's assigned_to or raised_by employee.

	If status is being set to "Resolved" or "Closed", the resolved_at timestamp
	is automatically set to the current time if not already set. Resolution text
	is required when marking a CA as resolved or closed.

	Args:
		name: Name of the Corrective Action to update.
		status: Optional new status (Open, In Progress, Resolved, Closed).
		resolution: Optional resolution text (required if status is Resolved/Closed).
		assigned_to: Optional new assigned_to employee.

	Returns:
		{
			"name": <CA name>,
			"status": <status>,
			"resolution": <resolution>,
			"resolvedAt": <datetime or null>,
			"assignedTo": <employee id>,
		}

	Raises:
		frappe.PermissionError: If caller lacks write permission or scope.
		frappe.DoesNotExistError: If the CA does not exist.
		frappe.ValidationError: If validation fails (e.g., resolution required for resolved status).
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
		valid_statuses = ["Open", "In Progress", "Resolved", "Closed"]
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
		ca.assigned_to = assigned_to

	# Save the updated CA
	ca.save(ignore_permissions=True)

	return {
		"name": ca.name,
		"status": ca.status,
		"resolution": ca.resolution,
		"resolvedAt": ca.resolved_at,
		"assignedTo": ca.assigned_to,
	}
