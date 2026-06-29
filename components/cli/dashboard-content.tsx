"use client"

import { useEffect, useState } from "react"
import {
  FlaskConical,
  Package,
  FolderKanban,
  Headset,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  BarChart3,
  Cpu,
  History,
  RefreshCw,
  Brain,
  Database,
  Sparkles,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Badge color palette for different modules (matches sidebar)
function getModuleColor(label: string): { bg: string; text: string } {
  const colorMap: Record<string, { bg: string; text: string }> = {
    "LIMS Lab Management": { bg: "bg-blue-100", text: "text-blue-700" },
    "ERP Order Management": { bg: "bg-purple-100", text: "text-purple-700" },
    "PM Project Management": { bg: "bg-indigo-100", text: "text-indigo-700" },
    "SD Service Desk": { bg: "bg-cyan-100", text: "text-cyan-700" },
    "GMA Market Access": { bg: "bg-amber-100", text: "text-amber-700" },
  }
  return colorMap[label] || { bg: "bg-gray-100", text: "text-gray-700" }
}

interface StatCard {
  label: string
  value: string
  change?: string
  changeType?: "up" | "down" | "neutral"
  icon: React.ReactNode
}

interface ModuleCard {
  id: string
  label: string
  icon: React.ReactNode
  stats: { label: string; value: string }[]
  status: "healthy" | "warning" | "error"
}

interface AiMemoryPreview {
  scope?: string
  userId?: string
  entity?: string
  markdown?: string
  updatedAt?: string
}

interface AiAuditPreview {
  audit_id?: string
  action?: string
  provider?: string
  skill_key?: string
  actor?: string
  status?: string
  created_at?: string
}

const statsCards: StatCard[] = [
  { label: "Pending Tasks", value: "23", change: "+5", changeType: "up", icon: <Clock className="h-5 w-5" /> },
  { label: "Completed Today", value: "18", change: "+12%", changeType: "up", icon: <CheckCircle2 className="h-5 w-5" /> },
  { label: "Active Projects", value: "47", change: "0", changeType: "neutral", icon: <Activity className="h-5 w-5" /> },
  { label: "Urgent Items", value: "3", change: "-2", changeType: "down", icon: <AlertTriangle className="h-5 w-5" /> },
]

const moduleCards: ModuleCard[] = [
  {
    id: "lims",
    label: "LIMS Lab Management",
    icon: <FlaskConical className="h-5 w-5" />,
    stats: [
      { label: "Tests In Progress", value: "34" },
      { label: "Pending Samples", value: "12" },
      { label: "Equipment Utilization", value: "78%" },
    ],
    status: "healthy",
  },
  {
    id: "erp",
    label: "ERP Order Management",
    icon: <Package className="h-5 w-5" />,
    stats: [
      { label: "Monthly Orders", value: "156" },
      { label: "Pending Quotes", value: "8" },
      { label: "Collection Rate", value: "92%" },
    ],
    status: "healthy",
  },
  {
    id: "pm",
    label: "PM Project Management",
    icon: <FolderKanban className="h-5 w-5" />,
    stats: [
      { label: "Active Projects", value: "47" },
      { label: "Due This Week", value: "6" },
      { label: "Delayed Projects", value: "2" },
    ],
    status: "warning",
  },
  {
    id: "sd",
    label: "SD Service Desk",
    icon: <Headset className="h-5 w-5" />,
    stats: [
      { label: "Open Tickets", value: "15" },
      { label: "Avg Response", value: "2.5h" },
      { label: "Satisfaction", value: "96%" },
    ],
    status: "healthy",
  },
  {
    id: "gma",
    label: "GMA Market Access",
    icon: <Scale className="h-5 w-5" />,
    stats: [
      { label: "Regulations", value: "1,234" },
      { label: "Monthly Updates", value: "23" },
      { label: "Compliance Checks", value: "89" },
    ],
    status: "healthy",
  },
]

const recentActivities = [
  { id: "1", action: "Created project", target: "PRJ-2024-0892", user: "John Wei", time: "5 min ago", module: "PM" },
  { id: "2", action: "Completed test", target: "TST-EMC-0156", user: "Mike Li", time: "12 min ago", module: "LIMS" },
  { id: "3", action: "Signed report", target: "RPT-2024-0891", user: "Sarah Wang", time: "25 min ago", module: "LIMS" },
  { id: "4", action: "Approved", target: "QT-2024-0155", user: "Manager Liu", time: "1 hour ago", module: "ERP" },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "healthy":
      return "bg-success"
    case "warning":
      return "bg-warning"
    case "error":
      return "bg-destructive"
    default:
      return "bg-muted"
  }
}

export function DashboardContent({ onNavigate }: { onNavigate?: (item: string) => void }) {
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>(["kpi-overview", "orders-today", "lab-queue", "urgent-items"])
  const [enabledModules, setEnabledModules] = useState<string[]>(["LIMS", "ERP", "PM", "SD", "GMA"])
  const [enabledQuickActions, setEnabledQuickActions] = useState<string[]>(["new-sample", "create-order", "submit-ticket", "generate-report"])
  const [limsAuditItems, setLimsAuditItems] = useState<Array<{ change_id: string; action: string; actor: string; record_id: string; changed_fields: string[]; created_at: string }>>([])
  const [limsAuditLoading, setLimsAuditLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState({ systemSkills: 0, userSkills: 0, memories: 0, auditEvents: 0 })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiLatestMemories, setAiLatestMemories] = useState<AiMemoryPreview[]>([])
  const [aiLatestAudit, setAiLatestAudit] = useState<AiAuditPreview[]>([])
  const [expandedMemoryIndex, setExpandedMemoryIndex] = useState<number | null>(null)
  const [expandedAuditIndex, setExpandedAuditIndex] = useState<number | null>(null)

  useEffect(() => {
    void loadDashboardPreferences()
    const timer = setInterval(() => {
      void loadDashboardPreferences()
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  async function loadLimsAudit(): Promise<void> {
    setLimsAuditLoading(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/lims/changelog?entity=sample&limit=4")
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data?.detail ?? "failed to load audit")
      setLimsAuditItems(Array.isArray(data.items) ? data.items : [])
    } catch {
      setLimsAuditItems([])
    } finally {
      setLimsAuditLoading(false)
    }
  }

  async function loadAiSummary(): Promise<void> {
    setAiLoading(true)
    try {
      const [systemSkillsResp, userSkillsResp, systemMemoryResp, userMemoryResp, auditResp] = await Promise.all([
        fetch("/api/proxy/api/v1/skills?scope=system"),
        fetch("/api/proxy/api/v1/skills?scope=user&userId=demo-user"),
        fetch("/api/proxy/api/v1/memory?scope=system"),
        fetch("/api/proxy/api/v1/memory?scope=user&userId=demo-user"),
        fetch("/api/proxy/api/v1/mcp/audit?limit=20"),
      ])

      const [systemSkillsData, userSkillsData, systemMemoryData, userMemoryData, auditData] = await Promise.all([
        systemSkillsResp.json() as Promise<{ items?: unknown[] }>,
        userSkillsResp.json() as Promise<{ items?: unknown[] }>,
        systemMemoryResp.json() as Promise<{ items?: unknown[] }>,
        userMemoryResp.json() as Promise<{ items?: unknown[] }>,
        auditResp.json() as Promise<{ items?: unknown[] }>,
      ])

      const systemMemories = (Array.isArray(systemMemoryData.items) ? systemMemoryData.items : []) as AiMemoryPreview[]
      const userMemories = (Array.isArray(userMemoryData.items) ? userMemoryData.items : []) as AiMemoryPreview[]
      const auditItems = (Array.isArray(auditData.items) ? auditData.items : []) as AiAuditPreview[]
      const mergedMemories = [...systemMemories, ...userMemories].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
      const mergedAudit = [...auditItems].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))

      setAiSummary({
        systemSkills: Array.isArray(systemSkillsData.items) ? systemSkillsData.items.length : 0,
        userSkills: Array.isArray(userSkillsData.items) ? userSkillsData.items.length : 0,
        memories: mergedMemories.length,
        auditEvents: mergedAudit.length,
      })
      setAiLatestMemories(mergedMemories.slice(0, 3))
      setAiLatestAudit(mergedAudit.slice(0, 3))
    } catch {
      setAiSummary({ systemSkills: 0, userSkills: 0, memories: 0, auditEvents: 0 })
      setAiLatestMemories([])
      setAiLatestAudit([])
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    void loadLimsAudit()
  }, [])

  useEffect(() => {
    void loadAiSummary()
  }, [])

  async function api(path: string, init?: RequestInit): Promise<unknown> {
    const resp = await fetch(`/api/proxy${path}`, init)
    const text = await resp.text()
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
    }
  }

  async function loadDashboardPreferences(): Promise<void> {
    try {
      const data = (await api("/api/v1/dashboard/preferences")) as {
        widgets?: string[]
        modules?: string[]
        quickActions?: string[]
      }
      if (Array.isArray(data.widgets)) setEnabledWidgets(data.widgets)
      if (Array.isArray(data.modules)) setEnabledModules(data.modules)
      if (Array.isArray(data.quickActions)) setEnabledQuickActions(data.quickActions)
    } catch {
      // keep current defaults on transient errors
    }
  }

  const widgetAlias: Record<string, string> = {
    "kpi-overview": "pending-tasks",
    "orders-today": "completed-today",
    "lab-queue": "active-projects",
    "urgent-items": "urgent-items",
  }
  const enabledWidgetIds = new Set(enabledWidgets.map((w) => widgetAlias[w] ?? w).map((w) => w.toLowerCase()))
  const visibleStats = statsCards.filter((s) => {
    const id = s.label.toLowerCase().replace(/\s+/g, "-")
    return enabledWidgetIds.size === 0 || enabledWidgetIds.has(id)
  })

  const moduleAlias: Record<string, string> = {
    LIMS: "lims",
    ERP: "erp",
    PM: "pm",
    SD: "sd",
    GMA: "gma",
  }
  const enabledModuleIds = new Set(enabledModules.map((m) => moduleAlias[m.toUpperCase()] ?? m.toLowerCase()))
  const visibleModules = moduleCards.filter((m) => enabledModuleIds.size === 0 || enabledModuleIds.has(m.id))

  const quickActionDefs = [
    { id: "new-sample", icon: <FlaskConical className="h-5 w-5 text-primary" />, label: "New Sample" },
    { id: "create-order", icon: <Package className="h-5 w-5 text-primary" />, label: "Create Order" },
    { id: "submit-ticket", icon: <Headset className="h-5 w-5 text-primary" />, label: "Submit Ticket" },
    { id: "generate-report", icon: <BarChart3 className="h-5 w-5 text-primary" />, label: "Generate Report" },
  ]
  const quickAlias: Record<string, string> = {
    "/report draft": "generate-report",
    "/create task": "submit-ticket",
    "/send update": "create-order",
  }
  const enabledQuickSet = new Set(enabledQuickActions.map((q) => quickAlias[q] ?? q))
  const visibleQuickActions = quickActionDefs.filter((q) => enabledQuickSet.size === 0 || enabledQuickSet.has(q.id))

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Welcome back, John Wei</h1>
          <p className="text-muted-foreground">Today is December 15, 2024, Sunday - Shenzhen Lab</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">

      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <History className="h-4 w-4 text-primary" />
              Live LIMS Audit
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Visible on the landing dashboard so you can validate backend activity without opening a module.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadLimsAudit()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {limsAuditLoading ? (
            <div className="col-span-full rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Loading live audit trail...
            </div>
          ) : limsAuditItems.length > 0 ? (
            limsAuditItems.map((item) => (
              <div key={item.change_id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{item.action}</span>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-sm text-foreground">
                  by <span className="font-medium">{item.actor}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Record: {item.record_id || "-"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Fields: {item.changed_fields.length > 0 ? item.changed_fields.join(", ") : "-"}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No live LIMS audit events found yet.
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Brain className="h-4 w-4 text-primary" />
              AI Status
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Live visibility into skills, memory, and MCP activity so the agent layer is visible right on the dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAiSummary()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "System Skills", value: aiSummary.systemSkills, icon: <ShieldCheck className="h-4 w-4" />, item: "ai-skills", hint: "Open Skills" },
            { label: "User Skills", value: aiSummary.userSkills, icon: <Sparkles className="h-4 w-4" />, item: "ai-skills", hint: "Open Skills" },
            { label: "Memory Records", value: aiSummary.memories, icon: <Database className="h-4 w-4" />, item: "ai-memory", hint: "Open Memory" },
            { label: "Audit Events", value: aiSummary.auditEvents, icon: <Activity className="h-4 w-4" />, item: "ai-audit", hint: "Open Audit" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate?.(item.item)}
              className="rounded-xl border border-border/70 bg-muted/20 p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{item.icon}</div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{aiLoading ? "Loading" : "Live"}</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">{item.value}</div>
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="mt-2 text-xs font-medium text-primary">{item.hint}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Latest Memory</div>
                <div className="text-xs text-muted-foreground">Newest memory snippets updated in the workspace</div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("ai-memory")}
                className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                Open Memory
              </button>
            </div>
            <div className="space-y-2">
              {aiLatestMemories.length > 0 ? (
                aiLatestMemories.map((item, index) => (
                  <button
                    key={`${item.scope ?? "system"}:${item.userId ?? ""}:${item.entity ?? ""}:${index}`}
                    type="button"
                    onClick={() => {
                      setExpandedMemoryIndex((current) => (current === index ? null : index))
                      onNavigate?.("ai-memory")
                    }}
                    className="w-full rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-background"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{item.entity ?? "general"}</span>
                      <span className="text-[11px] text-muted-foreground">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {item.scope === "user" ? `User: ${item.userId ?? "-"}` : "System memory"}
                    </div>
                    <div className="mt-2 truncate text-xs text-muted-foreground">
                      {(item.markdown ?? "").replace(/\s+/g, " ").trim() || "No markdown content"}
                    </div>
                    {expandedMemoryIndex === index && (
                      <div className="mt-2 rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
                        <div className="mb-1 font-medium text-foreground">Full preview</div>
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap">{item.markdown ?? "No markdown content"}</pre>
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">
                  No memory previews found yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Latest Audit</div>
                <div className="text-xs text-muted-foreground">Recent agent and MCP execution events</div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("ai-audit")}
                className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                Open Audit
              </button>
            </div>
            <div className="space-y-2">
              {aiLatestAudit.length > 0 ? (
                aiLatestAudit.map((item, index) => (
                  <button
                    key={`${item.audit_id ?? item.created_at ?? index}`}
                    type="button"
                    onClick={() => {
                      setExpandedAuditIndex((current) => (current === index ? null : index))
                      onNavigate?.("ai-audit")
                    }}
                    className="w-full rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-background"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{item.action ?? "audit-event"}</span>
                      <span className="text-[11px] text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {item.provider ? `Provider: ${item.provider}` : "Provider: -"} · {item.skill_key ? `Skill: ${item.skill_key}` : "Skill: -"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.actor ? `Actor: ${item.actor}` : "Actor: -"} · {item.status ? `Status: ${item.status}` : "Status: -"}
                    </div>
                    {expandedAuditIndex === index && (
                      <div className="mt-2 rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
                        <div className="mb-1 font-medium text-foreground">Expanded details</div>
                        <div>Audit ID: {item.audit_id ?? "-"}</div>
                        <div>Provider: {item.provider ?? "-"}</div>
                        <div>Skill: {item.skill_key ?? "-"}</div>
                        <div>Actor: {item.actor ?? "-"}</div>
                        <div>Status: {item.status ?? "-"}</div>
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">
                  No audit previews found yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleStats.map((stat, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{stat.icon}</div>
              {stat.change && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-sm",
                    stat.changeType === "up" && "text-success",
                    stat.changeType === "down" && "text-destructive",
                    stat.changeType === "neutral" && "text-muted-foreground"
                  )}
                >
                  {stat.changeType === "up" && <ArrowUpRight className="h-4 w-4" />}
                  {stat.changeType === "down" && <ArrowDownRight className="h-4 w-4" />}
                  {stat.change}
                </div>
              )}
            </div>
            <div className="text-2xl font-semibold text-foreground">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="font-heading mb-4 text-lg font-semibold text-foreground">System Modules</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {visibleModules.map((module) => (
            <div key={module.id} className="group cursor-pointer rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", getModuleColor(module.label).bg, getModuleColor(module.label).text)}>{module.icon}</div>
                  <span className="text-sm font-medium text-foreground">{module.label}</span>
                </div>
                <div className={cn("h-2 w-2 rounded-full", getStatusColor(module.status))} />
              </div>
              <div className="space-y-2">
                {module.stats.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <span className="font-mono text-sm text-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            <button className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="divide-y divide-border">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">{activity.user[0]}</div>
                  <div>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{activity.user}</span> {activity.action} <span className="font-mono text-primary">{activity.target}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{activity.module}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2">
                {visibleQuickActions.map((action) => (
                  <button key={action.id} className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-center transition-colors hover:bg-muted">
                    {action.icon}
                    <span className="text-xs text-foreground">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Today&apos;s Schedule</h3>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md bg-muted/50 p-2">
                  <div className="text-center"><div className="text-sm font-medium text-primary">09:00</div></div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">EMC Test Review Meeting</p>
                    <p className="text-xs text-muted-foreground">Meeting Room A</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-md p-2">
                  <div className="text-center"><div className="text-sm font-medium text-foreground">14:00</div></div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">Client Visit - TechCorp</p>
                    <p className="text-xs text-muted-foreground">Reception Hall</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-md p-2">
                  <div className="text-center"><div className="text-sm font-medium text-foreground">16:30</div></div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">Weekly Report Deadline</p>
                    <p className="text-xs text-muted-foreground">Online</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">System Status</h3>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Hermes Agent</span>
                <span className="flex items-center gap-1 text-xs text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />Running</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">API Gateway</span>
                <span className="flex items-center gap-1 text-xs text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />Normal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Database</span>
                <span className="flex items-center gap-1 text-xs text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Equipment Interface</span>
                <span className="flex items-center gap-1 text-xs text-warning"><span className="h-1.5 w-1.5 rounded-full bg-warning" />Partial Offline</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
