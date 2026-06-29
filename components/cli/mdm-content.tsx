"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Filter, Lock, MoreVertical, SlidersHorizontal, Users, ShieldCheck, Building2, FileText, Search, ChevronDown, ChevronRight, Trash2, GitBranch, RefreshCw, GripVertical, Loader2, ArrowRight, AlertCircle, CheckCircle2, ClipboardList, Wrench, Database, Truck, ShoppingCart, Store, Landmark, Layers, CreditCard, Coins, Globe, Package, Tag, BarChart3, BookOpen, Shield, Banknote, MapPin, Hash, Boxes, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"
import { Switch } from "@/components/ui/switch"
import { QueryBuilder, QBField, QBGroup, createDefaultQuery } from "@/components/ui/query-builder"

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
type CreditAreaConfig = {
  openQuotation: boolean
  openInvoice: boolean
  openProjects: boolean
  restrictQuotation: boolean
  restrictOrder: boolean
  restrictProjectExecution: boolean
  restrictDeliverableIssue: boolean
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
type ApplicableRequirementResult = {
  requirement_id: string
  requirement_code?: string
  title?: string
  requirement_type?: string
  jurisdiction_code?: string
  jurisdiction_name?: string
  regulation_code?: string
  standard_code?: string
  service_items?: Array<{
    service_item_id?: string
    service_item_code?: string
    service_item_name?: string
    coverage?: string
    boms?: Array<{ lines?: Array<Record<string, unknown>> }>
  }>
}
type ComplianceOverview = {
  generated_at?: string
  metrics?: {
    regulations?: { total?: number; active?: number }
    standards?: { total?: number; active?: number }
    requirements?: { total?: number; active?: number; draft?: number }
    change_events?: { total?: number; open?: number }
  }
  source_status?: Array<{ source_kind: string; status: string; count: number }>
  event_outbox?: Array<{ status: string; count: number }>
  recent_runs?: Array<{ run_kind: string; run_status: string; source_url?: string; started_at?: string; finished_at?: string; detail?: string }>
}
type RegulationSourceAdapter = {
  key: string
  label: string
  authority?: string | null
  parserTypes?: string[]
  domains?: string[]
  sourceType?: string
  description?: string
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
  subdivision_code: "ISO 3166-2 Code", country_code: "Country", name_en: "Name (EN)", category: "Category",
  legal_entity_id: "Legal Entity", division_id: "Division", legal_entity_code: "LE Code (≤4)", company_id: "Company ID", currency_code: "Currency", language_key: "Language",
  chart_of_accounts: "Chart of Accounts", fiscal_year_variant: "Fiscal Year Variant", credit_control_area: "Credit Control Area",
  vat_registration_no: "VAT Reg. No.", registration_no: "Registration No.", tax_id: "Tax ID", iban: "IBAN", swift_bic: "SWIFT/BIC",
  account_no: "Account No.", account_name: "Account Name", account_type: "Account Type", bank_country_code: "Bank Country",
  tax_country_code: "Tax Country", tax_registration_no: "Tax Registration No.", tax_type: "Tax Type", rate_percent: "Rate %",
  is_primary: "Primary", address_type: "Address Type", postal_code: "Postal Code", contact_user_id: "Contact",
  owner_user_id: "Owner", manager_user_id: "Manager", assignee_user_id: "Assignee", master_client_id: "Master Client", _credit_area_currency: "Credit Area Currency", delivery_office_id: "Delivery Office", purchase_office_id: "Purchase Office",
  service_item_id: "Service ID", delivery_channel_id: "Delivery Channel", service_domain_id: "Service Domain", product_line_id: "Product Line", requirement_id: "Requirement",
  controlling_area_id: "Controlling Area", cost_center_group_id: "Cost Center Group", cost_center_group_map_id: "Cost Center Group Map", parent_group_id: "Parent Group",
  jurisdiction_id: "Jurisdiction", authority_id: "Authority", parent_jurisdiction_id: "Parent Jurisdiction",
  product_category_id: "HS Code", parent_category_id: "Parent HS Code", feature_of_product_id: "Product Feature",
  regulation_id: "Regulation", regulation_version_id: "Regulation Version", regulation_source_snapshot_id: "Source Snapshot",
  regulation_source_id: "Regulation Source", regulation_ingest_run_id: "Ingest Run",
  regulation_chunk_id: "Chunk", regulation_summary_id: "Summary", regulation_memory_id: "Memory", regulation_relation_id: "Relation",
  version_no: "Version No.", version_label: "Version Label", source_identifier: "Source ID", source_url: "Source URL", source_format: "Source Format",
  source_name: "Source Name", parser_type: "Parser Type", refresh_interval_hours: "Refresh Hours", last_run_at: "Last Run", last_status: "Last Status",
  last_checksum: "Last Checksum", run_status: "Run Status", started_at: "Started At", finished_at: "Finished At", source_type: "Source Type",
  raw_uri: "Raw URI", raw_text: "Raw Text", parser_version: "Parser Version", fetched_at: "Fetched At", http_status: "HTTP Status",
  http_etag: "ETag", http_last_modified: "Last Modified", chunk_type: "Chunk Type", section_path: "Section Path", chunk_order: "Chunk Order",
  chunk_text: "Chunk Text", summary_type: "Summary Type", summary_text: "Summary Text", summary_model: "Summary Model", memory_type: "Memory Type",
  memory_text: "Memory Text", relation_type: "Relation Type", provenance_json: "Provenance", authority_name: "Authority Name",
  authority_type: "Authority Type", website_url: "Website", api_url: "API URL", document_type: "Document Type",
  credit_limit: "Credit Limitation",
  timezone: "Time Zone",
  customer_id: "Customer", vendor_id: "Vendor", credit_area_id: "Credit Area",
  sales_channel_id: "Sales Channel", purchase_channel_id: "Purchase Channel",
  search_term: "Search Term", payment_terms: "Payment Terms", incoterms: "Incoterms",
  customer_type: "Customer Type", vendor_type: "Vendor Type", qualification_status: "Qualification",
  contact_name: "Contact Name",
}
const ENTITY_LABEL_OVERRIDES: Record<string, string> = {
  "service-item": "Service",
  "product-category": "HS Code",
  jurisdiction: "Jurisdiction",
  authority: "Authority",
  regulation: "Regulation",
  "regulation-source": "Regulation Source",
  "regulation-ingest-run": "Ingest Run",
  "regulation-version": "Regulation Version",
  "regulation-source-snapshot": "Source Snapshot",
  "regulation-chunk": "Regulation Chunk",
  "regulation-summary": "Regulation Summary",
  "regulation-memory": "Regulation Memory",
  "regulation-relation": "Regulation Relation",
  "master-client": "Master Client",
  "customer-sales-channel": "Sales Channels",
  "vendor-purchase-channel": "Purchase Channels",
}

// Icon mapping for MDM entities — matches sidebar groups + individual entity semantics
function getEntityIcon(entityKey: string): LucideIcon {
  const key = String(entityKey ?? "").trim()
  // Delivery group
  if (key.startsWith("delivery")) return Truck
  // Sales group
  if (key.startsWith("sales")) return Store
  // Purchase group
  if (key.startsWith("purchase")) return ShoppingCart
  // Organization group
  if (key === "legal-entity" || key.startsWith("legal-entity-")) return Building2
  if (key === "division") return Layers
  if (key === "controlling-area") return Landmark
  if (key.startsWith("cost-center")) return Coins
  if (key === "profit-center") return BarChart3
  if (key === "credit-area" || key.startsWith("credit-area-")) return CreditCard
  // Service Catalog
  if (key === "service-domain" || key === "service-item" || key.startsWith("service-bom") || key === "deliverable") return Package
  if (key === "activity") return ClipboardList
  if (key.startsWith("bom-")) return Boxes
  if (key === "cost-rate") return Banknote
  if (key === "quotation-preview") return FileText
  // Compliance Links
  if (key.startsWith("service-item-regulation") || key.startsWith("service-item-standard")) return ShieldCheck
  if (key.startsWith("regulation") || key === "discovery-feed") return Shield
  // Pricing
  if (key.startsWith("price-list")) return Tag
  // Currency
  if (key === "currency" || key === "exchange-rate") return Banknote
  // Geography
  if (key === "country" || key === "province" || key === "jurisdiction") return Globe
  // Customers / Vendors / Partners
  if (key.startsWith("customer") || key === "master-client") return Users
  if (key.startsWith("vendor")) return Store
  // Product / HS Code
  if (key === "product-category" || key === "product-line") return Hash
  // Authority
  if (key === "authority") return Landmark
  // Fallback
  return Database
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
  // ISO 639-1 language codes commonly used in MDM master data.
  language_key: [
    { value: "EN", label: "EN - English" },
    { value: "ZH", label: "ZH - Chinese (Simplified)" },
    { value: "ZH-TW", label: "ZH-TW - Chinese (Traditional)" },
    { value: "JA", label: "JA - Japanese" },
    { value: "KO", label: "KO - Korean" },
    { value: "DE", label: "DE - German" },
    { value: "FR", label: "FR - French" },
    { value: "ES", label: "ES - Spanish" },
    { value: "IT", label: "IT - Italian" },
    { value: "PT", label: "PT - Portuguese" },
    { value: "RU", label: "RU - Russian" },
    { value: "AR", label: "AR - Arabic" },
    { value: "HI", label: "HI - Hindi" },
    { value: "TH", label: "TH - Thai" },
    { value: "VI", label: "VI - Vietnamese" },
    { value: "ID", label: "ID - Indonesian" },
    { value: "MS", label: "MS - Malay" },
    { value: "NL", label: "NL - Dutch" },
    { value: "PL", label: "PL - Polish" },
    { value: "TR", label: "TR - Turkish" },
  ],
  // account_type, address_type, tax_type moved to MANAGED_ENUMS (admin-maintainable via ⚙ gear icon)
  // IANA timezone identifiers commonly used in TIC / lab operations.
  timezone: [
    { value: "UTC", label: "UTC (Coordinated Universal Time)" },
    { value: "Asia/Shanghai", label: "Asia/Shanghai (CST, UTC+8)" },
    { value: "Asia/Hong_Kong", label: "Asia/Hong Kong (HKT, UTC+8)" },
    { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
    { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
    { value: "Asia/Seoul", label: "Asia/Seoul (KST, UTC+9)" },
    { value: "Asia/Bangkok", label: "Asia/Bangkok (ICT, UTC+7)" },
    { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB, UTC+7)" },
    { value: "Asia/Manila", label: "Asia/Manila (PHT, UTC+8)" },
    { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
    { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+4)" },
    { value: "Europe/London", label: "Europe/London (GMT/BST)" },
    { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
    { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
    { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST)" },
    { value: "Europe/Rome", label: "Europe/Rome (CET/CEST)" },
    { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET/CEST)" },
    { value: "Europe/Zurich", label: "Europe/Zurich (CET/CEST)" },
    { value: "Europe/Moscow", label: "Europe/Moscow (MSK, UTC+3)" },
    { value: "America/New_York", label: "America/New York (EST/EDT)" },
    { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
    { value: "America/Denver", label: "America/Denver (MST/MDT)" },
    { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT)" },
    { value: "America/Sao_Paulo", label: "America/São Paulo (BRT, UTC-3)" },
    { value: "Australia/Sydney", label: "Australia/Sydney (AEDT/AEST)" },
    { value: "Australia/Perth", label: "Australia/Perth (AWST, UTC+8)" },
    { value: "Pacific/Auckland", label: "Pacific/Auckland (NZDT/NZST)" },
  ],
}

// Admin-managed enums — values stored in mdm_managed_enum, dropdown maintained inline
// by admins. Maps a form field name → the enum_key used by the backend.
const MANAGED_ENUMS: Record<string, string> = {
  title: "contact_title",
  account_type: "bank_account_type",
  address_type: "address_type",
  tax_type: "tax_type",
  customer_type: "customer_type",
  vendor_type: "vendor_type",
  payment_terms: "payment_terms",
  incoterms: "incoterms",
  industry: "industry",
  // Shared by the deliverable and service-item entities — both render the same
  // admin-maintainable dropdown so type values stay consistent across the catalog.
  deliverable_type: "deliverable_type",
  document_type: "document_type",
}
// Entity-specific overrides: on certain entities a column maps to a DIFFERENT
// enum table than the default in MANAGED_ENUMS (e.g. "title" on regulation
// means the document title, not the contact salutation — uses its own table).
const MANAGED_ENUM_ENTITY_OVERRIDE: Record<string, Record<string, string>> = {
  regulation:          { title: "regulation_title" },
  standard:            { title: "regulation_title" },
  "regulation-version": { title: "regulation_title" },
  "standard-version":  { title: "regulation_title" },
  requirement:         { title: "regulation_title" },
}
// Returns the enum key for a field on a given entity, checking entity-specific
// overrides first, then falling back to the global MANAGED_ENUMS table.
function getManagedEnumKey(field: string, entityKey: string): string | undefined {
  const override = MANAGED_ENUM_ENTITY_OVERRIDE[entityKey]?.[field]
  if (override) return override
  return MANAGED_ENUMS[field]
}

// FK fields that get the ⚙ managed-options gear icon backed by their entity
// table (create/delete records via the entity API, same UX as managed enums).
type EntityManagedFKConfig = { targetEntity: string; idColumn: string; fields: Array<{ name: string; label: string; required?: boolean }> }
const ENTITY_MANAGED_FK_FIELDS: Record<string, EntityManagedFKConfig> = {
  jurisdiction_id: {
    targetEntity: "jurisdiction",
    idColumn: "jurisdiction_id",
    fields: [
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Name", required: true },
      { name: "region", label: "Region" },
    ],
  },
  authority_id: {
    targetEntity: "authority",
    idColumn: "authority_id",
    fields: [
      { name: "authority_name", label: "Name", required: true },
      { name: "authority_type", label: "Type" },
      { name: "website_url", label: "Website" },
    ],
  },
}

// Fields to hide from the Add/Create form for a given entity. Useful when a column
// exists on the table but the user doesn't want to expose it in the quick-create flow
// (e.g. assign-to-parent FKs that are set via a different workflow).
const HIDDEN_CREATE_FIELDS: Record<string, string[]> = {
  // Owner is set later from the record detail (after the user knows who owns it),
  // not at quick-create time. Legal Entity is set via context (the parent record)
  // or assigned later. Both are kept off the Add dialog to reduce friction.
  // division: name_local and legal_entity_id are removed from schema; only hide owner_user_id here.
  division: ["owner_user_id"],
  "cost-center": ["legal_entity_id", "owner_user_id"],
  "profit-center": ["legal_entity_id", "owner_user_id"],
  "credit-area": ["legal_entity_id", "owner_user_id"],
  // delivery-org: name_local, country_code, timezone, and legal_entity_id are removed from schema;
  // only hide owner_user_id from quick-create.
  "delivery-org": ["owner_user_id"],
  "delivery-office": ["owner_user_id"],
  // delivery-channel: name, name_local and currency_code are removed from schema;
  // code is auto-generated by backend — hide code and owner_user_id from the Add form.
  "delivery-channel": ["owner_user_id", "code"],
  "delivery-team": ["delivery_office_id"],
  // sales-org: name_local, country_code and legal_entity_id are removed from schema.
  // Owner is exposed on the sales-org Add dialog (per request); nothing else to hide.
  "sales-org": [],
  "sales-office": ["owner_user_id"],
  // sales-channel: mirrors delivery-channel — code is auto-generated by the backend,
  // so hide code and owner_user_id from the Add form.
  "sales-channel": ["owner_user_id", "code"],
  // purchase-channel: mirrors delivery-channel/sales-channel — code is auto-generated
  // by the backend, so hide code and owner_user_id from the Add form.
  "purchase-channel": ["owner_user_id", "code"],
  // sales-team is assigned to a sales-office from the office record view, so the
  // sales_office_id link is set there — hide it from the sales-team Add dialog.
  "sales-team": ["sales_office_id"],
  // purchase-org now mirrors delivery-org: name_local, country_code, and legal_entity_id
  // are removed from schema; only hide owner_user_id from quick-create.
  "purchase-org": ["owner_user_id"],
  "purchase-office": ["owner_user_id"],
  // purchase-team is assigned to a purchase-office from the office record view, so the
  // purchase_office_id link is set there — hide it from the purchase-team Add dialog.
  "purchase-team": ["purchase_office_id"],
  "controlling-area": ["owner_user_id"],
  // controlling_area is assigned later from the record detail (after picking the right
  // controlling area); the quick-create stays minimal.
  "cost-center-group": ["owner_user_id", "controlling_area_id"],
  "product-category": ["owner_user_id"],
  "product-line": ["owner_user_id"],
  jurisdiction: [],
  authority: [],
  regulation: [],
  "regulation-source": ["last_run_at", "last_status", "last_checksum"],
  "regulation-ingest-run": ["regulation_source_id", "regulation_id", "started_at", "finished_at", "http_status", "checksum", "version_id", "snapshot_id", "chunk_count", "detail"],
  "regulation-version": ["regulation_id"],
  "regulation-source-snapshot": ["regulation_version_id"],
  "regulation-chunk": ["regulation_version_id"],
  "regulation-summary": ["regulation_version_id"],
  "regulation-memory": ["regulation_version_id"],
  "regulation-relation": ["from_regulation_version_id", "to_regulation_version_id"],
}

// Per-entity override for which Add-dialog fields are mandatory (rendered under
// "Basic" with a * and enforced on submit). Without an override the form falls
// back to validationSchema.requiredFields, then to a name/code heuristic — which
// never flags foreign-key (_id) fields. delivery-channel needs its Legal Entity,
// Delivery Org and Delivery Office links to be required.
const REQUIRED_CREATE_FIELDS: Record<string, string[]> = {
  "delivery-channel": ["legal_entity_id", "delivery_org_id", "delivery_office_id"],
  "sales-channel": ["legal_entity_id", "sales_org_id", "sales_office_id"],
  "purchase-channel": ["legal_entity_id", "purchase_org_id", "purchase_office_id"],
}

// Entities whose `code` is a system-assigned sequential number (auto-generated by
// the backend on create). For these, code is display-only everywhere — never an
// editable input.
const SYSTEM_ASSIGNED_CODE_ENTITIES = new Set<string>(["delivery-channel", "sales-channel", "purchase-channel"])

// Maximum length for the bare 'code' field on a given entity. Default is 10 (set in
// renderCreateField/renderRecordField). Add an override here for entities that follow
// the SAP 4-char convention.
// Entities that should render as a hierarchical tree (self-referential parent pointer).
const TREE_ENTITIES: Record<string, { parentField: string; idField: string }> = {
  "cost-center-group": { parentField: "parent_group_id", idField: "cost_center_group_id" },
  "product-category": { parentField: "parent_category_id", idField: "product_category_id" },
  "product-line": { parentField: "parent_line_id", idField: "product_line_id" },
}

// FK columns that should render as a tree-select dropdown instead of a flat list.
// Maps the FK column name to the tree configuration of the target entity.
const TREE_SELECT_FK_FIELDS: Record<string, { entityKey: string; idField: string; parentField: string }> = {
  product_line_id: { entityKey: "product-line", idField: "product_line_id", parentField: "parent_line_id" },
  product_category_id: { entityKey: "product-category", idField: "product_category_id", parentField: "parent_category_id" },
}

/**
 * A dropdown that renders options as an expandable tree hierarchy.
 * Builds the tree in-memory from the flat rawRows array using the parentField pointer.
 */
function TreeSelectDropdown({
  value,
  onChange,
  rawRows,
  options,
  config,
  className,
  emptyHint,
}: {
  value: string
  onChange: (val: string) => void
  rawRows: RowData[]
  options: LookupOption[]
  config: { idField: string; parentField: string }
  className?: string
  emptyHint?: string
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Build lookup maps
  const optionMap = useMemo(() => {
    const m = new Map<string, LookupOption>()
    for (const o of options) m.set(o.value, o)
    return m
  }, [options])

  // Build parent→children map
  const childrenMap = useMemo(() => {
    const m = new Map<string, string[]>() // parentId → [childIds]
    const rootIds: string[] = []
    for (const row of rawRows) {
      const id = String(row[config.idField] ?? "")
      const parentId = String(row[config.parentField] ?? "").trim()
      if (!id) continue
      if (!parentId) {
        rootIds.push(id)
      } else {
        const kids = m.get(parentId) ?? []
        kids.push(id)
        m.set(parentId, kids)
      }
    }
    return { childrenOf: m, rootIds }
  }, [rawRows, config.idField, config.parentField])

  // Collect all ancestor IDs of nodes matching search (so they stay visible)
  const parentMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of rawRows) {
      const id = String(row[config.idField] ?? "")
      const parentId = String(row[config.parentField] ?? "").trim()
      if (id && parentId) m.set(id, parentId)
    }
    return m
  }, [rawRows, config.idField, config.parentField])

  const filteredIds = useMemo(() => {
    if (!search.trim()) return null // no filtering
    const q = search.toLowerCase()
    const matchSet = new Set<string>()
    for (const o of options) {
      if (o.label.toLowerCase().includes(q)) {
        matchSet.add(o.value)
        // Add ancestors
        let cur = o.value
        while (parentMap.has(cur)) {
          cur = parentMap.get(cur)!
          matchSet.add(cur)
        }
      }
    }
    return matchSet
  }, [search, options, parentMap])

  // Auto-expand ancestors of matched nodes when searching
  useEffect(() => {
    if (filteredIds) setExpanded(new Set(filteredIds))
  }, [filteredIds])

  const hasChildren = (id: string) => (childrenMap.childrenOf.get(id)?.length ?? 0) > 0

  function renderNode(id: string, depth: number): React.ReactNode {
    if (filteredIds && !filteredIds.has(id)) return null
    const opt = optionMap.get(id)
    if (!opt) return null
    const isExpanded = expanded.has(id)
    const kids = childrenMap.childrenOf.get(id) ?? []
    const hasKids = kids.length > 0
    return (
      <React.Fragment key={id}>
        <div
          className={`flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-sm hover:bg-accent ${value === id ? "bg-primary/10 font-medium text-primary" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => { onChange(id); setOpen(false); setSearch("") }}
        >
          {hasKids ? (
            <button
              type="button"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((prev) => {
                  const n = new Set(prev)
                  if (n.has(id)) n.delete(id); else n.add(id)
                  return n
                })
              }}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="inline-block h-4 w-4 shrink-0" />
          )}
          <span className="truncate" title={opt.label}>{opt.label}</span>
        </div>
        {hasKids && isExpanded && kids.map((kid) => renderNode(kid, depth + 1))}
      </React.Fragment>
    )
  }

  const selectedLabel = value ? (optionMap.get(value)?.label ?? value) : ""

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex w-full items-center justify-between rounded border bg-background px-2 py-1 text-left text-sm ${className ?? "border-border"}`}
      >
        <span className={`truncate ${value ? "" : "text-muted-foreground"}`} title={value ? selectedLabel : ""}>
          {value ? selectedLabel : (emptyHint ?? "— Select —")}
        </span>
        <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] rounded-md border border-border bg-popover shadow-lg"
        >
          <div className="border-b border-border p-1.5">
            <div className="flex items-center gap-1 rounded border border-border bg-background px-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-transparent py-1 text-sm outline-none"
              />
            </div>
          </div>
          <div className="max-h-[280px] overflow-auto p-1">
            {/* Clear selection option */}
            <div
              className={`flex cursor-pointer items-center rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent ${!value ? "font-medium" : ""}`}
              onClick={() => { onChange(""); setOpen(false); setSearch("") }}
            >
              — Clear —
            </div>
            {childrenMap.rootIds.map((id) => renderNode(id, 0))}
            {childrenMap.rootIds.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">No options available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const CODE_MAX_LENGTH: Record<string, number> = {
  "product-category": 12,
  division: 4,
  "profit-center": 4,
  "credit-area": 4,
  "controlling-area": 4,
  "cost-center-group": 4,
  "delivery-org": 4,
  "delivery-office": 4,
  "delivery-team": 4,
  "delivery-channel": 4,
  "sales-org": 4,
  "sales-office": 4,
  "sales-team": 4,
  "sales-channel": 4,
  "purchase-org": 4,
  "purchase-office": 4,
  "purchase-team": 4,
  "purchase-channel": 4,
}

const GRID_LIFECYCLE_COLUMNS = ["status", "valid_from", "valid_to"]

// Display formatter for grid cells: collapse ISO datetimes (e.g. 2026-05-30T00:00:00.000Z)
// to date-only, and render empty values as a dash.
function formatCellValue(value: unknown): string {
  const s = String(value ?? "").trim()
  if (s === "") return "-"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T[\d:.]+/)
  return m ? m[1] : s
}

// Fields that contain URLs and should render as clickable links opening in a new tab.
const URL_FIELDS = new Set(["website_url", "api_url", "source_url", "raw_uri"])

// Render a URL value as a clickable link that opens in a new tab/window.
function renderUrlLink(value: unknown): React.ReactNode {
  const s = String(value ?? "").trim()
  if (!s || s === "-") return "-"
  const href = /^https?:\/\//i.test(s) ? s : `https://${s}`
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-block max-w-[220px] truncate align-bottom text-primary underline decoration-primary/40 hover:decoration-primary" title={s}>
      {s}
    </a>
  )
}

function singularizeLabel(label: string): string {
  const s = String(label ?? "").trim()
  if (s.endsWith("ies") && s.length > 3) return `${s.slice(0, -3)}y`
  if (s.endsWith("ses") || s.endsWith("xes") || s.endsWith("zes")) return s.slice(0, -2)
  if (s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1)
  return s
}

type EntityInsightConfig = {
  title: string
  subtitle: string
  highlights: Array<{ label: string; field: string }>
  rowsLabel: string
}

const ENTITY_INSIGHT_CONFIG: Record<string, EntityInsightConfig> = {
  "controlling-area": {
    title: "Controlling Area Explorer",
    subtitle: "Live controlling areas with cost center group context.",
    highlights: [
      { label: "Controlling Area", field: "controlling_area_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Areas",
  },
  "cost-center-group": {
    title: "Cost Center Group Explorer",
    subtitle: "Live cost center groups with hierarchy and linked cost centers.",
    highlights: [
      { label: "Group Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Parent Group", field: "parent_group_id" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Groups",
  },
  "delivery-org": {
    title: "Delivery Org Explorer",
    subtitle: "Live delivery organizations with ownership and status context.",
    highlights: [
      { label: "Delivery Org", field: "delivery_org_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Orgs",
  },
  "sales-org": {
    title: "Sales Org Explorer",
    subtitle: "Live sales organizations with ownership and status context.",
    highlights: [
      { label: "Sales Org", field: "sales_org_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Orgs",
  },
  "purchase-org": {
    title: "Purchase Org Explorer",
    subtitle: "Live purchase organizations with ownership and status context.",
    highlights: [
      { label: "Purchase Org", field: "purchase_org_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Orgs",
  },
  division: {
    title: "Division Explorer",
    subtitle: "Live divisions with code, owner, and status context.",
    highlights: [
      { label: "Division", field: "division_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Divisions",
  },
  "cost-center": {
    title: "Cost Center Explorer",
    subtitle: "Live cost centers with legal entity and owner context.",
    highlights: [
      { label: "Cost Center", field: "cost_center_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Cost Centers",
  },
  "profit-center": {
    title: "Profit Center Explorer",
    subtitle: "Live profit centers with legal entity and owner context.",
    highlights: [
      { label: "Profit Center", field: "profit_center_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Profit Centers",
  },
  "credit-area": {
    title: "Credit Area Explorer",
    subtitle: "Live credit areas with limit and ownership context.",
    highlights: [
      { label: "Credit Area", field: "credit_area_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Areas",
  },
  "product-category": {
    title: "HS Code Explorer",
    subtitle: "Live HS codes with hierarchy and linked product features.",
    highlights: [
      { label: "HS Code", field: "product_category_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "HS Codes",
  },
  "feature-of-product": {
    title: "Product Feature Explorer",
    subtitle: "Live product features with code and description context.",
    highlights: [
      { label: "Feature", field: "feature_of_product_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
    ],
    rowsLabel: "Features",
  },
  jurisdiction: {
    title: "Jurisdiction Explorer",
    subtitle: "Global legal jurisdictions used to organize authorities and regulations.",
    highlights: [
      { label: "Jurisdiction", field: "jurisdiction_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "Region", field: "region" },
    ],
    rowsLabel: "Jurisdictions",
  },
  authority: {
    title: "Authority Explorer",
    subtitle: "Official authorities and legal sources by jurisdiction.",
    highlights: [
      { label: "Authority", field: "authority_id" },
      { label: "Name", field: "authority_name" },
      { label: "Type", field: "authority_type" },
      { label: "Website", field: "website_url" },
    ],
    rowsLabel: "Authorities",
  },
  regulation: {
    title: "Regulation Explorer",
    subtitle: "Regulations with source, jurisdiction, and authority context.",
    highlights: [
      { label: "Regulation Code", field: "regulation_code" },
      { label: "Title", field: "title" },
      { label: "Jurisdiction", field: "jurisdiction_id" },
      { label: "Authority", field: "authority_id" },
    ],
    rowsLabel: "Regulations",
  },
  "regulation-source": {
    title: "Regulation Source Registry",
    subtitle: "Configured authority endpoints, refresh cadence, and last sync state.",
    highlights: [
      { label: "Source", field: "source_name" },
      { label: "Type", field: "source_type" },
      { label: "Parser", field: "parser_type" },
      { label: "Last Status", field: "last_status" },
    ],
    rowsLabel: "Sources",
  },
  "regulation-ingest-run": {
    title: "Regulation Ingest History",
    subtitle: "Traceable source fetches, checksums, versions, snapshots, and failures.",
    highlights: [
      { label: "Run", field: "regulation_ingest_run_id" },
      { label: "Status", field: "run_status" },
      { label: "Format", field: "source_format" },
      { label: "Chunks", field: "chunk_count" },
    ],
    rowsLabel: "Runs",
  },
  "regulation-version": {
    title: "Regulation Version Explorer",
    subtitle: "Versioned legal text ready for retrieval, comparison, and summarization.",
    highlights: [
      { label: "Regulation", field: "regulation_id" },
      { label: "Version", field: "version_no" },
      { label: "Published", field: "published_at" },
      { label: "Effective From", field: "effective_from" },
    ],
    rowsLabel: "Versions",
  },
  "product-line": {
    title: "Product Line Explorer",
    subtitle: "Live product lines assigned to HS codes.",
    highlights: [
      { label: "Product Line", field: "product_line_id" },
      { label: "Code", field: "code" },
      { label: "Name", field: "name" },
      { label: "HS Code", field: "product_category_id" },
    ],
    rowsLabel: "Product Lines",
  },
  "service-bom": {
    title: "Service BOM Explorer",
    subtitle: "5-dimension BOMs: service item × product × domain × requirement/standard × delivery channel.",
    highlights: [
      { label: "BOM Code", field: "bom_code" },
      { label: "Service", field: "service_item_id" },
      { label: "Service Domain", field: "service_domain_id" },
      { label: "Delivery Channel", field: "delivery_channel_id" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "BOMs",
  },
  standard: {
    title: "Standard Explorer",
    subtitle: "Live standards with version labels and record visibility.",
    highlights: [
      { label: "Standard Code", field: "standard_code" },
      { label: "Title", field: "title" },
      { label: "Version", field: "version_label" },
      { label: "Status", field: "status" },
    ],
    rowsLabel: "Standards",
  },
  activity: {
    title: "Activity Explorer",
    subtitle: "Live activity catalog with duration and type context.",
    highlights: [
      { label: "Activity Code", field: "activity_code" },
      { label: "Activity Name", field: "activity_name" },
      { label: "Type", field: "activity_type" },
      { label: "Duration", field: "default_duration_min" },
    ],
    rowsLabel: "Activities",
  },
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

function entityDisplayName(entityKey: string): string {
  const key = String(entityKey ?? "").trim()
  return ENTITY_LABEL_OVERRIDES[key] ?? humanizeLabel(key)
}

function getEntityHiddenColumns(entity: string): string[] {
  if (entity === "credit-area") return ["legal_entity_id", "credit_limit"]
  if (entity === "service-item") return ["base_price", "currency_code"]
  if (entity === "delivery-org") return ["name_local", "country_code", "timezone", "legal_entity_id"]
  if (entity === "purchase-org") return ["name_local", "country_code", "legal_entity_id"]
  if (entity === "division") return ["name_local", "legal_entity_id"]
  return []
}

// Connected subtables (ER) for the double-click record view. Each parent entity
// maps to its child tables; each child becomes a tab in the record view's Line area.
// assignMode: when true, "Add" lets the user PICK an existing child record (via a single
// dropdown) and links it to the parent by PATCHing the child's fkColumn — instead of
// creating a brand-new record. Used e.g. for Legal Entity as a subtable of Controlling Area.
type SubtableDef = { childEntity: string; label: string; fkColumn: string; parentField: string; columns: string[]; assignMode?: boolean; multiAssign?: boolean }
const SUBTABLES: Record<string, SubtableDef[]> = {
  country: [
    { childEntity: "province", label: "Provinces / States", fkColumn: "country_code", parentField: "alpha2", columns: ["subdivision_code", "name_en", "category", "status"] },
  ],
  "legal-entity": [
    { childEntity: "legal-entity-bank", label: "Bank Accounts", fkColumn: "legal_entity_id", parentField: "legal_entity_id", columns: ["line_no", "bank_name", "account_no", "iban", "swift_bic", "currency_code", "is_primary", "status"] },
    { childEntity: "legal-entity-tax", label: "Tax Registrations", fkColumn: "legal_entity_id", parentField: "legal_entity_id", columns: ["line_no", "tax_type", "tax_country_code", "tax_registration_no", "rate_percent", "is_primary", "status"] },
    { childEntity: "legal-entity-address", label: "Addresses", fkColumn: "legal_entity_id", parentField: "legal_entity_id", columns: ["line_no", "address_type", "line1", "city", "country_code", "is_primary", "status"] },
    { childEntity: "legal-entity-contact", label: "Contacts", fkColumn: "legal_entity_id", parentField: "legal_entity_id", columns: ["line_no", "contact_user_id", "title", "phone", "is_primary", "status"] },
    { childEntity: "profit-center", label: "Profit Centers", fkColumn: "legal_entity_id", parentField: "legal_entity_id", columns: ["code", "name", "currency_code", "status"], assignMode: true },
  ],
  "controlling-area": [
    { childEntity: "legal-entity", label: "Legal Entities", fkColumn: "controlling_area_id", parentField: "controlling_area_id", columns: ["legal_entity_code", "legal_entity_name", "country_code", "currency_code", "status"], assignMode: true },
  ],
  "master-client": [
    { childEntity: "customer", label: "Customers", fkColumn: "master_client_id", parentField: "master_client_id", columns: ["customer_code", "customer_name", "country_code", "industry", "status"], assignMode: true },
  ],
  customer: [
    { childEntity: "customer-sales-channel", label: "Sales Channels", fkColumn: "customer_id", parentField: "customer_id", columns: ["sales_channel_id", "currency_code", "payment_terms", "incoterms", "owner_user_id", "is_primary", "status"] },
    { childEntity: "customer-address", label: "Addresses", fkColumn: "customer_id", parentField: "customer_id", columns: ["line_no", "address_type", "line1", "city", "country_code", "is_primary", "status"] },
    { childEntity: "customer-bank", label: "Bank Accounts", fkColumn: "customer_id", parentField: "customer_id", columns: ["line_no", "bank_name", "account_no", "iban", "swift_bic", "currency_code", "is_primary", "status"] },
    { childEntity: "customer-tax", label: "Tax Registrations", fkColumn: "customer_id", parentField: "customer_id", columns: ["line_no", "tax_type", "tax_country_code", "tax_registration_no", "rate_percent", "is_primary", "status"] },
    { childEntity: "customer-contact", label: "Contacts", fkColumn: "customer_id", parentField: "customer_id", columns: ["line_no", "contact_name", "title", "email", "phone", "is_primary", "status"] },
  ],
  vendor: [
    { childEntity: "vendor-purchase-channel", label: "Purchase Channels", fkColumn: "vendor_id", parentField: "vendor_id", columns: ["purchase_channel_id", "currency_code", "payment_terms", "incoterms", "owner_user_id", "is_primary", "status"] },
    { childEntity: "vendor-address", label: "Addresses", fkColumn: "vendor_id", parentField: "vendor_id", columns: ["line_no", "address_type", "line1", "city", "country_code", "is_primary", "status"] },
    { childEntity: "vendor-bank", label: "Bank Accounts", fkColumn: "vendor_id", parentField: "vendor_id", columns: ["line_no", "bank_name", "account_no", "iban", "swift_bic", "currency_code", "is_primary", "status"] },
    { childEntity: "vendor-tax", label: "Tax Registrations", fkColumn: "vendor_id", parentField: "vendor_id", columns: ["line_no", "tax_type", "tax_country_code", "tax_registration_no", "rate_percent", "is_primary", "status"] },
    { childEntity: "vendor-contact", label: "Contacts", fkColumn: "vendor_id", parentField: "vendor_id", columns: ["line_no", "contact_name", "title", "email", "phone", "is_primary", "status"] },
  ],
  division: [
    { childEntity: "profit-center", label: "Profit Centers", fkColumn: "division_id", parentField: "division_id", columns: ["code", "name", "currency_code", "legal_entity_id", "status"], assignMode: true },
  ],
  "profit-center": [
    { childEntity: "cost-center", label: "Cost Centers", fkColumn: "profit_center_id", parentField: "profit_center_id", columns: ["code", "name", "currency_code", "legal_entity_id", "status"], assignMode: true },
  ],
  "cost-center-group": [
    { childEntity: "cost-center-group", label: "Child Groups", fkColumn: "parent_group_id", parentField: "cost_center_group_id", columns: ["code", "name", "controlling_area_id", "status"], assignMode: true },
    { childEntity: "cost-center-group-map", label: "Cost Centers", fkColumn: "cost_center_group_id", parentField: "cost_center_group_id", columns: ["cost_center_id", "status"], assignMode: true, multiAssign: true },
  ],
  "product-category": [
    { childEntity: "product-category", label: "Child HS Codes", fkColumn: "parent_category_id", parentField: "product_category_id", columns: ["code", "name", "status"], assignMode: true },
    { childEntity: "product-category-feature", label: "Compliance Features", fkColumn: "product_category_id", parentField: "product_category_id", columns: ["feature_of_product_id", "note", "status"], assignMode: true, multiAssign: true },
  ],
  "product-line": [
    { childEntity: "product-line-feature", label: "Compliance Features", fkColumn: "product_line_id", parentField: "product_line_id", columns: ["feature_of_product_id", "note", "status"], assignMode: true, multiAssign: true },
  ],
  jurisdiction: [
    { childEntity: "authority", label: "Authorities", fkColumn: "jurisdiction_id", parentField: "jurisdiction_id", columns: ["authority_name", "authority_type", "website_url", "api_url", "status"], assignMode: true },
    { childEntity: "regulation", label: "Regulations", fkColumn: "jurisdiction_id", parentField: "jurisdiction_id", columns: ["regulation_code", "title", "issuing_authority", "status"] },
  ],
  authority: [
    { childEntity: "regulation", label: "Regulations", fkColumn: "authority_id", parentField: "authority_id", columns: ["regulation_code", "title", "issuing_authority", "status"] },
    { childEntity: "regulation-source", label: "Sources", fkColumn: "authority_id", parentField: "authority_id", columns: ["source_name", "source_type", "source_url", "parser_type", "last_status", "last_run_at", "status"] },
  ],
  regulation: [
    { childEntity: "regulation-source", label: "Sources", fkColumn: "regulation_id", parentField: "regulation_id", columns: ["source_name", "source_type", "source_url", "parser_type", "last_status", "last_run_at", "status"] },
    { childEntity: "regulation-version", label: "Versions", fkColumn: "regulation_id", parentField: "regulation_id", columns: ["version_no", "version_label", "published_at", "effective_from", "effective_to", "source_identifier", "status"] },
    { childEntity: "regulation-ingest-run", label: "Ingest Runs", fkColumn: "regulation_id", parentField: "regulation_id", columns: ["run_status", "source_url", "source_format", "started_at", "finished_at", "chunk_count"] },
    { childEntity: "regulation-change-event", label: "Change Events", fkColumn: "regulation_id", parentField: "regulation_id", columns: ["change_type", "section_path", "from_version_id", "to_version_id", "acknowledged", "status"] },
  ],
  "regulation-source": [
    { childEntity: "regulation-ingest-run", label: "Ingest Runs", fkColumn: "regulation_source_id", parentField: "regulation_source_id", columns: ["run_status", "source_url", "source_format", "started_at", "finished_at", "detail"] },
  ],
  "regulation-version": [
    { childEntity: "regulation-source-snapshot", label: "Source Snapshots", fkColumn: "regulation_version_id", parentField: "regulation_version_id", columns: ["source_type", "source_url", "source_format", "fetched_at", "parser_version", "http_status", "status"] },
    { childEntity: "regulation-chunk", label: "Chunks", fkColumn: "regulation_version_id", parentField: "regulation_version_id", columns: ["chunk_type", "section_path", "heading", "chunk_order", "token_count", "status"] },
    { childEntity: "regulation-summary", label: "Summaries", fkColumn: "regulation_version_id", parentField: "regulation_version_id", columns: ["summary_type", "summary_model", "confidence", "status"] },
    { childEntity: "regulation-memory", label: "Memory", fkColumn: "regulation_version_id", parentField: "regulation_version_id", columns: ["memory_type", "confidence", "status"] },
    { childEntity: "regulation-relation", label: "Relations", fkColumn: "from_regulation_version_id", parentField: "regulation_version_id", columns: ["to_regulation_version_id", "relation_type", "status"] },
    { childEntity: "requirement", label: "Requirements", fkColumn: "regulation_version_id", parentField: "regulation_version_id", columns: ["requirement_code", "title", "requirement_type", "jurisdiction_id", "mandatory", "extraction_method", "status"] },
  ],
  standard: [
    { childEntity: "standard-source", label: "Sources", fkColumn: "standard_id", parentField: "standard_id", columns: ["source_name", "source_type", "source_url", "refresh_interval_hours", "last_status", "last_run_at", "status"] },
    { childEntity: "standard-version", label: "Versions", fkColumn: "standard_id", parentField: "standard_id", columns: ["version_no", "version_label", "edition", "amendment", "published_at", "effective_from", "effective_to", "status"] },
    { childEntity: "standard-ingest-run", label: "Ingest Runs", fkColumn: "standard_id", parentField: "standard_id", columns: ["run_status", "source_url", "source_format", "started_at", "finished_at", "detail"] },
    { childEntity: "requirement", label: "Requirements", fkColumn: "standard_id", parentField: "standard_id", columns: ["requirement_code", "title", "requirement_type", "jurisdiction_id", "mandatory", "extraction_method", "status"] },
  ],
  "standard-source": [
    { childEntity: "standard-ingest-run", label: "Ingest Runs", fkColumn: "standard_source_id", parentField: "standard_source_id", columns: ["run_status", "source_url", "source_format", "started_at", "finished_at", "detail"] },
  ],
  "standard-version": [
    { childEntity: "standard-chunk", label: "Chunks (licensed full text)", fkColumn: "standard_version_id", parentField: "standard_version_id", columns: ["chunk_type", "section_path", "heading", "chunk_order", "token_count", "status"] },
  ],
  requirement: [
    { childEntity: "requirement-service-item", label: "Service Items", fkColumn: "requirement_id", parentField: "requirement_id", columns: ["service_item_id", "coverage", "note", "status"], assignMode: true, multiAssign: true },
  ],
  "discovery-feed": [
    { childEntity: "discovery-run", label: "Runs", fkColumn: "discovery_feed_id", parentField: "discovery_feed_id", columns: ["run_status", "http_status", "items_found", "items_new", "started_at", "finished_at", "detail"] },
  ],
  // credit-area uses a dedicated header-layer card; this child only loads the join rows.
  "credit-area": [
    { childEntity: "credit-area-legal-entity", label: "Legal Entities", fkColumn: "credit_area_id", parentField: "credit_area_id", columns: ["legal_entity_id", "status"], assignMode: true },
  ],
  "delivery-office": [
    { childEntity: "delivery-team", label: "Delivery Teams", fkColumn: "delivery_office_id", parentField: "delivery_office_id", columns: ["code", "name", "name_local", "manager_user_id", "status"], assignMode: true },
  ],
  "sales-office": [
    { childEntity: "sales-team", label: "Sales Teams", fkColumn: "sales_office_id", parentField: "sales_office_id", columns: ["code", "name", "name_local", "manager_user_id", "status"], assignMode: true },
  ],
  "purchase-office": [
    { childEntity: "purchase-team", label: "Purchase Teams", fkColumn: "purchase_office_id", parentField: "purchase_office_id", columns: ["code", "name", "name_local", "manager_user_id", "status"], assignMode: true },
  ],
  "price-list": [
    { childEntity: "price-list-item", label: "Price List Items", fkColumn: "price_list_id", parentField: "price_list_id", columns: ["line_no", "service_item_id", "unit_price", "status"] },
  ],
  "service-domain": [
    { childEntity: "service-item", label: "Service Items", fkColumn: "service_domain_id", parentField: "service_domain_id", columns: ["service_item_code", "service_item_name", "deliverable_type", "lead_time_days", "status"], assignMode: true },
  ],
  "service-item": [
    { childEntity: "price-list-item", label: "Price Overrides", fkColumn: "service_item_id", parentField: "service_item_id", columns: ["price_list_id", "line_no", "unit_price", "status"] },
    { childEntity: "service-bom", label: "Service BOMs", fkColumn: "service_item_id", parentField: "service_item_id", columns: ["bom_code", "description", "applicability_json", "priority", "status"] },
    { childEntity: "service-item-deliverable", label: "Deliverables", fkColumn: "service_item_id", parentField: "service_item_id", columns: ["deliverable_id", "note", "status"], assignMode: true, multiAssign: true },
    { childEntity: "service-item-dependency", label: "Dependencies", fkColumn: "service_item_id", parentField: "service_item_id", columns: ["prerequisite_service_item_id", "dependency_type", "cost_reduction_pct", "note", "status"] },
    { childEntity: "service-item-regulation", label: "Regulations", fkColumn: "service_item_id", parentField: "service_item_id", columns: ["regulation_id", "status"] },
    { childEntity: "service-item-standard", label: "Standards", fkColumn: "service_item_id", parentField: "service_item_id", columns: ["standard_id", "status"] },
  ],
  "service-bom": [
    { childEntity: "service-bom-line", label: "BOM Lines", fkColumn: "service_bom_id", parentField: "service_bom_id", columns: ["line_no", "component_type", "component_name", "qty", "qty_formula", "uom", "cost_rate_id", "unit_cost", "cost_driver", "status"] },
  ],
}

const COST_CENTER_GROUP_CHILD_ENTITY = "cost-center-group"
const COST_CENTER_GROUP_COST_CENTER_ENTITY = "cost-center-group-map"
const COST_CENTER_ENTITY = "cost-center"

// Office → team "assign" feature: the dedicated card UI shown in an office record
// view (Assigned Teams + Office Scope cards + assign dialog). delivery-office,
// sales-office, and purchase-office share the same design — teams are linked to
// an office by setting the team's office FK. Keyed by the office entity.
type OfficeTeamFeature = { childEntity: string; childIdCol: string; fkCol: string; parentIdCol: string; teamSingular: string; teamPlural: string; officeLabel: string }
const OFFICE_TEAM_FEATURE: Record<string, OfficeTeamFeature> = {
  "delivery-office": { childEntity: "delivery-team", childIdCol: "delivery_team_id", fkCol: "delivery_office_id", parentIdCol: "delivery_office_id", teamSingular: "Delivery Team", teamPlural: "Delivery Teams", officeLabel: "delivery office" },
  "sales-office": { childEntity: "sales-team", childIdCol: "sales_team_id", fkCol: "sales_office_id", parentIdCol: "sales_office_id", teamSingular: "Sales Team", teamPlural: "Sales Teams", officeLabel: "sales office" },
  "purchase-office": { childEntity: "purchase-team", childIdCol: "purchase_team_id", fkCol: "purchase_office_id", parentIdCol: "purchase_office_id", teamSingular: "Purchase Team", teamPlural: "Purchase Teams", officeLabel: "purchase office" },
}

type TopicGroup = { label: string; fields: string[] }

function groupFieldsByTopic(fields: string[], entityKey?: string): TopicGroup[] {
  const identifiers: string[] = []
  const schema: string[] = []   // Regulation/Standard: jurisdiction + authority
  const locationTimeLanguage: string[] = []
  const finance: string[] = []
  const details: string[] = []
  const validity: string[] = []
  const seen = new Set<string>()
  const fieldOrder = new Map(fields.map((field, index) => [field, index]))

  const push = (bucket: string[], field: string) => {
    if (seen.has(field)) return
    seen.add(field)
    bucket.push(field)
  }

  const isValidity = (f: string) => f === "status" || f === "valid_from" || f === "valid_to"
  // Keep name/title fields with identifiers so the record header reads like a master record,
  // not a separate names section.
  const isIdentifier = (f: string) => /(^id$|_id$|alpha\d?|numeric\d?|^code$|_code$|subdivision_code|name|title|company_id|registration_no|vat_registration_no|tax_id)/i.test(f)
  const isLocation = (f: string) => /(^country_code$|country|address|city|state|region|postal|zip|location|subdivision|incorporation)/i.test(f)
  const isFinance = (f: string) => /(chart_of_accounts|fiscal_year_variant|credit_control_area|currency_code|base_currency_code|exchange_rate)/i.test(f)
  const legalEntityFinanceFields = new Set(["controlling_area_id", "division_id", "tax_id", "vat_registration_no"])
  const locationRank = (field: string): number => {
    if (field === "country_code" || field === "country") return 0
    if (field === "address") return 1
    if (field === "language_key") return 2
    if (field === "timezone") return 3
    return 10
  }

  // Business partners: commercial fields (currency, credit area) read better in
  // Details than mixed into Identifiers.
  const bpDetailFields = new Set(["currency_code", "credit_area_id", "master_client_id"])

  // Service BOM sections:
  //   • Service     — service_item_id + service_domain_id
  //   • Requirement — requirement_id + jurisdiction_id
  //   • product_line_id / product_category_id are managed by the Product Line assign card
  //     (multi HS-code selection), NOT as header fields, so they're dropped here.
  // Delivery channel and owner stay in Identifiers (mandatory book-keeping keys).
  const serviceGroup: string[] = []
  const requirementGroup: string[] = []
  const serviceBomServiceFields = ["service_item_id", "service_domain_id"]
  const serviceBomRequirementFields = ["requirement_id", "jurisdiction_id"]
  const serviceGroupOrder = new Map(serviceBomServiceFields.map((f, i) => [f, i]))
  const requirementGroupOrder = new Map(serviceBomRequirementFields.map((f, i) => [f, i]))

  for (const f of fields) {
    if (seen.has(f)) continue
    if (isValidity(f)) {
      push(validity, f)
      continue
    }

    // Service BOM section routing (BEFORE generic location/id rules so jurisdiction isn't
    // misfiled as location). product_line/product_category are handled by the assign card.
    if (entityKey === "service-bom") {
      if (f === "product_line_id" || f === "product_category_id") { seen.add(f); continue }
      if (serviceGroupOrder.has(f)) { push(serviceGroup, f); continue }
      if (requirementGroupOrder.has(f)) { push(requirementGroup, f); continue }
    }

    // Regulation/Standard: version_label stays in Identifiers; title, jurisdiction
    // + authority belong in the "Schema" section.
    if ((entityKey === "regulation" || entityKey === "standard") && f === "version_label") {
      push(identifiers, f)
      continue
    }
    if ((entityKey === "regulation" || entityKey === "standard") && (f === "title" || f === "jurisdiction_id" || f === "authority_id")) {
      push(schema, f)
      continue
    }

    if ((entityKey === "customer" || entityKey === "vendor") && bpDetailFields.has(f)) {
      push(details, f)
      continue
    }

    if (f === "language_key" || f === "timezone" || isLocation(f)) {
      push(locationTimeLanguage, f)
      continue
    }

    if (entityKey === "legal-entity") {
      if (legalEntityFinanceFields.has(f)) {
        push(finance, f)
        continue
      }
      if (isFinance(f)) {
        push(finance, f)
        continue
      }
    }

    // product-line: the HS code link is managed via the "Assigned HS Code" card, not the header.
    if (entityKey === "product-line" && f === "product_category_id") {
      continue
    }
    // Parent pointer fields belong in Details, not Identifiers.
    if (f === "parent_category_id" || f === "parent_group_id" || f === "parent_line_id") {
      push(details, f)
    } else if (isIdentifier(f)) {
      push(identifiers, f)
    } else {
      push(details, f)
    }
  }

  const g: TopicGroup[] = []
  if (identifiers.length) g.push({ label: "Identifiers", fields: identifiers })
  if (schema.length) g.push({ label: "Schema", fields: schema })
  if (serviceGroup.length) {
    g.push({
      label: "Service",
      fields: [...serviceGroup].sort((a, b) => (serviceGroupOrder.get(a) ?? 99) - (serviceGroupOrder.get(b) ?? 99)),
    })
  }
  if (requirementGroup.length) {
    g.push({
      label: "Requirement",
      fields: [...requirementGroup].sort((a, b) => (requirementGroupOrder.get(a) ?? 99) - (requirementGroupOrder.get(b) ?? 99)),
    })
  }
  if (locationTimeLanguage.length) {
    g.push({
      label: "Location/Language/Time",
      fields: [...locationTimeLanguage].sort((a, b) => {
        const rankDiff = locationRank(a) - locationRank(b)
        return rankDiff !== 0 ? rankDiff : (fieldOrder.get(a) ?? 0) - (fieldOrder.get(b) ?? 0)
      }),
    })
  }
  if (finance.length) g.push({ label: "Finance", fields: finance })
  if (details.length) g.push({ label: "Details", fields: details })
  if (validity.length) g.push({ label: "Status & Validity", fields: validity })
  return g.length ? g : [{ label: "Information", fields }]
}

function normalizeAlpha2(code: unknown): string {
  const cc = String(code ?? "").trim().toUpperCase()
  return /^[A-Z]{2}$/.test(cc) ? cc : ""
}
// Flag image (emoji flags don't render on Windows, so use flagcdn images).
function FlagBadge({ code, className = "" }: { code: unknown; className?: string }): React.ReactNode {
  const cc = normalizeAlpha2(code)
  if (!cc) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center">
      <img src={`https://flagcdn.com/h24/${cc.toLowerCase()}.png`} alt={cc} title={cc} height={16} className={`inline-block h-4 w-auto rounded-[2px] ring-1 ring-border ${className}`}
        onError={(e) => { const img = e.currentTarget; img.style.display = "none"; const sib = img.nextElementSibling as HTMLElement | null; if (sib) sib.style.display = "inline" }} />
      <span style={{ display: "none" }} className="text-xs font-medium text-muted-foreground">{cc}</span>
    </span>
  )
}

const menuToEntity: Record<string, string> = {
  "mdm-province": "province",
  "mdm-legal-entity-bank": "legal-entity-bank",
  "mdm-legal-entity-tax": "legal-entity-tax",
  "mdm-legal-entity-address": "legal-entity-address",
  "mdm-legal-entity-contact": "legal-entity-contact",
  "mdm-delivery-org": "delivery-org",
  "mdm-delivery-office": "delivery-office",
  "mdm-delivery-team": "delivery-team",
  "mdm-delivery-channel": "delivery-channel",
  "mdm-sales-org": "sales-org",
  "mdm-sales-office": "sales-office",
  "mdm-sales-team": "sales-team",
  "mdm-sales-channel": "sales-channel",
  "mdm-purchase-org": "purchase-org",
  "mdm-purchase-office": "purchase-office",
  "mdm-purchase-team": "purchase-team",
  "mdm-purchase-channel": "purchase-channel",
  "mdm-legal-entity": "legal-entity",
  "mdm-division": "division",
  "mdm-cost-center": "cost-center",
  "mdm-profit-center": "profit-center",
  "mdm-credit-area": "credit-area",
  "mdm-controlling-area": "controlling-area",
  "mdm-cost-center-group": "cost-center-group",
  "mdm-country": "country",
  "mdm-city": "city",
  "mdm-product-category": "product-category",
  "mdm-feature-of-product": "feature-of-product",
  "mdm-product-line": "product-line",
  "mdm-jurisdiction": "jurisdiction",
  "mdm-authority": "authority",
  "mdm-master-client": "master-client",
  "mdm-customer": "customer",
  "mdm-customer-address": "customer-address",
  "mdm-customer-bank": "customer-bank",
  "mdm-customer-tax": "customer-tax",
  "mdm-customer-contact": "customer-contact",
  "mdm-customer-sales-channel": "customer-sales-channel",
  "mdm-vendor": "vendor",
  "mdm-vendor-address": "vendor-address",
  "mdm-vendor-bank": "vendor-bank",
  "mdm-vendor-tax": "vendor-tax",
  "mdm-vendor-contact": "vendor-contact",
  "mdm-vendor-purchase-channel": "vendor-purchase-channel",
  "mdm-material": "material",
  "mdm-currency": "currency",
  "mdm-exchange-rate": "exchange-rate",
  "mdm-price-list": "price-list",
  "mdm-price-list-item": "price-list-item",
  "mdm-service-item": "service-item",
  "mdm-service-domain": "service-domain",
  "mdm-deliverable": "deliverable",
  "mdm-cost-rate": "cost-rate",
  "mdm-service-item-deliverable": "service-item-deliverable",
  "mdm-service-item-dependency": "service-item-dependency",
  "mdm-regulation": "regulation",
  "mdm-regulation-source": "regulation-source",
  "mdm-regulation-ingest-run": "regulation-ingest-run",
  "mdm-regulation-version": "regulation-version",
  "mdm-regulation-source-snapshot": "regulation-source-snapshot",
  "mdm-regulation-chunk": "regulation-chunk",
  "mdm-regulation-summary": "regulation-summary",
  "mdm-regulation-memory": "regulation-memory",
  "mdm-regulation-relation": "regulation-relation",
  "mdm-standard": "standard",
  "mdm-standard-source": "standard-source",
  "mdm-standard-version": "standard-version",
  "mdm-standard-ingest-run": "standard-ingest-run",
  "mdm-standard-chunk": "standard-chunk",
  "mdm-requirement": "requirement",
  "mdm-requirement-service-item": "requirement-service-item",
  "mdm-regulation-change-event": "regulation-change-event",
  "mdm-product-category-feature": "product-category-feature",
  "mdm-product-line-feature": "product-line-feature",
  "mdm-discovery-feed": "discovery-feed",
  "mdm-discovery-run": "discovery-run",
  "mdm-activity": "activity",
  "mdm-service-bom": "service-bom",
  "mdm-service-bom-line": "service-bom-line",
  "mdm-bom-applicability-rule": "bom-applicability-rule",
  "mdm-service-bom-line-scope": "service-bom-line-scope",
  "mdm-bom-line-resource": "bom-line-resource",
  "mdm-service-item-regulation": "service-item-regulation",
  "mdm-service-item-standard": "service-item-standard",
  "mdm-change-log": "mdm-change-log",
  mdm: "service-item",
  // Compliance module (top-level, outside MDM)
  "compliance-regulation": "regulation",
  "compliance-standard": "standard",
  "compliance-requirement": "requirement",
  "compliance-requirement-service-item": "requirement-service-item",
  // Service Desk module (routed through MdmContent)
  "sd-tickets": "ticket",
  "sd-knowledge": "knowledge-article",
  "sd-ticket-category": "ticket-category",
  "sd-sla": "sla",
  sd: "ticket",
}

type QuotePreviewLine = { line_no: number; component_type: string; component_name: string; qty: number; uom: string; qty_formula: string | null; cost_driver: string | null; unit_cost: number; currency: string; cost: number; rate_code: string | null }
type QuotePreviewItem = {
  service_item_code: string; service_item_name: string; deliverable_type?: string; lead_time_days?: number
  driven_by_requirements: Array<{ code: string; jurisdiction: string }>
  bom_code: string | null; bom_missing: boolean; reuse_discount_pct: number
  lines: QuotePreviewLine[]; cost_by_currency: Record<string, number>
  price: { source: string; amount: number; currency: string; margin_pct?: number }
}
type QuotePreviewResult = { ok: boolean; detail?: string; itemCount: number; costTotals: Record<string, number>; items: QuotePreviewItem[] }

const QUOTE_PROFILE_EXAMPLE = JSON.stringify({ battery: { chemistry: "li-ion", capacity_wh: 95, cell_models: 2, pack_models: 1 }, model_variants: 1 }, null, 2)

function QuotationPreviewPanel() {
  const [jurisdictions, setJurisdictions] = useState("EU, US")
  const [hsCode, setHsCode] = useState("850760")
  const [category, setCategory] = useState("")
  const [marginPct, setMarginPct] = useState("30")
  const [profileText, setProfileText] = useState(QUOTE_PROFILE_EXAMPLE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<QuotePreviewResult | null>(null)

  async function runPreview(): Promise<void> {
    setError(""); setLoading(true); setResult(null)
    try {
      let profile: Record<string, unknown> = {}
      if (profileText.trim()) {
        try { profile = JSON.parse(profileText) } catch { setError("Product profile is not valid JSON"); setLoading(false); return }
      }
      const resp = await fetch("/api/proxy/api/v1/mdm/quotation/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jurisdictions: jurisdictions.split(",").map((j) => j.trim()).filter(Boolean),
          hsCode: hsCode.trim(),
          category: category.trim(),
          marginPct: Number(marginPct) || 30,
          profile,
        }),
      })
      const data = (await resp.json()) as QuotePreviewResult
      if (!resp.ok || !data.ok) setError(`Preview failed: ${data.detail ?? "unknown error"}`)
      else setResult(data)
    } catch (err) {
      setError(`Preview failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const money = (amount: number, currency: string): string => `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold">Quotation Preview</h2>
        <p className="text-sm text-muted-foreground">Product + target markets → applicable requirements → service items → parametric BOM cost rollup → price. Driven by the typed product profile (battery capacity, model counts, radios...).</p>
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Target markets (jurisdiction codes or IDs, comma-separated)</label>
          <input className={inputCls} value={jurisdictions} onChange={(e) => setJurisdictions(e.target.value)} placeholder="EU, US, jur-cn" />
          <label className="text-xs font-medium text-muted-foreground">HS code</label>
          <input className={inputCls} value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="850760" />
          <label className="text-xs font-medium text-muted-foreground">Category (optional)</label>
          <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="power-supply" />
          <label className="text-xs font-medium text-muted-foreground">Margin % (cost-plus fallback)</label>
          <input className={inputCls} value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Product profile (typed feature parameters, JSON)</label>
          <textarea className={`${inputCls} h-44 font-mono text-xs`} value={profileText} onChange={(e) => setProfileText(e.target.value)} />
          <button
            onClick={() => void runPreview()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "Calculating..." : "Preview Quotation"}
          </button>
        </div>
      </div>
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <span className="font-semibold">{result.itemCount} service item(s)</span>
            {Object.entries(result.costTotals).map(([currency, amount]) => (
              <span key={currency} className="font-semibold">Total cost: {money(Number(amount), currency)}</span>
            ))}
          </div>
          {result.items.map((item) => (
            <div key={item.service_item_code} className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
                <div>
                  <span className="font-semibold">{item.service_item_code}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{item.service_item_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {item.bom_code && <span>BOM: {item.bom_code}</span>}
                  {item.bom_missing && <span className="text-destructive">no BOM matched</span>}
                  {item.reuse_discount_pct > 0 && <span className="text-green-700">reuse discount {item.reuse_discount_pct}%</span>}
                  {typeof item.lead_time_days === "number" && item.lead_time_days > 0 && <span>{item.lead_time_days}d lead</span>}
                  <span className="font-semibold text-foreground">{money(item.price.amount, item.price.currency)} ({item.price.source === "price_list" ? "list" : `cost+${item.price.margin_pct ?? 0}%`})</span>
                </div>
              </div>
              <div className="px-4 py-2 text-xs text-muted-foreground">
                Driven by: {item.driven_by_requirements.map((r) => `${r.code} [${r.jurisdiction}]`).join(", ")}
              </div>
              {item.lines.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-t border-border text-left text-muted-foreground">
                      <th className="px-4 py-1.5">#</th><th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">Component</th>
                      <th className="px-2 py-1.5 text-right">Qty</th><th className="px-2 py-1.5">UoM</th><th className="px-2 py-1.5">Formula / driver</th>
                      <th className="px-2 py-1.5 text-right">Unit cost</th><th className="px-4 py-1.5 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.lines.map((line) => (
                      <tr key={line.line_no} className="border-t border-border/50">
                        <td className="px-4 py-1">{line.line_no}</td>
                        <td className="px-2 py-1">{line.component_type}</td>
                        <td className="px-2 py-1">{line.component_name}</td>
                        <td className="px-2 py-1 text-right">{line.qty}</td>
                        <td className="px-2 py-1">{line.uom}</td>
                        <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{line.qty_formula ?? line.cost_driver ?? ""}</td>
                        <td className="px-2 py-1 text-right">{money(line.unit_cost, line.currency)}</td>
                        <td className="px-4 py-1 text-right font-medium">{money(line.cost, line.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MdmContent({ activeItem }: { activeItem: string }) {
  if (activeItem === "mdm-quotation-preview") return <QuotationPreviewPanel />
  return <MdmContentInner activeItem={activeItem} />
}

function MdmContentInner({ activeItem }: { activeItem: string }) {
  const [entities, setEntities] = useState<EntityMeta[]>([])
  const [entity, setEntity] = useState("service-item")
  const [rows, setRows] = useState<RowData[]>([])
  const [globalSearch, setGlobalSearch] = useState("")
  const [conditions, setConditions] = useState<QueryCondition[]>([])
  const [conditionJoin, setConditionJoin] = useState<ConditionJoin>("and")
  const [queryGroup, setQueryGroup] = useState<QBGroup>(() => createDefaultQuery([]))
  const [message, setMessage] = useState("")
  const [csvText, setCsvText] = useState("")
  const [skipImportErrors, setSkipImportErrors] = useState(true)
  const [importActor, setImportActor] = useState("mdm-ui-import")
  const [editingId, setEditingId] = useState("")
  const [editDraft, setEditDraft] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<{ title: string; message: string; confirmLabel?: string; onConfirm: () => Promise<void> | void } | null>(null)
  const [columnMenuMode, setColumnMenuMode] = useState<ColumnMenuMode>("Default")
  const [menuColumn, setMenuColumn] = useState<string>("")
  const [selectedColumn, setSelectedColumn] = useState<string>("")
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<{ field: string; dir: "asc" | "desc" } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterMenuColumn, setFilterMenuColumn] = useState("")
  const fetchSeqRef = useRef(0)
  const rowClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedRowId, setSelectedRowId] = useState("")
  const [groupBy, setGroupBy] = useState("")
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [dragColumn, setDragColumn] = useState("")
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [activeViewId, setActiveViewId] = useState("")
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [regulationSyncLoading, setRegulationSyncLoading] = useState(false)
  const [requirementProposalLoading, setRequirementProposalLoading] = useState(false)
  const [standardRefreshLoading, setStandardRefreshLoading] = useState(false)
  const [discoveryRunLoading, setDiscoveryRunLoading] = useState(false)
  const [requirementReviewLoading, setRequirementReviewLoading] = useState(false)
  const [changeEventAckLoading, setChangeEventAckLoading] = useState(false)
  const [applicableSearchLoading, setApplicableSearchLoading] = useState(false)
  const [applicableDraft, setApplicableDraft] = useState({ jurisdiction: "", hsCode: "", category: "", effectiveOn: new Date().toISOString().slice(0, 10) })
  const [applicableResults, setApplicableResults] = useState<ApplicableRequirementResult[]>([])
  const [complianceOverview, setComplianceOverview] = useState<ComplianceOverview | null>(null)
  const [complianceOverviewLoading, setComplianceOverviewLoading] = useState(false)
  const [complianceFlowStats, setComplianceFlowStats] = useState<{
    regTotal: number; regLinked: number; stdTotal: number; stdLinked: number
    reqTotal: number; reqLinked: number; siTotal: number
  } | null>(null)
  const [outboxPublishLoading, setOutboxPublishLoading] = useState(false)
  const [regulationAdapters, setRegulationAdapters] = useState<RegulationSourceAdapter[]>([])
  const [rowDensity, setRowDensity] = useState<"compact" | "cozy">("cozy")
  const [columnPreset, setColumnPreset] = useState<"default" | "ops" | "minimal">("default")
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(320)
  const [showRightPanel, setShowRightPanel] = useState(false)
  // Collapsible left-panel sections (Query Conditions / Data Operations)
  const [querySectionOpen, setQuerySectionOpen] = useState(true)
  const [opsSectionOpen, setOpsSectionOpen] = useState(true)
  // Collapsible right-panel (Builder) sections
  const [gridSettingsOpen, setGridSettingsOpen] = useState(true)
  const [approvalsSectionOpen, setApprovalsSectionOpen] = useState(true)
  const [configSectionOpen, setConfigSectionOpen] = useState(false)
  const requestDeleteConfirm = (
    title: string,
    message: string,
    onConfirm: () => Promise<void> | void,
    confirmLabel: string = "Delete",
  ): void => {
    setDeleteConfirm({ title, message, confirmLabel, onConfirm })
  }
  const [healthSectionOpen, setHealthSectionOpen] = useState(false)
  const [pricingSectionOpen, setPricingSectionOpen] = useState(true)
  const [totalRows, setTotalRows] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [editWarnings, setEditWarnings] = useState<ApiFieldError[]>([])
  const [detailRow, setDetailRow] = useState<RowData | null>(null)
  const [detailTab, setDetailTab] = useState<"overview" | "changes" | "raw">("overview")
  // Double-click record view (Header tabs + Line/subtable tabs) shown in the grid area.
  const [recordView, setRecordView] = useState<{ row: RowData; entityKey: string } | null>(null)
  // Child-line count of the product line currently open in the record view; HS codes may
  // only be assigned to LEAF lines (lines with sub-lines aggregate, they don't map to HS).
  const [productLineChildCount, setProductLineChildCount] = useState<number | null>(null)
  // HS-coded product-category leaves linked to the open product line (category.product_line_id).
  const [productLineHsLeaves, setProductLineHsLeaves] = useState<RowData[]>([])
  const [productLineLeafRefresh, setProductLineLeafRefresh] = useState(0)
  useEffect(() => {
    const lineId = recordView?.entityKey === "product-line" ? String(recordView.row?.product_line_id ?? "") : ""
    if (!lineId) { setProductLineChildCount(null); setProductLineHsLeaves([]); return }
    let cancelled = false
    fetch(`/api/proxy/api/v1/mdm/product-line?limit=1000`)
      .then((resp) => resp.json())
      .then((data: { items?: RowData[]; rows?: RowData[] }) => {
        if (cancelled) return
        const lineRows = data.items ?? data.rows ?? []
        setProductLineChildCount(lineRows.filter((row) => String(row.parent_line_id ?? "") === lineId).length)
      })
      .catch(() => { if (!cancelled) setProductLineChildCount(null) })
    fetch(`/api/proxy/api/v1/mdm/product-category?limit=1000`)
      .then((resp) => resp.json())
      .then((data: { items?: RowData[]; rows?: RowData[] }) => {
        if (cancelled) return
        const catRows = data.items ?? data.rows ?? []
        setProductLineHsLeaves(catRows.filter((row) => String(row.product_line_id ?? "") === lineId && String(row.status ?? "") !== "archived"))
      })
      .catch(() => { if (!cancelled) setProductLineHsLeaves([]) })
    return () => { cancelled = true }
  }, [recordView, productLineLeafRefresh])

  function requestUnlinkProductLineHsLeaf(category: RowData): void {
    requestDeleteConfirm(
      "Confirm Removal",
      `Unlink HS product "${String(category.name ?? category.code ?? "")}" from this product line?`,
      async () => {
        const categoryId = String(category.product_category_id ?? "")
        if (!categoryId) return
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/product-category/${encodeURIComponent(categoryId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ product_line_id: "", updated_by: "mdm-ui" }),
          })
          const data = (await resp.json()) as { ok?: boolean; detail?: string }
          if (!resp.ok || data.ok === false) setMessage(`Unlink failed: ${data.detail ?? "unknown"}`)
          else {
            setMessage("HS product unlinked from product line")
            setProductLineLeafRefresh((n) => n + 1)
          }
        } catch (error) {
          setMessage(`Unlink failed: ${error instanceof Error ? error.message : "unknown error"}`)
        } finally {
          setRecordSaving(false)
        }
      }
    )
  }
  const [recordTab, setRecordTab] = useState("")
  const [recordLineTab, setRecordLineTab] = useState("")
  const [recordChildRows, setRecordChildRows] = useState<Record<string, RowData[]>>({})
  const [recordChildLoading, setRecordChildLoading] = useState("")
  const [headerDraft, setHeaderDraft] = useState<Record<string, string>>({})
  const [headerEditing, setHeaderEditing] = useState(false)
  const [lineDetail, setLineDetail] = useState<{ row: RowData; cfg: SubtableDef; isNew?: boolean } | null>(null)
  const [lineDraft, setLineDraft] = useState<Record<string, string>>({})
  const [lineEditing, setLineEditing] = useState(false)
  const [selectedLineId, setSelectedLineId] = useState("")
  const [recordSaving, setRecordSaving] = useState(false)
  const [lineGroupBy, setLineGroupBy] = useState("")
  const [lineDragCol, setLineDragCol] = useState("")
  const [lineSortBy, setLineSortBy] = useState<{ field: string; dir: "asc" | "desc" } | null>(null)
  const [lineColFilters, setLineColFilters] = useState<Record<string, string>>({})
  const [lineFilterMenuCol, setLineFilterMenuCol] = useState("")
  const [lineColWidths, setLineColWidths] = useState<Record<string, number>>({})
  const [gridColWidths, setGridColWidths] = useState<Record<string, number>>({})
  const [detailRowEntity, setDetailRowEntity] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const gridCardRef = useRef<HTMLDivElement | null>(null)
  const [drawerWidth, setDrawerWidth] = useState(420)
  const [previewAction, setPreviewAction] = useState<{ type: "archiveFiltered"; count: number } | null>(null)
  const [detailChanges, setDetailChanges] = useState<ChangeLogItem[]>([])
  const [detailChangesLoading, setDetailChangesLoading] = useState(false)
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [lookupOptions, setLookupOptions] = useState<Record<string, LookupOption[]>>({})
  // Fields that the loader recognized as FK/lookup columns — used so renderRecordField
  // still shows a dropdown (with a "no options yet" hint) when the target table is empty.
  const [lookupFields, setLookupFields] = useState<Set<string>>(new Set())
  // Raw rows for FK lookups, keyed by the local column name. Needed for cross-field
  // filters (e.g. delivery_team_id narrowed by delivery_office_id on delivery-channel,
  // and sales_team_id narrowed by sales_office_id on sales-channel).
  const [rawLookupRows, setRawLookupRows] = useState<Record<string, RowData[]>>({})
  // Tree view: which rows are expanded (one Set per render, by node id).
  const [expandedTreeIds, setExpandedTreeIds] = useState<Set<string>>(new Set())
  // Lazy tree: cache of children fetched on demand, keyed by parent node id.
  // A node's entry is undefined until its children are fetched; [] means "fetched, none".
  const [treeChildren, setTreeChildren] = useState<Record<string, RowData[]>>({})
  // Node ids whose children are currently being fetched (for a spinner / disabled toggle).
  const [treeLoadingIds, setTreeLoadingIds] = useState<Set<string>>(new Set())
  // Root nodes of the tree (parent is null/empty), loaded once per entity. null = not yet loaded.
  const [treeRoots, setTreeRoots] = useState<RowData[] | null>(null)
  // Assign-mode subtable: candidate child records the user can pick from.
  const [assignCandidates, setAssignCandidates] = useState<RowData[]>([])
  const [creditAreaLegalEntityOpen, setCreditAreaLegalEntityOpen] = useState(false)
  const [creditAreaLegalEntityDraft, setCreditAreaLegalEntityDraft] = useState("")
  const [creditAreaEntitySearch, setCreditAreaEntitySearch] = useState("")
  const [deliveryOfficeTeamOpen, setDeliveryOfficeTeamOpen] = useState(false)
  const [deliveryOfficeTeamDraft, setDeliveryOfficeTeamDraft] = useState("")
  const [deliveryOfficeTeamSearch, setDeliveryOfficeTeamSearch] = useState("")
  const [controllingAreaEntitySearch, setControllingAreaEntitySearch] = useState("")
  const [recordDetailsOpen, setRecordDetailsOpen] = useState(true)
  const [recordGroupOpen, setRecordGroupOpen] = useState<Record<string, boolean>>({})
  const [creditAreaLegalEntityCandidates, setCreditAreaLegalEntityCandidates] = useState<RowData[]>([])
  const [deliveryOfficeTeamCandidates, setDeliveryOfficeTeamCandidates] = useState<RowData[]>([])
  // Division ↔ Profit Center and Profit Center ↔ Cost Center: bespoke "Assign Entity"
  // cards mirroring Credit Area's Assigned Legal Entities UX, but FK-based (1:N —
  // assign PATCHes the child's FK to the parent id; remove clears it back to "").
  const [divisionProfitCenterOpen, setDivisionProfitCenterOpen] = useState(false)
  const [divisionProfitCenterDraft, setDivisionProfitCenterDraft] = useState("")
  const [divisionProfitCenterSearch, setDivisionProfitCenterSearch] = useState("")
  const [divisionProfitCenterCandidates, setDivisionProfitCenterCandidates] = useState<RowData[]>([])
  // Service BOM → Products (HS Codes) assign card: pick a product line, multi-select its HS codes.
  const [sbpAssignedProducts, setSbpAssignedProducts] = useState<RowData[]>([])
  const [sbpProductLines, setSbpProductLines] = useState<RowData[]>([])
  const [sbpSelectedLineId, setSbpSelectedLineId] = useState("")
  const [sbpLineHsCodes, setSbpLineHsCodes] = useState<RowData[]>([])
  const [sbpChecked, setSbpChecked] = useState<Set<string>>(new Set())
  const [sbpUnchecked, setSbpUnchecked] = useState<Set<string>>(new Set())
  const [sbpSaving, setSbpSaving] = useState(false)
  // Service BOM → Assign by Product Line: tree dialog state
  const [sbpTreeOpen, setSbpTreeOpen] = useState(false)
  const [sbpTreeCandidates, setSbpTreeCandidates] = useState<RowData[]>([])
  const [sbpTreeExpanded, setSbpTreeExpanded] = useState<Record<string, boolean>>({})
  const [sbpTreeSearch, setSbpTreeSearch] = useState("")
  const [sbpTreeChecked, setSbpTreeChecked] = useState<Set<string>>(new Set())
  // Regulation/Standard → Products (HS Codes) assign card: same pattern as service-bom.
  const [rspAssignedProducts, setRspAssignedProducts] = useState<RowData[]>([])
  const [rspProductLines, setRspProductLines] = useState<RowData[]>([])
  const [rspSelectedLineId, setRspSelectedLineId] = useState("")
  const [rspLineHsCodes, setRspLineHsCodes] = useState<RowData[]>([])
  const [rspChecked, setRspChecked] = useState<Set<string>>(new Set())
  const [rspUnchecked, setRspUnchecked] = useState<Set<string>>(new Set())
  const [rspSaving, setRspSaving] = useState(false)
  const [rspTreeOpen, setRspTreeOpen] = useState(false)
  const [rspTreeCandidates, setRspTreeCandidates] = useState<RowData[]>([])
  const [rspTreeExpanded, setRspTreeExpanded] = useState<Record<string, boolean>>({})
  const [rspTreeSearch, setRspTreeSearch] = useState("")
  const [rspTreeChecked, setRspTreeChecked] = useState<Set<string>>(new Set())
  const [profitCenterCostCenterOpen, setProfitCenterCostCenterOpen] = useState(false)
  const [profitCenterCostCenterDraft, setProfitCenterCostCenterDraft] = useState("")
  const [profitCenterCostCenterSearch, setProfitCenterCostCenterSearch] = useState("")
  const [profitCenterCostCenterCandidates, setProfitCenterCostCenterCandidates] = useState<RowData[]>([])
  // Master Client → Customer: assign a customer to a master client (1:N via FK master_client_id on mdm_customer).
  const [masterClientCustomerOpen, setMasterClientCustomerOpen] = useState(false)
  const [masterClientCustomerDraft, setMasterClientCustomerDraft] = useState("")
  const [masterClientCustomerSearch, setMasterClientCustomerSearch] = useState("")
  const [masterClientCustomerCandidates, setMasterClientCustomerCandidates] = useState<RowData[]>([])
  // Product Line → Product Category: assign a category to a product line (1:N via FK product_category_id on mdm_product_line).
  const [productLineProductCategoryOpen, setProductLineProductCategoryOpen] = useState(false)
  const [productLineProductCategoryDraft, setProductLineProductCategoryDraft] = useState("")
  const [productLineProductCategoryCandidates, setProductLineProductCategoryCandidates] = useState<RowData[]>([])
  const [productLineCategoryTreeExpanded, setProductLineCategoryTreeExpanded] = useState<Record<string, boolean>>({})
  const [productLineCategoryTreeSearch, setProductLineCategoryTreeSearch] = useState("")
  // Legal Entity ↔ Cost Center / Profit Center inline assign panels
  const [leCostCenterOpen, setLeCostCenterOpen] = useState(false)
  const [leCostCenterDraft, setLeCostCenterDraft] = useState("")
  const [leCostCenterSearch, setLeCostCenterSearch] = useState("")
  const [leCostCenterCandidates, setLeCostCenterCandidates] = useState<RowData[]>([])
  // Cost Center Group ↔ Cost Center: many-to-many via the cost-center-group-map join
  // table — same shape as Credit Area ↔ Legal Entity. Rendered as a bespoke "Assigned
  // Cost Centers" card (Assigned X + Scope cards + assign dialog), mirroring the
  // Office → Team "assign" feature design used by delivery/sales/purchase office.
  const [costCenterGroupCostCenterOpen, setCostCenterGroupCostCenterOpen] = useState(false)
  const [costCenterGroupCostCenterDraft, setCostCenterGroupCostCenterDraft] = useState("")
  const [costCenterGroupCostCenterSearch, setCostCenterGroupCostCenterSearch] = useState("")
  const [costCenterGroupCostCenterCandidates, setCostCenterGroupCostCenterCandidates] = useState<RowData[]>([])
  const [creditAreaConfigs, setCreditAreaConfigs] = useState<Record<string, CreditAreaConfig>>({})
  // Inline managed-enum editor (admin only): which field's popover is open, and the new-value draft.
  const [managingEnumField, setManagingEnumField] = useState<string>("")
  // Fixed-position anchor for the manage-options popover so it floats on the top
  // layer of the page instead of being clipped by section containers.
  const [enumMgrPos, setEnumMgrPos] = useState<{ top: number; left: number } | null>(null)
  // Entity-managed FK fields (jurisdiction, authority): same ⚙ gear UI as
  // managed enums, but backed by entity CRUD instead of the enum API.
  const [entityMgrField, setEntityMgrField] = useState<string>("")
  const [entityMgrDraft, setEntityMgrDraft] = useState<Record<string, string>>({})
  const [entityMgrBusy, setEntityMgrBusy] = useState(false)
  // Country-scoped geography lookups for address forms: provinces/states (Region
  // dropdown) and cities (City dropdown), cached per "<kind>:<COUNTRY>".
  const [geoOptions, setGeoOptions] = useState<Record<string, Array<{ value: string; label: string }>>>({})
  const geoFetchInFlight = useRef<Set<string>>(new Set())
  function ensureGeoOptions(kind: "province" | "city", country: string): void {
    const key = `${kind}:${country}`
    if (!country || geoOptions[key] || geoFetchInFlight.current.has(key)) return
    geoFetchInFlight.current.add(key)
    void (async () => {
      try {
        const conditions = encodeURIComponent(JSON.stringify([{ field: "country_code", op: "eq", value: country }]))
        const resp = await fetch(`/api/proxy/api/v1/mdm/${kind}?limit=500&offset=0&status=active&conditions=${conditions}`)
        const data = (await resp.json()) as { items?: RowData[] }
        const items = (data.items ?? [])
          .map((r) => String(r.name_en ?? "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((name) => ({ value: name, label: name }))
        setGeoOptions((prev) => ({ ...prev, [key]: items }))
      } catch {
        setGeoOptions((prev) => ({ ...prev, [key]: [] }))
      } finally {
        geoFetchInFlight.current.delete(key)
      }
    })()
  }
  const [enumNewValue, setEnumNewValue] = useState<string>("")
  const [enumNewLabel, setEnumNewLabel] = useState<string>("")
  const [enumOpBusy, setEnumOpBusy] = useState<boolean>(false)
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
  const [roleMode] = useState<RoleMode>("admin")
  const [scopeMode] = useState<ScopeMode>("tenant")
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
  const [pricingWorkbench, setPricingWorkbench] = useState<{ serviceItemCode: string; priceListCode: string; asOf: string }>({
    serviceItemCode: "",
    priceListCode: "",
    asOf: new Date().toISOString().slice(0, 10),
  })
  const [pricingResolveLoading, setPricingResolveLoading] = useState(false)
  const [pricingResolveError, setPricingResolveError] = useState("")
  const [pricingResolveResult, setPricingResolveResult] = useState<Record<string, unknown> | null>(null)
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
  const entityHiddenColumns = useMemo(() => getEntityHiddenColumns(entity), [entity])
  const baseColumns = useMemo(
    () => (activeMeta?.columns ?? []).filter((c) => !entityHiddenColumns.includes(c)),
    [activeMeta, entityHiddenColumns]
  )
  const idColumn = activeMeta?.idColumn ?? `${entity.replace(/-/g, "_")}_id`
  const showFlagColumn = (activeMeta?.columns ?? []).includes("alpha2")
  const queryFields = useMemo(() => {
    const base = baseColumns
    const sys = ["status", "valid_from", "valid_to", idColumn]
    return Array.from(new Set([...base, ...sys]))
  }, [baseColumns, idColumn])
  const mdmQueryFields = useMemo<QBField[]>(() => {
    return queryFields.map((f) => {
      if (f === "status") return { field: f, label: humanizeLabel(f), type: "select" as const, options: ["active", "draft", "inactive"] }
      if (f === "valid_from" || f === "valid_to") return { field: f, label: humanizeLabel(f), type: "date" as const }
      return { field: f, label: humanizeLabel(f), type: "string" as const }
    })
  }, [queryFields])
  const createFields = useMemo(() => {
    const hidden = new Set(HIDDEN_CREATE_FIELDS[entity] ?? [])
    const visible = baseColumns.filter((c) => !hidden.has(c))
    // Per-entity field count for the Add modal. Bumped for entities that need to
    // expose more than the default 6 columns (e.g. delivery-channel/sales-channel/
    // purchase-channel bundle LE + Org + Office + Team + currency).
    const limit = entity === "delivery-office" ? 7 : entity === "delivery-channel" || entity === "sales-channel" || entity === "purchase-channel" ? 9 : 6
    return visible.slice(0, limit)
  }, [baseColumns, entity])
  const requiredCreateFields = useMemo(
    () => {
      const override = REQUIRED_CREATE_FIELDS[entity]
      if (override?.length) return createFields.filter((f) => override.includes(f))
      if (validationSchema?.requiredFields?.length) return createFields.filter((f) => validationSchema.requiredFields.includes(f))
      return createFields.filter((f) => /(^code$|_code$|(^name$|_name$)|title)/i.test(f))
    },
    [createFields, validationSchema, entity]
  )
  const optionalCreateFields = useMemo(
    () => createFields.filter((f) => !requiredCreateFields.includes(f)),
    [createFields, requiredCreateFields]
  )

  useEffect(() => {
    const base = baseColumns.slice(0, 6)
    if (!base.length) return
    setColumnOrder((prev) => {
      if (!prev.length) return base
      const kept = prev.filter((c) => base.includes(c))
      const missing = base.filter((c) => !kept.includes(c))
      return [...kept, ...missing]
    })
  }, [baseColumns])

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
    setRecordView(null)
    setShowLeftPanel(false)   // hide Query + Builder panels by default on menu switch
    setShowRightPanel(false)
    if (activeItem === "mdm-compliance-dashboard" || activeItem === "compliance-dashboard") {
      void loadComplianceOverview()
      void loadComplianceFlowStats()
      return
    }
    if (nextEntity) {
      void loadEntity(nextEntity)
      if (nextEntity === "regulation-source") void loadRegulationAdapters()
    }
  }, [activeItem])

  useEffect(() => {
    if (recordView) {
      setShowLeftPanel(false)
      setShowRightPanel(false)
    }
  }, [recordView])

  useEffect(() => {
    if (!rows.length) return
    const first = rows[0] as Record<string, unknown>
    if (entity === "service-item") {
      const nextCode = String(first.service_item_code ?? first.service_item_id ?? "").trim()
      if (nextCode) {
        setPricingWorkbench((prev) => ({ ...prev, serviceItemCode: prev.serviceItemCode || nextCode }))
      }
    } else if (entity === "price-list") {
      const nextCode = String(first.price_list_code ?? first.price_list_id ?? "").trim()
      if (nextCode) {
        setPricingWorkbench((prev) => ({ ...prev, priceListCode: prev.priceListCode || nextCode }))
      }
    }
  }, [entity, rows])

  useEffect(() => {
    if (!detailRow) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (drawerRef.current?.contains(t)) return
      if (gridCardRef.current?.contains(t)) return
      setDetailRow(null)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [detailRow])

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

  async function resolvePricingWorkbench(): Promise<void> {
    if (!pricingWorkbench.serviceItemCode.trim() && !pricingWorkbench.priceListCode.trim()) {
      setPricingResolveError("Enter a service item code or price list code.")
      return
    }
    setPricingResolveLoading(true)
    setPricingResolveError("")
    try {
      const params = new URLSearchParams()
      if (pricingWorkbench.serviceItemCode.trim()) params.set("service_item_code", pricingWorkbench.serviceItemCode.trim())
      if (pricingWorkbench.priceListCode.trim()) params.set("price_list_code", pricingWorkbench.priceListCode.trim())
      if (pricingWorkbench.asOf.trim()) params.set("as_of", pricingWorkbench.asOf.trim())
      const resp = await fetch(`/api/proxy/api/v1/mdm/pricing/resolve?${params.toString()}`)
      const data = (await resp.json()) as Record<string, unknown> & { ok?: boolean; detail?: string }
      if (!resp.ok || data.ok === false) throw new Error(String(data.detail ?? "Unable to resolve pricing"))
      setPricingResolveResult(data)
    } catch (error) {
      setPricingResolveResult(null)
      setPricingResolveError(error instanceof Error ? error.message : "Unable to resolve pricing")
    } finally {
      setPricingResolveLoading(false)
    }
  }

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
    // Tree entities load lazily (roots first, children on expand) instead of
    // offset pagination, so the whole hierarchy is navigable regardless of size.
    if (TREE_ENTITIES[entity]) {
      void loadTreeRoots(entity)
      return
    }
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
    // Include columns of any child entities (subtable line forms reuse renderRecordField),
    // so dropdowns like bank_country_code / tax_country_code on legal-entity-bank/tax light up.
    const childKeys = (SUBTABLES[entity] ?? []).map((s) => s.childEntity)
    const childCols = childKeys.flatMap((k) => (entities.find((e) => e.key === k)?.columns ?? []))
    const cols = Array.from(new Set([...baseColumns, ...childCols]))
    const fkCols = cols.filter((c) => c.endsWith("_id") && c !== idColumn)
    // Code-reference columns resolve to the currency/country masters (value = the code).
    const CODE_REF: Record<string, { entity: string; valueCol: string }> = {
      from_currency: { entity: "currency", valueCol: "alpha_code" },
      to_currency: { entity: "currency", valueCol: "alpha_code" },
      currency_code: { entity: "currency", valueCol: "alpha_code" },
      base_currency_code: { entity: "currency", valueCol: "alpha_code" },
      country_code: { entity: "country", valueCol: "alpha2" },
      bank_country_code: { entity: "country", valueCol: "alpha2" },
      tax_country_code: { entity: "country", valueCol: "alpha2" },
      incorporation_country_code: { entity: "country", valueCol: "alpha2" },
      // Credit Control Area on legal-entity is a code that should resolve to mdm_credit_area.code.
      credit_control_area: { entity: "credit-area", valueCol: "code" },
    }
    const codeRefCols = cols.filter((c) => CODE_REF[c])
    // owner_user_id (and similar *_user_id, including legal-entity-contact's contact_user_id)
    // resolves to the IAM user directory so the grid/forms show "Display Name <email>".
    const userRefCols = cols.filter((c) => c === "owner_user_id" || c === "manager_user_id" || c === "assignee_user_id" || c === "contact_user_id")
    // Managed-enum columns: any column whose name appears in MANAGED_ENUMS (with
    // entity-specific overrides), present in either the entity's or child's columns.
    const managedCols = cols.filter((c) => getManagedEnumKey(c, entity))
    if (!fkCols.length && !codeRefCols.length && !userRefCols.length && !managedCols.length) {
      setLookupOptions({})
      return
    }
    void (async () => {
      const next: Record<string, LookupOption[]> = {}
      // IAM users — single fetch reused for all *_user_id columns on this entity.
      if (userRefCols.length > 0) {
        try {
          const resp = await fetch(`/api/proxy/api/v1/iam/users`)
          const data = (await resp.json()) as { items?: Array<{ user_id: string; display_name?: string; email?: string }> }
          const items = (data.items ?? []).map((u) => ({
            value: String(u.user_id),
            label: [u.display_name, u.email ? `<${u.email}>` : ""].filter(Boolean).join(" ") || String(u.user_id),
          }))
          for (const col of userRefCols) next[col] = items
        } catch {
          for (const col of userRefCols) next[col] = []
        }
      }
      for (const col of managedCols) {
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm-enum/${encodeURIComponent(getManagedEnumKey(col, entity)!)}`)
          const data = (await resp.json()) as { items?: Array<{ value: string; label: string }> }
          next[col] = (data.items ?? []).map((it) => ({ value: String(it.value), label: String(it.label || it.value) }))
        } catch {
          next[col] = []
        }
      }
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
      const rawByCol: Record<string, RowData[]> = {}
      for (const col of fkCols) {
        const targetEntity = inferTargetEntityKey(col)
        if (!targetEntity) continue
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(targetEntity)}?limit=500&offset=0`)
          const data = (await resp.json()) as { items?: RowData[] }
          const items = data.items ?? []
          rawByCol[col] = items
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
          rawByCol[col] = []
        }
      }
      setRawLookupRows(rawByCol)
      setLookupOptions(next)
      // Remember every field that should render as a dropdown — even if the target
      // table has no rows yet, we want to show "— Select —" rather than free text.
      const fkSet = new Set<string>([
        ...managedCols,
        ...codeRefCols,
        ...userRefCols,
        ...fkCols,
      ])
      setLookupFields(fkSet)
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
    // Tree entities don't offset-paginate; refresh by reloading roots (and any
    // previously expanded branches stay refetchable). Keeps all existing refresh
    // call-sites working for the tree without special-casing each one.
    if (TREE_ENTITIES[entityKey]) {
      await loadTreeRoots(entityKey)
      return
    }
    const seq = ++fetchSeqRef.current
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
      if (seq !== fetchSeqRef.current) return
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
      if (seq !== fetchSeqRef.current) return
      const detail = error instanceof Error ? error.message : "Query failed"
      setMessage(`Load failed: ${detail}`)
      setRows([])
      setTotalRows(0)
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false)
    }
  }

  // ---- Lazy tree fetching (tree entities only) -------------------------------
  // Fetch a single level of the hierarchy via the existing conditions API.
  // parentId === null => root level (parent field empty). Returns the rows.
  async function fetchTreeLevel(entityKey: string, parentId: string | null): Promise<RowData[]> {
    const treeCfg = TREE_ENTITIES[entityKey]
    if (!treeCfg) return []
    const { search, status, valid_from_from, valid_to_to } = deriveApiFilters()
    const query = new URLSearchParams()
    // No page limit on the tree: pull a full level (levels are small: <=97 roots,
    // <=~60 children per node for HS). 1000 is a safe ceiling well under backend's 5000.
    query.set("limit", "1000")
    query.set("offset", "0")
    if (search) query.set("search", search)
    if (status) query.set("status", status)
    if (valid_from_from) query.set("valid_from_from", valid_from_from)
    if (valid_to_to) query.set("valid_to_to", valid_to_to)
    const conds: Array<{ field: string; op: string; value: string }> = []
    if (parentId === null) conds.push({ field: treeCfg.parentField, op: "empty", value: "" })
    else conds.push({ field: treeCfg.parentField, op: "eq", value: parentId })
    const activeConds = conditions.filter((c) => c.field && c.op)
    for (const c of activeConds) conds.push({ field: c.field, op: c.op, value: c.value })
    query.set("conditions", JSON.stringify(conds))
    query.set("condition_join", "and")
    if (sortBy?.field) query.set("sort_by", sortBy.field)
    query.set("sort_dir", sortBy?.dir ?? "asc")
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entityKey)}?${query.toString()}`)
    const text = await resp.text()
    if (!text) return []
    const data = JSON.parse(text) as { items?: RowData[] }
    return data.items ?? []
  }

  async function loadTreeRoots(entityKey: string): Promise<void> {
    setIsLoading(true)
    try {
      const roots = await fetchTreeLevel(entityKey, null)
      setTreeRoots(roots)
      setTreeChildren({})
      setExpandedTreeIds(new Set())
    } catch {
      setTreeRoots([])
      setMessage("Failed to load category tree")
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleTreeNode(entityKey: string, nodeId: string): Promise<void> {
    // Collapse if already expanded.
    if (expandedTreeIds.has(nodeId)) {
      setExpandedTreeIds((prev) => { const n = new Set(prev); n.delete(nodeId); return n })
      return
    }
    // Expand: fetch children once, then cache.
    if (treeChildren[nodeId] === undefined && !treeLoadingIds.has(nodeId)) {
      setTreeLoadingIds((prev) => new Set(prev).add(nodeId))
      try {
        const kids = await fetchTreeLevel(entityKey, nodeId)
        setTreeChildren((prev) => ({ ...prev, [nodeId]: kids }))
      } catch {
        setTreeChildren((prev) => ({ ...prev, [nodeId]: [] }))
      } finally {
        setTreeLoadingIds((prev) => { const n = new Set(prev); n.delete(nodeId); return n })
      }
    }
    setExpandedTreeIds((prev) => new Set(prev).add(nodeId))
  }

  async function loadEntity(entityKey: string): Promise<void> {
    setEntity(entityKey)
    setEditingId("")
    setEditDraft({})
    setSelectedRowId("")
    setSelectedRowIds([])
    setCreateModalOpen(false)
    setEditModalOpen(false)
    setEditTargetRow(null)
    setInlineAddMode(false)
    setInlineDraft({})
    setInlineErrors({})
    setShowBulkActions(false)
    setRowActionMenuId("")
    setHeaderEditing(false)
    setHeaderDraft({})
    setLineDetail(null)
    setLineDraft({})
    setLineEditing(false)
    setSelectedLineId("")
    setCreditAreaLegalEntityOpen(false)
    setCreditAreaLegalEntityDraft("")
    setCreditAreaLegalEntityCandidates([])
    setDeliveryOfficeTeamOpen(false)
    setDeliveryOfficeTeamDraft("")
    setDeliveryOfficeTeamCandidates([])
    setDivisionProfitCenterOpen(false)
    setDivisionProfitCenterDraft("")
    setDivisionProfitCenterCandidates([])
    setProfitCenterCostCenterOpen(false)
    setProfitCenterCostCenterDraft("")
    setProfitCenterCostCenterCandidates([])
    setRecordChildRows({})
    setRecordChildLoading("")
    setPage(1)
    setHiddenColumns([...GRID_LIFECYCLE_COLUMNS])
    setGridColWidths({})
    setPolicyDraft((prev) => ({ ...prev, entity_key: entityKey }))
    await fetchEntityRows(entityKey, 1, pageSize)
  }

  function startResizeDrawer(e: React.MouseEvent): void {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => { const max = Math.floor(window.innerWidth / 3); setDrawerWidth(Math.min(max, Math.max(360, window.innerWidth - ev.clientX))) }
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp)
  }

  function rowDraftFromRecord(meta: EntityMeta | undefined, row: RowData): Record<string, string> {
    const d: Record<string, string> = {}
    const hidden = new Set(getEntityHiddenColumns(meta?.key ?? ""))
    for (const f of [...(meta?.columns ?? []).filter((c) => !hidden.has(c)), "status", "valid_from", "valid_to"]) d[f] = String(row[f] ?? "")
    // Open-ended validity default (SAP-style) when the row has no end date yet.
    if (!d.valid_to) d.valid_to = "9999-12-31"
    d.valid_to = toDateInputValue(d.valid_to, "9999-12-31")
    return d
  }
  function childIdCol(entityKey: string): string {
    return entities.find((e) => e.key === entityKey)?.idColumn ?? `${entityKey.replace(/-/g, "_")}_id`
  }

  function parseAssignTargets(value: unknown): string[] {
    try {
      const parsed = JSON.parse(String(value ?? "[]")) as unknown
      return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : []
    } catch {
      return []
    }
  }

  function defaultCreditAreaConfig(): CreditAreaConfig {
    return {
      openQuotation: false,
      openInvoice: false,
      openProjects: false,
      restrictQuotation: false,
      restrictOrder: false,
      restrictProjectExecution: false,
      restrictDeliverableIssue: false,
    }
  }

  function creditAreaConfigFor(row: RowData): CreditAreaConfig {
    const id = String(row.credit_area_id ?? "")
    return creditAreaConfigs[id] ?? defaultCreditAreaConfig()
  }

  function updateCreditAreaConfig(row: RowData, patch: Partial<CreditAreaConfig>): void {
    const id = String(row.credit_area_id ?? "")
    if (!id) return
    setCreditAreaConfigs((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultCreditAreaConfig()), ...patch } }))
  }

  function openCreditAreaLegalEntityDialog(row: RowData): void {
    void row
    setCreditAreaLegalEntityOpen(true)
    setCreditAreaLegalEntityDraft("")
    void (async () => {
      try {
        const resp = await fetch("/api/proxy/api/v1/mdm/legal-entity?limit=500&offset=0")
        const data = (await resp.json()) as { items?: RowData[] }
        setCreditAreaLegalEntityCandidates(data.items ?? [])
      } catch {
        setCreditAreaLegalEntityCandidates([])
      }
    })()
  }

  // Many-to-many: add a row to the credit-area-legal-entity join table.
  async function assignCreditAreaLegalEntity(row: RowData, legalEntityId?: string): Promise<void> {
    const creditAreaId = String(row.credit_area_id ?? "")
    const leId = (legalEntityId ?? creditAreaLegalEntityDraft).trim()
    if (!creditAreaId || !leId) { setMessage("Pick a legal entity to assign."); return }
    setRecordSaving(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm/credit-area-legal-entity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credit_area_id: creditAreaId, legal_entity_id: leId, created_by: "mdm-ui", updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
      setCreditAreaLegalEntityDraft("")
      setCreditAreaLegalEntityOpen(false)
      setMessage("Legal entity assigned")
      refreshRecordChildren(SUBTABLES["credit-area"] ?? [], row)
    } finally { setRecordSaving(false) }
  }

  // Remove a single legal-entity assignment (join row) from a credit area.
  function requestRemoveCreditAreaLegalEntity(joinRow: RowData, parentRow: RowData): void {
    requestDeleteConfirm(
      "Confirm Removal",
      "Remove this legal entity from the credit area?",
      async () => {
        const joinId = String(joinRow.credit_area_legal_entity_id ?? "")
        if (!joinId) return
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/credit-area-legal-entity/${encodeURIComponent(joinId)}?updated_by=mdm-ui`, { method: "DELETE" })
          const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; detail?: string }
          if (!resp.ok || data.ok === false) { setMessage(`Remove failed: ${data.detail ?? "unknown"}`); return }
          setMessage("Legal entity removed")
          refreshRecordChildren(SUBTABLES["credit-area"] ?? [], parentRow)
        } finally { setRecordSaving(false) }
      },
      "Remove",
    )
  }

  // Cost Center Group ↔ Cost Center: many-to-many via the cost-center-group-map join table —
  // mirrors the credit-area ↔ legal-entity assign/remove flow above, just for cost centers.
  function openCostCenterGroupCostCenterDialog(row: RowData): void {
    void row
    setCostCenterGroupCostCenterOpen(true)
    setCostCenterGroupCostCenterDraft("")
    void (async () => {
      try {
        const resp = await fetch("/api/proxy/api/v1/mdm/cost-center?limit=500&offset=0")
        const data = (await resp.json()) as { items?: RowData[] }
        setCostCenterGroupCostCenterCandidates(data.items ?? [])
      } catch {
        setCostCenterGroupCostCenterCandidates([])
      }
    })()
  }

  function refreshCostCenterGroupCostCenters(row: RowData): void {
    refreshRecordChildren(SUBTABLES["cost-center-group"] ?? [], row)
    void (async () => {
      try {
        const resp = await fetch("/api/proxy/api/v1/mdm/cost-center?limit=500&offset=0")
        const data = (await resp.json()) as { items?: RowData[] }
        setCostCenterGroupCostCenterCandidates(data.items ?? [])
      } catch { /* keep prior candidates on failure */ }
    })()
  }

  async function assignCostCenterGroupCostCenter(row: RowData, costCenterId?: string): Promise<void> {
    const groupId = String(row.cost_center_group_id ?? "")
    const ccId = (costCenterId ?? costCenterGroupCostCenterDraft).trim()
    if (!groupId || !ccId) { setMessage("Pick a cost center to assign."); return }
    setRecordSaving(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm/cost-center-group-map", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cost_center_group_id: groupId, cost_center_id: ccId, created_by: "mdm-ui", updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
      setCostCenterGroupCostCenterDraft("")
      setCostCenterGroupCostCenterOpen(false)
      setMessage("Cost center assigned")
      refreshCostCenterGroupCostCenters(row)
    } finally { setRecordSaving(false) }
  }

  function requestRemoveCostCenterGroupCostCenter(mappingRow: RowData, parentRow: RowData): void {
    requestDeleteConfirm(
      "Confirm Removal",
      "Remove this cost center from the group?",
      async () => {
        const mappingId = String(mappingRow.cost_center_group_map_id ?? "")
        if (!mappingId) return
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/cost-center-group-map/${encodeURIComponent(mappingId)}?updated_by=mdm-ui`, { method: "DELETE" })
          const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; detail?: string }
          if (!resp.ok || data.ok === false) { setMessage(`Remove failed: ${data.detail ?? "unknown"}`); return }
          setMessage("Cost center removed")
          refreshCostCenterGroupCostCenters(parentRow)
        } finally { setRecordSaving(false) }
      },
      "Remove",
    )
  }

  // Division ↔ Profit Center: 1:N via FK (division_id on mdm_profit_center). Assign = PATCH the
  // child's FK to the parent id; remove = clear it back to "" — mirrors assignMode SUBTABLES logic
  // but rendered as a bespoke "Assigned ..." card (per Credit Area UX).
  function openDivisionProfitCenterDialog(row: RowData): void {
    void row
    setDivisionProfitCenterOpen(true)
    setDivisionProfitCenterDraft("")
    void (async () => {
      try {
        const resp = await fetch("/api/proxy/api/v1/mdm/profit-center?limit=500&offset=0")
        const data = (await resp.json()) as { items?: RowData[] }
        setDivisionProfitCenterCandidates(data.items ?? [])
      } catch {
        setDivisionProfitCenterCandidates([])
      }
    })()
  }

  async function assignDivisionProfitCenter(row: RowData, profitCenterId?: string): Promise<void> {
    const divisionId = String(row.division_id ?? "")
    const pcId = (profitCenterId ?? divisionProfitCenterDraft).trim()
    if (!divisionId || !pcId) { setMessage("Pick a profit center to assign."); return }
    const candidate = divisionProfitCenterCandidates.find((c) => String(c.profit_center_id ?? "") === pcId)
    setRecordSaving(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/profit-center/${encodeURIComponent(pcId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ division_id: divisionId, version_no: Number(candidate?.version_no ?? 1), updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
      setDivisionProfitCenterDraft("")
      setDivisionProfitCenterOpen(false)
      setMessage("Profit center assigned")
      refreshRecordChildren(SUBTABLES["division"] ?? [], row)
    } finally { setRecordSaving(false) }
  }

  function requestRemoveDivisionProfitCenter(entityRow: RowData, parentRow: RowData): void {
    requestDeleteConfirm(
      "Confirm Removal",
      "Remove this profit center from the division?",
      async () => {
        const pcId = String(entityRow.profit_center_id ?? "")
        if (!pcId) return
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/profit-center/${encodeURIComponent(pcId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ division_id: "", version_no: Number(entityRow.version_no ?? 1), updated_by: "mdm-ui" }),
          })
          const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; detail?: string }
          if (!resp.ok || data.ok === false) { setMessage(`Remove failed: ${data.detail ?? "unknown"}`); return }
          setMessage("Profit center removed")
          refreshRecordChildren(SUBTABLES["division"] ?? [], parentRow)
        } finally { setRecordSaving(false) }
      },
      "Remove",
    )
  }

  // Profit Center ↔ Cost Center: 1:N via FK (profit_center_id on mdm_cost_center), same pattern.
  function openProfitCenterCostCenterDialog(row: RowData): void {
    void row
    setProfitCenterCostCenterOpen(true)
    setProfitCenterCostCenterDraft("")
    void (async () => {
      try {
        const resp = await fetch("/api/proxy/api/v1/mdm/cost-center?limit=500&offset=0")
        const data = (await resp.json()) as { items?: RowData[] }
        setProfitCenterCostCenterCandidates(data.items ?? [])
      } catch {
        setProfitCenterCostCenterCandidates([])
      }
    })()
  }

  async function assignProfitCenterCostCenter(row: RowData, costCenterId?: string): Promise<void> {
    const profitCenterId = String(row.profit_center_id ?? "")
    const ccId = (costCenterId ?? profitCenterCostCenterDraft).trim()
    if (!profitCenterId || !ccId) { setMessage("Pick a cost center to assign."); return }
    const candidate = profitCenterCostCenterCandidates.find((c) => String(c.cost_center_id ?? "") === ccId)
    setRecordSaving(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/cost-center/${encodeURIComponent(ccId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profit_center_id: profitCenterId, version_no: Number(candidate?.version_no ?? 1), updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
      setProfitCenterCostCenterDraft("")
      setProfitCenterCostCenterOpen(false)
      setMessage("Cost center assigned")
      refreshRecordChildren(SUBTABLES["profit-center"] ?? [], row)
    } finally { setRecordSaving(false) }
  }

  function requestRemoveProfitCenterCostCenter(entityRow: RowData, parentRow: RowData): void {
    requestDeleteConfirm(
      "Confirm Removal",
      "Remove this cost center from the profit center?",
      async () => {
        const ccId = String(entityRow.cost_center_id ?? "")
        if (!ccId) return
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/cost-center/${encodeURIComponent(ccId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ profit_center_id: "", version_no: Number(entityRow.version_no ?? 1), updated_by: "mdm-ui" }),
          })
          const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; detail?: string }
          if (!resp.ok || data.ok === false) { setMessage(`Remove failed: ${data.detail ?? "unknown"}`); return }
          setMessage("Cost center removed")
          refreshRecordChildren(SUBTABLES["profit-center"] ?? [], parentRow)
        } finally { setRecordSaving(false) }
      },
      "Remove",
    )
  }

  // ── Master Client → Customer assign helpers ──
  function openMasterClientCustomerDialog(row: RowData): void {
    void row
    setMasterClientCustomerOpen(true)
    setMasterClientCustomerDraft("")
    void (async () => {
      try {
        const resp = await fetch("/api/proxy/api/v1/mdm/customer?limit=500&offset=0")
        const data = (await resp.json()) as { items?: RowData[] }
        setMasterClientCustomerCandidates(data.items ?? [])
      } catch {
        setMasterClientCustomerCandidates([])
      }
    })()
  }

  async function assignMasterClientCustomer(row: RowData, custId?: string): Promise<void> {
    const mcId = String(row.master_client_id ?? "")
    const cId = (custId ?? masterClientCustomerDraft).trim()
    if (!mcId || !cId) { setMessage("Pick a customer to assign."); return }
    const candidate = masterClientCustomerCandidates.find((c) => String(c.customer_id ?? "") === cId)
    setRecordSaving(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/customer/${encodeURIComponent(cId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ master_client_id: mcId, version_no: Number(candidate?.version_no ?? 1), updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
      setMasterClientCustomerDraft("")
      setMasterClientCustomerOpen(false)
      setMessage("Customer assigned")
      refreshRecordChildren(SUBTABLES["master-client"] ?? [], row)
    } finally { setRecordSaving(false) }
  }

  function requestRemoveMasterClientCustomer(entityRow: RowData, parentRow: RowData): void {
    requestDeleteConfirm(
      "Confirm Removal",
      "Remove this customer from the master client?",
      async () => {
        const cId = String(entityRow.customer_id ?? "")
        if (!cId) return
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/customer/${encodeURIComponent(cId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ master_client_id: "", version_no: Number(entityRow.version_no ?? 1), updated_by: "mdm-ui" }),
          })
          const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; detail?: string }
          if (!resp.ok || data.ok === false) { setMessage(`Remove failed: ${data.detail ?? "unknown"}`); return }
          setMessage("Customer removed")
          refreshRecordChildren(SUBTABLES["master-client"] ?? [], parentRow)
        } finally { setRecordSaving(false) }
      },
      "Remove",
    )
  }

  // Fetch all pages of an entity (API caps at 500 per page).
  // Uses sort_by=code for a stable sort so pagination doesn't skip/duplicate records.
  async function fetchAllPages(entityPath: string, extraParams?: string): Promise<RowData[]> {
    const PAGE = 500
    let offset = 0
    const all: RowData[] = []
    for (;;) {
      const resp = await fetch(`/api/proxy/api/v1/mdm/${entityPath}?limit=${PAGE}&offset=${offset}&sort_by=code&sort_dir=asc${extraParams ? `&${extraParams}` : ""}`)
      const data = (await resp.json()) as { items?: RowData[]; total?: number }
      const items = data.items ?? []
      all.push(...items)
      if (items.length < PAGE || all.length >= (data.total ?? Infinity)) break
      offset += PAGE
    }
    return all
  }

  // Product Line → Product Category: open dialog to assign a product category to the current product line.
  // All categories are loaded for tree structure, but only active + valid-period nodes are selectable.
  function isCategorySelectable(cat: RowData): boolean {
    if (String(cat.status ?? "").toLowerCase() !== "active") return false
    const today = new Date().toISOString().slice(0, 10)
    const validFrom = String(cat.valid_from ?? "").slice(0, 10)
    const validTo = String(cat.valid_to ?? "").slice(0, 10)
    if (validFrom && validFrom > today) return false
    // Open-ended (null/empty or far-future sentinel 9999-12-31) is always valid
    if (validTo && validTo !== "" && validTo !== "9999-12-31" && validTo < today) return false
    return true
  }
  function openProductLineProductCategoryDialog(row: RowData): void {
    void row
    setProductLineProductCategoryOpen(true)
    setProductLineProductCategoryDraft("")
    setProductLineCategoryTreeExpanded({})
    setProductLineCategoryTreeSearch("")
    void (async () => {
      try {
        setProductLineProductCategoryCandidates(await fetchAllPages("product-category"))
      } catch {
        setProductLineProductCategoryCandidates([])
      }
    })()
  }

  // ── Service BOM → Products (HS Codes) assign card ──────────────────────────
  async function loadServiceBomProducts(row: RowData): Promise<void> {
    const bomId = String(row.service_bom_id ?? "")
    if (!bomId) return
    try {
      const [prodResp, lineResp] = await Promise.all([
        fetch(`/api/proxy/api/v1/mdm/service-bom-product?limit=500&offset=0`),
        fetch(`/api/proxy/api/v1/mdm/product-line?limit=500&offset=0`),
      ])
      const prodData = (await prodResp.json()) as { items?: RowData[] }
      const lineData = (await lineResp.json()) as { items?: RowData[] }
      // The generic list endpoint doesn't filter by arbitrary FK params, so filter client-side.
      setSbpAssignedProducts((prodData.items ?? []).filter((r) => String(r.service_bom_id ?? "") === bomId && String(r.status ?? "") !== "archived"))
      setSbpProductLines(lineData.items ?? [])
    } catch {
      setSbpAssignedProducts([]); setSbpProductLines([])
    }
  }
  async function sbpSelectProductLine(lineId: string): Promise<void> {
    setSbpSelectedLineId(lineId)
    setSbpChecked(new Set())
    setSbpUnchecked(new Set())
    setSbpLineHsCodes([])
    if (!lineId) return
    try {
      // HS codes connected to this product line (leaf categories carrying product_line_id).
      // Generic list endpoint ignores arbitrary FK params, so filter client-side.
      const resp = await fetch(`/api/proxy/api/v1/mdm/product-category?limit=500&offset=0`)
      const data = (await resp.json()) as { items?: RowData[] }
      setSbpLineHsCodes((data.items ?? []).filter((r) => String(r.product_line_id ?? "") === lineId && String(r.status ?? "") !== "archived"))
    } catch {
      setSbpLineHsCodes([])
    }
  }
  function sbpToggle(categoryId: string): void {
    // Check if this HS code is already assigned to the BOM for the selected product line
    const isCurrentlyAssigned = sbpAssignedProducts.some(
      (p) => String(p.product_category_id ?? "") === categoryId && String(p.product_line_id ?? "") === sbpSelectedLineId
    )
    if (isCurrentlyAssigned) {
      // Toggle in the unchecked set (mark for removal)
      setSbpUnchecked((prev) => {
        const next = new Set(prev)
        if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId)
        return next
      })
    } else {
      // Toggle in the checked set (mark for addition)
      setSbpChecked((prev) => {
        const next = new Set(prev)
        if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId)
        return next
      })
    }
  }
  async function sbpAssignChecked(row: RowData): Promise<void> {
    const bomId = String(row.service_bom_id ?? "")
    const lineId = sbpSelectedLineId.trim()
    const toAdd = Array.from(sbpChecked)
    const toRemove = Array.from(sbpUnchecked)
    if (!bomId || (!toAdd.length && !toRemove.length)) { setMessage("No changes to save."); return }
    const already = new Set(sbpAssignedProducts.map((r) => String(r.product_category_id ?? "")))
    setSbpSaving(true)
    try {
      let addCount = 0
      let removeCount = 0
      // Assign newly checked HS codes
      for (const categoryId of toAdd) {
        if (already.has(categoryId)) continue
        // eslint-disable-next-line no-await-in-loop
        await fetch(`/api/proxy/api/v1/mdm/service-bom-product`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ service_bom_id: bomId, product_category_id: categoryId, product_line_id: lineId, status: "active", created_by: "mdm-ui", updated_by: "mdm-ui" }),
        })
        addCount++
      }
      // Remove unchecked HS codes
      for (const categoryId of toRemove) {
        const existing = sbpAssignedProducts.find(
          (p) => String(p.product_category_id ?? "") === categoryId && String(p.product_line_id ?? "") === lineId
        )
        if (!existing) continue
        const id = String(existing.service_bom_product_id ?? "")
        if (!id) continue
        // eslint-disable-next-line no-await-in-loop
        await fetch(`/api/proxy/api/v1/mdm/service-bom-product/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "archived", version_no: Number(existing.version_no ?? 1), updated_by: "mdm-ui" }),
        })
        removeCount++
      }
      await loadServiceBomProducts(row)
      setSbpChecked(new Set())
      setSbpUnchecked(new Set())
      const parts: string[] = []
      if (addCount) parts.push(`assigned ${addCount}`)
      if (removeCount) parts.push(`removed ${removeCount}`)
      setMessage(parts.length ? `${parts.join(", ")} HS code(s).` : "No changes.")
    } catch { setMessage("Save failed.") } finally { setSbpSaving(false) }
  }
  async function sbpUnlink(row: RowData, productRow: RowData): Promise<void> {
    const id = String(productRow.service_bom_product_id ?? "")
    if (!id) return
    setSbpSaving(true)
    try {
      await fetch(`/api/proxy/api/v1/mdm/service-bom-product/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "archived", version_no: Number(productRow.version_no ?? 1), updated_by: "mdm-ui" }),
      })
      await loadServiceBomProducts(row)
      setMessage("HS code removed.")
    } catch { setMessage("Remove failed.") } finally { setSbpSaving(false) }
  }
  async function sbpRemoveProductLine(row: RowData, lineId: string): Promise<void> {
    const bomId = String(row.service_bom_id ?? "")
    if (!bomId || !lineId) return
    const toRemove = sbpAssignedProducts.filter((p) => String(p.product_line_id ?? "") === lineId)
    if (!toRemove.length) return
    setSbpSaving(true)
    try {
      for (const p of toRemove) {
        const id = String(p.service_bom_product_id ?? "")
        if (!id) continue
        await fetch(`/api/proxy/api/v1/mdm/service-bom-product/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "archived", version_no: Number(p.version_no ?? 1), updated_by: "mdm-ui" }),
        })
      }
      await loadServiceBomProducts(row)
      if (sbpSelectedLineId === lineId) { setSbpSelectedLineId(""); setSbpLineHsCodes([]) }
      setMessage(`Removed ${toRemove.length} HS code(s).`)
    } catch { setMessage("Remove failed.") } finally { setSbpSaving(false) }
  }

  // ── Regulation/Standard → Products (HS Codes) assign card ──────────────────
  function rspJunctionEntity(): string {
    return entity === "standard" ? "standard-product" : "regulation-product"
  }
  function rspParentIdColumn(): string {
    return entity === "standard" ? "standard_id" : "regulation_id"
  }
  function rspParentIdValue(row: RowData): string {
    return entity === "standard" ? String(row.standard_id ?? "") : String(row.regulation_id ?? "")
  }
  async function loadRegStdProducts(row: RowData): Promise<void> {
    const parentId = rspParentIdValue(row)
    if (!parentId) return
    try {
      const [prodResp, lineResp] = await Promise.all([
        fetch(`/api/proxy/api/v1/mdm/${rspJunctionEntity()}?limit=500&offset=0`),
        fetch(`/api/proxy/api/v1/mdm/product-line?limit=500&offset=0`),
      ])
      const prodData = (await prodResp.json()) as { items?: RowData[] }
      const lineData = (await lineResp.json()) as { items?: RowData[] }
      setRspAssignedProducts((prodData.items ?? []).filter((r) => String(r[rspParentIdColumn()] ?? "") === parentId && String(r.status ?? "") !== "archived"))
      setRspProductLines(lineData.items ?? [])
    } catch {
      setRspAssignedProducts([]); setRspProductLines([])
    }
  }
  async function rspSelectProductLine(lineId: string): Promise<void> {
    setRspSelectedLineId(lineId)
    setRspChecked(new Set())
    setRspUnchecked(new Set())
    setRspLineHsCodes([])
    if (!lineId) return
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/product-category?limit=500&offset=0`)
      const data = (await resp.json()) as { items?: RowData[] }
      setRspLineHsCodes((data.items ?? []).filter((r) => String(r.product_line_id ?? "") === lineId && String(r.status ?? "") !== "archived"))
    } catch {
      setRspLineHsCodes([])
    }
  }
  function rspToggle(categoryId: string): void {
    const isCurrentlyAssigned = rspAssignedProducts.some(
      (p) => String(p.product_category_id ?? "") === categoryId && String(p.product_line_id ?? "") === rspSelectedLineId
    )
    if (isCurrentlyAssigned) {
      setRspUnchecked((prev) => { const next = new Set(prev); if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId); return next })
    } else {
      setRspChecked((prev) => { const next = new Set(prev); if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId); return next })
    }
  }
  async function rspAssignChecked(row: RowData): Promise<void> {
    const parentId = rspParentIdValue(row)
    const lineId = rspSelectedLineId.trim()
    const toAdd = Array.from(rspChecked)
    const toRemove = Array.from(rspUnchecked)
    if (!parentId || (!toAdd.length && !toRemove.length)) { setMessage("No changes to save."); return }
    const already = new Set(rspAssignedProducts.map((r) => String(r.product_category_id ?? "")))
    setRspSaving(true)
    try {
      let addCount = 0, removeCount = 0
      for (const categoryId of toAdd) {
        if (already.has(categoryId)) continue
        await fetch(`/api/proxy/api/v1/mdm/${rspJunctionEntity()}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ [rspParentIdColumn()]: parentId, product_category_id: categoryId, product_line_id: lineId, status: "active", created_by: "mdm-ui", updated_by: "mdm-ui" }),
        })
        addCount++
      }
      for (const categoryId of toRemove) {
        const existing = rspAssignedProducts.find(
          (p) => String(p.product_category_id ?? "") === categoryId && String(p.product_line_id ?? "") === lineId
        )
        if (!existing) continue
        const junctionIdCol = entity === "standard" ? "standard_product_id" : "regulation_product_id"
        const id = String(existing[junctionIdCol] ?? "")
        if (!id) continue
        await fetch(`/api/proxy/api/v1/mdm/${rspJunctionEntity()}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "archived", version_no: Number(existing.version_no ?? 1), updated_by: "mdm-ui" }),
        })
        removeCount++
      }
      await loadRegStdProducts(row)
      setRspChecked(new Set()); setRspUnchecked(new Set())
      const parts: string[] = []
      if (addCount) parts.push(`assigned ${addCount}`)
      if (removeCount) parts.push(`removed ${removeCount}`)
      setMessage(parts.length ? `${parts.join(", ")} HS code(s).` : "No changes.")
    } catch { setMessage("Save failed.") } finally { setRspSaving(false) }
  }
  async function rspRemoveProductLine(row: RowData, lineId: string): Promise<void> {
    const parentId = rspParentIdValue(row)
    if (!parentId || !lineId) return
    const toRemove = rspAssignedProducts.filter((p) => String(p.product_line_id ?? "") === lineId)
    if (!toRemove.length) return
    setRspSaving(true)
    try {
      const junctionIdCol = entity === "standard" ? "standard_product_id" : "regulation_product_id"
      for (const p of toRemove) {
        const id = String(p[junctionIdCol] ?? "")
        if (!id) continue
        await fetch(`/api/proxy/api/v1/mdm/${rspJunctionEntity()}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "archived", version_no: Number(p.version_no ?? 1), updated_by: "mdm-ui" }),
        })
      }
      await loadRegStdProducts(row)
      if (rspSelectedLineId === lineId) { setRspSelectedLineId(""); setRspLineHsCodes([]) }
      setMessage(`Removed ${toRemove.length} HS code(s).`)
    } catch { setMessage("Remove failed.") } finally { setRspSaving(false) }
  }
  // Regulation/Standard → Assign by Product Line: open a dialog listing all product lines.
  function openRspTreeDialog(): void {
    setRspTreeOpen(true)
    setRspTreeChecked(new Set())
    setRspTreeExpanded({})
    setRspTreeSearch("")
    void (async () => {
      try { setRspTreeCandidates(await fetchAllPages("product-line")) } catch { setRspTreeCandidates([]) }
    })()
  }
  async function rspAssignFromTree(row: RowData): Promise<void> {
    const parentId = rspParentIdValue(row)
    const selectedLineIds = Array.from(rspTreeChecked)
    if (!parentId || !selectedLineIds.length) { setMessage("Select at least one product line."); return }
    setRspSaving(true)
    try {
      const allCategories = await fetchAllPages("product-category")
      const already = new Set(rspAssignedProducts.map((r) => String(r.product_category_id ?? "")))
      let assignCount = 0
      for (const lineId of selectedLineIds) {
        const hsForLine = allCategories.filter((r) => String(r.product_line_id ?? "") === lineId && String(r.status ?? "") !== "archived")
        for (const hs of hsForLine) {
          const categoryId = String(hs.product_category_id ?? "")
          if (!categoryId || already.has(categoryId)) continue
          already.add(categoryId)
          await fetch(`/api/proxy/api/v1/mdm/${rspJunctionEntity()}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ [rspParentIdColumn()]: parentId, product_category_id: categoryId, product_line_id: lineId, status: "active", created_by: "mdm-ui", updated_by: "mdm-ui" }),
          })
          assignCount++
        }
      }
      await loadRegStdProducts(row)
      setRspTreeOpen(false)
      setRspTreeChecked(new Set())
      setMessage(assignCount > 0 ? `Assigned ${assignCount} HS code(s) from ${selectedLineIds.length} product line(s).` : "No new HS codes to assign (all already assigned).")
    } catch { setMessage("Assign failed.") } finally { setRspSaving(false) }
  }

  // Service BOM → Assign by Product Line: open a tree dialog showing all product lines;
  // user multi-selects leaf product lines, then we assign all HS codes under each selected line.
  function openSbpProductLineTreeDialog(): void {
    setSbpTreeOpen(true)
    setSbpTreeChecked(new Set())
    setSbpTreeExpanded({})
    setSbpTreeSearch("")
    void (async () => {
      try {
        setSbpTreeCandidates(await fetchAllPages("product-line"))
      } catch {
        setSbpTreeCandidates([])
      }
    })()
  }
  async function sbpAssignFromTree(row: RowData): Promise<void> {
    const bomId = String(row.service_bom_id ?? "")
    const selectedLineIds = Array.from(sbpTreeChecked)
    if (!bomId || !selectedLineIds.length) { setMessage("Select at least one product line."); return }
    setSbpSaving(true)
    try {
      // Fetch all product categories to find HS codes linked to the selected product lines
      const allCategories = await fetchAllPages("product-category")
      const already = new Set(sbpAssignedProducts.map((r) => String(r.product_category_id ?? "")))
      let assignCount = 0
      for (const lineId of selectedLineIds) {
        const hsForLine = allCategories.filter(
          (r) => String(r.product_line_id ?? "") === lineId && String(r.status ?? "") !== "archived"
        )
        for (const hs of hsForLine) {
          const categoryId = String(hs.product_category_id ?? "")
          if (!categoryId || already.has(categoryId)) continue
          already.add(categoryId)
          // eslint-disable-next-line no-await-in-loop
          await fetch(`/api/proxy/api/v1/mdm/service-bom-product`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ service_bom_id: bomId, product_category_id: categoryId, product_line_id: lineId, status: "active", created_by: "mdm-ui", updated_by: "mdm-ui" }),
          })
          assignCount++
        }
      }
      await loadServiceBomProducts(row)
      setSbpTreeOpen(false)
      setSbpTreeChecked(new Set())
      setMessage(assignCount > 0 ? `Assigned ${assignCount} HS code(s) from ${selectedLineIds.length} product line(s).` : "No new HS codes to assign (all already assigned).")
    } catch { setMessage("Assign failed.") } finally { setSbpSaving(false) }
  }

  async function assignProductLineProductCategory(row: RowData): Promise<void> {
    const plId = String(row.product_line_id ?? "")
    const categoryId = productLineProductCategoryDraft.trim()
    if (!plId || !categoryId) { setMessage("Pick an HS code to assign."); return }
    setRecordSaving(true)
    try {
      // Fetch the latest version via the list endpoint (no single-record GET exists)
      const getResp = await fetch(`/api/proxy/api/v1/mdm/product-line?limit=1&offset=0&product_line_id=${encodeURIComponent(plId)}`)
      const getList = (await getResp.json()) as { items?: RowData[] }
      const latestVersion = Number(getList.items?.[0]?.version_no ?? row.version_no ?? 1)
      const resp = await fetch(`/api/proxy/api/v1/mdm/product-line/${encodeURIComponent(plId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_category_id: categoryId, version_no: latestVersion, updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string; item?: RowData }
      if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
      setProductLineProductCategoryDraft("")
      setProductLineProductCategoryOpen(false)
      setMessage("Product category assigned")
      // Update local state with the full returned row (includes bumped version_no)
      setRecordView((prev) => prev ? { ...prev, row: { ...prev.row, ...data.item } } : prev)
    } finally { setRecordSaving(false) }
  }

  function requestRemoveProductLineProductCategory(row: RowData): void {
    requestDeleteConfirm(
      "Confirm Removal",
      "Remove the HS code assignment from this product line?",
      async () => {
        const plId = String(row.product_line_id ?? "")
        if (!plId) return
        setRecordSaving(true)
        try {
          // Fetch the latest version via the list endpoint (no single-record GET exists)
          const getResp = await fetch(`/api/proxy/api/v1/mdm/product-line?limit=1&offset=0&product_line_id=${encodeURIComponent(plId)}`)
          const getList = (await getResp.json()) as { items?: RowData[] }
          const latestVersion = Number(getList.items?.[0]?.version_no ?? row.version_no ?? 1)
          const resp = await fetch(`/api/proxy/api/v1/mdm/product-line/${encodeURIComponent(plId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ product_category_id: "", version_no: latestVersion, updated_by: "mdm-ui" }),
          })
          const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; detail?: string; item?: RowData }
          if (!resp.ok || data.ok === false) { setMessage(`Remove failed: ${data.detail ?? "unknown"}`); return }
          setMessage("Product category removed")
          setRecordView((prev) => prev ? { ...prev, row: { ...prev.row, ...data.item, product_category_id: "" } } : prev)
        } finally { setRecordSaving(false) }
      },
      "Remove",
    )
  }

  // Legal Entity ↔ Cost Center: 1:N via FK (legal_entity_id on mdm_cost_center).
  function openLeCostCenterDialog(row: RowData): void {
    void row
    setLeCostCenterOpen(true)
    setLeCostCenterDraft("")
    void (async () => {
      try {
        const resp = await fetch("/api/proxy/api/v1/mdm/cost-center?limit=500&offset=0")
        const data = (await resp.json()) as { items?: RowData[] }
        setLeCostCenterCandidates(data.items ?? [])
      } catch { setLeCostCenterCandidates([]) }
    })()
  }

  async function assignLeCostCenter(row: RowData, costCenterId?: string): Promise<void> {
    const leId = String(row.legal_entity_id ?? "")
    const ccId = (costCenterId ?? leCostCenterDraft).trim()
    if (!leId || !ccId) { setMessage("Pick a cost center to assign."); return }
    const candidate = leCostCenterCandidates.find((c) => String(c.cost_center_id ?? "") === ccId)
    setRecordSaving(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/cost-center/${encodeURIComponent(ccId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ legal_entity_id: leId, version_no: candidate?.version_no, updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
      setLeCostCenterDraft("")
      setLeCostCenterOpen(false)
      setMessage("Cost center assigned")
      refreshLeCostProfitCenters(row)
    } finally { setRecordSaving(false) }
  }

  function requestRemoveLeCostCenter(entityRow: RowData, parentRow: RowData): void {
    requestDeleteConfirm(
      "Confirm Removal",
      "Remove this cost center from the legal entity?",
      async () => {
        const ccId = String(entityRow.cost_center_id ?? "")
        if (!ccId) return
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/cost-center/${encodeURIComponent(ccId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ legal_entity_id: "", version_no: entityRow.version_no, updated_by: "mdm-ui" }),
          })
          const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; detail?: string }
          if (!resp.ok || data.ok === false) { setMessage(`Remove failed: ${data.detail ?? "unknown"}`); return }
          setMessage("Cost center removed")
          refreshLeCostProfitCenters(parentRow)
        } finally { setRecordSaving(false) }
      },
      "Remove",
    )
  }

  function refreshLeCostProfitCenters(parentRow: RowData): void {
    const leId = String(parentRow.legal_entity_id ?? "")
    if (!leId) return
    void (async () => {
      try {
        const [ccResp, pcResp] = await Promise.all([
          fetch(`/api/proxy/api/v1/mdm/cost-center?legal_entity_id=${encodeURIComponent(leId)}&limit=500&offset=0`),
          fetch(`/api/proxy/api/v1/mdm/profit-center?legal_entity_id=${encodeURIComponent(leId)}&limit=500&offset=0`),
        ])
        const ccData = (await ccResp.json()) as { items?: RowData[] }
        const pcData = (await pcResp.json()) as { items?: RowData[] }
        setRecordChildRows((prev) => ({ ...prev, "cost-center": ccData.items ?? [], "profit-center": pcData.items ?? [] }))
      } catch { /* ignore */ }
    })()
  }

  // Active office→team feature config, derived from the open record view (delivery-office or sales-office).
  function officeTeamFeature(): OfficeTeamFeature | null {
    return OFFICE_TEAM_FEATURE[recordView?.entityKey ?? ""] ?? null
  }

  function openDeliveryOfficeTeamDialog(row: RowData): void {
    void row
    const f = officeTeamFeature(); if (!f) return
    setDeliveryOfficeTeamOpen(true)
    setDeliveryOfficeTeamDraft("")
    void (async () => {
      try {
        const resp = await fetch(`/api/proxy/api/v1/mdm/${f.childEntity}?limit=500&offset=0`)
        const data = (await resp.json()) as { items?: RowData[] }
        setDeliveryOfficeTeamCandidates(data.items ?? [])
      } catch {
        setDeliveryOfficeTeamCandidates([])
      }
    })()
  }

  function refreshDeliveryOfficeTeams(row: RowData): void {
    const f = officeTeamFeature(); if (!f) return
    refreshRecordChildren(SUBTABLES[recordView?.entityKey ?? ""] ?? [], row)
    void (async () => {
      try {
        const resp = await fetch(`/api/proxy/api/v1/mdm/${f.childEntity}?limit=500&offset=0`)
        const data = (await resp.json()) as { items?: RowData[] }
        setDeliveryOfficeTeamCandidates(data.items ?? [])
      } catch {
        setDeliveryOfficeTeamCandidates([])
      }
    })()
  }

  async function assignDeliveryOfficeTeam(row: RowData, teamIdOverride?: string): Promise<void> {
    const f = officeTeamFeature(); if (!f) return
    const officeId = String(row[f.parentIdCol] ?? "")
    const teamId = (teamIdOverride ?? deliveryOfficeTeamDraft).trim()
    if (!officeId || !teamId) { setMessage(`Pick a ${f.teamSingular.toLowerCase()} to assign.`); return }
    const team = deliveryOfficeTeamCandidates.find((candidate) => String(candidate[f.childIdCol] ?? "") === teamId)
    const version = Number(team?.version_no ?? 1)
    setRecordSaving(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/${f.childEntity}/${encodeURIComponent(teamId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [f.fkCol]: officeId, version_no: version, updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
      setDeliveryOfficeTeamDraft("")
      setDeliveryOfficeTeamOpen(false)
      setMessage(`${f.teamSingular} assigned`)
      refreshDeliveryOfficeTeams(row)
    } finally { setRecordSaving(false) }
  }

  function requestRemoveDeliveryOfficeTeam(teamRow: RowData, parentRow: RowData): void {
    const f = officeTeamFeature(); if (!f) return
    requestDeleteConfirm(
      "Confirm Removal",
      `Remove this ${f.teamSingular.toLowerCase()} from the ${f.officeLabel}?`,
      async () => {
        const teamId = String(teamRow[f.childIdCol] ?? "")
        if (!teamId) return
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/${f.childEntity}/${encodeURIComponent(teamId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ [f.fkCol]: "", version_no: Number(teamRow.version_no ?? 1), updated_by: "mdm-ui" }),
          })
          const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; detail?: string }
          if (!resp.ok || data.ok === false) { setMessage(`Remove failed: ${data.detail ?? "unknown"}`); return }
          setMessage(`${f.teamSingular} removed`)
          refreshDeliveryOfficeTeams(parentRow)
          setDeliveryOfficeTeamCandidates((prev) => prev.map((candidate) => String(candidate[f.childIdCol] ?? "") === teamId ? { ...candidate, [f.fkCol]: "", version_no: Number(candidate.version_no ?? 1) + 1 } : candidate))
        } finally { setRecordSaving(false) }
      },
      "Remove",
    )
  }

  function requestRemoveControllingAreaLegalEntity(entityRow: RowData, parentRow: RowData): void {
    const cfg = (SUBTABLES["controlling-area"] ?? []).find((c) => c.childEntity === "legal-entity")
    if (!cfg) return
    requestDeleteConfirm(
      "Confirm Removal",
      "Remove this legal entity from the controlling area? This action cannot be undone.",
      async () => {
        await performDeleteLineRecord(cfg, entityRow, parentRow)
      },
      "Remove",
    )
  }

  function costCenterGroupSiblingEntity(childEntity: string): string {
    if (childEntity === COST_CENTER_GROUP_CHILD_ENTITY) return COST_CENTER_GROUP_COST_CENTER_ENTITY
    if (childEntity === COST_CENTER_GROUP_COST_CENTER_ENTITY) return COST_CENTER_GROUP_CHILD_ENTITY
    return ""
  }

  function costCenterGroupLineConflict(cfg: SubtableDef): string {
    if (recordView?.entityKey === "cost-center-group") {
      const siblingEntity = costCenterGroupSiblingEntity(cfg.childEntity)
      if (!siblingEntity) return ""
      const siblingRows = recordChildRows[siblingEntity] ?? []
      return siblingRows.length > 0 ? siblingEntity : ""
    }
    if (recordView?.entityKey === "product-category") {
      const sibling = cfg.childEntity === "product-category"
        ? "feature-of-product"
        : cfg.childEntity === "feature-of-product"
        ? "product-category"
        : ""
      if (!sibling) return ""
      const siblingRows = recordChildRows[sibling] ?? []
      return siblingRows.length > 0 ? sibling : ""
    }
    return ""
  }

  function refreshRecordChildren(children: SubtableDef[], row: RowData): void {
    setRecordChildRows((prev) => {
      const next = { ...prev }
      for (const child of children) delete next[child.childEntity]
      return next
    })
    for (const child of children) fetchRecordChild(child, row, true)
  }

  function openRecordView(row: RowData, entityKey: string = entity): void {
    setRecordView({ row, entityKey })
    setRecordChildRows({})
    setRecordChildLoading("")
    setCreditAreaLegalEntityOpen(false)
    setCreditAreaLegalEntityDraft("")
    setCreditAreaLegalEntityCandidates([])
    setDeliveryOfficeTeamOpen(false)
    setDeliveryOfficeTeamDraft("")
    setDeliveryOfficeTeamCandidates([])
    setDivisionProfitCenterOpen(false)
    setDivisionProfitCenterDraft("")
    setDivisionProfitCenterCandidates([])
    setProfitCenterCostCenterOpen(false)
    setProfitCenterCostCenterDraft("")
    setProfitCenterCostCenterCandidates([])
    setProductLineProductCategoryOpen(false)
    setProductLineProductCategoryDraft("")
    setProductLineProductCategoryCandidates([])
    setSbpAssignedProducts([]); setSbpProductLines([]); setSbpSelectedLineId(""); setSbpLineHsCodes([]); setSbpChecked(new Set())
    setLeCostCenterOpen(false); setLeCostCenterDraft(""); setLeCostCenterCandidates([])
    setHeaderEditing(false)
    setHeaderDraft(rowDraftFromRecord(entities.find((e) => e.key === entityKey), row))
    setLineDetail(null); setLineEditing(false); setSelectedLineId("")
    setLineGroupBy(""); setLineSortBy(null); setLineColFilters({}); setLineFilterMenuCol(""); setLineColWidths({})
    const children = SUBTABLES[entityKey] ?? []
    setRecordLineTab(children[0]?.childEntity ?? "")
    for (const child of children) fetchRecordChild(child, row)
    // Service BOM: load assigned products (HS codes) + product-line list for the assign card.
    if (entityKey === "service-bom") void loadServiceBomProducts(row)
    // Regulation/Standard: load assigned products (HS codes) + product-line list for the assign card.
    if (entityKey === "regulation" || entityKey === "standard") void loadRegStdProducts(row)
    // Credit area: preload legal-entity master data so the assignment card can show names.
    if (entityKey === "credit-area") {
      void (async () => {
        try {
          const resp = await fetch("/api/proxy/api/v1/mdm/legal-entity?limit=500&offset=0")
          const data = (await resp.json()) as { items?: RowData[] }
          setCreditAreaLegalEntityCandidates(data.items ?? [])
        } catch { /* keep empty on failure */ }
      })()
    }
    // Legal entity: preload cost centers (and profit centers) for inline assign panels.
    if (entityKey === "legal-entity") {
      refreshLeCostProfitCenters(row)
    }
    // Product line: preload product categories so the assignment card can resolve names.
    if (entityKey === "product-line") {
      void (async () => {
        try {
          setProductLineProductCategoryCandidates(await fetchAllPages("product-category"))
        } catch { /* keep empty on failure */ }
      })()
    }
    const officeTeamCfg = OFFICE_TEAM_FEATURE[entityKey]
    if (officeTeamCfg) {
      void (async () => {
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/${officeTeamCfg.childEntity}?limit=500&offset=0`)
          const data = (await resp.json()) as { items?: RowData[] }
          setDeliveryOfficeTeamCandidates(data.items ?? [])
        } catch { /* keep empty on failure */ }
      })()
    }
  }

  function openLineDetail(cfg: SubtableDef, row: RowData): void {
    if (LOCKED_MDM_ENTITIES.has(cfg.childEntity)) {
      setMessage("This subtable is read-only.")
      return
    }
    const conflictEntity = costCenterGroupLineConflict(cfg)
    if (conflictEntity) {
      const conflictLabel = SUBTABLES["cost-center-group"]?.find((c) => c.childEntity === conflictEntity)?.label ?? humanizeLabel(conflictEntity)
      setMessage(`This group already has ${conflictLabel.toLowerCase()}; remove them before adding ${cfg.label.toLowerCase()}.`)
      return
    }
    setLineDetail({ row, cfg }); setLineEditing(false)
    setLineDraft(rowDraftFromRecord(entities.find((e) => e.key === cfg.childEntity), row))
  }
  function addLineRecord(cfg: SubtableDef, parentRow: RowData): void {
    if (LOCKED_MDM_ENTITIES.has(cfg.childEntity)) {
      setMessage("This subtable is read-only.")
      return
    }
    const conflictEntity = costCenterGroupLineConflict(cfg)
    if (conflictEntity) {
      const conflictLabel = SUBTABLES["cost-center-group"]?.find((c) => c.childEntity === conflictEntity)?.label ?? humanizeLabel(conflictEntity)
      setMessage(`This group already has ${conflictLabel.toLowerCase()}; remove them before assigning ${cfg.label.toLowerCase()}.`)
      return
    }
    // Assign mode: load the full list of child records so the user can pick one
    // (no new record is created — we PATCH the chosen record's FK on save).
    if (cfg.assignMode) {
      setLineDetail({ row: {}, cfg, isNew: true })
      setLineDraft({ _assign_target: "" })
      setLineEditing(true)
      setSelectedLineId("")
      setAssignCandidates([])
      void (async () => {
        try {
          const targetEntity = cfg.multiAssign ? COST_CENTER_ENTITY : cfg.childEntity
          const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(targetEntity)}?limit=500&offset=0`)
          const data = (await resp.json()) as { items?: RowData[] }
          const parentValue = String(parentRow[cfg.parentField] ?? "")
          const idCol = childIdCol(targetEntity)
          const candidates = cfg.multiAssign
            ? (data.items ?? [])
            : (data.items ?? []).filter((item) => {
              const itemId = String(item[idCol] ?? "")
              if ((cfg.childEntity === COST_CENTER_GROUP_CHILD_ENTITY || cfg.childEntity === "product-category") && itemId === parentValue) return false
              const assignedTo = String(item[cfg.fkColumn] ?? "")
              return !assignedTo || assignedTo === parentValue
            })
          setAssignCandidates(candidates)
        } catch {
          setAssignCandidates([])
        }
      })()
      return
    }
    const blank = rowDraftFromRecord(entities.find((e) => e.key === cfg.childEntity), {})
    blank[cfg.fkColumn] = String(parentRow[cfg.parentField] ?? ""); blank.status = "active"
    blank.valid_from = blank.valid_from || new Date().toISOString().slice(0, 10)
    blank.valid_to = blank.valid_to || "9999-12-31"
    // Predict line_no client-side so the user sees it immediately. Backend will
    // re-compute on insert to stay race-safe; the UI value is informational.
    const existing = recordChildRows[cfg.childEntity] ?? []
    const maxLineNo = existing.reduce((m, r) => Math.max(m, Number(r.line_no ?? 0) || 0), 0)
    blank.line_no = String(maxLineNo + 10)
    setLineDetail({ row: { line_no: maxLineNo + 10 }, cfg, isNew: true }); setLineDraft(blank); setLineEditing(true); setSelectedLineId("")
  }
  async function saveRecordEdit(entityKey: string, row: RowData, draft: Record<string, string>): Promise<boolean> {
    const meta = entities.find((e) => e.key === entityKey)
    const idCol = meta?.idColumn ?? `${entityKey.replace(/-/g, "_")}_id`
    const rowId = String(row[idCol] ?? "")
    if (!rowId) { setMessage("Cannot save: missing id"); return false }
    setRecordSaving(true)
    try {
      // Empty form values must be sent as null, not "" — otherwise numeric/date columns
      // (e.g. credit_limit, valid_to) fail backend parsing ("invalid input syntax for type numeric").
      const cleaned: Record<string, unknown> = {}
      const hidden = new Set(getEntityHiddenColumns(entityKey))
      const allowedDraftFields = new Set([...(meta?.columns ?? []).filter((c) => !hidden.has(c)), "status", "valid_from", "valid_to", "updated_by"])
      for (const [k, v] of Object.entries(draft)) {
        if (!allowedDraftFields.has(k)) continue
        cleaned[k] = typeof v === "string" && v.trim() === "" ? null : v
      }
      const payload: Record<string, unknown> = { ...cleaned, version_no: Number(row.version_no ?? 1), updated_by: "mdm-ui" }
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entityKey)}/${encodeURIComponent(rowId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      const data = (await resp.json()) as { ok?: boolean; detail?: string; item?: RowData }
      if (!resp.ok || !data.ok) { setMessage(`Save failed: ${data.detail ?? "unknown"}`); return false }
      if (data.item) {
        const nextRow = data.item
        setRows((prev) => entityKey === entity ? prev.map((r) => String(r[idCol] ?? "") === rowId ? nextRow : r) : prev)
        setRecordView((prev) => prev && prev.entityKey === entityKey && String(prev.row[idCol] ?? "") === rowId ? { ...prev, row: nextRow } : prev)
        setHeaderDraft(rowDraftFromRecord(meta, nextRow))
      }
      setMessage("Saved"); return true
    } catch { setMessage("Save failed"); return false } finally { setRecordSaving(false) }
  }
  async function saveLineDetail(parentRow: RowData): Promise<void> {
    if (!lineDetail) return
    const cfg = lineDetail.cfg
    if (LOCKED_MDM_ENTITIES.has(cfg.childEntity)) {
      setMessage("This subtable is read-only.")
      return
    }
    if (lineDetail.isNew) {
      // Assign mode: PATCH the picked existing record's FK column to the parent id.
      if (cfg.assignMode) {
        if (cfg.multiAssign) {
          const parentValue = String(parentRow[cfg.parentField] ?? "")
          const costCenterId = String(lineDraft._assign_target ?? "").trim()
          if (!costCenterId) { setMessage("Please pick a cost center to add."); return }
          const currentMappings = (recordChildRows[cfg.childEntity] ?? []).filter((r) => String(r[cfg.fkColumn] ?? "") === parentValue)
          const alreadyMapped = currentMappings.some((r) => String(r.cost_center_id ?? "") === costCenterId)
          if (alreadyMapped) { setMessage("This cost center is already mapped."); return }
          setRecordSaving(true)
          try {
            const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.childEntity)}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ [cfg.fkColumn]: parentValue, cost_center_id: costCenterId, created_by: "mdm-ui", updated_by: "mdm-ui" }),
            })
            const data = (await resp.json()) as { ok?: boolean; detail?: string }
            if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
            setMessage("Mapping added")
          } finally { setRecordSaving(false) }
          refreshRecordChildren(SUBTABLES[recordView?.entityKey ?? ""] ?? [cfg], parentRow)
          setLineDraft({ _assign_target: "" })
          return
        }
        const targetId = String(lineDraft._assign_target ?? "").trim()
        if (!targetId) { setMessage("Please pick a record to assign."); return }
        const meta = entities.find((e) => e.key === cfg.childEntity)
        const idCol = meta?.idColumn ?? `${cfg.childEntity.replace(/-/g, "_")}_id`
        const target = assignCandidates.find((r) => String(r[idCol] ?? "") === targetId)
        const alreadyAssigned = (recordChildRows[cfg.childEntity] ?? []).some((r) => String(r[idCol] ?? "") === targetId)
        if (alreadyAssigned) { setMessage("This record is already assigned."); return }
        const version = Number((target?.version_no as number | string | undefined) ?? 1)
        setRecordSaving(true)
        try {
          const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.childEntity)}/${encodeURIComponent(targetId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ [cfg.fkColumn]: String(parentRow[cfg.parentField] ?? ""), version_no: version, updated_by: "mdm-ui" }),
          })
          const data = (await resp.json()) as { ok?: boolean; detail?: string }
          if (!resp.ok || !data.ok) { setMessage(`Assign failed: ${data.detail ?? "unknown"}`); return }
          setMessage("Assigned")
        } finally { setRecordSaving(false) }
        refreshRecordChildren(SUBTABLES[recordView?.entityKey ?? ""] ?? [cfg], parentRow)
        setLineDraft({ _assign_target: "" })
        return
      }
      setRecordSaving(true)
      try {
        const payload: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(lineDraft)) if (String(v).trim() !== "") payload[k] = v
        payload.status = lineDraft.status || "active"; payload.valid_from = lineDraft.valid_from || new Date().toISOString().slice(0, 10); payload.valid_to = lineDraft.valid_to || "9999-12-31"
        const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.childEntity)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        const data = (await resp.json()) as { ok?: boolean; detail?: string }
        if (!resp.ok || !data.ok) { setMessage(`Create failed: ${data.detail ?? "unknown"}`); return }
        setMessage("Created")
      } finally { setRecordSaving(false) }
    } else {
      const ok = await saveRecordEdit(cfg.childEntity, lineDetail.row, lineDraft)
      if (!ok) return
    }
    setLineDetail(null); setLineEditing(false)
    refreshRecordChildren(SUBTABLES[recordView?.entityKey ?? ""] ?? [cfg], parentRow)
  }
  function deleteLineRecord(cfg: SubtableDef, row: RowData, parentRow: RowData): void {
    setDeleteConfirm({
      title: "Confirm Delete",
      message: `Delete this ${cfg.label.toLowerCase()} record permanently? This action cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await performDeleteLineRecord(cfg, row, parentRow)
      },
    })
  }

  async function performDeleteLineRecord(cfg: SubtableDef, row: RowData, parentRow: RowData): Promise<void> {
    if (LOCKED_MDM_ENTITIES.has(cfg.childEntity)) {
      setMessage("This subtable is read-only.")
      return
    }
    if (cfg.assignMode) {
      const id = String(row[childIdCol(cfg.childEntity)] ?? "")
      if (!id) return
      const version = Number((row.version_no as number | string | undefined) ?? 1)
      setRecordSaving(true)
      try {
        if (cfg.multiAssign) {
          const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.childEntity)}/${encodeURIComponent(id)}?updated_by=mdm-ui`, { method: "DELETE" })
          const data = (await resp.json()) as { ok?: boolean; detail?: string }
          if (!resp.ok || !data.ok) { setMessage(`Delete failed: ${data.detail ?? "unknown"}`); return }
        } else {
          const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.childEntity)}/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ [cfg.fkColumn]: "", version_no: version, updated_by: "mdm-ui" }),
          })
          const data = (await resp.json()) as { ok?: boolean; detail?: string }
          if (!resp.ok || !data.ok) { setMessage(`Unassign failed: ${data.detail ?? "unknown"}`); return }
        }
        setMessage("Deleted")
      } finally { setRecordSaving(false) }
      refreshRecordChildren(SUBTABLES[recordView?.entityKey ?? ""] ?? [cfg], parentRow)
      return
    }
    const id = String(row[childIdCol(cfg.childEntity)] ?? ""); if (!id) return
    const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.childEntity)}/${encodeURIComponent(id)}`, { method: "DELETE" })
    setMessage(resp.ok ? "Line deleted" : "Delete failed")
    setLineDetail(null); setSelectedLineId("")
    refreshRecordChildren(SUBTABLES[recordView?.entityKey ?? ""] ?? [cfg], parentRow)
  }
  async function refreshManagedEnum(field: string): Promise<void> {
    const enumKey = getManagedEnumKey(field, entity)
    if (!enumKey) return
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm-enum/${encodeURIComponent(enumKey)}`)
      const data = (await resp.json()) as { items?: Array<{ value: string; label: string }> }
      const items = (data.items ?? []).map((it) => ({ value: String(it.value), label: String(it.label || it.value) }))
      setLookupOptions((prev) => ({ ...prev, [field]: items }))
    } catch {
      // best-effort refresh; keep prior options on error
    }
  }
  async function addManagedEnumValue(field: string): Promise<void> {
    const enumKey = getManagedEnumKey(field, entity)
    const value = enumNewValue.trim()
    const label = enumNewLabel.trim() || value
    if (!enumKey || !value) return
    setEnumOpBusy(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm-enum/${encodeURIComponent(enumKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value, label, updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Add option failed: ${data.detail ?? resp.statusText}`); return }
      setEnumNewValue(""); setEnumNewLabel("")
      await refreshManagedEnum(field)
    } finally {
      setEnumOpBusy(false)
    }
  }
  async function deleteManagedEnumValue(field: string, value: string): Promise<void> {
    const enumKey = getManagedEnumKey(field, entity)
    if (!enumKey) return
    setEnumOpBusy(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm-enum/${encodeURIComponent(enumKey)}/${encodeURIComponent(value)}`, { method: "DELETE" })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) { setMessage(`Remove option failed: ${data.detail ?? resp.statusText}`); return }
      await refreshManagedEnum(field)
    } finally {
      setEnumOpBusy(false)
    }
  }
  // Entity-managed FK: refresh dropdown options from the entity API.
  async function refreshEntityManagedFK(fkField: string): Promise<void> {
    const cfg = ENTITY_MANAGED_FK_FIELDS[fkField]
    if (!cfg) return
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.targetEntity)}?limit=500&offset=0`)
      const data = (await resp.json()) as { items?: RowData[] }
      const items = data.items ?? []
      const newOpts = items.map((r) => {
        const id = String(r[cfg.idColumn] ?? "")
        const nameKey = Object.keys(r).find((k) => k === "name" || k.endsWith("_name") || k === "title")
        const codeKey = Object.keys(r).find((k) => k === "code" || k.endsWith("_code"))
        const name = nameKey ? String(r[nameKey] ?? "") : ""
        const code = codeKey ? String(r[codeKey] ?? "") : ""
        return { value: id, label: [code, name].filter(Boolean).join(" - ") || id }
      }).filter((x) => x.value)
      setLookupOptions((prev) => ({ ...prev, [fkField]: newOpts }))
    } catch { /* best-effort */ }
  }
  // Entity-managed FK: add a new record.
  async function addEntityManagedFK(fkField: string): Promise<void> {
    const cfg = ENTITY_MANAGED_FK_FIELDS[fkField]
    if (!cfg) return
    const payload: Record<string, string> = {}
    for (const f of cfg.fields) {
      const val = (entityMgrDraft[f.name] ?? "").trim()
      if (f.required && !val) { setMessage(`${f.label} is required`); return }
      if (val) payload[f.name] = val
    }
    payload.status = "active"
    payload.valid_from = new Date().toISOString().slice(0, 10)
    setEntityMgrBusy(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.targetEntity)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await resp.json()) as { id?: string; ok?: boolean; detail?: string }
      if (!resp.ok) { setMessage(`Add failed: ${data.detail ?? resp.statusText}`); return }
      setEntityMgrDraft({})
      await refreshEntityManagedFK(fkField)
    } finally {
      setEntityMgrBusy(false)
    }
  }
  // Entity-managed FK: remove a record.
  async function deleteEntityManagedFK(fkField: string, recordId: string): Promise<void> {
    const cfg = ENTITY_MANAGED_FK_FIELDS[fkField]
    if (!cfg) return
    setEntityMgrBusy(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.targetEntity)}/${encodeURIComponent(recordId)}`, { method: "DELETE" })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok) { setMessage(`Remove failed: ${data.detail ?? resp.statusText}`); return }
      await refreshEntityManagedFK(fkField)
    } finally {
      setEntityMgrBusy(false)
    }
  }

  function renderRecordField(field: string, draft: Record<string, string>, setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>): React.ReactNode {
    const v = draft[field] ?? ""
    const set = (val: string) => setDraft((p) => ({ ...p, [field]: val }))
    if (field === "code" && SYSTEM_ASSIGNED_CODE_ENTITIES.has(entity)) return <div className="rounded border border-border bg-muted/40 px-2 py-1 text-sm text-muted-foreground">{v || "— auto —"}</div>
    if (field === "status") return <select value={v || "active"} onChange={(e) => set(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm"><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select>
    // Primary/default flags render as a checkbox; the backend enforces that only
    // one row per parent keeps the flag set.
    if (field === "is_primary" || field === "is_default") {
      const checked = ["true", "t", "1", "yes"].includes(v.trim().toLowerCase())
      return (
        <label className="flex h-[30px] cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked ? "true" : "false")} className="h-4 w-4 accent-primary" />
          <span className="text-muted-foreground">{checked ? "Yes" : "No"}</span>
        </label>
      )
    }
    // Region/City: country-scoped dropdowns backed by the province and city masters.
    if (field === "region" || field === "city") {
      const country = String(draft.country_code ?? "").trim().toUpperCase()
      const kind = field === "region" ? "province" : "city"
      if (country) ensureGeoOptions(kind, country)
      const geoOpts = country ? (geoOptions[`${kind}:${country}`] ?? []) : []
      // Keep a stored value selectable even if it's not (yet) in the master list.
      const withCurrent = v && !geoOpts.some((o) => o.value === v) ? [{ value: v, label: v }, ...geoOpts] : geoOpts
      const hint = !country ? "— Pick a Country first —" : geoOpts.length === 0 ? "— No options yet —" : "— Select —"
      return (
        <select value={v} onChange={(e) => set(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm">
          <option value="">{hint}</option>
          {withCurrent.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    // Tree-select for hierarchical FK fields (Product Line, HS Code).
    const treeSelCfg = TREE_SELECT_FK_FIELDS[field]
    if (treeSelCfg && (rawLookupRows[field]?.length ?? 0) > 0) {
      let treeRawRows = rawLookupRows[field] ?? []
      let treeOpts = lookupOptions[field] ?? []
      // Cross-field: on service-bom, filter HS Code to only categories assigned to the selected Product Line.
      if (entity === "service-bom" && field === "product_category_id") {
        const selectedPL = String(draft.product_line_id ?? "").trim()
        if (selectedPL) {
          const allowedIds = new Set(treeRawRows.filter((r) => String(r.product_line_id ?? "") === selectedPL).map((r) => String(r[treeSelCfg.idField] ?? "")))
          treeRawRows = treeRawRows.filter((r) => allowedIds.has(String(r[treeSelCfg.idField] ?? "")))
          treeOpts = treeOpts.filter((o) => allowedIds.has(o.value))
        } else {
          treeRawRows = []; treeOpts = []
        }
      }
      return (
        <TreeSelectDropdown
          value={v}
          onChange={(val) => {
            set(val)
            // Reset HS Code when Product Line changes on service-bom.
            if (entity === "service-bom" && field === "product_line_id") setDraft((p) => ({ ...p, product_category_id: "" }))
          }}
          rawRows={treeRawRows}
          options={treeOpts}
          config={treeSelCfg}
          emptyHint={entity === "service-bom" && field === "product_category_id" && !String(draft.product_line_id ?? "").trim() ? "— Pick a Product Line first —" : undefined}
        />
      )
    }
    // Prefer the live FK/code lookup (countries, currencies, divisions, credit areas…);
    // fall back to the predefined ENUM list (language, tax_type, account_type, address_type, rate_type…).
    const opts = lookupOptions[field] ?? ENUM_FIELD_OPTIONS[field] ?? []
    const isManaged = !!getManagedEnumKey(field, entity)
    // Show a dropdown for any field the loader recognized as an FK/code lookup, even
    // if its master table is empty — so the user sees it's a picker (with a hint),
    // not a free-text field they should type into.
    const isLookupField = lookupFields.has(field) || isManaged || !!ENUM_FIELD_OPTIONS[field]
    if (isLookupField) {
      const isAdmin = effectiveRoles.includes("admin") || roleMode === "admin"
      const showManager = isManaged && isAdmin && managingEnumField === field
      return (
        <div className="relative">
          <div className="flex items-center gap-1">
            <select value={v} onChange={(e) => set(e.target.value)} title={opts.find((o) => o.value === v)?.label ?? ""} className="w-full rounded border border-border bg-background px-2 py-1 text-sm">
              <option value="">{opts.length === 0 ? "— No options yet —" : "— Select —"}</option>
              {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {isManaged && isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const width = 288 // w-72
                  const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
                  const top = Math.min(r.bottom + 4, window.innerHeight - 320)
                  setEnumMgrPos({ top, left })
                  setManagingEnumField((prev) => prev === field ? "" : field)
                }}
                title="Admin: manage options"
                className="shrink-0 rounded border border-border px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >⚙</button>
            )}
            {ENTITY_MANAGED_FK_FIELDS[field] && isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const width = 288
                  const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
                  const top = Math.min(r.bottom + 4, window.innerHeight - 320)
                  setEnumMgrPos({ top, left })
                  setEntityMgrDraft({})
                  setEntityMgrField((prev) => prev === field ? "" : field)
                }}
                title={`Manage ${humanizeLabel(ENTITY_MANAGED_FK_FIELDS[field].targetEntity)} options`}
                className="shrink-0 rounded border border-border px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >⚙</button>
            )}
          </div>
          {entityMgrField === field && ENTITY_MANAGED_FK_FIELDS[field] && (() => {
            const emfCfg = ENTITY_MANAGED_FK_FIELDS[field]
            return (
              <div
                className="fixed z-[100] w-72 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-xl"
                style={enumMgrPos ? { top: enumMgrPos.top, left: enumMgrPos.left } : undefined}
              >
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Manage {humanizeLabel(emfCfg.targetEntity)} options</span>
                  <button onClick={() => setEntityMgrField("")} className="rounded px-1 text-muted-foreground hover:text-foreground">✕</button>
                </div>
                <div className="max-h-40 overflow-auto rounded border border-border/60">
                  {(opts.length === 0) && <div className="px-2 py-1 text-xs text-muted-foreground">No options yet.</div>}
                  {opts.map((o) => (
                    <div key={o.value} className="flex items-center justify-between gap-2 border-b border-border/40 px-2 py-1 text-xs last:border-b-0">
                      <span className="truncate">{o.label}</span>
                      <button disabled={entityMgrBusy} onClick={() => void deleteEntityManagedFK(field, o.value)} className="rounded px-1 text-muted-foreground hover:text-destructive">Remove</button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 space-y-1">
                  {emfCfg.fields.map((f) => (
                    <input key={f.name} value={entityMgrDraft[f.name] ?? ""} onChange={(e) => setEntityMgrDraft((prev) => ({ ...prev, [f.name]: e.target.value }))} placeholder={`${f.label}${f.required ? " *" : ""}`} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
                  ))}
                  <button disabled={entityMgrBusy || emfCfg.fields.some((f) => f.required && !(entityMgrDraft[f.name] ?? "").trim())} onClick={() => void addEntityManagedFK(field)} className="w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">{entityMgrBusy ? "Saving…" : "Add option"}</button>
                </div>
              </div>
            )
          })()}
          {showManager && (
            <div
              className="fixed z-[100] w-72 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-xl"
              style={enumMgrPos ? { top: enumMgrPos.top, left: enumMgrPos.left } : undefined}
            >
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Manage {humanizeLabel(field)} options</span>
                <button onClick={() => setManagingEnumField("")} className="rounded px-1 text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <div className="max-h-40 overflow-auto rounded border border-border/60">
                {(opts.length === 0) && <div className="px-2 py-1 text-xs text-muted-foreground">No options yet.</div>}
                {opts.map((o) => (
                  <div key={o.value} className="flex items-center justify-between gap-2 border-b border-border/40 px-2 py-1 text-xs last:border-b-0">
                    <span className="truncate"><span className="font-medium">{o.value}</span> — {o.label}</span>
                    <button disabled={enumOpBusy} onClick={() => void deleteManagedEnumValue(field, o.value)} className="rounded px-1 text-muted-foreground hover:text-destructive">Remove</button>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                <input value={enumNewValue} onChange={(e) => setEnumNewValue(e.target.value)} placeholder="Code (e.g. MANAGER)" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
                <input value={enumNewLabel} onChange={(e) => setEnumNewLabel(e.target.value)} placeholder="Label (e.g. Manager) — optional" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
                <button disabled={enumOpBusy || !enumNewValue.trim()} onClick={() => void addManagedEnumValue(field)} className="w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">{enumOpBusy ? "Saving…" : "Add option"}</button>
              </div>
            </div>
          )}
        </div>
      )
    }
    if (field === "legal_entity_code") {
      // Strict 4-char SAP company code.
      return <input value={v} maxLength={4} onChange={(e) => set(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))} placeholder="≤ 4 letters/numbers" className="w-full rounded border border-border bg-background px-2 py-1 text-sm uppercase" />
    }
    if (field === "code") {
      // Generic master-data code: up to N alphanumeric uppercase (CODE_MAX_LENGTH override).
      const maxLen = CODE_MAX_LENGTH[entity] ?? 10
      return <input value={v} maxLength={maxLen} onChange={(e) => set(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLen))} placeholder={`≤ ${maxLen} letters/numbers`} className="w-full rounded border border-border bg-background px-2 py-1 text-sm uppercase" />
    }
    // Date inputs: validity dates and any *_date column render as a native date picker.
    if (field === "valid_from" || field === "valid_to" || field.endsWith("_date")) {
      return <input type="date" value={toDateInputValue(v)} onChange={(e) => set(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
    }
    return <input value={v} onChange={(e) => set(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
  }
  function startLineColResize(col: string, e: React.MouseEvent): void {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX
    const th = (e.currentTarget as HTMLElement).closest("th") as HTMLElement | null
    const startW = th?.getBoundingClientRect().width ?? 140
    const onMove = (ev: MouseEvent) => setLineColWidths((prev) => ({ ...prev, [col]: Math.max(80, startW + (ev.clientX - startX)) }))
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp)
  }

  function startGridColResize(col: string, e: React.MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const th = (e.currentTarget as HTMLElement).closest("th") as HTMLElement | null
    const startW = th?.getBoundingClientRect().width ?? 140
    const onMove = (ev: MouseEvent) => setGridColWidths((prev) => ({ ...prev, [col]: Math.max(80, startW + (ev.clientX - startX)) }))
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }
  function renderLineHeader(c: string): React.ReactNode {
    const active = !!lineColFilters[c]?.trim()
    return (
      <div className="relative flex items-center justify-between gap-2">
        <button type="button" onClick={() => setLineSortBy((p) => (p?.field === c ? (p.dir === "asc" ? { field: c, dir: "desc" } : null) : { field: c, dir: "asc" }))} className="inline-flex items-center gap-1 hover:text-foreground">
          {humanizeLabel(c)}<span className={`text-[10px] ${lineSortBy?.field === c ? "text-primary" : "text-muted-foreground/50"}`}>{lineSortBy?.field === c ? (lineSortBy.dir === "asc" ? "▲" : "▼") : "↕"}</span>
        </button>
        <button type="button" onClick={() => setLineFilterMenuCol((prev) => prev === c ? "" : c)} title="Filter" className={`rounded p-1 hover:bg-muted ${active ? "text-primary" : "text-muted-foreground"}`}><Filter size={13} fill={active ? "currentColor" : "none"} /></button>
        {lineFilterMenuCol === c && (
          <ColumnFilterPopover
            column={c}
            label={humanizeLabel(c)}
            value={lineColFilters[c] ?? ""}
            onChange={(v) => setLineColFilters((prev) => ({ ...prev, [c]: v }))}
            onClear={() => setLineColFilters((prev) => { const n = { ...prev }; delete n[c]; return n })}
            onClose={() => setLineFilterMenuCol("")}
          />
        )}
        <span onMouseDown={(e) => startLineColResize(c, e)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
      </div>
    )
  }

  function fetchRecordChild(cfg: SubtableDef, row: RowData, force = false): void {
    if (!force && recordChildRows[cfg.childEntity]) return
    const value = String(row[cfg.parentField] ?? "")
    setRecordChildLoading(cfg.childEntity)
    const q = new URLSearchParams({ limit: "1000", offset: "0" })
    q.set("conditions", JSON.stringify([{ field: cfg.fkColumn, op: "eq", value }]))
    q.set("condition_join", "and")
    void fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(cfg.childEntity)}?${q.toString()}`)
      .then((r) => r.text())
      .then((t) => { const d = t ? (JSON.parse(t) as { items?: RowData[] }) : { items: [] }; setRecordChildRows((prev) => ({ ...prev, [cfg.childEntity]: d.items ?? [] })) })
      .catch(() => setRecordChildRows((prev) => ({ ...prev, [cfg.childEntity]: [] })))
      .finally(() => setRecordChildLoading(""))
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
    const colFilterOk = Object.entries(columnFilters).every(([col, q]) => !q.trim() || String(r[col] ?? "").toLowerCase().includes(q.trim().toLowerCase()))
    return searchOk && condOk && colFilterOk
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
    const duplicateCodeField = baseColumns.find((c) => c === "code" || c.endsWith("_code"))
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
      const cols = baseColumns.slice(0, 6)
      const present = cols.filter((c) => String(r[c] ?? "").trim()).length
      return acc + (cols.length ? present / cols.length : 1)
    }, 0) / total) * 100) : 100
    return { total, active, invalidDate, duplicateCount, completeness, integrity: integrityIssues.length }
  }, [rows, activeMeta, integrityIssues])

  // Rows are already server-paginated in fetchEntityRows (limit/offset), so the
  // current page's rows are exactly sortedRows — no second client-side slice.
  // Tree-view entities (self-referential hierarchies): reorder rows so each parent is
  // followed by its expanded children, with depth metadata for indentation.
  const pagedRows = useMemo(() => {
    const treeCfg = TREE_ENTITIES[entity]
    if (!treeCfg) return sortedRows
    // Lazy tree: render from treeRoots (loaded once) and treeChildren (fetched on
    // expand). Children that aren't loaded yet simply aren't shown until expanded.
    const roots = treeRoots ?? []
    const out: RowData[] = []
    // Heuristic for showing the expand chevron before children are fetched:
    // if we've already fetched children, use that; otherwise assume a node MIGHT
    // have children unless it's clearly a leaf. For product-category (HS codes),
    // a 6-digit code is always a leaf; shorter codes can have children.
    const mightHaveChildren = (node: RowData, id: string): boolean => {
      const cached = treeChildren[id]
      if (cached !== undefined) return cached.length > 0
      if (entity === "product-category") {
        const code = String(node.code ?? id)
        return code.replace(/\D/g, "").length < 6 || code === "0"
      }
      return true // unknown until expanded; show chevron, resolve on click
    }
    const visit = (node: RowData, depth: number): void => {
      const id = String(node[treeCfg.idField] ?? "")
      out.push({ ...node, _treeDepth: depth, _treeHasChildren: mightHaveChildren(node, id), _treeId: id })
      if (expandedTreeIds.has(id)) {
        for (const child of treeChildren[id] ?? []) visit(child, depth + 1)
      }
    }
    for (const root of roots) visit(root, 0)
    return out
  }, [entity, sortedRows, expandedTreeIds, treeRoots, treeChildren])

  const isTreeEntity = Boolean(TREE_ENTITIES[entity])
  const totalPages = Math.max(1, Math.ceil((totalRows || sortedRows.length) / pageSize))

  const visibleColumns = useMemo(() => {
    const cols = columnOrder.length ? columnOrder : baseColumns.slice(0, 6)
    const roleFiltered = roleMode === "viewer" ? cols.filter((c) => !c.endsWith("_id")) : cols
    return roleFiltered.filter((c) => !hiddenColumns.includes(c) && !entityHiddenColumns.includes(c))
  }, [baseColumns, hiddenColumns, columnOrder, roleMode, entityHiddenColumns])

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
    // Manual overrides for FK column names whose base doesn't match an entity key.
    const manual: Record<string, string> = {
      parent_group_id: "cost-center-group", // self-reference on cost-center-group
      parent_category_id: "product-category", // self-reference on product-category
    }
    if (manual[columnName]) return manual[columnName]
    if (!columnName.endsWith("_id")) return null
    const base = columnName.slice(0, -3).replaceAll("_", "-")
    return entities.some((e) => e.key === base) ? base : null
  }

  function openCreateModal(): void {
    if (isLockedEntity) {
      setMessage("This master is read-only.")
      return
    }
    const next: Record<string, string> = {}
    for (const col of createFields) {
      if (col === "code") next[col] = "" // SAP-style 4-char code; user fills it in
      else if (col === "name") next[col] = `New ${entityDisplayName(entity)} ${new Date().toISOString().slice(11, 19)}`
      else if (col.endsWith("_code")) next[col] = "" // ISO/short codes: leave blank, let user pick or type
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
    if (isLockedEntity) {
      setMessage("This master is read-only.")
      return
    }
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
    let options = lookupOptions[field] ?? ENUM_FIELD_OPTIONS[field] ?? []
    // Cross-field dependency: on delivery-channel, narrow the Delivery Team dropdown
    // to teams that belong to the selected Delivery Office (delivery-team rows carry
    // a delivery_office_id column). Mirrored for sales-channel with Sales Team/Office.
    if (entity === "delivery-channel" && field === "delivery_team_id") {
      const office = String(createDraft.delivery_office_id ?? "").trim()
      const teamRows = rawLookupRows.delivery_team_id ?? []
      if (office) {
        const allowedIds = new Set(
          teamRows
            .filter((r) => String(r.delivery_office_id ?? "") === office)
            .map((r) => String(r.delivery_team_id ?? "")),
        )
        options = options.filter((o) => allowedIds.has(o.value))
      } else if (teamRows.length > 0) {
        // No office picked yet — block the team list so the user picks office first.
        options = []
      }
    }
    if (entity === "sales-channel" && field === "sales_team_id") {
      const office = String(createDraft.sales_office_id ?? "").trim()
      const teamRows = rawLookupRows.sales_team_id ?? []
      if (office) {
        const allowedIds = new Set(
          teamRows
            .filter((r) => String(r.sales_office_id ?? "") === office)
            .map((r) => String(r.sales_team_id ?? "")),
        )
        options = options.filter((o) => allowedIds.has(o.value))
      } else if (teamRows.length > 0) {
        // No office picked yet — block the team list so the user picks office first.
        options = []
      }
    }
    // Primary/default flags: checkbox (backend keeps only one per parent).
    if (field === "is_primary" || field === "is_default") {
      const checked = ["true", "t", "1", "yes"].includes(String(createDraft[field] ?? "").trim().toLowerCase())
      return (
        <label className="flex h-[34px] cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setCreateDraft((prev) => ({ ...prev, [field]: e.target.checked ? "true" : "false" }))} className="h-4 w-4 accent-primary" />
          <span className="text-muted-foreground">{checked ? "Yes" : "No"}</span>
        </label>
      )
    }
    // Region/City: country-scoped dropdowns backed by the province and city masters.
    if (field === "region" || field === "city") {
      const country = String(createDraft.country_code ?? "").trim().toUpperCase()
      const kind = field === "region" ? "province" : "city"
      if (country) ensureGeoOptions(kind, country)
      const geoOpts = country ? (geoOptions[`${kind}:${country}`] ?? []) : []
      const cur = String(createDraft[field] ?? "")
      const withCurrent = cur && !geoOpts.some((o) => o.value === cur) ? [{ value: cur, label: cur }, ...geoOpts] : geoOpts
      const hint = !country ? "— Pick a Country first —" : geoOpts.length === 0 ? "— No options yet —" : "— Select —"
      return (
        <select
          value={cur}
          onChange={(e) => setCreateDraft((prev) => ({ ...prev, [field]: e.target.value }))}
          className={`w-full rounded border px-2 py-1.5 text-sm ${createErrors[field] ? "border-destructive" : "border-border"} bg-background`}
        >
          <option value="">{hint}</option>
          {withCurrent.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    // Tree-select for hierarchical FK fields (Product Line, HS Code).
    const treeSelCfg = TREE_SELECT_FK_FIELDS[field]
    if (treeSelCfg && (rawLookupRows[field]?.length ?? 0) > 0) {
      let treeRawRows = rawLookupRows[field] ?? []
      let treeOpts = options
      // Cross-field: on service-bom, filter HS Code to only categories assigned to the selected Product Line.
      if (entity === "service-bom" && field === "product_category_id") {
        const selectedPL = String(createDraft.product_line_id ?? "").trim()
        if (selectedPL) {
          const allowedIds = new Set(treeRawRows.filter((r) => String(r.product_line_id ?? "") === selectedPL).map((r) => String(r[treeSelCfg.idField] ?? "")))
          treeRawRows = treeRawRows.filter((r) => allowedIds.has(String(r[treeSelCfg.idField] ?? "")))
          treeOpts = treeOpts.filter((o) => allowedIds.has(o.value))
        } else {
          treeRawRows = []; treeOpts = []
        }
      }
      return (
        <TreeSelectDropdown
          value={createDraft[field] ?? ""}
          onChange={(val) => {
            setCreateDraft((prev) => {
              const next = { ...prev, [field]: val }
              // Reset HS Code when Product Line changes on service-bom.
              if (entity === "service-bom" && field === "product_line_id") next.product_category_id = ""
              return next
            })
          }}
          rawRows={treeRawRows}
          options={treeOpts}
          config={treeSelCfg}
          className={createErrors[field] ? "border-destructive" : "border-border"}
          emptyHint={entity === "service-bom" && field === "product_category_id" && !String(createDraft.product_line_id ?? "").trim() ? "— Pick a Product Line first —" : undefined}
        />
      )
    }
    // Render as dropdown for any FK/code/managed-enum/predefined-enum field,
    // even when the master table is currently empty (then show "— No options yet —").
    const isLookupField = lookupFields.has(field) || !!getManagedEnumKey(field, entity) || !!ENUM_FIELD_OPTIONS[field]
    if (isLookupField) {
      const emptyHint = entity === "delivery-channel" && field === "delivery_team_id" && !createDraft.delivery_office_id
        ? "— Pick a Delivery Office first —"
        : entity === "sales-channel" && field === "sales_team_id" && !createDraft.sales_office_id
        ? "— Pick a Sales Office first —"
        : (options.length === 0 ? "— No options yet —" : "-- Select --")
      return (
        <select
          value={createDraft[field] ?? ""}
          title={options.find((o) => o.value === (createDraft[field] ?? ""))?.label ?? ""}
          onChange={(e) => {
            const val = e.target.value
            setCreateDraft((prev) => {
              const next = { ...prev, [field]: val }
              // Reset the dependent team when the office changes so a stale id can't slip through.
              if (entity === "delivery-channel" && field === "delivery_office_id") next.delivery_team_id = ""
              if (entity === "sales-channel" && field === "sales_office_id") next.sales_team_id = ""
              return next
            })
          }}
          className={`w-full rounded border px-2 py-1.5 text-sm ${createErrors[field] ? "border-destructive" : "border-border"} bg-background`}
        >
          <option value="">{emptyHint}</option>
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
    }
    // SAP-style master-data codes: legal_entity_code is the strict 4-char company code.
    // Other bare 'code' fields (division, cost-center, delivery/sales/purchase-org,
    // credit-area…) allow up to 10 alphanumeric uppercase characters.
    if (field === "legal_entity_code") {
      return (
        <input
          value={createDraft[field] ?? ""}
          maxLength={4}
          onChange={(e) => setCreateDraft((prev) => ({ ...prev, [field]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) }))}
          placeholder="≤ 4 letters/numbers"
          className={`w-full rounded border px-2 py-1.5 text-sm uppercase ${createErrors[field] ? "border-destructive" : "border-border"} bg-background`}
        />
      )
    }
    if (field === "code") {
      const maxLen = CODE_MAX_LENGTH[entity] ?? 10
      return (
        <input
          value={createDraft[field] ?? ""}
          maxLength={maxLen}
          onChange={(e) => setCreateDraft((prev) => ({ ...prev, [field]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLen) }))}
          placeholder={`≤ ${maxLen} letters/numbers`}
          className={`w-full rounded border px-2 py-1.5 text-sm uppercase ${createErrors[field] ? "border-destructive" : "border-border"} bg-background`}
        />
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

  // Resolve a grid cell for display: map foreign-key / code reference fields and
  // managed enums to their human label (using the same option lists the Add/Edit
  // pickers use), so the table shows e.g. "HKG - Hong Kong Office" instead of the
  // raw id "delivery-office-hkg".
  function resolveCellDisplay(field: string, value: unknown): React.ReactNode {
    const s = String(value ?? "").trim()
    if (s === "") return "-"
    if (URL_FIELDS.has(field)) return renderUrlLink(value)
    if (field === "is_primary" || field === "is_default") return s === "true" ? "✓" : "-"
    const opts = lookupOptions[field] ?? ENUM_FIELD_OPTIONS[field]
    if (opts && opts.length) {
      const hit = opts.find((o) => String(o.value) === s)
      if (hit) return hit.label
    }
    return formatCellValue(value)
  }
  function renderEditCell(field: string): React.ReactNode {
    if (field === "code" && SYSTEM_ASSIGNED_CODE_ENTITIES.has(entity)) return <span className="text-xs text-muted-foreground">{editDraft[field] ?? ""}</span>
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
      const current = prev.length ? [...prev] : [...baseColumns.slice(0, 6)]
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
    setHiddenColumns([...GRID_LIFECYCLE_COLUMNS])
    setSortBy(null)
    setPageSize(12)
    setGroupBy("")
    setColumnOrder(baseColumns.slice(0, 6))
    setSelectedColumn("")
    setMenuColumn("")
    setShowLeftPanel(true)
    setLeftPanelWidth(320)
    setColumnPreset("default")
  }

  function applyColumnPreset(mode: "default" | "ops" | "minimal"): void {
    const cols = baseColumns.slice(0, 6)
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
    const cols = [idColumn, ...baseColumns.slice(0, 6), "status", "valid_from", "valid_to"]
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

  async function syncSelectedRegulation(): Promise<void> {
    if (entity !== "regulation") return
    const row = getSelectedRow()
    if (!row) return setMessage("Please select a regulation first")
    const regulationId = getRowId(row)
    if (!regulationId) return setMessage("Selected regulation has no ID")
    setRegulationSyncLoading(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/regulation/${encodeURIComponent(regulationId)}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: "admin-user", force: false }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string; item?: { createdVersion?: boolean; chunkCount?: number; sourceUrl?: string; title?: string } }
      if (!resp.ok || !data.ok) return setMessage(`Regulation sync failed: ${data.detail ?? "unknown"}`)
      setMessage(
        data.item?.createdVersion
          ? `Regulation synced: ${data.item.title ?? regulationId} (new version)`
          : `Regulation checked: ${data.item?.title ?? regulationId} (no change)`
      )
      await loadEntity(entity)
    } catch (error) {
      setMessage(`Regulation sync failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setRegulationSyncLoading(false)
    }
  }

  async function proposeRequirementsForSelectedVersion(): Promise<void> {
    if (entity !== "regulation-version") return
    const row = getSelectedRow()
    if (!row) return setMessage("Please select a regulation version first")
    const versionId = String(row.regulation_version_id ?? "")
    if (!versionId) return setMessage("Selected version has no ID")
    setRequirementProposalLoading(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/regulation-version/${encodeURIComponent(versionId)}/requirements/propose`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: "admin-user", max_requirements: 25 }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string; item?: { created?: number; skipped?: number; items?: unknown[] } }
      if (!resp.ok || !data.ok) return setMessage(`Requirement proposal failed: ${data.detail ?? "unknown"}`)
      setMessage(`Requirement proposals: created ${data.item?.created ?? 0}, skipped ${data.item?.skipped ?? 0}`)
      await loadEntity(entity)
    } catch (error) {
      setMessage(`Requirement proposal failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setRequirementProposalLoading(false)
    }
  }

  async function refreshStandardCatalog(): Promise<void> {
    if (!["standard", "standard-source", "standard-ingest-run"].includes(entity)) return
    setStandardRefreshLoading(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/standard-catalog-refresh/run-once", {
        method: "POST",
        headers: { "content-type": "application/json" },
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string; summary?: Record<string, number> }
      if (!resp.ok || !data.ok) return setMessage(`Standard refresh failed: ${data.detail ?? "unknown"}`)
      const summary = data.summary ?? {}
      setMessage(`Standard catalog refreshed: changed ${summary.standardChanged ?? 0}, unchanged ${summary.standardUnchanged ?? 0}, errors ${summary.standardErrors ?? 0}`)
      await loadEntity(entity)
    } catch (error) {
      setMessage(`Standard refresh failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setStandardRefreshLoading(false)
    }
  }

  async function runDiscoveryFeeds(): Promise<void> {
    if (!["discovery-feed", "discovery-run", "regulation"].includes(entity)) return
    setDiscoveryRunLoading(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/discovery/run-once", {
        method: "POST",
        headers: { "content-type": "application/json" },
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string; summary?: Record<string, number> }
      if (!resp.ok || !data.ok) return setMessage(`Discovery run failed: ${data.detail ?? "unknown"}`)
      const summary = data.summary ?? {}
      setMessage(`Discovery run: feeds ${summary.discoveryFeedsScanned ?? 0}, items ${summary.discoveryItemsFound ?? 0}, new draft regulations ${summary.discoveryRegulationsCreated ?? 0}, errors ${summary.discoveryErrors ?? 0}`)
      await loadEntity(entity)
    } catch (error) {
      setMessage(`Discovery run failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setDiscoveryRunLoading(false)
    }
  }

  async function reviewSelectedRequirement(action: "approve" | "reject"): Promise<void> {
    if (entity !== "requirement") return
    const row = getSelectedRow()
    if (!row) return setMessage("Please select a draft requirement first")
    const requirementId = String(row.requirement_id ?? "")
    if (!requirementId) return setMessage("Selected requirement has no ID")
    if (String(row.status ?? "") !== "draft") return setMessage("Only draft requirements can be reviewed (select a row with status 'draft')")
    setRequirementReviewLoading(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/requirement/${encodeURIComponent(requirementId)}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, actor: "admin-user" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string; status?: string }
      if (!resp.ok || !data.ok) return setMessage(`Review failed: ${data.detail ?? "unknown"}`)
      setMessage(`Requirement ${action === "approve" ? "approved (now active)" : "rejected (archived)"}: ${requirementId}`)
      await loadEntity(entity)
    } catch (error) {
      setMessage(`Review failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setRequirementReviewLoading(false)
    }
  }

  async function showSelectedRequirementSource(): Promise<void> {
    if (entity !== "requirement") return
    const row = getSelectedRow()
    if (!row) return setMessage("Please select a requirement first")
    try {
      const provenance = JSON.parse(String(row.provenance_json ?? "") || "{}") as { regulation_chunk_id?: string; section_path?: string }
      const resp = await fetch(`/api/proxy/api/v1/mdm/requirements/review-queue?limit=200`)
      const data = (await resp.json()) as { items?: Array<Record<string, unknown>> }
      const match = (data.items ?? []).find((item) => item.requirement_id === row.requirement_id)
      const sourceText = String(match?.source_chunk_text ?? "").slice(0, 600)
      if (sourceText) setMessage(`Source clause [${match?.source_section_path ?? provenance.section_path ?? "?"}] (${match?.regulation_code ?? ""}): ${sourceText}`)
      else setMessage("No source clause found for this requirement (manual entry or chunk archived)")
    } catch (error) {
      setMessage(`Source lookup failed: ${error instanceof Error ? error.message : "unknown error"}`)
    }
  }

  async function acknowledgeSelectedChangeEvent(): Promise<void> {
    if (entity !== "regulation-change-event") return
    const row = getSelectedRow()
    if (!row) return setMessage("Please select a regulation change event first")
    const eventId = String(row.regulation_change_event_id ?? "")
    if (!eventId) return setMessage("Selected change event has no ID")
    setChangeEventAckLoading(true)
    try {
      const resp = await fetch(`/api/proxy/api/v1/mdm/regulation-change-events/${encodeURIComponent(eventId)}/acknowledge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: "admin-user" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) return setMessage(`Acknowledge failed: ${data.detail ?? "unknown"}`)
      setMessage(`Change event acknowledged: ${eventId}`)
      await loadEntity(entity)
    } catch (error) {
      setMessage(`Acknowledge failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setChangeEventAckLoading(false)
    }
  }

  async function searchApplicableRequirements(): Promise<void> {
    setApplicableSearchLoading(true)
    try {
      const qs = new URLSearchParams()
      if (applicableDraft.jurisdiction.trim()) qs.set("jurisdiction", applicableDraft.jurisdiction.trim())
      if (applicableDraft.hsCode.trim()) qs.set("hsCode", applicableDraft.hsCode.trim())
      if (applicableDraft.category.trim()) qs.set("category", applicableDraft.category.trim())
      if (applicableDraft.effectiveOn.trim()) qs.set("effectiveOn", applicableDraft.effectiveOn.trim())
      const resp = await fetch(`/api/proxy/api/v1/mdm/requirements/applicable?${qs.toString()}`)
      const data = (await resp.json()) as { ok?: boolean; detail?: string; items?: ApplicableRequirementResult[] }
      if (!resp.ok || !data.ok) return setMessage(`Applicable requirement search failed: ${data.detail ?? "unknown"}`)
      setApplicableResults(data.items ?? [])
      setMessage(`Applicable requirements found: ${(data.items ?? []).length}`)
    } catch (error) {
      setMessage(`Applicable requirement search failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setApplicableSearchLoading(false)
    }
  }

  async function loadComplianceOverview(): Promise<void> {
    setComplianceOverviewLoading(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm/compliance/overview")
      const data = (await resp.json()) as ComplianceOverview & { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) {
        setMessage(`Compliance overview failed: ${data.detail ?? "unknown"}`)
        return
      }
      setComplianceOverview(data)
    } catch (error) {
      setMessage(`Compliance overview failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setComplianceOverviewLoading(false)
    }
  }

  async function loadComplianceFlowStats(): Promise<void> {
    try {
      const fetchCount = async (entityKey: string): Promise<RowData[]> => {
        const r = await fetch(`/api/proxy/api/v1/mdm/${entityKey}?limit=5000&offset=0`)
        const d = (await r.json()) as { items?: RowData[] }
        return (d.items ?? []).filter((i) => String(i.status ?? "") !== "archived")
      }
      const [regs, stds, reqs, reqSIs] = await Promise.all([
        fetchCount("regulation"),
        fetchCount("standard"),
        fetchCount("requirement"),
        fetchCount("requirement-service-item"),
      ])
      // A regulation is "linked" if any requirement references one of its versions.
      // Since requirements reference regulation_version_id, we need regulation-version to map back.
      const regVersions = await fetchCount("regulation-version")
      const regIdsWithReq = new Set<string>()
      for (const req of reqs) {
        const rvId = String(req.regulation_version_id ?? "")
        if (rvId) {
          const rv = regVersions.find((v) => String(v.regulation_version_id ?? "") === rvId)
          if (rv) regIdsWithReq.add(String(rv.regulation_id ?? ""))
        }
      }
      // A standard is linked if any requirement references it.
      const stdIdsWithReq = new Set(reqs.map((r) => String(r.standard_id ?? "")).filter(Boolean))
      // A requirement is linked if it appears in requirement-service-item.
      const reqIdsLinked = new Set(reqSIs.map((r) => String(r.requirement_id ?? "")))
      setComplianceFlowStats({
        regTotal: regs.length,
        regLinked: regs.filter((r) => regIdsWithReq.has(String(r.regulation_id ?? ""))).length,
        stdTotal: stds.length,
        stdLinked: stds.filter((s) => stdIdsWithReq.has(String(s.standard_id ?? ""))).length,
        reqTotal: reqs.length,
        reqLinked: reqs.filter((r) => reqIdsLinked.has(String(r.requirement_id ?? ""))).length,
        siTotal: new Set(reqSIs.map((r) => String(r.service_item_id ?? ""))).size,
      })
    } catch {
      // Non-critical; dashboard still works without flow stats
    }
  }

  async function loadRegulationAdapters(): Promise<void> {
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm-workflow/regulation-source-adapters")
      const data = (await resp.json()) as { ok?: boolean; items?: RegulationSourceAdapter[] }
      if (resp.ok && data.ok) setRegulationAdapters(data.items ?? [])
    } catch {
      setRegulationAdapters([])
    }
  }

  async function publishPendingOutbox(): Promise<void> {
    setOutboxPublishLoading(true)
    try {
      const resp = await fetch("/api/proxy/api/v1/mdm/ops/event-outbox/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: "mdm.regulation.changed", actor: "admin-user", limit: 25 }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string; attempted?: number; sent?: number; failed?: number; skipped?: number }
      if (!resp.ok || !data.ok) return setMessage(`Outbox publish failed: ${data.detail ?? "unknown"}`)
      setMessage(`Outbox publish: attempted ${data.attempted ?? 0}, sent ${data.sent ?? 0}, failed ${data.failed ?? 0}, skipped ${data.skipped ?? 0}`)
      await loadComplianceOverview()
    } catch (error) {
      setMessage(`Outbox publish failed: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      setOutboxPublishLoading(false)
    }
  }

  async function archiveSelected(): Promise<void> {
    const row = getSelectedRow()
    if (!row) return setMessage("Please select one row first")
    setDeleteConfirm({
      title: "Confirm Delete",
      message: "Delete this record permanently? This action cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        await archiveRow(row)
      },
    })
  }

  // Inline (in-grid) edit of the selected row — no modal popup.
  function startInlineEditSelected(): void {
    if (isLockedEntity) {
      setMessage("This master is read-only.")
      return
    }
    const row = getSelectedRow()
    if (!row) return setMessage("Please select one row first")
    const rowId = String(row[idColumn] ?? "")
    const next: Record<string, string> = {}
    for (const col of baseColumns) next[col] = String(row[col] ?? "")
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
    if (isLockedEntity) {
      setMessage("This master is read-only.")
      return
    }
    // Prefer multi-select (checkboxes); fall back to the legacy single-row selection.
    const ids = selectedRowIds.length > 0
      ? selectedRowIds
      : (getSelectedRow() ? [String(getSelectedRow()![idColumn] ?? "")] : [])
    if (ids.length === 0) return setMessage("Please select one or more rows first")
    setDeleteConfirm({
      title: "Confirm Delete",
      message: `Delete ${ids.length} selected record${ids.length === 1 ? "" : "s"} permanently? This action cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        let okCount = 0
        let failCount = 0
        for (const rowId of ids) {
          if (!rowId) { failCount += 1; continue }
          try {
            const resp = await fetch(`/api/proxy/api/v1/mdm/${encodeURIComponent(entity)}/${encodeURIComponent(rowId)}`, { method: "DELETE" })
            if (resp.ok) okCount += 1
            else failCount += 1
          } catch {
            failCount += 1
          }
        }
        setMessage(failCount === 0 ? `Deleted ${okCount} row${okCount === 1 ? "" : "s"}` : `Delete partial: ${okCount} ok, ${failCount} failed`)
        setSelectedRowIds([])
        await loadEntity(entity)
      },
    })
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
      if (col === "code") {
        const codeMax = CODE_MAX_LENGTH[entity]
        payload.code = codeMax
          ? Date.now().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-codeMax)
          : `${entity.toUpperCase().slice(0, 5)}-${Date.now()}`
      }
      if (col === "name") payload.name = `New ${entityDisplayName(entity)} ${new Date().toISOString().slice(11, 19)}`
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
    const cols = [idColumn, ...baseColumns.slice(0, 6), "status", "valid_from", "valid_to"]
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
    for (const col of createFields) next[col] = String(row[col] ?? "")
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
      : baseColumns.filter((c) => c === "code" || c.endsWith("_code") || c === "name" || c.endsWith("_name") || c === "title")
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
    if (isLockedEntity) {
      setMessage("This master is read-only.")
      return
    }
    if (!validateDraft()) return setMessage("Please fix field validation errors")
    const duplicateCodeField = baseColumns.find((c) => c === "code" || c.endsWith("_code"))
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
      if (resp.status === 404 || String(data.detail ?? "").toLowerCase().includes("record not found")) {
        setEditingId("")
        setEditDraft({})
        setMessage("Record was refreshed because it no longer exists on the server.")
        await loadEntity(entity)
        return
      }
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
    const keys = [...baseColumns.slice(0, 6), "status", "valid_from", "valid_to"]
    return keys.some((k) => String(row[k] ?? "") !== String(editDraft[k] ?? ""))
  }

  const rowCellPaddingClass = rowDensity === "compact" ? "px-3 py-1.5" : "px-3 py-2"
  const selectedCount = selectedRowIds.length
  const effectiveRoles = (authMe.roles ?? []).map((r) => String(r).toLowerCase())
  const effectivePerms = (authMe.permissions ?? []).map((p) => String(p))
  const isLockedEntity = LOCKED_MDM_ENTITIES.has(entity)
  const canWrite = !isLockedEntity && (effectivePerms.includes("mdm.write") || effectiveRoles.includes("admin") || roleMode !== "viewer")
  const canDelete = !isLockedEntity && (effectivePerms.includes("mdm.delete") || effectiveRoles.includes("admin") || roleMode === "admin")
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

  if (activeItem === "mdm-compliance-dashboard" || activeItem === "compliance-dashboard") {
    const metrics = complianceOverview?.metrics ?? {}
    const fs = complianceFlowStats
    const cards = [
      { label: "Regulations", value: metrics.regulations?.total ?? 0, sub: `${metrics.regulations?.active ?? 0} active`, entity: "regulation" },
      { label: "Standards", value: metrics.standards?.total ?? 0, sub: `${metrics.standards?.active ?? 0} active`, entity: "standard" },
      { label: "Requirements", value: metrics.requirements?.total ?? 0, sub: `${metrics.requirements?.active ?? 0} active · ${metrics.requirements?.draft ?? 0} draft`, entity: "requirement" },
      { label: "Open Changes", value: metrics.change_events?.open ?? 0, sub: `${metrics.change_events?.total ?? 0} total events`, entity: "regulation-change-event" },
    ]
    // Flowchart node helper
    const FlowNode = ({ icon, label, total, linked, unlinked, color, entityKey }: {
      icon: React.ReactNode; label: string; total: number; linked: number; unlinked: number; color: string; entityKey: string
    }) => (
      <button type="button" onClick={() => void loadEntity(entityKey)} className={`group flex flex-col items-center rounded-xl border-2 bg-card p-5 shadow-sm transition hover:shadow-md ${color}`} style={{ minWidth: 160 }}>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">{icon}</div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-1 text-2xl font-bold">{total}</div>
        {linked > 0 || unlinked > 0 ? (
          <div className="mt-1.5 flex items-center gap-3 text-xs">
            {linked > 0 && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" />{linked} linked</span>}
            {unlinked > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-3 w-3" />{unlinked} pending</span>}
          </div>
        ) : <div className="mt-1.5 text-xs text-muted-foreground">loading...</div>}
      </button>
    )
    const FlowArrow = () => (
      <div className="flex items-center px-1"><ArrowRight className="h-5 w-5 text-muted-foreground" /></div>
    )
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Compliance Dashboard</h1>
                <p className="text-sm text-muted-foreground">From regulations & standards to testable requirements and service items.</p>
              </div>
            </div>
            <button
              onClick={() => { void loadComplianceOverview(); void loadComplianceFlowStats() }}
              disabled={complianceOverviewLoading}
              className="inline-flex items-center gap-2 rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {complianceOverviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
        {message && (
          <div data-ui-error={messageIsError ? "true" : "false"} className={`mb-3 text-xs ${messageIsError ? "text-destructive" : "text-primary"}`}>
            {message}
          </div>
        )}
        <div className="flex-1 overflow-auto p-6">

        {/* === Compliance Flow Diagram === */}
        <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Compliance Flow</div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Source: Regulation */}
            <FlowNode
              icon={<FileText className="h-5 w-5 text-blue-600" />}
              label="Regulations" total={fs?.regTotal ?? 0}
              linked={fs?.regLinked ?? 0} unlinked={(fs?.regTotal ?? 0) - (fs?.regLinked ?? 0)}
              color="border-blue-200 hover:border-blue-400" entityKey="regulation"
            />
            <div className="flex flex-col items-center gap-1">
              <FlowArrow />
            </div>
            {/* Source: Standard (merged stream) */}
            <FlowNode
              icon={<ShieldCheck className="h-5 w-5 text-violet-600" />}
              label="Standards" total={fs?.stdTotal ?? 0}
              linked={fs?.stdLinked ?? 0} unlinked={(fs?.stdTotal ?? 0) - (fs?.stdLinked ?? 0)}
              color="border-violet-200 hover:border-violet-400" entityKey="standard"
            />
            <div className="flex flex-col items-center gap-1">
              <FlowArrow />
            </div>
            {/* Requirement */}
            <FlowNode
              icon={<ClipboardList className="h-5 w-5 text-amber-600" />}
              label="Requirements" total={fs?.reqTotal ?? 0}
              linked={fs?.reqLinked ?? 0} unlinked={(fs?.reqTotal ?? 0) - (fs?.reqLinked ?? 0)}
              color="border-amber-200 hover:border-amber-400" entityKey="requirement"
            />
            <div className="flex flex-col items-center gap-1">
              <FlowArrow />
            </div>
            {/* Service Item */}
            <FlowNode
              icon={<Wrench className="h-5 w-5 text-emerald-600" />}
              label="Service Items" total={fs?.siTotal ?? 0}
              linked={fs?.siTotal ?? 0} unlinked={0}
              color="border-emerald-200 hover:border-emerald-400" entityKey="service-item"
            />
          </div>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Click any node to open its entity list. <span className="text-amber-600 font-medium">Pending</span> = not yet linked to the next stage.
          </div>
        </div>

        {/* === Pending Items Alert === */}
        {fs && ((fs.regTotal - fs.regLinked > 0) || (fs.stdTotal - fs.stdLinked > 0)) && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">Awaiting Requirement Extraction</div>
                <div className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  {fs.regTotal - fs.regLinked > 0 && <span className="mr-4"><strong>{fs.regTotal - fs.regLinked}</strong> regulation{fs.regTotal - fs.regLinked > 1 ? "s" : ""} not yet linked to requirements.</span>}
                  {fs.stdTotal - fs.stdLinked > 0 && <span><strong>{fs.stdTotal - fs.stdLinked}</strong> standard{fs.stdTotal - fs.stdLinked > 1 ? "s" : ""} not yet linked to requirements.</span>}
                </div>
                <div className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">These items need requirement extraction or manual linkage before they can drive service items and costing.</div>
              </div>
            </div>
          </div>
        )}

        {/* === KPI Cards === */}
        <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {cards.map((card) => (
            <button key={card.label} type="button" onClick={() => void loadEntity(card.entity)} className="rounded-lg border border-border bg-card p-4 text-left shadow-sm transition hover:shadow-md hover:border-primary/40">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold">{card.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{card.sub}</div>
            </button>
          ))}
        </div>

        {/* === Operational Panels === */}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">Source Health</div>
              <div className="text-xs text-muted-foreground">Latest source refresh status by source type</div>
            </div>
            <div className="max-h-80 overflow-auto p-4">
              {(complianceOverview?.source_status ?? []).length ? (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground"><tr><th className="pb-2 text-left">Kind</th><th className="pb-2 text-left">Status</th><th className="pb-2 text-right">Count</th></tr></thead>
                  <tbody>
                    {(complianceOverview?.source_status ?? []).map((row, idx) => (
                      <tr key={`${row.source_kind}-${row.status}-${idx}`} className="border-t border-border">
                        <td className="py-2 capitalize">{row.source_kind}</td>
                        <td className="py-2">{row.status}</td>
                        <td className="py-2 text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-sm text-muted-foreground">No source status yet.</div>}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Propagation Outbox</div>
                <div className="text-xs text-muted-foreground">`mdm.regulation.changed` delivery status</div>
              </div>
              {canWrite && (
                <button
                  onClick={() => void publishPendingOutbox()}
                  disabled={outboxPublishLoading}
                  className="inline-flex items-center gap-1 rounded-md border border-primary px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {outboxPublishLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {outboxPublishLoading ? "Publishing..." : "Publish Pending"}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-auto p-4">
              {(complianceOverview?.event_outbox ?? []).length ? (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground"><tr><th className="pb-2 text-left">Status</th><th className="pb-2 text-right">Count</th></tr></thead>
                  <tbody>
                    {(complianceOverview?.event_outbox ?? []).map((row) => (
                      <tr key={row.status} className="border-t border-border">
                        <td className="py-2 capitalize">{row.status}</td>
                        <td className="py-2 text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-sm text-muted-foreground">No propagated change events yet.</div>}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">Recent Ingest Runs</div>
              <div className="text-xs text-muted-foreground">Newest regulation and standard collection runs</div>
            </div>
            <div className="max-h-80 overflow-auto p-4">
              {(complianceOverview?.recent_runs ?? []).length ? (
                <div className="space-y-3">
                  {(complianceOverview?.recent_runs ?? []).map((run, idx) => (
                    <div key={`${run.run_kind}-${run.started_at}-${idx}`} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium capitalize">{run.run_kind}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{run.run_status}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{run.source_url ? renderUrlLink(run.source_url) : (run.detail || "-")}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{run.started_at || "-"}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-sm text-muted-foreground">No ingest runs yet.</div>}
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Generated {complianceOverview?.generated_at ? new Date(complianceOverview.generated_at).toLocaleString() : "not yet loaded"}.
        </div>
      </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
          {(() => { const Icon = getEntityIcon(entity); return (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          ) })()}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{entityDisplayName(entity)}</h1>
            {isLockedEntity && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Lock className="h-3 w-3" />
                Read-only master
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!recordView && (
          <button
            onClick={() => setShowLeftPanel((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${!showLeftPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Query
          </button>
          )}
          {!recordView && (
          <button
            onClick={() => setShowRightPanel((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${!showRightPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Builder
          </button>
          )}
          {entity === "regulation" && canWrite && (
            <button
              onClick={() => void syncSelectedRegulation()}
              disabled={regulationSyncLoading}
              className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {regulationSyncLoading ? "Syncing..." : "Sync"}
            </button>
          )}
          {entity === "regulation-version" && canWrite && (
            <button
              onClick={() => void proposeRequirementsForSelectedVersion()}
              disabled={requirementProposalLoading}
              className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {requirementProposalLoading ? "Proposing..." : "Propose Requirements"}
            </button>
          )}
          {["standard", "standard-source", "standard-ingest-run"].includes(entity) && canWrite && (
            <button
              onClick={() => void refreshStandardCatalog()}
              disabled={standardRefreshLoading}
              className="inline-flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {standardRefreshLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {standardRefreshLoading ? "Refreshing..." : "Refresh Catalog"}
            </button>
          )}
          {["discovery-feed", "discovery-run"].includes(entity) && canWrite && (
            <button
              onClick={() => void runDiscoveryFeeds()}
              disabled={discoveryRunLoading}
              className="inline-flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {discoveryRunLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {discoveryRunLoading ? "Discovering..." : "Run Discovery"}
            </button>
          )}
          {entity === "requirement" && canWrite && (
            <>
              <button
                onClick={() => void reviewSelectedRequirement("approve")}
                disabled={requirementReviewLoading}
                className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requirementReviewLoading ? "Reviewing..." : "Approve Draft"}
              </button>
              <button
                onClick={() => void reviewSelectedRequirement("reject")}
                disabled={requirementReviewLoading}
                className="rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reject Draft
              </button>
              <button
                onClick={() => void showSelectedRequirementSource()}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/40"
              >
                View Source Clause
              </button>
            </>
          )}
          {entity === "regulation-change-event" && canWrite && (
            <button
              onClick={() => void acknowledgeSelectedChangeEvent()}
              disabled={changeEventAckLoading}
              className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {changeEventAckLoading ? "Acknowledging..." : "Acknowledge"}
            </button>
          )}
          {canWrite && !isLockedEntity && <button onClick={openCreateModal} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">+ Add</button>}
        </div>
      </div>
      </div>
      {message && (
        <div data-ui-error={messageIsError ? "true" : "false"} className={`mb-3 text-xs ${messageIsError ? "text-destructive" : "text-primary"}`}>
          {message}
        </div>
      )}
      <div className="flex-1 overflow-auto p-6">

      {entity === "regulation-source" && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Crawler Adapter Guide</div>
              <p className="text-xs text-muted-foreground">Set `parser_type` on each source to prefer official APIs where available, with generic web/PDF fallback.</p>
            </div>
            <button
              onClick={() => void loadRegulationAdapters()}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(regulationAdapters.length ? regulationAdapters : [
              { key: "generic-web", label: "Generic web/PDF crawler", parserTypes: ["auto", "web"], sourceType: "web", description: "Fetches the configured URL directly." },
            ]).map((adapter) => (
              <div key={adapter.key} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{adapter.label}</div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{adapter.sourceType ?? "web"}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{adapter.description ?? "-"}</div>
                <div className="mt-2 text-[11px] text-muted-foreground">parser_type: {(adapter.parserTypes ?? []).join(", ") || adapter.key}</div>
                {(adapter.domains ?? []).length > 0 && <div className="mt-1 text-[11px] text-muted-foreground">domains: {(adapter.domains ?? []).join(", ")}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {entity === "requirement" && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Applicable Requirements Lookup</div>
              <p className="text-xs text-muted-foreground">Find active requirements by target jurisdiction, HS code/category, and effective date for quotation planning.</p>
            </div>
            <button
              onClick={() => void searchApplicableRequirements()}
              disabled={applicableSearchLoading}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applicableSearchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              {applicableSearchLoading ? "Searching..." : "Find Applicable"}
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={applicableDraft.jurisdiction}
              onChange={(e) => setApplicableDraft((prev) => ({ ...prev, jurisdiction: e.target.value }))}
              placeholder="Jurisdiction ID or code"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={applicableDraft.hsCode}
              onChange={(e) => setApplicableDraft((prev) => ({ ...prev, hsCode: e.target.value }))}
              placeholder="HS code, e.g. 850440"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={applicableDraft.category}
              onChange={(e) => setApplicableDraft((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Category, e.g. power-supply"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={applicableDraft.effectiveOn}
              onChange={(e) => setApplicableDraft((prev) => ({ ...prev, effectiveOn: e.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {applicableResults.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-md border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Requirement</th>
                    <th className="px-3 py-2 text-left font-semibold">Jurisdiction</th>
                    <th className="px-3 py-2 text-left font-semibold">Origin</th>
                    <th className="px-3 py-2 text-left font-semibold">Service Items</th>
                    <th className="px-3 py-2 text-left font-semibold">BOM Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applicableResults.slice(0, 8).map((item) => {
                    const serviceItems = item.service_items ?? []
                    const bomLineCount = serviceItems.reduce((total, serviceItem) => total + (serviceItem.boms ?? []).reduce((sum, bom) => sum + (bom.lines?.length ?? 0), 0), 0)
                    return (
                      <tr key={item.requirement_id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.requirement_code || item.requirement_id}</div>
                          <div className="text-xs text-muted-foreground">{item.title || item.requirement_type || "-"}</div>
                        </td>
                        <td className="px-3 py-2">{item.jurisdiction_code || item.jurisdiction_name || "-"}</td>
                        <td className="px-3 py-2">{item.regulation_code || item.standard_code || "-"}</td>
                        <td className="px-3 py-2">{serviceItems.map((serviceItem) => serviceItem.service_item_code || serviceItem.service_item_name || serviceItem.service_item_id).filter(Boolean).join(", ") || "-"}</td>
                        <td className="px-3 py-2">{bomLineCount}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto">
        {showLeftPanel && (
        <aside className="relative shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden" style={{ width: `${leftPanelWidth}px`, minWidth: `${leftPanelWidth}px` }}>
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
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{queryGroup.conditions.length + queryGroup.groups.length} rules</span>
              <span className={`text-muted-foreground transition-transform ${querySectionOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {querySectionOpen && (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <QueryBuilder fields={mdmQueryFields} query={queryGroup} onChange={setQueryGroup} storageKey={`qb.mdm.${entity}`} />
            </div>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setOpsSectionOpen((v) => !v)}
              aria-expanded={opsSectionOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 text-sm font-semibold">Data Operations</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Export · Import</span>
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
                          {[idColumn, ...baseColumns.slice(0, 6), "status", "valid_from", "valid_to"].map((f) => (
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

        <div ref={gridCardRef} className="flex h-full min-h-0 min-w-[760px] flex-1 flex-col overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
        {recordView ? (() => {
          const rmeta = entities.find((e) => e.key === recordView.entityKey) ?? activeMeta
          const recordHiddenColumns = getEntityHiddenColumns(recordView.entityKey)
          const rfields = [...(rmeta?.columns ?? []).filter((c) => !recordHiddenColumns.includes(c)), "status", "valid_from", "valid_to"]
          const groups = recordView.entityKey === "credit-area"
            ? groupFieldsByTopic(rfields, recordView.entityKey).filter((g) => g.label !== "Details")
            : groupFieldsByTopic(rfields, recordView.entityKey)
          const children = SUBTABLES[recordView.entityKey] ?? []
          const childGroupRows = recordChildRows[COST_CENTER_GROUP_CHILD_ENTITY] ?? []
          const childCostCenterRows = recordChildRows[COST_CENTER_GROUP_COST_CENTER_ENTITY] ?? []
          const childCategoryRows = recordChildRows["product-category"] ?? []
          const childFeatureRows = recordChildRows["feature-of-product"] ?? []
          const costCenterGroupAssignmentsReady = recordView.entityKey !== "cost-center-group"
            || (recordChildRows[COST_CENTER_GROUP_CHILD_ENTITY] !== undefined && recordChildRows[COST_CENTER_GROUP_COST_CENTER_ENTITY] !== undefined)
          const visibleChildren = recordView.entityKey === "cost-center-group"
            ? children.filter((c) => {
              if (childGroupRows.length > 0) return c.childEntity === COST_CENTER_GROUP_CHILD_ENTITY
              if (childCostCenterRows.length > 0) return c.childEntity === COST_CENTER_GROUP_COST_CENTER_ENTITY
              return true
            })
            : recordView.entityKey === "product-category"
            ? children.filter((c) => {
              if (childCategoryRows.length > 0) return c.childEntity === "product-category"
              if (childFeatureRows.length > 0) return c.childEntity === "feature-of-product"
              return true
            })
            : children
          const rrow = recordView.row
          const rtitle = String(rrow.name_short_en ?? rrow.name ?? rrow.name_en ?? rrow[(rmeta?.columns ?? [])[0]] ?? "")
          const lineCfg = visibleChildren.find((c) => c.childEntity === recordLineTab) ?? visibleChildren[0]
          const lineRows = lineCfg ? (recordChildRows[lineCfg.childEntity] ?? []) : []
          const hasFlag = (rmeta?.columns ?? []).includes("alpha2")
          const selRow = lineCfg ? lineRows.find((cr) => String(cr[childIdCol(lineCfg.childEntity)] ?? "") === selectedLineId) : undefined
          // Fields that should start on a new grid row (col-start-1).
          const newRowFields = (recordView.entityKey === "customer" || recordView.entityKey === "vendor") ? new Set(["website_url"]) : new Set<string>()
          const fieldRow = (f: string, val: React.ReactNode) => (
            <div key={f} className={`flex min-w-0 flex-col gap-0.5${newRowFields.has(f) ? " col-start-1" : ""}`}>
              <span className="truncate text-[11px] text-muted-foreground">{humanizeLabel(f)}</span>
              <div className="min-w-0 break-words">{val}</div>
            </div>
          )
          const filteredLineRows = lineRows.filter((r) => Object.entries(lineColFilters).every(([c, q]) => !q.trim() || String(r[c] ?? "").toLowerCase().includes(q.trim().toLowerCase())))
          // Default sort: by line_no ascending if the child table has line numbers and user hasn't chosen another sort.
          const hasLineNoCol = lineCfg ? lineCfg.columns.includes("line_no") : false
          const sortedLineRows = lineSortBy
            ? [...filteredLineRows].sort((a, b) => { const cmp = String(a[lineSortBy.field] ?? "").localeCompare(String(b[lineSortBy.field] ?? ""), undefined, { numeric: true, sensitivity: "base" }); return lineSortBy.dir === "asc" ? cmp : -cmp })
            : hasLineNoCol
              ? [...filteredLineRows].sort((a, b) => (Number(a.line_no ?? Number.MAX_SAFE_INTEGER) - Number(b.line_no ?? Number.MAX_SAFE_INTEGER)))
              : filteredLineRows
          const lineGroups = lineGroupBy ? Object.entries(sortedLineRows.reduce<Record<string, RowData[]>>((m, r) => { const k = String(r[lineGroupBy] ?? "(blank)"); (m[k] = m[k] || []).push(r); return m }, {})).map(([key, rows]) => ({ key, rows })) : [{ key: "", rows: sortedLineRows }]
          const costCenterGroupAssignCfg = children.find((c) => c.childEntity === COST_CENTER_GROUP_CHILD_ENTITY)
          const costCenterAssignCfg = children.find((c) => c.childEntity === COST_CENTER_GROUP_COST_CENTER_ENTITY)
          const creditAreaConfig = recordView.entityKey === "credit-area" ? creditAreaConfigFor(rrow) : defaultCreditAreaConfig()
          // Credit area ↔ legal entity is many-to-many via the credit-area-legal-entity join table.
          const creditAreaJoinRows = recordChildRows["credit-area-legal-entity"] ?? []
          const resolveLegalEntity = (leId: string): { label: string; region: string } => {
            const le = creditAreaLegalEntityCandidates.find((c) => String(c.legal_entity_id ?? "") === leId)
            return {
              label: le ? String(le.legal_entity_name ?? le.name ?? le.legal_entity_code ?? le.code ?? leId).trim() : leId,
              region: le ? String(le.country_code ?? "").trim() : "",
            }
          }
          const assignedLegalEntities = creditAreaJoinRows
            .filter((jr) => String(jr.status ?? "") !== "archived")
            .map((jr) => {
              const id = String(jr.legal_entity_id ?? "")
              const { label, region } = resolveLegalEntity(id)
              return { joinId: String(jr.credit_area_legal_entity_id ?? ""), id, label, region, joinRow: jr }
            })
          const creditAreaSearchTerm = creditAreaEntitySearch.trim().toLowerCase()
          const filteredAssignedEntities = creditAreaSearchTerm
            ? assignedLegalEntities.filter((e) => `${e.label} ${e.region}`.toLowerCase().includes(creditAreaSearchTerm))
            : assignedLegalEntities
          // Cost Center Group ↔ Cost Center is many-to-many via the cost-center-group-map join table —
          // same shape as Credit Area ↔ Legal Entity above, just resolved against cost-center records.
          const costCenterGroupMapRows = recordChildRows[COST_CENTER_GROUP_COST_CENTER_ENTITY] ?? []
          const resolveGroupCostCenter = (ccId: string): { label: string; code: string; status: string } => {
            const cc = costCenterGroupCostCenterCandidates.find((c) => String(c.cost_center_id ?? "") === ccId)
            return {
              label: cc ? String(cc.name ?? cc.code ?? ccId).trim() : ccId,
              code: cc ? String(cc.code ?? "").trim() : "",
              status: cc ? String(cc.status ?? "").trim() : "",
            }
          }
          const assignedGroupCostCenters = costCenterGroupMapRows
            .filter((mr) => String(mr.status ?? "") !== "archived")
            .map((mr) => {
              const id = String(mr.cost_center_id ?? "")
              const { label, code, status } = resolveGroupCostCenter(id)
              return { mappingId: String(mr.cost_center_group_map_id ?? ""), id, label, code, status, mappingRow: mr }
            })
          const costCenterGroupCostCenterSearchTerm = costCenterGroupCostCenterSearch.trim().toLowerCase()
          const filteredAssignedGroupCostCenters = costCenterGroupCostCenterSearchTerm
            ? assignedGroupCostCenters.filter((c) => `${c.label} ${c.code}`.toLowerCase().includes(costCenterGroupCostCenterSearchTerm))
            : assignedGroupCostCenters
          // Division ↔ Profit Center: 1:N FK — recordChildRows already holds only assigned rows
          // (server-side filtered by fkColumn==parent id via fetchRecordChild).
          const assignedProfitCenters = (recordChildRows["profit-center"] ?? []).map((pc) => ({
            id: String(pc.profit_center_id ?? ""),
            label: String(pc.name ?? pc.code ?? pc.profit_center_id ?? ""),
            code: String(pc.code ?? ""),
            status: String(pc.status ?? ""),
            row: pc,
          }))
          const divisionProfitCenterSearchTerm = divisionProfitCenterSearch.trim().toLowerCase()
          const filteredAssignedProfitCenters = divisionProfitCenterSearchTerm
            ? assignedProfitCenters.filter((p) => `${p.label} ${p.code}`.toLowerCase().includes(divisionProfitCenterSearchTerm))
            : assignedProfitCenters
          // Profit Center ↔ Cost Center: 1:N FK, same shape.
          const assignedCostCenters = (recordChildRows["cost-center"] ?? []).map((cc) => ({
            id: String(cc.cost_center_id ?? ""),
            label: String(cc.name ?? cc.code ?? cc.cost_center_id ?? ""),
            code: String(cc.code ?? ""),
            status: String(cc.status ?? ""),
            row: cc,
          }))
          const profitCenterCostCenterSearchTerm = profitCenterCostCenterSearch.trim().toLowerCase()
          const filteredAssignedCostCenters = profitCenterCostCenterSearchTerm
            ? assignedCostCenters.filter((c) => `${c.label} ${c.code}`.toLowerCase().includes(profitCenterCostCenterSearchTerm))
            : assignedCostCenters
          // Master Client → Customer: 1:N FK, same shape.
          const assignedMcCustomers = (recordChildRows["customer"] ?? []).map((cu) => ({
            id: String(cu.customer_id ?? ""),
            label: String(cu.customer_name ?? cu.customer_code ?? cu.customer_id ?? ""),
            code: String(cu.customer_code ?? ""),
            country: String(cu.country_code ?? ""),
            industry: String(cu.industry ?? ""),
            status: String(cu.status ?? ""),
            row: cu,
          }))
          const masterClientCustomerSearchTerm = masterClientCustomerSearch.trim().toLowerCase()
          const filteredMcCustomers = masterClientCustomerSearchTerm
            ? assignedMcCustomers.filter((c) => `${c.label} ${c.code} ${c.country} ${c.industry}`.toLowerCase().includes(masterClientCustomerSearchTerm))
            : assignedMcCustomers
          // Product Line → Product Category: resolve the assigned category name for display in product-line detail.
          const assignedCategoryId = recordView.entityKey === "product-line" ? String(rrow.product_category_id ?? "").trim() : ""
          const assignedCategoryRow = assignedCategoryId ? productLineProductCategoryCandidates.find((c) => String(c.product_category_id ?? "") === assignedCategoryId) : undefined
          const assignedCategoryLabel = assignedCategoryRow ? String(assignedCategoryRow.name ?? assignedCategoryRow.code ?? assignedCategoryId) : assignedCategoryId
          const officeTeamCfg = OFFICE_TEAM_FEATURE[recordView?.entityKey ?? ""] ?? null
          const officeTeamParentId = officeTeamCfg ? String(rrow[officeTeamCfg.parentIdCol] ?? "") : ""
          const deliveryTeamRowsById = new Map<string, RowData>()
          if (officeTeamCfg) {
            for (const team of recordChildRows[officeTeamCfg.childEntity] ?? []) {
              const id = String(team[officeTeamCfg.childIdCol] ?? "")
              if (id) deliveryTeamRowsById.set(id, team)
            }
            for (const team of deliveryOfficeTeamCandidates) {
              const id = String(team[officeTeamCfg.childIdCol] ?? "")
              if (id && String(team[officeTeamCfg.fkCol] ?? "") === officeTeamParentId) deliveryTeamRowsById.set(id, team)
            }
          }
          const assignedDeliveryTeams = Array.from(deliveryTeamRowsById.values())
            .filter((team) => String(team.status ?? "") !== "archived")
            .map((team) => ({
              row: team,
              id: officeTeamCfg ? String(team[officeTeamCfg.childIdCol] ?? "") : "",
              label: String(team.name ?? team.code ?? "").trim(),
              code: String(team.code ?? "").trim(),
              localName: String(team.name_local ?? "").trim(),
              manager: String(team.manager_user_id ?? "").trim(),
              status: String(team.status ?? "").trim(),
            }))
            .filter((team) => team.id)
          const deliveryTeamSearchTerm = deliveryOfficeTeamSearch.trim().toLowerCase()
          const filteredAssignedDeliveryTeams = deliveryTeamSearchTerm
            ? assignedDeliveryTeams.filter((team) => `${team.code} ${team.label} ${team.localName} ${team.manager}`.toLowerCase().includes(deliveryTeamSearchTerm))
            : assignedDeliveryTeams
          const formatDisplayValue = (field: string, value: unknown): React.ReactNode => {
            if (value == null || String(value).trim() === "") return "-"
            if (URL_FIELDS.has(field)) return renderUrlLink(value)
            if (field === "is_primary" || field === "is_default") return String(value) === "true" ? "✓" : "-"
            if (field === "status") return humanizeLabel(String(value))
            if (field === "valid_from" || field === "valid_to") return formatCellValue(value)
            const opts = lookupOptions[field]
            if (opts && opts.length) {
              const hit = opts.find((o) => String(o.value) === String(value))
              if (hit) return hit.label
            }
            return String(value)
          }
          // Resolve raw values for display: map *_id reference fields to their human label.
          const displayFieldValue = (f: string): React.ReactNode => {
            return formatDisplayValue(f, rrow[f])
          }
          const renderAssignPicker = () => {
            if (!lineDetail?.isNew || !lineDetail.cfg.assignMode) return null
            const assignEntity = lineDetail.cfg.multiAssign ? COST_CENTER_ENTITY : lineDetail.cfg.childEntity
            const assignMeta = entities.find((e) => e.key === assignEntity)
            const assignIdCol = assignMeta?.idColumn ?? `${assignEntity.replace(/-/g, "_")}_id`
            if (lineDetail.cfg.multiAssign) {
              const parentGroupId = String(rrow.cost_center_group_id ?? "")
              const currentMappings = (recordChildRows[lineDetail.cfg.childEntity] ?? []).filter((item) => String(item.cost_center_group_id ?? "") === parentGroupId)
              const candidateByCostCenter = new Map(assignCandidates.map((row) => [String(row[assignIdCol] ?? ""), row]))
              return (
                <div className="grid gap-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{lineDetail.cfg.label}</div>
                  <div className="overflow-hidden rounded border border-border">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Cost Center</th>
                          <th className="px-3 py-2 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentMappings.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-sm text-muted-foreground">No mappings yet</td>
                          </tr>
                        ) : currentMappings.map((mappingRow) => {
                          const costCenterId = String(mappingRow.cost_center_id ?? "")
                          const candidate = candidateByCostCenter.get(costCenterId)
                          const costCenterLabel = String(candidate?.code ?? candidate?.name ?? candidate?.name_en ?? costCenterId)
                          const mappingId = String(mappingRow.cost_center_group_map_id ?? "")
                          return (
                            <tr key={mappingId || costCenterId} className="border-t border-border/60">
                              <td className="px-3 py-2 text-sm">{costCenterLabel}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  disabled={recordSaving}
                                  onClick={() => void deleteLineRecord(lineDetail.cfg, mappingRow, rrow)}
                                  className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="border-t border-border/60 bg-muted/10">
                          <td className="px-3 py-2">
                            <select
                              value={lineDraft._assign_target ?? ""}
                              onChange={(e) => setLineDraft((prev) => ({ ...prev, _assign_target: e.target.value }))}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                            >
                              <option value="">{assignCandidates.length === 0 ? "No cost centers available" : "Select cost center"}</option>
                              {assignCandidates.map((candidate) => {
                                const value = String(candidate[assignIdCol] ?? "")
                                const label = String(candidate.code ?? candidate.name ?? candidate.name_en ?? value)
                                const suffix = candidate.name && candidate.name !== label ? ` - ${String(candidate.name)}` : ""
                                return <option key={value} value={value}>{label}{suffix}</option>
                              })}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={recordSaving || !String(lineDraft._assign_target ?? "").trim()}
                              onClick={() => void saveLineDetail(rrow)}
                              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40"
                            >
                              Add
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }
            return (
              <div className="grid gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{lineDetail.cfg.label}</div>
                <div className="overflow-hidden rounded border border-border">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-semibold">{singularizeLabel(lineDetail.cfg.label)}</th>
                        <th className="px-3 py-2 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recordChildRows[lineDetail.cfg.childEntity] ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-3 py-3 text-sm text-muted-foreground">No assignments yet</td>
                        </tr>
                      ) : (recordChildRows[lineDetail.cfg.childEntity] ?? []).map((childRow) => {
                        const value = String(childRow[assignIdCol] ?? "")
                        const label = String(childRow.code ?? childRow.name ?? childRow.name_en ?? value)
                        const suffix = childRow.name && childRow.name !== label ? ` - ${String(childRow.name)}` : ""
                        return (
                          <tr key={value} className="border-t border-border/60">
                            <td className="px-3 py-2 text-sm">{label}{suffix}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                disabled={recordSaving}
                                onClick={() => void deleteLineRecord(lineDetail.cfg, childRow, rrow)}
                                className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="border-t border-border/60 bg-muted/10">
                        <td className="px-3 py-2">
                          <select
                            value={lineDraft._assign_target ?? ""}
                            onChange={(e) => setLineDraft((prev) => ({ ...prev, _assign_target: e.target.value }))}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                          >
                            <option value="">{assignCandidates.length === 0 ? "No records available" : "Select record"}</option>
                            {assignCandidates.map((candidate) => {
                              const value = String(candidate[assignIdCol] ?? "")
                              const label = String(candidate.code ?? candidate.name ?? candidate.name_en ?? value)
                              const suffix = candidate.name && candidate.name !== label ? ` - ${String(candidate.name)}` : ""
                              return <option key={value} value={value}>{label}{suffix}</option>
                            })}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={recordSaving || !String(lineDraft._assign_target ?? "").trim()}
                            onClick={() => void saveLineDetail(rrow)}
                            className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40"
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
          return (
            <div className="flex min-h-0 flex-1 flex-col p-2 text-[13px]">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-border px-1 pb-2">
                <span className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold">{hasFlag && <FlagBadge code={rrow.alpha2} />}{rtitle || entityDisplayName(recordView.entityKey)} <span className="text-xs font-normal text-muted-foreground">· {entityDisplayName(recordView.entityKey)}</span></span>
                <button onClick={() => setRecordView(null)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close ✕</button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">

              {/* HEADER — single view, topic subsections, editable */}
              <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setRecordDetailsOpen((v) => !v)}
                    aria-expanded={recordDetailsOpen}
                    title={recordDetailsOpen ? "Collapse details" : "Expand details"}
                    className="flex items-center gap-2 rounded-md text-left transition hover:opacity-80"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-[12px] font-semibold tracking-tight">Record Details</span>
                      <span className="text-[10.5px] text-muted-foreground">Core identity &amp; fields</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${recordDetailsOpen ? "" : "-rotate-90"}`} />
                  </button>
                  <div className="flex items-center gap-1.5">
                        {!headerEditing && canWrite && !isLockedEntity && <button onClick={() => { setHeaderDraft(rowDraftFromRecord(rmeta, rrow)); setHeaderEditing(true) }} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Edit</button>}
                    {headerEditing && <button disabled={recordSaving} onClick={async () => { const ok = await saveRecordEdit(recordView.entityKey, rrow, headerDraft); if (ok) { setHeaderEditing(false); void loadEntity(entity) } }} className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">{recordSaving ? "Saving…" : "Save"}</button>}
                    {headerEditing && <button onClick={() => setHeaderEditing(false)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Cancel</button>}
                  </div>
                </div>
                {recordDetailsOpen && (
                <>
                {(recordView.entityKey === "cost-center-group" || recordView.entityKey === "product-category") && (
                  <div className="space-y-4 px-3 py-4">
                    {groups.map((grp) => (
                      <div key={grp.label} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
                        {(() => {
                          const groupKey = `${recordView.entityKey}:${grp.label}`
                          const defaultOpen = grp.label === "Identifiers" || grp.label === "Details"
                          const isOpen = recordGroupOpen[groupKey] ?? defaultOpen
                          const toggle = () => setRecordGroupOpen((prev) => ({ ...prev, [groupKey]: !(prev[groupKey] ?? defaultOpen) }))
                          return (
                            <>
                              <button type="button" onClick={toggle} className="mb-2.5 flex w-full items-center gap-2 text-left">
                                <span className="h-3.5 w-1 rounded-full bg-primary/60" />
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{grp.label}</span>
                                <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                              </button>
                              {isOpen && (
                                <div className="grid gap-x-5 gap-y-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                                  {grp.fields.flatMap((f) => {
                                    const items = [fieldRow(f, headerEditing ? renderRecordField(f, headerDraft, setHeaderDraft) : displayFieldValue(f))]
                                    // Derived display-only: show credit area currency after credit_area_id.
                                    if (f === "credit_area_id" && (recordView.entityKey === "customer" || recordView.entityKey === "vendor")) {
                                      const caRows = rawLookupRows.credit_area_id ?? []
                                      const caId = String((headerEditing ? headerDraft : rrow).credit_area_id ?? "")
                                      const caRow = caRows.find((r) => String(r.credit_area_id ?? "") === caId) as Record<string, unknown> | undefined
                                      const cur = caRow ? String(caRow.currency_code ?? "") : ""
                                      items.push(fieldRow("_credit_area_currency", <span className="text-sm text-muted-foreground">{cur || "—"}</span>))
                                    }
                                    return items
                                  })}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    ))}
                  </div>
                )}
                {/* Assigned Cost Centers — dedicated card UI (Assigned X + Scope cards + assign
                    dialog), mirroring the Office → Team "assign" feature design used by
                    delivery/sales/purchase office (Assigned Teams + Office Scope + Assign dialog). */}
                {recordView.entityKey === "cost-center-group" && costCenterAssignCfg && childGroupRows.length === 0 && (
                  <div className="border-b border-border px-3 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Assigned Cost Centers</span>
                            <span className="text-[11px] text-muted-foreground">Cost centers linked to this group</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => refreshCostCenterGroupCostCenters(rrow)}
                            title="Refresh cost centers"
                            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canWrite || !costCenterGroupAssignmentsReady || LOCKED_MDM_ENTITIES.has(costCenterAssignCfg.childEntity)}
                            onClick={() => openCostCenterGroupCostCenterDialog(rrow)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Assign Cost Center
                          </button>
                        </div>
                        <div className="space-y-3 p-3">
                          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                              value={costCenterGroupCostCenterSearch}
                              onChange={(e) => setCostCenterGroupCostCenterSearch(e.target.value)}
                              placeholder="Search assigned cost centers…"
                              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="px-2 pb-2 font-semibold">Cost Center</th>
                                <th className="px-2 pb-2 font-semibold">Code</th>
                                <th className="px-2 pb-2 font-semibold">Status</th>
                                <th className="px-2 pb-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAssignedGroupCostCenters.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-2 pt-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 opacity-60" />
                                      {assignedGroupCostCenters.length === 0 ? "No cost centers assigned yet" : "No cost centers match your search"}
                                    </span>
                                  </td>
                                </tr>
                              ) : filteredAssignedGroupCostCenters.map((cc) => (
                                <tr key={cc.mappingId || cc.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-2 py-2.5">
                                    <span className="flex items-center gap-2">
                                      <span className="inline-flex h-4 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing" title="Drag to reorder" onClick={(e) => e.stopPropagation()}>
                                        <GripVertical className="h-3.5 w-3.5" />
                                      </span>
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                        {(cc.label || "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span className="font-medium">{cc.label}</span>
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-muted-foreground">{cc.code || "—"}</td>
                                  <td className="px-2 py-2.5">
                                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      {cc.status ? humanizeLabel(cc.status) : "Linked"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-right">
                                    <button
                                      type="button"
                                      disabled={!canWrite || recordSaving}
                                      onClick={() => requestRemoveCostCenterGroupCostCenter(cc.mappingRow, rrow)}
                                      title="Remove assignment"
                                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Group Scope</span>
                            <span className="text-[11px] text-muted-foreground">Cost centers inherit this group context</span>
                          </div>
                        </div>
                        <div className="space-y-3 p-3 text-sm text-muted-foreground">
                          <div>{String(rrow.code ?? rrow.cost_center_group_id ?? "")}</div>
                          <div>{String(rrow.name ?? "")}</div>
                          <div>{assignedGroupCostCenters.length} cost center{assignedGroupCostCenters.length === 1 ? "" : "s"} linked to this group.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {costCenterAssignCfg && costCenterGroupCostCenterOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-md rounded-md border border-border bg-card shadow-lg">
                      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">Assign Cost Center</div>
                          <div className="truncate text-xs text-muted-foreground">{String(rrow.code ?? rrow.cost_center_group_id ?? "")}{rrow.name ? ` - ${String(rrow.name)}` : ""}</div>
                        </div>
                        <button onClick={() => setCostCenterGroupCostCenterOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                      </div>
                      <div className="space-y-3 px-3 py-3">
                        <div className="grid gap-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cost Center</label>
                          <select
                            value={costCenterGroupCostCenterDraft}
                            onChange={(e) => setCostCenterGroupCostCenterDraft(e.target.value)}
                            className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
                          >
                            {(() => {
                              const assignedIds = new Set(assignedGroupCostCenters.map((cc) => cc.id))
                              const available = costCenterGroupCostCenterCandidates.filter((candidate) => {
                                const id = String(candidate.cost_center_id ?? "")
                                return id && !assignedIds.has(id)
                              })
                              return (
                                <>
                                  <option value="">{available.length === 0 ? "No unassigned cost centers available" : "Select cost center"}</option>
                                  {available.map((candidate) => {
                                    const value = String(candidate.cost_center_id ?? "")
                                    const code = String(candidate.code ?? "").trim()
                                    const name = String(candidate.name ?? value).trim()
                                    return <option key={value} value={value}>{[code, name].filter(Boolean).join(" - ") || value}</option>
                                  })}
                                </>
                              )
                            })()}
                          </select>
                          <p className="text-[11px] text-muted-foreground">Cost centers already linked to this group are hidden.</p>
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setCostCenterGroupCostCenterOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                          <button
                            type="button"
                            disabled={recordSaving || !costCenterGroupCostCenterDraft.trim()}
                            onClick={() => void assignCostCenterGroupCostCenter(rrow)}
                            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40"
                          >
                            {recordSaving ? "Adding…" : "Add"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {recordView.entityKey !== "cost-center-group" && recordView.entityKey !== "product-category" && (
                <div className="space-y-4 px-3 py-4">
                  {groups.map((grp) => (
                    <div key={grp.label} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
                      {(() => {
                        const groupKey = `${recordView.entityKey}:${grp.label}`
                        const defaultOpen = grp.label === "Identifiers" || grp.label === "Details"
                        const isOpen = recordGroupOpen[groupKey] ?? defaultOpen
                        const toggle = () => setRecordGroupOpen((prev) => ({ ...prev, [groupKey]: !(prev[groupKey] ?? defaultOpen) }))
                        return (
                          <>
                            <button type="button" onClick={toggle} className="mb-2.5 flex w-full items-center gap-2 text-left">
                              <span className="h-3.5 w-1 rounded-full bg-primary/60" />
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{grp.label}</span>
                              <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                            </button>
                            {isOpen && (
                              <div className="grid gap-x-5 gap-y-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                                {grp.fields
                                  .filter((f) => !(recordView.entityKey === "credit-area" && (f === "currency_code" || f === "legal_entity_id" || f === "credit_limit")))
                                  .flatMap((f) => {
                                    const items = [fieldRow(f, headerEditing ? renderRecordField(f, headerDraft, setHeaderDraft) : displayFieldValue(f))]
                                    if (f === "credit_area_id" && (recordView.entityKey === "customer" || recordView.entityKey === "vendor")) {
                                      const caRows = rawLookupRows.credit_area_id ?? []
                                      const caId = String((headerEditing ? headerDraft : rrow).credit_area_id ?? "")
                                      const caRow = caRows.find((r) => String(r.credit_area_id ?? "") === caId) as Record<string, unknown> | undefined
                                      const cur = caRow ? String(caRow.currency_code ?? "") : ""
                                      items.push(fieldRow("_credit_area_currency", <span className="text-sm text-muted-foreground">{cur || "—"}</span>))
                                    }
                                    return items
                                  })}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  ))}
                </div>
                )}
                </>
                )}
                {recordView.entityKey === "credit-area" && (
                  <div className="border-t border-border px-3 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      {/* Assigned legal entities card (many-to-many via join table) */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Assigned Legal Entities</span>
                            <span className="text-[11px] text-muted-foreground">Legal entities sharing this credit area</span>
                          </div>
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => openCreditAreaLegalEntityDialog(rrow)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Assign Entity
                          </button>
                        </div>
                        <div className="space-y-3 p-3">
                          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                              value={creditAreaEntitySearch}
                              onChange={(e) => setCreditAreaEntitySearch(e.target.value)}
                              placeholder="Search assigned entities…"
                              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="px-2 pb-2 font-semibold">Legal Entity</th>
                                <th className="px-2 pb-2 font-semibold">Region</th>
                                <th className="px-2 pb-2 font-semibold">Status</th>
                                <th className="px-2 pb-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAssignedEntities.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-2 pt-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 opacity-60" />
                                      {assignedLegalEntities.length === 0 ? "No legal entities assigned yet" : "No entities match your search"}
                                    </span>
                                  </td>
                                </tr>
                              ) : filteredAssignedEntities.map((ent) => (
                                <tr key={ent.joinId || ent.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-2 py-2.5">
                                    <span className="flex items-center gap-2.5">
                                      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                        {(ent.label || "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span className="font-medium">{ent.label}</span>
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-muted-foreground">{ent.region || "—"}</td>
                                  <td className="px-2 py-2.5">
                                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      Linked
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-right">
                                    <button
                                      type="button"
                                      disabled={!canWrite || recordSaving}
                                      onClick={() => requestRemoveCreditAreaLegalEntity(ent.joinRow, rrow)}
                                      title="Remove assignment"
                                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {/* Credit controls card */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <ShieldCheck className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Credit Controls</span>
                            <span className="text-[11px] text-muted-foreground">What stays open, and where credit checks block the flow</span>
                          </div>
                        </div>
                        <div className="space-y-3 p-3">
                          <div className="grid gap-1.5 sm:max-w-xs">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Currency</span>
                            <select
                              value={headerEditing ? (headerDraft.currency_code ?? "") : String(rrow.currency_code ?? "")}
                              onChange={(e) => {
                                setHeaderDraft((prev) => ({ ...(Object.keys(prev).length ? prev : rowDraftFromRecord(rmeta, rrow)), currency_code: e.target.value }))
                                setHeaderEditing(true)
                              }}
                              disabled={!canWrite}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <option value="">{lookupOptions.currency_code?.length ? "-- Select --" : "-- No options yet --"}</option>
                              {(lookupOptions.currency_code ?? []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-1.5">
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Open Modules</div>
                              {([
                                { key: "openQuotation", label: "Open Quotation", hint: "Allow new quotations" },
                                { key: "openInvoice", label: "Open Invoice", hint: "Allow invoicing" },
                                { key: "openProjects", label: "Open Projects", hint: "Allow project creation" },
                              ] as const).map((m) => (
                                <div key={m.key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                                  <span className="flex flex-col leading-tight">
                                    <span className="text-[13px] font-medium">{m.label}</span>
                                    <span className="text-[11px] text-muted-foreground">{m.hint}</span>
                                  </span>
                                  <Switch
                                    checked={creditAreaConfig[m.key]}
                                    disabled={!canWrite}
                                    onCheckedChange={(v) => updateCreditAreaConfig(rrow, { [m.key]: v } as Partial<CreditAreaConfig>)}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="grid gap-1.5">
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Control Steps · block when over limit</div>
                              {([
                                { key: "restrictQuotation", label: "Restrict for Quotation" },
                                { key: "restrictOrder", label: "Restrict for Order" },
                                { key: "restrictProjectExecution", label: "Restrict for Project Execution" },
                                { key: "restrictDeliverableIssue", label: "Restrict for Deliverable Issue" },
                              ] as const).map((m) => (
                                <div key={m.key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                                  <span className="text-[13px] font-medium">{m.label}</span>
                                  <Switch
                                    checked={creditAreaConfig[m.key]}
                                    disabled={!canWrite}
                                    onCheckedChange={(v) => updateCreditAreaConfig(rrow, { [m.key]: v } as Partial<CreditAreaConfig>)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {recordView.entityKey === "division" && (
                  <div className="border-t border-border px-3 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      {/* Assigned profit centers card */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-3.5 w-3.5" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Assigned Profit Centers</span>
                            <span className="text-[11px] text-muted-foreground">Profit centers linked to this division</span>
                          </div>
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => openDivisionProfitCenterDialog(rrow)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Assign Entity
                          </button>
                        </div>
                        <div className="space-y-2 p-2.5">
                          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
                            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <input
                              value={divisionProfitCenterSearch}
                              onChange={(e) => setDivisionProfitCenterSearch(e.target.value)}
                              placeholder="Search assigned profit centers…"
                              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="px-2 pb-1.5 font-semibold">Profit Center</th>
                                <th className="px-2 pb-1.5 font-semibold">Code</th>
                                <th className="px-2 pb-1.5 font-semibold">Status</th>
                                <th className="px-2 pb-1.5" />
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAssignedProfitCenters.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-2 pt-2.5 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 opacity-60" />
                                      {assignedProfitCenters.length === 0 ? "No profit centers assigned yet" : "No profit centers match your search"}
                                    </span>
                                  </td>
                                </tr>
                              ) : filteredAssignedProfitCenters.map((pc) => (
                                <tr key={pc.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-2 py-2">
                                    <span className="flex items-center gap-2">
                                      <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                                        {(pc.label || "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span className="font-medium">{pc.label}</span>
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-muted-foreground">{pc.code || "—"}</td>
                                  <td className="px-2 py-2">
                                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      {pc.status || "Linked"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    <button
                                      type="button"
                                      disabled={!canWrite || recordSaving}
                                      onClick={() => requestRemoveDivisionProfitCenter(pc.row, rrow)}
                                      title="Remove assignment"
                                      className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {/* Record Scope card */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                            <GitBranch className="h-3.5 w-3.5" />
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Record Scope</span>
                            <span className="text-[11px] text-muted-foreground">Linked entities and hierarchy for this division</span>
                          </div>
                        </div>
                        <div className="space-y-3 p-3">
                          {[
                            { label: "Legal Entity", field: "legal_entity_id" },
                            { label: "Controlling Area", field: "controlling_area_id" },
                            { label: "Currency", field: "currency_code" },
                          ].map((item) => {
                            const val = displayFieldValue(item.field)
                            return (
                              <div key={item.field} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</span>
                                <span className="text-[13px] font-medium">{val}</span>
                              </div>
                            )
                          })}
                          <div className="rounded-md border border-border bg-background px-3 py-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profit Centers</span>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-xl font-bold tabular-nums">{assignedProfitCenters.length}</span>
                              <span className="text-[12px] text-muted-foreground">assigned</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {recordView.entityKey === "product-line" && (
                  <div className="border-t border-border px-3 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Assigned HS Code</span>
                            <span className="text-[11px] text-muted-foreground">HS-coded products linked to this product line</span>
                          </div>
                          <button
                            type="button"
                            disabled={!canWrite || (productLineChildCount ?? 0) > 0}
                            title={(productLineChildCount ?? 0) > 0 ? `This product line has ${productLineChildCount} sub product line(s); assign HS codes on the leaf lines instead.` : undefined}
                            onClick={() => openProductLineProductCategoryDialog(rrow)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Assign HS Code
                          </button>
                        </div>
                        <div className="space-y-3 p-3">
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="px-2 pb-2 font-semibold">HS Code</th>
                                <th className="px-2 pb-2 font-semibold">Code</th>
                                <th className="px-2 pb-2 font-semibold">Status</th>
                                <th className="px-2 pb-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {productLineHsLeaves.map((leaf) => (
                                <tr key={String(leaf.product_category_id)} className="border-b border-border/50 last:border-0">
                                  <td className="px-2 py-2.5">
                                    <span className="flex items-center gap-2.5">
                                      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                        {String(leaf.name ?? "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span className="font-medium">{String(leaf.name ?? leaf.product_category_id)}</span>
                                      <span className="text-[11px] text-muted-foreground">{String(leaf.description ?? "")}</span>
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-muted-foreground">{String(leaf.code ?? "—")}</td>
                                  <td className="px-2 py-2.5">
                                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      {String(leaf.status ?? "linked")}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-right">
                                    <button
                                      type="button"
                                      disabled={!canWrite || recordSaving}
                                      onClick={() => requestUnlinkProductLineHsLeaf(leaf)}
                                      title="Unlink from this product line"
                                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {!assignedCategoryId && productLineHsLeaves.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-2 pt-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 opacity-60" />
                                      No HS code assigned yet
                                    </span>
                                  </td>
                                </tr>
                              ) : !assignedCategoryId ? null : (
                                <tr className="border-b border-border/50 last:border-0">
                                  <td className="px-2 py-2.5">
                                    <span className="flex items-center gap-2.5">
                                      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                        {(assignedCategoryLabel || "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span className="font-medium">{assignedCategoryLabel || assignedCategoryId}</span>
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-muted-foreground">{assignedCategoryRow ? String(assignedCategoryRow.code ?? "") : "—"}</td>
                                  <td className="px-2 py-2.5">
                                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      {assignedCategoryRow ? String(assignedCategoryRow.status ?? "Linked") : "Linked"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-right">
                                    <button
                                      type="button"
                                      disabled={!canWrite || recordSaving}
                                      onClick={() => requestRemoveProductLineProductCategory(rrow)}
                                      title="Remove assignment"
                                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Product Line Scope</span>
                            <span className="text-[11px] text-muted-foreground">HS code context inherited by this product line</span>
                          </div>
                        </div>
                        <div className="space-y-3 p-3 text-sm text-muted-foreground">
                          <div>{String(rrow.code ?? rrow.product_line_id ?? "")}</div>
                          <div>{String(rrow.name ?? "")}</div>
                          <div>{assignedCategoryId ? `Linked to HS code: ${assignedCategoryLabel || assignedCategoryId}` : "No HS code assigned to this product line."}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {(recordView.entityKey === "regulation" || recordView.entityKey === "standard") && (() => {
                  const assignedLineIds = Array.from(new Set(rspAssignedProducts.map((p) => String(p.product_line_id ?? "")).filter(Boolean)))
                  const assignedLineInfos = assignedLineIds.map((lid) => {
                    const match = rspProductLines.find((l) => String(l.product_line_id ?? "") === lid)
                    const count = rspAssignedProducts.filter((p) => String(p.product_line_id ?? "") === lid).length
                    return { id: lid, label: match ? `${String(match.code ?? match.product_line_id)}${match.name ? ` - ${String(match.name)}` : ""}` : lid, count }
                  })
                  const assignedCategoryIds = new Set(
                    rspAssignedProducts
                      .filter((p) => String(p.product_line_id ?? "") === rspSelectedLineId)
                      .map((p) => String(p.product_category_id ?? ""))
                  )
                  const scopeKey = `${recordView.entityKey}:Product Scope`
                  const scopeOpen = recordGroupOpen[scopeKey] ?? false
                  const toggleScope = () => setRecordGroupOpen((prev) => ({ ...prev, [scopeKey]: !(prev[scopeKey] ?? false) }))
                  return (
                  <div className="border-t border-border px-3 py-4">
                    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
                      <button type="button" onClick={toggleScope} className="mb-1 flex w-full items-center gap-2 text-left">
                        <span className="h-3.5 w-1 rounded-full bg-primary/60" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product Scope</span>
                        <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{rspAssignedProducts.length}</span>
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${scopeOpen ? "" : "-rotate-90"}`} />
                      </button>
                    </div>
                    {scopeOpen && (
                    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                      {/* Left: Assigned Product Lines */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Product Lines</span>
                            <span className="text-[11px] text-muted-foreground">Select a line to manage its HS codes</span>
                          </div>
                          <button
                            type="button"
                            disabled={!canWrite || rspSaving}
                            onClick={() => openRspTreeDialog()}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Assign
                          </button>
                        </div>
                        <div className="max-h-72 space-y-1 overflow-y-auto p-2">
                          {assignedLineInfos.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 opacity-60" />No product lines assigned yet</span>
                            </div>
                          ) : assignedLineInfos.map((li) => (
                            <div key={li.id} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition ${rspSelectedLineId === li.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}>
                              <button
                                type="button"
                                onClick={() => void rspSelectProductLine(li.id)}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <Building2 className="h-4 w-4 shrink-0 opacity-60" />
                                <span className="min-w-0 flex-1 truncate">{li.label}</span>
                                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${rspSelectedLineId === li.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{li.count}</span>
                              </button>
                              <button
                                type="button"
                                disabled={!canWrite || rspSaving}
                                onClick={(e) => { e.stopPropagation(); void rspRemoveProductLine(rrow, li.id) }}
                                title="Remove this product line"
                                className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Right: HS Codes for selected product line */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Products (HS Codes)</span>
                            <span className="text-[11px] text-muted-foreground">{rspSelectedLineId ? "Check to assign, uncheck to remove" : "Pick a product line"}</span>
                          </div>
                          {rspSelectedLineId && (rspChecked.size > 0 || rspUnchecked.size > 0) && (
                            <button
                              type="button"
                              disabled={!canWrite || rspSaving}
                              onClick={() => void rspAssignChecked(rrow)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {rspSaving ? "Saving…" : `Save (${rspChecked.size + rspUnchecked.size})`}
                            </button>
                          )}
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {!rspSelectedLineId ? (
                            <div className="p-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 opacity-60" />Select a product line to see its HS codes</span>
                            </div>
                          ) : rspLineHsCodes.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 opacity-60" />No HS codes linked to this product line</span>
                            </div>
                          ) : (
                            rspLineHsCodes.map((hs) => {
                              const cid = String(hs.product_category_id ?? "")
                              const isAssigned = assignedCategoryIds.has(cid)
                              const hsCode = String(hs.code ?? cid)
                              const hsName = String(hs.name ?? "")
                              return (
                                <label
                                  key={cid}
                                  className={`flex cursor-pointer items-center gap-2.5 border-b border-border/40 px-3 py-2.5 text-sm last:border-0 transition hover:bg-muted/50 ${isAssigned ? "bg-primary/5" : ""} ${rspSaving ? "pointer-events-none opacity-60" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={!canWrite || rspSaving}
                                    checked={(isAssigned && !rspUnchecked.has(cid)) || rspChecked.has(cid)}
                                    onChange={() => rspToggle(cid)}
                                    className="h-4 w-4 accent-primary"
                                  />
                                  <span className={`font-medium ${((isAssigned && !rspUnchecked.has(cid)) || rspChecked.has(cid)) ? "text-foreground" : "text-muted-foreground"}`}>{hsCode}</span>
                                  {hsName && <span className="truncate text-[12px] text-muted-foreground">{hsName}</span>}
                                </label>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                  )
                })()}
                {/* Regulation/Standard → Assign by Product Line tree dialog */}
                {(recordView.entityKey === "regulation" || recordView.entityKey === "standard") && rspTreeOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-lg rounded-md border border-border bg-card shadow-lg">
                      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">Assign by Product Line</div>
                          <div className="truncate text-xs text-muted-foreground">Select product lines to assign their HS codes to this {recordView.entityKey}</div>
                        </div>
                        <button onClick={() => setRspTreeOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                      </div>
                      <div className="space-y-3 px-3 py-3">
                        <div className="grid gap-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product Line</label>
                          <div className="flex items-center gap-2 rounded border border-border bg-background px-2.5 py-2">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                              value={rspTreeSearch}
                              onChange={(e) => setRspTreeSearch(e.target.value)}
                              placeholder="Search by code or name…"
                              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <div className="max-h-72 overflow-y-auto rounded border border-border bg-background">
                            {(() => {
                              const seenIds = new Set<string>()
                              const lines: RowData[] = []
                              for (const raw of rspTreeCandidates) {
                                const id = String(raw.product_line_id ?? "").trim()
                                if (!id || seenIds.has(id)) continue
                                seenIds.add(id)
                                lines.push(raw)
                              }
                              if (lines.length === 0) return <div className="px-3 py-2 text-sm text-muted-foreground">No product lines available</div>
                              const searchTerm = rspTreeSearch.trim().toLowerCase()

                              const lineById = new Map<string, RowData>()
                              for (const l of lines) lineById.set(String(l.product_line_id ?? "").trim(), l)

                              const childrenMap = new Map<string, RowData[]>()
                              const rootItems: RowData[] = []
                              for (const l of lines) {
                                const parentRef = String(l.parent_line_id ?? "").trim()
                                if (!parentRef || !lineById.has(parentRef)) { rootItems.push(l); continue }
                                const siblings = childrenMap.get(parentRef)
                                if (siblings) siblings.push(l)
                                else childrenMap.set(parentRef, [l])
                              }

                              const matchingIds = new Set<string>()
                              const ancestorIds = new Set<string>()
                              if (searchTerm) {
                                for (const l of lines) {
                                  const code = String(l.code ?? "").toLowerCase()
                                  const name = String(l.name ?? "").toLowerCase()
                                  if (code.includes(searchTerm) || name.includes(searchTerm)) {
                                    const id = String(l.product_line_id ?? "").trim()
                                    matchingIds.add(id)
                                    let pRef = String(l.parent_line_id ?? "").trim()
                                    while (pRef && lineById.has(pRef)) {
                                      ancestorIds.add(pRef)
                                      const parent = lineById.get(pRef)!
                                      pRef = String(parent.parent_line_id ?? "").trim()
                                    }
                                  }
                                }
                              }

                              const lineLabel = (l: RowData) => {
                                const code = String(l.code ?? "").trim()
                                const name = String(l.name ?? "").trim()
                                return code && name ? `${code} - ${name}` : code || name || String(l.product_line_id ?? "")
                              }

                              const nodes: React.ReactNode[] = []
                              const renderNode = (item: RowData, depth: number) => {
                                const id = String(item.product_line_id ?? "").trim()
                                const label = lineLabel(item)
                                const kids = childrenMap.get(id)
                                const hasChildren = kids && kids.length > 0

                                if (searchTerm && !matchingIds.has(id) && !ancestorIds.has(id)) return

                                const isExpanded = searchTerm ? (ancestorIds.has(id) || matchingIds.has(id)) : (rspTreeExpanded[id] ?? false)
                                const isChecked = rspTreeChecked.has(id)
                                const isMatch = searchTerm && matchingIds.has(id)
                                const isLeaf = !hasChildren

                                nodes.push(
                                  <div key={id} className="flex items-center" style={{ paddingLeft: `${depth * 20 + 4}px` }}>
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setRspTreeExpanded((prev) => ({ ...prev, [id]: !isExpanded })) }}
                                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
                                      >
                                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                      </button>
                                    ) : (
                                      <span className="inline-block h-6 w-6 shrink-0" />
                                    )}
                                    {isLeaf ? (
                                      <label className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${isChecked ? "bg-primary/10 font-medium text-primary" : isMatch ? "bg-yellow-500/10 hover:bg-yellow-500/20" : "hover:bg-muted"}`}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => setRspTreeChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })}
                                          className="h-4 w-4 accent-primary"
                                        />
                                        <span className="truncate">{label}</span>
                                      </label>
                                    ) : (
                                      <span className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted-foreground`}>
                                        <span className="truncate">{label}</span>
                                      </span>
                                    )}
                                  </div>,
                                )
                                if (hasChildren && isExpanded) {
                                  for (const kid of kids!) renderNode(kid, depth + 1)
                                }
                              }
                              for (const root of rootItems) renderNode(root, 0)
                              if (nodes.length === 0 && searchTerm) return <div className="px-3 py-2 text-sm text-muted-foreground">No product lines match &quot;{rspTreeSearch.trim()}&quot;</div>
                              return nodes
                            })()}
                          </div>
                          {rspTreeChecked.size > 0 && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>Selected:</span>
                              <span className="font-medium text-foreground">{rspTreeChecked.size} product line(s)</span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setRspTreeOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                          <button
                            type="button"
                            disabled={rspSaving || rspTreeChecked.size === 0}
                            onClick={() => void rspAssignFromTree(rrow)}
                            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40"
                          >
                            {rspSaving ? "Assigning…" : `Assign (${rspTreeChecked.size})`}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {recordView.entityKey === "service-bom" && (() => {
                  // Derive unique assigned product lines from assigned products
                  const assignedLineIds = Array.from(new Set(sbpAssignedProducts.map((p) => String(p.product_line_id ?? "")).filter(Boolean)))
                  const assignedLineInfos = assignedLineIds.map((lid) => {
                    const match = sbpProductLines.find((l) => String(l.product_line_id ?? "") === lid)
                    const count = sbpAssignedProducts.filter((p) => String(p.product_line_id ?? "") === lid).length
                    return { id: lid, label: match ? `${String(match.code ?? match.product_line_id)}${match.name ? ` - ${String(match.name)}` : ""}` : lid, count }
                  })
                  // Already-assigned HS code IDs for the selected product line
                  const assignedCategoryIds = new Set(
                    sbpAssignedProducts
                      .filter((p) => String(p.product_line_id ?? "") === sbpSelectedLineId)
                      .map((p) => String(p.product_category_id ?? ""))
                  )
                  const scopeKey = "service-bom:Product Scope"
                  const scopeOpen = recordGroupOpen[scopeKey] ?? false
                  const toggleScope = () => setRecordGroupOpen((prev) => ({ ...prev, [scopeKey]: !(prev[scopeKey] ?? false) }))
                  return (
                  <div className="border-t border-border px-3 py-4">
                    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
                      <button type="button" onClick={toggleScope} className="mb-1 flex w-full items-center gap-2 text-left">
                        <span className="h-3.5 w-1 rounded-full bg-primary/60" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product Scope</span>
                        <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{sbpAssignedProducts.length}</span>
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${scopeOpen ? "" : "-rotate-90"}`} />
                      </button>
                    </div>
                    {scopeOpen && (
                    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                      {/* Left: Assigned Product Lines */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Product Lines</span>
                            <span className="text-[11px] text-muted-foreground">Select a line to manage its HS codes</span>
                          </div>
                          <button
                            type="button"
                            disabled={!canWrite || sbpSaving}
                            onClick={() => openSbpProductLineTreeDialog()}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Assign
                          </button>
                        </div>
                        <div className="max-h-72 space-y-1 overflow-y-auto p-2">
                          {assignedLineInfos.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 opacity-60" />No product lines assigned yet</span>
                            </div>
                          ) : assignedLineInfos.map((li) => (
                            <div key={li.id} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition ${sbpSelectedLineId === li.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}>
                              <button
                                type="button"
                                onClick={() => void sbpSelectProductLine(li.id)}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <Building2 className="h-4 w-4 shrink-0 opacity-60" />
                                <span className="min-w-0 flex-1 truncate">{li.label}</span>
                                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${sbpSelectedLineId === li.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{li.count}</span>
                              </button>
                              <button
                                type="button"
                                disabled={!canWrite || sbpSaving}
                                onClick={(e) => { e.stopPropagation(); void sbpRemoveProductLine(rrow, li.id) }}
                                title="Remove this product line"
                                className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Right: HS Codes for selected product line with multi-select checkboxes */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Products (HS Codes)</span>
                            <span className="text-[11px] text-muted-foreground">{sbpSelectedLineId ? "Check to assign, uncheck to remove" : "Pick a product line"}</span>
                          </div>
                          {sbpSelectedLineId && (sbpChecked.size > 0 || sbpUnchecked.size > 0) && (
                            <button
                              type="button"
                              disabled={!canWrite || sbpSaving}
                              onClick={() => void sbpAssignChecked(rrow)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {sbpSaving ? "Saving…" : `Save (${sbpChecked.size + sbpUnchecked.size})`}
                            </button>
                          )}
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {!sbpSelectedLineId ? (
                            <div className="p-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 opacity-60" />Select a product line to see its HS codes</span>
                            </div>
                          ) : sbpLineHsCodes.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 opacity-60" />No HS codes linked to this product line</span>
                            </div>
                          ) : (
                            sbpLineHsCodes.map((hs) => {
                              const cid = String(hs.product_category_id ?? "")
                              const isAssigned = assignedCategoryIds.has(cid)
                              const hsCode = String(hs.code ?? cid)
                              const hsName = String(hs.name ?? "")
                              return (
                                <label
                                  key={cid}
                                  className={`flex cursor-pointer items-center gap-2.5 border-b border-border/40 px-3 py-2.5 text-sm last:border-0 transition hover:bg-muted/50 ${isAssigned ? "bg-primary/5" : ""} ${sbpSaving ? "pointer-events-none opacity-60" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={!canWrite || sbpSaving}
                                    checked={(isAssigned && !sbpUnchecked.has(cid)) || sbpChecked.has(cid)}
                                    onChange={() => sbpToggle(cid)}
                                    className="h-4 w-4 accent-primary"
                                  />
                                  <span className={`font-medium ${((isAssigned && !sbpUnchecked.has(cid)) || sbpChecked.has(cid)) ? "text-foreground" : "text-muted-foreground"}`}>{hsCode}</span>
                                  {hsName && <span className="truncate text-[12px] text-muted-foreground">{hsName}</span>}
                                </label>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                  )
                })()}
                {/* Service BOM → Assign by Product Line tree dialog */}
                {recordView.entityKey === "service-bom" && sbpTreeOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-lg rounded-md border border-border bg-card shadow-lg">
                      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">Assign by Product Line</div>
                          <div className="truncate text-xs text-muted-foreground">Select product lines to assign their HS codes to this Service BOM</div>
                        </div>
                        <button onClick={() => setSbpTreeOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                      </div>
                      <div className="space-y-3 px-3 py-3">
                        <div className="grid gap-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product Line</label>
                          <div className="flex items-center gap-2 rounded border border-border bg-background px-2.5 py-2">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                              value={sbpTreeSearch}
                              onChange={(e) => setSbpTreeSearch(e.target.value)}
                              placeholder="Search by code or name…"
                              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <div className="max-h-72 overflow-y-auto rounded border border-border bg-background">
                            {(() => {
                              const seenIds = new Set<string>()
                              const lines: RowData[] = []
                              for (const raw of sbpTreeCandidates) {
                                const id = String(raw.product_line_id ?? "").trim()
                                if (!id || seenIds.has(id)) continue
                                seenIds.add(id)
                                lines.push(raw)
                              }
                              if (lines.length === 0) return <div className="px-3 py-2 text-sm text-muted-foreground">No product lines available</div>
                              const searchTerm = sbpTreeSearch.trim().toLowerCase()

                              const lineById = new Map<string, RowData>()
                              for (const l of lines) lineById.set(String(l.product_line_id ?? "").trim(), l)

                              const childrenMap = new Map<string, RowData[]>()
                              const rootItems: RowData[] = []
                              for (const l of lines) {
                                const parentRef = String(l.parent_line_id ?? "").trim()
                                if (!parentRef || !lineById.has(parentRef)) { rootItems.push(l); continue }
                                const siblings = childrenMap.get(parentRef)
                                if (siblings) siblings.push(l)
                                else childrenMap.set(parentRef, [l])
                              }

                              // When searching, find matching IDs and all their ancestors
                              const matchingIds = new Set<string>()
                              const ancestorIds = new Set<string>()
                              if (searchTerm) {
                                for (const l of lines) {
                                  const code = String(l.code ?? "").toLowerCase()
                                  const name = String(l.name ?? "").toLowerCase()
                                  if (code.includes(searchTerm) || name.includes(searchTerm)) {
                                    const id = String(l.product_line_id ?? "").trim()
                                    matchingIds.add(id)
                                    let pRef = String(l.parent_line_id ?? "").trim()
                                    while (pRef && lineById.has(pRef)) {
                                      ancestorIds.add(pRef)
                                      const parent = lineById.get(pRef)!
                                      pRef = String(parent.parent_line_id ?? "").trim()
                                    }
                                  }
                                }
                              }

                              const lineLabel = (l: RowData) => {
                                const code = String(l.code ?? "").trim()
                                const name = String(l.name ?? "").trim()
                                return code && name ? `${code} - ${name}` : code || name || String(l.product_line_id ?? "")
                              }

                              const nodes: React.ReactNode[] = []
                              const renderNode = (item: RowData, depth: number) => {
                                const id = String(item.product_line_id ?? "").trim()
                                const label = lineLabel(item)
                                const kids = childrenMap.get(id)
                                const hasChildren = kids && kids.length > 0

                                if (searchTerm && !matchingIds.has(id) && !ancestorIds.has(id)) return

                                const isExpanded = searchTerm ? (ancestorIds.has(id) || matchingIds.has(id)) : (sbpTreeExpanded[id] ?? false)
                                const isChecked = sbpTreeChecked.has(id)
                                const isMatch = searchTerm && matchingIds.has(id)
                                // Only leaf nodes (no children) are selectable
                                const isLeaf = !hasChildren

                                nodes.push(
                                  <div key={id} className="flex items-center" style={{ paddingLeft: `${depth * 20 + 4}px` }}>
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSbpTreeExpanded((prev) => ({ ...prev, [id]: !isExpanded })) }}
                                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
                                      >
                                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                      </button>
                                    ) : (
                                      <span className="inline-block h-6 w-6 shrink-0" />
                                    )}
                                    {isLeaf ? (
                                      <label className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${isChecked ? "bg-primary/10 font-medium text-primary" : isMatch ? "bg-yellow-500/10 hover:bg-yellow-500/20" : "hover:bg-muted"}`}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => setSbpTreeChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })}
                                          className="h-4 w-4 accent-primary"
                                        />
                                        <span className="truncate">{label}</span>
                                      </label>
                                    ) : (
                                      <span className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted-foreground`}>
                                        <span className="truncate">{label}</span>
                                      </span>
                                    )}
                                  </div>,
                                )
                                if (hasChildren && isExpanded) {
                                  for (const kid of kids!) renderNode(kid, depth + 1)
                                }
                              }
                              for (const root of rootItems) renderNode(root, 0)
                              if (nodes.length === 0 && searchTerm) return <div className="px-3 py-2 text-sm text-muted-foreground">No product lines match &quot;{sbpTreeSearch.trim()}&quot;</div>
                              return nodes
                            })()}
                          </div>
                          {sbpTreeChecked.size > 0 && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>Selected:</span>
                              <span className="font-medium text-foreground">{sbpTreeChecked.size} product line(s)</span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setSbpTreeOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                          <button
                            type="button"
                            disabled={sbpSaving || sbpTreeChecked.size === 0}
                            onClick={() => void sbpAssignFromTree(rrow)}
                            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40"
                          >
                            {sbpSaving ? "Assigning…" : `Assign (${sbpTreeChecked.size})`}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {recordView.entityKey === "master-client" && (
                  <div className="border-t border-border px-3 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Assigned Customers</span>
                            <span className="text-[11px] text-muted-foreground">Customers linked to this master client</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => refreshRecordChildren(SUBTABLES["master-client"] ?? [], rrow)}
                            title="Refresh customers"
                            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => openMasterClientCustomerDialog(rrow)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Assign Customer
                          </button>
                        </div>
                        <div className="space-y-3 p-3">
                          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                              value={masterClientCustomerSearch}
                              onChange={(e) => setMasterClientCustomerSearch(e.target.value)}
                              placeholder="Search assigned customers…"
                              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="px-2 pb-2 font-semibold">Customer</th>
                                <th className="px-2 pb-2 font-semibold">Code</th>
                                <th className="px-2 pb-2 font-semibold">Country</th>
                                <th className="px-2 pb-2 font-semibold">Status</th>
                                <th className="px-2 pb-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {filteredMcCustomers.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-2 pt-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 opacity-60" />
                                      {assignedMcCustomers.length === 0 ? "No customers assigned yet" : "No customers match your search"}
                                    </span>
                                  </td>
                                </tr>
                              ) : filteredMcCustomers.map((cu) => (
                                <tr key={cu.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-2 py-2.5">
                                    <span className="flex items-center gap-2.5">
                                      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                        {(cu.label || "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span className="font-medium">{cu.label}</span>
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-muted-foreground">{cu.code || "—"}</td>
                                  <td className="px-2 py-2.5 text-muted-foreground">{cu.country || "—"}</td>
                                  <td className="px-2 py-2.5">
                                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      {cu.status ? humanizeLabel(cu.status) : "Linked"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-right">
                                    <button
                                      type="button"
                                      disabled={!canWrite || recordSaving}
                                      onClick={() => requestRemoveMasterClientCustomer(cu.row, rrow)}
                                      title="Remove assignment"
                                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Master Client Scope</span>
                            <span className="text-[11px] text-muted-foreground">Customers inherit this master client context</span>
                          </div>
                        </div>
                        <div className="space-y-3 p-3 text-sm text-muted-foreground">
                          <div>{String(rrow.master_client_code ?? rrow.master_client_id ?? "")}</div>
                          <div>{String(rrow.master_client_name ?? "")}</div>
                          <div>{assignedMcCustomers.length} customer{assignedMcCustomers.length === 1 ? "" : "s"} linked to this master client.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {recordView.entityKey === "profit-center" && (
                  <div className="border-t border-border px-3 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Assigned Cost Centers</span>
                            <span className="text-[11px] text-muted-foreground">Cost centers linked to this profit center</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => refreshRecordChildren(SUBTABLES["profit-center"] ?? [], rrow)}
                            title="Refresh cost centers"
                            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => openProfitCenterCostCenterDialog(rrow)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Assign Cost Center
                          </button>
                        </div>
                        <div className="space-y-3 p-3">
                          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                              value={profitCenterCostCenterSearch}
                              onChange={(e) => setProfitCenterCostCenterSearch(e.target.value)}
                              placeholder="Search assigned cost centers…"
                              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="px-2 pb-2 font-semibold">Cost Center</th>
                                <th className="px-2 pb-2 font-semibold">Code</th>
                                <th className="px-2 pb-2 font-semibold">Status</th>
                                <th className="px-2 pb-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAssignedCostCenters.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-2 pt-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 opacity-60" />
                                      {assignedCostCenters.length === 0 ? "No cost centers assigned yet" : "No cost centers match your search"}
                                    </span>
                                  </td>
                                </tr>
                              ) : filteredAssignedCostCenters.map((cc) => (
                                <tr key={cc.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-2 py-2.5">
                                    <span className="flex items-center gap-2.5">
                                      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                        {(cc.label || "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span className="font-medium">{cc.label}</span>
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-muted-foreground">{cc.code || "—"}</td>
                                  <td className="px-2 py-2.5">
                                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      {cc.status ? humanizeLabel(cc.status) : "Linked"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-right">
                                    <button
                                      type="button"
                                      disabled={!canWrite || recordSaving}
                                      onClick={() => requestRemoveProfitCenterCostCenter(cc.row, rrow)}
                                      title="Remove assignment"
                                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Profit Center Scope</span>
                            <span className="text-[11px] text-muted-foreground">Cost centers inherit this profit center context</span>
                          </div>
                        </div>
                        <div className="space-y-3 p-3 text-sm text-muted-foreground">
                          <div>{String(rrow.code ?? rrow.profit_center_id ?? "")}</div>
                          <div>{String(rrow.name ?? "")}</div>
                          <div>{assignedCostCenters.length} cost center{assignedCostCenters.length === 1 ? "" : "s"} linked to this profit center.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {recordView.entityKey === "division" && divisionProfitCenterOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                  <div className="w-full max-w-md rounded-md border border-border bg-card shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Assign Profit Center</div>
                        <div className="truncate text-xs text-muted-foreground">{String(rrow.code ?? rrow.division_id ?? "")}{rrow.name ? ` - ${String(rrow.name)}` : ""}</div>
                      </div>
                      <button onClick={() => setDivisionProfitCenterOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <div className="grid gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profit Center</label>
                        <select
                          value={divisionProfitCenterDraft}
                          onChange={(e) => setDivisionProfitCenterDraft(e.target.value)}
                          className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
                        >
                          <option value="">{divisionProfitCenterCandidates.length === 0 ? "No profit centers available" : "Select profit center"}</option>
                          {divisionProfitCenterCandidates
                            .filter((candidate) => !String(candidate.division_id ?? "").trim() || String(candidate.division_id ?? "") === String(rrow.division_id ?? ""))
                            .filter((candidate) => !assignedProfitCenters.some((a) => a.id === String(candidate.profit_center_id ?? "")))
                            .map((candidate) => {
                              const value = String(candidate.profit_center_id ?? "")
                              const label = String(candidate.name ?? candidate.code ?? value)
                              return <option key={value} value={value}>{label}</option>
                            })}
                        </select>
                        <p className="text-[11px] text-muted-foreground">Already-assigned and other-division profit centers are hidden. Add them one at a time.</p>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setDivisionProfitCenterOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                        <button
                          type="button"
                          disabled={recordSaving || !divisionProfitCenterDraft.trim()}
                          onClick={() => void assignDivisionProfitCenter(rrow)}
                          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40"
                        >
                          {recordSaving ? "Adding…" : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {recordView.entityKey === "product-line" && productLineProductCategoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                  <div className="w-full max-w-md rounded-md border border-border bg-card shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Assign HS Code</div>
                        <div className="truncate text-xs text-muted-foreground">{String(rrow.code ?? rrow.product_line_id ?? "")}{rrow.name ? ` - ${String(rrow.name)}` : ""}</div>
                      </div>
                      <button onClick={() => setProductLineProductCategoryOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <div className="grid gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">HS Code</label>
                        {/* Search input */}
                        <div className="flex items-center gap-2 rounded border border-border bg-background px-2.5 py-2">
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <input
                            value={productLineCategoryTreeSearch}
                            onChange={(e) => setProductLineCategoryTreeSearch(e.target.value)}
                            placeholder="Search by code or description…"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        {/* Collapsible tree picker */}
                        <div className="max-h-64 overflow-y-auto rounded border border-border bg-background">
                          {(() => {
                            // Deduplicate by product_category_id
                            const seenIds = new Set<string>()
                            const cats: RowData[] = []
                            for (const raw of productLineProductCategoryCandidates) {
                              const id = String(raw.product_category_id ?? "").trim()
                              if (!id || seenIds.has(id)) continue
                              seenIds.add(id)
                              cats.push(raw)
                            }
                            if (cats.length === 0) return <div className="px-3 py-2 text-sm text-muted-foreground">No product categories available</div>
                            const searchTerm = productLineCategoryTreeSearch.trim().toLowerCase()

                            // Build lookup by product_category_id AND by code (parent_category_id may reference either)
                            const catById = new Map<string, RowData>()
                            const catByCode = new Map<string, RowData>()
                            for (const cat of cats) {
                              const id = String(cat.product_category_id ?? "").trim()
                              catById.set(id, cat)
                              const code = String(cat.code ?? "").trim()
                              if (code) catByCode.set(code, cat)
                            }
                            // Resolve parent: try product_category_id first, then code
                            const resolveParent = (parentRef: string): RowData | undefined =>
                              catById.get(parentRef) ?? catByCode.get(parentRef)
                            const resolveParentId = (parentRef: string): string | undefined => {
                              const p = resolveParent(parentRef)
                              return p ? String(p.product_category_id ?? "").trim() : undefined
                            }

                            // Build children map keyed by the RESOLVED product_category_id of the parent
                            const childrenMap = new Map<string, RowData[]>()
                            const rootItems: RowData[] = []
                            for (const cat of cats) {
                              const parentRef = String(cat.parent_category_id ?? "").trim()
                              const parentId = parentRef ? resolveParentId(parentRef) : undefined
                              if (!parentRef || !parentId) { rootItems.push(cat); continue }
                              const siblings = childrenMap.get(parentId)
                              if (siblings) siblings.push(cat)
                              else childrenMap.set(parentId, [cat])
                            }

                            // When searching, find matching IDs and all their ancestors so the path is visible
                            const matchingIds = new Set<string>()
                            const ancestorIds = new Set<string>()
                            if (searchTerm) {
                              for (const cat of cats) {
                                const code = String(cat.code ?? "").toLowerCase()
                                const desc = String(cat.description ?? "").toLowerCase()
                                const catName = String(cat.name ?? "").toLowerCase()
                                if (code.includes(searchTerm) || desc.includes(searchTerm) || catName.includes(searchTerm)) {
                                  const id = String(cat.product_category_id ?? "").trim()
                                  matchingIds.add(id)
                                  // Walk up to collect ancestors (resolve via id or code)
                                  let pRef = String(cat.parent_category_id ?? "").trim()
                                  while (pRef) {
                                    const pId = resolveParentId(pRef)
                                    if (!pId) break
                                    ancestorIds.add(pId)
                                    const pCat = catById.get(pId)
                                    pRef = pCat ? String(pCat.parent_category_id ?? "").trim() : ""
                                  }
                                }
                              }
                            }

                            const catLabel = (cat: RowData) => {
                              const code = String(cat.code ?? "").trim()
                              const desc = String(cat.description ?? "").trim()
                              const name = String(cat.name ?? "").trim()
                              const label = desc || name // prefer description, fall back to name
                              return code && label ? `${code} - ${label}` : code || label || String(cat.product_category_id ?? "")
                            }

                            const nodes: React.ReactNode[] = []
                            const renderNode = (item: RowData, depth: number) => {
                              const id = String(item.product_category_id ?? "").trim()
                              const label = catLabel(item)
                              const kids = childrenMap.get(id)
                              const hasChildren = kids && kids.length > 0

                              // When searching, skip nodes that aren't matches or ancestors of matches
                              if (searchTerm && !matchingIds.has(id) && !ancestorIds.has(id)) return

                              // Auto-expand ancestors during search; otherwise use manual state
                              const isExpanded = searchTerm ? (ancestorIds.has(id) || matchingIds.has(id)) : (productLineCategoryTreeExpanded[id] ?? false)
                              const isSelected = productLineProductCategoryDraft === id
                              const isMatch = searchTerm && matchingIds.has(id)
                              const selectable = isCategorySelectable(item)
                              nodes.push(
                                <div key={id} className="flex items-center" style={{ paddingLeft: `${depth * 20 + 4}px` }}>
                                  {hasChildren ? (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setProductLineCategoryTreeExpanded((prev) => ({ ...prev, [id]: !isExpanded })) }}
                                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
                                    >
                                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                    </button>
                                  ) : (
                                    <span className="inline-block h-6 w-6 shrink-0" />
                                  )}
                                  <button
                                    type="button"
                                    disabled={!selectable}
                                    onClick={() => selectable && setProductLineProductCategoryDraft(isSelected ? "" : id)}
                                    title={!selectable ? `Not selectable (status: ${String(item.status ?? "unknown")}, valid: ${String(item.valid_from ?? "?").slice(0, 10)} – ${String(item.valid_to ?? "open").slice(0, 10)})` : undefined}
                                    className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${!selectable ? "cursor-not-allowed opacity-50" : isSelected ? "bg-primary/10 font-medium text-primary" : isMatch ? "bg-yellow-500/10 hover:bg-yellow-500/20" : "hover:bg-muted"}`}
                                  >
                                    <span className="truncate">{label}</span>
                                  </button>
                                </div>,
                              )
                              if (hasChildren && isExpanded) {
                                for (const kid of kids!) renderNode(kid, depth + 1)
                              }
                            }
                            for (const root of rootItems) renderNode(root, 0)
                            if (nodes.length === 0 && searchTerm) return <div className="px-3 py-2 text-sm text-muted-foreground">No categories match &quot;{productLineCategoryTreeSearch.trim()}&quot;</div>
                            return nodes
                          })()}
                        </div>
                        {productLineProductCategoryDraft && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span>Selected:</span>
                            <span className="font-medium text-foreground">
                              {(() => {
                                const sel = productLineProductCategoryCandidates.find((c) => String(c.product_category_id ?? "") === productLineProductCategoryDraft)
                                if (!sel) return productLineProductCategoryDraft
                                const code = String(sel.code ?? "")
                                const desc = String(sel.description ?? "")
                                return code && desc ? `${code} - ${desc}` : code || desc || productLineProductCategoryDraft
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setProductLineProductCategoryOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                        <button
                          type="button"
                          disabled={recordSaving || !productLineProductCategoryDraft.trim()}
                          onClick={() => void assignProductLineProductCategory(rrow)}
                          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40"
                        >
                          {recordSaving ? "Assigning…" : "Assign"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {recordView.entityKey === "profit-center" && profitCenterCostCenterOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                  <div className="w-full max-w-md rounded-md border border-border bg-card shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Assign Cost Center</div>
                        <div className="truncate text-xs text-muted-foreground">{String(rrow.code ?? rrow.profit_center_id ?? "")}{rrow.name ? ` - ${String(rrow.name)}` : ""}</div>
                      </div>
                      <button onClick={() => setProfitCenterCostCenterOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <div className="grid gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cost Center</label>
                        <select
                          value={profitCenterCostCenterDraft}
                          onChange={(e) => setProfitCenterCostCenterDraft(e.target.value)}
                          className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
                        >
                          <option value="">{profitCenterCostCenterCandidates.length === 0 ? "No cost centers available" : "Select cost center"}</option>
                          {profitCenterCostCenterCandidates
                            .filter((candidate) => !String(candidate.profit_center_id ?? "").trim() || String(candidate.profit_center_id ?? "") === String(rrow.profit_center_id ?? ""))
                            .filter((candidate) => !assignedCostCenters.some((a) => a.id === String(candidate.cost_center_id ?? "")))
                            .map((candidate) => {
                              const value = String(candidate.cost_center_id ?? "")
                              const label = String(candidate.name ?? candidate.code ?? value)
                              return <option key={value} value={value}>{label}</option>
                            })}
                        </select>
                        <p className="text-[11px] text-muted-foreground">Already-assigned and other-profit-center cost centers are hidden. Add them one at a time.</p>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setProfitCenterCostCenterOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                        <button
                          type="button"
                          disabled={recordSaving || !profitCenterCostCenterDraft.trim()}
                          onClick={() => void assignProfitCenterCostCenter(rrow)}
                          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40"
                        >
                          {recordSaving ? "Adding…" : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {recordView.entityKey === "master-client" && masterClientCustomerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                  <div className="w-full max-w-md rounded-md border border-border bg-card shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Assign Customer</div>
                        <div className="truncate text-xs text-muted-foreground">{String(rrow.master_client_code ?? rrow.master_client_id ?? "")}{rrow.master_client_name ? ` - ${String(rrow.master_client_name)}` : ""}</div>
                      </div>
                      <button onClick={() => setMasterClientCustomerOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <div className="grid gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Search Customer</label>
                        <div className="flex items-center gap-2 rounded border border-border bg-background px-2 py-2">
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <input
                            value={masterClientCustomerDraft}
                            onChange={(e) => setMasterClientCustomerDraft(e.target.value)}
                            placeholder="Type to search by code or name…"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded border border-border">
                          {(() => {
                            const q = masterClientCustomerDraft.trim().toLowerCase()
                            const available = masterClientCustomerCandidates
                              .filter((c) => !String(c.master_client_id ?? "").trim() || String(c.master_client_id ?? "") === String(rrow.master_client_id ?? ""))
                              .filter((c) => !assignedMcCustomers.some((a) => a.id === String(c.customer_id ?? "")))
                            const filtered = q
                              ? available.filter((c) => `${String(c.customer_code ?? "")} ${String(c.customer_name ?? "")}`.toLowerCase().includes(q))
                              : available
                            if (filtered.length === 0) return <div className="px-3 py-3 text-sm text-muted-foreground">{available.length === 0 ? "No customers available" : "No matches"}</div>
                            return filtered.map((c) => {
                              const cid = String(c.customer_id ?? "")
                              const code = String(c.customer_code ?? "")
                              const name = String(c.customer_name ?? "")
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  disabled={recordSaving}
                                  onClick={() => void assignMasterClientCustomer(rrow, cid)}
                                  className="flex w-full items-center gap-2.5 border-b border-border/50 px-3 py-2 text-left text-sm transition last:border-0 hover:bg-muted disabled:opacity-40"
                                >
                                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                    {(name || code || "?").charAt(0).toUpperCase()}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">{name || code}</span>
                                    {code && name && <span className="block truncate text-xs text-muted-foreground">{code}</span>}
                                  </span>
                                </button>
                              )
                            })
                          })()}
                        </div>
                        <p className="text-[11px] text-muted-foreground">Already-assigned and other-master-client customers are hidden. Click a customer to assign.</p>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={() => setMasterClientCustomerOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {recordView.entityKey === "cost-center-group" && lineDetail?.isNew && lineDetail.cfg.assignMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                  <div className="w-full max-w-md rounded-md border border-border bg-card shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Assign {lineDetail.cfg.label}</div>
                        <div className="truncate text-xs text-muted-foreground">{String(rrow.code ?? rrow.cost_center_group_id ?? "")}{rrow.name ? ` - ${String(rrow.name)}` : ""}</div>
                      </div>
                      <button onClick={() => { setLineDetail(null); setLineEditing(false) }} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      {renderAssignPicker()}
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => { setLineDetail(null); setLineEditing(false) }} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {officeTeamCfg && (
                <div className="border-t border-border px-3 py-4">
                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                          <Users className="h-4 w-4" />
                        </span>
                        <div className="flex flex-1 flex-col leading-tight">
                          <span className="text-[13px] font-semibold tracking-tight">Assigned {officeTeamCfg.teamPlural}</span>
                          <span className="text-[11px] text-muted-foreground">Teams linked to this {officeTeamCfg.officeLabel}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => refreshDeliveryOfficeTeams(rrow)}
                          title="Refresh teams"
                          className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={!canWrite}
                          onClick={() => openDeliveryOfficeTeamDialog(rrow)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="text-sm leading-none">+</span> Assign Team
                        </button>
                      </div>
                      <div className="space-y-3 p-3">
                        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <input
                            value={deliveryOfficeTeamSearch}
                            onChange={(e) => setDeliveryOfficeTeamSearch(e.target.value)}
                            placeholder="Search assigned teams..."
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            <tr className="border-b border-border">
                              <th className="px-2 pb-2 font-semibold">{officeTeamCfg.teamSingular}</th>
                              <th className="px-2 pb-2 font-semibold">Manager</th>
                              <th className="px-2 pb-2 font-semibold">Status</th>
                              <th className="px-2 pb-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAssignedDeliveryTeams.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-2 pt-3 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-2">
                                    <Users className="h-4 w-4 opacity-60" />
                                    {assignedDeliveryTeams.length === 0 ? `No ${officeTeamCfg.teamPlural.toLowerCase()} assigned yet` : "No teams match your search"}
                                  </span>
                                </td>
                              </tr>
                            ) : filteredAssignedDeliveryTeams.map((team) => (
                              <tr key={team.id} className="border-b border-border/50 last:border-0">
                                <td className="px-2 py-2.5">
                                  <span className="flex items-center gap-2.5">
                                    <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                      {(team.code || team.label || "?").charAt(0).toUpperCase()}
                                    </span>
                                    <span className="flex flex-col leading-tight">
                                      <span className="font-medium">{team.label}</span>
                                      <span className="text-[11px] text-muted-foreground">{team.code || "-"}</span>
                                    </span>
                                  </span>
                                </td>
                                <td className="px-2 py-2.5 text-muted-foreground">{team.manager || "-"}</td>
                                <td className="px-2 py-2.5">
                                  <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    {team.status ? humanizeLabel(team.status) : "Linked"}
                                  </span>
                                </td>
                                <td className="px-2 py-2.5 text-right">
                                  <button
                                    type="button"
                                    disabled={!canWrite || recordSaving}
                                    onClick={() => requestRemoveDeliveryOfficeTeam(team.row, rrow)}
                                    title="Remove assignment"
                                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[13px] font-semibold tracking-tight">Office Scope</span>
                          <span className="text-[11px] text-muted-foreground">{officeTeamCfg.teamPlural} inherit this office context</span>
                        </div>
                      </div>
                      <div className="space-y-3 p-3 text-sm text-muted-foreground">
                        <div>{String(rrow.code ?? rrow[officeTeamCfg.parentIdCol] ?? "")}</div>
                        <div>{String(rrow.name ?? "")}</div>
                        <div>{assignedDeliveryTeams.length} {officeTeamCfg.teamSingular.toLowerCase()}{assignedDeliveryTeams.length === 1 ? "" : "s"} linked to this office.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {officeTeamCfg && deliveryOfficeTeamOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                  <div className="w-full max-w-md rounded-md border border-border bg-card shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Assign {officeTeamCfg.teamSingular}</div>
                        <div className="truncate text-xs text-muted-foreground">{String(rrow.code ?? rrow[officeTeamCfg.parentIdCol] ?? "")}{rrow.name ? ` - ${String(rrow.name)}` : ""}</div>
                      </div>
                      <button onClick={() => setDeliveryOfficeTeamOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <div className="grid gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{officeTeamCfg.teamSingular}</label>
                        <select
                          value={deliveryOfficeTeamDraft}
                          onChange={(e) => setDeliveryOfficeTeamDraft(e.target.value)}
                          className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
                        >
                          {(() => {
                            const assignedIds = new Set(assignedDeliveryTeams.map((team) => team.id))
                            const available = deliveryOfficeTeamCandidates.filter((candidate) => {
                              const id = String(candidate[officeTeamCfg.childIdCol] ?? "")
                              const assignedOffice = String(candidate[officeTeamCfg.fkCol] ?? "").trim()
                              return id && !assignedIds.has(id) && !assignedOffice
                            })
                            return (
                              <>
                                <option value="">{available.length === 0 ? `No unassigned ${officeTeamCfg.teamPlural.toLowerCase()} available` : `Select ${officeTeamCfg.teamSingular.toLowerCase()}`}</option>
                                {available.map((candidate) => {
                                  const value = String(candidate[officeTeamCfg.childIdCol] ?? "")
                                  const code = String(candidate.code ?? "").trim()
                                  const name = String(candidate.name ?? value).trim()
                                  return <option key={value} value={value}>{[code, name].filter(Boolean).join(" - ") || value}</option>
                                })}
                              </>
                            )
                          })()}
                        </select>
                        <p className="text-[11px] text-muted-foreground">Teams already assigned to an office are hidden. Remove their current link first to move them.</p>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setDeliveryOfficeTeamOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                        <button
                          type="button"
                          disabled={recordSaving || !deliveryOfficeTeamDraft.trim()}
                          onClick={() => void assignDeliveryOfficeTeam(rrow)}
                          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40"
                        >
                          {recordSaving ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {recordView.entityKey === "legal-entity" && (
                <div className="border-t border-border px-3 py-4">
                  <div className="space-y-4">
                      {/* Child Records */}
                      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div className="flex flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight">Child Records</span>
                            <span className="text-[11px] text-muted-foreground">Bank accounts, tax registrations, addresses, contacts, and profit centers</span>
                          </div>
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => { const first = visibleChildren[0]; if (first) { setRecordLineTab(first.childEntity); fetchRecordChild(first, rrow, true) } }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-sm leading-none">+</span> Focus Tab
                          </button>
                        </div>
                        <div className="space-y-3 p-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {visibleChildren.map((child) => {
                              const count = recordChildRows[child.childEntity]?.length ?? 0
                              return (
                                <button
                                  key={child.childEntity}
                                  type="button"
                                  onClick={() => { setRecordLineTab(child.childEntity); fetchRecordChild(child, rrow, true) }}
                                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${lineCfg.childEntity === child.childEntity ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/50"}`}
                                >
                                  <span className="flex min-w-0 flex-col leading-tight">
                                    <span className="truncate text-[13px] font-medium text-foreground">{child.label}</span>
                                    <span className="text-[11px] text-muted-foreground">{child.columns.slice(0, 4).map(humanizeLabel).join(" · ")}</span>
                                  </span>
                                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{count}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              )}
              {recordView.entityKey === "controlling-area" && (
                <div className="border-t border-border px-3 py-4">
                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                          <Users className="h-4 w-4" />
                        </span>
                        <div className="flex flex-1 flex-col leading-tight">
                          <span className="text-[13px] font-semibold tracking-tight">Assigned Legal Entities</span>
                          <span className="text-[11px] text-muted-foreground">Entities linked to this controlling area</span>
                        </div>
                        <button
                          type="button"
                          disabled={!canWrite}
                          onClick={() => {
                            const cfg = (SUBTABLES["controlling-area"] ?? []).find((c) => c.childEntity === "legal-entity")
                            if (cfg) addLineRecord(cfg, rrow)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="text-sm leading-none">+</span> Assign Entity
                        </button>
                      </div>
                      <div className="space-y-3 p-3">
                        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <input
                            value={controllingAreaEntitySearch}
                            onChange={(e) => setControllingAreaEntitySearch(e.target.value)}
                            placeholder="Search assigned entities…"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        {(() => {
                          const assigned = (recordChildRows["legal-entity"] ?? []).map((ent) => ({
                            row: ent,
                            id: String(ent.legal_entity_id ?? ""),
                            label: String(ent.legal_entity_name ?? ent.name ?? ent.legal_entity_code ?? ent.code ?? ent.legal_entity_id ?? "").trim(),
                            region: String(ent.country_code ?? "").trim(),
                            currency: String(ent.currency_code ?? "").trim(),
                            status: String(ent.status ?? "").trim(),
                          })).filter((ent) => ent.id)
                          const q = controllingAreaEntitySearch.trim().toLowerCase()
                          const filtered = q ? assigned.filter((ent) => `${ent.label} ${ent.region} ${ent.currency}`.toLowerCase().includes(q)) : assigned
                          return (
                            <table className="min-w-full text-left text-sm">
                              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                <tr className="border-b border-border">
                                  <th className="px-2 pb-2 font-semibold">Legal Entity</th>
                                  <th className="px-2 pb-2 font-semibold">Region</th>
                                  <th className="px-2 pb-2 font-semibold">Status</th>
                                  <th className="px-2 pb-2" />
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="px-2 pt-3 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 opacity-60" />
                                        {assigned.length === 0 ? "No legal entity assigned" : "No entities match your search"}
                                      </span>
                                    </td>
                                  </tr>
                                ) : filtered.map((ent) => (
                                  <tr key={ent.id} className="border-b border-border/50 last:border-0">
                                    <td className="px-2 py-2.5">
                                      <button
                                        type="button"
                                        onClick={() => openRecordView(ent.row, "legal-entity")}
                                        className="flex w-full items-center gap-2.5 text-left"
                                      >
                                        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                                          {ent.label.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="flex flex-col leading-tight">
                                          <span className="font-medium">{ent.label}</span>
                                          <span className="text-[11px] text-muted-foreground">{ent.currency || "—"}</span>
                                        </span>
                                      </button>
                                    </td>
                                    <td className="px-2 py-2.5 text-muted-foreground">{ent.region || "—"}</td>
                                    <td className="px-2 py-2.5">
                                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                        {ent.status ? humanizeLabel(ent.status) : "Linked"}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2.5 text-right">
                                      <button
                                        type="button"
                                        disabled={!canWrite || recordSaving}
                                        onClick={() => requestRemoveControllingAreaLegalEntity(ent.row, rrow)}
                                        title="Remove assignment"
                                        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                          <GitBranch className="h-4 w-4" />
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[13px] font-semibold tracking-tight">Control Scope</span>
                          <span className="text-[11px] text-muted-foreground">Relationship settings stay in the header fields</span>
                        </div>
                      </div>
                      <div className="space-y-3 p-3 text-sm text-muted-foreground">
                        <div>Use Assign Entity to link another legal entity into this controlling area.</div>
                        <div>Select a row to jump straight into the legal entity record view.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {recordView.entityKey === "credit-area" && creditAreaLegalEntityOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true">
                  <div className="w-full max-w-md rounded-md border border-border bg-card shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Assign Legal Entity</div>
                        <div className="truncate text-xs text-muted-foreground">{String(rrow.code ?? rrow.credit_area_id ?? "")}{rrow.name ? ` - ${String(rrow.name)}` : ""}</div>
                      </div>
                      <button onClick={() => setCreditAreaLegalEntityOpen(false)} className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Close</button>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <div className="grid gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Legal Entity</label>
                        <select
                          value={creditAreaLegalEntityDraft}
                          onChange={(e) => setCreditAreaLegalEntityDraft(e.target.value)}
                          className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
                        >
                          <option value="">{creditAreaLegalEntityCandidates.length === 0 ? "No legal entities available" : "Select legal entity"}</option>
                          {creditAreaLegalEntityCandidates
                            .filter((candidate) => !assignedLegalEntities.some((a) => a.id === String(candidate.legal_entity_id ?? "")))
                            .map((candidate) => {
                              const value = String(candidate.legal_entity_id ?? "")
                              const label = String(candidate.legal_entity_name ?? candidate.name ?? candidate.legal_entity_code ?? candidate.code ?? value)
                              return <option key={value} value={value}>{label}</option>
                            })}
                        </select>
                        <p className="text-[11px] text-muted-foreground">Already assigned entities are hidden. Add them one at a time.</p>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setCreditAreaLegalEntityOpen(false)} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">Cancel</button>
                        <button
                          type="button"
                          disabled={recordSaving || !creditAreaLegalEntityDraft.trim()}
                          onClick={() => void assignCreditAreaLegalEntity(rrow)}
                          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40"
                        >
                          {recordSaving ? "Adding…" : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* LINE — separate section, list/edit/detail for the active child table */}
              {recordView.entityKey !== "cost-center-group" && recordView.entityKey !== "product-category" && recordView.entityKey !== "credit-area" && recordView.entityKey !== "controlling-area" && recordView.entityKey !== "delivery-office" && recordView.entityKey !== "sales-office" && recordView.entityKey !== "purchase-office" && recordView.entityKey !== "division" && recordView.entityKey !== "profit-center" && recordView.entityKey !== "master-client" && visibleChildren.length > 0 && lineCfg && (
                <section className="rounded-md border border-border bg-card">
                  <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-2 py-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[11px] font-semibold text-muted-foreground">LINE</span>
                      {lineDetail ? (
                        <button onClick={() => { setLineDetail(null); setLineEditing(false) }} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">← Back</button>
                      ) : recordView.entityKey === "legal-entity" ? (
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {lineCfg.label}{recordChildRows[lineCfg.childEntity] ? ` (${recordChildRows[lineCfg.childEntity].length})` : ""}
                        </span>
                      ) : visibleChildren.map((c) => (
                        <button key={c.childEntity} onClick={() => { setRecordLineTab(c.childEntity); setSelectedLineId(""); fetchRecordChild(c, rrow) }} className={`rounded px-2 py-0.5 text-xs ${lineCfg.childEntity === c.childEntity ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                          {c.label}{recordChildRows[c.childEntity] ? ` (${recordChildRows[c.childEntity].length})` : ""}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {lineDetail ? (
                        <>
                          {!lineEditing && canWrite && !lineDetail.isNew && !LOCKED_MDM_ENTITIES.has(lineDetail.cfg.childEntity) && <button onClick={() => { setLineDraft(rowDraftFromRecord(entities.find((e) => e.key === lineDetail.cfg.childEntity), lineDetail.row)); setLineEditing(true) }} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Edit</button>}
                          {lineEditing && <button disabled={recordSaving} onClick={() => void saveLineDetail(rrow)} className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">{recordSaving ? "Saving…" : "Save"}</button>}
                          {lineEditing && <button onClick={() => { if (lineDetail.isNew) setLineDetail(null); setLineEditing(false) }} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Cancel</button>}
                          {!lineEditing && canDelete && !lineDetail.isNew && !LOCKED_MDM_ENTITIES.has(lineDetail.cfg.childEntity) && <button onClick={() => void deleteLineRecord(lineDetail.cfg, lineDetail.row, rrow)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Delete</button>}
                        </>
                      ) : (
                        <>
                          {canWrite && !LOCKED_MDM_ENTITIES.has(lineCfg.childEntity) && <button onClick={() => addLineRecord(lineCfg, rrow)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Add</button>}
                          {canWrite && !LOCKED_MDM_ENTITIES.has(lineCfg.childEntity) && <button disabled={!selRow} onClick={() => selRow && openLineDetail(lineCfg, selRow)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40">Edit</button>}
                          {canDelete && !LOCKED_MDM_ENTITIES.has(lineCfg.childEntity) && <button disabled={!selRow} onClick={() => selRow && void deleteLineRecord(lineCfg, selRow, rrow)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40">Delete</button>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="overflow-auto px-2 py-1.5">
                    {lineDetail ? (
                      <div className="space-y-2.5">
                        {/* Breadcrumb: parent header is the implicit context — don't show the FK field again in the line form. */}
                        <div className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold uppercase tracking-wide">Parent:</span>{" "}
                          <span className="font-medium text-foreground">{String(rrow.legal_entity_code ?? rrow.code ?? rrow[lineDetail.cfg.fkColumn] ?? "")}</span>
                          {rrow.legal_entity_name || rrow.name ? <span className="text-muted-foreground"> — {String(rrow.legal_entity_name ?? rrow.name ?? "")}</span> : null}
                          <span className="text-muted-foreground"> / {lineDetail.cfg.label}</span>
                        </div>
                        {renderAssignPicker()}
                        {!(lineDetail.isNew && lineDetail.cfg.assignMode) && groupFieldsByTopic([...((entities.find((e) => e.key === lineDetail.cfg.childEntity)?.columns ?? []).filter((c) => c !== lineDetail.cfg.fkColumn)), "status", "valid_from", "valid_to"], lineDetail.cfg.childEntity).map((grp) => (
                          <div key={grp.label}>
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{grp.label}</div>
                            <div className="grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                              {grp.fields.map((f) => fieldRow(f, lineEditing ? renderRecordField(f, lineDraft, setLineDraft) : formatDisplayValue(f, lineDetail.row[f])))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recordChildLoading === lineCfg.childEntity ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</div>
                    ) : lineRows.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">No {lineCfg.label.toLowerCase()} yet. Use Add, or double-click a row.</div>
                    ) : (
                      <div>
                        <div onDragOver={(e) => { e.preventDefault() }} onDrop={(e) => { e.preventDefault(); if (lineDragCol) setLineGroupBy(lineDragCol); setLineDragCol("") }} className="mb-2 flex items-center justify-between gap-2 rounded border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
                          {lineGroupBy ? <span>Grouped by: <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{humanizeLabel(lineGroupBy)}</span></span> : "Drag a column header here to group"}
                          {lineGroupBy && <button onClick={() => setLineGroupBy("")} className="rounded px-1 hover:text-destructive">Clear</button>}
                        </div>
                        <table className="min-w-full text-[13px]">
                          <thead className="bg-muted text-muted-foreground"><tr>{lineCfg.columns.map((col) => (
                            <th key={col} draggable onDragStart={(e) => { setLineDragCol(col); e.dataTransfer.effectAllowed = "move" }} style={lineColWidths[col] ? { width: lineColWidths[col], minWidth: lineColWidths[col] } : undefined} className="px-3 py-2 text-left font-medium">{renderLineHeader(col)}</th>
                          ))}</tr></thead>
                          <tbody>
                            {lineGroups.map((g, gi) => (
                              <React.Fragment key={`${g.key}-${gi}`}>
                                {lineGroupBy && <tr className="border-t border-border/60 bg-muted/30"><td colSpan={lineCfg.columns.length} className="px-3 py-1 text-xs font-medium">{humanizeLabel(lineGroupBy)}: {g.key} ({g.rows.length})</td></tr>}
                                {g.rows.map((cr, i) => {
                                  const cid = String(cr[childIdCol(lineCfg.childEntity)] ?? "")
                                  const isTreeChild = lineCfg.childEntity === COST_CENTER_GROUP_CHILD_ENTITY || (recordView.entityKey === "product-category" && lineCfg.childEntity === "product-category")
                                  return (
                                    <tr key={i} className={`cursor-pointer border-t border-border/60 hover:bg-muted/40 ${selectedLineId === cid ? (isTreeChild ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "bg-primary/10") : ""}`}
                                      onClick={() => { setSelectedLineId(cid); if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current); rowClickTimerRef.current = setTimeout(() => { rowClickTimerRef.current = null; setDetailRowEntity(lineCfg.childEntity); setDetailRow(cr); setDetailTab("overview") }, 220) }}
                                      onDoubleClick={() => { if (rowClickTimerRef.current) { clearTimeout(rowClickTimerRef.current); rowClickTimerRef.current = null } setDetailRow(null); openLineDetail(lineCfg, cr) }}>
                                      {lineCfg.columns.map((col, ci) => (
                                        <td key={col} className="px-3 py-1.5">
                                          {isTreeChild && ci === 0 ? (
                                            <span className="inline-flex items-center gap-1.5">
                                              <span className="inline-flex h-4 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing" title="Drag to reorder" onClick={(e) => e.stopPropagation()}>
                                                <GripVertical className="h-3.5 w-3.5" />
                                              </span>
                                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                                              <span>{String(cr[col] ?? "") || "-"}</span>
                                            </span>
                                          ) : (
                                            URL_FIELDS.has(col) ? renderUrlLink(cr[col])
                                            : col === "status" ? (cr[col] ? humanizeLabel(String(cr[col])) : "-")
                                            : (col === "is_primary" || col === "is_default") ? (String(cr[col]) === "true" ? "✓" : "-")
                                            // FK columns: resolve the raw id to its "CODE - Name" label via the
                                            // already-loaded lookup options (e.g. feature_of_product_id -> "PF008 - Cellular modem").
                                            : ((lookupOptions[col] ?? []).find((opt) => String(opt.value) === String(cr[col] ?? ""))?.label ?? (String(cr[col] ?? "") || "-"))
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  )
                                })}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
            </div>
          )
        })() : (<>
        <div
          onDragOver={(e) => { e.preventDefault() }}
          onDrop={(e) => { e.preventDefault(); if (dragColumn) setGroupBy(dragColumn); setDragColumn("") }}
          className="flex items-center justify-between gap-2 border-b border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
        >
          {groupBy ? (
            <span>Grouped by: <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{humanizeLabel(groupBy)}</span></span>
          ) : (
            <span>Drag a column header here to group</span>
          )}
          {groupBy && <button onClick={() => setGroupBy("")} className="rounded px-1 hover:text-destructive">Clear</button>}
        </div>
        <div className="border-b border-border bg-muted/20 p-2">
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && !isLockedEntity && <Button type="button" variant="outline" size="sm" onClick={startInlineAdd} className="h-8 px-3 text-xs">Add</Button>}
            {canWrite && !isLockedEntity && <Button type="button" variant="outline" size="sm" onClick={startInlineEditSelected} className="h-8 px-3 text-xs">Edit</Button>}
            {canDelete && !isLockedEntity && <Button type="button" variant="outline" size="sm" onClick={() => void deleteSelectedInline()} className="h-8 px-3 text-xs">Delete</Button>}
            {canWrite && !isLockedEntity && <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(""); setEditDraft({}); setInlineAddMode(false); setInlineDraft({}); setInlineErrors({}) }} className="h-8 px-3 text-xs">Cancel</Button>}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setShowBulkActions((v) => !v)}
              className={`${showBulkActions ? "border-primary/40 bg-primary/10 text-primary" : ""}`}
              title={showBulkActions ? "Hide bulk actions" : "Show bulk actions"}
              aria-label={showBulkActions ? "Hide bulk actions" : "Show bulk actions"}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            {showBulkActions ? (
              <>
                <Button type="button" variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => void bulkSetStatusSelected("draft")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Draft</Button>
                <Button type="button" variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => void bulkSetStatusSelected("active")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Active</Button>
                <Button type="button" variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => void bulkSetStatusSelected("inactive")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Inactive</Button>
                <Button type="button" variant="outline" size="sm" disabled={selectedCount === 0} onClick={exportSelectedCsv} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Export CSV</Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-20 bg-muted px-2 py-2 text-left" style={gridColWidths.__select__ ? { width: gridColWidths.__select__, minWidth: gridColWidths.__select__ } : { width: 36, minWidth: 36 }}>
                  <div className="relative pr-3">
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
                    <span onMouseDown={(e) => startGridColResize("__select__", e)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                  </div>
                </th>
                {showFlagColumn && (
                  <th className="relative px-3 py-2 text-left" style={gridColWidths.flag ? { width: gridColWidths.flag, minWidth: gridColWidths.flag } : undefined}>
                    <div className="relative pr-4">
                      Flag
                      <span onMouseDown={(e) => startGridColResize("flag", e)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                    </div>
                  </th>
                )}
                {visibleColumns.map((c) => (
                  <th
                    key={c}
                    draggable
                    onDragStart={(e) => { setDragColumn(c); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c) }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); moveColumn(dragColumn, c) }}
                    className={`relative px-3 py-2 text-left ${selectedColumn === c ? "bg-primary/10 text-foreground" : ""}`}
                    style={gridColWidths[c] ? { width: gridColWidths[c], minWidth: gridColWidths[c] } : undefined}
                  >
                    <div className="relative flex items-center justify-between gap-2 pr-4">
                      <span className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => setSortBy((p) => (p?.field === c ? (p.dir === "asc" ? { field: c, dir: "desc" } : null) : { field: c, dir: "asc" }))} className="inline-flex items-center gap-1 hover:text-foreground">
                          {humanizeLabel(c)}
                          <span className={`text-[10px] ${sortBy?.field === c ? "text-primary" : "text-muted-foreground/50"}`}>{sortBy?.field === c ? (sortBy.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                        </button>
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
                      <span className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => setFilterMenuColumn((prev) => prev === c ? "" : c)} title={columnFilters[c]?.trim() ? `Filtered: ${columnFilters[c]}` : "Filter this column"} className={`rounded p-1 hover:bg-muted ${columnFilters[c]?.trim() ? "text-primary" : "text-muted-foreground"}`}>
                          <Filter size={13} fill={columnFilters[c]?.trim() ? "currentColor" : "none"} />
                        </button>
                        <button onClick={() => setMenuColumn((prev) => prev === c ? "" : c)} className="rounded px-1 text-xs hover:bg-muted">⋮</button>
                      </span>
                      {filterMenuColumn === c && (
                        <ColumnFilterPopover
                          column={c}
                          label={humanizeLabel(c)}
                          value={columnFilters[c] ?? ""}
                          onChange={(v) => setColumnFilters((prev) => ({ ...prev, [c]: v }))}
                          onClear={() => setColumnFilters((prev) => { const n = { ...prev }; delete n[c]; return n })}
                          onClose={() => setFilterMenuColumn("")}
                        />
                      )}
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
                      <span onMouseDown={(e) => startGridColResize(c, e)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                    </div>
                  </th>
                ))}
                {!hiddenColumns.includes("status") && (
                  <th className="relative px-3 py-2 text-left" style={gridColWidths.status ? { width: gridColWidths.status, minWidth: gridColWidths.status } : undefined}>
                    <div className="relative pr-4">
                      Status
                      <span onMouseDown={(e) => startGridColResize("status", e)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                    </div>
                  </th>
                )}
                {!hiddenColumns.includes("valid_from") && (
                  <th className="relative px-3 py-2 text-left" style={gridColWidths.valid_from ? { width: gridColWidths.valid_from, minWidth: gridColWidths.valid_from } : undefined}>
                    <div className="relative pr-4">
                      Valid From
                      <span onMouseDown={(e) => startGridColResize("valid_from", e)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                    </div>
                  </th>
                )}
                {!hiddenColumns.includes("valid_to") && (
                  <th className="relative px-3 py-2 text-left" style={gridColWidths.valid_to ? { width: gridColWidths.valid_to, minWidth: gridColWidths.valid_to } : undefined}>
                    <div className="relative pr-4">
                      Valid To
                      <span onMouseDown={(e) => startGridColResize("valid_to", e)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                    </div>
                  </th>
                )}
                <th className="sticky right-0 z-20 bg-muted px-3 py-2 text-left" style={gridColWidths.actions ? { width: gridColWidths.actions, minWidth: gridColWidths.actions } : { width: 112, minWidth: 112 }}>
                  <div className="relative pr-4">
                    Actions
                    <span onMouseDown={(e) => startGridColResize("actions", e)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {inlineAddMode && (
                <tr className="border-t border-border/60 bg-primary/5">
                  <td className={`${rowCellPaddingClass} sticky left-0 z-10 bg-card`} style={gridColWidths.__select__ ? { width: gridColWidths.__select__, minWidth: gridColWidths.__select__ } : { width: 36, minWidth: 36 }} />
                  {showFlagColumn && <td className={rowCellPaddingClass} style={gridColWidths.flag ? { width: gridColWidths.flag, minWidth: gridColWidths.flag } : undefined}><FlagBadge code={inlineDraft.alpha2} /></td>}
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
                  {!hiddenColumns.includes("status") && <td className={rowCellPaddingClass} style={gridColWidths.status ? { width: gridColWidths.status, minWidth: gridColWidths.status } : undefined} />}
                  {!hiddenColumns.includes("valid_from") && <td className={rowCellPaddingClass} style={gridColWidths.valid_from ? { width: gridColWidths.valid_from, minWidth: gridColWidths.valid_from } : undefined} />}
                  {!hiddenColumns.includes("valid_to") && <td className={rowCellPaddingClass} style={gridColWidths.valid_to ? { width: gridColWidths.valid_to, minWidth: gridColWidths.valid_to } : undefined} />}
                  <td className={`${rowCellPaddingClass} sticky right-0 z-10 bg-card`} style={gridColWidths.actions ? { width: gridColWidths.actions, minWidth: gridColWidths.actions } : { width: 112, minWidth: 112 }}>
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => void submitInlineAdd()} className="h-7 px-2.5 text-[11px]">Save</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setInlineAddMode(false); setInlineDraft({}); setInlineErrors({}) }} className="h-7 px-2.5 text-[11px]">Cancel</Button>
                    </div>
                  </td>
                </tr>
              )}
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2 + (showFlagColumn ? 1 : 0) + GRID_LIFECYCLE_COLUMNS.filter((c) => !hiddenColumns.includes(c)).length} className="px-3 py-8 text-center text-sm text-muted-foreground">Loading records...</td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2 + (showFlagColumn ? 1 : 0) + GRID_LIFECYCLE_COLUMNS.filter((c) => !hiddenColumns.includes(c)).length} className="px-3 py-8 text-center text-sm text-muted-foreground">No records found for current filters.</td>
                </tr>
              ) : null}
              {!isLoading && pagedRows.length > 0 && groupedRows.map((g, gi) => (
                <React.Fragment key={`${g.key}-${gi}`}>
                  {groupBy && (
                    <tr className="border-t border-border/60 bg-muted/30">
                      <td colSpan={visibleColumns.length + 2 + (showFlagColumn ? 1 : 0) + GRID_LIFECYCLE_COLUMNS.filter((c) => !hiddenColumns.includes(c)).length} className="px-3 py-1.5 text-xs font-medium">
                        {humanizeLabel(groupBy)}: {g.key} ({g.rows.length})
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
                    if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current)
                    rowClickTimerRef.current = setTimeout(() => {
                      rowClickTimerRef.current = null
                      setDetailRow(r)
                      setDetailTab("overview")
                    }, 220)
                  }}
                  onDoubleClick={() => {
                    if (rowClickTimerRef.current) { clearTimeout(rowClickTimerRef.current); rowClickTimerRef.current = null }
                    setDetailRow(null)
                    openRecordView(r)
                  }}
                  className={`cursor-pointer border-t border-border/60 ${rowDirty(r) ? "bg-amber-500/10" : ""} ${lastCreatedRowId === getRowId(r) ? "bg-blue-500/15 ring-1 ring-blue-400/40" : ""} ${selectedRowId === getRowId(r) ? (TREE_ENTITIES[entity] ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "bg-primary/10") : ""}`}
                >
                  <td className={`${rowCellPaddingClass} sticky left-0 z-10 bg-card`} style={gridColWidths.__select__ ? { width: gridColWidths.__select__, minWidth: gridColWidths.__select__ } : { width: 36, minWidth: 36 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRowIds.includes(getRowId(r))}
                      onChange={() => toggleRowSelection(getRowId(r))}
                    />
                  </td>
                  {showFlagColumn && <td className={rowCellPaddingClass} style={gridColWidths.flag ? { width: gridColWidths.flag, minWidth: gridColWidths.flag } : undefined}><FlagBadge code={r.alpha2} /></td>}
                  {visibleColumns.map((c, ci) => {
                    const isTreeFirstCol = ci === 0 && TREE_ENTITIES[entity]
                    const treeDepth = Number((r as Record<string, unknown>)._treeDepth ?? 0)
                    const treeHasChildren = Boolean((r as Record<string, unknown>)._treeHasChildren)
                    const treeId = String((r as Record<string, unknown>)._treeId ?? "")
                    const isExpanded = expandedTreeIds.has(treeId)
                    return (
                      <td
                        key={c}
                        className={`${rowCellPaddingClass} ${isDirtyCell(r, c) ? "bg-amber-500/20" : ""}`}
                        style={gridColWidths[c] ? { width: gridColWidths[c], minWidth: gridColWidths[c] } : undefined}
                      >
                        {isTreeFirstCol ? (
                          <span className="inline-flex items-center gap-1.5" style={{ paddingLeft: `${treeDepth * 18}px` }}>
                            <span className="inline-flex h-4 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing" title="Drag to reorder" onClick={(e) => e.stopPropagation()}>
                              <GripVertical className="h-3.5 w-3.5" />
                            </span>
                            {treeHasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void toggleTreeNode(entity, treeId)
                                }}
                                disabled={treeLoadingIds.has(treeId)}
                                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-transform hover:bg-muted hover:text-foreground disabled:opacity-50"
                                aria-label={isExpanded ? "Collapse" : "Expand"}
                              >
                                {treeLoadingIds.has(treeId) ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                )}
                              </button>
                            ) : (
                              <span className="inline-block h-4 w-4 shrink-0" />
                            )}
                            {editingId === String(r[idColumn] ?? "") ? renderEditCell(c) : <span className="truncate">{resolveCellDisplay(c, r[c])}</span>}
                          </span>
                        ) : (
                          editingId === String(r[idColumn] ?? "") ? renderEditCell(c) : resolveCellDisplay(c, r[c])
                        )}
                      </td>
                    )
                  })}
                  {!hiddenColumns.includes("status") && (
                    <td className={`${rowCellPaddingClass} ${isDirtyCell(r, "status") ? "bg-amber-500/20" : ""}`} style={gridColWidths.status ? { width: gridColWidths.status, minWidth: gridColWidths.status } : undefined}>
                      {editingId === String(r[idColumn] ?? "") ? (
                        <select value={editDraft.status ?? "draft"} onChange={(e) => setEditDraft((prev) => ({ ...prev, status: e.target.value }))} className="rounded border border-border bg-background px-1 py-0.5 text-xs">
                          <option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
                        </select>
                      ) : (r.status ? humanizeLabel(String(r.status)) : "-")}
                    </td>
                  )}
                  {!hiddenColumns.includes("valid_from") && (
                    <td className={`${rowCellPaddingClass} ${isDirtyCell(r, "valid_from") ? "bg-amber-500/20" : ""}`} style={gridColWidths.valid_from ? { width: gridColWidths.valid_from, minWidth: gridColWidths.valid_from } : undefined}>
                      {editingId === String(r[idColumn] ?? "") ? (
                        <input value={editDraft.valid_from ?? ""} onChange={(e) => setEditDraft((prev) => ({ ...prev, valid_from: e.target.value }))} className={`w-28 rounded border px-1 py-0.5 text-xs ${fieldErrors.valid_from ? "border-destructive" : "border-border"} bg-background`} title={fieldErrors.valid_from ?? ""} />
                      ) : formatCellValue(r.valid_from)}
                    </td>
                  )}
                  {!hiddenColumns.includes("valid_to") && (
                    <td className={`${rowCellPaddingClass} ${isDirtyCell(r, "valid_to") ? "bg-amber-500/20" : ""}`} style={gridColWidths.valid_to ? { width: gridColWidths.valid_to, minWidth: gridColWidths.valid_to } : undefined}>
                      {editingId === String(r[idColumn] ?? "") ? (
                        <input value={editDraft.valid_to ?? ""} onChange={(e) => setEditDraft((prev) => ({ ...prev, valid_to: e.target.value }))} className={`w-28 rounded border px-1 py-0.5 text-xs ${fieldErrors.valid_to ? "border-destructive" : "border-border"} bg-background`} title={fieldErrors.valid_to ?? ""} />
                      ) : formatCellValue(r.valid_to)}
                    </td>
                  )}
                  <td className={`${rowCellPaddingClass} sticky right-0 z-10 bg-card`} style={gridColWidths.actions ? { width: gridColWidths.actions, minWidth: gridColWidths.actions } : { width: 112, minWidth: 112 }} onClick={(e) => e.stopPropagation()}>
                    {editingId === String(r[idColumn] ?? "") ? (
                      <div className="flex gap-1">
                        <Button type="button" variant="default" size="sm" onClick={() => void saveEditRow(r)} className="h-7 px-2.5 text-[11px]">Save</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(""); setEditDraft({}) }} className="h-7 px-2.5 text-[11px]">Cancel</Button>
                      </div>
                    ) : (
                      <div className="relative inline-flex" ref={rowActionMenuId === String(r[idColumn] ?? "") ? rowActionMenuRef : null}>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setRowActionMenuId((v) => (v === String(r[idColumn] ?? "") ? "" : String(r[idColumn] ?? "")))}
                          className={rowActionMenuId === String(r[idColumn] ?? "") ? "border-primary/40 bg-primary/10 text-primary" : ""}
                          title="Row actions"
                          aria-label="Row actions"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                        {rowActionMenuId === String(r[idColumn] ?? "") && (
                          <div className="absolute right-0 top-7 z-20 min-w-[120px] rounded-md border border-border bg-popover p-1 shadow-lg">
                            <button
                              onClick={() => { setRowActionMenuId(""); void runAiAssist(r) }}
                              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                            >
                              {aiAssistLoading ? "AI..." : "AI Assist"}
                            </button>
                            {canWrite && !isLockedEntity && (
                              <button
                                onClick={() => { setRowActionMenuId(""); startEditRow(r) }}
                                className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && !isLockedEntity && (
                              <button
                                onClick={() => {
                                  setRowActionMenuId("")
                                  setDeleteConfirm({
                                    title: "Confirm Delete",
                                    message: "Delete this record permanently? This action cannot be undone.",
                                    confirmLabel: "Delete",
                                    onConfirm: async () => {
                                      await archiveRow(r)
                                    },
                                  })
                                }}
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
        <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {isTreeEntity ? (
            <span>{`${(treeRoots ?? []).length} root categories — expand to load children`}</span>
          ) : (
            <>
              <span>{`Page ${page} of ${totalPages} (${totalRows || sortedRows.length} rows)`}</span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </>
          )}
        </div>
        </>)}
      </div>

        {showRightPanel && <aside className="w-[260px] shrink-0 space-y-3 self-stretch overflow-y-auto">
          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setGridSettingsOpen((v) => !v)}
              aria-expanded={gridSettingsOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 text-sm font-semibold">Grid Settings</span>
              <span className={`text-muted-foreground transition-transform ${gridSettingsOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {gridSettingsOpen && (
            <div className="border-t border-border px-4 pb-4 pt-3">
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
            {baseColumns.slice(0, 6).map((c) => {
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
                  <span>{humanizeLabel(c)}</span>
                </label>
              )
            })}
          </div>
          <div className="mb-1 text-xs text-muted-foreground">Lifecycle Columns</div>
          <div className="mb-3 rounded border border-border p-2">
            {GRID_LIFECYCLE_COLUMNS.map((c) => {
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
                  <span>{humanizeLabel(c)}</span>
                </label>
              )
            })}
          </div>
          <button onClick={() => setHiddenColumns([])} className="w-full rounded border border-border px-2 py-1.5 text-xs">Show All Columns</button>
          <button onClick={resetGridLayout} className="mt-2 w-full rounded border border-border px-2 py-1.5 text-xs">Reset Grid Layout</button>
            </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setApprovalsSectionOpen((v) => !v)}
              aria-expanded={approvalsSectionOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 text-sm font-semibold">Approvals &amp; Audit</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{approvalTotal} total</span>
              <span className={`text-muted-foreground transition-transform ${approvalsSectionOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {approvalsSectionOpen && (
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
          <div className="rounded border border-border p-2">
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
            </div>
            )}
          </div>

          {(entity === "service-item" || entity === "price-list") && (
            <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setPricingSectionOpen((v) => !v)}
                aria-expanded={pricingSectionOpen}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="flex-1 text-sm font-semibold">Pricing Workbench</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {entity === "service-item" ? "Service Item" : "Price List"}
                </span>
                <span className={`text-muted-foreground transition-transform ${pricingSectionOpen ? "" : "-rotate-90"}`}>▾</span>
              </button>
              {pricingSectionOpen && (
                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                  <div className="rounded border border-border p-3">
                    <div className="grid gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Service Item Code</label>
                      <input
                        value={pricingWorkbench.serviceItemCode}
                        onChange={(e) => setPricingWorkbench((prev) => ({ ...prev, serviceItemCode: e.target.value }))}
                        placeholder="SVC-CSV-001"
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                      />
                      <label className="text-xs font-medium text-muted-foreground">Price List Code</label>
                      <input
                        value={pricingWorkbench.priceListCode}
                        onChange={(e) => setPricingWorkbench((prev) => ({ ...prev, priceListCode: e.target.value }))}
                        placeholder="PL-DEFAULT"
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                      />
                      <label className="text-xs font-medium text-muted-foreground">As Of</label>
                      <input
                        type="date"
                        value={pricingWorkbench.asOf}
                        onChange={(e) => setPricingWorkbench((prev) => ({ ...prev, asOf: e.target.value }))}
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button className="h-8 px-3 text-xs" onClick={() => void resolvePricingWorkbench()} disabled={pricingResolveLoading}>
                        {pricingResolveLoading ? "Resolving..." : "Resolve"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          setPricingResolveResult(null)
                          setPricingResolveError("")
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    {pricingResolveError && <div className="mt-2 text-xs text-destructive">{pricingResolveError}</div>}
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="mb-1 text-xs font-medium">Resolution Result</div>
                    {!pricingResolveResult ? (
                      <div className="text-[11px] text-muted-foreground">Resolve a service item against a price list to preview the live result.</div>
                    ) : (
                      <div className="space-y-2 text-[11px]">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded border border-border/60 p-2">
                            <div className="text-muted-foreground">Resolved</div>
                            <div className="font-medium">{String(pricingResolveResult.resolved ?? "-")}</div>
                          </div>
                          <div className="rounded border border-border/60 p-2">
                            <div className="text-muted-foreground">Source</div>
                            <div className="font-medium">{String(pricingResolveResult.source ?? "-")}</div>
                          </div>
                          <div className="rounded border border-border/60 p-2">
                            <div className="text-muted-foreground">Service Item</div>
                            <div className="font-medium">{String(pricingResolveResult.service_item_code ?? pricingResolveResult.serviceItemCode ?? "-")}</div>
                          </div>
                          <div className="rounded border border-border/60 p-2">
                            <div className="text-muted-foreground">Price List</div>
                            <div className="font-medium">{String(pricingResolveResult.price_list_code ?? pricingResolveResult.priceListCode ?? "-")}</div>
                          </div>
                        </div>
                        <div className="rounded border border-border/60 p-2">
                          <div className="text-muted-foreground">Detail</div>
                          <div className="font-medium">{String(pricingResolveResult.detail ?? "-")}</div>
                        </div>
                        <div className="rounded border border-border/60 p-2">
                          <div className="text-muted-foreground">Payload</div>
                          <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
                            {JSON.stringify(pricingResolveResult, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {ENTITY_INSIGHT_CONFIG[entity] && (
            <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-sky-500 bg-card shadow-sm">
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                    <span className="text-sm font-semibold">{ENTITY_INSIGHT_CONFIG[entity].title}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{ENTITY_INSIGHT_CONFIG[entity].subtitle}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    {entity === "service-bom"
                      ? "Bill of Materials"
                      : entity === "regulation" || entity === "regulation-version"
                        ? "Regulatory"
                      : entity === "jurisdiction"
                        ? "Jurisdiction"
                        : entity === "authority"
                          ? "Authority"
                      : entity === "standard"
                          ? "Standards"
                          : entity === "activity"
                            ? "Activity"
                            : entity === "product-category"
                                ? "HS Code"
                                : entity === "feature-of-product"
                                ? "Product Feature"
                                  : entity === "product-line"
                                  ? "Product Line"
                                  : humanizeLabel(entity)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{(sortedRows.length || totalRows || 0)} rows</span>
                </div>
              </div>
              <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {ENTITY_INSIGHT_CONFIG[entity].highlights.map((item) => (
                    <div key={item.field} className="rounded border border-border/70 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</div>
                      <div className="mt-1 break-words text-[12px] font-medium text-foreground">
                        {formatCellValue(sortedRows[0]?.[item.field])}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded border border-border/70 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium">Live Preview</span>
                    <span className="text-[10px] text-muted-foreground">{ENTITY_INSIGHT_CONFIG[entity].rowsLabel}</span>
                  </div>
                  {sortedRows.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">No live records found.</div>
                  ) : (
                    <div className="space-y-2">
                      {sortedRows.slice(0, 3).map((row) => {
                        const rowId = getRowId(row)
                        const previewMain =
                          entity === "service-bom"
                            ? `${formatCellValue(row.bom_code)} - ${formatCellValue(row.service_item_id)}`
                            : entity === "regulation"
                              ? `${formatCellValue(row.regulation_code)} - ${formatCellValue(row.title)}`
                              : entity === "regulation-source"
                                ? `${formatCellValue(row.source_name)} - ${formatCellValue(row.source_type)}`
                                : entity === "regulation-ingest-run"
                                  ? `${formatCellValue(row.run_status)} - ${formatCellValue(row.source_format || row.source_url)}`
                              : entity === "regulation-version"
                                ? `V${formatCellValue(row.version_no)} - ${formatCellValue(row.version_label || row.source_identifier || row.regulation_id)}`
                                : entity === "authority"
                                  ? `${formatCellValue(row.authority_name)}`
                                  : entity === "jurisdiction"
                                    ? `${formatCellValue(row.code)} - ${formatCellValue(row.name)}`
                                    : entity === "standard"
                                      ? `${formatCellValue(row.standard_code)} - ${formatCellValue(row.title)}`
                                      : entity === "activity"
                                        ? `${formatCellValue(row.activity_code)} - ${formatCellValue(row.activity_name)}`
                                        : entity === "product-category"
                                          ? `${formatCellValue(row.code)} - ${formatCellValue(row.name)}`
                                          : entity === "feature-of-product"
                                            ? `${formatCellValue(row.code)} - ${formatCellValue(row.name)}`
                                            : entity === "product-line"
                                              ? `${formatCellValue(row.code)} - ${formatCellValue(row.name)}`
                                              : `${formatCellValue(row.code ?? row.name ?? rowId)}`
                        const previewMeta =
                          entity === "service-bom"
                            ? `Description: ${formatCellValue(row.description)}`
                            : entity === "regulation"
                              ? `Authority: ${formatCellValue(row.issuing_authority)}`
                              : entity === "regulation-source"
                                ? `Last: ${formatCellValue(row.last_status)} | Refresh: ${formatCellValue(row.refresh_interval_hours)}h`
                                : entity === "regulation-ingest-run"
                                  ? `Started: ${formatCellValue(row.started_at)} | Chunks: ${formatCellValue(row.chunk_count)}`
                              : entity === "regulation-version"
                                ? `Published: ${formatCellValue(row.published_at)} | Effective: ${formatCellValue(row.effective_from)} - ${formatCellValue(row.effective_to)}`
                                : entity === "authority"
                                  ? `Jurisdiction: ${formatCellValue(row.jurisdiction_id)} | Website: ${formatCellValue(row.website_url)}`
                                  : entity === "jurisdiction"
                                    ? `Region: ${formatCellValue(row.region)} | Parent: ${formatCellValue(row.parent_jurisdiction_id)}`
                                    : entity === "standard"
                                ? `Version: ${formatCellValue(row.version_label)}`
                              : entity === "activity"
                                ? `Type: ${formatCellValue(row.activity_type)} | Duration: ${formatCellValue(row.default_duration_min)}`
                                  : entity === "product-category"
                                      ? `Description: ${formatCellValue(row.description)}`
                                      : entity === "feature-of-product"
                                        ? `Description: ${formatCellValue(row.description)}`
                                        : entity === "product-line"
                                        ? `HS Code: ${formatCellValue(row.product_category_id)}`
                                        : `Code: ${formatCellValue(row.code)}`
                        return (
                          <button
                            key={rowId}
                            type="button"
                            onClick={() => {
                              setSelectedRowId(rowId)
                              setDetailRow(row)
                              setDetailTab("overview")
                              openRecordView(row, entity)
                            }}
                            className="block w-full rounded border border-border/70 px-2 py-1.5 text-left hover:bg-muted/60"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 text-[12px] font-medium">{previewMain}</div>
                              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{formatCellValue(row.status)}</span>
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">{previewMeta}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-amber-500 bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setConfigSectionOpen((v) => !v)}
              aria-expanded={configSectionOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <span className="flex-1 text-sm font-semibold">Configuration</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Policy · Rules</span>
              <span className={`text-muted-foreground transition-transform ${configSectionOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {configSectionOpen && (
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
          <div className="rounded border border-border p-2">
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
            {baseColumns.slice(0, 6).map((c) => <option key={c} value={c}>{humanizeLabel(c)}</option>)}
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
                placeholder="code prefix (optional)"
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
            {baseColumns.slice(0, 4).map((field) => (
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
            </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setHealthSectionOpen((v) => !v)}
              aria-expanded={healthSectionOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 text-sm font-semibold">Data Health</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{serverHealth?.completeness ?? healthMetrics.completeness}%</span>
              <span className={`text-muted-foreground transition-transform ${healthSectionOpen ? "" : "-rotate-90"}`}>▾</span>
            </button>
            {healthSectionOpen && (
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
          <div className="rounded border border-border p-2">
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
              <h3 className="text-base font-semibold">Add {entityDisplayName(entity)}</h3>
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
              <h3 className="text-base font-semibold">Edit {entityDisplayName(entity)}</h3>
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
              {createFields.filter((field) => entity !== "exchange-rate" || !EXCHANGE_RATE_INLINE_FIELDS.includes(field)).map((field) => {
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

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[420px] rounded-lg border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">{deleteConfirm.title}</h3>
            <p className="mb-3 text-sm text-muted-foreground">{deleteConfirm.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="rounded border border-border px-2 py-1 text-xs">Cancel</button>
              <button
                onClick={async () => {
                  const confirm = deleteConfirm
                  if (!confirm) return
                  setDeleteConfirm(null)
                  await confirm.onConfirm()
                }}
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
              >
                {deleteConfirm.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// No MDM masters are currently hard-locked in the UI.
const LOCKED_MDM_ENTITIES = new Set<string>([])
