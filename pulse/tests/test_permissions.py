# Copyright (c) 2026, Tridz and contributors
# License: MIT

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from pulse.api.permissions import get_scope_for_user
from pulse.domain.hierarchy import HierarchyCycleError


class TestPermissionsScopeAdapter(FrappeTestCase):
	"""Tests for the permissions.py hierarchy scope adapter."""

	def setUp(self):
		from pulse.install import create_default_pulse_role_records, create_pulse_roles

		create_pulse_roles()
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
		is_active: int = 1,
	) -> str:
		emp = frappe.get_doc({
			"doctype": "Pulse Employee",
			"employee_name": name,
			"user": user,
			"pulse_role": pulse_role,
			"reports_to": reports_to,
			"is_active": is_active,
		}).insert(ignore_permissions=True)
		self._created_employees.append(emp.name)
		return emp.name

	def test_administrator_gets_organisation_scope(self):
		with patch("pulse.api.permissions.get_organisation_scope") as mock_org:
			mock_org.return_value = []
			get_scope_for_user("Administrator")
			mock_org.assert_called_once()

	def test_pulse_admin_gets_organisation_scope(self):
		user = self._create_user("perm.admin@example.com", roles=["Pulse Admin"])
		self._create_employee("Admin Employee", user, pulse_role="Executive")

		with patch("pulse.api.permissions.get_organisation_scope") as mock_org:
			mock_org.return_value = []
			get_scope_for_user(user)
			mock_org.assert_called_once()

	def test_pulse_executive_gets_organisation_scope(self):
		user = self._create_user("perm.executive@example.com", roles=["Pulse Executive"])
		self._create_employee("Executive Employee", user, pulse_role="Executive")

		with patch("pulse.api.permissions.get_organisation_scope") as mock_org:
			mock_org.return_value = []
			get_scope_for_user(user)
			mock_org.assert_called_once()

	def test_pulse_leader_gets_descendants_scope(self):
		user = self._create_user("perm.leader@example.com", roles=["Pulse Leader"])
		emp = self._create_employee("Leader Employee", user, pulse_role="Area Manager")

		with patch("pulse.api.permissions.get_descendants_scope") as mock_desc:
			mock_desc.return_value = []
			get_scope_for_user(user)
			mock_desc.assert_called_once_with(emp)

	def test_pulse_manager_gets_manager_plus_descendants_scope(self):
		user = self._create_user("perm.manager@example.com", roles=["Pulse Manager"])
		emp = self._create_employee("Manager Employee", user, pulse_role="Supervisor")

		with patch("pulse.api.permissions.get_manager_plus_descendants_scope") as mock_mgr:
			mock_mgr.return_value = []
			get_scope_for_user(user)
			mock_mgr.assert_called_once_with(emp)

	def test_pulse_user_gets_personal_scope(self):
		user = self._create_user("perm.user@example.com", roles=["Pulse User"])
		emp = self._create_employee("Operator Employee", user, pulse_role="Operator")

		with patch("pulse.api.permissions.get_personal_scope") as mock_personal:
			mock_personal.return_value = []
			get_scope_for_user(user)
			mock_personal.assert_called_once_with(emp)

	def test_user_without_employee_gets_empty_scope(self):
		user = self._create_user("perm.no.employee@example.com", roles=["Pulse User"])
		self.assertEqual(get_scope_for_user(user), [])

	def test_manager_cannot_resolve_sibling_subtree(self):
		exec_user = self._create_user("perm.sibling.exec@example.com", roles=["Pulse Executive"])
		exec_emp = self._create_employee("Sibling Exec", exec_user, pulse_role="Executive")

		mgr_a_user = self._create_user("perm.sibling.mgr.a@example.com", roles=["Pulse Manager"])
		mgr_a = self._create_employee("Sibling Manager A", mgr_a_user, pulse_role="Supervisor", reports_to=exec_emp)

		mgr_b_user = self._create_user("perm.sibling.mgr.b@example.com", roles=["Pulse Manager"])
		mgr_b = self._create_employee("Sibling Manager B", mgr_b_user, pulse_role="Supervisor", reports_to=exec_emp)

		child_a_user = self._create_user("perm.sibling.child.a@example.com", roles=["Pulse User"])
		child_a = self._create_employee("Sibling Child A", child_a_user, pulse_role="Operator", reports_to=mgr_a)

		child_b_user = self._create_user("perm.sibling.child.b@example.com", roles=["Pulse User"])
		child_b = self._create_employee("Sibling Child B", child_b_user, pulse_role="Operator", reports_to=mgr_b)

		scope = get_scope_for_user(mgr_a_user)
		self.assertIn(mgr_a, scope)
		self.assertIn(child_a, scope)
		self.assertNotIn(mgr_b, scope)
		self.assertNotIn(child_b, scope)

	def test_cycle_in_hierarchy_fails_closed(self):
		user = self._create_user("perm.cycle@example.com", roles=["Pulse Manager"])
		emp = self._create_employee("Cycle Manager", user, pulse_role="Supervisor")

		other_user = self._create_user("perm.cycle.other@example.com", roles=["Pulse User"])
		other = self._create_employee("Cycle Other", other_user, pulse_role="Operator")

		# Create a corrupted cycle that bypasses document validation.
		frappe.db.set_value("Pulse Employee", emp, "reports_to", other)
		frappe.db.set_value("Pulse Employee", other, "reports_to", emp)

		with self.assertRaises(HierarchyCycleError):
			get_scope_for_user(user)
