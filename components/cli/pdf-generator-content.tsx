"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  FileText, Plus, Download, Eye, Trash2, Copy, Settings, ChevronDown, ChevronRight,
  Table2, Image, Type, Square, QrCode, FormInput, Lock, Merge, Scissors,
  Bookmark, Link, Code, FileCode, Palette, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Strikethrough, Loader2, AlertCircle, CheckCircle2,
  X, LayoutTemplate, BarChart3, FileDown, Droplets, Tag, Shield, Accessibility,
  Columns3, ArrowDown, ArrowUp, GripVertical, PenTool, Layers, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

interface PdfTemplate {
  id: string; name: string; description: string; category: string; placeholders: string[]
}

type ContentBlock = {
  id: string
  type: "text" | "paragraph" | "table" | "image" | "shape" | "barcode" | "formField" | "pageBreak" | "spacer" | "hyperlink" | "annotation" | "columns"
  [key: string]: any
}

interface PdfDefinition {
  filename: string
  metadata: { title: string; author: string; subject: string; keywords: string }
  pageDefaults: { size: string; layout: string; margins: { top: number; bottom: number; left: number; right: number } }
  encryption: { enabled: boolean; userPassword: string; ownerPassword: string }
  watermark: { enabled: boolean; type: string; text: string; opacity: number; rotation: number }
  conformance: string
  tagged: boolean
  header: { enabled: boolean; text: string; includePageNumber: boolean; align: string }
  footer: { enabled: boolean; text: string; includePageNumber: boolean; pageNumberFormat: string; align: string }
  content: ContentBlock[]
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DOC_SERVICE_URL = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:18094`
  : "http://localhost:18094"

const defaultDef = (): PdfDefinition => ({
  filename: "document",
  metadata: { title: "Untitled", author: "REGMINDER", subject: "", keywords: "" },
  pageDefaults: { size: "A4", layout: "portrait", margins: { top: 50, bottom: 50, left: 50, right: 50 } },
  encryption: { enabled: false, userPassword: "", ownerPassword: "" },
  watermark: { enabled: false, type: "text", text: "DRAFT", opacity: 0.15, rotation: -45 },
  conformance: "",
  tagged: false,
  header: { enabled: false, text: "", includePageNumber: false, align: "center" },
  footer: { enabled: false, text: "", includePageNumber: true, pageNumberFormat: "Page {page} of {pages}", align: "center" },
  content: [],
})

let blockIdCounter = 0
const newBlockId = () => `blk-${++blockIdCounter}-${Math.random().toString(36).slice(2, 5)}`

// ── Block Palette ────────────────────────────────────────────────────────────

const BLOCK_PALETTE: { type: ContentBlock["type"]; label: string; icon: any; defaults: Partial<ContentBlock> }[] = [
  { type: "text", label: "Text", icon: Type, defaults: { text: "Enter text...", fontSize: 12, bold: false, italic: false, color: "#000000", align: "left" } },
  { type: "table", label: "Table", icon: Table2, defaults: { headers: [{ text: "Header 1", bold: true }, { text: "Header 2", bold: true }, { text: "Header 3", bold: true }], rows: [[{ text: "Cell 1" }, { text: "Cell 2" }, { text: "Cell 3" }], [{ text: "Cell 4" }, { text: "Cell 5" }, { text: "Cell 6" }]], style: "striped", headerBackground: "#4f46e5", headerColor: "#ffffff" } },
  { type: "image", label: "Image", icon: Image, defaults: { src: "", width: 200, align: "center", caption: "" } },
  { type: "shape", label: "Shape", icon: Square, defaults: { shape: "rect", width: 200, height: 50, fill: "#4f46e5", stroke: "", strokeWidth: 1 } },
  { type: "barcode", label: "Barcode/QR", icon: QrCode, defaults: { format: "qr", data: "https://regminder.com", width: 150, height: 150, align: "center", showText: true } },
  { type: "formField", label: "Form Field", icon: FormInput, defaults: { fieldType: "text", name: "field_1", label: "Field Label", value: "", width: 200 } },
  { type: "hyperlink", label: "Hyperlink", icon: Link, defaults: { text: "Click here", url: "https://", color: "#2563eb" } },
  { type: "pageBreak", label: "Page Break", icon: Scissors, defaults: {} },
  { type: "spacer", label: "Spacer", icon: ArrowDown, defaults: { height: 20 } },
  { type: "columns", label: "Columns", icon: Columns3, defaults: { columns: [[], []], gap: 20 } },
  { type: "annotation", label: "Annotation", icon: Tag, defaults: { annotType: "text", text: "Note", color: "#ffff00" } },
]

// ── Component ────────────────────────────────────────────────────────────────

export function PdfGeneratorContent() {
  const [def, setDef] = useState<PdfDefinition>(defaultDef())
  const [templates, setTemplates] = useState<PdfTemplate[]>([])
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"content" | "settings" | "templates" | "api" | "compliance">("content")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null)
  const [templateData, setTemplateData] = useState<Record<string, string>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [apiPayload, setApiPayload] = useState("")
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  // Compliance state
  const [pdfaLevel, setPdfaLevel] = useState<"" | "PDF/A-1b" | "PDF/A-2b" | "PDF/A-3b">("")
  const [pdfaConverting, setPdfaConverting] = useState(false)
  const [pdfaReport, setPdfaReport] = useState<any>(null)
  const [accessibilityResult, setAccessibilityResult] = useState<any>(null)
  const [accessibilityChecking, setAccessibilityChecking] = useState(false)
  const [signCertFile, setSignCertFile] = useState<string>("")
  const [signPassphrase, setSignPassphrase] = useState("")
  const [signName, setSignName] = useState("")
  const [signReason, setSignReason] = useState("")
  const [signLocation, setSignLocation] = useState("")
  const [signing, setSigning] = useState(false)
  const [signResult, setSignResult] = useState<any>(null)
  const certFileRef = useRef<HTMLInputElement>(null)

  const showMessage = useCallback((type: "info" | "error" | "success", text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }, [])

  // ── Compliance handlers ────────────────────────────────────────
  const handlePdfAConvert = useCallback(async () => {
    if (!previewUrl) { showMessage("error", "Generate a PDF first, then convert to PDF/A"); return }
    if (!pdfaLevel) { showMessage("error", "Select a PDF/A level"); return }
    setPdfaConverting(true)
    try {
      const resp = await fetch(previewUrl)
      const blob = await resp.blob()
      const base64 = await new Promise<string>(r => {
        const reader = new FileReader()
        reader.onload = () => r((reader.result as string).split(",")[1])
        reader.readAsDataURL(blob)
      })
      const res = await fetch(`${DOC_SERVICE_URL}/api/v1/pdf/convert-pdfa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64, level: pdfaLevel }),
      })
      const result = await res.json()
      setPdfaReport(result.report)
      if (result.report?.conformant) {
        // Replace preview with converted PDF
        const bytes = Uint8Array.from(atob(result.pdf), c => c.charCodeAt(0))
        const newBlob = new Blob([bytes], { type: "application/pdf" })
        const url = URL.createObjectURL(newBlob)
        setPreviewUrl(url)
        showMessage("success", `Converted to ${pdfaLevel} successfully`)
      } else {
        showMessage("error", `Conversion completed with issues: ${result.report?.issues?.join(", ")}`)
      }
    } catch (e: any) {
      showMessage("error", `PDF/A conversion failed: ${e.message}`)
    } finally {
      setPdfaConverting(false)
    }
  }, [previewUrl, pdfaLevel, showMessage])

  const handleAccessibilityCheck = useCallback(async () => {
    if (!previewUrl) { showMessage("error", "Generate a PDF first"); return }
    setAccessibilityChecking(true)
    try {
      const resp = await fetch(previewUrl)
      const blob = await resp.blob()
      const base64 = await new Promise<string>(r => {
        const reader = new FileReader()
        reader.onload = () => r((reader.result as string).split(",")[1])
        reader.readAsDataURL(blob)
      })
      const res = await fetch(`${DOC_SERVICE_URL}/api/v1/pdf/accessibility-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64, standard: "WCAG-2.1-AA" }),
      })
      const result = await res.json()
      setAccessibilityResult(result)
      showMessage(result.passed ? "success" : "info", `Accessibility score: ${result.score}% (${result.summary?.passed}/${result.summary?.totalChecks} checks passed)`)
    } catch (e: any) {
      showMessage("error", `Accessibility check failed: ${e.message}`)
    } finally {
      setAccessibilityChecking(false)
    }
  }, [previewUrl, showMessage])

  const handleDigitalSign = useCallback(async () => {
    if (!previewUrl) { showMessage("error", "Generate a PDF first"); return }
    if (!signCertFile) { showMessage("error", "Upload a certificate (.pfx/.p12)"); return }
    if (!signName) { showMessage("error", "Enter signer name"); return }
    setSigning(true)
    try {
      const resp = await fetch(previewUrl)
      const blob = await resp.blob()
      const base64 = await new Promise<string>(r => {
        const reader = new FileReader()
        reader.onload = () => r((reader.result as string).split(",")[1])
        reader.readAsDataURL(blob)
      })
      const res = await fetch(`${DOC_SERVICE_URL}/api/v1/pdf/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf: base64,
          certificate: signCertFile,
          passphrase: signPassphrase,
          signer: { name: signName, reason: signReason, location: signLocation },
          appearance: { page: 0, x: 50, y: 50, width: 250, height: 80, showName: true, showDate: true, showReason: !!signReason, showLocation: !!signLocation },
        }),
      })
      const result = await res.json()
      setSignResult(result.details)
      if (result.pdf) {
        const bytes = Uint8Array.from(atob(result.pdf), c => c.charCodeAt(0))
        const newBlob = new Blob([bytes], { type: "application/pdf" })
        const url = URL.createObjectURL(newBlob)
        setPreviewUrl(url)
        showMessage("success", `PDF signed by ${signName}`)
      }
    } catch (e: any) {
      showMessage("error", `Signing failed: ${e.message}`)
    } finally {
      setSigning(false)
    }
  }, [previewUrl, signCertFile, signPassphrase, signName, signReason, signLocation, showMessage])

  const handleCertUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]
      setSignCertFile(base64)
      showMessage("info", `Certificate loaded: ${file.name}`)
    }
    reader.readAsDataURL(file)
  }, [showMessage])

  // Load templates on mount
  useEffect(() => {
    fetch(`${DOC_SERVICE_URL}/api/v1/pdf/templates`)
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => {
        // Fallback templates for offline
        setTemplates([
          { id: "invoice", name: "Invoice", description: "Standard invoice", category: "business", placeholders: ["company_name", "invoice_number", "date"] },
          { id: "report", name: "Report", description: "Professional report", category: "business", placeholders: ["title", "author", "date"] },
          { id: "certificate", name: "Certificate", description: "Formal certificate", category: "official", placeholders: ["title", "recipient", "date"] },
          { id: "compliance-report", name: "Compliance Report", description: "Regulatory compliance", category: "regulatory", placeholders: ["company_name", "report_number", "standard"] },
        ])
      })
  }, [])

  // ── Content Manipulation ───────────────────────────────────────────────────

  const addBlock = useCallback((type: ContentBlock["type"]) => {
    const palItem = BLOCK_PALETTE.find(b => b.type === type)
    if (!palItem) return
    const block: ContentBlock = { id: newBlockId(), type, ...JSON.parse(JSON.stringify(palItem.defaults)) }
    setDef(d => ({ ...d, content: [...d.content, block] }))
    setSelectedBlock(block.id)
  }, [])

  const updateBlock = useCallback((id: string, changes: Partial<ContentBlock>) => {
    setDef(d => ({
      ...d,
      content: d.content.map(b => b.id === id ? { ...b, ...changes } : b),
    }))
  }, [])

  const removeBlock = useCallback((id: string) => {
    setDef(d => ({ ...d, content: d.content.filter(b => b.id !== id) }))
    if (selectedBlock === id) setSelectedBlock(null)
  }, [selectedBlock])

  const moveBlock = useCallback((fromIdx: number, toIdx: number) => {
    setDef(d => {
      const arr = [...d.content]
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      return { ...d, content: arr }
    })
  }, [])

  const duplicateBlock = useCallback((id: string) => {
    setDef(d => {
      const idx = d.content.findIndex(b => b.id === id)
      if (idx < 0) return d
      const clone = { ...JSON.parse(JSON.stringify(d.content[idx])), id: newBlockId() }
      const arr = [...d.content]
      arr.splice(idx + 1, 0, clone)
      return { ...d, content: arr }
    })
  }, [])

  // ── Generate / Preview ─────────────────────────────────────────────────────

  const buildPayload = useCallback(() => {
    const payload: any = {
      filename: def.filename,
      metadata: def.metadata,
      pageDefaults: def.pageDefaults,
      content: def.content.map(b => {
        const { id, ...rest } = b
        return rest
      }),
      tagged: def.tagged,
    }
    if (def.conformance) payload.conformance = def.conformance
    if (def.encryption.enabled) {
      payload.encryption = { userPassword: def.encryption.userPassword, ownerPassword: def.encryption.ownerPassword }
    }
    if (def.watermark.enabled) {
      payload.watermark = { type: def.watermark.type, text: def.watermark.text, opacity: def.watermark.opacity, rotation: def.watermark.rotation, position: "diagonal" }
    }
    if (def.header.enabled) {
      payload.header = { text: def.header.text, includePageNumber: def.header.includePageNumber, align: def.header.align }
    }
    if (def.footer.enabled) {
      payload.footer = { text: def.footer.text, includePageNumber: def.footer.includePageNumber, pageNumberFormat: def.footer.pageNumberFormat, align: def.footer.align }
    }
    return payload
  }, [def])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const payload = buildPayload()
      const res = await fetch(`${DOC_SERVICE_URL}/api/v1/pdf/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      showMessage("success", "PDF generated successfully")
    } catch (e: any) {
      showMessage("error", `Generation failed: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }, [buildPayload, showMessage])

  const handleDownload = useCallback(() => {
    if (!previewUrl) return
    const a = document.createElement("a")
    a.href = previewUrl
    a.download = `${def.filename}.pdf`
    a.click()
  }, [previewUrl, def.filename])

  const handleTemplateGenerate = useCallback(async () => {
    if (!selectedTemplate) return
    setGenerating(true)
    try {
      const res = await fetch(`${DOC_SERVICE_URL}/api/v1/pdf/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: selectedTemplate, data: templateData }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      setPreviewUrl(URL.createObjectURL(blob))
      showMessage("success", "PDF generated from template")
    } catch (e: any) {
      showMessage("error", `Template generation failed: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }, [selectedTemplate, templateData, showMessage])

  const handleApiGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const payload = JSON.parse(apiPayload)
      const res = await fetch(`${DOC_SERVICE_URL}/api/v1/pdf/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      setPreviewUrl(URL.createObjectURL(blob))
      showMessage("success", "PDF generated from API payload")
    } catch (e: any) {
      showMessage("error", `API generation failed: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }, [apiPayload, showMessage])

  // Update API payload when definition changes
  useEffect(() => {
    if (activeTab === "api") {
      setApiPayload(JSON.stringify(buildPayload(), null, 2))
    }
  }, [activeTab, buildPayload])

  const selectedBlockData = useMemo(() => def.content.find(b => b.id === selectedBlock), [def.content, selectedBlock])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* Message Toast */}
      {msg && (
        <div className={cn(
          "absolute top-2 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm shadow-lg",
          msg.type === "error" ? "border-red-300 bg-red-50 text-red-700" : msg.type === "success" ? "border-green-300 bg-green-50 text-green-700" : "border-blue-300 bg-blue-50 text-blue-700",
        )}>
          {msg.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <FileText className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold">PDF Generator</span>
        <div className="ml-4 flex gap-1">
          {(["content", "settings", "templates", "compliance", "api"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-3 py-1 text-xs rounded-md", activeTab === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          Generate & Preview
        </button>
        {previewUrl && (
          <button onClick={handleDownload} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
            <Download className="w-3.5 h-3.5" /> Download
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Block List / Settings / Templates / API ── */}
        <div className="w-[380px] flex-shrink-0 border-r border-border overflow-y-auto">

          {/* CONTENT TAB */}
          {activeTab === "content" && (
            <div className="p-3 space-y-3">
              {/* Block Palette */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Add Content Block</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {BLOCK_PALETTE.map(bp => (
                    <button key={bp.type} onClick={() => addBlock(bp.type)} className="flex flex-col items-center gap-1 rounded-md border border-border p-2 text-[10px] hover:bg-muted hover:border-primary/50 transition-colors" title={bp.label}>
                      <bp.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate w-full text-center">{bp.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Block List */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Document Content ({def.content.length} blocks)</p>
                {def.content.length === 0 && <p className="text-xs text-muted-foreground italic">No content blocks. Click above to add.</p>}
                <div className="space-y-1">
                  {def.content.map((block, idx) => {
                    const pal = BLOCK_PALETTE.find(b => b.type === block.type)
                    const Icon = pal?.icon ?? FileText
                    return (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={(e) => { e.preventDefault() }}
                        onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveBlock(dragIdx, idx); setDragIdx(null) }}
                        onClick={() => setSelectedBlock(block.id)}
                        className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs cursor-pointer transition-colors",
                          selectedBlock === block.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                        )}
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground/50 cursor-grab" />
                        <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate">{block.type === "text" ? (block.text?.slice(0, 40) ?? "Text") : block.type === "pageBreak" ? "— Page Break —" : pal?.label ?? block.type}</span>
                        <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id) }} className="p-0.5 rounded hover:bg-muted" title="Duplicate"><Copy className="w-3 h-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }} className="p-0.5 rounded hover:bg-red-100 text-red-500" title="Remove"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Block Properties */}
              {selectedBlockData && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Block Properties</p>
                  <BlockProperties block={selectedBlockData} onChange={(changes) => updateBlock(selectedBlockData.id, changes)} />
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="p-3 space-y-4">
              <SettingsSection title="Document" icon={FileText}>
                <Field label="Filename" value={def.filename} onChange={v => setDef(d => ({ ...d, filename: v }))} />
                <Field label="Title" value={def.metadata.title} onChange={v => setDef(d => ({ ...d, metadata: { ...d.metadata, title: v } }))} />
                <Field label="Author" value={def.metadata.author} onChange={v => setDef(d => ({ ...d, metadata: { ...d.metadata, author: v } }))} />
                <Field label="Subject" value={def.metadata.subject} onChange={v => setDef(d => ({ ...d, metadata: { ...d.metadata, subject: v } }))} />
                <Field label="Keywords" value={def.metadata.keywords} onChange={v => setDef(d => ({ ...d, metadata: { ...d.metadata, keywords: v } }))} />
              </SettingsSection>

              <SettingsSection title="Page Layout" icon={Layers}>
                <Select label="Size" value={def.pageDefaults.size} options={["A4", "A3", "A5", "LETTER", "LEGAL", "TABLOID"]} onChange={v => setDef(d => ({ ...d, pageDefaults: { ...d.pageDefaults, size: v } }))} />
                <Select label="Orientation" value={def.pageDefaults.layout} options={["portrait", "landscape"]} onChange={v => setDef(d => ({ ...d, pageDefaults: { ...d.pageDefaults, layout: v } }))} />
                <NumberField label="Top margin" value={def.pageDefaults.margins.top} onChange={v => setDef(d => ({ ...d, pageDefaults: { ...d.pageDefaults, margins: { ...d.pageDefaults.margins, top: v } } }))} />
                <NumberField label="Bottom" value={def.pageDefaults.margins.bottom} onChange={v => setDef(d => ({ ...d, pageDefaults: { ...d.pageDefaults, margins: { ...d.pageDefaults.margins, bottom: v } } }))} />
                <NumberField label="Left" value={def.pageDefaults.margins.left} onChange={v => setDef(d => ({ ...d, pageDefaults: { ...d.pageDefaults, margins: { ...d.pageDefaults.margins, left: v } } }))} />
                <NumberField label="Right" value={def.pageDefaults.margins.right} onChange={v => setDef(d => ({ ...d, pageDefaults: { ...d.pageDefaults, margins: { ...d.pageDefaults.margins, right: v } } }))} />
              </SettingsSection>

              <SettingsSection title="Header" icon={ArrowUp}>
                <Toggle label="Enable header" checked={def.header.enabled} onChange={v => setDef(d => ({ ...d, header: { ...d.header, enabled: v } }))} />
                {def.header.enabled && <>
                  <Field label="Text" value={def.header.text} onChange={v => setDef(d => ({ ...d, header: { ...d.header, text: v } }))} />
                  <Toggle label="Page number" checked={def.header.includePageNumber} onChange={v => setDef(d => ({ ...d, header: { ...d.header, includePageNumber: v } }))} />
                  <Select label="Align" value={def.header.align} options={["left", "center", "right"]} onChange={v => setDef(d => ({ ...d, header: { ...d.header, align: v } }))} />
                </>}
              </SettingsSection>

              <SettingsSection title="Footer" icon={ArrowDown}>
                <Toggle label="Enable footer" checked={def.footer.enabled} onChange={v => setDef(d => ({ ...d, footer: { ...d.footer, enabled: v } }))} />
                {def.footer.enabled && <>
                  <Field label="Text" value={def.footer.text} onChange={v => setDef(d => ({ ...d, footer: { ...d.footer, text: v } }))} />
                  <Toggle label="Page number" checked={def.footer.includePageNumber} onChange={v => setDef(d => ({ ...d, footer: { ...d.footer, includePageNumber: v } }))} />
                  <Field label="Format" value={def.footer.pageNumberFormat} onChange={v => setDef(d => ({ ...d, footer: { ...d.footer, pageNumberFormat: v } }))} />
                  <Select label="Align" value={def.footer.align} options={["left", "center", "right"]} onChange={v => setDef(d => ({ ...d, footer: { ...d.footer, align: v } }))} />
                </>}
              </SettingsSection>

              <SettingsSection title="Watermark" icon={Droplets}>
                <Toggle label="Enable watermark" checked={def.watermark.enabled} onChange={v => setDef(d => ({ ...d, watermark: { ...d.watermark, enabled: v } }))} />
                {def.watermark.enabled && <>
                  <Field label="Text" value={def.watermark.text} onChange={v => setDef(d => ({ ...d, watermark: { ...d.watermark, text: v } }))} />
                  <NumberField label="Opacity" value={def.watermark.opacity} step={0.05} min={0} max={1} onChange={v => setDef(d => ({ ...d, watermark: { ...d.watermark, opacity: v } }))} />
                  <NumberField label="Rotation" value={def.watermark.rotation} min={-90} max={90} onChange={v => setDef(d => ({ ...d, watermark: { ...d.watermark, rotation: v } }))} />
                </>}
              </SettingsSection>

              <SettingsSection title="Security" icon={Shield}>
                <Toggle label="Enable encryption" checked={def.encryption.enabled} onChange={v => setDef(d => ({ ...d, encryption: { ...d.encryption, enabled: v } }))} />
                {def.encryption.enabled && <>
                  <Field label="User password" value={def.encryption.userPassword} onChange={v => setDef(d => ({ ...d, encryption: { ...d.encryption, userPassword: v } }))} type="password" />
                  <Field label="Owner password" value={def.encryption.ownerPassword} onChange={v => setDef(d => ({ ...d, encryption: { ...d.encryption, ownerPassword: v } }))} type="password" />
                </>}
              </SettingsSection>

              <SettingsSection title="Compliance" icon={Accessibility}>
                <Select label="Conformance" value={def.conformance} options={["", "PDF/A-1b", "PDF/A-2b", "PDF/A-3b"]} onChange={v => setDef(d => ({ ...d, conformance: v }))} />
                <Toggle label="Tagged PDF (accessible)" checked={def.tagged} onChange={v => setDef(d => ({ ...d, tagged: v }))} />
              </SettingsSection>
            </div>
          )}

          {/* TEMPLATES TAB */}
          {activeTab === "templates" && (
            <div className="p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Select a template and fill in data to generate</p>
              <div className="space-y-2">
                {templates.map(t => (
                  <button key={t.id} onClick={() => { setSelectedTemplate(t.id); setTemplateData({}) }} className={cn("w-full text-left rounded-md border p-3 transition-colors", selectedTemplate === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">{t.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  </button>
                ))}
              </div>

              {selectedTemplate && (() => {
                const tmpl = templates.find(t => t.id === selectedTemplate)
                if (!tmpl) return null
                return (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-medium">Template Data</p>
                    {tmpl.placeholders.map(ph => (
                      <Field key={ph} label={ph.replace(/_/g, " ")} value={templateData[ph] ?? ""} onChange={v => setTemplateData(d => ({ ...d, [ph]: v }))} />
                    ))}
                    <button onClick={handleTemplateGenerate} disabled={generating} className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                      {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                      Generate from Template
                    </button>
                  </div>
                )
              })()}
            </div>
          )}

          {/* COMPLIANCE TAB */}
          {activeTab === "compliance" && (
            <div className="p-3 space-y-4 overflow-y-auto">
              {/* PDF/A Conversion */}
              <SettingsSection title="PDF/A Archival Conversion" icon={<Shield className="w-3.5 h-3.5" />} defaultOpen>
                <p className="text-[10px] text-muted-foreground mb-2">Convert generated PDFs to PDF/A for long-term archival compliance. Embeds fonts, adds sRGB ICC profile, strips encryption and transparency.</p>
                <Select label="PDF/A Level" value={pdfaLevel} onChange={v => setPdfaLevel(v as any)}
                  options={[{ value: "", label: "None" }, { value: "PDF/A-1b", label: "PDF/A-1b (ISO 19005-1)" }, { value: "PDF/A-2b", label: "PDF/A-2b (ISO 19005-2)" }, { value: "PDF/A-3b", label: "PDF/A-3b (ISO 19005-3)" }]} />
                <button onClick={handlePdfAConvert} disabled={pdfaConverting || !previewUrl || !pdfaLevel}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                  {pdfaConverting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                  Convert to PDF/A
                </button>
                {pdfaReport && (
                  <div className={cn("mt-2 p-2 rounded border text-[10px]", pdfaReport.conformant ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50")}>
                    <div className="flex items-center gap-1 font-medium mb-1">
                      {pdfaReport.conformant ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-red-600" />}
                      {pdfaReport.conformant ? "Conformant" : "Non-conformant"}
                    </div>
                    <div className="space-y-0.5 text-muted-foreground">
                      <p>Level: {pdfaReport.level}</p>
                      <p>Fonts embedded: {pdfaReport.fontsEmbedded}</p>
                      <p>XMP metadata: {pdfaReport.xmpMetadataAdded ? "Yes" : "No"}</p>
                      <p>ICC profile: {pdfaReport.iccProfileEmbedded ? "Yes" : "No"}</p>
                      <p>Size: {Math.round(pdfaReport.inputSize / 1024)}KB → {Math.round(pdfaReport.outputSize / 1024)}KB</p>
                      {pdfaReport.warnings?.length > 0 && <p className="text-amber-600">Warnings: {pdfaReport.warnings.join("; ")}</p>}
                      {pdfaReport.issues?.length > 0 && <p className="text-red-600">Issues: {pdfaReport.issues.join("; ")}</p>}
                    </div>
                  </div>
                )}
              </SettingsSection>

              {/* Accessibility Check */}
              <SettingsSection title="Accessibility / WCAG Compliance" icon={<Accessibility className="w-3.5 h-3.5" />} defaultOpen>
                <p className="text-[10px] text-muted-foreground mb-2">Check your PDF against WCAG 2.1 AA / PDF/UA standards. Validates tagged structure, language, alt text, metadata, navigation, and forms.</p>
                <Toggle label="Generate tagged PDF" checked={def.tagged} onChange={v => setDef(d => ({ ...d, tagged: v }))} />
                <button onClick={handleAccessibilityCheck} disabled={accessibilityChecking || !previewUrl}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                  {accessibilityChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Accessibility className="w-3 h-3" />}
                  Run Accessibility Check
                </button>
                {accessibilityResult && (
                  <div className="mt-2 space-y-2">
                    {/* Score bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", accessibilityResult.score >= 80 ? "bg-green-500" : accessibilityResult.score >= 50 ? "bg-amber-500" : "bg-red-500")}
                          style={{ width: `${accessibilityResult.score}%` }} />
                      </div>
                      <span className="text-xs font-bold">{accessibilityResult.score}%</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {accessibilityResult.summary?.passed}/{accessibilityResult.summary?.totalChecks} checks passed
                      {accessibilityResult.summary?.warnings > 0 && `, ${accessibilityResult.summary.warnings} warnings`}
                      {accessibilityResult.summary?.manualChecks > 0 && `, ${accessibilityResult.summary.manualChecks} need manual review`}
                    </div>
                    {/* Category breakdown */}
                    {accessibilityResult.categories?.map((cat: any, ci: number) => (
                      <div key={ci} className="border border-border rounded p-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium mb-1">
                          <span className={cn("w-2 h-2 rounded-full", cat.status === "pass" ? "bg-green-500" : cat.status === "fail" ? "bg-red-500" : cat.status === "warning" ? "bg-amber-500" : "bg-blue-400")} />
                          {cat.name}
                        </div>
                        {cat.items?.map((item: any, ii: number) => (
                          <div key={ii} className="flex items-start gap-1.5 text-[10px] pl-3 py-0.5">
                            {item.status === "pass" && <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />}
                            {item.status === "fail" && <AlertCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />}
                            {item.status === "warning" && <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />}
                            {item.status === "manual_check" && <Eye className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />}
                            <div>
                              <span className="font-medium">{item.rule}</span>
                              <span className="text-muted-foreground ml-1">— {item.description}</span>
                              {item.details && <p className="text-muted-foreground/70">{item.details}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </SettingsSection>

              {/* Digital Signatures */}
              <SettingsSection title="Digital Signatures" icon={<Lock className="w-3.5 h-3.5" />} defaultOpen>
                <p className="text-[10px] text-muted-foreground mb-2">Sign the generated PDF with a PKCS#12 (.pfx/.p12) certificate. Creates a visible signature with signer details.</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Certificate (.pfx / .p12)</label>
                    <input ref={certFileRef} type="file" accept=".pfx,.p12" onChange={handleCertUpload}
                      className="text-[10px] w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-muted file:text-foreground hover:file:bg-muted/80" />
                    {signCertFile && <p className="text-[10px] text-green-600 mt-0.5">Certificate loaded</p>}
                  </div>
                  <Field label="Passphrase" value={signPassphrase} onChange={setSignPassphrase} type="password" />
                  <Field label="Signer Name" value={signName} onChange={setSignName} />
                  <Field label="Reason (optional)" value={signReason} onChange={setSignReason} />
                  <Field label="Location (optional)" value={signLocation} onChange={setSignLocation} />
                  <button onClick={handleDigitalSign} disabled={signing || !previewUrl || !signCertFile || !signName}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                    {signing ? <Loader2 className="w-3 h-3 animate-spin" /> : <PenTool className="w-3 h-3" />}
                    Sign PDF
                  </button>
                  {signResult && (
                    <div className="p-2 rounded border border-green-300 bg-green-50 text-[10px] space-y-0.5">
                      <div className="flex items-center gap-1 font-medium text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> Signature Applied
                      </div>
                      <p className="text-muted-foreground">Signer: {signResult.signerName}</p>
                      <p className="text-muted-foreground">Signed at: {new Date(signResult.signedAt).toLocaleString()}</p>
                      <p className="text-muted-foreground">Algorithm: {signResult.hashAlgorithm}</p>
                      <p className="text-muted-foreground">Certificate issuer: {signResult.certificateIssuer}</p>
                      <p className="text-muted-foreground">Field: {signResult.signatureFieldName}</p>
                    </div>
                  )}
                </div>
              </SettingsSection>

              {/* Regulatory Endpoints Reference */}
              <SettingsSection title="Regulatory API Endpoints" icon={<Code className="w-3.5 h-3.5" />}>
                <div className="text-[10px] text-muted-foreground space-y-1.5">
                  <p><code className="bg-muted px-1 rounded">POST /api/v1/pdf/convert-pdfa</code> — Convert to PDF/A</p>
                  <p><code className="bg-muted px-1 rounded">POST /api/v1/pdf/accessible</code> — Generate tagged/accessible PDF</p>
                  <p><code className="bg-muted px-1 rounded">POST /api/v1/pdf/sign</code> — Digitally sign a PDF</p>
                  <p><code className="bg-muted px-1 rounded">POST /api/v1/pdf/verify-signatures</code> — Verify existing signatures</p>
                  <p><code className="bg-muted px-1 rounded">POST /api/v1/pdf/accessibility-check</code> — WCAG compliance check</p>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* API TAB */}
          {activeTab === "api" && (
            <div className="p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Raw JSON payload — edit and generate</p>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p><code className="bg-muted px-1 rounded">POST {DOC_SERVICE_URL}/api/v1/pdf/generate</code></p>
                <p><code className="bg-muted px-1 rounded">POST {DOC_SERVICE_URL}/api/v1/pdf/template</code></p>
                <p><code className="bg-muted px-1 rounded">POST {DOC_SERVICE_URL}/api/v1/pdf/from-html</code></p>
                <p><code className="bg-muted px-1 rounded">POST {DOC_SERVICE_URL}/api/v1/pdf/merge</code></p>
                <p><code className="bg-muted px-1 rounded">POST {DOC_SERVICE_URL}/api/v1/pdf/split</code></p>
              </div>
              <textarea
                value={apiPayload}
                onChange={e => setApiPayload(e.target.value)}
                className="w-full h-[400px] rounded-md border border-border bg-background font-mono text-[11px] p-2 resize-none"
                spellCheck={false}
              />
              <button onClick={handleApiGenerate} disabled={generating} className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Code className="w-3.5 h-3.5" />}
                Send API Request
              </button>
            </div>
          )}
        </div>

        {/* ── Right Panel: Preview ── */}
        <div className="flex-1 overflow-hidden bg-muted/30 flex items-center justify-center p-4">
          {previewUrl ? (
            <iframe src={previewUrl} className="w-full h-full rounded-lg border border-border bg-white shadow-lg" title="PDF Preview" />
          ) : (
            <div className="text-center text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-3 opacity-20" />
              <p className="text-sm">PDF preview will appear here</p>
              <p className="text-xs mt-1">Add content blocks and click "Generate & Preview"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function SettingsSection({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-md border border-border">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        {title}
        <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  )
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-24 flex-shrink-0 capitalize">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" />
    </div>
  )
}

function NumberField({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-24 flex-shrink-0 capitalize">{label}</label>
      <input type="number" value={value} step={step} min={min} max={max} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" />
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: (string | { value: string; label: string })[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-24 flex-shrink-0 capitalize">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs">
        {options.map(o => {
          const val = typeof o === "string" ? o : o.value
          const lbl = typeof o === "string" ? (o || "(none)") : o.label
          return <option key={val} value={val}>{lbl}</option>
        })}
      </select>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-24 flex-shrink-0 capitalize">{label}</label>
      <button onClick={() => onChange(!checked)} className={cn("w-8 h-4 rounded-full transition-colors relative", checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  )
}

function BlockProperties({ block, onChange }: { block: ContentBlock; onChange: (c: Partial<ContentBlock>) => void }) {
  switch (block.type) {
    case "text":
      return (
        <div className="space-y-2">
          <textarea value={block.text ?? ""} onChange={e => onChange({ text: e.target.value })} className="w-full rounded border border-border bg-background px-2 py-1 text-xs h-20 resize-none" placeholder="Text content" />
          <NumberField label="Font size" value={block.fontSize ?? 12} onChange={v => onChange({ fontSize: v })} />
          <Field label="Color" value={block.color ?? "#000000"} onChange={v => onChange({ color: v })} />
          <Select label="Align" value={block.align ?? "left"} options={["left", "center", "right", "justify"]} onChange={v => onChange({ align: v })} />
          <div className="flex gap-1">
            <button onClick={() => onChange({ bold: !block.bold })} className={cn("rounded border px-2 py-1 text-xs", block.bold ? "bg-primary text-primary-foreground" : "border-border")}><Bold className="w-3 h-3" /></button>
            <button onClick={() => onChange({ italic: !block.italic })} className={cn("rounded border px-2 py-1 text-xs", block.italic ? "bg-primary text-primary-foreground" : "border-border")}><Italic className="w-3 h-3" /></button>
            <button onClick={() => onChange({ underline: !block.underline })} className={cn("rounded border px-2 py-1 text-xs", block.underline ? "bg-primary text-primary-foreground" : "border-border")}><Underline className="w-3 h-3" /></button>
          </div>
        </div>
      )
    case "image":
      return (
        <div className="space-y-2">
          <Field label="Image (base64)" value={block.src ?? ""} onChange={v => onChange({ src: v })} />
          <NumberField label="Width" value={block.width ?? 200} onChange={v => onChange({ width: v })} />
          <Select label="Align" value={block.align ?? "center"} options={["left", "center", "right"]} onChange={v => onChange({ align: v })} />
          <Field label="Caption" value={block.caption ?? ""} onChange={v => onChange({ caption: v })} />
        </div>
      )
    case "shape":
      return (
        <div className="space-y-2">
          <Select label="Shape" value={block.shape ?? "rect"} options={["line", "rect", "roundedRect", "ellipse", "circle", "polygon", "path"]} onChange={v => onChange({ shape: v })} />
          <NumberField label="Width" value={block.width ?? 200} onChange={v => onChange({ width: v })} />
          <NumberField label="Height" value={block.height ?? 50} onChange={v => onChange({ height: v })} />
          <Field label="Fill" value={block.fill ?? ""} onChange={v => onChange({ fill: v })} />
          <Field label="Stroke" value={block.stroke ?? ""} onChange={v => onChange({ stroke: v })} />
          <NumberField label="Stroke width" value={block.strokeWidth ?? 1} onChange={v => onChange({ strokeWidth: v })} />
        </div>
      )
    case "barcode":
      return (
        <div className="space-y-2">
          <Select label="Format" value={block.format ?? "qr"} options={["qr", "code128", "code39", "ean13", "ean8", "upca", "pdf417", "datamatrix"]} onChange={v => onChange({ format: v })} />
          <Field label="Data" value={block.data ?? ""} onChange={v => onChange({ data: v })} />
          <NumberField label="Width" value={block.width ?? 150} onChange={v => onChange({ width: v })} />
          <NumberField label="Height" value={block.height ?? 150} onChange={v => onChange({ height: v })} />
          <Select label="Align" value={block.align ?? "center"} options={["left", "center", "right"]} onChange={v => onChange({ align: v })} />
        </div>
      )
    case "formField":
      return (
        <div className="space-y-2">
          <Select label="Field type" value={block.fieldType ?? "text"} options={["text", "checkbox", "radio", "dropdown", "signature"]} onChange={v => onChange({ fieldType: v })} />
          <Field label="Name" value={block.name ?? ""} onChange={v => onChange({ name: v })} />
          <Field label="Label" value={block.label ?? ""} onChange={v => onChange({ label: v })} />
          <Field label="Value" value={block.value ?? ""} onChange={v => onChange({ value: v })} />
          <NumberField label="Width" value={block.width ?? 200} onChange={v => onChange({ width: v })} />
          {(block.fieldType === "radio" || block.fieldType === "dropdown") && (
            <Field label="Options (comma)" value={(block.options ?? []).join(",")} onChange={v => onChange({ options: v.split(",").map((s: string) => s.trim()) })} />
          )}
        </div>
      )
    case "hyperlink":
      return (
        <div className="space-y-2">
          <Field label="Text" value={block.text ?? ""} onChange={v => onChange({ text: v })} />
          <Field label="URL" value={block.url ?? ""} onChange={v => onChange({ url: v })} />
          <Field label="Color" value={block.color ?? "#2563eb"} onChange={v => onChange({ color: v })} />
        </div>
      )
    case "spacer":
      return <NumberField label="Height (pt)" value={block.height ?? 20} onChange={v => onChange({ height: v })} />
    case "table":
      return (
        <div className="space-y-2">
          <Select label="Style" value={block.style ?? "grid"} options={["grid", "striped", "minimal", "bordered"]} onChange={v => onChange({ style: v })} />
          <Field label="Header bg" value={block.headerBackground ?? "#4f46e5"} onChange={v => onChange({ headerBackground: v })} />
          <Field label="Header color" value={block.headerColor ?? "#ffffff"} onChange={v => onChange({ headerColor: v })} />
          <p className="text-[10px] text-muted-foreground">Edit table data in the API tab for complex tables</p>
        </div>
      )
    default:
      return <p className="text-xs text-muted-foreground italic">No editable properties for this block type</p>
  }
}
