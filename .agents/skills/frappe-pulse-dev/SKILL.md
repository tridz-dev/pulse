---
name: frappe-pulse-dev
description: Comprehensive development skill for Pulse Frappe app - covers backend API development, React SPA frontend, DocType design, permissions, caching, and deployment. Use when building new features, fixing bugs, or maintaining the Pulse SOP tracking application. Includes patterns for API design, frontend routing, scoring logic, and scheduler tasks.
---

# Frappe Pulse Development Skill

Complete guide for developing the Pulse SOP tracking application.

## Project Overview

**Tech Stack:**
- Backend: Frappe 16 (Python)
- Frontend: React 19 + Vite 5 + Tailwind CSS 4
- Database: MariaDB
- Caching: Redis
- Charts: Recharts

**Repository Layout:**
```
edge16/
└── apps/pulse/
    ├── pulse/                    # Frappe app (backend)
    │   ├── api/                  # Whitelisted API methods
    │   ├── pulse_core/doctype/   # Core transactional DocTypes
    │   ├── pulse_setup/doctype/  # Setup/config DocTypes
    │   ├── patches/              # Database migrations
    │   └── demo/                 # Demo data
    └── frontend/                 # React SPA
        └── src/
            ├── pages/            # Route pages
            ├── components/       # Shared UI
            └── services/         # API clients
```

## Quick Commands

```bash
# Development server
cd edge16 && bench start

# Build frontend
cd apps/pulse/frontend && npm run build

# Run tests
bench --site pulse.localhost run-tests --module pulse.tests.test_api_smoke --lightmode

# Database check
bench --site pulse.localhost mariadb -e "SELECT COUNT(*) FROM \`tabSOP Run\`;"

# Load/clear demo
bench --site pulse.localhost pulse-load-demo
bench --site pulse.localhost pulse-clear-demo
```

## Backend Development

### Creating a New API

**File:** `pulse/api/<module>.py`

```python
import frappe
from frappe import _

@frappe.whitelist()
def my_new_api(param1, param2=None):
    """Docstring describing the API.
    
    Args:
        param1: Required parameter
        param2: Optional parameter
    
    Returns:
        dict with success status and data
    """
    # Validate permissions
    if not has_permission(frappe.session.user):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    
    # Business logic
    result = process_data(param1, param2)
    
    return {
        "success": True,
        "data": result,
        "message": _("Operation completed")
    }
```

### DocType Design

**Setup DocTypes** (`pulse_setup` module):
- Master data: Pulse Role, Pulse Department, Pulse Branch
- Config: Pulse Employee, Pulse Notification

**Core DocTypes** (`pulse_core` module):
- Transactional: SOP Template, SOP Assignment, SOP Run
- Child tables: SOP Checklist Item, SOP Run Item
- Analytics: Score Snapshot
- Workflow: Corrective Action, SOP Follow-up Rule

### Permission Model

**Frappe Roles → Pulse Roles:**
```
Pulse User      → Operator (Level 1)
Pulse Manager   → Supervisor (Level 2)
Pulse Leader    → Area Manager (Level 3)
Pulse Executive → Executive (Level 4)
Pulse Admin     → Admin (Full access)
```

**Row-level conditions:** Register in `hooks.py`:
```python
permission_query_conditions = {
    "SOP Run": "pulse.api.permissions.sop_run_conditions",
}
```

### Caching Strategy

**Server-side (Redis):**
```python
from frappe.utils.caching import redis_cache

@redis_cache(ttl=120)
def expensive_calculation(employee, date):
    # This result is cached for 2 minutes
    return calculate_score(employee, date)
```

**Cache invalidation:**
```python
# In hooks.py - doc_events
"SOP Run": {
    "on_update": "pulse.api.pulse_cache_invalidate.on_sop_run_saved"
}
```

## Frontend Development

### Adding a New Page

**1. Create page component:**
```typescript
// frontend/src/pages/MyNewPage.tsx
export function MyNewPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold">My New Page</h1>
    </div>
  );
}
```

**2. Add route in App.tsx:**
```typescript
import { MyNewPage } from './pages/MyNewPage';

<Route path="my-page" element={<MyNewPage />} />
```

**3. Add to Sidebar (if needed):**
```typescript
const navItems = [
  { name: 'My Page', path: '/my-page', icon: MyIcon },
];
```

### API Client Pattern

```typescript
// services/myApi.ts
export async function fetchMyData(filters?: Record<string, any>) {
  const response = await fetch(
    `/api/method/pulse.api.my_module.my_api?filters=${encodeURIComponent(JSON.stringify(filters))}`
  );
  const data = await response.json();
  return data.message;
}
```

### TanStack Query Pattern

```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['myData', filters],
  queryFn: () => fetchMyData(filters),
  staleTime: 60000, // 1 minute
});
```

## Scoring Logic

**Core Formula:**
```
own_score = completed_items / total_items

team_score = mean(combined_score of direct reports)

combined_score:
  if team_score > 0 and own_items > 0: (own + team) / 2
  elif team_score > 0: team_score
  else: own_score
```

**Score Brackets:**
- Exceptional: ≥ 90%
- Strong: 80-89%
- Moderate: 60-79%
- At Risk: 40-59%
- Critical: < 40%

## Scheduler Tasks

**Registered in hooks.py:**

| Frequency | Function | Purpose |
|-----------|----------|---------|
| all_15_minutes | `every_quarter_hour` | TimeOfDay + Interval run generation |
| daily | `daily` | CalendarDay runs + lock overdue |
| hourly | `hourly` | Cache score snapshots |
| weekly | `weekly` | Generate weekly runs (Mondays) |
| monthly | `monthly` | Generate monthly runs (1st) |

## Common Patterns

### Creating an Employee with User

```python
# 1. Create Frappe User
user = frappe.get_doc({
    "doctype": "User",
    "email": email,
    "first_name": name.split()[0],
    "new_password": temp_password
})
user.insert(ignore_permissions=True)

# 2. Add Pulse roles
add_pulse_roles_to_user(user.name)

# 3. Create Pulse Employee
employee = frappe.get_doc({
    "doctype": "Pulse Employee",
    "employee_name": name,
    "user": user.name,
    "pulse_role": role,
    "branch": branch,
    "department": department,
    "reports_to": manager
})
employee.insert(ignore_permissions=True)
```

### Frontend Wizard Pattern

```typescript
const STEPS = [
  { id: 1, title: 'Step 1', description: '...' },
  { id: 2, title: 'Step 2', description: '...' },
];

const [currentStep, setCurrentStep] = useState(1);
const [formData, setFormData] = useState({});

const handleNext = () => {
  if (validateStep(currentStep)) {
    setCurrentStep(s => s + 1);
  }
};
```

### Error Handling

**Backend:**
```python
try:
    doc.insert()
except Exception as e:
    frappe.throw(_("Failed: {0}").format(str(e)))
```

**Frontend:**
```typescript
try {
  const result = await createEmployee(data);
  toast.success(result.message);
} catch (error) {
  toast.error(error.message);
}
```

## Testing

### API Testing
```bash
# Login
curl -X POST http://localhost:8001/api/method/login \
  -c cookies.txt \
  -d '{"usr": "chairman@pm.local", "pwd": "Demo@123"}'

# Test API
curl http://localhost:8001/api/method/pulse.api.branches.get_branches \
  -b cookies.txt
```

### Screenshot Testing (with browserless)
```bash
curl -X POST "http://192.168.97.1:3000/screenshot?token=123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://192.168.97.5:8001/pulse",
    "waitFor": 3000,
    "viewport": {"width": 1400, "height": 900}
  }' \
  --output screenshot.png
```

## Migration Scripts

**Create:** `pulse/patches/<description>.py`

```python
import frappe

def execute():
    """Migration description."""
    # Migration logic
    frappe.db.commit()
```

**Register:** Add to `patches.txt`
```
pulse.patches.<description>.execute
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| FRAPPE_URL | http://localhost:8001 | Frappe site URL |
| PULSE_REDIS_CACHE | localhost:6379 | Redis for caching |

## Related Skills

- `pulse-admin` - Organizational structure management
- `browserless-testing` - Automated browser testing
- `frappe-framework` - General Frappe development (if available)

## Resources

- Frappe Docs: https://frappeframework.com/docs
- React Query: https://tanstack.com/query/latest
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com
