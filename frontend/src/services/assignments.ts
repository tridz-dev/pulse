import { call } from '@/lib/frappe-sdk';

export interface SOPAssignment {
  name: string;
  template: string;
  employee: string;
  schedule_timezone_override?: string;
  local_start_time_override?: string;
  completion_window_minutes_override?: number;
  is_active: number;
}

export interface PulseEmployee {
  name: string;
  employee_name: string;
  user?: string;
  pulse_role?: string;
  branch?: string;
  department?: string;
}

export async function listAssignments(): Promise<SOPAssignment[]> {
  const res = await call.get('pulse.api.assignments.list_assignments');
  return (res.message as SOPAssignment[]) ?? [];
}

export async function listEligibleEmployees(): Promise<PulseEmployee[]> {
  const res = await call.get('pulse.api.assignments.list_eligible_employees');
  return (res.message as PulseEmployee[]) ?? [];
}

export interface CreateAssignmentInput {
  template: string;
  employee: string;
  schedule_timezone_override?: string;
  local_start_time_override?: string;
  completion_window_minutes_override?: number;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<SOPAssignment> {
  const res = await call.post('pulse.api.assignments.create_assignment', {
    template: input.template,
    employee: input.employee,
    schedule_timezone_override: input.schedule_timezone_override || undefined,
    local_start_time_override: input.local_start_time_override || undefined,
    completion_window_minutes_override: input.completion_window_minutes_override || undefined,
  });
  return res.message as SOPAssignment;
}

export async function deactivateAssignment(name: string): Promise<SOPAssignment> {
  const res = await call.post('pulse.api.assignments.deactivate_assignment', {
    name,
  });
  return res.message as SOPAssignment;
}
