# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Real-time API endpoints for Pulse analytics streaming.

Provides WebSocket/SSE-style endpoints via Frappe's publish_realtime system
and polling fallbacks for live dashboard data.
"""

from datetime import datetime, timedelta
from typing import Literal

import frappe
from frappe.utils import getdate, now, add_to_date

from pulse.api.permissions import _get_employee_for_user


METRIC_TYPES = ["runs", "scores", "compliance", "anomalies", "activity"]


@frappe.whitelist()
def subscribe_metrics(channel: str) -> dict:
    """Subscribe to a real-time metrics channel.
    
    In Frappe's realtime system, clients subscribe on the frontend via socket.io.
    This endpoint validates access and returns subscription info.
    
    Args:
        channel: Channel name (metrics, runs, scores, anomalies, activity)
        
    Returns:
        Dictionary with subscription status and channel info
    """
    emp = _get_employee_for_user()
    if not emp and frappe.session.user != "Administrator":
        frappe.throw("Authentication required")
    
    # Validate channel access based on user role
    allowed_channels = _get_allowed_channels()
    
    if channel not in allowed_channels:
        frappe.throw(f"Access denied for channel: {channel}")
    
    return {
        "success": True,
        "channel": f"pulse:{channel}",
        "subscribed_at": now(),
        "user": frappe.session.user,
    }


@frappe.whitelist(allow_guest=False)
def get_live_dashboard_data() -> dict:
    """Get current live statistics for the dashboard.
    
    Returns real-time counts and metrics that update frequently.
    This is designed to be called on initial load and then
    supplemented with realtime events.
    
    Returns:
        Dictionary with live statistics:
        - active_runs: Number of currently open SOP runs
        - completed_today: Runs completed today
        - avg_score_today: Average combined score for today
        - active_users: Users with activity in last hour
        - pending_items: Total pending checklist items
        - recent_events: Last 10 activity events
        - last_updated: Timestamp of data
    """
    emp = _get_employee_for_user()
    if not emp and frappe.session.user != "Administrator":
        return {"error": "Authentication required"}
    
    today = getdate()
    today_str = today.strftime("%Y-%m-%d")
    
    # Get scope based on role
    scope_employees = _get_scope_employees()
    
    if not scope_employees:
        return {
            "active_runs": 0,
            "completed_today": 0,
            "avg_score_today": 0,
            "active_users": 0,
            "pending_items": 0,
            "recent_events": [],
            "last_updated": now(),
        }
    
    placeholders = ", ".join(["%s"] * len(scope_employees))
    
    # Active runs (Open status)
    active_runs = frappe.db.sql(
        f"""
        SELECT COUNT(*) as count
        FROM `tabSOP Run`
        WHERE employee IN ({placeholders})
          AND status = 'Open'
          AND period_date <= %s
        """,
        scope_employees + [today_str],
        as_dict=True,
    )[0]["count"] or 0
    
    # Completed today
    completed_today = frappe.db.sql(
        f"""
        SELECT COUNT(*) as count
        FROM `tabSOP Run`
        WHERE employee IN ({placeholders})
          AND status = 'Closed'
          AND DATE(closed_at) = %s
        """,
        scope_employees + [today_str],
        as_dict=True,
    )[0]["count"] or 0
    
    # Average score today
    avg_score_result = frappe.db.sql(
        f"""
        SELECT AVG(combined_score) as avg_score
        FROM `tabScore Snapshot`
        WHERE employee IN ({placeholders})
          AND period_type = 'Day'
          AND period_key = %s
        """,
        scope_employees + [today_str],
        as_dict=True,
    )
    avg_score_today = avg_score_result[0]["avg_score"] or 0
    
    # Active users (activity in last hour)
    one_hour_ago = add_to_date(now(), hours=-1)
    active_users = frappe.db.sql(
        """
        SELECT COUNT(DISTINCT owner) as count
        FROM `tabSOP Run Item`
        WHERE modified >= %s
        """,
        one_hour_ago,
        as_dict=True,
    )[0]["count"] or 0
    
    # Pending items
    pending_items = frappe.db.sql(
        f"""
        SELECT COUNT(*) as count
        FROM `tabSOP Run Item` ri
        JOIN `tabSOP Run` r ON ri.parent = r.name
        WHERE r.employee IN ({placeholders})
          AND r.status = 'Open'
          AND ri.status = 'Pending'
        """,
        scope_employees,
        as_dict=True,
    )[0]["count"] or 0
    
    # Recent events (from SOP Run activity)
    recent_events = frappe.db.sql(
        f"""
        SELECT 
            r.name as run_name,
            r.template,
            t.title as template_title,
            r.employee,
            e.employee_name,
            r.status,
            r.score,
            r.closed_at,
            r.modified as event_time,
            'run_completed' as event_type
        FROM `tabSOP Run` r
        JOIN `tabSOP Template` t ON r.template = t.name
        JOIN `tabPulse Employee` e ON r.employee = e.name
        WHERE r.employee IN ({placeholders})
          AND (r.status = 'Closed' OR r.modified >= %s)
        ORDER BY r.modified DESC
        LIMIT 10
        """,
        scope_employees + [add_to_date(now(), hours=-24)],
        as_dict=True,
    )
    
    # Format events
    formatted_events = []
    for event in recent_events:
        formatted_events.append({
            "id": event["run_name"],
            "type": event["event_type"],
            "title": f"{event['template_title']} - {event['status']}",
            "actor": event["employee_name"],
            "actor_id": event["employee"],
            "timestamp": event["event_time"].isoformat() if event["event_time"] else now(),
            "metadata": {
                "template": event["template"],
                "score": float(event["score"] or 0),
                "status": event["status"],
            }
        })
    
    return {
        "active_runs": int(active_runs),
        "completed_today": int(completed_today),
        "avg_score_today": round(float(avg_score_today), 4),
        "active_users": int(active_users),
        "pending_items": int(pending_items),
        "recent_events": formatted_events,
        "last_updated": now(),
    }


@frappe.whitelist(allow_guest=False)
def get_streaming_metrics(
    metric_types: list | None = None,
    duration: int = 60,
    resolution: Literal["1m", "5m", "15m", "1h"] = "5m"
) -> dict:
    """Get time-series streaming metrics for charts and visualizations.
    
    This endpoint returns historical data points for the specified duration,
    suitable for populating initial chart data before realtime updates.
    
    Args:
        metric_types: List of metric types to include (runs, scores, compliance)
        duration: Duration in minutes to fetch data for (default: 60)
        resolution: Data point resolution (1m, 5m, 15m, 1h)
        
    Returns:
        Dictionary with time-series data for each metric type
    """
    emp = _get_employee_for_user()
    if not emp and frappe.session.user != "Administrator":
        return {"error": "Authentication required"}
    
    metric_types = metric_types or ["runs", "scores"]
    scope_employees = _get_scope_employees()
    
    if not scope_employees:
        return {"metrics": {}, "time_range": {"start": None, "end": None}}
    
    end_time = datetime.now()
    start_time = end_time - timedelta(minutes=duration)
    
    result = {
        "metrics": {},
        "time_range": {
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
        }
    }
    
    placeholders = ", ".join(["%s"] * len(scope_employees))
    
    # Run completion rate over time
    if "runs" in metric_types:
        runs_data = frappe.db.sql(
            f"""
            SELECT 
                DATE_FORMAT(closed_at, '%Y-%m-%d %H:%i:00') as time_bucket,
                COUNT(*) as completed_count,
                AVG(score) as avg_score
            FROM `tabSOP Run`
            WHERE employee IN ({placeholders})
              AND status = 'Closed'
              AND closed_at BETWEEN %s AND %s
            GROUP BY time_bucket
            ORDER BY time_bucket
            """,
            scope_employees + [start_time, end_time],
            as_dict=True,
        )
        
        result["metrics"]["runs"] = [
            {
                "timestamp": row["time_bucket"],
                "completed": int(row["completed_count"]),
                "avg_score": round(float(row["avg_score"] or 0), 4),
            }
            for row in runs_data
        ]
    
    # Score trends
    if "scores" in metric_types:
        # Get latest score snapshots within the time range
        scores_data = frappe.db.sql(
            f"""
            SELECT 
                DATE_FORMAT(computed_at, '%Y-%m-%d %H:%i:00') as time_bucket,
                AVG(combined_score) as avg_combined,
                AVG(own_score) as avg_own,
                COUNT(DISTINCT employee) as employee_count
            FROM `tabScore Snapshot`
            WHERE employee IN ({placeholders})
              AND computed_at BETWEEN %s AND %s
              AND period_type = 'Day'
            GROUP BY time_bucket
            ORDER BY time_bucket
            """,
            scope_employees + [start_time, end_time],
            as_dict=True,
        )
        
        result["metrics"]["scores"] = [
            {
                "timestamp": row["time_bucket"],
                "combined": round(float(row["avg_combined"] or 0), 4),
                "own": round(float(row["avg_own"] or 0), 4),
                "employees": int(row["employee_count"]),
            }
            for row in scores_data
        ]
    
    # Compliance metrics (pass/fail rates)
    if "compliance" in metric_types:
        compliance_data = frappe.db.sql(
            f"""
            SELECT 
                DATE_FORMAT(ri.completed_at, '%Y-%m-%d %H:%i:00') as time_bucket,
                SUM(CASE WHEN ri.outcome = 'Pass' THEN 1 ELSE 0 END) as passed,
                SUM(CASE WHEN ri.outcome = 'Fail' THEN 1 ELSE 0 END) as failed,
                COUNT(*) as total
            FROM `tabSOP Run Item` ri
            JOIN `tabSOP Run` r ON ri.parent = r.name
            WHERE r.employee IN ({placeholders})
              AND ri.status = 'Completed'
              AND ri.completed_at BETWEEN %s AND %s
              AND ri.outcome_mode = 'PassFail'
            GROUP BY time_bucket
            ORDER BY time_bucket
            """,
            scope_employees + [start_time, end_time],
            as_dict=True,
        )
        
        result["metrics"]["compliance"] = [
            {
                "timestamp": row["time_bucket"],
                "passed": int(row["passed"]),
                "failed": int(row["failed"]),
                "total": int(row["total"]),
                "pass_rate": round(row["passed"] / row["total"], 4) if row["total"] else 0,
            }
            for row in compliance_data
        ]
    
    return result


@frappe.whitelist(allow_guest=False)
def get_recent_activity(limit: int = 20, event_types: list | None = None) -> list:
    """Get recent activity events for the activity stream.
    
    Args:
        limit: Maximum number of events to return
        event_types: Optional filter by event types
        
    Returns:
        List of activity events
    """
    emp = _get_employee_for_user()
    if not emp and frappe.session.user != "Administrator":
        return []
    
    scope_employees = _get_scope_employees()
    if not scope_employees:
        return []
    
    placeholders = ", ".join(["%s"] * len(scope_employees))
    limit = min(int(limit), 100)
    
    # Combine run completions and item completions
    activities = []
    
    # Recent run status changes
    runs = frappe.db.sql(
        f"""
        SELECT 
            r.name,
            r.template,
            t.title as template_title,
            r.employee,
            e.employee_name,
            r.status,
            r.score,
            r.progress,
            r.closed_at,
            r.modified,
            r.creation
        FROM `tabSOP Run` r
        JOIN `tabSOP Template` t ON r.template = t.name
        JOIN `tabPulse Employee` e ON r.employee = e.name
        WHERE r.employee IN ({placeholders})
        ORDER BY r.modified DESC
        LIMIT %s
        """,
        scope_employees + [limit],
        as_dict=True,
    )
    
    for run in runs:
        event_type = "run_completed" if run["status"] == "Closed" else "run_updated"
        activities.append({
            "id": f"run-{run['name']}",
            "type": event_type,
            "title": f"{run['template_title']}",
            "description": f"Status: {run['status']}",
            "actor": run["employee_name"],
            "actor_id": run["employee"],
            "timestamp": (run["closed_at"] or run["modified"]).isoformat() if (run["closed_at"] or run["modified"]) else now(),
            "icon": "check-circle" if run["status"] == "Closed" else "clock",
            "metadata": {
                "run_id": run["name"],
                "score": float(run["score"] or 0),
                "progress": float(run["progress"] or 0),
                "template": run["template"],
            }
        })
    
    # Sort by timestamp descending
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return activities[:limit]


@frappe.whitelist(allow_guest=False)
def get_active_run_updates(run_names: list | None = None) -> dict:
    """Get updates for specific active runs (for real-time progress tracking).
    
    Args:
        run_names: List of run names to get updates for (if None, gets all active)
        
    Returns:
        Dictionary with run updates
    """
    emp = _get_employee_for_user()
    if not emp and frappe.session.user != "Administrator":
        return {"error": "Authentication required"}
    
    scope_employees = _get_scope_employees()
    if not scope_employees:
        return {"runs": []}
    
    if run_names:
        # Validate these runs are in scope
        placeholders = ", ".join(["%s"] * len(run_names))
        emp_placeholders = ", ".join(["%s"] * len(scope_employees))
        
        runs = frappe.db.sql(
            f"""
            SELECT 
                name,
                template,
                employee,
                status,
                total_items,
                completed_items,
                passed_items,
                failed_items,
                progress,
                score,
                modified
            FROM `tabSOP Run`
            WHERE name IN ({placeholders})
              AND employee IN ({emp_placeholders})
            """,
            run_names + scope_employees,
            as_dict=True,
        )
    else:
        # Get all active runs in scope
        emp_placeholders = ", ".join(["%s"] * len(scope_employees))
        
        runs = frappe.db.sql(
            f"""
            SELECT 
                name,
                template,
                employee,
                status,
                total_items,
                completed_items,
                passed_items,
                failed_items,
                progress,
                score,
                modified
            FROM `tabSOP Run`
            WHERE employee IN ({emp_placeholders})
              AND status = 'Open'
            ORDER BY modified DESC
            LIMIT 50
            """,
            scope_employees,
            as_dict=True,
        )
    
    return {
        "runs": [
            {
                "name": r["name"],
                "template": r["template"],
                "employee": r["employee"],
                "status": r["status"],
                "total_items": int(r["total_items"] or 0),
                "completed_items": int(r["completed_items"] or 0),
                "passed_items": int(r["passed_items"] or 0),
                "failed_items": int(r["failed_items"] or 0),
                "progress": float(r["progress"] or 0),
                "score": float(r["score"] or 0),
                "last_updated": r["modified"].isoformat() if r["modified"] else now(),
            }
            for r in runs
        ],
        "timestamp": now(),
    }


def _get_allowed_channels() -> list:
    """Get list of channels the current user is allowed to subscribe to."""
    roles = frappe.get_roles()
    
    # All authenticated users can access basic channels
    channels = ["metrics", "activity"]
    
    # Managers and above can access runs and scores
    if any(r in roles for r in ["Pulse Manager", "Pulse Leader", "Pulse Executive", "Pulse Admin"]):
        channels.extend(["runs", "scores"])
    
    # Executives and admins can access anomalies
    if any(r in roles for r in ["Pulse Executive", "Pulse Admin"]):
        channels.append("anomalies")
    
    return channels


def _get_scope_employees() -> list:
    """Get list of employees the current user has access to."""
    roles = frappe.get_roles()
    
    if frappe.session.user == "Administrator" or "Pulse Executive" in roles or "Pulse Admin" in roles:
        return frappe.get_all("Pulse Employee", filters={"is_active": 1}, pluck="name")
    
    emp = _get_employee_for_user()
    if not emp:
        return []
    
    if "Pulse Leader" in roles:
        # Get subtree
        from pulse.api.permissions import _get_subtree_employee_names
        subtree = _get_subtree_employee_names(emp)
        return subtree or [emp]
    
    if "Pulse Manager" in roles:
        # Get direct reports plus self
        reports = frappe.get_all(
            "Pulse Employee",
            filters={"reports_to": emp, "is_active": 1},
            pluck="name"
        )
        return [emp] + reports
    
    # Regular user - only self
    return [emp]
