---
name: pulse-development
description: |
  Complete Pulse SOP tracking application development guide.
  Covers all 8 phases - from org structure to AI-powered analytics,
  natural language queries, and real-time streaming.
  
  Use this skill when:
  - Building new features for Pulse
  - Debugging API issues
  - Adding new DocTypes
  - Creating frontend components
  - Working with the Gauge, Score calculation, or hierarchy
  - Implementing AI/ML features (Phase 8)
  - Adding real-time WebSocket functionality
  - Building NLP query interfaces
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

## All 8 Phases Reference

| Phase | Feature | API File | UI Location |
|-------|---------|----------|-------------|
| 1 | Org Structure | branches.py, employees.py, departments.py | /admin/branches, /admin/employees, /admin/departments |
| 2 | Assignments | assignments.py | /admin/assignments |
| 3 | Corrective Actions | corrective_actions.py | /corrective-actions |
| 4 | System Settings | admin.py | /admin/settings, /admin/roles |
| 5 | Search, Audit | search.py | SearchModal (⌘K), /admin/audit |
| 6 | Org Chart | employees.py (hierarchy) | /admin/org-chart |
| 7 | Import/Export, Theme, Notifications | imports.py, exports.py, reports.py, follow_up_rules.py | /admin/import-export, ThemeToggle, NotificationDropdown |
| 8 | AI Analytics, NLP, Real-time | ai_insights.py, nlp.py, realtime.py | /analytics, /nlp-query, /predictions, /anomalies |

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

## AI/ML Patterns (Phase 8)

### Anomaly Detection
```python
from pulse.api.ai_insights import detect_anomalies

# Detect anomalies in branch performance
anomalies = detect_anomalies(
    entity_type="branch",
    entity_id="Branch N1",
    metric="completion_rate",
    lookback_days=30
)
# Returns: [{"date": "2025-03-20", "score": 0.85, "is_anomaly": True, "severity": "high"}]
```

### Performance Prediction
```python
from pulse.api.ai_insights import predict_performance

# Predict next 14 days of performance
predictions = predict_performance(
    employee_id="PLS-EMP-0001",
    days_ahead=14
)
# Returns: {"forecast": [...], "confidence_intervals": [...], "trend": "declining"}
```

### NLP Query Processing
```python
from pulse.api.nlp import process_natural_query

# Process natural language query
result = process_natural_query(
    query="Show me branches with declining performance",
    context={"user_role": "Executive"}
)
# Returns: {"sql": "...", "results": [...], "explanation": "Branch N1 declined 12%..."}
```

## Real-time Hooks (Phase 8)

### WebSocket Connection
```typescript
// frontend/src/hooks/useRealtime.ts
import { useEffect } from 'react';

export function useRealtime(channels: string[], onMessage: (msg: any) => void) {
  useEffect(() => {
    const ws = new WebSocket(`wss://${window.location.host}/ws`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'subscribe', channels }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    
    return () => ws.close();
  }, [channels]);
}
```

### Server Broadcast
```python
# pulse/api/realtime.py
@frappe.whitelist()
def broadcast_event(event_type: str, payload: dict):
    """Broadcast event to connected clients."""
    redis = frappe.cache()
    redis.publish(f"pulse:events:{event_type}", json.dumps(payload))
```

## NLP Query Examples

### Supported Query Patterns
```
# Comparisons
"Compare Branch N1 and Branch N2 performance"
→ Returns: Comparative bar chart with trend analysis

# Filtering
"Show me operators with scores below 70%"
→ Returns: Filtered employee list with scores

# Trending
"Which departments are improving this month?"
→ Returns: Trend chart with % change per department

# Aggregation
"Average completion rate by branch"
→ Returns: Grouped bar chart with averages

# Predictions
"What will next week's scores look like?"
→ Returns: Forecast chart with confidence bands

# Anomalies
"Any unusual patterns in Kitchen this week?"
→ Returns: Anomaly alerts with severity
```

### Query Response Format
```typescript
interface NLPQueryResponse {
  query: string;
  intent: 'comparison' | 'filter' | 'trend' | 'aggregate' | 'predict' | 'anomaly';
  sql: string;                    // Generated SQL
  results: any[];                 // Query results
  explanation: string;            // Human-readable explanation
  visualization: 'table' | 'chart' | 'gauge' | 'text';
  suggested_queries: string[];    // Follow-up suggestions
}
```

## DocType Reference

| DocType | Module | Key Fields |
|---------|--------|------------|
| Pulse Employee | pulse_setup | employee_name, pulse_role, branch, reports_to |
| SOP Template | pulse_core | title, department, frequency_type, checklist_items |
| SOP Run | pulse_core | template, employee, period_date, status |
| Corrective Action | pulse_core | description, status, priority, assigned_to |
| SOP Assignment | pulse_core | template, employee, is_active |
| SOP Follow Up Rule | pulse_core | source_template, trigger_condition, action |
| ML Model Cache | pulse_core | model_name, entity_id, predictions, computed_at |
| NLP Query Log | pulse_core | query, intent, sql, execution_time |

## Environment
- **Bench Root**: `/workspace/development/edge16`
- **Site**: `pulse.localhost:8001`
- **Frontend Build**: `npm run build` (outputs to `pulse/public/frontend/`)
- **Demo Login**: `chairman@pm.localhost` / `Demo@123`

## Phase 8 Development Notes

### ML Model Storage
Models are cached in Redis with TTL:
- Predictions: 1 hour TTL
- Anomalies: 15 minutes TTL  
- NLP embeddings: 24 hours TTL

### WebSocket Channels
- `scores:{employee_id}` - Personal score updates
- `runs:{branch}` - Branch run completions
- `anomalies` - System-wide anomaly alerts
- `notifications:{user_id}` - User-specific notifications

### Testing AI Features
```bash
# Run AI-specific tests
bench --site pulse.localhost execute pulse.tests.test_ai_insights

# Test NLP query parsing
bench --site pulse.localhost execute pulse.tests.test_nlp

# Load test WebSocket
bench --site pulse.localhost execute pulse.tests.test_realtime_load
```
