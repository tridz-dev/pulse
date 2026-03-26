# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Query parsing logic for Natural Language Processing.

This module handles:
- Intent classification from natural language queries
- Entity extraction (dates, metrics, filters, thresholds)
- Query template matching
- SQL/query builder generation
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple

import frappe
from frappe.utils import getdate, today, add_days


class QueryIntent(Enum):
    """Supported query intent types."""
    SHOW_PERFORMANCE = "show_performance"
    COMPARE = "compare"
    FIND_ANOMALIES = "find_anomalies"
    FIND_ISSUES = "find_issues"
    PREDICT_TREND = "predict_trend"
    LIST_FILTER = "list_filter"
    RANKING = "ranking"
    SUMMARY = "summary"
    UNKNOWN = "unknown"


@dataclass
class QueryEntity:
    """Represents an extracted entity from a query."""
    type: str
    value: Any
    confidence: float = 1.0
    raw_text: str = ""


@dataclass
class ParsedQuery:
    """Result of parsing a natural language query."""
    original_text: str
    intent: QueryIntent
    intent_confidence: float
    entities: List[QueryEntity] = field(default_factory=list)
    time_range: Dict[str, Any] = field(default_factory=dict)
    filters: Dict[str, Any] = field(default_factory=dict)
    metrics: List[str] = field(default_factory=list)
    sort_order: Optional[Tuple[str, str]] = None  # (field, direction)
    limit: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "original_text": self.original_text,
            "intent": self.intent.value,
            "intent_confidence": self.intent_confidence,
            "entities": [
                {"type": e.type, "value": e.value, "confidence": e.confidence}
                for e in self.entities
            ],
            "time_range": self.time_range,
            "filters": self.filters,
            "metrics": self.metrics,
            "sort_order": self.sort_order,
            "limit": self.limit,
        }


class QueryParser:
    """Main query parser for natural language queries."""
    
    # Intent detection patterns with weights
    INTENT_PATTERNS = {
        QueryIntent.SHOW_PERFORMANCE: {
            "patterns": [
                r"show.*performance",
                r"display.*score",
                r"view.*metric",
                r"get.*stat",
                r"how.*(is|are).*performing",
                r"what.*(is|are).*score",
                r"performance.*of",
            ],
            "weight": 1.0,
        },
        QueryIntent.COMPARE: {
            "patterns": [
                r"compare",
                r"versus",
                r"\bvs\b",
                r"difference.*between",
                r"benchmark",
                r"how.*(does|do).*compare",
            ],
            "weight": 1.2,  # Slightly higher weight for explicit comparison
        },
        QueryIntent.FIND_ANOMALIES: {
            "patterns": [
                r"anomal",
                r"outlier",
                r"unusual",
                r"irregular",
                r"abnormal",
                r"strange",
                r"unexpected",
            ],
            "weight": 1.0,
        },
        QueryIntent.FIND_ISSUES: {
            "patterns": [
                r"underperform",
                r"low.*score",
                r"problem",
                r"issue",
                r"concern",
                r"at risk",
                r"struggling",
                r"poor.*performance",
                r"below.*target",
            ],
            "weight": 1.0,
        },
        QueryIntent.PREDICT_TREND: {
            "patterns": [
                r"predict",
                r"forecast",
                r"trend",
                r"future",
                r"will.*perform",
                r"expect",
                r"project",
                r"estimate",
                r"next.*month",
                r"coming.*week",
            ],
            "weight": 1.0,
        },
        QueryIntent.LIST_FILTER: {
            "patterns": [
                r"\blist\b",
                r"show.*all",
                r"find.*employee",
                r"filter",
                r"search.*for",
                r"who.*(is|are)",
                r"which.*(employees?|branches?|departments?)",
            ],
            "weight": 1.0,
        },
        QueryIntent.RANKING: {
            "patterns": [
                r"\btop\b",
                r"\bbottom\b",
                r"best",
                r"worst",
                r"highest",
                r"lowest",
                r"\brank\b",
                r"leaderboard",
            ],
            "weight": 1.1,
        },
        QueryIntent.SUMMARY: {
            "patterns": [
                r"summarize",
                r"overview",
                r"summary",
                r"tell me about",
                r"what.*happened",
            ],
            "weight": 1.0,
        },
    }
    
    # Entity extraction patterns
    METRIC_PATTERNS = {
        "score": [r"score", r"performance", r"rating", r"grade"],
        "completion": [r"completion", r"done", r"finished", r"accomplished"],
        "timeliness": [r"time", r"timely", r"late", r"on time", r"punctual"],
        "quality": [r"quality", r"accuracy", r"error", r"mistake", r"defect"],
        "compliance": [r"compliance", r"adherence", r"following", r"conformance"],
    }
    
    TIME_PATTERNS = {
        "today": r"\btoday\b",
        "yesterday": r"\byesterday\b",
        "this_week": r"this\s+week",
        "last_week": r"last\s+week",
        "this_month": r"this\s+month",
        "last_month": r"last\s+month",
        "this_quarter": r"this\s+(?:quarter|q)\s*(\d)?",
        "last_quarter": r"last\s+(?:quarter|q)\s*(\d)?",
        "last_n_days": r"last\s+(\d+)\s+days?",
        "last_n_weeks": r"last\s+(\d+)\s+weeks?",
        "last_n_months": r"last\s+(\d+)\s+months?",
        "q1": r"\bq1\b|\bfirst\s+quarter\b",
        "q2": r"\bq2\b|\bsecond\s+quarter\b",
        "q3": r"\bq3\b|\bthird\s+quarter\b",
        "q4": r"\bq4\b|\bfourth\s+quarter\b",
    }
    
    def __init__(self):
        """Initialize the parser with compiled patterns."""
        self._compiled_patterns = {}
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for performance."""
        for intent, config in self.INTENT_PATTERNS.items():
            self._compiled_patterns[intent] = [
                re.compile(pattern, re.IGNORECASE)
                for pattern in config["patterns"]
            ]
    
    def parse(self, query_text: str) -> ParsedQuery:
        """Parse a natural language query.
        
        Args:
            query_text: The natural language query string
            
        Returns:
            ParsedQuery object with intent, entities, and filters
        """
        if not query_text or not query_text.strip():
            return ParsedQuery(
                original_text="",
                intent=QueryIntent.UNKNOWN,
                intent_confidence=0.0
            )
        
        original_text = query_text.strip()
        lower_text = original_text.lower()
        
        # Detect intent
        intent, confidence = self._detect_intent(lower_text)
        
        # Extract entities
        entities = self._extract_entities(original_text, lower_text)
        
        # Extract time range
        time_range = extract_time_range(original_text)
        
        # Extract filters
        filters = {
            "departments": extract_departments(original_text),
            "branches": extract_branches(original_text),
        }
        
        # Extract metrics
        metrics = extract_metrics(original_text)
        
        # Extract limit
        limit = extract_limit(original_text)
        
        # Extract threshold for filtering
        threshold = extract_threshold(original_text)
        if threshold is not None:
            filters["threshold"] = threshold
        
        return ParsedQuery(
            original_text=original_text,
            intent=intent,
            intent_confidence=confidence,
            entities=entities,
            time_range=time_range,
            filters=filters,
            metrics=metrics,
            limit=limit
        )
    
    def _detect_intent(self, lower_text: str) -> Tuple[QueryIntent, float]:
        """Detect the intent from query text.
        
        Args:
            lower_text: Lowercase query text
            
        Returns:
            Tuple of (detected intent, confidence score)
        """
        scores = {}
        
        for intent, patterns in self._compiled_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(pattern.findall(lower_text))
                score += matches
            
            if score > 0:
                # Apply intent weight
                weight = self.INTENT_PATTERNS[intent]["weight"]
                scores[intent] = score * weight
        
        if not scores:
            return QueryIntent.UNKNOWN, 0.0
        
        # Get highest scoring intent
        best_intent = max(scores, key=scores.get)
        max_score = scores[best_intent]
        
        # Normalize confidence (rough estimation)
        confidence = min(1.0, max_score / 2.0)
        
        return best_intent, confidence
    
    def _extract_entities(self, text: str, lower_text: str) -> List[QueryEntity]:
        """Extract entities from query text.
        
        Args:
            text: Original query text
            lower_text: Lowercase query text
            
        Returns:
            List of extracted entities
        """
        entities = []
        
        # Extract employee references
        employee_refs = extract_employee_references(text)
        for ref in employee_refs:
            entities.append(QueryEntity(
                type="employee",
                value=ref,
                raw_text=ref
            ))
        
        # Extract department references
        dept_refs = extract_departments(text)
        for dept in dept_refs:
            entities.append(QueryEntity(
                type="department",
                value=dept,
                raw_text=dept
            ))
        
        # Extract branch references
        branch_refs = extract_branches(text)
        for branch in branch_refs:
            entities.append(QueryEntity(
                type="branch",
                value=branch,
                raw_text=branch
            ))
        
        return entities
    
    def generate_sql(self, parsed: ParsedQuery) -> Optional[str]:
        """Generate SQL query from parsed query.
        
        Args:
            parsed: The parsed query object
            
        Returns:
            SQL query string or None if not applicable
        """
        # This is a simplified SQL generator
        # In production, this would be more sophisticated
        
        base_query = "SELECT * FROM `tabScore Snapshot` WHERE 1=1"
        conditions = []
        
        # Add time range filter
        if parsed.time_range.get("from"):
            conditions.append(f"period_key >= '{parsed.time_range['from']}'")
        if parsed.time_range.get("to"):
            conditions.append(f"period_key <= '{parsed.time_range['to']}'")
        
        # Add department filter
        if parsed.filters.get("departments"):
            depts = parsed.filters["departments"]
            if len(depts) == 1:
                conditions.append(f"department = '{depts[0]}'")
            else:
                dept_list = ", ".join([f"'{d}'" for d in depts])
                conditions.append(f"department IN ({dept_list})")
        
        # Add threshold filter
        if parsed.filters.get("threshold"):
            threshold = parsed.filters["threshold"]
            conditions.append(f"combined_score < {threshold}")
        
        # Build final query
        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        # Add sorting
        if parsed.sort_order:
            field, direction = parsed.sort_order
            base_query += f" ORDER BY {field} {direction}"
        
        # Add limit
        if parsed.limit:
            base_query += f" LIMIT {parsed.limit}"
        
        return base_query


# Convenience function for direct parsing
def parse_query(query_text: str) -> ParsedQuery:
    """Parse a natural language query.
    
    Args:
        query_text: The natural language query string
        
    Returns:
        ParsedQuery object
    """
    parser = QueryParser()
    return parser.parse(query_text)


# Entity extraction functions

def extract_departments(text: str) -> List[str]:
    """Extract department names from query text.
    
    Args:
        text: The query text
        
    Returns:
        List of department names found
    """
    try:
        all_depts = frappe.get_all(
            "Pulse Department", 
            filters={"is_active": 1}, 
            pluck="department_name"
        )
    except Exception:
        return []
    
    found = []
    lower_text = text.lower()
    
    for dept in all_depts:
        if dept.lower() in lower_text:
            found.append(dept)
    
    return found


def extract_branches(text: str) -> List[str]:
    """Extract branch names from query text.
    
    Args:
        text: The query text
        
    Returns:
        List of branch names found
    """
    try:
        branches = frappe.db.sql(
            """SELECT DISTINCT NULLIF(TRIM(branch), '') as branch 
               FROM `tabPulse Employee` 
               WHERE is_active = 1 AND branch IS NOT NULL""",
            as_dict=True
        )
        branch_names = [b["branch"] for b in branches if b["branch"]]
    except Exception:
        return []
    
    found = []
    lower_text = text.lower()
    
    for branch in branch_names:
        if branch.lower() in lower_text:
            found.append(branch)
    
    return found


def extract_time_range(text: str) -> Dict[str, Any]:
    """Extract time range from query text.
    
    Args:
        text: The query text
        
    Returns:
        Dictionary with 'from', 'to', and 'period_type' keys
    """
    result = {}
    lower_text = text.lower()
    today_date = getdate()
    
    # Last N days
    match = re.search(r'last\s+(\d+)\s+days?', lower_text)
    if match:
        days = int(match.group(1))
        result["from"] = add_days(today_date, -days).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
        result["period_type"] = "Day"
        return result
    
    # Last N weeks
    match = re.search(r'last\s+(\d+)\s+weeks?', lower_text)
    if match:
        weeks = int(match.group(1))
        result["from"] = add_days(today_date, -weeks * 7).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
        result["period_type"] = "Week"
        return result
    
    # Last N months
    match = re.search(r'last\s+(\d+)\s+months?', lower_text)
    if match:
        months = int(match.group(1))
        # Approximate months as 30 days each
        result["from"] = add_days(today_date, -months * 30).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
        result["period_type"] = "Month"
        return result
    
    # Specific time periods
    if "yesterday" in lower_text:
        result["from"] = add_days(today_date, -1).strftime("%Y-%m-%d")
        result["to"] = result["from"]
        result["period_type"] = "Day"
    elif "today" in lower_text:
        result["from"] = today_date.strftime("%Y-%m-%d")
        result["to"] = result["from"]
        result["period_type"] = "Day"
    elif "last week" in lower_text:
        result["from"] = add_days(today_date, -7).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
        result["period_type"] = "Week"
    elif "this week" in lower_text:
        # Assume week starts on Monday
        days_since_monday = today_date.weekday()
        result["from"] = add_days(today_date, -days_since_monday).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
        result["period_type"] = "Week"
    elif "last month" in lower_text or "previous month" in lower_text:
        result["from"] = add_days(today_date, -30).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
        result["period_type"] = "Month"
    elif "this month" in lower_text:
        result["from"] = today_date.replace(day=1).strftime("%Y-%m-%d")
        result["to"] = today_date.strftime("%Y-%m-%d")
        result["period_type"] = "Month"
    # Quarter patterns
    elif re.search(r'\bq1\b', lower_text):
        result["period"] = "Q1"
        result["period_type"] = "Month"
    elif re.search(r'\bq2\b', lower_text):
        result["period"] = "Q2"
        result["period_type"] = "Month"
    elif re.search(r'\bq3\b', lower_text):
        result["period"] = "Q3"
        result["period_type"] = "Month"
    elif re.search(r'\bq4\b', lower_text):
        result["period"] = "Q4"
        result["period_type"] = "Month"
    
    return result


def extract_threshold(text: str) -> Optional[float]:
    """Extract threshold percentage from query text.
    
    Args:
        text: The query text
        
    Returns:
        Threshold value as decimal (e.g., 0.7 for 70%) or None
    """
    lower_text = text.lower()
    
    # Pattern: below/under/less than X%
    match = re.search(r'(?:below|under|less than)\s+(\d+(?:\.\d+)?)(?:%|\s*percent)', lower_text)
    if match:
        return float(match.group(1)) / 100
    
    # Pattern: above/over/more than X%
    match = re.search(r'(?:above|over|more than)\s+(\d+(?:\.\d+)?)(?:%|\s*percent)', lower_text)
    if match:
        return float(match.group(1)) / 100
    
    # Pattern: X% or lower/higher
    match = re.search(r'(\d+(?:\.\d+)?)(?:%|\s*percent)\s+(?:or\s+)?(?:lower|or\s+less)', lower_text)
    if match:
        return float(match.group(1)) / 100
    
    match = re.search(r'(\d+(?:\.\d+)?)(?:%|\s*percent)\s+(?:or\s+)?(?:higher|or\s+more)', lower_text)
    if match:
        return float(match.group(1)) / 100
    
    return None


def extract_limit(text: str) -> int:
    """Extract limit number from query text.
    
    Args:
        text: The query text
        
    Returns:
        Limit number (capped at 50)
    """
    lower_text = text.lower()
    
    # Pattern: top/bottom N
    match = re.search(r'(?:top|bottom)\s+(\d+)', lower_text)
    if match:
        return min(int(match.group(1)), 50)
    
    # Pattern: first/last N
    match = re.search(r'(?:first|last)\s+(\d+)', lower_text)
    if match:
        return min(int(match.group(1)), 50)
    
    # Pattern: show N results/records
    match = re.search(r'show\s+(\d+)\s+(?:result|record|item)', lower_text)
    if match:
        return min(int(match.group(1)), 50)
    
    return 10  # Default limit


def extract_employee_references(text: str) -> List[str]:
    """Extract employee name references from query text.
    
    Args:
        text: The query text
        
    Returns:
        List of potential employee name references
    """
    # This is a simplified version
    # In production, this could use NER (Named Entity Recognition)
    # or fuzzy matching against the employee database
    
    references = []
    
    # Look for quoted names
    quoted = re.findall(r'["\']([^"\']+)["\']', text)
    references.extend(quoted)
    
    # Look for names after "employee" or "operator"
    patterns = [
        r'(?:employee|operator)\s+(?:named?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        r'(?:for|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        references.extend(matches)
    
    return list(set(references))  # Remove duplicates


def extract_metrics(text: str) -> List[str]:
    """Extract metric types from query text.
    
    Args:
        text: The query text
        
    Returns:
        List of metric types found
    """
    metrics = []
    lower_text = text.lower()
    
    metric_keywords = {
        "score": ["score", "performance", "rating", "grade"],
        "completion": ["completion", "done", "finished", "accomplished", "completion rate"],
        "timeliness": ["time", "timely", "late", "on time", "punctual", "deadline"],
        "quality": ["quality", "accuracy", "error", "mistake", "defect"],
        "compliance": ["compliance", "adherence", "following", "conformance", "sop"],
    }
    
    for metric, keywords in metric_keywords.items():
        if any(kw in lower_text for kw in keywords):
            metrics.append(metric)
    
    return metrics


def build_query_from_intent(intent: QueryIntent, parsed: ParsedQuery) -> Dict[str, Any]:
    """Build a structured query from parsed intent and entities.
    
    Args:
        intent: The detected query intent
        parsed: The parsed query object
        
    Returns:
        Dictionary with query configuration
    """
    query_config = {
        "intent": intent.value,
        "api_endpoint": None,
        "params": {},
    }
    
    # Map intents to API endpoints
    intent_mapping = {
        QueryIntent.SHOW_PERFORMANCE: "pulse.api.insights.get_score_trends",
        QueryIntent.COMPARE: "pulse.api.insights.get_department_comparison",
        QueryIntent.FIND_ANOMALIES: "pulse.api.insights.get_score_distribution",
        QueryIntent.FIND_ISSUES: "pulse.api.insights.get_top_bottom_performers",
        QueryIntent.PREDICT_TREND: "pulse.api.insights.get_score_trends",
        QueryIntent.LIST_FILTER: "pulse.api.insights.get_top_bottom_performers",
        QueryIntent.RANKING: "pulse.api.insights.get_top_bottom_performers",
    }
    
    query_config["api_endpoint"] = intent_mapping.get(intent)
    
    # Build params based on intent
    params = {}
    
    if parsed.time_range.get("from"):
        params["start_date"] = parsed.time_range["from"]
    if parsed.time_range.get("to"):
        params["end_date"] = parsed.time_range["to"]
    if parsed.filters.get("departments"):
        params["department"] = parsed.filters["departments"][0]  # API expects single dept
    if parsed.filters.get("branches"):
        params["branch"] = parsed.filters["branches"][0]  # API expects single branch
    if parsed.limit:
        params["limit"] = parsed.limit
    
    query_config["params"] = params
    
    return query_config


# Query template matching
QUERY_TEMPLATES = [
    {
        "template": "show me {metric} for {time_period}",
        "intent": QueryIntent.SHOW_PERFORMANCE,
        "extractors": {
            "metric": ["score", "performance", "completion"],
            "time_period": ["today", "this week", "this month", "last week", "last month"],
        }
    },
    {
        "template": "compare {entity1} vs {entity2}",
        "intent": QueryIntent.COMPARE,
        "extractors": {
            "entity1": "department|branch",
            "entity2": "department|branch",
        }
    },
    {
        "template": "top {n} {entity_type}",
        "intent": QueryIntent.RANKING,
        "extractors": {
            "n": r"\d+",
            "entity_type": ["employees", "branches", "departments"],
        }
    },
]


def match_template(query_text: str) -> Optional[Dict[str, Any]]:
    """Match query against known templates.
    
    Args:
        query_text: The query text
        
    Returns:
        Matched template configuration or None
    """
    lower_text = query_text.lower()
    
    for template in QUERY_TEMPLATES:
        # Simple keyword matching for now
        # Could be enhanced with more sophisticated NLP
        template_lower = template["template"].lower()
        
        # Check if key terms match
        key_terms = ["show", "compare", "top", "bottom", "list"]
        if any(term in lower_text and term in template_lower for term in key_terms):
            return template
    
    return None
