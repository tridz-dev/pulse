# Pulse — UI & Product Gap Analysis

Evidence base: four live screenshots of `pulse-w1w5-reverify` (branch
`design/ui-completion-w0-w4`, commit `5569d47`, demo data seeded), cross-checked
against source. Every claim below cites `file:line`. **Diagnosis only — no fixes
applied.**

---

## Verdict up front

The seven reported defects are all real. But they are surface symptoms, and
fixing only them would leave the product unusable for its actual purpose.

The screenshots expose a **correctness failure in the core compliance number**:
the same four people, in the same period, are simultaneously reported as
"no data" (Team), "6%" (Dashboard), "invisible" (Dashboard chart), and
"0% — red — failing" (Operations). A compliance product whose central number
disagrees with itself across four surfaces cannot be adopted, regardless of how
good the chrome looks.

Separately, a security check done while verifying these findings turned up
**broken access control on three hierarchy read endpoints** (C9): any
authenticated user can pass an arbitrary employee ID and read that person's
entire reporting subtree and scores. That blocks any pilot on real org data.

Severity order is therefore:
**access control → trust bugs → missing action loop → chrome.**

---

# Part A — The seven reported defects, verified

### A1 · Sidebar collapse control is stranded at the bottom, and its glyph doesn't read

`components/layout/Sidebar.tsx:140-195`

The footer is `flex flex-col items-center`, stacking the identity dropdown and
then the collapse button beneath it. The collapse button is `w-full` with a
centered 16px `PanelLeftClose` glyph and **no visible text label**.

Result (screenshot 1): a lone unlabeled icon floating at the very bottom of a
240px rail, below the user identity. You read it as a mystery glyph — you called
it a search icon, which is exactly the failure mode: the icon does not
communicate "collapse."

This violates the project's own rule: DESIGN.md — *"No icon-only buttons without
a visible text label — instrument panels are read, not decoded."*

**Root cause is ours.** Moving identity into the footer (Wave 1) pushed the
collapse control below it. Previously it sat at the top of the footer group.

### A2 · The search affordance is a fake keyboard event

`components/layout/Sidebar.tsx:78-84`

```js
onClick={() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
}}
```

The search button does not open search. It synthesises a ⌘K keypress that
`CommandSearch` happens to listen for. Consequences:

- `CommandSearch.tsx:26` handles it with `setOpen(prev => !prev)` — a **toggle**.
  Clicking the search button while search is open *closes* it.
- Two components are coupled through the global event bus to pass one boolean.
- The dialog it opens has **no search index behind it** — it is a placeholder
  input that returns nothing (`CommandSearch.tsx`, "No results yet").

So the sidebar's most prominent element, occupying prime real estate above the
nav, is a control that does nothing useful.

### A3 · DAY/WEEK/MONTH active state fails colour contrast in both themes

`components/shared/period-toggle.tsx:39-41`

```js
value === period ? "bg-sel text-text" : ...
```

Active = `--text` on `--sel`.

| Theme | Foreground | Background | Contrast | WCAG AA (4.5:1) |
|---|---|---|---|---|
| Light | `#1D1D1F` | `#4A5FC1` | **2.96 : 1** | ✗ Fail |
| Dark | `#E6E8EE` | `#6B7FD7` | **3.04 : 1** | ✗ Fail |

At 10.5px this is far below the large-text exemption threshold. That is why the
active chip reads as a muddy indigo smear in screenshots 2 and 4 — it is
genuinely hard to read, not a rendering artefact.

Secondary: container radius is `var(--radius)` (3px) but the inner buttons are
`rounded-[1px]` — two radii in one control, against a system whose stated rule
is one flat radius everywhere.

**Root cause is ours.** The pre-existing hand-rolled toggle used
`bg-slab text-text` (a light pill), which was legible. Unifying onto
`PeriodToggle` standardised the look but regressed legibility.

### A4 · The header is an empty 48px band

`components/layout/Topbar.tsx:22-32`

The left group contains only the mobile hamburger (`md:hidden`). On desktop the
entire left half of the header is empty; the right half holds one bell whose
dropdown is hardcoded to "No new notifications."

**Root cause is ours, and it was flagged before shipping.** The adversarial
review raised this as finding #10; the breadcrumb was removed but nothing
replaced it. We traded a *meaningless* breadcrumb for an *empty* band — a net
loss of vertical space and a header with no job.

The page title now lives only in `PageHeader` inside the scroll container, so on
a scrolled page there is no persistent indication of where you are.

### A5 · Organisation Health tree — drill-down requires a double-click, and only two levels exist

`pages/Operations.tsx:597-612`, `components/ui/tree-row.tsx:25`

Two independent defects:

**(a) The drill gesture is undiscoverable.** For a row with children:
- single click → `onToggle` (expand/collapse), wired inside `TreeRow` itself
- drill-down → `onDoubleClick` only

Meanwhile the section header reads **"Select a row to drill down"**
(`Operations.tsx:415`). So the UI instructs a single click, performs an expand,
and hides the advertised action behind an undocumented double-click. Clicking
"Anita Das" appears to do nothing meaningful — it expands to reveal rows that
are themselves 0%/red (see B1).

**(b) The tree structurally cannot render the org.** `TreeRow` accepts
`level?: 0 | 1` only. `Operations.tsx:593` clamps everything deeper:

```js
const rowLevel: 0 | 1 = level > 0 ? 1 : 0;
```

Depth below level 1 is faked with an inline wrapper margin
(`Operations.tsx:596`), so the design system's indent rail — the element that
carries the parent/child relationship — stops after one level while the margin
keeps growing. The demo org is **six levels deep**
(Ramesh → Priya → Vikram → Rahul → Kavitha → Arun). Hierarchy roll-up is the
product's headline capability; its primary view cannot express it.

### A6 · Failed runs use a different time model than everything else on the page

`pages/Operations.tsx:85-101`

One page, two incompatible scoping mechanisms fired in the same effect:

```js
getOperationsOverview(currentUser.id, today, periodType)   // point date + period label
getComplianceScore(currentUser.id, 'inherited', today, periodType)
getFailureList(range.start, range.end, currentPage, pageSize)  // explicit date range
```

The tree and the KPI are scoped by `(anchor date, period type)`; the failure
list is scoped by `(start, end)` from a **client-side** `getPeriodRange()`
(`Operations.tsx:25-45`). The two need not agree, and observably don't — the
earlier Month-scoped screenshot listed runs due `7/31/2026` while the client
range for Month was `2026-08-01 … 2026-08-31`.

Two further bugs in that helper:

- **Date mutation.** `const start = new Date(today.setDate(diff))`
  (`Operations.tsx:37`) mutates `today` in place before `end` is derived. It
  survives by accident here; any added line after it inherits a corrupted date.
- **Pagination never refetches.** `currentPage` is a loop-local inside the
  effect, and the effect deps are `[currentUser, periodType]`
  (`Operations.tsx:120`). Combined with the `allFailures.length < 500` cap, the
  list silently truncates with no indication — DESIGN.md explicitly requires
  *"a live 'N rows · N filters' count [as] the honesty check."*

### A7 · Insights has two competing time controls that disagree by design

`pages/Insights.tsx:112, 125, 148, 185, 241`

Two independent pieces of state:

1. `periodType` — Day/Week/Month/**Custom**, the top-right `PeriodToggle`
2. `dateRange` — Last 7/30/90 days · This month · **Demo data**, the chip row
   below the title, defaulting to `rangeFromPreset('90d')`

They feed different arguments to different queries:

```js
getScoreTrends(start, end, periodType, filters)              // range AND bucket
getDepartmentComparison(refDate, legacyPeriodType, filters)  // refDate = dateRange.end
```

This directly produces the screenshot-4 anomaly: with `periodType='Month'` and
`dateRange='This month'`, **Org Score Trend buckets the whole range into one
month → a single orphaned dot at 56%**, while Completion Rate Trend beside it
plots daily → a full curve. Two charts, one card row, different granularities,
because two controls disagree.

Two more problems in the same row:

- **The toggle lies about its own state.** `Insights.tsx:242`:
  `value={periodType === 'Custom' ? 'Day' : ...}` — selecting Custom renders
  "DAY" as the active segment.
- **"Demo data" is a data-source switch sitting inside a time-range control.**
  Loading fixture data is not a date preset.

---

# Part B — What the screenshots show that wasn't reported

These are more serious than A1–A7.

### B1 · No-data is rendered as red 0% failure — the system's own #1 forbidden behaviour

`lib/score.ts` exists precisely to prevent this, and documents it:

```js
// total === 0 (or missing) is the null/no-data case — grey, never red, never
// coerced to a 0% score.
export function scoreStatus(score, total) {
  if (score == null || (total !== undefined && total <= 0)) return "none"
  ...
  return "fail"   // score < 20
}
```

**`Operations.tsx:577` calls it without the `total` argument:**

```js
const combinedScore  = node.score?.combinedScore ?? 0;   // null → 0
const scorePercentage = Math.round(combinedScore * 100); // → 0
const status = scoreStatus(scorePercentage);             // total omitted → "fail"
```

A person with **zero generated runs** therefore renders as **0%, red, failing**.
That is screenshot 3: Anjali Kapoor, Rajesh Mehta, Anita Das and Vikram Patel
all shown as red 0% — the same four people the Team page (screenshot 2) shows as
`—` no-data, correctly, via `ScoreDisplay` (`Team.tsx:617-622`).

It compounds in the meter (`Operations.tsx:583-591`): when `totalItems === 0`
the fallback branch renders `{value: 0, bg-pass}, {value: 100, bg-fail}` — a
**solid full-width red bar**. An executive opening Mission Control sees their
entire organisation as catastrophically failing when in fact no runs were
generated.

DESIGN.md, verbatim: *"Null and zero are visually distinct on purpose. A true
zero is red. 'No data' is always grey with an em dash. Conflating the two is the
single biggest trust problem this system exists to prevent."* And under Don't:
*"Red for zero-with-no-data."*

### B2 · The same question gets four different answers

For Priya Sharma's four direct reports, in the same period:

| Surface | Renders | Source |
|---|---|---|
| Team page | `—` ×4 (correct) | `Team.tsx:617-622` guards on `total > 0` |
| Dashboard "Team Roll-up" | **6** | `Dashboard.tsx:232-233` |
| Dashboard "Execution by Group" | 3 invisible bars + 1 real | `Dashboard.tsx:252-256` |
| Operations tree | **0% red** ×4 | `Operations.tsx:577` |

`Dashboard.tsx:233` is the second instance of the same coercion — and worse,
because it silently poisons an aggregate:

```js
teamData.reduce((sum, t) => sum + (t.combined_score ?? 0), 0) / teamData.length
```

Nulls become zeros **and stay in the denominator**. This breaks a stated core
invariant in `CONTEXT.md`: *"Not-yet-generated runs have no score and are
excluded from the denominator."* The displayed "6" is not a real 6% — it is four
unknowns averaged as zeros against one partial value.

It is also missing its `%` suffix while the gauge beside it reads "0 PERCENT".

### B3 · The Dashboard contradicts itself within a single card

Screenshot 1, one card: *"based on **0 completed tasks**"* · *"0 PASSED · **6
FAILED** · 6 TOTAL"* · *"View failing runs in scope **(0)**"*.

Six failures in the breakdown, zero in the link. `Dashboard.tsx:344` renders
`failures.length` from `getFailureList` (range-scoped), while the counts come
from `getComplianceScore` (period-scoped) — the same A6 split, on a second page.
A manager cannot act on six failures the UI will not show them.

### B4 · Parent and child scores are computed by different rules

Screenshot 3: Priya Sharma **92% green**, every one of her direct reports
**0% red**. The parent's roll-up comes from the backend (which appears to
exclude empty children correctly); the children's display coerces null→0→red on
the client. The tree contradicts itself vertically, which is precisely the
artefact that makes a hierarchy view untrustworthy.

### B5 · Charts plot partial periods as real declines

Screenshot 4, Completion Rate Trend: a vertical cliff to ~15% at `08-28`.
That is *today*, mid-day, plotted as a completed day. Every daily-trend chart in
the product will show a false collapse at its right edge, permanently. Nothing
marks the final bucket as incomplete.

### B6 · `--none` is the same dark navy in both themes

`index.css`: `--none-status: #3A404D` for light **and** dark. On the light
`#F5F4F1` page this is a near-black bar. In screenshot 2 the no-data rows show
`—` beside a **solid dark bar** that reads as *full*, not *absent* — inverting
the intended meaning at exactly the moment the user is being told there is no
data.

---

# Part C — Gaps blocking serious adoption

Ordered by how hard they block a real customer, not by effort.

## C1 · There is no action loop — the product only reports

Mission Control lists failures. It cannot **do** anything about them. There is
no acknowledge, no assign, no waive-with-reason, no snooze, no escalate, no
re-open. `escalation-design.md` and `snooze-design.md` exist as designs; neither
is built.

A compliance tool that a manager can only read is a report, not an operations
product. Adoption dies at the second week when nothing changes as a result of
looking. **This is the single largest product gap.**

## C2 · Nothing reaches the user outside the app

The bell is a stub with no service behind it (`Topbar.tsx`, hardcoded "No new
notifications"). There is no email, push, SMS or WhatsApp path. In the target
domain — QSR shift work — the manager is not at a desk. A missed Kitchen Open
checklist has to reach someone *at 07:15*, not whenever they next open a browser.

Without this, the compliance score is a post-mortem artefact rather than an
operational control.

## C3 · Corrective Actions have data but no home

Insights surfaces "OPEN CAS 9" and "AVG RESOLUTION 0.0 hrs"; the demo seeds 18
Corrective Actions. There is **no page in the nav that owns them** — no queue,
no owner, no due date, no resolution flow. The metric is reported; the object is
unreachable. (The 0.0 hrs figure is itself suspect and unverified.)

## C4 · The execution surface is desktop-shaped, but execution is mobile

The operator — the person who actually completes checklists — works on a phone,
one-handed, in a kitchen, on poor wifi. Current state:

- desktop SPA; mobile support arrived as a remedial audit, not a design centre
- no PWA, no installability, no offline queue, no optimistic retry
- checklist completion (`updateRunItem`) is a live call per tick — a dropped
  connection mid-checklist loses the run
- evidence photo upload is a synchronous foreground upload

If operators can't reliably complete runs, every number downstream is noise.

## C5 · No coverage model — absence is indistinguishable from negligence

SOP assignments bind a template to a **person**. Real rosters have shifts,
leave, sickness and substitutes. Today, if Arun is off, his Kitchen Open runs
generate and fail, and he is scored as non-compliant. There is no delegation,
no cover, no shift/roster concept, no bulk reassignment.

This is the fastest route to customers rejecting the scores as unfair — and once
scores are seen as unfair, the product is dead internally.

## C6 · No path from empty to first value

A new customer lands on zeros and em-dashes with no guidance. There is no org
import (CSV/HRIS), no template library to start from, no assignment bulk editor,
no guided setup. The only population mechanism is `pulse-load-demo`, which is a
developer command.

Compounding: the empty state is currently *wrong* as well as empty — see B1, an
unpopulated org renders as a red failing org.

## C7 · Gates and evidence review are designed, not built

`evaluations-design.md` covers evaluations and gates; `CONTEXT.md` defines
Gate and Evidence as first-class. In the product: photos upload, and nothing
reviews them. No approval queue, no reject-with-reason, no gate that blocks
completion. Evidence you never look at is storage cost, not assurance.

## C8 · Immutability and amendments have no surface

`CONTEXT.md`: *"Finalized records are immutable; corrections use linked
amendments or adjustments."* There is no amendment UI, no audit-trail view, no
"who changed what and why." For any customer buying this for audit defensibility
— the likeliest reason to buy — this is a procurement blocker.

## C9 · Broken access control on hierarchy read endpoints (verified — security)

**This is a live vulnerability, not a design gap.**

Three whitelisted read endpoints accept a client-supplied employee identifier
and perform **no authorisation check whatsoever**:

| Endpoint | File | Client-controlled arg |
|---|---|---|
| `get_operations_overview` | `pulse/api/operations.py:40` | `top_employee` |
| `get_user_run_breakdown` | `pulse/api/operations.py:67` | `employee` |
| `get_hierarchy_breakdown` | `pulse/api/operations.py:164` | `top_employee` |

`get_operations_overview` recursively walks `reports_to` and returns the entire
subtree — names, roles, branches, reporting lines and scores:

```python
@frappe.whitelist()
def get_operations_overview(top_employee: str, ...):
    def build_tree(emp_name):
        user = _employee_dict(emp_name)                       # frappe.db.get_value — bypasses permissions
        subs = frappe.get_all("Pulse Employee",
                              filters={"reports_to": emp_name, "is_active": 1}, pluck="name")
```

`hooks.py:128-132` registers `permission_query_conditions` for `SOP Run`,
`Score Snapshot` and `Corrective Action` — but **not for `Pulse Employee`**. So
the `frappe.get_all` above is unfiltered, and `_employee_dict` uses
`frappe.db.get_value`, which bypasses the permission layer entirely.

**Impact:** any authenticated Pulse user — including a `Pulse User`-role
operator — can pass any employee ID and enumerate that person's full reporting
subtree. A cashier can read the Chairman's org and scores. The client-side
`hideFor` nav filtering in `Sidebar.tsx:37-42` hides the *link*, not the *data*;
the endpoints are directly callable.

Note the codebase already has the right primitives — `pulse/api/permissions.py`
exposes `get_descendants_scope`, `get_manager_plus_descendants_scope`,
`get_organisation_scope`, `get_personal_scope`, and the **write** path
(`create_corrective_action_for_run`, `operations.py:293+`) correctly calls
`get_scope_for_user`. The read path simply never adopted them.

**This blocks any pilot on real organisational data** and moves to P0.

## C10 · No scope/period model — three pages, three answers

Documented in A6 and A7. There is no single, shared, named concept of "the
period and scope I am currently looking at." Every page invented its own. Until
one exists, cross-page comparison is impossible and every new page adds a fourth
dialect.

---

# Part D — Prioritised path

### P0 — Trust & security (nothing else matters until these are true)

0. **Authorise the three hierarchy read endpoints** against the caller's scope
   using the existing `permissions.py` helpers, and add `Pulse Employee` to
   `permission_query_conditions`. (C9 — security, blocks pilots.)

1. **Kill null→zero coercion everywhere.** Pass `total` into `scoreStatus`
   (`Operations.tsx:577`); exclude nulls from numerator *and* denominator in
   `Dashboard.tsx:233`; make chart series drop null members rather than plot 0.
2. **Fix the no-data meter** — `Operations.tsx:583-591` must render `bg-none`,
   not 100% `bg-fail`, when `totalItems === 0`.
3. **Give `--none` a light-theme value** that reads as absence.
4. **One scope model.** A single `{scope, period}` object owned above the pages,
   consumed identically by tree, KPI and failure list. Retire the client-side
   `getPeriodRange` and the Insights dual control.
5. **Mark incomplete trailing buckets** in every trend chart.
6. **Reconcile the failure count** so "View failing runs (N)" and the breakdown
   read from one source.

### P1 — Make it an operations product

7. Action loop on every failure: acknowledge · assign CA · waive with reason ·
   snooze · escalate. (C1)
8. Corrective Action queue as a first-class page. (C3)
9. Notification service + delivery channel, driven by the existing escalation
   design. (C2)
10. Coverage/delegation so absence ≠ failure. (C5)

### P2 — Make it adoptable

11. Mobile/offline execution path for operators. (C4)
12. Onboarding: org import, template library, bulk assignment. (C6)
13. Evidence review + gates. (C7)
14. Amendment/audit-trail surface. (C8)
15. Broader server-side scope audit across all remaining read endpoints,
    following the P0 fix. (C9)

### P3 — Chrome (the seven reported items)

16. Header: restore a persistent page title + scope indicator; move the collapse
    control to the rail edge with a label; drop the fake-keyboard search in
    favour of shared state; fix `PeriodToggle` contrast; give the tree real
    depth and separate expand from drill-down.

These are worth doing — they are what you *see* — but every one of them is
cosmetic relative to P0. Shipping polished chrome over a compliance number that
reports "no data" as "red 0% failing" would make the product more confidently
wrong, not more usable.

---

## Note on provenance

A4, A3, A1 and part of A7 are regressions introduced by the W0–W4 composition
work in this branch. A5, A6, B1–B6 and all of Part C predate it. The composition
layer did what it was scoped to do; it did not, and could not, address the
data-integrity and product-loop gaps — those were never in its scope, and they
are where the real work is.
