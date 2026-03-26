---
name: insights
description: >
  Analytics and reporting module providing trends, comparisons, heatmaps, and 
  performance distributions. Powers the Insights page with SQL-aggregated data 
  from Score Snapshots. Consult when building reports, adding analytics, or 
  modifying data visualizations.
category: features
---

# Insights & Analytics

## Overview

The Insights module transforms raw execution data into actionable business intelligence. It answers questions like:
- Which departments are performing best?
- What day of the week has lowest completion rates?
- Which checklist items are missed most often?
- Where are the performance outliers?

All insights are role-scoped — a supervisor sees their team, an executive sees the entire organization.

## Key Files

| File | Purpose |
|------|---------|
| `pulse/api/insights.py` | All analytics API endpoints (SQL-based) |
| `frontend/src/pages/Insights.tsx` | Main insights dashboard page |
| `frontend/src/components/insights/InsightsFilters.tsx` | Date/department/branch/employee filter bar |
| `frontend/src/services/insights.ts` | Frontend service for insights APIs |
| `pulse/pulse_core/doctype/score_snapshot/` | Cached data source for aggregations |

## How It Works

### 1. Data Architecture

Insights queries use **Score Snapshots** (not live runs):

```
SOP Runs → Hourly Cache → Score Snapshots
                              ↓
Insights APIs read from Score Snapshots
                              ↓
Recharts visualizations in React
```

Why? Aggregating thousands of runs with live joins would be too slow.

### 2. API Structure

Each insight endpoint:
- Accepts filters: `department`, `branch`, `employee`, `start_date`, `end_date`, `period_type`
- Enforces role-based scope via `get_current_employee()`
- Uses raw SQL for efficient aggregation
- Returns data formatted for Recharts

Example:
```python
@frappe.whitelist()
def get_score_trends(start_date=None, end_date=None, period_type="Day", department=None, branch=None):
    # Build SQL with role-based WHERE clause
    # Return: [{"date": "2026-03-01", "avg_score": 0.82, "employee_count": 15}, ...]
```

### 3. Available Insights

| Endpoint | What It Shows | Chart Type |
|----------|---------------|------------|
| `get_score_trends()` | Score over time | Line chart |
| `get_department_comparison()` | Avg score by department | Bar chart |
| `get_branch_comparison()` | Avg score by branch | Bar chart |
| `get_top_bottom_performers()` | Best/worst employees | Lists |
| `get_template_performance()` | Completion by template | Bar chart |
| `get_completion_trend()` | Daily completion rate | Line chart |
| `get_corrective_action_summary()` | Actions by status/priority | Pie/donut |
| `get_day_of_week_heatmap()` | Performance by weekday | Heatmap |
| `get_score_distribution()` | Employees in each bracket | Histogram |
| `get_most_missed_items()` | Top missed checklist items | Bar chart |

### 4. Role-Based Scoping

The same API returns different data based on user's level:

```python
def apply_scope(query, current_employee):
    if current_employee["level"] == 4:  # Executive
        return query  # No filter
    elif current_employee["level"] == 3:  # Area Manager
        return query.where(employee.branch.in_(subtree_branches))
    elif current_employee["level"] == 2:  # Supervisor
        return query.where(employee.reports_to == current_employee["name"])
    else:  # Operator
        return query.where(employee.name == current_employee["name"])
```

### 5. Frontend Visualization

```tsx
// Insights.tsx
<InsightsFilters 
  onChange={(filters) => loadInsights(filters)}
/>
<Recharts.LineChart data={trends}>
  <Line dataKey="avg_score" />
</Recharts.LineChart>
```

Interactive features:
- Click department bar → drill to employees in that department
- Click branch bar → drill to employees in that branch
- Period selector: Day / Week / Month
- Date range picker

## Extension Points

### Adding a New Insight Chart

1. **Backend:** Add to `pulse/api/insights.py`:
```python
@frappe.whitelist()
def get_my_metric(date=None, ...):
    sql = """
        SELECT dimension, AVG(score) as avg_score
        FROM `tabScore Snapshot`
        WHERE {scope_conditions}
        GROUP BY dimension
    """
    return frappe.db.sql(sql, as_dict=True)
```

2. **Frontend:** Add to `services/insights.ts`:
```typescript
export async function getMyMetric(filters: InsightFilters) {
  return call('pulse.api.insights.get_my_metric', { ...filters });
}
```

3. **UI:** Add chart to `Insights.tsx` using Recharts

### Custom Date Granularity

Modify period_type handling:
- Add to DocType Select options
- Update SQL GROUP BY clause
- Update frontend period selector

### Export Functionality

Add export buttons:
1. Client-side CSV from current data
2. Server-side XLSX generation using Frappe's reporting

## Dependencies

- **Score Snapshot** — Pre-aggregated data source
- **Pulse Employee** — Hierarchy and filtering
- **Recharts** — Visualization library
- **date-fns** — Date manipulation

## Gotchas

1. **SQL Injection:** All insights use parameterized queries. Never use f-strings for SQL.

2. **Null Handling:** Missing snapshots return NULL in SQL. Coalesce to 0 or filter out.

3. **Performance:** Large orgs (1000+ employees) may need indexing on `score_snapshot.employee` and `period_key`.

4. **Timezone:** All dates stored in UTC. Frontend should convert to local time for display.

5. **Cache Lag:** Insights reflect last hourly snapshot, not real-time. Add "Refresh" button if needed.

6. **Empty Results:** Charts should handle empty arrays gracefully (show "No data" not crash).
