# Mobile Responsive Redesign — Implementation Plan

## Current State

The Pulse app is **desktop-first** with minimal responsive handling. Key problems:

- **Sidebar is always visible** — no mobile hamburger/drawer/bottom nav
- **Tables force horizontal scroll** — Team page has 5-7 columns with no mobile card alternative
- **Operations tree has `min-w-[600px]`** — guaranteed horizontal scroll on phones
- **Gauge component at 220px** — too large alongside side-by-side text on small screens
- **Dashboard hero card uses `flex items-center gap-12`** — gauge + text side by side, breaks on narrow screens
- **Sheet modals (Checklist Runner, Template viewer)** use fixed widths (`sm:max-w-md`, `w-[500px] sm:w-[640px]`)
- **Login redirect page** has no mobile-specific styling
- **No bottom navigation** — phone users have no way to navigate between pages

---

## Plan — 8 Steps

### Step 1: Mobile Navigation — Hide Sidebar + Add Bottom Tab Bar

**Files:** `AppLayout.tsx`, `Sidebar.tsx`, new `BottomNav.tsx`

- Hide `<Sidebar>` on screens below `md` (768px) using `hidden md:flex`
- Create a `<BottomNav>` component:
  - Fixed to bottom of viewport (`fixed bottom-0 left-0 right-0`)
  - Shows role-filtered nav items as icon + small label (like iOS tab bar)
  - Highlights active route with indigo accent
  - Uses `safe-area-inset-bottom` for notched phones
  - Only visible on `md:hidden`
- In `AppLayout.tsx`:
  - Add `pb-16 md:pb-0` to main content area to account for bottom nav height
  - Sidebar remains for `md+` screens unchanged

---

### Step 2: Topbar — Mobile-Friendly Header

**Files:** `Topbar.tsx`, `AppLayout.tsx`

- Add a hamburger/menu icon on the left for `md:hidden` that opens a slide-over drawer with full nav (optional — bottom nav may suffice)
- Reduce horizontal padding on mobile: `px-4 md:px-6`
- Keep page name visible, hide "Pulse /" breadcrumb prefix on mobile (already done with `hidden sm:block`)
- Ensure user avatar + name don't overflow — hide name on very small screens, show avatar only

---

### Step 3: Dashboard — Stack Gauge Card Vertically on Mobile

**Files:** `Dashboard.tsx`

- The hero card (gauge + execution health text) currently uses `flex items-center gap-12`:
  - Change to `flex flex-col items-center md:flex-row md:items-center gap-6 md:gap-12`
  - On mobile: gauge centered on top, text/stats below
- Reduce gauge `size` on mobile: pass `size={160}` on `< md`, `size={220}` on `md+`
  - Use a custom hook or inline responsive logic
- Stat cards (`Own Execution`, `Team Roll-up`): change `md:grid-cols-3` layout to stack on mobile
  - On mobile: gauge card full width, stat cards in 2-col grid below
- Period selector (`Day/Week/Month`): already wraps with `flex-col sm:flex-row` — OK
- Bar chart: `ResponsiveContainer` handles width, reduce `h-[300px]` to `h-[220px]` on mobile
- Failure points cards: already stack vertically — OK

---

### Step 4: My Tasks & Checklist Runner — Full-Screen Mobile Sheet

**Files:** `MyTasks.tsx`

- **Run cards**: Already mostly OK (progress bar hidden on `sm:` breakpoint)
  - Reduce `gap-4` to `gap-3` on mobile, reduce padding
- **ChecklistRunner Sheet**:
  - Change `sm:max-w-md` to full-screen on mobile: use `w-full h-full sm:max-w-md` or Shadcn's `side="bottom"` on mobile
  - On mobile (`< sm`), make the sheet take `100vh` — behaves like a native full-screen form
  - Reduce header padding: `p-4 sm:p-6`
  - Checklist items: reduce `gap-4` to `gap-3`, `p-3 sm:p-4`
  - Submit button footer: ensure it's sticky and above the bottom nav (`pb-safe` or `mb-16 md:mb-0`)
  - Touch-friendly checkbox targets: ensure min 44px tap area

---

### Step 5: Team Page — Card Layout on Mobile Instead of Table

**Files:** `Team.tsx`

- **My Team tab**: On mobile (`< md`), replace the `<Table>` with stacked cards:
  - Each card shows: avatar + name, role badge, score indicators
  - Use `hidden md:block` for the table, `md:hidden` for the cards
  - Cards are clickable with the same navigate behavior
- **All Teams tab**: Same approach — card-based on mobile
  - Show name, role, combined score on card; hide department/branch to save space or show as secondary text
- **Controls row**: Tab switcher + period selector — wrap to two rows on mobile:
  - `flex flex-col gap-2 sm:flex-row sm:items-center`
  - Each button group takes full width on mobile

---

### Step 6: Operations Tree — Simplified Mobile Layout

**Files:** `Operations.tsx`

- Remove `min-w-[600px]` constraint
- Remove `min-w-max` from `OperationNode`
- On mobile:
  - Reduce left indentation per level: `level * 1.25rem` instead of `level * 2rem`
  - Hide "Own Score" column, show only "Combined KPI" badge
  - Truncate name to available width
  - Reduce avatar size from `h-8 w-8` to `h-7 w-7`
  - Score display: stack vertically or show single combined badge only
- The tree lines (border-l/border-t connectors): simplify or hide on mobile for cleaner look

---

### Step 7: Templates Page & Sheet — Responsive Grid + Full-Width Sheet

**Files:** `Templates.tsx`

- Template grid: already has `md:grid-cols-2 lg:grid-cols-3` — add `grid-cols-1` base (already implied) — OK
- Header row: "Create Template" button — on mobile, use icon-only or stack below heading
  - `flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center`
- **Template detail Sheet**:
  - Change fixed `w-[500px] sm:w-[640px]` to responsive: `w-full sm:w-[640px]`
  - On mobile, sheet takes full width
  - Reduce padding: `p-4 sm:p-8`
  - Signature grid at bottom: `grid-cols-1 sm:grid-cols-2` on mobile
  - Print button: hide on mobile or keep as secondary action

---

### Step 8: Global Spacing, Scaling & Viewport Meta

**Files:** `index.css`, `AppLayout.tsx`, `index.html`

- Ensure `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` is set in `index.html`
- Reduce main content padding on mobile: `p-3 sm:p-6 md:p-8 lg:p-10` (currently `p-6 md:p-8 lg:p-10`)
- Page titles: `text-2xl sm:text-3xl` instead of fixed `text-3xl`
- Add `overflow-x-hidden` to prevent any accidental horizontal scroll on body/main
- Ensure `max-w-6xl` container doesn't add unnecessary side gutters on mobile
- Login page: add proper mobile padding, larger tap target for login link

---

## Implementation Order

1. **Step 1** (Bottom Nav + Hide Sidebar) — foundational, everything else depends on navigation working
2. **Step 8** (Global spacing/viewport) — sets the stage for all screens
3. **Step 2** (Topbar) — completes the navigation/chrome layer
4. **Step 3** (Dashboard) — most-visited screen, gauge scaling
5. **Step 4** (My Tasks / Checklist) — primary mobile use case for field staff
6. **Step 5** (Team) — table-to-card conversion
7. **Step 6** (Operations) — tree simplification
8. **Step 7** (Templates) — sheet width fix

---

## Design Principles

- **No horizontal scroll anywhere** — every screen must fit within viewport width
- **Touch-friendly** — minimum 44px tap targets for all interactive elements
- **Bottom nav pattern** — standard mobile app UX, keeps thumb accessible
- **Full-screen sheets on mobile** — checklist runner and template viewer become full-page overlays
- **Progressive disclosure** — show less data on mobile (e.g., fewer table columns), user taps for detail
- **Dark theme maintained** — all mobile styles stay within the existing zinc/indigo palette
- **No new dependencies** — pure Tailwind responsive utilities + existing Shadcn components
