"use client"

import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react"
import {
  Check,
  Cloud,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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

interface CloudEntry {
  id: string
  name: string
  kind: "folder" | "file"
  path: string
  updatedAt?: string
  size?: number
}

interface DocumentsResponse {
  ok?: boolean
  provider?: string
  items?: Array<{
    id?: string
    name?: string
    path?: string
    updatedAt?: string
    isFolder?: boolean
    size?: number
  }>
  detail?: string
}

interface DocumentContentResponse {
  ok?: boolean
  item?: {
    name: string
    contentBase64: string
  }
  detail?: string
}

interface ConnectorSettingResponse {
  ok?: boolean
  setting?: Partial<CloudStorageConfig>
}

const defaultConfig: CloudStorageConfig = {
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

function formatBytes(value?: number): string {
  if (!value) return "-"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return window.btoa(binary)
}

function base64ToBlob(contentBase64: string): Blob {
  const binary = window.atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes])
}

interface DesktopDragAsset {
  file: File
  mime: string
  name: string
  url: string
}

function triggerDownload(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function parentFolder(folder: string): string {
  return folder.replace(/\/+$/g, "").replace(/\/[^/]*$/, "")
}

function mergeConfig(setting?: Partial<CloudStorageConfig>): CloudStorageConfig {
  return { ...defaultConfig, ...(setting ?? {}) }
}

export function CloudStorageContent() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [config, setConfig] = useState<CloudStorageConfig>(defaultConfig)
  const [folder, setFolder] = useState("")
  const [items, setItems] = useState<CloudEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<CloudEntry | null>(null)
  const [status, setStatus] = useState("idle")
  const [isDropTarget, setIsDropTarget] = useState(false)
  const dragCounterRef = useRef(0)
  const desktopDragAssetsRef = useRef<Map<string, DesktopDragAsset>>(new Map())
  const desktopDragPendingRef = useRef<Set<string>>(new Set())

  const meta = providerMeta[config.provider]
  const apiProvider = meta.apiProvider
  const canUseDocumentApi = Boolean(apiProvider)
  const canDownload = canUseDocumentApi && selectedEntry?.kind === "file"

  useEffect(() => {
    let cancelled = false
    async function loadConfig(): Promise<void> {
      try {
        const resp = await fetch("/api/proxy/api/v1/connectors/user/cloud-storage")
        if (resp.ok) {
          const data = (await resp.json()) as ConnectorSettingResponse
          if (!cancelled && data.setting) {
            const next = mergeConfig(data.setting)
            setConfig(next)
            setFolder(next.rootPath || next.awsPrefix || "")
            return
          }
        }
      } catch { /* fall back to localStorage */ }

      if (cancelled) return
      // Fallback to localStorage (set by Storage Settings dialog)
      try {
        const raw = window.localStorage.getItem("regminder-cloud-storage-selection")
        if (raw) {
          const saved = JSON.parse(raw) as Partial<CloudStorageConfig>
          const next = mergeConfig(saved)
          setConfig(next)
          setFolder(next.rootPath || next.awsPrefix || "")
          return
        }
      } catch { /* keep defaults */ }

      setStatus("config load failed")
    }

    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  function updateConfig<K extends keyof CloudStorageConfig>(key: K, value: CloudStorageConfig[K]): void {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function saveConfig(): Promise<void> {
    setStatus("saving")
    const rootPath = folder
    const nextConfig = { ...config, rootPath, savedAt: new Date().toISOString() }
    try {
      const resp = await fetch("/api/proxy/api/v1/connectors/user/cloud-storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextConfig),
      })
      setStatus(resp.ok ? "saved" : "save failed")
    } catch {
      setStatus("save failed")
    }
  }

  async function loadDocuments(nextFolder = folder): Promise<void> {
    setSelectedEntry(null)
    if (!apiProvider) {
      setItems([])
      setStatus(`${providerMeta[config.provider].label} adapter pending`)
      return
    }

    setStatus("loading")
    try {
      const params = new URLSearchParams({ provider: apiProvider, folder: nextFolder, includeFolders: "true" })
      const resp = await fetch(`/api/proxy/api/v1/documents?${params.toString()}`)
      const data = (await resp.json()) as DocumentsResponse
      if (!resp.ok || data.ok === false) {
        setItems([])
        setStatus(data.detail ?? "load failed")
        return
      }

      setItems(
        (data.items ?? []).map((item) => ({
          id: item.id ?? `${item.path ?? item.name}`,
          name: item.name ?? "",
          kind: item.isFolder ? "folder" : "file",
          path: item.path ?? item.name ?? "",
          updatedAt: item.updatedAt,
          size: item.size,
        }))
      )
      setStatus("ready")
    } catch (error) {
      setItems([])
      setStatus(error instanceof Error ? error.message : "load failed")
    }
  }

  async function uploadFiles(files: FileList | null): Promise<void> {
    const rows = Array.from(files ?? [])
    if (rows.length === 0 || !apiProvider) return

    setStatus("uploading")
    try {
      for (const file of rows) {
        const contentBase64 = arrayBufferToBase64(await file.arrayBuffer())
        const resp = await fetch("/api/proxy/api/v1/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: apiProvider,
            folder,
            name: file.name,
            contentBase64,
          }),
        })
        if (!resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as { detail?: string }
          throw new Error(data.detail ?? `Upload failed for ${file.name}`)
        }
      }
      await loadDocuments(folder)
      setStatus("uploaded")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "upload failed")
    }
  }

  async function downloadSelected(): Promise<void> {
    if (!selectedEntry || selectedEntry.kind !== "file" || !apiProvider) return

    setStatus("downloading")
    try {
      const params = new URLSearchParams({ provider: apiProvider, folder, name: selectedEntry.name })
      const resp = await fetch(`/api/proxy/api/v1/documents/content?${params.toString()}`)
      const data = (await resp.json()) as DocumentContentResponse
      if (!resp.ok || data.ok === false || !data.item) {
        throw new Error(data.detail ?? "download failed")
      }
      triggerDownload(data.item.name, base64ToBlob(data.item.contentBase64))
      setStatus("downloaded")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "download failed")
    }
  }

  // ═══ Drag & Drop ═══

  function handlePaneDragEnter(event: ReactDragEvent<HTMLDivElement>): void {
    if (!canUseDocumentApi) return
    if (!event.dataTransfer.types.includes("Files") && !event.dataTransfer.types.includes("text/uri-list") && !event.dataTransfer.types.includes("text/plain")) return
    event.preventDefault()
    dragCounterRef.current += 1
    setIsDropTarget(true)
  }

  function handlePaneDragOver(event: ReactDragEvent<HTMLDivElement>): void {
    if (!canUseDocumentApi) return
    if (!event.dataTransfer.types.includes("Files") && !event.dataTransfer.types.includes("text/uri-list") && !event.dataTransfer.types.includes("text/plain")) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  function handlePaneDragLeave(): void {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setIsDropTarget(false)
  }

  async function handlePaneDrop(event: ReactDragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault()
    dragCounterRef.current = 0
    setIsDropTarget(false)
    if (!canUseDocumentApi) return
    const droppedFiles = event.dataTransfer.files
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles)
    }
  }

  async function ensureDesktopDragAsset(entry: CloudEntry): Promise<DesktopDragAsset | null> {
    if (entry.kind !== "file" || !apiProvider) return null
    const cached = desktopDragAssetsRef.current.get(entry.id)
    if (cached) return cached
    if (desktopDragPendingRef.current.has(entry.id)) return null
    desktopDragPendingRef.current.add(entry.id)
    try {
      const params = new URLSearchParams({ provider: apiProvider, folder, name: entry.name })
      const resp = await fetch(`/api/proxy/api/v1/documents/content?${params.toString()}`)
      const data = (await resp.json()) as DocumentContentResponse
      if (!resp.ok || data.ok === false || !data.item) return null
      const blob = base64ToBlob(data.item.contentBase64)
      const file = new File([blob], data.item.name, { type: blob.type || "application/octet-stream" })
      const asset = { file, mime: file.type || "application/octet-stream", name: file.name, url: URL.createObjectURL(file) }
      desktopDragAssetsRef.current.set(entry.id, asset)
      return asset
    } catch {
      return null
    } finally {
      desktopDragPendingRef.current.delete(entry.id)
    }
  }

  function handleEntryDragStart(entry: CloudEntry, event: ReactDragEvent<HTMLTableRowElement>): void {
    event.dataTransfer.effectAllowed = "copy"
    event.dataTransfer.setData("text/plain", entry.name)
    void ensureDesktopDragAsset(entry).then((asset) => {
      if (!asset) return
      try { event.dataTransfer.items.add(asset.file) } catch { /* not supported */ }
      event.dataTransfer.setData("DownloadURL", `${asset.mime}:${asset.name}:${asset.url}`)
    })
  }

  useEffect(() => {
    return () => {
      for (const asset of desktopDragAssetsRef.current.values()) URL.revokeObjectURL(asset.url)
      desktopDragAssetsRef.current.clear()
    }
  }, [])

  function openFolder(entry: CloudEntry): void {
    if (entry.kind !== "folder") {
      setSelectedEntry(entry)
      return
    }
    const next = folder ? `${folder.replace(/\/+$/g, "")}/${entry.name}` : entry.name
    setFolder(next)
    void loadDocuments(next)
  }

  const providerFields = {
    azure: (
      <>
        <Field label="Account" value={config.azureAccount} onChange={(v) => updateConfig("azureAccount", v)} />
        <Field label="Container" value={config.azureContainer} onChange={(v) => updateConfig("azureContainer", v)} />
        <Field label="Endpoint URL" value={config.azureEndpoint} onChange={(v) => updateConfig("azureEndpoint", v)} placeholder="https://account.blob.core.windows.net" />
        <Field label="SAS Token" value={config.azureSasToken} onChange={(v) => updateConfig("azureSasToken", v)} secret />
      </>
    ),
    aws: (
      <>
        <Field label="Region" value={config.awsRegion} onChange={(v) => updateConfig("awsRegion", v)} placeholder="us-east-1" />
        <Field label="Bucket" value={config.awsBucket} onChange={(v) => updateConfig("awsBucket", v)} />
        <Field label="Prefix" value={config.awsPrefix} onChange={(v) => updateConfig("awsPrefix", v)} />
        <Field label="Endpoint URL" value={config.awsEndpoint} onChange={(v) => updateConfig("awsEndpoint", v)} placeholder="Optional S3-compatible endpoint" />
        <Field label="Access Key" value={config.awsAccessKeyId} onChange={(v) => updateConfig("awsAccessKeyId", v)} />
        <Field label="Secret Key" value={config.awsSecretAccessKey} onChange={(v) => updateConfig("awsSecretAccessKey", v)} secret />
      </>
    ),
    sharepoint: (
      <>
        <Field label="Site URL" value={config.sharepointSiteUrl} onChange={(v) => updateConfig("sharepointSiteUrl", v)} placeholder="https://tenant.sharepoint.com/sites/site" />
        <Field label="Drive ID" value={config.sharepointDriveId} onChange={(v) => updateConfig("sharepointDriveId", v)} />
        <Field label="Client ID" value={config.sharepointClientId} onChange={(v) => updateConfig("sharepointClientId", v)} />
        <Field label="Client Secret" value={config.sharepointClientSecret} onChange={(v) => updateConfig("sharepointClientSecret", v)} secret />
      </>
    ),
    "google-drive": (
      <>
        <Field label="Drive ID" value={config.googleDriveId} onChange={(v) => updateConfig("googleDriveId", v)} />
        <Field label="Root Folder ID" value={config.googleRootFolderId} onChange={(v) => updateConfig("googleRootFolderId", v)} />
        <Field label="Client ID" value={config.googleClientId} onChange={(v) => updateConfig("googleClientId", v)} />
        <Field label="Client Secret" value={config.googleClientSecret} onChange={(v) => updateConfig("googleClientSecret", v)} secret />
        <Field label="API Key" value={config.googleApiKey} onChange={(v) => updateConfig("googleApiKey", v)} secret />
      </>
    ),
  } satisfies Record<CloudProvider, React.ReactNode>

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-background transition-colors", isDropTarget && "bg-primary/5")}
      onDragEnter={handlePaneDragEnter}
      onDragOver={handlePaneDragOver}
      onDragLeave={handlePaneDragLeave}
      onDrop={(event) => { void handlePaneDrop(event) }}
    >
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          void uploadFiles(event.target.files)
          event.target.value = ""
        }}
      />
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Cloud className="h-5 w-5 text-primary" />
              Cloud Storage
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{config.siteName}</span>
              <Badge variant="outline">{providerMeta[config.provider].label}</Badge>
              <Badge variant={canUseDocumentApi ? "outline" : "secondary"}>{meta.status}</Badge>
              {status !== "idle" && <Badge variant={status === "ready" || status === "saved" ? "outline" : "secondary"}>{status}</Badge>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/10 px-6 py-3">
        <Button size="sm" onClick={() => void loadDocuments()} disabled={!canUseDocumentApi}>
          <FolderOpen className="mr-1 h-4 w-4" />
          Open
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const next = parentFolder(folder)
            setFolder(next)
            void loadDocuments(next)
          }}
          disabled={!folder || !canUseDocumentApi}
        >
          Up
        </Button>
        <Button size="sm" variant="outline" onClick={() => void loadDocuments()} disabled={!canUseDocumentApi}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={() => uploadInputRef.current?.click()} disabled={!canUseDocumentApi}>
          <Upload className="mr-1 h-4 w-4" />
          Upload
        </Button>
        <Button size="sm" variant="outline" onClick={() => void downloadSelected()} disabled={!canDownload}>
          <Download className="mr-1 h-4 w-4" />
          Download
        </Button>
        {!canUseDocumentApi && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
            Save the site now; backend adapter can be connected next.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="overflow-auto rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-[42%] px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Size</th>
                <th className="px-3 py-2 text-left font-medium">Modified</th>
                <th className="px-3 py-2 text-left font-medium">Cloud Path</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={4}>
                    {canUseDocumentApi ? "Open a configured cloud folder to load files." : `${providerMeta[config.provider].label} configuration is ready to save.`}
                  </td>
                </tr>
              ) : (
                items.map((entry) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      "border-b border-border/60 last:border-b-0 hover:bg-muted/30",
                      selectedEntry?.id === entry.id && "bg-primary/5"
                    )}
                    draggable={entry.kind === "file"}
                    onDragStart={entry.kind === "file" ? (event: ReactDragEvent<HTMLTableRowElement>) => handleEntryDragStart(entry, event) : undefined}
                  >
                    <td className="px-3 py-2">
                      <button
                        className={cn(
                          "flex max-w-full items-center gap-2 text-left",
                          entry.kind === "folder" ? "font-medium text-foreground hover:text-primary" : "text-foreground"
                        )}
                        onClick={() => openFolder(entry)}
                      >
                        {entry.kind === "folder" ? (
                          <Folder className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatBytes(entry.size)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "-"}
                    </td>
                    <td className="max-w-[300px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">{entry.path}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  secret?: boolean
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        className="h-9"
        type={secret ? "password" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
