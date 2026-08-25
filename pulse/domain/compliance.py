# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Pure compliance policy: classify generated SOP runs and aggregate counts.

This module contains no Frappe database access. Callers fetch runs and pass them
in; the classifier decides Passed/Failed eligibility and the resulting score.
"""


def classify_runs(runs: list[dict], evaluation_instant: object = None) -> dict:
	"""Classify a collection of SOP Run rows by their stored compliance_result.

	Args:
		runs: list of run dicts, each containing at least a
			``compliance_result`` key ("Pending", "Passed", "Failed" or absent).
		evaluation_instant: reserved for future deadline-based derivation; not
			used in the first milestone because compliance_result is the single
			source of truth once materialised by the deadline-finalisation job.

	Returns:
		dict with ``passed_runs``, ``failed_runs``, ``eligible_runs`` and
		``score`` (a float 0.0-1.0, or ``None`` when no runs are eligible).

	Rules:
		* Passed and Failed runs are eligible and have equal weight.
		* Pending runs are excluded from eligible_runs.
		* Runs with a missing or unknown compliance_result are excluded.
		* No eligible runs means ``score: None`` (never zero).
	"""
	passed = 0
	failed = 0

	for run in runs:
		result = (run.get("compliance_result") or "").strip()
		if result == "Passed":
			passed += 1
		elif result == "Failed":
			failed += 1
		# Pending or any other value is not eligible.

	eligible = passed + failed
	return {
		"passed_runs": passed,
		"failed_runs": failed,
		"eligible_runs": eligible,
		"score": (passed / eligible) if eligible else None,
	}
