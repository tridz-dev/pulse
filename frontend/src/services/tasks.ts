import { call } from '@/lib/frappe-sdk';
import type { SOPRun, SOPRunItem, SOPTemplate } from '@/types';

export interface RunListItem {
  name: string;
  template: string | SOPTemplate;
  employee: string;
  period_date: string;
  status: string;
  total_items?: number;
  completed_items?: number;
  progress: number;
}

export interface RunDetailsResponse {
  run: SOPRun;
  template: SOPTemplate;
  items: (SOPRunItem & { templateItem: SOPChecklistItem })[];
}

interface SOPChecklistItem {
  description: string;
  weight: number;
  item_type: string;
  sequence?: number;
}

export async function getMyRuns(date: string): Promise<RunListItem[]> {
  const res = await call.get('pulse.api.tasks.get_my_runs', { date });
  return (res.message as RunListItem[]) ?? [];
}

/** Get runs for any employee (e.g. for UserProfile drill-down). */
export async function getRunsForEmployee(employee: string, date: string): Promise<RunListItem[]> {
  const res = await call.get('pulse.api.tasks.get_runs_for_employee', {
    employee,
    date,
  });
  return (res.message as RunListItem[]) ?? [];
}

export async function getRunDetails(runName: string): Promise<RunDetailsResponse> {
  const res = await call.get('pulse.api.tasks.get_run_details', { run_name: runName });
  return res.message as RunDetailsResponse;
}

export async function updateRunItem(
  runItemName: string,
  status: string,
  options?: { notes?: string; numeric_value?: number }
): Promise<void> {
  await call.post('pulse.api.tasks.update_run_item', {
    run_item_name: runItemName,
    status,
    notes: options?.notes,
    numeric_value: options?.numeric_value,
  });
}

export async function completeRun(runName: string): Promise<void> {
  await call.post('pulse.api.tasks.complete_run', { run_name: runName });
}
