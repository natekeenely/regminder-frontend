"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Brain,
  Check,
  Clock,
  Copy,
  Database,
  Edit3,
  FileText,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Share2,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ───────── types ───────── */

interface MemoryDoc {
  scope: string
  userId?: string
  entity: string
  markdown: string
  createdBy?: string
  sharing?: "private" | "shared" | "public"
  updatedAt: string
}

/* ───────── ownership helpers ───────── */

function getCurrentUser(): string {
  try { return window.localStorage.getItem("hermes.displayName") ?? "Demo User" } catch { return "Demo User" }
}
function getCurrentUserRole(): string {
  try { return window.localStorage.getItem("hermes.userRole") ?? "admin" } catch { return "admin" }
}
function canEditMemory(item: { createdBy?: string }): boolean {
  const user = getCurrentUser()
  const role = getCurrentUserRole()
  return role === "admin" || (item.createdBy || "") === user
}

const SHARING_OPTIONS = [
  { value: "private", label: "Private", icon: Lock, color: "text-muted-foreground" },
  { value: "shared", label: "Shared", icon: Users, color: "text-blue-600" },
  { value: "public", label: "Public", icon: Globe, color: "text-green-600" },
] as const

/* ───────── helpers ───────── */

function shortPreview(md: string, maxLen = 100): string {
  const clean = md.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim()
  return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean
}

function relativeTime(iso: string): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function wordCount(md: string): number {
  return md.split(/\s+/).filter(Boolean).length
}

function lineCount(md: string): number {
  return md.split("\n").length
}

/* ───────── component ───────── */

export function AiMemoryContent() {
  const [memories, setMemories] = useState<MemoryDoc[]>([])
  const [selected, setSelected] = useState<MemoryDoc | null>(null)
  const [draft, setDraft] = useState("")
  const [search, setSearch] = useState("")
  const [scopeFilter, setScopeFilter] = useState<"all" | "system" | "user">("all")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  // create form
  const [showCreate, setShowCreate] = useState(false)
  const [newScope, setNewScope] = useState<"system" | "user">("user")
  const [newEntity, setNewEntity] = useState("")
  const [newUserId, setNewUserId] = useState("demo-user")
  const [newMarkdown, setNewMarkdown] = useState("")
  const [newSharing, setNewSharing] = useState<"private" | "shared" | "public">("private")

  // confirm delete
  const [confirmDeleteKey, setConfirmDeleteKey] = useState("")

  // dirty tracking
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    void loadMemories()
  }, [])

  const flash = useCallback((text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }, [])

  async function loadMemories() {
    setBusy(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/memory")
      if (resp.ok) {
        const json = (await resp.json()) as { items?: MemoryDoc[] }
        const items = (json.items ?? []).sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
        setMemories(items)
        // reselect if current selection still exists
        if (selected) {
          const hit = items.find((m) => memKey(m) === memKey(selected))
          if (hit) { setSelected(hit); setDraft(hit.markdown); setIsDirty(false) }
          else { setSelected(null); setDraft(""); setIsDirty(false) }
        }
      }
    } catch {
      flash("Failed to load memories", "error")
    } finally {
      setBusy(false)
    }
  }

  function memKey(m: MemoryDoc): string {
    return `${m.scope}:${m.userId ?? ""}:${m.entity}`
  }

  function selectMemory(m: MemoryDoc) {
    if (isDirty && selected) {
      if (!window.confirm("You have unsaved changes. Discard?")) return
    }
    setSelected(m)
    setDraft(m.markdown)
    setIsDirty(false)
    setShowCreate(false)
    setConfirmDeleteKey("")
  }

  // Save
  async function saveMemory() {
    if (!selected) return
    setBusy(true)
    try {
      const url = selected.scope === "system"
        ? "/api/proxy/api/v1/memory/system"
        : "/api/proxy/api/v1/memory/user"
      const payload = selected.scope === "system"
        ? { entity: selected.entity, markdown: draft }
        : { userId: selected.userId ?? "demo-user", entity: selected.entity, markdown: draft }
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (resp.ok) {
        flash("Memory saved")
        setIsDirty(false)
        await loadMemories()
      } else {
        const err = await resp.json().catch(() => ({})) as { detail?: string }
        flash(`Save failed: ${err.detail ?? resp.statusText}`, "error")
      }
    } catch {
      flash("Save failed", "error")
    } finally {
      setBusy(false)
    }
  }

  // Create
  async function createMemory() {
    if (!newEntity.trim() || !newMarkdown.trim()) return
    setBusy(true)
    try {
      const url = newScope === "system"
        ? "/api/proxy/api/v1/memory/system"
        : "/api/proxy/api/v1/memory/user"
      const base = newScope === "system"
        ? { entity: newEntity.trim(), markdown: newMarkdown.trim() }
        : { userId: newUserId.trim() || "demo-user", entity: newEntity.trim(), markdown: newMarkdown.trim() }
      const payload = { ...base, createdBy: getCurrentUser(), sharing: newSharing }
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (resp.ok) {
        flash("Memory created")
        setShowCreate(false)
        setNewEntity(""); setNewMarkdown(""); setNewUserId("demo-user"); setNewSharing("private")
        await loadMemories()
      } else {
        const err = await resp.json().catch(() => ({})) as { detail?: string }
        flash(`Create failed: ${err.detail ?? resp.statusText}`, "error")
      }
    } catch {
      flash("Create failed", "error")
    } finally {
      setBusy(false)
    }
  }

  // Duplicate
  async function duplicateMemory(m: MemoryDoc) {
    setShowCreate(true)
    setSelected(null)
    setDraft("")
    setNewScope(m.scope as "system" | "user")
    setNewEntity(`${m.entity}-copy`)
    setNewUserId(m.userId ?? "demo-user")
    setNewMarkdown(m.markdown)
    setNewSharing("private")
    flash("Editing duplicated memory — change entity key and save")
  }

  // Delete
  async function deleteMemory(m: MemoryDoc) {
    setBusy(true)
    try {
      const params = new URLSearchParams({ scope: m.scope, entity: m.entity })
      if (m.userId) params.set("userId", m.userId)
      const resp = await fetch(`/api/proxy/api/v1/memory?${params.toString()}`, { method: "DELETE" })
      if (resp.ok) {
        flash("Memory deleted")
        if (selected && memKey(selected) === memKey(m)) {
          setSelected(null); setDraft(""); setIsDirty(false)
        }
        setConfirmDeleteKey("")
        await loadMemories()
      } else {
        flash("Delete failed", "error")
      }
    } catch {
      flash("Delete failed", "error")
    } finally {
      setBusy(false)
    }
  }

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return memories.filter((m) => {
      if (scopeFilter !== "all" && m.scope !== scopeFilter) return false
      if (q && ![m.scope, m.userId, m.entity, m.markdown].some((v) => String(v ?? "").toLowerCase().includes(q))) return false
      return true
    })
  }, [memories, search, scopeFilter])

  // Stats
  const stats = useMemo(() => {
    const system = memories.filter((m) => m.scope === "system").length
    const user = memories.filter((m) => m.scope === "user").length
    const totalWords = memories.reduce((s, m) => s + wordCount(m.markdown), 0)
    return { total: memories.length, system, user, totalWords }
  }, [memories])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Memory
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {message && (
              <Badge variant="outline" className={cn("text-xs", message.type === "success" ? "text-green-600 border-green-500/30" : "text-red-600 border-red-500/30")}>
                {message.type === "success" ? <Check className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}
                {message.text}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => void loadMemories()} className="h-9 px-3 text-xs">
              <RefreshCw className={cn("mr-2 h-3.5 w-3.5", busy && "animate-spin")} />Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Total", value: stats.total, icon: <Database className="h-3.5 w-3.5" />, color: "text-primary bg-primary/10" },
            { label: "System", value: stats.system, icon: <Server className="h-3.5 w-3.5" />, color: "text-blue-600 bg-blue-500/10" },
            { label: "User", value: stats.user, icon: <User className="h-3.5 w-3.5" />, color: "text-green-600 bg-green-500/10" },
            { label: "Words", value: stats.totalWords.toLocaleString(), icon: <FileText className="h-3.5 w-3.5" />, color: "text-amber-600 bg-amber-500/10" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5">
              <div className={cn("flex h-6 w-6 items-center justify-center rounded", s.color)}>{s.icon}</div>
              <div>
                <div className="text-sm font-semibold text-foreground">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Split Panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — Memory List */}
        <div className="w-[360px] shrink-0 border-r border-border flex flex-col">
          {/* Controls */}
          <div className="border-b border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memories..." className="h-8 pl-8 text-xs" />
              </div>
              <Button size="sm" onClick={() => { setShowCreate(true); setSelected(null); setDraft("") }} className="h-8 text-xs shrink-0">
                <Plus className="mr-1 h-3 w-3" />New
              </Button>
            </div>
            <div className="flex gap-1">
              {(["all", "system", "user"] as const).map((s) => (
                <button key={s} onClick={() => setScopeFilter(s)} className={cn(
                  "flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors capitalize",
                  scopeFilter === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}>
                  {s === "all" ? `All (${stats.total})` : s === "system" ? `System (${stats.system})` : `User (${stats.user})`}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center">
                <Brain className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No memories found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((m) => {
                  const key = memKey(m)
                  const isSelected = selected && memKey(selected) === key
                  const isDeleteConfirm = confirmDeleteKey === key
                  return (
                    <div key={key} className={cn(
                      "group relative px-3 py-3 cursor-pointer transition-colors",
                      isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"
                    )} onClick={() => selectMemory(m)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {m.scope === "system" ? (
                              <Server className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            )}
                            <span className="text-xs font-medium text-foreground truncate">{m.entity}</span>
                          </div>
                          {m.scope === "user" && m.userId && (
                            <div className="mt-0.5 ml-5.5 text-[10px] text-muted-foreground truncate">{m.userId}</div>
                          )}
                          <div className="mt-0.5 ml-5.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                            <User className="h-2.5 w-2.5" />{m.createdBy || "—"}
                            {m.sharing && m.sharing !== "private" && (
                              <Badge variant="outline" className={cn("text-[8px] px-1 py-0", m.sharing === "public" ? "text-green-600 border-green-500/30" : "text-blue-600 border-blue-500/30")}>
                                {m.sharing === "public" ? <Globe className="mr-0.5 h-2 w-2" /> : <Users className="mr-0.5 h-2 w-2" />}{m.sharing}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 ml-5.5 text-[10px] text-muted-foreground line-clamp-2">{shortPreview(m.markdown, 80)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={cn("text-[8px]", m.scope === "system" ? "text-blue-600 border-blue-500/30" : "text-green-600 border-green-500/30")}>
                            {m.scope}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />{relativeTime(m.updatedAt)}
                          </span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); duplicateMemory(m) }} className="rounded p-1 hover:bg-primary/10" title="Duplicate">
                          <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </button>
                        {canEditMemory(m) && (
                          isDeleteConfirm ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => void deleteMemory(m)} className="rounded bg-destructive px-2 py-0.5 text-[9px] text-destructive-foreground font-medium">Delete</button>
                              <button onClick={() => setConfirmDeleteKey("")} className="rounded bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteKey(key) }} className="rounded p-1 hover:bg-destructive/10">
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — Editor / Create Form */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showCreate ? (
            /* ── Create New Memory ── */
            <div className="flex-1 overflow-auto p-6 space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />Create New Memory
                </h2>
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="h-7 text-xs">
                  <X className="mr-1 h-3 w-3" />Cancel
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground font-medium">Scope</label>
                  <Select value={newScope} onValueChange={(v) => setNewScope(v as "system" | "user")}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2"><Server className="h-3 w-3 text-blue-500" />System</div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2"><User className="h-3 w-3 text-green-500" />User</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newScope === "user" && (
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground font-medium">User ID</label>
                    <Input value={newUserId} onChange={(e) => setNewUserId(e.target.value)} placeholder="e.g. demo-user" className="h-8 text-xs" />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground font-medium">Entity Key</label>
                  <Input value={newEntity} onChange={(e) => setNewEntity(e.target.value)} placeholder="e.g. service-item, regulation, general" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground font-medium">Sharing</label>
                  <Select value={newSharing} onValueChange={(v) => setNewSharing(v as typeof newSharing)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHARING_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <div className="flex items-center gap-1.5"><o.icon className={cn("h-3 w-3", o.color)} /><span>{o.label}</span></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground font-medium">Content (Markdown)</label>
                <textarea
                  value={newMarkdown}
                  onChange={(e) => setNewMarkdown(e.target.value)}
                  placeholder={"# Memory Title\n\nAdd context the AI should know about this entity...\n\n## Key Points\n- ..."}
                  className="h-64 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs leading-5 outline-none resize-y focus:border-primary/50"
                />
                <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                  <span>{wordCount(newMarkdown)} words</span>
                  <span>{lineCount(newMarkdown)} lines</span>
                </div>
              </div>

              <Button size="sm" onClick={() => void createMemory()} disabled={!newEntity.trim() || !newMarkdown.trim() || busy} className="h-8 text-xs">
                <Save className="mr-1.5 h-3 w-3" />{busy ? "Creating..." : "Create Memory"}
              </Button>
            </div>
          ) : selected ? (
            /* ── Edit Selected Memory ── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Editor header */}
              <div className="border-b border-border px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selected.scope === "system" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                      <Server className="h-4 w-4 text-blue-500" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                      <User className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-foreground">{selected.entity}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[8px]", selected.scope === "system" ? "text-blue-600 border-blue-500/30" : "text-green-600 border-green-500/30")}>
                        {selected.scope}
                      </Badge>
                      {selected.userId && <span>User: {selected.userId}</span>}
                      <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" />{selected.createdBy || "—"}</span>
                      {selected.sharing && (
                        <Badge variant="outline" className={cn("text-[8px]",
                          selected.sharing === "public" ? "text-green-600 border-green-500/30" :
                          selected.sharing === "shared" ? "text-blue-600 border-blue-500/30" : ""
                        )}>{selected.sharing}</Badge>
                      )}
                      <span>Updated: {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isDirty && <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30">Unsaved changes</Badge>}
                  <div className="text-[10px] text-muted-foreground">{wordCount(draft)} words · {lineCount(draft)} lines</div>
                  <Button variant="outline" size="sm" onClick={() => selected && duplicateMemory(selected)} className="h-8 text-xs">
                    <Copy className="mr-1.5 h-3 w-3" />Duplicate
                  </Button>
                  {canEditMemory(selected) ? (
                    <Button size="sm" onClick={() => void saveMemory()} disabled={!isDirty || busy} className="h-8 text-xs">
                      <Save className="mr-1.5 h-3 w-3" />{busy ? "Saving..." : "Save"}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">View only — owned by {selected.createdBy}</span>
                  )}
                </div>
              </div>

              {/* Editor body */}
              <div className="flex-1 overflow-hidden p-4">
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setIsDirty(true) }}
                  readOnly={!canEditMemory(selected)}
                  className={cn(
                    "h-full w-full rounded-lg border border-border bg-background p-4 font-mono text-xs leading-6 outline-none resize-none focus:border-primary/50",
                    !canEditMemory(selected) && "bg-muted/20 cursor-not-allowed"
                  )}
                  spellCheck={false}
                />
              </div>
            </div>
          ) : (
            /* ── Empty State ── */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Brain className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Select a memory to view and edit</p>
                <p className="mt-1 text-xs text-muted-foreground">Or create a new memory entry</p>
                <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="mt-4 h-8 text-xs">
                  <Plus className="mr-1.5 h-3 w-3" />New Memory
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
