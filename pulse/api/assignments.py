# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _
from frappe.utils import today, add_days, get_datetime


@frappe.whitelist()
def get_assignments(filters: dict = None, limit: int = 100):
	"""List SOP Assignments with template and employee details."""
	current = frappe.session.user
	
	# Build filters
	filter_conditions = {}
	if filters:
		if filters.get('template'):
			filter_conditions['template'] = filters['template']
		if filters.get('employee'):
			filter_conditions['employee'] = filters['employee']
		if filters.get('is_active') is not None:
			filter_conditions['is_active'] = filters['is_active']
	
	assignments = frappe.get_all(
		"SOP Assignment",
		filters=filter_conditions,
		fields=["name", "template", "employee", "is_active", "creation"],
		order_by="creation desc",
		limit=limit
	)
	
	# Enrich with template and employee details
	for assignment in assignments:
		# Get template details
		template = frappe.db.get_value(
			"SOP Template",
			assignment.template,
			["title", "department", "frequency_type", "owner_role"],
			as_dict=True
		)
		if template:
			assignment.template_title = template.title
			assignment.template_department = template.department
			assignment.template_frequency = template.frequency_type
			assignment.template_owner_role = template.owner_role
		
		# Get employee details
		employee = frappe.db.get_value(
			"Pulse Employee",
			assignment.employee,
			["employee_name", "pulse_role", "branch", "department"],
			as_dict=True
		)
		if employee:
			assignment.employee_name = employee.employee_name
			assignment.employee_role = employee.pulse_role
			assignment.employee_branch = employee.branch
			assignment.employee_department = employee.department
		
		# Get run count for this assignment
		assignment.run_count = frappe.db.count(
			"SOP Run",
			filters={
				"template": assignment.template,
				"employee": assignment.employee
			}
		)
	
	return assignments


@frappe.whitelist()
def get_assignment_detail(assignment_name: str):
	"""Get detailed information about a specific assignment."""
	if not frappe.db.exists("SOP Assignment", assignment_name):
		frappe.throw(_("Assignment not found"))
	
	doc = frappe.get_doc("SOP Assignment", assignment_name)
	
	# Get template details
	template = frappe.db.get_value(
		"SOP Template",
		doc.template,
		["title", "department", "frequency_type", "owner_role", "is_active"],
		as_dict=True
	)
	
	# Get employee details
	employee = frappe.db.get_value(
		"Pulse Employee",
		doc.employee,
		["employee_name", "pulse_role", "branch", "department", "user"],
		as_dict=True
	)
	
	# Get recent runs for this assignment
	recent_runs = frappe.get_all(
		"SOP Run",
		filters={
			"template": doc.template,
			"employee": doc.employee
		},
		fields=["name", "period_date", "status", "progress", "score"],
		order_by="period_date desc",
		limit=5
	)
	
	return {
		"name": doc.name,
		"template": doc.template,
		"template_details": template,
		"employee": doc.employee,
		"employee_details": employee,
		"is_active": doc.is_active,
		"creation": str(doc.creation),
		"recent_runs": recent_runs,
		"total_runs": frappe.db.count("SOP Run", filters={"template": doc.template, "employee": doc.employee})
	}


@frappe.whitelist()
def create_assignment(template: str, employee: str, is_active: bool = True):
	"""Create a new SOP Assignment."""
	current = frappe.session.user
	
	if not has_assignment_permission(current):
		frappe.throw(_("Not permitted to create assignments"), frappe.PermissionError)
	
	# Validate template exists and is active
	if not frappe.db.exists("SOP Template", template):
		frappe.throw(_("Template not found"))
	
	template_doc = frappe.get_doc("SOP Template", template)
	if not template_doc.is_active:
		frappe.throw(_("Cannot assign inactive template"))
	
	# Validate employee exists and is active
	if not frappe.db.exists("Pulse Employee", employee):
		frappe.throw(_("Employee not found"))
	
	employee_doc = frappe.get_doc("Pulse Employee", employee)
	if not employee_doc.is_active:
		frappe.throw(_("Cannot assign to inactive employee"))
	
	# Check for existing assignment
	existing = frappe.get_all(
		"SOP Assignment",
		filters={
			"template": template,
			"employee": employee
		},
		limit=1
	)
	
	if existing:
		frappe.throw(_("Assignment already exists for this template and employee"))
	
	try:
		doc = frappe.get_doc({
			"doctype": "SOP Assignment",
			"template": template,
			"employee": employee,
			"is_active": is_active
		})
		doc.insert()
		
		return {
			"success": True,
			"name": doc.name,
			"message": _("Assignment created successfully")
		}
	except Exception as e:
		frappe.throw(_("Failed to create assignment: {0}").format(str(e)))


@frappe.whitelist()
def create_bulk_assignments(template: str, employees: list, is_active: bool = True):
	"""Create assignments for multiple employees at once."""
	current = frappe.session.user
	
	if not has_assignment_permission(current):
		frappe.throw(_("Not permitted to create assignments"), frappe.PermissionError)
	
	if not employees or len(employees) == 0:
		frappe.throw(_("At least one employee is required"))
	
	# Validate template
	if not frappe.db.exists("SOP Template", template):
		frappe.throw(_("Template not found"))
	
	template_doc = frappe.get_doc("SOP Template", template)
	if not template_doc.is_active:
		frappe.throw(_("Cannot assign inactive template"))
	
	created = []
	failed = []
	
	for employee in employees:
		try:
			# Check if already exists
			existing = frappe.get_all(
				"SOP Assignment",
				filters={
					"template": template,
					"employee": employee
				},
				limit=1
			)
			
			if existing:
				failed.append({"employee": employee, "reason": "Already assigned"})
				continue
			
			# Validate employee
			if not frappe.db.exists("Pulse Employee", employee):
				failed.append({"employee": employee, "reason": "Employee not found"})
				continue
			
			emp_doc = frappe.get_doc("Pulse Employee", employee)
			if not emp_doc.is_active:
				failed.append({"employee": employee, "reason": "Employee inactive"})
				continue
			
			doc = frappe.get_doc({
				"doctype": "SOP Assignment",
				"template": template,
				"employee": employee,
				"is_active": is_active
			})
			doc.insert()
			created.append(doc.name)
			
		except Exception as e:
			failed.append({"employee": employee, "reason": str(e)})
	
	return {
		"success": len(created) > 0,
		"created": created,
		"created_count": len(created),
		"failed": failed,
		"failed_count": len(failed),
		"message": _("Created {0} assignments, {1} failed").format(len(created), len(failed))
	}


@frappe.whitelist()
def update_assignment(assignment_name: str, values: dict):
	"""Update an existing assignment."""
	current = frappe.session.user
	
	if not has_assignment_permission(current):
		frappe.throw(_("Not permitted to update assignments"), frappe.PermissionError)
	
	if not frappe.db.exists("SOP Assignment", assignment_name):
		frappe.throw(_("Assignment not found"))
	
	doc = frappe.get_doc("SOP Assignment", assignment_name)
	
	if "is_active" in values:
		doc.is_active = values["is_active"]
	
	try:
		doc.save()
		return {
			"success": True,
			"name": doc.name,
			"message": _("Assignment updated successfully")
		}
	except Exception as e:
		frappe.throw(_("Failed to update assignment: {0}").format(str(e)))


@frappe.whitelist()
def delete_assignment(assignment_name: str):
	"""Delete an assignment."""
	current = frappe.session.user
	
	if not has_assignment_permission(current):
		frappe.throw(_("Not permitted to delete assignments"), frappe.PermissionError)
	
	if not frappe.db.exists("SOP Assignment", assignment_name):
		frappe.throw(_("Assignment not found"))
	
	try:
		frappe.delete_doc("SOP Assignment", assignment_name)
		return {
			"success": True,
			"message": _("Assignment deleted successfully")
		}
	except Exception as e:
		frappe.throw(_("Failed to delete assignment: {0}").format(str(e)))


@frappe.whitelist()
def get_assignment_options():
	"""Get dropdown options for assignment creation."""
	# Get active templates
	templates = frappe.get_all(
		"SOP Template",
		filters={"is_active": 1},
		fields=["name", "title", "department", "owner_role", "frequency_type"],
		order_by="title"
	)
	
	# Get active employees
	employees = frappe.get_all(
		"Pulse Employee",
		filters={"is_active": 1},
		fields=["name", "employee_name", "pulse_role", "branch", "department"],
		order_by="employee_name"
	)
	
	return {
		"templates": templates,
		"employees": employees
	}


@frappe.whitelist()
def get_assignment_calendar(start_date: str = None, end_date: str = None, employee: str = None):
	"""Get scheduled runs for calendar view."""
	if not start_date:
		start_date = today()
	if not end_date:
		end_date = add_days(start_date, 30)
	
	filters = {
		"period_date": ["between", [start_date, end_date]]
	}
	
	if employee:
		filters["employee"] = employee
	
	runs = frappe.get_all(
		"SOP Run",
		filters=filters,
		fields=["name", "template", "employee", "period_date", "status", "progress"],
		order_by="period_date"
	)
	
	# Enrich with details
	for run in runs:
		template = frappe.db.get_value("SOP Template", run.template, "title")
		run.template_title = template
		
		emp = frappe.db.get_value("Pulse Employee", run.employee, "employee_name")
		run.employee_name = emp
	
	return runs


def has_assignment_permission(user: str) -> bool:
	"""Check if user can manage assignments."""
	roles = frappe.get_roles(user)
	allowed = {"System Manager", "Pulse Admin", "Pulse Executive", "Pulse Leader", "Pulse Manager"}
	return bool(allowed & set(roles))
