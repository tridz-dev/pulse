import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Flat underline tabs — the Pulse instrument-panel replacement for a
 * filled/pill tab indicator. `--sel` is reserved for selection/focus only,
 * never a persistent "active tab" background, so the active state here is a
 * neutral border-b-2 + text-text treatment instead. See pulse_design/DESIGN.md.
 */

interface TabsListProps extends React.ComponentPropsWithoutRef<"div"> {}

function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      className={cn("flex items-center gap-4 border-b border-rule", className)}
      {...props}
    />
  )
}

interface TabsTriggerProps extends React.ComponentPropsWithoutRef<"button"> {
  active: boolean
}

function TabsTrigger({ className, active, ...props }: TabsTriggerProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-slot="tabs-trigger"
      className={cn(
        "flex items-center gap-1.5 h-8 -mb-px px-0.5 text-xs font-medium border-b-2 transition-colors",
        active
          ? "border-text text-text"
          : "border-transparent text-mute hover:text-text",
        className
      )}
      {...props}
    />
  )
}

export { TabsList, TabsTrigger }
