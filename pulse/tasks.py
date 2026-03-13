# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Scheduler tasks: generate runs, lock overdue, cache scores."""

import frappe
from frappe.utils import getdate, now


def _assignments_for_frequency(frequency_type: str, period_date):
	"""Return list of (assignment, template) for assignments whose template matches frequency and is active on period_date."""
	period_str = period_date.strftime("%Y-%m-%d") if hasattr(period_date, "strftime") else str(period_date)
	assignments = frappe.get_all(
		"SOP Assignment",
		filters={"is_active": 1},
		fields=["name", "template", "employee"],
	)
	out = []
	for a in assignments:
		template = frappe.db.get_value(
			"SOP Template",
			a["template"],
			["name", "frequency_type", "active_from", "active_to", "is_active"],
			as_dict=True,
		)
		if not template or template["frequency_type"] != frequency_type or not template.get("is_active"):
			continue
		active_from = getdate(template.get("active_from")) if template.get("active_from") else None
		active_to = getdate(template.get("active_to")) if template.get("active_to") else None
		if active_from and period_date < active_from:
			continue
		if active_to and period_date > active_to:
			continue
		out.append((a, template))
	return out


def _create_run_for_assignment(assignment, template_name: str, period_date):
	"""Create one SOP Run for the assignment on the given period date, with run_items from template."""
	period_str = period_date.strftime("%Y-%m-%d") if hasattr(period_date, "strftime") else str(period_date)
	existing = frappe.db.exists(
		"SOP Run",
		{"template": template_name, "employee": assignment["employee"], "period_date": period_str},
	)
	if existing:
		return
	template = frappe.get_doc("SOP Template", template_name)
	run = frappe.get_doc(
		{
			"doctype": "SOP Run",
			"template": template_name,
			"employee": assignment["employee"],
			"period_date": period_str,
			"status": "Open",
		}
	)
	for item in template.checklist_items or []:
		run.append(
			"run_items",
			{
				"checklist_item": item.description,
				"weight": item.weight,
				"item_type": item.item_type,
				"status": "Pending",
				"evidence_required": item.evidence_required or "None",
			},
		)
	run.insert()
	frappe.db.commit()


def generate_daily_runs():
	"""Create SOP Runs for today for all Daily assignments."""
	today = getdate()
	for assignment, _ in _assignments_for_frequency("Daily", today):
		_create_run_for_assignment(assignment, assignment["template"], today)


def generate_weekly_runs():
	"""Create SOP Runs for the current week (Monday) for all Weekly assignments."""
	today = getdate()
	# Run on Monday: create runs for this week's Monday
	if today.weekday() != 0:  # 0 = Monday
		return
	for assignment, _ in _assignments_for_frequency("Weekly", today):
		_create_run_for_assignment(assignment, assignment["template"], today)


def generate_monthly_runs():
	"""Create SOP Runs for the 1st of current month for all Monthly assignments."""
	today = getdate()
	if today.day != 1:
		return
	for assignment, _ in _assignments_for_frequency("Monthly", today):
		_create_run_for_assignment(assignment, assignment["template"], today)


def lock_overdue_runs():
	"""Mark all open runs with period_date < today: set Pending items to Missed, run status to Locked."""
	today_str = getdate().strftime("%Y-%m-%d")
	runs = frappe.get_all(
		"SOP Run",
		filters={"period_date": ["<", today_str], "status": "Open"},
		pluck="name",
	)
	for run_name in runs:
		run = frappe.get_doc("SOP Run", run_name)
		for row in run.run_items or []:
			if row.status == "Pending":
				row.status = "Missed"
		run.status = "Locked"
		run.flags.ignore_validate_update_after_submit = True
		run.save()
	frappe.db.commit()


def cache_score_snapshots():
	"""Compute Day score for today for all active employees and upsert Score Snapshot."""
	from pulse.api.scores import _calculate_score_snapshot

	today_str = getdate().strftime("%Y-%m-%d")
	employees = frappe.get_all(
		"Pulse Employee",
		filters={"is_active": 1},
		pluck="name",
	)
	for emp in employees:
		snap = _calculate_score_snapshot(emp, today_str, "Day")
		existing = frappe.db.get_value(
			"Score Snapshot",
			{"employee": emp, "period_type": "Day", "period_key": today_str},
			"name",
		)
		doc = {
			"doctype": "Score Snapshot",
			"employee": emp,
			"period_type": "Day",
			"period_key": today_str,
			"own_score": snap["own_score"],
			"team_score": snap["team_score"],
			"combined_score": snap["combined_score"],
			"total_items": snap["total_items"],
			"completed_items": snap["completed_items"],
			"computed_at": now(),
		}
		if existing:
			d = frappe.get_doc("Score Snapshot", existing)
			d.update(doc)
			d.save()
		else:
			frappe.get_doc(doc).insert()
	frappe.db.commit()


def daily():
	generate_daily_runs()
	lock_overdue_runs()


def weekly():
	generate_weekly_runs()


def monthly():
	generate_monthly_runs()


def hourly():
	cache_score_snapshots()
