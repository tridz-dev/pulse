# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Command API for SOP Assignment lifecycle."""

import frappe
from frappe import _

from pulse.api.permissions import get_scope_for_user, has_app_permission


def _check_assignment_write_permission():
    """Only roles with create/write permission on SOP Assignment may mutate."""
    user = frappe.session.user
    if user == "Administrator":
        return
    roles = frappe.get_roles(user)
    if "Pulse Admin" in roles or "Pulse Leader" in roles:
        return
    frappe.throw(
        _("Not permitted. Only Pulse Admin or Pulse Leader can manage SOP Assignments."),
        frappe.PermissionError,
    )


def _normalise_override(value):
    """Treat blank-ish values as None so comparisons are stable."""
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


@frappe.whitelist()
def list_assignments():
    """Return SOP Assignments for employees within the caller's scope."""
    if not has_app_permission():
        frappe.throw(
            _("Not permitted. You do not have access to the Pulse application."),
            frappe.PermissionError,
        )

    scope = get_scope_for_user(frappe.session.user)
    if not scope:
        return []

    return frappe.get_all(
        "SOP Assignment",
        filters={"employee": ["in", scope]},
        fields=[
            "name",
            "template",
            "employee",
            "schedule_timezone_override",
            "local_start_time_override",
            "completion_window_minutes_override",
            "is_active",
        ],
        order_by="modified desc",
    )


@frappe.whitelist()
def list_eligible_employees():
    """Return active employees within the caller's scope, for assignment pickers."""
    if not has_app_permission():
        frappe.throw(
            _("Not permitted. You do not have access to the Pulse application."),
            frappe.PermissionError,
        )

    scope = get_scope_for_user(frappe.session.user)
    if not scope:
        return []

    return frappe.get_all(
        "Pulse Employee",
        filters={"name": ["in", scope], "is_active": 1},
        fields=["name", "employee_name", "user", "pulse_role", "branch", "department"],
        order_by="employee_name asc",
    )


@frappe.whitelist()
def create_assignment(
    template,
    employee,
    schedule_timezone_override=None,
    local_start_time_override=None,
    completion_window_minutes_override=None,
):
    """Assign a template to an in-scope active employee.

    Duplicate active assignments (same template + employee + same effective
    overrides) are treated idempotently: the existing assignment is returned
    instead of creating a second one.
    """
    _check_assignment_write_permission()

    if not template:
        frappe.throw(_("Template is required."))
    if not employee:
        frappe.throw(_("Employee is required."))

    if not frappe.db.exists("SOP Template", template):
        frappe.throw(_("SOP Template '{0}' does not exist.").format(template), frappe.DoesNotExistError)
    if not frappe.db.exists("Pulse Employee", employee):
        frappe.throw(_("Pulse Employee '{0}' does not exist.").format(employee), frappe.DoesNotExistError)

    scope = get_scope_for_user(frappe.session.user)
    if employee not in scope:
        frappe.throw(
            _("Not permitted. Employee '{0}' is outside your scope.").format(employee),
            frappe.PermissionError,
        )

    if frappe.db.get_value("Pulse Employee", employee, "is_active") != 1:
        frappe.throw(
            _("Cannot assign to inactive employee '{0}'.").format(employee),
            frappe.ValidationError,
        )

    tz = _normalise_override(schedule_timezone_override)
    start = _normalise_override(local_start_time_override)
    window = _normalise_override(completion_window_minutes_override)

    # If a window was provided, coerce to int for stable matching and storage.
    # Zero is treated as "no override" to keep None/blank/0 as one effective value.
    if window is not None:
        try:
            window = int(window)
            if window < 0:
                raise ValueError
            if window == 0:
                window = None
        except (TypeError, ValueError):
            frappe.throw(_("Completion window minutes override must be a positive integer."))

    existing = frappe.get_all(
        "SOP Assignment",
        filters={
            "template": template,
            "employee": employee,
            "is_active": 1,
            "schedule_timezone_override": tz or "",
            "local_start_time_override": start or "",
            "completion_window_minutes_override": window if window is not None else 0,
        },
        pluck="name",
        limit=1,
    )
    if existing:
        return frappe.get_doc("SOP Assignment", existing[0])

    doc = frappe.get_doc({
        "doctype": "SOP Assignment",
        "template": template,
        "employee": employee,
        "schedule_timezone_override": tz or "",
        "local_start_time_override": start or "",
        "completion_window_minutes_override": window if window is not None else 0,
        "is_active": 1,
    })
    doc.insert(ignore_permissions=True)
    return doc


@frappe.whitelist()
def deactivate_assignment(name):
    """Deactivate an in-scope SOP Assignment without touching linked SOP Runs."""
    _check_assignment_write_permission()

    if not frappe.db.exists("SOP Assignment", name):
        frappe.throw(_("SOP Assignment '{0}' does not exist.").format(name), frappe.DoesNotExistError)

    doc = frappe.get_doc("SOP Assignment", name)

    scope = get_scope_for_user(frappe.session.user)
    if doc.employee not in scope:
        frappe.throw(
            _("Not permitted. Assignment '{0}' is outside your scope.").format(name),
            frappe.PermissionError,
        )

    doc.is_active = 0
    doc.save(ignore_permissions=True)
    return doc
