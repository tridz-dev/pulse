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
  }
): Promise<CorrectiveActionUpdateResponse> {
  const res = await call.post('pulse.api.corrective_actions.update_corrective_action', {
    name,
    status: updates.status,
    resolution: updates.resolution,
    assigned_to: updates.assigned_to,
  });
  return res.message as CorrectiveActionUpdateResponse;
}
