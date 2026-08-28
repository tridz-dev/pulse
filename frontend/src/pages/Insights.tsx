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
  getInsightDepartments,
  getInsightBranches,
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
  rangeFromPreset,
  type DateRangeValue,
  type DateRangePreset,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { BarChart3, TrendingUp, AlertTriangle, ChevronDown, X } from 'lucide-react';
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
import { isPartialBucket } from '@/lib/chart-helpers';
import { Meter } from '@/components/ui/meter';
import { PageShell, PageHeader } from '@/components/shared/page-shell';
import { StatTile } from '@/components/shared/stat-tile';
import { PeriodToggle } from '@/components/shared/period-toggle';
import { ChartFrame } from '@/components/shared/chart-frame';
import { StatusStrokeCard } from '@/components/ui/status-stroke-card';

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

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: ScoreTrendPoint & { pct: number | null } }>; label?: string }) {
  if (active && payload && payload.length) {
    const p = payload[0].payload;
    return (
      <div className="bg-slab border border-rule-2 p-3 rounded-[var(--radius)] shadow-lg">
        <p className="text-xs text-mute mb-1">{label}</p>
        <p className="text-lg font-bold font-mono text-text">
          {p.pct != null ? `${p.pct}%` : '—'}
        </p>
        <p className="text-[10px] text-faint mt-1 font-mono">
          {p.eligible_runs} eligible • {p.passed_runs} passed • {p.failed_runs} failed
        </p>
      </div>
    );
  }
  return null;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { date?: string; [key: string]: unknown };
}

function OrgScoreTrendDot({ cx, cy, payload }: DotProps) {
  const today = todayISO();
  const isPartial = payload?.date ? isPartialBucket(payload.date as string, today) : false;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="var(--mute)"
      stroke={isPartial ? 'var(--mute)' : 'none'}
      strokeWidth={isPartial ? 2 : 0}
      strokeDasharray={isPartial ? '2 2' : 'none'}
      opacity={isPartial ? 0.6 : 1}
    />
  );
}

function CompletionTrendDot({ cx, cy, payload }: DotProps) {
  const today = todayISO();
  const isPartial = payload?.date ? isPartialBucket(payload.date as string, today) : false;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="var(--mute)"
      stroke={isPartial ? 'var(--mute)' : 'none'}
      strokeWidth={isPartial ? 2 : 0}
      strokeDasharray={isPartial ? '2 2' : 'none'}
      opacity={isPartial ? 0.6 : 1}
    />
  );
}

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const showInsights = currentUser && currentUser.systemRole && ['Pulse Executive', 'Pulse Leader'].includes(currentUser.systemRole);
  const hasActiveFilters = Object.keys(filters).length > 0 || drillLabel !== null;

  useEffect(() => {
    if (!showInsights) {
      return;
    }
    async function load() {
      setIsLoading(true);
      setLoadError(null);
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
        setLoadError(e instanceof Error ? e.message : 'Could not load insights data.');
      }
      setIsLoading(false);
    }
    load();
  }, [showInsights, periodType, filters, dateRange, retryToken]);

  const retryLoad = () => setRetryToken((t) => t + 1);

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

  // Departments and branches helpers
  const [departments, setDepartments] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    const loadDepts = async () => {
      try {
        const depts = await getInsightDepartments();
        setDepartments(depts || []);
      } catch (e) {
        console.error('Failed to load departments', e);
      }
    };
    const loadBranches = async () => {
      try {
        const brnchs = await getInsightBranches();
        setBranches(brnchs || []);
      } catch (e) {
        console.error('Failed to load branches', e);
      }
    };
    loadDepts();
    loadBranches();
  }, []);

  const selectedDepts = Array.isArray(filters.department) ? filters.department : filters.department ? [filters.department] : [];
  const selectedBranches = Array.isArray(filters.branch) ? filters.branch : filters.branch ? [filters.branch] : [];

  const toggleDepartment = (name: string) => {
    const next = selectedDepts.includes(name) ? selectedDepts.filter((d) => d !== name) : [...selectedDepts, name];
    setFilters({ ...filters, department: next.length ? next : undefined });
  };

  const toggleBranch = (name: string) => {
    const next = selectedBranches.includes(name) ? selectedBranches.filter((b) => b !== name) : [...selectedBranches, name];
    setFilters({ ...filters, branch: next.length ? next : undefined });
  };

  const clearAllFilters = () => {
    setFilters({});
    setDateRange(rangeFromPreset('90d'));
  };

  if (!currentUser) return null;

  if (!showInsights) {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-rule border-dashed rounded-[var(--radius)] bg-slab/50">
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

  return (
    <PageShell className="pb-10">
      <PageHeader
        title="Insights"
        subtitle="Organizational analytics and performance trends."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {periodType !== 'Custom' && (
              <PeriodToggle
                value={periodType as 'Day' | 'Week' | 'Month'}
                onChange={(p) => setPeriodType(p)}
              />
            )}
            {periodType === 'Custom' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium bg-slab-2 border border-rule rounded-[var(--radius)] text-mute">
                <span>Custom date range active</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPeriodType('Day')}
                  className="h-6 px-2 text-xs font-medium ml-1"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        }
      />
      {/* Custom date range and filter controls with Demo data separated visually */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range presets (without Demo data) */}
        <div className="flex gap-1 rounded-[var(--radius)] border border-rule bg-slab-2 p-1">
          {[
            { id: '7d' as DateRangePreset, label: 'Last 7 days' },
            { id: '30d' as DateRangePreset, label: 'Last 30 days' },
            { id: '90d' as DateRangePreset, label: 'Last 90 days' },
            { id: 'month' as DateRangePreset, label: 'This month' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDateRange(rangeFromPreset(id))}
              className={cn(
                'rounded-[var(--radius)] px-2.5 py-1 text-xs font-medium transition-colors',
                dateRange.preset === id
                  ? 'bg-slab text-text'
                  : 'text-mute hover:bg-slab hover:text-text'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Visual divider */}
        <div className="w-px h-6 bg-rule opacity-30" />

        {/* Demo data (data-source switch, visually separated) */}
        <button
          type="button"
          onClick={() => setDateRange(rangeFromPreset('demo'))}
          className={cn(
            'rounded-[var(--radius)] px-2.5 py-1 text-xs font-medium transition-colors border border-rule',
            dateRange.preset === 'demo'
              ? 'bg-slab text-text'
              : 'text-mute hover:bg-slab hover:text-text'
          )}
        >
          Demo data
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Department dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center h-8 px-3 text-sm rounded-[var(--radius)] border border-rule bg-slab-2 text-text hover:bg-slab gap-1"
          >
            Department {selectedDepts.length > 0 ? `(${selectedDepts.length})` : ''}
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Filter by department</DropdownMenuLabel>
              {departments.map((d) => (
                <DropdownMenuCheckboxItem
                  key={d}
                  checked={selectedDepts.includes(d)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleDepartment(d)}
                >
                  {d}
                </DropdownMenuCheckboxItem>
              ))}
              {departments.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-faint">No departments</div>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Branch dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center h-8 px-3 text-sm rounded-[var(--radius)] border border-rule bg-slab-2 text-text hover:bg-slab gap-1"
          >
            Branch {selectedBranches.length > 0 ? `(${selectedBranches.length})` : ''}
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Filter by branch</DropdownMenuLabel>
              {branches.map((b) => (
                <DropdownMenuCheckboxItem
                  key={b}
                  checked={selectedBranches.includes(b)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleBranch(b)}
                >
                  {b}
                </DropdownMenuCheckboxItem>
              ))}
              {branches.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-faint">No branches</div>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 gap-1 text-mute hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
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

      {!isLoading && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Org Score Trend</h3>
                <p className="text-xs text-mute">Run-level compliance score over selected range</p>
              </div>
              <ChartFrame
                state={loadError ? 'error' : isLoading ? 'loading' : trendData.length === 0 ? (hasActiveFilters ? 'filtered-empty' : 'zero') : 'ready'}
                minHeight="220px"
                zeroMessage={{
                  title: 'No score data',
                  description: 'Scores will appear here once runs are completed in this period.',
                }}
                filteredEmptyMessage={{
                  title: 'No matching data',
                  description: 'No score data matches the active filters for this period. Try clearing a filter.',
                }}
                errorMessage={{
                  title: "Couldn't load",
                  description: 'Something went wrong loading this chart. Try again.',
                  action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                }}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip content={<TrendTooltip />} />
                    <Line type="monotone" dataKey="pct" stroke="var(--mute)" strokeWidth={2} dot={<OrgScoreTrendDot />} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-mute px-4 pb-4 shrink-0">
                  <span>Eligible {trendTotals.eligible}</span>
                  <span className="text-pass">Passed {trendTotals.passed}</span>
                  <span className="text-fail">Failed {trendTotals.failed}</span>
                </div>
              </ChartFrame>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Completion Rate Trend</h3>
                <p className="text-xs text-mute">Daily completion rate</p>
              </div>
              <ChartFrame
                state={loadError ? 'error' : isLoading ? 'loading' : completionTrend.length === 0 ? (hasActiveFilters ? 'filtered-empty' : 'zero') : 'ready'}
                minHeight="220px"
                zeroMessage={{
                  title: 'No completion data',
                  description: 'Completion rates will appear here once checklists are completed in this period.',
                }}
                filteredEmptyMessage={{
                  title: 'No matching data',
                  description: 'No completion rates match the active filters for this period. Try clearing a filter.',
                }}
                errorMessage={{
                  title: "Couldn't load",
                  description: 'Something went wrong loading this chart. Try again.',
                  action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                }}
              >
                <ResponsiveContainer width="100%" height={200}>
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
                    <Area type="monotone" dataKey="pct" stroke="var(--mute)" fill="url(#complGrad)" strokeWidth={2} dot={<CompletionTrendDot />} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-slab border-rule p-4">
              <StatTile
                value={deptComparison.length > 0 ? Math.round(deptAvg * 100) : 0}
                label="Dept Avg"
                segments={
                  deptComparison.length > 0
                    ? [
                        { value: Math.max(0, Math.min(100, deptAvg * 100)), className: scoreBgClass(deptAvg * 100, 100) },
                        { value: 100 - Math.max(0, Math.min(100, deptAvg * 100)), className: 'bg-slab-2' },
                      ]
                    : undefined
                }
              />
            </Card>
            <Card className="bg-slab border-rule p-4">
              <StatTile
                value={branchComparison.length > 0 ? Math.round(branchAvg * 100) : 0}
                label="Branch Avg"
                segments={
                  branchComparison.length > 0
                    ? [
                        { value: Math.max(0, Math.min(100, branchAvg * 100)), className: scoreBgClass(branchAvg * 100, 100) },
                        { value: 100 - Math.max(0, Math.min(100, branchAvg * 100)), className: 'bg-slab-2' },
                      ]
                    : undefined
                }
              />
            </Card>
            <Card className="bg-slab border-rule p-4">
              <StatTile
                value={openCount + inProgressCount}
                label="Open CAs"
              />
            </Card>
            <Card className="bg-slab border-rule p-4">
              <StatTile
                value={caSummary?.avg_resolution_hours != null ? Number(caSummary.avg_resolution_hours.toFixed(1)) : null}
                label="Avg Resolution"
                description={caSummary?.avg_resolution_hours != null ? 'hrs' : undefined}
              />
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Department Comparison</h3>
                <p className="text-xs text-mute">Click a bar to see employees</p>
              </div>
              <ChartFrame
                state={loadError ? 'error' : isLoading ? 'loading' : deptComparison.length === 0 ? (hasActiveFilters ? 'filtered-empty' : 'zero') : 'ready'}
                minHeight="220px"
                zeroMessage={{
                  title: 'No department data',
                  description: 'Department comparisons will appear here once data is available.',
                }}
                filteredEmptyMessage={{
                  title: 'No matching data',
                  description: 'No department data matches the active filters for this period. Try clearing a filter.',
                }}
                errorMessage={{
                  title: "Couldn't load",
                  description: 'Something went wrong loading this chart. Try again.',
                  action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                }}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={deptComparison.map((d) => ({ name: d.department ?? '—', dept: d.department ?? '—', score: Math.round((d.avg_score ?? 0) * 100) }))} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: 'var(--mute)', fontSize: 10 }} />
                    <Bar dataKey="score" fill="var(--mute)" radius={[0, 4, 4, 0]} barSize={20} onClick={(_data) => { const payload = (_data as { payload?: { dept?: string } }).payload; if (payload?.dept) handleDeptBarClick(payload.dept); }} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Branch Comparison</h3>
                <p className="text-xs text-mute">Click a bar to see employees</p>
              </div>
              <ChartFrame
                state={loadError ? 'error' : isLoading ? 'loading' : branchComparison.length === 0 ? (hasActiveFilters ? 'filtered-empty' : 'zero') : 'ready'}
                minHeight="220px"
                zeroMessage={{
                  title: 'No branch data',
                  description: 'Branch comparisons will appear here once data is available.',
                }}
                filteredEmptyMessage={{
                  title: 'No matching data',
                  description: 'No branch data matches the active filters for this period. Try clearing a filter.',
                }}
                errorMessage={{
                  title: "Couldn't load",
                  description: 'Something went wrong loading this chart. Try again.',
                  action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                }}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={branchComparison.map((b) => ({ name: b.branch ?? '—', branch: b.branch ?? '—', score: Math.round((b.avg_score ?? 0) * 100) }))} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: 'var(--mute)', fontSize: 10 }} />
                    <Bar dataKey="score" fill="var(--mute)" radius={[0, 4, 4, 0]} barSize={20} onClick={(_data) => { const payload = (_data as { payload?: { branch?: string } }).payload; if (payload?.branch) handleBranchBarClick(payload.branch); }} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-slab border-rule">
              <CardHeader>
                <CardTitle className="text-sm text-text">Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {performers.top.map((p) => (
                    <StatusStrokeCard
                      key={p.employee}
                      status="pass"
                      className="flex items-center justify-between cursor-pointer hover:bg-slab-2/50"
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
                    </StatusStrokeCard>
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
                    <StatusStrokeCard
                      key={p.employee}
                      status="fail"
                      className="flex items-center justify-between cursor-pointer hover:bg-slab-2/50"
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
                    </StatusStrokeCard>
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
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Template Performance</h3>
                <p className="text-xs text-mute">Avg completion rate by SOP</p>
              </div>
              <ChartFrame
                state={loadError ? 'error' : isLoading ? 'loading' : templatePerf.length === 0 ? (hasActiveFilters ? 'filtered-empty' : 'zero') : 'ready'}
                minHeight="220px"
                zeroMessage={{
                  title: 'No template data',
                  description: 'Template performance metrics will appear here once data is available.',
                }}
                filteredEmptyMessage={{
                  title: 'No matching data',
                  description: 'No template data matches the active filters for this period. Try clearing a filter.',
                }}
                errorMessage={{
                  title: "Couldn't load",
                  description: 'Something went wrong loading this chart. Try again.',
                  action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                }}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={templatePerf.map((t) => ({ name: t.title?.slice(0, 15) ?? t.template, pct: Math.round(t.avg_completion * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--mute)', fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'var(--mute)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Bar dataKey="pct" fill="var(--mute)" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Day of Week</h3>
                <p className="text-xs text-mute">Completion rate by weekday</p>
              </div>
              <ChartFrame
                state={loadError ? 'error' : isLoading ? 'loading' : dayHeatmap.length === 0 ? (hasActiveFilters ? 'filtered-empty' : 'zero') : 'ready'}
                minHeight="220px"
                zeroMessage={{
                  title: 'Not enough data for this period',
                  description: 'Day-of-week completion rates will appear once checklists have been completed across multiple days.',
                }}
                filteredEmptyMessage={{
                  title: 'No matching data',
                  description: 'No day-of-week data matches the active filters for this period. Try clearing a filter.',
                }}
                errorMessage={{
                  title: "Couldn't load",
                  description: 'Something went wrong loading this chart. Try again.',
                  action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                }}
              >
                <div className="flex gap-2 flex-wrap justify-center items-center py-8">
                  {dayHeatmap.map((d) => {
                    const rate = d.avg_rate;
                    const intensity = DAY_INTENSITY_CLASS[scoreStatus(rate * 100)];
                    return (
                      <div key={d.day_num} className="flex flex-col items-center gap-1">
                        <div className={cn('w-10 h-8 rounded-[var(--radius)] flex items-center justify-center text-[10px] font-bold font-mono text-text', intensity)} style={{ opacity: 0.5 + rate * 0.5 }}>
                          {Math.round(rate * 100)}%
                        </div>
                        <span className="text-[10px] text-mute">{d.day_name?.slice(0, 2)}</span>
                      </div>
                    );
                  })}
                </div>
              </ChartFrame>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Score Distribution</h3>
              </div>
              <ChartFrame
                state={loadError ? 'error' : isLoading ? 'loading' : scoreDist.length === 0 ? (hasActiveFilters ? 'filtered-empty' : 'zero') : 'ready'}
                minHeight="220px"
                zeroMessage={{
                  title: 'No score distribution data',
                  description: 'Score distribution will appear once employees complete runs in this period.',
                }}
                filteredEmptyMessage={{
                  title: 'No matching data',
                  description: 'No score distribution matches the active filters for this period. Try clearing a filter.',
                }}
                errorMessage={{
                  title: "Couldn't load",
                  description: 'Something went wrong loading this chart. Try again.',
                  action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                }}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreDist.map((s) => ({ name: s.bracket, count: s.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--mute)', fontSize: 9 }} />
                    <YAxis tick={{ fill: 'var(--mute)', fontSize: 10 }} />
                    <Bar dataKey="count" fill="var(--mute)" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Corrective Actions</h3>
              </div>
              <ChartFrame
                state={loadError ? 'error' : isLoading ? 'loading' : (caSummary?.by_status ?? []).length === 0 ? (hasActiveFilters ? 'filtered-empty' : 'zero') : 'ready'}
                minHeight="220px"
                zeroMessage={{
                  title: 'No corrective actions',
                  description: 'Corrective actions will appear once they are created.',
                }}
                filteredEmptyMessage={{
                  title: 'No matching data',
                  description: 'No corrective actions match the active filters for this period. Try clearing a filter.',
                }}
                errorMessage={{
                  title: "Couldn't load",
                  description: 'Something went wrong loading this chart. Try again.',
                  action: <Button variant="outline" size="sm" onClick={retryLoad}>Retry</Button>,
                }}
              >
                <ResponsiveContainer width="100%" height={200}>
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
              </ChartFrame>
            </div>
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
    </PageShell>
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
