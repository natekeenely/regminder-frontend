"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  ChevronRight,
  Columns3,
  Copy,
  Database,
  Eye,
  FileJson,
  FileText,
  FlaskConical,
  GitBranch,
  Globe,
  Key,
  Layers,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Rows3,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  Table2,
  Trash2,
  Type,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import PipelineEditor from "./pipeline-editor"

/* ───────── types ───────── */

type SourceTab = "dify" | "postgres" | "mongo"

// Dify types
type DatasetDetailTab = "documents" | "pipeline" | "retrieval" | "settings"

interface DifyDataset {
  id: string
  name: string
  description: string
  document_count: number
  word_count: number
  app_count: number
  embedding_model: string
  embedding_model_provider: string
  indexing_technique: string
  permission: string
  created_at: number
  updated_at: number
}

interface DifyDocument {
  id: string
  name: string
  data_source_type: string
  word_count: number
  tokens: number
  hit_count: number
  indexing_status: string
  enabled: boolean
  archived: boolean
  created_at: number
}

// PostgreSQL types
interface PgColumn {
  name: string
  type: string
}

interface PgSource {
  key: string
  table: string
  columnCount: number
  rowCount: number
  columns: PgColumn[]
}

interface PgPreview {
  table: string
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
}

// MongoDB types
interface MongoSource {
  name: string
  type: string
  documentCount: number
  fields: string[]
}

interface MongoPreview {
  collection: string
  documents: Record<string, unknown>[]
  total: number
}

/* ───────── Icon Picker (shared with datasets) ───────── */

const DATASET_EMOJIS = [
  "📚", "🗂️", "📊", "🧠", "💡", "🔍", "📝", "📈",
  "⚡", "🔧", "🔬", "🧪", "📋", "💬", "🌐", "🏗️",
  "📦", "🎯", "🚀", "✨", "🔮", "🛡️", "📌", "💎",
  "🤝", "📡", "🧬", "🔑", "🌟", "💼", "🗃️", "🎪",
]

const DATASET_ICON_BGS = [
  "#D1E9FF", "#E4FBCC", "#D3F8DF", "#FFEAD5", "#E8D0FF",
  "#FFD6E7", "#FFF1C2", "#D5F5F6", "#E0DFFF", "#FCE1CD",
  "#F5F5F5", "#FEE4E2", "#D4E5FE", "#C7F7E4", "#FDDCAB",
]

// Local icon storage for datasets (persisted in localStorage)
type DatasetIconData = { emoji: string; bg: string; type?: "emoji" | "image"; imageUrl?: string }

function getDatasetIcons(): Record<string, DatasetIconData> {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem("regminder_dataset_icons") || "{}") } catch { return {} }
}
function setDatasetIcon(id: string, emoji: string, bg: string, type: "emoji" | "image" = "emoji", imageUrl?: string) {
  const icons = getDatasetIcons()
  icons[id] = { emoji, bg, type, imageUrl }
  localStorage.setItem("regminder_dataset_icons", JSON.stringify(icons))
}

function DatasetIconPicker({ emoji, bg, iconType, imageUrl, onChange }: {
  emoji: string; bg: string; iconType: "emoji" | "image"; imageUrl?: string
  onChange: (emoji: string, bg: string, type: "emoji" | "image", imageUrl?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pickerTab, setPickerTab] = useState<"emoji" | "image">(iconType)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB"); return }
    setUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      onChange(emoji, bg, "image", dataUrl)
      setOpen(false)
    } catch { /* ignore */ }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-2xl transition-colors overflow-hidden"
        style={{ backgroundColor: iconType === "emoji" ? bg : undefined }}
      >
        {iconType === "image" && imageUrl ? (
          <img src={imageUrl} alt="icon" className="h-full w-full object-cover" />
        ) : (
          emoji
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-14 z-50 rounded-xl border border-border bg-popover p-3 shadow-lg w-80">
            {/* Tab switcher */}
            <div className="flex gap-1 mb-3 border-b border-border pb-2">
              <button
                onClick={() => setPickerTab("emoji")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  pickerTab === "emoji" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Emoji
              </button>
              <button
                onClick={() => setPickerTab("image")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  pickerTab === "image" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Upload Image
              </button>
            </div>

            {pickerTab === "emoji" ? (
              <>
                <div className="grid grid-cols-8 gap-1 mb-3">
                  {DATASET_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { onChange(e, bg, "emoji"); setOpen(false) }}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-muted transition-colors",
                        iconType === "emoji" && emoji === e && "bg-primary/10 ring-1 ring-primary/30",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-2 tracking-wider">BACKGROUND</p>
                <div className="flex flex-wrap gap-1.5">
                  {DATASET_ICON_BGS.map((b) => (
                    <button
                      key={b}
                      onClick={() => onChange(emoji, b, "emoji")}
                      className={cn(
                        "h-6 w-6 rounded-full border transition-all",
                        bg === b ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border hover:scale-105",
                      )}
                      style={{ backgroundColor: b }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : iconType === "image" && imageUrl ? (
                    <img src={imageUrl} alt="preview" className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {uploading ? "Processing..." : "Click to select an image"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">PNG, JPG, SVG, WEBP — max 5 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ───────── API helpers ───────── */

async function fetchDifyDatasets(): Promise<DifyDataset[]> {
  try {
    const resp = await fetch("/api/proxy/api/v1/dify/datasets?limit=100")
    if (!resp.ok) return []
    const json = await resp.json()
    return json.data ?? []
  } catch {
    return []
  }
}

async function fetchDifyDocuments(datasetId: string): Promise<DifyDocument[]> {
  try {
    const resp = await fetch(`/api/proxy/api/v1/dify/datasets/${datasetId}/documents?limit=100`)
    if (!resp.ok) return []
    const json = await resp.json()
    return json.data ?? []
  } catch {
    return []
  }
}

async function createDifyDataset(name: string, description: string): Promise<{ id: string } | null> {
  try {
    const resp = await fetch("/api/proxy/api/v1/dify/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

async function updateDifyDataset(id: string, body: { name?: string; description?: string }): Promise<DifyDataset | null> {
  try {
    const resp = await fetch(`/api/proxy/api/v1/dify/datasets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

async function deleteDifyDataset(id: string): Promise<boolean> {
  try {
    await fetch(`/api/proxy/api/v1/dify/datasets/${id}`, { method: "DELETE" })
    return true
  } catch {
    return false
  }
}

async function addDifyTextDocument(datasetId: string, name: string, text: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/proxy/api/v1/dify/datasets/${datasetId}/documents/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, text }),
    })
    return resp.ok
  } catch {
    return false
  }
}

async function deleteDifyDocument(datasetId: string, docId: string): Promise<boolean> {
  try {
    await fetch(`/api/proxy/api/v1/dify/datasets/${datasetId}/documents/${docId}`, { method: "DELETE" })
    return true
  } catch {
    return false
  }
}

async function fetchPgSources(): Promise<PgSource[]> {
  try {
    const resp = await fetch("/api/proxy/api/v1/knowledge/pg-sources")
    if (!resp.ok) return []
    return await resp.json()
  } catch {
    return []
  }
}

async function fetchPgPreview(entityKey: string): Promise<PgPreview | null> {
  try {
    const resp = await fetch(`/api/proxy/api/v1/knowledge/pg-sources/${entityKey}/preview`)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

async function fetchMongoSources(): Promise<MongoSource[]> {
  try {
    const resp = await fetch("/api/proxy/api/v1/knowledge/mongo-sources")
    if (!resp.ok) return []
    return await resp.json()
  } catch {
    return []
  }
}

async function fetchMongoPreview(collection: string): Promise<MongoPreview | null> {
  try {
    const resp = await fetch(`/api/proxy/api/v1/knowledge/mongo-sources/${collection}/preview`)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

/* ───────── component ───────── */

export function AiKnowledgeContent() {
  const [activeTab, setActiveTab] = useState<SourceTab>("dify")
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState("")

  // Dify state
  const [difyDatasets, setDifyDatasets] = useState<DifyDataset[]>([])
  const [difyLoading, setDifyLoading] = useState(false)
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)
  const [difyDocs, setDifyDocs] = useState<DifyDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createDesc, setCreateDesc] = useState("")
  const [addTextMode, setAddTextMode] = useState(false)
  const [addTextName, setAddTextName] = useState("")
  const [addTextContent, setAddTextContent] = useState("")
  const [editDataset, setEditDataset] = useState<DifyDataset | null>(null)

  // PostgreSQL state
  const [pgSources, setPgSources] = useState<PgSource[]>([])
  const [pgLoading, setPgLoading] = useState(false)
  const [selectedPgKey, setSelectedPgKey] = useState<string | null>(null)
  const [pgPreview, setPgPreview] = useState<PgPreview | null>(null)
  const [pgPreviewLoading, setPgPreviewLoading] = useState(false)

  // MongoDB state
  const [mongoSources, setMongoSources] = useState<MongoSource[]>([])
  const [mongoLoading, setMongoLoading] = useState(false)
  const [selectedMongoCollection, setSelectedMongoCollection] = useState<string | null>(null)
  const [mongoPreview, setMongoPreview] = useState<MongoPreview | null>(null)
  const [mongoPreviewLoading, setMongoPreviewLoading] = useState(false)

  function flash(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(""), 2500)
  }

  /* ── Dify loaders ── */

  async function loadDifyDatasets() {
    setDifyLoading(true)
    try {
      const data = await fetchDifyDatasets()
      setDifyDatasets(data)
    } finally {
      setDifyLoading(false)
    }
  }

  async function selectDataset(ds: DifyDataset) {
    setSelectedDatasetId(ds.id)
    setIsCreating(false)
    setAddTextMode(false)
    setDocsLoading(true)
    try {
      const docs = await fetchDifyDocuments(ds.id)
      setDifyDocs(docs)
    } finally {
      setDocsLoading(false)
    }
  }

  async function handleCreateDataset() {
    if (!createName.trim()) return
    const result = await createDifyDataset(createName.trim(), createDesc.trim())
    if (result) {
      flash("Dataset created")
      setIsCreating(false)
      setCreateName("")
      setCreateDesc("")
      await loadDifyDatasets()
      setSelectedDatasetId(result.id)
    } else {
      flash("Failed to create dataset")
    }
  }

  async function handleDeleteDataset(id: string) {
    await deleteDifyDataset(id)
    setDifyDatasets((prev) => prev.filter((d) => d.id !== id))
    if (selectedDatasetId === id) {
      setSelectedDatasetId(null)
      setDifyDocs([])
    }
    flash("Dataset deleted")
  }

  async function handleAddTextDoc() {
    if (!addTextContent.trim() || !selectedDatasetId) return
    const ok = await addDifyTextDocument(selectedDatasetId, addTextName.trim() || "Text snippet", addTextContent.trim())
    if (ok) {
      flash("Document added")
      setAddTextMode(false)
      setAddTextName("")
      setAddTextContent("")
      const docs = await fetchDifyDocuments(selectedDatasetId)
      setDifyDocs(docs)
    } else {
      flash("Failed to add document")
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!selectedDatasetId) return
    await deleteDifyDocument(selectedDatasetId, docId)
    setDifyDocs((prev) => prev.filter((d) => d.id !== docId))
    flash("Document deleted")
  }

  /* ── PostgreSQL loaders ── */

  async function loadPgSources() {
    setPgLoading(true)
    try {
      const data = await fetchPgSources()
      setPgSources(data)
    } finally {
      setPgLoading(false)
    }
  }

  async function selectPgSource(src: PgSource) {
    setSelectedPgKey(src.key)
    setPgPreview(null)
    setPgPreviewLoading(true)
    try {
      const preview = await fetchPgPreview(src.key)
      setPgPreview(preview)
    } finally {
      setPgPreviewLoading(false)
    }
  }

  /* ── MongoDB loaders ── */

  async function loadMongoSources() {
    setMongoLoading(true)
    try {
      const data = await fetchMongoSources()
      setMongoSources(data)
    } finally {
      setMongoLoading(false)
    }
  }

  async function selectMongoSource(src: MongoSource) {
    setSelectedMongoCollection(src.name)
    setMongoPreview(null)
    setMongoPreviewLoading(true)
    try {
      const preview = await fetchMongoPreview(src.name)
      setMongoPreview(preview)
    } finally {
      setMongoPreviewLoading(false)
    }
  }

  /* ── Load on tab change ── */

  useEffect(() => {
    if (activeTab === "dify" && difyDatasets.length === 0) void loadDifyDatasets()
    if (activeTab === "postgres" && pgSources.length === 0) void loadPgSources()
    if (activeTab === "mongo" && mongoSources.length === 0) void loadMongoSources()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Refresh handler ── */

  function handleRefresh() {
    if (activeTab === "dify") void loadDifyDatasets()
    if (activeTab === "postgres") { setSelectedPgKey(null); setPgPreview(null); void loadPgSources() }
    if (activeTab === "mongo") { setSelectedMongoCollection(null); setMongoPreview(null); void loadMongoSources() }
  }

  const isLoading = activeTab === "dify" ? difyLoading : activeTab === "postgres" ? pgLoading : mongoLoading

  /* ── Filtered lists ── */

  const filteredDify = difyDatasets.filter((ds) => {
    if (!search) return true
    const q = search.toLowerCase()
    return ds.name.toLowerCase().includes(q) || (ds.description ?? "").toLowerCase().includes(q)
  })

  const filteredPg = pgSources.filter((src) => {
    if (!search) return true
    return src.table.toLowerCase().includes(search.toLowerCase())
  })

  const filteredMongo = mongoSources.filter((src) => {
    if (!search) return true
    return src.name.toLowerCase().includes(search.toLowerCase())
  })

  /* ── Selected items ── */

  const selectedDataset = difyDatasets.find((d) => d.id === selectedDatasetId) ?? null
  const selectedPg = pgSources.find((s) => s.key === selectedPgKey) ?? null
  const selectedMongo = mongoSources.find((s) => s.name === selectedMongoCollection) ?? null

  const TAB_ITEMS: { key: SourceTab; label: string; icon: React.ReactNode }[] = [
    { key: "dify", label: "Dify Datasets", icon: <Layers className="h-3.5 w-3.5" /> },
    { key: "postgres", label: "PostgreSQL", icon: <Server className="h-3.5 w-3.5" /> },
    { key: "mongo", label: "MongoDB", icon: <FileJson className="h-3.5 w-3.5" /> },
  ]

  /* ── Dify detail view (full-page like AppConfigView) ── */
  if (activeTab === "dify" && selectedDataset) {
    return (
      <DifyDetailPanel
        dataset={selectedDataset}
        docs={difyDocs}
        docsLoading={docsLoading}
        addTextMode={addTextMode}
        addTextName={addTextName}
        addTextContent={addTextContent}
        onToggleAddText={() => { setAddTextMode(!addTextMode); setAddTextName(""); setAddTextContent("") }}
        onAddTextNameChange={setAddTextName}
        onAddTextContentChange={setAddTextContent}
        onAddText={handleAddTextDoc}
        onDeleteDoc={handleDeleteDoc}
        onDeleteDataset={() => handleDeleteDataset(selectedDataset.id)}
        onBack={() => { setSelectedDatasetId(null); setDifyDocs([]) }}
      />
    )
  }

  if (activeTab === "postgres" && selectedPg) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-auto bg-background p-6">
        <PgDetailPanel
          source={selectedPg}
          preview={pgPreview}
          loading={pgPreviewLoading}
          onBack={() => { setSelectedPgKey(null); setPgPreview(null) }}
        />
      </div>
    )
  }

  if (activeTab === "mongo" && selectedMongo) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-auto bg-background p-6">
        <MongoDetailPanel
          source={selectedMongo}
          preview={mongoPreview}
          loading={mongoPreviewLoading}
          onBack={() => { setSelectedMongoCollection(null); setMongoPreview(null) }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header — same pattern as AI Apps */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Knowledge Database</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeTab === "dify" ? "Search datasets..." : activeTab === "postgres" ? "Search tables..." : "Search collections..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-52 rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          {activeTab === "dify" && (
            <Button size="sm" onClick={() => { setIsCreating(true); setSelectedDatasetId(null); setCreateName(""); setCreateDesc("") }} className="h-9">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Dataset
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
            <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
          {message && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
              <Check className="mr-1 h-3 w-3" />{message}
            </Badge>
          )}
        </div>

        {/* Source Tabs */}
        <div className="flex gap-1 mt-4">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(""); setIsCreating(false) }}
              className={cn(
                "flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "border-border bg-background text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — card grid */}
      <div className="flex-1 overflow-auto p-6">
        {/* Dify: create form (inline) */}
        {activeTab === "dify" && isCreating && (
          <div className="mb-6">
            <DifyCreatePanel
              name={createName}
              desc={createDesc}
              onNameChange={setCreateName}
              onDescChange={setCreateDesc}
              onCreate={handleCreateDataset}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Dify card grid */}
        {activeTab === "dify" && !isLoading && (
          <>
            {filteredDify.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDify.map((ds) => (
                  <DatasetCard
                    key={ds.id}
                    dataset={ds}
                    onClick={() => selectDataset(ds)}
                    onEdit={() => setEditDataset(ds)}
                    onDuplicate={async () => {
                      const result = await createDifyDataset(`${ds.name} (copy)`, ds.description ?? "")
                      if (result) { flash("Dataset duplicated"); await loadDifyDatasets() }
                    }}
                    onDelete={() => handleDeleteDataset(ds.id)}
                  />
                ))}
              </div>
            ) : !isCreating ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Layers className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">{search ? `No datasets matching "${search}"` : "No datasets yet"}</p>
                <p className="text-xs mt-1">Create your first dataset to get started</p>
                <Button size="sm" className="mt-4" onClick={() => { setIsCreating(true); setCreateName(""); setCreateDesc("") }}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />New Dataset
                </Button>
              </div>
            ) : null}
          </>
        )}

        {/* PostgreSQL card grid */}
        {activeTab === "postgres" && !isLoading && (
          <>
            {filteredPg.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPg.map((src) => (
                  <button
                    key={src.key}
                    onClick={() => selectPgSource(src)}
                    className="group flex gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm hover:border-primary/30 w-full"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                      <Table2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-foreground truncate block">{src.table}</span>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Columns3 className="h-3 w-3" />{src.columnCount} cols</span>
                        <span className="flex items-center gap-0.5"><Rows3 className="h-3 w-3" />{src.rowCount.toLocaleString()} rows</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={Server} text="No tables found" />
            )}
          </>
        )}

        {/* MongoDB card grid */}
        {activeTab === "mongo" && !isLoading && (
          <>
            {filteredMongo.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMongo.map((src) => (
                  <button
                    key={src.name}
                    onClick={() => selectMongoSource(src)}
                    className="group flex gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm hover:border-primary/30 w-full"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600 shrink-0">
                      <FileJson className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-foreground truncate block">{src.name}</span>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{src.documentCount.toLocaleString()} documents</div>
                      {src.fields.length > 0 && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                          {src.fields.slice(0, 5).join(", ")}{src.fields.length > 5 ? ` +${src.fields.length - 5}` : ""}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={FileJson} text="No collections found" />
            )}
          </>
        )}
      </div>

      {/* Edit Dataset Dialog */}
      {editDataset && (
        <EditDatasetDialog
          open={!!editDataset}
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onUpdated={(updated, _emoji, _bg) => {
            setDifyDatasets((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
            setEditDataset(null)
          }}
        />
      )}
    </div>
  )
}

/* ───────── Sub-components ───────── */

/* ── Edit Dataset Dialog ── */

function EditDatasetDialog({ open, dataset, onClose, onUpdated }: {
  open: boolean; dataset: DifyDataset; onClose: () => void
  onUpdated: (ds: DifyDataset, emoji: string, bg: string) => void
}) {
  const icons = getDatasetIcons()
  const saved = icons[dataset.id]
  const [name, setName] = useState(dataset.name)
  const [desc, setDesc] = useState(dataset.description ?? "")
  const [emoji, setEmoji] = useState(saved?.emoji ?? "📚")
  const [bg, setBg] = useState(saved?.bg ?? "#D1E9FF")
  const [iconType, setIconType] = useState<"emoji" | "image">(saved?.type ?? "emoji")
  const [imageUrl, setImageUrl] = useState(saved?.imageUrl ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const ic = getDatasetIcons()[dataset.id]
      setName(dataset.name)
      setDesc(dataset.description ?? "")
      setEmoji(ic?.emoji ?? "📚")
      setBg(ic?.bg ?? "#D1E9FF")
      setIconType(ic?.type ?? "emoji")
      setImageUrl(ic?.imageUrl ?? "")
    }
  }, [open, dataset])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const updated = await updateDifyDataset(dataset.id, { name: name.trim(), description: desc })
      setDatasetIcon(dataset.id, emoji, bg, iconType, imageUrl)
      if (updated) {
        onUpdated(updated, emoji, bg)
      } else {
        onUpdated({ ...dataset, name: name.trim(), description: desc }, emoji, bg)
      }
      onClose()
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Dataset</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Name & Icon</label>
            <div className="flex items-start gap-3">
              <DatasetIconPicker
                emoji={emoji} bg={bg} iconType={iconType} imageUrl={imageUrl}
                onChange={(e, b, t, img) => { setEmoji(e); setBg(b); setIconType(t); if (img !== undefined) setImageUrl(img) }}
              />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dataset name" className="flex-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Description <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is this dataset about?" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DatasetCard({ dataset, onClick, onEdit, onDuplicate, onDelete }: {
  dataset: DifyDataset; onClick: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const icons = getDatasetIcons()
  const ic = icons[dataset.id]

  return (
    <div className="group relative flex gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm hover:border-primary/30 w-full">
      <button onClick={onClick} className="flex gap-3 flex-1 min-w-0 text-left">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 text-lg overflow-hidden"
          style={{ backgroundColor: ic?.type === "image" ? undefined : (ic?.bg ?? "oklch(0.9 0.05 250)") }}
        >
          {ic?.type === "image" && ic.imageUrl ? (
            <img src={ic.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            ic?.emoji ?? "📚"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{dataset.name}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              {dataset.document_count} docs
            </Badge>
          </div>
          {dataset.description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{dataset.description}</p>
          )}
        </div>
      </button>

      {/* Context menu */}
      <div className="relative self-start shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 z-50 w-40 rounded-lg border border-border bg-popover py-1 shadow-lg">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Info
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-30 mb-2" />
      <p className="text-xs">{text}</p>
    </div>
  )
}

/* ── Dify Create Panel ── */

function DifyCreatePanel({
  name, desc, onNameChange, onDescChange, onCreate, onCancel,
}: {
  name: string
  desc: string
  onNameChange: (v: string) => void
  onDescChange: (v: string) => void
  onCreate: () => void
  onCancel: () => void
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Create New Dataset</h3>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="My Dataset" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Description</label>
          <Input value={desc} onChange={(e) => onDescChange(e.target.value)} placeholder="What is this dataset about?" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onCreate} disabled={!name.trim()} className="h-8 text-xs">
          <Plus className="mr-1.5 h-3 w-3" />Create
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">
          <X className="mr-1.5 h-3 w-3" />Cancel
        </Button>
      </div>
    </div>
  )
}

/* ── Dify Detail Panel (mirrors Dify Knowledge UI) ── */

function DifyDetailPanel({
  dataset, docs, docsLoading, addTextMode, addTextName, addTextContent,
  onToggleAddText, onAddTextNameChange, onAddTextContentChange, onAddText,
  onDeleteDoc, onDeleteDataset, onBack,
}: {
  dataset: DifyDataset
  docs: DifyDocument[]
  docsLoading: boolean
  addTextMode: boolean
  addTextName: string
  addTextContent: string
  onToggleAddText: () => void
  onAddTextNameChange: (v: string) => void
  onAddTextContentChange: (v: string) => void
  onAddText: () => void
  onDeleteDoc: (id: string) => void
  onDeleteDataset: () => void
  onBack: () => void
}) {
  const [detailTab, setDetailTab] = useState<DatasetDetailTab>("documents")
  const [docSearch, setDocSearch] = useState("")
  const [docSort, setDocSort] = useState<"created_at" | "name" | "word_count">("created_at")
  const [retrievalQuery, setRetrievalQuery] = useState("")
  const [retrievalResults, setRetrievalResults] = useState<Array<{ content: string; score: number; docName: string }>>([])
  const [retrievalLoading, setRetrievalLoading] = useState(false)

  const filteredDocs = docs
    .filter((d) => !docSearch || d.name.toLowerCase().includes(docSearch.toLowerCase()))
    .sort((a, b) => {
      if (docSort === "name") return a.name.localeCompare(b.name)
      if (docSort === "word_count") return (b.word_count ?? 0) - (a.word_count ?? 0)
      return b.created_at - a.created_at
    })

  async function handleRetrievalTest() {
    if (!retrievalQuery.trim()) return
    setRetrievalLoading(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/dify/datasets/${dataset.id}/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: retrievalQuery, top_k: 5 }),
      })
      if (resp.ok) {
        const data = await resp.json()
        const records = (data.records ?? []).map((r: any) => ({
          content: r.segment?.content ?? "",
          score: r.score ?? 0,
          docName: r.document?.name ?? "Unknown",
        }))
        setRetrievalResults(records)
      }
    } catch { /* ignore */ }
    setRetrievalLoading(false)
  }

  const DETAIL_TABS: { key: DatasetDetailTab; label: string; icon: React.ElementType; badge?: string }[] = [
    { key: "documents", label: "Documents", icon: FileText, badge: String(dataset.document_count ?? docs.length) },
    { key: "pipeline", label: "Pipeline", icon: GitBranch },
    { key: "retrieval", label: "Retrieval Testing", icon: FlaskConical },
    { key: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Top bar — same as AppConfigView */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
          <div className="flex items-center gap-2">
            {(() => {
              const icons = getDatasetIcons()
              const ic = icons[dataset.id]
              return (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 text-sm overflow-hidden"
                  style={{ backgroundColor: ic?.type === "image" ? undefined : (ic?.bg ?? "oklch(0.9 0.05 250)") }}
                >
                  {ic?.type === "image" && ic.imageUrl ? (
                    <img src={ic.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    ic?.emoji ?? "📚"
                  )}
                </div>
              )
            })()}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{dataset.name}</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {dataset.document_count} docs
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left sidebar — section tabs */}
      <div className="w-[210px] shrink-0 border-r border-border flex flex-col bg-card/50">

        {/* Section tabs */}
        <div className="flex-1 p-2 space-y-0.5">
          {DETAIL_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = detailTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setDetailTab(tab.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors text-left",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{tab.label}</span>
                {tab.badge && (
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", isActive ? "border-primary/30 text-primary" : "")}>
                    {tab.badge}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>

        {/* Bottom stats */}
        <div className="border-t border-border p-4 space-y-2 text-[10px] text-muted-foreground">
          <div className="flex justify-between"><span>{dataset.document_count ?? 0}</span><span>DOCUMENTS</span></div>
          <div className="flex justify-between"><span>{dataset.app_count ?? 0}</span><span>LINKED APPS</span></div>
        </div>
      </div>

      {/* Main content area */}
      <div className={cn("flex-1", detailTab === "pipeline" ? "overflow-hidden flex flex-col" : "overflow-auto")}>
        {/* ── Documents Tab ── */}
        {detailTab === "documents" && (
          <div className="flex flex-col h-full">
            {/* Documents header bar */}
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-base font-semibold text-foreground mb-3">Documents</h3>
              <p className="text-xs text-muted-foreground mb-4">All files of the Knowledge are shown here, and the entire Knowledge can be linked to Dify citations or indexed via the Chat plugin.</p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Sort by:</span>
                  <Select value={docSort} onValueChange={(v) => setDocSort(v as any)}>
                    <SelectTrigger className="h-8 w-[130px] text-xs border-0 bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Upload Time</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="word_count">Word Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleAddText}
                    className={cn("h-8 text-xs", addTextMode && "bg-primary/10 border-primary/30")}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Add file
                  </Button>
                </div>
              </div>
            </div>

            {/* Add text inline form */}
            {addTextMode && (
              <div className="mx-6 mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="text-[10px] font-medium text-primary uppercase tracking-wider">Paste text content</div>
                <Input value={addTextName} onChange={(e) => onAddTextNameChange(e.target.value)} placeholder="Document name" className="h-8 text-xs" />
                <textarea
                  value={addTextContent}
                  onChange={(e) => onAddTextContentChange(e.target.value)}
                  placeholder="Paste your text content here..."
                  className="h-24 w-full resize-none rounded-lg border border-border bg-background p-3 text-xs outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={onAddText} className="h-8 text-xs" disabled={!addTextContent.trim()}>
                    <Plus className="h-3 w-3 mr-1" />Add
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onToggleAddText} className="h-8 text-xs">Cancel</Button>
                </div>
              </div>
            )}

            {/* Documents list */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {docsLoading ? (
                <div className="py-16 text-center text-xs text-muted-foreground">Loading documents...</div>
              ) : filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border bg-muted/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/20 mb-3">
                    <Upload className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">There is no documentation yet</p>
                  <p className="text-xs text-muted-foreground mb-4 max-w-sm text-center">You can upload files, sync from the website, or from web apps like Notion, GitHub, etc.</p>
                  <Button variant="outline" size="sm" onClick={onToggleAddText} className="h-8 text-xs">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Add file
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/30 transition-colors group">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                        doc.data_source_type === "upload_file" ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"
                      )}>
                        {doc.data_source_type === "upload_file" ? <FileText className="h-4.5 w-4.5" /> : <Type className="h-4.5 w-4.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{doc.name}</div>
                        <div className="flex items-center gap-3 mt-1">
                          {doc.word_count > 0 && <span className="text-[10px] text-muted-foreground">{doc.word_count.toLocaleString()} words</span>}
                          {doc.tokens > 0 && <span className="text-[10px] text-muted-foreground">{doc.tokens.toLocaleString()} tokens</span>}
                          {(doc.hit_count ?? 0) > 0 && <span className="text-[10px] text-muted-foreground">{doc.hit_count} hits</span>}
                          <span className="text-[10px] text-muted-foreground">{new Date(doc.created_at * 1000).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[9px] shrink-0",
                        doc.indexing_status === "completed" ? "text-green-600 border-green-500/30" :
                        doc.indexing_status === "error" ? "text-red-600 border-red-500/30" :
                        "text-amber-600 border-amber-500/30"
                      )}>
                        {doc.indexing_status === "completed" ? "Indexed" : doc.indexing_status}
                      </Badge>
                      <button onClick={() => onDeleteDoc(doc.id)} className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pipeline Tab ── */}
        {detailTab === "pipeline" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <PipelineEditor datasetId={dataset.id} datasetName={dataset.name} />
          </div>
        )}

        {/* ── Retrieval Testing Tab ── */}
        {detailTab === "retrieval" && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-1">Retrieval Testing</h3>
              <p className="text-xs text-muted-foreground">Test the retrieval quality by entering a query and reviewing matched chunks.</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex gap-2">
                <Input
                  value={retrievalQuery}
                  onChange={(e) => setRetrievalQuery(e.target.value)}
                  placeholder="Enter a query to test retrieval..."
                  className="flex-1 h-10 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleRetrievalTest()}
                />
                <Button onClick={handleRetrievalTest} disabled={retrievalLoading || !retrievalQuery.trim()} className="h-10 text-xs px-5">
                  {retrievalLoading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                  Test
                </Button>
              </div>

              {retrievalResults.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="text-xs font-medium text-foreground">{retrievalResults.length} results</div>
                  {retrievalResults.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/10 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium text-foreground">#{i + 1} — {r.docName}</span>
                        <Badge variant="outline" className="text-[9px]">Score: {(r.score * 100).toFixed(1)}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {retrievalResults.length === 0 && !retrievalLoading && retrievalQuery && (
                <div className="py-8 text-center text-xs text-muted-foreground">Enter a query and click Test to see retrieval results</div>
              )}
            </div>
          </div>
        )}

        {/* ── Settings Tab ── */}
        {detailTab === "settings" && (
          <KnowledgeSettingsTab dataset={dataset} onDeleteDataset={onDeleteDataset} />
        )}
      </div>
    </div>
    </div>
  )
}

/* ── Knowledge Settings Tab ── */

function KnowledgeSettingsTab({ dataset, onDeleteDataset }: { dataset: DifyDataset; onDeleteDataset: () => void }) {
  const ic = getDatasetIcons()[dataset.id]

  /* ── Editable general info ── */
  const [editName, setEditName] = useState(dataset.name)
  const [editDesc, setEditDesc] = useState(dataset.description ?? "")
  const [editPermission, setEditPermission] = useState(dataset.permission ?? "only_me")
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [generalSaved, setGeneralSaved] = useState(false)

  /* ── Retrieval settings ── */
  const [searchMethod, setSearchMethod] = useState<"semantic" | "full_text" | "hybrid">("hybrid")
  const [rerankEnabled, setRerankEnabled] = useState(true)
  const [rerankModel, setRerankModel] = useState("bge-reranker-v2-m3")
  const [topK, setTopK] = useState(5)
  const [scoreThreshold, setScoreThreshold] = useState(0.5)
  const [scoreEnabled, setScoreEnabled] = useState(true)
  const [savingRetrieval, setSavingRetrieval] = useState(false)
  const [retrievalSaved, setRetrievalSaved] = useState(false)

  /* ── Embedding ── */
  const [indexingTechnique, setIndexingTechnique] = useState(dataset.indexing_technique ?? "high_quality")

  useEffect(() => {
    setEditName(dataset.name)
    setEditDesc(dataset.description ?? "")
    setEditPermission(dataset.permission ?? "only_me")
    setIndexingTechnique(dataset.indexing_technique ?? "high_quality")
  }, [dataset])

  async function handleSaveGeneral() {
    setSavingGeneral(true)
    try {
      await updateDifyDataset(dataset.id, { name: editName.trim(), description: editDesc })
      setGeneralSaved(true)
      setTimeout(() => setGeneralSaved(false), 2000)
    } catch { /* ignore */ }
    setSavingGeneral(false)
  }

  async function handleSaveRetrieval() {
    setSavingRetrieval(true)
    // Save retrieval settings to localStorage (Dify API may not expose all these)
    try {
      const key = `regminder_retrieval_${dataset.id}`
      localStorage.setItem(key, JSON.stringify({ searchMethod, rerankEnabled, rerankModel, topK, scoreThreshold, scoreEnabled }))
      setRetrievalSaved(true)
      setTimeout(() => setRetrievalSaved(false), 2000)
    } catch { /* ignore */ }
    setSavingRetrieval(false)
  }

  // Load retrieval settings from localStorage
  useEffect(() => {
    try {
      const key = `regminder_retrieval_${dataset.id}`
      const saved = localStorage.getItem(key)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.searchMethod) setSearchMethod(data.searchMethod)
        if (data.rerankEnabled !== undefined) setRerankEnabled(data.rerankEnabled)
        if (data.rerankModel) setRerankModel(data.rerankModel)
        if (data.topK) setTopK(data.topK)
        if (data.scoreThreshold !== undefined) setScoreThreshold(data.scoreThreshold)
        if (data.scoreEnabled !== undefined) setScoreEnabled(data.scoreEnabled)
      }
    } catch { /* ignore */ }
  }, [dataset.id])

  const SEARCH_METHODS = [
    { key: "semantic" as const, label: "Semantic Search", desc: "Generate query embeddings and search for the text chunk most similar to its vector representation.", icon: BrainCircuit, color: "text-blue-500" },
    { key: "full_text" as const, label: "Full-Text Search", desc: "Index all terms in the document, allowing users to search any term and find relevant text chunk.", icon: FileText, color: "text-green-500" },
    { key: "hybrid" as const, label: "Hybrid Search", desc: "Execute full-text search and vector searches simultaneously, re-rank to select the best match for the user's query.", icon: GitBranch, color: "text-violet-500" },
  ]

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* ── 1. General Information ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            General Information
          </h4>
          <Button
            size="sm" variant={generalSaved ? "outline" : "default"}
            className="h-7 text-xs gap-1.5"
            disabled={savingGeneral || !editName.trim()}
            onClick={handleSaveGeneral}
          >
            {savingGeneral ? <Loader2 className="h-3 w-3 animate-spin" /> : generalSaved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {generalSaved ? "Saved" : "Save"}
          </Button>
        </div>

        {/* Icon + Name row */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-border text-2xl shrink-0 overflow-hidden"
            style={{ backgroundColor: ic?.type === "image" ? undefined : (ic?.bg ?? "oklch(0.9 0.05 250)") }}
          >
            {ic?.type === "image" && ic.imageUrl ? (
              <img src={ic.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              ic?.emoji ?? "📚"
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="mt-1 text-xs" rows={3} placeholder="Describe this knowledge base..." />
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Created</label>
            <div className="mt-0.5 text-xs text-muted-foreground">{new Date(dataset.created_at * 1000).toLocaleString()}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Last Updated</label>
            <div className="mt-0.5 text-xs text-muted-foreground">{new Date(dataset.updated_at * 1000).toLocaleString()}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Documents</label>
            <div className="mt-0.5 text-xs text-foreground">{dataset.document_count}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Words</label>
            <div className="mt-0.5 text-xs text-foreground">{(dataset.word_count ?? 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* ── 2. Permissions ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-500" />
          Permissions
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setEditPermission("only_me")}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
              editPermission === "only_me" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
          >
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <div className="text-xs font-semibold text-foreground">Only Me</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Only the creator can access and manage this knowledge base.</p>
            </div>
          </button>
          <button
            onClick={() => setEditPermission("all_team_members")}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
              editPermission === "all_team_members" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
          >
            <Users className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <div className="text-xs font-semibold text-foreground">All Team Members</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">All team members can view and use this knowledge base.</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── 3. Embedding Model ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-blue-500" />
          Embedding Model
        </h4>

        {/* Indexing technique */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Indexing Method</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIndexingTechnique("high_quality")}
              className={cn(
                "rounded-lg border p-3 text-left transition-all",
                indexingTechnique === "high_quality" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">High Quality</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Uses embedding model for processing. Higher accuracy but costs tokens.</p>
            </button>
            <button
              onClick={() => setIndexingTechnique("economy")}
              className={cn(
                "rounded-lg border p-3 text-left transition-all",
                indexingTechnique === "economy" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs font-semibold text-foreground">Economy</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Offline vector engines and keyword indexes. Lower accuracy, no token cost.</p>
            </button>
          </div>
        </div>

        {/* Current model info */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Current Model</label>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
              <BrainCircuit className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground">{dataset.embedding_model || "text-embedding-ada-002"}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{dataset.embedding_model_provider || "openai"}</div>
            </div>
            <Badge variant="outline" className="text-[9px] shrink-0">Active</Badge>
          </div>
        </div>
      </div>

      {/* ── 4. Retrieval Settings ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-violet-500" />
            Retrieval Settings
          </h4>
          <Button
            size="sm" variant={retrievalSaved ? "outline" : "default"}
            className="h-7 text-xs gap-1.5"
            disabled={savingRetrieval}
            onClick={handleSaveRetrieval}
          >
            {savingRetrieval ? <Loader2 className="h-3 w-3 animate-spin" /> : retrievalSaved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {retrievalSaved ? "Saved" : "Save"}
          </Button>
        </div>

        {/* Search method selector */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Search Method</label>
          <div className="grid grid-cols-3 gap-2">
            {SEARCH_METHODS.map((m) => {
              const Icon = m.icon
              return (
                <button
                  key={m.key}
                  onClick={() => setSearchMethod(m.key)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    searchMethod === m.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <Icon className={cn("h-4 w-4 mb-1.5", m.color)} />
                  <div className="text-[11px] font-semibold text-foreground">{m.label}</div>
                  <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{m.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Reranking model */}
        {(searchMethod === "semantic" || searchMethod === "hybrid") && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Reranking Model</label>
                <p className="text-[9px] text-muted-foreground mt-0.5">Re-rank retrieved results using a cross-encoder model for better relevance.</p>
              </div>
              <button
                onClick={() => setRerankEnabled(!rerankEnabled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  rerankEnabled ? "bg-primary" : "bg-muted",
                )}
              >
                <span className={cn("pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform", rerankEnabled ? "translate-x-4" : "translate-x-0")} />
              </button>
            </div>
            {rerankEnabled && (
              <Select value={rerankModel} onValueChange={setRerankModel}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bge-reranker-v2-m3">bge-reranker-v2-m3</SelectItem>
                  <SelectItem value="bge-reranker-large">bge-reranker-large</SelectItem>
                  <SelectItem value="cohere-rerank-v3">cohere-rerank-v3</SelectItem>
                  <SelectItem value="jina-reranker-v2">jina-reranker-v2</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Top K */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Top K</label>
            <span className="text-xs text-foreground font-medium">{topK}</span>
          </div>
          <input
            type="range" min="1" max="20" step="1"
            value={topK}
            onChange={(e) => setTopK(+e.target.value)}
            className="w-full accent-primary"
          />
          <p className="text-[9px] text-muted-foreground">Number of top results to return from the search. Higher values retrieve more context but may reduce precision.</p>
        </div>

        {/* Score threshold */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Score Threshold</label>
              <button
                onClick={() => setScoreEnabled(!scoreEnabled)}
                className={cn(
                  "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  scoreEnabled ? "bg-primary" : "bg-muted",
                )}
              >
                <span className={cn("pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transform transition-transform", scoreEnabled ? "translate-x-3" : "translate-x-0")} />
              </button>
            </div>
            {scoreEnabled && <span className="text-xs text-foreground font-medium">{scoreThreshold}</span>}
          </div>
          {scoreEnabled && (
            <>
              <input
                type="range" min="0" max="1" step="0.05"
                value={scoreThreshold}
                onChange={(e) => setScoreThreshold(+e.target.value)}
                className="w-full accent-primary"
              />
              <p className="text-[9px] text-muted-foreground">Only return results with a similarity score above this threshold. Filters out low-relevance matches.</p>
            </>
          )}
        </div>
      </div>

      {/* ── 5. API Access ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Key className="h-4 w-4 text-amber-500" />
          API Access
        </h4>
        <p className="text-xs text-muted-foreground">Use these details to access this knowledge base programmatically via the Dify API.</p>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dataset ID</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-mono text-foreground">{dataset.id}</code>
              <Button
                variant="outline" size="sm" className="h-7 px-2"
                onClick={() => { navigator.clipboard.writeText(dataset.id) }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">API Endpoint</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-mono text-foreground truncate">
                /v1/datasets/{dataset.id}/document/create-by-text
              </code>
              <Button
                variant="outline" size="sm" className="h-7 px-2"
                onClick={() => { navigator.clipboard.writeText(`/v1/datasets/${dataset.id}/document/create-by-text`) }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Retrieval Endpoint</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-mono text-foreground truncate">
                /v1/datasets/{dataset.id}/retrieve
              </code>
              <Button
                variant="outline" size="sm" className="h-7 px-2"
                onClick={() => { navigator.clipboard.writeText(`/v1/datasets/${dataset.id}/retrieve`) }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="text-[10px] text-blue-400">
            <strong>Note:</strong> API requests require a valid API key. Go to the Dify console → API Access to generate or manage your API keys.
          </p>
        </div>
      </div>

      {/* ── 6. Linked Apps ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-green-500" />
          Linked Apps
        </h4>
        {dataset.app_count > 0 ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{dataset.app_count} app{dataset.app_count !== 1 ? "s" : ""}</Badge>
            <span className="text-xs text-muted-foreground">currently using this knowledge base</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No apps are currently linked to this knowledge base. Add it to an agent or workflow to start using it.</p>
        )}
      </div>

      {/* ── 7. Danger Zone ── */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
        <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Danger Zone
        </h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-xs font-medium text-foreground">Delete this knowledge base</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Permanently delete this knowledge base and all {dataset.document_count} document{dataset.document_count !== 1 ? "s" : ""}.
                This action cannot be undone and will remove all associated embeddings and chunks.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={onDeleteDataset} className="h-8 text-xs shrink-0">
              Delete Knowledge Base
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── PostgreSQL Detail Panel ── */

function PgDetailPanel({
  source, preview, loading, onBack,
}: {
  source: PgSource
  preview: PgPreview | null
  loading: boolean
  onBack: () => void
}) {
  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
            <Table2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">{source.table}</h3>
            <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
              <span>{source.columnCount} columns</span>
              <span>{source.rowCount.toLocaleString()} rows</span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">{source.rowCount.toLocaleString()} rows</Badge>
        </div>

        {/* Column definitions */}
        <div>
          <div className="text-[10px] font-medium text-muted-foreground mb-2">Columns</div>
          <div className="flex flex-wrap gap-1.5">
            {source.columns.map((col) => (
              <span key={col.name} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[10px]">
                <span className="font-medium text-foreground">{col.name}</span>
                <span className="text-muted-foreground">{col.type}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Data Preview */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-primary" />
            Data Preview
          </h4>
          {preview && <span className="text-[10px] text-muted-foreground">Showing {preview.rows.length} of {preview.total.toLocaleString()}</span>}
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading preview...</div>
        ) : !preview || preview.rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No data available</div>
        ) : (
          <div className="overflow-auto max-h-[500px] rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {preview.columns.map((col) => (
                    <th key={col} className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    {preview.columns.map((col) => (
                      <td key={col} className="px-3 py-1.5 text-foreground whitespace-nowrap max-w-[300px] truncate">
                        {formatCellValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── MongoDB Detail Panel ── */

function MongoDetailPanel({
  source, preview, loading, onBack,
}: {
  source: MongoSource
  preview: MongoPreview | null
  loading: boolean
  onBack: () => void
}) {
  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-600 shrink-0">
            <FileJson className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">{source.name}</h3>
            <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
              <span>{source.documentCount.toLocaleString()} documents</span>
              <span>{source.fields.length} fields</span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">{source.documentCount.toLocaleString()} docs</Badge>
        </div>

        {/* Fields */}
        <div>
          <div className="text-[10px] font-medium text-muted-foreground mb-2">Fields</div>
          <div className="flex flex-wrap gap-1.5">
            {source.fields.map((field) => (
              <span key={field} className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-foreground">
                {field}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Document Preview */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-primary" />
            Document Preview
          </h4>
          {preview && <span className="text-[10px] text-muted-foreground">Showing {preview.documents.length} of {preview.total.toLocaleString()}</span>}
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading preview...</div>
        ) : !preview || preview.documents.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No documents available</div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-auto">
            {preview.documents.map((doc, i) => (
              <details key={i} className="rounded-lg border border-border bg-muted/10">
                <summary className="cursor-pointer px-3 py-2 text-xs text-foreground hover:bg-muted/20">
                  <span className="font-medium">Document {i + 1}</span>
                  {(doc as any)._id && <span className="ml-2 text-muted-foreground">id: {String((doc as any)._id).slice(0, 12)}...</span>}
                </summary>
                <pre className="px-3 pb-3 text-[10px] text-foreground overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(doc, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Helpers ── */

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "--"
  if (typeof val === "object") return JSON.stringify(val)
  return String(val)
}
