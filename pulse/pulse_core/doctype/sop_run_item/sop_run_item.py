# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SOPRunItem(Document):
	"""Child table: single checklist item within an SOP Run."""

	def on_update(self):
		"""Prerequisite propagation, manager alert on fail, follow-up rules."""
		if not self.parent:
			return

		prev = self.get_doc_before_save()
		prev_status = getattr(prev, "status", None) if prev else None
		if prev_status != self.status and self.status in ("Completed", "NotApplicable"):
			from pulse.pulse_core.rule_engine import evaluate_in_run_prerequisites

			evaluate_in_run_prerequisites(self.parent, self.name)

		self._notify_manager_on_item_fail()

		if self.status != "Completed" or (self.outcome or "").strip() != "Fail":
			return
		if prev is not None and prev.status == "Completed" and (prev.outcome or "").strip() == "Fail":
			return

		from pulse.pulse_core.rule_engine import evaluate_follow_up_on_item_fail

		evaluate_follow_up_on_item_fail(self.parent, self.name)

	def _notify_manager_on_item_fail(self) -> None:
		if self.status != "Completed":
			return
		if (self.outcome_mode or "") != "PassFail":
			return
		if (self.outcome or "").strip() != "Fail":
			return
		prev = self.get_doc_before_save()
		if prev is not None and prev.status == "Completed" and (prev.outcome or "").strip() == "Fail":
			return
		if not self.parent:
			return
		try:
			from pulse.api.notifications import create_notification

			run = frappe.get_doc("SOP Run", self.parent)
			mgr = frappe.db.get_value("Pulse Employee", run.employee, "reports_to")
			if not mgr:
				return
			tmpl_title = frappe.db.get_value("SOP Template", run.template, "title") or run.template
			create_notification(
				mgr,
				f"Item failed: {self.checklist_item}",
				f"In {tmpl_title}.",
				notif_type="ItemFail",
				severity="Critical",
				priority="High",
				source_doctype="SOP Run",
				source_name=run.name,
			)
		except Exception:
			frappe.log_error(frappe.get_traceback(), "Pulse Item Fail Notification")
