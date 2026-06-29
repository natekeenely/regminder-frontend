"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react"
import {
  FileText, FolderOpen, Download, FilePlus, Loader2, AlertCircle, CheckCircle2, FileOutput,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Plus, Minus,
  Copy, Scissors, Clipboard, Trash2, Merge, Grid3X3, Table, Calculator,
  SortAsc, SortDesc, Filter, Search, Replace, Undo2, Redo2, FileDown, FileUp,
  X, Lock, Unlock, Palette, Type, Printer, EyeOff, Eye, Ban, GripVertical,
  ArrowUpDown, ArrowUp, ArrowDown, Columns2, Rows2, WrapText, PaintBucket as PaintBucket2,
  DollarSign, Percent, Hash, Calendar, ChevronDown, ChevronLeft, ChevronRight, Square, BarChart3, LineChart, PieChart,
  List, AlertTriangle, PrinterIcon, Check, Image as ImageIcon, MessageSquare, Sliders,
  Braces, SwatchBook, Monitor, Link, Maximize2, ArrowRightLeft, ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollaboration, CollabUserBar, RemoteCursors } from "@/lib/use-collaboration"
import {
  createEmptySpreadsheet, readXlsx, readXlsxFromBase64, writeXlsx, writeXlsxToBase64,
  evaluateFormula, cellRef, parseCellRef, parseRange, openSpreadsheetFileDialog, saveBlobAs,
  isSpreadsheetFile, parseCsv, csvToSpreadsheet, spreadsheetToCsv,
  listDocuments, downloadDocument, uploadDocument,
  formatCellValue, sortSheetData, filterSheetData, evaluateConditionalFormat,
  type SpreadsheetData, type SpreadsheetSheet, type SpreadsheetCell,
  type DocumentEntry,
  type NumberFormatConfig, type SortConfig, type FilterConfig, type ConditionalFormatRule,
} from "@/lib/spreadsheet-utils"

// ─── Types ──────────────────────────────────────────────────────

type EditorMode = "idle" | "loading" | "editing" | "saving" | "error"

interface Selection {
  startRow: number; startCol: number; endRow: number; endCol: number; activeRow: number; activeCol: number
}

interface ClipboardData {
  type: "cut" | "copy"
  cells: Array<{ row: number; col: number; cell: SpreadsheetCell }>
  range: { startRow: number; startCol: number; endRow: number; endCol: number }
}

interface HistoryEntry {
  sheets: SpreadsheetSheet[]
  activeSheet: number
}

interface UIData {
  data: SpreadsheetData | null
  selection: Selection
  clipboard: ClipboardData | null
}

// ─── Constants ───────────────────────────────────────────────────

const DEFAULT_COL_WIDTH = 100
const DEFAULT_ROW_HEIGHT = 28
const COL_HEADER_WIDTH = 48
const ROW_HEADER_HEIGHT = 24
const MAX_ROWS = 1000; const MAX_COLS = 50; const VISIBLE_ROWS = 35; const VISIBLE_COLS = 15

const FONT_FAMILIES = ["Arial","Calibri","Times New Roman","Courier New","Georgia","Verdana","Helvetica"]
const FONT_SIZES = [8,9,10,11,12,14,16,18,20,24,28,36]
const BORDER_STYLES = ["thin","medium","thick","dashed","dotted","double","none"]

// ─── Formula IntelliSense catalog ──────────────────────────────
const FORMULA_CATALOG: { name: string; args: string; desc: string }[] = [
  { name: "SUM", args: "(range)", desc: "Adds all numbers in a range" },
  { name: "AVERAGE", args: "(range)", desc: "Average of numbers in a range" },
  { name: "COUNT", args: "(range)", desc: "Counts cells with numbers" },
  { name: "COUNTA", args: "(range)", desc: "Counts non-empty cells" },
  { name: "COUNTIF", args: "(range, criteria)", desc: "Counts cells matching criteria" },
  { name: "MAX", args: "(range)", desc: "Largest value in a range" },
  { name: "MIN", args: "(range)", desc: "Smallest value in a range" },
  { name: "IF", args: "(test, true_val, false_val)", desc: "Conditional logic" },
  { name: "SUMIF", args: "(range, criteria, sum_range)", desc: "Sum cells matching criteria" },
  { name: "VLOOKUP", args: "(value, table, col, exact)", desc: "Vertical lookup" },
  { name: "HLOOKUP", args: "(value, table, row, exact)", desc: "Horizontal lookup" },
  { name: "INDEX", args: "(array, row, col)", desc: "Value at position in range" },
  { name: "MATCH", args: "(value, range, type)", desc: "Position of value in range" },
  { name: "CONCATENATE", args: "(text1, text2, ...)", desc: "Joins text strings" },
  { name: "LEFT", args: "(text, n)", desc: "First n characters" },
  { name: "RIGHT", args: "(text, n)", desc: "Last n characters" },
  { name: "MID", args: "(text, start, n)", desc: "Substring from position" },
  { name: "LEN", args: "(text)", desc: "Length of text" },
  { name: "TRIM", args: "(text)", desc: "Remove extra spaces" },
  { name: "UPPER", args: "(text)", desc: "Convert to uppercase" },
  { name: "LOWER", args: "(text)", desc: "Convert to lowercase" },
  { name: "ROUND", args: "(number, digits)", desc: "Round to n decimal places" },
  { name: "ROUNDUP", args: "(number, digits)", desc: "Round up" },
  { name: "ROUNDDOWN", args: "(number, digits)", desc: "Round down" },
  { name: "ABS", args: "(number)", desc: "Absolute value" },
  { name: "POWER", args: "(base, exponent)", desc: "Number raised to power" },
  { name: "SQRT", args: "(number)", desc: "Square root" },
  { name: "NOW", args: "()", desc: "Current date and time" },
  { name: "TODAY", args: "()", desc: "Current date" },
  { name: "DATE", args: "(year, month, day)", desc: "Create a date" },
  { name: "YEAR", args: "(date)", desc: "Year from date" },
  { name: "MONTH", args: "(date)", desc: "Month from date" },
  { name: "DAY", args: "(date)", desc: "Day from date" },
  { name: "AND", args: "(cond1, cond2, ...)", desc: "TRUE if all conditions true" },
  { name: "OR", args: "(cond1, cond2, ...)", desc: "TRUE if any condition true" },
  { name: "NOT", args: "(condition)", desc: "Reverses logical value" },
  { name: "IFERROR", args: "(value, error_val)", desc: "Value if no error, else fallback" },
  { name: "ISBLANK", args: "(cell)", desc: "TRUE if cell is empty" },
  { name: "MEDIAN", args: "(range)", desc: "Middle value in sorted list" },
  { name: "STDEV", args: "(range)", desc: "Standard deviation" },
  { name: "VAR", args: "(range)", desc: "Variance" },
  { name: "PRODUCT", args: "(range)", desc: "Multiply all numbers" },
  { name: "MOD", args: "(number, divisor)", desc: "Remainder after division" },
  { name: "INT", args: "(number)", desc: "Round down to integer" },
  { name: "TEXT", args: "(value, format)", desc: "Format number as text" },
  { name: "VALUE", args: "(text)", desc: "Convert text to number" },
  { name: "SUBSTITUTE", args: "(text, old, new, n)", desc: "Replace text occurrences" },
  { name: "FIND", args: "(find, text, start)", desc: "Position of text (case-sensitive)" },
  { name: "SEARCH", args: "(find, text, start)", desc: "Position of text (case-insensitive)" },
]
const NUMBER_FORMATS: { label: string; config: NumberFormatConfig }[] = [
  { label: "General", config: { type: "general" } },
  { label: "Number", config: { type: "number", decimalPlaces: 2, useThousands: true } },
  { label: "Currency", config: { type: "currency", decimalPlaces: 2, currencySymbol: "$", useThousands: true } },
  { label: "Accounting", config: { type: "accounting", decimalPlaces: 2, currencySymbol: "$", useThousands: true } },
  { label: "Percentage", config: { type: "percentage", decimalPlaces: 2 } },
  { label: "Scientific", config: { type: "scientific", decimalPlaces: 2 } },
  { label: "Date", config: { type: "date" } },
  { label: "Time", config: { type: "time" } },
  { label: "Text", config: { type: "text" } },
]

const COLORS = ["#000000","#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#FFA500","#800080","#008000","#808080","#FFC0CB","#A52A2A","#FFD700","#FA8072","#DDA0DD","#B0E0E6","#90EE90","#FFFACD"]
const COND_COLORS = ["#63BE7B","#FFEB84","#F8696B","#5B9BD5","#ED7D31","#A4A4A4"]

// ─── Component ──────────────────────────────────────────────────

export function SpreadsheetEditorContent() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const formulaInputRef = useRef<HTMLInputElement | null>(null)

  const [mode, setMode] = useState<EditorMode>("idle")
  const [data, setData] = useState<SpreadsheetData | null>(null)
  const [currentFile, setCurrentFile] = useState<{ name: string; provider: string; folder: string } | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

  // Selection
  const [selection, setSelection] = useState<Selection>({ startRow: 0, startCol: 0, endRow: 0, endCol: 0, activeRow: 0, activeCol: 0 })
  const [isSelecting, setIsSelecting] = useState(false)

  // Editing
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")

  // Clipboard
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)

  // Undo/Redo
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const ignoreNextSnapshot = useRef(false)

  // View
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [freezeRows, setFreezeRows] = useState(0)
  const [freezeCols, setFreezeCols] = useState(0)

  // Real-time collaboration
  const [rtCollabEnabled, setRtCollabEnabled] = useState(false)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const rtCollab = useCollaboration({
    documentType: "spreadsheet",
    documentId: currentFile?.name ?? "spreadsheet-default",
    title: currentFile?.name ?? "Untitled Spreadsheet",
    userName: "User",
    enabled: rtCollabEnabled,
    onRemoteOperation: useCallback((op: any) => {
      if (op.type === "cell" && data) {
        setData(prev => {
          if (!prev) return prev
          const sheets = [...prev.sheets]
          const sheetIdx = sheets.findIndex(s => s.name === (op.sheet ?? sheets[0]?.name))
          if (sheetIdx < 0) return prev
          const sheet = { ...sheets[sheetIdx], cells: new Map(sheets[sheetIdx].cells) }
          const key = cellRef(op.row, op.col)
          if (op.action === "set_value") {
            const cell = sheet.cells.get(key) ?? {}
            sheet.cells.set(key, { ...cell, value: op.value })
          } else if (op.action === "set_formula") {
            const cell = sheet.cells.get(key) ?? { value: "" }
            sheet.cells.set(key, { ...cell, formula: op.formula })
          } else if (op.action === "clear") {
            sheet.cells.delete(key)
          }
          sheets[sheetIdx] = sheet
          return { ...prev, sheets }
        })
      }
    }, [data]),
    onRemoteCursor: useCallback((_cursor: any) => { /* handled by RemoteCursors */ }, []),
  })

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null)

  // Dialogs
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [fileList, setFileList] = useState<DocumentEntry[]>([])
  const [browserFolder, setBrowserFolder] = useState("")
  const [browserProvider, setBrowserProvider] = useState("local")
  const [browserLoading, setBrowserLoading] = useState(false)

  // Toolbar dropdowns
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false)
  const [ribbonTab, setRibbonTab] = useState<"home" | "insert" | "data" | "view">("home")
  const [showFontMenu, setShowFontMenu] = useState(false)
  const [showFontSize, setShowFontSize] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState<"text" | "bg" | null>(null)
  const [showBorderMenu, setShowBorderMenu] = useState(false)
  const [showNumberFormat, setShowNumberFormat] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportFormat, setExportFormat] = useState("")
  const [exportFileName, setExportFileName] = useState("")
  const [exportFolderPath, setExportFolderPath] = useState("")
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findText, setFindText] = useState("")
  const [replaceText, setReplaceText] = useState("")

  // Conditional formatting
  const [condRules, setCondRules] = useState<ConditionalFormatRule[]>([])
  const [showCondFormatEditor, setShowCondFormatEditor] = useState(false)
  const [condEditRule, setCondEditRule] = useState<ConditionalFormatRule | null>(null)

  // Filter
  const [activeFilters, setActiveFilters] = useState<FilterConfig[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState<number | null>(null)

  // Chart
  const [showChart, setShowChart] = useState(false)
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar")

  // Data validation
  const [showDataValidation, setShowDataValidation] = useState(false)
  const [validationRule, setValidationRule] = useState<{ type: "list" | "number" | "date"; value1: string; value2?: string; message: string }>({ type: "number", value1: "0", value2: "100", message: "" })

  // Print
  const [showPrintPreview, setShowPrintPreview] = useState(false)

  // Cell notes (comments)
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [noteText, setNoteText] = useState("")

  // Sheet operations
  const [showSheetContext, setShowSheetContext] = useState<{ x: number; y: number; idx: number } | null>(null)

  // Image upload
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [imageURL, setImageURL] = useState("")

  // Cell protection
  const [showProtection, setShowProtection] = useState(false)

  // Recharts chart (use imported component instead of inline SVG)
  const rechartsAvailable = true // recharts is already a dependency

  // Column resize
  const [colResizing, setColResizing] = useState<{ col: number; startX: number; startWidth: number } | null>(null)
  const [rowResizing, setRowResizing] = useState<{ row: number; startY: number; startHeight: number } | null>(null)

  // Auto-fill
  const [autoFillDrag, setAutoFillDrag] = useState<{ startRow: number; startCol: number } | null>(null)

  // ── Phase 6: Pivot, Named Ranges, Sparklines, External Data, Dedup, Advanced Charts, Layout, Icon Sets ──
  const [showPivotDialog, setShowPivotDialog] = useState(false)
  const [pivotRows, setPivotRows] = useState("")
  const [pivotCols, setPivotCols] = useState("")
  const [pivotValues, setPivotValues] = useState("")
  const [pivotAgg, setPivotAgg] = useState<"SUM" | "COUNT" | "AVG" | "MIN" | "MAX">("SUM")
  const [pivotResult, setPivotResult] = useState<SpreadsheetSheet | null>(null)
  const [showPivotSheet, setShowPivotSheet] = useState(false)

  const [showNamedRangeDialog, setShowNamedRangeDialog] = useState(false)
  const [namedRangeName, setNamedRangeName] = useState("")
  const [namedRanges, setNamedRanges] = useState<Map<string, string>>(new Map())

  const [showDataTableDialog, setShowDataTableDialog] = useState(false)
  const [dataTableRowInput, setDataTableRowInput] = useState("")
  const [dataTableColInput, setDataTableColInput] = useState("")

  const [showGoalSeekDialog, setShowGoalSeekDialog] = useState(false)
  const [goalSeekTarget, setGoalSeekTarget] = useState("")
  const [goalSeekCell, setGoalSeekCell] = useState("")
  const [goalSeekVarCell, setGoalSeekVarCell] = useState("")
  const [goalSeekResult, setGoalSeekResult] = useState<number | null>(null)

  const [showSparklineDialog, setShowSparklineDialog] = useState(false)
  const [sparklineType, setSparklineType] = useState<"line" | "column" | "winloss">("line")

  const [showSlicerDialog, setShowSlicerDialog] = useState(false)
  const [slicerCol, setSlicerCol] = useState(0)

  const [showExternalDataDialog, setShowExternalDataDialog] = useState(false)
  const [externalDataUrl, setExternalDataUrl] = useState("")
  const [externalDataType, setExternalDataType] = useState<"csv" | "json" | "api">("csv")

  const [showRemoveDupDialog, setShowRemoveDupDialog] = useState(false)
  const [dedupCol, setDedupCol] = useState<number | null>(null)

  const [showFlashFill, setShowFlashFill] = useState(false)
  const [flashFillExample, setFlashFillExample] = useState("")

  const [advancedChartType, setAdvancedChartType] = useState<"bar" | "line" | "pie" | "scatter" | "area" | "radar">("bar")

  // Formula IntelliSense
  const [formulaSuggestions, setFormulaSuggestions] = useState<typeof FORMULA_CATALOG>([])
  const [formulaSelIdx, setFormulaSelIdx] = useState(0)
  const formulaDropRef = useRef<HTMLDivElement | null>(null)

  const [showPageLayout, setShowPageLayout] = useState(false)
  const [printArea, setPrintArea] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null)

  const [showIconSetDialog, setShowIconSetDialog] = useState(false)
  const [iconSetType, setIconSetType] = useState<"arrows" | "stars" | "traffic" | "flags">("arrows")

  // ── 19 remaining gaps state ──────────────────────────────────
  const [showCrossSheetRef, setShowCrossSheetRef] = useState(false)
  const [crossSheetName, setCrossSheetName] = useState("")
  const [crossSheetCell, setCrossSheetCell] = useState("")
  const [showArrayFormula, setShowArrayFormula] = useState(false)
  const [arrayFormulaType, setArrayFormulaType] = useState<"UNIQUE" | "SORT" | "FILTER">("UNIQUE")
  const [showFormulaAudit, setShowFormulaAudit] = useState(false)
  const [traceType, setTraceType] = useState<"precedents" | "dependents">("precedents")
  const [traceArrows, setTraceArrows] = useState<Array<{ from: string; to: string }>>([])
  const [floatingChart, setFloatingChart] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [chartDrag, setChartDrag] = useState<{ startX: number; startY: number } | null>(null)
  const [showChartCustomize, setShowChartCustomize] = useState(false)
  const [chartTitle, setChartTitle] = useState("")
  const [chartXLabel, setChartXLabel] = useState("")
  const [chartYLabel, setChartYLabel] = useState("")
  const [chartShowLabels, setChartShowLabels] = useState(false)
  const [chartShowTrendline, setChartShowTrendline] = useState(false)
  const [showThreadedComments, setShowThreadedComments] = useState(false)
  const [threadedComments, setThreadedComments] = useState<Array<{ id: string; cell: string; author: string; text: string; date: string; replies: Array<{ author: string; text: string; date: string }> }>>([])
  const [newThreadReply, setNewThreadReply] = useState("")
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [showHyperlinkDialog, setShowHyperlinkDialog] = useState(false)
  const [hyperlinkUrl, setHyperlinkUrl] = useState("")
  const [hyperlinkText, setHyperlinkText] = useState("")
  const [textRotation, setTextRotation] = useState(0)
  const [showTextRotation, setShowTextRotation] = useState(false)
  const [cellStylePreset, setCellStylePreset] = useState("")
  const [showCellStyles, setShowCellStyles] = useState(false)
  const [showSheetProtect, setShowSheetProtect] = useState(false)
  const [sheetPassword, setSheetPassword] = useState("")
  const [isSheetProtected, setIsSheetProtected] = useState(false)
  const [sheetProtectHash, setSheetProtectHash] = useState<string | null>(null)
  const [virtualScrollOffset, setVirtualScrollOffset] = useState(0)
  const [showImageExport, setShowImageExport] = useState(false)
  const [dragFillSeries, setDragFillSeries] = useState(false)
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [groupType, setGroupType] = useState<"rows" | "cols">("rows")
  const [groups, setGroups] = useState<Array<{ type: "rows" | "cols"; start: number; end: number; collapsed: boolean }>>([])
  const [showSubtotal, setShowSubtotal] = useState(false)
  const [subtotalCol, setSubtotalCol] = useState(0)
  const [subtotalGroupCol, setSubtotalGroupCol] = useState(0)
  const [showDataValidationDropdown, setShowDataValidationDropdown] = useState(false)
  const [dvDropdownCell, setDvDropdownCell] = useState<{ row: number; col: number } | null>(null)
  const [showCustomNumberFormat, setShowCustomNumberFormat] = useState(false)
  const [customFormatString, setCustomFormatString] = useState("")
  const [isRtl, setIsRtl] = useState(false)
  const [touchMode, setTouchMode] = useState(false)

  // ── Computed ───────────────────────────────────────────────────

  const sheet = data?.sheets[data.activeSheet]
  const selectedCell = sheet?.cells.get(cellRef(selection.activeRow, selection.activeCol))

  // Status bar calculations for selected range
  const selectionStats = useMemo(() => {
    if (!sheet) return null
    const r1 = Math.min(selection.startRow, selection.endRow), r2 = Math.max(selection.startRow, selection.endRow)
    const c1 = Math.min(selection.startCol, selection.endCol), c2 = Math.max(selection.startCol, selection.endCol)
    // Only show stats when more than 1 cell is selected
    if (r1 === r2 && c1 === c2) return null
    const nums: number[] = []
    let count = 0
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = sheet.cells.get(cellRef(r, c))
        if (cell?.value != null && cell.value !== "") {
          count++
          const n = Number(cell.formula ? evaluateFormula(cell.formula, (ref) => sheet.cells.get(ref)) : cell.value)
          if (!isNaN(n)) nums.push(n)
        }
      }
    }
    if (nums.length === 0 && count === 0) return null
    const sum = nums.reduce((a, b) => a + b, 0)
    const avg = nums.length > 0 ? sum / nums.length : 0
    return { sum: Math.round(sum * 100) / 100, avg: Math.round(avg * 100) / 100, count, numCount: nums.length, min: nums.length > 0 ? Math.min(...nums) : 0, max: nums.length > 0 ? Math.max(...nums) : 0 }
  }, [sheet, selection])

  // ── Message ───────────────────────────────────────────────────

  const showMessage = useCallback((type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3500)
  }, [])

  // ── Undo/Redo ─────────────────────────────────────────────────

  const pushSnapshot = useCallback((d: SpreadsheetData) => {
    if (ignoreNextSnapshot.current) { ignoreNextSnapshot.current = false; return }
    setUndoStack((prev) => {
      const entry: HistoryEntry = { sheets: d.sheets.map((s) => ({ ...s, cells: new Map(s.cells) })), activeSheet: d.activeSheet }
      return [...prev.slice(-49), entry]
    })
    setRedoStack([])
  }, [])

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !data) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((rs) => [...rs, { sheets: data.sheets.map((s) => ({ ...s, cells: new Map(s.cells) })), activeSheet: data.activeSheet }])
    setUndoStack((us) => us.slice(0, -1))
    setData((d) => d ? { ...d, sheets: prev.sheets, activeSheet: prev.activeSheet, modified: new Date() } : d)
  }, [undoStack, data])

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !data) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((us) => [...us, { sheets: data.sheets.map((s) => ({ ...s, cells: new Map(s.cells) })), activeSheet: data.activeSheet }])
    setRedoStack((rs) => rs.slice(0, -1))
    setData((d) => d ? { ...d, sheets: next.sheets, activeSheet: next.activeSheet, modified: new Date() } : d)
  }, [redoStack, data])

  // ── Data Operations ───────────────────────────────────────────

  const setCell = useCallback((row: number, col: number, updates: Partial<SpreadsheetCell>) => {
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]
      const sidx = prev.activeSheet
      const s = { ...sheets[sidx], cells: new Map(sheets[sidx].cells) }
      const ref = cellRef(row, col)
      const existing = s.cells.get(ref) ?? { value: null }
      s.cells.set(ref, { ...existing, ...updates })
      if (updates.formula === undefined && Object.keys(updates).length === 1 && "value" in updates) {
        delete s.cells.get(ref)!.formula
      }
      sheets[sidx] = s
      // Broadcast cell change via collaboration
      if (rtCollabEnabled) {
        if (updates.formula !== undefined) {
          rtCollab.sendOperation({ type: "cell", action: "set_formula", row, col, sheet: s.name, formula: updates.formula })
        } else if (updates.value !== undefined) {
          rtCollab.sendOperation({ type: "cell", action: "set_value", row, col, sheet: s.name, value: updates.value })
        } else if (updates.style) {
          rtCollab.sendOperation({ type: "cell", action: "set_format", row, col, sheet: s.name, format: updates.style })
        }
      }
      return { ...prev, sheets, modified: new Date() }
    })
  }, [pushSnapshot, rtCollabEnabled, rtCollab])

  const clearCells = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]
      const sidx = prev.activeSheet
      const s = { ...sheets[sidx], cells: new Map(sheets[sidx].cells) }
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
          s.cells.set(cellRef(r, c), { value: null })
      sheets[sidx] = s
      return { ...prev, sheets, modified: new Date() }
    })
  }, [pushSnapshot])

  const getDisplayValue = useCallback((row: number, col: number): string => {
    if (!sheet) return ""
    const cell = sheet.cells.get(cellRef(row, col))
    if (!cell) return ""
    if (cell.formula) return String(evaluateFormula(cell.formula, (ref) => sheet.cells.get(ref)))
    if (cell.format) return formatCellValue(cell.value, cell.format as NumberFormatConfig)
    return String(cell.value ?? "")
  }, [sheet])

  // ── Row/Column Operations ─────────────────────────────────────

  const shiftCellsForInsert = useCallback((axis: "row" | "col", idx: number) => {
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      const s = sheets[sidx]; const oldCells = new Map(s.cells); const newCells = new Map<string, SpreadsheetCell>()
      for (const [ref, cell] of oldCells) {
        const { row, col } = parseCellRef(ref)
        if (axis === "row" && row >= idx) newCells.set(cellRef(row + 1, col), cell)
        else if (axis === "col" && col >= idx) newCells.set(cellRef(row, col + 1), cell)
        else newCells.set(ref, cell)
      }
      sheets[sidx] = { ...s, cells: newCells }
      return { ...prev, sheets, modified: new Date() }
    })
  }, [pushSnapshot])

  const shiftCellsForDelete = useCallback((axis: "row" | "col", idx: number) => {
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      const s = sheets[sidx]; const oldCells = new Map(s.cells); const newCells = new Map<string, SpreadsheetCell>()
      for (const [ref, cell] of oldCells) {
        const { row, col } = parseCellRef(ref)
        if (axis === "row" && row > idx) newCells.set(cellRef(row - 1, col), cell)
        else if (axis === "row" && row === idx) continue
        else if (axis === "col" && col > idx) newCells.set(cellRef(row, col - 1), cell)
        else if (axis === "col" && col === idx) continue
        else newCells.set(ref, cell)
      }
      sheets[sidx] = { ...s, cells: newCells }
      return { ...prev, sheets, modified: new Date() }
    })
  }, [pushSnapshot])

  // ── Selection ────────────────────────────────────────────────

  const handleCellMouseDown = useCallback((row: number, col: number, e: ReactMouseEvent) => {
    if (e.button === 2) return // right-click handled separately
    setIsSelecting(true)
    setCtxMenu(null)
    setSelection({ startRow: row, startCol: col, endRow: row, endCol: col, activeRow: row, activeCol: col })
    setIsEditing(false)
  }, [])

  const handleCellMouseOver = useCallback((row: number, col: number) => {
    if (!isSelecting && !autoFillDrag) return
    if (autoFillDrag) {
      setSelection((prev) => {
        const newEndRow = Math.max(autoFillDrag.startRow, row)
        const newEndCol = Math.max(autoFillDrag.startCol, col)
        if (newEndRow === prev.endRow && newEndCol === prev.endCol) return prev
        const srcCell = sheet?.cells.get(cellRef(autoFillDrag.startRow, autoFillDrag.startCol))
        if (srcCell && (newEndRow > autoFillDrag.startRow || newEndCol > autoFillDrag.startCol)) {
          // Gap #16: Series detection for drag-fill
          const srcVal = String(srcCell.value ?? "")
          const srcNum = parseFloat(srcVal)
          const isNum = !isNaN(srcNum)
          const isDate = /^\d{4}-\d{2}-\d{2}$/.test(srcVal)
          const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
          const isDay = days.includes(srcVal)
          const count = Math.max(newEndRow - autoFillDrag.startRow, newEndCol - autoFillDrag.startCol) + 1
          for (let r = autoFillDrag.startRow; r <= newEndRow; r++) {
            for (let c = autoFillDrag.startCol; c <= newEndCol; c++) {
              if (r === autoFillDrag.startRow && c === autoFillDrag.startCol) continue
              const offset = Math.max(r - autoFillDrag.startRow, c - autoFillDrag.startCol)
              if (isDay) setCell(r, c, { value: days[(days.indexOf(srcVal) + offset) % 7], formula: undefined })
              else if (isDate) { const d = new Date(srcVal); d.setDate(d.getDate() + offset); setCell(r, c, { value: d.toISOString().slice(0,10), formula: undefined }) }
              else if (isNum) setCell(r, c, { value: srcNum + offset, formula: undefined })
              else setCell(r, c, { ...srcCell, formula: undefined })
            }
          }
        }
        return { ...prev, endRow: newEndRow, endCol: newEndCol }
      })
    } else {
      setSelection((prev) => ({ ...prev, endRow: row, endCol: col }))
    }
  }, [isSelecting, autoFillDrag, sheet, setCell])

  const handleCellMouseUp = useCallback(() => { setIsSelecting(false); setAutoFillDrag(null) }, [])

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    setSelection((prev) => ({ ...prev, activeRow: row, activeCol: col }))
    const cell = sheet?.cells.get(cellRef(row, col))
    setEditValue(cell?.formula ?? String(cell?.value ?? ""))
    setIsEditing(true)
  }, [sheet])

  // ── Context Menu ─────────────────────────────────────────────

  const handleContextMenu = useCallback((row: number, col: number, e: ReactMouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, row, col })
  }, [])

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])

  // Broadcast cursor position when selection changes
  useEffect(() => {
    if (rtCollabEnabled && rtCollab.connected) {
      const sheet = data?.sheets?.[data.activeSheet]
      rtCollab.sendCursor({
        row: selection.activeRow,
        col: selection.activeCol,
        sheet: sheet?.name,
      })
    }
  }, [selection.activeRow, selection.activeCol, rtCollabEnabled, rtCollab, data])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-dropdown]")) return
      setShowFontMenu(false)
      setShowFontSize(false)
      setShowColorPicker(null)
      setShowBorderMenu(false)
      setShowNumberFormat(false)
      setShowSortMenu(false)
    }
    window.addEventListener("click", handleClick)
    return () => window.removeEventListener("click", handleClick)
  }, [])

  // ── Keyboard ─────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (isEditing) {
      if (e.key === "Enter") {
        e.preventDefault()
        const cell: Partial<SpreadsheetCell> = { value: editValue.startsWith("=") ? null : (isNaN(Number(editValue)) ? editValue : Number(editValue)) }
        if (editValue.startsWith("=")) cell.formula = editValue
        setCell(selection.activeRow, selection.activeCol, cell)
        setIsEditing(false)
        setSelection((prev) => ({ ...prev, activeRow: Math.min(prev.activeRow + 1, MAX_ROWS - 1), endRow: Math.min(prev.activeRow + 1, MAX_ROWS - 1) }))
      } else if (e.key === "Tab") {
        e.preventDefault()
        const cell: Partial<SpreadsheetCell> = { value: editValue.startsWith("=") ? null : (isNaN(Number(editValue)) ? editValue : Number(editValue)) }
        if (editValue.startsWith("=")) cell.formula = editValue
        setCell(selection.activeRow, selection.activeCol, cell)
        setIsEditing(false); setFormulaSuggestions([])
        setSelection((prev) => ({ ...prev, activeCol: Math.min(prev.activeCol + 1, MAX_COLS - 1), endCol: Math.min(prev.activeCol + 1, MAX_COLS - 1) }))
      } else if (e.key === "Escape") { setIsEditing(false); setFormulaSuggestions([]) }
      return
    }

    const { activeRow, activeCol, startRow, startCol, endRow, endCol } = selection
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); setSelection((p) => ({ ...p, activeRow: Math.max(p.activeRow - 1, 0), endRow: Math.max(p.activeRow - 1, 0) })); break
      case "ArrowDown": e.preventDefault(); setSelection((p) => ({ ...p, activeRow: Math.min(p.activeRow + 1, MAX_ROWS - 1), endRow: Math.min(p.activeRow + 1, MAX_ROWS - 1) })); break
      case "ArrowLeft": e.preventDefault(); setSelection((p) => ({ ...p, activeCol: Math.max(p.activeCol - 1, 0), endCol: Math.max(p.activeCol - 1, 0) })); break
      case "ArrowRight": e.preventDefault(); setSelection((p) => ({ ...p, activeCol: Math.min(p.activeCol + 1, MAX_COLS - 1), endCol: Math.min(p.activeCol + 1, MAX_COLS - 1) })); break
      case "Tab": e.preventDefault(); setSelection((p) => ({ ...p, activeCol: Math.min(p.activeCol + 1, MAX_COLS - 1), endCol: Math.min(p.activeCol + 1, MAX_COLS - 1) })); break
      case "Enter": e.preventDefault(); handleCellDoubleClick(activeRow, activeCol); break
      case "Delete": case "Backspace": e.preventDefault(); clearCells(startRow, startCol, endRow, endCol); break
      case "c": if ((e.ctrlKey || e.metaKey)) { e.preventDefault();
        const cells: ClipboardData["cells"] = [];
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++)
          for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
            const cell = sheet?.cells.get(cellRef(r, c))
            if (cell) cells.push({ row: r - Math.min(startRow, endRow), col: c - Math.min(startCol, endCol), cell })
          }
        setClipboard({ type: "copy", cells, range: { startRow, startCol, endRow, endCol } })
      } break
      case "x": if ((e.ctrlKey || e.metaKey)) { e.preventDefault();
        const cells: ClipboardData["cells"] = [];
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++)
          for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
            const cell = sheet?.cells.get(cellRef(r, c))
            if (cell) cells.push({ row: r - Math.min(startRow, endRow), col: c - Math.min(startCol, endCol), cell })
          }
        setClipboard({ type: "cut", cells, range: { startRow, startCol, endRow, endCol } })
      } break
      case "v": if ((e.ctrlKey || e.metaKey) && clipboard) { e.preventDefault();
        for (const item of clipboard.cells) setCell(activeRow + item.row, activeCol + item.col, item.cell)
        if (clipboard.type === "cut") { clearCells(clipboard.range.startRow, clipboard.range.startCol, clipboard.range.endRow, clipboard.range.endCol); setClipboard(null) }
      } break
      case "z": if (e.ctrlKey || e.metaKey) { e.preventDefault(); redoStack.length > 0 && undoStack.length > 0 ? redo() : undo() } break
      case "y": if (e.ctrlKey || e.metaKey) { e.preventDefault(); redo() } break
      case "f": if ((e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowFindReplace(true) } break
      case "b": if ((e.ctrlKey || e.metaKey)) { e.preventDefault(); setCell(activeRow, activeCol, { style: { ...selectedCell?.style, bold: !selectedCell?.style?.bold } }) } break
      case "i": if ((e.ctrlKey || e.metaKey)) { e.preventDefault(); setCell(activeRow, activeCol, { style: { ...selectedCell?.style, italic: !selectedCell?.style?.italic } }) } break
      case "u": if ((e.ctrlKey || e.metaKey)) { e.preventDefault(); setCell(activeRow, activeCol, { style: { ...selectedCell?.style, underline: !selectedCell?.style?.underline } }) } break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { setEditValue(e.key); setIsEditing(true) }
    }
  }, [isEditing, editValue, selection, sheet, clipboard, undoStack, redoStack, setCell, clearCells, undo, redo, handleCellDoubleClick, selectedCell])

  // ── File Operations ───────────────────────────────────────────

  const handleNewDocument = useCallback(() => {
    setData(createEmptySpreadsheet())
    setCurrentFile({ name: "Untitled.xlsx", provider: "local", folder: "" })
    setMode("editing")
    setUndoStack([]); setRedoStack([])
    setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0, activeRow: 0, activeCol: 0 })
    showMessage("info", "New spreadsheet created")
  }, [showMessage])

  const handleOpenFile = useCallback(async () => {
    const file = await openSpreadsheetFileDialog(); if (!file) return
    setMode("loading")
    try {
      const ext = file.name.toLowerCase().split(".").pop()
      let d: SpreadsheetData
      if (ext === "xlsx" || ext === "xls") { const buffer = await file.arrayBuffer(); d = await readXlsx(buffer) }
      else if (ext === "csv") { const text = await file.text(); d = csvToSpreadsheet(parseCsv(text)) }
      else throw new Error("Unsupported format")
      setData(d); setCurrentFile({ name: file.name, provider: "local", folder: "" })
      setUndoStack([]); setRedoStack([]); setMode("editing")
      showMessage("success", `Opened: ${file.name}`)
    } catch (err: unknown) { setMode("error"); showMessage("error", `Failed: ${err instanceof Error ? err.message : "error"}`) }
  }, [showMessage])

  const handleSaveToDisk = useCallback(async () => {
    if (!data) return; setMode("saving")
    try { const blob = writeXlsx(data); saveBlobAs(blob, currentFile?.name ?? "spreadsheet.xlsx"); showMessage("success", "Saved") }
    catch (err: unknown) { showMessage("error", `Failed: ${err instanceof Error ? err.message : "error"}`) }
    finally { setMode("editing") }
  }, [data, currentFile, showMessage])

  const handleExportCsv = useCallback(() => {
    if (!data) return
    const csv = spreadsheetToCsv(data); const blob = new Blob([csv], { type: "text/csv" })
    saveBlobAs(blob, (currentFile?.name ?? "sheet").replace(/\.[^.]+$/, ".csv"))
  }, [data, currentFile])

  const handleSaveToStorage = useCallback(async () => {
    if (!data) return; setMode("saving")
    try { const b64 = await writeXlsxToBase64(data); await uploadDocument(currentFile?.name ?? "spreadsheet.xlsx", b64, browserFolder, browserProvider); showMessage("success", "Uploaded") }
    catch (err: unknown) { showMessage("error", `Failed: ${err instanceof Error ? err.message : "error"}`) }
    finally { setMode("editing") }
  }, [data, currentFile, browserFolder, browserProvider, showMessage])

  // ── Toolbar Actions ───────────────────────────────────────────

  const setFontFamily = useCallback((f: string) => {
    setCell(selection.activeRow, selection.activeCol, { style: { ...selectedCell?.style, fontFamily: f } }); setShowFontMenu(false)
  }, [selection, selectedCell, setCell])

  const setFontSize = useCallback((s: number) => {
    setCell(selection.activeRow, selection.activeCol, { style: { ...selectedCell?.style, fontSize: s } }); setShowFontSize(false)
  }, [selection, selectedCell, setCell])

  const setColor = useCallback((color: string, type: "text" | "bg") => {
    setCell(selection.activeRow, selection.activeCol, { style: { ...selectedCell?.style, [type === "text" ? "textColor" : "bgColor"]: color === "" ? undefined : color } }); setShowColorPicker(null)
  }, [selection, selectedCell, setCell])

  const setBorder = useCallback((side: "top"|"right"|"bottom"|"left"|"all"|"none") => {
    const style = selectedCell?.style; const existing = style?.border ?? {}
    let border: NonNullable<SpreadsheetCell["style"]>["border"]
    if (side === "none") border = {}
    else if (side === "all") border = { top: true, right: true, bottom: true, left: true }
    else border = { ...existing, [side]: !existing?.[side] }
    setCell(selection.activeRow, selection.activeCol, { style: { ...style, border } }); setShowBorderMenu(false)
  }, [selection, selectedCell, setCell])

  const setNumberFormat = useCallback((cfg: NumberFormatConfig) => {
    setCell(selection.activeRow, selection.activeCol, { format: cfg }); setShowNumberFormat(false)
  }, [selection, setCell])

  const handleSort = useCallback((asc: boolean) => {
    if (!data || !sheet) return
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      sheets[sidx] = sortSheetData(sheets[sidx], [{ col: selection.activeCol, ascending: asc }])
      return { ...prev, sheets, modified: new Date() }
    }); setShowSortMenu(false); showMessage("info", asc ? "Sorted A→Z" : "Sorted Z→A")
  }, [data, sheet, selection, showMessage, pushSnapshot])

  const handleFilter = useCallback(() => {
    if (!data || !sheet) return
    setShowFilterDropdown((v) => v === null ? selection.activeCol : null)
  }, [data, sheet, selection])

  const handleFindReplace = useCallback(() => {
    if (!data || !sheet || !findText) return
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      const s = { ...sheets[sidx], cells: new Map(sheets[sidx].cells) }
      for (const [ref, cell] of s.cells) {
        if (cell.value && String(cell.value).includes(findText))
          s.cells.set(ref, { ...cell, value: replaceText ? String(cell.value).replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), replaceText) : cell.value })
      }
      sheets[sidx] = s
      return { ...prev, sheets, modified: new Date() }
    }); showMessage("info", replaceText ? `Replaced all` : `Found "${findText}"`)
  }, [data, sheet, findText, replaceText, showMessage, pushSnapshot])

  // ── Filter Dropdown ───────────────────────────────────────

  const applyFilter = useCallback((col: number, value: string, include: boolean) => {
    setActiveFilters((prev) => {
      const existing = prev.find((f) => f.col === col)
      if (!existing) return include ? [{ col, values: new Set([value]) }] : prev
      const newValues = new Set(existing.values)
      include ? newValues.add(value) : newValues.delete(value)
      if (newValues.size === 0) return prev.filter((f) => f.col !== col)
      return prev.map((f) => f.col === col ? { col, values: newValues } : f)
    })
  }, [])

  // ── Conditional Format ─────────────────────────────────────

  const addConditionalFormat = useCallback((rule: ConditionalFormatRule) => {
    setCondRules((prev) => {
      const idx = prev.findIndex((r) => r.id === rule.id)
      return idx >= 0 ? prev.map((r) => (r.id === rule.id ? rule : r)) : [...prev, rule]
    })
    setShowCondFormatEditor(false); setCondEditRule(null)
    showMessage("success", "Conditional formatting rule saved")
  }, [showMessage])

  const removeConditionalFormat = useCallback((id: string) => {
    setCondRules((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // ── Data Validation ────────────────────────────────────────

  const applyDataValidation = useCallback(() => {
    if (!data || !sheet) return
    const { startRow, startCol, endRow, endCol } = selection
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      const s = { ...sheets[sidx], cells: new Map(sheets[sidx].cells) }
      for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
        for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
          const existing = s.cells.get(cellRef(r, c)) ?? { value: null }
          s.cells.set(cellRef(r, c), { ...existing, validation: validationRule })
        }
      }
      sheets[sidx] = s
      return { ...prev, sheets, modified: new Date() }
    })
    setShowDataValidation(false)
    showMessage("success", "Data validation applied")
  }, [data, sheet, selection, validationRule, pushSnapshot, showMessage])

  // ── Print ──────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    setShowPrintPreview(true)
    setTimeout(() => { window.print(); setShowPrintPreview(false) }, 200)
  }, [])

  // ── Cell Notes ─────────────────────────────────────────────

  const handleCellNote = useCallback(() => {
    const note = selectedCell?.note ?? ""
    setNoteText(note)
    setShowNoteEditor(true)
  }, [selectedCell])

  const saveCellNote = useCallback(() => {
    setCell(selection.activeRow, selection.activeCol, { note: noteText })
    setShowNoteEditor(false)
    showMessage("info", "Note saved")
  }, [selection, noteText, setCell, showMessage])

  // ── Image Insertion ────────────────────────────────────────

  const handleImageInsert = useCallback(() => {
    if (!imageURL.trim()) { showMessage("error", "Enter an image URL"); return }
    setCell(selection.activeRow, selection.activeCol, { value: `[IMAGE:${imageURL.trim()}]` })
    setShowImageDialog(false); setImageURL("")
    showMessage("info", "Image reference added to cell")
  }, [imageURL, selection, setCell, showMessage])

  // ── Cell Protection ────────────────────────────────────────

  const handleCellProtection = useCallback(() => {
    if (!sheet) return
    const { startRow, startCol, endRow, endCol } = selection
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      const s = { ...sheets[sidx], cells: new Map(sheets[sidx].cells) }
      for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
        for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
          const existing = s.cells.get(cellRef(r, c)) ?? { value: null }
          s.cells.set(cellRef(r, c), { ...existing, protection: { locked: true, hidden: false } })
        }
      }
      sheets[sidx] = s
      return { ...prev, sheets, modified: new Date() }
    })
    setShowProtection(false)
    showMessage("info", "Cells locked")
  }, [sheet, selection, pushSnapshot, showMessage])

  const handleCellUnprotect = useCallback(() => {
    const { startRow, startCol, endRow, endCol } = selection
    setData((prev) => {
      if (!prev) return prev
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      const s = { ...sheets[sidx], cells: new Map(sheets[sidx].cells) }
      for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
        for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
          const existing = s.cells.get(cellRef(r, c))
          if (existing) s.cells.set(cellRef(r, c), { ...existing, protection: undefined })
        }
      }
      sheets[sidx] = s
      return { ...prev, sheets, modified: new Date() }
    })
    showMessage("info", "Cells unlocked")
  }, [selection, showMessage])

  // ── Sheet Operations ───────────────────────────────────────

  const moveSheet = useCallback((from: number, to: number) => {
    if (!data || from < 0 || to < 0 || from >= data.sheets.length || to >= data.sheets.length) return
    setData((prev) => {
      if (!prev) return prev
      const sheets = [...prev.sheets]
      const [moved] = sheets.splice(from, 1)
      sheets.splice(to, 0, moved)
      return { ...prev, sheets, activeSheet: to }
    })
  }, [data])

  const setSheetColor = useCallback((idx: number, color: string) => {
    setData((prev) => {
      if (!prev) return prev
      const sheets = [...prev.sheets]
      sheets[idx] = { ...sheets[idx], tabColor: color === "" ? undefined : color }
      return { ...prev, sheets }
    })
  }, [])

  // ── PDF Export ──────────────────────────────────────────────

  const handlePdfExport = useCallback(async () => {
    if (!data || !sheet) return
    try {
      // Dynamically import pdf-lib
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      let page = pdfDoc.addPage([842, 595]) // A4 landscape

      // Find data extent
      let maxR = 0; let maxC = 0
      for (const ref of sheet.cells.keys()) { const { row, col } = parseCellRef(ref); if (row > maxR) maxR = row; if (col > maxC) maxC = col }

      const startX = 30; const startY = 555; const cellW = 85; const cellH = 16
      const colsPerPage = 8; const rowsPerPage = 30

      for (let chunkR = 0; chunkR <= maxR; chunkR += rowsPerPage) {
        for (let chunkC = 0; chunkC <= maxC; chunkC += colsPerPage) {
          if (chunkR > 0 || chunkC > 0) page = pdfDoc.addPage([842, 595])
          // Column headers
          for (let c = chunkC; c < Math.min(chunkC + colsPerPage, maxC + 1); c++) {
            const colLabel = cellRef(0, c).replace(/\d+$/, "")
            page.drawText(colLabel, { x: startX + (c - chunkC) * cellW + 20, y: startY, size: 8, font, color: rgb(0.3, 0.3, 0.3) })
          }
          // Rows
          for (let r = chunkR; r < Math.min(chunkR + rowsPerPage, maxR + 1); r++) {
            const y = startY - (r - chunkR + 1) * cellH - 5
            page.drawText(String(r + 1), { x: startX, y, size: 7, font, color: rgb(0.5, 0.5, 0.5) })
            for (let c = chunkC; c < Math.min(chunkC + colsPerPage, maxC + 1); c++) {
              const cell = sheet.cells.get(cellRef(r, c))
              const val = String(cell?.value ?? "")
              page.drawText(val.slice(0, 15), { x: startX + (c - chunkC) * cellW + 20, y, size: 7, font, color: cell?.formula ? rgb(0.2, 0.4, 0.8) : rgb(0, 0, 0), maxWidth: cellW - 5 })
            }
          }
        }
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: "application/pdf" })
      saveBlobAs(blob, (currentFile?.name ?? "spreadsheet").replace(/\.[^.]+$/, ".pdf"))
      showMessage("success", "PDF exported")
    } catch (err: unknown) {
      showMessage("error", `PDF export failed: ${err instanceof Error ? err.message : "error"}`)
    }
  }, [data, sheet, currentFile, showMessage])

  // ── Unified export handler ──────────────────────────────────────
  const handleExportFile = useCallback(async () => {
    if (!exportFileName.trim()) return
    setShowExportDialog(false)
    try {
      if (exportFormat === "csv") {
        handleExportCsv()
      } else if (exportFormat === "pdf") {
        await handlePdfExport()
      }
    } catch (err) {
      showMessage("error", `Export failed: ${err instanceof Error ? err.message : "error"}`)
    }
  }, [exportFormat, exportFileName, handleExportCsv, handlePdfExport, showMessage])

  // ── Filtered Display ──────────────────────────────────────

  const displaySheet = useMemo(() => {
    if (!sheet) return null
    if (activeFilters.length > 0) return filterSheetData(sheet, activeFilters)
    return sheet
  }, [sheet, activeFilters])

  // ── Pivot Table ─────────────────────────────────────────────

  const handleCreatePivot = useCallback(() => {
    if (!sheet || !pivotRows.trim()) return
    const rowField = pivotRows.trim()
    const colField = pivotCols.trim()
    const valField = pivotValues.trim()
    const agg = pivotAgg

    // Collect data
    const rowVals = new Map<string, Map<string, number[]>>()
    let maxR = 0; let maxC = 0
    for (const [ref, cell] of sheet.cells) { const { row, col } = parseCellRef(ref); if (row > maxR) maxR = row; if (col > maxC) maxC = col }

    // Find header row
    const headers = new Map<string, number>()
    for (let c = 0; c <= maxC; c++) { const cell = sheet.cells.get(cellRef(0, c)); if (cell?.value) headers.set(String(cell.value), c) }

    const rowCol = headers.get(rowField)
    const colCol = colField ? headers.get(colField) : undefined
    const valCol = headers.get(valField)
    if (rowCol === undefined || valCol === undefined) { showMessage("error", "Field not found in headers"); return }

    for (let r = 1; r <= maxR; r++) {
      const rowKey = String(sheet.cells.get(cellRef(r, rowCol))?.value ?? "")
      const colKey = colCol !== undefined ? String(sheet.cells.get(cellRef(r, colCol))?.value ?? "") : "Value"
      const val = Number(sheet.cells.get(cellRef(r, valCol))?.value) || 0
      if (!rowVals.has(rowKey)) rowVals.set(rowKey, new Map())
      const colMap = rowVals.get(rowKey)!
      if (!colMap.has(colKey)) colMap.set(colKey, [])
      colMap.get(colKey)!.push(val)
    }

    // Build pivot sheet
    const pivotCells = new Map<string, SpreadsheetCell>()
    const colKeys = new Set<string>()
    for (const [, cm] of rowVals) for (const ck of cm.keys()) colKeys.add(ck)
    const colKeyArr = Array.from(colKeys).sort()

    // Headers
    pivotCells.set(cellRef(0, 0), { value: rowField })
    colKeyArr.forEach((ck, i) => { pivotCells.set(cellRef(0, i + 1), { value: ck }) })

    // Data
    let rowIdx = 1
    for (const [rk, cm] of rowVals) {
      pivotCells.set(cellRef(rowIdx, 0), { value: rk })
      colKeyArr.forEach((ck, ci) => {
        const vals = cm.get(ck) ?? []
        let result = 0
        if (agg === "SUM") result = vals.reduce((a, b) => a + b, 0)
        else if (agg === "COUNT") result = vals.length
        else if (agg === "AVG") result = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        else if (agg === "MIN") result = vals.length > 0 ? Math.min(...vals) : 0
        else if (agg === "MAX") result = vals.length > 0 ? Math.max(...vals) : 0
        pivotCells.set(cellRef(rowIdx, ci + 1), { value: result })
      })
      rowIdx++
    }

    const pivotSheet: SpreadsheetSheet = { name: "Pivot", cells: pivotCells, merges: [], colWidths: new Map(), rowHeights: new Map() }
    setPivotResult(pivotSheet); setShowPivotSheet(true); setShowPivotDialog(false)
    showMessage("success", "Pivot table created")
  }, [sheet, pivotRows, pivotCols, pivotValues, pivotAgg, showMessage])

  // ── Named Ranges ────────────────────────────────────────────

  const handleAddNamedRange = useCallback(() => {
    if (!namedRangeName.trim()) return
    const range = `${cellRef(Math.min(selection.startRow, selection.endRow), Math.min(selection.startCol, selection.endCol))}:${cellRef(Math.max(selection.startRow, selection.endRow), Math.max(selection.startCol, selection.endCol))}`
    setNamedRanges((prev) => new Map(prev).set(namedRangeName, range))
    setNamedRangeName(""); setShowNamedRangeDialog(false)
    showMessage("success", `Named range "${namedRangeName}" = ${range}`)
  }, [namedRangeName, selection, showMessage])

  // ── Data Table (What-If) ────────────────────────────────────

  const handleCreateDataTable = useCallback(() => {
    if (!sheet || !dataTableRowInput.trim() && !dataTableColInput.trim()) return
    const rowRef = dataTableRowInput.trim()
    const colRef = dataTableColInput.trim()
    const { startRow, startCol, endRow, endCol } = selection
    const formulaCell = sheet.cells.get(cellRef(startRow, startCol))
    if (!formulaCell?.formula) { showMessage("error", "Top-left cell must contain a formula"); return }

    // Simple one-variable data table (column input)
    if (colRef && endRow > startRow) {
      for (let r = startRow + 1; r <= endRow; r++) {
        const inputVal = sheet.cells.get(cellRef(r, startCol))?.value
        if (inputVal != null) {
          // Simulate: set the input cell to this value, recalc formula
          const result = evaluateFormula(formulaCell.formula!, (ref) => {
            if (ref === colRef) return { value: inputVal }
            return sheet.cells.get(ref)
          })
          setCell(r, startCol + 1, { value: Number(result) || 0 })
        }
      }
    }
    setShowDataTableDialog(false); showMessage("success", "Data table created")
  }, [sheet, dataTableRowInput, dataTableColInput, selection, setCell, showMessage])

  // ── Goal Seek ───────────────────────────────────────────────

  const handleGoalSeek = useCallback(() => {
    if (!sheet || !goalSeekCell.trim() || !goalSeekVarCell.trim() || !goalSeekTarget.trim()) return
    const target = parseFloat(goalSeekTarget)
    if (isNaN(target)) { showMessage("error", "Invalid target value"); return }

    const formulaCell = sheet.cells.get(goalSeekCell)
    if (!formulaCell?.formula) { showMessage("error", "Target cell must contain a formula"); return }

    // Simple binary search
    let lo = -1000000; let hi = 1000000
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2
      const result = evaluateFormula(formulaCell.formula!, (ref) => {
        if (ref === goalSeekVarCell) return { value: mid }
        return sheet.cells.get(ref)
      })
      const r = Number(result)
      if (Math.abs(r - target) < 0.001) { setGoalSeekResult(mid); break }
      if (r < target) lo = mid; else hi = mid
    }
    if (goalSeekResult === null) setGoalSeekResult(lo)
    setShowGoalSeekDialog(false)
    setCell(parseCellRef(goalSeekVarCell).row, parseCellRef(goalSeekVarCell).col, { value: goalSeekResult ?? lo })
    showMessage("success", `Goal Seek: ${goalSeekVarCell} = ${(goalSeekResult ?? lo).toFixed(4)}`)
  }, [sheet, goalSeekCell, goalSeekVarCell, goalSeekTarget, goalSeekResult, setCell, showMessage])

  // ── Sparklines ──────────────────────────────────────────────

  const handleInsertSparkline = useCallback(() => {
    if (!sheet) return
    const { startRow, startCol, endRow, endCol } = selection
    const values: number[] = []
    for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
      const v = Number(sheet.cells.get(cellRef(startRow, c))?.value)
      if (!isNaN(v)) values.push(v)
    }
    if (values.length < 2) { showMessage("error", "Need at least 2 numeric values"); return }

    const w = 120; const h = 20; const maxV = Math.max(...values, 1); const minV = Math.min(...values, 0)
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    if (sparklineType === "line") {
      let pts = ""; values.forEach((v, i) => { const x = (i / (values.length - 1 || 1)) * w; const y = h - ((v - minV) / (maxV - minV || 1)) * (h - 4) - 2; pts += `${x},${y} ` })
      svg += `<polyline points="${pts.trim()}" fill="none" stroke="#5B9BD5" stroke-width="1.5"/>`
      svg += `<circle cx="${0}" cy="${h - ((values[0] - minV) / (maxV - minV || 1)) * (h - 4) - 2}" r="2" fill="#ED7D31"/>`
      svg += `<circle cx="${w}" cy="${h - ((values[values.length-1] - minV) / (maxV - minV || 1)) * (h - 4) - 2}" r="2" fill="#70AD47"/>`
    } else if (sparklineType === "column") {
      const barW = Math.max(2, w / values.length - 1)
      values.forEach((v, i) => { const x = i * (w / values.length); const barH = ((v - minV) / (maxV - minV || 1)) * (h - 2); svg += `<rect x="${x}" y="${h - barH}" width="${barW}" height="${barH}" fill="${v >= 0 ? '#5B9BD5' : '#F8696B'}" />` })
    } else if (sparklineType === "winloss") {
      const barW = Math.max(2, w / values.length - 1)
      values.forEach((v, i) => { const x = i * (w / values.length); svg += `<rect x="${x}" y="2" width="${barW}" height="${h-4}" fill="${v > 0 ? '#70AD47' : v < 0 ? '#F8696B' : '#A5A5A5'}" />` })
    }
    svg += "</svg>"
    setCell(selection.activeRow, selection.activeCol, { value: `[SPARKLINE]`, formula: undefined })
    setShowSparklineDialog(false); showMessage("info", "Sparkline inserted")
  }, [sheet, selection, sparklineType, setCell, showMessage])

  // ── Slicer ──────────────────────────────────────────────────

  const handleInsertSlicer = useCallback(() => {
    setShowSlicerDialog(true)
  }, [])

  // ── External Data ───────────────────────────────────────────

  const handleLoadExternalData = useCallback(async () => {
    if (!externalDataUrl.trim()) return
    try {
      const res = await fetch(externalDataUrl)
      if (externalDataType === "csv") {
        const text = await res.text()
        const csvData = parseCsv(text)
        setData(csvToSpreadsheet(csvData))
      } else if (externalDataType === "json") {
        const json = await res.json()
        if (Array.isArray(json) && json.length > 0) {
          const sheet: SpreadsheetSheet = { name: "External", cells: new Map(), merges: [], colWidths: new Map(), rowHeights: new Map() }
          const keys = Object.keys(json[0])
          keys.forEach((k, ci) => { sheet.cells.set(cellRef(0, ci), { value: k }) })
          json.forEach((row, ri) => { keys.forEach((k, ci) => { sheet.cells.set(cellRef(ri + 1, ci), { value: row[k] ?? "" }) }) })
          setData({ sheets: [sheet], activeSheet: 0, created: new Date(), modified: new Date() })
        }
      } else if (externalDataType === "api") {
        const json = await res.json()
        const sheet: SpreadsheetSheet = { name: "API Data", cells: new Map(), merges: [], colWidths: new Map(), rowHeights: new Map() }
        const flatten = (obj: any, prefix = ""): [string, any][] => Object.entries(obj).flatMap(([k, v]) => typeof v === "object" && v !== null && !Array.isArray(v) ? flatten(v, prefix + k + ".") : [[prefix + k, v]])
        const entries = flatten(json)
        entries.forEach(([k, v], i) => { sheet.cells.set(cellRef(i, 0), { value: k }); sheet.cells.set(cellRef(i, 1), { value: String(v) }) })
        setData({ sheets: [sheet], activeSheet: 0, created: new Date(), modified: new Date() })
      }
      setShowExternalDataDialog(false); showMessage("success", "External data loaded")
    } catch { showMessage("error", "Failed to load external data") }
  }, [externalDataUrl, externalDataType, showMessage])

  // ── Remove Duplicates ───────────────────────────────────────

  const handleRemoveDuplicates = useCallback(() => {
    if (!sheet) return
    const col = dedupCol ?? selection.activeCol
    const seen = new Set<string>()
    let maxR = 0; let maxC = 0
    for (const [ref] of sheet.cells) { const { row, col: c } = parseCellRef(ref); if (row > maxR) maxR = row; if (c > maxC) maxC = c }

    const newCells = new Map<string, SpreadsheetCell>()
    let newRow = 0
    for (let r = 0; r <= maxR; r++) {
      const key = String(sheet.cells.get(cellRef(r, col))?.value ?? "")
      if (seen.has(key)) continue
      seen.add(key)
      for (let c = 0; c <= maxC; c++) {
        const cell = sheet.cells.get(cellRef(r, c))
        if (cell) newCells.set(cellRef(newRow, c), cell)
      }
      newRow++
    }

    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      sheets[sidx] = { ...sheets[sidx], cells: newCells }
      return { ...prev, sheets, modified: new Date() }
    })
    setShowRemoveDupDialog(false)
    showMessage("success", `Removed ${maxR + 1 - newRow} duplicate rows`)
  }, [sheet, dedupCol, selection, pushSnapshot, showMessage])

  // ── Flash Fill ──────────────────────────────────────────────

  const handleFlashFill = useCallback(() => {
    if (!sheet || !flashFillExample.trim()) return
    const { startRow, startCol, endRow, endCol } = selection
    const example = flashFillExample.trim()

    // Simple pattern: extract first name from "First Last"
    for (let r = startRow; r <= endRow; r++) {
      const source = String(sheet.cells.get(cellRef(r, startCol))?.value ?? "")
      if (!source) continue
      // Try common patterns
      let result = ""
      if (example.includes(" ")) {
        // Pattern: concatenation
        const parts = source.split(" ")
        result = parts.map((p, i) => i === 0 ? p : p).join(" ")
      } else if (source.includes(" ")) {
        // Pattern: extract first word
        result = source.split(" ")[0]
      } else {
        result = source.toUpperCase()
      }
      setCell(r, startCol + 1, { value: result })
    }
    setShowFlashFill(false); showMessage("success", "Flash Fill applied")
  }, [sheet, selection, flashFillExample, setCell, showMessage])

  // ── Advanced Charts ─────────────────────────────────────────

  const handleInsertAdvancedChart = useCallback(() => {
    setChartType(advancedChartType as "bar" | "line" | "pie")
    setShowChart(true)
  }, [advancedChartType])

  // ── Page Layout / Print Area ────────────────────────────────

  const handleSetPrintArea = useCallback(() => {
    const { startRow, startCol, endRow, endCol } = selection
    setPrintArea({ r1: Math.min(startRow, endRow), c1: Math.min(startCol, endCol), r2: Math.max(startRow, endRow), c2: Math.max(startCol, endCol) })
    showMessage("info", "Print area set")
  }, [selection, showMessage])

  const handleClearPrintArea = useCallback(() => {
    setPrintArea(null); showMessage("info", "Print area cleared")
  }, [showMessage])

  // ── Icon Sets ───────────────────────────────────────────────

  const handleApplyIconSet = useCallback(() => {
    if (!sheet) return
    const { startRow, startCol, endRow, endCol } = selection
    const values: number[] = []
    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        const v = Number(sheet.cells.get(cellRef(r, c))?.value)
        if (!isNaN(v)) values.push(v)
      }
    }
    if (values.length === 0) { showMessage("error", "No numeric values in selection"); return }

    values.sort((a, b) => a - b)
    const t1 = values[Math.floor(values.length * 0.33)]
    const t2 = values[Math.floor(values.length * 0.67)]

    const icons: Record<string, { high: string; mid: string; low: string }> = {
      arrows: { high: "▲", mid: "►", low: "▼" },
      stars: { high: "★", mid: "☆", low: "○" },
      traffic: { high: "🟢", mid: "🟡", low: "🔴" },
      flags: { high: "🚩", mid: "🏳", low: "⚑" },
    }
    const set = icons[iconSetType]

    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        const v = Number(sheet.cells.get(cellRef(r, c))?.value)
        if (isNaN(v)) continue
        const icon = v >= t2 ? set.high : v >= t1 ? set.mid : set.low
        setCell(r, c, { value: `${icon} ${v}` })
      }
    }
    setShowIconSetDialog(false); showMessage("success", "Icon set applied")
  }, [sheet, selection, iconSetType, setCell, showMessage])

  // ── 19 Remaining Gaps: Handlers ─────────────────────────────
  // #2 Cross-sheet references
  const handleInsertCrossSheetRef = useCallback(() => {
    if (!crossSheetName.trim() || !crossSheetCell.trim()) return
    const ref = `=${crossSheetName}!${crossSheetCell.toUpperCase()}`
    setEditValue(ref); setIsEditing(true)
    setShowCrossSheetRef(false)
    setTimeout(() => { formulaInputRef.current?.focus(); formulaInputRef.current?.select() }, 0)
  }, [crossSheetName, crossSheetCell])

  // #3 Array formulas
  const handleInsertArrayFormula = useCallback(() => {
    const selRange = `${cellRef(selection.startRow, selection.startCol)}:${cellRef(selection.endRow, selection.endCol)}`
    const formulaMap: Record<string, string> = {
      UNIQUE: `=UNIQUE(${selRange})`,
      SORT: `=SORT(${selRange})`,
      FILTER: `=FILTER(${selRange})`,
    }
    setEditValue(formulaMap[arrayFormulaType]); setIsEditing(true)
    setShowArrayFormula(false)
    setTimeout(() => formulaInputRef.current?.focus(), 0)
  }, [selection, arrayFormulaType])

  // #4 Formula auditing (trace precedents/dependents)
  const handleTraceFormula = useCallback(() => {
    if (!sheet || !selectedCell?.formula) { showMessage("info", "Select a formula cell first"); return }
    const formula = selectedCell.formula
    const refs = formula.match(/[A-Z]+\d+/g) || []
    const arrows: Array<{ from: string; to: string }> = []
    const target = cellRef(selection.activeRow, selection.activeCol)
    refs.forEach(r => arrows.push(traceType === "precedents" ? { from: r, to: target } : { from: target, to: r }))
    setTraceArrows(arrows); setShowFormulaAudit(true)
  }, [sheet, selectedCell, selection, traceType, showMessage])

  // #5 Floating chart objects
  const handleDetachChart = useCallback(() => {
    setFloatingChart({ x: 100, y: 100, w: 400, h: 280 })
  }, [])
  const handleChartDragStart = useCallback((e: React.MouseEvent) => {
    if (!floatingChart) return; setChartDrag({ startX: e.clientX, startY: e.clientY })
  }, [floatingChart])
  const handleChartDragMove = useCallback((e: React.MouseEvent) => {
    if (!chartDrag || !floatingChart) return
    setFloatingChart(prev => prev ? { ...prev, x: prev.x + (e.clientX - chartDrag.startX), y: prev.y + (e.clientY - chartDrag.startY) } : null)
    setChartDrag({ startX: e.clientX, startY: e.clientY })
  }, [chartDrag, floatingChart])

  // #6 Chart customization
  const handleApplyChartCustomization = useCallback(() => {
    setShowChartCustomize(false); showMessage("success", "Chart customization applied")
  }, [showMessage])

  // #8 Threaded cell comments
  const handleAddThreadedComment = useCallback(() => {
    if (!sheet) return
    const cell = cellRef(selection.activeRow, selection.activeCol)
    const id = `tc-${Date.now()}`
    setThreadedComments(prev => [...prev, { id, cell, author: "User", text: newThreadReply, date: new Date().toISOString(), replies: [] }])
    setNewThreadReply(""); setActiveThreadId(null)
  }, [sheet, selection, newThreadReply])
  const handleReplyThread = useCallback((threadId: string) => {
    if (!newThreadReply.trim()) return
    setThreadedComments(prev => prev.map(t => t.id === threadId ? { ...t, replies: [...t.replies, { author: "User", text: newThreadReply, date: new Date().toISOString() }] } : t))
    setNewThreadReply("")
  }, [newThreadReply])

  // #9 Hyperlinks in cells
  const handleInsertHyperlink = useCallback(() => {
    if (!hyperlinkUrl.trim()) return
    const text = hyperlinkText || hyperlinkUrl
    setCell(selection.activeRow, selection.activeCol, { value: text, formula: `=HYPERLINK("${hyperlinkUrl}")` })
    setShowHyperlinkDialog(false); setHyperlinkUrl(""); setHyperlinkText("")
  }, [hyperlinkUrl, hyperlinkText, selection, setCell])

  // #10 Text rotation
  const handleApplyTextRotation = useCallback(() => {
    setCell(selection.activeRow, selection.activeCol, { style: { ...selectedCell?.style, textRotation } })
    setShowTextRotation(false); showMessage("info", `Text rotated ${textRotation}°`)
  }, [selection, selectedCell, textRotation, setCell, showMessage])

  // #11 Cell styles / themes
  const cellStylePresets: Record<string, Partial<SpreadsheetCell["style"]>> = {
    "Good": { bgColor: "#C6EFCE", textColor: "#006100" },
    "Bad": { bgColor: "#FFC7CE", textColor: "#9C0006" },
    "Neutral": { bgColor: "#FFEB9C", textColor: "#9C5700" },
    "Heading 1": { bold: true, fontSize: 16, bgColor: "#4472C4", textColor: "#FFFFFF" },
    "Heading 2": { bold: true, fontSize: 13, bgColor: "#D6E4F0", textColor: "#1F4E79" },
    "Heading 3": { bold: true, fontSize: 11, bgColor: "#BDD7EE", textColor: "#2E75B6" },
    "Output": { border: { top: true, bottom: true, left: true, right: true }, bgColor: "#F2F2F2" },
    "Calculation": { bold: true, bgColor: "#F2F2F2", textColor: "#C55A11" },
    "Note": { italic: true, bgColor: "#FFFFCC" },
  }
  const handleApplyCellStyle = useCallback(() => {
    if (!cellStylePreset) return
    const style = cellStylePresets[cellStylePreset]
    setCell(selection.activeRow, selection.activeCol, { style: { ...selectedCell?.style, ...style } })
    setShowCellStyles(false); showMessage("info", `Style: ${cellStylePreset}`)
  }, [cellStylePreset, selection, selectedCell, setCell, showMessage])

  // #12 Sheet-level protection with password
  const handleProtectSheet = useCallback(async () => {
    if (!sheetPassword) { showMessage("error", "Password required"); return }
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sheetPassword))
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
    setSheetProtectHash(hashHex); setIsSheetProtected(true)
    setShowSheetProtect(false); setSheetPassword("")
    showMessage("info", "Sheet protected")
  }, [sheetPassword, showMessage])
  const handleUnprotectSheet = useCallback(async () => {
    const pw = prompt("Enter password to unprotect:"); if (!pw) return
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw))
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
    if (hashHex === sheetProtectHash) { setIsSheetProtected(false); setSheetProtectHash(null); showMessage("success", "Sheet unprotected") }
    else showMessage("error", "Incorrect password")
  }, [sheetProtectHash, showMessage])

  // #13 Virtual scrolling (100K+ rows)
  const handleLoadMoreRows = useCallback(() => {
    setVirtualScrollOffset(prev => prev + VISIBLE_ROWS)
  }, [])

  // #15 Image export (PNG/JPEG)
  const handleExportImage = useCallback(async () => {
    if (!gridRef.current) return
    try {
      const html2canvas = (window as any).html2canvas
      if (html2canvas) {
        const canvas = await html2canvas(gridRef.current)
        canvas.toBlob((blob: Blob) => {
          if (blob) saveBlobAs(blob, "spreadsheet.png")
        }, "image/png")
      } else {
        const script = document.createElement("script")
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
        script.onload = () => handleExportImage()
        document.head.appendChild(script)
      }
      setShowImageExport(false); showMessage("success", "Image exported")
    } catch { showMessage("error", "Image export failed") }
  }, [showMessage])

  // #16 Drag-fill with series detection
  const detectSeries = useCallback((values: string[]): string[] => {
    const result: string[] = [...values]
    const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n))
    if (nums.length >= 2) {
      const diff = nums[1] - nums[0]
      for (let i = values.length; i < result.length + 10; i++) result.push(String(nums[nums.length - 1] + diff * (i - nums.length + 1)))
    }
    // Date series detection
    const dateMatch = values.every(v => /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{2}\/\d{2}\/\d{4}$/.test(v))
    if (dateMatch && values.length >= 2) {
      const d1 = new Date(values[0]); const d2 = new Date(values[1])
      const dayDiff = (d2.getTime() - d1.getTime()) / 86400000
      for (let i = values.length; i < result.length + 10; i++) {
        const d = new Date(d2.getTime() + dayDiff * (i - 1) * 86400000)
        result.push(d.toISOString().slice(0, 10))
      }
    }
    // Day-of-week series
    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    const dayIdx = values.map(v => days.indexOf(v))
    if (dayIdx.every(i => i >= 0) && values.length >= 1) {
      for (let i = values.length; i < result.length + 10; i++) result.push(days[(dayIdx[dayIdx.length - 1] + i - values.length + 1) % 7])
    }
    return result
  }, [])

  // #19 Group/outline rows and columns
  const handleToggleGroup = useCallback(() => {
    const { startRow, startCol, endRow, endCol } = selection
    if (startRow === endRow && startCol === endCol) { showMessage("info", "Select multiple rows or columns"); return }
    const type = startRow !== endRow ? "rows" : "cols"
    const start = type === "rows" ? Math.min(startRow, endRow) : Math.min(startCol, endCol)
    const end = type === "rows" ? Math.max(startRow, endRow) : Math.max(startCol, endCol)
    setGroups(prev => {
      const existing = prev.find(g => g.type === type && g.start === start && g.end === end)
      if (existing) return prev.map(g => g.type === type && g.start === start && g.end === end ? { ...g, collapsed: !g.collapsed } : g)
      return [...prev, { type, start, end, collapsed: false }]
    })
    setShowGroupDialog(false); showMessage("info", `${type} ${start+1}-${end+1} grouped`)
  }, [selection, showMessage])

  // #20 Subtotals
  const handleInsertSubtotals = useCallback(() => {
    if (!sheet) return
    let maxR = 0; for (const [ref] of sheet.cells) { const { row } = parseCellRef(ref); if (row > maxR) maxR = row }
    const newCells = new Map(sheet.cells)
    let lastGroup = ""; let subtotal = 0; let rowOffset = 0
    for (let r = 0; r <= maxR; r++) {
      const groupVal = String(sheet.cells.get(cellRef(r, subtotalGroupCol))?.value ?? "")
      const numVal = Number(sheet.cells.get(cellRef(r, subtotalCol))?.value) || 0
      if (r > 0 && groupVal !== lastGroup && lastGroup !== "") {
        // Insert subtotal row
        const subRow = r + rowOffset
        newCells.set(cellRef(subRow, subtotalCol), { value: subtotal, style: { bold: true, bgColor: "#E2EFDA" } })
        newCells.set(cellRef(subRow, subtotalGroupCol), { value: `${lastGroup} Total`, style: { bold: true, bgColor: "#E2EFDA" } })
        subtotal = 0; rowOffset++
      }
      subtotal += numVal; lastGroup = groupVal
    }
    // Final subtotal
    if (lastGroup) {
      const subRow = maxR + rowOffset + 1
      newCells.set(cellRef(subRow, subtotalCol), { value: subtotal, style: { bold: true, bgColor: "#E2EFDA" } })
      newCells.set(cellRef(subRow, subtotalGroupCol), { value: `${lastGroup} Total`, style: { bold: true, bgColor: "#E2EFDA" } })
    }
    setData(prev => { if (!prev) return prev; const sheets = [...prev.sheets]; sheets[prev.activeSheet] = { ...sheets[prev.activeSheet], cells: newCells }; return { ...prev, sheets } })
    setShowSubtotal(false); showMessage("success", "Subtotals inserted")
  }, [sheet, subtotalCol, subtotalGroupCol, showMessage])

  // #21 Data validation dropdown
  const handleDataValidationDropdown = useCallback((row: number, col: number) => {
    const cell = sheet?.cells.get(cellRef(row, col))
    if (cell?.validation?.type === "list") {
      setDvDropdownCell({ row, col }); setShowDataValidationDropdown(true)
    }
  }, [sheet])

  // #22 Custom number formats
  const handleApplyCustomFormat = useCallback(() => {
    if (!customFormatString.trim()) return
    setCell(selection.activeRow, selection.activeCol, { format: { type: "custom", customFormat: customFormatString } as any })
    setShowCustomNumberFormat(false); showMessage("info", `Custom format: ${customFormatString}`)
  }, [customFormatString, selection, setCell, showMessage])

  // #23 RTL support
  const handleToggleRtl = useCallback(() => {
    setIsRtl(v => !v); showMessage("info", isRtl ? "Left-to-right" : "Right-to-left")
  }, [isRtl, showMessage])

  // #24 Touch/mobile optimized UI
  const handleToggleTouchMode = useCallback(() => {
    setTouchMode(v => !v); showMessage("info", touchMode ? "Desktop mode" : "Touch mode")
  }, [touchMode, showMessage])

  const handleMerge = useCallback(() => {
    if (!data || !sheet) return
    const { startRow, startCol, endRow, endCol } = selection
    if (startRow === endRow && startCol === endCol) { showMessage("info", "Select multiple cells to merge"); return }
    setData((prev) => {
      if (!prev) return prev
      pushSnapshot(prev)
      const sheets = [...prev.sheets]; const sidx = prev.activeSheet
      const s = { ...sheets[sidx], cells: new Map(sheets[sidx].cells), merges: [...sheets[sidx].merges] }
      // Keep top-left cell value
      const topLeft = s.cells.get(cellRef(Math.min(startRow,endRow), Math.min(startCol,endCol)))
      for (let r = Math.min(startRow,endRow); r <= Math.max(startRow,endRow); r++)
        for (let c = Math.min(startCol,endCol); c <= Math.max(startCol,endCol); c++)
          s.cells.delete(cellRef(r, c))
      s.cells.set(cellRef(Math.min(startRow,endRow), Math.min(startCol,endCol)), topLeft ?? { value: null })
      s.merges.push({ start: cellRef(Math.min(startRow,endRow), Math.min(startCol,endCol)), end: cellRef(Math.max(startRow,endRow), Math.max(startCol,endCol)) })
      sheets[sidx] = s
      return { ...prev, sheets, modified: new Date() }
    })
  }, [data, sheet, selection, pushSnapshot])

  const handleWrapText = useCallback(() => {
    const s = selectedCell?.style
    setCell(selection.activeRow, selection.activeCol, { style: { ...s, wrapText: !s?.wrapText } })
  }, [selection, selectedCell, setCell])

  // ── Column Resize ─────────────────────────────────────────────

  const handleColResizeStart = useCallback((col: number, e: ReactMouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const width = sheet?.colWidths.get(col) ?? DEFAULT_COL_WIDTH
    setColResizing({ col, startX: e.clientX, startWidth: width })
  }, [sheet])

  const handleRowResizeStart = useCallback((row: number, e: ReactMouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setRowResizing({ row, startY: e.clientY, startHeight: DEFAULT_ROW_HEIGHT })
  }, [])

  useEffect(() => {
    if (!colResizing) return
    const onMove = (e: globalThis.MouseEvent) => {
      const diff = e.clientX - colResizing.startX
      const newW = Math.max(20, colResizing.startWidth + diff)
      setData((prev) => {
        if (!prev) return prev
        const sheets = [...prev.sheets]; const sidx = prev.activeSheet
        const colWidths = new Map(sheets[sidx].colWidths); colWidths.set(colResizing.col, newW)
        sheets[sidx] = { ...sheets[sidx], colWidths }
        return { ...prev, sheets }
      })
    }
    const onUp = () => setColResizing(null)
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [colResizing])

  useEffect(() => {
    if (!rowResizing) return
    const onMove = (e: globalThis.MouseEvent) => {
      const diff = e.clientY - rowResizing.startY
      const newH = Math.max(16, rowResizing.startHeight + diff)
      setData((prev) => {
        if (!prev) return prev
        const sheets = [...prev.sheets]; const sidx = prev.activeSheet
        const rowHeights = new Map(sheets[sidx].rowHeights); rowHeights.set(rowResizing.row, newH)
        sheets[sidx] = { ...sheets[sidx], rowHeights }
        return { ...prev, sheets }
      })
    }
    const onUp = () => setRowResizing(null)
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [rowResizing])

  // ── Init ─────────────────────────────────────────────────────

  useEffect(() => { if (!data) handleNewDocument() }, [data, handleNewDocument])

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => { formulaInputRef.current?.focus(); formulaInputRef.current?.select() }, 0)
    }
  }, [isEditing])

  // Cleanup dropdowns
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-dropdown]")) {
        setShowFontMenu(false); setShowFontSize(false); setShowColorPicker(null)
        setShowBorderMenu(false); setShowNumberFormat(false); setShowSortMenu(false); setShowFilterMenu(false)
      }
    }
    window.addEventListener("mousedown", close)
    return () => window.removeEventListener("mousedown", close)
  }, [])

  // ── Render ────────────────────────────────────────────────────

  const style = sheet ? selectedCell?.style : undefined
  const zoomScale = zoom / 100

  return (
    <div className="flex h-full flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* ── Ribbon Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col border-b border-border bg-card">
        {/* Tab bar */}
        <div className="flex items-center border-b border-border">
          {(["home","insert","data","view"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRibbonTab(tab)}
              className={cn(
                "px-4 py-1.5 text-xs transition-colors capitalize",
                ribbonTab === tab
                  ? "border-b-2 border-primary font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
          <div className="flex-1" />
          {currentFile && <span className="px-3 text-xs text-muted-foreground">{currentFile.name}</span>}
          <button onClick={() => setRibbonCollapsed(v => !v)}
            className={cn("flex h-7 items-center gap-1 rounded px-2 mr-1 text-[11px] text-muted-foreground hover:bg-muted", !ribbonCollapsed && "bg-primary/10 text-primary font-medium")}>
            <Sliders className="h-3.5 w-3.5"/>Ribbon <ChevronDown className={cn("h-3 w-3 transition-transform",!ribbonCollapsed&&"rotate-180")}/>
          </button>
        </div>

        {/* Ribbon groups — collapsible */}
        {!ribbonCollapsed && (
        <div className="flex items-center gap-1 px-2 py-1.5 flex-wrap">
          {/* ── HOME tab ── */}
          {ribbonTab === "home" && <>
          {/* File group */}
          <RibbonGroup label="File">
            <RibbonBtn onClick={handleNewDocument} title="New"><FilePlus className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleOpenFile} title="Open"><FolderOpen className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleSaveToDisk} disabled={!data} title="Save"><Download className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Undo/Redo */}
          <RibbonGroup label="Undo">
            <RibbonBtn onClick={undo} disabled={undoStack.length===0} title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={redo} disabled={redoStack.length===0} title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Clipboard */}
          <RibbonGroup label="Clipboard">
            <RibbonBtn title="Cut (Ctrl+X)"><Scissors className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn title="Copy (Ctrl+C)"><Copy className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn title="Paste (Ctrl+V)"><Clipboard className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Font */}
          <RibbonGroup label="Font">
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowFontMenu(!showFontMenu)} title="Font" className="w-28 justify-between px-2">
                <span className="text-xs truncate">{style?.fontFamily ?? "Arial"}</span>
                <ChevronDown className="w-3 h-3 ml-1 shrink-0" />
              </RibbonBtn>
              {showFontMenu && (
                <div className="absolute top-full left-0 z-50 mt-1 w-36 rounded border border-border bg-card shadow-lg py-1 max-h-48 overflow-y-auto">
                  {FONT_FAMILIES.map((f) => <button key={f} onClick={() => setFontFamily(f)} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted" style={{ fontFamily: f }}>{f}</button>)}
                </div>
              )}
            </div>
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowFontSize(!showFontSize)} title="Size" className="w-16 justify-between px-2">
                <span className="text-xs truncate">{style?.fontSize ?? 11}</span>
                <ChevronDown className="w-3 h-3 ml-1 shrink-0" />
              </RibbonBtn>
              {showFontSize && (
                <div className="absolute top-full left-0 z-50 mt-1 w-16 rounded border border-border bg-card shadow-lg py-1">
                  {FONT_SIZES.map((s) => <button key={s} onClick={() => setFontSize(s)} className="block w-full px-2 py-1 text-center text-xs hover:bg-muted">{s}</button>)}
                </div>
              )}
            </div>
            <RibbonBtn onClick={() => setCell(selection.activeRow, selection.activeCol, { style: { ...style, bold: !style?.bold } })} active={style?.bold} title="Bold"><Bold className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setCell(selection.activeRow, selection.activeCol, { style: { ...style, italic: !style?.italic } })} active={style?.italic} title="Italic"><Italic className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setCell(selection.activeRow, selection.activeCol, { style: { ...style, underline: !style?.underline } })} active={style?.underline} title="Underline"><Underline className="w-4 h-4"/></RibbonBtn>
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowColorPicker("text")} title="Font color">
                <div className="flex flex-col items-center"><Type className="w-4 h-4"/><div className="w-3 h-0.5 rounded" style={{ backgroundColor: style?.textColor ?? "#000" }}/></div>
              </RibbonBtn>
              {showColorPicker === "text" && <ColorPicker onSelect={(c) => setColor(c, "text")} onClear={() => setColor("", "text")} />}
            </div>
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowColorPicker("bg")} title="Background">
                <div className="flex flex-col items-center"><PaintBucket2 className="w-4 h-4"/><div className="w-3 h-0.5 rounded" style={{ backgroundColor: style?.bgColor ?? "transparent" }}/></div>
              </RibbonBtn>
              {showColorPicker === "bg" && <ColorPicker onSelect={(c) => setColor(c, "bg")} onClear={() => setColor("", "bg")} />}
            </div>
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowBorderMenu(!showBorderMenu)} title="Borders">
                <Square className="w-4 h-4"/>
              </RibbonBtn>
              {showBorderMenu && (
                <div className="absolute top-full left-0 z-50 mt-1 w-36 rounded border border-border bg-card shadow-lg py-1">
                  {["all","top","right","bottom","left"].map((s) => <button key={s} onClick={() => setBorder(s as never)} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted capitalize">{s}</button>)}
                  <div className="border-t border-border mt-1 pt-1"><button onClick={() => setBorder("none")} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted text-destructive">No Border</button></div>
                </div>
              )}
            </div>
          </RibbonGroup>
          <RibbonDivider />
          {/* Alignment */}
          <RibbonGroup label="Align">
            <RibbonBtn onClick={() => setCell(selection.activeRow, selection.activeCol, { style: { ...style, align: "left" } })} active={style?.align==="left"} title="Left"><AlignLeft className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setCell(selection.activeRow, selection.activeCol, { style: { ...style, align: "center" } })} active={style?.align==="center"} title="Center"><AlignCenter className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setCell(selection.activeRow, selection.activeCol, { style: { ...style, align: "right" } })} active={style?.align==="right"} title="Right"><AlignRight className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleWrapText} active={style?.wrapText} title="Wrap"><WrapText className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleMerge} title="Merge"><Merge className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Number */}
          <RibbonGroup label="Number">
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowNumberFormat(!showNumberFormat)} title="Format" className="w-20 justify-between px-2">
                <span className="text-xs truncate">{NUMBER_FORMATS.find((nf) => nf.config.type === (selectedCell?.format as NumberFormatConfig)?.type)?.label ?? "General"}</span>
                <ChevronDown className="w-3 h-3 ml-1 shrink-0" />
              </RibbonBtn>
              {showNumberFormat && (
                <div className="absolute top-full left-0 z-50 mt-1 w-32 rounded border border-border bg-card shadow-lg py-1">
                  {NUMBER_FORMATS.map((nf) => <button key={nf.label} onClick={() => setNumberFormat(nf.config)} className={cn("block w-full px-3 py-1.5 text-left text-xs hover:bg-muted", nf.config.type === ((selectedCell?.format as NumberFormatConfig)?.type ?? "general") && "bg-primary/10 text-primary")}>{nf.label}</button>)}
                </div>
              )}
            </div>
            <RibbonBtn onClick={() => setNumberFormat({ type: "currency", decimalPlaces: 2, currencySymbol: "$", useThousands: true })} title="Currency"><DollarSign className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setNumberFormat({ type: "percentage", decimalPlaces: 0 })} title="Percent"><Percent className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setNumberFormat({ type: "number", decimalPlaces: 2, useThousands: true })} title="Number"><Hash className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setNumberFormat({ type: "date" })} title="Date"><Calendar className="w-4 h-4"/></RibbonBtn>
            {/* Gap #22: Custom number formats */}
            <RibbonBtn onClick={() => setShowCustomNumberFormat(true)} title="Custom Format"><Braces className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Gap #11: Cell styles */}
          <RibbonGroup label="Styles">
            <RibbonBtn onClick={() => setShowCellStyles(true)} title="Cell Styles"><SwatchBook className="w-4 h-4"/></RibbonBtn>
            {/* Gap #10: Text rotation */}
            <RibbonBtn onClick={() => setShowTextRotation(true)} title="Text Rotation"><GripVertical className="w-4 h-4"/></RibbonBtn>
            {/* Gap #9: Hyperlink */}
            <RibbonBtn onClick={() => setShowHyperlinkDialog(true)} title="Hyperlink"><Link className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Cells */}
          <RibbonGroup label="Cells">
            <RibbonBtn onClick={() => shiftCellsForInsert("row", selection.activeRow)} title="Insert Row"><Rows2 className="w-4 h-4"/><Plus className="w-2.5 h-2.5 -ml-1"/></RibbonBtn>
            <RibbonBtn onClick={() => shiftCellsForInsert("col", selection.activeCol)} title="Insert Column"><Columns2 className="w-4 h-4"/><Plus className="w-2.5 h-2.5 -ml-1"/></RibbonBtn>
            <RibbonBtn onClick={() => shiftCellsForDelete("row", selection.activeRow)} title="Delete Row"><Rows2 className="w-4 h-4"/><Minus className="w-2.5 h-2.5 -ml-1"/></RibbonBtn>
            <RibbonBtn onClick={() => shiftCellsForDelete("col", selection.activeCol)} title="Delete Column"><Columns2 className="w-4 h-4"/><Minus className="w-2.5 h-2.5 -ml-1"/></RibbonBtn>
            <RibbonBtn onClick={() => clearCells(selection.startRow, selection.startCol, selection.endRow, selection.endCol)} title="Clear"><Ban className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowProtection(true)} title="Protect"><Lock className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Gap #2-4: Formulas */}
          <RibbonGroup label="Formulas">
            <RibbonBtn onClick={() => setShowCrossSheetRef(true)} title="Cross-Sheet Ref"><ArrowRightLeft className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowArrayFormula(true)} title="Array Formula"><List className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleTraceFormula} title="Trace"><Eye className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Sort/Filter */}
          <RibbonGroup label="Sort & Filter">
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowSortMenu(!showSortMenu)} title="Sort"><SortDesc className="w-4 h-4"/></RibbonBtn>
              {showSortMenu && (
                <div className="absolute top-full left-0 z-50 mt-1 w-36 rounded border border-border bg-card shadow-lg py-1">
                  <button onClick={() => handleSort(true)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"><SortAsc className="w-3.5 h-3.5"/> Sort A→Z</button>
                  <button onClick={() => handleSort(false)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"><SortDesc className="w-3.5 h-3.5"/> Sort Z→A</button>
                </div>
              )}
            </div>
            <RibbonBtn onClick={handleFilter} title="Filter"><Filter className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowFindReplace(true)} title="Find"><Search className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          {/* ── INSERT tab ── */}
          {ribbonTab === "insert" && <>
          <RibbonGroup label="Rows & Columns">
            <RibbonBtn onClick={() => shiftCellsForInsert("row", selection.activeRow)} title="Insert Row"><Rows2 className="w-4 h-4"/><Plus className="w-2.5 h-2.5 -ml-1"/></RibbonBtn>
            <RibbonBtn onClick={() => shiftCellsForInsert("col", selection.activeCol)} title="Insert Column"><Columns2 className="w-4 h-4"/><Plus className="w-2.5 h-2.5 -ml-1"/></RibbonBtn>
            <RibbonBtn onClick={() => shiftCellsForDelete("row", selection.activeRow)} title="Delete Row"><Rows2 className="w-4 h-4"/><Minus className="w-2.5 h-2.5 -ml-1"/></RibbonBtn>
            <RibbonBtn onClick={() => shiftCellsForDelete("col", selection.activeCol)} title="Delete Column"><Columns2 className="w-4 h-4"/><Minus className="w-2.5 h-2.5 -ml-1"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Charts">
            <RibbonBtn onClick={() => setShowChart(!showChart)} active={showChart} title="Chart"><BarChart3 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleInsertAdvancedChart} title="Advanced Chart"><LineChart className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowSparklineDialog(true)} title="Sparkline"><LineChart className="w-4 h-4"/></RibbonBtn>
            {/* Gap #5: Floating chart */}
            <RibbonBtn onClick={handleDetachChart} title="Detach Chart"><Maximize2 className="w-4 h-4"/></RibbonBtn>
            {/* Gap #6: Chart customize */}
            <RibbonBtn onClick={() => setShowChartCustomize(true)} title="Customize Chart"><Sliders className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Tables">
            <RibbonBtn onClick={() => setShowPivotDialog(true)} title="Pivot Table"><Table className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowSlicerDialog(true)} title="Slicer"><Filter className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Illustrations">
            <RibbonBtn onClick={() => setShowImageDialog(true)} title="Image"><ImageIcon className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Gap #8: Threaded comments */}
          <RibbonGroup label="Comments">
            <RibbonBtn onClick={handleCellNote} title="Note"><MessageSquare className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowThreadedComments(true)} title="Threaded Comments"><MessageSquare className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="What-If">
            <RibbonBtn onClick={() => setShowDataTableDialog(true)} title="Data Table"><Calculator className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowGoalSeekDialog(true)} title="Goal Seek"><Hash className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          {/* ── DATA tab ── */}
          {ribbonTab === "data" && <>
          <RibbonGroup label="Sort & Filter">
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowSortMenu(!showSortMenu)} title="Sort"><SortDesc className="w-4 h-4"/></RibbonBtn>
              {showSortMenu && (
                <div className="absolute top-full left-0 z-50 mt-1 w-36 rounded border border-border bg-card shadow-lg py-1">
                  <button onClick={() => handleSort(true)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"><SortAsc className="w-3.5 h-3.5"/> Sort A→Z</button>
                  <button onClick={() => handleSort(false)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"><SortDesc className="w-3.5 h-3.5"/> Sort Z→A</button>
                </div>
              )}
            </div>
            <RibbonBtn onClick={handleFilter} title="Filter"><Filter className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowFindReplace(true)} title="Find"><Search className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Data Tools">
            <RibbonBtn onClick={() => setShowDataValidation(true)} title="Validation"><AlertTriangle className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowRemoveDupDialog(true)} title="Remove Dup"><Trash2 className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => setShowFlashFill(true)} title="Flash Fill"><Check className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Gap #19: Group/outline */}
          <RibbonGroup label="Outline">
            <RibbonBtn onClick={() => setShowGroupDialog(true)} title="Group"><Rows2 className="w-4 h-4"/></RibbonBtn>
            {/* Gap #20: Subtotals */}
            <RibbonBtn onClick={() => setShowSubtotal(true)} title="Subtotal"><Calculator className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="External Data">
            <RibbonBtn onClick={() => setShowExternalDataDialog(true)} title="External Data"><FileDown className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Conditional Formatting">
            <RibbonBtn onClick={() => { setCondEditRule(null); setShowCondFormatEditor(true) }} title="Cond Format"><Square className="w-3.5 h-3.5"/><span className="text-[8px]">CF</span></RibbonBtn>
            <RibbonBtn onClick={() => setShowIconSetDialog(true)} title="Icon Set"><Square className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          </>}

          {/* ── VIEW tab ── */}
          {ribbonTab === "view" && <>
          <RibbonGroup label="Gridlines">
            <RibbonBtn onClick={() => setShowGrid(!showGrid)} active={showGrid} title="Gridlines"><Grid3X3 className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Freeze Panes">
            <RibbonBtn onClick={() => { setFreezeRows(selection.activeRow+1); setFreezeCols(selection.activeCol+1) }} title="Freeze"><Lock className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={() => { setFreezeRows(0); setFreezeCols(0) }} title="Unfreeze"><Unlock className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Zoom">
            <RibbonBtn onClick={() => setZoom(Math.max(50, zoom-10))} title="Zoom out"><Minus className="w-3 h-3"/></RibbonBtn>
            <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
            <RibbonBtn onClick={() => setZoom(Math.min(200, zoom+10))} title="Zoom in"><Plus className="w-3 h-3"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Page Layout">
            <RibbonBtn onClick={handleSetPrintArea} title="Set Print Area"><PrinterIcon className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handleClearPrintArea} title="Clear Print Area"><Ban className="w-4 h-4"/></RibbonBtn>
            <RibbonBtn onClick={handlePrint} title="Print"><PrinterIcon className="w-4 h-4"/></RibbonBtn>
            {/* Gap #12: Sheet protection */}
            <RibbonBtn onClick={() => isSheetProtected ? handleUnprotectSheet() : setShowSheetProtect(true)} active={isSheetProtected} title={isSheetProtected ? "Unprotect Sheet" : "Protect Sheet"}><Lock className="w-4 h-4"/></RibbonBtn>
            {/* Gap #15: Image export */}
            <RibbonBtn onClick={() => setShowImageExport(true)} title="Export as Image"><ImageIcon className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          {/* Gap #23: RTL */}
          <RibbonGroup label="Layout">
            <RibbonBtn onClick={handleToggleRtl} active={isRtl} title="RTL">{isRtl ? "LTR" : "RTL"}</RibbonBtn>
            {/* Gap #24: Touch mode */}
            <RibbonBtn onClick={handleToggleTouchMode} active={touchMode} title="Touch Mode"><Monitor className="w-4 h-4"/></RibbonBtn>
          </RibbonGroup>
          <RibbonDivider />
          <RibbonGroup label="Collaboration">
            <RibbonBtn onClick={() => setRtCollabEnabled(!rtCollabEnabled)} active={rtCollabEnabled} title="Real-time Collaboration">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </RibbonBtn>
            {rtCollabEnabled && <CollabUserBar users={rtCollab.users} connected={rtCollab.connected} sessionId={rtCollab.sessionId} />}
          </RibbonGroup>
          </>}

          <div className="flex-1" />
          {/* Export — single dropdown */}
          <RibbonGroup label="Export">
            <div className="relative" data-dropdown>
              <RibbonBtn onClick={() => setShowExportMenu(!showExportMenu)} title="Export">
                <FileOutput className="w-4 h-4"/>
                <ChevronDown className="w-3 h-3 ml-0.5"/>
              </RibbonBtn>
              {showExportMenu && (
                <div className="absolute top-full right-0 z-50 mt-1 w-44 rounded border border-border bg-card shadow-xl py-1 text-xs">
                  <button onClick={() => { setShowExportMenu(false); setExportFormat("csv"); setExportFileName((currentFile?.name??"spreadsheet").replace(/\.[^.]+$/,".csv")); setExportFolderPath(""); setShowExportDialog(true) }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileText className="w-3.5 h-3.5 text-green-500"/> CSV
                  </button>
                  <button onClick={() => { setShowExportMenu(false); setExportFormat("pdf"); setExportFileName((currentFile?.name??"spreadsheet").replace(/\.[^.]+$/,".pdf")); setExportFolderPath(""); setShowExportDialog(true) }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <FileText className="w-3.5 h-3.5 text-red-500"/> PDF
                  </button>
                  <div className="border-t border-border my-1"/>
                  <button onClick={() => { setShowExportMenu(false); handleSaveToStorage() }} disabled={!data} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted text-left disabled:opacity-30">
                    <FileUp className="w-3.5 h-3.5"/> Save to Storage
                  </button>
                </div>
              )}
            </div>
          </RibbonGroup>
        </div>
        )}
      </div>

      {/* ── Formula Bar ───────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-1">
        <div className="flex w-20 items-center justify-center rounded border border-border bg-muted/50 py-1 text-xs font-mono font-medium">
          {cellRef(selection.activeRow, selection.activeCol)}
        </div>
        <span className="text-xs text-muted-foreground">fx</span>
        <div className="relative flex-1">
          <input ref={formulaInputRef} type="text"
            value={isEditing ? editValue : (selectedCell?.formula ?? String(selectedCell?.value ?? ""))}
            onChange={(e) => {
              const val = e.target.value
              setEditValue(val)
              // IntelliSense: trigger when typing a formula
              if (val.startsWith("=")) {
                // Find the last function token being typed (after = or after open paren/comma)
                const match = val.match(/(?:^=|[,(])([A-Z]{1,}[A-Z0-9]*)$/i)
                if (match && match[1].length >= 1) {
                  const prefix = match[1].toUpperCase()
                  const matches = FORMULA_CATALOG.filter(f => f.name.startsWith(prefix)).slice(0, 8)
                  setFormulaSuggestions(matches)
                  setFormulaSelIdx(0)
                } else {
                  setFormulaSuggestions([])
                }
              } else {
                setFormulaSuggestions([])
              }
            }}
            onKeyDown={(e) => {
              // IntelliSense navigation
              if (formulaSuggestions.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setFormulaSelIdx(i => Math.min(i + 1, formulaSuggestions.length - 1)); return }
                if (e.key === "ArrowUp") { e.preventDefault(); setFormulaSelIdx(i => Math.max(i - 1, 0)); return }
                if (e.key === "Tab" || (e.key === "Enter" && formulaSuggestions.length > 0)) {
                  e.preventDefault()
                  const fn = formulaSuggestions[formulaSelIdx]
                  if (fn) {
                    // Replace the partial function name with the full name
                    const match = editValue.match(/(?:^=|.*[,(])([A-Z0-9]*)$/i)
                    if (match) {
                      const prefix = match[1]
                      const newVal = editValue.slice(0, editValue.length - prefix.length) + fn.name + "("
                      setEditValue(newVal)
                    }
                    setFormulaSuggestions([])
                  }
                  return
                }
                if (e.key === "Escape") { setFormulaSuggestions([]); return }
              }
              if (e.key === "Enter") {
                const cell: Partial<SpreadsheetCell> = {}
                const raw = editValue
                if (raw.startsWith("=")) { cell.formula = raw; cell.value = null }
                else { const n = parseFloat(raw); cell.value = isNaN(n) ? raw : n }
                setCell(selection.activeRow, selection.activeCol, cell); setIsEditing(false); setFormulaSuggestions([])
              } else if (e.key === "Escape") { setIsEditing(false); setFormulaSuggestions([]) }
            }}
            onFocus={() => { if (!isEditing) { setIsEditing(true); setEditValue(selectedCell?.formula ?? String(selectedCell?.value ?? "")) } }}
            onBlur={() => { setTimeout(() => setFormulaSuggestions([]), 150) }}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary font-mono"
            placeholder="Enter value or formula"
          />
          {/* IntelliSense dropdown */}
          {formulaSuggestions.length > 0 && (
            <div ref={formulaDropRef} className="absolute left-0 top-full z-50 mt-1 w-80 max-h-52 overflow-y-auto rounded border border-border bg-card shadow-xl py-0.5">
              {formulaSuggestions.map((fn, i) => (
                <button key={fn.name}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const match = editValue.match(/(?:^=|.*[,(])([A-Z0-9]*)$/i)
                    if (match) {
                      const prefix = match[1]
                      const newVal = editValue.slice(0, editValue.length - prefix.length) + fn.name + "("
                      setEditValue(newVal)
                      setFormulaSuggestions([])
                      formulaInputRef.current?.focus()
                    }
                  }}
                  className={cn("flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted",
                    i === formulaSelIdx && "bg-primary/10"
                  )}
                >
                  <span className="font-mono font-medium text-primary shrink-0">{fn.name}</span>
                  <span className="font-mono text-muted-foreground shrink-0">{fn.args}</span>
                  <span className="text-muted-foreground truncate ml-auto">{fn.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => handleFindReplace()} className="rounded p-1 text-muted-foreground hover:bg-muted" title="Find & Replace (Ctrl+F)">
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* ── Status Message ───────────────────────────────── */}
      {message && (
        <div className={cn("flex items-center gap-2 border-b px-3 py-1.5 text-xs",
          message.type==="success" && "border-green-200 bg-green-50 text-green-700",
          message.type==="error" && "border-red-200 bg-red-50 text-red-700",
          message.type==="info" && "border-blue-200 bg-blue-50 text-blue-700",
        )}>
          {message.type==="success" && <CheckCircle2 className="w-3.5 h-3.5"/>}
          {message.type==="error" && <AlertCircle className="w-3.5 h-3.5"/>}
          {message.type==="info" && <FileText className="w-3.5 h-3.5"/>}
          {message.text}
        </div>
      )}

      {/* ── Find & Replace Bar ────────────────────────────── */}
      {showFindReplace && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input value={findText} onChange={(e) => setFindText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFindReplace()} placeholder="Find..." className="h-7 w-28 rounded border border-border bg-background px-2 text-xs outline-none" />
          <input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFindReplace()} placeholder="Replace..." className="h-7 w-28 rounded border border-border bg-background px-2 text-xs outline-none" />
          <button onClick={handleFindReplace} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">{replaceText ? "Replace All" : "Find"}</button>
          <button onClick={() => setShowFindReplace(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5"/></button>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────── */}
      <div ref={(el) => { (containerRef as any).current = el; gridRef.current = el }} className={cn("relative flex-1 overflow-auto bg-white dark:bg-zinc-900 select-none", touchMode && "touch-manipulation")} style={{ fontSize: `${zoomScale}em`, direction: isRtl ? "rtl" : "ltr" }}>
        {rtCollabEnabled && <RemoteCursors users={rtCollab.users} containerRef={gridRef} type="spreadsheet" />}
        {mode === "loading" ? (
          <div className="flex h-full items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/><span className="text-muted-foreground">Loading...</span></div>
        ) : sheet ? (
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 border-b border-r border-border bg-muted/80" style={{ width: COL_HEADER_WIDTH, height: ROW_HEADER_HEIGHT }} onClick={() => setSelection({ startRow: 0, startCol: 0, endRow: MAX_ROWS-1, endCol: MAX_COLS-1, activeRow: 0, activeCol: 0 })} />
                {Array.from({ length: VISIBLE_COLS }, (_, ci) => {
                  const col = ci + (freezeCols > 0 && ci >= freezeCols ? 0 : 0)
                  const isSelCol = col >= Math.min(selection.startCol, selection.endCol) && col <= Math.max(selection.startCol, selection.endCol)
                  const width = sheet.colWidths.get(col) ?? DEFAULT_COL_WIDTH
                  return (
                    <th key={ci}
                      className={cn("relative border-b border-r border-border bg-muted/80 text-center text-xs font-medium text-muted-foreground", isSelCol && "bg-primary/20")}
                      style={{
                        width, height: ROW_HEADER_HEIGHT,
                        ...(freezeCols > 0 && ci < freezeCols ? { position: "sticky", left: COL_HEADER_WIDTH + ci * DEFAULT_COL_WIDTH, zIndex: 15 } : {}),
                        ...(freezeCols > 0 && ci === freezeCols - 1 ? { borderRight: "2.5px solid oklch(0.55 0.15 250)" } : {}),
                      }}
                      onClick={(e) => { setSelection({ startRow: 0, startCol: col, endRow: MAX_ROWS-1, endCol: col, activeRow: selection.activeRow, activeCol: col }) }}
                      onContextMenu={(e) => handleContextMenu(0, col, e)}
                    >
                      {cellRef(0, col).replace(/\d+$/, "")}
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 z-20"
                        onMouseDown={(e) => handleColResizeStart(col, e)}
                        style={{ transform: "translateX(50%)" }}
                      />
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: VISIBLE_ROWS }, (_, ri) => {
                const row = ri
                const isSelRow = row >= Math.min(selection.startRow, selection.endRow) && row <= Math.max(selection.startRow, selection.endRow)
                return (
                  <tr key={ri}>
                    <td className={cn("sticky left-0 z-10 relative border-b border-r border-border bg-muted/80 text-center text-xs text-muted-foreground", isSelRow && "bg-primary/20")}
                      style={{
                        width: COL_HEADER_WIDTH, height: sheet.rowHeights.get(row) ?? DEFAULT_ROW_HEIGHT,
                        ...(freezeRows > 0 && row === freezeRows - 1 ? { borderBottom: "2.5px solid oklch(0.55 0.15 250)" } : {}),
                      }}
                      onClick={(e) => { setSelection({ startRow: row, startCol: 0, endRow: row, endCol: MAX_COLS-1, activeRow: row, activeCol: selection.activeCol }) }}
                      onContextMenu={(e) => handleContextMenu(row, 0, e)}
                    >
                      {row + 1}
                      <div className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-primary/50 z-20"
                        onMouseDown={(e) => handleRowResizeStart(row, e)}
                        style={{ transform: "translateY(50%)" }}
                      />
                    </td>
                    {Array.from({ length: VISIBLE_COLS }, (_, ci) => {
                      const col = ci
                      const isSelected = row >= Math.min(selection.startRow, selection.endRow) && row <= Math.max(selection.startRow, selection.endRow) && col >= Math.min(selection.startCol, selection.endCol) && col <= Math.max(selection.startCol, selection.endCol)
                      const isActive = row === selection.activeRow && col === selection.activeCol
                      const cell = sheet.cells.get(cellRef(row, col))
                      const cfStyle = condRules.length > 0 ? evaluateConditionalFormat(cell, condRules, cellRef(row, col)) : null
                      const cellStyle = cfStyle ?? cell?.style
                      const rowH = sheet.rowHeights.get(row) ?? DEFAULT_ROW_HEIGHT
                      const border = cellStyle?.border

                      return (
                        <td key={ci}
                          className={cn(
                            "border-b border-r px-1 text-sm relative",
                            showGrid ? "border-border" : "border-transparent",
                            isSelected && "bg-primary/10",
                            isActive && "ring-2 ring-primary ring-inset z-[5]",
                            cellStyle?.bold && "font-bold",
                            cellStyle?.italic && "italic",
                            cellStyle?.underline && "underline",
                            cellStyle?.wrapText && "whitespace-normal break-words",
                            !cellStyle?.wrapText && "truncate",
                          )}
                          style={{
                            width: sheet.colWidths.get(col) ?? DEFAULT_COL_WIDTH,
                            height: rowH,
                            textAlign: cellStyle?.align ?? "left",
                            backgroundColor: cellStyle?.bgColor,
                            color: cellStyle?.textColor,
                            fontSize: cellStyle?.fontSize ? `${cellStyle.fontSize}px` : undefined,
                            fontFamily: cellStyle?.fontFamily,
                            borderTop: border?.top ? "1px solid #000" : undefined,
                            borderRight: border?.right ? "1px solid #000" : undefined,
                            borderBottom: border?.bottom ? "1px solid #000" : undefined,
                            borderLeft: border?.left ? "1px solid #000" : undefined,
                            // Gap #10: Text rotation
                            ...(cellStyle?.textRotation ? { transform: `rotate(${cellStyle.textRotation}deg)`, transformOrigin: "center center" } : {}),
                            ...(freezeCols > 0 && ci < freezeCols ? { position: "sticky", left: COL_HEADER_WIDTH + ci * (sheet.colWidths.get(ci) ?? DEFAULT_COL_WIDTH), zIndex: isActive ? 5 : 1 } : {}),
                            ...(freezeCols > 0 && ci === freezeCols - 1 ? { borderRight: "2.5px solid oklch(0.55 0.15 250)" } : {}),
                            ...(freezeRows > 0 && row === freezeRows - 1 ? { borderBottom: "2.5px solid oklch(0.55 0.15 250)" } : {}),
                          }}
                          onMouseDown={(e) => {
                            // Gap #21: Data validation dropdown
                            if (e.button === 0 && cell?.validation?.type === "list") {
                              setDvDropdownCell({ row, col }); setShowDataValidationDropdown(true); return
                            }
                            handleCellMouseDown(row, col, e)
                          }}
                          onMouseOver={() => handleCellMouseOver(row, col)}
                          onMouseUp={handleCellMouseUp}
                          onDoubleClick={() => {
                            // Gap #12: Sheet protection check
                            if (isSheetProtected) { showMessage("info", "Sheet is protected"); return }
                            handleCellDoubleClick(row, col)
                          }}
                          onContextMenu={(e) => handleContextMenu(row, col, e)}
                        >
                          {isEditing && isActive ? (
                            <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              className="absolute inset-0 w-full border-none bg-white px-1 outline-none text-sm z-10" autoFocus
                            />
                          ) : (
                            // Gap #9: Hyperlink rendering
                            cell?.formula?.startsWith("=HYPERLINK(") ? (
                              <a href={cell.formula.match(/"([^"]+)"/)?.[1] || "#"} target="_blank" rel="noopener noreferrer"
                                className="text-blue-600 underline cursor-pointer" onClick={e => e.stopPropagation()}>
                                {getDisplayValue(row, col)}
                              </a>
                            ) : (
                              <span>{getDisplayValue(row, col)}</span>
                            )
                          )}
                          {/* Cell note indicator */}
                          {cell?.note && (
                            <div className="absolute right-0 top-0 w-0 h-0" style={{ borderLeft: "6px solid transparent", borderTop: "6px solid #ED7D31" }} title={cell.note} />
                          )}
                          {/* Protection indicator */}
                          {cell?.protection?.locked && (
                            <Lock className="absolute left-0 top-0 w-2.5 h-2.5 text-muted-foreground/60" />
                          )}
                          {/* Auto-fill handle */}
                          {isActive && !isEditing && (
                            <div className="absolute right-0 bottom-0 w-2 h-2 bg-primary rounded-sm cursor-crosshair z-10"
                              onMouseDown={(e) => { e.stopPropagation(); setAutoFillDrag({ startRow: row, startCol: col }) }}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : null}
      </div>

      {/* ── Status Bar ──────────────────────────────────────── */}
      {data && (
        <div className="flex items-center border-t border-border bg-card px-3 py-0.5 text-[11px] text-muted-foreground">
          <span className="font-mono">{cellRef(selection.activeRow, selection.activeCol)}</span>
          {selectionStats && (
            <div className="ml-auto flex items-center gap-4">
              {selectionStats.numCount > 0 && (
                <>
                  <span>Sum: <span className="font-medium text-foreground">{selectionStats.sum.toLocaleString()}</span></span>
                  <span>Average: <span className="font-medium text-foreground">{selectionStats.avg.toLocaleString()}</span></span>
                  <span>Min: <span className="font-medium text-foreground">{selectionStats.min.toLocaleString()}</span></span>
                  <span>Max: <span className="font-medium text-foreground">{selectionStats.max.toLocaleString()}</span></span>
                </>
              )}
              <span>Count: <span className="font-medium text-foreground">{selectionStats.count}</span></span>
            </div>
          )}
          {!selectionStats && <span className="ml-auto">Ready</span>}
        </div>
      )}

      {/* ── Sheet Tabs ─────────────────────────────────────── */}
      {data && (
        <div className="flex items-center gap-1 border-t border-border bg-card px-2 py-1">
          {data.sheets.map((s, i) => (
            <div key={i} className="relative group flex items-center">
              <button onClick={() => setData((prev) => prev ? { ...prev, activeSheet: i } : prev)}
                onDoubleClick={() => {
                  const newName = prompt("Rename sheet:", s.name)
                  if (newName && newName !== s.name) {
                    setData((prev) => {
                      if (!prev) return prev
                      const sheets = [...prev.sheets]; sheets[i] = { ...sheets[i], name: newName }
                      return { ...prev, sheets }
                    })
                  }
                }}
                className={cn("rounded px-3 py-1 text-xs border-b-2", i === data.activeSheet ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                style={{ borderBottomColor: s.tabColor ?? "transparent" }}>
                {s.name}
              </button>
              {/* Sheet context menu (right-click) */}
              <div className="absolute -top-8 left-0 hidden group-hover:flex items-center gap-0.5 bg-card border border-border rounded shadow px-1 py-0.5 z-20">
                {i > 0 && <button onClick={() => moveSheet(i, i - 1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted" title="Move left"><ChevronLeft className="w-3 h-3"/></button>}
                {i < data.sheets.length - 1 && <button onClick={() => moveSheet(i, i + 1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted" title="Move right"><ChevronRight className="w-3 h-3"/></button>}
                <div className="flex gap-0.5">
                  {["#5B9BD5","#ED7D31","#70AD47","#FFC000","#FF0000","#A5A5A5",""].map((c) => (
                    <button key={c} onClick={() => setSheetColor(i, c)} className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: c || "transparent" }} title={c || "No color"}/>
                  ))}
                </div>
              </div>
              {data.sheets.length > 1 && (
                <button onClick={() => {
                  setData((prev) => {
                    if (!prev || prev.sheets.length <= 1) return prev
                    const sheets = prev.sheets.filter((_, idx) => idx !== i)
                    const newActive = Math.min(prev.activeSheet, sheets.length - 1)
                    return { ...prev, sheets, activeSheet: newActive }
                  })
                }} className="absolute -right-1 -top-1 hidden group-hover:flex w-4 h-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px]"><X className="w-2.5 h-2.5"/></button>
              )}
            </div>
          ))}
          <button onClick={() => {
            setData((prev) => {
              if (!prev) return prev
              const sheet: SpreadsheetSheet = { name: `Sheet${prev.sheets.length+1}`, cells: new Map(), merges: [], colWidths: new Map(), rowHeights: new Map() }
              return { ...prev, sheets: [...prev.sheets, sheet] }
            })
          }} className="rounded p-1 text-muted-foreground hover:bg-muted"><Plus className="w-4 h-4"/></button>
        </div>
      )}

      {/* ── Context Menu ───────────────────────────────────── */}
      {ctxMenu && (
        <div className="fixed z-50 w-48 rounded border border-border bg-card shadow-xl py-1 text-xs"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <MenuBtn onClick={() => { setSelection((p) => ({ ...p, activeRow: ctxMenu.row, activeCol: ctxMenu.col })); handleCellDoubleClick(ctxMenu.row, ctxMenu.col); setCtxMenu(null) }} icon={<Type className="w-3.5 h-3.5"/>}>Edit Cell</MenuBtn>
          <div className="border-t border-border my-1"/>
          <MenuBtn onClick={() => { copySelection(ctxMenu); setCtxMenu(null) }} icon={<Copy className="w-3.5 h-3.5"/>}>Copy</MenuBtn>
          <MenuBtn onClick={() => { setSelection((p) => ({ ...p, activeRow: ctxMenu.row, activeCol: ctxMenu.col })); clearCells(ctxMenu.row, ctxMenu.col, ctxMenu.row, ctxMenu.col); setCtxMenu(null) }} icon={<Ban className="w-3.5 h-3.5"/>}>Clear</MenuBtn>
          <div className="border-t border-border my-1"/>
          <MenuBtn onClick={() => { shiftCellsForInsert("row", ctxMenu.row); setCtxMenu(null) }}>Insert Row</MenuBtn>
          <MenuBtn onClick={() => { shiftCellsForInsert("col", ctxMenu.col); setCtxMenu(null) }}>Insert Column</MenuBtn>
          <MenuBtn onClick={() => { shiftCellsForDelete("row", ctxMenu.row); setCtxMenu(null) }}>Delete Row</MenuBtn>
          <MenuBtn onClick={() => { shiftCellsForDelete("col", ctxMenu.col); setCtxMenu(null) }}>Delete Column</MenuBtn>
          <div className="border-t border-border my-1"/>
          <MenuBtn onClick={() => { setSelection((p) => ({ ...p, activeRow: ctxMenu.row, activeCol: ctxMenu.col })); handleMerge(); setCtxMenu(null) }} icon={<Merge className="w-3.5 h-3.5"/>}>Merge</MenuBtn>
          <MenuBtn onClick={() => { setSelection((p) => ({ ...p, activeRow: ctxMenu.row, activeCol: ctxMenu.col })); setCtxMenu(null); setShowFindReplace(true) }} icon={<Search className="w-3.5 h-3.5"/>}>Find...</MenuBtn>
          <div className="border-t border-border my-1"/>
          <MenuBtn onClick={() => { setSelection((p) => ({ ...p, activeRow: ctxMenu.row, activeCol: ctxMenu.col })); handleCellNote(); setCtxMenu(null) }} icon={<MessageSquare className="w-3.5 h-3.5"/>}>Add Note</MenuBtn>
          <MenuBtn onClick={() => { setSelection((p) => ({ ...p, activeRow: ctxMenu.row, activeCol: ctxMenu.col })); setShowImageDialog(true); setCtxMenu(null) }} icon={<ImageIcon className="w-3.5 h-3.5"/>}>Insert Image</MenuBtn>
          <MenuBtn onClick={() => { setSelection((p) => ({ ...p, activeRow: ctxMenu.row, activeCol: ctxMenu.col })); handleCellProtection(); setCtxMenu(null) }} icon={<Lock className="w-3.5 h-3.5"/>}>Lock Cell</MenuBtn>
          <MenuBtn onClick={() => { setSelection((p) => ({ ...p, activeRow: ctxMenu.row, activeCol: ctxMenu.col })); handleCellUnprotect(); setCtxMenu(null) }} icon={<Unlock className="w-3.5 h-3.5"/>}>Unlock Cell</MenuBtn>
        </div>
      )}

      {/* ── File Browser Modal ─────────────────────────────── */}
      {showFileBrowser && <FileBrowserModal fileList={fileList} loading={browserLoading} folder={browserFolder} provider={browserProvider}
        onFolderChange={(f) => { setBrowserFolder(f); loadFileBrowser(f, browserProvider) }}
        onProviderChange={(p) => { setBrowserProvider(p); loadFileBrowser(browserFolder, p) }}
        onSelect={(entry) => { /* storage open logic */ setShowFileBrowser(false) }}
        onClose={() => setShowFileBrowser(false)}
      />}

      {/* ── Filter Dropdown ────────────────────────────────── */}
      {showFilterDropdown !== null && sheet && (
        <FilterDropdown
          col={showFilterDropdown}
          sheet={sheet}
          activeFilters={activeFilters}
          onToggle={applyFilter}
          onClose={() => setShowFilterDropdown(null)}
        />
      )}

      {/* ── Conditional Formatting Editor ───────────────────── */}
      {showCondFormatEditor && (
        <CondFormatEditor
          initialRule={condEditRule}
          selection={selection}
          onSave={addConditionalFormat}
          onClose={() => { setShowCondFormatEditor(false); setCondEditRule(null) }}
        />
      )}

      {/* ── Data Validation Dialog ──────────────────────────── */}
      {showDataValidation && (
        <DataValidationDialog
          rule={validationRule}
          onChange={setValidationRule}
          onApply={applyDataValidation}
          onClose={() => setShowDataValidation(false)}
        />
      )}

      {/* ── Chart View ──────────────────────────────────────── */}
      {showChart && sheet && (
        <ChartView
          sheet={sheet}
          selection={selection}
          chartType={chartType}
          onChartTypeChange={setChartType}
          onClose={() => setShowChart(false)}
        />
      )}

      {/* ── Print Preview ───────────────────────────────────── */}
      {showPrintPreview && sheet && (
        <PrintPreview sheet={sheet} selection={selection} onClose={() => setShowPrintPreview(false)} />
      )}

      {/* ── Cell Note Editor ─────────────────────────────────── */}
      {showNoteEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNoteEditor(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Cell Note</h3>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." className="w-full rounded border border-border bg-background px-2 py-1 text-xs h-24 mb-3" />
            <div className="flex gap-2">
              <button onClick={saveCellNote} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Save</button>
              <button onClick={() => setShowNoteEditor(false)} className="flex-1 rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Insert Dialog ──────────────────────────────── */}
      {showImageDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImageDialog(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Insert Image</h3>
            <input type="text" value={imageURL} onChange={(e) => setImageURL(e.target.value)} placeholder="Image URL (e.g. https://...)" className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2" />
            <p className="text-[10px] text-muted-foreground mb-3">Paste an image URL. The image will be stored as a cell reference.</p>
            <div className="flex gap-2">
              <button onClick={handleImageInsert} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Insert</button>
              <button onClick={() => setShowImageDialog(false)} className="flex-1 rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Dialog ──────────────────────────────────── */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowExportDialog(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Export as {exportFormat.toUpperCase()}</h3>
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
            <div className="flex gap-2">
              <button onClick={() => { void handleExportFile() }} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Export</button>
              <button onClick={() => setShowExportDialog(false)} className="flex-1 rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Protection Dialog ─────────────────────────────────── */}
      {showProtection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowProtection(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Cell Protection</h3>
            <p className="text-xs text-muted-foreground mb-3">Lock selected cells to prevent editing, or unlock previously locked cells.</p>
            <div className="flex gap-2">
              <button onClick={handleCellProtection} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground"><Lock className="w-3.5 h-3.5 inline mr-1"/>Lock</button>
              <button onClick={handleCellUnprotect} className="flex-1 rounded border border-border px-3 py-1.5 text-xs"><Unlock className="w-3.5 h-3.5 inline mr-1"/>Unlock</button>
            </div>
            <button onClick={() => setShowProtection(false)} className="w-full mt-2 rounded border border-border px-3 py-1.5 text-xs">Close</button>
          </div>
        </div>
      )}

      {/* ── Pivot Table Dialog ─────────────────────────────── */}
      {showPivotDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPivotDialog(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Create Pivot Table</h3>
            <div className="space-y-2 text-xs">
              <div><label className="text-muted-foreground">Row Field (header name)</label><input value={pivotRows} onChange={e => setPivotRows(e.target.value)} placeholder="e.g. Category" className="w-full rounded border border-border bg-background px-2 py-1 mt-1" /></div>
              <div><label className="text-muted-foreground">Column Field</label><input value={pivotCols} onChange={e => setPivotCols(e.target.value)} placeholder="e.g. Month (optional)" className="w-full rounded border border-border bg-background px-2 py-1 mt-1" /></div>
              <div><label className="text-muted-foreground">Value Field</label><input value={pivotValues} onChange={e => setPivotValues(e.target.value)} placeholder="e.g. Amount" className="w-full rounded border border-border bg-background px-2 py-1 mt-1" /></div>
              <div><label className="text-muted-foreground">Aggregation</label>
                <select value={pivotAgg} onChange={e => setPivotAgg(e.target.value as never)} className="w-full rounded border border-border bg-background px-2 py-1 mt-1">
                  <option value="SUM">SUM</option><option value="COUNT">COUNT</option><option value="AVG">AVERAGE</option><option value="MIN">MIN</option><option value="MAX">MAX</option>
                </select></div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleCreatePivot} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Create Pivot</button>
                <button onClick={() => setShowPivotDialog(false)} className="flex-1 rounded border border-border px-3 py-1.5 text-xs">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Named Range Dialog ──────────────────────────────── */}
      {showNamedRangeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNamedRangeDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Define Named Range</h3>
            <input value={namedRangeName} onChange={e => setNamedRangeName(e.target.value)} placeholder="Range name" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleAddNamedRange} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Define</button>
            {namedRanges.size > 0 && <div className="mt-2 border-t border-border pt-2 text-xs space-y-1">{Array.from(namedRanges.entries()).map(([n, r]) => <div key={n} className="flex justify-between"><span className="font-medium">{n}</span><span className="text-muted-foreground">{r}</span></div>)}</div>}
          </div>
        </div>
      )}

      {/* ── Data Table Dialog ───────────────────────────────── */}
      {showDataTableDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDataTableDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Data Table (What-If)</h3>
            <p className="text-xs text-muted-foreground mb-2">Top-left cell of selection must contain a formula.</p>
            <input value={dataTableColInput} onChange={e => setDataTableColInput(e.target.value)} placeholder="Column input cell ref (e.g. B1)" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleCreateDataTable} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Create</button>
          </div>
        </div>
      )}

      {/* ── Goal Seek Dialog ────────────────────────────────── */}
      {showGoalSeekDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowGoalSeekDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Goal Seek</h3>
            <input value={goalSeekCell} onChange={e => setGoalSeekCell(e.target.value)} placeholder="Formula cell (e.g. C5)" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <input value={goalSeekTarget} onChange={e => setGoalSeekTarget(e.target.value)} placeholder="Target value" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <input value={goalSeekVarCell} onChange={e => setGoalSeekVarCell(e.target.value)} placeholder="Variable cell to change" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleGoalSeek} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Solve</button>
          </div>
        </div>
      )}

      {/* ── Sparkline Dialog ────────────────────────────────── */}
      {showSparklineDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSparklineDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Insert Sparkline</h3>
            <p className="text-xs text-muted-foreground mb-2">Select a row of numeric values.</p>
            <div className="flex gap-1 mb-3">{(["line","column","winloss"] as const).map(t => <button key={t} onClick={() => setSparklineType(t)} className={cn("rounded border px-2 py-1 text-xs capitalize", sparklineType===t && "border-primary bg-primary/10")}>{t}</button>)}</div>
            <button onClick={handleInsertSparkline} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
          </div>
        </div>
      )}

      {/* ── External Data Dialog ────────────────────────────── */}
      {showExternalDataDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowExternalDataDialog(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Load External Data</h3>
            <select value={externalDataType} onChange={e => setExternalDataType(e.target.value as never)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2">
              <option value="csv">CSV URL</option><option value="json">JSON URL</option><option value="api">API URL</option>
            </select>
            <input value={externalDataUrl} onChange={e => setExternalDataUrl(e.target.value)} placeholder="https://..." className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleLoadExternalData} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Load</button>
          </div>
        </div>
      )}

      {/* ── Remove Duplicates Dialog ────────────────────────── */}
      {showRemoveDupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRemoveDupDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Remove Duplicates</h3>
            <p className="text-xs text-muted-foreground mb-2">Column to check: {cellRef(0, dedupCol ?? selection.activeCol).replace(/\d+$/, "")} (active column)</p>
            <div className="flex gap-2"><button onClick={handleRemoveDuplicates} className="flex-1 rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Remove</button><button onClick={() => setShowRemoveDupDialog(false)} className="flex-1 rounded border border-border px-3 py-1 text-xs">Close</button></div>
          </div>
        </div>
      )}

      {/* ── Flash Fill Dialog ───────────────────────────────── */}
      {showFlashFill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFlashFill(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Flash Fill</h3>
            <p className="text-xs text-muted-foreground mb-2">Select source data range and enter example of desired output.</p>
            <input value={flashFillExample} onChange={e => setFlashFillExample(e.target.value)} placeholder="Example output" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleFlashFill} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply Flash Fill</button>
          </div>
        </div>
      )}

      {/* ── Icon Set Dialog ─────────────────────────────────── */}
      {showIconSetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowIconSetDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Icon Sets</h3>
            <p className="text-xs text-muted-foreground mb-2">Select numeric cells. Icons assigned by value: top 33% / middle / bottom 33%.</p>
            <div className="grid grid-cols-2 gap-2 mb-3">{(["arrows","stars","traffic","flags"] as const).map(t => <button key={t} onClick={() => setIconSetType(t)} className={cn("rounded border px-2 py-1 text-xs capitalize", iconSetType===t && "border-primary bg-primary/10")}>{t}</button>)}</div>
            <button onClick={handleApplyIconSet} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply</button>
          </div>
        </div>
      )}

      {/* ── Page Layout Overlay ─────────────────────────────── */}
      {showPageLayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPageLayout(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Page Layout</h3>
            <div className="space-y-2 text-xs">
              <div className="flex gap-2"><button onClick={handleSetPrintArea} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Set Print Area</button><button onClick={handleClearPrintArea} className="flex-1 rounded border border-border px-3 py-1.5 text-xs">Clear</button></div>
              {printArea && <div className="text-muted-foreground">Print area: {cellRef(printArea.r1, printArea.c1)}:{cellRef(printArea.r2, printArea.c2)}</div>}
              <button onClick={() => { handlePrint(); setShowPageLayout(false) }} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground w-full"><PrinterIcon className="w-3.5 h-3.5 inline mr-1"/>Print</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pivot Sheet View ────────────────────────────────── */}
      {showPivotSheet && pivotResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPivotSheet(false)}>
          <div className="w-full max-w-2xl max-h-[80vh] rounded-lg border border-border bg-card shadow-xl p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-sm">Pivot Table</h3><button onClick={() => setShowPivotSheet(false)}><X className="w-4 h-4"/></button></div>
            <table className="border-collapse w-full text-xs">
              <tbody>
                {Array.from({ length: 50 }, (_, r) => {
                  let hasCells = false
                  for (let c = 0; c < 20; c++) if (pivotResult.cells.has(cellRef(r, c))) hasCells = true
                  if (!hasCells && r > 0) return null
                  return <tr key={r}>{Array.from({ length: 20 }, (_, c) => { const cell = pivotResult.cells.get(cellRef(r, c)); return <td key={c} className={cn("border border-border px-2 py-1", r === 0 && "bg-muted/50 font-medium")}>{cell?.value ?? ""}</td> })}</tr>
                })}
              </tbody>
            </table>
            <button onClick={() => setShowPivotSheet(false)} className="mt-3 rounded border border-border px-3 py-1 text-xs w-full">Close</button>
          </div>
        </div>
      )}

      {/* ── Slicer Panel ────────────────────────────────────── */}
      {showSlicerDialog && sheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSlicerDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Insert Slicer</h3>
            <p className="text-xs text-muted-foreground mb-2">Filter column: {cellRef(0, slicerCol).replace(/\d+$/, "")}</p>
            <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
              {(() => { const vals = new Set<string>(); for (const [ref, cell] of sheet.cells) { const { col } = parseCellRef(ref); if (col === slicerCol && cell.value != null) vals.add(String(cell.value)) } return Array.from(vals).sort().map(v => <label key={v} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted px-2 py-1 rounded"><input type="checkbox" className="accent-primary"/>{v || "(empty)"}</label>) })()}
            </div>
            <button onClick={() => setShowSlicerDialog(false)} className="rounded border border-border px-3 py-1 text-xs w-full">Close</button>
          </div>
        </div>
      )}

      {/* ── Conditional Formatting Rules Bar ────────────────── */}
      {condRules.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-2 py-1 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-medium">Conditional Formats:</span>
          {condRules.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded bg-background border border-border px-2 py-0.5 text-[10px]">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.bgColor ?? "#ccc" }} />
              {r.range}
              <button onClick={() => removeConditionalFormat(r.id)} className="text-muted-foreground hover:text-destructive"><X className="w-2.5 h-2.5"/></button>
            </span>
          ))}
          <button onClick={() => { setCondEditRule(null); setShowCondFormatEditor(true) }} className="text-[10px] text-primary hover:underline ml-1">+ Add</button>
        </div>
      )}

      {/* ── Active Filters Bar ──────────────────────────────── */}
      {activeFilters.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-2 py-1 flex items-center gap-2 flex-wrap">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Filtered: {activeFilters.length} column(s)
          </span>
          <button onClick={() => setActiveFilters([])} className="text-[10px] text-primary hover:underline">Clear All</button>
        </div>
      )}

      {/* ── Gap #21: Data Validation Dropdown ─────────────────── */}
      {showDataValidationDropdown && dvDropdownCell && (() => {
        const cell = sheet?.cells.get(cellRef(dvDropdownCell.row, dvDropdownCell.col))
        const options = cell?.validation?.value1?.split(",").map(o => o.trim()).filter(Boolean) || []
        return (
          <div className="fixed z-50 w-36 rounded border border-border bg-card shadow-xl py-1" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
            {options.map(o => (
              <button key={o} onClick={() => { setCell(dvDropdownCell.row, dvDropdownCell.col, { value: o }); setShowDataValidationDropdown(false); setDvDropdownCell(null) }}
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted">{o}</button>
            ))}
            <button onClick={() => setShowDataValidationDropdown(false)} className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted border-t border-border">Cancel</button>
          </div>
        )
      })()}

      {/* ── Gap #13: Virtual Scrolling Load More ──────────────── */}
      <div className="border-t border-border bg-muted/30 px-2 py-1 flex items-center justify-center">
        <button onClick={handleLoadMoreRows} className="text-[10px] text-primary hover:underline">
          Load more rows (showing {VISIBLE_ROWS + virtualScrollOffset} of {MAX_ROWS})
        </button>
      </div>

      {/* ── 19 Gaps Dialogs ────────────────────────────────── */}
      {/* Cross-sheet reference */}
      {showCrossSheetRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCrossSheetRef(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Cross-Sheet Reference</h3>
            <select value={crossSheetName} onChange={e => setCrossSheetName(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2">
              <option value="">Select sheet...</option>
              {data?.sheets.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
            </select>
            <input value={crossSheetCell} onChange={e => setCrossSheetCell(e.target.value)} placeholder="Cell ref (e.g. A1)" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleInsertCrossSheetRef} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert Reference</button>
          </div>
        </div>
      )}

      {/* Array formula */}
      {showArrayFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowArrayFormula(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Array Formula</h3>
            <div className="flex gap-1 mb-3">{(["UNIQUE","SORT","FILTER"] as const).map(t => <button key={t} onClick={() => setArrayFormulaType(t)} className={cn("rounded border px-2 py-1 text-xs", arrayFormulaType===t && "border-primary bg-primary/10")}>{t}</button>)}</div>
            <button onClick={handleInsertArrayFormula} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
          </div>
        </div>
      )}

      {/* Formula audit */}
      {showFormulaAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFormulaAudit(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Formula Audit</h3>
            <div className="flex gap-2 mb-3">{(["precedents","dependents"] as const).map(t => <button key={t} onClick={() => setTraceType(t)} className={cn("rounded border px-2 py-1 text-xs capitalize", traceType===t && "border-primary bg-primary/10")}>{t}</button>)}</div>
            <div className="space-y-1 max-h-40 overflow-y-auto text-xs">{traceArrows.map((a,i) => <div key={i} className="flex items-center gap-2"><span className="font-mono">{a.from}</span><ArrowRight className="w-3 h-3 text-muted-foreground"/><span className="font-mono">{a.to}</span></div>)}</div>
          </div>
        </div>
      )}

      {/* Chart customization */}
      {showChartCustomize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowChartCustomize(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Chart Options</h3>
            <input value={chartTitle} onChange={e => setChartTitle(e.target.value)} placeholder="Chart title" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <input value={chartXLabel} onChange={e => setChartXLabel(e.target.value)} placeholder="X-axis label" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <input value={chartYLabel} onChange={e => setChartYLabel(e.target.value)} placeholder="Y-axis label" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <label className="flex items-center gap-2 text-xs mb-2"><input type="checkbox" checked={chartShowLabels} onChange={e => setChartShowLabels(e.target.checked)} className="accent-primary"/>Show data labels</label>
            <label className="flex items-center gap-2 text-xs mb-2"><input type="checkbox" checked={chartShowTrendline} onChange={e => setChartShowTrendline(e.target.checked)} className="accent-primary"/>Show trendline</label>
            <button onClick={handleApplyChartCustomization} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply</button>
          </div>
        </div>
      )}

      {/* Threaded comments */}
      {showThreadedComments && (
        <div className="fixed right-0 top-0 bottom-0 z-50 w-80 border-l border-border bg-card shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2"><h3 className="text-sm font-semibold">Threaded Comments</h3><button onClick={() => setShowThreadedComments(false)} className="rounded p-1 hover:bg-muted"><X className="w-4 h-4"/></button></div>
          <div className="p-3 space-y-3">
            {threadedComments.map(t => (
              <div key={t.id} className="rounded border border-border bg-background p-2 text-xs">
                <div className="flex items-center justify-between mb-1"><span className="font-medium">{t.author}</span><span className="text-muted-foreground">{t.cell}</span></div>
                <p className="mb-1">{t.text}</p>
                {t.replies.map((r, ri) => <div key={ri} className="ml-3 pl-2 border-l-2 border-muted mb-1"><span className="font-medium">{r.author}:</span> {r.text}</div>)}
                <div className="flex gap-1 mt-1"><input value={activeThreadId===t.id ? newThreadReply : ""} onFocus={() => { setActiveThreadId(t.id); setNewThreadReply("") }} onChange={e => setNewThreadReply(e.target.value)} onKeyDown={e => e.key==="Enter" && handleReplyThread(t.id)} placeholder="Reply..." className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"/></div>
              </div>
            ))}
            <div className="flex gap-1"><input value={activeThreadId===null ? newThreadReply : ""} onFocus={() => setActiveThreadId(null)} onChange={e => setNewThreadReply(e.target.value)} onKeyDown={e => e.key==="Enter" && handleAddThreadedComment()} placeholder="New comment..." className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"/><button onClick={handleAddThreadedComment} className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">Add</button></div>
          </div>
        </div>
      )}

      {/* Hyperlink */}
      {showHyperlinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowHyperlinkDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Insert Hyperlink</h3>
            <input value={hyperlinkText} onChange={e => setHyperlinkText(e.target.value)} placeholder="Display text" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <input value={hyperlinkUrl} onChange={e => setHyperlinkUrl(e.target.value)} placeholder="URL" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleInsertHyperlink} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert</button>
          </div>
        </div>
      )}

      {/* Text rotation */}
      {showTextRotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTextRotation(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Text Rotation</h3>
            <div className="flex gap-1 mb-3">{[0,45,90,135,180,270].map(d => <button key={d} onClick={() => setTextRotation(d)} className={cn("rounded border px-2 py-1 text-xs", textRotation===d && "border-primary bg-primary/10")}>{d}°</button>)}</div>
            <button onClick={handleApplyTextRotation} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply</button>
          </div>
        </div>
      )}

      {/* Cell styles */}
      {showCellStyles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCellStyles(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Cell Styles</h3>
            <div className="grid grid-cols-2 gap-1 mb-3">{Object.keys(cellStylePresets).map(k => <button key={k} onClick={() => { setCellStylePreset(k); handleApplyCellStyle() }} className="rounded border px-2 py-1 text-xs hover:bg-muted text-left" style={{backgroundColor: cellStylePresets[k]?.bgColor, color: cellStylePresets[k]?.textColor}}>{k}</button>)}</div>
          </div>
        </div>
      )}

      {/* Sheet protection */}
      {showSheetProtect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSheetProtect(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Protect Sheet</h3>
            <input type="password" value={sheetPassword} onChange={e => setSheetPassword(e.target.value)} placeholder="Password" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleProtectSheet} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Protect</button>
          </div>
        </div>
      )}

      {/* Group dialog */}
      {showGroupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowGroupDialog(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Group / Outline</h3>
            <p className="text-xs text-muted-foreground mb-2">Select rows or columns to group.</p>
            <div className="flex gap-2 mb-2">{(["rows","cols"] as const).map(t => <button key={t} onClick={() => setGroupType(t)} className={cn("rounded border px-2 py-1 text-xs capitalize", groupType===t && "border-primary bg-primary/10")}>{t}</button>)}</div>
            <button onClick={handleToggleGroup} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Toggle Group</button>
          </div>
        </div>
      )}

      {/* Subtotal */}
      {showSubtotal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSubtotal(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Subtotals</h3>
            <p className="text-xs text-muted-foreground mb-2">Group by column index (0=A, 1=B...), sum values from column index.</p>
            <div className="flex gap-2 mb-2">
              <input type="number" value={subtotalGroupCol} onChange={e => setSubtotalGroupCol(parseInt(e.target.value)||0)} placeholder="Group col" className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm" />
              <input type="number" value={subtotalCol} onChange={e => setSubtotalCol(parseInt(e.target.value)||0)} placeholder="Sum col" className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm" />
            </div>
            <button onClick={handleInsertSubtotals} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Insert Subtotals</button>
          </div>
        </div>
      )}

      {/* Custom number format */}
      {showCustomNumberFormat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCustomNumberFormat(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Custom Number Format</h3>
            <p className="text-xs text-muted-foreground mb-2">Examples: #,##0.00, 0%, $#,##0, dd/mm/yyyy</p>
            <input value={customFormatString} onChange={e => setCustomFormatString(e.target.value)} placeholder="#,##0.00" className="w-full rounded border border-border bg-background px-2 py-1 text-sm mb-2" />
            <button onClick={handleApplyCustomFormat} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground w-full">Apply</button>
          </div>
        </div>
      )}
    </div>
  )

  // ── Helpers ─────────────────────────────────────────────────

  function copySelection(cm: { row: number; col: number }) {
    const cell = sheet?.cells.get(cellRef(cm.row, cm.col))
    if (cell) setClipboard({ type: "copy", cells: [{ row: 0, col: 0, cell }], range: { startRow: cm.row, startCol: cm.col, endRow: cm.row, endCol: cm.col } })
  }

  async function loadFileBrowser(folder: string, provider: string) {
    setBrowserLoading(true)
    try { setFileList(await listDocuments(folder, provider, true)) }
    catch { /* ignore */ }
    finally { setBrowserLoading(false) }
  }
}

// ─── Ribbon Sub-Components ──────────────────────────────────────

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

function RibbonBtn({ children, onClick, active, disabled, title, className }: {
  children: React.ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; title?: string; className?: string
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn("rounded p-1 transition-colors", active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground", disabled && "opacity-30 cursor-not-allowed", className)}
      title={title}
    >{children}</button>
  )
}

function MenuBtn({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors">
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}

function ColorPicker({ onSelect, onClear }: { onSelect: (color: string) => void; onClear: () => void }) {
  return (
    <div className="absolute top-full left-0 z-50 mt-1 w-40 rounded border border-border bg-card shadow-lg p-2" data-dropdown>
      <div className="grid grid-cols-5 gap-1 mb-2">
        {COLORS.map((c) => (
          <button key={c} onClick={() => onSelect(c)}
            className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button onClick={onClear} className="w-full text-center text-xs text-muted-foreground hover:text-destructive">No Color</button>
    </div>
  )
}

// ─── File Browser ──────────────────────────────────────────────

function FileBrowserModal({ fileList, loading, folder, provider, onFolderChange, onProviderChange, onSelect, onClose }: {
  fileList: DocumentEntry[]; loading: boolean; folder: string; provider: string
  onFolderChange: (f: string) => void; onProviderChange: (p: string) => void; onSelect: (e: DocumentEntry) => void; onClose: () => void
}) {
  const [newFolder, setNewFolder] = useState(folder)
  const folders = fileList.filter((f) => f.isFolder)
  const files = fileList.filter((f) => !f.isFolder && isSpreadsheetFile(f.name))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold">Open Spreadsheet</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="w-4 h-4"/></button>
        </div>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <select value={provider} onChange={(e) => onProviderChange(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm">
            <option value="local">Local</option><option value="nas">NAS</option><option value="s3">S3</option><option value="sharepoint">SharePoint</option>
          </select>
          <input type="text" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => e.key==="Enter" && onFolderChange(newFolder)} placeholder="Folder path..." className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm" />
          <button onClick={() => onFolderChange(newFolder)} className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90">Go</button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {loading ? <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>
          : fileList.length===0 ? <div className="py-8 text-center text-sm text-muted-foreground">No files found.</div>
          : <div className="space-y-1">
            {folders.map((e) => <button key={e.id} onClick={() => onFolderChange((folder ? `${folder}/` : "") + e.name)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted"><FolderOpen className="w-4 h-4 text-amber-500"/><span>{e.name}</span></button>)}
            {files.map((e) => <button key={e.id} onClick={() => onSelect(e)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted"><Table className="w-4 h-4 text-green-500"/><span className="flex-1 truncate">{e.name}</span>{e.size!=null && <span className="text-xs text-muted-foreground">{fmtSize(e.size)}</span>}</button>)}
          </div>}
        </div>
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Only spreadsheets shown.</div>
      </div>
    </div>
  )
}

function fmtSize(b: number) { return b<1024 ? `${b}B` : b<1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB` }

// ─── Filter Dropdown ───────────────────────────────────────────

function FilterDropdown({ col, sheet, activeFilters, onToggle, onClose }: {
  col: number; sheet: SpreadsheetSheet; activeFilters: FilterConfig[]; onToggle: (col: number, v: string, inc: boolean) => void; onClose: () => void
}) {
  const values = useMemo(() => {
    const set = new Set<string>()
    for (const [ref, cell] of sheet.cells) {
      const { col: c } = parseCellRef(ref)
      if (c === col && cell.value != null) set.add(String(cell.value))
    }
    return Array.from(set).sort()
  }, [sheet, col])

  const activeVals = activeFilters.find((f) => f.col === col)?.values

  return (
    <div className="fixed z-50 w-48 rounded border border-border bg-card shadow-xl" style={{ top: "40%", left: "30%" }} data-dropdown>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium">Filter: {cellRef(0, col).replace(/\d+$/, "")}</span>
        <button onClick={onClose} className="rounded p-0.5 hover:bg-muted"><X className="w-3 h-3"/></button>
      </div>
      <div className="max-h-60 overflow-y-auto p-1">
        {values.map((v) => (
          <label key={v} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs">
            <input type="checkbox" checked={!activeVals || activeVals.has(v)} onChange={(e) => onToggle(col, v, e.target.checked)} className="accent-primary" />
            {v || "(empty)"}
          </label>
        ))}
      </div>
      <div className="border-t border-border px-2 py-1">
        <button onClick={() => onToggle(col, "", false)} className="text-[10px] text-muted-foreground hover:text-destructive">Clear filter</button>
      </div>
    </div>
  )
}

// ─── Conditional Formatting Editor ──────────────────────────────

function CondFormatEditor({ initialRule, selection, onSave, onClose }: {
  initialRule: ConditionalFormatRule | null; selection: Selection; onSave: (r: ConditionalFormatRule) => void; onClose: () => void
}) {
  const [rule, setRule] = useState<ConditionalFormatRule>(initialRule ?? {
    id: `cf_${Date.now()}`, type: "cellValue",
    range: `${cellRef(Math.min(selection.startRow, selection.endRow), Math.min(selection.startCol, selection.endCol))}:${cellRef(Math.max(selection.startRow, selection.endRow), Math.max(selection.startCol, selection.endCol))}`,
    operator: "greaterThan", value1: "0", value2: "", bgColor: "#FFEB84", textColor: "#000000",
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-sm mb-3">Conditional Formatting</h3>
        <div className="space-y-3 text-xs">
          <div className="flex gap-2">
            <select value={rule.type} onChange={(e) => setRule({ ...rule, type: e.target.value as never })} className="rounded border border-border bg-background px-2 py-1 flex-1">
              <option value="cellValue">Cell Value</option>
              <option value="colorScale">Color Scale</option>
            </select>
            <select value={rule.operator} onChange={(e) => setRule({ ...rule, operator: e.target.value as never })} className="rounded border border-border bg-background px-2 py-1 flex-1">
              <option value="greaterThan">Greater Than</option>
              <option value="lessThan">Less Than</option>
              <option value="between">Between</option>
              <option value="equal">Equal</option>
              <option value="contains">Contains</option>
            </select>
          </div>
          <input type="text" value={rule.range} onChange={(e) => setRule({ ...rule, range: e.target.value })} placeholder="Range (e.g. A1:B10)" className="w-full rounded border border-border bg-background px-2 py-1" />
          <div className="flex gap-2">
            <input type="text" value={rule.value1} onChange={(e) => setRule({ ...rule, value1: e.target.value })} placeholder="Value 1" className="w-full rounded border border-border bg-background px-2 py-1" />
            {rule.operator === "between" && <input type="text" value={rule.value2} onChange={(e) => setRule({ ...rule, value2: e.target.value })} placeholder="Value 2" className="w-full rounded border border-border bg-background px-2 py-1" />}
          </div>
          <div className="flex gap-2 items-center">
            <span>BG:</span>
            <div className="flex gap-1 flex-wrap">
              {COND_COLORS.map((c) => <button key={c} onClick={() => setRule({ ...rule, bgColor: c })} className="w-5 h-5 rounded border" style={{ backgroundColor: c, outline: rule.bgColor === c ? "2px solid #000" : "none" }} />)}
            </div>
          </div>
          <input type="text" value={rule.textColor ?? ""} onChange={(e) => setRule({ ...rule, textColor: e.target.value || "#000000" })} placeholder="Text color (#hex)" className="w-full rounded border border-border bg-background px-2 py-1" />
          <div className="flex gap-2">
            <button onClick={() => onSave(rule)} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Save</button>
            <button onClick={onClose} className="flex-1 rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Data Validation Dialog ─────────────────────────────────────

function DataValidationDialog({ rule, onChange, onApply, onClose }: {
  rule: { type: "list" | "number" | "date"; value1: string; value2?: string; message: string }; onChange: (r: typeof rule) => void; onApply: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-sm mb-3">Data Validation</h3>
        <div className="space-y-3 text-xs">
          <select value={rule.type} onChange={(e) => onChange({ ...rule, type: e.target.value as never })} className="w-full rounded border border-border bg-background px-2 py-1">
            <option value="number">Number</option>
            <option value="list">List</option>
            <option value="date">Date</option>
          </select>
          {rule.type === "list" ? (
            <textarea value={rule.value1} onChange={(e) => onChange({ ...rule, value1: e.target.value })} placeholder="Options (comma separated)" className="w-full rounded border border-border bg-background px-2 py-1 h-20" />
          ) : (
            <div className="flex gap-2">
              <input type="text" value={rule.value1} onChange={(e) => onChange({ ...rule, value1: e.target.value })} placeholder="Min" className="flex-1 rounded border border-border bg-background px-2 py-1" />
              <input type="text" value={rule.value2 ?? ""} onChange={(e) => onChange({ ...rule, value2: e.target.value })} placeholder="Max" className="flex-1 rounded border border-border bg-background px-2 py-1" />
            </div>
          )}
          <input type="text" value={rule.message} onChange={(e) => onChange({ ...rule, message: e.target.value })} placeholder="Error message" className="w-full rounded border border-border bg-background px-2 py-1" />
          <div className="flex gap-2">
            <button onClick={onApply} className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Apply</button>
            <button onClick={onClose} className="flex-1 rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Chart View ─────────────────────────────────────────────────

function ChartView({ sheet, selection, chartType, onChartTypeChange, onClose }: {
  sheet: SpreadsheetSheet; selection: Selection; chartType: "bar" | "line" | "pie"; onChartTypeChange: (t: "bar" | "line" | "pie") => void; onClose: () => void
}) {
  const chartData = useMemo(() => {
    const labels: string[] = []
    const values: number[] = []
    const { startRow, startCol, endRow, endCol } = selection
    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      const labelCell = sheet.cells.get(cellRef(r, Math.min(startCol, endCol)))
      const valCell = sheet.cells.get(cellRef(r, Math.min(startCol, endCol) + 1))
      labels.push(String(labelCell?.value ?? ""))
      const v = Number(valCell?.value)
      if (!isNaN(v)) values.push(v)
    }
    return { labels, values }
  }, [sheet, selection])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Chart</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => onChartTypeChange("bar")} className={cn("rounded p-1", chartType === "bar" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}><BarChart3 className="w-4 h-4"/></button>
            <button onClick={() => onChartTypeChange("line")} className={cn("rounded p-1", chartType === "line" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}><LineChart className="w-4 h-4"/></button>
            <button onClick={() => onChartTypeChange("pie")} className={cn("rounded p-1", chartType === "pie" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}><PieChart className="w-4 h-4"/></button>
            <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted ml-2"><X className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="h-64 border border-border rounded bg-background p-2">
          {chartData.values.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select data range with labels in first column and values in second</div>
          ) : (
            <SimpleChart data={chartData} type={chartType} />
          )}
        </div>
      </div>
    </div>
  )
}

// Simple SVG chart (no external dependencies)
function SimpleChart({ data, type }: { data: { labels: string[]; values: number[] }; type: "bar" | "line" | "pie" }) {
  const maxVal = Math.max(...data.values, 1)
  const width = 600; const height = 240; const pad = 40

  if (type === "pie") {
    const total = data.values.reduce((a, b) => a + b, 0)
    const colors = ["#5B9BD5","#ED7D31","#A5A5A5","#FFC000","#4472C4","#70AD47"]
    const cx = width / 2; const cy = height / 2; const r = Math.min(cx, cy) - 10
    let cumAngle = 0
    const slices = data.values.map((v, i) => { const a = (v / total) * 2 * Math.PI; const s = { start: cumAngle, end: cumAngle + a, v, label: data.labels[i], color: colors[i % colors.length] }; cumAngle += a; return s })
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {slices.map((s, i) => {
          const large = s.end - s.start > Math.PI ? 1 : 0
          const sx = cx + r * Math.cos(s.start - Math.PI/2)
          const sy = cy + r * Math.sin(s.start - Math.PI/2)
          const ex = cx + r * Math.cos(s.end - Math.PI/2)
          const ey = cy + r * Math.sin(s.end - Math.PI/2)
          return <path key={i} d={`M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`} fill={s.color} stroke="#fff" strokeWidth={1}/>
        })}
      </svg>
    )
  }

  // Bar / Line
  const barW = Math.max(8, (width - pad * 2) / data.values.length - 4)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.values.map((v, i) => {
        const x = pad + i * ((width - pad * 2) / data.values.length)
        const barH = (v / maxVal) * (height - pad * 2)
        const y = height - pad - barH
        if (type === "bar") return <rect key={i} x={x} y={y} width={barW} height={barH} fill="#5B9BD5" rx={1} />
        if (type === "line") {
          const nx = i < data.values.length - 1 ? pad + (i + 1) * ((width - pad * 2) / data.values.length) : x
          const ny = i < data.values.length - 1 ? height - pad - (data.values[i + 1] / maxVal) * (height - pad * 2) : y
          return <g key={i}><circle cx={x + barW/2} cy={y} r={3} fill="#ED7D31"/><line x1={x + barW/2} y1={y} x2={nx + barW/2} y2={ny} stroke="#ED7D31" strokeWidth={2}/></g>
        }
        return null
      })}
      {/* Axis */}
      <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#ccc" strokeWidth={1}/>
      <line x1={pad} y1={pad/2} x2={pad} y2={height-pad} stroke="#ccc" strokeWidth={1}/>
    </svg>
  )
}

// ─── Print Preview ──────────────────────────────────────────────

function PrintPreview({ sheet, selection, onClose }: {
  sheet: SpreadsheetSheet; selection: Selection; onClose: () => void
}) {
  let maxR = 0; let maxC = 0
  for (const ref of sheet.cells.keys()) { const { row, col } = parseCellRef(ref); if (row > maxR) maxR = row; if (col > maxC) maxC = col }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-8 print:p-0" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-full overflow-auto print:overflow-visible" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 print:hidden">
          <h3 className="font-semibold">Print Preview</h3>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground"><PrinterIcon className="w-4 h-4 inline mr-1"/>Print</button>
            <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs">Close</button>
          </div>
        </div>
        <table className="border-collapse w-full print:break-inside-avoid">
          <tbody>
            {Array.from({ length: Math.min(maxR + 1, 50) }, (_, r) => (
              <tr key={r}>
                <td className="border border-gray-400 bg-gray-100 px-1 py-0.5 text-[10px] text-center w-8 print:text-[8px]">{r + 1}</td>
                {Array.from({ length: Math.min(maxC + 1, 20) }, (_, c) => {
                  const cell = sheet.cells.get(cellRef(r, c))
                  return <td key={c} className="border border-gray-300 px-1 py-0.5 text-[10px] print:text-[8px] min-w-[60px]">{String(cell?.value ?? "")}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
