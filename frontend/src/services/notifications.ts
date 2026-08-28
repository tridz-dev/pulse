import { call } from '@/lib/frappe-sdk';

export interface NotificationItem {
  name: string;
  kind: string;
  title: string;
  referenceDoctype: string | null;
  referenceName: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ListNotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
  page: number;
  page_size: number;
  total: number;
}

export interface MarkNotificationReadResponse {
  name: string;
  isRead: boolean;
}

export interface MarkAllNotificationsReadResponse {
  updated: number;
}

export async function listNotifications(
  unreadOnly?: boolean,
  page?: number,
  pageSize?: number
): Promise<ListNotificationsResponse> {
  const res = await call.get('pulse.api.notifications.list_notifications', {
    unread_only: unreadOnly || undefined,
    page: page || undefined,
    page_size: pageSize || undefined,
  });
  return res.message as ListNotificationsResponse;
}

export async function markNotificationRead(
  name: string
): Promise<MarkNotificationReadResponse> {
  const res = await call.post('pulse.api.notifications.mark_notification_read', {
    name,
  });
  return res.message as MarkNotificationReadResponse;
}

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResponse> {
  const res = await call.post('pulse.api.notifications.mark_all_notifications_read', {});
  return res.message as MarkAllNotificationsReadResponse;
}
