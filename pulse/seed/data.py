# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""QSR chain seed data definitions."""

from datetime import date

# Users: (email, full_name, pulse_role)
USERS = [
    ("chairman@pm.local", "Ramesh Agarwal", "Executive"),
    ("md@pm.local", "Priya Sharma", "Executive"),
    ("rm.north@pm.local", "Vikram Patel", "Area Manager"),
    ("rm.south@pm.local", "Anita Das", "Area Manager"),
    ("bm.n1@pm.local", "Rahul Nair", "Supervisor"),
    ("bm.n2@pm.local", "Meera Iyer", "Supervisor"),
    ("bm.s1@pm.local", "Suresh Kumar", "Supervisor"),
    ("sup.n1@pm.local", "Kavitha Raj", "Supervisor"),
    ("sup.n2@pm.local", "Deepak Singh", "Supervisor"),
    ("sup.s1@pm.local", "Lakshmi Menon", "Supervisor"),
    ("chef.n1@pm.local", "Arun Bhat", "Operator"),
    ("chef.n2@pm.local", "Pooja Reddy", "Operator"),
    ("cashier.n1@pm.local", "Ravi Verma", "Operator"),
    ("cashier.n2@pm.local", "Neha Gupta", "Operator"),
    ("cleaner.n1@pm.local", "Mohan Das", "Operator"),
    ("cleaner.s1@pm.local", "Sunita Devi", "Operator"),
    ("purchase@pm.local", "Rajesh Mehta", "Operator"),
    ("finance@pm.local", "Anjali Kapoor", "Operator"),
    ("driver@pm.local", "Vijay Singh", "Operator"),
]

# Hierarchy: (employee_name, reports_to_employee_name)
# Order: top-down so parents exist first
HIERARCHY = [
    ("Ramesh Agarwal", None),  # Chairman
    ("Priya Sharma", "Ramesh Agarwal"),  # MD
    ("Vikram Patel", "Priya Sharma"),  # RM North
    ("Anita Das", "Priya Sharma"),  # RM South
    ("Rahul Nair", "Vikram Patel"),  # BM N1
    ("Meera Iyer", "Vikram Patel"),  # BM N2
    ("Suresh Kumar", "Anita Das"),  # BM S1
    ("Kavitha Raj", "Rahul Nair"),  # Sup N1
    ("Deepak Singh", "Meera Iyer"),  # Sup N2
    ("Lakshmi Menon", "Suresh Kumar"),  # Sup S1
    ("Arun Bhat", "Kavitha Raj"),  # Chef N1
    ("Pooja Reddy", "Kavitha Raj"),  # Chef N2
    ("Ravi Verma", "Kavitha Raj"),  # Cashier N1
    ("Neha Gupta", "Deepak Singh"),  # Cashier N2
    ("Mohan Das", "Kavitha Raj"),  # Cleaner N1
    ("Sunita Devi", "Lakshmi Menon"),  # Cleaner S1
    ("Rajesh Mehta", "Priya Sharma"),  # Purchase
    ("Anjali Kapoor", "Priya Sharma"),  # Finance
    ("Vijay Singh", "Lakshmi Menon"),  # Driver
]

# Departments: (department_name, description)
DEPARTMENTS = [
    ("Kitchen", "Food preparation and cooking"),
    ("Front-of-House", "Customer service, cashiering"),
    ("Procurement", "Purchasing and inventory"),
    ("Finance", "Accounts and financial management"),
    ("Operations", "Cleaning, facilities, logistics"),
]

# Departments per employee (by name)
EMPLOYEE_DEPARTMENT = {
    "Ramesh Agarwal": "Operations",
    "Priya Sharma": "Operations",
    "Vikram Patel": "Operations",
    "Anita Das": "Operations",
    "Rahul Nair": "Operations",
    "Meera Iyer": "Operations",
    "Suresh Kumar": "Operations",
    "Kavitha Raj": "Operations",
    "Deepak Singh": "Operations",
    "Lakshmi Menon": "Operations",
    "Arun Bhat": "Kitchen",
    "Pooja Reddy": "Kitchen",
    "Ravi Verma": "Front-of-House",
    "Neha Gupta": "Front-of-House",
    "Mohan Das": "Operations",
    "Sunita Devi": "Operations",
    "Rajesh Mehta": "Procurement",
    "Anjali Kapoor": "Finance",
    "Vijay Singh": "Operations",
}

# Branch per employee
EMPLOYEE_BRANCH = {
    "Ramesh Agarwal": "HQ",
    "Priya Sharma": "HQ",
    "Vikram Patel": "North Region",
    "Anita Das": "South Region",
    "Rahul Nair": "Branch N1",
    "Meera Iyer": "Branch N2",
    "Suresh Kumar": "Branch S1",
    "Kavitha Raj": "Branch N1",
    "Deepak Singh": "Branch N2",
    "Lakshmi Menon": "Branch S1",
    "Arun Bhat": "Branch N1",
    "Pooja Reddy": "Branch N2",
    "Ravi Verma": "Branch N1",
    "Neha Gupta": "Branch N2",
    "Mohan Das": "Branch N1",
    "Sunita Devi": "Branch S1",
    "Rajesh Mehta": "HQ",
    "Anjali Kapoor": "HQ",
    "Vijay Singh": "Branch S1",
}

# SOP Templates: (title, department, frequency_type, owner_role, checklist_items)
# checklist_items: [(description, sequence, weight, item_type, evidence_required)]
SOP_TEMPLATES = [
    (
        "Kitchen Open Checklist",
        "Kitchen",
        "Daily",
        "Operator",
        [
            ("Preheat grills and fryers", 10, 1.0, "Checkbox", "None"),
            ("Check stock levels - cold storage", 20, 1.5, "Checkbox", "Photo"),
            ("Verify prep station hygiene", 30, 1.0, "Checkbox", "Photo"),
            ("Record opening temperature", 40, 1.0, "Numeric", "None"),
        ],
    ),
    (
        "Kitchen Close Checklist",
        "Kitchen",
        "Daily",
        "Operator",
        [
            ("Shut down all equipment", 10, 1.5, "Checkbox", "None"),
            ("Clean and sanitize grills", 20, 1.0, "Checkbox", "Photo"),
            ("Dispose waste", 30, 1.0, "Checkbox", "None"),
            ("Lock walk-in cooler", 40, 1.0, "Checkbox", "None"),
        ],
    ),
    (
        "Cashier Daily Checklist",
        "Front-of-House",
        "Daily",
        "Operator",
        [
            ("Count cash drawer", 10, 2.0, "Checkbox", "None"),
            ("Verify POS system", 20, 1.0, "Checkbox", "None"),
            ("Stock napkins and condiments", 30, 1.0, "Checkbox", "None"),
            ("Clean counter and display", 40, 1.0, "Checkbox", "Photo"),
        ],
    ),
    (
        "Store Clean Checklist",
        "Operations",
        "Daily",
        "Operator",
        [
            ("Sweep and mop lobby", 10, 1.0, "Checkbox", "None"),
            ("Clean restrooms", 20, 1.5, "Checkbox", "Photo"),
            ("Empty trash bins", 30, 1.0, "Checkbox", "None"),
            ("Wipe tables and chairs", 40, 1.0, "Checkbox", "None"),
        ],
    ),
    (
        "Supervisor Daily Review",
        "Operations",
        "Daily",
        "Supervisor",
        [
            ("Review team task completion", 10, 2.0, "Checkbox", "None"),
            ("Spot-check one completed SOP", 20, 1.5, "Checkbox", "Photo"),
            ("Log incidents or escalations", 30, 1.0, "Checkbox", "None"),
        ],
    ),
    (
        "Weekly Deep Clean",
        "Operations",
        "Weekly",
        "Operator",
        [
            ("Deep clean kitchen exhaust", 10, 2.0, "Checkbox", "Photo"),
            ("Sanitize all storage areas", 20, 1.5, "Checkbox", "Photo"),
            ("Inspect and clean drains", 30, 1.0, "Checkbox", "None"),
        ],
    ),
]

# Assignments: (user_email, template_title)
ASSIGNMENTS = [
    ("chef.n1@pm.local", "Kitchen Open Checklist"),
    ("chef.n1@pm.local", "Kitchen Close Checklist"),
    ("chef.n2@pm.local", "Kitchen Open Checklist"),
    ("chef.n2@pm.local", "Kitchen Close Checklist"),
    ("cashier.n1@pm.local", "Cashier Daily Checklist"),
    ("cashier.n2@pm.local", "Cashier Daily Checklist"),
    ("cleaner.n1@pm.local", "Store Clean Checklist"),
    ("cleaner.s1@pm.local", "Store Clean Checklist"),
    ("cleaner.n1@pm.local", "Weekly Deep Clean"),
    ("sup.n1@pm.local", "Supervisor Daily Review"),
    ("sup.n2@pm.local", "Supervisor Daily Review"),
    ("sup.s1@pm.local", "Supervisor Daily Review"),
]

# Completion rate per user (0.0 to 1.0) for run item randomization
COMPLETION_RATE = {
    "chairman@pm.local": 1.0,
    "md@pm.local": 1.0,
    "rm.north@pm.local": 0.95,
    "rm.south@pm.local": 0.95,
    "bm.n1@pm.local": 0.92,
    "bm.n2@pm.local": 0.88,
    "bm.s1@pm.local": 0.90,
    "sup.n1@pm.local": 0.92,
    "sup.n2@pm.local": 0.85,
    "sup.s1@pm.local": 0.90,
    "chef.n1@pm.local": 0.92,
    "chef.n2@pm.local": 0.78,
    "cashier.n1@pm.local": 0.88,
    "cashier.n2@pm.local": 0.82,
    "cleaner.n1@pm.local": 0.85,
    "cleaner.s1@pm.local": 0.80,
    "purchase@pm.local": 0.90,
    "finance@pm.local": 0.95,
    "driver@pm.local": 0.75,
}

# Date range for historical runs
START_DATE = date(2026, 2, 10)
END_DATE = date(2026, 3, 12)
