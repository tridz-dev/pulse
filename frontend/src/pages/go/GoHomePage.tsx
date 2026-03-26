import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { getHomeSummary } from '@/services/go';
import { pulseQueryKeys } from '@/lib/queryClient';
import { ClipboardList, AlertTriangle, Users } from 'lucide-react';

export function GoHomePage() {
  const { currentUser } = useAuth();

  const { data: summary, isLoading: loading } = useQuery({
    queryKey: pulseQueryKeys.goHomeSummary,
    queryFn: async () => {
      try {
        return await getHomeSummary();
      } catch {
        return { open_runs: 0, overdue_runs: 0, team_open: 0 };
      }
    },
    enabled: !!currentUser,
    staleTime: 60_000,
  });

  const cards = [
    {
      label: 'Open today',
      value: summary?.open_runs ?? 0,
      icon: ClipboardList,
      tone: 'text-indigo-300',
      border: 'border-indigo-500/25',
      bg: 'bg-indigo-500/5',
    },
    {
      label: 'Overdue',
      value: summary?.overdue_runs ?? 0,
      icon: AlertTriangle,
      tone: 'text-amber-300',
      border: 'border-amber-500/25',
      bg: 'bg-amber-500/5',
    },
    {
      label: 'Team open',
      value: summary?.team_open ?? 0,
      icon: Users,
      tone: 'text-emerald-300',
      border: 'border-emerald-500/25',
      bg: 'bg-emerald-500/5',
    },
  ];

  return (
    <div className="p-4 pb-8 max-w-lg mx-auto w-full space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pulse Go</p>
        <h1 className="text-2xl font-semibold text-white mt-1">Hello, {currentUser?.name?.split(' ')[0] ?? 'there'}</h1>
        <p className="text-sm text-zinc-500 mt-1">Quick snapshot for today.</p>
      </div>

      {loading ? <div className="h-40 rounded-xl bg-zinc-900 animate-pulse" /> : null}

      {!loading && summary ? (
        <div className="grid grid-cols-1 gap-3">
          {cards.map(({ label, value, icon: Icon, tone, border, bg }) => (
            <div
              key={label}
              className={`rounded-xl border ${border} ${bg} p-4 flex items-center gap-4`}
            >
              <div className={`rounded-lg p-2.5 bg-zinc-900/80 ${tone}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
                <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Link
        to="/go/checklists"
        className="block w-full text-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-3 transition-colors"
      >
        Open checklists
      </Link>
    </div>
  );
}
