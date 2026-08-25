# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import cint, cstr, flt, now


class SOPRun(Document):
	"""A specific instance of a template execution for a given period."""

	# Domain fields that must not change once a run has been finalized.
	# System/metadata fields (name, creation, modified, owner, etc.) are
	# intentionally excluded because they do not alter the run proof.
	_IMMUTABLE_FIELDS = [
		"template",
		"employee",
		"period_date",
		"status",
		"compliance_result",
		"completed_at",
		"closed_at",
		"assignment",
		"schedule_key",
		"run_key",
		"opens_at",
		"due_at",
		"effective_timezone",
		"schedule_backfill_incomplete",
		"template_title_snapshot",
		"template_modified_snapshot",
		"employee_name_snapshot",
		"manager_path_snapshot",
		"department_snapshot",
		"branch_snapshot",
		"frequency_snapshot",
		"completion_window_minutes_snapshot",
		"snapshot_is_complete",
		"total_items",
		"completed_items",
		"progress",
	]

	# Child-row fields that are part of the frozen checklist proof.
	_RUN_ITEM_FIELDS = [
		"idx",
		"checklist_item",
		"weight",
		"item_type",
		"status",
		"completed_at",
		"numeric_value",
		"notes",
		"evidence",
		"evidence_required",
	]

	def validate(self):
		"""Block silent mutation of runs that are already finalized.

		Finalized means the persisted state is already Passed/Failed, or the run
		is Locked. Transitions *into* a finalized state are still allowed because
		this guard compares against the pre-save DB row.

		Trusted internal code may bypass this check by setting
		``self.flags.allow_finalized_edit = True`` for a future explicit
		admin-correction/amendment path.
		"""
		if self.is_new():
			return
		if self.flags.get("allow_finalized_edit"):
			return

		current = frappe.get_doc("SOP Run", self.name)
		is_finalized = (
			current.compliance_result in ("Passed", "Failed")
			or current.status == "Locked"
		)
		if not is_finalized:
			return

		for field in self._IMMUTABLE_FIELDS:
			if not self._values_equal(self.get(field), current.get(field)):
				frappe.throw(
					f"This run is finalized and cannot be modified ({field} changed).",
					title="Finalized Run",
				)

		if not self._run_items_equal(self.run_items, current.run_items):
			frappe.throw(
				"This run is finalized and cannot be modified (run_items changed).",
				title="Finalized Run",
			)

	def _values_equal(self, a, b):
		"""Compare two field values, tolerating Frappe's None/''/0 normalization."""
		if a is None and b is None:
			return True
		if isinstance(a, bool) or isinstance(b, bool):
			return cint(a) == cint(b)
		if isinstance(a, (int, float)) or isinstance(b, (int, float)):
			return flt(a) == flt(b)
		return cstr(a) == cstr(b)

	def _run_items_equal(self, incoming, current):
		"""Compare child-table rows by content, ignoring row identity (name)."""
		incoming = incoming or []
		current = current or []
		if len(incoming) != len(current):
			return False
		for new_row, old_row in zip(incoming, current):
			for field in self._RUN_ITEM_FIELDS:
				if not self._values_equal(new_row.get(field), old_row.get(field)):
					return False
		return True

	def before_save(self):
		self._recompute_totals()
		if not self.compliance_result:
			self.compliance_result = "Pending"
		if self.has_value_changed("status") and self.status == "Completed":
			self.completed_at = now()
			self.closed_at = now() # Deprecated backward-compatibility field

	def _recompute_totals(self):
		total = len(self.run_items) if self.run_items else 0
		completed = (
			sum(1 for r in (self.run_items or []) if r.status == "Completed")
			if self.run_items
			else 0
		)
		self.total_items = total
		self.completed_items = completed
		self.progress = (completed / total * 100) if total else 0

	# Schedule identity is intentionally not derived here yet.
	# S1-T03 will populate assignment/schedule_key/run_key/opens_at/due_at at generation time.

	# Run snapshot fields are intentionally not derived here.
	# S1-T03 will freeze template/employee/manager-path context into the
	# *_snapshot fields and set snapshot_is_complete = 1 at generation time.
