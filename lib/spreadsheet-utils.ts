/**
 * Spreadsheet Editor utility functions
 *
 * Handles:
 * - .xlsx import/export via SheetJS
 * - Cell data management
 * - Formula evaluation (basic)
 * - Storage integration (REGMINDER document API)
 */

import * as XLSX from "xlsx"

// ─── Types ──────────────────────────────────────────────────────

export interface SpreadsheetCell {
  value: string | number | boolean | null
  formula?: string
  format?: string | NumberFormatConfig
  style?: CellStyle
  rowspan?: number
  colspan?: number
  note?: string
  protection?: { locked?: boolean; hidden?: boolean }
  validation?: { type: string; value1: string; value2?: string; message: string }
}

export interface CellStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: "left" | "center" | "right"
  valign?: "top" | "middle" | "bottom"
  fontSize?: number
  fontFamily?: string
  bgColor?: string
  textColor?: string
  wrapText?: boolean
  textRotation?: number
  border?: {
    top?: boolean
    right?: boolean
    bottom?: boolean
    left?: boolean
  }
}

export interface SpreadsheetSheet {
  name: string
  cells: Map<string, SpreadsheetCell>
  merges: Array<{ start: string; end: string }>
  colWidths: Map<number, number>
  rowHeights: Map<number, number>
  freeze?: { row: number; col: number }
  tabColor?: string
}

export interface SpreadsheetData {
  sheets: SpreadsheetSheet[]
  activeSheet: number
  created: Date
  modified: Date
}

export interface CellRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

// ─── Cell Reference Utilities ───────────────────────────────────

/** Convert (row, col) to "A1" style reference */
export function cellRef(row: number, col: number): string {
  let ref = ""
  let c = col
  while (c >= 0) {
    ref = String.fromCharCode(65 + (c % 26)) + ref
    c = Math.floor(c / 26) - 1
  }
  return ref + (row + 1)
}

/** Parse "A1" style reference to { row, col } */
export function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/)
  if (!match) throw new Error(`Invalid cell reference: ${ref}`)
  const colStr = match[1]
  const row = parseInt(match[2], 10) - 1
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  return { row, col: col - 1 }
}

/** Parse range like "A1:B5" */
export function parseRange(range: string): CellRange {
  const parts = range.split(":")
  if (parts.length !== 2) throw new Error(`Invalid range: ${range}`)
  const start = parseCellRef(parts[0])
  const end = parseCellRef(parts[1])
  return {
    startRow: start.row,
    startCol: start.col,
    endRow: end.row,
    endCol: end.col,
  }
}

// ─── .xlsx Import ───────────────────────────────────────────────

/**
 * Read an .xlsx file and return SpreadsheetData structure.
 */
export async function readXlsx(buffer: ArrayBuffer): Promise<SpreadsheetData> {
  const workbook = XLSX.read(buffer, { type: "array", cellStyles: true })
  const sheets: SpreadsheetSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const cells = new Map<string, SpreadsheetCell>()
    const merges: Array<{ start: string; end: string }> = []
    const colWidths = new Map<number, number>()
    const rowHeights = new Map<number, number>()

    // Parse cells
    for (const [ref, cell] of Object.entries(worksheet)) {
      if (ref.startsWith("!")) continue

      const cellData: SpreadsheetCell = {
        value: cell.v as string | number | boolean | null ?? null,
      }

      if (cell.f) {
        cellData.formula = cell.f as string
      }

      if (cell.z) {
        cellData.format = cell.z as string
      }

      // Extract style information
      const style: CellStyle = {}
      if ((cell as unknown as Record<string, unknown>).s) {
        const s = (cell as unknown as Record<string, unknown>).s as {
          bold?: boolean
          italic?: boolean
          underline?: boolean
          alignment?: { horizontal?: CellStyle["align"]; vertical?: CellStyle["valign"] }
          fgColor?: { rgb?: string }
          font?: { color?: { rgb?: string }; sz?: number; name?: string }
        }
        if (s.bold) style.bold = true
        if (s.italic) style.italic = true
        if (s.underline) style.underline = true
        if (s.alignment?.horizontal) {
          style.align = s.alignment.horizontal as CellStyle["align"]
        }
        if (s.alignment?.vertical) {
          style.valign = s.alignment.vertical as CellStyle["valign"]
        }
        if (s.fgColor?.rgb) {
          style.bgColor = `#${s.fgColor.rgb}`
        }
        if (s.font?.color?.rgb) {
          style.textColor = `#${s.font.color.rgb}`
        }
        if (s.font?.sz) {
          style.fontSize = s.font.sz as number
        }
        if (s.font?.name) {
          style.fontFamily = s.font.name as string
        }
      }

      if (Object.keys(style).length > 0) {
        cellData.style = style
      }

      cells.set(ref, cellData)
    }

    // Parse merges
    if (worksheet["!merges"]) {
      for (const merge of worksheet["!merges"]) {
        const start = cellRef(merge.s.r, merge.s.c)
        const end = cellRef(merge.e.r, merge.e.c)
        merges.push({ start, end })
      }
    }

    // Parse column widths
    if (worksheet["!cols"]) {
      worksheet["!cols"].forEach((col, i) => {
        if (col?.wch) {
          colWidths.set(i, col.wch)
        }
      })
    }

    // Parse row heights
    if (worksheet["!rows"]) {
      worksheet["!rows"].forEach((row, i) => {
        if (row?.hpt) {
          rowHeights.set(i, row.hpt)
        }
      })
    }

    // Parse freeze panes
    let freeze: { row: number; col: number } | undefined
    if (worksheet["!freeze"]) {
      freeze = {
        row: (worksheet["!freeze"] as unknown as Record<string, number>).x ?? 0,
        col: (worksheet["!freeze"] as unknown as Record<string, number>).y ?? 0,
      }
    }

    sheets.push({
      name: sheetName,
      cells,
      merges,
      colWidths,
      rowHeights,
      freeze,
    })
  }

  return {
    sheets,
    activeSheet: 0,
    created: new Date(),
    modified: new Date(),
  }
}

/** Read .xlsx from base64 string */
export async function readXlsxFromBase64(base64: string): Promise<SpreadsheetData> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return readXlsx(bytes.buffer)
}

// ─── .xlsx Export ───────────────────────────────────────────────

/**
 * Convert SpreadsheetData to .xlsx file (as Blob).
 */
export function writeXlsx(data: SpreadsheetData): Blob {
  const workbook = XLSX.utils.book_new()

  for (const sheet of data.sheets) {
    // Build worksheet from cells map
    const worksheet: XLSX.WorkSheet = {}
    const range: XLSX.Range = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }

    // Find extent
    for (const [ref, cell] of sheet.cells) {
      const { row, col } = parseCellRef(ref)
      if (row > range.e.r) range.e.r = row
      if (col > range.e.c) range.e.c = col
    }

    // Add cells
    for (const [ref, cell] of sheet.cells) {
      const xlsxCell: XLSX.CellObject = {
        t: typeof cell.value === "number" ? "n" : typeof cell.value === "boolean" ? "b" : "s",
        v: cell.value ?? "",
      }
      if (cell.formula) {
        xlsxCell.f = cell.formula
      }
      if (cell.format) {
        if (typeof cell.format === "string") {
          xlsxCell.z = cell.format
        } else {
          const decimals = cell.format.decimalPlaces ?? 2
          const decimalPart = decimals > 0 ? `.${"0".repeat(decimals)}` : ""
          const numberPattern = `${cell.format.useThousands ? "#,##0" : "0"}${decimalPart}`
          xlsxCell.z = cell.format.type === "percentage" ? `${numberPattern}%`
            : cell.format.type === "currency" || cell.format.type === "accounting" ? `${cell.format.currencySymbol ?? "$"}${numberPattern}`
            : cell.format.type === "date" ? (cell.format.dateFormat ?? "yyyy-mm-dd")
            : cell.format.type === "time" ? "hh:mm"
            : cell.format.type === "scientific" ? "0.00E+00"
            : cell.format.type === "text" ? "@"
            : numberPattern
        }
      }
      worksheet[ref] = xlsxCell
    }

    // Set range
    worksheet["!ref"] = XLSX.utils.encode_range(range)

    // Set merges
    if (sheet.merges.length > 0) {
      worksheet["!merges"] = sheet.merges.map((m) => {
        const start = parseCellRef(m.start)
        const end = parseCellRef(m.end)
        return {
          s: { r: start.row, c: start.col },
          e: { r: end.row, c: end.col },
        }
      })
    }

    // Set column widths
    if (sheet.colWidths.size > 0) {
      const maxCol = Math.max(...Array.from(sheet.colWidths.keys()))
      worksheet["!cols"] = Array.from({ length: maxCol + 1 }, (_, i) => ({
        wch: sheet.colWidths.get(i) ?? 10,
      }))
    }

    // Add sheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

/** Convert SpreadsheetData to base64 .xlsx */
export async function writeXlsxToBase64(data: SpreadsheetData): Promise<string> {
  const blob = writeXlsx(data)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1] ?? result)
    }
    reader.onerror = () => reject(new Error("Failed to convert to base64"))
    reader.readAsDataURL(blob)
  })
}

// ─── Formula Evaluation ──────────────────────────────────────────

/** Get all values from a range or single cell ref (returns all values including strings) */
function getRangeValues(ref: string, getCell: (ref: string) => SpreadsheetCell | undefined): (number | string | boolean | null)[] {
  if (ref.includes(":")) {
    const range = parseRange(ref)
    const values: (number | string | boolean | null)[] = []
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const cell = getCell(cellRef(r, c))
        values.push(cell?.value ?? null)
      }
    }
    return values
  }
  const cell = getCell(ref)
  return [cell?.value ?? null]
}

function getNumericValues(ref: string, getCell: (ref: string) => SpreadsheetCell | undefined): number[] {
  return getRangeValues(ref, getCell).filter((v): v is number => typeof v === "number")
}

/**
 * Evaluate a formula. Supports 40+ Excel-compatible functions.
 */
export function evaluateFormula(
  formula: string,
  getCell: (ref: string) => SpreadsheetCell | undefined
): number | string | boolean {
  try {
    const expr = formula.startsWith("=") ? formula.slice(1) : formula

    const funcMatch = expr.match(/^(\w+)\((.+)\)$/i)
    if (funcMatch) {
      const func = funcMatch[1].toUpperCase()
      const args = funcMatch[2].split(",").map((s) => s.trim())

      switch (func) {
        // Math
        case "SUM": return getNumericValues(args[0], getCell).reduce((a, b) => a + b, 0)
        case "AVERAGE":
        case "AVG": {
          const nums = getNumericValues(args[0], getCell)
          return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
        }
        case "COUNT": return getRangeValues(args[0], getCell).filter((v) => v !== null && v !== "").length
        case "COUNTA": return getRangeValues(args[0], getCell).filter((v) => v !== null).length
        case "COUNTBLANK": return getRangeValues(args[0], getCell).filter((v) => v === null || v === "").length
        case "MIN": {
          const n = getNumericValues(args[0], getCell)
          return n.length > 0 ? Math.min(...n) : 0
        }
        case "MAX": {
          const n = getNumericValues(args[0], getCell)
          return n.length > 0 ? Math.max(...n) : 0
        }
        case "ABS": return Math.abs(Number(getCell(args[0])?.value) || 0)
        case "ROUND": {
          const val = Number(getCell(args[0])?.value) || 0
          const dec = parseInt(args[1]) || 0
          return Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec)
        }
        case "ROUNDUP": {
          const val = Number(getCell(args[0])?.value) || 0
          const dec = parseInt(args[1]) || 0
          const mult = Math.pow(10, dec)
          return Math.ceil(val * mult) / mult
        }
        case "ROUNDDOWN": {
          const val = Number(getCell(args[0])?.value) || 0
          const dec = parseInt(args[1]) || 0
          const mult = Math.pow(10, dec)
          return Math.floor(val * mult) / mult
        }
        case "INT": return Math.floor(Number(getCell(args[0])?.value) || 0)
        case "SQRT": return Math.sqrt(Number(getCell(args[0])?.value) || 0)
        case "POWER":
        case "POW": return Math.pow(Number(getCell(args[0])?.value) || 0, Number(getCell(args[1])?.value) || 0)
        case "MOD": return (Number(getCell(args[0])?.value) || 0) % (Number(getCell(args[1])?.value) || 1)
        case "PRODUCT": return getNumericValues(args[0], getCell).reduce((a, b) => a * b, 1)
        case "SUMPRODUCT": {
          const a = getNumericValues(args[0], getCell)
          const b = getNumericValues(args[1], getCell)
          return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0)
        }
        case "SUBTOTAL": {
          const n = getNumericValues(args[1], getCell)
          const fn = parseInt(args[0]) || 9
          if (n.length === 0) return fn === 2 ? 0 : 0
          if (fn === 1 || fn === 101) return n.reduce((a, b) => a + b, 0) / n.length
          if (fn === 2 || fn === 102) return n.length
          if (fn === 4 || fn === 104) return Math.max(...n)
          if (fn === 5 || fn === 105) return Math.min(...n)
          if (fn === 6 || fn === 106) return n.reduce((a, b) => a * b, 1)
          return n.reduce((a, b) => a + b, 0) // 9/109 SUM default
        }

        // Text
        case "CONCATENATE":
        case "CONCAT": return args.map((a) => String(getCell(a)?.value ?? a)).join("")
        case "TEXTJOIN": {
          const delim = args[0].replace(/^["']|["']$/g, "")
          const ignoreEmpty = args[1].trim() === "TRUE"
          const rangeVals = getRangeValues(args[2], getCell)
          return rangeVals.filter((v) => !ignoreEmpty || (v !== null && v !== "")).map(String).join(delim)
        }
        case "LEFT": {
          const txt = String(getCell(args[0])?.value ?? "")
          const n = parseInt(args[1]) || 1
          return txt.slice(0, n)
        }
        case "RIGHT": {
          const txt = String(getCell(args[0])?.value ?? "")
          const n = parseInt(args[1]) || 1
          return txt.slice(-n)
        }
        case "MID": {
          const txt = String(getCell(args[0])?.value ?? "")
          const start = (parseInt(args[1]) || 1) - 1
          const n = parseInt(args[2]) || 1
          return txt.slice(start, start + n)
        }
        case "LEN": return String(getCell(args[0])?.value ?? "").length
        case "UPPER": return String(getCell(args[0])?.value ?? "").toUpperCase()
        case "LOWER": return String(getCell(args[0])?.value ?? "").toLowerCase()
        case "TRIM": return String(getCell(args[0])?.value ?? "").trim().replace(/\s+/g, " ")
        case "PROPER": {
          return String(getCell(args[0])?.value ?? "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        }
        case "REPLACE":
        case "SUBSTITUTE": {
          const txt = String(getCell(args[0])?.value ?? "")
          const oldText = String(args[1] ?? "")
          const newText = String(args[2] ?? "")
          if (args[3]) {
            const instance = parseInt(args[3])
            let count = 0
            return txt.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), (m) => {
              count++
              return count === instance ? newText : m
            })
          }
          return txt.split(oldText).join(newText)
        }

        // Logic
        case "IF": {
          const cond = evaluateCondition(args[0], getCell)
          return cond ? getCell(args[1])?.value ?? args[1] : getCell(args[2])?.value ?? args[2]
        }
        case "IFERROR": {
          try {
            const cell = getCell(args[0])
            return cell?.value ?? evaluateFormula(`=${args[0]}`, getCell)
          } catch { return args[1] ?? "" }
        }
        case "AND": return args.every((a) => evaluateCondition(a, getCell)) ? true : "FALSE"
        case "OR": return args.some((a) => evaluateCondition(a, getCell)) ? true : "FALSE"
        case "NOT": return !evaluateCondition(args[0], getCell)
        case "IFS": {
          for (let i = 0; i < args.length - 1; i += 2) {
            if (evaluateCondition(args[i], getCell)) return getCell(args[i + 1])?.value ?? args[i + 1]
          }
          return "#N/A"
        }
        case "ISBLANK": return (getCell(args[0])?.value == null || getCell(args[0])?.value === "") ? true : false
        case "ISNUMBER": return typeof getCell(args[0])?.value === "number" ? true : false
        case "ISTEXT": return typeof getCell(args[0])?.value === "string" ? true : false
        case "ISERROR": {
          try { evaluateFormula(`=${args[0]}`, getCell); return false }
          catch { return true }
        }

        // Lookup
        case "VLOOKUP": {
          const lookupVal = Number(getCell(args[0])?.value) || String(getCell(args[0])?.value ?? "")
          const colIdx = (parseInt(args[2]) || 1) - 1
          const rangeMatch = args.length >= 4 && args[3].trim().toUpperCase() === "FALSE"
          const range = parseRange(args[1])
          const values = getRangeValues(args[1], getCell)
          const numRows = range.endRow - range.startRow + 1
          const numCols = range.endCol - range.startCol + 1
          const idx = values.findIndex((v) => rangeMatch ? v === lookupVal : String(v).startsWith(String(lookupVal)))
          if (idx < 0) return "#N/A"
          const targetIdx = Math.floor(idx / numCols) * numCols + colIdx
          return values[targetIdx] ?? "#N/A"
        }
        case "HLOOKUP": {
          const lookupVal = Number(getCell(args[0])?.value) || String(getCell(args[0])?.value ?? "")
          const rowIdx = (parseInt(args[2]) || 1) - 1
          const range = parseRange(args[1])
          const values = getRangeValues(args[1], getCell)
          const numCols = range.endCol - range.startCol + 1
          const idx = values.findIndex((v) => v === lookupVal)
          if (idx < 0) return "#N/A"
          return values[idx + rowIdx * numCols] ?? "#N/A"
        }
        case "INDEX": {
          const range = parseRange(args[0])
          const row = (parseInt(args[1]) || 1) - 1
          const col = args.length >= 3 ? (parseInt(args[2]) || 1) - 1 : 0
          return getCell(cellRef(range.startRow + row, range.startCol + col))?.value ?? "#REF!"
        }
        case "MATCH": {
          const lookupVal = String(getCell(args[0])?.value ?? args[0])
          const values = getRangeValues(args[1], getCell)
          const matchType = parseInt(args[2]) || 0
          const idx = matchType === 0
            ? values.findIndex((v) => String(v) === lookupVal)
            : matchType < 0
              ? values.findIndex((v) => Number(v) >= Number(lookupVal))
              : values.findIndex((v) => Number(v) >= Number(lookupVal))
          return idx < 0 ? "#N/A" : idx + 1
        }

        // Date
        case "TODAY": return new Date().toISOString().split("T")[0]
        case "NOW": return new Date().toISOString()
        case "YEAR": {
          const dt = String(getCell(args[0])?.value ?? "")
          return new Date(dt).getFullYear()
        }
        case "MONTH": {
          const dt = String(getCell(args[0])?.value ?? "")
          return new Date(dt).getMonth() + 1
        }
        case "DAY": {
          const dt = String(getCell(args[0])?.value ?? "")
          return new Date(dt).getDate()
        }
        case "DATEDIF": {
          const d1 = new Date(getCell(args[0])?.value as string ?? "")
          const d2 = new Date(getCell(args[1])?.value as string ?? "")
          const unit = (args[2] ?? "d").toUpperCase()
          const diff = d2.getTime() - d1.getTime()
          if (unit === "D") return Math.floor(diff / 86400000)
          if (unit === "M") return (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth()
          if (unit === "Y") return d2.getFullYear() - d1.getFullYear()
          return Math.floor(diff / 86400000)
        }

        // Statistical
        case "MEDIAN": {
          const n = getNumericValues(args[0], getCell).sort((a, b) => a - b)
          if (n.length === 0) return 0
          return n.length % 2 === 0 ? (n[n.length / 2 - 1] + n[n.length / 2]) / 2 : n[Math.floor(n.length / 2)]
        }
        case "MODE": {
          const n = getNumericValues(args[0], getCell)
          const freq = new Map<number, number>()
          n.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1))
          let maxFreq = 0, mode = 0
          freq.forEach((f, v) => { if (f > maxFreq) { maxFreq = f; mode = v } })
          return n.length > 0 ? mode : 0
        }
        case "STDEV": {
          const n = getNumericValues(args[0], getCell)
          if (n.length < 2) return 0
          const mean = n.reduce((a, b) => a + b, 0) / n.length
          return Math.sqrt(n.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n.length - 1))
        }
        case "VAR": {
          const n = getNumericValues(args[0], getCell)
          if (n.length < 2) return 0
          const mean = n.reduce((a, b) => a + b, 0) / n.length
          return n.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n.length - 1)
        }
        case "RAND": return Math.random()
        case "RANDBETWEEN": return Math.floor(Math.random() * (parseInt(args[1]) - parseInt(args[0]) + 1)) + parseInt(args[0])
        case "PI": return Math.PI

        default: return `#NAME?`
      }
    }

    const safeExpr = expr.replace(/[A-Z]+\d+/gi, (ref) => {
      const cell = getCell(ref)
      const v = cell?.value
      return typeof v === "number" ? String(v) : typeof v === "string" && !isNaN(Number(v)) ? v : "0"
    })

    try {
      const result = new Function(`return (${safeExpr})`)()
      return typeof result === "number" ? result : `#VALUE!`
    } catch {
      return `#ERROR!`
    }
  } catch {
    return `#ERROR!`
  }
}

function evaluateCondition(expr: string, getCell: (ref: string) => SpreadsheetCell | undefined): boolean {
  let val: unknown = expr
  if (/^[A-Z]+\d+$/i.test(expr)) {
    val = getCell(expr)?.value ?? expr
  } else if (expr === "TRUE") return true
  else if (expr === "FALSE") return false
  try { val = new Function(`return (${expr})`)(); } catch { /* expr as-is */ }

  // Handle comparisons within a single arg string
  if (typeof val === "string" && /[<>=!]+/.test(val)) {
    const cmp = val.match(/^(.+?)([<>=!]=?)(.+)$/)
    if (cmp) {
      const a = Number(cmp[1]) || cmp[1]
      const op = cmp[2]
      const b = Number(cmp[3]) || cmp[3]
      switch (op) {
        case "=": case "==": return a === b
        case "!=": case "<>": return a !== b
        case ">": return Number(a) > Number(b)
        case "<": return Number(a) < Number(b)
        case ">=": return Number(a) >= Number(b)
        case "<=": return Number(a) <= Number(b)
      }
    }
  }

  return Boolean(val)
}

// ─── Number Formatting ───────────────────────────────────────────

export type NumberFormat = "general" | "number" | "currency" | "accounting" | "date" | "time" | "percentage" | "fraction" | "scientific" | "text"

export interface NumberFormatConfig {
  type: NumberFormat
  decimalPlaces?: number
  useThousands?: boolean
  currencySymbol?: string
  dateFormat?: string
}

export function formatCellValue(value: unknown, config?: NumberFormatConfig): string {
  if (value == null || value === "") return ""

  if (!config || config.type === "general" || config.type === "text") {
    return String(value)
  }

  const num = typeof value === "number" ? value : parseFloat(String(value))
  if (isNaN(num)) return String(value)

  const decimals = config.decimalPlaces ?? 2

  switch (config.type) {
    case "number":
      return config.useThousands ? num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : num.toFixed(decimals)

    case "currency":
      return (config.currencySymbol ?? "$") + (config.useThousands ? num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : num.toFixed(decimals))

    case "accounting":
      return (config.currencySymbol ?? "$") + (config.useThousands ? Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : Math.abs(num).toFixed(decimals))

    case "percentage":
      return (num * 100).toFixed(decimals) + "%"

    case "scientific":
      return num.toExponential(decimals)

    case "date":
      if (typeof value === "number") {
        const d = new Date((value - 25569) * 86400 * 1000)
        return d.toLocaleDateString("en-US")
      }
      return new Date(String(value)).toLocaleDateString("en-US")

    case "time":
      if (typeof value === "number") {
        const totalSecs = Math.round(value * 86400)
        const h = Math.floor(totalSecs / 3600)
        const m = Math.floor((totalSecs % 3600) / 60)
        const s = totalSecs % 60
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      }
      return String(value)

    default:
      return String(value)
  }
}

// ─── Sort & Filter ───────────────────────────────────────────────

export interface SortConfig {
  col: number
  ascending: boolean
}

export interface FilterConfig {
  col: number
  values: Set<string>
}

export function sortSheetData(
  sheet: SpreadsheetSheet,
  configs: SortConfig[]
): SpreadsheetSheet {
  if (configs.length === 0) return sheet

  // Find max row
  let maxRow = 0
  for (const ref of sheet.cells.keys()) {
    const { row } = parseCellRef(ref)
    if (row > maxRow) maxRow = row
  }

  // Build row data
  const rows: Array<{ index: number; cells: Map<string, SpreadsheetCell> }> = []
  for (let r = 0; r <= maxRow; r++) {
    const rowCells = new Map<string, SpreadsheetCell>()
    for (const [ref, cell] of sheet.cells) {
      const { row } = parseCellRef(ref)
      if (row === r) rowCells.set(ref, cell)
    }
    rows.push({ index: r, cells: rowCells })
  }

  // Sort
  rows.sort((a, b) => {
    for (const cfg of configs) {
      const aCell = a.cells.get(cellRef(a.index, cfg.col))
      const bCell = b.cells.get(cellRef(b.index, cfg.col))
      const aVal = aCell?.value ?? ""
      const bVal = bCell?.value ?? ""

      if (typeof aVal === "number" && typeof bVal === "number") {
        if (aVal !== bVal) return cfg.ascending ? aVal - bVal : bVal - aVal
      } else {
        const cmp = String(aVal).localeCompare(String(bVal))
        if (cmp !== 0) return cfg.ascending ? cmp : -cmp
      }
    }
    return 0
  })

  // Rebuild cells with new row positions
  const newCells = new Map<string, SpreadsheetCell>()
  rows.forEach((row, newRowIdx) => {
    for (const [ref, cell] of row.cells) {
      const { col } = parseCellRef(ref)
      newCells.set(cellRef(newRowIdx, col), cell)
    }
  })

  return { ...sheet, cells: newCells }
}

export function filterSheetData(
  sheet: SpreadsheetSheet,
  configs: FilterConfig[]
): SpreadsheetSheet {
  if (configs.length === 0) return sheet

  let maxRow = 0
  for (const ref of sheet.cells.keys()) {
    const { row } = parseCellRef(ref)
    if (row > maxRow) maxRow = row
  }

  const newCells = new Map<string, SpreadsheetCell>()
  let newRow = 0

  for (let r = 0; r <= maxRow; r++) {
    let include = true
    for (const cfg of configs) {
      const cell = sheet.cells.get(cellRef(r, cfg.col))
      const val = String(cell?.value ?? "")
      if (!cfg.values.has(val)) { include = false; break }
    }
    if (include) {
      for (const [ref, cell] of sheet.cells) {
        const { row, col } = parseCellRef(ref)
        if (row === r) newCells.set(cellRef(newRow, col), cell)
      }
      newRow++
    }
  }

  return { ...sheet, cells: newCells }
}

// ─── Conditional Formatting ──────────────────────────────────────

export interface ConditionalFormatRule {
  id: string
  type: "cellValue" | "colorScale" | "dataBar" | "iconSet"
  range: string
  // cellValue
  operator?: "greaterThan" | "lessThan" | "between" | "equal" | "contains" | "notContains"
  value1?: string
  value2?: string
  // Style
  bgColor?: string
  textColor?: string
  bold?: boolean
  // colorScale
  minColor?: string
  midColor?: string
  maxColor?: string
}

export function evaluateConditionalFormat(
  cell: SpreadsheetCell | undefined,
  rules: ConditionalFormatRule[],
  ref: string
): Partial<SpreadsheetCell["style"]> | null {
  if (!cell) return null

  for (const rule of rules) {
    const range = parseRange(rule.range)
    const { row, col } = parseCellRef(ref)
    if (row < range.startRow || row > range.endRow || col < range.startCol || col > range.endCol) continue

    if (rule.type === "cellValue") {
      const val = cell.value
      const v1 = parseFloat(rule.value1 ?? "")
      const v2 = parseFloat(rule.value2 ?? "")

      let matches = false
      switch (rule.operator) {
        case "greaterThan": matches = Number(val) > v1; break
        case "lessThan": matches = Number(val) < v1; break
        case "between": matches = Number(val) >= v1 && Number(val) <= v2; break
        case "equal": matches = String(val) === String(rule.value1); break
        case "contains": matches = String(val).includes(rule.value1 ?? ""); break
        case "notContains": matches = !String(val).includes(rule.value1 ?? ""); break
      }

      if (matches) {
        return {
          bgColor: rule.bgColor,
          textColor: rule.textColor,
          bold: rule.bold,
        }
      }
    }

    if (rule.type === "colorScale") {
      const val = Number(cell.value)
      const min = parseFloat(rule.value1 ?? "0")
      const max = parseFloat(rule.value2 ?? "100")
      if (!isNaN(val) && !isNaN(min) && !isNaN(max)) {
        const ratio = Math.max(0, Math.min(1, (val - min) / (max - min || 1)))
        return { bgColor: interpolateColor(rule.minColor ?? "#63BE7B", rule.maxColor ?? "#F8696B", ratio) }
      }
    }
  }

  return null
}

function interpolateColor(c1: string, c2: string, ratio: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16)
  const g1 = parseInt(c1.slice(3, 5), 16)
  const b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16)
  const g2 = parseInt(c2.slice(3, 5), 16)
  const b2 = parseInt(c2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * ratio)
  const g = Math.round(g1 + (g2 - g1) * ratio)
  const b = Math.round(b1 + (b2 - b1) * ratio)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

// ─── Default/Empty Spreadsheet ───────────────────────────────────

export function createEmptySpreadsheet(): SpreadsheetData {
  const sheet: SpreadsheetSheet = {
    name: "Sheet1",
    cells: new Map(),
    merges: [],
    colWidths: new Map(),
    rowHeights: new Map(),
  }
  // Set default column widths
  for (let i = 0; i < 26; i++) {
    sheet.colWidths.set(i, 100)
  }
  return {
    sheets: [sheet],
    activeSheet: 0,
    created: new Date(),
    modified: new Date(),
  }
}

// ─── File Helpers ────────────────────────────────────────────────

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
export const XLS_MIME_TYPE = "application/vnd.ms-excel"
export const CSV_MIME_TYPE = "text/csv"

export function isSpreadsheetFile(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop()
  return ext === "xlsx" || ext === "xls" || ext === "csv"
}

export function openSpreadsheetFileDialog(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".xlsx,.xls,.csv"
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── CSV Helpers ─────────────────────────────────────────────────

export function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/)
  const result: string[][] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const row: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        row.push(current)
        current = ""
      } else {
        current += char
      }
    }
    row.push(current)
    result.push(row)
  }

  return result
}

export function csvToSpreadsheet(csv: string[][]): SpreadsheetData {
  const sheet: SpreadsheetSheet = {
    name: "Sheet1",
    cells: new Map(),
    merges: [],
    colWidths: new Map(),
    rowHeights: new Map(),
  }

  for (let r = 0; r < csv.length; r++) {
    for (let c = 0; c < csv[r].length; c++) {
      const val = csv[r][c]
      const num = parseFloat(val)
      sheet.cells.set(cellRef(r, c), {
        value: isNaN(num) ? val : num,
      })
    }
  }

  return {
    sheets: [sheet],
    activeSheet: 0,
    created: new Date(),
    modified: new Date(),
  }
}

export function spreadsheetToCsv(data: SpreadsheetData): string {
  const sheet = data.sheets[data.activeSheet]
  const lines: string[] = []

  // Find extent
  let maxRow = 0
  let maxCol = 0
  for (const ref of sheet.cells.keys()) {
    const { row, col } = parseCellRef(ref)
    if (row > maxRow) maxRow = row
    if (col > maxCol) maxCol = col
  }

  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = []
    for (let c = 0; c <= maxCol; c++) {
      const cell = sheet.cells.get(cellRef(r, c))
      const val = String(cell?.value ?? "")
      // Escape quotes and wrap in quotes if contains comma or quote
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        row.push(`"${val.replace(/"/g, '""')}"`)
      } else {
        row.push(val)
      }
    }
    lines.push(row.join(","))
  }

  return lines.join("\n")
}

// ─── Storage Integration ─────────────────────────────────────────

const DOC_API_BASE = "/api/proxy/api/v1/documents"

export interface DocumentEntry {
  id: string
  name: string
  provider: string
  path: string
  updatedAt: string
  isFolder?: boolean
  size?: number
}

export interface DocumentContent {
  name: string
  provider: string
  path: string
  updatedAt: string
  size: number
  contentBase64: string
}

export async function listDocuments(
  folder: string,
  provider: string = "local",
  includeFolders: boolean = false
): Promise<DocumentEntry[]> {
  const params = new URLSearchParams({ folder, provider })
  if (includeFolders) params.set("includeFolders", "true")
  const res = await fetch(`${DOC_API_BASE}?${params}`)
  if (!res.ok) throw new Error(`List failed: ${res.statusText}`)
  const data = await res.json()
  return data.items ?? data
}

export async function downloadDocument(
  name: string,
  folder: string = "",
  provider: string = "local"
): Promise<DocumentContent> {
  const params = new URLSearchParams({ name, folder, provider })
  const res = await fetch(`${DOC_API_BASE}/content?${params}`)
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`)
  const data = await res.json()
  return data.item ?? data
}

export async function uploadDocument(
  name: string,
  contentBase64: string,
  folder: string = "",
  provider: string = "local"
): Promise<DocumentEntry> {
  const res = await fetch(DOC_API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder, provider, contentBase64 }),
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
  return res.json()
}
