# Copyright (c) 2026, Tridz and contributors
# License: MIT

from datetime import timedelta

import frappe
from frappe.utils import get_datetime, getdate, now_datetime
from frappe.utils.caching import redis_cache

from pulse.api.auth import get_current_employee


def _current_employee():
	try:
		return get_current_employee()
	except Exception:
		return None


@redis_cache(ttl=90)
def _pulse_home_summary_cached(emp_name: str, today_str: str) -> dict:
	"""Redis-cached counts; invalidated when runs change."""
	open_runs = frappe.db.count(
		"SOP Run",
		{"employee": emp_name, "status": "Open", "period_date": today_str},
	)
	now_dt = now_datetime()
	rows = frappe.get_all(
		"SOP Run",
		filters={"employee": emp_name, "status": "Open"},
		fields=["name", "period_date", "period_datetime", "template"],
	)
	overdue_runs = 0
	for r in rows:
		template = frappe.get_doc("SOP Template", r.template)
		grace = template.grace_minutes or 30
		if r.period_datetime:
			pd = get_datetime(r.period_datetime)
			if now_dt > pd + timedelta(minutes=grace):
				overdue_runs += 1
		elif str(r.period_date) < today_str:
			overdue_runs += 1

	subs = frappe.get_all(
		"Pulse Employee",
		filters={"reports_to": emp_name, "is_active": 1},
		pluck="name",
	)
	team_open = 0
	if subs:
		team_open = frappe.db.count(
			"SOP Run",
			{"status": "Open", "period_date": today_str, "employee": ["in", subs]},
		)

	return {
		"open_runs": open_runs,
		"overdue_runs": overdue_runs,
		"team_open": team_open,
	}


@frappe.whitelist()
def get_home_summary():
	"""Counts for Pulse Go home: own open runs today, overdue open runs, team open runs today."""
	emp = _current_employee()
	if not emp:
		return {"open_runs": 0, "overdue_runs": 0, "team_open": 0}
	emp_name = emp.get("name") if isinstance(emp, dict) else emp
	today_str = getdate().strftime("%Y-%m-%d")
	return _pulse_home_summary_cached(emp_name, today_str)
