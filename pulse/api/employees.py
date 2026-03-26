# Copyright (c) 2025, Pulse and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import random
import string

from pulse.cache import cache_result, cache_invalidate


def has_employee_management_permission(user=None):
	"""Check if user can manage employees."""
	if not user:
		user = frappe.session.user
	
	if user == "Administrator":
		return True
	
	roles = frappe.get_roles(user)
	if "System Manager" in roles or "Pulse Admin" in roles:
		return True
	
	# Check Pulse Role
	employee = frappe.db.get_value(
		"Pulse Employee",
		{"user": user, "is_active": 1},
		["pulse_role", "branch"],
		as_dict=True
	)
	
	if employee:
		if employee.pulse_role == "Executive":
			return True
		if employee.pulse_role == "Area Manager":
			return True  # Can manage employees in their region (checked at API level)
	
	return False


def generate_temp_password(length=10):
	"""Generate a temporary password."""
	# Generate a readable password with mix of chars
	chars = string.ascii_letters + string.digits
	return ''.join(random.choice(chars) for _ in range(length))


@frappe.whitelist()
@cache_result(ttl=300, key_builder=lambda filters=None, limit_start=0, limit=50: f"employees:list:{hash(str(filters))}:{limit_start}:{limit}:{frappe.session.user}")
def get_employees(filters=None, limit_start=0, limit=50):
	"""Get employees with filters.
	
	Args:
		filters: Dict with optional filters (branch, department, pulse_role, is_active, search)
		limit_start: Pagination start
		limit: Page size
	"""
	filters = frappe.parse_json(filters) if isinstance(filters, str) else (filters or {})
	
	# Build query
	conditions = []
	values = {}
	
	if filters.get("branch"):
		conditions.append("e.branch = %(branch)s")
		values["branch"] = filters["branch"]
	
	if filters.get("department"):
		conditions.append("e.department = %(department)s")
		values["department"] = filters["department"]
	
	if filters.get("pulse_role"):
		conditions.append("e.pulse_role = %(pulse_role)s")
		values["pulse_role"] = filters["pulse_role"]
	
	if filters.get("is_active") is not None:
		conditions.append("e.is_active = %(is_active)s")
		values["is_active"] = filters["is_active"]
	
	if filters.get("search"):
		conditions.append("(e.employee_name LIKE %(search)s OR e.name LIKE %(search)s)")
		values["search"] = f"%{filters['search']}%"
	
	# Area managers can only see employees in their branch
	current_employee = get_current_employee_info()
	if current_employee and current_employee.get("pulse_role") == "Area Manager":
		conditions.append("e.branch = %(mgr_branch)s")
		values["mgr_branch"] = current_employee.get("branch")
	
	where_clause = " AND ".join(conditions) if conditions else "1=1"
	
	employees = frappe.db.sql(f"""
		SELECT 
			e.name, e.employee_name, e.user, e.pulse_role, 
			e.branch, e.department, e.reports_to, e.is_active,
			e.avatar_url, e.creation,
			b.branch_name,
			d.department_name,
			mgr.employee_name as reports_to_name,
			u.email as user_email
		FROM `tabPulse Employee` e
		LEFT JOIN `tabPulse Branch` b ON e.branch = b.name
		LEFT JOIN `tabPulse Department` d ON e.department = d.name
		LEFT JOIN `tabPulse Employee` mgr ON e.reports_to = mgr.name
		LEFT JOIN `tabUser` u ON e.user = u.name
		WHERE {where_clause}
		ORDER BY e.employee_name ASC
		LIMIT %(limit)s OFFSET %(limit_start)s
	""", {**values, "limit": limit, "limit_start": limit_start}, as_dict=True)
	
	# Get total count
	total = frappe.db.sql(f"""
		SELECT COUNT(*) as count
		FROM `tabPulse Employee` e
		WHERE {where_clause}
	""", values, as_dict=True)[0].count
	
	return {
		"employees": employees,
		"total": total
	}


@frappe.whitelist()
@cache_result(ttl=600, key_builder=lambda employee_name: f"employees:detail:{employee_name}")
def get_employee_detail(employee_name):
	"""Get detailed employee information."""
	if not frappe.db.exists("Pulse Employee", employee_name):
		frappe.throw(_("Employee not found"))
	
	# Check permission
	current = get_current_employee_info()
	if not has_employee_management_permission():
		# Can only view own profile
		if not current or current.get("name") != employee_name:
			frappe.throw(_("Not permitted to view this employee"), frappe.PermissionError)
	
	employee = frappe.get_doc("Pulse Employee", employee_name).as_dict()
	
	# Get related data
	reports_to_name = None
	if employee.reports_to:
		reports_to_name = frappe.db.get_value("Pulse Employee", employee.reports_to, "employee_name")
	
	branch_name = None
	if employee.branch:
		branch_name = frappe.db.get_value("Pulse Branch", employee.branch, "branch_name")
	
	department_name = None
	if employee.department:
		department_name = frappe.db.get_value("Pulse Department", employee.department, "department_name")
	
	# Get user details
	user_details = None
	if employee.user:
		user_doc = frappe.get_doc("User", employee.user)
		user_details = {
			"email": user_doc.email,
			"enabled": user_doc.enabled,
			"last_active": user_doc.last_active,
			"role_profile_name": user_doc.role_profile_name
		}
	
	# Get recent runs
	runs = frappe.get_all(
		"SOP Run",
		fields=["name", "template", "period_date", "status", "progress", "score", "modified"],
		filters={"employee": employee_name},
		order_by="modified desc",
		limit=5
	)
	
	# Get assignments
	assignments = frappe.get_all(
		"SOP Assignment",
		fields=["name", "template", "is_active"],
		filters={"employee": employee_name},
		order_by="modified desc"
	)
	
	return {
		"employee": employee,
		"reports_to_name": reports_to_name,
		"branch_name": branch_name,
		"department_name": department_name,
		"user_details": user_details,
		"recent_runs": runs,
		"assignments": assignments
	}


@frappe.whitelist()
@cache_invalidate(pattern='employees:*')
def create_employee(values, create_user_account=True):
	"""Create a new employee with optional user account.
	
	Args:
		values: Dict with employee fields
		create_user_account: Whether to create a Frappe User account
	
	Returns:
		Dict with success status, employee name, and temp password if user created
	"""
	if not has_employee_management_permission():
		frappe.throw(_("Not permitted to create employees"), frappe.PermissionError)
	
	values = frappe.parse_json(values) if isinstance(values, str) else values
	
	# Required fields
	if not values.get("employee_name"):
		frappe.throw(_("Employee Name is required"))
	
	if not values.get("pulse_role"):
		frappe.throw(_("Role is required"))
	
	if not values.get("branch"):
		frappe.throw(_("Branch is required"))
	
	# Validate branch exists
	if not frappe.db.exists("Pulse Branch", values.get("branch")):
		frappe.throw(_("Branch not found"))
	
	# Validate department if provided
	if values.get("department") and not frappe.db.exists("Pulse Department", values.get("department")):
		frappe.throw(_("Department not found"))
	
	# Validate reports_to if provided
	if values.get("reports_to") and not frappe.db.exists("Pulse Employee", values.get("reports_to")):
		frappe.throw(_("Reports To employee not found"))
	
	user_name = None
	temp_password = None
	
	try:
		# Create user account if requested
		if create_user_account:
			email = values.get("email") or values.get("user_email")
			if not email:
				frappe.throw(_("Email is required to create user account"))
			
			# Check if user already exists
			if frappe.db.exists("User", email):
				user_name = email
				# Ensure user has Pulse role
				add_pulse_roles_to_user(user_name)
			else:
				# Generate temporary password
				temp_password = generate_temp_password()
				
				# Create user
				user = frappe.get_doc({
					"doctype": "User",
					"email": email,
					"first_name": values.get("employee_name").split()[0],
					"last_name": " ".join(values.get("employee_name").split()[1:]) if len(values.get("employee_name").split()) > 1 else "",
					"send_welcome_email": 0,
					"new_password": temp_password
				})
				user.insert(ignore_permissions=True)
				user_name = user.name
				
				# Add Pulse roles
				add_pulse_roles_to_user(user_name)
			
			# Set the user field
			values["user"] = user_name
		
		# Create employee
		doc = frappe.get_doc({
			"doctype": "Pulse Employee",
			"employee_name": values.get("employee_name"),
			"user": values.get("user"),
			"pulse_role": values.get("pulse_role"),
			"branch": values.get("branch"),
			"department": values.get("department"),
			"reports_to": values.get("reports_to"),
			"is_active": values.get("is_active", 1),
			"avatar_url": values.get("avatar_url")
		})
		doc.insert(ignore_permissions=True)
		
		result = {
			"success": True,
			"name": doc.name,
			"message": _("Employee created successfully")
		}
		
		if temp_password:
			result["temp_password"] = temp_password
			result["message"] += _(". Temporary password: {0}").format(temp_password)
		
		return result
		
	except Exception as e:
		# Rollback user creation if employee creation failed
		if user_name and not values.get("user"):
			try:
				frappe.delete_doc("User", user_name, ignore_permissions=True)
			except:
				pass
		frappe.throw(_("Failed to create employee: {0}").format(str(e)))


def add_pulse_roles_to_user(user_name):
	"""Add Pulse roles to a user."""
	# Add Pulse User role
	if not frappe.db.exists("Has Role", {"parent": user_name, "role": "Pulse User"}):
		frappe.get_doc({
			"doctype": "Has Role",
			"parent": user_name,
			"parentfield": "roles",
			"parenttype": "User",
			"role": "Pulse User"
		}).insert(ignore_permissions=True)


@frappe.whitelist()
@cache_invalidate(pattern='employees:*')
def update_employee(employee_name, values):
	"""Update an existing employee."""
	if not has_employee_management_permission():
		frappe.throw(_("Not permitted to update employees"), frappe.PermissionError)
	
	if not frappe.db.exists("Pulse Employee", employee_name):
		frappe.throw(_("Employee not found"))
	
	values = frappe.parse_json(values) if isinstance(values, str) else values
	
	doc = frappe.get_doc("Pulse Employee", employee_name)
	
	# Update fields
	fields_to_update = [
		"employee_name", "pulse_role", "branch", "department",
		"reports_to", "is_active", "avatar_url"
	]
	
	for field in fields_to_update:
		if field in values:
			# Validate branch/department if changed
			if field == "branch" and values[field]:
				if not frappe.db.exists("Pulse Branch", values[field]):
					frappe.throw(_("Branch not found"))
			if field == "department" and values[field]:
				if not frappe.db.exists("Pulse Department", values[field]):
					frappe.throw(_("Department not found"))
			if field == "reports_to" and values[field]:
				if not frappe.db.exists("Pulse Employee", values[field]):
					frappe.throw(_("Reports To employee not found"))
				# Prevent circular reference
				if values[field] == employee_name:
					frappe.throw(_("Employee cannot report to themselves"))
			
			doc.set(field, values[field])
	
	doc.save()
	return {"success": True, "message": _("Employee updated successfully")}


@frappe.whitelist()
@cache_invalidate(pattern='employees:*')
def deactivate_employee(employee_name):
	"""Deactivate an employee (soft delete)."""
	if not has_employee_management_permission():
		frappe.throw(_("Not permitted to deactivate employees"), frappe.PermissionError)
	
	if not frappe.db.exists("Pulse Employee", employee_name):
		frappe.throw(_("Employee not found"))
	
	# Check if employee has direct reports
	direct_reports = frappe.db.count("Pulse Employee", {"reports_to": employee_name, "is_active": 1})
	if direct_reports > 0:
		frappe.throw(
			_("Cannot deactivate employee with {0} direct report(s). Please reassign them first.").format(direct_reports)
		)
	
	# Deactivate employee
	frappe.db.set_value("Pulse Employee", employee_name, "is_active", 0)
	
	# Disable user account
	user = frappe.db.get_value("Pulse Employee", employee_name, "user")
	if user:
		frappe.db.set_value("User", user, "enabled", 0)
	
	return {"success": True, "message": _("Employee deactivated successfully")}


@frappe.whitelist()
def reset_user_password(employee_name):
	"""Reset password for an employee's user account."""
	if not has_employee_management_permission():
		frappe.throw(_("Not permitted to reset passwords"), frappe.PermissionError)
	
	user = frappe.db.get_value("Pulse Employee", employee_name, "user")
	if not user:
		frappe.throw(_("Employee has no user account"))
	
	if not frappe.db.exists("User", user):
		frappe.throw(_("User account not found"))
	
	temp_password = generate_temp_password()
	
	user_doc = frappe.get_doc("User", user)
	user_doc.new_password = temp_password
	user_doc.save()
	
	return {
		"success": True,
		"temp_password": temp_password,
		"message": _("Password reset successfully. New temporary password: {0}").format(temp_password)
	}


@frappe.whitelist()
@cache_result(ttl=600, key_builder=lambda employee_name=None: f"employees:hierarchy:{employee_name or 'full'}:{frappe.session.user}")
def get_employee_hierarchy(employee_name=None):
	"""Get org hierarchy tree.
	
	If employee_name is provided, returns tree starting from that employee.
	Otherwise returns full org tree (for executives).
	"""
	if employee_name and not frappe.db.exists("Pulse Employee", employee_name):
		frappe.throw(_("Employee not found"))
	
	# If no specific employee requested, start from root(s)
	if not employee_name:
		# Get all employees with no reports_to (top level)
		roots = frappe.get_all(
			"Pulse Employee",
			fields=["name", "employee_name", "pulse_role", "branch", "avatar_url"],
			filters={"reports_to": ("is", "not set"), "is_active": 1},
			order_by="employee_name asc"
		)
		
		return {
			"roots": [build_hierarchy_tree(r) for r in roots]
		}
	else:
		# Get specific employee and their descendants
		employee = frappe.get_doc("Pulse Employee", employee_name).as_dict()
		return {
			"tree": build_hierarchy_tree(employee)
		}


def build_hierarchy_tree(employee):
	"""Recursively build hierarchy tree."""
	# Get direct reports
	direct_reports = frappe.get_all(
		"Pulse Employee",
		fields=["name", "employee_name", "pulse_role", "branch", "avatar_url"],
		filters={"reports_to": employee["name"], "is_active": 1},
		order_by="employee_name asc"
	)
	
	result = {
		"name": employee["name"],
		"employee_name": employee["employee_name"],
		"pulse_role": employee.get("pulse_role"),
		"branch": employee.get("branch"),
		"avatar_url": employee.get("avatar_url"),
		"direct_reports": [build_hierarchy_tree(r) for r in direct_reports]
	}
	
	return result


@frappe.whitelist()
@cache_result(ttl=300, key_builder=lambda filters=None: f"employees:options:{hash(str(filters))}:{frappe.session.user}")
def get_employee_options(filters=None):
	"""Get employee options for dropdowns."""
	filters = frappe.parse_json(filters) if isinstance(filters, str) else (filters or {})
	
	db_filters = {"is_active": 1}
	if filters.get("branch"):
		db_filters["branch"] = filters["branch"]
	if filters.get("pulse_role"):
		db_filters["pulse_role"] = filters["pulse_role"]
	
	employees = frappe.get_all(
		"Pulse Employee",
		fields=["name as value", "employee_name as label", "pulse_role", "branch"],
		filters=db_filters,
		order_by="employee_name asc"
	)
	
	# Add branch names
	for emp in employees:
		if emp.get("branch"):
			emp["branch_name"] = frappe.db.get_value("Pulse Branch", emp["branch"], "branch_name")
	
	return employees


@frappe.whitelist()
def change_reports_to(employee_name, new_reports_to):
	"""Change who an employee reports to."""
	if not has_employee_management_permission():
		frappe.throw(_("Not permitted to change reporting structure"), frappe.PermissionError)
	
	if not frappe.db.exists("Pulse Employee", employee_name):
		frappe.throw(_("Employee not found"))
	
	if new_reports_to and not frappe.db.exists("Pulse Employee", new_reports_to):
		frappe.throw(_("New manager not found"))
	
	# Prevent circular reference
	if new_reports_to == employee_name:
		frappe.throw(_("Employee cannot report to themselves"))
	
	# Check if new_reports_to eventually reports to employee (would create cycle)
	if new_reports_to and would_create_cycle(employee_name, new_reports_to):
		frappe.throw(_("Cannot assign: would create reporting cycle"))
	
	frappe.db.set_value("Pulse Employee", employee_name, "reports_to", new_reports_to)
	
	return {"success": True, "message": _("Reporting structure updated successfully")}


def would_create_cycle(employee_name, new_manager):
	"""Check if assigning new_manager would create a cycle."""
	current = new_manager
	visited = set()
	
	while current:
		if current in visited:
			return True
		visited.add(current)
		
		if current == employee_name:
			return True
		
		current = frappe.db.get_value("Pulse Employee", current, "reports_to")
	
	return False


def get_current_employee_info():
	"""Get current user's employee info."""
	if frappe.session.user == "Administrator":
		return None
	
	return frappe.db.get_value(
		"Pulse Employee",
		{"user": frappe.session.user, "is_active": 1},
		["name", "pulse_role", "branch", "department"],
		as_dict=True
	)
