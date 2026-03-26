# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Central Redis cache invalidation for Pulse API layers."""

from __future__ import annotations


def clear_pulse_api_redis_caches() -> None:
	"""Clear Redis-backed @redis_cache entries used by dashboard, tasks, and Go home."""
	targets = (
		("pulse.api.scores", "_calculate_score_snapshot"),
		("pulse.api.scores", "_failure_analytics_cached"),
		("pulse.api.tasks", "_fetch_runs_for_employee_raw"),
		("pulse.api.go", "_pulse_home_summary_cached"),
	)
	for mod_name, attr in targets:
		try:
			mod = __import__(mod_name, fromlist=[attr])
			fn = getattr(mod, attr, None)
			if fn is not None and hasattr(fn, "clear_cache"):
				fn.clear_cache()
		except Exception:
			continue
