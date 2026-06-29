"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react"
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FilePlus,
  FileSpreadsheet,
  Folder,
  FolderPlus,
  GripHorizontal,
  Grid2X2,
  GripVertical,
  HardDrive,
  List,
  ListFilter,
  Loader2,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { RegminderUiPdfViewer } from "@/components/cli/regminderui-pdf-viewer"
import { Input } from "@/components/ui/input"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import {
  getMacFileIcon,
  getMacFileIconSmall,
  MacFolderIcon,
  formatDate,
  formatSize,
} from "@/components/cli/macos-icons"

type StorageMode = "local" | "intranet"

interface BrowserFileHandle {
  kind: "file"
  name: string
  getFile(): Promise<File>
  createWritable?: () => Promise<BrowserWritableFileStream>
}

interface BrowserWritableFileStream {
  write(data: Blob | BufferSource | string): Promise<void>
  close(): Promise<void>
}

interface BrowserDirectoryHandle {
  kind: "directory"
  name: string
  entries(): AsyncIterableIterator<[string, BrowserDirectoryHandle | BrowserFileHandle]>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<BrowserDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<BrowserFileHandle>
  removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>
  queryPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<"granted" | "denied" | "prompt">
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite" }) => Promise<BrowserDirectoryHandle>
}

interface StorageEntry {
  id: string
  name: string
  kind: "folder" | "file"
  path: string
  updatedAt?: string
  size?: number
  handle?: BrowserDirectoryHandle | BrowserFileHandle
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
  setting?: {
    mode?: StorageMode
    provider?: string
    folder?: string
    displayPath?: string
  }
}

interface PreviewState {
  status: "idle" | "loading" | "ready" | "error"
  kind?: "text" | "pdf"
  content: string
  note?: string
}

interface PaneData {
  id: string
  // local mode state
  localRoot: BrowserDirectoryHandle | null
  localStack: BrowserDirectoryHandle[]
  localItems: StorageEntry[]
  localStatus: string
  // intranet mode state
  intranetFolder: string
  intranetItems: StorageEntry[]
  intranetStatus: string
  // shared
  selectedEntry: StorageEntry | null
  search: string
  viewMode: "grid" | "list"
}

interface DraggedStorageEntry {
  sourcePaneId: string
  entryId: string
}

interface DesktopDragAsset {
  file: File
  mime: string
  name: string
  url: string
}

interface PersistedPaneLayout {
  id: string
  intranetFolder: string
  search: string
  viewMode: "grid" | "list"
}

interface PersistedLayoutState {
  splitCount: 1 | 2 | 3 | 4
  panes: PersistedPaneLayout[]
}

interface RestoredLayoutState {
  splitCount: 1 | 2 | 3 | 4
  panes: PaneData[]
}

function createDefaultPane(id: string): PaneData {
  return {
    id,
    localRoot: null,
    localStack: [],
    localItems: [],
    localStatus: "idle",
    intranetFolder: "",
    intranetItems: [],
    intranetStatus: "idle",
    selectedEntry: null,
    search: "",
    viewMode: "grid",
  }
}

const savedSelectionKey = "regminder-local-storage-selection"
const savedLayoutKey = "regminder-local-storage-layout-v1"
const savedFavoritesKey = "regminder-local-storage-favorites"
const savedRecentKey = "regminder-local-storage-recent"
const savedAuditLogKey = "regminder-local-storage-audit"
const savedBinKey = "regminder-local-storage-bin"
const savedLocalFolderIdKey = "regminder-local-storage-folder-id"

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
function saveJson(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)) } catch {/*quota*/} }

// ── IndexedDB helpers for persisting FileSystemDirectoryHandle ──
function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("regminder-handles", 1)
    req.onupgradeneeded = () => { req.result.createObjectStore("handles") }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function saveDirectoryHandle(id: string, handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDb()
    const tx = db.transaction("handles", "readwrite")
    tx.objectStore("handles").put(handle, id)
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem(savedLocalFolderIdKey, id)
  } catch { /* IndexedDB unavailable */ }
}
async function loadDirectoryHandle(id: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb()
    const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
      const tx = db.transaction("handles", "readonly")
      const req = tx.objectStore("handles").get(id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return handle ?? null
  } catch { return null }
}
async function clearDirectoryHandle(id: string): Promise<void> {
  try {
    const db = await openHandleDb()
    const tx = db.transaction("handles", "readwrite")
    tx.objectStore("handles").delete(id)
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.removeItem(savedLocalFolderIdKey)
  } catch { /* ignore */ }
}

interface AuditEntry { id: string; action: string; target: string; timestamp: string; user: string }
function logAudit(action: string, target: string) {
  const log = loadJson<AuditEntry[]>(savedAuditLogKey, [])
  log.unshift({ id: `audit-${Date.now()}`, action, target, timestamp: new Date().toISOString(), user: "User" })
  if (log.length > 500) log.length = 500
  saveJson(savedAuditLogKey, log)
}
interface FavoriteEntry { name: string; path: string; provider: string }
interface RecentEntry { name: string; path: string; provider: string; openedAt: string }
interface BinEntry { entry: StorageEntry; deletedAt: string; paneId: string; mode: StorageMode }

function addFavorite(name: string, path: string, provider = "local") {
  const favs = loadJson<FavoriteEntry[]>(savedFavoritesKey, [])
  if (!favs.some(f => f.path === path)) { favs.unshift({ name, path, provider }); saveJson(savedFavoritesKey, favs) }
}
function removeFavorite(path: string) {
  saveJson(savedFavoritesKey, loadJson<FavoriteEntry[]>(savedFavoritesKey, []).filter(f => f.path !== path))
}
function addRecent(name: string, path: string, provider = "local") {
  const recents = loadJson<RecentEntry[]>(savedRecentKey, [])
  const filtered = recents.filter(r => r.path !== path)
  filtered.unshift({ name, path, provider, openedAt: new Date().toISOString() })
  if (filtered.length > 20) filtered.length = 20
  saveJson(savedRecentKey, filtered)
}
function addToBin(entry: StorageEntry, paneId: string, mode: StorageMode) {
  const bin = loadJson<BinEntry[]>(savedBinKey, [])
  bin.unshift({ entry, deletedAt: new Date().toISOString(), paneId, mode })
  if (bin.length > 100) bin.length = 100
  saveJson(savedBinKey, bin)
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

function joinFolder(parent: string, child: string): string {
  if (!parent) return child
  const separator = parent.includes("\\") ? "\\" : "/"
  return `${parent.replace(/[\\/]+$/g, "")}${separator}${child}`
}

function parentFolder(folder: string): string {
  return folder.replace(/[\\/]+$/g, "").replace(/[\\/][^\\/]*$/, "")
}

function folderSegments(folder: string): string[] {
  return folder.split(/[\\/]+/).filter(Boolean)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return window.btoa(binary)
}

function base64ToUint8Array(contentBase64: string): Uint8Array {
  const binary = window.atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isTextPreviewable(entry: StorageEntry): boolean {
  return /\.(txt|md|csv|json|xml|html|htm|log|yml|yaml|ts|tsx|js|jsx|py|css|scss|sql)$/i.test(entry.name)
}

function isPdfPreviewable(entry: Pick<StorageEntry, "name">): boolean {
  return /\.pdf$/i.test(entry.name)
}

function normalizeSplitCount(value: unknown): 1 | 2 | 3 | 4 {
  return value === 2 || value === 3 || value === 4 ? value : 1
}

function restorePaneLayout(saved: PersistedPaneLayout, index: number): PaneData {
  const pane = createDefaultPane(saved.id || String(index + 1))
  return {
    ...pane,
    intranetFolder: typeof saved.intranetFolder === "string" ? saved.intranetFolder : "",
    search: typeof saved.search === "string" ? saved.search : "",
    viewMode: saved.viewMode === "list" ? "list" : "grid",
  }
}

function readSavedLayout(): RestoredLayoutState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(savedLayoutKey)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<PersistedLayoutState>
    const panes = Array.isArray(saved.panes)
      ? saved.panes.slice(0, 4).map((pane, index) => restorePaneLayout((pane ?? {}) as PersistedPaneLayout, index))
      : []
    return {
      splitCount: normalizeSplitCount(saved.splitCount),
      panes: panes.length > 0 ? panes : [createDefaultPane("1")],
    }
  } catch {
    return null
  }
}

function getNextPaneIdSeed(panes: PaneData[]): number {
  const maxExisting = panes.reduce((max, pane) => {
    const numericId = Number.parseInt(pane.id, 10)
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max
  }, 1)
  return maxExisting + 1
}

function ExplorerSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-background/80">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function FolderTreeButton({
  entry,
  selected,
  onClick,
}: {
  entry: StorageEntry
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted/60",
        selected && "bg-primary/10 text-primary"
      )}
    >
      <span className="h-3.5 w-3.5 shrink-0">
        <MacFolderIcon size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  )
}

function ExplorerNavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-3 px-4 text-left text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      )}
    >
      <span className={cn("flex h-4 w-4 items-center justify-center", active ? "text-primary-foreground" : "text-foreground")}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function SplitLayoutIcon({
  splitCount,
  className,
}: {
  splitCount: 1 | 2 | 3 | 4
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" />
      {splitCount >= 2 && <path d="M10 3.5V16.5" />}
      {splitCount === 3 && <path d="M10 10H16.5" />}
      {splitCount === 4 && <path d="M3.5 10H16.5" />}
    </svg>
  )
}

// ─── Hover layout picker ───

function SplitLayoutPicker({
  splitCount,
  onSelect,
}: {
  splitCount: 1 | 2 | 3 | 4
  onSelect: (count: 1 | 2 | 3 | 4) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const layouts = [
    { count: 1 as const, label: "Single" },
    { count: 2 as const, label: "2 Split" },
    { count: 3 as const, label: "3 Split" },
    { count: 4 as const, label: "4 Split" },
  ]

  function onEnter() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setOpen(true)
  }

  function onLeave() {
    hoverTimerRef.current = setTimeout(() => setOpen(false), 200)
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        className="flex items-center gap-1.5 rounded px-3 py-2 text-xs text-muted-foreground hover:bg-muted border border-border"
        title="Split layout"
      >
        <SplitLayoutIcon splitCount={splitCount} className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover p-1.5 shadow-lg"
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          <div className="flex items-center gap-1">
            {layouts.map(({ count, label }) => (
              <button
                key={count}
                type="button"
                onClick={() => {
                  onSelect(count)
                  setOpen(false)
                }}
                className={cn(
                  "flex items-center justify-center rounded p-2 transition-colors hover:bg-muted",
                  splitCount === count && "bg-primary/10 text-primary"
                )}
                title={label}
              >
                <SplitLayoutIcon splitCount={count} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── File list components ───

function FileListItem({
  entry,
  selected,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  onPrepareDrag,
  onDragOver,
  onDrop,
  gridCols = "28px 1fr 140px 100px 130px",
}: {
  entry: StorageEntry
  selected: boolean
  onClick: () => void
  draggable?: boolean
  onDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
  onPrepareDrag?: () => void
  onDragOver?: (event: ReactDragEvent<HTMLButtonElement>) => void
  onDrop?: (event: ReactDragEvent<HTMLButtonElement>) => void
  gridCols?: string
}) {
  const fileIcon = getMacFileIconSmall(entry.name, entry.kind)
  const fileType = fileIcon.typeLabel
  const lastModified = formatDate(entry.updatedAt)
  const fileSize = entry.kind === "file" ? formatSize(entry.size) : "—"

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={onPrepareDrag}
      onPointerDown={onPrepareDrag}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-regminder-folder-id={entry.kind === "folder" ? entry.id : undefined}
      className={cn(
        "group grid w-full items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/60",
        draggable && "cursor-grab active:cursor-grabbing",
        selected && "border-border bg-muted"
      )}
      style={{ gridTemplateColumns: gridCols }}
    >
      {/* Icon column */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        {fileIcon.icon}
      </span>
      {/* Name column */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{entry.name}</div>
      </div>
      {/* Type column */}
      <div className="hidden text-[12px] text-muted-foreground md:block truncate">{fileType}</div>
      {/* Size column */}
      <div className="hidden text-[12px] tabular-nums text-muted-foreground text-right sm:block">{fileSize}</div>
      {/* Date modified column */}
      <div className="hidden text-[12px] text-muted-foreground text-right lg:block truncate">{lastModified}</div>
    </button>
  )
}

function FileTile({
  entry,
  selected,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  onPrepareDrag,
  onDragOver,
  onDrop,
}: {
  entry: StorageEntry
  selected: boolean
  onClick: () => void
  draggable?: boolean
  onDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
  onPrepareDrag?: () => void
  onDragOver?: (event: ReactDragEvent<HTMLButtonElement>) => void
  onDrop?: (event: ReactDragEvent<HTMLButtonElement>) => void
}) {
  const fileIcon = getMacFileIcon(entry.name, entry.kind)

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={onPrepareDrag}
      onPointerDown={onPrepareDrag}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-regminder-folder-id={entry.kind === "folder" ? entry.id : undefined}
      className={cn(
        "group flex h-[104px] w-[92px] flex-col items-center justify-start rounded-lg border border-transparent px-2 py-2 text-center transition-colors hover:bg-[#eef4ff]",
        draggable && "cursor-grab active:cursor-grabbing",
        selected && "border-[#d9e7ff] bg-[#eef4ff]"
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center">
        {fileIcon.icon}
      </span>
      <span className="mt-1 line-clamp-2 max-w-full break-words text-[11px] leading-tight text-slate-700">{entry.name}</span>
    </button>
  )
}

// ─── Independent pane content ───

interface LocalPaneControllerProps {
  paneId: string
  pane: PaneData
  allPanes: PaneData[]
  splitCount: 1 | 2 | 3 | 4
  mode: StorageMode
  draggedEntry: DraggedStorageEntry | null
  onActivateLocalMode: () => void
  onClosePane: (paneId: string) => void
  onEntryDragStart: (payload: DraggedStorageEntry) => void
  onEntryDragEnd: () => void
  onSelectSplitCount: (count: 1 | 2 | 3 | 4) => void
  onUpdatePane: (fn: (prev: PaneData[]) => PaneData[]) => void
}

function LocalPaneController({
  paneId,
  pane,
  allPanes,
  splitCount,
  mode,
  draggedEntry,
  onActivateLocalMode,
  onClosePane,
  onEntryDragStart,
  onEntryDragEnd,
  onSelectSplitCount,
  onUpdatePane,
}: LocalPaneControllerProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const paneRef = useRef<HTMLDivElement | null>(null)
  const previewTokenRef = useRef(0)
  const dragCounterRef = useRef(0)
  const desktopDragAssetsRef = useRef<Map<string, DesktopDragAsset>>(new Map())
  const desktopDragPendingRef = useRef<Set<string>>(new Set())
  const localCurrent = pane.localStack[pane.localStack.length - 1] ?? pane.localRoot
  const currentPath = mode === "local"
    ? localPathFromStack(pane.localRoot, pane.localStack)
    : pane.intranetFolder
  const [paneWidth, setPaneWidth] = useState<number | null>(null)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({ status: "idle", content: "" })

  const localItems = pane.localItems
  const intranetItems = pane.intranetItems

  const visibleItems = useMemo(() => {
    const items = mode === "local" ? localItems : intranetItems
    const q = pane.search.trim().toLowerCase()
    if (!q) return items
    return items.filter((entry) =>
      [entry.name, entry.path, entry.kind].some((value) =>
        String(value ?? "").toLowerCase().includes(q)
      )
    )
  }, [mode, localItems, intranetItems, pane.search])
  const showSearch = paneWidth === null || paneWidth >= 620

  // ── pane helpers ──

  function updatePane(partial: Partial<PaneData>): void {
    onUpdatePane((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, ...partial } : p))
    )
  }

  function setPaneStatus(status: string): void {
    if (mode === "local") updatePane({ localStatus: status })
    else updatePane({ intranetStatus: status })
  }

  async function refreshPaneContents(): Promise<void> {
    if (mode === "local") {
      if (!localCurrent) return
      await readLocalDirectory(localCurrent, pane.localStack.map((item) => item.name).join("/"))
      return
    }
    await loadIntranet()
  }

  async function copyEntryFromPane(sourcePaneId: string, entryId: string): Promise<void> {
    if (sourcePaneId === paneId) return
    const sourcePane = allPanes.find((item) => item.id === sourcePaneId)
    if (!sourcePane) return
    const sourceItems = mode === "local" ? sourcePane.localItems : sourcePane.intranetItems
    const sourceEntry = sourceItems.find((item) => item.id === entryId)
    if (!sourceEntry || sourceEntry.kind !== "file") return

    if (mode === "local") {
      const sourceCurrent = sourcePane.localStack[sourcePane.localStack.length - 1] ?? sourcePane.localRoot
      if (!sourceCurrent || !localCurrent) {
        updatePane({ localStatus: "Choose a local folder first" })
        return
      }
      updatePane({ localStatus: "copying" })
      try {
        const sourceHandle =
          sourceEntry.handle && sourceEntry.handle.kind === "file"
            ? sourceEntry.handle
            : await sourceCurrent.getFileHandle(sourceEntry.name)
        const file = await sourceHandle.getFile()
        const targetHandle = await localCurrent.getFileHandle(file.name, { create: true })
        if (!targetHandle.createWritable) throw new Error("Local write access is not available in this browser")
        const writable = await targetHandle.createWritable()
        await writable.write(file)
        await writable.close()
        await refreshPaneContents()
        updatePane({ localStatus: `Copied ${file.name}` })
      } catch (error) {
        updatePane({ localStatus: error instanceof Error ? error.message : "Copy failed" })
      }
      return
    }

    updatePane({ intranetStatus: "copying" })
    try {
      const params = new URLSearchParams({
        provider: "nas",
        folder: sourcePane.intranetFolder,
        name: sourceEntry.name,
      })
      const contentResp = await fetch(`/api/proxy/api/v1/documents/content?${params.toString()}`)
      const contentData = (await contentResp.json()) as DocumentContentResponse
      if (!contentResp.ok || contentData.ok === false || !contentData.item) {
        throw new Error(contentData.detail ?? "Copy failed")
      }
      const uploadResp = await fetch("/api/proxy/api/v1/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "nas",
          folder: pane.intranetFolder,
          name: contentData.item.name,
          contentBase64: contentData.item.contentBase64,
        }),
      })
      if (!uploadResp.ok) {
        const uploadData = (await uploadResp.json().catch(() => ({}))) as { detail?: string }
        throw new Error(uploadData.detail ?? "Copy failed")
      }
      await refreshPaneContents()
      updatePane({ intranetStatus: `Copied ${sourceEntry.name}` })
    } catch (error) {
      updatePane({ intranetStatus: error instanceof Error ? error.message : "Copy failed" })
    }
  }

  const ensureDesktopDragAsset = useCallback(async (entry: StorageEntry): Promise<DesktopDragAsset | null> => {
    if (entry.kind !== "file" || mode !== "local") return null
    const cached = desktopDragAssetsRef.current.get(entry.id)
    if (cached) return cached
    if (desktopDragPendingRef.current.has(entry.id)) return null
    if (!localCurrent) return null

    desktopDragPendingRef.current.add(entry.id)
    try {
      const handle =
        entry.handle && entry.handle.kind === "file"
          ? entry.handle
          : await localCurrent.getFileHandle(entry.name)
      const file = await handle.getFile()
      const asset = {
        file,
        mime: file.type || "application/octet-stream",
        name: file.name,
        url: URL.createObjectURL(file),
      }
      desktopDragAssetsRef.current.set(entry.id, asset)
      return asset
    } catch {
      return null
    } finally {
      desktopDragPendingRef.current.delete(entry.id)
    }
  }, [localCurrent, mode])

  useEffect(() => {
    const node = paneRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setPaneWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      for (const asset of desktopDragAssetsRef.current.values()) {
        URL.revokeObjectURL(asset.url)
      }
      desktopDragAssetsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (mode !== "local") return

    const visibleFileIds = new Set(
      visibleItems
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.id)
    )

    for (const [entryId, asset] of desktopDragAssetsRef.current.entries()) {
      if (!visibleFileIds.has(entryId)) {
        URL.revokeObjectURL(asset.url)
        desktopDragAssetsRef.current.delete(entryId)
      }
    }

    for (const entry of visibleItems) {
      if (entry.kind === "file") {
        void ensureDesktopDragAsset(entry)
      }
    }
  }, [ensureDesktopDragAsset, mode, visibleItems])

  useEffect(() => {
    if (splitCount === 1) return
    let cancelled = false

    async function loadPreview(): Promise<void> {
      if (!pane.selectedEntry) {
        setPreview({ status: "idle", content: "" })
        return
      }

      const token = previewTokenRef.current + 1
      previewTokenRef.current = token

      if (pane.selectedEntry.kind === "folder") {
        setPreview({
          status: "ready",
          kind: "text",
          content: `Folder contents for ${pane.selectedEntry.path}`,
          note: "Folders are navigational only in this view.",
        })
        return
      }

      setPreview({ status: "loading", content: "" })

      try {
        if (mode === "local") {
          let fileHandle: BrowserFileHandle | undefined
          if (pane.selectedEntry.handle && pane.selectedEntry.handle.kind === "file") {
            fileHandle = pane.selectedEntry.handle
          } else if (localCurrent) {
            fileHandle = await localCurrent.getFileHandle(pane.selectedEntry.name)
          }
          if (!fileHandle) throw new Error("Local file handle unavailable")
          const file = await fileHandle.getFile()
          if (isPdfPreviewable(pane.selectedEntry)) {
            const pdfBase64 = arrayBufferToBase64(await file.arrayBuffer())
            if (cancelled || token !== previewTokenRef.current) return
            setPreview({
              status: "ready",
              kind: "pdf",
              content: pdfBase64,
              note: "Rendered in the document viewer.",
            })
            return
          }
          const text = isTextPreviewable(pane.selectedEntry)
            ? await file.text()
            : `[Binary file: ${file.name}, ${formatBytes(file.size)}]`
          if (cancelled || token !== previewTokenRef.current) return
          setPreview({
            status: "ready",
            kind: "text",
            content: text.slice(0, 6000),
            note: text.length > 6000 ? "Preview truncated to 6,000 characters." : undefined,
          })
          return
        }

        const params = new URLSearchParams({
          provider: "nas",
          folder: pane.intranetFolder,
          name: pane.selectedEntry.name,
        })
        const resp = await fetch(`/api/proxy/api/v1/documents/content?${params.toString()}`)
        const data = (await resp.json()) as DocumentContentResponse
        if (!resp.ok || data.ok === false || !data.item) throw new Error(data.detail ?? "Preview load failed")
        if (isPdfPreviewable(pane.selectedEntry)) {
          if (cancelled || token !== previewTokenRef.current) return
          setPreview({
            status: "ready",
            kind: "pdf",
            content: data.item.contentBase64,
            note: "Rendered in the document viewer.",
          })
          return
        }
        const text = window.atob(data.item.contentBase64)
        if (cancelled || token !== previewTokenRef.current) return
        setPreview({
          status: "ready",
          kind: "text",
          content: text.slice(0, 6000),
          note: text.length > 6000 ? "Preview truncated to 6,000 characters." : undefined,
        })
      } catch (error) {
        if (cancelled || token !== previewTokenRef.current) return
        setPreview({
          status: "error",
          content: error instanceof Error ? error.message : "Preview unavailable",
        })
      }
    }

    void loadPreview()
    return () => { cancelled = true }
  }, [localCurrent, mode, pane.intranetFolder, pane.selectedEntry, splitCount])

  // ── local folder actions ──

  async function readLocalDirectory(directory: BrowserDirectoryHandle, prefix: string): Promise<void> {
    updatePane({ localStatus: "loading" })
    try {
      const rows: StorageEntry[] = []
      for await (const [, handle] of directory.entries()) {
        if (handle.kind === "directory") {
          rows.push({
            id: `${prefix}/${handle.name}`,
            name: handle.name,
            kind: "folder",
            path: `${prefix}/${handle.name}`,
            handle,
          })
        } else {
          const file = await handle.getFile()
          rows.push({
            id: `${prefix}/${file.name}-${file.lastModified}`,
            name: file.name,
            kind: "file",
            path: `${prefix}/${file.name}`,
            updatedAt: new Date(file.lastModified).toISOString(),
            size: file.size,
            handle,
          })
        }
      }
      rows.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      updatePane({ localItems: rows, localStatus: "ready" })
    } catch (error) {
      updatePane({ localStatus: error instanceof Error ? error.message : "Unable to read folder" })
    }
  }

  async function chooseLocalFolder(): Promise<void> {
    const pickerHost = window as WindowWithDirectoryPicker
    if (!pickerHost.showDirectoryPicker) {
      updatePane({ localStatus: "Folder picker is not available in this browser" })
      return
    }

    try {
      onActivateLocalMode()
      const directory = await pickerHost.showDirectoryPicker()
      updatePane({ localRoot: directory, localStack: [directory] })
      await readLocalDirectory(directory, directory.name)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      updatePane({ localStatus: error instanceof Error ? error.message : "Folder selection failed" })
    }
  }

  async function openLocalFolder(entry: StorageEntry): Promise<void> {
    if (!localCurrent || entry.kind !== "folder") return
    const directory =
      entry.handle && entry.handle.kind === "directory"
        ? entry.handle
        : await localCurrent.getDirectoryHandle(entry.name)
    const nextStack = [...pane.localStack, directory]
    updatePane({ localStack: nextStack, selectedEntry: null })
    await readLocalDirectory(directory, nextStack.map((item) => item.name).join("/"))
  }

  async function goLocalUp(): Promise<void> {
    if (pane.localStack.length <= 1) return
    const nextStack = pane.localStack.slice(0, -1)
    updatePane({ localStack: nextStack })
    const directory = nextStack[nextStack.length - 1]
    await readLocalDirectory(directory, nextStack.map((item) => item.name).join("/"))
  }

  // ── intranet folder actions ──

  async function loadIntranet(folder = pane.intranetFolder): Promise<void> {
    updatePane({ intranetStatus: "loading" })
    try {
      const params = new URLSearchParams({ provider: "nas", folder, includeFolders: "true" })
      const resp = await fetch(`/api/proxy/api/v1/documents?${params.toString()}`)
      const data = (await resp.json()) as DocumentsResponse
      if (!resp.ok || data.ok === false) {
        updatePane({ intranetStatus: data.detail ?? "Unable to load intranet folder", intranetItems: [] })
        return
      }
      const rows = (data.items ?? []).map((item) => ({
        id: item.id ?? `${item.path ?? item.name}`,
        name: item.name ?? "",
        kind: item.isFolder ? "folder" as const : "file" as const,
        path: item.path ?? item.name ?? "",
        updatedAt: item.updatedAt,
        size: item.size,
      }))
      rows.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      updatePane({ intranetItems: rows, intranetStatus: "ready" })
    } catch (error) {
      updatePane({ intranetStatus: error instanceof Error ? error.message : "Unable to load intranet folder", intranetItems: [] })
    }
  }

  function openIntranetFolder(entry: StorageEntry): void {
    if (entry.kind !== "folder") return
    const next = joinFolder(pane.intranetFolder, entry.name)
    updatePane({ intranetFolder: next, selectedEntry: null })
    void loadIntranet(next)
  }

  // ── breadcrumb ──

  // ── other helpers ──

  async function selectCurrentFolder(): Promise<void> {
    const folder = mode === "local" ? currentPath : pane.intranetFolder
    const displayPath = mode === "local"
      ? `local:${currentPath || pane.localRoot?.name || "/"}`
      : `nas:${pane.intranetFolder || "/"}`
    try {
      window.localStorage.setItem(savedSelectionKey, JSON.stringify({ mode, folder: displayPath }))
    } catch { /* non-critical */ }
    try {
      await fetch("/api/proxy/api/v1/connectors/user/local-storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          mode,
          provider: mode === "local" ? "local" : "nas",
          folder,
          displayPath,
          selectedAt: new Date().toISOString(),
        }),
      })
    } catch { /* non-critical */ }
  }

  async function uploadFiles(files: FileList | null): Promise<void> {
    const rows = Array.from(files ?? [])
    if (rows.length === 0) return

    if (mode === "local") {
      if (!localCurrent) {
        updatePane({ localStatus: "Choose a local folder first" })
        return
      }
      updatePane({ localStatus: "uploading" })
      try {
        for (const file of rows) {
          const handle = await localCurrent.getFileHandle(file.name, { create: true })
          if (!handle.createWritable) throw new Error("Local write access is not available in this browser")
          const writable = await handle.createWritable()
          await writable.write(file)
          await writable.close()
        }
        await readLocalDirectory(localCurrent, pane.localStack.map((item) => item.name).join("/"))
        updatePane({ localStatus: "uploaded" })
      } catch (error) {
        updatePane({ localStatus: error instanceof Error ? error.message : "Upload failed" })
      }
      return
    }

    updatePane({ intranetStatus: "uploading" })
    try {
      for (const file of rows) {
        const contentBase64 = arrayBufferToBase64(await file.arrayBuffer())
        const resp = await fetch("/api/proxy/api/v1/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "nas",
            folder: pane.intranetFolder,
            name: file.name,
            contentBase64,
          }),
        })
        if (!resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as { detail?: string }
          throw new Error(data.detail ?? `Upload failed for ${file.name}`)
        }
      }
      await loadIntranet(pane.intranetFolder)
      updatePane({ intranetStatus: "uploaded" })
    } catch (error) {
      updatePane({ intranetStatus: error instanceof Error ? error.message : "Upload failed" })
    }
  }

  async function uploadFilesToLocalDirectory(directory: BrowserDirectoryHandle, files: FileList | File[]): Promise<void> {
    const rows = Array.from(files)
    if (rows.length === 0) return
    updatePane({ localStatus: "uploading" })
    try {
      for (const file of rows) {
        const handle = await directory.getFileHandle(file.name, { create: true })
        if (!handle.createWritable) throw new Error("Local write access is not available in this browser")
        const writable = await handle.createWritable()
        await writable.write(file)
        await writable.close()
      }
      if (localCurrent) {
        await readLocalDirectory(localCurrent, pane.localStack.map((item) => item.name).join("/"))
      }
      updatePane({ localStatus: "uploaded" })
    } catch (error) {
      updatePane({ localStatus: error instanceof Error ? error.message : "Upload failed" })
    }
  }

  async function uploadFilesToIntranetFolder(folder: string, files: FileList | File[]): Promise<void> {
    const rows = Array.from(files)
    if (rows.length === 0) return
    updatePane({ intranetStatus: "uploading" })
    try {
      for (const file of rows) {
        const contentBase64 = arrayBufferToBase64(await file.arrayBuffer())
        const resp = await fetch("/api/proxy/api/v1/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "nas",
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
      await loadIntranet(pane.intranetFolder)
      updatePane({ intranetStatus: "uploaded" })
    } catch (error) {
      updatePane({ intranetStatus: error instanceof Error ? error.message : "Upload failed" })
    }
  }

  async function copyEntryToFolder(sourcePaneId: string, entryId: string, targetFolderEntry?: StorageEntry): Promise<void> {
    if (sourcePaneId === paneId && !targetFolderEntry) return
    const sourcePane = allPanes.find((item) => item.id === sourcePaneId)
    if (!sourcePane) return
    const sourceItems = mode === "local" ? sourcePane.localItems : sourcePane.intranetItems
    const sourceEntry = sourceItems.find((item) => item.id === entryId)
    if (!sourceEntry || sourceEntry.kind !== "file") return

    if (mode === "local") {
      const sourceCurrent = sourcePane.localStack[sourcePane.localStack.length - 1] ?? sourcePane.localRoot
      if (!sourceCurrent || !localCurrent) {
        updatePane({ localStatus: "Choose a local folder first" })
        return
      }
      const shouldMove = Boolean(targetFolderEntry)
      updatePane({ localStatus: shouldMove ? "moving" : "copying" })
      try {
        const sourceHandle =
          sourceEntry.handle && sourceEntry.handle.kind === "file"
            ? sourceEntry.handle
            : await sourceCurrent.getFileHandle(sourceEntry.name)
        const file = await sourceHandle.getFile()
        const targetDirectory =
          targetFolderEntry?.handle && targetFolderEntry.handle.kind === "directory"
            ? targetFolderEntry.handle
            : targetFolderEntry
              ? await localCurrent.getDirectoryHandle(targetFolderEntry.name)
              : localCurrent
        const targetHandle = await targetDirectory.getFileHandle(file.name, { create: true })
        if (!targetHandle.createWritable) throw new Error("Local write access is not available in this browser")
        const writable = await targetHandle.createWritable()
        await writable.write(file)
        await writable.close()
        const removeSourceEntry = sourceCurrent.removeEntry
        const canRemoveSource =
          shouldMove &&
          sourceCurrent !== targetDirectory &&
          typeof removeSourceEntry === "function"
        if (canRemoveSource) {
          await removeSourceEntry.call(sourceCurrent, sourceEntry.name)
        }
        await readLocalDirectory(localCurrent, pane.localStack.map((item) => item.name).join("/"))
        updatePane({ localStatus: `${canRemoveSource ? "Moved" : "Copied"} ${file.name}` })
      } catch (error) {
        updatePane({ localStatus: error instanceof Error ? error.message : shouldMove ? "Move failed" : "Copy failed" })
      }
      return
    }

    updatePane({ intranetStatus: "copying" })
    try {
      const params = new URLSearchParams({
        provider: "nas",
        folder: sourcePane.intranetFolder,
        name: sourceEntry.name,
      })
      const contentResp = await fetch(`/api/proxy/api/v1/documents/content?${params.toString()}`)
      const contentData = (await contentResp.json()) as DocumentContentResponse
      if (!contentResp.ok || contentData.ok === false || !contentData.item) {
        throw new Error(contentData.detail ?? "Copy failed")
      }
      const targetFolder = targetFolderEntry ? joinFolder(pane.intranetFolder, targetFolderEntry.name) : pane.intranetFolder
      const uploadResp = await fetch("/api/proxy/api/v1/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "nas",
          folder: targetFolder,
          name: contentData.item.name,
          contentBase64: contentData.item.contentBase64,
        }),
      })
      if (!uploadResp.ok) {
        const uploadData = (await uploadResp.json().catch(() => ({}))) as { detail?: string }
        throw new Error(uploadData.detail ?? "Copy failed")
      }
      await loadIntranet(pane.intranetFolder)
      updatePane({ intranetStatus: `Copied ${sourceEntry.name}` })
    } catch (error) {
      updatePane({ intranetStatus: error instanceof Error ? error.message : "Copy failed" })
    }
  }

  function handlePaneDragEnter(event: ReactDragEvent<HTMLDivElement>): void {
    if (
      !event.dataTransfer.types.includes("Files") &&
      !event.dataTransfer.types.includes("application/x-regminder-entry") &&
      !event.dataTransfer.types.includes("text/plain") &&
      !draggedEntry
    ) return
    event.preventDefault()
    dragCounterRef.current += 1
    setIsDropTarget(true)
  }

  function handlePaneDragOver(event: ReactDragEvent<HTMLDivElement>): void {
    if (
      !event.dataTransfer.types.includes("Files") &&
      !event.dataTransfer.types.includes("application/x-regminder-entry") &&
      !event.dataTransfer.types.includes("text/plain") &&
      !draggedEntry
    ) return
    event.preventDefault()
    event.dataTransfer.dropEffect = draggedEntry && getDropTargetFolder(event) ? "move" : "copy"
  }

  function handlePaneDragLeave(): void {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setIsDropTarget(false)
  }

  function getDraggedEntryFromTransfer(event: ReactDragEvent<HTMLElement>): DraggedStorageEntry | null {
    if (draggedEntry) return draggedEntry
    const raw = event.dataTransfer.getData("application/x-regminder-entry")
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<DraggedStorageEntry>
      if (typeof parsed.sourcePaneId === "string" && typeof parsed.entryId === "string") {
        return { sourcePaneId: parsed.sourcePaneId, entryId: parsed.entryId }
      }
    } catch {
      // Ignore malformed drag payloads.
    }
    return null
  }

  function getDropTargetFolder(event: ReactDragEvent<HTMLElement>): StorageEntry | undefined {
    const element = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-regminder-folder-id]")
      : null
    const folderId = element?.dataset.regminderFolderId
    if (!folderId) return undefined
    const items = mode === "local" ? pane.localItems : pane.intranetItems
    return items.find((entry) => entry.id === folderId && entry.kind === "folder")
  }

  async function handlePaneDrop(event: ReactDragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault()
    dragCounterRef.current = 0
    setIsDropTarget(false)
    const targetFolderEntry = getDropTargetFolder(event)
    const payload = getDraggedEntryFromTransfer(event)
    if (payload) {
      await copyEntryToFolder(payload.sourcePaneId, payload.entryId, targetFolderEntry)
      return
    }
    const droppedFiles = event.dataTransfer.files
    if (droppedFiles.length > 0) {
      if (targetFolderEntry) {
        if (mode === "local") {
          const targetDirectory =
            targetFolderEntry.handle && targetFolderEntry.handle.kind === "directory"
              ? targetFolderEntry.handle
              : localCurrent
                ? await localCurrent.getDirectoryHandle(targetFolderEntry.name)
                : null
          if (!targetDirectory) {
            updatePane({ localStatus: "Choose a local folder first" })
            return
          }
          await uploadFilesToLocalDirectory(targetDirectory, droppedFiles)
          return
        }
        await uploadFilesToIntranetFolder(joinFolder(pane.intranetFolder, targetFolderEntry.name), droppedFiles)
        return
      }
      await uploadFiles(droppedFiles)
      return
    }
  }

  function handleFolderDragOver(event: ReactDragEvent<HTMLButtonElement>): void {
    if (
      !event.dataTransfer.types.includes("Files") &&
      !event.dataTransfer.types.includes("application/x-regminder-entry") &&
      !event.dataTransfer.types.includes("text/plain") &&
      !draggedEntry
    ) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = draggedEntry ? "move" : "copy"
  }

  function handleDragOverCapture(event: ReactDragEvent<HTMLDivElement>): void {
    if (
      event.dataTransfer.types.includes("Files") ||
      event.dataTransfer.types.includes("application/x-regminder-entry") ||
      event.dataTransfer.types.includes("text/plain") ||
      draggedEntry
    ) {
      event.preventDefault()
      event.dataTransfer.dropEffect = draggedEntry && getDropTargetFolder(event) ? "move" : "copy"
    }
  }

  function handleDropCapture(event: ReactDragEvent<HTMLDivElement>): void {
    if (
      event.dataTransfer.types.includes("Files") ||
      event.dataTransfer.types.includes("application/x-regminder-entry") ||
      event.dataTransfer.types.includes("text/plain") ||
      draggedEntry
    ) {
      event.preventDefault()
    }
  }

  async function handleFolderDrop(targetFolderEntry: StorageEntry, event: ReactDragEvent<HTMLButtonElement>): Promise<void> {
    if (targetFolderEntry.kind !== "folder") return
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current = 0
    setIsDropTarget(false)
    const payload = getDraggedEntryFromTransfer(event)
    if (payload) {
      await copyEntryToFolder(payload.sourcePaneId, payload.entryId, targetFolderEntry)
      return
    }
    const droppedFiles = event.dataTransfer.files
    if (droppedFiles.length > 0) {
      if (mode === "local") {
        const targetDirectory =
          targetFolderEntry.handle && targetFolderEntry.handle.kind === "directory"
            ? targetFolderEntry.handle
            : localCurrent
              ? await localCurrent.getDirectoryHandle(targetFolderEntry.name)
              : null
        if (!targetDirectory) {
          updatePane({ localStatus: "Choose a local folder first" })
          return
        }
        await uploadFilesToLocalDirectory(targetDirectory, droppedFiles)
        return
      }
      await uploadFilesToIntranetFolder(joinFolder(pane.intranetFolder, targetFolderEntry.name), droppedFiles)
      return
    }
  }

  function prepareDesktopDrag(entry: StorageEntry): void {
    if (entry.kind !== "file" || mode !== "local") return
    void ensureDesktopDragAsset(entry)
  }

  function handleEntryDragStart(entry: StorageEntry, event: ReactDragEvent<HTMLButtonElement>): void {
    onEntryDragStart({ sourcePaneId: paneId, entryId: entry.id })
    event.dataTransfer.effectAllowed = "copyMove"
    event.dataTransfer.setData("text/plain", entry.id)
    event.dataTransfer.setData("application/x-regminder-entry", JSON.stringify({
      sourcePaneId: paneId,
      entryId: entry.id,
    }))
    const desktopAsset = desktopDragAssetsRef.current.get(entry.id)
    if (!desktopAsset) return
    try {
      event.dataTransfer.items.add(desktopAsset.file)
    } catch {
      // Browser/OS support varies; DownloadURL below is the drag-out fallback.
    }
    event.dataTransfer.setData(
      "DownloadURL",
      `${desktopAsset.mime}:${desktopAsset.name}:${desktopAsset.url}`
    )
  }

  return (
    <div
      ref={paneRef}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-background transition-colors",
        isDropTarget && "bg-primary/5"
      )}
      onDragEnter={handlePaneDragEnter}
      onDragOverCapture={handleDragOverCapture}
      onDragOver={handlePaneDragOver}
      onDragLeave={handlePaneDragLeave}
      onDropCapture={handleDropCapture}
      onDrop={(event) => { void handlePaneDrop(event) }}
    >
      <div className="flex min-h-[64px] items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HardDrive className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-foreground">Local Storage</h2>
            <p className="truncate text-xs text-muted-foreground">
              {storageSectionPath(currentPath, mode)}
            </p>
          </div>
        </div>
        {splitCount > 1 && (
          <button
            type="button"
            onClick={() => onClosePane(paneId)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Close pane"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={cn(
        "grid min-h-[48px] items-center gap-3 border-b border-border px-4",
        showSearch
          ? "grid-cols-[auto_minmax(0,1fr)_auto]"
          : "grid-cols-[auto_auto] justify-between"
      )}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <ListFilter className="h-3.5 w-3.5" />
            Sort by
            <ChevronRight className="h-3 w-3 rotate-90" />
          </button>
          <button
            type="button"
            onClick={() =>
              void (mode === "local" && localCurrent
                ? readLocalDirectory(localCurrent, pane.localStack.map((item) => item.name).join("/"))
                : loadIntranet())
            }
            className="flex h-8 items-center gap-2 rounded px-2 text-xs text-muted-foreground hover:bg-muted"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        {showSearch && (
        <div className="flex min-w-0 justify-center">
          <div className="relative w-full max-w-[210px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pane.search}
              onChange={(e) => updatePane({ search: e.target.value })}
              placeholder="Search Files"
              className="h-8 w-full rounded border-border bg-background pl-8 text-xs"
            />
          </div>
        </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            onClick={chooseLocalFolder}
            className="h-8 px-3 text-xs font-medium"
          >
            Open Folder
          </Button>
          <SplitLayoutPicker splitCount={splitCount} onSelect={onSelectSplitCount} />
        </div>
      </div>

      {/* Upload input (hidden) */}
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

      {/* File content */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {visibleItems.length === 0 ? (
          <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-muted-foreground">
            {mode === "local"
              ? "Choose a local folder to begin."
              : "No files or folders found."}
          </div>
        ) : pane.viewMode === "grid" ? (
          <div className="flex flex-wrap content-start gap-x-4 gap-y-3">
            {visibleItems.map((entry) => (
              <FileTile
                key={entry.id}
                entry={entry}
                selected={pane.selectedEntry?.id === entry.id}
                draggable={entry.kind === "file"}
                onPrepareDrag={() => prepareDesktopDrag(entry)}
                onDragStart={(event) => handleEntryDragStart(entry, event)}
                onDragEnd={onEntryDragEnd}
                onDragOver={entry.kind === "folder" ? handleFolderDragOver : undefined}
                onDrop={entry.kind === "folder" ? (event) => { void handleFolderDrop(entry, event) } : undefined}
                onClick={() => {
                  updatePane({ selectedEntry: entry })
                  if (entry.kind === "folder") {
                    if (mode === "local") void openLocalFolder(entry)
                    else openIntranetFolder(entry)
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* List view column headers */}
            <div
              className="sticky top-0 z-10 grid items-center gap-2 border-b border-border bg-background/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm"
              style={{ gridTemplateColumns: "28px 1fr 140px 100px 130px" }}
            >
              <span />
              <span>Name</span>
              <span className="hidden md:block">Type</span>
              <span className="hidden sm:block text-right">Size</span>
              <span className="hidden lg:block text-right">Date Modified</span>
            </div>
            <div className="flex flex-col gap-0.5 py-1">
            {visibleItems.map((entry) => (
              <FileListItem
                key={entry.id}
                entry={entry}
                selected={pane.selectedEntry?.id === entry.id}
                draggable={entry.kind === "file"}
                onPrepareDrag={() => prepareDesktopDrag(entry)}
                onDragStart={(event) => handleEntryDragStart(entry, event)}
                onDragEnd={onEntryDragEnd}
                onDragOver={entry.kind === "folder" ? handleFolderDragOver : undefined}
                onDrop={entry.kind === "folder" ? (event) => { void handleFolderDrop(entry, event) } : undefined}
                onClick={() => {
                  updatePane({ selectedEntry: entry })
                  if (entry.kind === "folder") {
                    if (mode === "local") void openLocalFolder(entry)
                    else openIntranetFolder(entry)
                  }
                }}
              />
            ))}
            </div>
          </div>
        )}
      </div>

      {pane.selectedEntry && (
        <div className="border-t border-border">
          <div className="flex items-center border-b border-border/50 px-3 py-1.5">
            <span className="truncate text-[10px] font-medium text-foreground">
              {pane.selectedEntry.name}
            </span>
          </div>
          <div
            className="resize-y overflow-auto p-2 min-h-[120px] max-h-[70vh]"
            style={{ height: preview.kind === "pdf" ? 320 : 140 }}
          >
            {preview.status === "loading" ? (
              <div className="text-[10px] text-muted-foreground">Loading...</div>
            ) : preview.status === "error" ? (
              <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-destructive">
                {preview.content}
              </pre>
            ) : preview.status === "ready" && preview.kind === "pdf" ? (
              <div className="flex h-full min-h-0 flex-col gap-2">
                <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
                  <RegminderUiPdfViewer documentSource={`data:application/pdf;base64,${preview.content}`} className="h-full min-h-[260px]" />
                </div>
                {preview.note && (
                  <div className="text-[10px] text-muted-foreground">{preview.note}</div>
                )}
              </div>
            ) : preview.status === "ready" ? (
              <>
                <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-muted-foreground">
                  {preview.content.slice(0, 4000)}
                  {preview.content.length > 4000 ? "\n...truncated" : ""}
                </pre>
                {preview.note && (
                  <div className="mt-1 text-[10px] text-muted-foreground">{preview.note}</div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function localPathFromStack(root: BrowserDirectoryHandle | null, stack: BrowserDirectoryHandle[]): string {
  if (!root) return ""
  const names = stack.map((item) => item.name)
  return names.join("/") || root.name
}

function storageSectionPath(path: string, mode: StorageMode): string {
  if (path) return path
  return mode === "local" ? "No folder selected" : "/"
}

// ─── Main component ───

export function LocalStorageContent() {
  const initialLayout = readSavedLayout()
  const initialPanes = initialLayout?.panes.length ? initialLayout.panes : [createDefaultPane("1")]
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const singleDesktopDragAssetsRef = useRef<Map<string, DesktopDragAsset>>(new Map())
  const singleDesktopDragPendingRef = useRef<Set<string>>(new Set())
  const userTouchedModeRef = useRef(false)
  const previewTokenRef = useRef(0)
  const nextPaneIdRef = useRef(getNextPaneIdSeed(initialPanes))
  const [mode, setMode] = useState<StorageMode>("local")
  const [splitCount, setSplitCount] = useState<1 | 2 | 3 | 4>(initialLayout?.splitCount ?? 1)
  const [panes, setPanes] = useState<PaneData[]>(initialPanes)
  const [preview, setPreview] = useState<PreviewState>({ status: "idle", content: "" })
  const [draggedEntry, setDraggedEntry] = useState<DraggedStorageEntry | null>(null)

  // ── Phase 7: Batch ops, CRUD, Favorites, Context menu, Sort, Bin, Audit ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: StorageEntry } | null>(null)
  const [showRenameDialog, setShowRenameDialog] = useState<{ entry: StorageEntry } | null>(null)
  const [renameText, setRenameText] = useState("")
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showNewFileDialog, setShowNewFileDialog] = useState<"document" | "spreadsheet" | null>(null)
  const [newFileName, setNewFileName] = useState("")
  const [newFileExt, setNewFileExt] = useState("")
  const [newFileFolder, setNewFileFolder] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [showConvertDialog, setShowConvertDialog] = useState<{ entry: StorageEntry } | null>(null)
  const [convertFormat, setConvertFormat] = useState("pdf")
  const [showShareDialog, setShowShareDialog] = useState<{ entry: StorageEntry } | null>(null)
  const [shareEmail, setShareEmail] = useState("")
  const [sharePermission, setSharePermission] = useState<"read" | "write">("read")
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const [showBin, setShowBin] = useState(false)
  const [sortBy, setSortBy] = useState<"name" | "size" | "date" | "type">("name")
  const [sortAsc, setSortAsc] = useState(true)
  const [colWidths, setColWidths] = useState<[number, number, number, number, number]>([28, 0, 140, 100, 130])
  const colResizeRef = useRef<{ col: number; startX: number; startW: number; nextW: number } | null>(null)
  const [drawerWidth, setDrawerWidth] = useState(() => Math.round(window.innerWidth / 3))
  const drawerResizeRef = useRef<{ startX: number; startW: number } | null>(null)
  const gridCols = useMemo(
    () => colWidths.map((w, i) => (i === 1 ? "1fr" : `${w}px`)).join(" "),
    [colWidths]
  )
  const [previewEntry, setPreviewEntry] = useState<StorageEntry | null>(null)
  const [showThumbPreviews, setShowThumbPreviews] = useState(true)
  const paneSlots = useMemo(
    () => Array.from({ length: splitCount }, (_, index) => panes[index] ?? createDefaultPane(String(index + 1))),
    [panes, splitCount]
  )

  // The first pane is the "active" one for single-pane view
  const activePane = paneSlots[0]

  const localCurrent = activePane.localStack[activePane.localStack.length - 1] ?? activePane.localRoot
  const currentPath = mode === "local"
    ? localPathFromStack(activePane.localRoot, activePane.localStack)
    : activePane.intranetFolder

  // Derived values for single-pane toolbar
  const visibleItems = useMemo(() => {
    const items = mode === "local" ? activePane.localItems : activePane.intranetItems
    const q = activePane.search.trim().toLowerCase()
    if (!q) return items
    return items.filter((entry) =>
      [entry.name, entry.path, entry.kind].some((value) =>
        String(value ?? "").toLowerCase().includes(q)
      )
    )
  }, [mode, activePane.localItems, activePane.intranetItems, activePane.search])

  const ensureSingleDesktopDragAsset = useCallback(async (entry: StorageEntry): Promise<DesktopDragAsset | null> => {
    if (entry.kind !== "file" || mode !== "local") return null
    const cached = singleDesktopDragAssetsRef.current.get(entry.id)
    if (cached) return cached
    if (singleDesktopDragPendingRef.current.has(entry.id)) return null
    if (!localCurrent) return null

    singleDesktopDragPendingRef.current.add(entry.id)
    try {
      const handle =
        entry.handle && entry.handle.kind === "file"
          ? entry.handle
          : await localCurrent.getFileHandle(entry.name)
      const file = await handle.getFile()
      const asset = {
        file,
        mime: file.type || "application/octet-stream",
        name: file.name,
        url: URL.createObjectURL(file),
      }
      singleDesktopDragAssetsRef.current.set(entry.id, asset)
      return asset
    } catch {
      return null
    } finally {
      singleDesktopDragPendingRef.current.delete(entry.id)
    }
  }, [localCurrent, mode])

  // ── Sync pane count with splitCount ──
  useEffect(() => {
    setPanes((prev) => {
      if (prev.length === splitCount) return prev
      if (prev.length < splitCount) {
        const next = [...prev]
        while (next.length < splitCount) {
          next.push(createDefaultPane(String(nextPaneIdRef.current)))
          nextPaneIdRef.current += 1
        }
        return next
      }
      return prev.slice(0, splitCount)
    })
  }, [splitCount])

  useEffect(() => {
    try {
      const persisted: PersistedLayoutState = {
        splitCount,
        panes: panes.slice(0, 4).map((pane) => ({
          id: pane.id,
          intranetFolder: pane.intranetFolder,
          search: pane.search,
          viewMode: pane.viewMode,
        })),
      }
      window.localStorage.setItem(savedLayoutKey, JSON.stringify(persisted))
    } catch {
      // Ignore storage write failures.
    }
  }, [panes, splitCount])

  useEffect(() => {
    return () => {
      for (const asset of singleDesktopDragAssetsRef.current.values()) {
        URL.revokeObjectURL(asset.url)
      }
      singleDesktopDragAssetsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (splitCount !== 1 || mode !== "local") return

    const visibleFileIds = new Set(
      visibleItems
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.id)
    )

    for (const [entryId, asset] of singleDesktopDragAssetsRef.current.entries()) {
      if (!visibleFileIds.has(entryId)) {
        URL.revokeObjectURL(asset.url)
        singleDesktopDragAssetsRef.current.delete(entryId)
      }
    }

    for (const entry of visibleItems) {
      if (entry.kind === "file") {
        void ensureSingleDesktopDragAsset(entry)
      }
    }
  }, [ensureSingleDesktopDragAsset, mode, splitCount, visibleItems])

  // ── Column & drawer resize handler ──
  useEffect(() => {
    if (splitCount !== 1) return // single-pane only
    const handleMouseMove = (e: MouseEvent) => {
      if (colResizeRef.current) {
        const { col, startX, startW, nextW } = colResizeRef.current
        const delta = e.clientX - startX
        const newColW = Math.max(40, startW + delta)
        const newNextW = Math.max(40, nextW - delta)
        setColWidths((prev) => {
          const next = [...prev] as [number, number, number, number, number]
          next[col] = newColW
          next[col + 1] = newNextW
          return next
        })
      }
      if (drawerResizeRef.current) {
        const { startX, startW } = drawerResizeRef.current
        const delta = startX - e.clientX
        const newW = Math.max(280, Math.min(window.innerWidth * 0.6, startW + delta))
        setDrawerWidth(newW)
      }
    }
    const handleMouseUp = () => { colResizeRef.current = null; drawerResizeRef.current = null }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [splitCount])

  const startColResize = (col: number, e: React.MouseEvent) => {
    e.preventDefault()
    // column 1 (name) is 1fr — skip; columns 2-4 are resizable
    if (col < 2 || col >= 4) return
    colResizeRef.current = {
      col,
      startX: e.clientX,
      startW: colWidths[col],
      nextW: colWidths[col + 1],
    }
  }

  // ── Load saved selection ──

  useEffect(() => {
    let cancelled = false
    async function loadSavedSelection(): Promise<void> {
      let savedMode: StorageMode | undefined
      let savedFolderPath = ""

      try {
        const resp = await fetch("/api/proxy/api/v1/connectors/user/local-storage")
        if (resp.ok) {
          const data = (await resp.json()) as ConnectorSettingResponse
          const setting = data.setting
          if (!cancelled && setting) {
            if (!userTouchedModeRef.current && (setting.mode === "local" || setting.mode === "intranet"))
              savedMode = setting.mode
            if (typeof setting.folder === "string" && setting.mode === "intranet")
              savedFolderPath = setting.folder
          }
        }
      } catch { /* fall through */ }

      if (!cancelled && !savedMode) {
        try {
          const raw = window.localStorage.getItem(savedSelectionKey)
          if (raw) {
            const saved = JSON.parse(raw) as { mode?: StorageMode; folder?: string }
            if (!userTouchedModeRef.current && (saved.mode === "local" || saved.mode === "intranet"))
              savedMode = saved.mode
            if (typeof saved.folder === "string" && saved.mode === "intranet")
              savedFolderPath = saved.folder.replace(/^nas:/, "")
          }
        } catch { /* ignore */ }
      }

      if (cancelled) return

      if (savedMode) {
        setMode(savedMode)
        if (savedMode === "local") {
          // Try to restore the last-used folder handle from IndexedDB
          const folderId = "regminder-local-folder-v1"
          const savedHandle = await loadDirectoryHandle(folderId)
          if (savedHandle) {
            // Verify permission is still granted
            try {
              const dirHandle = savedHandle as unknown as BrowserDirectoryHandle
              const permission = dirHandle.queryPermission ? await dirHandle.queryPermission({ mode: "readwrite" }) : "granted"
              if (permission === "granted") {
                // Auto-restore: read directory and populate pane
                const rows: StorageEntry[] = []
                for await (const [, h] of dirHandle.entries()) {
                  if (h.kind === "directory") {
                    rows.push({ id: `/${dirHandle.name}/${h.name}`, name: h.name, kind: "folder", path: `/${dirHandle.name}/${h.name}`, handle: h })
                  } else {
                    const f = await h.getFile()
                    rows.push({ id: `/${dirHandle.name}/${f.name}-${f.lastModified}`, name: f.name, kind: "file", path: `/${dirHandle.name}/${f.name}`, updatedAt: new Date(f.lastModified).toISOString(), size: f.size, handle: h })
                  }
                }
                rows.sort((a, b) => { if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1; return a.name.localeCompare(b.name) })
                setPanes((prev) =>
                  prev.map((p, i) =>
                    i === 0 ? { ...p, localRoot: dirHandle, localStack: [dirHandle], localItems: rows, localStatus: "ready" } : p
                  )
                )
                // Also persist selection to user profile
                await persistStorageSelection("local", dirHandle.name, `local:${dirHandle.name}`)
              } else {
                // Permission lost — request re-auth via picker
                try {
                  const pickerHost = window as WindowWithDirectoryPicker
                  if (pickerHost.showDirectoryPicker) {
                    const directory = await pickerHost.showDirectoryPicker({ id: folderId, mode: "readwrite" })
                    await saveDirectoryHandle(folderId, directory as unknown as FileSystemDirectoryHandle)
                    const rows: StorageEntry[] = []
                    for await (const [, h] of directory.entries()) {
                      if (h.kind === "directory") {
                        rows.push({ id: `/${directory.name}/${h.name}`, name: h.name, kind: "folder", path: `/${directory.name}/${h.name}`, handle: h })
                      } else {
                        const f = await h.getFile()
                        rows.push({ id: `/${directory.name}/${f.name}-${f.lastModified}`, name: f.name, kind: "file", path: `/${directory.name}/${f.name}`, updatedAt: new Date(f.lastModified).toISOString(), size: f.size, handle: h })
                      }
                    }
                    rows.sort((a, b) => { if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1; return a.name.localeCompare(b.name) })
                    setPanes((prev) =>
                      prev.map((p, i) =>
                        i === 0 ? { ...p, localRoot: directory, localStack: [directory], localItems: rows, localStatus: "ready" } : p
                      )
                    )
                    await persistStorageSelection("local", directory.name, `local:${directory.name}`)
                  }
                } catch { /* user cancelled or browser doesn't support */ }
              }
            } catch {
              // Permission check failed — request re-auth
              try {
                const pickerHost = window as WindowWithDirectoryPicker
                if (pickerHost.showDirectoryPicker) {
                  const directory = await pickerHost.showDirectoryPicker({ id: folderId, mode: "readwrite" })
                  await saveDirectoryHandle(folderId, directory as unknown as FileSystemDirectoryHandle)
                  const rows: StorageEntry[] = []
                  for await (const [, h] of directory.entries()) {
                    if (h.kind === "directory") {
                      rows.push({ id: `/${directory.name}/${h.name}`, name: h.name, kind: "folder", path: `/${directory.name}/${h.name}`, handle: h })
                    } else {
                      const f = await h.getFile()
                      rows.push({ id: `/${directory.name}/${f.name}-${f.lastModified}`, name: f.name, kind: "file", path: `/${directory.name}/${f.name}`, updatedAt: new Date(f.lastModified).toISOString(), size: f.size, handle: h })
                    }
                  }
                  rows.sort((a, b) => { if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1; return a.name.localeCompare(b.name) })
                  setPanes((prev) =>
                    prev.map((p, i) =>
                      i === 0 ? { ...p, localRoot: directory, localStack: [directory], localItems: rows, localStatus: "ready" } : p
                    )
                  )
                  await persistStorageSelection("local", directory.name, `local:${directory.name}`)
                }
              } catch { /* user cancelled */ }
            }
          }
        } else if (savedMode === "intranet" && savedFolderPath) {
          setPanes((prev) =>
            prev.map((p, i) =>
              i === 0 ? { ...p, intranetFolder: savedFolderPath } : p
            )
          )
          // Trigger load on pane 1
          const pane = panes.find((p) => p.id === "1")
          if (pane) {
            // We'll trigger the load via the pane controller's useEffect
          }
        }
      }
    }

    void loadSavedSelection()
    return () => { cancelled = true }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load intranet on mode switch if folder is set ──
  // This is handled per-pane now via the independently-mounted panes

  // ── Preview logic ──
  useEffect(() => {
    let cancelled = false

    async function loadPreview(): Promise<void> {
      if (!activePane.selectedEntry) {
        setPreview({ status: "idle", content: "" })
        return
      }

      const token = previewTokenRef.current + 1
      previewTokenRef.current = token

      if (activePane.selectedEntry.kind === "folder") {
        setPreview({
          status: "ready",
          kind: "text",
          content: `Folder contents for ${activePane.selectedEntry.path}`,
          note: "Folders are navigational only in this view.",
        })
        return
      }

      setPreview({ status: "loading", content: "" })

      try {
        if (mode === "local") {
          let fileHandle: BrowserFileHandle | undefined
          if (activePane.selectedEntry.handle && activePane.selectedEntry.handle.kind === "file") {
            fileHandle = activePane.selectedEntry.handle
          } else if (localCurrent) {
            fileHandle = await localCurrent.getFileHandle(activePane.selectedEntry.name)
          }
          if (!fileHandle) throw new Error("Local file handle unavailable")
          const file = await fileHandle.getFile()
          if (isPdfPreviewable(activePane.selectedEntry)) {
            const pdfBase64 = arrayBufferToBase64(await file.arrayBuffer())
            if (cancelled || token !== previewTokenRef.current) return
            setPreview({
              status: "ready",
              kind: "pdf",
              content: pdfBase64,
              note: "Rendered in the document viewer.",
            })
            return
          }
          const text = isTextPreviewable(activePane.selectedEntry)
            ? await file.text()
            : `[Binary file: ${file.name}, ${formatBytes(file.size)}]`
          if (cancelled || token !== previewTokenRef.current) return
          setPreview({
            status: "ready",
            kind: "text",
            content: text.slice(0, 6000),
            note: text.length > 6000 ? "Preview truncated to 6,000 characters." : undefined,
          })
          return
        }

        const params = new URLSearchParams({
          provider: "nas",
          folder: activePane.intranetFolder,
          name: activePane.selectedEntry.name,
        })
        const resp = await fetch(`/api/proxy/api/v1/documents/content?${params.toString()}`)
        const data = (await resp.json()) as DocumentContentResponse
        if (!resp.ok || data.ok === false || !data.item) throw new Error(data.detail ?? "Preview load failed")
        if (isPdfPreviewable(activePane.selectedEntry)) {
          if (cancelled || token !== previewTokenRef.current) return
          setPreview({
            status: "ready",
            kind: "pdf",
            content: data.item.contentBase64,
            note: "Rendered in the document viewer.",
          })
          return
        }
        const text = window.atob(data.item.contentBase64)
        if (cancelled || token !== previewTokenRef.current) return
        setPreview({
          status: "ready",
          kind: "text",
          content: text.slice(0, 6000),
          note: text.length > 6000 ? "Preview truncated to 6,000 characters." : undefined,
        })
      } catch (error) {
        if (cancelled || token !== previewTokenRef.current) return
        setPreview({
          status: "error",
          content: error instanceof Error ? error.message : "Preview unavailable",
        })
      }
    }

    void loadPreview()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePane.intranetFolder, mode, activePane.selectedEntry])

  // ── Mode switch ──

  function switchMode(nextMode: StorageMode): void {
    userTouchedModeRef.current = true
    setMode(nextMode)
    // Pane controllers will handle reloading on mode switch
  }

  function activateLocalMode(): void {
    userTouchedModeRef.current = true
    setMode("local")
  }

  function closePane(targetPaneId: string): void {
    setPanes((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((pane) => pane.id !== targetPaneId)
      return next.length > 0 ? next : prev
    })
    setSplitCount((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev))
  }

  // ── Single-pane helpers (used by toolbar when splitCount === 1) ──

  async function chooseLocalFolderSingle(): Promise<void> {
    const pickerHost = window as WindowWithDirectoryPicker
    if (!pickerHost.showDirectoryPicker) {
      setPanes((prev) =>
        prev.map((p, i) =>
          i === 0 ? { ...p, localStatus: "Folder picker is not available in this browser" } : p
        )
      )
      return
    }
    try {
      activateLocalMode()
      // Use persistent folder ID so browser can skip the picker on re-auth
      const folderId = "regminder-local-folder-v1"
      const directory = await pickerHost.showDirectoryPicker({ id: folderId, mode: "readwrite" })
      // Persist handle to IndexedDB for auto-restore
      await saveDirectoryHandle(folderId, directory as unknown as FileSystemDirectoryHandle)
      setPanes((prev) =>
        prev.map((p, i) =>
          i === 0 ? { ...p, localRoot: directory, localStack: [directory] } : p
        )
      )
      // Read directory
      const rows: StorageEntry[] = []
      for await (const [, handle] of directory.entries()) {
        if (handle.kind === "directory") {
          rows.push({
            id: `/${directory.name}/${handle.name}`,
            name: handle.name,
            kind: "folder",
            path: `/${directory.name}/${handle.name}`,
            handle,
          })
        } else {
          const file = await handle.getFile()
          rows.push({
            id: `/${directory.name}/${file.name}-${file.lastModified}`,
            name: file.name,
            kind: "file",
            path: `/${directory.name}/${file.name}`,
            updatedAt: new Date(file.lastModified).toISOString(),
            size: file.size,
            handle,
          })
        }
      }
      rows.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setPanes((prev) =>
        prev.map((p, i) =>
          i === 0 ? { ...p, localItems: rows, localStatus: "ready" } : p
        )
      )
      // Persist selection to user profile (backend) + localStorage
      await persistStorageSelection("local", directory.name, `local:${directory.name}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setPanes((prev) =>
        prev.map((p, i) =>
          i === 0
            ? { ...p, localStatus: error instanceof Error ? error.message : "Folder selection failed" }
            : p
        )
      )
    }
  }

  async function openLocalFolderSingle(entry: StorageEntry): Promise<void> {
    const p = panes[0]
    const cur = p.localStack[p.localStack.length - 1] ?? p.localRoot
    if (!cur || entry.kind !== "folder") return
    const directory =
      entry.handle && entry.handle.kind === "directory"
        ? entry.handle
        : await cur.getDirectoryHandle(entry.name)
    const nextStack = [...p.localStack, directory]
    // Read dir
    const prefix = nextStack.map((item) => item.name).join("/")
    const rows: StorageEntry[] = []
    for await (const [, h] of directory.entries()) {
      if (h.kind === "directory") {
        rows.push({
          id: `${prefix}/${h.name}`,
          name: h.name,
          kind: "folder",
          path: `${prefix}/${h.name}`,
          handle: h,
        })
      } else {
        const file = await h.getFile()
        rows.push({
          id: `${prefix}/${file.name}-${file.lastModified}`,
          name: file.name,
          kind: "file",
          path: `${prefix}/${file.name}`,
          updatedAt: new Date(file.lastModified).toISOString(),
          size: file.size,
          handle: h,
        })
      }
    }
    rows.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    setPanes((prev) =>
      prev.map((pp, i) =>
        i === 0
          ? { ...pp, localStack: nextStack, localItems: rows, localStatus: "ready", selectedEntry: null }
          : pp
      )
    )
  }

  async function goLocalUpSingle(): Promise<void> {
    const p = panes[0]
    if (p.localStack.length <= 1) return
    const nextStack = p.localStack.slice(0, -1)
    const directory = nextStack[nextStack.length - 1]
    const prefix = nextStack.map((item) => item.name).join("/")
    const rows: StorageEntry[] = []
    for await (const [, h] of directory.entries()) {
      if (h.kind === "directory") {
        rows.push({ id: `${prefix}/${h.name}`, name: h.name, kind: "folder", path: `${prefix}/${h.name}`, handle: h })
      } else {
        const file = await h.getFile()
        rows.push({
          id: `${prefix}/${file.name}-${file.lastModified}`,
          name: file.name,
          kind: "file",
          path: `${prefix}/${file.name}`,
          updatedAt: new Date(file.lastModified).toISOString(),
          size: file.size,
          handle: h,
        })
      }
    }
    rows.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    setPanes((prev) =>
      prev.map((pp, i) =>
        i === 0
          ? { ...pp, localStack: nextStack, localItems: rows, localStatus: "ready", selectedEntry: null }
          : pp
      )
    )
  }

  async function loadIntranetSingle(folder = panes[0].intranetFolder): Promise<void> {
    setPanes((prev) =>
      prev.map((p, i) => (i === 0 ? { ...p, intranetStatus: "loading" } : p))
    )
    try {
      const params = new URLSearchParams({ provider: "nas", folder, includeFolders: "true" })
      const resp = await fetch(`/api/proxy/api/v1/documents?${params.toString()}`)
      const data = (await resp.json()) as DocumentsResponse
      if (!resp.ok || data.ok === false) {
        setPanes((prev) =>
          prev.map((p, i) =>
            i === 0
              ? { ...p, intranetStatus: data.detail ?? "Unable to load intranet folder", intranetItems: [] }
              : p
          )
        )
        return
      }
      const rows = (data.items ?? []).map((item) => ({
        id: item.id ?? `${item.path ?? item.name}`,
        name: item.name ?? "",
        kind: item.isFolder ? "folder" as const : "file" as const,
        path: item.path ?? item.name ?? "",
        updatedAt: item.updatedAt,
        size: item.size,
      }))
      rows.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setPanes((prev) =>
        prev.map((p, i) =>
          i === 0 ? { ...p, intranetItems: rows, intranetStatus: "ready", intranetFolder: folder } : p
        )
      )
    } catch (error) {
      setPanes((prev) =>
        prev.map((p, i) =>
          i === 0
            ? {
                ...p,
                intranetStatus: error instanceof Error ? error.message : "Unable to load intranet folder",
                intranetItems: [],
              }
            : p
        )
      )
    }
  }

  function openIntranetFolderSingle(entry: StorageEntry): void {
    if (entry.kind !== "folder") return
    const p = panes[0]
    const next = joinFolder(p.intranetFolder, entry.name)
    setPanes((prev) =>
      prev.map((pp, i) =>
        i === 0 ? { ...pp, intranetFolder: next, selectedEntry: null } : pp
      )
    )
    void loadIntranetSingle(next)
  }

  async function uploadFilesSingle(files: FileList | null): Promise<void> {
    const rows = Array.from(files ?? [])
    if (rows.length === 0) return
    const p = panes[0]

    if (mode === "local") {
      const cur = p.localStack[p.localStack.length - 1] ?? p.localRoot
      if (!cur) {
        setPanes((prev) =>
          prev.map((pp, i) =>
            i === 0 ? { ...pp, localStatus: "Choose a local folder first" } : pp
          )
        )
        return
      }
      setPanes((prev) =>
        prev.map((pp, i) => (i === 0 ? { ...pp, localStatus: "uploading" } : pp))
      )
      try {
        for (const file of rows) {
          const handle = await cur.getFileHandle(file.name, { create: true })
          if (!handle.createWritable) throw new Error("Local write access is not available")
          const writable = await handle.createWritable()
          await writable.write(file)
          await writable.close()
        }
        // Re-read
        const prefix = p.localStack.map((item) => item.name).join("/")
        const newRows: StorageEntry[] = []
        for await (const [, h] of cur.entries()) {
          if (h.kind === "directory") {
            newRows.push({ id: `${prefix}/${h.name}`, name: h.name, kind: "folder", path: `${prefix}/${h.name}`, handle: h })
          } else {
            const f = await h.getFile()
            newRows.push({
              id: `${prefix}/${f.name}-${f.lastModified}`,
              name: f.name,
              kind: "file",
              path: `${prefix}/${f.name}`,
              updatedAt: new Date(f.lastModified).toISOString(),
              size: f.size,
              handle: h,
            })
          }
        }
        newRows.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setPanes((prev) =>
          prev.map((pp, i) =>
            i === 0 ? { ...pp, localItems: newRows, localStatus: "uploaded" } : pp
          )
        )
      } catch (error) {
        setPanes((prev) =>
          prev.map((pp, i) =>
            i === 0
              ? { ...pp, localStatus: error instanceof Error ? error.message : "Upload failed" }
              : pp
          )
        )
      }
      return
    }

    setPanes((prev) =>
      prev.map((pp, i) => (i === 0 ? { ...pp, intranetStatus: "uploading" } : pp))
    )
    try {
      for (const file of rows) {
        const contentBase64 = arrayBufferToBase64(await file.arrayBuffer())
        const resp = await fetch("/api/proxy/api/v1/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "nas",
            folder: p.intranetFolder,
            name: file.name,
            contentBase64,
          }),
        })
        if (!resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as { detail?: string }
          throw new Error(data.detail ?? `Upload failed for ${file.name}`)
        }
      }
      await loadIntranetSingle(p.intranetFolder)
      setPanes((prev) =>
        prev.map((pp, i) =>
          i === 0 ? { ...pp, intranetStatus: "uploaded" } : pp
        )
      )
    } catch (error) {
      setPanes((prev) =>
        prev.map((pp, i) =>
          i === 0
            ? { ...pp, intranetStatus: error instanceof Error ? error.message : "Upload failed" }
            : pp
        )
      )
    }
  }

  async function uploadFilesSingleToLocalDirectory(directory: BrowserDirectoryHandle, files: FileList | File[]): Promise<void> {
    const rows = Array.from(files)
    if (rows.length === 0) return
    setPanes((prev) =>
      prev.map((pp, i) => (i === 0 ? { ...pp, localStatus: "uploading" } : pp))
    )
    try {
      for (const file of rows) {
        const handle = await directory.getFileHandle(file.name, { create: true })
        if (!handle.createWritable) throw new Error("Local write access is not available")
        const writable = await handle.createWritable()
        await writable.write(file)
        await writable.close()
      }
      await refreshSingle()
      setPanes((prev) =>
        prev.map((pp, i) => (i === 0 ? { ...pp, localStatus: "uploaded" } : pp))
      )
    } catch (error) {
      setPanes((prev) =>
        prev.map((pp, i) =>
          i === 0 ? { ...pp, localStatus: error instanceof Error ? error.message : "Upload failed" } : pp
        )
      )
    }
  }

  async function uploadFilesSingleToIntranetFolder(folder: string, files: FileList | File[]): Promise<void> {
    const rows = Array.from(files)
    if (rows.length === 0) return
    setPanes((prev) =>
      prev.map((pp, i) => (i === 0 ? { ...pp, intranetStatus: "uploading" } : pp))
    )
    try {
      for (const file of rows) {
        const contentBase64 = arrayBufferToBase64(await file.arrayBuffer())
        const resp = await fetch("/api/proxy/api/v1/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "nas",
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
      await loadIntranetSingle(panes[0].intranetFolder)
      setPanes((prev) =>
        prev.map((pp, i) => (i === 0 ? { ...pp, intranetStatus: "uploaded" } : pp))
      )
    } catch (error) {
      setPanes((prev) =>
        prev.map((pp, i) =>
          i === 0 ? { ...pp, intranetStatus: error instanceof Error ? error.message : "Upload failed" } : pp
        )
      )
    }
  }

  function getSingleDraggedEntryFromTransfer(event: ReactDragEvent<HTMLElement>): DraggedStorageEntry | null {
    if (draggedEntry) return draggedEntry
    const raw = event.dataTransfer.getData("application/x-regminder-entry")
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<DraggedStorageEntry>
      if (typeof parsed.sourcePaneId === "string" && typeof parsed.entryId === "string") {
        return { sourcePaneId: parsed.sourcePaneId, entryId: parsed.entryId }
      }
    } catch {
      // Ignore malformed drag payloads.
    }
    return null
  }

  function getSingleDropTargetFolder(event: ReactDragEvent<HTMLElement>): StorageEntry | undefined {
    const element = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-regminder-folder-id]")
      : null
    const folderId = element?.dataset.regminderFolderId
    if (!folderId) return undefined
    const items = mode === "local" ? panes[0].localItems : panes[0].intranetItems
    return items.find((entry) => entry.id === folderId && entry.kind === "folder")
  }

  async function moveSingleEntryToFolder(sourcePaneId: string, entryId: string, targetFolderEntry?: StorageEntry): Promise<void> {
    if (!targetFolderEntry) return
    const sourcePane = panes.find((item) => item.id === sourcePaneId)
    if (!sourcePane) return
    const sourceItems = mode === "local" ? sourcePane.localItems : sourcePane.intranetItems
    const sourceEntry = sourceItems.find((item) => item.id === entryId)
    if (!sourceEntry || sourceEntry.kind !== "file") return

    if (mode === "local") {
      const sourceCurrent = sourcePane.localStack[sourcePane.localStack.length - 1] ?? sourcePane.localRoot
      const targetCurrent = panes[0].localStack[panes[0].localStack.length - 1] ?? panes[0].localRoot
      if (!sourceCurrent || !targetCurrent) {
        setPanes((prev) =>
          prev.map((pp, i) => (i === 0 ? { ...pp, localStatus: "Choose a local folder first" } : pp))
        )
        return
      }
      setPanes((prev) =>
        prev.map((pp, i) => (i === 0 ? { ...pp, localStatus: "moving" } : pp))
      )
      try {
        const sourceHandle =
          sourceEntry.handle && sourceEntry.handle.kind === "file"
            ? sourceEntry.handle
            : await sourceCurrent.getFileHandle(sourceEntry.name)
        const file = await sourceHandle.getFile()
        const targetDirectory =
          targetFolderEntry.handle && targetFolderEntry.handle.kind === "directory"
            ? targetFolderEntry.handle
            : await targetCurrent.getDirectoryHandle(targetFolderEntry.name)
        const targetHandle = await targetDirectory.getFileHandle(file.name, { create: true })
        if (!targetHandle.createWritable) throw new Error("Local write access is not available")
        const writable = await targetHandle.createWritable()
        await writable.write(file)
        await writable.close()
        const removeSourceEntry = sourceCurrent.removeEntry
        const canRemoveSource =
          sourceCurrent !== targetDirectory &&
          typeof removeSourceEntry === "function"
        if (canRemoveSource) {
          await removeSourceEntry.call(sourceCurrent, sourceEntry.name)
        }
        await refreshSingle()
        setPanes((prev) =>
          prev.map((pp, i) =>
            i === 0 ? { ...pp, localStatus: `${canRemoveSource ? "Moved" : "Copied"} ${file.name}` } : pp
          )
        )
      } catch (error) {
        setPanes((prev) =>
          prev.map((pp, i) =>
            i === 0 ? { ...pp, localStatus: error instanceof Error ? error.message : "Move failed" } : pp
          )
        )
      }
      return
    }

    setPanes((prev) =>
      prev.map((pp, i) => (i === 0 ? { ...pp, intranetStatus: "copying" } : pp))
    )
    try {
      const params = new URLSearchParams({
        provider: "nas",
        folder: sourcePane.intranetFolder,
        name: sourceEntry.name,
      })
      const contentResp = await fetch(`/api/proxy/api/v1/documents/content?${params.toString()}`)
      const contentData = (await contentResp.json()) as DocumentContentResponse
      if (!contentResp.ok || contentData.ok === false || !contentData.item) {
        throw new Error(contentData.detail ?? "Copy failed")
      }
      await uploadFilesSingleToIntranetFolder(joinFolder(panes[0].intranetFolder, targetFolderEntry.name), [
        new File([base64ToUint8Array(contentData.item.contentBase64)], contentData.item.name),
      ])
    } catch (error) {
      setPanes((prev) =>
        prev.map((pp, i) =>
          i === 0 ? { ...pp, intranetStatus: error instanceof Error ? error.message : "Copy failed" } : pp
        )
      )
    }
  }

  function handleSinglePaneDragOver(event: ReactDragEvent<HTMLDivElement>): void {
    if (
      !event.dataTransfer.types.includes("Files") &&
      !event.dataTransfer.types.includes("application/x-regminder-entry") &&
      !event.dataTransfer.types.includes("text/plain") &&
      !draggedEntry
    ) return
    event.preventDefault()
    event.dataTransfer.dropEffect = draggedEntry && getSingleDropTargetFolder(event) ? "move" : "copy"
  }

  function handleSingleDragOverCapture(event: ReactDragEvent<HTMLDivElement>): void {
    if (
      event.dataTransfer.types.includes("Files") ||
      event.dataTransfer.types.includes("application/x-regminder-entry") ||
      event.dataTransfer.types.includes("text/plain") ||
      draggedEntry
    ) {
      event.preventDefault()
      event.dataTransfer.dropEffect = draggedEntry && getSingleDropTargetFolder(event) ? "move" : "copy"
    }
  }

  function handleSingleDropCapture(event: ReactDragEvent<HTMLDivElement>): void {
    if (
      event.dataTransfer.types.includes("Files") ||
      event.dataTransfer.types.includes("application/x-regminder-entry") ||
      event.dataTransfer.types.includes("text/plain") ||
      draggedEntry
    ) {
      event.preventDefault()
    }
  }

  async function handleSinglePaneDrop(event: ReactDragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault()
    const targetFolderEntry = getSingleDropTargetFolder(event)
    const payload = getSingleDraggedEntryFromTransfer(event)
    if (payload) {
      await moveSingleEntryToFolder(payload.sourcePaneId, payload.entryId, targetFolderEntry)
      return
    }
    const droppedFiles = event.dataTransfer.files
    if (droppedFiles.length === 0) return
    if (targetFolderEntry) {
      if (mode === "local") {
        const targetCurrent = panes[0].localStack[panes[0].localStack.length - 1] ?? panes[0].localRoot
        const targetDirectory =
          targetFolderEntry.handle && targetFolderEntry.handle.kind === "directory"
            ? targetFolderEntry.handle
            : targetCurrent
              ? await targetCurrent.getDirectoryHandle(targetFolderEntry.name)
              : null
        if (!targetDirectory) {
          setPanes((prev) =>
            prev.map((pp, i) => (i === 0 ? { ...pp, localStatus: "Choose a local folder first" } : pp))
          )
          return
        }
        await uploadFilesSingleToLocalDirectory(targetDirectory, droppedFiles)
        return
      }
      await uploadFilesSingleToIntranetFolder(joinFolder(panes[0].intranetFolder, targetFolderEntry.name), droppedFiles)
      return
    }
    await uploadFilesSingle(droppedFiles)
  }

  function handleSingleFolderDragOver(event: ReactDragEvent<HTMLButtonElement>): void {
    if (
      !event.dataTransfer.types.includes("Files") &&
      !event.dataTransfer.types.includes("application/x-regminder-entry") &&
      !event.dataTransfer.types.includes("text/plain") &&
      !draggedEntry
    ) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = draggedEntry ? "move" : "copy"
  }

  async function handleSingleFolderDrop(targetFolderEntry: StorageEntry, event: ReactDragEvent<HTMLButtonElement>): Promise<void> {
    if (targetFolderEntry.kind !== "folder") return
    event.preventDefault()
    event.stopPropagation()
    const payload = getSingleDraggedEntryFromTransfer(event)
    if (payload) {
      await moveSingleEntryToFolder(payload.sourcePaneId, payload.entryId, targetFolderEntry)
      return
    }
    const droppedFiles = event.dataTransfer.files
    if (droppedFiles.length === 0) return
    if (mode === "local") {
      const targetCurrent = panes[0].localStack[panes[0].localStack.length - 1] ?? panes[0].localRoot
      const targetDirectory =
        targetFolderEntry.handle && targetFolderEntry.handle.kind === "directory"
          ? targetFolderEntry.handle
          : targetCurrent
            ? await targetCurrent.getDirectoryHandle(targetFolderEntry.name)
            : null
      if (!targetDirectory) {
        setPanes((prev) =>
          prev.map((pp, i) => (i === 0 ? { ...pp, localStatus: "Choose a local folder first" } : pp))
        )
        return
      }
      await uploadFilesSingleToLocalDirectory(targetDirectory, droppedFiles)
      return
    }
    await uploadFilesSingleToIntranetFolder(joinFolder(panes[0].intranetFolder, targetFolderEntry.name), droppedFiles)
  }

  function prepareSingleDesktopDrag(entry: StorageEntry): void {
    if (entry.kind !== "file" || mode !== "local") return
    void ensureSingleDesktopDragAsset(entry)
  }

  function handleSingleEntryDragStart(entry: StorageEntry, event: ReactDragEvent<HTMLButtonElement>): void {
    setDraggedEntry({ sourcePaneId: panes[0].id, entryId: entry.id })
    event.dataTransfer.effectAllowed = "copyMove"
    event.dataTransfer.setData("text/plain", entry.id)
    event.dataTransfer.setData("application/x-regminder-entry", JSON.stringify({
      sourcePaneId: panes[0].id,
      entryId: entry.id,
    }))
    const desktopAsset = singleDesktopDragAssetsRef.current.get(entry.id)
    if (!desktopAsset) return
    try {
      event.dataTransfer.items.add(desktopAsset.file)
    } catch {
      // Browser/OS support varies; DownloadURL below is the drag-out fallback.
    }
    event.dataTransfer.setData(
      "DownloadURL",
      `${desktopAsset.mime}:${desktopAsset.name}:${desktopAsset.url}`
    )
  }

  async function refreshSingle(): Promise<void> {
    const p = panes[0]
    if (mode === "local") {
      const cur = p.localStack[p.localStack.length - 1] ?? p.localRoot
      if (!cur) return
      const prefix = p.localStack.map((item) => item.name).join("/")
      const rows: StorageEntry[] = []
      for await (const [, h] of cur.entries()) {
        if (h.kind === "directory") {
          rows.push({ id: `${prefix}/${h.name}`, name: h.name, kind: "folder", path: `${prefix}/${h.name}`, handle: h })
        } else {
          const f = await h.getFile()
          rows.push({
            id: `${prefix}/${f.name}-${f.lastModified}`,
            name: f.name,
            kind: "file",
            path: `${prefix}/${f.name}`,
            updatedAt: new Date(f.lastModified).toISOString(),
            size: f.size,
            handle: h,
          })
        }
      }
      rows.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setPanes((prev) =>
        prev.map((pp, i) =>
          i === 0 ? { ...pp, localItems: rows, localStatus: "ready" } : pp
        )
      )
    } else {
      void loadIntranetSingle()
    }
  }

  // ── Breadcrumb for single pane ──

  // ── Persist & mode switch ──

  async function persistStorageSelection(nextMode: StorageMode, folder: string, displayPath: string): Promise<void> {
    try {
      window.localStorage.setItem(savedSelectionKey, JSON.stringify({ mode: nextMode, folder: displayPath }))
    } catch { /* non-critical */ }
    try {
      await fetch("/api/proxy/api/v1/connectors/user/local-storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          mode: nextMode,
          provider: nextMode === "local" ? "local" : "nas",
          folder,
          displayPath,
          selectedAt: new Date().toISOString(),
        }),
      })
    } catch { /* non-critical */ }
  }

  async function selectCurrentFolderSingle(): Promise<void> {
    const folder = mode === "local" ? currentPath : panes[0].intranetFolder
    const displayPath = mode === "local"
      ? `local:${currentPath || panes[0].localRoot?.name || "/"}`
      : `nas:${panes[0].intranetFolder || "/"}`
    await persistStorageSelection(mode, folder, displayPath)
    // Also persist IndexedDB handle for local mode
    if (mode === "local" && panes[0].localRoot) {
      const folderId = "regminder-local-folder-v1"
      await saveDirectoryHandle(folderId, panes[0].localRoot as unknown as FileSystemDirectoryHandle)
    }
  }

  // ── Phase 7 Handlers ─────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const handleBatchDelete = async () => {
    const ids = selectedIds
    const allItems = mode === "local" ? activePane.localItems : activePane.intranetItems
    const toDelete = allItems.filter(e => ids.has(e.id))
    toDelete.forEach(e => { addToBin(e, activePane.id, mode); logAudit("delete", e.path || e.name) })
    if (mode === "local" && localCurrent?.removeEntry) {
      for (const e of toDelete) { try { await localCurrent.removeEntry(e.name, { recursive: e.kind === "folder" }) } catch {/*permission*/} }
    }
    setPanes(prev => prev.map(p => p.id === activePane.id ? { ...p, localItems: p.localItems.filter(e => !ids.has(e.id)), intranetItems: p.intranetItems.filter(e => !ids.has(e.id)), selectedEntry: null } : p))
    setSelectedIds(new Set()); setPreview({ status: "idle", content: "" })
    logAudit("batch_delete", `${toDelete.length} items`)
  }

  const handleRename = async () => {
    if (!showRenameDialog || !renameText.trim()) return
    const { entry } = showRenameDialog
    logAudit("rename", `${entry.name} → ${renameText}`)
    if (mode === "local" && localCurrent) {
      try {
        const entryHandle = entry.handle
        const file = entryHandle?.kind === "file" ? await (entryHandle as BrowserFileHandle).getFile() : undefined
        const newHandle = await localCurrent.getFileHandle(renameText, { create: true })
        if (file && newHandle.createWritable) { const w = await newHandle.createWritable(); await w.write(await file.arrayBuffer()); await w.close() }
        if (localCurrent.removeEntry) await localCurrent.removeEntry(entry.name)
      } catch {/*fallback*/}
    }
    setPanes(prev => prev.map(p => p.id === activePane.id ? {
      ...p, localItems: p.localItems.map(e => e.id === entry.id ? { ...e, name: renameText, path: joinFolder(parentFolder(e.path), renameText) } : e),
      intranetItems: p.intranetItems.map(e => e.id === entry.id ? { ...e, name: renameText } : e)
    } : p))
    setShowRenameDialog(null); setRenameText("")
  }

  const handleNewFolder = async () => {
    if (!newFolderName.trim()) return
    if (mode === "local" && localCurrent) {
      try { await localCurrent.getDirectoryHandle(newFolderName, { create: true }) } catch {/*exists*/}
    }
    const newEntry: StorageEntry = { id: `folder-${Date.now()}`, name: newFolderName, kind: "folder", path: joinFolder(currentPath, newFolderName), updatedAt: new Date().toISOString() }
    setPanes(prev => prev.map(p => p.id === activePane.id ? { ...p, localItems: [...p.localItems, newEntry], intranetItems: [...p.intranetItems, newEntry] } : p))
    setShowNewFolderDialog(false); setNewFolderName("")
    logAudit("new_folder", newFolderName)
  }

  const handleConvertFile = async () => {
    if (!showConvertDialog) return
    const { entry } = showConvertDialog
    logAudit("convert", `${entry.name} to ${convertFormat}`)
    alert(`Conversion of "${entry.name}" to ${convertFormat.toUpperCase()} would be handled by a backend service.`)
    setShowConvertDialog(null)
  }

  const handleShareFile = () => {
    if (!showShareDialog) return
    logAudit("share", `${showShareDialog.entry.name} → ${shareEmail} (${sharePermission})`)
    alert(`Shared "${showShareDialog.entry.name}" with ${shareEmail} as ${sharePermission}-only.`)
    setShowShareDialog(null); setShareEmail("")
  }

  const handleEntryContextMenu = (e: React.MouseEvent, entry: StorageEntry) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, entry })
  }

  const handleDeleteEntry = async (entry: StorageEntry) => {
    setCtxMenu(null)
    addToBin(entry, activePane.id, mode)
    logAudit("delete", entry.path || entry.name)
    if (mode === "local" && localCurrent?.removeEntry) {
      try { await localCurrent.removeEntry(entry.name, { recursive: entry.kind === "folder" }) } catch {/*permission*/}
    }
    setPanes(prev => prev.map(p => p.id === activePane.id ? {
      ...p, localItems: p.localItems.filter(e => e.id !== entry.id), intranetItems: p.intranetItems.filter(e => e.id !== entry.id), selectedEntry: null
    } : p))
    setPreview({ status: "idle", content: "" })
  }

  const handleNewDocument = async () => {
    const name = `Document ${Date.now()}.docx`
    if (mode === "local" && localCurrent) {
      try {
        const handle = await localCurrent.getFileHandle(name, { create: true })
        if (handle.createWritable) { const w = await handle.createWritable(); await w.write(""); await w.close() }
        const file = await handle.getFile()
        const entry: StorageEntry = { id: `/${name}-${file.lastModified}`, name, kind: "file", path: joinFolder(currentPath, name), updatedAt: new Date().toISOString(), size: 0, handle }
        setPanes(prev => prev.map(p => p.id === activePane.id ? { ...p, localItems: [...p.localItems, entry] } : p))
      } catch {/*fallback*/}
    } else {
      const entry: StorageEntry = { id: `doc-${Date.now()}`, name, kind: "file", path: joinFolder(currentPath, name), updatedAt: new Date().toISOString(), size: 0 }
      setPanes(prev => prev.map(p => p.id === activePane.id ? { ...p, localItems: [...p.localItems, entry], intranetItems: [...p.intranetItems, entry] } : p))
    }
    logAudit("new_document", name)
  }

  const handleNewSpreadsheet = async () => {
    const name = `Spreadsheet ${Date.now()}.xlsx`
    if (mode === "local" && localCurrent) {
      try {
        const handle = await localCurrent.getFileHandle(name, { create: true })
        if (handle.createWritable) { const w = await handle.createWritable(); await w.write(""); await w.close() }
        const file = await handle.getFile()
        const entry: StorageEntry = { id: `/${name}-${file.lastModified}`, name, kind: "file", path: joinFolder(currentPath, name), updatedAt: new Date().toISOString(), size: 0, handle }
        setPanes(prev => prev.map(p => p.id === activePane.id ? { ...p, localItems: [...p.localItems, entry] } : p))
      } catch {/*fallback*/}
    } else {
      const entry: StorageEntry = { id: `xls-${Date.now()}`, name, kind: "file", path: joinFolder(currentPath, name), updatedAt: new Date().toISOString(), size: 0 }
      setPanes(prev => prev.map(p => p.id === activePane.id ? { ...p, localItems: [...p.localItems, entry], intranetItems: [...p.intranetItems, entry] } : p))
    }
    logAudit("new_spreadsheet", name)
  }

  const DOC_EXTENSIONS = [
    { label: "Word (.docx)", ext: "docx" },
    { label: "Word 97-2003 (.doc)", ext: "doc" },
    { label: "Plain Text (.txt)", ext: "txt" },
    { label: "Rich Text (.rtf)", ext: "rtf" },
    { label: "Markdown (.md)", ext: "md" },
    { label: "HTML (.html)", ext: "html" },
    { label: "JSON (.json)", ext: "json" },
  ]
  const SHEET_EXTENSIONS = [
    { label: "Excel (.xlsx)", ext: "xlsx" },
    { label: "Excel 97-2003 (.xls)", ext: "xls" },
    { label: "CSV (.csv)", ext: "csv" },
    { label: "TSV (.tsv)", ext: "tsv" },
    { label: "Plain Text (.txt)", ext: "txt" },
  ]

  function openNewFileDialog(type: "document" | "spreadsheet") {
    setShowNewMenu(false)
    const folder = mode === "local" ? currentPath : panes[0].intranetFolder
    setNewFileFolder(folder || "/")
    setNewFileName(type === "document" ? "Untitled Document" : "Untitled Spreadsheet")
    setNewFileExt(type === "document" ? "docx" : "xlsx")
    setShowNewFileDialog(type)
  }

  async function handleCreateNewFile() {
    if (!newFileName.trim() || !newFileExt) return
    const type = showNewFileDialog
    if (!type) return
    const fullName = `${newFileName.trim()}.${newFileExt}`
    if (mode === "local" && localCurrent) {
      try {
        const handle = await localCurrent.getFileHandle(fullName, { create: true })
        if (handle.createWritable) { const w = await handle.createWritable(); await w.write(""); await w.close() }
        const file = await handle.getFile()
        const entry: StorageEntry = { id: `/${fullName}-${file.lastModified}`, name: fullName, kind: "file", path: joinFolder(currentPath, fullName), updatedAt: new Date().toISOString(), size: 0, handle }
        setPanes(prev => prev.map(p => p.id === activePane.id ? { ...p, localItems: [...p.localItems, entry] } : p))
      } catch {/*fallback*/}
    } else {
      const entry: StorageEntry = { id: `${type}-${Date.now()}`, name: fullName, kind: "file", path: joinFolder(currentPath, fullName), updatedAt: new Date().toISOString(), size: 0 }
      setPanes(prev => prev.map(p => p.id === activePane.id ? { ...p, localItems: [...p.localItems, entry], intranetItems: [...p.intranetItems, entry] } : p))
    }
    logAudit(`new_${type}`, fullName)
    setShowNewFileDialog(null)
    setNewFileName("")
    setNewFileExt("")
  }

  const handleRestoreFromBin = (binEntry: BinEntry) => {
    const bin = loadJson<BinEntry[]>(savedBinKey, []).filter(b => b.entry.id !== binEntry.entry.id)
    saveJson(savedBinKey, bin)
    setPanes(prev => prev.map(p => p.id === binEntry.paneId ? { ...p, localItems: [...p.localItems, binEntry.entry], intranetItems: [...p.intranetItems, binEntry.entry] } : p))
    logAudit("restore", binEntry.entry.name)
    setShowBin(false)
  }

  const handlePermanentDelete = (binEntry: BinEntry) => {
    const bin = loadJson<BinEntry[]>(savedBinKey, []).filter(b => b.entry.id !== binEntry.entry.id)
    saveJson(savedBinKey, bin)
    logAudit("permanent_delete", binEntry.entry.name)
    setShowBin(false)
  }

  const sortedItems = useMemo(() => {
    const items = [...visibleItems]
    items.sort((a, b) => {
      const va = sortBy === "name" ? a.name.toLowerCase() : sortBy === "size" ? (a.size ?? 0) : sortBy === "date" ? (a.updatedAt ?? "") : a.kind
      const vb = sortBy === "name" ? b.name.toLowerCase() : sortBy === "size" ? (b.size ?? 0) : sortBy === "date" ? (b.updatedAt ?? "") : b.kind
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))
      return sortAsc ? cmp : -cmp
    })
    return items
  }, [visibleItems, sortBy, sortAsc])

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
      onDragOverCapture={splitCount === 1 ? handleSingleDragOverCapture : undefined}
      onDragOver={splitCount === 1 ? handleSinglePaneDragOver : undefined}
      onDropCapture={splitCount === 1 ? handleSingleDropCapture : undefined}
      onDrop={splitCount === 1 ? (event) => { void handleSinglePaneDrop(event) } : undefined}
    >
      {splitCount === 1 ? (
        <>
          <div className="flex min-h-[64px] items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HardDrive className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">Local Storage</h1>
                <p className="truncate text-sm text-muted-foreground">
                  {storageSectionPath(currentPath, mode)}
                </p>
              </div>
            </div>
            <SplitLayoutPicker splitCount={splitCount} onSelect={(count) => setSplitCount(count)} />
          </div>

          {/* Toolbar row */}
          <div className="flex min-h-[52px] items-center gap-2 border-b border-border px-6">
            {/* Back / Up */}
            <button
              type="button"
              onClick={() => {
                if (mode === "local") {
                  const cur = panes[0].localStack[panes[0].localStack.length - 1] ?? panes[0].localRoot
                  if (panes[0].localStack.length > 1) {
                    const parentDir = panes[0].localStack[panes[0].localStack.length - 2]
                    const prefix = panes[0].localStack.slice(0, -1).map((d) => d.name).join("/")
                    setPanes((prev) =>
                      prev.map((p, i) => {
                        if (i !== 0) return p
                        const newStack = p.localStack.slice(0, -1)
                        return { ...p, localStack: newStack, selectedEntry: null }
                      })
                    )
                    // Refresh parent directory contents
                    ;(async () => {
                      const rows: StorageEntry[] = []
                      for await (const [, h] of parentDir.entries()) {
                        if (h.kind === "directory") {
                          rows.push({ id: `${prefix}/${h.name}`, name: h.name, kind: "folder", path: `${prefix}/${h.name}`, handle: h })
                        } else {
                          const f = await h.getFile()
                          rows.push({ id: `${prefix}/${f.name}-${f.lastModified}`, name: f.name, kind: "file", path: `${prefix}/${f.name}`, updatedAt: new Date(f.lastModified).toISOString(), size: f.size, handle: h })
                        }
                      }
                      rows.sort((a, b) => {
                        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
                        return a.name.localeCompare(b.name)
                      })
                      setPanes((prev) =>
                        prev.map((p, i) => (i === 0 ? { ...p, localItems: rows, localStatus: "ready" } : p))
                      )
                    })()
                  }
                } else {
                  const segs = folderSegments(panes[0].intranetFolder)
                  if (segs.length > 0) {
                    const parent = segs.slice(0, -1).join("/") || "/"
                    setPanes((prev) =>
                      prev.map((p, i) =>
                        i === 0 ? { ...p, intranetFolder: parent, selectedEntry: null } : p
                      )
                    )
                    // Trigger intranet reload for parent
                    setTimeout(() => { void loadIntranetSingle() }, 0)
                  }
                }
              }}
              disabled={
                mode === "local"
                  ? panes[0].localStack.length <= 1
                  : folderSegments(panes[0].intranetFolder).length === 0
              }
              className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-default"
              title="Go to parent folder"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* New dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNewMenu(!showNewMenu)}
                className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground hover:bg-muted"
                title="New"
              >
                <FolderPlus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showNewMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-[180px] rounded-lg border border-border bg-card shadow-xl py-1 text-xs">
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                      onClick={() => { setShowNewMenu(false); setShowNewFolderDialog(true) }}
                    >
                      <FolderPlus className="h-3.5 w-3.5 text-blue-500" />
                      New Folder
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                      onClick={() => openNewFileDialog("document")}
                    >
                      <FilePlus className="h-3.5 w-3.5 text-blue-600" />
                      New Document
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                      onClick={() => openNewFileDialog("spreadsheet")}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                      New Spreadsheet
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Delete selected */}
            {selectedIds.size > 0 && (
              <button onClick={handleBatchDelete} className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-destructive hover:bg-destructive/10" title="Delete selected">
                <Trash2 className="h-4 w-4" />
                <span>({selectedIds.size})</span>
              </button>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={() => void refreshSingle()}
              className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground hover:bg-muted"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative w-full max-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={panes[0].search}
                onChange={(event) =>
                  setPanes((prev) =>
                    prev.map((p, i) =>
                      i === 0 ? { ...p, search: event.target.value } : p
                    )
                  )
                }
                placeholder="Search files..."
                className="h-8 w-full rounded border-border bg-background pl-8 text-xs"
              />
            </div>

            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as never)} className="h-8 rounded border border-border bg-background px-2 text-xs">
              <option value="name">Name</option><option value="size">Size</option><option value="date">Date</option><option value="type">Type</option>
            </select>
            <button onClick={() => setSortAsc(!sortAsc)} className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted" title={sortAsc ? "Ascending" : "Descending"}>
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-5 w-px bg-border" />

            {/* View toggle */}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              title={panes[0].viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
              onClick={() =>
                setPanes((prev) =>
                  prev.map((p, i) =>
                    i === 0 ? { ...p, viewMode: p.viewMode === "grid" ? "list" : "grid" } : p
                  )
                )
              }
            >
              {panes[0].viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
            </button>

            {/* Open Folder */}
            <Button size="sm" onClick={chooseLocalFolderSingle} className="h-8 px-3 text-xs font-medium">
              Open Folder
            </Button>
          </div>

          <div className="flex h-full min-h-0 flex-1 overflow-hidden">
            {/* Upload input (hidden) */}
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                void uploadFilesSingle(event.target.files)
                event.target.value = ""
              }}
            />

            {/* Main file area */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-auto px-5 py-4">
                {sortedItems.length === 0 ? (
                  <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                    {mode === "local"
                      ? "Choose a local folder to begin."
                      : "No files or folders found."}
                  </div>
                ) : panes[0].viewMode === "grid" ? (
                  <div className="flex flex-wrap content-start gap-x-4 gap-y-3">
                    {sortedItems.map((entry) => (
                      <div key={entry.id} onContextMenu={(e) => handleEntryContextMenu(e, entry)}>
                      <FileTile
                        entry={entry}
                        selected={panes[0].selectedEntry?.id === entry.id || selectedIds.has(entry.id)}
                        draggable={entry.kind === "file"}
                        onPrepareDrag={() => prepareSingleDesktopDrag(entry)}
                        onDragStart={(event) => handleSingleEntryDragStart(entry, event)}
                        onDragEnd={() => setDraggedEntry(null)}
                        onDragOver={entry.kind === "folder" ? handleSingleFolderDragOver : undefined}
                        onDrop={entry.kind === "folder" ? (event) => { void handleSingleFolderDrop(entry, event) } : undefined}
                        onClick={() => {
                          setPanes((prev) =>
                            prev.map((p, i) =>
                              i === 0 ? { ...p, selectedEntry: entry } : p
                            )
                          )
                          if (entry.kind === "folder") {
                            if (mode === "local") void openLocalFolderSingle(entry)
                            else openIntranetFolderSingle(entry)
                          }
                        }}
                      />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {/* List view column headers */}
                    <div
                      className="sticky top-0 z-10 grid items-center gap-2 border-b border-border bg-background/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm select-none"
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      <span />
                      <span>Name</span>
                      <span className="hidden md:flex items-center gap-1 relative">
                        Type
                        <span
                          className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-1.5 cursor-col-resize hover:bg-primary/40 rounded-full"
                          onMouseDown={(e) => startColResize(2, e)}
                        />
                      </span>
                      <span className="hidden sm:flex items-center justify-end gap-1 relative">
                        Size
                        <span
                          className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-1.5 cursor-col-resize hover:bg-primary/40 rounded-full"
                          onMouseDown={(e) => startColResize(3, e)}
                        />
                      </span>
                      <span className="hidden lg:block text-right">Date Modified</span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1">
                    {sortedItems.map((entry) => (
                      <div key={entry.id} onContextMenu={(e) => handleEntryContextMenu(e, entry)}>
                      <FileListItem
                        entry={entry}
                        selected={panes[0].selectedEntry?.id === entry.id || selectedIds.has(entry.id)}
                        draggable={entry.kind === "file"}
                        gridCols={gridCols}
                        onPrepareDrag={() => prepareSingleDesktopDrag(entry)}
                        onDragStart={(event) => handleSingleEntryDragStart(entry, event)}
                        onDragEnd={() => setDraggedEntry(null)}
                        onDragOver={entry.kind === "folder" ? handleSingleFolderDragOver : undefined}
                        onDrop={entry.kind === "folder" ? (event) => { void handleSingleFolderDrop(entry, event) } : undefined}
                        onClick={() => {
                          setPanes((prev) =>
                            prev.map((p, i) =>
                              i === 0 ? { ...p, selectedEntry: entry } : p
                            )
                          )
                          if (entry.kind === "folder") {
                            if (mode === "local") void openLocalFolderSingle(entry)
                            else openIntranetFolderSingle(entry)
                          }
                        }}
                      />
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer backdrop */}
            {panes[0].selectedEntry && panes[0].selectedEntry.kind === "file" && (
              <div
                className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-300"
                onClick={() =>
                  setPanes((prev) =>
                    prev.map((p, i) => (i === 0 ? { ...p, selectedEntry: null } : p))
                  )
                }
              />
            )}

            {/* Right preview drawer — resizable slide-in */}
            <div
              className={cn(
                "fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-out select-none",
                panes[0].selectedEntry && panes[0].selectedEntry.kind === "file"
                  ? "translate-x-0"
                  : "translate-x-full"
              )}
              style={{ width: panes[0].selectedEntry ? drawerWidth : undefined }}
            >
              {/* Drag handle on the left edge */}
              {panes[0].selectedEntry && panes[0].selectedEntry.kind === "file" && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-primary/40 z-10"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    drawerResizeRef.current = { startX: e.clientX, startW: drawerWidth }
                  }}
                />
              )}
              {panes[0].selectedEntry && panes[0].selectedEntry.kind === "file" && (
                <>
                  <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                        {getMacFileIconSmall(panes[0].selectedEntry.name, panes[0].selectedEntry.kind).icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{panes[0].selectedEntry.name}</p>
                        <p className="text-[11px] text-muted-foreground">{getMacFileIconSmall(panes[0].selectedEntry.name, panes[0].selectedEntry.kind).typeLabel}</p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setPanes((prev) =>
                          prev.map((p, i) => (i === 0 ? { ...p, selectedEntry: null } : p))
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-5">
                    {preview.status === "loading" ? (
                      <div className="flex items-center justify-center py-20 text-xs text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading preview...
                      </div>
                    ) : preview.status === "error" ? (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                        <p className="text-xs text-destructive">{preview.content}</p>
                      </div>
                    ) : preview.status === "ready" && preview.kind === "pdf" ? (
                      <div className="flex h-full min-h-0 flex-col gap-3">
                        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
                          <RegminderUiPdfViewer documentSource={`data:application/pdf;base64,${preview.content}`} className="h-full min-h-[500px]" />
                        </div>
                        {preview.note && (
                          <div className="text-[11px] text-muted-foreground">{preview.note}</div>
                        )}
                      </div>
                    ) : preview.status === "ready" ? (
                      <div className="space-y-4">
                        {/* File metadata */}
                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background p-4">
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-0.5">Type</div>
                            <div className="text-xs font-medium">{getMacFileIconSmall(panes[0].selectedEntry.name, panes[0].selectedEntry.kind).typeLabel}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-0.5">Size</div>
                            <div className="text-xs font-medium">{formatSize(panes[0].selectedEntry.size)}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-[11px] text-muted-foreground mb-0.5">Modified</div>
                            <div className="text-xs font-medium">{formatDate(panes[0].selectedEntry.updatedAt)}</div>
                          </div>
                        </div>
                        {/* Text preview */}
                        <div className="rounded-lg border border-border bg-background p-4">
                          <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted-foreground font-mono">
                            {preview.content.slice(0, 8000)}
                            {preview.content.length > 8000 ? "\n\n...truncated" : ""}
                          </pre>
                        </div>
                        {preview.note && (
                          <div className="text-[11px] text-muted-foreground">{preview.note}</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Context Menu */}
          {ctxMenu && (
            <div className="fixed inset-0 z-[60]" onClick={() => setCtxMenu(null)}>
              <div
                className="absolute w-[180px] rounded-lg border border-border bg-card shadow-xl py-1 text-xs"
                style={{ left: Math.min(ctxMenu.x, window.innerWidth - 190), top: Math.min(ctxMenu.y, window.innerHeight - 120) }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[11px] text-muted-foreground truncate border-b border-border/50">
                  {ctxMenu.entry.name}
                </div>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                  onClick={() => {
                    setCtxMenu(null)
                    setShowRenameDialog({ entry: ctxMenu.entry })
                    setRenameText(ctxMenu.entry.name)
                  }}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  Rename
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-destructive/10 text-destructive text-left"
                  onClick={() => { void handleDeleteEntry(ctxMenu.entry) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* New File Dialog */}
          {showNewFileDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewFileDialog(null)}>
              <div className="w-[420px] rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  New {showNewFileDialog === "document" ? "Document" : "Spreadsheet"}
                </h3>

                {/* Folder path */}
                <div className="mb-3">
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Location</label>
                  <Input
                    value={newFileFolder}
                    onChange={(e) => setNewFileFolder(e.target.value)}
                    placeholder="e.g. /home/user/docs"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                {/* File name */}
                <div className="mb-3">
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">File Name</label>
                  <Input
                    autoFocus
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { void handleCreateNewFile() } else if (e.key === "Escape") { setShowNewFileDialog(null) } }}
                    placeholder="Enter file name"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Extension selector */}
                <div className="mb-4">
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">File Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(showNewFileDialog === "document" ? DOC_EXTENSIONS : SHEET_EXTENSIONS).map((opt) => (
                      <button
                        key={opt.ext}
                        type="button"
                        onClick={() => setNewFileExt(opt.ext)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] text-left transition-colors",
                          newFileExt === opt.ext
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", newFileExt === opt.ext ? "bg-primary" : "bg-border")} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">Preview: </span>
                  <span className="text-[11px] font-mono font-medium text-foreground">
                    {newFileName.trim() || "untitled"}.{newFileExt}
                  </span>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowNewFileDialog(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => { void handleCreateNewFile() }} disabled={!newFileName.trim()}>
                    Create
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* New Folder Dialog */}
          {showNewFolderDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewFolderDialog(false)}>
              <div className="w-[360px] rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-foreground mb-4">New Folder</h3>
                <Input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { void handleNewFolder() } else if (e.key === "Escape") { setShowNewFolderDialog(false) } }}
                  placeholder="Folder name"
                  className="h-9 text-sm"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setShowNewFolderDialog(false)}>Cancel</Button>
                  <Button size="sm" onClick={() => { void handleNewFolder() }}>Create</Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : splitCount === 2 ? (
        /* 2-pane resizable split */
        <div className="flex h-full min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="min-w-0">
            <ResizablePanel defaultSize={50} minSize={30}>
              <LocalPaneController
                paneId={paneSlots[0].id}
                pane={paneSlots[0]}
                allPanes={panes}
                splitCount={2}
                mode={mode}
                draggedEntry={draggedEntry}
                onActivateLocalMode={activateLocalMode}
                onClosePane={closePane}
                onEntryDragStart={setDraggedEntry}
                onEntryDragEnd={() => setDraggedEntry(null)}
                onSelectSplitCount={(count) => setSplitCount(count)}
                onUpdatePane={(fn) => setPanes(fn)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={30}>
              <LocalPaneController
                paneId={paneSlots[1].id}
                pane={paneSlots[1]}
                allPanes={panes}
                splitCount={2}
                mode={mode}
                draggedEntry={draggedEntry}
                onActivateLocalMode={activateLocalMode}
                onClosePane={closePane}
                onEntryDragStart={setDraggedEntry}
                onEntryDragEnd={() => setDraggedEntry(null)}
                onSelectSplitCount={(count) => setSplitCount(count)}
                onUpdatePane={(fn) => setPanes(fn)}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ) : splitCount === 3 ? (
        /* 3-pane layout: left half full width, right half split top/bottom */
        <div className="flex h-full min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="min-w-0">
            <ResizablePanel defaultSize={40} minSize={25}>
              <LocalPaneController
                paneId={paneSlots[0].id}
                pane={paneSlots[0]}
                allPanes={panes}
                splitCount={3}
                mode={mode}
                draggedEntry={draggedEntry}
                onActivateLocalMode={activateLocalMode}
                onClosePane={closePane}
                onEntryDragStart={setDraggedEntry}
                onEntryDragEnd={() => setDraggedEntry(null)}
                onSelectSplitCount={(count) => setSplitCount(count)}
                onUpdatePane={(fn) => setPanes(fn)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={60} minSize={35}>
              <ResizablePanelGroup direction="vertical" className="min-w-0">
                <ResizablePanel defaultSize={50} minSize={30}>
                  <LocalPaneController
                    paneId={paneSlots[1].id}
                    pane={paneSlots[1]}
                    allPanes={panes}
                    splitCount={3}
                    mode={mode}
                    draggedEntry={draggedEntry}
                    onActivateLocalMode={activateLocalMode}
                    onClosePane={closePane}
                    onEntryDragStart={setDraggedEntry}
                    onEntryDragEnd={() => setDraggedEntry(null)}
                    onSelectSplitCount={(count) => setSplitCount(count)}
                    onUpdatePane={(fn) => setPanes(fn)}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={30}>
                  <LocalPaneController
                    paneId={paneSlots[2].id}
                    pane={paneSlots[2]}
                    allPanes={panes}
                    splitCount={3}
                    mode={mode}
                    draggedEntry={draggedEntry}
                    onActivateLocalMode={activateLocalMode}
                    onClosePane={closePane}
                    onEntryDragStart={setDraggedEntry}
                    onEntryDragEnd={() => setDraggedEntry(null)}
                    onSelectSplitCount={(count) => setSplitCount(count)}
                    onUpdatePane={(fn) => setPanes(fn)}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ) : (
        /* 4-pane layout: 2×2 grid with resizable horizontal + vertical handles */
        <div className="flex h-full min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="min-w-0">
            <ResizablePanel defaultSize={50} minSize={25}>
              <ResizablePanelGroup direction="vertical" className="min-w-0">
                <ResizablePanel defaultSize={50} minSize={25}>
                  <LocalPaneController
                    paneId={paneSlots[0].id}
                    pane={paneSlots[0]}
                    allPanes={panes}
                    splitCount={4}
                    mode={mode}
                    draggedEntry={draggedEntry}
                    onActivateLocalMode={activateLocalMode}
                    onClosePane={closePane}
                    onEntryDragStart={setDraggedEntry}
                    onEntryDragEnd={() => setDraggedEntry(null)}
                    onSelectSplitCount={(count) => setSplitCount(count)}
                    onUpdatePane={(fn) => setPanes(fn)}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={25}>
                  <LocalPaneController
                    paneId={paneSlots[1].id}
                    pane={paneSlots[1]}
                    allPanes={panes}
                    splitCount={4}
                    mode={mode}
                    draggedEntry={draggedEntry}
                    onActivateLocalMode={activateLocalMode}
                    onClosePane={closePane}
                    onEntryDragStart={setDraggedEntry}
                    onEntryDragEnd={() => setDraggedEntry(null)}
                    onSelectSplitCount={(count) => setSplitCount(count)}
                    onUpdatePane={(fn) => setPanes(fn)}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={25}>
              <ResizablePanelGroup direction="vertical" className="min-w-0">
                <ResizablePanel defaultSize={50} minSize={25}>
                  <LocalPaneController
                    paneId={paneSlots[2].id}
                    pane={paneSlots[2]}
                    allPanes={panes}
                    splitCount={4}
                    mode={mode}
                    draggedEntry={draggedEntry}
                    onActivateLocalMode={activateLocalMode}
                    onClosePane={closePane}
                    onEntryDragStart={setDraggedEntry}
                    onEntryDragEnd={() => setDraggedEntry(null)}
                    onSelectSplitCount={(count) => setSplitCount(count)}
                    onUpdatePane={(fn) => setPanes(fn)}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={25}>
                  <LocalPaneController
                    paneId={paneSlots[3].id}
                    pane={paneSlots[3]}
                    allPanes={panes}
                    splitCount={4}
                    mode={mode}
                    draggedEntry={draggedEntry}
                    onActivateLocalMode={activateLocalMode}
                    onClosePane={closePane}
                    onEntryDragStart={setDraggedEntry}
                    onEntryDragEnd={() => setDraggedEntry(null)}
                    onSelectSplitCount={(count) => setSplitCount(count)}
                    onUpdatePane={(fn) => setPanes(fn)}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  )
}
