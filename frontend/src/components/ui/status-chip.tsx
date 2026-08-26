import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusChipVariants = cva(
  "inline-flex items-center justify-center font-mono uppercase tracking-wide text-[9.5px] px-[7px] py-0.5 rounded-[var(--radius)] border select-none whitespace-nowrap",
  {
    variants: {
      status: {
        pass: "border-pass text-pass bg-transparent",
        risk: "border-risk-bd text-risk bg-risk-bg",
        fail: "border-fail-bd text-fail bg-fail-bg",
        waive: "border-waive-bd text-waive bg-waive-bg",
        none: "border-rule text-faint bg-transparent",
      },
    },
    defaultVariants: {
      status: "none",
    },
  }
)

interface StatusChipProps
  extends React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof statusChipVariants> {}

function StatusChip({
  className,
  status,
  children,
  ...props
}: StatusChipProps) {
  return (
    <span
      data-slot="status-chip"
      className={cn(statusChipVariants({ status }), className)}
      {...props}
    >
      {children}
    </span>
  )
}

export { StatusChip, statusChipVariants }
export type { StatusChipProps }
