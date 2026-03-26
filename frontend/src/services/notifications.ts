import { call } from '@/lib/frappe-sdk';

export type NotificationRow = {
  name: string;
  title: string;
  body?: string | null;
  notification_type?: string;
  severity?: string;
  priority?: string;
  source_doctype?: string | null;
  source_name?: string | null;
  is_read?: number | boolean;
  creation?: string;
};

export async function getMyNotifications(limit = 30, unreadOnly = false): Promise<NotificationRow[]> {
  const res = await call.get('pulse.api.notifications.get_my_notifications', {
    limit,
    unread_only: unreadOnly ? 1 : 0,
  });
  return (res.message as NotificationRow[]) ?? [];
}

export async function markNotificationRead(notificationName: string): Promise<void> {
  await call.post('pulse.api.notifications.mark_notification_read', {
    notification_name: notificationName,
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await call.post('pulse.api.notifications.mark_all_read', {});
}
