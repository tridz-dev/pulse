# Pulse App Details

This is a Frappe application designed as a Process KPI Engine.

## Tech Stack
- **Backend Framework**: Frappe Framework (Version 16)
- **Frontend Framework**: React 19 (located in `./frontend`)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4, Shadcn UI
- **Icons**: Lucide React
- **Charts**: Recharts

## Project Structure
- `/pulse`: Core Frappe app backend logic.
- `/frontend`: Modern React-based frontend. (See [Frontend Documentation](file:///workspace/development/edge16/apps/pulse/frontend/AGENT.MD))

## Current Status
- [x] Initial app structure and frontend skeleton.
- [x] DocType definitions and schema (Pulse Employee, Pulse Department, SOP Template, SOP Run, Score Snapshot, Corrective Action, etc.).
- [x] Backend API (whitelisted methods: auth, tasks, scores, operations, templates).
- [x] Scheduler (daily/weekly/monthly run generation, lock overdue, cache scores).
- [x] Frontend integrated with Frappe via `frappe-js-sdk`; mock API removed.
- [ ] End-to-end testing with live Frappe backend.
- [ ] Evidence/file upload for checklist items (planned).
