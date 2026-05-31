"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Settings,
  LayoutGrid,
  Plug,
  UserCircle,
  Terminal,
  Save,
  RotateCcw,
  ChevronRight,
  Check,
  Copy,
  Sparkles,
  Shield,
  Database,
  Zap,
  Info,
  GripVertical,
  X,
  Plus,
  Eye,
  EyeOff,
  Bot,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Widget {
  id: string
  label: string
  enabled: boolean
}

interface Module {
  id: string
  label: string
  description: string
  enabled: boolean
  icon: React.ReactNode
}

interface QuickAction {
  id: string
  command: string
  description: string
}

interface ApiOutput {
  ok: boolean
  userId: string
  timestamp: string
  widgets: string[]
  modules: string[]
  quickActions: string[]
  connectors: {
    admin: { type: string; config: Record<string, unknown> }
    user: { type: string; config: Record<string, unknown> }
  }
}

interface AiProviderConfig {
  id: string
  provider: string
  aiUrl: string
  aiToken: string
  aiModel: string
}

interface AiProvidersApiPayload {
  defaultProvider: string
  fallbackOrder: string[]
  providers: Array<{
    provider: string
    aiUrl: string
    aiToken: string
    aiModel: string
    enabled?: boolean
  }>
}

interface NotificationAuditRow {
  id: string
  userId: string
  action: string
  ok: boolean
  provider?: string
  detail: string
  correlationId?: string
  createdAt: string
}

interface NotificationAuditSummary {
  total: number
  success: number
  failed: number
  byProvider: Record<string, number>
}

interface OpsCircuitRow {
  failures: number
  open: boolean
  openUntilMs: number
}

interface OpsDlqRow {
  id: string
  createdAt: string
  provider: "teams" | "lark" | "wecom"
  correlationId: string
  text: string
  reason: string
  attempts: number
}

interface WorkflowRuntimeConfig {
  teamsWebhookUrl: string
  larkWebhookUrl: string
  wecomWebhookUrl: string
  mailTo: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
}

interface ApprovalPolicyRow {
  policy_id?: string
  entity_key: string
  action_type: string
  enabled: boolean
  auto_route_to?: string | null
  sla_hours: number
  escalate_to?: string | null
  notify_channels: string[]
}

interface ApprovalKpiSummary {
  total: number
  pending: number
  overdue: number
  escalated: number
  avgApprovalSec: number
  avgExecutionSec: number
}

interface ApprovalKpiTrendRow {
  day: string
  total: number
  pending: number
  overdue: number
}

interface DigestConfig {
  enabled: boolean
  time: string
  timezone: string
  recipients: string
  channels: string
}

interface OpsThresholds {
  overdueWarnCount: number
  escalatedWarnCount: number
  dlqWarnCount: number
  circuitFailureWarnCount: number
}

interface DigestPreviewPayload {
  days: number
  channels: string
  recipients: string
  summary: {
    total: number
    pending: number
    overdue: number
    escalated: number
  }
  preview: string
}

interface EscalationWorkerConfig {
  enabled: boolean
  pollSeconds: number
  reminderBeforeHoursT4: number
  reminderBeforeHoursT1: number
  escalationReminderMinutes: number
  lastRunAt?: string | null
  lastError?: string | null
  lastSummary?: Record<string, number> | null
}

interface ReadinessCheckItem {
  key: string
  ok: boolean
  detail: string
  latencyMs: number
}

function BrandMark({
  label,
  logo,
  icon,
  forceLightBg = false,
}: {
  label: string
  logo?: string
  icon: React.ReactNode
  forceLightBg?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (!logo || failed) {
    return <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={label}
      className={cn(
        "h-4 w-4 rounded-sm p-0.5",
        forceLightBg ? "bg-white ring-1 ring-white/70" : "bg-white p-0.5"
      )}
      onError={() => setFailed(true)}
    />
  )
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const resp = await fetch(`/api/proxy${path}`, init)
  const text = await resp.text()
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const initialWidgets: Widget[] = [
  { id: "kpi-overview", label: "KPI Overview", enabled: true },
  { id: "orders-today", label: "Orders Today", enabled: true },
  { id: "lab-queue", label: "Lab Queue", enabled: true },
  { id: "equipment-status", label: "Equipment Status", enabled: false },
  { id: "team-activity", label: "Team Activity", enabled: false },
  { id: "compliance-alerts", label: "Compliance Alerts", enabled: true },
]

const initialModules: Module[] = [
  {
    id: "LIMS",
    label: "LIMS",
    description: "Laboratory Information Management",
    enabled: true,
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "ERP",
    label: "ERP",
    description: "Enterprise Resource Planning",
    enabled: true,
    icon: <LayoutGrid className="h-4 w-4" />,
  },
  {
    id: "PM",
    label: "PM",
    description: "Project Management",
    enabled: true,
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: "SD",
    label: "SD",
    description: "Service Desk",
    enabled: true,
    icon: <Shield className="h-4 w-4" />,
  },
  {
    id: "GMA",
    label: "GMA",
    description: "Global Market Access",
    enabled: true,
    icon: <Zap className="h-4 w-4" />,
  },
]

const initialQuickActions: QuickAction[] = [
  { id: "1", command: "/report draft", description: "Create a draft report" },
  { id: "2", command: "/create task", description: "Create a new task" },
  { id: "3", command: "/send update", description: "Send status update" },
]

const connectorOptions = [
  { value: "graph", label: "Microsoft Graph", icon: <Database className="h-4 w-4" />, logo: "/logos/graph.svg" },
  { value: "teams", label: "Microsoft Teams", icon: <Plug className="h-4 w-4" />, logo: "/logos/teams.svg" },
  { value: "smtp", label: "SMTP Email", icon: <Mail className="h-4 w-4" />, logo: undefined },
  { value: "sharepoint", label: "SharePoint", icon: <LayoutGrid className="h-4 w-4" />, logo: "/logos/sharepoint.svg" },
  { value: "feishu", label: "Feishu", icon: <Zap className="h-4 w-4" />, logo: "/logos/feishu.svg" },
  { value: "wework", label: "WeCom", icon: <Shield className="h-4 w-4" />, logo: "/logos/wework.svg" },
]

const aiProviderOptions = [
  { value: "openai", label: "OpenAI", logo: "/logos/openai.svg" },
  { value: "azure-openai", label: "Azure OpenAI", logo: "/logos/azure-openai.svg" },
  { value: "anthropic", label: "Anthropic", logo: "/logos/anthropic.svg" },
  { value: "google-gemini", label: "Google Gemini", logo: "/logos/gemini.svg" },
  { value: "deepseek", label: "DeepSeek", logo: "/logos/deepseek.svg" },
]

const smtpProviderOptions = [
  { value: "microsoft365", label: "Microsoft 365", host: "smtp.office365.com", port: "587", secure: false },
  { value: "outlook", label: "Outlook.com", host: "smtp-mail.outlook.com", port: "587", secure: false },
  { value: "gmail", label: "Gmail", host: "smtp.gmail.com", port: "587", secure: false },
  { value: "yahoo", label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: "465", secure: true },
  { value: "qq", label: "QQ Mail", host: "smtp.qq.com", port: "465", secure: true },
  { value: "163", label: "163 Mail", host: "smtp.163.com", port: "465", secure: true },
  { value: "custom", label: "Custom SMTP", host: "", port: "587", secure: false },
]

const adminConnectors = ["graph", "teams", "smtp", "sharepoint", "feishu", "wework"] as const
const userConnectors = ["graph", "teams", "smtp", "feishu", "wework"] as const
const approvalEntities = [
  "legal-entity",
  "delivery-org", "delivery-office", "delivery-team",
  "sales-org", "sales-office", "sales-team",
  "purchase-org", "purchase-office", "purchase-team",
  "division", "cost-center", "credit-area",
  "country", "currency", "exchange-rate",
  "service-item", "regulation", "standard", "activity", "service-bom", "price-list",
]
const approvalActions = ["create", "update", "delete", "mass-update"] as const

type FormValue = string | boolean
type ConnectorForm = Record<string, FormValue>

const connectorTemplates: Record<string, ConnectorForm> = {
  graph: { enabled: true, tenantId: "", clientId: "", clientSecret: "", scopes: "User.Read Mail.Read", mailbox: "", aiProvider: "", aiUrl: "", aiToken: "", aiModel: "" },
  teams: { enabled: true, webhookUrl: "", signingSecret: "", defaultChannel: "General", notifyMention: false, aiProvider: "", aiUrl: "", aiToken: "", aiModel: "" },
  smtp: {
    enabled: true,
    smtpProvider: "microsoft365",
    host: "",
    port: "587",
    secure: false,
    username: "",
    password: "",
    fromEmail: "",
    replyTo: "",
    aiProvider: "",
    aiUrl: "",
    aiToken: "",
    aiModel: "",
  },
  sharepoint: { enabled: true, siteUrl: "", driveId: "", clientId: "", clientSecret: "", aiProvider: "", aiUrl: "", aiToken: "", aiModel: "" },
  feishu: { enabled: true, appId: "", appSecret: "", webhookUrl: "", defaultChat: "", aiProvider: "", aiUrl: "", aiToken: "", aiModel: "" },
  wework: { enabled: true, corpId: "", agentId: "", agentSecret: "", defaultDept: "", aiProvider: "", aiUrl: "", aiToken: "", aiModel: "" },
}

const secretFieldNames = ["clientSecret", "signingSecret", "appSecret", "agentSecret", "aiToken", "password"]

function toStringOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function toBooleanOrFallback(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function materializeForm(connector: string, setting: unknown): ConnectorForm {
  const template = connectorTemplates[connector] ?? { enabled: true }
  const src = typeof setting === "object" && setting !== null ? (setting as Record<string, unknown>) : {}
  const form: ConnectorForm = {}
  for (const [k, v] of Object.entries(template)) {
    form[k] = typeof v === "boolean" ? toBooleanOrFallback(src[k], v) : toStringOrFallback(src[k], v)
  }
  return form
}

function validateConnectorForm(connector: string, form: ConnectorForm): string[] {
  const errors: string[] = []
  const required: Record<string, string[]> = {
    graph: ["tenantId", "clientId", "clientSecret", "aiProvider", "aiUrl", "aiToken", "aiModel"],
    teams: ["webhookUrl", "aiProvider", "aiUrl", "aiToken", "aiModel"],
    smtp: ["host", "port", "username", "password", "fromEmail", "aiProvider", "aiUrl", "aiToken", "aiModel"],
    sharepoint: ["siteUrl", "clientId", "clientSecret", "aiProvider", "aiUrl", "aiToken", "aiModel"],
    feishu: ["webhookUrl", "aiProvider", "aiUrl", "aiToken", "aiModel"],
    wework: ["corpId", "agentId", "agentSecret", "aiProvider", "aiUrl", "aiToken", "aiModel"],
  }
  const reqFields = required[connector] ?? []
  for (const f of reqFields) {
    if (!String(form[f] ?? "").trim()) errors.push(`${f} is required`)
  }
  const urlFields = ["webhookUrl", "siteUrl", "aiUrl"]
  for (const field of urlFields) {
    const value = String(form[field] ?? "").trim()
    if (!value) continue
    try {
      // eslint-disable-next-line no-new
      new URL(value)
    } catch {
      errors.push(`${field} must be a valid URL`)
    }
  }
  if (connector === "smtp") {
    const port = Number(form.port ?? "")
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push("port must be an integer between 1 and 65535")
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const from = String(form.fromEmail ?? "").trim()
    if (from && !emailRegex.test(from)) errors.push("fromEmail must be a valid email address")
    const replyTo = String(form.replyTo ?? "").trim()
    if (replyTo && !emailRegex.test(replyTo)) errors.push("replyTo must be a valid email address")
  }
  return errors
}

export function ConfigurationCenter({
  onBack,
}: {
  onBack?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolveTab = (): string => {
    const allowed = new Set(["connectors", "dashboard", "output", "ai", "ops"])
    const fromSearch = searchParams.get("tab")
    if (fromSearch && allowed.has(fromSearch)) return fromSearch
    if (typeof window !== "undefined") {
      const fromLocation = new URLSearchParams(window.location.search).get("tab")
      if (fromLocation && allowed.has(fromLocation)) return fromLocation
    }
    return "dashboard"
  }
  const [widgets, setWidgets] = useState<Widget[]>(initialWidgets)
  const [modules, setModules] = useState<Module[]>(initialModules)
  const [quickActions, setQuickActions] = useState<QuickAction[]>(initialQuickActions)
  const [accessRole, setAccessRole] = useState<"admin" | "user">("admin")
  const [adminConnector, setAdminConnector] = useState("graph")
  const [userConnector, setUserConnector] = useState("teams")
  const [adminConfigForm, setAdminConfigForm] = useState<ConnectorForm>(materializeForm("graph", {}))
  const [userConfigForm, setUserConfigForm] = useState<ConnectorForm>(materializeForm("teams", {}))
  const [showAdminSecrets, setShowAdminSecrets] = useState(false)
  const [showUserSecrets, setShowUserSecrets] = useState(false)
  const [adminValidationErrors, setAdminValidationErrors] = useState<string[]>([])
  const [userValidationErrors, setUserValidationErrors] = useState<string[]>([])
  const [adminTestStatus, setAdminTestStatus] = useState("idle")
  const [userTestStatus, setUserTestStatus] = useState("idle")
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState(resolveTab)
  const [newAction, setNewAction] = useState("")
  const [saveStatus, setSaveStatus] = useState("idle")
  const [adminAiProviders, setAdminAiProviders] = useState<AiProviderConfig[]>([
    { id: "ai-1", provider: "openai", aiUrl: "", aiToken: "", aiModel: "" },
  ])
  const [aiDefaultProvider, setAiDefaultProvider] = useState("openai")
  const [aiFallbackOrder, setAiFallbackOrder] = useState("anthropic")
  const [showAiSecrets, setShowAiSecrets] = useState(false)
  const [aiSaveStatus, setAiSaveStatus] = useState("idle")
  const [notifScope, setNotifScope] = useState<"user" | "tenant">("tenant")
  const [notifProvider, setNotifProvider] = useState<"all" | "teams" | "lark" | "wecom">("all")
  const [notifStatus, setNotifStatus] = useState<"all" | "ok" | "failed">("all")
  const [notifSinceHours, setNotifSinceHours] = useState("24")
  const [notifRows, setNotifRows] = useState<NotificationAuditRow[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSummary, setNotifSummary] = useState<NotificationAuditSummary>({
    total: 0,
    success: 0,
    failed: 0,
    byProvider: {},
  })
  const [opsCircuits, setOpsCircuits] = useState<Record<string, OpsCircuitRow>>({})
  const [opsDlqRows, setOpsDlqRows] = useState<OpsDlqRow[]>([])
  const [opsLoading, setOpsLoading] = useState(false)
  const [workflowRuntime, setWorkflowRuntime] = useState<WorkflowRuntimeConfig>({
    teamsWebhookUrl: "",
    larkWebhookUrl: "",
    wecomWebhookUrl: "",
    mailTo: "",
    smtpHost: "",
    smtpPort: "1025",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
  })
  const [workflowRuntimeSaveStatus, setWorkflowRuntimeSaveStatus] = useState("idle")
  const [workflowRuntimeTestStatus, setWorkflowRuntimeTestStatus] = useState("idle")
  const [workflowRuntimeBatchStatus, setWorkflowRuntimeBatchStatus] = useState("idle")
  const [workflowRuntimeCopyStatus, setWorkflowRuntimeCopyStatus] = useState("idle")
  const [approvalPolicies, setApprovalPolicies] = useState<ApprovalPolicyRow[]>([])
  const [approvalPolicySaveStatus, setApprovalPolicySaveStatus] = useState("idle")
  const [approvalKpiSummary, setApprovalKpiSummary] = useState<ApprovalKpiSummary>({
    total: 0, pending: 0, overdue: 0, escalated: 0, avgApprovalSec: 0, avgExecutionSec: 0,
  })
  const [approvalKpiTrend, setApprovalKpiTrend] = useState<ApprovalKpiTrendRow[]>([])
  const [digestConfig, setDigestConfig] = useState<DigestConfig>({
    enabled: false,
    time: "09:00",
    timezone: "Europe/Berlin",
    recipients: "",
    channels: "mail",
  })
  const [digestSaveStatus, setDigestSaveStatus] = useState("idle")
  const [digestTestStatus, setDigestTestStatus] = useState("idle")
  const [opsThresholds, setOpsThresholds] = useState<OpsThresholds>({
    overdueWarnCount: 5,
    escalatedWarnCount: 3,
    dlqWarnCount: 10,
    circuitFailureWarnCount: 5,
  })
  const [opsThresholdStatus, setOpsThresholdStatus] = useState("idle")
  const [digestPreview, setDigestPreview] = useState<DigestPreviewPayload | null>(null)
  const [digestPreviewStatus, setDigestPreviewStatus] = useState("idle")
  const [dlqBatchStatus, setDlqBatchStatus] = useState("idle")
  const [workerConfig, setWorkerConfig] = useState<EscalationWorkerConfig>({
    enabled: true,
    pollSeconds: 60,
    reminderBeforeHoursT4: 4,
    reminderBeforeHoursT1: 1,
    escalationReminderMinutes: 60,
    lastRunAt: null,
    lastError: null,
    lastSummary: null,
  })
  const [workerConfigStatus, setWorkerConfigStatus] = useState("idle")
  const [readinessStatus, setReadinessStatus] = useState("idle")
  const [readinessRows, setReadinessRows] = useState<ReadinessCheckItem[]>([])
  const [readinessCheckedAt, setReadinessCheckedAt] = useState("")

  const [loadedWidgets, setLoadedWidgets] = useState<Widget[]>(initialWidgets)
  const [loadedModules, setLoadedModules] = useState<Module[]>(initialModules)
  const [loadedQuickActions, setLoadedQuickActions] = useState<QuickAction[]>(initialQuickActions)
  const [loadedAdminConfigForm, setLoadedAdminConfigForm] = useState<ConnectorForm>(materializeForm("graph", {}))
  const [loadedUserConfigForm, setLoadedUserConfigForm] = useState<ConnectorForm>(materializeForm("teams", {}))
  const [loadedAdminAiProviders, setLoadedAdminAiProviders] = useState<AiProviderConfig[]>([
    { id: "ai-1", provider: "openai", aiUrl: "", aiToken: "", aiModel: "" },
  ])
  const [loadedAiDefaultProvider, setLoadedAiDefaultProvider] = useState("openai")
  const [loadedAiFallbackOrder, setLoadedAiFallbackOrder] = useState("anthropic")
  const [apiOutput, setApiOutput] = useState<ApiOutput>({
    ok: true,
    userId: "demo-user",
    timestamp: new Date().toISOString(),
    widgets: widgets.filter((w) => w.enabled).map((w) => w.id),
    modules: modules.filter((m) => m.enabled).map((m) => m.id),
    quickActions: quickActions.map((a) => a.command),
    connectors: {
      admin: { type: adminConnector, config: { enabled: true } },
      user: { type: userConnector, config: { defaultChannel: "General" } },
    },
  })

  function refreshOutput(next?: Partial<ApiOutput>): void {
    setApiOutput({
      ok: true,
      userId: "demo-user",
      timestamp: new Date().toISOString(),
      widgets: widgets.filter((w) => w.enabled).map((w) => w.id),
      modules: modules.filter((m) => m.enabled).map((m) => m.id),
      quickActions: quickActions.map((a) => a.command),
      connectors: {
        admin: { type: adminConnector, config: adminConfigForm as Record<string, unknown> },
        user: { type: userConnector, config: userConfigForm as Record<string, unknown> },
      },
      ...(next ?? {}),
    })
  }

  useEffect(() => {
    void loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setActiveTab(resolveTab())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get("tab") !== activeTab) {
      params.set("tab", activeTab)
      router.replace(`/config?${params.toString()}`)
    }
  }, [activeTab, router, searchParams])

  useEffect(() => {
    if (activeTab === "output") {
      void loadNotificationAudit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, notifScope, notifProvider, notifStatus, notifSinceHours])

  useEffect(() => {
    if (activeTab === "ops") {
      void loadOpsData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    void loadAdmin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminConnector])

  useEffect(() => {
    void loadUser()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userConnector])

  async function loadAll(): Promise<void> {
    await Promise.all([loadDashboard(), loadAdmin(), loadUser(), loadAiProviders()])
    refreshOutput()
  }

  async function loadNotificationAudit(): Promise<void> {
    setNotifLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("scope", notifScope)
      params.set("limit", "200")
      if (notifProvider !== "all") params.set("provider", notifProvider)
      if (notifStatus === "ok") params.set("ok", "true")
      if (notifStatus === "failed") params.set("ok", "false")
      const hours = Number.parseInt(notifSinceHours, 10)
      if (Number.isFinite(hours) && hours > 0) params.set("sinceHours", String(hours))
      const data = (await api(`/api/v1/notification-logs?${params.toString()}`)) as {
        ok?: boolean
        items?: NotificationAuditRow[]
      }
      if (data.ok && Array.isArray(data.items)) {
        setNotifRows(data.items)
      }
      const sum = (await api(`/api/v1/notification-logs/summary?scope=${notifScope}&sinceHours=${encodeURIComponent(notifSinceHours || "24")}`)) as {
        ok?: boolean
        summary?: NotificationAuditSummary
      }
      if (sum.ok && sum.summary) {
        setNotifSummary(sum.summary)
      }
    } finally {
      setNotifLoading(false)
    }
  }

  function exportNotificationCsv(): void {
    const headers = ["createdAt", "userId", "action", "ok", "provider", "detail", "correlationId"]
    const rows = notifRows.map((r) => [
      r.createdAt,
      r.userId,
      r.action,
      String(r.ok),
      r.provider ?? "",
      r.detail,
      r.correlationId ?? "",
    ])
    const csv = [
      headers.join(","),
      ...rows.map((cols) => cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `notification-audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function openAuditByCorrelation(correlationId?: string): void {
    if (!correlationId) return
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hermes.audit.open.correlationId", correlationId)
      window.location.href = "/"
    }
  }

  async function loadOpsData(): Promise<void> {
    setOpsLoading(true)
    try {
      const [circuits, dlq] = await Promise.all([
        api("/api/v1/ops/delivery/circuits"),
        api("/api/v1/ops/delivery/dlq?limit=100"),
      ])
      const c = circuits as { ok?: boolean; circuits?: Record<string, OpsCircuitRow> }
      if (c.ok && c.circuits) setOpsCircuits(c.circuits)
      const q = dlq as { ok?: boolean; items?: OpsDlqRow[] }
      if (q.ok && Array.isArray(q.items)) setOpsDlqRows(q.items)
      const rc = await api("/api/v1/mdm-workflow/runtime-config")
      const runtime = rc as { ok?: boolean; item?: Partial<WorkflowRuntimeConfig> }
      if (runtime.ok && runtime.item) {
        const item = runtime.item
        setWorkflowRuntime((prev) => ({
          ...prev,
          ...item,
          smtpPort: String(item.smtpPort ?? prev.smtpPort),
        }))
      }
      const kpis = await api("/api/v1/mdm-workflow/approval-kpis?days=7") as { ok?: boolean; summary?: ApprovalKpiSummary; trend?: ApprovalKpiTrendRow[] }
      if (kpis.ok && kpis.summary) setApprovalKpiSummary(kpis.summary)
      if (kpis.ok && Array.isArray(kpis.trend)) setApprovalKpiTrend(kpis.trend)
      const pol = await api("/api/v1/mdm-workflow/approval-policies") as { ok?: boolean; items?: ApprovalPolicyRow[] }
      if (pol.ok && Array.isArray(pol.items)) setApprovalPolicies(pol.items)
      const dig = await api("/api/v1/mdm-workflow/digest-config") as { ok?: boolean; item?: Partial<DigestConfig> }
      if (dig.ok && dig.item) setDigestConfig((prev) => ({ ...prev, ...dig.item }))
      const th = await api("/api/v1/mdm-workflow/ops-thresholds") as { ok?: boolean; item?: Partial<OpsThresholds> }
      if (th.ok && th.item) setOpsThresholds((prev) => ({ ...prev, ...th.item }))
      const wk = await api("/api/v1/mdm-workflow/escalation-worker") as { ok?: boolean; item?: Partial<EscalationWorkerConfig> }
      if (wk.ok && wk.item) setWorkerConfig((prev) => ({ ...prev, ...wk.item }))
      const dp = await api("/api/v1/mdm-workflow/digest/preview?days=7") as { ok?: boolean; item?: DigestPreviewPayload }
      if (dp.ok && dp.item) setDigestPreview(dp.item)
    } finally {
      setOpsLoading(false)
    }
  }

  function upsertPolicyCell(entityKey: string, actionType: string, patch: Partial<ApprovalPolicyRow>): void {
    setApprovalPolicies((prev) => {
      const idx = prev.findIndex((p) => p.entity_key === entityKey && p.action_type === actionType)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...patch }
        return next
      }
      return [...prev, {
        entity_key: entityKey,
        action_type: actionType,
        enabled: true,
        auto_route_to: "mdm-admin",
        sla_hours: 24,
        escalate_to: "mdm-lead",
        notify_channels: ["teams", "mail"],
        ...patch,
      }]
    })
  }

  function getPolicyCell(entityKey: string, actionType: string): ApprovalPolicyRow {
    const found = approvalPolicies.find((p) => p.entity_key === entityKey && p.action_type === actionType)
    return found ?? {
      entity_key: entityKey,
      action_type: actionType,
      enabled: true,
      auto_route_to: "mdm-admin",
      sla_hours: 24,
      escalate_to: "mdm-lead",
      notify_channels: ["teams", "mail"],
    }
  }

  async function saveApprovalPolicies(): Promise<void> {
    setApprovalPolicySaveStatus("saving")
    try {
      for (const entityKey of approvalEntities) {
        for (const actionType of approvalActions) {
          const p = getPolicyCell(entityKey, actionType)
          const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approval-policies/${encodeURIComponent(entityKey)}/${encodeURIComponent(actionType)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-role": "admin" },
            body: JSON.stringify({
              role: "admin",
              updated_by: "admin-user",
              enabled: p.enabled,
              auto_route_to: p.auto_route_to ?? "",
              sla_hours: Math.max(1, Number(p.sla_hours || 24)),
              escalate_to: p.escalate_to ?? "",
              notify_channels: p.notify_channels,
            }),
          })
          if (!resp.ok) throw new Error(`save failed for ${entityKey}/${actionType}`)
        }
      }
      setApprovalPolicySaveStatus("saved")
      setTimeout(() => setApprovalPolicySaveStatus("idle"), 1500)
      await loadOpsData()
    } catch {
      setApprovalPolicySaveStatus("failed")
      setTimeout(() => setApprovalPolicySaveStatus("idle"), 2500)
    }
  }

  async function saveDigestConfig(): Promise<void> {
    setDigestSaveStatus("saving")
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/digest-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-role": "admin" },
        body: JSON.stringify({ ...digestConfig, role: "admin", updated_by: "admin-user" }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.detail ?? "save failed")
      setDigestSaveStatus("saved")
      setTimeout(() => setDigestSaveStatus("idle"), 1200)
    } catch {
      setDigestSaveStatus("failed")
      setTimeout(() => setDigestSaveStatus("idle"), 2200)
    }
  }

  async function testDigestConfig(): Promise<void> {
    setDigestTestStatus("testing")
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/digest/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-role": "admin" },
        body: JSON.stringify({ role: "admin" }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.detail ?? "test failed")
      setDigestTestStatus("ok")
      setTimeout(() => setDigestTestStatus("idle"), 1400)
    } catch {
      setDigestTestStatus("failed")
      setTimeout(() => setDigestTestStatus("idle"), 2200)
    }
  }

  async function loadDigestPreview(): Promise<void> {
    setDigestPreviewStatus("loading")
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/digest/preview?days=7")
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.detail ?? "preview failed")
      setDigestPreview(data.item as DigestPreviewPayload)
      setDigestPreviewStatus("ok")
      setTimeout(() => setDigestPreviewStatus("idle"), 1200)
    } catch {
      setDigestPreviewStatus("failed")
      setTimeout(() => setDigestPreviewStatus("idle"), 2000)
    }
  }

  async function saveOpsThresholds(): Promise<void> {
    setOpsThresholdStatus("saving")
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/ops-thresholds", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-role": "admin" },
        body: JSON.stringify({ ...opsThresholds, role: "admin", updated_by: "admin-user" }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.detail ?? "save failed")
      setOpsThresholdStatus("saved")
      setTimeout(() => setOpsThresholdStatus("idle"), 1400)
    } catch {
      setOpsThresholdStatus("failed")
      setTimeout(() => setOpsThresholdStatus("idle"), 2200)
    }
  }

  function exportOpsReportCsv(): void {
    const now = new Date().toISOString()
    const rows: Array<Record<string, string | number>> = []
    rows.push({
      section: "kpi-summary",
      key: "totals",
      total: approvalKpiSummary.total,
      pending: approvalKpiSummary.pending,
      overdue: approvalKpiSummary.overdue,
      escalated: approvalKpiSummary.escalated,
      avgApprovalSec: Math.round(approvalKpiSummary.avgApprovalSec),
      avgExecutionSec: Math.round(approvalKpiSummary.avgExecutionSec),
      exportedAt: now,
    })
    for (const t of approvalKpiTrend) rows.push({ section: "kpi-trend", day: t.day, total: t.total, pending: t.pending, overdue: t.overdue })
    for (const p of ["teams", "lark", "wecom"] as const) {
      const c = opsCircuits[p]
      rows.push({ section: "delivery-circuit", provider: p, failures: c?.failures ?? 0, open: c?.open ? "open" : "closed", openUntilMs: c?.openUntilMs ?? 0 })
    }
    for (const d of opsDlqRows) rows.push({ section: "delivery-dlq", provider: d.provider, attempts: d.attempts, reason: d.reason, correlationId: d.correlationId, createdAt: d.createdAt })
    const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
    const esc = (v: unknown) => {
      const s = String(v ?? "")
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g, "\"\"")}"`
      return s
    }
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc((r as Record<string, unknown>)[h])).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ops-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function saveWorkflowRuntime(): Promise<void> {
    setWorkflowRuntimeSaveStatus("saving")
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/runtime-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-role": "admin" },
        body: JSON.stringify({ ...workflowRuntime, role: "admin", updated_by: "admin-user" }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.detail ?? "Save failed")
      setWorkflowRuntimeSaveStatus("saved")
      setTimeout(() => setWorkflowRuntimeSaveStatus("idle"), 1200)
    } catch (error) {
      setWorkflowRuntimeSaveStatus("failed")
      setTimeout(() => setWorkflowRuntimeSaveStatus("idle"), 2200)
    }
  }

  async function testWorkflowRuntime(provider: "teams" | "lark" | "wecom" | "mail"): Promise<void> {
    setWorkflowRuntimeTestStatus(`testing:${provider}`)
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/runtime-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-role": "admin" },
        body: JSON.stringify({
          provider,
          role: "admin",
          text: `[ConfigCenter Test] provider=${provider} ts=${new Date().toISOString()}`,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.detail ?? "Test failed")
      setWorkflowRuntimeTestStatus(`ok:${provider}`)
      setTimeout(() => setWorkflowRuntimeTestStatus("idle"), 1500)
    } catch {
      setWorkflowRuntimeTestStatus(`failed:${provider}`)
      setTimeout(() => setWorkflowRuntimeTestStatus("idle"), 2200)
    }
  }

  function buildRuntimeTestCurl(provider: "teams" | "lark" | "wecom" | "mail"): string {
    return [
      "curl -X POST http://localhost:18089/api/v1/mdm-workflow/runtime-config/test \\",
      "  -H \"Content-Type: application/json\" \\",
      "  -H \"x-role: admin\" \\",
      `  -d '{\"provider\":\"${provider}\",\"role\":\"admin\",\"text\":\"[ConfigCenter Test] provider=${provider}\"}'`,
    ].join("\n")
  }

  async function copyRuntimeTestCurl(provider: "teams" | "lark" | "wecom" | "mail"): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(buildRuntimeTestCurl(provider))
      }
      setWorkflowRuntimeCopyStatus(`copied:${provider}`)
      setTimeout(() => setWorkflowRuntimeCopyStatus("idle"), 1200)
    } catch {
      setWorkflowRuntimeCopyStatus(`failed:${provider}`)
      setTimeout(() => setWorkflowRuntimeCopyStatus("idle"), 1800)
    }
  }

  async function testAllConfiguredRuntime(): Promise<void> {
    const providers: Array<"teams" | "lark" | "wecom" | "mail"> = []
    if (workflowRuntime.teamsWebhookUrl) providers.push("teams")
    if (workflowRuntime.larkWebhookUrl) providers.push("lark")
    if (workflowRuntime.wecomWebhookUrl) providers.push("wecom")
    if (workflowRuntime.mailTo && workflowRuntime.smtpHost && workflowRuntime.smtpFrom) providers.push("mail")
    if (providers.length === 0) {
      setWorkflowRuntimeBatchStatus("no-configured-channel")
      setTimeout(() => setWorkflowRuntimeBatchStatus("idle"), 1800)
      return
    }
    setWorkflowRuntimeBatchStatus(`testing:${providers.length}`)
    try {
      await Promise.all(providers.map((p) => testWorkflowRuntime(p)))
      setWorkflowRuntimeBatchStatus("completed")
      setTimeout(() => setWorkflowRuntimeBatchStatus("idle"), 1800)
    } catch {
      setWorkflowRuntimeBatchStatus("failed")
      setTimeout(() => setWorkflowRuntimeBatchStatus("idle"), 2200)
    }
  }

  async function replayDlq(id: string): Promise<void> {
    await api(`/api/v1/ops/delivery/dlq/${encodeURIComponent(id)}/replay`, {
      method: "POST",
    })
    await loadOpsData()
  }

  async function replayAllDlq(): Promise<void> {
    setDlqBatchStatus("replaying")
    try {
      const resp = await api("/api/v1/ops/delivery/dlq/replay-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      }) as { ok?: boolean; replayed?: number; success?: number; failed?: number }
      if (!resp.ok) throw new Error("replay-all failed")
      setDlqBatchStatus(`done:${resp.success ?? 0}/${resp.replayed ?? 0}`)
      setTimeout(() => setDlqBatchStatus("idle"), 1800)
      await loadOpsData()
    } catch {
      setDlqBatchStatus("failed")
      setTimeout(() => setDlqBatchStatus("idle"), 2200)
    }
  }

  async function saveWorkerConfig(): Promise<void> {
    setWorkerConfigStatus("saving")
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/escalation-worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-role": "admin" },
        body: JSON.stringify({ ...workerConfig, role: "admin", updated_by: "admin-user" }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error("save worker config failed")
      setWorkerConfigStatus("saved")
      setTimeout(() => setWorkerConfigStatus("idle"), 1400)
      await loadOpsData()
    } catch {
      setWorkerConfigStatus("failed")
      setTimeout(() => setWorkerConfigStatus("idle"), 2200)
    }
  }

  async function runWorkerOnce(): Promise<void> {
    setWorkerConfigStatus("running")
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/escalation-worker/run-once", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-role": "admin" },
        body: JSON.stringify({ role: "admin" }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error("run worker once failed")
      setWorkerConfigStatus("ran")
      setTimeout(() => setWorkerConfigStatus("idle"), 1400)
      await loadOpsData()
    } catch {
      setWorkerConfigStatus("failed")
      setTimeout(() => setWorkerConfigStatus("idle"), 2200)
    }
  }

  async function runReadinessCheck(): Promise<void> {
    setReadinessStatus("running")
    try {
      const resp = await api("/api/v1/ops/readiness-check") as {
        ok?: boolean
        checkedAt?: string
        checks?: ReadinessCheckItem[]
      }
      if (!resp.ok) throw new Error("readiness check failed")
      setReadinessRows(Array.isArray(resp.checks) ? resp.checks : [])
      setReadinessCheckedAt(String(resp.checkedAt ?? ""))
      setReadinessStatus("done")
    } catch {
      setReadinessRows([])
      setReadinessStatus("failed")
    }
  }

  async function loadDashboard(): Promise<void> {
    const data = (await api("/api/v1/dashboard/preferences")) as { widgets?: string[]; modules?: string[]; quickActions?: string[] }
    if (Array.isArray(data.widgets)) {
      const next = initialWidgets.map((w) => ({ ...w, enabled: data.widgets?.includes(w.id) ?? false }))
      setWidgets(next)
      setLoadedWidgets(next)
    }
    if (Array.isArray(data.modules)) {
      const next = initialModules.map((m) => ({ ...m, enabled: data.modules?.includes(m.id) ?? false }))
      setModules(next)
      setLoadedModules(next)
    }
    if (Array.isArray(data.quickActions)) {
      const next = data.quickActions.map((c, i) => ({ id: `api-${i}`, command: c, description: "Configured action" }))
      setQuickActions(next)
      setLoadedQuickActions(next)
    }
  }

  async function saveDashboard(): Promise<void> {
    const body = {
      widgets: widgets.filter((w) => w.enabled).map((w) => w.id),
      modules: modules.filter((m) => m.enabled).map((m) => m.id),
      quickActions: quickActions.map((a) => a.command),
    }
    const data = await api("/api/v1/dashboard/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    refreshOutput({ ok: true, timestamp: new Date().toISOString(), widgets: body.widgets, modules: body.modules, quickActions: body.quickActions })
    void data
  }

  async function loadAdmin(): Promise<void> {
    const data = (await api(`/api/v1/connectors/admin/${encodeURIComponent(adminConnector)}`)) as { setting?: unknown }
    const next = materializeForm(adminConnector, data.setting ?? {})
    setAdminConfigForm(next)
    setLoadedAdminConfigForm(next)
    setAdminValidationErrors([])
  }

  async function saveAdmin(): Promise<void> {
    const errors = validateConnectorForm(adminConnector, adminConfigForm)
    setAdminValidationErrors(errors)
    if (errors.length > 0) return
    const data = await api(`/api/v1/connectors/admin/${encodeURIComponent(adminConnector)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminConfigForm),
    })
    refreshOutput({ timestamp: new Date().toISOString() })
    void data
  }

  async function loadUser(): Promise<void> {
    const data = (await api(`/api/v1/connectors/user/${encodeURIComponent(userConnector)}`)) as { setting?: unknown }
    const next = materializeForm(userConnector, data.setting ?? {})
    setUserConfigForm(next)
    setLoadedUserConfigForm(next)
    setUserValidationErrors([])
  }

  async function saveUser(): Promise<void> {
    const errors = validateConnectorForm(userConnector, userConfigForm)
    setUserValidationErrors(errors)
    if (errors.length > 0) return
    const data = await api(`/api/v1/connectors/user/${encodeURIComponent(userConnector)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userConfigForm),
    })
    refreshOutput({ timestamp: new Date().toISOString() })
    void data
  }

  async function loadAiProviders(): Promise<void> {
    const data = (await api("/api/v1/ai/providers")) as AiProvidersApiPayload
    const rows = Array.isArray(data.providers) ? data.providers : []
    if (rows.length === 0) {
      const defaults = [{ id: "ai-1", provider: "openai", aiUrl: "", aiToken: "", aiModel: "" }]
      setAdminAiProviders(defaults)
      setLoadedAdminAiProviders(defaults)
      setAiDefaultProvider("openai")
      setLoadedAiDefaultProvider("openai")
      setAiFallbackOrder("anthropic")
      setLoadedAiFallbackOrder("anthropic")
      return
    }
    const mapped = rows.map((p, i) => ({
      id: `ai-${i + 1}`,
      provider: String(p.provider ?? "openai"),
      aiUrl: String(p.aiUrl ?? ""),
      aiToken: String(p.aiToken ?? ""),
      aiModel: String(p.aiModel ?? ""),
    }))
    setAdminAiProviders(mapped)
    setLoadedAdminAiProviders(mapped)
    setAiDefaultProvider(String(data.defaultProvider ?? mapped[0]?.provider ?? "openai"))
    setLoadedAiDefaultProvider(String(data.defaultProvider ?? mapped[0]?.provider ?? "openai"))
    const fallback = Array.isArray(data.fallbackOrder) ? data.fallbackOrder.join(",") : ""
    setAiFallbackOrder(fallback)
    setLoadedAiFallbackOrder(fallback)
  }

  async function saveAiProviders(): Promise<void> {
    setAiSaveStatus("saving")
    const payload: AiProvidersApiPayload = {
      defaultProvider: aiDefaultProvider.trim(),
      fallbackOrder: aiFallbackOrder.split(",").map((v) => v.trim()).filter(Boolean),
      providers: adminAiProviders.map((p) => ({
        provider: p.provider.trim(),
        aiUrl: p.aiUrl.trim(),
        aiToken: p.aiToken,
        aiModel: p.aiModel.trim(),
        enabled: true,
      })),
    }
    const data = await api("/api/v1/ai/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    void data
    await loadAiProviders()
    setAiSaveStatus("saved")
    setTimeout(() => setAiSaveStatus("idle"), 2000)
  }

  async function saveAllChanges(): Promise<void> {
    setSaveStatus("saving")
    try {
      if (accessRole === "admin") {
        await Promise.all([saveDashboard(), saveAdmin(), saveUser(), saveAiProviders()])
      } else {
        await Promise.all([saveDashboard(), saveUser()])
      }
      await loadAll()
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch {
      setSaveStatus("error")
    }
  }

  function resetToLoaded(): void {
    setWidgets(loadedWidgets)
    setModules(loadedModules)
    setQuickActions(loadedQuickActions)
    setAdminConfigForm(loadedAdminConfigForm)
    setUserConfigForm(loadedUserConfigForm)
    setAdminAiProviders(loadedAdminAiProviders)
    setAiDefaultProvider(loadedAiDefaultProvider)
    setAiFallbackOrder(loadedAiFallbackOrder)
    refreshOutput()
    setSaveStatus("reset")
    setTimeout(() => setSaveStatus("idle"), 1500)
  }

  const toggleWidget = (id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    )
  }

  const toggleModule = (id: string) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    )
  }

  const removeQuickAction = (id: string) => {
    setQuickActions((prev) => prev.filter((a) => a.id !== id))
  }

  const addQuickAction = () => {
    if (newAction.trim()) {
      setQuickActions((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          command: newAction.startsWith("/") ? newAction : `/${newAction}`,
          description: "Custom action",
        },
      ])
      setNewAction("")
    }
  }

  const copyOutput = () => {
    navigator.clipboard.writeText(JSON.stringify(apiOutput, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function testConnector(scope: "admin" | "user"): Promise<void> {
    if (scope === "admin") {
      const errors = validateConnectorForm(adminConnector, adminConfigForm)
      setAdminValidationErrors(errors)
      if (errors.length > 0) {
        setAdminTestStatus("invalid")
        return
      }
      setAdminTestStatus("testing")
      await new Promise((resolve) => setTimeout(resolve, 700))
      setAdminTestStatus("ok")
      setTimeout(() => setAdminTestStatus("idle"), 1500)
      return
    }
    const errors = validateConnectorForm(userConnector, userConfigForm)
    setUserValidationErrors(errors)
    if (errors.length > 0) {
      setUserTestStatus("invalid")
      return
    }
    setUserTestStatus("testing")
    await new Promise((resolve) => setTimeout(resolve, 700))
    setUserTestStatus("ok")
    setTimeout(() => setUserTestStatus("idle"), 1500)
  }

  function setFormValue(scope: "admin" | "user", key: string, value: FormValue): void {
    if (scope === "admin") {
      setAdminConfigForm((prev) => ({ ...prev, [key]: value }))
      return
    }
    setUserConfigForm((prev) => ({ ...prev, [key]: value }))
  }

  function applySmtpPreset(scope: "admin" | "user", provider: string): void {
    const preset = smtpProviderOptions.find((p) => p.value === provider)
    if (!preset) return
    const apply = (prev: ConnectorForm) => ({
      ...prev,
      smtpProvider: provider,
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
    })
    if (scope === "admin") {
      setAdminConfigForm((prev) => apply(prev))
      return
    }
    setUserConfigForm((prev) => apply(prev))
  }

  function updateAdminAiProvider(id: string, patch: Partial<AiProviderConfig>): void {
    setAdminAiProviders((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addAdminAiProvider(): void {
    setAdminAiProviders((prev) => [
      ...prev,
      { id: `ai-${Date.now()}`, provider: "openai", aiUrl: "", aiToken: "", aiModel: "" },
    ])
  }

  function removeAdminAiProvider(id: string): void {
    setAdminAiProviders((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)))
  }

  function applyAiSetupToAdminConnector(): void {
    if (adminAiProviders.length === 0) return
    const first = adminAiProviders[0]
    setAdminConfigForm((prev) => ({
      ...prev,
      aiProvider: first.provider,
      aiUrl: first.aiUrl,
      aiToken: first.aiToken,
      aiModel: first.aiModel,
      aiProviders: JSON.stringify(adminAiProviders),
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (onBack) {
                  onBack()
                } else {
                  router.push("/")
                }
              }}
              className="gap-2 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Settings className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground">Configuration Center</h1>
                <p className="text-[10px] text-muted-foreground">Customize your workspace · tab: {activeTab}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
              <Sparkles className="h-3 w-3" />
              Pro Plan
            </Badge>
            <Button variant="outline" size="sm" className="gap-2 transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50" onClick={resetToLoaded}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button size="sm" className="gap-2" onClick={() => void saveAllChanges()}>
              <Save className="h-3.5 w-3.5" />
              {saveStatus === "saving" ? "Saving..." : "Save Changes"}
            </Button>
            {saveStatus !== "idle" && (
              <Badge variant="outline" className="ml-1">
                {saveStatus}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="connectors" className="gap-2">
              <Plug className="h-4 w-4" />
              Connectors
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="h-4 w-4" />
              AI Setup
            </TabsTrigger>
            <TabsTrigger value="output" className="gap-2">
              <Terminal className="h-4 w-4" />
              API Output
            </TabsTrigger>
            <TabsTrigger value="ops" className="gap-2">
              <Shield className="h-4 w-4" />
              Ops
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Widgets Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <LayoutGrid className="h-4 w-4 text-primary" />
                        Dashboard Widgets
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Drag to reorder, toggle to enable/disable
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {widgets.filter((w) => w.enabled).length} active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {widgets.map((widget) => (
                      <div
                        key={widget.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 transition-colors",
                          widget.enabled ? "bg-transparent" : "bg-muted/20"
                        )}
                      >
                        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/50" />
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              widget.enabled ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {widget.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{widget.id}</p>
                        </div>
                        <button
                          onClick={() => toggleWidget(widget.id)}
                          className={cn(
                            "relative h-5 w-9 rounded-full transition-colors",
                            widget.enabled ? "bg-primary" : "bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                              widget.enabled && "translate-x-4"
                            )}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Modules Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Database className="h-4 w-4 text-primary" />
                        System Modules
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Enable or disable system modules
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {modules.filter((m) => m.enabled).length} active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {modules.map((module) => (
                      <button
                        key={module.id}
                        onClick={() => toggleModule(module.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                          module.enabled
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-muted/20 opacity-60"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-md",
                            module.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {module.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              module.enabled ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {module.label}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {module.description}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full",
                            module.enabled ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}
                        >
                          {module.enabled && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions Card */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="h-4 w-4 text-primary" />
                      Quick Actions
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Slash commands for quick access
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{quickActions.length} commands</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action) => (
                    <div
                      key={action.id}
                      className="group flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                    >
                      <code className="text-sm font-medium text-primary">{action.command}</code>
                      <span className="text-xs text-muted-foreground">{action.description}</span>
                      <button
                        onClick={() => removeQuickAction(action.id)}
                        className="ml-1 rounded p-0.5 opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newAction}
                      onChange={(e) => setNewAction(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addQuickAction()}
                      placeholder="Add command..."
                      className="h-9 w-32 rounded-lg border border-dashed border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <Button size="sm" variant="ghost" onClick={addQuickAction} className="h-9 w-9 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connectors Tab */}
          <TabsContent value="connectors" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Access Scope</CardTitle>
                <CardDescription>
                  Admin can manage enterprise-level connectors. User can only manage personal connector preferences.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button variant={accessRole === "admin" ? "default" : "outline"} size="sm" onClick={() => setAccessRole("admin")}>
                    Admin View
                  </Button>
                  <Button variant={accessRole === "user" ? "default" : "outline"} size="sm" onClick={() => setAccessRole("user")}>
                    User View
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Admin Connector */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Admin Connector</CardTitle>
                      <CardDescription>System-level integration settings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  {accessRole !== "admin" && (
                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                      Admin-only section. Switch to Admin View to edit enterprise connectors.
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Connector Type</label>
                    <Select value={adminConnector} onValueChange={setAdminConnector} disabled={accessRole !== "admin"}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {connectorOptions.filter((opt) => adminConnectors.includes(opt.value as (typeof adminConnectors)[number])).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <BrandMark label={opt.label} logo={opt.logo} icon={opt.icon} />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
                      <BrandMark
                        label={connectorOptions.find((c) => c.value === adminConnector)?.label ?? adminConnector}
                        logo={connectorOptions.find((c) => c.value === adminConnector)?.logo}
                        icon={connectorOptions.find((c) => c.value === adminConnector)?.icon ?? <Plug className="h-4 w-4" />}
                      />
                      <span>{connectorOptions.find((c) => c.value === adminConnector)?.label ?? adminConnector}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">Configuration Form</label>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs transition-colors hover:bg-primary/5 hover:text-primary" onClick={() => setShowAdminSecrets((v) => !v)} disabled={accessRole !== "admin"}>
                        {showAdminSecrets ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showAdminSecrets ? "Hide Secrets" : "Show Secrets"}
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      {Object.entries(adminConfigForm).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 items-center gap-2">
                          <label className="text-xs text-muted-foreground">{key}</label>
                          <div className="col-span-2">
                            {typeof value === "boolean" ? (
                              <Switch checked={value} onCheckedChange={(v) => setFormValue("admin", key, v)} disabled={accessRole !== "admin"} />
                            ) : key === "smtpProvider" ? (
                              <Select
                                value={String(value)}
                                onValueChange={(v) => applySmtpPreset("admin", v)}
                                disabled={accessRole !== "admin"}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select SMTP Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  {smtpProviderOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : key === "aiProvider" ? (
                              <Select
                                value={String(value)}
                                onValueChange={(v) => setFormValue("admin", key, v)}
                                disabled={accessRole !== "admin"}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select AI Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  {aiProviderOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      <div className="flex items-center gap-2">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={opt.logo} alt={opt.label} className="h-4 w-4 rounded-sm" />
                                        {opt.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={secretFieldNames.includes(key) && !showAdminSecrets ? "password" : "text"}
                                value={String(value)}
                                onChange={(e) => setFormValue("admin", key, e.target.value)}
                                disabled={accessRole !== "admin"}
                                placeholder={`Enter ${key}`}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      {adminValidationErrors.length > 0 && (
                        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                          {adminValidationErrors.join(" | ")}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Info className="h-3 w-3" />
                        Required fields validated before save/test.
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50" onClick={() => void loadAdmin()} disabled={accessRole !== "admin"}>
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      Load Default
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50" onClick={() => void testConnector("admin")} disabled={accessRole !== "admin"}>
                      Test Connection
                    </Button>
                    <Button size="sm" className="flex-1" onClick={() => void saveAdmin()} disabled={accessRole !== "admin"}>
                      <Save className="mr-2 h-3.5 w-3.5" />
                      Save Config
                    </Button>
                  </div>
                  {adminTestStatus !== "idle" && <Badge variant="outline">Admin test: {adminTestStatus}</Badge>}
                </CardContent>
              </Card>

              {/* User Connector */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                      <UserCircle className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <CardTitle className="text-base">User Connector</CardTitle>
                      <CardDescription>Personal workspace integrations</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Connector Type</label>
                    <Select value={userConnector} onValueChange={setUserConnector}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {connectorOptions.filter((opt) => userConnectors.includes(opt.value as (typeof userConnectors)[number])).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <BrandMark label={opt.label} logo={opt.logo} icon={opt.icon} />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
                      <BrandMark
                        label={connectorOptions.find((c) => c.value === userConnector)?.label ?? userConnector}
                        logo={connectorOptions.find((c) => c.value === userConnector)?.logo}
                        icon={connectorOptions.find((c) => c.value === userConnector)?.icon ?? <Plug className="h-4 w-4" />}
                      />
                      <span>{connectorOptions.find((c) => c.value === userConnector)?.label ?? userConnector}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">Configuration Form</label>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs transition-colors hover:bg-primary/5 hover:text-primary" onClick={() => setShowUserSecrets((v) => !v)}>
                        {showUserSecrets ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showUserSecrets ? "Hide Secrets" : "Show Secrets"}
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      {Object.entries(userConfigForm).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 items-center gap-2">
                          <label className="text-xs text-muted-foreground">{key}</label>
                          <div className="col-span-2">
                            {typeof value === "boolean" ? (
                              <Switch checked={value} onCheckedChange={(v) => setFormValue("user", key, v)} />
                            ) : key === "smtpProvider" ? (
                              <Select value={String(value)} onValueChange={(v) => applySmtpPreset("user", v)}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select SMTP Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  {smtpProviderOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : key === "aiProvider" ? (
                              <Select value={String(value)} onValueChange={(v) => setFormValue("user", key, v)}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select AI Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  {aiProviderOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      <div className="flex items-center gap-2">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={opt.logo} alt={opt.label} className="h-4 w-4 rounded-sm" />
                                        {opt.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={secretFieldNames.includes(key) && !showUserSecrets ? "password" : "text"}
                                value={String(value)}
                                onChange={(e) => setFormValue("user", key, e.target.value)}
                                placeholder={`Enter ${key}`}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      {userValidationErrors.length > 0 && (
                        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                          {userValidationErrors.join(" | ")}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Info className="h-3 w-3" />
                        User-level connector preferences are stored per user.
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50" onClick={() => void loadUser()}>
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      Load Default
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50" onClick={() => void testConnector("user")}>
                      Test Connection
                    </Button>
                    <Button size="sm" className="flex-1" onClick={() => void saveUser()}>
                      <Save className="mr-2 h-3.5 w-3.5" />
                      Save Config
                    </Button>
                  </div>
                  {userTestStatus !== "idle" && <Badge variant="outline">User test: {userTestStatus}</Badge>}
                </CardContent>
              </Card>
            </div>

            {/* Connection Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Connection Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { name: "Microsoft Graph", status: "connected", latency: "45ms" },
                    { name: "Teams Webhook", status: "connected", latency: "32ms" },
                    { name: "SharePoint API", status: "warning", latency: "120ms" },
                    { name: "Database", status: "connected", latency: "12ms" },
                  ].map((conn) => (
                    <div
                      key={conn.name}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          conn.status === "connected" && "bg-success",
                          conn.status === "warning" && "bg-warning",
                          conn.status === "error" && "bg-destructive"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{conn.name}</p>
                        <p className="text-xs text-muted-foreground">{conn.latency}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="text-base">Admin AI Setup</CardTitle>
                <CardDescription>Admin-only multi-provider AI configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Default Provider</label>
                    <Select value={aiDefaultProvider} onValueChange={setAiDefaultProvider}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {adminAiProviders.map((row) => (
                          <SelectItem key={`default-${row.id}`} value={row.provider}>
                            {row.provider}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Fallback Order (comma-separated)</label>
                    <Input
                      placeholder="anthropic,google-gemini"
                      value={aiFallbackOrder}
                      onChange={(e) => setAiFallbackOrder(e.target.value)}
                    />
                  </div>
                </div>
                {adminAiProviders.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Provider Row</span>
                      <Button variant="ghost" size="sm" onClick={() => removeAdminAiProvider(row.id)} disabled={adminAiProviders.length === 1}>
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Select value={row.provider} onValueChange={(v) => updateAdminAiProvider(row.id, { provider: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {aiProviderOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <BrandMark label={opt.label} logo={opt.logo} icon={<Bot className="h-4 w-4" />} forceLightBg />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="AI URL" value={row.aiUrl} onChange={(e) => updateAdminAiProvider(row.id, { aiUrl: e.target.value })} />
                      <Input type={showAiSecrets ? "text" : "password"} placeholder="AI Token" value={row.aiToken} onChange={(e) => updateAdminAiProvider(row.id, { aiToken: e.target.value })} />
                      <Input placeholder="AI Model" value={row.aiModel} onChange={(e) => updateAdminAiProvider(row.id, { aiModel: e.target.value })} />
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAiSecrets((v) => !v)} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">{showAiSecrets ? "Hide Tokens" : "Show Tokens"}</Button>
                  <Button variant="outline" onClick={addAdminAiProvider} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Add Provider</Button>
                  <Button onClick={applyAiSetupToAdminConnector}>Apply To Current Admin Connector</Button>
                  <Button variant="outline" onClick={() => void loadAiProviders()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Reload</Button>
                  <Button onClick={() => void saveAiProviders()}>{aiSaveStatus === "saving" ? "Saving..." : "Save AI Providers"}</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  User AI setup is disabled by policy. Runtime uses this admin provider list with default + fallback strategy.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Output Tab */}
          <TabsContent value="output">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Terminal className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">API Output Preview</CardTitle>
                      <CardDescription>
                        Live preview of your configuration as JSON
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-success border-success/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Valid JSON
                    </Badge>
                    <Button variant="outline" size="sm" onClick={copyOutput} className="gap-2 transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative">
                  <pre className="max-h-[500px] overflow-auto bg-muted/20 p-6 font-mono text-xs leading-relaxed">
                    <code className="text-foreground">
                      {JSON.stringify(apiOutput, null, 2).split("\n").map((line, i) => (
                        <div key={i} className="flex">
                          <span className="mr-4 w-6 select-none text-right text-muted-foreground/50">
                            {i + 1}
                          </span>
                          <span>
                            {line.split(/("[\w-]+")/g).map((part, j) =>
                              part.match(/^"[\w-]+"$/) ? (
                                <span key={j} className="text-info">
                                  {part}
                                </span>
                              ) : part.match(/: "(.*)"/) ? (
                                <span key={j}>
                                  {": "}
                                  <span className="text-success">{part.slice(2)}</span>
                                </span>
                              ) : part.match(/: (true|false|null|\d+)/) ? (
                                <span key={j}>
                                  {": "}
                                  <span className="text-warning">{part.slice(2)}</span>
                                </span>
                              ) : (
                                part
                              )
                            )}
                          </span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>
              </CardContent>
            </Card>
            <Card className="mt-4 overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Notification Audit</CardTitle>
                    <CardDescription>Tenant/User delivery logs with filter and CSV export</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadNotificationAudit()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">
                      Refresh
                    </Button>
                    <Button size="sm" onClick={exportNotificationCsv} disabled={notifRows.length === 0}>
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-2 md:grid-cols-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Scope</label>
                    <Select value={notifScope} onValueChange={(v) => setNotifScope(v as "user" | "tenant")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tenant">Tenant</SelectItem>
                        <SelectItem value="user">Current User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Provider</label>
                    <Select value={notifProvider} onValueChange={(v) => setNotifProvider(v as "all" | "teams" | "lark" | "wecom")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="teams">Teams</SelectItem>
                        <SelectItem value="lark">Feishu</SelectItem>
                        <SelectItem value="wecom">WeCom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <Select value={notifStatus} onValueChange={(v) => setNotifStatus(v as "all" | "ok" | "failed")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="ok">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Since Hours</label>
                    <Input
                      value={notifSinceHours}
                      onChange={(e) => setNotifSinceHours(e.target.value)}
                      placeholder="24"
                    />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">Total</div>
                    <div className="text-base font-semibold">{notifSummary.total}</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">Success</div>
                    <div className="text-base font-semibold text-success">{notifSummary.success}</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">Failed</div>
                    <div className="text-base font-semibold text-destructive">{notifSummary.failed}</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">Top Provider</div>
                    <div className="text-base font-semibold">
                      {Object.entries(notifSummary.byProvider).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-"}
                    </div>
                  </div>
                </div>
                <div className="max-h-[360px] overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Time</th>
                        <th className="px-2 py-1.5 text-left">User</th>
                        <th className="px-2 py-1.5 text-left">Action</th>
                        <th className="px-2 py-1.5 text-left">Provider</th>
                        <th className="px-2 py-1.5 text-left">Status</th>
                        <th className="px-2 py-1.5 text-left">Correlation</th>
                        <th className="px-2 py-1.5 text-left">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifLoading ? (
                        <tr><td className="px-2 py-2 text-muted-foreground" colSpan={7}>Loading...</td></tr>
                      ) : notifRows.length === 0 ? (
                        <tr><td className="px-2 py-2 text-muted-foreground" colSpan={7}>No data.</td></tr>
                      ) : (
                        notifRows.map((r) => (
                          <tr key={r.id} className="border-t border-border/50">
                            <td className="px-2 py-1.5">{new Date(r.createdAt).toLocaleString()}</td>
                            <td className="px-2 py-1.5">{r.userId}</td>
                            <td className="px-2 py-1.5">{r.action}</td>
                            <td className="px-2 py-1.5">{r.provider ?? "-"}</td>
                            <td className={cn("px-2 py-1.5", r.ok ? "text-success" : "text-destructive")}>{r.ok ? "ok" : "failed"}</td>
                            <td className="px-2 py-1.5 font-mono">
                              {r.correlationId ? (
                                <button
                                  onClick={() => openAuditByCorrelation(r.correlationId)}
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                                  title="Open in Agent Audit Trail"
                                >
                                  {r.correlationId.slice(0, 12)}
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-2 py-1.5">{r.detail}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ops" className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Ops Report Export</CardTitle>
                    <CardDescription>Export KPI/trend/circuits/DLQ consolidated CSV.</CardDescription>
                  </div>
                    <Button variant="outline" size="sm" onClick={exportOpsReportCsv} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">
                    Export Ops CSV
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Approval KPI (7 days)</CardTitle>
                    <CardDescription>Live approval operational metrics and trend.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void loadOpsData()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Refresh KPI</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-2 md:grid-cols-6">
                  <div className="rounded-md border border-border bg-muted/20 p-2"><div className="text-[10px] text-muted-foreground">Total</div><div className="text-base font-semibold">{approvalKpiSummary.total}</div></div>
                  <div className="rounded-md border border-border bg-muted/20 p-2"><div className="text-[10px] text-muted-foreground">Pending</div><div className="text-base font-semibold">{approvalKpiSummary.pending}</div></div>
                  <div className="rounded-md border border-border bg-muted/20 p-2"><div className="text-[10px] text-muted-foreground">Overdue</div><div className="text-base font-semibold text-destructive">{approvalKpiSummary.overdue}</div></div>
                  <div className="rounded-md border border-border bg-muted/20 p-2"><div className="text-[10px] text-muted-foreground">Escalated</div><div className="text-base font-semibold">{approvalKpiSummary.escalated}</div></div>
                  <div className="rounded-md border border-border bg-muted/20 p-2"><div className="text-[10px] text-muted-foreground">Avg Approval</div><div className="text-base font-semibold">{Math.round(approvalKpiSummary.avgApprovalSec / 60)}m</div></div>
                  <div className="rounded-md border border-border bg-muted/20 p-2"><div className="text-[10px] text-muted-foreground">Avg Execution</div><div className="text-base font-semibold">{Math.round(approvalKpiSummary.avgExecutionSec / 60)}m</div></div>
                </div>
                <div className="max-h-[180px] overflow-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1 text-left">Day</th>
                        <th className="px-2 py-1 text-left">Total</th>
                        <th className="px-2 py-1 text-left">Pending</th>
                        <th className="px-2 py-1 text-left">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalKpiTrend.length === 0 ? (
                        <tr><td colSpan={4} className="px-2 py-2 text-muted-foreground">No trend data.</td></tr>
                      ) : approvalKpiTrend.map((r) => (
                        <tr key={r.day} className="border-t border-border/50">
                          <td className="px-2 py-1">{r.day}</td>
                          <td className="px-2 py-1">{r.total}</td>
                          <td className="px-2 py-1">{r.pending}</td>
                          <td className="px-2 py-1">{r.overdue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Approval Policy Matrix</CardTitle>
                    <CardDescription>Entity x action route/SLA/escalation/channel control.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void saveApprovalPolicies()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Save Matrix</Button>
                    {approvalPolicySaveStatus !== "idle" && <Badge variant="outline">{approvalPolicySaveStatus}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[340px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Entity</th>
                        <th className="px-2 py-1.5 text-left">Action</th>
                        <th className="px-2 py-1.5 text-left">Enabled</th>
                        <th className="px-2 py-1.5 text-left">Route To</th>
                        <th className="px-2 py-1.5 text-left">SLA(h)</th>
                        <th className="px-2 py-1.5 text-left">Escalate To</th>
                        <th className="px-2 py-1.5 text-left">Channels</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalEntities.flatMap((entityKey) => approvalActions.map((actionType) => {
                        const p = getPolicyCell(entityKey, actionType)
                        return (
                          <tr key={`${entityKey}:${actionType}`} className="border-t border-border/50">
                            <td className="px-2 py-1.5 font-mono">{entityKey}</td>
                            <td className="px-2 py-1.5">{actionType}</td>
                            <td className="px-2 py-1.5"><Switch checked={p.enabled} onCheckedChange={(v) => upsertPolicyCell(entityKey, actionType, { enabled: v })} /></td>
                            <td className="px-2 py-1.5"><Input value={p.auto_route_to ?? ""} onChange={(e) => upsertPolicyCell(entityKey, actionType, { auto_route_to: e.target.value })} placeholder="mdm-admin" /></td>
                            <td className="px-2 py-1.5"><Input value={String(p.sla_hours ?? 24)} onChange={(e) => upsertPolicyCell(entityKey, actionType, { sla_hours: Number(e.target.value || 24) })} /></td>
                            <td className="px-2 py-1.5"><Input value={p.escalate_to ?? ""} onChange={(e) => upsertPolicyCell(entityKey, actionType, { escalate_to: e.target.value })} placeholder="mdm-lead" /></td>
                            <td className="px-2 py-1.5"><Input value={(p.notify_channels ?? []).join(",")} onChange={(e) => upsertPolicyCell(entityKey, actionType, { notify_channels: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="teams,mail" /></td>
                          </tr>
                        )
                      }))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Scheduled Digest</CardTitle>
                    <CardDescription>Daily summary notification schedule and recipients.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void saveDigestConfig()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Save Digest</Button>
                    <Button variant="outline" size="sm" onClick={() => void testDigestConfig()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Test Digest</Button>
                    {digestSaveStatus !== "idle" && <Badge variant="outline">{digestSaveStatus}</Badge>}
                    {digestTestStatus !== "idle" && <Badge variant="outline">{digestTestStatus}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 p-4 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Enabled</label>
                  <Switch checked={digestConfig.enabled} onCheckedChange={(v) => setDigestConfig((p) => ({ ...p, enabled: v }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Time (HH:mm)</label>
                  <Input value={digestConfig.time} onChange={(e) => setDigestConfig((p) => ({ ...p, time: e.target.value }))} placeholder="09:00" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Timezone</label>
                  <Input value={digestConfig.timezone} onChange={(e) => setDigestConfig((p) => ({ ...p, timezone: e.target.value }))} placeholder="Europe/Berlin" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Recipients</label>
                  <Input value={digestConfig.recipients} onChange={(e) => setDigestConfig((p) => ({ ...p, recipients: e.target.value }))} placeholder="qa@regminder.local,ops@regminder.local" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Channels (comma-separated)</label>
                  <Input value={digestConfig.channels} onChange={(e) => setDigestConfig((p) => ({ ...p, channels: e.target.value }))} placeholder="mail,teams" />
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void loadDigestPreview()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Refresh Preview</Button>
                  {digestPreviewStatus !== "idle" && <Badge variant="outline">{digestPreviewStatus}</Badge>}
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Digest Preview</label>
                  <pre className="max-h-[200px] overflow-auto rounded border border-border bg-muted/20 p-2 text-xs">
{digestPreview?.preview ?? "No preview yet"}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Ops Alert Thresholds</CardTitle>
                    <CardDescription>Warning levels used by Ops monitoring and dashboards.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void saveOpsThresholds()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Save Thresholds</Button>
                    {opsThresholdStatus !== "idle" && <Badge variant="outline">{opsThresholdStatus}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 p-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Overdue Warn Count</label>
                  <Input value={String(opsThresholds.overdueWarnCount)} onChange={(e) => setOpsThresholds((p) => ({ ...p, overdueWarnCount: Number(e.target.value || 0) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Escalated Warn Count</label>
                  <Input value={String(opsThresholds.escalatedWarnCount)} onChange={(e) => setOpsThresholds((p) => ({ ...p, escalatedWarnCount: Number(e.target.value || 0) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">DLQ Warn Count</label>
                  <Input value={String(opsThresholds.dlqWarnCount)} onChange={(e) => setOpsThresholds((p) => ({ ...p, dlqWarnCount: Number(e.target.value || 0) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Circuit Failure Warn Count</label>
                  <Input value={String(opsThresholds.circuitFailureWarnCount)} onChange={(e) => setOpsThresholds((p) => ({ ...p, circuitFailureWarnCount: Number(e.target.value || 0) }))} />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Workflow Runtime Config</CardTitle>
                    <CardDescription>Configure webhook/email targets now, connect real URLs later.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void saveWorkflowRuntime()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">
                      Save Runtime
                    </Button>
                    {workflowRuntimeSaveStatus !== "idle" && <Badge variant="outline">{workflowRuntimeSaveStatus}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-2 md:grid-cols-4">
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">Teams</div>
                    <div className={cn("text-xs font-semibold", workflowRuntime.teamsWebhookUrl ? "text-success" : "text-destructive")}>
                      {workflowRuntime.teamsWebhookUrl ? "Configured" : "Missing"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">Lark</div>
                    <div className={cn("text-xs font-semibold", workflowRuntime.larkWebhookUrl ? "text-success" : "text-destructive")}>
                      {workflowRuntime.larkWebhookUrl ? "Configured" : "Missing"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">WeCom</div>
                    <div className={cn("text-xs font-semibold", workflowRuntime.wecomWebhookUrl ? "text-success" : "text-destructive")}>
                      {workflowRuntime.wecomWebhookUrl ? "Configured" : "Missing"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">Mail</div>
                    <div
                      className={cn(
                        "text-xs font-semibold",
                        workflowRuntime.mailTo && workflowRuntime.smtpHost && workflowRuntime.smtpFrom
                          ? "text-success"
                          : "text-destructive"
                      )}
                    >
                      {workflowRuntime.mailTo && workflowRuntime.smtpHost && workflowRuntime.smtpFrom ? "Configured" : "Missing"}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Teams Webhook URL</label>
                    <Input value={workflowRuntime.teamsWebhookUrl} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, teamsWebhookUrl: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Lark Webhook URL</label>
                    <Input value={workflowRuntime.larkWebhookUrl} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, larkWebhookUrl: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">WeCom Webhook URL</label>
                    <Input value={workflowRuntime.wecomWebhookUrl} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, wecomWebhookUrl: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mail To</label>
                    <Input value={workflowRuntime.mailTo} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, mailTo: e.target.value }))} placeholder="qa@regminder.local" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">SMTP Host</label>
                    <Input value={workflowRuntime.smtpHost} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, smtpHost: e.target.value }))} placeholder="mailpit" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">SMTP Port</label>
                    <Input value={workflowRuntime.smtpPort} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, smtpPort: e.target.value }))} placeholder="1025" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">SMTP User</label>
                    <Input value={workflowRuntime.smtpUser} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, smtpUser: e.target.value }))} placeholder="optional" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">SMTP Password</label>
                    <Input type="password" value={workflowRuntime.smtpPass} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, smtpPass: e.target.value }))} placeholder="optional" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">SMTP From</label>
                    <Input value={workflowRuntime.smtpFrom} onChange={(e) => setWorkflowRuntime((p) => ({ ...p, smtpFrom: e.target.value }))} placeholder="mdm-bot@regminder.local" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void testWorkflowRuntime("teams")} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Test Teams</Button>
                  <Button variant="ghost" size="sm" onClick={() => void copyRuntimeTestCurl("teams")} className="transition-colors hover:bg-primary/5 hover:text-primary">Copy Teams cURL</Button>
                  <Button variant="outline" size="sm" onClick={() => void testWorkflowRuntime("lark")} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Test Lark</Button>
                  <Button variant="ghost" size="sm" onClick={() => void copyRuntimeTestCurl("lark")} className="transition-colors hover:bg-primary/5 hover:text-primary">Copy Lark cURL</Button>
                  <Button variant="outline" size="sm" onClick={() => void testWorkflowRuntime("wecom")} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Test WeCom</Button>
                  <Button variant="ghost" size="sm" onClick={() => void copyRuntimeTestCurl("wecom")} className="transition-colors hover:bg-primary/5 hover:text-primary">Copy WeCom cURL</Button>
                  <Button variant="outline" size="sm" onClick={() => void testWorkflowRuntime("mail")} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Test Mail</Button>
                  <Button variant="ghost" size="sm" onClick={() => void copyRuntimeTestCurl("mail")} className="transition-colors hover:bg-primary/5 hover:text-primary">Copy Mail cURL</Button>
                  <Button variant="outline" size="sm" onClick={() => void testAllConfiguredRuntime()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Test All Configured</Button>
                  {workflowRuntimeTestStatus !== "idle" && <Badge variant="outline">{workflowRuntimeTestStatus}</Badge>}
                  {workflowRuntimeBatchStatus !== "idle" && <Badge variant="outline">{workflowRuntimeBatchStatus}</Badge>}
                  {workflowRuntimeCopyStatus !== "idle" && <Badge variant="outline">{workflowRuntimeCopyStatus}</Badge>}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Delivery Circuits</CardTitle>
                    <CardDescription>Provider circuit-breaker state</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void loadOpsData()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {(["teams", "lark", "wecom"] as const).map((p) => {
                    const row = opsCircuits[p]
                    return (
                      <div key={p} className="rounded-md border border-border bg-muted/20 p-3">
                        <div className="text-sm font-semibold">{p}</div>
                        <div className={cn("mt-1 text-xs", row?.open ? "text-destructive" : "text-success")}>
                          {row?.open ? "OPEN" : "CLOSED"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">failures: {row?.failures ?? 0}</div>
                        <div className="text-xs text-muted-foreground">
                          openUntil: {row?.openUntilMs ? new Date(row.openUntilMs).toLocaleTimeString() : "-"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Delivery DLQ</CardTitle>
                    <CardDescription>Failed deliveries queued for replay</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void replayAllDlq()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">
                      Replay All
                    </Button>
                    {dlqBatchStatus !== "idle" && <Badge variant="outline">{dlqBatchStatus}</Badge>}
                    {opsLoading && <Badge variant="outline">Loading...</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Time</th>
                        <th className="px-2 py-1.5 text-left">Provider</th>
                        <th className="px-2 py-1.5 text-left">Attempts</th>
                        <th className="px-2 py-1.5 text-left">Reason</th>
                        <th className="px-2 py-1.5 text-left">Correlation</th>
                        <th className="px-2 py-1.5 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opsDlqRows.length === 0 ? (
                        <tr>
                          <td className="px-2 py-2 text-muted-foreground" colSpan={6}>No DLQ messages.</td>
                        </tr>
                      ) : (
                        opsDlqRows.map((r) => (
                          <tr key={r.id} className="border-t border-border/50">
                            <td className="px-2 py-1.5">{new Date(r.createdAt).toLocaleString()}</td>
                            <td className="px-2 py-1.5">{r.provider}</td>
                            <td className="px-2 py-1.5">{r.attempts}</td>
                            <td className="px-2 py-1.5">{r.reason}</td>
                            <td className="px-2 py-1.5 font-mono">{r.correlationId.slice(0, 12)}</td>
                            <td className="px-2 py-1.5">
                              <Button size="sm" variant="outline" onClick={() => void replayDlq(r.id)} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">
                                Replay
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">SLA Job Scheduler</CardTitle>
                    <CardDescription>Configure reminder/escalation worker runtime intervals.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void runWorkerOnce()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Run Once</Button>
                    <Button size="sm" variant="outline" onClick={() => void saveWorkerConfig()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Save Scheduler</Button>
                    {workerConfigStatus !== "idle" && <Badge variant="outline">{workerConfigStatus}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 md:grid-cols-5">
                <div>
                  <label className="text-xs text-muted-foreground">Enabled</label>
                  <div className="mt-2">
                    <Switch checked={workerConfig.enabled} onCheckedChange={(v) => setWorkerConfig((p) => ({ ...p, enabled: v }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Poll Seconds</label>
                  <Input value={String(workerConfig.pollSeconds)} onChange={(e) => setWorkerConfig((p) => ({ ...p, pollSeconds: Number(e.target.value || 60) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reminder T-4h</label>
                  <Input value={String(workerConfig.reminderBeforeHoursT4)} onChange={(e) => setWorkerConfig((p) => ({ ...p, reminderBeforeHoursT4: Number(e.target.value || 4) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reminder T-1h</label>
                  <Input value={String(workerConfig.reminderBeforeHoursT1)} onChange={(e) => setWorkerConfig((p) => ({ ...p, reminderBeforeHoursT1: Number(e.target.value || 1) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Escalation Reminder (min)</label>
                  <Input value={String(workerConfig.escalationReminderMinutes)} onChange={(e) => setWorkerConfig((p) => ({ ...p, escalationReminderMinutes: Number(e.target.value || 60) }))} />
                </div>
                <div className="md:col-span-5 text-xs text-muted-foreground">
                  Last run: {workerConfig.lastRunAt ? new Date(workerConfig.lastRunAt).toLocaleString() : "-"} | Last error: {workerConfig.lastError ?? "-"}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Phase 2 Readiness Check</CardTitle>
                    <CardDescription>Run a one-click health/readiness diagnostic for core services.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void runReadinessCheck()} className="transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary/50">Run Check</Button>
                    {readinessStatus !== "idle" && <Badge variant="outline">{readinessStatus}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                <div className="text-xs text-muted-foreground">Last checked: {readinessCheckedAt ? new Date(readinessCheckedAt).toLocaleString() : "-"}</div>
                <div className="overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Check</th>
                        <th className="px-2 py-1.5 text-left">Status</th>
                        <th className="px-2 py-1.5 text-left">Latency</th>
                        <th className="px-2 py-1.5 text-left">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readinessRows.length === 0 ? (
                        <tr><td className="px-2 py-2 text-muted-foreground" colSpan={4}>No readiness run yet.</td></tr>
                      ) : readinessRows.map((r) => (
                        <tr key={r.key} className="border-t border-border/50">
                          <td className="px-2 py-1.5 font-mono">{r.key}</td>
                          <td className={cn("px-2 py-1.5 font-semibold", r.ok ? "text-success" : "text-destructive")}>{r.ok ? "PASS" : "FAIL"}</td>
                          <td className="px-2 py-1.5">{r.latencyMs} ms</td>
                          <td className="px-2 py-1.5">{r.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
