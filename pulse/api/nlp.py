# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Natural Language Processing API for AI-powered queries."""

import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import frappe
from frappe import _
from frappe.utils import getdate, today, add_days

from pulse.api.insights import (
    get_score_trends,
    get_department_comparison,
    get_branch_comparison,
    get_top_bottom_performers,
    get_completion_trend,
    get_corrective_action_summary,
    get_score_distribution,
    get_most_missed_items,
)
from pulse.api.permissions import _get_employee_for_user


# Query intent types
QUERY_INTENTS = {
    "show_performance": {
        "label": "Show Performance",
        "patterns": [r"show.*performance", r"display.*score", r"view.*metric", r"get.*stat"],
        "description": "Display performance metrics for branches/departments/employees",
    },
    "compare": {
        "label": "Compare",
        "patterns": [r"compare", r"versus", r"vs", r"difference.*between", r"benchmark"],
        "description": "Compare performance across time periods or entities",
    },
    "find_anomalies": {
        "label": "Find Anomalies",
        "patterns": [r"anomal", r"outlier", r"unusual", r"irregular", r"abnormal"],
        "description": "Identify unusual patterns or outliers in data",
    },
    "find_issues": {
        "label": "Find Issues",
        "patterns": [r"underperform", r"low.*score", r"problem", r"issue", r"concern", r"at risk"],
        "description": "Find underperforming branches, departments, or employees",
    },
    "predict_trend": {
        "label": "Predict/Trend",
        "patterns": [r"predict", r"forecast", r"trend", r"future", r"will.*perform", r"expect"],
        "description": "Analyze trends and predict future performance",
    },
    "list_filter": {
        "label": "List/Filter",
        "patterns": [r"list", r"show.*all", r"find.*employee", r"filter", r"search.*for"],
        "description": "List or filter employees, branches, or departments",
    },
    "ranking": {
        "label": "Ranking",
        "patterns": [r"top", r"bottom", r"best", r"worst", r"highest", r"lowest", r"rank"],
        "description": "Show top or bottom performers",
    },
}


class QueryContext:
    """Context for NLP query processing."""

    def __init__(self, user: str, timestamp: str):
        self.user = user
        self.timestamp = timestamp
        self.employee_scope = []
        self.user_role = None
        self._load_user_scope()

    def _load_user_scope(self):
        """Load employee scope for the user."""
        roles = frappe.get_roles(self.user)
        if self.user == "Administrator" or "Pulse Admin" in roles or "Pulse Executive" in roles:
            self.employee_scope = frappe.get_all("Pulse Employee", filters={"is_active": 1}, pluck="name")
            self.user_role = "Executive"
        else:
            emp = _get_employee_for_user()
            if emp:
                if "Pulse Leader" in roles:
                    from pulse.api.permissions import _get_subtree_employee_names
                    subtree = _get_subtree_employee_names(emp)
                    self.employee_scope = subtree or [emp]
                    self.user_role = "Area Manager"
                else:
                    self.employee_scope = [emp]
                    self.user_role = "Operator"


@frappe.whitelist()
def process_query(query_text: str, context: Optional[Dict] = None) -> Dict:
    """Process a natural language query and return results.
    
    Args:
        query_text: The natural language query from the user
        context: Additional context (user, timestamp, etc.)
        
    Returns:
        Dict with success status, result data, and metadata
    """
    try:
        ctx = QueryContext(
            user=context.get("user") if context else frappe.session.user,
            timestamp=context.get("timestamp") if context else datetime.now().isoformat()
        )

        if not ctx.employee_scope:
            return {
                "success": False,
                "error": "No employee access found for this user"
            }

        # Parse the query
        parsed = parse_query(query_text)
        intent = parsed.get("intent")
        entities = parsed.get("entities", {})

        # Route to appropriate handler
        result = execute_query_by_intent(intent, entities, ctx)

        # Log the query for history
        log_query(ctx.user, query_text, intent, result.get("success", False))

        return result

    except Exception as e:
        frappe.log_error("NLP Query Error", str(e))
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_suggestions(partial_query: str) -> Dict:
    """Get auto-complete suggestions for a partial query.
    
    Args:
        partial_query: The partial text the user has typed
        
    Returns:
        Dict with suggestions list
    """
    suggestions = []
    lower_query = partial_query.lower()

    # Pattern-based suggestions
    suggestion_templates = [
        {"text": "Show me underperforming branches", "category": "performance", "icon": "trending-down"},
        {"text": "Compare Q1 vs Q2 scores", "category": "comparison", "icon": "git-compare"},
        {"text": "Find employees with low completion rates", "category": "performance", "icon": "users"},
        {"text": "What are the top performing departments?", "category": "performance", "icon": "trophy"},
        {"text": "Show score trends for last 30 days", "category": "trend", "icon": "line-chart"},
        {"text": "Identify anomalies in SOP compliance", "category": "anomaly", "icon": "alert-triangle"},
        {"text": "Predict next month performance", "category": "trend", "icon": "trending-up"},
        {"text": "List all operators in {branch}", "category": "employee", "icon": "list"},
        {"text": "Show corrective actions by priority", "category": "general", "icon": "flag"},
        {"text": "Which templates have the lowest completion?", "category": "performance", "icon": "file-text"},
        {"text": "Show me branches with scores below {threshold}%", "category": "performance", "icon": "alert-circle"},
        {"text": "Compare performance between {department1} and {department2}", "category": "comparison", "icon": "bar-chart-2"},
        {"text": "Who are the top 5 performers this month?", "category": "ranking", "icon": "award"},
        {"text": "Find employees with declining scores", "category": "anomaly", "icon": "trending-down"},
        {"text": "Show completion rates by day of week", "category": "trend", "icon": "calendar"},
    ]

    # Filter and rank suggestions
    for template in suggestion_templates:
        text = template["text"].lower()
        score = 0
        
        # Exact match gets highest score
        if lower_query in text:
            score = 2
        # Word match gets medium score
        elif any(word in text for word in lower_query.split() if len(word) > 2):
            score = 1
        
        if score > 0:
            suggestions.append({
                **template,
                "score": score
            })

    # Sort by score and limit
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    
    return {
        "suggestions": suggestions[:8]
    }


@frappe.whitelist()
def get_query_history(user: Optional[str] = None, limit: int = 20) -> Dict:
    """Get query history for a user.
    
    Args:
        user: User to get history for (defaults to current user)
        limit: Maximum number of history items to return
        
    Returns:
        Dict with history list
    """
    user = user or frappe.session.user
    
    history = frappe.get_all(
        "NLP Query Log",
        filters={"user": user},
        fields=["name", "query_text", "intent", "timestamp", "success"],
        order_by="timestamp desc",
        limit=limit
    )
    
    return {
        "history": history
    }


def parse_query(query_text: str) -> Dict:
    """Parse a natural language query to extract intent and entities.
    
    Args:
        query_text: The query string
        
    Returns:
        Dict with intent and extracted entities
    """
    lower_text = query_text.lower()
    
    # Detect intent
    detected_intent = "show_performance"  # default
    intent_scores = {}
    
    for intent_key, intent_config in QUERY_INTENTS.items():
        score = 0
        for pattern in intent_config["patterns"]:
            if re.search(pattern, lower_text, re.IGNORECASE):
                score += 1
        if score > 0:
            intent_scores[intent_key] = score
    
    if intent_scores:
        detected_intent = max(intent_scores, key=intent_scores.get)
    
    # Extract entities
    entities = {
        "departments": extract_departments(query_text),
        "branches": extract_branches(query_text),
        "time_range": extract_time_range(query_text),
        "threshold": extract_threshold(query_text),
        "limit": extract_limit(query_text),
        "employees": extract_employee_references(query_text),
        "metrics": extract_metrics(query_text),
    }
    
    return {
        "intent": detected_intent,
        "entities": entities,
        "original_text": query_text
    }


def execute_query_by_intent(intent: str, entities: Dict, ctx: QueryContext) -> Dict:
    """Execute a query based on detected intent and entities.
    
    Args:
        intent: The detected query intent
        entities: Extracted entities from the query
        ctx: Query context
        
    Returns:
        Dict with query results
    """
    handlers = {
        "show_performance": handle_show_performance,
        "compare": handle_compare,
        "find_anomalies": handle_find_anomalies,
        "find_issues": handle_find_issues,
        "predict_trend": handle_predict_trend,
        "list_filter": handle_list_filter,
        "ranking": handle_ranking,
    }
    
    handler = handlers.get(intent, handle_show_performance)
    return handler(entities, ctx)


# Intent handlers

def handle_show_performance(entities: Dict, ctx: QueryContext) -> Dict:
    """Handle show_performance intent."""
    time_range = entities.get("time_range", {})
    from_date = time_range.get("from", add_days(today(), -30))
    to_date = time_range.get("to", today())
    
    # Get trends
    trends = get_score_trends(
        start_date=from_date,
        end_date=to_date,
        department=entities.get("departments"),
        branch=entities.get("branches")
    )
    
    # Get current comparison data
    dept_comparison = get_department_comparison(date=to_date)
    branch_comparison = get_branch_comparison(date=to_date)
    
    # Build summary
    summary_parts = []
    if trends:
        avg_score = sum(t.get("avg_score", 0) for t in trends) / len(trends) if trends else 0
        summary_parts.append(f"Average score over period: {avg_score:.1%}")
    if dept_comparison:
        top_dept = max(dept_comparison, key=lambda x: x.get("avg_score", 0))
        summary_parts.append(f"Top department: {top_dept.get('department')} ({top_dept.get('avg_score', 0):.1%})")
    
    return {
        "success": True,
        "result": {
            "type": "summary",
            "title": "Performance Overview",
            "summary": " | ".join(summary_parts) if summary_parts else "Performance data retrieved",
            "data": {
                "trends": trends,
                "department_comparison": dept_comparison,
                "branch_comparison": branch_comparison
            },
            "chartConfig": {
                "chartType": "line",
                "xAxis": "date",
                "yAxis": "avg_score",
                "series": ["avg_score"]
            },
            "followUpSuggestions": [
                "Show me underperforming branches",
                "Compare with last month",
                "What are the top performing departments?"
            ]
        }
    }


def handle_compare(entities: Dict, ctx: QueryContext) -> Dict:
    """Handle compare intent."""
    # Compare departments or branches
    depts = entities.get("departments", [])
    branches = entities.get("branches", [])
    
    comparison_data = []
    
    if len(depts) >= 2:
        # Compare specific departments
        for dept in depts[:2]:
            data = get_department_comparison(department=dept)
            if data:
                comparison_data.append({"department": dept, "data": data})
    elif len(branches) >= 2:
        # Compare specific branches
        for branch in branches[:2]:
            data = get_branch_comparison(branch=branch)
            if data:
                comparison_data.append({"branch": branch, "data": data})
    else:
        # Default: compare all departments
        comparison_data = get_department_comparison()
    
    return {
        "success": True,
        "result": {
            "type": "comparison",
            "title": "Performance Comparison",
            "summary": f"Comparing {len(comparison_data)} entities",
            "data": comparison_data,
            "chartConfig": {
                "chartType": "bar",
                "xAxis": "name",
                "yAxis": "avg_score"
            },
            "followUpSuggestions": [
                "Show trends over time",
                "What factors contribute to the difference?",
                "Compare with industry benchmarks"
            ]
        }
    }


def handle_find_anomalies(entities: Dict, ctx: QueryContext) -> Dict:
    """Handle find_anomalies intent."""
    # Get score distribution to find outliers
    distribution = get_score_distribution()
    
    # Find low performers
    performers = get_top_bottom_performers(limit=10)
    bottom_performers = performers.get("bottom", [])
    
    anomalies = []
    for emp in bottom_performers:
        if emp.get("combined_score", 1) < 0.5:
            anomalies.append({
                "type": "low_score",
                "employee": emp.get("employee_name"),
                "score": emp.get("combined_score"),
                "department": emp.get("department"),
                "branch": emp.get("branch")
            })
    
    summary = f"Found {len(anomalies)} potential anomalies" if anomalies else "No significant anomalies detected"
    
    return {
        "success": True,
        "result": {
            "type": "anomaly",
            "title": "Anomaly Detection",
            "summary": summary,
            "data": {
                "anomalies": anomalies,
                "distribution": distribution
            },
            "chartConfig": {
                "chartType": "pie",
                "series": ["count"]
            },
            "followUpSuggestions": [
                "Why are these anomalies occurring?",
                "Show corrective actions for these employees",
                "Compare with their historical performance"
            ]
        }
    }


def handle_find_issues(entities: Dict, ctx: QueryContext) -> Dict:
    """Handle find_issues intent - find underperforming entities."""
    threshold = entities.get("threshold", 0.7)  # Default 70%
    
    # Get branch comparison
    branches = get_branch_comparison()
    underperforming = [b for b in branches if b.get("avg_score", 1) < threshold]
    
    # Get corrective actions
    ca_summary = get_corrective_action_summary()
    open_cas = [ca for ca in ca_summary.get("by_status", []) if ca.get("status") in ["Open", "In Progress"]]
    
    # Get most missed items
    missed_items = get_most_missed_items(limit=5)
    
    summary = f"Found {len(underperforming)} branches with scores below {threshold:.0%}"
    
    return {
        "success": True,
        "result": {
            "type": "table",
            "title": "Issues & Underperformance",
            "summary": summary,
            "data": {
                "underperforming_branches": underperforming,
                "open_corrective_actions": open_cas,
                "most_missed_items": missed_items
            },
            "chartConfig": {
                "chartType": "bar",
                "xAxis": "branch",
                "yAxis": "avg_score"
            },
            "followUpSuggestions": [
                "What corrective actions are needed?",
                "Show historical trend for these branches",
                "Compare with best performing branches"
            ]
        }
    }


def handle_predict_trend(entities: Dict, ctx: QueryContext) -> Dict:
    """Handle predict_trend intent."""
    time_range = entities.get("time_range", {})
    from_date = time_range.get("from", add_days(today(), -60))
    to_date = time_range.get("to", today())
    
    # Get historical trends
    trends = get_score_trends(
        start_date=from_date,
        end_date=to_date,
        period_type="Day"
    )
    
    # Simple linear projection
    if len(trends) >= 7:
        recent = trends[-7:]  # Last 7 days
        avg_recent = sum(t.get("avg_score", 0) for t in recent) / len(recent)
        
        # Calculate trend direction
        first_half = trends[:len(trends)//2]
        second_half = trends[len(trends)//2:]
        avg_first = sum(t.get("avg_score", 0) for t in first_half) / len(first_half) if first_half else 0
        avg_second = sum(t.get("avg_score", 0) for t in second_half) / len(second_half) if second_half else 0
        
        trend_direction = "improving" if avg_second > avg_first else "declining"
        trend_change = abs(avg_second - avg_first)
        
        # Project next 30 days
        projected_score = avg_recent + (trend_change if trend_direction == "improving" else -trend_change)
        projected_score = max(0, min(1, projected_score))  # Clamp between 0 and 1
        
        summary = f"Performance is {trend_direction}. Projected 30-day average: {projected_score:.1%}"
    else:
        summary = "Insufficient data for prediction. Need at least 7 days of data."
    
    return {
        "success": True,
        "result": {
            "type": "prediction",
            "title": "Performance Prediction",
            "summary": summary,
            "data": {
                "historical_trends": trends,
                "projection": {
                    "direction": trend_direction if len(trends) >= 7 else "unknown",
                    "projected_score": projected_score if len(trends) >= 7 else None
                }
            },
            "chartConfig": {
                "chartType": "line",
                "xAxis": "date",
                "yAxis": "avg_score"
            },
            "followUpSuggestions": [
                "What factors are driving this trend?",
                "How can we improve the projection?",
                "Show confidence intervals"
            ]
        }
    }


def handle_list_filter(entities: Dict, ctx: QueryContext) -> Dict:
    """Handle list_filter intent."""
    filters = {"is_active": 1}
    
    if entities.get("departments"):
        filters["department"] = ["in", entities["departments"]]
    if entities.get("branches"):
        filters["branch"] = ["in", entities["branches"]]
    
    # Apply scope
    if ctx.employee_scope:
        filters["name"] = ["in", ctx.employee_scope]
    
    employees = frappe.get_all(
        "Pulse Employee",
        filters=filters,
        fields=["name", "employee_name", "pulse_role", "department", "branch", "user"],
        limit=entities.get("limit", 50)
    )
    
    # Enrich with scores
    today_str = today()
    for emp in employees:
        from pulse.api.scores import _calculate_score_snapshot
        score_data = _calculate_score_snapshot(emp["name"], today_str, "Day")
        emp["combined_score"] = score_data.get("combined_score")
        emp["completion_rate"] = score_data.get("completion_rate")
    
    summary = f"Found {len(employees)} employees matching criteria"
    
    return {
        "success": True,
        "result": {
            "type": "table",
            "title": "Employee List",
            "summary": summary,
            "data": employees,
            "chartConfig": None,
            "followUpSuggestions": [
                "Show performance details for these employees",
                "Export this list",
                "Compare with previous period"
            ]
        }
    }


def handle_ranking(entities: Dict, ctx: QueryContext) -> Dict:
    """Handle ranking intent - top/bottom performers."""
    limit = entities.get("limit", 5)
    
    performers = get_top_bottom_performers(limit=limit)
    
    top = performers.get("top", [])
    bottom = performers.get("bottom", [])
    
    summary = f"Top {len(top)} and bottom {len(bottom)} performers identified"
    
    return {
        "success": True,
        "result": {
            "type": "table",
            "title": "Performance Rankings",
            "summary": summary,
            "data": performers,
            "chartConfig": {
                "chartType": "bar",
                "series": ["combined_score"]
            },
            "followUpSuggestions": [
                "What makes the top performers successful?",
                "Show trends for top performers",
                "Compare top vs bottom in detail"
            ]
        }
    }


# Entity extraction helpers

def extract_departments(text: str) -> List[str]:
    """Extract department names from query."""
    # Get all departments
    all_depts = frappe.get_all("Pulse Department", filters={"is_active": 1}, pluck="department_name")
    found = []
    lower_text = text.lower()
    for dept in all_depts:
        if dept.lower() in lower_text:
            found.append(dept)
    return found


def extract_branches(text: str) -> List[str]:
    """Extract branch names from query."""
    # Get distinct branches from employees
    branches = frappe.db.sql(
        "SELECT DISTINCT NULLIF(TRIM(branch), '') as branch FROM `tabPulse Employee` WHERE is_active = 1 AND branch IS NOT NULL",
        as_dict=True
    )
    branch_names = [b["branch"] for b in branches if b["branch"]]
    found = []
    lower_text = text.lower()
    for branch in branch_names:
        if branch.lower() in lower_text:
            found.append(branch)
    return found


def extract_time_range(text: str) -> Dict:
    """Extract time range from query."""
    result = {}
    lower_text = text.lower()
    
    # Look for date patterns
    today_date = getdate()
    
    # Last N days
    match = re.search(r'last\s+(\d+)\s+days?', lower_text)
    if match:
        days = int(match.group(1))
        result["from"] = add_days(today_date, -days).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
        return result
    
    # Specific periods
    if "last month" in lower_text or "previous month" in lower_text:
        result["from"] = add_days(today_date, -30).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
    elif "last week" in lower_text:
        result["from"] = add_days(today_date, -7).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
    elif "this month" in lower_text:
        result["from"] = today_date.replace(day=1).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
    elif "q1" in lower_text:
        result["period"] = "Q1"
    elif "q2" in lower_text:
        result["period"] = "Q2"
    elif "q3" in lower_text:
        result["period"] = "Q3"
    elif "q4" in lower_text:
        result["period"] = "Q4"
    
    return result


def extract_threshold(text: str) -> Optional[float]:
    """Extract threshold percentage from query."""
    # Look for patterns like "below 70%", "under 80 percent"
    match = re.search(r'(?:below|under|less than)\s+(\d+)(?:%|\s*percent)', text.lower())
    if match:
        return float(match.group(1)) / 100
    
    # Look for patterns like "above 90%"
    match = re.search(r'(?:above|over|more than)\s+(\d+)(?:%|\s*percent)', text.lower())
    if match:
        return float(match.group(1)) / 100
    
    return None


def extract_limit(text: str) -> int:
    """Extract limit number from query."""
    # Look for "top 5", "bottom 10", etc.
    match = re.search(r'(?:top|bottom)\s+(\d+)', text.lower())
    if match:
        return min(int(match.group(1)), 50)  # Cap at 50
    return 10


def extract_employee_references(text: str) -> List[str]:
    """Extract employee name references from query."""
    # This is a simplified version - in production, might use NER
    return []


def extract_metrics(text: str) -> List[str]:
    """Extract metric types from query."""
    metrics = []
    lower_text = text.lower()
    
    metric_keywords = {
        "score": ["score", "performance", "rating"],
        "completion": ["completion", "done", "finished"],
        "timeliness": ["time", "timely", "late", "on time"],
        "quality": ["quality", "accuracy", "error"]
    }
    
    for metric, keywords in metric_keywords.items():
        if any(kw in lower_text for kw in keywords):
            metrics.append(metric)
    
    return metrics


def log_query(user: str, query_text: str, intent: str, success: bool):
    """Log query to history."""
    try:
        # Check if DocType exists
        if frappe.db.exists("DocType", "NLP Query Log"):
            doc = frappe.get_doc({
                "doctype": "NLP Query Log",
                "user": user,
                "query_text": query_text,
                "intent": intent,
                "timestamp": datetime.now(),
                "success": 1 if success else 0
            })
            doc.insert(ignore_permissions=True)
    except Exception:
        # Silently ignore logging errors
        pass
