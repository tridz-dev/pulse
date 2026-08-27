import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { getMyRuns, getRunDetails, updateRunItem, completeRun } from '@/services/tasks';
import type { RunListItem } from '@/services/tasks';
import type { SOPRunItem } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Meter } from '@/components/ui/meter';
import { CheckCircle2, CheckSquare, Lock } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CheckboxRow } from '@/components/ui/checkbox-row';
import { Button } from '@/components/ui/button';
import { useToast } from '@/store/ToastContext';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MyTasks() {
  const { currentUser } = useAuth();
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const fetchTasks = async (silent = false) => {
    if (!currentUser) return;
    if (!silent) setIsLoading(true);
    const data = await getMyRuns(todayISO());
    setRuns(data);
    if (!silent) setIsLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [currentUser]);

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-text">My Tasks</h1>
        <p className="text-mute text-sm mt-1">
          Manage your active operations and standard operating procedures.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slab rounded-[var(--radius)] animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 mt-4 border border-rule border-dashed rounded-[var(--radius)] bg-slab/50">
          <CheckCircle2 size={48} className="text-faint mb-4" />
          <h3 className="text-base font-medium text-text">All caught up!</h3>
          <p className="text-sm text-mute mt-1 text-center max-w-sm">
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
              fetchTasks(true);
            }
          }}
          onComplete={(runName, newStatus, complianceResult) => {
            setRuns((prev) =>
              prev.map((r) =>
                r.name === runName
                  ? { ...r, status: newStatus, compliance_result: complianceResult }
                  : r
              )
            );
          }}
        />
      )}
    </div>
  );
}

function RunCard({ run, onClick }: { run: RunListItem; onClick: () => void }) {
  const isCompleted = run.status === 'Completed';
  const isLocked = run.status === 'Locked';
  const template = (typeof run.template === 'object' && run.template !== null ? run.template : null) as { title?: string; frequency_type?: string } | null;
  const progress = Math.round(run.progress ?? 0);

  return (
    <Card
      onClick={onClick}
      className={`p-4 bg-slab border-rule hover:border-rule-2 hover:bg-slab-2/30 transition-all cursor-pointer group flex items-center justify-between gap-4 ${isCompleted ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-[var(--radius)] flex items-center justify-center shrink-0 ${
            isCompleted
              ? 'bg-pass/10 text-pass'
              : isLocked
                ? 'bg-slab-2 text-mute'
                : 'bg-sel/10 text-sel group-hover:bg-sel/20'
          }`}
        >
          {isCompleted ? <CheckCircle2 size={20} /> : <CheckSquare size={20} />}
        </div>
        <div>
          <h3 className="text-sm font-medium text-text">
            {template?.title ?? (typeof run.template === 'string' ? run.template : '—')}
          </h3>
          <div className="text-xs text-mute mt-1 flex items-center gap-3">
            <span>{template?.frequency_type ?? '—'}</span>
            <span className="text-faint">•</span>
            <span className="font-mono">{progress}% Complete</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-24 hidden sm:block">
          <Meter
            size="sm"
            segments={[
              { value: progress, className: isCompleted ? 'bg-pass' : 'bg-sel' },
              { value: 100 - progress, className: 'bg-slab-2' },
            ]}
          />
        </div>
        <Badge
          variant="outline"
          className={`
          ${run.status === 'Open' ? 'text-sel border-sel/20 bg-sel/10' : ''}
          ${run.status === 'In Progress' ? 'text-risk border-risk/20 bg-risk/10' : ''}
          ${run.status === 'Completed' ? 'text-pass border-pass/20 bg-pass/10' : ''}
          ${run.status === 'Locked' ? 'text-mute border-rule-2 bg-slab-2' : ''}
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
  onComplete,
}: {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (runName: string, newStatus: string, complianceResult: string) => void;
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
    if (details?.run.status !== 'Open' && details?.run.status !== 'In Progress') return;
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    setDetails((prev) => {
      if (!prev) return prev;
      const nextStatus = prev.run.status === 'Open' ? 'In Progress' : prev.run.status;
      return {
        ...prev,
        run: { ...prev.run, status: nextStatus },
        items: prev.items.map((i) => (i.name === itemId ? { ...i, status: newStatus } : i)),
      };
    });
    await updateRunItem(itemId, newStatus);
  };

  const { showToast } = useToast();

  const completeRunHandler = async () => {
    if (!details) return;
    try {
      const res = await completeRun(details.run.name ?? runId);
      if (onComplete) {
        onComplete(details.run.name ?? runId, res.status, res.compliance_result);
      }
      showToast({
        variant: 'pass',
        title: 'Checklist submitted',
        description: `${details.template?.title ?? 'Checklist'} completed.`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      showToast({
        variant: 'fail',
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Something went wrong submitting the checklist.',
      });
    }
  };

  if (!details) return null;

  const completedCount = details.items.filter((i) => i.status === 'Completed').length;
  const progress = details.items.length > 0 ? (completedCount / details.items.length) * 100 : 0;
  const isReadOnly = details.run?.status !== 'Open' && details.run?.status !== 'In Progress';
  const template = details.template ?? {};
  const run = details.run ?? {};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-slab border-rule sm:max-w-md w-full p-0 flex flex-col h-full text-text">
        <div className="p-6 border-b border-rule">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-mute border-rule-2">
                {template.department ?? '—'}
              </Badge>
              {isReadOnly && (
                <Badge variant="secondary" className="bg-slab-2 text-mute">
                  <Lock size={12} className="mr-1" /> Read Only
                </Badge>
              )}
            </div>
            <SheetTitle className="text-xl text-text mt-2">{template.title ?? 'Checklist'}</SheetTitle>
            <SheetDescription className="text-mute">
              Assigned checklist for {run.period_date ? new Date(run.period_date).toLocaleDateString() : '—'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-medium text-mute">
              <span>Progress</span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            <Meter
              segments={[
                { value: completedCount, className: progress === 100 ? 'bg-pass' : 'bg-sel' },
                { value: details.items.length - completedCount, className: 'bg-slab-2' },
              ]}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="space-y-4">
            {details.items.map((item) => (
              <div
                key={item.name}
                className={`p-4 rounded-[var(--radius)] border ${
                  item.status === 'Completed'
                    ? 'bg-sel/5 border-sel/20'
                    : 'bg-slab-2/50 border-rule'
                } transition-colors ${isReadOnly ? 'opacity-80' : ''}`}
              >
                <CheckboxRow
                  checked={item.status === 'Completed'}
                  disabled={isReadOnly}
                  onCheckedChange={() => toggleItem(item.name, item.status)}
                  label={item.template_item?.description ?? item.checklist_item}
                  secondary={
                    (item.template_item?.weight ?? item.weight) > 1
                      ? `Weight: ${item.template_item?.weight ?? item.weight}`
                      : undefined
                  }
                  className={item.status === 'Completed' ? 'text-mute line-through opacity-70' : ''}
                />
              </div>
            ))}
          </div>
        </div>
        {!isReadOnly && (
          <div className="p-6 border-t border-rule bg-ink/50 sticky bottom-0">
            <Button className="w-full bg-slab-2 border border-rule-2 hover:bg-slab text-text" onClick={completeRunHandler}>
              Submit & Close Checklist
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
