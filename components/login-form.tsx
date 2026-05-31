"use client"

import { useState, type FormEvent } from "react"
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react"

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("john.wei@tic.local")
  const [displayName, setDisplayName] = useState("John Wei")
  const [password, setPassword] = useState("demo123")
  const [role, setRole] = useState("admin")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: email, email, displayName, password, role }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) {
        setError(String(data?.detail ?? "login failed"))
        return
      }
      const next = new URL(window.location.href).searchParams.get("next") || "/"
      // Use hard navigation to ensure cookie is sent with the request
      window.location.href = next
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-bold text-foreground">Hermes TIC</p>
          <p className="text-xs text-muted-foreground">Testing · Inspection · Certification</p>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Sign in to your portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">Access MDM, workflows, and AI governance tools.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="text-sm font-medium text-foreground">Display Name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm" required />

        <label className="text-sm font-medium text-foreground">Work email</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
            required
          />
        </div>

        <label className="text-sm font-medium text-foreground">Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
          <option value="ops_admin">Ops Admin</option>
          <option value="approver">Approver</option>
        </select>

        <label className="text-sm font-medium text-foreground">Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-10 text-sm"
            required
          />
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

        <button type="submit" disabled={isSubmitting} className="mt-2 flex h-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </button>
      </form>
    </div>
  )
}
