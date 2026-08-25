# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.domain.hierarchy import (
	HierarchyCycleError,
	get_descendants_scope,
	get_manager_plus_descendants_scope,
	get_organisation_scope,
	get_personal_scope,
)


class TestHierarchyScope(FrappeTestCase):
	"""Tests for the pulse.domain.hierarchy resolver."""

	def setUp(self):
		from pulse.install import create_default_pulse_role_records

		create_default_pulse_role_records()
		self._created_users: list[str] = []
		self._created_employees: list[str] = []

	def tearDown(self):
		for emp_name in self._created_employees:
			if frappe.db.exists("Pulse Employee", emp_name):
				frappe.delete_doc("Pulse Employee", emp_name, force=1, ignore_permissions=True)
		for user_email in self._created_users:
			if frappe.db.exists("User", user_email):
				frappe.delete_doc("User", user_email, force=1, ignore_permissions=True)

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

	def _create_employee(
		self,
		name: str,
		user: str,
		reports_to: str | None = None,
		is_active: int = 1,
	) -> str:
		emp = frappe.get_doc({
			"doctype": "Pulse Employee",
			"employee_name": name,
			"user": user,
			"pulse_role": "Operator",
			"reports_to": reports_to,
			"is_active": is_active,
		}).insert(ignore_permissions=True)
		self._created_employees.append(emp.name)
		return emp.name

	def test_personal_scope_returns_only_self(self):
		user = self._create_user("hscope.self@example.com")
		emp = self._create_employee("Self Employee", user)
		self.assertEqual(get_personal_scope(emp), [emp])

	def test_personal_scope_excludes_inactive_employee(self):
		user = self._create_user("hscope.inactive.self@example.com")
		emp = self._create_employee("Inactive Self", user, is_active=0)
		self.assertEqual(get_personal_scope(emp), [])

	def test_descendants_scope_returns_strict_descendants(self):
		exec_user = self._create_user("hscope.exec@example.com")
		exec_emp = self._create_employee("Exec", exec_user)

		mgr_user = self._create_user("hscope.mgr@example.com")
		mgr = self._create_employee("Manager", mgr_user, reports_to=exec_emp)

		op1_user = self._create_user("hscope.op1@example.com")
		op1 = self._create_employee("Operator One", op1_user, reports_to=mgr)

		op2_user = self._create_user("hscope.op2@example.com")
		op2 = self._create_employee("Operator Two", op2_user, reports_to=mgr)

		grand_user = self._create_user("hscope.grand@example.com")
		grand = self._create_employee("Grandchild", grand_user, reports_to=op1)

		self.assertEqual(get_descendants_scope(mgr), sorted([op1, op2, grand]))
		self.assertEqual(get_descendants_scope(exec_emp), sorted([mgr, op1, op2, grand]))

	def test_descendants_scope_excludes_inactive_descendants(self):
		mgr_user = self._create_user("hscope.mgr.inactive@example.com")
		mgr = self._create_employee("Manager Inactive Child", mgr_user)

		active_user = self._create_user("hscope.active.child@example.com")
		active_child = self._create_employee("Active Child", active_user, reports_to=mgr)

		inactive_user = self._create_user("hscope.inactive.child@example.com")
		self._create_employee("Inactive Child", inactive_user, reports_to=mgr, is_active=0)

		self.assertEqual(get_descendants_scope(mgr), [active_child])

	def test_manager_plus_descendants_scope_includes_self_and_descendants(self):
		mgr_user = self._create_user("hscope.mgr.plus@example.com")
		mgr = self._create_employee("Manager Plus", mgr_user)

		child_user = self._create_user("hscope.child.plus@example.com")
		child = self._create_employee("Child Plus", child_user, reports_to=mgr)

		self.assertEqual(get_manager_plus_descendants_scope(mgr), [mgr, child])

	def test_organisation_scope_returns_all_active_employees(self):
		user_a = self._create_user("hscope.org.a@example.com")
		emp_a = self._create_employee("Org A", user_a)

		user_b = self._create_user("hscope.org.b@example.com")
		emp_b = self._create_employee("Org B", user_b)

		inactive_user = self._create_user("hscope.org.inactive@example.com")
		self._create_employee("Org Inactive", inactive_user, is_active=0)

		self.assertEqual(get_organisation_scope(), sorted([emp_a, emp_b]))

	def test_cycle_in_reports_to_raises_hierarchy_cycle_error(self):
		user_a = self._create_user("hscope.cycle.a@example.com")
		emp_a = self._create_employee("Cycle A", user_a)

		user_b = self._create_user("hscope.cycle.b@example.com")
		emp_b = self._create_employee("Cycle B", user_b)

		# Bypass document validation to simulate a corrupted hierarchy.
		frappe.db.set_value("Pulse Employee", emp_a, "reports_to", emp_b)
		frappe.db.set_value("Pulse Employee", emp_b, "reports_to", emp_a)

		with self.assertRaises(HierarchyCycleError):
			get_descendants_scope(emp_a)

		with self.assertRaises(HierarchyCycleError):
			get_organisation_scope()

	def test_manager_cannot_resolve_sibling_subtree(self):
		exec_user = self._create_user("hscope.sibling.exec@example.com")
		exec_emp = self._create_employee("Sibling Exec", exec_user)

		mgr_a_user = self._create_user("hscope.mgr.a@example.com")
		mgr_a = self._create_employee("Manager A", mgr_a_user, reports_to=exec_emp)

		mgr_b_user = self._create_user("hscope.mgr.b@example.com")
		mgr_b = self._create_employee("Manager B", mgr_b_user, reports_to=exec_emp)

		child_a_user = self._create_user("hscope.child.a@example.com")
		child_a = self._create_employee("Child A", child_a_user, reports_to=mgr_a)

		child_b_user = self._create_user("hscope.child.b@example.com")
		child_b = self._create_employee("Child B", child_b_user, reports_to=mgr_b)

		self.assertEqual(get_manager_plus_descendants_scope(mgr_a), sorted([mgr_a, child_a]))
		self.assertNotIn(mgr_b, get_manager_plus_descendants_scope(mgr_a))
		self.assertNotIn(child_b, get_manager_plus_descendants_scope(mgr_a))
