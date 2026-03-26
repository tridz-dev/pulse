# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Scheduler tasks: generate runs, lock overdue, cache scores."""

from datetime import datetime, timedelta

import frappe
from frappe.utils import get_datetime, getdate, now, now_datetime

from pulse.pulse_core.rule_engine import run_item_row_dict_from_checklist_item


def _schedule_kind(template_name: str) -> str:
	return frappe.db.get_value("SOP Template", template_name, "schedule_kind") or "CalendarDay"


def _parse_weekdays(s: str | None) -> set[int]:
	if not s or not str(s).strip():
		return set()
	out = set()
	for part in str(s).split(","):
		part = part.strip()
		if part == "":
			continue
		try:
			out.add(int(part))
		except ValueError:
			continue
	return out


def _time_to_datetime(base_date, time_val) -> datetime:
	"""Combine a date with a Frappe Time (timedelta or time-like)."""
	if isinstance(time_val, timedelta):
		total = int(time_val.total_seconds())
		h, rem = divmod(total, 3600)
		m, s = divmod(rem, 60)
	elif hasattr(time_val, "hour"):
		h, m, s = time_val.hour, time_val.minute, getattr(time_val, "second", 0)
	else:
		h, m, s = 0, 0, 0
	return datetime(base_date.year, base_date.month, base_date.day, h, m, s)


def run_exists(
	template_name: str,
	employee: str,
	period_date_str: str,
	period_datetime: datetime | None,
) -> bool:
	if period_datetime:
		return bool(
			frappe.db.exists(
				"SOP Run",
				{
					"template": template_name,
					"employee": employee,
					"period_datetime": period_datetime,
				},
			)
		)
	return bool(
		frappe.db.sql(
			"""
			SELECT name FROM `tabSOP Run`
			WHERE template=%s AND employee=%s AND period_date=%s
			  AND (period_datetime IS NULL OR period_datetime = '0000-00-00 00:00:00')
			LIMIT 1
			""",
			(template_name, employee, period_date_str),
		)
	)


def _existing_run_name(
	template_name: str,
	employee: str,
	period_str: str,
	period_datetime: datetime | None,
) -> str | None:
	if period_datetime:
		return frappe.db.get_value(
			"SOP Run",
			{
				"template": template_name,
				"employee": employee,
				"period_datetime": period_datetime,
			},
			"name",
		)
	row = frappe.db.sql(
		"""
		SELECT name FROM `tabSOP Run`
		WHERE template=%s AND employee=%s AND period_date=%s
		  AND (period_datetime IS NULL OR period_datetime = '0000-00-00 00:00:00')
		LIMIT 1
		""",
		(template_name, employee, period_str),
	)
	return row[0][0] if row else None


def create_run_from_template(
	template_name: str,
	employee: str,
	period_date,
	period_datetime: datetime | None = None,
) -> str | None:
	"""Create one SOP Run if not duplicate. Returns run name or None if skipped."""
	period_str = period_date.strftime("%Y-%m-%d") if hasattr(period_date, "strftime") else str(period_date)
	if run_exists(template_name, employee, period_str, period_datetime):
		return _existing_run_name(template_name, employee, period_str, period_datetime)

	template = frappe.get_doc("SOP Template", template_name)
	policy = template.open_run_policy or "AllowMultiple"
	if policy == "RequirePreviousClosed":
		if frappe.db.exists(
			"SOP Run",
			{"template": template_name, "employee": employee, "period_date": period_str, "status": "Open"},
		):
			return None

	run_dict = {
		"doctype": "SOP Run",
		"template": template_name,
		"employee": employee,
		"period_date": period_str,
		"status": "Open",
	}
	if period_datetime:
		run_dict["period_datetime"] = period_datetime

	run = frappe.get_doc(run_dict)
	for item in template.checklist_items or []:
		run.append("run_items", run_item_row_dict_from_checklist_item(item))
	run.insert()
	frappe.db.commit()
	return run.name


def _assignments_for_calendar_frequency(frequency_type: str, period_date):
	"""Assignments whose template uses CalendarDay schedule and matches frequency."""
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
			[
				"name",
				"frequency_type",
				"active_from",
				"active_to",
				"is_active",
				"schedule_kind",
			],
			as_dict=True,
		)
		if not template or template["frequency_type"] != frequency_type or not template.get("is_active"):
			continue
		sk = template.get("schedule_kind") or "CalendarDay"
		if sk != "CalendarDay":
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
	"""Create CalendarDay run (no period_datetime)."""
	create_run_from_template(template_name, assignment["employee"], period_date, period_datetime=None)


def generate_daily_runs():
	"""Create SOP Runs for today for CalendarDay + Daily assignments."""
	today = getdate()
	for assignment, _ in _assignments_for_calendar_frequency("Daily", today):
		_create_run_for_assignment(assignment, assignment["template"], today)


def generate_weekly_runs():
	today = getdate()
	if today.weekday() != 0:
		return
	for assignment, _ in _assignments_for_calendar_frequency("Weekly", today):
		_create_run_for_assignment(assignment, assignment["template"], today)


def generate_monthly_runs():
	today = getdate()
	if today.day != 1:
		return
	for assignment, _ in _assignments_for_calendar_frequency("Monthly", today):
		_create_run_for_assignment(assignment, assignment["template"], today)


def generate_time_of_day_runs():
	"""Every scheduler tick: create runs for templates with schedule_kind=TimeOfDay."""
	now_dt = now_datetime()
	if not now_dt:
		return
	today_d = getdate(now_dt)
	weekday = now_dt.weekday()

	assignments = frappe.get_all(
		"SOP Assignment",
		filters={"is_active": 1},
		fields=["name", "template", "employee"],
	)
	for a in assignments:
		tmpl = frappe.get_doc("SOP Template", a["template"])
		if not tmpl.is_active or (tmpl.schedule_kind or "CalendarDay") != "TimeOfDay":
			continue
		if not tmpl.schedule_time:
			continue
		days = _parse_weekdays(tmpl.schedule_days_of_week)
		if days and weekday not in days:
			continue
		active_from = getdate(tmpl.active_from) if tmpl.active_from else None
		active_to = getdate(tmpl.active_to) if tmpl.active_to else None
		if active_from and today_d < active_from:
			continue
		if active_to and today_d > active_to:
			continue

		slot_start = _time_to_datetime(today_d, tmpl.schedule_time)
		slot_end = slot_start + timedelta(minutes=15)
		if not (slot_start <= get_datetime(now_dt) < slot_end):
			continue

		create_run_from_template(tmpl.name, a["employee"], today_d, period_datetime=slot_start)


def generate_interval_runs():
	"""Create interval-based runs when elapsed >= interval_minutes."""
	now_dt = now_datetime()
	if not now_dt:
		return
	today_d = getdate(now_dt)

	assignments = frappe.get_all(
		"SOP Assignment",
		filters={"is_active": 1},
		fields=["name", "template", "employee"],
	)
	for a in assignments:
		tmpl = frappe.get_doc("SOP Template", a["template"])
		if not tmpl.is_active or (tmpl.schedule_kind or "CalendarDay") != "Interval":
			continue
		interval = tmpl.interval_minutes or 0
		if interval <= 0:
			continue
		active_from = getdate(tmpl.active_from) if tmpl.active_from else None
		active_to = getdate(tmpl.active_to) if tmpl.active_to else None
		if active_from and today_d < active_from:
			continue
		if active_to and today_d > active_to:
			continue

		policy = tmpl.open_run_policy or "AllowMultiple"
		if policy == "RequirePreviousClosed":
			if frappe.db.exists(
				"SOP Run",
				{"template": tmpl.name, "employee": a["employee"], "status": "Open"},
			):
				continue

		last = frappe.db.sql(
			"""
			SELECT period_datetime FROM `tabSOP Run`
			WHERE template=%s AND employee=%s AND period_datetime IS NOT NULL
			ORDER BY period_datetime DESC LIMIT 1
			""",
			(tmpl.name, a["employee"]),
		)
		if last and last[0][0]:
			last_dt = get_datetime(last[0][0])
			if get_datetime(now_dt) - last_dt < timedelta(minutes=interval):
				continue
		else:
			# No prior timed run: allow first creation once per tick when assignment exists
			pass

		create_run_from_template(tmpl.name, a["employee"], today_d, period_datetime=get_datetime(now_dt))


def every_quarter_hour():
	generate_time_of_day_runs()
	generate_interval_runs()


def lock_overdue_runs():
	"""Lock open runs past grace (timed) or past calendar day (legacy)."""
	today_str = getdate().strftime("%Y-%m-%d")
	now_dt = now_datetime()
	runs = frappe.get_all(
		"SOP Run",
		filters={"status": "Open"},
		fields=["name", "template", "period_date", "period_datetime"],
	)
	for r in runs:
		template = frappe.get_doc("SOP Template", r.template)
		grace = template.grace_minutes or 30
		overdue = False
		if r.period_datetime:
			pd = get_datetime(r.period_datetime)
			if now_dt > pd + timedelta(minutes=grace):
				overdue = True
		else:
			if str(r.period_date) < today_str:
				overdue = True
		if not overdue:
			continue
		run = frappe.get_doc("SOP Run", r.name)
		for row in run.run_items or []:
			if row.status == "Pending":
				row.status = "Missed"
		run.status = "Locked"
		run.flags.ignore_validate_update_after_submit = True
		run.save()
		try:
			from pulse.api.notifications import create_notification

			tmpl_title = frappe.db.get_value("SOP Template", run.template, "title") or run.template
			create_notification(
				run.employee,
				f"Checklist overdue and locked: {tmpl_title}",
				f"Run {run.name} was locked after the grace period.",
				notif_type="RunAlert",
				severity="Warning",
				priority="Normal",
				source_doctype="SOP Run",
				source_name=run.name,
			)
		except Exception:
			frappe.log_error(frappe.get_traceback(), "Pulse Lock Notification")
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
			"passed_items": snap.get("passed_items") or 0,
			"failed_items": snap.get("failed_items") or 0,
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
