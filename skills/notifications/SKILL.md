---
name: notifications
description: >
  In-app notification system for alerting users about run deadlines, failed items, 
  follow-up actions, and system events. Supports severity levels, read status, 
  and source document linking. Consult when adding user alerts or notification UI.
category: features
---

# Notification System

## Overview

Pulse Notification is an in-app alerting system that keeps users informed about operational events without relying on email or external channels. It supports:
- Run deadline reminders
- Item failure alerts
- Follow-up action notifications
- System announcements

Notifications are scoped to individual employees and can be marked as read/unread.

## Key Files

| File | Purpose |
|------|---------|
| `pulse/pulse_core/doctype/pulse_notification/` | Notification storage DocType |
| `pulse/api/notifications.py` | API for CRUD and marking read (if exists) |
| `frontend/src/components/layout/Topbar.tsx` | Notification bell icon + dropdown |
| `frontend/src/components/notifications/` | Notification list, item components |

## How It Works

### 1. Notification Structure

```python
{
  "recipient": "PLS-EMP-0001",           # Target employee
  "title": "Kitchen Open Checklist Failed",
  "body": "Refrigerator temp check failed. Corrective action required.",
  "notification_type": "ItemFail",       # RunAlert/ItemFail/FollowUpCreated/System/Custom
  "severity": "Warning",                 # Info/Warning/Critical
  "priority": "High",                    # Low/Normal/High/Urgent
  "source_doctype": "SOP Run Item",
  "source_name": "SOP-Run-Item-00042",
  "is_read": False,
  "read_at": None
}
```

### 2. Trigger Points

Notifications are created programmatically at key events:

```
Run overdue → Create RunAlert notification
Item marked Fail → Create ItemFail notification
Follow-up rule executes → Create FollowUpCreated notification
System maintenance → Create System notification
```

Example:
```python
def notify_item_failed(run_item):
    frappe.get_doc({
        "doctype": "Pulse Notification",
        "recipient": run_item.employee,
        "title": f"Item Failed: {run_item.checklist_item}",
        "body": f"Run: {run_item.parent}",
        "notification_type": "ItemFail",
        "severity": "Warning",
        "source_doctype": "SOP Run Item",
        "source_name": run_item.name
    }).insert()
```

### 3. UI Presentation

```
Topbar
├── Notification Bell (badge = unread count)
│   └── Dropdown
│       ├── Unread notifications (newest first)
│       ├── Mark all read button
│       └── View all → Notification page
```

Clicking a notification:
1. Marks it read
2. Navigates to source document (if linked)

### 4. Read Status Management

```python
# Mark single notification read
def mark_read(notification_name):
    doc = frappe.get_doc("Pulse Notification", notification_name)
    doc.is_read = True
    doc.read_at = now()
    doc.save()

# Mark all read for user
def mark_all_read(employee):
    frappe.db.set_value("Pulse Notification", 
        {"recipient": employee, "is_read": False},
        {"is_read": True, "read_at": now()}
    )
```

## Extension Points

### New Notification Types

Add to `Pulse Notification` DocType options:
1. Add to `notification_type` Select field
2. Add handler in triggering code
3. Update UI to show appropriate icon/color

### Push Notifications

For browser/mobile push:
1. Add Service Worker registration
2. Store push subscription on employee record
3. Send push via Web Push API when notification created
4. Handle click to open specific Pulse route

### Notification Preferences

Add user preferences:
1. New DocType `Notification Preference` (employee × notification_type)
2. Options: InApp, Email, Push, None
3. Check preferences before creating notifications
4. Add preferences UI in User Profile

### Digest Emails

Daily/weekly summary:
1. Scheduled job aggregates unread notifications
2. Generates email digest
3. Sends via Frappe email system
4. Includes "View in Pulse" links

## Dependencies

- **Pulse Employee** — Recipient identification
- **Frappe Notification** — Can use for email fallback
- **Source DocTypes** — SOP Run, Run Item, etc.

## Gotchas

1. **Volume Control:** High-frequency events (every item completion) could flood notifications. Only notify on important state changes.

2. **Notification Fatigue:** Allow users to mute specific types or set "do not disturb" hours.

3. **Source Document Deletion:** If source SOP Run is deleted, notification links become broken. Consider soft deletes or cascade.

4. **Unread Count Performance:** Calculating unread count on every page load is expensive. Cache in Redis or calculate periodically.

5. **Mobile View:** Notification dropdown needs touch-friendly sizing. Test on actual devices.
