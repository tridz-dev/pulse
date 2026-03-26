---
name: auth
description: >
  Authentication system linking Frappe Users to Pulse Employees. Handles session 
  management, role resolution, and the get_current_employee() API that underlies 
  all role-based visibility in Pulse. Consult when working on login flows, 
  permission checks, employee resolution, or role-based UI rendering.
category: features
---

# Authentication & Employee Resolution

## Overview

Pulse uses Frappe's built-in authentication but adds a layer of **employee resolution** that maps each logged-in Frappe User to a Pulse Employee record. This mapping determines what data the user can see and what actions they can perform.

The key abstraction is `get_current_employee()` — almost every API call starts here to resolve the user's identity, role level, and organizational context (branch, department, reports_to chain).

## Key Files

| File | Purpose |
|------|---------|
| `pulse/api/auth.py` | `get_current_employee()` — resolves user → employee + role info |
| `pulse/api/permissions.py` | Row-level permission conditions for SOP Run, Score Snapshot, Corrective Action |
| `frontend/src/store/AuthContext.tsx` | React context that loads employee info on app mount |
| `frontend/src/services/auth.ts` | Frontend service wrapping auth API |
| `frontend/src/types/index.ts` | TypeScript types for Employee, Role, AuthState |

## How It Works

### 1. Login Flow

```
User logs in via Frappe (/login)
         ↓
Frappe session established
         ↓
React app loads → AuthContext.mount() calls get_current_employee()
         ↓
Backend looks up Pulse Employee where employee.user = frappe.session.user
         ↓
Returns: employee profile + pulse_role + department + branch + reports_to chain
```

### 2. Employee Resolution (`get_current_employee`)

```python
# Returns dict with:
{
  "name": "PLS-EMP-0001",
  "employee_name": "Arun Bhat",
  "pulse_role": "Operator",           # Business role name
  "level": 1,                          # 1=Operator, 2=Supervisor, 3=AM, 4=Exec
  "system_role": "Pulse User",         # Frappe role for permission checks
  "branch": "Branch N1",
  "department": "Kitchen",
  "reports_to": "PLS-EMP-0005",        # Manager's employee ID
  # ... plus avatar_url, is_active, etc.
}
```

**Synthetic Admin Profile:** System Managers and Pulse Admins without an employee record get a synthetic profile with `level: 4` and `system_role: "Pulse Admin"` for full access.

### 3. Role-Based UI Rendering

The frontend uses `employee.level` to conditionally render navigation:

```tsx
// Sidebar.tsx example
{employee.level >= 2 && (
  <NavLink to="/team">My Team</NavLink>
)}
{employee.level >= 3 && (
  <NavLink to="/operations">Operations</NavLink>
)}
```

### 4. API Permission Enforcement

Every whitelisted API method should validate access using the resolved employee:

```python
@frappe.whitelist()
def get_runs_for_employee(employee, date=None):
    current = get_current_employee()
    # Validate: can current user view target employee's runs?
    if not can_view_employee(current, employee):
        frappe.throw("Not permitted", frappe.PermissionError)
```

## Extension Points

### Adding a New Role Level

1. Add to `Pulse Role` DocType in `pulse_setup/doctype/pulse_role/`
2. Update `install.py` to create default record
3. Add system role in `install.create_system_roles()`
4. Update permission conditions in `pulse/api/permissions.py`
5. Update frontend role checks in Sidebar, route guards

### Custom Employee Resolution Logic

Modify `pulse/api/auth.py:get_current_employee()` to:
- Add additional employee attributes
- Implement custom role mapping logic
- Add caching for high-traffic scenarios

### Single Sign-On (SSO)

Frappe supports OAuth providers. To enable:
1. Configure OAuth in Frappe's Social Login Keys
2. Ensure OAuth users get linked to Pulse Employee via email matching
3. Consider auto-creating employee records for new OAuth users

## Dependencies

- **Frappe Framework** — User, Role, Session management
- **Pulse Employee** — Core employee profile DocType
- **Pulse Role** — Business role to system role mapping

## Gotchas

1. **Missing Employee Records:** Users without a linked Pulse Employee get the synthetic admin profile (if System Manager) or an error. This is intentional but can be confusing during setup.

2. **Role Caching:** Frappe caches role permissions aggressively. After changing role permissions, run `bench clear-cache`.

3. **Session Timeout:** Uses Frappe's session settings. The React app doesn't handle session expiry gracefully — user sees 403 errors and must refresh.

4. **Branch/Department Filtering:** Many insights APIs filter by the user's branch/department by default. Executive users see all branches.

5. **reports_to Chain:** The hierarchy is built via `reports_to` links. Cycles in this chain will break recursive queries in `operations.py`.
