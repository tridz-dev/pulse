# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""AI Insights API - Machine learning powered analytics and predictions.

This module provides AI-driven insights including:
- Anomaly detection in SOP compliance
- Performance forecasting
- Automated recommendations
- Trend analysis with forecasting
- Benchmark comparisons
- Compliance heatmaps
- Predictive alerts
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import frappe
from frappe import _
from frappe.utils import getdate, today, add_days, now
from frappe.utils.caching import redis_cache

from pulse.api.permissions import (
    _get_employee_for_user,
    _get_subtree_employee_names,
)
from pulse.api.insights import (
    get_score_trends,
    get_top_bottom_performers,
    get_completion_trend,
    get_department_comparison,
    get_branch_comparison,
    get_day_of_week_heatmap,
)
from pulse.ai.analytics_engine import (
    calculate_anomaly_score,
    forecast_performance,
    generate_recommendations,
    detect_compliance_patterns,
    calculate_trend_direction,
    calculate_volatility,
    calculate_peer_benchmark,
    _cached_anomaly_analysis,
)
from pulse.ai.nlp_query import (
    process_natural_query,
    generate_query_response,
    get_query_suggestions,
)


# =============================================================================
# AI Insights API Endpoints
# =============================================================================

@frappe.whitelist()
def get_anomaly_detection(
    employee_id: Optional[str] = None,
    date_range: Optional[Dict] = None
) -> Dict[str, Any]:
    """Detect unusual patterns in SOP compliance for an employee or organization.
    
    Uses statistical methods (Z-score, IQR) to identify anomalous performance patterns.
    
    Args:
        employee_id: Optional employee to analyze. If not provided, analyzes org-wide trends.
        date_range: Dict with 'from_date' and 'to_date' (YYYY-MM-DD format)
        
    Returns:
        Dict with anomaly analysis including:
        - anomaly_score: Overall anomaly score (0-1)
        - is_anomaly: Boolean indicating if pattern is anomalous
        - flagged_points: List of specific anomalous data points
        - statistics: Descriptive statistics of the data
    """
    try:
        # Validate permissions
        if employee_id and not _can_access_employee(employee_id):
            frappe.throw(_("Not permitted to access this employee's data"), frappe.PermissionError)
        
        # Parse date range
        date_range = date_range or {}
        if isinstance(date_range, str):
            date_range = json.loads(date_range)
        
        to_date = date_range.get("to_date") or today()
        from_date = date_range.get("from_date") or add_days(to_date, -30)
        
        # Get historical data
        if employee_id:
            trends = get_score_trends(
                start_date=from_date,
                end_date=to_date,
                employee=employee_id,
                period_type="Day"
            )
        else:
            trends = get_score_trends(
                start_date=from_date,
                end_date=to_date,
                period_type="Day"
            )
        
        if not trends:
            return {
                "success": True,
                "employee_id": employee_id,
                "anomaly_detected": False,
                "message": "No data available for analysis",
                "data": {
                    "anomaly_score": 0.0,
                    "is_anomaly": False,
                    "flagged_points": []
                }
            }
        
        # Prepare data for anomaly detection
        historical_data = [
            {"value": t.get("avg_score", 0), "timestamp": t.get("date")}
            for t in trends
        ]
        
        # Calculate anomaly scores
        result = calculate_anomaly_score(historical_data)
        
        # Add employee info if applicable
        if employee_id:
            employee_name = frappe.db.get_value("Pulse Employee", employee_id, "employee_name")
            result["employee"] = {
                "id": employee_id,
                "name": employee_name
            }
        
        return {
            "success": True,
            "employee_id": employee_id,
            "anomaly_detected": result.get("is_anomaly", False),
            "analysis_period": {"from": from_date, "to": to_date},
            "data": result
        }
        
    except Exception as e:
        frappe.log_error("AI Anomaly Detection Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to perform anomaly detection"
        }


@frappe.whitelist()
def get_performance_prediction(
    employee_id: str,
    horizon_days: int = 7
) -> Dict[str, Any]:
    """Predict future performance scores using time series forecasting.
    
    Uses weighted moving average with trend extrapolation for predictions.
    
    Args:
        employee_id: Employee to predict performance for
        horizon_days: Number of days to forecast (default: 7, max: 30)
        
    Returns:
        Dict with forecast including:
        - forecasts: List of daily predictions with confidence intervals
        - trend_direction: improving/declining/stable
        - confidence: Overall confidence score
    """
    try:
        # Validate parameters
        if not employee_id:
            frappe.throw(_("Employee ID is required"))
        
        if not _can_access_employee(employee_id):
            frappe.throw(_("Not permitted to access this employee's data"), frappe.PermissionError)
        
        horizon_days = min(int(horizon_days), 30)
        
        # Get historical data (60 days for better predictions)
        end_date = today()
        start_date = add_days(end_date, -60)
        
        trends = get_score_trends(
            start_date=start_date,
            end_date=end_date,
            employee=employee_id,
            period_type="Day"
        )
        
        if len(trends) < 7:
            return {
                "success": False,
                "message": "Insufficient historical data for prediction (need at least 7 days)",
                "employee_id": employee_id,
                "data": None
            }
        
        # Prepare trend data
        trend_data = [
            {"date": t.get("date"), "score": t.get("avg_score", 0)}
            for t in trends
        ]
        
        # Generate forecast
        forecast_result = forecast_performance(trend_data, days=horizon_days)
        
        # Add employee info
        employee_name = frappe.db.get_value("Pulse Employee", employee_id, "employee_name")
        forecast_result["employee"] = {
            "id": employee_id,
            "name": employee_name
        }
        
        return {
            "success": True,
            "employee_id": employee_id,
            "data": forecast_result
        }
        
    except Exception as e:
        frappe.log_error("AI Performance Prediction Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to generate performance prediction"
        }


@frappe.whitelist()
def get_recommendations(employee_id: Optional[str] = None) -> Dict[str, Any]:
    """Generate actionable AI recommendations based on performance patterns.
    
    Analyzes trends, completion rates, anomalies, and compliance data to generate
    personalized recommendations.
    
    Args:
        employee_id: Optional specific employee. If not provided, generates org-wide recommendations.
        
    Returns:
        Dict with prioritized recommendations including:
        - recommendations: List of recommendation objects
        - summary: High-level summary of key issues
    """
    try:
        if employee_id and not _can_access_employee(employee_id):
            frappe.throw(_("Not permitted to access this employee's data"), frappe.PermissionError)
        
        # Gather patterns data
        patterns = _gather_patterns_for_recommendations(employee_id)
        
        # Generate recommendations
        recommendations = generate_recommendations(patterns)
        
        # Calculate summary stats
        high_priority = sum(1 for r in recommendations if r.get("priority") == "high")
        medium_priority = sum(1 for r in recommendations if r.get("priority") == "medium")
        
        return {
            "success": True,
            "employee_id": employee_id,
            "generated_at": now(),
            "summary": {
                "total_recommendations": len(recommendations),
                "high_priority": high_priority,
                "medium_priority": medium_priority,
                "top_category": recommendations[0].get("category") if recommendations else None
            },
            "data": recommendations
        }
        
    except Exception as e:
        frappe.log_error("AI Recommendations Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to generate recommendations"
        }


@frappe.whitelist()
def get_trend_analysis(
    metric: str = "score",
    date_range: Optional[Dict] = None,
    granularity: str = "Day",
    employee_id: Optional[str] = None
) -> Dict[str, Any]:
    """Analyze trends with forecasting capabilities.
    
    Args:
        metric: Metric to analyze (score, completion, compliance)
        date_range: Dict with 'from_date' and 'to_date'
        granularity: 'Day', 'Week', or 'Month'
        employee_id: Optional employee filter
        
    Returns:
        Dict with trend analysis including:
        - historical_data: Time series data
        - trend_direction: improving/declining/stable
        - forecast: Future predictions
        - change_metrics: Period-over-period changes
    """
    try:
        if employee_id and not _can_access_employee(employee_id):
            frappe.throw(_("Not permitted to access this employee's data"), frappe.PermissionError)
        
        # Parse parameters
        date_range = date_range or {}
        if isinstance(date_range, str):
            date_range = json.loads(date_range)
        
        to_date = date_range.get("to_date") or today()
        from_date = date_range.get("from_date") or add_days(to_date, -30)
        
        # Get data based on metric type
        if metric == "completion":
            trends = get_completion_trend(
                start_date=from_date,
                end_date=to_date,
                employee=employee_id
            )
            values_key = "rate"
        else:
            trends = get_score_trends(
                start_date=from_date,
                end_date=to_date,
                employee=employee_id,
                period_type=granularity
            )
            values_key = "avg_score"
        
        if not trends:
            return {
                "success": True,
                "metric": metric,
                "message": "No data available for trend analysis",
                "data": None
            }
        
        # Extract values for analysis
        values = [t.get(values_key, 0) for t in trends if t.get(values_key) is not None]
        
        # Calculate trend direction
        trend_direction = calculate_trend_direction(values)
        
        # Calculate volatility
        volatility = calculate_volatility(values)
        
        # Calculate period-over-period change
        if len(values) >= 2:
            first_half = values[:len(values)//2]
            second_half = values[len(values)//2:]
            first_avg = sum(first_half) / len(first_half) if first_half else 0
            second_avg = sum(second_half) / len(second_half) if second_half else 0
            pop_change = second_avg - first_avg
        else:
            pop_change = 0
        
        # Generate forecast if we have enough data
        forecast = None
        if len(trends) >= 7:
            trend_data = [{"date": t.get("date"), "score": t.get(values_key, 0)} for t in trends]
            forecast = forecast_performance(trend_data, days=7)
        
        return {
            "success": True,
            "metric": metric,
            "granularity": granularity,
            "analysis_period": {"from": from_date, "to": to_date},
            "data": {
                "historical_data": trends,
                "trend_direction": trend_direction,
                "volatility": round(volatility, 4),
                "period_over_period_change": round(pop_change, 4),
                "current_value": round(values[-1], 4) if values else 0,
                "average_value": round(sum(values) / len(values), 4) if values else 0,
                "forecast": forecast
            }
        }
        
    except Exception as e:
        frappe.log_error("AI Trend Analysis Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to analyze trends"
        }


@frappe.whitelist()
def get_benchmark_comparison(
    employee_id: str,
    peer_group: Optional[str] = "department"
) -> Dict[str, Any]:
    """Compare employee performance against peer group benchmarks.
    
    Args:
        employee_id: Employee to benchmark
        peer_group: 'department', 'branch', or 'role' to define peer group
        
    Returns:
        Dict with benchmark comparison including:
        - percentile: Employee's percentile rank (0-100)
        - rank: Classification (top_performer, above_average, etc.)
        - peer_statistics: Aggregate peer metrics
        - gaps: Comparison gaps to top and median performers
    """
    try:
        if not employee_id:
            frappe.throw(_("Employee ID is required"))
        
        if not _can_access_employee(employee_id):
            frappe.throw(_("Not permitted to access this employee's data"), frappe.PermissionError)
        
        # Get employee data
        employee = frappe.get_doc("Pulse Employee", employee_id)
        
        # Define peer group filter
        peer_filters = {"is_active": 1, "name": ["!=", employee_id]}
        if peer_group == "department" and employee.department:
            peer_filters["department"] = employee.department
        elif peer_group == "branch" and employee.branch:
            peer_filters["branch"] = employee.branch
        elif peer_group == "role" and employee.pulse_role:
            peer_filters["pulse_role"] = employee.pulse_role
        
        # Get peer employees
        peer_ids = frappe.get_all("Pulse Employee", filters=peer_filters, pluck="name")
        
        # Get last 30 days of scores
        end_date = today()
        start_date = add_days(end_date, -30)
        
        # Get employee's scores
        emp_trends = get_score_trends(
            start_date=start_date,
            end_date=end_date,
            employee=employee_id,
            period_type="Day"
        )
        emp_scores = [t.get("avg_score", 0) for t in emp_trends]
        
        # Get peer scores
        peer_scores = []
        for peer_id in peer_ids[:20]:  # Limit to 20 peers for performance
            peer_trends = get_score_trends(
                start_date=start_date,
                end_date=end_date,
                employee=peer_id,
                period_type="Day"
            )
            peer_score_list = [t.get("avg_score", 0) for t in peer_trends]
            if peer_score_list:
                peer_scores.append(peer_score_list)
        
        # Calculate benchmark
        benchmark = calculate_peer_benchmark(emp_scores, peer_scores)
        
        # Add context
        benchmark["employee"] = {
            "id": employee_id,
            "name": employee.employee_name
        }
        benchmark["peer_group"] = {
            "type": peer_group,
            "value": getattr(employee, peer_group, None),
            "count": len(peer_scores)
        }
        
        return {
            "success": True,
            "employee_id": employee_id,
            "data": benchmark
        }
        
    except Exception as e:
        frappe.log_error("AI Benchmark Comparison Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to generate benchmark comparison"
        }


@frappe.whitelist()
def get_compliance_heatmap(
    date_range: Optional[Dict] = None,
    branch: Optional[str] = None,
    department: Optional[str] = None
) -> Dict[str, Any]:
    """Generate visual compliance heatmap data.
    
    Provides day-of-week and hour-of-day heatmap data for compliance patterns.
    
    Args:
        date_range: Dict with 'from_date' and 'to_date'
        branch: Optional branch filter
        department: Optional department filter
        
    Returns:
        Dict with heatmap data including:
        - day_of_week: 7-day pattern with compliance rates
        - hourly_pattern: 24-hour pattern (if timestamp data available)
        - intensity_matrix: 2D matrix for calendar heatmap
    """
    try:
        # Parse date range
        date_range = date_range or {}
        if isinstance(date_range, str):
            date_range = json.loads(date_range)
        
        to_date = date_range.get("to_date") or today()
        from_date = date_range.get("from_date") or add_days(to_date, -30)
        
        # Get day of week heatmap
        heatmap_data = get_day_of_week_heatmap(
            start_date=from_date,
            end_date=to_date,
            branch=branch,
            department=department
        )
        
        # Enhance with additional metrics
        enhanced_heatmap = []
        for day_data in heatmap_data:
            day_data["intensity"] = _calculate_heatmap_intensity(day_data.get("avg_rate", 0))
            day_data["status"] = _get_heatmap_status(day_data.get("avg_rate", 0))
            enhanced_heatmap.append(day_data)
        
        # Get compliance distribution for color scale
        completion_trend = get_completion_trend(
            start_date=from_date,
            end_date=to_date,
            branch=branch,
            department=department
        )
        
        # Calculate overall stats
        if completion_trend:
            avg_rate = sum(t.get("rate", 0) for t in completion_trend) / len(completion_trend)
            min_rate = min(t.get("rate", 1) for t in completion_trend)
            max_rate = max(t.get("rate", 0) for t in completion_trend)
        else:
            avg_rate = min_rate = max_rate = 0
        
        return {
            "success": True,
            "analysis_period": {"from": from_date, "to": to_date},
            "filters": {"branch": branch, "department": department},
            "color_scale": {
                "min": 0.0,
                "max": 1.0,
                "thresholds": {
                    "critical": 0.4,
                    "warning": 0.7,
                    "good": 0.9
                }
            },
            "summary": {
                "average_rate": round(avg_rate, 4),
                "min_rate": round(min_rate, 4),
                "max_rate": round(max_rate, 4)
            },
            "data": {
                "day_of_week": enhanced_heatmap,
                "daily_trend": completion_trend
            }
        }
        
    except Exception as e:
        frappe.log_error("AI Compliance Heatmap Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to generate compliance heatmap"
        }


@frappe.whitelist()
def get_predictive_alerts() -> Dict[str, Any]:
    """Get AI-generated proactive alerts for potential issues.
    
    Analyzes patterns across the organization to predict and alert on:
    - Employees at risk of declining performance
    - Compliance issues before they become critical
    - Unusual patterns requiring attention
    
    Returns:
        Dict with prioritized alerts including:
        - alerts: List of alert objects with severity and recommended actions
        - alert_counts: Summary by severity
    """
    try:
        # Get current user's scope
        scope_employees, role = _get_user_insight_scope()
        
        if not scope_employees:
            return {
                "success": True,
                "alerts": [],
                "message": "No scope for alerts"
            }
        
        alerts = []
        
        # Check for declining performers
        end_date = today()
        start_date = add_days(end_date, -14)
        
        for employee_id in scope_employees[:50]:  # Limit for performance
            try:
                trends = get_score_trends(
                    start_date=start_date,
                    end_date=end_date,
                    employee=employee_id,
                    period_type="Day"
                )
                
                if len(trends) >= 7:
                    scores = [t.get("avg_score", 0) for t in trends]
                    
                    # Check for declining trend
                    direction = calculate_trend_direction(scores)
                    if direction == "declining":
                        emp_name = frappe.db.get_value("Pulse Employee", employee_id, "employee_name")
                        decline_rate = (scores[-1] - scores[0]) / len(scores) if scores else 0
                        
                        if decline_rate < -0.02:  # Significant decline
                            alerts.append({
                                "id": f"decline_{employee_id}_{now()}",
                                "type": "declining_performance",
                                "severity": "high" if decline_rate < -0.05 else "medium",
                                "employee_id": employee_id,
                                "employee_name": emp_name,
                                "title": f"Declining Performance: {emp_name}",
                                "message": f"Performance declining at {abs(decline_rate):.1%} per day",
                                "metric_change": round(decline_rate, 4),
                                "recommended_action": "Schedule check-in and review workload",
                                "created_at": now()
                            })
                    
                    # Check for high volatility (inconsistent performance)
                    volatility = calculate_volatility(scores)
                    if volatility > 0.25:
                        emp_name = frappe.db.get_value("Pulse Employee", employee_id, "employee_name")
                        # Only add if not already added for decline
                        if not any(a.get("employee_id") == employee_id for a in alerts):
                            alerts.append({
                                "id": f"volatile_{employee_id}_{now()}",
                                "type": "inconsistent_performance",
                                "severity": "medium",
                                "employee_id": employee_id,
                                "employee_name": emp_name,
                                "title": f"Inconsistent Performance: {emp_name}",
                                "message": f"High performance volatility ({volatility:.1%})",
                                "metric_value": round(volatility, 4),
                                "recommended_action": "Identify factors causing inconsistency",
                                "created_at": now()
                            })
                    
                    # Check for low completion on recent days
                    recent_scores = scores[-3:]
                    if recent_scores and sum(recent_scores) / len(recent_scores) < 0.5:
                        emp_name = frappe.db.get_value("Pulse Employee", employee_id, "employee_name")
                        if not any(a.get("employee_id") == employee_id for a in alerts):
                            alerts.append({
                                "id": f"low_{employee_id}_{now()}",
                                "type": "low_recent_performance",
                                "severity": "high",
                                "employee_id": employee_id,
                                "employee_name": emp_name,
                                "title": f"Low Recent Scores: {emp_name}",
                                "message": f"Average score below 50% over last 3 days",
                                "metric_value": round(sum(recent_scores) / len(recent_scores), 4),
                                "recommended_action": "Immediate intervention required",
                                "created_at": now()
                            })
                            
            except Exception as e:
                continue  # Skip employees with errors
        
        # Sort alerts by severity
        severity_order = {"high": 0, "medium": 1, "low": 2}
        alerts.sort(key=lambda x: severity_order.get(x.get("severity"), 3))
        
        # Calculate summary
        high_count = sum(1 for a in alerts if a.get("severity") == "high")
        medium_count = sum(1 for a in alerts if a.get("severity") == "medium")
        
        return {
            "success": True,
            "generated_at": now(),
            "summary": {
                "total_alerts": len(alerts),
                "high_severity": high_count,
                "medium_severity": medium_count,
                "scope_count": len(scope_employees)
            },
            "alerts": alerts[:20]  # Return top 20
        }
        
    except Exception as e:
        frappe.log_error("AI Predictive Alerts Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to generate predictive alerts"
        }


# =============================================================================
# Natural Language Query API
# =============================================================================

@frappe.whitelist()
def query_ai_insights(query_text: str) -> Dict[str, Any]:
    """Process natural language query and return AI insights.
    
    Args:
        query_text: Natural language query like "Show me underperforming branches last month"
        
    Returns:
        Dict with query results and metadata
    """
    try:
        parsed = process_natural_query(query_text)
        result = generate_query_response(parsed)
        return result
    except Exception as e:
        frappe.log_error("AI Natural Language Query Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to process natural language query"
        }


@frappe.whitelist()
def get_ai_query_suggestions(partial_text: str) -> List[Dict[str, str]]:
    """Get auto-complete suggestions for AI query input.
    
    Args:
        partial_text: Partial query text entered by user
        
    Returns:
        List of suggestion objects
    """
    try:
        return get_query_suggestions(partial_text)
    except Exception as e:
        frappe.log_error("AI Query Suggestions Error", str(e))
        return []


# =============================================================================
# Helper Functions
# =============================================================================

def _can_access_employee(employee_id: str) -> bool:
    """Check if current user can access employee data."""
    user = frappe.session.user
    if user == "Administrator":
        return True
    
    roles = frappe.get_roles(user)
    if "Pulse Admin" in roles or "Pulse Executive" in roles:
        return True
    
    # Check if user's employee
    user_employee = _get_employee_for_user()
    if user_employee and user_employee == employee_id:
        return True
    
    # Check if in subtree (for managers)
    if "Pulse Leader" in roles and user_employee:
        subtree = _get_subtree_employee_names(user_employee)
        if subtree and employee_id in subtree:
            return True
    
    return False


def _get_user_insight_scope() -> tuple:
    """Get employee scope and role for current user."""
    roles = frappe.get_roles(frappe.session.user)
    
    if frappe.session.user == "Administrator" or "Pulse Admin" in roles or "Pulse Executive" in roles:
        all_emps = frappe.get_all("Pulse Employee", filters={"is_active": 1}, pluck="name")
        return all_emps, "Executive"
    
    emp = _get_employee_for_user()
    if not emp:
        return [], None
    
    if "Pulse Leader" in roles:
        from pulse.api.insights import _get_insight_employee_scope
        return _get_insight_employee_scope()
    
    return [], None


def _gather_patterns_for_recommendations(employee_id: Optional[str] = None) -> Dict:
    """Gather pattern data for recommendation generation."""
    end_date = today()
    start_date = add_days(end_date, -30)
    
    patterns = {
        "trend_direction": "stable",
        "volatility": 0,
        "completion_rate": 1.0,
        "current_score": 0,
        "is_anomaly": False,
        "anomaly_score": 0,
        "most_missed_items": []
    }
    
    # Get trends
    trends = get_score_trends(
        start_date=start_date,
        end_date=end_date,
        employee=employee_id,
        period_type="Day"
    )
    
    if trends:
        scores = [t.get("avg_score", 0) for t in trends if t.get("avg_score")]
        if scores:
            patterns["trend_direction"] = calculate_trend_direction(scores)
            patterns["volatility"] = calculate_volatility(scores)
            patterns["current_score"] = scores[-1] if scores else 0
    
    # Get completion data
    completion = get_completion_trend(
        start_date=start_date,
        end_date=end_date,
        employee=employee_id
    )
    
    if completion:
        rates = [c.get("rate", 0) for c in completion if c.get("rate") is not None]
        if rates:
            patterns["completion_rate"] = sum(rates) / len(rates)
    
    # Check for anomalies
    if trends:
        historical_data = [{"value": t.get("avg_score", 0), "timestamp": t.get("date")} for t in trends]
        anomaly_result = calculate_anomaly_score(historical_data)
        patterns["is_anomaly"] = anomaly_result.get("is_anomaly", False)
        patterns["anomaly_score"] = anomaly_result.get("anomaly_score", 0)
    
    return patterns


def _calculate_heatmap_intensity(rate: float) -> int:
    """Convert rate to intensity level (0-4) for heatmap."""
    if rate >= 0.9:
        return 4
    elif rate >= 0.75:
        return 3
    elif rate >= 0.6:
        return 2
    elif rate >= 0.4:
        return 1
    return 0


def _get_heatmap_status(rate: float) -> str:
    """Get status label for heatmap cell."""
    if rate >= 0.9:
        return "excellent"
    elif rate >= 0.75:
        return "good"
    elif rate >= 0.6:
        return "fair"
    elif rate >= 0.4:
        return "warning"
    return "critical"


# =============================================================================
# Batch Operations
# =============================================================================

@frappe.whitelist()
def get_ai_dashboard_summary() -> Dict[str, Any]:
    """Get comprehensive AI insights summary for dashboard.
    
    Returns aggregated AI insights including predictions, alerts, and recommendations.
    """
    try:
        # Get predictive alerts
        alerts_data = get_predictive_alerts()
        
        # Get organization-wide trend
        trend_data = get_trend_analysis(
            metric="score",
            date_range={"from_date": add_days(today(), -30), "to_date": today()},
            granularity="Day"
        )
        
        # Get recommendations (org-wide)
        recommendations_data = get_recommendations()
        
        return {
            "success": True,
            "generated_at": now(),
            "alerts": alerts_data.get("data", {}) if alerts_data.get("success") else {},
            "trends": trend_data.get("data", {}) if trend_data.get("success") else {},
            "recommendations": recommendations_data.get("data", []) if recommendations_data.get("success") else [],
            "summary": {
                "has_alerts": alerts_data.get("success") and alerts_data.get("data", {}).get("total_alerts", 0) > 0,
                "alert_count": alerts_data.get("data", {}).get("total_alerts", 0) if alerts_data.get("success") else 0,
                "trend_direction": trend_data.get("data", {}).get("trend_direction", "unknown") if trend_data.get("success") else "unknown",
                "recommendation_count": len(recommendations_data.get("data", [])) if recommendations_data.get("success") else 0
            }
        }
        
    except Exception as e:
        frappe.log_error("AI Dashboard Summary Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to generate AI dashboard summary"
        }
