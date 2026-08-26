# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Pure hierarchy scope resolver for Pulse Employee reporting lines."""

import frappe


class HierarchyCycleError(Exception):
	"""Raised when a cycle is detected in the Pulse Employee reports_to graph."""


def get_personal_scope(employee_name: str) -> list[str]:
	"""Return the employee's own name if active, otherwise an empty list."""
	_validate_no_cycles()
	if employee_name not in _active_employee_names():
		return []
	return [employee_name]


def get_descendants_scope(employee_name: str) -> list[str]:
	"""Return all active employees strictly below the given employee in the reports_to tree."""
	_validate_no_cycles()
	children = _children_by_manager()
	result: list[str] = []
	_walk_descendants(employee_name, children, result, set())
	return sorted(result)


def get_manager_plus_descendants_scope(employee_name: str) -> list[str]:
	"""Return the active employee plus all active descendants."""
	_validate_no_cycles()
	children = _children_by_manager()
	result: list[str] = []
	if employee_name in _active_employee_names():
		result.append(employee_name)
	_walk_descendants(employee_name, children, result, set())
	return sorted(result)


def get_organisation_scope() -> list[str]:
	"""Return every active employee in the organisation."""
	_validate_no_cycles()
	return sorted(_active_employee_names())


def _active_employees() -> list[dict]:
	return frappe.get_all(
		"Pulse Employee",
		filters={"is_active": 1},
		fields=["name", "reports_to"],
		order_by="name",
	)


def _active_employee_names() -> set[str]:
	return {e["name"] for e in _active_employees()}


def _children_by_manager() -> dict[str, list[str]]:
	active = _active_employees()
	names = {e["name"] for e in active}
	children: dict[str, list[str]] = {}
	for emp in active:
		manager = emp.get("reports_to")
		if manager and manager in names:
			children.setdefault(manager, []).append(emp["name"])
	for names_list in children.values():
		names_list.sort()
	return children


def _walk_descendants(
	manager: str,
	children: dict[str, list[str]],
	result: list[str],
	visited: set[str],
) -> None:
	if manager in visited:
		return
	visited.add(manager)
	for child in children.get(manager, []):
		result.append(child)
		_walk_descendants(child, children, result, visited)


def _validate_no_cycles() -> None:
	"""Detect any cycle in the active reports_to graph and fail closed."""
	active = _active_employees()
	by_name = {e["name"]: e for e in active}
	visiting: set[str] = set()
	visited: set[str] = set()

	def visit(name: str, path: list[str]) -> None:
		if name in visiting:
			chain = " -> ".join(path + [name])
			raise HierarchyCycleError(f"Circular reference in reports_to: {chain}")
		if name in visited:
			return
		visiting.add(name)
		manager = by_name[name].get("reports_to")
		if manager and manager in by_name:
			visit(manager, path + [name])
		visiting.remove(name)
		visited.add(name)

	for name in by_name:
		if name not in visited:
			visit(name, [])
