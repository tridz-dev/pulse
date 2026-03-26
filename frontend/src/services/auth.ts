import { call } from '@/lib/frappe-sdk';
import type { PMEmployee, User } from '@/types';

export type AuthResult =
  | { user: User; error: null }
  | { user: null; error: string };

/** Get current logged-in user's Pulse Employee record (or synthetic admin profile). */
export async function getCurrentEmployee(): Promise<AuthResult> {
  try {
    const res = await call.get('pulse.api.auth.get_current_employee');
    const emp = res.message as PMEmployee | undefined;
    if (!emp) return { user: null, error: 'No employee data returned.' };
    const roleDisplay = emp.role_alias ?? emp.pulse_role ?? '';
    return {
      user: {
        id: emp.name,
        name: emp.employee_name,
        role: roleDisplay,
        systemRole: (emp.system_role as User['systemRole']) ?? 'Pulse User',
        roleAlias: emp.role_alias,
        avatarUrl: emp.avatar_url,
        branch: emp.branch,
        reportsToId: emp.reports_to ?? null,
      },
      error: null,
    };
  } catch (e: unknown) {
    const msg =
      (e as { message?: string })?.message ??
      'Unable to load your Pulse profile.';
    return { user: null, error: msg };
  }
}
