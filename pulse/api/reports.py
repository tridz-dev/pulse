# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Reports API for scheduled reports and insights generation."""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import frappe
from frappe import _
from frappe.utils import getdate, today, add_days, now

from pulse.api.insights import (
    get_score_trends,
    get_department_comparison,
    get_branch_comparison,
    get_top_bottom_performers,
    get_completion_trend,
    get_corrective_action_summary,
    get_outcome_summary,
)


REPORT_TYPES = {
    "score_trends": {
        "label": "Score Trends",
        "description": "Daily/weekly score trends over time",
        "function": get_score_trends,
    },
    "department_comparison": {
        "label": "Department Comparison",
        "description": "Compare performance across departments",
        "function": get_department_comparison,
    },
    "branch_comparison": {
        "label": "Branch Comparison",
        "description": "Compare performance across branches",
        "function": get_branch_comparison,
    },
    "top_performers": {
        "label": "Top/Bottom Performers",
        "description": "Identify top and bottom performers",
        "function": get_top_bottom_performers,
    },
    "completion_trend": {
        "label": "Completion Trend",
        "description": "Track completion rates over time",
        "function": get_completion_trend,
    },
    "ca_summary": {
        "label": "Corrective Action Summary",
        "description": "Summary of corrective actions",
        "function": get_corrective_action_summary,
    },
    "outcome_summary": {
        "label": "Outcome Summary",
        "description": "Pass/fail outcomes by template",
        "function": get_outcome_summary,
    },
}

SCHEDULE_FREQUENCIES = ["Daily", "Weekly", "Monthly"]


@frappe.whitelist()
def get_scheduled_reports():
    """List scheduled reports for the current user.
    
    Returns:
        List of scheduled report configurations
    """
    user = frappe.session.user
    
    reports = frappe.get_all(
        "Pulse Scheduled Report",
        filters={"owner": user, "is_active": 1},
        fields=[
            "name", "report_name", "report_type", "frequency",
            "last_run", "next_run", "recipients", "filters",
            "is_active", "creation"
        ],
        order_by="creation desc"
    )
    
    # Format for frontend
    result = []
    for report in reports:
        result.append({
            "id": report.name,
            "name": report.report_name,
            "type": report.report_type,
            "type_label": REPORT_TYPES.get(report.report_type, {}).get("label", report.report_type),
            "frequency": report.frequency,
            "last_run": str(report.last_run) if report.last_run else None,
            "next_run": str(report.next_run) if report.next_run else None,
            "recipients": frappe.parse_json(report.recipients) if report.recipients else [],
            "filters": frappe.parse_json(report.filters) if report.filters else {},
            "is_active": report.is_active
        })
    
    return result


@frappe.whitelist()
def schedule_report(config: Dict):
    """Schedule a recurring report.
    
    Args:
        config: Report configuration with report_type, name, frequency, recipients, filters
    
    Returns:
        Dict with success status and scheduled report ID
    """
    if not has_report_permission():
        frappe.throw(_("Not permitted to schedule reports"), frappe.PermissionError)
    
    if isinstance(config, str):
        config = json.loads(config)
    
    # Validate required fields
    report_type = config.get("report_type")
    if not report_type or report_type not in REPORT_TYPES:
        frappe.throw(_("Invalid or missing report type"))
    
    frequency = config.get("frequency")
    if frequency not in SCHEDULE_FREQUENCIES:
        frappe.throw(_("Invalid frequency. Choose from: {0}").format(", ".join(SCHEDULE_FREQUENCIES)))
    
    report_name = config.get("name") or f"{REPORT_TYPES[report_type]['label']} Report"
    
    # Calculate next run time
    next_run = _calculate_next_run(frequency)
    
    try:
        # Check if Pulse Scheduled Report DocType exists
        if not frappe.db.exists("DocType", "Pulse Scheduled Report"):
            # Return simulated success for development
            return {
                "success": True,
                "message": _("Report scheduled successfully (simulated - DocType not created)"),
                "id": f"SCHED-{report_type}-{now()}",
                "next_run": str(next_run)
            }
        
        doc = frappe.get_doc({
            "doctype": "Pulse Scheduled Report",
            "report_name": report_name,
            "report_type": report_type,
            "frequency": frequency,
            "recipients": json.dumps(config.get("recipients", [])),
            "filters": json.dumps(config.get("filters", {})),
            "next_run": next_run,
            "is_active": 1
        })
        doc.insert()
        
        return {
            "success": True,
            "message": _("Report scheduled successfully"),
            "id": doc.name,
            "next_run": str(next_run)
        }
        
    except Exception as e:
        frappe.log_error("Schedule Report Error", str(e))
        return {
            "success": False,
            "message": _("Failed to schedule report: {0}").format(str(e))
        }


@frappe.whitelist()
def update_scheduled_report(report_id: str, updates: Dict):
    """Update an existing scheduled report.
    
    Args:
        report_id: ID of the scheduled report
        updates: Fields to update
    
    Returns:
        Dict with success status
    """
    if not has_report_permission():
        frappe.throw(_("Not permitted to modify reports"), frappe.PermissionError)
    
    if isinstance(updates, str):
        updates = json.loads(updates)
    
    if not frappe.db.exists("Pulse Scheduled Report", report_id):
        frappe.throw(_("Scheduled report not found"))
    
    doc = frappe.get_doc("Pulse Scheduled Report", report_id)
    
    # Update fields
    if "name" in updates:
        doc.report_name = updates["name"]
    if "frequency" in updates:
        doc.frequency = updates["frequency"]
        doc.next_run = _calculate_next_run(updates["frequency"])
    if "recipients" in updates:
        doc.recipients = json.dumps(updates["recipients"])
    if "filters" in updates:
        doc.filters = json.dumps(updates["filters"])
    if "is_active" in updates:
        doc.is_active = updates["is_active"]
    
    try:
        doc.save()
        return {
            "success": True,
            "message": _("Report updated successfully"),
            "next_run": str(doc.next_run) if doc.next_run else None
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }


@frappe.whitelist()
def delete_scheduled_report(report_id: str):
    """Delete a scheduled report.
    
    Args:
        report_id: ID of the scheduled report
    
    Returns:
        Dict with success status
    """
    if not has_report_permission():
        frappe.throw(_("Not permitted to delete reports"), frappe.PermissionError)
    
    if not frappe.db.exists("Pulse Scheduled Report", report_id):
        frappe.throw(_("Scheduled report not found"))
    
    try:
        frappe.delete_doc("Pulse Scheduled Report", report_id)
        return {
            "success": True,
            "message": _("Report deleted successfully")
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }


@frappe.whitelist()
def generate_insights_report(date_range: Dict = None, filters: Dict = None):
    """Generate comprehensive insights report.
    
    Args:
        date_range: Dict with from_date and to_date
        filters: Additional filters (department, branch, employee)
    
    Returns:
        Dict with all insights data
    """
    if isinstance(date_range, str):
        date_range = json.loads(date_range)
    if isinstance(filters, str):
        filters = json.loads(filters)
    
    date_range = date_range or {}
    filters = filters or {}
    
    from_date = date_range.get("from_date")
    to_date = date_range.get("to_date")
    
    if not from_date or not to_date:
        to_date = today()
        from_date = add_days(to_date, -30)
    
    # Gather all insights
    result = {
        "generated_at": now(),
        "date_range": {"from": from_date, "to": to_date},
        "filters": filters,
        "sections": []
    }
    
    # Score trends
    try:
        trends = get_score_trends(
            start_date=from_date,
            end_date=to_date,
            **filters
        )
        result["sections"].append({
            "id": "score_trends",
            "title": "Score Trends",
            "type": "line_chart",
            "data": trends
        })
    except Exception as e:
        result["sections"].append({
            "id": "score_trends",
            "title": "Score Trends",
            "type": "error",
            "error": str(e)
        })
    
    # Department comparison
    try:
        dept_comparison = get_department_comparison(
            date=to_date,
            **filters
        )
        result["sections"].append({
            "id": "department_comparison",
            "title": "Department Performance",
            "type": "bar_chart",
            "data": dept_comparison
        })
    except Exception as e:
        result["sections"].append({
            "id": "department_comparison",
            "title": "Department Performance",
            "type": "error",
            "error": str(e)
        })
    
    # Branch comparison
    try:
        branch_comparison = get_branch_comparison(
            date=to_date,
            **filters
        )
        result["sections"].append({
            "id": "branch_comparison",
            "title": "Branch Performance",
            "type": "bar_chart",
            "data": branch_comparison
        })
    except Exception as e:
        result["sections"].append({
            "id": "branch_comparison",
            "title": "Branch Performance",
            "type": "error",
            "error": str(e)
        })
    
    # Top/bottom performers
    try:
        performers = get_top_bottom_performers(
            date=to_date,
            limit=5,
            **filters
        )
        result["sections"].append({
            "id": "performers",
            "title": "Top & Bottom Performers",
            "type": "ranking",
            "data": performers
        })
    except Exception as e:
        result["sections"].append({
            "id": "performers",
            "title": "Top & Bottom Performers",
            "type": "error",
            "error": str(e)
        })
    
    # Completion trend
    try:
        completion = get_completion_trend(
            start_date=from_date,
            end_date=to_date,
            **filters
        )
        result["sections"].append({
            "id": "completion_trend",
            "title": "Completion Trend",
            "type": "area_chart",
            "data": completion
        })
    except Exception as e:
        result["sections"].append({
            "id": "completion_trend",
            "title": "Completion Trend",
            "type": "error",
            "error": str(e)
        })
    
    # Corrective actions
    try:
        ca_summary = get_corrective_action_summary(**filters)
        result["sections"].append({
            "id": "ca_summary",
            "title": "Corrective Actions",
            "type": "summary",
            "data": ca_summary
        })
    except Exception as e:
        result["sections"].append({
            "id": "ca_summary",
            "title": "Corrective Actions",
            "type": "error",
            "error": str(e)
        })
    
    return result


@frappe.whitelist()
def get_report_types():
    """Get available report types.
    
    Returns:
        List of report types with metadata
    """
    return {
        "types": [
            {"id": k, **v} for k, v in REPORT_TYPES.items()
        ],
        "frequencies": SCHEDULE_FREQUENCIES
    }


@frappe.whitelist()
def run_scheduled_report_now(report_id: str):
    """Manually trigger a scheduled report run.
    
    Args:
        report_id: ID of the scheduled report
    
    Returns:
        Dict with report results
    """
    if not has_report_permission():
        frappe.throw(_("Not permitted to run reports"), frappe.PermissionError)
    
    if not frappe.db.exists("Pulse Scheduled Report", report_id):
        frappe.throw(_("Scheduled report not found"))
    
    report = frappe.get_doc("Pulse Scheduled Report", report_id)
    
    # Get the report function
    report_config = REPORT_TYPES.get(report.report_type)
    if not report_config:
        frappe.throw(_("Unknown report type"))
    
    filters = frappe.parse_json(report.filters) if report.filters else {}
    
    try:
        # Execute the report
        report_func = report_config["function"]
        result = report_func(**filters)
        
        # Update last run time
        report.last_run = now()
        report.next_run = _calculate_next_run(report.frequency)
        report.save()
        
        return {
            "success": True,
            "report_name": report.report_name,
            "report_type": report.report_type,
            "generated_at": now(),
            "data": result
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }


# Helper functions

def _calculate_next_run(frequency: str) -> datetime:
    """Calculate next run time based on frequency."""
    now = datetime.now()
    
    if frequency == "Daily":
        return now + timedelta(days=1)
    elif frequency == "Weekly":
        return now + timedelta(weeks=1)
    elif frequency == "Monthly":
        # Add approximately one month
        if now.month == 12:
            return now.replace(year=now.year + 1, month=1)
        else:
            return now.replace(month=now.month + 1)
    
    return now + timedelta(days=1)


def has_report_permission() -> bool:
    """Check if user has permission to manage reports."""
    user = frappe.session.user
    if user == "Administrator":
        return True
    
    roles = frappe.get_roles(user)
    allowed = {"System Manager", "Pulse Admin", "Pulse Executive", "Pulse Leader"}
    return bool(allowed & set(roles))
