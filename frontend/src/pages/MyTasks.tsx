import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { getMyRuns } from '@/services/tasks';
import type { RunListItem } from '@/services/tasks';
import { pulseQueryKeys } from '@/lib/queryClient';
import { RunCard } from '@/components/tasks/RunCard';
import { ChecklistRunner } from '@/components/tasks/ChecklistRunner';
import { CheckCircle2 } from 'lucide-react';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MyTasks() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const date = todayISO();

  const { data: runs = [], isLoading } = useQuery({
    queryKey: pulseQueryKeys.myRuns(date),
    queryFn: () => getMyRuns(date),
    enabled: !!currentUser,
    staleTime: 45_000,
  });

  const invalidateTasks = () => {
    void queryClient.invalidateQueries({ queryKey: pulseQueryKeys.myRuns(date) });
    void queryClient.invalidateQueries({ queryKey: ['pulse', 'dashboard'] });
    void queryClient.invalidateQueries({ queryKey: pulseQueryKeys.goHomeSummary });
  };

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10 w-full min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-white">My Tasks</h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
            Manage your active operations and standard operating procedures.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 mt-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-zinc-900 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 lg:p-16 mt-2 border border-zinc-800/60 border-dashed rounded-xl bg-[#18181b]/50 w-full">
          <CheckCircle2 size={48} className="text-zinc-600 mb-4" />
          <h3 className="text-base font-medium text-zinc-300">All caught up!</h3>
          <p className="text-sm text-zinc-500 mt-1 text-center max-w-lg">
            You don&apos;t have any pending checklists for this period. Great job.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 mt-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 w-full">
          {runs.map((run: RunListItem) => (
            <RunCard key={run.name} run={run} onClick={() => setSelectedRunId(run.name)} />
          ))}
        </div>
      )}

      {selectedRunId && (
        <ChecklistRunner
          runId={selectedRunId}
          open={!!selectedRunId}
          onOpenChange={(o) => {
            if (!o) {
              setSelectedRunId(null);
              invalidateTasks();
            }
          }}
        />
      )}
    </div>
  );
}
