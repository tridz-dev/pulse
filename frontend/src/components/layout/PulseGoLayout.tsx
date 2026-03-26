import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { GoTabBar } from './GoTabBar';
import { getMyNotifications } from '@/services/notifications';

export function PulseGoLayout() {
  const { currentUser, isLoading, authError } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    let interval: ReturnType<typeof setInterval>;
    const tick = async () => {
      try {
        const rows = await getMyNotifications(60, true);
        setUnreadCount(rows.filter((n) => !n.is_read).length);
      } catch {
        setUnreadCount(0);
      }
    };
    tick();
    interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-6 text-center">
        <p className="text-sm text-zinc-300 mb-2">Sign in to use Pulse Go.</p>
        {authError ? <p className="text-xs text-zinc-500">{authError}</p> : null}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#18181b]/90 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            P
          </div>
          <span className="text-sm font-medium text-zinc-200 truncate">Pulse Go</span>
        </div>
        <Link to="/tasks" className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0">
          Full app
        </Link>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
      <GoTabBar unreadCount={unreadCount} />
    </div>
  );
}
