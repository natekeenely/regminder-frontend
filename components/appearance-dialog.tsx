"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useT } from "@/lib/i18n"

type Mode = "light" | "dark" | "system"

interface AppearanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MODES: Array<{ id: Mode; label: string; description: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: "light", label: "Light", description: "Bright surfaces, soft blue accents.", Icon: Sun },
  { id: "dark", label: "Dark", description: "Near-black canvas, vivid blue accents.", Icon: Moon },
  { id: "system", label: "Follow system", description: "Switch automatically with your OS setting.", Icon: Monitor },
]

// Visual preview cards — mimic the layout shown in the screenshot. We render a small
// stylized window inside each card so the user can see roughly what the mode looks like
// without applying the theme.
function ModePreview({ mode }: { mode: Mode }): React.ReactNode {
  const isDark = mode === "dark"
  return (
    <div
      className="pointer-events-none relative h-24 w-full overflow-hidden rounded-md border"
      style={{
        background: isDark ? "#18181b" : "#ffffff",
        borderColor: isDark ? "#27272a" : "#e5e7eb",
      }}
    >
      <div className="absolute inset-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: isDark ? "#3f3f46" : "#d4d4d8" }} />
          <span className="h-2 flex-1 rounded" style={{ background: isDark ? "#3f3f46" : "#e4e4e7" }} />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: isDark ? "#3f3f46" : "#d4d4d8" }} />
          <span className="h-2 flex-1 rounded" style={{ background: isDark ? "#1d4ed8" : "#bfdbfe" }} />
        </div>
      </div>
    </div>
  )
}

export function AppearanceDialog({ open, onOpenChange }: AppearanceDialogProps): React.ReactNode {
  const { theme, setTheme } = useTheme()
  const { tx } = useT()
  const current = (theme ?? "system") as Mode

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{tx("Appearance")}</DialogTitle>
          <DialogDescription>
            {tx("Pick how the interface looks. The choice is saved to your browser profile.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const isSelected = current === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setTheme(m.id)}
                className={`group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 ${
                  isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
                }`}
              >
                <ModePreview mode={m.id === "system" ? "light" : m.id} />
                <div className="flex items-center gap-2">
                  <m.Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{tx(m.label)}</span>
                  {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{m.description}</p>
              </button>
            )
          })}
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Tip: your preference syncs across tabs in this browser. To match a different device, sign in there and set
          it again.
        </p>
      </DialogContent>
    </Dialog>
  )
}
