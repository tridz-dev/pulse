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
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
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
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

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
      setExpandedGroups(
        data.templateGroups.filter((g) => g.missedItems > 0).map((g) => g.templateId)
      );
    } catch (error) {
      console.error('Failed to load breakdown', error);
    }
    setIsLoading(false);
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#09090b] border-zinc-800 w-full sm:max-w-xl p-0 flex flex-col transition-all duration-300">
        {isLoading ? (
          <div className="flex flex-col gap-6 p-8 animate-pulse">
            <div className="h-20 bg-zinc-900 rounded-xl" />
            <div className="h-40 bg-zinc-900 rounded-xl" />
            <div className="h-40 bg-zinc-900 rounded-xl" />
          </div>
        ) : breakdown ? (
          <>
            <SheetHeader className="p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-900/30">
              <div className="flex items-center gap-4">
                <Activity className="text-indigo-400" size={24} />
                <div className="flex flex-col">
                  <SheetTitle className="text-xl text-white font-bold tracking-tight">
                    Execution Audit
                  </SheetTitle>
                  <SheetDescription className="text-zinc-500 font-mono text-xs uppercase tracking-widest mt-0.5">
                    {breakdown.user?.name ?? '—'} • {breakdown.periodLabel}
                  </SheetDescription>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest leading-none mb-1">
                      COMPLETION
                    </span>
                    <span
                      className={cn(
                        'text-2xl font-bold font-mono tracking-tighter leading-none',
                        breakdown.overallCompletion >= 80
                          ? 'text-emerald-400'
                          : breakdown.overallCompletion >= 50
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      )}
                    >
                      {Math.round(breakdown.overallCompletion)}%
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                    Total Items
                  </span>
                  <span className="text-xl font-bold text-zinc-200">{breakdown.totalItems}</span>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                    Completed
                  </span>
                  <span className="text-xl font-bold text-emerald-400">{breakdown.completedItems}</span>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                    Missed
                  </span>
                  <span className="text-xl font-bold text-rose-400">{breakdown.missedItems}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <ChevronDown size={14} />
                  Checklist Breakdown
                </h4>

                {breakdown.templateGroups.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                    <AlertCircle className="mx-auto text-zinc-600 mb-3" size={32} />
                    <p className="text-zinc-500 text-sm">No checklist instances found for this period.</p>
                  </div>
                ) : (
                  breakdown.templateGroups.map((group) => (
                    <div key={group.templateId} className="flex flex-col gap-2">
                      <button
                        onClick={() => toggleGroup(group.templateId)}
                        className={cn(
                          'w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left',
                          expandedGroups.includes(group.templateId)
                            ? 'bg-zinc-800/40 border-zinc-700 shadow-lg'
                            : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/20'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'p-2 rounded-lg',
                              group.totalItems > 0 && group.completedItems / group.totalItems >= 0.8
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            )}
                          >
                            <Target size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-100">{group.templateTitle}</span>
                            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                              {group.department ?? '—'} • {group.frequencyType}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end mr-2">
                            <span className="text-xs font-bold text-zinc-300">
                              {group.totalItems > 0
                                ? Math.round((group.completedItems / group.totalItems) * 100)
                                : 0}
                              %
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {group.completedItems}/{group.totalItems} Items
                            </span>
                          </div>
                          {expandedGroups.includes(group.templateId) ? (
                            <ChevronDown size={16} className="text-zinc-500" />
                          ) : (
                            <ChevronRight size={16} className="text-zinc-500" />
                          )}
                        </div>
                      </button>

                      {expandedGroups.includes(group.templateId) && (
                        <div className="flex flex-col gap-4 pl-4 pr-1 py-4 border-l-2 border-zinc-800 ml-6 mt-1 animate-in slide-in-from-top-2 duration-300">
                          {group.runs.map((run) => (
                            <div key={run.runId} className="flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calendar size={12} className="text-indigo-400" />
                                  <span className="text-xs font-bold text-zinc-400">
                                    {format(parseISO(run.periodDate), 'MMM d, yyyy')}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] uppercase tracking-wider h-4 bg-transparent border-zinc-700 text-zinc-500"
                                  >
                                    {run.runStatus}
                                  </Badge>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {run.completedItems}/{run.totalItems} items completed
                                </span>
                              </div>

                              <div className="flex flex-col gap-2">
                                {run.items.map((item) => (
                                  <div
                                    key={item.runItemId}
                                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800/60 group hover:border-zinc-700 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      {item.status === 'Completed' ? (
                                        <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                                      ) : item.status === 'Missed' ? (
                                        <XCircle className="text-rose-500 shrink-0" size={16} />
                                      ) : (
                                        <Clock className="text-zinc-600 shrink-0" size={16} />
                                      )}
                                      <span
                                        className={cn(
                                          'text-xs',
                                          item.status === 'Completed'
                                            ? 'text-zinc-200'
                                            : item.status === 'Missed'
                                              ? 'text-rose-400 font-medium'
                                              : 'text-zinc-500'
                                        )}
                                      >
                                        {item.description}
                                      </span>
                                    </div>
                                    {item.completedAt && (
                                      <span className="text-[9px] font-mono text-zinc-600 hidden group-hover:block transition-all">
                                        {format(parseISO(item.completedAt), 'HH:mm')}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
            Error loading data.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
