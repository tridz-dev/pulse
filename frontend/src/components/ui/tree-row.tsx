"use client"

import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const treeRowVariants = cva(
  "w-full text-left transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      interactive: {
        true: "cursor-pointer hover:bg-slab-2",
        false: "",
      },
      empty: {
        true: "opacity-70",
        false: "",
      },
    },
  }
)

interface TreeRowProps extends Omit<React.ComponentPropsWithoutRef<"button">, "name"> {
  /** Nesting level: 0 (top-level) or any positive integer for deeper descendants.
   *  Renders one indent rail per level, so depth scales visually instead of clamping at 1. */
  level?: number
  /** Row name/label — required. */
  name: React.ReactNode
  /** Optional small mono badge (e.g., "3 SOPs") positioned after the name. */
  tag?: React.ReactNode
  /** Compliance score. Null renders "—" in text-faint; number renders in font-mono with color based on thresholds:
   *  < 50 → text-fail, >= 80 → text-pass, otherwise text-text. */
  score: number | null
  /** Optional segmented meter segments for composition breakdown (pass/fail/none).
   *  Each segment: { value: number (for flex-grow), className: color class (e.g., "bg-pass") } */
  meter?: { value: number; className: string }[]
  /** If true, row is expandable; renders +/− toggle glyph. If false/omitted, renders as leaf. */
  expanded?: boolean
  /** Callback when the +/− toggle glyph is clicked (only used if expanded is defined).
   *  When `onDrillDown` is also provided, the toggle glyph becomes its own click zone so this
   *  fires only from the glyph, not from clicking anywhere else on the row. */
  onToggle?: () => void
  /** Optional callback for drilling into a row's detail view. When provided alongside `expanded`,
   *  the row is split into two independent click zones: the +/− glyph (calls `onToggle`) and the
   *  rest of the row (calls `onDrillDown`). Omit it to keep the legacy behavior where clicking
   *  anywhere on an expandable row just toggles it. */
  onDrillDown?: () => void
  /** If true, render a pulsing skeleton instead of content. */
  loading?: boolean
  /** Custom CSS class for the row. */
  className?: string
}

function TreeRow({
  level = 0,
  name,
  tag,
  score,
  meter,
  expanded,
  onToggle,
  onDrillDown,
  loading,
  className,
  onClick,
  ...props
}: TreeRowProps) {
  // Determine if this is an interactive row (expandable) and if it's empty (null score, no toggle)
  const isInteractive = expanded !== undefined
  const isEmpty = score === null
  const isLeaf = !isInteractive
  // Once a separate drill-down callback exists, the toggle glyph becomes its own click zone
  // and must not also fire from a click on the rest of the row.
  const hasSplitZones = isInteractive && !!onDrillDown

  // Score color logic: < 50 = fail, >= 80 = pass, else default
  const scoreColor = score === null ? "text-faint" : score < 50 ? "text-fail" : score >= 80 ? "text-pass" : "text-text"

  // Row-level click: drill down when available, otherwise fall back to the legacy
  // toggle-on-click behavior, otherwise whatever onClick the caller passed in (leaf rows).
  const handleRowClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (loading) return
    if (isInteractive) {
      if (hasSplitZones) {
        onDrillDown?.()
      } else {
        onToggle?.()
      }
      return
    }
    onClick?.(e)
  }

  const handleToggleClick: React.MouseEventHandler<HTMLSpanElement> = (e) => {
    e.stopPropagation()
    onToggle?.()
  }

  return (
    <button
      data-slot="tree-row"
      type="button"
      className={cn(
        "grid gap-3 border-b border-rule px-3 py-2 text-sm font-medium",
        "[grid-template-columns:1fr_60px_100px] items-center",
        treeRowVariants({ interactive: isInteractive, empty: isLeaf && isEmpty }),
        className
      )}
      onClick={handleRowClick}
      disabled={loading}
      {...props}
    >
      {/* Name column: toggle glyph + indent rail + name + tag */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Toggle glyph (+/−) — only shown if expandable. Becomes its own click zone (via
            role="button" + stopPropagation) once `onDrillDown` is provided, so toggling and
            drilling down are unambiguous, independently discoverable actions. */}
        {isInteractive && (
          <span
            role={hasSplitZones ? "button" : undefined}
            tabIndex={hasSplitZones ? 0 : undefined}
            onClick={hasSplitZones ? handleToggleClick : undefined}
            onKeyDown={
              hasSplitZones
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      handleToggleClick(e as unknown as React.MouseEvent<HTMLSpanElement>)
                    }
                  }
                : undefined
            }
            className={cn(
              "font-mono text-xs font-medium text-faint",
              hasSplitZones && "cursor-pointer px-1 -mx-1 hover:text-text"
            )}
            aria-hidden={hasSplitZones ? undefined : true}
            aria-label={hasSplitZones ? (expanded ? "Collapse" : "Expand") : undefined}
          >
            {expanded ? "−" : "+"}
          </span>
        )}

        {/* Indent rails (13px wide each) — one per nesting level, so depth beyond 1 keeps
            rendering a visually distinct, scaling indent instead of clamping. */}
        {Array.from({ length: Math.max(level, 0) }).map((_, i) => (
          <div key={i} className="h-7 w-[13px] flex-none border-l border-rule-2" />
        ))}

        {/* Name text */}
        {loading ? (
          <div className="h-2 w-24 animate-pulse rounded-sm bg-rule" />
        ) : (
          <span className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-text">{name}</span>
        )}

        {/* Tag badge */}
        {tag && !loading && (
          <span className="font-mono text-xs font-medium text-faint border border-rule rounded-sm px-1 flex-none">
            {tag}
          </span>
        )}
      </div>

      {/* Score column — right-aligned */}
      <div className={cn("font-mono text-sm font-medium text-right tabular-nums", scoreColor)}>
        {loading ? (
          <div className="h-3 w-8 animate-pulse rounded-sm bg-rule ml-auto" />
        ) : score === null ? (
          "—"
        ) : (
          `${score}%`
        )}
      </div>

      {/* Meter column — segmented bar (5px tall), right-aligned */}
      {meter && meter.length > 0 && !loading ? (
        <div className="flex gap-px h-[5px] rounded-sm overflow-hidden justify-end">
          {meter.map((segment, idx) => (
            <div key={idx} className={cn("block flex-grow", segment.className)} style={{ flex: segment.value }} />
          ))}
        </div>
      ) : loading ? (
        <div className="h-[5px] w-16 animate-pulse rounded-sm bg-rule ml-auto" />
      ) : null}
    </button>
  )
}

/**
 * TreeRowGroup: wrapper for a list of TreeRow children with hairline dividers.
 * Applies divide-y divide-rule styling automatically.
 */
function TreeRowGroup({ className, children, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="tree-row-group"
      className={cn("w-full divide-y divide-rule border border-rule rounded overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { TreeRow, TreeRowGroup }
