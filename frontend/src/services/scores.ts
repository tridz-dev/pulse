import { call } from '@/lib/frappe-sdk';
import type { ScoreSnapshot, User } from '@/types';

export interface TeamScoreItem extends ScoreSnapshot {
  user: User;
}

/** Same as TeamScoreItem with department and reportsToName for All Teams view. */
export interface AllTeamScoreItem extends TeamScoreItem {
  department?: string | null;
  reports_to_name?: string | null;
}

export async function getScoreForUser(
  employee: string,
  date: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<ScoreSnapshot> {
  const res = await call.get('pulse.api.scores.get_score_for_user', {
    employee,
    date,
    period_type: periodType,
  });
  return res.message as ScoreSnapshot;
}

export async function getTeamScores(
  managerEmployee: string,
  date: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<TeamScoreItem[]> {
  const res = await call.get('pulse.api.scores.get_team_scores', {
    manager_employee: managerEmployee,
    date,
    period_type: periodType,
  });
  return (res.message as TeamScoreItem[]) ?? [];
}

export async function getAllTeamScores(
  employee: string,
  date: string,
  periodType: 'Day' | 'Week' | 'Month' = 'Day'
): Promise<AllTeamScoreItem[]> {
  const res = await call.get('pulse.api.scores.get_all_team_scores', {
    employee,
    date,
    period_type: periodType,
  });
  return (res.message as AllTeamScoreItem[]) ?? [];
}

export interface FailureAnalyticsItem {
  id: string;
  taskName: string;
  templateName: string;
  misses: number;
}

export async function getFailureAnalytics(
  managerEmployee: string,
  date: string
): Promise<{ mostMissedTasks: FailureAnalyticsItem[] }> {
  const res = await call.get('pulse.api.scores.get_failure_analytics', {
    manager_employee: managerEmployee,
    date,
  });
  return res.message as { mostMissedTasks: FailureAnalyticsItem[] };
}
