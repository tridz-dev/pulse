"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DisclosureProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode
  meta?: React.ReactNode
  defaultOpen?: boolean
}

function Disclosure({
  title,
  meta,
  children,
  defaultOpen = false,
  className,
  ...props
}: DisclosureProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <div
      data-slot="disclosure"
      className={cn("bg-slab border border-rule rounded overflow-hidden", className)}
      {...props}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-slab-2 transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sel/50"
      >
        <span className="font-mono text-xs text-faint w-2.5 shrink-0 select-none">
          {isOpen ? "−" : "+"}
        </span>
        <span className="font-sans font-semibold text-sm text-text">
          {title}
        </span>
        {meta && (
          <span className="ml-auto font-mono text-xs text-faint">
            {meta}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="px-3.5 py-2.5 text-[12.5px] leading-relaxed text-mute border-t border-rule">
          {children}
        </div>
      )}
    </div>
  )
}

export { Disclosure }
