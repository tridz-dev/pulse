/**
 * Enhanced TanStack Query client configuration for Pulse application.
 * 
 * Provides optimized caching with:
 * - Extended stale time for better UX
 * - Smart background refetching
 * - Error retry with exponential backoff
 * - Query deduplication
 * 
 * @module cache/queryClient
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Default stale time for queries (5 minutes)
 * Data remains fresh for 5 minutes before refetching
 */
export const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default cache time for queries (30 minutes)
 * Inactive data is kept in cache for 30 minutes
 */
export const DEFAULT_CACHE_TIME = 30 * 60 * 1000;

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY = (attemptIndex: number) => 
  Math.min(1000 * 2 ** attemptIndex, 30000);

/**
 * Enhanced QueryClient with Pulse-specific defaults
 * 
 * Features:
 * - 5 minute stale time for optimal UX
 * - 30 minute cache time for performance
 * - 3 retries with exponential backoff
 * - Disabled window focus refetching for smoother UX
 * - Global error handling
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Global query error handler
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      // Don't show toast for background refetches
      if (query.state.fetchStatus !== 'idle') {
        console.error('Query error:', errorMessage);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Global mutation error handler
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      // Show toast for user-initiated mutations
      if (mutation.options.mutationKey?.includes('user-action')) {
        toast.error(errorMessage);
      }
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      // Show success toast for specific mutations
      if (mutation.options.mutationKey?.includes('show-success')) {
        toast.success('Operation completed successfully');
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Data freshness settings
      staleTime: DEFAULT_STALE_TIME,
      gcTime: DEFAULT_CACHE_TIME,
      
      // Retry configuration
      retry: DEFAULT_RETRY_COUNT,
      retryDelay: DEFAULT_RETRY_DELAY,
      
      // Refetch behavior
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      
      // Network settings
      networkMode: 'online',
      
      // Loading behavior
      placeholderData: (previousData: unknown) => previousData,
      
      // Error handling
      throwOnError: false,
    },
    mutations: {
      // Retry configuration for mutations
      retry: 1,
      retryDelay: 1000,
      
      // Network settings
      networkMode: 'online',
      
      // Error handling
      throwOnError: false,
    },
  },
});

/**
 * Query client configuration presets for different use cases
 */
export const queryClientPresets = {
  /**
   * Real-time data preset
   * Use for data that changes frequently
   */
  realtime: {
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // 30 seconds
  },
  
  /**
   * Static data preset
   * Use for reference data that rarely changes
   */
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
  
  /**
   * User data preset
   * Use for user-specific data
   */
  userData: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  
  /**
   * Analytics data preset
   * Use for reports and analytics
   */
  analytics: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },
  
  /**
   * Search results preset
   * Use for search queries
   */
  search: {
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
};

/**
 * Helper to invalidate queries by pattern
 * 
 * @param queryKeyPrefix - Query key prefix to match
 */
export function invalidateQueriesByPattern(queryKeyPrefix: string[]): void {
  queryClient.invalidateQueries({
    queryKey: queryKeyPrefix,
    refetchType: 'active',
  });
}

/**
 * Helper to prefetch data for a query
 * 
 * @param queryKey - Query key
 * @param queryFn - Query function
 * @param options - Additional options
 */
export function prefetchQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
  options?: { staleTime?: number }
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
  });
}

/**
 * Helper to set query data immediately
 * 
 * @param queryKey - Query key
 * @param data - Data to set
 */
export function setQueryData<T>(queryKey: unknown[], data: T): void {
  queryClient.setQueryData(queryKey, data);
}

/**
 * Helper to get query data
 * 
 * @param queryKey - Query key
 * @returns Query data or undefined
 */
export function getQueryData<T>(queryKey: unknown[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Helper to cancel all ongoing queries
 * Useful when navigating away from a page
 */
export function cancelAllQueries(): Promise<void> {
  return queryClient.cancelQueries();
}

/**
 * Helper to clear all cache
 * Use with caution - only for logout/reset scenarios
 */
export function clearAllCache(): void {
  queryClient.clear();
}

/**
 * Helper to remove specific queries from cache
 * 
 * @param queryKey - Query key to remove
 */
export function removeQueries(queryKey: unknown[]): void {
  queryClient.removeQueries({ queryKey, exact: true });
}

export default queryClient;
