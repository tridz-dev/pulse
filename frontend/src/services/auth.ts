import { call } from '@/lib/frappe-sdk';
import type { PMEmployee, User } from '@/types';

/** Get current logged-in user's PM Employee record. */
export async function getCurrentEmployee(): Promise<User | null> {
  try {
    const res = await call.get('pulse.api.auth.get_current_employee');
    const emp = res.message as PMEmployee | undefined;
    if (!emp) return null;
    const roleDisplay = emp.role_alias ?? emp.pulse_role ?? '';
    return {
      id: emp.name,
      name: emp.employee_name,
      role: roleDisplay,
      systemRole: (emp.system_role as User['systemRole']) ?? 'Pulse User',
      roleAlias: emp.role_alias,
      avatarUrl: emp.avatar_url,
      branch: emp.branch,
      reportsToId: emp.reports_to ?? null,
    };
  } catch {
    return null;
  }
}
