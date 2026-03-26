---
name: pulse-admin
description: Manage Pulse app organizational structure - branches, employees, departments, and hierarchy. Use when creating or managing organizational data in Pulse, setting up new locations, onboarding employees, or configuring department structure. Covers backend API usage (branches.py, employees.py, departments.py) and frontend admin UI workflows.
---

# Pulse Admin Skill

Manage organizational structure in the Pulse SOP tracking application.

## Quick Reference

| Task | API | Frontend Route |
|------|-----|----------------|
| List branches | `pulse.api.branches.get_branches` | `/admin/branches` |
| Create branch | `pulse.api.branches.create_branch` | `/admin/branches/new` |
| List employees | `pulse.api.employees.get_employees` | `/admin/employees` |
| Create employee | `pulse.api.employees.create_employee` | `/admin/employees/new` |
| List departments | `pulse.api.departments.get_departments` | `/admin/departments` |
| Create department | `pulse.api.departments.create_department` | `/admin/departments` (dialog) |

## Creating a Branch

**Backend API:**
```python
# POST /api/method/pulse.api.branches.create_branch
{
  "values": {
    "branch_name": "Downtown Store",
    "branch_code": "DT001",
    "city": "New York",
    "address": "123 Main St",
    "opening_time": "08:00",
    "closing_time": "22:00",
    "is_active": 1
  }
}
```

**Frontend:** Navigate to `/admin/branches`, click "Add Branch", fill form.

## Creating an Employee (with User Account)

**Backend API:**
```python
# POST /api/method/pulse.api.employees.create_employee
{
  "values": {
    "employee_name": "John Smith",
    "email": "john@company.com",
    "pulse_role": "Operator",  # Executive | Area Manager | Supervisor | Operator
    "branch": "Downtown Store",
    "department": "Kitchen",  # optional
    "reports_to": "PLS-EMP-0001"  # optional - manager's employee ID
  },
  "create_user_account": true
}
```

**Response includes temp_password:**
```json
{
  "success": true,
  "name": "PLS-EMP-0851",
  "temp_password": "nkFk6sStvw"
}
```

**Frontend Wizard:** 4-step process at `/admin/employees/new`:
1. Basic Info (name, email)
2. Role & Hierarchy (select role, reports_to)
3. Assignment (branch, department)
4. Review & Create

## Employee Hierarchy

**Key Concepts:**
- `reports_to` field creates the org tree
- `pulse_role` determines system permissions
- Roles: Executive (4) → Area Manager (3) → Supervisor (2) → Operator (1)

**Get hierarchy:**
```python
# GET /api/method/pulse.api.employees.get_employee_hierarchy
{
  "employee_name": "PLS-EMP-0001"  # optional, omit for full tree
}
```

## Data Model Reference

**Pulse Branch:**
- `branch_name` (PK), `branch_code`, `city`, `state`, `country`
- `branch_manager` (Link→Pulse Employee)
- `opening_time`, `closing_time`, `is_active`

**Pulse Employee:**
- `name` (auto: PLS-EMP-####), `employee_name`, `user` (Link→User)
- `pulse_role` (Link→Pulse Role), `branch` (Link→Pulse Branch)
- `department` (Link→Pulse Department), `reports_to` (self-link)

**Pulse Department:**
- `department_name` (PK), `description`, `is_active`

## Common Patterns

**Bulk Operations:**
- Use `get_employee_options()` for dropdowns
- Use `get_branch_options()` for branch selectors
- Use `get_department_options()` for department selectors

**Permissions:**
- Executive: Full access to all org management
- Area Manager: Can manage employees in their branch
- Supervisor: View-only for admin
- Operator: No admin access

## Migration Notes

When changing Employee.branch from Data to Link field:
1. Create Pulse Branch records for existing text values
2. Update employee records with new branch links
3. See `pulse/patches/migrate_branch_to_link.py`

## Testing Credentials (Demo)

| Role | Email | Password |
|------|-------|----------|
| Executive | chairman@pm.local | Demo@123 |
| Area Manager | rm.north@pm.local | Demo@123 |
| Supervisor | bm.n1@pm.local | Demo@123 |
| Operator | chef.n1@pm.local | Demo@123 |

## Related Files

- Backend APIs: `pulse/api/branches.py`, `pulse/api/employees.py`, `pulse/api/departments.py`
- Frontend Pages: `frontend/src/pages/admin/Branches.tsx`, `Employees.tsx`, `Departments.tsx`
- DocTypes: `pulse/pulse_setup/doctype/pulse_branch/`, `pulse_employee/`, `pulse_department/`
