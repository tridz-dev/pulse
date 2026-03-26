# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Query result caching system for Pulse.

Provides intelligent caching for SQL query results with:
- Automatic cache key generation from SQL and parameters
- Smart invalidation based on table writes
- Cache warming strategies
- Query result deduplication

Example:
    from pulse.cache.query_cache import query_cache
    
    # Cache a query result
    results = query_cache.execute(
        "SELECT * FROM `tabPulse Employee` WHERE branch = %(branch)s",
        {"branch": "HQ001"},
        ttl=300
    )
    
    # With automatic invalidation tracking
    results = query_cache.execute_with_tracking(
        "SELECT * FROM `tabSOP Run` WHERE employee = %(emp)s",
        {"emp": "EMP001"},
        tables=["tabSOP Run"],
        ttl=60
    )
"""

from __future__ import annotations

import hashlib
import re
import json
from typing import Any, Dict, List, Optional, Set, Tuple, Callable
from datetime import datetime
from dataclasses import dataclass

import frappe

from pulse.cache.redis_cache import cache, generate_cache_key


@dataclass
class QueryCacheEntry:
    """Represents a cached query entry with metadata."""
    sql: str
    params: Dict[str, Any]
    result: Any
    created_at: datetime
    ttl: int
    tables: Optional[List[str]] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for storage."""
        return {
            "sql": self.sql,
            "params": self.params,
            "result": self.result,
            "created_at": self.created_at.isoformat(),
            "ttl": self.ttl,
            "tables": self.tables or []
        }


class QueryCache:
    """Intelligent query result caching system.
    
    Automatically generates cache keys from SQL queries and parameters,
    tracks table dependencies for smart invalidation, and provides
    cache warming capabilities.
    
    Example:
        qc = QueryCache()
        
        # Simple query caching
        result = qc.execute(
            "SELECT * FROM `tabPulse Employee` WHERE is_active = 1",
            ttl=300
        )
        
        # With table tracking for auto-invalidation
        result = qc.execute(
            "SELECT * FROM `tabSOP Run` WHERE status = 'Open'",
            tables=["tabSOP Run"],
            ttl=60
        )
        
        # Invalidate all queries touching specific tables
        qc.invalidate_tables(["tabSOP Run"])
    """
    
    def __init__(self):
        """Initialize query cache."""
        self._table_tracking_key = "query_cache:tracked_tables"
        self._query_metadata_prefix = "query_cache:meta:"
    
    def _extract_tables(self, sql: str) -> List[str]:
        """Extract table names from SQL query.
        
        Args:
            sql: SQL query string
            
        Returns:
            List of table names found in query
        """
        tables = set()
        
        # Match FROM and JOIN clauses
        from_pattern = r'FROM\s+`?(\w+)`?' 
        join_pattern = r'JOIN\s+`?(\w+)`?'
        into_pattern = r'INTO\s+`?(\w+)`?'
        update_pattern = r'UPDATE\s+`?(\w+)`?'
        
        for pattern in [from_pattern, join_pattern, into_pattern, update_pattern]:
            matches = re.findall(pattern, sql, re.IGNORECASE)
            tables.update(matches)
        
        return list(tables)
    
    def _generate_cache_key(self, sql: str, params: Optional[Dict] = None) -> str:
        """Generate deterministic cache key for query.
        
        Args:
            sql: SQL query string
            params: Query parameters
            
        Returns:
            Cache key string
        """
        # Normalize SQL (remove extra whitespace)
        normalized_sql = " ".join(sql.split())
        
        # Create key from SQL and params
        key_parts = [normalized_sql]
        if params:
            # Sort params for consistency
            sorted_params = sorted(params.items())
            key_parts.append(json.dumps(sorted_params, sort_keys=True))
        
        key_string = "|".join(key_parts)
        query_hash = hashlib.sha256(key_string.encode()).hexdigest()[:32]
        
        return f"query:{query_hash}"
    
    def execute(
        self,
        sql: str,
        params: Optional[Dict] = None,
        ttl: int = 60,
        as_dict: bool = True,
        tables: Optional[List[str]] = None,
        force_refresh: bool = False
    ) -> List[Dict]:
        """Execute query with caching.
        
        Args:
            sql: SQL query string
            params: Query parameters (default: None)
            ttl: Cache TTL in seconds (default: 60)
            as_dict: Return results as dictionaries (default: True)
            tables: Tables this query depends on (default: auto-detect)
            force_refresh: Bypass cache and re-execute (default: False)
            
        Returns:
            Query results as list of dictionaries
        """
        cache_key = self._generate_cache_key(sql, params)
        
        # Try cache
        if not force_refresh:
            cached = cache.get(cache_key)
            if cached is not None:
                return cached
        
        # Execute query
        try:
            result = frappe.db.sql(sql, params or {}, as_dict=as_dict)
        except Exception as e:
            frappe.log_error("QueryCache Execute Error", f"SQL: {sql[:200]}, Error: {str(e)}")
            raise
        
        # Cache result
        if result is not None:
            cache.set(cache_key, result, ttl=ttl)
            
            # Store metadata for table tracking
            if tables or True:  # Always track for potential invalidation
                detected_tables = tables or self._extract_tables(sql)
                if detected_tables:
                    metadata = {
                        "tables": detected_tables,
                        "created_at": datetime.now().isoformat(),
                        "ttl": ttl
                    }
                    meta_key = f"{self._query_metadata_prefix}{cache_key}"
                    cache.set(meta_key, metadata, ttl=ttl)
                    
                    # Update table-to-queries mapping
                    self._track_query_for_tables(cache_key, detected_tables)
        
        return result
    
    def _track_query_for_tables(self, query_key: str, tables: List[str]) -> None:
        """Track which queries depend on which tables.
        
        Args:
            query_key: Cache key for the query
            tables: List of table names
        """
        for table in tables:
            table_key = f"query_cache:table:{table}"
            tracked = cache.get(table_key) or []
            if query_key not in tracked:
                tracked.append(query_key)
                # Keep only recent 100 queries per table
                tracked = tracked[-100:]
                cache.set(table_key, tracked, ttl=86400)  # 24 hours
    
    def invalidate_tables(self, tables: List[str]) -> int:
        """Invalidate all cached queries touching specific tables.
        
        Args:
            tables: List of table names to invalidate
            
        Returns:
            Number of cache entries deleted
        """
        deleted_count = 0
        
        for table in tables:
            table_key = f"query_cache:table:{table}"
            query_keys = cache.get(table_key) or []
            
            for query_key in query_keys:
                if cache.delete(query_key):
                    deleted_count += 1
                # Also delete metadata
                meta_key = f"{self._query_metadata_prefix}{query_key}"
                cache.delete(meta_key)
            
            # Clear the tracking entry
            cache.delete(table_key)
        
        return deleted_count
    
    def invalidate_query(self, sql: str, params: Optional[Dict] = None) -> bool:
        """Invalidate a specific query result.
        
        Args:
            sql: SQL query string
            params: Query parameters
            
        Returns:
            True if cache entry was deleted
        """
        cache_key = self._generate_cache_key(sql, params)
        success = cache.delete(cache_key)
        
        # Also delete metadata
        meta_key = f"{self._query_metadata_prefix}{cache_key}"
        cache.delete(meta_key)
        
        return success
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate queries by pattern.
        
        Args:
            pattern: Pattern to match (e.g., "query:*employee*")
            
        Returns:
            Number of entries deleted
        """
        return cache.delete_pattern(f"query:*{pattern}*")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get query cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        query_keys = cache.keys("query:*")
        
        # Filter out metadata keys
        data_keys = [k for k in query_keys if not k.startswith("query_cache:meta:")]
        
        # Count by table
        table_counts = {}
        for key in data_keys:
            meta_key = f"{self._query_metadata_prefix}{key}"
            metadata = cache.get(meta_key)
            if metadata and metadata.get("tables"):
                for table in metadata["tables"]:
                    table_counts[table] = table_counts.get(table, 0) + 1
        
        return {
            "total_cached_queries": len(data_keys),
            "queries_by_table": table_counts,
            "sample_keys": data_keys[:10]
        }
    
    def clear_all(self) -> int:
        """Clear all query cache entries.
        
        Returns:
            Number of entries deleted
        """
        deleted = cache.delete_pattern("query:*")
        cache.delete_pattern("query_cache:*")
        return deleted
    
    def warm_cache(
        self,
        queries: List[Tuple[str, Optional[Dict], int]],
        parallel: bool = False
    ) -> Dict[str, Any]:
        """Pre-warm cache with multiple queries.
        
        Args:
            queries: List of (sql, params, ttl) tuples
            parallel: Execute in parallel (not implemented)
            
        Returns:
            Statistics about warming operation
        """
        warmed = 0
        failed = 0
        
        for sql, params, ttl in queries:
            try:
                self.execute(sql, params, ttl=ttl, force_refresh=True)
                warmed += 1
            except Exception as e:
                frappe.log_error("QueryCache Warm Error", f"SQL: {sql[:100]}, Error: {str(e)}")
                failed += 1
        
        return {
            "warmed": warmed,
            "failed": failed,
            "total": len(queries)
        }


class SmartQueryCache(QueryCache):
    """Extended query cache with automatic invalidation hooks.
    
    Automatically invalidates cached queries when related DocTypes
    are modified. Use this for queries that should stay fresh.
    
    Example:
        smart_cache = SmartQueryCache()
        
        # This query will be invalidated when Pulse Employee is modified
        results = smart_cache.execute(
            "SELECT * FROM `tabPulse Employee`",
            tables=["tabPulse Employee"],
            ttl=300
        )
    """
    
    def __init__(self):
        """Initialize smart query cache."""
        super().__init__()
        self._invalidation_hooks: Dict[str, List[Callable]] = {}
    
    def register_invalidation_hook(self, doctype: str, hook: Callable) -> None:
        """Register a hook to be called when a DocType is modified.
        
        Args:
            doctype: DocType name (e.g., "Pulse Employee")
            hook: Function to call on invalidation
        """
        if doctype not in self._invalidation_hooks:
            self._invalidation_hooks[doctype] = []
        self._invalidation_hooks[doctype].append(hook)
    
    def on_doctype_change(self, doctype: str, docname: Optional[str] = None) -> int:
        """Handle DocType change event - invalidate related queries.
        
        Args:
            doctype: DocType that was modified
            docname: Specific document name (optional)
            
        Returns:
            Number of cache entries invalidated
        """
        table_name = f"tab{doctype.replace(' ', '')}"
        deleted = self.invalidate_tables([table_name])
        
        # Call registered hooks
        for hook in self._invalidation_hooks.get(doctype, []):
            try:
                hook(doctype, docname)
            except Exception:
                pass
        
        return deleted


# Global query cache instance
query_cache = QueryCache()
smart_query_cache = SmartQueryCache()


# Convenience functions for common patterns
def cached_count(
    doctype: str,
    filters: Optional[Dict] = None,
    ttl: int = 60
) -> int:
    """Get cached count of documents.
    
    Args:
        doctype: DocType name
        filters: Filters to apply
        ttl: Cache TTL in seconds
        
    Returns:
        Document count
    """
    cache_key = f"count:{doctype}:{hash(str(sorted((filters or {}).items())))}"
    
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    count = frappe.db.count(doctype, filters or {})
    cache.set(cache_key, count, ttl=ttl)
    
    return count


def cached_get_all(
    doctype: str,
    fields: Optional[List[str]] = None,
    filters: Optional[Dict] = None,
    order_by: Optional[str] = None,
    limit: Optional[int] = None,
    ttl: int = 60
) -> List[Dict]:
    """Cached version of frappe.get_all.
    
    Args:
        doctype: DocType name
        fields: Fields to retrieve
        filters: Filters to apply
        order_by: Order by clause
        limit: Limit results
        ttl: Cache TTL in seconds
        
    Returns:
        List of documents
    """
    # Build cache key
    key_parts = [doctype, str(fields or []), str(sorted((filters or {}).items())), order_by, str(limit)]
    cache_key = f"get_all:{generate_cache_key(*key_parts)}"
    
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    result = frappe.get_all(
        doctype,
        fields=fields,
        filters=filters,
        order_by=order_by,
        limit=limit
    )
    
    cache.set(cache_key, result, ttl=ttl)
    
    return result


def cached_get_value(
    doctype: str,
    name: str,
    field: str,
    ttl: int = 120
) -> Any:
    """Cached version of frappe.db.get_value.
    
    Args:
        doctype: DocType name
        name: Document name
        field: Field to retrieve
        ttl: Cache TTL in seconds
        
    Returns:
        Field value
    """
    cache_key = f"get_value:{doctype}:{name}:{field}"
    
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    value = frappe.db.get_value(doctype, name, field)
    cache.set(cache_key, value, ttl=ttl)
    
    return value
