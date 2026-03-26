/**
 * Enhanced query hook with caching, optimistic updates, and prefetching.
 * 
 * Provides a convenient wrapper around TanStack Query with:
 * - Automatic background refetch
 * - Optimistic updates
 * - Prefetching support
 * - Smart error handling
 * 
 * @module cache/useCachedQuery
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';

import { prefetchQuery } from './queryClient';

/**
 * Options for useCachedQuery hook
 */
interface UseCachedQueryOptions<TData, TError = Error> extends Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'> {
  /** Enable background refetch on window focus */
  backgroundRefetch?: boolean;
  /** Prefetch related data */
  prefetch?: Array<{ key: QueryKey; fn: () => Promise<unknown> }>;
  /** Callback when data is fetched */
  onSuccess?: (data: TData) => void;
  /** Callback on error */
  onError?: (error: TError) => void;
}

/**
 * Enhanced query hook with caching capabilities
 * 
 * @param queryKey - Unique key for this query
 * @param fetcher - Function to fetch data
 * @param options - Additional options
 * @returns Query result with data, loading state, and helper methods
 * 
 * @example
 * ```tsx
 * const { data, isLoading, refetch, optimisticUpdate } = useCachedQuery(
 *   ['employee', employeeId],
 *   () => fetchEmployee(employeeId),
 *   { ttl: 5 * 60 * 1000 }
 * );
 * ```
 */
export function useCachedQuery<TData, TError = Error>(
  queryKey: QueryKey,
  fetcher: () => Promise<TData>,
  options: UseCachedQueryOptions<TData, TError> = {}
) {
  const {
    backgroundRefetch = false,
    prefetch = [],
    onSuccess,
    onError,
    ...queryOptions
  } = options;

  const queryClient = useQueryClient();
  const prefetchRef = useRef(false);

  // Main query
  const query = useQuery<TData, TError>({
    queryKey,
    queryFn: fetcher,
    refetchOnWindowFocus: backgroundRefetch,
    ...queryOptions,
  });

  // Handle prefetching
  useEffect(() => {
    if (prefetch.length > 0 && !prefetchRef.current && query.data) {
      prefetchRef.current = true;
      
      // Prefetch related data after main query succeeds
      prefetch.forEach(({ key, fn }: { key: QueryKey; fn: () => Promise<unknown> }) => {
        prefetchQuery(key as unknown[], fn as () => Promise<unknown>);
      });
    }
  }, [query.data, prefetch]);

  // Handle callbacks
  useEffect(() => {
    if (query.data && onSuccess) {
      onSuccess(query.data);
    }
  }, [query.data, onSuccess]);

  useEffect(() => {
    if (query.error && onError) {
      onError(query.error as TError);
    }
  }, [query.error, onError]);

  /**
   * Perform optimistic update
   * Updates cache immediately, reverts on error
   */
  const optimisticUpdate = useCallback(
    (updater: (oldData: TData | undefined) => TData) => {
      const previousData = queryClient.getQueryData<TData>(queryKey);
      const newData = updater(previousData);
      
      // Optimistically update cache
      queryClient.setQueryData(queryKey, newData);
      
      // Return rollback function
      return () => {
        queryClient.setQueryData(queryKey, previousData);
      };
    },
    [queryClient, queryKey]
  );

  /**
   * Invalidate and refetch this query
   */
  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  /**
   * Cancel ongoing request
   */
  const cancel = useCallback(() => {
    return queryClient.cancelQueries({ queryKey });
  }, [queryClient, queryKey]);

  /**
   * Set query data directly
   */
  const setData = useCallback(
    (updater: TData | ((old: TData | undefined) => TData)) => {
      queryClient.setQueryData(queryKey, updater);
    },
    [queryClient, queryKey]
  );

  return {
    ...query,
    optimisticUpdate,
    invalidate,
    cancel,
    setData,
  };
}

/**
 * Options for useCachedMutation hook
 */
interface UseCachedMutationOptions<TData, TError, TVariables, TContext> 
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> {
  /** Query keys to invalidate on success */
  invalidateKeys?: QueryKey[];
  /** Query keys to refetch on success (without invalidating) */
  refetchKeys?: QueryKey[];
  /** Show success toast */
  showSuccess?: boolean;
  /** Success message */
  successMessage?: string;
  /** Show error toast */
  showError?: boolean;
}

/**
 * Enhanced mutation hook with cache invalidation
 * 
 * @param mutationFn - Mutation function
 * @param options - Mutation options
 * @returns Mutation result with mutate function
 * 
 * @example
 * ```tsx
 * const mutation = useCachedMutation(
 *   (data) => updateEmployee(data),
 *   {
 *     invalidateKeys: [['employees', 'list']],
 *     successMessage: 'Employee updated successfully'
 *   }
 * );
 * ```
 */
export function useCachedMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseCachedMutationOptions<TData, TError, TVariables, TContext> = {}
) {
  const {
    invalidateKeys = [],
    refetchKeys = [],
    showSuccess = false,
    successMessage,
    showError = true,
    ...mutationOptions
  } = options;

  const queryClient = useQueryClient();

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    mutationFn,
    ...mutationOptions,
    onSuccess: (data, variables, context) => {
      // Invalidate specified queries
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Refetch specified queries (without invalidating)
      refetchKeys.forEach((key) => {
        queryClient.refetchQueries({ queryKey: key });
      });

      // Call original onSuccess (may have different signature in v5)
      const originalOnSuccess = mutationOptions.onSuccess;
      if (originalOnSuccess) {
        (originalOnSuccess as unknown as (d: TData, v: TVariables, c: TContext) => void)(data, variables, context);
      }
    },
  });

  return mutation;
}

/**
 * Hook for prefetching data on hover/focus
 * 
 * @param queryKey - Query key to prefetch
 * @param fetcher - Function to fetch data
 * @returns Object with prefetch handler
 * 
 * @example
 * ```tsx
 * const { prefetch } = usePrefetch(['employee', id], () => fetchEmployee(id));
 * 
 * <Link onMouseEnter={prefetch} to={`/employee/${id}`}>
 *   View Employee
 * </Link>
 * ```
 */
export function usePrefetch<TData>(
  queryKey: QueryKey,
  fetcher: () => Promise<TData>
) {
  const prefetch = useCallback(() => {
    prefetchQuery(queryKey as unknown[], fetcher as () => Promise<unknown>);
  }, [queryKey, fetcher]);

  return { prefetch };
}

export default useCachedQuery;
