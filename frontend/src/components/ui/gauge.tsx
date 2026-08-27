"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Meter } from "@/components/ui/meter"
import { scoreStatus } from "@/lib/score"

interface GaugeProps extends React.ComponentPropsWithoutRef<"div"> {
  value: number | null
  label?: string
  segments?: { value: number; className: string }[]
}

const ARC_PATH = "M6 60 A48 48 0 0 1 102 60"
const ARC_LENGTH = 151

/**
 * Hero arc — the "Core · optional" alternative to Ledger's big number.
 * Single semantic status color (fail/risk/pass), never a red→green sweep;
 * flat --rule track; thin 7px stroke; no needle. Exactly one per page,
 * always followed by the pass/fail/waive/none Meter. See
 * pulse_design/examples/design-system.html "Hero arc (alt. to ledger)".
 */
function Gauge({ value, label, segments, className, ...props }: GaugeProps) {
  const isNoData = value === null
  const clamped = isNoData ? 0 : Math.max(0, Math.min(100, value))

  // Derived from the same scoreStatus() thresholds used everywhere else in the
  // app — never a locally-duplicated cutoff, or this arc would silently drift
  // out of sync with the Team table, Ledger, and every other score display.
  const status = isNoData ? "none" : scoreStatus(clamped, 100)
  const strokeVar =
    status === "none" ? "var(--faint)" : status === "pass" ? "var(--pass)" : status === "risk" ? "var(--risk)" : "var(--fail)"

  const resolvedSegments =
    segments ??
    (isNoData
      ? [{ value: 1, className: "bg-none" }]
      : [
          { value: clamped, className: "bg-pass" },
          { value: 100 - clamped, className: "bg-fail" },
        ])

  return (
    <div data-slot="gauge" className={cn("flex flex-col items-center gap-3", className)} {...props}>
      <svg width="108" height="66" viewBox="0 0 108 66">
        <path d={ARC_PATH} fill="none" stroke="var(--rule)" strokeWidth="7" strokeLinecap="round" />
        {!isNoData && (
          <path
            d={ARC_PATH}
            fill="none"
            stroke={strokeVar}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={ARC_LENGTH}
            strokeDashoffset={ARC_LENGTH * (1 - clamped / 100)}
          />
        )}
        <text
          x="54"
          y="46"
          textAnchor="middle"
          fontFamily="Geist Sans, sans-serif"
          fontWeight="700"
          fontSize="26"
          fill={isNoData ? "var(--faint)" : "var(--text)"}
        >
          {isNoData ? "—" : Math.round(clamped)}
        </text>
        <text
          x="54"
          y="58"
          textAnchor="middle"
          fontFamily="Geist Mono, monospace"
          fontSize="8"
          letterSpacing="1"
          fill="var(--faint)"
        >
          PERCENT
        </text>
      </svg>
      {label && (
        <span className={cn("font-mono text-[10px] uppercase tracking-[0.1em] text-faint -mt-1")}>{label}</span>
      )}
      <Meter segments={resolvedSegments} size="md" className="w-full" />
    </div>
  )
}

export { Gauge }
export type { GaugeProps }
