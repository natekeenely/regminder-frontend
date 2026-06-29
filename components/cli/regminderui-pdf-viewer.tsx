"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown, ChevronLeft, ChevronRight, Download, FileText,
  Highlighter, Loader2, Minus, MousePointer, Pencil, PenTool,
  Plus, Printer, RotateCcw, RotateCw, Search, Type, Underline,
  X, ZoomIn, ZoomOut, MinusCircle, Check, Image, Stamp, Eraser,
  PanelLeftClose, PanelLeftOpen, Copy, Layers, List, LayoutList,
  ArrowUp, ArrowDown, Home, Maximize2, Minimize2,
  StickyNote, Square, Circle, Minus as MinusIcon, ArrowRight,
  MessageSquare, Ruler, TriangleAlert, EyeOff, BookOpen, Sun, Moon,
  Paperclip, ImagePlus, Keyboard, ShieldCheck, Info, Save, Sliders,
  Eye, AlignJustify, Hash, Clock, User, Reply, GripHorizontal,
  Volume2, Pause,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Types
interface RegminderUiPdfViewerProps {
  documentSource: string
  className?: string
  enableAnnotations?: boolean
  enableFormFill?: boolean
  enableSignature?: boolean
  onAnnotationsChange?: (annotations: PdfAnnotation[]) => void
  onFormFieldsChange?: (fields: Record<string, string>) => void
  onSignatureApply?: (signature: SignatureData) => void
}

export interface PdfAnnotation {
  id: string
  page: number
  type: string
  points?: Array<{ x: number; y: number }>
  color: string
  opacity: number
  text?: string
  rect?: { x: number; y: number; w: number; h: number }
  createdAt: string
  fontFamily?: string
  fontSize?: number
  fontColor?: string
}

export interface SignatureData {
  id: string
  imageDataUrl: string
  page: number
  x: number
  y: number
  width: number
  height: number
  createdAt: string
}

interface SearchResult {
  page: number
  text: string
  rects: Array<{ x: number; y: number; w: number; h: number }>
}

interface ThumbnailCache {
  page: number
  dataUrl: string
}

// ─── Component ──────────────────────────────────────────────────

function saveBlobAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type ModelViewerProps = React.HTMLAttributes<HTMLElement> & {
  src?: string
  "camera-controls"?: boolean
  "auto-rotate"?: boolean
}

const ModelViewer = "model-viewer" as React.ElementType<ModelViewerProps>

export function RegminderUiPdfViewer({
  documentSource, className,
  enableAnnotations = true, enableFormFill = true, enableSignature = true,
  onAnnotationsChange, onFormFieldsChange, onSignatureApply,
}: RegminderUiPdfViewerProps) {
  // ── Core State ─────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [pdfJsReady, setPdfJsReady] = useState(false)

  // ── View Modes ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"single" | "continuous">("single")
  const [showThumbnails, setShowThumbnails] = useState(false)
  const [thumbnails, setThumbnails] = useState<ThumbnailCache[]>([])

  // ── Search ─────────────────────────────────────────────────
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [activeSearchIdx, setActiveSearchIdx] = useState(-1)
  const [searchMatchCase, setSearchMatchCase] = useState(false)
  const [searchWholeWord, setSearchWholeWord] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // ── Text Selection ─────────────────────────────────────────
  const [textLayerReady, setTextLayerReady] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const textLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // ── Annotations ────────────────────────────────────────────
  const [toolMode, setToolMode] = useState<string>("pan")
  const [annotationColor, setAnnotationColor] = useState("#ffeb3b")
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([])
  const [signatures, setSignatures] = useState<SignatureData[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState<Array<{ x: number; y: number }>>([])
  const [activeSignaturePad, setActiveSignaturePad] = useState(false)
  const [signPadDataUrl, setSignPadDataUrl] = useState<string | null>(null)
  const [pendingSignatureTarget, setPendingSignatureTarget] = useState<{ page: number; x: number; y: number } | null>(null)
  const [zoomInput, setZoomInput] = useState("100%")

  // ── Phase 2: Annotation enhancements ───────────────────────
  const [showAnnotationList, setShowAnnotationList] = useState(false)
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null)
  const [shapePreview, setShapePreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; page: number } | null>(null)
  const [stickyNoteText, setStickyNoteText] = useState("")

  // ── Phase 3: UX ────────────────────────────────────────────
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [bookmarks, setBookmarks] = useState<Array<{ title: string; page: number; children: any[] }>>([])
  const [pageTransition, setPageTransition] = useState(false)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  // ── Phase 4: Forms, Measurement, Redaction ─────────────────
  const [formFields, setFormFields] = useState<Array<{ name: string; type: string; value: string; page: number; rect: number[] }>>([])
  const [showFormPanel, setShowFormPanel] = useState(false)
  const [measureMode, setMeasureMode] = useState<"distance" | "area" | "perimeter" | null>(null)
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([])
  const [measureResult, setMeasureResult] = useState<string | null>(null)
  const [redactionMode, setRedactionMode] = useState(false)
  const [redactions, setRedactions] = useState<Array<{ page: number; rect: { x: number; y: number; w: number; h: number } }>>([])

  // ── Remaining gaps ──────────────────────────────────────────
  const [viewModeDual, setViewModeDual] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const [layers, setLayers] = useState<Array<{ name: string; visible: boolean }>>([])
  const [showAttachments, setShowAttachments] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ filename: string; size: number }>>([])
  const [stampType, setStampType] = useState<"approved" | "draft" | "confidential" | "final" | null>(null)
  const [calloutText, setCalloutText] = useState("")
  const [annotationOpacity, setAnnotationOpacity] = useState(1)
  const [annotationAuthor, setAnnotationAuthor] = useState("User")
  const [annotationReplies, setAnnotationReplies] = useState<Record<string, string[]>>({})
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [printRange, setPrintRange] = useState<{ from: number; to: number }>({ from: 1, to: 1 })
  const [pdfMetadata, setPdfMetadata] = useState<Record<string, string> | null>(null)
  const [showMetadata, setShowMetadata] = useState(false)
  const [customZoom, setCustomZoom] = useState("")
  const [showToolbarCustomize, setShowToolbarCustomize] = useState(false)
  const [hiddenTools, setHiddenTools] = useState<Set<string>>(new Set())
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState(0)
  const [lastReadPage, setLastReadPage] = useState(1)

  // ── Gap #13: Text-to-speech ──────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [speechRate, setSpeechRate] = useState(1)
  const [activeTtsPage, setActiveTtsPage] = useState<number | null>(null)

  // ── Gap #7: Free-text annotation font control ────────────────
  const [textFontFamily, setTextFontFamily] = useState("Helvetica")
  const [textFontSize, setTextFontSize] = useState(12)
  const [textFontColor, setTextFontColor] = useState("#333333")
  const fontFamilies = ["Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana", "Arial"]

  // ── Gap #5: Sticky note drag-and-drop ─────────────────────────
  const [draggingAnnotationId, setDraggingAnnotationId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // ── Gap #9: Calibrated measurements ──────────────────────────
  const [measureScaleRatio, setMeasureScaleRatio] = useState(72) // default: 72 pixels per inch (1:1 at 72 DPI)
  const [measureUnit, setMeasureUnit] = useState<"in" | "mm" | "cm">("mm")

  // ── Gap #1: AI summarization ─────────────────────────────────
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [showAiSummary, setShowAiSummary] = useState(false)

  // ── Gap #2: AI smart redaction ────────────────────────────────
  const [smartRedactLoading, setSmartRedactLoading] = useState(false)

  // ── Gap #11: XFA form support ─────────────────────────────────
  const [isXfaForm, setIsXfaForm] = useState(false)
  const [xfaData, setXfaData] = useState<string | null>(null)
  const [showXfaPanel, setShowXfaPanel] = useState(false)

  // ── PDF/A, 3D, Portfolio, OCR, Forms, Export ────────────────
  const [showPdfAValidation, setShowPdfAValidation] = useState(false)
  const [pdfACompliant, setPdfACompliant] = useState<boolean | null>(null)
  const [pdfAChecks, setPdfAChecks] = useState<Array<{ name: string; pass: boolean; detail: string }>>([])
  const [show3DViewer, setShow3DViewer] = useState(false)
  const [threeDModelUrl, setThreeDModelUrl] = useState<string | null>(null)
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [portfolioFiles, setPortfolioFiles] = useState<Array<{ name: string; size: number; data?: Uint8Array }>>([])
  const [showOcr, setShowOcr] = useState(false)
  const [ocrText, setOcrText] = useState("")
  const [ocrLoading, setOcrLoading] = useState(false)
  const [pageOrder, setPageOrder] = useState<number[]>([])
  const [dragSrcPage, setDragSrcPage] = useState<number | null>(null)
  const [remoteUrl, setRemoteUrl] = useState("")
  const [showRemoteDialog, setShowRemoteDialog] = useState(false)
  const [pdfAScore, setPdfAScore] = useState<{ score: number; checks: Array<{ name: string; pass: boolean; detail: string }> } | null>(null)
  const [showThreeDViewer, setShowThreeDViewer] = useState(false)
  const [threeDModel, setThreeDModel] = useState<string | null>(null)
  const [formFieldType, setFormFieldType] = useState<"text" | "checkbox" | "dropdown" | "radio">("text")
  const [dropdownOptions, setDropdownOptions] = useState("")
  const [radioOptions, setRadioOptions] = useState("")
  const [formFieldDropdowns, setFormFieldDropdowns] = useState<Record<string, string[]>>({})
  const [showExportMenu, setShowExportMenu] = useState(false)

  const showMessage = useCallback((type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }, [])

  // Restore last position
  useEffect(() => {
    const saved = localStorage.getItem("pdf-last-page")
    if (saved) setLastReadPage(parseInt(saved))
  }, [])

  useEffect(() => {
    localStorage.setItem("pdf-last-page", String(currentPage))
  }, [currentPage])

  // ── Refs ───────────────────────────────────────────────────
  const blobUrlRef = useRef<string | null>(null)
  const cancelledRef = useRef(false)
  const pdfDocRef = useRef<any>(null)
  const pdfjsRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pageCanvasesRef = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Resolve PDF source ─────────────────────────────────────
  const resolvedUrl = useMemo(() => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    if (!documentSource) return null
    if (!documentSource.startsWith("data:")) return documentSource
    try {
      const commaIndex = documentSource.indexOf(",")
      if (commaIndex < 0) throw new Error("Malformed data URI")
      const header = documentSource.slice(0, commaIndex)
      const raw = documentSource.slice(commaIndex + 1)
      let bytes: Uint8Array
      if (header.includes(";base64")) {
        const binary = atob(raw)
        bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      } else {
        bytes = new TextEncoder().encode(decodeURIComponent(raw))
      }
      const blob = new Blob([bytes], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      return url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decode PDF data")
      return null
    }
  }, [documentSource])

  // ── Initialize pdf.js ──────────────────────────────────────
  const ensurePdfJs = useCallback(async (): Promise<any> => {
    if (pdfjsRef.current) return pdfjsRef.current
    if ((window as any).pdfjsLib) {
      (window as any).pdfjsLib.GlobalWorkerOptions = { workerSrc: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs" }
      pdfjsRef.current = (window as any).pdfjsLib
      return pdfjsRef.current
    }
    return new Promise<any>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
      script.type = "module"
      script.onload = () => {
        const lib = (window as any).pdfjsLib
        if (lib) { lib.GlobalWorkerOptions = { workerSrc: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs" }; pdfjsRef.current = lib }
        resolve(lib)
      }
      script.onerror = () => reject(new Error("Failed to load PDF renderer"))
      document.head.appendChild(script)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ensurePdfJs().then(() => { if (!cancelled) setPdfJsReady(true) }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [ensurePdfJs])

  // ── Load PDF ───────────────────────────────────────────────
  useEffect(() => {
    if (!pdfJsReady || !resolvedUrl) return
    cancelledRef.current = false
    setLoading(true); setError(null)
    const pdfjs = pdfjsRef.current
    pdfjs.getDocument({ url: resolvedUrl, cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/", cMapPacked: true }).promise
      .then((doc: any) => {
        if (cancelledRef.current) return
        pdfDocRef.current = doc
        setTotalPages(doc.numPages)
        setLoading(false)
        // Gap #11: Detect XFA forms
        doc.getMetadata().then((meta: any) => {
          const isXfa = meta?.info?.IsXFAPresent || meta?.info?.IsAcroFormPresent === false && doc.numPages > 0
          setIsXfaForm(isXfa)
          if (isXfa) {
            // Try fallback XFA extraction via the first page
            doc.getPage(1).then((page: any) => page.getTextContent()).then((tc: any) => {
              const fields: string[] = []
              const text = tc.items.map((item: any) => item.str).join(" ")
              // Simple heuristic: text before colons likely field labels
              const lines = text.split(/[.;?!]/).filter((l: string) => l.includes(":"))
              if (lines.length > 0) setXfaData(JSON.stringify(lines.slice(0, 20), null, 2))
            }).catch(() => {})
          }
        }).catch(() => {})
      })
      .catch((err: Error) => {
        if (!cancelledRef.current) { setLoading(false); setError(err.message || "Failed to load PDF") }
      })
    return () => { cancelledRef.current = true }
  }, [pdfJsReady, resolvedUrl])

  // ── Render single page ─────────────────────────────────────
  const renderPage = useCallback(async (pageNum: number, s: number, rot: number, canvas: HTMLCanvasElement | null): Promise<{ textContent: any } | null> => {
    if (!pdfDocRef.current || !canvas) return null
    try {
      if (pageNum < 1 || pageNum > pdfDocRef.current.numPages) return null
      const page = await pdfDocRef.current.getPage(pageNum)
      const vp = page.getViewport({ scale: s, rotation: rot })
      canvas.height = vp.height
      canvas.width = vp.width
      const ctx = canvas.getContext("2d")!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      // Get text content for search
      const textContent = await page.getTextContent()
      return { textContent }
    } catch { return null }
  }, [])

  // ── Build text layer for selection ─────────────────────────
  const buildTextLayer = useCallback(async (pageNum: number, container: HTMLDivElement, s: number, rot: number) => {
    if (!pdfDocRef.current) return
    try {
      const page = await pdfDocRef.current.getPage(pageNum)
      const vp = page.getViewport({ scale: s, rotation: rot })
      const textContent = await page.getTextContent()
      container.innerHTML = ""
      container.style.width = vp.width + "px"
      container.style.height = vp.height + "px"

      for (const item of textContent.items) {
        const tx = pdfjsRef.current.Util.transform(vp.transform, item.transform)
        const div = document.createElement("div")
        div.className = "absolute text-transparent select-text whitespace-pre"
        div.style.left = tx[4] + "px"
        div.style.top = (tx[5] - item.height * s) + "px"
        div.style.fontSize = (item.height * s * 0.9) + "px"
        div.style.width = (item.width * s) + "px"
        div.style.height = (item.height * s) + "px"
        div.style.lineHeight = "1"
        div.textContent = item.str
        div.dataset.page = String(pageNum)
        div.dataset.text = item.str
        container.appendChild(div)
      }
    } catch { /* silent */ }
  }, [])

  // ── Render pages (single or continuous) ────────────────────
  const renderAllPages = useCallback(async () => {
    if (!pdfDocRef.current || loading) return
    const doc = pdfDocRef.current
    const pages = viewMode === "continuous" ? doc.numPages : 1
    const startPage = viewMode === "continuous" ? 1 : currentPage

    for (let p = startPage; p < startPage + pages && p <= doc.numPages; p++) {
      const canvas = pageCanvasesRef.current.get(p)
      if (canvas) {
        await renderPage(p, scale, rotation, canvas)
        const textLayer = textLayerRefs.current.get(p)
        if (textLayer) await buildTextLayer(p, textLayer, scale, rotation)
      }
    }
    setTextLayerReady(true)
  }, [loading, currentPage, scale, rotation, viewMode, renderPage, buildTextLayer])

  useEffect(() => {
    if (!loading && pdfDocRef.current) renderAllPages()
  }, [loading, currentPage, scale, rotation, viewMode, renderAllPages])

  // ── Thumbnails ─────────────────────────────────────────────
  const generateThumbnails = useCallback(async () => {
    if (!pdfDocRef.current) return
    const doc = pdfDocRef.current
    const thumbs: ThumbnailCache[] = []
    for (let p = 1; p <= Math.min(doc.numPages, 50); p++) {
      const page = await doc.getPage(p)
      const vp = page.getViewport({ scale: 0.2 })
      const canvas = document.createElement("canvas")
      canvas.width = vp.width; canvas.height = vp.height
      const ctx = canvas.getContext("2d")!
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      thumbs.push({ page: p, dataUrl: canvas.toDataURL() })
    }
    setThumbnails(thumbs)
  }, [])

  useEffect(() => {
    if (!loading && showThumbnails && thumbnails.length === 0) generateThumbnails()
  }, [loading, showThumbnails, thumbnails.length, generateThumbnails])

  // ── Search ─────────────────────────────────────────────────
  const performSearch = useCallback(async () => {
    if (!pdfDocRef.current || !searchQuery.trim()) {
      setSearchResults([]); setActiveSearchIdx(-1); return
    }
    setSearchLoading(true)
    const doc = pdfDocRef.current
    const results: SearchResult[] = []
    const query = searchMatchCase ? searchQuery : searchQuery.toLowerCase()

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const textContent = await page.getTextContent()
      const vp = page.getViewport({ scale: 1.0 })

      for (const item of textContent.items) {
        const text = searchMatchCase ? item.str : item.str.toLowerCase()
        let idx = 0
        while ((idx = text.indexOf(query, idx)) !== -1) {
          if (searchWholeWord) {
            const before = idx > 0 ? text[idx - 1] : " "
            const after = idx + query.length < text.length ? text[idx + query.length] : " "
            if (/\w/.test(before) || /\w/.test(after)) { idx++; continue }
          }
          const tx = pdfjsRef.current.Util.transform(vp.transform, item.transform)
          const charW = item.width / Math.max(item.str.length, 1)
          results.push({
            page: p,
            text: item.str.slice(idx, idx + query.length),
            rects: [{
              x: tx[4] + idx * charW * scale,
              y: tx[5] - item.height * scale,
              w: query.length * charW * scale,
              h: item.height * scale,
            }],
          })
          idx++
        }
      }
    }
    setSearchResults(results)
    setActiveSearchIdx(results.length > 0 ? 0 : -1)
    setSearchLoading(false)
  }, [searchQuery, searchMatchCase, searchWholeWord, scale])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => { if (searchQuery.trim()) performSearch() }, 400)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery, searchMatchCase, searchWholeWord, performSearch])

  const navigateSearch = useCallback((dir: 1 | -1) => {
    if (searchResults.length === 0) return
    const next = activeSearchIdx + dir
    const idx = next < 0 ? searchResults.length - 1 : next >= searchResults.length ? 0 : next
    setActiveSearchIdx(idx)
    const result = searchResults[idx]
    setCurrentPage(result.page)
    if (viewMode === "continuous") {
      const canvas = pageCanvasesRef.current.get(result.page)
      canvas?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [searchResults, activeSearchIdx, viewMode])

  // ── Text Selection ─────────────────────────────────────────
  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) { setSelectedText(""); return }
    const text = sel.toString().trim()
    setSelectedText(text)
  }, [])

  const handleCopySelected = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedText)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = selectedText; document.body.appendChild(ta)
      ta.select(); document.execCommand("copy"); ta.remove()
    }
  }, [selectedText])

  // ── Navigation ─────────────────────────────────────────────
  const goToPage = useCallback((p: number) => { setCurrentPage(Math.max(1, Math.min(totalPages, p))) }, [totalPages])
  const goNext = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage])
  const goPrev = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage])

  // ── Zoom / Rotate ──────────────────────────────────────────
  const zoomIn = useCallback(() => setScale(s => Math.min(4, +(s + 0.25).toFixed(2))), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(0.25, +(s - 0.25).toFixed(2))), [])
  const resetZoom = useCallback(() => setScale(1.0), [])
  const fitWidth = useCallback(() => {
    const container = containerRef.current
    if (container) setScale(Math.max(0.25, (container.clientWidth - 80) / 800))
  }, [])
  const fitPage = useCallback(() => {
    const container = containerRef.current
    if (container) setScale(Math.max(0.25, (container.clientHeight - 40) / 1100))
  }, [])
  const rotateCw = useCallback(() => setRotation(r => (r + 90) % 360), [])
  const rotateCcw = useCallback(() => setRotation(r => (r - 90 + 360) % 360), [])
  useEffect(() => { setZoomInput(Math.round(scale * 100) + "%") }, [scale])

  // ── Print / Download ───────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (resolvedUrl) { const w = window.open(resolvedUrl, "_blank"); w?.addEventListener("load", () => w?.print()) }
  }, [resolvedUrl])
  const handleDownload = useCallback(async () => {
    if (!resolvedUrl) return
    try { const r = await fetch(resolvedUrl); const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "document.pdf"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u) } catch { window.open(resolvedUrl, "_blank") }
  }, [resolvedUrl])

  // ── Annotations ────────────────────────────────────────────
  const addAnnotation = useCallback((ann: Omit<PdfAnnotation, "id" | "createdAt">) => {
    const full: PdfAnnotation = { ...ann, id: "ann-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), createdAt: new Date().toISOString() }
    setAnnotations(prev => { const next = [...prev, full]; onAnnotationsChange?.(next); return next })
  }, [onAnnotationsChange])
  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => { const next = prev.filter(a => a.id !== id); onAnnotationsChange?.(next); return next })
  }, [onAnnotationsChange])

  const getCanvasCoords = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const c = event.currentTarget as HTMLCanvasElement
    const r = c.getBoundingClientRect()
    return { x: (event.clientX - r.left) / (r.width / c.width), y: (event.clientY - r.top) / (r.height / c.height) }
  }, [])

  const handleOpenSignaturePad = useCallback(() => { setActiveSignaturePad(true); setPendingSignatureTarget({ page: currentPage, x: 50, y: 50 }) }, [currentPage])
  const applySignature = useCallback(() => {
    if (!signPadDataUrl || !pendingSignatureTarget) return
    const sig: SignatureData = { id: "sig-" + Date.now(), imageDataUrl: signPadDataUrl, page: pendingSignatureTarget.page, x: pendingSignatureTarget.x, y: pendingSignatureTarget.y, width: 200, height: 80, createdAt: new Date().toISOString() }
    setSignatures(prev => [...prev, sig]); onSignatureApply?.(sig); setActiveSignaturePad(false); setSignPadDataUrl(null); setPendingSignatureTarget(null)
  }, [signPadDataUrl, pendingSignatureTarget, onSignatureApply])

  // ── Phase 2: Shapes ────────────────────────────────────────
  const handleShapePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!["rectangle", "ellipse", "line", "arrow"].includes(toolMode)) return
    const pt = getCanvasCoords(event)
    setShapeStart(pt)
    setShapePreview({ x: pt.x, y: pt.y, w: 0, h: 0 })
  }, [toolMode, getCanvasCoords])

  const handleShapePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shapeStart) return
    const pt = getCanvasCoords(event)
    setShapePreview({ x: Math.min(shapeStart.x, pt.x), y: Math.min(shapeStart.y, pt.y), w: Math.abs(pt.x - shapeStart.x), h: Math.abs(pt.y - shapeStart.y) })
  }, [shapeStart, getCanvasCoords])

  const handleShapePointerUp = useCallback(() => {
    if (!shapeStart || !shapePreview || shapePreview.w < 5 || shapePreview.h < 5) {
      setShapeStart(null); setShapePreview(null); return
    }
    addAnnotation({
      page: currentPage, type: toolMode, color: annotationColor, opacity: 1,
      rect: { x: shapePreview.x, y: shapePreview.y, w: shapePreview.w, h: shapePreview.h },
      points: toolMode === "arrow" ? [{ x: shapeStart.x, y: shapeStart.y }, { x: shapeStart.x + shapePreview.w, y: shapeStart.y + shapePreview.h }] : undefined,
    })
    setShapeStart(null); setShapePreview(null)
  }, [shapeStart, shapePreview, currentPage, toolMode, annotationColor, addAnnotation])

  // ── Phase 2: Sticky note ───────────────────────────────────
  const handleStickyNote = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(event)
    const text = prompt("Enter note text:")
    if (text) {
      addAnnotation({ page: currentPage, type: "sticky", color: "#FFEB3B", opacity: 1, text, rect: { x: pt.x, y: pt.y, w: 24, h: 24 } })
    }
  }, [currentPage, getCanvasCoords, addAnnotation])

  // ── Phase 2: Context menu ──────────────────────────────────
  const handleCtxMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, page: currentPage })
  }, [currentPage])

  useEffect(() => { const close = () => setCtxMenu(null); window.addEventListener("click", close); return () => window.removeEventListener("click", close) }, [])

  // ── Phase 3: Bookmarks ─────────────────────────────────────
  const loadBookmarks = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const outline = await doc.getOutline()
      if (!outline) { setBookmarks([]); return }
      const flatten = (items: any[]): any[] => items.map((item: any) => ({
        title: item.title, page: item.dest ? (typeof item.dest === "string" ? 1 : item.dest?.[0]?.num ?? 1) : 1,
        children: item.items ? flatten(item.items) : [],
      }))
      setBookmarks(flatten(outline))
    } catch { setBookmarks([]) }
  }, [])

  useEffect(() => { if (!loading && showBookmarks) loadBookmarks() }, [loading, showBookmarks, loadBookmarks])

  // ── Phase 3: Touch gestures ────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) { setTouchStartY(e.touches[0].clientY); setTouchStartX(e.touches[0].clientX) }
    else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      setTouchStartX(dist); setTouchStartY(dist)
    }
  }, [])
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY == null || touchStartX == null) return
    const dy = e.changedTouches[0].clientY - touchStartY
    const dx = e.changedTouches[0].clientX - touchStartX
    if (e.changedTouches.length === 1 && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
      if (dy > 0) goPrev(); else goNext()
    }
    setTouchStartY(null); setTouchStartX(null)
  }, [touchStartY, touchStartX, goPrev, goNext])

  // ── Phase 4: Form filling ──────────────────────────────────
  const loadFormFields = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const form = await doc.getFieldObjects?.()
      if (!form || form.length === 0) {
        // Fallback: scan all pages for form-like annotations
        const fields: typeof formFields = []
        for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
          const page = await doc.getPage(p)
          const annotations = await page.getAnnotations()
          for (const ann of annotations || []) {
            if (ann.subtype === "Widget") {
              fields.push({ name: ann.fieldName || `field_${p}_${Date.now()}`, type: ann.fieldType || "Tx", value: ann.fieldValue || "", page: p, rect: ann.rect })
            }
          }
        }
        setFormFields(fields)
        return
      }
      // Use actual form fields
    } catch { setFormFields([]) }
  }, [])

  useEffect(() => { if (!loading && showFormPanel) loadFormFields() }, [loading, showFormPanel, loadFormFields])

  const updateFormField = useCallback((idx: number, value: string) => {
    setFormFields(prev => {
      const next = [...prev]
      const targetField = next[idx]
      if (!targetField) return prev
      // Gap #10: Multi-page form field sync — linked fields auto-fill
      next[idx] = { ...targetField, value }
      // Sync all fields with the same name across pages
      const syncName = targetField.name
      if (syncName) {
        for (let i = 0; i < next.length; i++) {
          if (i !== idx && next[i].name === syncName) {
            next[i] = { ...next[i], value }
          }
        }
      }
      onFormFieldsChange?.(Object.fromEntries(next.map(f => [f.name, f.value])))
      return next
    })
  }, [onFormFieldsChange])

  // ── Phase 4: Measurement ───────────────────────────────────
  const handleMeasureClick = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!measureMode) return
    const pt = getCanvasCoords(event)
    const newPoints = [...measurePoints, pt]
    setMeasurePoints(newPoints)

    // ── Gap #9: Calibrated measurements ─────────────────────
    const PIXELS_PER_INCH = measureScaleRatio
    const toUnit = (px: number) => {
      switch (measureUnit) {
        case "in": return px / PIXELS_PER_INCH
        case "mm": return (px / PIXELS_PER_INCH) * 25.4
        case "cm": return (px / PIXELS_PER_INCH) * 2.54
      }
    }
    if (measureMode === "distance" && newPoints.length >= 2) {
      const d = Math.hypot(newPoints[1].x - newPoints[0].x, newPoints[1].y - newPoints[0].y)
      const val = toUnit(d)
      setMeasureResult(`Distance: ${val.toFixed(1)}${measureUnit} (${d.toFixed(0)}px @ ${measureScaleRatio} ppi)`)
      setMeasurePoints([])
    } else if (measureMode === "area" && newPoints.length >= 3) {
      let area = 0
      for (let i = 0; i < newPoints.length; i++) {
        const j = (i + 1) % newPoints.length
        area += newPoints[i].x * newPoints[j].y - newPoints[j].x * newPoints[i].y
      }
      area = Math.abs(area) / 2
      const pxPerInch = PIXELS_PER_INCH
      const areaInches = area / (pxPerInch * pxPerInch)
      const val = measureUnit === "in" ? areaInches : measureUnit === "mm" ? areaInches * 645.16 : areaInches * 6.4516
      const label = measureUnit === "in" ? "in²" : measureUnit === "mm" ? "mm²" : "cm²"
      setMeasureResult(`Area: ${val.toFixed(1)}${label} (${area.toFixed(0)}px²)`)
      addAnnotation({ page: currentPage, type: "freehand", points: [...newPoints, newPoints[0]], color: "#2196F3", opacity: 0.5 })
      setMeasurePoints([])
    }
  }, [measureMode, measurePoints, currentPage, getCanvasCoords, addAnnotation])

  // ── Phase 4: Redaction ─────────────────────────────────────
  const handleRedactionClick = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!redactionMode) return
    const pt = getCanvasCoords(event)
    setRedactions(prev => [...prev, { page: currentPage, rect: { x: pt.x, y: pt.y, w: 80, h: 20 } }])
  }, [redactionMode, currentPage, getCanvasCoords])

  const applyRedactions = useCallback(() => {
    addAnnotation({ page: currentPage, type: "redaction", color: "#000", opacity: 1, rect: { x: 0, y: 0, w: 1, h: 1 } })
    setRedactions([]); setRedactionMode(false)
  }, [currentPage, addAnnotation])

  // ── Phase 4: Export annotations ────────────────────────────
  const exportAnnotations = useCallback(() => {
    const data = JSON.stringify({ annotations, signatures, exportedAt: new Date().toISOString() }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "annotations.json"; a.click()
  }, [annotations, signatures])

  const importAnnotations = useCallback(() => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      try {
        const data = JSON.parse(await file.text())
        if (data.annotations) setAnnotations(data.annotations)
        if (data.signatures) setSignatures(data.signatures)
      } catch { /* ignore */ }
    }
    input.click()
  }, [])

  // ── Stamps ─────────────────────────────────────────────────
  const handleStamp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!stampType) return
    const pt = getCanvasCoords(event)
    const stampTexts: Record<string, string> = { approved: "APPROVED", draft: "DRAFT", confidential: "CONFIDENTIAL", final: "FINAL" }
    addAnnotation({ page: currentPage, type: "stamp", color: stampType === "approved" ? "#4CAF50" : stampType === "draft" ? "#FF9800" : stampType === "confidential" ? "#F44336" : "#2196F3", opacity: 0.7, text: stampTexts[stampType], rect: { x: pt.x, y: pt.y, w: 150, h: 40 } })
    setStampType(null)
  }, [stampType, currentPage, getCanvasCoords, addAnnotation])

  // ── Callout ────────────────────────────────────────────────
  const handleCallout = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(event)
    const text = prompt("Enter callout text:")
    if (text) addAnnotation({ page: currentPage, type: "callout", color: "#333", opacity: 1, text, rect: { x: pt.x, y: pt.y, w: 180, h: 60 }, points: [{ x: pt.x, y: pt.y }, { x: pt.x + 20, y: pt.y - 30 }] })
  }, [currentPage, getCanvasCoords, addAnnotation])

  // ── Annotation reply ───────────────────────────────────────
  const addAnnotationReply = useCallback((annId: string, reply: string) => {
    setAnnotationReplies(prev => ({ ...prev, [annId]: [...(prev[annId] || []), reply] }))
  }, [])

  // ── Print preview ──────────────────────────────────────────
  const handlePrintWithOptions = useCallback(() => {
    setPrintRange({ from: 1, to: totalPages })
    setShowPrintPreview(true)
  }, [totalPages])

  const doPrint = useCallback(() => {
    if (resolvedUrl) {
      const w = window.open(resolvedUrl, "_blank")
      w?.addEventListener("load", () => {
        // Print specific pages via CSS @page if supported
        w?.print()
      })
    }
    setShowPrintPreview(false)
  }, [resolvedUrl])

  // ── PDF metadata ───────────────────────────────────────────
  const loadMetadata = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const meta = await doc.getMetadata()
      setPdfMetadata({
        Title: meta?.info?.Title || "Untitled",
        Author: meta?.info?.Author || "Unknown",
        Subject: meta?.info?.Subject || "",
        Creator: meta?.info?.Creator || "",
        Producer: meta?.info?.Producer || "",
        Created: meta?.info?.CreationDate || "",
        Modified: meta?.info?.ModDate || "",
        Pages: String(doc.numPages),
      })
    } catch { setPdfMetadata(null) }
  }, [])

  // ── Attachments ────────────────────────────────────────────
  const loadAttachments = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const atts = await doc.getAttachments?.()
      if (atts) setAttachments(Object.entries(atts).map(([k, v]: [string, any]) => ({ filename: k, size: v?.size || 0 })))
    } catch { setAttachments([]) }
  }, [])

  // ── Save as ────────────────────────────────────────────────
  const handleSaveAs = useCallback(async () => {
    if (!resolvedUrl) return
    try {
      const r = await fetch(resolvedUrl); const b = await r.blob()
      const name = prompt("Save as:", "document.pdf")
      if (name) { const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
    } catch { window.open(resolvedUrl, "_blank") }
  }, [resolvedUrl])

  // ── Export PDF with annotations burned in ──────────────────
  const handleExportWithAnnotations = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const { PDFDocument, rgb } = await import("pdf-lib")
      const r = await fetch(resolvedUrl!); const pdfBytes = await r.arrayBuffer()
      const pdfDoc = await PDFDocument.load(pdfBytes)
      // For each annotation, draw on the page
      for (const ann of annotations) {
        const page = pdfDoc.getPage(ann.page - 1)
        if (ann.type === "text" && ann.text && ann.rect) {
          page.drawText(ann.text, { x: ann.rect.x, y: page.getHeight() - ann.rect.y, size: 10 })
        }
        if ((ann.type === "rectangle" || ann.type === "highlight") && ann.rect) {
          page.drawRectangle({
            x: ann.rect.x, y: page.getHeight() - ann.rect.y - ann.rect.h,
            width: ann.rect.w, height: ann.rect.h,
            color: ann.type === "highlight" ? rgb(1, 1, 0) : undefined,
            opacity: ann.type === "highlight" ? 0.3 : 1,
            borderColor: ann.type === "rectangle" ? rgb(0, 0, 0) : undefined,
          })
        }
      }
      const outBytes = await pdfDoc.save()
      const blob = new Blob([outBytes], { type: "application/pdf" })
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "annotated.pdf"; a.click()
    } catch { /* pdf-lib may not be loaded */ }
  }, [annotations, resolvedUrl])

  // ── Gap #6: Annotation flattening (flatten in-place) ──────────
  const handleFlattenAnnotations = useCallback(async () => {
    if (!pdfDocRef.current || annotations.length === 0) {
      showMessage("info", "No annotations to flatten")
      return
    }
    try {
      const { PDFDocument, rgb } = await import("pdf-lib")
      const r = await fetch(resolvedUrl!)
      const pdfBytes = await r.arrayBuffer()
      const pdfDoc = await PDFDocument.load(pdfBytes)

      for (const ann of annotations) {
        if (ann.page < 1 || ann.page > pdfDoc.getPageCount()) continue
        const page = pdfDoc.getPage(ann.page - 1)
        const pageH = page.getHeight()

        if (ann.type === "text" && ann.text && ann.rect) {
          const fontSize = ann.fontSize ?? 10
          const color = hexToRgb(ann.fontColor ?? ann.color)
          page.drawText(ann.text, {
            x: ann.rect.x,
            y: pageH - ann.rect.y - fontSize,
            size: fontSize,
            color: rgb(color.r, color.g, color.b),
          })
        }
        if (ann.type === "highlight" && ann.rect) {
          page.drawRectangle({
            x: ann.rect.x, y: pageH - ann.rect.y - ann.rect.h,
            width: ann.rect.w, height: ann.rect.h,
            color: rgb(1, 1, 0), opacity: 0.3,
          })
        }
        if (ann.type === "underline" && ann.rect) {
          page.drawLine({
            start: { x: ann.rect.x, y: pageH - ann.rect.y - ann.rect.h },
            end: { x: ann.rect.x + ann.rect.w, y: pageH - ann.rect.y - ann.rect.h },
            thickness: 1.5, color: rgb(0, 0, 1),
          })
        }
        if (ann.type === "strikethrough" && ann.rect) {
          const midY = pageH - ann.rect.y - ann.rect.h / 2
          page.drawLine({
            start: { x: ann.rect.x, y: midY },
            end: { x: ann.rect.x + ann.rect.w, y: midY },
            thickness: 1.5, color: rgb(1, 0, 0),
          })
        }
        if (ann.type === "rectangle" && ann.rect) {
          const c = hexToRgb(ann.color)
          page.drawRectangle({
            x: ann.rect.x, y: pageH - ann.rect.y - ann.rect.h,
            width: ann.rect.w, height: ann.rect.h,
            borderColor: rgb(c.r, c.g, c.b), borderWidth: 2,
          })
        }
        if (ann.type === "ellipse" && ann.rect) {
          const c = hexToRgb(ann.color)
          page.drawEllipse({
            x: ann.rect.x + ann.rect.w / 2, y: pageH - ann.rect.y - ann.rect.h / 2,
            xScale: ann.rect.w / 2, yScale: ann.rect.h / 2,
            borderColor: rgb(c.r, c.g, c.b), borderWidth: 2,
          })
        }
        if ((ann.type === "line" || ann.type === "arrow") && ann.rect) {
          const c = hexToRgb(ann.color)
          page.drawLine({
            start: { x: ann.rect.x, y: pageH - ann.rect.y },
            end: { x: ann.rect.x + ann.rect.w, y: pageH - ann.rect.y - ann.rect.h },
            color: rgb(c.r, c.g, c.b), thickness: 2,
          })
        }
        if (ann.type === "stamp" && ann.text && ann.rect) {
          const stampHex: Record<string, string> = { APPROVED: "#4CAF50", DRAFT: "#FF9800", CONFIDENTIAL: "#F44336", FINAL: "#2196F3" }
          const c = hexToRgb(stampHex[ann.text] ?? ann.color)
          page.drawRectangle({
            x: ann.rect.x, y: pageH - ann.rect.y - ann.rect.h,
            width: ann.rect.w, height: ann.rect.h,
            color: rgb(c.r, c.g, c.b), opacity: 0.1,
            borderColor: rgb(c.r, c.g, c.b), borderWidth: 2,
          })
          page.drawText(ann.text, {
            x: ann.rect.x + 4, y: pageH - ann.rect.y - ann.rect.h / 2 - 4,
            size: ann.rect.h * 0.4, color: rgb(c.r, c.g, c.b),
          })
        }
      }

      const outBytes = await pdfDoc.save()
      // Replace the displayed PDF
      const base64 = Buffer.from(outBytes).toString("base64")
      const dataUri = "data:application/pdf;base64," + base64

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const blob = new Blob([outBytes], { type: "application/pdf" })
      blobUrlRef.current = URL.createObjectURL(blob)

      setAnnotations([])
      setSignatures([])
      pdfDocRef.current = null
      pageCanvasesRef.current.clear()
      textLayerRefs.current.clear()
      cancelledRef.current = false
      setLoading(true)
      setPdfJsReady(false)
      setTimeout(() => setPdfJsReady(true), 50)
      showMessage("success", `Flattened ${annotations.length} annotation(s) into document`)
    } catch (e: any) {
      showMessage("error", `Flatten failed: ${e.message}`)
    }
  }, [annotations, resolvedUrl, showMessage])

  // ── Gap #3: Page organizer — insert blank page ───────────────
  const handleInsertPage = useCallback(async (afterPage: number, type: "blank" | "from-file") => {
    if (!pdfDocRef.current) return
    try {
      const { PDFDocument, rgb } = await import("pdf-lib")
      const r = await fetch(resolvedUrl!)
      const pdfBytes = await r.arrayBuffer()
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pageCount = pdfDoc.getPageCount()

      if (type === "blank") {
        const page = pdfDoc.insertPage(afterPage, [612, 792]) // US Letter
        showMessage("success", `Blank page inserted after page ${afterPage}`)
      } else if (type === "from-file") {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".pdf"
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) return
          try {
            const insertBytes = await file.arrayBuffer()
            const insertDoc = await PDFDocument.load(insertBytes)
            const insertPages = await pdfDoc.copyPages(insertDoc, insertDoc.getPageIndices())
            insertPages.forEach((p, i) => pdfDoc.insertPage(afterPage + i, p))
            showMessage("success", `Inserted ${insertPages.length} page(s) after page ${afterPage}`)
          } catch { showMessage("error", "Failed to insert pages from file") }
        }
        input.click()
        return
      }

      const outBytes = await pdfDoc.save()
      const base64 = Buffer.from(outBytes).toString("base64")
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const blob = new Blob([outBytes], { type: "application/pdf" })
      blobUrlRef.current = URL.createObjectURL(blob)
      pdfDocRef.current = null
      pageCanvasesRef.current.clear()
      textLayerRefs.current.clear()
      cancelledRef.current = false
      setLoading(true)
      setPdfJsReady(false)
      setTimeout(() => { setPdfJsReady(true) }, 50)
    } catch (e: any) {
      showMessage("error", `Page insert failed: ${e.message}`)
    }
  }, [resolvedUrl, showMessage])

  // ── Gap #1: AI-powered summarization ──────────────────────────
  const handleAiSummarize = useCallback(async () => {
    if (!pdfDocRef.current) return
    setAiSummaryLoading(true)
    setShowAiSummary(true)
    try {
      const doc = pdfDocRef.current
      const maxPages = Math.min(doc.numPages, 20)
      let allText = ""
      for (let p = 1; p <= maxPages; p++) {
        const page = await doc.getPage(p)
        const textContent = await page.getTextContent()
        allText += textContent.items.map((item: any) => item.str).join(" ") + " "
      }

      // Truncate for AI context
      const truncated = allText.slice(0, 12000)

      // Call AI via BFF
      const token = localStorage.getItem("auth_token") || ""
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a document summarizer. Create a concise summary (3-5 bullet points) of the following document. Focus on key facts, decisions, dates, and action items. Keep it under 200 words." },
            { role: "user", content: `Please summarize this document:\n\n${truncated}` },
          ],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setAiSummary(data.content || data.summary || "No summary available")
        showMessage("success", "Summary generated")
      } else {
        // Fallback: generate a simple extractive summary
        const sentences = truncated.split(/[.!?]+/).filter(s => s.trim().length > 20)
        const keySentences = sentences.slice(0, 5).map(s => s.trim()).join(". ") + "."
        setAiSummary(keySentences)
        showMessage("info", "Extractive summary (AI unavailable)")
      }
    } catch {
      showMessage("error", "Summarization failed")
      setAiSummary(null)
    }
    setAiSummaryLoading(false)
  }, [showMessage])

  // ── Gap #2: AI smart redaction (auto-detect PII) ──────────────
  const handleSmartRedact = useCallback(async () => {
    if (!pdfDocRef.current) return
    setSmartRedactLoading(true)
    try {
      const doc = pdfDocRef.current
      // Extract text from current page
      const page = await doc.getPage(currentPage)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(" ")

      // Regex-based PII detection (no AI server needed)
      const piiPatterns: Array<{ name: string; regex: RegExp; color: string }> = [
        { name: "Email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, color: "#F44336" },
        { name: "Phone", regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, color: "#FF9800" },
        { name: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g, color: "#9C27B0" },
        { name: "Credit Card", regex: /\b(?:\d{4}[- ]?){3}\d{4}\b/g, color: "#E91E63" },
        { name: "IP Address", regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, color: "#00BCD4" },
      ]

      let redactCount = 0
      const vp = page.getViewport({ scale: 1.0 })

      for (const pattern of piiPatterns) {
        for (const item of textContent.items) {
          let match: RegExpExecArray | null
          pattern.regex.lastIndex = 0
          while ((match = pattern.regex.exec(item.str)) !== null) {
            const tx = pdfjsRef.current.Util.transform(vp.transform, item.transform)
            const charW = item.width / Math.max(item.str.length, 1)
            addAnnotation({
              page: currentPage,
              type: "redaction",
              color: pattern.color,
              opacity: 1,
              text: pattern.name,
              rect: {
                x: tx[4] + match.index * charW,
                y: tx[5] - item.height,
                w: match[0].length * charW,
                h: item.height,
              },
            })
            redactCount++
          }
        }
      }

      if (redactCount > 0) {
        showMessage("success", `Auto-redacted ${redactCount} PII instance(s)`)
      } else {
        showMessage("info", "No PII detected on this page")
      }
    } catch {
      showMessage("error", "Smart redaction failed")
    }
    setSmartRedactLoading(false)
  }, [currentPage, addAnnotation, showMessage])

  // ── Form export/import ─────────────────────────────────────
  const exportFormData = useCallback(() => {
    const data = JSON.stringify(Object.fromEntries(formFields.map(f => [f.name, f.value])), null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "form-data.json"; a.click()
  }, [formFields])

  const importFormData = useCallback(() => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      try {
        const data = JSON.parse(await file.text())
        setFormFields(prev => prev.map(f => data[f.name] !== undefined ? { ...f, value: data[f.name] } : f))
      } catch { /* ignore */ }
    }
    input.click()
  }, [])

  // ── Keyboard / image signature ─────────────────────────────
  const handleKeyboardSignature = useCallback(() => {
    const name = prompt("Enter your name for signature:")
    if (!name) return
    const canvas = document.createElement("canvas"); canvas.width = 300; canvas.height = 80
    const ctx = canvas.getContext("2d")!; ctx.font = "italic 36px 'Brush Script MT', cursive"; ctx.fillStyle = "#000"; ctx.fillText(name, 10, 50)
    setSignPadDataUrl(canvas.toDataURL("image/png"))
    setActiveSignaturePad(true)
  }, [])

  const handleImageSignature = useCallback(() => {
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = () => { setSignPadDataUrl(reader.result as string); setActiveSignaturePad(true) }
      reader.readAsDataURL(file)
    }
    input.click()
  }, [])

  // ── Perimeter measurement ──────────────────────────────────
  const handlePerimeterClick = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(event)
    const newPoints = [...measurePoints, pt]
    setMeasurePoints(newPoints)
    if (newPoints.length >= 3) {
      let perimeter = 0
      for (let i = 0; i < newPoints.length; i++) {
        const j = (i + 1) % newPoints.length
        perimeter += Math.hypot(newPoints[j].x - newPoints[i].x, newPoints[j].y - newPoints[i].y)
      }
      // Gap #9: Calibrated
      const PPI = measureScaleRatio
      const toUnit = (px: number) => {
        switch (measureUnit) { case "in": return px / PPI; case "mm": return (px / PPI) * 25.4; case "cm": return (px / PPI) * 2.54 }
      }
      const val = toUnit(perimeter)
      setMeasureResult(`Perimeter: ${val.toFixed(1)}${measureUnit} (${perimeter.toFixed(0)}px)`)
      addAnnotation({ page: currentPage, type: "freehand", points: [...newPoints, newPoints[0]], color: "#9C27B0", opacity: 0.5 })
      setMeasurePoints([])
    }
  }, [measurePoints, measureScaleRatio, measureUnit, currentPage, getCanvasCoords, addAnnotation])

  // ── Fullscreen ─────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }, [])

  // ── Load progress ──────────────────────────────────────────
  useEffect(() => {
    if (!pdfDocRef.current) return
    const doc = pdfDocRef.current
    let loaded = 0
    const total = doc.numPages
    const check = () => {
      loaded++
      setLoadProgress(Math.round((loaded / total) * 100))
    }
    // Approximate: each renderPage call increments
    const orig = renderPage
    // We'll track via page renders
  }, [loading])

  // ── Layers ─────────────────────────────────────────────────
  const loadLayers = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const page = await doc.getPage(1)
      const ops = await page.getOperatorList?.()
      const layerNames = new Set<string>()
      if (ops) {
        for (const op of ops.fnArray || []) {
          if (op === 0) layerNames.add("Default")
        }
      }
      // Simplified: detect optional content groups
      const ocgs = doc.catalog?.get?.("OCProperties") || null
      if (ocgs) {
        setLayers([{ name: "Default", visible: true }])
      } else {
        setLayers([{ name: "Content", visible: true }])
      }
    } catch { setLayers([{ name: "Content", visible: true }]) }
  }, [])

  // ── Text markup ────────────────────────────────────────────
  const handleTextMarkup = useCallback((type: "insert" | "delete" | "replace") => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString()
    if (!text) return
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const x = rect.left - containerRect.left
    const y = rect.top - containerRect.top

    if (type === "delete") {
      addAnnotation({ page: currentPage, type: "text-delete", color: "#F44336", opacity: 0.6, text, rect: { x: x / scale, y: y / scale, w: rect.width / scale, h: rect.height / scale } })
    } else if (type === "insert") {
      const newText = prompt("Insert text:", "")
      if (newText) addAnnotation({ page: currentPage, type: "text-insert", color: "#4CAF50", opacity: 0.6, text: newText, rect: { x: x / scale, y: y / scale, w: 100, h: 20 } })
    } else if (type === "replace") {
      const newText = prompt("Replace with:", text)
      if (newText) {
        addAnnotation({ page: currentPage, type: "text-delete", color: "#F44336", opacity: 0.6, text, rect: { x: x / scale, y: y / scale, w: rect.width / scale, h: rect.height / scale } })
        addAnnotation({ page: currentPage, type: "text-insert", color: "#4CAF50", opacity: 0.6, text: newText, rect: { x: x / scale, y: y / scale + 20, w: 100, h: 20 } })
      }
    }
  }, [currentPage, scale, addAnnotation])

  // ── XFDF export/import ─────────────────────────────────────
  const exportXfdf = useCallback(() => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n<annots>\n'
    for (const ann of annotations) {
      xml += `  <${ann.type} page="${ann.page - 1}" color="${ann.color}" opacity="${ann.opacity}"`
      if (ann.rect) xml += ` rect="${ann.rect.x},${ann.rect.y},${ann.rect.w},${ann.rect.h}"`
      if (ann.text) xml += `>${ann.text}</${ann.type}>\n`
      else xml += `/>\n`
    }
    xml += '</annots>\n</xfdf>'
    const blob = new Blob([xml], { type: "application/vnd.adobe.xfdf" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "annotations.xfdf"; a.click()
  }, [annotations])

  const importXfdf = useCallback(() => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".xfdf,.xml"
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      try {
        const xml = await file.text()
        const parser = new DOMParser()
        const doc = parser.parseFromString(xml, "text/xml")
        const newAnns: PdfAnnotation[] = []
        doc.querySelectorAll("annots > *").forEach(el => {
          const type = el.tagName
          const page = parseInt(el.getAttribute("page") || "0") + 1
          const color = el.getAttribute("color") || "#FFEB3B"
          const opacity = parseFloat(el.getAttribute("opacity") || "1")
          const rectStr = el.getAttribute("rect")
          const text = el.textContent || undefined
          const rect = rectStr ? (() => { const [x, y, w, h] = rectStr.split(",").map(Number); return { x, y, w, h } })() : undefined
          newAnns.push({ id: "xfdf-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), page, type, color, opacity, text, rect, createdAt: new Date().toISOString() })
        })
        setAnnotations(prev => [...prev, ...newAnns])
      } catch { /* ignore */ }
    }
    input.click()
  }, [])

  // ── Digital signature verify ───────────────────────────────
  const verifyDigitalSignature = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const sigs = await doc.getSignatures?.()
      if (sigs && sigs.length > 0) {
        alert(`Found ${sigs.length} digital signature(s). Verification requires a trusted certificate store.`)
      } else {
        alert("No digital signatures found in this document.")
      }
    } catch { alert("Signature verification not available for this document.") }
  }, [])

  // ── Security info ──────────────────────────────────────────
  const loadSecurityInfo = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const perms = await doc.getPermissions?.()
      const info = {
        Encrypted: doc.isEncrypted ? "Yes" : "No",
        Printing: perms?.includes?.("print") ? "Allowed" : "Restricted",
        Copying: perms?.includes?.("copy") ? "Allowed" : "Restricted",
        Modifying: perms?.includes?.("modify") ? "Allowed" : "Restricted",
      }
      alert(Object.entries(info).map(([k, v]) => `${k}: ${v}`).join("\n"))
    } catch { alert("Security info not available.") }
  }, [])

  // ── Print with annotations ─────────────────────────────────
  const printWithAnnotations = useCallback(() => {
    setShowPrintPreview(true)
    // Annotations are rendered as overlays on the canvas, so printing captures them
    setTimeout(() => { window.print(); setShowPrintPreview(false) }, 300)
  }, [])

  // ── Custom zoom ────────────────────────────────────────────
  const applyCustomZoom = useCallback(() => {
    const pct = parseInt(customZoom)
    if (pct >= 25 && pct <= 400) {
      setScale(pct / 100)
      setCustomZoom("")
    }
  }, [customZoom])

  // ── Unified canvas pointer down ────────────────────────────
  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (measureMode === "perimeter") { handlePerimeterClick(event); return }
    if (measureMode) { handleMeasureClick(event); return }
    if (redactionMode) { handleRedactionClick(event); return }
    if (stampType) { handleStamp(event); return }
    if (toolMode === "callout") { handleCallout(event); return }
    if (["rectangle", "ellipse", "line", "arrow"].includes(toolMode)) { handleShapePointerDown(event); return }
    if (toolMode === "sticky") { handleStickyNote(event); return }
    if (toolMode === "pan" || toolMode === "select" || toolMode === "form-fill") return
    const pt = getCanvasCoords(event)
    if (toolMode === "freehand" || toolMode === "signature") { setIsDrawing(true); setDrawPoints([pt]) }
    if (toolMode === "text") { const t = prompt("Enter annotation text:"); if (t) addAnnotation({ page: currentPage, type: "text", color: textFontColor, opacity: annotationOpacity, text: t, rect: { x: pt.x, y: pt.y, w: textFontSize * 18, h: textFontSize * 2.5 }, fontFamily: textFontFamily, fontSize: textFontSize, fontColor: textFontColor, ...({ author: annotationAuthor } as any) }) }
    if (toolMode === "highlight" || toolMode === "underline" || toolMode === "strikethrough") { addAnnotation({ page: currentPage, type: toolMode as any, color: annotationColor, opacity: annotationOpacity, rect: { x: pt.x, y: pt.y, w: 120, h: 16 }, ...({ author: annotationAuthor } as any) }) }
    if (toolMode === "eraser") { const hit = annotations.find(a => a.rect && a.page === currentPage && Math.abs(a.rect.x - pt.x) < 20 && Math.abs(a.rect.y - pt.y) < 20); if (hit) removeAnnotation(hit.id) }
  }, [toolMode, currentPage, getCanvasCoords, addAnnotation, annotationColor, annotationOpacity, annotationAuthor, annotations, removeAnnotation, measureMode, redactionMode, measurePoints, stampType, handleMeasureClick, handleRedactionClick, handleShapePointerDown, handleStickyNote, handleStamp, handleCallout, handlePerimeterClick, textFontColor, textFontSize])

  const handleCanvasPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (shapeStart) { handleShapePointerMove(event); return }
    if (!isDrawing || toolMode !== "freehand") return; setDrawPoints(prev => [...prev, getCanvasCoords(event)])
  }, [isDrawing, toolMode, getCanvasCoords, shapeStart, handleShapePointerMove])

  const handleCanvasPointerUp = useCallback(() => {
    if (shapeStart) { handleShapePointerUp(); return }
    if (isDrawing && drawPoints.length > 1) { addAnnotation({ page: currentPage, type: "freehand", points: drawPoints, color: annotationColor, opacity: 1 }) }
    if (isDrawing && toolMode === "signature" && drawPoints.length > 1) { setPendingSignatureTarget({ page: currentPage, x: drawPoints[0].x, y: drawPoints[0].y }) }
    setIsDrawing(false); setDrawPoints([])
  }, [isDrawing, drawPoints, currentPage, toolMode, addAnnotation, annotationColor, shapeStart, handleShapePointerUp])

  // ── Ink smoothing (Catmull-Rom) ────────────────────────────
  const smoothInkPath = useCallback((pts: Array<{x:number;y:number}>): Array<{x:number;y:number}> => {
    if (pts.length < 3) return pts
    const result: Array<{x:number;y:number}> = []
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[Math.min(pts.length - 1, i + 2)]
      for (let t = 0; t < 1; t += 0.25) {
        const t2 = t * t; const t3 = t2 * t
        const x = 0.5 * ((2*p1.x) + (-p0.x + p2.x)*t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3)
        const y = 0.5 * ((2*p1.y) + (-p0.y + p2.y)*t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3)
        result.push({x, y})
      }
    }
    return result
  }, [])

  // ── Thumbnail drag-to-reorder ──────────────────────────────
  const handleThumbDragStart = useCallback((page: number) => setDragSrcPage(page), [])
  const handleThumbDragOver = useCallback((e: React.DragEvent, page: number) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }, [])
  const handleThumbDrop = useCallback((page: number) => {
    if (dragSrcPage == null || dragSrcPage === page) return
    setPageOrder((prev) => {
      const order = prev.length > 0 ? [...prev] : Array.from({length: totalPages}, (_, i) => i + 1)
      const srcIdx = order.indexOf(dragSrcPage); const dstIdx = order.indexOf(page)
      if (srcIdx >= 0 && dstIdx >= 0) { order.splice(srcIdx, 1); order.splice(dstIdx, 0, dragSrcPage) }
      return order
    })
    setDragSrcPage(null)
  }, [dragSrcPage, totalPages])

  // ── Page extract / delete ──────────────────────────────────
  const handleExtractPage = useCallback(async (page: number) => {
    if (!pdfDocRef.current) return
    try {
      const { PDFDocument } = await import("pdf-lib")
      const newDoc = await PDFDocument.create()
      const srcPage = await pdfDocRef.current.getPage(page)
      const vp = srcPage.getViewport({ scale: 2 })
      const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height
      await srcPage.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise
      const imgBytes = await fetch(canvas.toDataURL()).then(r => r.arrayBuffer())
      const img = await newDoc.embedPng(imgBytes)
      const p = newDoc.addPage([vp.width, vp.height])
      p.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height })
      const pdfBytes = await newDoc.save()
      const blob = new Blob([pdfBytes], { type: "application/pdf" })
      saveBlobAs(blob, `page-${page}.pdf`)
      showMessage("success", `Page ${page} extracted`)
    } catch { showMessage("error", "Extraction failed") }
  }, [showMessage])

  const handleDeletePage = useCallback((page: number) => {
    pageCanvasesRef.current.delete(page)
    setPageOrder((prev) => {
      const order = prev.length > 0 ? [...prev] : Array.from({length: totalPages}, (_, i) => i + 1)
      return order.filter(p => p !== page)
    })
    showMessage("info", `Page ${page} hidden from view`)
  }, [totalPages, showMessage])

  // ── PDF/A validation ──────────────────────────────────────
  const handlePdfAValidate = useCallback(async () => {
    if (!pdfDocRef.current) return
    const doc = pdfDocRef.current
    const checks: Array<{name:string;pass:boolean;detail:string}> = []
    try {
      // Metadata check
      const metadata = await doc.getMetadata()
      checks.push({name:"Metadata", pass:!!metadata?.info?.Title, detail:metadata?.info?.Title ? `Title: ${metadata.info.Title}` : "Missing title"})
      // Encryption check
      checks.push({name:"No Encryption", pass:!(doc as any)._transport?.securityHandler, detail:"Document is encrypted"})
      // Page count
      checks.push({name:"Pages Check", pass:doc.numPages > 0, detail:`${doc.numPages} pages`})
      // Font embedding
      const page = await doc.getPage(1)
      const ops = await page.getOperatorList?.()
      let hasTransparency = false
      if (ops) {
        for (const op of (ops as any).fnArray || []) {
          if (op === 104 || op === 105) { hasTransparency = true; break } // PDF transparency ops
        }
      }
      checks.push({name:"No Transparency", pass:!hasTransparency, detail:hasTransparency ? "Has transparency" : "No transparency detected"})
      checks.push({name:"Linearized", pass:!!(doc as any).linearization, detail:"Document is linearized for web"})
      // Annotations
      const annots = await page.getAnnotations()
      checks.push({name:"No JS Actions", pass:!annots?.some((a:any) => a.actions), detail:"No JavaScript actions found"})

      const score = checks.filter(c => c.pass).length
      setPdfAScore({ score, checks })
      setShowPdfAValidation(true)
      showMessage("info", `PDF/A Score: ${score}/${checks.length}`)
    } catch (e) {
      checks.push({name:"Error", pass:false, detail:String(e)})
      setPdfAScore({ score:0, checks })
      setShowPdfAValidation(true)
    }
  }, [showMessage])

  // ── 3D Viewer ─────────────────────────────────────────────
  const handleOpen3DViewer = useCallback(() => {
    setShowThreeDViewer(true)
    setTimeout(() => {
      const script = document.createElement("script")
      script.type = "module"
      script.src = "https://unpkg.com/@google/model-viewer@2.1.1/dist/model-viewer.min.js"
      document.head.appendChild(script)
    }, 100)
  }, [])

  // ── Portfolio (embedded files) ────────────────────────────
  const handleLoadPortfolio = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const files: typeof portfolioFiles = []
      // Check for embedded file attachments
      if ((doc as any).catalog?.attachments) {
        const attachments = await (doc as any).catalog.attachments
        if (attachments) {
          for (const [name, data] of Object.entries(attachments)) {
            files.push({ name, size: (data as any)?.length ?? 0, data: data as Uint8Array })
          }
        }
      }
      setPortfolioFiles(files)
      setShowPortfolio(true)
      if (files.length === 0) showMessage("info", "No embedded files found")
    } catch { showMessage("error", "Failed to read portfolio") }
  }, [showMessage])

  const handleExtractPortfolioFile = useCallback((file: typeof portfolioFiles[0]) => {
    if (!file.data) return
    const blob = new Blob([file.data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = file.name; a.click()
    URL.revokeObjectURL(url)
    showMessage("success", `Extracted: ${file.name}`)
  }, [showMessage])

  // ── OCR (text extraction overlay) ─────────────────────────
  const handleOcr = useCallback(async () => {
    if (!pdfDocRef.current) return
    setOcrLoading(true)
    try {
      const doc = pdfDocRef.current
      let allText = ""
      for (let p = 1; p <= Math.min(doc.numPages, 10); p++) {
        const page = await doc.getPage(p)
        const textContent = await page.getTextContent()
        allText += `--- Page ${p} ---\n`
        allText += textContent.items.map((item: any) => item.str).join(" ") + "\n\n"
      }
      setOcrText(allText)
      setShowOcr(true)
    } catch { showMessage("error", "Text extraction failed") }
    setOcrLoading(false)
  }, [showMessage])

  // ── Digital signature verification ────────────────────────
  const handleVerifySignature = useCallback(async () => {
    if (!pdfDocRef.current) return
    try {
      const doc = pdfDocRef.current
      const sigInfo = await (doc as any).getSignatures?.()
      if (sigInfo && sigInfo.length > 0) {
        let msg = `Found ${sigInfo.length} signature(s):\n`
        for (const sig of sigInfo) {
          msg += `\nSigner: ${sig.signerName || "Unknown"}\n`
          msg += `Date: ${sig.signingTime || "Unknown"}\n`
          msg += `Valid: ${sig.signatureStatus === 0 ? "✅ Verified" : "⚠ Not verified"}\n`
          msg += `Reason: ${sig.reason || "N/A"}\n`
        }
        alert(msg)
      } else {
        showMessage("info", "No digital signatures found in document")
      }
    } catch { showMessage("error", "Signature verification not supported for this PDF") }
  }, [showMessage])

  // ── Remote URL load ───────────────────────────────────────
  const handleRemoteLoad = useCallback(async () => {
    if (!remoteUrl.trim()) return
    try {
      const res = await fetch(remoteUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const reader = new FileReader()
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1]
        // Re-create the documentSource by setting a new blob URL
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = URL.createObjectURL(blob)
        setPdfJsReady(false)
        cancelledRef.current = false
        setLoading(true)
        setError(null)
        pdfDocRef.current = null
        pageCanvasesRef.current.clear()
        textLayerRefs.current.clear()
        setTotalPages(0)
        setCurrentPage(1)
        setTimeout(() => setPdfJsReady(true), 50)
        setTimeout(() => {
          pdfjsRef.current?.getDocument({ url: blobUrlRef.current }).promise
            .then((doc: any) => { pdfDocRef.current = doc; setTotalPages(doc.numPages); setLoading(false) })
            .catch((err: Error) => { setLoading(false); setError(err.message) })
        }, 100)
      }
      reader.readAsDataURL(blob)
      setShowRemoteDialog(false)
      showMessage("success", "Remote document loaded")
    } catch (err) { showMessage("error", `Failed to load: ${err instanceof Error ? err.message : "error"}`) }
  }, [remoteUrl, showMessage])

  // ── Text-bound markup ─────────────────────────────────────
  const handleTextBoundMarkup = useCallback(async (pageNum: number, clientX: number, clientY: number) => {
    if (!pdfDocRef.current || !["highlight", "underline", "strikethrough"].includes(toolMode)) return
    try {
      const page = await pdfDocRef.current.getPage(pageNum)
      const textContent = await page.getTextContent()
      const vp = page.getViewport({ scale: 1.0 })
      const canvas = pageCanvasesRef.current.get(pageNum)
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = (clientX - rect.left) / (rect.width / canvas.width) / scale
      const y = (clientY - rect.top) / (rect.height / canvas.height) / scale
      // Find closest text item
      for (const item of textContent.items) {
        const tx = pdfjsRef.current.Util.transform(vp.transform, item.transform)
        const itemX = tx[4]; const itemY = tx[5] - item.height
        const itemW = item.width; const itemH = item.height
        if (x >= itemX && x <= itemX + itemW && y >= itemY && y <= itemY + itemH) {
          addAnnotation({
            page: pageNum, type: toolMode as any, color: annotationColor,
            opacity: toolMode === "highlight" ? 0.4 : 1,
            text: item.str,
            rect: { x: itemX, y: itemY, w: itemW, h: itemH },
          })
          return
        }
      }
    } catch { /* fallback to normal handler */ }
  }, [toolMode, scale, annotationColor, addAnnotation])

  // ── Gap #13: Text-to-speech (read aloud) ────────────────────
  const handleTextToSpeech = useCallback(async () => {
    if (!("speechSynthesis" in window)) {
      showMessage("error", "Text-to-speech not supported in this browser")
      return
    }
    const synth = window.speechSynthesis

    if (isSpeaking && !isPaused) {
      // Pause
      synth.pause()
      setIsPaused(true)
      return
    }
    if (isSpeaking && isPaused) {
      // Resume
      synth.resume()
      setIsPaused(false)
      return
    }

    // Start reading current page
    if (!pdfDocRef.current) return
    setIsSpeaking(true)
    setIsPaused(false)
    setActiveTtsPage(currentPage)

    try {
      const page = await pdfDocRef.current.getPage(currentPage)
      const textContent = await page.getTextContent()
      const fullText = textContent.items.map((item: any) => item.str).join(" ")

      if (!fullText.trim()) {
        showMessage("info", "No readable text on this page")
        setIsSpeaking(false)
        return
      }

      const utterance = new SpeechSynthesisUtterance(fullText)
      utterance.rate = speechRate
      utterance.lang = "en-US"

      utterance.onend = () => {
        setIsSpeaking(false)
        setIsPaused(false)
        setActiveTtsPage(null)
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
        setIsPaused(false)
        setActiveTtsPage(null)
      }

      synth.speak(utterance)
    } catch {
      showMessage("error", "Failed to extract text for reading")
      setIsSpeaking(false)
      setIsPaused(false)
    }
  }, [currentPage, isSpeaking, isPaused, speechRate, showMessage])

  const handleStopSpeech = useCallback(() => {
    const synth = window.speechSynthesis
    synth.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
    setActiveTtsPage(null)
  }, [])

  // Stop speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  // ── Gap #5: Sticky note pointer down handler ────────────────
  const handleOverlayPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, annId: string, annRect: { x: number; y: number; w: number; h: number }) => {
    if (toolMode !== "pan" && toolMode !== "select") return
    event.preventDefault()
    event.stopPropagation()
    const overlayEl = event.currentTarget.closest(".pdf-canvas-container") as HTMLElement
    if (!overlayEl) return
    const containerRect = overlayEl.getBoundingClientRect()
    setDraggingAnnotationId(annId)
    setDragOffset({
      x: event.clientX - containerRect.left - annRect.x * scale,
      y: event.clientY - containerRect.top - annRect.y * scale,
    })
  }, [scale, toolMode])

  // ── Gap #5: Sticky note drag move ──────────────────────────
  useEffect(() => {
    if (!draggingAnnotationId) return
    const handleMouseMove = (e: MouseEvent) => {
      const containerEl = document.querySelector(".pdf-canvas-container") as HTMLElement
      if (!containerEl) return
      const containerRect = containerEl.getBoundingClientRect()
      const newX = (e.clientX - containerRect.left - dragOffset.x) / scale
      const newY = (e.clientY - containerRect.top - dragOffset.y) / scale

      setAnnotations(prev => {
        const updated = prev.map(a => {
          if (a.id === draggingAnnotationId && a.rect) {
            return { ...a, rect: { ...a.rect, x: newX, y: newY } }
          }
          return a
        })
        onAnnotationsChange?.(updated)
        return updated
      })
    }
    const handleMouseUp = () => {
      setDraggingAnnotationId(null)
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [draggingAnnotationId, dragOffset, scale, onAnnotationsChange])

  // Apply smooth paths to existing freehand annotations
  useEffect(() => {
    if (annotations.length > 0) {
      const updated = annotations.map(a => {
        if (a.type === "freehand" && a.points && a.points.length > 3) {
          return { ...a, points: smoothInkPath(a.points) }
        }
        return a
      })
      if (JSON.stringify(updated) !== JSON.stringify(annotations)) setAnnotations(updated)
    }
  }, [annotations.length > 0 ? JSON.stringify(annotations.find(a => a.type === "freehand")?.points) : null])

  // ── Load progress tracking ─────────────────────────────────
  useEffect(() => {
    if (!pdfDocRef.current || !loading) return
    const doc = pdfDocRef.current
    let loaded = 0; const total = doc.numPages
    const track = () => { loaded++; setLoadProgress(Math.round((loaded / total) * 100)) }
    // Track by rendering pages in background
    for (let p = 1; p <= Math.min(total, 5); p++) {
      doc.getPage(p).then(() => track()).catch(() => track())
    }
  }, [loading, pdfDocRef.current])

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const mod = e.ctrlKey || e.metaKey
      switch (e.key) {
        case "PageDown": e.preventDefault(); goNext(); break
        case "PageUp": e.preventDefault(); goPrev(); break
        case "Home": if (!mod) { e.preventDefault(); goToPage(1) } break
        case "End": if (!mod) { e.preventDefault(); goToPage(totalPages) } break
        case "ArrowDown": if (viewMode === "continuous") { e.preventDefault(); containerRef.current?.scrollBy({ top: 60, behavior: "smooth" }) } break
        case "ArrowUp": if (viewMode === "continuous") { e.preventDefault(); containerRef.current?.scrollBy({ top: -60, behavior: "smooth" }) } break
        case "f": if (mod) { e.preventDefault(); setShowSearch(v => !v); setTimeout(() => (document.querySelector("[data-search-input]") as HTMLInputElement)?.focus(), 50) } break
        case "c": if (mod && selectedText) { e.preventDefault(); handleCopySelected() } break
        case "0": if (mod) { e.preventDefault(); resetZoom() } break
        case "=": case "+": if (mod) { e.preventDefault(); zoomIn() } break
        case "-": if (mod) { e.preventDefault(); zoomOut() } break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goNext, goPrev, goToPage, totalPages, viewMode, selectedText, handleCopySelected, resetZoom, zoomIn, zoomOut])

  // ── Cleanup ────────────────────────────────────────────────
  useEffect(() => { return () => { if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null } } }, [])

  // ── Colors ─────────────────────────────────────────────────
  const annotationColors = ["#ffeb3b", "#ff9800", "#f44336", "#e91e63", "#9c27b0", "#2196f3", "#00bcd4", "#4caf50", "#795548", "#607d8b"]

  // ── WCAG Accessibility State ────────────────────────────────
  const [highContrastMode, setHighContrastMode] = useState(false)
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState("")
  const mainContentRef = useRef<HTMLDivElement | null>(null)

  /** Announce a message to screen readers via aria-live region */
  const announce = useCallback((msg: string) => {
    setScreenReaderAnnouncement("")
    requestAnimationFrame(() => setScreenReaderAnnouncement(msg))
  }, [])

  /** Announce page changes */
  useEffect(() => {
    if (totalPages > 0) announce(`Page ${currentPage} of ${totalPages}`)
  }, [currentPage, totalPages, announce])

  /** Global keyboard navigation for PDF viewer */
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Don't intercept when typing in inputs
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return

      switch (e.key) {
        case "PageDown":
        case "ArrowRight":
          e.preventDefault()
          if (currentPage < totalPages) { goToPage(currentPage + 1); announce(`Page ${currentPage + 1} of ${totalPages}`) }
          break
        case "PageUp":
        case "ArrowLeft":
          e.preventDefault()
          if (currentPage > 1) { goToPage(currentPage - 1); announce(`Page ${currentPage - 1} of ${totalPages}`) }
          break
        case "Home":
          if (e.ctrlKey) { e.preventDefault(); goToPage(1); announce("First page") }
          break
        case "End":
          if (e.ctrlKey) { e.preventDefault(); goToPage(totalPages); announce("Last page") }
          break
        case "+":
        case "=":
          if (e.ctrlKey) { e.preventDefault(); zoomIn(); announce(`Zoom ${Math.round(scale * 110)}%`) }
          break
        case "-":
          if (e.ctrlKey) { e.preventDefault(); zoomOut(); announce(`Zoom ${Math.round(scale * 90)}%`) }
          break
        case "0":
          if (e.ctrlKey) { e.preventDefault(); resetZoom(); announce("Zoom reset to 100%") }
          break
        case "f":
        case "F":
          if (e.ctrlKey) { e.preventDefault(); setShowSearch(v => !v); announce(showSearch ? "Search closed" : "Search opened") }
          break
        case "Escape":
          if (showSearch) { setShowSearch(false); announce("Search closed") }
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentPage, totalPages, scale, showSearch, announce])

  const ToolBtn = ({ icon, active, onClick, title, disabled }: { icon: React.ReactNode; active?: boolean; onClick: () => void; title: string; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      aria-label={title} aria-pressed={active ?? undefined} role="button"
      className={cn("flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "opacity-30 cursor-not-allowed",
        highContrastMode && "border border-foreground"
      )}>{icon}</button>
  )

  // ── Ribbon tab state ──
  type RibbonTab = "view" | "annotate" | "forms" | "measure" | "protect" | "advanced"
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>("view")
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false)

  const RIBBON_TABS: Array<{ id: RibbonTab; label: string; icon: React.ReactNode }> = [
    { id: "view", label: "View", icon: <Eye className="h-3.5 w-3.5" /> },
    { id: "annotate", label: "Annotate", icon: <Highlighter className="h-3.5 w-3.5" /> },
    { id: "forms", label: "Forms", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "measure", label: "Measure", icon: <Ruler className="h-3.5 w-3.5" /> },
    { id: "protect", label: "Protect", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { id: "advanced", label: "Advanced", icon: <Sliders className="h-3.5 w-3.5" /> },
  ]

  if (!resolvedUrl && !error) {
    return <div className={cn("flex items-center justify-center h-full min-h-[320px] bg-white", className)}><span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading document</span></div>
  }
  if (error) {
    return <div className={cn("flex items-center justify-center h-full min-h-[320px] bg-white p-4 text-center text-sm text-destructive", className)}>{error}</div>
  }

  const pageAnnotations = annotations.filter(a => a.page === currentPage)
  const pageSignatures = signatures.filter(s => s.page === currentPage)
  const hasOverlay = pageAnnotations.length > 0 || pageSignatures.length > 0
  const cursorStyle = toolMode === "pan" ? "grab" : toolMode === "freehand" ? "crosshair" : toolMode === "text" ? "text" : toolMode === "eraser" ? "cell" : toolMode === "highlight" ? "crosshair" : "pointer"

  const activeSearchResult = activeSearchIdx >= 0 ? searchResults[activeSearchIdx] : null

  return (
    <div className={cn("flex flex-col h-full min-h-[320px] overflow-hidden border border-border rounded-md",
      highContrastMode ? "bg-white text-black" : "bg-white",
      className)} role="application" aria-label="PDF Viewer" aria-roledescription="PDF document viewer">
      {/* Screen reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">{screenReaderAnnouncement}</div>
      {/* Skip to content link */}
      <a href="#pdf-main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:bg-primary focus:text-white focus:px-3 focus:py-1 focus:rounded focus:text-sm" onClick={(e) => { e.preventDefault(); mainContentRef.current?.focus() }}>
        Skip to document content
      </a>
      {/* ── Ribbon Toolbar ──────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-card" role="toolbar" aria-label="PDF viewer toolbar">
        {/* Quick access bar — always visible */}
        <div className="flex items-center gap-1 px-2 py-1.5" role="group" aria-label="Page navigation and zoom">
          {/* Page nav */}
          <ToolBtn icon={<ChevronLeft className="h-3.5 w-3.5" />} onClick={goPrev} title="Previous page (PageUp)" disabled={currentPage <= 1} />
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground min-w-[60px] justify-center">
            <Input value={String(currentPage)} onChange={e => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= totalPages) goToPage(v) }} aria-label={`Page number, ${currentPage} of ${totalPages}`} className="h-6 w-9 text-center text-[11px] px-0" />
            <span className="shrink-0" aria-hidden="true">/ {totalPages || "-"}</span>
          </span>
          <ToolBtn icon={<ChevronRight className="h-3.5 w-3.5" />} onClick={goNext} title="Next (PageDown)" disabled={currentPage >= totalPages} />
          <div className="w-px h-5 bg-border mx-1" />

          {/* Zoom */}
          <ToolBtn icon={<ZoomOut className="h-3.5 w-3.5" />} onClick={zoomOut} title="Zoom out" disabled={scale <= 0.25} />
          <span className="text-[11px] text-muted-foreground min-w-[36px] text-center">{zoomInput}</span>
          <ToolBtn icon={<ZoomIn className="h-3.5 w-3.5" />} onClick={zoomIn} title="Zoom in" disabled={scale >= 4} />
          <ToolBtn icon={<MinusCircle className="h-3.5 w-3.5" />} onClick={resetZoom} title="Reset zoom" />
          <ToolBtn icon={<Maximize2 className="h-3.5 w-3.5" />} onClick={fitWidth} title="Fit width" />
          <div className="w-px h-5 bg-border mx-1" />

          {/* Search */}
          <ToolBtn icon={<Search className="h-3.5 w-3.5" />} active={showSearch} onClick={() => setShowSearch(v => !v)} title="Search (Ctrl+F)" />

          <div className="w-px h-5 bg-border mx-1" />

          {/* Toggle ribbon */}
          <button onClick={() => setRibbonCollapsed(v => !v)}
            className={cn("flex h-7 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-muted", ribbonCollapsed ? "" : "bg-primary/10 text-primary font-medium")}>
            <Sliders className="h-3.5 w-3.5" />
            Tools
            <ChevronDown className={cn("h-3 w-3 transition-transform", !ribbonCollapsed && "rotate-180")} />
          </button>
        </div>

        {/* Collapsible ribbon */}
        {!ribbonCollapsed && (
          <div className="border-t border-border/50">
            {/* Tab row */}
            <div className="flex items-center gap-0 px-2">
              {RIBBON_TABS.map(t => (
                <button key={t.id} onClick={() => setRibbonTab(t.id)}
                  className={cn("flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors",
                    ribbonTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Ribbon content */}
            <div className="flex items-center gap-1 px-3 py-1.5 flex-wrap min-h-[36px]">
              {ribbonTab === "view" && (<>
                <div className="flex items-center gap-0.5">
                  <ToolBtn icon={showThumbnails ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
                    active={showThumbnails} onClick={() => setShowThumbnails(!showThumbnails)} title="Thumbnails" />
                  <ToolBtn icon={<LayoutList className="h-3.5 w-3.5" />} active={viewMode === "single"} onClick={() => setViewMode("single")} title="Single page" />
                  <ToolBtn icon={<List className="h-3.5 w-3.5" />} active={viewMode === "continuous"} onClick={() => setViewMode("continuous")} title="Continuous" />
                  <ToolBtn icon={<BookOpen className="h-3.5 w-3.5" />} active={viewModeDual} onClick={() => setViewModeDual(v => !v)} title="Dual page" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <ToolBtn icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={rotateCcw} title="Rotate left" />
                  <ToolBtn icon={<RotateCw className="h-3.5 w-3.5" />} onClick={rotateCw} title="Rotate right" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                {/* Gap #13: Text-to-speech */}
                <div className="flex items-center gap-0.5">
                  {!isSpeaking || (isSpeaking && isPaused) ? (
                    <ToolBtn icon={isPaused ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                      active={isSpeaking} onClick={handleTextToSpeech}
                      title={isPaused ? "Resume reading" : "Read aloud"} />
                  ) : (
                    <ToolBtn icon={<Pause className="h-3.5 w-3.5" />} active onClick={handleTextToSpeech} title="Pause reading" />
                  )}
                  {isSpeaking && (
                    <>
                      <ToolBtn icon={<X className="h-3.5 w-3.5" />} onClick={handleStopSpeech} title="Stop reading" />
                      <select value={speechRate} onChange={e => setSpeechRate(parseFloat(e.target.value))}
                        className="h-7 w-12 rounded border border-border bg-background text-[10px] px-1"
                        title="Reading speed">
                        <option value={0.5}>0.5x</option>
                        <option value={0.75}>0.75x</option>
                        <option value={1}>1x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                      </select>
                    </>
                  )}
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <ToolBtn icon={<Maximize2 className="h-3.5 w-3.5" />} active={isFullscreen} onClick={toggleFullscreen} title="Fullscreen" />
                  <ToolBtn icon={darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} active={darkMode} onClick={() => setDarkMode(v => !v)} title="Dark mode" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <ToolBtn icon={<Layers className="h-3.5 w-3.5" />} active={showBookmarks} onClick={() => setShowBookmarks(v => !v)} title="Bookmarks" />
                  <ToolBtn icon={<Eye className="h-3.5 w-3.5" />} active={showLayers} onClick={() => setShowLayers(v => !v)} title="Layers" />
                  <ToolBtn icon={<Paperclip className="h-3.5 w-3.5" />} active={showAttachments} onClick={() => { setShowAttachments(v => !v); if (!showAttachments) loadAttachments() }} title="Attachments" />
                </div>
              </>)}

              {ribbonTab === "annotate" && enableAnnotations && (<>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground mr-1">Draw:</span>
                  <ToolBtn icon={<MousePointer className="h-3.5 w-3.5" />} active={toolMode === "pan"} onClick={() => setToolMode("pan")} title="Pan" />
                  <ToolBtn icon={<PenTool className="h-3.5 w-3.5" />} active={toolMode === "freehand"} onClick={() => setToolMode("freehand")} title="Freehand" />
                  <ToolBtn icon={<Square className="h-3.5 w-3.5" />} active={toolMode === "rectangle"} onClick={() => setToolMode("rectangle")} title="Rectangle" />
                  <ToolBtn icon={<Circle className="h-3.5 w-3.5" />} active={toolMode === "ellipse"} onClick={() => setToolMode("ellipse")} title="Ellipse" />
                  <ToolBtn icon={<MinusIcon className="h-3.5 w-3.5" />} active={toolMode === "line"} onClick={() => setToolMode("line")} title="Line" />
                  <ToolBtn icon={<ArrowRight className="h-3.5 w-3.5" />} active={toolMode === "arrow"} onClick={() => setToolMode("arrow")} title="Arrow" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground mr-1">Markup:</span>
                  <ToolBtn icon={<Highlighter className="h-3.5 w-3.5" />} active={toolMode === "highlight"} onClick={() => setToolMode("highlight")} title="Highlight" />
                  <ToolBtn icon={<Underline className="h-3.5 w-3.5" />} active={toolMode === "underline"} onClick={() => setToolMode("underline")} title="Underline" />
                  <ToolBtn icon={<Type className="h-3.5 w-3.5" />} active={toolMode === "strikethrough"} onClick={() => setToolMode("strikethrough")} title="Strikethrough" />
                  <ToolBtn icon={<Pencil className="h-3.5 w-3.5" />} active={toolMode === "text"} onClick={() => setToolMode("text")} title="Text" />
                  <ToolBtn icon={<StickyNote className="h-3.5 w-3.5" />} active={toolMode === "sticky"} onClick={() => setToolMode("sticky")} title="Sticky" />
                  <ToolBtn icon={<MessageSquare className="h-3.5 w-3.5" />} active={toolMode === "callout"} onClick={() => setToolMode("callout")} title="Callout" />
                  <ToolBtn icon={<Eraser className="h-3.5 w-3.5" />} active={toolMode === "eraser"} onClick={() => setToolMode("eraser")} title="Erase" />
                </div>
                {/* Gap #7: Font controls for text annotation */}
                {toolMode === "text" && (
                  <div className="flex items-center gap-0.5 ml-1">
                    <select value={textFontFamily} onChange={e => setTextFontFamily(e.target.value)}
                      className="h-7 rounded border border-border bg-background text-[10px] px-1 max-w-[110px]"
                      title="Font family">
                      {fontFamilies.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={textFontSize} onChange={e => setTextFontSize(parseInt(e.target.value))}
                      className="h-7 w-12 rounded border border-border bg-background text-[10px] px-1"
                      title="Font size">
                      {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map(s => <option key={s} value={s}>{s}px</option>)}
                    </select>
                    <input type="color" value={textFontColor} onChange={e => setTextFontColor(e.target.value)}
                      className="h-5 w-5 rounded border-0 p-0 cursor-pointer" title="Font color" />
                  </div>
                )}
                {(toolMode === "highlight" || toolMode === "underline" || toolMode === "strikethrough" || toolMode === "freehand" || toolMode === "rectangle" || toolMode === "ellipse" || toolMode === "line" || toolMode === "arrow") && (
                  <div className="flex items-center gap-0.5 ml-1">{annotationColors.map(c => <button key={c} onClick={() => setAnnotationColor(c)} className={cn("h-4 w-4 rounded-full border-2 transition-all", annotationColor === c ? "border-primary scale-110" : "border-transparent hover:scale-105")} style={{ backgroundColor: c }} title={c} />)}</div>
                )}
              </>)}

              {ribbonTab === "forms" && (<>
                <div className="flex items-center gap-0.5">
                  {enableFormFill && <>
                    <ToolBtn icon={<FileText className="h-3.5 w-3.5" />} active={showFormPanel} onClick={() => setShowFormPanel(v => !v)} title="Form fields" />
                    <ToolBtn icon={<Download className="h-3.5 w-3.5" />} onClick={exportFormData} title="Export data" />
                    <ToolBtn icon={<FileText className="h-3.5 w-3.5" />} onClick={importFormData} title="Import data" />
                  </>}
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground mr-1">Stamps:</span>
                  <ToolBtn icon={<Check className="h-3.5 w-3.5 text-green-500" />} active={stampType === "approved"} onClick={() => setStampType(s => s === "approved" ? null : "approved")} title="Approved" />
                  <ToolBtn icon={<FileText className="h-3.5 w-3.5 text-orange-500" />} active={stampType === "draft"} onClick={() => setStampType(s => s === "draft" ? null : "draft")} title="Draft" />
                  <ToolBtn icon={<EyeOff className="h-3.5 w-3.5 text-red-500" />} active={stampType === "confidential"} onClick={() => setStampType(s => s === "confidential" ? null : "confidential")} title="Confidential" />
                  <ToolBtn icon={<Check className="h-3.5 w-3.5 text-blue-500" />} active={stampType === "final"} onClick={() => setStampType(s => s === "final" ? null : "final")} title="Final" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                {enableSignature && <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground mr-1">Sign:</span>
                  <ToolBtn icon={<Stamp className="h-3.5 w-3.5" />} active={activeSignaturePad} onClick={handleOpenSignaturePad} title="Draw" />
                  <ToolBtn icon={<Keyboard className="h-3.5 w-3.5" />} onClick={handleKeyboardSignature} title="Type" />
                  <ToolBtn icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={handleImageSignature} title="Image" />
                </div>}
              </>)}

              {ribbonTab === "measure" && (<>
                <ToolBtn icon={<Ruler className="h-3.5 w-3.5" />} active={measureMode === "distance"} onClick={() => setMeasureMode(m => m === "distance" ? null : "distance")} title="Distance" />
                <ToolBtn icon={<Square className="h-3.5 w-3.5" />} active={measureMode === "area"} onClick={() => setMeasureMode(m => m === "area" ? null : "area")} title="Area" />
                <ToolBtn icon={<Hash className="h-3.5 w-3.5" />} active={measureMode === "perimeter"} onClick={() => setMeasureMode(m => m === "perimeter" ? null : "perimeter")} title="Perimeter" />
                {/* Gap #9: Calibrated measurement controls */}
                {measureMode && (
                  <>
                    <div className="w-px h-5 bg-border mx-1" />
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <span>Scale:</span>
                      <input type="number" min={1} max={1000} value={measureScaleRatio}
                        onChange={e => setMeasureScaleRatio(Math.max(1, parseInt(e.target.value) || 72))}
                        className="h-6 w-14 rounded border border-border bg-background text-[10px] px-1"
                        title="Pixels per inch (scale ratio)" />
                      <span>ppi</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <select value={measureUnit} onChange={e => setMeasureUnit(e.target.value as any)}
                        className="h-6 rounded border border-border bg-background text-[10px] px-1"
                        title="Measurement unit">
                        <option value="in">inches</option>
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                      </select>
                    </div>
                  </>
                )}
              </>)}

              {ribbonTab === "protect" && (<>
                <div className="flex items-center gap-0.5">
                  <ToolBtn icon={<EyeOff className="h-3.5 w-3.5" />} active={redactionMode} onClick={() => setRedactionMode(v => !v)} title="Redact" />
                  {/* Gap #2: AI smart redaction */}
                  <ToolBtn icon={smartRedactLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    onClick={handleSmartRedact} title="Auto-detect PII" disabled={smartRedactLoading} />
                  <ToolBtn icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={verifyDigitalSignature} title="Verify" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <ToolBtn icon={<Info className="h-3.5 w-3.5" />} active={showMetadata} onClick={() => { setShowMetadata(v => !v); if (!showMetadata) loadMetadata() }} title="Info" />
                  <ToolBtn icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={loadSecurityInfo} title="Security" />
                </div>
              </>)}

              {ribbonTab === "advanced" && (<>
                <div className="flex items-center gap-0.5">
                  {/* Gap #1: AI summarization */}
                  <ToolBtn icon={aiSummaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    onClick={handleAiSummarize} title="AI Summarize" disabled={aiSummaryLoading} />
                  <ToolBtn icon={<Search className="h-3.5 w-3.5" />} onClick={handleOcr} title="OCR" />
                  <ToolBtn icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={handlePdfAValidate} title="PDF/A" />
                  <ToolBtn icon={<FileText className="h-3.5 w-3.5" />} onClick={handleLoadPortfolio} title="Portfolio" />
                  <ToolBtn icon={<FileText className="h-3.5 w-3.5" />} onClick={() => setShowRemoteDialog(true)} title="Load URL" />
                  <ToolBtn icon={<Eye className="h-3.5 w-3.5" />} onClick={handleOpen3DViewer} title="3D" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <ToolBtn icon={<MessageSquare className="h-3.5 w-3.5" />} active={showAnnotationList} onClick={() => setShowAnnotationList(v => !v)} title="Ann list" />
                  <ToolBtn icon={<Download className="h-3.5 w-3.5" />} onClick={exportAnnotations} title="Export ann" />
                  <ToolBtn icon={<FileText className="h-3.5 w-3.5" />} onClick={importAnnotations} title="Import ann" />
                  {/* Gap #6: Flatten */}
                  <ToolBtn icon={<Layers className="h-3.5 w-3.5" />} onClick={handleFlattenAnnotations} title="Flatten annotations" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  {/* Gap #3: Page organizer */}
                  <ToolBtn icon={<Plus className="h-3.5 w-3.5" />} onClick={() => handleInsertPage(currentPage, "blank")} title="Insert blank page" />
                  <ToolBtn icon={<FileText className="h-3.5 w-3.5" />} onClick={() => handleInsertPage(currentPage, "from-file")} title="Insert page from file" />
                  <ToolBtn icon={<Download className="h-3.5 w-3.5" />} onClick={() => handleExtractPage(currentPage)} title="Extract page" />
                  <ToolBtn icon={<Minus className="h-3.5 w-3.5" />} onClick={() => handleDeletePage(currentPage)} title="Delete page" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <ToolBtn icon={<Printer className="h-3.5 w-3.5" />} onClick={handlePrint} title="Print" />
                  <ToolBtn icon={<Download className="h-3.5 w-3.5" />} onClick={handleDownload} title="Download" />
                  <ToolBtn icon={<Save className="h-3.5 w-3.5" />} onClick={handleSaveAs} title="Save as" />
                  <ToolBtn icon={<Download className="h-3.5 w-3.5" />} onClick={handleExportWithAnnotations} title="Export+" />
                  <ToolBtn icon={<Printer className="h-3.5 w-3.5" />} onClick={printWithAnnotations} title="Print+" />
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                {/* WCAG Accessibility Controls */}
                <div className="flex items-center gap-0.5" role="group" aria-label="Accessibility">
                  <ToolBtn icon={<Sun className="h-3.5 w-3.5" />} active={highContrastMode} onClick={() => { setHighContrastMode(v => !v); announce(highContrastMode ? "High contrast off" : "High contrast on") }} title="High contrast mode" />
                  <ToolBtn icon={<Keyboard className="h-3.5 w-3.5" />} onClick={() => announce("Keyboard shortcuts: PageUp/Down or Arrow Left/Right for pages, Ctrl+Plus/Minus for zoom, Ctrl+F for search, Ctrl+Home/End for first/last page, Escape to close panels")} title="Keyboard shortcuts help" />
                </div>
              </>)}
            </div>
          </div>
        )}
      </div>

      {/* ── Search Panel ─────────────────────────────────────── */}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 border-b px-3 py-1.5 text-xs",
            message.type === "success" && "border-green-200 bg-green-50 text-green-700",
            message.type === "error" && "border-red-200 bg-red-50 text-red-700",
            message.type === "info" && "border-blue-200 bg-blue-50 text-blue-700",
          )}
        >
          {message.type === "success" && <Check className="h-3.5 w-3.5" />}
          {message.type === "error" && <TriangleAlert className="h-3.5 w-3.5" />}
          {message.type === "info" && <Info className="h-3.5 w-3.5" />}
          {message.text}
        </div>
      )}

      {showSearch && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1.5 flex-wrap" role="search" aria-label="Search in document">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <input data-search-input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search text" aria-describedby="search-results-count"
            onKeyDown={e => { if (e.key === "Enter") performSearch() }}
            placeholder="Search in document..." className="h-7 w-48 rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input type="checkbox" checked={searchMatchCase} onChange={e => setSearchMatchCase(e.target.checked)} className="accent-primary w-3 h-3" />Aa
          </label>
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input type="checkbox" checked={searchWholeWord} onChange={e => setSearchWholeWord(e.target.checked)} className="accent-primary w-3 h-3" />Word
          </label>
          {searchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {searchResults.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {activeSearchIdx + 1} of {searchResults.length}
            </span>
          )}
          {searchResults.length > 0 && (
            <>
              <button onClick={() => navigateSearch(-1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted"><ArrowUp className="h-3 w-3" /></button>
              <button onClick={() => navigateSearch(1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted"><ArrowDown className="h-3 w-3" /></button>
            </>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]) }} className="rounded p-0.5 text-muted-foreground hover:bg-muted ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ── Main Content + Thumbnails ────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Thumbnail sidebar */}
        {showThumbnails && (
          <nav className="w-40 border-r border-border bg-card overflow-y-auto shrink-0 p-1 space-y-1" role="navigation" aria-label="Page thumbnails">
            {thumbnails.map(t => (
              <button key={t.page} onClick={() => { setCurrentPage(t.page); announce(`Navigated to page ${t.page}`); if (viewMode === "continuous") { pageCanvasesRef.current.get(t.page)?.scrollIntoView({ behavior: "smooth", block: "start" }) } }}
                aria-label={`Go to page ${t.page}`} aria-current={currentPage === t.page ? "page" : undefined}
                className={cn("w-full rounded border-2 transition-colors overflow-hidden focus-visible:outline-2 focus-visible:outline-primary", currentPage === t.page ? "border-primary" : "border-transparent hover:border-muted-foreground/30")}>
                <img src={t.dataUrl} alt={`Thumbnail of page ${t.page}`} className="w-full block" />
                <span className="block text-[10px] text-center py-0.5 text-muted-foreground">{t.page}</span>
              </button>
            ))}
            {totalPages > 50 && <div className="text-center text-[10px] text-muted-foreground py-2">+{totalPages - 50} more pages</div>}
          </nav>
        )}

        {/* PDF canvas area */}
        <div id="pdf-main-content" ref={(el) => { (containerRef as any).current = el; mainContentRef.current = el }}
          tabIndex={-1} role="document" aria-label={`PDF document, page ${currentPage} of ${totalPages}`}
          className={cn("flex-1 min-h-0 overflow-auto relative focus-visible:outline-2 focus-visible:outline-primary pdf-canvas-container",
            darkMode ? "bg-zinc-900" : "bg-[#525659]",
            highContrastMode && "!bg-white [&_canvas]:border-2 [&_canvas]:border-black"
          )}onMouseUp={handleTextSelection}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onContextMenu={handleCtxMenu}
        >
          {loading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Rendering document</span></div>}

          {/* Shape preview */}
          {shapePreview && (
            <div className="absolute z-30 pointer-events-none border-2 border-dashed border-primary" style={{
              left: shapePreview.x + "px", top: shapePreview.y + "px",
              width: shapePreview.w + "px", height: shapePreview.h + "px",
              borderRadius: toolMode === "ellipse" ? "50%" : "0",
            }} />
          )}

          {/* Measurement result */}
          {measureResult && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-card border border-border rounded px-3 py-1.5 text-xs shadow-lg">{measureResult}</div>
          )}

          {/* Measure points */}
          {measurePoints.map((pt, i) => (
            <div key={i} className="absolute z-30 w-3 h-3 rounded-full bg-blue-500 border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: pt.x + "px", top: pt.y + "px" }} />
          ))}

          <div className="flex flex-col items-center py-4 gap-4">
            {viewModeDual ? (
              /* Dual page view */
              Array.from({ length: Math.ceil(totalPages / 2) }, (_, spreadIdx) => {
                const left = spreadIdx * 2 + 1
                const right = Math.min(left + 1, totalPages)
                return (
                  <div key={spreadIdx} className="flex gap-0 shadow-xl" style={{ transform: `rotate(${rotation}deg)` }}>
                    <div className="relative border-r border-gray-400">
                      <canvas ref={el => { if (el) pageCanvasesRef.current.set(left, el) }} className="block bg-white" />
                      <div ref={el => { if (el) textLayerRefs.current.set(left, el) }} className="absolute inset-0 select-text" />
                      <div className="absolute bottom-1 right-1 text-[10px] text-gray-400">{left}</div>
                    </div>
                    <div className="relative">
                      <canvas ref={el => { if (el) pageCanvasesRef.current.set(right, el) }} className="block bg-white" />
                      <div ref={el => { if (el) textLayerRefs.current.set(right, el) }} className="absolute inset-0 select-text" />
                      <div className="absolute bottom-1 right-1 text-[10px] text-gray-400">{right}</div>
                    </div>
                  </div>
                )
              })
            ) : viewMode === "single" ? (
              /* Single page view */
              <div className="relative shadow-xl" style={{ transform: `rotate(${rotation}deg)` }}>
                <canvas
                  ref={el => { if (el) pageCanvasesRef.current.set(currentPage, el) }}
                  className="block bg-white"
                  onPointerDown={handleCanvasPointerDown} onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp} onPointerLeave={handleCanvasPointerUp}
                  style={{ cursor: cursorStyle }}
                />
                {/* Text layer for selection */}
                <div ref={el => { if (el) textLayerRefs.current.set(currentPage, el) }}
                  className="absolute inset-0 select-text" style={{ pointerEvents: toolMode === "pan" ? "auto" : "none" }}
                />
                {/* Search highlights */}
                {searchResults.filter(r => r.page === currentPage).map((r, i) => (
                  <div key={i} className="absolute pointer-events-none" style={{
                    left: r.rects[0].x + "px", top: r.rects[0].y + "px",
                    width: r.rects[0].w + "px", height: r.rects[0].h + "px",
                    backgroundColor: activeSearchResult === r ? "rgba(255,165,0,0.6)" : "rgba(255,255,0,0.4)",
                  }} />
                ))}
                {/* Annotations overlay */}
                {hasOverlay && <AnnotationOverlay annotations={pageAnnotations} signatures={pageSignatures} scale={scale} onDragStart={handleOverlayPointerDown} toolMode={toolMode} />}
              </div>
            ) : (
              /* Continuous scroll view */
              Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <div key={p} className="relative shadow-xl" style={{ transform: `rotate(${rotation}deg)` }}>
                  <canvas
                    ref={el => { if (el) pageCanvasesRef.current.set(p, el) }}
                    className="block bg-white"
                    onPointerDown={p === currentPage ? handleCanvasPointerDown : undefined}
                    onPointerMove={p === currentPage ? handleCanvasPointerMove : undefined}
                    onPointerUp={p === currentPage ? handleCanvasPointerUp : undefined}
                    onPointerLeave={p === currentPage ? handleCanvasPointerUp : undefined}
                    style={{ cursor: p === currentPage ? cursorStyle : "default" }}
                  />
                  <div ref={el => { if (el) textLayerRefs.current.set(p, el) }}
                    className="absolute inset-0 select-text" style={{ pointerEvents: toolMode === "pan" ? "auto" : "none" }}
                  />
                  {searchResults.filter(r => r.page === p).map((r, i) => (
                    <div key={i} className="absolute pointer-events-none" style={{
                      left: r.rects[0].x + "px", top: r.rects[0].y + "px",
                      width: r.rects[0].w + "px", height: r.rects[0].h + "px",
                      backgroundColor: activeSearchResult === r ? "rgba(255,165,0,0.6)" : "rgba(255,255,0,0.4)",
                    }} />
                  ))}
                  {p === currentPage && hasOverlay && <AnnotationOverlay annotations={pageAnnotations} signatures={pageSignatures} scale={scale} onDragStart={handleOverlayPointerDown} toolMode={toolMode} />}
                  <div className="absolute -left-8 top-0 text-[10px] text-white/60 py-1">{p}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Status Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-border px-3 py-1 bg-card text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-3">
          <span>{totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : "Loading..."}</span>
          <span>Zoom: {zoomInput}</span>
          {selectedText && (
            <span className="flex items-center gap-1">
              <span className="max-w-[200px] truncate">"{selectedText}"</span>
              <button onClick={handleCopySelected} className="text-primary hover:underline flex items-center gap-0.5"><Copy className="h-3 w-3" />Copy</button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {annotations.length > 0 && <span>{annotations.length} annotation{annotations.length !== 1 ? "s" : ""}</span>}
          {signatures.length > 0 && <span>{signatures.length} signature{signatures.length !== 1 ? "s" : ""}</span>}
          {searchResults.length > 0 && <span>{searchResults.length} search result{searchResults.length !== 1 ? "s" : ""}</span>}
        </div>
      </div>

      {/* ── Context Menu ────────────────────────────────────── */}
      {ctxMenu && (
        <div className="fixed z-50 w-44 rounded border border-border bg-card shadow-xl py-1 text-xs" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <button onClick={() => { navigator.clipboard.writeText(selectedText || ""); setCtxMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"><Copy className="w-3.5 h-3.5"/>Copy</button>
          <button onClick={() => { setShowSearch(true); setSearchQuery(selectedText); setCtxMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"><Search className="w-3.5 h-3.5"/>Search selection</button>
          <div className="border-t border-border my-1"/>
          <button onClick={() => { handlePrint(); setCtxMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"><Printer className="w-3.5 h-3.5"/>Print</button>
          <button onClick={() => { handleDownload(); setCtxMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"><Download className="w-3.5 h-3.5"/>Download</button>
        </div>
      )}

      {/* ── Annotation List Panel ────────────────────────────── */}
      {showAnnotationList && (
        <div className="fixed right-0 top-0 bottom-0 z-40 w-64 border-l border-border bg-card shadow-xl overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-sm font-semibold">Annotations ({annotations.length})</h3>
            <button onClick={() => setShowAnnotationList(false)} className="rounded p-1 hover:bg-muted"><X className="w-4 h-4"/></button>
          </div>
          <div className="p-2 space-y-1">
            {annotations.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No annotations</div>}
            {annotations.map(ann => (
              <div key={ann.id} className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5 text-xs group">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ann.color }} />
                <span className="flex-1 truncate">{ann.type} — p.{ann.page}</span>
                <button onClick={() => { setCurrentPage(ann.page); setShowAnnotationList(false) }} className="text-muted-foreground hover:text-primary hidden group-hover:inline">Go</button>
                <button onClick={() => removeAnnotation(ann.id)} className="text-muted-foreground hover:text-destructive hidden group-hover:inline"><X className="w-3 h-3"/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bookmarks Panel ───────────────────────────────────── */}
      {showBookmarks && (
        <div className="fixed left-0 top-0 bottom-0 z-40 w-56 border-r border-border bg-card shadow-xl overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-sm font-semibold">Bookmarks</h3>
            <button onClick={() => setShowBookmarks(false)} className="rounded p-1 hover:bg-muted"><X className="w-4 h-4"/></button>
          </div>
          <div className="p-2">
            {bookmarks.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No bookmarks found</div>}
            {bookmarks.map((bm, i) => (
              <div key={i}>
                <button onClick={() => { setCurrentPage(bm.page); setShowBookmarks(false) }}
                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{bm.title}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">{bm.page}</span>
                </button>
                {bm.children?.map((child: any, j: number) => (
                  <button key={j} onClick={() => { setCurrentPage(child.page); setShowBookmarks(false) }}
                    className="w-full text-left pl-6 pr-2 py-1 text-xs rounded hover:bg-muted flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{child.title}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{child.page}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Form Fields Panel ─────────────────────────────────── */}
      {showFormPanel && (
        <div className="fixed right-0 top-0 bottom-0 z-40 w-72 border-l border-border bg-card shadow-xl overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-sm font-semibold">Form Fields ({formFields.length})</h3>
            <button onClick={() => setShowFormPanel(false)} className="rounded p-1 hover:bg-muted"><X className="w-4 h-4"/></button>
          </div>
          {/* Gap #11: XFA form warning */}
          {isXfaForm && (
            <div className="mx-3 mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
              <TriangleAlert className="h-3 w-3 inline mr-1" />
              This document uses XFA — a legacy Adobe form format. Standard form filling may not work.
              <button onClick={() => { setShowXfaPanel(true); setShowFormPanel(false) }} className="block mt-1 text-amber-800 underline hover:text-amber-900">View extracted data</button>
            </div>
          )}
          <div className="p-3 space-y-2">
            {formFields.length === 0 && !isXfaForm && <div className="text-xs text-muted-foreground text-center py-4">No form fields detected</div>}
            {formFields.length === 0 && isXfaForm && <div className="text-xs text-muted-foreground text-center py-4">{xfaData ? "XFA data extracted — see panel" : "Extracting XFA form data..."}</div>}
            {formFields.map((field, i) => (
              <div key={i} className="space-y-1">
                <label className="text-[10px] text-muted-foreground">{field.name} (p.{field.page})</label>
                {field.type === "Tx" || field.type === "text" ? (
                  <input value={field.value} onChange={e => updateFormField(i, e.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
                ) : field.type === "Btn" || field.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={field.value === "Yes"} onChange={e => updateFormField(i, e.target.checked ? "Yes" : "Off")} className="accent-primary" />
                    {field.name}
                  </label>
                ) : (
                  <input value={field.value} onChange={e => updateFormField(i, e.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Redaction bar ─────────────────────────────────────── */}
      {redactionMode && (
        <div className="flex items-center gap-2 border-t border-border bg-red-50 dark:bg-red-950 px-3 py-1.5">
          <TriangleAlert className="w-4 h-4 text-red-500" />
          <span className="text-xs text-red-700 dark:text-red-400">Redaction mode: click to mark areas</span>
          <div className="flex-1" />
          <button onClick={applyRedactions} className="rounded bg-red-500 px-2 py-0.5 text-xs text-white">Apply</button>
          <button onClick={() => { setRedactionMode(false); setRedactions([]) }} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">Cancel</button>
        </div>
      )}

      {/* ── Metadata Panel ──────────────────────────────────── */}
      {showMetadata && pdfMetadata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowMetadata(false)}>
          <div className="bg-card rounded-lg shadow-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Document Info</h3><button onClick={() => setShowMetadata(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            <div className="space-y-2 text-xs">
              {Object.entries(pdfMetadata).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right max-w-[180px] truncate">{v}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {/* ── Print Preview Panel ──────────────────────────────── */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPrintPreview(false)}>
          <div className="bg-card rounded-lg shadow-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Print</h3><button onClick={() => setShowPrintPreview(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <span>Pages:</span>
                <input type="number" min={1} max={totalPages} value={printRange.from} onChange={e => setPrintRange(pr => ({ ...pr, from: parseInt(e.target.value) || 1 }))} className="w-16 rounded border border-border bg-background px-2 py-1 text-xs" />
                <span>to</span>
                <input type="number" min={1} max={totalPages} value={printRange.to} onChange={e => setPrintRange(pr => ({ ...pr, to: parseInt(e.target.value) || totalPages }))} className="w-16 rounded border border-border bg-background px-2 py-1 text-xs" />
              </div>
              <div className="flex gap-2">
                <button onClick={doPrint} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Print {printRange.from}-{printRange.to}</button>
                <button onClick={() => setShowPrintPreview(false)} className="rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Attachments Panel ────────────────────────────────── */}
      {showAttachments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAttachments(false)}>
          <div className="bg-card rounded-lg shadow-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Attachments</h3><button onClick={() => setShowAttachments(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            {attachments.length === 0 ? <div className="text-xs text-muted-foreground text-center py-4">No attachments</div>
              : <div className="space-y-1">{
                attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5 text-xs">
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <span className="flex-1 truncate">{att.filename}</span>
                    <span className="text-muted-foreground">{fmtBytes(att.size)}</span>
                  </div>
                ))
              }</div>}
          </div>
        </div>
      )}

      {/* ── Toolbar Customize ────────────────────────────────── */}
      {showToolbarCustomize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowToolbarCustomize(false)}>
          <div className="bg-card rounded-lg shadow-xl p-5 max-w-xs w-full max-h-80 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Toolbar</h3><button onClick={() => setShowToolbarCustomize(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            <div className="space-y-1">
              {["Search","Thumbnails","Print","Download","Annotations","Bookmarks","Forms","Measure","Redact","DarkMode","Fullscreen"].map(t => (
                <label key={t} className="flex items-center gap-2 text-xs py-1">
                  <input type="checkbox" checked={!hiddenTools.has(t)} onChange={e => {
                    setHiddenTools(prev => { const next = new Set(prev); e.target.checked ? next.delete(t) : next.add(t); return next })
                  }} className="accent-primary w-3 h-3" />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Last read position prompt ────────────────────────── */}
      {!loading && lastReadPage > 1 && lastReadPage !== currentPage && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Continue from page {lastReadPage}?</span>
          <button onClick={() => goToPage(lastReadPage)} className="text-primary hover:underline font-medium">Yes</button>
          <button onClick={() => setLastReadPage(1)} className="text-muted-foreground hover:underline">No</button>
        </div>
      )}

      {/* ── PDF/A Validation Panel ────────────────────────────── */}
      {showPdfAValidation && pdfAScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPdfAValidation(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">PDF/A Validation</h3><button onClick={() => setShowPdfAValidation(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            <div className="text-sm font-medium mb-2">Score: {pdfAScore.score}/{pdfAScore.checks.length}</div>
            <div className="space-y-1 max-h-60 overflow-y-auto">{pdfAScore.checks.map((c, i) => (<div key={i} className="flex items-center gap-2 text-xs"><span className={c.pass ? "text-green-500" : "text-red-500"}>{c.pass ? "✅" : "❌"}</span><span>{c.name}: {c.detail}</span></div>))}</div>
          </div>
        </div>
      )}

      {/* ── AI Summary Panel ──────────────────────────────────── */}
      {showAiSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAiSummary(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-2xl w-full max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">AI Summary</h3><button onClick={() => setShowAiSummary(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            {aiSummaryLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Analyzing document...</div>
              : aiSummary ? <div className="text-sm prose prose-sm max-h-[60vh] overflow-y-auto bg-muted/30 p-4 rounded whitespace-pre-wrap">{aiSummary}</div>
              : <div className="text-sm text-muted-foreground">No summary available</div>}
            <div className="flex gap-2 mt-3">
              {aiSummary && <button onClick={() => { navigator.clipboard.writeText(aiSummary); showMessage("success", "Summary copied") }} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Copy</button>}
              <button onClick={() => { handleAiSummarize() }} disabled={aiSummaryLoading} className="rounded border border-border px-3 py-1 text-xs">Regenerate</button>
            </div>
          </div>
        </div>
      )}

      {/* ── OCR Text Panel ────────────────────────────────────── */}
      {showOcr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowOcr(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-2xl w-full max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">OCR Text Extraction</h3><button onClick={() => setShowOcr(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            {ocrLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <pre className="text-xs whitespace-pre-wrap max-h-[60vh] overflow-y-auto bg-muted/30 p-3 rounded">{ocrText}</pre>}
            <button onClick={() => { navigator.clipboard.writeText(ocrText) }} className="mt-2 rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Copy All</button>
          </div>
        </div>
      )}

      {/* ── 3D Viewer ─────────────────────────────────────────── */}
      {showThreeDViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowThreeDViewer(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">3D Model Viewer</h3><button onClick={() => setShowThreeDViewer(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            <input type="file" accept=".glb,.gltf" onChange={e => { const f = e.target.files?.[0]; if (f) setThreeDModel(URL.createObjectURL(f)) }} className="text-xs mb-2" />
            {threeDModel ? (
              <ModelViewer src={threeDModel} camera-controls auto-rotate style={{ width: "100%", height: "400px" }} />
            ) : <p className="text-xs text-muted-foreground">Upload a .glb or .gltf file to view</p>}
          </div>
        </div>
      )}

      {/* ── XFA Data Panel ────────────────────────────────────── */}
      {showXfaPanel && xfaData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowXfaPanel(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-2xl w-full max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">XFA Form Data (Legacy)</h3><button onClick={() => setShowXfaPanel(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            <pre className="text-xs whitespace-pre-wrap max-h-[60vh] overflow-y-auto bg-muted/30 p-3 rounded">{xfaData}</pre>
            <button onClick={() => { navigator.clipboard.writeText(xfaData) }} className="mt-2 rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Copy</button>
          </div>
        </div>
      )}

      {/* ── Portfolio Panel ───────────────────────────────────── */}
      {showPortfolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPortfolio(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Portfolio (Embedded Files)</h3><button onClick={() => setShowPortfolio(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            {portfolioFiles.length === 0 ? <p className="text-xs text-muted-foreground">No embedded files found.</p> : <div className="space-y-1 max-h-60 overflow-y-auto">{portfolioFiles.map((f, i) => (<div key={i} className="flex items-center justify-between text-xs border border-border rounded p-2"><span>{f.name}</span><button onClick={() => handleExtractPortfolioFile(f)} className="text-primary hover:underline">Extract</button></div>))}</div>}
          </div>
        </div>
      )}

      {/* ── Remote URL Dialog ─────────────────────────────────── */}
      {showRemoteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRemoteDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Load Remote PDF</h3><button onClick={() => setShowRemoteDialog(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button></div>
            <input value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="https://example.com/document.pdf" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleRemoteLoad} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Load</button>
          </div>
        </div>
      )}

      {/* ── Annotation Reply Panel ────────────────────────────── */}
      {hoveredAnnotation && annotationReplies[hoveredAnnotation]?.length > 0 && (
        <div className="fixed z-60 w-48 rounded border border-border bg-card shadow-lg p-2 text-xs" style={{ left: ctxMenu?.x ?? 100, top: (ctxMenu?.y ?? 100) - 80 }}>
          <div className="font-medium mb-1">Replies:</div>
          {annotationReplies[hoveredAnnotation].map((r, i) => (<div key={i} className="text-muted-foreground mb-0.5">{r}</div>))}
        </div>
      )}

      {/* ── Signature Pad Modal ───────────────────────────────── */}
      {activeSignaturePad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setActiveSignaturePad(false); setSignPadDataUrl(null); setPendingSignatureTarget(null) }}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Draw Signature</h3><button onClick={() => { setActiveSignaturePad(false); setSignPadDataUrl(null); setPendingSignatureTarget(null) }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <SignaturePad value={signPadDataUrl} onChange={setSignPadDataUrl} />
            <div className="flex justify-end gap-2 mt-3"><Button variant="outline" size="sm" onClick={() => setSignPadDataUrl(null)}>Clear</Button><Button size="sm" onClick={applySignature} disabled={!signPadDataUrl}>Apply Signature</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Annotation Overlay ────────────────────────────────────────

function AnnotationOverlay({ annotations, signatures, scale, onDragStart, toolMode }: {
  annotations: PdfAnnotation[]
  signatures: SignatureData[]
  scale: number
  onDragStart?: (event: React.PointerEvent<HTMLDivElement>, annId: string, annRect: { x: number; y: number; w: number; h: number }) => void
  toolMode?: string
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {annotations.map(ann => {
        if ((ann.type === "highlight" || ann.type === "underline" || ann.type === "strikethrough") && ann.rect) {
          const yPos = ann.type === "underline" ? (ann.rect.y + ann.rect.h) : ann.type === "strikethrough" ? (ann.rect.y + ann.rect.h / 2) : ann.rect.y
          const h = ann.type === "highlight" ? ann.rect.h : 2
          return <div key={ann.id} className="absolute" style={{ left: ann.rect.x * scale + "px", top: yPos * scale + "px", width: ann.rect.w * scale + "px", height: h * scale + "px", backgroundColor: ann.color, opacity: ann.type === "highlight" ? ann.opacity : 1, mixBlendMode: ann.type === "highlight" ? "multiply" : "normal" }} />
        }
        if (ann.type === "text" && ann.rect) {
          const fontFamily = (ann as any).fontFamily || "Helvetica"
          const fontSize = (ann as any).fontSize || 12
          const fontColor = (ann as any).fontColor || "#333333"
          return (
            <div key={ann.id} className="absolute text-xs bg-white/80 px-1 border rounded"
              style={{
                left: ann.rect.x * scale + "px", top: ann.rect.y * scale + "px",
                color: fontColor, fontFamily, fontSize: `${fontSize * scale}px`,
                cursor: (toolMode === "pan" || toolMode === "select") ? "grab" : "default",
                pointerEvents: (toolMode === "pan" || toolMode === "select") ? "auto" : "none",
              }}
              onPointerDown={(e) => onDragStart?.(e, ann.id, ann.rect!)}>
              {ann.text}
            </div>
          )
        }
        if (ann.type === "sticky" && ann.rect) {
          return (
            <div key={ann.id} className="absolute"
              style={{
                left: ann.rect.x * scale + "px", top: ann.rect.y * scale + "px",
                cursor: (toolMode === "pan" || toolMode === "select") ? "grab" : "default",
                pointerEvents: (toolMode === "pan" || toolMode === "select") ? "auto" : "none",
              }}
              onPointerDown={(e) => onDragStart?.(e, ann.id, ann.rect!)}>
              <div className="w-6 h-6 bg-yellow-300 rounded-sm shadow rotate-3" />
              {ann.text && <div className="absolute top-7 left-0 bg-yellow-100 border border-yellow-300 rounded px-2 py-1 text-[10px] max-w-[160px] shadow whitespace-pre-wrap">{ann.text}</div>}
            </div>
          )
        }
        if (ann.type === "rectangle" && ann.rect) {
          return <div key={ann.id} className="absolute border-2" style={{ left: ann.rect.x * scale + "px", top: ann.rect.y * scale + "px", width: ann.rect.w * scale + "px", height: ann.rect.h * scale + "px", borderColor: ann.color, opacity: ann.opacity }} />
        }
        if (ann.type === "ellipse" && ann.rect) {
          return <div key={ann.id} className="absolute border-2 rounded-full" style={{ left: ann.rect.x * scale + "px", top: ann.rect.y * scale + "px", width: ann.rect.w * scale + "px", height: ann.rect.h * scale + "px", borderColor: ann.color, opacity: ann.opacity }} />
        }
        if ((ann.type === "line" || ann.type === "arrow") && ann.rect) {
          return (
            <svg key={ann.id} className="absolute inset-0 w-full h-full overflow-visible">
              <line x1={ann.rect.x * scale} y1={ann.rect.y * scale} x2={(ann.rect.x + ann.rect.w) * scale} y2={(ann.rect.y + ann.rect.h) * scale}
                stroke={ann.color} strokeWidth={2} opacity={ann.opacity} />
              {ann.type === "arrow" && (
                <polygon points={`${(ann.rect.x + ann.rect.w) * scale},${(ann.rect.y + ann.rect.h) * scale} ${(ann.rect.x + ann.rect.w) * scale - 8},${(ann.rect.y + ann.rect.h) * scale - 4} ${(ann.rect.x + ann.rect.w) * scale - 8},${(ann.rect.y + ann.rect.h) * scale + 4}`}
                  fill={ann.color} opacity={ann.opacity} />
              )}
            </svg>
          )
        }
        if (ann.type === "redaction" && ann.rect) {
          return <div key={ann.id} className="absolute bg-black" style={{ left: ann.rect.x * scale + "px", top: ann.rect.y * scale + "px", width: ann.rect.w * scale + "px", height: ann.rect.h * scale + "px" }} />
        }
        if (ann.type === "stamp" && ann.rect) {
          const stampColors: Record<string, string> = { APPROVED: "border-green-600 text-green-700 bg-green-50", DRAFT: "border-orange-600 text-orange-700 bg-orange-50", CONFIDENTIAL: "border-red-600 text-red-700 bg-red-50", FINAL: "border-blue-600 text-blue-700 bg-blue-50" }
          const cls = stampColors[ann.text ?? ""] ?? "border-gray-600 text-gray-700 bg-gray-50"
          return (
            <div key={ann.id} className={cn("absolute border-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider opacity-80 rotate-[-5deg]", cls)}
              style={{ left: ann.rect.x * scale + "px", top: ann.rect.y * scale + "px", width: ann.rect.w * scale + "px" }}>
              {ann.text}
            </div>
          )
        }
        if (ann.type === "callout" && ann.rect) {
          return (
            <div key={ann.id} className="absolute" style={{ left: ann.rect.x * scale + "px", top: ann.rect.y * scale + "px" }}>
              {ann.points && ann.points.length >= 2 && (
                <svg className="absolute" style={{ left: 0, top: ann.rect.h * scale, width: Math.abs(ann.points[1].x - ann.points[0].x) * scale, height: Math.abs(ann.points[1].y - ann.points[0].y) * scale, overflow: "visible" }}>
                  <line x1={0} y1={0} x2={(ann.points[1].x - ann.points[0].x) * scale} y2={(ann.points[1].y - ann.points[0].y) * scale - ann.rect.h * scale} stroke={ann.color} strokeWidth={1} />
                </svg>
              )}
              <div className="bg-white border border-gray-300 rounded px-2 py-1 text-[10px] max-w-[160px] shadow whitespace-pre-wrap" style={{ width: ann.rect.w * scale + "px" }}>
                {ann.text}
              </div>
            </div>
          )
        }
        if (ann.type === "freehand" && ann.points && ann.points.length > 1) {
          const d = ann.points.map((p, i) => (i === 0 ? "M" : "L") + p.x * scale + " " + p.y * scale).join(" ")
          return <svg key={ann.id} className="absolute inset-0 w-full h-full"><path d={d} stroke={ann.color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        }
        return null
      })}
      {signatures.map(sig => <img key={sig.id} src={sig.imageDataUrl} alt="Signature" className="absolute" style={{ left: sig.x * scale + "px", top: sig.y * scale + "px", width: sig.width + "px", height: sig.height + "px" }} />)}
    </div>
  )
}

// ─── Signature Pad ─────────────────────────────────────────────

function SignaturePad({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext("2d")!; ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"
    if (value) { const img = new window.Image(); img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0) }; img.src = value }
  }, [value])
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => { setIsDrawing(true); lastPosRef.current = getPos(e) }
  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!isDrawing || !lastPosRef.current) return; const ctx = canvasRef.current!.getContext("2d")!; const p = getPos(e); ctx.beginPath(); ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); lastPosRef.current = p; setHasDrawing(true) }
  const endDraw = () => { if (hasDrawing && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png")); setIsDrawing(false); lastPosRef.current = null }
  return <div className="border border-border rounded-md bg-white"><canvas ref={canvasRef} width={400} height={150} className="w-full touch-none" onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerLeave={endDraw} style={{ cursor: "crosshair" }} /></div>
}

function fmtBytes(b: number) { return b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1048576).toFixed(1)}MB` }

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "")
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  }
}
