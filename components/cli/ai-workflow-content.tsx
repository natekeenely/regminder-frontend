"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Bot,
  Circle,
  Clock,
  Code2,
  Database,
  FileText,
  GitBranch,
  Globe,
  Hand,
  Layers,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  Sparkles,
  Split,
  Trash2,
  User,
  Variable,
  Workflow,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ───────── Types ───────── */

interface DifyApp {
  id: string
  name: string
  description: string
  mode: "chat" | "agent-chat" | "workflow" | "completion" | "advanced-chat"
  icon_type?: string
  icon?: string
  icon_background?: string
  model_config?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

/* ── Canvas node types ── */

type NodeType =
  | "start" | "end"
  // Agent nodes — reference existing Dify apps
  | "agent"
  // Orchestration nodes
  | "condition" | "parallel" | "human-approval" | "delay" | "data-transform"

interface AgentRef {
  appId: string
  appName: string
  appMode: string
  appIcon?: string
  appIconBackground?: string
  appIconType?: string
}

interface CanvasNode {
  id: string
  type: NodeType
  label: string
  x: number
  y: number
  config: Record<string, unknown>
  agentRef?: AgentRef
}

interface CanvasEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  label?: string
}

/* ── Workflow definition (persisted) ── */

interface WorkflowDef {
  id: string
  name: string
  description: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  created_at?: string
  updated_at?: string
}

/* ───────── Constants ───────── */

const ORCH_NODE_CATALOG: Array<{ type: NodeType; label: string; icon: typeof Zap; color: string; desc: string }> = [
  { type: "condition", label: "Condition", icon: GitBranch, color: "#EE46BC", desc: "Route by output value" },
  { type: "parallel", label: "Parallel", icon: Split, color: "#06AED4", desc: "Fan-out to multiple agents" },
  { type: "human-approval", label: "Human Approval", icon: User, color: "#F79009", desc: "Pause for user review" },
  { type: "delay", label: "Delay", icon: Clock, color: "#6B7280", desc: "Wait before next step" },
  { type: "data-transform", label: "Data Map", icon: Variable, color: "#875BF7", desc: "Transform data between agents" },
]

const MODE_LABELS: Record<string, { short: string; color: string }> = {
  "chat": { short: "Manager", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30" },
  "agent-chat": { short: "Specialist", color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30" },
  "completion": { short: "TextGen", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30" },
}

/* ───────── API helpers ───────── */

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/proxy${path}`, { credentials: "include", ...init })

/* ───────── Icon rendering helper ───────── */

function AppIcon({ app, size = "md" }: { app: { icon?: string; icon_type?: string; icon_background?: string }; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-lg"

  if (app.icon_type === "image" && app.icon) {
    const src = `/api/proxy/api/v1/dify/files/${app.icon}/preview`
    return (
      <div className={cn(dim, "shrink-0 rounded-lg overflow-hidden bg-muted")}>
        <img src={src} alt="icon" className="h-full w-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={cn(dim, "shrink-0 flex items-center justify-center rounded-lg", textSize)}
      style={{ backgroundColor: app.icon_background || "#FFEAD5" }}
    >
      {app.icon ?? "🤖"}
    </div>
  )
}

/* ───────── Workflow Card ───────── */

function WorkflowCard({ app, onClick }: { app: DifyApp; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <AppIcon app={app} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{app.name}</span>
          <Badge variant="outline" className="text-[9px] shrink-0 text-blue-500">
            WORKFLOW
          </Badge>
        </div>
        {app.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{app.description}</p>
        )}
      </div>
    </button>
  )
}

/* ───────── Create Workflow Dialog ───────── */

function CreateWorkflowDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (app: DifyApp) => void }) {
  const [appName, setAppName] = useState("")
  const [appDesc, setAppDesc] = useState("")
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!appName.trim()) return
    setCreating(true)
    try {
      const resp = await api("/api/v1/dify/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: appName.trim(),
          mode: "workflow",
          description: appDesc,
          icon: "🔄",
          icon_type: "emoji",
          icon_background: "#D1E9FF",
        }),
      })
      if (resp.ok) {
        const data = await resp.json()
        onCreated(data)
        setAppName("")
        setAppDesc("")
        onClose()
      }
    } catch { /* ignore */ }
    setCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Agent Workflow</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            An agent workflow connects your Manager and Specialist agents into an automated pipeline.
          </p>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Workflow Name</label>
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="e.g. Customer Onboarding Pipeline" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Description <span className="text-muted-foreground font-normal">(Optional)</span></label>
            <Textarea value={appDesc} onChange={(e) => setAppDesc(e.target.value)} placeholder="Describe what this workflow automates" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!appName.trim() || creating}>
            {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───────── Canvas Node Component ───────── */

function CanvasNodeComponent({
  node,
  selected,
  onSelect,
  onDragStart,
}: {
  node: CanvasNode
  selected: boolean
  onSelect: () => void
  onDragStart: (e: React.MouseEvent) => void
}) {
  const isTerminal = node.type === "start" || node.type === "end"
  const isAgent = node.type === "agent"
  const orchEntry = ORCH_NODE_CATALOG.find((n) => n.type === node.type)

  // Agent node colors
  const modeInfo = isAgent ? MODE_LABELS[node.agentRef?.appMode ?? ""] : null

  return (
    <div
      className={cn(
        "absolute flex flex-col rounded-xl border-2 bg-card shadow-md cursor-move select-none transition-shadow",
        selected ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border hover:border-primary/30",
        isTerminal ? "w-[120px]" : isAgent ? "w-[220px]" : "w-[180px]",
      )}
      style={{ left: node.x, top: node.y }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(); onDragStart(e) }}
    >
      {/* Header */}
      {isTerminal ? (
        <div className="flex items-center justify-center gap-2 rounded-[10px] px-3 py-3 bg-muted/50">
          <Circle className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">{node.label}</span>
        </div>
      ) : isAgent ? (
        <>
          <div className="flex items-center gap-2.5 rounded-t-[10px] px-3 py-2.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/10">
            {node.agentRef?.appIcon ? (
              <div
                className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-sm"
                style={{ backgroundColor: node.agentRef.appIconBackground || "#FFEAD5" }}
              >
                {node.agentRef.appIcon}
              </div>
            ) : (
              <Bot className="h-5 w-5 shrink-0 text-blue-500" />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-foreground truncate block">{node.label}</span>
              {modeInfo && (
                <span className={cn("text-[9px] font-medium px-1.5 py-0 rounded-full", modeInfo.color)}>
                  {modeInfo.short}
                </span>
              )}
            </div>
          </div>
          {/* Agent description hint */}
          <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/50">
            {node.config.inputMapping ? "Input mapped" : "Click to configure I/O"}
          </div>
        </>
      ) : (
        <>
          <div
            className="flex items-center gap-2 rounded-t-[10px] px-3 py-2"
            style={{ backgroundColor: (orchEntry?.color ?? "#6B7280") + "18" }}
          >
            {orchEntry ? (
              <orchEntry.icon className="h-4 w-4 shrink-0" style={{ color: orchEntry.color }} />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="text-xs font-semibold truncate" style={{ color: orchEntry?.color }}>{node.label}</span>
          </div>
          <div className="px-3 py-2 text-[10px] text-muted-foreground">
            {node.type === "condition" && (node.config.expression as string || "No condition set")}
            {node.type === "parallel" && `Fan-out: ${(node.config.branches as number) ?? 2} branches`}
            {node.type === "human-approval" && (node.config.message as string || "Awaiting approval")}
            {node.type === "delay" && `Wait ${(node.config.seconds as number) ?? 0}s`}
            {node.type === "data-transform" && "Field mapping"}
          </div>
        </>
      )}

      {/* Connection ports */}
      {node.type !== "start" && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-border bg-card" />
      )}
      {node.type !== "end" && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-primary bg-card" />
      )}
      {/* Condition: extra output port for "else" */}
      {node.type === "condition" && (
        <div className="absolute -right-2 top-3/4 h-3.5 w-3.5 rounded-full border-2 border-orange-400 bg-card" title="Else branch" />
      )}
    </div>
  )
}

/* ───────── Canvas Edge SVG ───────── */

function CanvasEdgeSvg({ edge, nodes }: { edge: CanvasEdge; nodes: CanvasNode[] }) {
  const source = nodes.find((n) => n.id === edge.source)
  const target = nodes.find((n) => n.id === edge.target)
  if (!source || !target) return null

  const isTerminal = (t: string) => t === "start" || t === "end"
  const sw = isTerminal(source.type) ? 120 : source.type === "agent" ? 220 : 180
  const tw = isTerminal(target.type) ? 120 : target.type === "agent" ? 220 : 180

  const x1 = source.x + sw + 8
  const y1 = source.y + 24
  const x2 = target.x - 8
  const y2 = target.y + 24
  const cx = (x1 + x2) / 2

  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={2}
      />
      <polygon
        points={`${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`}
        fill="hsl(var(--border))"
      />
      {edge.label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
          {edge.label}
        </text>
      )}
    </g>
  )
}

/* ───────── Agent Picker Sidebar ───────── */

function AgentPickerSidebar({ agents, onAddAgent, onAddOrchNode }: {
  agents: DifyApp[]
  onAddAgent: (agent: DifyApp) => void
  onAddOrchNode: (type: NodeType) => void
}) {
  const [search, setSearch] = useState("")

  const filtered = agents.filter((a) => {
    if (!search) return true
    return a.name.toLowerCase().includes(search.toLowerCase())
  })

  // Group agents by mode
  const managers = filtered.filter(a => a.mode === "chat")
  const specialists = filtered.filter(a => a.mode === "agent-chat")
  const textgens = filtered.filter(a => a.mode === "completion")

  return (
    <div className="w-56 border-r border-border bg-card overflow-auto flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-7 pl-7 text-xs" placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Agents — Managers */}
        {managers.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Bot className="h-3 w-3" /> Managers
            </div>
            <div className="space-y-1">
              {managers.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onAddAgent(a)}
                  className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                >
                  <AppIcon app={a} size="sm" />
                  <span className="text-xs font-medium truncate">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Agents — Specialists */}
        {specialists.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Specialists
            </div>
            <div className="space-y-1">
              {specialists.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onAddAgent(a)}
                  className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                >
                  <AppIcon app={a} size="sm" />
                  <span className="text-xs font-medium truncate">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text Generators */}
        {textgens.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Text Generators
            </div>
            <div className="space-y-1">
              {textgens.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onAddAgent(a)}
                  className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                >
                  <AppIcon app={a} size="sm" />
                  <span className="text-xs font-medium truncate">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {search ? "No agents match" : "No agents created yet. Build agents in the Agents page first."}
          </p>
        )}

        {/* Orchestration Nodes */}
        <div className="pt-2 border-t border-border">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Orchestration
          </div>
          <div className="space-y-1">
            {ORCH_NODE_CATALOG.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.type}
                  onClick={() => onAddOrchNode(item.type)}
                  className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
                  <div>
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── Node Config Panel ───────── */

function NodeConfigPanel({ node, nodes, edges, onUpdateConfig, onUpdateEdges, onDelete, onClose }: {
  node: CanvasNode
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  onUpdateConfig: (config: Record<string, unknown>) => void
  onUpdateEdges: (edges: CanvasEdge[]) => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div className="w-72 border-l border-border bg-card overflow-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{node.label}</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Agent node config */}
        {node.type === "agent" && node.agentRef && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <AppIcon app={{ icon: node.agentRef.appIcon, icon_type: node.agentRef.appIconType, icon_background: node.agentRef.appIconBackground }} size="sm" />
                <div>
                  <div className="text-xs font-semibold">{node.agentRef.appName}</div>
                  <Badge variant="outline" className="text-[8px] px-1 py-0">
                    {MODE_LABELS[node.agentRef.appMode]?.short ?? node.agentRef.appMode}
                  </Badge>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                This agent is configured in the Agents page. The workflow passes input to it and receives its output.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Input Variable Name</label>
              <Input
                value={(node.config.inputVar as string) || "input"}
                onChange={(e) => onUpdateConfig({ ...node.config, inputVar: e.target.value })}
                placeholder="input"
                className="text-xs h-8"
              />
              <p className="text-[10px] text-muted-foreground mt-1">The variable passed to this agent from the previous step</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Output Variable Name</label>
              <Input
                value={(node.config.outputVar as string) || "output"}
                onChange={(e) => onUpdateConfig({ ...node.config, outputVar: e.target.value })}
                placeholder="output"
                className="text-xs h-8"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Name for this agent&apos;s response in the workflow context</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Override Prompt (Optional)</label>
              <Textarea
                value={(node.config.overridePrompt as string) || ""}
                onChange={(e) => onUpdateConfig({ ...node.config, overridePrompt: e.target.value })}
                placeholder="Additional instructions for this step..."
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
        )}

        {/* Condition node config */}
        {node.type === "condition" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Condition Expression</label>
              <Textarea
                value={(node.config.expression as string) || ""}
                onChange={(e) => onUpdateConfig({ ...node.config, expression: e.target.value })}
                placeholder={'e.g. {{prev_output}} contains "approved"'}
                rows={3}
                className="text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              If true → top output port (primary). If false → bottom output port (else).
            </p>
          </div>
        )}

        {/* Parallel node config */}
        {node.type === "parallel" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Merge Strategy</label>
              <Select
                value={(node.config.mergeStrategy as string) || "wait-all"}
                onValueChange={(v) => onUpdateConfig({ ...node.config, mergeStrategy: v })}
              >
                <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wait-all">Wait for all branches</SelectItem>
                  <SelectItem value="first-success">First successful response</SelectItem>
                  <SelectItem value="majority">Majority consensus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-muted-foreground">
              All downstream agents connected to this node run simultaneously.
            </p>
          </div>
        )}

        {/* Human approval config */}
        {node.type === "human-approval" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Approval Message</label>
              <Textarea
                value={(node.config.message as string) || ""}
                onChange={(e) => onUpdateConfig({ ...node.config, message: e.target.value })}
                placeholder="Please review the following output before proceeding..."
                rows={3}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Timeout (minutes)</label>
              <Input
                type="number" min="1"
                value={(node.config.timeoutMinutes as number) ?? 60}
                onChange={(e) => onUpdateConfig({ ...node.config, timeoutMinutes: parseInt(e.target.value) })}
                className="text-xs h-8"
              />
            </div>
          </div>
        )}

        {/* Delay node config */}
        {node.type === "delay" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Delay (seconds)</label>
              <Input
                type="number" min="0"
                value={(node.config.seconds as number) ?? 5}
                onChange={(e) => onUpdateConfig({ ...node.config, seconds: parseInt(e.target.value) })}
                className="text-xs h-8"
              />
            </div>
          </div>
        )}

        {/* Data transform config */}
        {node.type === "data-transform" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Mapping (JSON)</label>
              <Textarea
                value={(node.config.mapping as string) || '{\n  "next_input": "{{prev_output.result}}"\n}'}
                onChange={(e) => onUpdateConfig({ ...node.config, mapping: e.target.value })}
                rows={5}
                className="text-xs font-mono"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Map fields from the previous step&apos;s output to the next step&apos;s input.
            </p>
          </div>
        )}

        {/* Connection management */}
        <div className="mt-6 pt-4 border-t border-border">
          <label className="text-xs font-semibold text-muted-foreground block mb-2">CONNECTIONS</label>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-muted-foreground">Connect from:</span>
              <Select
                value={edges.find((e) => e.target === node.id)?.source ?? ""}
                onValueChange={(sourceId) => {
                  const filtered = edges.filter((e) => e.target !== node.id)
                  if (sourceId) filtered.push({ id: `e-${sourceId}-${node.id}`, source: sourceId, target: node.id })
                  onUpdateEdges(filtered)
                }}
              >
                <SelectTrigger className="text-xs mt-1 h-8"><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {nodes.filter((n) => n.id !== node.id && n.type !== "end").map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Connect to:</span>
              <Select
                value={edges.find((e) => e.source === node.id)?.target ?? ""}
                onValueChange={(targetId) => {
                  const filtered = edges.filter((e) => e.source !== node.id)
                  if (targetId) filtered.push({ id: `e-${node.id}-${targetId}`, source: node.id, target: targetId })
                  onUpdateEdges(filtered)
                }}
              >
                <SelectTrigger className="text-xs mt-1 h-8"><SelectValue placeholder="Select target" /></SelectTrigger>
                <SelectContent>
                  {nodes.filter((n) => n.id !== node.id && n.type !== "start").map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── Workflow Canvas Editor ───────── */

function WorkflowCanvasEditor({ app, onBack, onDeleted }: { app: DifyApp; onBack: () => void; onDeleted: () => void }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [agents, setAgents] = useState<DifyApp[]>([])
  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: "start", type: "start", label: "START", x: 80, y: 200, config: {} },
    { id: "end", type: "end", label: "END", x: 700, y: 200, config: {} },
  ])
  const [edges, setEdges] = useState<CanvasEdge[]>([
    { id: "e-start-end", source: "start", target: "end" },
  ])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 })
  const [zoom, setZoom] = useState(1)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load available agents (non-workflow apps)
  useEffect(() => {
    ;(async () => {
      try {
        const resp = await api("/api/v1/dify/apps?limit=100")
        if (resp.ok) {
          const data = await resp.json()
          const all = (data.data ?? []) as DifyApp[]
          setAgents(all.filter((a) => a.mode === "chat" || a.mode === "agent-chat" || a.mode === "completion"))
        }
      } catch { /* ignore */ }
    })()
  }, [])

  // --- Node drag ---
  useEffect(() => {
    if (!dragState) return
    function handleMove(e: MouseEvent) {
      if (!dragState) return
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragState.nodeId
            ? { ...n, x: dragState.origX + (e.clientX - dragState.startX) / zoom, y: dragState.origY + (e.clientY - dragState.startY) / zoom }
            : n
        )
      )
    }
    function handleUp() { setDragState(null) }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp) }
  }, [dragState, zoom])

  // --- Canvas pan ---
  useEffect(() => {
    if (!isPanning) return
    function handleMove(e: MouseEvent) {
      setCanvasOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) })
    }
    function handleUp() { setIsPanning(false) }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp) }
  }, [isPanning, panStart])

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-canvas-node]")) return
    setSelectedNodeId(null)
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY, ox: canvasOffset.x, oy: canvasOffset.y })
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom((z) => Math.max(0.3, Math.min(2, z - e.deltaY * 0.001)))
  }

  function addAgentNode(agent: DifyApp) {
    const id = `agent-${Date.now()}`
    const newNode: CanvasNode = {
      id,
      type: "agent",
      label: agent.name,
      x: 300 + Math.random() * 100,
      y: 100 + Math.random() * 200,
      config: { inputVar: "input", outputVar: "output" },
      agentRef: {
        appId: agent.id,
        appName: agent.name,
        appMode: agent.mode,
        appIcon: agent.icon,
        appIconBackground: agent.icon_background,
        appIconType: agent.icon_type,
      },
    }
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeId(id)
  }

  function addOrchNode(type: NodeType) {
    const entry = ORCH_NODE_CATALOG.find((n) => n.type === type)
    if (!entry) return
    const id = `orch-${Date.now()}`
    const newNode: CanvasNode = {
      id,
      type,
      label: entry.label,
      x: 350 + Math.random() * 80,
      y: 120 + Math.random() * 180,
      config: {},
    }
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeId(id)
  }

  function deleteNode(nodeId: string) {
    if (nodeId === "start" || nodeId === "end") return
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeId(null)
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await api(`/api/v1/dify/apps/${app.id}/publish`, { method: "POST" })
    } catch { /* ignore */ }
    setPublishing(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const resp = await api(`/api/v1/dify/apps/${app.id}`, { method: "DELETE" })
      if (resp.ok) onDeleted()
    } catch { /* ignore */ }
    setDeleting(false)
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <AppIcon app={app} size="sm" />
          <div>
            <div className="text-sm font-semibold">{app.name}</div>
            <Badge variant="outline" className="text-[9px]">AGENT WORKFLOW</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Layers className="h-3 w-3" />
            {nodes.filter(n => n.type === "agent").length} agents
          </Badge>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="text-destructive hover:text-destructive h-8">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing} className="h-8">
            {publishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
            Publish
          </Button>
        </div>
      </div>

      {/* Main area: agent picker + canvas + config panel */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Agent picker sidebar */}
        <AgentPickerSidebar
          agents={agents}
          onAddAgent={addAgentNode}
          onAddOrchNode={addOrchNode}
        />

        {/* Center: Canvas */}
        <div className="flex-1 relative overflow-hidden bg-muted/20" onWheel={handleWheel} onMouseDown={handleCanvasMouseDown}>
          {/* Grid background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"
                patternTransform={`translate(${canvasOffset.x} ${canvasOffset.y}) scale(${zoom})`}>
                <circle cx="1" cy="1" r="0.8" fill="hsl(var(--border))" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Canvas content */}
          <div
            ref={canvasRef}
            className="absolute"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {/* Edges SVG */}
            <svg className="absolute" style={{ width: 3000, height: 3000, left: 0, top: 0, pointerEvents: "none" }}>
              {edges.map((edge) => (
                <CanvasEdgeSvg key={edge.id} edge={edge} nodes={nodes} />
              ))}
            </svg>

            {/* Nodes */}
            {nodes.map((node) => (
              <div key={node.id} data-canvas-node>
                <CanvasNodeComponent
                  node={node}
                  selected={selectedNodeId === node.id}
                  onSelect={() => setSelectedNodeId(node.id)}
                  onDragStart={(e) => setDragState({ nodeId: node.id, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y })}
                />
              </div>
            ))}
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-card rounded-lg border border-border shadow-sm p-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
              <Plus className="h-3 w-3" />
            </Button>
            <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}>
              <span className="text-sm font-bold">−</span>
            </Button>
          </div>
        </div>

        {/* Right: Node config panel */}
        {selectedNode && selectedNode.type !== "start" && selectedNode.type !== "end" && (
          <NodeConfigPanel
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            onUpdateConfig={(config) => setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, config } : n))}
            onUpdateEdges={setEdges}
            onDelete={() => deleteNode(selectedNode.id)}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}

/* ───────── Main Export ───────── */

export function AiWorkflowContent() {
  const [apps, setApps] = useState<DifyApp[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [selectedApp, setSelectedApp] = useState<DifyApp | null>(null)

  const loadApps = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api("/api/v1/dify/apps?limit=100")
      if (resp.ok) {
        const data = await resp.json()
        const all = (data.data ?? []) as DifyApp[]
        setApps(all.filter((a: DifyApp) => a.mode === "workflow" || a.mode === "advanced-chat"))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadApps() }, [loadApps])

  if (selectedApp) {
    return (
      <WorkflowCanvasEditor
        app={selectedApp}
        onBack={() => { setSelectedApp(null); loadApps() }}
        onDeleted={() => { setSelectedApp(null); loadApps() }}
      />
    )
  }

  const filtered = apps.filter((a) => {
    if (!search) return true
    const s = search.toLowerCase()
    return a.name.toLowerCase().includes(s) || (a.description ?? "").toLowerCase().includes(s)
  })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Workflow className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Agent Workflows</h1>
              <p className="text-xs text-muted-foreground">Connect Managers and Specialists into automated pipelines</p>
            </div>
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-52 rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-9">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Workflow
          </Button>
          <Button variant="outline" size="sm" onClick={loadApps} className="h-9">
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((app) => (
              <WorkflowCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Workflow className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {search ? `No workflows matching "${search}"` : "No agent workflows yet"}
            </p>
            <p className="text-xs mt-1">Create a workflow to orchestrate your Manager and Specialist agents</p>
            <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Workflow
            </Button>
          </div>
        )}
      </div>

      <CreateWorkflowDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(app) => {
          setSelectedApp(app)
          void loadApps()
        }}
      />
    </div>
  )
}
