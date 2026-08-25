# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.api.people import (
	create_department,
	create_employee,
	deactivate_employee,
	list_departments,
	list_employees,
	list_unlinked_users,
	update_employee,
)


class TestPeopleCommands(FrappeTestCase):
	"""Tests for the People and Hierarchy Command API."""

	def setUp(self):
		from pulse.install import create_default_pulse_role_records, create_pulse_roles

		create_pulse_roles()
		create_default_pulse_role_records()
		self._created_users: list[str] = []
		self._created_employees: list[str] = []
		self._created_departments: list[str] = []
		self._created_sop_runs: list[str] = []
		
		# Set session to Administrator initially for setup
		frappe.set_user("Administrator")

	def tearDown(self):
		for run_name in self._created_sop_runs:
			if frappe.db.exists("SOP Run", run_name):
				frappe.delete_doc("SOP Run", run_name, force=1, ignore_permissions=True)
		for emp_name in self._created_employees:
			if frappe.db.exists("Pulse Employee", emp_name):
				frappe.delete_doc("Pulse Employee", emp_name, force=1, ignore_permissions=True)
		for dept_name in self._created_departments:
			if frappe.db.exists("Pulse Department", dept_name):
				frappe.delete_doc("Pulse Department", dept_name, force=1, ignore_permissions=True)
		for user_email in self._created_users:
			if frappe.db.exists("User", user_email):
				frappe.delete_doc("User", user_email, force=1, ignore_permissions=True)
		frappe.set_user("Administrator")

	def _create_user(self, email: str, roles: list[str] | None = None) -> str:
		if not frappe.db.exists("User", email):
			user = frappe.get_doc({
				"doctype": "User",
				"email": email,
				"first_name": email.split("@")[0],
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}).insert(ignore_permissions=True)
		else:
			user = frappe.get_doc("User", email)
		if roles:
			user.add_roles(*roles)
		self._created_users.append(email)
		return email

	def test_admin_hierarchy_and_permissions(self):
		# Create users
		admin_user = self._create_user("admin@example.com", roles=["Pulse Admin"])
		manager_user = self._create_user("manager@example.com", roles=["Pulse Manager"])
		user_user = self._create_user("user@example.com", roles=["Pulse User"])
		
		# Test non-admin write is rejected
		frappe.set_user(user_user)
		with self.assertRaises(frappe.PermissionError):
			create_department("Sales", "Sales Department")
		
		with self.assertRaises(frappe.PermissionError):
			create_employee("Emp One", manager_user, "Supervisor")
			
		# Switch to Admin
		frappe.set_user(admin_user)
		
		# Create Department
		dept = create_department("Sales", "Sales Department")
		self._created_departments.append(dept.name)
		
		# Verify duplicate department rejected
		with self.assertRaises(frappe.ValidationError):
			create_department("Sales", "Another Sales")
			
		# Test list_unlinked_users
		unlinked = list_unlinked_users()
		unlinked_emails = [u["name"] for u in unlinked]
		self.assertIn(manager_user, unlinked_emails)
		self.assertIn(user_user, unlinked_emails)

		# Build 3-level hierarchy
		# Level 1: Admin reports to None
		emp_admin_doc = create_employee("Admin Staff", admin_user, "Executive", department="Sales")
		self._created_employees.append(emp_admin_doc.name)
		
		# Level 2: Manager reports to Admin
		emp_mgr_doc = create_employee("Manager Staff", manager_user, "Supervisor", reports_to=emp_admin_doc.name)
		self._created_employees.append(emp_mgr_doc.name)
		
		# Level 3: User reports to Manager
		emp_usr_doc = create_employee("User Staff", user_user, "Operator", reports_to=emp_mgr_doc.name)
		self._created_employees.append(emp_usr_doc.name)

		# Test duplicate user link is rejected
		another_user = self._create_user("another@example.com", roles=["Pulse User"])
		with self.assertRaises(frappe.ValidationError):
			# manager_user is already linked to emp_mgr_doc
			create_employee("Another Staff", manager_user, "Operator")
			
		with self.assertRaises(frappe.ValidationError):
			# Try to update another employee to use manager_user
			emp_another_doc = create_employee("Another Staff", another_user, "Operator")
			self._created_employees.append(emp_another_doc.name)
			update_employee(emp_another_doc.name, user=manager_user)
			
		# Test self-reporting is rejected
		with self.assertRaises(frappe.ValidationError):
			update_employee(emp_mgr_doc.name, reports_to=emp_mgr_doc.name)

		# Test reports_to cycle is rejected
		with self.assertRaises(frappe.ValidationError):
			# admin reports to manager (admin -> manager -> user -> admin is a cycle, but even admin -> manager when manager reports to admin is a cycle)
			update_employee(emp_admin_doc.name, reports_to=emp_mgr_doc.name)

		# Test non-admin read scope limiting
		# Pulse Manager should only see self and descendants (Manager Staff and User Staff), not Admin Staff
		frappe.set_user(manager_user)
		my_employees = list_employees()
		my_employee_names = [e["name"] for e in my_employees]
		self.assertIn(emp_mgr_doc.name, my_employee_names)
		self.assertIn(emp_usr_doc.name, my_employee_names)
		self.assertNotIn(emp_admin_doc.name, my_employee_names)
		
		# Test list_departments is scope-open
		depts = list_departments()
		self.assertIn("Sales", [d["department_name"] for d in depts])

	def test_deactivate_with_sop_runs(self):
		admin_user = self._create_user("admin2@example.com", roles=["Pulse Admin"])
		user_user = self._create_user("user2@example.com", roles=["Pulse User"])
		
		frappe.set_user(admin_user)
		emp = create_employee("User Staff Two", user_user, "Operator")
		self._created_employees.append(emp.name)
		
		# Create SOP Template (mock or actual doc)
		template_title = "Test Template"
		existing = frappe.get_all("SOP Template", filters={"title": template_title}, limit=1)
		if existing:
			template_name = existing[0].name
		else:
			template_doc = frappe.get_doc({
				"doctype": "SOP Template",
				"title": template_title,
				"frequency_type": "Daily",
				"active_from": "2026-01-01",
				"is_active": 1,
				"checklist_items": [
					{
						"description": "Check item",
						"sequence": 1,
						"weight": 1,
						"item_type": "Checkbox",
					}
				],
			}).insert(ignore_permissions=True)
			template_name = template_doc.name

		# Create SOP Run for the employee
		sop_run = frappe.get_doc({
			"doctype": "SOP Run",
			"template": template_name,
			"employee": emp.name,
			"period_date": "2026-08-26",
			"status": "Open",
			"run_items": []
		}).insert(ignore_permissions=True)
		self._created_sop_runs.append(sop_run.name)
		
		# Deactivate the employee
		deactivate_employee(emp.name)
		
		# Verify employee is inactive
		self.assertEqual(frappe.db.get_value("Pulse Employee", emp.name, "is_active"), 0)
		
		# Verify SOP Run still exists and has the correct employee reference intact
		self.assertTrue(frappe.db.exists("SOP Run", sop_run.name))
		self.assertEqual(frappe.db.get_value("SOP Run", sop_run.name, "employee"), emp.name)
