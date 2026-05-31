"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { MoreVertical, SlidersHorizontal } from "lucide-react"

type EntityMeta = { key: string; columns: string[]; idColumn?: string }
type RowData = Record<string, unknown>
type FilterOperator = "contains" | "eq" | "neq" | "startsWith" | "endsWith" | "empty" | "notEmpty"
type QueryCondition = { id: string; field: string; op: FilterOperator; value: string }
type ConditionJoin = "and" | "or"
type ColumnMenuMode = "Default" | "Custom"
type SavedView = {
  id: string
  name: string
  globalSearch: string
  conditions: QueryCondition[]
  conditionJoin?: ConditionJoin
  groupBy: string
  sortBy: { field: string; dir: "asc" | "desc" } | null
}
type ChangeLogItem = {
  event_id: string
  action: string
  actor: string
  changed_fields?: string[]
  created_at: string
  before_data?: Record<string, unknown> | null
  after_data?: Record<string, unknown> | null
}
type AuditItem = {
  audit_id: string
  action: string
  provider: string
  skill_key: string
  actor: string
  status: string
  duration_ms?: number | null
  created_at: string
}
type GridPrefs = {
  columnMenuMode: ColumnMenuMode
  hiddenColumns: string[]
  sortBy: { field: string; dir: "asc" | "desc" } | null
  pageSize: number
  groupBy: string
  columnOrder: string[]
  rowDensity: "compact" | "cozy"
}
type LookupOption = { value: string; label: string; symbol?: string }
type ValidationField = { name: string; type: string; required: boolean; fk?: { table: string; idColumn: string } | null }
type ValidationSchema = {
  entity: string
  idColumn: string
  requiredFields: string[]
  fields: ValidationField[]
  rules: { validDateRange: string; codeUnique: boolean }
}
type AiSuggestion = { type: "error" | "warning" | "info"; field?: string; message: string }
type RoleMode = "admin" | "maintainer" | "viewer"
type ScopeMode = "tenant" | "user"
type ValidationRuleMap = Record<string, { required?: boolean; regex?: string; min?: number; max?: number; enum?: string }>
type TransitionMatrix = Record<string, string[]>
type ValidationProfile = { requireLocalName: boolean; codePrefix: string; enforcementMode: "strict" | "warn" }
type ApprovalItem = {
  approval_id: string
  entity_key: string
  action_type: string
  status: string
  submitted_by: string
  approved_by?: string
  executed_by?: string
  routed_to?: string
  sla_due_at?: string
  created_at: string
  validation_report?: { ok?: boolean; errors?: ApiFieldError[]; warnings?: ApiFieldError[]; meta?: Record<string, unknown> } | null
  execution_report?: { updated?: number; failed_count?: number; failed?: Array<{ row_id: string; reason: string; detail: string }> } | null
}
type ApprovalDetail = {
  item: ApprovalItem & { payload?: Record<string, unknown>; validation_report?: { ok?: boolean; errors?: ApiFieldError[]; warnings?: ApiFieldError[]; meta?: Record<string, unknown> } }
  validationReport?: { ok?: boolean; errors?: ApiFieldError[]; warnings?: ApiFieldError[]; meta?: Record<string, unknown> } | null
  executionReport?: { updated?: number; failed_count?: number; failed?: Array<{ row_id: string; reason: string; detail: string }> } | null
  payloadDiff: Array<{ field: string; from: string; to: string }>
  timeline: Array<{ event_id: string; event_type: string; actor: string; detail?: Record<string, unknown>; created_at: string }>
  comments: Array<{ comment_id: string; actor: string; body: string; created_at: string }>
}
type ApiFieldError = { field: string; message: string; code?: string }
type ApprovalPolicy = {
  policy_id?: string
  entity_key: string
  action_type: string
  enabled: boolean
  auto_route_to?: string | null
  sla_hours: number
  escalate_to?: string | null
  notify_channels: string[]
}
type RuntimeNotifyConfig = {
  teamsWebhookUrl: string
  larkWebhookUrl: string
  wecomWebhookUrl: string
  mailTo: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
}
type AuthMe = { roles?: string[]; permissions?: string[] }

// Humanize a raw field/column name for display: snake_case -> Title Case,
// with common acronyms upper-cased. e.g. "company_name" -> "Company Name",
// "legal_entity_id" -> "Legal Entity ID".
const LABEL_ACRONYMS: Record<string, string> = { id: "ID", uom: "UOM", url: "URL", api: "API", iso: "ISO", sla: "SLA", no: "No." }
// Friendly overrides for ISO reference fields (3166-1 country, 4217 currency).
const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  alpha2: "ISO Alpha-2", alpha3: "ISO Alpha-3", numeric3: "ISO Numeric",
  alpha_code: "ISO Code", numeric_code: "ISO Numeric", minor_unit: "Minor Unit",
  name_short_en: "Name (EN)", name_official_en: "Official Name (EN)", name_local: "Local Name",
}
// Normalize a stored date (which may be an ISO timestamp like 2026-05-30T00:00:00.000Z)
// to the yyyy-MM-dd value an <input type="date"> expects. Falls back to the given default.
function toDateInputValue(value: unknown, fallback = ""): string {
  const s = String(value ?? "").trim()
  if (!s) return fallback
  const m = s.match(/^\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : fallback
}

// First and last calendar day of next month (local), as yyyy-MM-dd.
function nextMonthRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 2, 0)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return { from: fmt(first), to: fmt(last) }
}

// Fixed enum dropdowns (value stored, label shown). SAP exchange-rate types.
const ENUM_FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  rate_type: [
    { value: "S", label: "Bank Selling (S)" },
    { value: "G", label: "Bank Buying (G)" },
    { value: "M", label: "Mid / Average (M)" },
    { value: "B", label: "Budget (B)" },
  ],
}

// Display formatter for grid cells: collapse ISO datetimes (e.g. 2026-05-30T00:00:00.000Z)
// to date-only, and render empty values as a dash.
function formatCellValue(value: unknown): string {
  const s = String(value ?? "").trim()
  if (s === "") return "-"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T[\d:.]+/)
  return m ? m[1] : s
}

function humanizeLabel(field: string): string {
  const key = String(field ?? "").trim()
  if (FIELD_LABEL_OVERRIDES[key]) return FIELD_LABEL_OVERRIDES[key]
  return String(field ?? "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => LABEL_ACRONYMS[w.toLowerCase()] ?? (w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
}

const menuToEntity: Record<string, string> = {
  "mdm-delivery-org": "delivery-org",
  "mdm-delivery-office": "delivery-office",
  "mdm-delivery-team": "delivery-team",
  "mdm-sales-org": "sales-org",
  "mdm-sales-office": "sales-office",
  "mdm-sales-team": "sales-team",
  "mdm-purchase-org": "purchase-org",
  "mdm-purchase-office": "purchase-office",
  "mdm-purchase-team": "purchase-team",
  "mdm-legal-entity": "legal-entity",
  "mdm-division": "division",
  "mdm-cost-center": "cost-center",
  "mdm-credit-area": "credit-area",
  "mdm-org-mapping-set": "org-mapping-set",
  "mdm-org-mapping-line": "org-mapping-line",
  "mdm-country": "country",
  "mdm-region": "region",
  "mdm-city": "city",
  "mdm-customer": "customer",
  "mdm-vendor": "vendor",
  "mdm-product": "product",
  "mdm-material": "material",
  "mdm-currency": "currency",
  "mdm-exchange-rate": "exchange-rate",
  "mdm-price-list": "price-list",
  "mdm-price-list-item": "price-list-item",
  "mdm-service-item": "service-item",
  "mdm-regulation": "regulation",
  "mdm-standard": "standard",
  "mdm-activity": "activity",
  "mdm-service-bom": "service-bom",
  "mdm-service-bom-line": "service-bom-line",
  "mdm-service-item-regulation": "service-item-regulation",
  "mdm-service-item-standard": "service-item-standard",
  "mdm-change-log": "mdm-change-log",
  mdm: "service-item",
}

export function MdmContent({ activeItem }: { activeItem: string }) {
  const [entities, setEntities] = useState<EntityMeta[]>([])
  const [entity, setEntity] = useState("service-item")
  const [rows, setRows] = useState<RowData[]>([])
  const [globalSearch, setGlobalSearch] = useState("")
  const [conditions, setConditions] = useState<QueryCondition[]>([])
  const [conditionJoin, setConditionJoin] = useState<ConditionJoin>("and")
  const [message, setMessage] = useState("")
  const [csvText, setCsvText] = useState("")
  const [skipImportErrors, setSkipImportErrors] = useState(true)
  const [importActor, setImportActor] = useState("mdm-ui-import")
  const [editingId, setEditingId] = useState("")
  const [editDraft, setEditDraft] = useState<Record<string, string>>({})
  const [confirmAction, setConfirmAction] = useState<{ type: "delete"; row: RowData } | null>(null)
  const [columnMenuMode, setColumnMenuMode] = useState<ColumnMenuMode>("Default")
  const [menuColumn, setMenuColumn] = useState<string>("")
  const [selectedColumn, setSelectedColumn] = useState<string>("")
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<{ field: string; dir: "asc" | "desc" } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [selectedRowId, setSelectedRowId] = useState("")
  const [groupBy, setGroupBy] = useState("")
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [dragColumn, setDragColumn] = useState("")
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [activeViewId, setActiveViewId] = useState("")
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [rowDensity, setRowDensity] = useState<"compact" | "cozy">("cozy")
  const [columnPreset, setColumnPreset] = useState<"default" | "ops" | "minimal">("default")
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(320)
  const [showRightPanel, setShowRightPanel] = useState(false)
  // Collapsible left-panel sections (Query Conditions / Data Operations)
  const [querySectionOpen, setQuerySectionOpen] = useState(true)
  const [opsSectionOpen, setOpsSectionOpen] = useState(true)
  const [totalRows, setTotalRows] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [editWarnings, setEditWarnings] = useState<ApiFieldError[]>([])
  const [detailRow, setDetailRow] = useState<RowData | null>(null)
  const [detailTab, setDetailTab] = useState<"overview" | "changes" | "raw">("overview")
  const [previewAction, setPreviewAction] = useState<{ type: "archiveFiltered"; count: number } | null>(null)
  const [detailChanges, setDetailChanges] = useState<ChangeLogItem[]>([])
  const [detailChangesLoading, setDetailChangesLoading] = useState(false)
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [lookupOptions, setLookupOptions] = useState<Record<string, LookupOption[]>>({})
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTargetRow, setEditTargetRow] = useState<RowData | null>(null)
  const [createDraft, setCreateDraft] = useState<Record<string, string>>({})
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
  const [createWarnings, setCreateWarnings] = useState<ApiFieldError[]>([])
  const [savedFilterName, setSavedFilterName] = useState("")
  const [savedFilters, setSavedFilters] = useState<Array<{ id: string; name: string; globalSearch: string; conditions: QueryCondition[]; conditionJoin: ConditionJoin }>>([])
  const [activeFilterId, setActiveFilterId] = useState("")
  const [quickPreset, setQuickPreset] = useState("")
  const [lastCreatedRowId, setLastCreatedRowId] = useState("")
  const [inlineAddMode, setInlineAddMode] = useState(false)
  const [inlineDraft, setInlineDraft] = useState<Record<string, string>>({})
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({})
  const [validationSchema, setValidationSchema] = useState<ValidationSchema | null>(null)
  const [importHeaderMap, setImportHeaderMap] = useState<Record<string, string>>({})
  const [aiAssistLoading, setAiAssistLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
  const [aiSuggestionRowId, setAiSuggestionRowId] = useState("")
  const [rowActionMenuId, setRowActionMenuId] = useState("")
  const rowActionMenuRef = useRef<HTMLDivElement | null>(null)
  const [actionReason, setActionReason] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [roleMode, setRoleMode] = useState<RoleMode>("admin")
  const [scopeMode, setScopeMode] = useState<ScopeMode>("tenant")
  const [validationRules, setValidationRules] = useState<ValidationRuleMap>({})
  const [validationProfile, setValidationProfile] = useState<ValidationProfile>({ requireLocalName: false, codePrefix: "", enforcementMode: "strict" })
  const [transitionMatrix, setTransitionMatrix] = useState<TransitionMatrix>({
    draft: ["active", "inactive"],
    active: ["inactive"],
    inactive: ["active"],
    archived: [],
  })
  const [importValidateOnly, setImportValidateOnly] = useState(false)
  const [massField, setMassField] = useState("")
  const [massValue, setMassValue] = useState("")
  const [configLoaded, setConfigLoaded] = useState(false)
  const [serverIntegrity, setServerIntegrity] = useState<Array<{ rowId: string; field: string; value: string; reason: string }>>([])
  const [serverHealth, setServerHealth] = useState<{ total: number; active: number; invalidDate: number; duplicateCount: number; completeness: number } | null>(null)
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([])
  const [approvalDetail, setApprovalDetail] = useState<ApprovalDetail | null>(null)
  const [approvalDrawerOpen, setApprovalDrawerOpen] = useState(false)
  const [approvalComment, setApprovalComment] = useState("")
  const [approvalStatusFilter, setApprovalStatusFilter] = useState("")
  const [approvalEntityFilter, setApprovalEntityFilter] = useState("")
  const [approvalRoutedFilter, setApprovalRoutedFilter] = useState("")
  const [approvalOverdueOnly, setApprovalOverdueOnly] = useState(false)
  const [approvalEscalatedOnly, setApprovalEscalatedOnly] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [showApprovalBoard, setShowApprovalBoard] = useState(false)
  const [approvalPage, setApprovalPage] = useState(1)
  const [approvalPageSize, setApprovalPageSize] = useState(10)
  const [approvalTotal, setApprovalTotal] = useState(0)
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([])
  const [opsMetrics, setOpsMetrics] = useState<{ change_velocity?: Array<{ action: string; cnt: number }>; audit_health?: Array<{ status: string; cnt: number; avg_ms: number }>; approval_flow?: Array<{ action_type: string; status: string; cnt: number }>; sla?: { overdue: number } } | null>(null)
  const [policyDraft, setPolicyDraft] = useState<ApprovalPolicy>({
    entity_key: "",
    action_type: "mass-update",
    enabled: true,
    auto_route_to: "mdm-admin",
    sla_hours: 24,
    escalate_to: "mdm-lead",
    notify_channels: ["teams", "lark", "mail"],
  })
  const [runtimeNotify, setRuntimeNotify] = useState<RuntimeNotifyConfig>({
    teamsWebhookUrl: "",
    larkWebhookUrl: "",
    wecomWebhookUrl: "",
    mailTo: "",
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
  })
  const [authMe, setAuthMe] = useState<AuthMe>({})

  const activeMeta = useMemo(() => entities.find((e) => e.key === entity), [entities, entity])
  const idColumn = activeMeta?.idColumn ?? `${entity.replace(/-/g, "_")}_id`
  const queryFields = useMemo(() => {
    const base = activeMeta?.columns ?? []
    const sys = ["status", "valid_from", "valid_to", idColumn]
    return Array.from(new Set([...base, ...sys]))
  }, [activeMeta, idColumn])
  const createFields = useMemo(() => (activeMeta?.columns ?? []).slice(0, 6), [activeMeta])
  const requiredCreateFields = useMemo(
    () => {
      if (validationSchema?.requiredFields?.length) return createFields.filter((f) => validationSchema.requiredFields.includes(f))
      return createFields.filter((f) => /(^code$|_code$|(^name$|_name$)|title)/i.test(f))
    },
    [createFields, validationSchema]
  )
  const optionalCreateFields = useMemo(
    () => createFields.filter((f) => !requiredCreateFields.includes(f)),
    [createFields, requiredCreateFields]
  )

  useEffect(() => {
    const base = (activeMeta?.columns ?? []).slice(0, 6)
    if (!base.length) return
    setColumnOrder((prev) => {
      if (!prev.length) return base
      const kept = prev.filter((c) => base.includes(c))
      const missing = base.filter((c) => !kept.includes(c))
      return [...kept, ...missing]
    })
  }, [activeMeta])

  useEffect(() => {
    void init()
  }, [])

  useEffect(() => {
    void fetch("/api/proxy/api/v1/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setAuthMe({ roles: d.roles ?? [], permissions: d.permissions ?? [] })
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const nextEntity = menuToEntity[activeItem]
    if (nextEntity) void loadEntity(nextEntity)
  }, [activeItem])

  useEffect(() => {
    if (!entity) return
    const saved = localStorage.getItem(`mdm.query.v1.${scopeMode}.${entity}`)
    if (!saved) {
      setConditions([])
      setGlobalSearch("")
      return
    }
    try {
      const parsed = JSON.parse(saved) as { globalSearch?: string; conditions?: QueryCondition[]; conditionJoin?: ConditionJoin }
      setGlobalSearch(parsed.globalSearch ?? "")
      setConditions(parsed.conditions ?? [])
      setConditionJoin(parsed.conditionJoin ?? "and")
    } catch {
      setConditions([])
      setGlobalSearch("")
      setConditionJoin("and")
    }
  }, [entity, scopeMode])

  useEffect(() => {
    if (!entity) return
    localStorage.setItem(`mdm.query.v1.${scopeMode}.${entity}`, JSON.stringify({ globalSearch, conditions, conditionJoin }))
  }, [entity, scopeMode, globalSearch, conditions, conditionJoin])

  useEffect(() => {
    if (!entity) return
    const saved = localStorage.getItem(`mdm.filters.v1.${scopeMode}.${entity}`)
    if (!saved) {
      setSavedFilters([])
      setActiveFilterId("")
      return
    }
    try {
      const parsed = JSON.parse(saved) as Array<{ id: string; name: string; globalSearch: string; conditions: QueryCondition[]; conditionJoin?: ConditionJoin }>
      setSavedFilters(parsed.map((f) => ({ ...f, conditionJoin: f.conditionJoin ?? "and" })))
      setActiveFilterId("")
    } catch {
      setSavedFilters([])
      setActiveFilterId("")
    }
  }, [entity, scopeMode])

  useEffect(() => {
    if (!entity) return
    localStorage.setItem(`mdm.filters.v1.${scopeMode}.${entity}`, JSON.stringify(savedFilters))
  }, [entity, scopeMode, savedFilters])

  useEffect(() => {
    let ignore = false
    async function loadServerConfig(): Promise<void> {
      if (!entity) return
      setConfigLoaded(false)
      try {
        const actor = scopeMode === "tenant" ? "system" : "demo-user"
        const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/config?scope=${scopeMode}&actor=${actor}`)
        const data = (await resp.json()) as { ok?: boolean; item?: { validation_rules?: Record<string, unknown>; transition_matrix?: TransitionMatrix; saved_filters?: Array<{ id: string; name: string; globalSearch: string; conditions: QueryCondition[]; conditionJoin?: ConditionJoin }> } }
        if (!resp.ok || !data.ok || ignore) return
        if (data.item?.validation_rules) {
          const vr = data.item.validation_rules
          const nextRules: ValidationRuleMap = {}
          for (const [k, v] of Object.entries(vr)) {
            if (v && typeof v === "object" && !Array.isArray(v)) nextRules[k] = v as ValidationRuleMap[string]
          }
          setValidationRules(nextRules)
          setValidationProfile({
            requireLocalName: Boolean(vr.require_local_name),
            codePrefix: String(vr.code_prefix ?? ""),
            enforcementMode: String(vr.enforcement_mode ?? "strict") === "warn" ? "warn" : "strict",
          })
        }
        if (data.item?.transition_matrix) setTransitionMatrix(data.item.transition_matrix)
        if (Array.isArray(data.item?.saved_filters)) {
          setSavedFilters(data.item.saved_filters.map((f) => ({ ...f, conditionJoin: f.conditionJoin ?? "and" })))
        }
      } catch {
        // keep local fallback
      } finally {
        if (!ignore) setConfigLoaded(true)
      }
    }
    void loadServerConfig()
    return () => { ignore = true }
  }, [entity, scopeMode])

  useEffect(() => {
    if (!entity || !configLoaded) return
    const t = setTimeout(async () => {
      try {
        const actor = scopeMode === "tenant" ? "system" : "demo-user"
        await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/config`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scope: scopeMode,
            actor,
            role: roleMode,
            updated_by: "mdm-ui",
            validation_rules: {
              ...validationRules,
              require_local_name: validationProfile.requireLocalName,
              code_prefix: validationProfile.codePrefix,
              enforcement_mode: validationProfile.enforcementMode,
            },
            transition_matrix: transitionMatrix,
            saved_filters: savedFilters,
          }),
        })
      } catch {
        // silent; local copy still available
      }
    }, 500)
    return () => clearTimeout(t)
  }, [entity, scopeMode, roleMode, validationRules, validationProfile, transitionMatrix, savedFilters, configLoaded])

  useEffect(() => {
    if (!entity) return
    const saved = localStorage.getItem(`mdm.validationRules.v1.${entity}`)
    if (!saved) {
      setValidationRules({})
      return
    }
    try {
      setValidationRules(JSON.parse(saved) as ValidationRuleMap)
    } catch {
      setValidationRules({})
    }
  }, [entity, scopeMode])

  useEffect(() => {
    if (!entity) return
    localStorage.setItem(`mdm.validationRules.v1.${entity}`, JSON.stringify(validationRules))
  }, [entity, validationRules])

  useEffect(() => {
    if (!entity) return
    const saved = localStorage.getItem(`mdm.transitions.v1.${entity}`)
    if (!saved) return
    try {
      setTransitionMatrix(JSON.parse(saved) as TransitionMatrix)
    } catch {
      // keep defaults
    }
  }, [entity, scopeMode])

  useEffect(() => {
    if (!entity) return
    localStorage.setItem(`mdm.transitions.v1.${entity}`, JSON.stringify(transitionMatrix))
  }, [entity, transitionMatrix])

  useEffect(() => {
    if (!entity) return
    void (async () => {
      try {
        const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/views?scope=${scopeMode}&actor=demo-user`)
        const data = (await resp.json()) as { ok?: boolean; items?: SavedView[] }
        if (resp.ok && data.ok) {
          setSavedViews(data.items ?? [])
          setActiveViewId("")
          return
        }
      } catch {
        // fallback below
      }
      const saved = localStorage.getItem(`mdm.views.v1.${entity}`)
      if (!saved) {
        setSavedViews([])
        setActiveViewId("")
        return
      }
      try {
        const parsed = JSON.parse(saved) as SavedView[]
        setSavedViews(parsed)
        setActiveViewId("")
      } catch {
        setSavedViews([])
        setActiveViewId("")
      }
    })()
  }, [entity, scopeMode])

  useEffect(() => {
    if (!entity) return
    localStorage.setItem(`mdm.views.v1.${entity}`, JSON.stringify(savedViews))
  }, [entity, savedViews])

  useEffect(() => {
    if (!entity) return
    const v = localStorage.getItem(`mdm.leftPanel.v1.${entity}`)
    if (!v) return
    try {
      const parsed = JSON.parse(v) as { show?: boolean; width?: number }
      if (typeof parsed.show === "boolean") setShowLeftPanel(parsed.show)
      if (typeof parsed.width === "number" && parsed.width >= 260 && parsed.width <= 520) setLeftPanelWidth(parsed.width)
    } catch {
      // ignore bad saved value
    }
  }, [entity, scopeMode])

  useEffect(() => {
    if (!entity) return
    localStorage.setItem(`mdm.leftPanel.v1.${entity}`, JSON.stringify({ show: showLeftPanel, width: leftPanelWidth }))
  }, [entity, showLeftPanel, leftPanelWidth])

  useEffect(() => {
    if (!rowActionMenuId) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rowActionMenuRef.current) return
      const target = event.target as Node | null
      if (target && !rowActionMenuRef.current.contains(target)) {
        setRowActionMenuId("")
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRowActionMenuId("")
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [rowActionMenuId])

  useEffect(() => {
    if (!entity) return
    const saved = localStorage.getItem(`mdm.grid.v1.${entity}`)
    if (!saved) return
    try {
      const prefs = JSON.parse(saved) as Partial<GridPrefs>
      if (prefs.columnMenuMode) setColumnMenuMode(prefs.columnMenuMode)
      if (prefs.hiddenColumns) setHiddenColumns(prefs.hiddenColumns)
      if (prefs.sortBy !== undefined) setSortBy(prefs.sortBy ?? null)
      if (prefs.pageSize) setPageSize(prefs.pageSize)
      if (prefs.groupBy !== undefined) setGroupBy(prefs.groupBy ?? "")
      if (prefs.columnOrder) setColumnOrder(prefs.columnOrder)
      if (prefs.rowDensity) setRowDensity(prefs.rowDensity)
    } catch {
      // ignore bad saved value
    }
  }, [entity, scopeMode])

  useEffect(() => {
    if (!entity) return
    const prefs: GridPrefs = { columnMenuMode, hiddenColumns, sortBy, pageSize, groupBy, columnOrder, rowDensity }
    localStorage.setItem(`mdm.grid.v1.${entity}`, JSON.stringify(prefs))
  }, [entity, columnMenuMode, hiddenColumns, sortBy, pageSize, groupBy, columnOrder, rowDensity])

  useEffect(() => {
    if (!lastCreatedRowId) return
    const timer = setTimeout(() => setLastCreatedRowId(""), 6000)
    return () => clearTimeout(timer)
  }, [lastCreatedRowId])

  useEffect(() => {
    if (!entity) return
    void fetchEntityRows(entity, page, pageSize)
  }, [entity, page, pageSize, sortBy, globalSearch, conditions, conditionJoin])

  useEffect(() => {
    if (!entity) return
    void refreshServerMetrics()
  }, [entity, globalSearch, conditions, conditionJoin])

  useEffect(() => {
    if (!entity) return
    void Promise.all([loadApprovals(), loadOpsMetrics(), loadPolicy(), loadRuntimeNotifyConfig()])
  }, [entity, scopeMode])

  useEffect(() => {
    void loadApprovals()
  }, [approvalStatusFilter, approvalEntityFilter, approvalRoutedFilter, approvalOverdueOnly, approvalEscalatedOnly, approvalPage, approvalPageSize, showApprovalBoard])

  useEffect(() => {
    if (!entity) return
    void (async () => {
      try {
        const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/validation`)
        const data = (await resp.json()) as { ok?: boolean } & ValidationSchema
        if (resp.ok && data.ok) setValidationSchema(data)
      } catch {
        setValidationSchema(null)
      }
    })()
  }, [entity, scopeMode])

  useEffect(() => {
    const cols = (activeMeta?.columns ?? []).slice(0, 6)
    const fkCols = cols.filter((c) => c.endsWith("_id") && c !== idColumn)
    // Code-reference columns resolve to the currency/country masters (value = the code).
    const CODE_REF: Record<string, { entity: string; valueCol: string }> = {
      from_currency: { entity: "currency", valueCol: "alpha_code" },
      to_currency: { entity: "currency", valueCol: "alpha_code" },
      currency_code: { entity: "currency", valueCol: "alpha_code" },
      base_currency_code: { entity: "currency", valueCol: "alpha_code" },
      country_code: { entity: "country", valueCol: "alpha2" },
    }
    const codeRefCols = cols.filter((c) => CODE_REF[c])
    if (!fkCols.length && !codeRefCols.length) {
      setLookupOptions({})
      return
    }
    void (async () => {
      const next: Record<string, LookupOption[]> = {}
      for (const col of codeRefCols) {
        const ref = CODE_REF[col]
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(ref.entity)}?limit=500&offset=0`)
          const data = (await resp.json()) as { items?: RowData[] }
          const items = data.items ?? []
          next[col] = items.map((r) => {
            const v = String(r[ref.valueCol] ?? "")
            const nameKey = Object.keys(r).find((k) => k === "currency_name" || k === "name_short_en" || k.endsWith("_name") || k === "title")
            const name = nameKey ? String(r[nameKey] ?? "") : ""
            const symbol = ref.entity === "currency" ? String(r.symbol ?? "").trim() : ""
            return { value: v, label: [v, name].filter(Boolean).join(" - ") || v, symbol }
          }).filter((x) => x.value)
        } catch {
          next[col] = []
        }
      }
      for (const col of fkCols) {
        const targetEntity = inferTargetEntityKey(col)
        if (!targetEntity) continue
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(targetEntity)}?limit=100&offset=0`)
          const data = (await resp.json()) as { items?: RowData[] }
          const items = data.items ?? []
          const targetMeta = entities.find((e) => e.key === targetEntity)
          const targetId = targetMeta?.idColumn ?? `${targetEntity.replace(/-/g, "_")}_id`
          next[col] = items.map((r) => {
            const v = String(r[targetId] ?? "")
            const nameKey = Object.keys(r).find((k) => k === "name" || k.endsWith("_name") || k === "title")
            const codeKey = Object.keys(r).find((k) => k === "code" || k.endsWith("_code"))
            const name = nameKey ? String(r[nameKey] ?? "") : ""
            const code = codeKey ? String(r[codeKey] ?? "") : ""
            const label = [code, name].filter(Boolean).join(" - ") || v
            return { value: v, label }
          }).filter((x) => x.value)
        } catch {
          next[col] = []
        }
      }
      setLookupOptions(next)
    })()
  }, [activeMeta, idColumn, entities])

  useEffect(() => {
    const row = detailRow
    if (!row) {
      setDetailChanges([])
      return
    }
    const recordId = String(row[idColumn] ?? "")
    if (!recordId) return
    void (async () => {
      setDetailChangesLoading(true)
      try {
        const query = new URLSearchParams({ entity, recordId, limit: "20" })
        const resp = await fetch(`/api/proxy/api/v1/mdm/changelog?${query.toString()}`)
        const data = (await resp.json()) as { items?: ChangeLogItem[] }
        setDetailChanges(data.items ?? [])
      } catch {
        setDetailChanges([])
      } finally {
        setDetailChangesLoading(false)
      }
    })()
  }, [detailRow, entity, idColumn])

  useEffect(() => {
    void (async () => {
      setAuditLoading(true)
      try {
        const resp = await fetch("/api/proxy/api/v1/mcp/audit?limit=10")
        const data = (await resp.json()) as { items?: AuditItem[] }
        setAuditItems(data.items ?? [])
      } catch {
        setAuditItems([])
      } finally {
        setAuditLoading(false)
      }
    })()
  }, [entity, scopeMode])

  async function init(): Promise<void> {
    try {
      const er = await fetch("/api/proxy/api/v1/mdm/entities")
      const text = await er.text()
      if (!text) return
      const ed = JSON.parse(text) as { entities?: EntityMeta[] }
      setEntities(ed.entities ?? [])
      await loadEntity(menuToEntity[activeItem] ?? "service-item")
    } catch {
      // API not available - use defaults
    }
  }

  function deriveApiFilters(): { search: string; status: string; valid_from_from: string; valid_to_to: string } {
    let status = ""
    let valid_from_from = ""
    let valid_to_to = ""
    for (const c of conditions) {
      if (c.field === "status" && c.op === "eq") status = c.value
      if (c.field === "valid_from" && (c.op === "eq" || c.op === "startsWith")) valid_from_from = c.value
      if (c.field === "valid_to" && (c.op === "eq" || c.op === "startsWith")) valid_to_to = c.value
    }
    return { search: globalSearch, status, valid_from_from, valid_to_to }
  }

  async function fetchEntityRows(entityKey: string, nextPage = page, nextPageSize = pageSize): Promise<void> {
    setIsLoading(true)
    try {
      const { search, status, valid_from_from, valid_to_to } = deriveApiFilters()
      const query = new URLSearchParams()
      query.set("limit", String(nextPageSize))
      query.set("offset", String((nextPage - 1) * nextPageSize))
      if (search) query.set("search", search)
      if (status) query.set("status", status)
      if (valid_from_from) query.set("valid_from_from", valid_from_from)
      if (valid_to_to) query.set("valid_to_to", valid_to_to)
      const activeConds = conditions.filter((c) => c.field && c.op)
      if (activeConds.length) {
        query.set("conditions", JSON.stringify(activeConds.map((c) => ({ field: c.field, op: c.op, value: c.value }))))
        query.set("condition_join", conditionJoin === "or" ? "or" : "and")
      }
      if (sortBy?.field) query.set("sort_by", sortBy.field)
      if (sortBy?.dir) query.set("sort_dir", sortBy.dir)
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entityKey)}?${query.toString()}`)
      const text = await resp.text()
      if (!text) {
        setRows([])
        setTotalRows(0)
        return
      }
      const data = JSON.parse(text) as { items?: RowData[]; total?: number; detail?: string }
      if (!resp.ok) throw new Error(data.detail ?? "Query failed")
      setRows(data.items ?? [])
      setTotalRows(Number(data.total ?? 0))
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Query failed"
      setMessage(`Load failed: ${detail}`)
      setRows([])
      setTotalRows(0)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadEntity(entityKey: string): Promise<void> {
    setEntity(entityKey)
    setEditingId("")
    setEditDraft({})
    setSelectedRowId("")
    setSelectedRowIds([])
    setPage(1)
    setPolicyDraft((prev) => ({ ...prev, entity_key: entityKey }))
    await fetchEntityRows(entityKey, 1, pageSize)
  }

  const applyCondition = (row: RowData, c: QueryCondition): boolean => {
    const raw = row[c.field]
    const text = String(raw ?? "").toLowerCase()
    const val = c.value.toLowerCase()
    if (c.op === "empty") return text.trim() === ""
    if (c.op === "notEmpty") return text.trim() !== ""
    if (!val) return true
    if (c.op === "contains") return text.includes(val)
    if (c.op === "eq") return text === val
    if (c.op === "neq") return text !== val
    if (c.op === "startsWith") return text.startsWith(val)
    if (c.op === "endsWith") return text.endsWith(val)
    return true
  }

  const filteredRows = rows.filter((r) => {
    const text = JSON.stringify(r).toLowerCase()
    const searchOk = !globalSearch || text.includes(globalSearch.toLowerCase())
    const activeConds = conditions.filter((c) => c.field && c.op)
    const condOk = !activeConds.length
      ? true
      : (conditionJoin === "or"
        ? activeConds.some((c) => applyCondition(r, c))
        : activeConds.every((c) => applyCondition(r, c)))
    return searchOk && condOk
  })

  const sortedRows = useMemo(() => {
    if (!sortBy) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const av = String(a[sortBy.field] ?? "")
      const bv = String(b[sortBy.field] ?? "")
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" })
      return sortBy.dir === "asc" ? cmp : -cmp
    })
  }, [filteredRows, sortBy])

  const integrityIssues = useMemo(() => {
    const issues: Array<{ rowId: string; field: string; value: string; reason: string }> = []
    const lookupSets: Record<string, Set<string>> = {}
    for (const [field, options] of Object.entries(lookupOptions)) {
      lookupSets[field] = new Set(options.map((o) => o.value))
    }
    for (const row of rows) {
      const rowId = String(row[idColumn] ?? "")
      for (const key of Object.keys(row)) {
        if (!key.endsWith("_id")) continue
        const val = String(row[key] ?? "").trim()
        if (!val) continue
        const set = lookupSets[key]
        if (set && !set.has(val)) issues.push({ rowId, field: key, value: val, reason: "Foreign key value not found in lookup" })
      }
    }
    return issues
  }, [rows, idColumn, lookupOptions])

  const healthMetrics = useMemo(() => {
    const total = rows.length
    const active = rows.filter((r) => String(r.status ?? "") === "active").length
    const invalidDate = rows.filter((r) => {
      const vf = String(r.valid_from ?? "")
      const vt = String(r.valid_to ?? "")
      return vf && vt && new Date(vf).getTime() > new Date(vt).getTime()
    }).length
    const duplicateCodeField = (activeMeta?.columns ?? []).find((c) => c === "code" || c.endsWith("_code"))
    let duplicateCount = 0
    if (duplicateCodeField) {
      const seen = new Set<string>()
      for (const r of rows) {
        const code = String(r[duplicateCodeField] ?? "").trim().toLowerCase()
        if (!code) continue
        if (seen.has(code)) duplicateCount += 1
        seen.add(code)
      }
    }
    const completeness = total ? Math.round((rows.reduce((acc, r) => {
      const cols = (activeMeta?.columns ?? []).slice(0, 6)
      const present = cols.filter((c) => String(r[c] ?? "").trim()).length
      return acc + (cols.length ? present / cols.length : 1)
    }, 0) / total) * 100) : 100
    return { total, active, invalidDate, duplicateCount, completeness, integrity: integrityIssues.length }
  }, [rows, activeMeta, integrityIssues])

  // Rows are already server-paginated in fetchEntityRows (limit/offset), so the
  // current page's rows are exactly sortedRows — no second client-side slice.
  const pagedRows = useMemo(() => sortedRows, [sortedRows])

  const totalPages = Math.max(1, Math.ceil((totalRows || sortedRows.length) / pageSize))
  const visibleColumns = useMemo(() => {
    const cols = columnOrder.length ? columnOrder : (activeMeta?.columns ?? []).slice(0, 6)
    const roleFiltered = roleMode === "viewer" ? cols.filter((c) => !c.endsWith("_id")) : cols
    return roleFiltered.filter((c) => !hiddenColumns.includes(c))
  }, [activeMeta, hiddenColumns, columnOrder, roleMode])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  function addCondition(): void {
    const firstField = queryFields[0] ?? "status"
    setConditions((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, field: firstField, op: "contains", value: "" }])
  }

  function updateCondition(id: string, patch: Partial<QueryCondition>): void {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function inferTargetEntityKey(columnName: string): string | null {
    const manual: Record<string, string> = {
      mapping_set_id: "org-mapping-set",
    }
    if (manual[columnName]) return manual[columnName]
    if (!columnName.endsWith("_id")) return null
    const base = columnName.slice(0, -3).replaceAll("_", "-")
    return entities.some((e) => e.key === base) ? base : null
  }

  function openCreateModal(): void {
    const next: Record<string, string> = {}
    for (const col of (activeMeta?.columns ?? []).slice(0, 6)) {
      if (col === "code") next[col] = `${entity.toUpperCase().slice(0, 5)}-${Date.now()}`
      else if (col === "name") next[col] = `New ${entity} ${new Date().toISOString().slice(11, 19)}`
      else if (col.endsWith("_code")) next[col] = `${col.toUpperCase()}-${Date.now()}`
      else next[col] = ""
    }
    next.status = "active"
    if (entity === "exchange-rate") {
      const r = nextMonthRange()
      next.valid_from = r.from
      next.valid_to = r.to
    } else {
      next.valid_from = new Date().toISOString().slice(0, 10)
      next.valid_to = "9999-12-31"
    }
    setCreateDraft(next)
    setCreateErrors({})
    setCreateWarnings([])
    setCreateModalOpen(true)
  }

  function validateCreateDraft(): boolean {
    const errs: Record<string, string> = {}
    for (const reqField of requiredCreateFields) {
      if (!String(createDraft[reqField] ?? "").trim()) errs[reqField] = "Required"
    }
    const codeField = createFields.find((f) => f === "code" || f.endsWith("_code"))
    if (codeField) {
      const nextCode = String(createDraft[codeField] ?? "").trim().toLowerCase()
      if (nextCode) {
        const duplicated = rows.some((r) => String(r[codeField] ?? "").trim().toLowerCase() === nextCode)
        if (duplicated) errs[codeField] = "Duplicate code"
      }
    }
    const vf = String(createDraft.valid_from ?? "").trim()
    const vt = String(createDraft.valid_to ?? "").trim()
    if (vf && vt && new Date(vf).getTime() > new Date(vt).getTime()) errs.valid_to = "Must be >= valid_from"
    for (const [field, rule] of Object.entries(validationRules)) {
      const value = String(createDraft[field] ?? "").trim()
      if (rule.required && !value) errs[field] = "Required by metadata rule"
      if (value && rule.regex) {
        try {
          const re = new RegExp(rule.regex)
          if (!re.test(value)) errs[field] = "Regex not matched"
        } catch {
          // ignore bad regex
        }
      }
      if (value && rule.enum) {
        const allowed = rule.enum.split(",").map((x) => x.trim()).filter(Boolean)
        if (allowed.length && !allowed.includes(value)) errs[field] = `Allowed: ${allowed.join(", ")}`
      }
    }
    setCreateErrors(errs)
    return Object.keys(errs).length === 0
  }

  function startInlineAdd(): void {
    const next: Record<string, string> = {}
    for (const col of createFields) next[col] = ""
    next.status = "active"
    if (entity === "exchange-rate") {
      const r = nextMonthRange()
      next.valid_from = r.from
      next.valid_to = r.to
    } else {
      next.valid_from = new Date().toISOString().slice(0, 10)
      next.valid_to = "9999-12-31"
    }
    setInlineDraft(next)
    setInlineErrors({})
    setInlineAddMode(true)
  }

  function validateInlineDraft(): boolean {
    const errs: Record<string, string> = {}
    for (const reqField of requiredCreateFields) {
      if (!String(inlineDraft[reqField] ?? "").trim()) errs[reqField] = "Required"
    }
    const codeField = createFields.find((f) => f === "code" || f.endsWith("_code"))
    if (codeField) {
      const nextCode = String(inlineDraft[codeField] ?? "").trim().toLowerCase()
      if (nextCode) {
        const duplicated = rows.some((r) => String(r[codeField] ?? "").trim().toLowerCase() === nextCode)
        if (duplicated) errs[codeField] = "Duplicate code"
      }
    }
    const vf = String(inlineDraft.valid_from ?? "").trim()
    const vt = String(inlineDraft.valid_to ?? "").trim()
    if (vf && vt && new Date(vf).getTime() > new Date(vt).getTime()) errs.valid_to = "Must be >= valid_from"
    for (const [field, rule] of Object.entries(validationRules)) {
      const value = String(inlineDraft[field] ?? "").trim()
      if (rule.required && !value) errs[field] = "Required by metadata rule"
      if (value && rule.regex) {
        try {
          const re = new RegExp(rule.regex)
          if (!re.test(value)) errs[field] = "Regex not matched"
        } catch {
          // ignore bad regex
        }
      }
    }
    setInlineErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function submitInlineAdd(): Promise<void> {
    if (!validateInlineDraft()) return
    const payload: Record<string, unknown> = {}
    for (const col of createFields) payload[col] = inlineDraft[col] ?? ""
    payload.status = inlineDraft.status || "draft"
    payload.valid_from = inlineDraft.valid_from || new Date().toISOString().slice(0, 10)
    payload.valid_to = inlineDraft.valid_to || null
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string; errors?: ApiFieldError[]; warnings?: ApiFieldError[]; item?: Record<string, unknown> }
    if (!resp.ok || !data.ok) {
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const next: Record<string, string> = {}
        for (const e of data.errors) if (e.field && !next[e.field]) next[e.field] = e.message
        setInlineErrors((prev) => ({ ...prev, ...next }))
      }
      setMessage(`Create failed: ${data.detail ?? "unknown"}`)
      return
    }
    const createdId = String(data.item?.[idColumn] ?? "")
    setInlineAddMode(false)
    setInlineDraft({})
    setInlineErrors({})
    setMessage(Array.isArray(data.warnings) && data.warnings.length > 0 ? `Record created with ${data.warnings.length} warning(s)` : "Record created")
    await loadEntity(entity)
    if (createdId) {
      setLastCreatedRowId(createdId)
      setSelectedRowId(createdId)
    }
  }

  function remapImportCsv(rawCsv: string): string {
    const lines = rawCsv.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return rawCsv
    const split = (line: string): string[] => {
      const out: string[] = []
      let cur = ""
      let inQ = false
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]
        if (ch === "\"") {
          if (inQ && line[i + 1] === "\"") { cur += "\""; i += 1 } else inQ = !inQ
        } else if (ch === "," && !inQ) { out.push(cur); cur = "" } else cur += ch
      }
      out.push(cur)
      return out
    }
    const esc = (v: string) => (v.includes(",") || v.includes("\"") || v.includes("\n") ? `"${v.replaceAll("\"", "\"\"")}"` : v)
    const sourceHeaders = split(lines[0]).map((h) => h.trim())
    const mappedHeaders = sourceHeaders
      .map((h) => ({ source: h, target: importHeaderMap[h] ?? h }))
      .filter((x) => x.target && x.target !== "__ignore__")
    if (!mappedHeaders.length) return rawCsv
    const result = [mappedHeaders.map((x) => x.target).join(",")]
    for (const line of lines.slice(1)) {
      const vals = split(line)
      const row = mappedHeaders.map((x) => {
        const idx = sourceHeaders.indexOf(x.source)
        return esc((vals[idx] ?? "").trim())
      })
      result.push(row.join(","))
    }
    return result.join("\n")
  }

  async function runAiAssist(row: RowData): Promise<void> {
    const rowId = getRowId(row)
    if (!rowId) return
    setAiAssistLoading(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}/ai-assist?actor=mdm-ui`)
      const data = (await resp.json()) as { ok?: boolean; suggestions?: AiSuggestion[]; detail?: string }
      if (!resp.ok || !data.ok) {
        setMessage(`AI assist failed: ${data.detail ?? "unknown"}`)
        return
      }
      setAiSuggestions(data.suggestions ?? [])
      setAiSuggestionRowId(rowId)
      setDetailRow(row)
      setDetailTab("overview")
      setMessage(`AI assist generated ${(data.suggestions ?? []).length} suggestions`)
    } finally {
      setAiAssistLoading(false)
    }
  }

  async function applyAiSuggestion(row: RowData, suggestion: AiSuggestion): Promise<void> {
    if (!suggestion.field) return setMessage("Suggestion has no target field")
    const rowId = getRowId(row)
    if (!rowId) return
    const version = Number(row.version_no ?? 1)
    const current = String(row[suggestion.field] ?? "")
    const extracted = suggestion.message.match(/=>\s*([^\n]+)/)?.[1]?.trim() ?? current
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [suggestion.field]: extracted, version_no: version, updated_by: "mdm-ui-ai-apply" }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Apply suggestion failed: ${data.detail ?? "unknown"}`)
    setMessage(`Applied AI suggestion on ${suggestion.field}`)
    await loadEntity(entity)
  }

  async function submitCreateModal(): Promise<void> {
    if (!validateCreateDraft()) return
    const payload: Record<string, unknown> = {}
    for (const col of createFields) payload[col] = createDraft[col] ?? ""
    payload.status = createDraft.status || "active"
    payload.valid_from = createDraft.valid_from || new Date().toISOString().slice(0, 10)
    payload.valid_to = createDraft.valid_to || null
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string; errors?: ApiFieldError[]; warnings?: ApiFieldError[]; item?: Record<string, unknown> }
    if (!resp.ok || !data.ok) {
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const next: Record<string, string> = {}
        for (const e of data.errors) if (e.field && !next[e.field]) next[e.field] = e.message
        setCreateErrors((prev) => ({ ...prev, ...next }))
      }
      return setMessage(`Create failed: ${data.detail ?? "unknown"}`)
    }
    setCreateWarnings(Array.isArray(data.warnings) ? data.warnings : [])
    const createdId = String(data.item?.[idColumn] ?? "")
    setCreateModalOpen(false)
    setCreateErrors({})
    setMessage(Array.isArray(data.warnings) && data.warnings.length > 0 ? `Record created with ${data.warnings.length} warning(s)` : "Record created")
    await loadEntity(entity)
    if (createdId) {
      setLastCreatedRowId(createdId)
      setSelectedRowId(createdId)
    }
  }

  // Natural-language exchange-rate editor: 1 [FROM] = [rate] [TO].
  const EXCHANGE_RATE_INLINE_FIELDS = ["from_currency", "to_currency", "rate"]
  function renderRateExpression(draft: Record<string, string>, setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>, errors: Record<string, string>): React.ReactNode {
    const from = draft.from_currency ?? ""
    const to = draft.to_currency ?? ""
    const rate = draft.rate ?? ""
    const curOpts = lookupOptions["from_currency"] ?? lookupOptions["to_currency"] ?? []
    const sel = "rounded border border-border bg-background px-2 py-1.5 text-sm"
    return (
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">Exchange Rate <span className="text-destructive">*</span></label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">1</span>
          <select value={from} onChange={(e) => setDraft((p) => ({ ...p, from_currency: e.target.value }))} className={sel}>
            <option value="">From</option>
            {curOpts.map((o) => <option key={o.value} value={o.value}>{o.symbol ? `${o.value} (${o.symbol})` : o.value}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">=</span>
          <input value={rate} inputMode="decimal" placeholder="0.000000" onChange={(e) => setDraft((p) => ({ ...p, rate: e.target.value }))} className={`w-32 ${sel}`} />
          <select value={to} onChange={(e) => setDraft((p) => ({ ...p, to_currency: e.target.value }))} className={sel}>
            <option value="">To</option>
            {curOpts.map((o) => <option key={o.value} value={o.value}>{o.symbol ? `${o.value} (${o.symbol})` : o.value}</option>)}
          </select>
        </div>
        {from && to && rate ? <div className="text-xs text-muted-foreground">1 {from} = {rate} {to}</div> : null}
        {errors.from_currency || errors.to_currency || errors.rate ? <div className="text-xs text-destructive">{errors.from_currency || errors.to_currency || errors.rate}</div> : null}
      </div>
    )
  }

  function renderCreateField(field: string): React.ReactNode {
    const options = lookupOptions[field] ?? ENUM_FIELD_OPTIONS[field]
    if (options && options.length > 0) {
      return (
        <select
          value={createDraft[field] ?? ""}
          onChange={(e) => setCreateDraft((prev) => ({ ...prev, [field]: e.target.value }))}
          className={`w-full rounded border px-2 py-1.5 text-sm ${createErrors[field] ? "border-destructive" : "border-border"} bg-background`}
        >
          <option value="">-- Select --</option>
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
    }
    return (
      <input
        value={createDraft[field] ?? ""}
        onChange={(e) => setCreateDraft((prev) => ({ ...prev, [field]: e.target.value }))}
        className={`w-full rounded border px-2 py-1.5 text-sm ${createErrors[field] ? "border-destructive" : "border-border"} bg-background`}
      />
    )
  }

  function renderEditCell(field: string): React.ReactNode {
    const options = lookupOptions[field] ?? ENUM_FIELD_OPTIONS[field]
    if (options && options.length > 0) {
      return (
        <select
          value={editDraft[field] ?? ""}
          onChange={(e) => setEditDraft((prev) => ({ ...prev, [field]: e.target.value }))}
          className={`w-full rounded border px-1 py-0.5 text-xs ${fieldErrors[field] ? "border-destructive" : "border-border"} bg-background`}
          title={fieldErrors[field] ?? ""}
        >
          <option value="">-- Select --</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }
    return (
      <input
        value={editDraft[field] ?? ""}
        onChange={(e) => setEditDraft((prev) => ({ ...prev, [field]: e.target.value }))}
        className={`w-full rounded border px-1 py-0.5 text-xs ${fieldErrors[field] ? "border-destructive" : "border-border"} bg-background`}
        title={fieldErrors[field] ?? ""}
      />
    )
  }

  function removeCondition(id: string): void {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }

  function columnMenuAction(action: string, col: string): void {
    if (action === "sortAsc") setSortBy({ field: col, dir: "asc" })
    if (action === "sortDesc") setSortBy({ field: col, dir: "desc" })
    if (action === "hide") setHiddenColumns((prev) => (prev.includes(col) ? prev : [...prev, col]))
    if (action === "selectColumn") setSelectedColumn(col)
    if (action === "clearColumnSelection") setSelectedColumn("")
    setMenuColumn("")
  }

  function moveColumn(from: string, to: string): void {
    if (!from || !to || from === to) return
    setColumnOrder((prev) => {
      const current = prev.length ? [...prev] : [...(activeMeta?.columns ?? []).slice(0, 6)]
      const fromIndex = current.indexOf(from)
      const toIndex = current.indexOf(to)
      if (fromIndex < 0 || toIndex < 0) return current
      current.splice(fromIndex, 1)
      current.splice(toIndex, 0, from)
      return current
    })
  }

  function resetGridLayout(): void {
    setColumnMenuMode("Default")
    setHiddenColumns([])
    setSortBy(null)
    setPageSize(12)
    setGroupBy("")
    setColumnOrder((activeMeta?.columns ?? []).slice(0, 6))
    setSelectedColumn("")
    setMenuColumn("")
    setShowLeftPanel(true)
    setLeftPanelWidth(320)
    setColumnPreset("default")
  }

  function applyColumnPreset(mode: "default" | "ops" | "minimal"): void {
    const cols = (activeMeta?.columns ?? []).slice(0, 6)
    if (!cols.length) return
    setColumnPreset(mode)
    if (mode === "default") {
      setColumnOrder(cols)
      setHiddenColumns([])
      return
    }
    if (mode === "minimal") {
      const keep = cols.slice(0, Math.min(3, cols.length))
      setColumnOrder(cols)
      setHiddenColumns(cols.filter((c) => !keep.includes(c)))
      return
    }
    const keep = cols.filter((c) => /code|name|status|country|currency|type/i.test(c)).slice(0, Math.min(4, cols.length))
    setColumnOrder(cols)
    setHiddenColumns(cols.filter((c) => !keep.includes(c)))
  }

  function startResizeLeftPanel(e: React.MouseEvent<HTMLDivElement>): void {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftPanelWidth
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      const next = Math.min(520, Math.max(260, startWidth + delta))
      setLeftPanelWidth(next)
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function toggleRowSelection(rowId: string): void {
    setSelectedRowIds((prev) => prev.includes(rowId) ? prev.filter((x) => x !== rowId) : [...prev, rowId])
    setSelectedRowId(rowId)
  }

  async function bulkArchiveSelected(): Promise<void> {
    if (!selectedRowIds.length) return setMessage("Please select rows first")
    let okCount = 0
    for (const rowId of selectedRowIds) {
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, { method: "DELETE" })
      if (resp.ok) okCount += 1
    }
    setMessage(`Bulk archive(selected) done: ${okCount}/${selectedRowIds.length}`)
    await loadEntity(entity)
  }

  async function bulkRestoreSelected(): Promise<void> {
    if (!selectedRowIds.length) return setMessage("Please select rows first")
    let okCount = 0
    for (const rowId of selectedRowIds) {
      const row = rows.find((r) => getRowId(r) === rowId)
      const version = Number(row?.version_no ?? 1)
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "inactive", version_no: version, updated_by: "mdm-ui-bulk" }),
      })
      if (resp.ok) okCount += 1
    }
    setMessage(`Bulk restore(selected) done: ${okCount}/${selectedRowIds.length}`)
    await loadEntity(entity)
  }

  async function bulkSetStatusSelected(nextStatus: "draft" | "active" | "inactive"): Promise<void> {
    if (!selectedRowIds.length) return setMessage("Please select rows first")
    let okCount = 0
    for (const rowId of selectedRowIds) {
      const row = rows.find((r) => getRowId(r) === rowId)
      const version = Number(row?.version_no ?? 1)
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, version_no: version, updated_by: "mdm-ui-bulk" }),
      })
      if (resp.ok) okCount += 1
    }
    setMessage(`Bulk status(${nextStatus}) done: ${okCount}/${selectedRowIds.length}`)
    await loadEntity(entity)
  }

  function exportSelectedCsv(): void {
    if (!selectedRowIds.length) return setMessage("Please select rows first")
    const selectedSet = new Set(selectedRowIds)
    const selected = rows.filter((r) => selectedSet.has(getRowId(r)))
    if (!selected.length) return setMessage("No selected data to export")
    const cols = [idColumn, ...(activeMeta?.columns ?? []).slice(0, 6), "status", "valid_from", "valid_to"]
    const escapeCell = (v: unknown) => {
      const s = String(v ?? "")
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g, "\"\"")}"`
      return s
    }
    const lines = [cols.join(",")]
    for (const r of selected) lines.push(cols.map((c) => escapeCell(r[c])).join(","))
    const csv = lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${entity}-selected.csv`
    a.click()
    URL.revokeObjectURL(url)
    setMessage(`Exported selected rows: ${selected.length}`)
  }

  function saveCurrentView(): void {
    const name = window.prompt("View name")
    if (!name) return
    const view: SavedView = { id: `${Date.now()}`, name, globalSearch, conditions, conditionJoin, groupBy, sortBy }
    void (async () => {
      try {
        const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/views`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...view, scope: scopeMode, actor: "demo-user", role: roleMode, updated_by: "mdm-ui" }),
        })
        const data = (await resp.json()) as { ok?: boolean; item?: SavedView; detail?: string }
        if (!resp.ok || !data.ok || !data.item) throw new Error(data.detail ?? "save failed")
        setSavedViews((prev) => [data.item!, ...prev.filter((v) => v.id !== data.item!.id)])
        setActiveViewId(data.item.id)
        setMessage(`Saved view: ${name}`)
      } catch {
        setSavedViews((prev) => [...prev, view])
        setActiveViewId(view.id)
        setMessage(`Saved view locally: ${name}`)
      }
    })()
  }

  function applyView(viewId: string): void {
    setActiveViewId(viewId)
    const v = savedViews.find((x) => x.id === viewId)
    if (!v) return
    setGlobalSearch(v.globalSearch)
    setConditions(v.conditions)
    setConditionJoin(v.conditionJoin ?? "and")
    setGroupBy(v.groupBy)
    setSortBy(v.sortBy)
    setMessage(`Applied view: ${v.name}`)
  }

  function deleteView(viewId: string): void {
    const v = savedViews.find((x) => x.id === viewId)
    void (async () => {
      try {
        await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/views/${encodeURIComponent(viewId)}?scope=${scopeMode}&actor=demo-user`, {
          method: "DELETE",
        })
      } catch {
        // ignore and remove locally
      } finally {
        setSavedViews((prev) => prev.filter((x) => x.id !== viewId))
        if (activeViewId === viewId) setActiveViewId("")
        setMessage(`Deleted view: ${v?.name ?? viewId}`)
      }
    })()
  }

  async function bulkArchiveFiltered(): Promise<void> {
    if (!sortedRows.length) return setMessage("No filtered rows to archive")
    let okCount = 0
    for (const row of sortedRows) {
      const rowId = String(row[idColumn] ?? "")
      if (!rowId) continue
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, { method: "DELETE" })
      if (resp.ok) okCount += 1
    }
    setMessage(`Bulk archive done: ${okCount}/${sortedRows.length}`)
    await loadEntity(entity)
  }

  function getRowId(row: RowData): string {
    return String(row[idColumn] ?? "")
  }

  function getSelectedRow(): RowData | undefined {
    return sortedRows.find((r) => getRowId(r) === selectedRowId)
  }

  function startEditSelected(): void {
    const row = getSelectedRow()
    if (!row) return setMessage("Please select one row first")
    startEditRow(row)
  }

  async function archiveSelected(): Promise<void> {
    const row = getSelectedRow()
    if (!row) return setMessage("Please select one row first")
    setConfirmAction({ type: "delete", row })
  }

  // Inline (in-grid) edit of the selected row — no modal popup.
  function startInlineEditSelected(): void {
    const row = getSelectedRow()
    if (!row) return setMessage("Please select one row first")
    const rowId = String(row[idColumn] ?? "")
    const next: Record<string, string> = {}
    for (const col of (activeMeta?.columns ?? [])) next[col] = String(row[col] ?? "")
    next.status = String(row.status ?? "draft")
    next.valid_from = toDateInputValue(row.valid_from, new Date().toISOString().slice(0, 10))
    next.valid_to = toDateInputValue(row.valid_to, "9999-12-31")
    setInlineAddMode(false)
    setEditDraft(next)
    setFieldErrors({})
    setEditWarnings([])
    setEditingId(rowId)
  }

  // Inline (in-grid) delete of the selected row — soft archive, no modal popup.
  async function deleteSelectedInline(): Promise<void> {
    const row = getSelectedRow()
    if (!row) return setMessage("Please select one row first")
    const rowId = String(row[idColumn] ?? "")
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, { method: "DELETE" })
      setMessage(resp.ok ? "Row archived" : "Delete failed")
    } catch {
      setMessage("Delete failed")
    }
    await loadEntity(entity)
  }

  async function saveSelectedEdit(): Promise<void> {
    const row = getSelectedRow()
    if (!row) return setMessage("Please select one row first")
    await saveEditRow(row)
  }

  const groupedRows = useMemo(() => {
    if (!groupBy) return [{ key: "", rows: pagedRows }]
    const m = new Map<string, RowData[]>()
    for (const r of pagedRows) {
      const k = String(r[groupBy] ?? "(blank)")
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    return Array.from(m.entries()).map(([key, rows]) => ({ key, rows }))
  }, [groupBy, pagedRows])

  async function addRecord(): Promise<void> {
    if (!activeMeta) return
    const payload: Record<string, unknown> = { status: "draft" }
    for (const col of activeMeta.columns) {
      if (col === "code") payload.code = `${entity.toUpperCase().slice(0, 5)}-${Date.now()}`
      if (col === "name") payload.name = `New ${entity} ${new Date().toISOString().slice(11, 19)}`
      if (col.endsWith("_code") && !payload[col]) payload[col] = `${col.toUpperCase()}-${Date.now()}`
      if ((col.includes("name") || col === "title") && !payload[col]) payload[col] = `New ${col}`
    }
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Create failed: ${data.detail ?? "unknown"}`)
    setMessage("Record created")
    await loadEntity(entity)
  }

  async function downloadCsv(): Promise<void> {
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/export.csv?limit=1000`)
    if (!resp.ok) return setMessage("CSV export failed")
    const text = await resp.text()
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${entity}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadRowsCsv(dataRows: RowData[], filename: string): void {
    if (!dataRows.length) return setMessage("No rows to export")
    const cols = [idColumn, ...(activeMeta?.columns ?? []).slice(0, 6), "status", "valid_from", "valid_to"]
    const esc = (v: unknown) => {
      const s = String(v ?? "")
      if (s.includes(",") || s.includes("\n") || s.includes("\"")) return `"${s.replaceAll("\"", "\"\"")}"`
      return s
    }
    const text = [cols.join(","), ...dataRows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n")
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importCsv(): Promise<void> {
    if (!csvText.trim()) return setMessage("Paste CSV first")
    const mappedCsv = remapImportCsv(csvText)
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/import.csv`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csv: mappedCsv, created_by: importActor || "mdm-ui-import", skipErrors: skipImportErrors, dry_run: importValidateOnly }),
    })
    const data = (await resp.json()) as { ok?: boolean; created?: number; failed?: number; detail?: string; dry_run?: boolean; results?: Array<{ rowNo: number; ok: boolean; detail?: string; errors?: Array<{ field: string; message: string; code?: string }> }> }
    if (!resp.ok || !data.ok) return setMessage(`Import failed: ${data.detail ?? "unknown"}`)
    if (Array.isArray(data.results) && data.results.some((r) => !r.ok)) {
      const failedRows = data.results.filter((r) => !r.ok)
      const lines = ["rowNo,field,code,message"]
      for (const r of failedRows) {
        const errs = r.errors?.length ? r.errors : [{ field: "", code: "", message: r.detail ?? "failed" }]
        for (const e of errs) {
          const esc = (v: string) => (v.includes(",") || v.includes("\"") ? `"${v.replaceAll("\"", "\"\"")}"` : v)
          lines.push([String(r.rowNo), esc(e.field ?? ""), esc(e.code ?? ""), esc(e.message ?? "")].join(","))
        }
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${entity}-import-errors.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    if (data.dry_run) return setMessage(`Dry-run done: valid=${(data.created ?? 0)}, invalid=${data.failed ?? 0}`)
    setMessage(`Import done: created=${data.created ?? 0}, failed=${data.failed ?? 0}`)
    await loadEntity(entity)
  }

  function startEditRow(row: RowData): void {
    const rowId = String(row[idColumn] ?? "")
    setEditingId("")
    const next: Record<string, string> = {}
    for (const col of (activeMeta?.columns ?? []).slice(0, 6)) next[col] = String(row[col] ?? "")
    next.status = String(row.status ?? "draft")
    next.valid_from = toDateInputValue(row.valid_from, new Date().toISOString().slice(0, 10))
    next.valid_to = toDateInputValue(row.valid_to, "9999-12-31")
    setEditDraft(next)
    setFieldErrors({})
    setEditWarnings([])
    setEditTargetRow(row)
    setEditModalOpen(true)
  }

  function saveCurrentFilter(): void {
    const name = savedFilterName.trim()
    if (!name) {
      setMessage("Enter filter name")
      return
    }
    const item = { id: `${Date.now()}`, name, globalSearch, conditions, conditionJoin }
    setSavedFilters((prev) => [item, ...prev.filter((f) => f.name !== name)])
    setActiveFilterId(item.id)
    setSavedFilterName("")
    setMessage(`Filter saved: ${name}`)
  }

  function applySavedFilter(filterId: string): void {
    setActiveFilterId(filterId)
    const item = savedFilters.find((f) => f.id === filterId)
    if (!item) return
    setGlobalSearch(item.globalSearch)
    setConditions(item.conditions)
    setConditionJoin(item.conditionJoin ?? "and")
  }

  function applyQuickPresetValue(preset: string): void {
    setQuickPreset(preset)
    if (!preset) return
    const today = new Date().toISOString().slice(0, 10)
    if (preset === "active-only") {
      setGlobalSearch("")
      setConditionJoin("and")
      setConditions([{ id: `${Date.now()}-a`, field: "status", op: "eq", value: "active" }])
      return
    }
    if (preset === "draft-only") {
      setGlobalSearch("")
      setConditionJoin("and")
      setConditions([{ id: `${Date.now()}-d`, field: "status", op: "eq", value: "draft" }])
      return
    }
    if (preset === "inactive-only") {
      setGlobalSearch("")
      setConditionJoin("and")
      setConditions([{ id: `${Date.now()}-i`, field: "status", op: "eq", value: "inactive" }])
      return
    }
    if (preset === "expiring-30d") {
      const in30 = new Date(Date.now() + 30 * 24 * 3600_000).toISOString().slice(0, 10)
      setGlobalSearch("")
      setConditionJoin("and")
      setConditions([
        { id: `${Date.now()}-s`, field: "status", op: "neq", value: "archived" },
        { id: `${Date.now()}-vt1`, field: "valid_to", op: "notEmpty", value: "" },
        { id: `${Date.now()}-vt2`, field: "valid_to", op: "contains", value: in30.slice(0, 7) },
      ])
      setMessage(`Quick preset applied (expiring around ${in30})`)
      return
    }
    if (preset === "invalid-date-range") {
      setGlobalSearch(today)
      setConditionJoin("and")
      setConditions([])
      setMessage("Quick preset hint: use health panel to inspect invalid date ranges")
    }
  }

  async function setStatusWithReason(row: RowData, status: "active" | "inactive"): Promise<void> {
    const rowId = String(row[idColumn] ?? "")
    if (!rowId) return
    const fromStatus = String(row.status ?? "draft")
    const allowed = transitionMatrix[fromStatus] ?? []
    if (status !== fromStatus && !allowed.includes(status)) {
      return setMessage(`Transition blocked by matrix: ${fromStatus} -> ${status}`)
    }
    const version = Number(row.version_no ?? 1)
    const payload: Record<string, unknown> = {
      status,
      version_no: version,
      updated_by: actionReason ? `mdm-ui:${actionReason}` : "mdm-ui",
    }
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Status update failed: ${data.detail ?? "unknown"}`)
    setMessage(`Status set to ${status}`)
    await loadEntity(entity)
  }

  function validateDraft(): boolean {
    const errs: Record<string, string> = {}
    const requiredFields = validationSchema?.requiredFields?.length
      ? validationSchema.requiredFields
      : (activeMeta?.columns ?? []).filter((c) => c === "code" || c.endsWith("_code") || c === "name" || c.endsWith("_name") || c === "title")
    for (const f of requiredFields) {
      if (!String(editDraft[f] ?? "").trim()) errs[f] = "Required"
    }
    const vf = String(editDraft.valid_from ?? "").trim()
    const vt = String(editDraft.valid_to ?? "").trim()
    if (vf && vt && new Date(vf).getTime() > new Date(vt).getTime()) errs.valid_to = "Must be >= valid_from"
    for (const [field, rule] of Object.entries(validationRules)) {
      const value = String(editDraft[field] ?? "").trim()
      if (rule.required && !value) errs[field] = "Required by metadata rule"
      if (value && rule.regex) {
        try {
          const re = new RegExp(rule.regex)
          if (!re.test(value)) errs[field] = "Regex not matched"
        } catch {
          // ignore bad regex
        }
      }
      if (value && rule.min !== undefined && !Number.isNaN(Number(value)) && Number(value) < rule.min) errs[field] = `Min ${rule.min}`
      if (value && rule.max !== undefined && !Number.isNaN(Number(value)) && Number(value) > rule.max) errs[field] = `Max ${rule.max}`
      if (value && rule.enum) {
        const allowed = rule.enum.split(",").map((x) => x.trim()).filter(Boolean)
        if (allowed.length && !allowed.includes(value)) errs[field] = `Allowed: ${allowed.join(", ")}`
      }
    }
    if (editingId) {
      const baseRow = rows.find((r) => String(r[idColumn] ?? "") === editingId)
      const fromStatus = String(baseRow?.status ?? "draft")
      const toStatus = String(editDraft.status ?? fromStatus)
      const allowed = transitionMatrix[fromStatus] ?? []
      if (toStatus !== fromStatus && !allowed.includes(toStatus)) errs.status = `Transition blocked: ${fromStatus} -> ${toStatus}`
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function saveEditRow(row: RowData): Promise<void> {
    if (!validateDraft()) return setMessage("Please fix field validation errors")
    const duplicateCodeField = (activeMeta?.columns ?? []).find((c) => c === "code" || c.endsWith("_code"))
    if (duplicateCodeField) {
      const nextCode = String(editDraft[duplicateCodeField] ?? "").trim().toLowerCase()
      if (nextCode) {
        const hasDup = rows.some((r) => String(r[idColumn] ?? "") !== String(row[idColumn] ?? "") && String(r[duplicateCodeField] ?? "").trim().toLowerCase() === nextCode)
        if (hasDup) return setMessage(`Duplicate detected on ${duplicateCodeField}`)
      }
    }
    const rowId = String(row[idColumn] ?? "")
    const version = Number(row.version_no ?? 1)
    if (!rowId) return
    const payload: Record<string, unknown> = { ...editDraft, version_no: version, updated_by: "mdm-ui" }
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string; errors?: ApiFieldError[]; warnings?: ApiFieldError[] }
    if (!resp.ok || !data.ok) {
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const next: Record<string, string> = {}
        for (const e of data.errors) if (e.field && !next[e.field]) next[e.field] = e.message
        setFieldErrors((prev) => ({ ...prev, ...next }))
      }
      return setMessage(`Save failed: ${data.detail ?? "unknown"}`)
    }
    setEditWarnings(Array.isArray(data.warnings) ? data.warnings : [])
    setMessage(Array.isArray(data.warnings) && data.warnings.length > 0 ? `Row updated with ${data.warnings.length} warning(s)` : "Row updated")
    setEditingId("")
    setEditDraft({})
    await loadEntity(entity)
  }

  async function archiveRow(row: RowData): Promise<void> {
    const rowId = String(row[idColumn] ?? "")
    if (!rowId) return
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, { method: "DELETE" })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Delete failed: ${data.detail ?? "unknown"}`)
    setMessage("Row deleted")
    await loadEntity(entity)
  }

  async function applyMassUpdateFiltered(): Promise<void> {
    const field = massField.trim()
    if (!field || !sortedRows.length) return setMessage("Select a field and make sure rows are available")
    const baseFilters = deriveApiFilters()
    const previewResp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/mass-update/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field, ...baseFilters }),
    })
    const previewData = (await previewResp.json()) as { ok?: boolean; count?: number; detail?: string }
    if (!previewResp.ok || !previewData.ok) return setMessage(`Mass update preview failed: ${previewData.detail ?? "unknown"}`)
    if (!window.confirm(`Apply mass update to ${previewData.count ?? 0} records?`)) return
    if (scopeMode === "tenant") {
      const submitResp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/approvals/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action_type: "mass-update",
          scope: scopeMode,
          submitted_by: "demo-user",
          payload: { field, value: massValue, ...baseFilters },
        }),
      })
      const submitData = (await submitResp.json()) as { ok?: boolean; approval_id?: string; detail?: string; warnings?: ApiFieldError[] }
      if (!submitResp.ok || !submitData.ok) return setMessage(`Approval submit failed: ${submitData.detail ?? "unknown"}`)
      setMessage(`Approval submitted: ${submitData.approval_id}${(submitData.warnings?.length ?? 0) > 0 ? ` (warnings: ${submitData.warnings?.length ?? 0})` : ""}`)
      await loadApprovals()
      return
    }
    const applyResp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/mass-update`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field, value: massValue, updated_by: "mdm-ui-mass", ...baseFilters }),
    })
    const applyData = (await applyResp.json()) as { ok?: boolean; updated?: number; detail?: string }
    if (!applyResp.ok || !applyData.ok) return setMessage(`Mass update failed: ${applyData.detail ?? "unknown"}`)
    setMessage(`Mass update done: ${applyData.updated ?? 0}`)
    await loadEntity(entity)
  }

  async function loadApprovals(): Promise<void> {
    try {
      const qs = new URLSearchParams()
      qs.set("limit", String(showApprovalBoard ? approvalPageSize : 50))
      qs.set("offset", String(showApprovalBoard ? (approvalPage - 1) * approvalPageSize : 0))
      if (approvalStatusFilter) qs.set("status", approvalStatusFilter)
      if (approvalEntityFilter) qs.set("entity_key", approvalEntityFilter)
      if (approvalRoutedFilter) qs.set("routed_to", approvalRoutedFilter)
      if (approvalOverdueOnly) qs.set("overdue", "true")
      if (approvalEscalatedOnly) qs.set("escalated", "true")
      const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals?${qs.toString()}`)
      const data = (await resp.json()) as { items?: ApprovalItem[]; total?: number }
      setApprovalItems(data.items ?? [])
      setApprovalTotal(Number(data.total ?? (data.items ?? []).length))
    } catch {
      setApprovalItems([])
      setApprovalTotal(0)
    }
  }

  async function openApprovalDetail(approvalId: string): Promise<void> {
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals/${encodeURIComponent(approvalId)}`)
      const data = (await resp.json()) as { ok?: boolean } & ApprovalDetail
      if (!resp.ok || !data.ok) return
      setApprovalDetail({
        item: data.item,
        validationReport: data.validationReport ?? data.item.validation_report ?? null,
        executionReport: data.executionReport ?? data.item.execution_report ?? null,
        payloadDiff: data.payloadDiff ?? [],
        timeline: data.timeline ?? [],
        comments: data.comments ?? [],
      })
      setApprovalDrawerOpen(true)
    } catch {
      // ignore
    }
  }

  async function addApprovalComment(): Promise<void> {
    if (!approvalDetail || !approvalComment.trim()) return
    const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals/${encodeURIComponent(approvalDetail.item.approval_id)}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actor: "demo-user", body: approvalComment.trim() }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Comment failed: ${data.detail ?? "unknown"}`)
    setApprovalComment("")
    await openApprovalDetail(approvalDetail.item.approval_id)
  }

  async function approveAction(approvalId: string): Promise<void> {
    const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals/${encodeURIComponent(approvalId)}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved_by: "admin-user", role: roleMode }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Approve failed: ${data.detail ?? "unknown"}`)
    setMessage(`Approved ${approvalId}`)
    await loadApprovals()
    if (approvalDetail?.item.approval_id === approvalId) await openApprovalDetail(approvalId)
  }

  async function executeAction(approvalId: string): Promise<void> {
    const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals/${encodeURIComponent(approvalId)}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ executed_by: "admin-user", role: roleMode }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string; updated?: number }
    if (!resp.ok || !data.ok) return setMessage(`Execute failed: ${data.detail ?? "unknown"}`)
    setMessage(`Executed ${approvalId}, updated=${data.updated ?? 0}`)
    await Promise.all([loadApprovals(), loadEntity(entity)])
    if (approvalDetail?.item.approval_id === approvalId) await openApprovalDetail(approvalId)
  }

  async function rejectAction(approvalId: string): Promise<void> {
    setRejectTargetId(approvalId)
    setRejectReason("")
    setRejectModalOpen(true)
  }

  async function submitRejectAction(): Promise<void> {
    if (!rejectTargetId || !rejectReason.trim()) return
    const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals/${encodeURIComponent(rejectTargetId)}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rejected_by: "admin-user", reason: rejectReason.trim(), role: roleMode }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Reject failed: ${data.detail ?? "unknown"}`)
    setRejectModalOpen(false)
    setMessage(`Rejected ${rejectTargetId}`)
    await loadApprovals()
    if (approvalDetail?.item.approval_id === rejectTargetId) await openApprovalDetail(rejectTargetId)
  }

  async function exportApprovalPack(approvalId: string, format: "json" | "csv"): Promise<void> {
    const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals/${encodeURIComponent(approvalId)}/export?format=${format}`)
    if (!resp.ok) return setMessage("Export failed")
    const blob = new Blob([format === "json" ? JSON.stringify(await resp.json(), null, 2) : await resp.text()], {
      type: format === "json" ? "application/json" : "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `approval-${approvalId}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportApprovalFailures(approvalId: string): Promise<void> {
    const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals/${encodeURIComponent(approvalId)}/execution-failures.csv`)
    if (!resp.ok) return setMessage("Execution failure export failed")
    const text = await resp.text()
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `approval-${approvalId}-execution-failures.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function bulkApprovalAction(action: "approve" | "reject" | "execute"): Promise<void> {
    if (!selectedApprovalIds.length) return
    let reason = ""
    if (action === "reject") {
      reason = window.prompt("Reject reason for selected approvals:", "") ?? ""
      if (!reason.trim()) return
    }
    for (const id of selectedApprovalIds) {
      if (action === "approve") await approveAction(id)
      else if (action === "execute") await executeAction(id)
      else {
        const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approvals/${encodeURIComponent(id)}/reject`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rejected_by: "admin-user", reason: reason.trim(), role: roleMode }),
        })
        if (!resp.ok) {
          const data = (await resp.json()) as { detail?: string }
          setMessage(`Bulk reject failed for ${id}: ${data.detail ?? "unknown"}`)
          return
        }
      }
    }
    setSelectedApprovalIds([])
    await loadApprovals()
  }

  async function refreshServerMetrics(): Promise<void> {
    const baseFilters = deriveApiFilters()
    const qs = new URLSearchParams()
    if (baseFilters.search) qs.set("search", baseFilters.search)
    if (baseFilters.status) qs.set("status", baseFilters.status)
    if (baseFilters.valid_from_from) qs.set("valid_from_from", baseFilters.valid_from_from)
    if (baseFilters.valid_to_to) qs.set("valid_to_to", baseFilters.valid_to_to)
    const [integrityResp, healthResp] = await Promise.all([
      fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/integrity?${qs.toString()}`),
      fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/health?${qs.toString()}`),
    ])
    if (integrityResp.ok) {
      const d = (await integrityResp.json()) as { items?: Array<{ rowId: string; field: string; value: string; reason: string }> }
      setServerIntegrity(d.items ?? [])
    }
    if (healthResp.ok) {
      const d = (await healthResp.json()) as { metrics?: { total: number; active: number; invalidDate: number; duplicateCount: number; completeness: number } }
      setServerHealth(d.metrics ?? null)
    }
  }

  async function loadOpsMetrics(): Promise<void> {
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm/ops/metrics")
      const data = (await resp.json()) as { ok?: boolean; change_velocity?: Array<{ action: string; cnt: number }>; audit_health?: Array<{ status: string; cnt: number; avg_ms: number }>; approval_flow?: Array<{ action_type: string; status: string; cnt: number }>; sla?: { overdue: number } }
      if (resp.ok && data.ok) setOpsMetrics(data)
    } catch {
      setOpsMetrics(null)
    }
  }

  async function loadPolicy(): Promise<void> {
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/approval-policies")
      const data = (await resp.json()) as { ok?: boolean; items?: ApprovalPolicy[] }
      if (!resp.ok || !data.ok) return
      const found = (data.items ?? []).find((p) => p.entity_key === entity && p.action_type === "mass-update")
      if (found) setPolicyDraft(found)
      else setPolicyDraft((prev) => ({ ...prev, entity_key: entity, action_type: "mass-update" }))
    } catch {
      // keep local defaults
    }
  }

  async function savePolicy(): Promise<void> {
    const body = {
      ...policyDraft,
      entity_key: entity,
      action_type: "mass-update",
      updated_by: "admin-user",
    }
    const resp = await fetch(`/api/proxy/api/v1/mdm-workflow/approval-policies/${encodeURIComponent(entity)}/mass-update`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, role: roleMode }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Save policy failed: ${data.detail ?? "unknown"}`)
    setMessage("Approval policy saved")
    await loadPolicy()
  }

  async function loadRuntimeNotifyConfig(): Promise<void> {
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/runtime-config")
      const data = (await resp.json()) as { ok?: boolean; item?: Partial<RuntimeNotifyConfig> }
      if (!resp.ok || !data.ok) return
      setRuntimeNotify((prev) => ({ ...prev, ...(data.item ?? {}) }))
    } catch {
      // keep local values
    }
  }

  async function saveRuntimeNotifyConfig(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/mdm-workflow/runtime-config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...runtimeNotify, updated_by: "admin-user", role: roleMode }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Save notify config failed: ${data.detail ?? "unknown"}`)
    setMessage("Notification targets saved")
    await loadRuntimeNotifyConfig()
  }

  function isDirtyCell(row: RowData, key: string): boolean {
    const rowId = String(row[idColumn] ?? "")
    return editingId === rowId && String(row[key] ?? "") !== String(editDraft[key] ?? "")
  }

  const rowDirty = (row: RowData): boolean => {
    const rowId = String(row[idColumn] ?? "")
    if (editingId !== rowId) return false
    const keys = [...(activeMeta?.columns ?? []).slice(0, 6), "status", "valid_from", "valid_to"]
    return keys.some((k) => String(row[k] ?? "") !== String(editDraft[k] ?? ""))
  }

  const rowCellPaddingClass = rowDensity === "compact" ? "px-3 py-1.5" : "px-3 py-2"
  const selectedCount = selectedRowIds.length
  const effectiveRoles = (authMe.roles ?? []).map((r) => String(r).toLowerCase())
  const effectivePerms = (authMe.permissions ?? []).map((p) => String(p))
  const canWrite = effectivePerms.includes("mdm.write") || effectiveRoles.includes("admin") || roleMode !== "viewer"
  const canDelete = effectivePerms.includes("mdm.delete") || effectiveRoles.includes("admin") || roleMode === "admin"
  const messageIsError = /\b(error|failed|invalid|conflict|cannot|not found)\b/i.test(message)
  const importPreview = useMemo(() => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
    if (!lines.length) return { headers: [] as string[], total: 0 }
    const split = (line: string): string[] => {
      const out: string[] = []
      let cur = ""
      let inQ = false
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]
        if (ch === "\"") {
          if (inQ && line[i + 1] === "\"") { cur += "\""; i += 1 } else inQ = !inQ
        } else if (ch === "," && !inQ) { out.push(cur); cur = "" } else cur += ch
      }
      out.push(cur)
      return out
    }
    const headers = split(lines[0]).map((h) => h.trim())
    return { headers, total: Math.max(0, lines.length - 1) }
  }, [csvText])

  useEffect(() => {
    if (!importPreview.headers.length) return
    setImportHeaderMap((prev) => {
      const next: Record<string, string> = {}
      for (const h of importPreview.headers) {
        next[h] = prev[h] ?? h
      }
      return next
    })
  }, [importPreview.headers])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {message && (
        <div data-ui-error={messageIsError ? "true" : "false"} className={`mb-3 text-xs ${messageIsError ? "text-destructive" : "text-primary"}`}>
          {message}
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{entity.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h1>
          <p className="text-sm text-muted-foreground">Traditional master data maintenance with query conditions</p>
          <p className="mt-1 text-[11px] text-primary">UI Build: mdm-left-flex-r3</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={scopeMode} onChange={(e) => setScopeMode(e.target.value as ScopeMode)} className="rounded border border-border bg-background px-2 py-1.5 text-xs">
            <option value="tenant">Scope: Tenant</option>
            <option value="user">Scope: User</option>
          </select>
          <select value={roleMode} onChange={(e) => setRoleMode(e.target.value as RoleMode)} className="rounded border border-border bg-background px-2 py-1.5 text-xs">
            <option value="admin">Role: Admin</option>
            <option value="maintainer">Role: Maintainer</option>
            <option value="viewer">Role: Viewer</option>
          </select>
          {canWrite && <button onClick={openCreateModal} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">+ Add</button>}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => setShowLeftPanel((v) => !v)}
          className={`rounded border px-2 py-1 text-xs ${!showLeftPanel ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
        >
          Query
        </button>
        <button
          onClick={() => setShowRightPanel((v) => !v)}
          className={`rounded border px-2 py-1 text-xs ${!showRightPanel ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
        >
          Builder
        </button>
      </div>

      <div className="flex items-start gap-4 overflow-x-auto">
        {showLeftPanel && (
        <aside className="relative shrink-0 space-y-3" style={{ width: `${leftPanelWidth}px`, minWidth: `${leftPanelWidth}px` }}>
          <div
            onMouseDown={startResizeLeftPanel}
            className="absolute -right-2 top-0 hidden h-full w-1 cursor-col-resize rounded bg-border/60 hover:bg-primary/70 md:block"
            title="Drag to resize"
          />
          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setQuerySectionOpen((v) => !v)}
              aria-expanded={querySectionOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 text-sm font-semibold">Query Conditions</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{conditions.length} active</span>
              <span className={`text-muted-foreground transition-transform ${querySectionOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {querySectionOpen && (
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Search</label>
                <input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Global search..." className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Match</label>
                  <select value={conditionJoin} onChange={(e) => setConditionJoin(e.target.value as ConditionJoin)} className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs">
                    <option value="and">Match all (AND)</option>
                    <option value="or">Match any (OR)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saved filter</label>
                  <select value={activeFilterId} onChange={(e) => applySavedFilter(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs">
                    <option value="">Apply saved filter...</option>
                    {savedFilters.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quick preset</label>
                <select value={quickPreset} onChange={(e) => applyQuickPresetValue(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs">
                  <option value="">Quick preset...</option>
                  <option value="active-only">Active only</option>
                  <option value="draft-only">Draft only</option>
                  <option value="inactive-only">Inactive only</option>
                  <option value="expiring-30d">Expiring within 30d (hint)</option>
                  <option value="invalid-date-range">Invalid date-range (hint)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Conditions</label>
                <div className="space-y-2">
                  {conditions.map((c) => (
                    <div key={c.id} className="relative rounded-lg border border-border bg-muted/30 p-2.5">
                      <button onClick={() => removeCondition(c.id)} title="Remove" aria-label="Remove condition" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive">×</button>
                      <div className="grid grid-cols-2 gap-2 pr-6">
                        <select value={c.field} onChange={(e) => updateCondition(c.id, { field: e.target.value })} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                          {queryFields.map((f) => <option key={f} value={f}>{humanizeLabel(f)}</option>)}
                        </select>
                        <select value={c.op} onChange={(e) => updateCondition(c.id, { op: e.target.value as FilterOperator })} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                          <option value="contains">contains</option>
                          <option value="eq">equals</option>
                          <option value="neq">not equals</option>
                          <option value="startsWith">starts with</option>
                          <option value="endsWith">ends with</option>
                          <option value="empty">is empty</option>
                          <option value="notEmpty">not empty</option>
                        </select>
                        {c.op !== "empty" && c.op !== "notEmpty" && (
                          <input value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })} placeholder="Value..." className="col-span-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={addCondition} className="w-full rounded-md border border-dashed border-border px-2 py-2 text-sm font-medium text-primary hover:bg-primary/5">+ Add Condition</button>
              <div className="flex gap-2 pt-1">
                <input value={savedFilterName} onChange={(e) => setSavedFilterName(e.target.value)} placeholder="Save current as..." className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-2 text-xs" />
                <button onClick={saveCurrentFilter} className="rounded-md border border-border px-3 py-2 text-xs font-medium">Save</button>
                <button onClick={() => { setGlobalSearch(""); setConditions([]); setConditionJoin("and") }} className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground">Reset</button>
              </div>
            </div>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-emerald-600 bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setOpsSectionOpen((v) => !v)}
              aria-expanded={opsSectionOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
              <span className="flex-1 text-sm font-semibold">Data Operations</span>
              <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Export · Import</span>
              <span className={`text-muted-foreground transition-transform ${opsSectionOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {opsSectionOpen && (
            <div className="space-y-2 border-t border-border px-4 pb-4 pt-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Export</label>
              <button onClick={() => void downloadCsv()} className="w-full rounded-md border border-border px-2 py-2 text-sm font-medium hover:bg-muted/50">⬇ Export CSV (all)</button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => downloadRowsCsv(pagedRows, `${entity}-current-page.csv`)} className="w-full rounded-md border border-border px-2 py-2 text-sm hover:bg-muted/50">Current page</button>
                <button onClick={() => downloadRowsCsv(sortedRows, `${entity}-filtered.csv`)} className="w-full rounded-md border border-border px-2 py-2 text-sm hover:bg-muted/50">Filtered</button>
              </div>
              <div className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bulk Import</div>
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="Paste CSV here..." className="h-24 w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <div className="rounded border border-border/60 p-2 text-xs">
                <div className="font-medium">Import Preview</div>
                <div className="text-muted-foreground">Rows detected: {importPreview.total}</div>
                {importPreview.headers.length > 0 && (
                  <div className="truncate text-muted-foreground">Headers: {importPreview.headers.join(", ")}</div>
                )}
                {importPreview.headers.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[11px] font-medium">Column Mapping</div>
                    {importPreview.headers.map((h) => (
                      <div key={h} className="grid grid-cols-[1fr_1fr] items-center gap-1">
                        <span className="truncate text-[10px] text-muted-foreground">{h}</span>
                        <select
                          value={importHeaderMap[h] ?? h}
                          onChange={(e) => setImportHeaderMap((prev) => ({ ...prev, [h]: e.target.value }))}
                          className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                        >
                          <option value="__ignore__">Ignore</option>
                          <option value={h}>{h}</option>
                          {[idColumn, ...(activeMeta?.columns ?? []).slice(0, 6), "status", "valid_from", "valid_to"].map((f) => (
                            <option key={f} value={f}>{humanizeLabel(f)}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={skipImportErrors} onChange={(e) => setSkipImportErrors(e.target.checked)} />
                  <span>Skip invalid rows</span>
                </label>
                <label className="mt-1 flex items-center gap-2">
                  <input type="checkbox" checked={importValidateOnly} onChange={(e) => setImportValidateOnly(e.target.checked)} />
                  <span>Validate only (no write)</span>
                </label>
                <input value={importActor} onChange={(e) => setImportActor(e.target.value)} placeholder="Import actor" className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs" />
              </div>
              <button onClick={() => void importCsv()} className="w-full rounded-md bg-primary px-2 py-2 text-sm font-medium text-primary-foreground">Import CSV</button>
            </div>
            )}
          </div>
        </aside>
        )}

        <div className="min-w-[760px] flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <div className="mx-2 mt-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {groupBy ? `Grouped by: ${groupBy}` : "Drag a column header to group (use Properties panel Group By for now)"}
        </div>
        <div className="border-b border-border bg-muted/20 p-2">
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && <button onClick={startInlineAdd} className="rounded border border-border px-2 py-1 text-xs">Add</button>}
            {canWrite && <button onClick={startInlineEditSelected} className="rounded border border-border px-2 py-1 text-xs">Edit</button>}
            {canDelete && <button onClick={() => void deleteSelectedInline()} className="rounded border border-border px-2 py-1 text-xs">Delete</button>}
            {canWrite && <button onClick={() => { setEditingId(""); setEditDraft({}); setInlineAddMode(false); setInlineDraft({}); setInlineErrors({}) }} className="rounded border border-border px-2 py-1 text-xs">Cancel</button>}
            <button
              onClick={() => setShowBulkActions((v) => !v)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded border border-border text-xs ${showBulkActions ? "bg-primary/10 text-primary" : ""}`}
              title={showBulkActions ? "Hide bulk actions" : "Show bulk actions"}
              aria-label={showBulkActions ? "Hide bulk actions" : "Show bulk actions"}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            {showBulkActions ? (
              <>
                <button disabled={selectedCount === 0} onClick={() => void bulkSetStatusSelected("draft")} className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Draft</button>
                <button disabled={selectedCount === 0} onClick={() => void bulkSetStatusSelected("active")} className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Active</button>
                <button disabled={selectedCount === 0} onClick={() => void bulkSetStatusSelected("inactive")} className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Inactive</button>
                <button disabled={selectedCount === 0} onClick={exportSelectedCsv} className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40">Export CSV</button>
              </>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-20 w-9 bg-muted px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={pagedRows.length > 0 && pagedRows.every((r) => selectedRowIds.includes(getRowId(r)))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const ids = pagedRows.map((r) => getRowId(r))
                        setSelectedRowIds((prev) => Array.from(new Set([...prev, ...ids])))
                      } else {
                        const ids = pagedRows.map((r) => getRowId(r))
                        setSelectedRowIds((prev) => prev.filter((x) => !ids.includes(x)))
                      }
                    }}
                  />
                </th>
                {visibleColumns.map((c) => (
                  <th
                    key={c}
                    draggable
                    onDragStart={() => setDragColumn(c)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => moveColumn(dragColumn, c)}
                    className={`px-3 py-2 text-left ${selectedColumn === c ? "bg-primary/10 text-foreground" : ""}`}
                  >
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1">
                        {humanizeLabel(c)}
                        {(validationSchema?.requiredFields?.includes(c) || validationRules[c]?.required || validationRules[c]?.regex || validationRules[c]?.enum) ? (
                          <span
                            className="rounded border border-border px-1 text-[9px] text-muted-foreground"
                            title={[
                              validationSchema?.requiredFields?.includes(c) || validationRules[c]?.required ? "required" : "",
                              validationRules[c]?.regex ? `regex: ${validationRules[c]?.regex}` : "",
                              validationRules[c]?.enum ? `enum: ${validationRules[c]?.enum}` : "",
                            ].filter(Boolean).join(" | ")}
                          >
                            rule
                          </span>
                        ) : null}
                      </span>
                      <button onClick={() => setMenuColumn((prev) => prev === c ? "" : c)} className="rounded px-1 text-xs hover:bg-muted">⋮</button>
                      {menuColumn === c && (
                        <div className="absolute right-0 top-6 z-20 w-40 rounded border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg">
                          <button onClick={() => columnMenuAction("sortAsc", c)} className="block w-full rounded px-2 py-1 text-left hover:bg-muted">Sort Ascending</button>
                          <button onClick={() => columnMenuAction("sortDesc", c)} className="block w-full rounded px-2 py-1 text-left hover:bg-muted">Sort Descending</button>
                          <button onClick={() => addCondition()} className="block w-full rounded px-2 py-1 text-left hover:bg-muted">Add Filter Rule</button>
                          {columnMenuMode === "Custom" && (
                            <>
                              <button onClick={() => columnMenuAction("selectColumn", c)} className="block w-full rounded px-2 py-1 text-left hover:bg-muted">Select Column</button>
                              <button onClick={() => columnMenuAction("clearColumnSelection", c)} className="block w-full rounded px-2 py-1 text-left hover:bg-muted">Clear Column Selection</button>
                            </>
                          )}
                          <button onClick={() => columnMenuAction("hide", c)} className="block w-full rounded px-2 py-1 text-left hover:bg-muted">Hide Column</button>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Valid From</th>
                <th className="px-3 py-2 text-left">Valid To</th>
                <th className="sticky right-0 z-20 w-28 min-w-28 bg-muted px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inlineAddMode && (
                <tr className="border-t border-border/60 bg-primary/5">
                  <td className={`${rowCellPaddingClass} sticky left-0 z-10 w-9 bg-card`} />
                  {visibleColumns.map((c) => (
                    <td key={`inline-${c}`} className={rowCellPaddingClass}>
                      {(lookupOptions[c] ?? ENUM_FIELD_OPTIONS[c]) ? (
                        <select
                          value={inlineDraft[c] ?? ""}
                          onChange={(e) => setInlineDraft((prev) => ({ ...prev, [c]: e.target.value }))}
                          className={`w-full rounded border px-1 py-0.5 text-xs ${inlineErrors[c] ? "border-destructive" : "border-border"} bg-background`}
                        >
                          <option value="">-- Select --</option>
                          {(lookupOptions[c] ?? ENUM_FIELD_OPTIONS[c]).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      ) : (
                        <input
                          value={inlineDraft[c] ?? ""}
                          onChange={(e) => setInlineDraft((prev) => ({ ...prev, [c]: e.target.value }))}
                          className={`w-full rounded border px-1 py-0.5 text-xs ${inlineErrors[c] ? "border-destructive" : "border-border"} bg-background`}
                        />
                      )}
                    </td>
                  ))}
                  <td className={rowCellPaddingClass}>
                    <select
                      value={inlineDraft.status ?? "draft"}
                      onChange={(e) => setInlineDraft((prev) => ({ ...prev, status: e.target.value }))}
                      className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td className={rowCellPaddingClass}>
                    <input
                      type="date"
                      value={inlineDraft.valid_from ?? ""}
                      onChange={(e) => setInlineDraft((prev) => ({ ...prev, valid_from: e.target.value }))}
                      className={`w-32 rounded border px-1 py-0.5 text-xs ${inlineErrors.valid_from ? "border-destructive" : "border-border"} bg-background`}
                    />
                  </td>
                  <td className={rowCellPaddingClass}>
                    <input
                      type="date"
                      value={inlineDraft.valid_to ?? ""}
                      onChange={(e) => setInlineDraft((prev) => ({ ...prev, valid_to: e.target.value }))}
                      className={`w-32 rounded border px-1 py-0.5 text-xs ${inlineErrors.valid_to ? "border-destructive" : "border-border"} bg-background`}
                    />
                  </td>
                  <td className={`${rowCellPaddingClass} sticky right-0 z-10 w-28 min-w-28 bg-card`}>
                    <div className="flex gap-1">
                      <button onClick={() => void submitInlineAdd()} className="rounded border border-border px-2 py-0.5 text-xs">Save</button>
                      <button onClick={() => { setInlineAddMode(false); setInlineDraft({}); setInlineErrors({}) }} className="rounded border border-border px-2 py-0.5 text-xs">Cancel</button>
                    </div>
                  </td>
                </tr>
              )}
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 5} className="px-3 py-8 text-center text-sm text-muted-foreground">Loading records...</td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 5} className="px-3 py-8 text-center text-sm text-muted-foreground">No records found for current filters.</td>
                </tr>
              ) : null}
              {!isLoading && pagedRows.length > 0 && groupedRows.map((g, gi) => (
                <React.Fragment key={`${g.key}-${gi}`}>
                  {groupBy && (
                    <tr className="border-t border-border/60 bg-muted/30">
                      <td colSpan={visibleColumns.length + 5} className="px-3 py-1.5 text-xs font-medium">
                        {groupBy}: {g.key} ({g.rows.length})
                      </td>
                    </tr>
                  )}
                  {g.rows.map((r, i) => (
                <tr
                  key={`${gi}-${i}`}
                  onClick={() => {
                    // While this row is being edited inline, keep focus in the grid
                    // (don't open the detail panel).
                    if (editingId === getRowId(r)) { setSelectedRowId(getRowId(r)); return }
                    setSelectedRowId(getRowId(r))
                    setDetailRow(r)
                    setDetailTab("overview")
                  }}
                  className={`cursor-pointer border-t border-border/60 ${rowDirty(r) ? "bg-amber-500/10" : ""} ${lastCreatedRowId === getRowId(r) ? "bg-emerald-500/15 ring-1 ring-emerald-400/40" : ""} ${selectedRowId === getRowId(r) ? "bg-primary/10" : ""}`}
                >
                  <td className={`${rowCellPaddingClass} sticky left-0 z-10 w-9 bg-card`} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRowIds.includes(getRowId(r))}
                      onChange={() => toggleRowSelection(getRowId(r))}
                    />
                  </td>
                  {visibleColumns.map((c) => (
                    <td key={c} className={`${rowCellPaddingClass} ${isDirtyCell(r, c) ? "bg-amber-500/20" : ""}`}>
                      {editingId === String(r[idColumn] ?? "") ? (
                        renderEditCell(c)
                      ) : formatCellValue(r[c])}
                    </td>
                  ))}
                  <td className={`${rowCellPaddingClass} ${isDirtyCell(r, "status") ? "bg-amber-500/20" : ""}`}>
                    {editingId === String(r[idColumn] ?? "") ? (
                      <select value={editDraft.status ?? "draft"} onChange={(e) => setEditDraft((prev) => ({ ...prev, status: e.target.value }))} className="rounded border border-border bg-background px-1 py-0.5 text-xs">
                        <option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
                      </select>
                    ) : (r.status ? humanizeLabel(String(r.status)) : "-")}
                  </td>
                  <td className={`${rowCellPaddingClass} ${isDirtyCell(r, "valid_from") ? "bg-amber-500/20" : ""}`}>
                    {editingId === String(r[idColumn] ?? "") ? (
                      <input value={editDraft.valid_from ?? ""} onChange={(e) => setEditDraft((prev) => ({ ...prev, valid_from: e.target.value }))} className={`w-28 rounded border px-1 py-0.5 text-xs ${fieldErrors.valid_from ? "border-destructive" : "border-border"} bg-background`} title={fieldErrors.valid_from ?? ""} />
                    ) : formatCellValue(r.valid_from)}
                  </td>
                  <td className={`${rowCellPaddingClass} ${isDirtyCell(r, "valid_to") ? "bg-amber-500/20" : ""}`}>
                    {editingId === String(r[idColumn] ?? "") ? (
                      <input value={editDraft.valid_to ?? ""} onChange={(e) => setEditDraft((prev) => ({ ...prev, valid_to: e.target.value }))} className={`w-28 rounded border px-1 py-0.5 text-xs ${fieldErrors.valid_to ? "border-destructive" : "border-border"} bg-background`} title={fieldErrors.valid_to ?? ""} />
                    ) : formatCellValue(r.valid_to)}
                  </td>
                  <td className={`${rowCellPaddingClass} sticky right-0 z-10 w-28 min-w-28 bg-card`} onClick={(e) => e.stopPropagation()}>
                    {editingId === String(r[idColumn] ?? "") ? (
                      <div className="flex gap-1">
                        <button onClick={() => void saveEditRow(r)} className="rounded border border-border px-2 py-0.5 text-xs">Save</button>
                        <button onClick={() => { setEditingId(""); setEditDraft({}) }} className="rounded border border-border px-2 py-0.5 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <div className="relative inline-flex" ref={rowActionMenuId === String(r[idColumn] ?? "") ? rowActionMenuRef : null}>
                        <button
                          onClick={() => setRowActionMenuId((v) => (v === String(r[idColumn] ?? "") ? "" : String(r[idColumn] ?? "")))}
                          className="rounded border border-border px-2 py-0.5 text-xs"
                          title="Row actions"
                          aria-label="Row actions"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {rowActionMenuId === String(r[idColumn] ?? "") && (
                          <div className="absolute right-0 top-7 z-20 min-w-[120px] rounded-md border border-border bg-popover p-1 shadow-lg">
                            <button
                              onClick={() => { setRowActionMenuId(""); void runAiAssist(r) }}
                              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                            >
                              {aiAssistLoading ? "AI..." : "AI Assist"}
                            </button>
                            {canWrite && (
                              <button
                                onClick={() => { setRowActionMenuId(""); startEditRow(r) }}
                                className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => { setRowActionMenuId(""); setConfirmAction({ type: "delete", row: r }) }}
                                className="block w-full rounded px-2 py-1 text-left text-xs text-destructive hover:bg-muted"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>{`Page ${page} of ${totalPages} (${totalRows || sortedRows.length} rows)`}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

        {showRightPanel && <aside className="w-[220px] shrink-0 rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">Properties</div>
          <label className="mb-1 block text-xs text-muted-foreground">Saved Views</label>
          <div className="mb-2 flex gap-2">
            <select value={activeViewId} onChange={(e) => applyView(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
              <option value="">Select view</option>
              {savedViews.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button onClick={saveCurrentView} className="rounded border border-border px-2 py-1 text-xs">Save</button>
          </div>
          {activeViewId && <button onClick={() => deleteView(activeViewId)} className="mb-3 w-full rounded border border-border px-2 py-1 text-xs">Delete Active View</button>}
          <label className="mb-1 block text-xs text-muted-foreground">Column menu</label>
          <select value={columnMenuMode} onChange={(e) => setColumnMenuMode(e.target.value as ColumnMenuMode)} className="mb-3 w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
            <option value="Default">Default</option>
            <option value="Custom">Custom</option>
          </select>
          <label className="mb-1 block text-xs text-muted-foreground">Group By</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="mb-3 w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
            <option value="">None</option>
            {visibleColumns.map((c) => <option key={c} value={c}>{humanizeLabel(c)}</option>)}
          </select>
          <label className="mb-1 block text-xs text-muted-foreground">Page Size</label>
          <select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="mb-3 w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
            <option value="12">12</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
          <label className="mb-1 block text-xs text-muted-foreground">Row Density</label>
          <select value={rowDensity} onChange={(e) => setRowDensity(e.target.value as "compact" | "cozy")} className="mb-3 w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
            <option value="cozy">Cozy</option>
            <option value="compact">Compact</option>
          </select>
          <label className="mb-1 block text-xs text-muted-foreground">Column Preset</label>
          <select value={columnPreset} onChange={(e) => applyColumnPreset(e.target.value as "default" | "ops" | "minimal")} className="mb-3 w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
            <option value="default">Default</option>
            <option value="ops">Ops Focus</option>
            <option value="minimal">Minimal</option>
          </select>
          <div className="mb-1 text-xs text-muted-foreground">Column Chooser</div>
          <div className="mb-3 max-h-44 overflow-auto rounded border border-border p-2">
            {(activeMeta?.columns ?? []).slice(0, 6).map((c) => {
              const checked = !hiddenColumns.includes(c)
              return (
                <label key={c} className="mb-1 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) setHiddenColumns((prev) => prev.filter((x) => x !== c))
                      else setHiddenColumns((prev) => (prev.includes(c) ? prev : [...prev, c]))
                    }}
                  />
                  <span>{c}</span>
                </label>
              )
            })}
          </div>
          <button onClick={() => setHiddenColumns([])} className="w-full rounded border border-border px-2 py-1.5 text-xs">Show All Columns</button>
          <button onClick={resetGridLayout} className="mt-2 w-full rounded border border-border px-2 py-1.5 text-xs">Reset Grid Layout</button>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
              <span>AI Audit Trail</span>
              <button
                onClick={async () => {
                  setAuditLoading(true)
                  try {
                    const resp = await fetch("/api/proxy/api/v1/mcp/audit?limit=10")
                    const data = (await resp.json()) as { items?: AuditItem[] }
                    setAuditItems(data.items ?? [])
                  } finally {
                    setAuditLoading(false)
                  }
                }}
                className="rounded border border-border px-1.5 py-0.5 text-[10px]"
              >
                Refresh
              </button>
            </div>
            {auditLoading ? (
              <div className="text-[11px] text-muted-foreground">Loading...</div>
            ) : auditItems.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">No audit events.</div>
            ) : (
              <div className="max-h-36 space-y-1 overflow-auto">
                {auditItems.map((a) => (
                  <div key={a.audit_id} className="rounded border border-border/60 p-1 text-[10px]">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-muted-foreground">{a.provider} / {a.actor}</div>
                    <div className="text-muted-foreground">{a.status} {a.duration_ms ? `· ${a.duration_ms}ms` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
              <span>Approvals</span>
              <button onClick={() => void loadApprovals()} className="rounded border border-border px-1.5 py-0.5 text-[10px]">Refresh</button>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1">
              <select value={approvalStatusFilter} onChange={(e) => setApprovalStatusFilter(e.target.value)} className="rounded border border-border bg-background px-1 py-1 text-[10px]">
                <option value="">All status</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="executed">executed</option>
              </select>
              <input value={approvalEntityFilter} onChange={(e) => setApprovalEntityFilter(e.target.value)} placeholder="entity" className="rounded border border-border bg-background px-1 py-1 text-[10px]" />
              <input value={approvalRoutedFilter} onChange={(e) => setApprovalRoutedFilter(e.target.value)} placeholder="routed_to" className="rounded border border-border bg-background px-1 py-1 text-[10px]" />
              <div className="flex items-center gap-2 text-[10px]">
                <label className="flex items-center gap-1"><input type="checkbox" checked={approvalOverdueOnly} onChange={(e) => setApprovalOverdueOnly(e.target.checked)} />overdue</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={approvalEscalatedOnly} onChange={(e) => setApprovalEscalatedOnly(e.target.checked)} />escalated</label>
              </div>
            </div>
            <div className="mb-2 flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{approvalTotal} total</span>
              <button onClick={() => { setShowApprovalBoard(true); setApprovalPage(1) }} className="rounded border border-border px-1.5 py-0.5">Open Board</button>
            </div>
            {approvalItems.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">No approval records.</div>
            ) : (
              <div className="max-h-36 space-y-1 overflow-auto">
                {approvalItems.map((a) => (
                  <div key={a.approval_id} className="rounded border border-border/60 p-1 text-[10px]">
                    <button onClick={() => void openApprovalDetail(a.approval_id)} className="w-full text-left">
                      <div className="font-medium">{a.action_type} / {a.entity_key}</div>
                    </button>
                    <div className="text-muted-foreground">{a.status} by {a.submitted_by}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(a.validation_report?.warnings?.length ?? 0) > 0 && <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px]">warn {a.validation_report?.warnings?.length}</span>}
                      {(a.validation_report?.errors?.length ?? 0) > 0 && <span className="rounded border border-destructive/40 bg-destructive/10 px-1 py-0.5 text-[9px] text-destructive">err {a.validation_report?.errors?.length}</span>}
                      {(a.execution_report?.failed_count ?? 0) > 0 && <span className="rounded border border-destructive/40 bg-destructive/10 px-1 py-0.5 text-[9px] text-destructive">exec-fail {a.execution_report?.failed_count}</span>}
                    </div>
                    <div className="mt-1 flex gap-1">
                      {a.status === "pending" && roleMode === "admin" && <button onClick={() => void approveAction(a.approval_id)} className="rounded border border-border px-1 py-0.5">Approve</button>}
                      {a.status === "pending" && roleMode === "admin" && <button onClick={() => void rejectAction(a.approval_id)} className="rounded border border-border px-1 py-0.5">Reject</button>}
                      {a.status === "approved" && roleMode === "admin" && <button onClick={() => void executeAction(a.approval_id)} className="rounded border border-border px-1 py-0.5">Execute</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
              <span>Ops Monitoring</span>
              <button onClick={() => void loadOpsMetrics()} className="rounded border border-border px-1.5 py-0.5 text-[10px]">Refresh</button>
            </div>
            {!opsMetrics ? (
              <div className="text-[11px] text-muted-foreground">No metrics yet.</div>
            ) : (
              <div className="space-y-2 text-[10px]">
                <div>
                  <div className="font-medium">Change Velocity</div>
                  <div className="text-muted-foreground">{(opsMetrics.change_velocity ?? []).slice(0, 3).map((x) => `${x.action}:${x.cnt}`).join(" | ") || "-"}</div>
                </div>
                <div>
                  <div className="font-medium">Audit Health</div>
                  <div className="text-muted-foreground">{(opsMetrics.audit_health ?? []).slice(0, 3).map((x) => `${x.status}:${x.cnt}(${x.avg_ms}ms)`).join(" | ") || "-"}</div>
                </div>
                <div>
                  <div className="font-medium">Approval Flow</div>
                  <div className="text-muted-foreground">{(opsMetrics.approval_flow ?? []).slice(0, 3).map((x) => `${x.action_type}/${x.status}:${x.cnt}`).join(" | ") || "-"}</div>
                </div>
                <div>
                  <div className="font-medium">SLA Overdue</div>
                  <div className="text-muted-foreground">{opsMetrics.sla?.overdue ?? 0}</div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-2 text-xs font-medium">Approval Policy (Mass Update)</div>
            <label className="mb-1 flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={Boolean(policyDraft.enabled)}
                onChange={(e) => setPolicyDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <input
              value={policyDraft.auto_route_to ?? ""}
              onChange={(e) => setPolicyDraft((prev) => ({ ...prev, auto_route_to: e.target.value }))}
              placeholder="auto route to (role/user)"
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <input
              type="number"
              min={1}
              value={policyDraft.sla_hours ?? 24}
              onChange={(e) => setPolicyDraft((prev) => ({ ...prev, sla_hours: Number(e.target.value || 24) }))}
              placeholder="SLA hours"
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <input
              value={policyDraft.escalate_to ?? ""}
              onChange={(e) => setPolicyDraft((prev) => ({ ...prev, escalate_to: e.target.value }))}
              placeholder="escalate to"
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <input
              value={(policyDraft.notify_channels ?? []).join(",")}
              onChange={(e) => setPolicyDraft((prev) => ({ ...prev, notify_channels: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))}
              placeholder="notify channels: teams,lark,wecom,mail"
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <div className="flex gap-1">
              <button onClick={() => void loadPolicy()} className="flex-1 rounded border border-border px-2 py-1 text-xs">Reload</button>
              <button disabled={roleMode !== "admin"} onClick={() => void savePolicy()} className="flex-1 rounded border border-border px-2 py-1 text-xs disabled:opacity-40">Save Policy</button>
            </div>
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-2 text-xs font-medium">Notification Targets (Runtime Config)</div>
            <input
              value={runtimeNotify.teamsWebhookUrl}
              onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, teamsWebhookUrl: e.target.value }))}
              placeholder="Teams webhook URL"
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <input
              value={runtimeNotify.larkWebhookUrl}
              onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, larkWebhookUrl: e.target.value }))}
              placeholder="Lark webhook URL"
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <input
              value={runtimeNotify.wecomWebhookUrl}
              onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, wecomWebhookUrl: e.target.value }))}
              placeholder="WeCom webhook URL"
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <input
              value={runtimeNotify.mailTo}
              onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, mailTo: e.target.value }))}
              placeholder="Mail recipient"
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={runtimeNotify.smtpHost}
                onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, smtpHost: e.target.value }))}
                placeholder="SMTP host"
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              />
              <input
                value={runtimeNotify.smtpPort}
                onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, smtpPort: e.target.value }))}
                placeholder="SMTP port"
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              />
              <input
                value={runtimeNotify.smtpUser}
                onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, smtpUser: e.target.value }))}
                placeholder="SMTP user"
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              />
              <input
                value={runtimeNotify.smtpFrom}
                onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, smtpFrom: e.target.value }))}
                placeholder="SMTP from"
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              />
            </div>
            <input
              value={runtimeNotify.smtpPass}
              onChange={(e) => setRuntimeNotify((prev) => ({ ...prev, smtpPass: e.target.value }))}
              placeholder="SMTP password"
              type="password"
              className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <div className="mt-2 flex gap-1">
              <button onClick={() => void loadRuntimeNotifyConfig()} className="flex-1 rounded border border-border px-2 py-1 text-xs">Reload</button>
              <button disabled={roleMode !== "admin"} onClick={() => void saveRuntimeNotifyConfig()} className="flex-1 rounded border border-border px-2 py-1 text-xs disabled:opacity-40">Save Targets</button>
            </div>
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-2 text-xs font-medium">Mass Update Assistant</div>
            <select value={massField} onChange={(e) => setMassField(e.target.value)} className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs">
              <option value="">Select field...</option>
              {(activeMeta?.columns ?? []).slice(0, 6).map((c) => <option key={c} value={c}>{humanizeLabel(c)}</option>)}
              <option value="status">status</option>
            </select>
            <input value={massValue} onChange={(e) => setMassValue(e.target.value)} placeholder="Set value for filtered rows" className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs" />
            <button disabled={!canWrite} onClick={() => void applyMassUpdateFiltered()} className="w-full rounded border border-border px-2 py-1 text-xs disabled:opacity-50">Preview+Apply</button>
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-2 text-xs font-medium">Validation Metadata</div>
            <div className="mb-2 rounded border border-border/60 p-2 text-[10px]">
              <div className="mb-1 font-medium">Validation Profile</div>
              <label className="mb-1 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={validationProfile.requireLocalName}
                  onChange={(e) => setValidationProfile((prev) => ({ ...prev, requireLocalName: e.target.checked }))}
                />
                require local name
              </label>
              <input
                value={validationProfile.codePrefix}
                onChange={(e) => setValidationProfile((prev) => ({ ...prev, codePrefix: e.target.value }))}
                placeholder="code prefix (example: DELIVE-)"
                className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
              />
              <select
                value={validationProfile.enforcementMode}
                onChange={(e) => setValidationProfile((prev) => ({ ...prev, enforcementMode: e.target.value as "strict" | "warn" }))}
                className="mt-1 w-full rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
              >
                <option value="strict">enforcement: strict</option>
                <option value="warn">enforcement: warn</option>
              </select>
            </div>
            {(activeMeta?.columns ?? []).slice(0, 4).map((field) => (
              <div key={`rule-${field}`} className="mb-2 rounded border border-border/60 p-2">
                <div className="mb-1 text-[11px] font-medium">{field}</div>
                <label className="mb-1 flex items-center gap-1 text-[10px]">
                  <input type="checkbox" checked={Boolean(validationRules[field]?.required)} onChange={(e) => setValidationRules((prev) => ({ ...prev, [field]: { ...(prev[field] ?? {}), required: e.target.checked } }))} />
                  required
                </label>
                <input value={validationRules[field]?.regex ?? ""} onChange={(e) => setValidationRules((prev) => ({ ...prev, [field]: { ...(prev[field] ?? {}), regex: e.target.value } }))} placeholder="regex (optional)" className="mb-1 w-full rounded border border-border bg-background px-1.5 py-0.5 text-[10px]" />
                <input value={validationRules[field]?.enum ?? ""} onChange={(e) => setValidationRules((prev) => ({ ...prev, [field]: { ...(prev[field] ?? {}), enum: e.target.value } }))} placeholder="enum: A,B,C" className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[10px]" />
              </div>
            ))}
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-2 text-xs font-medium">Status Transition Matrix</div>
            {Object.entries(transitionMatrix).map(([from, tos]) => (
              <div key={`tm-${from}`} className="mb-1 grid grid-cols-[60px_1fr] items-center gap-1 text-[10px]">
                <span>{from}</span>
                <input
                  value={tos.join(",")}
                  onChange={(e) => setTransitionMatrix((prev) => ({ ...prev, [from]: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))}
                  className="w-full rounded border border-border bg-background px-1.5 py-0.5"
                  placeholder="active,inactive"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-1 text-xs font-medium">MDM Health</div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="rounded border border-border/60 p-1">Rows: {serverHealth?.total ?? healthMetrics.total}</div>
              <div className="rounded border border-border/60 p-1">Active: {serverHealth?.active ?? healthMetrics.active}</div>
              <div className="rounded border border-border/60 p-1">Complete: {serverHealth?.completeness ?? healthMetrics.completeness}%</div>
              <div className="rounded border border-border/60 p-1">Dup Codes: {serverHealth?.duplicateCount ?? healthMetrics.duplicateCount}</div>
              <div className="rounded border border-border/60 p-1">Date Issues: {serverHealth?.invalidDate ?? healthMetrics.invalidDate}</div>
              <div className="rounded border border-border/60 p-1">Integrity: {serverIntegrity.length || healthMetrics.integrity}</div>
            </div>
          </div>
          <div className="mt-3 rounded border border-border p-2">
            <div className="mb-1 text-xs font-medium">Reference Integrity</div>
            {(serverIntegrity.length === 0 && integrityIssues.length === 0) ? (
              <div className="text-[11px] text-muted-foreground">No orphan references found.</div>
            ) : (
              <div className="max-h-28 space-y-1 overflow-auto">
                {(serverIntegrity.length ? serverIntegrity : integrityIssues).slice(0, 20).map((it, i) => (
                  <div key={`${it.rowId}-${it.field}-${i}`} className="rounded border border-border/60 p-1 text-[10px]">
                    <div className="font-medium">{it.field}</div>
                    <div className="text-muted-foreground">{it.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>}
      </div>

      {approvalDrawerOpen && approvalDetail && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={() => setApprovalDrawerOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Approval Detail</h3>
              <button onClick={() => setApprovalDrawerOpen(false)} className="rounded border border-border px-2 py-1 text-xs">Close</button>
            </div>
            <div className="mb-3 rounded border border-border p-2 text-xs">
              <div><span className="text-muted-foreground">ID:</span> {approvalDetail.item.approval_id}</div>
              <div><span className="text-muted-foreground">Entity:</span> {approvalDetail.item.entity_key}</div>
              <div><span className="text-muted-foreground">Action:</span> {approvalDetail.item.action_type}</div>
              <div><span className="text-muted-foreground">Status:</span> {approvalDetail.item.status}</div>
              <div><span className="text-muted-foreground">Route:</span> {approvalDetail.item.routed_to ?? "-"}</div>
              <div><span className="text-muted-foreground">SLA Due:</span> {approvalDetail.item.sla_due_at ?? "-"}</div>
            </div>
            {approvalDetail.validationReport && (
              <div className="mb-3 rounded border border-border p-2 text-xs">
                <div className="mb-1 font-semibold">Validation Report</div>
                <div className="mb-1 text-muted-foreground">Result: {approvalDetail.validationReport.ok ? "pass" : "failed"}</div>
                <div className="mb-1 text-muted-foreground">Target rows: {String(approvalDetail.validationReport.meta?.target_count ?? "-")}</div>
                {(approvalDetail.validationReport.errors?.length ?? 0) > 0 && (
                  <div className="mb-1 rounded border border-destructive/40 bg-destructive/10 p-1">
                    <div className="font-medium text-destructive">Errors ({approvalDetail.validationReport.errors?.length ?? 0})</div>
                    <ul className="list-disc pl-4">
                      {approvalDetail.validationReport.errors?.slice(0, 8).map((e, idx) => <li key={`apv-e-${idx}`}>{e.field ? `${e.field}: ` : ""}{e.message}</li>)}
                    </ul>
                  </div>
                )}
                {(approvalDetail.validationReport.warnings?.length ?? 0) > 0 && (
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 p-1">
                    <div className="font-medium text-amber-700 dark:text-amber-300">Warnings ({approvalDetail.validationReport.warnings?.length ?? 0})</div>
                    <ul className="list-disc pl-4">
                      {approvalDetail.validationReport.warnings?.slice(0, 8).map((w, idx) => <li key={`apv-w-${idx}`}>{w.field ? `${w.field}: ` : ""}{w.message}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {approvalDetail.executionReport && (
              <div className="mb-3 rounded border border-border p-2 text-xs">
                <div className="mb-1 font-semibold">Execution Report</div>
                <div className="text-muted-foreground">Updated: {String(approvalDetail.executionReport.updated ?? 0)}</div>
                <div className="text-muted-foreground">Failed: {String(approvalDetail.executionReport.failed_count ?? 0)}</div>
                {(approvalDetail.executionReport.failed_count ?? 0) > 0 && (
                  <div className="mt-1 rounded border border-destructive/40 bg-destructive/10 p-1">
                    <div className="mb-1 font-medium text-destructive">Top failures</div>
                    <ul className="list-disc pl-4">
                      {(approvalDetail.executionReport.failed ?? []).slice(0, 6).map((f, idx) => (
                        <li key={`exf-${idx}`}>{f.row_id}: {f.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="mb-3 flex gap-2">
              {approvalDetail.item.status === "pending" && roleMode === "admin" && (
                <>
                  <button onClick={() => void approveAction(approvalDetail.item.approval_id)} className="rounded border border-border px-2 py-1 text-xs">Approve</button>
                  <button onClick={() => void rejectAction(approvalDetail.item.approval_id)} className="rounded border border-border px-2 py-1 text-xs">Reject</button>
                </>
              )}
              {approvalDetail.item.status === "approved" && roleMode === "admin" && (
                <button onClick={() => void executeAction(approvalDetail.item.approval_id)} className="rounded border border-border px-2 py-1 text-xs">Execute</button>
              )}
              <button onClick={() => void exportApprovalPack(approvalDetail.item.approval_id, "json")} className="rounded border border-border px-2 py-1 text-xs">Export JSON</button>
              <button onClick={() => void exportApprovalPack(approvalDetail.item.approval_id, "csv")} className="rounded border border-border px-2 py-1 text-xs">Export CSV</button>
              {(approvalDetail.executionReport?.failed_count ?? 0) > 0 && (
                <button onClick={() => void exportApprovalFailures(approvalDetail.item.approval_id)} className="rounded border border-border px-2 py-1 text-xs">
                  Export Failures CSV
                </button>
              )}
            </div>
            <div className="mb-3 rounded border border-border p-2">
              <div className="mb-2 text-xs font-semibold">Payload Diff</div>
              {(approvalDetail.payloadDiff?.length ?? 0) === 0 ? (
                <div className="text-xs text-muted-foreground">No diff preview.</div>
              ) : (
                <div className="space-y-1">
                  {approvalDetail.payloadDiff.map((d, idx) => (
                    <div key={`${d.field}-${idx}`} className="grid grid-cols-3 gap-2 text-xs">
                      <div className="font-medium">{d.field}</div>
                      <div className="text-muted-foreground">{d.from}</div>
                      <div>{d.to}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-3 rounded border border-border p-2">
              <div className="mb-2 text-xs font-semibold">Timeline</div>
              <div className="max-h-44 space-y-1 overflow-auto">
                {(approvalDetail.timeline ?? []).map((t) => (
                  <div key={t.event_id} className="rounded border border-border/60 p-1 text-xs">
                    <div className="font-medium">{t.event_type}</div>
                    <div className="text-muted-foreground">{t.actor} · {new Date(t.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-border p-2">
              <div className="mb-2 text-xs font-semibold">Comments</div>
              <div className="mb-2 max-h-36 space-y-1 overflow-auto">
                {(approvalDetail.comments ?? []).map((c) => (
                  <div key={c.comment_id} className="rounded border border-border/60 p-1 text-xs">
                    <div className="font-medium">{c.actor}</div>
                    <div>{c.body}</div>
                    <div className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <textarea value={approvalComment} onChange={(e) => setApprovalComment(e.target.value)} placeholder="Add comment..." className="mb-2 min-h-[72px] w-full rounded border border-border bg-background px-2 py-1 text-xs" />
              <button onClick={() => void addApprovalComment()} className="rounded border border-border px-2 py-1 text-xs">Post Comment</button>
            </div>
          </aside>
        </div>
      )}

      {showApprovalBoard && (
        <div className="fixed inset-0 z-50 bg-black/40 p-6" onClick={() => setShowApprovalBoard(false)} role="presentation">
          <div className="mx-auto h-[88vh] max-w-6xl rounded-lg border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Approval Board</h3>
              <button onClick={() => setShowApprovalBoard(false)} className="rounded border border-border px-2 py-1 text-xs">Close</button>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button disabled={!selectedApprovalIds.length || roleMode !== "admin"} onClick={() => void bulkApprovalAction("approve")} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">Approve Selected</button>
              <button disabled={!selectedApprovalIds.length || roleMode !== "admin"} onClick={() => void bulkApprovalAction("reject")} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">Reject Selected</button>
              <button disabled={!selectedApprovalIds.length || roleMode !== "admin"} onClick={() => void bulkApprovalAction("execute")} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">Execute Selected</button>
              <span className="text-xs text-muted-foreground">{selectedApprovalIds.length} selected</span>
            </div>
            <div className="overflow-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs">
                  <tr>
                    <th className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={approvalItems.length > 0 && selectedApprovalIds.length === approvalItems.length}
                        onChange={(e) => setSelectedApprovalIds(e.target.checked ? approvalItems.map((x) => x.approval_id) : [])}
                      />
                    </th>
                    <th className="px-2 py-2 text-left">Approval ID</th>
                    <th className="px-2 py-2 text-left">Entity</th>
                    <th className="px-2 py-2 text-left">Action</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Signals</th>
                    <th className="px-2 py-2 text-left">Routed To</th>
                    <th className="px-2 py-2 text-left">SLA Due</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalItems.map((a) => (
                    <tr key={a.approval_id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedApprovalIds.includes(a.approval_id)}
                          onChange={(e) => setSelectedApprovalIds((prev) => e.target.checked ? [...new Set([...prev, a.approval_id])] : prev.filter((id) => id !== a.approval_id))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => void openApprovalDetail(a.approval_id)} className="underline underline-offset-2">{a.approval_id}</button>
                      </td>
                      <td className="px-2 py-2">{a.entity_key}</td>
                      <td className="px-2 py-2">{a.action_type}</td>
                      <td className="px-2 py-2">{a.status}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {(a.validation_report?.warnings?.length ?? 0) > 0 && <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5">warn {a.validation_report?.warnings?.length}</span>}
                          {(a.validation_report?.errors?.length ?? 0) > 0 && <span className="rounded border border-destructive/40 bg-destructive/10 px-1 py-0.5 text-destructive">err {a.validation_report?.errors?.length}</span>}
                          {(a.execution_report?.failed_count ?? 0) > 0 && <span className="rounded border border-destructive/40 bg-destructive/10 px-1 py-0.5 text-destructive">exec-fail {a.execution_report?.failed_count}</span>}
                          {(a.validation_report?.warnings?.length ?? 0) === 0 && (a.validation_report?.errors?.length ?? 0) === 0 && (a.execution_report?.failed_count ?? 0) === 0 && <span className="text-muted-foreground">-</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2">{a.routed_to ?? "-"}</td>
                      <td className="px-2 py-2">{a.sla_due_at ? new Date(a.sla_due_at).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span>{`Page ${approvalPage} of ${Math.max(1, Math.ceil((approvalTotal || 1) / approvalPageSize))} (${approvalTotal} rows)`}</span>
              <div className="flex items-center gap-2">
                <select value={String(approvalPageSize)} onChange={(e) => { setApprovalPageSize(Number(e.target.value)); setApprovalPage(1) }} className="rounded border border-border bg-background px-2 py-1">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <button disabled={approvalPage <= 1} onClick={() => setApprovalPage((p) => Math.max(1, p - 1))} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={approvalPage >= Math.max(1, Math.ceil((approvalTotal || 1) / approvalPageSize))} onClick={() => setApprovalPage((p) => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectModalOpen(false)} role="presentation">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm font-semibold">Reject Approval</div>
            <div className="mb-2 text-xs text-muted-foreground">Approval: {rejectTargetId}</div>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (required)" className="mb-3 min-h-[96px] w-full rounded border border-border bg-background px-2 py-1 text-xs" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectModalOpen(false)} className="rounded border border-border px-2 py-1 text-xs">Cancel</button>
              <button disabled={!rejectReason.trim()} onClick={() => void submitRejectAction()} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setCreateModalOpen(false)
            setCreateErrors({})
            setCreateWarnings([])
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setCreateModalOpen(false)
              setCreateErrors({})
              setCreateWarnings([])
            }
          }}
          role="presentation"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Add {entity.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h3>
              <button
                onClick={() => {
                  setCreateModalOpen(false)
                  setCreateErrors({})
                  setCreateWarnings([])
                }}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>

            {createWarnings.length > 0 && (
              <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                <div className="mb-1 font-semibold text-amber-700 dark:text-amber-300">Non-blocking warnings</div>
                <ul className="list-disc pl-4">
                  {createWarnings.map((w, idx) => (
                    <li key={`cw-${idx}`}>{w.field ? `${w.field}: ` : ""}{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-4">
              {entity === "exchange-rate" && (
                <div>{renderRateExpression(createDraft, setCreateDraft, createErrors)}</div>
              )}
              {requiredCreateFields.filter((f) => entity !== "exchange-rate" || !EXCHANGE_RATE_INLINE_FIELDS.includes(f)).length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {requiredCreateFields.filter((f) => entity !== "exchange-rate" || !EXCHANGE_RATE_INLINE_FIELDS.includes(f)).map((field) => (
                    <div key={field} className="space-y-1">
                      <label className="block text-xs font-medium text-muted-foreground">
                        {humanizeLabel(field)} <span className="text-destructive">*</span>
                      </label>
                      {renderCreateField(field)}
                      {createErrors[field] ? <div className="text-xs text-destructive">{createErrors[field]}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
              )}
              {optionalCreateFields.filter((f) => entity !== "exchange-rate" || !EXCHANGE_RATE_INLINE_FIELDS.includes(f)).length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optional</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {optionalCreateFields.filter((f) => entity !== "exchange-rate" || !EXCHANGE_RATE_INLINE_FIELDS.includes(f)).map((field) => (
                      <div key={field} className="space-y-1">
                        <label className="block text-xs font-medium text-muted-foreground">{humanizeLabel(field)}</label>
                        {renderCreateField(field)}
                        {createErrors[field] ? <div className="text-xs text-destructive">{createErrors[field]}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Validity</div>
                <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">{humanizeLabel("valid_from")}</label>
                <input
                  type="date"
                  value={createDraft.valid_from ?? ""}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, valid_from: e.target.value }))}
                  className={`w-full rounded border px-2 py-1.5 text-sm ${createErrors.valid_from ? "border-destructive" : "border-border"} bg-background`}
                />
                {createErrors.valid_from ? <div className="text-xs text-destructive">{createErrors.valid_from}</div> : null}
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">{humanizeLabel("valid_to")}</label>
                <input
                  type="date"
                  value={createDraft.valid_to ?? ""}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, valid_to: e.target.value }))}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setCreateModalOpen(false)
                  setCreateErrors({})
                  setCreateWarnings([])
                }}
                className="rounded border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitCreateModal()}
                className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && editTargetRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setEditModalOpen(false)
            setEditTargetRow(null)
            setFieldErrors({})
            setEditWarnings([])
          }}
          role="presentation"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Edit {entity.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h3>
              <button onClick={() => { setEditModalOpen(false); setEditTargetRow(null); setFieldErrors({}); setEditWarnings([]) }} className="rounded border border-border px-2 py-1 text-xs">Close</button>
            </div>
            {editWarnings.length > 0 && (
              <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                <div className="mb-1 font-semibold text-amber-700 dark:text-amber-300">Non-blocking warnings</div>
                <ul className="list-disc pl-4">
                  {editWarnings.map((w, idx) => (
                    <li key={`ew-${idx}`}>{w.field ? `${w.field}: ` : ""}{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mb-2 text-xs text-muted-foreground">{String(editTargetRow[idColumn] ?? "-")}</div>
            {entity === "exchange-rate" && (
              <div className="mb-3">{renderRateExpression(editDraft, setEditDraft, fieldErrors)}</div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(activeMeta?.columns ?? []).slice(0, 6).filter((field) => entity !== "exchange-rate" || !EXCHANGE_RATE_INLINE_FIELDS.includes(field)).map((field) => {
                const options = lookupOptions[field] ?? ENUM_FIELD_OPTIONS[field]
                return (
                  <div key={`edit-${field}`} className="space-y-1">
                    <label className="block text-xs font-medium text-muted-foreground">{humanizeLabel(field)}</label>
                    {options && options.length > 0 ? (
                      <select value={editDraft[field] ?? ""} onChange={(e) => setEditDraft((prev) => ({ ...prev, [field]: e.target.value }))} className={`w-full rounded border px-2 py-1.5 text-sm ${fieldErrors[field] ? "border-destructive" : "border-border"} bg-background`}>
                        <option value="">-- Select --</option>
                        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    ) : (
                      <input value={editDraft[field] ?? ""} onChange={(e) => setEditDraft((prev) => ({ ...prev, [field]: e.target.value }))} className={`w-full rounded border px-2 py-1.5 text-sm ${fieldErrors[field] ? "border-destructive" : "border-border"} bg-background`} />
                    )}
                    {fieldErrors[field] ? <div className="text-xs text-destructive">{fieldErrors[field]}</div> : null}
                  </div>
                )
              })}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">{humanizeLabel("valid_from")}</label>
                <input type="date" value={editDraft.valid_from ?? ""} onChange={(e) => setEditDraft((prev) => ({ ...prev, valid_from: e.target.value }))} className={`w-full rounded border px-2 py-1.5 text-sm ${fieldErrors.valid_from ? "border-destructive" : "border-border"} bg-background`} />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">{humanizeLabel("valid_to")}</label>
                <input type="date" value={editDraft.valid_to ?? ""} onChange={(e) => setEditDraft((prev) => ({ ...prev, valid_to: e.target.value }))} className={`w-full rounded border px-2 py-1.5 text-sm ${fieldErrors.valid_to ? "border-destructive" : "border-border"} bg-background`} />
                {fieldErrors.valid_to ? <div className="text-xs text-destructive">{fieldErrors.valid_to}</div> : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setEditModalOpen(false); setEditTargetRow(null); setFieldErrors({}); setEditWarnings([]) }} className="rounded border border-border px-3 py-1.5 text-sm">Cancel</button>
              <button
                onClick={async () => {
                  await saveEditRow(editTargetRow)
                  setEditModalOpen(false)
                  setEditTargetRow(null)
                }}
                className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[420px] rounded-lg border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Confirm Delete</h3>
            <p className="mb-3 text-sm text-muted-foreground">Delete this record permanently? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="rounded border border-border px-2 py-1 text-xs">Cancel</button>
              <button onClick={async () => { await archiveRow(confirmAction.row); setConfirmAction(null) }} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {previewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[480px] rounded-lg border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Bulk Operation Preview</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Action: archive filtered rows. Affected rows: {previewAction.count}.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPreviewAction(null)} className="rounded border border-border px-2 py-1 text-xs">Cancel</button>
              <button
                onClick={async () => {
                  await bulkArchiveFiltered()
                  setPreviewAction(null)
                }}
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {detailRow && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
          <div className="h-full w-[420px] overflow-y-auto border-l border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">MDM Details</h3>
              <button onClick={() => setDetailRow(null)} className="rounded border border-border px-2 py-1 text-xs">Close</button>
            </div>
            <div className="mb-3 text-xs text-muted-foreground">{String(detailRow[idColumn] ?? "-")}</div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={() => void runAiAssist(detailRow)}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                {aiAssistLoading ? "AI..." : "AI Assist"}
              </button>
              {canWrite && (
                <button
                  onClick={() => { startEditRow(detailRow); setDetailRow(null) }}
                  className="rounded border border-border px-2 py-1 text-xs"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => { setConfirmAction({ type: "delete", row: detailRow }); setDetailRow(null) }}
                  className="rounded border border-destructive/40 px-2 py-1 text-xs text-destructive"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="mb-3 rounded border border-border p-2">
              <div className="mb-1 text-xs font-medium">Status Actions</div>
              <input
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Reason (optional)"
                className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button disabled={!canWrite} onClick={() => void setStatusWithReason(detailRow, "active")} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50">Set Active</button>
                <button disabled={!canWrite} onClick={() => void setStatusWithReason(detailRow, "inactive")} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50">Set Inactive</button>
              </div>
            </div>
            <div className="mb-3 flex items-center gap-1 rounded border border-border bg-muted/20 p-1">
              <button
                onClick={() => setDetailTab("overview")}
                className={`rounded px-2 py-1 text-xs ${detailTab === "overview" ? "bg-background font-medium" : "text-muted-foreground"}`}
              >
                Overview
              </button>
              <button
                onClick={() => setDetailTab("changes")}
                className={`rounded px-2 py-1 text-xs ${detailTab === "changes" ? "bg-background font-medium" : "text-muted-foreground"}`}
              >
                Change Log
              </button>
              <button
                onClick={() => setDetailTab("raw")}
                className={`rounded px-2 py-1 text-xs ${detailTab === "raw" ? "bg-background font-medium" : "text-muted-foreground"}`}
              >
                Raw
              </button>
            </div>
            {detailTab === "overview" && (
              <>
            <div className="mb-3 rounded border border-border p-2">
              <div className="mb-2 text-xs font-medium">Ask AI</div>
              <div className="mb-2 flex flex-wrap gap-1">
                <button onClick={() => setAiPrompt("Check data quality and missing required fields.")} className="rounded border border-border px-1.5 py-0.5 text-[10px]">Quality Check</button>
                <button onClick={() => setAiPrompt("Suggest normalization for naming and code format.")} className="rounded border border-border px-1.5 py-0.5 text-[10px]">Normalize</button>
                <button onClick={() => setAiPrompt("Review validity period and status transition risk.")} className="rounded border border-border px-1.5 py-0.5 text-[10px]">Transition Risk</button>
              </div>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Enter prompt for AI analysis (preview only, no auto-write)"
                className="mb-2 h-16 w-full rounded border border-border bg-background px-2 py-1 text-xs"
              />
              <div className="flex items-center justify-between">
                <button onClick={() => void runAiAssist(detailRow)} className="rounded border border-border px-2 py-1 text-xs">{aiAssistLoading ? "Running..." : "Run AI"}</button>
                <span className="text-[10px] text-muted-foreground">Write-back is manual review only</span>
              </div>
            </div>
            {aiSuggestionRowId === String(detailRow[idColumn] ?? "") && (
              <div className="mb-3 rounded border border-border p-2">
                <div className="mb-2 flex items-center justify-between text-xs font-medium">
                  <span>AI Suggestions</span>
                  <button onClick={() => setAiSuggestions([])} className="rounded border border-border px-1.5 py-0.5 text-[10px]">Clear</button>
                </div>
                {aiSuggestions.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">No suggestions.</div>
                ) : (
                  <div className="space-y-1">
                    {aiSuggestions.map((s, idx) => (
                      <div key={`${s.field ?? "general"}-${idx}`} className="rounded border border-border/60 p-1 text-[11px]">
                        <div className="font-medium">{s.type.toUpperCase()} {s.field ? `· ${s.field}` : ""}</div>
                        <div className="text-muted-foreground">{s.message}</div>
                        {s.field && canWrite && (
                          <button onClick={() => void applyAiSuggestion(detailRow, s)} className="mt-1 rounded border border-border px-1.5 py-0.5 text-[10px]">
                            Apply to field
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="mb-3 rounded border border-border p-2">
              <div className="mb-1 text-xs font-medium">Related Links</div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(detailRow).filter((k) => k.endsWith("_id") && k !== idColumn && String(detailRow[k] ?? "").trim()).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setGlobalSearch(String(detailRow[k] ?? ""))
                      setDetailRow(null)
                    }}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            </>
            )}
            {detailTab === "changes" && (
              <div className="mb-3 rounded border border-border p-2">
                <div className="mb-2 text-xs font-medium">Change History</div>
                {detailChanges.length > 0 && (
                  <div className="mb-2 rounded border border-border/60 p-2">
                    <div className="mb-1 text-[11px] font-medium">Version Compare (latest)</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <div className="mb-1 text-muted-foreground">Before</div>
                        <pre className="max-h-28 overflow-auto rounded border border-border/40 bg-muted/20 p-1 whitespace-pre-wrap">{JSON.stringify(detailChanges[0]?.before_data ?? {}, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="mb-1 text-muted-foreground">After</div>
                        <pre className="max-h-28 overflow-auto rounded border border-border/40 bg-muted/20 p-1 whitespace-pre-wrap">{JSON.stringify(detailChanges[0]?.after_data ?? {}, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                )}
                {detailChangesLoading ? (
                  <div className="text-xs text-muted-foreground">Loading change log...</div>
                ) : detailChanges.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No change events.</div>
                ) : (
                  <div className="space-y-2">
                    {detailChanges.map((ev) => (
                      <div key={ev.event_id} className="rounded border border-border/60 p-2 text-xs">
                        <div className="font-medium">{ev.action} by {ev.actor}</div>
                        <div className="text-muted-foreground">{String(ev.created_at ?? "")}</div>
                        <div className="text-muted-foreground">
                          fields: {(ev.changed_fields ?? []).join(", ") || "-"}
                        </div>
                        {(ev.before_data || ev.after_data) && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-muted-foreground">Show data diff</summary>
                            <div className="mt-1 grid gap-1">
                              {(ev.changed_fields ?? []).slice(0, 8).map((f) => (
                                <div key={f} className="rounded border border-border/40 p-1">
                                  <div className="font-medium">{f}</div>
                                  <div className="text-muted-foreground">before: {String(ev.before_data?.[f] ?? "-")}</div>
                                  <div className="text-muted-foreground">after: {String(ev.after_data?.[f] ?? "-")}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {detailTab === "raw" && (
              <pre className="whitespace-pre-wrap rounded border border-border bg-muted/20 p-2 text-xs">{JSON.stringify(detailRow, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
