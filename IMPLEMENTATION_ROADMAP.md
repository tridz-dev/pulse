# Pulse App - Implementation Roadmap

## Executive Summary

**Current State:** Solid backend foundation (13 DocTypes, comprehensive APIs, scoring system, analytics). Frontend has task execution, insights, and template management.

**Critical Gaps:** Administrative UI for org structure, assignment management, and system configuration.

---

## Phase 1: Org Structure Management (Week 1-2)

### 1.1 Branch Management (New DocType + UI)
**Current:** Branch is just a text field on Employee
**Required:** Full Branch DocType with hierarchy

**Data Model Changes:**
```python
# New DocType: Pulse Branch
- branch_name (primary key)
- branch_code (unique)
- region (Link→Pulse Region - optional)
- address, city, state, country
- branch_manager (Link→Pulse Employee)
- parent_branch (Link→Pulse Branch - for hierarchy)
- is_active
- opening_time, closing_time
```

**UI Pages:**
- `/admin/branches` - Branch list with region filter
- `/admin/branches/new` - Create branch
- `/admin/branches/:id/edit` - Edit branch, assign manager
- Branch selector in employee form

---

### 1.2 Employee Management Page
**Current:** No UI - only DocType
**Required:** Full CRUD with hierarchy visualization

**Pages:**
- `/admin/employees` - Employee directory
  - Table view with filters (branch, department, role, status)
  - Quick actions: deactivate, reset password
  - Bulk import/export (CSV)
  
- `/admin/employees/new` - Add employee wizard
  - Step 1: Basic info (name, email, phone)
  - Step 2: Role & hierarchy (reports_to selection with org tree)
  - Step 3: Assignment (branch, department)
  - Step 4: Create user account (auto-generate password)

- `/admin/employees/:id` - Employee profile
  - Edit basic info
  - Change reports_to (with org chart preview)
  - View assigned SOPs
  - View recent runs & scores
  - Performance timeline

**Hierarchy Features:**
- Org chart visualization (Mermaid/D3 tree)
- Drag-and-drop reassignment
- "View team" quick action

---

### 1.3 Department Management
**Current:** Simple DocType, no UI
**Required:** Department management with metrics

**Pages:**
- `/admin/departments` - Department list
  - Employee count per department
  - Template count per department
  - Average department score
  
- Department detail view
  - Employees in department
  - SOP templates for department
  - Department performance trends

---

## Phase 2: Assignment Management (Week 3)

### 2.1 SOP Assignment Management UI
**Current:** APIs exist (`assignments.py`), no frontend
**Required:** Full assignment interface

**Pages:**
- `/assignments` - Assignment management
  - Calendar view (who's assigned what, when)
  - List view with filters (template, employee, branch, status)
  - Bulk assignment interface
    - Select template
    - Select employees (multi-select with department/role filters)
    - Set effective date range
    - Preview & confirm

- `/assignments/:id` - Assignment detail
  - View assignment info
  - Edit effective dates
  - Deactivate/reactivate
  - View related runs

**Components:**
- AssignmentCalendar - FullCalendar integration showing assignments
- BulkAssignmentModal - Multi-step bulk assignment wizard
- AssignmentCard - Assignment summary with status

---

## Phase 3: Operations Control Center (Week 4)

### 3.1 Run Management (Admin View)
**Current:** Employees only see their own runs
**Required:** Admin view of all runs with controls

**Pages:**
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

**Pages:**
- `/corrective-actions` - Corrective actions dashboard
  - Kanban view: Open → In Progress → Resolved → Closed
  - Filters: priority, assignee, source template, date range
  - Metrics: avg resolution time, open by assignee

- `/corrective-actions/:id` - Detail view
  - Source run item details
  - Comments/activity thread
  - Resolution workflow
  - Escalation option

---

## Phase 4: System Configuration (Week 5)

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

### 4.2 Role & Permission Management
**Page:** `/admin/roles`

- View Pulse Roles
- Create custom roles
- Permission matrix (which role can do what)
- Feature toggles per role

---

## Phase 5: Advanced Features (Week 6-7)

### 5.1 Follow-up Rules Management
**Page:** `/admin/follow-up-rules`

- List existing rules
- Create new rule wizard:
  - Select source template
  - Select trigger condition (item fail, any fail, etc.)
  - Select action (create new run, notify, etc.)
  - Select target template/assignee
- Rule execution logs

### 5.2 Audit & Compliance
**Page:** `/admin/audit`

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

---

## Phase 6: Org Chart Visualization (Week 8)

### 6.1 Interactive Org Chart
**Page:** `/admin/org-chart`

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

---

## Implementation Priority Matrix

| Feature | Business Impact | Implementation Effort | Priority |
|---------|----------------|----------------------|----------|
| Employee Management | High | Medium | P0 |
| Branch DocType + UI | High | Low | P0 |
| Assignment Management | High | Medium | P0 |
| Corrective Actions UI | Medium | Low | P1 |
| Run Management (Admin) | Medium | Medium | P1 |
| Settings Page | Medium | Low | P1 |
| Org Chart | Medium | High | P2 |
| Audit Logs | Low | Medium | P2 |
| Follow-up Rules UI | Low | Medium | P2 |
| Reports/Exports | Low | High | P3 |

---

## Technical Considerations

### API Additions Needed
1. `pulse/api/employees.py` - Employee CRUD, hierarchy queries
2. `pulse/api/branches.py` - Branch CRUD
3. `pulse/api/corrective_actions.py` - CA workflow APIs
4. `pulse/api/settings.py` - Settings CRUD
5. `pulse/api/audit.py` - Audit log queries

### Frontend Components Needed
1. `OrgChart` - Hierarchical tree visualization
2. `EmployeeSelector` - Multi-select with hierarchy
3. `AssignmentCalendar` - FullCalendar integration
4. `BulkImportModal` - CSV upload & preview
5. `KanbanBoard` - For corrective actions

### Database Migrations
1. Create `tabPulse Branch` table
2. Migrate existing `branch` text field to Link field
3. Add indices for performance

---

## Success Metrics

- **Setup Time:** New org setup in < 30 minutes
- **Employee Onboarding:** Add employee in < 2 minutes
- **Assignment Creation:** Bulk assign in < 5 minutes
- **Visibility:** Admin can see all org activity in one view
