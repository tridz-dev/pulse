# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now


class SOPRun(Document):
	"""A specific instance of a template execution for a given period."""

	def before_save(self):
		self._recompute_totals()
		if self.has_value_changed("status") and self.status == "Closed":
			self.closed_at = now()

	def _recompute_totals(self):
		total = len(self.run_items) if self.run_items else 0
		completed = (
			sum(1 for r in (self.run_items or []) if r.status == "Completed")
			if self.run_items
			else 0
		)
		self.total_items = total
		self.completed_items = completed
		self.progress = (completed / total * 100) if total else 0
