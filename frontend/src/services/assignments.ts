import { call } from '@/lib/frappe-sdk';

export type Assignment = {
  name: string;
  template: string;
  template_title?: string;
  template_department?: string;
  template_frequency?: string;
  template_owner_role?: string;
  employee: string;
  employee_name?: string;
  employee_role?: string;
  employee_branch?: string;
  employee_department?: string;
  is_active: boolean;
  creation?: string;
  run_count?: number;
};

export type AssignmentDetail = Assignment & {
  template_details?: {
    title: string;
    department: string;
    frequency_type: string;
    owner_role: string;
    is_active: boolean;
  };
  employee_details?: {
    employee_name: string;
    pulse_role: string;
    branch: string;
    department: string;
    user: string;
  };
  recent_runs?: {
    name: string;
    period_date: string;
    status: string;
    progress: number;
    score: number;
  }[];
  total_runs?: number;
};

export type AssignmentFilters = {
  template?: string;
  employee?: string;
  is_active?: boolean;
};

export type AssignmentOptions = {
  templates: {
    name: string;
    title: string;
    department: string;
    owner_role: string;
    frequency_type: string;
  }[];
  employees: {
    name: string;
    employee_name: string;
    pulse_role: string;
    branch: string;
    department: string;
  }[];
};

export type BulkAssignmentResult = {
  success: boolean;
  created: string[];
  created_count: number;
  failed: { employee: string; reason: string }[];
  failed_count: number;
  message: string;
};

export async function getAssignments(filters?: AssignmentFilters, limit = 100): Promise<Assignment[]> {
  const res = await call.get('pulse.api.assignments.get_assignments', {
    filters: filters || {},
    limit,
  });
  return (res.message as Assignment[]) ?? [];
}

export async function getAssignmentDetail(assignmentName: string): Promise<AssignmentDetail> {
  const res = await call.get('pulse.api.assignments.get_assignment_detail', {
    assignment_name: assignmentName,
  });
  return res.message as AssignmentDetail;
}

export async function getAssignmentOptions(): Promise<AssignmentOptions> {
  const res = await call.get('pulse.api.assignments.get_assignment_options');
  return res.message as AssignmentOptions;
}

export async function createAssignment(
  template: string,
  employee: string,
  isActive = true
): Promise<{ success: boolean; name: string; message: string }> {
  const res = await call.post('pulse.api.assignments.create_assignment', {
    template,
    employee,
    is_active: isActive,
  });
  return res.message as { success: boolean; name: string; message: string };
}

export async function createBulkAssignments(
  template: string,
  employees: string[],
  isActive = true
): Promise<BulkAssignmentResult> {
  const res = await call.post('pulse.api.assignments.create_bulk_assignments', {
    template,
    employees,
    is_active: isActive,
  });
  return res.message as BulkAssignmentResult;
}

export async function updateAssignment(
  assignmentName: string,
  values: { is_active?: boolean }
): Promise<{ success: boolean; name: string; message: string }> {
  const res = await call.post('pulse.api.assignments.update_assignment', {
    assignment_name: assignmentName,
    values,
  });
  return res.message as { success: boolean; name: string; message: string };
}

export async function deleteAssignment(assignmentName: string): Promise<{ success: boolean; message: string }> {
  const res = await call.post('pulse.api.assignments.delete_assignment', {
    assignment_name: assignmentName,
  });
  return res.message as { success: boolean; message: string };
}

export async function getAssignmentCalendar(
  startDate?: string,
  endDate?: string,
  employee?: string
): Promise<
  {
    name: string;
    template: string;
    template_title: string;
    employee: string;
    employee_name: string;
    period_date: string;
    status: string;
    progress: number;
  }[]
> {
  const res = await call.get('pulse.api.assignments.get_assignment_calendar', {
    start_date: startDate,
    end_date: endDate,
    employee,
  });
  return (res.message as {
    name: string;
    template: string;
    template_title: string;
    employee: string;
    employee_name: string;
    period_date: string;
    status: string;
    progress: number;
  }[]) ?? [];
}
