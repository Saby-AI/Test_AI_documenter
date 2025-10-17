"""
Token-Only Caching System for AIVA MCP Server
Provides efficient caching EXCLUSIVELY for GitHub tokens and Azure credentials.

Features:
- Thread-safe caching with TTL (Time To Live)
- Automatic expiration and refresh
- Performance monitoring
- Memory-efficient storage
- RESTRICTED: Only caches authentication tokens, NOT tool descriptions or operation selections

Version: 1.2.0
Date: 06/09/2025
"""

import os
import time
import threading
import logging
from typing import Any, Dict, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import hashlib

logger = logging.getLogger(__name__)

@dataclass
class CacheEntry:
    """Represents a cached credential item with metadata"""
    value: Any
    created_at: float
    expires_at: float
    access_count: int = 0
    last_accessed: float = field(default_factory=time.time)
    
    def is_expired(self) -> bool:
        """Check if the cache entry has expired"""
        return time.time() > self.expires_at
    
    def is_valid(self) -> bool:
        """Check if the cache entry is valid (not expired and has value)"""
        return not self.is_expired() and self.value is not None
    
    def access(self) -> Any:
        """Access the cached value and update access statistics"""
        self.access_count += 1
        self.last_accessed = time.time()
        return self.value

class CredentialCache:
    """
    Thread-safe cache specifically for credentials with TTL and performance monitoring
    """
    
    def __init__(self, default_ttl: int = 3600, max_size: int = 50):
        """
        Initialize the credential cache
        
        Args:
            default_ttl: Default time-to-live in seconds
            max_size: Maximum number of credential items to cache
        """
        self.default_ttl = default_ttl
        self.max_size = max_size
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
        
        # Performance metrics
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        
        # Cleanup thread
        self._cleanup_interval = 300  # 5 minutes
        self._last_cleanup = time.time()
    
    def _cleanup_expired(self):
        """Remove expired entries from cache"""
        if time.time() - self._last_cleanup < self._cleanup_interval:
            return
        
        with self._lock:
            expired_keys = [
                key for key, entry in self._cache.items() 
                if entry.is_expired()
            ]
            
            for key in expired_keys:
                del self._cache[key]
                self._evictions += 1
            
            self._last_cleanup = time.time()
            
            if expired_keys:
                logger.debug(f"Credential cache cleanup: removed {len(expired_keys)} expired entries")
    
    def _evict_lru(self):
        """Evict least recently used items if cache is full"""
        if len(self._cache) < self.max_size:
            return
        
        # Sort by last access time and remove oldest
        sorted_items = sorted(
            self._cache.items(),
            key=lambda x: x[1].last_accessed
        )
        
        # Remove 20% of cache to make room
        items_to_remove = max(1, len(sorted_items) // 5)
        
        for key, _ in sorted_items[:items_to_remove]:
            del self._cache[key]
            self._evictions += 1
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get a credential from cache
        
        Args:
            key: Cache key
            
        Returns:
            Cached credential or None if not found/expired
        """
        with self._lock:
            self._cleanup_expired()
            
            if key in self._cache:
                entry = self._cache[key]
                if entry.is_valid():
                    self._hits += 1
                    return entry.access()
                else:
                    # Remove expired entry
                    del self._cache[key]
            
            self._misses += 1
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """
        Set a credential in cache
        
        Args:
            key: Cache key
            value: Credential to cache
            ttl: Time-to-live in seconds (uses default if None)
        """
        ttl = ttl or self.default_ttl
        
        with self._lock:
            self._evict_lru()
            
            now = time.time()
            entry = CacheEntry(
                value=value,
                created_at=now,
                expires_at=now + ttl
            )
            
            self._cache[key] = entry
    
    def get_or_set(self, key: str, factory: Callable, ttl: Optional[int] = None) -> Any:
        """
        Get credential from cache or create it using factory function
        
        Args:
            key: Cache key
            factory: Function to create credential if not cached
            ttl: Time-to-live in seconds
            
        Returns:
            Cached or newly created credential
        """
        value = self.get(key)
        if value is not None:
            return value
        
        # Create new value
        try:
            value = factory()
            if value is not None:
                self.set(key, value, ttl)
            return value
        except Exception as e:
            logger.error(f"Factory function failed for key {key}: {e}")
            return None
    
    def invalidate(self, key: str):
        """Remove a specific key from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
    
    def clear(self):
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
            self._evictions = 0
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests * 100) if total_requests > 0 else 0
            
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "evictions": self._evictions,
                "hit_rate": f"{hit_rate:.2f}%",
                "total_requests": total_requests
            }

class GitHubTokenCache:
    """Specialized cache for GitHub tokens with validation"""
    
    def __init__(self, cache: CredentialCache):
        self.cache = cache
        self.token_ttl = 3600  # 1 hour
    
    def get_token(self) -> Optional[str]:
        """Get cached GitHub token"""
        return self.cache.get("github_token")
    
    def set_token(self, token: str):
        """Cache GitHub token with validation"""
        if not token or len(token) < 10:
            logger.warning("Invalid GitHub token provided for caching")
            return
        
        # Cache token but don't log the actual value for security
        self.cache.set("github_token", token, self.token_ttl)
        logger.info(f"GitHub token cached (length: {len(token)})")
    
    def get_or_fetch_token(self) -> Optional[str]:
        """Get token from cache or environment"""
        def fetch_token():
            token = os.getenv("GITHUB_TOKEN", "")
            if token:
                logger.info(f"Fetched GitHub token from environment (length: {len(token)})")
            else:
                logger.warning("No GitHub token found in environment")
            return token if token else None
        
        return self.cache.get_or_set("github_token", fetch_token, self.token_ttl)
    
    def invalidate(self):
        """Remove GitHub token from cache"""
        self.cache.invalidate("github_token")
        logger.info("GitHub token cache invalidated")

class AzureCredentialCache:
    """Specialized cache for Azure credentials"""
    
    def __init__(self, cache: CredentialCache):
        self.cache = cache
        self.credential_ttl = 1800  # 30 minutes
        self.token_ttl = 3000  # 50 minutes (Azure tokens last 60 minutes)
    
    def get_credential(self):
        """Get cached Azure credential"""
        return self.cache.get("azure_credential")
    
    def set_credential(self, credential):
        """Cache Azure credential"""
        self.cache.set("azure_credential", credential, self.credential_ttl)
        logger.info("Azure credential cached")
    
    def get_or_create_credential(self):
        """Get credential from cache or create new one"""
        def create_credential():
            try:
                from azure.identity import DefaultAzureCredential
                credential = DefaultAzureCredential()
                logger.info("Created new Azure credential")
                return credential
            except Exception as e:
                logger.error(f"Failed to create Azure credential: {e}")
                return None
        
        return self.cache.get_or_set("azure_credential", create_credential, self.credential_ttl)
    
    def get_token(self, *scopes) -> Optional[str]:
        """Get cached Azure token for specific scopes"""
        scope_key = "azure_token_" + "|".join(sorted(scopes))
        return self.cache.get(scope_key)
    
    def cache_token(self, token, *scopes):
        """Cache Azure token for specific scopes"""
        scope_key = "azure_token_" + "|".join(sorted(scopes))
        token_value = token.token if hasattr(token, 'token') else str(token)
        self.cache.set(scope_key, token_value, self.token_ttl)
        logger.info(f"Azure token cached for scopes: {', '.join(scopes)}")
    
    def get_or_fetch_token(self, *scopes):
        """Get token from cache or fetch new one"""
        scope_key = "azure_token_" + "|".join(sorted(scopes))
        
        def fetch_token():
            try:
                credential = self.get_or_create_credential()
                if credential:
                    token = credential.get_token(*scopes)
                    logger.info(f"Fetched new Azure token for scopes: {', '.join(scopes)}")
                    return token
                return None
            except Exception as e:
                logger.error(f"Failed to fetch Azure token: {e}")
                return None
        
        return self.cache.get_or_set(scope_key, fetch_token, self.token_ttl)
    
    def invalidate_credentials(self):
        """Remove all Azure credentials from cache"""
        self.cache.invalidate("azure_credential")
        logger.info("Azure credential cache invalidated")
    
    def invalidate_tokens(self):
        """Remove all Azure tokens from cache"""
        # Remove all entries that start with "azure_token_"
        with self.cache._lock:
            token_keys = [key for key in self.cache._cache.keys() if key.startswith("azure_token_")]
            for key in token_keys:
                self.cache.invalidate(key)
        logger.info("Azure token cache invalidated")

# Global cache instance - focused only on credentials
_credential_cache = CredentialCache(default_ttl=3600, max_size=50)
github_cache = GitHubTokenCache(_credential_cache)
azure_cache = AzureCredentialCache(_credential_cache)

def get_cache_stats() -> Dict[str, Any]:
    """Get credential cache statistics"""
    return _credential_cache.stats()

def clear_all_caches():
    """Clear all credential caches"""
    _credential_cache.clear()
    logger.info("All credential caches cleared")

# ---------------- Lazy Caching Loader (shared) ----------------
def lazy_load_caching():
    """
    Shared lazy loader for Azure/GitHub token caching. Use this in place of _lazy_load_caching in server.py and github_integration_tool.py.
    """
    global CACHING_AVAILABLE, github_cache, azure_cache, get_cache_stats, clear_all_caches
    import os, sys, json, logging
    logger = logging.getLogger(__name__)
    USE_AZURE_TOKEN_CACHE = os.getenv("USE_AZURE_TOKEN_CACHE", "false").lower() in ("true", "1", "yes", "y")
    USE_GITHUB_TOKEN_CACHE = os.getenv("USE_GITHUB_TOKEN_CACHE", "false").lower() in ("true", "1", "yes", "y")
    if not (USE_AZURE_TOKEN_CACHE or USE_GITHUB_TOKEN_CACHE):
        logger.info("Token caching is DISABLED for both Azure and GitHub (real-time token retrieval in use).")
        return
    if globals().get('_cache_loaded', False):
        return
    try:
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    except Exception as e:
        logger.error(f"Error determining project root: {e}")
