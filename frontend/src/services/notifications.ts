import { call } from '@/lib/frappe-sdk';

export type NotificationType = 'RunAlert' | 'ItemFail' | 'FollowUpCreated' | 'System' | 'Custom';
export type NotificationSeverity = 'Info' | 'Warning' | 'Critical';
export type NotificationPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export type NotificationRow = {
  name: string;
  title: string;
  body?: string | null;
  notification_type?: NotificationType;
  severity?: NotificationSeverity;
  priority?: NotificationPriority;
  source_doctype?: string | null;
  source_name?: string | null;
  is_read?: number | boolean;
  creation?: string;
  read_at?: string | null;
};

export type UnreadCountResponse = {
  count: number;
};

export type MarkReadResponse = {
  success: boolean;
  message?: string;
};

export type MarkAllReadResponse = {
  success: boolean;
  count: number;
  message: string;
};

/**
 * Get current user's notifications
 * @param limit Maximum number of notifications to return (default: 50)
 * @param unreadOnly If true, return only unread notifications
 */
export async function getNotifications(
  limit = 50,
  unreadOnly = false
): Promise<NotificationRow[]> {
  const res = await call.get('pulse.api.notifications.get_notifications', {
    limit,
    unread_only: unreadOnly ? 1 : 0,
  });
  return (res.message as NotificationRow[]) ?? [];
}

/**
 * Legacy alias for getNotifications
 * @deprecated Use getNotifications instead
 */
export async function getMyNotifications(limit = 30, unreadOnly = false): Promise<NotificationRow[]> {
  return getNotifications(limit, unreadOnly);
}

/**
 * Get count of unread notifications for badge display
 */
export async function getUnreadCount(): Promise<number> {
  const res = await call.get('pulse.api.notifications.get_unread_count');
  return (res.message as number) ?? 0;
}

/**
 * Mark a single notification as read
 * @param notificationId The ID of the notification to mark as read
 */
export async function markAsRead(notificationId: string): Promise<MarkReadResponse> {
  const res = await call.post('pulse.api.notifications.mark_as_read', {
    notification_id: notificationId,
  });
  return (res.message as MarkReadResponse) ?? { success: false };
}

/**
 * Legacy alias for markAsRead
 * @deprecated Use markAsRead instead
 */
export async function markNotificationRead(notificationName: string): Promise<void> {
  await markAsRead(notificationName);
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<MarkAllReadResponse> {
  const res = await call.post('pulse.api.notifications.mark_all_as_read', {});
  return (res.message as MarkAllReadResponse) ?? { success: false, count: 0, message: '' };
}

/**
 * Legacy alias for markAllAsRead
 * @deprecated Use markAllAsRead instead
 */
export async function markAllNotificationsRead(): Promise<void> {
  await markAllAsRead();
}

/**
 * Create a new notification (for internal use by other services)
 * Note: This requires appropriate permissions
 */
export async function createNotification(
  user: string,
  title: string,
  message: string,
  type: NotificationType = 'Custom',
  link?: string
): Promise<{ name: string } | null> {
  // Parse link to extract doctype and docname if provided
  let sourceDoctype: string | undefined;
  let sourceName: string | undefined;
  
  if (link) {
    // Expected format: /go/runs/RUN-00001 or similar
    const parts = link.split('/').filter(Boolean);
    if (parts.length >= 2) {
      sourceDoctype = parts[0];
      sourceName = parts[parts.length - 1];
    }
  }

  const res = await call.post('pulse.api.notifications.create_notification', {
    recipient: user,
    title,
    body: message,
    notif_type: type,
    source_doctype: sourceDoctype,
    source_name: sourceName,
  });
  
  return res.message ? { name: res.message as string } : null;
}
