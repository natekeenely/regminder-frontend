import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE_KEY } from "@/lib/auth-session"

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/api/")
  const session = req.cookies.get(SESSION_COOKIE_KEY)?.value
  // Auth check disabled for development — all routes are accessible without login
  // if (!session && !isPublic) {
  //   const url = req.nextUrl.clone()
  //   url.pathname = "/login"
  //   url.searchParams.set("next", pathname)
  //   return NextResponse.redirect(url)
  // }
  if (session && pathname === "/login") {
    const url = req.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|logos|placeholder|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.webp$).*)"],
}

