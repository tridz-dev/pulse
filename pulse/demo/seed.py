# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""
Pulse demo data seeder.

Entry points
------------
    seed_demo_data()   — create all demo records (idempotent, skips existing)
    clear_demo_data()  — remove every record created by this seeder

Bench
-----
    bench --site <site> pulse-load-demo
    bench --site <site> pulse-clear-demo
    bench --site <site> execute pulse.demo.seed.seed_demo_data
    bench --site <site> execute pulse.demo.seed.clear_demo_data
"""

import random
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import frappe
from frappe.utils import add_days, getdate, now

from pulse.demo.data import (
    ACCEPTANCE_ASSIGNMENTS,
    ACCEPTANCE_BRANCH,
    ACCEPTANCE_DEPARTMENT,
    ACCEPTANCE_FIXTURE_DATE,
    ACCEPTANCE_HIERARCHY,
    ACCEPTANCE_RUN_CASES,
    ACCEPTANCE_TEMPLATES,
    ACCEPTANCE_TIMEZONE,
    ACCEPTANCE_USERS,
    ASSIGNMENTS,
    COMPLETION_RATE,
    DEPARTMENTS,
    EMPLOYEE_BRANCH,
    EMPLOYEE_DEPARTMENT,
    END_DATE,
    HIERARCHY,
    SOP_TEMPLATES,
    START_DATE,
    USERS,
)


# ── Public API ─────────────────────────────────────────────────────────────────

def seed_demo_data() -> None:
    """Create all Pulse demo records. Safe to re-run — skips existing data."""
    if frappe.db.count("Pulse Employee") > 0:
        frappe.msgprint(
            "Demo data already present. Run clear_demo_data() first if you want a fresh seed."
        )
        return

    random.seed(42)
    frappe.set_user("Administrator")

    _ensure_pulse_roles()
    _create_users()
    _create_departments()
    _create_employees()
    _create_templates()
    _create_assignments()
    _create_runs()
    _create_score_snapshots()
    _create_corrective_actions()

    frappe.db.commit()
    frappe.msgprint(
        f"Demo data seeded: {len(USERS)} users · {len(DEPARTMENTS)} departments · "
        f"{len(SOP_TEMPLATES)} SOP templates · runs from {START_DATE} to {END_DATE}."
    )


def clear_demo_data() -> None:
    """Remove all records created by this seeder."""
    frappe.set_user("Administrator")

    for doctype in [
        "Corrective Action",
        "Score Snapshot",
        "SOP Run",
        "SOP Assignment",
        "SOP Template",
        "Pulse Employee",
        "Pulse Department",
    ]:
        for name in frappe.get_all(doctype, pluck="name"):
            frappe.delete_doc(doctype, name, force=1, ignore_permissions=True)

    for email, _, _ in USERS:
        if frappe.db.exists("User", email):
            frappe.delete_doc("User", email, force=1, ignore_permissions=True)

    frappe.db.commit()
    frappe.msgprint("Demo data cleared.")


# ── Internal helpers ───────────────────────────────────────────────────────────

def _ensure_pulse_roles() -> None:
    from pulse.install import create_default_pulse_role_records
    create_default_pulse_role_records()


def _create_users() -> None:
    _ROLE_MAP = {
        "Operator":     "Pulse User",
        "Supervisor":   "Pulse Manager",
        "Area Manager": "Pulse Leader",
        "Executive":    "Pulse Executive",
    }
    for email, full_name, pulse_role in USERS:
        sys_role = _ROLE_MAP.get(pulse_role, "Pulse User")
        if frappe.db.exists("User", email):
            frappe.get_doc("User", email).add_roles(sys_role, "System Manager")
            continue

        parts = full_name.split()
        user = frappe.get_doc({
            "doctype":          "User",
            "email":            email,
            "first_name":       parts[0],
            "last_name":        parts[-1] if len(parts) > 1 else "",
            "enabled":          1,
            "user_type":        "System User",
            "send_welcome_email": 0,
        })
        user.new_password = "Demo@123"
        user.insert(ignore_permissions=True)
        user.add_roles(sys_role, "System Manager")

    frappe.db.commit()


def _create_departments() -> None:
    for dept_name, description in DEPARTMENTS:
        if frappe.db.exists("Pulse Department", dept_name):
            continue
        frappe.get_doc({
            "doctype":         "Pulse Department",
            "department_name": dept_name,
            "description":     description,
            "is_active":       1,
        }).insert(ignore_permissions=True)

    frappe.db.commit()


def _create_employees() -> None:
    name_to_emp: dict[str, str] = {}

    for full_name, reports_to_name in HIERARCHY:
        email      = next(e for e, n, _ in USERS if n == full_name)
        dept       = EMPLOYEE_DEPARTMENT.get(full_name, "Operations")
        branch     = EMPLOYEE_BRANCH.get(full_name, "")
        pulse_role = next(r for e, n, r in USERS if n == full_name)
        reports_to = name_to_emp.get(reports_to_name) if reports_to_name else None

        emp = frappe.get_doc({
            "doctype":       "Pulse Employee",
            "employee_name": full_name,
            "user":          email,
            "pulse_role":    pulse_role,
            "branch":        branch,
            "department":    dept,
            "reports_to":    reports_to,
            "is_active":     1,
        })
        emp.insert(ignore_permissions=True)
        name_to_emp[full_name] = emp.name

    frappe.db.commit()


def _create_templates() -> None:
    active_from = START_DATE.isoformat()

    for title, dept, freq, owner_role, items in SOP_TEMPLATES:
        if frappe.db.exists("SOP Template", {"title": title}):
            continue

        checklist = [
            {
                "description":      desc,
                "sequence":         seq,
                "weight":           weight,
                "item_type":        itype,
                "evidence_required": evidence,
            }
            for desc, seq, weight, itype, evidence in items
        ]
        frappe.get_doc({
            "doctype":       "SOP Template",
            "title":         title,
            "department":    dept,
            "frequency_type": freq,
            "owner_role":    owner_role,
            "active_from":   active_from,
            "is_active":     1,
            "checklist_items": checklist,
        }).insert(ignore_permissions=True)

    frappe.db.commit()


def _create_assignments() -> None:
    for email, template_title in ASSIGNMENTS:
        templates = frappe.get_all("SOP Template", filters={"title": template_title}, limit=1)
        emps      = frappe.get_all("Pulse Employee", filters={"user": email}, limit=1)
        if not templates or not emps:
            continue
        if frappe.db.exists("SOP Assignment", {"template": templates[0].name, "employee": emps[0].name}):
            continue
        frappe.get_doc({
            "doctype":   "SOP Assignment",
            "template":  templates[0].name,
            "employee":  emps[0].name,
            "is_active": 1,
        }).insert(ignore_permissions=True)

    frappe.db.commit()


def _create_runs() -> None:
    assignments = frappe.get_all(
        "SOP Assignment",
        filters={"is_active": 1},
        fields=["name", "template", "employee"],
    )
    emp_user = {
        e.name: frappe.db.get_value("Pulse Employee", e.name, "user")
        for e in frappe.get_all("Pulse Employee", fields=["name", "user"])
    }
    emp_user = {k: v for k, v in emp_user.items() if v}

    today    = getdate()
    current  = START_DATE

    while current <= END_DATE:
        is_today = current == today
        for a in assignments:
            user = emp_user.get(a.employee)
            if not user:
                continue

            rate     = COMPLETION_RATE.get(user, 0.85)
            template = frappe.get_doc("SOP Template", a.template)

            if template.frequency_type == "Weekly" and current.weekday() != 0:
                continue
            if template.frequency_type == "Monthly" and current.day != 1:
                continue

            run_items = []
            for ci in template.checklist_items:
                completed = random.random() < rate
                status    = "Completed" if completed else ("Pending" if is_today else "Missed")
                run_items.append({
                    "checklist_item":   ci.description,
                    "weight":           ci.weight,
                    "item_type":        ci.item_type,
                    "status":           status,
                    "evidence_required": ci.evidence_required or "None",
                    "completed_at":     now() if completed and not is_today else None,
                })

            run_status = "Open" if is_today else ("Locked" if random.random() < 0.1 else "Closed")
            frappe.get_doc({
                "doctype":     "SOP Run",
                "template":    a.template,
                "employee":    a.employee,
                "period_date": current.isoformat(),
                "status":      run_status,
                "run_items":   run_items,
            }).insert(ignore_permissions=True)

        current = add_days(current, 1)

    frappe.db.commit()


def _create_score_snapshots() -> None:
    emp_scores = _compute_scores()
    now_dt     = now()

    for emp in frappe.get_all("Pulse Employee", fields=["name"]):
        emp_name = emp.name
        scores   = emp_scores.get(emp_name, {})

        for (period_type, period_key), (own, team, combined, total, completed) in scores.items():
            if frappe.db.exists(
                "Score Snapshot",
                {"employee": emp_name, "period_type": period_type, "period_key": period_key},
            ):
                continue
            frappe.get_doc({
                "doctype":         "Score Snapshot",
                "employee":        emp_name,
                "period_type":     period_type,
                "period_key":      period_key,
                "own_score":       own,
                "team_score":      team,
                "combined_score":  combined,
                "total_items":     total,
                "completed_items": completed,
                "computed_at":     now_dt,
            }).insert(ignore_permissions=True)

    frappe.db.commit()


def _compute_scores() -> dict:
    """Aggregate own/team/combined scores from SOP Runs per employee per day."""
    runs = frappe.get_all(
        "SOP Run",
        filters=[
            ["period_date", ">=", START_DATE.isoformat()],
            ["period_date", "<=", END_DATE.isoformat()],
        ],
        fields=["employee", "period_date", "total_items", "completed_items"],
    )

    emp_runs: dict[str, list] = {}
    for r in runs:
        emp_runs.setdefault(r.employee, []).append(r)

    hierarchy = {
        row["name"]: row["reports_to"]
        for row in frappe.get_all("Pulse Employee", fields=["name", "reports_to"])
    }
    children: dict[str, list] = {}
    for emp, parent in hierarchy.items():
        if parent:
            children.setdefault(parent, []).append(emp)

    result: dict = {}

    # Own scores per day
    for emp in frappe.get_all("Pulse Employee", pluck="name"):
        by_day: dict[date, tuple] = {}
        for r in emp_runs.get(emp, []):
            d = getdate(r.period_date) if r.period_date else None
            if not d:
                continue
            prev = by_day.get(d, (0, 0))
            by_day[d] = (prev[0] + (r.total_items or 0), prev[1] + (r.completed_items or 0))

        for d, (total, completed) in by_day.items():
            own = (completed / total) if total else 0
            result.setdefault(emp, {})[("Day", d.isoformat())] = (own, 0, own, total, completed)

    # Team scores (average of direct reports)
    for emp in frappe.get_all("Pulse Employee", pluck="name"):
        subs = children.get(emp, [])
        if not subs:
            continue
        for (pt, pk) in list(result.get(emp, {}).keys()):
            if pt != "Day":
                continue
            team_vals = [
                result.get(s, {}).get((pt, pk), (0, 0, 0, 0, 0))[2]
                for s in subs
            ]
            team_vals = [v for v in team_vals if v > 0]
            team      = sum(team_vals) / len(team_vals) if team_vals else 0
            own, _, _, total, completed = result[emp][(pt, pk)]
            combined  = (own + team) / 2 if team else own
            result[emp][(pt, pk)] = (own, team, combined, total, completed)

    return result


def _create_corrective_actions() -> None:
    runs_with_missed = frappe.get_all(
        "SOP Run",
        filters={"status": ["in", ["Closed", "Locked"]]},
        fields=["name", "employee"],
    )
    run_items = frappe.get_all(
        "SOP Run Item",
        filters={
            "parent": ["in", [r.name for r in runs_with_missed]],
            "status": "Missed",
        },
        fields=["parent", "checklist_item"],
    )

    by_run: dict[str, list] = {}
    for ri in run_items:
        by_run.setdefault(ri.parent, []).append(ri.checklist_item)

    supervisors = frappe.get_all(
        "Pulse Employee",
        filters={"pulse_role": "Supervisor"},
        pluck="name",
    )

    statuses   = (["Closed"] * 5 + ["Resolved"] * 4 + ["In Progress"] * 4 + ["Open"] * 5)
    priorities = (["Critical"] * 3 + ["High"] * 5 + ["Medium"] * 5 + ["Low"] * 5)
    random.shuffle(statuses)
    random.shuffle(priorities)

    created = 0
    for run_name, items in list(by_run.items())[:18]:
        if not items:
            continue
        run     = frappe.get_doc("SOP Run", run_name)
        sup     = random.choice(supervisors) if supervisors else run.employee
        status  = statuses[created % len(statuses)]
        priority = priorities[created % len(priorities)]
        desc    = f"Missed: {items[0][:50]}..."
        resolved = status in ("Closed", "Resolved")

        frappe.get_doc({
            "doctype":       "Corrective Action",
            "run":           run_name,
            "run_item_ref":  items[0][:140],
            "description":   desc,
            "status":        status,
            "assigned_to":   run.employee,
            "raised_by":     sup,
            "priority":      priority,
            "resolution":    "Resolved and verified." if resolved else None,
            "resolved_at":   now() if resolved else None,
        }).insert(ignore_permissions=True)
        created += 1

    frappe.db.commit()


# ── Acceptance fixture (S1-T06) ───────────────────────────────────────────────


def seed_acceptance_fixture() -> None:
    """Create the deterministic S1-T06 acceptance fixture. Idempotent."""
    frappe.set_user("Administrator")

    _ensure_pulse_roles()
    _acceptance_create_users()
    _acceptance_create_department()
    name_to_emp = _acceptance_create_employees()
    _acceptance_create_templates()
    assignments = _acceptance_create_assignments()
    _acceptance_create_runs(assignments, name_to_emp)

    frappe.db.commit()
    frappe.msgprint("Acceptance fixture seeded.")


def clear_acceptance_fixture() -> None:
    """Remove all records created by seed_acceptance_fixture()."""
    frappe.set_user("Administrator")

    # Delete runs first so children are gone before parents.
    for window in _acceptance_compute_windows():
        run_name = frappe.db.get_value("SOP Run", {"run_key": window["run_key"]}, "name")
        if run_name:
            frappe.delete_doc("SOP Run", run_name, force=1, ignore_permissions=True)

    # Delete assignments.
    for assignment_name, *_ in ACCEPTANCE_ASSIGNMENTS:
        if frappe.db.exists("SOP Assignment", assignment_name):
            frappe.delete_doc("SOP Assignment", assignment_name, force=1, ignore_permissions=True)

    # Delete templates.
    for title, *_ in ACCEPTANCE_TEMPLATES:
        template_name = frappe.db.get_value("SOP Template", {"title": title}, "name")
        if template_name:
            frappe.delete_doc("SOP Template", template_name, force=1, ignore_permissions=True)

    # Delete employees.
    for email, *_ in ACCEPTANCE_USERS:
        emp_name = frappe.db.get_value("Pulse Employee", {"user": email}, "name")
        if emp_name:
            frappe.delete_doc("Pulse Employee", emp_name, force=1, ignore_permissions=True)

    # Delete users.
    for email, *_ in ACCEPTANCE_USERS:
        if frappe.db.exists("User", email):
            frappe.delete_doc("User", email, force=1, ignore_permissions=True)

    # Delete the fixture department only if nothing else references it.
    dept_name = frappe.db.get_value(
        "Pulse Department", {"department_name": ACCEPTANCE_DEPARTMENT[0]}, "name"
    )
    if dept_name and frappe.db.count("Pulse Employee", {"department": dept_name}) == 0:
        frappe.delete_doc("Pulse Department", dept_name, force=1, ignore_permissions=True)

    frappe.db.commit()
    frappe.msgprint("Acceptance fixture cleared.")


def _acceptance_create_users() -> None:
    _ROLE_MAP = {
        "Operator":     "Pulse User",
        "Supervisor":   "Pulse Manager",
        "Area Manager": "Pulse Leader",
        "Executive":    "Pulse Executive",
    }
    for email, full_name, pulse_role in ACCEPTANCE_USERS:
        sys_role = _ROLE_MAP[pulse_role]
        if frappe.db.exists("User", email):
            frappe.get_doc("User", email).add_roles(sys_role, "System Manager")
            continue

        parts = full_name.split()
        user = frappe.get_doc({
            "doctype":          "User",
            "email":            email,
            "first_name":       parts[0],
            "last_name":        parts[-1] if len(parts) > 1 else "",
            "enabled":          1,
            "user_type":        "System User",
            "send_welcome_email": 0,
        })
        user.new_password = "Demo@123"
        user.insert(ignore_permissions=True)
        user.add_roles(sys_role, "System Manager")

    frappe.db.commit()


def _acceptance_create_department() -> None:
    dept_name, description = ACCEPTANCE_DEPARTMENT
    if frappe.db.exists("Pulse Department", {"department_name": dept_name}):
        return
    frappe.get_doc({
        "doctype":         "Pulse Department",
        "department_name": dept_name,
        "description":     description,
        "is_active":       1,
    }).insert(ignore_permissions=True)
    frappe.db.commit()


def _acceptance_create_employees() -> dict[str, str]:
    name_to_emp: dict[str, str] = {}

    for full_name, reports_to_name in ACCEPTANCE_HIERARCHY:
        email      = next(e for e, n, _ in ACCEPTANCE_USERS if n == full_name)
        pulse_role = next(r for e, n, r in ACCEPTANCE_USERS if n == full_name)
        reports_to = name_to_emp.get(reports_to_name) if reports_to_name else None

        existing = frappe.db.get_value("Pulse Employee", {"user": email}, "name")
        if existing:
            name_to_emp[full_name] = existing
            continue

        emp = frappe.get_doc({
            "doctype":       "Pulse Employee",
            "employee_name": full_name,
            "user":          email,
            "pulse_role":    pulse_role,
            "branch":        ACCEPTANCE_BRANCH,
            "department":    ACCEPTANCE_DEPARTMENT[0],
            "reports_to":    reports_to,
            "is_active":     1,
        })
        emp.insert(ignore_permissions=True)
        name_to_emp[full_name] = emp.name

    frappe.db.commit()
    return name_to_emp


def _acceptance_create_templates() -> None:
    active_from = ACCEPTANCE_FIXTURE_DATE.isoformat()

    for title, local_start, window_minutes, items in ACCEPTANCE_TEMPLATES:
        if frappe.db.exists("SOP Template", {"title": title}):
            continue

        checklist = [
            {
                "description":       desc,
                "sequence":          seq,
                "weight":            weight,
                "item_type":         itype,
                "evidence_required": evidence,
            }
            for desc, seq, weight, itype, evidence in items
        ]
        frappe.get_doc({
            "doctype":                   "SOP Template",
            "title":                     title,
            "department":                ACCEPTANCE_DEPARTMENT[0],
            "frequency_type":            "Daily",
            "schedule_timezone":         ACCEPTANCE_TIMEZONE,
            "local_start_time":          local_start,
            "completion_window_minutes": window_minutes,
            "owner_role":                "Operator",
            "active_from":               active_from,
            "active_to":                 None,
            "is_active":                 1,
            "checklist_items":           checklist,
        }).insert(ignore_permissions=True)

    frappe.db.commit()


def _acceptance_create_assignments() -> dict[str, frappe.Document]:
    assignments: dict[str, frappe.Document] = {}

    for assignment_name, template_title, employee_email, local_start, window_minutes in ACCEPTANCE_ASSIGNMENTS:
        template_name = frappe.db.get_value("SOP Template", {"title": template_title}, "name")
        employee_name = frappe.db.get_value(
            "Pulse Employee", {"user": employee_email}, "name"
        )
        if not template_name or not employee_name:
            continue

        if frappe.db.exists("SOP Assignment", assignment_name):
            assignments[assignment_name] = frappe.get_doc("SOP Assignment", assignment_name)
            continue

        assignment = frappe.get_doc({
            "doctype":                            "SOP Assignment",
            "name":                               assignment_name,
            "template":                           template_name,
            "employee":                           employee_name,
            "schedule_timezone_override":         None,
            "local_start_time_override":          local_start,
            "completion_window_minutes_override": window_minutes,
            "is_active":                          1,
        })
        assignment.insert(ignore_permissions=True)
        assignments[assignment_name] = assignment

    frappe.db.commit()
    return assignments


def _acceptance_compute_windows() -> list[dict]:
    """Resolve schedule windows for ACCEPTANCE_RUN_CASES using the real scheduler."""
    from pulse.domain.scheduling import make_run_key, resolve_schedule

    tz = ZoneInfo(ACCEPTANCE_TIMEZONE)
    windows: list[dict] = []

    for (
        assignment_name,
        template_title,
        local_start_str,
        window_minutes,
        window_date,
        result,
    ) in ACCEPTANCE_RUN_CASES:
        local_start_time = time.fromisoformat(local_start_str)

        template_dict = {
            "frequency_type":            "Daily",
            "schedule_timezone":         ACCEPTANCE_TIMEZONE,
            "local_start_time":          local_start_time,
            "completion_window_minutes": window_minutes,
        }
        assignment_dict = {
            "schedule_timezone_override":         None,
            "local_start_time_override":          local_start_time,
            "completion_window_minutes_override": window_minutes,
        }

        # Evaluate exactly at the window's opens_at so the window is actionable.
        opens_at_local = datetime.combine(window_date, local_start_time).replace(tzinfo=tz)
        opens_at_utc = opens_at_local.astimezone(ZoneInfo("UTC"))

        schedule = resolve_schedule(template_dict, assignment_dict, opens_at_utc, ACCEPTANCE_TIMEZONE)
        if not schedule:
            raise RuntimeError(
                f"Could not resolve acceptance schedule for {assignment_name} on {window_date}"
            )

        run_key = make_run_key(assignment_name, schedule["schedule_key"])
        windows.append({
            "assignment_name": assignment_name,
            "template_title":  template_title,
            "window_date":     window_date,
            "result":          result,
            "schedule":        schedule,
            "run_key":         run_key,
        })

    return windows


def _acceptance_create_runs(
    assignments: dict[str, frappe.Document],
    name_to_emp: dict[str, str],
) -> None:
    """Create the three fixed SOP Run rows (Passed, Failed, Pending)."""
    from pulse.tasks import _build_manager_path

    owen_emp = name_to_emp.get("Owen Patel")
    if not owen_emp:
        return

    employee = frappe.db.get_value(
        "Pulse Employee",
        owen_emp,
        ["employee_name", "branch", "department", "reports_to"],
        as_dict=True,
    )
    if not employee:
        return

    department_name = None
    if employee.department:
        department_name = (
            frappe.db.get_value("Pulse Department", employee.department, "department_name")
            or employee.department
        )

    template_by_title = {
        title: frappe.db.get_value("SOP Template", {"title": title}, "name")
        for title, *_ in ACCEPTANCE_TEMPLATES
    }

    status_map = {"Passed": "Completed", "Failed": "Locked", "Pending": "Open"}

    for window in _acceptance_compute_windows():
        if frappe.db.exists("SOP Run", {"run_key": window["run_key"]}):
            continue

        assignment = assignments.get(window["assignment_name"])
        if not assignment:
            continue

        template_name = template_by_title.get(window["template_title"])
        if not template_name:
            continue
        template = frappe.get_doc("SOP Template", template_name)

        schedule = window["schedule"]
        result = window["result"]

        run_items = []
        completed_at = None
        if result == "Passed":
            completed_at = schedule["opens_at"] + timedelta(minutes=5)

        for item in template.checklist_items or []:
            if result == "Passed":
                item_status = "Completed"
                item_completed_at = completed_at
            elif result == "Failed":
                item_status = "Missed"
                item_completed_at = None
            else:
                item_status = "Pending"
                item_completed_at = None

            run_items.append({
                "checklist_item":    item.description,
                "weight":            item.weight,
                "item_type":         item.item_type,
                "status":            item_status,
                "evidence_required": item.evidence_required or "None",
                "completed_at":      item_completed_at,
            })

        total_items = len(run_items)
        completed_items = sum(1 for ri in run_items if ri["status"] == "Completed")
        progress = (completed_items / total_items * 100) if total_items else 0

        frappe.get_doc({
            "doctype":                            "SOP Run",
            "template":                           template_name,
            "employee":                           owen_emp,
            "period_date":                        schedule["window_date"],
            "status":                             status_map[result],
            "compliance_result":                  result,
            "completed_at":                       completed_at,
            "assignment":                         assignment.name,
            "schedule_key":                       schedule["schedule_key"],
            "run_key":                            window["run_key"],
            "opens_at":                           schedule["opens_at"],
            "due_at":                             schedule["due_at"],
            "effective_timezone":                 schedule["effective_timezone"],
            "template_title_snapshot":            template.title,
            "template_modified_snapshot":         template.modified,
            "employee_name_snapshot":             employee.employee_name,
            "manager_path_snapshot":              _build_manager_path(owen_emp),
            "department_snapshot":                department_name,
            "branch_snapshot":                    employee.branch,
            "frequency_snapshot":                 template.frequency_type,
            "completion_window_minutes_snapshot": schedule["completion_window_minutes"],
            "snapshot_is_complete":               1,
            "run_items":                          run_items,
            "total_items":                        total_items,
            "completed_items":                    completed_items,
            "progress":                           progress,
        }).insert(ignore_permissions=True)

    frappe.db.commit()
