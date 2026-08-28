import { useMemo, useState } from 'react';

import type { PeriodScope, PeriodType } from '@/lib/period-scope';

export interface UsePeriodScopeOptions {
  /** Default period type on first render. Defaults to 'Day'. */
  initialPeriodType?: PeriodType;
  /** Whether this page needs the Custom+date-range picker (Insights only, today). */
  allowCustom?: boolean;
}

export interface UsePeriodScopeResult extends PeriodScope {
  setPeriodType: (p: PeriodType) => void;
  /** Only meaningful when allowCustom; sets an explicit custom range and
   *  flips periodType to 'Custom' as a side effect. */
  setCustomRange: (r: { start: string; end: string; preset?: string }) => void;
  /** A date inside the immediately preceding period, same rules as today's
   *  Dashboard-only getPreviousPeriodDateISO — exposed generally so any page
   *  can build a trend comparison without re-deriving it. */
  previousRefDate: string;
  /** periodType downgraded Custom -> Day, for the `(date, period_type)` callers
   *  that have no concept of Custom (getComplianceScore, getTeamScores,
   *  getOperationsOverview, getDepartmentComparison, etc. — see §2.4 of the
   *  scoping doc). Range-based `(start_date, end_date)` callers should keep
   *  using `periodType`/`range` as-is and never need this field. */
  legacyPeriodType: 'Day' | 'Week' | 'Month';
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Canonical period-range derivation, copied verbatim (non-mutating `today`
 * style) from Operations.tsx's current getPeriodRange — see period-scope.ts
 * for the backend-agreement check and the known toISOString timezone caveat
 * inherited unchanged from that implementation.
 */
function getPeriodRange(periodType: 'Day' | 'Week' | 'Month'): { start: string; end: string } {
  const today = new Date();
  const formatStr = (d: Date) => d.toISOString().slice(0, 10);

  if (periodType === 'Day') {
    const s = formatStr(today);
    return { start: s, end: s };
  }
  if (periodType === 'Week') {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(today);
    start.setDate(diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatStr(start), end: formatStr(end) };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: formatStr(start), end: formatStr(end) };
}

/**
 * Generalized version of Dashboard.tsx's current getPreviousPeriodDateISO:
 * Day -> -1 day, Week -> -7 days, Month -> -1 month.
 */
function getPreviousPeriodDateISO(periodType: 'Day' | 'Week' | 'Month'): string {
  const d = new Date();
  if (periodType === 'Day') d.setDate(d.getDate() - 1);
  else if (periodType === 'Week') d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export function usePeriodScope(opts?: UsePeriodScopeOptions): UsePeriodScopeResult {
  const allowCustom = opts?.allowCustom ?? false;
  const [periodType, setPeriodType] = useState<PeriodType>(opts?.initialPeriodType ?? 'Day');
  const [customRange, setCustomRangeState] = useState<
    { start: string; end: string; preset?: string } | undefined
  >(undefined);

  const legacyPeriodType: 'Day' | 'Week' | 'Month' = periodType === 'Custom' ? 'Day' : periodType;

  const range = useMemo(() => {
    if (periodType === 'Custom' && allowCustom && customRange) {
      return { start: customRange.start, end: customRange.end };
    }
    return getPeriodRange(legacyPeriodType);
  }, [periodType, allowCustom, customRange, legacyPeriodType]);

  const refDate = useMemo(() => {
    if (periodType === 'Custom' && allowCustom && customRange) {
      return customRange.end;
    }
    return todayISO();
  }, [periodType, allowCustom, customRange]);

  const previousRefDate = useMemo(() => getPreviousPeriodDateISO(legacyPeriodType), [legacyPeriodType]);

  const setCustomRange = (r: { start: string; end: string; preset?: string }) => {
    setCustomRangeState(r);
    setPeriodType('Custom');
  };

  return {
    periodType,
    refDate,
    range,
    customRange: periodType === 'Custom' ? customRange : undefined,
    setPeriodType,
    setCustomRange,
    previousRefDate,
    legacyPeriodType,
  };
}
