# Pulse — Frontend

## 🏢 Business Overview
Pulse is an operational visibility platform for organizations that rely on consistent departmental execution. It closes the "Accountability Gap" by connecting bottom-up task execution to C-Suite KPIs. The UI is branded as **Pulse** in the app (sidebar, topbar).

---

## 🌟 Core Business Value
- **Hierarchical Accountability**: Scores roll up from the cleaning floor to the board room. Every missed task impacts the combined KPI of the reporting line.
- **Operational Closure**: Flag-failure workflows ensure gaps are detected and assigned for corrective action.
- **Temporal Insight**: Daily, Weekly, and Monthly views to identify execution trends.
- **Master SOP Catalog**: Central source of truth for standard procedures (Templates), including printable handbooks.

---

## 🛠 Feature Deep-Dive

### 1. Hierarchical Execution (CEO to Cleaner)
Recursive scoring: **Cleaner** (checklist completion), **Manager** (own tasks + team average), **CEO** (organization health).

### 2. Operational Drill-Down
**Operations** page: leadership can drill from branch/team into individual performance. Row click navigates to **User Profile** (`/operations/:userId`) for needle-in-a-haystack detail (which employee, which task, which day). Corrective actions and flagging support continuous improvement.

### 3. Visual Performance (Gauges & Charts)
- **`components/shared/Gauge.tsx`**: Instrument-style gauges with `requestAnimationFrame` for smooth needle animation, heatmap gradients (green → red), tick marks, and DM Mono for numeric readouts.
- **Charts**: Recharts for bar/line (e.g. Dashboard, UserProfile). Branch/department comparisons in real time.

---

## 🏗 Implementation Architecture

### Data Flow (Real Backend)
1. **`lib/frappe-sdk.ts`**: Single entry for Frappe — `frappe.call()`, `frappe.db()`, `frappe.auth()`. `VITE_FRAPPE_URL` for base URL.
2. **`services/*.ts`**: Thin client layer calling whitelisted `pulse.api.*` methods:
   - `tasks.ts` — `get_my_runs`, `get_runs_for_employee`, `get_run_details`, `update_run_item`, `complete_run`
   - `scores.ts` — `get_score_for_user`, `get_team_scores`, `get_failure_analytics`
   - `operations.ts` — org tree / operations data
   - `templates.ts` — SOP template catalog
   - `auth.ts` — login, current user
3. **Pages**: `Dashboard.tsx`, `MyTasks.tsx`, `MyTeam.tsx`, `Operations.tsx`, `UserProfile.tsx` (drill-down), `Templates.tsx`.
4. **Execution**: `MyTasks.tsx` — task runners complete runs; Dashboard/Operations/UserProfile consume scores and analytics.

No mock `db.ts` or `api/index.ts`; all data is from the Frappe backend. Temporal aggregation and recursive scoring live server-side; the frontend uses `date-fns` where needed for display/period handling.

### Routes (basename `/pulse`)
| Path | Page | Purpose |
|------|------|---------|
| `/` | Dashboard | Execution health, own/team scores, failure analytics |
| `/tasks` | MyTasks | User’s runs and checklist completion |
| `/team` | MyTeam | Direct reports, scores, operational status |
| `/operations` | Operations | Org tree, drill by branch/team |
| `/operations/:userId` | UserProfile | Individual performance, runs, charts |
| `/templates` | Templates | SOP template catalog, printable view |

### Tech Stack
- **Runtime**: React 19, React Router 7, Vite 5.
- **Styling**: Tailwind 4, tw-animate-css, Geist Variable (`--font-sans`). Gauge numerals use DM Mono.
- **UI**: shadcn (Radix-based), Base UI, CVA, `tailwind-merge`, `clsx`.
- **Data / charts**: `frappe-js-sdk`, `date-fns`, Recharts.
- **Build**: `yarn build` → `tsc -b && vite build --base=/assets/pulse/frontend/` and `copy-html-entry` to `pulse/www/pulse.html`.

### UI Principles
- **Contrast**: Dark zinc backgrounds (`bg-zinc-950`), semi-transparent panels, clear hierarchy.
- **Precision**: 1px borders, subtle gradients, custom SVG gauges, monospace for metrics.
- **Focus**: Summary on main views; detail in drill-downs (ScoreBreakdown sheet, UserProfile).

---

## 🚀 Future Roadmap
1. **Real-time**: WebSocket or push for live execution updates (replace polling if any).
2. **AI**: Predict failures from historical trends by branch/day.
3. **Evidence**: Photo/video evidence for checklist items.
4. **Offline PWA**: Offline capability with sync on reconnect.

---
**Package**: `neon-feynman` (see `package.json`).  
**Frontend version**: aligned with app `package.json` version.
