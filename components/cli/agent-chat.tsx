"use client"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  Paperclip,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  status?: "pending" | "processing" | "completed" | "error"
  steps?: WorkflowStep[]
}

interface WorkflowStep {
  id: string
  label: string
  status: "pending" | "processing" | "completed" | "error"
  detail?: string
}

interface CommandExecutionResult {
  ok: boolean
  accepted: boolean
  correlationId: string
  detail: string
  selectedProvider?: string
  selectedModel?: string
  fallbackUsed?: boolean
  latencyMs?: number
  actionResult?: {
    action: string
    status: "success" | "error" | "skipped"
    detail: string
    resourceId?: string
    resourceType?: string
    provider?: string
  }
}

interface TimelineItem {
  id: string
  command: string
  timestamp: Date
  status: "success" | "error" | "processing"
  correlationId?: string
  provider?: string
  model?: string
  latencyMs?: number
  action?: string
  resourceId?: string
  detail: string
}

interface DemoRunResponse {
  ok: boolean
  runId: string
  startedAt: string
  steps: Array<{
    step: "create-task" | "send-update" | "report-draft"
    ok: boolean
    correlationId: string
    selectedProvider?: string
    selectedModel?: string
    fallbackUsed?: boolean
    latencyMs?: number
    actionResult: {
      action: string
      status: "success" | "error" | "skipped"
      detail: string
      resourceId?: string
      resourceType?: string
      provider?: string
    }
  }>
}

interface AuditEvent {
  ts: string
  event: string
  correlationId?: string
  provider?: string
  status?: string
  detail?: string
}

const getInitialMessages = (): Message[] => [
  {
    id: "1",
    role: "system",
    content: "Hermes Agent is ready. Supports both natural language and slash command interaction.",
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: "2",
    role: "user",
    content: "Create an EU CE testing project for TechCorp and assign it to Shenzhen Lab",
    timestamp: new Date(Date.now() - 45000),
  },
  {
    id: "3",
    role: "assistant",
    content: "Creating EU CE testing project for you. Here are the execution steps:",
    timestamp: new Date(Date.now() - 30000),
    status: "completed",
    steps: [
      {
        id: "s1",
        label: "Create project order",
        status: "completed",
        detail: "PRJ-2024-0892",
      },
      {
        id: "s2",
        label: "Verify CE regulation requirements",
        status: "completed",
        detail: "EN 62368-1:2020",
      },
      {
        id: "s3",
        label: "Assign to Shenzhen Lab",
        status: "completed",
        detail: "Lab-SZ-01",
      },
      {
        id: "s4",
        label: "Equipment reservation",
        status: "completed",
        detail: "EMC Chamber A",
      },
      {
        id: "s5",
        label: "Generate test report draft",
        status: "processing",
        detail: "Drafting...",
      },
    ],
  },
]

const slashCommands = [
  { command: "/lims", description: "Laboratory management commands", example: "/lims sample create" },
  { command: "/erp", description: "Enterprise resource planning commands", example: "/erp order new" },
  { command: "/pm", description: "Project management commands", example: "/pm project create" },
  { command: "/sd", description: "Service desk commands", example: "/sd ticket open" },
  { command: "/gma", description: "Global market access commands", example: "/gma regulation search EU" },
  { command: "/report", description: "Report commands", example: "/report draft" },
]

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [showCommands, setShowCommands] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isRunningDemo, setIsRunningDemo] = useState(false)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [auditLoadingFor, setAuditLoadingFor] = useState<string | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditCorrelationId, setAuditCorrelationId] = useState<string | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    setMessages(getInitialMessages())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (input.startsWith("/") && !isComposing) {
      setShowCommands(true)
    } else {
      setShowCommands(false)
    }
  }, [input, isComposing])

  useEffect(() => {
    const onExternalTimeline = (event: Event) => {
      const detail = (event as CustomEvent<Partial<TimelineItem>>).detail
      if (!detail?.command) return
      const item: TimelineItem = {
        id: detail.id ?? `ext-${Date.now()}`,
        command: detail.command,
        timestamp: new Date(),
        status: detail.status ?? "success",
        correlationId: detail.correlationId,
        provider: detail.provider,
        model: detail.model,
        latencyMs: detail.latencyMs ?? 0,
        action: detail.action,
        resourceId: detail.resourceId,
        detail: detail.detail ?? "External action completed",
      }
      setTimeline((prev) => [item, ...prev].slice(0, 10))
    }
    window.addEventListener("hermes:timeline", onExternalTimeline as EventListener)
    return () => window.removeEventListener("hermes:timeline", onExternalTimeline as EventListener)
  }, [])

  useEffect(() => {
    const onOpenAudit = (event: Event) => {
      const detail = (event as CustomEvent<{ correlationId?: string }>).detail
      if (detail?.correlationId) {
        void loadAudit(detail.correlationId)
      }
    }
    window.addEventListener("hermes:audit-open", onOpenAudit as EventListener)
    return () => window.removeEventListener("hermes:audit-open", onOpenAudit as EventListener)
  }, [])

  useEffect(() => {
    const pending = window.localStorage.getItem("hermes.audit.open.correlationId")
    if (!pending) return
    window.localStorage.removeItem("hermes.audit.open.correlationId")
    void loadAudit(pending)
  }, [])

  const handleSend = async () => {
    if (!input.trim()) return

    const commandInput = input
    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: commandInput,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    setInput("")

    if (!commandInput.trim().startsWith("/")) {
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Message received. Use slash commands for executable actions.",
          timestamp: new Date(),
          status: "completed",
        }
        setMessages((prev) => [...prev, assistantMessage])
      }, 250)
      return
    }

    setIsSending(true)
    const pendingId = `tl-${Date.now()}`
    setTimeline((prev) => [
      {
        id: pendingId,
        command: commandInput,
        timestamp: new Date(),
        status: "processing",
        detail: "Submitting command...",
      },
      ...prev,
    ])

    try {
      const resp = await fetch("/api/proxy/api/v1/cli/commands/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tic-global",
          userId: "demo-user",
          channel: "teams",
          command: commandInput,
          args: {},
        }),
      })
      const data = (await resp.json()) as CommandExecutionResult
      const ok = Boolean(data.ok)
      const action = data.actionResult?.action ?? "unknown"
      const actionStatus = data.actionResult?.status ?? (ok ? "success" : "error")

      setTimeline((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                status: ok && actionStatus !== "error" ? "success" : "error",
                correlationId: data.correlationId,
                provider: data.selectedProvider,
                model: data.selectedModel,
                latencyMs: data.latencyMs,
                action,
                resourceId: data.actionResult?.resourceId,
                detail: data.actionResult?.detail ?? data.detail,
              }
            : item
        )
      )

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.detail,
        timestamp: new Date(),
        status: ok ? "completed" : "error",
        steps: [
          {
            id: "orchestration",
            label: "AI orchestration",
            status: ok ? "completed" : "error",
            detail: `${data.selectedProvider ?? "none"} / ${data.selectedModel ?? "none"}`,
          },
          {
            id: "action",
            label: data.actionResult?.action ?? "command-action",
            status:
              data.actionResult?.status === "success"
                ? "completed"
                : data.actionResult?.status === "skipped"
                ? "pending"
                : "error",
            detail: data.actionResult?.detail ?? data.detail,
          },
        ],
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to execute command"
      setTimeline((prev) =>
        prev.map((item) => (item.id === pendingId ? { ...item, status: "error", detail } : item))
      )
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: detail,
          timestamp: new Date(),
          status: "error",
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const selectCommand = (command: string) => {
    setInput(command + " ")
    setShowCommands(false)
    inputRef.current?.focus()
  }

  const handleRunDemo = async () => {
    if (isRunningDemo) return
    setIsRunningDemo(true)
    const demoMsg: Message = {
      id: `demo-${Date.now()}`,
      role: "assistant",
      content: "Running end-to-end demo: create task -> send update -> report draft...",
      timestamp: new Date(),
      status: "processing",
    }
    setMessages((prev) => [...prev, demoMsg])

    try {
      const resp = await fetch("/api/proxy/api/v1/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tic-global",
          userId: "demo-user",
          channel: "teams",
        }),
      })
      const data = (await resp.json()) as DemoRunResponse
      const now = new Date()
      const nextTimeline: TimelineItem[] = data.steps.map((s, i) => ({
        id: `demo-step-${Date.now()}-${i}`,
        command: `/${s.step}`,
        timestamp: now,
        status: s.ok ? "success" : "error",
        correlationId: s.correlationId,
        provider: s.selectedProvider,
        model: s.selectedModel,
        latencyMs: s.latencyMs,
        action: s.actionResult.action,
        resourceId: s.actionResult.resourceId,
        detail: s.actionResult.detail,
      }))
      setTimeline((prev) => [...nextTimeline, ...prev].slice(0, 10))

      const steps: WorkflowStep[] = data.steps.map((s, i) => ({
        id: `demo-${i}`,
        label: s.step,
        status: s.ok ? "completed" : "error",
        detail: s.actionResult.resourceId ?? s.actionResult.detail,
      }))

      setMessages((prev) => [
        ...prev,
        {
          id: `demo-result-${Date.now()}`,
          role: "assistant",
          content: data.ok ? "Demo completed successfully." : "Demo completed with partial failures.",
          timestamp: new Date(),
          status: data.ok ? "completed" : "error",
          steps,
        },
      ])
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Demo run failed"
      setMessages((prev) => [
        ...prev,
        {
          id: `demo-error-${Date.now()}`,
          role: "assistant",
          content: detail,
          timestamp: new Date(),
          status: "error",
        },
      ])
    } finally {
      setIsRunningDemo(false)
    }
  }

  const loadAudit = async (correlationId?: string) => {
    if (!correlationId) return
    setAuditLoadingFor(correlationId)
    setAuditError(null)
    try {
      const resp = await fetch(`/api/proxy/api/v1/audit/${encodeURIComponent(correlationId)}`)
      const data = await resp.json()
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.detail ?? `Audit request failed (${resp.status})`)
      }
      setAuditCorrelationId(correlationId)
      setAuditEvents(Array.isArray(data.events) ? data.events : [])
    } catch (error) {
      setAuditCorrelationId(correlationId)
      setAuditEvents([])
      setAuditError(error instanceof Error ? error.message : "Failed to load audit")
    } finally {
      setAuditLoadingFor(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-3 w-3 text-success" />
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin text-primary" />
      case "pending":
        return <Clock className="h-3 w-3 text-muted-foreground" />
      case "error":
        return <AlertCircle className="h-3 w-3 text-destructive" />
      default:
        return null
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Hermes Agent</h2>
            <p className="text-xs text-muted-foreground">Natural Language + Command Interaction</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunDemo}
            disabled={isRunningDemo}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-60"
          >
            {isRunningDemo ? "Running Demo..." : "Run End-to-End Demo"}
          </button>
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-xs text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Online
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {timeline.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-card p-3">
            <div className="mb-2 text-xs font-semibold text-foreground">Execution Timeline</div>
            <div className="space-y-2">
              {timeline.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-primary">{item.command}</code>
                    <span
                      className={cn(
                        "text-[10px]",
                        item.status === "success"
                          ? "text-success"
                          : item.status === "processing"
                          ? "text-warning"
                          : "text-destructive"
                      )}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {`${item.provider ?? "none"} / ${item.model ?? "none"} | ${item.action ?? "n/a"} | ${item.latencyMs ?? 0}ms`}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{item.detail}</div>
                  {item.correlationId && (
                    <div className="mt-1">
                      <button
                        onClick={() => loadAudit(item.correlationId)}
                        disabled={auditLoadingFor === item.correlationId}
                        className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted disabled:opacity-60"
                      >
                        {auditLoadingFor === item.correlationId ? "Loading..." : "View Audit"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {(auditCorrelationId || auditError) && (
              <div className="mt-3 rounded-md border border-border/60 bg-muted/10 p-2">
                <div className="mb-1 text-[11px] font-semibold text-foreground">
                  Audit Trail {auditCorrelationId ? `(${auditCorrelationId})` : ""}
                </div>
                {auditError ? (
                  <div className="text-[10px] text-destructive">{auditError}</div>
                ) : auditEvents.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground">No events.</div>
                ) : (
                  <div className="space-y-1">
                    {auditEvents.slice(0, 20).map((event, index) => (
                      <div key={`${event.ts}-${event.event}-${index}`} className="text-[10px] text-muted-foreground">
                        <span className="text-foreground">{event.event}</span>
                        {" | "}
                        {event.provider ?? "n/a"}
                        {" | "}
                        {event.status ?? "n/a"}
                        {" | "}
                        {new Date(event.ts).toLocaleTimeString()}
                        {event.detail ? ` | ${event.detail}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              {/* Avatar - only show for non-user messages */}
              {message.role !== "user" && (
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    message.role === "assistant"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === "assistant" ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              )}

              {/* Content */}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : message.role === "assistant"
                    ? "bg-muted/50"
                    : "bg-muted/30 italic"
                )}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>

                {/* Workflow Steps */}
                {message.steps && (
                  <div className="mt-3 space-y-2 rounded-lg bg-background/50 p-3">
                    {message.steps.map((step) => (
                      <div
                        key={step.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          {getStatusIcon(step.status)}
                          <span className="text-xs text-foreground">
                            {step.label}
                          </span>
                        </div>
                        {step.detail && (
                          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {step.detail}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-2 text-[10px] text-muted-foreground">
                  {mounted ? message.timestamp.toLocaleTimeString() : ""}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Slash Commands Popup */}
      {showCommands && (
        <div className="mx-4 mb-2 rounded-lg border border-border bg-card p-2">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Available Commands
          </div>
          <div className="space-y-1">
            {slashCommands
              .filter((cmd) =>
                cmd.command.toLowerCase().includes(input.toLowerCase())
              )
              .map((cmd) => (
                <button
                  key={cmd.command}
                  onClick={() => selectCommand(cmd.command)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <div>
                    <span className="font-mono text-sm text-primary">
                      {cmd.command}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {cmd.description}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {cmd.example}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Input - Claude/ChatGPT style floating input */}
      <div className="border-t border-border bg-gradient-to-t from-background to-transparent p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="Enter message or / command..."
              className="min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span>Enter to send</span>
            <span className="text-muted-foreground/50">|</span>
            <span>/ for commands</span>
            <span className="text-muted-foreground/50">|</span>
            <span>@colleague to collaborate</span>
          </div>
        </div>
      </div>
    </div>
  )
}

