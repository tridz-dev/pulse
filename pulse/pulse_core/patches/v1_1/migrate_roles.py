# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Migrate from old role names to new system roles, ensure Pulse Role records exist, fix orphans, clear old roles."""

import frappe

DEFAULT_PM_ROLES = [
	{"role_name": "Operator", "level": 1, "alias": "Operator", "system_role": "Pulse User"},
	{"role_name": "Supervisor", "level": 2, "alias": "Supervisor", "system_role": "Pulse Manager"},
	{"role_name": "Area Manager", "level": 3, "alias": "Area Manager", "system_role": "Pulse Leader"},
	{"role_name": "Executive", "level": 4, "alias": "Executive", "system_role": "Pulse Executive"},
]
OLD_TO_NEW_ROLES = [
	("PM Operator", "Pulse User"),
	("PM Supervisor", "Pulse Manager"),
	("PM Area Manager", "Pulse Leader"),
]
DEFAULT_PM_ROLE_FALLBACK = "Operator"


def execute():
	"""Create new system roles, default PM Role records, migrate user roles, fix orphans, remove old roles."""
	frappe.db.auto_commit_on_many_writes = True

	# 1. Create new Frappe roles (permission layer) if they don't exist
	for role_name in ("Pulse User", "Pulse Manager", "Pulse Leader"):
		if not frappe.db.exists("Role", role_name):
			frappe.get_doc({"doctype": "Role", "role_name": role_name}).insert(
				ignore_permissions=True
			)

	# 2. Create default Pulse Role (business role) records if they don't exist
	for d in DEFAULT_PM_ROLES:
		if not frappe.db.exists("Pulse Role", d["role_name"]):
			frappe.get_doc({"doctype": "Pulse Role", **d}).insert(ignore_permissions=True)

	valid_pulse_roles = {d["role_name"] for d in DEFAULT_PM_ROLES}

	# 3. Fix orphan Pulse Employee: pulse_role must link to an existing Pulse Role
	employees = frappe.get_all("Pulse Employee", pluck="name")
	for emp_name in employees:
		pulse_role = frappe.db.get_value("Pulse Employee", emp_name, "pulse_role")
		if pulse_role and pulse_role not in valid_pulse_roles and frappe.db.exists("Pulse Role", pulse_role):
			valid_pulse_roles.add(pulse_role)
		if not pulse_role or not frappe.db.exists("Pulse Role", pulse_role):
			frappe.db.set_value(
				"Pulse Employee", emp_name, "pulse_role", DEFAULT_PM_ROLE_FALLBACK, update_modified=False
			)

	# 4. Fix orphan SOP Template: owner_role must link to an existing Pulse Role
	templates = frappe.get_all("SOP Template", pluck="name")
	for template_name in templates:
		owner_role = frappe.db.get_value("SOP Template", template_name, "owner_role")
		if owner_role and owner_role not in valid_pulse_roles and frappe.db.exists("Pulse Role", owner_role):
			valid_pulse_roles.add(owner_role)
		if not owner_role or not frappe.db.exists("Pulse Role", owner_role):
			frappe.db.set_value(
				"SOP Template", template_name, "owner_role", DEFAULT_PM_ROLE_FALLBACK, update_modified=False
			)

	# 5. Migrate user role assignments: add new role, remove old role
	for old_role, new_role in OLD_TO_NEW_ROLES:
		users_with_old = frappe.get_all(
			"Has Role",
			filters={"role": old_role},
			pluck="parent",
			distinct=True,
		)
		for user in users_with_old:
			if frappe.db.exists("User", user):
				user_doc = frappe.get_doc("User", user)
				if new_role not in [r.role for r in user_doc.roles]:
					user_doc.add_roles(new_role)
				user_doc.remove_roles(old_role)
				user_doc.save(ignore_permissions=True)

	# 6. Remove old Role records so they are not reused (optional cleanup)
	for old_role, _ in OLD_TO_NEW_ROLES:
		if frappe.db.exists("Role", old_role):
			has_assignments = bool(
				frappe.get_all("Has Role", filters={"role": old_role}, limit=1)
			)
			if not has_assignments:
				frappe.delete_doc("Role", old_role, force=True, ignore_permissions=True)

	frappe.db.commit()
	frappe.db.auto_commit_on_many_writes = False
