interface WorkbenchCardProps {
  title: string
  badge?: string
  children: React.ReactNode
}

export function WorkbenchCard({ title, badge, children }: WorkbenchCardProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
      <button type="button" className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-left">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{badge}</span>}
        <span className="text-muted-foreground">▾</span>
      </button>
      <div className="space-y-3 px-4 py-3">{children}</div>
    </section>
  )
}
