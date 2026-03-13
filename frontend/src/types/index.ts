/** Pulse types aligned with Frappe DocType field names (snake_case). */

/** Business role name (PM Role link, e.g. Operator, Supervisor). Used for display. */
export type PMRoleName = string;

/** System role (Frappe Role) used for permission checks. */
export type SystemRole = 'Pulse User' | 'Pulse Manager' | 'Pulse Leader' | 'Pulse Executive' | 'Pulse Admin';

export interface PMEmployee {
  name: string;
  employee_name: string;
  user: string;
  pulse_role: string;
  system_role?: SystemRole;
  role_alias?: string;
  branch?: string;
  department?: string;
  reports_to?: string;
  is_active: boolean;
  avatar_url?: string;
}

/** User-like shape for UI (id = employee name). role = display alias; systemRole = permission check. */
export interface User {
  id: string;
  name: string;
  role: string;
  systemRole?: SystemRole;
  roleAlias?: string;
  avatarUrl?: string;
  branch?: string;
  reportsToId?: string | null;
}

export interface SOPTemplate {
  name: string;
  title: string;
  department?: string;
  frequency_type: 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  owner_role?: string;
  active_from: string;
  active_to?: string;
  is_active: boolean;
  checklist_items?: SOPChecklistItem[];
}

export interface SOPChecklistItem {
  name?: string;
  description: string;
  sequence: number;
  weight: number;
  item_type: 'Checkbox' | 'Numeric' | 'Photo';
  evidence_required?: 'None' | 'Photo';
}

export interface SOPRun {
  name: string;
  template: string;
  employee: string;
  period_date: string;
  status: 'Open' | 'Closed' | 'Locked';
  total_items?: number;
  completed_items?: number;
  progress?: number;
  closed_at?: string;
}

export interface SOPRunItem {
  name: string;
  checklist_item: string;
  weight: number;
  item_type: string;
  status: 'Pending' | 'Completed' | 'Missed';
  completed_at?: string;
  numeric_value?: number;
  notes?: string;
  evidence?: string;
  evidence_required?: string;
  template_item?: { description: string; weight: number; item_type: string; sequence?: number };
}

export interface ScoreSnapshot {
  employee: string;
  userId?: string;
  period: string;
  own_score: number;
  team_score: number;
  combined_score: number;
  total_items: number;
  completed_items: number;
  totalGeneratedItems?: number;
  completedItems?: number;
}

export interface CorrectiveAction {
  name: string;
  run: string;
  run_item_ref?: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assigned_to: string;
  raised_by?: string;
  priority?: string;
  resolution?: string;
  resolved_at?: string;
}

export interface RunItemDetail {
  runItemId: string;
  runId: string;
  checklistItemId: string;
  description: string;
  weight: number;
  status: 'Pending' | 'Completed' | 'Missed';
  completedAt?: string;
}

export interface RunInstanceBreakdown {
  runId: string;
  templateId: string;
  templateTitle: string;
  department?: string;
  frequencyType: string;
  periodDate: string;
  runStatus: string;
  items: RunItemDetail[];
  totalItems: number;
  completedItems: number;
  missedItems: number;
  pendingItems: number;
  progress: number;
}

export interface TemplateBreakdownGroup {
  templateId: string;
  templateTitle: string;
  department?: string;
  frequencyType: string;
  runs: RunInstanceBreakdown[];
  totalItems: number;
  completedItems: number;
  missedItems: number;
}

export interface UserRunBreakdown {
  user: User;
  periodLabel: string;
  templateGroups: TemplateBreakdownGroup[];
  totalItems: number;
  completedItems: number;
  missedItems: number;
  overallCompletion: number;
}

export interface HierarchyBreakdownNode {
  user: User;
  breakdown: UserRunBreakdown;
  score: ScoreSnapshot;
  children: HierarchyBreakdownNode[];
}
