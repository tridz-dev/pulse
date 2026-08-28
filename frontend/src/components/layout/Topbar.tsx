import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Bell, Menu } from 'lucide-react';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/notifications';
import type { NotificationItem } from '@/services/notifications';

interface TopbarProps {
  onOpenMobileNav?: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await listNotifications();
      setNotifications(response.items);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();

    // Background refresh every 60 seconds
    const intervalId = setInterval(() => {
      void fetchNotifications();
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const handleDropdownOpenChange = (open: boolean) => {
    setDropdownOpen(open);
    if (open) {
      void fetchNotifications();
    }
  };

  const handleMarkRead = async (notificationName: string) => {
    try {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n =>
          n.name === notificationName ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Sync with backend
      await markNotificationRead(notificationName);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Refetch to sync state if the operation failed
      void fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);

      // Sync with backend
      await markAllNotificationsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Refetch to sync state if the operation failed
      void fetchNotifications();
    }
  };

  return (
    <header className="h-12 w-full flex items-center justify-between px-6 border-b border-rule bg-slab backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="md:hidden p-3 -ml-3 mr-1 text-mute hover:text-text hover:bg-slab-2 rounded transition-colors"
          title="Open navigation"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
          <DropdownMenuTrigger
            className="relative p-2 text-mute hover:text-text hover:bg-slab-2 rounded-[var(--radius)] transition-colors outline-none"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-[3px] rounded-[var(--radius)] bg-fail text-white text-[9px] leading-[14px] text-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-64 bg-slab border-rule p-0">
            <div className="flex items-center justify-between px-2 py-2 border-b border-rule">
              <DropdownMenuLabel className="text-mute font-mono text-[10px] uppercase tracking-wide m-0">
                Notifications
              </DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-sel hover:text-text px-2 py-1 rounded-[var(--radius)] transition-colors"
                  title="Mark all as read"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="px-2 py-3 text-xs text-faint">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="px-2 py-3 text-xs text-faint">No notifications</div>
              ) : (
                <div className="divide-y divide-rule">
                  {notifications.map(notification => (
                    <button
                      key={notification.name}
                      type="button"
                      onClick={() => {
                        if (!notification.isRead) {
                          void handleMarkRead(notification.name);
                        }
                      }}
                      className={`w-full text-left px-2 py-2 text-xs transition-colors hover:bg-slab-2 ${
                        notification.isRead ? 'text-faint' : 'font-medium text-text'
                      }`}
                    >
                      <div className="line-clamp-2">{notification.title}</div>
                      <div className="text-[10px] text-faint mt-1 opacity-60">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
