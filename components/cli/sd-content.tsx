"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Clock3,
  Eye,
  Filter,
  GripVertical,
  Headset,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  Ticket as TicketIcon,
  Trash2,
  X,
  Zap,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"
import { WorkbenchCard } from "@/components/ui/workbench-card"
import { QueryBuilder, QBField, QBGroup, createDefaultQuery } from "@/components/ui/query-builder"
import { cn } from "@/lib/utils"
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type TicketPriority = "urgent" | "high" | "medium" | "low"
type TicketStatus = "open" | "in-progress" | "pending" | "resolved" | "closed"
type KnowledgeStatus = "draft" | "published" | "archived"
type SdTab = "tickets" | "knowledge" | "quotations" | "reports" | "sla"
type DrawerEntity = "ticket" | "knowledge-article"
type DrawerMode = "view" | "create" | "edit"
type CommentMode = "internal" | "reply"

interface TicketRow {
  [key: string]: unknown
  ticket_id: string
  ticket_code: string
  subject: string
  requester: string
  requester_org: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  assignee: string
  channel: string
  summary: string
  created_at: string
  updated_at: string
  version_no: number
}

interface ArticleRow {
  [key: string]: unknown
  article_id: string
  article_code: string
  title: string
  category: string
  status: KnowledgeStatus
  author: string
  summary: string
  body: string
  tags: string[]
  view_count: number
  created_at: string
  updated_at: string
  version_no: number
}

interface CommentRow {
  comment_id: string
  ticket_id: string
  author: string
  body: string
  created_at: string
  updated_at: string
}

interface AuditRow {
  change_id: string
  entity: string
  record_id: string
  action: string
  actor: string
  changed_fields: string[]
  created_at: string
}

interface Summary {
  tickets: number
  knowledgeArticles: number
  comments: number
  openTickets: number
  urgentTickets: number
  avgResponse: string
  resolutionRate: string
  satisfaction: string
}

interface QuotationLine {
  line_no: number
  requirement_code: string
  requirement_title: string
  service_item_code: string
  service_item_name: string
  qty: number
  line_total: number | null
  currency: string | null
  pricing_status: string
  pricing_detail: string | null
}

interface QuotationPreview {
  quotation_id?: string
  quotation_code?: string
  customer: string
  jurisdiction: string | null
  hsCode: string | null
  category: string | null
  effectiveOn: string
  currency_code: string | null
  price_list_code: string | null
  requirement_count: number
  line_count: number
  resolved_line_count: number
  unresolved_line_count: number
  total: number | null
  currency: string | null
  lines: QuotationLine[]
  created_at?: string
}

interface QuotationForm {
  customer: string
  jurisdiction: string
  hsCode: string
  category: string
  effectiveOn: string
  currency_code: string
  price_list_code: string
  quantity: string
}

interface SlaDefinition {
  [key: string]: unknown
  sla_id: string
  sla_code: string
  sla_name: string
  priority: string
  category: string
  response_time_hours: number
  resolution_time_hours: number
  business_hours_only: boolean
  status: string
}

interface SlaStatus {
  ok: boolean
  ticket_id: string
  ticket_status: string
  sla: { sla_code: string; sla_name: string } | null
  response_deadline: string | null
  resolution_deadline: string | null
  response_breached: boolean
  resolution_breached: boolean
  response_remaining_hours: number | null
  resolution_remaining_hours: number | null
}

interface DrawerForm {
  [key: string]: string
}

const kpiFallback = [
  { label: "Open Tickets", icon: TicketIcon, value: "0", change: "+0", trend: "up" as const },
  { label: "Avg Response", icon: Clock3, value: "0h", change: "0m", trend: "down" as const },
  { label: "Resolution Rate", icon: CheckCircle2, value: "0%", change: "+0%", trend: "up" as const },
  { label: "Satisfaction", icon: Star, value: "0%", change: "+0%", trend: "up" as const },
]


function statusPill(status: string): string {
  switch (status) {
    case "resolved":
    case "closed":
      return "bg-blue-100 text-blue-700"
    case "in-progress":
      return "bg-indigo-100 text-indigo-700"
    case "open":
      return "bg-cyan-100 text-cyan-700"
    case "pending":
      return "bg-amber-100 text-amber-700"
    case "published":
      return "bg-blue-100 text-blue-700"
    case "draft":
      return "bg-slate-100 text-slate-700"
    case "archived":
      return "bg-slate-200 text-slate-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function priorityPill(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700"
    case "high":
      return "bg-orange-100 text-orange-700"
    case "medium":
      return "bg-amber-100 text-amber-700"
    case "low":
      return "bg-blue-100 text-blue-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function formatDate(value: string): string {
  if (!value) return "-"
  return value.includes("T") ? value.slice(0, 19).replace("T", " ") : value
}

function timeAgo(value: string): string {
  if (!value) return "-"
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"))
  if (isNaN(date.getTime())) return value.slice(0, 10)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  return value.slice(0, 10)
}

function channelIcon(channel: string): string {
  const c = (channel ?? "").toLowerCase()
  if (c.includes("email") || c.includes("mail")) return "📧"
  if (c.includes("chat") || c.includes("teams")) return "💬"
  if (c.includes("phone") || c.includes("call")) return "📞"
  if (c.includes("web") || c.includes("portal")) return "🌐"
  if (c.includes("whatsapp")) return "📱"
  return "📋"
}

function formatMoney(value: number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  const amount = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${currency} ${amount}` : amount
}

function emptyDrawerForm(entity: DrawerEntity): DrawerForm {
  return entity === "ticket"
    ? {
        ticket_code: "",
        subject: "",
        requester: "",
        requester_org: "",
        category: "Service Request",
        priority: "medium",
        status: "open",
        assignee: "Unassigned",
        channel: "Web",
        summary: "",
        brand: "",
        ticket_type: "",
        description: "",
        requester_cc: "",
        watchers: "",
        auto_assign: "true",
        is_internal: "false",
      }
    : {
        article_code: "",
        title: "",
        category: "General",
        status: "draft",
        author: "",
        summary: "",
        body: "",
        tags: "",
      }
}

export function SdContent({ activeItem }: { activeItem?: string }) {
  const TICKET_TABLE_COLS: readonly [string, string][] = [
    ["ticket_code", "ID"],
    ["subject", "Subject"],
    ["requester", "Requester"],
    ["brand", "Brand"],
    ["priority", "Priority"],
    ["status", "Status"],
    ["assignee", "Assignee"],
    ["ticket_type", "Type"],
    ["updated_at", "Created On"],
    ["tags", "Tags"],
  ]
  const [activeTab, setActiveTab] = useState<SdTab>("tickets")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [quotations, setQuotations] = useState<QuotationPreview[]>([])
  const [quotationPreview, setQuotationPreview] = useState<QuotationPreview | null>(null)
  const [quotationForm, setQuotationForm] = useState<QuotationForm>({
    customer: "Demo Customer",
    jurisdiction: "EU",
    hsCode: "850440",
    category: "power-supply",
    effectiveOn: new Date().toISOString().slice(0, 10),
    currency_code: "EUR",
    price_list_code: "",
    quantity: "1",
  })
  const [recentAudit, setRecentAudit] = useState<AuditRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [commentDraft, setCommentDraft] = useState("")
  const [commentMode, setCommentMode] = useState<CommentMode>("internal")
  const [searchQuery, setSearchQuery] = useState("")
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [showRightPanel, setShowRightPanel] = useState(false)
  // Collapsible Builder sections
  const [auditSectionOpen, setAuditSectionOpen] = useState(true)
  const [queryGroup, setQueryGroup] = useState<QBGroup>(() => createDefaultQuery([]))
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterMenuColumn, setFilterMenuColumn] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view")
  const [drawerEntity, setDrawerEntity] = useState<DrawerEntity>("ticket")
  const [drawerRow, setDrawerRow] = useState<TicketRow | ArticleRow | null>(null)
  const [drawerForm, setDrawerForm] = useState<DrawerForm>(emptyDrawerForm("ticket"))
  const [drawerAudit, setDrawerAudit] = useState<AuditRow[]>([])
  const [drawerAuditLoading, setDrawerAuditLoading] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [quotationLoading, setQuotationLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // SLA state
  const [slaDefinitions, setSlaDefinitions] = useState<SlaDefinition[]>([])
  const [slaStatuses, setSlaStatuses] = useState<Map<string, SlaStatus>>(new Map())
  const [slaLoading, setSlaLoading] = useState(false)
  // Agent view state
  const [agentFilter, setAgentFilter] = useState<"all" | "mine" | "unassigned" | "pending" | "open">("all")
  // New feature state
  const [priorities, setPriorities] = useState<{priority_code:string; priority_name:string; color:string}[]>([])
  const [tags, setTags] = useState<{tag_id:string; tag_name:string; tag_color:string}[]>([])
  const [ticketTags, setTicketTags] = useState<Map<string, string[]>>(new Map()) // ticket_id -> tag_names[]
  const [templates, setTemplates] = useState<{ticket_template_id:string; template_name:string; template_type:string; category:string; priority:string; subject_template:string; body_template:string}[]>([])
  const [macros, setMacros] = useState<{macro_id:string; macro_name:string; trigger_type:string}[]>([])
  const [worklogDraft, setWorklogDraft] = useState({ duration_minutes: "", worklog_type: "billable", description: "" })
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showMacroMenu, setShowMacroMenu] = useState(false)
  const [brands, setBrands] = useState<{brand_id:string; brand_code:string; brand_name:string; is_default:boolean}[]>([])
  const [ticketTypes, setTicketTypes] = useState<{ticket_type_id:string; type_code:string; type_name:string}[]>([])
  const [createMode, setCreateMode] = useState(false)
  // Builder panel state
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  // MDM-style grid state
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const [ticketSortBy, setTicketSortBy] = useState<{ field: string; dir: "asc" | "desc" } | null>(null)
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketPageSize, setTicketPageSize] = useState(20)
  const [ticketGroupBy, setTicketGroupBy] = useState<string>("")
  const [ticketDragColumn, setTicketDragColumn] = useState<string>("")
  const [showTicketBulkActions, setShowTicketBulkActions] = useState(false)
  const [ticketGridSettingsOpen, setTicketGridSettingsOpen] = useState(true)
  const [ticketColWidths, setTicketColWidths] = useState<Record<string, number>>({})
  const [ticketResizing, setTicketResizing] = useState<{ col: string; startX: number; startWidth: number } | null>(null)
  const [ticketRowActionMenuId, setTicketRowActionMenuId] = useState<string>("")

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const data = await response.json().catch(() => ({}))
    if (!response.ok || (data && typeof data === "object" && "ok" in data && data.ok === false)) {
      throw new Error(String((data as { detail?: string }).detail ?? `Request failed with status ${response.status}`))
    }
    return data as T
  }

  async function loadPageData(): Promise<void> {
    setLoading(true)
    setMessage(null)
    try {
      const [summaryResp, ticketResp, articleResp, quotationResp, auditResp, priorityResp, tagResp, templateResp, macroResp, brandResp, ticketTypeResp] = await Promise.all([
        fetchJson<{ ok: boolean } & Summary>("/api/proxy/api/v1/sd/summary"),
        fetchJson<{ ok: boolean; items: TicketRow[] }>("/api/proxy/api/v1/sd/ticket"),
        fetchJson<{ ok: boolean; items: ArticleRow[] }>("/api/proxy/api/v1/sd/knowledge-article"),
        fetchJson<{ ok: boolean; items: QuotationPreview[] }>("/api/proxy/api/v1/sd/quotation"),
        fetchJson<{ ok: boolean; items: AuditRow[] }>("/api/proxy/api/v1/sd/changelog?limit=8"),
        fetchJson<{ ok: boolean; items: {priority_code:string;priority_name:string;color:string}[] }>("/api/proxy/api/v1/mdm/priority?limit=20").catch(() => ({ ok: true, items: [] })),
        fetchJson<{ ok: boolean; items: {tag_id:string;tag_name:string;tag_color:string}[] }>("/api/proxy/api/v1/mdm/tag?limit=200").catch(() => ({ ok: true, items: [] })),
        fetchJson<{ ok: boolean; items: {ticket_template_id:string;template_name:string;template_type:string;category:string;priority:string;subject_template:string;body_template:string}[] }>("/api/proxy/api/v1/mdm/ticket-template?limit=200").catch(() => ({ ok: true, items: [] })),
        fetchJson<{ ok: boolean; items: {macro_id:string;macro_name:string;trigger_type:string}[] }>("/api/proxy/api/v1/mdm/macro?limit=200").catch(() => ({ ok: true, items: [] })),
        fetchJson<{ ok: boolean; items: {brand_id:string;brand_code:string;brand_name:string;is_default:boolean}[] }>("/api/proxy/api/v1/mdm/brand?limit=50").catch(() => ({ ok: true, items: [] })),
        fetchJson<{ ok: boolean; items: {ticket_type_id:string;type_code:string;type_name:string}[] }>("/api/proxy/api/v1/mdm/ticket-type?limit=50").catch(() => ({ ok: true, items: [] })),
      ])
      setSummary(summaryResp)
      setTickets(ticketResp.items ?? [])
      setArticles(articleResp.items ?? [])
      setQuotations(quotationResp.items ?? [])
      setRecentAudit(auditResp.items ?? [])
      setPriorities((priorityResp as {items?:{priority_code:string;priority_name:string;color:string}[]}).items ?? [])
      setTags((tagResp as {items?:{tag_id:string;tag_name:string;tag_color:string}[]}).items ?? [])
      setTemplates((templateResp as {items?:{ticket_template_id:string;template_name:string;template_type:string;category:string;priority:string;subject_template:string;body_template:string}[]}).items ?? [])
      setMacros(((macroResp as {items?:{macro_id:string;macro_name:string;trigger_type:string}[]}).items ?? []).filter(m => m.trigger_type === "manual"))
      setBrands((brandResp as {items?:{brand_id:string;brand_code:string;brand_name:string;is_default:boolean}[]}).items ?? [])
      setTicketTypes((ticketTypeResp as {items?:{ticket_type_id:string;type_code:string;type_name:string}[]}).items ?? [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load service desk data")
    } finally {
      setLoading(false)
    }
  }

  async function loadSlaData(): Promise<void> {
    setSlaLoading(true)
    try {
      const [defsResp] = await Promise.all([
        fetchJson<{ ok: boolean; items: SlaDefinition[] }>("/api/proxy/api/v1/mdm/sla?limit=100"),
      ])
      setSlaDefinitions((defsResp.items ?? []).filter(d => d.status === "active"))
      // Load SLA status for open tickets
      const openTickets = tickets.filter(t => ["open", "in-progress", "pending"].includes(t.status))
      const newStatuses = new Map<string, SlaStatus>()
      for (const t of openTickets.slice(0, 20)) {
        try {
          const status = await fetchJson<SlaStatus>(`/api/proxy/api/v1/sd/sla/status/${encodeURIComponent(t.ticket_id)}`)
          if (status.ok) newStatuses.set(t.ticket_id, status)
        } catch { /* skip */ }
      }
      setSlaStatuses(newStatuses)
    } catch (error) {
      /* SLA data is non-critical */
    } finally {
      setSlaLoading(false)
    }
  }

  async function loadDrawerContext(entity: DrawerEntity, id: string): Promise<void> {
    setDrawerAuditLoading(true)
    setCommentsLoading(entity === "ticket")
    try {
      const auditResp = await fetchJson<{ ok: boolean; items: AuditRow[] }>(
        `/api/proxy/api/v1/sd/changelog?entity=${encodeURIComponent(entity === "ticket" ? "ticket" : "knowledge_article")}&record_id=${encodeURIComponent(id)}&limit=8`
      )
      setDrawerAudit(auditResp.items ?? [])
      if (entity === "ticket") {
        const commentsResp = await fetchJson<{ ok: boolean; items: CommentRow[] }>(`/api/proxy/api/v1/sd/comment?ticket_id=${encodeURIComponent(id)}`)
        setComments(commentsResp.items ?? [])
        // Load ticket tags
        try {
          const tagResp = await fetchJson<{ ok: boolean; items: {tag_id:string; ticket_id:string}[] }>(
            `/api/proxy/api/v1/mdm/ticket-tag?ticket_id=${encodeURIComponent(id)}&limit=100`
          )
          const tagIds = (tagResp.items ?? []).map(tt => tt.tag_id)
          // Resolve tag names from loaded tags state
          setTicketTags(prev => {
            const next = new Map(prev)
            next.set(id, tagIds)
            return next
          })
        } catch { /* tags non-critical */ }
      } else {
        setComments([])
      }
    } catch (error) {
      setDrawerAudit([])
      setComments([])
      setMessage(error instanceof Error ? error.message : "Failed to load drawer data")
    } finally {
      setDrawerAuditLoading(false)
      setCommentsLoading(false)
    }
  }

  function openDrawer(entity: DrawerEntity, mode: DrawerMode, row?: TicketRow | ArticleRow | null): void {
    const nextRow = row ?? null
    setDrawerEntity(entity)
    setDrawerMode(mode)
    setDrawerRow(nextRow)
    setDrawerForm(
      nextRow
        ? entity === "ticket"
          ? {
              ticket_code: (nextRow as TicketRow).ticket_code,
              subject: (nextRow as TicketRow).subject,
              requester: (nextRow as TicketRow).requester,
              requester_org: (nextRow as TicketRow).requester_org,
              category: (nextRow as TicketRow).category,
              priority: (nextRow as TicketRow).priority,
              status: (nextRow as TicketRow).status,
              assignee: (nextRow as TicketRow).assignee,
              channel: (nextRow as TicketRow).channel,
              summary: (nextRow as TicketRow).summary,
              brand: ((nextRow as TicketRow) as Record<string, unknown>).brand as string ?? "",
              ticket_type: ((nextRow as TicketRow) as Record<string, unknown>).ticket_type as string ?? "",
              description: ((nextRow as TicketRow) as Record<string, unknown>).description as string ?? "",
              requester_cc: ((nextRow as TicketRow) as Record<string, unknown>).requester_cc as string ?? "",
              watchers: ((nextRow as TicketRow) as Record<string, unknown>).watchers as string ?? "",
              auto_assign: ((nextRow as TicketRow) as Record<string, unknown>).auto_assign ? "true" : "false",
              is_internal: ((nextRow as TicketRow) as Record<string, unknown>).is_internal ? "true" : "false",
            }
          : {
              article_code: (nextRow as ArticleRow).article_code,
              title: (nextRow as ArticleRow).title,
              category: (nextRow as ArticleRow).category,
              status: (nextRow as ArticleRow).status,
              author: (nextRow as ArticleRow).author,
              summary: (nextRow as ArticleRow).summary,
              body: (nextRow as ArticleRow).body,
              tags: (nextRow as ArticleRow).tags.join(", "),
            }
        : emptyDrawerForm(entity)
    )
    setDrawerOpen(true)
    setCommentDraft("")
    void loadDrawerContext(entity, nextRow ? (entity === "ticket" ? (nextRow as TicketRow).ticket_id : (nextRow as ArticleRow).article_id) : "")
  }

  function closeDrawer(): void {
    setDrawerOpen(false)
    setDrawerRow(null)
    setDrawerAudit([])
    setComments([])
    setCommentDraft("")
  }

  async function saveDrawer(): Promise<void> {
    if (drawerMode === "view") return
    setSubmitting(true)
    setMessage(null)
    try {
      const base = drawerEntity === "ticket" ? "/api/proxy/api/v1/sd/ticket" : "/api/proxy/api/v1/sd/knowledge-article"
      const isEdit = Boolean(drawerRow && drawerMode === "edit")
      const id = drawerRow ? (drawerEntity === "ticket" ? (drawerRow as TicketRow).ticket_id : (drawerRow as ArticleRow).article_id) : ""
      const payload = drawerEntity === "ticket"
        ? {
            ticket_code: drawerForm.ticket_code,
            subject: drawerForm.subject,
            requester: drawerForm.requester,
            requester_org: drawerForm.requester_org,
            category: drawerForm.category,
            priority: drawerForm.priority,
            status: drawerForm.status,
            assignee: drawerForm.assignee,
            channel: drawerForm.channel,
            summary: drawerForm.summary,
            brand: drawerForm.brand,
            ticket_type: drawerForm.ticket_type,
            description: drawerForm.description,
            requester_cc: drawerForm.requester_cc,
            watchers: drawerForm.watchers,
            auto_assign: drawerForm.auto_assign === "true",
            is_internal: drawerForm.is_internal === "true",
          }
        : {
            article_code: drawerForm.article_code,
            title: drawerForm.title,
            category: drawerForm.category,
            status: drawerForm.status,
            author: drawerForm.author,
            summary: drawerForm.summary,
            body: drawerForm.body,
            tags: String(drawerForm.tags ?? "").split(",").map((v) => v.trim()).filter(Boolean),
          }
      const response = await fetch(isEdit ? `${base}/${encodeURIComponent(id)}` : base, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) throw new Error(data?.detail ?? `Save failed with status ${response.status}`)
      await loadPageData()
      const savedId = drawerEntity === "ticket" ? data.item.ticket_id : data.item.article_id
      setDrawerRow(data.item)
      await loadDrawerContext(drawerEntity, savedId)
      setDrawerMode("view")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save record")
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteDrawer(): Promise<void> {
    if (!drawerRow) return
    setSubmitting(true)
    try {
      const base = drawerEntity === "ticket" ? "/api/proxy/api/v1/sd/ticket" : "/api/proxy/api/v1/sd/knowledge-article"
      const id = drawerEntity === "ticket" ? (drawerRow as TicketRow).ticket_id : (drawerRow as ArticleRow).article_id
      const response = await fetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) throw new Error(data?.detail ?? `Delete failed with status ${response.status}`)
      closeDrawer()
      await loadPageData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete record")
    } finally {
      setSubmitting(false)
    }
  }

  function setDrawerStatus(nextStatus: string): void {
    setDrawerForm((prev) => ({ ...prev, status: nextStatus }))
  }

  async function addComment(): Promise<void> {
    if (!drawerRow || drawerEntity !== "ticket") return
    const body = commentDraft.trim()
    if (!body) return
    setSubmitting(true)
    try {
      const ticketId = (drawerRow as TicketRow).ticket_id
      const prefix = commentMode === "internal" ? "[Internal]" : "[Reply]"
      const commentBody = body.startsWith(prefix) ? body : `${prefix} ${body}`
      const response = await fetch("/api/proxy/api/v1/sd/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId, body: commentBody }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) throw new Error(data?.detail ?? `Comment failed with status ${response.status}`)
      setCommentDraft("")
      await loadDrawerContext("ticket", ticketId)
      await loadPageData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add comment")
    } finally {
      setSubmitting(false)
    }
  }

  function quotationPayload() {
    const quantity = Number(quotationForm.quantity)
    return {
      customer: quotationForm.customer.trim() || "Demo Customer",
      jurisdiction: quotationForm.jurisdiction.trim() || undefined,
      hsCode: quotationForm.hsCode.trim() || undefined,
      category: quotationForm.category.trim() || undefined,
      effectiveOn: quotationForm.effectiveOn,
      currency_code: quotationForm.currency_code.trim() || undefined,
      price_list_code: quotationForm.price_list_code.trim() || undefined,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    }
  }

  async function previewQuotation(): Promise<void> {
    setQuotationLoading(true)
    setMessage(null)
    try {
      const data = await fetchJson<{ ok: boolean; item: QuotationPreview }>("/api/proxy/api/v1/sd/quotation/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotationPayload()),
      })
      setQuotationPreview(data.item)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to preview quotation")
    } finally {
      setQuotationLoading(false)
    }
  }

  async function createQuotation(): Promise<void> {
    setQuotationLoading(true)
    setMessage(null)
    try {
      const data = await fetchJson<{ ok: boolean; item: QuotationPreview }>("/api/proxy/api/v1/sd/quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotationPayload()),
      })
      setQuotationPreview(data.item)
      setMessage(`Quotation ${data.item.quotation_code ?? ""} created.`)
      await loadPageData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create quotation")
    } finally {
      setQuotationLoading(false)
    }
  }

  useEffect(() => {
    setShowLeftPanel(false)
    setShowRightPanel(false)
  }, [activeItem])

  useEffect(() => {
    if (drawerOpen) {
      setShowLeftPanel(false)
      setShowRightPanel(false)
    }
  }, [drawerOpen])

  useEffect(() => {
    void loadPageData()
  }, [])

  useEffect(() => {
    if (activeTab === "sla" && tickets.length > 0) {
      void loadSlaData()
    }
  }, [activeTab, tickets.length])

  const summaryState = summary ?? {
    tickets: 0,
    knowledgeArticles: 0,
    comments: 0,
    openTickets: 0,
    urgentTickets: 0,
    avgResponse: "0h",
    resolutionRate: "0%",
    satisfaction: "0%",
  }

  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    // Agent/status filter tabs
    if (agentFilter === "unassigned" && (ticket.assignee ?? "").toLowerCase() !== "unassigned") return false
    if (agentFilter === "pending" && ticket.status !== "pending") return false
    if (agentFilter === "open" && ticket.status !== "open") return false
    // Column filters
    if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String((ticket as Record<string, unknown>)[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
    if (!searchQuery.trim()) return true
    const hay = [ticket.ticket_code, ticket.subject, ticket.requester, ticket.requester_org, ticket.category, ticket.assignee, ticket.summary].join(" ").toLowerCase()
    return hay.includes(searchQuery.toLowerCase())
  }), [agentFilter, columnFilters, searchQuery, tickets])

  const filteredArticles = useMemo(() => articles.filter((article) => {
    if (!Object.entries(columnFilters).every(([col, val]) => !val.trim() || String((article as Record<string, unknown>)[col] ?? "").toLowerCase().includes(val.trim().toLowerCase()))) return false
    if (!searchQuery.trim()) return true
    const hay = [article.article_code, article.title, article.category, article.summary, article.author, article.tags.join(" "), article.body].join(" ").toLowerCase()
    return hay.includes(searchQuery.toLowerCase())
  }), [articles, columnFilters, searchQuery])

  const selectedTicket = drawerEntity === "ticket" ? (drawerRow as TicketRow | null) : null
  const selectedArticle = drawerEntity === "knowledge-article" ? (drawerRow as ArticleRow | null) : null
  const showCompact = activeItem === "sd" || activeItem === "tickets"

  const queryFields = useMemo<QBField[]>(() => {
    switch (activeTab) {
      case "tickets":
        return [
          { field: "ticket_code", label: "Ticket", type: "string" },
          { field: "subject", label: "Subject", type: "string" },
          { field: "requester", label: "Requester", type: "string" },
          { field: "priority", label: "Priority", type: "select", options: ["urgent", "high", "medium", "low"] },
          { field: "status", label: "Status", type: "select", options: ["open", "in-progress", "pending", "resolved", "closed"] },
          { field: "assignee", label: "Assignee", type: "string" },
          { field: "updated_at", label: "Updated", type: "date" },
        ]
      case "knowledge":
        return [
          { field: "article_code", label: "Article Code", type: "string" },
          { field: "title", label: "Title", type: "string" },
          { field: "category", label: "Category", type: "string" },
          { field: "status", label: "Status", type: "select", options: ["draft", "published", "archived"] },
          { field: "view_count", label: "View Count", type: "number" },
        ]
      case "sla":
        return [
          { field: "ticket_code", label: "Ticket", type: "string" },
          { field: "subject", label: "Subject", type: "string" },
          { field: "sla_name", label: "SLA Policy", type: "string" },
          { field: "response_remaining_hours", label: "Response", type: "number" },
          { field: "resolution_remaining_hours", label: "Resolution", type: "number" },
          { field: "sla_status", label: "Status", type: "select", options: ["On Track", "At Risk", "Breached", "No SLA"] },
        ]
      default:
        return []
    }
  }, [activeTab])

  async function addWorklog(): Promise<void> {
    if (!drawerRow || drawerEntity !== "ticket") return
    const mins = Number(worklogDraft.duration_minutes)
    if (!mins || mins <= 0) return
    setSubmitting(true)
    try {
      await fetchJson("/api/proxy/api/v1/mdm/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: (drawerRow as TicketRow).ticket_id,
          agent: "Current User",
          duration_minutes: mins,
          worklog_type: worklogDraft.worklog_type,
          description: worklogDraft.description,
          logged_at: new Date().toISOString(),
        }),
      })
      setWorklogDraft({ duration_minutes: "", worklog_type: "billable", description: "" })
      setMessage("Worklog entry added")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add worklog")
    } finally {
      setSubmitting(false)
    }
  }

  async function executeMacro(macroId: string): Promise<void> {
    if (!drawerRow || drawerEntity !== "ticket") return
    setSubmitting(true)
    setShowMacroMenu(false)
    try {
      await fetchJson("/api/proxy/api/v1/sd/macro/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macro_id: macroId,
          ticket_id: (drawerRow as TicketRow).ticket_id,
        }),
      })
      setMessage("Macro executed successfully")
      await loadPageData()
      const ticketId = (drawerRow as TicketRow).ticket_id
      const refreshed = (await fetchJson<{ ok:boolean; items: TicketRow[] }>(`/api/proxy/api/v1/sd/ticket?ticket_id=${encodeURIComponent(ticketId)}`)).items?.[0]
      if (refreshed) {
        setDrawerRow(refreshed)
        setDrawerForm({
          ticket_code: refreshed.ticket_code,
          subject: refreshed.subject,
          requester: refreshed.requester,
          requester_org: refreshed.requester_org,
          category: refreshed.category,
          priority: refreshed.priority,
          status: refreshed.status,
          assignee: refreshed.assignee,
          channel: refreshed.channel,
          summary: refreshed.summary,
        })
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to execute macro")
    } finally {
      setSubmitting(false)
    }
  }

  function applyTemplate(tpl: typeof templates[0]): void {
    setDrawerForm(prev => ({
      ...prev,
      category: tpl.category || prev.category,
      priority: tpl.priority || prev.priority,
      subject: tpl.subject_template || prev.subject,
      summary: tpl.body_template || prev.summary,
    }))
    setShowTemplatePicker(false)
  }

  function getPriorityColor(priorityCode: string): string | undefined {
    return priorities.find(p => p.priority_code === priorityCode)?.color
  }

  // === MDM-style grid helpers ===
  function startTicketColResize(col: string, e: React.MouseEvent) {
    e.preventDefault()
    const currentWidth = ticketColWidths[col] ?? 0
    setTicketResizing({ col, startX: e.clientX, startWidth: currentWidth || 120 })
    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - ticketResizing!.startX
      setTicketColWidths((prev) => ({ ...prev, [col]: Math.max(60, (ticketResizing!.startWidth || 120) + delta) }))
    }
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      setTicketResizing(null)
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  function toggleTicketRowSelection(id: string) {
    setSelectedRowIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function ticketSelectAll(visibleIds: string[]) {
    const allSelected = visibleIds.every((id) => selectedRowIds.includes(id))
    if (allSelected) {
      setSelectedRowIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedRowIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  function getSortedTickets(rows: TicketRow[]): TicketRow[] {
    if (!ticketSortBy) return rows
    const { field, dir } = ticketSortBy
    return [...rows].sort((a, b) => {
      const va = String((a as Record<string, unknown>)[field] ?? "")
      const vb = String((b as Record<string, unknown>)[field] ?? "")
      const cmp = va.localeCompare(vb)
      return dir === "asc" ? cmp : -cmp
    })
  }

  function getGroupedTickets(rows: TicketRow[]): { key: string; rows: TicketRow[] }[] {
    if (!ticketGroupBy) return [{ key: "", rows }]
    const groups = new Map<string, TicketRow[]>()
    for (const r of rows) {
      const val = String((r as Record<string, unknown>)[ticketGroupBy] ?? "—")
      if (!groups.has(val)) groups.set(val, [])
      groups.get(val)!.push(r)
    }
    return Array.from(groups.entries()).map(([key, rows]) => ({ key, rows }))
  }

  async function bulkTicketStatusUpdate(newStatus: TicketStatus): Promise<void> {
    if (!selectedRowIds.length) return
    setSubmitting(true)
    try {
      for (const id of selectedRowIds) {
        await fetch(`/api/proxy/api/v1/sd/ticket/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
      }
      setMessage(`${selectedRowIds.length} ticket(s) updated to ${newStatus}`)
      setSelectedRowIds([])
      await loadPageData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk update failed")
    } finally {
      setSubmitting(false)
    }
  }

  // Pagination
  const visibleTicketCols = TICKET_TABLE_COLS.filter(([field]) => !hiddenColumns.includes(field))
  const sortedTickets = getSortedTickets(filteredTickets)
  const groupedTickets = getGroupedTickets(sortedTickets)
  const totalTicketRows = sortedTickets.length
  const totalTicketPages = Math.max(1, Math.ceil(totalTicketRows / ticketPageSize))
  const pagedTickets = sortedTickets.slice((ticketPage - 1) * ticketPageSize, ticketPage * ticketPageSize)
  const pagedTicketIds = pagedTickets.map((t) => t.ticket_id)

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-background", showCompact && "")}>
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Headset className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">SD Service Desk</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!drawerOpen && (
            <button
              onClick={() => setShowLeftPanel((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${!showLeftPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              Query
            </button>
            )}
            {!drawerOpen && (
            <button
              onClick={() => setShowRightPanel((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${!showRightPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              Builder
            </button>
            )}
            <Button variant="outline" size="sm" onClick={() => void loadPageData()} className="h-9 gap-2 px-3 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => { setCreateMode(true); setDrawerEntity("ticket"); setDrawerMode("create"); setDrawerRow(null); setDrawerForm(emptyDrawerForm("ticket")) }} className="h-9 gap-2 px-4 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" />
              New Ticket
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-muted/20 px-6 py-4 space-y-3">
        {message && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{message}</div>
        )}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {([
            { label: "Open Tickets", icon: TicketIcon, value: summaryState.openTickets, change: `Total ${summaryState.tickets}`, trend: "up" as const },
            { label: "Avg Response", icon: Clock3, value: summaryState.avgResponse, change: "Target 2h", trend: "down" as const },
            { label: "Resolution Rate", icon: CheckCircle2, value: summaryState.resolutionRate, change: `${summaryState.knowledgeArticles} articles`, trend: "up" as const },
            { label: "Satisfaction", icon: Star, value: summaryState.satisfaction, change: `${summaryState.comments} comments`, trend: "up" as const },
          ]).map((kpi) => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className={cn("flex items-center gap-1 text-xs font-medium", kpi.trend === "up" ? "text-blue-600" : "text-amber-600")}>
                    {kpi.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {kpi.change}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-semibold tracking-tight">{kpi.value}</div>
                  <div className="text-xs text-muted-foreground">{kpi.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto px-4 pt-3 pb-4">
        {showLeftPanel && (
          <aside className="relative w-[342px] shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden">
            <WorkbenchCard title="Query Conditions" badge={`${queryGroup.conditions.length + queryGroup.groups.length} rules`}>
              <QueryBuilder fields={queryFields} query={queryGroup} onChange={setQueryGroup} storageKey={`qb.sd.${activeTab}`} />
            </WorkbenchCard>
          </aside>
        )}
        <div className={cn("flex-1 overflow-auto", drawerOpen && "pr-[480px]")}>

        {createMode ? (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create Ticket</h2>
              <Button variant="ghost" size="sm" onClick={() => setCreateMode(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>

            {/* Template picker */}
            {templates.filter(t => t.template_type === "ticket").length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Choose a Template:</span>
                <div className="relative">
                  <button onClick={() => setShowTemplatePicker(v => !v)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                    Select template...
                  </button>
                  {showTemplatePicker && (
                    <div className="absolute top-full left-0 mt-1 min-w-[220px] rounded-md border border-border bg-card p-1 shadow-lg z-10">
                      {templates.filter(t => t.template_type === "ticket").map(tpl => (
                        <button key={tpl.ticket_template_id} type="button" onClick={() => applyTemplate(tpl)}
                          className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted">
                          {tpl.template_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[1fr_320px] gap-6">
              {/* Left column - main form */}
              <div className="space-y-4">
                {/* Brand + Private toggle row */}
                <div className="flex items-end gap-4">
                  <label className="flex-1 block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Brand *</span>
                    <select value={drawerForm.brand} onChange={e => setDrawerForm(prev => ({...prev, brand: e.target.value}))}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                      <option value="">Select brand...</option>
                      {brands.map(b => <option key={b.brand_code} value={b.brand_code}>{b.brand_name}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 pb-2 cursor-pointer">
                    <input type="checkbox" checked={drawerForm.is_internal === "true"} onChange={e => setDrawerForm(prev => ({...prev, is_internal: e.target.checked ? "true" : "false"}))}
                      className="h-4 w-4 rounded border-border" />
                    <span className="text-sm text-muted-foreground">Make this ticket private</span>
                  </label>
                </div>

                {/* Requester row */}
                <div className="flex items-end gap-3">
                  <label className="flex-1 block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Requester *</span>
                    <input value={drawerForm.requester} onChange={e => setDrawerForm(prev => ({...prev, requester: e.target.value}))}
                      placeholder="Enter requester email"
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                  </label>
                  <Button variant="outline" size="sm" className="h-10 text-xs" onClick={() => setDrawerForm(prev => ({...prev, requester: "nate.lzy78@gmail.com"}))}>Add Me</Button>
                </div>

                {/* CC */}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">CC</span>
                  <input value={drawerForm.requester_cc} onChange={e => setDrawerForm(prev => ({...prev, requester_cc: e.target.value}))}
                    placeholder="Comma-separated emails"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                </label>

                {/* Subject */}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Subject *</span>
                  <input value={drawerForm.subject} onChange={e => setDrawerForm(prev => ({...prev, subject: e.target.value}))}
                    placeholder="Enter ticket subject"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                </label>

                {/* Description */}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Description *</span>
                  <textarea value={drawerForm.description} onChange={e => setDrawerForm(prev => ({...prev, description: e.target.value}))}
                    placeholder="Describe the issue..."
                    className="min-h-[180px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                </label>

                {/* Attachment placeholder */}
                <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Drop files here or click to browse
                </div>
              </div>

              {/* Right column - metadata */}
              <div className="space-y-4">
                {/* Assignee */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="text-xs font-medium text-muted-foreground">Assignee</div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="assign_mode" checked={drawerForm.auto_assign === "true"} onChange={() => setDrawerForm(prev => ({...prev, auto_assign: "true"}))} />
                      <span className="text-sm">Auto Assign</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="assign_mode" checked={drawerForm.auto_assign !== "true"} onChange={() => setDrawerForm(prev => ({...prev, auto_assign: "false"}))} />
                      <span className="text-sm">Select Agent</span>
                    </label>
                  </div>
                  {drawerForm.auto_assign !== "true" && (
                    <input value={drawerForm.assignee} onChange={e => setDrawerForm(prev => ({...prev, assignee: e.target.value}))}
                      placeholder="Agent name or email"
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                  )}
                </div>

                {/* Priority */}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Priority *</span>
                  <select value={drawerForm.priority} onChange={e => setDrawerForm(prev => ({...prev, priority: e.target.value}))}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                    {priorities.length > 0 ? priorities.map(p => (
                      <option key={p.priority_code} value={p.priority_code}>{p.priority_name}</option>
                    )) : (
                      <>
                        <option value="low">Low</option><option value="normal">Normal</option>
                        <option value="high">High</option><option value="critical">Critical</option>
                      </>
                    )}
                  </select>
                </label>

                {/* Type */}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Type</span>
                  <select value={drawerForm.ticket_type} onChange={e => setDrawerForm(prev => ({...prev, ticket_type: e.target.value}))}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                    <option value="">Select type...</option>
                    {ticketTypes.map(t => <option key={t.type_code} value={t.type_code}>{t.type_name}</option>)}
                  </select>
                </label>

                {/* Tags */}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Tags</span>
                  <input value={drawerForm.tags ?? ""} onChange={e => setDrawerForm(prev => ({...prev, tags: e.target.value}))}
                    placeholder="Add tags (comma-separated)"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                </label>

                {/* Watchers */}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Watchers</span>
                  <input value={drawerForm.watchers} onChange={e => setDrawerForm(prev => ({...prev, watchers: e.target.value}))}
                    placeholder="Comma-separated emails"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                </label>

                {/* Category */}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Category</span>
                  <input value={drawerForm.category} onChange={e => setDrawerForm(prev => ({...prev, category: e.target.value}))}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                  <input type="checkbox" className="h-4 w-4 rounded border-border" />
                  Don&apos;t send email notification
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setCreateMode(false)} className="h-9 px-4 text-xs">Cancel</Button>
                <Button size="sm" onClick={async () => { await saveDrawer(); setCreateMode(false) }} disabled={submitting} className="h-9 gap-2 px-4 text-xs font-medium">
                  <Save className="h-3.5 w-3.5" /> Create Ticket
                </Button>
              </div>
            </div>
          </div>
        ) : (
        <>
        {activeTab === "tickets" && (
          <>
            {/* MDM-style grid container */}
            <div className="rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm flex flex-col min-h-0">
              {/* Ticket filter tabs */}
              <div className="flex items-center gap-2 flex-wrap border-b border-border px-4 py-2.5">
                {[
                  { id: "all" as const, label: "All Tickets", count: tickets.length },
                  { id: "mine" as const, label: "Assigned to Me", count: null },
                  { id: "unassigned" as const, label: "Unassigned", count: tickets.filter(t => (t.assignee ?? "").toLowerCase() === "unassigned").length },
                  { id: "pending" as const, label: "Pending", count: tickets.filter(t => t.status === "pending").length },
                  { id: "open" as const, label: "Open", count: tickets.filter(t => t.status === "open").length },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setAgentFilter(f.id as typeof agentFilter)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      agentFilter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {f.label}
                    {f.count !== null && <span className="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">{f.count}</span>}
                  </button>
                ))}
              </div>
              {/* Group-by drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={(e) => { e.preventDefault(); if (ticketDragColumn) setTicketGroupBy(ticketDragColumn); setTicketDragColumn("") }}
                className="flex items-center justify-between gap-2 border-b border-dashed border-border px-4 py-2 text-xs text-muted-foreground"
              >
                {ticketGroupBy ? (
                  <span>Grouped by: <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{visibleTicketCols.find(([f]) => f === ticketGroupBy)?.[1] ?? ticketGroupBy}</span></span>
                ) : (
                  <span>Drag a column header here to group</span>
                )}
                {ticketGroupBy && <button onClick={() => setTicketGroupBy("")} className="rounded px-1 hover:text-destructive">Clear</button>}
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-2">
                <Button variant="outline" size="sm" onClick={() => { setCreateMode(true); setDrawerEntity("ticket"); setDrawerMode("create"); setDrawerRow(null); setDrawerForm(emptyDrawerForm("ticket")) }} className="h-8 px-3 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
                <Button variant="outline" size="sm" disabled={selectedRowIds.length === 0} onClick={() => { if (selectedRowIds.length === 1) { const t = tickets.find(x => x.ticket_id === selectedRowIds[0]); if (t) openDrawer("ticket", "edit", t) } }} className="h-8 px-3 text-xs disabled:opacity-40">Edit</Button>
                <Button variant="outline" size="sm" disabled={selectedRowIds.length === 0} onClick={() => void bulkTicketStatusUpdate("closed")} className="h-8 px-3 text-xs disabled:opacity-40">Close Selected</Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setShowTicketBulkActions((v) => !v)}
                  className={showTicketBulkActions ? "border-primary/40 bg-primary/10 text-primary" : ""}
                  title={showTicketBulkActions ? "Hide bulk actions" : "Show bulk actions"}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                {showTicketBulkActions && (
                  <>
                    <Button variant="outline" size="sm" disabled={selectedRowIds.length === 0} onClick={() => void bulkTicketStatusUpdate("open")} className="h-8 px-3 text-xs disabled:opacity-40">Set Open</Button>
                    <Button variant="outline" size="sm" disabled={selectedRowIds.length === 0} onClick={() => void bulkTicketStatusUpdate("in-progress")} className="h-8 px-3 text-xs disabled:opacity-40">Set In Progress</Button>
                    <Button variant="outline" size="sm" disabled={selectedRowIds.length === 0} onClick={() => void bulkTicketStatusUpdate("pending")} className="h-8 px-3 text-xs disabled:opacity-40">Set Pending</Button>
                    <Button variant="outline" size="sm" disabled={selectedRowIds.length === 0} onClick={() => void bulkTicketStatusUpdate("resolved")} className="h-8 px-3 text-xs disabled:opacity-40">Set Resolved</Button>
                  </>
                )}
                {selectedRowIds.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">{selectedRowIds.length} selected</span>
                )}
              </div>

              {/* Table */}
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
                    <tr>
                      {/* Select all checkbox */}
                      <th className="sticky left-0 z-20 bg-muted px-3 py-2 text-left" style={ticketColWidths.__select__ ? { width: ticketColWidths.__select__, minWidth: ticketColWidths.__select__ } : { width: 36, minWidth: 36 }}>
                        <input
                          type="checkbox"
                          checked={pagedTicketIds.length > 0 && pagedTicketIds.every((id) => selectedRowIds.includes(id))}
                          onChange={() => ticketSelectAll(pagedTicketIds)}
                        />
                      </th>
                      {/* Data columns */}
                      {visibleTicketCols.map(([field, label]) => {
                        const filterValue = columnFilters[field] ?? ""
                        return (
                          <th
                            key={field}
                            draggable
                            onDragStart={(e) => { setTicketDragColumn(field); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", field) }}
                            className="relative px-3 py-2 text-left"
                            style={ticketColWidths[field] ? { width: ticketColWidths[field], minWidth: ticketColWidths[field] } : undefined}
                          >
                            <div className="relative flex items-center justify-between gap-2 pr-4">
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setTicketSortBy((p) => (p?.field === field ? (p.dir === "asc" ? { field, dir: "desc" } : null) : { field, dir: "asc" }))}
                                  className="inline-flex items-center gap-1 hover:text-foreground"
                                >
                                  {label}
                                  <span className={`text-[10px] ${ticketSortBy?.field === field ? "text-primary" : "text-muted-foreground/50"}`}>
                                    {ticketSortBy?.field === field ? (ticketSortBy.dir === "asc" ? "▲" : "▼") : "↕"}
                                  </span>
                                </button>
                              </span>
                              <span className="inline-flex items-center gap-0.5">
                                <button
                                  type="button"
                                  className={cn("rounded p-1 hover:bg-muted", filterValue && "text-primary")}
                                  title={filterValue ? `Filtered: ${filterValue}` : `Filter ${label}`}
                                  onClick={(e) => { e.stopPropagation(); setFilterMenuColumn((cur) => (cur === field ? null : field)) }}
                                >
                                  <Filter size={13} fill={filterValue ? "currentColor" : "none"} />
                                </button>
                              </span>
                              {filterMenuColumn === field && (
                                <ColumnFilterPopover
                                  column={field}
                                  label={label}
                                  value={filterValue}
                                  onChange={(v) => setColumnFilters((cur) => ({ ...cur, [field]: v }))}
                                  onClear={() => setColumnFilters((cur) => ({ ...cur, [field]: "" }))}
                                  onClose={() => setFilterMenuColumn(null)}
                                />
                              )}
                              <span
                                onMouseDown={(e) => startTicketColResize(field, e)}
                                className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70"
                                title="Drag to resize"
                              />
                            </div>
                          </th>
                        )
                      })}
                      {/* Actions column */}
                      <th className="sticky right-0 z-20 bg-muted px-3 py-2 text-left" style={ticketColWidths.actions ? { width: ticketColWidths.actions, minWidth: ticketColWidths.actions } : { width: 100, minWidth: 100 }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={visibleTicketCols.length + 2} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading tickets...
                        </td>
                      </tr>
                    ) : totalTicketRows === 0 ? (
                      <tr>
                        <td colSpan={visibleTicketCols.length + 2} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          No tickets found for current filters.
                        </td>
                      </tr>
                    ) : (
                      groupedTickets.map((g, gi) => (
                        <React.Fragment key={`${g.key}-${gi}`}>
                          {ticketGroupBy && (
                            <tr className="border-t border-border/60 bg-muted/30">
                              <td colSpan={visibleTicketCols.length + 2} className="px-3 py-1.5 text-xs font-medium">
                                {visibleTicketCols.find(([f]) => f === ticketGroupBy)?.[1] ?? ticketGroupBy}: {g.key} ({g.rows.length})
                              </td>
                            </tr>
                          )}
                          {g.rows.map((ticket) => {
                            const isSelected = selectedRowIds.includes(ticket.ticket_id)
                            return (
                              <tr
                                key={ticket.ticket_id}
                                onClick={() => openDrawer("ticket", "view", ticket)}
                                className={`cursor-pointer border-t border-border/60 hover:bg-muted/30 ${isSelected ? "bg-primary/10" : ""}`}
                              >
                                {/* Checkbox */}
                                <td
                                  className="sticky left-0 z-10 bg-card px-3 py-2"
                                  style={ticketColWidths.__select__ ? { width: ticketColWidths.__select__, minWidth: ticketColWidths.__select__ } : { width: 36, minWidth: 36 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleTicketRowSelection(ticket.ticket_id)}
                                  />
                                </td>
                                {/* Data cells */}
                                {visibleTicketCols.map(([field]) => (
                                  <td key={field} className="px-3 py-2" style={ticketColWidths[field] ? { width: ticketColWidths[field], minWidth: ticketColWidths[field] } : undefined}>
                                    {field === "ticket_code" && <span className="font-medium text-primary">{ticket.ticket_code}</span>}
                                    {field === "subject" && (
                                      <div className="truncate max-w-[300px]" title={ticket.subject}>
                                        {ticket.subject}
                                        {(ticket as Record<string,unknown>).is_internal === true && (
                                          <span className="ml-2 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Internal</span>
                                        )}
                                      </div>
                                    )}
                                    {field === "requester" && <span className="text-muted-foreground truncate block max-w-[150px]">{ticket.requester}</span>}
                                    {field === "brand" && <span className="text-xs text-muted-foreground">{(ticket as Record<string,unknown>).brand ? String((ticket as Record<string,unknown>).brand) : "-"}</span>}
                                    {field === "priority" && (
                                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium" style={getPriorityColor(ticket.priority) ? { backgroundColor: getPriorityColor(ticket.priority) + "20", color: getPriorityColor(ticket.priority) } : undefined}>
                                        {getPriorityColor(ticket.priority) && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: getPriorityColor(ticket.priority) }} />}
                                        {ticket.priority}
                                      </span>
                                    )}
                                    {field === "status" && <span className={cn("rounded-full px-2 py-1 text-xs font-medium", statusPill(ticket.status))}>{ticket.status}</span>}
                                    {field === "assignee" && (
                                      <span className="text-muted-foreground">
                                        <span className="mr-1.5 text-xs" title={ticket.channel}>{channelIcon(ticket.channel)}</span>
                                        {ticket.assignee}
                                      </span>
                                    )}
                                    {field === "ticket_type" && <span className="text-xs text-muted-foreground">{(ticket as Record<string,unknown>).ticket_type ? String((ticket as Record<string,unknown>).ticket_type) : "-"}</span>}
                                    {field === "updated_at" && <span className="text-muted-foreground text-xs" title={ticket.created_at}>{timeAgo(ticket.created_at)}</span>}
                                    {field === "tags" && (
                                      <div className="flex flex-wrap gap-1">
                                        {(ticketTags.get(ticket.ticket_id) ?? []).slice(0, 3).map(tagId => {
                                          const tag = tags.find(t => t.tag_id === tagId)
                                          return tag ? (
                                            <span key={tagId} className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: (tag.tag_color || "#6b7280") + "20", color: tag.tag_color || "#6b7280" }}>
                                              {tag.tag_name}
                                            </span>
                                          ) : null
                                        })}
                                      </div>
                                    )}
                                  </td>
                                ))}
                                {/* Actions */}
                                <td className="sticky right-0 z-10 bg-card px-3 py-2" style={ticketColWidths.actions ? { width: ticketColWidths.actions, minWidth: ticketColWidths.actions } : { width: 100, minWidth: 100 }} onClick={(e) => e.stopPropagation()}>
                                  <div className="relative inline-flex">
                                    <button
                                      type="button"
                                      onClick={() => setTicketRowActionMenuId((v) => (v === ticket.ticket_id ? "" : ticket.ticket_id))}
                                      className={cn("rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", ticketRowActionMenuId === ticket.ticket_id && "bg-primary/10 text-primary")}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                    {ticketRowActionMenuId === ticket.ticket_id && (
                                      <div className="absolute right-0 top-7 z-20 min-w-[120px] rounded-md border border-border bg-popover p-1 shadow-lg">
                                        <button onClick={() => { setTicketRowActionMenuId(""); openDrawer("ticket", "view", ticket) }} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted">View</button>
                                        <button onClick={() => { setTicketRowActionMenuId(""); openDrawer("ticket", "edit", ticket) }} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted">Edit</button>
                                        <button onClick={() => { setTicketRowActionMenuId(""); void bulkTicketStatusUpdate("resolved") }} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted">Resolve</button>
                                        <button onClick={() => { setTicketRowActionMenuId(""); void bulkTicketStatusUpdate("closed") }} className="block w-full rounded px-2 py-1 text-left text-xs text-destructive hover:bg-muted">Close</button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>Page {ticketPage} of {totalTicketPages} ({totalTicketRows} rows)</span>
                <div className="flex items-center gap-2">
                  <select value={String(ticketPageSize)} onChange={(e) => { setTicketPageSize(Number(e.target.value)); setTicketPage(1) }} className="rounded border border-border bg-background px-2 py-1 text-xs">
                    <option value="12">12</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <button disabled={ticketPage <= 1} onClick={() => setTicketPage((p) => Math.max(1, p - 1))} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button>
                    <button disabled={ticketPage >= totalTicketPages} onClick={() => setTicketPage((p) => Math.min(totalTicketPages, p + 1))} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "sla" && (
          <div className="space-y-4">
            {/* SLA Policy Cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {slaDefinitions.map((sla) => (
                <div key={sla.sla_id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{sla.sla_name}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{sla.sla_code}</div>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusPill(sla.status))}>{sla.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Priority</div>
                      <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 font-medium", priorityPill(sla.priority))}>{sla.priority}</span>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Category</div>
                      <div className="mt-0.5 font-medium">{sla.category || "All"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Response</div>
                      <div className="mt-0.5 font-semibold text-sm">{sla.response_time_hours}h</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Resolution</div>
                      <div className="mt-0.5 font-semibold text-sm">{sla.resolution_time_hours}h</div>
                    </div>
                  </div>
                  {sla.business_hours_only && (
                    <div className="mt-2 text-xs text-muted-foreground">⏱ Business hours only</div>
                  )}
                </div>
              ))}
              {!slaLoading && slaDefinitions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                  No SLA definitions found. Create one via <span className="font-medium text-primary">SLA Management</span> in the sidebar.
                </div>
              )}
            </div>

            {/* Breach Alerts */}
            {Array.from(slaStatuses.values()).filter(s => s.response_breached || s.resolution_breached).length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <span className="font-semibold text-sm text-red-800">SLA Breaches</span>
                </div>
                <div className="space-y-2">
                  {Array.from(slaStatuses.values()).filter(s => s.response_breached || s.resolution_breached).map((s) => {
                    const ticket = tickets.find(t => t.ticket_id === s.ticket_id)
                    return (
                      <div key={s.ticket_id} className="flex items-center gap-3 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs">
                        <span className="font-medium text-primary">{ticket?.ticket_code ?? s.ticket_id}</span>
                        <span className="text-muted-foreground truncate flex-1">{ticket?.subject ?? "-"}</span>
                        {s.response_breached && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Response Breached</span>}
                        {s.resolution_breached && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Resolution Breached</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Active Ticket SLA Table */}
            {slaStatuses.size > 0 && (
              <div className="rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <div className="text-base font-semibold">Active Ticket SLA Status</div>
                  <div className="text-xs text-muted-foreground">SLA progress for open tickets</div>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Ticket</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">SLA Policy</th>
                        <th className="px-4 py-3">Response</th>
                        <th className="px-4 py-3">Resolution</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(slaStatuses.entries()).map(([ticketId, status]) => {
                        const ticket = tickets.find(t => t.ticket_id === ticketId)
                        const responsePct = status.response_remaining_hours !== null && status.sla
                          ? Math.max(0, Math.min(100, (status.response_remaining_hours / (status.response_remaining_hours + ((Date.now() - new Date(ticket?.created_at ?? Date.now()).getTime()) / 3600000))) * 100))
                          : 100
                        const getBarColor = (pct: number) => pct > 50 ? "bg-green-500" : pct > 25 ? "bg-amber-500" : "bg-red-500"
                        const getStatusLabel = () => {
                          if (status.response_breached || status.resolution_breached) return "Breached"
                          if (!status.sla) return "No SLA"
                          const remaining = Math.min(status.response_remaining_hours ?? 999, status.resolution_remaining_hours ?? 999)
                          if (remaining < 0) return "Breached"
                          if (remaining < 2) return "At Risk"
                          return "On Track"
                        }
                        const getStatusColor = () => {
                          const label = getStatusLabel()
                          if (label === "Breached") return "bg-red-100 text-red-700"
                          if (label === "At Risk") return "bg-amber-100 text-amber-700"
                          return "bg-green-100 text-green-700"
                        }
                        return (
                          <tr key={ticketId} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer" onDoubleClick={() => { const t = tickets.find(x => x.ticket_id === ticketId); if (t) openDrawer("ticket", "view", t) }}>
                            <td className="px-4 py-3 font-medium text-primary">{ticket?.ticket_code ?? ticketId}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]">{ticket?.subject ?? "-"}</td>
                            <td className="px-4 py-3 text-xs">{status.sla?.sla_name ?? "-"}</td>
                            <td className="px-4 py-3">
                              {status.response_remaining_hours !== null ? (
                                <div>
                                  <div className="text-xs font-medium">{Math.round(status.response_remaining_hours * 10) / 10}h left</div>
                                  <div className="mt-1 h-1.5 w-20 rounded-full bg-muted"><div className={cn("h-1.5 rounded-full", getBarColor(responsePct))} style={{ width: `${responsePct}%` }} /></div>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </td>
                            <td className="px-4 py-3">
                              {status.resolution_remaining_hours !== null ? (
                                <div>
                                  <div className="text-xs font-medium">{Math.round(status.resolution_remaining_hours * 10) / 10}h left</div>
                                  <div className="mt-1 h-1.5 w-20 rounded-full bg-muted"><div className={cn("h-1.5 rounded-full", getBarColor(responsePct))} style={{ width: `${responsePct}%` }} /></div>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </td>
                            <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getStatusColor())}>{getStatusLabel()}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredArticles.map((article) => (
              <button key={article.article_id} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-muted/30" onDoubleClick={() => openDrawer("knowledge-article", "view", article)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{article.article_code}</div>
                    <div className="mt-1 text-base font-semibold">{article.title}</div>
                  </div>
                  <span className={cn("rounded-full px-2 py-1 text-xs font-medium", statusPill(article.status))}>{article.status}</span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{article.category}</span>
                  <span>{article.view_count} views</span>
                </div>
              </button>
            ))}
            {!filteredArticles.length && <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No knowledge articles found for the current filters.</div>}
          </div>
        )}

        {activeTab === "quotations" && (
          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-base font-semibold"><Calculator className="h-4 w-4 text-primary" />Quotation Preview</div>
                <p className="mt-1 text-xs text-muted-foreground">Build a sales quotation from applicable compliance requirements and price lists.</p>
              </div>
              <div className="space-y-3">
                {([
                  ["customer", "Customer"],
                  ["jurisdiction", "Jurisdiction"],
                  ["hsCode", "HS Code"],
                  ["category", "Product Category"],
                  ["currency_code", "Currency"],
                  ["price_list_code", "Price List Code"],
                  ["quantity", "Quantity"],
                ] as const).map(([field, label]) => (
                  <label key={field} className="block text-sm">
                    <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
                    <input
                      value={quotationForm[field]}
                      onChange={(e) => setQuotationForm((prev) => ({ ...prev, [field]: e.target.value }))}
                      placeholder={field === "price_list_code" ? "Optional, e.g. PL-SD-..." : undefined}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Effective On</span>
                  <input
                    type="date"
                    value={quotationForm.effectiveOn}
                    onChange={(e) => setQuotationForm((prev) => ({ ...prev, effectiveOn: e.target.value }))}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => void previewQuotation()} disabled={quotationLoading} className="h-9 flex-1 gap-2 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                  <Button size="sm" onClick={() => void createQuotation()} disabled={quotationLoading} className="h-9 flex-1 gap-2 text-xs">
                    <Save className="h-3.5 w-3.5" />
                    Create
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{quotationPreview?.quotation_code ?? "Draft Quotation"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {quotationPreview ? `${quotationPreview.customer} · ${quotationPreview.jurisdiction ?? "Any jurisdiction"} · ${quotationPreview.effectiveOn}` : "Preview a quote to calculate requirement-linked service lines."}
                    </div>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-right">
                    <div className="text-xs uppercase tracking-wide text-primary">Total</div>
                    <div className="text-lg font-semibold text-primary">{formatMoney(quotationPreview?.total, quotationPreview?.currency)}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Requirements</div><div className="mt-1 text-lg font-semibold">{quotationPreview?.requirement_count ?? 0}</div></div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Lines</div><div className="mt-1 text-lg font-semibold">{quotationPreview?.line_count ?? 0}</div></div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Resolved</div><div className="mt-1 text-lg font-semibold">{quotationPreview?.resolved_line_count ?? 0}</div></div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Unresolved</div><div className="mt-1 text-lg font-semibold">{quotationPreview?.unresolved_line_count ?? 0}</div></div>
                </div>
              </div>

              <div className="rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <div className="text-base font-semibold">Quote Lines</div>
                    <div className="text-xs text-muted-foreground">Generated from applicable requirements and SD price mapping.</div>
                  </div>
                  {quotationLoading && <div className="text-xs text-muted-foreground">Calculating...</div>}
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Requirement</th>
                        <th className="px-4 py-3">Service Item</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Pricing</th>
                        <th className="px-4 py-3">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quotationPreview?.lines ?? []).map((line) => (
                        <tr key={`${line.line_no}-${line.requirement_code}-${line.service_item_code}`} className="border-b border-border last:border-0">
                          <td className="px-4 py-3"><div className="font-medium text-primary">{line.requirement_code}</div><div className="text-xs text-muted-foreground">{line.requirement_title}</div></td>
                          <td className="px-4 py-3"><div className="font-medium">{line.service_item_code}</div><div className="text-xs text-muted-foreground">{line.service_item_name}</div></td>
                          <td className="px-4 py-3 text-muted-foreground">{line.qty}</td>
                          <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-1 text-xs font-medium", line.pricing_status === "resolved" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>{line.pricing_status}</span></td>
                          <td className="px-4 py-3 font-medium">{formatMoney(line.line_total, line.currency)}</td>
                        </tr>
                      ))}
                      {!(quotationPreview?.lines ?? []).length && (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No quote lines yet. Run preview to generate lines.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {quotations.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-3 text-base font-semibold">Recent Quotations</div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {quotations.slice(0, 4).map((quote) => (
                      <button key={quote.quotation_id ?? quote.quotation_code} type="button" onClick={() => setQuotationPreview(quote)} className="rounded-xl border border-border bg-muted/20 p-3 text-left transition hover:border-primary/40 hover:bg-muted/40">
                        <div className="flex items-center justify-between gap-3"><span className="font-medium">{quote.quotation_code}</span><span className="text-sm font-semibold">{formatMoney(quote.total, quote.currency)}</span></div>
                        <div className="mt-1 text-xs text-muted-foreground">{quote.customer} · {quote.line_count} lines · {formatDate(quote.created_at ?? "")}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "reports" && (() => {
          const statusData = [
            { name: "Open", value: tickets.filter(t => t.status === "open").length, color: "#06b6d4" },
            { name: "In Progress", value: tickets.filter(t => t.status === "in-progress").length, color: "#6366f1" },
            { name: "Pending", value: tickets.filter(t => t.status === "pending").length, color: "#f59e0b" },
            { name: "Resolved", value: tickets.filter(t => t.status === "resolved").length, color: "#3b82f6" },
            { name: "Closed", value: tickets.filter(t => t.status === "closed").length, color: "#6b7280" },
          ].filter(d => d.value > 0)
          const priorityData = [
            { name: "Urgent", value: tickets.filter(t => t.priority === "urgent").length, color: "#ef4444" },
            { name: "High", value: tickets.filter(t => t.priority === "high").length, color: "#f97316" },
            { name: "Medium", value: tickets.filter(t => t.priority === "medium").length, color: "#f59e0b" },
            { name: "Low", value: tickets.filter(t => t.priority === "low").length, color: "#3b82f6" },
          ].filter(d => d.value > 0)
          return (
          <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid gap-4 xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-xs uppercase tracking-wide text-muted-foreground">Tickets</div><div className="mt-1 text-2xl font-semibold">{summaryState.tickets}</div></div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-xs uppercase tracking-wide text-muted-foreground">Knowledge Articles</div><div className="mt-1 text-2xl font-semibold">{summaryState.knowledgeArticles}</div></div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-xs uppercase tracking-wide text-muted-foreground">Resolution Rate</div><div className="mt-1 text-2xl font-semibold">{summaryState.resolutionRate}</div></div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-xs uppercase tracking-wide text-muted-foreground">Satisfaction</div><div className="mt-1 text-2xl font-semibold">{summaryState.satisfaction}</div></div>
            </div>
            {/* Charts */}
            <div className="grid gap-4 xl:grid-cols-2">
              {/* Status Distribution - Pie Chart */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="text-sm font-semibold mb-3">Ticket Status Distribution</div>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                        {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="text-xs text-muted-foreground text-center py-10">No ticket data available</div>}
              </div>
              {/* Priority Distribution - Bar Chart */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="text-sm font-semibold mb-3">Priority Distribution</div>
                {priorityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={priorityData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="text-xs text-muted-foreground text-center py-10">No ticket data available</div>}
              </div>
            </div>
            {/* SLA stats summary */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="text-sm font-semibold mb-3">SLA Overview</div>
              {slaStatuses.size > 0 ? (
                <div className="grid gap-3 grid-cols-3">
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-green-600">{Array.from(slaStatuses.values()).filter(s => !s.response_breached && !s.resolution_breached && s.sla).length}</div>
                    <div className="text-xs text-muted-foreground">On Track</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-amber-600">{Array.from(slaStatuses.values()).filter(s => (s.response_remaining_hours ?? 999) < 2 && !s.response_breached && !s.resolution_breached).length}</div>
                    <div className="text-xs text-muted-foreground">At Risk</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-red-600">{Array.from(slaStatuses.values()).filter(s => s.response_breached || s.resolution_breached).length}</div>
                    <div className="text-xs text-muted-foreground">Breached</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">SLA data not loaded. Switch to the SLA tab to load.</div>
              )}
            </div>
          </div>
          )
        })()}
        </>
        )}
      </div>
        {showRightPanel && <aside className="w-[280px] shrink-0 space-y-3 self-stretch overflow-y-auto">
          {/* Grid Settings — MDM-style */}
          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setTicketGridSettingsOpen((v) => !v)}
              aria-expanded={ticketGridSettingsOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 text-sm font-semibold">Grid Settings</span>
              <span className={`text-muted-foreground transition-transform ${ticketGridSettingsOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {ticketGridSettingsOpen && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              {/* Group By */}
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Group By</div>
                <select value={ticketGroupBy} onChange={(e) => setTicketGroupBy(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                  <option value="">None</option>
                  {visibleTicketCols.map(([f, l]) => <option key={f} value={f}>{l}</option>)}
                </select>
              </div>
              {/* Page Size */}
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Page Size</div>
                <select value={String(ticketPageSize)} onChange={(e) => { setTicketPageSize(Number(e.target.value)); setTicketPage(1) }} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                  <option value="12">12</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
              {/* Column Chooser */}
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Column Chooser</div>
                <div className="max-h-48 overflow-auto rounded border border-border p-2">
                  {TICKET_TABLE_COLS.map(([field, label]) => {
                    const checked = !hiddenColumns.includes(field)
                    return (
                      <label key={field} className="mb-1 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setHiddenColumns((prev) => prev.filter((x) => x !== field))
                            else setHiddenColumns((prev) => (prev.includes(field) ? prev : [...prev, field]))
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    )
                  })}
                </div>
                <button onClick={() => setHiddenColumns([])} className="mt-2 w-full rounded border border-border px-2 py-1.5 text-xs">Show All Columns</button>
              </div>
            </div>
            )}
          </div>

          {/* Audit Trail */}
          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setAuditSectionOpen((v) => !v)}
              aria-expanded={auditSectionOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 text-sm font-semibold">Audit Trail</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{recentAudit.length} events</span>
              <span className={`text-muted-foreground transition-transform ${auditSectionOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {auditSectionOpen && (
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
              <div className="rounded border border-border p-2">
                <div className="mb-1 flex items-center justify-between text-xs font-medium">
                  <span>Recent Activity</span>
                  <button onClick={() => void loadPageData()} className="rounded border border-border px-1.5 py-0.5 text-[10px]">Refresh</button>
                </div>
                {recentAudit.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">No audit events.</div>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-auto">
                    {recentAudit.map((a) => (
                      <div key={a.change_id} className="rounded border border-border/60 p-1.5 text-[10px]">
                        <div className="font-medium capitalize">{a.entity.replace(/_/g, " ")} — {a.action}</div>
                        <div className="text-muted-foreground">{a.actor} · {a.changed_fields.join(", ") || "-"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </aside>}


      <div className={cn("fixed right-0 top-0 z-40 h-full w-[460px] border-l border-border bg-card shadow-2xl transition-transform duration-200", drawerOpen ? "translate-x-0" : "translate-x-full")}>
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{drawerEntity === "ticket" ? "Ticket Drawer" : "Knowledge Article Drawer"}</div>
              <h2 className="mt-1 text-lg font-semibold">{drawerEntity === "ticket" ? selectedTicket?.ticket_code ?? "New Ticket" : selectedArticle?.article_code ?? "New Article"}</h2>
            </div>
            <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={closeDrawer}><X className="h-4 w-4" /></Button>
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-4">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Record Summary</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{drawerEntity === "ticket" ? ((selectedTicket?.subject ?? drawerForm.subject) || "Create a service ticket") : ((selectedArticle?.title ?? drawerForm.title) || "Create a knowledge article")}</div>
                </div>
                <span className={cn("rounded-full px-2 py-1 text-xs font-medium", statusPill(drawerForm.status || (drawerEntity === "ticket" ? (selectedTicket?.status ?? "") : (selectedArticle?.status ?? ""))))}>{drawerForm.status || (drawerEntity === "ticket" ? (selectedTicket?.status ?? "-") : (selectedArticle?.status ?? "-"))}</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Owner</div><div className="mt-1 font-medium">{drawerEntity === "ticket" ? (selectedTicket?.requester ?? drawerForm.requester ?? "-") : (selectedArticle?.author ?? drawerForm.author ?? "-")}</div></div>
                <div className="rounded-lg border border-border bg-card p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Category</div><div className="mt-1 font-medium">{drawerForm.category || selectedTicket?.category || selectedArticle?.category || "-"}</div></div>
                <div className="rounded-lg border border-border bg-card p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Updated</div><div className="mt-1 font-medium">{timeAgo(drawerEntity === "ticket" ? selectedTicket?.updated_at ?? "" : selectedArticle?.updated_at ?? "")}</div></div>
                <div className="rounded-lg border border-border bg-card p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Version</div><div className="mt-1 font-medium">{drawerEntity === "ticket" ? selectedTicket?.version_no ?? 1 : selectedArticle?.version_no ?? 1}</div></div>
              </div>
              <div className="mt-4 rounded-lg border border-border bg-card p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Quick Status</div>
                <div className="flex flex-wrap gap-2">
                  {(drawerEntity === "ticket"
                    ? (["open", "in-progress", "pending", "resolved", "closed"] as const)
                    : (["draft", "published", "archived"] as const)
                  ).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setDrawerStatus(status)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        (drawerForm.status ?? "") === status
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              {/* SLA Timer for tickets */}
              {drawerEntity === "ticket" && selectedTicket && slaStatuses.has(selectedTicket.ticket_id) && (() => {
                const sla = slaStatuses.get(selectedTicket.ticket_id)!
                const remaining = sla.response_remaining_hours ?? sla.resolution_remaining_hours
                const pct = sla.sla ? Math.max(0, Math.min(100, ((remaining ?? 0) / (sla.response_remaining_hours !== null ? (sla.response_remaining_hours! + Math.abs(remaining ?? 0)) : 1)) * 100)) : 0
                const barColor = sla.response_breached || sla.resolution_breached ? "bg-red-500" : pct > 50 ? "bg-green-500" : pct > 25 ? "bg-amber-500" : "bg-red-500"
                const labelColor = sla.response_breached || sla.resolution_breached ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200"
                return (
                  <div className={cn("mt-4 rounded-lg border p-3", labelColor)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wide">SLA Timer</span>
                      </div>
                      <span className="text-xs font-medium">{sla.sla?.sla_name ?? "No SLA"}</span>
                    </div>
                    {remaining !== null && remaining !== undefined && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span>{Math.abs(Math.round(remaining * 10) / 10)}h {remaining >= 0 ? "remaining" : "overdue"}</span>
                          <span>{sla.response_breached ? "Response Breached" : sla.resolution_breached ? "Resolution Breached" : "On Track"}</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-muted">
                          <div className={cn("h-2 rounded-full transition-all", barColor)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {drawerMode === "create" && drawerEntity === "ticket" && templates.filter(t => t.template_type === "ticket").length > 0 && (
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-primary" />
                  Apply Template
                </div>
                <div className="flex flex-wrap gap-2">
                  {templates.filter(t => t.template_type === "ticket").map(tpl => (
                    <button
                      key={tpl.ticket_template_id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {tpl.template_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {drawerMode !== "view" && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Pencil className="h-4 w-4 text-primary" />{drawerMode === "create" ? "Create Record" : "Edit Record"}</div>
                <div className="space-y-3">
                  {drawerEntity === "ticket" ? (
                    <>
                      {(["ticket_code", "subject", "requester", "requester_org", "category", "assignee", "channel"] as const).map((field) => (
                        <label key={field} className="block text-sm">
                          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{field.replace(/_/g, " ")}</span>
                          <input value={drawerForm[field] ?? ""} onChange={(e) => setDrawerForm((prev) => ({ ...prev, [field]: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                        </label>
                      ))}
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Summary</span>
                        <textarea value={drawerForm.summary ?? ""} onChange={(e) => setDrawerForm((prev) => ({ ...prev, summary: e.target.value }))} className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Priority</span>
                          <select value={drawerForm.priority ?? "medium"} onChange={(e) => setDrawerForm((prev) => ({ ...prev, priority: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                            <option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                          </select>
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                          <select value={drawerForm.status ?? "open"} onChange={(e) => setDrawerForm((prev) => ({ ...prev, status: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                            <option value="open">Open</option><option value="in-progress">In Progress</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                          </select>
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      {(["article_code", "title", "author", "category"] as const).map((field) => (
                        <label key={field} className="block text-sm">
                          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{field.replace(/_/g, " ")}</span>
                          <input value={drawerForm[field] ?? ""} onChange={(e) => setDrawerForm((prev) => ({ ...prev, [field]: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                        </label>
                      ))}
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Summary</span>
                        <textarea value={drawerForm.summary ?? ""} onChange={(e) => setDrawerForm((prev) => ({ ...prev, summary: e.target.value }))} className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Body</span>
                        <textarea value={drawerForm.body ?? ""} onChange={(e) => setDrawerForm((prev) => ({ ...prev, body: e.target.value }))} className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
                        <input value={drawerForm.tags ?? ""} onChange={(e) => setDrawerForm((prev) => ({ ...prev, tags: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                        <select value={drawerForm.status ?? "draft"} onChange={(e) => setDrawerForm((prev) => ({ ...prev, status: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                          <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
              </div>
            )}

            {drawerEntity === "ticket" && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-primary" />Comments</div>
                  <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1 text-[11px]">
                    {(["internal", "reply"] as CommentMode[]).map((modeOption) => (
                      <button
                        key={modeOption}
                        type="button"
                        onClick={() => setCommentMode(modeOption)}
                        className={cn(
                          "rounded-full px-2.5 py-1 capitalize transition-colors",
                          commentMode === modeOption ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {modeOption}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {commentsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading comments...</div>
                  ) : comments.length ? comments.map((comment) => (
                    <div key={comment.comment_id} className={cn("rounded-lg border p-3 text-sm", comment.body.startsWith("[Internal]") ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50/50")}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{comment.author}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", comment.body.startsWith("[Internal]") ? "bg-amber-200 text-amber-800" : "bg-blue-200 text-blue-800")}>{comment.body.startsWith("[Internal]") ? "Internal Note" : "Public Reply"}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="mt-2 text-muted-foreground">{comment.body.replace(/^\[(Internal|Reply)\]\s*/i, "")}</p>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">No comments yet.</div>}
                  <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Comment mode</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 capitalize">{commentMode}</span>
                    </div>
                    <textarea value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder={commentMode === "internal" ? "Add internal note..." : "Add customer reply..."} className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                    <Button variant="outline" size="sm" onClick={() => void addComment()} disabled={submitting} className="h-9 gap-2 px-3 text-xs"><Send className="h-3.5 w-3.5" />Add Comment</Button>
                  </div>
                </div>
              </div>
            )}

            {drawerEntity === "ticket" && selectedTicket && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Log Work
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={worklogDraft.duration_minutes}
                      onChange={(e) => setWorklogDraft(prev => ({ ...prev, duration_minutes: e.target.value }))}
                      placeholder="Minutes"
                      className="h-9 w-24 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    />
                    <select
                      value={worklogDraft.worklog_type}
                      onChange={(e) => setWorklogDraft(prev => ({ ...prev, worklog_type: e.target.value }))}
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="billable">Billable</option>
                      <option value="non_billable">Non-Billable</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={worklogDraft.description}
                    onChange={(e) => setWorklogDraft(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Work description..."
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                  <Button variant="outline" size="sm" onClick={() => void addWorklog()} disabled={submitting || !worklogDraft.duration_minutes} className="h-8 gap-2 px-3 text-xs">
                    <Clock3 className="h-3.5 w-3.5" />
                    Log Time
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold"><div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" />Recent Audit</div><span className="text-xs font-normal text-muted-foreground">{drawerAudit.length} events</span></div>
              <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
                {drawerAuditLoading ? (
                  <div className="text-sm text-muted-foreground">Loading audit trail...</div>
                ) : drawerAudit.length ? drawerAudit.map((item) => (
                  <div key={item.change_id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3"><span className="font-medium capitalize">{item.action}</span><span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span></div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.actor}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Fields: {item.changed_fields.join(", ") || "-"}</div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No recent audit events found.</div>}
              </div>
            </div>
          </div>

          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">{drawerMode === "view" ? "View mode" : drawerMode === "create" ? "Create mode" : "Edit mode"}</div>
              <div className="flex items-center gap-2">
                {drawerMode !== "view" && <Button variant="outline" size="sm" onClick={() => void saveDrawer()} disabled={submitting} className="h-9 gap-2 px-3 text-xs"><Save className="h-3.5 w-3.5" />Save</Button>}
                {drawerMode === "view" && drawerRow && <Button variant="outline" size="sm" onClick={() => setDrawerMode("edit")} className="h-9 gap-2 px-3 text-xs"><Pencil className="h-3.5 w-3.5" />Edit</Button>}
                {drawerMode === "view" && drawerEntity === "ticket" && selectedTicket && macros.length > 0 && (
                  <div className="relative">
                    <Button variant="outline" size="sm" onClick={() => setShowMacroMenu(v => !v)} className="h-9 gap-2 px-3 text-xs">
                      <Zap className="h-3.5 w-3.5" />
                      Macro
                    </Button>
                    {showMacroMenu && (
                      <div className="absolute bottom-full left-0 mb-1 min-w-[180px] rounded-md border border-border bg-card p-1 shadow-lg">
                        {macros.map(m => (
                          <button
                            key={m.macro_id}
                            type="button"
                            onClick={() => void executeMacro(m.macro_id)}
                            className="w-full rounded-md px-3 py-1.5 text-left text-xs hover:bg-muted"
                          >
                            {m.macro_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {drawerRow && <Button variant="destructive" size="sm" onClick={() => void deleteDrawer()} disabled={submitting} className="h-9 gap-2 px-3 text-xs"><Trash2 className="h-3.5 w-3.5" />Delete</Button>}
                <Button variant="ghost" size="sm" onClick={closeDrawer} className="h-9 px-3 text-xs">Close</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {recentAudit.length > 0 && (
        <div className="border-t border-border bg-muted/20 px-6 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Latest Audit</div>
              <div className="text-xs text-muted-foreground">Recent service desk activity from the backend</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadPageData()} className="h-8 gap-2 px-3 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {recentAudit.slice(0, 4).map((item) => (
              <button
                key={item.change_id}
                onClick={() => {
                  if (item.entity === "ticket") {
                    const row = tickets.find((ticket) => ticket.ticket_id === item.record_id)
                    if (row) openDrawer("ticket", "view", row)
                  } else if (item.entity === "knowledge_article") {
                    const row = articles.find((article) => article.article_id === item.record_id)
                    if (row) openDrawer("knowledge-article", "view", row)
                  } else if (item.entity === "quotation") {
                    const row = quotations.find((quote) => quote.quotation_id === item.record_id)
                    if (row) {
                      setQuotationPreview(row)
                      setActiveTab("quotations")
                    }
                  }
                }}
                className="rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium capitalize">{item.entity.replace(/_/g, " ")}</div>
                  <span className="text-xs text-muted-foreground capitalize">{item.action}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{item.actor}</div>
                <div className="mt-2 text-xs text-muted-foreground">Fields: {item.changed_fields.join(", ") || "-"}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}


