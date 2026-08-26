import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { getOperationsOverview, getFailureList, getComplianceScore } from '@/services/operations';
import type { TreeNode } from '@/services/operations';
import type { FailureItem, ComplianceScoreResponse } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Gauge } from '@/components/shared/Gauge';
import { Network, ChevronRight, ChevronDown, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPeriodRange(periodType: 'Day' | 'Week' | 'Month'): { start: string; end: string } {
  const today = new Date();
  const formatStr = (d: Date) => d.toISOString().slice(0, 10);
  
  if (periodType === 'Day') {
    const s = formatStr(today);
    return { start: s, end: s };
  }
  if (periodType === 'Week') {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(today.setDate(diff));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatStr(start), end: formatStr(end) };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: formatStr(start), end: formatStr(end) };
}

function getOverdueDuration(dueAtString: string): string {
  if (!dueAtString) return 'Overdue';
  const sanitized = dueAtString.includes('T') ? dueAtString : dueAtString.replace(' ', 'T');
  const dueAt = new Date(sanitized);
  const now = new Date();
  const diffMs = now.getTime() - dueAt.getTime();
  if (diffMs <= 0) return 'Due soon';
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `Overdue by ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Overdue by ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Overdue by ${diffDays}d`;
}

export function Operations() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [complianceScore, setComplianceScore] = useState<ComplianceScoreResponse | null>(null);
  const [failures, setFailures] = useState<FailureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFailuresLoading, setIsFailuresLoading] = useState(false);
  
  // Sheet states for navigation fallbacks
  const [selectedFailure, setSelectedFailure] = useState<FailureItem | null>(null);
  const [selectedSopTitle, setSelectedSopTitle] = useState<string | null>(null);
  const [selectedSopFailures, setSelectedSopFailures] = useState<FailureItem[]>([]);

  useEffect(() => {
    async function fetchOperations() {
      if (!currentUser || currentUser.systemRole === 'Pulse User' || currentUser.systemRole === 'Pulse Manager') {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setIsFailuresLoading(true);
      const today = todayISO();
      const range = getPeriodRange(periodType);

      try {
        const [overviewRes, scoreRes] = await Promise.all([
          getOperationsOverview(currentUser.id, today, periodType),
          getComplianceScore(currentUser.id, 'inherited', today, periodType)
        ]);
        
        setTreeData(overviewRes);
        setComplianceScore(scoreRes);

        let allFailures: FailureItem[] = [];
        let currentPage = 1;
        let total = 0;
        const pageSize = 100;
        do {
          const failRes = await getFailureList(range.start, range.end, currentPage, pageSize);
          if (failRes && failRes.items) {
            allFailures = [...allFailures, ...failRes.items];
            total = failRes.total;
          } else {
            break;
          }
          currentPage++;
        } while (allFailures.length < total && allFailures.length < 500);

        setFailures(allFailures);
      } catch (error) {
        console.error('Failed to load operations data', error);
      } finally {
        setIsLoading(false);
        setIsFailuresLoading(false);
      }
    }
    fetchOperations();
  }, [currentUser, periodType]);

  if (!currentUser || ['Pulse User', 'Pulse Manager'].includes(currentUser.systemRole ?? '')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
        <Network size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-base font-medium text-zinc-300">Access Restricted</h3>
        <p className="text-sm text-zinc-500 mt-1 text-center max-w-sm">
          Operations Overview is reserved for Area Managers and Executive Leadership.
        </p>
      </div>
    );
  }

  // Client-side calculations
  // 1. Repeat-failure counts (group failed items by template_title + person, count occurrences)
  const repeatCounts = new Map<string, number>();
  failures.forEach(f => {
    const key = `${f.template_title}_${f.person.employee}`;
    repeatCounts.set(key, (repeatCounts.get(key) || 0) + 1);
  });

  // 2. Sort failures according to Domain Contract section 10
  const sortedFailures = [...failures].map(f => {
    const key = `${f.template_title}_${f.person.employee}`;
    const repeatCount = repeatCounts.get(key) || 1;
    const dueTime = new Date(f.due_at.replace(' ', 'T')).getTime();
    const overdueMs = new Date().getTime() - dueTime;
    return {
      ...f,
      repeatCount,
      overdueMs,
    };
  }).sort((a, b) => {
    // 1. longest overdue duration first
    if (b.overdueMs !== a.overdueMs) {
      return b.overdueMs - a.overdueMs;
    }
    // 2. then highest repeat-failure count
    if (b.repeatCount !== a.repeatCount) {
      return b.repeatCount - a.repeatCount;
    }
    // 3. then oldest due_at
    const aTime = new Date(a.due_at.replace(' ', 'T')).getTime();
    const bTime = new Date(b.due_at.replace(' ', 'T')).getTime();
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    // 4. then run ID for a deterministic tie-break
    return a.run.localeCompare(b.run);
  });

  // 3. Find weakest subtree/person
  function getDescendants(node: TreeNode): TreeNode[] {
    let list: TreeNode[] = [];
    if (node.children) {
      for (const child of node.children) {
        list.push(child);
        list = list.concat(getDescendants(child));
      }
    }
    return list;
  }

  const descendants = treeData ? getDescendants(treeData) : [];
  const descendantsWithScores = descendants.filter(d => {
    const s = d.score;
    const scoreVal = s?.combinedScore;
    return scoreVal !== undefined && scoreVal !== null;
  });

  let weakestNode: TreeNode | null = null;
  if (descendantsWithScores.length > 0) {
    weakestNode = descendantsWithScores.reduce((weakest, current) => {
      const wScore = weakest.score.combinedScore ?? 0;
      const cScore = current.score.combinedScore ?? 0;
      return cScore < wScore ? current : weakest;
    }, descendantsWithScores[0]);
  }

  // 4. Most repeated failed SOPs (grouped by template_title only)
  const sopCounts = new Map<string, number>();
  failures.forEach(f => {
    sopCounts.set(f.template_title, (sopCounts.get(f.template_title) || 0) + 1);
  });

  const sortedSops = Array.from(sopCounts.entries()).map(([title, count]) => ({
    title,
    count,
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Mission Control</h1>
          <p className="text-zinc-400 text-sm mt-1">Hierarchical roll-up of organizational execution.</p>
        </div>
        <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 shrink-0 self-start sm:self-center">
          {(['Day', 'Week', 'Month'] as const).map((p) => (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              onClick={() => setPeriodType(p)}
              className={cn(
                'h-8 px-3 text-xs font-medium transition-all rounded-md',
                periodType === p ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              )}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-48 bg-zinc-900 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-zinc-900 rounded-xl animate-pulse lg:col-span-2" />
            <div className="h-64 bg-zinc-900 rounded-xl animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {/* Top section: Compliance Gauge & Weakest Subtree callout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#141415] md:col-span-2 border-zinc-800 p-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
              <div className="shrink-0">
                <Gauge
                  value={complianceScore && complianceScore.score !== null ? Math.round(complianceScore.score * 100) : 0}
                  size={160}
                  label="Inherited KPI"
                  mode="gradient"
                  showTicks
                  showGlow
                />
              </div>
              <div className="flex-1 flex flex-col gap-3 text-center md:text-left">
                <div>
                  <h2 className="text-xl font-semibold text-white tracking-tight">Inherited Compliance Score</h2>
                  <p className="text-zinc-400 text-xs mt-1">
                    Prominently showing your team's overall inherited score based on {complianceScore?.eligible_runs || 0} eligible runs ({complianceScore?.passed_runs || 0} passed, {complianceScore?.failed_runs || 0} failed) for the selected period.
                  </p>
                </div>
              </div>
            </Card>

            {weakestNode && (
              <Card 
                className="bg-[#141415] border-zinc-800 p-6 flex flex-col justify-between hover:border-rose-500/40 transition-all cursor-pointer group"
                onClick={() => navigate(`/operations/${weakestNode!.user.id}`)}
              >
                <div>
                  <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Weakest Subtree / Person</span>
                  <h3 className="text-lg font-bold text-zinc-100 mt-2 group-hover:text-indigo-300 transition-colors">
                    {weakestNode.user.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {weakestNode.user.role} {weakestNode.user.branch ? `• ${weakestNode.user.branch}` : ''}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Score</span>
                  <Badge variant="outline" className="text-rose-400 bg-rose-400/10 border-rose-400/20 font-mono text-xs font-bold">
                    {Math.round((weakestNode.score.combinedScore ?? 0) * 100)}%
                  </Badge>
                </div>
              </Card>
            )}
          </div>

          {/* Attention Lists Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Failed runs card */}
            <Card className="bg-[#141415] border-zinc-800 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-zinc-800">
                <div>
                  <CardTitle className="text-lg font-bold text-white">Failed runs</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Failing SOP runs ordered by overdue duration, repeat occurrences, and due time.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-rose-400 bg-rose-400/10 border-rose-400/20 font-mono">
                  {sortedFailures.length} Failed
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {isFailuresLoading ? (
                  <div className="p-6 space-y-3">
                    <div className="h-12 bg-zinc-900 animate-pulse rounded" />
                    <div className="h-12 bg-zinc-900 animate-pulse rounded" />
                  </div>
                ) : sortedFailures.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-zinc-500 text-sm">No failed runs found in scope for this period.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/60 max-h-[450px] overflow-y-auto">
                    {sortedFailures.map((f) => (
                      <div
                        key={f.run}
                        className="flex items-center justify-between p-4 hover:bg-zinc-800/20 transition-all cursor-pointer group"
                        onClick={() => setSelectedFailure(f)}
                      >
                        <div className="flex flex-col gap-1 min-w-0 mr-4">
                          <span className="text-sm font-semibold text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
                            {f.template_title}
                          </span>
                          <span className="text-xs text-zinc-400 truncate">
                            Assigned to:{' '}
                            <span 
                              className="font-medium text-zinc-300 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/operations/${f.person.employee}`);
                              }}
                            >
                              {f.person.name}
                            </span>
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            Due: {new Date(f.due_at.replace(' ', 'T')).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono bg-rose-500/10 text-rose-400 border-rose-500/20">
                            {getOverdueDuration(f.due_at)}
                          </Badge>
                          {f.repeatCount > 1 && (
                            <Badge variant="outline" className="text-[10px] uppercase font-mono bg-amber-500/10 text-amber-400 border-amber-500/20">
                              {f.repeatCount}x repeat fail
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Most repeated failed SOPs */}
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader className="pb-2 border-b border-zinc-800">
                <CardTitle className="text-lg font-bold text-white">Repeated SOP Failures</CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  SOP templates with the highest failure count in this period.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isFailuresLoading ? (
                  <div className="p-6 space-y-3">
                    <div className="h-12 bg-zinc-900 animate-pulse rounded" />
                    <div className="h-12 bg-zinc-900 animate-pulse rounded" />
                  </div>
                ) : sortedSops.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-zinc-500 text-sm">No SOP failures found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/60">
                    {sortedSops.map((sop) => (
                      <div
                        key={sop.title}
                        className="flex items-center justify-between p-4 hover:bg-zinc-800/20 transition-all cursor-pointer group"
                        onClick={() => {
                          const sopFailures = failures.filter(f => f.template_title === sop.title);
                          setSelectedSopTitle(sop.title);
                          setSelectedSopFailures(sopFailures);
                        }}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 mr-4">
                          <span className="text-sm font-semibold text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
                            {sop.title}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono">
                            Click to view failures
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-base font-bold text-rose-400">{sop.count}</span>
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Failures</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Org Hierarchy Collapsible / Table */}
          {treeData && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-[#141415] overflow-hidden">
              <div className="border-b border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-indigo-400" />
                  <span className="text-sm font-medium text-zinc-200">
                    Organization Hierarchy Roll-up ({periodType})
                  </span>
                </div>
                <div className="text-xs text-zinc-500 font-mono">Select a row to drill down</div>
              </div>
              <div className="p-2 overflow-x-auto">
                <div className="min-w-[600px]">
                  <OperationNode
                    node={treeData}
                    level={0}
                    defaultExpanded={true}
                    onUserClick={(u) => navigate(`/operations/${u.id}`)}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Run Detail Sheet */}
      {selectedFailure && (
        <Sheet open={!!selectedFailure} onOpenChange={(open) => { if (!open) setSelectedFailure(null); }}>
          <SheetContent className="bg-[#18181b] border-zinc-800 sm:max-w-md w-full p-6 flex flex-col h-full text-zinc-100">
            <SheetHeader className="text-left border-b border-zinc-800 pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-rose-400 border-rose-400/20 bg-rose-500/10">
                  Failed Run
                </Badge>
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
                  Read Only
                </Badge>
              </div>
              <SheetTitle className="text-xl text-zinc-100 mt-2">{selectedFailure.template_title}</SheetTitle>
              <SheetDescription className="text-zinc-500">
                Run ID: {selectedFailure.run}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-6">
              <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                    Assigned Person
                  </span>
                  <span 
                    className="text-sm font-medium text-zinc-200 hover:underline cursor-pointer"
                    onClick={() => {
                      setSelectedFailure(null);
                      navigate(`/operations/${selectedFailure.person.employee}`);
                    }}
                  >
                    {selectedFailure.person.name}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ID: {selectedFailure.person.employee}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                    Due Date & Time
                  </span>
                  <span className="text-sm font-medium text-zinc-200">
                    {new Date(selectedFailure.due_at.replace(' ', 'T')).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                    Current Status
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-rose-400 border-rose-400/20 bg-rose-500/10 uppercase text-[10px]">
                      {selectedFailure.status}
                    </Badge>
                    <span className="text-xs text-rose-400 font-mono">
                      ({getOverdueDuration(selectedFailure.due_at)})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-6 mt-auto">
              <Button
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                onClick={() => setSelectedFailure(null)}
              >
                Close Details
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* SOP Failures Sheet */}
      {selectedSopTitle && (
        <Sheet open={!!selectedSopTitle} onOpenChange={(open) => { if (!open) { setSelectedSopTitle(null); setSelectedSopFailures([]); } }}>
          <SheetContent className="bg-[#18181b] border-zinc-800 sm:max-w-md w-full p-6 flex flex-col h-full text-zinc-100">
            <SheetHeader className="text-left border-b border-zinc-800 pb-4">
              <Badge variant="outline" className="text-rose-400 border-rose-400/20 bg-rose-500/10 w-fit">
                SOP Failed Runs
              </Badge>
              <SheetTitle className="text-xl text-zinc-100 mt-2">{selectedSopTitle}</SheetTitle>
              <SheetDescription className="text-zinc-500">
                Failed runs for this SOP template in the selected period.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-4">
              {selectedSopFailures.map((f) => (
                <div
                  key={f.run}
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/40 transition-all cursor-pointer group"
                  onClick={() => setSelectedFailure(f)}
                >
                  <div className="flex flex-col gap-1 min-w-0 mr-4">
                    <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
                      {f.person.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Due: {new Date(f.due_at.replace(' ', 'T')).toLocaleString()}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase font-mono bg-rose-500/10 text-rose-400 border-rose-500/20 shrink-0">
                    {getOverdueDuration(f.due_at)}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-800 pt-6 mt-auto">
              <Button
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                onClick={() => { setSelectedSopTitle(null); setSelectedSopFailures([]); }}
              >
                Close List
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function OperationNode({
  node,
  level,
  defaultExpanded = false,
  onUserClick,
}: {
  node: TreeNode;
  level: number;
  defaultExpanded?: boolean;
  onUserClick: (user: { id: string; name: string; role: string; branch?: string }) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;
  const score = node.score as { combinedScore?: number; combined_score?: number; ownScore?: number; own_score?: number };
  const combinedScore = score?.combinedScore ?? score?.combined_score ?? 0;
  const ownScore = score?.ownScore ?? score?.own_score ?? 0;
  const scorePercentage = Math.round(combinedScore * 100);
  let scoreColor = 'text-zinc-300 bg-zinc-800';
  if (combinedScore >= 0.8) scoreColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  else if (combinedScore >= 0.5) scoreColor = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  else scoreColor = 'text-rose-400 bg-rose-400/10 border-rose-400/20';

  return (
    <div className="flex flex-col min-w-max">
      <div
        className={cn('flex items-center p-3 rounded-lg transition-colors hover:bg-zinc-800/40 relative group cursor-pointer')}
        style={{ paddingLeft: `${Math.max(0.75, level * 2)}rem` }}
        onClick={() => onUserClick(node.user)}
      >
        {level > 0 && (
          <div
            className="absolute left-0 top-1/2 w-6 border-t border-zinc-800 -z-10 group-hover:border-zinc-700 transition-colors pointer-events-none"
            style={{ left: `${(level - 1) * 2 + 1}rem` }}
          />
        )}
        {level > 0 && (
          <div
            className="absolute top-0 bottom-1/2 border-l border-zinc-800 -z-10 group-hover:border-zinc-700 transition-colors pointer-events-none"
            style={{ left: `${(level - 1) * 2 + 1}rem` }}
          />
        )}
        <div
          className="w-8 h-8 flex items-center justify-center shrink-0 mr-1 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded-md z-10"
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          )}
        </div>
        <Avatar className="h-8 w-8 rounded-md border border-zinc-700 mr-3 shrink-0">
          <AvatarImage src={node.user.avatarUrl} />
          <AvatarFallback className="text-xs bg-zinc-800 text-zinc-300 rounded-md">
            {node.user.name?.charAt(0) ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-[200px] pr-4">
          <span className="font-medium text-sm text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
            {node.user.name}
          </span>
          <span className="text-[10px] text-zinc-500 truncate">
            {node.user.role} {node.user.branch ? `• ${node.user.branch}` : ''}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4 pl-4 shrink-0">
          <div className="flex flex-col text-right w-20">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Own Score</span>
            <span className="text-xs text-zinc-400 font-mono mt-0.5">{Math.round(ownScore * 100)}%</span>
          </div>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <div className="flex flex-col text-right w-24">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Combined KPI</span>
            <div className="flex items-center justify-end gap-2 mt-0.5">
              <Badge
                variant="outline"
                className={cn('px-1.5 py-0 border font-mono text-xs shadow-sm shadow-black', scoreColor)}
              >
                {scorePercentage}%
              </Badge>
            </div>
          </div>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="flex flex-col relative">
          <div
            className="absolute top-0 bottom-6 border-l border-zinc-800 -z-10 pointer-events-none"
            style={{ left: `${level * 2 + 1.35}rem` }}
          />
          {node.children!.map((child) => (
            <OperationNode
              key={child.user.id}
              node={child}
              level={level + 1}
              defaultExpanded={false}
              onUserClick={onUserClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
