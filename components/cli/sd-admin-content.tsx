"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Settings,
  RefreshCw,
  Plus,
  Save,
  Pencil,
  Trash2,
  X,
  Tag,
  Zap,
  Clock3,
  Star,
  Mail,
  Globe,
  FileText,
  Shield,
  Building2,
  ListChecks,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PriorityRow {
  [k: string]: unknown
  priority_id: string
  priority_code: string
  priority_name: string
  sort_order: number
  is_visible_portal: boolean
  color: string
  sla_multiplier: number | null
}

interface TagRow {
  [k: string]: unknown
  tag_id: string
  tag_name: string
  tag_color: string
  usage_count: number
}

interface TemplateRow {
  [k: string]: unknown
  ticket_template_id: string
  template_name: string
  template_type: string
  category: string
  priority: string
  subject_template: string
  body_template: string
  scope: string
  owner: string
  group_id: string
}

interface MacroRow {
  [k: string]: unknown
  macro_id: string
  macro_name: string
  description: string
  trigger_type: string
  trigger_conditions: string
  actions: string
  is_active: boolean
  sort_order: number
}

interface WorklogConfigRow {
  [k: string]: unknown
  worklog_config_id: string
  require_worklog_on_reply: boolean
  require_description: boolean
  default_worklog_type: string
  time_tracking_mode: string
}

interface CsatConfigRow {
  [k: string]: unknown
  csat_config_id: string
  rating_scale: number
  trigger_on: string
  trigger_status: string
  thank_you_message: string
  feedback_question: string
}

interface EmailChannelRow {
  [k: string]: unknown
  email_channel_id: string
  channel_name: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  email_address: string
  credentials: string
  polling_interval_seconds: number
  assigned_category: string
  assigned_priority: string
  is_enabled: boolean
}

interface SignatureRow {
  [k: string]: unknown
  agent_signature_id: string
  agent_id: string
  signature_type: string
  brand: string
  signature_html: string
  is_default: boolean
}

interface LanguageRow {
  [k: string]: unknown
  language_id: string
  language_code: string
  language_name: string
  is_default: boolean
  is_enabled_portal: boolean
}

/* ------------------------------------------------------------------ */
/*  Field descriptor for generic form / table rendering                */
/* ------------------------------------------------------------------ */

interface FieldDef {
  key: string
  label: string
  type: "text" | "number" | "textarea" | "checkbox" | "select" | "password" | "color" | "readonly"
  options?: { value: string; label: string }[]
  placeholder?: string
}

/* ------------------------------------------------------------------ */
/*  Section metadata                                                   */
/* ------------------------------------------------------------------ */

interface SectionMeta {
  key: string
  entity: string
  idField: string
  title: string
  subtitle: string
  icon: React.ElementType
  fields: FieldDef[]
  tableColumns: string[]
  singleton?: boolean
  fixedRows?: boolean
}

const SECTIONS: Record<string, SectionMeta> = {
  "sd-brands": {
    key: "sd-brands",
    entity: "brand",
    idField: "brand_id",
    title: "Brands",
    subtitle: "Manage brands for multi-brand ticket support",
    icon: Building2,
    tableColumns: ["brand_code", "brand_name", "is_default", "sort_order"],
    fields: [
      { key: "brand_code", label: "Brand Code", type: "text" },
      { key: "brand_name", label: "Brand Name", type: "text" },
      { key: "is_default", label: "Default Brand", type: "checkbox" },
      { key: "logo_url", label: "Logo URL", type: "text" },
      { key: "sort_order", label: "Sort Order", type: "number" },
    ],
  },
  "sd-ticket-types": {
    key: "sd-ticket-types",
    entity: "ticket-type",
    idField: "ticket_type_id",
    title: "Ticket Types",
    subtitle: "Define ticket types (Question, Incident, Problem, Feature Request)",
    icon: ListChecks,
    tableColumns: ["type_code", "type_name", "sort_order", "is_active"],
    fields: [
      { key: "type_code", label: "Type Code", type: "text" },
      { key: "type_name", label: "Type Name", type: "text" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_active", label: "Active", type: "checkbox" },
    ],
  },
  "sd-priorities": {
    key: "sd-priorities",
    entity: "priority",
    idField: "priority_id",
    title: "Priorities",
    subtitle: "Manage priority levels, display labels, and portal visibility",
    icon: Shield,
    fixedRows: true,
    tableColumns: ["priority_code", "priority_name", "sort_order", "is_visible_portal", "color", "sla_multiplier"],
    fields: [
      { key: "priority_code", label: "Priority Code", type: "readonly" },
      { key: "priority_name", label: "Priority Name", type: "text" },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "is_visible_portal", label: "Visible in Portal", type: "checkbox" },
      { key: "color", label: "Color", type: "color" },
      { key: "sla_multiplier", label: "SLA Multiplier", type: "number" },
    ],
  },
  "sd-tags": {
    key: "sd-tags",
    entity: "tag",
    idField: "tag_id",
    title: "Tags",
    subtitle: "Manage ticket tags for flexible categorization",
    icon: Tag,
    tableColumns: ["tag_name", "tag_color", "usage_count"],
    fields: [
      { key: "tag_name", label: "Tag Name", type: "text" },
      { key: "tag_color", label: "Tag Color", type: "color" },
      { key: "usage_count", label: "Usage Count", type: "readonly" },
    ],
  },
  "sd-templates": {
    key: "sd-templates",
    entity: "ticket-template",
    idField: "ticket_template_id",
    title: "Templates",
    subtitle: "Predefined ticket forms and canned response templates",
    icon: FileText,
    tableColumns: ["template_name", "template_type", "scope", "category", "priority"],
    fields: [
      { key: "template_name", label: "Template Name", type: "text" },
      { key: "template_type", label: "Template Type", type: "select", options: [{ value: "ticket", label: "Ticket" }, { value: "response", label: "Response" }] },
      { key: "category", label: "Category", type: "text" },
      { key: "priority", label: "Priority", type: "text" },
      { key: "subject_template", label: "Subject Template", type: "text" },
      { key: "body_template", label: "Body Template", type: "textarea" },
      { key: "scope", label: "Scope", type: "select", options: [{ value: "private", label: "Private" }, { value: "group", label: "Group" }, { value: "global", label: "Global" }] },
      { key: "owner", label: "Owner", type: "text" },
      { key: "group_id", label: "Group ID", type: "text" },
    ],
  },
  "sd-macros": {
    key: "sd-macros",
    entity: "macro",
    idField: "macro_id",
    title: "Macros",
    subtitle: "Automation triggers and predefined action sequences",
    icon: Zap,
    tableColumns: ["macro_name", "trigger_type", "is_active", "sort_order"],
    fields: [
      { key: "macro_name", label: "Macro Name", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "trigger_type", label: "Trigger Type", type: "select", options: [{ value: "manual", label: "Manual" }, { value: "on_create", label: "On Create" }, { value: "on_update", label: "On Update" }, { value: "on_status_change", label: "On Status Change" }] },
      { key: "trigger_conditions", label: "Trigger Conditions (JSON)", type: "textarea", placeholder: '{"priority":"critical"}' },
      { key: "actions", label: "Actions (JSON)", type: "textarea", placeholder: '[{"type":"set_field","field":"priority","value":"high"}]' },
      { key: "is_active", label: "Active", type: "checkbox" },
      { key: "sort_order", label: "Sort Order", type: "number" },
    ],
  },
  "sd-worklog-config": {
    key: "sd-worklog-config",
    entity: "worklog-config",
    idField: "worklog_config_id",
    title: "Worklog Config",
    subtitle: "Configure time tracking and worklog requirements",
    icon: Clock3,
    singleton: true,
    tableColumns: [],
    fields: [
      { key: "require_worklog_on_reply", label: "Require Worklog on Reply", type: "checkbox" },
      { key: "require_description", label: "Require Description", type: "checkbox" },
      { key: "default_worklog_type", label: "Default Worklog Type", type: "select", options: [{ value: "billable", label: "Billable" }, { value: "non_billable", label: "Non-Billable" }] },
      { key: "time_tracking_mode", label: "Time Tracking Mode", type: "select", options: [{ value: "manual", label: "Manual" }, { value: "automatic", label: "Automatic" }] },
    ],
  },
  "sd-csat-config": {
    key: "sd-csat-config",
    entity: "csat-config",
    idField: "csat_config_id",
    title: "CSAT Config",
    subtitle: "Customer satisfaction survey settings",
    icon: Star,
    singleton: true,
    tableColumns: [],
    fields: [
      { key: "rating_scale", label: "Rating Scale", type: "select", options: [{ value: "2", label: "2-point" }, { value: "3", label: "3-point" }, { value: "5", label: "5-point" }] },
      { key: "trigger_on", label: "Trigger On", type: "select", options: [{ value: "every_reply", label: "Every Reply" }, { value: "status_change", label: "Status Change" }, { value: "resolution", label: "Resolution" }] },
      { key: "trigger_status", label: "Trigger Status", type: "text", placeholder: "e.g. resolved" },
      { key: "thank_you_message", label: "Thank You Message", type: "textarea" },
      { key: "feedback_question", label: "Feedback Question", type: "textarea" },
    ],
  },
  "sd-email-channels": {
    key: "sd-email-channels",
    entity: "email-channel",
    idField: "email_channel_id",
    title: "Email Channels",
    subtitle: "Inbound email channel configuration for email-to-ticket",
    icon: Mail,
    tableColumns: ["channel_name", "email_address", "imap_host", "smtp_host", "is_enabled"],
    fields: [
      { key: "channel_name", label: "Channel Name", type: "text" },
      { key: "imap_host", label: "IMAP Host", type: "text" },
      { key: "imap_port", label: "IMAP Port", type: "number" },
      { key: "smtp_host", label: "SMTP Host", type: "text" },
      { key: "smtp_port", label: "SMTP Port", type: "number" },
      { key: "email_address", label: "Email Address", type: "text" },
      { key: "credentials", label: "Credentials", type: "password" },
      { key: "polling_interval_seconds", label: "Polling Interval (s)", type: "number" },
      { key: "assigned_category", label: "Assigned Category", type: "text" },
      { key: "assigned_priority", label: "Assigned Priority", type: "text" },
      { key: "is_enabled", label: "Enabled", type: "checkbox" },
    ],
  },
  "sd-signatures": {
    key: "sd-signatures",
    entity: "agent-signature",
    idField: "agent_signature_id",
    title: "Agent Signatures",
    subtitle: "Email signatures for outbound messages",
    icon: Pencil,
    tableColumns: ["agent_id", "signature_type", "brand", "is_default"],
    fields: [
      { key: "agent_id", label: "Agent ID", type: "text" },
      { key: "signature_type", label: "Signature Type", type: "select", options: [{ value: "common", label: "Common" }, { value: "brand", label: "Brand" }, { value: "agent", label: "Agent" }] },
      { key: "brand", label: "Brand", type: "text" },
      { key: "signature_html", label: "Signature HTML", type: "textarea" },
      { key: "is_default", label: "Default", type: "checkbox" },
    ],
  },
  "sd-languages": {
    key: "sd-languages",
    entity: "language",
    idField: "language_id",
    title: "Languages",
    subtitle: "Supported languages for multilingual help desk",
    icon: Globe,
    tableColumns: ["language_code", "language_name", "is_default", "is_enabled_portal"],
    fields: [
      { key: "language_code", label: "Language Code", type: "text", placeholder: "e.g. en, fr, de" },
      { key: "language_name", label: "Language Name", type: "text" },
      { key: "is_default", label: "Default Language", type: "checkbox" },
      { key: "is_enabled_portal", label: "Enabled in Portal", type: "checkbox" },
    ],
  },
}

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || (data && typeof data === "object" && "ok" in data && data.ok === false)) {
    throw new Error(String((data as { detail?: string }).detail ?? `Request failed with status ${response.status}`))
  }
  return data as T
}

function emptyForm(fields: FieldDef[]): Record<string, string> {
  const form: Record<string, string> = {}
  for (const f of fields) {
    if (f.type === "checkbox") form[f.key] = "false"
    else if (f.type === "number") form[f.key] = ""
    else form[f.key] = ""
  }
  return form
}

function rowToForm(row: Record<string, unknown>, fields: FieldDef[]): Record<string, string> {
  const form: Record<string, string> = {}
  for (const f of fields) {
    const v = row[f.key]
    if (f.type === "checkbox") {
      form[f.key] = v === true || v === "true" ? "true" : "false"
    } else if (v === null || v === undefined) {
      form[f.key] = ""
    } else if (typeof v === "object") {
      form[f.key] = JSON.stringify(v, null, 2)
    } else {
      form[f.key] = String(v)
    }
  }
  return form
}

function formToPayload(form: Record<string, string>, fields: FieldDef[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.type === "readonly") continue
    const v = form[f.key]
    if (f.type === "checkbox") {
      payload[f.key] = v === "true"
    } else if (f.type === "number") {
      payload[f.key] = v === "" ? null : Number(v)
    } else if (f.key === "trigger_conditions" || f.key === "actions") {
      try {
        payload[f.key] = v ? JSON.parse(v) : null
      } catch {
        payload[f.key] = v
      }
    } else {
      payload[f.key] = v
    }
  }
  return payload
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type DrawerMode = "view" | "create" | "edit"

export function SdAdminContent({ activeItem }: { activeItem?: string }) {
  const sectionKey = activeItem ?? ""
  const section = sectionKey ? SECTIONS[sectionKey] : undefined

  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view")
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    const sec = SECTIONS[sectionKey]
    if (!sec) return
    setLoading(true)
    setMessage(null)
    try {
      const resp = await fetchJson<{ items?: Record<string, unknown>[]; [k: string]: unknown }>(
        `/api/proxy/api/v1/mdm/${sec.entity}?limit=200`
      )
      const items = resp.items ?? (Array.isArray(resp) ? resp : [])
      setRows(items as Record<string, unknown>[])

      if (sec.singleton) {
        if (items.length > 0) {
          setSelectedRow(items[0] as Record<string, unknown>)
          setForm(rowToForm(items[0] as Record<string, unknown>, sec.fields))
          setDrawerMode("view")
          setDrawerOpen(true)
        } else {
          setSelectedRow(null)
          setForm(emptyForm(sec.fields))
          setDrawerMode("create")
          setDrawerOpen(true)
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [sectionKey])

  useEffect(() => {
    setDrawerOpen(false)
    setSelectedRow(null)
    setRows([])
    setMessage(null)
    if (sectionKey) void loadData()
  }, [sectionKey, loadData])

  function openCreate() {
    if (!section) return
    setSelectedRow(null)
    setForm(emptyForm(section.fields))
    setDrawerMode("create")
    setDrawerOpen(true)
  }

  function openView(row: Record<string, unknown>) {
    if (!section) return
    setSelectedRow(row)
    setForm(rowToForm(row, section.fields))
    setDrawerMode("view")
    setDrawerOpen(true)
  }

  function startEdit() {
    setDrawerMode("edit")
  }

  function closeDrawer() {
    if (section?.singleton) return
    setDrawerOpen(false)
    setSelectedRow(null)
  }

  async function handleSave() {
    if (!section) return
    setSubmitting(true)
    setMessage(null)
    try {
      const payload = formToPayload(form, section.fields)
      if (drawerMode === "create") {
        await fetchJson(`/api/proxy/api/v1/mdm/${section.entity}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        setMessage("Record created successfully")
      } else {
        const id = selectedRow?.[section.idField]
        if (!id) throw new Error("No record selected")
        await fetchJson(`/api/proxy/api/v1/mdm/${section.entity}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        setMessage("Record updated successfully")
      }
      setDrawerMode("view")
      await loadData()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!section || !selectedRow) return
    const id = selectedRow[section.idField]
    if (!id) return
    if (!window.confirm("Are you sure you want to delete this record?")) return
    setSubmitting(true)
    setMessage(null)
    try {
      await fetchJson(`/api/proxy/api/v1/mdm/${section.entity}/${id}`, { method: "DELETE" })
      setMessage("Record deleted successfully")
      setDrawerOpen(false)
      setSelectedRow(null)
      await loadData()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setSubmitting(false)
    }
  }

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /* ---------------------------------------------------------------- */
  /*  No section selected                                              */
  /* ---------------------------------------------------------------- */

  if (!section) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Settings className="mx-auto h-12 w-12 opacity-30" />
          <p className="mt-4 text-sm">Select an admin section from the sidebar</p>
        </div>
      </div>
    )
  }

  const Icon = section.icon
  const canAdd = !section.fixedRows && !section.singleton
  const canDelete = !section.fixedRows && !section.singleton

  /* ---------------------------------------------------------------- */
  /*  Render field                                                     */
  /* ---------------------------------------------------------------- */

  function renderField(f: FieldDef, isEditing: boolean) {
    const val = form[f.key] ?? ""

    if (f.type === "readonly" || !isEditing) {
      if (f.type === "checkbox") {
        return (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
            <span className="text-sm font-medium">{val === "true" ? "Yes" : "No"}</span>
          </label>
        )
      }
      if (f.type === "color" && val) {
        return (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="inline-block h-4 w-4 rounded border border-border" style={{ backgroundColor: val }} />
              {val}
            </span>
          </label>
        )
      }
      if (f.type === "password") {
        return (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
            <span className="text-sm font-medium">{val ? "********" : "-"}</span>
          </label>
        )
      }
      return (
        <label key={f.key} className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
          <span className="whitespace-pre-wrap text-sm font-medium">{val || "-"}</span>
        </label>
      )
    }

    if (f.type === "checkbox") {
      return (
        <label key={f.key} className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={val === "true"}
            onChange={(e) => setField(f.key, e.target.checked ? "true" : "false")}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm">{f.label}</span>
        </label>
      )
    }

    if (f.type === "select") {
      return (
        <label key={f.key} className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
          <select
            value={val}
            onChange={(e) => setField(f.key, e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">-- Select --</option>
            {f.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      )
    }

    if (f.type === "textarea") {
      return (
        <label key={f.key} className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
          <textarea
            value={val}
            onChange={(e) => setField(f.key, e.target.value)}
            rows={4}
            placeholder={f.placeholder}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
      )
    }

    if (f.type === "color") {
      return (
        <label key={f.key} className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={val || "#000000"}
              onChange={(e) => setField(f.key, e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
            />
            <input
              type="text"
              value={val}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder="#000000"
              className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </label>
      )
    }

    if (f.type === "password") {
      return (
        <label key={f.key} className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
          <input
            type="password"
            value={val}
            onChange={(e) => setField(f.key, e.target.value)}
            placeholder={f.placeholder}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
      )
    }

    return (
      <label key={f.key} className="block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{f.label}</span>
        <input
          type={f.type === "number" ? "number" : "text"}
          value={val}
          onChange={(e) => setField(f.key, e.target.value)}
          placeholder={f.placeholder}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{section.title}</h1>
            <p className="text-xs text-muted-foreground">{section.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          {canAdd && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New
            </Button>
          )}
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div className={cn(
          "mx-6 mt-3 rounded-md border px-4 py-2 text-sm",
          message.toLowerCase().includes("success") || message.toLowerCase().includes("created") || message.toLowerCase().includes("updated") || message.toLowerCase().includes("deleted")
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-red-200 bg-red-50 text-red-700"
        )}>
          {message}
          <button onClick={() => setMessage(null)} className="ml-2 font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* Content area */}
      <div className={cn("flex-1 overflow-auto p-6", drawerOpen && !section.singleton && "pr-[480px]")}>
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>
        ) : section.singleton ? (
          /* Singleton: no table, just the drawer */
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-primary" />
                {section.title} Settings
              </div>
              <div className="space-y-4">
                {section.fields.map((f) => renderField(f, drawerMode !== "view"))}
              </div>
              <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
                {drawerMode === "view" ? (
                  <Button size="sm" onClick={startEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={handleSave} disabled={submitting}>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {submitting ? "Saving..." : "Save"}
                    </Button>
                    {selectedRow && (
                      <Button variant="outline" size="sm" onClick={() => {
                        setForm(rowToForm(selectedRow, section.fields))
                        setDrawerMode("view")
                      }}>
                        Cancel
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Table view */
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {section.tableColumns.map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {col.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={section.tableColumns.length} className="px-4 py-12 text-center text-muted-foreground">
                        No records found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => {
                      const id = String(row[section.idField] ?? i)
                      const isSelected = selectedRow?.[section.idField] === row[section.idField]
                      return (
                        <tr
                          key={id}
                          onClick={() => openView(row)}
                          className={cn(
                            "cursor-pointer border-b border-border transition-colors hover:bg-muted/40",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          {section.tableColumns.map((col) => (
                            <td key={col} className="px-4 py-3">
                              {col === "color" || col === "tag_color" ? (
                                <span className="flex items-center gap-2">
                                  <span className="inline-block h-4 w-4 rounded border border-border" style={{ backgroundColor: String(row[col] ?? "") }} />
                                  {String(row[col] ?? "-")}
                                </span>
                              ) : (
                                formatCellValue(row[col])
                              )}
                            </td>
                          ))}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {rows.length} record{rows.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Right-side drawer (non-singleton) */}
      {!section.singleton && (
        <div className={cn(
          "fixed right-0 top-0 z-40 h-full w-[460px] border-l border-border bg-card shadow-2xl transition-transform duration-200",
          drawerOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex h-full flex-col">
            {/* Drawer header */}
            <div className="flex items-start justify-between border-b border-border px-4 py-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {drawerMode === "create" ? `New ${section.title}` : section.title}
                </div>
                <h2 className="mt-1 text-lg font-semibold">
                  {drawerMode === "create"
                    ? "Create Record"
                    : (selectedRow as Record<string, unknown>)?.[section.fields[0]?.key] != null
                      ? String((selectedRow as Record<string, unknown>)[section.fields[0].key])
                      : "Record Detail"
                  }
                </h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={closeDrawer}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 space-y-4 overflow-auto p-4">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 text-primary" />
                  {drawerMode === "view" ? "Record Details" : drawerMode === "create" ? "Create Record" : "Edit Record"}
                </div>
                <div className="space-y-3">
                  {section.fields.map((f) => renderField(f, drawerMode !== "view"))}
                </div>
              </div>
            </div>

            {/* Drawer footer */}
            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              {drawerMode === "view" ? (
                <>
                  <Button size="sm" variant="outline" onClick={startEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {canDelete && (
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDelete} disabled={submitting}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button size="sm" onClick={handleSave} disabled={submitting}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {submitting ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (drawerMode === "create") {
                      closeDrawer()
                    } else if (selectedRow) {
                      setForm(rowToForm(selectedRow, section.fields))
                      setDrawerMode("view")
                    }
                  }}>
                    Cancel
                  </Button>
                </>
              )}
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={closeDrawer}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
