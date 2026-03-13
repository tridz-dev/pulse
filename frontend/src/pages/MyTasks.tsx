import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { getMyRuns, getRunDetails, updateRunItem, completeRun } from '@/services/tasks';
import type { RunListItem } from '@/services/tasks';
import type { SOPRunItem } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CheckSquare, Lock } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MyTasks() {
  const { currentUser } = useAuth();
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    const data = await getMyRuns(todayISO());
    setRuns(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [currentUser]);

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">My Tasks</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage your active operations and standard operating procedures.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-zinc-900 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 mt-4 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
          <CheckCircle2 size={48} className="text-zinc-600 mb-4" />
          <h3 className="text-base font-medium text-zinc-300">All caught up!</h3>
          <p className="text-sm text-zinc-500 mt-1 text-center max-w-sm">
            You don&apos;t have any pending checklists for this period. Great job.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 mt-4">
          {runs.map((run) => (
            <RunCard key={run.name} run={run} onClick={() => setSelectedRunId(run.name)} />
          ))}
        </div>
      )}

      {selectedRunId && (
        <ChecklistRunner
          runId={selectedRunId}
          open={!!selectedRunId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRunId(null);
              fetchTasks();
            }
          }}
        />
      )}
    </div>
  );
}

function RunCard({ run, onClick }: { run: RunListItem; onClick: () => void }) {
  const isClosed = run.status === 'Closed';
  const isLocked = run.status === 'Locked';
  const template = (typeof run.template === 'object' && run.template !== null ? run.template : null) as { title?: string; frequency_type?: string } | null;

  return (
    <Card
      onClick={onClick}
      className={`p-4 bg-[#18181b] border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30 transition-all cursor-pointer group flex items-center justify-between gap-4 ${isClosed ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isClosed
              ? 'bg-emerald-500/10 text-emerald-500'
              : isLocked
                ? 'bg-zinc-800 text-zinc-500'
                : 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20'
          }`}
        >
          {isClosed ? <CheckCircle2 size={20} /> : <CheckSquare size={20} />}
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            {template?.title ?? (typeof run.template === 'string' ? run.template : '—')}
          </h3>
          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3">
            <span>{template?.frequency_type ?? '—'}</span>
            <span className="text-zinc-700">•</span>
            <span>{Math.round(run.progress ?? 0)}% Complete</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden hidden sm:block">
          <div
            className={`h-full transition-all duration-500 ${isClosed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${run.progress ?? 0}%` }}
          />
        </div>
        <Badge
          variant="outline"
          className={`
          ${run.status === 'Open' ? 'text-indigo-400 border-indigo-400/20 bg-indigo-400/10' : ''}
          ${run.status === 'Closed' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' : ''}
          ${run.status === 'Locked' ? 'text-zinc-500 border-zinc-700 bg-zinc-800' : ''}
        `}
        >
          {run.status}
        </Badge>
      </div>
    </Card>
  );
}

type ItemRow = SOPRunItem & { templateItem?: { description: string; weight: number } };

function ChecklistRunner({
  runId,
  open,
  onOpenChange,
}: {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [details, setDetails] = useState<{
    run: { name: string; status: string; period_date: string };
    template: { title?: string; department?: string };
    items: ItemRow[];
  } | null>(null);

  useEffect(() => {
    if (open && runId) {
      getRunDetails(runId).then(setDetails);
    }
  }, [runId, open]);

  const toggleItem = async (itemId: string, currentStatus: string) => {
    if (details?.run.status !== 'Open') return;
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    setDetails((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) => (i.name === itemId ? { ...i, status: newStatus } : i)),
      };
    });
    await updateRunItem(itemId, newStatus);
  };

  const completeRunHandler = async () => {
    if (!details) return;
    await completeRun(details.run.name ?? runId);
    onOpenChange(false);
  };

  if (!details) return null;

  const progress =
    details.items.length > 0
      ? (details.items.filter((i) => i.status === 'Completed').length / details.items.length) * 100
      : 0;
  const isReadOnly = details.run?.status !== 'Open';
  const template = details.template ?? {};
  const run = details.run ?? {};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#18181b] border-zinc-800 sm:max-w-md w-full p-0 flex flex-col h-full text-zinc-100">
        <div className="p-6 border-b border-zinc-800">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-zinc-400 border-zinc-700">
                {template.department ?? '—'}
              </Badge>
              {isReadOnly && (
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
                  <Lock size={12} className="mr-1" /> Read Only
                </Badge>
              )}
            </div>
            <SheetTitle className="text-xl text-zinc-100 mt-2">{template.title ?? 'Checklist'}</SheetTitle>
            <SheetDescription className="text-zinc-500">
              Assigned checklist for {run.period_date ? new Date(run.period_date).toLocaleDateString() : '—'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-medium text-zinc-400">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="space-y-4">
            {details.items.map((item) => (
              <div
                key={item.name}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  item.status === 'Completed'
                    ? 'bg-indigo-500/5 border-indigo-500/20'
                    : 'bg-zinc-900/50 border-zinc-800'
                } transition-colors ${isReadOnly ? 'opacity-80' : ''}`}
              >
                <Checkbox
                  id={item.name}
                  checked={item.status === 'Completed'}
                  disabled={isReadOnly}
                  onCheckedChange={() => toggleItem(item.name, item.status)}
                  className="mt-0.5 border-zinc-600 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                />
                <div className="grid gap-1.5 leading-none w-full">
                  <label
                    htmlFor={item.name}
                    className={`text-sm font-medium leading-tight cursor-pointer ${
                      item.status === 'Completed' ? 'text-zinc-300 line-through opacity-70' : 'text-zinc-200'
                    }`}
                  >
                    {item.template_item?.description ?? item.checklist_item}
                  </label>
                  {(item.template_item?.weight ?? item.weight) > 1 && (
                    <span className="text-[10px] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5 w-max">
                      Weight: {item.template_item?.weight ?? item.weight}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {!isReadOnly && (
          <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 sticky bottom-0">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={completeRunHandler}>
              Submit & Close Checklist
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
