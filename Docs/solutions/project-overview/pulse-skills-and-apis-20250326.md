---
module: Pulse
date: 2025-03-26
problem_type: documentation
component: skills_apis
severity: informational
tags: [skills, apis, development, pulse, frappe, reference]
---

# Pulse Skills, APIs & Development Resources

Complete developer quick-reference for the Pulse SOP tracking application. This document consolidates all available AI skills, whitelisted APIs, bench commands, testing patterns, and demo credentials.

---

## Table of Contents

1. [Available Skills](#available-skills)
2. [API Reference](#api-reference)
3. [Quick Commands](#quick-commands)
4. [Testing Patterns](#testing-patterns)
5. [Demo Credentials](#demo-credentials)
6. [File Locations](#file-locations)

---

## Available Skills

Three specialized skills were created for Pulse development to capture reusable knowledge for AI agents.

### 1. pulse-admin

**Location:** `.agents/skills/pulse-admin/SKILL.md`

**Purpose:** Manage organizational structure - branches, employees, departments, and hierarchy.

**Use When:**
- Creating or managing organizational data in Pulse
- Setting up new locations
- Onboarding employees
- Configuring department structure

**Quick Reference Table:**

| Task | API | Frontend Route |
|------|-----|----------------|
| List branches | `pulse.api.branches.get_branches` | `/admin/branches` |
| Create branch | `pulse.api.branches.create_branch` | `/admin/branches/new` |
| List employees | `pulse.api.employees.get_employees` | `/admin/employees` |
| Create employee | `pulse.api.employees.create_employee` | `/admin/employees/new` |
| List departments | `pulse.api.departments.get_departments` | `/admin/departments` |
| Create department | `pulse.api.departments.create_department` | `/admin/departments` (dialog) |

**Employee Hierarchy:**
- Roles: Executive (4) → Area Manager (3) → Supervisor (2) → Operator (1)
- `reports_to` field creates the org tree
- `pulse_role` determines system permissions

---

### 2. browserless-testing

**Location:** `.agents/skills/browserless-testing/SKILL.md`

**Purpose:** Automated browser testing using browserless (Chromium) in Docker environments.

**Use When:**
- Local Chrome/Chromium sandbox restrictions ("Operation not permitted" errors)
- Docker/container environments without privileged browser access
- Automated screenshot capture for UI verification
- Testing authenticated/logged-in pages
- CI/CD pipeline browser automation

**Connection Details:**

| Property | Value |
|----------|-------|
| Host IP (from container) | `192.168.97.1` |
| Port | `3000` |
| Token | `123` (if configured) |
| Health Check | `http://192.168.97.1:3000/pressure?token=123` |

> ⚠️ **Note:** Hostname `browserless` is NOT resolvable from within containers due to Docker DNS limitations. Always use the host IP `192.168.97.1`.

---

### 3. frappe-pulse-dev

**Location:** `.agents/skills/frappe-pulse-dev/SKILL.md`

**Purpose:** Comprehensive development skill covering backend API development, React SPA frontend, DocType design, permissions, caching, and deployment.

**Use When:**
- Building new features
- Fixing bugs
- Maintaining the Pulse SOP tracking application

**Tech Stack:**
- Backend: Frappe 16 (Python)
- Frontend: React 19 + Vite 5 + Tailwind CSS 4
- Database: MariaDB
- Caching: Redis
- Charts: Recharts

---

## API Reference

All APIs are callable as `/api/method/pulse.api.<module>.<method>` with a valid Frappe session.

### auth.py

**File:** `pulse/api/auth.py`

| Method | Purpose |
|--------|---------|
| `get_current_employee()` | Returns current user's Pulse Employee + role info. Synthetic admin profile for System Manager/Pulse Admin without employee record |

**Example:**
```bash
curl http://localhost:8001/api/method/pulse.api.auth.get_current_employee \
  -b cookies.txt
```

---

### branches.py (Phase 1 - Org Management)

**File:** `pulse/api/branches.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_branches(filters, limit_start, limit)` | filters: `{city, is_active, branch_manager}` | List branches with employee counts |
| `get_branch_detail(branch_name)` | branch_name: string | Get detailed branch info with employees |
| `create_branch(values)` | values: branch fields dict | Create a new branch |
| `update_branch(branch_name, values)` | branch_name, values dict | Update existing branch |
| `deactivate_branch(branch_name)` | branch_name: string | Soft delete (deactivate) branch |
| `get_branch_options()` | - | Get branch options for dropdowns |
| `get_cities()` | - | Get unique cities for filtering |

**Example - Create Branch:**
```bash
curl -X POST http://localhost:8001/api/method/pulse.api.branches.create_branch \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "values": {
      "branch_name": "Downtown Store",
      "branch_code": "DT001",
      "city": "New York",
      "opening_time": "08:00",
      "closing_time": "22:00",
      "is_active": 1
    }
  }'
```

---

### employees.py (Phase 1 - Org Management)

**File:** `pulse/api/employees.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_employees(filters, limit_start, limit)` | filters: `{branch, department, pulse_role, is_active, search}` | Get employees with filters |
| `get_employee_detail(employee_name)` | employee_name: string | Get detailed employee information |
| `create_employee(values, create_user_account)` | values dict, create_user_account: bool | Create employee with optional user account |
| `update_employee(employee_name, values)` | employee_name, values dict | Update existing employee |
| `deactivate_employee(employee_name)` | employee_name: string | Soft delete employee |
| `reset_user_password(employee_name)` | employee_name: string | Reset employee's user password |
| `get_employee_hierarchy(employee_name)` | employee_name: optional | Get org hierarchy tree |
| `get_employee_options(filters)` | filters: optional | Get employee options for dropdowns |
| `change_reports_to(employee_name, new_reports_to)` | employee names | Change reporting structure |

**Example - Create Employee with User:**
```bash
curl -X POST http://localhost:8001/api/method/pulse.api.employees.create_employee \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "values": {
      "employee_name": "John Smith",
      "email": "john@company.com",
      "pulse_role": "Operator",
      "branch": "Downtown Store",
      "department": "Kitchen",
      "reports_to": "PLS-EMP-0001"
    },
    "create_user_account": true
  }'
```

**Response includes temp_password:**
```json
{
  "success": true,
  "name": "PLS-EMP-0851",
  "temp_password": "nkFk6sStvw"
}
```

---

### departments.py (Phase 1 - Org Management)

**File:** `pulse/api/departments.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_departments()` | - | Get all departments with counts |
| `get_department_detail(department_name)` | department_name: string | Get detailed department info |
| `create_department(values)` | values dict | Create new department |
| `update_department(department_name, values)` | department_name, values dict | Update department |
| `deactivate_department(department_name)` | department_name: string | Deactivate department |
| `get_department_options()` | - | Get department options for dropdowns |

---

### tasks.py

**File:** `pulse/api/tasks.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_my_runs(date)` | date: optional | Today's SOP Runs for current user |
| `get_runs_for_employee(employee, date)` | employee, optional date | Runs for specific employee (manager access) |
| `get_run_details(run_name)` | run_name: string | Full run + all items for checklist runner |
| `update_run_item(run_item_name, status, notes, numeric_value, outcome, failure_remark, file_url)` | Multiple params | Toggle item Pending↔Completed |
| `upload_run_item_evidence(run_item_name)` | run_item_name + file upload | Upload evidence file for run item |
| `complete_run(run_name)` | run_name: string | Mark run as Closed |

**Example - Get My Runs:**
```bash
curl "http://localhost:8001/api/method/pulse.api.tasks.get_my_runs?date=2025-03-26" \
  -b cookies.txt
```

---

### scores.py

**File:** `pulse/api/scores.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_score_for_user(employee, date, period_type)` | employee, optional date/period | Single employee score snapshot |
| `get_team_scores(manager_employee, date, period_type)` | manager, optional date/period | Scores for direct reports |
| `get_all_team_scores(employee, date, period_type)` | employee, optional date/period | Org-wide (Executive) or subtree (Area Manager) |
| `get_failure_analytics(manager_employee, date)` | manager, optional date | Top 5 most-missed tasks (last 30 days) |

**Scoring Formula:**
```
own_score = completed_items / total_items
team_score = mean(combined_score of direct reports)
combined_score:
  if team_score > 0 and own_items > 0: (own + team) / 2
  elif team_score > 0: team_score
  else: own_score
```

**Score Brackets:**
| Bracket | Range |
|---------|-------|
| Exceptional | ≥ 90% |
| Strong | 80-89% |
| Moderate | 60-79% |
| At Risk | 40-59% |
| Critical | < 40% |

---

### operations.py

**File:** `pulse/api/operations.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_operations_overview(top_employee, date, period_type)` | top_employee, optional date/period | Full hierarchy tree with scores (recursive) |
| `get_user_run_breakdown(employee, date, period_type)` | employee, optional date/period | Runs grouped by template for ScoreBreakdown |
| `get_hierarchy_breakdown(top_employee, date, period_type)` | top_employee, optional date/period | Full hierarchy with per-user breakdown (heavy) |

---

### insights.py

**File:** `pulse/api/insights.py`

All accept `department`, `branch`, `employee` filters. Scope is enforced by role.

| Method | Returns |
|--------|---------|
| `get_insight_departments()` | List of department names |
| `get_insight_branches()` | Distinct branches in scope |
| `get_score_trends(start, end, period_type, ...)` | `[{date, avg_score, employee_count}]` |
| `get_department_comparison(date, period_type, ...)` | `[{department, avg_score, headcount}]` |
| `get_branch_comparison(date, period_type, ...)` | `[{branch, avg_score, headcount}]` |
| `get_top_bottom_performers(date, period_type, limit, ...)` | `{top: [...], bottom: [...]}` |
| `get_template_performance(start, end, ...)` | Completion rate per SOP template |
| `get_completion_trend(start, end, ...)` | Daily `{date, completed, total, rate}` |
| `get_corrective_action_summary(...)` | `{by_status, by_priority, avg_resolution_hours}` |
| `get_day_of_week_heatmap(start, end, ...)` | `[{day_name, day_num, avg_rate}]` |
| `get_score_distribution(date, period_type, ...)` | `[{bracket, count}]` histogram |
| `get_most_missed_items(start, end, limit, ...)` | `[{checklist_item, template_title, department, misses}]` |
| `get_employees_by_department(department, date, period_type)` | Employees + scores for department |
| `get_employees_by_branch(branch, date, period_type)` | Employees + scores for branch |
| `get_outcome_summary(start_date, end_date, ...)` | Aggregate pass/fail by template |

---

### templates.py

**File:** `pulse/api/templates.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_all_templates()` | - | List all active SOP Templates |
| `get_all_templates_with_inactive()` | - | List all templates including inactive (admin) |
| `get_template_items(template_name)` | template_name: string | Ordered checklist items for template |
| `get_template_detail(template_name)` | template_name: string | Full template details |
| `get_template_schema()` | - | Schema options for template form generation |
| `create_template(values)` | values dict | Create new SOP Template |
| `update_template(template_name, values)` | template_name, values dict | Update existing template |
| `delete_template(template_name)` | template_name: string | Soft delete (deactivate) |
| `duplicate_template(template_name, new_title)` | template_name, optional new_title | Duplicate template |

---

### assignments.py

**File:** `pulse/api/assignments.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_assignments(filters, limit)` | optional filters, limit | List SOP Assignments with details |
| `get_assignment_detail(assignment_name)` | assignment_name: string | Get detailed assignment info |
| `create_assignment(template, employee, is_active)` | template, employee, optional is_active | Create new assignment |
| `create_bulk_assignments(template, employees, is_active)` | template, employees list, optional is_active | Bulk create assignments |
| `update_assignment(assignment_name, values)` | assignment_name, values dict | Update assignment |
| `delete_assignment(assignment_name)` | assignment_name: string | Delete assignment |
| `get_assignment_options()` | - | Get dropdown options for creation |
| `get_assignment_calendar(start_date, end_date, employee)` | optional dates, employee | Get scheduled runs for calendar |

---

### notifications.py

**File:** `pulse/api/notifications.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_my_notifications(limit, unread_only)` | optional limit, unread flag | Notifications for current employee |
| `mark_notification_read(notification_name)` | notification_name: string | Mark one notification read |
| `mark_all_read()` | - | Mark all notifications read |

---

### go.py

**File:** `pulse/api/go.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_home_summary()` | - | Pulse Go home: open runs today, overdue, team open (Redis-cached) |

---

### demo.py

**File:** `pulse/api/demo.py`

| Method | Parameters | Purpose |
|--------|------------|---------|
| `get_demo_status()` | - | Whether user can load/clear demo and if demo exists |
| `install_demo_data(enqueue)` | optional enqueue flag | Load demo data (admin only) |
| `clear_demo_data()` | - | Remove all demo data (admin only) |

---

### permissions.py

**File:** `pulse/api/permissions.py`

Internal module for row-level permission conditions. Registered in `hooks.py`:

```python
permission_query_conditions = {
    "SOP Run": "pulse.api.permissions.sop_run_conditions",
    "Score Snapshot": "pulse.api.permissions.score_snapshot_conditions",
    "Corrective Action": "pulse.api.permissions.corrective_action_conditions",
    "Pulse Notification": "pulse.api.permissions.pulse_notification_conditions",
}
```

---

### pulse_cache.py

**File:** `pulse/api/pulse_cache.py`

| Method | Purpose |
|--------|---------|
| `clear_pulse_api_redis_caches()` | Clear Redis API caches |

---

### pulse_cache_invalidate.py

**File:** `pulse/api/pulse_cache_invalidate.py`

Cache invalidation handlers. Registered in `hooks.py` as doc_events for SOP Run and SOP Run Item `on_update`.

---

## Quick Commands

### Demo Data Management

```bash
# Load demo data (19 users, 6 SOP templates, ~400 runs, ~390 score snapshots)
bench --site pulse.localhost pulse-load-demo

# Clear all demo data
bench --site pulse.localhost pulse-clear-demo

# Or via execute
bench --site pulse.localhost execute pulse.demo.seed.seed_demo_data
bench --site pulse.localhost execute pulse.demo.seed.clear_demo_data
```

### Scheduler Tasks (Manual Execution)

```bash
# Daily tasks - CalendarDay runs + lock overdue
bench --site pulse.localhost execute pulse.tasks.daily

# Generate daily runs specifically
bench --site pulse.localhost execute pulse.tasks.generate_daily_runs

# Lock overdue runs
bench --site pulse.localhost execute pulse.tasks.lock_overdue_runs

# Cache score snapshots (hourly job)
bench --site pulse.localhost execute pulse.tasks.cache_score_snapshots

# Every 15 minutes - TimeOfDay + Interval run generation
bench --site pulse.localhost execute pulse.tasks.every_quarter_hour

# Weekly runs (Mondays only)
bench --site pulse.localhost execute pulse.tasks.weekly

# Monthly runs (1st of month)
bench --site pulse.localhost execute pulse.tasks.monthly
```

### Database Checks

```bash
# Full data counts
bench --site pulse.localhost mariadb -e "
  SELECT 'Pulse Employee' as t, COUNT(*) FROM \`tabPulse Employee\`
  UNION ALL SELECT 'SOP Template', COUNT(*) FROM \`tabSOP Template\`
  UNION ALL SELECT 'SOP Assignment', COUNT(*) FROM \`tabSOP Assignment\`
  UNION ALL SELECT 'SOP Run', COUNT(*) FROM \`tabSOP Run\`
  UNION ALL SELECT 'SOP Run Item', COUNT(*) FROM \`tabSOP Run Item\`
  UNION ALL SELECT 'Score Snapshot', COUNT(*) FROM \`tabScore Snapshot\`
  UNION ALL SELECT 'Corrective Action', COUNT(*) FROM \`tabCorrective Action\`;"

# Quick run count
bench --site pulse.localhost mariadb -e "SELECT COUNT(*) FROM \`tabSOP Run\`;"
```

### Development Server

```bash
# Start development server (from edge16/ directory)
cd /workspace/development/edge16 && bench start

# Build frontend (from pulse/frontend/ directory)
cd apps/pulse/frontend && npm run build

# Run tests
bench --site pulse.localhost run-tests --module pulse.tests.test_api_smoke --lightmode
```

---

## Testing Patterns

### API Testing with curl

```bash
# Step 1: Login and save cookies
curl -X POST http://localhost:8001/api/method/login \
  -c cookies.txt \
  -d '{"usr": "chairman@pm.local", "pwd": "Demo@123"}'

# Step 2: Test API with cookies
curl http://localhost:8001/api/method/pulse.api.branches.get_branches \
  -b cookies.txt

# Test with parameters
curl "http://localhost:8001/api/method/pulse.api.employees.get_employees?filters={\"branch\":\"Branch N1\"}" \
  -b cookies.txt
```

### Browserless Screenshot Testing

**Basic Screenshot:**
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

**Authenticated Screenshot (Login → Screenshot Flow):**
```bash
#!/bin/bash
SITE="http://192.168.97.5:8001"
BROWSERLESS="http://192.168.97.1:3000"
TOKEN="123"
EMAIL="chairman@pm.local"
PASSWORD="Demo@123"

# Step 1: Login and get session
curl -s -X POST "$SITE/api/method/login" \
  -c /tmp/cookies.txt \
  -d "{\"usr\": \"$EMAIL\", \"pwd\": \"$PASSWORD\"}"

# Step 2: Extract sid
SID=$(grep sid /tmp/cookies.txt | tail -1 | awk '{print $7}')

# Step 3: Screenshot with auth
curl -s -X POST "$BROWSERLESS/screenshot?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$SITE/pulse\",
    \"cookies\": [
      {\"name\": \"sid\", \"value\": \"$SID\", \"domain\": \"192.168.97.5\", \"path\": \"/\"},
      {\"name\": \"system_user\", \"value\": \"yes\", \"domain\": \"192.168.97.5\", \"path\": \"/\"}
    ],
    \"waitFor\": 4000,
    \"viewport\": {\"width\": 1400, \"height\": 900}
  }" \
  --output dashboard.png

echo "Screenshot saved: dashboard.png"
```

**Multiple Page Screenshots:**
```bash
PAGES=("/pulse" "/pulse/admin/branches" "/pulse/admin/employees" "/pulse/admin/departments")

for page in "${PAGES[@]}"; do
  filename=$(echo "$page" | sed 's/\//_/g').png
  curl -X POST "$BROWSERLESS/screenshot?token=$TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"url\": \"$SITE$page\",
      \"cookies\": [{\"name\": \"sid\", \"value\": \"$SID\", \"domain\": \"192.168.97.5\", \"path\": \"/\"}],
      \"waitFor\": 4000,
      \"viewport\": {\"width\": 1400, \"height\": 900}
    }" \
    --output "$filename"
  echo "Saved: $filename"
done
```

### Content API (HTML Extraction)

```bash
curl -X POST "http://192.168.97.1:3000/content?token=123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://192.168.97.5:8001/pulse",
    "viewport": {"width": 1280, "height": 720}
  }'
```

### Function API (Custom Scripts)

```bash
curl -X POST "http://192.168.97.1:3000/function?token=123" \
  -H "Content-Type: application/javascript" \
  -d 'module.exports = async ({ page }) => {
    await page.goto("http://192.168.97.5:8001/pulse");
    await page.fill("#login_email", "chairman@pm.local");
    await page.fill("#login_password", "Demo@123");
    await page.click(".btn-login");
    await page.waitForTimeout(3000);
    return { url: page.url(), title: await page.title() };
  };'
```

---

## Demo Credentials

All demo accounts use password: **`Demo@123`**

| Email | Role | Branch | Purpose |
|-------|------|--------|---------|
| `chairman@pm.local` | Executive | HQ | Full org access, highest permissions |
| `md@pm.local` | Executive | HQ | Managing Director level access |
| `rm.north@pm.local` | Area Manager | North Region | Regional management, subtree access |
| `bm.n1@pm.local` | Supervisor | Branch N1 | Branch management, direct reports |
| `chef.n1@pm.local` | Operator | Branch N1 | Day-to-day task execution |

### Full Org Hierarchy (Demo)

```
Ramesh Agarwal (Chairman · Executive · HQ)
└── Priya Sharma (MD · Executive · HQ)
    ├── Vikram Patel (RM North · Area Manager · North Region)
    │   ├── Rahul Nair (BM N1 · Supervisor · Branch N1)
    │   │   └── Kavitha Raj (Sup N1 · Supervisor · Branch N1)
    │   │       ├── Arun Bhat   (Chef N1 · Operator · Branch N1)
    │   │       ├── Pooja Reddy (Chef N2 · Operator · Branch N2)
    │   │       ├── Ravi Verma  (Cashier N1 · Operator · Branch N1)
    │   │       └── Mohan Das   (Cleaner N1 · Operator · Branch N1)
    │   └── Meera Iyer (BM N2 · Supervisor · Branch N2)
    │       └── Deepak Singh (Sup N2 · Supervisor · Branch N2)
    │           └── Neha Gupta (Cashier N2 · Operator · Branch N2)
    ├── Anita Das (RM South · Area Manager · South Region)
    │   └── Suresh Kumar (BM S1 · Supervisor · Branch S1)
    │       └── Lakshmi Menon (Sup S1 · Supervisor · Branch S1)
    │           ├── Sunita Devi (Cleaner S1 · Operator · Branch S1)
    │           └── Vijay Singh (Driver · Operator · Branch S1)
    ├── Rajesh Mehta  (Purchase · Operator · HQ)
    └── Anjali Kapoor (Finance · Operator · HQ)
```

---

## File Locations

### Skills

| Skill | Path |
|-------|------|
| pulse-admin | `edge16/apps/pulse/.agents/skills/pulse-admin/SKILL.md` |
| browserless-testing | `edge16/apps/pulse/.agents/skills/browserless-testing/SKILL.md` |
| frappe-pulse-dev | `edge16/apps/pulse/.agents/skills/frappe-pulse-dev/SKILL.md` |

### API Files

| Module | Path |
|--------|------|
| auth.py | `edge16/apps/pulse/pulse/api/auth.py` |
| branches.py | `edge16/apps/pulse/pulse/api/branches.py` |
| departments.py | `edge16/apps/pulse/pulse/api/departments.py` |
| employees.py | `edge16/apps/pulse/pulse/api/employees.py` |
| tasks.py | `edge16/apps/pulse/pulse/api/tasks.py` |
| scores.py | `edge16/apps/pulse/pulse/api/scores.py` |
| operations.py | `edge16/apps/pulse/pulse/api/operations.py` |
| insights.py | `edge16/apps/pulse/pulse/api/insights.py` |
| templates.py | `edge16/apps/pulse/pulse/api/templates.py` |
| assignments.py | `edge16/apps/pulse/pulse/api/assignments.py` |
| notifications.py | `edge16/apps/pulse/pulse/api/notifications.py` |
| go.py | `edge16/apps/pulse/pulse/api/go.py` |
| demo.py | `edge16/apps/pulse/pulse/api/demo.py` |
| permissions.py | `edge16/apps/pulse/pulse/api/permissions.py` |
| pulse_cache.py | `edge16/apps/pulse/pulse/api/pulse_cache.py` |
| pulse_cache_invalidate.py | `edge16/apps/pulse/pulse/api/pulse_cache_invalidate.py` |

### Key Project Files

| File | Path |
|------|------|
| Main AGENTS.md | `edge16/apps/pulse/AGENTS.md` |
| Hooks (scheduler, permissions) | `edge16/apps/pulse/pulse/hooks.py` |
| Commands | `edge16/apps/pulse/pulse/commands.py` |
| Tasks (scheduler jobs) | `edge16/apps/pulse/pulse/tasks.py` |
| Frontend | `edge16/apps/pulse/frontend/` |
| Demo Data | `edge16/apps/pulse/pulse/demo/` |
| DocTypes - Core | `edge16/apps/pulse/pulse/pulse_core/doctype/` |
| DocTypes - Setup | `edge16/apps/pulse/pulse/pulse_setup/doctype/` |

---

## Related Resources

- **Main Project Reference:** `edge16/apps/pulse/AGENTS.md`
- **Frappe Docs:** https://frappeframework.com/docs
- **React Query:** https://tanstack.com/query/latest
- **Tailwind CSS:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com

---

*Document generated: 2025-03-26*
*Module: Pulse SOP Tracking Application*
*Bench: edge16 | Site: pulse.localhost | Port: 8001*
