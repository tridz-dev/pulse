# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""
Pulse demo data definitions for a QSR (quick-service restaurant) chain.

Dates are computed relative to today so every fresh install gets recent
historical runs rather than data anchored to a fixed past date.
"""

from datetime import date, timedelta

# ── Date range ────────────────────────────────────────────────────────────────
# Historical window: 40 days up to (but not including) today.
# "today" runs will be seeded as Open; prior days as Closed / Locked.
_today = date.today()
START_DATE: date = _today - timedelta(days=40)
END_DATE: date = _today - timedelta(days=1)

# ── Users ─────────────────────────────────────────────────────────────────────
# (email, full_name, pulse_role)
# All demo accounts use password: Demo@123
USERS = [
    ("chairman@pm.local",  "Ramesh Agarwal", "Executive"),
    ("md@pm.local",        "Priya Sharma",   "Executive"),
    ("rm.north@pm.local",  "Vikram Patel",   "Area Manager"),
    ("rm.south@pm.local",  "Anita Das",      "Area Manager"),
    ("bm.n1@pm.local",     "Rahul Nair",     "Supervisor"),
    ("bm.n2@pm.local",     "Meera Iyer",     "Supervisor"),
    ("bm.s1@pm.local",     "Suresh Kumar",   "Supervisor"),
    ("sup.n1@pm.local",    "Kavitha Raj",    "Supervisor"),
    ("sup.n2@pm.local",    "Deepak Singh",   "Supervisor"),
    ("sup.s1@pm.local",    "Lakshmi Menon",  "Supervisor"),
    ("chef.n1@pm.local",   "Arun Bhat",      "Operator"),
    ("chef.n2@pm.local",   "Pooja Reddy",    "Operator"),
    ("cashier.n1@pm.local","Ravi Verma",     "Operator"),
    ("cashier.n2@pm.local","Neha Gupta",     "Operator"),
    ("cleaner.n1@pm.local","Mohan Das",      "Operator"),
    ("cleaner.s1@pm.local","Sunita Devi",    "Operator"),
    ("purchase@pm.local",  "Rajesh Mehta",   "Operator"),
    ("finance@pm.local",   "Anjali Kapoor",  "Operator"),
    ("driver@pm.local",    "Vijay Singh",    "Operator"),
]

# ── Org hierarchy ─────────────────────────────────────────────────────────────
# (employee_name, reports_to_employee_name)  — ordered top-down so parents exist first
HIERARCHY = [
    ("Ramesh Agarwal", None),              # Chairman
    ("Priya Sharma",   "Ramesh Agarwal"),  # MD
    ("Vikram Patel",   "Priya Sharma"),    # RM North
    ("Anita Das",      "Priya Sharma"),    # RM South
    ("Rahul Nair",     "Vikram Patel"),    # BM N1
    ("Meera Iyer",     "Vikram Patel"),    # BM N2
    ("Suresh Kumar",   "Anita Das"),       # BM S1
    ("Kavitha Raj",    "Rahul Nair"),      # Sup N1
    ("Deepak Singh",   "Meera Iyer"),      # Sup N2
    ("Lakshmi Menon",  "Suresh Kumar"),    # Sup S1
    ("Arun Bhat",      "Kavitha Raj"),     # Chef N1
    ("Pooja Reddy",    "Kavitha Raj"),     # Chef N2  (reports to Sup N1 intentionally)
    ("Ravi Verma",     "Kavitha Raj"),     # Cashier N1
    ("Neha Gupta",     "Deepak Singh"),    # Cashier N2
    ("Mohan Das",      "Kavitha Raj"),     # Cleaner N1
    ("Sunita Devi",    "Lakshmi Menon"),   # Cleaner S1
    ("Rajesh Mehta",   "Priya Sharma"),    # Purchase (HQ)
    ("Anjali Kapoor",  "Priya Sharma"),    # Finance (HQ)
    ("Vijay Singh",    "Lakshmi Menon"),   # Driver S1
]

# ── Departments ───────────────────────────────────────────────────────────────
# (department_name, description)
DEPARTMENTS = [
    ("Kitchen",       "Food preparation and cooking"),
    ("Front-of-House","Customer service, cashiering"),
    ("Procurement",   "Purchasing and inventory"),
    ("Finance",       "Accounts and financial management"),
    ("Operations",    "Cleaning, facilities, logistics"),
    ("Management",    "Leadership and strategy"),
    ("Security",      "Site security and access control"),
]

# ── Employee → department ─────────────────────────────────────────────────────
EMPLOYEE_DEPARTMENT = {
    "Ramesh Agarwal": "Management",
    "Priya Sharma":   "Management",
    "Vikram Patel":   "Operations",
    "Anita Das":      "Operations",
    "Rahul Nair":     "Operations",
    "Meera Iyer":     "Operations",
    "Suresh Kumar":   "Operations",
    "Kavitha Raj":    "Operations",
    "Deepak Singh":   "Operations",
    "Lakshmi Menon":  "Operations",
    "Arun Bhat":      "Kitchen",
    "Pooja Reddy":    "Kitchen",
    "Ravi Verma":     "Front-of-House",
    "Neha Gupta":     "Front-of-House",
    "Mohan Das":      "Operations",
    "Sunita Devi":    "Operations",
    "Rajesh Mehta":   "Procurement",
    "Anjali Kapoor":  "Finance",
    "Vijay Singh":    "Operations",
}

# ── Employee → branch ─────────────────────────────────────────────────────────
EMPLOYEE_BRANCH = {
    "Ramesh Agarwal": "HQ",
    "Priya Sharma":   "HQ",
    "Vikram Patel":   "North Region",
    "Anita Das":      "South Region",
    "Rahul Nair":     "Branch N1",
    "Meera Iyer":     "Branch N2",
    "Suresh Kumar":   "Branch S1",
    "Kavitha Raj":    "Branch N1",
    "Deepak Singh":   "Branch N2",
    "Lakshmi Menon":  "Branch S1",
    "Arun Bhat":      "Branch N1",
    "Pooja Reddy":    "Branch N2",
    "Ravi Verma":     "Branch N1",
    "Neha Gupta":     "Branch N2",
    "Mohan Das":      "Branch N1",
    "Sunita Devi":    "Branch S1",
    "Rajesh Mehta":   "HQ",
    "Anjali Kapoor":  "HQ",
    "Vijay Singh":    "Branch S1",
}

# ── SOP Templates ─────────────────────────────────────────────────────────────
# (title, department, frequency_type, owner_role, checklist_items)
# checklist_items: [(description, sequence, weight, item_type, evidence_required)]
SOP_TEMPLATES = [
    (
        "Kitchen Open Checklist",
        "Kitchen", "Daily", "Operator",
        [
            ("Preheat grills and fryers",          10, 1.0, "Checkbox", "None"),
            ("Check stock levels - cold storage",   20, 1.5, "Checkbox", "Photo"),
            ("Verify prep station hygiene",         30, 1.0, "Checkbox", "Photo"),
            ("Record opening temperature",          40, 1.0, "Numeric",  "None"),
        ],
    ),
    (
        "Kitchen Close Checklist",
        "Kitchen", "Daily", "Operator",
        [
            ("Shut down all equipment",  10, 1.5, "Checkbox", "None"),
            ("Clean and sanitize grills",20, 1.0, "Checkbox", "Photo"),
            ("Dispose waste",            30, 1.0, "Checkbox", "None"),
            ("Lock walk-in cooler",      40, 1.0, "Checkbox", "None"),
        ],
    ),
    (
        "Cashier Daily Checklist",
        "Front-of-House", "Daily", "Operator",
        [
            ("Count cash drawer",          10, 2.0, "Checkbox", "None"),
            ("Verify POS system",          20, 1.0, "Checkbox", "None"),
            ("Stock napkins and condiments",30, 1.0, "Checkbox", "None"),
            ("Clean counter and display",  40, 1.0, "Checkbox", "Photo"),
        ],
    ),
    (
        "Store Clean Checklist",
        "Operations", "Daily", "Operator",
        [
            ("Sweep and mop lobby",     10, 1.0, "Checkbox", "None"),
            ("Clean restrooms",         20, 1.5, "Checkbox", "Photo"),
            ("Empty trash bins",        30, 1.0, "Checkbox", "None"),
            ("Wipe tables and chairs",  40, 1.0, "Checkbox", "None"),
        ],
    ),
    (
        "Supervisor Daily Review",
        "Operations", "Daily", "Supervisor",
        [
            ("Review team task completion",    10, 2.0, "Checkbox", "None"),
            ("Spot-check one completed SOP",   20, 1.5, "Checkbox", "Photo"),
            ("Log incidents or escalations",   30, 1.0, "Checkbox", "None"),
        ],
    ),
    (
        "Weekly Deep Clean",
        "Operations", "Weekly", "Operator",
        [
            ("Deep clean kitchen exhaust",  10, 2.0, "Checkbox", "Photo"),
            ("Sanitize all storage areas",  20, 1.5, "Checkbox", "Photo"),
            ("Inspect and clean drains",    30, 1.0, "Checkbox", "None"),
        ],
    ),
]

# ── Assignments ───────────────────────────────────────────────────────────────
# (user_email, template_title)
ASSIGNMENTS = [
    ("chef.n1@pm.local",    "Kitchen Open Checklist"),
    ("chef.n1@pm.local",    "Kitchen Close Checklist"),
    ("chef.n2@pm.local",    "Kitchen Open Checklist"),
    ("chef.n2@pm.local",    "Kitchen Close Checklist"),
    ("cashier.n1@pm.local", "Cashier Daily Checklist"),
    ("cashier.n2@pm.local", "Cashier Daily Checklist"),
    ("cleaner.n1@pm.local", "Store Clean Checklist"),
    ("cleaner.s1@pm.local", "Store Clean Checklist"),
    ("cleaner.n1@pm.local", "Weekly Deep Clean"),
    ("sup.n1@pm.local",     "Supervisor Daily Review"),
    ("sup.n2@pm.local",     "Supervisor Daily Review"),
    ("sup.s1@pm.local",     "Supervisor Daily Review"),
    ("chef.n1@pm.local",    "Freezer Temperature Check"),
    ("cleaner.n1@pm.local", "Washroom Check"),
]


# ── Extra SOP templates (scheduling + evidence) ───────────────────────────────
# Dict specs consumed by seed._create_templates_extras()
SOP_TEMPLATE_EXTRAS = [
    {
        "title": "Freezer Temperature Check",
        "department": "Kitchen",
        "frequency_type": "Daily",
        "owner_role": "Operator",
        "schedule_kind": "TimeOfDay",
        "schedule_time": "10:00:00",
        "schedule_days_of_week": "0,1,2,3,4",
        "interval_minutes": 0,
        "open_run_policy": "RequirePreviousClosed",
        "grace_minutes": 30,
        "checklist_items": [
            {
                "description": "Temperature at or below -18°C verified",
                "sequence": 10,
                "weight": 1.0,
                "item_type": "Checkbox",
                "evidence_required": "None",
                "outcome_mode": "PassFail",
                "proof_requirement": "Required",
                "proof_media_type": "Image",
                "proof_capture_mode": "CameraOnly",
                "instructions": "Use calibrated thermometer; capture the display reading.",
            },
        ],
    },
    {
        "title": "Washroom Check",
        "department": "Operations",
        "frequency_type": "Daily",
        "owner_role": "Operator",
        "schedule_kind": "Interval",
        "schedule_time": None,
        "schedule_days_of_week": "",
        "interval_minutes": 60,
        "open_run_policy": "RequirePreviousClosed",
        "grace_minutes": 45,
        "checklist_items": [
            {
                "description": "Supplies stocked",
                "sequence": 10,
                "weight": 1.0,
                "item_type": "Checkbox",
                "evidence_required": "None",
                "outcome_mode": "SimpleCompletion",
                "proof_requirement": "None",
                "proof_media_type": "Image",
                "proof_capture_mode": "Any",
            },
            {
                "description": "Floors dry and clean",
                "sequence": 20,
                "weight": 1.0,
                "item_type": "Checkbox",
                "evidence_required": "None",
                "outcome_mode": "SimpleCompletion",
                "proof_requirement": "None",
                "proof_media_type": "Image",
                "proof_capture_mode": "Any",
            },
        ],
    },
    {
        "title": "Maintenance Report",
        "department": "Operations",
        "frequency_type": "Daily",
        "owner_role": "Supervisor",
        "schedule_kind": "CalendarDay",
        "schedule_time": None,
        "schedule_days_of_week": "",
        "interval_minutes": 0,
        "open_run_policy": "AllowMultiple",
        "grace_minutes": 30,
        "checklist_items": [
            {
                "description": "Equipment issue documented",
                "sequence": 10,
                "weight": 1.0,
                "item_type": "Checkbox",
                "evidence_required": "Photo",
                "outcome_mode": "SimpleCompletion",
                "proof_requirement": "Optional",
                "proof_media_type": "Image",
                "proof_capture_mode": "Any",
            },
            {
                "description": "Follow-up actions assigned",
                "sequence": 20,
                "weight": 1.0,
                "item_type": "Checkbox",
                "evidence_required": "None",
                "outcome_mode": "SimpleCompletion",
                "proof_requirement": "None",
                "proof_media_type": "Image",
                "proof_capture_mode": "Any",
            },
        ],
    },
]

# ── Completion rates ──────────────────────────────────────────────────────────
# Per-user probability (0–1) of completing each checklist item.
# Intentional variance creates realistic score distributions.
COMPLETION_RATE = {
    "chairman@pm.local":   1.00,
    "md@pm.local":         1.00,
    "rm.north@pm.local":   0.95,
    "rm.south@pm.local":   0.95,
    "bm.n1@pm.local":      0.92,
    "bm.n2@pm.local":      0.88,
    "bm.s1@pm.local":      0.90,
    "sup.n1@pm.local":     0.92,
    "sup.n2@pm.local":     0.85,
    "sup.s1@pm.local":     0.90,
    "chef.n1@pm.local":    0.92,
    "chef.n2@pm.local":    0.78,
    "cashier.n1@pm.local": 0.88,
    "cashier.n2@pm.local": 0.82,
    "cleaner.n1@pm.local": 0.85,
    "cleaner.s1@pm.local": 0.80,
    "purchase@pm.local":   0.90,
    "finance@pm.local":    0.95,
    "driver@pm.local":     0.75,
}
