import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Loader2, AlertCircle } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationRow } from '@/services/notifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from '@/lib/dateUtils';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Severity icon mapping
const severityConfig = {
  Critical: { color: 'text-red-500', bg: 'bg-red-500/10' },
  Warning: { color: 'text-amber-500', bg: 'bg-amber-500/10' },
  Info: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
};

// Notification type to icon mapping
const typeConfig: Record<string, { icon: string; label: string }> = {
  RunAlert: { icon: '📋', label: 'Run Alert' },
  ItemFail: { icon: '❌', label: 'Item Failed' },
  FollowUpCreated: { icon: '🔔', label: 'Follow-up' },
  System: { icon: '⚙️', label: 'System' },
  Custom: { icon: '📢', label: 'Notification' },
};

/**
 * NotificationDropdown Component
 * 
 * Features:
 * - Bell icon with unread count badge
 * - Dropdown panel showing recent notifications
 * - Mark as read / mark all as read buttons
 * - Click notification to navigate
 * - Real-time indicator (green dot when new)
 */
export function NotificationDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const {
    notifications,
    unreadCount,
    isLoading,
    isError,
    markAsRead,
    markAllAsRead,
    refresh,
    hasNewNotifications,
    isMarkingAsRead,
    isMarkingAllAsRead,
  } = useNotifications({
    limit: 20,
    enablePolling: true,
    enableBrowserNotifications: false, // Can be enabled via settings
  });

  // Clear "new" indicator when dropdown is opened
  useEffect(() => {
    if (isOpen) {
      setHasInteracted(true);
    }
  }, [isOpen]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  // Handle notification click
  const handleNotificationClick = useCallback(async (notification: NotificationRow) => {
    // Mark as read if unread
    if (!notification.is_read) {
      await markAsRead(notification.name);
    }

    // Navigate if there's a source
    if (notification.source_doctype && notification.source_name) {
      // Map doctype to route
      const route = getRouteForDoctype(notification.source_doctype, notification.source_name);
      if (route) {
        navigate(route);
      }
    }

    setIsOpen(false);
  }, [markAsRead, navigate]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await markAllAsRead();
  }, [markAllAsRead]);

  // Handle mark single as read
  const handleMarkAsRead = useCallback(async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    e.preventDefault();
    await markAsRead(notificationId);
  }, [markAsRead]);

  // Show real-time indicator
  const showRealtimeIndicator = hasNewNotifications && !hasInteracted && !isOpen;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="relative p-2 h-9 w-9 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell size={18} />
          
          {/* Unread count badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-medium text-white ring-2 ring-zinc-950">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          
          {/* Real-time indicator (green dot) */}
          {showRealtimeIndicator && (
            <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse ring-2 ring-zinc-950" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="end" 
        className="w-96 max-h-[70vh] overflow-hidden bg-zinc-900 border-zinc-800 p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-zinc-100">
            Notifications
          </DropdownMenuLabel>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAllAsRead}
              >
                {isMarkingAllAsRead ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <CheckCheck size={12} className="mr-1" />
                )}
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <div className="max-h-[50vh] overflow-y-auto">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-zinc-500" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <AlertCircle size={24} className="text-red-500 mb-2" />
              <p className="text-sm text-zinc-400">Failed to load notifications</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell size={24} className="text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-400">No notifications</p>
              <p className="text-xs text-zinc-500 mt-1">
                You&apos;ll see alerts for runs, follow-ups, and system messages here
              </p>
            </div>
          ) : (
            notifications.map((notification, index) => (
              <NotificationItem
                key={notification.name}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                onMarkAsRead={(e) => handleMarkAsRead(e, notification.name)}
                isMarking={isMarkingAsRead}
                isLast={index === notifications.length - 1}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 bg-zinc-900/50">
          <DropdownMenuItem
            className="justify-center py-2.5 text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
            onClick={() => {
              navigate('/go/alerts');
              setIsOpen(false);
            }}
          >
            View all notifications
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Individual notification item
interface NotificationItemProps {
  notification: NotificationRow;
  onClick: () => void;
  onMarkAsRead: (e: React.MouseEvent) => void;
  isMarking: boolean;
  isLast: boolean;
}

function NotificationItem({ notification, onClick, onMarkAsRead, isMarking, isLast }: NotificationItemProps) {
  const isUnread = !notification.is_read;
  const severity = notification.severity || 'Info';
  const type = notification.notification_type || 'Custom';
  const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.Info;
  const typeInfo = typeConfig[type] || typeConfig.Custom;

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 py-3 cursor-pointer transition-colors',
        'hover:bg-zinc-800/50',
        isUnread && 'bg-zinc-800/30',
        !isLast && 'border-b border-zinc-800/50'
      )}
      onClick={onClick}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
      )}

      {/* Icon */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg',
        config.bg
      )}>
        {typeInfo.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm truncate',
            isUnread ? 'font-medium text-zinc-100' : 'text-zinc-300'
          )}>
            {notification.title}
          </p>
          
          {/* Mark as read button (visible on hover for unread items) */}
          {isUnread && (
            <button
              onClick={onMarkAsRead}
              disabled={isMarking}
              className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-opacity"
              title="Mark as read"
            >
              {isMarking ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
            </button>
          )}
        </div>

      {notification.body && (
          <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
            {notification.body}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn('text-[10px] uppercase tracking-wide', config.color)}>
            {typeInfo.label}
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-[10px] text-zinc-500">
            {notification.creation && formatDistanceToNow(notification.creation)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Helper to map doctype to route
function getRouteForDoctype(doctype: string, name: string): string | null {
  const mapping: Record<string, string> = {
    'SOP Run': '/go/runs',
    'SOP Template': '/go/templates',
    'Pulse Employee': '/go/employees',
    'SOP Follow-up': '/go/followups',
    'Corrective Action': '/go/corrective-actions',
  };

  const baseRoute = mapping[doctype];
  return baseRoute ? `${baseRoute}/${name}` : null;
}

export default NotificationDropdown;
