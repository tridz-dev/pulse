import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const meterVariants = cva(
  "flex gap-[1.5px] overflow-hidden rounded-[var(--radius)]",
  {
    variants: {
      size: {
        sm: "h-[5px]",
        md: "h-[8px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

interface MeterProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof meterVariants> {
  segments: { value: number; className: string }[]
}

function Meter({
  className,
  segments,
  size,
  ...props
}: MeterProps) {
  return (
    <div
      data-slot="meter"
      className={cn(meterVariants({ size }), className)}
      {...props}
    >
      {segments.map((segment, index) => {
        // Skip segment rendering if value is 0 or negative to prevent empty spaces/gaps
        if (segment.value <= 0) return null
        return (
          <div
            key={index}
            style={{ flexGrow: segment.value }}
            className={cn("rounded-[1px]", segment.className)}
          />
        )
      })}
    </div>
  )
}

export { Meter, meterVariants }
export type { MeterProps }
