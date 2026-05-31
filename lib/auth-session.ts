export type FrontendSession = {
  userId: string
  displayName: string
  email?: string
  roles: string[]
}

export const SESSION_COOKIE_KEY = "tic_session"

export function encodeSession(session: FrontendSession): string {
  const text = JSON.stringify(session)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64url")
  }
  const base64 = btoa(unescape(encodeURIComponent(text)))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function decodeSession(raw?: string | null): FrontendSession | null {
  if (!raw) return null
  try {
    let text = ""
    if (typeof Buffer !== "undefined") {
      text = Buffer.from(raw, "base64url").toString("utf8")
    } else {
      const base64 = raw.replace(/-/g, "+").replace(/_/g, "/")
      const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4)
      text = decodeURIComponent(escape(atob(padded)))
    }
    const parsed = JSON.parse(text) as Partial<FrontendSession>
    if (!parsed.userId || !parsed.displayName) return null
    const roles = Array.isArray(parsed.roles) ? parsed.roles.map((r) => String(r).trim()).filter(Boolean) : ["viewer"]
    return {
      userId: String(parsed.userId),
      displayName: String(parsed.displayName),
      email: parsed.email ? String(parsed.email) : undefined,
      roles: roles.length ? roles : ["viewer"],
    }
  } catch {
    return null
  }
}
