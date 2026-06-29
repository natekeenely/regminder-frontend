"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

interface ColumnFilterPopoverProps {
  column: string
  label?: string
  value: string
  onChange: (value: string) => void
  onClear: () => void
  onClose: () => void
}

export function ColumnFilterPopover({ column, label, value, onChange, onClear, onClose }: ColumnFilterPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-5 top-6 z-30 w-52 rounded-md border border-border bg-card p-2 shadow-lg">
      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
        Filter {label ?? column}
      </label>
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") onClose() }}
        placeholder="Type to filter"
        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
      />
      <div className="mt-2 flex justify-end gap-1">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>Clear</Button>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
