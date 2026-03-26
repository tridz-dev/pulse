# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Cache warming system for Pulse application.

Pre-loads frequently accessed data into cache to improve response times
and reduce database load. Includes scheduled warming jobs and manual
warmup triggers.

Example:
    from pulse.cache.cache_warmer import warm_dashboard_cache, schedule_warmup
    
    # Manual warmup
    warm_dashboard_cache()
    warm_employee_cache()
    
    # Schedule recurring warmup via Frappe scheduler
    schedule_warmup()
"""

from __future__ import annotations

import frappe
from frappe.utils import today, add_days, now
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime

from pulse.cache.redis_cache import cache
from pulse.cache.query_cache import query_cache, cached_count, cached_get_all


def warm_dashboard_cache() -> Dict[str, Any]:
    """Pre-load dashboard data into cache.
    
    Warms:
    - Score trends for current period
    - Employee counts by branch/department
    - SOP completion statistics
    - Alert counts
    
    Returns:
        Statistics about warming operation
    """
    warmed = []
    failed = []
    
    try:
        # Warm score trends
        current_date = today()
        start_date = add_days(current_date, -30)
        
        # Import here to avoid circular dependencies
        from pulse.api.insights import get_score_trends
        
        # Organization-wide trends
        try:
            trends = get_score_trends(
                start_date=start_date,
                end_date=current_date,
                period_type="Day"
            )
            if trends:
                cache.set("dashboard:trends:org", trends, ttl=300)
                warmed.append("dashboard:trends:org")
        except Exception as e:
            failed.append(("dashboard:trends:org", str(e)))
        
        # Warm completion trends
        from pulse.api.insights import get_completion_trend
        
        try:
            completion = get_completion_trend(
                start_date=start_date,
                end_date=current_date
            )
            if completion:
                cache.set("dashboard:completion:org", completion, ttl=300)
                warmed.append("dashboard:completion:org")
        except Exception as e:
            failed.append(("dashboard:completion:org", str(e)))
        
        # Warm employee counts
        try:
            emp_count = cached_count("Pulse Employee", {"is_active": 1}, ttl=600)
            cache.set("dashboard:employee_count", emp_count, ttl=600)
            warmed.append("dashboard:employee_count")
        except Exception as e:
            failed.append(("dashboard:employee_count", str(e)))
        
        # Warm SOP template counts
        try:
            template_count = cached_count("SOP Template", {"is_active": 1}, ttl=600)
            cache.set("dashboard:template_count", template_count, ttl=600)
            warmed.append("dashboard:template_count")
        except Exception as e:
            failed.append(("dashboard:template_count", str(e)))
        
        # Warm open runs count
        try:
            open_runs = cached_count("SOP Run", {"status": "Open"}, ttl=60)
            cache.set("dashboard:open_runs", open_runs, ttl=60)
            warmed.append("dashboard:open_runs")
        except Exception as e:
            failed.append(("dashboard:open_runs", str(e)))
        
        # Warm branch and department lists
        try:
            branches = cached_get_all(
                "Pulse Branch",
                fields=["name", "branch_name", "region"],
                filters={"is_active": 1},
                ttl=600
            )
            cache.set("dashboard:branches", branches, ttl=600)
            warmed.append("dashboard:branches")
        except Exception as e:
            failed.append(("dashboard:branches", str(e)))
        
        try:
            departments = cached_get_all(
                "Pulse Department",
                fields=["name", "department_name"],
                ttl=600
            )
            cache.set("dashboard:departments", departments, ttl=600)
            warmed.append("dashboard:departments")
        except Exception as e:
            failed.append(("dashboard:departments", str(e)))
        
    except Exception as e:
        frappe.log_error("Cache Warmer Dashboard Error", str(e))
    
    return {
        "warmed": warmed,
        "failed": failed,
        "total": len(warmed) + len(failed),
        "timestamp": now()
    }


def warm_employee_cache() -> Dict[str, Any]:
    """Pre-load employee-related data into cache.
    
    Warms:
    - Active employee lists by branch
    - Employee hierarchy data
    - Role-based employee groups
    
    Returns:
        Statistics about warming operation
    """
    warmed = []
    failed = []
    
    try:
        # Warm employee lists by branch
        branches = frappe.get_all("Pulse Branch", filters={"is_active": 1}, pluck="name")
        
        for branch in branches:
            try:
                employees = cached_get_all(
                    "Pulse Employee",
                    fields=["name", "employee_name", "pulse_role", "user", "avatar_url"],
                    filters={"branch": branch, "is_active": 1},
                    ttl=300
                )
                cache_key = f"employees:branch:{branch}"
                cache.set(cache_key, employees, ttl=300)
                warmed.append(cache_key)
            except Exception as e:
                failed.append((f"employees:branch:{branch}", str(e)))
        
        # Warm employee options for dropdowns
        try:
            from pulse.api.employees import get_employee_options
            emp_options = get_employee_options()
            cache.set("employees:options:all", emp_options, ttl=600)
            warmed.append("employees:options:all")
        except Exception as e:
            failed.append(("employees:options:all", str(e)))
        
        # Warm role-based lists
        roles = ["Executive", "Area Manager", "Supervisor", "Operator"]
        for role in roles:
            try:
                role_employees = cached_get_all(
                    "Pulse Employee",
                    fields=["name", "employee_name", "branch", "department"],
                    filters={"pulse_role": role, "is_active": 1},
                    ttl=300
                )
                cache_key = f"employees:role:{role}"
                cache.set(cache_key, role_employees, ttl=300)
                warmed.append(cache_key)
            except Exception as e:
                failed.append((f"employees:role:{role}", str(e)))
        
    except Exception as e:
        frappe.log_error("Cache Warmer Employee Error", str(e))
    
    return {
        "warmed": warmed,
        "failed": failed,
        "total": len(warmed) + len(failed),
        "timestamp": now()
    }


def warm_analytics_cache() -> Dict[str, Any]:
    """Pre-load analytics data into cache.
    
    Warms:
    - Performance metrics
    - Anomaly detection results
    - Compliance statistics
    
    Returns:
        Statistics about warming operation
    """
    warmed = []
    failed = []
    
    try:
        from pulse.api.ai_insights import get_predictive_alerts, get_ai_dashboard_summary
        
        # Warm predictive alerts
        try:
            alerts = get_predictive_alerts()
            if alerts.get("success"):
                cache.set("analytics:predictive_alerts", alerts, ttl=300)
                warmed.append("analytics:predictive_alerts")
        except Exception as e:
            failed.append(("analytics:predictive_alerts", str(e)))
        
        # Warm AI dashboard summary
        try:
            summary = get_ai_dashboard_summary()
            if summary.get("success"):
                cache.set("analytics:ai_summary", summary, ttl=300)
                warmed.append("analytics:ai_summary")
        except Exception as e:
            failed.append(("analytics:ai_summary", str(e)))
        
        # Warm top/bottom performers
        try:
            from pulse.api.insights import get_top_bottom_performers
            performers = get_top_bottom_performers(days=30, limit=10)
            cache.set("analytics:performers:30d", performers, ttl=300)
            warmed.append("analytics:performers:30d")
        except Exception as e:
            failed.append(("analytics:performers:30d", str(e)))
        
        # Warm department comparison
        try:
            from pulse.api.insights import get_department_comparison
            dept_comparison = get_department_comparison(days=30)
            cache.set("analytics:dept_comparison:30d", dept_comparison, ttl=300)
            warmed.append("analytics:dept_comparison:30d")
        except Exception as e:
            failed.append(("analytics:dept_comparison:30d", str(e)))
        
    except Exception as e:
        frappe.log_error("Cache Warmer Analytics Error", str(e))
    
    return {
        "warmed": warmed,
        "failed": failed,
        "total": len(warmed) + len(failed),
        "timestamp": now()
    }


def warm_sop_cache() -> Dict[str, Any]:
    """Pre-load SOP-related data into cache.
    
    Warms:
    - Active SOP templates
    - Template statistics
    - Recent runs
    
    Returns:
        Statistics about warming operation
    """
    warmed = []
    failed = []
    
    try:
        # Warm active templates
        try:
            templates = cached_get_all(
                "SOP Template",
                fields=["name", "template_name", "department", "frequency", "is_active"],
                filters={"is_active": 1},
                ttl=600
            )
            cache.set("sop:templates:active", templates, ttl=600)
            warmed.append("sop:templates:active")
        except Exception as e:
            failed.append(("sop:templates:active", str(e)))
        
        # Warm template counts by department
        try:
            from pulse.api.templates import get_template_stats
            stats = get_template_stats()
            cache.set("sop:template_stats", stats, ttl=300)
            warmed.append("sop:template_stats")
        except Exception as e:
            failed.append(("sop:template_stats", str(e)))
        
        # Warm recent runs summary
        try:
            recent_runs = cached_get_all(
                "SOP Run",
                fields=["name", "template", "employee", "period_date", "status", "score"],
                filters={"docstatus": ["<", 2]},
                order_by="modified desc",
                limit=50,
                ttl=60
            )
            cache.set("sop:runs:recent", recent_runs, ttl=60)
            warmed.append("sop:runs:recent")
        except Exception as e:
            failed.append(("sop:runs:recent", str(e)))
        
    except Exception as e:
        frappe.log_error("Cache Warmer SOP Error", str(e))
    
    return {
        "warmed": warmed,
        "failed": failed,
        "total": len(warmed) + len(failed),
        "timestamp": now()
    }


def warm_all_cache() -> Dict[str, Any]:
    """Execute all cache warming operations.
    
    Returns:
        Combined statistics from all warming operations
    """
    results = {
        "dashboard": warm_dashboard_cache(),
        "employees": warm_employee_cache(),
        "analytics": warm_analytics_cache(),
        "sop": warm_sop_cache(),
        "timestamp": now()
    }
    
    # Calculate totals
    total_warmed = sum(len(r["warmed"]) for r in results.values() if isinstance(r, dict) and "warmed" in r)
    total_failed = sum(len(r["failed"]) for r in results.values() if isinstance(r, dict) and "failed" in r)
    
    results["summary"] = {
        "total_warmed": total_warmed,
        "total_failed": total_failed
    }
    
    return results


def schedule_warmup() -> None:
    """Schedule cache warming as Frappe scheduler job.
    
    This function should be called from hooks.py or tasks.py
    to register the warming job.
    
    Example (in hooks.py):
        scheduler_events = {
            "hourly": [
                "pulse.cache.cache_warmer.schedule_warmup"
            ]
        }
    """
    # Warm critical caches
    warm_dashboard_cache()
    warm_sop_cache()
    
    # Log completion
    frappe.logger().info("Scheduled cache warming completed")


def incremental_warmup(since: Optional[str] = None) -> Dict[str, Any]:
    """Perform incremental cache warming for recent changes.
    
    Args:
        since: Only warm data changed since this timestamp
        
    Returns:
        Statistics about warming operation
    """
    if not since:
        since = add_days(now(), -1)
    
    warmed = []
    failed = []
    
    try:
        # Warm recently modified employee data
        recent_employees = frappe.get_all(
            "Pulse Employee",
            filters={"modified": [">=", since]},
            pluck="name"
        )
        
        for emp_name in recent_employees:
            try:
                from pulse.api.employees import get_employee_detail
                emp_data = get_employee_detail(emp_name)
                cache_key = f"employee:detail:{emp_name}"
                cache.set(cache_key, emp_data, ttl=300)
                warmed.append(cache_key)
            except Exception as e:
                failed.append((f"employee:detail:{emp_name}", str(e)))
        
        # Warm recently modified runs
        recent_runs = frappe.get_all(
            "SOP Run",
            filters={"modified": [">=", since]},
            pluck="name"
        )
        
        for run_name in recent_runs[:20]:  # Limit to 20 most recent
            try:
                run_data = frappe.get_doc("SOP Run", run_name).as_dict()
                cache_key = f"sop:run:{run_name}"
                cache.set(cache_key, run_data, ttl=300)
                warmed.append(cache_key)
            except Exception as e:
                failed.append((f"sop:run:{run_name}", str(e)))
        
    except Exception as e:
        frappe.log_error("Incremental Warmup Error", str(e))
    
    return {
        "warmed": warmed,
        "failed": failed,
        "total": len(warmed) + len(failed),
        "timestamp": now()
    }


class CacheWarmingStrategy:
    """Define and execute custom cache warming strategies.
    
    Example:
        strategy = CacheWarmingStrategy()
        strategy.add_warmup_step("dashboard", warm_dashboard_cache, priority=1)
        strategy.add_warmup_step("employees", warm_employee_cache, priority=2)
        results = strategy.execute()
    """
    
    def __init__(self):
        """Initialize warming strategy."""
        self._steps: List[Dict[str, Any]] = []
    
    def add_warmup_step(
        self,
        name: str,
        warmup_func: Callable[[], Dict[str, Any]],
        priority: int = 5,
        condition: Optional[Callable[[], bool]] = None
    ) -> None:
        """Add a warming step to the strategy.
        
        Args:
            name: Step identifier
            warmup_func: Function to execute for warming
            priority: Lower number = higher priority (default: 5)
            condition: Optional condition function
        """
        self._steps.append({
            "name": name,
            "func": warmup_func,
            "priority": priority,
            "condition": condition
        })
    
    def execute(self) -> Dict[str, Any]:
        """Execute all warming steps in priority order.
        
        Returns:
            Combined results from all steps
        """
        # Sort by priority
        sorted_steps = sorted(self._steps, key=lambda s: s["priority"])
        
        results = {}
        for step in sorted_steps:
            # Check condition
            if step["condition"] and not step["condition"]():
                results[step["name"]] = {"skipped": True}
                continue
            
            # Execute
            try:
                result = step["func"]()
                results[step["name"]] = result
            except Exception as e:
                results[step["name"]] = {"error": str(e)}
        
        return results


# Predefined strategies
quick_warmup_strategy = CacheWarmingStrategy()
quick_warmup_strategy.add_warmup_step("dashboard", warm_dashboard_cache, priority=1)
quick_warmup_strategy.add_warmup_step("sop", warm_sop_cache, priority=2)

full_warmup_strategy = CacheWarmingStrategy()
full_warmup_strategy.add_warmup_step("dashboard", warm_dashboard_cache, priority=1)
full_warmup_strategy.add_warmup_step("employees", warm_employee_cache, priority=2)
full_warmup_strategy.add_warmup_step("analytics", warm_analytics_cache, priority=3)
full_warmup_strategy.add_warmup_step("sop", warm_sop_cache, priority=4)
