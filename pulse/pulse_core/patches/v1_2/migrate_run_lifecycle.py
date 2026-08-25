# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""
Migrate SOP Run lifecycle: status 'Closed' to 'Completed', set compliance_result to 'Pending' if not set.

Recovery:
If the data patch fails partway, it is safe to re-run (idempotent) because:
- Status 'Closed' is migrated to 'Completed' using a conditional update (WHERE status = 'Closed').
- Compliance result is only set to 'Pending' where it is currently NULL or empty.
Therefore, a partial run can simply be re-executed without side effects.
"""

import frappe


def execute():
	"""Migrate existing SOP Run records to the new lifecycle schema."""
	frappe.db.auto_commit_on_many_writes = True

	# 1. Migrate status 'Closed' to 'Completed' for SOP Run.
	# We do not automatically set completed_at from closed_at because that would prematurely
	# guess pass/fail semantics without due_at evaluation logic. Thus completed_at is left null.
	frappe.db.sql("""
		UPDATE `tabSOP Run`
		SET status = 'Completed'
		WHERE status = 'Closed'
	""")

	# 2. Set compliance_result = 'Pending' for all records where it is currently unset
	frappe.db.sql("""
		UPDATE `tabSOP Run`
		SET compliance_result = 'Pending'
		WHERE compliance_result IS NULL OR compliance_result = ''
	""")

	frappe.db.commit()
	frappe.db.auto_commit_on_many_writes = False
