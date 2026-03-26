# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Cache decorators for Pulse application.

Provides decorators for:
- Caching function results with TTL
- Cache invalidation by pattern
- Cached queries with custom key builders
- Conditional caching

Example:
    @cache_result(ttl=300, key_prefix='employee')
    def get_employee_details(employee_id):
        return db.fetch_employee(employee_id)
    
    @cache_invalidate(pattern='employee:*')
    def update_employee(employee_id, data):
        return db.update_employee(employee_id, data)
    
    @cached_query(ttl=60, key_builder=lambda user, date: f"dashboard:{user}:{date}")
    def get_dashboard_data(user, date):
        return compute_dashboard(user, date)
"""

from __future__ import annotations

import functools
import hashlib
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
from functools import wraps

import frappe

from pulse.cache.redis_cache import cache, generate_cache_key

F = TypeVar('F', bound=Callable[..., Any])


def cache_result(
    ttl: int = 300,
    key_prefix: str = "",
    key_builder: Optional[Callable[..., str]] = None,
    condition: Optional[Callable[..., bool]] = None,
    skip_args: Optional[List[int]] = None
):
    """Decorator to cache function results.
    
    Automatically caches the return value of the decorated function.
    On subsequent calls with the same arguments, returns cached value
    instead of re-executing the function.
    
    Args:
        ttl: Cache time-to-live in seconds (default: 300)
        key_prefix: Prefix for cache key (default: "")
        key_builder: Custom function to build cache key (default: None)
        condition: Function that returns True if result should be cached (default: None)
        skip_args: List of argument indices to ignore in key generation (default: None)
        
    Returns:
        Decorator function
        
    Example:
        @cache_result(ttl=300, key_prefix='employee')
        def get_employee_details(employee_id, include_history=False):
            # Expensive database query
            return db.get_employee(employee_id, include_history)
        
        # With custom key builder
        @cache_result(ttl=600, key_builder=lambda user, filters: f"user:{user}:filters:{hash(filters)}")
        def get_filtered_data(user, filters):
            return compute_data(filters)
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Check condition
            if condition and not condition(*args, **kwargs):
                return func(*args, **kwargs)
            
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # Generate key from function name and arguments
                func_name = f"{func.__module__}.{func.__name__}"
                
                # Filter out skipped args
                if skip_args:
                    filtered_args = tuple(a for i, a in enumerate(args) if i not in skip_args)
                else:
                    filtered_args = args
                
                key_parts = [func_name] + list(filtered_args)
                key_hash = generate_cache_key(*key_parts, **kwargs)
                cache_key = f"{key_prefix}:{key_hash}" if key_prefix else key_hash
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Cache result if not None
            if result is not None:
                cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        # Attach cache management methods
        wrapper.cache_key = lambda *args, **kwargs: (
            key_builder(*args, **kwargs) if key_builder 
            else f"{key_prefix}:{generate_cache_key(f'{func.__module__}.{func.__name__}', *args, **kwargs)}" if key_prefix
            else generate_cache_key(f'{func.__module__}.{func.__name__}', *args, **kwargs)
        )
        wrapper.clear_cache = lambda *args, **kwargs: cache.delete(wrapper.cache_key(*args, **kwargs))
        wrapper.clear_all = lambda pattern=None: cache.delete_pattern(pattern or f"{key_prefix}:*" if key_prefix else f"{func.__module__}.{func.__name__}:*")
        
        return wrapper
    return decorator


def cache_invalidate(
    pattern: str,
    on_success_only: bool = True
):
    """Decorator to invalidate cache entries after function execution.
    
    Clears all cache keys matching the specified pattern after the
    decorated function completes.
    
    Args:
        pattern: Pattern to match for cache invalidation (e.g., "employee:*")
        on_success_only: Only invalidate if function returns truthy value (default: True)
        
    Returns:
        Decorator function
        
    Example:
        @cache_invalidate(pattern='employee:*')
        def update_employee(employee_id, data):
            return db.update_employee(employee_id, data)
        
        @cache_invalidate(pattern='dashboard:*', on_success_only=True)
        def refresh_dashboard(dashboard_id):
            return compute_dashboard(dashboard_id)
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            
            # Invalidate cache
            should_invalidate = not on_success_only or result
            if should_invalidate:
                try:
                    deleted_count = cache.delete_pattern(pattern)
                    if deleted_count > 0:
                        frappe.logger().debug(f"Cache invalidation: deleted {deleted_count} keys matching '{pattern}'")
                except Exception as e:
                    frappe.log_error("Cache Invalidation Error", f"Pattern: {pattern}, Error: {str(e)}")
            
            return result
        
        return wrapper
    return decorator


def cached_query(
    ttl: int = 60,
    key_builder: Optional[Callable[..., str]] = None,
    cache_none: bool = False
):
    """Decorator specifically for database query caching.
    
    Optimized for SQL queries with automatic key generation based on
    SQL query string and parameters.
    
    Args:
        ttl: Cache time-to-live in seconds (default: 60)
        key_builder: Custom function to build cache key (default: None)
        cache_none: Whether to cache None results (default: False)
        
    Returns:
        Decorator function
        
    Example:
        @cached_query(ttl=300)
        def get_employee_count(branch=None):
            return frappe.db.count("Pulse Employee", {"branch": branch})
        
        @cached_query(ttl=60, key_builder=lambda user, date: f"dashboard:{user}:{date}")
        def get_dashboard_data(user, date):
            return compute_dashboard(user, date)
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                func_name = f"{func.__module__}.{func.__name__}"
                key_hash = generate_cache_key(*args, **kwargs)
                cache_key = f"query:{func_name}:{key_hash}"
            
            # Try cache
            cached = cache.get(cache_key)
            if cached is not None or (cache_none and cache.exists(cache_key)):
                return cached
            
            # Execute
            result = func(*args, **kwargs)
            
            # Cache if appropriate
            if result is not None or cache_none:
                cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator


def cache_page(
    ttl: int = 300,
    vary_on_user: bool = True,
    vary_on_roles: bool = False
):
    """Decorator to cache page/endpoint responses.
    
    Designed for Frappe whitelisted API methods that return
    page data or API responses.
    
    Args:
        ttl: Cache time-to-live in seconds (default: 300)
        vary_on_user: Include user in cache key (default: True)
        vary_on_roles: Include user roles in cache key (default: False)
        
    Returns:
        Decorator function
        
    Example:
        @frappe.whitelist()
        @cache_page(ttl=60)
        def get_dashboard_data():
            return compute_dashboard(frappe.session.user)
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key with user context
            func_name = f"{func.__module__}.{func.__name__}"
            key_parts = [func_name]
            
            if vary_on_user:
                key_parts.append(f"user:{frappe.session.user}")
            
            if vary_on_roles:
                roles = sorted(frappe.get_roles())
                key_parts.append(f"roles:{':'.join(roles)}")
            
            # Add function args
            key_parts.extend([str(a) for a in args])
            key_parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
            
            cache_key = generate_cache_key(*key_parts)
            
            # Try cache
            cached = cache.get(cache_key)
            if cached is not None:
                return cached
            
            # Execute
            result = func(*args, **kwargs)
            
            # Cache
            if result is not None:
                cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator


def memoize(
    ttl: int = 300,
    max_size: int = 1000
):
    """In-memory memoization decorator (not Redis-based).
    
    Useful for very frequently accessed data that doesn't need
    to be shared across workers.
    
    Args:
        ttl: Time-to-live in seconds (default: 300)
        max_size: Maximum number of items to store (default: 1000)
        
    Returns:
        Decorator function
        
    Example:
        @memoize(ttl=60)
        def compute_expensive_value(x, y):
            return expensive_computation(x, y)
    """
    def decorator(func: F) -> F:
        _cache: Dict[str, tuple] = {}
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            import time
            
            # Build key
            key = generate_cache_key(*args, **kwargs)
            
            # Check cache
            now = time.time()
            if key in _cache:
                value, expiry = _cache[key]
                if expiry > now:
                    return value
                else:
                    del _cache[key]
            
            # Execute
            result = func(*args, **kwargs)
            
            # Manage size
            if len(_cache) >= max_size:
                # Remove oldest entry
                oldest_key = min(_cache.keys(), key=lambda k: _cache[k][1])
                del _cache[oldest_key]
            
            # Cache
            _cache[key] = (result, now + ttl)
            
            return result
        
        wrapper.clear_cache = lambda: _cache.clear()
        wrapper.cache_info = lambda: {"size": len(_cache), "max_size": max_size}
        
        return wrapper
    return decorator


def conditional_cache(
    condition: Callable[..., bool],
    ttl: int = 300
):
    """Cache decorator that only caches when condition is met.
    
    Args:
        condition: Function that returns True if result should be cached
        ttl: Cache time-to-live in seconds (default: 300)
        
    Returns:
        Decorator function
        
    Example:
        @conditional_cache(lambda result: result is not None and len(result) > 0, ttl=300)
        def get_items(category):
            return db.fetch_items(category)
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build key
            func_name = f"{func.__module__}.{func.__name__}"
            cache_key = generate_cache_key(func_name, *args, **kwargs)
            
            # Try cache
            cached = cache.get(cache_key)
            if cached is not None:
                return cached
            
            # Execute
            result = func(*args, **kwargs)
            
            # Cache only if condition is met
            try:
                if condition(result):
                    cache.set(cache_key, result, ttl=ttl)
            except Exception:
                pass
            
            return result
        
        return wrapper
    return decorator


class CacheGroup:
    """Manages a group of related cache entries.
    
    Provides group-level operations like clear-all and stats.
    
    Example:
        employee_cache = CacheGroup("employee")
        
        @employee_cache.cached(ttl=300)
        def get_employee(id):
            return db.get_employee(id)
        
        # Clear all employee cache entries
        employee_cache.clear_all()
    """
    
    def __init__(self, prefix: str):
        """Initialize cache group with prefix.
        
        Args:
            prefix: Prefix for all keys in this group
        """
        self.prefix = prefix
    
    def cached(self, ttl: int = 300, key_builder: Optional[Callable[..., str]] = None):
        """Decorator to cache within this group.
        
        Args:
            ttl: Cache TTL in seconds
            key_builder: Optional custom key builder
            
        Returns:
            Decorator function
        """
        def decorator(func: F) -> F:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Build key
                if key_builder:
                    key_suffix = key_builder(*args, **kwargs)
                else:
                    key_suffix = generate_cache_key(*args, **kwargs)
                
                cache_key = f"{self.prefix}:{key_suffix}"
                
                # Try cache
                cached = cache.get(cache_key)
                if cached is not None:
                    return cached
                
                # Execute and cache
                result = func(*args, **kwargs)
                if result is not None:
                    cache.set(cache_key, result, ttl=ttl)
                
                return result
            
            return wrapper
        return decorator
    
    def invalidate_on(self, pattern: str = None):
        """Decorator to invalidate this group after function execution.
        
        Args:
            pattern: Optional custom pattern (defaults to group prefix)
            
        Returns:
            Decorator function
        """
        invalidate_pattern = pattern or f"{self.prefix}:*"
        return cache_invalidate(pattern=invalidate_pattern)
    
    def clear_all(self) -> int:
        """Clear all cache entries in this group.
        
        Returns:
            Number of entries deleted
        """
        return cache.delete_pattern(f"{self.prefix}:*")
    
    def get_keys(self) -> List[str]:
        """Get all keys in this group.
        
        Returns:
            List of cache keys
        """
        return cache.keys(f"{self.prefix}:*")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics for this cache group.
        
        Returns:
            Dictionary with stats
        """
        keys = self.get_keys()
        return {
            "prefix": self.prefix,
            "key_count": len(keys),
            "keys": keys[:100]  # Limit to first 100
        }


# Predefined cache groups for common use cases
employee_cache = CacheGroup("employee")
dashboard_cache = CacheGroup("dashboard")
analytics_cache = CacheGroup("analytics")
sop_cache = CacheGroup("sop")
user_cache = CacheGroup("user")
