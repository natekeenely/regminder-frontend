interface SelectShellProps {
  label?: string
  value: string
}

export function SelectShell({ label, value }: SelectShellProps) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>}
      <select value={value} onChange={() => undefined} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
        <option>{value}</option>
      </select>
    </label>
  )
}
