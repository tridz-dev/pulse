import * as React from "react"
import { cn } from "@/lib/utils"
import { Meter } from "@/components/ui/meter"
import { TrendingUp, TrendingDown } from "lucide-react"

interface StatTileProps extends React.ComponentProps<"div"> {
  /** Large 700-weight tabular number displayed at 44px. Can be null (renders em dash in faint color). */
  value: number | null
  /** Mono eyebrow label (10.5px uppercase tracked). */
  label: React.ReactNode
  /** Optional secondary text below the number (12.5px text-mute). */
  description?: React.ReactNode
  /** Optional meter segments to display below the value. Follows Meter segment shape. */
  segments?: { value: number; className: string }[]
  /** Optional trend indicator: "up" or "down" (renders TrendingUp/TrendingDown icon in pass/risk/fail color). */
  trend?: "up" | "down" | null
  /** Color of the trend icon if trend is set. Defaults to "none". Must be one of the 5 status colors. */
  trendColor?: "pass" | "risk" | "fail" | "waive" | "none"
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
}: StatTileProps) {
  // Map trendColor to CSS variable
  const trendColorClass =
    trendColor === "pass"
      ? "text-pass"
      : trendColor === "risk"
        ? "text-risk"
        : trendColor === "fail"
          ? "text-fail"
          : trendColor === "waive"
            ? "text-waive"
            : "text-mute"

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {/* Value + Trend Icon Row */}
      <div className="flex items-center gap-3">
        {/* Value: null → em dash (—) in faint; otherwise tabular number at 44px */}
        <div className="font-mono text-[44px] font-bold tabular-nums leading-none">
          {value === null ? (
            <span className="text-faint">—</span>
          ) : (
            <span className="text-text">{value}</span>
          )}
        </div>

        {/* Trend Icon (optional) */}
        {trend && (
          <div className={cn("shrink-0", trendColorClass)}>
            {trend === "up" ? (
              <TrendingUp size={20} />
            ) : trend === "down" ? (
              <TrendingDown size={20} />
            ) : null}
          </div>
        )}
      </div>

      {/* Label: mono eyebrow */}
      <div className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-faint font-medium leading-none">
        {label}
      </div>

      {/* Description (optional) */}
      {description && (
        <div className="font-sans text-[12.5px] text-mute leading-normal">
          {description}
        </div>
      )}

      {/* Segments (optional) */}
      {segments && segments.length > 0 && (
        <Meter size="md" segments={segments} className="mt-1" />
      )}
    </div>
  )
}
