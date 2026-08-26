# Copyright (c) 2026, Tridz and contributors
# License: MIT

import unittest
from datetime import datetime

from pulse.domain.compliance import classify_runs


class TestComplianceClassifier(unittest.TestCase):
	"""Pure-domain tests for pulse.domain.compliance.classify_runs."""

	def test_empty_runs_returns_null_score(self):
		"""No generated runs means no eligible runs and score: null."""
		result = classify_runs([])
		self.assertEqual(result["passed_runs"], 0)
		self.assertEqual(result["failed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 0)
		self.assertIsNone(result["score"])

	def test_passed_run_counts_as_one_passed(self):
		result = classify_runs([{"compliance_result": "Passed"}])
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["score"], 1.0)

	def test_failed_run_counts_as_one_failed(self):
		result = classify_runs([{"compliance_result": "Failed"}])
		self.assertEqual(result["passed_runs"], 0)
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["score"], 0.0)

	def test_pending_run_is_not_eligible(self):
		"""A Pending run is excluded from eligible_runs entirely."""
		result = classify_runs([{"compliance_result": "Pending"}])
		self.assertEqual(result["passed_runs"], 0)
		self.assertEqual(result["failed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 0)
		self.assertIsNone(result["score"])

	def test_one_passed_and_one_failed_yields_score_half(self):
		"""One Passed + one Failed run gives eligible=2 and score=0.5."""
		result = classify_runs([
			{"compliance_result": "Passed"},
			{"compliance_result": "Failed"},
		])
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["eligible_runs"], 2)
		self.assertEqual(result["score"], 0.5)

	def test_pending_run_does_not_reduce_score_when_other_runs_are_eligible(self):
		"""Pending is excluded; remaining eligible runs still determine score."""
		result = classify_runs([
			{"compliance_result": "Passed"},
			{"compliance_result": "Pending"},
			{"compliance_result": "Failed"},
		])
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["eligible_runs"], 2)
		self.assertEqual(result["score"], 0.5)

	def test_missing_or_unknown_compliance_result_is_not_eligible(self):
		"""Runs without a recognised compliance_result do not affect the score."""
		result = classify_runs([
			{"compliance_result": "Passed"},
			{"compliance_result": ""},
			{"compliance_result": None},
			{"compliance_result": "Unknown"},
		])
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["score"], 1.0)

	def test_failed_result_is_never_reclassified_as_passed(self):
		"""The classifier reads compliance_result directly and never rewrites it."""
		result = classify_runs([{
			"compliance_result": "Failed",
			"status": "Completed",
			"completed_at": "2026-01-01 09:00:00",
			"due_at": "2026-01-01 10:00:00",
			"progress": 100.0,
		}])
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["passed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["score"], 0.0)

	def test_passed_result_is_used_as_is_regardless_of_evaluation_instant(self):
		"""A stored Passed result is trusted as-is, even if due_at is far in the past."""
		evaluation_instant = datetime(2026, 1, 1, 12, 0, 0)
		result = classify_runs(
			[{
				"compliance_result": "Passed",
				"due_at": datetime(2020, 1, 1, 0, 0, 0),
				"completed_at": datetime(2019, 12, 31, 23, 0, 0),
			}],
			evaluation_instant,
		)
		self.assertEqual(result["passed_runs"], 1)
		self.assertEqual(result["failed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["score"], 1.0)

	def test_pending_run_past_due_at_is_read_time_derived_as_failed(self):
		"""A Pending run whose due_at has elapsed counts as failed/eligible without
		mutating the stored compliance_result."""
		evaluation_instant = datetime(2026, 1, 1, 12, 0, 0)
		run = {
			"compliance_result": "Pending",
			"due_at": datetime(2026, 1, 1, 10, 0, 0),
		}
		result = classify_runs([run], evaluation_instant)
		self.assertEqual(result["passed_runs"], 0)
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["eligible_runs"], 1)
		self.assertEqual(result["score"], 0.0)
		# The input dict itself is never mutated.
		self.assertEqual(run["compliance_result"], "Pending")

	def test_pending_run_before_due_at_stays_excluded(self):
		"""A Pending run whose due_at has not yet elapsed remains excluded."""
		evaluation_instant = datetime(2026, 1, 1, 8, 0, 0)
		result = classify_runs(
			[{
				"compliance_result": "Pending",
				"due_at": datetime(2026, 1, 1, 10, 0, 0),
			}],
			evaluation_instant,
		)
		self.assertEqual(result["passed_runs"], 0)
		self.assertEqual(result["failed_runs"], 0)
		self.assertEqual(result["eligible_runs"], 0)
		self.assertIsNone(result["score"])

	def test_pending_run_at_exact_due_at_is_derived_as_failed(self):
		"""due_at == evaluation_instant counts as elapsed (boundary is inclusive)."""
		instant = datetime(2026, 1, 1, 10, 0, 0)
		result = classify_runs(
			[{"compliance_result": "Pending", "due_at": instant}],
			instant,
		)
		self.assertEqual(result["failed_runs"], 1)
		self.assertEqual(result["eligible_runs"], 1)

	def test_zero_eligible_runs_still_returns_null_score_with_evaluation_instant(self):
		"""Passing evaluation_instant does not change the no-data score:null contract."""
		evaluation_instant = datetime(2026, 1, 1, 8, 0, 0)
		result = classify_runs(
			[{"compliance_result": "Pending", "due_at": datetime(2026, 1, 1, 10, 0, 0)}],
			evaluation_instant,
		)
		self.assertEqual(result["eligible_runs"], 0)
		self.assertIsNone(result["score"])

	def test_pending_run_without_due_at_is_excluded_even_with_evaluation_instant(self):
		"""No due_at means no basis for read-time derivation; stays excluded."""
		evaluation_instant = datetime(2026, 1, 1, 12, 0, 0)
		result = classify_runs(
			[{"compliance_result": "Pending"}],
			evaluation_instant,
		)
		self.assertEqual(result["eligible_runs"], 0)
		self.assertIsNone(result["score"])
