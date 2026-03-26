# Copyright (c) 2026, Tridz and contributors
import frappe
from frappe.model.document import Document


class SOPRuleExecutionLog(Document):
	"""Idempotency record for follow-up rule execution."""

	def validate(self):
		dup = frappe.db.exists(
			"SOP Rule Execution Log",
			{
				"rule": self.rule,
				"source_run": self.source_run,
				"source_run_item": self.source_run_item,
				"trigger_event": self.trigger_event,
			},
		)
		if dup and dup != self.name:
			frappe.throw("Duplicate rule execution for this run item.")
