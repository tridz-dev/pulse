"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface CheckboxRowProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "onChange"> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  label: React.ReactNode
  secondary?: React.ReactNode
}

function CheckboxRow({
  className,
  checked,
  onCheckedChange,
  onClick,
  label,
  secondary,
  ...props
}: CheckboxRowProps) {
  return (
    <button
      type="button"
      data-slot="checkbox-row"
      aria-pressed={checked}
      onClick={(e) => {
        onClick?.(e)
        onCheckedChange?.(!checked)
      }}
      className={cn(
        "w-full flex items-center gap-2 py-1.5 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-sel/50 rounded-[var(--radius)]",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "flex-none size-3.5 rounded-sm border border-rule-2 flex items-center justify-center text-[9px] leading-none transition-colors",
          checked ? "bg-sel border-sel text-ink" : "bg-transparent text-transparent"
        )}
      >
        ✓
      </span>
      <span className="text-sm text-text">{label}</span>
      {secondary != null && (
        <span className="ml-auto font-mono text-xs text-faint">{secondary}</span>
      )}
    </button>
  )
}

export { CheckboxRow }
export type { CheckboxRowProps }
