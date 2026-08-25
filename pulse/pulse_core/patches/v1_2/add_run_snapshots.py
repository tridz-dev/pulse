# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""
Backfill SOP Run rows with best-effort snapshot fields.

Existing rows that pre-date the snapshot contract cannot recover the exact
attribution context that existed at generation time (template title/version,
employee name, manager path, department/branch, frequency, completion window).
This patch fills the new snapshot columns from the *current* master data so that
existing runs remain readable, and marks every touched row with
`snapshot_is_complete = 0` to make clear that the historical snapshot is
incomplete.

Idempotent and safe to re-run: only touches rows where
`template_title_snapshot` is NULL or empty.

Recovery/rollback:
Clear the nine snapshot fields and `snapshot_is_complete` on rows where
`snapshot_is_complete = 0` to revert the best-effort backfill. Rows created
after this patch is applied will be populated by the run generator (S1-T03) and
are not affected.
"""

import json

import frappe


def _manager_path(employee_name):
    """Build the manager path from direct manager upward as JSON.

    Uses current master data as a best-effort fallback. Cycles are guarded
    against so the patch cannot loop forever on malformed reporting lines.
    """
    path = []
    current = employee_name
    visited = set()

    while current:
        if current in visited:
            break
        visited.add(current)

        manager = frappe.db.get_value(
            "Pulse Employee",
            current,
            ["reports_to", "employee_name"],
            as_dict=True,
        )
        if not manager or not manager.reports_to:
            break

        current = manager.reports_to
        label = frappe.db.get_value("Pulse Employee", current, "employee_name") or current
        path.append({"id": current, "label": label})

    return json.dumps(path, default=str)


def execute():
    """Backfill missing snapshot fields on existing SOP Run records."""
    frappe.db.auto_commit_on_many_writes = True

    rows = frappe.db.sql(
        """
        SELECT name, template, employee
        FROM `tabSOP Run`
        WHERE template_title_snapshot IS NULL OR template_title_snapshot = ''
        ORDER BY name ASC
        """,
        as_dict=True,
    )

    for row in rows:
        updates = {"snapshot_is_complete": 0}

        if row.template:
            template = frappe.db.get_value(
                "SOP Template",
                row.template,
                ["title", "modified", "frequency_type", "completion_window_minutes"],
                as_dict=True,
            )
            if template:
                updates["template_title_snapshot"] = template.title
                updates["template_modified_snapshot"] = template.modified
                updates["frequency_snapshot"] = template.frequency_type
                updates["completion_window_minutes_snapshot"] = template.completion_window_minutes

        if row.employee:
            employee = frappe.db.get_value(
                "Pulse Employee",
                row.employee,
                ["employee_name", "branch", "department"],
                as_dict=True,
            )
            if employee:
                updates["employee_name_snapshot"] = employee.employee_name
                updates["branch_snapshot"] = employee.branch
                if employee.department:
                    updates["department_snapshot"] = (
                        frappe.db.get_value("Pulse Department", employee.department, "department_name")
                        or employee.department
                    )
                updates["manager_path_snapshot"] = _manager_path(row.employee)

        for fieldname, value in updates.items():
            frappe.db.set_value("SOP Run", row.name, fieldname, value, update_modified=False)

    frappe.db.commit()
    frappe.db.auto_commit_on_many_writes = False
