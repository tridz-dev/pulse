/** Fixed range used by seed/demo data (see pulse seed data.py). */
export const DEMO_DATE_START = '2026-02-10';
export const DEMO_DATE_END = '2026-03-12';

export type DateRangePreset = '7d' | '30d' | '90d' | 'month' | 'demo';

export interface DateRangeValue {
  start: string;
  end: string;
  preset?: DateRangePreset;
}

export function rangeFromPreset(preset: DateRangePreset): DateRangeValue {
  const end = new Date();
  const start = new Date();
  if (preset === 'demo') {
    return { start: DEMO_DATE_START, end: DEMO_DATE_END, preset: 'demo' };
  }
  if (preset === '7d') start.setDate(start.getDate() - 7);
  else if (preset === '30d') start.setDate(start.getDate() - 30);
  else if (preset === '90d') start.setDate(start.getDate() - 90);
  else {
    start.setDate(1);
    start.setMonth(end.getMonth());
    start.setFullYear(end.getFullYear());
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    preset,
  };
}

