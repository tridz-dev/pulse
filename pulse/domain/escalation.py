# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Pure escalation target resolution for operator failures.

This module determines WHO should receive an escalation notification when an
operator run fails. It is responsible only for resolving the target identity;
it does NOT send notifications, does NOT modify permissions, and does NOT
touch notification delivery.

Callers (e.g. SOP Run failure handlers) fetch the employee escalation target
using resolve_escalation_target() and then separately handle permission
visibility and notification delivery in the API/permission layer.
"""

import frappe


def resolve_escalation_target(employee: str) -> str | None:
	"""Resolve the escalation target for a failed operator run.

	For now, the default escalation target is the employee's direct manager
	(the person they report to, from the reports_to field).

	Args:
		employee: Pulse Employee name (the operator whose run failed).

	Returns:
		The name of the escalation target (a Pulse Employee name), or None if:
		- The employee does not exist
		- The employee is not active
		- The employee has no manager assigned
		- The manager is not active

	This function does not send notifications or modify permissions; callers
	handle notification delivery and access control separately.
	"""
	if not employee:
		return None

	# Fetch the employee and their manager, filtering for active employees only
	emp_row = frappe.db.get_value(
		"Pulse Employee",
		{"name": employee, "is_active": 1},
		["name", "reports_to"],
		as_dict=True,
	)

	if not emp_row:
		return None

	manager = emp_row.get("reports_to")
	if not manager:
		return None

	# Verify the manager is also active
	manager_exists = frappe.db.exists(
		"Pulse Employee",
		{"name": manager, "is_active": 1},
	)

	return manager if manager_exists else None


# Override design (not yet implemented):
#
# The escalation target can be overridden per-employee or per-failure-reason
# via an "Escalation Policy" doctype (future work):
#
#   Escalation Policy
#   ├─ employee: link to Pulse Employee
#   ├─ reason: select (e.g. "Repeated Failure", "Critical SOP")
#   ├─ override_target: link to Pulse Employee (optional override)
#   └─ override_group: link to custom group (optional override)
#
# The resolution flow would then be:
#
#   1. Query Escalation Policy for (employee, reason) match
#   2. If override_target or override_group found, use that
#   3. Otherwise, fall back to direct manager (reports_to)
#
# This keeps the resolver pure: it accepts an optional policy dict
# parameter and applies overrides before returning, rather than
# querying the database for policy within the resolver itself.
