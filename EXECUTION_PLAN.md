# Pulse Execution Plan

**Goal:** Close critical gaps and make Pulse fully operational  
**Timeline:** 6 phases, approximately 6 weeks  
**Approach:** Phased delivery with testing at each phase  

---

## Phase 1: Template Management CRUD
**Duration:** Week 1-2  
**Priority:** Critical  

### 1.1 Backend API Extensions

File: `pulse/api/templates.py`

Add methods:
```python
@frappe.whitelist()
def create_template(values: dict) -> dict:
    """Create new SOP Template with checklist items."""
    pass

@frappe.whitelist()
def update_template(template_name: str, values: dict) -> dict:
    """Update existing template."""
    pass

@frappe.whitelist()
def delete_template(template_name: str) -> dict:
    """Soft delete (deactivate) template."""
    pass

@frappe.whitelist()
def get_template_schema() -> dict:
    """Return schema for form generation (field types, options)."""
    pass
```

### 1.2 Frontend Implementation

New Files:
- `frontend/src/pages/TemplateForm.tsx` - Create/Edit template
- `frontend/src/components/templates/ChecklistItemEditor.tsx` - Manage items
- `frontend/src/services/templateAdmin.ts` - API wrappers

Modified Files:
- `frontend/src/pages/Templates.tsx` - Wire up "Create Template" button
- `frontend/src/App.tsx` - Add routes

Routes to Add:
- `/templates/new` - Create template
- `/templates/:id/edit` - Edit template

Form Fields Required:
- Basic: title, department, owner_role, is_active
- Scheduling: frequency_type, schedule_kind, schedule_time, schedule_days_of_week, interval_minutes, grace_minutes
- Policy: open_run_policy
- Checklist Items (child table): description, sequence, weight, item_type, outcome_mode, proof_requirement, proof_media_type, proof_capture_mode, instructions, item_key, prerequisite_item_key, prerequisite_trigger

### 1.3 Checklist Item Editor Component

Features:
- Drag-and-drop reorder
- Add new items
- Edit item details inline
- Delete items
- Set prerequisites (conditional logic)

### 1.4 Success Criteria
- [ ] Can create template with all fields
- [ ] Can edit existing template
- [ ] Can deactivate (soft delete) template
- [ ] Checklist items can be managed
- [ ] Form validation works
- [ ] Route guards prevent unauthorized access

---

## Phase 2: SOP Assignment Management
**Duration:** Week 2-3  
**Priority:** Critical  

### 2.1 Backend API

File: `pulse/api/assignments.py` (new)

```python
@frappe.whitelist()
def get_assignments(filters: dict = None) -> list:
    """List assignments with template and employee details."""
    pass

@frappe.whitelist()
def create_assignment(template: str, employee: str, start_date: str = None, end_date: str = None) -> dict:
    """Create single assignment."""
    pass

@frappe.whitelist()
def create_bulk_assignments(template: str, employees: list, start_date: str = None) -> dict:
    """Assign template to multiple employees."""
    pass

@frappe.whitelist()
def update_assignment(assignment_name: str, values: dict) -> dict:
    """Update assignment (dates, active status)."""
    pass

@frappe.whitelist()
def delete_assignment(assignment_name: str) -> dict:
    """Delete assignment."""
    pass

@frappe.whitelist()
def get_assignment_calendar(start_date: str, end_date: str, employee: str = None) -> list:
    """Get scheduled runs for calendar view."""
    pass
```

### 2.2 Frontend Implementation

New Files:
- `frontend/src/pages/Assignments.tsx` - Assignment list
- `frontend/src/pages/AssignmentForm.tsx` - Create assignment
- `frontend/src/components/assignments/AssignmentCalendar.tsx` - Calendar view
- `frontend/src/services/assignments.ts` - API wrappers

Modified Files:
- `frontend/src/components/layout/Sidebar.tsx` - Add Assignments nav
- `frontend/src/App.tsx` - Add routes

Routes:
- `/assignments` - List view
- `/assignments/new` - Create
- `/assignments/:id/edit` - Edit

Features:
- Table view with filters (template, employee, status)
- Bulk assignment UI
- Calendar view showing scheduled runs
- Active/inactive toggle

### 2.3 Success Criteria
- [ ] Can view all assignments
- [ ] Can create single assignment
- [ ] Can create bulk assignments
- [ ] Can edit assignment dates
- [ ] Can activate/deactivate
- [ ] Calendar view shows scheduled runs

---

## Phase 3: Employee & Organization Management
**Duration:** Week 3-4  
**Priority:** Critical  

### 3.1 Backend API

File: `pulse/api/employees.py` (new)

```python
@frappe.whitelist()
def get_employees(filters: dict = None, limit: int = 100) -> list:
    """List employees with role, department, branch."""
    pass

@frappe.whitelist()
def create_employee(values: dict) -> dict:
    """Create employee and optionally Frappe User."""
    pass

@frappe.whitelist()
def update_employee(employee_name: str, values: dict) -> dict:
    """Update employee."""
    pass

@frappe.whitelist()
def get_employee_options() -> dict:
    """Get dropdown options (roles, departments, managers)."""
    pass

@frappe.whitelist()
def get_org_tree() -> dict:
    """Get hierarchical org structure."""
    pass
```

File: `pulse/api/departments.py` (new)

```python
@frappe.whitelist()
def get_departments() -> list:
    pass

@frappe.whitelist()
def create_department(name: str, description: str = None) -> dict:
    pass

@frappe.whitelist()
def update_department(name: str, values: dict) -> dict:
    pass
```

### 3.2 Frontend Implementation

New Files:
- `frontend/src/pages/Employees.tsx` - Employee list
- `frontend/src/pages/EmployeeForm.tsx` - Create/edit employee
- `frontend/src/pages/Departments.tsx` - Department management
- `frontend/src/components/employees/OrgTree.tsx` - Visual org chart
- `frontend/src/services/employees.ts`
- `frontend/src/services/departments.ts`

Modified Files:
- `frontend/src/components/layout/Sidebar.tsx` - Add nav items
- `frontend/src/App.tsx` - Add routes

Routes:
- `/employees` - Employee list
- `/employees/new` - Create
- `/employees/:id/edit` - Edit
- `/departments` - Department management

Features:
- Employee table with filters (role, department, branch, status)
- Org tree visualization
- Hierarchy browser
- Department management
- Bulk import (CSV upload)

### 3.3 Success Criteria
- [ ] Can view all employees
- [ ] Can create new employee
- [ ] Can edit employee (including reports_to)
- [ ] Can deactivate employee
- [ ] Can manage departments
- [ ] Org tree is visualized

---

## Phase 4: Corrective Actions UI
**Duration:** Week 4-5  
**Priority:** Critical  

### 4.1 Backend API

File: `pulse/api/corrective_actions.py` (new)

```python
@frappe.whitelist()
def get_corrective_actions(status: str = None, priority: str = None, assigned_to: str = None) -> list:
    """List CAs with filters."""
    pass

@frappe.whitelist()
def create_corrective_action(run_item_name: str, description: str, priority: str = "Medium", assigned_to: str = None) -> dict:
    """Create CA from failed run item."""
    pass

@frappe.whitelist()
def update_corrective_action(ca_name: str, values: dict) -> dict:
    """Update CA status, resolution, etc."""
    pass

@frappe.whitelist()
def get_ca_summary() -> dict:
    """Get counts by status for dashboard."""
    pass
```

### 4.2 Frontend Implementation

New Files:
- `frontend/src/pages/CorrectiveActions.tsx` - CA list
- `frontend/src/pages/CorrectiveActionDetail.tsx` - Detail view
- `frontend/src/components/corrective-actions/CAForm.tsx` - Create/edit
- `frontend/src/components/corrective-actions/CADashboard.tsx` - Summary cards
- `frontend/src/services/correctiveActions.ts`

Modified Files:
- `frontend/src/pages/UserProfile.tsx` - Wire up "Flag" button
- `frontend/src/components/layout/Sidebar.tsx` - Add nav
- `frontend/src/App.tsx` - Add routes

Routes:
- `/corrective-actions` - List
- `/corrective-actions/:id` - Detail
- `/corrective-actions/new` - Create (from run item)

Features:
- Kanban board view (by status)
- List view with filters
- Create from failed item
- Status workflow UI
- Priority indicators
- Resolution notes

### 4.3 Integration Points

Update ChecklistRunner:
- Add "Flag for Corrective Action" option for failed items
- Direct link to create CA

Update UserProfile:
- Wire up existing "Flag" button

### 4.4 Success Criteria
- [ ] Can view all CAs
- [ ] Can create CA from failed run item
- [ ] Can update CA status
- [ ] Kanban view works
- [ ] CA metrics in dashboard

---

## Phase 5: Admin Settings & Configuration
**Duration:** Week 5  
**Priority:** High  

### 5.1 Backend API

File: `pulse/api/admin.py` (new)

```python
@frappe.whitelist()
def get_system_settings() -> dict:
    """Get system-wide settings."""
    pass

@frappe.whitelist()
def update_system_settings(values: dict) -> dict:
    """Update settings."""
    pass

@frappe.whitelist()
def get_roles() -> list:
    """List Pulse roles."""
    pass

@frappe.whitelist()
def create_role(values: dict) -> dict:
    pass

@frappe.whitelist()
def update_role(role_name: str, values: dict) -> dict:
    pass
```

### 5.2 Frontend Implementation

New Files:
- `frontend/src/pages/Admin.tsx` - Admin dashboard
- `frontend/src/pages/Roles.tsx` - Role management
- `frontend/src/pages/Settings.tsx` - System settings
- `frontend/src/services/admin.ts`

Routes:
- `/admin` - Admin dashboard
- `/admin/roles` - Role management
- `/admin/settings` - Settings

Features:
- System stats (counts, health)
- Cache management
- Demo data controls
- Role permission mapping
- System settings

---

## Phase 6: Polish & UX Improvements
**Duration:** Week 5-6  
**Priority:** Medium  

### 6.1 Search Functionality

New Files:
- `frontend/src/components/search/SearchModal.tsx`
- `frontend/src/services/search.ts`

Modified:
- `frontend/src/components/layout/Sidebar.tsx` - Wire up search button
- `frontend/src/App.tsx` - Add keyboard shortcut

Features:
- ⌘K keyboard shortcut
- Search across: employees, templates, runs
- Recent searches
- Quick actions

### 6.2 Theme Toggle

New Files:
- `frontend/src/components/layout/ThemeToggle.tsx`

Modified:
- `frontend/src/components/layout/Topbar.tsx` - Add toggle
- `frontend/src/index.css` - Add light theme variables

### 6.3 Desktop Notifications Dropdown

Modified:
- `frontend/src/components/layout/Topbar.tsx` - Add notification dropdown
- Use existing notification service

### 6.4 Export Functionality

Modified:
- `frontend/src/pages/Insights.tsx` - Add export buttons
- Add CSV export service

### 6.5 Run History

Modified:
- `frontend/src/pages/MyTasks.tsx` - Add date selector
- Show historical runs

---

## Testing Plan

### Unit Testing
- Test each API method
- Test form validations
- Test permission checks

### Integration Testing
- Full workflow: Template → Assignment → Run → CA
- Test with each user role
- Test permission boundaries

### User Acceptance Testing
Test with demo users:
- `chairman@pm.local` (Executive)
- `md@pm.local` (Executive)
- `rm.north@pm.local` (Area Manager)
- `bm.n1@pm.local` (Supervisor)
- `chef.n1@pm.local` (Operator)

### Performance Testing
- Large org simulation (100+ employees)
- Bulk operations
- Insights with large datasets

---

## File Creation Summary

### New Backend Files (7)
1. `pulse/api/assignments.py`
2. `pulse/api/employees.py`
3. `pulse/api/departments.py`
4. `pulse/api/corrective_actions.py`
5. `pulse/api/admin.py`
6. `pulse/api/search.py`
7. `pulse/api/export.py`

### New Frontend Pages (12)
1. `frontend/src/pages/TemplateForm.tsx`
2. `frontend/src/pages/Assignments.tsx`
3. `frontend/src/pages/AssignmentForm.tsx`
4. `frontend/src/pages/Employees.tsx`
5. `frontend/src/pages/EmployeeForm.tsx`
6. `frontend/src/pages/Departments.tsx`
7. `frontend/src/pages/CorrectiveActions.tsx`
8. `frontend/src/pages/CorrectiveActionDetail.tsx`
9. `frontend/src/pages/Admin.tsx`
10. `frontend/src/pages/Roles.tsx`
11. `frontend/src/pages/Settings.tsx`
12. `frontend/src/pages/RunHistory.tsx`

### New Frontend Components (10)
1. `frontend/src/components/templates/ChecklistItemEditor.tsx`
2. `frontend/src/components/assignments/AssignmentCalendar.tsx`
3. `frontend/src/components/employees/OrgTree.tsx`
4. `frontend/src/components/corrective-actions/CAForm.tsx`
5. `frontend/src/components/corrective-actions/CADashboard.tsx`
6. `frontend/src/components/search/SearchModal.tsx`
7. `frontend/src/components/layout/ThemeToggle.tsx`
8. `frontend/src/components/forms/TemplateScheduler.tsx`
9. `frontend/src/components/forms/EmployeeSelector.tsx`
10. `frontend/src/components/shared/DataTable.tsx`

### New Services (6)
1. `frontend/src/services/templateAdmin.ts`
2. `frontend/src/services/assignments.ts`
3. `frontend/src/services/employees.ts`
4. `frontend/src/services/departments.ts`
5. `frontend/src/services/correctiveActions.ts`
6. `frontend/src/services/admin.ts`

### Modified Files (6)
1. `frontend/src/App.tsx` - Add routes
2. `frontend/src/components/layout/Sidebar.tsx` - Add nav items
3. `frontend/src/pages/Templates.tsx` - Wire up create button
4. `frontend/src/pages/UserProfile.tsx` - Wire up flag button
5. `pulse/api/templates.py` - Add CRUD methods
6. `pulse/hooks.py` - Whitelist new methods

---

## Rollback Plan

Each phase is independent and can be rolled back:
- Database migrations are additive only
- New DocTypes don't affect existing ones
- Feature flags can disable new UI

---

## Success Metrics

**Adoption:**
- All demo users can complete role-specific workflows
- Template creation works end-to-end
- Assignments generate runs correctly
- Corrective actions track to resolution

**Quality:**
- No console errors
- API response times < 500ms
- UI renders without layout shifts
- Mobile responsive

**Completeness:**
- All Critical gaps closed
- All High priority gaps closed
- 50% of Medium priority gaps addressed
