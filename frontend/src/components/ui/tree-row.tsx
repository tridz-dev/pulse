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
  /** Nesting level: 0 (default, top-level) or 1 (nested under parent). Level 1 renders an indent rail. */
  level?: 0 | 1
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
  /** Callback when toggle is clicked (only used if expanded is defined). */
  onToggle?: () => void
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
  loading,
  className,
  ...props
}: TreeRowProps) {
  // Determine if this is an interactive row (expandable) and if it's empty (null score, no toggle)
  const isInteractive = expanded !== undefined
  const isEmpty = score === null
  const isLeaf = !isInteractive

  // Score color logic: < 50 = fail, >= 80 = pass, else default
  const scoreColor = score === null ? "text-faint" : score < 50 ? "text-fail" : score >= 80 ? "text-pass" : "text-text"

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
      onClick={isInteractive ? onToggle : undefined}
      disabled={loading}
      {...props}
    >
      {/* Name column: toggle glyph + indent rail + name + tag */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Toggle glyph (+/−) — only shown if expandable */}
        {isInteractive && (
          <span className="font-mono text-xs font-medium text-faint" aria-hidden="true">
            {expanded ? "−" : "+"}
          </span>
        )}

        {/* Indent rail (13px wide) — only shown at level 1 */}
        {level === 1 && <div className="h-7 w-[13px] flex-none border-l border-rule-2" />}

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
