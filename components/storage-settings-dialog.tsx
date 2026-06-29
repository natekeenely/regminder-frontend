"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Cloud, HardDrive, Save, RefreshCw, Check, Network, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────

type CloudProvider = "azure" | "aws" | "sharepoint" | "google-drive"

interface CloudStorageConfig {
  enabled: boolean
  provider: CloudProvider
  siteName: string
  rootPath: string
  azureAccount: string
  azureContainer: string
  azureEndpoint: string
  azureSasToken: string
  awsRegion: string
  awsBucket: string
  awsPrefix: string
  awsEndpoint: string
  awsAccessKeyId: string
  awsSecretAccessKey: string
  sharepointSiteUrl: string
  sharepointDriveId: string
  sharepointClientId: string
  sharepointClientSecret: string
  googleDriveId: string
  googleRootFolderId: string
  googleClientId: string
  googleClientSecret: string
  googleApiKey: string
}

interface CloudSettingResponse {
  ok?: boolean
  setting?: Partial<CloudStorageConfig>
}

interface LocalSettingResponse {
  ok?: boolean
  setting?: {
    mode?: "local" | "intranet"
    provider?: string
    folder?: string
    displayPath?: string
  }
}

// ── Defaults ────────────────────────────────────────────────────────────────

const defaultCloudConfig: CloudStorageConfig = {
  enabled: true,
  provider: "aws",
  siteName: "Primary cloud storage",
  rootPath: "",
  azureAccount: "",
  azureContainer: "",
  azureEndpoint: "",
  azureSasToken: "",
  awsRegion: "",
  awsBucket: "",
  awsPrefix: "",
  awsEndpoint: "",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  sharepointSiteUrl: "",
  sharepointDriveId: "",
  sharepointClientId: "",
  sharepointClientSecret: "",
  googleDriveId: "",
  googleRootFolderId: "",
  googleClientId: "",
  googleClientSecret: "",
  googleApiKey: "",
}

const providerMeta: Record<CloudProvider, { label: string; apiProvider?: "s3" | "sharepoint"; status: string }> = {
  azure: { label: "Azure Blob Storage", status: "Adapter pending" },
  aws: { label: "AWS S3", apiProvider: "s3", status: "Document API" },
  sharepoint: { label: "SharePoint", apiProvider: "sharepoint", status: "Document API" },
  "google-drive": { label: "Google Drive", status: "Adapter pending" },
}

const cloudProviders: CloudProvider[] = ["aws", "azure", "sharepoint", "google-drive"]

// ── Props ───────────────────────────────────────────────────────────────────

interface StorageSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  secret = false,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  secret?: boolean
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-border bg-background px-3 pr-14 text-sm outline-none focus:border-primary"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((p) => !p)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </label>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export function StorageSettingsDialog({ open, onOpenChange }: StorageSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("cloud")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Record<string, string>>({})

  // Cloud state
  const [cloud, setCloud] = useState<CloudStorageConfig>(defaultCloudConfig)

  // Local state
  const [localMode, setLocalMode] = useState<"local" | "intranet">("local")
  const [localFolder, setLocalFolder] = useState("")
  const [localDisplayPath, setLocalDisplayPath] = useState("")
  const [intranetFolder, setIntranetFolder] = useState("")

  // ── Load saved settings on open ──────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setStatus({})

    // Load cloud settings
    try {
      const resp = await fetch("/api/proxy/api/v1/connectors/user/cloud-storage")
      if (resp.ok) {
        const data = (await resp.json()) as CloudSettingResponse
        if (data.setting) {
          setCloud((prev) => ({ ...prev, ...data.setting }))
        }
      }
    } catch { /* keep defaults */ }

    // Load local settings
    try {
      const resp = await fetch("/api/proxy/api/v1/connectors/user/local-storage")
      if (resp.ok) {
        const data = (await resp.json()) as LocalSettingResponse
        if (data.setting) {
          const s = data.setting
          if (s.mode === "local" || s.mode === "intranet") setLocalMode(s.mode)
          if (s.displayPath) setLocalDisplayPath(s.displayPath)
          if (s.folder) {
            if (s.mode === "intranet") {
              setIntranetFolder(s.folder)
            } else {
              setLocalFolder(s.folder)
            }
          }
        }
      }
    } catch { /* keep defaults */ }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) {
      void loadSettings()
    }
  }, [open, loadSettings])

  // ── Save handlers ─────────────────────────────────────────────────────────

  async function saveCloud(): Promise<void> {
    setStatus((prev) => ({ ...prev, cloud: "saving" }))
    try {
      // Also persist to localStorage for redundancy
      try {
        window.localStorage.setItem("regminder-cloud-storage-selection", JSON.stringify(cloud))
      } catch { /* non-critical */ }
      const resp = await fetch("/api/proxy/api/v1/connectors/user/cloud-storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cloud),
      })
      setStatus((prev) => ({ ...prev, cloud: resp.ok ? "saved" : "save failed" }))
    } catch {
      setStatus((prev) => ({ ...prev, cloud: "save failed" }))
    }
  }

  async function saveLocal(): Promise<void> {
    setStatus((prev) => ({ ...prev, local: "saving" }))
    try {
      const folder = localMode === "intranet" ? intranetFolder : localFolder
      const displayPath = localMode === "intranet" ? `nas:${intranetFolder || "/"}` : `local:${localFolder || (typeof window !== "undefined" ? "folder" : "")}`
      // Also persist to localStorage so the browsing screen can restore on revisit
      try {
        window.localStorage.setItem("regminder-local-storage-selection", JSON.stringify({ mode: localMode, folder: displayPath }))
      } catch { /* non-critical */ }
      const resp = await fetch("/api/proxy/api/v1/connectors/user/local-storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          mode: localMode,
          provider: localMode === "local" ? "local" : "nas",
          folder,
          displayPath,
          selectedAt: new Date().toISOString(),
        }),
      })
      setStatus((prev) => ({ ...prev, local: resp.ok ? "saved" : "save failed" }))
    } catch {
      setStatus((prev) => ({ ...prev, local: "save failed" }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedProvider = cloud.provider

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Storage Settings</DialogTitle>
          <DialogDescription>
            Configure cloud and local storage connections. Changes are saved to your user profile.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="cloud" className="flex-1 gap-2">
              <Cloud className="h-4 w-4" />
              Cloud Storage
            </TabsTrigger>
            <TabsTrigger value="local" className="flex-1 gap-2">
              <HardDrive className="h-4 w-4" />
              Local Storage
            </TabsTrigger>
          </TabsList>

          {/* ═══ Cloud Storage Tab ═══ */}
          <TabsContent value="cloud" className="flex-1 overflow-y-auto mt-4 space-y-4">
            {/* Provider selector */}
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Cloud Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {cloudProviders.map((p) => {
                  const meta = providerMeta[p]
                  const isSelected = selectedProvider === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCloud((prev) => ({ ...prev, provider: p }))}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40",
                        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <Cloud className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{meta.label}</div>
                        <div className="text-[11px] text-muted-foreground">{meta.status}</div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Site Name" value={cloud.siteName} onChange={(v) => setCloud((prev) => ({ ...prev, siteName: v }))} placeholder="e.g. Production Storage" />
              <Field label="Root Path" value={cloud.rootPath} onChange={(v) => setCloud((prev) => ({ ...prev, rootPath: v }))} placeholder="e.g. /data" />
            </div>

            {/* Provider-specific fields */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {providerMeta[selectedProvider].label} Credentials
              </div>

              {selectedProvider === "aws" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="AWS Region" value={cloud.awsRegion} onChange={(v) => setCloud((prev) => ({ ...prev, awsRegion: v }))} placeholder="us-east-1" />
                  <Field label="S3 Bucket" value={cloud.awsBucket} onChange={(v) => setCloud((prev) => ({ ...prev, awsBucket: v }))} placeholder="my-bucket" />
                  <Field label="Key Prefix" value={cloud.awsPrefix} onChange={(v) => setCloud((prev) => ({ ...prev, awsPrefix: v }))} placeholder="folder/" />
                  <Field label="Custom Endpoint" value={cloud.awsEndpoint} onChange={(v) => setCloud((prev) => ({ ...prev, awsEndpoint: v }))} placeholder="https://..." />
                  <Field label="Access Key ID" value={cloud.awsAccessKeyId} onChange={(v) => setCloud((prev) => ({ ...prev, awsAccessKeyId: v }))} />
                  <Field label="Secret Access Key" value={cloud.awsSecretAccessKey} onChange={(v) => setCloud((prev) => ({ ...prev, awsSecretAccessKey: v }))} secret />
                </div>
              )}

              {selectedProvider === "azure" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Storage Account" value={cloud.azureAccount} onChange={(v) => setCloud((prev) => ({ ...prev, azureAccount: v }))} placeholder="mystorageaccount" />
                  <Field label="Container" value={cloud.azureContainer} onChange={(v) => setCloud((prev) => ({ ...prev, azureContainer: v }))} placeholder="mycontainer" />
                  <Field label="Blob Endpoint" value={cloud.azureEndpoint} onChange={(v) => setCloud((prev) => ({ ...prev, azureEndpoint: v }))} placeholder="https://...blob.core.windows.net" />
                  <Field label="SAS Token" value={cloud.azureSasToken} onChange={(v) => setCloud((prev) => ({ ...prev, azureSasToken: v }))} secret />
                </div>
              )}

              {selectedProvider === "sharepoint" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Site URL" value={cloud.sharepointSiteUrl} onChange={(v) => setCloud((prev) => ({ ...prev, sharepointSiteUrl: v }))} placeholder="https://...sharepoint.com/sites/..." />
                  <Field label="Drive ID" value={cloud.sharepointDriveId} onChange={(v) => setCloud((prev) => ({ ...prev, sharepointDriveId: v }))} placeholder="b!..." />
                  <Field label="Client ID" value={cloud.sharepointClientId} onChange={(v) => setCloud((prev) => ({ ...prev, sharepointClientId: v }))} />
                  <Field label="Client Secret" value={cloud.sharepointClientSecret} onChange={(v) => setCloud((prev) => ({ ...prev, sharepointClientSecret: v }))} secret />
                </div>
              )}

              {selectedProvider === "google-drive" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Drive ID" value={cloud.googleDriveId} onChange={(v) => setCloud((prev) => ({ ...prev, googleDriveId: v }))} placeholder="0A..." />
                  <Field label="Root Folder ID" value={cloud.googleRootFolderId} onChange={(v) => setCloud((prev) => ({ ...prev, googleRootFolderId: v }))} placeholder="1A..." />
                  <Field label="Client ID" value={cloud.googleClientId} onChange={(v) => setCloud((prev) => ({ ...prev, googleClientId: v }))} />
                  <Field label="Client Secret" value={cloud.googleClientSecret} onChange={(v) => setCloud((prev) => ({ ...prev, googleClientSecret: v }))} secret />
                  <Field label="API Key" value={cloud.googleApiKey} onChange={(v) => setCloud((prev) => ({ ...prev, googleApiKey: v }))} secret />
                </div>
              )}
            </div>

            {/* Save button */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={loadSettings} disabled={loading}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Reload
                </Button>
                {status.cloud && (
                  <Badge variant={status.cloud === "saved" ? "outline" : "secondary"}>
                    {status.cloud === "saving" ? "Saving..." : status.cloud === "saved" ? "Saved" : status.cloud}
                  </Badge>
                )}
              </div>
              <Button size="sm" onClick={saveCloud} disabled={status.cloud === "saving"}>
                <Save className="mr-1 h-4 w-4" />
                Save Cloud Config
              </Button>
            </div>
          </TabsContent>

          {/* ═══ Local Storage Tab ═══ */}
          <TabsContent value="local" className="flex-1 overflow-y-auto mt-4 space-y-4">
            {/* Mode selector */}
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Storage Mode</label>
              <div className="flex rounded-md border border-border bg-muted/30 p-0.5 w-fit">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded px-4 py-2 text-sm transition",
                    localMode === "local" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setLocalMode("local")}
                >
                  <HardDrive className="h-4 w-4" />
                  Local
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded px-4 py-2 text-sm transition",
                    localMode === "intranet" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setLocalMode("intranet")}
                >
                  <Network className="h-4 w-4" />
                  Intranet
                </button>
              </div>
            </div>

            {/* Local mode */}
            {localMode === "local" && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Local Folder
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  Choose a local folder to set as your default storage location.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const pickerHost = window as Window & { showDirectoryPicker?: () => Promise<{ name: string }> }
                        if (!pickerHost.showDirectoryPicker) {
                          setStatus((prev) => ({ ...prev, local: "Folder picker not available in this browser" }))
                          return
                        }
                        const directory = await pickerHost.showDirectoryPicker()
                        setLocalFolder(directory.name)
                        setLocalDisplayPath(`local:${directory.name}`)
                        setStatus((prev) => ({ ...prev, local: "folder selected" }))
                      } catch (err) {
                        if (err instanceof DOMException && err.name === "AbortError") return
                        setStatus((prev) => ({ ...prev, local: err instanceof Error ? err.message : "Selection failed" }))
                      }
                    }}
                  >
                    <FolderOpen className="mr-1 h-4 w-4" />
                    Choose Folder
                  </Button>
                  {localDisplayPath && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 flex-1">
                      <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm text-foreground truncate">{localDisplayPath}</span>
                      <Badge variant="outline" className="ml-auto shrink-0">Current</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Intranet folder path */}
            {localMode === "intranet" && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Intranet Folder Path
                </div>
                <div className="space-y-3">
                  <Field
                    label="Folder Path"
                    value={intranetFolder}
                    onChange={setIntranetFolder}
                    placeholder="\\\\server\\share\\folder or /mnt/nas"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the network path to your intranet storage. This will be the default folder when you open the Local Storage screen in Intranet mode.
                  </p>
                </div>
              </div>
            )}

            {/* Save button */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={loadSettings} disabled={loading}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Reload
                </Button>
                {status.local && (
                  <Badge variant={status.local === "saved" ? "outline" : "secondary"}>
                    {status.local === "saving" ? "Saving..." : status.local === "saved" ? "Saved" : status.local}
                  </Badge>
                )}
              </div>
              <Button size="sm" onClick={saveLocal} disabled={status.local === "saving"}>
                <Save className="mr-1 h-4 w-4" />
                Save Local Config
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
