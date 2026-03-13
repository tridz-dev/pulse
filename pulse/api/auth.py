# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe


@frappe.whitelist()
def get_current_employee():
	"""Return the PM Employee record for the logged-in user, with system_role and alias from PM Role."""
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw("Not logged in.")

	emp = frappe.db.get_value(
		"Pulse Employee",
		{"user": user, "is_active": 1},
		["name", "employee_name", "pulse_role", "branch", "reports_to", "avatar_url", "department"],
		as_dict=True,
	)
	if not emp:
		frappe.throw("No active PM Employee record found for this user.")
	pulse_role_link = emp.get("pulse_role")
	if pulse_role_link:
		system_role = frappe.db.get_value("Pulse Role", pulse_role_link, "system_role")
		alias = frappe.db.get_value("Pulse Role", pulse_role_link, "alias")
		emp["system_role"] = system_role
		emp["role_alias"] = alias or pulse_role_link
	else:
		emp["system_role"] = None
		emp["role_alias"] = None
	return emp
