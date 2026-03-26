/** Pulse types aligned with Frappe DocType field names (snake_case). */

export type ScheduleKind = 'CalendarDay' | 'TimeOfDay' | 'Interval';
export type OutcomeMode = 'SimpleCompletion' | 'PassFail' | 'Numeric' | 'PhotoProof';
export type ProofRequirement = 'None' | 'Optional' | 'Required';
export type ProofCaptureMode = 'Any' | 'CameraOnly';
export type ItemOutcome = 'Pass' | 'Fail' | 'NotApplicable';


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
  schedule_kind?: ScheduleKind;
  schedule_time?: string | null;
  schedule_days_of_week?: string;
  interval_minutes?: number;
  open_run_policy?: "AllowMultiple" | "RequirePreviousClosed";
  grace_minutes?: number;
  owner_role?: string;
  active_from: string;
  active_to?: string;
  is_active: boolean;
  checklist_items?: SOPChecklistItem[];
}

export interface SOPChecklistItem {
  name?: string;
  item_key?: string;
  description: string;
  sequence: number;
  weight: number;
  item_type: 'Checkbox' | 'Numeric' | 'Photo';
  evidence_required?: 'None' | 'Photo';
  instructions?: string;
  outcome_mode?: OutcomeMode;
  proof_requirement?: ProofRequirement;
  proof_media_type?: 'Image' | 'File' | 'Any';
  proof_capture_mode?: ProofCaptureMode;
  prerequisite_item_key?: string;
  prerequisite_trigger?: 'None' | 'AnyOutcome' | 'OutcomeFail' | 'OutcomePass';
}

export interface SOPRun {
  name: string;
  template: string;
  employee: string;
  period_date: string;
  period_datetime?: string | null;
  status: 'Open' | 'Closed' | 'Locked';
  total_items?: number;
  completed_items?: number;
  passed_items?: number;
  failed_items?: number;
  missed_items?: number;
  progress?: number;
  score?: number;
  closed_at?: string;
}

export interface SOPRunItem {
  name: string;
  checklist_item: string;
  item_key?: string;
  instructions?: string;
  weight: number;
  item_type: string;
  outcome_mode?: OutcomeMode;
  status: 'Pending' | 'Completed' | 'Missed' | 'NotApplicable';
  outcome?: '' | ItemOutcome | 'NotApplicable';
  failure_remark?: string;
  completed_at?: string;
  numeric_value?: number;
  notes?: string;
  evidence?: string;
  evidence_required?: string;
  proof_requirement?: ProofRequirement;
  proof_media_type?: 'Image' | 'File' | 'Any';
  proof_capture_mode?: ProofCaptureMode;
  proof_captured_at?: string;
  prerequisite_item_key?: string;
  prerequisite_trigger?: 'None' | 'AnyOutcome' | 'OutcomeFail' | 'OutcomePass';
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
  passed_items?: number;
  failed_items?: number;
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

