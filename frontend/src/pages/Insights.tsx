import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import {
  getScoreTrends,
  getDepartmentComparison,
  getBranchComparison,
  getTopBottomPerformers,
  getTemplatePerformance,
  getCompletionTrend,
  getCorrectiveActionSummary,
  getDayOfWeekHeatmap,
  getScoreDistribution,
  getMostMissedItems,
  getEmployeesByDepartment,
  getEmployeesByBranch,
} from '@/services/insights';
import type {
  ScoreTrendPoint,
  DeptBranchItem,
  PerformerItem,
  TemplatePerformanceItem,
  CompletionTrendPoint,
  CorrectiveActionSummary,
  DayOfWeekItem,
  ScoreDistributionItem,
  MostMissedItem,
  InsightFilters,
  FilteredEmployeeScore,
} from '@/services/insights';
import {
  InsightsFiltersBar,
  rangeFromPreset,
  type DateRangeValue,
} from '@/components/insights/InsightsFilters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, TrendingUp, AlertTriangle, CalendarDays } from 'lucide-react';
import { TableEmptyState } from '@/components/ui/table-states';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { scoreStatus, scoreBgClass, formatScore } from '@/lib/score';
import { Meter } from '@/components/ui/meter';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const CHART_COLORS = ['var(--pass)', 'var(--risk)', 'var(--fail)', 'var(--waive)', 'var(--mute)'];

const DAY_INTENSITY_CLASS: Record<'pass' | 'risk' | 'fail' | 'none', string> = {
  pass: 'bg-pass',
  risk: 'bg-risk',
  fail: 'bg-fail',
  none: 'bg-slab-2',
};

export function Insights() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month' | 'Custom'>('Day');
  const [isLoading, setIsLoading] = useState(true);
  const [scoreTrends, setScoreTrends] = useState<ScoreTrendPoint[]>([]);
  const [deptComparison, setDeptComparison] = useState<DeptBranchItem[]>([]);
  const [branchComparison, setBranchComparison] = useState<DeptBranchItem[]>([]);
  const [performers, setPerformers] = useState<{ top: PerformerItem[]; bottom: PerformerItem[] }>({ top: [], bottom: [] });
  const [templatePerf, setTemplatePerf] = useState<TemplatePerformanceItem[]>([]);
  const [completionTrend, setCompletionTrend] = useState<CompletionTrendPoint[]>([]);
  const [caSummary, setCaSummary] = useState<CorrectiveActionSummary | null>(null);
  const [dayHeatmap, setDayHeatmap] = useState<DayOfWeekItem[]>([]);
  const [scoreDist, setScoreDist] = useState<ScoreDistributionItem[]>([]);
  const [mostMissed, setMostMissed] = useState<MostMissedItem[]>([]);
  const [filters, setFilters] = useState<InsightFilters>({});
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => rangeFromPreset('90d'));
  const [filteredEmployees, setFilteredEmployees] = useState<FilteredEmployeeScore[]>([]);
  const [drillLabel, setDrillLabel] = useState<string | null>(null);

  const showInsights = currentUser && currentUser.systemRole && ['Pulse Executive', 'Pulse Leader'].includes(currentUser.systemRole);

  useEffect(() => {
    if (!showInsights) {
      setIsLoading(false);
      return;
    }
    async function load() {
      setIsLoading(true);
      const { start, end } = dateRange;
      // Use range end for single-date widgets so "Demo data" preset shows data
      const refDate = end || todayISO();
      // Legacy snapshot-based charts do not support Custom; fall back to Day for those.
      const legacyPeriodType = periodType === 'Custom' ? 'Day' : periodType;
      try {
        const [trends, dept, branch, perf, tmpl, compl, ca, heat, dist, missed] = await Promise.all([
          getScoreTrends(start, end, periodType, filters),
          getDepartmentComparison(refDate, legacyPeriodType, filters),
          getBranchComparison(refDate, legacyPeriodType, filters),
          getTopBottomPerformers(refDate, legacyPeriodType, 5, filters),
          getTemplatePerformance(start, end, filters),
          getCompletionTrend(start, end, filters),
          getCorrectiveActionSummary(filters),
          getDayOfWeekHeatmap(start, end, filters),
          getScoreDistribution(refDate, legacyPeriodType, filters),
          getMostMissedItems(start, end, 10, filters),
        ]);
        setScoreTrends(trends);
        setDeptComparison(dept);
        setBranchComparison(branch);
        setPerformers(perf);
        setTemplatePerf(tmpl);
        setCompletionTrend(compl);
        setCaSummary(ca);
        setDayHeatmap(heat);
        setScoreDist(dist);
        setMostMissed(missed);
      } catch (e) {
        console.error('Insights load failed', e);
      }
      setIsLoading(false);
    }
    load();
  }, [showInsights, periodType, filters, dateRange.start, dateRange.end]);

  const legacyPeriodType = periodType === 'Custom' ? 'Day' : periodType;

  const handleDeptBarClick = (dept: string) => {
    setFilters((f) => ({ ...f, department: dept }));
    setDrillLabel(`Department: ${dept}`);
    const refDate = dateRange.end || todayISO();
    getEmployeesByDepartment(dept, refDate, legacyPeriodType).then(setFilteredEmployees);
  };

  const handleBranchBarClick = (branch: string) => {
    setFilters((f) => ({ ...f, branch }));
    setDrillLabel(`Branch: ${branch}`);
    const refDate = dateRange.end || todayISO();
    getEmployeesByBranch(branch, refDate, legacyPeriodType).then(setFilteredEmployees);
  };

  const clearDrill = () => {
    setFilteredEmployees([]);
    setDrillLabel(null);
  };

  if (!currentUser) return null;

  if (!showInsights) {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-rule border-dashed rounded-lg bg-slab/50">
        <BarChart3 size={48} className="text-mute mb-4" />
        <h3 className="text-base font-medium text-text">Access Restricted</h3>
        <p className="text-sm text-mute mt-1 text-center max-w-sm">
          Insights are reserved for Executive and Leader roles.
        </p>
      </div>
    );
  }

  const deptAvg = deptComparison.length > 0 ? deptComparison.reduce((s, d) => s + d.avg_score, 0) / deptComparison.length : 0;
  const branchAvg = branchComparison.length > 0 ? branchComparison.reduce((s, b) => s + b.avg_score, 0) / branchComparison.length : 0;
  const openCount = caSummary?.by_status?.find((s) => s.status === 'Open')?.count ?? 0;
  const inProgressCount = caSummary?.by_status?.find((s) => s.status === 'In Progress')?.count ?? 0;

  const trendData = scoreTrends.map((t) => ({
    ...t,
    pct: t.avg_score != null ? Math.round(t.avg_score * 100) : null,
  }));

  const trendTotals = trendData.reduce(
    (acc, t) => ({
      eligible: acc.eligible + (t.eligible_runs ?? 0),
      passed: acc.passed + (t.passed_runs ?? 0),
      failed: acc.failed + (t.failed_runs ?? 0),
    }),
    { eligible: 0, passed: 0, failed: 0 }
  );

  function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: typeof trendData[number] }>; label?: string }) {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="bg-slab border border-rule-2 p-3 rounded-lg shadow-lg">
          <p className="text-xs text-mute mb-1">{label}</p>
          <p className="text-lg font-bold font-mono text-text">
            {p.avg_score != null ? `${Math.round(p.avg_score * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-faint mt-1 font-mono">
            {p.eligible_runs} eligible • {p.passed_runs} passed • {p.failed_runs} failed
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text">Insights</h1>
            <p className="text-mute text-sm mt-1">Organizational analytics and performance trends.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-slab/50 p-1 rounded-lg border border-rule">
              {(['Day', 'Week', 'Month', 'Custom'] as const).map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPeriodType(p)}
                  className={cn(
                    'h-8 px-3 text-xs font-medium',
                    periodType === p ? 'bg-slab-2 text-text' : 'text-faint hover:text-mute'
                  )}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <InsightsFiltersBar
          filters={filters}
          dateRange={dateRange}
          onFiltersChange={setFilters}
          onDateRangeChange={setDateRange}
        />
      </div>

      {filteredEmployees.length > 0 && (
        <Card className="bg-slab border-rule">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-text">
              Filtered Employees {drillLabel ? `(${drillLabel}, ${filteredEmployees.length} results)` : ''}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearDrill} className="text-mute hover:text-text">
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-rule">
                  <TableHead className="text-mute">Name</TableHead>
                  <TableHead className="text-mute">Role</TableHead>
                  <TableHead className="text-mute">Branch</TableHead>
                  <TableHead className="text-mute text-right">Own</TableHead>
                  <TableHead className="text-mute text-right">Team</TableHead>
                  <TableHead className="text-mute text-right">Combined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((row) => (
                  <TableRow
                    key={row.userId}
                    className="border-rule cursor-pointer hover:bg-slab-2/50"
                    onClick={() => navigate(`/operations/${row.userId}`)}
                  >
                    <TableCell className="text-text font-medium">{row.user?.name}</TableCell>
                    <TableCell className="text-mute">{row.user?.role ?? '—'}</TableCell>
                    <TableCell className="text-mute">{row.user?.branch ?? '—'}</TableCell>
                    <TableCell className="text-right"><ScoreCell pct={(row.own_score ?? 0) * 100} /></TableCell>
                    <TableCell className="text-right"><ScoreCell pct={(row.team_score ?? 0) * 100} /></TableCell>
                    <TableCell className="text-right"><ScoreCell pct={(row.combined_score ?? 0) * 100} emphasize /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-48 bg-slab rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Org Score Trend</CardTitle>
                <CardDescription className="text-xs">Run-level compliance score over selected range</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px] flex flex-col gap-2">
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                      <XAxis dataKey="date" tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<TrendTooltip />} />
                      <Line type="monotone" dataKey="pct" stroke="var(--mute)" strokeWidth={2} dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-mute shrink-0">
                  <span>Eligible {trendTotals.eligible}</span>
                  <span className="text-pass">Passed {trendTotals.passed}</span>
                  <span className="text-fail">Failed {trendTotals.failed}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Completion Rate Trend</CardTitle>
                <CardDescription className="text-xs">Daily completion rate</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={completionTrend.map((t) => ({ ...t, pct: Math.round(t.rate * 100) }))}>
                    <defs>
                      <linearGradient id="complGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--mute)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--mute)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--slab)', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--text)' }} />
                    <Area type="monotone" dataKey="pct" stroke="var(--mute)" fill="url(#complGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-slab border-rule">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-mute uppercase">Dept Avg</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="text-2xl font-bold font-mono text-text">{formatScore(deptAvg * 100)}</div>
                <Meter
                  size="sm"
                  segments={[
                    { value: Math.max(0, Math.min(100, deptAvg * 100)), className: scoreBgClass(deptAvg * 100, 100) },
                    { value: 100 - Math.max(0, Math.min(100, deptAvg * 100)), className: 'bg-slab-2' },
                  ]}
                />
              </CardContent>
            </Card>
            <Card className="bg-slab border-rule">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-mute uppercase">Branch Avg</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="text-2xl font-bold font-mono text-text">{formatScore(branchAvg * 100)}</div>
                <Meter
                  size="sm"
                  segments={[
                    { value: Math.max(0, Math.min(100, branchAvg * 100)), className: scoreBgClass(branchAvg * 100, 100) },
                    { value: 100 - Math.max(0, Math.min(100, branchAvg * 100)), className: 'bg-slab-2' },
                  ]}
                />
              </CardContent>
            </Card>
            <Card className="bg-slab border-rule">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-mute uppercase">Open CAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-risk">{openCount + inProgressCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-slab border-rule">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-mute uppercase">Avg Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-text">
                  {caSummary?.avg_resolution_hours != null ? `${caSummary.avg_resolution_hours.toFixed(1)} hrs` : '—'}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Department Comparison</CardTitle>
                <CardDescription className="text-xs">Click a bar to see employees</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptComparison.map((d) => ({ name: d.department ?? '—', dept: d.department ?? '—', score: Math.round((d.avg_score ?? 0) * 100) }))} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: 'var(--mute)', fontSize: 10 }} />
                    <Bar dataKey="score" fill="var(--mute)" radius={[0, 4, 4, 0]} barSize={20} onClick={(_data, _i, _e) => { const payload = (_data as { payload?: { dept?: string } }).payload; if (payload?.dept) handleDeptBarClick(payload.dept); }} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Branch Comparison</CardTitle>
                <CardDescription className="text-xs">Click a bar to see employees</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchComparison.map((b) => ({ name: b.branch ?? '—', branch: b.branch ?? '—', score: Math.round((b.avg_score ?? 0) * 100) }))} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: 'var(--mute)', fontSize: 10 }} />
                    <Bar dataKey="score" fill="var(--mute)" radius={[0, 4, 4, 0]} barSize={20} onClick={(_data, _i, _e) => { const payload = (_data as { payload?: { branch?: string } }).payload; if (payload?.branch) handleBranchBarClick(payload.branch); }} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {performers.top.map((p) => (
                    <div
                      key={p.employee}
                      className="flex items-center justify-between p-2 rounded-lg bg-pass/10 border border-pass/20 cursor-pointer hover:bg-pass/20"
                      onClick={() => navigate(`/operations/${p.employee}`)}
                    >
                      <span className="text-sm font-medium text-text">{p.employee_name}</span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-bold font-mono text-pass">{formatScore(p.combined_score * 100)}</span>
                        <Meter
                          size="sm"
                          className="w-16"
                          segments={[
                            { value: Math.max(0, Math.min(100, p.combined_score * 100)), className: 'bg-pass' },
                            { value: 100 - Math.max(0, Math.min(100, p.combined_score * 100)), className: 'bg-slab-2' },
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                  {performers.top.length === 0 && (
                    <TableEmptyState
                      icon={<TrendingUp size={16} />}
                      title="No top performers yet"
                      description="Scores will appear here once employees complete checklists in this period."
                    />
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Needs Attention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {performers.bottom.map((p) => (
                    <div
                      key={p.employee}
                      className="flex items-center justify-between p-2 rounded-lg bg-fail/10 border border-fail/20 cursor-pointer hover:bg-fail/20"
                      onClick={() => navigate(`/operations/${p.employee}`)}
                    >
                      <span className="text-sm font-medium text-text">{p.employee_name}</span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-bold font-mono text-fail">{formatScore(p.combined_score * 100)}</span>
                        <Meter
                          size="sm"
                          className="w-16"
                          segments={[
                            { value: Math.max(0, Math.min(100, p.combined_score * 100)), className: 'bg-fail' },
                            { value: 100 - Math.max(0, Math.min(100, p.combined_score * 100)), className: 'bg-slab-2' },
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                  {performers.bottom.length === 0 && (
                    <TableEmptyState
                      icon={<AlertTriangle size={16} />}
                      title="No one needs attention"
                      description="Low-scoring employees will show up here once there's enough completed activity."
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Template Performance</CardTitle>
                <CardDescription className="text-xs">Avg completion rate by SOP</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={templatePerf.map((t) => ({ name: t.title?.slice(0, 15) ?? t.template, pct: Math.round(t.avg_completion * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--mute)', fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Bar dataKey="pct" fill="var(--mute)" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Day of Week</CardTitle>
                <CardDescription className="text-xs">Completion rate by weekday</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px] flex items-center justify-center">
                <div className="flex gap-2 flex-wrap justify-center">
                  {dayHeatmap.map((d) => {
                    const rate = d.avg_rate;
                    const intensity = DAY_INTENSITY_CLASS[scoreStatus(rate * 100)];
                    return (
                      <div key={d.day_num} className="flex flex-col items-center gap-1">
                        <div className={cn('w-10 h-8 rounded flex items-center justify-center text-[10px] font-bold font-mono text-text', intensity)} style={{ opacity: 0.5 + rate * 0.5 }}>
                          {Math.round(rate * 100)}%
                        </div>
                        <span className="text-[10px] text-mute">{d.day_name?.slice(0, 2)}</span>
                      </div>
                    );
                  })}
                  {dayHeatmap.length === 0 && (
                    <TableEmptyState
                      icon={<CalendarDays size={16} />}
                      title="Not enough data for this period"
                      description="Day-of-week completion rates will appear once checklists have been completed across multiple days."
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Score Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreDist.map((s) => ({ name: s.bracket, count: s.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--mute)', fontSize: 9 }} />
                    <YAxis tick={{ fill: 'var(--mute)', fontSize: 10 }} />
                    <Bar dataKey="count" fill="var(--mute)" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Corrective Actions</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={caSummary?.by_status ?? []}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {(caSummary?.by_status ?? []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--slab)', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--text)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slab border-rule">
            <CardHeader>
              <CardTitle className="text-sm text-text">Most Missed Items</CardTitle>
              <CardDescription className="text-xs">Checklist items missed most frequently</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-rule">
                    <TableHead className="text-mute">Item</TableHead>
                    <TableHead className="text-mute">Template</TableHead>
                    <TableHead className="text-mute">Department</TableHead>
                    <TableHead className="text-mute text-right">Misses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mostMissed.map((m) => (
                    <TableRow key={m.checklist_item + m.template_title} className="border-rule">
                      <TableCell className="text-text">{m.checklist_item}</TableCell>
                      <TableCell className="text-mute">{m.template_title}</TableCell>
                      <TableCell className="text-mute">{m.department}</TableCell>
                      <TableCell className="text-right font-bold font-mono text-fail">{m.misses}</TableCell>
                    </TableRow>
                  ))}
                  {mostMissed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-mute text-center py-4">
                        No missed items in period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ScoreCell({ pct, emphasize = false }: { pct: number; emphasize?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`font-mono text-sm ${emphasize ? 'font-medium text-text' : 'text-mute'}`}>
        {formatScore(pct)}
      </span>
      <Meter
        size="sm"
        className="w-12"
        segments={[
          { value: clamped, className: scoreBgClass(pct, 100) },
          { value: 100 - clamped, className: 'bg-slab-2' },
        ]}
      />
    </div>
  );
}
