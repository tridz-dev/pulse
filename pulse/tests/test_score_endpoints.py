# Copyright (c) 2026, Tridz and contributors
# License: MIT

import datetime
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


class TestScoreEndpointScope(FrappeTestCase):
    """API-layer tests for personal versus inherited score scope.

    Covers the S2-T02 done checks:
    - a manager can see inherited score for their subtree;
    - the same manager can explicitly request personal score;
    - the response shape does not expose ``combined_score`` as the primary number.
    """

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

        self.template = self._create_template("Scope Test Template")

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

    def _assert_compliance_contract(self, result: dict, expected_scope: str, subject: str):
        """Assert the response matches the first-milestone score contract."""
        self.assertEqual(result["scope"], expected_scope)
        self.assertEqual(result["subject"], subject)
        self.assertIn("score", result)
        self.assertIn("passed_runs", result)
        self.assertIn("failed_runs", result)
        self.assertIn("eligible_runs", result)
        self.assertIn("period", result)
        self.assertIn(result["score"] is None or 0.0 <= result["score"] <= 1.0, [True])
        # combined_score must not be the primary/default number in the new contract.
        self.assertNotIn("combined_score", result)

    def test_manager_can_see_inherited_score_for_subtree(self):
        """A manager's inherited scope aggregates all descendant runs."""
        mgr_user = self._create_user("scope.mgr@example.com", roles=["Pulse Manager"])
        mgr = self._create_employee("Scope Manager", mgr_user, pulse_role="Supervisor")

        op_a_user = self._create_user("scope.op.a@example.com", roles=["Pulse User"])
        op_a = self._create_employee("Scope Operator A", op_a_user, reports_to=mgr)

        op_b_user = self._create_user("scope.op.b@example.com", roles=["Pulse User"])
        op_b = self._create_employee("Scope Operator B", op_b_user, reports_to=mgr)

        self._create_run(op_a, "Passed")
        self._create_run(op_b, "Failed")

        frappe.set_user(mgr_user)
        result = get_compliance_score(mgr, scope="inherited", date=self.TEST_DATE)

        self._assert_compliance_contract(result, "inherited", mgr)
        self.assertEqual(result["passed_runs"], 1)
        self.assertEqual(result["failed_runs"], 1)
        self.assertEqual(result["eligible_runs"], 2)
        self.assertEqual(result["score"], 0.5)

    def test_manager_can_toggle_between_personal_and_inherited_score(self):
        """The same manager can request personal or inherited and get distinct, scoped results."""
        mgr_user = self._create_user("scope.toggle.mgr@example.com", roles=["Pulse Manager"])
        mgr = self._create_employee("Toggle Manager", mgr_user, pulse_role="Supervisor")

        op_user = self._create_user("scope.toggle.op@example.com", roles=["Pulse User"])
        op = self._create_employee("Toggle Operator", op_user, reports_to=mgr)

        self._create_run(mgr, "Passed")
        self._create_run(op, "Failed")

        frappe.set_user(mgr_user)

        personal = get_compliance_score(mgr, scope="personal", date=self.TEST_DATE)
        self._assert_compliance_contract(personal, "personal", mgr)
        self.assertEqual(personal["passed_runs"], 1)
        self.assertEqual(personal["failed_runs"], 0)
        self.assertEqual(personal["eligible_runs"], 1)
        self.assertEqual(personal["score"], 1.0)

        inherited = get_compliance_score(mgr, scope="inherited", date=self.TEST_DATE)
        self._assert_compliance_contract(inherited, "inherited", mgr)
        self.assertEqual(inherited["passed_runs"], 0)
        self.assertEqual(inherited["failed_runs"], 1)
        self.assertEqual(inherited["eligible_runs"], 1)
        self.assertEqual(inherited["score"], 0.0)

    def test_compliance_response_does_not_expose_combined_score(self):
        """The explicit contract uses ``score``; ``combined_score`` is not the primary field."""
        mgr_user = self._create_user("scope.shape.mgr@example.com", roles=["Pulse Manager"])
        mgr = self._create_employee("Shape Manager", mgr_user, pulse_role="Supervisor")

        op_user = self._create_user("scope.shape.op@example.com", roles=["Pulse User"])
        op = self._create_employee("Shape Operator", op_user, reports_to=mgr)

        self._create_run(op, "Passed")

        frappe.set_user(mgr_user)
        result = get_compliance_score(mgr, scope="inherited", date=self.TEST_DATE)

        self._assert_compliance_contract(result, "inherited", mgr)
        # Ensure no legacy combined alias exists either.
        for forbidden_key in ("combined_score", "combinedScore", "own_score", "team_score"):
            self.assertNotIn(forbidden_key, result)
        self.assertEqual(result["score"], 1.0)
