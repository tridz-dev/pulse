# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.utils import getdate

from pulse.api.scores import _calculate_score_snapshot, _period_range


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
