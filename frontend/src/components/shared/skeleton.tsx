"use client"

import { cn } from "@/lib/utils"

interface SkeletonProps extends React.ComponentProps<"div"> {
  /**
   * Height of the skeleton bar. Defaults to "1em" (matches body text height).
   * Can be "sm" (5px, matches tree-row meter), "md" (8px), "lg" (16px).
   */
  height?: "sm" | "md" | "lg" | string

  /**
   * Width as a CSS value or preset. Defaults to "100%".
   * Can be a number (0–100) for percentage, or any CSS width value.
   */
  width?: number | string

  /** If true, skeleton pulses. Default: true. */
  animate?: boolean

  /** Optional CSS class for additional styling. */
  className?: string
}

/**
 * Single pulsing placeholder bar. Used in loading states for tree rows, table rows,
 * and charts. All skeletons share the same visual language: `bg-rule` color, 3px radius,
 * gentle pulse animation. Height and width are configurable presets.
 *
 * Usage in a row: <Skeleton height="sm" width="40%" /> <Skeleton height="sm" width="20%" />
 * Usage in a ledger: <Skeleton height="lg" width="80px" />
 */
export function Skeleton({
  height = "1em",
  width = "100%",
  animate = true,
  className,
  ...props
}: SkeletonProps) {
  // Map preset heights to actual values
  const heightClass = height === "sm" ? "h-[5px]" : height === "md" ? "h-2" : height === "lg" ? "h-4" : height

  // Map width: if it's a number, treat as percentage
  const widthValue = typeof width === "number" ? `${width}%` : width

  return (
    <div
      className={cn(
        "bg-rule rounded-[var(--radius)]",
        heightClass,
        animate && "animate-pulse",
        className
      )}
      style={{
        width: widthValue,
      }}
      {...props}
    />
  )
}

interface SkeletonRowProps extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * Number of skeleton bars to render in this row. Defaults to 3.
   */
  cellCount?: number

  /**
   * Widths for each skeleton bar as an array of percentages or CSS values.
   * If not provided, all bars are equally sized.
   */
  cellWidths?: (number | string)[]

  /**
   * Height for all bars in this row. Defaults to "md" (8px).
   */
  height?: "sm" | "md" | "lg" | string

  /** If true, all bars pulse in sync. Default: true. */
  animate?: boolean

  /** Optional CSS class. */
  className?: string
}

/**
 * Helper: renders a row of skeleton bars with configurable cell count and widths.
 * Used to mock table/tree rows during loading.
 */
export function SkeletonRow({
  cellCount = 3,
  cellWidths,
  height = "md",
  animate = true,
  className,
  ...props
}: SkeletonRowProps) {
  // Map preset heights to actual values
  const heightClass = height === "sm" ? "h-[5px]" : height === "md" ? "h-2" : height === "lg" ? "h-4" : height

  return (
    <div
      className={cn("flex gap-2 w-full", className)}
      {...props}
    >
      {Array.from({ length: cellCount }).map((_, idx) => {
        const cellWidth = cellWidths?.[idx] ?? `${100 / cellCount}%`
        const widthValue = typeof cellWidth === "number" ? `${cellWidth}%` : cellWidth

        return (
          <div
            key={idx}
            className={cn(
              "bg-rule rounded-[var(--radius)]",
              heightClass,
              animate && "animate-pulse"
            )}
            style={{
              flex: cellWidths ? "0 0 auto" : "1 1 0",
              width: cellWidths ? widthValue : "auto",
            }}
          />
        )
      })}
    </div>
  )
}
