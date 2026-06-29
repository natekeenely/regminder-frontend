"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ── Types ────────────────────────────────────────────────────────────────────

export interface CollabUser {
  userId: string
  userName: string
  color: string
  cursor?: CursorPosition
}

export interface CursorPosition {
  paragraphIdx?: number
  charOffset?: number
  row?: number
  col?: number
  sheet?: string
  selectionEnd?: { paragraphIdx?: number; charOffset?: number; row?: number; col?: number }
}

export type OTOperation = {
  type: "text" | "cell" | "structure"
  action: string
  userId: string
  revision: number
  timestamp: number
  [key: string]: any
}

interface CollabSession {
  id: string
  documentType: string
  documentId: string
  title: string
  revision: number
  activeUsers: CollabUser[]
}

interface ServerMessage {
  type: "operation" | "cursor" | "user_joined" | "user_left" | "sync" | "ack" | "error" | "presence"
  operation?: OTOperation
  cursor?: CursorPosition & { userId: string; userName: string; color: string }
  userId?: string
  userName?: string
  color?: string
  revision?: number
  state?: any
  users?: CollabUser[]
  error?: string
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const DOC_SERVICE_WS = typeof window !== "undefined"
  ? `ws://${window.location.hostname}:18094/ws/collab`
  : "ws://localhost:18094/ws/collab"

const DOC_SERVICE_URL = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:18094`
  : "http://localhost:18094"

export function useCollaboration(opts: {
  documentType: "document" | "spreadsheet"
  documentId: string
  title: string
  userName: string
  onRemoteOperation?: (op: OTOperation) => void
  onRemoteCursor?: (cursor: CursorPosition & { userId: string; userName: string; color: string }) => void
  onSync?: (state: any) => void
  enabled: boolean
}) {
  const { documentType, documentId, title, userName, onRemoteOperation, onRemoteCursor, onSync, enabled } = opts

  const [connected, setConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string>("")
  const [users, setUsers] = useState<CollabUser[]>([])
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string>("")

  const wsRef = useRef<WebSocket | null>(null)
  const revisionRef = useRef(0)
  const pendingOps = useRef<OTOperation[]>([])
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Create or join session
  const connect = useCallback(async () => {
    if (!enabled) return

    try {
      // Create session
      const res = await fetch(`${DOC_SERVICE_URL}/api/v1/collab/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType, documentId, title, createdBy: userName }),
      })
      const session: CollabSession = await res.json()
      setSessionId(session.id)

      // Connect WebSocket
      const color = `hsl(${Math.random() * 360}, 70%, 50%)`
      const wsUrl = `${DOC_SERVICE_WS}?session=${session.id}&user=${encodeURIComponent(userName)}&name=${encodeURIComponent(userName)}&color=${encodeURIComponent(color)}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setConnected(true)
        setError("")
        wsRef.current = ws
      }

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data)
          handleMessage(msg)
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        // Auto-reconnect after 3s
        if (enabled) {
          reconnectTimer.current = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => {
        setError("Connection error")
        ws.close()
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to connect")
    }
  }, [enabled, documentType, documentId, title, userName])

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "sync":
        setRevision(msg.revision ?? 0)
        revisionRef.current = msg.revision ?? 0
        setUsers(msg.users ?? [])
        if (onSync && msg.state) onSync(msg.state)
        break
      case "ack":
        setRevision(msg.revision ?? 0)
        revisionRef.current = msg.revision ?? 0
        // Remove acknowledged op from pending
        pendingOps.current.shift()
        // Send next pending op if any
        if (pendingOps.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "operation", operation: pendingOps.current[0] }))
        }
        break
      case "operation":
        if (msg.operation) {
          setRevision(msg.revision ?? 0)
          revisionRef.current = msg.revision ?? 0
          onRemoteOperation?.(msg.operation)
        }
        break
      case "cursor":
        if (msg.cursor) {
          onRemoteCursor?.(msg.cursor as any)
          // Update user cursor in users list
          setUsers(prev => prev.map(u => u.userId === msg.cursor!.userId ? { ...u, cursor: msg.cursor } : u))
        }
        break
      case "user_joined":
        if (msg.userId && msg.userName && msg.color) {
          setUsers(prev => [...prev.filter(u => u.userId !== msg.userId), { userId: msg.userId!, userName: msg.userName!, color: msg.color! }])
        }
        break
      case "user_left":
        if (msg.userId) {
          setUsers(prev => prev.filter(u => u.userId !== msg.userId))
        }
        break
      case "error":
        setError(msg.error ?? "Unknown error")
        break
    }
  }, [onRemoteOperation, onRemoteCursor, onSync])

  // ── Send operations ────────────────────────────────────────────────────────

  const sendOperation = useCallback((op: Omit<OTOperation, "userId" | "revision" | "timestamp">) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const fullOp = {
      ...op,
      userId: userName,
      revision: revisionRef.current,
      timestamp: Date.now(),
    } as OTOperation
    pendingOps.current.push(fullOp)

    // Send if no other ops pending (first in queue)
    if (pendingOps.current.length === 1) {
      wsRef.current.send(JSON.stringify({ type: "operation", operation: fullOp }))
    }
  }, [userName])

  const sendCursor = useCallback((cursor: CursorPosition) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: "cursor", cursor }))
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setConnected(false)
    setUsers([])
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
  }, [])

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      disconnect()
    }
    return () => { disconnect() }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connected,
    sessionId,
    users,
    revision,
    error,
    sendOperation,
    sendCursor,
    disconnect,
    connect,
  }
}

// ── Cursor Overlay Component ─────────────────────────────────────────────────

export function RemoteCursors({ users, containerRef, type }: {
  users: CollabUser[]
  containerRef: React.RefObject<HTMLElement | null>
  type: "document" | "spreadsheet"
}) {
  // Filter users with cursor positions
  const cursorsWithPosition = users.filter(u => u.cursor)

  if (cursorsWithPosition.length === 0) return null

  return (
    <>
      {cursorsWithPosition.map(user => (
        <div key={user.userId} className="pointer-events-none absolute z-40">
          {/* Cursor caret */}
          <div style={{
            position: "absolute",
            width: 2,
            height: 20,
            background: user.color,
            borderRadius: 1,
            // Position would be calculated based on cursor position + container offset
            // This is a visual placeholder — actual positioning requires DOM measurement
            left: (user.cursor?.col ?? 0) * 100 + 50,
            top: (user.cursor?.row ?? user.cursor?.paragraphIdx ?? 0) * 24 + 50,
          }} />
          {/* User label */}
          <div style={{
            position: "absolute",
            left: (user.cursor?.col ?? 0) * 100 + 50,
            top: (user.cursor?.row ?? user.cursor?.paragraphIdx ?? 0) * 24 + 32,
            background: user.color,
            color: "#fff",
            fontSize: 10,
            padding: "1px 4px",
            borderRadius: 3,
            whiteSpace: "nowrap",
            fontWeight: 500,
          }}>
            {user.userName}
          </div>
        </div>
      ))}
    </>
  )
}

// ── User Avatars Bar ─────────────────────────────────────────────────────────

export function CollabUserBar({ users, connected, sessionId }: {
  users: CollabUser[]
  connected: boolean
  sessionId: string
}) {
  if (!connected && users.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {/* Connection indicator */}
      <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} title={connected ? "Connected" : "Disconnected"} />

      {/* User avatars */}
      <div className="flex -space-x-1.5">
        {users.map(user => (
          <div
            key={user.userId}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-card"
            style={{ background: user.color }}
            title={user.userName}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>

      {users.length > 0 && (
        <span className="text-[10px] text-muted-foreground">{users.length} user{users.length > 1 ? "s" : ""}</span>
      )}
    </div>
  )
}
