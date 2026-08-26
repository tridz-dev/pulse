"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface TableEmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

function TableEmptyState({ icon, title, description, action, className }: TableEmptyStateProps) {
  return (
    <div
      data-slot="table-empty-state"
      className={cn(
        "flex flex-col items-center gap-3 py-8 px-6 text-center border border-rule rounded-[var(--radius)] bg-slab",
        className
      )}
    >
      <span className="flex-none size-[30px] rounded-sm border border-rule-2 flex items-center justify-center text-faint">
        {icon}
      </span>
      <span className="font-semibold text-sm text-text">{title}</span>
      <span className="text-xs text-faint max-w-[38ch]">{description}</span>
      {action}
    </div>
  )
}

interface TableFilteredEmptyStateProps extends Omit<TableEmptyStateProps, "icon"> {
  icon?: React.ReactNode
}

function TableFilteredEmptyState({
  icon = "⌕",
  ...props
}: TableFilteredEmptyStateProps) {
  return <TableEmptyState icon={icon} {...props} />
}

interface TableErrorStateProps {
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

function TableErrorState({ title, description, action, className }: TableErrorStateProps) {
  return (
    <div
      data-slot="table-error-state"
      className={cn(
        "flex flex-col items-center gap-3 py-8 px-6 text-center border border-fail-bd rounded-[var(--radius)] bg-slab",
        className
      )}
    >
      <span className="flex-none size-[30px] rounded-sm border border-fail-bd bg-fail-bg text-fail flex items-center justify-center">
        !
      </span>
      <span className="font-semibold text-sm text-text">{title}</span>
      <span className="text-xs text-faint max-w-[38ch]">{description}</span>
      {action}
    </div>
  )
}

export { TableEmptyState, TableFilteredEmptyState, TableErrorState }
export type { TableEmptyStateProps, TableFilteredEmptyStateProps, TableErrorStateProps }
