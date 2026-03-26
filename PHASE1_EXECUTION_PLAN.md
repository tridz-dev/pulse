# Phase 1: Org Structure Management - Execution Plan

## Goal
Enable administrators to fully manage organizational structure (branches, departments, employees) through the UI.

---

## Week 1: Branch & Department Management

### Day 1-2: Branch DocType Creation

**Task 1.1: Create Branch DocType**
```python
# File: pulse/pulse/doctype/pulse_branch/pulse_branch.json
{
  "name": "Pulse Branch",
  "fields": [
    {"fieldname": "branch_name", "label": "Branch Name", "fieldtype": "Data", "reqd": 1, "unique": 1},
    {"fieldname": "branch_code", "label": "Branch Code", "fieldtype": "Data", "reqd": 1, "unique": 1},
    {"fieldname": "region", "label": "Region", "fieldtype": "Link", "options": "Pulse Region"},
    {"fieldname": "address", "label": "Address", "fieldtype": "Text"},
    {"fieldname": "city", "label": "City", "fieldtype": "Data"},
    {"fieldname": "state", "label": "State", "fieldtype": "Data"},
    {"fieldname": "country", "label": "Country", "fieldtype": "Data"},
    {"fieldname": "branch_manager", "label": "Branch Manager", "fieldtype": "Link", "options": "Pulse Employee"},
    {"fieldname": "parent_branch", "label": "Parent Branch", "fieldtype": "Link", "options": "Pulse Branch"},
    {"fieldname": "is_active", "label": "Is Active", "fieldtype": "Check", "default": 1},
    {"fieldname": "opening_time", "label": "Opening Time", "fieldtype": "Time"},
    {"fieldname": "closing_time", "label": "Closing Time", "fieldtype": "Time"}
  ]
}
```

**Task 1.2: Update Employee DocType**
- Change `branch` field from Data to Link → Pulse Branch
- Migration script to convert existing text values to links

**Task 1.3: Create Branch API**
```python
# File: pulse/api/branches.py
- get_branches() - List all branches
- get_branch_detail() - Get branch with employee count
- create_branch() - Create new branch
- update_branch() - Update branch
- deactivate_branch() - Soft delete
- get_branch_tree() - Get hierarchical tree
- get_branch_options() - For dropdowns
```

### Day 3-4: Branch Management UI

**Task 1.4: Create Branch List Page**
```typescript
// File: frontend/src/pages/admin/Branches.tsx
- Grid/table view of all branches
- Filters: region, status, manager
- Quick stats: employee count, active SOPs
- Actions: edit, deactivate, view employees
```

**Task 1.5: Create Branch Form**
```typescript
// File: frontend/src/pages/admin/BranchForm.tsx
- Routes: /admin/branches/new, /admin/branches/:id/edit
- Fields: all branch fields
- Manager selection dropdown
- Parent branch selector (hierarchy)
```

### Day 5: Department Management UI

**Task 1.6: Department API**
```python
# File: pulse/api/departments.py
- get_departments() - List with employee/template counts
- create_department() - Create new
- update_department() - Update
- deactivate_department() - Soft delete
```

**Task 1.7: Department Pages**
```typescript
// File: frontend/src/pages/admin/Departments.tsx
// File: frontend/src/pages/admin/DepartmentForm.tsx
- List view with metrics
- Add/Edit forms
- Department detail with employees & templates
```

---

## Week 2: Employee Management

### Day 6-7: Employee API Enhancement

**Task 2.1: Employee API**
```python
# File: pulse/api/employees.py
- get_employees() - List with filters (branch, dept, role, status)
- get_employee_detail() - Full profile with hierarchy
- create_employee() - Create with user account
- update_employee() - Update details
- deactivate_employee() - Soft delete
- bulk_import_employees() - CSV import
- get_employee_hierarchy() - Get reports tree
- get_employee_options() - For dropdowns
- change_reports_to() - Update hierarchy
```

**Task 2.2: CSV Import Template**
```csv
employee_name,email,pulse_role,branch,department,reports_to_email,phone
John Doe,john@company.com,Operator,North Branch,Kitchen,,555-0100
```

### Day 8-9: Employee List & Profile

**Task 2.3: Employee List Page**
```typescript
// File: frontend/src/pages/admin/Employees.tsx
- Table view with columns: name, role, branch, dept, status
- Filters: branch, department, role, status, search
- Bulk actions: deactivate, export
- Quick view drawer
- "Add Employee" button
```

**Task 2.4: Employee Profile Page**
```typescript
// File: frontend/src/pages/admin/EmployeeProfile.tsx
- Route: /admin/employees/:id
- Sections:
  - Basic Info (editable)
  - Role & Hierarchy (reports_to with org preview)
  - Assignments (branch, department)
  - Account Status (reset password, deactivate)
  - Recent Activity (runs, scores)
  - Performance Chart
```

### Day 10: Employee Form & Wizard

**Task 2.5: Add Employee Wizard**
```typescript
// File: frontend/src/pages/admin/EmployeeForm.tsx
- Route: /admin/employees/new
- Step 1: Basic Info
  - Name, email, phone
  - Validation for unique email
- Step 2: Role & Hierarchy
  - Pulse Role dropdown
  - Reports To selector (employee search with hierarchy)
  - Preview team they'll join
- Step 3: Assignment
  - Branch dropdown
  - Department dropdown
- Step 4: Review & Create
  - Summary
  - Create user account checkbox (default: checked)
  - Generate password option
```

---

## Technical Implementation Details

### New APIs to Create

**pulse/api/branches.py**
```python
@frappe.whitelist()
def get_branches(filters=None, limit=50):
    """Get branches with employee counts."""
    
@frappe.whitelist()
def create_branch(values: dict):
    """Create new branch."""
    
@frappe.whitelist()
def get_branch_tree():
    """Get hierarchical branch structure."""
```

**pulse/api/departments.py**
```python
@frappe.whitelist()
def get_departments():
    """Get departments with metrics."""
    
@frappe.whitelist()
def create_department(values: dict):
    """Create department."""
```

**pulse/api/employees.py**
```python
@frappe.whitelist()
def get_employees(filters=None, limit_start=0, limit=50):
    """Get employees with filtering."""
    
@frappe.whitelist()
def create_employee(values: dict, create_user=True):
    """Create employee with optional user account."""
    
@frappe.whitelist()
def bulk_import_employees(csv_data: str):
    """Import employees from CSV."""
    
@frappe.whitelist()
def get_employee_hierarchy(employee_name: str = None):
    """Get org tree starting from employee (or root)."""
```

### Frontend Routes to Add

```typescript
// App.tsx additions
<Route path="admin" element={<AdminLayout />}>
  <Route path="branches" element={<Branches />} />
  <Route path="branches/new" element={<BranchForm />} />
  <Route path="branches/:id/edit" element={<BranchForm />} />
  
  <Route path="departments" element={<Departments />} />
  <Route path="departments/new" element={<DepartmentForm />} />
  <Route path="departments/:id/edit" element={<DepartmentForm />} />
  
  <Route path="employees" element={<Employees />} />
  <Route path="employees/new" element={<EmployeeForm />} />
  <Route path="employees/:id" element={<EmployeeProfile />} />
  <Route path="employees/:id/edit" element={<EmployeeForm />} />
</Route>
```

### Navigation Updates

**Admin Menu Section (new)**
- Organization
  - Branches
  - Departments
  - Employees
  - Org Chart (placeholder for Phase 6)

### Permission Model

**Who can access Admin?**
- System Role: `Pulse Admin` - full access
- System Role: `Pulse Manager` - read-only org, manage assignments
- Pulse Role: `Executive` - view-only org chart

**API Permission Decorators**
```python
def has_org_management_permission(user):
    """Check if user can manage org structure."""
    employee = get_employee_for_user(user)
    return employee.pulse_role in ['Executive', 'Area Manager'] or \
           'Pulse Admin' in frappe.get_roles(user)
```

---

## Success Criteria

1. **Branch Management:**
   - [ ] Can create branch with all fields
   - [ ] Can assign branch manager
   - [ ] Can view branch hierarchy
   - [ ] Employee branch field is Link (not text)

2. **Department Management:**
   - [ ] Can CRUD departments
   - [ ] Can see employee count per department
   - [ ] Can filter employees by department

3. **Employee Management:**
   - [ ] Can add employee with 4-step wizard
   - [ ] Can set reports_to (hierarchy)
   - [ ] Can bulk import from CSV
   - [ ] Can deactivate employee
   - [ ] Can view employee profile with activity

---

## Testing Checklist

- [ ] Create 3 branches with hierarchy
- [ ] Create 5 departments
- [ ] Add 10 employees via wizard
- [ ] Bulk import 20 employees
- [ ] Verify hierarchy queries work
- [ ] Test permission restrictions
- [ ] Verify branch migration worked
