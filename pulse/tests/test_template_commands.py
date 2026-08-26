# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase
from pulse.api.templates import create_template, update_template


class TestTemplateCommands(FrappeTestCase):
	"""Tests for the SOP Template Command API."""

	def setUp(self):
		from pulse.install import create_default_pulse_role_records, create_pulse_roles

		create_pulse_roles()
		create_default_pulse_role_records()

		self._created_users = []
		self._created_templates = []
		self._created_employees = []
		self._created_sop_runs = []

		# Set user to Administrator for setup
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")
		for run_name in self._created_sop_runs:
			if frappe.db.exists("SOP Run", run_name):
				frappe.delete_doc("SOP Run", run_name, force=1, ignore_permissions=True)
		for t_name in self._created_templates:
			if frappe.db.exists("SOP Template", t_name):
				frappe.delete_doc("SOP Template", t_name, force=1, ignore_permissions=True)
		for emp_name in self._created_employees:
			if frappe.db.exists("Pulse Employee", emp_name):
				frappe.delete_doc("Pulse Employee", emp_name, force=1, ignore_permissions=True)
		for user_email in self._created_users:
			if frappe.db.exists("User", user_email):
				frappe.delete_doc("User", user_email, force=1, ignore_permissions=True)

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

	def test_template_creation_and_update(self):
		# Create users with different roles
		admin_user = self._create_user("admin_tmpl@example.com", roles=["Pulse Admin"])
		leader_user = self._create_user("leader_tmpl@example.com", roles=["Pulse Leader"])
		regular_user = self._create_user("user_tmpl@example.com", roles=["Pulse User"])

		# 1. Unauthorized Pulse User cannot call create_template
		frappe.set_user(regular_user)
		with self.assertRaises(frappe.PermissionError):
			create_template(
				title="Test Daily SOP",
				frequency_type="Daily",
				active_from="2026-08-26",
				local_start_time="09:00:00",
				completion_window_minutes=60,
				schedule_timezone="UTC",
				checklist_items=[{"description": "Task 1", "sequence": 1, "weight": 1.0, "item_type": "Checkbox"}]
			)

		# 2. Authorized Pulse Admin can create template
		frappe.set_user(admin_user)
		doc = create_template(
			title="Test Daily SOP Admin",
			frequency_type="Daily",
			active_from="2026-08-26",
			local_start_time="09:00:00",
			completion_window_minutes=60,
			schedule_timezone="UTC",
			checklist_items=[
				{"description": "Task 1", "sequence": 1, "weight": 1.0, "item_type": "Checkbox"},
				{"description": "Task 2", "sequence": 2, "weight": 2.0, "item_type": "Photo"}
			]
		)
		self.assertTrue(frappe.db.exists("SOP Template", doc.name))
		self._created_templates.append(doc.name)

		# Validate fields
		self.assertEqual(doc.title, "Test Daily SOP Admin")
		self.assertEqual(doc.completion_window_minutes, 60)
		self.assertEqual(doc.schedule_timezone, "UTC")
		self.assertEqual(len(doc.checklist_items), 2)

		# 3. Authorized Pulse Leader can update template
		frappe.set_user(leader_user)
		updated_doc = update_template(
			doc.name,
			title="Updated Daily SOP Leader",
			completion_window_minutes=120,
			checklist_items=[
				{"description": "Task 1 New", "sequence": 1, "weight": 1.5, "item_type": "Checkbox"}
			]
		)
		self.assertEqual(updated_doc.title, "Updated Daily SOP Leader")
		self.assertEqual(updated_doc.completion_window_minutes, 120)
		self.assertEqual(len(updated_doc.checklist_items), 1)

		# 4. Validation: Invalid completion_window_minutes (zero/negative)
		frappe.set_user(admin_user)
		with self.assertRaises(frappe.ValidationError):
			create_template(
				title="Invalid CW SOP",
				frequency_type="Daily",
				active_from="2026-08-26",
				local_start_time="09:00:00",
				completion_window_minutes=0,
				schedule_timezone="UTC",
				checklist_items=[{"description": "Task 1", "sequence": 1, "weight": 1.0, "item_type": "Checkbox"}]
			)

		with self.assertRaises(frappe.ValidationError):
			create_template(
				title="Invalid CW SOP 2",
				frequency_type="Daily",
				active_from="2026-08-26",
				local_start_time="09:00:00",
				completion_window_minutes=-10,
				schedule_timezone="UTC",
				checklist_items=[{"description": "Task 1", "sequence": 1, "weight": 1.0, "item_type": "Checkbox"}]
			)

		# 5. Validation: Invalid schedule_timezone (garbage string)
		with self.assertRaises(frappe.ValidationError):
			create_template(
				title="Invalid TZ SOP",
				frequency_type="Daily",
				active_from="2026-08-26",
				local_start_time="09:00:00",
				completion_window_minutes=60,
				schedule_timezone="Not/A/Timezone",
				checklist_items=[{"description": "Task 1", "sequence": 1, "weight": 1.0, "item_type": "Checkbox"}]
			)

		# 6. Validation: Empty checklist_items list is rejected
		with self.assertRaises(frappe.ValidationError):
			create_template(
				title="Empty Checklist SOP",
				frequency_type="Daily",
				active_from="2026-08-26",
				local_start_time="09:00:00",
				completion_window_minutes=60,
				schedule_timezone="UTC",
				checklist_items=[]
			)

		# 7. Unauthorised Pulse User cannot call update_template
		frappe.set_user(regular_user)
		with self.assertRaises(frappe.PermissionError):
			update_template(doc.name, title="Hack Attempt")

		# 8. Calling update_template on a template that has a generated SOP Run does not alter that run's data
		frappe.set_user(admin_user)
		
		# Create an employee for SOP Run context
		employee = frappe.get_doc({
			"doctype": "Pulse Employee",
			"employee_name": "Test Runner",
			"user": admin_user,
			"pulse_role": "Operator",
			"is_active": 1
		}).insert(ignore_permissions=True)
		self._created_employees.append(employee.name)

		# Create an SOP Run row referencing the template
		run_doc = frappe.get_doc({
			"doctype": "SOP Run",
			"template": doc.name,
			"employee": employee.name,
			"period_date": "2026-08-26",
			"status": "Open",
			"run_items": [
				{
					"checklist_item": "Test step",
					"weight": 1.0,
					"item_type": "Checkbox",
					"status": "Pending",
					"evidence_required": "None",
				}
			],
		}).insert(ignore_permissions=True)
		self._created_sop_runs.append(run_doc.name)

		# Update the template
		update_template(doc.name, title="Completely New Title", completion_window_minutes=180)

		# Assert the run row's own fields are untouched
		run_db_doc = frappe.get_doc("SOP Run", run_doc.name)
		self.assertEqual(run_db_doc.template, doc.name)
		# Verify snapshot/existing run data fields haven't changed/been mutated
		self.assertEqual(run_db_doc.period_date, "2026-08-26")
		self.assertEqual(run_db_doc.status, "Open")
