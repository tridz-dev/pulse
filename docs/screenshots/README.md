# Screenshot Guide for Pulse README

Place the following screenshots in this folder (`docs/screenshots/`) so the main README can reference them. Use the filenames below for consistency.

---

## Checklist

| # | Filename | What to capture | Tips |
|---|----------|-----------------|------|
| 1 | `dashboard.png` | **Dashboard** — Gauge, period selector (Day/Week/Month), team bar chart (if manager), most-missed tasks. | Log in as Supervisor or Area Manager so team section has data. |
| 2 | `team.png` | **Team** — Tabs “My Team” and “All Teams”, table with Name, Role, Department, Branch, Own/Team/Combined score. | Use Executive or Area Manager to show “All Teams” tab. |
| 3 | `team-levels-open.png` | **Team** — Same page with a filter or expanded row / level so hierarchy or detail is visible. | Optional: show period selector and one or two rows expanded or filtered. |
| 4 | `operations.png` | **Operations** — Tree view with at least one level expanded (e.g. Executive → Area Manager → Supervisor). | Log in as Area Manager or Executive; expand one or two nodes. |
| 5 | `insights.png` | **Insights** — Full page: filter bar (date range, Department, Branch), several charts (trends, dept/branch comparison, performers, etc.). | Log in as Executive or Area Manager. |
| 6 | `insights-drill.png` | **Insights** — After clicking a department or branch bar: “Filtered Employees” table visible below the charts. | Click one bar in Department or Branch comparison; ensure table is in frame. |
| 7 | `user-roles.png` | **User roles** — Either: (a) User profile header showing role alias (e.g. “Supervisor”), or (b) Sidebar/nav showing different menu items by role, or (c) PM Role list in Frappe. | Clarify in README caption whether it’s profile, nav, or backend. |
| 8 | `my-tasks.png` | **My Tasks** — List of runs (e.g. “Kitchen Open Checklist”) with checklist items and status. | Log in as Operator or Supervisor with assigned templates. |

---

## Suggested dimensions

- **Width:** 1200–1400 px (or full browser width at 1x zoom).
- **Format:** PNG or WebP.
- Crop to content where useful; avoid large empty margins.

---

## Embedding in README

In the main `README.md`, reference images like this:

```markdown
![Dashboard](docs/screenshots/dashboard.png)
![Team](docs/screenshots/team.png)
```

If you use a different path (e.g. `./docs/screenshots/`), keep it consistent so links work from the repo root.
