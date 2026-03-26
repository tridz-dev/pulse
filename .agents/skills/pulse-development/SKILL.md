---
name: pulse-development
description: |
  Complete Pulse SOP tracking application development guide.
  Covers all 7 phases - from org structure to import/export, 
  theme system, notifications, and advanced features.
  
  Use this skill when:
  - Building new features for Pulse
  - Debugging API issues
  - Adding new DocTypes
  - Creating frontend components
  - Working with the Gauge, Score calculation, or hierarchy
---

# Pulse Development Skill

## Application Overview
Pulse is a Frappe + React SPA for SOP execution tracking across multi-branch organizations with hierarchical performance scoring.

## Architecture

### Backend (Frappe)
```
pulse/api/           # Whitelisted API methods
pulse/pulse_core/    # Core transactional DocTypes
pulse/pulse_setup/   # Setup/config DocTypes
```

### Frontend (React 19 + Vite + Tailwind)
```
frontend/src/pages/       # Route pages
frontend/src/components/  # Shared components
frontend/src/hooks/       # Custom hooks (useTheme, useNotifications)
frontend/src/services/    # API client wrappers
```

## All 7 Phases Reference

| Phase | Feature | API File | UI Location |
|-------|---------|----------|-------------|
| 1 | Org Structure | branches.py, employees.py, departments.py | /admin/branches, /admin/employees, /admin/departments |
| 2 | Assignments | assignments.py | /admin/assignments |
| 3 | Corrective Actions | corrective_actions.py | /corrective-actions |
| 4 | System Settings | admin.py | /admin/settings, /admin/roles |
| 5 | Search, Audit | search.py | SearchModal (⌘K), /admin/audit |
| 6 | Org Chart | employees.py (hierarchy) | /admin/org-chart |
| 7 | Import/Export, Theme, Notifications | imports.py, exports.py, reports.py, follow_up_rules.py | /admin/import-export, ThemeToggle, NotificationDropdown |

## Key Patterns

### Backend API Pattern
```python
@frappe.whitelist()
def my_api(param: str) -> dict:
    """Docstring with description."""
    try:
        # Permission check
        if not frappe.has_permission('DocType', 'read'):
            frappe.throw(_('Not permitted'), frappe.PermissionError)
        
        # Logic here
        result = do_something(param)
        
        return {
            'success': True,
            'data': result,
            'message': _('Success')
        }
    except Exception as e:
        frappe.throw(_('Error: {0}').format(str(e)))
```

### Frontend API Call Pattern
```typescript
const fetchData = async () => {
  try {
    const response = await fetch('/api/method/pulse.api.module.function', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ param: value })
    });
    const data = await response.json();
    if (data.message?.success) {
      return data.message;
    }
  } catch (error) {
    toast.error('Failed to load data');
  }
};
```

### Component Pattern
```typescript
// Use existing UI components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from 'sonner';

export function MyComponent() {
  const { toast } = useToast();
  
  return (
    <Card>
      <CardContent>
        <Button onClick={() => toast.success('Done!')}>
          Click Me
        </Button>
      </CardContent>
    </Card>
  );
}
```

## Gauge Component
```typescript
import { Gauge } from '@/components/shared/Gauge';

// Color direction: 0%=red (poor) → 100%=green (good)
<Gauge 
  value={75} 
  size={220}
  label="KPI"
  mode="gradient"
  showTicks
  showGlow
/>
```

## Theme System
```typescript
import { useTheme } from '@/hooks/useTheme';

const { theme, setTheme, toggleTheme } = useTheme();
// theme: 'light' | 'dark' | 'system'
// setTheme('dark')
```

## Notifications
```typescript
import { useNotifications } from '@/hooks/useNotifications';

const { notifications, unreadCount, markAsRead } = useNotifications();
```

## Testing
```bash
cd /workspace/development/edge16
# Regression tests
python3 /tmp/regression_test.py

# Build verification
cd apps/pulse/frontend && npm run build
```

## Common Issues

1. **Build fails with TypeScript errors**
   - Check for unused imports
   - Ensure all JSX elements have proper types

2. **API returns 500**
   - Check DocType field names match code
   - Verify permissions

3. **Gauge colors wrong**
   - Colors reversed: 0%=red, 100%=green
   - Check `solidColorFromValue()` function

## DocType Reference

| DocType | Module | Key Fields |
|---------|--------|------------|
| Pulse Employee | pulse_setup | employee_name, pulse_role, branch, reports_to |
| SOP Template | pulse_core | title, department, frequency_type, checklist_items |
| SOP Run | pulse_core | template, employee, period_date, status |
| Corrective Action | pulse_core | description, status, priority, assigned_to |
| SOP Assignment | pulse_core | template, employee, is_active |
| SOP Follow Up Rule | pulse_core | source_template, trigger_condition, action |

## Environment
- **Bench Root**: `/workspace/development/edge16`
- **Site**: `pulse.localhost:8001`
- **Frontend Build**: `npm run build` (outputs to `pulse/public/frontend/`)
- **Demo Login**: `chairman@pm.localhost` / `Demo@123`
