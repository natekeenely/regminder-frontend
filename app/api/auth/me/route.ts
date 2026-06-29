import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { decodeSession, SESSION_COOKIE_KEY, type FrontendSession } from "@/lib/auth-session"

// In dev/demo deployments we fall back to an implicit admin user so the UI is
// usable without a real login. The frontend treats this as the "current user"
// (top-bar avatar, role pill, etc.). To enforce real auth, remove the fallback.
function demoSession(): FrontendSession {
  const userId = process.env.FRONTEND_DEMO_USER_ID ?? "demo-user"
  const roles = (process.env.FRONTEND_DEMO_ROLES ?? "admin")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    userId,
    displayName: process.env.FRONTEND_DEMO_DISPLAY_NAME ?? "Demo Admin",
    email: process.env.FRONTEND_DEMO_EMAIL ?? "demo@regminder.local",
    roles: roles.length ? roles : ["admin"],
  }
}

export async function GET() {
  const jar = await cookies()
  const session = decodeSession(jar.get(SESSION_COOKIE_KEY)?.value)
  // If a real session exists but is missing admin, escalate to admin in dev mode
  // (matches the proxy's role-union behaviour, so the in-page "Role: Admin" pill
  // and the actual permission set stay consistent).
  if (session) {
    const demoRoles = (process.env.FRONTEND_DEMO_ROLES ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean)
    if (demoRoles.length > 0) {
      // Put demo roles FIRST so roles[0] (used by the top-bar pill) reflects the
      // highest privilege (admin), not whatever the user happened to pick at login.
      const unionRoles = Array.from(new Set([...demoRoles, ...session.roles]))
      return NextResponse.json({ ok: true, session: { ...session, roles: unionRoles } })
    }
    return NextResponse.json({ ok: true, session })
  }
  return NextResponse.json({ ok: true, session: demoSession() })
}

