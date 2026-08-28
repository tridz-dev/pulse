"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  TableEmptyState,
  TableFilteredEmptyState,
  TableErrorState,
} from "@/components/ui/table-states"
import { SkeletonRow } from "@/components/shared/skeleton"

interface ChartFrameProps {
  /**
   * Chart state. One of four values:
   * - "loading": Data is being fetched. Render a skeleton loading state.
   * - "zero": No data at all (first use, no records match any period). Render neutral tone empty state.
   * - "filtered-empty": Filters are active but they matched zero rows. Render distinct empty state
   *     that names the active filters so user knows why the chart is empty.
   * - "error": Data fetch failed. Render error state with "couldn't load" wording (NOT "failed compliance").
   *     Include a retry button.
   * - "ready": Data is loaded and non-empty. Render the chart.
   */
  state: "loading" | "zero" | "filtered-empty" | "error" | "ready"

  /** Chart content (Recharts ResponsiveContainer + BarChart/LineChart/etc). Only rendered when state === "ready". */
  children?: React.ReactNode

  /** For state === "zero": message + optional action button. */
  zeroMessage?: {
    title: string
    description: string
    action?: React.ReactNode
  }

  /** For state === "filtered-empty": message + optional action button. Should mention the active filters. */
  filteredEmptyMessage?: {
    title: string
    description: string
    action?: React.ReactNode
  }

  /** For state === "error": message + optional retry button. Wording must be "couldn't load" not "failed". */
  errorMessage?: {
    title: string
    description: string
    action?: React.ReactNode
  }

  /** For state === "loading": skeleton configuration. Optional; if not provided, renders generic skeleton. */
  loadingState?: {
    /** Number of rows to render in the skeleton (default: 4). */
    rows?: number
  }

  /** Minimum height for the chart container. Defaults to "400px". */
  minHeight?: string

  /** Optional CSS class. */
  className?: string
}

/**
 * Frame component that wraps a Recharts chart and handles 4 states: loading, zero, filtered-empty, error.
 * Each state renders a distinct message and optional action. When state === "ready", renders children.
 * Loading state renders the shared SkeletonRow primitive.
 * Empty states use TableEmptyState + TableFilteredEmptyState (existing in table-states.tsx).
 * Error state uses TableErrorState (existing in table-states.tsx) with "couldn't load" wording.
 */
export function ChartFrame({
  state,
  children,
  zeroMessage,
  filteredEmptyMessage,
  errorMessage,
  loadingState,
  minHeight = "400px",
  className,
}: ChartFrameProps): React.ReactElement {
  const rows = loadingState?.rows ?? 4

  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--radius)] border border-rule bg-slab",
        className
      )}
      style={{ minHeight }}
    >
      {state === "ready" && children}

      {state === "loading" && (
        <div className="flex flex-col items-center justify-center flex-1 p-8 gap-3">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cellCount={1} cellWidths={["100%"]} height="md" />
          ))}
        </div>
      )}

      {state === "zero" && (
        <div className="flex items-center justify-center flex-1 p-8">
          <TableEmptyState
            icon="◯"
            title={zeroMessage?.title ?? "Nothing to show"}
            description={zeroMessage?.description ?? "No data is available for this view yet."}
            action={zeroMessage?.action}
          />
        </div>
      )}

      {state === "filtered-empty" && (
        <div className="flex items-center justify-center flex-1 p-8">
          <TableFilteredEmptyState
            title={filteredEmptyMessage?.title ?? "No matching data"}
            description={filteredEmptyMessage?.description ?? "No rows match the active filters."}
            action={filteredEmptyMessage?.action}
          />
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center justify-center flex-1 p-8">
          <TableErrorState
            title={errorMessage?.title ?? "Couldn't load"}
            description={errorMessage?.description ?? "Something went wrong loading this data."}
            action={errorMessage?.action}
          />
        </div>
      )}
    </div>
  )
}

export type { ChartFrameProps }
