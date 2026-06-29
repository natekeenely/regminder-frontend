import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { decodeSession, SESSION_COOKIE_KEY } from "@/lib/auth-session"

export async function POST(req: Request) {
  let body: {
    email?: string
    currentPassword?: string
    newPassword?: string
    mode?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json(
      { ok: false, detail: "Invalid request body." },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword, mode, email } = body
  const isForgotFlow = mode === "forgot"

  if (isForgotFlow && (!email || !email.includes("@"))) {
    return NextResponse.json(
      { ok: false, detail: "A valid email address is required." },
      { status: 400 }
    )
  }

  if (!newPassword || newPassword.trim().length < 6) {
    return NextResponse.json(
      { ok: false, detail: "New password must be at least 6 characters." },
      { status: 400 }
    )
  }

  if (currentPassword && currentPassword === newPassword) {
    return NextResponse.json(
      { ok: false, detail: "New password must be different from the current password." },
      { status: 400 }
    )
  }

  // Delegate to mdm-service via BFF proxy
  try {
    const cliBffBaseUrl = process.env.CLI_BFF_BASE_URL ?? "http://cli-bff:8086"
    const headers: Record<string, string> = { "content-type": "application/json" }

    // Forward session user info for authenticated mode
    if (!isForgotFlow) {
      const jar = await cookies()
      const session = decodeSession(jar.get(SESSION_COOKIE_KEY)?.value)
      if (!session) {
        return NextResponse.json(
          { ok: false, detail: "Not authenticated. Please sign in first." },
          { status: 401 }
        )
      }
      headers["x-user-id"] = session.userId
      headers["x-user-roles"] = session.roles.join(",")
    }

    const upstream = await fetch(`${cliBffBaseUrl}/api/v1/auth/reset-password`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        currentPassword: currentPassword ?? "",
        newPassword,
        mode: isForgotFlow ? "forgot" : "authenticated",
      }),
    })
    const data = await upstream.json()

    if (!upstream.ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, detail: String(data?.detail ?? "password reset failed") },
        { status: upstream.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { ok: false, detail: error instanceof Error ? error.message : "auth service unavailable" },
      { status: 502 }
    )
  }
}
