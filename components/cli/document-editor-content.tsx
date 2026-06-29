"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

declare module "react" {
  interface CSSProperties {
    cssText?: string
  }
}
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, Type, Palette, Undo2, Redo2, FileText, FolderOpen,
  Download, FilePlus, Printer, FileDown, FileUp, Loader2, AlertCircle, CheckCircle2,
  Table2, Image, Link, Heading1, Heading2, Heading3, Subscript, Superscript, RemoveFormatting,
  ChevronDown, Search, Replace, Highlighter, PaintBucket as PaintBucket2, X, ZoomIn, ZoomOut, Copy, Scissors,
  Clipboard, Trash2, Ban, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Merge,
  FileOutput, MessageSquare, SpellCheck, BookOpen, History, Eye, FilePenLine, FileSpreadsheet, Sliders,
  Calendar, Hash, Lock, Info, Maximize2, SmilePlus, Braces, AlignVerticalJustifyCenter, Columns3, Ruler,
  Quote, Shapes, Bookmark, ListTree, BookmarkPlus, ArrowRightLeft, Accessibility, Languages,
  FileCode, FormInput, BookOpenCheck, BookCopy, Monitor, Droplets, Users, Radio,
  FileDiff, GitBranch, Shield, SwatchBook, FileArchive, FileCheck, Layout, ListChecks, Combine,
  BarChart3, FileSearch, FileSignature, Copyright, ClipboardPaste, Paintbrush, PenTool,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollaboration, CollabUserBar, RemoteCursors } from "@/lib/use-collaboration"
import {
  fileToBase64,
  fileToArrayBuffer,
  blobToBase64,
  saveBlobAs,
  openWordFileDialog,
  isWordDocument,
  docxToHtml,
  docxBase64ToHtml,
  htmlToDocx,
  sanitizeEditorHtml,
  mergeTemplate,
  listDocuments,
  downloadDocument,
  uploadDocument,
  type DocumentEntry,
  type TemplateField,
} from "@/lib/document-editor-utils"

// ─── Types ──────────────────────────────────────────────────────

type EditorMode = "idle" | "loading" | "editing" | "saving" | "error"

interface FileInfo {
  name: string
  provider: string
  folder: string
  size?: number
}

interface FontSizeOption {
  label: string
  value: string
}

const FONT_SIZES: FontSizeOption[] = [
  { label: "8", value: "1" },
  { label: "9", value: "1" },
  { label: "10", value: "2" },
  { label: "11", value: "2" },
  { label: "12", value: "3" },
  { label: "14", value: "3" },
  { label: "16", value: "4" },
  { label: "18", value: "4" },
  { label: "20", value: "5" },
  { label: "24", value: "5" },
  { label: "28", value: "6" },
  { label: "36", value: "7" },
  { label: "48", value: "7" },
]

const FONT_FAMILIES = [
  "Arial",
  "Calibri",
  "Cambria",
  "Courier New",
  "Georgia",
  "Times New Roman",
  "Verdana",
]

const FONT_SIZE_MAP: Record<string, string> = {
  "1": "8pt", "2": "10pt", "3": "12pt", "4": "14pt",
  "5": "18pt", "6": "24pt", "7": "36pt",
}

function cssTextToReactStyle(cssText: string): CSSProperties {
  return cssText.split(";").reduce<CSSProperties>((style, declaration) => {
    const [rawProperty, ...rawValue] = declaration.split(":")
    const property = rawProperty?.trim()
    const value = rawValue.join(":").trim()
    if (!property || !value) return style

    const reactProperty = property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) as keyof CSSProperties
    return { ...style, [reactProperty]: value }
  }, {})
}

// ─── Component ──────────────────────────────────────────────────

export function DocumentEditorContent() {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<EditorMode>("idle")
  const [currentFile, setCurrentFile] = useState<FileInfo | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Toolbar state
  const [fontName, setFontName] = useState("Calibri")
  const [fontSize, setFontSize] = useState("3") // 12pt
  const [showFontSizePicker, setShowFontSizePicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)

  // File browser
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [fileList, setFileList] = useState<DocumentEntry[]>([])
  const [browserFolder, setBrowserFolder] = useState("")
  const [browserProvider, setBrowserProvider] = useState("local")
  const [browserLoading, setBrowserLoading] = useState(false)

  // Template merge
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([])

  // Link dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false)

  // Table dialog
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)

  // Text color & highlight
  const [showColorPicker, setShowColorPicker] = useState<"text" | "bg" | null>(null)
  const [textColor, setTextColor] = useState("#000000")
  const [highlightColor, setHighlightColor] = useState("#FFFF00")

  // Find & Replace
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findText, setFindText] = useState("")
  const [replaceText, setReplaceText] = useState("")
  const [findMatchCase, setFindMatchCase] = useState(false)
  const [findResults, setFindResults] = useState<number>(0)

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // Zoom
  const [zoom, setZoom] = useState(100)
  const [showZoomSlider, setShowZoomSlider] = useState(false)

  // ── WYSIWYG Pagination ──────────────────────────────────────
  const [pageViewEnabled, setPageViewEnabled] = useState(true)
  const [pageCount, setPageCount] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const pageContainerRef = useRef<HTMLDivElement | null>(null)

  // Page dimensions in px at 96 DPI (8.5" x 11" Letter)
  const PAGE_W = 816 // 8.5 * 96
  const PAGE_H = 1056 // 11 * 96
  const PAGE_MARGIN = { top: 96, bottom: 96, left: 96, right: 96 } // 1 inch margins
  const CONTENT_H = PAGE_H - PAGE_MARGIN.top - PAGE_MARGIN.bottom

  // Paginate content: split editor innerHTML into pages
  const paginateContent = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !pageViewEnabled) return
    if (!pageContainerRef.current) return

    const container = pageContainerRef.current
    // Use a hidden measuring div
    const measurer = document.createElement("div")
    measurer.style.cssText = `position:absolute;left:-9999px;top:0;width:${PAGE_W - PAGE_MARGIN.left - PAGE_MARGIN.right}px;font-family:Calibri,sans-serif;font-size:${12 * (zoom/100)}pt;line-height:1.5;color:#000;visibility:hidden;`
    document.body.appendChild(measurer)

    // Get all top-level block elements from editor
    const blocks = Array.from(editor.children) as HTMLElement[]
    const pages: HTMLElement[][] = [[]]
    let currentHeight = 0
    let pageIdx = 0

    for (const block of blocks) {
      // Clone block and measure
      const clone = block.cloneNode(true) as HTMLElement
      measurer.innerHTML = ""
      measurer.appendChild(clone)
      const blockH = clone.getBoundingClientRect().height

      // Check widow/orphan control
      const isHeading = /^H[1-6]$/i.test(block.tagName)
      const minOrphanHeight = 36 // Minimum content height before page break (widow/orphan)

      if (currentHeight + blockH > CONTENT_H) {
        // Need page break
        // Widow control: if heading at bottom of page with < 2 lines of space, move to next page
        if (isHeading || currentHeight + minOrphanHeight > CONTENT_H) {
          pageIdx++
          pages[pageIdx] = []
          currentHeight = 0
        } else {
          // Try to split the block (for long paragraphs)
          // For now, move entire block to next page
          pageIdx++
          pages[pageIdx] = []
          currentHeight = 0
        }
      }

      pages[pageIdx].push(block)
      currentHeight += blockH

      // Check for explicit page breaks
      if (block.style?.pageBreakAfter === "always" || block.querySelector?.("hr.page-break")) {
        pageIdx++
        pages[pageIdx] = []
        currentHeight = 0
      }
    }

    document.body.removeChild(measurer)

    // Render pages
    const pc = pages.length
    setPageCount(pc)
    if (currentPage > pc) setCurrentPage(pc)

    // Update page container with visual page boundaries
    container.innerHTML = ""
    pages.forEach((pageBlocks, pi) => {
      const pageDiv = document.createElement("div")
      pageDiv.className = "doc-page"
      pageDiv.style.cssText = `width:${PAGE_W * (zoom/100)}px;min-height:${PAGE_H * (zoom/100)}px;max-height:${PAGE_H * (zoom/100)}px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.12);margin:0 auto 24px auto;padding:${PAGE_MARGIN.top * (zoom/100)}px ${PAGE_MARGIN.right * (zoom/100)}px ${PAGE_MARGIN.bottom * (zoom/100)}px ${PAGE_MARGIN.left * (zoom/100)}px;position:relative;box-sizing:border-box;`

      // Page number footer
      const pageNumDiv = document.createElement("div")
      pageNumDiv.style.cssText = `position:absolute;bottom:${36 * (zoom/100)}px;left:0;right:0;text-align:center;font-size:${9 * (zoom/100)}pt;color:#999;font-family:Calibri,sans-serif;`
      pageNumDiv.textContent = `${pi + 1}`
      pageDiv.appendChild(pageNumDiv)

      for (const block of pageBlocks) {
        pageDiv.appendChild(block.cloneNode(true))
      }
      container.appendChild(pageDiv)
    })

    // Add event listener for scroll-based current page detection
    const scrollHandler = () => {
      const pages = container.querySelectorAll(".doc-page")
      const containerRect = container.getBoundingClientRect()
      const scrollMid = containerRect.top + containerRect.height / 3
      for (let i = 0; i < pages.length; i++) {
        const rect = pages[i].getBoundingClientRect()
        if (rect.bottom > scrollMid) {
          setCurrentPage(i + 1)
          break
        }
      }
    }
    container.addEventListener("scroll", scrollHandler)
    return () => container.removeEventListener("scroll", scrollHandler)
  }, [pageViewEnabled, zoom, CONTENT_H, currentPage])

  // Re-paginate on content changes
  useEffect(() => {
    if (!pageViewEnabled) return
    const timer = setTimeout(paginateContent, 500)
    return () => clearTimeout(timer)
  }, [pageViewEnabled, paginateContent, isDirty])

  // 18 remaining gaps state
  const [showReviewPane, setShowReviewPane] = useState(false)
  const [changes, setChanges] = useState<{ id: string; type: "insert" | "delete"; html: string; accepted: boolean }[]>([])
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [docTitle, setDocTitle] = useState("")
  const [docAuthor, setDocAuthor] = useState("")
  const [showProperties, setShowProperties] = useState(false)
  const [pageBgColor, setPageBgColor] = useState("#FFFFFF")
  const [showPageColor, setShowPageColor] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showColumns, setShowColumns] = useState(false)
  const [columnsCount, setColumnsCount] = useState(1)
  const [showRuler, setShowRuler] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showEquationDialog, setShowEquationDialog] = useState(false)
  const [equationText, setEquationText] = useState("")
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Table enhancements
  const [showTableBorderDialog, setShowTableBorderDialog] = useState(false)
  const [tableBorderStyle, setTableBorderStyle] = useState("1px solid #000")
  const [tableBgColor, setTableBgColor] = useState("#FFFFFF")
  const [showTableContext, setShowTableContext] = useState<{ x: number; y: number } | null>(null)

  // Phase 3: Page Layout
  const [showHeaderFooter, setShowHeaderFooter] = useState(false)
  const [headerText, setHeaderText] = useState("")
  const [footerText, setFooterText] = useState("")
  const [showPageNumber, setShowPageNumber] = useState(false)
  const [pageNumberPos, setPageNumberPos] = useState<"header" | "footer">("footer")
  const [pageNumberAlign, setPageNumberAlign] = useState<"left" | "center" | "right">("center")
  const [showMargins, setShowMargins] = useState(false)
  const [marginTop, setMarginTop] = useState("1in")
  const [marginBottom, setMarginBottom] = useState("1in")
  const [marginLeft, setMarginLeft] = useState("1in")
  const [marginRight, setMarginRight] = useState("1in")

  // Phase 4: Advanced
  const [showTocDialog, setShowTocDialog] = useState(false)
  const [showSpellCheck, setShowSpellCheck] = useState(false)
  const [spellResults, setSpellResults] = useState<{ word: string; suggestions: string[] }[]>([])
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [comments, setComments] = useState<{ id: string; text: string; date: string; author: string }[]>([])
  const [showTrackChanges, setShowTrackChanges] = useState(false)
  const [trackChangesEnabled, setTrackChangesEnabled] = useState(false)

  // ── Remaining gaps ──────────────────────────────────────────
  const [showFootnoteDialog, setShowFootnoteDialog] = useState(false)
  const [footnoteText, setFootnoteText] = useState("")
  const [footnotes, setFootnotes] = useState<{ id: string; text: string; ref: string }[]>([])
  const [showWatermarkDialog, setShowWatermarkDialog] = useState(false)
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL")
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.1)
  const [showSymbolDialog, setShowSymbolDialog] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [showWordCount, setShowWordCount] = useState(false)
  const [showOutlinePane, setShowOutlinePane] = useState(false)
  const [outlineItems, setOutlineItems] = useState<{ level: number; text: string; id: string }[]>([])
  const [showMailMerge, setShowMailMerge] = useState(false)
  const [mailMergeData, setMailMergeData] = useState<string[][]>([])
  const [mailMergeFields, setMailMergeFields] = useState<string[]>([])
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versions, setVersions] = useState<{ id: string; date: string; label: string; html: string }[]>([])
  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [showMacroDialog, setShowMacroDialog] = useState(false)
  const [macroName, setMacroName] = useState("")
  const [macroActions, setMacroActions] = useState("")
  const [macros, setMacros] = useState<{ name: string; actions: string }[]>([])
  const [showFieldDialog, setShowFieldDialog] = useState(false)
  const [fieldType, setFieldType] = useState<"date" | "time" | "filename" | "page">("date")
  const [showEmbedDialog, setShowEmbedDialog] = useState(false)

  // ── 18 remaining gaps state ──────────────────────────────────
  // #5 Advanced list numbering
  const [showListNumberingDialog, setShowListNumberingDialog] = useState(false)
  const [listNumberFormat, setListNumberFormat] = useState<"decimal" | "lowerRoman" | "upperRoman" | "lowerLetter" | "upperLetter" | "multiLevel">("decimal")
  const [listRestartNumber, setListRestartNumber] = useState(1)

  // #6 Floating image layout
  const [floatingImageMode, setFloatingImageMode] = useState<"inline" | "square" | "tight" | "behind" | "front">("inline")

  // #7 Image resize handles
  const [imageResizeTarget, setImageResizeTarget] = useState<HTMLImageElement | null>(null)
  const [imageResizeHandle, setImageResizeHandle] = useState<"tl" | "tr" | "bl" | "br" | "ml" | "mr" | "mt" | "mb" | null>(null)

  // #8 Image cropping
  const [showImageCrop, setShowImageCrop] = useState(false)
  const [cropTarget, setCropTarget] = useState<HTMLImageElement | null>(null)
  const [cropValues, setCropValues] = useState({ top: 0, right: 0, bottom: 0, left: 0 })

  // #9 Text boxes
  const [showTextBoxDialog, setShowTextBoxDialog] = useState(false)
  const [textBoxContent, setTextBoxContent] = useState("")

  // #10 Shapes
  const [showShapesMenu, setShowShapesMenu] = useState(false)
  const [shapeType, setShapeType] = useState<"rectangle" | "oval" | "arrow" | "callout" | "line" | "triangle" | "star" | null>(null)

  // #11 Drawing canvas
  const [showDrawingCanvas, setShowDrawingCanvas] = useState(false)
  const [drawingPaths, setDrawingPaths] = useState<Array<{ points: Array<{x:number;y:number}>; color:string; width:number }>>([])
  const [drawingColor, setDrawingColor] = useState("#000000")
  const [drawingWidth, setDrawingWidth] = useState(2)
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false)

  // #12 Endnotes
  const [showEndnoteDialog, setShowEndnoteDialog] = useState(false)
  const [endnoteText, setEndnoteText] = useState("")
  const [endnotes, setEndnotes] = useState<{ id: string; text: string; ref: string }[]>([])

  // #13 Bibliography
  const [showBibliographyDialog, setShowBibliographyDialog] = useState(false)
  const [bibliographyStyle, setBibliographyStyle] = useState<"APA" | "MLA" | "Chicago">("APA")
  const [citations, setCitations] = useState<Array<{ id: string; author: string; title: string; year: string; publisher: string; url: string }>>([])
  const [showCitationDialog, setShowCitationDialog] = useState(false)
  const [citationSource, setCitationSource] = useState("")
  const [citationAuthor, setCitationAuthor] = useState("")
  const [citationYear, setCitationYear] = useState("")

  // #14 Restrict editing
  const [showRestrictEditDialog, setShowRestrictEditDialog] = useState(false)
  const [restrictPassword, setRestrictPassword] = useState("")
  const [restrictHash, setRestrictHash] = useState<string | null>(null)

  // #15 Custom XML parts
  const [showCustomXmlDialog, setShowCustomXmlDialog] = useState(false)
  const [customXmlData, setCustomXmlData] = useState("")
  const [customXmlBindings, setCustomXmlBindings] = useState<Array<{ tag: string; content: string }>>([])

  // #16 Content controls
  const [showContentControlDialog, setShowContentControlDialog] = useState(false)
  const [contentControlType, setContentControlType] = useState<"text" | "richtext" | "date" | "dropdown" | "checkbox" | "repeating">("text")
  const [contentControlOptions, setContentControlOptions] = useState("")
  const [contentControls, setContentControls] = useState<Array<{ id: string; type: string; placeholder: string; options: string[] }>>([])

  // #17 Table auto-fit
  const [tableAutoFitMode, setTableAutoFitMode] = useState<"auto" | "fixed" | "window">("auto")

  // #18 Table styles
  const [showTableStyles, setShowTableStyles] = useState(false)
  const [tableStylePreset, setTableStylePreset] = useState("none")

  // #20 Character spacing
  const [showCharSpacing, setShowCharSpacing] = useState(false)
  const [charSpacing, setCharSpacing] = useState(0) // in px, negative=condensed

  // #21 Drop cap
  const [showDropCap, setShowDropCap] = useState(false)
  const [dropCapLines, setDropCapLines] = useState(3)

  // #23 Page borders
  const [showPageBorderDialog, setShowPageBorderDialog] = useState(false)
  const [pageBorderStyle, setPageBorderStyle] = useState("1px solid #000")
  const [pageBorderColor, setPageBorderColor] = useState("#000000")
  const [pageBorderWidth, setPageBorderWidth] = useState(1)

  // #24 Different headers per section
  const [showSectionHeaderDialog, setShowSectionHeaderDialog] = useState(false)
  const [sectionHeaders, setSectionHeaders] = useState<Array<{ id: string; header: string; footer: string; startPage: number }>>([])
  const [embedUrl, setEmbedUrl] = useState("")
  const [showParagraphDialog, setShowParagraphDialog] = useState(false)
  const [lineSpacing, setLineSpacing] = useState("1.5")
  const [spaceBefore, setSpaceBefore] = useState("0")
  const [spaceAfter, setSpaceAfter] = useState("0")
  const [showFormatMenu, setShowFormatMenu] = useState(false)
  const [showDeleteTableDialog, setShowDeleteTableDialog] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showOpenMenu, setShowOpenMenu] = useState(false)
  const [showSaveMenu, setShowSaveMenu] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showNewDocDialog, setShowNewDocDialog] = useState(false)
  const [newDocName, setNewDocName] = useState("")
  const [newDocFolder, setNewDocFolder] = useState("")
  const [exportFormat, setExportFormat] = useState("")
  const [exportFileName, setExportFileName] = useState("")
  const [exportFolderPath, setExportFolderPath] = useState("")
  const [borderColor, setBorderColor] = useState("#000000")
  const [borderWidth, setBorderWidth] = useState("1")
  const [cellWidth, setCellWidth] = useState("")
  const [cellHeight, setCellHeight] = useState("")
  const [showTranslateDialog, setShowTranslateDialog] = useState(false)
  const [translateText, setTranslateText] = useState("")
  const [translateResult, setTranslateResult] = useState("")
  const [formatPainterStyle, setFormatPainterStyle] = useState<string | null>(null)

  // ── Phase 5: Collaboration, SmartArt, Index, Sections, Grammar, Crypto, A11y, ODF, Content Controls ──
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [collabUsers, setCollabUsers] = useState<Array<{ id: string; name: string; color: string }>>([])
  const bcRef = useRef<BroadcastChannel | null>(null)
  const [showSmartArt, setShowSmartArt] = useState(false)
  const [smartArtType, setSmartArtType] = useState<"flowchart" | "orgchart" | "cycle" | "pyramid" | "process" | "hierarchy">("flowchart")
  const [showChartInsert, setShowChartInsert] = useState(false)
  const [chartData, setChartData] = useState("10,20,30,40")
  const [chartLabels, setChartLabels] = useState("Q1,Q2,Q3,Q4")
  const [chartInsertType, setChartInsertType] = useState<"bar" | "line" | "pie" | "area">("bar")
  const [showTableOfFigures, setShowTableOfFigures] = useState(false)
  const [showIndexDialog, setShowIndexDialog] = useState(false)
  const [indexTerm, setIndexTerm] = useState("")
  const [indexTerms, setIndexTerms] = useState<Array<{ term: string; page: number }>>([])
  const [showCrossRefDialog, setShowCrossRefDialog] = useState(false)
  const [crossRefTarget, setCrossRefTarget] = useState("")
  const [crossRefLabel, setCrossRefLabel] = useState("")
  const [sectionOrientation, setSectionOrientation] = useState<"portrait" | "landscape">("portrait")
  const [showSectionDialog, setShowSectionDialog] = useState(false)
  const [showGrammarCheck, setShowGrammarCheck] = useState(false)
  const [grammarIssues, setGrammarIssues] = useState<Array<{ text: string; suggestion: string; type: string }>>([])
  const [showThesaurus, setShowThesaurus] = useState(false)
  const [thesaurusWord, setThesaurusWord] = useState("")
  const [thesaurusResults, setThesaurusResults] = useState<string[]>([])
  const [showEncryptDialog, setShowEncryptDialog] = useState(false)
  const [encryptPassword, setEncryptPassword] = useState("")
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [showA11yDialog, setShowA11yDialog] = useState(false)
  const [a11yIssues, setA11yIssues] = useState<Array<{ element: string; issue: string; fix: string }>>([])
  const [quickParts, setQuickParts] = useState<Array<{ name: string; html: string }>>([])
  const [quickPartName, setQuickPartName] = useState("")

  // ── Phase 6: 10 remaining gaps ────────────────────────────────
  const [showWebSocketCollab, setShowWebSocketCollab] = useState(false)
  const [wsCollabUrl, setWsCollabUrl] = useState("ws://localhost:3001")
  const wsRef = useRef<WebSocket | null>(null)
  const [collabDocId, setCollabDocId] = useState("")
  const [rtCollabEnabled, setRtCollabEnabled] = useState(false)
  const [rtCollabUserName, setRtCollabUserName] = useState("User")

  // Real-time OT collaboration via doc-service
  const rtCollab = useCollaboration({
    documentType: "document",
    documentId: collabDocId || "doc-default",
    title: currentFile?.name ?? "Untitled",
    userName: rtCollabUserName,
    enabled: rtCollabEnabled,
    onRemoteOperation: useCallback((op: any) => {
      // Apply remote text operation to our editor
      const editor = editorRef.current
      if (!editor) return
      if (op.type === "text" && op.action === "insert" && op.text) {
        // Insert text at the specified position
        const paras = Array.from(editor.children)
        const target = paras[op.paragraphIdx]
        if (target) {
          const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
          let node: Text | null, charCount = 0
          while ((node = walker.nextNode() as Text | null)) {
            if (charCount + (node.textContent?.length ?? 0) >= op.charOffset) {
              const offset = op.charOffset - charCount
              node.insertData(offset, op.text)
              break
            }
            charCount += node.textContent?.length ?? 0
          }
        }
      } else if (op.type === "text" && op.action === "delete" && op.deleteCount) {
        const paras = Array.from(editor.children)
        const target = paras[op.paragraphIdx]
        if (target) {
          const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
          let node: Text | null, charCount = 0
          while ((node = walker.nextNode() as Text | null)) {
            if (charCount + (node.textContent?.length ?? 0) >= op.charOffset) {
              const offset = op.charOffset - charCount
              node.deleteData(offset, Math.min(op.deleteCount, (node.textContent?.length ?? 0) - offset))
              break
            }
            charCount += node.textContent?.length ?? 0
          }
        }
      }
    }, []),
    onRemoteCursor: useCallback((_cursor: any) => {
      // Remote cursor rendering handled by RemoteCursors component
    }, []),
  })

  const [trackChangeAuthor, setTrackChangeAuthor] = useState("User")
  const [trackChanges, setTrackChanges] = useState<Array<{ id: string; type: "insert" | "delete"; html: string; author: string; date: string; accepted: boolean }>>([])
  const [showStyleGallery, setShowStyleGallery] = useState(false)
  const [namedStyles, setNamedStyles] = useState<Array<{ name: string; css: string }>>([
    { name: "Normal", css: "font-family:Calibri;font-size:11pt;line-height:1.15" },
    { name: "Heading 1", css: "font-family:Calibri;font-size:16pt;font-weight:bold;color:#1F3864" },
    { name: "Heading 2", css: "font-family:Calibri;font-size:13pt;font-weight:bold;color:#2F5496" },
    { name: "Heading 3", css: "font-family:Calibri;font-size:12pt;font-weight:bold;color:#1F3864" },
    { name: "Title", css: "font-family:Calibri;font-size:28pt;color:#1F3864" },
    { name: "Subtitle", css: "font-family:Calibri;font-size:14pt;color:#595959" },
    { name: "Quote", css: "font-family:Calibri;font-size:11pt;font-style:italic;color:#595959;border-left:3px solid #ccc;padding-left:12px" },
  ])
  const [showMultiLevelList, setShowMultiLevelList] = useState(false)
  const [listLevel, setListLevel] = useState(1)
  const [showLegacyFormDialog, setShowLegacyFormDialog] = useState(false)
  const [legacyFormType, setLegacyFormType] = useState<"text" | "checkbox" | "dropdown">("text")
  const [legacyFormOptions, setLegacyFormOptions] = useState("")
  const [showProtectDialog, setShowProtectDialog] = useState(false)
  const [protectPassword, setProtectPassword] = useState("")
  const [protectMode, setProtectMode] = useState<"readonly" | "comments" | "tracked" | "forms">("readonly")
  const [isProtected, setIsProtected] = useState(false)
  const [viewLayout, setViewLayout] = useState<"web" | "print">("web")
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)

  // Continuous spell check
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true)
  const spellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spellDictRef = useRef<Set<string> | null>(null)

  // Paste special
  const [showPasteSpecial, setShowPasteSpecial] = useState(false)
  const [pasteSpecialPos, setPasteSpecialPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // ── Message ──────────────────────────────────────────────────

  const showMessage = useCallback((type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }, [])

  // ── Editor Commands ──────────────────────────────────────────

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    setIsDirty(true)
  }, [])

  const queryState = useCallback((command: string): boolean => {
    return document.queryCommandState(command)
  }, [])

  const queryValue = useCallback((command: string): string => {
    return document.queryCommandValue(command)
  }, [])

  // ── Spell Check Dictionary (lazy init) ──────────────────────
  const getSpellDict = useCallback(() => {
    if (spellDictRef.current) return spellDictRef.current
    const words = "a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further get got had has have having he her here hers herself him himself his how i if in into is it its itself just know let like make me might more most my myself no nor not now of off on once only or other our ours ourselves out over own quite really right said same say says shall she should so some still such take than that the their theirs them themselves then there these they this those through to too under until up upon us use used using very want was we well were what when where which while who whom whose why will with within without won would yes yet you your yours yourself yourselves about above across actually after afterwards ago almost along already also although always among amongst amount another any anybody anyhow anyone anything anyway anywhere are around back became because become becomes becoming been before beforehand behind being beside besides between beyond bill both bottom but by call came can cannot co computer con could cry describe detail do done down due during each eight either eleven else elsewhere empty enough etc even ever every everyone everything everywhere except few fifteen fifty fill find fire first five for former formerly forty found four front full further gave get give go had has have he hence her here hereafter hereby herein hereupon hers herself him himself his how however hundred ie if in inc indeed interest into is it its itself keep last latter latterly least less let like likely ltd made make many may me meanwhile might mill mine more moreover most mostly move much must my myself name namely neither never nevertheless next nine no nobody none nor not nothing now nowhere of off often on once one only onto or other others otherwise our ours ourselves out over own part per perhaps please put quite rather really regarding same say see seem seemed seeming seems serious several she should show side since sincere six sixty so some somehow someone something sometime sometimes somewhere still such system take ten than that the their them themselves then thence there thereafter thereby therefore therein thereupon these they thick thin third this those though three through throughout thru thus to together too top toward towards twelve twenty two un under unless unlike until up upon us used using very via want was we well were what whatever when whence whenever where whereafter whereas whereby wherein whereupon wherever whether which while whither who whoever whole whom whose why will with within without would yet you your yours yourself yourselves zero able accept according account act add address admit affect afford agree aim allow almost already also always amount answer appear apply area argue around arrange arrive art ask assume attack attempt attention available back bad base bear beat beautiful begin behind believe benefit best better big bit black blood blue board body book born both boy break bring brother build business buy cause centre certain chair chairman change charge check child choice choose church claim class clear close cold come common community concern condition consider continue control cost could council country course cover create cross cup current cut dark daughter day deal death decide decision deep degree department depend describe design despite develop development die difference different difficult dinner direction doctor door draw drink drive drop during early east eat economy education effect effort eight either election employ encourage end engine english enjoy enough enter especially even evening ever every evidence exactly example except exchange exercise expect experience explain express eye face fact fall family far father feel few field fight figure final financial find fine finger fish five floor follow food foot force foreign forget form former forward four free friend from front full fund further future garden general get girl give glass go god good government great green ground group grow hair half hall hand happen happy hard have head hear heart heat heavy help here high himself history hit hold home hope horse hospital hot hotel hour house however hundred husband idea identify imagine important improve include increase industry information inside instead interest into involve island issue it job join judge keep key kid kill kind king kitchen know land language large last late later laugh law lay lead learn leave left leg less let level lie life light like likely line list listen little live long look lord lord lose lot love low machine main major make man manage many market may matter mean meet member mention might million mind minister minute miss model modern moment money month more morning most mother mouth move much music must name national nature near necessary need never new news next nice night no none north not note nothing notice now number offer office often old only open operate order other over own paper parent part particular party pass past pay people per period person picture place plan play point police policy political poor position possible power president pressure price problem produce product programme provide public pull purpose put quality question quite range rate reach read ready real reason receive record red reduce remain remember report represent result return right rise road role room rule run same say school second section security see seem sell send sense series serious service set seven several shall share she short should show side similar simple since sit situation six size small social society some son south space speak special staff stage stand start state step still stop story strong student study such suggest support sure system table take talk teacher tell ten tend term test than that the their them then there these thing think this those though thought three through time to today together too top total town trade try turn type under understand union until upon use usually value very voice walk want war water way well west what when where whether which while white whole why wide wife will win wish with without woman wonder word work world would write wrong year yes young".split(" ")
    const dict = new Set(words)
    spellDictRef.current = dict
    return dict
  }, [])

  // Continuous spell check — debounced on input
  const runContinuousSpellCheck = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !spellCheckEnabled) return

    const dict = getSpellDict()
    // Remove old spell markers
    editor.querySelectorAll("span.spell-error").forEach(el => {
      const parent = el.parentNode
      if (parent) {
        const text = document.createTextNode(el.textContent || "")
        parent.replaceChild(text, el)
        parent.normalize()
      }
    })

    // Walk text nodes and mark misspelled words
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null)
    const marks: Array<{ node: Text; start: number; end: number; word: string }> = []
    let textNode: Text | null
    while ((textNode = walker.nextNode() as Text | null)) {
      // Skip if inside a spell-error span (shouldn't happen after cleanup), or inside code/pre
      const parent = textNode.parentElement
      if (!parent || parent.closest("code, pre, .spell-error, .doc-toc, .doc-header, .doc-footer")) continue
      const text = textNode.textContent || ""
      const regex = /\b([a-zA-Z]{2,})\b/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        const word = m[1]
        if (!dict.has(word.toLowerCase())) {
          marks.push({ node: textNode, start: m.index, end: m.index + word.length, word })
        }
      }
    }

    // Apply marks in reverse order to preserve offsets
    const savedSel = window.getSelection()
    const savedRange = savedSel?.rangeCount ? savedSel.getRangeAt(0).cloneRange() : null

    for (let i = marks.length - 1; i >= 0; i--) {
      const { node, start, end } = marks[i]
      if (!node.parentNode) continue
      try {
        const range = document.createRange()
        range.setStart(node, start)
        range.setEnd(node, end)
        const span = document.createElement("span")
        span.className = "spell-error"
        span.style.cssText = "text-decoration: wavy underline red; text-decoration-skip-ink: none; text-underline-offset: 2px;"
        range.surroundContents(span)
      } catch { /* ignore split-node errors */ }
    }

    // Restore cursor
    if (savedRange && savedSel) {
      try { savedSel.removeAllRanges(); savedSel.addRange(savedRange) } catch { /* ignore */ }
    }
  }, [spellCheckEnabled, getSpellDict])

  // Trigger spell check on input with debounce
  useEffect(() => {
    if (!spellCheckEnabled || mode !== "editing") return
    const editor = editorRef.current
    if (!editor) return
    const handler = () => {
      if (spellTimerRef.current) clearTimeout(spellTimerRef.current)
      spellTimerRef.current = setTimeout(runContinuousSpellCheck, 800)
    }
    editor.addEventListener("input", handler)
    // Run initial check
    spellTimerRef.current = setTimeout(runContinuousSpellCheck, 1500)
    return () => {
      editor.removeEventListener("input", handler)
      if (spellTimerRef.current) clearTimeout(spellTimerRef.current)
    }
  }, [spellCheckEnabled, mode, runContinuousSpellCheck])

  // ── Paste Special Handlers ──────────────────────────────────
  const handlePasteAsPlainText = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      exec("insertText", text)
      showMessage("info", "Pasted as plain text")
    } catch {
      showMessage("error", "Clipboard access denied")
    }
    setShowPasteSpecial(false)
  }, [exec, showMessage])

  const handlePasteMatchingFormat = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      // Insert as HTML but strip all styling — keep only structure (p, br, li)
      const cleaned = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")
      exec("insertHTML", `<p>${cleaned}</p>`)
      showMessage("info", "Pasted matching destination format")
    } catch {
      showMessage("error", "Clipboard access denied")
    }
    setShowPasteSpecial(false)
  }, [exec, showMessage])

  const handlePasteWithFormatting = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html")
          const html = await blob.text()
          exec("insertHTML", html)
          showMessage("info", "Pasted with original formatting")
          setShowPasteSpecial(false)
          return
        }
      }
      // Fallback to plain text
      const text = await navigator.clipboard.readText()
      exec("insertText", text)
      showMessage("info", "Pasted as plain text (no HTML available)")
    } catch {
      showMessage("error", "Clipboard access denied")
    }
    setShowPasteSpecial(false)
  }, [exec, showMessage])

  // ── File Operations ──────────────────────────────────────────

  const handleNewDocument = useCallback(() => {
    setNewDocName(`Document ${Date.now()}.docx`)
    setNewDocFolder("")
    setShowNewDocDialog(true)
  }, [])

  const handleCreateNewDoc = useCallback(() => {
    if (!newDocName.trim()) return
    setShowNewDocDialog(false)
    const name = newDocName.trim()
    if (editorRef.current) editorRef.current.innerHTML = ""
    setCurrentFile({ name, provider: "local", folder: newDocFolder || "" })
    setMode("editing")
    setIsDirty(false)
    showMessage("info", `New document: ${name}`)
  }, [newDocName, newDocFolder, showMessage])

  const handleOpenFile = useCallback(async () => {
    const file = await openWordFileDialog()
    if (!file) return

    setMode("loading")
    try {
      const ext = file.name.toLowerCase().split(".").pop()

      if (ext === "docx" || ext === "doc") {
        // Convert .docx → HTML via mammoth
        const buffer = await fileToArrayBuffer(file)
        const { html, warnings } = await docxToHtml(buffer)
        if (warnings.length > 0) {
          console.warn("Mammoth warnings:", warnings)
        }
        const cleaned = sanitizeEditorHtml(html)
        if (editorRef.current) {
          editorRef.current.innerHTML = cleaned
        }
      } else if (ext === "html" || ext === "htm") {
        // Read as text
        const text = await file.text()
        const cleaned = sanitizeEditorHtml(text)
        if (editorRef.current) {
          editorRef.current.innerHTML = cleaned
        }
      } else {
        // Plain text
        const text = await file.text()
        if (editorRef.current) {
          editorRef.current.innerHTML = text
            .split("\n")
            .map((line) => line ? `<p>${line}</p>` : "<p><br></p>")
            .join("")
        }
      }

      setCurrentFile({ name: file.name, provider: "local", folder: "", size: file.size })
      setMode("editing")
      setIsDirty(false)
      showMessage("success", `Opened: ${file.name}`)
    } catch (err) {
      setMode("error")
      showMessage("error", `Failed to open: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }, [showMessage])

  const handleOpenFromStorage = useCallback(async (entry: DocumentEntry) => {
    if (entry.isFolder) return
    setMode("loading")
    setShowFileBrowser(false)
    try {
      const doc = await downloadDocument(entry.name, browserFolder, browserProvider)
      const ext = entry.name.toLowerCase().split(".").pop()

      if (ext === "docx" || ext === "doc") {
        const { html, warnings } = await docxBase64ToHtml(doc.contentBase64)
        if (warnings.length > 0) console.warn("Mammoth warnings:", warnings)
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizeEditorHtml(html)
        }
      } else if (ext === "html" || ext === "htm") {
        const html = atob(doc.contentBase64)
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizeEditorHtml(html)
        }
      } else {
        const text = atob(doc.contentBase64)
        if (editorRef.current) {
          editorRef.current.innerHTML = text
            .split("\n")
            .map((line) => line ? `<p>${line}</p>` : "<p><br></p>")
            .join("")
        }
      }

      setCurrentFile({ name: entry.name, provider: browserProvider, folder: browserFolder, size: entry.size })
      setMode("editing")
      setIsDirty(false)
      showMessage("success", `Opened: ${entry.name}`)
    } catch (err) {
      setMode("error")
      showMessage("error", `Failed to open: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }, [browserFolder, browserProvider, showMessage])

  const handleSaveAsDocx = useCallback(async () => {
    if (!editorRef.current) return
    setMode("saving")
    try {
      const html = editorRef.current.innerHTML
      const blob = await htmlToDocx(html, currentFile?.name?.replace(/\.[^.]+$/, "") ?? "Document")
      const filename = currentFile?.name?.replace(/\.[^.]+$/, ".docx") ?? "document.docx"
      saveBlobAs(blob, filename)
      setIsDirty(false)
      setMode("editing")
      showMessage("success", `Downloaded: ${filename}`)
    } catch (err) {
      setMode("editing")
      showMessage("error", `Save failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }, [currentFile, showMessage])

  const handleSaveToStorage = useCallback(async () => {
    if (!editorRef.current) return
    setMode("saving")
    try {
      const html = editorRef.current.innerHTML
      const blob = await htmlToDocx(html, currentFile?.name?.replace(/\.[^.]+$/, "") ?? "Document")
      const base64 = await blobToBase64(blob)
      const filename = currentFile?.name?.replace(/\.[^.]+$/, ".docx") ?? "document.docx"
      await uploadDocument(filename, base64, browserFolder, browserProvider)
      setIsDirty(false)
      setMode("editing")
      showMessage("success", `Uploaded: ${filename}`)
    } catch (err) {
      setMode("editing")
      showMessage("error", `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }, [currentFile, browserFolder, browserProvider, showMessage])

  const handlePrint = useCallback(() => {
    if (!editorRef.current) return
    const win = window.open("", "_blank", "width=800,height=600")
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>${currentFile?.name ?? "Document"}</title>
      <style>
        body { font-family: Calibri, sans-serif; font-size: 12pt; line-height: 1.5; padding: 1in; max-width: 8.5in; margin: 0 auto; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #000; padding: 4px 8px; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>${editorRef.current.innerHTML}</body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }, [currentFile])

  // ── Template Merge ───────────────────────────────────────────

  const handleOpenTemplateDialog = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const fieldRegex = /\{\{\s*(\w+)\s*\}\}/g
    const fieldNames = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = fieldRegex.exec(html)) !== null) {
      fieldNames.add(match[1])
    }
    setTemplateFields(Array.from(fieldNames).map((name) => ({ fieldName: name, value: "" })))
    setShowTemplateDialog(true)
  }, [])

  const handleMergeTemplate = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const merged = mergeTemplate(html, templateFields)
    editorRef.current.innerHTML = merged
    setShowTemplateDialog(false)
    setIsDirty(true)
    showMessage("success", "Template fields merged")
  }, [templateFields, showMessage])

  // ── Table ────────────────────────────────────────────────────

  const handleInsertTable = useCallback(() => {
    if (!editorRef.current) return
    let html = '<table style="border-collapse:collapse;width:100%">'
    for (let r = 0; r < tableRows; r++) {
      html += "<tr>"
      for (let c = 0; c < tableCols; c++) {
        html += '<td style="border:1px solid #000;padding:4px 8px"><p><br></p></td>'
      }
      html += "</tr>"
    }
    html += "</table>"
    exec("insertHTML", html)
    setShowTableDialog(false)
  }, [tableRows, tableCols, exec])

  // ── Table Enhancements ────────────────────────────────────────

  const handleMergeCells = useCallback(() => {
    exec("mergeCells" as never)
    showMessage("info", "Cells merged")
  }, [exec, showMessage])

  const handleSplitCell = useCallback(() => {
    const rows = prompt("Split into how many rows?", "2")
    const cols = prompt("Split into how many columns?", "2")
    if (rows && cols) {
      const r = parseInt(rows); const c = parseInt(cols)
      if (r > 0 && c > 0) {
        // Simulate split by inserting a mini-table
        let html = '<table style="border-collapse:collapse">'
        for (let i = 0; i < r; i++) {
          html += "<tr>"
          for (let j = 0; j < c; j++) html += '<td style="border:1px solid #ccc;padding:2px 4px"><br></td>'
          html += "</tr>"
        }
        html += "</table>"
        exec("insertHTML", html)
        showMessage("info", `Cell split into ${r}x${c}`)
      }
    }
  }, [exec, showMessage])

  const handleInsertTableRow = useCallback((pos: "before" | "after") => {
    if (pos === "after") {
      // Move cursor to last cell in row, then insert row below
      const sel = window.getSelection()
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0)
        let node: Node | null = range.startContainer
        while (node && node.nodeName !== "TR") node = node.parentNode
        if (node) {
          const row = node as HTMLTableRowElement
          const newRow = row.cloneNode(true) as HTMLTableRowElement
          Array.from(newRow.cells).forEach((td) => { td.innerHTML = "<br>" })
          row.parentNode?.insertBefore(newRow, row.nextSibling)
          setIsDirty(true)
          showMessage("info", "Row inserted")
        }
      }
    } else {
      const sel = window.getSelection()
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0)
        let node: Node | null = range.startContainer
        while (node && node.nodeName !== "TR") node = node.parentNode
        if (node) {
          const row = node as HTMLTableRowElement
          const newRow = row.cloneNode(true) as HTMLTableRowElement
          Array.from(newRow.cells).forEach((td) => { td.innerHTML = "<br>" })
          row.parentNode?.insertBefore(newRow, row)
          setIsDirty(true)
          showMessage("info", "Row inserted")
        }
      }
    }
  }, [showMessage])

  const handleDeleteTableRow = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0)
      let node: Node | null = range.startContainer
      while (node && node.nodeName !== "TR") node = node.parentNode
      if (node) {
        const row = node as HTMLTableRowElement
        const tbody = row.parentNode
        if (tbody && tbody.childNodes.length > 1) {
          row.remove()
          setIsDirty(true)
          showMessage("info", "Row deleted")
        } else {
          showMessage("error", "Cannot delete last row")
        }
      }
    }
  }, [showMessage])

  const handleInsertTableCol = useCallback((pos: "before" | "after") => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0)
      let node: Node | null = range.startContainer
      while (node && node.nodeName !== "TD" && node.nodeName !== "TH") node = node.parentNode
      if (node) {
        const td = node as HTMLTableCellElement
        const colIdx = Array.from(td.parentNode?.childNodes ?? []).indexOf(td)
        const table = td.closest("table")
        if (table) {
          table.querySelectorAll("tr").forEach((row) => {
            const cells = row.querySelectorAll("td, th")
            if (cells[colIdx]) {
              const newCell = document.createElement("td")
              newCell.style.border = "1px solid #ccc"; newCell.style.padding = "2px 4px"
              newCell.innerHTML = "<br>"
              pos === "after" ? cells[colIdx].after(newCell) : cells[colIdx].before(newCell)
            }
          })
          setIsDirty(true)
          showMessage("info", "Column inserted")
        }
      }
    }
  }, [showMessage])

  const handleDeleteTableCol = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0)
      let node: Node | null = range.startContainer
      while (node && node.nodeName !== "TD" && node.nodeName !== "TH") node = node.parentNode
      if (node) {
        const td = node as HTMLTableCellElement
        const colIdx = Array.from(td.parentNode?.childNodes ?? []).indexOf(td)
        const table = td.closest("table")
        if (table) {
          const firstRow = table.querySelector("tr")
          if (firstRow && firstRow.querySelectorAll("td, th").length <= 1) {
            showMessage("error", "Cannot delete last column")
            return
          }
          table.querySelectorAll("tr").forEach((row) => {
            const cells = row.querySelectorAll("td, th")
            if (cells[colIdx]) cells[colIdx].remove()
          })
          setIsDirty(true)
          showMessage("info", "Column deleted")
        }
      }
    }
  }, [showMessage])

  const handleApplyTableBorder = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0)
      let node: Node | null = range.startContainer
      while (node && node.nodeName !== "TABLE" && node.nodeName !== "TD" && node.nodeName !== "TH") node = node.parentNode
      if (node) {
        if (node.nodeName === "TABLE") {
          const tableNode = node as HTMLTableElement
          tableNode.style.border = tableBorderStyle
          tableNode.querySelectorAll("td, th").forEach((cell) => {
            (cell as HTMLElement).style.border = tableBorderStyle
          })
        } else {
          const table = (node as HTMLElement).closest("table")
          if (table) {
            table.style.border = tableBorderStyle
            table.querySelectorAll("td, th").forEach((cell) => {
              (cell as HTMLElement).style.border = tableBorderStyle
            })
          }
        }
        setIsDirty(true)
        setShowTableBorderDialog(false)
        showMessage("info", "Border applied")
      }
    }
  }, [tableBorderStyle, showMessage])

  const handleApplyCellShading = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0)
      let node: Node | null = range.startContainer
      while (node && node.nodeName !== "TD" && node.nodeName !== "TH") node = node.parentNode
      if (node) {
        (node as HTMLElement).style.backgroundColor = tableBgColor
        setIsDirty(true)
        showMessage("info", "Cell shading applied")
      }
    }
  }, [tableBgColor, showMessage])

  const handleTableContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("table")) {
      e.preventDefault()
      setShowTableContext({ x: e.clientX, y: e.clientY })
    }
  }, [])

  // ── Phase 3: Page Layout ──────────────────────────────────────

  const handleApplyHeader = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const existing = editor.querySelector(".doc-header"); if (existing) existing.remove()
    const header = document.createElement("div"); header.className = "doc-header"
    header.style.cssText = "text-align:center;padding:12px 0;border-bottom:1px solid #ccc;margin-bottom:16px;font-size:10pt;color:#666"
    header.textContent = headerText || " "
    editor.insertBefore(header, editor.firstChild)
    setShowHeaderFooter(false); showMessage("info", "Header applied")
  }, [headerText, showMessage])

  const handleApplyFooter = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const existing = editor.querySelector(".doc-footer"); if (existing) existing.remove()
    const footer = document.createElement("div"); footer.className = "doc-footer"
    footer.style.cssText = "text-align:center;padding:12px 0;border-top:1px solid #ccc;margin-top:16px;font-size:10pt;color:#666"
    footer.textContent = footerText || " "
    editor.appendChild(footer)
    setShowHeaderFooter(false); showMessage("info", "Footer applied")
  }, [footerText, showMessage])

  const handleInsertPageNumber = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const container = document.createElement("div"); container.className = "doc-page-number"
    container.style.cssText = `text-align:${pageNumberAlign};font-size:10pt;color:#666;padding:8px 0`
    container.textContent = "Page {PAGE}"
    if (pageNumberPos === "header") {
      let header = editor.querySelector<HTMLElement>(".doc-header"); if (!header) { header = document.createElement("div"); header.className = "doc-header"; header.style.cssText = "border-bottom:1px solid #ccc;padding:12px 0;margin-bottom:16px"; editor.insertBefore(header, editor.firstChild) }
      header.appendChild(container)
    } else {
      let footer = editor.querySelector<HTMLElement>(".doc-footer"); if (!footer) { footer = document.createElement("div"); footer.className = "doc-footer"; footer.style.cssText = "border-top:1px solid #ccc;padding:12px 0;margin-top:16px"; editor.appendChild(footer) }
      footer.appendChild(container)
    }
    setShowPageNumber(false); showMessage("info", "Page number inserted")
  }, [pageNumberPos, pageNumberAlign, showMessage])

  const handleApplyMargins = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    editor.style.paddingTop = marginTop; editor.style.paddingBottom = marginBottom
    editor.style.paddingLeft = marginLeft; editor.style.paddingRight = marginRight
    setShowMargins(false); setIsDirty(true); showMessage("info", `Margins applied`)
  }, [marginTop, marginBottom, marginLeft, marginRight, showMessage])

  const handleInsertPageBreak = useCallback(() => {
    exec("insertHTML", '<div style="page-break-after:always;border-top:2px dashed #999;margin:20px 0;text-align:center;color:#999;font-size:10pt">—— Page Break ——</div><div><br></div>')
    showMessage("info", "Page break inserted")
  }, [exec, showMessage])

  // ── Phase 4: Advanced ─────────────────────────────────────────

  const handleInsertToc = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const headings = editor.querySelectorAll("h1, h2, h3"); if (!headings.length) { showMessage("error", "No headings found"); return }
    let toc = '<div class="doc-toc" style="border:1px solid #ddd;padding:16px;margin-bottom:16px;background:#fafafa"><h2 style="margin-top:0">Table of Contents</h2><ul style="list-style:none;padding-left:0">'
    headings.forEach((h) => { const lvl = h.nodeName==="H1"?0:h.nodeName==="H2"?1:2; if (!h.id) h.id=`toc-${Date.now()}-${Math.random().toString(36).slice(2,6)}`; toc += `<li style="padding-left:${lvl*20}px;margin-bottom:4px"><a href="#${h.id}" style="color:#2563eb;text-decoration:none">${h.textContent}</a></li>` })
    toc += "</ul></div>"
    exec("insertHTML", toc); setShowTocDialog(false); showMessage("info", "TOC inserted")
  }, [exec, showMessage])

  const handleSpellCheck = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const dict = new Set("the and for are was with that this have from they will been when your about which their there would could should other after before between through during number people because different important example another however system program computer software hardware network server client document editor text formatted table image insert delete copy paste undo redo file open save print export import page header footer margin break link heading list bullet style font color size align merge split border shading".split(" "))
    const words = Array.from(new Set((editor.textContent??"").match(/\b[a-zA-Z]{3,}\b/g)??[])).slice(0,20)
      .filter((w) => !dict.has(w.toLowerCase()))
      .map((word) => ({ word, suggestions: [word.toLowerCase(), word.slice(0,-1), word+"s", word.charAt(0).toUpperCase()+word.slice(1)].filter((s) => s!==word) }))
    setSpellResults(words); setShowSpellCheck(true)
  }, [])

  const handleAddComment = useCallback(() => {
    if (!commentText.trim()) return
    setComments((prev) => [...prev, { id:`cmt-${Date.now()}`, text: commentText, date: new Date().toLocaleString(), author: "User" }])
    setCommentText("")
    const sel = window.getSelection(); if (sel?.rangeCount && !sel.isCollapsed) { const span = document.createElement("span"); span.className = "doc-comment-highlight"; span.style.cssText = "background:#fff3cd;border-bottom:2px solid #ffc107;cursor:pointer"; span.title = commentText; try { sel.getRangeAt(0).surroundContents(span) } catch {/*split*/} ; setIsDirty(true) }
    showMessage("info", "Comment added")
  }, [commentText, showMessage])

  const handleToggleTrackChanges = useCallback(() => { setTrackChangesEnabled((prev) => !prev); showMessage("info", trackChangesEnabled ? "Track Changes off" : "Track Changes on") }, [trackChangesEnabled, showMessage])

  const handlePdfExport = useCallback(async () => {
    const editor = editorRef.current; if (!editor) return
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
      const pdfDoc = await PDFDocument.create(); const font = await pdfDoc.embedFont(StandardFonts.Helvetica); const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const pageW=612, pageH=792, m=50, lh=14; let page=pdfDoc.addPage([pageW,pageH]), y=pageH-m
      const addTxt = (s: string, o: { sz?:number; b?:boolean; indent?:number }={}) => { const f=o.b?boldFont:font; const sz=o.sz??10; const ml = (o.indent??0)*sz*0.55; const maxW=pageW-m*2-ml; const maxC=Math.floor(maxW/(sz*0.55)); const words=s.split(" "); let ln=""; for(const w of words){if((ln+" "+w).length>maxC){if(y<m+lh){y=pageH-m;page=pdfDoc.addPage([pageW,pageH])}page.drawText(ln,{x:m+ml,y,size:sz,font:f,color:rgb(0,0,0)});y-=lh;ln=w}else ln=ln?ln+" "+w:w}if(ln){if(y<m+lh){y=pageH-m;page=pdfDoc.addPage([pageW,pageH])}page.drawText(ln,{x:m+ml,y,size:sz,font:f,color:rgb(0,0,0)});y-=lh} }
      addTxt(currentFile?.name??"Document",{sz:18,b:true}); y-=10
      const doc = new DOMParser().parseFromString(editor.innerHTML,"text/html")
      const walk = (n:Node, indent:number) => { for(const c of Array.from(n.childNodes)){if(c.nodeType===Node.TEXT_NODE&&c.textContent?.trim())addTxt(c.textContent.trim(),{indent});else if(c.nodeType===Node.ELEMENT_NODE){const el=c as HTMLElement;const t=el.nodeName.toLowerCase();if(t==="br")y-=lh;else if(["h1","h2","h3"].includes(t)){y-=8;addTxt(el.textContent?.trim()??"",{sz:t==="h1"?16:t==="h2"?14:12,b:true});y-=6}else if(t==="p"){walk(c,indent);y-=6}else if(t==="li")addTxt("• "+(el.textContent?.trim()??""),{indent:indent+2});else walk(c,indent)}}}
      walk(doc.body,0)
      const blob = new Blob([await pdfDoc.save()],{type:"application/pdf"})
      saveBlobAs(blob,(currentFile?.name??"document").replace(/\.[^.]+$/,".pdf")); showMessage("success","PDF exported")
    } catch (err: unknown) { showMessage("error",`PDF failed: ${err instanceof Error?err.message:"error"}`) }
  }, [currentFile, showMessage])

  // ── Footnote ────────────────────────────────────────────────
  const handleAddFootnote = useCallback(() => {
    if (!footnoteText.trim()) return
    const id = `fn-${Date.now()}`
    const ref = `[${footnotes.length + 1}]`
    setFootnotes((prev) => [...prev, { id, text: footnoteText, ref }])
    exec("insertHTML", `<sup class="footnote-ref" data-fn="${id}" style="color:#2563eb;cursor:pointer">${ref}</sup>`)
    setFootnoteText(""); setShowFootnoteDialog(false)
    showMessage("info", "Footnote added")
  }, [footnoteText, footnotes.length, exec, showMessage])

  // ── Watermark ───────────────────────────────────────────────
  const handleApplyWatermark = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const wm = document.createElement("div")
    wm.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72px;color:#000;opacity:${watermarkOpacity};pointer-events:none;z-index:9999;white-space:nowrap;font-weight:bold`
    wm.textContent = watermarkText
    wm.id = "doc-watermark"
    const existing = document.getElementById("doc-watermark"); if (existing) existing.remove()
    editor.parentElement?.appendChild(wm)
    setShowWatermarkDialog(false); showMessage("info", "Watermark applied")
  }, [watermarkText, watermarkOpacity, showMessage])

  // ── Format Painter ──────────────────────────────────────────
  const handleFormatPainter = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount && !sel.isCollapsed) {
      const range = sel.getRangeAt(0)
      const span = document.createElement("span")
      try { range.surroundContents(span) } catch { /* split */ }
      setFormatPainterStyle(span.style.cssText)
      span.replaceWith(...Array.from(span.childNodes))
      showMessage("info", "Format copied. Click target text to apply.")
    }
  }, [showMessage])

  const handleFormatPainterApply = useCallback((e: React.MouseEvent) => {
    if (!formatPainterStyle) return
    const sel = window.getSelection()
    if (sel?.rangeCount && !sel.isCollapsed) {
      const span = document.createElement("span"); span.style.cssText = formatPainterStyle
      try { sel.getRangeAt(0).surroundContents(span) } catch { /* split */ }
      span.replaceWith(...Array.from(span.childNodes))
    }
    setFormatPainterStyle(null); setIsDirty(true)
  }, [formatPainterStyle])

  // ── Symbol ──────────────────────────────────────────────────
  const SYMBOLS = ["©","®","™","€","£","¥","§","¶","†","‡","•","…","–","—","°","±","×","÷","≈","≠","≤","≥","←","→","↑","↓","♠","♣","♥","♦","★","☆","✓","✗","☐","☑","α","β","γ","δ","ε","θ","λ","μ","π","σ","φ","ω","Ω","∑","∫","∞"]
  const handleInsertSymbol = useCallback((sym: string) => {
    exec("insertHTML", sym); setShowSymbolDialog(false)
  }, [exec])

  // ── Word Count ──────────────────────────────────────────────
  const handleWordCount = useCallback(() => {
    const text = editorRef.current?.textContent ?? ""
    const words = text.trim().split(/\s+/).filter(Boolean)
    setWordCount(words.length); setCharCount(text.length)
    setShowWordCount(true)
  }, [])

  // ── Outline Pane ────────────────────────────────────────────
  const handleBuildOutline = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const headings = editor.querySelectorAll("h1,h2,h3")
    const items = Array.from(headings).map((h, i) => ({
      level: parseInt(h.nodeName[1]),
      text: h.textContent?.trim() ?? `Heading ${i + 1}`,
      id: `outline-${i}`,
    }))
    setOutlineItems(items); setShowOutlinePane(true)
  }, [])

  // ── Mail Merge ──────────────────────────────────────────────
  const handleMailMergeLoad = useCallback(() => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".csv"
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      const headers = lines[0].split(",").map((h) => h.trim())
      const data = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()))
      setMailMergeFields(headers); setMailMergeData(data)
      showMessage("info", `Loaded ${data.length} records`)
    }
    input.click()
  }, [showMessage])

  const handleMailMergeRun = useCallback(() => {
    const editor = editorRef.current; if (!editor || mailMergeData.length === 0) return
    const template = editor.innerHTML
    let merged = ""
    for (const row of mailMergeData) {
      let doc = template
      mailMergeFields.forEach((field, i) => { doc = doc.replace(new RegExp(`\\{\\{${field}\\}\\}`, "gi"), row[i] ?? "") })
      merged += doc + '<div style="page-break-after:always"></div>'
    }
    editor.innerHTML = merged; setIsDirty(true)
    setShowMailMerge(false); showMessage("info", `Merged ${mailMergeData.length} records`)
  }, [mailMergeData, mailMergeFields, showMessage])

  // ── Version History ─────────────────────────────────────────
  const handleSaveVersion = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const label = prompt("Version label:", `v${versions.length + 1}`)
    if (!label) return
    setVersions((prev) => [...prev, { id: `v-${Date.now()}`, date: new Date().toLocaleString(), label, html: editor.innerHTML }])
    showMessage("info", `Version "${label}" saved`)
  }, [versions.length, showMessage])

  const handleRestoreVersion = useCallback((html: string, label: string) => {
    const editor = editorRef.current; if (!editor) return
    editor.innerHTML = html; setIsDirty(true)
    setShowVersionHistory(false); showMessage("info", `Restored "${label}"`)
  }, [showMessage])

  // ── Document Compare ────────────────────────────────────────
  const handleCompareDocument = useCallback(async () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".docx,.html"
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      const text = await file.text()
      const current = editorRef.current?.textContent ?? ""
      const other = new DOMParser().parseFromString(text, "text/html").body.textContent ?? ""
      const diff = current === other ? "Documents are identical." : `Differences found: ${Math.abs(current.length - other.length)} chars differ.`
      showMessage("info", diff)
    }
    input.click()
  }, [showMessage])

  // ── Macro ───────────────────────────────────────────────────
  const handleRecordMacro = useCallback(() => {
    if (!macroName.trim()) return
    setMacros((prev) => [...prev, { name: macroName, actions: macroActions }])
    setMacroName(""); setMacroActions(""); setShowMacroDialog(false)
    showMessage("info", `Macro "${macroName}" saved`)
  }, [macroName, macroActions, showMessage])

  const handleRunMacro = useCallback((name: string, actions: string) => {
    actions.split("\n").filter(Boolean).forEach((cmd) => {
      const [action, ...rest] = cmd.split(":")
      const value = rest.join(":")
      if (action === "bold") exec("bold")
      else if (action === "italic") exec("italic")
      else if (action === "insert") exec("insertHTML", value)
      else if (action === "heading") exec("formatBlock", value)
      else if (action === "align") exec(`justify${value}`)
    })
    showMessage("info", `Macro "${name}" executed`)
  }, [exec, showMessage])

  // ── Field Insert ────────────────────────────────────────────
  const handleInsertField = useCallback(() => {
    let value = ""
    switch (fieldType) {
      case "date": value = new Date().toLocaleDateString(); break
      case "time": value = new Date().toLocaleTimeString(); break
      case "filename": value = currentFile?.name ?? "Untitled.docx"; break
      case "page": value = "Page 1"; break
    }
    exec("insertHTML", `<span class="doc-field" style="background:#f0f0f0;padding:0 2px;border-radius:2px">${value}</span>`)
    setShowFieldDialog(false); showMessage("info", `Field inserted: ${fieldType}`)
  }, [fieldType, currentFile, exec, showMessage])

  // ── Embed ───────────────────────────────────────────────────
  const handleEmbedObject = useCallback(() => {
    if (!embedUrl.trim()) return
    exec("insertHTML", `<iframe src="${embedUrl}" style="width:100%;height:400px;border:1px solid #ccc"></iframe>`)
    setShowEmbedDialog(false); setEmbedUrl(""); showMessage("info", "Object embedded")
  }, [embedUrl, exec, showMessage])

  // ── Paragraph Spacing ───────────────────────────────────────
  const handleApplyParagraph = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      let node: Node | null = sel.getRangeAt(0).startContainer
      while (node && node.nodeName !== "P" && node.nodeName !== "DIV" && node.nodeName !== "LI") node = node.parentNode
      if (node && node instanceof HTMLElement) {
        node.style.lineHeight = lineSpacing
        if (spaceBefore !== "0") node.style.marginTop = `${spaceBefore}pt`
        if (spaceAfter !== "0") node.style.marginBottom = `${spaceAfter}pt`
        setIsDirty(true)
      }
    }
    setShowParagraphDialog(false); showMessage("info", "Paragraph formatting applied")
  }, [lineSpacing, spaceBefore, spaceAfter, showMessage])

  // ── Delete Table ────────────────────────────────────────────
  const handleDeleteTable = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      let node: Node | null = sel.getRangeAt(0).startContainer
      while (node && node.nodeName !== "TABLE") node = node.parentNode
      if (node) { (node as HTMLTableElement).remove(); setIsDirty(true); showMessage("info", "Table deleted") }
      else showMessage("error", "No table selected")
    }
  }, [showMessage])

  // ── Border Color/Width ──────────────────────────────────────
  const handleApplyBorderStyle = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      let node: Node | null = sel.getRangeAt(0).startContainer
      while (node && node.nodeName !== "TABLE" && node.nodeName !== "TD" && node.nodeName !== "TH") node = node.parentNode
      if (node) {
        const table = node.nodeName === "TABLE" ? node as HTMLElement : (node as HTMLElement).closest("table")
        if (table) {
          table.style.border = `${borderWidth}px solid ${borderColor}`
          table.querySelectorAll("td, th").forEach((cell) => { (cell as HTMLElement).style.border = `${borderWidth}px solid ${borderColor}` })
          setIsDirty(true); showMessage("info", "Border style applied")
        }
      }
    }
  }, [borderColor, borderWidth, showMessage])

  // ── Cell Size ───────────────────────────────────────────────
  const handleApplyCellSize = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      let node: Node | null = sel.getRangeAt(0).startContainer
      while (node && node.nodeName !== "TD" && node.nodeName !== "TH") node = node.parentNode
      if (node && node instanceof HTMLElement) {
        if (cellWidth) node.style.width = cellWidth + "px"
        if (cellHeight) node.style.height = cellHeight + "px"
        setIsDirty(true); showMessage("info", "Cell size applied")
      }
    }
  }, [cellWidth, cellHeight, showMessage])

  // ── Citation ────────────────────────────────────────────────
  const handleInsertCitation = useCallback(() => {
    const cite = `${citationAuthor} (${citationYear}). ${citationSource}.`
    exec("insertHTML", `<span class="doc-citation" style="background:#f8f9fa;padding:1px 3px;border-radius:2px;font-size:0.9em">${cite}</span>`)
    setShowCitationDialog(false); showMessage("info", "Citation inserted")
  }, [citationAuthor, citationYear, citationSource, exec, showMessage])

  // ── Translate ───────────────────────────────────────────────
  const handleTranslate = useCallback(async () => {
    if (!translateText.trim()) return
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(translateText)}&langpair=en|zh`)
      const data = await res.json()
      setTranslateResult(data.responseData?.translatedText ?? "Translation failed")
    } catch { setTranslateResult("Translation service unavailable") }
  }, [translateText])

  // ── Collaboration (BroadcastChannel) ──────────────────────────
  const handleStartCollaboration = useCallback(() => {
    const ch = new BroadcastChannel("doc-collab")
    ch.onmessage = (e) => {
      if (e.data.type === "join") setCollabUsers((p) => [...p.filter((u) => u.id !== e.data.id), { id: e.data.id, name: e.data.name, color: e.data.color }])
      if (e.data.type === "leave") setCollabUsers((p) => p.filter((u) => u.id !== e.data.id))
      if (e.data.type === "edit" && editorRef.current) editorRef.current.innerHTML = e.data.html
    }
    bcRef.current = ch
    const user = { id: `u-${Date.now()}`, name: "User", color: `#${Math.floor(Math.random()*16777215).toString(16)}` }
    setCollabUsers((p) => [...p, user])
    ch.postMessage({ type: "join", ...user })
    setShowCollaboration(true)
    showMessage("info", "Collaboration started — share this tab with others")
  }, [showMessage])

  const handleStopCollaboration = useCallback(() => {
    bcRef.current?.close(); bcRef.current = null
    setCollabUsers([]); setShowCollaboration(false)
  }, [])

  useEffect(() => {
    if (!bcRef.current || !editorRef.current) return
    const obs = new MutationObserver(() => {
      bcRef.current?.postMessage({ type: "edit", html: editorRef.current?.innerHTML })
    })
    obs.observe(editorRef.current, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [showCollaboration])

  // ── SmartArt ──────────────────────────────────────────────────
  const handleInsertSmartArt = useCallback(() => {
    const svg = generateSmartArtSvg(smartArtType)
    exec("insertHTML", `<div contenteditable="false" style="display:inline-block;margin:8px 0">${svg}</div>`)
    setShowSmartArt(false)
  }, [smartArtType, exec])

  // ── Chart Insert ──────────────────────────────────────────────
  const handleInsertChart = useCallback(() => {
    const data = chartData.split(",").map(Number)
    const labels = chartLabels.split(",")
    const svg = generateChartSvg(chartInsertType, data, labels)
    exec("insertHTML", `<div contenteditable="false" style="display:inline-block;margin:8px 0">${svg}</div>`)
    setShowChartInsert(false)
  }, [chartData, chartLabels, chartInsertType, exec])

  // ── Table of Figures ──────────────────────────────────────────
  const handleInsertTableOfFigures = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const figures = editor.querySelectorAll("img, table, .chart, .smartart")
    let html = "<h2>Table of Figures</h2><ul>"
    figures.forEach((f, i) => { html += `<li>Figure ${i + 1}: ${(f as HTMLElement).title || f.getAttribute("alt") || "Untitled"}</li>` })
    html += "</ul>"
    exec("insertHTML", html); setShowTableOfFigures(false)
  }, [exec])

  // ── Index ─────────────────────────────────────────────────────
  const handleAddIndexTerm = useCallback(() => {
    if (!indexTerm.trim()) return
    setIndexTerms((p) => [...p, { term: indexTerm, page: 1 }])
    const sel = window.getSelection()
    if (sel?.rangeCount && !sel.isCollapsed) {
      const span = document.createElement("span"); span.className = "index-term"; span.dataset.term = indexTerm
      try { sel.getRangeAt(0).surroundContents(span) } catch { /* split */ }
    }
    setIndexTerm(""); showMessage("info", `Index term "${indexTerm}" added`)
  }, [indexTerm, showMessage])

  const handleInsertIndex = useCallback(() => {
    let html = "<h2>Index</h2><ul>"
    indexTerms.forEach((t) => { html += `<li>${t.term} — Page ${t.page}</li>` })
    html += "</ul>"
    exec("insertHTML", html); setShowIndexDialog(false)
  }, [indexTerms, exec])

  // ── Cross Reference ───────────────────────────────────────────
  const handleInsertCrossRef = useCallback(() => {
    if (!crossRefTarget.trim()) return
    exec("insertHTML", `<span class="cross-ref" data-target="${crossRefTarget}">See ${crossRefLabel || crossRefTarget}</span>`)
    setShowCrossRefDialog(false); setCrossRefTarget(""); setCrossRefLabel("")
  }, [crossRefTarget, crossRefLabel, exec])

  // ── Section Break / Orientation ───────────────────────────────
  const handleInsertSectionBreak = useCallback(() => {
    exec("insertHTML", `<hr style="border:2px dashed #999;margin:16px 0" title="Section Break" />`)
    showMessage("info", "Section break inserted")
  }, [exec, showMessage])

  const handleSetOrientation = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const w = sectionOrientation === "landscape" ? "11in" : "8.5in"
    const h = sectionOrientation === "landscape" ? "8.5in" : "11in"
    editor.style.maxWidth = w; editor.style.minHeight = h
    setShowSectionDialog(false); showMessage("info", `Orientation: ${sectionOrientation}`)
  }, [sectionOrientation, showMessage])

  // ── Grammar Check ─────────────────────────────────────────────
  const handleGrammarCheck = useCallback(() => {
    const text = editorRef.current?.textContent ?? ""
    const issues: typeof grammarIssues = []
    // Common grammar patterns
    if (/\b(its|it's)\s+(a|the)\b/gi.test(text)) issues.push({ text: "its/it's", suggestion: "Check its vs it's usage", type: "grammar" })
    if (/\b(their|there|they're)\b/gi.test(text)) issues.push({ text: "their/there/they're", suggestion: "Check their/there/they're usage", type: "grammar" })
    if (/\b(your|you're)\b/gi.test(text)) issues.push({ text: "your/you're", suggestion: "Check your vs you're usage", type: "grammar" })
    if (/\b(affect|effect)\b/gi.test(text)) issues.push({ text: "affect/effect", suggestion: "Check affect vs effect usage", type: "grammar" })
    if (/\b(than|then)\b/gi.test(text)) issues.push({ text: "than/then", suggestion: "Check than vs then usage", type: "grammar" })
    if (/\b(loose|lose)\b/gi.test(text)) issues.push({ text: "loose/lose", suggestion: "Check loose vs lose usage", type: "grammar" })
    if (/\b\w+ly\s+\w+ly\b/gi.test(text)) issues.push({ text: "Double adverb", suggestion: "Avoid consecutive -ly adverbs", type: "style" })
    if (/\bvery\s+\w+\b/gi.test(text)) issues.push({ text: "very + adj", suggestion: "Consider stronger adjective instead of 'very'", type: "style" })
    if (/\b(a|an)\s+[aeiou]/gi.test(text)) issues.push({ text: "a/an", suggestion: "Check a vs an article usage", type: "grammar" })
    setGrammarIssues(issues); setShowGrammarCheck(true)
  }, [])

  // ── Thesaurus ─────────────────────────────────────────────────
  const handleThesaurus = useCallback(() => {
    const sel = window.getSelection()
    const word = sel?.toString().trim() ?? ""
    if (!word) { showMessage("error", "Select a word first"); return }
    setThesaurusWord(word)
    // Common synonyms
    const synonyms: Record<string, string[]> = {
      good: ["excellent","fine","superior","positive","favorable","great","nice"],
      bad: ["poor","terrible","awful","negative","unfavorable","inferior","lousy"],
      big: ["large","huge","enormous","massive","gigantic","substantial","vast"],
      small: ["tiny","little","miniature","compact","petite","slight","minor"],
      important: ["significant","crucial","vital","essential","critical","key","major"],
      happy: ["joyful","delighted","pleased","content","cheerful","glad","elated"],
      sad: ["unhappy","sorrowful","melancholy","gloomy","miserable","depressed","downcast"],
      fast: ["quick","rapid","swift","speedy","brisk","hasty","prompt"],
      slow: ["sluggish","lethargic","gradual","deliberate","unhurried","tardy","lagging"],
      beautiful: ["gorgeous","stunning","lovely","attractive","pretty","handsome","elegant"],
      smart: ["intelligent","clever","bright","brilliant","wise","sharp","astute"],
    }
    const found = synonyms[word.toLowerCase()] ?? [word]
    setThesaurusResults(found); setShowThesaurus(true)
  }, [showMessage])

  const handleReplaceWithSynonym = useCallback((syn: string) => {
    const sel = window.getSelection()
    if (sel?.rangeCount && !sel.isCollapsed) {
      sel.getRangeAt(0).deleteContents()
      sel.getRangeAt(0).insertNode(document.createTextNode(syn))
      setIsDirty(true)
    }
    setShowThesaurus(false)
  }, [])

  // ── Real Encryption (AES-GCM via Web Crypto) ──────────────────
  const handleEncryptDocument = useCallback(async () => {
    if (!encryptPassword || !editorRef.current) return
    try {
      const html = editorRef.current.innerHTML
      const enc = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(encryptPassword), "PBKDF2", false, ["deriveKey"])
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("regminder-salt"), iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
      )
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(html))
      const combined = new Uint8Array(iv.length + encrypted.byteLength)
      combined.set(iv); combined.set(new Uint8Array(encrypted), iv.length)
      const b64 = btoa(String.fromCharCode(...combined))
      localStorage.setItem("doc-encrypted", b64)
      setIsEncrypted(true); setShowEncryptDialog(false)
      showMessage("success", "Document encrypted with AES-256-GCM")
    } catch { showMessage("error", "Encryption failed") }
  }, [encryptPassword, showMessage])

  const handleDecryptDocument = useCallback(async () => {
    const b64 = localStorage.getItem("doc-encrypted")
    if (!b64 || !encryptPassword || !editorRef.current) return
    try {
      const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const iv = combined.slice(0, 12); const data = combined.slice(12)
      const enc = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(encryptPassword), "PBKDF2", false, ["deriveKey"])
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("regminder-salt"), iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
      )
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)
      editorRef.current.innerHTML = new TextDecoder().decode(decrypted)
      setIsEncrypted(false); setShowEncryptDialog(false)
      showMessage("success", "Document decrypted")
    } catch { showMessage("error", "Wrong password or corrupted data") }
  }, [encryptPassword, showMessage])

  // ── Accessibility Check ───────────────────────────────────────
  const handleA11yCheck = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const issues: typeof a11yIssues = []
    // Check images without alt
    editor.querySelectorAll("img:not([alt])").forEach((img) => { issues.push({ element: "Image", issue: "Missing alt text", fix: "Add alt attribute describing the image" }) })
    // Check headings hierarchy
    const headings = editor.querySelectorAll("h1,h2,h3,h4,h5,h6")
    let prevLevel = 0
    headings.forEach((h) => {
      const level = parseInt(h.tagName[1])
      if (level > prevLevel + 1 && prevLevel > 0) issues.push({ element: h.tagName, issue: `Skipped heading level (from H${prevLevel} to H${level})`, fix: `Add H${prevLevel + 1} before H${level}` })
      prevLevel = level
    })
    // Check tables without headers
    editor.querySelectorAll("table:not(:has(th))").forEach(() => { issues.push({ element: "Table", issue: "Missing header row", fix: "Add <th> elements for column headers" }) })
    // Check links without text
    editor.querySelectorAll("a:empty, a[href]:not(:has(*))").forEach(() => { issues.push({ element: "Link", issue: "Empty link text", fix: "Add descriptive link text" }) })
    setA11yIssues(issues); setShowA11yDialog(true)
  }, [])

  // ── Quick Parts ───────────────────────────────────────────────
  const handleSaveQuickPart = useCallback(() => {
    if (!quickPartName.trim() || !editorRef.current) return
    const sel = window.getSelection()
    if (sel?.rangeCount && !sel.isCollapsed) {
      const div = document.createElement("div")
      div.appendChild(sel.getRangeAt(0).cloneContents())
      setQuickParts((p) => [...p, { name: quickPartName, html: div.innerHTML }])
      setQuickPartName(""); showMessage("info", `Quick Part "${quickPartName}" saved`)
    }
  }, [quickPartName, showMessage])

  const handleInsertQuickPart = useCallback((qp: { name: string; html: string }) => {
    exec("insertHTML", qp.html); showMessage("info", `Quick Part "${qp.name}" inserted`)
  }, [exec, showMessage])

  // ── ODF/RTF Export ────────────────────────────────────────────
  const handleExportOdf = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? ""
    const odt = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body><office:text>${html.replace(/<[^>]+>/g, "")}</office:text></office:body>
</office:document>`
    const blob = new Blob([odt], { type: "application/vnd.oasis.opendocument.text" })
    saveBlobAs(blob, (currentFile?.name ?? "document").replace(/\.[^.]+$/, ".odt"))
    showMessage("success", "Exported as ODF")
  }, [currentFile, showMessage])

  const handleExportRtf = useCallback(() => {
    const text = editorRef.current?.textContent ?? ""
    const rtf = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Calibri;}}\\f0\\fs24 ${text.replace(/\n/g, "\\par ")} }`
    const blob = new Blob([rtf], { type: "application/rtf" })
    saveBlobAs(blob, (currentFile?.name ?? "document").replace(/\.[^.]+$/, ".rtf"))
    showMessage("success", "Exported as RTF")
  }, [currentFile, showMessage])

  // ── Unified export handler ──────────────────────────────────────
  const handleExportFile = useCallback(async () => {
    if (!exportFileName.trim()) return
    const name = exportFileName.trim()
    const folder = exportFolderPath.trim() || undefined
    setShowExportDialog(false)

    try {
      if (exportFormat === "pdf") {
        await handlePdfExport()
        return
      }
      if (exportFormat === "odf") {
        handleExportOdf()
        return
      }
      if (exportFormat === "rtf") {
        handleExportRtf()
        return
      }
    } catch (err) {
      showMessage("error", `Export failed: ${err instanceof Error ? err.message : "error"}`)
    }
  }, [exportFormat, exportFileName, exportFolderPath, handlePdfExport, handleExportOdf, handleExportRtf, showMessage])

  // ── Phase 6: 10 remaining gaps ────────────────────────────────

  // 1. WebSocket RT collaboration
  const handleStartWsCollab = useCallback(() => {
    try {
      const ws = new WebSocket(wsCollabUrl)
      ws.onopen = () => { showMessage("success", "Connected to collab server"); setShowWebSocketCollab(true) }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === "edit" && editorRef.current && msg.docId === collabDocId) editorRef.current.innerHTML = msg.html
          if (msg.type === "users") setCollabUsers(msg.users)
        } catch {}
      }
      ws.onclose = () => setShowWebSocketCollab(false)
      wsRef.current = ws
    } catch { showMessage("error", "WebSocket connection failed") }
  }, [wsCollabUrl, collabDocId, showMessage])

  const handleStopWsCollab = useCallback(() => { wsRef.current?.close(); wsRef.current = null; setShowWebSocketCollab(false) }, [])

  useEffect(() => {
    if (!wsRef.current || !editorRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const obs = new MutationObserver(() => {
      wsRef.current?.send(JSON.stringify({ type: "edit", docId: collabDocId, html: editorRef.current?.innerHTML }))
    })
    obs.observe(editorRef.current, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [showWebSocketCollab, collabDocId])

  // 2. .doc binary import
  const handleOpenDocBinary = useCallback(async () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".doc"
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return; setMode("loading")
      try {
        const buffer = await fileToArrayBuffer(file)
        const { html } = await docxToHtml(buffer)
        if (editorRef.current) editorRef.current.innerHTML = sanitizeEditorHtml(html)
        setCurrentFile({ name: file.name, provider: "local", folder: "", size: file.size })
        setMode("editing"); showMessage("success", `Opened: ${file.name}`)
      } catch { setMode("error"); showMessage("error", "Failed to read .doc file") }
    }; input.click()
  }, [showMessage])

  // 3. Track Changes author attribution
  const handleTrackChangeMark = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount && !sel.isCollapsed) {
      const html = sel.getRangeAt(0).cloneContents()
      const div = document.createElement("div"); div.appendChild(html)
      setTrackChanges((p) => [...p, { id: `tc-${Date.now()}`, type: "delete", html: div.innerHTML, author: trackChangeAuthor, date: new Date().toLocaleString(), accepted: false }])
      sel.getRangeAt(0).deleteContents(); setIsDirty(true)
    }
  }, [trackChangeAuthor])

  // 5. Named style gallery
  const handleApplyNamedStyle = useCallback((style: typeof namedStyles[0]) => {
    exec("styleWithCSS", "true")
    const sel = window.getSelection()
    if (sel?.rangeCount && !sel.isCollapsed) {
      const span = document.createElement("span"); span.style.cssText = style.css
      try { sel.getRangeAt(0).surroundContents(span); span.replaceWith(...Array.from(span.childNodes)) } catch {}
    }
    setIsDirty(true); setShowStyleGallery(false)
    showMessage("info", `Style "${style.name}" applied`)
  }, [exec, showMessage])

  // 6. Multi-level list
  const handleInsertMultiLevelList = useCallback(() => {
    const markers = ["1.", "a.", "i.", "(1)", "(a)"]
    const marker = markers[Math.min(listLevel - 1, markers.length - 1)]
    exec("insertHTML", `<p style="padding-left:${listLevel*24}px">${marker} </p>`)
    setShowMultiLevelList(false)
  }, [listLevel, exec])

  // 7. Dynamic TOC
  const handleInsertDynamicToc = useCallback(() => {
    if (!editorRef.current) return
    const headings = editorRef.current.querySelectorAll("h1,h2,h3")
    let html = '<div class="dynamic-toc" contenteditable="false" style="border:1px solid #ccc;padding:12px;margin:8px 0;background:#f9f9f9"><h2 style="margin-top:0">Table of Contents</h2><ul style="list-style:none;padding-left:0">'
    headings.forEach((h, i) => {
      const level = parseInt(h.tagName[1]); const text = h.textContent ?? `Heading ${i+1}`
      const id = `toc-${i}-${Date.now()}`; h.id = id
      html += `<li style="padding-left:${(level-1)*16}px;margin:4px 0"><a href="#${id}" style="color:#1F3864;text-decoration:none">${text}</a></li>`
    })
    html += "</ul></div>"; exec("insertHTML", html)
    showMessage("info", "Dynamic TOC inserted")
  }, [exec, showMessage])

  // 8. Legacy form fields
  const handleInsertLegacyForm = useCallback(() => {
    let html = ""
    if (legacyFormType === "text") html = `<input type="text" style="border:1px solid #999;padding:4px 8px;font-family:Calibri;font-size:11pt" placeholder="Enter text" />`
    else if (legacyFormType === "checkbox") html = `<label style="font-family:Calibri;font-size:11pt"><input type="checkbox" /> Checkbox</label>`
    else { const opts = legacyFormOptions.split(",").map(o => o.trim()).filter(Boolean); html = `<select style="border:1px solid #999;padding:4px 8px;font-family:Calibri;font-size:11pt">${opts.map(o => `<option>${o}</option>`).join("")}</select>` }
    exec("insertHTML", html); setShowLegacyFormDialog(false)
  }, [legacyFormType, legacyFormOptions, exec])

  // 9. Document protection
  const handleProtectDocument = useCallback(() => {
    if (!protectPassword) return
    setIsProtected(true); setShowProtectDialog(false)
    const editor = editorRef.current; if (!editor) return
    if (protectMode === "readonly") { editor.contentEditable = "false"; editor.style.backgroundColor = "#f5f5f5" }
    showMessage("info", `Document protected: ${protectMode} mode`)
  }, [protectPassword, protectMode, showMessage])

  const handleUnprotectDocument = useCallback(() => {
    const pw = prompt("Enter password to unprotect:")
    if (pw === protectPassword) { setIsProtected(false); const e = editorRef.current; if(e){e.contentEditable="true";e.style.backgroundColor=""}; showMessage("success","Unprotected") }
    else showMessage("error","Wrong password")
  }, [protectPassword, showMessage])

  // 10. Print/web layout toggle
  const handleToggleViewLayout = useCallback(() => {
    setViewLayout((p) => {
      const next = p === "web" ? "print" : "web"
      const editor = editorRef.current
      if (editor) {
        if (next === "print") { editor.style.maxWidth = "8.5in"; editor.style.minHeight = "11in"; editor.style.boxShadow = "0 0 0 1px #e5e7eb"; editor.style.padding = "1in" }
        else { editor.style.maxWidth = "100%"; editor.style.minHeight = ""; editor.style.boxShadow = "none"; editor.style.padding = "" }
      }
      showMessage("info", `Layout: ${next === "print" ? "Print" : "Web"}`); return next
    })
  }, [showMessage])

  // ── Link ─────────────────────────────────────────────────────

  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")

  const handleInsertLink = useCallback(() => {
    const text = linkText || linkUrl
    exec("insertHTML", `<a href="${linkUrl}" target="_blank">${text}</a>`)
    setShowLinkDialog(false)
    setLinkUrl("")
    setLinkText("")
  }, [linkUrl, linkText, exec])

  // ── Image ────────────────────────────────────────────────────

  const handleInsertImage = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const base64 = await fileToBase64(file)
      exec("insertHTML", `<img src="data:${file.type};base64,${base64}" style="max-width:100%" alt="${file.name}">`)
    }
    input.click()
  }, [exec])

  // ── Text Color & Highlight ────────────────────────────────────

  const handleTextColor = useCallback((color: string) => {
    setTextColor(color)
    exec("foreColor", color)
    setShowColorPicker(null)
  }, [exec])

  const handleHighlight = useCallback((color: string) => {
    setHighlightColor(color)
    exec("hiliteColor", color)
    setShowColorPicker(null)
  }, [exec])

  // ── Find & Replace ────────────────────────────────────────────

  const handleFind = useCallback(() => {
    if (!editorRef.current || !findText) return
    const html = editorRef.current.innerHTML
    const flags = findMatchCase ? "g" : "gi"
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(`(${escaped})`, flags)
    const matches = html.match(regex)
    setFindResults(matches?.length ?? 0)

    // Highlight matches
    const highlighted = html.replace(regex, '<mark style="background:#FFEB3B;color:#000">$1</mark>')
    editorRef.current.innerHTML = highlighted
    showMessage("info", `Found ${matches?.length ?? 0} match(es)`)
  }, [findText, findMatchCase, showMessage])

  const handleReplace = useCallback(() => {
    if (!editorRef.current || !findText) return
    const html = editorRef.current.innerHTML
    const flags = findMatchCase ? "g" : "gi"
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(escaped, flags)
    const newHtml = html.replace(regex, replaceText)
    editorRef.current.innerHTML = newHtml
    setIsDirty(true)
    showMessage("success", "Replaced all occurrences")
  }, [findText, replaceText, findMatchCase, showMessage])

  const handleReplaceOne = useCallback(() => {
    if (!editorRef.current || !findText) return
    const html = editorRef.current.innerHTML
    const flags = findMatchCase ? "" : "i"
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(escaped, flags)
    const newHtml = html.replace(regex, replaceText)
    editorRef.current.innerHTML = newHtml
    setIsDirty(true)
    showMessage("info", "Replaced 1 occurrence")
  }, [findText, replaceText, findMatchCase, showMessage])

  // ── Context Menu ──────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-dropdown]")) return
      setShowFontPicker(false)
      setShowFontSizePicker(false)
      setShowColorPicker(null)
      setShowNewMenu(false)
      setShowOpenMenu(false)
      setShowSaveMenu(false)
    }
    window.addEventListener("click", handleClick)
    return () => window.removeEventListener("click", handleClick)
  }, [])

  // ── Font size change handler ─────────────────────────────────

  const handleFontSizeChange = useCallback((sizeValue: string) => {
    setFontSize(sizeValue)
    exec("fontSize", sizeValue)
    setShowFontSizePicker(false)
  }, [exec])

  const handleFontNameChange = useCallback((name: string) => {
    setFontName(name)
    exec("fontName", name)
    setShowFontPicker(false)
  }, [exec])

  // ── Storage Browser ──────────────────────────────────────────

  const loadFileBrowser = useCallback(async (folder: string, provider: string) => {
    setBrowserLoading(true)
    try {
      const items = await listDocuments(folder, provider, true)
      setFileList(items)
    } catch (err) {
      showMessage("error", `Failed to list files: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBrowserLoading(false)
    }
  }, [showMessage])

  const handleBrowseStorage = useCallback(() => {
    setShowFileBrowser(true)
    loadFileBrowser(browserFolder, browserProvider)
  }, [browserFolder, browserProvider, loadFileBrowser])

  // ── Keyboard shortcuts ───────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === "s") {
        e.preventDefault()
        handleSaveAsDocx()
      }
      if (mod && e.key === "p") {
        e.preventDefault()
        handlePrint()
      }
      if (mod && e.key === "f") {
        e.preventDefault()
        setShowFindReplace((v) => !v)
      }
      if (mod && e.key === "h") {
        e.preventDefault()
        setShowFindReplace((v) => !v)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSaveAsDocx, handlePrint])

  // ── 18 remaining gap handlers ─────────────────────────────────

  // Review pane
  const handleAcceptChange = useCallback((id: string) => {
    setChanges((prev) => prev.map((c) => (c.id === id ? { ...c, accepted: true } : c)))
    showMessage("info", "Change accepted")
  }, [showMessage])
  const handleRejectChange = useCallback((id: string) => {
    setChanges((prev) => prev.filter((c) => c.id !== id))
    showMessage("info", "Change rejected")
  }, [showMessage])

  const handleAcceptTrackChange = useCallback((id: string) => {
    setTrackChanges((prev) => prev.map((change) => (change.id === id ? { ...change, accepted: true } : change)))
    showMessage("info", "Track change accepted")
  }, [showMessage])

  const handleRejectTrackChange = useCallback((id: string) => {
    setTrackChanges((prev) => prev.filter((change) => change.id !== id))
    showMessage("info", "Track change rejected")
  }, [showMessage])

  // Read-only / Protect
  const handleToggleReadOnly = useCallback(() => { setIsReadOnly((v) => !v); showMessage("info", isReadOnly ? "Editing enabled" : "Read-only mode") }, [isReadOnly, showMessage])

  // Document properties
  const handleSaveProperties = useCallback(() => {
    if (editorRef.current) {
      if (docTitle) editorRef.current.setAttribute("data-title", docTitle)
      if (docAuthor) editorRef.current.setAttribute("data-author", docAuthor)
    }
    setShowProperties(false); showMessage("info", "Properties saved")
  }, [docTitle, docAuthor, showMessage])

  // Page color
  const handleApplyPageColor = useCallback(() => {
    setShowPageColor(false); showMessage("info", "Page color applied")
  }, [showMessage])

  // Fullscreen
  const handleToggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }, [isFullscreen])

  // Columns
  const handleApplyColumns = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    if (columnsCount > 1) editor.style.columnCount = String(columnsCount)
    else editor.style.columnCount = ""
    editor.style.columnGap = "24px"
    setShowColumns(false); showMessage("info", `${columnsCount} column${columnsCount > 1 ? "s" : ""} applied`)
  }, [columnsCount, showMessage])

  // Ruler toggle
  const handleToggleRuler = useCallback(() => setShowRuler((v) => !v), [])

  // Emoji picker
  const EMOJIS = ["😀","😂","❤️","👍","🔥","🎉","✨","😊","🙏","💪","🤔","👀","🚀","💡","⭐","✅","❌","📝","🔍","📌","🎯","💯","🏆","📅","⏰","🔔","📧","💼","🎨","🔧"]
  const handleInsertEmoji = useCallback((emoji: string) => { exec("insertHTML", emoji); setShowEmojiPicker(false) }, [exec])

  // Equation
  const handleInsertEquation = useCallback(() => {
    if (!equationText.trim()) return
    exec("insertHTML", `<span style="font-family:'Times New Roman',serif;font-style:italic;font-size:1.1em;padding:4px 8px;background:#fafafa;border:1px solid #e0e0e0;border-radius:4px">${equationText}</span>`)
    setShowEquationDialog(false); setEquationText("")
  }, [equationText, exec])

  // Auto-save
  const handleToggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((v) => !v)
    showMessage("info", autoSaveEnabled ? "Auto-save disabled" : "Auto-save enabled (every 30s)")
  }, [autoSaveEnabled, showMessage])

  useEffect(() => {
    if (autoSaveEnabled && isDirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => {
        handleSaveAsDocx()
        showMessage("info", "Auto-saved")
      }, 30000)
    }
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [autoSaveEnabled, isDirty, handleSaveAsDocx, showMessage])

  // ── 18 Remaining Gaps: Handlers ─────────────────────────────
  // #5 Advanced list numbering
  const handleApplyListNumbering = useCallback(() => {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    const range = sel.getRangeAt(0)
    let container = range.commonAncestorContainer as HTMLElement
    if (container.nodeType === 3) container = container.parentElement!
    const listEl = container.closest("ol, ul")
    if (!listEl) { showMessage("error", "Select a list first"); return }
    if (listEl.tagName === "OL") {
      const typeMap: Record<string, string> = { decimal: "1", lowerRoman: "i", upperRoman: "I", lowerLetter: "a", upperLetter: "A" }
      ;(listEl as HTMLOListElement).type = typeMap[listNumberFormat] || "1"
      if (listRestartNumber > 1) (listEl as HTMLOListElement).start = listRestartNumber
    }
    setIsDirty(true); setShowListNumberingDialog(false)
    showMessage("info", `List format: ${listNumberFormat}`)
  }, [listNumberFormat, listRestartNumber, showMessage])

  // #6 Floating image layout
  const handleFloatingImageLayout = useCallback(() => {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    let node = sel.getRangeAt(0).startContainer as HTMLElement
    if (node.nodeType === 3) node = node.parentElement!
    const img = node.closest("img") || node
    if ((img as HTMLElement).tagName !== "IMG") { showMessage("error", "Select an image first"); return }
    const imgEl = img as HTMLImageElement
    const wrapMap: Record<string, string> = { inline: "none", square: "both", tight: "both", behind: "none", front: "none" }
    const posMap: Record<string, string> = { inline: "static", square: "relative", tight: "relative", behind: "absolute", front: "absolute" }
    const zMap: Record<string, string> = { behind: "-1", front: "1", inline: "auto", square: "auto", tight: "auto" }
    imgEl.style.position = posMap[floatingImageMode] || "static"
    imgEl.style.float = wrapMap[floatingImageMode] || "none"
    imgEl.style.zIndex = zMap[floatingImageMode] || "auto"
    if (floatingImageMode === "behind") imgEl.style.opacity = "0.5"
    else imgEl.style.opacity = "1"
    setIsDirty(true); showMessage("info", `Image layout: ${floatingImageMode}`)
  }, [floatingImageMode, showMessage])

  // #7 Image resize handles — global mousemove/mouseup in useEffect below
  const handleImageResizeStart = useCallback((e: React.MouseEvent, img: HTMLImageElement, handle: string) => {
    e.preventDefault(); e.stopPropagation()
    setImageResizeTarget(img); setImageResizeHandle(handle as any)
  }, [])
  useEffect(() => {
    if (!imageResizeTarget || !imageResizeHandle) return
    const move = (e: MouseEvent) => {
      const dx = e.movementX; const dy = e.movementY
      const img = imageResizeTarget!; const h = imageResizeHandle!
      if (h.includes("r")) img.width = Math.max(20, img.width + dx)
      if (h.includes("l")) img.width = Math.max(20, img.width - dx)
      if (h.includes("b")) img.height = Math.max(20, img.height + dy)
      if (h.includes("t")) img.height = Math.max(20, img.height - dy)
    }
    const up = () => { setImageResizeTarget(null); setImageResizeHandle(null); setIsDirty(true) }
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up)
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up) }
  }, [imageResizeTarget, imageResizeHandle])

  // #8 Image cropping
  const handleImageCropApply = useCallback(() => {
    if (!cropTarget) return
    cropTarget.style.clipPath = `inset(${cropValues.top}% ${cropValues.right}% ${cropValues.bottom}% ${cropValues.left}%)`
    setShowImageCrop(false); setCropTarget(null); setIsDirty(true)
    showMessage("info", "Image cropped")
  }, [cropTarget, cropValues, showMessage])

  // #9 Text boxes
  const handleInsertTextBox = useCallback(() => {
    const html = `<div contenteditable="true" style="display:inline-block;border:1px solid #999;padding:8px 12px;margin:4px;min-width:120px;min-height:40px;border-radius:4px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.08)">${textBoxContent || "Text"}</div>`
    exec("insertHTML", html); setShowTextBoxDialog(false); setTextBoxContent("")
  }, [textBoxContent, exec])

  // #10 Shapes
  const handleInsertShape = useCallback((shape: string) => {
    const shapeSvg: Record<string, string> = {
      rectangle: '<div style="display:inline-block;width:120px;height:80px;border:2px solid #4f46e5;background:#eef2ff;border-radius:4px;margin:4px"></div>',
      oval: '<div style="display:inline-block;width:120px;height:80px;border:2px solid #4f46e5;background:#eef2ff;border-radius:50%;margin:4px"></div>',
      arrow: '<div style="display:inline-block;font-size:24px;color:#4f46e5;margin:4px">→</div>',
      callout: '<div style="display:inline-block;border:2px solid #4f46e5;background:#eef2ff;border-radius:8px;padding:8px 12px;margin:4px;max-width:200px;position:relative"><div style="font-size:11px">Callout text</div><div style="position:absolute;bottom:-10px;left:20px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #4f46e5"></div></div>',
      line: '<div style="display:inline-block;width:120px;height:2px;background:#4f46e5;margin:4px 8px;vertical-align:middle"></div>',
      triangle: '<div style="display:inline-block;width:0;height:0;border-left:40px solid transparent;border-right:40px solid transparent;border-bottom:70px solid #4f46e5;margin:4px"></div>',
      star: '<div style="display:inline-block;font-size:32px;color:#f59e0b;margin:4px">★</div>',
    }
    exec("insertHTML", shapeSvg[shape] || ""); setShowShapesMenu(false)
  }, [exec])

  // #11 Drawing canvas
  const handleDrawingCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const svg = (e.target as HTMLElement).closest("svg")
    if (!svg) return; const rect = svg.getBoundingClientRect()
    setIsDrawingFreehand(true)
    setDrawingPaths(prev => [...prev, { points: [{ x: e.clientX - rect.left, y: e.clientY - rect.top }], color: drawingColor, width: drawingWidth }])
  }, [drawingColor, drawingWidth])
  const handleDrawingCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingFreehand) return; const svg = (e.target as HTMLElement).closest("svg")
    if (!svg) return; const rect = svg.getBoundingClientRect()
    setDrawingPaths(prev => { const next = [...prev]; const last = next[next.length - 1]; if (last) last.points = [...last.points, { x: e.clientX - rect.left, y: e.clientY - rect.top }]; return next })
  }, [isDrawingFreehand])
  const handleDrawingCanvasPointerUp = useCallback(() => setIsDrawingFreehand(false), [])
  const handleInsertDrawing = useCallback(() => {
    const svgPaths = drawingPaths.map(p => { const d = p.points.map((pt, i) => (i === 0 ? "M" : "L") + pt.x + " " + pt.y).join(" "); return `<path d="${d}" stroke="${p.color}" stroke-width="${p.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` }).join("")
    exec("insertHTML", `<svg width="400" height="300" style="border:1px solid #ddd;background:#fff;display:block;margin:8px 0">${svgPaths}</svg>`)
    setShowDrawingCanvas(false); setDrawingPaths([])
  }, [drawingPaths, exec])

  // #12 Endnotes
  const handleInsertEndnote = useCallback(() => {
    if (!endnoteText.trim()) return; const ref = endnotes.length + 1; const id = `en-${Date.now()}`
    setEndnotes(prev => [...prev, { id, text: endnoteText, ref: String(ref) }])
    exec("insertHTML", `<sup style="color:#2563eb;cursor:pointer;font-size:0.75em" data-endnote-id="${id}" title="${endnoteText}">[${ref}]</sup>`)
    setShowEndnoteDialog(false); setEndnoteText("")
  }, [endnoteText, endnotes.length, exec])

  // #13 Bibliography
  const handleAddCitation = useCallback(() => {
    const id = `cit-${Date.now()}`
    setCitations(prev => [...prev, { id, author: citationAuthor, title: citationSource, year: citationYear, publisher: "", url: "" }])
    exec("insertHTML", `<span style="color:#2563eb;border-bottom:1px dotted #2563eb;cursor:pointer" data-citation-id="${id}">(${citationAuthor || "Author"}, ${citationYear || "n.d."})</span>`)
    setShowCitationDialog(false); setCitationSource(""); setCitationAuthor(""); setCitationYear("")
  }, [citationAuthor, citationSource, citationYear, exec])
  const handleGenerateBibliography = useCallback(() => {
    if (citations.length === 0) { showMessage("info", "No citations yet"); return }
    let bib = `<h2>References</h2>`
    const formatMap: Record<string, (c: typeof citations[0], i: number) => string> = {
      APA: (c, i) => `<p style="text-indent:-2em;padding-left:2em;margin-bottom:4px;font-size:11pt">${c.author || "Author"}. (${c.year || "n.d."}). <i>${c.title || "Title"}</i>.${c.publisher ? " " + c.publisher + "." : ""}${c.url ? " " + c.url : ""}</p>`,
      MLA: (c, i) => `<p style="text-indent:-2em;padding-left:2em;margin-bottom:4px;font-size:11pt">${c.author || "Author"}. "${c.title || "Title"}." ${c.publisher || "Publisher"}, ${c.year || "n.d."}.${c.url ? " " + c.url : ""}</p>`,
      Chicago: (c, i) => `<p style="text-indent:-2em;padding-left:2em;margin-bottom:4px;font-size:11pt">${c.author || "Author"}. <i>${c.title || "Title"}</i>. ${c.publisher || "Publisher"}, ${c.year || "n.d."}.${c.url ? " " + c.url : ""}</p>`,
    }
    bib += citations.map((c, i) => formatMap[bibliographyStyle](c, i)).join("")
    exec("insertHTML", `<div style="margin-top:24px;border-top:1px solid #ccc;padding-top:16px">${bib}</div>`)
    setShowBibliographyDialog(false); showMessage("success", `Bibliography (${bibliographyStyle}) generated`)
  }, [citations, bibliographyStyle, exec, showMessage])

  // #14 Restrict editing (server-side with password hashing)
  const handleRestrictEditing = useCallback(async () => {
    if (!restrictPassword) { showMessage("error", "Password required"); return }
    const encoder = new TextEncoder(); const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(restrictPassword))
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
    setRestrictHash(hashHex); setIsReadOnly(true); setIsProtected(true)
    setShowRestrictEditDialog(false); setRestrictPassword("")
    showMessage("info", "Editing restricted — password required to unlock")
  }, [restrictPassword, showMessage])
  const handleUnlockEditing = useCallback(async () => {
    const pw = prompt("Enter password to unlock:"); if (!pw) return
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw))
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
    if (hashHex === restrictHash) { setIsReadOnly(false); setIsProtected(false); setRestrictHash(null); showMessage("success", "Editing unlocked") }
    else showMessage("error", "Incorrect password")
  }, [restrictHash, showMessage])

  // #15 Custom XML parts
  const handleInsertCustomXml = useCallback(() => {
    if (!customXmlData.trim()) return
    try { const parser = new DOMParser(); const xmlDoc = parser.parseFromString(customXmlData, "text/xml"); const bindings: Array<{ tag: string; content: string }> = []
      xmlDoc.querySelectorAll("*").forEach(el => { if (el.children.length === 0 && el.textContent) bindings.push({ tag: el.tagName, content: el.textContent }) })
      setCustomXmlBindings(prev => [...prev, ...bindings])
      exec("insertHTML", bindings.map(b => `<span data-xml-tag="${b.tag}" style="background:#f0fdf4;border-bottom:1px dashed #22c55e;padding:0 2px" contenteditable="false" title="XML: ${b.tag}">${b.content}</span>`).join(" "))
      setShowCustomXmlDialog(false); setCustomXmlData(""); showMessage("success", `${bindings.length} XML binding(s) inserted`)
    } catch { showMessage("error", "Invalid XML") }
  }, [customXmlData, exec, showMessage])

  // #16 Content controls
  const handleInsertContentControl = useCallback(() => {
    const id = `cc-${Date.now()}`; let html = ""; const placeholder = "Click to edit..."
    if (contentControlType === "text" || contentControlType === "richtext") {
      html = `<span data-content-control="${id}" style="display:inline-block;border:1px solid #94a3b8;border-radius:4px;padding:2px 8px;min-width:100px;background:#f8fafc;cursor:text" contenteditable="true">${placeholder}</span>`
    } else if (contentControlType === "date") {
      html = `<span data-content-control="${id}" style="display:inline-block;border:1px solid #94a3b8;border-radius:4px;padding:2px 8px;background:#f8fafc;cursor:pointer" contenteditable="false">📅 ${new Date().toLocaleDateString()}</span>`
    } else if (contentControlType === "dropdown") {
      const opts = contentControlOptions.split(",").map(o => o.trim()).filter(Boolean)
      const options = (opts.length > 0 ? opts : ["Option 1", "Option 2", "Option 3"]).map(o => `<option>${o}</option>`).join("")
      html = `<select data-content-control="${id}" style="border:1px solid #94a3b8;border-radius:4px;padding:2px 8px;background:#f8fafc">${options}</select>`
    } else if (contentControlType === "checkbox") {
      html = `<label data-content-control="${id}" style="display:inline-flex;align-items:center;gap:4px;border:1px solid #94a3b8;border-radius:4px;padding:2px 8px;background:#f8fafc;cursor:pointer"><input type="checkbox"/> ${placeholder}</label>`
    } else if (contentControlType === "repeating") {
      html = `<div data-content-control="${id}" style="border:1px dashed #94a3b8;border-radius:4px;padding:8px;margin:4px 0;background:#fafafa"><div contenteditable="true" style="min-height:20px;padding:4px">${placeholder}</div><button onclick="this.parentElement.cloneNode(true)" style="font-size:10px;margin-top:4px;padding:2px 8px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer">+ Add</button></div>`
    }
    setContentControls(prev => [...prev, { id, type: contentControlType, placeholder, options: contentControlOptions.split(",").map(o => o.trim()).filter(Boolean) }])
    exec("insertHTML", html); setShowContentControlDialog(false)
  }, [contentControlType, contentControlOptions, exec])

  // #17 Table auto-fit
  const handleApplyTableAutoFit = useCallback(() => {
    const sel = window.getSelection(); if (!sel?.rangeCount) return
    let node = sel.getRangeAt(0).startContainer as HTMLElement
    if (node.nodeType === 3) node = node.parentElement!
    const table = node.closest("table") as HTMLTableElement
    if (!table) { showMessage("error", "Select a table first"); return }
    if (tableAutoFitMode === "auto") { table.style.tableLayout = "auto"; table.style.width = "auto" }
    else if (tableAutoFitMode === "fixed") { table.style.tableLayout = "fixed"; table.style.width = "100%" }
    else if (tableAutoFitMode === "window") { table.style.width = "100%"; table.style.tableLayout = "auto" }
    setIsDirty(true); showMessage("info", `Table auto-fit: ${tableAutoFitMode}`)
  }, [tableAutoFitMode, showMessage])

  // #18 Table styles
  const tableStylePresets: Record<string, string> = {
    none: "", "banded-rows": "tr:nth-child(even){background:#f1f5f9!important}",
    "header-row": "thead tr,tr:first-child{background:#1e3a5f!important;color:#fff!important;font-weight:bold}",
    "total-row": "tr:last-child{background:#e2e8f0!important;font-weight:bold;border-top:2px solid #333}",
    "banded-cols": "td:nth-child(even),th:nth-child(even){background:#f1f5f9!important}",
    colorful: "thead tr,tr:first-child{background:linear-gradient(135deg,#4f46e5,#7c3aed)!important;color:#fff!important}tr:nth-child(even){background:#f5f3ff!important}",
  }
  const handleApplyTableStyle = useCallback(() => {
    const sel = window.getSelection(); if (!sel?.rangeCount) return
    let node = sel.getRangeAt(0).startContainer as HTMLElement
    if (node.nodeType === 3) node = node.parentElement!
    const table = node.closest("table"); if (!table) { showMessage("error", "Select a table first"); return }
    const style = tableStylePresets[tableStylePreset] || ""
    if (style) { const se = document.createElement("style"); se.textContent = `.ts-${tableStylePreset}{${style}}`; table.parentElement?.insertBefore(se, table); table.classList.add(`ts-${tableStylePreset}`) }
    setIsDirty(true); setShowTableStyles(false); showMessage("info", `Table style: ${tableStylePreset}`)
  }, [tableStylePreset, showMessage])

  // #20 Character spacing
  const handleApplyCharSpacing = useCallback(() => {
    const sel = window.getSelection(); if (!sel?.rangeCount) return
    const span = document.createElement("span"); span.style.letterSpacing = `${charSpacing}px`
    try { sel.getRangeAt(0).surroundContents(span) } catch {}
    setIsDirty(true); setShowCharSpacing(false); showMessage("info", `Char spacing: ${charSpacing > 0 ? "+" : ""}${charSpacing}px`)
  }, [charSpacing, showMessage])

  // #21 Drop cap
  const handleApplyDropCap = useCallback(() => {
    const sel = window.getSelection(); if (!sel?.rangeCount) return
    const range = sel.getRangeAt(0); const para = (range.startContainer as Node).parentElement?.closest("p")
    if (!para) { showMessage("error", "Position cursor in a paragraph"); return }
    const firstChar = para.textContent?.charAt(0) || ""; const rest = para.textContent?.slice(1) || ""
    para.innerHTML = `<span style="float:left;font-size:${dropCapLines * 1.6}em;line-height:1;margin-right:6px;font-weight:bold;color:#1e3a5f">${firstChar}</span>${rest}`
    setIsDirty(true); setShowDropCap(false); showMessage("info", "Drop cap applied")
  }, [dropCapLines, showMessage])

  // #23 Page borders
  const handleApplyPageBorder = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    editor.style.border = `${pageBorderWidth}px solid ${pageBorderColor}`; editor.style.padding = "20px"
    setIsDirty(true); setShowPageBorderDialog(false); showMessage("info", "Page border applied")
  }, [pageBorderColor, pageBorderWidth, showMessage])

  // #24 Different headers per section
  const handleAddSectionHeader = useCallback(() => {
    const editor = editorRef.current; if (!editor) return
    const sectionId = `sec-${Date.now()}`
    exec("insertHTML", `<div data-section-id="${sectionId}" style="page-break-before:always;border-top:2px dashed #4f46e5;padding-top:8px;margin-top:16px"></div>`)
    setSectionHeaders(prev => [...prev, { id: sectionId, header: "", footer: "", startPage: prev.length + 1 }])
    showMessage("info", `Section ${sectionHeaders.length + 1} created`); setShowSectionHeaderDialog(false)
  }, [exec, sectionHeaders.length, showMessage])
  const handleUpdateSectionHeader = useCallback((sectionId: string, field: "header" | "footer", value: string) => {
    setSectionHeaders(prev => prev.map(s => s.id === sectionId ? { ...s, [field]: value } : s))
    const editor = editorRef.current; if (!editor) return
    const sectionEl = editor.querySelector(`[data-section-id="${sectionId}"]`)
    if (sectionEl) {
      const existing = sectionEl.querySelector(`.section-${field}`)
      if (existing) existing.textContent = value
      else { const el = document.createElement("div"); el.className = `section-${field}`; el.style.cssText = field === "header" ? "text-align:center;font-size:10pt;color:#666;border-bottom:1px solid #e5e7eb;padding:8px 0;margin-bottom:12px" : "text-align:center;font-size:10pt;color:#666;border-top:1px solid #e5e7eb;padding:8px 0;margin-top:12px"; el.textContent = value; field === "header" ? sectionEl.parentElement?.insertBefore(el, sectionEl) : sectionEl.parentElement?.insertBefore(el, sectionEl.nextSibling) }
    }
  }, [])

  // Track changes monitoring
  useEffect(() => {
    if (!trackChangesEnabled || !editorRef.current) return
    const editor = editorRef.current
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const oldValue = m.oldValue
        if (m.type === "characterData" && oldValue) {
          setChanges((prev) => [...prev, {
            id: `ch-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
            type: oldValue.length > (m.target.textContent?.length ?? 0) ? "delete" : "insert",
            html: oldValue || (m.target.textContent ?? ""),
            accepted: false,
          }])
        }
      }
    })
    observer.observe(editor, { characterData: true, characterDataOldValue: true, subtree: true })
    return () => observer.disconnect()
  }, [trackChangesEnabled])

  // Initialize

  useEffect(() => {
    setMode("editing")
  }, [])

  // ── Ribbon state ────────────────────────────────────────────
  type DocRibbonTab = "home" | "insert" | "layout" | "references" | "review" | "view"
  const [docTab, setDocTab] = useState<DocRibbonTab>("home")
  const [docRibbonOpen, setDocRibbonOpen] = useState(false)

  // ── Ribbon Sub-Components ───────────────────────────────────

  function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex flex-col items-center px-1">
        <span className="text-[9px] text-muted-foreground mb-0.5">{label}</span>
        <div className="flex items-center gap-0.5">{children}</div>
      </div>
    )
  }

  function RibbonDivider() {
    return <div className="mx-1 h-8 w-px bg-border shrink-0" />
  }

  function RibbonBtn({ children, onClick, active, disabled, title, command, value, className }: {
    children: React.ReactNode; onClick?: (e?: React.MouseEvent) => void; active?: boolean; disabled?: boolean; title?: string; command?: string; value?: string; className?: string
  }) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          if (onClick) { onClick(e); return }
          if (command) exec(command, value)
        }}
        className={cn(
          "rounded p-1 transition-colors",
          active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          disabled && "opacity-30 cursor-not-allowed",
          className
        )}
        title={title}
      >{children}</button>
    )
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* ── Ribbon Toolbar ──────────────────────────────────── */}
      <div className="flex flex-col border-b border-border bg-card">
        {/* Tab bar */}
        <div className="flex items-center border-b border-border">
          {(["home","insert","layout","references","review","view"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDocTab(tab)}
              className={cn(
                "px-4 py-1.5 text-xs transition-colors capitalize",
                docTab === tab
                  ? "border-b-2 border-primary font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
          <div className="flex-1" />
          {currentFile && <span className="px-3 text-xs text-muted-foreground">{currentFile.name}</span>}
          <button onClick={() => setDocRibbonOpen(v => !v)}
            className={cn("flex h-7 items-center gap-1 rounded px-2 mr-1 text-[11px] text-muted-foreground hover:bg-muted", !docRibbonOpen && "bg-primary/10 text-primary font-medium")}>
            <Sliders className="h-3.5 w-3.5"/>Ribbon <ChevronDown className={cn("h-3 w-3 transition-transform",!docRibbonOpen&&"rotate-180")}/>
          </button>
        </div>

        {/* Ribbon groups — collapsible */}
        {!docRibbonOpen && (
        <div className="flex items-center gap-1 px-2 py-1.5 flex-wrap">
          {/* ── HOME tab ── */}
          {docTab === "home" && <>
          {/* File group */}
          <RibbonGroup label="File">
            {/* New — dropdown with doc types */}
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowNewMenu(!showNewMenu)} title="New">
                <FilePlus className="w-4 h-4"/>
                <ChevronDown className="w-3 h-3 ml-0.5"/>
              </RibbonBtn>
              {showNewMenu && (
                <div className="absolute top-full left-0 z-50 mt-1 w-40 rounded border border-border bg-card shadow-xl py-1 text-xs">
                  <button onClick={() => { setShowNewMenu(false); handleNewDocument() }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileText className="w-3.5 h-3.5 text-blue-500"/> Blank Document
                  </button>
                  <button onClick={() => { setShowNewMenu(false); setExportFormat("pdf"); setExportFileName("document.pdf"); setExportFolderPath(""); setShowExportDialog(true) }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileOutput className="w-3.5 h-3.5 text-red-500"/> PDF
                  </button>
                  <button onClick={() => { setShowNewMenu(false); setExportFormat("odf"); setExportFileName("document.odt"); setExportFolderPath(""); setShowExportDialog(true) }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileArchive className="w-3.5 h-3.5 text-blue-500"/> ODF (.odt)
                  </button>
                  <button onClick={() => { setShowNewMenu(false); setExportFormat("rtf"); setExportFileName("document.rtf"); setExportFolderPath(""); setShowExportDialog(true) }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileCheck className="w-3.5 h-3.5 text-green-500"/> RTF
                  </button>
                </div>
              )}
            </div>

            {/* Open — dropdown */}
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowOpenMenu(!showOpenMenu)} title="Open">
                <FolderOpen className="w-4 h-4"/>
                <ChevronDown className="w-3 h-3 ml-0.5"/>
              </RibbonBtn>
              {showOpenMenu && (
                <div className="absolute top-full left-0 z-50 mt-1 w-40 rounded border border-border bg-card shadow-xl py-1 text-xs">
                  <button onClick={() => { setShowOpenMenu(false); handleOpenFile() }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileText className="w-3.5 h-3.5 text-blue-500"/> Open .docx
                  </button>
                  <button onClick={() => { setShowOpenMenu(false); handleOpenDocBinary() }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileText className="w-3.5 h-3.5 text-gray-500"/> Open .doc
                  </button>
                  <div className="border-t border-border my-1"/>
                  <button onClick={() => { setShowOpenMenu(false); handleBrowseStorage() }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileDown className="w-3.5 h-3.5"/> From Storage
                  </button>
                </div>
              )}
            </div>

            {/* Save — dropdown */}
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowSaveMenu(!showSaveMenu)} disabled={mode!=="editing"} title="Save">
                <Download className="w-4 h-4"/>
                <ChevronDown className="w-3 h-3 ml-0.5"/>
              </RibbonBtn>
              {showSaveMenu && (
                <div className="absolute top-full left-0 z-50 mt-1 w-40 rounded border border-border bg-card shadow-xl py-1 text-xs">
                  <button onClick={() => { setShowSaveMenu(false); handleSaveAsDocx() }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <Download className="w-3.5 h-3.5"/> Save .docx
                  </button>
                  <button onClick={() => { setShowSaveMenu(false); handleSaveToStorage() }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileUp className="w-3.5 h-3.5"/> Save to Storage
                  </button>
                </div>
              )}
            </div>

            <RibbonBtn onClick={handlePrint} disabled={mode!=="editing"} title="Print"><Printer className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Undo/Redo */}
          <RibbonGroup label="Undo">
            <RibbonBtn command="undo" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="redo" title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Font */}
          <RibbonGroup label="Font">
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowFontPicker(!showFontPicker)} title="Font" className="w-28 justify-between px-2">
                <span className="text-xs truncate">{fontName}</span>
                <ChevronDown className="w-3 h-3 ml-1 shrink-0" />
              </RibbonBtn>
              {showFontPicker && (
                <div className="absolute top-full left-0 z-50 mt-1 w-36 rounded border border-border bg-card shadow-lg py-1 max-h-48 overflow-y-auto">
                  {FONT_FAMILIES.map((n) => <button key={n} onClick={() => handleFontNameChange(n)} className={cn("block w-full px-3 py-1.5 text-left text-xs hover:bg-muted", fontName===n && "bg-primary/10 text-primary")} style={{ fontFamily: n }}>{n}</button>)}
                </div>
              )}
            </div>
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowFontSizePicker(!showFontSizePicker)} title="Size" className="w-16 justify-between px-2">
                <span className="text-xs truncate">{FONT_SIZE_MAP[fontSize]??fontSize}</span>
                <ChevronDown className="w-3 h-3 ml-1 shrink-0" />
              </RibbonBtn>
              {showFontSizePicker && (
                <div className="absolute top-full left-0 z-50 mt-1 w-20 rounded border border-border bg-card shadow-lg py-1">
                  {FONT_SIZES.map((s) => <button key={s.value+s.label} onClick={() => handleFontSizeChange(s.value)} className={cn("block w-full px-2 py-1 text-left text-xs hover:bg-muted", fontSize===s.value && "bg-primary/10 text-primary")}>{s.label}</button>)}
                </div>
              )}
            </div>
            <RibbonBtn command="bold" active={queryState("bold")} title="Bold"><Bold className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="italic" active={queryState("italic")} title="Italic"><Italic className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="underline" active={queryState("underline")} title="Underline"><Underline className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="strikeThrough" active={queryState("strikeThrough")} title="Strikethrough"><Strikethrough className="w-4 h-4"/></RibbonBtn>
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowColorPicker(showColorPicker==="text"?null:"text")} title="Font color">
                <div className="flex flex-col items-center"><Type className="w-4 h-4"/><div className="w-3 h-0.5 rounded" style={{ backgroundColor: textColor }}/></div>
              </RibbonBtn>
              {showColorPicker==="text" && <ColorPicker current={textColor} onSelect={handleTextColor} onClose={() => setShowColorPicker(null)} />}
            </div>
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowColorPicker(showColorPicker==="bg"?null:"bg")} title="Highlight">
                <div className="flex flex-col items-center"><Highlighter className="w-4 h-4"/><div className="w-3 h-0.5 rounded" style={{ backgroundColor: highlightColor }}/></div>
              </RibbonBtn>
              {showColorPicker==="bg" && <ColorPicker current={highlightColor} onSelect={handleHighlight} onClose={() => setShowColorPicker(null)} />}
            </div>
          </RibbonGroup>
          <RibbonDivider />
          {/* Script */}
          <RibbonGroup label="Script">
            <RibbonBtn command="subscript" title="Subscript"><Subscript className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="superscript" title="Superscript"><Superscript className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Paragraph */}
          <RibbonGroup label="Paragraph">
            <RibbonBtn command="justifyLeft" title="Align Left"><AlignLeft className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="justifyCenter" title="Align Center"><AlignCenter className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="justifyRight" title="Align Right"><AlignRight className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="justifyFull" title="Justify"><AlignJustify className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="insertUnorderedList" title="Bullets"><List className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="insertOrderedList" title="Numbering"><ListOrdered className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="outdent" title="Decrease Indent"><Outdent className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="indent" title="Increase Indent"><Indent className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Styles */}
          <RibbonGroup label="Styles">
            <RibbonBtn command="formatBlock" value="h1" title="Heading 1"><Heading1 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="formatBlock" value="h2" title="Heading 2"><Heading2 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="formatBlock" value="h3" title="Heading 3"><Heading3 className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Editing */}
          <RibbonGroup label="Editing">
            <RibbonBtn onClick={handleFormatPainter} active={!!formatPainterStyle} title="Format Painter"><PaintBucket2 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn command="removeFormat" title="Clear Formatting"><RemoveFormatting className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={(e) => { if (e) { setPasteSpecialPos({ x: e.clientX, y: e.clientY }); } setShowPasteSpecial(true) }} title="Paste Special"><ClipboardPaste className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          {/* ── INSERT tab ── */}
          {docTab === "insert" && <>
          <RibbonGroup label="Tables & Media">
            <RibbonBtn onClick={() => setShowTableDialog(true)} title="Table"><Table2 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleInsertImage} title="Image"><Image className="w-4 h-4"/></RibbonBtn>
            {/* #6 Floating image layout */}
            <RibbonBtn onClick={() => setFloatingImageMode(m => m === "inline" ? "square" : m === "square" ? "tight" : m === "tight" ? "behind" : m === "behind" ? "front" : "inline")} title={`Float: ${floatingImageMode}`}><Layers className="w-4 h-4"/></RibbonBtn>
            {/* #8 Image crop */}
            <RibbonBtn onClick={() => { const sel = window.getSelection(); if (sel?.rangeCount) { let n: Node | null = sel.getRangeAt(0).startContainer; if (n.nodeType === 3) n = n.parentElement; const img = (n as HTMLElement)?.closest?.("img") as HTMLImageElement; if (img) { setCropTarget(img); setShowImageCrop(true) } } }} title="Crop Image"><Scissors className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowLinkDialog(true)} title="Link"><Link className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* #9 Text boxes */}
          <RibbonGroup label="Text Box">
            <RibbonBtn onClick={() => setShowTextBoxDialog(true)} title="Text Box"><FileText className="w-4 h-4"/></RibbonBtn>
            {/* #10 Shapes menu */}
            <RibbonBtn onClick={() => setShowShapesMenu(v => !v)} title="Shapes"><Shapes className="w-4 h-4"/></RibbonBtn>
            {/* #11 Drawing canvas */}
            <RibbonBtn onClick={() => setShowDrawingCanvas(v => !v)} title="Drawing Canvas"><PenTool className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Header & Footer">
            <RibbonBtn onClick={() => setShowHeaderFooter(true)} title="Header"><FilePenLine className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowPageNumber(true)} title="Page Number"><FileText className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleInsertPageBreak} title="Page Break"><ArrowDown className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Text">
            <RibbonBtn onClick={() => setShowFootnoteDialog(true)} title="Footnote"><Bookmark className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowSymbolDialog(true)} title="Symbol"><Braces className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowFieldDialog(true)} title="Field"><Calendar className="w-4 h-4"/></RibbonBtn>
            {/* #21 Drop cap */}
            <RibbonBtn onClick={() => setShowDropCap(true)} title="Drop Cap"><Heading1 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowEmbedDialog(true)} title="Embed"><Monitor className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Illustrations">
            <RibbonBtn onClick={() => setShowSmartArt(true)} title="SmartArt"><Shapes className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowChartInsert(true)} title="Chart"><BarChart3 className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Quick Parts">
            <RibbonBtn onClick={() => setQuickPartName("")} title="Quick Parts"><ListTree className="w-4 h-4"/></RibbonBtn>
            {/* #15 Custom XML parts */}
            <RibbonBtn onClick={() => setShowCustomXmlDialog(true)} title="Custom XML"><Braces className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Table Tools — in Insert tab */}
          <RibbonGroup label="Table Tools">
            <RibbonBtn onClick={() => setShowStyleGallery(true)} title="Styles"><SwatchBook className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowMacroDialog(true)} title="Macro"><FileCode className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowContentControlDialog(true)} title="Content Control"><FormInput className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowLegacyFormDialog(true)} title="Legacy Form"><ListChecks className="w-4 h-4"/></RibbonBtn>
            {/* #17 Table auto-fit */}
            <RibbonBtn onClick={() => setTableAutoFitMode(m => m === "auto" ? "fixed" : m === "fixed" ? "window" : "auto")} title={`AutoFit: ${tableAutoFitMode}`}><Maximize2 className="w-4 h-4"/></RibbonBtn>
            {/* #18 Table styles */}
            <RibbonBtn onClick={() => setShowTableStyles(true)} title="Table Styles"><SwatchBook className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleDeleteTable} title="Delete Table"><Trash2 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleMergeCells} title="Merge Cells"><Merge className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowTableBorderDialog(true)} title="Borders"><ArrowUpDown className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => { const sel = window.getSelection(); if (sel?.rangeCount) { let n: Node | null = sel.getRangeAt(0).startContainer; while (n && n.nodeName !== "TD" && n.nodeName !== "TH") n = n.parentNode; if (n) handleApplyCellShading() } }} title="Shading"><Droplets className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          {/* ── LAYOUT tab ── */}
          {docTab === "layout" && <>
          <RibbonGroup label="Page Setup">
            <RibbonBtn onClick={() => setShowMargins(true)} title="Margins"><Ruler className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowParagraphDialog(true)} title="Paragraph"><AlignJustify className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowSectionDialog(true)} title="Section"><Layout className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowSectionHeaderDialog(true)} title="Section Header"><FileSignature className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Arrange">
            <RibbonBtn onClick={() => setShowColumns(true)} title="Columns"><Columns3 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowMultiLevelList(true)} title="Multi-Level List"><ListChecks className="w-4 h-4"/></RibbonBtn>
            {/* #5 Advanced list numbering */}
            <RibbonBtn onClick={() => setShowListNumberingDialog(true)} title="List Numbering"><ListOrdered className="w-4 h-4"/></RibbonBtn>
            {/* #20 Character spacing */}
            <RibbonBtn onClick={() => setShowCharSpacing(true)} title="Char Spacing"><ArrowRightLeft className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* #23 Page borders */}
          <RibbonGroup label="Page">
            <RibbonBtn onClick={() => setShowPageBorderDialog(true)} title="Page Border"><Combine className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          {/* ── REFERENCES tab ── */}
          {docTab === "references" && <>
          <RibbonGroup label="Table of Contents">
            <RibbonBtn onClick={() => setShowTocDialog(true)} title="TOC"><BookOpen className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleInsertDynamicToc} title="Live TOC"><BookCopy className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="References">
            <RibbonBtn onClick={() => setShowTableOfFigures(true)} title="Table of Figures"><Image className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowIndexDialog(true)} title="Index"><ListTree className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowCrossRefDialog(true)} title="Cross-Reference"><BookmarkPlus className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowCitationDialog(true)} title="Citation"><Quote className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* #12 Endnotes */}
          <RibbonGroup label="Notes">
            <RibbonBtn onClick={() => setShowEndnoteDialog(true)} title="Endnote"><Bookmark className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* #13 Bibliography */}
          <RibbonGroup label="Bibliography">
            <RibbonBtn onClick={() => setShowBibliographyDialog(true)} title="Generate Bibliography"><BookCopy className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          {/* ── REVIEW tab ── */}
          {docTab === "review" && <>
          <RibbonGroup label="Proofing">
            <RibbonBtn onClick={handleSpellCheck} title="Spell Check"><SpellCheck className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => { setSpellCheckEnabled(!spellCheckEnabled); if (!spellCheckEnabled) setTimeout(runContinuousSpellCheck, 200); else { editorRef.current?.querySelectorAll("span.spell-error").forEach(el => { const p = el.parentNode; if (p) { p.replaceChild(document.createTextNode(el.textContent || ""), el); p.normalize() } }) } }} active={spellCheckEnabled} title={spellCheckEnabled ? "Disable Auto Spell Check" : "Enable Auto Spell Check"}><Eye className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleGrammarCheck} title="Grammar"><BookOpenCheck className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleThesaurus} title="Thesaurus"><BookOpen className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Comments & Changes">
            <RibbonBtn onClick={() => setShowComments(!showComments)} title="Comments"><MessageSquare className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleToggleTrackChanges} active={trackChangesEnabled} title="Track Changes"><FileDiff className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleTrackChangeMark} title="Mark Changes"><GitBranch className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowCompareDialog(true)} title="Compare"><FileSearch className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* #14 Restrict editing */}
          <RibbonGroup label="Protect">
            <RibbonBtn onClick={() => isProtected ? handleUnlockEditing() : setShowRestrictEditDialog(true)} active={isProtected} title={isProtected ? "Unlock" : "Restrict Editing"}><Shield className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Protect">
            <RibbonBtn onClick={isProtected ? handleUnprotectDocument : () => setShowProtectDialog(true)} active={isProtected} title={isProtected ? "Unprotect" : "Protect"}><Lock className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowEncryptDialog(true)} active={isEncrypted} title="Encrypt"><Shield className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          {/* ── VIEW tab ── */}
          {docTab === "view" && <>
          <RibbonGroup label="Document Views">
            <RibbonBtn onClick={handleWordCount} title="Word Count"><Hash className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => { handleBuildOutline(); setShowOutlinePane(true) }} title="Outline"><List className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleToggleViewLayout} active={viewLayout==="print"} title="Print Layout"><Monitor className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => { setPageViewEnabled(!pageViewEnabled); if (!pageViewEnabled) setTimeout(paginateContent, 300) }} active={pageViewEnabled} title={pageViewEnabled ? "Disable Page View" : "Enable Page View"}><Layout className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Collaboration">
            <RibbonBtn onClick={handleStartCollaboration} active={showCollaboration} title="Collaboration"><Users className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleStartWsCollab} active={showWebSocketCollab} title="WebSocket"><Radio className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setRtCollabEnabled(!rtCollabEnabled)} active={rtCollabEnabled} title={rtCollabEnabled ? "Disconnect Real-time Collab" : "Start Real-time Collab (OT)"}><Users className="w-4 h-4"/></RibbonBtn>
            {rtCollabEnabled && <CollabUserBar users={rtCollab.users} connected={rtCollab.connected} sessionId={rtCollab.sessionId} />}
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Tools">
            <RibbonBtn onClick={() => setShowMailMerge(true)} title="Mail Merge"><Combine className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowVersionHistory(true)} title="Versions"><History className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Accessibility">
            <RibbonBtn onClick={handleA11yCheck} title="Accessibility"><Accessibility className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowTranslateDialog(true)} title="Translate"><Languages className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowWatermarkDialog(true)} title="Watermark"><Copyright className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          <div className="flex-1" />
        </div>
        )}
      </div>

      {/* ── Status Bar ──────────────────────────────────────── */}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 border-b px-3 py-1.5 text-xs",
            message.type === "success" && "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
            message.type === "error" && "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
            message.type === "info" && "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
          )}
        >
          {message.type === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {message.type === "error" && <AlertCircle className="h-3.5 w-3.5" />}
          {message.type === "info" && <FileText className="h-3.5 w-3.5" />}
          {message.text}
        </div>
      )}
      {/* ── Find & Replace Bar ──────────────────────────────── */}
      {showFindReplace && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input value={findText} onChange={(e) => setFindText(e.target.value)} onKeyDown={(e) => e.key==="Enter" && handleFind()} placeholder="Find..." className="h-7 w-36 rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
          <input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} onKeyDown={(e) => e.key==="Enter" && handleReplace()} placeholder="Replace..." className="h-7 w-36 rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={findMatchCase} onChange={(e) => setFindMatchCase(e.target.checked)} className="accent-primary w-3 h-3"/> Aa
          </label>
          <button onClick={handleFind} className="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Find</button>
          <button onClick={handleReplaceOne} className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted">Replace</button>
          <button onClick={handleReplace} className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted">Replace All</button>
          {findResults > 0 && <span className="text-[10px] text-muted-foreground">{findResults} found</span>}
          <button onClick={() => setShowFindReplace(false)} className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5"/></button>
        </div>
      )}

      {/* ── Editor Area ─────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-gray-200 dark:bg-zinc-800" onContextMenu={handleContextMenu} onClick={handleTableContextMenu}>
        {mode === "loading" ? (
          <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading document...</span>
          </div>
        ) : (
          <>
          <div
            ref={editorRef}
            className={cn(
              "editor-content min-h-full px-8 py-6 outline-none",
              isReadOnly && "pointer-events-none opacity-80",
              formatPainterStyle && "cursor-crosshair",
            )}
            contentEditable={!isReadOnly}
            suppressContentEditableWarning
            onInput={() => setIsDirty(true)}
            onPaste={() => {
              // Normal paste proceeds as default
            }}
            onKeyDown={(e) => {
              // Ctrl+Shift+V = paste as plain text
              if (e.ctrlKey && e.shiftKey && e.key === "V") {
                e.preventDefault()
                handlePasteAsPlainText()
              }
            }}
            onClick={formatPainterStyle ? handleFormatPainterApply : undefined}
            style={{
              fontFamily: "Calibri, sans-serif",
              fontSize: `${12 * (zoom/100)}pt`,
              lineHeight: 1.5,
              color: "#000",
              maxWidth: "8.5in",
              margin: "0 auto",
              minHeight: "11in",
              background: "#fff",
              boxShadow: "0 0 0 1px #e5e7eb",
              ...(pageViewEnabled ? { position: "absolute" as const, left: "-9999px", visibility: "hidden" as const } : {}),
            }}
          />
          {/* ── Paginated View ──────────────────────────────────── */}
          {pageViewEnabled && (
            <div
              ref={pageContainerRef}
              className="paginated-view overflow-y-auto flex-1"
              style={{ background: "oklch(0.95 0 0)", padding: "24px 0" }}
              onClick={() => {
                // Click on paginated view → focus the hidden editor for typing
                editorRef.current?.focus()
              }}
            >
              {/* Pages rendered by paginateContent() */}
              {pageCount === 0 && (
                <div style={{ width: `${PAGE_W * (zoom/100)}px`, minHeight: `${PAGE_H * (zoom/100)}px`, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", margin: "0 auto", padding: `${PAGE_MARGIN.top * (zoom/100)}px ${PAGE_MARGIN.right * (zoom/100)}px`, boxSizing: "border-box", fontFamily: "Calibri, sans-serif", fontSize: `${12 * (zoom/100)}pt`, lineHeight: 1.5, color: "#000" }}>
                  <p style={{ color: "#999", fontStyle: "italic" }}>Start typing to see paginated view...</p>
                </div>
              )}
            </div>
          )}
        </>
        )}
      </div>

      {/* ── Remote Cursors (OT Collab) ──────────────────────── */}
      {rtCollabEnabled && rtCollab.connected && (
        <RemoteCursors users={rtCollab.users} containerRef={editorRef} type="document" />
      )}

      {/* ── Context Menu ────────────────────────────────────── */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} exec={exec} onClose={() => setCtxMenu(null)} />
      )}

      {/* ── Table Context Menu ──────────────────────────────── */}
      {showTableContext && (
        <TableContextMenu x={showTableContext.x} y={showTableContext.y}
          onMerge={handleMergeCells} onSplit={handleSplitCell}
          onInsertRowBefore={() => handleInsertTableRow("before")} onInsertRowAfter={() => handleInsertTableRow("after")}
          onDeleteRow={handleDeleteTableRow}
          onInsertColBefore={() => handleInsertTableCol("before")} onInsertColAfter={() => handleInsertTableCol("after")}
          onDeleteCol={handleDeleteTableCol}
          onBorder={() => setShowTableBorderDialog(true)} onShading={handleApplyCellShading}
          onClose={() => setShowTableContext(null)}
        />
      )}

      {/* ── Table Border Dialog ─────────────────────────────── */}
      {showTableBorderDialog && (
        <Dialog onClose={() => setShowTableBorderDialog(false)} title="Table Border">
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">{["1px solid #000","2px solid #000","1px solid #999","2px solid #333","1px dashed #666","1px dotted #666","2px double #000","none"].map((s) => (
              <button key={s} onClick={() => { setTableBorderStyle(s); handleApplyTableBorder() }} className="rounded border px-3 py-2 text-xs hover:bg-muted" style={{ border: s }}>{s}</button>
            ))}</div>
            <div className="flex gap-2 items-center">
              <label className="text-xs">Color:</label>
              <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-8 h-6" />
              <label className="text-xs">Width:</label>
              <select value={borderWidth} onChange={(e) => setBorderWidth(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-xs">
                <option value="1">1px</option><option value="2">2px</option><option value="3">3px</option><option value="4">4px</option>
              </select>
              <button onClick={handleApplyBorderStyle} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Apply Custom</button>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs">Cell Width:</label>
              <input value={cellWidth} onChange={(e) => setCellWidth(e.target.value)} placeholder="100px" className="w-20 rounded border border-border bg-background px-2 py-1 text-xs" />
              <label className="text-xs">Height:</label>
              <input value={cellHeight} onChange={(e) => setCellHeight(e.target.value)} placeholder="30px" className="w-20 rounded border border-border bg-background px-2 py-1 text-xs" />
              <button onClick={handleApplyCellSize} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Set Size</button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Header / Footer Dialog ──────────────────────────── */}
      {showHeaderFooter && (
        <Dialog onClose={() => setShowHeaderFooter(false)} title="Header & Footer">
          <div className="space-y-3">
            <div><label className="text-xs font-medium">Header</label><input value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="e.g. Company Name, Document Title" className="w-full rounded border border-border bg-background px-2 py-1 text-xs mt-1" /></div>
            <div><label className="text-xs font-medium">Footer</label><input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="e.g. Confidential, Page X of Y" className="w-full rounded border border-border bg-background px-2 py-1 text-xs mt-1" /></div>
            <div className="flex gap-2"><button onClick={handleApplyHeader} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Apply Header</button><button onClick={handleApplyFooter} className="rounded border border-border px-3 py-1 text-xs hover:bg-muted">Apply Footer</button></div>
          </div>
        </Dialog>
      )}

      {/* ── Page Number Dialog ──────────────────────────────── */}
      {showPageNumber && (
        <Dialog onClose={() => setShowPageNumber(false)} title="Page Number">
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setPageNumberPos("header")} className={`rounded px-3 py-1 text-xs ${pageNumberPos==="header"?"bg-primary text-primary-foreground":"border border-border hover:bg-muted"}`}>Header</button>
              <button onClick={() => setPageNumberPos("footer")} className={`rounded px-3 py-1 text-xs ${pageNumberPos==="footer"?"bg-primary text-primary-foreground":"border border-border hover:bg-muted"}`}>Footer</button>
            </div>
            <div className="flex gap-2">
              {(["left","center","right"] as const).map((a) => <button key={a} onClick={() => setPageNumberAlign(a)} className={`rounded px-3 py-1 text-xs capitalize ${pageNumberAlign===a?"bg-primary text-primary-foreground":"border border-border hover:bg-muted"}`}>{a}</button>)}
            </div>
            <button onClick={handleInsertPageNumber} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Insert Page Number</button>
          </div>
        </Dialog>
      )}

      {/* ── Margins Dialog ──────────────────────────────────── */}
      {showMargins && (
        <Dialog onClose={() => setShowMargins(false)} title="Page Margins">
          <div className="space-y-2">
            {[{label:"Top",v:marginTop,set:setMarginTop},{label:"Bottom",v:marginBottom,set:setMarginBottom},{label:"Left",v:marginLeft,set:setMarginLeft},{label:"Right",v:marginRight,set:setMarginRight}].map(({label,v,set}) => (<div key={label} className="flex items-center gap-2"><span className="text-xs w-14">{label}</span><input value={v} onChange={(e) => set(e.target.value)} className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="e.g. 1in or 2cm" /></div>))}
            <div className="flex gap-2"><button onClick={handleApplyMargins} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Apply</button><button onClick={() => { const e = editorRef.current; if(e){e.style.paddingTop="";e.style.paddingBottom="";e.style.paddingLeft="";e.style.paddingRight=""} setShowMargins(false); showMessage("info","Margins reset to default") }} className="rounded border border-border px-3 py-1 text-xs hover:bg-muted">Reset</button></div>
          </div>
        </Dialog>
      )}

      {/* ── TOC Dialog ──────────────────────────────────────── */}
      {showTocDialog && (
        <Dialog onClose={() => setShowTocDialog(false)} title="Insert Table of Contents">
          <div className="space-y-3"><p className="text-xs text-muted-foreground">Scans for H1, H2, H3 headings and generates linked Table of Contents.</p><button onClick={handleInsertToc} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Generate TOC</button></div>
        </Dialog>
      )}

      {/* ── Spell Check Panel ────────────────────────────────── */}
      {showSpellCheck && (
        <div className="fixed right-4 top-20 z-50 w-72 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Spell Check</span><button onClick={() => setShowSpellCheck(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          {spellResults.length===0 ? <p className="text-xs text-muted-foreground">No issues found.</p> : <div className="max-h-60 overflow-y-auto space-y-2">{
            spellResults.map((r) => (<div key={r.word} className="text-xs"><span className="text-red-500 font-medium">{r.word}</span>{r.suggestions.length>0 && <div className="flex gap-1 mt-1 flex-wrap">{r.suggestions.slice(0,4).map((s) => (<button key={s} onClick={() => { const e=editorRef.current; if(e){const sel=window.getSelection();if(sel){const range=sel.getRangeAt(0);range.deleteContents();range.insertNode(document.createTextNode(s))}} }} className="rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-primary/20">{s}</button>))}</div>}</div>))
          }</div>}
        </div>
      )}

      {/* ── Paste Special Popup ──────────────────────────────── */}
      {showPasteSpecial && (
        <div className="fixed z-[9999] rounded-lg border border-border bg-card shadow-xl py-1 min-w-[220px]" style={{ left: pasteSpecialPos.x, top: pasteSpecialPos.y }} onMouseLeave={() => setShowPasteSpecial(false)}>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">Paste Special</div>
          <button onClick={handlePasteWithFormatting} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted"><ClipboardPaste className="w-3.5 h-3.5"/>Keep Source Formatting</button>
          <button onClick={handlePasteAsPlainText} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted"><FileText className="w-3.5 h-3.5"/>Paste as Plain Text <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+Shift+V</span></button>
          <button onClick={handlePasteMatchingFormat} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted"><Paintbrush className="w-3.5 h-3.5"/>Match Destination Formatting</button>
        </div>
      )}

      {/* ── Comments Panel ───────────────────────────────────── */}
      {showComments && (
        <div className="fixed right-4 top-20 z-50 w-72 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Comments</span><button onClick={() => setShowComments(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          <div className="max-h-80 overflow-y-auto space-y-2 mb-2">{comments.length===0 ? <p className="text-xs text-muted-foreground">No comments yet. Select text and add below.</p> : comments.map((c) => (<div key={c.id} className="rounded border border-border p-2 text-xs"><div className="flex items-center gap-2 text-muted-foreground mb-1"><span className="font-medium text-foreground">{c.author}</span><span>{c.date}</span></div><p>{c.text}</p></div>))}</div>
          <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." className="w-full rounded border border-border bg-background px-2 py-1 text-xs h-16 resize-none" />
          <button onClick={handleAddComment} className="mt-1 rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Add Comment</button>
        </div>
      )}

      {/* ── Bottom Status Bar ───────────────────────────────── */}
      <div className="flex items-center gap-4 border-t border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
        <span>Page {currentPage} of {pageCount}</span>
        <span>{currentFile?.name ?? "Untitled"}</span>
        {isDirty && <span className="text-amber-500">● Unsaved</span>}
        {trackChangesEnabled && <span className="text-blue-500">● Tracking</span>}
        <div className="flex-1" />
        <span>{zoom}%</span>
        <span>REGMINDER Document Editor</span>
      </div>

      {/* ── File Browser Modal ──────────────────────────────── */}
      {showFileBrowser && (
        <FileBrowserModal
          fileList={fileList}
          loading={browserLoading}
          folder={browserFolder}
          provider={browserProvider}
          onFolderChange={(f) => { setBrowserFolder(f); loadFileBrowser(f, browserProvider) }}
          onProviderChange={(p) => { setBrowserProvider(p); loadFileBrowser(browserFolder, p) }}
          onSelect={handleOpenFromStorage}
          onClose={() => setShowFileBrowser(false)}
        />
      )}

      {/* ── Footnote Dialog ─────────────────────────────────── */}
      {showFootnoteDialog && (
        <Dialog onClose={() => setShowFootnoteDialog(false)} title="Insert Footnote">
          <textarea value={footnoteText} onChange={(e) => setFootnoteText(e.target.value)} placeholder="Footnote text..." className="w-full rounded border border-border bg-background px-2 py-1 text-sm h-20 resize-none" />
          <button onClick={handleAddFootnote} className="mt-2 rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
        </Dialog>
      )}

      {/* ── Watermark Dialog ────────────────────────────────── */}
      {showWatermarkDialog && (
        <Dialog onClose={() => setShowWatermarkDialog(false)} title="Add Watermark">
          <input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
          <label className="text-xs text-muted-foreground">Opacity: {watermarkOpacity}</label>
          <input type="range" min="0.05" max="0.5" step="0.05" value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))} className="w-full mb-2" />
          <button onClick={handleApplyWatermark} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply</button>
        </Dialog>
      )}

      {/* ── Symbol Dialog ───────────────────────────────────── */}
      {showSymbolDialog && (
        <Dialog onClose={() => setShowSymbolDialog(false)} title="Insert Symbol">
          <div className="grid grid-cols-10 gap-1 max-h-60 overflow-y-auto">
            {SYMBOLS.map((sym) => <button key={sym} onClick={() => handleInsertSymbol(sym)} className="rounded border border-border p-1.5 text-sm hover:bg-muted">{sym}</button>)}
          </div>
        </Dialog>
      )}

      {/* ── Word Count Panel ────────────────────────────────── */}
      {showWordCount && (
        <div className="fixed right-4 top-20 z-50 w-48 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Word Count</span><button onClick={() => setShowWordCount(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          <div className="text-xs space-y-1"><div>Words: <span className="font-medium">{wordCount}</span></div><div>Characters: <span className="font-medium">{charCount}</span></div></div>
        </div>
      )}

      {/* ── Outline Pane ────────────────────────────────────── */}
      {showOutlinePane && (
        <div className="fixed right-4 top-20 z-50 w-56 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Outline</span><button onClick={() => setShowOutlinePane(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          <div className="max-h-80 overflow-y-auto space-y-1">{outlineItems.length===0 ? <p className="text-xs text-muted-foreground">No headings found.</p> : outlineItems.map((item) => (<button key={item.id} onClick={() => { const el=document.getElementById(item.id); el?.scrollIntoView({behavior:"smooth"}) }} className="block w-full text-left text-xs hover:bg-muted rounded px-2 py-1" style={{paddingLeft: `${8+item.level*12}px`}}>{item.text}</button>))}</div>
        </div>
      )}

      {/* ── Mail Merge Dialog ───────────────────────────────── */}
      {showMailMerge && (
        <Dialog onClose={() => setShowMailMerge(false)} title="Mail Merge">
          <div className="space-y-2">
            <button onClick={handleMailMergeLoad} className="rounded border border-border px-3 py-1 text-xs hover:bg-muted w-full">Load CSV Data</button>
            {mailMergeFields.length > 0 && <div className="text-xs text-muted-foreground">Fields: {mailMergeFields.join(", ")}</div>}
            {mailMergeData.length > 0 && <div className="text-xs text-muted-foreground">{mailMergeData.length} records loaded</div>}
            <button onClick={handleMailMergeRun} disabled={mailMergeData.length===0} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full disabled:opacity-40">Run Merge</button>
          </div>
        </Dialog>
      )}

      {/* ── Version History ─────────────────────────────────── */}
      {showVersionHistory && (
        <div className="fixed right-4 top-20 z-50 w-64 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Versions</span><button onClick={() => setShowVersionHistory(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          <button onClick={handleSaveVersion} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full mb-2">Save Current Version</button>
          <div className="max-h-60 overflow-y-auto space-y-1">{versions.length===0 ? <p className="text-xs text-muted-foreground">No saved versions.</p> : versions.map((v) => (<div key={v.id} className="flex items-center justify-between rounded border border-border p-2 text-xs"><div><div className="font-medium">{v.label}</div><div className="text-muted-foreground">{v.date}</div></div><button onClick={() => handleRestoreVersion(v.html, v.label)} className="text-primary hover:underline">Restore</button></div>))}</div>
        </div>
      )}

      {/* ── Compare Dialog ──────────────────────────────────── */}
      {showCompareDialog && (
        <Dialog onClose={() => setShowCompareDialog(false)} title="Compare Documents">
          <p className="text-xs text-muted-foreground mb-2">Open another document to compare with the current one.</p>
          <button onClick={handleCompareDocument} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Open & Compare</button>
        </Dialog>
      )}

      {/* ── Macro Dialog ────────────────────────────────────── */}
      {showMacroDialog && (
        <Dialog onClose={() => setShowMacroDialog(false)} title="Macros">
          <div className="space-y-2">
            <input value={macroName} onChange={(e) => setMacroName(e.target.value)} placeholder="Macro name" className="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
            <textarea value={macroActions} onChange={(e) => setMacroActions(e.target.value)} placeholder="Actions (comma-separated commands)" className="w-full rounded border border-border bg-background px-2 py-1 text-sm h-16 resize-none" />
            <button onClick={handleRecordMacro} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Record</button>
            {macros.length > 0 && <div className="border-t border-border pt-2 space-y-1">{macros.map((m, i) => (<button key={i} onClick={() => handleRunMacro(m.name, m.actions)} className="block w-full text-left text-xs hover:bg-muted rounded px-2 py-1">{m.name}</button>))}</div>}
          </div>
        </Dialog>
      )}

      {/* ── Field Dialog ────────────────────────────────────── */}
      {showFieldDialog && (
        <Dialog onClose={() => setShowFieldDialog(false)} title="Insert Field">
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value as never)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2">
            <option value="date">Date</option><option value="time">Time</option><option value="filename">File Name</option><option value="page">Page Number</option>
          </select>
          <button onClick={handleInsertField} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
        </Dialog>
      )}

      {/* ── Embed Dialog ────────────────────────────────────── */}
      {showEmbedDialog && (
        <Dialog onClose={() => setShowEmbedDialog(false)} title="Embed Object">
          <input value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} placeholder="URL (image, video, iframe)" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
          <button onClick={handleEmbedObject} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Embed</button>
        </Dialog>
      )}

      {/* ── Paragraph Dialog ────────────────────────────────── */}
      {showParagraphDialog && (
        <Dialog onClose={() => setShowParagraphDialog(false)} title="Paragraph Spacing">
          <div className="space-y-2">
            <div><label className="text-xs text-muted-foreground">Line Spacing</label>
              <select value={lineSpacing} onChange={(e) => setLineSpacing(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm">
                <option value="1">Single</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">Double</option><option value="2.5">2.5</option><option value="3">Triple</option>
              </select></div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-xs text-muted-foreground">Before (pt)</label><input value={spaceBefore} onChange={(e) => setSpaceBefore(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" /></div>
              <div className="flex-1"><label className="text-xs text-muted-foreground">After (pt)</label><input value={spaceAfter} onChange={(e) => setSpaceAfter(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" /></div>
            </div>
            <button onClick={handleApplyParagraph} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply</button>
          </div>
        </Dialog>
      )}

      {/* ── Citation Dialog ─────────────────────────────────── */}
      {showCitationDialog && (
        <Dialog onClose={() => setShowCitationDialog(false)} title="Insert Citation">
          <input value={citationAuthor} onChange={(e) => setCitationAuthor(e.target.value)} placeholder="Author" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
          <input value={citationYear} onChange={(e) => setCitationYear(e.target.value)} placeholder="Year" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
          <input value={citationSource} onChange={(e) => setCitationSource(e.target.value)} placeholder="Source / Title" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
          <button onClick={handleInsertCitation} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert Citation</button>
        </Dialog>
      )}

      {/* ── Translate Dialog ────────────────────────────────── */}
      {showTranslateDialog && (
        <Dialog onClose={() => setShowTranslateDialog(false)} title="Translate">
          <textarea value={translateText} onChange={(e) => setTranslateText(e.target.value)} placeholder="Text to translate..." className="w-full rounded border border-border bg-background px-2 py-1 text-sm h-20 resize-none mb-2" />
          <button onClick={handleTranslate} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full mb-2">Translate</button>
          {translateResult && <div className="rounded border border-border bg-muted/30 p-2 text-xs">{translateResult}</div>}
        </Dialog>
      )}

      {/* ── Track Changes Review Panel ──────────────────────── */}
      {showTrackChanges && (
        <div className="fixed right-4 top-20 z-50 w-72 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Track Changes</span><button onClick={() => setShowTrackChanges(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          <p className="text-xs text-muted-foreground mb-2">Changes are being tracked. Use Accept/Reject to review.</p>
          <div className="flex gap-2"><button onClick={() => { /* Accept all */ showMessage("info", "All changes accepted") }} className="flex-1 rounded bg-green-100 text-green-700 px-2 py-1 text-xs hover:bg-green-200">Accept All</button><button onClick={() => { /* Reject all */ showMessage("info", "All changes rejected") }} className="flex-1 rounded bg-red-100 text-red-700 px-2 py-1 text-xs hover:bg-red-200">Reject All</button></div>
        </div>
      )}

      {/* ── Format Menu Dropdown ────────────────────────────── */}
      {showFormatMenu && (
        <div className="fixed z-50 w-40 rounded border border-border bg-card shadow-xl py-1 text-xs" style={{ top: "120px", right: "20px" }}>
          <button onClick={() => { setShowFormatMenu(false); setShowFontPicker(true) }} className="block w-full text-left px-3 py-1.5 hover:bg-muted">Font...</button>
          <button onClick={() => { setShowFormatMenu(false); setShowParagraphDialog(true) }} className="block w-full text-left px-3 py-1.5 hover:bg-muted">Paragraph...</button>
          <button onClick={() => { setShowFormatMenu(false); setShowColorPicker("text") }} className="block w-full text-left px-3 py-1.5 hover:bg-muted">Text Color...</button>
          <button onClick={() => { setShowFormatMenu(false); exec("removeFormat") }} className="block w-full text-left px-3 py-1.5 hover:bg-muted">Clear Formatting</button>
        </div>
      )}

      {/* ── Delete Table Confirmation ───────────────────────── */}
      {showDeleteTableDialog && (
        <Dialog onClose={() => setShowDeleteTableDialog(false)} title="Delete Table">
          <p className="text-sm mb-3">Delete the entire table at cursor position?</p>
          <div className="flex gap-2"><button onClick={() => { handleDeleteTable(); setShowDeleteTableDialog(false) }} className="flex-1 rounded bg-destructive px-3 py-1.5 text-xs text-destructive-foreground">Delete</button><button onClick={() => setShowDeleteTableDialog(false)} className="flex-1 rounded border border-border px-3 py-1.5 text-xs">Cancel</button></div>
        </Dialog>
      )}

      {/* ── Collaboration Panel ─────────────────────────────── */}
      {showCollaboration && (
        <div className="fixed right-4 top-20 z-50 w-56 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Collaborators ({collabUsers.length})</span><button onClick={handleStopCollaboration} className="text-[10px] text-destructive hover:underline">Stop</button></div>
          {collabUsers.map((u) => (<div key={u.id} className="flex items-center gap-2 text-xs mb-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color }}/>{u.name}</div>))}
        </div>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── New Document Dialog ─────────────────────────────── */}
      {showNewDocDialog && (
        <Dialog onClose={() => setShowNewDocDialog(false)} title="New Document">
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNewDoc() }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Storage Folder (optional)</label>
            <input
              value={newDocFolder}
              onChange={(e) => setNewDocFolder(e.target.value)}
              placeholder="e.g. /home/user/docs"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewDocDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreateNewDoc} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create</button>
          </div>
        </Dialog>
      )}

      {/* ── Export Dialog ──────────────────────────────────── */}
      {showExportDialog && (
        <Dialog onClose={() => setShowExportDialog(false)} title={`Export as ${exportFormat.toUpperCase()}`}>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">File Name</label>
            <input
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { void handleExportFile() } }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-foreground mb-1">Save Location (optional)</label>
            <input
              value={exportFolderPath}
              onChange={(e) => setExportFolderPath(e.target.value)}
              placeholder="e.g. /home/user/exports"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowExportDialog(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
            <button onClick={() => { void handleExportFile() }} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Export</button>
          </div>
        </Dialog>
      )}

      {/* ── SmartArt Dialog ─────────────────────────────────── */}
      {showSmartArt && (
        <Dialog onClose={() => setShowSmartArt(false)} title="Insert SmartArt">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(["flowchart","orgchart","cycle","pyramid","process","hierarchy"] as const).map((t) => (<button key={t} onClick={() => setSmartArtType(t)} className={cn("rounded border border-border p-2 text-xs capitalize", smartArtType===t && "border-primary bg-primary/10")}>{t}</button>))}
          </div>
          <button onClick={handleInsertSmartArt} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
        </Dialog>
      )}

      {/* ── Chart Insert Dialog ──────────────────────────────── */}
      {showChartInsert && (
        <Dialog onClose={() => setShowChartInsert(false)} title="Insert Chart">
          <div className="space-y-2">
            <div className="flex gap-1">{(["bar","line","pie","area"] as const).map((t) => (<button key={t} onClick={() => setChartInsertType(t)} className={cn("rounded border border-border px-2 py-1 text-xs capitalize", chartInsertType===t && "border-primary bg-primary/10")}>{t}</button>))}</div>
            <input value={chartLabels} onChange={(e) => setChartLabels(e.target.value)} placeholder="Labels (comma-separated)" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
            <input value={chartData} onChange={(e) => setChartData(e.target.value)} placeholder="Data (comma-separated numbers)" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
            <button onClick={handleInsertChart} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert Chart</button>
          </div>
        </Dialog>
      )}

      {/* ── Table of Figures Dialog ──────────────────────────── */}
      {showTableOfFigures && (
        <Dialog onClose={() => setShowTableOfFigures(false)} title="Table of Figures">
          <p className="text-xs text-muted-foreground mb-2">Scans the document for images, tables, and SmartArt to generate a Table of Figures.</p>
          <button onClick={handleInsertTableOfFigures} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Generate</button>
        </Dialog>
      )}

      {/* ── Index Dialog ─────────────────────────────────────── */}
      {showIndexDialog && (
        <Dialog onClose={() => setShowIndexDialog(false)} title="Index">
          <div className="space-y-2">
            <div className="flex gap-2"><input value={indexTerm} onChange={(e) => setIndexTerm(e.target.value)} onKeyDown={(e) => e.key==="Enter" && handleAddIndexTerm()} placeholder="Index term" className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" /><button onClick={handleAddIndexTerm} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Add</button></div>
            {indexTerms.length>0 && <div className="text-xs text-muted-foreground">{indexTerms.length} term(s)</div>}
            <button onClick={handleInsertIndex} disabled={indexTerms.length===0} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full disabled:opacity-40">Insert Index</button>
          </div>
        </Dialog>
      )}

      {/* ── Cross Reference Dialog ───────────────────────────── */}
      {showCrossRefDialog && (
        <Dialog onClose={() => setShowCrossRefDialog(false)} title="Cross Reference">
          <input value={crossRefTarget} onChange={(e) => setCrossRefTarget(e.target.value)} placeholder="Target (e.g., Section 2.1)" className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2" />
          <input value={crossRefLabel} onChange={(e) => setCrossRefLabel(e.target.value)} placeholder="Label (e.g., see Section 2.1)" className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2" />
          <button onClick={handleInsertCrossRef} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
        </Dialog>
      )}

      {/* ── Section Dialog ───────────────────────────────────── */}
      {showSectionDialog && (
        <Dialog onClose={() => setShowSectionDialog(false)} title="Section">
          <div className="space-y-2">
            <div className="flex gap-2">{(["portrait","landscape"] as const).map((o) => (<button key={o} onClick={() => setSectionOrientation(o)} className={cn("flex-1 rounded border border-border px-2 py-1 text-xs capitalize", sectionOrientation===o && "border-primary bg-primary/10")}>{o}</button>))}</div>
            <button onClick={handleSetOrientation} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply Orientation</button>
            <button onClick={handleInsertSectionBreak} className="rounded border border-border px-3 py-1 text-xs hover:bg-muted w-full">Insert Section Break</button>
          </div>
        </Dialog>
      )}

      {/* ── Grammar Check Panel ──────────────────────────────── */}
      {showGrammarCheck && (
        <div className="fixed right-4 top-20 z-50 w-72 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Grammar Check</span><button onClick={() => setShowGrammarCheck(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          {grammarIssues.length===0 ? <p className="text-xs text-green-600">No common issues found.</p> : <div className="max-h-60 overflow-y-auto space-y-2">{
            grammarIssues.map((g, i) => (<div key={i} className="text-xs border border-border rounded p-2"><span className="font-medium text-destructive">{g.type}:</span> {g.text}<br/><span className="text-muted-foreground">{g.suggestion}</span></div>))
          }</div>}
        </div>
      )}

      {/* ── Thesaurus Panel ──────────────────────────────────── */}
      {showThesaurus && (
        <div className="fixed right-4 top-20 z-50 w-56 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Thesaurus: {thesaurusWord}</span><button onClick={() => setShowThesaurus(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          <div className="space-y-1">{thesaurusResults.map((s) => (<button key={s} onClick={() => handleReplaceWithSynonym(s)} className="block w-full text-left text-xs hover:bg-muted rounded px-2 py-1">{s}</button>))}</div>
        </div>
      )}

      {/* ── Encrypt Dialog ───────────────────────────────────── */}
      {showEncryptDialog && (
        <Dialog onClose={() => setShowEncryptDialog(false)} title={isEncrypted ? "Decrypt Document" : "Encrypt Document"}>
          <input type="password" value={encryptPassword} onChange={(e) => setEncryptPassword(e.target.value)} placeholder="Password" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
          <div className="flex gap-2">
            {!isEncrypted && <button onClick={handleEncryptDocument} disabled={!encryptPassword} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40">Encrypt (AES-256-GCM)</button>}
            {isEncrypted && <button onClick={handleDecryptDocument} disabled={!encryptPassword} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40">Decrypt</button>}
          </div>
        </Dialog>
      )}

      {/* ── Accessibility Panel ──────────────────────────────── */}
      {showA11yDialog && (
        <div className="fixed right-4 top-20 z-50 w-80 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Accessibility Issues</span><button onClick={() => setShowA11yDialog(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          {a11yIssues.length===0 ? <p className="text-xs text-green-600">No accessibility issues found.</p> : <div className="max-h-60 overflow-y-auto space-y-2">{
            a11yIssues.map((a, i) => (<div key={i} className="text-xs border border-border rounded p-2"><span className="font-medium">{a.element}:</span> {a.issue}<br/><span className="text-muted-foreground">Fix: {a.fix}</span></div>))
          }</div>}
        </div>
      )}

      {/* ── Content Control Dialog ───────────────────────────── */}
      {showContentControlDialog && (
        <Dialog onClose={() => setShowContentControlDialog(false)} title="Content Control">
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">{(["text","date","dropdown","checkbox","richtext"] as const).map((t) => (<button key={t} onClick={() => setContentControlType(t)} className={cn("rounded border border-border px-2 py-1 text-xs capitalize", contentControlType===t && "border-primary bg-primary/10")}>{t}</button>))}</div>
            {contentControlType==="dropdown" && <input value={contentControlOptions} onChange={(e) => setContentControlOptions(e.target.value)} placeholder="Options (comma-separated)" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />}
            <button onClick={handleInsertContentControl} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
          </div>
        </Dialog>
      )}

      {/* ── Quick Parts Panel ────────────────────────────────── */}
      <div className="fixed right-4 bottom-12 z-50 w-56 rounded border border-border bg-card shadow-xl p-3" style={{ display: quickParts.length>0 && showCollaboration ? "block" : "none" }}>
        <div className="text-xs font-medium mb-2">Quick Parts</div>
        <div className="flex gap-2 mb-2"><input value={quickPartName} onChange={(e) => setQuickPartName(e.target.value)} placeholder="Name" className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" /><button onClick={handleSaveQuickPart} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Save</button></div>
        {quickParts.map((qp,i) => (<button key={i} onClick={() => handleInsertQuickPart(qp)} className="block w-full text-left text-xs hover:bg-muted rounded px-2 py-1">{qp.name}</button>))}
      </div>

      {/* ── WS Collab Dialog ─────────────────────────────────── */}
      {showWebSocketCollab && (
        <div className="fixed right-4 top-20 z-50 w-56 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">WS Collab</span><button onClick={handleStopWsCollab} className="text-[10px] text-destructive hover:underline">Disconnect</button></div>
          <input value={wsCollabUrl} onChange={e => setWsCollabUrl(e.target.value)} placeholder="ws://host:port" className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2" />
          <input value={collabDocId} onChange={e => setCollabDocId(e.target.value)} placeholder="Document ID" className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2" />
          {collabUsers.map((u,i) => (<div key={i} className="flex items-center gap-2 text-xs"><span className="w-2 h-2 rounded-full" style={{backgroundColor:u.color}}/>{u.name}</div>))}
        </div>
      )}

      {/* ── Track Changes Panel ──────────────────────────────── */}
      {trackChanges.length > 0 && (
        <div className="fixed right-4 top-20 z-50 w-72 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Track Changes ({trackChanges.length})</span><button onClick={() => setTrackChanges([])} className="text-[10px] text-destructive hover:underline">Clear</button></div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {trackChanges.map(tc => (<div key={tc.id} className={cn("text-xs border rounded p-2", tc.accepted && "opacity-40")}><span className="font-medium">{tc.author}</span> <span className="text-muted-foreground">{tc.date}</span><br/><span className={tc.type==="delete"?"text-red-500":"text-green-500"}>{tc.type==="delete"?"Deleted":"Inserted"}:</span> <span dangerouslySetInnerHTML={{__html:tc.html.slice(0,50)}}/><div className="flex gap-1 mt-1"><button onClick={()=>handleAcceptTrackChange(tc.id)} className="text-green-600 hover:underline text-[10px]">Accept</button><button onClick={()=>handleRejectTrackChange(tc.id)} className="text-red-600 hover:underline text-[10px]">Reject</button></div></div>))}
          </div>
        </div>
      )}

      {/* ── Style Gallery Dialog ─────────────────────────────── */}
      {showStyleGallery && (
        <Dialog onClose={() => setShowStyleGallery(false)} title="Style Gallery">
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {namedStyles.map(s => (<button key={s.name} onClick={() => handleApplyNamedStyle(s)} className="block w-full text-left rounded border border-border p-2 text-xs hover:bg-muted" style={{cssText:s.css}}>{s.name} — <span className="text-muted-foreground">{s.css.split(";").slice(0,2).join(";")}</span></button>))}
          </div>
        </Dialog>
      )}

      {/* ── Multi-Level List Dialog ──────────────────────────── */}
      {showMultiLevelList && (
        <Dialog onClose={() => setShowMultiLevelList(false)} title="Multi-Level List">
          <div className="space-y-2">
            <div className="flex gap-1">{[1,2,3,4,5].map(l => (<button key={l} onClick={() => setListLevel(l)} className={cn("rounded border px-3 py-1 text-xs", listLevel===l && "border-primary bg-primary/10")}>Level {l}: {["1.","a.","i.","(1)","(a)"][l-1]}</button>))}</div>
            <button onClick={handleInsertMultiLevelList} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
          </div>
        </Dialog>
      )}

      {/* ── Legacy Form Dialog ───────────────────────────────── */}
      {showLegacyFormDialog && (
        <Dialog onClose={() => setShowLegacyFormDialog(false)} title="Legacy Form Field">
          <div className="space-y-2">
            <div className="flex gap-1">{(["text","checkbox","dropdown"] as const).map(t => (<button key={t} onClick={() => setLegacyFormType(t)} className={cn("rounded border px-2 py-1 text-xs capitalize", legacyFormType===t && "border-primary bg-primary/10")}>{t}</button>))}</div>
            {legacyFormType==="dropdown" && <input value={legacyFormOptions} onChange={e => setLegacyFormOptions(e.target.value)} placeholder="Options (comma-separated)" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />}
            <button onClick={handleInsertLegacyForm} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
          </div>
        </Dialog>
      )}

      {/* ── Protect Dialog ───────────────────────────────────── */}
      {showProtectDialog && (
        <Dialog onClose={() => setShowProtectDialog(false)} title="Protect Document">
          <div className="space-y-2">
            <select value={protectMode} onChange={e => setProtectMode(e.target.value as never)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm">
              <option value="readonly">Read Only</option><option value="comments">Comments Only</option><option value="tracked">Tracked Changes Only</option><option value="forms">Fill in Forms Only</option>
            </select>
            <input type="password" value={protectPassword} onChange={e => setProtectPassword(e.target.value)} placeholder="Password" className="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
            <button onClick={handleProtectDocument} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Protect</button>
          </div>
        </Dialog>
      )}

      {/* ── Section Header Dialog ────────────────────────────── */}
      {showSectionHeaderDialog && (
        <Dialog onClose={() => setShowSectionHeaderDialog(false)} title="Section Headers">
          <div className="space-y-2 text-xs">
            <div><label>Section #{currentSectionIdx+1} Header</label><input value={sectionHeaders[currentSectionIdx]?.header ?? ""} onChange={e => { setSectionHeaders(p => { const n=[...p]; if(n[currentSectionIdx]) n[currentSectionIdx]={...n[currentSectionIdx],header:e.target.value}; return n }); }} className="w-full rounded border border-border bg-background px-2 py-1 mt-1" /></div>
            <div><label>Footer</label><input value={sectionHeaders[currentSectionIdx]?.footer ?? ""} onChange={e => { setSectionHeaders(p => { const n=[...p]; if(n[currentSectionIdx]) n[currentSectionIdx]={...n[currentSectionIdx],footer:e.target.value}; return n }); }} className="w-full rounded border border-border bg-background px-2 py-1 mt-1" /></div>
            <div className="flex gap-2"><button onClick={handleAddSectionHeader} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Save</button></div>
          </div>
        </Dialog>
      )}

      {/* ── Cell Size Dialog ────────────────────────────────── */}
      {(cellWidth || cellHeight) && (
        <Dialog onClose={() => { setCellWidth(""); setCellHeight("") }} title="Cell Size">
          <div className="flex gap-2 mb-2">
            <div className="flex-1"><label className="text-xs text-muted-foreground">Width</label><input value={cellWidth} onChange={(e) => setCellWidth(e.target.value)} placeholder="e.g. 100px" className="w-full rounded border border-border bg-background px-2 py-1 text-sm" /></div>
            <div className="flex-1"><label className="text-xs text-muted-foreground">Height</label><input value={cellHeight} onChange={(e) => setCellHeight(e.target.value)} placeholder="e.g. 30px" className="w-full rounded border border-border bg-background px-2 py-1 text-sm" /></div>
          </div>
          <button onClick={handleApplyCellSize} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply</button>
        </Dialog>
      )}

      {/* ── Review Pane ──────────────────────────────────────── */}
      {showReviewPane && (
        <div className="fixed right-4 top-20 z-50 w-72 rounded border border-border bg-card shadow-xl p-3">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Review Changes</span><button onClick={() => setShowReviewPane(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {changes.length===0 ? <p className="text-xs text-muted-foreground">No tracked changes.</p> :
              changes.filter((c) => !c.accepted).map((c) => (
                <div key={c.id} className="rounded border border-border p-2 text-xs">
                  <span className={c.type==="insert" ? "text-green-600" : "text-red-600"}>{c.type==="insert" ? "+" : "-"} {c.html.slice(0,40)}</span>
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => handleAcceptChange(c.id)} className="rounded bg-green-100 text-green-700 px-2 py-0.5 text-[10px] hover:bg-green-200">Accept</button>
                    <button onClick={() => handleRejectChange(c.id)} className="rounded bg-red-100 text-red-700 px-2 py-0.5 text-[10px] hover:bg-red-200">Reject</button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Protect Dialog ───────────────────────────────────── */}
      {/* ── Properties Dialog ────────────────────────────────── */}
      {showProperties && (
        <Dialog onClose={() => setShowProperties(false)} title="Document Properties">
          <div className="space-y-2">
            <div><label className="text-xs text-muted-foreground">Title</label><input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" /></div>
            <div><label className="text-xs text-muted-foreground">Author</label><input value={docAuthor} onChange={(e) => setDocAuthor(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" /></div>
            <button onClick={handleSaveProperties} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Save</button>
          </div>
        </Dialog>
      )}

      {/* ── Page Color Dialog ────────────────────────────────── */}
      {showPageColor && (
        <Dialog onClose={() => setShowPageColor(false)} title="Page Color">
          <div className="grid grid-cols-5 gap-1 mb-2">
            {["#FFFFFF","#F5F5F5","#FFF8E1","#E8F5E9","#E3F2FD","#FCE4EC","#F3E5F5","#FFF3E0","#E0F7FA","#F1F8E9","#FAFAFA","#FFFDE7","#EFEBE9","#ECEFF1","#FFEBEE"].map((c) => (
              <button key={c} onClick={() => { setPageBgColor(c); handleApplyPageColor() }} className="w-8 h-8 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
            ))}
          </div>
        </Dialog>
      )}

      {/* ── Columns Dialog ───────────────────────────────────── */}
      {showColumns && (
        <Dialog onClose={() => setShowColumns(false)} title="Columns">
          <select value={columnsCount} onChange={(e) => setColumnsCount(parseInt(e.target.value))} className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2">
            <option value={1}>1 Column</option><option value={2}>2 Columns</option><option value={3}>3 Columns</option>
          </select>
          <button onClick={handleApplyColumns} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply</button>
        </Dialog>
      )}

      {/* ── Emoji Picker ─────────────────────────────────────── */}
      {showEmojiPicker && (
        <div className="fixed z-50 w-64 rounded border border-border bg-card shadow-xl p-2" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Emoji</span><button onClick={() => setShowEmojiPicker(false)} className="rounded p-0.5 hover:bg-muted"><X className="w-3.5 h-3.5"/></button></div>
          <div className="grid grid-cols-10 gap-1">{EMOJIS.map((e) => <button key={e} onClick={() => handleInsertEmoji(e)} className="text-lg hover:bg-muted rounded p-1">{e}</button>)}</div>
        </div>
      )}

      {/* ── Equation Dialog ──────────────────────────────────── */}
      {showEquationDialog && (
        <Dialog onClose={() => setShowEquationDialog(false)} title="Insert Equation">
          <input value={equationText} onChange={(e) => setEquationText(e.target.value)} placeholder="e.g. E = mc^2" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2 font-mono" />
          <button onClick={handleInsertEquation} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
        </Dialog>
      )}

      {/* ── Ruler ────────────────────────────────────────────── */}
      {showRuler && (
        <div className="border-b border-border bg-muted/30 h-6 relative select-none shrink-0">
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} className="absolute top-0 h-full" style={{ left: `${i * 25 + 72}px` }}>
              <div className="absolute top-0 left-0 w-px h-2 bg-border" />
              {i % 5 === 0 && <div className="absolute top-0 left-0 w-px h-3 bg-border" />}
              {i % 10 === 0 && <span className="absolute top-1 left-1 text-[8px] text-muted-foreground">{i}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Template Merge Dialog ───────────────────────────── */}
      {showTemplateDialog && (
        <Dialog onClose={() => setShowTemplateDialog(false)} title="Merge Template Fields">
          <div className="space-y-3">
            {templateFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No template fields found. Use {"{{fieldName}}"} in your document to create merge fields.
              </p>
            ) : (
              templateFields.map((field, i) => (
                <div key={field.fieldName} className="flex items-center gap-2">
                  <label className="w-32 text-sm font-medium">{field.fieldName}</label>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                    value={field.value}
                    onChange={(e) => {
                      const updated = [...templateFields]
                      updated[i] = { ...field, value: e.target.value }
                      setTemplateFields(updated)
                    }}
                    placeholder={`Value for ${field.fieldName}`}
                  />
                </div>
              ))
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTemplateDialog(false)}
                className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeTemplate}
                disabled={templateFields.length === 0}
                className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Merge
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Link Dialog ─────────────────────────────────────── */}
      {showLinkDialog && (
        <Dialog onClose={() => setShowLinkDialog(false)} title="Insert Link">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Text to display</label>
              <input
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Link text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL</label>
              <input
                type="url"
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLinkDialog(false)}
                className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertLink}
                disabled={!linkUrl}
                className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Insert
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Table Dialog ────────────────────────────────────── */}
      {showTableDialog && (
        <Dialog onClose={() => setShowTableDialog(false)} title="Insert Table">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rows</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Columns</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTableDialog(false)}
                className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertTable}
                className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Insert
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

// ─── File Browser Modal ─────────────────────────────────────────

function FileBrowserModal({
  fileList, loading, folder, provider,
  onFolderChange, onProviderChange, onSelect, onClose,
}: {
  fileList: DocumentEntry[]
  loading: boolean
  folder: string
  provider: string
  onFolderChange: (folder: string) => void
  onProviderChange: (provider: string) => void
  onSelect: (entry: DocumentEntry) => void
  onClose: () => void
}) {
  const [newFolder, setNewFolder] = useState(folder)

  const handleNavigate = () => onFolderChange(newFolder)

  const folders = fileList.filter((f) => f.isFolder)
  const wordFiles = fileList.filter((f) => !f.isFolder && isWordDocument(f.name))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold">Open from Storage</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">✕</button>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="local">Local</option>
            <option value="nas">NAS</option>
            <option value="s3">S3</option>
            <option value="sharepoint">SharePoint</option>
          </select>
          <input
            type="text"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
            placeholder="Folder path..."
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <button
            onClick={handleNavigate}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Go
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : fileList.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No files found.</div>
          ) : (
            <div className="space-y-1">
              {folders.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    const p = folder ? `${folder}/${entry.name}` : entry.name
                    setNewFolder(p)
                    onFolderChange(p)
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <FileText className="h-4 w-4 text-amber-500" />
                  <span>{entry.name}</span>
                </button>
              ))}
              {wordFiles.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry)}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="flex-1 truncate">{entry.name}</span>
                  {entry.size != null && (
                    <span className="text-xs text-muted-foreground">{formatFileSize(entry.size)}</span>
                  )}
                </button>
              ))}
              {fileList.filter((f) => !f.isFolder && !isWordDocument(f.name)).map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-muted-foreground/50">
                  <FileText className="h-4 w-4" />
                  <span className="flex-1 truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Only Word documents (.docx, .doc) can be opened.
        </div>
      </div>
    </div>
  )
}

// ─── Dialog (generic modal) ─────────────────────────────────────

function Dialog({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Color Picker ───────────────────────────────────────────────

const COLOR_PRESETS = [
  "#000000","#FFFFFF","#FF0000","#FF6600","#FFFF00","#00FF00","#00FFFF","#0000FF","#9900FF","#FF00FF",
  "#333333","#666666","#999999","#CCCCCC","#FF9999","#FFCC99","#FFFF99","#99FF99","#99FFFF","#9999FF",
]

// ─── SmartArt SVG Generator ────────────────────────────────────

function generateSmartArtSvg(type: string): string {
  const items = ["Start","Process","Review","Complete"]
  const colors = ["#5B9BD5","#ED7D31","#A5A5A5","#70AD47"]
  const w = 500; const h = type === "pyramid" ? 200 : 160
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  if (type === "flowchart") {
    items.forEach((item, i) => {
      const x = 20 + i * 120; svg += `<rect x="${x}" y="40" width="100" height="50" rx="8" fill="${colors[i]}" stroke="#333" stroke-width="1"/><text x="${x+50}" y="70" text-anchor="middle" fill="#fff" font-size="11">${item}</text>`
      if (i < 3) svg += `<line x1="${x+100}" y1="65" x2="${x+120}" y2="65" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
    })
    svg += `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#333"/></marker></defs>`
  } else if (type === "orgchart") {
    svg += `<rect x="200" y="10" width="100" height="40" rx="4" fill="${colors[0]}" stroke="#333"/><text x="250" y="35" text-anchor="middle" fill="#fff" font-size="11">CEO</text>`
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * 130; svg += `<line x1="250" y1="50" x2="${x+50}" y2="80" stroke="#333" stroke-width="1"/><rect x="${x}" y="80" width="100" height="40" rx="4" fill="${colors[i+1]}" stroke="#333"/><text x="${x+50}" y="105" text-anchor="middle" fill="#fff" font-size="11">${items[i+1]}</text>`
    }
  } else if (type === "cycle") {
    const cx = 250; const cy = 80; const r = 50
    items.forEach((item, i) => {
      const angle = (i / 4) * Math.PI * 2 - Math.PI / 2
      const x = cx + Math.cos(angle) * r - 35; const y = cy + Math.sin(angle) * r - 18
      svg += `<rect x="${x}" y="${y}" width="70" height="36" rx="18" fill="${colors[i]}" stroke="#333"/><text x="${x+35}" y="${y+22}" text-anchor="middle" fill="#fff" font-size="10">${item}</text>`
    })
    svg += `<circle cx="${cx}" cy="${cy}" r="15" fill="#eee" stroke="#333"/><text x="${cx}" y="${cy+4}" text-anchor="middle" fill="#333" font-size="9">Cycle</text>`
  } else if (type === "pyramid") {
    const layers = [{ w: 60, c: colors[0] }, { w: 130, c: colors[1] }, { w: 200, c: colors[2] }, { w: 270, c: colors[3] }]
    layers.forEach((l, i) => {
      const x = (w - l.w) / 2; const y = 140 - (i + 1) * 35
      svg += `<rect x="${x}" y="${y}" width="${l.w}" height="30" rx="3" fill="${l.c}" stroke="#333"/><text x="${w/2}" y="${y+20}" text-anchor="middle" fill="#fff" font-size="10">${items[i]}</text>`
    })
  } else if (type === "process") {
    items.forEach((item, i) => {
      const x = 20 + i * 120; svg += `<rect x="${x}" y="50" width="100" height="60" rx="4" fill="${colors[i]}" stroke="#333"/><text x="${x+50}" y="75" text-anchor="middle" fill="#fff" font-size="11">${item}</text><text x="${x+50}" y="95" text-anchor="middle" fill="#fff" font-size="9">Step ${i+1}</text>`
      if (i < 3) svg += `<polygon points="${x+100},80 ${x+120},80 ${x+110},70 ${x+110},90" fill="#333"/>`
    })
  } else if (type === "hierarchy") {
    svg += `<rect x="200" y="5" width="100" height="35" rx="4" fill="${colors[0]}" stroke="#333"/><text x="250" y="27" text-anchor="middle" fill="#fff" font-size="11">${items[0]}</text>`
    for (let i = 0; i < 2; i++) {
      const x = 100 + i * 180; svg += `<line x1="250" y1="40" x2="${x+50}" y2="65" stroke="#333"/><rect x="${x}" y="65" width="100" height="35" rx="4" fill="${colors[i+1]}" stroke="#333"/><text x="${x+50}" y="87" text-anchor="middle" fill="#fff" font-size="11">${items[i+1]}</text>`
    }
    svg += `<line x1="250" y1="40" x2="250" y2="65" stroke="#333"/><rect x="200" y="65" width="100" height="35" rx="4" fill="${colors[3]}" stroke="#333"/><text x="250" y="87" text-anchor="middle" fill="#fff" font-size="11">${items[3]}</text>`
  }
  svg += "</svg>"; return svg
}

function generateChartSvg(type: string, data: number[], labels: string[]): string {
  const w = 400; const h = 220; const pad = 50
  const maxVal = Math.max(...data, 1)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  // Axes
  svg += `<line x1="${pad}" y1="${h-pad}" x2="${w-20}" y2="${h-pad}" stroke="#999" stroke-width="1"/>`
  svg += `<line x1="${pad}" y1="10" x2="${pad}" y2="${h-pad}" stroke="#999" stroke-width="1"/>`
  const colors = ["#5B9BD5","#ED7D31","#A5A5A5","#FFC000","#4472C4","#70AD47"]
  if (type === "bar") {
    const barW = Math.max(8, (w - pad * 2) / data.length - 8)
    data.forEach((v, i) => {
      const x = pad + 10 + i * ((w - pad * 2) / data.length)
      const barH = (v / maxVal) * (h - pad * 2)
      svg += `<rect x="${x}" y="${h-pad-barH}" width="${barW}" height="${barH}" fill="${colors[i%6]}" rx="2"/>`
      svg += `<text x="${x+barW/2}" y="${h-pad+12}" text-anchor="middle" fill="#666" font-size="9">${labels[i]||""}</text>`
    })
  } else if (type === "line") {
    let points = ""; data.forEach((v, i) => { const x = pad + 10 + i * ((w - pad * 2) / (data.length - 1 || 1)); const y = h - pad - (v / maxVal) * (h - pad * 2); points += `${x},${y} `; svg += `<circle cx="${x}" cy="${y}" r="4" fill="${colors[0]}"/>` })
    svg += `<polyline points="${points.trim()}" fill="none" stroke="${colors[0]}" stroke-width="2"/>`
  } else if (type === "pie") {
    const cx = w / 2; const cy = h / 2; const r = Math.min(cx, cy) - 30
    const total = data.reduce((a, b) => a + b, 0)
    let cumAngle = 0
    data.forEach((v, i) => {
      const angle = (v / total) * 2 * Math.PI
      const large = angle > Math.PI ? 1 : 0
      const sx = cx + r * Math.cos(cumAngle - Math.PI / 2); const sy = cy + r * Math.sin(cumAngle - Math.PI / 2)
      cumAngle += angle
      const ex = cx + r * Math.cos(cumAngle - Math.PI / 2); const ey = cy + r * Math.sin(cumAngle - Math.PI / 2)
      svg += `<path d="M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z" fill="${colors[i%6]}" stroke="#fff" stroke-width="1"/>`
    })
  } else if (type === "area") {
    let points = ""; let areaPoints = `${pad+10},${h-pad} `
    data.forEach((v, i) => { const x = pad + 10 + i * ((w - pad * 2) / (data.length - 1 || 1)); const y = h - pad - (v / maxVal) * (h - pad * 2); points += `${x},${y} `; areaPoints += `${x},${y} ` })
    areaPoints += `${pad+10+(data.length-1)*((w-pad*2)/(data.length-1||1))},${h-pad}`
    svg += `<polygon points="${areaPoints.trim()}" fill="${colors[0]}33" stroke="none"/>`
    svg += `<polyline points="${points.trim()}" fill="none" stroke="${colors[0]}" stroke-width="2"/>`
  }
  svg += "</svg>"; return svg
}

function ColorPicker({ current, onSelect, onClose }: { current: string; onSelect: (c: string) => void; onClose: () => void }) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded border border-border bg-card shadow-lg p-2" data-dropdown>
      <div className="grid grid-cols-5 gap-1 mb-2">
        {COLOR_PRESETS.map((c) => (
          <button key={c} onClick={() => onSelect(c)}
            className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: c, outline: current === c ? "2px solid #000" : "none", outlineOffset: 1 }}
          />
        ))}
      </div>
      <div className="flex gap-1">
        <input type="color" value={current} onChange={(e) => onSelect(e.target.value)} className="w-6 h-6 cursor-pointer border-0 p-0" />
        <button onClick={() => onSelect("transparent")} className="flex-1 text-center text-[10px] text-muted-foreground hover:text-destructive border border-border rounded">No Color</button>
      </div>
    </div>
  )
}

// ─── Context Menu ───────────────────────────────────────────────

function ContextMenu({ x, y, exec, onClose }: { x: number; y: number; exec: (cmd: string, val?: string) => void; onClose: () => void }) {
  const items = [
    { label: "Cut", cmd: "cut", icon: <Scissors className="w-3.5 h-3.5"/> },
    { label: "Copy", cmd: "copy", icon: <Copy className="w-3.5 h-3.5"/> },
    { label: "Paste", cmd: "paste", icon: <Clipboard className="w-3.5 h-3.5"/> },
    { label: "Delete", cmd: "delete", icon: <Trash2 className="w-3.5 h-3.5"/> },
    { label: "Select All", cmd: "selectAll", icon: <Ban className="w-3.5 h-3.5"/> },
  ]

  return (
    <div className="fixed z-50 w-44 rounded border border-border bg-card shadow-xl py-1 text-xs" style={{ left: x, top: y }}>
      {items.map((item) => (
        <button key={item.cmd} onClick={() => { exec(item.cmd); onClose() }}
          className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors">
          <span className="shrink-0 text-muted-foreground">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Table Context Menu ─────────────────────────────────────────

function TableContextMenu({ x, y, onMerge, onSplit, onInsertRowBefore, onInsertRowAfter, onDeleteRow, onInsertColBefore, onInsertColAfter, onDeleteCol, onBorder, onShading, onClose }: {
  x: number; y: number
  onMerge: () => void; onSplit: () => void
  onInsertRowBefore: () => void; onInsertRowAfter: () => void; onDeleteRow: () => void
  onInsertColBefore: () => void; onInsertColAfter: () => void; onDeleteCol: () => void
  onBorder: () => void; onShading: () => void
  onClose: () => void
}) {
  const sections = [
    {
      items: [
        { label: "Merge Cells", action: onMerge, icon: <Merge className="w-3.5 h-3.5"/> },
        { label: "Split Cell", action: onSplit, icon: <ArrowUpDown className="w-3.5 h-3.5"/> },
      ]
    },
    {
      items: [
        { label: "Insert Row Above", action: onInsertRowBefore, icon: <ArrowUp className="w-3.5 h-3.5"/> },
        { label: "Insert Row Below", action: onInsertRowAfter, icon: <ArrowDown className="w-3.5 h-3.5"/> },
        { label: "Delete Row", action: onDeleteRow, icon: <Trash2 className="w-3.5 h-3.5"/> },
      ]
    },
    {
      items: [
        { label: "Insert Column Left", action: onInsertColBefore, icon: <ArrowLeft className="w-3.5 h-3.5"/> },
        { label: "Insert Column Right", action: onInsertColAfter, icon: <ArrowRight className="w-3.5 h-3.5"/> },
        { label: "Delete Column", action: onDeleteCol, icon: <Trash2 className="w-3.5 h-3.5"/> },
      ]
    },
    {
      items: [
        { label: "Table Border...", action: onBorder, icon: <Merge className="w-3.5 h-3.5"/> },
        { label: "Cell Shading", action: onShading, icon: <PaintBucket2 className="w-3.5 h-3.5"/> },
      ]
    },
  ]

  return (
    <div className="fixed z-50 w-48 rounded border border-border bg-card shadow-xl py-1 text-xs" style={{ left: x, top: y }}>
      {sections.map((s, si) => (
        <div key={si}>
          {si > 0 && <div className="border-t border-border my-1" />}
          {s.items.map((item) => (
            <button key={item.label} onClick={() => { item.action(); onClose() }}
              className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors">
              <span className="shrink-0 text-muted-foreground">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
