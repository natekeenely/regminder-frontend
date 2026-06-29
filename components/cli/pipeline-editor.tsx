"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BookOpen,
  BrainCircuit,
  Code2,
  Database,
  FileText,
  GitBranch,
  HelpCircle,
  Layers,
  MessageSquare,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

export interface PipelineNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  config: Record<string, any>
  inputs: string[]   // port IDs
  outputs: string[]  // port IDs
}

export interface PipelineEdge {
  id: string
  from: string       // node ID
  fromPort: string   // output port index
  to: string         // node ID
  toPort: string     // input port index
}

interface NodeTemplate {
  type: string
  label: string
  icon: React.ElementType
  category: string
  color: string       // tailwind color class for icon bg
  defaultConfig: Record<string, any>
}

/* ═══════════════════════════════════════════════════════════
   Node Catalogue
   ═══════════════════════════════════════════════════════════ */

const NODE_CATEGORIES = [
  { key: "source", label: "Data Source" },
  { key: "transform", label: "Transform" },
  { key: "ai", label: "AI / LLM" },
  { key: "logic", label: "Logic" },
  { key: "output", label: "Output" },
]

const NODE_TEMPLATES: NodeTemplate[] = [
  // Data Source
  { type: "data_source", label: "Data Source", icon: Database, category: "source", color: "bg-blue-500/15 text-blue-500", defaultConfig: { source_type: "upload" } },
  { type: "file_extractor", label: "Doc Extractor", icon: FileText, category: "source", color: "bg-blue-500/15 text-blue-500", defaultConfig: { format: "auto" } },

  // Transform
  { type: "chunk", label: "Chunk Structure", icon: Layers, category: "transform", color: "bg-violet-500/15 text-violet-500", defaultConfig: { mode: "general", chunk_size: 500, overlap: 50 } },
  { type: "clean", label: "Text Cleaner", icon: Sparkles, category: "transform", color: "bg-violet-500/15 text-violet-500", defaultConfig: { remove_urls: true, remove_emails: true } },
  { type: "template", label: "Template", icon: FileText, category: "transform", color: "bg-violet-500/15 text-violet-500", defaultConfig: { template: "" } },
  { type: "code", label: "Code", icon: Code2, category: "transform", color: "bg-violet-500/15 text-violet-500", defaultConfig: { language: "python", code: "" } },
  { type: "variable_agg", label: "Variable Aggregator", icon: GitBranch, category: "transform", color: "bg-violet-500/15 text-violet-500", defaultConfig: {} },

  // AI / LLM
  { type: "llm", label: "LLM", icon: BrainCircuit, category: "ai", color: "bg-amber-500/15 text-amber-500", defaultConfig: { model: "gpt-4o", temperature: 0.7 } },
  { type: "knowledge_retrieval", label: "Knowledge Retrieval", icon: BookOpen, category: "ai", color: "bg-amber-500/15 text-amber-500", defaultConfig: { top_k: 5, score_threshold: 0.5 } },
  { type: "question_classifier", label: "Question Classifier", icon: HelpCircle, category: "ai", color: "bg-amber-500/15 text-amber-500", defaultConfig: { classes: [] } },

  // Logic
  { type: "if_else", label: "IF/ELSE", icon: GitBranch, category: "logic", color: "bg-green-500/15 text-green-500", defaultConfig: { conditions: [] } },
  { type: "iteration", label: "Iteration", icon: Redo2, category: "logic", color: "bg-green-500/15 text-green-500", defaultConfig: {} },
  { type: "loop", label: "Loop", icon: Shuffle, category: "logic", color: "bg-green-500/15 text-green-500", defaultConfig: { max_iterations: 10 } },

  // Output
  { type: "knowledge_base", label: "Knowledge Base", icon: Database, category: "output", color: "bg-orange-500/15 text-orange-500", defaultConfig: { target: "" } },
  { type: "agent", label: "Agent", icon: MessageSquare, category: "output", color: "bg-orange-500/15 text-orange-500", defaultConfig: {} },
]

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

const NODE_WIDTH = 200
const NODE_HEIGHT = 44
const NODE_HEIGHT_ERROR = 64
const PORT_RADIUS = 5
const GRID_SIZE = 20

let _nextId = 1
function uid() { return `node_${Date.now()}_${_nextId++}` }

/* ═══════════════════════════════════════════════════════════
   Component: PipelineEditor
   ═══════════════════════════════════════════════════════════ */

export default function PipelineEditor({ datasetId, datasetName }: { datasetId: string; datasetName: string }) {
  /* ── state ── */
  const [nodes, setNodes] = useState<PipelineNode[]>(() => getDefaultPipeline(datasetName))
  const [edges, setEdges] = useState<PipelineEdge[]>(() => getDefaultEdges())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showNodePalette, setShowNodePalette] = useState(false)
  const [paletteSearch, setPaletteSearch] = useState("")
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 60, y: 40 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragNodeId, setDragNodeId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [connecting, setConnecting] = useState<{ nodeId: string; port: string; x: number; y: number } | null>(null)
  const [connectEnd, setConnectEnd] = useState<{ x: number; y: number } | null>(null)
  const [published, setPublished] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  /* ── persistence (localStorage per dataset) ── */
  const storageKey = `regminder_pipeline_${datasetId}`

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.nodes?.length) { setNodes(data.nodes); setEdges(data.edges ?? []) }
      }
    } catch { /* ignore */ }
  }, [storageKey])

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify({ nodes, edges }))
    }, 500)
    return () => clearTimeout(timer)
  }, [nodes, edges, storageKey])

  /* ── coordinate helpers ── */
  function screenToCanvas(sx: number, sy: number) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: sx, y: sy }
    return { x: (sx - rect.left - pan.x) / zoom, y: (sy - rect.top - pan.y) / zoom }
  }

  /* ── node drag ── */
  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    const cp = screenToCanvas(e.clientX, e.clientY)
    setDragNodeId(nodeId)
    setDragOffset({ x: cp.x - node.x, y: cp.y - node.y })
    setIsDragging(true)
    setSelectedNodeId(nodeId)
  }

  /* ── canvas pan ── */
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest("[data-node]")) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    setSelectedNodeId(null)
  }

  /* ── global mouse move / up ── */
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (isDragging && dragNodeId) {
        const cp = screenToCanvas(e.clientX, e.clientY)
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragNodeId
              ? { ...n, x: Math.round((cp.x - dragOffset.x) / GRID_SIZE) * GRID_SIZE, y: Math.round((cp.y - dragOffset.y) / GRID_SIZE) * GRID_SIZE }
              : n,
          ),
        )
      }
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      }
      if (connecting) {
        const cp = screenToCanvas(e.clientX, e.clientY)
        setConnectEnd(cp)
      }
    }
    function onUp(e: MouseEvent) {
      if (connecting && connectEnd) {
        // check if we landed on an input port
        const target = findPortAt(connectEnd.x, connectEnd.y, "input")
        if (target && target.nodeId !== connecting.nodeId) {
          const edgeId = `edge_${Date.now()}`
          setEdges((prev) => [...prev, { id: edgeId, from: connecting.nodeId, fromPort: connecting.port, to: target.nodeId, toPort: target.port }])
        }
        setConnecting(null)
        setConnectEnd(null)
      }
      setIsDragging(false)
      setDragNodeId(null)
      setIsPanning(false)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  })

  const PORT_Y = 22 // matches the CSS top-[22px]
  function findPortAt(cx: number, cy: number, portType: "input" | "output") {
    for (const n of nodes) {
      if (portType === "input") {
        const px = n.x
        const py = n.y + PORT_Y
        if (Math.hypot(cx - px, cy - py) < 16) return { nodeId: n.id, port: "in_0" }
      } else {
        const px = n.x + NODE_WIDTH
        const py = n.y + PORT_Y
        if (Math.hypot(cx - px, cy - py) < 16) return { nodeId: n.id, port: "out_0" }
      }
    }
    return null
  }

  /* ── output port drag start ── */
  function handleOutputPortDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation()
    const node = nodes.find((n) => n.id === nodeId)!
    setConnecting({
      nodeId,
      port: "out_0",
      x: node.x + NODE_WIDTH,
      y: node.y + PORT_Y,
    })
    setConnectEnd({ x: node.x + NODE_WIDTH + 20, y: node.y + PORT_Y })
  }

  /* ── zoom ── */
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setZoom((z) => Math.max(0.25, Math.min(2, z + delta)))
  }

  function zoomIn() { setZoom((z) => Math.min(2, z + 0.1)) }
  function zoomOut() { setZoom((z) => Math.max(0.25, z - 0.1)) }
  function zoomReset() { setZoom(1); setPan({ x: 60, y: 40 }) }

  /* ── add node from palette ── */
  function addNode(template: NodeTemplate) {
    const id = uid()
    // Place near center of visible area
    const cx = (-pan.x + 400) / zoom
    const cy = (-pan.y + 200) / zoom
    const node: PipelineNode = {
      id,
      type: template.type,
      label: template.label,
      x: Math.round(cx / GRID_SIZE) * GRID_SIZE,
      y: Math.round(cy / GRID_SIZE) * GRID_SIZE,
      config: { ...template.defaultConfig },
      inputs: ["in_0"],
      outputs: ["out_0"],
    }
    setNodes((prev) => [...prev, node])
    setSelectedNodeId(id)
    setShowNodePalette(false)
  }

  /* ── delete node ── */
  function deleteNode(nodeId: string) {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => prev.filter((e) => e.from !== nodeId && e.to !== nodeId))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
  }

  /* ── delete edge ── */
  function deleteEdge(edgeId: string) {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId))
  }

  /* ── update node config ── */
  function updateNodeConfig(nodeId: string, key: string, value: any) {
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n))
  }
  function updateNodeLabel(nodeId: string, label: string) {
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, label } : n))
  }

  /* ── compute edge path (bezier) ── */
  function edgePath(edge: PipelineEdge): string {
    const fromNode = nodes.find((n) => n.id === edge.from)
    const toNode = nodes.find((n) => n.id === edge.to)
    if (!fromNode || !toNode) return ""
    const x1 = fromNode.x + NODE_WIDTH
    const y1 = fromNode.y + PORT_Y
    const x2 = toNode.x
    const y2 = toNode.y + PORT_Y
    const dx = Math.abs(x2 - x1) * 0.5
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  }

  /* ── filtered palette nodes ── */
  const filteredTemplates = NODE_TEMPLATES.filter(
    (t) => !paletteSearch || t.label.toLowerCase().includes(paletteSearch.toLowerCase()),
  )

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */

  return (
    <div className="flex h-full min-h-0 overflow-hidden relative">

      {/* ── Node Palette (left sidebar) ── */}
      {showNodePalette && (
        <div className="w-[240px] shrink-0 border-r border-border bg-card flex flex-col z-20">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span className="text-xs font-semibold text-foreground">Nodes</span>
            <button onClick={() => setShowNodePalette(false)} className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                placeholder="Search node"
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
            {NODE_CATEGORIES.map((cat) => {
              const items = filteredTemplates.filter((t) => t.category === cat.key)
              if (items.length === 0) return null
              return (
                <div key={cat.key}>
                  <p className="px-1 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</p>
                  <div className="space-y-0.5">
                    {items.map((t) => {
                      const Icon = t.icon
                      return (
                        <button
                          key={t.type}
                          onClick={() => addNode(t)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted transition-colors"
                        >
                          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", t.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-medium text-foreground truncate">{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        style={{ backgroundImage: "radial-gradient(circle, oklch(0.5 0 0 / 0.15) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {/* Edges */}
          {edges.map((edge) => (
            <g key={edge.id}>
              <path
                d={edgePath(edge)}
                fill="none"
                stroke="oklch(0.65 0.15 250)"
                strokeWidth={2}
                className="pointer-events-auto cursor-pointer"
                onClick={() => deleteEdge(edge.id)}
              />
              {/* Invisible wider hit target */}
              <path
                d={edgePath(edge)}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="pointer-events-auto cursor-pointer"
                onClick={() => deleteEdge(edge.id)}
              />
            </g>
          ))}

          {/* Connecting edge preview */}
          {connecting && connectEnd && (
            <path
              d={`M ${connecting.x} ${connecting.y} C ${connecting.x + 60} ${connecting.y}, ${connectEnd.x - 60} ${connectEnd.y}, ${connectEnd.x} ${connectEnd.y}`}
              fill="none"
              stroke="oklch(0.65 0.15 250)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
        </svg>

        {/* Nodes */}
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {nodes.map((node) => {
            const template = NODE_TEMPLATES.find((t) => t.type === node.type)
            const Icon = template?.icon ?? Database
            const colorClass = template?.color ?? "bg-muted text-muted-foreground"
            const isSelected = selectedNodeId === node.id
            const hasError = node.type === "knowledge_base" && !node.config.chunk_structure
            const h = hasError ? NODE_HEIGHT_ERROR : NODE_HEIGHT

            return (
              <div
                key={node.id}
                data-node={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                className={cn(
                  "absolute rounded-lg border bg-card shadow-sm select-none transition-all",
                  isSelected ? "border-primary shadow-md ring-1 ring-primary/20" : "border-border hover:border-primary/40",
                  hasError && !isSelected && "border-amber-500/60",
                )}
                style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: h }}
              >
                {/* Input port */}
                <div
                  className="absolute -left-[5px] top-[22px] -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-border bg-card cursor-crosshair z-10 hover:border-primary hover:bg-primary/20 transition-colors"
                  title="Input"
                />

                {/* Output port */}
                <div
                  className="absolute -right-[5px] top-[22px] -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-border bg-card cursor-crosshair z-10 hover:border-primary hover:bg-primary/20 transition-colors"
                  title="Output"
                  onMouseDown={(e) => handleOutputPortDown(e, node.id)}
                />

                {/* Node content */}
                <div className="flex items-center gap-2 px-2.5" style={{ height: NODE_HEIGHT }}>
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-md shrink-0", colorClass)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground truncate">{node.label}</span>
                </div>

                {/* Error hint inside node */}
                {hasError && (
                  <div className="px-2.5 pb-1.5">
                    <div className="text-[9px] font-medium text-amber-500 flex items-center gap-1">
                      <span className="inline-block h-1 w-1 rounded-full bg-amber-500" />
                      Configuration required
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Canvas toolbar (bottom-left) ── */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-card/90 backdrop-blur border border-border rounded-lg p-1 z-10">
          <button onClick={() => setShowNodePalette(!showNodePalette)} className={cn("p-1.5 rounded-md transition-colors", showNodePalette ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground")}>
            <Plus className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <button onClick={zoomOut} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><ZoomOut className="h-3.5 w-3.5" /></button>
          <button onClick={zoomReset} className="px-2 py-1 rounded-md hover:bg-muted text-[10px] font-medium text-muted-foreground min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><ZoomIn className="h-3.5 w-3.5" /></button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <button onClick={zoomReset} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Fit to view"><MousePointer2 className="h-3.5 w-3.5" /></button>
        </div>

        {/* ── Top-right toolbar ── */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {!published && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] text-blue-400 font-medium">Unpublished draft</span>
            </div>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Play className="h-3 w-3" />
            Test Run
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setPublished(true)}>
            Publish
          </Button>
        </div>

        {/* ── Auto-save indicator ── */}
        <div className="absolute top-3 left-3 z-10">
          <span className="text-[10px] text-muted-foreground/60">Auto-saved</span>
        </div>
      </div>

      {/* ── Right settings panel ── */}
      {selectedNode && (
        <div className="w-[300px] shrink-0 border-l border-border bg-card flex flex-col z-20">
          <NodeSettingsPanel
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdateConfig={updateNodeConfig}
            onUpdateLabel={updateNodeLabel}
            onDelete={deleteNode}
          />
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Node Settings Panel
   ═══════════════════════════════════════════════════════════ */

function NodeSettingsPanel({ node, onClose, onUpdateConfig, onUpdateLabel, onDelete }: {
  node: PipelineNode
  onClose: () => void
  onUpdateConfig: (nodeId: string, key: string, value: any) => void
  onUpdateLabel: (nodeId: string, label: string) => void
  onDelete: (nodeId: string) => void
}) {
  const template = NODE_TEMPLATES.find((t) => t.type === node.type)
  const Icon = template?.icon ?? Database
  const colorClass = template?.color ?? "bg-muted text-muted-foreground"

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", colorClass)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-foreground truncate">{node.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onDelete(node.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label</label>
          <Input
            value={node.label}
            onChange={(e) => onUpdateLabel(node.id, e.target.value)}
            className="mt-1 h-8 text-xs"
          />
        </div>

        {/* Type-specific settings */}
        {node.type === "chunk" && <ChunkSettings node={node} onUpdate={onUpdateConfig} />}
        {node.type === "llm" && <LlmSettings node={node} onUpdate={onUpdateConfig} />}
        {node.type === "knowledge_retrieval" && <RetrievalSettings node={node} onUpdate={onUpdateConfig} />}
        {node.type === "data_source" && <DataSourceSettings node={node} onUpdate={onUpdateConfig} />}
        {node.type === "clean" && <CleanSettings node={node} onUpdate={onUpdateConfig} />}
        {node.type === "knowledge_base" && <KnowledgeBaseSettings node={node} onUpdate={onUpdateConfig} />}
        {node.type === "if_else" && <IfElseSettings node={node} onUpdate={onUpdateConfig} />}
        {node.type === "code" && <CodeSettings node={node} onUpdate={onUpdateConfig} />}

        {/* Generic fallback for uncovered types */}
        {!["chunk", "llm", "knowledge_retrieval", "data_source", "clean", "knowledge_base", "if_else", "code"].includes(node.type) && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Configure this node&apos;s settings here. Additional configuration options will be available in future updates.</p>
          </div>
        )}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   Type-specific settings panels
   ═══════════════════════════════════════════════════════════ */

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function ChunkSettings({ node, onUpdate }: { node: PipelineNode; onUpdate: (id: string, k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        CHUNK STRUCTURE
        <HelpCircle className="h-3 w-3 text-muted-foreground" />
      </div>

      <SettingRow label="Mode">
        <Select value={node.config.mode ?? "general"} onValueChange={(v) => onUpdate(node.id, "mode", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="parent_child">Parent-child</SelectItem>
            <SelectItem value="qa">Q&A</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="Chunk Size (tokens)">
        <Input type="number" value={node.config.chunk_size ?? 500} onChange={(e) => onUpdate(node.id, "chunk_size", +e.target.value)} className="h-8 text-xs" />
      </SettingRow>

      <SettingRow label="Overlap (tokens)">
        <Input type="number" value={node.config.overlap ?? 50} onChange={(e) => onUpdate(node.id, "overlap", +e.target.value)} className="h-8 text-xs" />
      </SettingRow>

      <SettingRow label="Separator">
        <Input value={node.config.separator ?? "\\n\\n"} onChange={(e) => onUpdate(node.id, "separator", e.target.value)} className="h-8 text-xs" />
      </SettingRow>
    </div>
  )
}

function LlmSettings({ node, onUpdate }: { node: PipelineNode; onUpdate: (id: string, k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <SettingRow label="Model">
        <Select value={node.config.model ?? "gpt-4o"} onValueChange={(v) => onUpdate(node.id, "model", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
            <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet</SelectItem>
            <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="Temperature">
        <div className="flex items-center gap-2">
          <input
            type="range" min="0" max="2" step="0.1"
            value={node.config.temperature ?? 0.7}
            onChange={(e) => onUpdate(node.id, "temperature", +e.target.value)}
            className="flex-1 accent-primary"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">{node.config.temperature ?? 0.7}</span>
        </div>
      </SettingRow>

      <SettingRow label="Max Tokens">
        <Input type="number" value={node.config.max_tokens ?? 4096} onChange={(e) => onUpdate(node.id, "max_tokens", +e.target.value)} className="h-8 text-xs" />
      </SettingRow>
    </div>
  )
}

function RetrievalSettings({ node, onUpdate }: { node: PipelineNode; onUpdate: (id: string, k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <SettingRow label="Top K Results">
        <Input type="number" value={node.config.top_k ?? 5} onChange={(e) => onUpdate(node.id, "top_k", +e.target.value)} className="h-8 text-xs" />
      </SettingRow>
      <SettingRow label="Score Threshold">
        <div className="flex items-center gap-2">
          <input
            type="range" min="0" max="1" step="0.05"
            value={node.config.score_threshold ?? 0.5}
            onChange={(e) => onUpdate(node.id, "score_threshold", +e.target.value)}
            className="flex-1 accent-primary"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">{node.config.score_threshold ?? 0.5}</span>
        </div>
      </SettingRow>
      <SettingRow label="Retrieval Mode">
        <Select value={node.config.retrieval_mode ?? "semantic"} onValueChange={(v) => onUpdate(node.id, "retrieval_mode", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semantic">Semantic Search</SelectItem>
            <SelectItem value="full_text">Full-Text Search</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
    </div>
  )
}

function DataSourceSettings({ node, onUpdate }: { node: PipelineNode; onUpdate: (id: string, k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <SettingRow label="Source Type">
        <Select value={node.config.source_type ?? "upload"} onValueChange={(v) => onUpdate(node.id, "source_type", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upload">File Upload</SelectItem>
            <SelectItem value="url">Web URL</SelectItem>
            <SelectItem value="api">API Endpoint</SelectItem>
            <SelectItem value="notion">Notion</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <div className="rounded-lg border border-dashed border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">Drag files here or configure the data source</p>
      </div>
    </div>
  )
}

function CleanSettings({ node, onUpdate }: { node: PipelineNode; onUpdate: (id: string, k: string, v: any) => void }) {
  return (
    <div className="space-y-3">
      {[
        { key: "remove_urls", label: "Remove URLs" },
        { key: "remove_emails", label: "Remove Email Addresses" },
        { key: "remove_html", label: "Strip HTML Tags" },
        { key: "normalize_whitespace", label: "Normalize Whitespace" },
      ].map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={node.config[key] ?? false}
            onChange={(e) => onUpdate(node.id, key, e.target.checked)}
            className="accent-primary rounded"
          />
          <span className="text-xs text-foreground">{label}</span>
        </label>
      ))}
    </div>
  )
}

function KnowledgeBaseSettings({ node, onUpdate }: { node: PipelineNode; onUpdate: (id: string, k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        CHUNK STRUCTURE
        <HelpCircle className="h-3 w-3 text-muted-foreground" />
      </div>

      <SettingRow label="Structure">
        <Select value={node.config.chunk_structure ?? ""} onValueChange={(v) => onUpdate(node.id, "chunk_structure", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose a chunk structure" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="parent_child">Parent-child</SelectItem>
            <SelectItem value="qa">Q&A</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {!node.config.chunk_structure && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Layers className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Please choose a chunk structure</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                The Dify Knowledge Base supports three chunking structures: General, Parent-child, and Q&A. Each knowledge base can have only one structure.
              </p>
            </div>
          </div>
        </div>
      )}

      <SettingRow label="Description">
        <Input value={node.config.description ?? ""} onChange={(e) => onUpdate(node.id, "description", e.target.value)} placeholder="Add description..." className="h-8 text-xs" />
      </SettingRow>
    </div>
  )
}

function IfElseSettings({ node, onUpdate }: { node: PipelineNode; onUpdate: (id: string, k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <SettingRow label="Condition Variable">
        <Input value={node.config.variable ?? ""} onChange={(e) => onUpdate(node.id, "variable", e.target.value)} placeholder="e.g. {{input.category}}" className="h-8 text-xs" />
      </SettingRow>
      <SettingRow label="Operator">
        <Select value={node.config.operator ?? "equals"} onValueChange={(v) => onUpdate(node.id, "operator", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="not_equals">Not Equals</SelectItem>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="not_contains">Not Contains</SelectItem>
            <SelectItem value="starts_with">Starts With</SelectItem>
            <SelectItem value="is_empty">Is Empty</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label="Compare Value">
        <Input value={node.config.compare_value ?? ""} onChange={(e) => onUpdate(node.id, "compare_value", e.target.value)} className="h-8 text-xs" />
      </SettingRow>
    </div>
  )
}

function CodeSettings({ node, onUpdate }: { node: PipelineNode; onUpdate: (id: string, k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <SettingRow label="Language">
        <Select value={node.config.language ?? "python"} onValueChange={(v) => onUpdate(node.id, "language", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="python">Python 3</SelectItem>
            <SelectItem value="javascript">JavaScript</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label="Code">
        <textarea
          value={node.config.code ?? ""}
          onChange={(e) => onUpdate(node.id, "code", e.target.value)}
          className="w-full h-32 rounded-md border border-border bg-muted/30 p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="def main(input: dict) -> dict:&#10;    return {}"
        />
      </SettingRow>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Default pipeline
   ═══════════════════════════════════════════════════════════ */

function getDefaultPipeline(datasetName: string): PipelineNode[] {
  return [
    {
      id: "default_source",
      type: "data_source",
      label: "Data Source",
      x: 40,
      y: 120,
      config: { source_type: "upload" },
      inputs: [],
      outputs: ["out_0"],
    },
    {
      id: "default_kb",
      type: "knowledge_base",
      label: "Knowledge Base",
      x: 400,
      y: 120,
      config: { target: datasetName, chunk_structure: "" },
      inputs: ["in_0"],
      outputs: [],
    },
  ]
}

function getDefaultEdges(): PipelineEdge[] {
  return [
    { id: "default_edge", from: "default_source", fromPort: "out_0", to: "default_kb", toPort: "in_0" },
  ]
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function getNodeSubtitle(node: PipelineNode): string {
  switch (node.type) {
    case "data_source": return node.config.source_type ?? "upload"
    case "chunk": return `${node.config.mode ?? "general"} · ${node.config.chunk_size ?? 500} tokens`
    case "llm": return node.config.model ?? "gpt-4o"
    case "knowledge_retrieval": return `top_k: ${node.config.top_k ?? 5}`
    case "knowledge_base": return node.config.chunk_structure ? node.config.chunk_structure : "Choose structure"
    case "clean": return "Text cleaning"
    case "if_else": return node.config.variable || "Configure condition"
    case "code": return node.config.language ?? "python"
    case "template": return "Template transform"
    case "question_classifier": return "Classifier"
    case "iteration": return "Iteration"
    case "loop": return `max: ${node.config.max_iterations ?? 10}`
    default: return node.type
  }
}
