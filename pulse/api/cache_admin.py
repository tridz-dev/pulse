# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Cache administration API for Pulse.

Provides endpoints for:
- Cache statistics and monitoring
- Cache clearing by pattern
- Manual cache warming
- Cache key browsing
- Hit/miss rate analysis

All endpoints require Pulse Admin or System Manager role.
"""

from __future__ import annotations

from typing import Dict, List, Any, Optional
from datetime import datetime

import frappe
from frappe import _

from pulse.cache.redis_cache import cache
from pulse.cache.cache_warmer import (
    warm_dashboard_cache,
    warm_employee_cache,
    warm_analytics_cache,
    warm_sop_cache,
    warm_all_cache
)
from pulse.cache.query_cache import query_cache


def _check_admin_permission():
    """Verify user has admin permissions."""
    user = frappe.session.user
    if user == "Administrator":
        return True
    
    roles = frappe.get_roles(user)
    if "System Manager" in roles or "Pulse Admin" in roles:
        return True
    
    frappe.throw(_("Not permitted. Requires System Manager or Pulse Admin role."), frappe.PermissionError)


@frappe.whitelist()
def get_cache_stats() -> Dict[str, Any]:
    """Get comprehensive cache statistics.
    
    Returns:
        Dict with cache statistics including:
        - redis_info: Redis server information
        - pulse_keys: Count and sample of Pulse cache keys
        - query_cache: Query cache statistics
        - hit_miss_rates: Estimated hit/miss rates
        - memory_usage: Memory usage statistics
    """
    _check_admin_permission()
    
    try:
        # Get Redis info
        redis_info = cache.info()
        
        # Get Pulse cache keys
        pulse_keys = cache.keys("*")
        
        # Categorize keys
        key_categories = {}
        for key in pulse_keys:
            category = key.split(":")[0] if ":" in key else "other"
            key_categories[category] = key_categories.get(category, 0) + 1
        
        # Get query cache stats
        query_stats = query_cache.get_stats()
        
        # Calculate memory estimates (approximate)
        total_keys = len(pulse_keys)
        
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "redis": {
                "connected": redis_info.get("connected", False),
                "version": redis_info.get("version", "N/A"),
                "uptime_days": redis_info.get("uptime_days", 0),
                "used_memory": redis_info.get("used_memory", "N/A"),
                "used_memory_peak": redis_info.get("used_memory_peak", "N/A"),
            },
            "pulse_cache": {
                "total_keys": total_keys,
                "by_category": key_categories,
                "sample_keys": pulse_keys[:20],
            },
            "query_cache": query_stats,
        }
        
    except Exception as e:
        frappe.log_error("Cache Stats Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to retrieve cache statistics"
        }


@frappe.whitelist()
def clear_cache(pattern: Optional[str] = None) -> Dict[str, Any]:
    """Clear cache entries by pattern.
    
    Args:
        pattern: Pattern to match (e.g., "employee:*", "dashboard:*"). 
                 If None, clears all Pulse cache entries.
    
    Returns:
        Dict with operation result and count of deleted keys
    """
    _check_admin_permission()
    
    try:
        if pattern:
            # Clear by pattern
            deleted = cache.delete_pattern(pattern)
            return {
                "success": True,
                "pattern": pattern,
                "deleted_count": deleted,
                "message": f"Deleted {deleted} cache entries matching '{pattern}'"
            }
        else:
            # Clear all Pulse cache
            deleted = cache.flush()
            return {
                "success": True,
                "pattern": "*",
                "deleted_count": deleted,
                "message": f"Cleared all Pulse cache ({deleted} entries)"
            }
        
    except Exception as e:
        frappe.log_error("Clear Cache Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to clear cache"
        }


@frappe.whitelist()
def clear_query_cache(tables: Optional[List[str]] = None) -> Dict[str, Any]:
    """Clear query cache for specific tables or all queries.
    
    Args:
        tables: List of table names to invalidate. If None, clears all query cache.
    
    Returns:
        Dict with operation result
    """
    _check_admin_permission()
    
    try:
        if tables:
            deleted = query_cache.invalidate_tables(tables)
            return {
                "success": True,
                "tables": tables,
                "deleted_count": deleted,
                "message": f"Invalidated {deleted} queries for tables: {', '.join(tables)}"
            }
        else:
            deleted = query_cache.clear_all()
            return {
                "success": True,
                "deleted_count": deleted,
                "message": f"Cleared all query cache ({deleted} entries)"
            }
        
    except Exception as e:
        frappe.log_error("Clear Query Cache Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to clear query cache"
        }


@frappe.whitelist()
def warm_cache(entity_type: str = "all") -> Dict[str, Any]:
    """Manually trigger cache warming.
    
    Args:
        entity_type: Type of cache to warm ('dashboard', 'employees', 
                     'analytics', 'sop', or 'all')
    
    Returns:
        Dict with warming operation results
    """
    _check_admin_permission()
    
    try:
        warmers = {
            "dashboard": warm_dashboard_cache,
            "employees": warm_employee_cache,
            "analytics": warm_analytics_cache,
            "sop": warm_sop_cache,
            "all": warm_all_cache,
        }
        
        if entity_type not in warmers:
            return {
                "success": False,
                "error": f"Invalid entity_type: {entity_type}",
                "valid_types": list(warmers.keys())
            }
        
        result = warmers[entity_type]()
        
        return {
            "success": True,
            "entity_type": entity_type,
            "result": result,
            "message": f"Cache warming completed for {entity_type}"
        }
        
    except Exception as e:
        frappe.log_error("Cache Warm Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to warm cache"
        }


@frappe.whitelist()
def get_cache_keys(
    pattern: str = "*",
    limit: int = 100,
    include_values: bool = False
) -> Dict[str, Any]:
    """Browse cache keys matching a pattern.
    
    Args:
        pattern: Pattern to match (default: '*')
        limit: Maximum number of keys to return (default: 100)
        include_values: Whether to include cached values (default: False)
    
    Returns:
        Dict with matching keys and optional values
    """
    _check_admin_permission()
    
    try:
        keys = cache.keys(pattern)
        limited_keys = keys[:limit]
        
        result = {
            "success": True,
            "pattern": pattern,
            "total_matched": len(keys),
            "returned": len(limited_keys),
            "keys": limited_keys,
        }
        
        if include_values:
            key_values = {}
            for key in limited_keys:
                try:
                    value = cache.get(key)
                    # Truncate large values
                    value_str = str(value)
                    if len(value_str) > 500:
                        value_str = value_str[:500] + "... [truncated]"
                    key_values[key] = value_str
                except Exception:
                    key_values[key] = "[error reading value]"
            result["values"] = key_values
        
        # Get TTL for each key
        key_ttls = {}
        for key in limited_keys:
            try:
                ttl = cache.ttl(key)
                key_ttls[key] = ttl if ttl > 0 else -1
            except Exception:
                key_ttls[key] = -2
        result["ttls"] = key_ttls
        
        return result
        
    except Exception as e:
        frappe.log_error("Get Cache Keys Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to retrieve cache keys"
        }


@frappe.whitelist()
def get_cache_key_info(key: str) -> Dict[str, Any]:
    """Get detailed information about a specific cache key.
    
    Args:
        key: Cache key to inspect
    
    Returns:
        Dict with key information
    """
    _check_admin_permission()
    
    try:
        value = cache.get(key)
        ttl = cache.ttl(key)
        exists = cache.exists(key)
        
        # Determine value type and size
        value_type = type(value).__name__ if value else "None"
        value_size = len(str(value)) if value else 0
        
        return {
            "success": True,
            "key": key,
            "exists": exists,
            "value_type": value_type,
            "value_size_bytes": value_size,
            "ttl_seconds": ttl if ttl > 0 else -1,
            "value_preview": str(value)[:500] if value else None,
        }
        
    except Exception as e:
        frappe.log_error("Cache Key Info Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to retrieve key information"
        }


@frappe.whitelist()
def get_hit_miss_stats() -> Dict[str, Any]:
    """Get estimated hit/miss statistics.
    
    Note: This provides estimates based on Redis info where available.
    Full hit/miss tracking requires additional instrumentation.
    
    Returns:
        Dict with hit/miss statistics
    """
    _check_admin_permission()
    
    try:
        # Get Redis stats
        info = cache.info()
        
        # These are approximate - actual hit/miss tracking requires
        # application-level instrumentation
        stats = {
            "success": True,
            "note": "Hit/miss rates are estimates based on Redis statistics",
            "redis_info": {
                "keyspace_hits": info.get("keyspace_hits", "N/A"),
                "keyspace_misses": info.get("keyspace_misses", "N/A"),
                "connected_clients": info.get("connected_clients", "N/A"),
            },
            "pulse_cache_keys": len(cache.keys("*")),
        }
        
        # Calculate hit rate if available
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        if hits is not None and misses is not None and (hits + misses) > 0:
            stats["estimated_hit_rate"] = hits / (hits + misses)
        else:
            stats["estimated_hit_rate"] = None
        
        return stats
        
    except Exception as e:
        frappe.log_error("Hit Miss Stats Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to retrieve hit/miss statistics"
        }


@frappe.whitelist()
def delete_cache_key(key: str) -> Dict[str, Any]:
    """Delete a specific cache key.
    
    Args:
        key: Cache key to delete
    
    Returns:
        Dict with operation result
    """
    _check_admin_permission()
    
    try:
        success = cache.delete(key)
        return {
            "success": success,
            "key": key,
            "message": f"Key '{key}' deleted" if success else f"Key '{key}' not found"
        }
        
    except Exception as e:
        frappe.log_error("Delete Cache Key Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to delete cache key"
        }


@frappe.whitelist()
def get_cache_health() -> Dict[str, Any]:
    """Get cache system health status.
    
    Returns:
        Dict with health status and recommendations
    """
    _check_admin_permission()
    
    try:
        health = {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "checks": {}
        }
        
        # Check Redis connection
        is_connected = cache.is_connected()
        health["checks"]["redis_connection"] = {
            "status": "ok" if is_connected else "error",
            "message": "Redis connection active" if is_connected else "Redis connection failed"
        }
        
        # Check cache size
        key_count = len(cache.keys("*"))
        health["checks"]["cache_size"] = {
            "status": "ok" if key_count < 10000 else "warning",
            "message": f"{key_count} cache entries",
            "key_count": key_count
        }
        
        # Check for stale keys (keys with negative TTL)
        all_keys = cache.keys("*")
        stale_keys = []
        for key in all_keys[:100]:  # Sample first 100
            ttl = cache.ttl(key)
            if ttl == -2:  # Key doesn't exist (expired)
                stale_keys.append(key)
        
        health["checks"]["stale_keys"] = {
            "status": "ok" if len(stale_keys) < 10 else "warning",
            "message": f"{len(stale_keys)} potentially stale keys in sample"
        }
        
        # Overall status
        all_ok = all(c["status"] == "ok" for c in health["checks"].values())
        health["overall_status"] = "healthy" if all_ok else "degraded"
        
        return health
        
    except Exception as e:
        frappe.log_error("Cache Health Error", str(e))
        return {
            "success": False,
            "overall_status": "error",
            "error": str(e),
            "message": "Failed to check cache health"
        }
