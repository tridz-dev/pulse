import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { useAuth } from '@/store/AuthContext';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '@/services/notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function groupLabel(iso: string | undefined): string {
  if (!iso) return 'Earlier';
  try {
    const d = parseISO(iso);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  } catch {
    return 'Earlier';
  }
}

function severityBorder(sev: string | undefined): string {
  if (sev === 'Critical') return 'border-l-rose-500';
  if (sev === 'Warning') return 'border-l-amber-500';
  return 'border-l-zinc-600';
}

export function GoAlertsPage() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      setItems(await getMyNotifications(60, false));
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const m = new Map<string, NotificationRow[]>();
    for (const n of items) {
      const key = groupLabel(n.creation);
      const list = m.get(key) ?? [];
      list.push(n);
      m.set(key, list);
    }
    return m;
  }, [items]);

  const onTap = async (n: NotificationRow) => {
    if (n.is_read) return;
    try {
      await markNotificationRead(n.name);
      setItems((prev) => prev.map((x) => (x.name === n.name ? { ...x, is_read: 1 } : x)));
    } catch {
      /* ignore */
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, is_read: 1 })));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pulse Go</p>
          <h1 className="text-2xl font-semibold text-white mt-1">Alerts</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-300 text-xs shrink-0"
          onClick={() => onMarkAll()}
          disabled={!items.some((n) => !n.is_read)}
        >
          Mark all read
        </Button>
      </div>

      {loading ? <div className="h-40 rounded-xl bg-zinc-900 animate-pulse" /> : null}

      {!loading && items.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-16">No notifications yet.</p>
      ) : null}

      {!loading &&
        [...grouped.entries()].map(([label, rows]) => (
          <section key={label} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">{label}</h2>
            <ul className="space-y-2">
              {rows.map((n) => {
                const read = Boolean(n.is_read);
                const urgent = n.priority === 'Urgent';
                return (
                  <li key={n.name}>
                    <button
                      type="button"
                      onClick={() => onTap(n)}
                      className={cn(
                        'w-full text-left rounded-lg border border-zinc-800 border-l-4 pl-3 pr-3 py-3 transition-colors',
                        severityBorder(n.severity),
                        read ? 'bg-zinc-900/30' : 'bg-zinc-900/70',
                        urgent && !read ? 'ring-2 ring-rose-500/40 ring-offset-2 ring-offset-zinc-950' : '',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-100">{n.title}</p>
                        {n.priority && n.priority !== 'Normal' ? (
                          <span
                            className={cn(
                              'text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded shrink-0',
                              urgent ? 'bg-rose-500/20 text-rose-300' : 'bg-zinc-800 text-zinc-400',
                            )}
                          >
                            {n.priority}
                          </span>
                        ) : null}
                      </div>
                      {n.body ? <p className="text-xs text-zinc-500 mt-1 line-clamp-3">{n.body}</p> : null}
                      {n.creation ? (
                        <p className="text-[10px] text-zinc-600 mt-2">
                          {format(parseISO(n.creation), 'HH:mm')}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
