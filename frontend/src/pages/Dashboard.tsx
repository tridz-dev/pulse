import { useEffect, useState } from 'react';
import type { FailureItem, ComplianceScoreResponse } from '@/types';
import { useAuth } from '@/store/AuthContext';
import { getTeamScores, getFailureAnalytics } from '@/services/scores';
import type { TeamScoreItem } from '@/services/scores';
import { getDemoStatus, installDemoData } from '@/services/demo';
import { getFailureList, getComplianceScore } from '@/services/operations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, TrendingDown, Database, AlertTriangle, ChevronRight } from 'lucide-react';
import { Ledger } from '@/components/ui/ledger';
import { Gauge } from '@/components/ui/gauge';

// Hero metric display: 'ledger' (big number, default) or 'arc' (Core · optional
// hero-arc variant per pulse_design/DESIGN.md). Exactly one hero per page either way.
const HERO_VARIANT: 'ledger' | 'arc' = 'arc';
import { StatusStrokeCard } from '@/components/ui/status-stroke-card';
import { StatusChip } from '@/components/ui/status-chip';
import { PageShell, PageHeader } from '@/components/shared/page-shell';
import { PeriodToggle } from '@/components/shared/period-toggle';
import { StatTile } from '@/components/shared/stat-tile';
import { ChartFrame } from '@/components/shared/chart-frame';
import { Skeleton, SkeletonRow } from '@/components/shared/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { scoreStatus, scoreTextClass, scoreBgClass } from '@/lib/score';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A date that falls inside the immediately preceding period, for a real trend comparison. */
function getPreviousPeriodDateISO(periodType: 'Day' | 'Week' | 'Month'): string {
  const d = new Date();
  if (periodType === 'Day') d.setDate(d.getDate() - 1);
  else if (periodType === 'Week') d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
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
  // Standardize timestamp separator to avoid safari parse issues
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

const STATUS_LABEL: Record<string, string> = {
  pass: 'EXCEPTIONAL',
  risk: 'STABLE',
  fail: 'CRITICAL',
  none: 'NO DATA',
};

export function Dashboard() {
  const { currentUser, refetch } = useAuth();
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [heroScore, setHeroScore] = useState<ComplianceScoreResponse | null>(null);
  const [prevHeroScore, setPrevHeroScore] = useState<ComplianceScoreResponse | null>(null);
  const [personalScore, setPersonalScore] = useState<ComplianceScoreResponse | null>(null);
  const [teamData, setTeamData] = useState<TeamScoreItem[]>([]);
  const [analytics, setAnalytics] = useState<{ id: string; taskName: string; templateName: string; misses: number }[]>([]);
  const [failures, setFailures] = useState<FailureItem[]>([]);
  const [isFailuresLoading, setIsFailuresLoading] = useState(false);
  const [isFailuresSheetOpen, setIsFailuresSheetOpen] = useState(false);
  const [selectedFailure, setSelectedFailure] = useState<FailureItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const retryLoad = () => setRetryToken((t) => t + 1);
  const [demoStatus, setDemoStatus] = useState<{ can_load_demo: boolean; can_clear_demo: boolean; has_demo_data: boolean } | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    getDemoStatus().then(setDemoStatus).catch(() => setDemoStatus(null));
  }, []);

  useEffect(() => {
    async function loadStats() {
      if (!currentUser) return;
      setIsLoading(true);
      setLoadError(null);
      const today = todayISO();
      const isManager = !!currentUser.systemRole && ['Pulse Executive', 'Pulse Leader', 'Pulse Manager'].includes(currentUser.systemRole);
      try {
        const personal = await getComplianceScore(currentUser.id, 'personal', today, periodType);
        setPersonalScore(personal);
        // Manager-facing hero gauge defaults to inherited (team) health; individual
        // contributors have no team to inherit from, so their hero is their personal score.
        const heroScope = isManager ? 'inherited' : 'personal';
        const hero = isManager
          ? await getComplianceScore(currentUser.id, 'inherited', today, periodType)
          : personal;
        setHeroScore(hero);

        // Real trend: same scope, immediately preceding period. Never fabricated —
        // if the prior period has no eligible runs, the comparison stays null and
        // the UI shows "no data" rather than inventing a number.
        const prevDate = getPreviousPeriodDateISO(periodType);
        const prevHero = await getComplianceScore(currentUser.id, heroScope, prevDate, periodType);
        setPrevHeroScore(prevHero);

        if (isManager) {
          const team = await getTeamScores(currentUser.id, today, periodType);
          setTeamData(team);
          const analyticsData = await getFailureAnalytics(currentUser.id, today);
          setAnalytics(analyticsData.mostMissedTasks ?? []);

          setIsFailuresLoading(true);
          const range = getPeriodRange(periodType);
          const failData = await getFailureList(range.start, range.end, 1, 50);
          setFailures(failData.items ?? []);
          setIsFailuresLoading(false);
        } else {
          setTeamData([]);
          setAnalytics([]);
          setFailures([]);
        }
      } catch (error) {
        console.error('Failed to load dashboard stats', error);
        setLoadError(error instanceof Error ? error.message : 'Could not load dashboard data.');
      }
      setIsLoading(false);
    }
    loadStats();
  }, [currentUser, periodType, retryToken]);

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    try {
      const r = await installDemoData(true);
      if (r?.ok) {
        window.alert(r.message ?? 'Demo data load queued. It will run in the background.');
        refetch();
        getDemoStatus().then(setDemoStatus);
      }
    } catch (e) {
      console.error(e);
      window.alert('Failed to load demo data.');
    }
    setDemoLoading(false);
  };

  if (!currentUser) {
    const canLoad = demoStatus?.can_load_demo && !demoStatus?.has_demo_data;
    return (
      <PageShell className="pb-10">
        <PageHeader title="Execution Dashboard" />
        <Card className="bg-slab border-rule max-w-xl">
          <CardHeader>
            <CardTitle className="text-lg text-text">No employee record</CardTitle>
            <CardDescription>
              {canLoad
                ? 'Load demo data to create sample users, employees, SOPs, and runs so you can explore the app.'
                : 'Your user is not linked to a PM Employee. Contact your administrator or load demo data if you are an admin.'}
            </CardDescription>
          </CardHeader>
          {canLoad && (
            <CardContent>
              <Button onClick={handleLoadDemo} disabled={demoLoading} className="gap-2">
                <Database className="h-4 w-4" />
                {demoLoading ? <span className="font-mono">WORKING…</span> : 'Load demo data'}
              </Button>
            </CardContent>
          )}
        </Card>
      </PageShell>
    );
  }

  // Hero score: pass straight through, no null-to-zero collapsing. A
  // genuinely null score (zero eligible runs) must stay null so it renders
  // the "no data" state rather than a misleading red 0%.
  const heroPct = heroScore?.score != null ? Math.round(heroScore.score * 100) : null;
  const prevHeroPct = prevHeroScore?.score != null ? Math.round(prevHeroScore.score * 100) : null;
  const trendDelta = heroPct != null && prevHeroPct != null ? heroPct - prevHeroPct : null;
  const ownPct = personalScore?.score != null ? Math.round(personalScore.score * 100) : null;
  const totalItems = personalScore?.eligible_runs ?? 0;
  const completedItems = personalScore?.passed_runs ?? 0;
  const teamScore = teamData.length > 0
    ? (() => {
        const validScores = teamData.filter(t => t.combined_score != null);
        return validScores.length > 0
          ? validScores.reduce((sum, t) => sum + t.combined_score!, 0) / validScores.length
          : null;
      })()
    : null;
  const heroStatus = scoreStatus(heroPct, 100);
  const isManager = !!currentUser.systemRole && ['Pulse Executive', 'Pulse Leader', 'Pulse Manager'].includes(currentUser.systemRole);

  // Real composition (passed/failed/pending), not a naive percentage split — the hero
  // number must explain itself via the same three counts quoted in the sentence below it.
  const heroPassed = heroScore?.passed_runs ?? 0;
  const heroFailed = heroScore?.failed_runs ?? 0;
  const heroEligible = heroScore?.eligible_runs ?? 0;
  const heroPending = Math.max(0, heroEligible - heroPassed - heroFailed);
  const heroSegments = heroEligible > 0
    ? [
        { value: heroPassed, className: 'bg-pass' },
        { value: heroFailed, className: 'bg-fail' },
        ...(heroPending > 0 ? [{ value: heroPending, className: 'bg-slab-2' }] : []),
      ]
    : undefined;

  const barChartData = teamData
    .filter(t => t.combined_score != null)
    .map((t) => ({
      name: t.user?.name?.split(' ')[0] ?? t.user?.id ?? '',
      score: Math.round(t.combined_score! * 100),
      role: t.user?.role,
    }));

  const showLoadDemoCard = demoStatus?.can_load_demo && !demoStatus?.has_demo_data;

  return (
    <PageShell className="pb-10">
      {showLoadDemoCard && (
        <Card className="bg-risk-bg border-risk-bd">
          <CardContent className="flex flex-row items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-risk" />
              <div>
                <p className="text-sm font-medium text-risk">No demo data on this site</p>
                <p className="text-xs text-risk">Load sample users, employees, SOPs and runs to explore the app.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLoadDemo} disabled={demoLoading} className="gap-2 border-risk-bd text-risk hover:bg-risk-bg">
              <Database className="h-4 w-4" />
              {demoLoading ? <span className="font-mono">WORKING…</span> : 'Load demo data'}
            </Button>
          </CardContent>
        </Card>
      )}
      <PageHeader
        title="Execution Dashboard"
        subtitle={currentUser.systemRole === 'Pulse User'
          ? 'Your performance overview.'
          : 'High-level metrics and performance roll-ups.'}
        action={<PeriodToggle value={periodType} onChange={setPeriodType} />}
      />

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32">
                <Skeleton height="lg" />
              </div>
            ))}
          </div>
          <div className="h-96 mt-4">
            <Skeleton height="lg" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Card
              className={cn(
                "bg-slab border-rule md:col-span-2 p-8 relative overflow-hidden flex items-center gap-12 group transition-all",
                currentUser.systemRole && ['Pulse Executive', 'Pulse Leader', 'Pulse Manager'].includes(currentUser.systemRole)
                  ? "cursor-pointer hover:border-rule-2"
                  : "hover:border-rule-2/50"
              )}
              onClick={() => {
                if (currentUser.systemRole && ['Pulse Executive', 'Pulse Leader', 'Pulse Manager'].includes(currentUser.systemRole)) {
                  setIsFailuresSheetOpen(true);
                }
              }}
            >
              {heroPct === null ? (
                <div className="flex flex-col items-center justify-center gap-2 w-[180px] shrink-0">
                  <span className="font-mono text-2xl text-faint">—</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                    {`${periodType} KPI`}
                  </span>
                </div>
              ) : HERO_VARIANT === 'arc' ? (
                <Gauge value={heroPct} label={`${periodType} KPI`} segments={heroSegments} className="w-[180px] shrink-0" />
              ) : (
                <Ledger value={heroPct} label={`${periodType} KPI`} segments={heroSegments} />
              )}

              <div className="flex flex-col justify-center gap-6 flex-1">
                <div>
                  <h2 className="text-2xl font-bold text-text tracking-tight">Execution Health</h2>
                  <p className="text-sm text-mute mt-2 max-w-sm leading-relaxed">
                    Your overall performance rating based on {completedItems} completed tasks and team roll-ups for
                    this {periodType.toLowerCase()}.
                  </p>
                  {heroEligible > 0 && (
                    <p className="text-[10px] font-mono uppercase tracking-wide text-faint mt-2">
                      {heroPassed} passed · {heroFailed} failed
                      {heroPending > 0 ? ` · ${heroPending} pending` : ''} · {heroEligible} total
                    </p>
                  )}
                  {currentUser.systemRole && ['Pulse Executive', 'Pulse Leader', 'Pulse Manager'].includes(currentUser.systemRole) && (
                    <span className="text-xs text-sel font-medium inline-flex items-center gap-1 mt-3 group-hover:text-sel transition-colors">
                      View failing runs in scope ({heroFailed}) <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-mute font-mono uppercase tracking-widest font-bold">
                      Trend
                    </span>
                    {trendDelta === null ? (
                      <span className="text-sm font-bold font-mono text-faint mt-1">—</span>
                    ) : (
                      <div className={cn('flex items-center gap-1.5 mt-1', trendDelta > 0 ? 'text-pass' : trendDelta < 0 ? 'text-fail' : 'text-mute')}>
                        {trendDelta > 0 ? <TrendingUp size={16} /> : trendDelta < 0 ? <TrendingDown size={16} /> : null}
                        <span className="text-sm font-bold font-mono">
                          {trendDelta > 0 ? '+' : ''}
                          {trendDelta}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="w-px h-8 bg-rule" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-mute font-mono uppercase tracking-widest font-bold">
                      Status
                    </span>
                    <span className={cn('text-sm font-bold mt-1', scoreTextClass(heroPct, 100))}>
                      {STATUS_LABEL[heroStatus]}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
            <div className="flex flex-col gap-4">
              {/* For an individual contributor the hero above IS their personal score
                  (heroScore === personalScore) — showing it again here as "Own Execution"
                  is the same fact in a second chart type, not new information. Only
                  managers, whose hero is the team-inherited score, get a distinct
                  personal number worth a second card. */}
              {isManager && (
                <Card className="bg-slab border-rule flex-1 p-4">
                  <StatTile
                    value={ownPct}
                    label="Own Execution"
                    description={`${totalItems} Assigned Tasks`}
                    segments={totalItems > 0 ? [
                      { value: Math.max(0, Math.min(100, ownPct ?? 0)), className: scoreBgClass(ownPct, 100) },
                      { value: 100 - Math.max(0, Math.min(100, ownPct ?? 0)), className: 'bg-slab-2' },
                    ] : undefined}
                  />
                </Card>
              )}
              <Card className="bg-slab border-rule flex-1 p-4">
                <StatTile
                  value={teamData.length > 0 ? (teamScore !== null ? Math.round(teamScore * 100) : null) : completedItems}
                  label={teamData.length > 0 ? 'Team Roll-up' : 'Activity'}
                  description={teamData.length > 0 ? 'Direct Reports Avg' : 'Items Completed'}
                  segments={teamData.length > 0 && teamScore !== null ? [
                    {
                      value: Math.max(0, Math.min(100, Math.round(teamScore * 100))),
                      className: scoreBgClass(Math.round(teamScore * 100), 100),
                    },
                    {
                      value: 100 - Math.max(0, Math.min(100, Math.round(teamScore * 100))),
                      className: 'bg-slab-2',
                    },
                  ] : undefined}
                />
              </Card>
            </div>
          </div>

          {isManager && (
            <Card className="bg-slab border-rule">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-text">Execution by Group</CardTitle>
                  <CardDescription className="text-xs">
                    Performance aggregated for the selected {periodType.toLowerCase()}.
                  </CardDescription>
                </div>
                <Calendar className="h-4 w-4 text-mute" />
              </CardHeader>
              <CardContent className="w-full mt-4">
                <ChartFrame
                  state={loadError ? 'error' : isLoading ? 'loading' : barChartData.length === 0 ? 'zero' : 'ready'}
                  minHeight="300px"
                  zeroMessage={{
                    title: 'No team data yet',
                    description: 'Team performance data will appear once your direct reports have run items.',
                  }}
                  errorMessage={{
                    title: "Couldn't load",
                    description: 'Something went wrong loading this chart. Try again.',
                    action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                  }}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--rule)" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--mute)', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--mute)', fontSize: 12 }}
                        domain={[0, 100]}
                        tickFormatter={(val) => `${val}%`}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--slab-2)' }}
                        contentStyle={{
                          backgroundColor: 'var(--slab)',
                          border: '1px solid var(--rule)',
                          borderRadius: 'var(--radius)',
                          color: 'var(--text)',
                        }}
                        itemStyle={{ color: 'var(--text)' }}
                      />
                      <Bar dataKey="score" radius={[0, 0, 0, 0]} barSize={40}>
                        {barChartData.map((entry, index) => {
                          const status = scoreStatus(entry.score, 100);
                          const color =
                            status === 'pass'
                              ? 'var(--pass)'
                              : status === 'risk'
                                ? 'var(--risk)'
                                : status === 'fail'
                                  ? 'var(--fail)'
                                  : 'var(--mute)';
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartFrame>
              </CardContent>
            </Card>
          )}

          {analytics.length > 0 && periodType === 'Day' && (
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-base text-text">Organization-wide Failure Points</CardTitle>
                <CardDescription className="text-xs">
                  Tasks that were missed most frequently across all branches.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 mt-2">
                {analytics.map((item) => (
                  <StatusStrokeCard
                    key={item.id}
                    status="fail"
                    className="flex items-center justify-between bg-slab-2/60 transition-all hover:bg-slab-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-text">{item.taskName}</span>
                      <span className="text-xs text-mute">{item.templateName}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold font-mono text-fail">{item.misses}</span>
                      <span className="text-[10px] text-mute uppercase tracking-wider">Misses</span>
                    </div>
                  </StatusStrokeCard>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Sheet open={isFailuresSheetOpen} onOpenChange={setIsFailuresSheetOpen}>
        <SheetContent className="bg-ink border-rule w-full sm:max-w-xl p-0 flex flex-col transition-all duration-300">
          <SheetHeader className="p-6 border-b border-rule bg-slab/30">
            <div className="flex items-center gap-4">
              <AlertTriangle className="text-fail" size={24} />
              <div className="flex flex-col">
                <SheetTitle className="text-xl text-text font-bold tracking-tight">
                  Active Failure Points
                </SheetTitle>
                <SheetDescription className="text-mute font-mono text-xs uppercase tracking-widest mt-0.5">
                  Failed SOP runs in visible scope • {periodType}
                </SheetDescription>
              </div>
              <StatusChip status="fail" className="ml-auto font-mono">
                {failures.length} Failed
              </StatusChip>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-4">
            {isFailuresLoading ? (
              <div className="flex flex-col gap-4">
                <SkeletonRow cellCount={1} height="lg" />
                <SkeletonRow cellCount={1} height="lg" />
                <SkeletonRow cellCount={1} height="lg" />
              </div>
            ) : failures.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-rule rounded-[var(--radius)] bg-slab/20">
                <p className="text-mute text-sm">No failing SOP runs found in your scope for this period.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {failures.map((f) => (
                  <div
                    key={f.run}
                    className="flex items-center justify-between p-4 rounded-[var(--radius)] border border-rule bg-slab/40 hover:bg-slab-2/30 transition-all cursor-pointer group"
                    onClick={() => setSelectedFailure(f)}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-text group-hover:text-sel transition-colors">
                        {f.template_title}
                      </span>
                      <span className="text-xs text-mute">
                        Assigned to: <span className="font-medium text-text">{f.person.name}</span>
                      </span>
                      <span className="text-[10px] text-faint font-mono mt-0.5">
                        Due: {new Date(f.due_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusChip status="fail" className="text-[10px] uppercase font-mono">
                        {getOverdueDuration(f.due_at)}
                      </StatusChip>
                      <ChevronRight size={16} className="text-faint group-hover:text-mute transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {selectedFailure && (
        <Sheet open={!!selectedFailure} onOpenChange={(open) => { if (!open) setSelectedFailure(null); }}>
          <SheetContent className="bg-slab-2 border-rule sm:max-w-md w-full p-6 flex flex-col h-full text-text">
            <SheetHeader className="text-left border-b border-rule pb-4">
              <div className="flex items-center justify-between">
                <StatusChip status="fail">
                  Failed Run
                </StatusChip>
                <Badge variant="secondary" className="bg-slab text-mute">
                  Read Only
                </Badge>
              </div>
              <SheetTitle className="text-xl text-text mt-2">{selectedFailure.template_title}</SheetTitle>
              <SheetDescription className="text-mute">
                Run: {selectedFailure.run}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-6">
              <div className="bg-slab/50 border border-rule rounded-[var(--radius)] p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-mute font-mono uppercase tracking-widest font-bold">
                    Assigned Person
                  </span>
                  <span className="text-sm font-medium text-text">
                    {selectedFailure.person.name}
                  </span>
                  <span className="text-[10px] text-mute font-mono">
                    ID: {selectedFailure.person.employee}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-mute font-mono uppercase tracking-widest font-bold">
                    Due Date & Time
                  </span>
                  <span className="text-sm font-medium text-text">
                    {new Date(selectedFailure.due_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-mute font-mono uppercase tracking-widest font-bold">
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
                className="w-full bg-slab hover:bg-slab-2 text-text"
                onClick={() => setSelectedFailure(null)}
              >
                Close Details
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </PageShell>
  );
}
