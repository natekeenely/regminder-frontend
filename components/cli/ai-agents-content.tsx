"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Bot,
  BookOpen,
  Brain,
  ChevronRight,
  Circle,
  Code2,
  Copy,
  Crown,
  Eye,
  FileText,
  Globe,
  ImagePlus,
  Key,
  Layers,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Variable,
  Wrench,
  X,
  Workflow,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ───────── Types ───────── */

interface DifyApp {
  id: string
  name: string
  description: string
  mode: "chat" | "agent-chat" | "workflow" | "completion" | "advanced-chat"
  icon_type?: string
  icon?: string
  icon_background?: string
  model_config?: DifyModelConfig
  created_at?: string
  updated_at?: string
}

interface DifyModelConfig {
  pre_prompt?: string
  model?: { provider: string; name: string; mode: string; completion_params?: Record<string, unknown> }
  agent_mode?: { enabled: boolean; tools?: Array<Record<string, unknown>> }
  dataset_configs?: { datasets?: { datasets?: Array<{ dataset?: { id: string } }> } }
  user_input_form?: Array<Record<string, unknown>>
  file_upload?: Record<string, unknown>
  retriever_resource?: { enabled: boolean }
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  id?: string
}

/* ───────── API helpers ───────── */

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/proxy${path}`, init)

/* ───────── App type definitions (matching Dify's create dialog) ───────── */

const APP_TYPES = [
  { mode: "chat" as const, label: "Chatbot (Manager)", desc: "Orchestrator that delegates tasks to specialist agents", icon: Bot, color: "text-emerald-500" },
  { mode: "agent-chat" as const, label: "Agent (Specialist)", desc: "Autonomous agent with reasoning and tool use for specific tasks", icon: Zap, color: "text-orange-500" },
  { mode: "completion" as const, label: "Text Generator", desc: "AI assistant for text generation tasks", icon: FileText, color: "text-purple-500" },
] as const

const MODE_LABELS: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  "workflow": { label: "WORKFLOW", icon: Workflow, color: "text-blue-500" },
  "advanced-chat": { label: "CHATFLOW", icon: MessageSquare, color: "text-indigo-500" },
  "chat": { label: "MANAGER", icon: Bot, color: "text-emerald-500" },
  "agent-chat": { label: "SPECIALIST", icon: Zap, color: "text-orange-500" },
  "completion": { label: "TEXT GENERATOR", icon: FileText, color: "text-purple-500" },
}

/* ───────── Icon rendering helper ───────── */

function AppIcon({ app, size = "md" }: { app: { icon?: string; icon_type?: string; icon_background?: string }; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-lg"

  if (app.icon_type === "image" && app.icon) {
    // Dify serves uploaded icon images via console API
    const src = `/api/proxy/api/v1/dify/files/${app.icon}/preview`
    return (
      <div className={cn(dim, "shrink-0 rounded-lg overflow-hidden bg-muted")}>
        <img src={src} alt="icon" className="h-full w-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={cn(dim, "shrink-0 flex items-center justify-center rounded-lg", textSize)}
      style={{ backgroundColor: app.icon_background || "#FFEAD5" }}
    >
      {app.icon ?? "🤖"}
    </div>
  )
}

/* ───────── Emoji / Icon Picker ───────── */

const ICON_EMOJIS = [
  "🤖", "🧠", "💡", "🔍", "📊", "📝", "📈", "🎯",
  "⚡", "🔧", "🛠️", "🔬", "🧪", "📋", "💬", "🗂️",
  "🌐", "🏗️", "📦", "🎨", "🚀", "✨", "🔮", "🎭",
  "📚", "🧩", "🔗", "⚙️", "🛡️", "📌", "💎", "🏆",
  "🤝", "📡", "🧬", "🔑", "🎪", "🌟", "💼", "🗃️",
]

const ICON_BACKGROUNDS = [
  "#FFEAD5", "#E4FBCC", "#D3F8DF", "#D1E9FF", "#E8D0FF",
  "#FFD6E7", "#FFF1C2", "#D5F5F6", "#E0DFFF", "#FCE1CD",
  "#F5F5F5", "#FEE4E2", "#D4E5FE", "#C7F7E4", "#FDDCAB",
]

function IconPicker({
  icon, iconBg, iconType, iconImageUrl,
  onIconChange, onBgChange, onImageUpload,
}: {
  icon: string; iconBg: string; iconType: "emoji" | "image"; iconImageUrl?: string
  onIconChange: (emoji: string) => void; onBgChange: (bg: string) => void
  onImageUpload: (fileId: string, previewUrl: string) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
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
      // Read as data URL for both preview and upload
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      // Upload to Dify via backend
      const resp = await api("/api/v1/dify/files/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      })

      if (resp.ok) {
        const data = await resp.json()
        onImageUpload(data.id, dataUrl)
        setShowPicker(false)
      }
    } catch { /* ignore */ }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-2xl transition-colors overflow-hidden"
        style={{ backgroundColor: iconType === "emoji" ? iconBg : undefined }}
      >
        {iconType === "image" && iconImageUrl ? (
          <img src={iconImageUrl} alt="icon" className="h-full w-full object-cover" />
        ) : (
          icon
        )}
      </button>
      {showPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
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
                  {ICON_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { onIconChange(e); setShowPicker(false) }}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-muted transition-colors",
                        iconType === "emoji" && icon === e && "bg-primary/10 ring-1 ring-primary/30",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-2 tracking-wider">BACKGROUND</p>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_BACKGROUNDS.map((bg) => (
                    <button
                      key={bg}
                      onClick={() => onBgChange(bg)}
                      className={cn(
                        "h-6 w-6 rounded-full border transition-all",
                        iconBg === bg ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border hover:scale-105",
                      )}
                      style={{ backgroundColor: bg }}
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
                  ) : iconType === "image" && iconImageUrl ? (
                    <img src={iconImageUrl} alt="preview" className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {uploading ? "Uploading..." : "Click to select an image"}
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

/* ───────── Create App Dialog ───────── */

function CreateAppDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (app: DifyApp) => void }) {
  const [selectedMode, setSelectedMode] = useState<string>("chat")
  const [appName, setAppName] = useState("")
  const [appDesc, setAppDesc] = useState("")
  const [appIcon, setAppIcon] = useState("🤖")
  const [appIconBg, setAppIconBg] = useState("#FFEAD5")
  const [appIconType, setAppIconType] = useState<"emoji" | "image">("emoji")
  const [appIconImageUrl, setAppIconImageUrl] = useState("")   // local preview data URL
  const [appIconFileId, setAppIconFileId] = useState("")        // Dify file ID
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!appName.trim()) return
    setCreating(true)
    try {
      const resp = await api("/api/v1/dify/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: appName.trim(),
          mode: selectedMode,
          description: appDesc,
          icon_type: appIconType,
          icon: appIconType === "image" ? appIconFileId : appIcon,
          icon_background: appIconType === "emoji" ? appIconBg : "#FFFFFF",
        }),
      })
      if (resp.ok) {
        const data = await resp.json()
        onCreated(data)
        setAppName("")
        setAppDesc("")
        setAppIcon("🤖")
        setAppIconBg("#FFEAD5")
        setAppIconType("emoji")
        setAppIconImageUrl("")
        setAppIconFileId("")
        setSelectedMode("chat")
        onClose()
      }
    } catch { /* ignore */ }
    setCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create from Blank</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* App type selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Choose an App Type</label>
            <div className="grid grid-cols-3 gap-3">
              {APP_TYPES.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.mode}
                    onClick={() => setSelectedMode(t.mode)}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all",
                      selectedMode === t.mode
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <Icon className={cn("h-6 w-6", t.color)} />
                    <div>
                      <div className="text-sm font-semibold">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground">{t.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* App name & icon */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">App Name & Icon</label>
            <div className="flex items-start gap-3">
              <IconPicker
                icon={appIcon}
                iconBg={appIconBg}
                iconType={appIconType}
                iconImageUrl={appIconImageUrl}
                onIconChange={(emoji) => { setAppIcon(emoji); setAppIconType("emoji"); setAppIconFileId(""); setAppIconImageUrl("") }}
                onBgChange={setAppIconBg}
                onImageUpload={(fileId, previewUrl) => { setAppIconType("image"); setAppIconFileId(fileId); setAppIconImageUrl(previewUrl) }}
              />
              <Input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Give your app a name"
                className="flex-1"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Description <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <Textarea
              value={appDesc}
              onChange={(e) => setAppDesc(e.target.value)}
              placeholder="Enter the description of the app"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !appName.trim()}>
            {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───────── Edit App Dialog ───────── */

function EditAppDialog({ open, app, onClose, onUpdated }: { open: boolean; app: DifyApp; onClose: () => void; onUpdated: (app: DifyApp) => void }) {
  const [appName, setAppName] = useState(app.name)
  const [appDesc, setAppDesc] = useState(app.description ?? "")
  const [appIcon, setAppIcon] = useState(app.icon ?? "🤖")
  const [appIconBg, setAppIconBg] = useState(app.icon_background ?? "#FFEAD5")
  const [appIconType, setAppIconType] = useState<"emoji" | "image">(app.icon_type === "image" ? "image" : "emoji")
  const [appIconImageUrl, setAppIconImageUrl] = useState(app.icon_type === "image" && app.icon ? `/api/proxy/api/v1/dify/files/${app.icon}/preview` : "")
  const [appIconFileId, setAppIconFileId] = useState(app.icon_type === "image" ? (app.icon ?? "") : "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAppName(app.name)
      setAppDesc(app.description ?? "")
      setAppIcon(app.icon ?? "🤖")
      setAppIconBg(app.icon_background ?? "#FFEAD5")
      setAppIconType(app.icon_type === "image" ? "image" : "emoji")
      setAppIconImageUrl(app.icon_type === "image" && app.icon ? `/api/proxy/api/v1/dify/files/${app.icon}/preview` : "")
      setAppIconFileId(app.icon_type === "image" ? (app.icon ?? "") : "")
    }
  }, [open, app])

  async function handleSave() {
    if (!appName.trim()) return
    setSaving(true)
    try {
      const resp = await api(`/api/v1/dify/apps/${app.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: appName.trim(),
          description: appDesc,
          icon_type: appIconType,
          icon: appIconType === "image" ? appIconFileId : appIcon,
          icon_background: appIconType === "emoji" ? appIconBg : "#FFFFFF",
        }),
      })
      if (resp.ok) {
        const data = await resp.json()
        onUpdated(data)
        onClose()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit App</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* App name & icon */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">App Name & Icon</label>
            <div className="flex items-start gap-3">
              <IconPicker
                icon={appIcon}
                iconBg={appIconBg}
                iconType={appIconType}
                iconImageUrl={appIconImageUrl}
                onIconChange={(emoji) => { setAppIcon(emoji); setAppIconType("emoji"); setAppIconFileId(""); setAppIconImageUrl("") }}
                onBgChange={setAppIconBg}
                onImageUpload={(fileId, previewUrl) => { setAppIconType("image"); setAppIconFileId(fileId); setAppIconImageUrl(previewUrl) }}
              />
              <Input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="App name"
                className="flex-1"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Description <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <Textarea
              value={appDesc}
              onChange={(e) => setAppDesc(e.target.value)}
              placeholder="Enter the description of the app"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !appName.trim()}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Pencil className="mr-1.5 h-3.5 w-3.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───────── App Config View (Orchestrate page) ───────── */

type ConfigTab = "orchestrate" | "skills" | "memory" | "api-access" | "logs" | "monitoring"

const CONFIG_TABS: Array<{ id: ConfigTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: "orchestrate", label: "Orchestrate", icon: LayoutDashboard },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "api-access", label: "API Access", icon: Key },
  { id: "logs", label: "Logs & Annotations", icon: FileText },
  { id: "monitoring", label: "Monitoring", icon: Monitor },
]

function AppConfigView({
  app,
  onBack,
  onDeleted,
}: {
  app: DifyApp
  onBack: () => void
  onDeleted: () => void
}) {
  const [tab, setTab] = useState<ConfigTab>("orchestrate")
  const [appDetail, setAppDetail] = useState<DifyApp>(app)
  const [instructions, setInstructions] = useState("")
  const [variables, setVariables] = useState<Array<{ key: string; name: string; type: string; required: boolean }>>([])
  const [knowledgeIds, setKnowledgeIds] = useState<string[]>([])
  const [tools, setTools] = useState<Array<Record<string, unknown>>>([])
  const [modelProvider, setModelProvider] = useState("")
  const [modelName, setModelName] = useState("")
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState("")

  // Debug panel state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [conversationId, setConversationId] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  /* ── Load app config ── */
  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api(`/api/v1/dify/apps/${app.id}`)
      if (resp.ok) {
        const data: DifyApp = await resp.json()
        setAppDetail(data)
        const mc = data.model_config
        if (mc) {
          setInstructions(mc.pre_prompt ?? "")
          if (mc.model) {
            setModelProvider(mc.model.provider ?? "")
            setModelName(mc.model.name ?? "")
          }
          if (mc.agent_mode?.tools) {
            setTools(mc.agent_mode.tools)
          }
          if (mc.user_input_form) {
            const vars = mc.user_input_form.map((v: any) => {
              const entry = v["text-input"] ?? v["select"] ?? v["paragraph"] ?? v
              return { key: entry.variable ?? "", name: entry.label ?? "", type: v["text-input"] ? "text-input" : v["select"] ? "select" : "paragraph", required: entry.required ?? false }
            }).filter((v: any) => v.key)
            setVariables(vars)
          }
          const datasets = mc.dataset_configs?.datasets?.datasets
          if (datasets) {
            setKnowledgeIds(datasets.map((d: any) => d?.dataset?.id).filter(Boolean))
          }
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [app.id])

  useEffect(() => { loadConfig() }, [loadConfig])

  /* ── Save config ── */
  async function handleSave() {
    setSaving(true)
    try {
      const config: Record<string, unknown> = {
        pre_prompt: instructions,
        model: modelProvider && modelName ? { provider: modelProvider, name: modelName, mode: "chat", completion_params: { temperature: 0.7, max_tokens: 4096 } } : undefined,
        user_input_form: variables.map((v) => ({ [v.type]: { variable: v.key, label: v.name, required: v.required, type: v.type } })),
        dataset_configs: knowledgeIds.length > 0 ? { datasets: { datasets: knowledgeIds.map((id) => ({ dataset: { enabled: true, id } })) }, retrieval_model: "multiple" } : undefined,
        agent_mode: tools.length > 0 ? { enabled: true, tools } : { enabled: appDetail.mode === "agent-chat", tools: [] },
      }
      await api(`/api/v1/dify/apps/${app.id}/model-config`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      })
    } catch { /* ignore */ }
    setSaving(false)
  }

  /* ── Publish ── */
  async function handlePublish() {
    setPublishing(true)
    try {
      await handleSave()
      await api(`/api/v1/dify/apps/${app.id}/publish`, { method: "POST" })
    } catch { /* ignore */ }
    setPublishing(false)
  }

  /* ── Delete ── */
  async function handleDelete() {
    if (!confirm(`Delete "${appDetail.name}"? This cannot be undone.`)) return
    const resp = await api(`/api/v1/dify/apps/${app.id}`, { method: "DELETE" })
    if (resp.ok) onDeleted()
  }

  /* ── Load API key ── */
  async function loadApiKey() {
    try {
      const resp = await api(`/api/v1/dify/apps/${app.id}/api-key`)
      if (resp.ok) {
        const data = await resp.json()
        setApiKey(data.apiKey ?? "")
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (tab === "api-access") loadApiKey()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  /* ── Debug Chat ── */
  async function handleChatSend() {
    const msg = chatInput.trim()
    if (!msg || chatSending) return
    setChatInput("")
    const userMsg: ChatMessage = { role: "user", content: msg }
    setChatMessages((prev) => [...prev, userMsg])
    setChatSending(true)

    try {
      // Get API key for this app
      let key = apiKey
      if (!key) {
        const resp = await api(`/api/v1/dify/apps/${app.id}/api-key`)
        if (resp.ok) {
          const data = await resp.json()
          key = data.apiKey ?? ""
          setApiKey(key)
        }
      }

      if (!key) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Error: No API key available for this app." }])
        setChatSending(false)
        return
      }

      const resp = await api("/api/v1/dify/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: msg,
          inputs: {},
          response_mode: "blocking",
          conversation_id: conversationId || undefined,
          user: "regminder-debug",
          apiKey: key,
        }),
      })

      if (resp.ok) {
        const data = await resp.json()
        const answer = data.answer ?? data.message ?? data.text ?? "No response"
        if (data.conversation_id) setConversationId(data.conversation_id)
        setChatMessages((prev) => [...prev, { role: "assistant", content: answer }])
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${resp.status} ${resp.statusText}` }])
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${(err as Error).message}` }])
    }
    setChatSending(false)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const modeInfo = MODE_LABELS[appDetail.mode] ?? MODE_LABELS["chat"]
  const ModeIcon = modeInfo.icon

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
          <div className="flex items-center gap-2">
            <AppIcon app={appDetail} size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{appDetail.name}</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {modeInfo.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="h-8">
            {saving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Settings2 className="mr-1.5 h-3 w-3" />}
            Save
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white">
            {publishing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Rocket className="mr-1.5 h-3 w-3" />}
            Publish
          </Button>
        </div>
      </div>

      {/* Main layout: sidebar + content + debug panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar tabs */}
        <div className="w-48 shrink-0 border-r border-border bg-card/50 py-2">
          {CONFIG_TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                  tab === t.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
          <div className="my-2 border-t border-border" />
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete App
          </button>
        </div>

        {/* Center content area */}
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tab === "orchestrate" ? (
            <OrchestrateTab
              app={appDetail}
              instructions={instructions}
              onInstructionsChange={setInstructions}
              variables={variables}
              onVariablesChange={setVariables}
              knowledgeIds={knowledgeIds}
              onKnowledgeChange={setKnowledgeIds}
              tools={tools}
              onToolsChange={setTools}
              modelProvider={modelProvider}
              modelName={modelName}
              onModelChange={(p, n) => { setModelProvider(p); setModelName(n) }}
            />
          ) : tab === "skills" ? (
            <SkillsTab appId={app.id} />
          ) : tab === "memory" ? (
            <MemoryTab appId={app.id} />
          ) : tab === "api-access" ? (
            <ApiAccessTab appId={app.id} apiKey={apiKey} />
          ) : tab === "logs" ? (
            <PlaceholderTab title="Logs & Annotations" desc="View conversation logs and annotated examples. Coming soon." />
          ) : (
            <PlaceholderTab title="Monitoring" desc="Monitor app performance, latency and error rates. Coming soon." />
          )}
        </div>

        {/* Right: Debug & Preview panel */}
        <div className="w-[380px] shrink-0 border-l border-border flex flex-col bg-card/30">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Debug & Preview</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setChatMessages([]); setConversationId("") }}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs">Send a message to test your app</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatSending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Talk to Bot"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend() } }}
                disabled={chatSending}
                className="flex-1"
              />
              <Button size="sm" onClick={handleChatSend} disabled={chatSending || !chatInput.trim()} className="h-9 w-9 p-0 bg-indigo-600 hover:bg-indigo-700">
                <Send className="h-4 w-4 text-white" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── Module Master Section ───────── */

const MODULE_CODES = ["general", "MDM", "Delivery", "Sales", "Purchase", "LIMS", "ERP", "PM", "SD", "GMA", "IAM", "Compliance"]

function ModuleMasterSection({ difyAppId, appName }: { difyAppId: string; appName: string }) {
  const [moduleAgents, setModuleAgents] = useState<Array<{ module_agent_id: string; module_code: string; dify_app_id: string; display_name: string | null; is_master: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Which modules this chatbot is master for
  const masterModules = new Set(moduleAgents.filter((ma) => ma.dify_app_id === difyAppId && ma.is_master).map((ma) => ma.module_code))

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const resp = await api("/api/v1/ai-module-agents")
        if (resp.ok) {
          const data = await resp.json()
          setModuleAgents(data.items ?? [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  async function toggleMaster(moduleCode: string) {
    setSaving(true)
    const isCurrent = masterModules.has(moduleCode.toLowerCase())
    try {
      if (isCurrent) {
        // Remove master — find the record and delete it
        const record = moduleAgents.find((ma) => ma.module_code === moduleCode.toLowerCase() && ma.dify_app_id === difyAppId)
        if (record) {
          await api(`/api/v1/ai-module-agents/${record.module_agent_id}`, { method: "DELETE" })
        }
      } else {
        // Set as master
        await api("/api/v1/ai-module-agents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ moduleCode: moduleCode.toLowerCase(), difyAppId, displayName: appName, isMaster: true }),
        })
      }
      // Reload
      const resp = await api("/api/v1/ai-module-agents")
      if (resp.ok) {
        const data = await resp.json()
        setModuleAgents(data.items ?? [])
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  // Find which other chatbot is master for each module
  function otherMasterFor(moduleCode: string): string | null {
    const existing = moduleAgents.find((ma) => ma.module_code === moduleCode.toLowerCase() && ma.is_master && ma.dify_app_id !== difyAppId)
    return existing?.display_name ?? null
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-2 bg-muted/30 px-4 py-2.5 border-b border-border">
          <Crown className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Module Master</span>
        </div>
        <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 bg-muted/30 px-4 py-2.5 border-b border-border">
        <Crown className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">Module Master</span>
        <span className="text-xs text-muted-foreground ml-2">Assign this chatbot as the default for specific modules</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          {MODULE_CODES.map((mod) => {
            const isMaster = masterModules.has(mod.toLowerCase())
            const otherMaster = otherMasterFor(mod)
            return (
              <button
                key={mod}
                onClick={() => toggleMaster(mod)}
                disabled={saving}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  isMaster
                    ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700"
                    : "border-border hover:bg-muted/50 text-foreground",
                )}
                title={otherMaster ? `Currently assigned to: ${otherMaster}` : isMaster ? "Click to unassign" : "Click to set as master"}
              >
                {isMaster ? (
                  <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{mod}</span>
                {otherMaster && !isMaster && (
                  <span className="text-[9px] text-muted-foreground ml-auto truncate max-w-[60px]" title={otherMaster}>{otherMaster}</span>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          The master chatbot auto-loads in the floating chat window when users are in that module. Only one master per module.
        </p>
      </div>
    </section>
  )
}

/* ───────── Skills Tab (multi-select from skills catalog) ───────── */

interface SkillItem { id: string; name: string; description: string; module: string; entity: string; operation: string; icon: string; enabled: boolean }

function SkillsTab({ appId }: { appId: string }) {
  const [allSkills, setAllSkills] = useState<SkillItem[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [assignedMap, setAssignedMap] = useState<Record<string, string>>({}) // skillId → record id
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [filterModule, setFilterModule] = useState<string>("all")

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        // Fetch all available skills from skills-content catalog via same DEFAULT_SKILLS pattern
        // Since skills are frontend-defined, we import the same catalog used by agent-chat
        const catalogResp = await fetch("/api/proxy/api/v1/ai-skills").catch(() => null)
        let catalog: SkillItem[] = []
        if (catalogResp?.ok) {
          const data = await catalogResp.json()
          catalog = (data.items ?? []).map((s: Record<string, unknown>) => ({
            id: s.id ?? s.skill_id ?? "",
            name: s.name ?? s.skill_name ?? "",
            description: s.description ?? "",
            module: s.module ?? "global",
            entity: s.entity ?? "",
            operation: s.operation ?? "",
            icon: s.icon ?? "zap",
            enabled: s.enabled !== false,
          }))
        }
        // Fallback: hardcoded catalog if API not available
        if (catalog.length === 0) {
          catalog = [
            { id: "skill-country-create", name: "Create Country", description: "Creates a new country record in MDM master data", module: "mdm", entity: "country", operation: "create", icon: "globe", enabled: true },
            { id: "skill-country-delete", name: "Delete Country", description: "Soft-deletes a country record from MDM", module: "mdm", entity: "country", operation: "delete", icon: "globe", enabled: true },
            { id: "skill-standard-create", name: "Create Standard", description: "Creates a new standard/regulation record in MDM", module: "mdm", entity: "standard", operation: "create", icon: "shield", enabled: true },
            { id: "skill-standard-delete", name: "Delete Standard", description: "Soft-deletes a standard/regulation record", module: "mdm", entity: "standard", operation: "delete", icon: "shield", enabled: true },
            { id: "skill-ticket-create", name: "Create Ticket", description: "Creates a new service desk ticket", module: "sd", entity: "ticket", operation: "create", icon: "layers", enabled: true },
            { id: "skill-ticket-update", name: "Update Ticket", description: "Updates an existing service desk ticket", module: "sd", entity: "ticket", operation: "update", icon: "layers", enabled: true },
            { id: "skill-kb-search", name: "Search Knowledge Base", description: "Searches knowledge articles for relevant answers", module: "sd", entity: "knowledge_article", operation: "read", icon: "sparkles", enabled: true },
            { id: "skill-product-lookup", name: "Product Lookup", description: "Searches product lines by name, HS code, or category", module: "mdm", entity: "product_line", operation: "read", icon: "bot", enabled: true },
            { id: "skill-test-report", name: "Generate Test Report", description: "Generates a LIMS test report for a sample batch", module: "lims", entity: "test_report", operation: "create", icon: "sparkles", enabled: true },
            { id: "skill-compliance-check", name: "Compliance Check", description: "Runs compliance validation against standards for a product", module: "compliance", entity: "compliance_check", operation: "workflow", icon: "shield", enabled: true },
          ]
        }
        setAllSkills(catalog)

        // Fetch assigned skills for this agent
        const assignedResp = await api(`/api/v1/ai-agent-skills/${appId}`)
        if (assignedResp.ok) {
          const data = await assignedResp.json()
          const items = data.items ?? []
          const ids = new Set<string>(items.map((i: Record<string, string>) => i.skill_id))
          const map: Record<string, string> = {}
          for (const i of items) map[i.skill_id] = i.id
          setAssignedIds(ids)
          setAssignedMap(map)
        }
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [appId])

  async function toggleSkill(skill: SkillItem) {
    setSaving(true)
    const isAssigned = assignedIds.has(skill.id)
    try {
      if (isAssigned) {
        const recordId = assignedMap[skill.id]
        if (recordId) await api(`/api/v1/ai-agent-skills/${appId}/${recordId}`, { method: "DELETE" })
        setAssignedIds((prev) => { const n = new Set(prev); n.delete(skill.id); return n })
        setAssignedMap((prev) => { const n = { ...prev }; delete n[skill.id]; return n })
      } else {
        const resp = await api(`/api/v1/ai-agent-skills/${appId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ skillId: skill.id, skillName: skill.name, enabled: true }),
        })
        if (resp.ok) {
          const data = await resp.json()
          const newId = data.item?.id ?? data.id ?? skill.id
          setAssignedIds((prev) => new Set(prev).add(skill.id))
          setAssignedMap((prev) => ({ ...prev, [skill.id]: newId }))
        }
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function selectAll() {
    setSaving(true)
    try {
      const toAdd = filtered.filter((s) => !assignedIds.has(s.id))
      for (const skill of toAdd) {
        const resp = await api(`/api/v1/ai-agent-skills/${appId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ skillId: skill.id, skillName: skill.name, enabled: true }),
        })
        if (resp.ok) {
          const data = await resp.json()
          const newId = data.item?.id ?? data.id ?? skill.id
          setAssignedIds((prev) => new Set(prev).add(skill.id))
          setAssignedMap((prev) => ({ ...prev, [skill.id]: newId }))
        }
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function deselectAll() {
    setSaving(true)
    try {
      const toRemove = filtered.filter((s) => assignedIds.has(s.id))
      for (const skill of toRemove) {
        const recordId = assignedMap[skill.id]
        if (recordId) await api(`/api/v1/ai-agent-skills/${appId}/${recordId}`, { method: "DELETE" })
        setAssignedIds((prev) => { const n = new Set(prev); n.delete(skill.id); return n })
        setAssignedMap((prev) => { const n = { ...prev }; delete n[skill.id]; return n })
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const modules = [...new Set(allSkills.map((s) => s.module))]
  const filtered = allSkills.filter((s) => {
    if (filterModule !== "all" && s.module !== filterModule) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.entity.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const selectedCount = allSkills.filter((s) => assignedIds.has(s.id)).length

  const OP_COLORS: Record<string, string> = {
    create: "text-green-600 bg-green-500/10",
    read: "text-blue-600 bg-blue-500/10",
    update: "text-amber-600 bg-amber-500/10",
    delete: "text-red-600 bg-red-500/10",
    workflow: "text-purple-600 bg-purple-500/10",
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading skills...
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Skills</h3>
          <p className="text-xs text-muted-foreground">
            {selectedCount} of {allSkills.length} skills assigned &mdash; enabled skills are injected into the system prompt at runtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll} disabled={saving} className="h-7 text-xs">Select All</Button>
          <Button variant="outline" size="sm" onClick={deselectAll} disabled={saving} className="h-7 text-xs">Deselect All</Button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search skills..." className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Skill list — multi-select checkboxes */}
      <div className="space-y-1.5">
        {filtered.map((skill) => {
          const active = assignedIds.has(skill.id)
          return (
            <button
              key={skill.id}
              onClick={() => toggleSkill(skill)}
              disabled={saving}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors text-left",
                active
                  ? "border-blue-400 bg-blue-50/80 dark:bg-blue-900/20 dark:border-blue-700"
                  : "border-border hover:bg-muted/50",
              )}
            >
              {/* Checkbox */}
              <div className={cn(
                "h-4.5 w-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                active ? "border-blue-500 bg-blue-500" : "border-muted-foreground/40",
              )}>
                {active && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </div>
              <Zap className={cn("h-4 w-4 shrink-0", active ? "text-blue-500" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs">{skill.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{skill.description}</div>
              </div>
              <Badge variant="outline" className={cn("text-[9px] shrink-0", OP_COLORS[skill.operation] ?? "")}>{skill.operation}</Badge>
              <span className="text-[10px] text-muted-foreground uppercase shrink-0 w-12 text-right">{skill.module}</span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No skills match your filter.</div>
        )}
      </div>
    </div>
  )
}

/* ───────── Memory Tab (multi-select from memory documents) ───────── */

interface MemoryDoc { entity: string; scope: string; userId?: string; updatedAt?: string }
interface MemoryAssignment { id: string; dify_app_id: string; scope: string; entity: string; access: string }

function MemoryTab({ appId }: { appId: string }) {
  const [memoryDocs, setMemoryDocs] = useState<MemoryDoc[]>([])
  const [assigned, setAssigned] = useState<MemoryAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [filterScope, setFilterScope] = useState<string>("all")
  const [bulkAccess, setBulkAccess] = useState<string>("read")

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const [memResp, assignedResp] = await Promise.all([
          api("/api/v1/memory").catch(() => null),
          api(`/api/v1/ai-agent-memory/${appId}`),
        ])
        if (memResp?.ok) {
          const data = await memResp.json()
          setMemoryDocs(data.items ?? [])
        }
        if (assignedResp.ok) {
          const data = await assignedResp.json()
          setAssigned(data.items ?? [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [appId])

  // Build a lookup: "scope:entity" → assignment record
  const assignedKey = (a: { scope: string; entity: string }) => `${a.scope}:${a.entity}`
  const assignedLookup = new Map(assigned.map((a) => [assignedKey(a), a]))

  async function toggleMemory(doc: MemoryDoc) {
    const key = assignedKey(doc)
    const existing = assignedLookup.get(key)
    setSaving(true)
    try {
      if (existing) {
        await api(`/api/v1/ai-agent-memory/${appId}/${existing.id}`, { method: "DELETE" })
        setAssigned((prev) => prev.filter((a) => a.id !== existing.id))
      } else {
        const resp = await api(`/api/v1/ai-agent-memory/${appId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope: doc.scope, entity: doc.entity, access: bulkAccess }),
        })
        if (resp.ok) {
          const data = await resp.json()
          const newItem: MemoryAssignment = { id: data.item?.id ?? data.id ?? crypto.randomUUID(), dify_app_id: appId, scope: doc.scope, entity: doc.entity, access: bulkAccess }
          setAssigned((prev) => [...prev, newItem])
        }
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function selectAllFiltered() {
    setSaving(true)
    try {
      for (const doc of filtered) {
        const key = assignedKey(doc)
        if (assignedLookup.has(key)) continue
        const resp = await api(`/api/v1/ai-agent-memory/${appId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope: doc.scope, entity: doc.entity, access: bulkAccess }),
        })
        if (resp.ok) {
          const data = await resp.json()
          const newItem: MemoryAssignment = { id: data.item?.id ?? data.id ?? crypto.randomUUID(), dify_app_id: appId, scope: doc.scope, entity: doc.entity, access: bulkAccess }
          setAssigned((prev) => [...prev, newItem])
        }
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function deselectAllFiltered() {
    setSaving(true)
    try {
      for (const doc of filtered) {
        const key = assignedKey(doc)
        const existing = assignedLookup.get(key)
        if (!existing) continue
        await api(`/api/v1/ai-agent-memory/${appId}/${existing.id}`, { method: "DELETE" })
        setAssigned((prev) => prev.filter((a) => a.id !== existing.id))
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function toggleAccess(mem: MemoryAssignment) {
    const newAccess = mem.access === "read" ? "write" : "read"
    setSaving(true)
    try {
      // Delete and re-create with new access
      await api(`/api/v1/ai-agent-memory/${appId}/${mem.id}`, { method: "DELETE" })
      const resp = await api(`/api/v1/ai-agent-memory/${appId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: mem.scope, entity: mem.entity, access: newAccess }),
      })
      if (resp.ok) {
        const data = await resp.json()
        setAssigned((prev) => prev.map((a) => a.id === mem.id ? { ...a, id: data.item?.id ?? data.id ?? a.id, access: newAccess } : a))
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const scopes = [...new Set(memoryDocs.map((d) => d.scope))]
  const filtered = memoryDocs.filter((d) => {
    if (filterScope !== "all" && d.scope !== filterScope) return false
    if (search && !d.entity.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const selectedCount = assigned.length

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading memory...
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Memory</h3>
          <p className="text-xs text-muted-foreground">
            {selectedCount} memory doc{selectedCount !== 1 ? "s" : ""} assigned &mdash; selected documents provide persistent context to this agent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={bulkAccess} onValueChange={setBulkAccess}>
            <SelectTrigger className="h-7 w-[90px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="write">Write</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={selectAllFiltered} disabled={saving} className="h-7 text-xs">Select All</Button>
          <Button variant="outline" size="sm" onClick={deselectAllFiltered} disabled={saving} className="h-7 text-xs">Deselect All</Button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memory entities..." className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterScope} onValueChange={setFilterScope}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scopes</SelectItem>
            {scopes.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Memory doc list — multi-select checkboxes */}
      {filtered.length > 0 ? (
        <div className="space-y-1.5">
          {filtered.map((doc, idx) => {
            const key = assignedKey(doc)
            const assignment = assignedLookup.get(key)
            const active = !!assignment
            return (
              <div
                key={`${key}-${idx}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-purple-400 bg-purple-50/80 dark:bg-purple-900/20 dark:border-purple-700"
                    : "border-border hover:bg-muted/50",
                )}
              >
                {/* Checkbox */}
                <button onClick={() => toggleMemory(doc)} disabled={saving} className="shrink-0">
                  <div className={cn(
                    "h-4.5 w-4.5 rounded border-2 flex items-center justify-center transition-colors",
                    active ? "border-purple-500 bg-purple-500" : "border-muted-foreground/40",
                  )}>
                    {active && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </div>
                </button>
                <Brain className={cn("h-4 w-4 shrink-0", active ? "text-purple-500" : "text-muted-foreground")} />
                <button onClick={() => toggleMemory(doc)} disabled={saving} className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-xs">{doc.entity}</div>
                  <div className="text-[11px] text-muted-foreground">
                    scope: {doc.scope}{doc.userId ? ` · user: ${doc.userId}` : ""}{doc.updatedAt ? ` · updated: ${new Date(doc.updatedAt).toLocaleDateString()}` : ""}
                  </div>
                </button>
                {active && assignment && (
                  <button
                    onClick={() => toggleAccess(assignment)}
                    disabled={saving}
                    title={`Click to switch to ${assignment.access === "read" ? "write" : "read"}`}
                  >
                    <Badge variant={assignment.access === "write" ? "default" : "secondary"} className="text-[9px] cursor-pointer">
                      {assignment.access.toUpperCase()}
                    </Badge>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : memoryDocs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
          <Brain className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">No memory documents found.</div>
          <div className="text-xs text-muted-foreground">Create memory documents in the AI Memory page first, then assign them here.</div>
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground py-8">No memory docs match your filter.</div>
      )}
    </div>
  )
}

/* ───────── Orchestrate Tab ───────── */

function OrchestrateTab({
  app,
  instructions,
  onInstructionsChange,
  variables,
  onVariablesChange,
  knowledgeIds,
  onKnowledgeChange,
  tools,
  onToolsChange,
  modelProvider,
  modelName,
  onModelChange,
}: {
  app: DifyApp
  instructions: string
  onInstructionsChange: (v: string) => void
  variables: Array<{ key: string; name: string; type: string; required: boolean }>
  onVariablesChange: (v: Array<{ key: string; name: string; type: string; required: boolean }>) => void
  knowledgeIds: string[]
  onKnowledgeChange: (ids: string[]) => void
  tools: Array<Record<string, unknown>>
  onToolsChange: (t: Array<Record<string, unknown>>) => void
  modelProvider: string
  modelName: string
  onModelChange: (provider: string, model: string) => void
}) {
  const [showAddVar, setShowAddVar] = useState(false)
  const [newVar, setNewVar] = useState({ key: "", name: "", type: "text-input", required: false })

  // Available models from Dify
  const [availableModels, setAvailableModels] = useState<Array<{ provider: string; models: Array<{ model: string; label?: { en_US?: string }; model_type?: string }> }>>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setModelsLoading(true)
      try {
        const resp = await api("/api/v1/dify/models")
        if (resp.ok && !cancelled) {
          const data = await resp.json()
          // data is array of { provider: string, models: [...] } grouped by provider
          setAvailableModels(Array.isArray(data) ? data : data.data ?? [])
        }
      } catch { /* ignore */ }
      if (!cancelled) setModelsLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Flatten models for the dropdown
  const flatModels = availableModels.flatMap(g => {
    const providerName = (g as any).provider ?? ""
    // Strip "langgenius/x/" prefix to get bare provider name
    const bareProvider = providerName.includes("/") ? providerName.split("/").pop() ?? providerName : providerName
    return (g.models ?? []).map(m => ({
      provider: bareProvider,
      qualifiedProvider: providerName,
      model: m.model,
      label: m.label?.en_US ?? m.model,
    }))
  })

  const selectedValue = modelProvider && modelName ? `${modelProvider}::${modelName}` : ""

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-base font-semibold text-foreground">Orchestrate</h2>

      {/* Model selector */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          {modelsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-8 px-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading models...
            </div>
          ) : flatModels.length > 0 ? (
            <Select
              value={selectedValue}
              onValueChange={(v) => {
                const [prov, mod] = v.split("::")
                onModelChange(prov ?? "", mod ?? "")
              }}
            >
              <SelectTrigger className="h-8 text-sm border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue placeholder="Select a model..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {availableModels.map(g => {
                  const providerName = (g as any).provider ?? ""
                  const bareProvider = providerName.includes("/") ? providerName.split("/").pop() ?? providerName : providerName
                  return (g.models ?? []).map(m => (
                    <SelectItem key={`${bareProvider}::${m.model}`} value={`${bareProvider}::${m.model}`}>
                      <span className="text-muted-foreground">{bareProvider}</span>
                      <span className="mx-1">/</span>
                      <span>{m.label?.en_US ?? m.model}</span>
                    </SelectItem>
                  ))
                })}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={modelProvider && modelName ? `${modelProvider} / ${modelName}` : ""}
              onChange={(e) => {
                const parts = e.target.value.split("/").map((s) => s.trim())
                onModelChange(parts[0] ?? "", parts[1] ?? "")
              }}
              placeholder="provider / model-name (e.g. deepseek / deepseek-v4-flash)"
              className="h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          )}
        </div>
      </div>

      {/* Module Master — only for Chatbot (Manager) apps */}
      {app.mode === "chat" && (
        <ModuleMasterSection difyAppId={app.id} appName={app.name} />
      )}

      {/* Instructions */}
      <section className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-foreground">INSTRUCTIONS</span>
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5">?</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Sparkles className="mr-1 h-3 w-3" />
            Generate
          </Button>
        </div>
        <div className="relative">
          <Textarea
            value={instructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            placeholder="Write your prompt word here, enter '{' to insert a variable, enter '/' to insert a prompt co..."
            rows={8}
            className="border-0 rounded-none focus-visible:ring-0 resize-none text-sm"
          />
          <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">{instructions.length}</div>
        </div>
      </section>

      {/* Variables */}
      <section className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Variable className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Variables</span>
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5">?</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddVar(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        <div className="px-4 py-3">
          {variables.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Variables allow users to introduce prompt words or opening remarks when filling out forms.
              You can try entering &quot;{`{{input}}`}&quot; in the prompt words.
            </p>
          ) : (
            <div className="space-y-2">
              {variables.map((v, i) => (
                <div key={v.key || i} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px] font-mono">{v.type}</Badge>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{`{{${v.key}}}`}</code>
                  <span className="text-muted-foreground text-xs">{v.name}</span>
                  {v.required && <Badge className="text-[8px] h-4 bg-orange-500/10 text-orange-600 border-0">Required</Badge>}
                  <button
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => onVariablesChange(variables.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {showAddVar && (
          <div className="border-t border-border px-4 py-3 space-y-2">
            <div className="flex gap-2">
              <Input value={newVar.key} onChange={(e) => setNewVar({ ...newVar, key: e.target.value })} placeholder="Variable key" className="h-8 text-xs flex-1" />
              <Input value={newVar.name} onChange={(e) => setNewVar({ ...newVar, name: e.target.value })} placeholder="Display label" className="h-8 text-xs flex-1" />
            </div>
            <div className="flex gap-2 items-center">
              <Select value={newVar.type} onValueChange={(v) => setNewVar({ ...newVar, type: v })}>
                <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text-input">Text Input</SelectItem>
                  <SelectItem value="paragraph">Paragraph</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs" onClick={() => {
                if (newVar.key) {
                  onVariablesChange([...variables, { ...newVar }])
                  setNewVar({ key: "", name: "", type: "text-input", required: false })
                  setShowAddVar(false)
                }
              }}>Add</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowAddVar(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </section>

      {/* Knowledge */}
      <section className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Knowledge</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        <div className="px-4 py-3">
          {knowledgeIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">You can import Knowledge as context</p>
          ) : (
            <div className="space-y-1">
              {knowledgeIds.map((id) => (
                <div key={id} className="flex items-center gap-2 text-xs">
                  <BookOpen className="h-3 w-3 text-muted-foreground" />
                  <code className="bg-muted px-1.5 py-0.5 rounded">{id}</code>
                  <button
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => onKnowledgeChange(knowledgeIds.filter((k) => k !== id))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Metadata Filtering */}
      <section className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-foreground">METADATA FILTERING</span>
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5">?</span>
          </div>
          <Badge variant="outline" className="text-[10px]">Disabled</Badge>
        </div>
      </section>

      {/* Tools */}
      <section className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Tools</span>
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5">?</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{tools.length}/{tools.length} Enabled</span>
            <span className="text-muted-foreground/30">|</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
        </div>
        <div className="px-4 py-3">
          {tools.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tools configured. Add tools to enable your agent to take actions.</p>
          ) : (
            <div className="space-y-2">
              {tools.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-lg border border-border p-2">
                  <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{(t as any).tool_name ?? (t as any).name ?? `Tool ${i + 1}`}</span>
                  <Badge variant="outline" className="text-[8px] ml-auto">Enabled</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

/* ───────── API Access Tab ───────── */

function ApiAccessTab({ appId, apiKey }: { appId: string; apiKey: string }) {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-base font-semibold text-foreground">API Access</h2>
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">API Endpoint</label>
          <code className="text-xs bg-muted px-3 py-2 rounded block break-all">
            POST /api/v1/dify/chat
          </code>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">App ID</label>
          <code className="text-xs bg-muted px-3 py-2 rounded block break-all">{appId}</code>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
          <code className="text-xs bg-muted px-3 py-2 rounded block break-all">
            {apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(24)}` : "Loading..."}
          </code>
        </div>
      </div>
    </div>
  )
}

/* ───────── Placeholder Tab ───────── */

function PlaceholderTab({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Monitor className="h-8 w-8 mb-3 opacity-40" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs mt-1">{desc}</p>
    </div>
  )
}

/* ───────── App List Card ───────── */

function AppCard({ app, onClick, onEdit, onDuplicate, onDelete }: { app: DifyApp; onClick: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const modeInfo = MODE_LABELS[app.mode] ?? MODE_LABELS["chat"]
  const ModeIcon = modeInfo.icon
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="group relative flex gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm hover:border-primary/30 w-full">
      <button onClick={onClick} className="flex gap-3 flex-1 min-w-0 text-left">
        <AppIcon app={app} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{app.name}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              <ModeIcon className={cn("h-2.5 w-2.5 mr-0.5", modeInfo.color)} />
              {modeInfo.label}
            </Badge>
          </div>
          {app.description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{app.description}</p>
          )}
        </div>
      </button>

      {/* Context menu trigger */}
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

/* ───────── Main Component ───────── */

export function AiAgentsContent() {
  const [apps, setApps] = useState<DifyApp[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [selectedApp, setSelectedApp] = useState<DifyApp | null>(null)
  const [editApp, setEditApp] = useState<DifyApp | null>(null)

  const loadApps = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api("/api/v1/dify/apps?limit=100")
      if (resp.ok) {
        const data = await resp.json()
        const all = (data.data ?? []) as DifyApp[]
        // Only show agent-type apps (not workflow/chatflow — those go to AI Workflow page)
        setApps(all.filter((a) => a.mode !== "workflow" && a.mode !== "advanced-chat"))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const handleDuplicate = useCallback(async (app: DifyApp) => {
    try {
      const resp = await api("/api/v1/dify/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${app.name} (copy)`,
          mode: app.mode,
          description: app.description ?? "",
          icon_type: app.icon_type ?? "emoji",
          icon: app.icon ?? "🤖",
          icon_background: app.icon_background ?? "#FFEAD5",
        }),
      })
      if (resp.ok) {
        await loadApps()
      }
    } catch { /* ignore */ }
  }, [loadApps])

  const handleDeleteFromList = useCallback(async (app: DifyApp) => {
    if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return
    try {
      const resp = await api(`/api/v1/dify/apps/${app.id}`, { method: "DELETE" })
      if (resp.ok) {
        setApps((prev) => prev.filter((a) => a.id !== app.id))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadApps() }, [loadApps])

  // If an app is selected, show its config
  if (selectedApp) {
    return (
      <AppConfigView
        app={selectedApp}
        onBack={() => { setSelectedApp(null); loadApps() }}
        onDeleted={() => { setSelectedApp(null); loadApps() }}
      />
    )
  }

  const filtered = apps.filter((a) => {
    if (!search) return true
    const s = search.toLowerCase()
    return a.name.toLowerCase().includes(s) || (a.description ?? "").toLowerCase().includes(s) || a.mode.includes(s)
  })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">AI Apps</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search apps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-52 rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-9">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create App
          </Button>
          <Button variant="outline" size="sm" onClick={loadApps} className="h-9">
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((a) => (
              <AppCard
                key={a.id}
                app={a}
                onClick={() => setSelectedApp(a)}
                onEdit={() => setEditApp(a)}
                onDuplicate={() => handleDuplicate(a)}
                onDelete={() => handleDeleteFromList(a)}
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Layers className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {search ? `No apps matching "${search}"` : "No apps yet"}
            </p>
            <p className="text-xs mt-1">Create your first app to get started</p>
            <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create App
            </Button>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateAppDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(app) => {
          setSelectedApp(app)
          void loadApps()
        }}
      />

      {/* Edit dialog */}
      {editApp && (
        <EditAppDialog
          open={!!editApp}
          app={editApp}
          onClose={() => setEditApp(null)}
          onUpdated={(updated) => {
            setApps((prev) => prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a))
          }}
        />
      )}
    </div>
  )
}
