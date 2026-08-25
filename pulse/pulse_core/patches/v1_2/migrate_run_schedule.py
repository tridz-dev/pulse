# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""
Backfill legacy SOP Run rows with best-effort schedule identity fields.

Safe to re-run; only touches rows where run_key is still null/empty. Recovery/rollback:
clear schedule_backfill_incomplete, opens_at, due_at, effective_timezone,
schedule_key, and run_key on rows where schedule_backfill_incomplete = 1.
"""

import hashlib

import frappe


def _stable_key(*parts):
	raw = "||".join("" if part is None else str(part) for part in parts)
	return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def execute():
	frappe.db.auto_commit_on_many_writes = True

	rows = frappe.db.sql(
		"""
		SELECT name, template, employee, period_date, schedule_key, run_key
		FROM `tabSOP Run`
		WHERE run_key IS NULL OR run_key = ''
		ORDER BY name ASC
		""",
		as_dict=True,
	)

	for row in rows:
		schedule_key = row.schedule_key or _stable_key(
			row.template, row.employee, row.period_date, row.name
		)
		run_key = _stable_key(row.template, row.employee, schedule_key)

		frappe.db.set_value("SOP Run", row.name, "schedule_key", schedule_key, update_modified=False)
		frappe.db.set_value("SOP Run", row.name, "run_key", run_key, update_modified=False)
		frappe.db.set_value(
			"SOP Run", row.name, "schedule_backfill_incomplete", 1, update_modified=False
		)
		frappe.db.set_value("SOP Run", row.name, "opens_at", None, update_modified=False)
		frappe.db.set_value("SOP Run", row.name, "due_at", None, update_modified=False)
		frappe.db.set_value("SOP Run", row.name, "effective_timezone", None, update_modified=False)

		assignment = None
		if row.template and row.employee and row.period_date:
			assignment = frappe.db.get_value(
				"SOP Assignment",
				{"template": row.template, "employee": row.employee},
				"name",
			)
		if assignment:
			frappe.db.set_value("SOP Run", row.name, "assignment", assignment, update_modified=False)

	# Leave a trace in the patch log for operators; timing recovery is intentionally not inferred.
	frappe.log_error(
		title="SOP Run schedule backfill",
		message="Legacy schedule identity was backfilled with stable fallback keys only; opens_at/due_at/effective_timezone remain null for historical rows.",
	)

	frappe.db.commit()
	frappe.db.auto_commit_on_many_writes = False
