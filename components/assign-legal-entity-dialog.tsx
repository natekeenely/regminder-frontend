"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useT } from "@/lib/i18n"

interface LegalEntityRow extends Record<string, unknown> {
  legal_entity_id?: string
  legal_entity_code?: string
  legal_entity_name?: string
  country_code?: string
  currency_code?: string
  controlling_area_id?: string
  version_no?: number | string
}

interface AssignLegalEntityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  controllingAreaId: string
  // The currency of the controlling area. Only LEs whose currency_code matches this
  // value can be assigned (validation rule per request).
  controllingAreaCurrency: string
  // Called after a successful assignment so the parent can reload its detail/subtables.
  onAssigned?: () => void
}

/**
 * AssignLegalEntityDialog — popup picker for linking existing Legal Entity records to a
 * Controlling Area. Lists candidate LEs filtered to those with a matching currency,
 * lets the user pick one, and PATCHes that LE's controlling_area_id on confirm.
 */
export function AssignLegalEntityDialog({
  open,
  onOpenChange,
  controllingAreaId,
  controllingAreaCurrency,
  onAssigned,
}: AssignLegalEntityDialogProps): React.ReactNode {
  const { tx } = useT()
  const [items, setItems] = React.useState<LegalEntityRow[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [selected, setSelected] = React.useState<string>("")
  const [busy, setBusy] = React.useState<boolean>(false)
  const [message, setMessage] = React.useState<string>("")

  // Fetch all LE candidates when the dialog opens. We filter on the client so the user
  // can see exactly why an LE is or isn't eligible (matching vs. non-matching currency).
  React.useEffect(() => {
    if (!open) return
    setItems([])
    setSelected("")
    setMessage("")
    setLoading(true)
    void (async () => {
      try {
        const resp = await fetch("/api/proxy/api/v1/mdm/legal-entity?limit=500&offset=0")
        const data = (await resp.json()) as { items?: LegalEntityRow[] }
        setItems(data.items ?? [])
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    })()
  }, [open])

  const targetCurrency = String(controllingAreaCurrency ?? "").trim().toUpperCase()
  const matching = items.filter((r) => String(r.currency_code ?? "").trim().toUpperCase() === targetCurrency)
  // Already linked to this CA → shown but disabled.
  const isAssignedHere = (r: LegalEntityRow): boolean => String(r.controlling_area_id ?? "") === controllingAreaId

  async function assign(): Promise<void> {
    if (!selected) {
      setMessage("Please select a Legal Entity to assign.")
      return
    }
    const row = items.find((r) => String(r.legal_entity_id ?? "") === selected)
    if (!row) {
      setMessage("Selected record not found.")
      return
    }
    // Re-check the currency on submit in case the list changed under us.
    const rowCur = String(row.currency_code ?? "").trim().toUpperCase()
    if (rowCur !== targetCurrency) {
      setMessage(`Currency mismatch: Legal Entity uses ${rowCur || "(none)"}, Controlling Area uses ${targetCurrency || "(none)"}.`)
      return
    }
    setBusy(true)
    try {
      const version = Number(row.version_no ?? 1)
      const resp = await fetch(`/api/proxy/api/v1/mdm/legal-entity/${encodeURIComponent(selected)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ controlling_area_id: controllingAreaId, version_no: version, updated_by: "mdm-ui" }),
      })
      const data = (await resp.json()) as { ok?: boolean; detail?: string }
      if (!resp.ok || !data.ok) {
        setMessage(`Assign failed: ${data.detail ?? resp.statusText}`)
        return
      }
      onAssigned?.()
      onOpenChange(false)
    } catch (err) {
      setMessage(`Assign failed: ${err instanceof Error ? err.message : "unknown"}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{tx("Assign Legal Entity")}</DialogTitle>
          <DialogDescription>
            {tx("Pick a Legal Entity to link to this Controlling Area. Only entities with the same currency are eligible.")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-border bg-muted/30 px-3 py-1.5 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">{tx("Controlling Area currency")}:</span>{" "}
          <span className="font-medium text-foreground">{targetCurrency || "—"}</span>
        </div>

        {message && (
          <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">{message}</div>
        )}

        <div className="max-h-[50vh] overflow-auto rounded border border-border">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-2"></th>
                <th className="px-3 py-2 text-left font-medium">{tx("LE Code")}</th>
                <th className="px-3 py-2 text-left font-medium">{tx("Name")}</th>
                <th className="px-3 py-2 text-left font-medium">{tx("Country")}</th>
                <th className="px-3 py-2 text-left font-medium">{tx("Currency")}</th>
                <th className="px-3 py-2 text-left font-medium">{tx("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{tx("Loading…")}</td></tr>
              )}
              {!loading && matching.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  {tx("No Legal Entities with matching currency.")}
                </td></tr>
              )}
              {!loading && matching.map((r) => {
                const id = String(r.legal_entity_id ?? "")
                const already = isAssignedHere(r)
                return (
                  <tr
                    key={id}
                    onClick={() => { if (!already) setSelected(id) }}
                    className={`cursor-pointer border-t border-border/60 hover:bg-muted/40 ${selected === id ? "bg-primary/10" : ""} ${already ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="radio"
                        checked={selected === id}
                        disabled={already}
                        onChange={() => setSelected(id)}
                      />
                    </td>
                    <td className="px-3 py-1.5">{String(r.legal_entity_code ?? "")}</td>
                    <td className="px-3 py-1.5">{String(r.legal_entity_name ?? "")}{already ? " (already assigned)" : ""}</td>
                    <td className="px-3 py-1.5">{String(r.country_code ?? "")}</td>
                    <td className="px-3 py-1.5">{String(r.currency_code ?? "")}</td>
                    <td className="px-3 py-1.5">{String(r.status ?? "")}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
            disabled={busy}
          >
            {tx("Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void assign()}
            disabled={busy || !selected}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? tx("Assigning…") : tx("Assign")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
