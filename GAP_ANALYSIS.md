# Pulse Gap Analysis

**Date:** 2026-03-26  
**Analyst:** AI Agent  
**Scope:** Full UI/UX, Feature Completeness, Admin Workflows  

---

## Executive Summary

Pulse has a solid foundation with **working core features**: Dashboard, Task Execution, Scoring, Insights, and Pulse Go mobile interface. However, there's a **critical gap in administrative interfaces** - the "control panel" for managing the system is essentially missing. Without these admin UIs, the app cannot be fully operationalized without direct database/Frappe Desk access.

**Severity Levels:**
- 🔴 **Critical** - Blocks core functionality, broken flows
- 🟠 **High** - Important for operational use, workarounds exist
- 🟡 **Medium** - Nice to have, affects UX
- 🟢 **Low** - Polish items

---

## 1. Critical Gaps (🔴)

### 1.1 Template Management - No CRUD Interface

**Current State:**
- Templates page (`/templates`) lists templates
- "Create Template" button exists but is **non-functional** (no onClick handler)
- Can only view template details in read-only sheet

**What's Missing:**
- Create new SOP Template form
- Edit existing template
- Delete/archive template
- Manage checklist items (add, edit, delete, reorder)
- Configure scheduling (frequency, time, grace period)
- Set outcome modes and proof requirements
- Configure prerequisites

**Impact:** Users cannot create or modify SOPs without Frappe Desk access

**Affected Roles:** Supervisor, Area Manager, Executive, Admin

---

### 1.2 SOP Assignment Management - Missing Entire Feature

**Current State:**
- `SOP Assignment` DocType exists in backend
- No UI to view, create, or manage assignments
- Scheduler depends on assignments to generate runs

**What's Missing:**
- Assignment list view
- Create assignment (Template → Employee)
- Bulk assignment (Template → Multiple Employees)
- Assignment status management (active/inactive)
- Assignment calendar view
- "Who has what assigned" report

**Impact:** Cannot link templates to employees = no runs generated = empty task lists

**Affected Roles:** Supervisor, Area Manager, Executive, Admin

---

### 1.3 Employee Management - No UI

**Current State:**
- `Pulse Employee` DocType exists
- Employees shown in Team/Operations views
- No management interface

**What's Missing:**
- Employee list view
- Create/edit employee form
- Manage hierarchy (reports_to)
- Assign roles and departments
- Deactivate/reactivate employees
- Bulk import employees
- Employee profile edit (self-service)

**Impact:** Org changes require database access; no self-service for profile updates

**Affected Roles:** Admin, Executive

---

### 1.4 Corrective Actions - No UI (Backend Exists)

**Current State:**
- `CorrectiveAction` DocType fully defined
- API methods may exist
- No frontend pages or components

**What's Missing:**
- Corrective Actions list page
- Create corrective action (from failed run item)
- View action details
- Update status (Open → In Progress → Resolved → Closed)
- Assign/reassign actions
- Priority management
- Resolution notes
- Actions dashboard/metrics

**Impact:** Failed items cannot be tracked to resolution; broken feedback loop

**Affected Roles:** Supervisor, Area Manager, Executive

---

## 2. High Priority Gaps (🟠)

### 2.1 Follow-Up Rules Management

**Current State:**
- `SOPFollowUpRule` DocType exists
- No UI to create or manage rules

**What's Missing:**
- Rules list page
- Create rule form (trigger, action, target)
- Rule activation/deactivation
- Rule execution log viewer
- Test rule functionality

**Impact:** Automation requires backend access; limits operational efficiency

---

### 2.2 Department & Role Management

**Current State:**
- `PulseDepartment` and `PulseRole` DocTypes exist
- No management UI

**What's Missing:**
- Department CRUD
- Role CRUD with permission mapping
- Department/role analytics

**Impact:** Organizational setup requires admin intervention

---

### 2.3 Run History & Archive

**Current State:**
- My Tasks only shows "today's" runs
- No historical view

**What's Missing:**
- Date range selector for runs
- Run archive/history page
- Filter runs by status, template, date
- Run detail view (completed runs)
- Export run data

**Impact:** Cannot review past performance or audit completed work

---

### 2.4 Search Functionality

**Current State:**
- Search button in sidebar is a placeholder
- No search implementation

**What's Missing:**
- Global search (employees, templates, runs)
- Search modal with keyboard shortcut (⌘K)
- Recent searches
- Search filters

**Impact:** Navigation friction; power users cannot quickly find items

---

### 2.5 Notification Dropdown (Desktop)

**Current State:**
- Bell icon in sidebar links to `/go/alerts`
- No desktop dropdown notification panel
- Mobile Go alerts page exists

**What's Missing:**
- Desktop notification dropdown in topbar
- Unread badge count
- Quick action buttons (mark read, view all)
- Real-time notification updates

**Impact:** Users miss important alerts; inconsistent desktop/mobile experience

---

## 3. Medium Priority Gaps (🟡)

### 3.1 Theme Toggle

**Current State:**
- Dark theme is hardcoded
- Design system mentions dark mode support

**What's Missing:**
- Light/dark theme toggle
- Theme persistence (localStorage)
- System preference detection

**Impact:** Accessibility and user preference

---

### 3.2 Bulk Operations

**Current State:**
- All operations are single-item

**What's Missing:**
- Bulk assignment creation
- Bulk employee import
- Bulk run actions (reassign, extend)
- Bulk template updates

**Impact:** Admin efficiency for large organizations

---

### 3.3 Export & Reporting

**Current State:**
- Insights charts are visual only
- No export functionality

**What's Missing:**
- Export insights to CSV/Excel
- Export run data
- PDF report generation
- Scheduled reports

**Impact:** Cannot share data outside system; no offline analysis

---

### 3.4 Mobile-Only Features (Pulse Go)

**Current State:**
- Go home, checklists, alerts, me pages exist
- GoMePage is essentially empty

**What's Missing:**
- Profile editing in Go mode
- Settings/preferences
- Offline support (PWA)
- Push notifications

---

## 4. Low Priority Gaps (🟢)

### 4.1 User Preferences

- Notification preferences (email, in-app, push)
- Default view preferences
- Date/time format preferences

### 4.2 Advanced Analytics

- Custom date ranges in insights
- Anomaly detection
- Predictive analytics
- Benchmarking

### 4.3 Integrations

- Calendar integration
- Email notifications
- Slack/Teams webhooks
- API key management UI

---

## Feature Coverage Matrix

| Feature | Backend | API | Frontend | Status |
|---------|---------|-----|----------|--------|
| SOP Template CRUD | ✅ | ⚠️ Partial | 🔴 Missing | **Critical** |
| SOP Assignment | ✅ | ⚠️ Partial | 🔴 Missing | **Critical** |
| Checklist Execution | ✅ | ✅ | ✅ | Complete |
| Run Lifecycle | ✅ | ✅ | ⚠️ (today only) | **High** |
| Scoring | ✅ | ✅ | ✅ | Complete |
| Team View | ✅ | ✅ | ✅ | Complete |
| Operations Tree | ✅ | ✅ | ✅ | Complete |
| Insights/Analytics | ✅ | ✅ | ✅ | Complete |
| Corrective Actions | ✅ | ⚠️ | 🔴 Missing | **Critical** |
| Follow-Up Rules | ✅ | ⚠️ | 🔴 Missing | **High** |
| Notifications | ✅ | ✅ | ⚠️ (mobile only) | **High** |
| Employee Mgmt | ✅ | ⚠️ | 🔴 Missing | **Critical** |
| Department Mgmt | ✅ | ⚠️ | 🔴 Missing | **High** |
| Role Mgmt | ✅ | ⚠️ | 🔴 Missing | **Medium** |
| Pulse Go Mobile | ✅ | ✅ | ✅ | Complete |
| Demo Data | ✅ | ✅ | ✅ | Complete |
| Search | 🔴 | 🔴 | 🔴 Missing | **High** |

---

## User Role Impact Analysis

### Operator (Level 1 - Pulse User)
| Feature | Current | Needed |
|---------|---------|--------|
| View today's tasks | ✅ | - |
| Complete checklists | ✅ | - |
| View own score | ✅ | - |
| View notifications | ✅ | - |
| Edit profile | 🔴 | **Add** |
| View run history | 🔴 | **Add** |

### Supervisor (Level 2 - Pulse Manager)
| Feature | Current | Needed |
|---------|---------|--------|
| View team scores | ✅ | - |
| View direct reports | ✅ | - |
| Create templates | 🔴 | **Add** |
| Manage assignments | 🔴 | **Add** |
| Create corrective actions | 🔴 | **Add** |
| View team history | 🔴 | **Add** |

### Area Manager (Level 3 - Pulse Leader)
| Feature | Current | Needed |
|---------|---------|--------|
| View subtree | ✅ | - |
| Insights access | ✅ | - |
| Manage employees | 🔴 | **Add** |
| Manage departments | 🔴 | **Add** |
| View all corrective actions | 🔴 | **Add** |

### Executive (Level 4 - Pulse Executive)
| Feature | Current | Needed |
|---------|---------|--------|
| Org-wide insights | ✅ | - |
| Operations overview | ✅ | - |
| Full employee management | 🔴 | **Add** |
| Follow-up rules | 🔴 | **Add** |
| Export reports | 🔴 | **Add** |

### Admin
| Feature | Current | Needed |
|---------|---------|--------|
| Demo data management | ✅ | - |
| Full system access | ⚠️ (via Desk) | **Admin Panel** |
| Role management | 🔴 | **Add** |
| System settings | 🔴 | **Add** |

---

## Broken UI Elements (Immediate Fix Required)

1. **Templates Page - "Create Template" Button**
   - File: `frontend/src/pages/Templates.tsx:61-67`
   - Issue: Button has no onClick handler
   - Fix: Add navigation to create form or open modal

2. **UserProfile - Flag Button**
   - File: `frontend/src/pages/UserProfile.tsx:318-329`
   - Issue: TODO comment, no corrective action creation
   - Fix: Implement corrective action flow

3. **Sidebar Search**
   - File: `frontend/src/components/layout/Sidebar.tsx:66-76`
   - Issue: Non-functional search button
   - Fix: Implement search modal

4. **Theme Toggle**
   - Missing entirely
   - Should be in topbar or user menu

---

## API Gaps

### Missing API Methods (Frontend Needs)

| Method | Purpose | Priority |
|--------|---------|----------|
| `create_template()` | Create new SOP template | Critical |
| `update_template()` | Edit template | Critical |
| `delete_template()` | Remove template | Critical |
| `create_assignment()` | Assign template to employee | Critical |
| `get_assignments()` | List assignments | Critical |
| `create_corrective_action()` | From failed item | Critical |
| `get_corrective_actions()` | List actions | Critical |
| `update_corrective_action()` | Status updates | Critical |
| `create_employee()` | Add employee | High |
| `update_employee()` | Edit employee | High |
| `get_employees()` | List with filters | High |
| `search()` | Global search | High |
| `export_insights()` | CSV export | Medium |

---

## Recommended Phasing

### Phase 1: Core Admin (Week 1-2)
- Template CRUD (create, edit, delete)
- Checklist item management
- Template scheduling config

### Phase 2: Assignment Management (Week 2-3)
- Assignment list view
- Create assignment form
- Bulk assignment
- Assignment calendar

### Phase 3: Employee & Org (Week 3-4)
- Employee list
- Employee create/edit
- Hierarchy management
- Department management

### Phase 4: Corrective Actions (Week 4-5)
- CA list page
- Create from failed item
- Status workflow
- CA dashboard

### Phase 5: Polish (Week 5-6)
- Search functionality
- Theme toggle
- Desktop notifications dropdown
- Export functionality

---

## Success Criteria

**Phase 1 Complete When:**
- [ ] Can create template with all fields
- [ ] Can edit existing templates
- [ ] Can manage checklist items (add, edit, delete, reorder)
- [ ] Can configure scheduling

**Phase 2 Complete When:**
- [ ] Can view all assignments
- [ ] Can create single assignment
- [ ] Can create bulk assignments
- [ ] Can activate/deactivate assignments

**Phase 3 Complete When:**
- [ ] Can view all employees
- [ ] Can create/edit employees
- [ ] Can manage reports_to hierarchy
- [ ] Can manage departments

**Phase 4 Complete When:**
- [ ] Can view all corrective actions
- [ ] Can create CA from run item
- [ ] Can update CA status
- [ ] CA appears in insights

**Phase 5 Complete When:**
- [ ] Search works across all entities
- [ ] Theme toggle functional
- [ ] Desktop notifications dropdown works
- [ ] Can export insights data

---

## Appendix: DocType Reference

| DocType | UI Needed | Priority |
|---------|-----------|----------|
| SOP Template | List, Create, Edit | Critical |
| SOP Checklist Item | Inline in Template | Critical |
| SOP Assignment | List, Create, Edit | Critical |
| SOP Run | History view, Detail | High |
| SOP Run Item | Inline in Run | Medium |
| SOP Follow Up Rule | List, Create, Edit | High |
| SOP Rule Execution Log | List view | Low |
| Corrective Action | List, Create, Edit | Critical |
| Pulse Employee | List, Create, Edit | Critical |
| Pulse Department | List, Create, Edit | High |
| Pulse Role | List, Create, Edit | Medium |
| Score Snapshot | Read-only views | Complete |
| Pulse Notification | Desktop dropdown | High |
