# Copyright (c) 2025, Pulse and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PulseBranch(Document):
	def validate(self):
		self.validate_branch_code()
		self.validate_operating_hours()
	
	def validate_branch_code(self):
		"""Ensure branch code is uppercase and unique."""
		if self.branch_code:
			self.branch_code = self.branch_code.upper().strip()
			# Check uniqueness (case insensitive)
			existing = frappe.db.exists(
				"Pulse Branch",
				{"branch_code": self.branch_code, "name": ("!=", self.name)}
			)
			if existing:
				frappe.throw(f"Branch Code '{self.branch_code}' already exists.")
	
	def validate_operating_hours(self):
		"""Ensure closing time is after opening time."""
		if self.opening_time and self.closing_time:
			if self.closing_time <= self.opening_time:
				frappe.throw("Closing time must be after opening time.")
	
	def on_update(self):
		"""Clear cache when branch is updated."""
		frappe.cache().delete_key("pulse_branch_options")
	
	def on_trash(self):
		"""Prevent deletion if branch has employees."""
		employee_count = frappe.db.count("Pulse Employee", {"branch": self.name})
		if employee_count > 0:
			frappe.throw(
				f"Cannot delete branch '{self.branch_name}' because it has {employee_count} employee(s). "
				"Please reassign employees first."
			)
