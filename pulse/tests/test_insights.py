# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.api.insights import get_score_trends


class TestScoreTrends(FrappeTestCase):
    """Tests for the S3-T02 done checks on get_score_trends.

    Covers:
    - Day/Week/Month/Custom period_type all return a sane, non-crashing,
      correctly-scoped result over the same underlying run fixtures;
    - the score denominator for a bucket follows GENERATED runs due in that
      bucket specifically, so a bucket with no generated runs reports zero
      eligible runs / a null score rather than treating it as a failure.
    """

    PERIOD_A_DAY = "2026-02-02"
    PERIOD_B_DAY = "2026-02-09"

    def setUp(self):
        from pulse.install import create_default_pulse_role_records, create_pulse_roles

        create_pulse_roles()
        create_default_pulse_role_records()

        self._created_users: list[str] = []
        self._created_employees: list[str] = []
        self._created_templates: list[str] = []
        self._created_runs: list[str] = []

        self.employee = self._create_employee("Trend Operator", "trend.operator@example.com")
        self.template = self._create_template("Trend Test Template")

        self._create_run(self.employee, "Passed", due_at=f"{self.PERIOD_A_DAY} 09:00:00")
        self._create_run(self.employee, "Failed", due_at=f"{self.PERIOD_A_DAY} 15:00:00")
        # Period B has no generated runs at all — must not read as a failure.

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
        frappe.set_user("Administrator")

    def _create_user(self, email: str) -> str:
        if not frappe.db.exists("User", email):
            frappe.get_doc({
                "doctype": "User",
                "email": email,
                "first_name": email.split("@")[0],
                "enabled": 1,
                "user_type": "System User",
                "send_welcome_email": 0,
            }).insert(ignore_permissions=True)
        self._created_users.append(email)
        return email

    def _create_employee(self, name: str, email: str) -> str:
        user = self._create_user(email)
        emp = frappe.get_doc(
            {
                "doctype": "Pulse Employee",
                "employee_name": name,
                "user": user,
                "pulse_role": "Operator",
                "is_active": 1,
            }
        ).insert(ignore_permissions=True)
        self._created_employees.append(emp.name)
        return emp.name

    def _create_template(self, title: str) -> str:
        template = frappe.get_doc(
            {
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
            }
        ).insert(ignore_permissions=True)
        self._created_templates.append(template.name)
        return template.name

    def _create_run(self, employee: str, compliance_result: str, due_at: str) -> str:
        period_date = due_at.split(" ")[0]
        item_status = "Completed" if compliance_result == "Passed" else "Missed"
        run = frappe.get_doc(
            {
                "doctype": "SOP Run",
                "template": self.template,
                "employee": employee,
                "period_date": period_date,
                "status": "Completed",
                "due_at": due_at,
                "run_items": [
                    {
                        "checklist_item": "Test step",
                        "item_type": "Checkbox",
                        "status": item_status,
                        "weight": 1.0,
                    }
                ],
            }
        ).insert(ignore_permissions=True)
        frappe.db.set_value("SOP Run", run.name, "compliance_result", compliance_result)
        self._created_runs.append(run.name)
        return run.name

    def test_supports_all_period_types_over_same_fixtures(self):
        frappe.set_user("Administrator")
        for period_type in ("Day", "Week", "Month", "Custom"):
            result = get_score_trends(
                start_date=self.PERIOD_A_DAY,
                end_date=self.PERIOD_B_DAY,
                period_type=period_type,
                employee=self.employee,
            )
            self.assertIsInstance(result, list)
            self.assertGreater(len(result), 0)
            for point in result:
                self.assertIn("date", point)
                self.assertIn("avg_score", point)
                self.assertIn("eligible_runs", point)
                self.assertIn("passed_runs", point)
                self.assertIn("failed_runs", point)
                self.assertIn("employee_count", point)
                if point["avg_score"] is not None:
                    self.assertGreaterEqual(point["avg_score"], 0.0)
                    self.assertLessEqual(point["avg_score"], 1.0)

    def test_score_denominator_follows_generated_runs_per_bucket(self):
        frappe.set_user("Administrator")
        result = get_score_trends(
            start_date=self.PERIOD_A_DAY,
            end_date=self.PERIOD_B_DAY,
            period_type="Day",
            employee=self.employee,
        )
        by_date = {point["date"]: point for point in result}

        period_a = by_date[self.PERIOD_A_DAY]
        self.assertEqual(period_a["eligible_runs"], 2)
        self.assertEqual(period_a["passed_runs"], 1)
        self.assertEqual(period_a["failed_runs"], 1)
        self.assertEqual(period_a["avg_score"], 0.5)

        period_b = by_date[self.PERIOD_B_DAY]
        self.assertEqual(period_b["eligible_runs"], 0)
        self.assertEqual(period_b["passed_runs"], 0)
        self.assertEqual(period_b["failed_runs"], 0)
        self.assertIsNone(period_b["avg_score"])
