# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.api.scores import get_compliance_score


class TestComplianceScoreAPI(FrappeTestCase):
	"""API-layer tests for the run-level compliance score endpoints."""

	TEST_DATE = "2026-01-15"

	def setUp(self):
		from pulse.install import create_default_pulse_role_records, create_pulse_roles

		create_pulse_roles()
		create_default_pulse_role_records()

		self._created_users: list[str] = []
		self._created_employees: list[str] = []
		self._created_departments: list[str] = []
		self._created_templates: list[str] = []
		self._created_runs: list[str] = []

		self.template = self._create_template("Compliance Test Template")

	def tearDown(self):
		for run_name in self._created_runs:
			if frappe.db.exists("SOP Run", run_name):
				frappe.delete_doc("SOP Run", run_name, force=1, ignore_permissions=True)
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
	) -> str:
		emp = frappe.get_doc({
			"doctype": "Pulse Employee",
			"employee_name": name,
			"user": user,
			"pulse_role": pulse_role,
			"reports_to": reports_to,
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

	def _create_template(self, title: str) -> str:
		template = frappe.get_doc({
			"doctype": "SOP Template",
			"title": title,
			"frequency_type": "Daily",
			"active_from": "2026-01-01",
			"is_active": 1,
			"checklist_items": [
				{
					"description": "Test step",
					"sequence": 1,
					"weight": 1.0,
					"item_type": "Checkbox",
					"evidence_required": "None",
				}
			],
		}).insert(ignore_permissions=True)
		self._created_templates.append(template.name)
		return template.name

	def _create_run(
		self,
		employee: str,
		compliance_result: str,
		period_date: str | None = None,
		status: str = "Completed",
	) -> str:
		period_date = period_date or self.TEST_DATE
		item_status = "Completed" if compliance_result == "Passed" else "Missed"
		if compliance_result == "Pending":
			item_status = "Pending"

		run = frappe.get_doc({
			"doctype": "SOP Run",
			"template": self.template,
			"employee": employee,
			"period_date": period_date,
			"status": status,
			"due_at": f"{period_date} 23:59:59",
			"run_items": [
				{
					"checklist_item": "Test step",
					"item_type": "Checkbox",
					"status": item_status,
					"weight": 1.0,
				}
			],
		}).insert(ignore_permissions=True)

		if compliance_result in ("Passed", "Failed", "Pending"):
			frappe.db.set_value("SOP Run", run.name, "compliance_result", compliance_result)

		self._created_runs.append(run.name)
		return run.name

	def test_one_passed_and_one_failed_yields_score_half(self):
		"""One Passed + one Failed generated run in scope gives score 0.5."""
		user = self._create_user("scores.half@example.com", roles=["Pulse User"])
		emp = self._create_employee("Half Operator", user)
		self._create_run(emp, "Passed")
		self._create_run(emp, "Failed")

		result = get_compliance_score(emp, scope="personal", date=self.TEST_DATE)

		self.assertEqual(result["scope"], "personal")
		self.assertEqual(result["subject"], emp)
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["eligible_runs"], 2)
		self.assertEqual(result["score"], 0.5)

	def test_no_generated_run_does_not_reduce_score(self):
		"""An assignment without a generated SOP Run row yields score: null."""
		user = self._create_user("scores.nodata@example.com", roles=["Pulse User"])
		emp = self._create_employee("No Data Operator", user)

		result = get_compliance_score(emp, scope="personal", date=self.TEST_DATE)

		self.assertEqual(result["eligible_runs"], 0)
		self.assertIsNone(result["score"])

	def test_pending_run_before_deadline_does_not_reduce_score(self):
		"""A Pending generated run is excluded; other eligible runs determine score."""
		user = self._create_user("scores.pending@example.com", roles=["Pulse User"])
		emp = self._create_employee("Pending Operator", user)
		self._create_run(emp, "Passed")
		self._create_run(emp, "Pending", status="Open")

		result = get_compliance_score(emp, scope="personal", date=self.TEST_DATE)

		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["score"], 1.0)

	def test_failed_compliance_result_is_never_reclassified_as_passed(self):
		"""The API reports a stored Failed result regardless of other run state."""
		user = self._create_user("scores.failed@example.com", roles=["Pulse User"])
		emp = self._create_employee("Failed Operator", user)
		self._create_run(
			emp,
			"Failed",
			status="Completed",
		)

		result = get_compliance_score(emp, scope="personal", date=self.TEST_DATE)

		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["passed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["score"], 0.0)

	def test_inherited_score_is_run_weighted_across_descendants(self):
		"""Inherited scope aggregates all descendant runs, not per-person averages."""
		mgr_user = self._create_user("scores.mgr@example.com", roles=["Pulse Manager"])
		mgr = self._create_employee("Manager", mgr_user, pulse_role="Supervisor")

		op_a_user = self._create_user("scores.op.a@example.com", roles=["Pulse User"])
		op_a = self._create_employee("Operator A", op_a_user, reports_to=mgr)

		op_b_user = self._create_user("scores.op.b@example.com", roles=["Pulse User"])
		op_b = self._create_employee("Operator B", op_b_user, reports_to=mgr)

		self._create_run(op_a, "Passed")
		self._create_run(op_b, "Failed")

		result = get_compliance_score(mgr, scope="inherited", date=self.TEST_DATE)

		self.assertEqual(result["scope"], "inherited")
		self.assertEqual(result["subject"], mgr)
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["eligible_runs"], 2)
		self.assertEqual(result["score"], 0.5)

	def test_out_of_scope_failure_is_not_returned(self):
		"""A caller only sees runs belonging to employees in their hierarchy scope."""
		sibling_a_user = self._create_user("scores.sibling.a@example.com", roles=["Pulse User"])
		sibling_a = self._create_employee("Sibling A", sibling_a_user)

		sibling_b_user = self._create_user("scores.sibling.b@example.com", roles=["Pulse User"])
		sibling_b = self._create_employee("Sibling B", sibling_b_user)

		self._create_run(sibling_a, "Failed")
		frappe.set_user(sibling_b_user)

		result = get_compliance_score(sibling_a, scope="personal", date=self.TEST_DATE)

		self.assertEqual(result["eligible_runs"], 0)
		self.assertIsNone(result["score"])
