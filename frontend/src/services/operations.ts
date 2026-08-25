import { call } from '@/lib/frappe-sdk';
import type { HierarchyBreakdownNode, UserRunBreakdown, FailureListResponse, ComplianceScoreResponse } from '@/types';

export interface TreeNode {
  user: { id: string; name: string; role: string; systemRole?: string; branch?: string; avatarUrl?: string };
  score: {
    combinedScore: number;
    ownScore: number;
    teamScore: number;
    total_items: number;
    completed_items: number;
    totalGeneratedItems?: number;
    completedItems?: number;
  };
  children: TreeNode[];
}

export async function getOperationsOverview(
  topEmployee: string,
  date: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<TreeNode | null> {
  const res = await call.get('pulse.api.operations.get_operations_overview', {
    top_employee: topEmployee,
    date,
    period_type: periodType,
  });
  const data = res.message as TreeNode | null;
  if (!data) return null;
  // Normalize score shape for UI (camelCase where expected)
  if (data.score && !('combinedScore' in data.score)) {
    const s = data.score as Record<string, number>;
    data.score = {
      ...s,
      combinedScore: s.combined_score ?? s.combinedScore ?? 0,
      ownScore: s.own_score ?? s.ownScore ?? 0,
      teamScore: s.team_score ?? s.teamScore ?? 0,
      total_items: s.total_items ?? 0,
      completed_items: s.completed_items ?? 0,
      totalGeneratedItems: s.total_items,
      completedItems: s.completed_items,
    };
  }
  return data;
}

export async function getUserRunBreakdown(
  employee: string,
  date: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<UserRunBreakdown> {
  const res = await call.get('pulse.api.operations.get_user_run_breakdown', {
    employee,
    date,
    period_type: periodType,
  });
  return res.message as UserRunBreakdown;
}

export async function getHierarchyBreakdown(
  topEmployee: string,
  date: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<HierarchyBreakdownNode | null> {
  const res = await call.get('pulse.api.operations.get_hierarchy_breakdown', {
    top_employee: topEmployee,
    date,
    period_type: periodType,
  });
  return res.message as HierarchyBreakdownNode | null;
}

export async function getFailureList(
  startDate: string,
  endDate: string,
  page: number = 1,
  pageSize: number = 20
): Promise<FailureListResponse> {
  const res = await call.get('pulse.api.operations.get_failure_list', {
    start_date: startDate,
    end_date: endDate,
    page,
    page_size: pageSize,
  });
  return res.message as FailureListResponse;
}

export async function getComplianceScore(
  employee: string,
  scope: 'personal' | 'inherited' = 'personal',
  date?: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<ComplianceScoreResponse> {
  const res = await call.get('pulse.api.scores.get_compliance_score', {
    employee,
    scope,
    date,
    period_type: periodType,
  });
  return res.message as ComplianceScoreResponse;
}


