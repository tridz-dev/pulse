---
name: sop-execution
description: >
  Core SOP (Standard Operating Procedure) execution engine. Handles template definitions, 
  run generation, checklist item completion, evidence capture, and status lifecycle. 
  This is the heart of Pulse — consult when working on checklists, runs, scheduling, 
  or operator task flows.
category: features
---

# SOP Execution Engine

## Overview

The SOP Execution Engine is Pulse's core capability — it transforms static SOP templates into trackable, scorable execution instances (SOP Runs) that capture whether frontline staff actually performed each step.

Key concepts:
- **Template:** Master checklist definition (what needs to be done)
- **Assignment:** Links template to specific employee
- **Run:** One execution instance (template × employee × period)
- **Run Item:** Individual checklist step with status and evidence

## Key Files

| File | Purpose |
|------|---------|
| `pulse/pulse_core/doctype/sop_template/` | Template definition, checklist items |
| `pulse/pulse_core/doctype/sop_assignment/` | Template-to-employee assignments |
| `pulse/pulse_core/doctype/sop_run/` | Run instance, status, counters |
| `pulse/pulse_core/doctype/sop_run_item/` | Individual step outcomes |
| `pulse/pulse_core/doctype/sop_follow_up_rule/` | Automated rules for failed items |
| `pulse/api/tasks.py` | API for run CRUD, item updates, evidence upload |
| `pulse/tasks.py` | Scheduler jobs for run generation |
| `frontend/src/components/tasks/ChecklistRunner.tsx` | UI for completing checklists |
| `frontend/src/components/tasks/RunCard.tsx` | Run summary card |

## How It Works

### 1. Template Definition

An SOP Template defines:
- **What:** Checklist items with descriptions, instructions
- **When:** Frequency (Daily/Weekly/Monthly/Custom) + schedule details
- **Who:** Owner role (which Pulse Role can execute)
- **How:** Item types (Checkbox/Numeric/Photo), outcome modes, proof requirements

```python
# Template with advanced scheduling
{
  "title": "Kitchen Open Checklist",
  "frequency_type": "Custom",
  "schedule_kind": "TimeOfDay",        # or CalendarDay, Interval
  "schedule_time": "06:00:00",
  "schedule_days_of_week": "0,1,2,3,4,5,6",
  "grace_minutes": 30,
  "checklist_items": [
    {
      "description": "Check refrigerator temps",
      "item_key": "fridge_temps",
      "outcome_mode": "PassFail",
      "proof_requirement": "Required",
      "proof_media_type": "Image",
    }
  ]
}
```

### 2. Run Generation

The scheduler creates runs based on assignments:

```
Scheduler (every 15 min for TimeOfDay/Interval, daily for CalendarDay)
    ↓
For each active Assignment:
    Check if run already exists for (template, employee, period)
    ↓
Create SOP Run:
    - Copy template structure
    - Denormalize items to SOP Run Item
    - Set status = Open
    - period_date / period_datetime set based on schedule
```

### 3. Run Lifecycle

```
Open
  ↓ (employee completes items)
Completed items marked → score calculated
  ↓ (employee marks run complete)
Closed — locked for editing

OR

Open
  ↓ (time passes beyond grace period)
Overdue → Locked automatically
Pending items → Missed
```

### 4. Item Completion Flow

```
Operator opens ChecklistRunner
    ↓
For each item:
    - View instructions
    - Capture proof (if required)
    - Mark outcome (Complete/Pass/Fail)
    - Add notes if needed
    ↓
All items done → Complete Run button enabled
```

API calls:
1. `get_run_details(run_name)` — Load run with items
2. `update_run_item(run_item_name, status, outcome, notes, ...)` — Update item
3. `upload_run_item_evidence(run_item_name, file)` — Upload proof
4. `complete_run(run_name)` — Mark run closed

### 5. Follow-up Rules

When an item fails, automated rules can trigger:

```
SOP Run Item marked Failed
    ↓
Check SOP Follow-up Rules:
    source_template = run.template
    source_item_key = item.item_key
    trigger_on = "ItemOutcomeFail"
    ↓
Create new SOP Run:
    target_template → new run created
    target_assignee = SameEmployee or EmployeesManager
    ↓
Log execution to SOP Rule Execution Log (idempotent)
```

### 6. Scoring Within a Run

```
progress = (completed_items + missed_items) / total_items
score = passed_items / (total_items - not_applicable_items)
```

- **Progress:** How much is "done" (including misses)
- **Score:** Quality metric (passed / applicable)

## Extension Points

### Adding a New Item Type

1. Add to `SOP Checklist Item` DocType options
2. Update `ChecklistRunner.tsx` to render the new type
3. Handle validation in `pulse/api/tasks.py:update_run_item()`
4. Update scoring logic if needed

### Custom Scheduling

Modify `pulse/tasks.py`:
- `generate_time_of_day_runs()` — Current time-based generation
- `generate_interval_runs()` — Periodic generation
- Add new schedule_kind and implement handler

### Evidence/Proof Enhancements

Current proof system supports image/file upload. To extend:
1. Modify `SOP Run Item` proof fields
2. Update upload handler in `tasks.py:upload_run_item_evidence()`
3. Enhance UI in `ChecklistRunner.tsx`
4. Consider storage (local disk vs S3)

## Dependencies

- **SOP Template** — Master definition
- **SOP Assignment** — Who gets which runs
- **Pulse Employee** — Run ownership
- **Frappe File APIs** — Evidence storage

## Gotchas

1. **Denormalization:** Run items are copied from templates. Template changes don't affect existing runs — only future ones.

2. **Grace Period:** `lock_overdue_runs` uses `grace_minutes` from template. Default is 30 minutes after `period_datetime`.

3. **Idempotency:** Run generation checks for existing runs by unique key. Duplicate scheduler runs won't create duplicates.

4. **File Upload Size:** Frappe defaults to 5MB file limit. Large evidence files may need nginx/frappe.conf adjustment.

5. **Proof Requirements:** The UI enforces proof before marking complete, but API also validates. Don't rely on UI alone.

6. **Prerequisites:** Items can have prerequisites (e.g., "Check freezer" only if "Refrigerator OK" failed). The UI handles visibility; backend validates.

7. **Run Locking:** Once Locked or Closed, runs can't be modified. This is enforced at the DocType level with `validate()`.
