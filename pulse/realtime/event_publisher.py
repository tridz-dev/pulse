# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Event publishing system for Pulse real-time updates.

Uses Frappe's publish_realtime to broadcast events to connected clients.
Events are published on specific channels that clients can subscribe to.
"""

import json
from datetime import datetime
from typing import Any

import frappe
from frappe.utils import now, getdate


# Channel names for different event types
CHANNEL_METRICS = "pulse:metrics"
CHANNEL_RUNS = "pulse:runs"
CHANNEL_SCORES = "pulse:scores"
CHANNEL_ANOMALIES = "pulse:anomalies"
CHANNEL_ACTIVITY = "pulse:activity"


def _serialize_datetime(obj: Any) -> str:
    """Helper to serialize datetime objects for JSON."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, datetime.date):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _publish_event(channel: str, event_type: str, data: dict, user: str | None = None) -> None:
    """Publish an event to Frappe's realtime system.
    
    Args:
        channel: The channel to publish on (e.g., 'pulse:metrics')
        event_type: Type of event for client routing (e.g., 'run_completed')
        data: Event payload
        user: Optional specific user to target (None = broadcast to all)
    """
    try:
        event_payload = {
            "type": event_type,
            "timestamp": now(),
            "data": data,
        }
        
        frappe.publish_realtime(
            event=channel,
            message=event_payload,
            user=user,
            doctype=None,
            docname=None,
        )
    except Exception as e:
        frappe.logger().error(f"Failed to publish realtime event: {e}")


def publish_run_completion(run_data: dict) -> None:
    """Publish event when an SOP run is completed.
    
    Args:
        run_data: Dictionary containing run details:
            - run_name: SOP Run ID
            - template_title: Template name
            - employee: Employee ID
            - employee_name: Employee display name
            - score: Final score (0-1)
            - progress: Completion percentage
            - status: Run status (Closed/Locked)
            - completed_items: Number of items completed
            - total_items: Total items in run
            - duration_minutes: Time taken to complete
    """
    if not run_data:
        return
    
    # Broadcast to metrics channel for dashboard updates
    _publish_event(
        channel=CHANNEL_METRICS,
        event_type="run_completed",
        data={
            "run_name": run_data.get("run_name"),
            "template_title": run_data.get("template_title"),
            "employee": run_data.get("employee"),
            "employee_name": run_data.get("employee_name"),
            "score": run_data.get("score"),
            "progress": run_data.get("progress"),
            "status": run_data.get("status"),
            "completed_items": run_data.get("completed_items"),
            "total_items": run_data.get("total_items"),
            "duration_minutes": run_data.get("duration_minutes"),
            "branch": run_data.get("branch"),
            "department": run_data.get("department"),
        }
    )
    
    # Also publish to runs-specific channel
    _publish_event(
        channel=CHANNEL_RUNS,
        event_type="run_completed",
        data=run_data,
        user=run_data.get("employee_user")  # Target specific user
    )
    
    # Add to activity stream
    publish_activity_event(
        event_type="run_completed",
        title=f"Run completed: {run_data.get('template_title', 'Unknown')}",
        description=f"{run_data.get('employee_name', 'Unknown')} completed with {round((run_data.get('score') or 0) * 100)}% score",
        actor=run_data.get("employee"),
        actor_name=run_data.get("employee_name"),
        reference_doctype="SOP Run",
        reference_name=run_data.get("run_name"),
        metadata={
            "score": run_data.get("score"),
            "template_title": run_data.get("template_title"),
        }
    )


def publish_score_update(employee_id: str, new_score: float, old_score: float | None = None, 
                        score_type: str = "combined", context: dict | None = None) -> None:
    """Publish event when an employee's score changes.
    
    Args:
        employee_id: Pulse Employee ID
        new_score: New score value (0-1)
        old_score: Previous score value (0-1), optional
        score_type: Type of score (own, team, combined)
        context: Additional context (period, date, etc.)
    """
    if not employee_id:
        return
    
    context = context or {}
    employee = frappe.db.get_value(
        "Pulse Employee", 
        employee_id, 
        ["employee_name", "user", "reports_to"], 
        as_dict=True
    )
    
    if not employee:
        return
    
    score_data = {
        "employee": employee_id,
        "employee_name": employee.employee_name,
        "new_score": new_score,
        "old_score": old_score,
        "score_type": score_type,
        "period": context.get("period", "Day"),
        "period_key": context.get("period_key", str(getdate())),
        "change": round(new_score - (old_score or 0), 4) if old_score is not None else None,
    }
    
    # Broadcast to metrics channel
    _publish_event(
        channel=CHANNEL_METRICS,
        event_type="score_updated",
        data=score_data
    )
    
    # Publish to employee's personal scores channel
    _publish_event(
        channel=CHANNEL_SCORES,
        event_type="score_updated",
        data=score_data,
        user=employee.user
    )
    
    # Notify manager of significant score drops (> 10%)
    if old_score is not None and (old_score - new_score) > 0.1 and employee.reports_to:
        manager = frappe.db.get_value("Pulse Employee", employee.reports_to, "user")
        if manager:
            _publish_event(
                channel=CHANNEL_SCORES,
                event_type="significant_score_drop",
                data={
                    **score_data,
                    "manager": employee.reports_to,
                    "drop_percent": round((old_score - new_score) * 100, 1),
                },
                user=manager
            )


def publish_anomaly_detected(anomaly_data: dict) -> None:
    """Publish event when AI detects an anomaly.
    
    Args:
        anomaly_data: Dictionary containing:
            - anomaly_type: Type of anomaly (score_drop, completion_spike, etc.)
            - severity: low, medium, high, critical
            - description: Human-readable description
            - affected_employees: List of employee IDs affected
            - affected_branches: List of branches affected
            - metric_value: The anomalous value
            - expected_range: [min, max] expected values
            - confidence: AI confidence score (0-1)
            - recommendations: List of suggested actions
    """
    if not anomaly_data:
        return
    
    # Always publish to anomalies channel
    _publish_event(
        channel=CHANNEL_ANOMALIES,
        event_type="anomaly_detected",
        data={
            "anomaly_type": anomaly_data.get("anomaly_type"),
            "severity": anomaly_data.get("severity", "medium"),
            "description": anomaly_data.get("description"),
            "affected_employees": anomaly_data.get("affected_employees", []),
            "affected_branches": anomaly_data.get("affected_branches", []),
            "metric_value": anomaly_data.get("metric_value"),
            "expected_range": anomaly_data.get("expected_range"),
            "confidence": anomaly_data.get("confidence"),
            "recommendations": anomaly_data.get("recommendations", []),
            "detected_at": now(),
        }
    )
    
    # Also add to activity stream for high/critical severity
    if anomaly_data.get("severity") in ("high", "critical"):
        publish_activity_event(
            event_type="anomaly_detected",
            title=f"Anomaly Detected: {anomaly_data.get('anomaly_type', 'Unknown')}",
            description=anomaly_data.get("description", ""),
            actor="system",
            actor_name="AI System",
            reference_doctype="Pulse Notification",
            metadata={
                "severity": anomaly_data.get("severity"),
                "confidence": anomaly_data.get("confidence"),
            }
        )


def publish_activity_event(event_type: str, title: str, description: str = "",
                           actor: str | None = None, actor_name: str | None = None,
                           reference_doctype: str | None = None, 
                           reference_name: str | None = None,
                           metadata: dict | None = None) -> None:
    """Publish a generic activity event to the activity stream.
    
    Args:
        event_type: Type of activity (run_completed, item_failed, etc.)
        title: Short title for the activity
        description: Longer description
        actor: Employee ID who performed the action
        actor_name: Display name of the actor
        reference_doctype: Related DocType
        reference_name: Related document name
        metadata: Additional structured data
    """
    _publish_event(
        channel=CHANNEL_ACTIVITY,
        event_type="activity",
        data={
            "activity_type": event_type,
            "title": title,
            "description": description,
            "actor": actor,
            "actor_name": actor_name or actor or "System",
            "reference_doctype": reference_doctype,
            "reference_name": reference_name,
            "metadata": metadata or {},
            "created_at": now(),
        }
    )


def publish_item_outcome(run_item: dict, outcome: str, run_context: dict | None = None) -> None:
    """Publish event when a run item outcome is recorded (especially failures).
    
    Args:
        run_item: SOP Run Item data
        outcome: Pass, Fail, or NotApplicable
        run_context: Parent run context
    """
    run_context = run_context or {}
    
    if outcome == "Fail":
        publish_activity_event(
            event_type="item_failed",
            title=f"Checklist item failed: {run_item.get('checklist_item', 'Unknown')}",
            description=run_item.get("failure_remark") or "No failure remark provided",
            actor=run_context.get("employee"),
            actor_name=run_context.get("employee_name"),
            reference_doctype="SOP Run Item",
            reference_name=run_item.get("name"),
            metadata={
                "template": run_context.get("template_title"),
                "item_key": run_item.get("item_key"),
                "weight": run_item.get("weight"),
            }
        )


def publish_corrective_action_created(ca_data: dict) -> None:
    """Publish event when a corrective action is created.
    
    Args:
        ca_data: Corrective Action document data
    """
    publish_activity_event(
        event_type="corrective_action_created",
        title="Corrective Action Created",
        description=ca_data.get("description", ""),
        actor=ca_data.get("raised_by"),
        reference_doctype="Corrective Action",
        reference_name=ca_data.get("name"),
        metadata={
            "priority": ca_data.get("priority"),
            "assigned_to": ca_data.get("assigned_to"),
            "status": ca_data.get("status"),
        }
    )


def get_active_subscribers(channel: str) -> int:
    """Get count of active subscribers for a channel (for monitoring).
    
    Note: This is a placeholder as Frappe doesn't expose subscriber counts
    directly. In production, you might track this via Redis or similar.
    
    Args:
        channel: Channel name to check
        
    Returns:
        Estimated subscriber count (0 if unknown)
    """
    # Frappe's realtime doesn't expose subscriber counts
    # This could be extended with Redis tracking if needed
    return 0
