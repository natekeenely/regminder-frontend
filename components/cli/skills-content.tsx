"use client"

import { useState, useEffect, useCallback } from "react"
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
  Bot,
  Brain,
  Check,
  ChevronRight,
  Copy,
  Edit3,
  FileText,
  Globe,
  Layers,
  Lock,
  Plus,
  Save,
  Search,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ───────── types ───────── */

interface SkillStep {
  order: number
  action: string
  description: string
  endpoint?: string
  method?: string
  payload?: string
}

interface SkillConfig {
  id: string
  name: string
  description: string
  module: string
  entity: string
  operation: "create" | "read" | "update" | "delete" | "workflow"
  icon: string
  enabled: boolean
  promptTemplateRef: string
  agentRef: string
  steps: SkillStep[]
  inputSchema: string
  outputExample: string
  tags: string[]
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
  const user = getCurrentUser()
  const role = getCurrentUserRole()
  return role === "admin" || item.createdBy === user
}

const SHARING_OPTIONS = [
  { value: "private", label: "Private", icon: Lock, color: "text-muted-foreground" },
  { value: "shared", label: "Shared", icon: Users, color: "text-blue-600" },
  { value: "public", label: "Public", icon: Globe, color: "text-green-600" },
] as const

/* ───────── constants ───────── */

const ICONS: Record<string, React.ReactNode> = {
  globe: <Globe className="h-5 w-5" />,
  shield: <Shield className="h-5 w-5" />,
  layers: <Layers className="h-5 w-5" />,
  zap: <Zap className="h-5 w-5" />,
  bot: <Bot className="h-5 w-5" />,
  sparkles: <Sparkles className="h-5 w-5" />,
}

const SKILL_OPERATIONS = [
  { value: "create", label: "Create", color: "text-green-600 bg-green-500/10 border-green-500/30" },
  { value: "read", label: "Read", color: "text-blue-600 bg-blue-500/10 border-blue-500/30" },
  { value: "update", label: "Update", color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  { value: "delete", label: "Delete", color: "text-red-600 bg-red-500/10 border-red-500/30" },
  { value: "workflow", label: "Workflow", color: "text-purple-600 bg-purple-500/10 border-purple-500/30" },
] as const

const MODULES = ["global", "mdm", "lims", "erp", "pm", "sd", "gma", "compliance"] as const

const DEFAULT_SKILLS: SkillConfig[] = [
  {
    id: "skill-country-create",
    name: "Create Country",
    description: "Creates a new country record in the MDM master data. Validates ISO 3166-1 alpha-2 code uniqueness and required fields before inserting.",
    module: "mdm",
    entity: "country",
    operation: "create",
    icon: "globe",
    enabled: true,
    promptTemplateRef: "",
    agentRef: "",
    steps: [
      { order: 1, action: "validate", description: "Validate required fields: country_code (ISO 3166-1 alpha-2), country_name, status" },
      { order: 2, action: "check_duplicate", description: "Query MDM to ensure country_code does not already exist", endpoint: "/api/v1/mdm/country", method: "GET" },
      { order: 3, action: "create", description: "Insert the new country record via MDM API", endpoint: "/api/v1/mdm/country", method: "POST", payload: '{ "country_code": "{{country_code}}", "country_name": "{{country_name}}", "status": "active" }' },
      { order: 4, action: "confirm", description: "Return the created record with its generated ID to the caller" },
    ],
    inputSchema: '{\n  "country_code": "string (2-char ISO 3166-1 alpha-2, required)",\n  "country_name": "string (required)",\n  "status": "string (active|inactive, default: active)"\n}',
    outputExample: '{\n  "ok": true,\n  "item": {\n    "id": "uuid",\n    "country_code": "SG",\n    "country_name": "Singapore",\n    "status": "active"\n  }\n}',
    tags: ["mdm", "country", "master-data"],
    createdBy: "System",
    sharing: "public",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "skill-country-delete",
    name: "Delete Country",
    description: "Soft-deletes a country record from MDM. Checks for dependent references (e.g. addresses, regulations linked to this country) before proceeding.",
    module: "mdm",
    entity: "country",
    operation: "delete",
    icon: "globe",
    enabled: true,
    promptTemplateRef: "",
    agentRef: "",
    steps: [
      { order: 1, action: "validate", description: "Validate that country_code or record ID is provided" },
      { order: 2, action: "check_references", description: "Check for dependent records (addresses, regulations, product lines) referencing this country", endpoint: "/api/v1/mdm/country/{{id}}/references", method: "GET" },
      { order: 3, action: "confirm_user", description: "If references exist, ask user for confirmation before proceeding with deletion" },
      { order: 4, action: "delete", description: "Soft-delete the country record (set status = deleted)", endpoint: "/api/v1/mdm/country/{{id}}", method: "DELETE" },
      { order: 5, action: "audit", description: "Log deletion event to audit trail with actor and timestamp" },
    ],
    inputSchema: '{\n  "id": "string (UUID, required)",\n  "force": "boolean (skip reference check, default: false)"\n}',
    outputExample: '{\n  "ok": true,\n  "deleted": true,\n  "id": "uuid",\n  "country_code": "SG"\n}',
    tags: ["mdm", "country", "master-data", "destructive"],
    createdBy: "System",
    sharing: "public",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "skill-standard-create",
    name: "Create Standard",
    description: "Creates a new standard/regulation record in the MDM compliance module. Supports ISO, EN, ASTM, and other standard bodies. Links to relevant product categories.",
    module: "mdm",
    entity: "standard",
    operation: "create",
    icon: "shield",
    enabled: true,
    promptTemplateRef: "",
    agentRef: "",
    steps: [
      { order: 1, action: "validate", description: "Validate required fields: standard_code, standard_name, standard_body, status" },
      { order: 2, action: "check_duplicate", description: "Query MDM to ensure standard_code is unique", endpoint: "/api/v1/mdm/standard", method: "GET" },
      { order: 3, action: "create", description: "Insert the new standard record via MDM API", endpoint: "/api/v1/mdm/standard", method: "POST", payload: '{ "standard_code": "{{standard_code}}", "standard_name": "{{standard_name}}", "standard_body": "{{standard_body}}", "version": "{{version}}", "status": "active" }' },
      { order: 4, action: "link_categories", description: "Optionally link the standard to product categories if category_ids are provided" },
      { order: 5, action: "confirm", description: "Return the created record with its generated ID" },
    ],
    inputSchema: '{\n  "standard_code": "string (e.g. ISO-9001, required)",\n  "standard_name": "string (required)",\n  "standard_body": "string (ISO|EN|ASTM|IEC|BS|DIN|other)",\n  "version": "string (e.g. 2015)",\n  "category_ids": "string[] (optional, link to product categories)",\n  "status": "string (active|draft|withdrawn, default: active)"\n}',
    outputExample: '{\n  "ok": true,\n  "item": {\n    "id": "uuid",\n    "standard_code": "ISO-9001",\n    "standard_name": "Quality management systems",\n    "standard_body": "ISO",\n    "version": "2015",\n    "status": "active"\n  }\n}',
    tags: ["mdm", "standard", "regulation", "compliance"],
    createdBy: "System",
    sharing: "public",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "skill-standard-delete",
    name: "Delete Standard",
    description: "Soft-deletes a standard/regulation record. Validates that no active test methods or compliance mappings depend on it before removal.",
    module: "mdm",
    entity: "standard",
    operation: "delete",
    icon: "shield",
    enabled: true,
    promptTemplateRef: "",
    agentRef: "",
    steps: [
      { order: 1, action: "validate", description: "Validate that standard ID or standard_code is provided" },
      { order: 2, action: "check_references", description: "Check for dependent records: test methods, compliance mappings, product line links", endpoint: "/api/v1/mdm/standard/{{id}}/references", method: "GET" },
      { order: 3, action: "confirm_user", description: "If dependencies exist, present them to the user and request explicit confirmation" },
      { order: 4, action: "delete", description: "Soft-delete the standard record (set status = withdrawn)", endpoint: "/api/v1/mdm/standard/{{id}}", method: "DELETE" },
      { order: 5, action: "audit", description: "Log deletion event to audit trail" },
    ],
    inputSchema: '{\n  "id": "string (UUID, required)",\n  "force": "boolean (skip reference check, default: false)"\n}',
    outputExample: '{\n  "ok": true,\n  "deleted": true,\n  "id": "uuid",\n  "standard_code": "ISO-9001"\n}',
    tags: ["mdm", "standard", "regulation", "compliance", "destructive"],
    createdBy: "System",
    sharing: "public",
    updatedAt: new Date().toISOString(),
  },
]

/* ───────── API Browser types ───────── */

interface ApiField { name: string; type: string; required: boolean; fk?: string | null }
interface ApiEntity { key: string; service: "MDM" | "SD"; columns: ApiField[] }
interface ApiOperation { label: string; method: string; pathSuffix: string; description: string; hasBody: boolean }

const API_OPERATIONS: ApiOperation[] = [
  { label: "List All",       method: "GET",    pathSuffix: "",       description: "Retrieve paginated list",     hasBody: false },
  { label: "Get by ID",      method: "GET",    pathSuffix: "/:id",   description: "Retrieve a single record",   hasBody: false },
  { label: "Create",         method: "POST",   pathSuffix: "",       description: "Insert a new record",        hasBody: true },
  { label: "Update",         method: "PUT",    pathSuffix: "/:id",   description: "Update an existing record",  hasBody: true },
  { label: "Patch",          method: "PATCH",  pathSuffix: "/:id",   description: "Partially update a record",  hasBody: true },
  { label: "Delete",         method: "DELETE", pathSuffix: "/:id",   description: "Remove a record",            hasBody: false },
]

const METHOD_COLORS: Record<string, string> = {
  GET: "text-blue-600 border-blue-500/30 bg-blue-500/10",
  POST: "text-green-600 border-green-500/30 bg-green-500/10",
  PUT: "text-amber-600 border-amber-500/30 bg-amber-500/10",
  PATCH: "text-amber-600 border-amber-500/30 bg-amber-500/10",
  DELETE: "text-red-600 border-red-500/30 bg-red-500/10",
}

function ApiBrowserDialog({ open, onClose, onSelect }: {
  open: boolean
  onClose: () => void
  onSelect: (data: { endpoint: string; method: string; action: string; description: string; payload?: string }) => void
}) {
  const [entities, setEntities] = useState<ApiEntity[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedEntity, setSelectedEntity] = useState<ApiEntity | null>(null)
  const [selectedOp, setSelectedOp] = useState<ApiOperation | null>(null)
  const [filterService, setFilterService] = useState<"all" | "MDM" | "SD">("all")

  const fetchEntities = useCallback(async () => {
    if (entities.length > 0) return
    setLoading(true)
    try {
      const [mdmRes, sdRes] = await Promise.all([
        fetch("/api/proxy/api/v1/mdm/entities").then((r) => r.json()).catch(() => null),
        fetch("/api/proxy/api/v1/sd/entities").then((r) => r.json()).catch(() => null),
      ])
      const list: ApiEntity[] = []
      if (mdmRes?.ok && mdmRes.entities) {
        for (const e of mdmRes.entities) {
          // fetch detailed column info per entity
          list.push({ key: e.key, service: "MDM", columns: (e.columns ?? []).map((c: string) => ({ name: c, type: "text", required: false })) })
        }
      }
      if (sdRes?.ok && sdRes.items) {
        for (const e of sdRes.items) {
          list.push({ key: e.key, service: "SD", columns: [] })
        }
      }
      setEntities(list)
    } finally { setLoading(false) }
  }, [entities.length])

  const fetchValidation = useCallback(async (entity: ApiEntity) => {
    if (entity.columns.length > 0 && entity.columns.some((c) => c.type !== "text" || c.required)) return entity
    try {
      const prefix = entity.service === "MDM" ? "mdm" : "mdm"
      const res = await fetch(`/api/proxy/api/v1/${prefix}/${entity.key}/validation`).then((r) => r.json())
      if (res?.ok && res.fields) {
        return { ...entity, columns: res.fields.map((f: any) => ({ name: f.name, type: f.type, required: f.required, fk: f.fk })) }
      }
    } catch { /* ignore */ }
    return entity
  }, [])

  useEffect(() => { if (open) fetchEntities() }, [open, fetchEntities])

  const handleSelectEntity = async (entity: ApiEntity) => {
    const enriched = await fetchValidation(entity)
    // update cache
    setEntities((prev) => prev.map((e) => e.key === enriched.key && e.service === enriched.service ? enriched : e))
    setSelectedEntity(enriched)
    setSelectedOp(null)
  }

  const handleConfirm = () => {
    if (!selectedEntity || !selectedOp) return
    const basePath = selectedEntity.service === "MDM" ? `/api/v1/mdm/${selectedEntity.key}` : `/api/v1/sd/${selectedEntity.key}`
    const endpoint = basePath + selectedOp.pathSuffix

    let payload: string | undefined
    if (selectedOp.hasBody && selectedEntity.columns.length > 0) {
      const obj: Record<string, string> = {}
      for (const col of selectedEntity.columns) {
        obj[col.name] = col.required ? `<${col.type}> (required)` : `<${col.type}>`
      }
      payload = JSON.stringify(obj, null, 2)
    }

    onSelect({
      endpoint,
      method: selectedOp.method,
      action: selectedOp.label.toLowerCase().replace(/\s+/g, "-"),
      description: `${selectedOp.description} — ${selectedEntity.key}`,
      payload,
    })
    setSelectedEntity(null)
    setSelectedOp(null)
    setSearch("")
    onClose()
  }

  const filtered = entities.filter((e) => {
    if (filterService !== "all" && e.service !== filterService) return false
    if (search && !e.key.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const mdmEntities = filtered.filter((e) => e.service === "MDM")
  const sdEntities = filtered.filter((e) => e.service === "SD")

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="relative flex h-[80vh] w-[900px] max-w-[95vw] flex-col rounded-2xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">API Browser</h2>
            <p className="text-xs text-muted-foreground">Select an entity and operation to auto-fill the execution step</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entities..." className="h-8 pl-8 text-xs" autoFocus />
          </div>
          <div className="flex gap-1">
            {(["all", "MDM", "SD"] as const).map((f) => (
              <button key={f} onClick={() => setFilterService(f)} className={cn("rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors", filterService === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{f === "all" ? "All" : f}</button>
            ))}
          </div>
          <Badge variant="outline" className="text-[10px]">{filtered.length} entities</Badge>
        </div>

        {/* Body — two-panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: entity list */}
          <div className="w-[320px] shrink-0 overflow-auto border-r border-border">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading APIs...</div>
            ) : (
              <div className="p-2 space-y-3">
                {mdmEntities.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Master Data (MDM)</div>
                    <div className="space-y-0.5">
                      {mdmEntities.map((e) => (
                        <button key={`mdm-${e.key}`} onClick={() => handleSelectEntity(e)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors", selectedEntity?.key === e.key && selectedEntity?.service === e.service ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{e.key}</div>
                          </div>
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {sdEntities.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Service Desk (SD)</div>
                    <div className="space-y-0.5">
                      {sdEntities.map((e) => (
                        <button key={`sd-${e.key}`} onClick={() => handleSelectEntity(e)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors", selectedEntity?.key === e.key && selectedEntity?.service === e.service ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{e.key}</div>
                          </div>
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {filtered.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No entities found</div>}
              </div>
            )}
          </div>

          {/* Right: detail panel */}
          <div className="flex-1 overflow-auto p-5">
            {!selectedEntity ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Globe className="h-10 w-10 opacity-30" />
                <div className="text-sm">Select an entity to view API details</div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Entity header */}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{selectedEntity.key}</h3>
                    <Badge variant="outline" className="text-[9px]">{selectedEntity.service}</Badge>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-primary/70">
                    {selectedEntity.service === "MDM" ? `/api/v1/mdm/${selectedEntity.key}` : `/api/v1/sd/${selectedEntity.key}`}
                  </div>
                </div>

                {/* Operations */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Select Operation</div>
                  <div className="grid grid-cols-3 gap-2">
                    {API_OPERATIONS.map((op) => (
                      <button key={op.label} onClick={() => setSelectedOp(op)} className={cn("rounded-lg border px-3 py-2.5 text-left transition-colors", selectedOp?.label === op.label ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold", METHOD_COLORS[op.method])}>{op.method}</span>
                          <span className="text-[11px] font-medium">{op.label}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{op.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Columns / Fields */}
                {selectedEntity.columns.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Fields ({selectedEntity.columns.length})</div>
                    <div className="max-h-[200px] overflow-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Field</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Type</th>
                            <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Req</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">FK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEntity.columns.map((col) => (
                            <tr key={col.name} className="border-t border-border/50 hover:bg-muted/30">
                              <td className="px-3 py-1.5 font-mono text-[11px]">{col.name}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{col.type}</td>
                              <td className="px-3 py-1.5 text-center">{col.required ? <Check className="inline h-3 w-3 text-green-600" /> : <span className="text-muted-foreground/40">—</span>}</td>
                              <td className="px-3 py-1.5 font-mono text-[10px] text-primary/70">{col.fk ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Preview & Confirm */}
                {selectedOp && (
                  <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="text-xs font-medium text-primary">Preview</div>
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold", METHOD_COLORS[selectedOp.method])}>{selectedOp.method}</span>
                      <span className="font-mono text-[11px] text-foreground">
                        {selectedEntity.service === "MDM" ? `/api/v1/mdm/${selectedEntity.key}` : `/api/v1/sd/${selectedEntity.key}`}{selectedOp.pathSuffix}
                      </span>
                    </div>
                    <Button size="sm" onClick={handleConfirm} className="h-8 text-xs"><Check className="mr-1.5 h-3 w-3" />Use This API</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── component ───────── */

export function SkillsContent() {
  const [skills, setSkills] = useState<SkillConfig[]>(DEFAULT_SKILLS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [search, setSearch] = useState("")
  const [filterModule, setFilterModule] = useState<string>("all")
  const [filterOp, setFilterOp] = useState<string>("all")
  const [message, setMessage] = useState("")

  // edit state
  const [draft, setDraft] = useState<SkillConfig | null>(null)
  const [newTag, setNewTag] = useState("")
  const [newStepAction, setNewStepAction] = useState("")
  const [newStepDesc, setNewStepDesc] = useState("")
  const [newStepMethod, setNewStepMethod] = useState("")
  const [newStepEndpoint, setNewStepEndpoint] = useState("")
  const [newStepPayload, setNewStepPayload] = useState("")
  const [showApiBrowser, setShowApiBrowser] = useState(false)

  const currentUser = getCurrentUser()
  const currentRole = getCurrentUserRole()

  // Visibility: own items + shared/public, or everything for admins
  const visibleSkills = skills.filter((s) => {
    if (currentRole === "admin") return true
    if (!s.sharing || s.sharing === "private") return (s.createdBy || "") === currentUser
    return true
  })

  const filtered = visibleSkills.filter((s) => {
    if (filterModule !== "all" && s.module !== filterModule) return false
    if (filterOp !== "all" && s.operation !== filterOp) return false
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.entity.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q))
    }
    return true
  })

  const selected = skills.find((s) => s.id === selectedId) ?? null

  function selectSkill(s: SkillConfig) {
    setSelectedId(s.id)
    setDraft({ ...s, steps: s.steps.map((st) => ({ ...st })), tags: [...s.tags] })
    setIsEditing(false)
    setIsCreating(false)
  }

  function duplicateSkill(source: SkillConfig) {
    const dup: SkillConfig = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (Copy)`,
      createdBy: getCurrentUser(),
      sharing: "private",
      steps: source.steps.map((st) => ({ ...st })),
      tags: [...source.tags],
      updatedAt: new Date().toISOString(),
    }
    setSkills((prev) => [...prev, dup])
    selectSkill(dup)
    setMessage("Skill duplicated")
    setTimeout(() => setMessage(""), 2000)
  }

  function startCreate() {
    const newSkill: SkillConfig = {
      id: crypto.randomUUID(),
      name: "New Skill",
      description: "",
      module: "mdm",
      entity: "",
      operation: "create",
      icon: "zap",
      enabled: true,
      promptTemplateRef: "",
      agentRef: "",
      steps: [],
      inputSchema: "{}",
      outputExample: "{}",
      tags: [],
      createdBy: getCurrentUser(),
      sharing: "private",
      updatedAt: new Date().toISOString(),
    }
    setDraft(newSkill)
    setSelectedId(newSkill.id)
    setIsCreating(true)
    setIsEditing(true)
  }

  function saveSkill() {
    if (!draft) return
    const updated = { ...draft, updatedAt: new Date().toISOString() }
    if (isCreating) {
      setSkills((prev) => [...prev, updated])
    } else {
      setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    }
    setIsEditing(false)
    setIsCreating(false)
    setMessage("Skill saved")
    setTimeout(() => setMessage(""), 2000)
  }

  function deleteSkill(id: string) {
    setSkills((prev) => prev.filter((s) => s.id !== id))
    if (selectedId === id) { setSelectedId(null); setDraft(null) }
  }

  function updateDraft(patch: Partial<SkillConfig>) {
    if (!draft) return
    setDraft({ ...draft, ...patch })
  }

  function addStep() {
    if (!draft || !newStepAction.trim()) return
    const step: SkillStep = {
      order: draft.steps.length + 1,
      action: newStepAction.trim(),
      description: newStepDesc.trim(),
      ...(newStepMethod.trim() && { method: newStepMethod.trim().toUpperCase() }),
      ...(newStepEndpoint.trim() && { endpoint: newStepEndpoint.trim() }),
      ...(newStepPayload.trim() && { payload: newStepPayload.trim() }),
    }
    setDraft({ ...draft, steps: [...draft.steps, step] })
    setNewStepAction("")
    setNewStepDesc("")
    setNewStepMethod("")
    setNewStepEndpoint("")
    setNewStepPayload("")
  }

  function removeStep(idx: number) {
    if (!draft) return
    const steps = draft.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }))
    setDraft({ ...draft, steps })
  }

  function addTag(value: string) {
    if (!draft || !value.trim()) return
    setDraft({ ...draft, tags: [...draft.tags, value.trim()] })
  }

  function removeTag(idx: number) {
    if (!draft) return
    setDraft({ ...draft, tags: draft.tags.filter((_, i) => i !== idx) })
  }

  const opMeta = (op: string) => SKILL_OPERATIONS.find((o) => o.value === op)

  // summary cards
  const totalEnabled = skills.filter((s) => s.enabled).length
  const byEntity = new Set(skills.map((s) => s.entity)).size

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Skills
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {message && <Badge variant="outline" className="text-xs text-green-600 border-green-500/30"><Check className="mr-1 h-3 w-3" />{message}</Badge>}
            <Button variant="outline" size="sm" onClick={startCreate} className="h-9 px-3 text-xs">
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Skill
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="border-b border-border bg-card/50 px-6 py-3">
        <div className="flex gap-6 text-xs">
          <div><span className="text-muted-foreground">Total: </span><span className="font-semibold text-foreground">{skills.length}</span></div>
          <div><span className="text-muted-foreground">Enabled: </span><span className="font-semibold text-green-600">{totalEnabled}</span></div>
          <div><span className="text-muted-foreground">Entities: </span><span className="font-semibold text-foreground">{byEntity}</span></div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: Skill List */}
        <div className="w-[340px] shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="border-b border-border p-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search skills..." className="h-9 pl-8 text-xs" />
            </div>
            <div className="flex gap-2">
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Module" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {MODULES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterOp} onValueChange={setFilterOp}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Operation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ops</SelectItem>
                  {SKILL_OPERATIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {filtered.map((s) => {
              const isActive = s.id === selectedId
              const op = opMeta(s.operation)
              return (
                <button
                  key={s.id}
                  onClick={() => selectSkill(s)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      s.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {ICONS[s.icon] ?? <Zap className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
                        {op && <Badge variant="outline" className={cn("text-[9px] shrink-0", op.color)}>{op.label}</Badge>}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{s.module.toUpperCase()} · {s.entity}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                        <User className="h-2.5 w-2.5" />{s.createdBy || "—"}
                        {s.sharing && s.sharing !== "private" && (
                          <Badge variant="outline" className={cn("text-[8px] px-1 py-0", s.sharing === "public" ? "text-green-600 border-green-500/30" : "text-blue-600 border-blue-500/30")}>
                            {s.sharing === "public" ? <Globe className="mr-0.5 h-2 w-2" /> : <Users className="mr-0.5 h-2 w-2" />}{s.sharing}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isActive && "rotate-90 text-primary")} />
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">{s.description}</div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">No skills match your filters.</div>
            )}
          </div>
        </div>

        {/* Right: Detail */}
        <div className="flex-1 overflow-auto p-6">
          {!draft ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Zap className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">Select a skill to view or configure</p>
            </div>
          ) : (
            <div className="space-y-5 max-w-3xl">
              {/* Basic Info */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Skill Configuration</h3>
                  <div className="flex items-center gap-2">
                    {draft.enabled ? <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-600">Enabled</Badge> : <Badge variant="outline" className="text-[9px]">Disabled</Badge>}
                  </div>
                </div>
                {/* Ownership & Sharing */}
                <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>Created by:</span>
                    <span className="font-medium text-foreground">{draft.createdBy || "—"}</span>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                    <Share2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Sharing:</span>
                    {isEditing ? (
                      <Select value={draft.sharing || "private"} onValueChange={(v) => updateDraft({ sharing: v as SkillConfig["sharing"] })}>
                        <SelectTrigger className="h-6 w-[110px] text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SHARING_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <div className="flex items-center gap-1.5"><o.icon className={cn("h-3 w-3", o.color)} /><span>{o.label}</span></div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={cn("text-[10px]",
                        (draft.sharing || "private") === "public" ? "text-green-600 border-green-500/30" :
                        (draft.sharing || "private") === "shared" ? "text-blue-600 border-blue-500/30" : ""
                      )}>{draft.sharing || "private"}</Badge>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Name</label>
                    <Input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} disabled={!isEditing} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Entity</label>
                    <Input value={draft.entity} onChange={(e) => updateDraft({ entity: e.target.value })} disabled={!isEditing} placeholder="e.g. country, standard" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Module</label>
                    <Select value={draft.module} onValueChange={(v) => updateDraft({ module: v })} disabled={!isEditing}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODULES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Operation</label>
                    <Select value={draft.operation} onValueChange={(v) => updateDraft({ operation: v as SkillConfig["operation"] })} disabled={!isEditing}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SKILL_OPERATIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                    <Input value={draft.description} onChange={(e) => updateDraft({ description: e.target.value })} disabled={!isEditing} />
                  </div>
                </div>
              </div>

              {/* References */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">References</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Prompt Template Ref</label>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input value={draft.promptTemplateRef} onChange={(e) => updateDraft({ promptTemplateRef: e.target.value })} disabled={!isEditing} placeholder="e.g. sys-global (from Prompt Templates)" className="flex-1" />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">Links to a prompt template ID from AI &gt; Prompt Templates</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Agent Ref</label>
                    <div className="flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input value={draft.agentRef} onChange={(e) => updateDraft({ agentRef: e.target.value })} disabled={!isEditing} placeholder="e.g. agent-hermes (from Agents & Workflows)" className="flex-1" />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">Links to an agent ID from AI &gt; Agents &amp; Workflows</p>
                  </div>
                </div>
              </div>

              {/* Execution Steps */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Execution Steps</h3>
                <div className="space-y-2">
                  {draft.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                        {step.order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-mono">{step.action}</Badge>
                          {step.method && <Badge variant="outline" className="text-[9px] font-mono text-blue-600 border-blue-500/30">{step.method}</Badge>}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{step.description}</div>
                        {step.endpoint && <div className="mt-0.5 font-mono text-[10px] text-primary/70">{step.endpoint}</div>}
                      </div>
                      {isEditing && (
                        <button onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {draft.steps.length === 0 && <div className="text-[11px] text-muted-foreground">No execution steps defined</div>}
                </div>
                {isEditing && (
                  <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] font-medium text-primary">Add Execution Step</div>
                      <Button variant="outline" size="sm" onClick={() => setShowApiBrowser(true)} className="h-6 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"><Globe className="h-3 w-3" />Browse API</Button>
                    </div>
                    <div className="flex gap-2">
                      <Input value={newStepAction} onChange={(e) => setNewStepAction(e.target.value)} placeholder="Action (e.g. validate)" className="h-8 text-xs font-mono w-32" />
                      <select value={newStepMethod} onChange={(e) => setNewStepMethod(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs font-mono w-24">
                        <option value="">Method</option>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                      <Input value={newStepEndpoint} onChange={(e) => setNewStepEndpoint(e.target.value)} placeholder="Endpoint (e.g. /api/v1/mdm/country)" className="h-8 text-xs font-mono flex-1" />
                    </div>
                    <div className="flex gap-2">
                      <Input value={newStepDesc} onChange={(e) => setNewStepDesc(e.target.value)} placeholder="Step description" className="h-8 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter") addStep() }} />
                      <Button variant="outline" size="sm" onClick={addStep} className="h-8 text-xs shrink-0" disabled={!newStepAction.trim()}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                  </div>
                )}
                <ApiBrowserDialog open={showApiBrowser} onClose={() => setShowApiBrowser(false)} onSelect={(data) => {
                  setNewStepAction(data.action)
                  setNewStepMethod(data.method)
                  setNewStepEndpoint(data.endpoint)
                  setNewStepDesc(data.description)
                  if (data.payload) setNewStepPayload(data.payload)
                }} />
              </div>

              {/* Input / Output Schema */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Input / Output</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Input Schema</label>
                    <textarea
                      value={draft.inputSchema}
                      onChange={(e) => updateDraft({ inputSchema: e.target.value })}
                      disabled={!isEditing}
                      className="h-32 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed outline-none focus:border-primary disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Output Example</label>
                    <textarea
                      value={draft.outputExample}
                      onChange={(e) => updateDraft({ outputExample: e.target.value })}
                      disabled={!isEditing}
                      className="h-32 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed outline-none focus:border-primary disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {draft.tags.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px]">
                      {t}
                      {isEditing && <button onClick={() => removeTag(i)} className="ml-0.5 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>}
                    </span>
                  ))}
                  {draft.tags.length === 0 && <span className="text-[11px] text-muted-foreground">No tags</span>}
                </div>
                {isEditing && (
                  <div className="flex gap-2">
                    <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." className="h-8 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter") { addTag(newTag); setNewTag("") } }} />
                    <Button variant="outline" size="sm" onClick={() => { addTag(newTag); setNewTag("") }} className="h-8 text-xs"><Plus className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    {canEdit(draft) && <Button size="sm" onClick={() => setIsEditing(true)} className="h-8 text-xs"><Edit3 className="mr-1.5 h-3 w-3" />Edit</Button>}
                    {selected && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => duplicateSkill(selected)} className="h-8 text-xs"><Copy className="mr-1.5 h-3 w-3" />Duplicate</Button>
                        {canEdit(draft) && <Button variant="ghost" size="sm" onClick={() => deleteSkill(selected.id)} className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="mr-1.5 h-3 w-3" />Delete</Button>}
                      </>
                    )}
                    {!canEdit(draft) && <span className="text-[11px] text-muted-foreground italic">View only — owned by {draft.createdBy}</span>}
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={saveSkill} className="h-8 text-xs"><Save className="mr-1.5 h-3 w-3" />{isCreating ? "Create" : "Save"}</Button>
                    <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setIsCreating(false); if (selected) selectSkill(selected) }} className="h-8 text-xs"><X className="mr-1.5 h-3 w-3" />Cancel</Button>
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
