import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { pulseQueryKeys } from '@/lib/queryClient';
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
  getOutcomeSummary,
  getEmployeesByDepartment,
  getEmployeesByBranch,
} from '@/services/insights';
import type {
  ScoreTrendPoint,
  DeptBranchItem,
  TemplatePerformanceItem,
  CompletionTrendPoint,
  CorrectiveActionSummary,
  DayOfWeekItem,
  ScoreDistributionItem,
  MostMissedItem,
  OutcomeSummaryRow,
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
import { BarChart3 } from 'lucide-react';
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

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const CHART_COLORS = ['#6366f1', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

export function Insights() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [filters, setFilters] = useState<InsightFilters>({});
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => rangeFromPreset('90d'));
  const [filteredEmployees, setFilteredEmployees] = useState<FilteredEmployeeScore[]>([]);
  const [drillLabel, setDrillLabel] = useState<string | null>(null);

  const showInsights = !!(currentUser && currentUser.systemRole && ['Pulse Executive', 'Pulse Leader'].includes(currentUser.systemRole));

  const insightsKey = useMemo(
    () =>
      JSON.stringify({
        periodType,
        start: dateRange.start,
        end: dateRange.end,
        filters,
      }),
    [periodType, dateRange.start, dateRange.end, filters],
  );

  const { data: bundle, isLoading } = useQuery({
    queryKey: pulseQueryKeys.insightsBundle(insightsKey),
    enabled: showInsights,
    staleTime: 120_000,
    gcTime: 15 * 60_000,
    queryFn: async () => {
      const { start, end } = dateRange;
      const refDate = end || todayISO();
      const [trends, dept, branch, perf, tmpl, compl, ca, heat, dist, missed, outcomes] = await Promise.all([
        getScoreTrends(start, end, periodType, filters),
        getDepartmentComparison(refDate, periodType, filters),
        getBranchComparison(refDate, periodType, filters),
        getTopBottomPerformers(refDate, periodType, 5, filters),
        getTemplatePerformance(start, end, filters),
        getCompletionTrend(start, end, filters),
        getCorrectiveActionSummary(filters),
        getDayOfWeekHeatmap(start, end, filters),
        getScoreDistribution(refDate, periodType, filters),
        getMostMissedItems(start, end, 10, filters),
        getOutcomeSummary(start, end, filters),
      ]);
      return {
        scoreTrends: trends,
        deptComparison: dept,
        branchComparison: branch,
        performers: perf,
        templatePerf: tmpl,
        completionTrend: compl,
        caSummary: ca,
        dayHeatmap: heat,
        scoreDist: dist,
        mostMissed: missed,
        outcomeSummary: outcomes,
      };
    },
  });

  const scoreTrends: ScoreTrendPoint[] = bundle?.scoreTrends ?? [];
  const deptComparison: DeptBranchItem[] = bundle?.deptComparison ?? [];
  const branchComparison: DeptBranchItem[] = bundle?.branchComparison ?? [];
  const performers = bundle?.performers ?? { top: [], bottom: [] };
  const templatePerf: TemplatePerformanceItem[] = bundle?.templatePerf ?? [];
  const completionTrend: CompletionTrendPoint[] = bundle?.completionTrend ?? [];
  const caSummary: CorrectiveActionSummary | null = bundle?.caSummary ?? null;
  const dayHeatmap: DayOfWeekItem[] = bundle?.dayHeatmap ?? [];
  const scoreDist: ScoreDistributionItem[] = bundle?.scoreDist ?? [];
  const mostMissed: MostMissedItem[] = bundle?.mostMissed ?? [];
  const outcomeSummary: OutcomeSummaryRow[] = bundle?.outcomeSummary ?? [];

  const handleDeptBarClick = (dept: string) => {
    setFilters((f) => ({ ...f, department: dept }));
    setDrillLabel(`Department: ${dept}`);
    const refDate = dateRange.end || todayISO();
    getEmployeesByDepartment(dept, refDate, periodType as 'Day' | 'Week' | 'Month').then(setFilteredEmployees);
  };

  const handleBranchBarClick = (branch: string) => {
    setFilters((f) => ({ ...f, branch }));
    setDrillLabel(`Branch: ${branch}`);
    const refDate = dateRange.end || todayISO();
    getEmployeesByBranch(branch, refDate, periodType as 'Day' | 'Week' | 'Month').then(setFilteredEmployees);
  };

  const clearDrill = () => {
    setFilteredEmployees([]);
    setDrillLabel(null);
  };

  if (!currentUser) return null;

  if (!showInsights) {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
        <BarChart3 size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-base font-medium text-zinc-300">Access Restricted</h3>
        <p className="text-sm text-zinc-500 mt-1 text-center max-w-sm">
          Insights are reserved for Executive and Leader roles.
        </p>
      </div>
    );
  }

  const deptAvg = deptComparison.length > 0 ? deptComparison.reduce((s, d) => s + d.avg_score, 0) / deptComparison.length : 0;
  const branchAvg = branchComparison.length > 0 ? branchComparison.reduce((s, b) => s + b.avg_score, 0) / branchComparison.length : 0;
  const openCount = caSummary?.by_status?.find((s) => s.status === 'Open')?.count ?? 0;
  const inProgressCount = caSummary?.by_status?.find((s) => s.status === 'In Progress')?.count ?? 0;

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Insights</h1>
            <p className="text-zinc-400 text-sm mt-1">Organizational analytics and performance trends.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
              {(['Day', 'Week', 'Month'] as const).map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPeriodType(p)}
                  className={cn(
                    'h-8 px-3 text-xs font-medium',
                    periodType === p ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
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
        <Card className="bg-[#141415] border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-zinc-200">
              Filtered Employees {drillLabel ? `(${drillLabel}, ${filteredEmployees.length} results)` : ''}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearDrill} className="text-zinc-400 hover:text-zinc-200">
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Name</TableHead>
                  <TableHead className="text-zinc-400">Role</TableHead>
                  <TableHead className="text-zinc-400">Branch</TableHead>
                  <TableHead className="text-zinc-400 text-right">Own</TableHead>
                  <TableHead className="text-zinc-400 text-right">Team</TableHead>
                  <TableHead className="text-zinc-400 text-right">Combined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((row) => (
                  <TableRow
                    key={row.userId}
                    className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50"
                    onClick={() => navigate(`/operations/${row.userId}`)}
                  >
                    <TableCell className="text-zinc-200 font-medium">{row.user?.name}</TableCell>
                    <TableCell className="text-zinc-400">{row.user?.role ?? '—'}</TableCell>
                    <TableCell className="text-zinc-400">{row.user?.branch ?? '—'}</TableCell>
                    <TableCell className="text-right text-zinc-300">{Math.round((row.own_score ?? 0) * 100)}%</TableCell>
                    <TableCell className="text-right text-zinc-300">{Math.round((row.team_score ?? 0) * 100)}%</TableCell>
                    <TableCell className="text-right font-medium text-white">{Math.round((row.combined_score ?? 0) * 100)}%</TableCell>
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
            <div key={i} className="h-48 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Org Score Trend</CardTitle>
                <CardDescription className="text-xs">Avg combined score over last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreTrends.map((t) => ({ ...t, pct: Math.round(t.avg_score * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Completion Rate Trend</CardTitle>
                <CardDescription className="text-xs">Daily completion rate</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={completionTrend.map((t) => ({ ...t, pct: Math.round(t.rate * 100) }))}>
                    <defs>
                      <linearGradient id="complGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="pct" stroke="#6366f1" fill="url(#complGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-500 uppercase">Dept Avg</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{Math.round(deptAvg * 100)}%</div>
              </CardContent>
            </Card>
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-500 uppercase">Branch Avg</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{Math.round(branchAvg * 100)}%</div>
              </CardContent>
            </Card>
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-500 uppercase">Open CAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-400">{openCount + inProgressCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-500 uppercase">Avg Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {caSummary?.avg_resolution_hours != null ? `${caSummary.avg_resolution_hours.toFixed(1)} hrs` : '—'}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Department Comparison</CardTitle>
                <CardDescription className="text-xs">Click a bar to see employees</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptComparison.map((d) => ({ name: d.department ?? '—', dept: d.department ?? '—', score: Math.round((d.avg_score ?? 0) * 100) }))} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#71717a', fontSize: 10 }} />
                    <Bar dataKey="score" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} onClick={(_data, _i, _e) => { const payload = (_data as { payload?: { dept?: string } }).payload; if (payload?.dept) handleDeptBarClick(payload.dept); }} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Branch Comparison</CardTitle>
                <CardDescription className="text-xs">Click a bar to see employees</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchComparison.map((b) => ({ name: b.branch ?? '—', branch: b.branch ?? '—', score: Math.round((b.avg_score ?? 0) * 100) }))} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#71717a', fontSize: 10 }} />
                    <Bar dataKey="score" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={20} onClick={(_data, _i, _e) => { const payload = (_data as { payload?: { branch?: string } }).payload; if (payload?.branch) handleBranchBarClick(payload.branch); }} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {performers.top.map((p) => (
                    <div
                      key={p.employee}
                      className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20"
                      onClick={() => navigate(`/operations/${p.employee}`)}
                    >
                      <span className="text-sm font-medium text-zinc-200">{p.employee_name}</span>
                      <span className="text-sm font-bold text-emerald-400">{Math.round(p.combined_score * 100)}%</span>
                    </div>
                  ))}
                  {performers.top.length === 0 && <p className="text-xs text-zinc-500">No data</p>}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Needs Attention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {performers.bottom.map((p) => (
                    <div
                      key={p.employee}
                      className="flex items-center justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 cursor-pointer hover:bg-rose-500/20"
                      onClick={() => navigate(`/operations/${p.employee}`)}
                    >
                      <span className="text-sm font-medium text-zinc-200">{p.employee_name}</span>
                      <span className="text-sm font-bold text-rose-400">{Math.round(p.combined_score * 100)}%</span>
                    </div>
                  ))}
                  {performers.bottom.length === 0 && <p className="text-xs text-zinc-500">No data</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Template Performance</CardTitle>
                <CardDescription className="text-xs">Avg completion rate by SOP</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={templatePerf.map((t) => ({ name: t.title?.slice(0, 15) ?? t.template, pct: Math.round(t.avg_completion * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Bar dataKey="pct" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Day of Week</CardTitle>
                <CardDescription className="text-xs">Completion rate by weekday</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px] flex items-center justify-center">
                <div className="flex gap-2 flex-wrap justify-center">
                  {dayHeatmap.map((d) => {
                    const rate = d.avg_rate;
                    const intensity = rate >= 0.8 ? 'bg-emerald-500' : rate >= 0.6 ? 'bg-amber-500' : 'bg-rose-500';
                    return (
                      <div key={d.day_num} className="flex flex-col items-center gap-1">
                        <div className={cn('w-10 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white', intensity)} style={{ opacity: 0.5 + rate * 0.5 }}>
                          {Math.round(rate * 100)}%
                        </div>
                        <span className="text-[10px] text-zinc-500">{d.day_name?.slice(0, 2)}</span>
                      </div>
                    );
                  })}
                  {dayHeatmap.length === 0 && <p className="text-xs text-zinc-500">No data</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Pass / Fail outcomes</CardTitle>
                <CardDescription className="text-xs">Pass/Fail checklist items (excludes N/A)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Template</TableHead>
                      <TableHead className="text-zinc-400 text-right">Pass</TableHead>
                      <TableHead className="text-zinc-400 text-right">Fail</TableHead>
                      <TableHead className="text-zinc-400 text-right">Pass rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outcomeSummary.map((r) => (
                      <TableRow key={r.template_id} className="border-zinc-800">
                        <TableCell className="text-zinc-200 text-xs max-w-[140px] truncate">{r.template_title}</TableCell>
                        <TableCell className="text-right text-emerald-400 text-xs">{r.passed}</TableCell>
                        <TableCell className="text-right text-rose-400 text-xs">{r.failed}</TableCell>
                        <TableCell className="text-right text-zinc-300 text-xs">{Math.round(r.pass_rate * 100)}%</TableCell>
                      </TableRow>
                    ))}
                    {outcomeSummary.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-xs text-zinc-500">
                          No Pass/Fail items in range
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Score Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreDist.map((s) => ({ name: s.bracket, count: s.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-200">Corrective Actions</CardTitle>
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
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#141415] border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-200">Most Missed Items</CardTitle>
              <CardDescription className="text-xs">Checklist items missed most frequently</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">Item</TableHead>
                    <TableHead className="text-zinc-400">Template</TableHead>
                    <TableHead className="text-zinc-400">Department</TableHead>
                    <TableHead className="text-zinc-400 text-right">Misses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mostMissed.map((m) => (
                    <TableRow key={m.checklist_item + m.template_title} className="border-zinc-800">
                      <TableCell className="text-zinc-200">{m.checklist_item}</TableCell>
                      <TableCell className="text-zinc-400">{m.template_title}</TableCell>
                      <TableCell className="text-zinc-400">{m.department}</TableCell>
                      <TableCell className="text-right font-bold text-rose-400">{m.misses}</TableCell>
                    </TableRow>
                  ))}
                  {mostMissed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-zinc-500 text-center py-4">
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
