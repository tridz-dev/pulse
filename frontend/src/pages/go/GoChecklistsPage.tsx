import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { getMyRuns } from '@/services/tasks';
import type { RunListItem } from '@/services/tasks';
import { pulseQueryKeys } from '@/lib/queryClient';
import { RunCard } from '@/components/tasks/RunCard';
import { ChecklistRunner } from '@/components/tasks/ChecklistRunner';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GoChecklistsPage() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const date = todayISO();

  const { data: runs = [], isLoading: loading } = useQuery({
    queryKey: pulseQueryKeys.myRuns(date),
    queryFn: () => getMyRuns(date),
    enabled: !!currentUser,
    staleTime: 45_000,
  });

  const { nextDue, rest } = useMemo(() => {
    const open = runs.filter((r: RunListItem) => r.status === 'Open');
    const sorted = [...open].sort((a, b) => {
      const ta = a.period_datetime ? new Date(a.period_datetime).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.period_datetime ? new Date(b.period_datetime).getTime() : Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      return (a.name || '').localeCompare(b.name || '');
    });
    const head = sorted[0];
    return { nextDue: head, rest: runs.filter((r: RunListItem) => r.name !== head?.name) };
  }, [runs]);

  const onRunnerClose = () => {
    setSelectedRunId(null);
    void queryClient.invalidateQueries({ queryKey: pulseQueryKeys.myRuns(date) });
    void queryClient.invalidateQueries({ queryKey: pulseQueryKeys.goHomeSummary });
    void queryClient.invalidateQueries({ queryKey: ['pulse', 'dashboard'] });
  };

  return (
    <div className="p-4 pb-24 space-y-8 max-w-lg mx-auto w-full">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Today</p>
        <h1 className="text-2xl font-semibold text-white mt-1">Your checklists</h1>
      </div>

      {loading ? <div className="h-32 rounded-xl bg-zinc-900 animate-pulse" /> : null}

      {!loading && nextDue ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Next due</h2>
          <RunCard run={nextDue} onClick={() => setSelectedRunId(nextDue.name)} />
        </section>
      ) : null}

      {!loading && rest.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">All today</h2>
          <div className="space-y-2">
            {rest.map((r: RunListItem) => (
              <RunCard key={r.name} run={r} compact onClick={() => setSelectedRunId(r.name)} />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && runs.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-12">No runs scheduled for today.</p>
      ) : null}

      {selectedRunId ? (
        <ChecklistRunner
          variant="fullscreen"
          runId={selectedRunId}
          open
          onOpenChange={(o) => {
            if (!o) onRunnerClose();
          }}
        />
      ) : null}
    </div>
  );
}
