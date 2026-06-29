import { NextRequest, NextResponse } from "next/server"
import { decodeSession, SESSION_COOKIE_KEY } from "@/lib/auth-session"

const cliBffBaseUrl = process.env.CLI_BFF_BASE_URL ?? "http://cli-bff:8086"

async function handle(req: NextRequest, method: string, params: { path: string[] }) {
  const path = params.path.join("/")
  const url = `${cliBffBaseUrl}/${path}${req.nextUrl.search}`

  const session = decodeSession(req.cookies.get(SESSION_COOKIE_KEY)?.value)
  // FRONTEND_DEMO_ROLES augments the session's roles so a viewer-logged-in user can
  // still exercise the full demo flow (write/delete) without re-logging-in. In a
  // production deployment you would NOT set this env var; the proxy would then
  // only forward the actual session roles.
  const demoRoles = (process.env.FRONTEND_DEMO_ROLES ?? "admin")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const sessionRoles = session?.roles ?? []
  const unionRoles = Array.from(new Set<string>([...sessionRoles, ...demoRoles]))
  const headers: Record<string, string> = {
    "x-user-roles": unionRoles.join(",") || "admin",
    "x-user-id": session?.userId ?? "demo-user",
  }

  const contentType = req.headers.get("content-type")
  if (contentType) headers["content-type"] = contentType

  const init: RequestInit = { method, headers }
  if (method !== "GET") init.body = await req.text()

  const upstream = await fetch(url, init)
  const upstreamContentType = upstream.headers.get("content-type") ?? "application/json"

  // Binary responses (images, etc.) — pass through as ArrayBuffer to avoid corruption
  if (upstreamContentType.startsWith("image/") || upstreamContentType === "application/octet-stream") {
    const buf = await upstream.arrayBuffer()
    const resHeaders: Record<string, string> = { "content-type": upstreamContentType }
    const cacheControl = upstream.headers.get("cache-control")
    if (cacheControl) resHeaders["cache-control"] = cacheControl
    return new NextResponse(buf, { status: upstream.status, headers: resHeaders })
  }

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstreamContentType },
  })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "GET", await ctx.params)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "POST", await ctx.params)
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "PUT", await ctx.params)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "PATCH", await ctx.params)
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "DELETE", await ctx.params)
}
