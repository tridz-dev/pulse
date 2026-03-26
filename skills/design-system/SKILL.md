---
name: design-system
description: >
  UI component library, theming, and styling patterns for Pulse. Covers Tailwind CSS 4, 
  shadcn/ui components, custom components like Gauge, and the overall visual language. 
  Consult when building new UI, modifying components, or adding theme support.
category: design-system
---

# Design System

## Overview

Pulse uses a modern React component architecture with Tailwind CSS 4 for styling, shadcn/ui for base components, and custom components for domain-specific visualizations like the Gauge score indicator.

The design prioritizes:
- **Clarity:** Operational data must be scannable at a glance
- **Hierarchy:** Role-based views with progressive disclosure
- **Performance:** Minimal bundle, requestAnimationFrame for animations

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/index.css` | Tailwind imports, CSS variables, base styles |
| `frontend/tailwind.config.ts` | Theme tokens, color palette, font configuration |
| `frontend/src/components/ui/` | shadcn/ui base components (button, card, dialog, etc.) |
| `frontend/src/components/shared/Gauge.tsx` | Custom SVG score gauge with needle animation |
| `frontend/src/components/layout/AppLayout.tsx` | App shell with sidebar + topbar |
| `frontend/src/components/layout/Sidebar.tsx` | Role-aware navigation |
| `frontend/src/lib/utils.ts` | cn() utility for class merging |

## How It Works

### 1. Tailwind CSS 4 Setup

Tailwind 4 uses CSS-first configuration via `@import`:

```css
/* index.css */
@import "tailwindcss";
@import "./theme.css";  /* Custom theme variables */

@theme {
  --font-sans: "Geist Variable", system-ui, sans-serif;
  --font-mono: "DM Mono", monospace;
}
```

### 2. shadcn/ui Components

Components are installed via CLI and stored in `components/ui/`:

```bash
npx shadcn add button card dialog dropdown-menu
```

Each component:
- Uses Tailwind for styling
- Supports `className` prop for overrides
- Follows Radix UI primitives for accessibility
- Uses `cn()` utility for conditional classes

### 3. Custom Domain Components

#### Gauge (`components/shared/Gauge.tsx`)

SVG-based score visualization with animated needle:

```tsx
<Gauge 
  value={0.85}      # 0-1 score
  size={200}        # Pixel diameter
  showLabel={true}  # Show percentage text
/>
```

Uses `requestAnimationFrame` for smooth needle movement. Color bands:
- Green: ≥ 80%
- Amber: 60-79%
- Red: < 60%

#### ScoreBreakdown (`components/shared/ScoreBreakdown.tsx`)

Slide-over panel showing per-template run breakdown:
- Triggered from Dashboard or UserProfile
- Groups runs by SOP template
- Shows completion counts and scores

### 4. Layout System

```
AppLayout
├── Topbar (mobile menu toggle, notifications, user)
├── Sidebar (role-aware nav)
│   ├── Dashboard
│   ├── My Tasks
│   ├── Team (Manager+)
│   ├── Operations (Leader+)
│   ├── Insights (Leader+)
│   └── Templates
└── Main Content (Outlet for React Router)
```

### 5. Theme & Typography

**Fonts:**
- **Geist Variable:** Body text, UI elements (variable weight 100-900)
- **DM Mono:** Metrics, scores, data displays

**Color Palette:**
- Primary: Indigo/blue for interactive elements
- Success: Green for good scores, completions
- Warning: Amber for at-risk scores
- Danger: Red for critical scores, missed items
- Neutral: Slate/grayscale for UI chrome

## Extension Points

### Adding a New shadcn Component

```bash
cd frontend
npx shadcn add <component-name>
```

Import and use in your component:
```tsx
import { Button } from "@/components/ui/button";
<Button variant="default" size="sm">Click</Button>
```

### Customizing Theme Tokens

Edit `frontend/tailwind.config.ts`:
```ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4f46e5",
          foreground: "#ffffff",
        },
      },
    },
  },
};
```

### Creating a New Shared Component

1. Create file in `frontend/src/components/shared/`
2. Export from `frontend/src/components/shared/index.ts`
3. Include JSDoc with usage example
4. Add to this skill doc's Key Files table

## Dependencies

- **Tailwind CSS 4** — Utility-first styling
- **shadcn/ui** — Component primitives (built on Radix UI)
- **Lucide React** — Icon library
- **class-variance-authority** — Component variant management
- **clsx + tailwind-merge** — Class name utilities

## Gotchas

1. **Tailwind 4 Changes:** Tailwind 4 is significantly different from v3. Uses CSS imports instead of JS config. Don't use `@tailwind` directives.

2. **shadcn CLI:** The CLI modifies files in place. Commit before running `shadcn add` to see what changed.

3. **Gauge Performance:** The Gauge uses `requestAnimationFrame`. Don't render hundreds simultaneously — use static indicators for list views.

4. **Dark Mode:** Not yet implemented. The `cn()` utility supports `dark:` prefixes but no theme toggle exists.

5. **Font Loading:** Geist Variable is loaded from `public/fonts/`. Check network tab if fonts appear wrong.

6. **Mobile Sidebar:** The Sidebar transforms into a drawer on mobile. Test touch interactions when modifying navigation.
