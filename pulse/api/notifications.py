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
def get_notifications(limit: int = 50, unread_only: int | str = 0):
    """Get current user's notifications with optional unread filter.
    
    Args:
        limit: Maximum number of notifications to return (default: 50)
        unread_only: If 1/true, return only unread notifications
    
    Returns:
        List of notification objects
    """
    emp = _current_employee()
    if not emp:
        return []
    emp_name = emp.get("name") if isinstance(emp, dict) else emp
    limit = int(limit or 50)
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
            "read_at",
        ],
        order_by="creation desc",
        limit_page_length=limit,
    )


@frappe.whitelist()
def get_my_notifications(limit: int = 30, unread_only: int | str = 0):
    """Legacy alias for get_notifications (for backward compatibility)."""
    return get_notifications(limit, unread_only)


@frappe.whitelist()
def get_unread_count() -> int:
    """Get count of unread notifications for current user.
    
    Returns:
        Number of unread notifications
    """
    emp = _current_employee()
    if not emp:
        return 0
    emp_name = emp.get("name") if isinstance(emp, dict) else emp
    return frappe.db.count(
        "Pulse Notification",
        filters={"recipient": emp_name, "is_read": 0}
    )


@frappe.whitelist()
def mark_as_read(notification_id: str):
    """Mark a single notification as read.
    
    Args:
        notification_id: The name/ID of the notification to mark as read
    
    Returns:
        dict with success status
    """
    emp = _current_employee()
    if not emp:
        frappe.throw("Not logged in.", frappe.AuthenticationError)
    emp_name = emp.get("name") if isinstance(emp, dict) else emp
    
    # Verify ownership
    owner = frappe.db.get_value("Pulse Notification", notification_id, "recipient")
    if owner != emp_name:
        frappe.throw("Not allowed to modify this notification.", frappe.PermissionError)
    
    frappe.db.set_value(
        "Pulse Notification",
        notification_id,
        {"is_read": 1, "read_at": now()},
        update_modified=False,
    )
    return {"success": True, "message": "Notification marked as read"}


@frappe.whitelist()
def mark_notification_read(notification_name: str):
    """Legacy alias for mark_as_read (for backward compatibility)."""
    return mark_as_read(notification_name)


@frappe.whitelist()
def mark_all_as_read():
    """Mark all unread notifications as read for current user.
    
    Returns:
        dict with success status and count of marked notifications
    """
    emp = _current_employee()
    if not emp:
        frappe.throw("Not logged in.", frappe.AuthenticationError)
    emp_name = emp.get("name") if isinstance(emp, dict) else emp
    
    unread_names = frappe.get_all(
        "Pulse Notification",
        filters={"recipient": emp_name, "is_read": 0},
        pluck="name",
    )
    
    count = 0
    for name in unread_names:
        frappe.db.set_value(
            "Pulse Notification",
            name,
            {"is_read": 1, "read_at": now()},
            update_modified=False
        )
        count += 1
    
    return {"success": True, "count": count, "message": f"{count} notifications marked as read"}


@frappe.whitelist()
def mark_all_read():
    """Legacy alias for mark_all_as_read (for backward compatibility)."""
    return mark_all_as_read()
