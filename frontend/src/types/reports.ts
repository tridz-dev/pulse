/** Report Scheduling Types */

export type ReportType = 
  | 'score_trends' 
  | 'department_comparison' 
  | 'branch_comparison' 
  | 'top_performers' 
  | 'completion_trend' 
  | 'ca_summary' 
  | 'outcome_summary';

export type ReportFrequency = 'Daily' | 'Weekly' | 'Monthly';
export type ReportFormat = 'PDF' | 'Excel' | 'CSV';
export type ReportRunStatus = 'Success' | 'Failed' | 'Running' | 'Pending';

export interface ReportTypeInfo {
  id: ReportType;
  label: string;
  description: string;
  function?: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  type: ReportType;
  type_label: string;
  frequency: ReportFrequency;
  last_run: string | null;
  next_run: string | null;
  recipients: string[];
  filters: Record<string, unknown>;
  is_active: boolean;
  format?: ReportFormat;
  start_date?: string;
  end_date?: string;
  day_of_week?: number;
  day_of_month?: number;
  run_time?: string;
}

export interface ReportRunHistory {
  id: string;
  report_id: string;
  report_name: string;
  report_type: ReportType;
  status: ReportRunStatus;
  started_at: string;
  completed_at?: string;
  file_url?: string;
  file_name?: string;
  error_message?: string;
  triggered_by: 'scheduled' | 'manual';
  format: ReportFormat;
}

export interface ScheduleReportConfig {
  report_type: ReportType;
  name: string;
  frequency: ReportFrequency;
  recipients: string[];
  format: ReportFormat;
  filters?: Record<string, unknown>;
  start_date?: string;
  end_date?: string;
  day_of_week?: number;
  day_of_month?: number;
  run_time?: string;
}

export interface ReportTypesResponse {
  types: ReportTypeInfo[];
  frequencies: ReportFrequency[];
}
