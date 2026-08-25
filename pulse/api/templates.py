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


def check_write_permission():
	"""Only Pulse Admin or Pulse Leader can perform writes/updates on templates."""
	user = frappe.session.user
	if user == "Administrator":
		return
	roles = frappe.get_roles(user)
	if "Pulse Admin" in roles or "Pulse Leader" in roles:
		return
	frappe.throw(
		frappe._("Not permitted. Only Pulse Admin or Pulse Leader can perform this action."),
		frappe.PermissionError
	)


@frappe.whitelist()
def create_template(
	title,
	frequency_type,
	active_from,
	local_start_time,
	completion_window_minutes,
	schedule_timezone,
	department=None,
	owner_role=None,
	active_to=None,
	checklist_items=None,
):
	check_write_permission()

	# Validate completion_window_minutes
	try:
		comp_val = int(completion_window_minutes)
		if comp_val <= 0:
			raise ValueError
	except (TypeError, ValueError):
		frappe.throw(frappe._("Completion window minutes must be a positive integer."))

	# Validate schedule_timezone
	from zoneinfo import ZoneInfo
	if schedule_timezone:
		try:
			ZoneInfo(schedule_timezone)
		except Exception:
			frappe.throw(frappe._("Invalid IANA timezone: {0}").format(schedule_timezone))
	else:
		frappe.throw(frappe._("Schedule Timezone is required."))

	# Validate frequency_type
	meta = frappe.get_meta("SOP Template")
	frequency_options = [opt.strip() for opt in meta.get_field("frequency_type").options.split("\n") if opt.strip()]
	if frequency_type not in frequency_options:
		frappe.throw(frappe._("Invalid frequency type. Must be one of: {0}").format(", ".join(frequency_options)))

	# Parse and validate checklist_items
	import json
	if isinstance(checklist_items, str):
		try:
			checklist_items = json.loads(checklist_items)
		except Exception:
			frappe.throw(frappe._("Invalid checklist items format."))

	if not checklist_items:
		frappe.throw(frappe._("At least one checklist item is required."))

	doc = frappe.get_doc({
		"doctype": "SOP Template",
		"title": title,
		"frequency_type": frequency_type,
		"active_from": active_from,
		"local_start_time": local_start_time,
		"completion_window_minutes": comp_val,
		"schedule_timezone": schedule_timezone,
		"department": department,
		"owner_role": owner_role,
		"active_to": active_to,
		"is_active": 1,
		"checklist_items": checklist_items,
	})
	doc.insert(ignore_permissions=True)
	return doc


@frappe.whitelist()
def update_template(name, **fields):
	check_write_permission()

	if not frappe.db.exists("SOP Template", name):
		frappe.throw(frappe._("SOP Template '{0}' does not exist.").format(name), frappe.DoesNotExistError)

	doc = frappe.get_doc("SOP Template", name)

	# Validate completion_window_minutes if updated
	if "completion_window_minutes" in fields:
		val = fields["completion_window_minutes"]
		try:
			val = int(val)
			if val <= 0:
				raise ValueError
		except (TypeError, ValueError):
			frappe.throw(frappe._("Completion window minutes must be a positive integer."))
		fields["completion_window_minutes"] = val

	# Validate schedule_timezone if updated
	if "schedule_timezone" in fields:
		stz = fields["schedule_timezone"]
		if stz:
			from zoneinfo import ZoneInfo
			try:
				ZoneInfo(stz)
			except Exception:
				frappe.throw(frappe._("Invalid IANA timezone: {0}").format(stz))
		else:
			frappe.throw(frappe._("Schedule Timezone is required."))

	# Validate frequency_type if updated
	if "frequency_type" in fields:
		ft = fields["frequency_type"]
		meta = frappe.get_meta("SOP Template")
		frequency_options = [opt.strip() for opt in meta.get_field("frequency_type").options.split("\n") if opt.strip()]
		if ft not in frequency_options:
			frappe.throw(frappe._("Invalid frequency type. Must be one of: {0}").format(", ".join(frequency_options)))

	# Handle checklist_items if updated
	if "checklist_items" in fields:
		checklist_items = fields["checklist_items"]
		import json
		if isinstance(checklist_items, str):
			try:
				checklist_items = json.loads(checklist_items)
			except Exception:
				frappe.throw(frappe._("Invalid checklist items format."))

		if not checklist_items:
			frappe.throw(frappe._("At least one checklist item is required."))

		doc.set("checklist_items", [])
		for item in checklist_items:
			doc.append("checklist_items", item)

	# Update all other editable fields on SOP Template
	editable_fields = [
		"title",
		"frequency_type",
		"active_from",
		"local_start_time",
		"completion_window_minutes",
		"schedule_timezone",
		"department",
		"owner_role",
		"active_to",
		"is_active",
	]
	for k, v in fields.items():
		if k in editable_fields:
			doc.set(k, v)

	# NOTE: Editing a template does not modify an existing run snapshot.
	# Correctness here comes naturally because editing SOP Template does not cascade
	# to existing SOP Run rows or their child/snapshot records.
	doc.save(ignore_permissions=True)
	return doc

