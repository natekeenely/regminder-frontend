"use client"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  Paperclip,
  Bot,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Terminal,
  Plus,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  Layers,
  Tag,
  Trash2,
  Edit3,
  X,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  Upload,
  Zap,
  Globe,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileManagerPanel } from "@/components/cli/file-manager-panel"

const AI_PROVIDER_LOGOS: Record<string, { label: string; logo: string }> = {
  openai: { label: "OpenAI", logo: "/logos/openai.svg" },
  "azure-openai": { label: "Azure OpenAI", logo: "/logos/azure-openai.svg" },
  anthropic: { label: "Anthropic", logo: "/logos/anthropic.svg" },
  "google-gemini": { label: "Google Gemini", logo: "/logos/gemini.svg" },
  deepseek: { label: "DeepSeek", logo: "/logos/deepseek.svg" },
}

function ProviderLogo({ provider, size = 14 }: { provider: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const meta = AI_PROVIDER_LOGOS[provider]
  if (!meta || failed) return <Bot style={{ width: size, height: size }} className="text-muted-foreground" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={meta.logo} alt={meta.label} style={{ width: size, height: size }} className="rounded-sm" onError={() => setFailed(true)} />
}

interface Attachment {
  id: string
  name: string
  type: string         // MIME type
  size: number
  textContent?: string // extracted text for text-based files
  dataUrl?: string     // base64 data URL for images
}

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  status?: "pending" | "processing" | "completed" | "error"
  steps?: WorkflowStep[]
  attachments?: Attachment[]
}

interface WorkflowStep {
  id: string
  label: string
  status: "pending" | "processing" | "completed" | "error"
  detail?: string
}

interface CommandExecutionResult {
  ok: boolean
  accepted: boolean
  correlationId: string
  detail: string
  selectedProvider?: string
  selectedModel?: string
  fallbackUsed?: boolean
  latencyMs?: number
  actionResult?: {
    action: string
    status: "success" | "error" | "skipped"
    detail: string
    resourceId?: string
    resourceType?: string
    provider?: string
  }
}

interface TimelineItem {
  id: string
  command: string
  timestamp: Date
  status: "success" | "error" | "processing"
  correlationId?: string
  provider?: string
  model?: string
  latencyMs?: number
  action?: string
  resourceId?: string
  detail: string
}

interface AuditEvent {
  ts: string
  event: string
  correlationId?: string
  provider?: string
  status?: string
  detail?: string
}

// ── New types ──

interface ChatSession {
  id: string
  title: string
  label: string
  agentId?: string
  agentName?: string
  model?: string
  createdAt: Date
  updatedAt: Date
}

interface PlanInfo {
  title: string
  model: string
  contextFiles: string[]
  status: "idle" | "planning" | "executing"
}

const MODULE_LABELS = [
  "general",
  "MDM",
  "Delivery",
  "Sales",
  "Purchase",
  "LIMS",
  "ERP",
  "PM",
  "SD",
  "GMA",
  "IAM",
  "Compliance",
]

/* ───────── Skill catalog (shared with skills-content.tsx) ───────── */

interface ChatSkill {
  id: string
  name: string
  description: string
  module: string
  entity: string
  operation: string
  icon: string
  steps: Array<{ order: number; action: string; description: string; endpoint?: string; method?: string }>
  inputSchema: string
}

const SKILL_CATALOG: ChatSkill[] = [
  {
    id: "skill-country-create",
    name: "Create Country",
    description: "Creates a new country record in MDM master data. Validates ISO 3166-1 alpha-2 code uniqueness.",
    module: "mdm",
    entity: "country",
    operation: "create",
    icon: "globe",
    steps: [
      { order: 1, action: "validate", description: "Validate required fields: country_code, country_name, status" },
      { order: 2, action: "check_duplicate", description: "Ensure country_code does not already exist", endpoint: "/api/v1/mdm/country", method: "GET" },
      { order: 3, action: "create", description: "Insert the new country record", endpoint: "/api/v1/mdm/country", method: "POST" },
      { order: 4, action: "confirm", description: "Return the created record" },
    ],
    inputSchema: '{ "country_code": "2-char ISO alpha-2", "country_name": "string", "status": "active|inactive" }',
  },
  {
    id: "skill-country-delete",
    name: "Delete Country",
    description: "Soft-deletes a country record from MDM. Checks for dependent references first.",
    module: "mdm",
    entity: "country",
    operation: "delete",
    icon: "globe",
    steps: [
      { order: 1, action: "validate", description: "Validate country_code or record ID" },
      { order: 2, action: "check_references", description: "Check dependent records", endpoint: "/api/v1/mdm/country/{{id}}/references", method: "GET" },
      { order: 3, action: "confirm_user", description: "Ask user for confirmation if references exist" },
      { order: 4, action: "delete", description: "Soft-delete the record", endpoint: "/api/v1/mdm/country/{{id}}", method: "DELETE" },
      { order: 5, action: "audit", description: "Log deletion to audit trail" },
    ],
    inputSchema: '{ "id": "UUID", "force": "boolean (default false)" }',
  },
  {
    id: "skill-standard-create",
    name: "Create Standard",
    description: "Creates a new standard/regulation record in MDM. Supports ISO, EN, ASTM standard bodies.",
    module: "mdm",
    entity: "standard",
    operation: "create",
    icon: "shield",
    steps: [
      { order: 1, action: "validate", description: "Validate required fields: standard_code, standard_name, standard_body" },
      { order: 2, action: "check_duplicate", description: "Ensure standard_code is unique", endpoint: "/api/v1/mdm/standard", method: "GET" },
      { order: 3, action: "create", description: "Insert new standard record", endpoint: "/api/v1/mdm/standard", method: "POST" },
      { order: 4, action: "link_categories", description: "Link to product categories if provided" },
      { order: 5, action: "confirm", description: "Return the created record" },
    ],
    inputSchema: '{ "standard_code": "e.g. ISO-9001", "standard_name": "string", "standard_body": "ISO|EN|ASTM|IEC", "version": "string" }',
  },
  {
    id: "skill-standard-delete",
    name: "Delete Standard",
    description: "Soft-deletes a standard/regulation record. Checks for dependent test methods and compliance mappings.",
    module: "mdm",
    entity: "standard",
    operation: "delete",
    icon: "shield",
    steps: [
      { order: 1, action: "validate", description: "Validate standard ID or standard_code" },
      { order: 2, action: "check_references", description: "Check dependent test methods, compliance mappings", endpoint: "/api/v1/mdm/standard/{{id}}/references", method: "GET" },
      { order: 3, action: "confirm_user", description: "Request explicit confirmation from user" },
      { order: 4, action: "delete", description: "Soft-delete the standard", endpoint: "/api/v1/mdm/standard/{{id}}", method: "DELETE" },
      { order: 5, action: "audit", description: "Log deletion to audit trail" },
    ],
    inputSchema: '{ "id": "UUID", "force": "boolean (default false)" }',
  },
]

function buildSkillSystemPromptSection(): string {
  const lines = [
    "\n\n## Available Skills",
    "You have access to the following executable skills. When a user's request matches a skill, guide them through it step by step.",
    "You can also list skills when the user asks what you can do or types /skills.\n",
  ]
  for (const s of SKILL_CATALOG) {
    lines.push(`### ${s.name} (${s.module.toUpperCase()} · ${s.entity} · ${s.operation})`)
    lines.push(s.description)
    lines.push("Steps:")
    for (const step of s.steps) {
      lines.push(`  ${step.order}. [${step.action}] ${step.description}${step.endpoint ? ` → ${step.method} ${step.endpoint}` : ""}`)
    }
    lines.push(`Input: ${s.inputSchema}\n`)
  }
  return lines.join("\n")
}

const SKILL_ICONS: Record<string, React.ReactNode> = {
  globe: <Globe className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
}

const OP_COLORS: Record<string, string> = {
  create: "text-green-600 bg-green-500/10 border-green-500/30",
  delete: "text-red-600 bg-red-500/10 border-red-500/30",
  read: "text-blue-600 bg-blue-500/10 border-blue-500/30",
  update: "text-amber-600 bg-amber-500/10 border-amber-500/30",
  workflow: "text-purple-600 bg-purple-500/10 border-purple-500/30",
}

const slashCommands = [
  { command: "/skills", description: "List all available AI skills", example: "/skills", isSkill: false },
  ...SKILL_CATALOG.map((s) => ({
    command: `/skill ${s.name.toLowerCase().replace(/\s+/g, "-")}`,
    description: `${s.operation.toUpperCase()} ${s.entity} — ${s.description.slice(0, 60)}…`,
    example: `${s.module.toUpperCase()} · ${s.entity}`,
    isSkill: true,
    skillIcon: s.icon,
    skillOp: s.operation,
  })),
  { command: "/lims", description: "Laboratory management commands", example: "/lims sample create", isSkill: false },
  { command: "/erp", description: "Enterprise resource planning commands", example: "/erp order new", isSkill: false },
  { command: "/pm", description: "Project management commands", example: "/pm project create", isSkill: false },
  { command: "/sd", description: "Service desk commands", example: "/sd ticket open", isSkill: false },
  { command: "/gma", description: "Global market access commands", example: "/gma regulation search EU", isSkill: false },
  { command: "/report", description: "Report commands", example: "/report draft", isSkill: false },
]

function makeSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function AgentChat({ minimal = false, viewMode = "agent", activeModule }: { minimal?: boolean; viewMode?: "dashboard" | "agent" | "split"; activeModule?: string }) {
  // ── Messages & input ──
  const [messages, setMessages] = useState<Message[]>([])
  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [showCommands, setShowCommands] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [auditLoadingFor, setAuditLoadingFor] = useState<string | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditCorrelationId, setAuditCorrelationId] = useState<string | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showSkillsPopup, setShowSkillsPopup] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // ── File handling ──
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const ACCEPTED_TYPES = [
    "text/plain", "text/csv", "text/markdown", "text/html", "text/xml",
    "application/json", "application/xml",
    "application/pdf",
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]

  function fileIcon(type: string) {
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />
    if (type.includes("spreadsheet") || type === "text/csv") return <FileSpreadsheet className="h-4 w-4" />
    if (type.includes("json") || type.includes("xml") || type.includes("html")) return <FileCode className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function processFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    const newAttachments: Attachment[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" exceeds 10MB limit.`)
        continue
      }

      const att: Attachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      }

      if (file.type.startsWith("image/")) {
        // Read as base64 data URL for images
        att.dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
      } else if (
        file.type.startsWith("text/") ||
        file.type === "application/json" ||
        file.type === "application/xml" ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".json") ||
        file.name.endsWith(".xml") ||
        file.name.endsWith(".html") ||
        file.name.endsWith(".log") ||
        file.name.endsWith(".yml") ||
        file.name.endsWith(".yaml") ||
        file.name.endsWith(".ts") ||
        file.name.endsWith(".tsx") ||
        file.name.endsWith(".js") ||
        file.name.endsWith(".py")
      ) {
        // Read as text
        att.textContent = await file.text()
      } else {
        // For binary files (PDF, docx, xlsx), note them but can't extract text client-side
        att.textContent = `[Attached file: ${file.name} (${formatFileSize(file.size)}, ${file.type})]`
      }

      newAttachments.push(att)
    }

    setAttachments((prev) => [...prev, ...newAttachments])
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // ── Drag and drop ──
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    if (e.dataTransfer.files?.length) {
      void processFiles(e.dataTransfer.files)
    }
  }

  // ── Agent type for chat selection (backed by Dify apps) ──
  interface ChatAgent {
    id: string
    name: string
    description: string
    avatar: string
    model: string
    module: string
    isMaster: boolean
    masterModules?: string[]
    enabled: boolean
    systemPromptRef: string
    skills: string[]
    knowledgeBases: string[]
    memoryScope: string
    maxTokens: number
    temperature: number
    behaviorRules: string[]
    triggerPatterns: string[]
    // Dify-specific
    difyAppId?: string
    difyAppApiKey?: string
    difyAppMode?: string
    icon_type?: string
    icon?: string
    icon_background?: string
  }

  // ── Load agents from Dify apps API ──
  async function fetchDifyAgents(): Promise<ChatAgent[]> {
    try {
      // Fetch apps and module-agent mappings in parallel
      const [appsResp, moduleResp] = await Promise.all([
        fetch("/api/proxy/api/v1/dify/apps?limit=100"),
        fetch("/api/proxy/api/v1/ai-module-agents").catch(() => null),
      ])
      if (!appsResp.ok) return []
      const data = await appsResp.json()
      const apps = (data.data ?? []) as Array<{
        id: string; name: string; description?: string; mode: string
        icon?: string; icon_type?: string; icon_background?: string
        model_config?: { pre_prompt?: string; model?: { name?: string; completion_params?: { temperature?: number; max_tokens?: number } } }
      }>

      // Build module-agent lookup: difyAppId → { module, isMaster }[]
      let moduleMap: Array<{ module_code: string; dify_app_id: string; is_master: boolean }> = []
      if (moduleResp?.ok) {
        const mData = await moduleResp.json()
        moduleMap = mData.items ?? []
      }

      // Only Chatbot (Manager) apps are selectable in chat — filter to mode "chat" only
      const chatApps = apps.filter((app) => app.mode === "chat")
      return chatApps.map((app) => {
        const mc = app.model_config
        const iconUrl = app.icon_type === "image" && app.icon
          ? `/api/proxy/api/v1/dify/files/${app.icon}/preview`
          : ""
        // Find all module master assignments for this app
        const masterEntries = moduleMap.filter((m) => m.dify_app_id === app.id && m.is_master)
        // Store first master module for primary context; store all for lookup
        const primaryModule = masterEntries[0]?.module_code ?? "global"
        return {
          id: app.id,
          name: app.name,
          description: app.description ?? "",
          avatar: iconUrl,
          model: mc?.model?.name ?? "",
          module: primaryModule,
          isMaster: masterEntries.length > 0,
          masterModules: masterEntries.map((m) => m.module_code),
          enabled: true,
          systemPromptRef: "",
          skills: [],
          knowledgeBases: [],
          memoryScope: "global",
          maxTokens: (mc?.model?.completion_params?.max_tokens as number) ?? 4096,
          temperature: (mc?.model?.completion_params?.temperature as number) ?? 0.7,
          behaviorRules: [],
          triggerPatterns: [],
          difyAppId: app.id,
          difyAppMode: app.mode,
          icon_type: app.icon_type,
          icon: app.icon,
          icon_background: app.icon_background,
        }
      })
    } catch { return [] }
  }

  // Cache for Dify app API keys (fetched lazily on agent selection)
  const difyApiKeyCache = useRef<Record<string, string>>({})
  async function getDifyAppApiKey(appId: string): Promise<string> {
    if (difyApiKeyCache.current[appId]) return difyApiKeyCache.current[appId]
    try {
      const resp = await fetch(`/api/proxy/api/v1/dify/apps/${appId}/api-key`)
      if (!resp.ok) return ""
      const data = await resp.json()
      const key = data.apiKey ?? ""
      if (key) difyApiKeyCache.current[appId] = key
      return key
    } catch { return "" }
  }

  // ── Model selector (from AI provider setup) ──
  function getAvailableModels(): { id: string; label: string; provider: string }[] {
    if (typeof window === "undefined") return []
    try {
      const raw = window.localStorage.getItem("hermes.aiProviders")
      if (!raw) return []
      const cfg = JSON.parse(raw) as { providers?: Array<{ provider: string; aiModel: string; aiModels?: string[] }>; defaultModel?: string }
      if (!Array.isArray(cfg.providers)) return []
      const seen = new Set<string>()
      const models: { id: string; label: string; provider: string }[] = []
      for (const p of cfg.providers) {
        const pModels: string[] = p.aiModels?.length ? p.aiModels : p.aiModel ? [p.aiModel] : []
        for (const m of pModels) {
          const model = (m || cfg.defaultModel || "").trim()
          if (model && !seen.has(model)) {
            seen.add(model)
            models.push({ id: model, label: model, provider: p.provider })
          }
        }
      }
      if (cfg.defaultModel && !seen.has(cfg.defaultModel)) {
        models.push({ id: cfg.defaultModel, label: cfg.defaultModel, provider: "default" })
      }
      return models
    } catch {
      return []
    }
  }

  function getDefaultModel(): string {
    const models = getAvailableModels()
    if (models.length > 0) return models[0]!.id
    try {
      const raw = window.localStorage.getItem("hermes.aiProviders")
      if (raw) {
        const cfg = JSON.parse(raw) as { defaultModel?: string }
        if (cfg.defaultModel) return cfg.defaultModel
      }
    } catch { /* */ }
    return "gpt-4o-mini"
  }

  // Helper: render agent icon (emoji or image)
  // eslint-disable-next-line @next/next/no-img-element
  function AgentIcon({ agent, size = 32 }: { agent?: ChatAgent | null; size?: number }) {
    if (!agent) return <img src="/logos/hermes-avatar.png" alt="Hermes" className="rounded-full object-cover" style={{ width: size, height: size }} /> // eslint-disable-line @next/next/no-img-element
    if (agent.icon_type === "image" && agent.avatar) {
      return <img src={agent.avatar} alt={agent.name} className="rounded-full object-cover" style={{ width: size, height: size }} /> // eslint-disable-line @next/next/no-img-element
    }
    if (agent.icon_type === "emoji" && agent.icon) {
      return (
        <span className="flex items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: agent.icon_background || "#D5F5F6", fontSize: size * 0.55 }}>
          {agent.icon}
        </span>
      )
    }
    return <img src="/logos/hermes-avatar.png" alt={agent.name} className="rounded-full object-cover" style={{ width: size, height: size }} /> // eslint-disable-line @next/next/no-img-element
  }

  const [availableModels, setAvailableModels] = useState<ReturnType<typeof getAvailableModels>>([])
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window === "undefined") return "gpt-4o-mini"
    return window.localStorage.getItem("hermes.selectedModel") ?? getDefaultModel()
  })

  // Agent selection
  const LAST_AGENT_KEY = "hermes.chat.lastAgentId"
  const [chatAgents, setChatAgents] = useState<ChatAgent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")

  // ── Helper: find best agent for a given context ──
  function pickAgentForContext(agents: ChatAgent[], mode: typeof viewMode, mod?: string): ChatAgent | undefined {
    // Helper: check if agent is master for a given module (checks masterModules array)
    const isMasterFor = (a: ChatAgent, m: string) =>
      a.isMaster && (a.masterModules ?? [a.module]).some((mm) => mm.toLowerCase() === m.toLowerCase())

    const globalMaster = agents.find((a) => isMasterFor(a, "general") || isMasterFor(a, "global"))

    if (mode === "dashboard") {
      // Floating AI: module-specific master (activeModule) → SD master → Global master → first agent
      if (mod) {
        const modMaster = agents.find((a) => isMasterFor(a, mod))
        if (modMaster) return modMaster
      }
      const sdMaster = agents.find((a) => isMasterFor(a, "sd"))
      return sdMaster ?? globalMaster ?? agents[0]
    }

    if (mode === "agent") {
      // Agent mode: last-used → Global master → first agent
      try {
        const lastId = window.localStorage.getItem(LAST_AGENT_KEY)
        if (lastId) {
          const last = agents.find((a) => a.id === lastId)
          if (last) return last
        }
      } catch { /* ignore */ }
      return globalMaster ?? agents[0]
    }

    if (mode === "split") {
      // Split view: module master → Global master → first agent
      if (mod) {
        const moduleMaster = agents.find((a) => isMasterFor(a, mod))
        if (moduleMaster) return moduleMaster
      }
      return globalMaster ?? agents[0]
    }

    // Fallback
    return globalMaster ?? agents[0]
  }

  // Refresh available models and agents when component mounts
  useEffect(() => {
    setAvailableModels(getAvailableModels())
    fetchDifyAgents().then((agents) => {
      setChatAgents(agents)
      const best = pickAgentForContext(agents, viewMode, activeModule)
      if (best) {
        setSelectedAgentId(best.id)
        if (best.model) setSelectedModel(best.model)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Split view: auto-switch agent when activeModule changes ──
  useEffect(() => {
    if (viewMode !== "split" || chatAgents.length === 0) return
    const best = pickAgentForContext(chatAgents, "split", activeModule)
    if (best && best.id !== selectedAgentId) {
      setSelectedAgentId(best.id)
      setSelectedModel(best.model)
    }
  }, [activeModule]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAgent = chatAgents.find((a) => a.id === selectedAgentId)

  function handleAgentChange(agentId: string) {
    setSelectedAgentId(agentId)
    const agent = chatAgents.find((a) => a.id === agentId)
    if (agent?.model) setSelectedModel(agent.model)
    // Persist last-used for Agent mode
    if (viewMode === "agent") {
      try { window.localStorage.setItem(LAST_AGENT_KEY, agentId) } catch { /* ignore */ }
    }
  }

  // ── Sessions (persisted to backend) ──
  const ACTIVE_KEY = "hermes.chat.activeSessionId"
  const USER_ID_KEY = "hermes.chat.userId"
  function getCurrentUserId(): string {
    if (typeof window === "undefined") return "demo-user"
    try {
      let uid = window.localStorage.getItem(USER_ID_KEY)
      if (uid) return uid
      // Generate a stable user ID and persist it
      uid = window.localStorage.getItem("hermes.displayName") || `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      window.localStorage.setItem(USER_ID_KEY, uid)
      return uid
    } catch { return "demo-user" }
  }
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState(() => {
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem(ACTIVE_KEY) ?? ""
  })
  // Track whether the active session has been persisted to backend
  const sessionPersistedRef = useRef<Set<string>>(new Set())
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editSessionTitle, setEditSessionTitle] = useState("")
  const [labelMenuSessionId, setLabelMenuSessionId] = useState<string | null>(null)
  const [labelMenuPos, setLabelMenuPos] = useState<{ x: number; y: number } | null>(null)
  const labelBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // ── Panels ──
  const [showSessionPanel, setShowSessionPanel] = useState(true)
  const [showProjectPanel, setShowProjectPanel] = useState(true)

  // ── Plan model ──
  const [planInfo] = useState<PlanInfo | null>({
    title: "Skills Creation",
    model: "Claude Opus 4.8",
    contextFiles: ["CLAUDE.md", "skills-content.tsx", "agent-chat.tsx"],
    status: "idle",
  })
  // Dynamic plan info derived from selected agent
  const activePlanInfo = planInfo ? {
    ...planInfo,
    title: selectedAgent?.name ?? planInfo.title,
    model: selectedModel || planInfo.model,
  } : null
  const [planCollapsed, setPlanCollapsed] = useState(false)
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const sessionLabel = activeSession?.label ?? "general"

  // ── User avatar from profile ──
  function UserAvatar() {
    const [avatar, setAvatar] = useState<string | null>(null)
    const [displayName, setDisplayName] = useState("User")
    useEffect(() => {
      const av = window.localStorage.getItem("hermes.avatar")
      if (av) setAvatar(av)
      const dn = window.localStorage.getItem("hermes.displayName")
      if (dn) setDisplayName(dn)
    }, [])
    if (avatar) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={avatar} alt={displayName} className="h-8 w-8 rounded-full object-cover ring-2 ring-border" />
    }
    const initials = displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
        <span className="text-xs font-medium">{initials}</span>
      </div>
    )
  }

  // ── Helpers ──
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  // ── Load sessions from backend on mount ──
  async function loadSessions() {
    const userId = getCurrentUserId()
    const welcomeMsg: Message = { id: "welcome", role: "system" as const, content: "Hermes Agent ready. Type a message to chat with AI, or use / for slash commands.", timestamp: new Date() }
    try {
      const resp = await fetch(`/api/proxy/api/v1/ai-chat/sessions?userId=${encodeURIComponent(userId)}`)
      const data = await resp.json() as { ok: boolean; items: Array<{ session_id: string; title: string; label: string; agent_id: string; agent_name: string; model: string; created_at: string; updated_at: string }> }
      if (data.ok && data.items.length > 0) {
        const loaded = data.items.map((s) => ({
          id: s.session_id,
          title: s.title,
          label: s.label,
          agentId: s.agent_id || undefined,
          agentName: s.agent_name || undefined,
          model: s.model || undefined,
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at),
        }))
        // Mark all loaded sessions as persisted
        for (const s of loaded) sessionPersistedRef.current.add(s.id)
        setSessions(loaded)
        // Restore active session or pick the first
        const savedActive = window.localStorage.getItem(ACTIVE_KEY)
        const targetId = (savedActive && loaded.find((s) => s.id === savedActive)) ? savedActive : loaded[0].id
        setActiveSessionId(targetId)
        // Restore agent from session
        const targetSession = loaded.find((s) => s.id === targetId)
        if (targetSession?.agentId && chatAgents.length > 0) {
          const matchedAgent = chatAgents.find((a) => a.id === targetSession.agentId)
          if (matchedAgent) {
            setSelectedAgentId(matchedAgent.id)
            if (matchedAgent.model) setSelectedModel(matchedAgent.model)
          }
        }
        await loadSessionMessages(targetId)
      } else {
        // No sessions — create a default one using selected agent as label
        const id = makeSessionId()
        const agentLbl = selectedAgent?.name || "general"
        const agentTitle = agentLbl === "general" ? "General Chat" : `New ${agentLbl} Session`
        await fetch("/api/proxy/api/v1/ai-chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id, userId, title: agentTitle, label: agentLbl, agentId: selectedAgent?.id, agentName: selectedAgent?.name, model: selectedModel }),
        })
        sessionPersistedRef.current.add(id)
        setSessions([{ id, title: agentTitle, label: agentLbl, createdAt: new Date(), updatedAt: new Date() }])
        setActiveSessionId(id)
        setMessages([welcomeMsg])
      }
    } catch {
      // Offline fallback — create local-only session
      const id = makeSessionId()
      const agentLbl = selectedAgent?.name || "general"
      const agentTitle = agentLbl === "general" ? "General Chat" : `New ${agentLbl} Session`
      setSessions([{ id, title: agentTitle, label: agentLbl, createdAt: new Date(), updatedAt: new Date() }])
      setActiveSessionId(id)
      setMessages([welcomeMsg])
    }
    setSessionsLoaded(true)
    setMounted(true)
  }

  async function loadSessionMessages(sessionId: string) {
    try {
      const resp = await fetch(`/api/proxy/api/v1/ai-chat/sessions/${sessionId}/messages`)
      const data = await resp.json() as { ok: boolean; items: Array<{ message_id: string; role: string; content: string; agent_name: string; model: string; attachments: unknown; created_at: string }> }
      if (data.ok && data.items.length > 0) {
        const loaded: Message[] = data.items.map((m) => ({
          id: m.message_id,
          role: m.role as Message["role"],
          content: m.content,
          timestamp: new Date(m.created_at),
          status: "completed" as const,
        }))
        setMessages(loaded)
      } else {
        setMessages([{ id: "welcome", role: "system" as const, content: "Hermes Agent ready. Type a message to chat with AI, or use / for slash commands.", timestamp: new Date() }])
      }
    } catch {
      setMessages([{ id: "welcome", role: "system" as const, content: "Hermes Agent ready. Type a message to chat with AI, or use / for slash commands.", timestamp: new Date() }])
    }
  }

  async function ensureSessionPersisted(sessionId: string) {
    if (sessionPersistedRef.current.has(sessionId)) return
    sessionPersistedRef.current.add(sessionId)
    const session = sessions.find((s) => s.id === sessionId)
    try {
      await fetch("/api/proxy/api/v1/ai-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: getCurrentUserId(),
          title: session?.title || "New Chat",
          label: session?.label || selectedAgent?.name || "general",
          agentId: selectedAgent?.id,
          agentName: selectedAgent?.name,
          model: selectedModel,
        }),
      })
    } catch { /* ignore — upsert will handle duplicates */ }
  }

  async function saveMessageToBackend(sessionId: string, msg: { id: string; role: string; content: string }) {
    if (!sessionId) return
    try {
      await ensureSessionPersisted(sessionId)
      await fetch(`/api/proxy/api/v1/ai-chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: msg.id,
          role: msg.role,
          content: msg.content,
          agentId: selectedAgent?.id,
          agentName: selectedAgent?.name,
          model: selectedModel,
        }),
      })
    } catch { /* ignore — message is already in local state */ }
  }

  useEffect(() => {
    void loadSessions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist active session ID to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !activeSessionId) return
    try { window.localStorage.setItem(ACTIVE_KEY, activeSessionId) } catch { /* */ }
  }, [activeSessionId])
  // Persist selected model
  useEffect(() => {
    if (typeof window === "undefined") return
    try { window.localStorage.setItem("hermes.selectedModel", selectedModel) } catch { /* */ }
  }, [selectedModel])

  useEffect(() => {
    if (sessionsLoaded && activeSessionId && !sessions.find((s) => s.id === activeSessionId) && sessions.length > 0) {
      setActiveSessionId(sessions[0]?.id ?? "")
    }
  }, [sessions, activeSessionId, sessionsLoaded])

  // ── Session management ──
  function defaultLabel(): string {
    return selectedAgent?.name || "general"
  }

  async function createNewSession(label?: string) {
    const now = new Date()
    const lbl = label ?? defaultLabel()
    const id = makeSessionId()
    const title = `New ${lbl === "general" ? "Chat" : lbl} Session`
    const newSession: ChatSession = { id, title, label: lbl, agentId: selectedAgent?.id, agentName: selectedAgent?.name, model: selectedModel, createdAt: now, updatedAt: now }
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(id)
    setMessages([{ id: "welcome", role: "system" as const, content: "Hermes Agent ready. Type a message to chat with AI, or use / for slash commands.", timestamp: new Date() }])
    setTimeline([])
    // Persist to backend
    sessionPersistedRef.current.add(id)
    try {
      await fetch("/api/proxy/api/v1/ai-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id, userId: getCurrentUserId(), title, label: lbl, agentId: selectedAgent?.id, agentName: selectedAgent?.name, model: selectedModel }),
      })
    } catch { /* ignore */ }
  }

  async function updateSessionLabel(sessionId: string, label: string) {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, label, updatedAt: new Date() } : s)))
    try {
      await fetch(`/api/proxy/api/v1/ai-chat/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      })
    } catch { /* ignore */ }
  }

  async function deleteSession(sessionId: string) {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId)
      if (filtered.length === 0) {
        const fallbackLbl = defaultLabel()
        const fallback: ChatSession = { id: makeSessionId(), title: `New ${fallbackLbl === "general" ? "Chat" : fallbackLbl} Session`, label: fallbackLbl, createdAt: new Date(), updatedAt: new Date() }
        // Create fallback in backend
        sessionPersistedRef.current.add(fallback.id)
        void fetch("/api/proxy/api/v1/ai-chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: fallback.id, userId: getCurrentUserId(), title: fallback.title, label: fallback.label }),
        })
        return [fallback]
      }
      return filtered
    })
    if (activeSessionId === sessionId) {
      setActiveSessionId("")
    }
    try {
      await fetch(`/api/proxy/api/v1/ai-chat/sessions/${sessionId}`, { method: "DELETE" })
    } catch { /* ignore */ }
  }

  function startRenameSession(s: ChatSession): void {
    setEditingSessionId(s.id)
    setEditSessionTitle(s.title)
  }

  async function saveRenameSession() {
    if (!editingSessionId) return
    const newTitle = editSessionTitle || sessions.find((s) => s.id === editingSessionId)?.title || "Chat"
    setSessions((prev) => prev.map((s) => (s.id === editingSessionId ? { ...s, title: newTitle, updatedAt: new Date() } : s)))
    setEditingSessionId(null)
    try {
      await fetch(`/api/proxy/api/v1/ai-chat/sessions/${editingSessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      })
    } catch { /* ignore */ }
  }

  async function switchSession(sessionId: string) {
    setActiveSessionId(sessionId)
    setTimeline([])
    // Restore agent from session history
    const target = sessions.find((s) => s.id === sessionId)
    if (target?.agentId) {
      const matchedAgent = chatAgents.find((a) => a.id === target.agentId)
      if (matchedAgent) {
        setSelectedAgentId(matchedAgent.id)
        if (matchedAgent.model) setSelectedModel(matchedAgent.model)
      }
    }
    await loadSessionMessages(sessionId)
  }

  // ── Slash commands ──
  useEffect(() => {
    if (input.startsWith("/") && !isComposing) {
      setShowCommands(true)
    } else {
      setShowCommands(false)
    }
  }, [input, isComposing])

  useEffect(() => {
    const onExternalTimeline = (event: Event) => {
      const detail = (event as CustomEvent<Partial<TimelineItem>>).detail
      if (!detail?.command) return
      const item: TimelineItem = {
        id: detail.id ?? `ext-${Date.now()}`,
        command: detail.command,
        timestamp: new Date(),
        status: detail.status ?? "success",
        correlationId: detail.correlationId,
        provider: detail.provider,
        model: detail.model,
        latencyMs: detail.latencyMs ?? 0,
        action: detail.action,
        resourceId: detail.resourceId,
        detail: detail.detail ?? "External action completed",
      }
      setTimeline((prev) => [item, ...prev].slice(0, 10))
    }
    window.addEventListener("hermes:timeline", onExternalTimeline as EventListener)
    return () => window.removeEventListener("hermes:timeline", onExternalTimeline as EventListener)
  }, [])

  useEffect(() => {
    const onOpenAudit = (event: Event) => {
      const detail = (event as CustomEvent<{ correlationId?: string }>).detail
      if (detail?.correlationId) {
        void loadAudit(detail.correlationId)
      }
    }
    window.addEventListener("hermes:audit-open", onOpenAudit as EventListener)
    return () => window.removeEventListener("hermes:audit-open", onOpenAudit as EventListener)
  }, [])

  useEffect(() => {
    const pending = window.localStorage.getItem("hermes.audit.open.correlationId")
    if (!pending) return
    window.localStorage.removeItem("hermes.audit.open.correlationId")
    void loadAudit(pending)
  }, [])

  // ── Build agent-aware system prompt ──
  function buildAgentSystemPrompt(agent: ChatAgent | undefined): string {
    // Resolve prompt template from localStorage if agent has a systemPromptRef
    let basePrompt = ""
    if (agent?.systemPromptRef) {
      try {
        const raw = window.localStorage.getItem("hermes.aiPrompts")
        if (raw) {
          const prompts = JSON.parse(raw) as Array<{ id: string; content: string }>
          const found = prompts.find((p) => p.id === agent.systemPromptRef)
          if (found?.content) basePrompt = found.content
        }
      } catch { /* ignore */ }
    }

    if (!agent) {
      // No agent selected — use default Hermes prompt
      return (
        "You are Hermes, the AI assistant of the REGMINDER TIC (Testing, Inspection & Certification) Platform. " +
        "You help users with regulatory compliance, lab management (LIMS), service desk tickets, project management, " +
        "master data, ERP orders, and general enterprise questions. " +
        "Always identify yourself as Hermes when asked who you are. Be helpful, concise, and professional." +
        buildSkillSystemPromptSection()
      )
    }

    const parts: string[] = []

    // Identity
    parts.push(`You are ${agent.name}, a specialized AI agent for the REGMINDER TIC Platform.`)
    if (agent.description) parts.push(agent.description)
    parts.push(`Module: ${agent.module.toUpperCase()}. Always identify yourself as ${agent.name} when asked who you are.`)

    // Base prompt from template
    if (basePrompt) {
      parts.push("")
      parts.push("## System Instructions")
      parts.push(basePrompt)
    }

    // Behavior rules
    if (agent.behaviorRules?.length > 0) {
      parts.push("")
      parts.push("## Behavior Rules")
      for (const rule of agent.behaviorRules) {
        parts.push(`- ${rule}`)
      }
    }

    // Skills — filter to agent's assigned skills if specified
    if (agent.skills?.length > 0) {
      const agentSkillIds = new Set(agent.skills)
      const agentSkills = SKILL_CATALOG.filter((s) => agentSkillIds.has(s.id))
      if (agentSkills.length > 0) {
        parts.push("")
        parts.push("## Available Skills")
        parts.push("You have access to the following executable skills. When a user's request matches a skill, guide them through it step by step.")
        for (const s of agentSkills) {
          parts.push(`### ${s.name} (${s.module.toUpperCase()} · ${s.entity} · ${s.operation})`)
          parts.push(s.description)
          parts.push("Steps:")
          for (const step of s.steps) {
            parts.push(`  ${step.order}. [${step.action}] ${step.description}${step.endpoint ? ` → ${step.method} ${step.endpoint}` : ""}`)
          }
          parts.push(`Input: ${s.inputSchema}\n`)
        }
      }
    } else {
      // No specific skills assigned — include all skills
      parts.push(buildSkillSystemPromptSection())
    }

    // Knowledge bases reference
    if (agent.knowledgeBases?.length > 0) {
      parts.push("")
      parts.push(`## Knowledge Bases`)
      parts.push(`You have access to ${agent.knowledgeBases.length} knowledge base(s). Use them to provide accurate, context-aware answers.`)
    }

    return parts.join("\n")
  }

  // ── Send message ──
  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return

    const commandInput = input
    const currentAttachments = [...attachments]
    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: commandInput,
      timestamp: new Date(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    }

    setMessages((prev) => [...prev, newMessage])
    setInput("")
    setAttachments([])
    // Persist user message to backend
    if (activeSessionId) void saveMessageToBackend(activeSessionId, newMessage)
    // Update session title from first user message if still default
    if (activeSession && activeSession.title.startsWith("New ")) {
      const newTitle = commandInput.slice(0, 60)
      setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? { ...s, title: newTitle, updatedAt: new Date() } : s)))
      void fetch(`/api/proxy/api/v1/ai-chat/sessions/${activeSession.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      }).catch(() => {})
    }

    // ── Slash command: /skills — list all available skills ──
    if (commandInput.trim().toLowerCase() === "/skills") {
      const skillList = SKILL_CATALOG.map((s) => `• **${s.name}** (${s.module.toUpperCase()} · ${s.entity} · ${s.operation}) — ${s.description}`).join("\n")
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Here are the available skills:\n\n${skillList}\n\nYou can use a skill by typing \`/skill <name>\` (e.g. \`/skill country-create\`) or just describe what you want to do and I'll match the right skill.`,
          timestamp: new Date(),
          status: "completed",
        },
      ])
      return
    }

    // ── Slash command: /skill <name> — show skill detail & start guided flow ──
    const skillMatch = commandInput.trim().match(/^\/skill\s+(.+)$/i)
    if (skillMatch) {
      const query = skillMatch[1]!.toLowerCase().replace(/\s+/g, "-")
      const found = SKILL_CATALOG.find((s) => s.id.includes(query) || s.name.toLowerCase().replace(/\s+/g, "-").includes(query))
      if (found) {
        const stepsText = found.steps.map((st) => `${st.order}. **${st.action}** — ${st.description}${st.endpoint ? ` (\`${st.method} ${st.endpoint}\`)` : ""}`).join("\n")
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `## Skill: ${found.name}\n${found.description}\n\n**Module:** ${found.module.toUpperCase()} · **Entity:** ${found.entity} · **Operation:** ${found.operation}\n\n**Execution Steps:**\n${stepsText}\n\n**Required Input:**\n\`\`\`\n${found.inputSchema}\n\`\`\`\n\nReady to execute? Provide the required fields and I'll guide you through each step.`,
            timestamp: new Date(),
            status: "completed",
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Skill "${skillMatch[1]}" not found. Type \`/skills\` to see all available skills.`,
            timestamp: new Date(),
            status: "error",
          },
        ])
      }
      return
    }

    if (!commandInput.trim().startsWith("/")) {
      // Direct AI chat — send conversation to the AI provider
      setIsSending(true)
      const pendingId = `ai-${Date.now()}`
      setTimeline((prev) => [
        { id: pendingId, command: commandInput, timestamp: new Date(), status: "processing", detail: "Calling AI..." },
        ...prev,
      ])

      try {
        // Build messages array from conversation history with agent-aware system prompt
        const chatMessages: Array<{ role: string; content: string }> = [
          { role: "system", content: buildAgentSystemPrompt(selectedAgent) },
        ]
        const history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }))
        chatMessages.push(...history)

        // Build user message with attachments
        let userContent = commandInput
        if (currentAttachments.length > 0) {
          const attachmentTexts = currentAttachments.map((att) => {
            if (att.textContent) {
              return `\n\n--- Attached file: ${att.name} ---\n${att.textContent}\n--- End of ${att.name} ---`
            }
            if (att.dataUrl) {
              return `\n\n[Image attached: ${att.name} (${formatFileSize(att.size)})]`
            }
            return `\n\n[File attached: ${att.name} (${formatFileSize(att.size)}, ${att.type})]`
          })
          userContent = (commandInput || "Please review the attached file(s).") + attachmentTexts.join("")
        }
        chatMessages.push({ role: "user", content: userContent })

        // Resolve Dify app API key for the selected agent
        let appApiKey = selectedAgent?.difyAppApiKey || ""
        if (!appApiKey && selectedAgent?.difyAppId) {
          appApiKey = await getDifyAppApiKey(selectedAgent.difyAppId)
        }

        const resp = await fetch("/api/proxy/api/v1/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: chatMessages,
            model: selectedModel || undefined,
            temperature: selectedAgent?.temperature ?? undefined,
            maxTokens: selectedAgent?.maxTokens ?? undefined,
            difyAppApiKey: appApiKey || undefined,
            conversationId: (selectedAgent as any)?.difyConversationId || undefined,
            user: typeof window !== "undefined" ? (localStorage.getItem("regminder_user_email") || "regminder-user") : "regminder-user",
          }),
        })
        const data = (await resp.json()) as {
          ok: boolean
          content: string
          provider: string
          model: string
          fallbackUsed: boolean
          detail?: string
          conversationId?: string
          messageId?: string
        }

        // Track Dify conversation for multi-turn
        if (data.conversationId && selectedAgent) {
          (selectedAgent as any).difyConversationId = data.conversationId
        }

        setTimeline((prev) =>
          prev.map((item) =>
            item.id === pendingId
              ? {
                  ...item,
                  status: data.ok ? "success" : "error",
                  provider: data.provider,
                  model: data.model,
                  detail: data.ok ? `Response from ${data.provider}/${data.model}` : (data.detail ?? "AI call failed"),
                }
              : item
          )
        )

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.ok ? data.content : `⚠️ ${data.detail ?? "AI call failed. Please check your AI provider configuration in AI Setup."}`,
          timestamp: new Date(),
          status: data.ok ? "completed" : "error",
        }
        setMessages((prev) => [...prev, assistantMessage])
        // Persist assistant message to backend
        if (activeSessionId && data.ok) void saveMessageToBackend(activeSessionId, assistantMessage)
      } catch (error) {
        const detail = error instanceof Error ? error.message : "AI chat failed"
        setTimeline((prev) =>
          prev.map((item) => (item.id === pendingId ? { ...item, status: "error", detail } : item))
        )
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `⚠️ AI chat error: ${detail}. Make sure AI providers are configured in **Config Center → AI Setup**.`,
            timestamp: new Date(),
            status: "error",
          },
        ])
      } finally {
        setIsSending(false)
      }
      return
    }

    setIsSending(true)
    const pendingId = `tl-${Date.now()}`
    setTimeline((prev) => [
      { id: pendingId, command: commandInput, timestamp: new Date(), status: "processing", detail: "Submitting command..." },
      ...prev,
    ])

    try {
      const resp = await fetch("/api/proxy/api/v1/cli/commands/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "tic-global", userId: "demo-user", channel: "teams", command: commandInput, args: {}, model: selectedModel }),
      })
      const data = (await resp.json()) as CommandExecutionResult
      const ok = Boolean(data.ok)
      const actionStatus = data.actionResult?.status ?? (ok ? "success" : "error")

      setTimeline((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? { ...item, status: ok && actionStatus !== "error" ? "success" : "error", correlationId: data.correlationId, provider: data.selectedProvider, model: data.selectedModel, latencyMs: data.latencyMs, action: data.actionResult?.action ?? "unknown", resourceId: data.actionResult?.resourceId, detail: data.actionResult?.detail ?? data.detail }
            : item
        )
      )

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.detail,
        timestamp: new Date(),
        status: ok ? "completed" : "error",
        steps: [
          { id: "orchestration", label: "AI orchestration", status: ok ? "completed" : "error", detail: `${data.selectedProvider ?? "none"} / ${data.selectedModel ?? "none"}` },
          { id: "action", label: data.actionResult?.action ?? "command-action", status: data.actionResult?.status === "success" ? "completed" : data.actionResult?.status === "skipped" ? "pending" : "error", detail: data.actionResult?.detail ?? data.detail },
        ],
      }
      setMessages((prev) => [...prev, assistantMessage])
      if (activeSessionId) void saveMessageToBackend(activeSessionId, assistantMessage)
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to execute command"
      setTimeline((prev) => prev.map((item) => (item.id === pendingId ? { ...item, status: "error", detail } : item)))
      const errMsg = { id: (Date.now() + 1).toString(), role: "assistant" as const, content: detail, timestamp: new Date(), status: "error" as const }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const selectCommand = (command: string) => {
    setInput(command + " ")
    setShowCommands(false)
    inputRef.current?.focus()
  }

  const loadAudit = async (correlationId?: string) => {
    if (!correlationId) return
    setAuditLoadingFor(correlationId)
    setAuditError(null)
    try {
      const resp = await fetch(`/api/proxy/api/v1/audit/${encodeURIComponent(correlationId)}`)
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.detail ?? `Audit request failed (${resp.status})`)
      setAuditCorrelationId(correlationId)
      setAuditEvents(Array.isArray(data.events) ? data.events : [])
    } catch (error) {
      setAuditCorrelationId(correlationId)
      setAuditEvents([])
      setAuditError(error instanceof Error ? error.message : "Failed to load audit")
    } finally {
      setAuditLoadingFor(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-3 w-3 text-success" />
      case "processing": return <Loader2 className="h-3 w-3 animate-spin text-primary" />
      case "pending": return <Clock className="h-3 w-3 text-muted-foreground" />
      case "error": return <AlertCircle className="h-3 w-3 text-destructive" />
      default: return null
    }
  }

  // ── Render ──
  return (
    <div className="flex h-full bg-background">
      {/* ── Area 1: Session Panel (left sidebar) ── */}
      {!minimal && showSessionPanel && (
        <div className="flex w-[260px] shrink-0 flex-col border-r border-border bg-card">
          {/* ── Area 1: Plan Model (top of sidebar) ── */}
          {activePlanInfo && (
            <div className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
              {planCollapsed ? (
                <button
                  onClick={() => setPlanCollapsed(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                >
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Plan: {activePlanInfo.title}</span>
                  <ChevronDown className="h-3 w-3 ml-auto" />
                </button>
              ) : (
                <div className="px-3 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Plan</span>
                    </div>
                    <button onClick={() => setPlanCollapsed(true)} className="rounded p-0.5 text-muted-foreground hover:text-foreground" title="Collapse plan">
                      <ChevronDown className="h-3 w-3 rotate-180" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Task</span>
                      <div className="text-xs font-medium text-foreground">{activePlanInfo.title}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Model</span>
                      <div className="text-xs text-foreground">{activePlanInfo.model}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Context</span>
                      <div className="text-[11px] text-muted-foreground">{activePlanInfo.contextFiles.length} files loaded</div>
                    </div>
                    <div className="flex items-center gap-1.5" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New session button */}
          <div className="border-b border-border p-3">
            <button
              onClick={() => createNewSession()}
              className="flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              New Chat Session
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Chat History</span>
                <span className="text-[10px] text-muted-foreground">{sessions.length}</span>
              </div>
            </div>
            <div className="space-y-0.5 px-2">
              {sessions.map((s) => {
                const isActive = s.id === activeSessionId
                const isEditing = editingSessionId === s.id
                const labelColor = s.label === "general" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                return (
                  <div key={s.id} className="group relative">
                    {isEditing ? (
                      <div className="flex items-center gap-1 rounded-lg border border-primary bg-background px-2 py-1.5">
                        <input
                          value={editSessionTitle}
                          onChange={(e) => setEditSessionTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveRenameSession() }}
                          className="flex-1 bg-transparent text-xs outline-none"
                          autoFocus
                        />
                        <button onClick={saveRenameSession} className="rounded p-0.5 text-primary hover:bg-primary/10"><CheckCircle2 className="h-3 w-3" /></button>
                        <button onClick={() => setEditingSessionId(null)} className="rounded p-0.5 text-muted-foreground hover:bg-muted"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => switchSession(s.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                          isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">{s.title}</div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", labelColor)}>{s.label}</span>
                            <span>{s.updatedAt.toLocaleDateString()}</span>
                          </div>
                        </div>
                        {/* Action buttons on hover */}
                        <div className="hidden gap-0.5 group-hover:flex">
                          <button
                            ref={(el) => { if (el) labelBtnRefs.current.set(s.id, el); else labelBtnRefs.current.delete(s.id) }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (labelMenuSessionId === s.id) {
                                setLabelMenuSessionId(null)
                                setLabelMenuPos(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setLabelMenuPos({ x: rect.left, y: rect.bottom + 4 })
                                setLabelMenuSessionId(s.id)
                              }
                            }}
                            className="rounded p-0.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            title="Add label"
                          >
                            <Tag className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); startRenameSession(s) }} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Rename">
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }} className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── Floating label popup (rendered at root to avoid overflow clipping) ── */}
      {labelMenuSessionId && labelMenuPos && (
        <div
          className="fixed z-[9999] min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-xl"
          style={{ left: labelMenuPos.x, top: labelMenuPos.y }}
        >
          {MODULE_LABELS.map((lbl) => {
            const s = sessions.find((x) => x.id === labelMenuSessionId)
            return (
              <button
                key={lbl}
                onClick={() => {
                  if (s) updateSessionLabel(s.id, lbl)
                  setLabelMenuSessionId(null)
                  setLabelMenuPos(null)
                }}
                className={cn(
                  "block w-full rounded px-2.5 py-1.5 text-left text-[11px] hover:bg-muted",
                  s?.label === lbl ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                )}
              >
                {lbl === "general" ? "🏷 general (default)" : `🏷 ${lbl}`}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Main chat area ── */}
      <div
        className={cn("flex flex-1 flex-col overflow-hidden bg-background relative", isDragging && "ring-2 ring-primary/50 ring-inset")}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/5 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-card/90 px-12 py-10 shadow-xl">
              <Upload className="h-10 w-10 text-primary" />
              <div className="text-lg font-semibold text-foreground">Drop files here</div>
              <div className="text-sm text-muted-foreground">Attach documents, images, or data files to your message</div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center border-b border-border px-4 py-3">
          <button
            onClick={() => setShowSessionPanel((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden transition-colors hover:ring-2 hover:ring-primary/30 shrink-0"
            title={showSessionPanel ? "Hide chat history" : "Show chat history"}
          >
            <AgentIcon agent={selectedAgent} size={32} />
          </button>
          <div className="ml-2 min-w-0">
            {chatAgents.length > 0 ? (
              <Select value={selectedAgentId} onValueChange={handleAgentChange}>
                <SelectTrigger className="h-auto w-auto gap-1 border-0 bg-transparent p-0 shadow-none text-sm font-semibold text-foreground hover:text-primary focus:ring-0">
                  <SelectValue>{selectedAgent?.name ?? "Select Agent"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {chatAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <AgentIcon agent={a} size={20} />
                        <span>{a.name}</span>
                        <span className="text-[10px] text-muted-foreground">MANAGER</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <h2 className="text-sm font-semibold text-foreground">Hermes Agent</h2>
            )}
            <p className="text-xs text-muted-foreground truncate">
              {activeSession ? `${activeSession.title.slice(0, 40)} · ${sessionLabel}` : "Natural Language + Command Interaction"}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {timeline.length > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-card p-3">
              <div className="mb-2 text-xs font-semibold text-foreground">Execution Timeline</div>
              <div className="space-y-2">
                {timeline.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs text-primary">{item.command}</code>
                      <span className={cn("text-[10px]", item.status === "success" ? "text-success" : item.status === "processing" ? "text-warning" : "text-destructive")}>{item.status}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{`${item.provider ?? "none"} / ${item.model ?? "none"} | ${item.action ?? "n/a"} | ${item.latencyMs ?? 0}ms`}</div>
                    <div className="text-[10px] text-muted-foreground">{item.detail}</div>
                    {item.correlationId && (
                      <div className="mt-1">
                        <button onClick={() => loadAudit(item.correlationId)} disabled={auditLoadingFor === item.correlationId} className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted disabled:opacity-60">
                          {auditLoadingFor === item.correlationId ? "Loading..." : "View Audit"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {(auditCorrelationId || auditError) && (
                <div className="mt-3 rounded-md border border-border/60 bg-muted/10 p-2">
                  <div className="mb-1 text-[11px] font-semibold text-foreground">Audit Trail {auditCorrelationId ? `(${auditCorrelationId})` : ""}</div>
                  {auditError ? <div className="text-[10px] text-destructive">{auditError}</div> :
                   auditEvents.length === 0 ? <div className="text-[10px] text-muted-foreground">No events.</div> :
                   <div className="space-y-1">
                    {auditEvents.slice(0, 20).map((event, index) => (
                      <div key={`${event.ts}-${event.event}-${index}`} className="text-[10px] text-muted-foreground">
                        <span className="text-foreground">{event.event}</span>{" | "}{event.provider ?? "n/a"}{" | "}{event.status ?? "n/a"}{" | "}{new Date(event.ts).toLocaleTimeString()}{event.detail ? ` | ${event.detail}` : ""}
                      </div>
                    ))}
                  </div>}
                </div>
              )}
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}>
                {/* Avatar */}
                {message.role === "assistant" || message.role === "system" ? (
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden", message.role === "assistant" ? "" : "bg-muted")}>
                    {message.role === "assistant" ? (
                      <AgentIcon agent={selectedAgent} size={32} />
                    ) : (
                      <Terminal className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ) : (
                  <UserAvatar />
                )}
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", message.role === "user" ? "bg-primary text-primary-foreground ml-auto" : message.role === "assistant" ? "bg-muted/50" : "bg-muted/30 italic")}>
                  {/* Attachment thumbnails */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {message.attachments.map((att) => (
                        <div key={att.id} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]", message.role === "user" ? "bg-primary-foreground/15" : "bg-muted")}>
                          {att.dataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={att.dataUrl} alt={att.name} className="h-6 w-6 rounded object-cover" />
                          ) : (
                            <span className={message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}>{fileIcon(att.type)}</span>
                          )}
                          <span className="truncate max-w-[120px]">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  {message.steps && (
                    <div className="mt-3 space-y-2 rounded-lg bg-background/50 p-3">
                      {message.steps.map((step) => (
                        <div key={step.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(step.status)}
                            <span className="text-xs text-foreground">{step.label}</span>
                          </div>
                          {step.detail && <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{step.detail}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className={cn("mt-2 text-[10px]", message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {mounted ? message.timestamp.toLocaleTimeString() : ""}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Slash Commands Popup */}
        {showCommands && (
          <div className="mx-4 mb-2 max-h-[360px] overflow-auto rounded-lg border border-border bg-card p-2">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Available Commands & Skills</div>
            <div className="space-y-0.5">
              {slashCommands.filter((cmd) => cmd.command.toLowerCase().includes(input.toLowerCase()) || cmd.description.toLowerCase().includes(input.replace("/", "").toLowerCase())).map((cmd) => (
                <button key={cmd.command} onClick={() => selectCommand(cmd.command)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted">
                  {"isSkill" in cmd && cmd.isSkill ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      {SKILL_ICONS[(cmd as any).skillIcon] ?? <Zap className="h-3.5 w-3.5" />}
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                      <Terminal className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary">{cmd.command}</span>
                      {"isSkill" in cmd && cmd.isSkill && (
                        <span className={cn("rounded-full border px-1.5 py-0.5 text-[8px] font-medium", OP_COLORS[(cmd as any).skillOp] ?? "")}>
                          {(cmd as any).skillOp}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{cmd.description}</div>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">{cmd.example}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-gradient-to-t from-background to-transparent p-4">
          <div className="mx-auto max-w-3xl">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-sm"
                  >
                    {att.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.dataUrl} alt={att.name} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground">
                        {fileIcon(att.type)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate max-w-[140px] font-medium text-foreground">{att.name}</div>
                      <div className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</div>
                    </div>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="ml-1 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".txt,.csv,.md,.json,.xml,.html,.log,.yml,.yaml,.ts,.tsx,.js,.py,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.docx,.xlsx,.pptx"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    void processFiles(e.target.files)
                    e.target.value = ""
                  }
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Attach files"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowSkillsPopup((v) => !v)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                    showSkillsPopup ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title="Skills"
                >
                  <Zap className="h-5 w-5" />
                </button>
                {showSkillsPopup && (
                  <div className="absolute bottom-12 left-0 z-50 w-[340px] rounded-xl border border-border bg-card shadow-xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Available Skills</span>
                      </div>
                      <button onClick={() => setShowSkillsPopup(false)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="max-h-[320px] overflow-auto p-2 space-y-1">
                      {SKILL_CATALOG.map((skill) => (
                        <button
                          key={skill.id}
                          onClick={() => {
                            setShowSkillsPopup(false)
                            setInput(`/skill ${skill.name.toLowerCase().replace(/\s+/g, "-")} `)
                            inputRef.current?.focus()
                          }}
                          className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                            {SKILL_ICONS[skill.icon] ?? <Zap className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground">{skill.name}</span>
                              <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-medium", OP_COLORS[skill.operation] ?? "")}>{skill.operation}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground truncate">{skill.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-border px-4 py-2">
                      <div className="text-[10px] text-muted-foreground">Click a skill to use it, or type <code className="rounded bg-muted px-1">/skills</code> in chat</div>
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder={attachments.length > 0 ? "Add a message about your files..." : "Enter message or / command..."}
                className="min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isSending}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Area 2: File Manager (right panel) ── */}
      {!minimal && showProjectPanel && (
        <div className="flex w-[260px] shrink-0 flex-col border-l border-border bg-card">
          <FileManagerPanel onClose={() => setShowProjectPanel(false)} />
        </div>
      )}

      {/* Pull handle to reopen panels */}
      {!minimal && !showProjectPanel && (
        <div className="flex w-[32px] shrink-0 flex-col border-l border-border bg-muted/20">
          <button
            onClick={() => setShowProjectPanel(true)}
            className="group flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Pull to open files"
          >
            <span className="text-[12px] leading-none text-muted-foreground/30 group-hover:text-muted-foreground">⋮</span>
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          {activePlanInfo && (
            <button
              onClick={() => setPlanCollapsed((v) => !v)}
              className={cn(
                "flex items-center justify-center border-t border-border py-2 transition-colors hover:bg-primary/10",
                planCollapsed ? "text-primary bg-primary/5" : "text-muted-foreground"
              )}
              title={planCollapsed ? "Expand plan" : "Collapse plan"}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
