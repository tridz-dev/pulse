# Copyright (c) 2026, Tridz and contributors
# License: MIT

import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.tasks import generate_daily_runs


class TestRunGeneration(FrappeTestCase):
	"""Integration tests for idempotent scheduled SOP Run generation."""

	FIXED_NOW = datetime.datetime(2026, 1, 15, 8, 0, 0, tzinfo=ZoneInfo("UTC"))

	def setUp(self):
		from pulse.install import create_default_pulse_role_records, create_pulse_roles

		create_pulse_roles()
		create_default_pulse_role_records()

		self._created_users: list[str] = []
		self._created_employees: list[str] = []
		self._created_departments: list[str] = []
		self._created_templates: list[str] = []
		self._created_assignments: list[str] = []
		self._created_runs: list[str] = []

	def tearDown(self):
		for run_name in self._created_runs:
			if frappe.db.exists("SOP Run", run_name):
				frappe.delete_doc("SOP Run", run_name, force=1, ignore_permissions=True)
		for assignment_name in self._created_assignments:
			if frappe.db.exists("SOP Assignment", assignment_name):
				frappe.delete_doc("SOP Assignment", assignment_name, force=1, ignore_permissions=True)
		for template_name in self._created_templates:
			if frappe.db.exists("SOP Template", template_name):
				frappe.delete_doc("SOP Template", template_name, force=1, ignore_permissions=True)
		for emp_name in self._created_employees:
			if frappe.db.exists("Pulse Employee", emp_name):
				frappe.delete_doc("Pulse Employee", emp_name, force=1, ignore_permissions=True)
		for user_email in self._created_users:
			if frappe.db.exists("User", user_email):
				frappe.delete_doc("User", user_email, force=1, ignore_permissions=True)
		for dept_name in self._created_departments:
			if frappe.db.exists("Pulse Department", dept_name):
				frappe.delete_doc("Pulse Department", dept_name, force=1, ignore_permissions=True)
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

	def _create_employee(
		self,
		name: str,
		user: str,
		pulse_role: str = "Operator",
		reports_to: str | None = None,
		department: str | None = None,
		branch: str | None = None,
	) -> str:
		emp = frappe.get_doc({
			"doctype": "Pulse Employee",
			"employee_name": name,
			"user": user,
			"pulse_role": pulse_role,
			"reports_to": reports_to,
			"department": department,
			"branch": branch,
			"is_active": 1,
		}).insert(ignore_permissions=True)
		self._created_employees.append(emp.name)
		return emp.name

	def _create_department(self, name: str) -> str:
		dept = frappe.get_doc({
			"doctype": "Pulse Department",
			"department_name": name,
			"is_active": 1,
		}).insert(ignore_permissions=True)
		self._created_departments.append(dept.name)
		return dept.name

	def _create_template(
		self,
		title: str,
		frequency_type: str = "Daily",
		**kwargs,
	) -> str:
		doc = {
			"doctype": "SOP Template",
			"title": title,
			"frequency_type": frequency_type,
			"active_from": kwargs.get("active_from", "2026-01-01"),
			"is_active": 1,
			"schedule_timezone": kwargs.get("schedule_timezone", "UTC"),
			"local_start_time": kwargs.get("local_start_time", "07:00:00"),
			"completion_window_minutes": kwargs.get("completion_window_minutes", 60),
			"checklist_items": kwargs.get("checklist_items", [
				{
					"description": "Test step",
					"sequence": 1,
					"weight": 1.0,
					"item_type": "Checkbox",
					"evidence_required": "None",
				}
			]),
		}
		template = frappe.get_doc(doc).insert(ignore_permissions=True)
		self._created_templates.append(template.name)
		return template.name

	def _create_assignment(
		self,
		template: str,
		employee: str,
		**kwargs,
	) -> str:
		assignment = frappe.get_doc({
			"doctype": "SOP Assignment",
			"template": template,
			"employee": employee,
			"is_active": 1,
			"schedule_timezone_override": kwargs.get("schedule_timezone_override"),
			"local_start_time_override": kwargs.get("local_start_time_override"),
			"completion_window_minutes_override": kwargs.get("completion_window_minutes_override"),
		}).insert(ignore_permissions=True)
		self._created_assignments.append(assignment.name)
		return assignment.name

	def test_running_generator_twice_creates_one_run(self):
		"""Generation for the same assignment+window is idempotent."""
		user = self._create_user("gen.once@example.com", roles=["Pulse User"])
		emp = self._create_employee("Generator Once", user)
		template = self._create_template("Generator Once Template")
		assignment = self._create_assignment(template, emp)

		with patch("pulse.tasks.now_datetime", return_value=self.FIXED_NOW):
			generate_daily_runs()
			run_names = frappe.get_all(
				"SOP Run",
				filters={"assignment": assignment},
				pluck="name",
			)
			self.assertEqual(len(run_names), 1)
			self._created_runs.extend(run_names)

			generate_daily_runs()
			run_names = frappe.get_all(
				"SOP Run",
				filters={"assignment": assignment},
				pluck="name",
			)
			self.assertEqual(len(run_names), 1)

	def test_two_assignments_same_employee_template_create_distinct_runs(self):
		"""Two SOP Assignments for the same employee+template each get their own run."""
		user = self._create_user("gen.twice@example.com", roles=["Pulse User"])
		emp = self._create_employee("Generator Twice", user)
		template = self._create_template("Generator Twice Template")
		assignment_a = self._create_assignment(template, emp)
		# A second assignment for the same employee+template must have a
		# deliberately different override to coexist (SOP Assignment's
		# uniqueness guard rejects an identical-override duplicate). Override
		# only the completion window, not the start time, so assignment_b's
		# window is still open (not merely scheduled for later) at the
		# fixed evaluation instant used below.
		assignment_b = self._create_assignment(
			template, emp, completion_window_minutes_override=120
		)

		with patch("pulse.tasks.now_datetime", return_value=self.FIXED_NOW):
			generate_daily_runs()

		runs = frappe.get_all(
			"SOP Run",
			filters={"assignment": ["in", [assignment_a, assignment_b]]},
			fields=["name", "run_key", "assignment"],
		)
		self.assertEqual(len(runs), 2)
		self._created_runs.extend([r.name for r in runs])

		keys = {r.run_key for r in runs}
		self.assertEqual(len(keys), 2)
		self.assertCountEqual(
			[r.assignment for r in runs],
			[assignment_a, assignment_b],
		)
