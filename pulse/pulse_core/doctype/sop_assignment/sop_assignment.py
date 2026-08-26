# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SOPAssignment(Document):
	"""Maps which employee is responsible for which SOP Template."""

	def validate(self):
		self._validate_unique_active_assignment()

	def _validate_unique_active_assignment(self):
		"""Block a duplicate active assignment with the SAME effective overrides.

		A second active assignment for the same template+employee is allowed
		when it has a deliberately different schedule override, per
		pulse.api.assignments.create_assignment's design - this must match
		that policy, not a blanket template+employee uniqueness rule.
		"""
		if not self.is_active:
			return

		def _norm(value):
			if value is None:
				return None
			if isinstance(value, str) and value.strip() == "":
				return None
			return value

		candidates = frappe.get_all(
			"SOP Assignment",
			filters={
				"template": self.template,
				"employee": self.employee,
				"is_active": 1,
				"name": ["!=", self.name],
			},
			fields=[
				"name",
				"schedule_timezone_override",
				"local_start_time_override",
				"completion_window_minutes_override",
			],
		)
		self_overrides = (
			_norm(self.schedule_timezone_override),
			_norm(self.local_start_time_override),
			_norm(self.completion_window_minutes_override),
		)
		for row in candidates:
			row_overrides = (
				_norm(row.schedule_timezone_override),
				_norm(row.local_start_time_override),
				_norm(row.completion_window_minutes_override),
			)
			if row_overrides == self_overrides:
				frappe.throw(
					frappe._("Active assignment already exists for this employee, template, and schedule.")
				)
