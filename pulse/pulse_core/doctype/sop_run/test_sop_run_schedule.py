# Copyright (c) 2026, Tridz and contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestSOPRunSchedule(FrappeTestCase):
	def test_schedule_metadata_fields(self):
		meta = frappe.get_meta("SOP Run")

		expected = {
			"assignment": "Link",
			"schedule_key": "Data",
			"run_key": "Data",
			"opens_at": "Datetime",
			"due_at": "Datetime",
			"effective_timezone": "Data",
			"schedule_backfill_incomplete": "Check",
		}

		for fieldname, fieldtype in expected.items():
			field = meta.get_field(fieldname)
			self.assertIsNotNone(field, fieldname)
			self.assertEqual(field.fieldtype, fieldtype)

		self.assertEqual(meta.get_field("assignment").options, "SOP Assignment")
		self.assertEqual(meta.get_field("run_key").unique, 1)

	def test_assignment_specific_keys_are_distinct(self):
		run_1 = frappe.new_doc("SOP Run")
		run_1.assignment = "SOP-ASGN-0001"
		run_1.schedule_key = "SOP-ASGN-0001:2026-08-25T09:00:00"
		run_1.run_key = f"{run_1.assignment}:{run_1.schedule_key}"

		run_2 = frappe.new_doc("SOP Run")
		run_2.assignment = "SOP-ASGN-0002"
		run_2.schedule_key = "SOP-ASGN-0002:2026-08-25T10:00:00"
		run_2.run_key = f"SOP-ASGN-0002:{run_2.schedule_key}"

		self.assertNotEqual(run_1.schedule_key, run_2.schedule_key)
		self.assertNotEqual(run_1.run_key, run_2.run_key)
