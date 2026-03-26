# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Analytics API for Insights page. SQL-level aggregation for scale."""

from datetime import timedelta

import frappe
from frappe.utils import getdate

from pulse.api.permissions import (
	_get_employee_for_user,
	_get_subtree_employee_names,
)
from pulse.api.scores import _calculate_score_snapshot
from pulse.cache import cache_result, cache_invalidate


def _get_insight_employee_scope():
	"""Return (employee_names, role) for current user. Empty list if no access."""
	roles = frappe.get_roles(frappe.session.user)
	if frappe.session.user == "Administrator" or "Pulse Admin" in roles or "Pulse Executive" in roles:
		all_emps = frappe.get_all("Pulse Employee", filters={"is_active": 1}, pluck="name")
		return all_emps, "Executive"
	emp = _get_employee_for_user()
	if not emp:
		return [], None
	if "Pulse Leader" in roles:
		subtree = _get_subtree_employee_names(emp)
		return subtree or [emp], "Area Manager"
	return [], None


def _default_date_range(days: int = 30):
	today = getdate()
	start = today - timedelta(days=days)
	return start.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")


@frappe.whitelist()
@cache_result(ttl=600)
def get_insight_departments():
	"""Return list of PM Department names for filter dropdown."""
	rows = frappe.get_all("Pulse Department", filters={"is_active": 1}, pluck="department_name")
	return sorted(rows or [])


@frappe.whitelist()
@cache_result(ttl=300, key_builder=lambda: f"insights:branches:{frappe.session.user}")
def get_insight_branches():
	"""Return distinct branch values (within scope) for filter dropdown."""
	scope, _ = _get_insight_employee_scope()
	if not scope:
		return []
	placeholders = ", ".join(["%s"] * len(scope))
	rows = frappe.db.sql(
		f"""
		SELECT DISTINCT NULLIF(TRIM(branch), '') AS branch
		FROM `tabPulse Employee`
		WHERE name IN ({placeholders}) AND is_active = 1 AND branch IS NOT NULL AND TRIM(branch) != ''
		""",
		scope,
		as_dict=True,
	)
	branches = [r["branch"] for r in rows if r.get("branch")]
	return sorted(branches)


def _apply_filters(employee_names, department=None, branch=None, employee=None):
	"""Narrow employee list by optional department/branch/employee filters."""
	if not employee_names:
		return []
	if employee:
		return [employee] if employee in employee_names else []
	filters = {"name": ["in", employee_names], "is_active": 1}
	if department:
		if isinstance(department, list):
			filters["department"] = ["in", department]
		else:
			filters["department"] = department
	if branch:
		if isinstance(branch, list):
			filters["branch"] = ["in", branch]
		else:
			filters["branch"] = branch
	return frappe.get_all("Pulse Employee", filters=filters, pluck="name")


@frappe.whitelist()
@cache_result(ttl=300, key_builder=lambda start_date=None, end_date=None, period_type="Day", department=None, branch=None, employee=None: f"insights:score_trends:{employee or department or branch or 'org'}:{period_type}:{hash(str(start_date))}:{hash(str(end_date))}")
def get_score_trends(start_date=None, end_date=None, period_type="Day", department=None, branch=None, employee=None):
	"""Time-series avg combined score. Returns [{date, avg_score, employee_count}]."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	start, end = _default_date_range(30)
	if start_date:
		start = getdate(start_date).strftime("%Y-%m-%d")
	if end_date:
		end = getdate(end_date).strftime("%Y-%m-%d")
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT s.period_key AS date, AVG(s.combined_score) AS avg_score, COUNT(DISTINCT s.employee) AS employee_count
		FROM `tabScore Snapshot` s
		WHERE s.period_type = %s AND s.employee IN ({placeholders})
		  AND s.period_key BETWEEN %s AND %s
		GROUP BY s.period_key
		ORDER BY s.period_key
		""",
		[period_type or "Day"] + employees + [start, end],
		as_dict=True,
	)
	return [{"date": r["date"], "avg_score": round(float(r["avg_score"] or 0), 4), "employee_count": r["employee_count"]} for r in rows]


@frappe.whitelist()
@cache_result(ttl=300, key_builder=lambda date=None, period_type="Day", department=None, branch=None, employee=None: f"insights:dept_comp:{hash(str(date))}:{period_type}:{hash(str(department))}:{hash(str(branch))}:{hash(str(employee))}")
def get_department_comparison(date=None, period_type="Day", department=None, branch=None, employee=None):
	"""Average scores per department. Returns [{department, avg_score, headcount}]."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT COALESCE(e.department, 'Unassigned') AS department,
		       AVG(s.combined_score) AS avg_score,
		       COUNT(DISTINCT s.employee) AS headcount
		FROM `tabScore Snapshot` s
		JOIN `tabPulse Employee` e ON s.employee = e.name
		WHERE s.period_type = %s AND s.period_key = %s AND s.employee IN ({placeholders}) AND e.is_active = 1
		GROUP BY e.department
		ORDER BY avg_score DESC
		""",
		[period_type or "Day", date_str] + employees,
		as_dict=True,
	)
	return [{"department": r["department"], "avg_score": round(float(r["avg_score"] or 0), 4), "headcount": r["headcount"]} for r in rows]


@frappe.whitelist()
@cache_result(ttl=300, key_builder=lambda date=None, period_type="Day", department=None, branch=None, employee=None: f"insights:branch_comp:{hash(str(date))}:{period_type}:{hash(str(department))}:{hash(str(branch))}:{hash(str(employee))}")
def get_branch_comparison(date=None, period_type="Day", department=None, branch=None, employee=None):
	"""Average scores per branch. Returns [{branch, avg_score, headcount}]."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT COALESCE(NULLIF(TRIM(e.branch), ''), 'Unassigned') AS branch,
		       AVG(s.combined_score) AS avg_score,
		       COUNT(DISTINCT s.employee) AS headcount
		FROM `tabScore Snapshot` s
		JOIN `tabPulse Employee` e ON s.employee = e.name
		WHERE s.period_type = %s AND s.period_key = %s AND s.employee IN ({placeholders}) AND e.is_active = 1
		GROUP BY e.branch
		ORDER BY avg_score DESC
		""",
		[period_type or "Day", date_str] + employees,
		as_dict=True,
	)
	return [{"branch": r["branch"], "avg_score": round(float(r["avg_score"] or 0), 4), "headcount": r["headcount"]} for r in rows]


@frappe.whitelist()
@cache_result(ttl=300, key_builder=lambda date=None, period_type="Day", limit=5, department=None, branch=None, employee=None: f"insights:performers:{hash(str(date))}:{period_type}:{limit}:{hash(str(department))}:{hash(str(branch))}:{hash(str(employee))}")
def get_top_bottom_performers(date=None, period_type="Day", limit=5, department=None, branch=None, employee=None):
	"""Top N and bottom N employees. Returns {top: [...], bottom: [...]}."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return {"top": [], "bottom": []}
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	limit = min(int(limit or 5), 20)
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT s.employee, e.employee_name, e.pulse_role, e.department, e.branch,
		       s.combined_score, s.own_score, s.total_items, s.completed_items
		FROM `tabScore Snapshot` s
		JOIN `tabPulse Employee` e ON s.employee = e.name
		WHERE s.period_type = %s AND s.period_key = %s AND s.employee IN ({placeholders}) AND e.is_active = 1
		ORDER BY s.combined_score DESC
		""",
		[period_type or "Day", date_str] + employees,
		as_dict=True,
	)
	top = [{"employee": r["employee"], "employee_name": r["employee_name"], "pulse_role": r["pulse_role"], "department": r["department"], "branch": r["branch"], "combined_score": round(float(r["combined_score"] or 0), 4), "own_score": round(float(r["own_score"] or 0), 4), "total_items": r["total_items"] or 0, "completed_items": r["completed_items"] or 0} for r in rows[:limit]]
	bottom = [{"employee": r["employee"], "employee_name": r["employee_name"], "pulse_role": r["pulse_role"], "department": r["department"], "branch": r["branch"], "combined_score": round(float(r["combined_score"] or 0), 4), "own_score": round(float(r["own_score"] or 0), 4), "total_items": r["total_items"] or 0, "completed_items": r["completed_items"] or 0} for r in rows[-limit:][::-1]]
	return {"top": top, "bottom": bottom}


@frappe.whitelist()
@cache_result(ttl=300, key_builder=lambda start_date=None, end_date=None, department=None, branch=None, employee=None: f"insights:template_perf:{hash(str(start_date))}:{hash(str(end_date))}:{hash(str(department))}:{hash(str(branch))}:{hash(str(employee))}")
def get_template_performance(start_date=None, end_date=None, department=None, branch=None, employee=None):
	"""Completion rates per SOP template. Returns [{template, title, department, avg_completion, run_count}]."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	start, end = _default_date_range(30)
	if start_date:
		start = getdate(start_date).strftime("%Y-%m-%d")
	if end_date:
		end = getdate(end_date).strftime("%Y-%m-%d")
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT r.template, t.title, t.department,
		       AVG(CASE WHEN r.total_items > 0 THEN r.completed_items / r.total_items ELSE 0 END) AS avg_completion,
		       COUNT(*) AS run_count
		FROM `tabSOP Run` r
		JOIN `tabSOP Template` t ON r.template = t.name
		WHERE r.employee IN ({placeholders}) AND r.period_date BETWEEN %s AND %s
		GROUP BY r.template, t.title, t.department
		ORDER BY avg_completion ASC
		""",
		employees + [start, end],
		as_dict=True,
	)
	return [{"template": r["template"], "title": r["title"], "department": r["department"], "avg_completion": round(float(r["avg_completion"] or 0), 4), "run_count": r["run_count"]} for r in rows]


@frappe.whitelist()
def get_completion_trend(start_date=None, end_date=None, department=None, branch=None, employee=None):
	"""Daily completion rate. Returns [{date, completed, total, rate}]."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	start, end = _default_date_range(30)
	if start_date:
		start = getdate(start_date).strftime("%Y-%m-%d")
	if end_date:
		end = getdate(end_date).strftime("%Y-%m-%d")
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT r.period_date AS date,
		       SUM(r.completed_items) AS completed,
		       SUM(r.total_items) AS total,
		       CASE WHEN SUM(r.total_items) > 0 THEN SUM(r.completed_items) / SUM(r.total_items) ELSE 0 END AS rate
		FROM `tabSOP Run` r
		WHERE r.employee IN ({placeholders}) AND r.period_date BETWEEN %s AND %s
		GROUP BY r.period_date
		ORDER BY r.period_date
		""",
		employees + [start, end],
		as_dict=True,
	)
	return [{"date": str(r["date"]), "completed": r["completed"] or 0, "total": r["total"] or 0, "rate": round(float(r["rate"] or 0), 4)} for r in rows]


@frappe.whitelist()
def get_corrective_action_summary(department=None, branch=None, employee=None):
	"""CA breakdown. Returns {by_status: [...], by_priority: [...], avg_resolution_hours}."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return {"by_status": [], "by_priority": [], "avg_resolution_hours": None}
	placeholders = ", ".join(["%s"] * len(employees))
	by_status = frappe.db.sql(
		f"""
		SELECT status, COUNT(*) AS count
		FROM `tabCorrective Action`
		WHERE assigned_to IN ({placeholders}) OR raised_by IN ({placeholders})
		GROUP BY status
		""",
		employees + employees,
		as_dict=True,
	)
	by_priority = frappe.db.sql(
		f"""
		SELECT priority, COUNT(*) AS count
		FROM `tabCorrective Action`
		WHERE (assigned_to IN ({placeholders}) OR raised_by IN ({placeholders}))
		  AND status IN ('Open', 'In Progress')
		GROUP BY priority
		""",
		employees + employees,
		as_dict=True,
	)
	avg_row = frappe.db.sql(
		f"""
		SELECT AVG(TIMESTAMPDIFF(HOUR, creation, resolved_at)) AS avg_hours
		FROM `tabCorrective Action`
		WHERE resolved_at IS NOT NULL
		  AND (assigned_to IN ({placeholders}) OR raised_by IN ({placeholders}))
		""",
		employees + employees,
		as_dict=True,
	)
	avg_hours = round(float(avg_row[0]["avg_hours"] or 0), 1) if avg_row else None
	return {
		"by_status": [{"status": r["status"], "count": r["count"]} for r in by_status],
		"by_priority": [{"priority": r["priority"] or "Unset", "count": r["count"]} for r in by_priority],
		"avg_resolution_hours": avg_hours,
	}


@frappe.whitelist()
def get_day_of_week_heatmap(start_date=None, end_date=None, department=None, branch=None, employee=None):
	"""Completion rate by day of week. Returns [{day_name, day_num, avg_rate}]."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	start, end = _default_date_range(30)
	if start_date:
		start = getdate(start_date).strftime("%Y-%m-%d")
	if end_date:
		end = getdate(end_date).strftime("%Y-%m-%d")
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT DAYNAME(r.period_date) AS day_name, DAYOFWEEK(r.period_date) AS day_num,
		       AVG(CASE WHEN r.total_items > 0 THEN r.completed_items / r.total_items ELSE 0 END) AS avg_rate
		FROM `tabSOP Run` r
		WHERE r.employee IN ({placeholders}) AND r.period_date BETWEEN %s AND %s
		GROUP BY day_name, day_num
		ORDER BY day_num
		""",
		employees + [start, end],
		as_dict=True,
	)
	return [{"day_name": r["day_name"], "day_num": r["day_num"], "avg_rate": round(float(r["avg_rate"] or 0), 4)} for r in rows]


@frappe.whitelist()
def get_score_distribution(date=None, period_type="Day", department=None, branch=None, employee=None):
	"""Score histogram brackets. Returns [{bracket, count}]."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT
		  CASE
		    WHEN s.combined_score >= 0.9 THEN 1
		    WHEN s.combined_score >= 0.8 THEN 2
		    WHEN s.combined_score >= 0.6 THEN 3
		    WHEN s.combined_score >= 0.4 THEN 4
		    ELSE 5
		  END AS sort_key,
		  CASE
		    WHEN s.combined_score >= 0.9 THEN 'Exceptional (90-100%%)'
		    WHEN s.combined_score >= 0.8 THEN 'Strong (80-89%%)'
		    WHEN s.combined_score >= 0.6 THEN 'Moderate (60-79%%)'
		    WHEN s.combined_score >= 0.4 THEN 'At Risk (40-59%%)'
		    ELSE 'Critical (<40%%)'
		  END AS bracket,
		  COUNT(*) AS count
		FROM `tabScore Snapshot` s
		JOIN `tabPulse Employee` e ON s.employee = e.name
		WHERE s.period_type = %s AND s.period_key = %s AND s.employee IN ({placeholders}) AND e.is_active = 1
		GROUP BY sort_key, bracket
		ORDER BY sort_key
		""",
		[period_type or "Day", date_str] + employees,
		as_dict=True,
	)
	return [{"bracket": r["bracket"], "count": r["count"]} for r in rows]


@frappe.whitelist()
def get_most_missed_items(start_date=None, end_date=None, limit=10, department=None, branch=None, employee=None):
	"""Most missed checklist items. Returns [{checklist_item, template_title, department, misses}]."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	start, end = _default_date_range(30)
	if start_date:
		start = getdate(start_date).strftime("%Y-%m-%d")
	if end_date:
		end = getdate(end_date).strftime("%Y-%m-%d")
	limit = min(int(limit or 10), 20)
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT ri.checklist_item, t.title AS template_title, t.department, COUNT(*) AS misses
		FROM `tabSOP Run Item` ri
		JOIN `tabSOP Run` r ON ri.parent = r.name
		JOIN `tabSOP Template` t ON r.template = t.name
		WHERE ri.status = 'Missed' AND r.employee IN ({placeholders})
		  AND r.period_date BETWEEN %s AND %s
		GROUP BY ri.checklist_item, t.title, t.department
		ORDER BY misses DESC
		LIMIT %s
		""",
		employees + [start, end, limit],
		as_dict=True,
	)
	return [{"checklist_item": r["checklist_item"], "template_title": r["template_title"] or "—", "department": r["department"] or "—", "misses": r["misses"]} for r in rows]


@frappe.whitelist()
def get_employees_by_department(department, date=None, period_type="Day"):
	"""Employees in a department with scores. Same shape as get_all_team_scores."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department)
	if not employees:
		return []
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	rows = frappe.get_all(
		"Pulse Employee",
		filters={"name": ["in", employees], "is_active": 1},
		fields=["name", "employee_name", "pulse_role", "branch", "avatar_url", "department", "reports_to"],
	)
	out = []
	for row in rows:
		snap = _calculate_score_snapshot(row.name, date_str, period_type or "Day")
		reports_to_name = frappe.db.get_value("Pulse Employee", row.reports_to, "employee_name") if row.reports_to else None
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
def get_employees_by_branch(branch, date=None, period_type="Day"):
	"""Employees in a branch with scores. Same shape as get_all_team_scores."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, branch=branch)
	if not employees:
		return []
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	rows = frappe.get_all(
		"Pulse Employee",
		filters={"name": ["in", employees], "is_active": 1},
		fields=["name", "employee_name", "pulse_role", "branch", "avatar_url", "department", "reports_to"],
	)
	out = []
	for row in rows:
		snap = _calculate_score_snapshot(row.name, date_str, period_type or "Day")
		reports_to_name = frappe.db.get_value("Pulse Employee", row.reports_to, "employee_name") if row.reports_to else None
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
def get_outcome_summary(
	start_date=None,
	end_date=None,
	department=None,
	branch=None,
	employee=None,
):
	"""Aggregate pass/fail outcomes by template for Insights charts."""
	scope, _ = _get_insight_employee_scope()
	employees = _apply_filters(scope, department=department, branch=branch, employee=employee)
	if not employees:
		return []
	start, end = _default_date_range(30)
	if start_date:
		start = getdate(start_date).strftime("%Y-%m-%d")
	if end_date:
		end = getdate(end_date).strftime("%Y-%m-%d")
	placeholders = ", ".join(["%s"] * len(employees))
	rows = frappe.db.sql(
		f"""
		SELECT t.name AS template_id,
		       t.title AS template_title,
		       SUM(CASE WHEN ri.outcome = 'Pass' THEN 1 ELSE 0 END) AS passed,
		       SUM(CASE WHEN ri.outcome = 'Fail' THEN 1 ELSE 0 END) AS failed,
		       COUNT(*) AS total_items
		FROM `tabSOP Run Item` ri
		JOIN `tabSOP Run` r ON ri.parent = r.name
		JOIN `tabSOP Template` t ON r.template = t.name
		WHERE r.employee IN ({placeholders})
		  AND r.period_date BETWEEN %s AND %s
		  AND ri.status = 'Completed'
		  AND ri.outcome_mode = 'PassFail'
		  AND IFNULL(ri.outcome, '') != ''
		  AND ri.outcome != 'NotApplicable'
		GROUP BY t.name, t.title
		ORDER BY total_items DESC
		""",
		employees + [start, end],
		as_dict=True,
	)
	out = []
	for r in rows or []:
		ti = int(r.get("total_items") or 0)
		p = int(r.get("passed") or 0)
		f = int(r.get("failed") or 0)
		denom = p + f
		out.append({
			"template_id": r.get("template_id"),
			"template_title": r.get("template_title") or "—",
			"total_items": ti,
			"passed": p,
			"failed": f,
			"pass_rate": round(p / denom, 4) if denom else 0.0,
		})
	return out
