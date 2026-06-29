"use client"

import type { ReactNode } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface DocumentExplorerFrameProps {
  icon: ReactNode
  title: string
  subtitle?: string
  badges?: ReactNode
  toolbar?: ReactNode
  breadcrumb?: ReactNode
  summary?: ReactNode
  leftPane?: ReactNode
  rightPane?: ReactNode
  children: ReactNode
  className?: string
}

export function DocumentExplorerFrame({
  icon: _icon,
  title,
  subtitle,
  badges,
  toolbar,
  breadcrumb,
  summary,
  leftPane,
  rightPane: _rightPane,
  children,
  className,
}: DocumentExplorerFrameProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground", className)}>
      <div className={cn(
        "grid min-h-0 flex-1",
        leftPane ? "grid-cols-[212px_minmax(0,1fr)]" : "grid-cols-1"
      )}>
        {leftPane && (
          <aside className="min-h-0 border-r border-border bg-muted/40">
            <ScrollArea className="h-full">
              <div className="py-3">{leftPane}</div>
            </ScrollArea>
          </aside>
        )}

        <main className="flex min-h-0 flex-col overflow-hidden bg-background">
          <div className="flex min-h-[56px] items-center border-b border-border bg-card px-5">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted-foreground">{title}</div>
              {subtitle && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</div>}
            </div>
            {badges && <div className="ml-4 flex shrink-0 items-center gap-1.5">{badges}</div>}
          </div>

          {toolbar && (
            <div className="flex min-h-[48px] items-center border-b border-border px-5">
              <div className="flex w-full flex-wrap items-center gap-2">{toolbar}</div>
            </div>
          )}

          {(breadcrumb || summary) && (
            <div className="border-b border-border px-5 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                {breadcrumb && <div className="min-w-0 flex-1">{breadcrumb}</div>}
                {summary && <div className="shrink-0">{summary}</div>}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  )
}
