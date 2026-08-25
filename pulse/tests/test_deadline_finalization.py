# Copyright (c) 2026, Tridz and contributors
# License: MIT

import datetime
import uuid

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.tasks import finalize_overdue_runs


class TestDeadlineFinalization(FrappeTestCase):
    """Integration tests for idempotent deadline finalization of SOP Runs."""

    FIXED_NOW = datetime.datetime(2026, 1, 15, 8, 0, 0)

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
        department: str | None = None,
        branch: str | None = None,
    ) -> str:
        emp = frappe.get_doc({
            "doctype": "Pulse Employee",
            "employee_name": name,
            "user": user,
            "pulse_role": pulse_role,
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

    def _create_template(self, title: str) -> str:
        template = frappe.get_doc({
            "doctype": "SOP Template",
            "title": title,
            "frequency_type": "Daily",
            "active_from": "2026-01-01",
            "is_active": 1,
            "schedule_timezone": "UTC",
            "local_start_time": "07:00:00",
            "completion_window_minutes": 60,
            "checklist_items": [
                {
                    "description": "Test step one",
                    "weight": 1.0,
                    "item_type": "Checkbox",
                    "evidence_required": "None",
                },
                {
                    "description": "Test step two",
                    "weight": 1.0,
                    "item_type": "Checkbox",
                    "evidence_required": "None",
                },
            ],
        }).insert(ignore_permissions=True)
        self._created_templates.append(template.name)
        return template.name

    def _create_assignment(self, template: str, employee: str) -> str:
        assignment = frappe.get_doc({
            "doctype": "SOP Assignment",
            "template": template,
            "employee": employee,
            "is_active": 1,
        }).insert(ignore_permissions=True)
        self._created_assignments.append(assignment.name)
        return assignment.name

    def _create_run(
        self,
        assignment,
        due_at: datetime.datetime,
        compliance_result: str = "Pending",
        status: str = "Open",
        completed_at: datetime.datetime | None = None,
        run_item_status: str = "Pending",
    ) -> str:
        unique = uuid.uuid4().hex
        run = frappe.get_doc({
            "doctype": "SOP Run",
            "template": assignment.template,
            "employee": assignment.employee,
            "period_date": due_at.date(),
            "status": status,
            "compliance_result": compliance_result,
            "completed_at": completed_at,
            "assignment": assignment.name,
            "schedule_key": f"test-key-{unique}",
            "run_key": f"test-run-key-{unique}",
            "opens_at": due_at - datetime.timedelta(hours=1),
            "due_at": due_at,
            "effective_timezone": "UTC",
            "template_title_snapshot": "Test Template",
            "template_modified_snapshot": due_at,
            "employee_name_snapshot": "Test Employee",
            "manager_path_snapshot": "[]",
            "department_snapshot": "Test Department",
            "branch_snapshot": "HQ",
            "frequency_snapshot": "Daily",
            "completion_window_minutes_snapshot": 60,
            "snapshot_is_complete": 1,
            "run_items": [
                {
                    "checklist_item": "Test step one",
                    "weight": 1.0,
                    "item_type": "Checkbox",
                    "status": run_item_status,
                    "evidence_required": "None",
                },
                {
                    "checklist_item": "Test step two",
                    "weight": 1.0,
                    "item_type": "Checkbox",
                    "status": run_item_status,
                    "evidence_required": "None",
                },
            ],
        }).insert(ignore_permissions=True)
        self._created_runs.append(run.name)
        return run.name

    def _capture_run_state(self, run_name: str) -> dict:
        """Return a comparable dict of the run's meaningful domain state."""
        run = frappe.get_doc("SOP Run", run_name)
        return {
            "status": run.status,
            "compliance_result": run.compliance_result,
            "completed_at": run.completed_at,
            "closed_at": run.closed_at,
            "due_at": run.due_at,
            "total_items": run.total_items,
            "completed_items": run.completed_items,
            "progress": run.progress,
            "items": [
                {"status": row.status, "completed_at": row.completed_at}
                for row in run.run_items
            ],
        }

    def _setup_fixtures(self):
        """Create a reusable employee, template, and assignment."""
        dept = self._create_department("Deadline Test Department")
        user = self._create_user("deadline.test@example.com", roles=["Pulse User"])
        emp = self._create_employee("Deadline Test Employee", user, department=dept)
        template = self._create_template("Deadline Test Template")
        assignment = self._create_assignment(template, emp)
        return assignment

    def test_future_due_at_remains_pending(self):
        """A Pending run whose due_at is still in the future is not finalized."""
        assignment = self._setup_fixtures()
        due_at = self.FIXED_NOW + datetime.timedelta(minutes=1)
        run_name = self._create_run(assignment, due_at)

        finalize_overdue_runs(evaluation_instant=self.FIXED_NOW)

        run = frappe.get_doc("SOP Run", run_name)
        self.assertEqual(run.compliance_result, "Pending")
        self.assertEqual(run.status, "Open")
        for row in run.run_items:
            self.assertEqual(row.status, "Pending")

    def test_past_due_at_becomes_failed_and_locked(self):
        """A Pending run at or past its due_at becomes Failed+Locked, items Missed."""
        assignment = self._setup_fixtures()
        due_at = self.FIXED_NOW
        run_name = self._create_run(assignment, due_at)

        finalize_overdue_runs(evaluation_instant=self.FIXED_NOW)

        run = frappe.get_doc("SOP Run", run_name)
        self.assertEqual(run.compliance_result, "Failed")
        self.assertEqual(run.status, "Locked")
        self.assertIsNone(run.completed_at)
        for row in run.run_items:
            self.assertEqual(row.status, "Missed")

    def test_already_passed_and_failed_runs_unchanged(self):
        """Passed and Failed runs are left completely untouched by the finalizer."""
        assignment = self._setup_fixtures()
        due_at = self.FIXED_NOW - datetime.timedelta(minutes=5)

        passed_name = self._create_run(
            assignment,
            due_at,
            compliance_result="Passed",
            status="Completed",
            completed_at=due_at - datetime.timedelta(minutes=1),
            run_item_status="Completed",
        )
        failed_name = self._create_run(
            assignment,
            due_at,
            compliance_result="Failed",
            status="Locked",
            run_item_status="Missed",
        )

        passed_before = self._capture_run_state(passed_name)
        failed_before = self._capture_run_state(failed_name)

        finalize_overdue_runs(evaluation_instant=self.FIXED_NOW)

        passed_after = self._capture_run_state(passed_name)
        failed_after = self._capture_run_state(failed_name)

        self.assertEqual(passed_after, passed_before)
        self.assertEqual(failed_after, failed_before)

    def test_finalize_overdue_runs_is_idempotent(self):
        """Running the finalizer twice on an overdue run yields the same result."""
        assignment = self._setup_fixtures()
        due_at = self.FIXED_NOW - datetime.timedelta(minutes=5)
        run_name = self._create_run(assignment, due_at)

        finalize_overdue_runs(evaluation_instant=self.FIXED_NOW)
        first_state = self._capture_run_state(run_name)

        finalize_overdue_runs(evaluation_instant=self.FIXED_NOW)
        second_state = self._capture_run_state(run_name)

        self.assertEqual(second_state, first_state)
        self.assertEqual(second_state["compliance_result"], "Failed")
        self.assertEqual(second_state["status"], "Locked")
        for item in second_state["items"]:
            self.assertEqual(item["status"], "Missed")
