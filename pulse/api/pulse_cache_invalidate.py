# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Doc event hooks: clear Redis-backed Pulse API caches when run data changes."""

from __future__ import annotations

import frappe


def _clear_api_caches() -> None:
	try:
		from pulse.api.pulse_cache import clear_pulse_api_redis_caches

		clear_pulse_api_redis_caches()
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Pulse: clear_pulse_api_redis_caches failed")


def on_sop_run_saved(doc, method=None):
	"""Registered on SOP Run on_update."""
	_clear_api_caches()


def on_sop_run_item_saved(doc, method=None):
	"""Registered on SOP Run Item on_update."""
	_clear_api_caches()
