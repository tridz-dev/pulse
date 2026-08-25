import { call } from '@/lib/frappe-sdk';
import type { SOPChecklistItem, SOPTemplate } from '@/types';

export interface FullSOPTemplate extends SOPTemplate {
  local_start_time?: string;
  completion_window_minutes?: number;
  schedule_timezone?: string;
}

export async function getAllTemplates(): Promise<Partial<FullSOPTemplate>[]> {
  const res = await call.get('pulse.api.templates.get_all_templates');
  return (res.message as Partial<FullSOPTemplate>[]) ?? [];
}

export async function getTemplateItems(templateName: string): Promise<SOPChecklistItem[]> {
  const res = await call.get('pulse.api.templates.get_template_items', {
    template_name: templateName,
  });
  return (res.message as SOPChecklistItem[]) ?? [];
}

export async function getTemplateDetails(templateName: string): Promise<FullSOPTemplate> {
  const res = await call.get('frappe.client.get', {
    doctype: 'SOP Template',
    name: templateName,
  });
  return res.message as FullSOPTemplate;
}

export interface CreateTemplateInput {
  title: string;
  frequency_type: 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  active_from: string;
  local_start_time: string;
  completion_window_minutes: number;
  schedule_timezone: string;
  department?: string;
  owner_role?: string;
  active_to?: string;
  checklist_items: SOPChecklistItem[];
}

export async function createTemplate(input: CreateTemplateInput): Promise<FullSOPTemplate> {
  const res = await call.post('pulse.api.templates.create_template', {
    ...input,
    checklist_items: JSON.stringify(input.checklist_items),
  });
  return res.message as FullSOPTemplate;
}

export async function updateTemplate(
  name: string,
  fields: Partial<CreateTemplateInput>
): Promise<FullSOPTemplate> {
  const payload = { ...fields };
  if (payload.checklist_items) {
    (payload as any).checklist_items = JSON.stringify(payload.checklist_items);
  }
  const res = await call.post('pulse.api.templates.update_template', {
    name,
    ...payload,
  });
  return res.message as FullSOPTemplate;
}


