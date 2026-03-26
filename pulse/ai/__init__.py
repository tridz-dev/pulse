# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""AI Insights Engine for Pulse - Predictive analytics and intelligent recommendations."""

from pulse.ai.analytics_engine import (
    calculate_anomaly_score,
    forecast_performance,
    generate_recommendations,
    detect_compliance_patterns,
    calculate_trend_direction,
    calculate_volatility,
)

from pulse.ai.nlp_query import (
    process_natural_query,
    generate_query_response,
    get_query_suggestions,
)

__all__ = [
    "calculate_anomaly_score",
    "forecast_performance",
    "generate_recommendations",
    "detect_compliance_patterns",
    "calculate_trend_direction",
    "calculate_volatility",
    "process_natural_query",
    "generate_query_response",
    "get_query_suggestions",
]
