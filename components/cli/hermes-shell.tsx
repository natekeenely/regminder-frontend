"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { Sidebar } from "@/components/cli/sidebar"
import { TopBar } from "@/components/cli/top-bar"
import { AgentChat } from "@/components/cli/agent-chat"
import { TaskPanel } from "@/components/cli/task-panel"
import { DashboardContent } from "@/components/cli/dashboard-content"
import { MdmContent } from "@/components/cli/mdm-content"
import { AiContent } from "@/components/cli/ai-content"
import { AiSettingsContent } from "@/components/cli/ai-settings-content"
import { AiPromptsContent } from "@/components/cli/ai-prompts-content"
import { AiAgentsContent } from "@/components/cli/ai-agents-content"
import { AiWorkflowContent } from "@/components/cli/ai-workflow-content"
import { AiUsageContent } from "@/components/cli/ai-usage-content"
import { SkillsContent } from "@/components/cli/skills-content"
import { AiKnowledgeContent } from "@/components/cli/ai-knowledge-content"
import { AiDataSourceContent } from "@/components/cli/ai-datasource-content"
import { AiPluginsContent } from "@/components/cli/ai-plugins-content"
import { AiMemoryContent } from "@/components/cli/ai-memory-content"
import { IamContent } from "@/components/cli/iam-content"
import { LimsContent } from "@/components/cli/lims-content"
import { ErpContent } from "@/components/cli/erp-content"
import { PmContent } from "@/components/cli/pm-content"
import { SdContent } from "@/components/cli/sd-content"
import { SdAdminContent } from "@/components/cli/sd-admin-content"
import { GmaContent } from "@/components/cli/gma-content"
import { LocalStorageContent } from "@/components/cli/local-storage-content"
import { CloudStorageContent } from "@/components/cli/cloud-storage-content"
import { DocumentEditorContent } from "@/components/cli/document-editor-content"
import { SpreadsheetEditorContent } from "@/components/cli/spreadsheet-editor-content"
import { PdfGeneratorContent } from "@/components/cli/pdf-generator-content"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  MessageSquare,
  LayoutDashboard,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ViewMode = "dashboard" | "agent" | "split"
type DefaultViewMode = Extract<ViewMode, "dashboard" | "agent">

const DEFAULT_VIEW_MODE_KEY = "hermes.defaultViewMode"

function readDefaultViewMode(): DefaultViewMode {
  if (typeof window === "undefined") return "dashboard"
  return window.localStorage.getItem(DEFAULT_VIEW_MODE_KEY) === "agent" ? "agent" : "dashboard"
}

export function HermesShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readDefaultViewMode() === "agent")
  const [taskPanelOpen, setTaskPanelOpen] = useState(false) // Collapsed by default
  const [viewMode, setViewMode] = useState<ViewMode>(readDefaultViewMode)
  const [activeItem, setActiveItem] = useState(() => {
    if (typeof window === "undefined") return "dashboard"
    return new URLSearchParams(window.location.search).get("view") || "dashboard"
  })
  const [chatBubbleOpen, setChatBubbleOpen] = useState(false)
  const [chatBubblePos, setChatBubblePos] = useState({ x: 24, y: 24 })
  const [chatBubbleErrorGlow, setChatBubbleErrorGlow] = useState(false)
  const [chatPanelSide, setChatPanelSide] = useState<"left" | "right">("right")
  const shellRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; pointerX: number; pointerY: number } | null>(null)
  const dragMovedRef = useRef(false)
  // Floating bubble avatar: first Dify app with image icon → default
  const [bubbleAvatar, setBubbleAvatar] = useState("/logos/hermes-avatar.png")
  useEffect(() => {
    fetch("/api/proxy/api/v1/dify/apps?limit=10")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.data?.length) return
        const apps = data.data as Array<{ icon?: string; icon_type?: string }>
        const withImage = apps.find((a) => a.icon_type === "image" && a.icon)
        if (withImage?.icon) setBubbleAvatar(`/api/proxy/api/v1/dify/files/${withImage.icon}/preview`)
      })
      .catch(() => { /* ignore */ })
  }, [])

  const isDashboardMode = viewMode === "dashboard"
  const isMdmView = activeItem === "mdm" || activeItem.startsWith("mdm-")
  const isComplianceView = activeItem === "compliance" || activeItem.startsWith("compliance-")
  const isAiView = activeItem === "ai" || activeItem.startsWith("ai-")
  const isIamView = activeItem === "iam" || activeItem.startsWith("iam-")
  const isLocalStorageView = activeItem === "local"
  const isCloudStorageView = activeItem === "cloud"
  const isDocumentEditorView = activeItem === "document-editor"
  const isSpreadsheetEditorView = activeItem === "spreadsheet-editor"
  const isPdfGeneratorView = activeItem === "pdf-generator"

  // Map sidebar menu items (parent + children) to their module content
  const moduleItemMap: Record<string, "lims" | "erp" | "pm" | "sd" | "gma"> = {
    lims: "lims", samples: "lims", tests: "lims", equipment: "lims", reports: "lims", "lims-audit": "lims",
    erp: "erp", orders: "erp", quotations: "erp", invoices: "erp", customers: "erp",
    pm: "pm", projects: "pm", tasks: "pm", timeline: "pm", resources: "pm",
    sd: "sd", "sd-tickets": "sd", "sd-sla": "sd", "sd-knowledge": "sd", "sd-ticket-category": "sd",
    "sd-brands": "sd", "sd-ticket-types": "sd",
    "sd-priorities": "sd", "sd-tags": "sd", "sd-templates": "sd", "sd-macros": "sd",
    "sd-worklog-config": "sd", "sd-csat-config": "sd", "sd-email-channels": "sd",
    "sd-signatures": "sd", "sd-languages": "sd",
    gma: "gma", regulations: "gma", standards: "gma", "gma-compliance": "gma",
  }
  const activeModule = moduleItemMap[activeItem]

  function navigateToItem(itemId: string): void {
    setActiveItem(itemId)
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (itemId === "dashboard") {
      url.searchParams.delete("view")
    } else {
      url.searchParams.set("view", itemId)
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const onPopState = () => {
      setActiveItem(new URLSearchParams(window.location.search).get("view") || "dashboard")
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (!isDashboardMode) {
      setChatBubbleOpen(false)
      return
    }
    const bubbleSize = 56
    const x = Math.max(16, window.innerWidth - bubbleSize - 24)
    const y = Math.max(80, window.innerHeight - bubbleSize - 40)
    setChatBubblePos({ x, y })
    setChatPanelSide(resolveChatPanelSide(x))
  }, [isDashboardMode])

  useEffect(() => {
    if (!isDashboardMode) return
    const onResize = () => setChatPanelSide(resolveChatPanelSide(chatBubblePos.x))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [isDashboardMode, chatBubblePos.x, chatBubbleOpen])

  useEffect(() => {
    const root = shellRef.current
    if (!root || !isDashboardMode) return
    const detectErrorSignal = () => {
      const explicitError = root.querySelector("[data-ui-error='true'], .text-destructive")
      if (explicitError) return true
      const errorRegex = /\b(error|failed|invalid|conflict|cannot|not found)\b/i
      const nodes = root.querySelectorAll("div, p, span, td")
      for (let i = 0; i < nodes.length; i += 1) {
        const text = nodes[i].textContent?.trim()
        if (!text) continue
        if (text.length > 220) continue
        if (errorRegex.test(text)) return true
      }
      return false
    }
    let timer: number | undefined
    const run = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        setChatBubbleErrorGlow(detectErrorSignal())
      }, 120)
    }
    run()
    const observer = new MutationObserver(run)
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true })
    return () => {
      observer.disconnect()
      if (timer) window.clearTimeout(timer)
    }
  }, [isDashboardMode])

  function clampBubble(nextX: number, nextY: number): { x: number; y: number } {
    const bubbleSize = 56
    const maxX = Math.max(8, window.innerWidth - bubbleSize - 8)
    const maxY = Math.max(64, window.innerHeight - bubbleSize - 8)
    return { x: Math.min(Math.max(8, nextX), maxX), y: Math.min(Math.max(64, nextY), maxY) }
  }

  function resolveChatPanelSide(bubbleX: number): "left" | "right" {
    const panelW = 420
    const gap = 12
    const bubbleW = chatBubbleOpen ? 44 : 56
    const rightStart = bubbleX + bubbleW + gap
    const rightEnd = rightStart + panelW
    return rightEnd <= window.innerWidth - 8 ? "right" : "left"
  }

  function onBubblePointerDown(e: ReactPointerEvent<HTMLButtonElement>): void {
    e.preventDefault()
    dragMovedRef.current = false
    dragRef.current = {
      startX: chatBubblePos.x,
      startY: chatBubblePos.y,
      pointerX: e.clientX,
      pointerY: e.clientY,
    }
    window.addEventListener("pointermove", onBubblePointerMove)
    window.addEventListener("pointerup", onBubblePointerUp)
  }

  function onBubblePointerMove(e: PointerEvent): void {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.pointerX
    const dy = e.clientY - drag.pointerY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMovedRef.current = true
    const next = clampBubble(drag.startX + dx, drag.startY + dy)
    setChatBubblePos(next)
    setChatPanelSide(resolveChatPanelSide(next.x))
  }

  function onBubblePointerUp(): void {
    dragRef.current = null
    window.removeEventListener("pointermove", onBubblePointerMove)
    window.removeEventListener("pointerup", onBubblePointerUp)
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onBubblePointerMove)
      window.removeEventListener("pointerup", onBubblePointerUp)
    }
  }, [])

  function renderWorkspaceContent(): ReactNode {
    if (isSpreadsheetEditorView) return <SpreadsheetEditorContent />
    if (isDocumentEditorView) return <DocumentEditorContent />
    if (isPdfGeneratorView) return <PdfGeneratorContent />
    if (isCloudStorageView) return <CloudStorageContent />
    if (isLocalStorageView) return <LocalStorageContent />
    if (isIamView) return <IamContent activeItem={activeItem} />
    if (activeItem === "ai-settings") return <AiSettingsContent />
    if (activeItem === "ai-agents") return <AiAgentsContent />
    if (activeItem === "ai-workflow") return <AiWorkflowContent />
    if (activeItem === "ai-prompts") return <AiPromptsContent />
    if (activeItem === "ai-usage") return <AiUsageContent />
    if (activeItem === "ai-skills") return <SkillsContent />
    if (activeItem === "ai-knowledge") return <AiKnowledgeContent />
    if (activeItem === "ai-plugins") return <AiPluginsContent />
    if (activeItem === "ai-datasource") return <AiDataSourceContent />
    if (activeItem === "ai-memory") return <AiMemoryContent />
    if (isAiView) return <AiContent activeItem={activeItem} />
    if (isComplianceView) return <MdmContent activeItem={activeItem} />
    if (isMdmView) return <MdmContent activeItem={activeItem} />
    if (activeModule === "lims") return <LimsContent activeItem={activeItem} />
    if (activeModule === "erp") return <ErpContent activeItem={activeItem} />
    if (activeModule === "pm") return <PmContent activeItem={activeItem} />
    if (activeModule === "sd") {
      if (activeItem === "sd-ticket-category") return <MdmContent activeItem={activeItem} />
      if (["sd-brands", "sd-ticket-types", "sd-priorities", "sd-tags", "sd-templates", "sd-macros", "sd-worklog-config", "sd-csat-config", "sd-email-channels", "sd-signatures", "sd-languages"].includes(activeItem)) {
        return <SdAdminContent activeItem={activeItem} />
      }
      return <SdContent activeItem={activeItem} />
    }
    if (activeModule === "gma") return <GmaContent activeItem={activeItem} />
    return <DashboardContent onNavigate={navigateToItem} />
  }

  return (
    <div ref={shellRef} className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <TopBar onNavigate={navigateToItem} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar activeItem={activeItem} onSelectItem={navigateToItem} collapsed={sidebarCollapsed} />

        {/* Main Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {!sidebarCollapsed ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </button>
              <div className="mx-2 h-4 w-px bg-border" />
              <div className="flex rounded-md border border-border bg-card p-0.5">
                <button
                  onClick={() => { setViewMode("dashboard"); setSidebarCollapsed(false) }}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                    viewMode === "dashboard"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutDashboard className="h-3 w-3" />
                  Dashboard
                </button>
<button
                  onClick={() => { setViewMode("agent"); setSidebarCollapsed(true) }}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                    viewMode === "agent"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-3 w-3" />
                  Agent
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTaskPanelOpen(!taskPanelOpen)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={taskPanelOpen ? "Hide Task Panel" : "Show Task Panel"}
              >
                {taskPanelOpen ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex flex-1 overflow-hidden">
            {viewMode === "split" ? (
              <ResizablePanelGroup direction="horizontal" autoSaveId="hermes-shell-split-v1" className="min-w-0">
                <ResizablePanel defaultSize={70} minSize={45} className="min-w-0">
                  <div className="h-full overflow-hidden">
                    {renderWorkspaceContent()}
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={24} maxSize={45} className="min-w-[320px]">
                  <div className="h-full overflow-hidden">
                    <AgentChat minimal viewMode={viewMode} activeModule={activeModule} />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : viewMode === "dashboard" ? (
              <div className="flex-1 overflow-hidden">
                {renderWorkspaceContent()}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <AgentChat viewMode={viewMode} activeModule={activeModule} />
              </div>
            )}

            {isDashboardMode && (
              <>
                {chatBubbleOpen && (
                  <div
                    className="fixed z-40 w-[420px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
                    style={{
                      left: chatPanelSide === "right" ? chatBubblePos.x + 44 + 12 : chatBubblePos.x - 420 - 12,
                      top: Math.max(72, chatBubblePos.y - 560 + 44),
                    }}
                  >
                    <div className="relative">
                      <button
                        onClick={() => setChatBubbleOpen(false)}
                        className="absolute right-2 top-2 z-10 rounded border border-border bg-background/80 p-1 text-muted-foreground hover:text-foreground"
                        title="Close chat"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="h-[560px]">
                        <AgentChat minimal viewMode="dashboard" activeModule={activeModule} />
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onPointerDown={onBubblePointerDown}
                  onClick={() => {
                    if (!dragMovedRef.current) {
                      const nextOpen = !chatBubbleOpen
                      setChatBubbleOpen(nextOpen)
                      setChatPanelSide(resolveChatPanelSide(chatBubblePos.x))
                    }
                  }}
                  className={cn(
                    `fixed z-50 flex items-center justify-center rounded-full border-2 border-primary/30 overflow-hidden shadow-xl transition ${chatBubbleOpen ? "h-11 w-11" : "h-14 w-14"}`,
                    chatBubbleErrorGlow && "animate-pulse ring-4 ring-destructive/40"
                  )}
                  style={{ left: chatBubblePos.x, top: chatBubblePos.y }}
                  title={chatBubbleErrorGlow ? "Issue detected. Click for AI help." : "Open Hermes Agent"}
                  aria-label="Open Hermes Agent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bubbleAvatar} alt="Hermes" className={`object-cover ${chatBubbleOpen ? "h-11 w-11" : "h-14 w-14"}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Task Panel */}
        {taskPanelOpen && <TaskPanel />}
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-1.5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Hermes TIC Platform v2.0.0</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            All systems operational
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>Tenant: TIC-Global</span>
          <span>Lab: Shenzhen-01</span>
          <span>Last sync: 30s ago</span>
        </div>
      </footer>
    </div>
  )
}
