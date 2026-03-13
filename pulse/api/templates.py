# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe


@frappe.whitelist()
def get_all_templates():
	"""List all active SOP Templates with key fields."""
	templates = frappe.get_all(
		"SOP Template",
		filters={"is_active": 1},
		fields=["name", "title", "department", "frequency_type", "owner_role", "active_from", "active_to"],
		order_by="title",
	)
	return templates


@frappe.whitelist()
def get_template_items(template_name: str):
	"""Ordered checklist items for a template (from child table)."""
	if not template_name:
		return []
	doc = frappe.get_doc("SOP Template", template_name)
	items = []
	for row in doc.checklist_items or []:
		items.append({
			"name": row.name,
			"description": row.description,
			"sequence": row.sequence,
			"weight": row.weight,
			"item_type": row.item_type,
			"evidence_required": row.evidence_required,
		})
	items.sort(key=lambda x: x.get("sequence", 0))
	return items
