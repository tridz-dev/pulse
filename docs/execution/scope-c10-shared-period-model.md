# C10 Scoping: Shared Period/Scope Model

Status: scoping only, no code changes. Source gap: `docs/execution/product-gap-analysis.md` C10 — "No scope/period model — three pages, three answers."

Read in full for this scoping pass: `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/Operations.tsx`, `frontend/src/pages/Insights.tsx`, `frontend/src/pages/Team.tsx`, `frontend/src/components/shared/period-toggle.tsx`, `frontend/src/components/insights/InsightsFilters.tsx`, and the consuming service files `frontend/src/services/operations.ts`, `scores.ts`, `insights.ts`, `people.ts`.

## 1. Current-state inventory

| Page | Period state shape | Local date-range derivation | Backend calls consuming it | Notes / divergence |
|---|---|---|---|---|
| **Dashboard.tsx** | `useState<'Day'\|'Week'\|'Month'>('Day')`, plus its own `getPeriodRange(periodType)` and `getPreviousPeriodDateISO(periodType)` helpers (lines 55–82) | `getPeriodRange`: Day → `{today,today}`; Week → Mon–Sun of the current week via `getDay()`/`setDate` arithmetic; Month → calendar-month first/last day via `new Date(y,m,1)` / `new Date(y,m+1,0)`. Also has a *second*, independent derivation `getPreviousPeriodDateISO` that just steps a single reference date back by 1 day / 7 days / 1 month (not a range) | `getComplianceScore(employee, scope, date, periodType)` — single ref-date + period_type. `getTeamScores(managerEmployee, date, periodType)` — same shape. `getFailureAnalytics(managerEmployee, date)` — date only, no period_type at all. `getFailureList(start, end, page, pageSize)` — needs the locally-derived `{start,end}` range | Only page with a "previous period" comparison, and its own bespoke logic for it. `getFailureAnalytics` silently ignores period entirely (always effectively "since-date" server-side, or whatever the backend does with `date` alone) — worth flagging as its own gap, not just C10. `getPeriodRange`'s Week branch does `new Date(today.setDate(diff))`, which mutates the local `today` in place before wrapping — works today only because `today` isn't reused afterward, but it's a footgun if someone adds a line above the `return`. |
| **Operations.tsx** | `useState<'Day'\|'Week'\|'Month'>('Day')`, own `getPeriodRange(periodType)` (lines 25–45) | Textually near-identical to Dashboard's Week/Month math, **except** it copies `today` before mutating (`const start = new Date(today); start.setDate(diff)`) instead of mutating `today` itself. Output values are identical to Dashboard's for the same day (same Monday-start ISO week, same calendar month), so no behavioral divergence today — but it is a second, hand-copied implementation of the same rule, exactly the "someone will edit one and not the other" risk C10 describes | `getOperationsOverview(topEmployee, date, periodType)` — ref-date + period_type. `getComplianceScore(...)` — same as Dashboard. `getFailureList(start, end, page, pageSize)` — needs the local range, paginated in a `do/while` loop up to 500 rows | Two backend shapes reconciled by one page: the tree/score endpoints trust the backend's own period_type→range derivation, while `getFailureList` trusts the frontend's derivation. If the backend's internal Week/Month math ever differs from this file's `getPeriodRange` (e.g. different week-start convention, or timezone handling), the failure list and the score/tree above it would silently show different windows on the same page. This can't be fully ruled out without reading the backend, but it is the single highest-value structural gap: **half of "period" is client-derived, half is server-derived, and nothing guarantees they agree.** |
| **Insights.tsx** | `useState<'Day'\|'Week'\|'Month'\|'Custom'>('Day')` **plus** a wholly separate `dateRange: DateRangeValue` state (`{start,end,preset}`) from `frontend/src/components/insights/InsightsFilters.tsx`, defaulted to `rangeFromPreset('90d')` | No page-local `getPeriodRange` at all. Two independent axes instead: (a) `periodType` is passed straight through as a bucketing granularity string to some endpoints; (b) `dateRange` (7d/30d/90d/month/demo presets, computed in `InsightsFilters.tsx`'s `rangeFromPreset`) supplies `start`/`end` to range-based endpoints. A third axis, `refDate = dateRange.end ?? todayISO()`, is derived ad hoc for single-date endpoints, using `legacyPeriodType` (periodType, downgraded to `'Day'` when `'Custom'`) | `getScoreTrends(start, end, periodType, filters)` — full range + period_type together (bucket size over an explicit range). `getTemplatePerformance`, `getCompletionTrend`, `getDayOfWeekHeatmap`, `getMostMissedItems(start, end, ...)` — range only, no period_type. `getDepartmentComparison`, `getBranchComparison`, `getTopBottomPerformers`, `getScoreDistribution`, `getEmployeesByDepartment/Branch(refDate, legacyPeriodType, ...)` — single ref-date + period_type, **not** the selected `dateRange` at all beyond using its `end` as the ref date | **This is the sharpest divergence in the codebase.** On every other page, choosing "Week" changes the actual data window (Mon–Sun of this week). On Insights, choosing "Week" changes almost nothing about the *range* shown — the range is still whatever `dateRange` preset is active (default: rolling 90 days) — it only changes the bucket granularity of the trend line and the single-day snapshot used by the comparison/distribution cards. A user toggling Day/Week/Month on Insights while the date-range preset stays "90d" is not looking at the same kind of "period" their Dashboard/Operations toggle produces, even though it's the identical `PeriodToggle` component and the identical three button labels. F-A7 (already landed) added the Custom+dateRange dual-state; it did not unify periodType's meaning with the other three pages, and that gap is exactly what this scoping document should close. |
| **Team.tsx** | `useState<'Day'\|'Week'\|'Month'>('Day')`, no local range helper at all | None — `periodType` and `todayISO()` are passed straight through to the backend on every call; Team never needs a `{start,end}` shape on the frontend because none of its calls take one | `getTeamScores(managerEmployee, date, periodType)`. `getAllTeamScores(employee, date, periodType)` | Simplest page, and arguably the "canonical" caller shape: single ref-date + period_type, no client-side range math, no chance of a frontend/backend disagreement because the frontend never computes a range. But this also means Team has zero drilldown that needs `{start,end}`, so it hasn't had to face the divergence Dashboard/Operations have. |
| **period-toggle.tsx** | Pure, stateless `PeriodToggle({value, onChange})` — hardcodes `['Day','Week','Month']`, no `Custom` option | N/A (presentational only) | N/A | Insights has to special-case around this: it maps `'Custom' → 'Day'` when passing `value` to `PeriodToggle` and renders an extra "Clear Custom" button beside it, because the toggle component itself cannot represent a 4th state. Any shared model needs to either extend this component or keep Custom as a state that coexists with, rather than replaces, the toggle's three buttons. |

### Confirmed silent divergences worth flagging explicitly

1. **Same button, different meaning, per page.** "Week" on Dashboard/Operations = Mon–Sun of the current ISO week, computed client-side and used to build a `{start,end}` request. "Week" on Insights = a bucket-size hint sent alongside whatever date range (default 90 days) the separate date-range picker is set to — it does not, by itself, restrict the data to the current week at all. Team's "Week" is opaque (delegated entirely to the backend's own interpretation of `period_type=Week`) and never independently checked against Dashboard/Operations' client-side math.
2. **Two derivations of the same rule, hand-duplicated.** Dashboard's `getPeriodRange` and Operations' `getPeriodRange` are ~20 lines of identical Week/Month arithmetic, textually forked. They currently agree, but nothing prevents them from drifting — this is the literal mechanism C10 warns about.
3. **Split source of truth within a single page.** Operations trusts the backend's period_type→range derivation for `getOperationsOverview`/`getComplianceScore`, but trusts its own client-side `getPeriodRange` for `getFailureList`. If the backend's Week/Month boundary math differs from the frontend's (different week-start day, different timezone handling, inclusive/exclusive end date), the failure list under "Failed runs" and the compliance score ledger above it can show different windows on the same render, for the same page, for the same toggle click. This should be verified against the backend during Task 1 (see below) even though this document is scoped to the frontend.
4. **A "previous period" concept that exists on exactly one page.** Dashboard's `getPreviousPeriodDateISO` has no counterpart on Operations/Insights/Team. Any shared hook should either expose this as a general capability (so a future page can adopt trend comparisons for free) or explicitly decide it's Dashboard-specific and leave it out of the shared model — but it should not remain an undocumented one-off.
5. **Mutation footgun.** Dashboard's Week branch calls `new Date(today.setDate(diff))`, mutating the `today` Date object in place inside a function that also declares it `const`. It happens to be safe today only because nothing reads `today` again afterward in that function. Operations' equivalent code copies `today` first. Any canonical derivation adopted going forward should use the non-mutating (Operations) style.
6. **`getFailureAnalytics` ignores period_type entirely.** Dashboard calls `getFailureAnalytics(currentUser.id, today)` with no period argument — whatever window that endpoint uses server-side is invisible to and unconfirmed by the frontend, and is not part of the periodType toggle's contract at all. Worth a follow-up ticket distinct from C10 if the "Organization-wide Failure Points" card is meant to respect the page's period toggle (it currently only renders `periodType === 'Day'`, which sidesteps the question rather than answering it — see `Dashboard.tsx` line 496).

## 2. Proposed shared model

### 2.1 Type

```ts
// frontend/src/lib/period-scope.ts

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
```

### 2.2 Hook

```ts
// frontend/src/hooks/usePeriodScope.ts

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
}

export function usePeriodScope(opts?: UsePeriodScopeOptions): UsePeriodScopeResult { /* ... */ }
```

### 2.3 Canonical derivation

Adopt **Operations.tsx's `getPeriodRange`** as the canonical implementation (non-mutating `today` copy), with two changes:

- Fix the Week/Month arithmetic to run in a fixed reference timezone (today it silently uses the browser's local timezone via `Date` — this is not a bug per se, but it should be a documented, deliberate choice in the shared hook rather than an accident inherited from whichever page happened to be copied from). Flag for confirmation during Task 1: does the backend's own period_type→range derivation (used by `getComplianceScore`, `getTeamScores`, `getOperationsOverview`, and Insights' ref-date endpoints) use the same timezone assumption? If not, this is the pre-existing bug described in inventory point 3 above, and fixing the frontend alone will not close the gap — the backend's derivation needs to either match this hook's rule or the hook needs to defer to the backend entirely and stop computing `{start,end}` for `getFailureList` client-side.
- Preserve Dashboard's `getPreviousPeriodDateISO` as `previousRefDate`, generalized so it isn't Dashboard-only.

The hook computes `range` unconditionally from `periodType` + "today" (via the fixed canonical `getPeriodRange`), except when `periodType === 'Custom'` and `allowCustom` is true, in which case `range` is sourced from `customRange` instead (this is the dual-state Insights already has post-F-A7; the hook formalizes rather than replaces it).

### 2.4 Serving both call shapes

Every existing backend call falls into exactly one of two shapes, both served directly off `PeriodScope` without any page re-deriving anything:

- **`(date, period_type)` callers** — `getComplianceScore`, `getTeamScores`, `getAllTeamScores`, `getOperationsOverview`, `getScoreForUser`, `getDepartmentComparison`, `getBranchComparison`, `getTopBottomPerformers`, `getScoreDistribution`, `getEmployeesByDepartment/Branch` → call with `scope.refDate, scope.periodType === 'Custom' ? 'Day' : scope.periodType` (the existing `legacyPeriodType` fallback Insights already uses, moved into the hook so no page has to remember to downgrade Custom itself).
- **`(start_date, end_date)` callers** — `getFailureList`, `getScoreTrends`, `getTemplatePerformance`, `getCompletionTrend`, `getDayOfWeekHeatmap`, `getMostMissedItems` → call with `scope.range.start, scope.range.end`.

No page should need to write its own `getPeriodRange`, `rangeFromPreset`-equivalent, or ref-date fallback after adopting the hook.

## 3. Migration plan

| Page | What gets deleted | What replaces it | User-visible behavior change (flag explicitly) |
|---|---|---|---|
| **Dashboard.tsx** | `getPeriodRange`, `getPreviousPeriodDateISO`, the local `useState<PeriodType>` | `const scope = usePeriodScope()`; `scope.refDate`/`scope.periodType`/`scope.range`/`scope.previousRefDate` replace every corresponding local variable | None expected if the canonical derivation matches Dashboard's own Week/Month math exactly (it does, per §1) — this is a pure refactor for Dashboard specifically. |
| **Operations.tsx** | Local `getPeriodRange`, local `useState<PeriodType>` | `const scope = usePeriodScope()` | None expected — Operations' own math is the one being adopted as canonical, so this page's output is unchanged by construction. This migration mainly exists to delete the duplicate code, not to change behavior. |
| **Insights.tsx** | Nothing about the *filters* (dateRange/preset picker in `InsightsFilters.tsx` stays as-is — it is a distinct, deliberate feature, not duplicated period logic); local `useState<PeriodType | 'Custom'>`, the inline `legacyPeriodType` fallback, the `refDate = dateRange.end ?? todayISO()` derivation | `const scope = usePeriodScope({ allowCustom: true })`; `scope.setCustomRange` wired to `InsightsFiltersBar`'s `onDateRangeChange`; range-based calls use `scope.range`, ref-date calls use `scope.refDate`/`scope.periodType` (auto-downgraded) | **Flag for product/design sign-off, not a silent change:** today, picking "Week" on Insights does *not* restrict the visible range — it only changes trend bucket size while the date-range preset (default 90d) stays as-is. After adopting the shared hook as specified above, "Week" would for the first time actually mean "the current calendar week" for every ref-date-based card (dept/branch comparison, top/bottom performers, distribution, drilldowns), while the explicitly-range-based cards (trend lines, template performance, day-of-week, most-missed) would continue to respect whichever `dateRange` preset/custom range is separately selected. **This is a real, user-visible behavior change on Insights and must be called out to whoever reviews the C10 migration** — it is the corrective one right answer replacing three inconsistent ones, but it is still a change from what today's users see. |
| **Team.tsx** | Local `useState<PeriodType>` | `const scope = usePeriodScope()`; both `getTeamScores`/`getAllTeamScores` calls take `scope.refDate, scope.periodType` | None expected — Team never computed a client-side range, so nothing about its request shape changes. |

## 4. Bounded implementation task list

Dependency order: **Task 1 must land before Tasks 2–5**, which are then mutually independent (each touches exactly one page file plus, in Insights' case, its own filter-wiring — no shared file is touched by more than one of these four).

- **Task 1 — Build `usePeriodScope` + `period-scope.ts` types + unit tests.** *(Sonnet-tier, foundational — requires judgment calls: confirming the canonical derivation against backend behavior per inventory point 3, deciding the previous-period generalization, deciding whether Custom coexists with or replaces the toggle value passed to `PeriodToggle`.)* Deliverables: `frontend/src/lib/period-scope.ts`, `frontend/src/hooks/usePeriodScope.ts`, tests covering Day/Week/Month/Custom derivation, the `legacyPeriodType` downgrade, and `previousRefDate`. Must also confirm with a backend read (out of this document's scope, but required before this task is "done") that the backend's own period_type→range derivation agrees with the canonical `getPeriodRange` for Week/Month boundaries and timezone — otherwise Task 1 needs to additionally document (or fix) that mismatch.
- **Task 2 — Migrate `Dashboard.tsx` to `usePeriodScope`.** *(Haiku-sized, mechanical once Task 1 exists — delete local state/helpers, wire hook, no behavior change expected.)* Depends on Task 1.
- **Task 3 — Migrate `Operations.tsx` to `usePeriodScope`.** *(Haiku-sized, mechanical — Operations' own math becomes the canonical implementation, so this is close to a no-op swap.)* Depends on Task 1. Independent of Tasks 2, 4, 5.
- **Task 4 — Migrate `Team.tsx` to `usePeriodScope`.** *(Haiku-sized, mechanical — Team has no local range logic to delete, just state.)* Depends on Task 1. Independent of Tasks 2, 3, 5.
- **Task 5 — Migrate `Insights.tsx` to `usePeriodScope` with `allowCustom: true`.** *(Not Haiku-sized — flag as Sonnet-tier or at least reviewed-by-a-human, because it is the one migration with a real, product-visible behavior change per §3 that needs sign-off before or during the change, not just a mechanical refactor.)* Depends on Task 1. Independent of Tasks 2, 3, 4, but should not be merged without explicit acknowledgement of the Week/Month behavior change from whoever owns the Insights page.
