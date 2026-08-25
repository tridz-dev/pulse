# Copyright (c) 2026, Tridz and contributors
# See license.txt

import json

import frappe
from frappe.tests.utils import FrappeTestCase


class TestSOPRunSnapshot(FrappeTestCase):
    def test_snapshot_metadata_fields(self):
        """Assert that all nine snapshot fields exist with the correct types and are read-only."""
        meta = frappe.get_meta("SOP Run")

        expected = {
            "template_title_snapshot": "Data",
            "template_modified_snapshot": "Datetime",
            "employee_name_snapshot": "Data",
            "manager_path_snapshot": "JSON",
            "department_snapshot": "Data",
            "branch_snapshot": "Data",
            "frequency_snapshot": "Data",
            "completion_window_minutes_snapshot": "Int",
            "snapshot_is_complete": "Check",
        }

        for fieldname, fieldtype in expected.items():
            field = meta.get_field(fieldname)
            self.assertIsNotNone(field, fieldname)
            self.assertEqual(field.fieldtype, fieldtype)
            self.assertEqual(field.read_only, 1, fieldname)

    def test_manager_path_snapshot_round_trips_json(self):
        """Assert that JSON content can be assigned and retrieved on a new SOP Run."""
        run = frappe.new_doc("SOP Run")
        path = [
            {"id": "PLS-EMP-0001", "label": "Manager One"},
            {"id": "PLS-EMP-0002", "label": "Manager Two"},
        ]
        run.manager_path_snapshot = path

        stored = run.get("manager_path_snapshot")
        if isinstance(stored, str):
            self.assertEqual(json.loads(stored), path)
        else:
            self.assertEqual(stored, path)

    def test_snapshot_is_complete_defaults_to_incomplete(self):
        """Assert that a freshly created SOP Run does not claim a complete snapshot."""
        run = frappe.new_doc("SOP Run")
        self.assertFalse(run.snapshot_is_complete)
