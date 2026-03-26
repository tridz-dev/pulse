import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

export function OperatorLayout() {
  const { currentUser, isLoading, authError } = useAuth();

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
        <p className="text-sm text-zinc-300 mb-2">Sign in to use the operator view.</p>
        {authError ? <p className="text-xs text-zinc-500">{authError}</p> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#18181b]/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">P</div>
          <span className="text-sm font-medium text-zinc-200">Pulse Operator</span>
        </div>
        <Link to="/tasks" className="text-xs text-indigo-400 hover:text-indigo-300">
          Full app
        </Link>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
