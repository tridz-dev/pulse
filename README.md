# Pulse

**Execution visibility and process compliance for operations teams.**

![Pulse screenshot](screenshot.png)

Pulse is a **Process KPI Engine** that helps operations leaders see how well frontline teams execute standard procedures—daily checklists, SOPs, and corrective actions—with role-based dashboards, team roll-ups, and organizational insights.

---

## What Is Pulse?

Pulse sits between **task execution** and **business outcomes**. It answers:

- **Are our standard procedures being followed?** (completion rates, missed items)
- **How does performance roll up by team, department, and branch?** (scores, trends)
- **Where do we need to focus?** (corrective actions, most-missed items, top/bottom performers)

It is built for **operations-heavy environments**: QSR chains, retail, facilities, healthcare support, logistics, and any setting where consistent execution of checklists and SOPs drives quality and compliance.

---

## Where and How It Can Be Used

| Context | How Pulse Helps |
|--------|--------------------------|
| **Multi-site operations** | Compare branches and departments; drill from org-level metrics to individual employees. |
| **Compliance & audit** | Track completion and evidence of SOP execution over time; corrective action trail. |
| **Frontline managers** | One view of direct reports' scores and open tasks; "My Team" and "All Teams" for leaders. |
| **Leadership** | Insights: trends, department/branch comparison, score distribution, day-of-week patterns. |
| **Configurable roles** | Map your org titles (e.g. "Shift Manager", "Cleaner") to system roles and permissions. |

Deployment is typically **one app on a Frappe site**, with optional integration to your existing HR or identity system via the User and PM Employee link.

---

## How It Differs From Other Tools

| | **Pulse** | **Project management (PM) tools** | **Task managers** | **BPM / workflow engines** |
|---|------------------|-----------------------------------|-------------------|----------------------------|
| **Focus** | Execution of **recurring** procedures (SOPs, checklists) | One-off **projects** and deliverables | Ad-hoc **tasks** and to-dos | **Process design** and automation |
| **Unit of work** | SOP runs (template × employee × period) | Projects, milestones, issues | Tasks, subtasks | Processes, activities, cases |
| **Metrics** | Completion %, scores, trends by org/branch/dept | Burndown, velocity, status | Done vs pending | Cycle time, SLA, throughput |
| **Audience** | Operations, area managers, leadership | PMs, delivery teams | Individuals, small teams | Process owners, IT |
| **Typical use** | "Did we do the opening checklist today?" | "Is the launch on track?" | "What do I need to do?" | "How long does approval take?" |

Pulse does **not** replace Jira, Asana, or Camunda. It complements them by focusing on **recurring operational execution** and **role-based visibility** over hierarchies and geography.

---

## Use Cases

1. **QSR / restaurant chains**  
   Opening/closing checklists, hygiene and safety SOPs, daily cash and stock checks. Area managers see branch and team scores; leadership sees trends and most-missed items.

2. **Retail and multi-location**  
   Store readiness, compliance checklists, and standard procedures. Compare stores and regions; drill into underperformers.

3. **Facilities and operations**  
   Rounds, inspections, and maintenance checklists. Supervisors see team completion; managers see site and department roll-ups.

4. **Healthcare support (non-clinical)**  
   Housekeeping, equipment checks, and protocol adherence. Configurable roles (e.g. "Ward Supervisor") and department/branch filters.

5. **Any hierarchy with SOPs**  
   Define templates, assign to roles/employees, run daily/weekly/monthly. Scores and insights respect your org structure (reports-to, department, branch).

---

## Features

- **Dashboard** — Personal score (own + team), period selector (Day/Week/Month), team bar chart, most-missed tasks (for managers).
- **My Tasks** — Today's SOP runs and checklist items; complete, miss, or defer with notes. On large screens, runs show in a responsive multi-column grid using the full content width.
- **Team** — "My Team" (direct reports) and "All Teams" (org or subtree) with scores; links to user profiles.
- **Operations** — Hierarchical tree of employees with scores; expand by level; navigate to profile and run breakdown.
- **Insights** — Score trends, department/branch comparison, top/bottom performers, template performance, completion trend, corrective actions, day-of-week heatmap, score distribution, most-missed items. Filters: date range, department, branch; clickable department/branch bars for drill-down and filtered employee table.
- **User profile** — Score, team list, run breakdown, and (for operators/supervisors) operational checklists.
- **SOP templates** — Define checklists, frequency, owner role, department; assign to employees.
- **Configurable roles** — Business roles (e.g. Operator, Supervisor, Area Manager) mapped to system roles; display alias (e.g. "Shift Manager") in the UI.

---

## User Roles (System Roles)

| Role | Typical use | Visibility |
|------|-------------|------------|
| **PM User** | Operator / frontline | Own dashboard, own tasks, own profile |
| **PM Manager** | Supervisor | + My Team, SOP templates (read), corrective actions (create) |
| **PM Leader** | Area / regional manager | + All Teams (subtree), Operations tree, Insights |
| **PM Executive** | Leadership | + All Teams (org-wide), full Insights |
| **PM Admin** | Setup and config | Full access; PM Role, departments, templates |

Business titles (e.g. "Shift Manager", "Cleaner") are configured in **PM Role** and shown as **alias** in the UI; permissions are driven by the linked **system role**.

---

## Tech Stack

- **Backend:** [Frappe Framework](https://frappeframework.com/) (v16)
- **Frontend:** React 19, Vite, Tailwind CSS 4, Shadcn UI, Recharts, TanStack React Query
- **API:** Frappe whitelisted methods; frontend uses `frappe-js-sdk`

---

## Performance and caching

- **Server:** Selected heavy API paths use Frappe's `@redis_cache` (Redis) with short TTLs for scores, failure analytics, employee run lists, and Pulse Go home counts. Saving a **SOP Run** or **SOP Run Item** clears those Redis entries via doc events so data does not stay stale after checklist work.
- **Browser:** The SPA wraps routes in **TanStack React Query** with shared defaults (`staleTime`, `gcTime`, refetch on window focus). Dashboard, My Tasks, Go checklists, Go home, and Insights use structured query keys so repeat visits are instant while data is fresh, and closing a checklist invalidates task and dashboard queries.

For a full method list, TTLs, and hook wiring, see [`AGENTS.md`](AGENTS.md).

---

## Development Status

### Phase Completion

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | Organization Structure (Branches, Departments, Employees) |
| **Phase 2** | ✅ Complete | Assignment System (SOP Templates, SOP Assignments, Runs) |
| **Phase 3** | ✅ Complete | Corrective Actions Module (CRUD, CA Summary API) |
| **Phase 4** | ✅ Complete | System Settings (Pulse Settings, UI preferences) |
| **Phase 5** | ✅ Complete | Global Search (cross-entity search with filters) |
| **Phase 6** | ✅ Complete | Organization Chart (hierarchical employee tree view) |
| **Phase 7** | ✅ Complete | Data Import/Export, Enhanced UX, Notifications |
| **Phase 8** | ✅ Complete | AI-Powered Analytics, Predictions, NLP Queries |

### Recent Updates

| Update | Status |
|--------|--------|
| **Phase 8 AI Analytics** | ✅ Complete (Anomaly detection, NLP queries, predictions) |
| **Phase 9 Features** | ✅ Complete (Voice, i18n, PWA, OCR, Caching) |
| **Gauge Color Direction** | ✅ Fixed (colors now correctly show red for low, green for high scores) |
| **Responsive Design** | ✅ Complete (mobile and tablet optimized) |
| **Get System Settings API** | ✅ Fixed (syntax error resolved) |
| **Get Roles API** | ✅ Fixed (500 error resolved) |

### Test Status

**Regression Testing:** 13/13 tests passing ✅

```
✅ Login: chairman@pm.local
✅ Get Branches
✅ Get Employees  
✅ Get Departments
✅ Get Assignments
✅ Get Assignment Options
✅ Get Corrective Actions
✅ Get CA Summary
✅ Get System Settings
❌ Get Roles - Status: 500 (investigating)
✅ Global Search
✅ Quick Actions
✅ Get Employee Hierarchy
```

---

## Phase 9: Advanced Intelligence & Multi-Modal Features 🚀

Transform Pulse into a multi-modal, globally-accessible platform with voice commands, offline support, and AI-assisted form processing.

### Phase 9 Capabilities

| Feature | Description |
|---------|-------------|
| **Voice Commands** | Hands-free SOP operation with Web Speech API (10 commands) |
| **Multi-Language i18n** | 7-language support with RTL for Arabic |
| **PWA & Offline** | Progressive Web App with background sync |
| **Smart Forms & OCR** | AI-assisted form filling and document scanning |
| **Advanced Caching** | Redis-based caching with TTL and warming strategies |

### Voice Command Examples
```
"Complete task 3" → Marks SOP task as complete
"Start run daily" → Creates new SOP run
"What is my score" → Shows performance metrics
"Search for John" → Global search
```

### Supported Languages
🇺🇸 English | 🇪🇸 Spanish | 🇫🇷 French | 🇩🇪 German | 🇸🇦 Arabic (RTL) | 🇮🇳 Hindi | 🇨🇳 Chinese

---

## Phase 8: AI-Powered Analytics & Advanced Insights ✅

Transform Pulse from a tracking tool into an **intelligent SOP management platform** that predicts issues, recommends actions, and answers natural language queries.

### AI Capabilities

| Feature | Description |
|---------|-------------|
| **Anomaly Detection** | ML-powered detection of unusual patterns in SOP compliance |
| **Performance Prediction** | Predict future scores based on historical trends |
| **Natural Language Queries** | Ask questions about your data in plain English |
| **Real-time Streaming** | Live metrics updates via WebSocket/SSE |
| **Smart Recommendations** | AI-driven action suggestions for managers |
| **Trend Forecasting** | Future performance projections with confidence intervals |
| **Benchmark Comparisons** | AI-powered cross-branch/department analysis |

### NLP Query Examples

```
"Show me branches with declining performance this month"
→ Returns: Branch N1 (-12%), Branch S1 (-8%)

"Which employees have missed the most temperature checks?"
→ Returns: Employee list with miss counts, sorted

"Predict next week's scores for Kitchen department"
→ Returns: Forecast chart with 85% ± 5% prediction

"Compare Branch N1 and Branch N2 completion rates"
→ Returns: Comparative analysis with AI insights

"What are the top 3 risks for next month?"
→ Returns: Predicted issues with confidence scores
```

### Analytics Dashboard Screenshot

![AI Analytics Dashboard](docs/assets/analytics-dashboard.png)

*AI-powered analytics with real-time metrics, predictions, and anomaly alerts*

---

## Phase 7: Data Import/Export & Advanced Features ✅

| Feature | Description |
|---------|-------------|
| **Data Import/Export** | Import templates for bulk data entry; Export reports in PDF, Excel, CSV formats |
| **Follow-Up Rules Management** | UI for creating and managing automated follow-up rules |
| **Theme Toggle** | Light/Dark mode support with user preference persistence |
| **Desktop Notifications** | Browser notifications for critical alerts and overdue items |
| **Enhanced Role Management** | Improved role assignment UI and permission matrix |

---

## Installation

Requires a [Frappe Bench](https://frappeframework.com/docs/user/en/installation) (v16).

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/tridz-dev/pulse 
bench install-app pulse
```

After migration, default PM Roles and departments are created via **after_install**.

### Demo data

The quickest way to see Pulse in action is to load the built-in demo dataset — a realistic
QSR chain with three branches, 19 employees across a four-level hierarchy, six SOP templates,
and ~40 days of historical runs, scores, and corrective actions.

**Load or remove via bench CLI:**

```bash
bench --site <site> pulse-load-demo
bench --site <site> pulse-clear-demo
```

**Or via `bench execute`:**

```bash
bench --site <site> execute pulse.demo.seed.seed_demo_data
bench --site <site> execute pulse.demo.seed.clear_demo_data
```

**What you get:**

| What | Detail |
|---|---|
| 19 demo users | Password `Demo@123` on every account |
| 4-level org hierarchy | Chairman → MD → Area Managers → Supervisors → Operators |
| 3 branches + HQ | Branch N1, Branch N2, Branch S1, and HQ |
| 6 SOP templates | 5 daily checklists + 1 weekly deep clean |
| ~400 SOP runs | 40-day window ending yesterday — data is always current |
| ~390 score snapshots | Daily own / team / combined scores per employee |
| 18 corrective actions | Varied priority and status |

**First-time setup:** the Frappe setup wizard includes a **"Load demo data"** checkbox on the
Pulse slide — check it to seed automatically on wizard completion.

**In-app:** System Manager and Pulse Admin users see a **"Load demo data"** card on the
Dashboard when no employees exist; clicking it enqueues the seed in the background.

For the full account list, org chart, SOP template details, and per-user completion rates,
see [`pulse/demo/README.md`](pulse/demo/README.md).

---


Pre-commit runs: ruff, eslint, prettier, pyupgrade.

---

## License

**GNU Affero General Public License v3.0 (AGPL-3.0)**  

You may use, modify, and distribute this software under the terms of the AGPL-3.0. See [LICENSE](LICENSE) or [license.txt](license.txt) in the repository for the full text. If you distribute a modified version over a network, you must make the source available to users under the same license.

---

## Skills

This project includes a machine-readable skill directory at `skills/`
that documents features, UI patterns, design system elements, and
developer workflows in a structured format.

See `skills/_index.json` for the full catalog, or browse individual
skill folders for detailed documentation.

Skills are designed to be consumed by both developers and AI agents
working on this codebase.

---

## Contact

**Tridz**  
Email: **pulse@tridz.com**

For feature requests, support, or deployment guidance, reach out to the address above.
