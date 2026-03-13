import { call } from '@/lib/frappe-sdk';

export interface ScoreTrendPoint {
  date: string;
  avg_score: number;
  employee_count: number;
}

export interface DeptBranchItem {
  department?: string;
  branch?: string;
  avg_score: number;
  headcount: number;
}

export interface PerformerItem {
  employee: string;
  employee_name: string;
  pulse_role: string;
  department?: string;
  branch?: string;
  combined_score: number;
  own_score: number;
  total_items: number;
  completed_items: number;
}

export interface TopBottomPerformers {
  top: PerformerItem[];
  bottom: PerformerItem[];
}

export interface TemplatePerformanceItem {
  template: string;
  title: string;
  department?: string;
  avg_completion: number;
  run_count: number;
}

export interface CompletionTrendPoint {
  date: string;
  completed: number;
  total: number;
  rate: number;
}

export interface CAStatusItem {
  status: string;
  count: number;
}

export interface CAPriorityItem {
  priority: string;
  count: number;
}

export interface CorrectiveActionSummary {
  by_status: CAStatusItem[];
  by_priority: CAPriorityItem[];
  avg_resolution_hours: number | null;
}

export interface DayOfWeekItem {
  day_name: string;
  day_num: number;
  avg_rate: number;
}

export interface ScoreDistributionItem {
  bracket: string;
  count: number;
}

export interface MostMissedItem {
  checklist_item: string;
  template_title: string;
  department: string;
  misses: number;
}

/** Optional filters for insight endpoints (department/branch can be single or multi). */
export interface InsightFilters {
  department?: string | string[];
  branch?: string | string[];
  employee?: string;
}

/** Employee-with-score row from drill-down endpoints (same shape as AllTeamScoreItem). */
export interface FilteredEmployeeScore {
  employee: string;
  userId: string;
  user: { name: string; id: string; role: string; branch?: string; avatarUrl?: string };
  department?: string;
  reports_to_name?: string;
  combined_score: number;
  own_score: number;
  team_score: number;
  total_items: number;
  completed_items: number;
}

function filtersParams(f?: InsightFilters): Record<string, unknown> {
  if (!f) return {};
  const p: Record<string, unknown> = {};
  if (f.department != null) p.department = Array.isArray(f.department) ? f.department : f.department;
  if (f.branch != null) p.branch = Array.isArray(f.branch) ? f.branch : f.branch;
  if (f.employee != null) p.employee = f.employee;
  return p;
}

export async function getScoreTrends(
  startDate?: string,
  endDate?: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day',
  filters?: InsightFilters
): Promise<ScoreTrendPoint[]> {
  const res = await call.get('pulse.api.insights.get_score_trends', {
    start_date: startDate,
    end_date: endDate,
    period_type: periodType,
    ...filtersParams(filters),
  });
  return (res.message as ScoreTrendPoint[]) ?? [];
}

export async function getDepartmentComparison(
  date?: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day',
  filters?: InsightFilters
): Promise<DeptBranchItem[]> {
  const res = await call.get('pulse.api.insights.get_department_comparison', {
    date,
    period_type: periodType,
    ...filtersParams(filters),
  });
  return (res.message as DeptBranchItem[]) ?? [];
}

export async function getBranchComparison(
  date?: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day',
  filters?: InsightFilters
): Promise<DeptBranchItem[]> {
  const res = await call.get('pulse.api.insights.get_branch_comparison', {
    date,
    period_type: periodType,
    ...filtersParams(filters),
  });
  return (res.message as DeptBranchItem[]) ?? [];
}

export async function getTopBottomPerformers(
  date?: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day',
  limit = 5,
  filters?: InsightFilters
): Promise<TopBottomPerformers> {
  const res = await call.get('pulse.api.insights.get_top_bottom_performers', {
    date,
    period_type: periodType,
    limit,
    ...filtersParams(filters),
  });
  return (res.message as TopBottomPerformers) ?? { top: [], bottom: [] };
}

export async function getTemplatePerformance(
  startDate?: string,
  endDate?: string,
  filters?: InsightFilters
): Promise<TemplatePerformanceItem[]> {
  const res = await call.get('pulse.api.insights.get_template_performance', {
    start_date: startDate,
    end_date: endDate,
    ...filtersParams(filters),
  });
  return (res.message as TemplatePerformanceItem[]) ?? [];
}

export async function getCompletionTrend(
  startDate?: string,
  endDate?: string,
  filters?: InsightFilters
): Promise<CompletionTrendPoint[]> {
  const res = await call.get('pulse.api.insights.get_completion_trend', {
    start_date: startDate,
    end_date: endDate,
    ...filtersParams(filters),
  });
  return (res.message as CompletionTrendPoint[]) ?? [];
}

export async function getCorrectiveActionSummary(
  filters?: InsightFilters
): Promise<CorrectiveActionSummary> {
  const res = await call.get('pulse.api.insights.get_corrective_action_summary', {
    ...filtersParams(filters),
  });
  return (res.message as CorrectiveActionSummary) ?? {
    by_status: [],
    by_priority: [],
    avg_resolution_hours: null,
  };
}

export async function getDayOfWeekHeatmap(
  startDate?: string,
  endDate?: string,
  filters?: InsightFilters
): Promise<DayOfWeekItem[]> {
  const res = await call.get('pulse.api.insights.get_day_of_week_heatmap', {
    start_date: startDate,
    end_date: endDate,
    ...filtersParams(filters),
  });
  return (res.message as DayOfWeekItem[]) ?? [];
}

export async function getScoreDistribution(
  date?: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day',
  filters?: InsightFilters
): Promise<ScoreDistributionItem[]> {
  const res = await call.get('pulse.api.insights.get_score_distribution', {
    date,
    period_type: periodType,
    ...filtersParams(filters),
  });
  return (res.message as ScoreDistributionItem[]) ?? [];
}

export async function getMostMissedItems(
  startDate?: string,
  endDate?: string,
  limit = 10,
  filters?: InsightFilters
): Promise<MostMissedItem[]> {
  const res = await call.get('pulse.api.insights.get_most_missed_items', {
    start_date: startDate,
    end_date: endDate,
    limit,
    ...filtersParams(filters),
  });
  return (res.message as MostMissedItem[]) ?? [];
}

export async function getEmployeesByDepartment(
  department: string,
  date?: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<FilteredEmployeeScore[]> {
  const res = await call.get('pulse.api.insights.get_employees_by_department', {
    department,
    date,
    period_type: periodType,
  });
  return (res.message as FilteredEmployeeScore[]) ?? [];
}

export async function getEmployeesByBranch(
  branch: string,
  date?: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<FilteredEmployeeScore[]> {
  const res = await call.get('pulse.api.insights.get_employees_by_branch', {
    branch,
    date,
    period_type: periodType,
  });
  return (res.message as FilteredEmployeeScore[]) ?? [];
}

export async function getInsightDepartments(): Promise<string[]> {
  const res = await call.get('pulse.api.insights.get_insight_departments', {});
  return (res.message as string[]) ?? [];
}

export async function getInsightBranches(): Promise<string[]> {
  const res = await call.get('pulse.api.insights.get_insight_branches', {});
  return (res.message as string[]) ?? [];
}
