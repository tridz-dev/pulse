/**
 * Pulse Frontend Cache Module
 * 
 * Exports all caching utilities for the frontend application.
 * 
 * @module cache
 */

// Query client configuration
export {
  queryClient,
  queryClientPresets,
  DEFAULT_STALE_TIME,
  DEFAULT_CACHE_TIME,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_DELAY,
  invalidateQueriesByPattern,
  prefetchQuery,
  setQueryData,
  getQueryData,
  cancelAllQueries,
  clearAllCache,
  removeQueries,
} from './queryClient';

// Cached query hooks
export {
  useCachedQuery,
  useCachedMutation,
  usePrefetch,
} from './useCachedQuery';

// Default exports
export { default } from './queryClient';
