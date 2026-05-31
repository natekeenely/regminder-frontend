import { NextRequest, NextResponse } from "next/server"
import { decodeSession, SESSION_COOKIE_KEY } from "@/lib/auth-session"

const cliBffBaseUrl = process.env.CLI_BFF_BASE_URL ?? "http://cli-bff:8086"

async function handle(req: NextRequest, method: string, params: { path: string[] }) {
  const path = params.path.join("/")
  const url = `${cliBffBaseUrl}/${path}${req.nextUrl.search}`

  const session = decodeSession(req.cookies.get(SESSION_COOKIE_KEY)?.value)
  const headers: Record<string, string> = {
    "x-user-roles": session?.roles.join(",") ?? "viewer",
    "x-user-id": session?.userId ?? "anonymous-user",
  }

  const contentType = req.headers.get("content-type")
  if (contentType) headers["content-type"] = contentType

  const init: RequestInit = { method, headers }
  if (method !== "GET") init.body = await req.text()

  const upstream = await fetch(url, init)
  const text = await upstream.text()

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
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
