# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import now


class SOPRun(Document):
	"""A specific instance of a template execution for a given period."""

	def before_save(self):
		self._recompute_totals()
		if self.has_value_changed("status") and self.status == "Closed":
			self.closed_at = now()

	def _recompute_totals(self):
		rows = self.run_items or []
		total = len(rows)
		completed = failed = missed = passed = 0
		na_score = 0
		for r in rows:
			st = r.status or "Pending"
			if st == "Missed":
				missed += 1
			elif st == "NotApplicable":
				na_score += 1
			elif st == "Completed":
				completed += 1
				out = (getattr(r, "outcome", None) or "").strip()
				om = getattr(r, "outcome_mode", None) or "SimpleCompletion"
				if out == "NotApplicable":
					na_score += 1
				elif om == "PassFail":
					if out == "Pass":
						passed += 1
					elif out == "Fail":
						failed += 1
				else:
					passed += 1
		self.total_items = total
		self.completed_items = completed
		self.failed_items = failed
		self.missed_items = missed
		self.passed_items = passed
		pending = sum(1 for r in rows if (r.status or "Pending") == "Pending")
		self.progress = ((total - pending) / total * 100) if total else 0
		scorable = total - na_score
		self.score = (passed / scorable * 100) if scorable else 0
