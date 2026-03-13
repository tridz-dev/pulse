# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Setup wizard completion hook: enqueue demo data seed when requested."""

import frappe


def setup_demo(args):
	"""If the user checked 'Load demo data' in the setup wizard, enqueue seed_dummy_data."""
	if not args.get("setup_demo_pulse"):
		return
	try:
		from pulse.seed.seed import seed_dummy_data

		frappe.enqueue(seed_dummy_data, enqueue_after_commit=True, at_front=True)
	except Exception as e:
		frappe.log_error(f"Pulse demo seed failed to enqueue: {e}", "Pulse Setup Wizard")
