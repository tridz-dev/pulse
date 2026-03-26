# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Natural Language Query Interface for Pulse AI Insights.

Parses natural language queries and translates them to API calls.
"""

import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

import frappe
from frappe.utils import getdate, today, add_days


@dataclass
class ParsedQuery:
    """Structured representation of a natural language query."""
    intent: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    time_range: Optional[str] = None
    filters: Dict[str, Any] = None
    metric: Optional[str] = None
    aggregation: Optional[str] = None
    sort_order: Optional[str] = None
    limit: Optional[int] = None
    original_query: str = ""
    confidence: float = 0.0


# Intent patterns for query classification
INTENT_PATTERNS = {
    "performance_summary": [
        r"how (is|are) .+ performing",
        r"show (me )?performance",
        r"performance (summary|overview)",
        r"(get|give) (me )?performance",
    ],
    "comparison": [
        r"compare .+ to .+",
        r"how (does|do) .+ compare",
        r"(comparison|versus|vs)",
        r"(better|worse) than",
        r"benchmark",
    ],
    "trend_analysis": [
        r"trend",
        r"(over|during) (the )?(last|past|next)",
        r"(going|moving) (up|down)",
        r"(improve|decline|change)",
        r"forecast|predict",
    ],
    "anomaly_detection": [
        r"(anomaly|anomalies|unusual|strange|odd)",
        r"(something|anything) wrong",
        r"problem|issue|concern",
        r"red flag",
        r"alert",
    ],
    "top_performers": [
        r"(top|best|highest) .+ (performer|performing|score)",
        r"who (is|are) (the )?best",
        r"(ranking|ranked)",
        r"leaderboard",
    ],
    "bottom_performers": [
        r"(bottom|worst|lowest) .+ (performer|performing|score)",
        r"who (is|are) (the )?worst",
        r"underperform",
        r"(struggling|poor)",
    ],
    "compliance_check": [
        r"compliance",
        r"(sop|procedure) (follow|adher)",
        r"missed .+ task",
        r"failure rate",
        r"pass rate",
    ],
    "recommendations": [
        r"(recommend|suggestion|advice)",
        r"what should",
        r"how (can|to) improve",
        r"action (item|plan)",
    ],
}

# Entity extraction patterns
ENTITY_PATTERNS = {
    "employee": [
        r"(employee|staff|user|person)[:\s]+([\w\s-]+)",
        r"for[:\s]+([\w\s-]+)(?:\s|$)",
    ],
    "department": [
        r"(department|dept)[:\s]+([\w\s-]+)",
        r"in (?:the )?([\w\s-]+) department",
    ],
    "branch": [
        r"(branch|location|site)[:\s]+([\w\s-]+)",
        r"at (?:the )?([\w\s-]+) branch",
    ],
    "template": [
        r"(template|sop|procedure)[:\s]+([\w\s-]+)",
    ],
}

# Time range patterns
TIME_RANGE_PATTERNS = {
    "today": [r"\btoday\b", r"\bthis day\b"],
    "yesterday": [r"\byesterday\b"],
    "this_week": [r"\bthis week\b", r"\bcurrent week\b"],
    "last_week": [r"\blast week\b", r"\bpast week\b", r"\bprevious week\b"],
    "this_month": [r"\bthis month\b", r"\bcurrent month\b"],
    "last_month": [r"\blast month\b", r"\bpast month\b", r"\bprevious month\b"],
    "last_7_days": [r"\blast (7|seven) days\b", r"\bpast (7|seven) days\b"],
    "last_30_days": [r"\blast (30|thirty) days\b", r"\bpast (30|thirty) days\b", r"\blast month\b"],
    "last_90_days": [r"\blast (90|ninety) days\b", r"\bpast quarter\b", r"\blast quarter\b"],
}

# Metric keywords
METRIC_KEYWORDS = {
    "score": [r"\bscore\b", r"\brating\b", r"\bgrade\b"],
    "completion": [r"\bcompletion\b", r"\bdone\b", r"\bfinished\b"],
    "compliance": [r"\bcompliance\b", r"\badherence\b", r"\bfollowing\b"],
    "efficiency": [r"\befficiency\b", r"\bproductivity\b", r"\bspeed\b"],
    "quality": [r"\bquality\b", r"\bpass rate\b", r"\bsuccess rate\b"],
}


def process_natural_query(query_text: str) -> ParsedQuery:
    """Parse a natural language query into structured components.
    
    Args:
        query_text: Natural language query string
        
    Returns:
        ParsedQuery object with extracted intent and parameters
    """
    query_lower = query_text.lower().strip()
    
    # Detect intent
    intent = _detect_intent(query_lower)
    
    # Extract entities
    entity_type, entity_id = _extract_entities(query_lower)
    
    # Extract time range
    time_range = _extract_time_range(query_lower)
    
    # Extract metric
    metric = _extract_metric(query_lower)
    
    # Extract filters
    filters = _extract_filters(query_lower)
    
    # Extract aggregation
    aggregation = _extract_aggregation(query_lower)
    
    # Extract limit
    limit = _extract_limit(query_lower)
    
    # Calculate confidence based on match quality
    confidence = _calculate_confidence(
        intent, entity_type, time_range, query_lower
    )
    
    return ParsedQuery(
        intent=intent,
        entity_type=entity_type,
        entity_id=entity_id,
        time_range=time_range,
        filters=filters,
        metric=metric,
        aggregation=aggregation,
        limit=limit,
        original_query=query_text,
        confidence=confidence
    )


def _detect_intent(query: str) -> str:
    """Detect the query intent from text patterns."""
    intent_scores = {}
    
    for intent, patterns in INTENT_PATTERNS.items():
        score = 0
        for pattern in patterns:
            if re.search(pattern, query, re.IGNORECASE):
                score += 1
        if score > 0:
            intent_scores[intent] = score
    
    if intent_scores:
        return max(intent_scores, key=intent_scores.get)
    
    # Default intent based on keywords
    if any(word in query for word in ["show", "get", "list", "what", "how"]):
        return "performance_summary"
    
    return "unknown"


def _extract_entities(query: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract entity type and ID from query."""
    for entity_type, patterns in ENTITY_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                # Last group is typically the entity value
                entity_id = match.groups()[-1].strip()
                return entity_type, entity_id
    
    return None, None


def _extract_time_range(query: str) -> Optional[str]:
    """Extract time range from query."""
    for range_name, patterns in TIME_RANGE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, query, re.IGNORECASE):
                return range_name
    
    # Try to extract date ranges
    date_range_match = re.search(
        r"(from|between)\s+(\d{4}-\d{2}-\d{2})\s+(to|and)\s+(\d{4}-\d{2}-\d{2})",
        query, re.IGNORECASE
    )
    if date_range_match:
        return f"custom:{date_range_match.group(2)}:{date_range_match.group(4)}"
    
    return None


def _extract_metric(query: str) -> Optional[str]:
    """Extract metric focus from query."""
    for metric, patterns in METRIC_KEYWORDS.items():
        for pattern in patterns:
            if re.search(pattern, query, re.IGNORECASE):
                return metric
    
    # Default metric based on context
    if "performance" in query:
        return "score"
    
    return None


def _extract_filters(query: str) -> Dict[str, Any]:
    """Extract additional filter criteria."""
    filters = {}
    
    # Check for status filters
    if re.search(r"\bactive\b", query, re.IGNORECASE):
        filters["status"] = "active"
    if re.search(r"\binactive\b", query, re.IGNORECASE):
        filters["status"] = "inactive"
    
    # Check for role filters
    role_match = re.search(r"\b(role|as)\s+(\w+)\b", query, re.IGNORECASE)
    if role_match:
        filters["role"] = role_match.group(2)
    
    return filters


def _extract_aggregation(query: str) -> Optional[str]:
    """Extract aggregation type from query."""
    if re.search(r"\b(average|avg|mean)\b", query, re.IGNORECASE):
        return "average"
    if re.search(r"\b(sum|total)\b", query, re.IGNORECASE):
        return "sum"
    if re.search(r"\b(count|number)\b", query, re.IGNORECASE):
        return "count"
    if re.search(r"\b(max|maximum|highest)\b", query, re.IGNORECASE):
        return "max"
    if re.search(r"\b(min|minimum|lowest)\b", query, re.IGNORECASE):
        return "min"
    return None


def _extract_limit(query: str) -> Optional[int]:
    """Extract result limit from query."""
    # Look for "top N" or "bottom N"
    match = re.search(r"\b(top|bottom)\s+(\d+)\b", query, re.IGNORECASE)
    if match:
        return int(match.group(2))
    
    # Look for "limit N"
    match = re.search(r"\blimit\s+(\d+)\b", query, re.IGNORECASE)
    if match:
        return int(match.group(1))
    
    # Look for "first N"
    match = re.search(r"\bfirst\s+(\d+)\b", query, re.IGNORECASE)
    if match:
        return int(match.group(1))
    
    return None


def _calculate_confidence(intent: str, entity_type: Optional[str], 
                         time_range: Optional[str], query: str) -> float:
    """Calculate confidence score for the parsing."""
    confidence = 0.5  # Base confidence
    
    # Boost for detected intent
    if intent != "unknown":
        confidence += 0.2
    
    # Boost for entity detection
    if entity_type:
        confidence += 0.15
    
    # Boost for time range
    if time_range:
        confidence += 0.1
    
    # Boost for longer, more specific queries
    word_count = len(query.split())
    if word_count >= 5:
        confidence += min(0.1, word_count * 0.01)
    
    return min(1.0, confidence)


def generate_query_response(parsed_query: ParsedQuery) -> Dict[str, Any]:
    """Execute the parsed query and return results.
    
    Args:
        parsed_query: ParsedQuery object with intent and parameters
        
    Returns:
        Dict with query results and metadata
    """
    intent_handlers = {
        "performance_summary": _handle_performance_summary,
        "comparison": _handle_comparison,
        "trend_analysis": _handle_trend_analysis,
        "anomaly_detection": _handle_anomaly_detection,
        "top_performers": _handle_top_performers,
        "bottom_performers": _handle_bottom_performers,
        "compliance_check": _handle_compliance_check,
        "recommendations": _handle_recommendations,
    }
    
    handler = intent_handlers.get(parsed_query.intent, _handle_unknown)
    
    try:
        result = handler(parsed_query)
        result["query_metadata"] = {
            "original_query": parsed_query.original_query,
            "parsed_intent": parsed_query.intent,
            "confidence": parsed_query.confidence,
            "entity_type": parsed_query.entity_type,
            "entity_id": parsed_query.entity_id,
        }
        return result
    except Exception as e:
        frappe.log_error("NLP Query Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Unable to process query. Please try rephrasing.",
            "query_metadata": {
                "original_query": parsed_query.original_query,
                "parsed_intent": parsed_query.intent,
            }
        }


def _handle_performance_summary(parsed: ParsedQuery) -> Dict:
    """Handle performance summary intent."""
    from pulse.api.insights import get_score_trends, get_top_bottom_performers
    
    date_range = _get_date_range(parsed.time_range)
    
    # Get trends
    trends = get_score_trends(
        start_date=date_range["from"],
        end_date=date_range["to"],
        employee=parsed.entity_id if parsed.entity_type == "employee" else None
    )
    
    # Get performers if no specific employee
    performers = None
    if not parsed.entity_id:
        performers = get_top_bottom_performers(
            date=date_range["to"],
            limit=5
        )
    
    return {
        "success": True,
        "type": "performance_summary",
        "data": {
            "trends": trends,
            "performers": performers,
            "date_range": date_range
        }
    }


def _handle_comparison(parsed: ParsedQuery) -> Dict:
    """Handle comparison intent."""
    from pulse.api.insights import get_department_comparison, get_branch_comparison
    
    date_range = _get_date_range(parsed.time_range)
    
    # Determine comparison type
    if parsed.entity_type == "department" or "department" in parsed.original_query.lower():
        data = get_department_comparison(date=date_range["to"])
        comparison_type = "department"
    else:
        data = get_branch_comparison(date=date_range["to"])
        comparison_type = "branch"
    
    return {
        "success": True,
        "type": "comparison",
        "comparison_type": comparison_type,
        "data": data
    }


def _handle_trend_analysis(parsed: ParsedQuery) -> Dict:
    """Handle trend analysis intent."""
    from pulse.api.insights import get_score_trends
    from pulse.ai.analytics_engine import forecast_performance
    
    date_range = _get_date_range(parsed.time_range, default_days=30)
    
    trends = get_score_trends(
        start_date=date_range["from"],
        end_date=date_range["to"],
        employee=parsed.entity_id if parsed.entity_type == "employee" else None
    )
    
    # Generate forecast if we have enough data
    forecast = None
    if len(trends) >= 7:
        trend_data = [{"date": t["date"], "score": t["avg_score"]} for t in trends]
        forecast = forecast_performance(trend_data, days=7)
    
    return {
        "success": True,
        "type": "trend_analysis",
        "data": {
            "trends": trends,
            "forecast": forecast,
            "date_range": date_range
        }
    }


def _handle_anomaly_detection(parsed: ParsedQuery) -> Dict:
    """Handle anomaly detection intent."""
    from pulse.ai.analytics_engine import _cached_anomaly_analysis
    
    if parsed.entity_type == "employee" and parsed.entity_id:
        # Try to resolve employee
        employee = _resolve_employee(parsed.entity_id)
        if employee:
            anomalies = _cached_anomaly_analysis(employee, days=30)
            return {
                "success": True,
                "type": "anomaly_detection",
                "entity": employee,
                "data": anomalies
            }
    
    # Organization-wide anomaly check
    return {
        "success": True,
        "type": "anomaly_detection",
        "message": "Organization-wide anomaly detection - specify an employee for detailed analysis",
        "data": {"is_anomaly": False, "anomaly_score": 0}
    }


def _handle_top_performers(parsed: ParsedQuery) -> Dict:
    """Handle top performers intent."""
    from pulse.api.insights import get_top_bottom_performers
    
    date_range = _get_date_range(parsed.time_range)
    limit = parsed.limit or 5
    
    performers = get_top_bottom_performers(
        date=date_range["to"],
        limit=limit
    )
    
    return {
        "success": True,
        "type": "top_performers",
        "data": performers.get("top", []) if performers else []
    }


def _handle_bottom_performers(parsed: ParsedQuery) -> Dict:
    """Handle bottom performers intent."""
    from pulse.api.insights import get_top_bottom_performers
    
    date_range = _get_date_range(parsed.time_range)
    limit = parsed.limit or 5
    
    performers = get_top_bottom_performers(
        date=date_range["to"],
        limit=limit
    )
    
    return {
        "success": True,
        "type": "bottom_performers",
        "data": performers.get("bottom", []) if performers else []
    }


def _handle_compliance_check(parsed: ParsedQuery) -> Dict:
    """Handle compliance check intent."""
    from pulse.api.insights import get_completion_trend, get_template_performance
    
    date_range = _get_date_range(parsed.time_range)
    
    completion_trend = get_completion_trend(
        start_date=date_range["from"],
        end_date=date_range["to"]
    )
    
    template_perf = get_template_performance(
        start_date=date_range["from"],
        end_date=date_range["to"]
    )
    
    return {
        "success": True,
        "type": "compliance_check",
        "data": {
            "completion_trend": completion_trend,
            "template_performance": template_perf
        }
    }


def _handle_recommendations(parsed: ParsedQuery) -> Dict:
    """Handle recommendations intent."""
    from pulse.api.insights import get_score_trends
    from pulse.ai.analytics_engine import (
        generate_recommendations,
        calculate_trend_direction,
        calculate_volatility
    )
    
    date_range = _get_date_range(parsed.time_range)
    
    # Get data for recommendation generation
    trends = get_score_trends(
        start_date=date_range["from"],
        end_date=date_range["to"],
        employee=parsed.entity_id if parsed.entity_type == "employee" else None
    )
    
    scores = [t["avg_score"] for t in trends if t.get("avg_score")]
    
    patterns = {
        "trend_direction": calculate_trend_direction(scores) if scores else "stable",
        "volatility": calculate_volatility(scores) if scores else 0,
        "current_score": scores[-1] if scores else 0,
    }
    
    recommendations = generate_recommendations(patterns)
    
    return {
        "success": True,
        "type": "recommendations",
        "data": recommendations
    }


def _handle_unknown(parsed: ParsedQuery) -> Dict:
    """Handle unknown intent."""
    return {
        "success": False,
        "type": "unknown",
        "message": "I'm not sure what you're asking for. Try asking about performance, trends, comparisons, or recommendations.",
        "suggestions": [
            "Show me performance trends for last 30 days",
            "Who are the top performers this month?",
            "Compare department performance",
            "Any anomalies in compliance?"
        ]
    }


def _get_date_range(time_range: Optional[str], default_days: int = 30) -> Dict[str, str]:
    """Convert time range string to date range dict."""
    today_date = getdate(today())
    
    if time_range == "today":
        d = today_date.strftime("%Y-%m-%d")
        return {"from": d, "to": d}
    
    elif time_range == "yesterday":
        d = (today_date - timedelta(days=1)).strftime("%Y-%m-%d")
        return {"from": d, "to": d}
    
    elif time_range in ("this_week", "last_7_days"):
        from_d = (today_date - timedelta(days=6)).strftime("%Y-%m-%d")
        to_d = today_date.strftime("%Y-%m-%d")
        return {"from": from_d, "to": to_d}
    
    elif time_range == "last_week":
        end = today_date - timedelta(days=today_date.weekday() + 1)
        start = end - timedelta(days=6)
        return {"from": start.strftime("%Y-%m-%d"), "to": end.strftime("%Y-%m-%d")}
    
    elif time_range in ("this_month", "last_30_days"):
        from_d = (today_date - timedelta(days=29)).strftime("%Y-%m-%d")
        to_d = today_date.strftime("%Y-%m-%d")
        return {"from": from_d, "to": to_d}
    
    elif time_range == "last_month":
        first_this_month = today_date.replace(day=1)
        last_month_end = first_this_month - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        return {
            "from": last_month_start.strftime("%Y-%m-%d"),
            "to": last_month_end.strftime("%Y-%m-%d")
        }
    
    elif time_range == "last_90_days":
        from_d = (today_date - timedelta(days=89)).strftime("%Y-%m-%d")
        to_d = today_date.strftime("%Y-%m-%d")
        return {"from": from_d, "to": to_d}
    
    elif time_range and time_range.startswith("custom:"):
        parts = time_range.split(":")
        if len(parts) == 3:
            return {"from": parts[1], "to": parts[2]}
    
    # Default
    from_d = (today_date - timedelta(days=default_days-1)).strftime("%Y-%m-%d")
    to_d = today_date.strftime("%Y-%m-%d")
    return {"from": from_d, "to": to_d}


def _resolve_employee(identifier: str) -> Optional[str]:
    """Resolve employee identifier to actual employee ID."""
    # Try direct match
    if frappe.db.exists("Pulse Employee", identifier):
        return identifier
    
    # Try name match
    employees = frappe.get_all(
        "Pulse Employee",
        filters={"employee_name": ["like", f"%{identifier}%"]},
        pluck="name",
        limit=1
    )
    
    return employees[0] if employees else None


def get_query_suggestions(partial_text: str) -> List[Dict[str, str]]:
    """Get auto-complete suggestions for natural language queries.
    
    Args:
        partial_text: Partial query text entered by user
        
    Returns:
        List of suggestion objects with text and description
    """
    partial_lower = partial_text.lower().strip()
    suggestions = []
    
    # Intent-based suggestions
    suggestion_templates = [
        {
            "pattern": r"^(show|get|what).*",
            "suggestions": [
                {"text": "Show me performance trends for ", "description": "View performance over time"},
                {"text": "What is the compliance rate for ", "description": "Check compliance metrics"},
                {"text": "Show me top performers ", "description": "View top performers"},
            ]
        },
        {
            "pattern": r"^(who|which).*",
            "suggestions": [
                {"text": "Who are the top performers this month?", "description": "Top performer rankings"},
                {"text": "Which department has the best compliance?", "description": "Department comparison"},
                {"text": "Who is underperforming?", "description": "Bottom performers"},
            ]
        },
        {
            "pattern": r"^(compare|how).*",
            "suggestions": [
                {"text": "Compare branches performance", "description": "Branch comparison"},
                {"text": "How does John compare to team average?", "description": "Individual vs team"},
                {"text": "Compare this month to last month", "description": "Period comparison"},
            ]
        },
        {
            "pattern": r"^(any|are).*",
            "suggestions": [
                {"text": "Any anomalies in compliance this week?", "description": "Anomaly detection"},
                {"text": "Are there any issues with SOP adherence?", "description": "Compliance check"},
            ]
        },
        {
            "pattern": r"^(predict|forecast).*",
            "suggestions": [
                {"text": "Predict performance for next week", "description": "Performance forecast"},
                {"text": "Forecast compliance trends", "description": "Trend forecasting"},
            ]
        },
        {
            "pattern": r"^(recommend|suggest).*",
            "suggestions": [
                {"text": "Recommendations for improving compliance", "description": "AI recommendations"},
                {"text": "Suggest actions for underperformers", "description": "Action suggestions"},
            ]
        },
    ]
    
    for template in suggestion_templates:
        if re.search(template["pattern"], partial_lower):
            for suggestion in template["suggestions"]:
                if suggestion["text"].lower().startswith(partial_lower[:min(len(partial_lower), 10)]) or \
                   partial_lower in suggestion["text"].lower():
                    suggestions.append(suggestion)
    
    # Entity-based suggestions
    if len(partial_lower) >= 2:
        # Search for employees
        employees = frappe.get_all(
            "Pulse Employee",
            filters={"employee_name": ["like", f"%{partial_lower}%"], "is_active": 1},
            fields=["name", "employee_name"],
            limit=3
        )
        for emp in employees:
            suggestions.append({
                "text": f"Show performance for {emp.employee_name}",
                "description": f"View {emp.employee_name}'s performance",
                "entity": emp.name
            })
        
        # Search for departments
        departments = frappe.get_all(
            "Pulse Department",
            filters={"department_name": ["like", f"%{partial_lower}%"], "is_active": 1},
            fields=["name", "department_name"],
            limit=2
        )
        for dept in departments:
            suggestions.append({
                "text": f"Show {dept.department_name} department performance",
                "description": f"View {dept.department_name} metrics",
                "entity": dept.name
            })
    
    # Remove duplicates and limit
    seen = set()
    unique_suggestions = []
    for s in suggestions:
        if s["text"] not in seen:
            seen.add(s["text"])
            unique_suggestions.append(s)
    
    return unique_suggestions[:8]
