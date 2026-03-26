# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe


@frappe.whitelist()
def get_current_employee():
	"""Return the Pulse Employee record for the logged-in user.

	System Managers and Pulse Admins without an employee record get a
	synthetic admin profile so they can always access the app.
	"""
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw("Not logged in.", frappe.AuthenticationError)

	emp = frappe.db.get_value(
		"Pulse Employee",
		{"user": user, "is_active": 1},
		["name", "employee_name", "pulse_role", "branch", "reports_to", "avatar_url", "department"],
		as_dict=True,
	)

	if not emp:
		roles = frappe.get_roles(user)
		if "System Manager" in roles or "Pulse Admin" in roles:
			full_name = frappe.db.get_value("User", user, "full_name") or user
			return frappe._dict(
				name=user,
				employee_name=full_name,
				pulse_role=None,
				branch=None,
				reports_to=None,
				avatar_url=None,
				department=None,
				system_role="Pulse Admin",
				role_alias="Admin",
				is_admin=True,
			)
		# Regular user with no linked Pulse Employee
		frappe.throw(
			"Your account is not linked to a Pulse profile. Ask your administrator to create a Pulse Employee record for your user.",
			frappe.PermissionError,
		)

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
