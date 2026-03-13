# Insights Section — Analytics Plan

> Analytics layer for Pulse, accessible to Executive and Area Manager roles.
> Designed for scale, leveraging Frappe Query Report infrastructure for heavy aggregations
> and pre-computed Score Snapshot data for time-series queries.

---

## 1. Data Foundation

### Available DocTypes and Volumes (seed baseline)

| DocType | Records | Key Fields for Analytics |
|---------|---------|--------------------------|
| SOP Run | ~345 | employee, template, period_date, status, total_items, completed_items |
| SOP Run Item | ~1200+ | status (Pending/Completed/Missed), completed_at, weight, checklist_item |
| Score Snapshot | ~298 | employee, period_type, period_key, own_score, team_score, combined_score |
| Corrective Action | 18 | status, priority, assigned_to, raised_by, resolved_at |
| PM Employee | 19 | pulse_role, department, branch, reports_to (hierarchy) |
| SOP Template | 6 | department, frequency_type |
| SOP Assignment | 12 | template, employee |

### Scale Considerations

At production scale (100+ employees, 365 days):
- SOP Run: ~36,000/year (100 employees x ~360 daily runs)
- SOP Run Item: ~144,000/year (avg 4 items per run)
- Score Snapshot: ~36,500/year (100 employees x 365 days)

**Strategy**: Use SQL-level aggregation (GROUP BY, JOINs) via Frappe Query Reports
rather than Python-loop calculation. Read from Score Snapshot (pre-computed hourly)
for trend queries instead of recalculating scores on the fly.

---

## 2. Analytics Catalog

### 2.1 Score Trends (Time-Series Line Chart)

**What**: Combined score over time for an employee, department, branch, or the whole org.

**Data Source**: `Score Snapshot` — already cached hourly.

**SQL Pattern**:
```sql
SELECT period_key AS date, AVG(combined_score) AS avg_score
FROM `tabScore Snapshot`
WHERE period_type = 'Day'
  AND employee IN (...)  -- scoped by role
  AND period_key BETWEEN %(start)s AND %(end)s
GROUP BY period_key
ORDER BY period_key
```

**Aggregation Levels**:
- Org-wide (Executive only)
- By department
- By branch
- Individual employee

**Card**: Sparkline showing last 30 days; full chart on expand.

---

### 2.2 Department Comparison (Horizontal Bar Chart)

**What**: Average combined score per department for the selected period.

**SQL Pattern**:
```sql
SELECT e.department, AVG(s.combined_score) AS avg_score,
       COUNT(DISTINCT s.employee) AS headcount
FROM `tabScore Snapshot` s
JOIN `tabPulse Employee` e ON s.employee = e.name
WHERE s.period_type = 'Day' AND s.period_key = %(date)s AND e.is_active = 1
GROUP BY e.department
ORDER BY avg_score DESC
```

**Card**: Ranked horizontal bars (Kitchen: 92%, Operations: 85%, etc.)

---

### 2.3 Branch Comparison (Horizontal Bar Chart)

**What**: Average combined score per branch for the selected period.

**SQL Pattern**: Same as 2.2 but `GROUP BY e.branch`.

**Card**: Ranked horizontal bars per branch.

---

### 2.4 Top and Bottom Performers (Leaderboard Table)

**What**: Top 5 and Bottom 5 employees by combined_score in the period.

**SQL Pattern**:
```sql
SELECT s.employee, e.employee_name, e.pulse_role, e.department, e.branch,
       s.combined_score, s.own_score, s.total_items, s.completed_items
FROM `tabScore Snapshot` s
JOIN `tabPulse Employee` e ON s.employee = e.name
WHERE s.period_type = 'Day' AND s.period_key = %(date)s AND e.is_active = 1
ORDER BY s.combined_score DESC
LIMIT 5
```

(Reverse for bottom 5.)

**Card**: Two mini-tables side by side — Top Performers (green) and Needs Attention (red).

---

### 2.5 Template Performance (Bar Chart)

**What**: Average completion rate per SOP Template.

**SQL Pattern**:
```sql
SELECT r.template, t.title, t.department,
       AVG(CASE WHEN r.total_items > 0
           THEN r.completed_items / r.total_items ELSE 0 END) AS avg_completion,
       COUNT(*) AS run_count
FROM `tabSOP Run` r
JOIN `tabSOP Template` t ON r.template = t.name
WHERE r.period_date BETWEEN %(start)s AND %(end)s
GROUP BY r.template
ORDER BY avg_completion ASC
```

**Card**: Bar chart — which SOPs are hardest to complete.

---

### 2.6 Completion Rate Trend (Area Chart)

**What**: Daily overall completion rate (completed_items / total_items) across the org.

**SQL Pattern**:
```sql
SELECT r.period_date AS date,
       SUM(r.completed_items) AS completed,
       SUM(r.total_items) AS total,
       SUM(r.completed_items) / SUM(r.total_items) AS rate
FROM `tabSOP Run` r
WHERE r.period_date BETWEEN %(start)s AND %(end)s
GROUP BY r.period_date
ORDER BY r.period_date
```

**Card**: Gradient area chart showing daily completion rate trend.

---

### 2.7 Corrective Action Summary (Stat Cards + Donut)

**What**: Open/In Progress/Resolved/Closed breakdown; avg resolution time; by priority.

**SQL Pattern**:
```sql
SELECT status, COUNT(*) AS count FROM `tabCorrective Action`
GROUP BY status

SELECT priority, COUNT(*) AS count FROM `tabCorrective Action`
WHERE status IN ('Open', 'In Progress')
GROUP BY priority

SELECT AVG(TIMESTAMPDIFF(HOUR, creation, resolved_at)) AS avg_hours
FROM `tabCorrective Action`
WHERE resolved_at IS NOT NULL
```

**Cards**:
- 4 stat cards (Open, In Progress, Resolved, Closed counts)
- Donut chart for status distribution
- Average resolution time in hours

---

### 2.8 Most Missed Items (Table)

**What**: Which checklist items are missed most frequently (already partially exists in `get_failure_analytics`).

**SQL Pattern**:
```sql
SELECT ri.checklist_item, COUNT(*) AS misses,
       t.title AS template_title, t.department
FROM `tabSOP Run Item` ri
JOIN `tabSOP Run` r ON ri.parent = r.name
JOIN `tabSOP Template` t ON r.template = t.name
WHERE ri.status = 'Missed'
  AND r.period_date BETWEEN %(start)s AND %(end)s
GROUP BY ri.checklist_item, t.title, t.department
ORDER BY misses DESC
LIMIT 10
```

**Card**: Ranked list with miss count, template name, department.

---

### 2.9 Day-of-Week Heatmap

**What**: Completion rates by day of week — identify which days have worse execution.

**SQL Pattern**:
```sql
SELECT DAYNAME(r.period_date) AS day_name,
       DAYOFWEEK(r.period_date) AS day_num,
       AVG(CASE WHEN r.total_items > 0
           THEN r.completed_items / r.total_items ELSE 0 END) AS avg_rate
FROM `tabSOP Run` r
WHERE r.period_date BETWEEN %(start)s AND %(end)s
GROUP BY day_name, day_num
ORDER BY day_num
```

**Card**: 7-cell heatmap row (Mon–Sun) with color intensity.

---

### 2.10 Hierarchy Health Distribution (Histogram)

**What**: Distribution of combined scores across the org — how many employees are in each bracket.

**SQL Pattern**:
```sql
SELECT
  CASE
    WHEN s.combined_score >= 0.9 THEN 'Exceptional (90-100%)'
    WHEN s.combined_score >= 0.8 THEN 'Strong (80-89%)'
    WHEN s.combined_score >= 0.6 THEN 'Moderate (60-79%)'
    WHEN s.combined_score >= 0.4 THEN 'At Risk (40-59%)'
    ELSE 'Critical (<40%)'
  END AS bracket,
  COUNT(*) AS count
FROM `tabScore Snapshot` s
JOIN `tabPulse Employee` e ON s.employee = e.name
WHERE s.period_type = 'Day' AND s.period_key = %(date)s AND e.is_active = 1
GROUP BY bracket
ORDER BY MIN(s.combined_score) DESC
```

**Card**: Stacked bar or histogram with color-coded brackets.

---

## 3. Frappe Query Reports

Create server-side Query Reports for heavy aggregations. These run as SQL with Python
post-processing and integrate with Frappe's report viewer. They can also be called from
the frontend via `run_query_report`.

### Reports to Create

| Report Name | Module | Type | Purpose |
|-------------|--------|------|---------|
| PM Score Trends | Pulse | Query Report | Time-series scores with department/branch/employee filters |
| PM Department Summary | Pulse | Query Report | Department-level comparison for a date range |
| PM Template Performance | Pulse | Query Report | SOP completion rates by template |
| PM Corrective Actions | Pulse | Query Report | CA status, resolution times, priority breakdown |

These reports serve dual purpose:
1. Consumable in Frappe's built-in Report Builder UI (for admins)
2. Called from the React frontend via API for the Insights page

---

## 4. Backend API Design

### New Module: `process_meter/api/insights.py`

All endpoints use SQL-level aggregation for performance. They read from pre-computed
Score Snapshot and SOP Run tables — no recursive Python calculation.

```python
@frappe.whitelist()
def get_score_trends(employee=None, department=None, branch=None,
                     start_date=None, end_date=None, period_type="Day"):
    """Time-series scores. Returns [{date, avg_score, employee_count}]."""

@frappe.whitelist()
def get_department_comparison(date=None, period_type="Day"):
    """Average scores per department. Returns [{department, avg_score, headcount}]."""

@frappe.whitelist()
def get_branch_comparison(date=None, period_type="Day"):
    """Average scores per branch. Returns [{branch, avg_score, headcount}]."""

@frappe.whitelist()
def get_top_bottom_performers(date=None, period_type="Day", limit=5):
    """Top N and bottom N employees. Returns {top: [...], bottom: [...]}."""

@frappe.whitelist()
def get_template_performance(start_date=None, end_date=None):
    """Completion rates per SOP template. Returns [{template, title, avg_completion, run_count}]."""

@frappe.whitelist()
def get_completion_trend(start_date=None, end_date=None):
    """Daily completion rate. Returns [{date, completed, total, rate}]."""

@frappe.whitelist()
def get_corrective_action_summary():
    """CA breakdown. Returns {by_status, by_priority, avg_resolution_hours}."""

@frappe.whitelist()
def get_day_of_week_heatmap(start_date=None, end_date=None):
    """Completion rate by day of week. Returns [{day_name, day_num, avg_rate}]."""

@frappe.whitelist()
def get_score_distribution(date=None, period_type="Day"):
    """Score histogram brackets. Returns [{bracket, count}]."""
```

**Permission enforcement**: Each endpoint checks the caller's PM Employee role.
Executive sees org-wide. Area Manager sees their subtree only (filter by employee IN subtree).
Others get empty results.

---

## 5. Frontend Implementation

### 5.1 Route and Sidebar

| Item | Value |
|------|-------|
| Route | `/insights` |
| Sidebar label | Insights |
| Icon | `BarChart3` (lucide) |
| Visibility | Executive and Area Manager only (`hideFor: ['Operator', 'Supervisor']`) |

### 5.2 Page Layout: `frontend/src/pages/Insights.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│  Insights                                  [Day][Week][Month]│
│  Organizational analytics and performance trends.            │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │  Org Score Trend     │  │  Completion Rate     │         │
│  │  (line chart, 30d)   │  │  (area chart, 30d)   │         │
│  └──────────────────────┘  └──────────────────────┘         │
│                                                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│  │ Dept Avg  │ │ Branch Avg│ │ Open CAs  │ │ Avg Resol.│   │
│  │   87%     │ │   84%     │ │    5      │ │  12.3 hrs │   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘   │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │  Dept Comparison     │  │  Branch Comparison   │         │
│  │  (horiz bar chart)   │  │  (horiz bar chart)   │         │
│  └──────────────────────┘  └──────────────────────┘         │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │  Top 5 Performers    │  │  Needs Attention     │         │
│  │  (green table)       │  │  (red table)         │         │
│  └──────────────────────┘  └──────────────────────┘         │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │  Template Perf.      │  │  Day-of-Week Heatmap │         │
│  │  (bar chart)         │  │  (Mon-Sun cells)     │         │
│  └──────────────────────┘  └──────────────────────┘         │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │  Score Distribution  │  │  Corrective Actions  │         │
│  │  (histogram)         │  │  (stat cards + donut)│         │
│  └──────────────────────┘  └──────────────────────┘         │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │  Most Missed Items (ranked table, top 10)       │        │
│  └─────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Service Layer: `frontend/src/services/insights.ts`

One function per backend endpoint. All return typed data.

### 5.4 Charts

Use Recharts (already installed):
- `LineChart` for score trends
- `AreaChart` for completion rate trend
- `BarChart` (horizontal) for department/branch comparison
- `BarChart` for template performance and score distribution
- `PieChart` for corrective action donut
- Custom SVG cells for day-of-week heatmap

---

## 6. Role Visibility Matrix

| Analytics Card | Executive | Area Manager | Supervisor | Operator |
|----------------|-----------|-------------|------------|----------|
| Score Trends (org) | Full org | Subtree | -- | -- |
| Dept Comparison | All depts | Subtree depts | -- | -- |
| Branch Comparison | All branches | Subtree branches | -- | -- |
| Top/Bottom Performers | All employees | Subtree | -- | -- |
| Template Performance | All | Subtree runs | -- | -- |
| Completion Rate Trend | Org-wide | Subtree | -- | -- |
| Corrective Actions | All CAs | Subtree CAs | -- | -- |
| Day-of-Week Heatmap | Org-wide | Subtree | -- | -- |
| Score Distribution | Org-wide | Subtree | -- | -- |
| Most Missed Items | Org-wide | Subtree | -- | -- |

---

## 7. Implementation Steps

### Phase 1: Backend (API + Reports)

| Step | File | Description |
|------|------|-------------|
| 1 | `api/insights.py` | Create all 9 whitelisted endpoints with SQL aggregation |
| 2 | `api/__init__.py` | Ensure insights module is importable |
| 3 | Report: PM Score Trends | Frappe Query Report (optional, for admin Report Builder) |

### Phase 2: Frontend

| Step | File | Description |
|------|------|-------------|
| 4 | `services/insights.ts` | Service layer — typed fetch functions for each endpoint |
| 5 | `pages/Insights.tsx` | Main page with chart grid layout |
| 6 | `components/layout/Sidebar.tsx` | Add "Insights" nav item, hide for Operator/Supervisor |
| 7 | `App.tsx` | Add `/insights` route |

### Phase 3: Build and Test

| Step | Description |
|------|-------------|
| 8 | `yarn build` — verify no type errors |
| 9 | Browser test as Chairman (full insights), Area Manager (scoped), Supervisor (hidden) |

---

## 8. Files to Create/Modify

### New Files

- `process_meter/api/insights.py` — 9 endpoints
- `frontend/src/services/insights.ts` — service layer
- `frontend/src/pages/Insights.tsx` — page component

### Modified Files

- `frontend/src/components/layout/Sidebar.tsx` — add Insights nav item
- `frontend/src/App.tsx` — add route

### Optional (Frappe Reports)

- `process_meter/process_meter/report/pm_score_trends/` — Query Report files
- `process_meter/process_meter/report/pm_department_summary/` — Query Report files

---

## 9. Implementation Log

| Step | Status | Notes |
|------|--------|-------|
| api/insights.py | Done | 9 whitelisted endpoints with SQL aggregation, role-based scoping |
| services/insights.ts | Done | Typed fetch functions for all endpoints |
| pages/Insights.tsx | Done | Chart grid: score trend, completion trend, dept/branch comparison, top/bottom performers, template perf, day-of-week heatmap, score distribution, CA donut, most missed items |
| Sidebar + App route | Done | Insights nav item, hideFor Operator/Supervisor |
| Browser test | Done | Chairman sees full Insights; Operator/Supervisor see Access Restricted |

---

## 10. Performance Notes

1. **Read from Score Snapshot** — already computed hourly by `cache_score_snapshots()`.
   No real-time recursive calculation needed for trend/comparison queries.

2. **SQL aggregation** — All endpoints use `frappe.db.sql()` with GROUP BY,
   not Python loops. Queries touch indexed columns (employee, period_date, period_key).

3. **Date-range limits** — Default to last 30 days for trends, single date for comparisons.
   Frontend sends explicit date params.

4. **Subtree caching** — For Area Manager, compute subtree employee list once per request
   and pass as IN clause. Reuse `_get_subtree_employees` from `scores.py`.

5. **Frappe Query Reports** — For admin-facing heavy reports, use Frappe's built-in
   Query Report infrastructure (runs server-side, cacheable, exportable to CSV/Excel).
   The React frontend calls the same data via `run_query_report` or custom API.
