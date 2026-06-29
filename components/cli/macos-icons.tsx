"use client"

import type { ReactNode } from "react"

// ─── macOS-style folder icon ───
// Blue gradient folder with tab, inspired by macOS Finder
export function MacFolderIcon({ size = 48, className }: { size?: number; className?: string }) {
  const w = size
  const h = size * 0.82
  const tabW = size * 0.28
  const tabH = size * 0.08
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`macFolderGrad-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7EC8F8" />
          <stop offset="100%" stopColor="#4DA3E0" />
        </linearGradient>
        <linearGradient id={`macFolderTop-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8DDFB" />
          <stop offset="100%" stopColor="#7EC8F8" />
        </linearGradient>
      </defs>
      {/* Tab */}
      <path
        d={`M0,${tabH} L${tabW * 0.35},${tabH} Q${tabW * 0.35},0 ${tabW * 0.7},0 L${tabW},0 L${tabW},${tabH}`}
        fill={`url(#macFolderTop-${size})`}
      />
      {/* Body */}
      <rect x="0" y={tabH} width={w} height={h - tabH} rx={size * 0.06} fill={`url(#macFolderGrad-${size})`} />
      {/* Highlight */}
      <rect x="1" y={tabH + 1} width={w - 2} height={(h - tabH) * 0.35} rx={size * 0.06} fill="rgba(255,255,255,0.18)" />
    </svg>
  )
}

// ─── macOS-style generic document icon ───
// White page with folded corner, colored stripe
export function MacDocIcon({
  size = 48,
  color = "#6B7280",
  label,
  className,
}: {
  size?: number
  color?: string
  label?: string
  className?: string
}) {
  const w = size * 0.72
  const h = size
  const fold = size * 0.16
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`docGrad-${size}-${color.replace("#", "")}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="#F3F4F6" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <rect x="1" y="1" width={w - 2} height={h - 2} rx={size * 0.06} fill="rgba(0,0,0,0.06)" />
      {/* Body */}
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} fill={`url(#docGrad-${size}-${color.replace("#", "")})`} />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} stroke="#D1D5DB" strokeWidth="0.5" />
      {/* Fold corner */}
      <path
        d={`M${w - fold},${h - fold} L${w - fold},${h} L${w},${h - fold} Z`}
        fill="#E5E7EB"
        stroke="#D1D5DB"
        strokeWidth="0.5"
      />
      {/* Colored top stripe */}
      <rect x="0" y="0" width={w - fold} height={size * 0.1} rx={size * 0.06} fill={color} />
      <rect x="0" y={size * 0.04} width={w - fold} height={size * 0.06} fill={color} />
      {/* Label */}
      {label && (
        <text
          x={(w - fold) / 2}
          y={h * 0.62}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.2}
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.5"
        >
          {label}
        </text>
      )}
    </svg>
  )
}

// ─── macOS-style image icon ───
// Landscape photo with mountain/sun motif
export function MacImageIcon({ size = 48, className }: { size?: number; className?: string }) {
  const w = size * 0.72
  const h = size
  const fold = size * 0.16
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`imgGrad-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="#F3F4F6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx={size * 0.06} fill="rgba(0,0,0,0.06)" />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} fill={`url(#imgGrad-${size})`} />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} stroke="#D1D5DB" strokeWidth="0.5" />
      <path d={`M${w - fold},${h - fold} L${w - fold},${h} L${w},${h - fold} Z`} fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="0.5" />
      {/* Photo content: sky, sun, mountains */}
      <rect x={size * 0.04} y={size * 0.12} width={w - fold - size * 0.08} height={(h - fold) * 0.55} rx={size * 0.03} fill="#DBEAFE" />
      <circle cx={w * 0.55} cy={h * 0.28} r={size * 0.08} fill="#FCD34D" />
      <path
        d={`M${size * 0.04},${h * 0.55} L${w * 0.2},${h * 0.35} L${w * 0.4},${h * 0.48} L${w * 0.55},${h * 0.38} L${w - fold - size * 0.04},${h * 0.55} Z`}
        fill="#86EFAC"
      />
      <path
        d={`M${size * 0.04},${h * 0.55} L${w * 0.2},${h * 0.35} L${w * 0.4},${h * 0.48} L${w * 0.55},${h * 0.38} L${w - fold - size * 0.04},${h * 0.55} Z`}
        fill="#4ADE80"
        opacity="0.5"
      />
    </svg>
  )
}

// ─── macOS-style video/audio icon ───
export function MacMediaIcon({ size = 48, color = "#EC4899", className }: { size?: number; color?: string; className?: string }) {
  const w = size * 0.72
  const h = size
  const fold = size * 0.16
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`mediaGrad-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="#F3F4F6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx={size * 0.06} fill="rgba(0,0,0,0.06)" />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} fill={`url(#mediaGrad-${size})`} />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} stroke="#D1D5DB" strokeWidth="0.5" />
      <path d={`M${w - fold},${h - fold} L${w - fold},${h} L${w},${h - fold} Z`} fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="0.5" />
      {/* Play button */}
      <circle cx={(w - fold) / 2} cy={h * 0.45} r={size * 0.14} fill={color} />
      <path d={`M${(w - fold) / 2 - size * 0.05},${h * 0.38} L${(w - fold) / 2 + size * 0.09},${h * 0.45} L${(w - fold) / 2 - size * 0.05},${h * 0.52} Z`} fill="white" />
    </svg>
  )
}

// ─── macOS-style archive icon ───
export function MacArchiveIcon({ size = 48, className }: { size?: number; className?: string }) {
  const w = size * 0.72
  const h = size
  const fold = size * 0.16
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`zipGrad-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="#F3F4F6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx={size * 0.06} fill="rgba(0,0,0,0.06)" />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} fill={`url(#zipGrad-${size})`} />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} stroke="#D1D5DB" strokeWidth="0.5" />
      <path d={`M${w - fold},${h - fold} L${w - fold},${h} L${w},${h - fold} Z`} fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="0.5" />
      {/* Zipper lines */}
      <line x1={(w - fold) / 2} y1={size * 0.2} x2={(w - fold) / 2} y2={h * 0.65} stroke="#D97706" strokeWidth={size * 0.04} strokeLinecap="round" />
      <rect x={(w - fold) / 2 - size * 0.06} y={size * 0.18} width={size * 0.12} height={size * 0.08} rx={size * 0.02} fill="#D97706" />
    </svg>
  )
}

// ─── macOS-style code/text icon ───
export function MacCodeIcon({ size = 48, className }: { size?: number; className?: string }) {
  const w = size * 0.72
  const h = size
  const fold = size * 0.16
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`codeGrad-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="#F3F4F6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx={size * 0.06} fill="rgba(0,0,0,0.06)" />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} fill={`url(#codeGrad-${size})`} />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} stroke="#D1D5DB" strokeWidth="0.5" />
      <path d={`M${w - fold},${h - fold} L${w - fold},${h} L${w},${h - fold} Z`} fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="0.5" />
      {/* Code brackets */}
      <text
        x={(w - fold) / 2}
        y={h * 0.52}
        textAnchor="middle"
        fill="#6B7280"
        fontSize={size * 0.22}
        fontWeight="600"
        fontFamily="monospace"
      >
        &lt;/&gt;
      </text>
    </svg>
  )
}

// ─── macOS-style generic file icon (no label) ───
export function MacGenericFileIcon({ size = 48, className }: { size?: number; className?: string }) {
  const w = size * 0.72
  const h = size
  const fold = size * 0.16
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="1" y="1" width={w - 2} height={h - 2} rx={size * 0.06} fill="rgba(0,0,0,0.06)" />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} fill="white" />
      <rect x="0" y="0" width={w - fold} height={h - fold} rx={size * 0.06} stroke="#D1D5DB" strokeWidth="0.5" />
      <path d={`M${w - fold},${h - fold} L${w - fold},${h} L${w},${h - fold} Z`} fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="0.5" />
      {/* Lines representing text */}
      <rect x={size * 0.1} y={size * 0.25} width={(w - fold) * 0.55} height={size * 0.04} rx={size * 0.02} fill="#D1D5DB" />
      <rect x={size * 0.1} y={size * 0.35} width={(w - fold) * 0.7} height={size * 0.04} rx={size * 0.02} fill="#E5E7EB" />
      <rect x={size * 0.1} y={size * 0.45} width={(w - fold) * 0.45} height={size * 0.04} rx={size * 0.02} fill="#E5E7EB" />
      <rect x={size * 0.1} y={size * 0.55} width={(w - fold) * 0.6} height={size * 0.04} rx={size * 0.02} fill="#E5E7EB" />
    </svg>
  )
}

// ─── Unified resolver: returns the right icon component for a file ───
export interface FileIconResult {
  icon: ReactNode
  color: string
  typeLabel: string
}

const iconSize = 48

export function getMacFileIcon(name: string, kind: "folder" | "file"): FileIconResult {
  if (kind === "folder") {
    return {
      icon: <MacFolderIcon size={iconSize} />,
      color: "#4DA3E0",
      typeLabel: "Folder",
    }
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? ""

  // PDF
  if (ext === "pdf") {
    return {
      icon: <MacDocIcon size={iconSize} color="#EF4444" label="PDF" />,
      color: "#EF4444",
      typeLabel: "PDF Document",
    }
  }

  // Word
  if (ext === "docx" || ext === "doc" || ext === "dotx" || ext === "dot" || ext === "docm") {
    return {
      icon: <MacDocIcon size={iconSize} color="#2563EB" label="DOC" />,
      color: "#2563EB",
      typeLabel: "Word Document",
    }
  }

  // Excel
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm" || ext === "xltx" || ext === "csv") {
    return {
      icon: <MacDocIcon size={iconSize} color="#16A34A" label="XLS" />,
      color: "#16A34A",
      typeLabel: "Excel Spreadsheet",
    }
  }

  // PowerPoint
  if (ext === "pptx" || ext === "ppt" || ext === "pptm" || ext === "potx") {
    return {
      icon: <MacDocIcon size={iconSize} color="#EA580C" label="PPT" />,
      color: "#EA580C",
      typeLabel: "PowerPoint Presentation",
    }
  }

  // Images
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "gif" || ext === "svg" || ext === "webp" || ext === "bmp" || ext === "ico" || ext === "tiff" || ext === "tif") {
    return {
      icon: <MacImageIcon size={iconSize} />,
      color: "#9333EA",
      typeLabel: `${ext.toUpperCase()} Image`,
    }
  }

  // Video
  if (ext === "mp4" || ext === "mov" || ext === "avi" || ext === "mkv" || ext === "webm" || ext === "wmv" || ext === "flv") {
    return {
      icon: <MacMediaIcon size={iconSize} color="#EC4899" />,
      color: "#EC4899",
      typeLabel: `${ext.toUpperCase()} Video`,
    }
  }

  // Audio
  if (ext === "mp3" || ext === "wav" || ext === "aac" || ext === "flac" || ext === "ogg" || ext === "wma" || ext === "m4a") {
    return {
      icon: <MacMediaIcon size={iconSize} color="#F59E0B" />,
      color: "#F59E0B",
      typeLabel: `${ext.toUpperCase()} Audio`,
    }
  }

  // Archives
  if (ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz" || ext === "bz2" || ext === "xz") {
    return {
      icon: <MacArchiveIcon size={iconSize} />,
      color: "#D97706",
      typeLabel: `${ext.toUpperCase()} Archive`,
    }
  }

  // Code / text
  if (ext === "txt" || ext === "md" || ext === "json" || ext === "xml" || ext === "html" || ext === "htm" || ext === "log" || ext === "yml" || ext === "yaml" || ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx" || ext === "py" || ext === "css" || ext === "scss" || ext === "sql") {
    return {
      icon: <MacCodeIcon size={iconSize} />,
      color: "#6B7280",
      typeLabel: `${ext.toUpperCase()} File`,
    }
  }

  // Generic
  return {
    icon: <MacGenericFileIcon size={iconSize} />,
    color: "#9CA3AF",
    typeLabel: ext ? `${ext.toUpperCase()} File` : "File",
  }
}

// ─── Small icon variants for list view ───
const smallIconSize = 32

export function getMacFileIconSmall(name: string, kind: "folder" | "file"): FileIconResult {
  if (kind === "folder") {
    return {
      icon: <MacFolderIcon size={smallIconSize} />,
      color: "#4DA3E0",
      typeLabel: "Folder",
    }
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? ""

  if (ext === "pdf") return { icon: <MacDocIcon size={smallIconSize} color="#EF4444" label="PDF" />, color: "#EF4444", typeLabel: "PDF Document" }
  if (ext === "docx" || ext === "doc" || ext === "dotx" || ext === "dot" || ext === "docm") return { icon: <MacDocIcon size={smallIconSize} color="#2563EB" label="DOC" />, color: "#2563EB", typeLabel: "Word Document" }
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm" || ext === "xltx" || ext === "csv") return { icon: <MacDocIcon size={smallIconSize} color="#16A34A" label="XLS" />, color: "#16A34A", typeLabel: "Excel Spreadsheet" }
  if (ext === "pptx" || ext === "ppt" || ext === "pptm" || ext === "potx") return { icon: <MacDocIcon size={smallIconSize} color="#EA580C" label="PPT" />, color: "#EA580C", typeLabel: "PowerPoint Presentation" }
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "gif" || ext === "svg" || ext === "webp" || ext === "bmp" || ext === "ico" || ext === "tiff" || ext === "tif") return { icon: <MacImageIcon size={smallIconSize} />, color: "#9333EA", typeLabel: `${ext.toUpperCase()} Image` }
  if (ext === "mp4" || ext === "mov" || ext === "avi" || ext === "mkv" || ext === "webm" || ext === "wmv" || ext === "flv") return { icon: <MacMediaIcon size={smallIconSize} color="#EC4899" />, color: "#EC4899", typeLabel: `${ext.toUpperCase()} Video` }
  if (ext === "mp3" || ext === "wav" || ext === "aac" || ext === "flac" || ext === "ogg" || ext === "wma" || ext === "m4a") return { icon: <MacMediaIcon size={smallIconSize} color="#F59E0B" />, color: "#F59E0B", typeLabel: `${ext.toUpperCase()} Audio` }
  if (ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz" || ext === "bz2" || ext === "xz") return { icon: <MacArchiveIcon size={smallIconSize} />, color: "#D97706", typeLabel: `${ext.toUpperCase()} Archive` }
  if (ext === "txt" || ext === "md" || ext === "json" || ext === "xml" || ext === "html" || ext === "htm" || ext === "log" || ext === "yml" || ext === "yaml" || ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx" || ext === "py" || ext === "css" || ext === "scss" || ext === "sql") return { icon: <MacCodeIcon size={smallIconSize} />, color: "#6B7280", typeLabel: `${ext.toUpperCase()} File` }

  return { icon: <MacGenericFileIcon size={smallIconSize} />, color: "#9CA3AF", typeLabel: ext ? `${ext.toUpperCase()} File` : "File" }
}

// ─── Helper: format date for list view ───
export function formatDate(isoString?: string): string {
  if (!isoString) return "—"
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return "—"
    const now = new Date()
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate()

    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" })
    const year = d.getFullYear().toString()

    if (isToday) return `Today at ${time}`
    if (isYesterday) return `Yesterday at ${time}`
    if (d.getFullYear() === now.getFullYear()) return `${date} at ${time}`
    return `${date}, ${year} at ${time}`
  } catch {
    return "—"
  }
}

// ─── Helper: format file size ───
export function formatSize(value?: number): string {
  if (value === undefined || value === null) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
