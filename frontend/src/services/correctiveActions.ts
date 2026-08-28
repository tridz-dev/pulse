import { call } from '@/lib/frappe-sdk';

export interface CorrectiveActionListItem {
  name: string;
  run: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority?: string;
  assignedTo: string;
  assignedToName: string | null;
  raisedBy: string;
  raisedByName: string | null;
  resolvedAt: string | null;
}

export interface CorrectiveActionListResponse {
  items: CorrectiveActionListItem[];
  page: number;
  page_size: number;
  total: number;
}

export interface CorrectiveActionUpdateResponse {
  name: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  assignedTo: string;
  waiveReason?: string | null;
  deferUntil?: string | null;
}

export interface EscalateCorrectiveActionResponse {
  name: string;
  assignedTo: string;
  assignedToName: string | null;
  escalated: boolean;
}

export async function listCorrectiveActions(
  status?: string,
  assignedTo?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<CorrectiveActionListResponse> {
  const res = await call.get('pulse.api.corrective_actions.list_corrective_actions', {
    status: status || undefined,
    assigned_to: assignedTo || undefined,
    page,
    page_size: pageSize,
  });
  return res.message as CorrectiveActionListResponse;
}

export async function updateCorrectiveAction(
  name: string,
  updates: {
    status?: string;
    resolution?: string;
    assigned_to?: string;
    waive_reason?: string;
    defer_until?: string;
  }
): Promise<CorrectiveActionUpdateResponse> {
  const res = await call.post('pulse.api.corrective_actions.update_corrective_action', {
    name,
    status: updates.status,
    resolution: updates.resolution,
    assigned_to: updates.assigned_to,
    waive_reason: updates.waive_reason,
    defer_until: updates.defer_until,
  });
  return res.message as CorrectiveActionUpdateResponse;
}

export async function escalateCorrectiveAction(
  runName: string,
  existingCa?: string
): Promise<EscalateCorrectiveActionResponse> {
  const res = await call.post('pulse.api.corrective_actions.escalate_corrective_action', {
    run_name: runName,
    existing_ca: existingCa,
  });
  return res.message as EscalateCorrectiveActionResponse;
}

export async function createCorrectiveActionForRun(
  runName: string,
  description: string,
  priority?: string,
  assignedTo?: string
): Promise<string> {
  const res = await call.post('pulse.api.operations.create_corrective_action_for_run', {
    run_name: runName,
    description,
    priority: priority || 'Medium',
    assigned_to: assignedTo,
  });
  return res.message as string;
}
