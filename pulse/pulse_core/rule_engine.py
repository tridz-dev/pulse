# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Follow-up rules, in-run prerequisites, and related side effects."""

import frappe
from frappe.utils import getdate


def _prerequisite_outcome_bucket(row) -> str | None:
	"""Coarse outcome for prerequisite evaluation (Fail / Pass / NA / None)."""
	st = row.status or "Pending"
	if st == "NotApplicable":
		return "NA"
	if st != "Completed":
		return None
	om = row.outcome_mode or "SimpleCompletion"
	if om == "PassFail":
		o = (row.outcome or "").strip()
		if o == "Fail":
			return "Fail"
		if o == "NotApplicable":
			return "NA"
		if o == "Pass":
			return "Pass"
		return None
	return "Pass"


def evaluate_in_run_prerequisites(run_name: str, resolved_item_name: str) -> None:
	"""After an item becomes Completed or NotApplicable, auto-skip dependents per prerequisite_trigger."""
	run = frappe.get_doc("SOP Run", run_name)
	resolved = next((r for r in (run.run_items or []) if r.name == resolved_item_name), None)
	if not resolved:
		return
	if resolved.status not in ("Completed", "NotApplicable"):
		return

	queue = [resolved_item_name]
	processed: set[str] = set()

	while queue:
		cur_name = queue.pop(0)
		if cur_name in processed:
			continue
		processed.add(cur_name)

		cur = next((r for r in (run.run_items or []) if r.name == cur_name), None)
		if not cur or cur.status not in ("Completed", "NotApplicable"):
			continue

		bucket = _prerequisite_outcome_bucket(cur)
		if bucket is None:
			continue

		key = (cur.item_key or "").strip()
		if not key:
			continue

		for row in run.run_items or []:
			pkey = (row.prerequisite_item_key or "").strip()
			if pkey != key:
				continue
			trig = row.prerequisite_trigger or "None"
			if trig in (None, "", "None"):
				continue
			if trig == "AnyOutcome":
				continue
			should_na = False
			if trig == "OutcomeFail":
				should_na = bucket != "Fail"
			elif trig == "OutcomePass":
				should_na = bucket != "Pass"
			if should_na and (row.status or "Pending") != "NotApplicable":
				row.status = "NotApplicable"
				row.completed_at = None
				row.outcome = None
				row.failure_remark = None
				queue.append(row.name)

	run.flags.ignore_validate_update_after_submit = True
	run.save()


def evaluate_follow_up_on_item_fail(run_name: str, run_item_name: str) -> None:
	"""If run item is Completed with outcome Fail, create target runs per active rules."""
	run = frappe.get_doc("SOP Run", run_name)
	row = next((r for r in (run.run_items or []) if r.name == run_item_name), None)
	if not row or row.status != "Completed" or row.outcome != "Fail":
		return

	item_key = row.item_key
	if not item_key:
		return

	rules = frappe.get_all(
		"SOP Follow-up Rule",
		filters={
			"source_template": run.template,
			"trigger_on": "ItemOutcomeFail",
			"source_item_key": item_key,
			"is_active": 1,
		},
		fields=["name", "target_template", "target_assignee"],
	)

	for rule in rules:
		trigger_event = "ItemOutcomeFail"
		if frappe.db.exists(
			"SOP Rule Execution Log",
			{
				"rule": rule.name,
				"source_run": run.name,
				"source_run_item": run_item_name,
				"trigger_event": trigger_event,
			},
		):
			continue

		target_employee = _resolve_target_employee(run.employee, rule.target_assignee)
		if not target_employee:
			_log_execution(rule.name, run.name, run_item_name, trigger_event, None, "Failed", "No target employee")
			continue

		try:
			from pulse.tasks import create_run_from_template

			new_run_name = create_run_from_template(
				rule.target_template,
				target_employee,
				period_date=getdate(run.period_date),
				period_datetime=None,
			)
			_log_execution(rule.name, run.name, run_item_name, trigger_event, new_run_name, "Triggered", None)
			if new_run_name:
				try:
					from pulse.api.notifications import create_notification

					tmpl_title = frappe.db.get_value("SOP Template", rule.target_template, "title") or rule.target_template
					create_notification(
						target_employee,
						f"New follow-up checklist: {tmpl_title}",
						f"A follow-up was created from run {run.name}.",
						notif_type="FollowUpCreated",
						severity="Warning",
						priority="Normal",
						source_doctype="SOP Run",
						source_name=new_run_name,
					)
				except Exception:
					frappe.log_error(frappe.get_traceback(), "Pulse Notification Follow-up")
		except Exception as e:
			frappe.log_error(frappe.get_traceback(), "SOP Follow-up Rule")
			_log_execution(rule.name, run.name, run_item_name, trigger_event, None, "Failed", str(e)[:200])


def _resolve_target_employee(source_employee: str, policy: str) -> str | None:
	if policy == "SameEmployee":
		return source_employee
	if policy == "EmployeesManager":
		return frappe.db.get_value("Pulse Employee", source_employee, "reports_to")
	return source_employee


def _log_execution(
	rule: str,
	source_run: str,
	source_run_item: str,
	trigger_event: str,
	target_run: str | None,
	status: str,
	error_message: str | None,
) -> None:
	frappe.get_doc(
		{
			"doctype": "SOP Rule Execution Log",
			"rule": rule,
			"source_run": source_run,
			"source_run_item": source_run_item,
			"trigger_event": trigger_event,
			"target_run": target_run,
			"status": status,
			"error_message": error_message,
		}
	).insert(ignore_permissions=True)


def run_item_row_dict_from_checklist_item(item) -> dict:
	"""Build child row dict for SOP Run from a template checklist row."""

	def _g(attr, default=None):
		if hasattr(item, "get"):
			return item.get(attr, default)
		return getattr(item, attr, default)

	proof_req = _g("proof_requirement") or "None"
	if proof_req == "None" and _g("evidence_required") == "Photo":
		proof_req = "Required"
		media = "Image"
	else:
		media = _g("proof_media_type") or "Image"

	return {
		"checklist_item": _g("description"),
		"item_key": _g("item_key") or "",
		"instructions": _g("instructions") or "",
		"weight": _g("weight") or 1.0,
		"item_type": _g("item_type") or "Checkbox",
		"outcome_mode": _g("outcome_mode") or "SimpleCompletion",
		"status": "Pending",
		"evidence_required": _g("evidence_required") or "None",
		"proof_requirement": proof_req,
		"proof_media_type": media,
		"proof_capture_mode": _g("proof_capture_mode") or "Any",
		"prerequisite_item_key": (_g("prerequisite_item_key") or "").strip(),
		"prerequisite_trigger": _g("prerequisite_trigger") or "None",
	}
