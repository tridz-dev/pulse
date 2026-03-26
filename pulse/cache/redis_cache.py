# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Enterprise-grade Redis cache manager for Pulse application.

This module provides a robust Redis-based caching layer with features including:
- Key-value storage with TTL support
- Pattern-based key deletion
- Atomic operations (increment, decrement)
- Pipeline support for batch operations
- Get-or-set pattern for compute-on-miss caching
- JSON serialization for complex data types
- Connection pooling and error handling
"""

from __future__ import annotations

import json
import pickle
import hashlib
from typing import Any, Callable, Dict, List, Optional, Union, TypeVar, Generic
from functools import wraps
from contextlib import contextmanager

import frappe
from frappe.utils import cint, cstr

T = TypeVar('T')


class RedisCache:
    """Enterprise Redis cache manager with advanced features.
    
    Provides a unified interface for caching with automatic serialization,
    TTL management, pattern-based operations, and batch processing.
    
    Example:
        cache = RedisCache()
        
        # Simple get/set
        cache.set('user:123', {'name': 'John', 'role': 'admin'}, ttl=300)
        user = cache.get('user:123')
        
        # Get or compute pattern
        def fetch_user(user_id):
            return db.get_user(user_id)
        user = cache.get_or_set('user:123', lambda: fetch_user(123), ttl=300)
        
        # Pipeline for batch operations
        with cache.pipeline() as pipe:
            pipe.set('key1', 'value1')
            pipe.set('key2', 'value2')
            pipe.get('key1')
            results = pipe.execute()
    """
    
    _instance = None
    _redis_client = None
    
    def __new__(cls):
        """Singleton pattern to ensure single Redis connection pool."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize cache with Redis connection."""
        if self._redis_client is None:
            self._connect()
    
    def _connect(self) -> None:
        """Establish Redis connection using Frappe's Redis instance."""
        try:
            # Use Frappe's built-in Redis connection
            self._redis_client = frappe.cache()
            self._cache_prefix = "pulse:cache:"
        except Exception as e:
            frappe.log_error("RedisCache Connection Error", str(e))
            self._redis_client = None
    
    def _prefixed_key(self, key: str) -> str:
        """Add prefix to key for namespacing."""
        if key.startswith(self._cache_prefix):
            return key
        return f"{self._cache_prefix}{key}"
    
    def _serialize(self, value: Any) -> Union[str, bytes]:
        """Serialize value for Redis storage.
        
        Uses JSON for simple types, pickle for complex objects.
        """
        try:
            return json.dumps(value, default=str)
        except (TypeError, ValueError):
            # Fall back to pickle for complex objects
            return pickle.dumps(value)
    
    def _deserialize(self, value: Union[str, bytes]) -> Any:
        """Deserialize value from Redis storage."""
        if value is None:
            return None
        
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError, ValueError):
            try:
                return pickle.loads(value)
            except Exception:
                return value
    
    def is_connected(self) -> bool:
        """Check if Redis connection is available."""
        return self._redis_client is not None
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value by key.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        if not self.is_connected():
            return None
        
        try:
            prefixed = self._prefixed_key(key)
            value = self._redis_client.get(prefixed)
            return self._deserialize(value) if value else None
        except Exception as e:
            frappe.log_error("RedisCache Get Error", f"Key: {key}, Error: {str(e)}")
            return None
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: int = 300,
        nx: bool = False,
        xx: bool = False
    ) -> bool:
        """Set cached value with optional TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (default: 300)
            nx: Only set if key does not exist
            xx: Only set if key exists
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_connected():
            return False
        
        try:
            prefixed = self._prefixed_key(key)
            serialized = self._serialize(value)
            
            kwargs = {'ex': ttl} if ttl > 0 else {}
            if nx:
                kwargs['nx'] = True
            if xx:
                kwargs['xx'] = True
            
            self._redis_client.set_value(prefixed, serialized, **kwargs)
            return True
        except Exception as e:
            frappe.log_error("RedisCache Set Error", f"Key: {key}, Error: {str(e)}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete a key from cache.
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if key was deleted, False otherwise
        """
        if not self.is_connected():
            return False
        
        try:
            prefixed = self._prefixed_key(key)
            self._redis_client.delete_key(prefixed)
            return True
        except Exception as e:
            frappe.log_error("RedisCache Delete Error", f"Key: {key}, Error: {str(e)}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern.
        
        Args:
            pattern: Pattern to match (e.g., "user:*", "session:*")
            
        Returns:
            Number of keys deleted
        """
        if not self.is_connected():
            return 0
        
        try:
            prefixed_pattern = self._prefixed_key(pattern)
            
            # Use scan_iter for production safety (don't block Redis)
            keys_to_delete = []
            for key in self._redis_client.redis.scan_iter(match=prefixed_pattern):
                keys_to_delete.append(key)
            
            if keys_to_delete:
                self._redis_client.redis.delete(*keys_to_delete)
            
            return len(keys_to_delete)
        except Exception as e:
            frappe.log_error("RedisCache Delete Pattern Error", f"Pattern: {pattern}, Error: {str(e)}")
            return 0
    
    def get_or_set(
        self,
        key: str,
        callback: Callable[[], T],
        ttl: int = 300,
        force_refresh: bool = False
    ) -> T:
        """Get cached value or compute and cache if not exists.
        
        This is the primary caching pattern - returns cached value if available,
        otherwise calls the callback function to compute the value, caches it,
        and returns it.
        
        Args:
            key: Cache key
            callback: Function to compute value if not cached
            ttl: Time to live in seconds
            force_refresh: If True, ignore cache and recompute
            
        Returns:
            Cached or computed value
        """
        if not force_refresh:
            cached = self.get(key)
            if cached is not None:
                return cached
        
        # Compute value
        value = callback()
        
        # Cache the computed value (unless it's None)
        if value is not None:
            self.set(key, value, ttl=ttl)
        
        return value
    
    def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Atomically increment a counter.
        
        Args:
            key: Counter key
            amount: Amount to increment (default: 1)
            
        Returns:
            New counter value or None on error
        """
        if not self.is_connected():
            return None
        
        try:
            prefixed = self._prefixed_key(key)
            return self._redis_client.redis.incrby(prefixed, amount)
        except Exception as e:
            frappe.log_error("RedisCache Increment Error", f"Key: {key}, Error: {str(e)}")
            return None
    
    def decrement(self, key: str, amount: int = 1) -> Optional[int]:
        """Atomically decrement a counter.
        
        Args:
            key: Counter key
            amount: Amount to decrement (default: 1)
            
        Returns:
            New counter value or None on error
        """
        return self.increment(key, -amount)
    
    def exists(self, key: str) -> bool:
        """Check if a key exists in cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if key exists, False otherwise
        """
        if not self.is_connected():
            return False
        
        try:
            prefixed = self._prefixed_key(key)
            return self._redis_client.redis.exists(prefixed) > 0
        except Exception as e:
            frappe.log_error("RedisCache Exists Error", f"Key: {key}, Error: {str(e)}")
            return False
    
    def ttl(self, key: str) -> int:
        """Get remaining TTL for a key.
        
        Args:
            key: Cache key
            
        Returns:
            TTL in seconds, -1 if no TTL, -2 if key doesn't exist
        """
        if not self.is_connected():
            return -2
        
        try:
            prefixed = self._prefixed_key(key)
            return self._redis_client.redis.ttl(prefixed)
        except Exception as e:
            frappe.log_error("RedisCache TTL Error", f"Key: {key}, Error: {str(e)}")
            return -2
    
    def expire(self, key: str, ttl: int) -> bool:
        """Set/Update TTL for an existing key.
        
        Args:
            key: Cache key
            ttl: New TTL in seconds
            
        Returns:
            True if TTL was set, False otherwise
        """
        if not self.is_connected():
            return False
        
        try:
            prefixed = self._prefixed_key(key)
            return self._redis_client.redis.expire(prefixed, ttl)
        except Exception as e:
            frappe.log_error("RedisCache Expire Error", f"Key: {key}, Error: {str(e)}")
            return False
    
    @contextmanager
    def pipeline(self):
        """Context manager for Redis pipeline operations.
        
        Use for batch operations to reduce network round-trips.
        
        Example:
            with cache.pipeline() as pipe:
                pipe.set('key1', 'value1')
                pipe.set('key2', 'value2')
                results = pipe.execute()
        """
        pipeline = _CachePipeline(self)
        try:
            yield pipeline
        finally:
            pass  # Pipeline executes on demand
    
    def keys(self, pattern: str = "*") -> List[str]:
        """Get all keys matching a pattern.
        
        Warning: Use carefully in production - can be slow for large keyspaces.
        
        Args:
            pattern: Pattern to match
            
        Returns:
            List of matching keys (without prefix)
        """
        if not self.is_connected():
            return []
        
        try:
            prefixed_pattern = self._prefixed_key(pattern)
            keys = []
            for key in self._redis_client.redis.scan_iter(match=prefixed_pattern):
                key_str = key.decode('utf-8') if isinstance(key, bytes) else key
                # Remove prefix
                if key_str.startswith(self._cache_prefix):
                    key_str = key_str[len(self._cache_prefix):]
                keys.append(key_str)
            return keys
        except Exception as e:
            frappe.log_error("RedisCache Keys Error", f"Pattern: {pattern}, Error: {str(e)}")
            return []
    
    def flush(self) -> bool:
        """Clear all Pulse cache keys (use with caution).
        
        Returns:
            True if successful, False otherwise
        """
        return self.delete_pattern("*") > 0
    
    def info(self) -> Dict[str, Any]:
        """Get Redis server info.
        
        Returns:
            Dictionary with Redis server information
        """
        if not self.is_connected():
            return {"connected": False}
        
        try:
            info = self._redis_client.redis.info()
            return {
                "connected": True,
                "used_memory": info.get("used_memory_human", "N/A"),
                "used_memory_peak": info.get("used_memory_peak_human", "N/A"),
                "total_keys": info.get("db0", {}).get("keys", 0) if "db0" in info else "N/A",
                "uptime_days": info.get("uptime_in_days", 0),
                "version": info.get("redis_version", "N/A"),
            }
        except Exception as e:
            frappe.log_error("RedisCache Info Error", str(e))
            return {"connected": False, "error": str(e)}
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        if not self.is_connected():
            return {"connected": False}
        
        try:
            # Count pulse keys
            pulse_keys = len(self.keys("*"))
            
            # Get info
            info = self.info()
            
            return {
                "connected": True,
                "pulse_keys_count": pulse_keys,
                "redis_info": info,
            }
        except Exception as e:
            return {"connected": False, "error": str(e)}


class _CachePipeline:
    """Internal pipeline class for batch operations."""
    
    def __init__(self, cache: RedisCache):
        self.cache = cache
        self.commands = []
    
    def set(self, key: str, value: Any, ttl: int = 300):
        """Add set command to pipeline."""
        self.commands.append(('set', key, value, ttl))
        return self
    
    def get(self, key: str):
        """Add get command to pipeline."""
        self.commands.append(('get', key))
        return self
    
    def delete(self, key: str):
        """Add delete command to pipeline."""
        self.commands.append(('delete', key))
        return self
    
    def execute(self) -> List[Any]:
        """Execute all pipeline commands."""
        if not self.cache.is_connected() or not self.commands:
            return []
        
        results = []
        redis_pipeline = self.cache._redis_client.redis.pipeline()
        
        for cmd in self.commands:
            action = cmd[0]
            if action == 'set':
                _, key, value, ttl = cmd
                prefixed = self.cache._prefixed_key(key)
                serialized = self.cache._serialize(value)
                if ttl > 0:
                    redis_pipeline.setex(prefixed, ttl, serialized)
                else:
                    redis_pipeline.set(prefixed, serialized)
            elif action == 'get':
                _, key = cmd
                prefixed = self.cache._prefixed_key(key)
                redis_pipeline.get(prefixed)
            elif action == 'delete':
                _, key = cmd
                prefixed = self.cache._prefixed_key(key)
                redis_pipeline.delete(prefixed)
        
        raw_results = redis_pipeline.execute()
        
        # Deserialize results
        for i, result in enumerate(raw_results):
            cmd = self.commands[i]
            if cmd[0] == 'get' and result:
                results.append(self.cache._deserialize(result))
            else:
                results.append(result)
        
        return results


def generate_cache_key(*args, **kwargs) -> str:
    """Generate a deterministic cache key from arguments.
    
    Args:
        *args: Positional arguments to include in key
        **kwargs: Keyword arguments to include in key
        
    Returns:
        MD5 hash string suitable for use as cache key
    """
    key_parts = [cstr(a) for a in args]
    key_parts.extend(f"{k}:{cstr(v)}" for k, v in sorted(kwargs.items()))
    key_string = "|".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()


# Global cache instance
cache = RedisCache()
