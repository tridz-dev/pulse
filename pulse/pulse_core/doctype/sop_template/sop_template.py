# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SOPTemplate(Document):
	"""Master definition of a standard operating procedure checklist."""

	def validate(self):
		if self.frequency_type == "Custom":
			frappe.throw(
				"Custom frequency is not yet supported for run generation. "
				"Use Daily, Weekly, or Monthly."
			)
