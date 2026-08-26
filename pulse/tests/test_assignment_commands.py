# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.api.assignments import (
    create_assignment,
    deactivate_assignment,
    list_assignments,
    list_eligible_employees,
)


class TestAssignmentCommands(FrappeTestCase):
    """Tests for the SOP Assignment Command API."""

    def setUp(self):
        from pulse.install import create_default_pulse_role_records, create_pulse_roles

        create_pulse_roles()
        create_default_pulse_role_records()

        self._created_users = []
        self._created_employees = []
        self._created_templates = []
        self._created_assignments = []
        self._created_sop_runs = []

        frappe.set_user("Administrator")

    def tearDown(self):
        frappe.set_user("Administrator")
        for run_name in self._created_sop_runs:
            if frappe.db.exists("SOP Run", run_name):
                frappe.delete_doc("SOP Run", run_name, force=1, ignore_permissions=True)
        for asgn_name in self._created_assignments:
            if frappe.db.exists("SOP Assignment", asgn_name):
                frappe.delete_doc("SOP Assignment", asgn_name, force=1, ignore_permissions=True)
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

    def _create_employee(self, employee_name: str, user: str, pulse_role: str, reports_to=None):
        emp = frappe.get_doc({
            "doctype": "Pulse Employee",
            "employee_name": employee_name,
            "user": user,
            "pulse_role": pulse_role,
            "reports_to": reports_to,
            "is_active": 1,
        }).insert(ignore_permissions=True)
        self._created_employees.append(emp.name)
        return emp

    def _create_template(self, title: str):
        tmpl = frappe.get_doc({
            "doctype": "SOP Template",
            "title": title,
            "frequency_type": "Daily",
            "active_from": "2026-01-01",
            "is_active": 1,
            "checklist_items": [
                {"description": "Check item", "sequence": 1, "weight": 1, "item_type": "Checkbox"}
            ],
        }).insert(ignore_permissions=True)
        self._created_templates.append(tmpl.name)
        return tmpl

    def test_authorised_lifecycle_and_scope(self):
        # Hierarchy: admin -> leader -> manager -> operator
        admin_user = self._create_user("admin_asgn@example.com", roles=["Pulse Admin"])
        leader_user = self._create_user("leader_asgn@example.com", roles=["Pulse Leader"])
        manager_user = self._create_user("manager_asgn@example.com", roles=["Pulse Manager"])
        operator_user = self._create_user("operator_asgn@example.com", roles=["Pulse User"])
        other_user = self._create_user("other_asgn@example.com", roles=["Pulse User"])

        admin = self._create_employee("Admin Asgn", admin_user, "Executive")
        leader = self._create_employee("Leader Asgn", leader_user, "Area Manager", reports_to=admin.name)
        manager = self._create_employee("Manager Asgn", manager_user, "Supervisor", reports_to=leader.name)
        operator = self._create_employee("Operator Asgn", operator_user, "Operator", reports_to=manager.name)
        other = self._create_employee("Other Asgn", other_user, "Operator")

        template = self._create_template("Assignment Lifecycle Template")

        # 1. A role without write access cannot create assignments.
        frappe.set_user(operator_user)
        with self.assertRaises(frappe.PermissionError):
            create_assignment(template.name, operator.name)

        # 2. Leader can create an assignment for an in-scope descendant.
        frappe.set_user(leader_user)
        asgn = create_assignment(template.name, operator.name)
        self.assertTrue(frappe.db.exists("SOP Assignment", asgn.name))
        self._created_assignments.append(asgn.name)
        self.assertEqual(asgn.template, template.name)
        self.assertEqual(asgn.employee, operator.name)
        self.assertEqual(asgn.is_active, 1)

        # 3. list_assignments is scope-limited for the leader.
        assignments = list_assignments()
        assignment_names = [a["name"] for a in assignments]
        self.assertIn(asgn.name, assignment_names)
        self.assertTrue(all(a["employee"] in {manager.name, operator.name} for a in assignments))
        self.assertNotIn(other.name, [a["employee"] for a in assignments])

        # 4. list_eligible_employees is scope-limited and active-only.
        eligible = list_eligible_employees()
        eligible_names = [e["name"] for e in eligible]
        self.assertIn(operator.name, eligible_names)
        self.assertNotIn(other.name, eligible_names)
        self.assertNotIn(admin.name, eligible_names)  # Admin is not in leader's subtree.

        # 5. Out-of-scope assignment is rejected.
        with self.assertRaises(frappe.PermissionError):
            create_assignment(template.name, other.name)

        # 6. A Pulse Manager below the assignment creator cannot write.
        frappe.set_user(manager_user)
        with self.assertRaises(frappe.PermissionError):
            create_assignment(template.name, manager.name)

    def test_idempotent_create(self):
        admin_user = self._create_user("admin_idem@example.com", roles=["Pulse Admin"])
        user = self._create_user("user_idem@example.com", roles=["Pulse User"])
        frappe.set_user(admin_user)
        emp = self._create_employee("Idem Emp", user, "Operator")
        template = self._create_template("Idempotent Template")

        first = create_assignment(template.name, emp.name)
        self._created_assignments.append(first.name)

        second = create_assignment(template.name, emp.name)
        self.assertEqual(second.name, first.name)

        # There is only one active assignment for the template + employee.
        active_count = frappe.db.count(
            "SOP Assignment",
            filters={"template": template.name, "employee": emp.name, "is_active": 1},
        )
        self.assertEqual(active_count, 1)

        # A genuinely different override combination is allowed as a second active assignment.
        third = create_assignment(
            template.name,
            emp.name,
            schedule_timezone_override="Asia/Kolkata",
            local_start_time_override="10:00:00",
            completion_window_minutes_override=90,
        )
        self.assertNotEqual(third.name, first.name)
        self._created_assignments.append(third.name)

        active_count = frappe.db.count(
            "SOP Assignment",
            filters={"template": template.name, "employee": emp.name, "is_active": 1},
        )
        self.assertEqual(active_count, 2)

    def test_deactivate_preserves_sop_run_link(self):
        admin_user = self._create_user("admin_deact@example.com", roles=["Pulse Admin"])
        user = self._create_user("user_deact@example.com", roles=["Pulse User"])
        frappe.set_user(admin_user)
        emp = self._create_employee("Deact Emp", user, "Operator")
        template = self._create_template("Deactivate Template")

        asgn = create_assignment(template.name, emp.name)
        self._created_assignments.append(asgn.name)

        run = frappe.get_doc({
            "doctype": "SOP Run",
            "template": template.name,
            "employee": emp.name,
            "assignment": asgn.name,
            "period_date": "2026-08-26",
            "status": "Open",
            "run_items": [
                {
                    "checklist_item": "Test step",
                    "item_type": "Checkbox",
                    "status": "Pending",
                    "weight": 1,
                }
            ],
        }).insert(ignore_permissions=True)
        self._created_sop_runs.append(run.name)

        self.assertEqual(frappe.db.get_value("SOP Run", run.name, "assignment"), asgn.name)

        deactivated = deactivate_assignment(asgn.name)
        self.assertEqual(deactivated.is_active, 0)

        # The historical SOP Run must remain linked to the deactivated assignment.
        run.reload()
        self.assertEqual(run.assignment, asgn.name)

    def test_deactivate_out_of_scope_rejected(self):
        admin_user = self._create_user("admin_deact_scope@example.com", roles=["Pulse Admin"])
        leader_user = self._create_user("leader_deact_scope@example.com", roles=["Pulse Leader"])
        user_a = self._create_user("user_a_deact@example.com", roles=["Pulse User"])
        user_b = self._create_user("user_b_deact@example.com", roles=["Pulse User"])

        frappe.set_user(admin_user)
        admin = self._create_employee("Admin Deact Scope", admin_user, "Executive")
        leader = self._create_employee("Leader Deact Scope", leader_user, "Area Manager", reports_to=admin.name)
        emp_a = self._create_employee("Emp A Deact Scope", user_a, "Operator", reports_to=leader.name)
        emp_b = self._create_employee("Emp B Deact Scope", user_b, "Operator")

        template = self._create_template("Deactivate Scope Template")
        asgn = create_assignment(template.name, emp_b.name)
        self._created_assignments.append(asgn.name)

        # Leader cannot deactivate an assignment for an employee outside their subtree.
        frappe.set_user(leader_user)
        with self.assertRaises(frappe.PermissionError):
            deactivate_assignment(asgn.name)
