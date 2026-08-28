import { cn } from "@/lib/utils"

type PeriodType = "Day" | "Week" | "Month"

interface PeriodToggleProps {
  /** Currently selected period. */
  value: PeriodType
  /** Callback fired when user selects a different period. */
  onChange: (period: PeriodType) => void
  /** Optional CSS class. */
  className?: string
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
}: PeriodToggleProps) {
  const periods: PeriodType[] = ["Day", "Week", "Month"]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 bg-slab-2 p-1 border border-rule rounded-[var(--radius)]",
        className
      )}
    >
      {periods.map((period) => (
        <button
          key={period}
          type="button"
          onClick={() => onChange(period)}
          className={cn(
            "font-mono text-[10.5px] uppercase tracking-[0.09em] py-1 px-3 rounded-[var(--radius)] transition-colors font-medium leading-none",
            value === period
              ? "bg-sel text-ink"
              : "text-mute hover:text-text hover:bg-slab/50"
          )}
        >
          {period}
        </button>
      ))}
    </div>
  )
}
