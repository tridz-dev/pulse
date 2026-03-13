# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SOPAssignment(Document):
	"""Maps which employee is responsible for which SOP Template."""

	def validate(self):
		self._validate_unique_active_assignment()

	def _validate_unique_active_assignment(self):
		if not self.is_active:
			return
		existing = frappe.db.exists(
			"SOP Assignment",
			{
				"template": self.template,
				"employee": self.employee,
				"is_active": 1,
				"name": ["!=", self.name],
			},
		)
		if existing:
			frappe.throw(
				frappe._("Active assignment already exists for this employee and template.")
			)
