---
name: permissions
description: >
  Role-based access control (RBAC) implementing row-level security. Maps business 
  roles (Operator, Supervisor, Area Manager, Executive) to data visibility scopes. 
  Consult when modifying access rules, adding new DocTypes, or fixing permission issues.
category: patterns
---

# Permissions & Access Control

## Overview

Pulse implements a 4-level role hierarchy that determines what data each user can see and modify. Unlike simple role-based permissions, Pulse uses **row-level conditions** — an operator sees only their runs, a supervisor sees their team's runs, an area manager sees their subtree, and an executive sees everything.

## Key Files

| File | Purpose |
|------|---------|
| `pulse/api/permissions.py` | Row-level query conditions for each DocType |
| `pulse/hooks.py` | Registers permission hooks |
| `pulse/install.py` | Creates system roles on install |
| `pulse/pulse_setup/doctype/pulse_role/` | Business role definitions |

## How It Works

### 1. Role Hierarchy

| Level | Business Role | System Role | Visibility Scope |
|-------|---------------|-------------|------------------|
| 1 | Operator | Pulse User | Own records only |
| 2 | Supervisor | Pulse Manager | Own + direct reports |
| 3 | Area Manager | Pulse Leader | Full subtree (recursive) |
| 4 | Executive | Pulse Executive | Entire organization |
| — | Admin | Pulse Admin | Everything |

### 2. Row-Level Conditions

Frappe's permission system allows injecting WHERE clauses via hooks:

```python
# hooks.py
permission_query_conditions = {
    "SOP Run": "pulse.api.permissions.sop_run_conditions",
    "Score Snapshot": "pulse.api.permissions.score_snapshot_conditions",
    "Corrective Action": "pulse.api.permissions.corrective_action_conditions",
}
```

Each function returns a SQL condition string:

```python
def sop_run_conditions(user):
    employee = get_current_employee_for_user(user)
    
    if employee["system_role"] == "Pulse Executive":
        return ""  # No restriction
    
    elif employee["system_role"] == "Pulse Leader":
        subtree = get_subtree_employee_ids(employee["name"])
        return f"employee in ({', '.join(subtree)})"
    
    elif employee["system_role"] == "Pulse Manager":
        reports = get_direct_reports(employee["name"])
        return f"employee in ('{employee['name']}', {', '.join(reports)})"
    
    else:  # Pulse User
        return f"employee = '{employee['name']}'"
```

### 3. API-Level Validation

In addition to row-level conditions, APIs validate explicitly:

```python
@frappe.whitelist()
def get_run_details(run_name):
    run = frappe.get_doc("SOP Run", run_name)
    current = get_current_employee()
    
    # Validate can_view
    if not can_view_run(current, run):
        frappe.throw("Not permitted", frappe.PermissionError)
    
    return run

def can_view_run(employee, run):
    if employee["level"] >= 4:  # Executive/Admin
        return True
    if run.employee == employee["name"]:
        return True
    if run.employee in get_subtree_employees(employee):
        return True
    return False
```

### 4. Frontend Role Checks

UI conditionally renders based on `employee.level`:

```tsx
// Sidebar navigation
{employee.level >= 2 && <NavLink to="/team">My Team</NavLink>}
{employee.level >= 3 && <NavLink to="/operations">Operations</NavLink>}
{employee.level >= 3 && <NavLink to="/insights">Insights</NavLink>}
```

Route guards redirect unauthorized users:
```tsx
// ProtectedRoute component
if (requiredLevel > employee.level) {
  return <Navigate to="/" />;
}
```

## Extension Points

### Adding a New DocType

1. Create DocType with appropriate permissions:
```python
# DocType permissions
defaults = [
    {"role": "Pulse Admin", "read": 1, "write": 1, "create": 1, "delete": 1},
    {"role": "Pulse Executive", "read": 1},
    {"role": "Pulse Leader", "read": 1},
    {"role": "Pulse Manager", "read": 1},
    {"role": "Pulse User", "read": 1},
]
```

2. Add row-level condition in `hooks.py`:
```python
permission_query_conditions["My DocType"] = "pulse.api.permissions.my_doctype_conditions"
```

3. Implement condition function in `permissions.py`

### Custom Permission Logic

For field-level permissions (e.g., only managers can see "failure_remark"):

```python
# In API method
def get_run_details(run_name):
    run = frappe.get_doc("SOP Run", run_name)
    current = get_current_employee()
    
    data = run.as_dict()
    
    # Remove sensitive fields for non-managers
    if current["level"] < 2:
        for item in data["run_items"]:
            item["failure_remark"] = None
    
    return data
```

### Branch/Department Isolation

To restrict users to their own branch:

```python
def apply_branch_scope(query, employee):
    if employee["level"] >= 4:
        return query
    return query.where(SOPRun.branch == employee["branch"])
```

## Dependencies

- **Frappe Permission System** — Core RBAC
- **Pulse Role** — Business role definitions
- **Pulse Employee** — Hierarchy for scope calculation

## Gotchas

1. **Caching Issues:** Frappe caches permission conditions. After permission changes, run `bench clear-cache`.

2. **SQL Injection:** Never concatenate user input into permission SQL. Use parameterized queries.

3. **Subtree Calculation:** Recursive queries for subtree can be slow. Consider materialized paths for large orgs (1000+ employees).

4. **Synthetic Admin:** System Managers without employee records get synthetic admin profile. This bypasses normal permission checks — be careful.

5. **Client-Side Validation:** Frontend role checks are for UX only. Always validate server-side.

6. **DocType-Level vs Row-Level:** DocType permissions control CRUD. Row-level conditions filter lists. Both are needed.
