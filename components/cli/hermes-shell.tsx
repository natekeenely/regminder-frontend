"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Sidebar } from "@/components/cli/sidebar"
import { TopBar } from "@/components/cli/top-bar"
import { AgentChat } from "@/components/cli/agent-chat"
import { TaskPanel } from "@/components/cli/task-panel"
import { DashboardContent } from "@/components/cli/dashboard-content"
import { MdmContent } from "@/components/cli/mdm-content"
import { AiContent } from "@/components/cli/ai-content"
import { IamContent } from "@/components/cli/iam-content"
import { LimsContent } from "@/components/cli/lims-content"
import { ErpContent } from "@/components/cli/erp-content"
import { PmContent } from "@/components/cli/pm-content"
import { SdContent } from "@/components/cli/sd-content"
import { GmaContent } from "@/components/cli/gma-content"
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  MessageSquare,
  LayoutDashboard,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ViewMode = "dashboard" | "agent" | "split"

export function HermesShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false) // Collapsed by default
  const [viewMode, setViewMode] = useState<ViewMode>("split")
  const [activeItem, setActiveItem] = useState("dashboard")
  const [chatBubbleOpen, setChatBubbleOpen] = useState(false)
  const [chatBubblePos, setChatBubblePos] = useState({ x: 24, y: 24 })
  const [chatBubbleErrorGlow, setChatBubbleErrorGlow] = useState(false)
  const [chatPanelSide, setChatPanelSide] = useState<"left" | "right">("right")
  const shellRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; pointerX: number; pointerY: number } | null>(null)
  const dragMovedRef = useRef(false)
  const isDashboardMode = viewMode === "dashboard"
  const isMdmView = activeItem === "mdm" || activeItem.startsWith("mdm-")
  const isAiView = activeItem === "ai" || activeItem.startsWith("ai-")
  const isIamView = activeItem === "iam" || activeItem.startsWith("iam-")

  // Map sidebar menu items (parent + children) to their module content
  const moduleItemMap: Record<string, "lims" | "erp" | "pm" | "sd" | "gma"> = {
    lims: "lims", samples: "lims", tests: "lims", equipment: "lims", reports: "lims",
    erp: "erp", orders: "erp", quotations: "erp", invoices: "erp", customers: "erp",
    pm: "pm", projects: "pm", tasks: "pm", timeline: "pm", resources: "pm",
    sd: "sd", tickets: "sd", sla: "sd", kb: "sd",
    gma: "gma", regulations: "gma", standards: "gma", compliance: "gma",
  }
  const activeModule = moduleItemMap[activeItem]

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

  return (
    <div ref={shellRef} className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && <Sidebar activeItem={activeItem} onSelectItem={setActiveItem} />}

        {/* Main Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </button>
              <div className="mx-2 h-4 w-px bg-border" />
              <div className="flex rounded-md border border-border bg-card p-0.5">
                <button
                  onClick={() => setViewMode("dashboard")}
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
                  onClick={() => setViewMode("split")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                    viewMode === "split"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Maximize2 className="h-3 w-3" />
                  Split View
                </button>
                <button
                  onClick={() => setViewMode("agent")}
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
            {/* Dashboard View */}
            {(viewMode === "dashboard" || viewMode === "split") && (
              <div className={cn(
                "flex-1 overflow-hidden",
                viewMode === "split" && "border-r border-border"
              )}>
                {isIamView ? (
                  <IamContent activeItem={activeItem} />
                ) : isAiView ? (
                  <AiContent activeItem={activeItem} />
                ) : isMdmView ? (
                  <MdmContent activeItem={activeItem} />
                ) : activeModule === "lims" ? (
                  <LimsContent activeItem={activeItem} />
                ) : activeModule === "erp" ? (
                  <ErpContent activeItem={activeItem} />
                ) : activeModule === "pm" ? (
                  <PmContent activeItem={activeItem} />
                ) : activeModule === "sd" ? (
                  <SdContent activeItem={activeItem} />
                ) : activeModule === "gma" ? (
                  <GmaContent activeItem={activeItem} />
                ) : (
                  <DashboardContent />
                )}
              </div>
            )}

            {/* Agent Chat View */}
            {(viewMode === "agent" || viewMode === "split") && (
              <div className={cn(
                "overflow-hidden",
                viewMode === "split" ? "w-[400px]" : "flex-1"
              )}>
                <AgentChat />
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
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <div className="text-sm font-medium">Hermes Agent</div>
                      <button
                        onClick={() => setChatBubbleOpen(false)}
                        className="rounded border border-border p-1 text-muted-foreground hover:text-foreground"
                        title="Close chat"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="h-[520px]">
                      <AgentChat />
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
                    `fixed z-50 flex items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-xl transition ${chatBubbleOpen ? "h-11 w-11" : "h-14 w-14"}`,
                    chatBubbleErrorGlow && "animate-pulse ring-4 ring-destructive/40"
                  )}
                  style={{ left: chatBubblePos.x, top: chatBubblePos.y }}
                  title={chatBubbleErrorGlow ? "Issue detected. Click for AI help." : "Open Hermes Agent"}
                  aria-label="Open Hermes Agent"
                >
                  <Sparkles className="h-6 w-6" />
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
