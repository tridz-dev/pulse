# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.api.scores import get_compliance_score


class TestScoreRollup(FrappeTestCase):
	"""Tests for correctness of multi-level hierarchy compliance score roll-up."""

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

		self.template = self._create_template("Rollup Test Template")

		# Create hierarchy: Executive -> Area Manager -> Supervisor -> Operator(s)
		self.exec_user = self._create_user("exec@example.com", roles=["Pulse Executive"])
		self.exec_emp = self._create_employee("Executive Manager", self.exec_user, pulse_role="Executive")

		self.am_user = self._create_user("am@example.com", roles=["Pulse Leader"])
		self.am_emp = self._create_employee("Area Manager", self.am_user, pulse_role="Area Manager", reports_to=self.exec_emp)

		self.sup_user = self._create_user("sup@example.com", roles=["Pulse Manager"])
		self.sup_emp = self._create_employee("Supervisor", self.sup_user, pulse_role="Supervisor", reports_to=self.am_emp)

		self.op_a_user = self._create_user("op_a@example.com", roles=["Pulse User"])
		self.op_a_emp = self._create_employee("Operator A", self.op_a_user, pulse_role="Operator", reports_to=self.sup_emp)

		self.op_b_user = self._create_user("op_b@example.com", roles=["Pulse User"])
		self.op_b_emp = self._create_employee("Operator B", self.op_b_user, pulse_role="Operator", reports_to=self.sup_emp)

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

	def test_missed_operator_run_lowers_supervisor_inherited_score(self):
		"""Create one Failed run and one Passed run for Operators; Supervisor inherited score is 0.5."""
		self._create_run(self.op_a_emp, "Passed")
		self._create_run(self.op_b_emp, "Failed")

		frappe.set_user(self.sup_user)
		result = get_compliance_score(self.sup_emp, scope="inherited", date=self.TEST_DATE)

		self.assertEqual(result["scope"], "inherited")
		self.assertEqual(result["subject"], self.sup_emp)
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["eligible_runs"], 2)
		self.assertEqual(result["score"], 0.5)

	def test_same_missed_run_contributes_upward_to_higher_managers(self):
		"""A failed Operator run rolls up to Supervisor, Area Manager, and Executive."""
		self._create_run(self.op_a_emp, "Passed")
		self._create_run(self.op_b_emp, "Failed")  # The same missed run
		self._create_run(self.sup_emp, "Passed")
		self._create_run(self.am_emp, "Passed")

		# 1. Supervisor's inherited runs: Operator A (Passed), Operator B (Failed)
		frappe.set_user(self.sup_user)
		sup_res = get_compliance_score(self.sup_emp, scope="inherited", date=self.TEST_DATE)
		self.assertEqual(sup_res["eligible_runs"], 2)
		self.assertEqual(sup_res["passed_runs"], 1)
		self.assertEqual(sup_res["failed_runs"], 1)
		self.assertEqual(sup_res["score"], 0.5)

		# 2. Area Manager's inherited runs: Supervisor (Passed), Operator A (Passed), Operator B (Failed)
		frappe.set_user(self.am_user)
		am_res = get_compliance_score(self.am_emp, scope="inherited", date=self.TEST_DATE)
		self.assertEqual(am_res["eligible_runs"], 3)
		self.assertEqual(am_res["passed_runs"], 2)
		self.assertEqual(am_res["failed_runs"], 1)
		self.assertAlmostEqual(am_res["score"], 2.0 / 3.0)

		# 3. Executive's inherited runs: Area Manager (Passed), Supervisor (Passed), Operator A (Passed), Operator B (Failed)
		frappe.set_user(self.exec_user)
		exec_res = get_compliance_score(self.exec_emp, scope="inherited", date=self.TEST_DATE)
		self.assertEqual(exec_res["eligible_runs"], 4)
		self.assertEqual(exec_res["passed_runs"], 3)
		self.assertEqual(exec_res["failed_runs"], 1)
		self.assertEqual(exec_res["score"], 0.75)

	def test_manager_with_no_own_runs_still_has_inherited_score(self):
		"""A manager with no personal runs still gets a valid inherited score representing descendants."""
		self._create_run(self.op_a_emp, "Passed")

		frappe.set_user(self.sup_user)

		# Personal score is None / no eligible runs
		personal_res = get_compliance_score(self.sup_emp, scope="personal", date=self.TEST_DATE)
		self.assertEqual(personal_res["eligible_runs"], 0)
		self.assertIsNone(personal_res["score"])

		# Inherited score is 1.0 (from Operator A)
		inherited_res = get_compliance_score(self.sup_emp, scope="inherited", date=self.TEST_DATE)
		self.assertEqual(inherited_res["eligible_runs"], 1)
		self.assertEqual(inherited_res["passed_runs"], 1)
		self.assertEqual(inherited_res["score"], 1.0)

	def test_descendants_with_no_eligible_runs_do_not_lower_score(self):
		"""Descendant with no runs or only Pending runs is excluded from denominator, not treated as Failed."""
		self._create_run(self.op_a_emp, "Passed")
		# op_b_emp has no runs at all

		# Create a third operator op_c under supervisor with a Pending run
		op_c_user = self._create_user("op_c@example.com", roles=["Pulse User"])
		op_c_emp = self._create_employee("Operator C", op_c_user, pulse_role="Operator", reports_to=self.sup_emp)
		self._create_run(op_c_emp, "Pending", status="Open")

		frappe.set_user(self.sup_user)
		result = get_compliance_score(self.sup_emp, scope="inherited", date=self.TEST_DATE)

		# Only Operator A's Passed run should be eligible.
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 0)
		self.assertEqual(result["score"], 1.0)
