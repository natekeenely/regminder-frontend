"use client"

import { useEffect, useMemo, useState } from "react"
import {
  FileText,
  ClipboardList,
  CheckSquare,
  Clock,
  AlertTriangle,
  ChevronRight,
  FlaskConical,
  Package,
  Headset,
  Scale,
  Eye,
  MoreHorizontal,
  RefreshCw,
  User,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TabType = "approvals" | "tickets" | "reports"

interface TaskCard {
  id: string
  type: "sample" | "order" | "ticket" | "regulation" | "report"
  title: string
  subtitle: string
  status: "pending" | "urgent" | "processing" | "completed"
  priority?: "high" | "medium" | "low"
  assignee?: string
  dueDate?: string
  meta?: Record<string, string>
  backendId?: string
  canAct?: boolean
}

interface LiveTaskCard {
  id: string
  title: string
  description: string
  status: "open" | "in_progress" | "done"
  assignee?: string
  createdAt: string
  updatedAt: string
  history?: Array<{ id: string; at: string; actor: string; action: string; detail: string }>
  comments?: Array<{ id: string; at: string; author: string; text: string }>
}

interface NotificationLogItem {
  id: string
  at?: string
  createdAt?: string
  action: string
  ok: boolean
  provider?: string
  detail: string
  correlationId?: string
}

const mockApprovals: TaskCard[] = [
  {
    id: "a1",
    type: "sample",
    title: "Sample Receipt Confirmation",
    subtitle: "TechCorp - Power Adapter x5",
    status: "pending",
    priority: "high",
    assignee: "John Zhang",
    dueDate: "Today",
    meta: { sampleId: "SMP-2024-0156", lab: "Shenzhen Lab" },
  },
  {
    id: "a2",
    type: "order",
    title: "Quotation Approval",
    subtitle: "Huawei Terminal - EMC Test Package",
    status: "urgent",
    priority: "high",
    assignee: "Manager Li",
    dueDate: "Overdue 1 day",
    meta: { amount: "$17,500", items: "12 items" },
  },
  {
    id: "a3",
    type: "report",
    title: "Test Report Signing",
    subtitle: "PRJ-2024-0891 - CE Certification Report",
    status: "pending",
    priority: "medium",
    assignee: "Engineer Wang",
    dueDate: "Tomorrow",
    meta: { standard: "EN 62368-1", pages: "48 pages" },
  },
]

const mockTickets: TaskCard[] = [
  {
    id: "t1",
    type: "ticket",
    title: "Equipment Calibration Anomaly",
    subtitle: "EMC Chamber A - Field probe deviation",
    status: "urgent",
    priority: "high",
    assignee: "Equipment Team",
    dueDate: "Within 2 hours",
    meta: { ticketId: "SD-2024-0432", sla: "P1" },
  },
  {
    id: "t2",
    type: "ticket",
    title: "Customer Inquiry Follow-up",
    subtitle: "OPPO - Certification progress inquiry",
    status: "processing",
    priority: "medium",
    assignee: "Customer Service",
    dueDate: "Within 4 hours",
    meta: { ticketId: "SD-2024-0431", sla: "P2" },
  },
  {
    id: "t3",
    type: "regulation",
    title: "Regulation Update Notice",
    subtitle: "EU RED 2024 Revision - Impact assessment",
    status: "pending",
    priority: "medium",
    dueDate: "This week",
    meta: { region: "EU", category: "Radio" },
  },
]

const mockReports: TaskCard[] = [
  {
    id: "r1",
    type: "report",
    title: "EMC测试报告",
    subtitle: "PRJ-2024-0892 - TechCorp",
    status: "processing",
    meta: { progress: "85%", standard: "EN 55032" },
  },
  {
    id: "r2",
    type: "report",
    title: "安全测试报告",
    subtitle: "PRJ-2024-0890 - 小米科技",
    status: "completed",
    meta: { progress: "100%", standard: "IEC 62368-1" },
  },
  {
    id: "r3",
    type: "report",
    title: "RF性能报告",
    subtitle: "PRJ-2024-0888 - VIVO",
    status: "pending",
    meta: { progress: "0%", standard: "EN 300 328" },
  },
]

const getTypeIcon = (type: string) => {
  switch (type) {
    case "sample":
      return <FlaskConical className="h-4 w-4" />
    case "order":
      return <Package className="h-4 w-4" />
    case "ticket":
      return <Headset className="h-4 w-4" />
    case "regulation":
      return <Scale className="h-4 w-4" />
    case "report":
      return <FileText className="h-4 w-4" />
    default:
      return <ClipboardList className="h-4 w-4" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "urgent":
      return "border-destructive bg-destructive/10 text-destructive"
    case "pending":
      return "border-warning bg-warning/10 text-warning"
    case "processing":
      return "border-info bg-info/10 text-info"
    case "completed":
      return "border-success bg-success/10 text-success"
    default:
      return "border-muted bg-muted text-muted-foreground"
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "urgent":
      return "Urgent"
    case "pending":
      return "Pending"
    case "processing":
      return "In Progress"
    case "completed":
      return "Completed"
    default:
      return status
  }
}

function TaskCardComponent({
  task,
  onApprove,
  onReject,
  onAssign,
  actionBusy,
}: {
  task: TaskCard
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onAssign?: (id: string) => void
  actionBusy?: string | null
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
            {getTypeIcon(task.type)}
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">{task.title}</h4>
            <p className="text-xs text-muted-foreground">{task.subtitle}</p>
          </div>
        </div>
        <button className="opacity-0 transition-opacity group-hover:opacity-100">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Meta Info */}
      {task.meta && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {Object.entries(task.meta).map(([key, value]) => (
            <span
              key={key}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {key}: {value}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.assignee && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <User className="h-3 w-3" />
              {task.assignee}
            </div>
          )}
          {task.dueDate && (
            <div
              className={cn(
                "flex items-center gap-1 text-[10px]",
                task.status === "urgent"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              <Clock className="h-3 w-3" />
              {task.dueDate}
            </div>
          )}
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
            getStatusColor(task.status)
          )}
        >
          {getStatusLabel(task.status)}
        </span>
      </div>
      {task.canAct && task.backendId && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
          <button
            onClick={() => onApprove?.(task.backendId!)}
            disabled={actionBusy === task.backendId}
            className="rounded border border-border px-2 py-1 text-[10px] text-foreground hover:bg-muted disabled:opacity-60"
          >
            Approve
          </button>
          <button
            onClick={() => onReject?.(task.backendId!)}
            disabled={actionBusy === task.backendId}
            className="rounded border border-border px-2 py-1 text-[10px] text-foreground hover:bg-muted disabled:opacity-60"
          >
            Reject
          </button>
          <button
            onClick={() => onAssign?.(task.backendId!)}
            disabled={actionBusy === task.backendId}
            className="rounded border border-border px-2 py-1 text-[10px] text-foreground hover:bg-muted disabled:opacity-60"
          >
            Assign
          </button>
        </div>
      )}
    </div>
  )
}

export function TaskPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("approvals")
  const [liveTaskCards, setLiveTaskCards] = useState<LiveTaskCard[]>([])
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<"reader" | "editor" | "admin">("editor")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [historyItems, setHistoryItems] = useState<Array<{ id: string; at: string; actor: string; action: string; detail: string }>>([])
  const [commentItems, setCommentItems] = useState<Array<{ id: string; at: string; author: string; text: string }>>([])
  const [commentText, setCommentText] = useState("")
  const [notifyEnabled, setNotifyEnabled] = useState(true)
  const [notifyProvider, setNotifyProvider] = useState<"teams" | "lark" | "wecom">("lark")
  const [notificationLog, setNotificationLog] = useState<NotificationLogItem[]>([])

  const loadLiveTaskCards = async () => {
    setLoading(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/task-cards", {
        headers: { "x-user-roles": userRole },
      })
      const text = await resp.text()
      if (!text) return
      const data = JSON.parse(text)
      if (resp.ok && data?.ok && Array.isArray(data.items)) {
        setLiveTaskCards(data.items as LiveTaskCard[])
      }
    } catch {
      // Ignore fetch/parse errors - API may not be available
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLiveTaskCards()
  }, [userRole])

  const loadNotificationLogs = async () => {
    try {
      const resp = await fetch("/api/proxy/api/v1/notification-logs?limit=20", {
        headers: { "x-user-roles": userRole, "x-user-id": "demo-user" },
      })
      const text = await resp.text()
      if (!text) return
      const data = JSON.parse(text)
      if (!resp.ok || !data?.ok || !Array.isArray(data.items)) return
      setNotificationLog(data.items as NotificationLogItem[])
    } catch {
      // Ignore fetch/parse errors - API may not be available
    }
  }

  useEffect(() => {
    loadNotificationLogs()
  }, [userRole])

  const liveApprovalCards = useMemo<TaskCard[]>(() => {
    return liveTaskCards.map((item) => ({
      id: `live-${item.id}`,
      backendId: item.id,
      canAct: true,
      type: "ticket",
      title: item.title,
      subtitle: item.description || "Task card from CLI-BFF",
      status: item.status === "done" ? "completed" : item.status === "in_progress" ? "processing" : "pending",
      assignee: item.assignee || "Unassigned",
      dueDate: item.status === "open" ? "Pending approval" : "In workflow",
      meta: {
        taskId: item.id.slice(0, 8),
        updated: new Date(item.updatedAt).toLocaleTimeString(),
      },
    }))
  }, [liveTaskCards])

  const emitTimeline = (payload: {
    command: string
    detail: string
    action: string
    resourceId: string
    correlationId?: string
  }) => {
    window.dispatchEvent(
      new CustomEvent("hermes:timeline", {
        detail: {
          id: `task-${Date.now()}`,
          command: payload.command,
          status: "success",
          action: payload.action,
          resourceId: payload.resourceId,
          provider: "task-panel",
          model: "n/a",
          detail: payload.detail,
          correlationId: payload.correlationId,
        },
      })
    )
  }

  const pushNotificationLog = (entry: Omit<NotificationLogItem, "id" | "at" | "createdAt">) => {
    const row: NotificationLogItem = {
      id: `notif-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      at: new Date().toISOString(),
      ...entry,
    }
    setNotificationLog((prev) => [row, ...prev].slice(0, 20))
  }

  const patchTask = async (id: string, patch: Partial<Pick<LiveTaskCard, "status" | "assignee">>, command: string, detail: string, action: string) => {
    if (userRole === "reader") return
    setActionBusy(id)
    const idempotencyKey = `${action}:${id}:${Date.now()}`
    try {
      const resp = await fetch(`/api/proxy/api/v1/task-cards/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-roles": userRole,
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ ...patch, action, detail, notify: notifyEnabled, provider: notifyProvider }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) return
      setLiveTaskCards((prev) => prev.map((item) => (item.id === id ? (data.item as LiveTaskCard) : item)))
      const notifyDetail = data.notification
        ? data.notification.ok
          ? ` | notified via ${data.notification.provider ?? "n/a"}`
          : ` | notify failed`
        : ""
      if (data.notification) {
        pushNotificationLog({
          action,
          ok: Boolean(data.notification.ok),
          provider: data.notification.provider,
          detail: data.notification.detail ?? (data.notification.ok ? "Notified" : "Notification failed"),
          correlationId: data.notification.correlationId,
        })
      }
      emitTimeline({
        command,
        detail: `${detail}${notifyDetail}`,
        action,
        resourceId: id,
        correlationId: data.notification?.correlationId,
      })
    } finally {
      setActionBusy(null)
    }
  }

  const handleApprove = (id: string) => patchTask(id, { status: "done" }, "/task approve", "Task approved and completed", "approve-task")
  const handleReject = (id: string) => patchTask(id, { status: "open" }, "/task reject", "Task rejected and returned to open state", "reject-task")
  const handleAssign = (id: string) => {
    const assignee = window.prompt("Assign task to:", "Lab Manager")?.trim()
    if (!assignee) return
    patchTask(id, { assignee, status: "in_progress" }, "/task assign", `Task assigned to ${assignee}`, "assign-task")
  }

  const loadTaskHistory = async (id: string) => {
    const resp = await fetch(`/api/proxy/api/v1/task-cards/${encodeURIComponent(id)}/history`, {
      headers: { "x-user-roles": userRole },
    })
    const data = await resp.json()
    if (!resp.ok || !data?.ok) return
    setSelectedTaskId(id)
    setHistoryItems(Array.isArray(data.history) ? data.history : [])
    setCommentItems(Array.isArray(data.comments) ? data.comments : [])
  }

  const addComment = async () => {
    if (!selectedTaskId || !commentText.trim() || userRole === "reader") return
    const idempotencyKey = `comment:${selectedTaskId}:${Date.now()}`
    const resp = await fetch(`/api/proxy/api/v1/task-cards/${encodeURIComponent(selectedTaskId)}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-roles": userRole,
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ text: commentText.trim(), notify: notifyEnabled, provider: notifyProvider }),
    })
    const data = await resp.json()
    if (!resp.ok || !data?.ok) return
    const item = data.item as LiveTaskCard
    setCommentText("")
    setCommentItems(item.comments ?? [])
    setHistoryItems(item.history ?? [])
    setLiveTaskCards((prev) => prev.map((x) => (x.id === item.id ? item : x)))
    emitTimeline({
      command: "/task comment",
      detail: `Comment added to task ${item.id.slice(0, 8)}${data.notification?.ok ? ` | notified via ${data.notification.provider ?? "n/a"}` : data.notification ? " | notify failed" : ""}`,
      action: "comment-task",
      resourceId: item.id,
      correlationId: data.notification?.correlationId,
    })
    if (data.notification) {
      pushNotificationLog({
        action: "comment-task",
        ok: Boolean(data.notification.ok),
        provider: data.notification.provider,
        detail: data.notification.detail ?? (data.notification.ok ? "Notified" : "Notification failed"),
        correlationId: data.notification.correlationId,
      })
    }
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: "approvals",
      label: "Approvals",
      icon: <CheckSquare className="h-4 w-4" />,
      count: liveApprovalCards.length || mockApprovals.length,
    },
    {
      id: "tickets",
      label: "Tickets",
      icon: <AlertTriangle className="h-4 w-4" />,
      count: mockTickets.filter((t) => t.status === "urgent").length,
    },
    {
      id: "reports",
      label: "Reports",
      icon: <FileText className="h-4 w-4" />,
      count: mockReports.filter((r) => r.status === "processing").length,
    },
  ]

  const getCurrentTasks = () => {
    switch (activeTab) {
      case "approvals":
        return liveApprovalCards.length ? liveApprovalCards : mockApprovals
      case "tickets":
        return mockTickets
      case "reports":
        return mockReports
      default:
        return []
    }
  }

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Task Panel</h2>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={notifyProvider}
            onChange={(e) => setNotifyProvider(e.target.value as "teams" | "lark" | "wecom")}
            className="rounded border border-border bg-card px-1.5 py-1 text-[10px] text-foreground"
            title="Notification channel"
          >
            <option value="teams">teams</option>
            <option value="lark">feishu</option>
            <option value="wecom">wecom</option>
          </select>
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
            />
            notify
          </label>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as "reader" | "editor" | "admin")}
            className="rounded border border-border bg-card px-1.5 py-1 text-[10px] text-foreground"
            title="Simulate role for RBAC"
          >
            <option value="reader">reader</option>
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
          <button
            onClick={loadLiveTaskCards}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-3 text-sm transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {loading && <div className="text-xs text-muted-foreground">Loading tasks...</div>}
          {getCurrentTasks().map((task) => (
            <TaskCardComponent
              key={task.id}
              task={task}
              onApprove={userRole === "reader" ? undefined : handleApprove}
              onReject={userRole === "reader" ? undefined : handleReject}
              onAssign={userRole === "reader" ? undefined : handleAssign}
              actionBusy={actionBusy}
            />
          ))}
        </div>
        {activeTab === "approvals" && liveApprovalCards.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-card p-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-foreground">Task History & Comments</div>
              <select
                value={selectedTaskId ?? ""}
                onChange={(e) => {
                  const id = e.target.value
                  if (id) loadTaskHistory(id)
                }}
                className="rounded border border-border bg-background px-1.5 py-1 text-[10px] text-foreground"
              >
                <option value="">Select task</option>
                {liveTaskCards.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id.slice(0, 8)} - {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-24 space-y-1 overflow-y-auto rounded border border-border/60 bg-muted/10 p-1.5">
              {historyItems.length === 0 ? (
                <div className="text-[10px] text-muted-foreground">No history yet.</div>
              ) : (
                historyItems.slice(-8).reverse().map((h) => (
                  <div key={h.id} className="text-[10px] text-muted-foreground">
                    <span className="text-foreground">{h.action}</span> | {h.actor} | {new Date(h.at).toLocaleTimeString()} | {h.detail}
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 max-h-20 space-y-1 overflow-y-auto rounded border border-border/60 bg-muted/10 p-1.5">
              {commentItems.length === 0 ? (
                <div className="text-[10px] text-muted-foreground">No comments yet.</div>
              ) : (
                commentItems.slice(-6).reverse().map((c) => (
                  <div key={c.id} className="text-[10px] text-muted-foreground">
                    <span className="text-foreground">{c.author}</span>: {c.text}
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={userRole === "reader" ? "Reader cannot comment" : "Add comment..."}
                disabled={userRole === "reader" || !selectedTaskId}
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground disabled:opacity-60"
              />
              <button
                onClick={addComment}
                disabled={userRole === "reader" || !selectedTaskId || !commentText.trim()}
                className="rounded border border-border px-2 py-1 text-[10px] text-foreground hover:bg-muted disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </div>
        )}
        <div className="mt-3 rounded-lg border border-border bg-card p-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-foreground">Notification Log</div>
            <div className="flex items-center gap-1.5">
              <div className="text-[10px] text-muted-foreground">{notificationLog.length} recent</div>
              <button
                onClick={async () => {
                  const resp = await fetch("/api/proxy/api/v1/notification-logs", {
                    method: "DELETE",
                    headers: { "x-user-roles": userRole, "x-user-id": "demo-user" },
                  })
                  const data = await resp.json().catch(() => ({}))
                  if (resp.ok && data?.ok) {
                    setNotificationLog([])
                  }
                }}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-border/60 bg-muted/10 p-1.5">
            {notificationLog.length === 0 ? (
              <div className="text-[10px] text-muted-foreground">No notifications yet.</div>
            ) : (
              notificationLog.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-1 text-[10px]">
                  <div className={cn("truncate", n.ok ? "text-muted-foreground" : "text-destructive")}>
                    {new Date(n.createdAt ?? n.at ?? new Date().toISOString()).toLocaleTimeString()} | {n.action} | {n.provider ?? "n/a"} | {n.detail}
                  </div>
                  {n.correlationId && (
                    <button
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("hermes:audit-open", { detail: { correlationId: n.correlationId } })
                        )
                      }
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted"
                    >
                      View Audit
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="border-t border-border p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Today&apos;s Overview</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-card p-2 text-center">
            <div className="text-lg font-semibold text-foreground">12</div>
            <div className="text-[10px] text-muted-foreground">Pending</div>
          </div>
          <div className="rounded-md bg-card p-2 text-center">
            <div className="text-lg font-semibold text-warning">3</div>
            <div className="text-[10px] text-muted-foreground">Urgent</div>
          </div>
          <div className="rounded-md bg-card p-2 text-center">
            <div className="text-lg font-semibold text-success">8</div>
            <div className="text-[10px] text-muted-foreground">Completed</div>
          </div>
        </div>
      </div>

      {/* Context Info */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">Shenzhen Lab</p>
            <p className="text-[10px] text-muted-foreground">Current Context</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
