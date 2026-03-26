# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Pulse Caching Module - Enterprise-grade caching layer.

This module provides a comprehensive caching solution for the Pulse application:

Core Components:
    - RedisCache: Main Redis cache manager
    - cache: Global cache instance
    - cache decorators: @cache_result, @cache_invalidate, @cached_query
    - QueryCache: SQL query result caching
    - CacheWarmer: Cache pre-warming utilities

Quick Start:
    from pulse.cache import cache, cache_result
    
    # Direct cache usage
    cache.set('my_key', {'data': 'value'}, ttl=300)
    value = cache.get('my_key')
    
    # Decorator usage
    @cache_result(ttl=300, key_prefix='employee')
    def get_employee(employee_id):
        return db.fetch_employee(employee_id)

Available Decorators:
    - @cache_result: Cache function results with TTL
    - @cache_invalidate: Invalidate cache entries after function execution
    - @cached_query: Cache database query results
    - @cache_page: Cache page/endpoint responses
    - @memoize: In-memory memoization (non-Redis)

Cache Groups:
    - employee_cache: Group for employee-related caches
    - dashboard_cache: Group for dashboard data
    - analytics_cache: Group for analytics data
    - sop_cache: Group for SOP-related caches
    - user_cache: Group for user-specific caches

Administration:
    - Cache statistics via pulse.api.cache_admin
    - Cache warming via pulse.cache.cache_warmer
    - Query cache invalidation via query_cache.invalidate_tables()
"""

from pulse.cache.redis_cache import (
    RedisCache,
    cache,
    generate_cache_key,
)

from pulse.cache.cache_decorators import (
    cache_result,
    cache_invalidate,
    cached_query,
    cache_page,
    memoize,
    conditional_cache,
    CacheGroup,
    employee_cache,
    dashboard_cache,
    analytics_cache,
    sop_cache,
    user_cache,
)

from pulse.cache.query_cache import (
    QueryCache,
    SmartQueryCache,
    query_cache,
    smart_query_cache,
    cached_count,
    cached_get_all,
    cached_get_value,
)

from pulse.cache.cache_warmer import (
    warm_dashboard_cache,
    warm_employee_cache,
    warm_analytics_cache,
    warm_sop_cache,
    warm_all_cache,
    incremental_warmup,
    schedule_warmup,
    CacheWarmingStrategy,
    quick_warmup_strategy,
    full_warmup_strategy,
)

__all__ = [
    # Core cache
    'RedisCache',
    'cache',
    'generate_cache_key',
    
    # Decorators
    'cache_result',
    'cache_invalidate',
    'cached_query',
    'cache_page',
    'memoize',
    'conditional_cache',
    
    # Cache groups
    'CacheGroup',
    'employee_cache',
    'dashboard_cache',
    'analytics_cache',
    'sop_cache',
    'user_cache',
    
    # Query cache
    'QueryCache',
    'SmartQueryCache',
    'query_cache',
    'smart_query_cache',
    'cached_count',
    'cached_get_all',
    'cached_get_value',
    
    # Cache warming
    'warm_dashboard_cache',
    'warm_employee_cache',
    'warm_analytics_cache',
    'warm_sop_cache',
    'warm_all_cache',
    'incremental_warmup',
    'schedule_warmup',
    'CacheWarmingStrategy',
    'quick_warmup_strategy',
    'full_warmup_strategy',
]

__version__ = '1.0.0'
