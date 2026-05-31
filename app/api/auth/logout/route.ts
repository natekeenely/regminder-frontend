import { NextResponse } from "next/server"
import { SESSION_COOKIE_KEY } from "@/lib/auth-session"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE_KEY, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(0),
  })
  return res
}

