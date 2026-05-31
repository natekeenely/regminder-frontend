"use client"

import { useState } from "react"
import {
  FolderKanban,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  BarChart3,
  Plus,
  Search,
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { GanttChart } from "@/components/cli/gantt-chart"

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
      return "bg-green-100 text-green-700"
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
      return "bg-green-100 text-green-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

const getProgressColor = (progress: number, status: string) => {
  if (status === "delayed") return "bg-red-500"
  if (status === "at-risk") return "bg-amber-500"
  if (progress >= 80) return "bg-green-500"
  return "bg-indigo-500"
}

export function PmContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<"projects" | "tasks" | "gantt">("projects")
  const [taskView, setTaskView] = useState<"list" | "kanban">("list")
  const [searchQuery, setSearchQuery] = useState("")

  const kanbanColumns: { id: Task["status"]; label: string; color: string; headerBg: string }[] = [
    { id: "todo",        label: "To Do",       color: "text-gray-600",   headerBg: "bg-gray-100"   },
    { id: "in-progress", label: "In Progress",  color: "text-blue-600",   headerBg: "bg-blue-50"    },
    { id: "review",      label: "Review",       color: "text-amber-600",  headerBg: "bg-amber-50"   },
    { id: "done",        label: "Done",         color: "text-green-600",  headerBg: "bg-green-50"   },
  ]

  const tasksByStatus = (status: Task["status"]) =>
    mockTasks.filter((t) => t.status === status && (
      searchQuery === "" ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignee.toLowerCase().includes(searchQuery.toLowerCase())
    ))

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
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
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New Project
          </button>
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
                  kpi.changeType === "up" ? "text-green-600" : kpi.changeType === "down" ? "text-red-600" : "text-muted-foreground"
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

      {/* Search and Filter — hidden on Gantt tab (has its own toolbar) */}
      <div className={cn("flex items-center gap-3 border-b border-border px-6 py-3", activeTab === "gantt" && "hidden")}>
        {/* View toggle — only on tasks tab, placed before search */}
        {activeTab === "tasks" && (
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1">
            <button
              onClick={() => setTaskView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                taskView === "list"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setTaskView("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                taskView === "kanban"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Kanban className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      {/* Gantt full-height — rendered outside the padded scroll area */}
      {activeTab === "gantt" && (
        <div className="flex-1 overflow-hidden">
          <GanttChart />
        </div>
      )}

      {/* Content */}
      <div className={cn("flex-1 overflow-auto p-6", activeTab === "gantt" && "hidden")}>
        {activeTab === "projects" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Project ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockProjects.map((project) => (
                  <tr key={project.id} className="border-b border-border last:border-0 hover:bg-muted/30">
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
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Eye className="h-4 w-4" />
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

        {activeTab === "tasks" && taskView === "list" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Task ID</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockTasks.map((task) => (
                  <tr key={task.id} className="border-b border-border last:border-0 hover:bg-muted/30">
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
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Eye className="h-4 w-4" />
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
                    <button className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
                      <Plus className="h-4 w-4" />
                      Add task
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}


      </div>
    </div>
  )
}
