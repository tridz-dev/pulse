# Wave 1 Component Interface Contract

**Purpose**: This document freezes the API and acceptance criteria for all 6 Wave 1 components. Each component will be built independently by a separate agent with zero inter-component communication. This contract is the source of truth for file paths, TypeScript signatures, token reuse, and acceptance criteria.

**Reading guide**: Each section describes one component or component group. For each, you'll find:
- **File path**: Exact location under `frontend/src/components/`
- **Exports**: TypeScript interfaces and component signatures
- **Must reuse**: Which existing tokens/primitives this component must adopt (no new colors, no new radius)
- **Acceptance criteria**: How reviewers verify correctness

---

## 1. PageShell + PageHeader + SectionCard

**File path**: `frontend/src/components/shared/page-shell.tsx`

**Exports**:

```typescript
interface PageShellProps extends React.ComponentProps<"div"> {
  children: React.ReactNode;
}

/**
 * Outer container for all page content. Applies the standard page animation,
 * flex column layout, and vertical spacing. No padding — padding is applied
 * at the AppLayout level.
 */
export function PageShell({ children, className, ...props }: PageShellProps): JSX.Element;

interface PageHeaderProps extends React.ComponentProps<"div"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Page-level title block. Renders h1 (700 weight, −0.02em tracking per DESIGN.md),
 * optional subtitle (text-mute, 12.5px), and optional right-aligned action slot.
 * Does NOT apply its own flex layout — parent (PageShell) is responsible for flex/gap.
 */
export function PageHeader({ title, subtitle, action, className, ...props }: PageHeaderProps): JSX.Element;

interface SectionCardProps extends React.ComponentProps<"div"> {
  title?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reusable card wrapper for report sections. Applies bg-slab, border-rule border,
 * 3px radius, padding 16px. Title (if provided) is rendered as a 600-weight 14.5px
 * mono eyebrow label with faint color above the content, separated by a hairline
 * border. No internal flex/gap — content is responsible for its own layout.
 */
export function SectionCard({ title, children, className, ...props }: SectionCardProps): JSX.Element;
```

**Must reuse**:
- `bg-slab`, `border-rule`, `rounded-[var(--radius)]` from tokens (no `rounded-lg`, no `rounded-md`, no `rounded-xl`)
- `font-sans font-bold` + `text-[26px] md:text-[34px]` + `tracking-tight leading-none` for h1
- `font-mono text-[10.5px] uppercase tracking-[0.09em] text-faint` for eyebrow labels
- `padding: var(--spacing-22)` (22px section block) and `gap: var(--spacing-12)` (12px row) from DESIGN.md scale

**Acceptance criteria**:
- [ ] PageShell renders children without additional layout; animates in with `animate-in fade-in duration-500`
- [ ] PageHeader h1 uses font-sans 700 weight, not 600; tracking is −0.02em (use `tracking-tight` or custom)
- [ ] SectionCard title uses font-mono not font-sans
- [ ] All three components use `bg-slab` / `border-rule` / `rounded-[var(--radius)]` exactly; no color/radius inline classes
- [ ] SectionCard border is 1px solid; left stroke (if needed) is never applied here
- [ ] No hardcoded colors; all use CSS variables via Tailwind tokens

---

## 2. StatTile + PeriodToggle + FilterBar

**File path**: `frontend/src/components/shared/stat-tile.tsx` (StatTile), `frontend/src/components/shared/period-toggle.tsx` (PeriodToggle), `frontend/src/components/shared/filter-bar.tsx` (FilterBar)

**Exports**:

```typescript
interface StatTileProps extends React.ComponentProps<"div"> {
  /** Large 700-weight tabular number displayed at 44px. Can be null (renders em dash in faint color). */
  value: number | null;
  /** Mono eyebrow label (10.5px uppercase tracked). */
  label: React.ReactNode;
  /** Optional secondary text below the number (12.5px text-mute). */
  description?: React.ReactNode;
  /** Optional meter segments to display below the value. Follows Meter segment shape. */
  segments?: { value: number; className: string }[];
  /** Optional trend indicator: "up" or "down" (renders TrendingUp/TrendingDown icon in pass/risk/fail color). */
  trend?: "up" | "down" | null;
  /** Color of the trend icon if trend is set. Defaults to "none". Must be one of the 5 status colors. */
  trendColor?: "pass" | "risk" | "fail" | "waive" | "none";
}

/**
 * Displays a single KPI stat. Value is always mono (tabular-nums), label is always mono eyebrow.
 * Null value displays em dash in faint color (never red). Segments display inline Meter below value.
 * No card wrapping — parent is responsible for framing (SectionCard or custom).
 */
export function StatTile({
  value,
  label,
  description,
  segments,
  trend,
  trendColor = "none",
  className,
  ...props
}: StatTileProps): JSX.Element;

type PeriodType = "Day" | "Week" | "Month";

interface PeriodToggleProps {
  /** Currently selected period. */
  value: PeriodType;
  /** Callback fired when user selects a different period. */
  onChange: (period: PeriodType) => void;
  /** Optional CSS class. */
  className?: string;
}

/**
 * Compact three-button toggle: Day · Week · Month. Renders as a flex row of
 * segmented buttons with the active button using --sel background. Uses mono
 * 10.5px uppercase text. Each button is compact (py-1 px-3 or similar).
 * No external label — the toggle is self-documenting.
 */
export function PeriodToggle({
  value,
  onChange,
  className,
}: PeriodToggleProps): JSX.Element;

interface FilterChip {
  /** Unique identifier for this filter value. */
  id: string;
  /** Display label (shown in the chip). */
  label: React.ReactNode;
}

interface FilterBarProps {
  /** Array of active filters. Each chip is removable. */
  filters: FilterChip[];
  /** Called when user clicks the X on a chip to remove it. */
  onRemoveFilter: (id: string) => void;
  /** Optional total row count and filter count display (e.g. "42 rows · 3 filters"). */
  rowCountDisplay?: React.ReactNode;
  /** Optional CSS class. */
  className?: string;
}

/**
 * Horizontal row of filter chips above a table/list. Each chip is clickable to remove,
 * rendering with an X glyph. Chips use border-rule border, transparent bg, mono 10.5px
 * text. Optionally displays "N rows · M filters" meta on the right. No search input here
 * — that lives in Sidebar or a separate search component.
 */
export function FilterBar({
  filters,
  onRemoveFilter,
  rowCountDisplay,
  className,
}: FilterBarProps): JSX.Element;
```

**Must reuse**:
- StatTile: `font-mono text-[44px] font-bold tabular-nums` for value; `font-mono text-[10.5px] uppercase tracking-[0.09em]` for label
- StatTile: Meter component (already exists) for segments; use exact same segment shape
- StatTile: No new colors; trend icon uses only the 5 status colors + none
- PeriodToggle: `bg-sel` for active button background; `text-text` for active, `text-mute` for inactive
- FilterBar: `bg-transparent border border-rule rounded-[var(--radius)]` for chips; `font-mono text-[10.5px]` for chip text
- All: `font-mono` from tokens, never `font-sans` for labels/eyebrows/metadata

**Acceptance criteria**:
- [ ] StatTile displays null as em dash (U+2014) in faint color, never red
- [ ] StatTile uses `font-mono` for both value and label; value is `tabular-nums`
- [ ] PeriodToggle buttons are segmented (no gap between active button and neighbors during transition)
- [ ] FilterBar chips are removable; X glyph is visible and clickable
- [ ] No hardcoded colors in any component; all status colors come from the 5-token closed set
- [ ] No `rounded-lg`, `rounded-md`, `rounded-xl` anywhere; radius is `rounded-[var(--radius)]` only

---

## 3. ChartFrame (Recharts wrapper)

**File path**: `frontend/src/components/shared/chart-frame.tsx`

**Exports**:

```typescript
interface ChartFrameProps {
  /**
   * Chart state. One of four values:
   * - "loading": Data is being fetched. Render a skeleton loading state.
   * - "zero": No data at all (first use, no records match any period). Render neutral tone empty state.
   * - "filtered-empty": Filters are active but they matched zero rows. Render distinct empty state
   *     that names the active filters so user knows why the chart is empty.
   * - "error": Data fetch failed. Render error state with "couldn't load" wording (NOT "failed compliance").
   *     Include a retry button.
   * - "ready": Data is loaded and non-empty. Render the chart.
   */
  state: "loading" | "zero" | "filtered-empty" | "error" | "ready";
  
  /** Chart content (Recharts ResponsiveContainer + BarChart/LineChart/etc). Only rendered when state === "ready". */
  children?: React.ReactNode;
  
  /** For state === "zero": message + optional action button. */
  zeroMessage?: {
    title: React.ReactNode;
    description: React.ReactNode;
    action?: React.ReactNode;
  };
  
  /** For state === "filtered-empty": message + optional action button. Should mention the active filters. */
  filteredEmptyMessage?: {
    title: React.ReactNode;
    description: React.ReactNode;
    action?: React.ReactNode;
  };
  
  /** For state === "error": message + optional retry button. Wording must be "couldn't load" not "failed". */
  errorMessage?: {
    title: React.ReactNode;
    description: React.ReactNode;
    action?: React.ReactNode;
  };
  
  /** For state === "loading": skeleton configuration. Optional; if not provided, renders generic skeleton. */
  loadingState?: {
    /** Number of rows to render in the skeleton (default: 4). */
    rows?: number;
  };
  
  /** Minimum height for the chart container. Defaults to "400px". */
  minHeight?: string;
  
  /** Optional CSS class. */
  className?: string;
}

/**
 * Frame component that wraps a Recharts chart and handles 4 states: loading, zero, filtered-empty, error.
 * Each state renders a distinct message and optional action. When state === "ready", renders children.
 * Loading state uses the Skeleton component (Wave 1, component 4) and renders pulsing rule-colored blocks.
 * Empty states use TableEmptyState + TableFilteredEmptyState (existing in table-states.tsx).
 * Error state uses TableErrorState (existing in table-states.tsx) with "couldn't load" wording.
 */
export function ChartFrame({
  state,
  children,
  zeroMessage,
  filteredEmptyMessage,
  errorMessage,
  loadingState,
  minHeight = "400px",
  className,
}: ChartFrameProps): JSX.Element;
```

**Must reuse**:
- `TableEmptyState`, `TableFilteredEmptyState`, `TableErrorState` from `@/components/ui/table-states` (already exist)
- Skeleton component (Wave 1, component 4) for loading state
- `bg-slab`, `border-rule`, `rounded-[var(--radius)]` for container
- `font-mono` for metadata / labels; `font-sans` for body text
- No new colors; error state reuses `--fail` tokens only

**Acceptance criteria**:
- [ ] ChartFrame renders the correct state based on `state` prop
- [ ] "loading" state uses Skeleton component, not hardcoded `animate-pulse` blocks
- [ ] "zero" and "filtered-empty" render TableEmptyState and TableFilteredEmptyState respectively
- [ ] "error" state uses TableErrorState with "couldn't load" wording (grep for "failed" should not match)
- [ ] Children are only rendered when `state === "ready"`
- [ ] All empty/error states are vertically centered within minHeight
- [ ] No hardcoded colors; border and background use Tailwind tokens

---

## 4. Skeleton (Shared Loading Language)

**File path**: `frontend/src/components/shared/skeleton.tsx`

**Exports**:

```typescript
interface SkeletonProps extends React.ComponentProps<"div"> {
  /**
   * Height of the skeleton bar. Defaults to "1em" (matches body text height).
   * Can be "sm" (5px, matches tree-row meter), "md" (8px), "lg" (16px).
   */
  height?: "sm" | "md" | "lg" | string;
  
  /**
   * Width as a CSS value or preset. Defaults to "100%".
   * Can be a number (0–100) for percentage, or any CSS width value.
   */
  width?: number | string;
  
  /** If true, skeleton pulses. Default: true. */
  animate?: boolean;
  
  /** Optional CSS class for additional styling. */
  className?: string;
}

/**
 * Single pulsing placeholder bar. Used in loading states for tree rows, table rows,
 * and charts. All skeletons share the same visual language: `bg-rule` color, 3px radius,
 * gentle pulse animation. Height and width are configurable presets.
 * 
 * Usage in a row: <Skeleton height="sm" width="40%" /> <Skeleton height="sm" width="20%" />
 * Usage in a ledger: <Skeleton height="lg" width="80px" />
 */
export function Skeleton({
  height = "1em",
  width = "100%",
  animate = true,
  className,
  ...props
}: SkeletonProps): JSX.Element;

interface SkeletonRowProps extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * Number of skeleton bars to render in this row. Defaults to 3.
   */
  cellCount?: number;
  
  /**
   * Widths for each skeleton bar as an array of percentages or CSS values.
   * If not provided, all bars are equally sized.
   */
  cellWidths?: (number | string)[];
  
  /**
   * Height for all bars in this row. Defaults to "md" (8px).
   */
  height?: "sm" | "md" | "lg" | string;
  
  /** If true, all bars pulse in sync. Default: true. */
  animate?: boolean;
  
  /** Optional CSS class. */
  className?: string;
}

/**
 * Helper: renders a row of skeleton bars with configurable cell count and widths.
 * Used to mock table/tree rows during loading.
 */
export function SkeletonRow({
  cellCount = 3,
  cellWidths,
  height = "md",
  animate = true,
  className,
  ...props
}: SkeletonRowProps): JSX.Element;
```

**Must reuse**:
- `bg-rule` (hairline divider color) for the skeleton bar fill
- `rounded-[var(--radius)]` for skeleton radius (3px, no exceptions)
- `animate-pulse` Tailwind class for animation (already in Tailwind config)
- No new colors; skeleton is always neutral `--rule` tone
- No opacity fills (`bg-slab-2/50` etc) — solid `bg-rule` only

**Acceptance criteria**:
- [ ] All skeletons use `bg-rule` exactly; no `bg-slab-2`, no opacity variants
- [ ] Skeleton pulses smoothly at a reasonable frequency (Tailwind's `animate-pulse` is fine)
- [ ] SkeletonRow renders bars with consistent height, spaced with a small gap
- [ ] Skeleton matches loaded row height exactly (5px for tree meter, 8px for table row, 16px for ledger number)
- [ ] All skeletons use `rounded-[var(--radius)]` (3px), no exceptions
- [ ] No shadows, no filters, no complex CSS — solid bar + pulse only

---

## 5. ImpactStrip + ConsequenceRail

**File path**: `frontend/src/components/shared/impact-strip.tsx` (ImpactStrip), `frontend/src/components/shared/consequence-rail.tsx` (ConsequenceRail)

**Exports**:

```typescript
interface ImpactStripProps extends React.ComponentProps<"div"> {
  /**
   * Main impact number. E.g., 3 (number of pending exceptions).
   * Rendered at 30px font-weight 700, mono font family, tabular-nums.
   */
  impactCount: number;
  
  /**
   * Label for the impact count. E.g., "Awaiting you".
   * Rendered at 9.5px mono, uppercase, tracked, faint color.
   */
  impactLabel: React.ReactNode;
  
  /**
   * Delta display: e.g., "45% → 52%". Rendered as a single line next to the impact number.
   * Two numbers separated by →, displayed at 30px mono 700 weight.
   * Both numbers should be inline; smaller "%" symbol at ~15px.
   */
  deltaDisplay: React.ReactNode;
  
  /**
   * Subtext for the delta (e.g., "If all three approved").
   * Rendered at 9.5px mono, uppercase, tracked, faint color.
   */
  deltaLabel?: React.ReactNode;
  
  /**
   * Main message explaining the consequence (e.g., "Approving all pending requests would take 3 runs...").
   * Rendered at 12.5px, text-mute, max-width 65 characters.
   * Can include bold spans (<b>) for emphasis.
   * Should end with a period and a statement like "Nothing is recalculated until you decide."
   */
  message: React.ReactNode;
  
  /** Optional CSS class. */
  className?: string;
}

/**
 * Disclosure banner displayed at the top of decision flows (Exceptions page, MyTasks submit drawer).
 * Communicates the arithmetic impact of a pending decision before the user commits.
 * Structure: left-aligned big impact number + eyebrow, beside a delta (before → after),
 * and a message explaining the consequence.
 * 
 * Visual: 2px left border-stroke in --waive (violet), bg-slab, border-rule border,
 * 3px radius. Layout is flex row with gap-22 (22px spacing) between impact, delta, and message blocks.
 * 
 * Example: "Approving the 3 pending exceptions above would change the score from 45% to 52%.
 * If all approved, 3 runs are removed from the denominator. Nothing is recalculated until you decide."
 */
export function ImpactStrip({
  impactCount,
  impactLabel,
  deltaDisplay,
  deltaLabel,
  message,
  className,
  ...props
}: ImpactStripProps): JSX.Element;

interface ConsequenceCard {
  /** Unique key for this card section. */
  key: string;
  /** Title of the card. Rendered at 13px mono 600 weight. */
  title: React.ReactNode;
  /** Card content. Rendered at body text size. */
  children: React.ReactNode;
}

interface ConsequenceRailProps extends React.ComponentProps<"aside"> {
  /**
   * Array of card sections. Each renders as a SectionCard (from component 1) with title + content.
   * Standard three cards: "What changed", "Likely effect", "Applies to".
   * Cards render vertically stacked with gap-3 (12px).
   */
  cards: ConsequenceCard[];
  
  /**
   * Sticky footer text. E.g., "Publishing starts v5 from tomorrow's 03:00 run. Runs already open finish on v4."
   * Rendered at 11.5px, text-mute, with inline <b> for emphasis.
   */
  footerText?: React.ReactNode;
  
  /**
   * Array of footer buttons. Primary button first (publish/save), secondary button second (save draft/cancel).
   * Passed as React elements (e.g., [<Button variant="primary">Publish</Button>, <Button>Save draft</Button>]).
   */
  footerActions?: React.ReactNode[];
  
  /** Optional CSS class. */
  className?: string;
}

/**
 * Right-hand sticky panel used during draft editing (Templates edit page).
 * Renders stacked SectionCard components for "What changed", "Likely effect", and "Applies to".
 * Footer is sticky to the bottom of the rail and contains publication info + action buttons.
 * 
 * Layout: aside with border-left border-rule, 330px fixed width, bg-slab, right side of a two-column grid.
 * Content cards use SectionCard (component 1). Footer is flex row with gap-2 (8px) for buttons.
 * 
 * Usage: Wrap the main editor on the left with ConsequenceRail on the right in a grid container.
 * Rail padding is 20px top/bottom, 18px left/right.
 */
export function ConsequenceRail({
  cards,
  footerText,
  footerActions,
  className,
  ...props
}: ConsequenceRailProps): JSX.Element;
```

**Must reuse**:
- ImpactStrip: `border-l-[2px] border-l-waive` for left stroke (waive color only)
- ImpactStrip: `bg-slab`, `border-rule`, `rounded-[var(--radius)]`
- ImpactStrip: `font-mono text-[30px] font-bold tabular-nums` for impact/delta numbers
- ImpactStrip: `font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint` for labels
- ImpactStrip: `text-[12.5px] text-mute` for main message; allow inline `<b>` for emphasis
- ConsequenceRail: SectionCard component (component 1) for each card
- ConsequenceRail: `bg-slab`, `border-l border-rule`, fixed 330px width
- ConsequenceRail: All text uses existing token colors; no new colors

**Acceptance criteria**:
- [ ] ImpactStrip left border is exactly 2px and uses `--waive` color (violet)
- [ ] ImpactStrip layout is flex row with impact + delta + message blocks, not vertical stack
- [ ] ImpactStrip numbers (impact/delta) use `font-mono` and `tabular-nums`
- [ ] ImpactStrip message ends with "Nothing is recalculated until you decide" or similar statement
- [ ] ConsequenceRail is positioned as a sticky right panel at 330px width
- [ ] ConsequenceRail footer is sticky and does not scroll with card content
- [ ] ConsequenceRail uses SectionCard components (not custom card styling) for each section
- [ ] No hardcoded colors in either component; all use CSS token variables

---

## 6. AppChrome Changes (Sidebar + Topbar + AppLayout modifications)

### 6a. Sidebar Changes

**File path**: `frontend/src/components/layout/Sidebar.tsx` (existing file, modified)

**Interface changes**:

```typescript
interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  forceExpanded?: boolean;
  onNavigate?: () => void;
  // NEW: Current user information for footer rendering
  currentUser?: {
    name?: string;
    role?: string;
    avatarUrl?: string;
  };
  // NEW: Logout callback
  onLogout?: () => Promise<void>;
}
```

**Specific changes to make**:
1. **Move user identity block to sidebar footer** (currently in Topbar, line 48–57 of Topbar.tsx). Footer should display avatar (6×6 or 8×8), user name (xs text), and role (10px faint text).
2. **Remove the notification bell from sidebar footer** (currently at line 127–129 of Sidebar.tsx). Bell moves to Topbar (component 6b).
3. **Collapse control remains in sidebar footer** but is visually corrected: ensure it is vertically centered and horizontally aligned with the rail edge (currently it's full-width, which looks odd at 52px width).
4. **Search field stays in sidebar** (when expanded) but now is wired to a live callback (see Topbar change below).
5. **Read `useAuth()` directly** for currentUser and logout (existing pattern in the codebase). Do not add props unless specified; prefer `useAuth()` hook.

**Acceptance criteria**:
- [ ] User identity block (avatar + name + role) is in sidebar footer, not Topbar
- [ ] Logout is triggered via Sidebar (user clicks a logout action in the footer identity block, or it's part of a user menu within the footer)
- [ ] Notification bell is removed from Sidebar (moved to Topbar)
- [ ] Search field is disabled/read-only in this version (wiring comes in Wave 3); it should not disappear when collapsed
- [ ] Collapse control is centered on the rail edge at 52px width
- [ ] No new colors or radius rules; all styling uses existing tokens

### 6b. Topbar Changes

**File path**: `frontend/src/components/layout/Topbar.tsx` (existing file, modified)

**Interface changes**:

```typescript
interface TopbarProps {
  onOpenMobileNav?: () => void;
  // NEW: Notification badge/icon management
  notificationCount?: number;
  onNotificationClick?: () => void;
}
```

**Specific changes to make**:
1. **Add notification bell to topbar** (right side, to the left of the user menu). Bell should show a badge with count if `notificationCount > 0`. Badge renders as a small circle with white text on `--fail` background (for visibility).
2. **Remove the breadcrumb/page-name section** (currently at line 24–42). Instead of "Pulse / Tasks", the Topbar should be reshaped as:
   - Left: mobile menu button (hamburger icon)
   - Center: [empty or reserved for future scope/action controls per DESIGN.md]
   - Right: notification bell (NEW) + user menu (keep as-is, but move identity to Sidebar per 6a)
3. **User menu: remove the identity block** (avatar + name + role) from the user menu dropdown since it now lives in Sidebar footer. Keep theme toggle and logout in the dropdown.
4. **Topbar height and styling**: keep 12/48px (existing), 1px bottom border, no changes to bg/border colors.

**Acceptance criteria**:
- [ ] Notification bell appears in Topbar right side
- [ ] Bell shows a badge (small circle, fail-colored) only if `notificationCount > 0`
- [ ] Bell is clickable; calls `onNotificationClick()` callback
- [ ] Breadcrumb "Pulse / Tasks" is removed; Topbar is now cleaner (left: menu, right: bell + user menu)
- [ ] User dropdown menu no longer shows identity block (that's in Sidebar)
- [ ] All Topbar elements align vertically and horizontally with no inconsistent centering
- [ ] No hardcoded colors; all use Tailwind tokens

### 6c. AppLayout Changes

**File path**: `frontend/src/components/layout/AppLayout.tsx` (existing file, modified)

**Interface changes**: No new props needed.

**Specific changes to make**:
1. **Update Topbar props**: Pass `notificationCount` and `onNotificationClick` to Topbar (initially can be hardcoded as 0 and no-op; Wave 3 will wire the real notification flow).
2. **Update Sidebar props**: Sidebar now reads `useAuth()` directly (no new props required). Ensure the identity block in Sidebar footer calls `logout()` correctly.
3. **Verify the two-column grid layout** is preserved: sidebar (collapsible, md+ inline, mobile drawer) + main content area.
4. **No grid changes** — the existing layout is correct; this is just a cleanup of what lives in each area.

**Acceptance criteria**:
- [ ] Topbar receives and displays `notificationCount` (even if hardcoded to 0 initially)
- [ ] Sidebar footer displays user identity (read from `useAuth()`)
- [ ] Sidebar footer has a logout button or link that calls `useAuth().logout()`
- [ ] Mobile drawer still works; all changes are responsive-safe
- [ ] No layout jank; sidebar collapse/expand is smooth and does not trigger re-layouts

---

## Integration Notes

### File Structure

New files under `frontend/src/components/`:
```
components/
├── shared/
│   ├── page-shell.tsx          (Component 1)
│   ├── stat-tile.tsx           (Component 2)
│   ├── period-toggle.tsx       (Component 2)
│   ├── filter-bar.tsx          (Component 2)
│   ├── chart-frame.tsx         (Component 3)
│   ├── skeleton.tsx            (Component 4)
│   ├── impact-strip.tsx        (Component 5)
│   └── consequence-rail.tsx    (Component 5)
└── layout/
    ├── Sidebar.tsx             (Component 6a, modified)
    ├── Topbar.tsx              (Component 6b, modified)
    └── AppLayout.tsx           (Component 6c, modified)
```

### Hook Usage

Prefer reading hooks directly (following the existing codebase pattern):
- `useAuth()` from `@/store/AuthContext` — use in Sidebar footer, Topbar user menu
- `useToast()` from `@/store/ToastContext` — available for any component that needs to show feedback
- Do NOT prop-drill these; components call the hooks directly

### Token/Color Reference

All components MUST use only these tokens (no new colors, no exceptions):

**Surfaces**: `--ink`, `--slab`, `--slab-2`, `--rule`, `--rule-2`
**Text**: `--text`, `--mute`, `--faint`
**Status**: `--pass`, `--risk`, `--fail`, `--waive`, `--none-status`, `--sel`
**Tinted fills**: `--fail-bg`, `--fail-bd`, `--risk-bg`, `--risk-bd`, `--waive-bg`, `--waive-bd`

**Radius**: ALWAYS `rounded-[var(--radius)]` (3px). Never `rounded-lg`, `rounded-md`, `rounded-xl`, `rounded-sm`.

**Typography**:
- Display/title: `font-sans font-bold text-[26px] md:text-[34px] tracking-tight`
- Eyebrow/label: `font-mono text-[10.5px] uppercase tracking-[0.09em]`
- Body: `font-sans text-[12.5px] text-mute`
- Mono value: `font-mono text-[11px] md:text-[16px] tabular-nums`

### Existing Primitives (Do Not Modify)

These components already exist and must be reused as-is:
- `Card`, `CardHeader`, `CardContent`, `CardFooter`, `CardTitle` from `@/components/ui/card`
- `Badge` from `@/components/ui/badge`
- `Meter` from `@/components/ui/meter`
- `StatusChip` from `@/components/ui/status-chip`
- `StatusStrokeCard` from `@/components/ui/status-stroke-card`
- `Ledger` from `@/components/ui/ledger`
- `Disclosure` from `@/components/ui/disclosure`
- `TableEmptyState`, `TableFilteredEmptyState`, `TableErrorState` from `@/components/ui/table-states`
- `Button` from `@/components/ui/button`
- `Avatar` from `@/components/ui/avatar`

---

## Testing & Verification

**Before marking Wave 1 complete**:
1. All 6 components export the exact interfaces specified above
2. All components use only tokens/classes from the closed set (no new Tailwind classes, no new colors)
3. TypeScript: `yarn typecheck` passes with no errors
4. Linting: `yarn lint` passes with no errors
5. Each component compiles in isolation and alongside existing pages
6. Visual: screenshot each component in both light and dark theme at desktop/mobile breakpoints
7. Accessibility: all interactive elements (buttons, toggles, disclosure) are keyboard-accessible and labeled

**Red flags** (reject if found):
- Component uses `rounded-lg`, `rounded-md`, `rounded-xl` anywhere
- Component uses `bg-pass/10`, `bg-risk/10`, or other opacity-fill classes
- Component uses inline style attributes for colors/spacing
- ChartFrame "ready" state shows Recharts chart with non-zero data but the chart is empty (missing guard on `data.length === 0`)
- ImpactStrip or ConsequenceRail uses a right border instead of a left border, or uses `--sel` instead of `--waive`
- Sidebar has the notification bell still present; Topbar does not have a bell
- User identity is still in Topbar right-side dropdown; it should be in Sidebar footer only

---

## Wave 1 → Wave 2 Handoff

After Wave 1 is complete, all 6 components are frozen and exported from their file paths. Wave 2 agents (one per page) will:
1. Import all Wave 1 components
2. Replace hand-rolled empty states with ChartFrame + Skeleton
3. Replace opacity-fill status backgrounds with StatusStrokeCard
4. Wrap page content in PageShell + PageHeader + SectionCard
5. Replace period toggles and KPI tiles with PeriodToggle + StatTile
6. Replace filters with FilterBar
7. No modifications to Wave 1 component internals; only usage/composition changes

---

## Revision History

- **v1.0** (2025-08-28): Initial contract frozen. All 6 Wave 1 components specified with exact TypeScript signatures, token reuse rules, and acceptance criteria.
