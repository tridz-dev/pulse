# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Backfill SOP extension fields after schema sync: item_key, proof from legacy evidence, period_datetime."""

import uuid

import frappe


def execute():
	frappe.db.auto_commit_on_many_writes = True
	try:
		_backfill_checklist_item_keys()
		_backfill_run_item_keys()
		_map_evidence_to_proof("SOP Checklist Item")
		_map_evidence_to_proof("SOP Run Item")
		_backfill_period_datetime()
	finally:
		frappe.db.commit()
		frappe.db.auto_commit_on_many_writes = False


def _backfill_checklist_item_keys():
	cols = set(frappe.db.get_table_columns("SOP Checklist Item") or [])
	if "item_key" not in cols:
		return
	rows = frappe.db.sql(
		"""
		SELECT name FROM `tabSOP Checklist Item`
		WHERE IFNULL(item_key, '') = ''
		""",
		as_dict=True,
	)
	for r in rows:
		frappe.db.set_value(
			"SOP Checklist Item",
			r.name,
			"item_key",
			uuid.uuid4().hex[:16],
			update_modified=False,
		)


def _backfill_run_item_keys():
	cols = set(frappe.db.get_table_columns("SOP Run Item") or [])
	if "item_key" not in cols:
		return
	rows = frappe.db.sql(
		"""
		SELECT ri.name AS ri_name, r.template AS template, ri.checklist_item
		FROM `tabSOP Run Item` ri
		INNER JOIN `tabSOP Run` r ON r.name = ri.parent
		WHERE IFNULL(ri.item_key, '') = ''
		""",
		as_dict=True,
	)
	for r in rows:
		matched = frappe.db.sql(
			"""
			SELECT item_key FROM `tabSOP Checklist Item`
			WHERE parent = %s AND description = %s
			LIMIT 1
			""",
			(r.template, r.checklist_item),
		)
		new_key = matched[0][0] if matched and matched[0][0] else uuid.uuid4().hex[:16]
		frappe.db.set_value("SOP Run Item", r.ri_name, "item_key", new_key, update_modified=False)


def _map_evidence_to_proof(doctype: str):
	table = frappe.utils.get_table_name(doctype)
	cols = set(frappe.db.get_table_columns(doctype) or [])
	if "proof_requirement" not in cols or "evidence_required" not in cols:
		return
	frappe.db.sql(
		f"""
		UPDATE `{table}`
		SET
			proof_requirement = 'Required',
			proof_media_type = CASE
				WHEN IFNULL(proof_media_type, '') IN ('', 'None') THEN 'Image'
				ELSE proof_media_type
			END
		WHERE IFNULL(evidence_required, 'None') = 'Photo'
		AND IFNULL(proof_requirement, 'None') IN ('None', '')
		"""
	)


def _backfill_period_datetime():
	cols = set(frappe.db.get_table_columns("SOP Run") or [])
	if "period_datetime" not in cols or "period_date" not in cols:
		return
	frappe.db.sql(
		"""
		UPDATE `tabSOP Run`
		SET period_datetime = TIMESTAMP(period_date)
		WHERE period_datetime IS NULL AND period_date IS NOT NULL
		"""
	)
