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

export function DashboardContent() {
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>(["kpi-overview", "orders-today", "lab-queue", "urgent-items"])
  const [enabledModules, setEnabledModules] = useState<string[]>(["LIMS", "ERP", "PM", "SD", "GMA"])
  const [enabledQuickActions, setEnabledQuickActions] = useState<string[]>(["new-sample", "create-order", "submit-ticket", "generate-report"])

  useEffect(() => {
    void loadDashboardPreferences()
    const timer = setInterval(() => {
      void loadDashboardPreferences()
    }, 5000)
    return () => clearInterval(timer)
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
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Welcome back, John Wei</h1>
        <p className="text-muted-foreground">Today is December 15, 2024, Sunday - Shenzhen Lab</p>
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
        <h2 className="mb-4 text-lg font-semibold text-foreground">System Modules</h2>
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
  )
}
