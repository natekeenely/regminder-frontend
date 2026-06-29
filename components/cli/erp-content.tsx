"use client"

import { useEffect, useMemo, useState } from "react"
import { WorkbenchCard } from "@/components/ui/workbench-card"
import { QueryBuilder, QBField, QBGroup, createDefaultQuery } from "@/components/ui/query-builder"
import {
  Package,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  MoreVertical,
  Plus,
  Eye,
  RefreshCw,
  History,
  Pencil,
  Save,
  Trash2,
  X,
  ClipboardList,
  ExternalLink,
} from "lucide-react"
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"

type TabKey = "orders" | "quotes" | "invoices"
type RowRecord = Record<string, unknown>

type EntityMeta = {
  key: string
  label: string
  idColumn: string
  codeColumn: string
  statusValues: string[]
}

type SummaryItem = {
  entity: string
  total: number
  statuses: Array<{ status: string; count: number }>
}

type DrawerMode = "view" | "create" | "edit"

type FieldSpec = {
  name: string
  label: string
  type: "text" | "number" | "date"
  required?: boolean
}

type EntitySpec = {
  key: TabKey
  entity: string
  label: string
  idField: string
  codeField: string
  statusField: string
  fields: FieldSpec[]
}

type AuditItem = {
  change_id: string
  entity: string
  record_id: string
  action: string
  actor: string
  changed_fields: string[]
  created_at: string
}

const tabToEntity: Record<TabKey, string> = {
  orders: "order",
  quotes: "quote",
  invoices: "invoice",
}

const tabMeta: Record<TabKey, { label: string; entityLabel: string; codeField: string; idField: string; statusField: string }> = {
  orders: { label: "Orders", entityLabel: "Order", codeField: "order_code", idField: "order_id", statusField: "status" },
  quotes: { label: "Quotes", entityLabel: "Quote", codeField: "quote_code", idField: "quote_id", statusField: "status" },
  invoices: { label: "Invoices", entityLabel: "Invoice", codeField: "invoice_code", idField: "invoice_id", statusField: "status" },
}

const entitySpecs: Record<TabKey, EntitySpec> = {
  orders: {
    key: "orders",
    entity: "order",
    label: "Order",
    idField: "order_id",
    codeField: "order_code",
    statusField: "status",
    fields: [
      { name: "order_code", label: "Order Code", type: "text", required: true },
      { name: "customer_name", label: "Customer Name", type: "text", required: true },
      { name: "service_type", label: "Service Type", type: "text", required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "currency_code", label: "Currency", type: "text", required: true },
      { name: "status", label: "Status", type: "text", required: true },
      { name: "order_date", label: "Order Date", type: "date" },
      { name: "due_date", label: "Due Date", type: "date" },
    ],
  },
  quotes: {
    key: "quotes",
    entity: "quote",
    label: "Quote",
    idField: "quote_id",
    codeField: "quote_code",
    statusField: "status",
    fields: [
      { name: "quote_code", label: "Quote Code", type: "text", required: true },
      { name: "customer_name", label: "Customer Name", type: "text", required: true },
      { name: "services", label: "Services", type: "text", required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "currency_code", label: "Currency", type: "text", required: true },
      { name: "status", label: "Status", type: "text", required: true },
      { name: "valid_until", label: "Valid Until", type: "date" },
    ],
  },
  invoices: {
    key: "invoices",
    entity: "invoice",
    label: "Invoice",
    idField: "invoice_id",
    codeField: "invoice_code",
    statusField: "status",
    fields: [
      { name: "invoice_code", label: "Invoice Code", type: "text", required: true },
      { name: "order_id", label: "Order ID", type: "text", required: true },
      { name: "customer_name", label: "Customer Name", type: "text", required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "currency_code", label: "Currency", type: "text", required: true },
      { name: "status", label: "Status", type: "text", required: true },
      { name: "issued_at", label: "Issued At", type: "date" },
      { name: "due_at", label: "Due At", type: "date" },
    ],
  },
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
    case "accepted":
    case "paid":
      return "bg-blue-100 text-blue-700"
    case "in-progress":
    case "sent":
    case "issued":
      return "bg-blue-100 text-blue-700"
    case "pending":
    case "draft":
      return "bg-amber-100 text-amber-700"
    case "confirmed":
      return "bg-purple-100 text-purple-700"
    case "cancelled":
    case "rejected":
    case "overdue":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

function toText(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function formatMoney(amount: unknown, currency: unknown): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return "-"
  return `${toText(currency) || "USD"} ${n.toLocaleString()}`
}

function formatDate(value: unknown): string {
  const raw = toText(value)
  if (!raw) return "-"
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10)
}

export function ErpContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("orders")
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [queryGroup, setQueryGroup] = useState<QBGroup>(() => createDefaultQuery([]))
  const [searchQuery, setSearchQuery] = useState("")
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterMenuColumn, setFilterMenuColumn] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entities, setEntities] = useState<EntityMeta[]>([])
  const [summary, setSummary] = useState<SummaryItem[]>([])
  const [orders, setOrders] = useState<RowRecord[]>([])
  const [quotes, setQuotes] = useState<RowRecord[]>([])
  const [invoices, setInvoices] = useState<RowRecord[]>([])
  const [recentAudit, setRecentAudit] = useState<AuditItem[]>([])
  const [recentAuditLoading, setRecentAuditLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<RowRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view")
  const [drawerForm, setDrawerForm] = useState<Record<string, string>>({})
  const [drawerAudit, setDrawerAudit] = useState<AuditItem[]>([])
  const [drawerAuditLoading, setDrawerAuditLoading] = useState(false)

  const activeRows = useMemo(() => {
    const rows = activeTab === "orders" ? orders : activeTab === "quotes" ? quotes : invoices
    return rows.filter((row) => {
      if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || toText(row[col]).toLowerCase().includes(val.trim().toLowerCase()))) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.trim().toLowerCase()
      return Object.values(row).some((value) => toText(value).toLowerCase().includes(q))
    })
  }, [activeTab, invoices, orders, quotes, searchQuery, columnFilters])

  const visibleMeta = entities.find((entity) => entity.key === tabToEntity[activeTab])
  const activeSpec = entitySpecs[activeTab]
  const selectedRecordId = selectedRecord ? toText(selectedRecord[activeSpec.idField]) || toText(selectedRecord[activeSpec.codeField]) : ""

  const kpis = useMemo(() => {
    const orderSummary = summary.find((item) => item.entity === "order")
    const quoteSummary = summary.find((item) => item.entity === "quote")
    const invoiceSummary = summary.find((item) => item.entity === "invoice")
    const revenue = orders.reduce((total, row) => total + Number(row.amount ?? 0), 0)
    return [
      { label: "Monthly Orders", value: String(orderSummary?.total ?? orders.length), change: "live", changeType: "up" as const, icon: <Package className="h-5 w-5" /> },
      { label: "Revenue MTD", value: `$${Math.round(revenue / 1000)}K`, change: "live", changeType: "up" as const, icon: <DollarSign className="h-5 w-5" /> },
      { label: "Pending Quotes", value: String(quoteSummary?.statuses.find((s) => s.status === "draft")?.count ?? 0), change: "live", changeType: "down" as const, icon: <FileText className="h-5 w-5" /> },
      { label: "Invoices", value: String(invoiceSummary?.total ?? invoices.length), change: "live", changeType: "up" as const, icon: <TrendingUp className="h-5 w-5" /> },
    ]
  }, [invoices.length, orders, quotes, summary])

  async function api(path: string, init?: RequestInit): Promise<any> {
    const resp = await fetch(`/api/proxy${path}`, init)
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok || data?.ok === false) throw new Error(data?.detail ?? `Request failed: ${resp.status}`)
    return data
  }

  async function loadAll(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const [meta, sum, orderData, quoteData, invoiceData] = await Promise.all([
        api("/api/v1/erp/entities"),
        api("/api/v1/erp/summary"),
        api("/api/v1/erp/order?limit=100"),
        api("/api/v1/erp/quote?limit=100"),
        api("/api/v1/erp/invoice?limit=100"),
      ])
      setEntities(Array.isArray(meta.items) ? meta.items : [])
      setSummary(Array.isArray(sum.items) ? sum.items : [])
      setOrders(Array.isArray(orderData.items) ? orderData.items : [])
      setQuotes(Array.isArray(quoteData.items) ? quoteData.items : [])
      setInvoices(Array.isArray(invoiceData.items) ? invoiceData.items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load ERP data")
    } finally {
      setLoading(false)
    }
  }

  async function loadAudit(): Promise<void> {
    setRecentAuditLoading(true)
    try {
      const data = await api(`/api/v1/erp/changelog?entity=${encodeURIComponent(tabToEntity[activeTab])}&limit=4`)
      setRecentAudit(Array.isArray(data.items) ? data.items : [])
    } catch {
      setRecentAudit([])
    } finally {
      setRecentAuditLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    void loadAudit()
    setColumnFilters({})
    setFilterMenuColumn(null)
    setSelectedRecord(null)
    setDetailOpen(false)
    setDrawerOpen(false)
    setDrawerMode("view")
    setDrawerForm({})
    setShowLeftPanel(false)
  }, [activeTab])

  useEffect(() => {
    if (drawerOpen) setShowLeftPanel(false)
  }, [drawerOpen])

  useEffect(() => {
    if (!drawerOpen || !selectedRecordId) return
    void loadDrawerAudit()
  }, [drawerOpen, selectedRecordId, activeTab])

  async function createOrder(): Promise<void> {
    setSubmitting(true)
    setError(null)
    try {
      await api("/api/v1/erp/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_name: "Demo Customer",
          service_type: "Testing Service",
          amount: 9800,
          currency_code: "USD",
          status: "pending",
        }),
      })
      await loadAll()
      await loadAudit()
      setActiveTab("orders")
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create order")
    } finally {
      setSubmitting(false)
    }
  }

  function openRecord(row: RowRecord): void {
    setSelectedRecord(row)
    setDetailOpen(true)
    setDrawerMode("view")
    setDrawerForm(buildDrawerForm(activeTab, row))
    setDrawerOpen(true)
  }

  function openCreate(): void {
    setSelectedRecord(null)
    setDetailOpen(false)
    setDrawerMode("create")
    setDrawerForm(buildDrawerForm(activeTab, null))
    setDrawerOpen(true)
    setDrawerAudit([])
  }

  function openEdit(row?: RowRecord): void {
    const target = row ?? selectedRecord
    if (!target) return
    setSelectedRecord(target)
    setDrawerMode("edit")
    setDetailOpen(true)
    setDrawerForm(buildDrawerForm(activeTab, target))
    setDrawerOpen(true)
  }

  function buildDrawerForm(tab: TabKey, row: RowRecord | null): Record<string, string> {
    const spec = entitySpecs[tab]
    const state: Record<string, string> = {}
    for (const field of spec.fields) {
      const raw = row ? toText(row[field.name]) : ""
      if (field.type === "date") {
        state[field.name] = raw ? formatDate(raw) : ""
      } else if (field.type === "number") {
        state[field.name] = raw || "0"
      } else {
        state[field.name] = raw || defaultValueForField(tab, field.name)
      }
    }
    return state
  }

  function defaultValueForField(tab: TabKey, field: string): string {
    if (field === entitySpecs[tab].codeField) {
      return `${field.replaceAll("_", "-").toUpperCase()}-${Date.now()}`
    }
    if (field === "status") return entitySpecs[tab].key === "orders" ? "pending" : entitySpecs[tab].key === "quotes" ? "draft" : "draft"
    if (field === "currency_code") return "USD"
    if (field === "order_date" || field === "issued_at") return new Date().toISOString().slice(0, 10)
    return ""
  }

  function currentPayloadFromForm(): Record<string, unknown> {
    const payload: Record<string, unknown> = {}
    for (const field of activeSpec.fields) {
      const value = drawerForm[field.name] ?? ""
      payload[field.name] = field.type === "number" ? Number(value || 0) : value
    }
    return payload
  }

  async function loadDrawerAudit(recordId?: string): Promise<void> {
    setDrawerAuditLoading(true)
    try {
      const path = `/api/v1/erp/changelog?entity=${encodeURIComponent(tabToEntity[activeTab])}${recordId ? `&record_id=${encodeURIComponent(recordId)}` : ""}&limit=8`
      const data = await api(path)
      setDrawerAudit(Array.isArray(data.items) ? data.items : [])
    } catch {
      setDrawerAudit([])
    } finally {
      setDrawerAuditLoading(false)
    }
  }

  async function saveDrawer(): Promise<void> {
    setSubmitting(true)
    setError(null)
    try {
      const entity = tabToEntity[activeTab]
      const payload = currentPayloadFromForm()
      const isCreate = drawerMode === "create"
      const idValue = selectedRecord ? toText(selectedRecord[activeSpec.idField]) : ""
      const data = await api(
        isCreate ? `/api/v1/erp/${encodeURIComponent(entity)}` : `/api/v1/erp/${encodeURIComponent(entity)}/${encodeURIComponent(idValue)}`,
        {
          method: isCreate ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const item = data?.item ?? null
      await loadAll()
      if (item) {
        setSelectedRecord(item)
        setDetailOpen(true)
        setDrawerForm(buildDrawerForm(activeTab, item))
        setDrawerMode("view")
        setDrawerOpen(true)
        await loadDrawerAudit(toText(item[activeSpec.idField]) || toText(item[activeSpec.codeField]))
      } else {
        setDrawerOpen(false)
      }
      await loadAudit()
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to save ERP record")
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteDrawer(): Promise<void> {
    if (!selectedRecord) return
    setSubmitting(true)
    setError(null)
    try {
      const entity = tabToEntity[activeTab]
      const idValue = toText(selectedRecord[activeSpec.idField])
      await api(`/api/v1/erp/${encodeURIComponent(entity)}/${encodeURIComponent(idValue)}`, { method: "DELETE" })
      await loadAll()
      await loadAudit()
      setSelectedRecord(null)
      setDetailOpen(false)
      setDrawerOpen(false)
      setDrawerMode("view")
      setDrawerForm({})
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to delete ERP record")
    } finally {
      setSubmitting(false)
    }
  }

  const queryFields = useMemo<QBField[]>(() => {
    switch (activeTab) {
      case "orders": return [
        { field: "order_code", label: "Order ID", type: "string" },
        { field: "customer_name", label: "Customer", type: "string" },
        { field: "service_type", label: "Type", type: "string" },
        { field: "amount", label: "Amount", type: "number" },
        { field: "status", label: "Status", type: "select", options: ["pending", "in-progress", "confirmed", "completed", "cancelled"] },
        { field: "due_date", label: "Due Date", type: "date" },
      ]
      case "quotes": return [
        { field: "quote_code", label: "Quote ID", type: "string" },
        { field: "customer_name", label: "Customer", type: "string" },
        { field: "services", label: "Services", type: "string" },
        { field: "amount", label: "Value", type: "number" },
        { field: "status", label: "Status", type: "select", options: ["draft", "sent", "accepted", "rejected"] },
        { field: "valid_until", label: "Valid Until", type: "date" },
      ]
      case "invoices": return [
        { field: "invoice_code", label: "Invoice ID", type: "string" },
        { field: "order_id", label: "Order", type: "string" },
        { field: "customer_name", label: "Customer", type: "string" },
        { field: "amount", label: "Amount", type: "number" },
        { field: "status", label: "Status", type: "select", options: ["draft", "issued", "sent", "paid", "overdue"] },
        { field: "due_at", label: "Due At", type: "date" },
      ]
      default: return [
        { field: "id", label: "ID", type: "string" },
        { field: "name", label: "Name", type: "string" },
      ]
    }
  }, [activeTab])

  const entityMeta = visibleMeta ?? {
    key: tabToEntity[activeTab],
    label: tabMeta[activeTab].entityLabel,
    idColumn: tabMeta[activeTab].idField,
    codeColumn: tabMeta[activeTab].codeField,
    statusValues: [],
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">ERP Order Management</h1>
            <p className="text-muted-foreground">Live orders, quotes, invoices, and audit events</p>
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
            <Button variant="outline" size="sm" onClick={() => void loadAll()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => openCreate()}
              disabled={submitting}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {submitting ? "Saving..." : `New ${tabMeta[activeTab].entityLabel}`}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">

        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto">
          {showLeftPanel && (
            <aside className="relative w-[342px] shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden p-4">
              <WorkbenchCard title="Query Conditions" badge={`${queryGroup.conditions.length + queryGroup.groups.length} rules`}>
                <QueryBuilder fields={queryFields} query={queryGroup} onChange={setQueryGroup} storageKey={`qb.erp.${activeTab}`} />
              </WorkbenchCard>
            </aside>
          )}
          <div className="flex-1 overflow-auto">

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi, index) => (
            <div key={index} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{kpi.icon}</div>
                <div className={cn("flex items-center gap-1 text-sm", kpi.changeType === "up" ? "text-success" : kpi.changeType === "down" ? "text-destructive" : "text-muted-foreground")}>
                  {kpi.changeType === "up" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {kpi.change}
                </div>
              </div>
              <div className="text-2xl font-semibold text-foreground">{loading ? "..." : kpi.value}</div>
              <div className="text-sm text-muted-foreground">{kpi.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["orders", "quotes", "invoices"] as TabKey[]).map((tab) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              className={cn("rounded-lg", activeTab === tab ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground")}
            >
              {tabMeta[tab].label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => void loadAudit()} className="gap-2">
              <History className="h-4 w-4" />
              Audit
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">{tabMeta[activeTab].label}</div>
              <div className="text-xs text-muted-foreground">{activeRows.length} rows</div>
            </div>

            {activeTab === "orders" && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Order ID
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["order_code"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "order_code" ? null : "order_code")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "order_code" && (
                          <ColumnFilterPopover column="order_code" label="Order ID" value={columnFilters["order_code"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, order_code: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, order_code: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Customer
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["customer_name"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "customer_name" ? null : "customer_name")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "customer_name" && (
                          <ColumnFilterPopover column="customer_name" label="Customer" value={columnFilters["customer_name"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, customer_name: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, customer_name: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Type
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["service_type"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "service_type" ? null : "service_type")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "service_type" && (
                          <ColumnFilterPopover column="service_type" label="Type" value={columnFilters["service_type"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, service_type: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, service_type: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Amount
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["amount"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "amount" ? null : "amount")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "amount" && (
                          <ColumnFilterPopover column="amount" label="Amount" value={columnFilters["amount"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, amount: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, amount: "" }))} onClose={() => setFilterMenuColumn(null)} />
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
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["due_date"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "due_date" ? null : "due_date")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "due_date" && (
                          <ColumnFilterPopover column="due_date" label="Due Date" value={columnFilters["due_date"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, due_date: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, due_date: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((order) => (
                    <tr key={toText(order.order_id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30" onDoubleClick={() => openRecord(order)}>
                      <td className="px-4 py-3 text-sm font-medium text-primary">{toText(order.order_code)}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{toText(order.customer_name)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{toText(order.service_type)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{formatMoney(order.amount, order.currency_code)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(toText(order.status)))}>{toText(order.status)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(order.due_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" onClick={() => openRecord(order)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(order)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "quotes" && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Quote ID
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["quote_code"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "quote_code" ? null : "quote_code")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "quote_code" && (
                          <ColumnFilterPopover column="quote_code" label="Quote ID" value={columnFilters["quote_code"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, quote_code: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, quote_code: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Customer
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["customer_name"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "customer_name" ? null : "customer_name")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "customer_name" && (
                          <ColumnFilterPopover column="customer_name" label="Customer" value={columnFilters["customer_name"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, customer_name: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, customer_name: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Services
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["services"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "services" ? null : "services")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "services" && (
                          <ColumnFilterPopover column="services" label="Services" value={columnFilters["services"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, services: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, services: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Value
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["amount"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "amount" ? null : "amount")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "amount" && (
                          <ColumnFilterPopover column="amount" label="Value" value={columnFilters["amount"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, amount: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, amount: "" }))} onClose={() => setFilterMenuColumn(null)} />
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
                        Valid Until
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["valid_until"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "valid_until" ? null : "valid_until")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "valid_until" && (
                          <ColumnFilterPopover column="valid_until" label="Valid Until" value={columnFilters["valid_until"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, valid_until: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, valid_until: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((quote) => (
                    <tr key={toText(quote.quote_id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30" onDoubleClick={() => openRecord(quote)}>
                      <td className="px-4 py-3 text-sm font-medium text-primary">{toText(quote.quote_code)}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{toText(quote.customer_name)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{toText(quote.services)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{formatMoney(quote.amount, quote.currency_code)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(toText(quote.status)))}>{toText(quote.status)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(quote.valid_until)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" onClick={() => openRecord(quote)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(quote)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "invoices" && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Invoice ID
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["invoice_code"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "invoice_code" ? null : "invoice_code")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "invoice_code" && (
                          <ColumnFilterPopover column="invoice_code" label="Invoice ID" value={columnFilters["invoice_code"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, invoice_code: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, invoice_code: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Order
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["order_id"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "order_id" ? null : "order_id")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "order_id" && (
                          <ColumnFilterPopover column="order_id" label="Order" value={columnFilters["order_id"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, order_id: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, order_id: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Customer
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["customer_name"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "customer_name" ? null : "customer_name")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "customer_name" && (
                          <ColumnFilterPopover column="customer_name" label="Customer" value={columnFilters["customer_name"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, customer_name: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, customer_name: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="relative inline-flex items-center gap-1">
                        Amount
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["amount"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "amount" ? null : "amount")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "amount" && (
                          <ColumnFilterPopover column="amount" label="Amount" value={columnFilters["amount"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, amount: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, amount: "" }))} onClose={() => setFilterMenuColumn(null)} />
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
                        Due At
                        <button type="button" className={cn("rounded p-0.5 hover:bg-background hover:text-primary", columnFilters["due_at"]?.trim() && "bg-primary/10 text-primary")} onClick={() => setFilterMenuColumn(prev => prev === "due_at" ? null : "due_at")}>
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        {filterMenuColumn === "due_at" && (
                          <ColumnFilterPopover column="due_at" label="Due At" value={columnFilters["due_at"] ?? ""} onChange={(v) => setColumnFilters(prev => ({ ...prev, due_at: v }))} onClear={() => setColumnFilters(prev => ({ ...prev, due_at: "" }))} onClose={() => setFilterMenuColumn(null)} />
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((invoice) => (
                    <tr key={toText(invoice.invoice_id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30" onDoubleClick={() => openRecord(invoice)}>
                      <td className="px-4 py-3 text-sm font-medium text-primary">{toText(invoice.invoice_code)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{toText(invoice.order_id)}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{toText(invoice.customer_name)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{formatMoney(invoice.amount, invoice.currency_code)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(toText(invoice.status)))}>{toText(invoice.status)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(invoice.due_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" onClick={() => openRecord(invoice)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(invoice)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Live ERP Audit
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary" onClick={() => void loadAudit()}>
                  Refresh
                </Button>
              </div>
              <div className="space-y-3 p-3">
                {recentAuditLoading ? (
                  <div className="text-sm text-muted-foreground">Loading audit trail...</div>
                ) : recentAudit.length > 0 ? (
                  recentAudit.map((item) => (
                    <div key={item.change_id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{item.action}</span>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        by <span className="font-medium">{item.actor}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Record: {item.record_id}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Fields: {item.changed_fields.length > 0 ? item.changed_fields.join(", ") : "-"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No ERP audit events yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Selected Record
                </div>
                <span className="text-xs text-muted-foreground">{detailOpen ? "open" : "none"}</span>
              </div>
              <div className="p-4">
                {selectedRecord ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground">Record ID</div>
                        <div className="mt-1 font-medium text-foreground">{selectedRecordId}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground">Status</div>
                        <div className="mt-1 font-medium text-foreground">{toText(selectedRecord.status) || "-"}</div>
                      </div>
                    </div>
                    <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 text-xs text-foreground">
                      {JSON.stringify(selectedRecord, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Double-click a row to inspect live ERP data.</div>
                )}
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setDetailOpen(false)
        }}
        direction="right"
      >
        <DrawerContent className="w-full data-[vaul-drawer-direction=right]:w-[min(100vw,860px)] data-[vaul-drawer-direction=right]:sm:max-w-none">
          <div className="flex h-full flex-col overflow-hidden">
            <DrawerHeader className="border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DrawerTitle className="text-xl">
                    {drawerMode === "create" ? `Create ${tabMeta[activeTab].entityLabel}` : drawerMode === "edit" ? `Edit ${tabMeta[activeTab].entityLabel}` : `${tabMeta[activeTab].entityLabel} Details`}
                  </DrawerTitle>
                  <DrawerDescription className="mt-1">
                    {drawerMode === "create"
                      ? `Add a new ${tabMeta[activeTab].label.toLowerCase()} record and save it to ERP.`
                      : drawerMode === "edit"
                        ? `Update the selected ${tabMeta[activeTab].label.toLowerCase()} record.`
                        : `Inspect the live ${tabMeta[activeTab].label.toLowerCase()} record, related rows, and audit trail.`}
                  </DrawerDescription>
                </div>
                <DrawerClose className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </DrawerClose>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedRecord ? (
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-xs text-muted-foreground">Code</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{toText(selectedRecord[activeSpec.codeField]) || "-"}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-xs text-muted-foreground">ID</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{selectedRecordId || "-"}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{toText(selectedRecord.status) || "-"}</div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <ClipboardList className="h-4 w-4 text-primary" />
                          {drawerMode === "create" ? "New Record Form" : drawerMode === "edit" ? "Edit Record Form" : "Record Overview"}
                        </div>
                        <div className="text-xs text-muted-foreground">Fields are mapped to the live ERP backend.</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void loadAll()} className="gap-2 text-xs">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reload
                      </Button>
                    </div>

                    {drawerMode === "view" ? (
                      <pre className="max-h-[420px] overflow-auto rounded-lg bg-muted/40 p-3 text-xs text-foreground">
                        {JSON.stringify(selectedRecord, null, 2)}
                      </pre>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {entitySpecs[activeTab].fields.map((field) => (
                          <label key={field.name} className={cn("space-y-1", field.name === "services" || field.name === "customer_name" ? "md:col-span-2" : "")}>
                            <span className="text-xs font-medium text-muted-foreground">
                              {field.label}
                              {field.required ? <span className="ml-1 text-red-500">*</span> : null}
                            </span>
                            {field.type === "text" ? (
                              <input
                                value={drawerForm[field.name] ?? ""}
                                onChange={(e) => setDrawerForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            ) : field.type === "number" ? (
                              <input
                                type="number"
                                value={drawerForm[field.name] ?? ""}
                                onChange={(e) => setDrawerForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            ) : (
                              <input
                                type="date"
                                value={drawerForm[field.name] ?? ""}
                                onChange={(e) => setDrawerForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">Related Records</div>
                      <div className="text-xs text-muted-foreground">Live linked rows</div>
                    </div>
                    {drawerMode === "create" ? (
                      <div className="text-sm text-muted-foreground">Save the record first to see linked rows.</div>
                    ) : activeTab === "orders" ? (
                      <div className="space-y-4">
                        <RelatedTable
                          title="Related Quotes"
                          rows={quotes.filter((item) => toText(item.customer_name) === toText(selectedRecord?.customer_name))}
                          columns={["quote_code", "customer_name", "amount", "status"]}
                          onOpen={(row) => openRecord(row)}
                        />
                        <RelatedTable
                          title="Related Invoices"
                          rows={invoices.filter((item) => toText(item.order_id) === toText(selectedRecord?.order_id))}
                          columns={["invoice_code", "customer_name", "amount", "status"]}
                          onOpen={(row) => openRecord(row)}
                        />
                      </div>
                    ) : activeTab === "quotes" ? (
                      <RelatedTable
                        title="Related Orders"
                        rows={orders.filter((item) => toText(item.customer_name) === toText(selectedRecord?.customer_name))}
                        columns={["order_code", "customer_name", "amount", "status"]}
                        onOpen={(row) => openRecord(row)}
                      />
                    ) : (
                      <div className="space-y-4">
                        <RelatedTable
                          title="Linked Order"
                          rows={orders.filter((item) => toText(item.order_id) === toText(selectedRecord?.order_id))}
                          columns={["order_code", "customer_name", "amount", "status"]}
                          onOpen={(row) => openRecord(row)}
                        />
                        <RelatedTable
                          title="Customer Orders"
                          rows={orders.filter((item) => toText(item.customer_name) === toText(selectedRecord?.customer_name))}
                          columns={["order_code", "service_type", "amount", "status"]}
                          onOpen={(row) => openRecord(row)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <History className="h-4 w-4 text-muted-foreground" />
                        Drawer Audit Trail
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary" onClick={() => void loadDrawerAudit(selectedRecordId)}>
                        Refresh
                      </Button>
                    </div>
                    <div className="space-y-3 p-3">
                      {drawerAuditLoading ? (
                        <div className="text-sm text-muted-foreground">Loading audit trail...</div>
                      ) : drawerAudit.length > 0 ? (
                        drawerAudit.map((item) => (
                          <div key={item.change_id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{item.action}</span>
                              <span>{formatDate(item.created_at)}</span>
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              by <span className="font-medium">{item.actor}</span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">Record: {item.record_id}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Fields: {item.changed_fields.length > 0 ? item.changed_fields.join(", ") : "-"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No audit events for this record.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">Quick Actions</div>
                      <div className="text-xs text-muted-foreground">{drawerMode}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {drawerMode === "view" ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit()} className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => void deleteDrawer()} className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button onClick={() => void saveDrawer()} disabled={submitting} className="gap-2">
                            <Save className="h-4 w-4" />
                            {submitting ? "Saving..." : "Save"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setDrawerMode("view")} className="gap-2">
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                    {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <DrawerFooter className="border-t border-border">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {drawerMode === "view" ? "Double-click rows to move between linked records." : "Changes will persist to the live ERP backend."}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setDrawerOpen(false)
                      setDetailOpen(false)
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function RelatedTable({
  title,
  rows,
  columns,
  onOpen,
}: {
  title: string
  rows: RowRecord[]
  columns: string[]
  onOpen: (row: RowRecord) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{rows.length} rows</div>
      </div>
      {rows.length > 0 ? (
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full">
            <tbody>
              {rows.slice(0, 6).map((row) => (
                <tr key={String(row[Object.keys(row)[0]] ?? Math.random())} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30" onDoubleClick={() => onOpen(row)}>
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-2 text-xs text-foreground">
                      {toText(row[column]) || "-"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onOpen(row)}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No related rows found.</div>
      )}
    </div>
  )
}
