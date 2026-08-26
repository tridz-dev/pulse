import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusStrokeCardVariants = cva(
  "bg-slab border border-rule rounded p-3",
  {
    variants: {
      status: {
        pass: "border-l-[2.5px] border-l-pass",
        risk: "border-l-[2.5px] border-l-risk",
        fail: "border-l-[2.5px] border-l-fail",
        waive: "border-l-[2.5px] border-l-waive",
        none: "border-l-[2.5px] border-l-rule",
      },
    },
    defaultVariants: {
      status: "none",
    },
  }
)

interface StatusStrokeCardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof statusStrokeCardVariants> {}

function StatusStrokeCard({
  className,
  status = "none",
  ...props
}: StatusStrokeCardProps) {
  return (
    <div
      data-slot="status-stroke-card"
      className={cn(statusStrokeCardVariants({ status, className }))}
      {...props}
    />
  )
}

export { StatusStrokeCard, statusStrokeCardVariants }
