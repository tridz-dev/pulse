import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface FilterChip {
  /** Unique identifier for this filter value. */
  id: string
  /** Display label (shown in the chip). */
  label: React.ReactNode
}

interface FilterBarProps {
  /** Array of active filters. Each chip is removable. */
  filters: FilterChip[]
  /** Called when user clicks the X on a chip to remove it. */
  onRemoveFilter: (id: string) => void
  /** Optional total row count and filter count display (e.g. "42 rows · 3 filters"). */
  rowCountDisplay?: React.ReactNode
  /** Optional CSS class. */
  className?: string
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
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap w-full",
        className
      )}
    >
      {/* Filter chips */}
      {filters.map((chip) => (
        <div
          key={chip.id}
          className="inline-flex items-center gap-2 bg-transparent border border-rule rounded-[var(--radius)] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-text"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemoveFilter(chip.id)}
            className="inline-flex items-center justify-center shrink-0 hover:text-fail transition-colors"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {/* Row count display (optional, aligned right) */}
      {rowCountDisplay && (
        <div className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.09em] text-mute whitespace-nowrap">
          {rowCountDisplay}
        </div>
      )}
    </div>
  )
}
