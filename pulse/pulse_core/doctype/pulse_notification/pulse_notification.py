# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class PulseNotification(Document):
	"""In-app notification row backing the bell (see docs/execution/scope-c2-notifications.md).

	Domain glossary mapping:

	- recipient: Pulse Employee (Link) — who this notification is for. Always self-scoped: a
	  manager never sees a report's notifications, only their own (enforced in
	  pulse/api/notifications.py, not via a permission_query_conditions entry — see that module
	  for the reasoning).
	- kind: Select — mirrors trigger points T1-T4 (Run Overdue, Escalation, CA Assigned,
	  CA Resolved).
	- title: Data — the in-app display line (see Section 4 templates in the scope doc).
	- reference_doctype / reference_name: standard Frappe Dynamic Link pair back to the SOP Run
	  or Corrective Action that caused this notification, so the bell can deep-link.
	- is_read: Check — whether the recipient has acknowledged this notification.

	No separate created_at field: Frappe's built-in `creation` timestamp is sufficient.

	Rows are created by trigger points (T1-T4, Tasks 2/3) via frappe.get_doc(...).insert(), not
	by user action, so no custom validate() logic is needed here.
	"""

	pass
