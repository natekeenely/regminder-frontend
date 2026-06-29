"use client"

import { useEffect, useMemo, useState } from "react"
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
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  FileText,
  Globe,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ───────── types ───────── */

interface PromptTemplate {
  id: string
  name: string
  category: "system" | "persona" | "instruction" | "few-shot" | "guard-rail"
  module: string
  content: string
  variables: string[]
  isDefault: boolean
  createdBy: string
  sharing: "private" | "shared" | "public"
  updatedAt: string
}

/* ───────── ownership helpers ───────── */

function getCurrentUser(): string {
  try { return window.localStorage.getItem("hermes.displayName") ?? "Demo User" } catch { return "Demo User" }
}
function getCurrentUserRole(): string {
  try { return window.localStorage.getItem("hermes.userRole") ?? "admin" } catch { return "admin" }
}
function canEdit(item: { createdBy: string }): boolean {
  const user = getCurrentUser(); const role = getCurrentUserRole()
  return role === "admin" || item.createdBy === user
}
const SHARING_OPTIONS = [
  { value: "private", label: "Private", icon: Lock, color: "text-muted-foreground" },
  { value: "shared", label: "Shared", icon: Users, color: "text-blue-600" },
  { value: "public", label: "Public", icon: Globe, color: "text-green-600" },
] as const

/* ───────── constants ───────── */

const CATEGORIES = [
  { value: "system", label: "System Prompt", color: "text-blue-600 bg-blue-500/10 border-blue-500/30" },
  { value: "persona", label: "Persona", color: "text-purple-600 bg-purple-500/10 border-purple-500/30" },
  { value: "instruction", label: "Instruction Set", color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  { value: "few-shot", label: "Few-Shot Examples", color: "text-green-600 bg-green-500/10 border-green-500/30" },
  { value: "guard-rail", label: "Guard Rail", color: "text-red-600 bg-red-500/10 border-red-500/30" },
] as const

const MODULES = ["global", "lims", "erp", "pm", "sd", "gma", "compliance", "mdm"] as const

const DEFAULT_TEMPLATES: PromptTemplate[] = []

/* ───────── component ───────── */

const PROMPTS_LOCAL_KEY = "hermes.aiPrompts"
function loadPromptsFromStorage(): PromptTemplate[] {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES
  try {
    const raw = window.localStorage.getItem(PROMPTS_LOCAL_KEY)
    if (raw) return JSON.parse(raw) as PromptTemplate[]
  } catch { /* ignore */ }
  return DEFAULT_TEMPLATES
}
function persistPrompts(list: PromptTemplate[]) {
  try { window.localStorage.setItem(PROMPTS_LOCAL_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function AiPromptsContent() {
  const [templates, setTemplates] = useState<PromptTemplate[]>(() => loadPromptsFromStorage())
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterModule, setFilterModule] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [editName, setEditName] = useState("")
  const [editCategory, setEditCategory] = useState<string>("system")
  const [editModule, setEditModule] = useState<string>("global")
  const [editSharing, setEditSharing] = useState<"private" | "shared" | "public">("private")
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [message, setMessage] = useState("")

  const currentUser = getCurrentUser()
  const currentRole = getCurrentUserRole()

  const visible = useMemo(() => {
    return templates.filter((t) => {
      if (currentRole === "admin") return true
      if (!t.sharing || t.sharing === "private") return (t.createdBy || "") === currentUser
      return true
    })
  }, [templates, currentUser, currentRole])

  const filtered = useMemo(() => {
    return visible.filter((t) => {
      if (filterCategory !== "all" && t.category !== filterCategory) return false
      if (filterModule !== "all" && t.module !== filterModule) return false
      if (search) {
        const q = search.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q) || t.module.toLowerCase().includes(q)
      }
      return true
    })
  }, [visible, search, filterCategory, filterModule])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  function selectTemplate(t: PromptTemplate) {
    setSelectedId(t.id)
    setEditDraft(t.content)
    setEditName(t.name)
    setEditCategory(t.category)
    setEditModule(t.module)
    setEditSharing(t.sharing || "private")
    setIsEditing(false)
    setIsCreating(false)
  }

  function startCreate() {
    setIsCreating(true)
    setIsEditing(true)
    setSelectedId(null)
    setEditName("")
    setEditDraft("")
    setEditCategory("system")
    setEditModule("global")
    setEditSharing("private")
  }

  function saveTemplate() {
    if (isCreating) {
      const newT: PromptTemplate = {
        id: crypto.randomUUID(),
        name: editName || "Untitled Template",
        category: editCategory as PromptTemplate["category"],
        module: editModule,
        content: editDraft,
        variables: extractVariables(editDraft),
        isDefault: false,
        createdBy: getCurrentUser(),
        sharing: "private",
        updatedAt: new Date().toISOString(),
      }
      const next = [...templates, newT]
      setTemplates(next)
      persistPrompts(next)
      setSelectedId(newT.id)
      setIsCreating(false)
      setIsEditing(false)
      setMessage("Template created")
    } else if (selectedId) {
      const next = templates.map((t) =>
        t.id === selectedId
          ? { ...t, name: editName, category: editCategory as PromptTemplate["category"], module: editModule, content: editDraft, variables: extractVariables(editDraft), sharing: editSharing, updatedAt: new Date().toISOString() }
          : t
      )
      setTemplates(next)
      persistPrompts(next)
      setIsEditing(false)
      setMessage("Template saved")
    }
    setTimeout(() => setMessage(""), 2000)
  }

  function deleteTemplate(id: string) {
    const next = templates.filter((t) => t.id !== id)
    setTemplates(next)
    persistPrompts(next)
    if (selectedId === id) { setSelectedId(null); setIsEditing(false) }
  }

  function duplicateTemplate(t: PromptTemplate) {
    const dup: PromptTemplate = { ...t, id: crypto.randomUUID(), name: `${t.name} (Copy)`, isDefault: false, createdBy: getCurrentUser(), sharing: "private", updatedAt: new Date().toISOString() }
    const next = [...templates, dup]
    setTemplates(next)
    persistPrompts(next)
    selectTemplate(dup)
    setMessage("Template duplicated")
    setTimeout(() => setMessage(""), 2000)
  }

  function extractVariables(content: string): string[] {
    const matches = content.match(/\{\{(\w+)\}\}/g)
    if (!matches) return []
    return Array.from(new Set(matches.map((m) => m.replace(/\{|\}/g, ""))))
  }

  function categoryMeta(cat: string) {
    return CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[0]
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Prompt Templates
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {message && <Badge variant="outline" className="text-xs text-green-600 border-green-500/30"><Check className="mr-1 h-3 w-3" />{message}</Badge>}
            <Button variant="outline" size="sm" onClick={startCreate} className="h-9 px-3 text-xs">
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Template
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: List */}
        <div className="w-[380px] shrink-0 border-r border-border flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="border-b border-border p-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="h-9 pl-8 text-xs" />
            </div>
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 text-[11px] flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="h-8 text-[11px] flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {MODULES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Template List */}
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {filtered.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No templates match the current filters.</div>
            )}
            {filtered.map((t) => {
              const catMeta = categoryMeta(t.category)
              const isActive = t.id === selectedId
              return (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{t.name}</span>
                        {t.isDefault && <Badge variant="outline" className="text-[9px] shrink-0">Default</Badge>}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[9px] border", catMeta.color)}>{catMeta.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{t.module.toUpperCase()}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.createdBy || "Unknown"}</span>
                        {(() => { const sh = SHARING_OPTIONS.find((s) => s.value === (t.sharing || "private")); if (!sh) return null; const Icon = sh.icon; return <span className={cn("flex items-center gap-0.5", sh.color)}><Icon className="h-3 w-3" />{sh.label}</span> })()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <ChevronRight className={cn("h-4 w-4 transition-transform text-muted-foreground", isActive && "rotate-90 text-primary")} />
                      {!canEdit(t) && <span className="text-[9px] text-muted-foreground italic">view only</span>}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">{t.content.slice(0, 120)}</div>
                  {t.variables.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.variables.slice(0, 4).map((v) => (
                        <span key={v} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground font-mono">{`{{${v}}}`}</span>
                      ))}
                      {t.variables.length > 4 && <span className="text-[9px] text-muted-foreground">+{t.variables.length - 4}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Detail / Editor */}
        <div className="flex-1 overflow-auto p-6">
          {!selected && !isCreating ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <BookOpen className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">Select a template to view or edit</p>
              <p className="mt-1 text-xs">Or create a new one with the button above</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl">
              {/* Name & Meta */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={!isEditing}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Category</label>
                  <Select value={editCategory} onValueChange={setEditCategory} disabled={!isEditing}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Module</label>
                  <Select value={editModule} onValueChange={setEditModule} disabled={!isEditing}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODULES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Content Editor */}
              <div>
                <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Prompt Content</span>
                  <span className="font-mono">{editDraft.length} chars</span>
                </label>
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  disabled={!isEditing}
                  readOnly={!isEditing && selected ? !canEdit(selected) : false}
                  className={cn(
                    "w-full rounded-lg border border-border bg-background p-3 text-xs font-mono leading-6 outline-none resize-none",
                    isEditing ? "min-h-[320px]" : "min-h-[240px] bg-muted/20"
                  )}
                />
              </div>

              {/* Variables */}
              {extractVariables(editDraft).length > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-2 text-[11px] font-medium text-foreground">Detected Variables</div>
                  <div className="flex flex-wrap gap-1.5">
                    {extractVariables(editDraft).map((v) => (
                      <span key={v} className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-[11px] font-mono text-primary">
                        <Sparkles className="mr-1 h-3 w-3" />
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ownership & Sharing */}
              {(selected || isCreating) && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  {selected && !isCreating && (
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Created by: <strong className="text-foreground">{selected.createdBy || "Unknown"}</strong></span>
                    </div>
                  )}
                  {isEditing && (isCreating || (selected && canEdit(selected))) ? (
                    <div className="flex items-center gap-2">
                      <Share2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Sharing:</span>
                      <Select value={editSharing} onValueChange={(v) => setEditSharing(v as any)}>
                        <SelectTrigger className="h-6 w-[110px] text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SHARING_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <div className="flex items-center gap-1.5">
                                <o.icon className={cn("h-3 w-3", o.color)} />
                                <span>{o.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : selected ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Share2 className="h-3 w-3" />
                      <span>Sharing:</span>
                      <Badge variant="outline" className={cn("text-[10px]",
                        (selected.sharing || "private") === "public" ? "text-green-600 border-green-500/30" :
                        (selected.sharing || "private") === "shared" ? "text-blue-600 border-blue-500/30" : ""
                      )}>{selected.sharing || "private"}</Badge>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    {selected && canEdit(selected) && (
                      <Button size="sm" onClick={() => setIsEditing(true)} className="h-8 text-xs">
                        <Edit3 className="mr-1.5 h-3 w-3" />Edit
                      </Button>
                    )}
                    {selected && (
                      <Button variant="outline" size="sm" onClick={() => duplicateTemplate(selected)} className="h-8 text-xs">
                        <Copy className="mr-1.5 h-3 w-3" />Duplicate
                      </Button>
                    )}
                    {selected && canEdit(selected) && !selected.isDefault && (
                      <Button variant="ghost" size="sm" onClick={() => deleteTemplate(selected.id)} className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="mr-1.5 h-3 w-3" />Delete
                      </Button>
                    )}
                    {selected && !canEdit(selected) && <span className="text-xs text-muted-foreground italic">View only — duplicate to customize</span>}
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={saveTemplate} className="h-8 text-xs">
                      <Save className="mr-1.5 h-3 w-3" />
                      {isCreating ? "Create" : "Save"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setIsCreating(false); if (selected) selectTemplate(selected) }} className="h-8 text-xs">
                      <X className="mr-1.5 h-3 w-3" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
