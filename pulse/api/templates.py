# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _


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
def get_all_templates_with_inactive():
	"""List all SOP Templates including inactive ones (for admin)."""
	templates = frappe.get_all(
		"SOP Template",
		fields=["name", "title", "department", "frequency_type", "owner_role", "active_from", "active_to", "is_active"],
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
			"instructions": row.instructions,
			"item_key": getattr(row, 'item_key', None),
			"outcome_mode": getattr(row, 'outcome_mode', 'SimpleCompletion'),
			"proof_requirement": getattr(row, 'proof_requirement', 'None'),
			"proof_media_type": getattr(row, 'proof_media_type', 'Image'),
			"proof_capture_mode": getattr(row, 'proof_capture_mode', 'Any'),
			"prerequisite_item_key": getattr(row, 'prerequisite_item_key', None),
			"prerequisite_trigger": getattr(row, 'prerequisite_trigger', 'None'),
		})
	items.sort(key=lambda x: x.get("sequence", 0))
	return items


@frappe.whitelist()
def get_template_detail(template_name: str):
	"""Get full template details including all fields and items."""
	if not template_name:
		frappe.throw(_("Template name is required"))
	
	doc = frappe.get_doc("SOP Template", template_name)
	items = get_template_items(template_name)
	
	return {
		"name": doc.name,
		"title": doc.title,
		"department": doc.department,
		"frequency_type": doc.frequency_type,
		"owner_role": doc.owner_role,
		"active_from": str(doc.active_from) if doc.active_from else None,
		"active_to": str(doc.active_to) if doc.active_to else None,
		"is_active": doc.is_active,
		"schedule_kind": doc.schedule_kind,
		"schedule_time": str(doc.schedule_time) if doc.schedule_time else None,
		"schedule_days_of_week": doc.schedule_days_of_week,
		"interval_minutes": doc.interval_minutes,
		"open_run_policy": doc.open_run_policy,
		"grace_minutes": doc.grace_minutes,
		"checklist_items": items,
	}


@frappe.whitelist()
def get_template_schema():
	"""Return schema options for template form generation."""
	return {
		"frequency_types": ["Daily", "Weekly", "Monthly", "Custom"],
		"schedule_kinds": ["CalendarDay", "TimeOfDay", "Interval"],
		"item_types": ["Checkbox", "Numeric", "Photo"],
		"outcome_modes": ["SimpleCompletion", "PassFail", "Numeric", "PhotoProof"],
		"proof_requirements": ["None", "Optional", "Required"],
		"proof_media_types": ["Image", "File", "Any"],
		"proof_capture_modes": ["Any", "CameraOnly"],
		"prerequisite_triggers": ["None", "AnyOutcome", "OutcomeFail", "OutcomePass"],
		"open_run_policies": ["AllowMultiple", "RequirePreviousClosed"],
		"departments": frappe.get_all("Pulse Department", filters={"is_active": 1}, pluck="department_name"),
		"owner_roles": frappe.get_all("Pulse Role", fields=["role_name", "alias"]),
	}


@frappe.whitelist()
def create_template(values: dict):
	"""Create new SOP Template with checklist items."""
	current = frappe.session.user
	
	# Validate permission
	if not has_template_management_permission(current):
		frappe.throw(_("Not permitted to create templates"), frappe.PermissionError)
	
	# Prepare document data
	doc_dict = {
		"doctype": "SOP Template",
		"title": values.get("title"),
		"department": values.get("department"),
		"frequency_type": values.get("frequency_type", "Daily"),
		"owner_role": values.get("owner_role"),
		"active_from": values.get("active_from") or frappe.utils.today(),
		"active_to": values.get("active_to"),
		"is_active": values.get("is_active", 1),
		"schedule_kind": values.get("schedule_kind", "CalendarDay"),
		"schedule_time": values.get("schedule_time"),
		"schedule_days_of_week": values.get("schedule_days_of_week"),
		"interval_minutes": values.get("interval_minutes"),
		"open_run_policy": values.get("open_run_policy", "AllowMultiple"),
		"grace_minutes": values.get("grace_minutes", 30),
	}
	
	# Process checklist items
	items = values.get("checklist_items", [])
	doc_dict["checklist_items"] = []
	for idx, item in enumerate(items):
		doc_dict["checklist_items"].append({
			"description": item.get("description"),
			"sequence": item.get("sequence", idx),
			"weight": item.get("weight", 1.0),
			"item_type": item.get("item_type", "Checkbox"),
			"instructions": item.get("instructions"),
			"item_key": item.get("item_key") or f"item_{idx}",
			"outcome_mode": item.get("outcome_mode", "SimpleCompletion"),
			"proof_requirement": item.get("proof_requirement", "None"),
			"proof_media_type": item.get("proof_media_type"),
			"proof_capture_mode": item.get("proof_capture_mode"),
			"prerequisite_item_key": item.get("prerequisite_item_key"),
			"prerequisite_trigger": item.get("prerequisite_trigger", "None"),
		})
	
	try:
		doc = frappe.get_doc(doc_dict)
		doc.insert()
		return {"success": True, "name": doc.name, "message": _("Template created successfully")}
	except Exception as e:
		frappe.throw(_("Failed to create template: {0}").format(str(e)))


@frappe.whitelist()
def update_template(template_name: str, values: dict):
	"""Update existing template."""
	current = frappe.session.user
	
	if not has_template_management_permission(current):
		frappe.throw(_("Not permitted to update templates"), frappe.PermissionError)
	
	if not frappe.db.exists("SOP Template", template_name):
		frappe.throw(_("Template not found"))
	
	doc = frappe.get_doc("SOP Template", template_name)
	
	# Update basic fields
	fields_to_update = [
		"title", "department", "frequency_type", "owner_role",
		"active_from", "active_to", "is_active", "schedule_kind",
		"schedule_time", "schedule_days_of_week", "interval_minutes",
		"open_run_policy", "grace_minutes"
	]
	
	for field in fields_to_update:
		if field in values:
			setattr(doc, field, values[field])
	
	# Update checklist items if provided
	if "checklist_items" in values:
		# Clear existing items
		doc.checklist_items = []
		
		for idx, item in enumerate(values["checklist_items"]):
			doc.append("checklist_items", {
				"description": item.get("description"),
				"sequence": item.get("sequence", idx),
				"weight": item.get("weight", 1.0),
				"item_type": item.get("item_type", "Checkbox"),
				"instructions": item.get("instructions"),
				"item_key": item.get("item_key") or f"item_{idx}",
				"outcome_mode": item.get("outcome_mode", "SimpleCompletion"),
				"proof_requirement": item.get("proof_requirement", "None"),
				"proof_media_type": item.get("proof_media_type"),
				"proof_capture_mode": item.get("proof_capture_mode"),
				"prerequisite_item_key": item.get("prerequisite_item_key"),
				"prerequisite_trigger": item.get("prerequisite_trigger", "None"),
			})
	
	try:
		doc.save()
		return {"success": True, "name": doc.name, "message": _("Template updated successfully")}
	except Exception as e:
		frappe.throw(_("Failed to update template: {0}").format(str(e)))


@frappe.whitelist()
def delete_template(template_name: str):
	"""Soft delete (deactivate) template."""
	current = frappe.session.user
	
	if not has_template_management_permission(current):
		frappe.throw(_("Not permitted to delete templates"), frappe.PermissionError)
	
	if not frappe.db.exists("SOP Template", template_name):
		frappe.throw(_("Template not found"))
	
	try:
		frappe.db.set_value("SOP Template", template_name, "is_active", 0)
		return {"success": True, "message": _("Template deactivated successfully")}
	except Exception as e:
		frappe.throw(_("Failed to delete template: {0}").format(str(e)))


@frappe.whitelist()
def duplicate_template(template_name: str, new_title: str = None):
	"""Duplicate an existing template."""
	current = frappe.session.user
	
	if not has_template_management_permission(current):
		frappe.throw(_("Not permitted to duplicate templates"), frappe.PermissionError)
	
	if not frappe.db.exists("SOP Template", template_name):
		frappe.throw(_("Template not found"))
	
	source = frappe.get_doc("SOP Template", template_name)
	
	new_doc = frappe.copy_doc(source)
	new_doc.title = new_title or f"{source.title} (Copy)"
	new_doc.insert()
	
	return {"success": True, "name": new_doc.name, "message": _("Template duplicated successfully")}


def has_template_management_permission(user: str) -> bool:
	"""Check if user can manage templates."""
	# Pulse Admin, Executive, and Leader can manage templates
	# Manager can create but needs approval for org-wide templates
	roles = frappe.get_roles(user)
	allowed = {"System Manager", "Pulse Admin", "Pulse Executive", "Pulse Leader", "Pulse Manager"}
	return bool(allowed & set(roles))
