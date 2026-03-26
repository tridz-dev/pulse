# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

import uuid

from frappe.model.document import Document


class SOPTemplate(Document):
	"""Master definition of a standard operating procedure checklist."""

	def validate(self):
		for row in self.checklist_items or []:
			if not getattr(row, "item_key", None):
				row.item_key = uuid.uuid4().hex[:16]
			if (not getattr(row, "proof_requirement", None)) or row.proof_requirement in (None, "None"):
				if getattr(row, "evidence_required", None) == "Photo":
					row.proof_requirement = "Required"
					if not getattr(row, "proof_media_type", None):
						row.proof_media_type = "Image"
