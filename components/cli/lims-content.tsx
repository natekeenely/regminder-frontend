"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  Beaker,
  ArrowUpDown,
  CheckCircle2,
  ClipboardList,
  Eye,
  FlaskConical,
  Filter,
  History,
  Microscope,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  TestTube,
  Trash2,
  ExternalLink,
  X,
} from "lucide-react"

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"
import { QueryBuilder, QBField, QBGroup, createDefaultQuery } from "@/components/ui/query-builder"
import { WorkbenchCard } from "@/components/ui/workbench-card"

type LimsEntityMeta = {
  key: string
  label: string
  table: string
  idColumn: string
  codeColumn: string
  statusValues: string[]
  columns: Array<{ name: string; type: string; required?: boolean }>
}

type LimsSummaryItem = {
  entity: string
  total: number
  statuses: Array<{ status: string; count: number }>
}

type LimsChangeItem = {
  change_id: string
  entity_key: string
  record_id: string
  action: string
  actor: string
  changed_fields: string[]
  created_at: string
}

type RowRecord = Record<string, unknown>
type DrawerMode = "view" | "create" | "edit"

const tabToEntity: Record<"samples" | "results" | "equipment", string> = {
  samples: "sample",
  results: "test-result",
  equipment: "equipment",
}

const entityToTab: Record<string, "samples" | "results" | "equipment"> = {
  sample: "samples",
  "test-result": "results",
  equipment: "equipment",
}

const drawerFieldOrder: Record<string, string[]> = {
  sample: ["sample_code", "sample_name", "client_name", "test_type", "priority", "assigned_lab", "assigned_analyst", "remarks"],
  "test-job": ["job_code", "sample_id", "test_name", "method_code", "analyst_name", "result_summary", "started_at", "completed_at"],
  "test-result": ["result_code", "sample_id", "test_job_id", "parameter_name", "result_value", "unit", "analyst_name", "measured_at"],
  equipment: ["equipment_code", "equipment_name", "category", "lab_location", "manufacturer", "model_no", "last_calibrated_at", "calibration_due_at"],
}

const sortFieldMap: Record<string, string[]> = {
  samples: ["sample_code", "sample_name", "client_name", "status", "due_at", "updated_at"],
  results: ["result_code", "parameter_name", "result_value", "status", "measured_at", "updated_at"],
  equipment: ["equipment_code", "equipment_name", "category", "status", "calibration_due_at", "updated_at"],
}

const statusColor = (status: string) => {
  switch (status) {
    case "completed":
    case "pass":
    case "available":
      return "bg-blue-100 text-blue-700"
    case "in-testing":
    case "pending":
    case "queued":
    case "running":
      return "bg-blue-100 text-blue-700"
    case "received":
    case "review":
    case "maintenance":
      return "bg-amber-100 text-amber-700"
    case "rejected":
    case "fail":
    case "retired":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

const priorityColor = (priority: string) => {
  switch (priority) {
    case "rush":
      return "bg-red-100 text-red-700"
    case "urgent":
      return "bg-amber-100 text-amber-700"
    default:
      return "bg-gray-100 text-gray-600"
  }
}

function toText(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function matchesSearch(row: RowRecord, query: string): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return Object.values(row).some((value) => toText(value).toLowerCase().includes(q))
}

function formatDate(value: unknown): string {
  const raw = toText(value)
  if (!raw) return "-"
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10)
}

function statusBadgeClass(status: string): string {
  return cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", statusColor(status))
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function fieldType(inputType: string): "text" | "date" | "number" | "checkbox" {
  if (inputType === "date") return "date"
  if (inputType === "numeric" || inputType === "int") return "number"
  if (inputType === "boolean") return "checkbox"
  return "text"
}

function displayLabel(name: string): string {
  return name
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function defaultFieldValue(meta: LimsEntityMeta, columnName: string): string {
  if (columnName === meta.codeColumn) {
    return `${meta.codeColumn.replaceAll("_", "-").toUpperCase()}-${Date.now()}`
  }
  if (columnName === "status") {
    return meta.statusValues[0] ?? ""
  }
  if (columnName === "valid_from") {
    return todayIsoDate()
  }
  if (columnName === "valid_to") {
    return ""
  }
  if (columnName === "priority") {
    return "normal"
  }
  return ""
}

function buildFormState(meta: LimsEntityMeta, row?: RowRecord | null): Record<string, string> {
  const state: Record<string, string> = {}
  for (const column of meta.columns) {
    const current = row ? toText(row[column.name]) : ""
    state[column.name] = current || defaultFieldValue(meta, column.name)
  }
  state.status = row ? toText(row.status) || defaultFieldValue(meta, "status") : defaultFieldValue(meta, "status")
  state.valid_from = row ? formatDate(row.valid_from) : defaultFieldValue(meta, "valid_from")
  state.valid_to = row ? formatDate(row.valid_to) : ""
  state.version_no = row ? toText(row.version_no) || "1" : "1"
  return state
}

function recordKey(row: RowRecord, meta: LimsEntityMeta): string {
  return String(row[meta.idColumn] ?? row[meta.codeColumn] ?? row.sample_id ?? row.result_code ?? row.equipment_code ?? Math.random())
}

function sortValue(row: RowRecord, field: string): string {
  return toText(row[field]).toLowerCase()
}

function sortRows(rows: RowRecord[], field: string, direction: "asc" | "desc"): RowRecord[] {
  return [...rows].sort((left, right) => {
    const a = sortValue(left, field)
    const b = sortValue(right, field)
    if (a < b) return direction === "asc" ? -1 : 1
    if (a > b) return direction === "asc" ? 1 : -1
    return 0
  })
}

export function LimsContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<"samples" | "results" | "equipment">("samples")
  const [searchQuery, setSearchQuery] = useState("")
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [queryGroup, setQueryGroup] = useState<QBGroup>(() => createDefaultQuery([]))
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entities, setEntities] = useState<LimsEntityMeta[]>([])
  const [summary, setSummary] = useState<LimsSummaryItem[]>([])
  const [samples, setSamples] = useState<RowRecord[]>([])
  const [testJobs, setTestJobs] = useState<RowRecord[]>([])
  const [results, setResults] = useState<RowRecord[]>([])
  const [equipment, setEquipment] = useState<RowRecord[]>([])
  const [auditItems, setAuditItems] = useState<LimsChangeItem[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [recentAuditItems, setRecentAuditItems] = useState<LimsChangeItem[]>([])
  const [recentAuditLoading, setRecentAuditLoading] = useState(false)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterMenuColumn, setFilterMenuColumn] = useState<string | null>(null)
  const [sortField, setSortField] = useState("updated_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view")
  const [drawerEntityKey, setDrawerEntityKey] = useState<string>("sample")
  const [drawerRow, setDrawerRow] = useState<RowRecord | null>(null)
  const [formState, setFormState] = useState<Record<string, string>>({})

  const activeEntityKey = tabToEntity[activeTab]
  const isAuditExplorer = activeItem === "lims-audit"
  const activeMeta = useMemo(
    () => entities.find((entity) => entity.key === activeEntityKey) ?? null,
    [entities, activeEntityKey],
  )

  const currentMeta = useMemo(
    () => entities.find((entity) => entity.key === drawerEntityKey) ?? activeMeta,
    [entities, drawerEntityKey, activeMeta],
  )

  const filteredSamples = useMemo(
    () => samples.filter((row) => matchesSearch(row, searchQuery)),
    [samples, searchQuery],
  )
  const filteredResults = useMemo(
    () => results.filter((row) => matchesSearch(row, searchQuery)),
    [results, searchQuery],
  )
  const filteredEquipment = useMemo(
    () => equipment.filter((row) => matchesSearch(row, searchQuery)),
    [equipment, searchQuery],
  )
  const activeRows = useMemo(() => {
    const baseRows = activeTab === "samples" ? filteredSamples : activeTab === "results" ? filteredResults : filteredEquipment
    const columnFiltered = baseRows.filter((row) => {
      if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String(row[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
      return true
    })
    const sortOptions = sortFieldMap[activeTab]
    const sortTarget = sortOptions.includes(sortField) ? sortField : sortOptions[0] ?? "updated_at"
    return sortRows(columnFiltered, sortTarget, sortDirection)
  }, [activeTab, filteredEquipment, filteredResults, filteredSamples, sortDirection, sortField, columnFilters])

  const kpiCards = useMemo(() => {
    const sampleSummary = summary.find((item) => item.entity === "sample")
    const testJobSummary = summary.find((item) => item.entity === "test-job")
    const resultSummary = summary.find((item) => item.entity === "test-result")
    const equipmentSummary = summary.find((item) => item.entity === "equipment")
    return [
      {
        label: "Samples",
        value: String(sampleSummary?.total ?? samples.length),
        change: "live",
        changeType: "up" as const,
        icon: <TestTube className="h-5 w-5" />,
      },
      {
        label: "Test Jobs",
        value: String(testJobSummary?.total ?? testJobs.length),
        change: "live",
        changeType: "up" as const,
        icon: <ClipboardList className="h-5 w-5" />,
      },
      {
        label: "Results",
        value: String(resultSummary?.total ?? results.length),
        change: "live",
        changeType: "up" as const,
        icon: <CheckCircle2 className="h-5 w-5" />,
      },
      {
        label: "Equipment",
        value: String(equipmentSummary?.total ?? equipment.length),
        change: "live",
        changeType: "up" as const,
        icon: <Microscope className="h-5 w-5" />,
      },
    ]
  }, [summary, samples.length, testJobs.length, results.length, equipment.length])

  const queryFields = useMemo<QBField[]>(() => {
    switch (activeTab) {
      case "samples":
        return [
          { field: "sample_code", label: "Sample ID", type: "string" },
          { field: "sample_name", label: "Name", type: "string" },
          { field: "client_name", label: "Client", type: "string" },
          { field: "test_type", label: "Test Type", type: "string" },
          { field: "priority", label: "Priority", type: "select", options: ["normal", "urgent", "rush"] },
          { field: "status", label: "Status", type: "select", options: ["received", "in-testing", "completed", "rejected"] },
          { field: "due_at", label: "Due Date", type: "date" },
        ]
      case "results":
        return [
          { field: "result_code", label: "Result ID", type: "string" },
          { field: "sample_id", label: "Sample ID", type: "string" },
          { field: "parameter_name", label: "Parameter", type: "string" },
          { field: "result_value", label: "Result", type: "string" },
          { field: "status", label: "Status", type: "select", options: ["pending", "review", "pass", "fail"] },
          { field: "analyst_name", label: "Analyst", type: "string" },
          { field: "measured_at", label: "Measured", type: "date" },
        ]
      case "equipment":
        return [
          { field: "equipment_code", label: "Equipment Code", type: "string" },
          { field: "equipment_name", label: "Name", type: "string" },
          { field: "category", label: "Category", type: "string" },
          { field: "lab_location", label: "Lab Location", type: "string" },
          { field: "calibration_due_at", label: "Calibration Due", type: "date" },
          { field: "status", label: "Status", type: "select", options: ["available", "maintenance", "retired"] },
        ]
      default:
        return []
    }
  }, [activeTab])

  async function loadAll(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const [metaResp, summaryResp, sampleResp, jobResp, resultResp, equipmentResp] = await Promise.all([
        fetch("/api/proxy/api/v1/lims/entities"),
        fetch("/api/proxy/api/v1/lims/summary"),
        fetch("/api/proxy/api/v1/lims/sample?limit=100"),
        fetch("/api/proxy/api/v1/lims/test-job?limit=100"),
        fetch("/api/proxy/api/v1/lims/test-result?limit=100"),
        fetch("/api/proxy/api/v1/lims/equipment?limit=100"),
      ])

      const metaJson = await metaResp.json()
      const summaryJson = await summaryResp.json()
      const sampleJson = await sampleResp.json()
      const jobJson = await jobResp.json()
      const resultJson = await resultResp.json()
      const equipmentJson = await equipmentResp.json()

      if (!metaResp.ok || !summaryResp.ok || !sampleResp.ok || !jobResp.ok || !resultResp.ok || !equipmentResp.ok) {
        throw new Error(
          metaJson?.detail ??
            summaryJson?.detail ??
            sampleJson?.detail ??
            jobJson?.detail ??
            resultJson?.detail ??
            equipmentJson?.detail ??
            "failed to load LIMS data",
        )
      }

      setEntities(Array.isArray(metaJson?.items) ? metaJson.items : [])
      setSummary(Array.isArray(summaryJson?.items) ? summaryJson.items : [])
      setSamples(Array.isArray(sampleJson?.items) ? sampleJson.items : [])
      setTestJobs(Array.isArray(jobJson?.items) ? jobJson.items : [])
      setResults(Array.isArray(resultJson?.items) ? resultJson.items : [])
      setEquipment(Array.isArray(equipmentJson?.items) ? equipmentJson.items : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "failed to load LIMS data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadRecentAudit(entityKey = activeEntityKey, recordId?: string): Promise<void> {
    const meta = entities.find((entity) => entity.key === entityKey) ?? activeMeta
    if (!meta) return
    setRecentAuditLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("entity", meta.key)
      params.set("limit", "5")
      if (recordId) params.set("record_id", recordId)
      const resp = await fetch(`/api/proxy/api/v1/lims/changelog?${params.toString()}`)
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data?.detail ?? "failed to load audit summary")
      setRecentAuditItems(Array.isArray(data.items) ? data.items : [])
    } catch {
      setRecentAuditItems([])
    } finally {
      setRecentAuditLoading(false)
    }
  }

  useEffect(() => {
    void loadRecentAudit(activeEntityKey)
  }, [activeEntityKey, entities])

  useEffect(() => {
    const options = sortFieldMap[activeTab]
    setSortField((current) => (options.includes(current) ? current : options[0] ?? current))
    setColumnFilters({})
    setFilterMenuColumn(null)
    setShowLeftPanel(false)
  }, [activeTab])

  async function refreshTab(): Promise<void> {
    await loadAll()
  }

  function openCreate(entityKey = activeEntityKey): void {
    const meta = entities.find((entity) => entity.key === entityKey)
    if (!meta) return
    setDrawerEntityKey(entityKey)
    setDrawerRow(null)
    setDrawerMode("create")
    setFormState(buildFormState(meta, null))
    setDrawerOpen(true)
  }

  function openView(row: RowRecord, entityKey = activeEntityKey): void {
    const meta = entities.find((entity) => entity.key === entityKey)
    if (!meta) return
    setDrawerEntityKey(entityKey)
    setDrawerRow(row)
    setDrawerMode("view")
    setFormState(buildFormState(meta, row))
    setDrawerOpen(true)
  }

  function openEdit(row: RowRecord, entityKey = drawerEntityKey): void {
    const meta = entities.find((entity) => entity.key === entityKey)
    if (!meta) return
    setDrawerEntityKey(entityKey)
    setDrawerRow(row)
    setDrawerMode("edit")
    setFormState(buildFormState(meta, row))
    setDrawerOpen(true)
  }

  function closeDrawer(): void {
    setDrawerOpen(false)
    setDrawerMode("view")
    setDrawerRow(null)
    setFormState({})
  }

  function updateField(name: string, value: string | boolean): void {
    setFormState((current) => ({ ...current, [name]: String(value) }))
  }

  async function saveRecord(): Promise<void> {
    if (!currentMeta) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}
      for (const column of currentMeta.columns) {
        const value = formState[column.name] ?? ""
        if (fieldType(column.type) === "number") {
          payload[column.name] = value === "" ? null : Number(value)
        } else if (fieldType(column.type) === "checkbox") {
          payload[column.name] = value === "true"
        } else {
          payload[column.name] = value
        }
      }
      payload.status = formState.status || currentMeta.statusValues[0]
      payload.valid_from = formState.valid_from || null
      payload.valid_to = formState.valid_to || null
      payload.version_no = formState.version_no || "1"

      const isCreate = drawerMode === "create"
      const url = isCreate
        ? `/api/proxy/api/v1/lims/${encodeURIComponent(currentMeta.key)}`
        : `/api/proxy/api/v1/lims/${encodeURIComponent(currentMeta.key)}/${encodeURIComponent(String(drawerRow?.[currentMeta.idColumn] ?? ""))}`
      const resp = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) {
        throw new Error(data?.detail ?? `failed to ${isCreate ? "create" : "update"} ${currentMeta.label.toLowerCase()}`)
      }
      await loadAll()
      closeDrawer()
      if (entityToTab[currentMeta.key]) setActiveTab(entityToTab[currentMeta.key])
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "save failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteRecord(): Promise<void> {
    if (!currentMeta || !drawerRow) return
    if (!window.confirm(`Delete this ${currentMeta.label.toLowerCase()} permanently?`)) return
    setSubmitting(true)
    setError(null)
    try {
      const resp = await fetch(
        `/api/proxy/api/v1/lims/${encodeURIComponent(currentMeta.key)}/${encodeURIComponent(String(drawerRow[currentMeta.idColumn] ?? ""))}`,
        { method: "DELETE" },
      )
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data?.detail ?? `failed to delete ${currentMeta.label.toLowerCase()}`)
      await loadAll()
      closeDrawer()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "delete failed")
    } finally {
      setSubmitting(false)
    }
  }

  function drawerTitle(): string {
    if (!currentMeta) return "Record"
    if (drawerMode === "create") return `Create ${currentMeta.label}`
    if (drawerMode === "edit") return `Edit ${currentMeta.label}`
    return `${currentMeta.label} Details`
  }

  function drawerSubtitle(): string {
    if (!currentMeta) return ""
    if (drawerMode === "create") return `Add a new ${currentMeta.label.toLowerCase()} record`
    if (drawerMode === "edit") return `Update the selected ${currentMeta.label.toLowerCase()} record`
    return `Inspect live data for ${currentMeta.label.toLowerCase()}`
  }

  const drawerSampleId = toText(drawerRow?.sample_id)
  const drawerJobId = toText(drawerRow?.test_job_id)
  const relatedJobs = useMemo(
    () => (drawerSampleId ? testJobs.filter((job) => toText(job.sample_id) === drawerSampleId) : []),
    [drawerSampleId, testJobs],
  )
  const relatedResults = useMemo(
    () => (drawerSampleId ? results.filter((result) => toText(result.sample_id) === drawerSampleId) : []),
    [drawerSampleId, results],
  )
  const relatedJobResults = useMemo(
    () => (drawerJobId ? results.filter((result) => toText(result.test_job_id) === drawerJobId) : []),
    [drawerJobId, results],
  )

  useEffect(() => {
    if (drawerOpen) setShowLeftPanel(false)
  }, [drawerOpen])

  useEffect(() => {
    const meta = currentMeta
    if (!drawerOpen || !meta) {
      setAuditItems([])
      return
    }
    const metaKey = meta.key
    const metaIdColumn = meta.idColumn
    const metaCodeColumn = meta.codeColumn
    let ignore = false
    async function loadAudit(): Promise<void> {
      setAuditLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("entity", metaKey)
        params.set("limit", "10")
        if (drawerRow) params.set("record_id", String(drawerRow[metaIdColumn] ?? drawerRow[metaCodeColumn] ?? ""))
        const resp = await fetch(`/api/proxy/api/v1/lims/changelog?${params.toString()}`)
        const data = await resp.json()
        if (!resp.ok || !data.ok) throw new Error(data?.detail ?? "failed to load audit history")
        if (!ignore) setAuditItems(Array.isArray(data.items) ? data.items : [])
      } catch (auditError) {
        if (!ignore) setAuditItems([])
        if (!ignore) setError(auditError instanceof Error ? auditError.message : "failed to load audit history")
      } finally {
        if (!ignore) setAuditLoading(false)
      }
    }
    void loadAudit()
    return () => {
      ignore = true
    }
  }, [currentMeta, drawerOpen, drawerRow])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-semibold text-foreground">LIMS Lab Management</h1>
              <p className="text-sm text-muted-foreground">Sample tracking, test results, and lab operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!drawerOpen && (
            <button
              onClick={() => setShowLeftPanel((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${showLeftPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              Query
            </button>
            )}
            <Button variant="outline" size="sm" onClick={() => void refreshTab()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => openCreate()}
              size="sm"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add {activeMeta?.label ?? "Record"}
            </Button>
          </div>
        </div>
        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">{kpi.icon}</div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    kpi.changeType === "up" ? "text-blue-600" : "text-amber-600",
                  )}
                >
                  {kpi.changeType === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.change}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-foreground">{loading ? "..." : kpi.value}</div>
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-border bg-card px-6">
        <div className="flex gap-6">
          {[
            { id: "samples", label: "Samples", icon: <Beaker className="h-4 w-4" /> },
            { id: "results", label: "Test Results", icon: <ClipboardList className="h-4 w-4" /> },
            { id: "equipment", label: "Equipment", icon: <Microscope className="h-4 w-4" /> },
          ].map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "samples" | "results" | "equipment")}
              variant="ghost"
              size="sm"
              className={cn(
                "flex items-center gap-2 rounded-none border-b-2 px-1 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto">
        {showLeftPanel && (
          <aside className="relative w-[342px] shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden p-4">
            <WorkbenchCard title="Query Conditions" badge={`${queryGroup.conditions.length + queryGroup.groups.length} rules`}>
              <QueryBuilder fields={queryFields} query={queryGroup} onChange={setQueryGroup} storageKey={`qb.lims.${activeTab}`} />
            </WorkbenchCard>
          </aside>
        )}
        <div className="flex-1 overflow-auto p-6">
        {isAuditExplorer ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-amber-950 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4" />
                  LIMS Live Audit Explorer
                </div>
                <p className="mt-1 text-sm text-amber-900/80">
                  This view is dedicated to recent backend changes. It is here so you can validate the audit trail without opening a record drawer.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reload LIMS
                </button>
                <button
                  type="button"
                  onClick={() => void loadRecentAudit()}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700"
                >
                  <History className="h-3.5 w-3.5" />
                  Refresh Audit
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {recentAuditLoading ? (
                <div className="col-span-full rounded-xl border border-dashed border-amber-200 bg-white/80 p-4 text-sm text-amber-900/70">
                  Loading live audit trail...
                </div>
              ) : recentAuditItems.length > 0 ? (
                recentAuditItems.map((item) => (
                  <div key={item.change_id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 text-xs text-amber-900/70">
                      <span className="font-semibold text-amber-950">{item.action}</span>
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 text-sm text-amber-950">
                      by <span className="font-semibold">{item.actor}</span>
                    </div>
                    <div className="mt-1 text-xs text-amber-900/70">Record: {item.record_id || "-"}</div>
                    <div className="mt-1 text-xs text-amber-900/70">
                      Fields: {item.changed_fields.length > 0 ? item.changed_fields.join(", ") : "-"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-xl border border-dashed border-amber-200 bg-white/80 p-4 text-sm text-amber-900/70">
                  No live audit events found yet. Create or edit a LIMS record to generate one.
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Workspace Snapshot</div>
                <div className="text-xs text-muted-foreground">
                  Live overview for {activeMeta?.label ?? "LIMS"} with filters, sorting, and linked records.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {activeRows.length} visible rows
                </span>
                <button
                  type="button"
                  onClick={() => void refreshTab()}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Active tab</div>
                <div className="mt-1 text-sm font-medium text-foreground">{activeMeta?.label ?? "Samples"}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sort</div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {displayLabel(sortField)} · {sortDirection === "asc" ? "Ascending" : "Descending"}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Column filters</div>
                <div className="mt-1 text-sm font-medium text-foreground">{Object.entries(columnFilters).filter(([, v]) => v.trim()).length > 0 ? `${Object.entries(columnFilters).filter(([, v]) => v.trim()).length} active` : "None"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Recent Audit
                </div>
                <div className="text-xs text-muted-foreground">
                  Latest changes for {activeMeta?.label ?? "the active entity"}.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {recentAuditLoading ? "Loading..." : `${recentAuditItems.length} events`}
                </span>
                <button
                  type="button"
                  onClick={() => void refreshTab()}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {recentAuditLoading ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Loading audit trail...
                </div>
              ) : recentAuditItems.length > 0 ? (
                recentAuditItems.map((item) => (
                  <div key={item.change_id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{item.action}</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                    <div className="mt-1 text-sm text-foreground">
                      by <span className="font-medium">{item.actor}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Record: {item.record_id || "-"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Fields: {item.changed_fields.length > 0 ? item.changed_fields.join(", ") : "-"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No recent audit events found.
                </div>
              )}
            </div>
          </div>
        </div>

        {activeTab === "samples" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Sample ID
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["sample_code"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "sample_code" ? null : "sample_code")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "sample_code" && (
                        <ColumnFilterPopover column="sample_code" label="Sample ID" value={columnFilters["sample_code"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, sample_code: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, sample_code: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Name
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["sample_name"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "sample_name" ? null : "sample_name")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "sample_name" && (
                        <ColumnFilterPopover column="sample_name" label="Name" value={columnFilters["sample_name"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, sample_name: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, sample_name: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Client
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["client_name"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "client_name" ? null : "client_name")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "client_name" && (
                        <ColumnFilterPopover column="client_name" label="Client" value={columnFilters["client_name"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, client_name: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, client_name: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Test Type
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["test_type"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "test_type" ? null : "test_type")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "test_type" && (
                        <ColumnFilterPopover column="test_type" label="Test Type" value={columnFilters["test_type"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, test_type: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, test_type: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Priority
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["priority"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "priority" ? null : "priority")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "priority" && (
                        <ColumnFilterPopover column="priority" label="Priority" value={columnFilters["priority"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, priority: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, priority: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Status
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["status"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "status" ? null : "status")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "status" && (
                        <ColumnFilterPopover column="status" label="Status" value={columnFilters["status"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, status: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, status: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Due Date
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["due_at"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "due_at" ? null : "due_at")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "due_at" && (
                        <ColumnFilterPopover column="due_at" label="Due Date" value={columnFilters["due_at"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, due_at: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, due_at: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeRows.map((sample) => (
                  <tr
                    key={String(sample.sample_id ?? sample.sample_code)}
                    className="cursor-pointer hover:bg-muted/30"
                    onDoubleClick={() => openView(sample, "sample")}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary">
                      {toText(sample.sample_code ?? sample.sample_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{toText(sample.sample_name)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{toText(sample.client_name)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{toText(sample.test_type)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          priorityColor(toText(sample.priority)),
                        )}
                      >
                        {toText(sample.priority) || "normal"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(toText(sample.status))}>{toText(sample.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(sample.due_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                    className="rounded p-1 hover:bg-muted"
                          onClick={() => openView(sample, "sample")}
                          title="View details"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                    className="rounded p-1 hover:bg-muted"
                          onClick={() => openEdit(sample, "sample")}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                    <button className="rounded p-1 hover:bg-muted" title="More actions">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "results" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Result ID
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["result_code"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "result_code" ? null : "result_code")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "result_code" && (
                        <ColumnFilterPopover column="result_code" label="Result ID" value={columnFilters["result_code"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, result_code: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, result_code: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Sample ID
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["sample_id"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "sample_id" ? null : "sample_id")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "sample_id" && (
                        <ColumnFilterPopover column="sample_id" label="Sample ID" value={columnFilters["sample_id"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, sample_id: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, sample_id: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Parameter
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["parameter_name"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "parameter_name" ? null : "parameter_name")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "parameter_name" && (
                        <ColumnFilterPopover column="parameter_name" label="Parameter" value={columnFilters["parameter_name"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, parameter_name: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, parameter_name: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Result
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["result_value"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "result_value" ? null : "result_value")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "result_value" && (
                        <ColumnFilterPopover column="result_value" label="Result" value={columnFilters["result_value"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, result_value: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, result_value: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Status
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["status"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "status" ? null : "status")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "status" && (
                        <ColumnFilterPopover column="status" label="Status" value={columnFilters["status"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, status: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, status: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Analyst
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["analyst_name"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "analyst_name" ? null : "analyst_name")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "analyst_name" && (
                        <ColumnFilterPopover column="analyst_name" label="Analyst" value={columnFilters["analyst_name"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, analyst_name: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, analyst_name: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative inline-flex items-center gap-1">
                      Measured
                      <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["measured_at"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "measured_at" ? null : "measured_at")}>
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                      {filterMenuColumn === "measured_at" && (
                        <ColumnFilterPopover column="measured_at" label="Measured" value={columnFilters["measured_at"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, measured_at: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, measured_at: "" }))} onClose={() => setFilterMenuColumn(null)} />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeRows.map((result) => (
                  <tr
                    key={String(result.test_result_id ?? result.result_code)}
                    className="cursor-pointer hover:bg-muted/30"
                    onDoubleClick={() => openView(result, "test-result")}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary">
                      {toText(result.result_code ?? result.test_result_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{toText(result.sample_id)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{toText(result.parameter_name)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{toText(result.result_value)}</td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(toText(result.status))}>{toText(result.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{toText(result.analyst_name)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(result.measured_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded p-1 hover:bg-muted"
                          onClick={() => openView(result, "test-result")}
                          title="View details"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          className="rounded p-1 hover:bg-muted"
                          onClick={() => openEdit(result, "test-result")}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="rounded p-1 hover:bg-muted" title="More actions">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "equipment" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeRows.map((equip) => {
              const status = toText(equip.status)
              return (
                <div
                  key={String(equip.equipment_id ?? equip.equipment_code)}
                  className="cursor-pointer rounded-lg border border-border bg-card p-4 hover:bg-muted/20"
                  onDoubleClick={() => openView(equip, "equipment")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <Microscope className="h-5 w-5" />
                    </div>
                    <span className={statusBadgeClass(status)}>{status}</span>
                  </div>
                  <h3 className="mt-3 font-medium text-foreground">{toText(equip.equipment_name)}</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Equipment Code</span>
                      <span className="font-medium text-foreground">{toText(equip.equipment_code)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Category</span>
                      <span className="font-medium text-foreground">{toText(equip.category) || "-"}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Lab Location</span>
                      <span className="font-medium text-foreground">{toText(equip.lab_location) || "-"}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Calibration Due</span>
                      <span className="font-medium text-foreground">{formatDate(equip.calibration_due_at)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      className="rounded p-1 hover:bg-muted"
                      onClick={() => openView(equip, "equipment")}
                      title="View details"
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      className="rounded p-1 hover:bg-muted"
                      onClick={() => openEdit(equip, "equipment")}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button className="rounded p-1 hover:bg-muted" title="More actions">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && activeTab === "samples" && activeRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No samples found.</div>
        ) : null}
        {!loading && activeTab === "results" && activeRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No test results found.</div>
        ) : null}
        {!loading && activeTab === "equipment" && activeRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No equipment found.</div>
        ) : null}
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="w-full data-[vaul-drawer-direction=right]:w-[min(100vw,760px)] data-[vaul-drawer-direction=right]:sm:max-w-none">
          <div className="flex h-full flex-col">
            <DrawerHeader className="border-b border-border px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DrawerTitle className="text-xl">{drawerTitle()}</DrawerTitle>
                  <DrawerDescription className="mt-1">{drawerSubtitle()}</DrawerDescription>
                </div>
                <div className="flex items-center gap-2">
                  {drawerMode === "view" && drawerRow ? (
                    <>
                      <button
                        onClick={() => openEdit(drawerRow, drawerEntityKey)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => void deleteRecord()}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  ) : null}
                  <DrawerClose asChild>
                    <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                      <X className="h-4 w-4" />
                      Close
                    </button>
                  </DrawerClose>
                </div>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-auto px-6 py-5">
              {currentMeta ? (
                <>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Entity</div>
                        <div className="mt-1 font-medium text-foreground">{currentMeta.label}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Table</div>
                        <div className="mt-1 font-medium text-foreground">{currentMeta.table}</div>
                      </div>
                      {drawerRow ? (
                        <div>
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">Record ID</div>
                          <div className="mt-1 font-medium text-foreground">
                            {toText(drawerRow[currentMeta.idColumn] ?? drawerRow[currentMeta.codeColumn])}
                          </div>
                        </div>
                      ) : null}
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
                        <div className="mt-1">
                          <span className={statusBadgeClass(formState.status || drawerRow?.status ? toText(drawerRow?.status ?? formState.status) : currentMeta.statusValues[0] ?? "")}>
                            {drawerMode === "create"
                              ? formState.status || currentMeta.statusValues[0]
                              : drawerRow
                                ? toText(drawerRow.status)
                                : formState.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {drawerMode === "view" ? (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="mb-3 text-sm font-semibold text-foreground">Record Snapshot</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {currentMeta.columns.map((column) => (
                            <div key={column.name} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                              <div className="text-xs uppercase tracking-wider text-muted-foreground">{displayLabel(column.name)}</div>
                              <div className="mt-1 break-words text-sm font-medium text-foreground">
                                {toText(drawerRow?.[column.name]) || "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {currentMeta.key === "sample" ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-border bg-card p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-foreground">Related Test Jobs</div>
                              <div className="text-xs text-muted-foreground">{relatedJobs.length} rows</div>
                            </div>
                            <div className="overflow-auto rounded-lg border border-border">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2">Job Code</th>
                                    <th className="px-3 py-2">Test Name</th>
                                    <th className="px-3 py-2">Analyst</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {relatedJobs.length > 0 ? (
                                    relatedJobs.map((job) => (
                                      <tr key={recordKey(job, entities.find((entity) => entity.key === "test-job") ?? currentMeta)} className="hover:bg-muted/20">
                                        <td className="px-3 py-2 font-medium text-primary">{toText(job.job_code)}</td>
                                        <td className="px-3 py-2 text-foreground">{toText(job.test_name)}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{toText(job.analyst_name)}</td>
                                        <td className="px-3 py-2">
                                          <span className={statusBadgeClass(toText(job.status))}>{toText(job.status)}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <button className="rounded p-1 hover:bg-muted" onClick={() => openView(job, "test-job")} title="Open linked job">
                                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                            <button className="rounded p-1 hover:bg-muted" onClick={() => openEdit(job, "test-job")} title="Edit linked job">
                                              <Pencil className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                                        No linked test jobs.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border bg-card p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-foreground">Related Test Results</div>
                              <div className="text-xs text-muted-foreground">{relatedResults.length} rows</div>
                            </div>
                            <div className="overflow-auto rounded-lg border border-border">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2">Result Code</th>
                                    <th className="px-3 py-2">Parameter</th>
                                    <th className="px-3 py-2">Value</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {relatedResults.length > 0 ? (
                                    relatedResults.map((result) => (
                                      <tr key={recordKey(result, entities.find((entity) => entity.key === "test-result") ?? currentMeta)} className="hover:bg-muted/20">
                                        <td className="px-3 py-2 font-medium text-primary">{toText(result.result_code)}</td>
                                        <td className="px-3 py-2 text-foreground">{toText(result.parameter_name)}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{toText(result.result_value)}</td>
                                        <td className="px-3 py-2">
                                          <span className={statusBadgeClass(toText(result.status))}>{toText(result.status)}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <button className="rounded p-1 hover:bg-muted" onClick={() => openView(result, "test-result")} title="Open linked result">
                                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                            <button className="rounded p-1 hover:bg-muted" onClick={() => openEdit(result, "test-result")} title="Edit linked result">
                                              <Pencil className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                                        No linked results.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {currentMeta.key === "test-result" ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-border bg-card p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-foreground">Related Test Job</div>
                              <div className="text-xs text-muted-foreground">{drawerJobId ? "linked" : "unlinked"}</div>
                            </div>
                            {drawerJobId ? (
                              (() => {
                                const job = testJobs.find((item) => toText(item.test_job_id) === drawerJobId)
                                if (!job) {
                                  return <div className="text-sm text-muted-foreground">The linked job is not loaded yet.</div>
                                }
                                return (
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Job Code</div>
                                      <div className="mt-1 text-sm font-medium text-foreground">{toText(job.job_code)}</div>
                                    </div>
                                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Test Name</div>
                                      <div className="mt-1 text-sm font-medium text-foreground">{toText(job.test_name)}</div>
                                    </div>
                                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Analyst</div>
                                      <div className="mt-1 text-sm font-medium text-foreground">{toText(job.analyst_name) || "-"}</div>
                                    </div>
                                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
                                      <div className="mt-1">
                                        <span className={statusBadgeClass(toText(job.status))}>{toText(job.status)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })()
                            ) : (
                              <div className="text-sm text-muted-foreground">This result is not linked to a test job.</div>
                            )}
                          </div>

                          <div className="rounded-xl border border-border bg-card p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-foreground">Sibling Results for Same Sample</div>
                              <div className="text-xs text-muted-foreground">{relatedJobResults.length} rows</div>
                            </div>
                            <div className="overflow-auto rounded-lg border border-border">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2">Result Code</th>
                                    <th className="px-3 py-2">Parameter</th>
                                    <th className="px-3 py-2">Value</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {relatedJobResults.length > 0 ? (
                                    relatedJobResults.map((result) => (
                                      <tr key={recordKey(result, entities.find((entity) => entity.key === "test-result") ?? currentMeta)} className="hover:bg-muted/20">
                                        <td className="px-3 py-2 font-medium text-primary">{toText(result.result_code)}</td>
                                        <td className="px-3 py-2 text-foreground">{toText(result.parameter_name)}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{toText(result.result_value)}</td>
                                        <td className="px-3 py-2">
                                          <span className={statusBadgeClass(toText(result.status))}>{toText(result.status)}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <button className="rounded p-1 hover:bg-muted" onClick={() => openView(result, "test-result")} title="Open linked result">
                                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                            <button className="rounded p-1 hover:bg-muted" onClick={() => openEdit(result, "test-result")} title="Edit linked result">
                                              <Pencil className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                                        No sibling results found.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="mb-3 text-sm font-semibold text-foreground">Raw JSON</div>
                        <pre className="max-h-96 overflow-auto rounded-lg bg-muted/40 p-4 text-xs text-foreground">
                          {JSON.stringify(drawerRow, null, 2)}
                        </pre>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <History className="h-4 w-4 text-muted-foreground" />
                            Audit History
                          </div>
                          <div className="text-xs text-muted-foreground">{auditItems.length} events</div>
                        </div>
                        {auditLoading ? (
                          <div className="text-sm text-muted-foreground">Loading audit trail...</div>
                        ) : auditItems.length > 0 ? (
                          <div className="space-y-3">
                            {auditItems.map((item) => (
                              <div key={item.change_id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{item.action}</span>
                                  <span>{formatDate(item.created_at)}</span>
                                </div>
                                <div className="mt-1 text-sm text-foreground">
                                  by <span className="font-medium">{item.actor}</span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Fields: {item.changed_fields.length > 0 ? item.changed_fields.join(", ") : "-"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No audit events found for this record.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form
                      className="mt-5 space-y-5"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void saveRecord()
                      }}
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        {(drawerFieldOrder[currentMeta.key] ?? currentMeta.columns.map((column) => column.name)).map((columnName) => {
                          const column = currentMeta.columns.find((item) => item.name === columnName)
                          if (!column) return null
                          const value = formState[column.name] ?? ""
                          const inputKind = fieldType(column.type)
                          const required = Boolean(column.required)
                          const isLongText = ["remarks", "result_summary", "description"].includes(column.name)
                          return (
                            <label key={column.name} className="block space-y-2">
                              <span className="text-sm font-medium text-foreground">
                                {displayLabel(column.name)}
                                {required ? <span className="ml-1 text-red-600">*</span> : null}
                              </span>
                              {inputKind === "checkbox" ? (
                                <input
                                  type="checkbox"
                                  checked={value === "true"}
                                  onChange={(event) => updateField(column.name, event.target.checked)}
                                  className="h-4 w-4 rounded border-border"
                                />
                              ) : isLongText ? (
                                <textarea
                                  value={value}
                                  onChange={(event) => updateField(column.name, event.target.value)}
                                  rows={4}
                                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                  placeholder={`Enter ${column.name}`}
                                />
                              ) : (
                                <input
                                  type={inputKind}
                                  value={value}
                                  onChange={(event) => updateField(column.name, event.target.value)}
                                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                  placeholder={`Enter ${column.name}`}
                                />
                              )}
                            </label>
                          )
                        })}

                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-foreground">Status</span>
                          <select
                            value={formState.status ?? ""}
                            onChange={(event) => updateField("status", event.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {currentMeta.statusValues.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-foreground">Valid From</span>
                          <input
                            type="date"
                            value={formState.valid_from ?? ""}
                            onChange={(event) => updateField("valid_from", event.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-foreground">Valid To</span>
                          <input
                            type="date"
                            value={formState.valid_to ?? ""}
                            onChange={(event) => updateField("valid_to", event.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </label>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="text-sm font-semibold text-foreground">Record Preview</div>
                        <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-card p-4 text-xs text-foreground">
                          {JSON.stringify(
                            {
                              ...formState,
                              [currentMeta.idColumn]: drawerRow?.[currentMeta.idColumn] ?? "(new)",
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                  No entity metadata found.
                </div>
              )}
            </div>

            <DrawerFooter className="border-t border-border px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {drawerMode === "view"
                    ? "Use Edit to update the selected record."
                    : "Changes are validated by the backend before they are saved."}
                </div>
                <div className="flex items-center gap-2">
                  {drawerMode !== "view" ? (
                    <button
                      type="button"
                      onClick={() => void saveRecord()}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {submitting ? "Saving..." : "Save"}
                    </button>
                  ) : null}
                  <DrawerClose asChild>
                    <button className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
                      <X className="h-4 w-4" />
                      Close
                    </button>
                  </DrawerClose>
                </div>
              </div>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <div className="sr-only">
        Active item: {activeItem ?? "none"}
      </div>
    </div>
  )
}
