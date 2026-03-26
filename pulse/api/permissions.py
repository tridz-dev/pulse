# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Row-level permission query conditions for Pulse DocTypes."""

import frappe


def has_app_permission():
	"""Check if user has permission to access the Pulse app."""
	if frappe.session.user == "Administrator":
		return True
	roles = frappe.get_roles(frappe.session.user)
	return any(role in roles for role in ["Pulse Admin", "Pulse Executive", "Pulse Leader", "Pulse Manager", "Pulse User"])


def _get_employee_for_user(user: str | None = None):
	"""Return PM Employee name for the given user, or current session user."""
	user = user or frappe.session.user
	if not user or user == "Guest":
		return None
	return frappe.db.get_value("Pulse Employee", {"user": user, "is_active": 1}, "name")


def _get_system_role_for_employee(emp_name: str) -> str | None:
	"""Resolve employee -> PM Role -> system_role (Frappe Role name)."""
	pulse_role = frappe.db.get_value("Pulse Employee", emp_name, "pulse_role")
	if not pulse_role:
		return None
	return frappe.db.get_value("Pulse Role", pulse_role, "system_role")


def _get_subordinate_employee_names(manager_employee: str) -> list[str]:
	"""Return list of PM Employee names that report to the given manager (direct only)."""
	if not manager_employee:
		return []
	return frappe.get_all(
		"Pulse Employee",
		filters={"reports_to": manager_employee, "is_active": 1},
		pluck="name",
	)


def _get_subtree_employee_names(manager_employee: str) -> list[str]:
	"""Return list of all PM Employee names in the subtree under the given manager (recursive)."""
	result = []
	stack = [manager_employee]
	while stack:
		emp = stack.pop()
		result.append(emp)
		for sub in _get_subordinate_employee_names(emp):
			stack.append(sub)
	return result


def sop_run_conditions(user: str | None = None, doctype: str | None = None) -> str:
	"""Restrict SOP Run visibility by role: own only for Operator, team for Supervisor, subtree for Area Manager, all for Executive/Admin."""
	user = user or frappe.session.user
	if frappe.session.user == "Administrator" or "Pulse Admin" in frappe.get_roles(user):
		return ""

	emp = _get_employee_for_user(user)
	if not emp:
		return " 1 = 0 "  # no employee: see nothing

	roles = frappe.get_roles(user)
	if "Pulse Executive" in roles:
		return ""
	if "Pulse Leader" in roles:
		subtree = _get_subtree_employee_names(emp)
		if not subtree:
			return f" `tabSOP Run`.employee = {frappe.db.escape(emp)} "
		return f" `tabSOP Run`.employee in ({','.join(frappe.db.escape(e) for e in subtree)}) "
	if "Pulse Manager" in roles:
		subs = _get_subordinate_employee_names(emp)
		subs.append(emp)
		return f" `tabSOP Run`.employee in ({','.join(frappe.db.escape(e) for e in subs)}) "
	# PM User: own only
	return f" `tabSOP Run`.employee = {frappe.db.escape(emp)} "


def score_snapshot_conditions(user: str | None = None, doctype: str | None = None) -> str:
	"""Restrict Score Snapshot visibility by role (same logic as SOP Run)."""
	user = user or frappe.session.user
	if frappe.session.user == "Administrator" or "Pulse Admin" in frappe.get_roles(user):
		return ""

	emp = _get_employee_for_user(user)
	if not emp:
		return " 1 = 0 "

	roles = frappe.get_roles(user)
	if "Pulse Executive" in roles:
		return ""
	if "Pulse Leader" in roles:
		subtree = _get_subtree_employee_names(emp)
		if not subtree:
			return f" `tabScore Snapshot`.employee = {frappe.db.escape(emp)} "
		return f" `tabScore Snapshot`.employee in ({','.join(frappe.db.escape(e) for e in subtree)}) "
	if "Pulse Manager" in roles:
		subs = _get_subordinate_employee_names(emp)
		subs.append(emp)
		return f" `tabScore Snapshot`.employee in ({','.join(frappe.db.escape(e) for e in subs)}) "
	return f" `tabScore Snapshot`.employee = {frappe.db.escape(emp)} "


def corrective_action_conditions(user: str | None = None, doctype: str | None = None) -> str:
	"""Restrict Corrective Action: Operator sees own (assigned_to or raised_by), others by subtree."""
	user = user or frappe.session.user
	if frappe.session.user == "Administrator" or "Pulse Admin" in frappe.get_roles(user):
		return ""

	emp = _get_employee_for_user(user)
	if not emp:
		return " 1 = 0 "

	roles = frappe.get_roles(user)
	if "Pulse Executive" in roles:
		return ""
	if "Pulse Leader" in roles:
		subtree = _get_subtree_employee_names(emp)
		if not subtree:
			return f" ( `tabCorrective Action`.assigned_to = {frappe.db.escape(emp)} or `tabCorrective Action`.raised_by = {frappe.db.escape(emp)} ) "
		return f" ( `tabCorrective Action`.assigned_to in ({','.join(frappe.db.escape(e) for e in subtree)}) or `tabCorrective Action`.raised_by in ({','.join(frappe.db.escape(e) for e in subtree)}) ) "
	if "Pulse Manager" in roles:
		subs = _get_subordinate_employee_names(emp)
		subs.append(emp)
		return f" ( `tabCorrective Action`.assigned_to in ({','.join(frappe.db.escape(e) for e in subs)}) or `tabCorrective Action`.raised_by in ({','.join(frappe.db.escape(e) for e in subs)}) ) "
	return f" ( `tabCorrective Action`.assigned_to = {frappe.db.escape(emp)} or `tabCorrective Action`.raised_by = {frappe.db.escape(emp)} ) "


def pulse_notification_conditions(user: str | None = None, doctype: str | None = None) -> str:
	"""Restrict Pulse Notification: own recipient for User; team/subtree for Manager/Leader; all for Executive/Admin."""
	user = user or frappe.session.user
	if frappe.session.user == "Administrator" or "Pulse Admin" in frappe.get_roles(user):
		return ""

	emp = _get_employee_for_user(user)
	if not emp:
		return " 1 = 0 "

	roles = frappe.get_roles(user)
	if "Pulse Executive" in roles:
		return ""
	if "Pulse Leader" in roles:
		subtree = _get_subtree_employee_names(emp)
		if not subtree:
			return f" `tabPulse Notification`.recipient = {frappe.db.escape(emp)} "
		return f" `tabPulse Notification`.recipient in ({','.join(frappe.db.escape(e) for e in subtree)}) "
	if "Pulse Manager" in roles:
		subs = _get_subordinate_employee_names(emp)
		subs.append(emp)
		return f" `tabPulse Notification`.recipient in ({','.join(frappe.db.escape(e) for e in subs)}) "
	return f" `tabPulse Notification`.recipient = {frappe.db.escape(emp)} "
