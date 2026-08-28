# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _
from frappe.utils import getdate

from pulse.api.notifications import notify_ca_assigned
from pulse.api.permissions import get_scope_for_user, _get_employee_for_user
from pulse.api.scores import _calculate_score_snapshot, _period_range
from pulse.domain.escalation import resolve_escalation_target


def _employee_dict(emp_name: str) -> dict | None:
	"""Get PM Employee as a small dict for API (user-like shape). role = alias from PM Role."""
	if not emp_name:
		return None
	row = frappe.db.get_value(
		"Pulse Employee",
		emp_name,
		["name", "employee_name", "pulse_role", "branch", "avatar_url", "department"],
		as_dict=True,
	)
	if not row:
		return None
	pulse_role_link = row.get("pulse_role")
	role_alias = frappe.db.get_value("Pulse Role", pulse_role_link, "alias") if pulse_role_link else None
	system_role = frappe.db.get_value("Pulse Role", pulse_role_link, "system_role") if pulse_role_link else None
	return {
		"id": row["name"],
		"name": row["employee_name"],
		"role": role_alias or pulse_role_link,
		"systemRole": system_role,
		"branch": row.get("branch"),
		"avatarUrl": row.get("avatar_url"),
		"reportsToId": frappe.db.get_value("Pulse Employee", emp_name, "reports_to"),
	}


@frappe.whitelist()
def get_operations_overview(top_employee: str, date: str | None = None, period_type: str = "Day"):
	"""Build the full hierarchy tree with scores for the Operations page."""
	# Verify the caller has permission to view this employee's subtree
	scope = get_scope_for_user(frappe.session.user)
	if top_employee not in scope:
		frappe.throw(
			_(
				"Not permitted. Employee '{0}' is outside your scope."
			).format(top_employee),
			frappe.PermissionError,
		)

	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")

	def build_tree(emp_name: str):
		user = _employee_dict(emp_name)
		if not user:
			return None
		score = _calculate_score_snapshot(emp_name, date_str, period_type or "Day")
		subs = frappe.get_all(
			"Pulse Employee",
			filters={"reports_to": emp_name, "is_active": 1},
			pluck="name",
		)
		children = [build_tree(s) for s in subs]
		children = [c for c in children if c is not None]
		return {
			"user": user,
			"score": score,
			"children": children,
		}

	root = build_tree(top_employee)
	return root


@frappe.whitelist()
def get_user_run_breakdown(employee: str, date: str | None = None, period_type: str = "Day"):
	"""Detailed run breakdown grouped by template for the ScoreBreakdown sheet."""
	# Verify the caller has permission to view this employee's data
	scope = get_scope_for_user(frappe.session.user)
	if employee not in scope:
		frappe.throw(
			_(
				"Not permitted. Employee '{0}' is outside your scope."
			).format(employee),
			frappe.PermissionError,
		)

	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	start_d, end_d = _period_range(date_str, period_type or "Day")

	user = _employee_dict(employee)
	if not user:
		frappe.throw("Employee not found.")

	runs = frappe.get_all(
		"SOP Run",
		filters={
			"employee": employee,
			"period_date": ["between", [start_d, end_d]],
		},
		fields=["name", "template", "period_date", "status", "total_items", "completed_items"],
	)
	template_groups = {}
	for run in runs:
		template_name = run["template"]
		tmpl = frappe.db.get_value(
			"SOP Template",
			template_name,
			["name", "title", "department", "frequency_type"],
			as_dict=True,
		)
		if not tmpl:
			continue
		if template_name not in template_groups:
			template_groups[template_name] = {
				"templateId": template_name,
				"templateTitle": tmpl["title"],
				"department": tmpl.get("department"),
				"frequencyType": tmpl["frequency_type"],
				"runs": [],
				"totalItems": 0,
				"completedItems": 0,
				"missedItems": 0,
			}
		items = frappe.get_all(
			"SOP Run Item",
			filters={"parent": run["name"]},
			fields=["name", "checklist_item", "weight", "status", "completed_at"],
		)
		run_item_details = []
		for it in items:
			run_item_details.append({
				"runItemId": it["name"],
				"runId": run["name"],
				"checklistItemId": it["checklist_item"],
				"description": it["checklist_item"],
				"weight": it.get("weight") or 1,
				"status": it["status"],
				"completedAt": it.get("completed_at"),
			})
		completed = sum(1 for i in items if i["status"] == "Completed")
		missed = sum(1 for i in items if i["status"] == "Missed")
		pending = sum(1 for i in items if i["status"] == "Pending")
		run_breakdown = {
			"runId": run["name"],
			"templateId": template_name,
			"templateTitle": tmpl["title"],
			"department": tmpl.get("department"),
			"frequencyType": tmpl["frequency_type"],
			"periodDate": str(run["period_date"]),
			"runStatus": run["status"],
			"items": run_item_details,
			"totalItems": len(items),
			"completedItems": completed,
			"missedItems": missed,
			"pendingItems": pending,
			"progress": (completed / len(items) * 100) if items else 0,
		}
		gr = template_groups[template_name]
		gr["runs"].append(run_breakdown)
		gr["totalItems"] += len(items)
		gr["completedItems"] += completed
		gr["missedItems"] += missed

	template_groups_list = list(template_groups.values())
	total_items = sum(g["totalItems"] for g in template_groups_list)
	completed_items = sum(g["completedItems"] for g in template_groups_list)
	missed_items = sum(g["missedItems"] for g in template_groups_list)
	period_label = date_str[:10] if (period_type or "Day") == "Day" else f"{start_d} to {end_d}"

	return {
		"user": user,
		"periodLabel": period_label,
		"templateGroups": template_groups_list,
		"totalItems": total_items,
		"completedItems": completed_items,
		"missedItems": missed_items,
		"overallCompletion": (completed_items / total_items * 100) if total_items else 0,
	}


@frappe.whitelist()
def get_hierarchy_breakdown(top_employee: str, date: str | None = None, period_type: str = "Day"):
	"""Full hierarchy with per-user breakdown (heavy endpoint)."""
	# Verify the caller has permission to view this employee's subtree
	scope = get_scope_for_user(frappe.session.user)
	if top_employee not in scope:
		frappe.throw(
			_(
				"Not permitted. Employee '{0}' is outside your scope."
			).format(top_employee),
			frappe.PermissionError,
		)

	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")

	def build_node(emp_name: str):
		user = _employee_dict(emp_name)
		if not user:
			return None
		breakdown = get_user_run_breakdown(emp_name, date_str, period_type or "Day")
		score = _calculate_score_snapshot(emp_name, date_str, period_type or "Day")
		subs = frappe.get_all(
			"Pulse Employee",
			filters={"reports_to": emp_name, "is_active": 1},
			pluck="name",
		)
		children = [build_node(s) for s in subs]
		children = [c for c in children if c is not None]
		return {
			"user": user,
			"breakdown": breakdown,
			"score": score,
			"children": children,
		}

	return build_node(top_employee)


@frappe.whitelist()
def get_failure_list(start_date: str, end_date: str, page: int = 1, page_size: int = 20) -> dict:
	"""Return failed SOP runs in the caller's scope, for the "what's broken" drill-down.

	Runs are selected by their frozen ``due_at`` falling within [start_date, end_date]
	(inclusive), per the domain contract's convention of filtering on due_at rather
	than period_date. Only runs for employees in the caller's visible scope
	(``get_scope_for_user``) are considered; pagination is applied after that scope
	filter so a page never leaks or drops out-of-scope rows.

	Overdue duration is not computed here; the response returns ``due_at`` and
	leaves the "how overdue" calculation to the frontend, which has the current time.

	Response contract:
	    {
	        "items": [
	            {
	                "run": <run name>,
	                "person": {"employee": <id>, "name": <employee_name_snapshot>},
	                "template_title": <template_title_snapshot>,
	                "due_at": <datetime>,
	                "status": <SOP Run status>,
	                "compliance_result": "Failed",
	                "has_corrective_action": <bool>,
	                "corrective_action": <CA name or null>,
	                "corrective_action_status": <CA status or null>,
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

	# due_at is a datetime field; a plain date string for end_date would be
	# implicitly compared as that day's midnight, silently excluding runs due
	# later that same day. Pin the range to the full calendar days requested.
	range_start = f"{getdate(start_date)} 00:00:00"
	range_end = f"{getdate(end_date)} 23:59:59"

	filters = {
		"compliance_result": "Failed",
		"employee": ["in", visible_scope],
		"due_at": ["between", [range_start, range_end]],
	}

	total = frappe.db.count("SOP Run", filters=filters)

	rows = frappe.get_all(
		"SOP Run",
		filters=filters,
		fields=[
			"name",
			"employee",
			"employee_name_snapshot",
			"template_title_snapshot",
			"due_at",
			"status",
			"compliance_result",
		],
		order_by="due_at desc, name asc",
		limit_start=(page - 1) * page_size,
		limit_page_length=page_size,
	)

	# Batched lookup of Corrective Actions linked to the runs on this page, so the
	# frontend can tell "has any CA been created for this run" without an N+1 query.
	run_names = [row["name"] for row in rows]
	ca_by_run = {}
	if run_names:
		ca_rows = frappe.get_all(
			"Corrective Action",
			filters={"run": ["in", run_names]},
			fields=["run", "name", "status"],
			order_by="creation asc",
		)
		for ca_row in ca_rows:
			# If a run somehow has more than one CA, keep the first one encountered;
			# this endpoint only needs a representative CA for the linkage indicator.
			ca_by_run.setdefault(ca_row["run"], ca_row)

	items = [
		{
			"run": row["name"],
			"person": {
				"employee": row["employee"],
				"name": row["employee_name_snapshot"],
			},
			"template_title": row["template_title_snapshot"],
			"due_at": row["due_at"],
			"status": row["status"],
			"compliance_result": row["compliance_result"],
			"has_corrective_action": row["name"] in ca_by_run,
			"corrective_action": ca_by_run.get(row["name"], {}).get("name"),
			"corrective_action_status": ca_by_run.get(row["name"], {}).get("status"),
		}
		for row in rows
	]

	return {"items": items, "page": page, "page_size": page_size, "total": total}


def _check_corrective_action_write_permission():
	"""Only roles with create/write permission on Corrective Action may mutate."""
	user = frappe.session.user
	if user == "Administrator":
		return
	roles = frappe.get_roles(user)
	if "Pulse Admin" in roles or "Pulse Leader" in roles or "Pulse Manager" in roles:
		return
	frappe.throw(
		_("Not permitted. Only Pulse Admin, Pulse Leader, or Pulse Manager can create Corrective Actions."),
		frappe.PermissionError,
	)


@frappe.whitelist()
def create_corrective_action_for_run(
	run_name: str,
	description: str,
	priority: str = "Medium",
	assigned_to: str | None = None,
	notify: bool = True,
) -> str:
	"""Create a Corrective Action for a failed SOP Run (manager-initiated).

	This is the whitelisted API for manager follow-up work. A manager identifies a
	failed SOP run that requires corrective action and uses this endpoint to create
	and track the resolution loop. The corrective action is linked back to the source
	run, satisfying the domain contract: "Manager work can be traced back to the
	failed SOP run."

	Args:
		run_name: Name of the SOP Run (must exist and have compliance_result = "Failed").
		description: Required description of the corrective action needed.
		priority: Optional priority level (Low, Medium, High, Critical). Defaults to "Medium".
		assigned_to: Optional Pulse Employee to assign the corrective action to. If not
			provided, defaults to the employee's escalation target (their direct manager,
			via resolve_escalation_target()). If no escalation target exists, assignment
			is required and the function will fail.
		notify: Whether to send the "New corrective action assigned" notification to
			assigned_to. Defaults to True. Callers that immediately transition the new
			Corrective Action to a terminal, non-actionable status (e.g. waiving a run
			with no existing CA) should pass False to avoid sending a spurious
			actionable-work notification for something already resolved.

	Returns:
		The name of the newly created Corrective Action document.

	Raises:
		frappe.PermissionError: If the caller does not have create permission on Corrective Action.
		frappe.DoesNotExistError: If the SOP Run does not exist or is not failed.
		frappe.ValidationError: If the assigned_to employee cannot be resolved.
	"""
	_check_corrective_action_write_permission()

	if not run_name:
		frappe.throw(_("SOP Run name is required."))
	if not description:
		frappe.throw(_("Description is required."))

	# Verify the run exists and is failed
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

	# Verify the caller has permission to create work for this employee
	failed_employee = run_row["employee"]
	scope = get_scope_for_user(frappe.session.user)
	if failed_employee not in scope:
		frappe.throw(
			_(
				"Not permitted. Employee '{0}' (from run '{1}') is outside your scope."
			).format(failed_employee, run_name),
			frappe.PermissionError,
		)

	# Determine who should be assigned this action
	if not assigned_to:
		# Default to the employee's escalation target (direct manager)
		assigned_to = resolve_escalation_target(failed_employee)
		if not assigned_to:
			frappe.throw(
				_(
					"Cannot auto-assign corrective action: employee '{0}' has no active manager "
					"or escalation target. Please specify assigned_to explicitly."
				).format(failed_employee),
			)
	else:
		# Verify the provided assignee exists and is active
		if not frappe.db.exists("Pulse Employee", {"name": assigned_to, "is_active": 1}):
			frappe.throw(
				_("Assigned employee '{0}' does not exist or is inactive.").format(assigned_to),
				frappe.DoesNotExistError,
			)
		# Verify the assignee is within the caller's scope — a manager may only
		# hand off corrective work to someone they can already see, not to an
		# arbitrary employee elsewhere in the org.
		if assigned_to not in scope:
			frappe.throw(
				_("Not permitted. Employee '{0}' is outside your scope.").format(assigned_to),
				frappe.PermissionError,
			)

	# Determine who is raising this (the calling manager/leader)
	raised_by = _get_employee_for_user(frappe.session.user)
	if not raised_by:
		frappe.throw(
			_("Current user is not linked to a Pulse Employee. Cannot raise corrective action."),
		)

	# Validate priority
	valid_priorities = ["Low", "Medium", "High", "Critical"]
	if priority not in valid_priorities:
		frappe.throw(
			_("Priority must be one of {0}. Got '{1}'.").format(
				", ".join(valid_priorities), priority
			),
		)

	# Create the Corrective Action
	doc = frappe.get_doc(
		{
			"doctype": "Corrective Action",
			"run": run_name,
			"description": description,
			"status": "Open",
			"assigned_to": assigned_to,
			"raised_by": raised_by,
			"priority": priority,
		}
	)
	doc.insert(ignore_permissions=True)

	# T3 — Notify assigned_to employee that CA was assigned
	if notify:
		notify_ca_assigned(doc.name, run_name, assigned_to, description=description)

	return doc.name
