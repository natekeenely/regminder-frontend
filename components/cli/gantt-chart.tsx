"use client"

import { useState, useRef, useEffect } from "react"
import {
  ChevronDown,
  ChevronRight,
  ListTodo,
  BarChart2,
  Users,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Flag,
  Circle,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"

type GanttView = "task" | "progress" | "resource"
type TaskStatus = "not-started" | "in-progress" | "completed" | "at-risk" | "delayed"
type Priority = "critical" | "high" | "medium" | "low"

interface GanttTask {
  id: string
  name: string
  parentId?: string
  assignee: string
  assigneeColor: string
  startDay: number   // offset in days from project start
  duration: number   // days
  progress: number   // 0-100
  status: TaskStatus
  priority: Priority
  dependencies?: string[]
  expanded?: boolean
}

const TASKS: GanttTask[] = [
  { id: "t1", name: "TechCorp CE Certification", assignee: "John W.", assigneeColor: "bg-blue-500", startDay: 0, duration: 74, progress: 65, status: "in-progress", priority: "high", expanded: true },
  { id: "t1a", name: "Document Review", parentId: "t1", assignee: "John W.", assigneeColor: "bg-blue-500", startDay: 0, duration: 10, progress: 100, status: "completed", priority: "medium" },
  { id: "t1b", name: "Lab Testing Phase 1", parentId: "t1", assignee: "Sarah L.", assigneeColor: "bg-purple-500", startDay: 10, duration: 20, progress: 80, status: "in-progress", priority: "high" },
  { id: "t1c", name: "Lab Testing Phase 2", parentId: "t1", assignee: "Sarah L.", assigneeColor: "bg-purple-500", startDay: 30, duration: 20, progress: 40, status: "in-progress", priority: "high", dependencies: ["t1b"] },
  { id: "t1d", name: "Certification Submission", parentId: "t1", assignee: "John W.", assigneeColor: "bg-blue-500", startDay: 50, duration: 24, progress: 0, status: "not-started", priority: "critical", dependencies: ["t1c"] },

  { id: "t2", name: "Global Motors EMC Testing", assignee: "Mike L.", assigneeColor: "bg-amber-500", startDay: 5, duration: 54, progress: 45, status: "at-risk", priority: "critical", expanded: true },
  { id: "t2a", name: "Pre-scan Setup", parentId: "t2", assignee: "Mike L.", assigneeColor: "bg-amber-500", startDay: 5, duration: 12, progress: 100, status: "completed", priority: "high" },
  { id: "t2b", name: "EMC Measurements", parentId: "t2", assignee: "Anna K.", assigneeColor: "bg-green-500", startDay: 17, duration: 25, progress: 50, status: "at-risk", priority: "critical", dependencies: ["t2a"] },
  { id: "t2c", name: "Report Generation", parentId: "t2", assignee: "Mike L.", assigneeColor: "bg-amber-500", startDay: 42, duration: 17, progress: 0, status: "not-started", priority: "medium", dependencies: ["t2b"] },

  { id: "t3", name: "MediDevice FDA Approval", assignee: "Dr. Chen", assigneeColor: "bg-cyan-500", startDay: 10, duration: 171, progress: 30, status: "in-progress", priority: "critical", expanded: true },
  { id: "t3a", name: "Regulatory Gap Analysis", parentId: "t3", assignee: "Dr. Chen", assigneeColor: "bg-cyan-500", startDay: 10, duration: 20, progress: 100, status: "completed", priority: "high" },
  { id: "t3b", name: "Clinical Documentation", parentId: "t3", assignee: "Lisa W.", assigneeColor: "bg-rose-500", startDay: 30, duration: 60, progress: 20, status: "in-progress", priority: "critical", dependencies: ["t3a"] },
  { id: "t3c", name: "Submission Package", parentId: "t3", assignee: "Dr. Chen", assigneeColor: "bg-cyan-500", startDay: 90, duration: 91, progress: 0, status: "not-started", priority: "high", dependencies: ["t3b"] },

  { id: "t4", name: "ElectroParts Compliance", assignee: "James W.", assigneeColor: "bg-indigo-500", startDay: 8, duration: 38, progress: 20, status: "delayed", priority: "medium", expanded: true },
  { id: "t4a", name: "Initial Assessment", parentId: "t4", assignee: "James W.", assigneeColor: "bg-indigo-500", startDay: 8, duration: 15, progress: 40, status: "delayed", priority: "medium" },
  { id: "t4b", name: "Remediation Actions", parentId: "t4", assignee: "Emily R.", assigneeColor: "bg-orange-500", startDay: 23, duration: 23, progress: 0, status: "not-started", priority: "high", dependencies: ["t4a"] },
]

const RESOURCES = [
  { id: "john", name: "John W.", color: "bg-blue-500", role: "Lead Engineer" },
  { id: "sarah", name: "Sarah L.", color: "bg-purple-500", role: "Test Engineer" },
  { id: "mike", name: "Mike L.", color: "bg-amber-500", role: "EMC Specialist" },
  { id: "anna", name: "Anna K.", color: "bg-green-500", role: "Test Engineer" },
  { id: "dr-chen", name: "Dr. Chen", color: "bg-cyan-500", role: "Medical Lead" },
  { id: "lisa", name: "Lisa W.", color: "bg-rose-500", role: "Regulatory" },
  { id: "james", name: "James W.", color: "bg-indigo-500", role: "Compliance" },
  { id: "emily", name: "Emily R.", color: "bg-orange-500", role: "Compliance" },
]

const statusConfig: Record<TaskStatus, { label: string; bar: string; bg: string; text: string }> = {
  "completed":   { label: "Completed",   bar: "bg-green-500",  bg: "bg-green-100",  text: "text-green-700" },
  "in-progress": { label: "In Progress", bar: "bg-blue-500",   bg: "bg-blue-100",   text: "text-blue-700" },
  "at-risk":     { label: "At Risk",     bar: "bg-amber-500",  bg: "bg-amber-100",  text: "text-amber-700" },
  "delayed":     { label: "Delayed",     bar: "bg-red-500",    bg: "bg-red-100",    text: "text-red-700" },
  "not-started": { label: "Not Started", bar: "bg-gray-300",   bg: "bg-gray-100",   text: "text-gray-500" },
}

const priorityConfig: Record<Priority, { label: string; color: string }> = {
  critical: { label: "Critical", color: "text-red-600" },
  high:     { label: "High",     color: "text-amber-600" },
  medium:   { label: "Medium",   color: "text-blue-600" },
  low:      { label: "Low",      color: "text-gray-500" },
}

const ZOOM_LEVELS = [
  { label: "Day", days: 90, colWidth: 28 },
  { label: "Week", days: 90, colWidth: 80 },
  { label: "Month", days: 180, colWidth: 120 },
]

function getDayLabel(day: number, zoomIdx: number): string {
  const base = new Date(2024, 0, 1)
  const d = new Date(base)
  d.setDate(d.getDate() + day)
  if (zoomIdx === 0) return d.getDate().toString()
  if (zoomIdx === 1) {
    const week = Math.floor(day / 7) + 1
    return `W${week}`
  }
  return d.toLocaleString("default", { month: "short" })
}

function getMonthLabel(day: number): string {
  const base = new Date(2024, 0, 1)
  const d = new Date(base)
  d.setDate(d.getDate() + day)
  return d.toLocaleString("default", { month: "short", year: "numeric" })
}

export function GanttChart() {
  const [view, setView] = useState<GanttView>("task")
  const [zoomIdx, setZoomIdx] = useState(1) // default: Week
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["t1", "t2", "t3", "t4"]))
  const [scrollDay, setScrollDay] = useState(0)
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const gridRef = useRef<HTMLDivElement>(null)

  const zoom = ZOOM_LEVELS[zoomIdx]
  const visibleDays = zoom.days
  const colCount = zoomIdx === 0 ? visibleDays : zoomIdx === 1 ? Math.ceil(visibleDays / 7) : Math.ceil(visibleDays / 30)
  const totalCols = colCount
  const dayPerCol = zoomIdx === 0 ? 1 : zoomIdx === 1 ? 7 : 30

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const visibleTasks = TASKS.filter(t => {
    const matchesSearch = searchQuery === "" ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignee.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (!t.parentId) return true
    return expandedIds.has(t.parentId)
  })

  const getBarLeft = (startDay: number) => {
    const col = (startDay - scrollDay * dayPerCol) / dayPerCol
    return col * zoom.colWidth
  }

  const getBarWidth = (duration: number) => {
    return (duration / dayPerCol) * zoom.colWidth
  }

  // Resource allocation per column
  const getResourceLoad = (resourceName: string, colIdx: number) => {
    const startDay = (scrollDay + colIdx) * dayPerCol
    const endDay = startDay + dayPerCol
    return TASKS.filter(t =>
      t.assignee === resourceName &&
      t.startDay < endDay &&
      t.startDay + t.duration > startDay
    ).length
  }

  const LABEL_WIDTH = 260

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1">
            <button
              onClick={() => setView("task")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "task" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListTodo className="h-3.5 w-3.5" />
              Task
            </button>
            <button
              onClick={() => setView("progress")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "progress" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Progress
            </button>
            <button
              onClick={() => setView("resource")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "resource" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Resource
            </button>
          </div>
        </div>

        {/* Search bar — centered */}
        <div className="relative mx-4 flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks or assignees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1">
            <button onClick={() => setZoomIdx(Math.max(0, zoomIdx - 1))} disabled={zoomIdx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-40">
              <ZoomIn className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-xs font-medium text-foreground">{zoom.label}</span>
            <button onClick={() => setZoomIdx(Math.min(2, zoomIdx + 1))} disabled={zoomIdx === 2} className="text-muted-foreground hover:text-foreground disabled:opacity-40">
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>
          {/* Scroll */}
          <div className="flex items-center gap-1">
            <button onClick={() => setScrollDay(Math.max(0, scrollDay - 1))} className="rounded border border-border bg-card p-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setScrollDay(scrollDay + 1)} className="rounded border border-border bg-card p-1 text-muted-foreground hover:text-foreground">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          {/* Legend */}
          <div className="hidden items-center gap-3 lg:flex">
            {Object.entries(statusConfig).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <div className={cn("h-2.5 w-2.5 rounded-sm", v.bar)} />
                <span className="text-xs text-muted-foreground">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gantt Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Task view / Progress view */}
        {(view === "task" || view === "progress") && (
          <>
            {/* Left label panel */}
            <div
              className="flex-shrink-0 overflow-y-auto border-r border-border bg-card"
              style={{ width: LABEL_WIDTH }}
            >
              {/* Header row */}
              <div className="sticky top-0 z-10 border-b border-border bg-muted/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {view === "task" ? "Task Name" : "Progress"}
                  </span>
                </div>
              </div>
              {/* Sub-header spacer to align with month row */}
              <div className="border-b border-border bg-muted/30 px-3 py-1.5">
                <span className="text-[10px] text-muted-foreground">
                  {view === "task" ? "ID / Assignee" : "Completion %"}
                </span>
              </div>
              {/* Rows */}
              {visibleTasks.map(task => {
                const isParent = !task.parentId
                const isExpanded = expandedIds.has(task.id)
                const hasChildren = TASKS.some(t => t.parentId === task.id)
                const sc = statusConfig[task.status]
                const pc = priorityConfig[task.priority]
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center border-b border-border/50 px-3 py-2 transition-colors hover:bg-muted/30",
                      isParent ? "bg-muted/20" : "pl-7"
                    )}
                    style={{ height: 44 }}
                  >
                    {isParent && hasChildren && (
                      <button onClick={() => toggleExpand(task.id)} className="mr-1 flex-shrink-0 text-muted-foreground hover:text-foreground">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {!isParent && <div className="mr-2 h-full w-px bg-border/60 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      {view === "task" ? (
                        <>
                          <div className="flex items-center gap-1.5 truncate">
                            <Flag className={cn("h-3 w-3 flex-shrink-0", pc.color)} />
                            <span className={cn("truncate text-xs", isParent ? "font-semibold text-foreground" : "text-foreground/80")}>
                              {task.name}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <div className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", task.assigneeColor)} />
                            <span className="truncate text-[10px] text-muted-foreground">{task.assignee}</span>
                            <span className={cn("rounded px-1 text-[10px]", sc.bg, sc.text)}>{sc.label}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="truncate text-xs font-medium text-foreground">{task.name}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full transition-all", sc.bar)}
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                            <span className="w-8 flex-shrink-0 text-right text-[10px] font-medium text-muted-foreground">{task.progress}%</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right grid panel */}
            <div className="flex-1 overflow-auto" ref={gridRef}>
              <div style={{ width: totalCols * zoom.colWidth, minWidth: "100%" }}>
                {/* Month header */}
                <div className="sticky top-0 z-10 flex border-b border-border bg-muted/60">
                  {Array.from({ length: totalCols }).map((_, i) => {
                    const dayOffset = (scrollDay + i) * dayPerCol
                    const label = zoomIdx === 0
                      ? (i === 0 || new Date(2024, 0, dayOffset + 1).getDate() === 1 ? getMonthLabel(dayOffset) : "")
                      : zoomIdx === 1
                        ? (i % 4 === 0 ? getMonthLabel(dayOffset) : "")
                        : getMonthLabel(dayOffset)
                    return (
                      <div
                        key={i}
                        className="flex-shrink-0 border-r border-border/40 px-1 py-2 text-center text-[10px] font-medium text-muted-foreground"
                        style={{ width: zoom.colWidth }}
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>
                {/* Day/Week/Month sub-header */}
                <div className="sticky top-8 z-10 flex border-b border-border bg-muted/30">
                  {Array.from({ length: totalCols }).map((_, i) => {
                    const dayOffset = (scrollDay + i) * dayPerCol
                    const label = getDayLabel(dayOffset, zoomIdx)
                    const isWeekend = zoomIdx === 0 && [0, 6].includes(new Date(2024, 0, dayOffset + 1).getDay())
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex-shrink-0 border-r border-border/40 py-1 text-center text-[10px] text-muted-foreground",
                          isWeekend && "bg-muted/50"
                        )}
                        style={{ width: zoom.colWidth }}
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>

                {/* Bar rows */}
                <div className="relative">
                  {visibleTasks.map((task, rowIdx) => {
                    const isParent = !task.parentId
                    const barLeft = getBarLeft(task.startDay)
                    const barWidth = Math.max(getBarWidth(task.duration), 8)
                    const sc = statusConfig[task.status]
                    const isHovered = hoveredBar === task.id
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "relative flex items-center border-b border-border/50",
                          isParent ? "bg-muted/10" : ""
                        )}
                        style={{ height: 44 }}
                      >
                        {/* Background columns */}
                        {Array.from({ length: totalCols }).map((_, i) => {
                          const dayOffset = (scrollDay + i) * dayPerCol
                          const isWeekend = zoomIdx === 0 && [0, 6].includes(new Date(2024, 0, dayOffset + 1).getDay())
                          return (
                            <div
                              key={i}
                              className={cn("absolute top-0 h-full border-r border-border/20", isWeekend && "bg-muted/30")}
                              style={{ left: i * zoom.colWidth, width: zoom.colWidth }}
                            />
                          )
                        })}

                        {/* Today line */}
                        <div
                          className="absolute top-0 z-10 h-full w-px bg-red-400/60"
                          style={{ left: getBarLeft(30) }}
                        />

                        {/* Bar */}
                        {barLeft + barWidth > 0 && barLeft < totalCols * zoom.colWidth && (
                          <div
                            className="absolute z-10 cursor-pointer"
                            style={{ left: Math.max(0, barLeft), width: barWidth, top: 8 }}
                            onMouseEnter={() => setHoveredBar(task.id)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            {/* Bar track */}
                            <div
                              className={cn(
                                "relative h-6 overflow-hidden rounded",
                                isParent ? "h-5 rounded-sm" : "h-6 rounded-md",
                                "border border-white/20",
                                sc.bar,
                                "opacity-80 hover:opacity-100 transition-opacity"
                              )}
                            >
                              {/* Progress fill */}
                              {view === "progress" && task.progress > 0 && (
                                <div
                                  className="absolute left-0 top-0 h-full bg-white/30"
                                  style={{ width: `${task.progress}%` }}
                                />
                              )}
                              {/* Label */}
                              {barWidth > 50 && (
                                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white truncate">
                                  {view === "progress" ? `${task.progress}%` : task.name.split(" ").slice(0, 2).join(" ")}
                                </span>
                              )}
                            </div>

                            {/* Tooltip */}
                            {isHovered && (
                              <div className="absolute bottom-full left-0 z-50 mb-2 min-w-[180px] rounded-lg border border-border bg-card p-2.5 shadow-lg">
                                <div className="mb-1 text-xs font-semibold text-foreground">{task.name}</div>
                                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <div className={cn("h-1.5 w-1.5 rounded-full", task.assigneeColor)} />
                                    {task.assignee}
                                  </div>
                                  <div>Progress: <span className="font-medium text-foreground">{task.progress}%</span></div>
                                  <div>Duration: <span className="font-medium text-foreground">{task.duration}d</span></div>
                                  <div className="flex items-center gap-1">
                                    Status:
                                    <span className={cn("rounded px-1", sc.bg, sc.text)}>{sc.label}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Resource View */}
        {view === "resource" && (
          <>
            {/* Left: Resource list */}
            <div
              className="flex-shrink-0 overflow-y-auto border-r border-border bg-card"
              style={{ width: LABEL_WIDTH }}
            >
              <div className="sticky top-0 z-10 border-b border-border bg-muted/60 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resource</span>
              </div>
              <div className="border-b border-border bg-muted/30 px-3 py-1.5">
                <span className="text-[10px] text-muted-foreground">Role / Utilization</span>
              </div>
              {RESOURCES.map(res => {
                const taskCount = TASKS.filter(t => t.assignee === res.name && t.status !== "completed").length
                const utilPct = Math.min(100, taskCount * 25)
                return (
                  <div key={res.id} className="flex items-center border-b border-border/50 px-3 py-2 hover:bg-muted/30" style={{ height: 56 }}>
                    <div className={cn("mr-2.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", res.color)}>
                      {res.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-foreground">{res.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{res.role}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", utilPct > 80 ? "bg-red-500" : utilPct > 60 ? "bg-amber-500" : "bg-green-500")}
                            style={{ width: `${utilPct}%` }}
                          />
                        </div>
                        <span className={cn("text-[10px] font-medium", utilPct > 80 ? "text-red-600" : utilPct > 60 ? "text-amber-600" : "text-green-600")}>
                          {utilPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: Resource allocation grid */}
            <div className="flex-1 overflow-auto">
              <div style={{ width: totalCols * zoom.colWidth, minWidth: "100%" }}>
                {/* Month header */}
                <div className="sticky top-0 z-10 flex border-b border-border bg-muted/60">
                  {Array.from({ length: totalCols }).map((_, i) => {
                    const dayOffset = (scrollDay + i) * dayPerCol
                    const label = zoomIdx === 1 && i % 4 === 0 ? getMonthLabel(dayOffset) : zoomIdx !== 1 ? getMonthLabel(dayOffset) : ""
                    return (
                      <div key={i} className="flex-shrink-0 border-r border-border/40 px-1 py-2 text-center text-[10px] font-medium text-muted-foreground" style={{ width: zoom.colWidth }}>
                        {label}
                      </div>
                    )
                  })}
                </div>
                <div className="sticky top-8 z-10 flex border-b border-border bg-muted/30">
                  {Array.from({ length: totalCols }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 border-r border-border/40 py-1 text-center text-[10px] text-muted-foreground" style={{ width: zoom.colWidth }}>
                      {getDayLabel((scrollDay + i) * dayPerCol, zoomIdx)}
                    </div>
                  ))}
                </div>

                {/* Resource rows with task blocks */}
                {RESOURCES.map(res => {
                  const resTasks = TASKS.filter(t => t.assignee === res.name)
                  return (
                    <div key={res.id} className="relative border-b border-border/50" style={{ height: 56 }}>
                      {Array.from({ length: totalCols }).map((_, i) => {
                        const load = getResourceLoad(res.name, i)
                        return (
                          <div
                            key={i}
                            className={cn(
                              "absolute top-0 h-full border-r border-border/20",
                              load > 1 ? "bg-red-50" : load === 1 ? "bg-green-50/40" : ""
                            )}
                            style={{ left: i * zoom.colWidth, width: zoom.colWidth }}
                          />
                        )
                      })}
                      {/* Today line */}
                      <div className="absolute top-0 z-10 h-full w-px bg-red-400/60" style={{ left: getBarLeft(30) }} />
                      {resTasks.map(task => {
                        const barLeft = getBarLeft(task.startDay)
                        const barWidth = Math.max(getBarWidth(task.duration), 8)
                        const sc = statusConfig[task.status]
                        if (barLeft + barWidth <= 0 || barLeft >= totalCols * zoom.colWidth) return null
                        return (
                          <div
                            key={task.id}
                            className="absolute z-10"
                            style={{ left: Math.max(0, barLeft), width: barWidth, top: 10 }}
                            onMouseEnter={() => setHoveredBar(task.id)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            <div className={cn("relative h-8 overflow-hidden rounded-md border border-white/20 opacity-85 hover:opacity-100 transition-opacity", sc.bar)}>
                              {barWidth > 60 && (
                                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white truncate">
                                  {task.name.split(" ").slice(0, 2).join(" ")}
                                </span>
                              )}
                            </div>
                            {hoveredBar === task.id && (
                              <div className="absolute bottom-full left-0 z-50 mb-2 min-w-[180px] rounded-lg border border-border bg-card p-2.5 shadow-lg">
                                <div className="mb-1 text-xs font-semibold text-foreground">{task.name}</div>
                                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                  <div>Progress: <span className="font-medium text-foreground">{task.progress}%</span></div>
                                  <div>Duration: <span className="font-medium text-foreground">{task.duration}d</span></div>
                                  <div className="flex items-center gap-1">Status: <span className={cn("rounded px-1", sc.bg, sc.text)}>{sc.label}</span></div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2">
        <div className="flex items-center gap-4">
          {Object.entries(statusConfig).map(([k, v]) => {
            const count = TASKS.filter(t => t.status === k && !t.parentId).length
            if (count === 0) return null
            return (
              <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Circle className={cn("h-2 w-2 fill-current", v.text)} />
                {count} {v.label}
              </div>
            )
          })}
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-red-400">|</span> Today
          <span className="ml-3 text-[10px]">Jan 2024 — {TASKS.reduce((max, t) => Math.max(max, t.startDay + t.duration), 0)}d timeline</span>
        </div>
      </div>
    </div>
  )
}
