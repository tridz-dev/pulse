---
name: scheduler
description: >
  Background job scheduling using Frappe's scheduler. Handles run generation 
  (daily, weekly, monthly, time-of-day, interval), overdue run locking, and 
  score snapshot caching. Consult when adding scheduled tasks or debugging 
  run generation issues.
category: patterns
---

# Scheduler & Background Jobs

## Overview

Pulse uses Frappe's built-in scheduler to run background jobs that:
- Generate SOP runs based on templates and assignments
- Lock overdue runs and mark items as missed
- Cache score snapshots for fast insights

Jobs run at various frequencies: every 15 minutes, hourly, daily, weekly, monthly.

## Key Files

| File | Purpose |
|------|---------|
| `pulse/hooks.py` | Scheduler event registration |
| `pulse/tasks.py` | All scheduled job implementations |
| `pulse/pulse_core/doctype/sop_template/sop_template.py` | Template-triggered hooks |
| `pulse/pulse_core/doctype/sop_run/sop_run.py` | Run status change hooks |

## How It Works

### 1. Scheduler Registration

```python
# hooks.py
scheduler_events = {
    "all": ["pulse.tasks.every_quarter_hour"],
    "hourly": ["pulse.tasks.hourly"],
    "daily": ["pulse.tasks.daily"],
    "weekly": ["pulse.tasks.weekly"],
    "monthly": ["pulse.tasks.monthly"],
}
```

### 2. Run Generation Jobs

#### Daily Runs (CalendarDay)

```python
def daily():
    generate_daily_runs()    # Create today's runs
    lock_overdue_runs()      # Lock runs past grace period
```

For each active assignment with `frequency_type = "Daily"`:
```python
if not exists(run for today):
    create_sop_run(
        template=assignment.template,
        employee=assignment.employee,
        period_date=today,
        status="Open"
    )
```

#### Time-of-Day Runs

```python
def every_quarter_hour():
    # Runs every 15 minutes
    generate_time_of_day_runs()
```

Logic:
```
Current time: 08:15:00
Window: (08:15:00, 08:30:00]

For each template with schedule_kind="TimeOfDay":
    if schedule_time in window AND today in schedule_days_of_week:
        for each assignment:
            if not exists(run for period_datetime):
                create run with period_datetime = today + schedule_time
```

#### Interval Runs

```python
def every_quarter_hour():
    generate_interval_runs()
```

Creates runs every N minutes based on `interval_minutes`.

#### Weekly/Monthly Runs

```python
def weekly():   # Runs on Mondays
    generate_weekly_runs()

def monthly():  # Runs on 1st of month
    generate_monthly_runs()
```

### 3. Overdue Run Locking

```python
def lock_overdue_runs():
    # Find open runs past grace period
    overdue = frappe.get_all("SOP Run", filters={
        "status": "Open",
        "period_datetime": ("<", now() - timedelta(minutes=grace_minutes))
    })
    
    for run in overdue:
        # Mark all pending items as Missed
        for item in run.run_items:
            if item.status == "Pending":
                item.status = "Missed"
                item.save()
        
        # Lock the run
        run.status = "Locked"
        run.save()
```

### 4. Score Snapshot Caching

```python
def hourly():
    cache_score_snapshots()

def cache_score_snapshots():
    for employee in get_all_active_employees():
        for period_type in ["Day", "Week", "Month"]:
            snapshot = calculate_score_snapshot(employee, today(), period_type)
            upsert_score_snapshot(snapshot)
```

## Extension Points

### Adding a New Scheduled Job

1. **Create function** in `tasks.py`:
```python
def my_scheduled_job():
    """Docstring describing what this does."""
    # Implementation
    pass
```

2. **Register** in `hooks.py`:
```python
scheduler_events = {
    "daily": [..., "pulse.tasks.my_scheduled_job"],
    # or "hourly", "weekly", "monthly", "all" (every 3 min)
}
```

3. **Test manually**:
```bash
bench --site pulse.localhost execute pulse.tasks.my_scheduled_job
```

### Custom Schedule (Cron)

For specific cron timing:
```python
scheduler_events = {
    "cron": {
        "0 9 * * 1": [  # 9 AM every Monday
            "pulse.tasks.weekly_report_email"
        ]
    }
}
```

### Idempotency Patterns

All generation jobs must be idempotent:
```python
def generate_daily_runs():
    for assignment in get_active_assignments():
        # Check if already exists
        if not run_exists(assignment, today()):
            create_run(assignment, today())
```

### Job Monitoring

Track job execution:
```python
def monitored_job():
    try:
        result = do_work()
        log_job_success("monitored_job", result)
    except Exception as e:
        log_job_failure("monitored_job", e)
        raise  # Re-raise for Frappe's error handling
```

## Dependencies

- **Frappe Scheduler** — Job queue and execution
- **SOP Template** — Schedule definitions
- **SOP Assignment** — Who gets runs
- **SOP Run** — Run creation and status

## Gotchas

1. **Job Overlap:** Long-running jobs may overlap with next scheduled run. Use `frappe.db.get_global()` locks if needed.

2. **Timezones:** Scheduler runs in server timezone. `period_date` uses local date via `today()`.

3. **Failed Jobs:** Failed scheduler jobs are logged. Check Error Log DocType for failures.

4. **Site Context:** Jobs need `--site` flag. Without it, they may run on wrong site or fail silently.

5. **Grace Period Edge Cases:** Runs without `period_datetime` use `period_date` + end-of-day for locking.

6. **Batch Size:** Large orgs (1000+ employees) may hit timeout. Process in batches:
```python
def cache_score_snapshots():
    employees = get_all_active_employees()
    for batch in chunked(employees, 100):
        for emp in batch:
            process(emp)
        frappe.db.commit()  # Commit each batch
```
