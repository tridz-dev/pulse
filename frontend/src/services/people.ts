import { call } from '@/lib/frappe-sdk';

export interface UnlinkedUser {
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
}

export interface PulseDepartment {
  name: string;
  department_name: string;
  description?: string | null;
  is_active: 0 | 1;
}

export interface PulseEmployee {
  name: string;
  employee_name: string;
  user: string;
  pulse_role: string;
  branch?: string | null;
  department?: string | null;
  reports_to?: string | null;
  is_active: 0 | 1;
  avatar_url?: string | null;
}

export interface CreateEmployeeInput {
  employee_name: string;
  user: string;
  pulse_role: string;
  branch?: string;
  department?: string;
  reports_to?: string;
}

/** Pulse Admin only: users not yet linked to an active Pulse Employee. */
export async function listUnlinkedUsers(): Promise<UnlinkedUser[]> {
  const res = await call.get('pulse.api.people.list_unlinked_users');
  return (res.message as UnlinkedUser[]) ?? [];
}

export async function listDepartments(): Promise<PulseDepartment[]> {
  const res = await call.get('pulse.api.people.list_departments');
  return (res.message as PulseDepartment[]) ?? [];
}

/** Pulse Admin only. */
export async function createDepartment(
  departmentName: string,
  description?: string
): Promise<PulseDepartment> {
  const res = await call.post('pulse.api.people.create_department', {
    department_name: departmentName,
    description,
  });
  return res.message as PulseDepartment;
}

/** Pulse Admin only; throws frappe.ValidationError on self-report/cycle/duplicate-user. */
export async function createEmployee(input: CreateEmployeeInput): Promise<PulseEmployee> {
  const res = await call.post('pulse.api.people.create_employee', {
    employee_name: input.employee_name,
    user: input.user,
    pulse_role: input.pulse_role,
    branch: input.branch,
    department: input.department,
    reports_to: input.reports_to,
  });
  return res.message as PulseEmployee;
}

/** Pulse Admin only; throws frappe.ValidationError on self-report/cycle/duplicate-user. */
export async function updateEmployee(
  name: string,
  fields: Partial<CreateEmployeeInput>
): Promise<PulseEmployee> {
  const res = await call.post('pulse.api.people.update_employee', {
    name,
    ...fields,
  });
  return res.message as PulseEmployee;
}

/** Pulse Admin only; deactivates without deleting. */
export async function deactivateEmployee(name: string): Promise<PulseEmployee> {
  const res = await call.post('pulse.api.people.deactivate_employee', { name });
  return res.message as PulseEmployee;
}

/** Scope-limited read: employees visible to the current user. */
export async function listEmployees(): Promise<PulseEmployee[]> {
  const res = await call.get('pulse.api.people.list_employees');
  return (res.message as PulseEmployee[]) ?? [];
}
