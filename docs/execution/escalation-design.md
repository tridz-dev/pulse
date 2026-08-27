# Escalation Target Resolver Design (S5-T02)

## Overview

The escalation target resolver determines WHO should receive an escalation notification when an operator's SOP run fails. This module is responsible only for resolving the target identity; it does NOT send notifications, does NOT modify permissions, and does NOT touch notification delivery. Those concerns are handled separately by the API/permission layer.

## Current Implementation

### Default Escalation Target: Direct Manager

The resolver implements the simplest and most common escalation pattern:

**Default target = employee's direct manager (reports_to field)**

#### Function Signature

```python
def resolve_escalation_target(employee: str) -> str | None:
```

**Parameters:**
- `employee`: Pulse Employee name (the operator whose run failed)

**Returns:**
- The name of the escalation target (a Pulse Employee name), or `None` if:
  - The employee does not exist
  - The employee is not active  
  - The employee has no manager assigned
  - The manager is not active

#### Implementation Details

The resolver:
1. Validates the employee parameter (non-empty string)
2. Queries the Pulse Employee doctype for the employee record with `is_active=1`
3. Extracts the `reports_to` field (the manager's employee name)
4. Verifies the manager is also an active employee
5. Returns the manager name or `None`

This pattern reuses the existing hierarchy validation and structure already in `pulse/domain/hierarchy.py` and `pulse/api/permissions.py`, but via direct field access rather than the full hierarchy scope functions. The resolver is purely data-retrieval; all Frappe database access is delegated to frappe.db methods.

## Future Extension: Override Support

The escalation target can be overridden on a per-employee or per-failure-reason basis without changing the core resolver logic. This is designed as follows:

### Proposed Escalation Policy DocType (Future Work)

```
Escalation Policy
├─ name: string (auto-generated)
├─ employee: Link to Pulse Employee (the employee to configure)
├─ reason: Select (e.g. "Repeated Failure", "Critical SOP", etc.)
├─ override_target: Link to Pulse Employee (optional override manager)
├─ override_group: Link to custom group (optional override group)
└─ is_active: Check (default 1)
```

### Resolution Flow with Overrides (Future)

When escalation target resolution is called:

1. **Query Escalation Policy** for a match on (employee, reason)
2. **If override found:**
   - If `override_target` is set, use that employee
   - If `override_group` is set, use that group
3. **Otherwise:** Fall back to direct manager (reports_to) via `resolve_escalation_target()`

### Design Principle: Keep Pure Functions Pure

To maintain the resolver's purity and testability:

1. The core `resolve_escalation_target(employee: str)` function remains unchanged
2. Policy lookup and override logic moves to a **separate caller function** (e.g., `resolve_with_overrides(employee, reason)`) in the API layer
3. The resolver is called as a fallback only if no override policy is found
4. This separation keeps the resolver pure (single responsibility: return the default manager) while allowing the caller to layer policy on top

### Example Future Usage

```python
# In API/notification handler:
from pulse.domain.escalation import resolve_escalation_target
from pulse.api.escalation_policy import get_escalation_target

def handle_operator_failure(run_doc):
    # Try policy first
    target = get_escalation_target(run_doc.operator, reason="Operator Failure")
    
    # Fall back to direct manager
    if not target:
        target = resolve_escalation_target(run_doc.operator)
    
    # Then handle notification/permissions separately
    if target:
        notify_escalation_target(target, run_doc)
```

## Integration Points

### Caller Responsibility

When calling `resolve_escalation_target()`:

1. **Don't send notifications from the resolver** — the caller handles that
2. **Don't assume permissions are granted** — callers must check via `pulse.api.permissions`
3. **Pass only valid employee names** — the resolver returns None for invalid/inactive employees, which signals "no escalation target"

### Existing Hierarchy Logic Reuse

The resolver does NOT reimplement hierarchy walking. Instead:

- It uses direct field access (`reports_to`) to get the immediate manager
- For multi-level escalation (if needed in future), callers can loop: `while target: target = resolve_escalation_target(target)`
- This avoids reinventing the hierarchy validation logic already in `pulse/domain/hierarchy.py`

## Non-Goals (Out of Scope)

- **Notification delivery:** The resolver returns a target; sending notifications (WhatsApp, Telegram, email) is handled separately
- **Permission changes:** The resolver doesn't modify who can see or act on escalations
- **Custom escalation workflows:** Policy storage and multi-level escalation are future work
- **Group-based escalation:** Can be designed as part of override system, but not implemented yet

## Testing

The resolver is tested against the actual Pulse Employee data in the demo bench:

- **Test Case 1:** Employee with manager (PLS-EMP-0002 → PLS-EMP-0001)
- **Test Case 2:** Top-level employee with no manager (PLS-EMP-0001 → None)
- **Test Case 3:** Multi-level hierarchy (PLS-EMP-0005 → PLS-EMP-0003)
- **Test Case 4:** Invalid/non-existent employee → None
- **Test Case 5:** Inactive employee → None

All test cases verify the resolver returns the correct direct manager or None as appropriate.

## File Location

- **Resolver module:** `pulse/domain/escalation.py`
- **Function:** `resolve_escalation_target(employee: str) -> str | None`

## Future Considerations

1. **Policy DocType:** Create `Escalation Policy` to store overrides
2. **Reason-based routing:** Extend to escalate different failure reasons to different targets
3. **Group escalation:** Route to group instead of individual
4. **Depth control:** Allow escalation to nth-level manager if direct manager is unavailable
5. **Notifications:** Wire resolver output to notification system (separate module)
6. **Permissions:** Integrate with `pulse.api.permissions` to ensure escalation targets can view/act on escalations
