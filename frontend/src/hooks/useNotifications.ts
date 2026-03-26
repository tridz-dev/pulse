import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '@/services/notifications';
import type { NotificationRow } from '@/services/notifications';

// Query keys for notifications
const notificationsKeys = {
  all: ['pulse', 'notifications'] as const,
  list: (limit: number, unreadOnly: boolean) => 
    ['pulse', 'notifications', 'list', limit, unreadOnly] as const,
  unreadCount: () => ['pulse', 'notifications', 'unreadCount'] as const,
};

const POLLING_INTERVAL = 30000; // 30 seconds

export type UseNotificationsOptions = {
  limit?: number;
  unreadOnly?: boolean;
  enablePolling?: boolean;
  enableBrowserNotifications?: boolean;
};

export type UseNotificationsReturn = {
  // Data
  notifications: NotificationRow[];
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  
  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
  
  // Status
  hasNewNotifications: boolean;
  isMarkingAsRead: boolean;
  isMarkingAllAsRead: boolean;
  
  // Browser notifications
  browserNotificationsEnabled: boolean;
  requestBrowserPermission: () => Promise<boolean>;
};

/**
 * Hook for managing desktop notifications
 * 
 * Features:
 * - Polls for new notifications every 30 seconds
 * - Tracks unread count for badge display
 * - Mark individual or all notifications as read
 * - Browser notification API integration
 * 
 * @example
 * ```tsx
 * const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({
 *   limit: 20,
 *   enablePolling: true,
 *   enableBrowserNotifications: true,
 * });
 * ```
 */
export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    limit = 50,
    unreadOnly = false,
    enablePolling = true,
    enableBrowserNotifications = false,
  } = options;

  const queryClient = useQueryClient();
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const previousUnreadCount = useRef(0);

  // Query for notifications list
  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: notificationsKeys.list(limit, unreadOnly),
    queryFn: () => getNotifications(limit, unreadOnly),
    refetchInterval: enablePolling ? POLLING_INTERVAL : false,
    staleTime: 15000, // 15 seconds
  });

  // Separate query for unread count (faster, lighter)
  const {
    data: unreadCount = 0,
    refetch: refetchUnreadCount,
  } = useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: getUnreadCount,
    refetchInterval: enablePolling ? POLLING_INTERVAL : false,
    staleTime: 10000, // 10 seconds
  });

  // Detect new notifications
  useEffect(() => {
    if (previousUnreadCount.current > 0 && unreadCount > previousUnreadCount.current) {
      setHasNewNotifications(true);
      
      // Show browser notification if enabled
      if (enableBrowserNotifications && browserNotificationsEnabled && Notification.permission === 'granted') {
        showBrowserNotification('New Notification', 'You have a new notification in Pulse');
      }
    }
    previousUnreadCount.current = unreadCount;
  }, [unreadCount, enableBrowserNotifications, browserNotificationsEnabled]);

  // Reset "new" indicator after viewing
  useEffect(() => {
    if (unreadCount === 0) {
      setHasNewNotifications(false);
    }
  }, [unreadCount]);

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      // Invalidate both queries to refresh data
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      // Invalidate both queries to refresh data
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
      setHasNewNotifications(false);
    },
  });

  // Manual refresh function
  const refresh = useCallback(async () => {
    await Promise.all([
      refetchNotifications(),
      refetchUnreadCount(),
    ]);
  }, [refetchNotifications, refetchUnreadCount]);

  // Request browser notification permission
  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      setBrowserNotificationsEnabled(true);
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission has been denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setBrowserNotificationsEnabled(granted);
    return granted;
  }, []);

  // Initialize browser notifications if enabled
  useEffect(() => {
    if (enableBrowserNotifications) {
      requestBrowserPermission();
    }
  }, [enableBrowserNotifications, requestBrowserPermission]);

  // Handle browser notification permission changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh notifications when tab becomes visible
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isError,
    error: error as Error | null,
    markAsRead: async (id: string) => {
      await markAsReadMutation.mutateAsync(id);
    },
    markAllAsRead: async () => {
      await markAllAsReadMutation.mutateAsync();
    },
    refresh,
    hasNewNotifications,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    browserNotificationsEnabled,
    requestBrowserPermission,
  };
}

/**
 * Show a browser notification
 */
function showBrowserNotification(title: string, body: string): void {
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      icon: '/assets/pulse/favicon.png',
      badge: '/assets/pulse/favicon.png',
      tag: 'pulse-notification',
      requireInteraction: false,
    });
  } catch (err) {
    console.error('Failed to show browser notification:', err);
  }
}

/**
 * Simple hook for just the unread count (lightweight)
 */
export function useUnreadCount(enablePolling = true): {
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const { data: unreadCount = 0, isLoading, refetch } = useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: getUnreadCount,
    refetchInterval: enablePolling ? POLLING_INTERVAL : false,
    staleTime: 10000,
  });

  return {
    unreadCount,
    isLoading,
    refresh: async () => {
      await refetch();
    },
  };
}

export default useNotifications;
