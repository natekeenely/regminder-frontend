import { NextRequest, NextResponse } from "next/server"
import { encodeSession, SESSION_COOKIE_KEY, type FrontendSession } from "@/lib/auth-session"

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const userId = String(body.userId ?? body.email ?? "").trim()
  const displayName = String(body.displayName ?? userId).trim()
  const email = String(body.email ?? "").trim()
  const password = String(body.password ?? "").trim()
  const rolesInput = Array.isArray(body.roles)
    ? body.roles.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    : String(body.role ?? "viewer").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)

  if (!userId || !displayName || !password) {
    return NextResponse.json({ ok: false, detail: "userId/displayName/password are required" }, { status: 400 })
  }

  const session: FrontendSession = {
    userId,
    displayName,
    email: email || undefined,
    roles: rolesInput.length ? rolesInput : ["viewer"],
  }

  const res = NextResponse.json({ ok: true, session })
  res.cookies.set(SESSION_COOKIE_KEY, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 10,
  })
  return res
}

