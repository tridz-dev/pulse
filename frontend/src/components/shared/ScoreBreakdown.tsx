import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { getUserRunBreakdown } from '@/services/operations';
import type { UserRunBreakdown } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/ui/status-chip';
import { Disclosure } from '@/components/ui/disclosure';
import { TableEmptyState } from '@/components/ui/table-states';
import {
  ChevronDown,
  Activity,
  Target,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface ScoreBreakdownProps {
  userId: string | null;
  date: string;
  periodType: 'Day' | 'Week' | 'Month';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScoreBreakdown({ userId, date, periodType, open, onOpenChange }: ScoreBreakdownProps) {
  const [breakdown, setBreakdown] = useState<UserRunBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initiallyExpandedGroups, setInitiallyExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    if (open && userId) {
      loadBreakdown();
    }
  }, [open, userId, date, periodType]);

  async function loadBreakdown() {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await getUserRunBreakdown(userId, date, periodType);
      setBreakdown(data);
      setInitiallyExpandedGroups(
        data.templateGroups.filter((g) => g.missedItems > 0).map((g) => g.templateId)
      );
    } catch (error) {
      console.error('Failed to load breakdown', error);
    }
    setIsLoading(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-ink border-rule w-full sm:max-w-xl p-0 flex flex-col transition-all duration-300">
        {isLoading ? (
          <div className="flex flex-col gap-6 p-8 animate-pulse">
            <div className="h-20 bg-slab rounded" />
            <div className="h-40 bg-slab rounded" />
            <div className="h-40 bg-slab rounded" />
          </div>
        ) : breakdown ? (
          <>
            <SheetHeader className="p-6 border-b border-rule bg-slab/30">
              <div className="flex items-center gap-4">
                <Activity className="text-sel" size={24} />
                <div className="flex flex-col">
                  <SheetTitle className="text-xl text-text font-bold tracking-tight">
                    Execution Audit
                  </SheetTitle>
                  <SheetDescription className="text-faint font-mono text-xs uppercase tracking-widest mt-0.5">
                    {breakdown.user?.name ?? '—'} • {breakdown.periodLabel}
                  </SheetDescription>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-faint font-mono uppercase tracking-widest leading-none mb-1">
                      COMPLETION
                    </span>
                    <span
                      className={cn(
                        'text-2xl font-bold font-mono tracking-tighter leading-none',
                        breakdown.overallCompletion >= 80
                          ? 'text-pass'
                          : breakdown.overallCompletion >= 50
                            ? 'text-risk'
                            : 'text-fail'
                      )}
                    >
                      {Math.round(breakdown.overallCompletion)}%
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-8">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slab/50 border border-rule p-4 rounded flex flex-col gap-1">
                  <span className="text-[10px] text-faint font-mono uppercase tracking-widest font-bold">
                    Total Items
                  </span>
                  <span className="text-xl font-bold text-text">{breakdown.totalItems}</span>
                </div>
                <div className="bg-slab/50 border border-rule p-4 rounded flex flex-col gap-1">
                  <span className="text-[10px] text-faint font-mono uppercase tracking-widest font-bold">
                    Completed
                  </span>
                  <span className="text-xl font-bold text-pass">{breakdown.completedItems}</span>
                </div>
                <div className="bg-slab/50 border border-rule p-4 rounded flex flex-col gap-1">
                  <span className="text-[10px] text-faint font-mono uppercase tracking-widest font-bold">
                    Missed
                  </span>
                  <span className="text-xl font-bold text-fail">{breakdown.missedItems}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-mute uppercase tracking-widest mb-2 flex items-center gap-2">
                  <ChevronDown size={14} />
                  Checklist Breakdown
                </h4>

                {breakdown.templateGroups.length === 0 ? (
                  <TableEmptyState
                    icon={<AlertCircle size={16} />}
                    title="No checklist instances found"
                    description="No checklist instances found for this period."
                  />
                ) : (
                  breakdown.templateGroups.map((group) => (
                    <Disclosure
                      key={group.templateId}
                      defaultOpen={initiallyExpandedGroups.includes(group.templateId)}
                      title={
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'p-2 rounded',
                              group.totalItems > 0 && group.completedItems / group.totalItems >= 0.8
                                ? 'text-pass'
                                : 'bg-fail-bg text-fail'
                            )}
                          >
                            <Target size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-text">{group.templateTitle}</span>
                            <span className="text-[10px] text-faint font-mono uppercase tracking-wider">
                              {group.department ?? '—'} • {group.frequencyType}
                            </span>
                          </div>
                        </div>
                      }
                      meta={
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-mute">
                            {group.totalItems > 0
                              ? Math.round((group.completedItems / group.totalItems) * 100)
                              : 0}
                            %
                          </span>
                          <span className="text-[10px] text-faint font-mono">
                            {group.completedItems}/{group.totalItems} Items
                          </span>
                        </div>
                      }
                    >
                        <div className="flex flex-col gap-4">
                          {group.runs.map((run) => (
                            <div key={run.runId} className="flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calendar size={12} className="text-sel" />
                                  <span className="text-xs font-bold text-mute">
                                    {format(parseISO(run.periodDate), 'MMM d, yyyy')}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] uppercase tracking-wider h-4 bg-transparent border-rule-2 text-faint"
                                  >
                                    {run.runStatus}
                                  </Badge>
                                </div>
                                <span className="text-[10px] font-mono text-faint">
                                  {run.completedItems}/{run.totalItems} items completed
                                </span>
                              </div>

                              <div className="flex flex-col gap-2">
                                {run.items.map((item) => (
                                  <div
                                    key={item.runItemId}
                                    className="flex items-center justify-between p-3 rounded bg-slab border border-rule/60 group hover:border-rule-2 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <StatusChip
                                        status={
                                          item.status === 'Completed'
                                            ? 'pass'
                                            : item.status === 'Missed'
                                              ? 'fail'
                                              : 'none'
                                        }
                                      >
                                        {item.status}
                                      </StatusChip>
                                      <span
                                        className={cn(
                                          'text-xs',
                                          item.status === 'Completed'
                                            ? 'text-text'
                                            : item.status === 'Missed'
                                              ? 'text-fail font-medium'
                                              : 'text-faint'
                                        )}
                                      >
                                        {item.description}
                                      </span>
                                    </div>
                                    {item.completedAt && (
                                      <span className="text-[9px] font-mono text-faint hidden group-hover:block transition-all">
                                        {format(parseISO(item.completedAt), 'HH:mm')}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                    </Disclosure>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-faint">
            Error loading data.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
