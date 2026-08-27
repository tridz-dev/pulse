# Copyright (c) 2026, Tridz and contributors
# License: MIT

import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import get_system_timezone

from pulse.api.scores import get_compliance_score


def _local_end_of_day_to_utc(period_date: str) -> str:
	"""Convert the site-local end of ``period_date`` to a naive UTC string.

	Mirrors how ``pulse.domain.scheduling.resolve_schedule`` freezes ``due_at``:
	a local wall-clock instant converted to naive UTC, not a naive string
	written as if it were already UTC.
	"""
	tz = ZoneInfo(get_system_timezone())
	local_dt = datetime.datetime.strptime(f"{period_date} 23:59:59", "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz)
	return local_dt.astimezone(ZoneInfo("UTC")).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


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
			"due_at": _local_end_of_day_to_utc(period_date),
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

		# TEST_DATE is a fixed historical calendar date, but the endpoint always
		# derives Pending-vs-Failed against the real wall-clock instant. Freeze
		# the evaluation instant to a point on TEST_DATE that is still before
		# the Pending run's due_at (end of TEST_DATE) so the assertion actually
		# exercises "before deadline" rather than being at the mercy of the
		# real current date.
		with patch(
			"pulse.api.scores.now_datetime",
			return_value=datetime.datetime.strptime(f"{self.TEST_DATE} 09:00:00", "%Y-%m-%d %H:%M:%S"),
		):
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


class TestEvidenceRequirement(FrappeTestCase):
	"""Tests for evidence-required guard clause in complete_run."""

	TEST_DATE = "2026-01-20"

	def setUp(self):
		from pulse.install import create_default_pulse_role_records, create_pulse_roles

		create_pulse_roles()
		create_default_pulse_role_records()

		self._created_users: list[str] = []
		self._created_employees: list[str] = []
		self._created_departments: list[str] = []
		self._created_templates: list[str] = []
		self._created_runs: list[str] = []

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

	def _create_template_with_evidence_required(self, title: str) -> str:
		"""Create a template with one checklist item requiring evidence (Photo)."""
		template = frappe.get_doc({
			"doctype": "SOP Template",
			"title": title,
			"frequency_type": "Daily",
			"active_from": "2026-01-01",
			"is_active": 1,
			"checklist_items": [
				{
					"description": "Task requiring photo evidence",
					"sequence": 1,
					"weight": 1.0,
					"item_type": "Checkbox",
					"evidence_required": "Photo",
				}
			],
		}).insert(ignore_permissions=True)
		self._created_templates.append(template.name)
		return template.name

	def _create_run_with_evidence_required(
		self,
		employee: str,
		template: str,
		item_status: str = "Completed",
		evidence: str | None = None,
	) -> str:
		"""Create a SOP Run with one item requiring evidence."""
		run = frappe.get_doc({
			"doctype": "SOP Run",
			"template": template,
			"employee": employee,
			"period_date": self.TEST_DATE,
			"status": "In Progress",
			"due_at": f"{self.TEST_DATE} 23:59:59",
			"run_items": [
				{
					"checklist_item": "Task requiring photo evidence",
					"item_type": "Checkbox",
					"status": item_status,
					"weight": 1.0,
					"evidence_required": "Photo",
					"evidence": evidence,
				}
			],
		}).insert(ignore_permissions=True)
		self._created_runs.append(run.name)
		return run.name

	def test_complete_run_fails_when_evidence_required_but_missing(self):
		"""complete_run() raises when a required-evidence item lacks evidence."""
		from pulse.api.tasks import complete_run
		from frappe.exceptions import ValidationError

		user = self._create_user("evidence.required@example.com", roles=["Pulse User"])
		emp = self._create_employee("Evidence Required Operator", user)
		template = self._create_template_with_evidence_required("Evidence Test Template")

		# Create run with completed item but NO evidence
		run_name = self._create_run_with_evidence_required(
			employee=emp,
			template=template,
			item_status="Completed",
			evidence=None,  # Missing evidence
		)

		frappe.set_user(user)

		# Should raise ValidationError because evidence is required but not provided
		self.assertRaises(
			ValidationError,
			complete_run,
			run_name
		)

	def test_complete_run_succeeds_when_evidence_provided(self):
		"""complete_run() succeeds when required-evidence item has evidence."""
		from pulse.api.tasks import complete_run

		user = self._create_user("evidence.provided@example.com", roles=["Pulse User"])
		emp = self._create_employee("Evidence Provided Operator", user)
		template = self._create_template_with_evidence_required("Evidence Test Template 2")

		# Create run with completed item AND evidence
		run_name = self._create_run_with_evidence_required(
			employee=emp,
			template=template,
			item_status="Completed",
			evidence="/private/files/sample-evidence.jpg",  # Evidence is provided
		)

		frappe.set_user(user)

		# Should succeed because evidence is provided
		result = complete_run(run_name)

		self.assertEqual(result["status"], "Completed")
		self.assertIn(result["compliance_result"], ["Passed", "Failed"])
