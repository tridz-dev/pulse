import { call } from '@/lib/frappe-sdk';
import type { SOPChecklistItem, SOPTemplate } from '@/types';

export async function getAllTemplates(): Promise<Partial<SOPTemplate>[]> {
  const res = await call.get('pulse.api.templates.get_all_templates');
  return (res.message as Partial<SOPTemplate>[]) ?? [];
}

export async function getTemplateItems(templateName: string): Promise<SOPChecklistItem[]> {
  const res = await call.get('pulse.api.templates.get_template_items', {
    template_name: templateName,
  });
  return (res.message as SOPChecklistItem[]) ?? [];
}
