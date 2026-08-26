"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toastIconVariants = cva(
  "flex-none size-[18px] rounded-sm flex items-center justify-center text-[11px] font-bold text-ink leading-none",
  {
    variants: {
      variant: {
        pass: "bg-pass",
        fail: "bg-fail",
        risk: "bg-risk",
        neutral: "bg-none",
      },
    },
  }
)

const TOAST_GLYPH: Record<NonNullable<VariantProps<typeof toastIconVariants>["variant"]>, string> = {
  pass: "✓",
  fail: "!",
  risk: "▲",
  neutral: "·",
}

interface ToastProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  variant: "pass" | "fail" | "risk" | "neutral"
  title: React.ReactNode
  description?: React.ReactNode
  onDismiss?: () => void
}

function Toast({
  className,
  variant,
  title,
  description,
  onDismiss,
  ...props
}: ToastProps) {
  return (
    <div
      data-slot="toast"
      role="status"
      className={cn(
        "flex items-center gap-2.5 max-w-[420px] p-2.5 rounded-[var(--radius)] border border-rule-2 bg-slab text-sm text-mute",
        className
      )}
      {...props}
    >
      <span className={toastIconVariants({ variant })}>{TOAST_GLYPH[variant]}</span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-text">{title}</span>
        {description != null && <span>{description}</span>}
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-auto flex-none text-faint hover:text-text transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export { Toast, toastIconVariants }
export type { ToastProps }
