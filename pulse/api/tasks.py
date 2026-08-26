# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.utils import getdate, now


@frappe.whitelist()
def get_runs_for_employee(employee: str, date: str | None = None):
	"""Get all SOP Runs for a given employee on the given date (for profile/drill-down)."""
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	runs = frappe.get_all(
		"SOP Run",
		filters={"employee": employee, "period_date": date_str},
		fields=["name", "template", "employee", "period_date", "status", "total_items", "completed_items", "progress"],
	)
	out = []
	for r in runs:
		template = frappe.db.get_value(
			"SOP Template",
			r["template"],
			["name", "title", "department", "frequency_type", "owner_role"],
			as_dict=True,
		)
		progress = (r.get("progress") or 0) if r.get("total_items") else 0
		out.append({**r, "template": template, "progress": progress})
	return out


@frappe.whitelist()
def get_my_runs(date: str | None = None):
	"""Get all SOP Runs for the current user's employee on the given date. Returns run + template + progress."""
	emp = _current_employee()
	if not emp:
		return []
	emp_name = emp.get("name") if isinstance(emp, dict) else emp
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")

	# List open and overdue runs (Open/In Progress) for the current user, or runs for the given date.
	runs = frappe.get_all(
		"SOP Run",
		filters={"employee": emp_name},
		or_filters=[
			{"status": ["in", ["Open", "In Progress"]]},
			{"period_date": date_str}
		],
		fields=["name", "template", "employee", "period_date", "status", "total_items", "completed_items", "progress", "due_at", "compliance_result"],
	)
	out = []
	for r in runs:
		template = frappe.db.get_value(
			"SOP Template",
			r["template"],
			["name", "title", "department", "frequency_type", "owner_role"],
			as_dict=True,
		)
		progress = (r.get("progress") or 0) if r.get("total_items") else 0
		out.append({**r, "template": template, "progress": progress})
	return out


@frappe.whitelist()
def get_run_details(run_name: str):
	"""Full run with all items for the checklist runner sheet."""
	_run_check_employee_access(run_name)
	run = frappe.get_doc("SOP Run", run_name)
	template = frappe.get_doc("SOP Template", run.template)
	items = []
	for row in run.run_items or []:
		items.append({
			"name": row.name,
			"checklist_item": row.checklist_item,
			"weight": row.weight,
			"item_type": row.item_type,
			"status": row.status,
			"completed_at": row.completed_at,
			"numeric_value": row.numeric_value,
			"notes": row.notes,
			"evidence": row.evidence,
			"evidence_required": row.evidence_required,
			"template_item": {
				"description": row.checklist_item,
				"weight": row.weight,
				"item_type": row.item_type,
				"sequence": 0,
			},
		})
	return {
		"run": run.as_dict(),
		"template": template.as_dict(),
		"items": items,
	}


@frappe.whitelist()
def update_run_item(run_item_name: str, status: str, notes: str | None = None, numeric_value: str | None = None):
	"""Toggle item Pending/Completed. Validates ownership of parent run."""
	item = frappe.get_doc("SOP Run Item", run_item_name)
	run_name = item.get("parent")
	_run_check_employee_access(run_name)
	run = frappe.get_doc("SOP Run", run_name)
	if run.status not in ["Open", "In Progress"]:
		frappe.throw("Run is not open for updates.")
	if run.status == "Open":
		run.status = "In Progress"
	for row in run.run_items or []:
		if row.name == run_item_name:
			row.status = status
			if notes is not None:
				row.notes = notes
			if numeric_value is not None:
				try:
					row.numeric_value = float(numeric_value)
				except (TypeError, ValueError):
					pass
			if status == "Completed":
				row.completed_at = now()
			break
	run.save()
	return {"ok": True}


@frappe.whitelist()
def complete_run(run_name: str):
	"""Mark run as Completed. Concurrency-safe against finalizer.

	Concurrency mechanism:
	We perform a row-lock read on the SOP Run using for_update=True.
	Whichever transaction's UPDATE commits first (either the scheduled finalizer
	or this user-initiated completion), the other transaction's row-lock read
	will block until the first commits. Once the block is released, the second
	transaction reads the updated state under the lock and must respect it,
	preventing concurrent finalization races from resulting in inconsistent states.
	"""
	_run_check_employee_access(run_name)
	
	# Row-lock-read to prevent concurrent update races
	run_data = frappe.db.get_value(
		"SOP Run",
		run_name,
		["status", "compliance_result", "due_at"],
		as_dict=True,
		for_update=True
	)
	
	if not run_data:
		frappe.throw("Run not found.")
		
	if run_data.compliance_result == "Failed":
		frappe.throw("Cannot complete run: compliance result is already Failed.")
		
	if run_data.status == "Locked":
		frappe.throw("Cannot complete run: run is Locked.")
		
	if run_data.status == "Completed":
		frappe.throw("Run is already Completed.")
		
	if run_data.status not in ["Open", "In Progress"]:
		frappe.throw("Run is not in a state that can be completed.")

	run = frappe.get_doc("SOP Run", run_name)

	current_time = now()
	run.completed_at = current_time
	run.status = "Completed"

	# Pass / Fail check: completion exactly at deadline (completed_at == due_at) is Passed.
	#
	# ``due_at`` is stored as naive UTC (see _generate_runs_for_frequency /
	# finalize_overdue_runs in pulse/tasks.py). ``now()``/``current_time`` is
	# naive site-local time, so it must be converted to naive UTC before
	# comparing against due_at — comparing them directly would shift the
	# Pass/Fail boundary by the site's UTC offset.
	from frappe.utils import get_datetime, get_system_timezone
	from zoneinfo import ZoneInfo
	comp_dt = (
		get_datetime(current_time)
		.replace(tzinfo=ZoneInfo(get_system_timezone()))
		.astimezone(ZoneInfo("UTC"))
		.replace(tzinfo=None)
	)
	due_dt = get_datetime(run_data.due_at) if run_data.due_at else None

	if due_dt and comp_dt <= due_dt:
		run.compliance_result = "Passed"
	else:
		run.compliance_result = "Failed"
		
	run.flags.ignore_validate_update_after_submit = True
	run.save()
	
	return {
		"status": run.status,
		"compliance_result": run.compliance_result,
		"completed_at": run.completed_at,
		"due_at": run.due_at,
	}


def _current_employee():
	"""Get current user's PM Employee doc as dict (name, employee_name, ...)."""
	from pulse.api.auth import get_current_employee
	try:
		return get_current_employee()
	except Exception:
		return None


def _run_check_employee_access(run_name: str):
	"""Ensure current user's employee owns this run or is manager of owner."""
	emp = _current_employee()
	if not emp:
		frappe.throw("No employee record.")
	run = frappe.db.get_value("SOP Run", run_name, ["employee", "name"], as_dict=True)
	if not run:
		frappe.throw("Run not found.")
	if run.employee == emp.get("name") if isinstance(emp, dict) else emp:
		return
	# Allow if current user's employee is the report's manager
	reports_to = frappe.db.get_value("Pulse Employee", run.employee, "reports_to")
	emp_name = emp.get("name") if isinstance(emp, dict) else emp
	if reports_to != emp_name:
		frappe.throw("Not allowed to modify this run.")
