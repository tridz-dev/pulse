# Copyright (c) 2025, Pulse and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def has_branch_management_permission(user=None):
	"""Check if user can manage branches."""
	if not user:
		user = frappe.session.user
	
	if user == "Administrator":
		return True
	
	roles = frappe.get_roles(user)
	if "System Manager" in roles or "Pulse Admin" in roles:
		return True
	
	# Check if user has Executive or Area Manager role
	employee = frappe.db.get_value(
		"Pulse Employee",
		{"user": user, "is_active": 1},
		"pulse_role"
	)
	if employee in ["Executive", "Area Manager"]:
		return True
	
	return False


@frappe.whitelist()
def get_branches(filters=None, limit_start=0, limit=50):
	"""Get branches with employee counts.
	
	Args:
		filters: Dict with optional filters (city, is_active, branch_manager)
		limit_start: Pagination start
		limit: Page size
	"""
	filters = frappe.parse_json(filters) if isinstance(filters, str) else (filters or {})
	
	db_filters = {}
	if filters.get("city"):
		db_filters["city"] = filters["city"]
	if filters.get("is_active") is not None:
		db_filters["is_active"] = filters["is_active"]
	if filters.get("branch_manager"):
		db_filters["branch_manager"] = filters["branch_manager"]
	
	branches = frappe.get_all(
		"Pulse Branch",
		fields=[
			"name", "branch_name", "branch_code", "city", "state", "country",
			"branch_manager", "is_active", "opening_time", "closing_time",
			"modified"
		],
		filters=db_filters,
		limit_start=limit_start,
		limit_page_length=limit,
		order_by="branch_name asc"
	)
	
	# Get employee counts
	for branch in branches:
		branch["employee_count"] = frappe.db.count(
			"Pulse Employee",
			{"branch": branch["name"], "is_active": 1}
		)
		if branch["branch_manager"]:
			branch["manager_name"] = frappe.db.get_value(
				"Pulse Employee",
				branch["branch_manager"],
				"employee_name"
			)
	
	return {
		"branches": branches,
		"total": frappe.db.count("Pulse Branch", db_filters)
	}


@frappe.whitelist()
def get_branch_detail(branch_name):
	"""Get detailed branch information with employees."""
	if not frappe.db.exists("Pulse Branch", branch_name):
		frappe.throw(_("Branch not found"))
	
	branch = frappe.get_doc("Pulse Branch", branch_name).as_dict()
	
	# Get employees in branch
	employees = frappe.get_all(
		"Pulse Employee",
		fields=["name", "employee_name", "pulse_role", "department", "user", "is_active"],
		filters={"branch": branch_name},
		order_by="employee_name asc"
	)
	
	# Get active SOP assignments for this branch's employees
	employee_names = [e["name"] for e in employees]
	assignments_count = 0
	if employee_names:
		assignments_count = frappe.db.count(
			"SOP Assignment",
			{"employee": ("in", employee_names), "is_active": 1}
		)
	
	return {
		"branch": branch,
		"employees": employees,
		"metrics": {
			"total_employees": len(employees),
			"active_employees": sum(1 for e in employees if e["is_active"]),
			"active_assignments": assignments_count
		}
	}


@frappe.whitelist()
def create_branch(values):
	"""Create a new branch.
	
	Args:
		values: Dict with branch fields
	"""
	if not has_branch_management_permission():
		frappe.throw(_("Not permitted to create branches"), frappe.PermissionError)
	
	values = frappe.parse_json(values) if isinstance(values, str) else values
	
	# Required fields
	if not values.get("branch_name"):
		frappe.throw(_("Branch Name is required"))
	
	try:
		doc = frappe.get_doc({
			"doctype": "Pulse Branch",
			"branch_name": values.get("branch_name"),
			"branch_code": values.get("branch_code"),
			"address": values.get("address"),
			"city": values.get("city"),
			"state": values.get("state"),
			"country": values.get("country"),
			"branch_manager": values.get("branch_manager"),
			"phone": values.get("phone"),
			"email": values.get("email"),
			"opening_time": values.get("opening_time"),
			"closing_time": values.get("closing_time"),
			"is_active": values.get("is_active", 1)
		})
		doc.insert()
		return {"success": True, "name": doc.name, "message": _("Branch created successfully")}
	except Exception as e:
		frappe.throw(_("Failed to create branch: {0}").format(str(e)))


@frappe.whitelist()
def update_branch(branch_name, values):
	"""Update an existing branch."""
	if not has_branch_management_permission():
		frappe.throw(_("Not permitted to update branches"), frappe.PermissionError)
	
	if not frappe.db.exists("Pulse Branch", branch_name):
		frappe.throw(_("Branch not found"))
	
	values = frappe.parse_json(values) if isinstance(values, str) else values
	
	doc = frappe.get_doc("Pulse Branch", branch_name)
	
	# Update fields
	fields_to_update = [
		"branch_name", "branch_code", "address", "city", "state", "country",
		"branch_manager", "phone", "email", "opening_time", "closing_time", "is_active"
	]
	
	for field in fields_to_update:
		if field in values:
			doc.set(field, values[field])
	
	doc.save()
	return {"success": True, "message": _("Branch updated successfully")}


@frappe.whitelist()
def deactivate_branch(branch_name):
	"""Deactivate a branch (soft delete)."""
	if not has_branch_management_permission():
		frappe.throw(_("Not permitted to deactivate branches"), frappe.PermissionError)
	
	if not frappe.db.exists("Pulse Branch", branch_name):
		frappe.throw(_("Branch not found"))
	
	# Check if branch has active employees
	active_employees = frappe.db.count(
		"Pulse Employee",
		{"branch": branch_name, "is_active": 1}
	)
	
	if active_employees > 0:
		frappe.throw(
			_("Cannot deactivate branch with {0} active employee(s). Please reassign employees first.").format(active_employees)
		)
	
	frappe.db.set_value("Pulse Branch", branch_name, "is_active", 0)
	return {"success": True, "message": _("Branch deactivated successfully")}


@frappe.whitelist()
def get_branch_options():
	"""Get branch options for dropdowns."""
	branches = frappe.get_all(
		"Pulse Branch",
		fields=["name as value", "branch_name as label", "city"],
		filters={"is_active": 1},
		order_by="branch_name asc"
	)
	return branches


@frappe.whitelist()
def get_cities():
	"""Get unique cities for filtering."""
	cities = frappe.db.sql_list("""
		SELECT DISTINCT city FROM `tabPulse Branch`
		WHERE city IS NOT NULL AND city != ''
		ORDER BY city ASC
	""")
	return cities
