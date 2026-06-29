"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Activity, Brain, Database, Filter, RefreshCw, Save, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"
import { WorkbenchCard } from "@/components/ui/workbench-card"
import { QueryBuilder, QBField, QBGroup, createDefaultQuery } from "@/components/ui/query-builder"

type MemoryDoc = {
  scope?: string
  userId?: string
  entity?: string
  markdown?: string
  updatedAt?: string
}

type AuditItem = {
  audit_id?: string
  action?: string
  provider?: string
  skill_key?: string
  actor?: string
  status?: string
  duration_ms?: number
  created_at?: string
}

const memoryPresets = ["service-item", "price-list", "service-bom", "delivery-org", "sales-org", "purchase-org", "division", "cost-center", "credit-area", "general"]

function shortMarkdown(md: string): string {
  return md.replace(/\s+/g, " ").trim().slice(0, 120)
}

export function AiContent({ activeItem }: { activeItem?: string }) {
  const [memories, setMemories] = useState<MemoryDoc[]>([])
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [memoryEntity, setMemoryEntity] = useState("service-item")
  const [memoryDraft, setMemoryDraft] = useState("")
  const [selectedMemoryKey, setSelectedMemoryKey] = useState("")
  const [selectedMemory, setSelectedMemory] = useState<MemoryDoc | null>(null)
  const [message, setMessage] = useState("")
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [queryGroup, setQueryGroup] = useState<QBGroup>(() => createDefaultQuery([]))
  const [memorySearch, setMemorySearch] = useState("")
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterMenuColumn, setFilterMenuColumn] = useState<string | null>(null)
  const [auditSearch, setAuditSearch] = useState("")
  const [expandedMemoryKey, setExpandedMemoryKey] = useState("")
  const [expandedAuditId, setExpandedAuditId] = useState("")
  const [busy, setBusy] = useState(false)

  const mode = useMemo(() => {
    if (activeItem === "ai-audit") return "audit"
    return "memory"
  }, [activeItem])

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase()
    return audit.filter((item) => {
      if (q && ![item.action, item.provider, item.skill_key, item.actor, item.status, item.created_at].some((v) => String(v ?? "").toLowerCase().includes(q))) return false
      const row: Record<string, unknown> = { action: item.action, provider: item.provider, skill_key: item.skill_key, actor: item.actor, status: item.status, duration_ms: item.duration_ms, created_at: item.created_at }
      if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String(row[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
      return true
    })
  }, [audit, columnFilters, auditSearch])

  const filteredMemories = useMemo(() => {
    const q = memorySearch.trim().toLowerCase()
    return memories.filter((item) => {
      if (q && ![item.scope, item.userId, item.entity, item.markdown, item.updatedAt].some((v) => String(v ?? "").toLowerCase().includes(q))) return false
      const row: Record<string, unknown> = { scope: item.scope, userId: item.userId, entity: item.entity, markdown: item.markdown, updatedAt: item.updatedAt }
      if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String(row[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
      return true
    })
  }, [memorySearch, columnFilters, memories])

  const selectedMemoryMarkdown = selectedMemory?.markdown ?? ""
  const selectedMemoryText = selectedMemoryMarkdown ? shortMarkdown(selectedMemoryMarkdown) : ""

  useEffect(() => {
    setShowLeftPanel(false)
  }, [mode])

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadMemories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryEntity])

  async function loadAll(): Promise<void> {
    setBusy(true)
    try {
      await Promise.all([loadMemories(), loadAudit()])
    } finally {
      setBusy(false)
    }
  }

  async function loadMemories(): Promise<void> {
    const [sys, usr] = await Promise.all([
      fetch("/api/proxy/api/v1/memory?scope=system"),
      fetch("/api/proxy/api/v1/memory?scope=user&userId=demo-user"),
    ])
    const sysData = (await sys.json()) as { items?: MemoryDoc[] }
    const usrData = (await usr.json()) as { items?: MemoryDoc[] }
    const items = [...(sysData.items ?? []), ...(usrData.items ?? [])].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
    setMemories(items)
    if (!selectedMemoryKey && items[0]) {
      const first = items[0]
      setSelectedMemoryKey(`${first.scope ?? "system"}:${first.userId ?? ""}:${first.entity ?? ""}`)
      setSelectedMemory(first)
      setMemoryEntity(first.entity ?? "service-item")
      setMemoryDraft(first.markdown ?? "")
    } else if (selectedMemoryKey) {
      const hit = items.find((item) => `${item.scope ?? "system"}:${item.userId ?? ""}:${item.entity ?? ""}` === selectedMemoryKey)
      if (hit) {
        setSelectedMemory(hit)
        setMemoryDraft(hit.markdown ?? "")
      }
    }
  }

  async function loadAudit(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/mcp/audit?limit=100")
    const data = (await resp.json()) as { items?: AuditItem[] }
    setAudit(data.items ?? [])
  }

  async function saveUserMemory(): Promise<void> {
    const payload = { userId: "demo-user", entity: memoryEntity || "general", markdown: memoryDraft || "# user memory" }
    const resp = await fetch("/api/proxy/api/v1/memory/user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Memory save failed: ${data.detail ?? "unknown"}`)
    setMessage("User memory draft saved")
    await Promise.all([loadMemories(), loadAudit()])
  }

  function selectMemory(item: MemoryDoc): void {
    setSelectedMemory(item)
    const key = `${item.scope ?? "system"}:${item.userId ?? ""}:${item.entity ?? ""}`
    setSelectedMemoryKey(key)
    setExpandedMemoryKey(key)
    setMemoryEntity(item.entity ?? "general")
    setMemoryDraft(item.markdown ?? "")
  }

  function memoryKey(item: MemoryDoc): string {
    return `${item.scope ?? "system"}:${item.userId ?? ""}:${item.entity ?? ""}`
  }

  function auditKind(item: AuditItem): "skill" | "memory" | "other" {
    if (item.skill_key) return "skill"
    if (item.action?.toLowerCase().includes("memory")) return "memory"
    return "other"
  }

  const cards = [
    { label: "Memory Records", value: memories.length, icon: <Database className="h-4 w-4" /> },
    { label: "Audit Events", value: audit.length, icon: <Activity className="h-4 w-4" /> },
  ]

  const queryFields: QBField[] = useMemo(() => {
    if (mode === "audit") {
      return [
        { field: "action", label: "Action", type: "string" },
        { field: "skill_key", label: "Skill Key", type: "string" },
        { field: "provider", label: "Provider", type: "string" },
        { field: "actor", label: "Actor", type: "string" },
        { field: "status", label: "Status", type: "select", options: ["ok", "error"] },
        { field: "duration_ms", label: "Duration (ms)", type: "number" },
        { field: "created_at", label: "Created At", type: "date" },
      ]
    }
    // memory (default)
    return [
      { field: "entity", label: "Entity", type: "string" },
      { field: "scope", label: "Scope", type: "select", options: ["system", "user"] },
      { field: "userId", label: "User ID", type: "string" },
      { field: "markdown", label: "Content", type: "string" },
      { field: "updatedAt", label: "Updated At", type: "date" },
    ]
  }, [mode])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">AI Workspace</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeftPanel((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${showLeftPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              Query
            </button>
            <Button variant="outline" size="sm" onClick={() => void loadAll()} className="h-9 px-3 text-xs">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Refresh
            </Button>
            <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              Mode: <span className="font-medium text-foreground">{mode}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto">
        {showLeftPanel && (
          <aside className="relative w-[342px] shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden p-4">
            <WorkbenchCard title="Query Conditions" badge={`${queryGroup.conditions.length + queryGroup.groups.length} rules`}>
              <QueryBuilder fields={queryFields} query={queryGroup} onChange={setQueryGroup} storageKey={`qb.ai.${mode}`} />
            </WorkbenchCard>
          </aside>
        )}
        <div className="flex-1 overflow-auto p-6">

      {message && <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-primary">{message}</div>}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{card.icon}</div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{busy ? "Loading" : "Live"}</span>
            </div>
            <div className="text-2xl font-semibold text-foreground">{card.value}</div>
            <div className="text-sm text-muted-foreground">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Memory Explorer — wider panel */}
        <div className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Memory Explorer</h2>
              <p className="text-xs text-muted-foreground">Search, review, and edit user memory drafts.</p>
            </div>
            <div className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{filteredMemories.length} items</div>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                placeholder="Search memories..."
                className="h-9 w-full rounded-lg border border-border bg-background pl-7 pr-3 text-xs outline-none"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => void saveUserMemory()} className="h-9 px-3 text-xs">
              <Save className="mr-2 h-3.5 w-3.5" />
              Save
            </Button>
          </div>
          <div className="max-h-[400px] space-y-2 overflow-auto pr-1">
            {filteredMemories.length > 0 ? filteredMemories.map((item) => {
              const key = memoryKey(item)
              const expanded = expandedMemoryKey === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    selectMemory(item)
                    setExpandedMemoryKey((prev) => (prev === key ? "" : key))
                  }}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    expanded ? "border-primary bg-muted/40" : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-foreground">{item.entity ?? "general"}</div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{item.scope ?? "system"}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{item.userId ?? "all users"}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground">{shortMarkdown(item.markdown ?? "-") || "-"}</div>
                  {expanded && (
                    <div className="mt-3 rounded-md border border-border bg-card p-2 text-[11px] text-muted-foreground">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-foreground">Preview</span>
                        <span>{item.updatedAt ?? "-"}</span>
                      </div>
                      <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-foreground">{item.markdown ?? "-"}</pre>
                    </div>
                  )}
                </button>
              )
            }) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No memories found for the current filter.</div>
            )}
          </div>
          <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected Memory</div>
            <div className="mt-1 text-sm font-medium text-foreground">{selectedMemory?.entity ?? "No memory selected"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{selectedMemory?.scope ?? "system"} · {selectedMemory?.userId ?? "all users"}</div>
            <div className="mt-3 rounded-lg border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
              {selectedMemoryText || "Select a memory item to preview its markdown content here."}
            </div>
            <label className="mt-3 block text-xs">
              <span className="mb-1 block uppercase tracking-wide text-muted-foreground">Entity</span>
              <select value={memoryEntity} onChange={(e) => setMemoryEntity(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none">
                {memoryPresets.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* MCP Execution Audit — side panel */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">MCP Execution Audit</h2>
              <p className="text-xs text-muted-foreground">Shows skill execution and memory write events.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search audit..."
                  className="h-8 w-44 rounded-lg border border-border bg-background pl-7 pr-3 text-[11px] outline-none"
                />
              </div>
              {(["action", "provider", "skill_key", "actor", "status"] as const).map((col) => (
                <span key={col} className="relative inline-block">
                  <button type="button" onClick={() => setFilterMenuColumn((prev) => (prev === col ? null : col))} className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
                    <Filter className={cn("mr-1 h-3 w-3", columnFilters[col] ? "text-primary" : "text-muted-foreground/50")} />
                    {col.replace("_", " ")}
                  </button>
                  {filterMenuColumn === col && (
                    <ColumnFilterPopover
                      column={col}
                      label={col.replace("_", " ")}
                      value={columnFilters[col] ?? ""}
                      onChange={(v) => setColumnFilters((prev) => ({ ...prev, [col]: v }))}
                      onClear={() => setColumnFilters((prev) => { const next = { ...prev }; delete next[col]; return next })}
                      onClose={() => setFilterMenuColumn(null)}
                    />
                  )}
                </span>
              ))}
              <Button onClick={() => void loadAudit()} variant="outline" size="sm" className="h-8 px-3 text-xs">
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </div>
          <div className="max-h-[760px] space-y-2 overflow-auto">
            {filteredAudit.length > 0 ? (
              filteredAudit.map((item, index) => {
                const key = item.audit_id ?? String(index)
                const expanded = expandedAuditId === key
                const kind = auditKind(item)
                return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setExpandedAuditId((prev) => (prev === key ? "" : key))}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    expanded ? "border-primary bg-muted/40" : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-foreground">{item.action ?? "-"}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{item.skill_key ?? "-"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{item.status ?? "ok"}</div>
                      <div className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{kind}</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Provider:</span> {item.provider ?? "-"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Actor:</span> {item.actor ?? "-"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Duration:</span> {item.duration_ms ? `${item.duration_ms} ms` : "-"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Created:</span> {item.created_at ?? "-"}
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-3 rounded-md border border-border bg-card p-2 text-[11px] text-muted-foreground">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-foreground">Execution Detail</span>
                        <span>{item.audit_id ?? "-"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="font-medium text-foreground">Actor:</span> {item.actor ?? "-"}</div>
                        <div><span className="font-medium text-foreground">Skill:</span> {item.skill_key ?? "-"}</div>
                        <div><span className="font-medium text-foreground">Provider:</span> {item.provider ?? "-"}</div>
                        <div><span className="font-medium text-foreground">Duration:</span> {item.duration_ms ? `${item.duration_ms} ms` : "-"}</div>
                      </div>
                    </div>
                  )}
                </button>
                )
              })
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No audit records yet.</div>
            )}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}
