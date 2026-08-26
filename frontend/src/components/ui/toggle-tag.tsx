"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleTagVariants = cva(
  "inline-flex items-center justify-center font-mono uppercase tracking-wide text-[9.5px] px-2 py-0.5 rounded-[var(--radius)] border border-rule text-faint select-none whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sel/50",
  {
    variants: {
      variant: {
        risk: "",
        gate: "",
      },
      pressed: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "risk",
        pressed: true,
        className: "border-risk-bd text-risk bg-risk-bg",
      },
      {
        variant: "gate",
        pressed: true,
        className: "border-waive-bd text-waive bg-waive-bg",
      },
    ],
    defaultVariants: {
      variant: "risk",
      pressed: false,
    },
  }
)

interface ToggleTagProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "onChange">,
    Pick<VariantProps<typeof toggleTagVariants>, "variant"> {
  pressed: boolean
  onPressedChange?: (pressed: boolean) => void
}

function ToggleTag({
  className,
  variant = "risk",
  pressed,
  onPressedChange,
  onClick,
  children,
  ...props
}: ToggleTagProps) {
  return (
    <button
      type="button"
      data-slot="toggle-tag"
      aria-pressed={pressed}
      onClick={(e) => {
        onClick?.(e)
        onPressedChange?.(!pressed)
      }}
      className={cn(toggleTagVariants({ variant, pressed }), className)}
      {...props}
    >
      {children}
    </button>
  )
}

export { ToggleTag, toggleTagVariants }
export type { ToggleTagProps }
