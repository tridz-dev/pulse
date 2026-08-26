"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Meter } from "@/components/ui/meter"

interface LedgerProps extends React.ComponentPropsWithoutRef<"div"> {
  value: number
  label?: string
  subtitle?: string
  segments?: { value: number; className: string }[]
}

function Ledger({
  value,
  label,
  subtitle,
  segments,
  className,
  ...props
}: LedgerProps) {
  const resolvedSegments =
    segments ??
    [
      { value: value, className: "bg-pass" },
      { value: 100 - value, className: "bg-fail" },
    ]

  const valueColor =
    value >= 80 ? "text-pass" : value >= 50 ? "text-risk" : "text-fail"

  return (
    <div data-slot="ledger" className={cn("flex flex-col gap-3", className)} {...props}>
      <div className="flex flex-col gap-1">
        <div className={cn("flex items-baseline gap-0.5 font-sans font-bold tabular-nums tracking-tight", valueColor)}>
          <span className="text-[32px] md:text-[36px] leading-none">{value}</span>
          <span className="text-[15px] text-mute">%</span>
        </div>
        {label && (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint mt-0.5">
            {label}
          </span>
        )}
        {subtitle && <span className="text-xs text-mute">{subtitle}</span>}
      </div>
      <Meter segments={resolvedSegments} size="md" />
    </div>
  )
}

export { Ledger }
export type { LedgerProps }
