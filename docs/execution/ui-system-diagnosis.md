# UI/Design-System Diagnosis — Pulse frontend

Scope: `tracks/PulseFirstMilestone/integration/frontend/src` (8.8k LOC) measured against
`pulse_design/DESIGN.md`. Diagnosis only — no fixes applied.

---

## 1. Root cause (one sentence)

**The design system exists as tokens and leaf primitives, but never as composition.**
`index.css` maps every Pulse token correctly and `components/ui/*` holds 23 well-built
primitives — and then all seven pages hand-assemble their own layout, headers, empty
states, skeletons, and status colors on top of those primitives. There is no layer
between "a Meter" and "a page", so every page re-invents the middle. That is why the
UI reads *unfinished* rather than *ugly*: individually correct parts, no shared shape.

## 2. Concrete weaknesses

### W1 — No page-composition layer (highest leverage)
`animate-in fade-in duration-500 flex flex-col gap-6 pb-10` + `<h1 className="text-3xl
font-semibold tracking-tight text-text">` is copy-pasted verbatim in all 7 pages. No
`PageHeader`, `PageShell`, `SectionCard`, `StatTile`, `FilterBar`, or `PeriodToggle`
component exists. Consequence: the Day/Week/Month toggle, the eyebrow-label KPI card,
and the `h1 + subtitle` block are each implemented 3–5 separate times with drifting
spacing. Also: `text-3xl/600` contradicts DESIGN.md's page title spec (700 · −0.02em).

### W2 — Empty state is the *default* state, and it is unhandled
Insights ships four charts (Department Comparison, Branch Comparison, Top Performers,
Needs Attention) that render bare axis rectangles when the dataset is empty — there is
no `data.length === 0` guard anywhere in the Recharts blocks. Dashboard "Execution by
Group" renders a single lone bar. `TableEmptyState` exists in `components/ui/table-states.tsx`
and is used in exactly **2 files**; five pages instead hand-roll a `border-dashed`
centered block. This is the single biggest driver of "looks incomplete" in the
screenshots. DESIGN.md mandates four distinct table/chart states (zero, filtered-empty,
error, loading); the app implements ~1.

### W3 — Direct violations of DESIGN.md's own "Don't" list
- **Whole-surface status tinting**: 31 uses of `bg-pass/10`, `bg-sel/10`, `bg-risk/10`
  etc. across the pages (Operations 8, MyTasks 7, Dashboard 6). DESIGN.md: *"Never fill
  the whole card"* — status belongs in a 2px left stroke. `StatusStrokeCard` exists and
  is barely used.
- **`--sel` used as status/brand**: MyTasks tints checked checklist items and the run
  icon tile with `bg-sel/5`, `bg-sel/10`. `--sel` is reserved for focus/selection only.
- **Radius drift**: 30 `rounded-lg` / `rounded-xl` / `rounded-md` occurrences (Templates 17,
  Insights 6, Dashboard 5, Team 2) against a "flat 3px, no exceptions" rule. Recharts
  bars use `radius={[0,4,4,0]}`.
- **Gauges**: `components/ui/gauge.tsx` survives and Dashboard renders a radial arc.
  Permitted as the "hero arc" alt, but it currently coexists with a Meter *and* KPI
  tiles — more than one hero per screen.
- **Icon-only buttons**: sidebar collapse, notification bell, theme toggle — DESIGN.md
  explicitly forbids icon-only controls ("instrument panels are read, not decoded").

### W4 — Chrome is confused about what lives where (the user's specific complaint)
- The **notification bell is in the sidebar footer**, wedged next to the collapse
  control, and has **no onClick — it is a dead button**. The **user identity block is in
  the top-right header**. Both are inverted relative to every convention and relative to
  the information architecture: identity is workspace-scoped (sidebar bottom), alerts are
  page-scoped (header right). Swapping them is correct.
- The **search field is also dead** — a `<button>` with a ⌘K kbd hint and no handler and
  no key listener. It disappears entirely when collapsed, so collapsing the rail silently
  removes a (fake) capability.
- **Collapse control** is a full-width icon button in the footer rather than a rail edge
  affordance; at 52px collapsed the header "P" mark, the nav icons, and the footer stack
  all use different horizontal centering.
- **Breadcrumb duplicates the sidebar**: `Pulse / Tasks` in a 48px header restates what
  the highlighted nav item already says, so the header carries ~no information and reads
  as filler. The header is the natural home for period scope + notifications + actions.

### W5 — The checklist runner (MyTasks) is the least-designed surface
Both the list card and the drawer are ad-hoc. Specific defects:
- The run card is a two-column flex with a colored icon tile (a DESIGN.md "Don't"), a
  `Badge` with four inline ternary class strings instead of `StatusChip`, and a 24px Meter
  hidden below `sm` — so on mobile the only progress signal is the text `0% Complete`.
- The drawer's checklist items are individually bordered, padded boxes (`p-4 border`)
  stacked with `space-y-4` — a card list where DESIGN.md calls for hairline-ruled rows.
- **Nothing communicates consequence**: no due time, no "what happens if this misses",
  no weight visibility (weight only appears when `> 1`), no gate/evidence-required
  affordance beyond a 28px unlabeled upload square.
- The evidence upload square is an icon-only control with an error state rendered as a
  bare `!` glyph in a `title` attribute — inaccessible and invisible.
- **No `Impact strip`, no `Consequence rail`** — the two signature patterns in DESIGN.md
  are implemented in `pulse_design/examples/*.html` and appear **nowhere** in the app.
  Submitting a checklist changes a compliance number with zero disclosure.

### W6 — Loading language is not shared
10 files hand-roll `animate-pulse` blocks with different heights, and `tree-row.tsx` has
its own third variant. DESIGN.md requires skeletons that match loaded row height and
share one language across tree and table. Result: every page flashes a differently-shaped
ghost.

### W7 — Design system has no enforcement
`pulse_design/skill/pulse-design/SKILL.md` and `examples/*.html` are the spec, but nothing
in CI checks against them: no lint rule banning `rounded-lg`/`bg-*/[0-9]+` opacity fills,
no Storybook/gallery route rendering the primitive catalog, no visual regression. This is
why the last 24 hours of commits (`fix: UI audit…`, `fix: mobile audit follow-up…`) keep
re-finding the same class of defect — the audits are manual and non-durable.

---

## 3. Fix plan — dependency-graphed for maximum parallelism

Five waves. Everything inside a wave is **independent and safe to run as a concurrent
sub-agent on its own worktree**. Wave boundaries are the only real barriers.

```
WAVE 0 (barrier — 2 agents, ~fast)
  A0  design-contract     ── freezes token/primitive API + IA decisions
  A0b lint-guardrails     ── ESLint rules + codemod-safe class allowlist
        │
        ├──────────────────────────────────────────────────────────────┐
WAVE 1 (6 agents, fully parallel — new components, no page edits)      │
  A1  PageShell + PageHeader + SectionCard                             │
  A2  StatTile + PeriodToggle + FilterBar                              │
  A3  ChartFrame (wraps Recharts: zero / filtered / error / loading)   │
  A4  Skeleton language (one primitive; row-height parity w/ tree)     │
  A5  ImpactStrip + ConsequenceRail (port from pulse_design/examples)  │
  A6  AppChrome: bell→header, identity→sidebar footer, real ⌘K search, │
      rail-edge collapse, breadcrumb→scope+actions header              │
        │                                                              │
        └── barrier: components exist & are exported ──────────────────┘
        │
WAVE 2 (7 agents, one per page — pure recomposition, no new primitives)
  B1 Dashboard   B2 Insights   B3 Operations   B4 Team
  B5 Templates   B6 UserProfile   B7 MyTasks (largest: card + drawer redesign)
        │  each: adopt A1–A4, delete local skeletons/empty states,
        │  replace opacity tints with StatusStrokeCard/StatusChip,
        │  kill rounded-lg/xl, one hero per screen
        │
        └── barrier: all pages compile & lint clean ───────────────────┘
        │
WAVE 3 (4 agents, parallel — cross-cutting passes over the new surface)
  C1 Consequence wiring: ImpactStrip into MyTasks submit + Operations
     exception review; ConsequenceRail into Templates edit
  C2 A11y + labeled-control pass (kills icon-only buttons, adds visible
     labels, focus rings, evidence-upload error surface)
  C3 Responsive/mobile pass at 375/768/1024 across all 7 pages
  C4 Dark/light parity sweep + typography conformance (700/−0.02em titles,
     mono for machine values, tabular-nums)
        │
        └── barrier ──────────────────────────────────────────────────┘
        │
WAVE 4 (3 agents, parallel — durability so this never regresses)
  D1 /__design gallery route rendering every primitive in both themes
  D2 Playwright visual-regression snapshots per page × theme × breakpoint
  D3 Update pulse_design/DESIGN.md + SKILL.md with the composition layer,
     and AGENTS.md with the "no page-local layout" rule
```

**Critical path**: A0 → A1 → B7 → C1 → D2 (5 hops). Everything else is slack.
**Peak concurrency**: 7 agents (Wave 2). Total ~22 agent-tasks.

### Isolation notes
- Waves 1 and 4 touch disjoint files → run in the same worktree safely.
- Wave 2 agents each own exactly one file under `src/pages/` → no conflicts, but they all
  *read* Wave 1 output, hence the barrier.
- Wave 3 agents each edit many files → give each its own git worktree and merge serially,
  or scope C2/C3/C4 by page-set to keep them disjoint.

### Highest-value-first ordering if you cannot run the whole graph
1. **A3 ChartFrame + A1 PageShell** — kills the "incomplete" read on Insights/Dashboard.
2. **A6 AppChrome** — the bell/identity swap, live search, honest collapse.
3. **B7 MyTasks** — the checklist is the operator's only surface; it is currently the worst.
4. **A0b lint guardrails** — stops the audit-refix loop.
