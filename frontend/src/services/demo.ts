import { call } from '@/lib/frappe-sdk';

export interface DemoStatus {
  can_load_demo: boolean;
  can_clear_demo: boolean;
  has_demo_data: boolean;
}

export async function getDemoStatus(): Promise<DemoStatus> {
  const res = await call.get('pulse.api.demo.get_demo_status');
  return (res.message as DemoStatus) ?? { can_load_demo: false, can_clear_demo: false, has_demo_data: false };
}

export async function installDemoData(enqueue = true): Promise<{ ok: boolean; message?: string }> {
  const res = await call.post('pulse.api.demo.install_demo_data', { enqueue });
  return (res.message as { ok: boolean; message?: string }) ?? { ok: false };
}

export async function clearDemoData(): Promise<{ ok: boolean; message?: string }> {
  const res = await call.post('pulse.api.demo.clear_demo_data');
  return (res.message as { ok: boolean; message?: string }) ?? { ok: false };
}
