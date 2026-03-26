import { call } from '@/lib/frappe-sdk';

export type HomeSummary = {
  open_runs: number;
  overdue_runs: number;
  team_open: number;
};

export async function getHomeSummary(): Promise<HomeSummary> {
  const res = await call.get('pulse.api.go.get_home_summary', {});
  return (res.message as HomeSummary) ?? { open_runs: 0, overdue_runs: 0, team_open: 0 };
}
