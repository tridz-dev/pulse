# Copyright (c) 2025, Pulse and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def has_department_management_permission(user=None):
	"""Check if user can manage departments."""
	if not user:
		user = frappe.session.user
	
	if user == "Administrator":
		return True
	
	roles = frappe.get_roles(user)
	if "System Manager" in roles or "Pulse Admin" in roles:
		return True
	
	employee = frappe.db.get_value(
		"Pulse Employee",
		{"user": user, "is_active": 1},
		"pulse_role"
	)
	if employee == "Executive":
		return True
	
	return False


@frappe.whitelist()
def get_departments():
	"""Get all departments with employee and template counts."""
	departments = frappe.get_all(
		"Pulse Department",
		fields=["name", "department_name", "description", "is_active"],
		order_by="department_name asc"
	)
	
	for dept in departments:
		# Get employee count
		dept["employee_count"] = frappe.db.count(
			"Pulse Employee",
			{"department": dept["name"], "is_active": 1}
		)
		
		# Get template count
		dept["template_count"] = frappe.db.count(
			"SOP Template",
			{"department": dept["department_name"], "is_active": 1}
		)
	
	return {"departments": departments}


@frappe.whitelist()
def get_department_detail(department_name):
	"""Get detailed department information."""
	if not frappe.db.exists("Pulse Department", department_name):
		frappe.throw(_("Department not found"))
	
	dept = frappe.get_doc("Pulse Department", department_name).as_dict()
	
	# Get employees in department
	employees = frappe.get_all(
		"Pulse Employee",
		fields=["name", "employee_name", "pulse_role", "branch", "is_active"],
		filters={"department": department_name},
		order_by="employee_name asc"
	)
	
	# Get templates for department
	templates = frappe.get_all(
		"SOP Template",
		fields=["name", "title", "frequency_type", "owner_role", "is_active"],
		filters={"department": dept.department_name},
		order_by="title asc"
	)
	
	return {
		"department": dept,
		"employees": employees,
		"templates": templates,
		"metrics": {
			"total_employees": len(employees),
			"active_employees": sum(1 for e in employees if e["is_active"]),
			"total_templates": len(templates),
			"active_templates": sum(1 for t in templates if t["is_active"])
		}
	}


@frappe.whitelist()
def create_department(values):
	"""Create a new department."""
	if not has_department_management_permission():
		frappe.throw(_("Not permitted to create departments"), frappe.PermissionError)
	
	values = frappe.parse_json(values) if isinstance(values, str) else values
	
	if not values.get("department_name"):
		frappe.throw(_("Department Name is required"))
	
	# Check if department name already exists
	if frappe.db.exists("Pulse Department", values.get("department_name")):
		frappe.throw(_("Department '{0}' already exists").format(values.get("department_name")))
	
	try:
		doc = frappe.get_doc({
			"doctype": "Pulse Department",
			"department_name": values.get("department_name"),
			"description": values.get("description"),
			"is_active": values.get("is_active", 1)
		})
		doc.insert()
		return {"success": True, "name": doc.name, "message": _("Department created successfully")}
	except Exception as e:
		frappe.throw(_("Failed to create department: {0}").format(str(e)))


@frappe.whitelist()
def update_department(department_name, values):
	"""Update an existing department."""
	if not has_department_management_permission():
		frappe.throw(_("Not permitted to update departments"), frappe.PermissionError)
	
	if not frappe.db.exists("Pulse Department", department_name):
		frappe.throw(_("Department not found"))
	
	values = frappe.parse_json(values) if isinstance(values, str) else values
	
	doc = frappe.get_doc("Pulse Department", department_name)
	
	if "description" in values:
		doc.description = values["description"]
	if "is_active" in values:
		doc.is_active = values["is_active"]
	
	doc.save()
	return {"success": True, "message": _("Department updated successfully")}


@frappe.whitelist()
def deactivate_department(department_name):
	"""Deactivate a department."""
	if not has_department_management_permission():
		frappe.throw(_("Not permitted to deactivate departments"), frappe.PermissionError)
	
	if not frappe.db.exists("Pulse Department", department_name):
		frappe.throw(_("Department not found"))
	
	# Check if department has active employees
	active_employees = frappe.db.count(
		"Pulse Employee",
		{"department": department_name, "is_active": 1}
	)
	if active_employees > 0:
		frappe.throw(
			_("Cannot deactivate department with {0} active employee(s). Please reassign them first.").format(active_employees)
		)
	
	frappe.db.set_value("Pulse Department", department_name, "is_active", 0)
	return {"success": True, "message": _("Department deactivated successfully")}


@frappe.whitelist()
def get_department_options():
	"""Get department options for dropdowns."""
	departments = frappe.get_all(
		"Pulse Department",
		fields=["name as value", "department_name as label"],
		filters={"is_active": 1},
		order_by="department_name asc"
	)
	return departments
