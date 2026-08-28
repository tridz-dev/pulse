import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { getOperationsOverview, getFailureList, getComplianceScore } from '@/services/operations';
import type { TreeNode } from '@/services/operations';
import type { FailureItem, ComplianceScoreResponse } from '@/types';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/ui/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Ledger } from '@/components/ui/ledger';
import { Network, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TreeRow, TreeRowGroup } from '@/components/ui/tree-row';
import { Disclosure } from '@/components/ui/disclosure';
import { scoreStatus } from '@/lib/score';
import { PageShell, PageHeader } from '@/components/shared/page-shell';
import { PeriodToggle } from '@/components/shared/period-toggle';
import { Skeleton, SkeletonRow } from '@/components/shared/skeleton';

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
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-rule border-dashed rounded bg-slab">
        <Network size={48} className="text-faint mb-4" />
        <h3 className="text-base font-medium text-text">Access Restricted</h3>
        <p className="text-sm text-mute mt-1 text-center max-w-sm">
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
    <PageShell>
      <PageHeader
        title="Mission Control"
        subtitle="Hierarchical roll-up of organizational execution."
        action={
          <PeriodToggle
            value={periodType}
            onChange={setPeriodType}
          />
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="bg-slab rounded-[var(--radius)] border border-rule p-6">
            <Skeleton height="lg" width="80px" className="mb-4" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slab rounded-[var(--radius)] border border-rule p-6 lg:col-span-2">
              <SkeletonRow cellCount={2} cellWidths={["60%", "40%"]} height="md" className="mb-4" />
              <SkeletonRow cellCount={2} cellWidths={["60%", "40%"]} height="md" />
            </div>
            <div className="bg-slab rounded-[var(--radius)] border border-rule p-6">
              <SkeletonRow cellCount={1} cellWidths={["100%"]} height="md" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top section: Compliance Ledger & Weakest Subtree callout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slab md:col-span-2 border-rule p-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
              <div className="shrink-0">
                <Ledger
                  value={complianceScore && complianceScore.score !== null ? Math.round(complianceScore.score * 100) : null}
                  label="Inherited KPI"
                />
              </div>
              <div className="flex-1 flex flex-col gap-3 text-center md:text-left">
                <div>
                  <h2 className="text-xl font-semibold text-text tracking-tight">Inherited Compliance Score</h2>
                  <p className="text-mute text-xs mt-1">
                    Prominently showing your team's overall inherited score based on {complianceScore?.eligible_runs || 0} eligible runs ({complianceScore?.passed_runs || 0} passed, {complianceScore?.failed_runs || 0} failed) for the selected period.
                  </p>
                </div>
              </div>
            </Card>

            {weakestNode && (
              <Card
                className="bg-slab border-rule p-6 flex flex-col justify-between hover:border-rule-2 transition-all cursor-pointer group"
                onClick={() => navigate(`/operations/${weakestNode!.user.id}`)}
              >
                <div>
                  <span className="text-[10px] text-fail font-bold uppercase tracking-wider">Weakest Subtree / Person</span>
                  <h3 className="text-lg font-bold text-text mt-2 transition-colors">
                    {weakestNode.user.name}
                  </h3>
                  <p className="text-xs text-mute mt-1">
                    {weakestNode.user.role} {weakestNode.user.branch ? `• ${weakestNode.user.branch}` : ''}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-rule flex items-center justify-between">
                  <span className="text-xs text-faint">Score</span>
                  <StatusChip status="fail" className="font-mono text-xs font-bold">
                    {Math.round((weakestNode.score.combinedScore ?? 0) * 100)}%
                  </StatusChip>
                </div>
              </Card>
            )}
          </div>

          {/* Attention Lists Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Failed runs card */}
            <Card className="bg-slab border-rule lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-rule">
                <div>
                  <CardTitle className="text-lg font-bold text-text">Failed runs</CardTitle>
                  <CardDescription className="text-xs text-faint">
                    Failing SOP runs ordered by overdue duration, repeat occurrences, and due time.
                  </CardDescription>
                </div>
                <StatusChip status="fail" className="font-mono">
                  {sortedFailures.length} Failed
                </StatusChip>
              </CardHeader>
              <CardContent className="p-0">
                {isFailuresLoading ? (
                  <div className="p-6 space-y-3">
                    <SkeletonRow cellCount={3} cellWidths={["50%", "30%", "20%"]} height="md" />
                    <SkeletonRow cellCount={3} cellWidths={["50%", "30%", "20%"]} height="md" />
                  </div>
                ) : sortedFailures.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-faint text-sm">No failed runs found in scope for this period.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-rule max-h-[450px] overflow-y-auto">
                    {sortedFailures.map((f) => (
                      <div
                        key={f.run}
                        className="flex items-center justify-between p-4 hover:bg-slab-2 transition-all cursor-pointer group"
                        onClick={() => setSelectedFailure(f)}
                      >
                        <div className="flex flex-col gap-1 min-w-0 mr-4">
                          <span className="text-sm font-semibold text-text truncate transition-colors">
                            {f.template_title}
                          </span>
                          <span className="text-xs text-mute truncate">
                            Assigned to:{' '}
                            <span
                              className="font-medium text-text hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/operations/${f.person.employee}`);
                              }}
                            >
                              {f.person.name}
                            </span>
                          </span>
                          <span className="text-[10px] text-faint font-mono mt-0.5">
                            Due: {new Date(f.due_at.replace(' ', 'T')).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <StatusChip status="fail" className="text-[10px] uppercase font-mono">
                            {getOverdueDuration(f.due_at)}
                          </StatusChip>
                          {f.repeatCount > 1 && (
                            <StatusChip status="risk" className="text-[10px] uppercase font-mono">
                              {f.repeatCount}x repeat fail
                            </StatusChip>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Most repeated failed SOPs */}
            <Card className="bg-slab border-rule">
              <CardHeader className="pb-2 border-b border-rule">
                <CardTitle className="text-lg font-bold text-text">Repeated SOP Failures</CardTitle>
                <CardDescription className="text-xs text-faint">
                  SOP templates with the highest failure count in this period.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isFailuresLoading ? (
                  <div className="p-6 space-y-3">
                    <SkeletonRow cellCount={2} cellWidths={["70%", "30%"]} height="md" />
                    <SkeletonRow cellCount={2} cellWidths={["70%", "30%"]} height="md" />
                  </div>
                ) : sortedSops.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-faint text-sm">No SOP failures found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-rule">
                    {sortedSops.map((sop) => (
                      <div
                        key={sop.title}
                        className="flex items-center justify-between p-4 hover:bg-slab-2 transition-all cursor-pointer group"
                        onClick={() => {
                          const sopFailures = failures.filter(f => f.template_title === sop.title);
                          setSelectedSopTitle(sop.title);
                          setSelectedSopFailures(sopFailures);
                        }}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 mr-4">
                          <span className="text-sm font-semibold text-text truncate transition-colors">
                            {sop.title}
                          </span>
                          <span className="text-xs text-faint font-mono">
                            Click to view failures
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-base font-bold text-fail">{sop.count}</span>
                          <span className="text-[9px] text-faint uppercase tracking-wider font-semibold">Failures</span>
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
            <Disclosure
              className="mt-4"
              defaultOpen={true}
              title={
                <span className="flex items-center gap-2">
                  <Trophy size={16} className="text-mute" />
                  Organization Health ({periodType})
                </span>
              }
              meta="Select a row to drill down"
            >
              <div className="overflow-x-auto -mx-1.5 -my-1">
                <div className="min-w-[600px]">
                  <TreeRowGroup className="border-0 rounded-none">
                    <OperationNode
                      node={treeData}
                      level={0}
                      defaultExpanded={true}
                      onUserClick={(u) => navigate(`/operations/${u.id}`)}
                    />
                  </TreeRowGroup>
                </div>
              </div>
            </Disclosure>
          )}
        </>
      )}

      {/* Run Detail Sheet */}
      {selectedFailure && (
        <Sheet open={!!selectedFailure} onOpenChange={(open) => { if (!open) setSelectedFailure(null); }}>
          <SheetContent className="bg-slab border-rule sm:max-w-md w-full p-6 flex flex-col h-full text-text">
            <SheetHeader className="text-left border-b border-rule pb-4">
              <div className="flex items-center justify-between">
                <StatusChip status="fail">
                  Failed Run
                </StatusChip>
                <Badge variant="secondary" className="bg-slab-2 text-mute">
                  Read Only
                </Badge>
              </div>
              <SheetTitle className="text-xl text-text mt-2">{selectedFailure.template_title}</SheetTitle>
              <SheetDescription className="text-faint">
                Run ID: {selectedFailure.run}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-6">
              <div className="bg-slab-2 border border-rule p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-faint font-mono uppercase tracking-widest font-bold">
                    Assigned Person
                  </span>
                  <span
                    className="text-sm font-medium text-text hover:underline cursor-pointer"
                    onClick={() => {
                      setSelectedFailure(null);
                      navigate(`/operations/${selectedFailure.person.employee}`);
                    }}
                  >
                    {selectedFailure.person.name}
                  </span>
                  <span className="text-[10px] text-faint font-mono">
                    ID: {selectedFailure.person.employee}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-faint font-mono uppercase tracking-widest font-bold">
                    Due Date & Time
                  </span>
                  <span className="text-sm font-medium text-text">
                    {new Date(selectedFailure.due_at.replace(' ', 'T')).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-faint font-mono uppercase tracking-widest font-bold">
                    Current Status
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusChip status="fail" className="uppercase text-[10px]">
                      {selectedFailure.status}
                    </StatusChip>
                    <span className="text-xs text-fail font-mono">
                      ({getOverdueDuration(selectedFailure.due_at)})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-rule pt-6 mt-auto">
              <Button
                className="w-full bg-slab-2 hover:bg-slab-2/70 text-text"
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
          <SheetContent className="bg-slab border-rule sm:max-w-md w-full p-6 flex flex-col h-full text-text">
            <SheetHeader className="text-left border-b border-rule pb-4">
              <StatusChip status="fail" className="w-fit">
                SOP Failed Runs
              </StatusChip>
              <SheetTitle className="text-xl text-text mt-2">{selectedSopTitle}</SheetTitle>
              <SheetDescription className="text-faint">
                Failed runs for this SOP template in the selected period.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-4">
              {selectedSopFailures.map((f) => (
                <div
                  key={f.run}
                  className="flex items-center justify-between p-3 border border-rule bg-slab-2/60 hover:bg-slab-2 transition-all cursor-pointer group"
                  onClick={() => setSelectedFailure(f)}
                >
                  <div className="flex flex-col gap-1 min-w-0 mr-4">
                    <span className="text-xs font-semibold text-text truncate transition-colors">
                      {f.person.name}
                    </span>
                    <span className="text-[10px] text-faint font-mono">
                      Due: {new Date(f.due_at.replace(' ', 'T')).toLocaleString()}
                    </span>
                  </div>
                  <StatusChip status="fail" className="text-[9px] uppercase font-mono shrink-0">
                    {getOverdueDuration(f.due_at)}
                  </StatusChip>
                </div>
              ))}
            </div>

            <div className="border-t border-rule pt-6 mt-auto">
              <Button
                className="w-full bg-slab-2 hover:bg-slab-2/70 text-text"
                onClick={() => { setSelectedSopTitle(null); setSelectedSopFailures([]); }}
              >
                Close List
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </PageShell>
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
  const combinedScore = node.score?.combinedScore ?? 0;
  const totalItems = node.score?.total_items ?? node.score?.totalGeneratedItems ?? 0;
  const completedItems = node.score?.completed_items ?? node.score?.completedItems ?? 0;
  const scorePercentage = Math.round(combinedScore * 100);
  const status = scoreStatus(scorePercentage);

  // Prefer real composition counts (completed vs remaining) when available,
  // falling back to a synthetic 2-segment score split otherwise.
  const meter =
    totalItems > 0
      ? [
          { value: completedItems, className: 'bg-pass' },
          { value: Math.max(totalItems - completedItems, 0), className: 'bg-fail' },
        ]
      : [
          { value: scorePercentage, className: 'bg-pass' },
          { value: 100 - scorePercentage, className: 'bg-fail' },
        ];

  const rowLevel: 0 | 1 = level > 0 ? 1 : 0;

  return (
    <div className="flex flex-col" style={{ marginLeft: level > 1 ? `${(level - 1) * 1.5}rem` : undefined }}>
      <TreeRow
        level={rowLevel}
        name={
          <span className="flex flex-col items-start min-w-0">
            <span className="truncate">{node.user.name}</span>
            <span className="text-[10px] font-normal text-faint truncate">
              {node.user.role} {node.user.branch ? `• ${node.user.branch}` : ''}
            </span>
          </span>
        }
        score={status === 'none' ? null : scorePercentage}
        meter={meter}
        expanded={hasChildren ? isExpanded : undefined}
        onToggle={hasChildren ? () => setIsExpanded(!isExpanded) : undefined}
        onClick={hasChildren ? undefined : () => onUserClick(node.user)}
        onDoubleClick={hasChildren ? () => onUserClick(node.user) : undefined}
      />
      {isExpanded && hasChildren && (
        <div className="flex flex-col">
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
