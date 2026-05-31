import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { decodeSession, SESSION_COOKIE_KEY } from "@/lib/auth-session"

export async function GET() {
  const jar = await cookies()
  const session = decodeSession(jar.get(SESSION_COOKIE_KEY)?.value)
  if (!session) return NextResponse.json({ ok: false, detail: "unauthorized" }, { status: 401 })
  return NextResponse.json({ ok: true, session })
}

