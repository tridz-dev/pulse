# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _

from pulse.api.permissions import _get_employee_for_user


@frappe.whitelist()
def list_notifications(unread_only: bool = False, page: int = 1, page_size: int = 20) -> dict:
	"""Return paginated Pulse Notifications for the caller's own Pulse Employee record only.

	Notifications are always self-scoped: a manager does not see their reports'
	notifications, only their own. There is no organisation/subtree scoping here, unlike
	Corrective Action or SOP Run.

	Args:
		unread_only: If true, only return notifications where is_read = 0.
		page: Page number (1-indexed).
		page_size: Number of items per page.

	Returns:
		{
			"items": [
				{
					"name": <Pulse Notification name>,
					"kind": <str>,
					"title": <str>,
					"referenceDoctype": <str or null>,
					"referenceName": <str or null>,
					"isRead": <bool>,
					"createdAt": <datetime>,
				}, ...
			],
			"unreadCount": <int>,
			"page": <int>,
			"page_size": <int>,
			"total": <int>,
		}
	"""
	page = int(page) or 1
	page_size = int(page_size) or 20

	employee = _get_employee_for_user()
	if not employee:
		return {"items": [], "unreadCount": 0, "page": page, "page_size": page_size, "total": 0}

	filters = {"recipient": employee}
	if frappe.utils.cint(unread_only):
		filters["is_read"] = 0

	total = frappe.db.count("Pulse Notification", filters=filters)
	unread_count = frappe.db.count("Pulse Notification", filters={"recipient": employee, "is_read": 0})

	rows = frappe.get_all(
		"Pulse Notification",
		filters=filters,
		fields=[
			"name",
			"kind",
			"title",
			"reference_doctype",
			"reference_name",
			"is_read",
			"creation",
		],
		order_by="creation desc",
		limit_start=(page - 1) * page_size,
		limit_page_length=page_size,
	)

	items = []
	for row in rows:
		items.append({
			"name": row["name"],
			"kind": row["kind"],
			"title": row["title"],
			"referenceDoctype": row.get("reference_doctype"),
			"referenceName": row.get("reference_name"),
			"isRead": bool(row["is_read"]),
			"createdAt": row["creation"],
		})

	return {
		"items": items,
		"unreadCount": unread_count,
		"page": page,
		"page_size": page_size,
		"total": total,
	}


@frappe.whitelist()
def mark_notification_read(name: str) -> dict:
	"""Marks one Pulse Notification as read. Caller must be its recipient.

	Args:
		name: Name of the Pulse Notification to mark read.

	Returns:
		{"name": <name>, "isRead": True}

	Raises:
		frappe.DoesNotExistError: If the notification does not exist.
		frappe.PermissionError: If the caller is not the notification's recipient.
	"""
	if not name:
		frappe.throw(_("Notification name is required."))

	employee = _get_employee_for_user()
	notif = frappe.get_doc("Pulse Notification", name)
	if not notif:
		frappe.throw(
			_("Pulse Notification '{0}' does not exist.").format(name),
			frappe.DoesNotExistError,
		)

	if not employee or notif.recipient != employee:
		frappe.throw(
			_("Not permitted. Notification '{0}' is not yours.").format(name),
			frappe.PermissionError,
		)

	if not notif.is_read:
		notif.is_read = 1
		notif.save(ignore_permissions=True)

	return {"name": notif.name, "isRead": True}


def notify_ca_assigned(
	ca_name: str,
	run_name: str,
	recipient: str,
	kind: str = "CA Assigned",
	description: str | None = None,
) -> None:
	"""Insert a Pulse Notification + send email for a CA assignment. Never raises —
	wraps its own body in try/except so a notification failure can never block the
	caller's real state-changing operation. `kind` is normally "CA Assigned" but
	callers may pass "Escalation" for the escalate flow (both are valid Select
	options on Pulse Notification)."""
	try:
		# Fetch run's template title
		run_template_title = frappe.db.get_value(
			"SOP Run",
			run_name,
			"template_title_snapshot",
		)

		# Resolve recipient employee's user and email
		recipient_user = frappe.db.get_value(
			"Pulse Employee",
			recipient,
			"user",
		)
		recipient_email = None
		if recipient_user:
			recipient_email = frappe.db.get_value("User", recipient_user, "email")

		# Create in-app notification for recipient
		frappe.get_doc({
			"doctype": "Pulse Notification",
			"recipient": recipient,
			"kind": kind,
			"title": f"New corrective action assigned — {run_template_title}.",
			"reference_doctype": "Corrective Action",
			"reference_name": ca_name,
		}).insert(ignore_permissions=True)

		# Send email to recipient if email found
		if recipient_email:
			frappe.sendmail(
				recipients=[recipient_email],
				subject=f"Corrective action assigned: {run_template_title}",
				message=f"You've been assigned a corrective action on run {run_name}: {description}",
			)
		else:
			frappe.logger("notifications").warning(
				f"Could not resolve email for recipient {recipient} on corrective action {ca_name}"
			)
	except Exception as e:
		# Log notification failure but do not crash the operation
		frappe.logger("notifications").error(
			f"Notification insert/send failed for corrective action {ca_name}: {str(e)}"
		)


@frappe.whitelist()
def mark_all_notifications_read() -> dict:
	"""Convenience bulk action for the bell's "mark all read" affordance.

	Marks all of the caller's own unread notifications as read.

	Returns:
		{"updated": <int>}
	"""
	employee = _get_employee_for_user()
	if not employee:
		return {"updated": 0}

	unread_names = frappe.get_all(
		"Pulse Notification",
		filters={"recipient": employee, "is_read": 0},
		pluck="name",
	)

	for name in unread_names:
		frappe.db.set_value("Pulse Notification", name, "is_read", 1, update_modified=False)

	return {"updated": len(unread_names)}
