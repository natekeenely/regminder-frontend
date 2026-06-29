"use client"

import { useEffect, useMemo, useState } from "react"
import {
  FolderKanban,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  BarChart3,
  Plus,
  Filter,
  MoreVertical,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  LayoutList,
  Kanban,
  GripVertical,
  Flag,
  User,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { GanttChart } from "@/components/cli/gantt-chart"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"
import { WorkbenchCard } from "@/components/ui/workbench-card"
import { QueryBuilder, QBField, QBGroup, createDefaultQuery } from "@/components/ui/query-builder"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"

interface Project {
  id: string
  name: string
  client: string
  type: string
  progress: number
  status: "on-track" | "at-risk" | "delayed" | "completed"
  startDate: string
  dueDate: string
  team: string[]
}

interface Task {
  id: string
  title: string
  project: string
  assignee: string
  priority: "high" | "medium" | "low"
  status: "todo" | "in-progress" | "review" | "done"
  dueDate: string
}

interface Milestone {
  id: string
  code: string
  project: string
  title: string
  status: "planned" | "active" | "done"
  dueDate: string
}

type PmEntity = "project" | "task" | "milestone"
type DrawerMode = "view" | "create" | "edit"
type AuditItem = {
  change_id: string
  entity: string
  record_id: string
  action: string
  actor: string
  changed_fields: string[]
  created_at: string
}

type StatusOption = {
  value: string
  label: string
}

const projectFieldSpecs = [
  { name: "project_code", label: "Project Code", type: "text", required: true },
  { name: "project_name", label: "Project Name", type: "text", required: true },
  { name: "client_name", label: "Client Name", type: "text", required: true },
  { name: "project_type", label: "Project Type", type: "text", required: true },
  { name: "progress", label: "Progress", type: "number", required: true },
  { name: "status", label: "Status", type: "text", required: true },
  { name: "start_date", label: "Start Date", type: "date" },
  { name: "due_date", label: "Due Date", type: "date" },
]

const taskFieldSpecs = [
  { name: "task_code", label: "Task Code", type: "text", required: true },
  { name: "project_id", label: "Project", type: "text", required: true },
  { name: "title", label: "Title", type: "text", required: true },
  { name: "assignee", label: "Assignee", type: "text", required: true },
  { name: "priority", label: "Priority", type: "text", required: true },
  { name: "status", label: "Status", type: "text", required: true },
  { name: "due_date", label: "Due Date", type: "date" },
]

const milestoneFieldSpecs = [
  { name: "milestone_code", label: "Milestone Code", type: "text", required: true },
  { name: "project_id", label: "Project", type: "text", required: true },
  { name: "title", label: "Title", type: "text", required: true },
  { name: "status", label: "Status", type: "text", required: true },
  { name: "due_date", label: "Due Date", type: "date" },
]

const mockProjects: Project[] = [
  { id: "PRJ-2024-0892", name: "TechCorp CE Certification", client: "TechCorp Ltd", type: "CE Marking", progress: 65, status: "on-track", startDate: "2024-01-01", dueDate: "2024-03-15", team: ["John W.", "Sarah L."] },
  { id: "PRJ-2024-0891", name: "Global Motors EMC Testing", client: "Global Motors", type: "EMC Testing", progress: 45, status: "at-risk", startDate: "2024-01-05", dueDate: "2024-02-28", team: ["Mike L.", "Anna K."] },
  { id: "PRJ-2024-0890", name: "MediDevice FDA Approval", client: "MediDevice AG", type: "FDA Approval", progress: 30, status: "on-track", startDate: "2024-01-10", dueDate: "2024-06-30", team: ["Dr. Chen", "Lisa W."] },
  { id: "PRJ-2024-0889", name: "SafetyFirst Product Inspection", client: "SafetyFirst Co", type: "Inspection", progress: 90, status: "on-track", startDate: "2023-12-15", dueDate: "2024-01-25", team: ["Tom H."] },
  { id: "PRJ-2024-0888", name: "ElectroParts Compliance Review", client: "ElectroParts Inc", type: "Compliance", progress: 20, status: "delayed", startDate: "2024-01-08", dueDate: "2024-02-15", team: ["James W.", "Emily R."] },
]

const mockTasks: Task[] = [
  { id: "TSK-001", title: "Complete EMC pre-scan report", project: "PRJ-2024-0891", assignee: "Mike L.", priority: "high", status: "in-progress", dueDate: "2024-01-18" },
  { id: "TSK-002", title: "Review safety documentation", project: "PRJ-2024-0892", assignee: "Sarah L.", priority: "medium", status: "todo", dueDate: "2024-01-20" },
  { id: "TSK-003", title: "Schedule client meeting", project: "PRJ-2024-0890", assignee: "Dr. Chen", priority: "low", status: "done", dueDate: "2024-01-15" },
  { id: "TSK-004", title: "Prepare test samples", project: "PRJ-2024-0888", assignee: "James W.", priority: "high", status: "todo", dueDate: "2024-01-17" },
]

const mockMilestones: Milestone[] = [
  { id: "MS-001", code: "MS-001", project: "PRJ-2024-0892", title: "Test Plan Approved", status: "active", dueDate: "2024-02-01" },
  { id: "MS-002", code: "MS-002", project: "PRJ-2024-0891", title: "Pre-scan Complete", status: "planned", dueDate: "2024-01-25" },
]

const kpiCards = [
  { label: "Active Projects", value: "47", change: "+3", changeType: "up" as const, icon: <FolderKanban className="h-5 w-5" /> },
  { label: "Due This Week", value: "6", change: "+2", changeType: "up" as const, icon: <Calendar className="h-5 w-5" /> },
  { label: "On Track", value: "89%", change: "+5%", changeType: "up" as const, icon: <Target className="h-5 w-5" /> },
  { label: "Delayed Projects", value: "2", change: "-1", changeType: "down" as const, icon: <AlertTriangle className="h-5 w-5" /> },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "on-track":
    case "done":
      return "bg-blue-100 text-blue-700"
    case "at-risk":
    case "review":
      return "bg-amber-100 text-amber-700"
    case "delayed":
      return "bg-red-100 text-red-700"
    case "completed":
      return "bg-blue-100 text-blue-700"
    case "in-progress":
      return "bg-blue-100 text-blue-700"
    case "todo":
      return "bg-gray-100 text-gray-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700"
    case "medium":
      return "bg-amber-100 text-amber-700"
    case "low":
      return "bg-blue-100 text-blue-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

const getProgressColor = (progress: number, status: string) => {
  if (status === "delayed") return "bg-red-500"
  if (status === "at-risk") return "bg-amber-500"
  if (progress >= 80) return "bg-blue-500"
  return "bg-indigo-500"
}

const projectStatusOptions: StatusOption[] = [
  { value: "on-track", label: "On Track" },
  { value: "at-risk", label: "At Risk" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
]

const taskStatusOptions: StatusOption[] = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
]

const milestoneStatusOptions: StatusOption[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "done", label: "Done" },
]

export function PmContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<"projects" | "tasks" | "gantt">("projects")
  const [taskView, setTaskView] = useState<"list" | "kanban">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [queryGroup, setQueryGroup] = useState<QBGroup>(() => createDefaultQuery([]))
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterMenuColumn, setFilterMenuColumn] = useState<string | null>(null)
  const [projectRows, setProjectRows] = useState<Project[]>(mockProjects)
  const [taskRows, setTaskRows] = useState<Task[]>(mockTasks)
  const [milestoneRows, setMilestoneRows] = useState<Milestone[]>(mockMilestones)
  const [pmLoading, setPmLoading] = useState(false)
  const [pmMessage, setPmMessage] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view")
  const [drawerEntity, setDrawerEntity] = useState<PmEntity>("project")
  const [drawerRow, setDrawerRow] = useState<Record<string, unknown> | null>(null)
  const [drawerForm, setDrawerForm] = useState<Record<string, string>>({})
  const [drawerAudit, setDrawerAudit] = useState<AuditItem[]>([])
  const [drawerAuditLoading, setDrawerAuditLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recentAudit, setRecentAudit] = useState<AuditItem[]>([])
  const [recentAuditLoading, setRecentAuditLoading] = useState(false)

  useEffect(() => {
    void loadPmData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setColumnFilters({})
    setFilterMenuColumn(null)
    setShowLeftPanel(false)
  }, [activeTab])

  async function loadPmData(): Promise<void> {
    setPmLoading(true)
    try {
      const [summaryResp, projectResp, taskResp] = await Promise.all([
        fetch("/api/proxy/api/v1/pm/summary"),
        fetch("/api/proxy/api/v1/pm/project"),
        fetch("/api/proxy/api/v1/pm/task"),
      ])
      const milestoneResp = await fetch("/api/proxy/api/v1/pm/milestone")
      const summaryData = (await summaryResp.json()) as { projects?: number; tasks?: number; milestones?: number; byStatus?: Record<string, unknown> }
      const projectData = (await projectResp.json()) as { items?: Array<Record<string, unknown>> }
      const taskData = (await taskResp.json()) as { items?: Array<Record<string, unknown>> }
      const milestoneData = (await milestoneResp.json()) as { items?: Array<Record<string, unknown>> }
      setProjectRows(
        (projectData.items ?? []).map((item) => ({
          id: String(item.project_code ?? item.project_id ?? "-"),
          name: String(item.project_name ?? "-"),
          client: String(item.client_name ?? "-"),
          type: String(item.project_type ?? "-"),
          progress: Number(item.progress ?? 0),
          status: String(item.status ?? "on-track") as Project["status"],
          startDate: String(item.start_date ?? "-"),
          dueDate: String(item.due_date ?? "-"),
          team: Array.isArray(item.team) ? (item.team as string[]) : [],
        }))
      )
      setTaskRows(
        (taskData.items ?? []).map((item) => ({
          id: String(item.task_code ?? item.task_id ?? "-"),
          title: String(item.title ?? "-"),
          project: String(item.project_id ?? "-"),
          assignee: String(item.assignee ?? "-"),
          priority: String(item.priority ?? "medium") as Task["priority"],
          status: String(item.status ?? "todo") as Task["status"],
          dueDate: String(item.due_date ?? "-"),
        }))
      )
      setMilestoneRows(
        (milestoneData.items ?? []).map((item) => ({
          id: String(item.milestone_code ?? item.milestone_id ?? "-"),
          code: String(item.milestone_code ?? item.milestone_id ?? "-"),
          project: String(item.project_id ?? "-"),
          title: String(item.title ?? "-"),
          status: String(item.status ?? "planned") as Milestone["status"],
          dueDate: String(item.due_date ?? "-"),
        }))
      )
      setPmMessage(
        `Live PM summary: ${summaryData.projects ?? 0} projects, ${summaryData.tasks ?? 0} tasks, ${summaryData.milestones ?? 0} milestones.`
      )
      void loadRecentAudit()
    } catch (error) {
      setPmMessage(error instanceof Error ? error.message : "Failed to load PM data")
      setProjectRows(mockProjects)
      setTaskRows(mockTasks)
      setMilestoneRows(mockMilestones)
    } finally {
      setPmLoading(false)
    }
  }

  async function loadRecentAudit(): Promise<void> {
    setRecentAuditLoading(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/pm/changelog?limit=8")
      const data = (await resp.json()) as { items?: AuditItem[] }
      setRecentAudit(Array.isArray(data.items) ? data.items : [])
    } catch {
      setRecentAudit([])
    } finally {
      setRecentAuditLoading(false)
    }
  }

  function specFor(entity: PmEntity) {
    if (entity === "task") return taskFieldSpecs
    if (entity === "milestone") return milestoneFieldSpecs
    return projectFieldSpecs
  }

  function openDrawer(entity: PmEntity, mode: DrawerMode, row?: Record<string, unknown> | null): void {
    setDrawerEntity(entity)
    setDrawerMode(mode)
    setDrawerRow(row ?? null)
    const spec = specFor(entity)
    const form: Record<string, string> = {}
    for (const field of spec) {
      const value = row ? row[field.name] : ""
      form[field.name] = value === undefined || value === null ? "" : String(value)
    }
    if (mode === "create") {
      if (entity === "project") {
        form.project_code = `PRJ-${Date.now()}`
        form.status = "on-track"
      }
      if (entity === "task") {
        form.task_code = `TSK-${Date.now()}`
        form.project_id = projectRows[0]?.id ?? ""
        form.priority = "medium"
        form.status = "todo"
      }
      if (entity === "milestone") {
        form.milestone_code = `MS-${Date.now()}`
        form.project_id = projectRows[0]?.id ?? ""
        form.status = "planned"
      }
      form.due_date = new Date().toISOString().slice(0, 10)
      form.start_date = form.start_date ?? new Date().toISOString().slice(0, 10)
    }
    setDrawerForm(form)
    setDrawerOpen(true)
  }

  function closeDrawer(): void {
    setDrawerOpen(false)
    setDrawerRow(null)
    setDrawerAudit([])
  }

  async function loadDrawerAudit(entity: PmEntity, row: Record<string, unknown> | null): Promise<void> {
    setDrawerAuditLoading(true)
    try {
      const idColumn = entity === "project" ? "project_id" : entity === "task" ? "task_id" : "milestone_id"
      const codeColumn = entity === "project" ? "project_code" : entity === "task" ? "task_code" : "milestone_code"
      const recordId = row ? String(row[idColumn] ?? row[codeColumn] ?? "") : ""
      const params = new URLSearchParams({ entity, limit: "8" })
      if (recordId) params.set("record_id", recordId)
      const resp = await fetch(`/api/proxy/api/v1/pm/changelog?${params.toString()}`)
      const data = (await resp.json()) as { items?: AuditItem[] }
      setDrawerAudit(Array.isArray(data.items) ? data.items : [])
    } catch {
      setDrawerAudit([])
    } finally {
      setDrawerAuditLoading(false)
    }
  }

  useEffect(() => {
    if (drawerOpen) setShowLeftPanel(false)
  }, [drawerOpen])

  useEffect(() => {
    if (!drawerOpen) return
    void loadDrawerAudit(drawerEntity, drawerRow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, drawerEntity, drawerRow?.project_id, drawerRow?.task_id, drawerRow?.milestone_id])

  function drawerIdColumn(entity: PmEntity): string {
    return entity === "project" ? "project_id" : entity === "task" ? "task_id" : "milestone_id"
  }

  function drawerCodeColumn(entity: PmEntity): string {
    return entity === "project" ? "project_code" : entity === "task" ? "task_code" : "milestone_code"
  }

  function drawerTitle(): string {
    const label = drawerEntity === "project" ? "Project" : drawerEntity === "task" ? "Task" : "Milestone"
    if (drawerMode === "create") return `Create ${label}`
    if (drawerMode === "edit") return `Edit ${label}`
    return `${label} Details`
  }

  function drawerSubtitle(): string {
    if (drawerMode === "create") return `Create a new ${drawerEntity} record in PM.`
    if (drawerMode === "edit") return `Update the selected ${drawerEntity} record and keep the live audit trail intact.`
    return `Inspect the live ${drawerEntity} record, related rows, and audit trail.`
  }

  async function saveDrawer(): Promise<void> {
    setSubmitting(true)
    try {
      const entity = drawerEntity
      const payload = { ...drawerForm }
      if (entity === "project") {
        payload.progress = String(payload.progress ?? "0")
      }
      const isCreate = drawerMode === "create"
      const url = isCreate
        ? `/api/proxy/api/v1/pm/${encodeURIComponent(entity)}`
        : `/api/proxy/api/v1/pm/${encodeURIComponent(entity)}/${encodeURIComponent(String(drawerRow?.[drawerIdColumn(entity)] ?? ""))}`
      const resp = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      if (!resp.ok || data?.ok === false) throw new Error(data?.detail ?? "Unable to save PM record")
      await loadPmData()
      setPmMessage(`${entity} saved successfully.`)
      closeDrawer()
    } catch (error) {
      setPmMessage(error instanceof Error ? error.message : "Failed to save PM record")
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteDrawer(): Promise<void> {
    if (!drawerRow) return
    setSubmitting(true)
    try {
      const entity = drawerEntity
      const resp = await fetch(`/api/proxy/api/v1/pm/${encodeURIComponent(entity)}/${encodeURIComponent(String(drawerRow[drawerIdColumn(entity)] ?? ""))}`, {
        method: "DELETE",
      })
      const data = await resp.json()
      if (!resp.ok || data?.ok === false) throw new Error(data?.detail ?? "Unable to delete PM record")
      await loadPmData()
      setPmMessage(`${entity} deleted successfully.`)
      closeDrawer()
    } catch (error) {
      setPmMessage(error instanceof Error ? error.message : "Failed to delete PM record")
    } finally {
      setSubmitting(false)
    }
  }

  async function updateDrawerStatus(nextStatus: string): Promise<void> {
    if (!drawerRow || submitting) return
    setSubmitting(true)
    try {
      const entity = drawerEntity
      const resp = await fetch(`/api/proxy/api/v1/pm/${encodeURIComponent(entity)}/${encodeURIComponent(String(drawerRow[drawerIdColumn(entity)] ?? ""))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await resp.json()
      if (!resp.ok || data?.ok === false) throw new Error(data?.detail ?? "Unable to update PM status")
      await loadPmData()
      setPmMessage(`${entity} status updated to ${nextStatus}.`)
      setDrawerRow(data.item ?? drawerRow)
      setDrawerForm((current) => ({ ...current, status: nextStatus }))
    } catch (error) {
      setPmMessage(error instanceof Error ? error.message : "Failed to update PM status")
    } finally {
      setSubmitting(false)
    }
  }

  function projectToRecord(project: Project): Record<string, unknown> {
    return {
      project_id: project.id,
      project_code: project.id,
      project_name: project.name,
      client_name: project.client,
      project_type: project.type,
      progress: project.progress,
      status: project.status,
      start_date: project.startDate,
      due_date: project.dueDate,
      team: project.team,
    }
  }

  function taskToRecord(task: Task): Record<string, unknown> {
    return {
      task_id: task.id,
      task_code: task.id,
      project_id: task.project,
      title: task.title,
      assignee: task.assignee,
      priority: task.priority,
      status: task.status,
      due_date: task.dueDate,
    }
  }

  function milestoneToRecord(milestone: Milestone): Record<string, unknown> {
    return {
      milestone_id: milestone.id,
      milestone_code: milestone.code,
      project_id: milestone.project,
      title: milestone.title,
      status: milestone.status,
      due_date: milestone.dueDate,
    }
  }

  const kanbanColumns: { id: Task["status"]; label: string; color: string; headerBg: string }[] = [
    { id: "todo",        label: "To Do",       color: "text-gray-600",   headerBg: "bg-gray-100"   },
    { id: "in-progress", label: "In Progress",  color: "text-blue-600",   headerBg: "bg-blue-50"    },
    { id: "review",      label: "Review",       color: "text-amber-600",  headerBg: "bg-amber-50"   },
    { id: "done",        label: "Done",         color: "text-blue-600",  headerBg: "bg-blue-50"   },
  ]

  const tasksByStatus = (status: Task["status"]) =>
    taskRows.filter((t) => {
      if (t.status !== status) return false
      if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String((t as unknown as Record<string, unknown>)[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
      if (searchQuery === "") return true
      return t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.assignee.toLowerCase().includes(searchQuery.toLowerCase())
    })

  const projectRowsFiltered = useMemo(
    () =>
      projectRows.filter((row) => {
        if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String((row as unknown as Record<string, unknown>)[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
        if (!searchQuery.trim()) return true
        const q = searchQuery.trim().toLowerCase()
        return [row.id, row.name, row.client, row.type, row.status, row.dueDate, ...row.team].some((value) =>
          String(value).toLowerCase().includes(q)
        )
      }),
    [projectRows, searchQuery, columnFilters]
  )

  const taskRowsFiltered = useMemo(
    () =>
      taskRows.filter((row) => {
        if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String((row as unknown as Record<string, unknown>)[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
        if (!searchQuery.trim()) return true
        const q = searchQuery.trim().toLowerCase()
        return [row.id, row.title, row.project, row.assignee, row.priority, row.status, row.dueDate].some((value) =>
          String(value).toLowerCase().includes(q)
        )
      }),
    [taskRows, searchQuery, columnFilters]
  )

  const milestoneRowsFiltered = useMemo(
    () =>
      milestoneRows.filter((row) => {
        if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String((row as unknown as Record<string, unknown>)[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
        if (!searchQuery.trim()) return true
        const q = searchQuery.trim().toLowerCase()
        return [row.id, row.code, row.project, row.title, row.status, row.dueDate].some((value) =>
          String(value).toLowerCase().includes(q)
        )
      }),
    [milestoneRows, searchQuery, columnFilters]
  )

  const drawerLabel = drawerEntity === "project" ? "Project" : drawerEntity === "task" ? "Task" : "Milestone"
  const drawerRecordId = String(drawerRow?.[drawerIdColumn(drawerEntity)] ?? drawerRow?.[drawerCodeColumn(drawerEntity)] ?? "")
  const drawerProjectId = drawerEntity === "project" ? drawerRecordId : String(drawerRow?.project_id ?? "")
  const drawerProject = projectRows.find((row) => row.id === drawerProjectId) ?? null
  const drawerTasks = drawerProjectId ? taskRows.filter((row) => row.project === drawerProjectId) : []
  const drawerMilestones = drawerProjectId ? milestoneRows.filter((row) => row.project === drawerProjectId) : []
  const drawerSiblingTasks = drawerRecordId ? drawerTasks.filter((row) => row.id !== drawerRecordId) : drawerTasks
  const drawerSiblingMilestones = drawerRecordId ? drawerMilestones.filter((row) => row.id !== drawerRecordId) : drawerMilestones
  const drawerStatusOptions =
    drawerEntity === "project"
      ? projectStatusOptions
      : drawerEntity === "task"
        ? taskStatusOptions
        : milestoneStatusOptions
  const drawerCurrentStatus = String(drawerRow?.status ?? drawerForm.status ?? "")

  const queryFields: QBField[] = useMemo(() => {
    if (activeTab === "tasks") {
      return [
        { field: "id", label: "Task ID", type: "string" },
        { field: "title", label: "Title", type: "string" },
        { field: "project", label: "Project", type: "string" },
        { field: "assignee", label: "Assignee", type: "string" },
        { field: "priority", label: "Priority", type: "select", options: ["high", "medium", "low"] },
        { field: "status", label: "Status", type: "select", options: ["todo", "in-progress", "review", "done"] },
        { field: "dueDate", label: "Due Date", type: "date" },
      ]
    }
    // projects tab (default) — also covers milestones shown under projects
    return [
      { field: "id", label: "Project ID", type: "string" },
      { field: "name", label: "Name", type: "string" },
      { field: "client", label: "Client", type: "string" },
      { field: "progress", label: "Progress", type: "number" },
      { field: "status", label: "Status", type: "select", options: ["on-track", "at-risk", "delayed", "completed"] },
      { field: "dueDate", label: "Due Date", type: "date" },
      { field: "team", label: "Team", type: "string" },
    ]
  }, [activeTab])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">PM Project Management</h1>
              <p className="text-sm text-muted-foreground">Track projects, tasks, and deliverables</p>
            </div>
          </div>
          {!drawerOpen && (
          <button
            onClick={() => setShowLeftPanel((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${showLeftPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Query
          </button>
          )}
          <Button onClick={() => void loadPmData()} variant="outline" size="sm" className="h-9 gap-2 px-3 text-xs">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => openDrawer(activeTab === "gantt" ? "project" : activeTab === "tasks" ? "task" : "project", "create")} className="ml-2 h-9 gap-2 px-4 text-sm font-medium">
            <Plus className="h-4 w-4" />
            {activeTab === "tasks" ? "New Task" : "New Project"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  {kpi.icon}
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  kpi.changeType === "up" ? "text-blue-600" : kpi.changeType === "down" ? "text-red-600" : "text-muted-foreground"
                )}>
                  {kpi.changeType === "up" ? <ArrowUpRight className="h-3 w-3" /> : kpi.changeType === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
                  {kpi.change}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
          {pmLoading ? "Loading live PM data..." : pmMessage}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex gap-6">
          {[
            { id: "projects", label: "Projects", count: 47 },
            { id: "tasks", label: "Tasks", count: 124 },
            { id: "gantt", label: "Gantt Chart", count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt full-height — rendered outside the padded scroll area */}
      {activeTab === "gantt" && (
        <div className="flex-1 overflow-hidden">
          <GanttChart />
        </div>
      )}

      {/* Content with Query panel */}
      <div className={cn("flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto", activeTab === "gantt" && "hidden")}>
        {showLeftPanel && (
          <aside className="relative w-[342px] shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden p-4">
            <WorkbenchCard title="Query Conditions" badge={`${queryGroup.conditions.length + queryGroup.groups.length} rules`}>
              <QueryBuilder fields={queryFields} query={queryGroup} onChange={setQueryGroup} storageKey={`qb.pm.${activeTab}`} />
            </WorkbenchCard>
          </aside>
        )}
        <div className="flex-1 overflow-auto p-6">
        {activeTab === "projects" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card">
              <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  {([["id", "Project ID"], ["name", "Name"], ["client", "Client"], ["progress", "Progress"], ["status", "Status"], ["dueDate", "Due Date"], ["team", "Team"]] as const).map(([field, label]) => (
                    <th key={field} className="relative px-4 py-3">
                      <button className="inline-flex items-center gap-1" onClick={() => setFilterMenuColumn(filterMenuColumn === `project_${field}` ? null : `project_${field}`)}>
                        {label}
                        <Filter className={cn("h-3 w-3", columnFilters[field] ? "text-primary" : "text-muted-foreground/50")} />
                      </button>
                      {filterMenuColumn === `project_${field}` && (
                        <ColumnFilterPopover
                          column={field}
                          label={label}
                          value={columnFilters[field] ?? ""}
                          onChange={(val) => setColumnFilters((prev) => ({ ...prev, [field]: val }))}
                          onClear={() => setColumnFilters((prev) => { const next = { ...prev }; delete next[field]; return next })}
                          onClose={() => setFilterMenuColumn(null)}
                        />
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projectRowsFiltered.map((project) => (
                  <tr
                    key={project.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onDoubleClick={() =>
                      openDrawer(
                        "project",
                        "view",
                        projectRows.find((row) => row.id === project.id)
                          ? {
                              project_id: project.id,
                              project_code: project.id,
                              project_name: project.name,
                              client_name: project.client,
                              project_type: project.type,
                              progress: project.progress,
                              status: project.status,
                              start_date: project.startDate,
                              due_date: project.dueDate,
                              team: project.team,
                            }
                          : null
                      )
                    }
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary">{project.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{project.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{project.client}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", getProgressColor(project.progress, project.status))}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(project.status))}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{project.dueDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex -space-x-2">
                        {project.team.slice(0, 3).map((member, i) => (
                          <div
                            key={i}
                            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground"
                            title={member}
                          >
                            {member.charAt(0)}
                          </div>
                        ))}
                        {project.team.length > 3 && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                            +{project.team.length - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => openDrawer("project", "view", { project_id: project.id, project_code: project.id, project_name: project.name, client_name: project.client, project_type: project.type, progress: project.progress, status: project.status, start_date: project.startDate, due_date: project.dueDate, team: project.team })}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => openDrawer("project", "edit", { project_id: project.id, project_code: project.id, project_name: project.name, client_name: project.client, project_type: project.type, progress: project.progress, status: project.status, start_date: project.startDate, due_date: project.dueDate, team: project.team })}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => openDrawer("project", "view", { project_id: project.id, project_code: project.id, project_name: project.name, client_name: project.client, project_type: project.type, progress: project.progress, status: project.status, start_date: project.startDate, due_date: project.dueDate, team: project.team })}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Milestones</div>
                  <div className="text-xs text-muted-foreground">Live milestones linked to projects.</div>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => openDrawer("milestone", "create")}>
                  <Plus className="h-3.5 w-3.5" />
                  New Milestone
                </Button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    {([["code", "Code"], ["title", "Title"], ["project", "Project"], ["status", "Status"], ["dueDate", "Due Date"]] as const).map(([field, label]) => (
                      <th key={field} className="relative px-4 py-3">
                        <button className="inline-flex items-center gap-1" onClick={() => setFilterMenuColumn(filterMenuColumn === `milestone_${field}` ? null : `milestone_${field}`)}>
                          {label}
                          <Filter className={cn("h-3 w-3", columnFilters[field] ? "text-primary" : "text-muted-foreground/50")} />
                        </button>
                        {filterMenuColumn === `milestone_${field}` && (
                          <ColumnFilterPopover
                            column={field}
                            label={label}
                            value={columnFilters[field] ?? ""}
                            onChange={(val) => setColumnFilters((prev) => ({ ...prev, [field]: val }))}
                            onClear={() => setColumnFilters((prev) => { const next = { ...prev }; delete next[field]; return next })}
                            onClose={() => setFilterMenuColumn(null)}
                          />
                        )}
                      </th>
                    ))}
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {milestoneRowsFiltered.slice(0, 6).map((milestone) => (
                    <tr key={milestone.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-primary">{milestone.code}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{milestone.title}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{milestone.project}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(milestone.status))}>
                          {milestone.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{milestone.dueDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => openDrawer("milestone", "view", {
                              milestone_id: milestone.id,
                              milestone_code: milestone.code,
                              project_id: milestone.project,
                              title: milestone.title,
                              status: milestone.status,
                              due_date: milestone.dueDate,
                            })}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => openDrawer("milestone", "edit", {
                              milestone_id: milestone.id,
                              milestone_code: milestone.code,
                              project_id: milestone.project,
                              title: milestone.title,
                              status: milestone.status,
                              due_date: milestone.dueDate,
                            })}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "tasks" && taskView === "list" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  {([["id", "Task ID"], ["title", "Title"], ["project", "Project"], ["assignee", "Assignee"], ["priority", "Priority"], ["status", "Status"], ["dueDate", "Due Date"]] as const).map(([field, label]) => (
                    <th key={field} className="relative px-4 py-3">
                      <button className="inline-flex items-center gap-1" onClick={() => setFilterMenuColumn(filterMenuColumn === `task_${field}` ? null : `task_${field}`)}>
                        {label}
                        <Filter className={cn("h-3 w-3", columnFilters[field] ? "text-primary" : "text-muted-foreground/50")} />
                      </button>
                      {filterMenuColumn === `task_${field}` && (
                        <ColumnFilterPopover
                          column={field}
                          label={label}
                          value={columnFilters[field] ?? ""}
                          onChange={(val) => setColumnFilters((prev) => ({ ...prev, [field]: val }))}
                          onClear={() => setColumnFilters((prev) => { const next = { ...prev }; delete next[field]; return next })}
                          onClose={() => setFilterMenuColumn(null)}
                        />
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taskRowsFiltered.map((task) => (
                  <tr
                    key={task.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onDoubleClick={() =>
                      openDrawer("task", "view", {
                        task_id: task.id,
                        task_code: task.id,
                        project_id: task.project,
                        title: task.title,
                        assignee: task.assignee,
                        priority: task.priority,
                        status: task.status,
                        due_date: task.dueDate,
                      })
                    }
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary">{task.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{task.title}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{task.project}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{task.assignee}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getPriorityColor(task.priority))}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(task.status))}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{task.dueDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => openDrawer("task", "view", { task_id: task.id, task_code: task.id, project_id: task.project, title: task.title, assignee: task.assignee, priority: task.priority, status: task.status, due_date: task.dueDate })}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => openDrawer("task", "edit", { task_id: task.id, task_code: task.id, project_id: task.project, title: task.title, assignee: task.assignee, priority: task.priority, status: task.status, due_date: task.dueDate })}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "tasks" && taskView === "kanban" && (
          <div className="flex h-full gap-4 overflow-x-auto pb-4">
            {kanbanColumns.map((col) => {
              const tasks = tasksByStatus(col.id)
              return (
                <div key={col.id} className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-border bg-muted/30">
                  {/* Column header */}
                  <div className={cn("flex items-center justify-between rounded-t-xl px-4 py-3", col.headerBg)}>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                      <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold", col.color, col.headerBg === "bg-gray-100" ? "bg-gray-200" : col.headerBg.replace("50", "100"))}>
                        {tasks.length}
                      </span>
                    </div>
                    <button className="rounded p-1 text-muted-foreground hover:bg-white/60 hover:text-foreground">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
                    {tasks.length === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
                        <Kanban className="mb-2 h-6 w-6 text-muted-foreground/50" />
                        <p className="text-xs text-muted-foreground">No tasks</p>
                      </div>
                    )}
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="group cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                      >
                        {/* Card top: id + drag handle */}
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-primary">{task.id}</span>
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
                        </div>

                        {/* Title */}
                        <p className="mb-3 text-sm font-medium leading-snug text-foreground">{task.title}</p>

                        {/* Project tag */}
                        <div className="mb-3 text-[11px] text-muted-foreground">{task.project}</div>

                        {/* Footer: priority, assignee, due */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", getPriorityColor(task.priority))}>
                              <Flag className="h-3 w-3" />
                              {task.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{task.dueDate}</span>
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
                              title={task.assignee}
                            >
                              {task.assignee.charAt(0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add task button */}
                    <button
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      onClick={() => openDrawer("task", "create")}
                    >
                      <Plus className="h-4 w-4" />
                      Add task
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Recent Audit</div>
                <div className="text-xs text-muted-foreground">Latest changes across PM records.</div>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => void loadRecentAudit()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
            <div className="space-y-2 p-4">
              {recentAuditLoading ? (
                <div className="text-sm text-muted-foreground">Loading audit trail...</div>
              ) : recentAudit.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  No recent PM audit events found.
                </div>
              ) : (
                recentAudit.slice(0, 4).map((item) => (
                  <button
                    key={item.change_id}
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/40"
                    onClick={() => {
                      const entity = item.entity as PmEntity
                      const matched =
                        entity === "project"
                          ? projectRows.find((row) => row.id === item.record_id)
                          : entity === "task"
                            ? taskRows.find((row) => row.id === item.record_id)
                            : milestoneRows.find((row) => row.id === item.record_id)
                      if (matched) {
                        openDrawer(
                          entity,
                          "view",
                          entity === "project"
                            ? projectToRecord(matched as Project)
                            : entity === "task"
                              ? taskToRecord(matched as Task)
                              : milestoneToRecord(matched as Milestone)
                        )
                      }
                    }}
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {item.entity} {item.action}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.actor} • {item.record_id} • {item.created_at.slice(0, 19).replace("T", " ")}
                      </div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      {item.changed_fields.slice(0, 2).join(", ") || "fields"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">PM Status Snapshot</div>
              <div className="text-xs text-muted-foreground">Live project, task, and milestone context.</div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Projects</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{projectRows.length}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Tasks</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{taskRows.length}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Milestones</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{milestoneRows.length}</div>
              </div>
            </div>
          </div>
        </div>

        <Drawer open={drawerOpen} onOpenChange={(open) => (open ? setDrawerOpen(true) : closeDrawer())} direction="right">
          <DrawerContent className="w-full data-[vaul-drawer-direction=right]:w-[min(100vw,880px)] data-[vaul-drawer-direction=right]:sm:max-w-none">
            <div className="flex h-full flex-col">
              <DrawerHeader className="border-b border-border px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DrawerTitle className="text-xl">{drawerTitle()}</DrawerTitle>
                    <DrawerDescription className="mt-1">{drawerSubtitle()}</DrawerDescription>
                  </div>
                  <DrawerClose asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3" onClick={closeDrawer}>
                      <X className="h-4 w-4" />
                      Close
                    </Button>
                  </DrawerClose>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {drawerMode === "view" ? (
                    <>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3" onClick={() => setDrawerMode("edit")}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void deleteDrawer()}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button className="h-9 gap-1.5 px-4" onClick={() => void saveDrawer()} disabled={submitting}>
                        <Save className="h-4 w-4" />
                        {submitting ? "Saving..." : "Save"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3" onClick={() => setDrawerMode("view")}>
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="text-sm font-semibold text-foreground">Record Overview</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Identifier</div>
                          <div className="mt-1 text-sm font-medium text-foreground">{drawerRecordId || "(new)"}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Project Link</div>
                          <div className="mt-1 text-sm font-medium text-foreground">{drawerProjectId || "-"}</div>
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg border border-border bg-muted/10 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Quick Status</div>
                            <div className="mt-1 text-sm font-medium text-foreground">{drawerCurrentStatus || "draft"}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {drawerStatusOptions.map((option) => {
                              const active = drawerCurrentStatus === option.value
                              return (
                                <Button
                                  key={option.value}
                                  variant={active ? "default" : "outline"}
                                  size="sm"
                                  className={cn(
                                    "h-8 px-3 text-xs",
                                    active && "bg-primary text-primary-foreground hover:bg-primary/90"
                                  )}
                                  disabled={submitting || active}
                                  onClick={() => void updateDrawerStatus(option.value)}
                                >
                                  {option.label}
                                </Button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {drawerMode === "view" ? (
                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="text-sm font-semibold text-foreground">Details</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {specFor(drawerEntity).map((field) => (
                            <div key={field.name} className="rounded-lg border border-border bg-muted/20 p-3">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{field.label}</div>
                              <div className="mt-1 text-sm text-foreground">{String(drawerRow?.[field.name] ?? "-")}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="text-sm font-semibold text-foreground">Edit Form</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {specFor(drawerEntity).map((field) => (
                            <label key={field.name} className="space-y-1.5">
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{field.label}</span>
                              {field.type === "number" ? (
                                <input
                                  type="number"
                                  value={drawerForm[field.name] ?? ""}
                                  onChange={(e) => setDrawerForm((current) => ({ ...current, [field.name]: e.target.value }))}
                                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                                />
                              ) : field.type === "date" ? (
                                <input
                                  type="date"
                                  value={drawerForm[field.name] ?? ""}
                                  onChange={(e) => setDrawerForm((current) => ({ ...current, [field.name]: e.target.value }))}
                                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={drawerForm[field.name] ?? ""}
                                  onChange={(e) => setDrawerForm((current) => ({ ...current, [field.name]: e.target.value }))}
                                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-foreground">Related Records</div>
                          <div className="text-xs text-muted-foreground">Linked rows from the live PM backend.</div>
                        </div>
                        {drawerEntity !== "milestone" && (
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => openDrawer("milestone", "create")}>
                            <Plus className="h-3.5 w-3.5" />
                            New Milestone
                          </Button>
                        )}
                      </div>
                      <div className="mt-4 space-y-4">
                        {drawerEntity === "project" ? (
                          <>
                            <RelatedTable
                              title="Related Tasks"
                              rows={drawerTasks}
                              onOpen={(row) => openDrawer("task", "view", taskToRecord(row))}
                              onEdit={(row) => openDrawer("task", "edit", taskToRecord(row))}
                            />
                            <RelatedTable
                              title="Related Milestones"
                              rows={drawerMilestones}
                              onOpen={(row) => openDrawer("milestone", "view", milestoneToRecord(row))}
                              onEdit={(row) => openDrawer("milestone", "edit", milestoneToRecord(row))}
                            />
                          </>
                        ) : drawerEntity === "task" ? (
                          <>
                            <RelatedTable
                              title="Related Project"
                              rows={drawerProject ? [drawerProject] : []}
                              onOpen={(row) => openDrawer("project", "view", projectToRecord(row))}
                              onEdit={(row) => openDrawer("project", "edit", projectToRecord(row))}
                            />
                            <RelatedTable
                              title="Sibling Tasks"
                              rows={drawerSiblingTasks}
                              onOpen={(row) => openDrawer("task", "view", taskToRecord(row))}
                              onEdit={(row) => openDrawer("task", "edit", taskToRecord(row))}
                            />
                            <RelatedTable
                              title="Project Milestones"
                              rows={drawerMilestones}
                              onOpen={(row) => openDrawer("milestone", "view", milestoneToRecord(row))}
                              onEdit={(row) => openDrawer("milestone", "edit", milestoneToRecord(row))}
                            />
                          </>
                        ) : (
                          <>
                            <RelatedTable
                              title="Related Project"
                              rows={drawerProject ? [drawerProject] : []}
                              onOpen={(row) => openDrawer("project", "view", projectToRecord(row))}
                              onEdit={(row) => openDrawer("project", "edit", projectToRecord(row))}
                            />
                            <RelatedTable
                              title="Sibling Milestones"
                              rows={drawerSiblingMilestones}
                              onOpen={(row) => openDrawer("milestone", "view", milestoneToRecord(row))}
                              onEdit={(row) => openDrawer("milestone", "edit", milestoneToRecord(row))}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">Live Audit Trail</div>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => void loadDrawerAudit(drawerEntity, drawerRow)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                          Refresh
                        </Button>
                      </div>
                      <div className="mt-4 space-y-2">
                        {drawerAuditLoading ? (
                          <div className="text-sm text-muted-foreground">Loading audit trail...</div>
                        ) : drawerAudit.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                            No audit events for this record yet.
                          </div>
                        ) : (
                          drawerAudit.map((item) => (
                            <div key={item.change_id} className="rounded-lg border border-border bg-muted/20 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-foreground">{item.action}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.actor} • {item.created_at.slice(0, 19).replace("T", " ")}
                                  </div>
                                </div>
                                <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                  {item.changed_fields.length} fields
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {item.changed_fields.length > 0 ? item.changed_fields.join(", ") : "No changed fields"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="text-sm font-semibold text-foreground">PM Snapshot</div>
                      <div className="mt-3 grid gap-3">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Record Type</div>
                          <div className="mt-1 text-sm font-medium text-foreground">{drawerLabel}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</div>
                          <div className="mt-1 text-sm font-medium text-foreground">{String(drawerRow?.status ?? "draft")}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Linked Project</div>
                          <div className="mt-1 text-sm font-medium text-foreground">{drawerProjectId || "-"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DrawerFooter className="border-t border-border px-6 py-4">
                <div className="flex w-full items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {drawerMode === "view" ? "Double-click rows to open linked PM records." : "Changes will persist to the live PM backend."}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3" onClick={closeDrawer}>
                      Close
                    </Button>
                  </div>
                </div>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
        </div>
      </div>
    </div>
  )
}

function RelatedTable({
  title,
  rows,
  onOpen,
  onEdit,
}: {
  title: string
  rows: any[]
  onOpen: (row: any) => void
  onEdit: (row: any) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/10">
      <div className="border-b border-border px-3 py-2">
        <div className="text-sm font-medium text-foreground">{title}</div>
      </div>
      <div className="space-y-2 p-3">
        {rows.length === 0 ? (
          <div className="text-xs text-muted-foreground">No related records.</div>
        ) : (
          rows.slice(0, 4).map((row) => {
            const id = String(row.project_code ?? row.task_code ?? row.milestone_code ?? row.project_name ?? row.title ?? row.id ?? row.project_id ?? "-")
            const subtitle = String(row.project_name ?? row.title ?? row.client_name ?? row.assignee ?? row.project_id ?? "-")
            return (
              <div key={id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-foreground">{id}</div>
                  <div className="text-xs text-muted-foreground">{subtitle}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => onOpen(row)}>
                    <Eye className="h-3.5 w-3.5" />
                    Open
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => onEdit(row)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
