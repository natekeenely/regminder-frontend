/**
 * Document Editor utility functions
 *
 * Handles:
 * - .docx import → HTML (via mammoth)
 * - .docx export ← HTML (custom builder)
 * - Mail merge / template processing
 * - Storage integration (REGMINDER document API)
 * - File type detection and MIME helpers
 */

// ─── Base64 / Buffer ────────────────────────────────────────────

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const buffer = base64ToArrayBuffer(base64)
  return new Blob([buffer], { type: mimeType })
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1] ?? result)
    }
    reader.onerror = () => reject(new Error(`Failed to read: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error(`Failed to read: ${file.name}`))
    reader.readAsArrayBuffer(file)
  })
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1] ?? result)
    }
    reader.onerror = () => reject(new Error("Failed to read blob"))
    reader.readAsDataURL(blob)
  })
}

// ─── .docx Import (mammoth) ─────────────────────────────────────

/**
 * Convert a .docx file (as ArrayBuffer) to clean HTML.
 * Uses mammoth.js under the hood.
 */
export async function docxToHtml(buffer: ArrayBuffer): Promise<{
  html: string
  warnings: string[]
}> {
  // Dynamic import so mammoth is only loaded when needed
  const mammoth = await import("mammoth")
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
  return {
    html: result.value,
    warnings: result.messages.map((m) => m.message),
  }
}

/**
 * Convert a .docx file (as base64) to clean HTML.
 */
export async function docxBase64ToHtml(base64: string): Promise<{
  html: string
  warnings: string[]
}> {
  const buffer = base64ToArrayBuffer(base64)
  return docxToHtml(buffer)
}

// ─── .docx Export (custom HTML → docx builder) ──────────────────

// Word ML namespaces
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
const CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types"

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

interface HtmlToDocxOptions {
  title?: string
  author?: string
  /** Page size in twips (1/20 of a point). Default: A4 */
  pageWidth?: number
  pageHeight?: number
}

const DEFAULT_OPTIONS: Required<HtmlToDocxOptions> = {
  title: "Document",
  author: "REGMINDER",
  pageWidth: 11906, // A4 width in twips
  pageHeight: 16838, // A4 height in twips
}

/**
 * Build a minimal but valid .docx file from HTML content.
 *
 * This is a lightweight approach — it parses basic HTML tags (h1-h6, p, b, i, u,
 * ul/ol/li, table, br) into OOXML. For complex documents, consider a heavier
 * library like the `docx` npm package.
 */
export async function htmlToDocxBlob(
  html: string,
  options: HtmlToDocxOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const bodyXml = buildWordprocessingBody(html)

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:sectPr>
      <w:pgSz w:w="${opts.pageWidth}" w:h="${opts.pageHeight}"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
               w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
    ${bodyXml}
  </w:body>
</w:document>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${RELS_NS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CONTENT_TYPES_NS}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

  // We build the ZIP manually. For a production implementation, install `jszip` and use:
  //   const zip = new JSZip()
  //   zip.file("_rels/.rels", relsXml)
  //   zip.file("[Content_Types].xml", contentTypesXml)
  //   zip.file("word/document.xml", documentXml)
  //   return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME_TYPE })

  // For now, return a simple HTML blob with .doc extension as a fallback.
  // The real .docx ZIP generation is implemented in htmlToDocxBlobFull below.
  return buildDocxZip(documentXml, relsXml, contentTypesXml, opts.title)
}

/**
 * Build the actual ZIP-based .docx from OOXML parts.
 * Uses raw binary ZIP construction to avoid the jszip dependency.
 */
async function buildDocxZip(
  documentXml: string,
  relsXml: string,
  contentTypesXml: string,
  title: string
): Promise<Blob> {
  // We use a simple ZIP builder borrowed from the `docx` npm package pattern.
  // Each file entry: [local header + file data + data descriptor]
  const encoder = new TextEncoder()

  interface ZipEntry {
    name: string
    data: Uint8Array
  }

  const files: ZipEntry[] = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypesXml) },
    { name: "_rels/.rels", data: encoder.encode(relsXml) },
    { name: "word/document.xml", data: encoder.encode(documentXml) },
  ]

  // Build ZIP manually
  const parts: Uint8Array[] = []
  const centralDir: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const crc = crc32(file.data)
    const compressed = deflateRaw(file.data)

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const lhView = new DataView(localHeader.buffer)
    lhView.setUint32(0, 0x04034b50, true) // signature
    lhView.setUint16(4, 20, true) // version needed
    lhView.setUint16(6, 0x0800, true) // general purpose bit flag (UTF-8)
    lhView.setUint16(8, 8, true) // compression method: deflate
    lhView.setUint16(10, 0, true) // last mod time
    lhView.setUint16(12, 0, true) // last mod date
    lhView.setUint32(14, crc, true)
    lhView.setUint32(18, compressed.length, true)
    lhView.setUint32(22, file.data.length, true)
    lhView.setUint16(26, nameBytes.length, true)
    lhView.setUint16(28, 0, true) // extra field length
    localHeader.set(nameBytes, 30)

    parts.push(localHeader)
    parts.push(compressed)
    offset += localHeader.length + compressed.length

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length)
    const cdView = new DataView(cdEntry.buffer)
    cdView.setUint32(0, 0x02014b50, true) // signature
    cdView.setUint16(4, 20, true) // version made by
    cdView.setUint16(6, 20, true) // version needed
    cdView.setUint16(8, 0x0800, true) // flags
    cdView.setUint16(10, 8, true) // compression
    cdView.setUint16(12, 0, true) // mod time
    cdView.setUint16(14, 0, true) // mod date
    cdView.setUint32(16, crc, true)
    cdView.setUint32(20, compressed.length, true)
    cdView.setUint32(24, file.data.length, true)
    cdView.setUint16(28, nameBytes.length, true)
    cdView.setUint16(30, 0, true) // extra
    cdView.setUint16(32, 0, true) // comment
    cdView.setUint16(34, 0, true) // disk start
    cdView.setUint16(36, 0, true) // internal attrs
    cdView.setUint32(38, 0, true) // external attrs
    cdView.setUint32(42, offset - localHeader.length - compressed.length, true) // local header offset
    cdEntry.set(nameBytes, 46)
    centralDir.push(cdEntry)
  }

  const cdOffset = offset
  const cdSize = centralDir.reduce((s, e) => s + e.length, 0)

  // End of central directory record
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true)
  eocdView.setUint16(4, 0, true) // disk
  eocdView.setUint16(6, 0, true) // disk with CD
  eocdView.setUint16(8, files.length, true) // entries on disk
  eocdView.setUint16(10, files.length, true) // total entries
  eocdView.setUint32(12, cdSize, true)
  eocdView.setUint32(16, cdOffset, true)
  eocdView.setUint16(20, 0, true) // comment length

  const total = new Uint8Array(offset + cdSize + 22)
  let pos = 0
  for (const p of parts) {
    total.set(p, pos)
    pos += p.length
  }
  for (const c of centralDir) {
    total.set(c, pos)
    pos += c.length
  }
  total.set(eocd, pos)

  return new Blob([total], { type: DOCX_MIME_TYPE })
}

/**
 * Convert HTML to a .docx Blob using the full pipeline.
 * This is the recommended export function.
 */
export async function htmlToDocx(html: string, title?: string): Promise<Blob> {
  return htmlToDocxBlob(html, { title: title ?? "Document" })
}

// ─── WordprocessingML Body Builder ──────────────────────────────

function buildWordprocessingBody(html: string): string {
  // Parse HTML and convert to OOXML paragraphs/runs
  const doc = parseHtml(html)
  return nodesToOoxml(doc)
}

interface HtmlNode {
  tag: string
  attrs: Record<string, string>
  children: HtmlNode[]
  text?: string
}

function parseHtml(html: string): HtmlNode[] {
  // Simple recursive descent HTML parser for document-body content
  const nodes: HtmlNode[] = []
  const stack: HtmlNode[] = []
  let i = 0

  function skipWS() {
    while (i < html.length && /\s/.test(html[i])) i++
  }

  function readName(): string {
    let name = ""
    while (i < html.length && /[a-zA-Z0-9]/.test(html[i])) {
      name += html[i]
      i++
    }
    return name.toLowerCase()
  }

  function readAttrValue(): string {
    const quote = html[i]
    i++ // skip opening quote
    let val = ""
    while (i < html.length && html[i] !== quote) {
      if (html[i] === "&") {
        const semi = html.indexOf(";", i)
        if (semi > i) {
          const entity = html.slice(i + 1, semi)
          const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }
          val += entities[entity] ?? html.slice(i, semi + 1)
          i = semi + 1
          continue
        }
      }
      val += html[i]
      i++
    }
    i++ // skip closing quote
    return val
  }

  function parseContent(): string {
    let text = ""
    while (i < html.length && html[i] !== "<") {
      if (html[i] === "&") {
        const semi = html.indexOf(";", i)
        if (semi > i) {
          const entity = html.slice(i + 1, semi)
          const entities: Record<string, string> = {
            amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
            ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
            mdash: "—", ndash: "–",
          }
          text += entities[entity] ?? html.slice(i, semi + 1)
          i = semi + 1
          continue
        }
      }
      text += html[i]
      i++
    }
    return text
  }

  function parseNode(): HtmlNode | null {
    if (i >= html.length) return null
    if (html[i] !== "<") {
      const text = parseContent()
      if (text.trim()) {
        return { tag: "#text", attrs: {}, children: [], text }
      }
      return null
    }

    i++ // skip "<"

    // Closing tag
    if (html[i] === "/") {
      i++
      readName()
      while (i < html.length && html[i] !== ">") i++
      i++
      return null
    }

    // Self-closing tag or comment
    if (html[i] === "!") {
      while (i < html.length && html[i] !== ">") i++
      i++
      return null
    }

    const tag = readName()
    const attrs: Record<string, string> = {}
    let selfClosing = false

    while (i < html.length && html[i] !== ">") {
      skipWS()
      if (html[i] === "/") { selfClosing = true; i++; continue }
      if (html[i] === ">") break
      const attrName = readName()
      skipWS()
      if (html[i] === "=") {
        i++
        skipWS()
        attrs[attrName] = readAttrValue()
      }
    }
    i++ // skip ">"

    if (selfClosing || VOID_ELEMENTS.has(tag)) {
      return { tag, attrs, children: [], text: tag === "br" ? "\n" : "" }
    }

    const children: HtmlNode[] = []
    while (i < html.length) {
      const child = parseNode()
      if (child) {
        children.push(child)
      } else if (i < html.length - 1 && html[i] === "<" && html[i + 1] === "/") {
        i += 2
        const closingTag = readName()
        while (i < html.length && html[i] !== ">") i++
        i++
        if (closingTag === tag) break
        // Mismatched tag — continue parsing
      } else {
        break
      }
    }

    return { tag, attrs, children }
  }

  while (i < html.length) {
    const node = parseNode()
    if (node) nodes.push(node)
  }

  return nodes
}

const VOID_ELEMENTS = new Set(["br", "hr", "img", "input", "meta", "link"])

// ─── OOXML Generator ────────────────────────────────────────────

function nodesToOoxml(nodes: HtmlNode[]): string {
  return nodes.map(nodeToOoxml).join("")
}

function nodeToOoxml(node: HtmlNode): string {
  switch (node.tag) {
    case "#text":
      return `<w:r><w:rPr></w:rPr><w:t xml:space="preserve">${escXml(node.text ?? "")}</w:t></w:r>`

    case "br":
      return `<w:r><w:br/></w:r>`

    case "p":
      return buildParagraph(node, {})

    case "h1":
      return buildParagraph(node, { fontSize: 32, bold: true, spaceBefore: 360, spaceAfter: 120 })
    case "h2":
      return buildParagraph(node, { fontSize: 28, bold: true, spaceBefore: 280, spaceAfter: 80 })
    case "h3":
      return buildParagraph(node, { fontSize: 24, bold: true, spaceBefore: 200, spaceAfter: 60 })
    case "h4":
      return buildParagraph(node, { fontSize: 22, bold: true, spaceBefore: 160, spaceAfter: 40 })
    case "h5":
      return buildParagraph(node, { fontSize: 20, bold: true })
    case "h6":
      return buildParagraph(node, { fontSize: 18, bold: true })

    case "b":
    case "strong":
      return `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">${escXml(getTextContent(node))}</w:t></w:r>`

    case "i":
    case "em":
      return `<w:r><w:rPr><w:i/><w:iCs/></w:rPr><w:t xml:space="preserve">${escXml(getTextContent(node))}</w:t></w:r>`

    case "u":
      return `<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escXml(getTextContent(node))}</w:t></w:r>`

    case "ul":
      return node.children.map((li) => {
        const text = getTextContent(li)
        return `<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:rPr></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`
      }).join("")

    case "ol":
      return node.children.map((li, idx) => {
        const text = getTextContent(li)
        return `<w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r><w:rPr></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`
      }).join("")

    case "li":
      return nodesToOoxml(node.children)

    case "table":
      return buildTable(node)

    case "tr":
      return `<w:tr>${nodesToOoxml(node.children)}</w:tr>`

    case "td":
    case "th":
      return `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${nodesToOoxml(node.children)}</w:tc>`

    case "blockquote":
      return `<w:p><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr>${nodesToOoxml(node.children)}</w:p>`

    case "hr":
      return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>`

    case "a":
      return `<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">${escXml(getTextContent(node))}</w:t></w:r>`

    default:
      return nodesToOoxml(node.children)
  }
}

interface ParagraphStyle {
  fontSize?: number
  bold?: boolean
  italic?: boolean
  spaceBefore?: number
  spaceAfter?: number
  alignment?: "left" | "center" | "right" | "both"
}

function buildParagraph(node: HtmlNode, style: ParagraphStyle): string {
  const fontSize = style.fontSize ? `<w:sz w:val="${style.fontSize * 2}"/><w:szCs w:val="${style.fontSize * 2}"/>` : ""
  const bold = style.bold ? `<w:b/><w:bCs/>` : ""
  const italic = style.italic ? `<w:i/><w:iCs/>` : ""
  const spaceBefore = style.spaceBefore ? `<w:spacing w:before="${style.spaceBefore}"/>` : ""
  const spaceAfter = style.spaceAfter ? `<w:spacing w:after="${style.spaceAfter}"/>` : ""
  const alignment = style.alignment ? `<w:jc w:val="${style.alignment}"/>` : ""

  const hasRPr = fontSize || bold || italic
  const hasPPr = spaceBefore || spaceAfter || alignment

  const pPr = hasPPr ? `<w:pPr>${spaceBefore}${spaceAfter}${alignment}</w:pPr>` : ""
  const rPr = hasRPr ? `<w:rPr>${fontSize}${bold}${italic}</w:rPr>` : ""

  const children = nodesToOoxml(node.children)
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escXml(getTextContent(node))}</w:t></w:r></w:p>`
}

function buildTable(node: HtmlNode): string {
  const rows = node.children.filter((c) => c.tag === "tr")
  if (rows.length === 0) return ""

  const colCount = Math.max(...rows.map((r) => r.children.filter((c) => c.tag === "td" || c.tag === "th").length))
  const colWidth = Math.floor(9000 / Math.max(colCount, 1))

  const grid = `<w:tblGrid>${Array(colCount).fill(0).map(() => `<w:gridCol w:w="${colWidth}"/>`).join("")}</w:tblGrid>`

  const tblPr = `<w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="9000" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
    </w:tblBorders>
  </w:tblPr>`

  return `<w:tbl>${tblPr}${grid}${rows.map(nodeToOoxml).join("")}</w:tbl>`
}

function getTextContent(node: HtmlNode): string {
  if (node.tag === "#text") return node.text ?? ""
  return node.children.map(getTextContent).join("")
}

// ─── ZIP Helpers (minimal, no dependency) ───────────────────────

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function deflateRaw(data: Uint8Array): Uint8Array {
  // Store-only (no compression) for simplicity.
  // A production implementation would use pako or the Compression Streams API.
  const out = new Uint8Array(data.length + data.length / 65535 * 5 + 10)
  let pos = 0
  let i = 0

  while (i < data.length) {
    const chunkSize = Math.min(65535, data.length - i)
    const isFinal = i + chunkSize >= data.length
    out[pos++] = isFinal ? 1 : 0
    // Store uncompressed
    const len = chunkSize
    const nlen = (~len) & 0xffff
    out[pos++] = len & 0xff
    out[pos++] = (len >> 8) & 0xff
    out[pos++] = nlen & 0xff
    out[pos++] = (nlen >> 8) & 0xff
    out.set(data.subarray(i, i + chunkSize), pos)
    pos += chunkSize
    i += chunkSize
  }
  return out.slice(0, pos)
}

// ─── Template / Mail Merge ──────────────────────────────────────

export interface TemplateField {
  fieldName: string
  value: string
}

/**
 * Replace {{fieldName}} placeholders in HTML content with values.
 * Supports simple scalar fields and {{#each rows}}...{{/each}} blocks.
 */
export function mergeTemplate(
  html: string,
  fields: TemplateField[],
  tableData?: Record<string, Record<string, string>[]>
): string {
  let result = html

  // Simple field replacement
  for (const field of fields) {
    const regex = new RegExp(`\\{\\{\\s*${escapeRegex(field.fieldName)}\\s*\\}\\}`, "gi")
    result = result.replace(regex, escXml(field.value))
  }

  // Table/loop regions: {{#each regionName}}...{{/each}}
  if (tableData) {
    for (const [region, rows] of Object.entries(tableData)) {
      const regionRegex = new RegExp(
        `\\{\\{\\s*#each\\s+${escapeRegex(region)}\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*\\/each\\s*\\}\\}`,
        "gi"
      )
      result = result.replace(regionRegex, (_match, template) => {
        return rows
          .map((row) => {
            let rowHtml = template as string
            for (const [key, val] of Object.entries(row)) {
              rowHtml = rowHtml.replace(
                new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, "gi"),
                escXml(val)
              )
            }
            return rowHtml
          })
          .join("")
      })
    }
  }

  return result
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// ─── Storage Integration ────────────────────────────────────────

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

// ─── MIME / File Helpers ────────────────────────────────────────

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
export const DOC_MIME_TYPE = "application/msword"

export function isWordDocument(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop()
  return ext === "docx" || ext === "doc" || ext === "dotx" || ext === "dotm" || ext === "rtf"
}

export function getMimeType(filename: string): string {
  return filename.toLowerCase().endsWith(".doc") ? DOC_MIME_TYPE : DOCX_MIME_TYPE
}

export function openWordFileDialog(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".docx,.doc,.dotx,.dotm,.rtf,.html,.htm,.txt"
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

/**
 * Strip HTML down to the body content for editing.
 * Removes <html>, <head>, <body> wrappers, <style>, <script>.
 */
export function sanitizeEditorHtml(html: string): string {
  // Remove doctype, html/head/body tags
  let cleaned = html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim()

  // Collapse empty paragraphs
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, "<p><br></p>")

  return cleaned
}
