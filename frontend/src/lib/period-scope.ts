// See docs/execution/scope-c10-shared-period-model.md §2.1 for the full rationale.

export type PeriodType = 'Day' | 'Week' | 'Month' | 'Custom';

/** What a page/hook consumer actually needs to send to any backend call. */
export interface PeriodScope {
  /** The three-or-four-way toggle state, verbatim. */
  periodType: PeriodType;
  /** Single reference date (today, or the end of a custom range) — for
   *  calls that take (date, period_type) and derive their own window server-side. */
  refDate: string; // YYYY-MM-DD
  /** Explicit start/end — for calls that take (start_date, end_date) and need
   *  the frontend to have already resolved the window (e.g. paginated lists,
   *  drilldowns, anything that can't just trust a single ref-date + period_type). */
  range: { start: string; end: string };
  /** Only present when periodType === 'Custom'; the user-picked range that
   *  produced `range` above (kept distinct from `range` so a hook consumer can
   *  tell "this came from a preset/custom picker" apart from "this is the
   *  Day/Week/Month-derived window"). */
  customRange?: { start: string; end: string; preset?: string };
}

/*
 * Backend-vs-frontend derivation check (required before Task 1 could be
 * considered done, per §2.3 / §4 of the scoping doc):
 *
 * Backend's pulse/api/scores.py::_period_range (shared by getComplianceScore,
 * getTeamScores, getAllTeamScores via _calculate_score_snapshot, and by
 * getOperationsOverview/get_user_run_breakdown/get_hierarchy_breakdown in
 * pulse/api/operations.py, which import and reuse this exact function):
 *
 *   Week:  weekday = dt.weekday()  (Python: Monday = 0)
 *          start = dt - timedelta(days=weekday)   -> Monday
 *          end   = start + timedelta(days=6)      -> Sunday
 *   Month: start = get_first_day(dt); end = get_last_day(dt)  -> calendar month
 *
 * This is the same rule as the frontend's canonical Operations.tsx getPeriodRange
 * below (Mon-Sun ISO week via getDay()/(day === 0 ? -6 : 1), calendar-month via
 * new Date(y, m, 1) / new Date(y, m+1, 0)) — CONFIRMED MATCH on week-start
 * convention and month boundaries.
 *
 * Timezone: the backend's _period_range does zero timezone conversion of its
 * own — `dt = getdate(date_str)` parses whatever YYYY-MM-DD string the client
 * sent and treats it as-is. So there is no backend-side timezone assumption to
 * disagree with; the backend simply trusts the frontend's date string.
 *
 * That said, the frontend derivation carries a pre-existing, independent bug
 * worth flagging prominently even though it is not a backend/frontend
 * disagreement: both Dashboard.tsx's and Operations.tsx's existing
 * getPeriodRange/todayISO helpers format dates via `date.toISOString().slice(0,10)`.
 * `toISOString()` returns the UTC calendar date, not the local one, while all of
 * the date *arithmetic* upstream (getDay(), getDate(), setDate(), getFullYear(),
 * getMonth()) operates in the browser's local timezone. For a user whose local
 * offset is such that "now" is a different UTC calendar date than local calendar
 * date (e.g. anywhere east of UTC, in the hours after local midnight but before
 * UTC midnight), refDate/range boundaries sent to the backend can be off by one
 * day from what the user's toggle actually reflects locally. This is inherited
 * unchanged into this canonical derivation per the Task 1 instruction to reuse
 * Operations.tsx's exact logic rather than re-deriving it — it is NOT silently
 * fixed here. It should be tracked as its own follow-up (a local-date formatter
 * instead of toISOString) rather than bundled into this migration.
 */
