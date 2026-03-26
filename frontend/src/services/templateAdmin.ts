import { call } from '@/lib/frappe-sdk';
import type { SOPTemplate, SOPChecklistItem } from '@/types';

export type TemplateSchema = {
  frequency_types: string[];
  schedule_kinds: string[];
  item_types: string[];
  outcome_modes: string[];
  proof_requirements: string[];
  proof_media_types: string[];
  proof_capture_modes: string[];
  prerequisite_triggers: string[];
  open_run_policies: string[];
  departments: string[];
  owner_roles: { role_name: string; alias: string }[];
};

export type TemplateDetail = SOPTemplate & {
  active_from?: string | null;
  active_to?: string | null;
  schedule_kind?: string;
  schedule_time?: string | null;
  schedule_days_of_week?: string;
  interval_minutes?: number;
  open_run_policy?: string;
  grace_minutes?: number;
  checklist_items: SOPChecklistItem[];
};

export type CreateTemplateInput = {
  title: string;
  department?: string;
  frequency_type: string;
  owner_role?: string;
  active_from?: string | null;
  active_to?: string | null;
  is_active?: boolean;
  schedule_kind?: string;
  schedule_time?: string | null;
  schedule_days_of_week?: string;
  interval_minutes?: number;
  open_run_policy?: string;
  grace_minutes?: number;
  checklist_items: Partial<SOPChecklistItem>[];
};

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export async function getTemplateSchema(): Promise<TemplateSchema> {
  const res = await call.get('pulse.api.templates.get_template_schema');
  return res.message as TemplateSchema;
}

export async function getTemplateDetail(templateName: string): Promise<TemplateDetail> {
  const res = await call.get('pulse.api.templates.get_template_detail', {
    template_name: templateName,
  });
  return res.message as TemplateDetail;
}

export async function getAllTemplatesWithInactive(): Promise<Partial<SOPTemplate>[]> {
  const res = await call.get('pulse.api.templates.get_all_templates_with_inactive');
  return (res.message as Partial<SOPTemplate>[]) ?? [];
}

export async function createTemplate(input: CreateTemplateInput): Promise<{ success: boolean; name: string; message: string }> {
  const res = await call.post('pulse.api.templates.create_template', {
    values: input,
  });
  return res.message as { success: boolean; name: string; message: string };
}

export async function updateTemplate(templateName: string, input: UpdateTemplateInput): Promise<{ success: boolean; name: string; message: string }> {
  const res = await call.post('pulse.api.templates.update_template', {
    template_name: templateName,
    values: input,
  });
  return res.message as { success: boolean; name: string; message: string };
}

export async function deleteTemplate(templateName: string): Promise<{ success: boolean; message: string }> {
  const res = await call.post('pulse.api.templates.delete_template', {
    template_name: templateName,
  });
  return res.message as { success: boolean; message: string };
}

export async function duplicateTemplate(templateName: string, newTitle?: string): Promise<{ success: boolean; name: string; message: string }> {
  const res = await call.post('pulse.api.templates.duplicate_template', {
    template_name: templateName,
    new_title: newTitle,
  });
  return res.message as { success: boolean; name: string; message: string };
}
