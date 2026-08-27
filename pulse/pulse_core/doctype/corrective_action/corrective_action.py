# Copyright (c) 2026, Tridz and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class CorrectiveAction(Document):
	"""Tracks flagged failures and the corrective action loop.

	Domain glossary mapping (see CONTEXT.md and docs/execution/):

	- run: SOP Run (Link) — the source SOP Run event that triggered this follow-up work.
	- run_item_ref: Data — optional reference to a specific run item if the failure was item-scoped.
	- description: Small Text — details of the corrective action required; immutable once raised.
	- status: Select — lifecycle state (Open, In Progress, Resolved, Closed) for tracking resolution flow.
	- assigned_to: Pulse Employee (Link) — who owns resolving this action. Should be resolvable
	  via resolve_escalation_target(run.employee) for the default case (e.g., the failed operator's
	  direct manager). Set by the raising manager, optionally defaulted to escalation target.
	- raised_by: Pulse Employee (Link) — who identified and raised this follow-up work (the calling
	  manager or leader); immutable once created.
	- priority: Select — urgency level (Low, Medium, High, Critical) set by the raiser.
	- resolution: Small Text — narrative record of how the action was resolved; filled during closure.
	- resolved_at: Datetime — timestamp when the action was marked resolved or closed.
	- evidence: Attach Image — optional proof or documentation of the corrective action completion.

	This doctype exists to create a future-safe path for manager-initiated follow-up work that
	traces back to failed SOP runs. The run link satisfies the domain contract: "Manager work can
	be traced back to the failed SOP run." No automatic triggers create these (avoiding arbitrary
	automation chains per non-goal); creation is manager-initiated via whitelisted API.
	"""

	pass
