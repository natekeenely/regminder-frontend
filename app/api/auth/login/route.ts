import { NextRequest, NextResponse } from "next/server"
import { encodeSession, SESSION_COOKIE_KEY, type FrontendSession } from "@/lib/auth-session"

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const userId = String(body.userId ?? body.email ?? "").trim()
  const displayName = String(body.displayName ?? userId).trim()
  const email = String(body.email ?? "").trim()
  const password = String(body.password ?? "").trim()

  if (!userId || !displayName || !password) {
    return NextResponse.json({ ok: false, detail: "userId/displayName/password are required" }, { status: 400 })
  }

  // Delegate authentication to mdm-service via BFF proxy
  try {
    const cliBffBaseUrl = process.env.CLI_BFF_BASE_URL ?? "http://cli-bff:8086"
    const upstream = await fetch(`${cliBffBaseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, displayName, email, password }),
    })
    const data = await upstream.json()

    if (!upstream.ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, detail: String(data?.detail ?? "authentication failed") },
        { status: upstream.status }
      )
    }

    // Build session from successful auth response
    const session: FrontendSession = {
      userId: String(data.user_id ?? userId),
      displayName: String(data.display_name ?? displayName),
      email: data.email ? String(data.email) : undefined,
      roles: Array.isArray(data.roles) ? data.roles.map((r: unknown) => String(r)) : ["viewer"],
    }

    const res = NextResponse.json({
      ok: true,
      session,
      permissions: data.permissions,
      menus: data.menus,
      capabilities: data.capabilities,
      functions: data.functions,
      data_scopes: data.data_scopes,
      organizations: data.organizations,
      user_data_scopes: data.user_data_scopes,
    })
    res.cookies.set(SESSION_COOKIE_KEY, encodeSession(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 10,
    })
    return res
  } catch (error) {
    return NextResponse.json(
      { ok: false, detail: error instanceof Error ? error.message : "auth service unavailable" },
      { status: 502 }
    )
  }
}
