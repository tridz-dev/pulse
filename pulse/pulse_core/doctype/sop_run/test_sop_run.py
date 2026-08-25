# Copyright (c) 2026, Tridz and contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestSOPRun(FrappeTestCase):
	def test_metadata_options(self):
		"""Assert that the new status and compliance_result options are defined in the DocType."""
		meta = frappe.get_meta("SOP Run")
		
		# Verify status options
		status_field = meta.get_field("status")
		self.assertIsNotNone(status_field)
		status_options = status_field.options.split("\n")
		for opt in ["Open", "In Progress", "Completed", "Locked"]:
			self.assertIn(opt, status_options)
			
		# Verify compliance_result options
		comp_field = meta.get_field("compliance_result")
		self.assertIsNotNone(comp_field)
		comp_options = comp_field.options.split("\n")
		for opt in ["Pending", "Passed", "Failed"]:
			self.assertIn(opt, comp_options)

	def test_default_compliance_result(self):
		"""Assert that a freshly created SOP Run defaults to compliance_result='Pending'."""
		doc = frappe.new_doc("SOP Run")
		# Verify that compliance_result is set to "Pending"
		self.assertEqual(doc.compliance_result, "Pending")

	def test_independent_status_and_compliance(self):
		"""Assert status and compliance_result can be set independently and completed_at/closed_at are set on Completed."""
		doc = frappe.new_doc("SOP Run")
		doc.status = "In Progress"
		doc.compliance_result = "Pending"
		doc.before_save()
		
		# transition status to Completed
		doc.status = "Completed"
		doc.before_save()
		
		# Verify completed_at and closed_at are set
		self.assertIsNotNone(doc.completed_at)
		self.assertIsNotNone(doc.closed_at)
		
		# Verify compliance_result did NOT change automatically (independent)
		self.assertEqual(doc.compliance_result, "Pending")
		
		# Verify we can set compliance_result to Passed independently
		doc.compliance_result = "Passed"
		doc.before_save()
		self.assertEqual(doc.compliance_result, "Passed")
		self.assertEqual(doc.status, "Completed")
