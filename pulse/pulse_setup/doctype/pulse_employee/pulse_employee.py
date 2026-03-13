# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PulseEmployee(Document):
	"""Links a Frappe User to org structure (hierarchy)."""

	def validate(self):
		self._validate_no_circular_reports_to()

	def _validate_no_circular_reports_to(self):
		if not self.reports_to:
			return
		seen = {self.name}
		current = self.reports_to
		while current:
			if current in seen:
				frappe.throw(
					frappe._("Circular reference in Reports To: {0}").format(current)
				)
			seen.add(current)
			current = frappe.db.get_value("Pulse Employee", current, "reports_to")
