"use client"

import { useState, type FormEvent } from "react"
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("john.wei@tic.local")
  const [displayName, setDisplayName] = useState("John Wei")
  const [password, setPassword] = useState("demo123")
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetNewPassword, setResetNewPassword] = useState("")
  const [resetConfirmPassword, setResetConfirmPassword] = useState("")
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "ok" | "error">("idle")
  const [resetMessage, setResetMessage] = useState("")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: email, email, displayName, password }),
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

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setResetMessage("")
    if (resetNewPassword !== resetConfirmPassword) {
      setResetMessage("Passwords do not match.")
      setResetStatus("error")
      return
    }
    if (resetNewPassword.length < 6) {
      setResetMessage("Password must be at least 6 characters.")
      setResetStatus("error")
      return
    }
    setResetStatus("sending")
    try {
      // For forgot-password flow (not logged in), we use a simplified endpoint
      const resp = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: resetEmail || email,
          currentPassword: password,
          newPassword: resetNewPassword,
          mode: "forgot",
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) {
        setResetMessage(String(data?.detail ?? "Password reset failed."))
        setResetStatus("error")
        return
      }
      setResetMessage(data?.detail ?? "Password reset successfully. You can now sign in with your new password.")
      setResetStatus("ok")
      setTimeout(() => {
        setShowResetDialog(false)
        setResetStatus("idle")
        setResetMessage("")
        setResetEmail("")
        setResetNewPassword("")
        setResetConfirmPassword("")
        setPassword(resetNewPassword)
      }, 2500)
    } catch {
      setResetMessage("Network error. Please try again.")
      setResetStatus("error")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="font-heading text-lg font-bold text-foreground">Hermes TIC</p>
          <p className="text-xs text-muted-foreground">Testing · Inspection · Certification</p>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground md:text-3xl">Sign in to your portal</h1>
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
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              setResetEmail(email)
              setShowResetDialog(true)
            }}
            className="text-xs text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {error && <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

        <Button type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full text-sm font-semibold">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>

      {/* Reset Password Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Reset Password</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetDialog(false)
                  setResetStatus("idle")
                  setResetMessage("")
                  setResetNewPassword("")
                  setResetConfirmPassword("")
                }}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    type="email"
                    placeholder="your@email.com"
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">New Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    type="password"
                    placeholder="Min. 6 characters"
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Confirm New Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    type="password"
                    placeholder="Re-enter new password"
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {resetMessage && (
                <div
                  className={`rounded border px-3 py-2 text-xs ${
                    resetStatus === "ok"
                      ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                      : resetStatus === "error"
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {resetMessage}
                </div>
              )}

              <Button
                type="submit"
                disabled={resetStatus === "sending" || resetStatus === "ok"}
                className="h-10 w-full text-sm"
              >
                {resetStatus === "sending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : resetStatus === "ok" ? (
                  "Password Reset ✓"
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
