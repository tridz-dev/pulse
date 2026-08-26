"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface RadioOptionCardProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "title"> {
  selected: boolean
  onSelect?: () => void
  title: React.ReactNode
  description: React.ReactNode
}

function RadioOptionCard({
  className,
  selected,
  onSelect,
  onClick,
  title,
  description,
  ...props
}: RadioOptionCardProps) {
  return (
    <button
      type="button"
      data-slot="radio-option-card"
      aria-pressed={selected}
      onClick={(e) => {
        onClick?.(e)
        onSelect?.()
      }}
      className={cn(
        "w-full flex items-start gap-2 p-2.5 text-left border rounded-[var(--radius)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sel/50",
        selected ? "border-sel" : "border-rule-2",
        className
      )}
      {...props}
    >
      <span
        className="flex-none mt-0.5 size-[13px] rounded-full border border-rule-2"
        style={
          selected
            ? { boxShadow: "inset 0 0 0 3px var(--sel)", borderColor: "var(--sel)" }
            : undefined
        }
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold text-sm text-text">{title}</span>
        <span className="text-xs text-faint">{description}</span>
      </span>
    </button>
  )
}

export { RadioOptionCard }
export type { RadioOptionCardProps }
