# Copyright (c) 2026, Tridz and contributors
# License: MIT

from datetime import timedelta

import frappe
from frappe.utils import getdate, get_first_day, get_last_day

from pulse.api.permissions import _get_system_role_for_employee


def _period_range(date_str: str, period_type: str):
	"""Return (start_date, end_date) as strings YYYY-MM-DD for the given period."""
	dt = getdate(date_str)
	if period_type == "Day":
		d = dt.strftime("%Y-%m-%d")
		return d, d
	if period_type == "Week":
		# Monday = 0
		weekday = dt.weekday()
		start = dt - timedelta(days=weekday)
		end = start + timedelta(days=6)
		return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
	# Month
	start = get_first_day(dt)
	end = get_last_day(dt)
	return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def _calculate_score_snapshot(employee: str, date_str: str, period_type: str) -> dict:
	"""Compute own_score, team_score, combined_score for one employee in the period."""
	start_d, end_d = _period_range(date_str, period_type)

	# 1. Own score: all runs for this employee in [start_d, end_d]
	runs = frappe.get_all(
		"SOP Run",
		filters={
			"employee": employee,
			"period_date": ["between", [start_d, end_d]],
		},
		pluck="name",
	)
	total_items = 0
	completed_items = 0
	for run_name in runs:
		run = frappe.db.get_value("SOP Run", run_name, ["total_items", "completed_items"], as_dict=True)
		if run:
			total_items += run.total_items or 0
			completed_items += run.completed_items or 0

	own_score = (completed_items / total_items) if total_items else 0.0

	# 2. Team score: average combined_score of direct reports
	subordinates = frappe.get_all(
		"Pulse Employee",
		filters={"reports_to": employee, "is_active": 1},
		pluck="name",
	)
	team_score = 0.0
	if subordinates:
		team_total = 0.0
		members_with_load = 0
		for sub in subordinates:
			sub_snap = _calculate_score_snapshot(sub, date_str, period_type)
			if (sub_snap.get("total_items") or 0) > 0 or (sub_snap.get("team_score") or 0) != 0:
				team_total += sub_snap.get("combined_score", 0)
				members_with_load += 1
		if members_with_load:
			team_score = team_total / members_with_load

	# 3. Combined
	if team_score > 0 and total_items > 0:
		combined_score = (own_score + team_score) / 2
	elif team_score > 0:
		combined_score = team_score
	else:
		combined_score = own_score

	period_label = date_str[:10] if period_type == "Day" else f"{start_d} to {end_d}"
	return {
		"employee": employee,
		"period": period_label,
		"own_score": round(own_score, 4),
		"team_score": round(team_score, 4),
		"combined_score": round(combined_score, 4),
		"total_items": total_items,
		"completed_items": completed_items,
		"totalGeneratedItems": total_items,
		"completedItems": completed_items,
	}


@frappe.whitelist()
def get_score_for_user(employee: str, date: str | None = None, period_type: str = "Day"):
	"""Calculate or return cached score snapshot for one employee."""
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	return _calculate_score_snapshot(employee, date_str, period_type or "Day")


@frappe.whitelist()
def get_team_scores(manager_employee: str, date: str | None = None, period_type: str = "Day"):
	"""Scores for all direct reports of a manager."""
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	subs = frappe.get_all(
		"Pulse Employee",
		filters={"reports_to": manager_employee, "is_active": 1},
		fields=["name", "employee_name", "pulse_role", "branch", "avatar_url"],
	)
	out = []
	for s in subs:
		snap = _calculate_score_snapshot(s.name, date_str, period_type or "Day")
		role_alias = frappe.db.get_value("Pulse Role", s.pulse_role, "alias") if s.pulse_role else None
		snap["user"] = {
			"name": s.employee_name,
			"id": s.name,
			"role": role_alias or s.pulse_role,
			"branch": s.branch,
			"avatarUrl": s.avatar_url,
		}
		# Alias for frontend
		snap["userId"] = s.name
		snap["totalGeneratedItems"] = snap["total_items"]
		snap["completedItems"] = snap["completed_items"]
		out.append(snap)
	return out


@frappe.whitelist()
def get_all_team_scores(employee: str, date: str | None = None, period_type: str = "Day"):
	"""Scores for all employees: org-wide for Executive, subtree for Area Manager."""
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	emp_doc = frappe.db.get_value(
		"Pulse Employee",
		employee,
		["name", "pulse_role"],
		as_dict=True,
	)
	if not emp_doc:
		return []
	system_role = _get_system_role_for_employee(employee)
	if system_role not in ("Pulse Executive", "Pulse Leader"):
		return []
	if system_role == "Pulse Executive":
		employee_names = frappe.get_all(
			"Pulse Employee",
			filters={"is_active": 1},
			pluck="name",
		)
	else:
		employee_names = _get_subtree_employees(employee)

	rows = frappe.get_all(
		"Pulse Employee",
		filters={"name": ["in", employee_names], "is_active": 1},
		fields=["name", "employee_name", "pulse_role", "branch", "avatar_url", "department", "reports_to"],
	)
	out = []
	for row in rows:
		snap = _calculate_score_snapshot(row.name, date_str, period_type or "Day")
		reports_to_name = None
		if row.reports_to:
			reports_to_name = frappe.db.get_value("Pulse Employee", row.reports_to, "employee_name")
		role_alias = frappe.db.get_value("Pulse Role", row.pulse_role, "alias") if row.pulse_role else None
		snap["user"] = {
			"name": row.employee_name,
			"id": row.name,
			"role": role_alias or row.pulse_role,
			"branch": row.branch,
			"avatarUrl": row.avatar_url,
		}
		snap["userId"] = row.name
		snap["totalGeneratedItems"] = snap["total_items"]
		snap["completedItems"] = snap["completed_items"]
		snap["department"] = row.department
		snap["reports_to_name"] = reports_to_name
		out.append(snap)
	return out


@frappe.whitelist()
def get_failure_analytics(manager_employee: str, date: str | None = None):
	"""Top 5 most-missed tasks across the manager's subtree (last 30 days)."""
	from datetime import timedelta

	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	end_d = getdate(date_str)
	start_d = end_d - timedelta(days=30)
	start_s = start_d.strftime("%Y-%m-%d")
	end_s = end_d.strftime("%Y-%m-%d")

	# All employees in subtree
	subtree = _get_subtree_employees(manager_employee)
	if not subtree:
		return {"mostMissedTasks": []}

	# All runs for these employees in the window
	runs = frappe.get_all(
		"SOP Run",
		filters={
			"employee": ["in", subtree],
			"period_date": ["between", [start_s, end_s]],
		},
		pluck="name",
	)
	# Count missed by checklist_item (description)
	missed_count = {}
	for run_name in runs:
		items = frappe.get_all(
			"SOP Run Item",
			filters={"parent": run_name, "status": "Missed"},
			fields=["checklist_item"],
		)
		for row in items:
			key = row["checklist_item"] or ""
			missed_count[key] = missed_count.get(key, 0) + 1
		# Also count Pending on past runs as missed
		run_doc = frappe.db.get_value("SOP Run", run_name, ["period_date", "status"], as_dict=True)
		if run_doc and run_doc.period_date < date_str and run_doc.status != "Open":
			items_pending = frappe.get_all(
				"SOP Run Item",
				filters={"parent": run_name, "status": "Pending"},
				fields=["checklist_item"],
			)
			for row in items_pending:
				key = row["checklist_item"] or ""
				missed_count[key] = missed_count.get(key, 0) + 1

	# Top 5
	sorted_items = sorted(missed_count.items(), key=lambda x: -x[1])[:5]
	# Resolve template title from first run that had this item (we don't store template on item; we get from run)
	most_missed = []
	for checklist_item_desc, count in sorted_items:
		most_missed.append({
			"id": checklist_item_desc,
			"taskName": checklist_item_desc,
			"templateName": "—",
			"misses": count,
		})
	# Try to get template name from any run containing this item
	for run_name in runs[:50]:
		template = frappe.db.get_value("SOP Run", run_name, "template")
		template_title = frappe.db.get_value("SOP Template", template, "title") if template else None
		for m in most_missed:
			if m["templateName"] == "—" and template_title:
				m["templateName"] = template_title
				break
	return {"mostMissedTasks": most_missed}


def _get_subtree_employees(manager_employee: str) -> list:
	"""All PM Employee names in the subtree under manager."""
	result = []
	stack = [manager_employee]
	while stack:
		emp = stack.pop()
		result.append(emp)
		for sub in frappe.get_all("Pulse Employee", filters={"reports_to": emp, "is_active": 1}, pluck="name"):
			stack.append(sub)
	return result
