# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Core AI Analytics Engine for Pulse - Statistical analysis and predictive modeling."""

import math
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

import frappe
from frappe.utils import getdate, add_days, today
from frappe.utils.caching import redis_cache


def calculate_anomaly_score(historical_data: List[Dict]) -> Dict[str, Any]:
    """Calculate anomaly scores using statistical methods (Z-score, IQR).
    
    Args:
        historical_data: List of dicts with 'value' and optionally 'timestamp' keys
        
    Returns:
        Dict with anomaly analysis including scores, thresholds, and flagged points
    """
    if not historical_data or len(historical_data) < 3:
        return {
            "anomaly_score": 0.0,
            "is_anomaly": False,
            "method": "insufficient_data",
            "threshold": 0,
            "flagged_points": [],
            "statistics": {}
        }
    
    values = [float(d.get("value", 0)) for d in historical_data if d.get("value") is not None]
    
    if len(values) < 3:
        return {
            "anomaly_score": 0.0,
            "is_anomaly": False,
            "method": "insufficient_values",
            "threshold": 0,
            "flagged_points": [],
            "statistics": {"count": len(values)}
        }
    
    # Calculate basic statistics
    n = len(values)
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / n
    std_dev = math.sqrt(variance) if variance > 0 else 0
    
    # Sort for IQR calculation
    sorted_values = sorted(values)
    q1_idx = n // 4
    q3_idx = (3 * n) // 4
    q1 = sorted_values[q1_idx]
    q3 = sorted_values[q3_idx]
    iqr = q3 - q1
    
    # Anomaly detection using IQR method
    iqr_lower = q1 - 1.5 * iqr
    iqr_upper = q3 + 1.5 * iqr
    
    # Z-score method for recent values
    z_threshold = 2.5  # Values beyond 2.5 std dev are anomalies
    
    flagged_points = []
    max_anomaly_score = 0.0
    
    for i, data_point in enumerate(historical_data):
        value = float(data_point.get("value", 0))
        timestamp = data_point.get("timestamp", i)
        
        # Calculate Z-score
        z_score = abs((value - mean) / std_dev) if std_dev > 0 else 0
        
        # Check IQR bounds
        is_iqr_anomaly = value < iqr_lower or value > iqr_upper
        
        # Combined anomaly score (0-1 scale)
        anomaly_score = min(1.0, z_score / z_threshold) if z_score > 1.0 else 0.0
        if is_iqr_anomaly:
            anomaly_score = max(anomaly_score, 0.7)
        
        max_anomaly_score = max(max_anomaly_score, anomaly_score)
        
        if anomaly_score > 0.5:
            flagged_points.append({
                "index": i,
                "timestamp": timestamp,
                "value": value,
                "z_score": round(z_score, 4),
                "anomaly_score": round(anomaly_score, 4),
                "is_anomaly": anomaly_score > 0.7
            })
    
    # Determine if overall pattern is anomalous
    is_anomaly = max_anomaly_score > 0.7 or len(flagged_points) > max(1, n // 10)
    
    return {
        "anomaly_score": round(max_anomaly_score, 4),
        "is_anomaly": is_anomaly,
        "method": "z_score_iqr_hybrid",
        "threshold": z_threshold,
        "flagged_points": flagged_points,
        "statistics": {
            "count": n,
            "mean": round(mean, 4),
            "std_dev": round(std_dev, 4),
            "min": round(min(values), 4),
            "max": round(max(values), 4),
            "median": round(sorted_values[n // 2], 4),
            "q1": round(q1, 4),
            "q3": round(q3, 4),
            "iqr": round(iqr, 4)
        }
    }


def forecast_performance(trend_data: List[Dict], days: int = 7) -> Dict[str, Any]:
    """Forecast future performance using weighted moving average and trend extrapolation.
    
    Args:
        trend_data: List of dicts with 'date' and 'score' keys, ordered by date
        days: Number of days to forecast
        
    Returns:
        Dict with forecasted values, confidence intervals, and trend analysis
    """
    if not trend_data or len(trend_data) < 3:
        return {
            "forecasts": [],
            "trend_direction": "insufficient_data",
            "confidence": 0.0,
            "method": "none"
        }
    
    # Extract scores and dates
    scores = [float(d.get("score", d.get("value", 0))) for d in trend_data]
    dates = [d.get("date", d.get("timestamp", "")) for d in trend_data]
    
    n = len(scores)
    
    # Calculate weighted moving average (more weight on recent data)
    weights = [math.exp(i * 0.3) for i in range(n)]  # Exponential weighting
    weight_sum = sum(weights)
    weighted_avg = sum(s * w for s, w in zip(scores, weights)) / weight_sum
    
    # Calculate trend using linear regression on recent data
    recent_n = min(n, 14)  # Use last 14 points max for trend
    recent_scores = scores[-recent_n:]
    x_vals = list(range(recent_n))
    
    x_mean = sum(x_vals) / recent_n
    y_mean = sum(recent_scores) / recent_n
    
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, recent_scores))
    denominator = sum((x - x_mean) ** 2 for x in x_vals)
    
    slope = numerator / denominator if denominator != 0 else 0
    
    # Determine trend direction
    if slope > 0.01:
        trend_direction = "improving"
    elif slope < -0.01:
        trend_direction = "declining"
    else:
        trend_direction = "stable"
    
    # Calculate volatility for confidence
    volatility = calculate_volatility(scores)
    confidence = max(0.3, 1.0 - volatility * 2)  # Higher volatility = lower confidence
    
    # Generate forecasts
    last_date = dates[-1] if dates else today()
    if isinstance(last_date, str):
        try:
            last_date = getdate(last_date)
        except:
            last_date = getdate(today())
    
    forecasts = []
    last_score = scores[-1]
    
    for i in range(1, days + 1):
        # Combine trend extrapolation with weighted average
        trend_component = last_score + slope * i
        avg_component = weighted_avg
        
        # Weighted combination (trend becomes less certain further out)
        trend_weight = max(0.3, 0.7 - (i * 0.05))
        avg_weight = 1 - trend_weight
        
        forecast_value = trend_component * trend_weight + avg_component * avg_weight
        
        # Clamp to valid range (0-1 for scores)
        forecast_value = max(0.0, min(1.0, forecast_value))
        
        # Calculate confidence interval (wider for further predictions)
        margin = volatility * (1 + i * 0.1) * 0.5
        
        forecast_date = add_days(last_date, i)
        
        forecasts.append({
            "date": str(forecast_date),
            "forecast": round(forecast_value, 4),
            "lower_bound": round(max(0.0, forecast_value - margin), 4),
            "upper_bound": round(min(1.0, forecast_value + margin), 4),
            "confidence": round(max(0.1, confidence - (i * 0.05)), 4)
        })
    
    return {
        "forecasts": forecasts,
        "trend_direction": trend_direction,
        "trend_slope": round(slope, 6),
        "current_value": round(last_score, 4),
        "weighted_average": round(weighted_avg, 4),
        "confidence": round(confidence, 4),
        "volatility": round(volatility, 4),
        "method": "weighted_moving_avg_with_trend",
        "forecast_days": days
    }


def generate_recommendations(patterns: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate actionable recommendations based on detected patterns.
    
    Args:
        patterns: Dict containing various pattern analysis results
        
    Returns:
        List of recommendation objects with priority and actions
    """
    recommendations = []
    
    # Pattern: Declining performance
    if patterns.get("trend_direction") == "declining":
        slope = patterns.get("trend_slope", 0)
        severity = "high" if slope < -0.05 else "medium"
        recommendations.append({
            "id": f"rec_decline_{datetime.now().timestamp()}",
            "type": "performance_decline",
            "priority": severity,
            "title": "Performance Declining",
            "description": f"Performance trend shows decline of {abs(slope):.1%} per day.",
            "actions": [
                "Review recent SOP runs for compliance issues",
                "Check for resource constraints or training gaps",
                "Schedule one-on-one with underperforming team members"
            ],
            "impact_score": min(1.0, abs(slope) * 10),
            "category": "performance"
        })
    
    # Pattern: High volatility
    volatility = patterns.get("volatility", 0)
    if volatility > 0.2:
        recommendations.append({
            "id": f"rec_volatility_{datetime.now().timestamp()}",
            "type": "inconsistent_performance",
            "priority": "medium",
            "title": "Inconsistent Performance",
            "description": f"High performance volatility ({volatility:.1%}) indicates process instability.",
            "actions": [
                "Standardize SOP execution procedures",
                "Identify external factors affecting consistency",
                "Implement quality checkpoints"
            ],
            "impact_score": min(1.0, volatility * 2),
            "category": "consistency"
        })
    
    # Pattern: Low completion rates
    completion_rate = patterns.get("completion_rate", 1.0)
    if completion_rate < 0.8:
        recommendations.append({
            "id": f"rec_completion_{datetime.now().timestamp()}",
            "type": "low_completion",
            "priority": "high" if completion_rate < 0.6 else "medium",
            "title": "Low Task Completion Rate",
            "description": f"Only {completion_rate:.0%} of tasks are being completed on time.",
            "actions": [
                "Review workload distribution",
                "Identify bottlenecks in task execution",
                "Consider process simplification or automation"
            ],
            "impact_score": 1.0 - completion_rate,
            "category": "completion"
        })
    
    # Pattern: Anomaly detected
    if patterns.get("is_anomaly"):
        anomaly_score = patterns.get("anomaly_score", 0)
        recommendations.append({
            "id": f"rec_anomaly_{datetime.now().timestamp()}",
            "type": "anomaly_detected",
            "priority": "high" if anomaly_score > 0.8 else "medium",
            "title": "Unusual Pattern Detected",
            "description": f"AI detected unusual performance patterns (anomaly score: {anomaly_score:.2f}).",
            "actions": [
                "Investigate recent changes in processes or team",
                "Review any system issues or external events",
                "Document learnings for future reference"
            ],
            "impact_score": anomaly_score,
            "category": "anomaly"
        })
    
    # Pattern: Missed items concentration
    most_missed = patterns.get("most_missed_items", [])
    if most_missed and len(most_missed) > 0:
        top_missed = most_missed[0]
        recommendations.append({
            "id": f"rec_missed_{datetime.now().timestamp()}",
            "type": "recurring_missed_items",
            "priority": "medium",
            "title": f"Frequently Missed: {top_missed.get('task', 'Task')}",
            "description": f"'{top_missed.get('task', 'Task')}' missed {top_missed.get('count', 0)} times recently.",
            "actions": [
                "Review task clarity and documentation",
                "Check if task is realistic within timeframe",
                "Provide additional training on this specific item"
            ],
            "impact_score": min(1.0, top_missed.get("count", 0) / 10),
            "category": "compliance"
        })
    
    # Pattern: Weekend/Schedule gaps (if day-of-week data available)
    day_of_week_stats = patterns.get("day_of_week_stats", {})
    if day_of_week_stats:
        weak_days = [day for day, rate in day_of_week_stats.items() if rate < 0.7]
        if weak_days:
            recommendations.append({
                "id": f"rec_schedule_{datetime.now().timestamp()}",
                "type": "schedule_optimization",
                "priority": "low",
                "title": "Schedule Optimization Opportunity",
                "description": f"Performance drops on {', '.join(weak_days)}.",
                "actions": [
                    "Review staffing levels on low-performance days",
                    "Consider redistributing high-priority tasks",
                    "Investigate day-specific challenges"
                ],
                "impact_score": 0.3,
                "category": "scheduling"
            })
    
    # Pattern: Stagnant performance
    if patterns.get("trend_direction") == "stable" and patterns.get("current_score", 0) < 0.7:
        recommendations.append({
            "id": f"rec_stagnant_{datetime.now().timestamp()}",
            "type": "stagnant_performance",
            "priority": "medium",
            "title": "Performance Plateau",
            "description": "Performance is stable but below target. Improvement initiatives recommended.",
            "actions": [
                "Set specific improvement targets",
                "Identify best practices from top performers",
                "Implement gamification or incentive programs"
            ],
            "impact_score": 0.5,
            "category": "improvement"
        })
    
    # Sort by impact score (highest first)
    recommendations.sort(key=lambda x: x.get("impact_score", 0), reverse=True)
    
    return recommendations


def detect_compliance_patterns(runs_data: List[Dict]) -> Dict[str, Any]:
    """Analyze SOP run data to detect compliance patterns and issues.
    
    Args:
        runs_data: List of SOP run records with items, outcomes, timestamps
        
    Returns:
        Dict with detected patterns, compliance scores, and risk indicators
    """
    if not runs_data:
        return {
            "compliance_score": 0.0,
            "patterns": [],
            "risk_level": "unknown",
            "insights": []
        }
    
    # Aggregate statistics
    total_items = 0
    completed_items = 0
    passed_items = 0
    failed_items = 0
    missed_items = 0
    
    # Track patterns
    time_series = defaultdict(lambda: {"total": 0, "completed": 0, "passed": 0})
    item_failures = defaultdict(int)
    template_performance = defaultdict(lambda: {"total": 0, "passed": 0})
    
    for run in runs_data:
        date_key = str(run.get("period_date", run.get("date", "")))[:10]
        template = run.get("template", "unknown")
        
        total = run.get("total_items", 0)
        completed = run.get("completed_items", 0)
        passed = run.get("passed_items", 0)
        failed = run.get("failed_items", 0)
        missed = run.get("missed_items", 0)
        
        total_items += total
        completed_items += completed
        passed_items += passed
        failed_items += failed
        missed_items += missed
        
        # Time series aggregation
        time_series[date_key]["total"] += total
        time_series[date_key]["completed"] += completed
        time_series[date_key]["passed"] += passed
        
        # Template performance
        template_performance[template]["total"] += total
        template_performance[template]["passed"] += passed
        
        # Track specific failed items
        run_items = run.get("run_items", [])
        for item in run_items:
            if item.get("outcome") == "Fail" or item.get("status") == "Missed":
                item_name = item.get("checklist_item", "Unknown")
                item_failures[item_name] += 1
    
    # Calculate overall compliance score
    if total_items > 0:
        completion_rate = completed_items / total_items
        pass_rate = passed_items / total_items if passed_items > 0 else 0
        compliance_score = (completion_rate * 0.4 + pass_rate * 0.6)
    else:
        compliance_score = 0.0
        completion_rate = 0.0
        pass_rate = 0.0
    
    # Determine risk level
    if compliance_score >= 0.9:
        risk_level = "low"
    elif compliance_score >= 0.7:
        risk_level = "medium"
    elif compliance_score >= 0.5:
        risk_level = "high"
    else:
        risk_level = "critical"
    
    # Detect patterns
    patterns = []
    
    # Pattern: Declining trend
    sorted_dates = sorted(time_series.keys())
    if len(sorted_dates) >= 3:
        recent_scores = [time_series[d]["passed"] / max(1, time_series[d]["total"]) 
                        for d in sorted_dates[-7:]]
        trend = calculate_trend_direction(recent_scores)
        if trend == "declining":
            patterns.append({
                "type": "declining_compliance",
                "description": "Compliance scores trending downward",
                "severity": "high"
            })
    
    # Pattern: High failure concentration
    if item_failures:
        top_failures = sorted(item_failures.items(), key=lambda x: x[1], reverse=True)[:3]
        if top_failures[0][1] > 2:
            patterns.append({
                "type": "concentrated_failures",
                "description": f"Recurring failures in '{top_failures[0][0]}'",
                "severity": "medium",
                "items": [{"item": item, "count": count} for item, count in top_failures]
            })
    
    # Pattern: Template-specific issues
    weak_templates = [
        {"template": t, "pass_rate": stats["passed"] / max(1, stats["total"])}
        for t, stats in template_performance.items()
        if stats["passed"] / max(1, stats["total"]) < 0.7
    ]
    if weak_templates:
        patterns.append({
            "type": "template_difficulty",
            "description": f"{len(weak_templates)} templates with low pass rates",
            "severity": "medium",
            "templates": weak_templates
        })
    
    # Generate insights
    insights = []
    if missed_items > total_items * 0.1:
        insights.append({
            "type": "missed_items_high",
            "message": f"{missed_items} items missed ({missed_items/total_items:.0%} of total)"
        })
    
    if failed_items > passed_items:
        insights.append({
            "type": "more_failures_than_passes",
            "message": "More items failed than passed - critical review needed"
        })
    
    return {
        "compliance_score": round(compliance_score, 4),
        "completion_rate": round(completion_rate, 4),
        "pass_rate": round(pass_rate, 4),
        "total_items": total_items,
        "completed_items": completed_items,
        "passed_items": passed_items,
        "failed_items": failed_items,
        "missed_items": missed_items,
        "risk_level": risk_level,
        "patterns": patterns,
        "most_failed_items": [{"item": item, "count": count} 
                              for item, count in sorted(item_failures.items(), 
                                                        key=lambda x: x[1], 
                                                        reverse=True)[:5]],
        "insights": insights
    }


def calculate_trend_direction(values: List[float]) -> str:
    """Calculate the trend direction of a time series.
    
    Args:
        values: List of numeric values in chronological order
        
    Returns:
        String: 'improving', 'declining', or 'stable'
    """
    if not values or len(values) < 2:
        return "stable"
    
    # Simple linear regression slope
    n = len(values)
    x_vals = list(range(n))
    
    x_mean = sum(x_vals) / n
    y_mean = sum(values) / n
    
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, values))
    denominator = sum((x - x_mean) ** 2 for x in x_vals)
    
    slope = numerator / denominator if denominator != 0 else 0
    
    # Normalize slope by mean to get relative trend
    if y_mean > 0:
        relative_slope = slope / y_mean
    else:
        relative_slope = slope
    
    if relative_slope > 0.02:
        return "improving"
    elif relative_slope < -0.02:
        return "declining"
    return "stable"


def calculate_volatility(values: List[float]) -> float:
    """Calculate coefficient of variation (volatility) of a series.
    
    Args:
        values: List of numeric values
        
    Returns:
        Float between 0 and 1 representing volatility
    """
    if not values or len(values) < 2:
        return 0.0
    
    n = len(values)
    mean = sum(values) / n
    
    if mean == 0:
        return 0.0
    
    variance = sum((x - mean) ** 2 for x in values) / n
    std_dev = math.sqrt(variance)
    
    # Coefficient of variation
    cv = std_dev / abs(mean)
    
    return min(1.0, cv)  # Cap at 1.0


def calculate_peer_benchmark(employee_scores: List[float], peer_scores: List[List[float]]) -> Dict[str, Any]:
    """Calculate benchmark comparison against peers.
    
    Args:
        employee_scores: List of scores for the target employee
        peer_scores: List of score lists for each peer
        
    Returns:
        Dict with percentile ranking and comparison metrics
    """
    if not employee_scores:
        return {
            "percentile": 0,
            "rank": "unknown",
            "comparison": "insufficient_data"
        }
    
    employee_avg = sum(employee_scores) / len(employee_scores)
    
    # Calculate peer averages
    peer_avgs = []
    for peer in peer_scores:
        if peer:
            peer_avgs.append(sum(peer) / len(peer))
    
    if not peer_avgs:
        return {
            "percentile": 50,
            "rank": "average",
            "comparison": "no_peers",
            "employee_avg": round(employee_avg, 4)
        }
    
    # Calculate percentile
    below_count = sum(1 for p in peer_avgs if p < employee_avg)
    percentile = (below_count / len(peer_avgs)) * 100
    
    # Determine rank
    if percentile >= 90:
        rank = "top_performer"
    elif percentile >= 75:
        rank = "above_average"
    elif percentile >= 50:
        rank = "average"
    elif percentile >= 25:
        rank = "below_average"
    else:
        rank = "needs_improvement"
    
    # Calculate gap to top performer
    max_peer = max(peer_avgs)
    gap_to_top = max_peer - employee_avg
    
    # Calculate gap to median
    sorted_peers = sorted(peer_avgs)
    median_peer = sorted_peers[len(sorted_peers) // 2]
    gap_to_median = employee_avg - median_peer
    
    return {
        "percentile": round(percentile, 1),
        "rank": rank,
        "employee_avg": round(employee_avg, 4),
        "peer_median": round(median_peer, 4),
        "peer_best": round(max_peer, 4),
        "gap_to_top": round(gap_to_top, 4),
        "gap_to_median": round(gap_to_median, 4),
        "peer_count": len(peer_avgs),
        "comparison": "complete"
    }


@redis_cache(ttl=300)
def _cached_anomaly_analysis(employee: str, days: int = 30) -> Dict:
    """Cached anomaly analysis for an employee."""
    from pulse.api.insights import get_score_trends
    
    end_date = today()
    start_date = add_days(end_date, -days)
    
    # Get historical scores
    trends = get_score_trends(
        start_date=start_date,
        end_date=end_date,
        employee=employee,
        period_type="Day"
    )
    
    if not trends:
        return {"error": "No data available"}
    
    historical_data = [
        {"value": t.get("avg_score", 0), "timestamp": t.get("date")}
        for t in trends
    ]
    
    return calculate_anomaly_score(historical_data)
