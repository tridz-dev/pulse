# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe


def after_install():
	"""Create custom roles and optional seed data after app install."""
	create_pulse_roles()
	create_default_pulse_role_records()
	create_default_departments()


def create_pulse_roles():
	"""Create Pulse system roles (permission layer) if they do not exist."""
	roles = [
		"Pulse User",
		"Pulse Manager",
		"Pulse Leader",
		"Pulse Executive",
		"Pulse Admin",
	]
	for role_name in roles:
		if not frappe.db.exists("Role", role_name):
			role = frappe.get_doc({"doctype": "Role", "role_name": role_name})
			role.insert(ignore_permissions=True)
			frappe.db.commit()


def create_default_pulse_role_records():
	"""Create default Pulse Role (business role) records linked to system roles."""
	defaults = [
		{"role_name": "Operator", "level": 1, "alias": "Operator", "system_role": "Pulse User"},
		{"role_name": "Supervisor", "level": 2, "alias": "Supervisor", "system_role": "Pulse Manager"},
		{"role_name": "Area Manager", "level": 3, "alias": "Area Manager", "system_role": "Pulse Leader"},
		{"role_name": "Executive", "level": 4, "alias": "Executive", "system_role": "Pulse Executive"},
	]
	for d in defaults:
		if not frappe.db.exists("Pulse Role", d["role_name"]):
			doc = frappe.get_doc({"doctype": "Pulse Role", **d})
			doc.insert(ignore_permissions=True)
	frappe.db.commit()


def create_default_departments():
	"""Create default Pulse Department records for a fresh install."""
	departments = ["Operations", "Security", "Management"]
	for name in departments:
		if not frappe.db.exists("Pulse Department", name):
			doc = frappe.get_doc(
				{
					"doctype": "Pulse Department",
					"department_name": name,
					"is_active": 1,
				}
			)
			doc.insert(ignore_permissions=True)
	frappe.db.commit()
