# Pulse Implementation Guide

## Summary

This document provides a comprehensive overview of the gap analysis and implementation work completed for the Pulse application.

---

## ✅ Completed Work

### 1. Analysis Phase
- **GAP_ANALYSIS.md** - Identified critical, high, medium, and low priority gaps
- **EXECUTION_PLAN.md** - 6-phase implementation plan with detailed steps
- **IMPLEMENTATION_STATUS.md** - Tracking document for progress

### 2. Phase 1: Template Management (COMPLETE)

#### Backend Changes
**File: `pulse/api/templates.py`**
- Extended with full CRUD operations
- Added permission checks
- Implemented soft delete (deactivate)
- Added duplicate functionality

#### Frontend Changes
**New Files:**
- `frontend/src/services/templateAdmin.ts` - API service
- `frontend/src/pages/TemplateForm.tsx` - Create/Edit template form

**Modified Files:**
- `frontend/src/App.tsx` - Added routes
- `frontend/src/pages/Templates.tsx` - Added CRUD actions

**New shadcn Components:**
- Accordion
- Select

#### Features Implemented
- ✅ Create new SOP templates
- ✅ Edit existing templates
- ✅ Deactivate (soft delete) templates
- ✅ Duplicate templates
- ✅ Manage checklist items (add, edit, delete, reorder)
- ✅ Configure scheduling (frequency, time, days, interval)
- ✅ Set outcome modes and proof requirements
- ✅ Search and filter templates
- ✅ View inactive templates

### 3. Phase 2 Started: Assignment Management (API READY)

**File: `pulse/api/assignments.py`**
- List assignments with filters
- Get assignment detail
- Create single assignment
- Bulk create assignments
- Update assignment status
- Delete assignment
- Assignment options for dropdowns
- Assignment calendar view

**File: `frontend/src/services/assignments.ts`**
- Type definitions
- API wrappers

---

## 📋 Remaining Work

### Phase 2 Completion (Assignments UI)
**Files to Create:**
```
frontend/src/pages/Assignments.tsx          # Assignment list page
frontend/src/pages/AssignmentForm.tsx       # Create assignment form
frontend/src/components/assignments/AssignmentCalendar.tsx
```

**Routes to Add:**
- `/assignments` - List view
- `/assignments/new` - Create assignment

**Features:**
- Assignment table with filters
- Create single assignment
- Bulk assignment creation
- Assignment calendar view
- Activate/deactivate assignments

### Phase 3: Employee & Org Management
**Files to Create:**
```
pulse/api/employees.py
pulse/api/departments.py
frontend/src/services/employees.ts
frontend/src/services/departments.ts
frontend/src/pages/Employees.tsx
frontend/src/pages/EmployeeForm.tsx
frontend/src/pages/Departments.tsx
frontend/src/components/employees/OrgTree.tsx
```

### Phase 4: Corrective Actions
**Files to Create:**
```
pulse/api/corrective_actions.py
frontend/src/services/correctiveActions.ts
frontend/src/pages/CorrectiveActions.tsx
frontend/src/pages/CorrectiveActionDetail.tsx
frontend/src/components/corrective-actions/CAForm.tsx
```

### Phase 5: Admin Settings
**Files to Create:**
```
pulse/api/admin.py
frontend/src/services/admin.ts
frontend/src/pages/Admin.tsx
frontend/src/pages/Roles.tsx
frontend/src/pages/Settings.tsx
```

### Phase 6: Polish
**Features:**
- Global search with ⌘K
- Theme toggle (light/dark)
- Desktop notifications dropdown
- Export to CSV/PDF
- Run history view

---

## 🔧 Development Commands

```bash
# Navigate to project
cd /workspace/development/edge16

# Build frontend
cd apps/pulse/frontend && npm run build

# Run tests
bench --site pulse.localhost run-tests --module pulse.tests.test_api_smoke --lightmode

# Load demo data
bench --site pulse.localhost pulse-load-demo

# Check DB
cd /workspace/development/edge16
bench --site pulse.localhost mariadb -e "SELECT 'Templates', COUNT(*) FROM \`tabSOP Template\`; SELECT 'Assignments', COUNT(*) FROM \`tabSOP Assignment\`;"
```

---

## 📁 Key Files Reference

### Backend (Python)
```
pulse/api/
├── templates.py          # Template CRUD (COMPLETE)
├── assignments.py        # Assignment CRUD (API READY)
├── employees.py          # TODO
├── departments.py        # TODO
├── corrective_actions.py # TODO
├── admin.py              # TODO
├── auth.py               # Existing
├── tasks.py              # Existing
├── scores.py             # Existing
├── insights.py           # Existing
├── operations.py         # Existing
├── notifications.py      # Existing
├── permissions.py        # Existing
└── demo.py               # Existing
```

### Frontend (TypeScript/React)
```
frontend/src/
├── pages/
│   ├── Dashboard.tsx          # Existing
│   ├── MyTasks.tsx            # Existing
│   ├── Team.tsx               # Existing
│   ├── Operations.tsx         # Existing
│   ├── Templates.tsx          # MODIFIED
│   ├── TemplateForm.tsx       # NEW
│   ├── Insights.tsx           # Existing
│   ├── UserProfile.tsx        # Existing
│   ├── Assignments.tsx        # TODO
│   ├── AssignmentForm.tsx     # TODO
│   ├── Employees.tsx          # TODO
│   ├── EmployeeForm.tsx       # TODO
│   ├── Departments.tsx        # TODO
│   ├── CorrectiveActions.tsx  # TODO
│   └── Admin.tsx              # TODO
├── services/
│   ├── templates.ts           # Existing
│   ├── templateAdmin.ts       # NEW
│   ├── assignments.ts         # NEW
│   ├── employees.ts           # TODO
│   ├── correctiveActions.ts   # TODO
│   └── admin.ts               # TODO
└── components/
    ├── layout/                # Existing
    ├── tasks/                 # Existing
    ├── shared/                # Existing
    └── ui/                    # Existing + NEW
```

---

## 🔐 Permission Model

| Role | Templates | Assignments | Employees | Corrective Actions | Insights |
|------|-----------|-------------|-----------|-------------------|----------|
| Pulse Admin | CRUD | CRUD | CRUD | CRUD | Full |
| Pulse Executive | CRUD | CRUD | CRUD | CRUD | Full |
| Pulse Leader | CRUD | CRUD | View | CRUD | Full |
| Pulse Manager | CRUD | CRUD | View | CRUD | Team Only |
| Pulse User | View | - | - | - | Own Only |

---

## 🧪 Testing Strategy

### Unit Tests
- Test each API method
- Test form validations
- Test permission checks

### Integration Tests
- Full workflow: Template → Assignment → Run → CA
- Test with each user role
- Test permission boundaries

### Demo Users to Test
| Email | Role | Expected Access |
|-------|------|-----------------|
| chairman@pm.local | Executive | Full |
| md@pm.local | Executive | Full |
| rm.north@pm.local | Area Manager | Subtree |
| bm.n1@pm.local | Supervisor | Team |
| chef.n1@pm.local | Operator | Own only |

---

## 📊 Success Metrics

### Phase 1 ✅
- [x] Build passes
- [x] Can create template
- [x] Can edit template
- [x] Can deactivate template
- [x] Checklist items work

### Phase 2
- [ ] Assignment list works
- [ ] Can create assignment
- [ ] Can bulk assign
- [ ] Calendar view works

### Phase 3
- [ ] Employee list works
- [ ] Can create employee
- [ ] Can edit employee
- [ ] Org tree displays

### Phase 4
- [ ] CA list works
- [ ] Can create CA
- [ ] Can update CA status
- [ ] CA metrics show

### Phase 5
- [ ] Admin panel works
- [ ] Role management works
- [ ] Settings save

### Phase 6
- [ ] Search works
- [ ] Theme toggle works
- [ ] Notifications dropdown works
- [ ] Export works

---

## 🚀 Quick Start for Continuing Development

1. **Backend API**: Add new methods to `pulse/api/<feature>.py`
2. **Frontend Service**: Create `frontend/src/services/<feature>.ts`
3. **Frontend Pages**: Create `frontend/src/pages/<Feature>.tsx`
4. **Routes**: Add to `frontend/src/App.tsx`
5. **Navigation**: Add to `frontend/src/components/layout/Sidebar.tsx`
6. **Build**: Run `npm run build` in frontend directory
7. **Test**: Test with `bench --site pulse.localhost ...`

---

## 📝 Notes

- All API methods must be whitelisted with `@frappe.whitelist()`
- Permission checks should use existing `has_*_permission()` patterns
- Frontend follows React Query patterns for data fetching
- UI uses shadcn/ui components with Tailwind CSS
- Dark theme is default; light theme support planned
