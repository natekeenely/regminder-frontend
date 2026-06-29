"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DocEntry {
  id?: string
  name?: string
  path?: string
  updatedAt?: string
  isFolder?: boolean
  size?: number
}

function formatBytes(value?: number): string {
  if (!value) return ""
  const units = ["B", "KB", "MB", "GB"]
  let size = value
  let i = 0
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function FileManagerPanel({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<DocEntry[]>([])
  const [currentPath, setCurrentPath] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<DocEntry | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const folderUploadRef = useRef<HTMLInputElement | null>(null)

  const API_BASE = "/api/proxy/api/v1/documents"

  async function loadEntries(path: string): Promise<void> {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (path) params.set("path", path)
      const resp = await fetch(`${API_BASE}?${params.toString()}`)
      const data = await resp.json() as { ok?: boolean; items?: DocEntry[]; detail?: string }
      if (resp.ok && data.ok) {
        setEntries(data.items ?? [])
        setCurrentPath(path)
      } else {
        setMessage(data.detail ?? "Failed to load")
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  async function loadFileContent(entry: DocEntry): Promise<void> {
    if (!entry.path) return
    setSelectedFile(entry)
    setFileContent(null)
    try {
      const params = new URLSearchParams({ path: entry.path })
      const resp = await fetch(`${API_BASE}/content?${params.toString()}`)
      const data = await resp.json() as { ok?: boolean; item?: { contentBase64: string } }
      if (resp.ok && data.ok && data.item?.contentBase64) {
        setFileContent(window.atob(data.item.contentBase64))
      }
    } catch {
      setFileContent("[binary or unreadable content]")
    }
  }

  async function uploadFile(file: File, destPath: string): Promise<boolean> {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "")
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const resp = await fetch(API_BASE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: destPath, contentBase64: base64 }),
      })
      const data = await resp.json() as { ok?: boolean; detail?: string }
      return resp.ok && !!data.ok
    } catch {
      return false
    }
  }

  async function handleUpload(): Promise<void> {
    const files = uploadRef.current?.files
    if (!files || files.length === 0) return
    setLoading(true)
    let ok = 0; let fail = 0
    try {
      for (const file of Array.from(files)) {
        const destPath = currentPath ? `${currentPath}/${file.name}` : file.name
        if (await uploadFile(file, destPath)) ok++; else fail++
      }
      setMessage(ok > 0 ? `Uploaded ${ok} file${ok > 1 ? "s" : ""}${fail > 0 ? `, ${fail} failed` : ""}` : "Upload failed")
      await loadEntries(currentPath)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload error")
    } finally {
      setLoading(false)
      if (uploadRef.current) uploadRef.current.value = ""
    }
  }

  async function handleFolderUpload(): Promise<void> {
    const files = folderUploadRef.current?.files
    if (!files || files.length === 0) return
    setLoading(true)
    let ok = 0; let fail = 0
    try {
      for (const file of Array.from(files)) {
        // webkitRelativePath gives "folderName/subfolder/file.txt"
        const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name
        const destPath = currentPath ? `${currentPath}/${relPath}` : relPath
        if (await uploadFile(file, destPath)) ok++; else fail++
      }
      setMessage(ok > 0 ? `Uploaded ${ok} file${ok > 1 ? "s" : ""}${fail > 0 ? `, ${fail} failed` : ""}` : "Upload failed")
      await loadEntries(currentPath)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload error")
    } finally {
      setLoading(false)
      if (folderUploadRef.current) folderUploadRef.current.value = ""
    }
  }

  function handleDownload(): void {
    if (!fileContent || !selectedFile) return
    const blob = new Blob([fileContent])
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = selectedFile.name ?? "download"
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleFolder(path: string): void {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function navigateToFolder(path: string): void {
    void loadEntries(path)
    setSelectedFile(null)
    setFileContent(null)
  }

  function navigateUp(): void {
    const parent = currentPath.replace(/[/\\]+$/g, "").replace(/[/\\][^/\\]*$/, "")
    navigateToFolder(parent)
  }

  useEffect(() => { void loadEntries("") }, [])

  const folders = entries.filter((e) => e.isFolder)
  const files = entries.filter((e) => !e.isFolder)

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <button onClick={onClose} className="flex items-center gap-1.5 min-w-0 hover:opacity-80" title="Hide file panel">
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="truncate text-xs font-semibold text-foreground">
            {currentPath || "Files"}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => void loadEntries(currentPath)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Refresh">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="border-b border-border px-3 py-1.5 text-[10px] text-primary">{message}</div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {currentPath && (
          <button onClick={navigateUp} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
            ↑ Up
          </button>
        )}
        {selectedFile && fileContent && (
          <button onClick={handleDownload} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
            <Download className="mr-1 inline h-3 w-3" />
            DL
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => uploadRef.current?.click()} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Upload files">
          <Upload className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => folderUploadRef.current?.click()} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Upload folder">
          <FolderOpen className="h-3.5 w-3.5" />
        </button>
        <input ref={uploadRef} type="file" multiple className="hidden" onChange={() => { void handleUpload() }} />
        <input
          ref={folderUploadRef}
          type="file"
          multiple
          className="hidden"
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={() => { void handleFolderUpload() }}
        />
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {folders.map((e) => (
          <button
            key={e.id ?? e.path}
            onClick={() => navigateToFolder(e.path ?? "")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/50"
          >
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="truncate font-medium text-foreground">{e.name}</span>
          </button>
        ))}
        {files.map((e) => {
          const isSelected = selectedFile?.path === e.path
          return (
            <button
              key={e.id ?? e.path}
              onClick={() => { void loadFileContent(e) }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50",
                isSelected && "bg-primary/10"
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-foreground">{e.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {e.updatedAt ? new Date(e.updatedAt).toLocaleDateString() : ""}
                  {e.size ? ` · ${formatBytes(e.size)}` : ""}
                </div>
              </div>
            </button>
          )
        })}
        {entries.length === 0 && !loading && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">Empty folder</div>
        )}
      </div>

      {/* File preview */}
      {selectedFile && (
        <div className="border-t border-border">
          <div className="flex items-center border-b border-border/50 px-3 py-1.5">
            <span className="truncate text-[10px] font-medium text-foreground">{selectedFile.name}</span>
          </div>
          <div className="max-h-[160px] overflow-auto p-2">
            {fileContent !== null ? (
              <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-muted-foreground">
                {fileContent.slice(0, 4000)}
                {fileContent.length > 4000 ? "\n…truncated" : ""}
              </pre>
            ) : (
              <div className="text-[10px] text-muted-foreground">Loading…</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
