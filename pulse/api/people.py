# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _
from pulse.api.permissions import get_scope_for_user, has_app_permission


def is_pulse_admin() -> bool:
	user = frappe.session.user
	if user == "Administrator":
		return True
	return "Pulse Admin" in frappe.get_roles(user)


def check_pulse_admin():
	if not is_pulse_admin():
		frappe.throw(_("Not permitted. Only Pulse Admin can perform this action."), frappe.PermissionError)


@frappe.whitelist()
def list_unlinked_users():
	check_pulse_admin()
	
	linked_users = frappe.get_all("Pulse Employee", pluck="user")
	
	filters = {"enabled": 1}
	if linked_users:
		filters["name"] = ["not in", linked_users]
		
	return frappe.get_all("User", filters=filters, fields=["name", "first_name", "last_name", "email"])


@frappe.whitelist()
def list_departments():
	if not has_app_permission():
		frappe.throw(_("Not permitted. You do not have access to the Pulse application."), frappe.PermissionError)
	return frappe.get_all("Pulse Department", fields=["name", "department_name", "description", "is_active"])


@frappe.whitelist()
def create_department(department_name, description=None):
	check_pulse_admin()
	if not department_name:
		frappe.throw(_("Department Name is required."))
	if frappe.db.exists("Pulse Department", department_name):
		frappe.throw(_("Department '{0}' already exists.").format(department_name))
	
	doc = frappe.get_doc({
		"doctype": "Pulse Department",
		"department_name": department_name,
		"description": description,
		"is_active": 1,
	})
	doc.insert(ignore_permissions=True)
	return doc


def check_reports_to_cycle(employee_name: str | None, reports_to: str | None) -> None:
	if not reports_to or not employee_name:
		return
	
	if employee_name == reports_to:
		frappe.throw(_("An employee cannot report to themselves."), frappe.ValidationError)
		
	current = reports_to
	visited = set()
	while current:
		if current == employee_name:
			frappe.throw(_("Circular reference detected: setting reports_to to '{0}' would create a cycle.").format(reports_to), frappe.ValidationError)
		if current in visited:
			break
		visited.add(current)
		current = frappe.db.get_value("Pulse Employee", current, "reports_to")


def check_duplicate_user_link(user: str, exclude_employee: str | None = None) -> None:
	if not user:
		return
	filters = {"user": user, "is_active": 1}
	if exclude_employee:
		filters["name"] = ["!=", exclude_employee]
	
	if frappe.db.exists("Pulse Employee", filters):
		frappe.throw(_("User '{0}' is already linked to an active Pulse Employee.").format(user))


@frappe.whitelist()
def create_employee(employee_name, user, pulse_role, branch=None, department=None, reports_to=None):
	check_pulse_admin()
	
	if not employee_name or not user or not pulse_role:
		frappe.throw(_("Employee Name, User, and Pulse Role are required."))
		
	check_duplicate_user_link(user)
	
	doc = frappe.get_doc({
		"doctype": "Pulse Employee",
		"employee_name": employee_name,
		"user": user,
		"pulse_role": pulse_role,
		"branch": branch,
		"department": department,
		"reports_to": reports_to,
		"is_active": 1,
	})
	doc.insert(ignore_permissions=True)
	return doc


@frappe.whitelist()
def update_employee(name, **fields):
	check_pulse_admin()
	
	if not frappe.db.exists("Pulse Employee", name):
		frappe.throw(_("Pulse Employee '{0}' does not exist.").format(name), frappe.DoesNotExistError)
		
	doc = frappe.get_doc("Pulse Employee", name)
	
	if "user" in fields and fields["user"] != doc.user:
		check_duplicate_user_link(fields["user"], exclude_employee=name)
		
	if "reports_to" in fields:
		if fields["reports_to"] == name:
			frappe.throw(_("An employee cannot report to themselves."), frappe.ValidationError)
		check_reports_to_cycle(name, fields["reports_to"])
		
	for k, v in fields.items():
		if k in ["employee_name", "user", "pulse_role", "branch", "department", "reports_to", "is_active", "avatar_url"]:
			doc.set(k, v)
			
	doc.save(ignore_permissions=True)
	return doc


@frappe.whitelist()
def deactivate_employee(name):
	check_pulse_admin()
	if not frappe.db.exists("Pulse Employee", name):
		frappe.throw(_("Pulse Employee '{0}' does not exist.").format(name), frappe.DoesNotExistError)
	
	doc = frappe.get_doc("Pulse Employee", name)
	doc.is_active = 0
	doc.save(ignore_permissions=True)
	return doc


@frappe.whitelist()
def list_employees():
	if not has_app_permission():
		frappe.throw(_("Not permitted. You do not have access to the Pulse application."), frappe.PermissionError)
		
	scope = get_scope_for_user(frappe.session.user)
	if not scope:
		return []
		
	return frappe.get_all(
		"Pulse Employee",
		filters={"name": ["in", scope]},
		fields=["name", "employee_name", "user", "pulse_role", "branch", "department", "reports_to", "is_active", "avatar_url"]
	)
