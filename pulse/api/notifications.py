# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe.utils import now

from pulse.api.auth import get_current_employee


def _current_employee():
	try:
		return get_current_employee()
	except Exception:
		return None


def create_notification(
	recipient: str,
	title: str,
	body: str | None = None,
	notif_type: str = "Custom",
	severity: str = "Info",
	priority: str = "Normal",
	source_doctype: str | None = None,
	source_name: str | None = None,
) -> str:
	"""Insert a Pulse Notification (system path; bypasses row perm checks)."""
	if not recipient or not title:
		return ""
	doc = frappe.get_doc(
		{
			"doctype": "Pulse Notification",
			"recipient": recipient,
			"title": title,
			"body": body,
			"notification_type": notif_type or "Custom",
			"severity": severity or "Info",
			"priority": priority or "Normal",
			"source_doctype": source_doctype,
			"source_name": source_name,
			"is_read": 0,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


@frappe.whitelist()
def get_my_notifications(limit: int = 30, unread_only: int | str = 0):
	emp = _current_employee()
	if not emp:
		return []
	emp_name = emp.get("name") if isinstance(emp, dict) else emp
	limit = int(limit or 30)
	unread = str(unread_only) in ("1", "true", "True", "yes", "Yes")
	filters: dict = {"recipient": emp_name}
	if unread:
		filters["is_read"] = 0
	return frappe.get_all(
		"Pulse Notification",
		filters=filters,
		fields=[
			"name",
			"title",
			"body",
			"notification_type",
			"severity",
			"priority",
			"source_doctype",
			"source_name",
			"is_read",
			"creation",
		],
		order_by="creation desc",
		limit_page_length=limit,
	)


@frappe.whitelist()
def mark_notification_read(notification_name: str):
	emp = _current_employee()
	if not emp:
		frappe.throw("Not logged in.")
	emp_name = emp.get("name") if isinstance(emp, dict) else emp
	owner = frappe.db.get_value("Pulse Notification", notification_name, "recipient")
	if owner != emp_name:
		frappe.throw("Not allowed.")
	frappe.db.set_value(
		"Pulse Notification",
		notification_name,
		{"is_read": 1, "read_at": now()},
		update_modified=False,
	)
	return {"ok": True}


@frappe.whitelist()
def mark_all_read():
	emp = _current_employee()
	if not emp:
		frappe.throw("Not logged in.")
	emp_name = emp.get("name") if isinstance(emp, dict) else emp
	for name in frappe.get_all(
		"Pulse Notification",
		filters={"recipient": emp_name, "is_read": 0},
		pluck="name",
	):
		frappe.db.set_value("Pulse Notification", name, {"is_read": 1, "read_at": now()}, update_modified=False)
	return {"ok": True}
