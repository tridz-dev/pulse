# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.api.operations import get_failure_list


class TestFailureList(FrappeTestCase):
    """API-layer tests for the S3-T01 scoped failure list.

    Covers the done checks:
    - a Failed run for an in-scope employee appears in the manager's failure list;
    - a Failed run for an out-of-scope employee (sibling manager's subtree) does not appear;
    - pagination applied after scope produces deterministic, correctly-scoped pages.
    """

    START_DATE = "2026-01-01"
    END_DATE = "2026-01-31"

    def setUp(self):
        from pulse.install import create_default_pulse_role_records, create_pulse_roles

        create_pulse_roles()
        create_default_pulse_role_records()

        self._created_users: list[str] = []
        self._created_employees: list[str] = []
        self._created_templates: list[str] = []
        self._created_runs: list[str] = []

        self.template = self._create_template("Failure List Test Template")

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
        due_at: str,
        status: str = "Completed",
    ) -> str:
        item_status = "Completed" if compliance_result == "Passed" else "Missed"
        if compliance_result == "Pending":
            item_status = "Pending"

        run = frappe.get_doc({
            "doctype": "SOP Run",
            "template": self.template,
            "employee": employee,
            "period_date": due_at[:10],
            "status": status,
            "due_at": due_at,
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

    def test_in_scope_failed_run_appears_in_failure_list(self):
        """A Failed run for an in-scope employee shows up in the manager's failure list."""
        mgr_user = self._create_user("failure.mgr@example.com", roles=["Pulse Manager"])
        mgr = self._create_employee("Failure Manager", mgr_user, pulse_role="Supervisor")

        op_user = self._create_user("failure.op@example.com", roles=["Pulse User"])
        op = self._create_employee("Failure Operator", op_user, reports_to=mgr)

        run_name = self._create_run(op, "Failed", "2026-01-15 23:59:59")

        frappe.set_user(mgr_user)
        result = get_failure_list(self.START_DATE, self.END_DATE)

        run_names = [item["run"] for item in result["items"]]
        self.assertIn(run_name, run_names)
        matching = next(item for item in result["items"] if item["run"] == run_name)
        self.assertEqual(matching["person"]["employee"], op)
        self.assertEqual(matching["compliance_result"], "Failed")

    def test_failed_run_due_at_end_of_range_end_date_is_included(self):
        """A run due late on end_date itself is still included (due_at is a datetime,
        not a plain date, so the range must cover the full last day, not just its
        midnight instant)."""
        mgr_user = self._create_user("failure.boundary.mgr@example.com", roles=["Pulse Manager"])
        mgr = self._create_employee("Boundary Manager", mgr_user, pulse_role="Supervisor")

        op_user = self._create_user("failure.boundary.op@example.com", roles=["Pulse User"])
        op = self._create_employee("Boundary Operator", op_user, reports_to=mgr)

        run_name = self._create_run(op, "Failed", f"{self.END_DATE} 23:59:59")

        frappe.set_user(mgr_user)
        result = get_failure_list(self.START_DATE, self.END_DATE)

        run_names = [item["run"] for item in result["items"]]
        self.assertIn(run_name, run_names)

    def test_out_of_scope_failed_run_does_not_appear(self):
        """A Failed run for a sibling manager's subtree is excluded from this manager's list."""
        mgr_user = self._create_user("failure.mgr2@example.com", roles=["Pulse Manager"])
        mgr = self._create_employee("Failure Manager Two", mgr_user, pulse_role="Supervisor")

        sibling_user = self._create_user("failure.sibling.mgr@example.com", roles=["Pulse Manager"])
        sibling_mgr = self._create_employee("Sibling Manager", sibling_user, pulse_role="Supervisor")
        sibling_op_user = self._create_user("failure.sibling.op@example.com", roles=["Pulse User"])
        sibling_op = self._create_employee("Sibling Operator", sibling_op_user, reports_to=sibling_mgr)

        out_of_scope_run = self._create_run(sibling_op, "Failed", "2026-01-15 23:59:59")

        frappe.set_user(mgr_user)
        result = get_failure_list(self.START_DATE, self.END_DATE)

        run_names = [item["run"] for item in result["items"]]
        self.assertNotIn(out_of_scope_run, run_names)

    def test_pagination_after_scope_is_deterministic_and_scoped(self):
        """Pagination applied after scope filtering yields disjoint, fully-covering, scoped pages."""
        mgr_user = self._create_user("failure.page.mgr@example.com", roles=["Pulse Manager"])
        mgr = self._create_employee("Page Manager", mgr_user, pulse_role="Supervisor")

        op_user = self._create_user("failure.page.op@example.com", roles=["Pulse User"])
        op = self._create_employee("Page Operator", op_user, reports_to=mgr)

        sibling_user = self._create_user("failure.page.sibling.mgr@example.com", roles=["Pulse Manager"])
        sibling_mgr = self._create_employee("Page Sibling Manager", sibling_user, pulse_role="Supervisor")
        sibling_op_user = self._create_user("failure.page.sibling.op@example.com", roles=["Pulse User"])
        sibling_op = self._create_employee("Page Sibling Operator", sibling_op_user, reports_to=sibling_mgr)

        out_of_scope_run = self._create_run(sibling_op, "Failed", "2026-01-10 23:59:59")

        page_size = 3
        num_in_scope = 7
        in_scope_runs = []
        for i in range(num_in_scope):
            day = f"2026-01-{i + 1:02d}"
            in_scope_runs.append(self._create_run(op, "Failed", f"{day} 23:59:59"))

        frappe.set_user(mgr_user)

        page1 = get_failure_list(self.START_DATE, self.END_DATE, page=1, page_size=page_size)
        page2 = get_failure_list(self.START_DATE, self.END_DATE, page=2, page_size=page_size)
        page3 = get_failure_list(self.START_DATE, self.END_DATE, page=3, page_size=page_size)

        self.assertEqual(page1["total"], num_in_scope)
        self.assertEqual(len(page1["items"]), 3)
        self.assertEqual(len(page2["items"]), 3)
        self.assertEqual(len(page3["items"]), 1)

        names_p1 = [item["run"] for item in page1["items"]]
        names_p2 = [item["run"] for item in page2["items"]]
        names_p3 = [item["run"] for item in page3["items"]]

        self.assertEqual(len(set(names_p1) & set(names_p2)), 0)
        self.assertEqual(len(set(names_p1) & set(names_p3)), 0)
        self.assertEqual(len(set(names_p2) & set(names_p3)), 0)

        all_names = set(names_p1) | set(names_p2) | set(names_p3)
        self.assertEqual(all_names, set(in_scope_runs))
        self.assertNotIn(out_of_scope_run, all_names)
