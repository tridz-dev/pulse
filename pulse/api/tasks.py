# Copyright (c) 2026, Tridz and contributors
# License: MIT

import json

import frappe
from frappe.utils import getdate, now
from frappe.utils.caching import redis_cache


def _current_employee():
	from pulse.api.auth import get_current_employee
	try:
		return get_current_employee()
	except Exception:
		return None


def _run_check_employee_access(run_name: str):
	emp = _current_employee()
	if not emp:
		frappe.throw("No employee record.")
	run = frappe.db.get_value("SOP Run", run_name, ["employee", "name"], as_dict=True)
	if not run:
		frappe.throw("Run not found.")
	emp_name = emp.get("name") if isinstance(emp, dict) else emp
	if run.employee == emp_name:
		return
	reports_to = frappe.db.get_value("Pulse Employee", run.employee, "reports_to")
	if reports_to != emp_name:
		frappe.throw("Not allowed to modify this run.")


def _sop_run_select_sql():
	"""Build SELECT compatible with DBs that have not migrated new columns yet."""
	cols = set(frappe.db.get_table_columns("SOP Run") or [])
	parts = [
		"name",
		"template",
		"employee",
		"period_date",
		"status",
		"total_items",
		"completed_items",
	]
	if "period_datetime" in cols:
		parts.append("period_datetime")
	else:
		parts.append("NULL AS period_datetime")
	for f in ("progress", "score", "passed_items", "failed_items"):
		parts.append(f if f in cols else f"0 AS {f}")
	order = (
		"period_datetime IS NULL, period_datetime ASC, name ASC"
		if "period_datetime" in cols
		else "name ASC"
	)
	return ", ".join(parts), order


@redis_cache(ttl=60)
def _fetch_runs_for_employee_raw(employee: str, date_str: str):
	sel, order = _sop_run_select_sql()
	runs = frappe.db.sql(
		f"""
		SELECT {sel}
		FROM `tabSOP Run`
		WHERE employee=%s AND period_date=%s
		ORDER BY {order}
		""",
		(employee, date_str),
		as_dict=True,
	)
	t_cols = set(frappe.db.get_table_columns("SOP Template") or [])
	t_fields = ["name", "title", "department", "frequency_type", "owner_role"]
	if "schedule_kind" in t_cols:
		t_fields.append("schedule_kind")
	out = []
	for r in runs:
		template = frappe.db.get_value("SOP Template", r["template"], t_fields, as_dict=True)
		prog = float(r.get("progress") or 0) if r.get("total_items") else 0.0
		out.append({**r, "template": template, "progress": prog, "score": float(r.get("score") or 0)})
	return out


@frappe.whitelist()
def get_runs_for_employee(employee: str, date: str | None = None):
	date_str = (getdate(date) if date else getdate()).strftime("%Y-%m-%d")
	return _fetch_runs_for_employee_raw(employee, date_str)


@frappe.whitelist()
def get_my_runs(date: str | None = None):
	emp = _current_employee()
	if not emp:
		return []
	emp_name = emp.get("name") if isinstance(emp, dict) else emp
	return get_runs_for_employee(emp_name, date)


def _safe_child_field(row, fieldname: str, default=None):
	try:
		return row.get(fieldname) if hasattr(row, "get") else getattr(row, fieldname, default)
	except Exception:
		return default


@frappe.whitelist()
def get_run_details(run_name: str):
	_run_check_employee_access(run_name)
	run = frappe.get_doc("SOP Run", run_name)
	template = frappe.get_doc("SOP Template", run.template)
	items = []
	for row in run.run_items or []:
		items.append({
			"name": row.name,
			"checklist_item": row.checklist_item,
			"item_key": _safe_child_field(row, "item_key", ""),
			"instructions": _safe_child_field(row, "instructions", ""),
			"weight": row.weight,
			"item_type": row.item_type,
			"outcome_mode": _safe_child_field(row, "outcome_mode", "SimpleCompletion"),
			"status": row.status,
			"outcome": _safe_child_field(row, "outcome", None),
			"failure_remark": _safe_child_field(row, "failure_remark", None),
			"completed_at": row.completed_at,
			"numeric_value": row.numeric_value,
			"notes": row.notes,
			"evidence": row.evidence,
			"evidence_required": row.evidence_required,
			"proof_requirement": _safe_child_field(row, "proof_requirement", "None"),
			"proof_media_type": _safe_child_field(row, "proof_media_type", "Image"),
			"proof_capture_mode": _safe_child_field(row, "proof_capture_mode", "Any"),
			"proof_captured_at": _safe_child_field(row, "proof_captured_at", None),
			"prerequisite_item_key": _safe_child_field(row, "prerequisite_item_key", ""),
			"prerequisite_trigger": _safe_child_field(row, "prerequisite_trigger", "None"),
			"template_item": {
				"description": row.checklist_item,
				"weight": row.weight,
				"item_type": row.item_type,
				"sequence": 0,
			},
		})
	run_dict = json.loads(run.as_json())
	run_dict["progress"] = float(run_dict.get("progress") or 0)
	run_dict["score"] = float(run_dict.get("score") or 0)
	template_dict = json.loads(template.as_json())
	return {
		"run": run_dict,
		"template": template_dict,
		"items": items,
	}


def _validate_run_item_completion(row) -> None:
	if row.status != "Completed":
		return
	om = row.outcome_mode or "SimpleCompletion"
	if om == "PassFail":
		if not (row.outcome or "").strip():
			frappe.throw(f"Outcome is required for item: {row.checklist_item}")
		if row.outcome == "Fail" and not (row.failure_remark or "").strip():
			frappe.throw("Failure remark is required when outcome is Fail.")
	if (row.proof_requirement or "None") == "Required" and not (row.evidence or "").strip():
		frappe.throw(f"Proof is required before completing: {row.checklist_item}")


@frappe.whitelist()
def update_run_item(
	run_item_name: str,
	status: str | None = None,
	notes: str | None = None,
	numeric_value: str | None = None,
	outcome: str | None = None,
	failure_remark: str | None = None,
	file_url: str | None = None,
):
	item = frappe.get_doc("SOP Run Item", run_item_name)
	run_name = item.parent
	_run_check_employee_access(run_name)
	run = frappe.get_doc("SOP Run", run_name)
	if run.status != "Open":
		frappe.throw("Run is not open for updates.")

	target = None
	for row in run.run_items or []:
		if row.name == run_item_name:
			target = row
			break
	if not target:
		frappe.throw("Run item not found on this run.")

	if status is not None:
		target.status = status
	if notes is not None:
		target.notes = notes
	if numeric_value is not None:
		try:
			target.numeric_value = float(numeric_value)
		except (TypeError, ValueError):
			pass
	if outcome is not None and (target.outcome_mode or "") == "PassFail":
		out = (outcome or "").strip()
		target.outcome = out if out else None
		if out in ("Pass", "NotApplicable"):
			target.failure_remark = None
	if failure_remark is not None and (target.outcome or "").strip() == "Fail":
		target.failure_remark = failure_remark
	if file_url is not None and str(file_url).strip():
		target.evidence = str(file_url).strip()

	if status == "Completed":
		target.completed_at = now()
	elif status == "Pending":
		target.completed_at = None
		target.outcome = None
		target.failure_remark = None

	if target.status == "Completed":
		_validate_run_item_completion(target)

	run.save()
	return {"ok": True}


@frappe.whitelist()
def upload_run_item_evidence(run_item_name: str):
	"""Accept multipart file upload; attach to SOP Run Item; set proof_captured_at."""
	item = frappe.get_doc("SOP Run Item", run_item_name)
	run_name = item.parent
	_run_check_employee_access(run_name)
	run = frappe.get_doc("SOP Run", run_name)
	if run.status != "Open":
		frappe.throw("Run is not open.")

	upload = frappe.request.files.get("file") if getattr(frappe.local, "request", None) else None
	if not upload:
		frappe.throw("No file uploaded.")

	filename = upload.filename or "upload"
	content = upload.stream.read()
	mime = getattr(upload, "mimetype", None) or getattr(upload, "content_type", None) or ""

	for row in run.run_items or []:
		if row.name == run_item_name:
			media = row.proof_media_type or "Image"
			if media == "Image" and mime and not mime.startswith("image/"):
				frappe.throw("Proof media type requires an image file.")
			break
	else:
		frappe.throw("Run item not found.")

	from frappe.utils.file_manager import save_file

	saved = save_file(filename, content, "SOP Run Item", run_item_name, decode=False, is_private=1)
	file_url = saved.file_url

	for row in run.run_items or []:
		if row.name == run_item_name:
			row.evidence = file_url
			row.proof_captured_at = now()
			break
	run.save()
	return {"ok": True, "file_url": file_url}


@frappe.whitelist()
def complete_run(run_name: str):
	_run_check_employee_access(run_name)
	run = frappe.get_doc("SOP Run", run_name)
	if run.status != "Open":
		frappe.throw("Run is not open.")
	for row in run.run_items or []:
		if row.status == "Pending":
			frappe.throw("Complete all checklist items before closing the run.")
		if row.status == "NotApplicable":
			continue
		if row.status == "Completed":
			_validate_run_item_completion(row)
	run.status = "Closed"
	run.flags.ignore_validate_update_after_submit = True
	run.save()
	return {"ok": True}
