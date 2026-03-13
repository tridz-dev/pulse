# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""API to load or clear Pulse demo data (for already-set-up sites)."""

import frappe


@frappe.whitelist()
def get_demo_status():
	"""
	Return whether the current user can load/clear demo data and whether demo data exists.
	Used by the UI to show a "Load demo data" option for admins on already-set-up sites.
	"""
	if frappe.session.user == "Guest":
		return {"can_load_demo": False, "can_clear_demo": False, "has_demo_data": False}
	roles = frappe.get_roles()
	can = "System Manager" in roles or "Pulse Admin" in roles
	has_demo = frappe.db.count("Pulse Employee") > 0
	return {
		"can_load_demo": can,
		"can_clear_demo": can,
		"has_demo_data": has_demo,
	}


@frappe.whitelist()
def install_demo_data(enqueue=True):
	"""
	Load Pulse demo data (users, employees, SOPs, ~30 days of runs and scores).
	Allowed for System Manager or PM Admin. Use when the site was set up without the
	setup-wizard "Load demo data" checkbox.
	"""
	if frappe.session.user == "Guest":
		frappe.throw("Not allowed for Guest.")
	roles = frappe.get_roles()
	if "System Manager" not in roles and "Pulse Admin" not in roles:
		frappe.throw("Only System Manager or PM Admin can load demo data.")

	if frappe.db.count("Pulse Employee") > 0:
		frappe.msgprint("Demo data already present. Use clear_demo_data first if you want to re-seed.")
		return {"ok": False, "message": "Demo data already exists."}

	if enqueue is not False and str(enqueue).lower() not in ("0", "false"):
		from pulse.seed.seed import seed_dummy_data

		frappe.enqueue(seed_dummy_data, enqueue_after_commit=True, at_front=True)
		return {"ok": True, "message": "Demo data load queued. It will run in the background."}

	from pulse.seed.seed import seed_dummy_data

	seed_dummy_data()
	frappe.db.commit()
	return {"ok": True, "message": "Demo data loaded."}


@frappe.whitelist()
def clear_demo_data():
	"""
	Remove all Pulse demo data and demo users.
	Allowed for System Manager or PM Admin.
	"""
	if frappe.session.user == "Guest":
		frappe.throw("Not allowed for Guest.")
	roles = frappe.get_roles()
	if "System Manager" not in roles and "Pulse Admin" not in roles:
		frappe.throw("Only System Manager or PM Admin can clear demo data.")

	from pulse.seed.seed import clear_dummy_data

	clear_dummy_data()
	return {"ok": True, "message": "Demo data cleared."}
