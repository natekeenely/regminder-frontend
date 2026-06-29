"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  Database,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

/* ───────── Types ───────── */

interface DifyI18n {
  en_US: string
  zh_Hans?: string
  [k: string]: string | undefined
}

interface DataSourcePlugin {
  plugin_id: string
  name: string
  org: string
  label: DifyI18n
  description: DifyI18n
  icon: string
  version: string
  download_count?: number
  install_count?: number
  category: string
  plugin_unique_identifier?: string
  latest_package_identifier?: string
  brief?: DifyI18n
  tags?: string[]
}

/* ───────── Curated fallback ───────── */

const CURATED_DATASOURCES: DataSourcePlugin[] = [
  // ── Online Drive ──
  { plugin_id: "google_drive", name: "google_drive", org: "langgenius", label: { en_US: "Google Drive" }, description: { en_US: "Index and search documents from Google Drive for RAG knowledge bases." }, icon: "", version: "0.1.13", install_count: 51035, category: "extension", tags: ["Online Drive"] },
  { plugin_id: "onedrive_datasource", name: "onedrive_datasource", org: "langgenius", label: { en_US: "OneDrive" }, description: { en_US: "Access Microsoft OneDrive files and folders with OAuth 2.0 and automatic token refresh." }, icon: "", version: "0.1.0", install_count: 7146, category: "extension", tags: ["Online Drive"] },
  { plugin_id: "sharepoint_datasource", name: "sharepoint_datasource", org: "langgenius", label: { en_US: "SharePoint" }, description: { en_US: "Retrieve files and documents from SharePoint sites and document libraries." }, icon: "", version: "0.2.8", install_count: 9651, category: "extension", tags: ["Online Drive"] },
  { plugin_id: "nextcloud", name: "nextcloud", org: "langgenius", label: { en_US: "NextCloud" }, description: { en_US: "Connect to NextCloud to manage files, folders and access shared content via WebDAV." }, icon: "", version: "0.1.0", install_count: 3200, category: "extension", tags: ["Online Drive"] },
  { plugin_id: "tencent_cos_storage", name: "tencent_cos_storage", org: "langgenius", label: { en_US: "Tencent COS" }, description: { en_US: "Cloud object storage integration for Tencent COS buckets." }, icon: "", version: "0.1.0", install_count: 2100, category: "extension", tags: ["Online Drive"] },
  // ── Online Document ──
  { plugin_id: "notion_datasource", name: "notion_datasource", org: "langgenius", label: { en_US: "Notion" }, description: { en_US: "Sync Notion pages and databases into your knowledge base seamlessly." }, icon: "", version: "0.1.0", install_count: 63104, category: "extension", tags: ["Online Document"] },
  { plugin_id: "github_datasource", name: "github_datasource", org: "langgenius", label: { en_US: "GitHub" }, description: { en_US: "Access repositories, issues, PRs, and wiki pages with Personal Access Token or OAuth." }, icon: "", version: "0.1.0", install_count: 16804, category: "extension", tags: ["Online Document"] },
  { plugin_id: "gitlab", name: "gitlab", org: "langgenius", label: { en_US: "GitLab" }, description: { en_US: "Access GitLab projects, issues, merge requests, and repository files." }, icon: "", version: "0.1.0", install_count: 83338, category: "extension", tags: ["Online Document"] },
  { plugin_id: "confluence", name: "confluence", org: "langgenius", label: { en_US: "Confluence" }, description: { en_US: "Sync Confluence spaces and pages for knowledge base ingestion." }, icon: "", version: "0.1.0", install_count: 8705, category: "extension", tags: ["Online Document"] },
  { plugin_id: "nocodb", name: "nocodb", org: "langgenius", label: { en_US: "NocoDB" }, description: { en_US: "Connect to NocoDB to manage database records and perform CRUD operations." }, icon: "", version: "0.1.0", install_count: 4500, category: "extension", tags: ["Online Document"] },
  // ── Web Crawler ──
  { plugin_id: "firecrawl_datasource", name: "firecrawl_datasource", org: "langgenius", label: { en_US: "Firecrawl" }, description: { en_US: "Crawl and scrape web content for knowledge base ingestion with anti-bot bypass." }, icon: "", version: "0.2.3", install_count: 64484, category: "extension", tags: ["Web Crawler"] },
  { plugin_id: "jina_reader", name: "jina_reader", org: "langgenius", label: { en_US: "Jina Reader" }, description: { en_US: "Extract clean text from any URL for RAG. Segment webpages, fetch and search sites." }, icon: "", version: "0.1.0", install_count: 44470, category: "extension", tags: ["Web Crawler"] },
  { plugin_id: "tavily", name: "tavily", org: "langgenius", label: { en_US: "Tavily" }, description: { en_US: "AI-native search engine with web content extraction for highly relevant results." }, icon: "", version: "0.1.0", install_count: 9201, category: "extension", tags: ["Web Crawler"] },
  { plugin_id: "brightdata_datasource", name: "brightdata_datasource", org: "langgenius", label: { en_US: "Bright Data" }, description: { en_US: "Extract data from any website, bypass anti-bot protection. Structured data from 50+ platforms." }, icon: "", version: "0.1.0", install_count: 5300, category: "extension", tags: ["Web Crawler"] },
  { plugin_id: "searchapi", name: "searchapi", org: "langgenius", label: { en_US: "SearchApi" }, description: { en_US: "Real-time SERP API for Google Search, Google Jobs, YouTube, Google News and more." }, icon: "", version: "0.1.0", install_count: 6800, category: "extension", tags: ["Web Crawler"] },
  // ── Document Processing ──
  { plugin_id: "unstructured", name: "unstructured", org: "langgenius", label: { en_US: "Unstructured" }, description: { en_US: "Parse and extract content from PDFs, Word docs, images and other unstructured formats." }, icon: "", version: "0.1.0", install_count: 7200, category: "extension", tags: ["Document Processing"] },
  { plugin_id: "mineru", name: "mineru", org: "langgenius", label: { en_US: "MinerU" }, description: { en_US: "Convert files into machine-readable formats (markdown, JSON) for easy extraction." }, icon: "", version: "0.1.0", install_count: 4100, category: "extension", tags: ["Document Processing"] },
]

/* ───────── Helpers ───────── */

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/proxy${path}`, init)

function i18n(field?: DifyI18n): string {
  if (!field) return ""
  return field.en_US || field.zh_Hans || Object.values(field).find((v) => typeof v === "string" && v) || ""
}

function formatCount(n: number | undefined): string {
  if (!n) return "0"
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function pluginName(plugin: DataSourcePlugin): { org: string; name: string } {
  const org = plugin.org || "langgenius"
  let name = ""
  if (plugin.plugin_id && plugin.plugin_id.includes("/")) {
    name = plugin.plugin_id.split("/").pop()!
  }
  if (!name) name = plugin.name || plugin.plugin_id || ""
  return { org, name }
}

function enrichIcons(plugins: DataSourcePlugin[]): DataSourcePlugin[] {
  return plugins.map((p) => {
    if (!p.icon || p.icon === "") {
      const { org, name } = pluginName(p)
      p.icon = `https://marketplace.dify.ai/api/v1/plugins/${encodeURIComponent(org)}/${encodeURIComponent(name)}/icon`
    }
    return p
  })
}

async function resolvePluginIdentifier(org: string, name: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://marketplace.dify.ai/api/v1/plugins/${encodeURIComponent(org)}/${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(15000) },
    )
    if (!resp.ok) return null
    const data = await resp.json()
    const plugin = data?.data?.plugin ?? data?.data ?? data?.plugin
    return plugin?.latest_package_identifier ?? plugin?.version?.unique_identifier ?? plugin?.unique_identifier ?? null
  } catch {
    return null
  }
}

async function installPlugin(identifier: string): Promise<{ success: boolean; error?: string }> {
  const resp = await api("/api/v1/dify/plugins/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plugin_unique_identifiers: [identifier] }),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => "")
    return { success: false, error: text }
  }
  const data = await resp.json()
  return { success: true, ...data }
}

async function uninstallPlugin(installationId: string): Promise<boolean> {
  const resp = await api("/api/v1/dify/plugins/uninstall", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plugin_installation_id: installationId }),
  })
  if (!resp.ok) return false
  const data = await resp.json()
  return data.success ?? false
}

/* ───────── Endpoint / Config API helpers ───────── */

interface EndpointInfo {
  id: string
  plugin_id: string
  name?: string
  settings?: Record<string, string>
  enabled?: boolean
  created_at?: string
}

interface CredentialField {
  variable: string
  label: DifyI18n | string
  type: string // "text-input" | "secret-input" | "select"
  required?: boolean
  default?: string
  placeholder?: DifyI18n | string
  options?: Array<{ value: string; label: DifyI18n | string }>
}

async function fetchEndpoints(): Promise<EndpointInfo[]> {
  try {
    const resp = await api("/api/v1/dify/plugins/datasource/endpoints")
    if (!resp.ok) return []
    const data = await resp.json()
    return data.endpoints ?? []
  } catch {
    return []
  }
}

async function fetchPluginInfo(pluginId: string): Promise<{ fields: CredentialField[] }> {
  try {
    const resp = await api(`/api/v1/dify/plugins/datasource/${encodeURIComponent(pluginId)}/info`)
    if (!resp.ok) return { fields: [] }
    const data = await resp.json()
    // Dify returns credential schemas in various shapes; normalize
    const schemas =
      data.credentials_schema ??
      data.credential_form_schemas ??
      data.provider_credential_schema?.credential_form_schemas ??
      data.endpoints_schema ??
      data.settings_schema ??
      []
    return { fields: schemas }
  } catch {
    return { fields: [] }
  }
}

async function setupEndpoint(pluginId: string, settings: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const resp = await api("/api/v1/dify/plugins/datasource/endpoints/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plugin_id: pluginId, settings }),
  })
  if (resp.ok) return { ok: true }
  const text = await resp.text()
  let msg = `HTTP ${resp.status}`
  try { msg = JSON.parse(text)?.detail ?? JSON.parse(text)?.message ?? msg } catch { /* ok */ }
  return { ok: false, error: msg }
}

async function deleteEndpoint(endpointId: string): Promise<boolean> {
  const resp = await api(`/api/v1/dify/plugins/datasource/endpoints/${encodeURIComponent(endpointId)}`, {
    method: "DELETE",
  })
  return resp.ok
}

/* ───────── Known credential schemas (fallback when API returns none) ───────── */

const KNOWN_SCHEMAS: Record<string, CredentialField[]> = {
  // Web Crawlers
  firecrawl: [
    { variable: "api_key", label: "API Key", type: "secret-input", required: true, placeholder: "Enter your Firecrawl API key" },
    { variable: "base_url", label: "Base URL", type: "text-input", required: false, placeholder: "https://api.firecrawl.dev", default: "https://api.firecrawl.dev" },
  ],
  firecrawl_datasource: [
    { variable: "api_key", label: "API Key", type: "secret-input", required: true, placeholder: "Enter your Firecrawl API key" },
    { variable: "base_url", label: "Base URL", type: "text-input", required: false, placeholder: "https://api.firecrawl.dev", default: "https://api.firecrawl.dev" },
  ],
  jina_reader: [
    { variable: "api_key", label: "API Key", type: "secret-input", required: true, placeholder: "Enter your Jina API key" },
  ],
  tavily: [
    { variable: "api_key", label: "API Key", type: "secret-input", required: true, placeholder: "Enter your Tavily API key" },
  ],
  brightdata_datasource: [
    { variable: "api_key", label: "API Key", type: "secret-input", required: true, placeholder: "Enter your Bright Data API key" },
  ],
  searchapi: [
    { variable: "api_key", label: "API Key", type: "secret-input", required: true, placeholder: "Enter your SearchApi API key" },
  ],
  // Online Documents
  notion: [
    { variable: "internal_secret", label: "Internal Integration Secret", type: "secret-input", required: true, placeholder: "Enter your Notion integration secret" },
  ],
  notion_datasource: [
    { variable: "internal_secret", label: "Internal Integration Secret", type: "secret-input", required: true, placeholder: "Enter your Notion integration secret" },
  ],
  github: [
    { variable: "access_token", label: "Personal Access Token", type: "secret-input", required: true, placeholder: "ghp_xxxxx" },
  ],
  github_datasource: [
    { variable: "access_token", label: "Personal Access Token", type: "secret-input", required: true, placeholder: "ghp_xxxxx" },
  ],
  gitlab: [
    { variable: "access_token", label: "Personal Access Token", type: "secret-input", required: true, placeholder: "glpat-xxxxx" },
    { variable: "base_url", label: "GitLab URL", type: "text-input", required: false, placeholder: "https://gitlab.com", default: "https://gitlab.com" },
  ],
  confluence: [
    { variable: "email", label: "Email", type: "text-input", required: true, placeholder: "you@example.com" },
    { variable: "api_token", label: "API Token", type: "secret-input", required: true, placeholder: "Enter Confluence API token" },
    { variable: "base_url", label: "Confluence URL", type: "text-input", required: true, placeholder: "https://your-domain.atlassian.net" },
  ],
  nocodb: [
    { variable: "api_token", label: "API Token", type: "secret-input", required: true, placeholder: "Enter your NocoDB API token" },
    { variable: "base_url", label: "NocoDB URL", type: "text-input", required: true, placeholder: "https://app.nocodb.com" },
  ],
  // Online Drive
  google_drive: [
    { variable: "client_id", label: "OAuth Client ID", type: "text-input", required: true, placeholder: "Enter OAuth client ID" },
    { variable: "client_secret", label: "OAuth Client Secret", type: "secret-input", required: true, placeholder: "Enter OAuth client secret" },
  ],
  onedrive: [
    { variable: "client_id", label: "Application (Client) ID", type: "text-input", required: true, placeholder: "Enter Azure App client ID" },
    { variable: "client_secret", label: "Client Secret", type: "secret-input", required: true, placeholder: "Enter client secret value" },
    { variable: "tenant_id", label: "Tenant ID", type: "text-input", required: false, placeholder: "common", default: "common" },
  ],
  onedrive_datasource: [
    { variable: "client_id", label: "Application (Client) ID", type: "text-input", required: true, placeholder: "Enter Azure App client ID" },
    { variable: "client_secret", label: "Client Secret", type: "secret-input", required: true, placeholder: "Enter client secret value" },
    { variable: "tenant_id", label: "Tenant ID", type: "text-input", required: false, placeholder: "common", default: "common" },
  ],
  sharepoint: [
    { variable: "client_id", label: "Application (Client) ID", type: "text-input", required: true, placeholder: "Enter Azure App client ID" },
    { variable: "client_secret", label: "Client Secret", type: "secret-input", required: true, placeholder: "Enter client secret value" },
    { variable: "tenant_id", label: "Tenant ID", type: "text-input", required: true, placeholder: "Enter your Azure tenant ID" },
  ],
  sharepoint_datasource: [
    { variable: "client_id", label: "Application (Client) ID", type: "text-input", required: true, placeholder: "Enter Azure App client ID" },
    { variable: "client_secret", label: "Client Secret", type: "secret-input", required: true, placeholder: "Enter client secret value" },
    { variable: "tenant_id", label: "Tenant ID", type: "text-input", required: true, placeholder: "Enter your Azure tenant ID" },
  ],
  nextcloud: [
    { variable: "base_url", label: "NextCloud URL", type: "text-input", required: true, placeholder: "https://your-nextcloud.example.com" },
    { variable: "username", label: "Username", type: "text-input", required: true, placeholder: "Enter your NextCloud username" },
    { variable: "password", label: "Password", type: "secret-input", required: true, placeholder: "Enter your NextCloud password or app password" },
  ],
  tencent_cos_storage: [
    { variable: "secret_id", label: "Secret ID", type: "secret-input", required: true, placeholder: "Enter Tencent Cloud Secret ID" },
    { variable: "secret_key", label: "Secret Key", type: "secret-input", required: true, placeholder: "Enter Tencent Cloud Secret Key" },
    { variable: "region", label: "Region", type: "text-input", required: true, placeholder: "ap-guangzhou" },
    { variable: "bucket", label: "Bucket Name", type: "text-input", required: true, placeholder: "bucket-appid" },
  ],
  // Document Processing
  unstructured: [
    { variable: "api_key", label: "API Key", type: "secret-input", required: true, placeholder: "Enter your Unstructured API key" },
    { variable: "api_url", label: "API URL", type: "text-input", required: false, placeholder: "https://api.unstructured.io", default: "https://api.unstructured.io" },
  ],
  mineru: [
    { variable: "api_key", label: "API Key", type: "secret-input", required: true, placeholder: "Enter your MinerU API key" },
    { variable: "base_url", label: "Base URL", type: "text-input", required: false, placeholder: "https://api.mineru.net" },
  ],
}

/* ───────── Provider-style icon (matches AI Settings) ───────── */

function PluginIcon({ src, label, name }: { src: string; label: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    )
  }
  // Fallback: first letter
  const letter = (label || name || "?")[0].toUpperCase()
  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-teal-500",
    "bg-pink-500", "bg-indigo-500", "bg-amber-500", "bg-emerald-500",
  ]
  const idx = (label || name || "").charCodeAt(0) % colors.length
  return (
    <div className={cn("flex h-full w-full items-center justify-center text-white font-bold text-sm", colors[idx])}>
      {letter}
    </div>
  )
}

/* ───────── DataSourceCard (matching AI Settings ProviderCard / MarketplaceCard style) ───────── */

function DataSourceCard({
  plugin,
  isInstalled,
  isInstalling,
  isConfigured,
  onInstall,
  onUninstall,
  onConfigure,
}: {
  plugin: DataSourcePlugin
  isInstalled: boolean
  isInstalling: boolean
  isConfigured: boolean
  onInstall: () => void
  onUninstall: () => void
  onConfigure: () => void
}) {
  const label = i18n(plugin.label) || plugin.name
  const desc = i18n(plugin.description) || i18n(plugin.brief) || ""
  const count = plugin.install_count ?? plugin.download_count ?? 0

  return (
    <div className={cn(
      "group relative flex gap-3 rounded-xl border p-4 transition-all hover:shadow-sm",
      isInstalled
        ? "border-green-500/30 bg-card"
        : "border-border bg-card hover:border-primary/30",
    )}>
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white dark:bg-zinc-900 shadow-xs">
        <PluginIcon src={plugin.icon} label={label} name={plugin.name} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
          {isInstalled && isConfigured && (
            <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/10 px-1.5 py-0">
              Active
            </Badge>
          )}
          {isInstalled && !isConfigured && (
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 hover:bg-amber-500/10 px-1.5 py-0">
              Not configured
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">{plugin.org || "langgenius"}</span>
          {count > 0 && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Download className="h-2.5 w-2.5" />
                {formatCount(count)}
              </span>
            </>
          )}
        </div>
        {desc && (
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{desc}</p>
        )}
        {/* Tags */}
        {(plugin.tags || []).length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {(plugin.tags || []).map((t) => (
              <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 font-normal border-border/60 text-muted-foreground">
                {t.toUpperCase()}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isInstalled ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs shadow-sm bg-background"
              onClick={onConfigure}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              {isConfigured ? "Settings" : "Setup"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onUninstall}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={isInstalling}
            onClick={(e) => { e.stopPropagation(); onInstall() }}
          >
            {isInstalling ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Download className="mr-1 h-3 w-3" />
            )}
            {isInstalling ? "Installing..." : "Install"}
          </Button>
        )}
      </div>
    </div>
  )
}

/* ───────── Configuration Dialog ───────── */

function ConfigDialog({
  plugin,
  existingEndpoint,
  onClose,
  onSaved,
}: {
  plugin: DataSourcePlugin
  existingEndpoint?: EndpointInfo | null
  onClose: () => void
  onSaved: () => void
}) {
  const label = i18n(plugin.label) || plugin.name
  const [fields, setFields] = useState<CredentialField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingSchema(true)
      const pluginId = plugin.plugin_id || plugin.name
      const info = await fetchPluginInfo(pluginId)
      if (cancelled) return

      let schema = info.fields
      if (!schema || schema.length === 0) {
        // Try known schemas
        const { name } = pluginName(plugin)
        schema = KNOWN_SCHEMAS[name] ?? KNOWN_SCHEMAS[plugin.name] ?? []
      }
      setFields(schema)

      // Pre-fill from existing endpoint or defaults
      const initial: Record<string, string> = {}
      for (const f of schema) {
        const existing = existingEndpoint?.settings?.[f.variable]
        if (existing) {
          initial[f.variable] = existing
        } else if (f.default) {
          initial[f.variable] = f.default
        }
      }
      setValues(initial)
      setLoadingSchema(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin.plugin_id, plugin.name])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const pluginId = plugin.plugin_id || plugin.name
    const result = await setupEndpoint(pluginId, values)
    if (result.ok) {
      onSaved()
      onClose()
    } else {
      setError(result.error ?? "Failed to save configuration")
    }
    setSaving(false)
  }

  function fieldLabel(f: CredentialField): string {
    if (typeof f.label === "string") return f.label
    return i18n(f.label as DifyI18n) || f.variable
  }

  function fieldPlaceholder(f: CredentialField): string {
    if (!f.placeholder) return ""
    if (typeof f.placeholder === "string") return f.placeholder
    return i18n(f.placeholder as DifyI18n)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-white dark:bg-zinc-900">
              <PluginIcon src={plugin.icon} label={label} name={plugin.name} />
            </div>
            {label} — Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loadingSchema && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingSchema && fields.length === 0 && (
            <div className="text-sm text-muted-foreground">
              This data source has no configuration schema available. It may work with default settings, or you may need to configure it directly in Dify.
            </div>
          )}

          {!loadingSchema && fields.map((field) => {
            const fl = fieldLabel(field)
            const ph = fieldPlaceholder(field)
            const isSecret = field.type === "secret-input"
            const isSelect = field.type === "select"

            return (
              <div key={field.variable}>
                <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
                  {fl}
                  {field.required && <span className="text-destructive">*</span>}
                </label>
                {isSelect && field.options ? (
                  <select
                    value={values[field.variable] ?? field.default ?? ""}
                    onChange={(e) => setValues({ ...values, [field.variable]: e.target.value })}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">{ph || "Select..."}</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {typeof opt.label === "string" ? opt.label : i18n(opt.label as DifyI18n)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={isSecret && !showSecrets ? "password" : "text"}
                    value={values[field.variable] ?? ""}
                    onChange={(e) => setValues({ ...values, [field.variable]: e.target.value })}
                    placeholder={ph}
                  />
                )}
                {isSecret && (
                  <button
                    type="button"
                    className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowSecrets(!showSecrets)}
                  >
                    {showSecrets ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showSecrets ? "Hide" : "Show"}
                  </button>
                )}
              </div>
            )
          })}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || (fields.length === 0 && !loadingSchema)}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {saving ? "Saving..." : existingEndpoint ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───────── Main component ───────── */

export function AiDataSourceContent() {
  const [plugins, setPlugins] = useState<DataSourcePlugin[]>([])
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null)
  const [configPlugin, setConfigPlugin] = useState<DataSourcePlugin | null>(null)
  const [endpoints, setEndpoints] = useState<EndpointInfo[]>([])
  const [configuredPluginIds, setConfiguredPluginIds] = useState<Set<string>>(new Set())

  /* ── Load data source plugins ── */
  const loadPlugins = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api("/api/v1/dify/plugins/datasource")
      if (resp.ok) {
        const data = await resp.json()
        const list: DataSourcePlugin[] = data.plugins ?? data.data ?? []
        setPlugins(enrichIcons(list.length > 0 ? list : CURATED_DATASOURCES))
      } else {
        try {
          const mResp = await fetch(
            "https://marketplace.dify.ai/api/v1/plugins?category=extension&page=1&page_size=50&sort_by=-install_count",
            { signal: AbortSignal.timeout(15000) },
          )
          if (mResp.ok) {
            const mData = await mResp.json()
            const mPlugins: DataSourcePlugin[] = mData?.data?.plugins ?? mData?.plugins ?? []
            setPlugins(enrichIcons(mPlugins.length > 0 ? mPlugins : CURATED_DATASOURCES))
          } else {
            setPlugins(enrichIcons(CURATED_DATASOURCES))
          }
        } catch {
          setPlugins(enrichIcons(CURATED_DATASOURCES))
        }
      }
    } catch {
      setPlugins(enrichIcons(CURATED_DATASOURCES))
    }
    setLoading(false)
  }, [])

  /* ── Load installed plugins ── */
  const loadInstalled = useCallback(async () => {
    try {
      const resp = await api("/api/v1/dify/plugins/installed")
      if (resp.ok) {
        const data = await resp.json()
        const list: Array<{ plugin_id: string; name: string; category?: string }> = data.plugins ?? []
        const ids = new Set<string>()
        for (const p of list) {
          const id = p.plugin_id || p.name || ""
          ids.add(id)
          if (id.includes("/")) ids.add(id.split("/").pop()!)
        }
        setInstalledIds(ids)
      }
    } catch { /* ignore */ }
  }, [])

  /* ── Load configured endpoints ── */
  const loadEndpoints = useCallback(async () => {
    try {
      const list = await fetchEndpoints()
      setEndpoints(list)
      const ids = new Set<string>()
      for (const ep of list) {
        ids.add(ep.plugin_id)
        if (ep.plugin_id.includes("/")) ids.add(ep.plugin_id.split("/").pop()!)
      }
      setConfiguredPluginIds(ids)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadPlugins()
    loadInstalled()
    loadEndpoints()
  }, [loadPlugins, loadInstalled, loadEndpoints])

  /* ── Install handler ── */
  async function handleInstall(plugin: DataSourcePlugin) {
    const { org, name } = pluginName(plugin)
    if (!name) return
    setInstallingPlugin(plugin.plugin_id || plugin.name)

    let identifier = ""
    const candidate = plugin.plugin_unique_identifier || plugin.latest_package_identifier || ""
    if (candidate.includes("@")) {
      identifier = candidate
    }

    if (!identifier) {
      identifier = (await resolvePluginIdentifier(org, name)) ?? ""
    }
    if (!identifier) {
      setInstallingPlugin(null)
      return
    }

    await installPlugin(identifier)
    await loadPlugins()
    await loadInstalled()
    setInstallingPlugin(null)
  }

  /* ── Uninstall handler ── */
  async function handleUninstall(pluginName: string) {
    try {
      const segments = pluginName.split("/")
      const possibleIds: string[] = [pluginName]
      if (segments.length >= 3) {
        possibleIds.push(`${segments[0]}/${segments[1]}`)
        possibleIds.push(segments[1])
      } else if (segments.length === 2) {
        possibleIds.push(segments[1])
      }
      const bare = segments[segments.length - 1]
      possibleIds.push(bare)
      possibleIds.push(`langgenius/${bare}`)

      const resp = await api("/api/v1/dify/plugins/installed")
      if (!resp.ok) return
      const data = await resp.json()
      const installedList: Array<{ plugin_id: string; plugin_unique_identifier: string; installation_id?: string }> =
        data.plugins ?? []

      for (const installed of installedList) {
        const pid = installed.plugin_id || ""
        const uid = installed.plugin_unique_identifier || ""
        const match = possibleIds.some(
          (id) => pid === id || pid.endsWith(`/${id}`) || uid.includes(id),
        )
        if (match) {
          const uninstallId = installed.installation_id || installed.plugin_unique_identifier || installed.plugin_id
          await uninstallPlugin(uninstallId)
          break
        }
      }
    } catch { /* ignore */ }

    await loadPlugins()
    await loadInstalled()
  }

  /* ── Check if a plugin is installed ── */
  function isPluginInstalled(plugin: DataSourcePlugin): boolean {
    const { name } = pluginName(plugin)
    return installedIds.has(plugin.plugin_id) ||
      installedIds.has(name) ||
      installedIds.has(`langgenius/${name}`) ||
      Array.from(installedIds).some((id) => id.endsWith(`/${name}`))
  }

  /* ── Check if plugin is configured (has endpoint) ── */
  function isPluginConfigured(plugin: DataSourcePlugin): boolean {
    const { name } = pluginName(plugin)
    return configuredPluginIds.has(plugin.plugin_id) ||
      configuredPluginIds.has(name) ||
      configuredPluginIds.has(`langgenius/${name}`) ||
      Array.from(configuredPluginIds).some((id) => id.endsWith(`/${name}`))
  }

  function findEndpoint(plugin: DataSourcePlugin): EndpointInfo | null {
    const { name } = pluginName(plugin)
    return endpoints.find((ep) =>
      ep.plugin_id === plugin.plugin_id ||
      ep.plugin_id === name ||
      ep.plugin_id === `langgenius/${name}` ||
      ep.plugin_id.endsWith(`/${name}`)
    ) ?? null
  }

  /* ── Filtered list ── */
  const filtered = plugins.filter((p) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      i18n(p.label).toLowerCase().includes(s) ||
      p.name.toLowerCase().includes(s) ||
      i18n(p.description).toLowerCase().includes(s) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(s))
    )
  })

  const installed = filtered.filter(isPluginInstalled)
  const available = filtered.filter((p) => !isPluginInstalled(p))

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header — same layout as AI Settings */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Data Source</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search data sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-52 rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => { void loadPlugins(); void loadInstalled() }} className="h-9">
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Installed section */}
        {!loading && installed.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Database className="h-4 w-4" />
              Configured data sources
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {installed.map((p) => (
                <DataSourceCard
                  key={p.plugin_id || p.name}
                  plugin={p}
                  isInstalled={true}
                  isInstalling={false}
                  isConfigured={isPluginConfigured(p)}
                  onInstall={() => {}}
                  onUninstall={() => handleUninstall(p.plugin_id || p.name)}
                  onConfigure={() => setConfigPlugin(p)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Available section */}
        {!loading && available.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Install data source providers
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {available.map((p) => (
                <DataSourceCard
                  key={p.plugin_id || p.name}
                  plugin={p}
                  isInstalled={false}
                  isInstalling={installingPlugin === (p.plugin_id || p.name)}
                  isConfigured={false}
                  onInstall={() => handleInstall(p)}
                  onUninstall={() => {}}
                  onConfigure={() => {}}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? `No data sources matching "${search}"` : "No data source providers available"}
          </div>
        )}
      </div>

      {/* Configuration dialog */}
      {configPlugin && (
        <ConfigDialog
          plugin={configPlugin}
          existingEndpoint={findEndpoint(configPlugin)}
          onClose={() => setConfigPlugin(null)}
          onSaved={() => {
            void loadEndpoints()
            void loadInstalled()
          }}
        />
      )}
    </div>
  )
}
