# Copyright (c) 2026, Tridz and contributors
# License: MIT

import unittest

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
