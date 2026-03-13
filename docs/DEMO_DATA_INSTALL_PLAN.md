# Plan: Install Pulse with Demo Data (ERPNext-style)

This plan describes how to let users **install demo data easily**, reusing the current seed and mirroring **ERPNext’s “install with demo”** behaviour where possible.

---

## 1. Current state

- **Seed module:** `pulse.seed.seed`
  - `seed_dummy_data()` — creates 19 users, PM Roles, departments, employees (hierarchy), SOP templates, assignments, ~30 days of runs, score snapshots, corrective actions.
  - `clear_dummy_data()` — removes all seeded data and demo users.
- **Data source:** `pulse.seed.data` (USERS, HIERARCHY, DEPARTMENTS, SOP_TEMPLATES, ASSIGNMENTS, etc.).
- **Execution today:** Manual only, e.g.  
  `bench --site <site> execute pulse.seed.seed.seed_dummy_data`

Goal: keep this seed as-is and add **two** ways to “install demo” so users can get demo data easily.

---

## 2. How ERPNext does “install with demo”

From `erpnext/hooks.py` and `erpnext/setup`:

1. **Setup wizard JS**  
   - `setup_wizard_requires = "assets/erpnext/js/setup_wizard.js"`  
   - This file is loaded when the **Frappe setup wizard** runs (first-time setup after install).

2. **Wizard adds a slide**  
   - In `erpnext/public/js/setup_wizard.js`, ERPNext uses `frappe.setup.on("before_load", ...)` and `erpnext.setup.slides_settings` to add an “organization” slide that includes a **Check** field:
     - `fieldname: "setup_demo"`
     - `label: __("Generate Demo Data for Exploration")`  
   - So the wizard form collects `setup_demo` (0/1).

3. **Completion hook**  
   - `setup_wizard_complete = "erpnext.setup.setup_wizard.setup_wizard.setup_demo"`  
   - When the user clicks **Complete**, Frappe calls every app’s `setup_wizard_complete` with **args** = all slide values (including `setup_demo`).

4. **Demo run**  
   - In `erpnext/setup/setup_wizard/setup_wizard.py`, `setup_demo(args)` does:
     - `if args.get("setup_demo"): frappe.enqueue(setup_demo_data, ...)`  
   - So if the box was checked, demo data is enqueued (and runs in background).

5. **Demo implementation**  
   - `erpnext/setup/demo.py` — `setup_demo_data()` creates company, masters, transactions.  
   - Pulse equivalent: **existing** `seed_dummy_data()`.

So for Pulse we need:

- A **setup wizard entry point**: one JS file (loaded via `setup_wizard_requires`) that adds a single slide with one checkbox.
- A **completion hook** that, when the wizard finishes, reads that checkbox and enqueues `seed_dummy_data` if set.
- **No change** to the existing seed data or `seed_dummy_data()` logic.

---

## 3. Options for “install demo” in Pulse

| Option | Description | When it runs |
|--------|-------------|--------------|
| **A. Setup wizard (ERPNext-style)** | Add a “Pulse” slide with “Load demo data” checkbox. On wizard complete, if checked, enqueue `seed_dummy_data`. | First time the site’s setup wizard runs (e.g. after `bench new-site` + `bench install-app process_meter`). |
| **B. Bench / CLI** | Document (and optionally add a bench command) to run the seed after install. | Anytime after install; no UI. |

Both should be supported: **A** for “install with demo” in the UI like ERPNext, **B** for scripts, existing sites, or users who skip the wizard.

---

## 4. Implementation plan

### 4.1 Use current seed as-is

- **No change** to `process_meter/seed/seed.py` or `process_meter/seed/data.py` for this feature.
- Keep `seed_dummy_data()` and `clear_dummy_data()` as the single source of truth for demo data.
- Optional: add a **whitelisted** wrapper so the wizard (or a future “Load demo” button) can call it safely, e.g.  
  `pulse.seed.seed.seed_dummy_data` (or a thin wrapper that checks `frappe.session.user` and then calls `seed_dummy_data()`). If we only ever call it from the setup wizard (as Administrator), the current execute path is enough; a whitelisted method is only needed if we add an in-app “Load demo” button later.

### 4.2 Option A — Setup wizard (ERPNext-style)

**1) Create setup wizard JS**

- **Path:** `process_meter/public/js/setup_wizard.js` (or equivalent so it ends up under `assets/pulse/js/setup_wizard.js` after build/copy).
- **Behaviour:**
  - Use `frappe.setup.on("before_load", function () { ... })`.
  - Only add the slide if Pulse is installed and (optional) we haven’t already run the wizard for PM (e.g. skip if `frappe.boot.setup_wizard_completed_apps` includes `"pulse"` so we don’t show the slide again).
  - Add **one slide**, e.g. name `"process_meter_demo"`, with:
    - One field: `fieldname: "setup_demo_pm"`, `fieldtype: "Check"`, label e.g. “Load demo data for Pulse (users, employees, SOPs, sample runs)”.
  - No need for other fields or company/language logic; keep the slide minimal.

**2) Hooks**

In `process_meter/hooks.py` add:

- `setup_wizard_requires = "assets/pulse/js/setup_wizard.js"`  
  (or the correct path your app uses for built/served JS.)
- `setup_wizard_complete = "pulse.setup.setup_wizard.setup_demo"`  
  (or equivalent path to the function below.)

Do **not** add `setup_wizard_stages` unless you need an extra “stage” in the progress bar; ERPNext uses stages for company/fixtures, and the actual demo is triggered only in `setup_wizard_complete`. For a single checkbox, only the complete hook is needed.

**3) Setup wizard complete handler**

- **New module:** e.g. `process_meter/setup/setup_wizard.py` (or under `process_meter/setup/` so it’s clear it’s setup logic).
- **Function:** e.g. `setup_demo(args)`:
  - If `args.get("setup_demo_pm")` (or whatever fieldname you used in the slide):
    - `frappe.enqueue(seed_dummy_data, enqueue_after_commit=True, at_front=True)`  
      (import `seed_dummy_data` from `pulse.seed.seed`.)
  - No return value required; Frappe just calls the hook for side effects.

**4) Assets**

- Ensure `public/js/setup_wizard.js` is built/copied into `assets/pulse/js/setup_wizard.js` (or that `setup_wizard_requires` points to the path Frappe actually loads). Match how other Frappe apps in your bench expose JS (e.g. build step or symlink).

**5) When the slide appears**

- The Frappe setup wizard runs when the site is not yet “set up” (e.g. first login after `bench new-site` + install apps). So the “Pulse” slide will appear in that same wizard run, alongside Frappe (and ERPNext if installed). Users who want “install with demo” leave the box checked and click Complete; your `setup_wizard_complete` then enqueues the seed.

**6) Already-configured sites**

- If the site has already completed the setup wizard, the wizard won’t run again. For those sites, “install demo” is only via **Option B** (bench/CLI).

### 4.3 Option B — Bench / CLI “install demo”

**1) Document the one-liner**

- In README and/or `docs/DataDummy.md` (or a short “Demo data” section):
  - After installing the app:  
    `bench --site <site_name> execute pulse.seed.seed.seed_dummy_data`
  - Optional: mention that this creates 19 users (passwords as in seed/data or a single docented password), departments, hierarchy, templates, ~30 days of runs, and that `clear_dummy_data` exists to remove it.

**2) Optional: bench command**

- Add a custom bench command, e.g. `bench --site <site> process-meter load-demo`, that:
  - Calls the same Python entry point as above (e.g. `pulse.seed.seed.seed_dummy_data`), or
  - Uses `bench execute pulse.seed.seed.seed_dummy_data`.
- Document this in the same place as the one-liner so users can “install demo” easily from the CLI without remembering the full `execute` syntax.

### 4.4 Optional: in-app “Load demo” for existing sites

- If you want a **post-install** option for sites that already completed the wizard, you can add:
  - A whitelisted method, e.g. `pulse.api.demo.install_demo_data()`, that (after a permission check, e.g. System Manager) calls `seed_dummy_data()`.
  - A one-time prompt or a “Load demo data” button in the Pulse app (e.g. on first open or in a setup page) that calls this method. Store a flag (e.g. in DB or Site Config) so you don’t ask again.
- This is independent of the setup wizard and can be implemented in a follow-up.

---

## 5. Summary checklist

| # | Task | Notes |
|---|------|--------|
| 1 | Keep current seed data and `seed_dummy_data()` as-is | Use existing `seed/data.py` and `seed/seed.py`. |
| 2 | Add `process_meter/public/js/setup_wizard.js` | One slide, one Check field (e.g. `setup_demo_pm`). Only add when PM installed and wizard not yet completed for PM. |
| 3 | Ensure JS is available as `assets/pulse/js/setup_wizard.js` | Or adjust path in hooks to match your app’s asset layout. |
| 4 | In `hooks.py`: `setup_wizard_requires` | Path to the setup wizard JS file. |
| 5 | In `hooks.py`: `setup_wizard_complete` | Path to `setup_demo(args)` in new setup module. |
| 6 | Add `process_meter/setup/setup_wizard.py` (or equivalent) | `setup_demo(args)`: if `args.get("setup_demo_pm")`, enqueue `seed_dummy_data`. |
| 7 | Document “install demo” in README / DataDummy | One-liner: `bench execute pulse.seed.seed.seed_dummy_data`. |
| 8 | (Optional) Add bench command `process-meter load-demo` | Wraps the execute call for convenience. |
| 9 | (Optional) Whitelisted “Load demo” API + in-app button | For already-configured sites. |

---

## 6. Difference from ERPNext demo

- **ERPNext:** Demo creates a demo **company**, masters (items, customers, suppliers), and **transactions** (PO, SO, etc.). It uses `demo_master_doctypes` / `demo_transaction_doctypes` and can be **cleared** via `clear_demo_data()` (deletes demo company and related data).
- **Pulse:** “Demo” = **seed data**: users, PM Employees, departments, SOP templates, assignments, runs, score snapshots, corrective actions. No separate “demo company”; it’s the same schema with sample data. Clearing is `clear_dummy_data()`.

So the **UX** is the same (checkbox in wizard → “install with demo”), but the **implementation** is: one slide, one complete hook, enqueue existing `seed_dummy_data()`. No need for demo_master_doctypes or a separate demo company.

---

## 7. References

- **ERPNext:**  
  - `erpnext/hooks.py` (setup_wizard_requires, setup_wizard_complete)  
  - `erpnext/public/js/setup_wizard.js` (slide with `setup_demo` checkbox)  
  - `erpnext/setup/setup_wizard/setup_wizard.py` (`setup_demo(args)`)  
  - `erpnext/setup/demo.py` (`setup_demo_data()`)
- **Frappe:**  
  - `frappe/desk/page/setup_wizard/setup_wizard.js` (loads `setup_wizard_requires`, passes `this.values` as `args` on complete)  
  - `frappe/desk/page/setup_wizard/setup_wizard.py` (calls each app’s `setup_wizard_complete` with `args`)
- **Pulse:**  
  - `process_meter/seed/seed.py` (`seed_dummy_data`, `clear_dummy_data`)  
  - `process_meter/seed/data.py` (USERS, HIERARCHY, etc.)  
  - `docs/DataDummy.md` (current seeding plan)
