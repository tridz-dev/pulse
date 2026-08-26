# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Pure compliance policy: classify generated SOP runs and aggregate counts.

This module contains no Frappe database access. Callers fetch runs and pass them
in; the classifier decides Passed/Failed eligibility and the resulting score.
"""


def classify_runs(runs: list[dict], evaluation_instant: object = None) -> dict:
	"""Classify a collection of SOP Run rows for scoring.

	Args:
		runs: list of run dicts, each containing at least a
			``compliance_result`` key ("Pending", "Passed", "Failed" or absent),
			plus ``due_at`` for read-time derivation of runs that are still
			``Pending`` in storage.
		evaluation_instant: the instant to classify against. When a run's
			stored ``compliance_result`` is already ``Passed`` or ``Failed``
			it is used as-is (those are immutable once finalized). When it is
			``Pending`` (or absent), the run is read-time-derived as Failed
			if its ``due_at`` is at or before ``evaluation_instant`` — this is
			what keeps a five-minute scheduler interval from delaying a
			score, per the frozen domain contract. ``due_at`` and
			``evaluation_instant`` must be comparable (e.g. both naive UTC
			datetimes, matching how ``due_at`` is stored). If
			``evaluation_instant`` is ``None``, no read-time derivation is
			performed and a Pending run is simply excluded.

	Returns:
		dict with ``passed_runs``, ``failed_runs``, ``eligible_runs`` and
		``score`` (a float 0.0-1.0, or ``None`` when no runs are eligible).

	Rules:
		* Passed and Failed runs (as stored) are eligible and have equal
		  weight; a stored result is never re-derived or overwritten.
		* A Pending run past its due_at (relative to evaluation_instant) is
		  read-time-derived as Failed for scoring purposes only.
		* A Pending run before its due_at is excluded from eligible_runs.
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
		elif result == "Pending":
			due_at = run.get("due_at")
			if evaluation_instant is not None and due_at is not None and due_at <= evaluation_instant:
				failed += 1
			# else: still genuinely pending (or no due_at to derive from) — excluded.
		# Missing/unknown compliance_result is not eligible.

	eligible = passed + failed
	return {
		"passed_runs": passed,
		"failed_runs": failed,
		"eligible_runs": eligible,
		"score": (passed / eligible) if eligible else None,
	}
