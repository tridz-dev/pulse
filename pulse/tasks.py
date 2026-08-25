# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Scheduler tasks: generate runs, lock overdue, cache scores."""

import datetime
import json
from zoneinfo import ZoneInfo

import frappe
from frappe.utils import get_system_timezone, getdate, now, now_datetime

from pulse.domain.scheduling import make_run_key, resolve_schedule


def _active_assignments_for_frequency(frequency_type: str):
	"""Return active assignments whose template matches ``frequency_type`` and is active."""
	assignments = frappe.get_all(
		"SOP Assignment",
		filters={"is_active": 1},
		fields=[
			"name",
			"template",
			"employee",
			"schedule_timezone_override",
			"local_start_time_override",
			"completion_window_minutes_override",
		],
	)
	out = []
	for a in assignments:
		template = frappe.db.get_value(
			"SOP Template",
			a.template,
			[
				"name",
				"title",
				"department",
				"frequency_type",
				"active_from",
				"active_to",
				"is_active",
				"schedule_timezone",
				"local_start_time",
				"completion_window_minutes",
				"modified",
			],
			as_dict=True,
		)
		if not template or template.frequency_type != frequency_type or not template.get("is_active"):
			continue
		out.append((a, template))
	return out


def _build_manager_path(employee_name: str) -> str:
	"""Walk Pulse Employee.reports_to upward and return JSON [{id, label}, ...].

	Guards against cycles so malformed reporting lines cannot loop forever.
	Mirrors the approach used by the snapshot backfill patch.
	"""
	path = []
	current = employee_name
	visited = set()

	while current:
		if current in visited:
			break
		visited.add(current)

		manager = frappe.db.get_value(
			"Pulse Employee",
			current,
			["reports_to", "employee_name"],
			as_dict=True,
		)
		if not manager or not manager.reports_to:
			break

		current = manager.reports_to
		label = frappe.db.get_value("Pulse Employee", current, "employee_name") or current
		path.append({"id": current, "label": label})

	return json.dumps(path, default=str)


def _create_run_for_assignment_window(assignment, template, schedule) -> int:
	"""Create one SOP Run for the resolved window, or skip if the run_key exists.

	Returns 1 when a run is created, 0 otherwise.
	"""
	window_date = schedule["window_date"]
	active_from = getdate(template.active_from) if template.active_from else None
	active_to = getdate(template.active_to) if template.active_to else None
	if active_from and window_date < active_from:
		return 0
	if active_to and window_date > active_to:
		return 0

	run_key = make_run_key(assignment.name, schedule["schedule_key"])
	if frappe.db.exists("SOP Run", {"run_key": run_key}):
		return 0

	template_doc = frappe.get_doc("SOP Template", template.name)

	employee = frappe.db.get_value(
		"Pulse Employee",
		assignment.employee,
		["employee_name", "branch", "department", "reports_to"],
		as_dict=True,
	)
	if not employee:
		return 0

	department_name = None
	if employee.department:
		department_name = (
			frappe.db.get_value("Pulse Department", employee.department, "department_name")
			or employee.department
		)

	run_items = []
	for item in template_doc.checklist_items or []:
		run_items.append(
			{
				"checklist_item": item.description,
				"weight": item.weight,
				"item_type": item.item_type,
				"status": "Pending",
				"evidence_required": item.evidence_required or "None",
			}
		)

	run = frappe.get_doc(
		{
			"doctype": "SOP Run",
			"template": assignment.template,
			"employee": assignment.employee,
			"period_date": window_date,
			"status": "Open",
			"compliance_result": "Pending",
			"assignment": assignment.name,
			"schedule_key": schedule["schedule_key"],
			"run_key": run_key,
			"opens_at": schedule["opens_at"],
			"due_at": schedule["due_at"],
			"effective_timezone": schedule["effective_timezone"],
			"template_title_snapshot": template.title,
			"template_modified_snapshot": template.modified,
			"employee_name_snapshot": employee.employee_name,
			"manager_path_snapshot": _build_manager_path(assignment.employee),
			"department_snapshot": department_name,
			"branch_snapshot": employee.branch,
			"frequency_snapshot": template.frequency_type,
			"completion_window_minutes_snapshot": schedule["completion_window_minutes"],
			"snapshot_is_complete": 1,
			"run_items": run_items,
			"total_items": len(run_items),
			"completed_items": 0,
			"progress": 0,
		}
	)
	run.insert(ignore_permissions=True)
	frappe.db.commit()
	return 1


def _generate_runs_for_frequency(frequency_type: str, evaluation_instant=None) -> int:
	"""Generate runs for all active assignments of the given frequency.

	Only creates the currently-actionable window and skips duplicates by
	``run_key``. Future windows are never pre-generated.
	"""
	if evaluation_instant is None:
		evaluation_instant = now_datetime()

	site_tz = get_system_timezone()
	# ``now_datetime()`` returns a naive datetime in the system time zone.
	# Convert it to a proper UTC-aware instant before resolving schedules.
	if isinstance(evaluation_instant, datetime.datetime) and evaluation_instant.tzinfo is None:
		evaluation_instant = (
			evaluation_instant.replace(tzinfo=ZoneInfo(site_tz))
			.astimezone(ZoneInfo("UTC"))
		)

	created = 0
	for assignment, template in _active_assignments_for_frequency(frequency_type):
		try:
			schedule = resolve_schedule(template, assignment, evaluation_instant, site_tz)
		except ValueError as e:
			frappe.logger("scheduler").warning(f"Skipping assignment {assignment.name}: {e}")
			continue
		if not schedule:
			continue
		created += _create_run_for_assignment_window(assignment, template, schedule)
	return created


def generate_daily_runs():
	"""Create SOP Runs for today's actionable window for all Daily assignments."""
	_generate_runs_for_frequency("Daily")


def generate_weekly_runs():
	"""Create SOP Runs for the current week's actionable window on Mondays only."""
	today = getdate()
	if today.weekday() != 0:  # 0 = Monday
		return
	_generate_runs_for_frequency("Weekly")


def generate_monthly_runs():
	"""Create SOP Runs for the current month's actionable window on the 1st only."""
	today = getdate()
	if today.day != 1:
		return
	_generate_runs_for_frequency("Monthly")


def finalize_overdue_runs(evaluation_instant=None):
	"""Materialize overdue Pending runs as Failed+Locked idempotently.

	Runs whose ``due_at`` has passed and whose ``compliance_result`` is still
	``Pending`` are finalized: ``compliance_result`` becomes ``Failed``,
	``status`` becomes ``Locked``, and any still-``Pending`` run item rows are
	marked ``Missed`` for bookkeeping. Already ``Passed`` or ``Failed`` runs are
	never touched, so retries are safe.
	"""
	if evaluation_instant is None:
		evaluation_instant = now_datetime()

	runs = frappe.get_all(
		"SOP Run",
		filters={"compliance_result": "Pending", "due_at": ["<=", evaluation_instant]},
		pluck="name",
	)
	for run_name in runs:
		run = frappe.get_doc("SOP Run", run_name)
		for row in run.run_items or []:
			if row.status == "Pending":
				row.status = "Missed"
		run.status = "Locked"
		run.compliance_result = "Failed"
		run.flags.ignore_validate_update_after_submit = True
		run.save()
	frappe.db.commit()


def lock_overdue_runs():
	"""Backward-compatible name for the due_at-based deadline finalizer."""
	finalize_overdue_runs()


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
	finalize_overdue_runs()


def weekly():
	generate_weekly_runs()


def monthly():
	generate_monthly_runs()


def hourly():
	cache_score_snapshots()
