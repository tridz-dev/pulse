---
module: Pulse
date: 2025-03-26
problem_type: implementation_plan
component: roadmap
severity: informational
tags:
  - implementation
  - roadmap
  - phases
  - planning
  - pulse
  - org-structure
  - assignment-management
  - corrective-actions
---

# Pulse Implementation Phases & Roadmap

## Overview

Pulse implementation is organized into **6 phases** spanning 6+ weeks, covering administrative features, assignment management, employee/org management, corrective actions, and system polish.

**Current State:** Solid backend foundation (13 DocTypes, comprehensive APIs, scoring system, analytics). Frontend has task execution, insights, and template management.

**Goal:** Close critical gaps and make Pulse fully operational through phased delivery with testing at each phase.

---

## Phase 1: Org Structure Management ✅ COMPLETED

**Duration:** Week 1-2  
**Status:** COMPLETED ✓  
**Priority:** Critical

### What Was Built

#### 1.1 Branch Management (DocType + UI)

**New DocType:** `Pulse Branch`
- `branch_name` (primary key)
- `branch_code` (unique)
- `region` (Link → Pulse Region)
- `address`, `city`, `state`, `country`
- `branch_manager` (Link → Pulse Employee)
- `parent_branch` (Link → Pulse Branch for hierarchy)
- `is_active`, `opening_time`, `closing_time`

**Files Created:**
- `pulse/pulse/doctype/pulse_branch/pulse_branch.json`
- `pulse/pulse/doctype/pulse_branch/pulse_branch.py`
- `pulse/api/branches.py` - Full CRUD API

**UI Pages:**
- `/admin/branches` - Branch list with region filter
- `/admin/branches/new` - Create branch
- `/admin/branches/:id/edit` - Edit branch, assign manager

#### 1.2 Employee Management (CRUD + Wizard + Hierarchy)

**Files Created:**
- `pulse/api/employees.py` - Employee CRUD APIs
  - `get_employees()` - List with filters (branch, dept, role, status)
  - `get_employee_detail()` - Full profile with hierarchy
  - `create_employee()` - Create with user account
  - `update_employee()` - Update details
  - `deactivate_employee()` - Soft delete
  - `bulk_import_employees()` - CSV import
  - `get_employee_hierarchy()` - Get reports tree
  - `change_reports_to()` - Update hierarchy

**UI Pages:**
- `/admin/employees` - Employee directory with filters
- `/admin/employees/new` - 4-step Add Employee wizard
  - Step 1: Basic info (name, email, phone)
  - Step 2: Role & hierarchy (reports_to selection with org tree)
  - Step 3: Assignment (branch, department)
  - Step 4: Create user account (auto-generate password)
- `/admin/employees/:id` - Employee profile with performance timeline
- `/admin/employees/:id/edit` - Edit employee

#### 1.3 Department Management (Simple CRUD)

**Files Created:**
- `pulse/api/departments.py`
  - `get_departments()` - List with employee/template counts
  - `create_department()` - Create new
  - `update_department()` - Update
  - `deactivate_department()` - Soft delete

**UI Pages:**
- `/admin/departments` - Department list with metrics
- `/admin/departments/new` - Create department
- `/admin/departments/:id/edit` - Edit department

#### 1.4 Navigation Updates

**Modified:**
- `frontend/src/App.tsx` - Added admin routes
- `frontend/src/components/layout/Sidebar.tsx` - Added Admin menu section

**New Admin Menu:**
```
Organization
├── Branches
├── Departments
├── Employees
└── Org Chart (placeholder for Phase 6)
```

### Phase 1 Success Criteria ✅

- [x] **Branch Management:**
  - [x] Can create branch with all fields
  - [x] Can assign branch manager
  - [x] Can view branch hierarchy
  - [x] Employee branch field is Link (not text)

- [x] **Department Management:**
  - [x] Can CRUD departments
  - [x] Can see employee count per department
  - [x] Can filter employees by department

- [x] **Employee Management:**
  - [x] Can add employee with 4-step wizard
  - [x] Can set reports_to (hierarchy)
  - [x] Can bulk import from CSV
  - [x] Can deactivate employee
  - [x] Can view employee profile with activity

---

## Phase 2: Assignment Management 🔄 NEXT

**Duration:** Week 2-3  
**Status:** IN PROGRESS / NEXT  
**Priority:** Critical

### 2.1 Backend API

**File:** `pulse/api/assignments.py` (new)

```python
@frappe.whitelist()
def get_assignments(filters: dict = None) -> list:
    """List assignments with template and employee details."""

@frappe.whitelist()
def create_assignment(template: str, employee: str, start_date: str = None, end_date: str = None) -> dict:
    """Create single assignment."""

@frappe.whitelist()
def create_bulk_assignments(template: str, employees: list, start_date: str = None) -> dict:
    """Assign template to multiple employees."""

@frappe.whitelist()
def update_assignment(assignment_name: str, values: dict) -> dict:
    """Update assignment (dates, active status)."""

@frappe.whitelist()
def delete_assignment(assignment_name: str) -> dict:
    """Delete assignment."""

@frappe.whitelist()
def get_assignment_calendar(start_date: str, end_date: str, employee: str = None) -> list:
    """Get scheduled runs for calendar view."""
```

### 2.2 Frontend Implementation

**New Files:**
- `frontend/src/pages/Assignments.tsx` - Assignment list
- `frontend/src/pages/AssignmentForm.tsx` - Create assignment
- `frontend/src/components/assignments/AssignmentCalendar.tsx` - Calendar view
- `frontend/src/services/assignments.ts` - API wrappers

**Modified Files:**
- `frontend/src/components/layout/Sidebar.tsx` - Add Assignments nav
- `frontend/src/App.tsx` - Add routes

**Routes:**
- `/assignments` - List view
- `/assignments/new` - Create
- `/assignments/:id/edit` - Edit

**Features:**
- Table view with filters (template, employee, status)
- Bulk assignment UI
  - Select template
  - Select employees (multi-select with department/role filters)
  - Set effective date range
  - Preview & confirm
- Calendar view showing scheduled runs
- Active/inactive toggle

### Phase 2 Success Criteria

- [ ] Can view all assignments
- [ ] Can create single assignment
- [ ] Can create bulk assignments
- [ ] Can edit assignment dates
- [ ] Can activate/deactivate
- [ ] Calendar view shows scheduled runs

---

## Phase 3: Operations Control Center ⏳ PENDING

**Duration:** Week 4  
**Status:** PENDING  
**Priority:** Critical

### 3.1 Run Management (Admin View)

**Current:** Employees only see their own runs  
**Required:** Admin view of all runs with controls

**New Pages:**
- `/operations/runs` - All runs management
  - Filters: date range, branch, department, employee, template, status
  - Actions: reassign run, extend deadline, force close, reopen
  - Bulk operations

- `/operations/runs/:id` - Run detail admin view
  - Complete run timeline
  - Individual item outcomes
  - Evidence viewer
  - Audit trail

### 3.2 Corrective Actions Management

**Current:** DocType exists, no UI (only Insights summary)  
**Required:** Full corrective action workflow

**Backend API:** `pulse/api/corrective_actions.py`

```python
@frappe.whitelist()
def get_corrective_actions(status: str = None, priority: str = None, assigned_to: str = None) -> list:
    """List CAs with filters."""

@frappe.whitelist()
def create_corrective_action(run_item_name: str, description: str, priority: str = "Medium", assigned_to: str = None) -> dict:
    """Create CA from failed run item."""

@frappe.whitelist()
def update_corrective_action(ca_name: str, values: dict) -> dict:
    """Update CA status, resolution, etc."""

@frappe.whitelist()
def get_ca_summary() -> dict:
    """Get counts by status for dashboard."""
```

**New Pages:**
- `/corrective-actions` - Corrective actions dashboard
  - Kanban view: Open → In Progress → Resolved → Closed
  - Filters: priority, assignee, source template, date range
  - Metrics: avg resolution time, open by assignee

- `/corrective-actions/:id` - Detail view
  - Source run item details
  - Comments/activity thread
  - Resolution workflow
  - Escalation option

**Integration Points:**
- Update ChecklistRunner: Add "Flag for Corrective Action" option for failed items
- Update UserProfile: Wire up existing "Flag" button

### Phase 3 Success Criteria

- [ ] Can view all runs with admin controls
- [ ] Can reassign, extend, force close runs
- [ ] Can view all corrective actions
- [ ] Can create CA from failed run item
- [ ] Can update CA status through workflow
- [ ] Kanban view works
- [ ] CA metrics in dashboard

---

## Phase 4: System Configuration ⏳ PENDING

**Duration:** Week 5  
**Status:** PENDING  
**Priority:** High

### 4.1 Settings Page

**New Page:** `/admin/settings`

**Sections:**
1. **General Settings**
   - Default grace period (minutes)
   - Default open run policy
   - Score calculation weights

2. **Notification Settings**
   - Enable/disable email notifications
   - Enable/disable in-app notifications
   - Notification templates
   - Reminder schedules

3. **Scoring Rules**
   - Pass/Fail weightage
   - Numeric scoring formula
   - Late submission penalty
   - Missed item penalty

4. **Schedule Defaults**
   - Default reminder time
   - Business hours
   - Holiday calendar

**Backend API:** `pulse/api/admin.py`

```python
@frappe.whitelist()
def get_system_settings() -> dict:
    """Get system-wide settings."""

@frappe.whitelist()
def update_system_settings(values: dict) -> dict:
    """Update settings."""
```

### 4.2 Role & Permission Management

**New Page:** `/admin/roles`

- View Pulse Roles
- Create custom roles
- Permission matrix (which role can do what)
- Feature toggles per role

**Backend API:**

```python
@frappe.whitelist()
def get_roles() -> list:
    """List Pulse roles."""

@frappe.whitelist()
def create_role(values: dict) -> dict:
    """Create new role."""

@frappe.whitelist()
def update_role(role_name: str, values: dict) -> dict:
    """Update role permissions."""
```

### Phase 4 Success Criteria

- [ ] Can view and update system settings
- [ ] Can manage notification preferences
- [ ] Can configure scoring rules
- [ ] Can view and manage roles
- [ ] Permission matrix is functional

---

## Phase 5: Advanced Features ⏳ PENDING

**Duration:** Week 6-7  
**Status:** PENDING  
**Priority:** Medium

### 5.1 Follow-up Rules Management

**New Page:** `/admin/follow-up-rules`

- List existing rules
- Create new rule wizard:
  - Select source template
  - Select trigger condition (item fail, any fail, etc.)
  - Select action (create new run, notify, etc.)
  - Select target template/assignee
- Rule execution logs

### 5.2 Audit & Compliance

**New Page:** `/admin/audit`

- Activity log (who did what, when)
- Score change audit
- Evidence access log
- Data export for compliance

### 5.3 Reports & Exports

**New Features:**
- PDF report generation for runs
- Excel export for Insights
- Scheduled email reports
- Custom report builder

### 5.4 Search Functionality

**New Files:**
- `frontend/src/components/search/SearchModal.tsx`
- `frontend/src/services/search.ts`

**Modified:**
- `frontend/src/components/layout/Sidebar.tsx` - Wire up search button
- `frontend/src/App.tsx` - Add keyboard shortcut

**Features:**
- ⌘K keyboard shortcut
- Search across: employees, templates, runs
- Recent searches
- Quick actions

### 5.5 Theme Toggle

**New Files:**
- `frontend/src/components/layout/ThemeToggle.tsx`

**Modified:**
- `frontend/src/components/layout/Topbar.tsx` - Add toggle
- `frontend/src/index.css` - Add light theme variables

### 5.6 Desktop Notifications Dropdown

**Modified:**
- `frontend/src/components/layout/Topbar.tsx` - Add notification dropdown
- Use existing notification service

### Phase 5 Success Criteria

- [ ] Can create and manage follow-up rules
- [ ] Can view audit logs
- [ ] Can export insights to CSV/Excel
- [ ] Search works across all entities
- [ ] Theme toggle functional
- [ ] Desktop notifications dropdown works

---

## Phase 6: Org Chart Visualization ⏳ PENDING

**Duration:** Week 8  
**Status:** PENDING  
**Priority:** Medium

### 6.1 Interactive Org Chart

**New Page:** `/admin/org-chart`

**Features:**
- Mermaid/D3 hierarchical tree
- Zoom and pan
- Collapse/expand branches
- Search employee
- Click to view profile
- Drag-and-drop reassignment (manager only)
- Color coding by role/department

**Views:**
- Full org view (Executive)
- Branch view (Area Manager)
- Department view

**New Component:**
- `frontend/src/components/employees/OrgTree.tsx`

### Phase 6 Success Criteria

- [ ] Org chart renders hierarchical structure
- [ ] Can zoom, pan, expand/collapse
- [ ] Can search and navigate to employees
- [ ] Clicking employee opens profile
- [ ] Color coding by role/department

---

## File Creation Summary

### New Backend Files (7)

| File | Phase | Description |
|------|-------|-------------|
| `pulse/api/assignments.py` | 2 | Assignment CRUD and calendar APIs |
| `pulse/api/employees.py` | 1 ✓ | Employee CRUD, hierarchy queries |
| `pulse/api/departments.py` | 1 ✓ | Department CRUD |
| `pulse/api/corrective_actions.py` | 3 | CA workflow APIs |
| `pulse/api/admin.py` | 4 | Settings and role management |
| `pulse/api/search.py` | 5 | Global search API |
| `pulse/api/export.py` | 5 | Export functionality |

### New Frontend Pages (12)

| File | Phase | Description |
|------|-------|-------------|
| `frontend/src/pages/admin/Branches.tsx` | 1 ✓ | Branch list management |
| `frontend/src/pages/admin/BranchForm.tsx` | 1 ✓ | Create/edit branch |
| `frontend/src/pages/admin/Departments.tsx` | 1 ✓ | Department management |
| `frontend/src/pages/admin/Employees.tsx` | 1 ✓ | Employee directory |
| `frontend/src/pages/admin/EmployeeForm.tsx` | 1 ✓ | 4-step employee wizard |
| `frontend/src/pages/admin/EmployeeProfile.tsx` | 1 ✓ | Employee detail view |
| `frontend/src/pages/Assignments.tsx` | 2 | Assignment list |
| `frontend/src/pages/AssignmentForm.tsx` | 2 | Create/edit assignment |
| `frontend/src/pages/CorrectiveActions.tsx` | 3 | CA list with Kanban |
| `frontend/src/pages/CorrectiveActionDetail.tsx` | 3 | CA detail view |
| `frontend/src/pages/admin/Settings.tsx` | 4 | System settings |
| `frontend/src/pages/admin/Roles.tsx` | 4 | Role management |
| `frontend/src/pages/admin/OrgChart.tsx` | 6 | Interactive org chart |

### New Frontend Components (10)

| File | Phase | Description |
|------|-------|-------------|
| `frontend/src/components/assignments/AssignmentCalendar.tsx` | 2 | FullCalendar integration |
| `frontend/src/components/assignments/BulkAssignmentModal.tsx` | 2 | Multi-step bulk wizard |
| `frontend/src/components/employees/OrgTree.tsx` | 6 | Hierarchical tree visualization |
| `frontend/src/components/corrective-actions/CAForm.tsx` | 3 | Create/edit CA |
| `frontend/src/components/corrective-actions/CADashboard.tsx` | 3 | Summary cards |
| `frontend/src/components/corrective-actions/KanbanBoard.tsx` | 3 | CA status board |
| `frontend/src/components/search/SearchModal.tsx` | 5 | Global search modal |
| `frontend/src/components/layout/ThemeToggle.tsx` | 5 | Light/dark toggle |
| `frontend/src/components/forms/EmployeeSelector.tsx` | 2 | Multi-select with hierarchy |
| `frontend/src/components/forms/BulkImportModal.tsx` | 5 | CSV upload & preview |

### New Services (6)

| File | Phase | Description |
|------|-------|-------------|
| `frontend/src/services/assignments.ts` | 2 | Assignment API wrappers |
| `frontend/src/services/employees.ts` | 1 ✓ | Employee API wrappers |
| `frontend/src/services/departments.ts` | 1 ✓ | Department API wrappers |
| `frontend/src/services/correctiveActions.ts` | 3 | CA API wrappers |
| `frontend/src/services/admin.ts` | 4 | Admin API wrappers |
| `frontend/src/services/search.ts` | 5 | Search API wrappers |

---

## Priority Matrix

| Feature | Business Impact | Implementation Effort | Priority | Phase |
|---------|----------------|----------------------|----------|-------|
| Employee Management | High | Medium | P0 | 1 ✅ |
| Branch DocType + UI | High | Low | P0 | 1 ✅ |
| Department Management | Medium | Low | P0 | 1 ✅ |
| Assignment Management | High | Medium | P0 | 2 🔄 |
| Corrective Actions UI | Medium | Low | P1 | 3 ⏳ |
| Run Management (Admin) | Medium | Medium | P1 | 3 ⏳ |
| Settings Page | Medium | Low | P1 | 4 ⏳ |
| Role & Permission Management | Medium | Medium | P1 | 4 ⏳ |
| Org Chart | Medium | High | P2 | 6 ⏳ |
| Audit Logs | Low | Medium | P2 | 5 ⏳ |
| Follow-up Rules UI | Low | Medium | P2 | 5 ⏳ |
| Reports/Exports | Low | High | P3 | 5 ⏳ |
| Global Search | Medium | Medium | P1 | 5 ⏳ |
| Theme Toggle | Low | Low | P3 | 5 ⏳ |

---

## Success Metrics by Phase

### Overall Adoption Goals

- **Setup Time:** New org setup in < 30 minutes
- **Employee Onboarding:** Add employee in < 2 minutes
- **Assignment Creation:** Bulk assign in < 5 minutes
- **Visibility:** Admin can see all org activity in one view

### Phase 1 Success Metrics ✅

- [x] Can create 3+ branches with hierarchy
- [x] Can create 5+ departments
- [x] Can add 10+ employees via wizard
- [x] Can bulk import 20+ employees via CSV
- [x] Can set and view employee hierarchy (reports_to)
- [x] Can deactivate employees

### Phase 2 Success Metrics

- [ ] Can view all assignments in list view
- [ ] Can create single assignment in < 30 seconds
- [ ] Can bulk assign to 10+ employees in < 2 minutes
- [ ] Calendar view shows scheduled runs for date range
- [ ] Can activate/deactivate assignments
- [ ] Assignment filters work (template, employee, status)

### Phase 3 Success Metrics

- [ ] Can view all runs with admin filters
- [ ] Can reassign run to different employee
- [ ] Can extend run deadline
- [ ] Can create corrective action from failed item
- [ ] Can update CA status through workflow
- [ ] Kanban board shows correct counts by status
- [ ] Avg resolution time metric calculated

### Phase 4 Success Metrics

- [ ] All settings sections load and save correctly
- [ ] Notification preferences persist
- [ ] Scoring rule changes affect new runs
- [ ] Can create custom roles
- [ ] Permission matrix accurately reflects capabilities

### Phase 5 Success Metrics

- [ ] Follow-up rules trigger correctly
- [ ] Audit log captures all significant actions
- [ ] Insights export produces valid CSV/Excel
- [ ] Search returns results in < 500ms
- [ ] Theme toggle persists across sessions
- [ ] Desktop notifications show unread count

### Phase 6 Success Metrics

- [ ] Org chart renders 100+ employee hierarchy
- [ ] Zoom and pan perform at 60fps
- [ ] Employee search finds match in < 100ms
- [ ] Clicking employee navigates to profile
- [ ] Color coding accurately reflects role/department

---

## Quality Targets

**Performance:**
- API response times < 500ms
- Page load time < 2 seconds
- Search results < 500ms

**Reliability:**
- No console errors
- UI renders without layout shifts
- Mobile responsive (320px - 1920px)

**Completeness:**
- All Critical gaps closed
- All High priority gaps closed
- 50% of Medium priority gaps addressed

---

## Rollback Plan

Each phase is independent and can be rolled back:
- Database migrations are additive only
- New DocTypes don't affect existing ones
- Feature flags can disable new UI

---

## Next Development Session

**Current Focus:** Phase 2 - Assignment Management

**Immediate Tasks:**
1. Create `pulse/api/assignments.py` with CRUD methods
2. Create `frontend/src/services/assignments.ts` API wrapper
3. Create `frontend/src/pages/Assignments.tsx` list view
4. Create `frontend/src/pages/AssignmentForm.tsx` create/edit form
5. Create `frontend/src/components/assignments/AssignmentCalendar.tsx`
6. Update `frontend/src/App.tsx` with new routes
7. Update `frontend/src/components/layout/Sidebar.tsx` with Assignments nav

**Files to Touch:**
- `pulse/api/assignments.py` (new)
- `frontend/src/services/assignments.ts` (new)
- `frontend/src/pages/Assignments.tsx` (new)
- `frontend/src/pages/AssignmentForm.tsx` (new)
- `frontend/src/components/assignments/AssignmentCalendar.tsx` (new)
- `frontend/src/App.tsx` (modify)
- `frontend/src/components/layout/Sidebar.tsx` (modify)

**Testing Checklist:**
- [ ] Create single assignment
- [ ] Create bulk assignments (5+ employees)
- [ ] Edit assignment dates
- [ ] Deactivate/reactivate assignment
- [ ] View assignment calendar
- [ ] Filter assignments by template, employee, status
