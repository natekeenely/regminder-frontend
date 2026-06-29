"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  Download,
  Loader2,
  Package,
  Puzzle,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

/* ───────── Types ───────── */

interface DifyI18n {
  en_US: string
  zh_Hans?: string
  [k: string]: string | undefined
}

interface InstalledPlugin {
  plugin_id: string
  plugin_unique_identifier: string
  installation_id?: string
  name: string
  label?: DifyI18n
  description?: DifyI18n | string
  icon?: string
  version?: string
  category?: string
  tenant_id?: string
  source?: string
  meta?: Record<string, unknown>
  endpoints_active?: number
  declaration?: {
    version?: string
    description?: DifyI18n
    icon?: string
    label?: DifyI18n
    category?: string
  }
}

interface MarketplacePlugin {
  plugin_id: string
  name: string
  org: string
  label: DifyI18n
  description: DifyI18n
  brief?: DifyI18n
  icon: string
  version: string
  category: string
  download_count?: number
  install_count?: number
  plugin_unique_identifier?: string
  latest_package_identifier?: string
}

type ViewTab = "installed" | "marketplace"
type CategoryFilter = "all" | "model" | "tool" | "extension" | "agent"

/* ───────── API helpers ───────── */

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/proxy${path}`, { credentials: "include", ...init })

async function fetchInstalledPlugins(): Promise<InstalledPlugin[]> {
  const resp = await api("/api/v1/dify/plugins/installed")
  if (!resp.ok) return []
  const data = await resp.json()
  return data.plugins ?? data.data ?? []
}

async function fetchMarketplacePlugins(opts?: { category?: string; search?: string; page?: number }): Promise<{ plugins: MarketplacePlugin[]; total: number }> {
  const params = new URLSearchParams()
  if (opts?.category && opts.category !== "all") params.set("category", opts.category)
  if (opts?.search) params.set("search", opts.search)
  if (opts?.page) params.set("page", String(opts.page))
  params.set("page_size", "50")
  const resp = await api(`/api/v1/dify/plugins/marketplace?${params}`)
  if (!resp.ok) return { plugins: [], total: 0 }
  return resp.json()
}

async function installPlugin(org: string, name: string): Promise<{ success: boolean; error?: string }> {
  const resp = await api("/api/v1/dify/plugins/install-sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plugins: [{ org, name }] }),
  })
  if (resp.ok) return { success: true }
  const text = await resp.text()
  let msg = `HTTP ${resp.status}`
  try { msg = JSON.parse(text)?.error ?? msg } catch { /* ok */ }
  return { success: false, error: msg }
}

async function uninstallPlugin(installationId: string): Promise<boolean> {
  const resp = await api("/api/v1/dify/plugins/uninstall", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plugin_installation_id: installationId }),
  })
  return resp.ok
}

/* ───────── Helpers ───────── */

function i18n(v?: DifyI18n | string | null): string {
  if (!v) return ""
  if (typeof v === "string") return v
  return v.en_US ?? Object.values(v).find(Boolean) ?? ""
}

function pluginIconUrl(p: { org?: string; name?: string; icon?: string }): string {
  if (p.icon?.startsWith("http")) return p.icon
  if (p.org && p.name) return `https://marketplace.dify.ai/api/v1/plugins/${encodeURIComponent(p.org)}/${encodeURIComponent(p.name)}/icon`
  return ""
}

function installedPluginIcon(p: InstalledPlugin): string {
  const icon = p.declaration?.icon ?? p.icon
  if (icon?.startsWith("http")) return icon
  // Derive org/name from plugin_id
  const parts = p.plugin_id?.split("/") ?? p.name?.split("/") ?? []
  if (parts.length >= 2) {
    return `https://marketplace.dify.ai/api/v1/plugins/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/icon`
  }
  return ""
}

function installedPluginLabel(p: InstalledPlugin): string {
  return i18n(p.declaration?.label ?? p.label) || p.name || p.plugin_id
}

function installedPluginDescription(p: InstalledPlugin): string {
  return i18n(p.declaration?.description ?? p.description as DifyI18n) || ""
}

function installedPluginCategory(p: InstalledPlugin): string {
  return p.declaration?.category ?? p.category ?? "unknown"
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  model: "Models",
  tool: "Tools",
  extension: "Extensions",
  agent: "Agent Strategies",
}

const CATEGORY_COLORS: Record<string, string> = {
  model: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  tool: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  extension: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  agent: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
}

/* ───────── Component ───────── */

export function AiPluginsContent() {
  const [tab, setTab] = useState<ViewTab>("installed")
  const [installed, setInstalled] = useState<InstalledPlugin[]>([])
  const [marketplace, setMarketplace] = useState<MarketplacePlugin[]>([])
  const [marketplaceTotal, setMarketplaceTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<CategoryFilter>("all")
  const [installing, setInstalling] = useState<string | null>(null)
  const [uninstalling, setUninstalling] = useState<string | null>(null)
  const [confirmUninstall, setConfirmUninstall] = useState<InstalledPlugin | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Track installed plugin_ids for quick lookup
  const installedIds = new Set(installed.map(p => {
    const parts = p.plugin_id?.split("/") ?? []
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : p.plugin_id
  }))

  const loadInstalled = useCallback(async () => {
    const plugins = await fetchInstalledPlugins()
    setInstalled(plugins)
  }, [])

  const loadMarketplace = useCallback(async () => {
    const result = await fetchMarketplacePlugins({ category: category === "all" ? undefined : category, search: search || undefined })
    setMarketplace(result.plugins)
    setMarketplaceTotal(result.total)
  }, [category, search])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadInstalled(), loadMarketplace()]).finally(() => setLoading(false))
  }, [loadInstalled, loadMarketplace])

  async function handleRefresh() {
    setLoading(true)
    await Promise.all([loadInstalled(), loadMarketplace()])
    setLoading(false)
  }

  async function handleInstall(p: MarketplacePlugin) {
    const key = `${p.org}/${p.name}`
    setInstalling(key)
    setError(null)
    const result = await installPlugin(p.org, p.name)
    if (!result.success) setError(result.error ?? "Install failed")
    await loadInstalled()
    setInstalling(null)
  }

  async function handleUninstall() {
    if (!confirmUninstall) return
    const id = confirmUninstall.installation_id ?? confirmUninstall.plugin_unique_identifier ?? confirmUninstall.plugin_id
    setUninstalling(id)
    await uninstallPlugin(id)
    await loadInstalled()
    setUninstalling(null)
    setConfirmUninstall(null)
  }

  // Filter installed by search
  const filteredInstalled = installed.filter(p => {
    if (!search) return true
    const lbl = installedPluginLabel(p).toLowerCase()
    const desc = installedPluginDescription(p).toLowerCase()
    const q = search.toLowerCase()
    return lbl.includes(q) || desc.includes(q) || p.plugin_id?.toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <Puzzle className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Plugins</h2>
          <Badge variant="secondary">{installed.length} installed</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 px-6 py-3 border-b">
        <button
          className={cn("text-sm font-medium pb-1 border-b-2 transition-colors", tab === "installed" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          onClick={() => setTab("installed")}
        >
          Installed ({installed.length})
        </button>
        <button
          className={cn("text-sm font-medium pb-1 border-b-2 transition-colors", tab === "marketplace" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          onClick={() => setTab("marketplace")}
        >
          Marketplace
        </button>
      </div>

      {/* Search + Category filter */}
      <div className="flex items-center gap-3 px-6 py-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder={tab === "installed" ? "Search installed plugins..." : "Search marketplace..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {tab === "marketplace" && (
          <div className="flex items-center gap-1">
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(cat => (
              <Button
                key={cat}
                variant={category === cat ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mb-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-center gap-2">
          <X className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setError(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tab === "installed" ? (
          /* ── Installed Plugins Grid ── */
          filteredInstalled.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{search ? "No plugins match your search" : "No plugins installed yet"}</p>
              <Button variant="link" className="mt-2" onClick={() => setTab("marketplace")}>
                Browse Marketplace
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredInstalled.map(p => {
                const iconUrl = installedPluginIcon(p)
                const label = installedPluginLabel(p)
                const desc = installedPluginDescription(p)
                const cat = installedPluginCategory(p)
                const uid = p.installation_id ?? p.plugin_unique_identifier ?? p.plugin_id
                return (
                  <div
                    key={uid}
                    className="group border rounded-lg p-4 hover:shadow-sm transition-shadow bg-card"
                  >
                    <div className="flex items-start gap-3">
                      {iconUrl ? (
                        <img src={iconUrl} alt="" className="h-10 w-10 rounded-lg object-contain shrink-0 bg-muted p-1" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Puzzle className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{label}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[cat])}>
                            {cat}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{desc}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          {p.declaration?.version ?? p.version ? (
                            <span>v{p.declaration?.version ?? p.version}</span>
                          ) : null}
                          {p.source && <span className="capitalize">{p.source}</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => setConfirmUninstall(p)}
                        disabled={uninstalling === uid}
                      >
                        {uninstalling === uid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* ── Marketplace Grid ── */
          marketplace.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No plugins found</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {marketplace.map(p => {
                  const key = `${p.org}/${p.name}`
                  const isInstalled = installedIds.has(key)
                  const isInstalling = installing === key
                  const iconUrl = pluginIconUrl(p)
                  return (
                    <div
                      key={p.plugin_id ?? key}
                      className="group border rounded-lg p-4 hover:shadow-sm transition-shadow bg-card"
                    >
                      <div className="flex items-start gap-3">
                        {iconUrl ? (
                          <img src={iconUrl} alt="" className="h-10 w-10 rounded-lg object-contain shrink-0 bg-muted p-1" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Puzzle className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{i18n(p.label) || p.name}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[p.category])}>
                              {p.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{i18n(p.brief ?? p.description)}</p>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                            <span>{p.org}</span>
                            <span>v{p.version}</span>
                            {p.install_count != null && (
                              <span className="flex items-center gap-0.5">
                                <Download className="h-3 w-3" /> {p.install_count.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {isInstalled ? (
                          <Badge variant="secondary" className="shrink-0 text-xs gap-1">
                            <Check className="h-3 w-3" /> Installed
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 h-7 text-xs"
                            disabled={isInstalling}
                            onClick={() => handleInstall(p)}
                          >
                            {isInstalling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                            Install
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {marketplaceTotal > marketplace.length && (
                <p className="text-center text-xs text-muted-foreground mt-4">
                  Showing {marketplace.length} of {marketplaceTotal} plugins
                </p>
              )}
            </>
          )
        )}
      </div>

      {/* Uninstall confirmation dialog */}
      <Dialog open={!!confirmUninstall} onOpenChange={(open) => { if (!open) setConfirmUninstall(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Uninstall Plugin</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to uninstall <strong>{confirmUninstall ? installedPluginLabel(confirmUninstall) : ""}</strong>? This will remove all its models, tools, and configurations.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmUninstall(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleUninstall} disabled={!!uninstalling}>
              {uninstalling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
