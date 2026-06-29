"use client"

import React, { useState, useEffect, useCallback } from "react"
import { X, Plus, Save, FolderOpen, Trash2 } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────

export interface QBField {
  field: string
  label: string
  type: "string" | "number" | "date" | "boolean" | "select"
  options?: string[]
}

export interface QBCondition {
  id: string
  field: string
  operator: string
  value: string | number | boolean | [string, string]
}

export interface QBGroup {
  id: string
  conjunction: "and" | "or"
  conditions: QBCondition[]
  groups: QBGroup[]
}

export interface SavedQuery {
  id: string
  name: string
  query: QBGroup
  createdAt: string
}

// ── Operators per type ─────────────────────────────────────────────────

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: "equal", label: "Equal" },
    { value: "not_equal", label: "Not Equal" },
    { value: "starts_with", label: "Starts With" },
    { value: "ends_with", label: "Ends With" },
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Not Contains" },
    { value: "in", label: "In" },
    { value: "is_empty", label: "Is Empty" },
    { value: "is_not_empty", label: "Is Not Empty" },
  ],
  number: [
    { value: "equal", label: "Equal" },
    { value: "not_equal", label: "Not Equal" },
    { value: "greater_than", label: "Greater Than" },
    { value: "greater_or_equal", label: "Greater Or Equal" },
    { value: "less_than", label: "Less Than" },
    { value: "less_or_equal", label: "Less Or Equal" },
    { value: "between", label: "Between" },
    { value: "is_empty", label: "Is Empty" },
    { value: "is_not_empty", label: "Is Not Empty" },
  ],
  date: [
    { value: "equal", label: "Equal" },
    { value: "not_equal", label: "Not Equal" },
    { value: "greater_than", label: "After" },
    { value: "less_than", label: "Before" },
    { value: "between", label: "Between" },
    { value: "is_empty", label: "Is Empty" },
    { value: "is_not_empty", label: "Is Not Empty" },
  ],
  boolean: [
    { value: "equal", label: "Equal" },
  ],
  select: [
    { value: "equal", label: "Equal" },
    { value: "not_equal", label: "Not Equal" },
    { value: "in", label: "In" },
    { value: "is_empty", label: "Is Empty" },
    { value: "is_not_empty", label: "Is Not Empty" },
  ],
}

// ── Helpers ────────────────────────────────────────────────────────────

let _qbId = 0
function qbId() { return `qb_${++_qbId}_${Date.now()}` }

function defaultValue(type: string): string | boolean {
  if (type === "boolean") return true
  return ""
}

function defaultOperator(type: string): string {
  if (type === "boolean") return "equal"
  if (type === "number") return "equal"
  if (type === "date") return "equal"
  return "contains"
}

function createCondition(fields: QBField[]): QBCondition {
  const f = fields[0]
  return { id: qbId(), field: f.field, operator: defaultOperator(f.type), value: defaultValue(f.type) }
}

function createGroup(fields: QBField[]): QBGroup {
  return { id: qbId(), conjunction: "and", conditions: [createCondition(fields)], groups: [] }
}

export function createDefaultQuery(_fields: QBField[]): QBGroup {
  return { id: qbId(), conjunction: "and", conditions: [], groups: [] }
}

function countRules(g: QBGroup): number {
  return g.conditions.length + g.groups.reduce((n, sub) => n + countRules(sub), 0)
}

// ── Shared select class ────────────────────────────────────────────────

const selectCls = "h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
const inputCls = "h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"

// ── Value editor ───────────────────────────────────────────────────────

function ValueEditor({ condition, fieldDef, onChange }: {
  condition: QBCondition
  fieldDef: QBField | undefined
  onChange: (value: QBCondition["value"]) => void
}) {
  const type = fieldDef?.type ?? "string"
  const op = condition.operator

  if (op === "is_empty" || op === "is_not_empty") return null

  if (type === "boolean") {
    return (
      <div className="flex items-center gap-4 px-1">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name={`bool_${condition.id}`} checked={condition.value === true} onChange={() => onChange(true)} className="accent-primary" />
          true
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name={`bool_${condition.id}`} checked={condition.value === false} onChange={() => onChange(false)} className="accent-primary" />
          false
        </label>
      </div>
    )
  }

  if (type === "select" && fieldDef?.options) {
    return (
      <select value={String(condition.value)} onChange={(e) => onChange(e.target.value)} className={`${selectCls} min-w-[120px] flex-1`}>
        <option value="">Select...</option>
        {fieldDef.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (type === "date" && op === "between") {
    const arr = Array.isArray(condition.value) ? condition.value : ["", ""]
    return (
      <div className="flex flex-col gap-1">
        <input type="date" value={arr[0] ?? ""} onChange={(e) => onChange([e.target.value, arr[1] ?? ""])} className={`${inputCls} min-w-[130px]`} />
        <input type="date" value={arr[1] ?? ""} onChange={(e) => onChange([arr[0] ?? "", e.target.value])} className={`${inputCls} min-w-[130px]`} />
      </div>
    )
  }

  if (type === "date") {
    return <input type="date" value={String(condition.value)} onChange={(e) => onChange(e.target.value)} className={`${inputCls} min-w-[130px] flex-1`} />
  }

  if (type === "number" && op === "between") {
    const arr = Array.isArray(condition.value) ? condition.value : ["", ""]
    return (
      <div className="flex items-center gap-1">
        <input type="number" value={arr[0] ?? ""} onChange={(e) => onChange([e.target.value, arr[1] ?? ""])} className={`${inputCls} w-20`} />
        <span className="text-[10px] text-muted-foreground">—</span>
        <input type="number" value={arr[1] ?? ""} onChange={(e) => onChange([arr[0] ?? "", e.target.value])} className={`${inputCls} w-20`} />
      </div>
    )
  }

  if (type === "number") {
    return <input type="number" value={String(condition.value)} onChange={(e) => onChange(e.target.value)} className={`${inputCls} w-24 flex-1`} />
  }

  return (
    <input
      type="text"
      value={String(condition.value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={op === "in" ? "val1, val2" : "Value..."}
      className={`${inputCls} min-w-[120px] flex-1`}
    />
  )
}

// ── Condition row (horizontal layout) ────────────────────────────────────

function ConditionRow({ condition, fields, onUpdate, onRemove }: {
  condition: QBCondition
  fields: QBField[]
  onUpdate: (c: QBCondition) => void
  onRemove: () => void
}) {
  const fieldDef = fields.find((f) => f.field === condition.field)
  const type = fieldDef?.type ?? "string"
  const ops = OPERATORS[type] ?? OPERATORS.string

  const handleFieldChange = (newField: string) => {
    const newDef = fields.find((f) => f.field === newField)
    const newType = newDef?.type ?? "string"
    onUpdate({ ...condition, field: newField, operator: defaultOperator(newType), value: defaultValue(newType) })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/50 px-3 py-2">
      <select value={condition.field} onChange={(e) => handleFieldChange(e.target.value)} className={`${selectCls} min-w-[120px] flex-1`}>
        {fields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
      </select>
      <select value={condition.operator} onChange={(e) => onUpdate({ ...condition, operator: e.target.value })} className={`${selectCls} min-w-[110px] flex-1`}>
        {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ValueEditor condition={condition} fieldDef={fieldDef} onChange={(v) => onUpdate({ ...condition, value: v })} />
      <button onClick={onRemove} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Group component (recursive) ────────────────────────────────────────

function GroupBlock({ group, fields, onUpdate, onRemove, isRoot }: {
  group: QBGroup
  fields: QBField[]
  onUpdate: (g: QBGroup) => void
  onRemove?: () => void
  isRoot?: boolean
}) {
  const toggleConjunction = (val: "and" | "or") => onUpdate({ ...group, conjunction: val })
  const addCondition = () => onUpdate({ ...group, conditions: [...group.conditions, createCondition(fields)] })
  const addGroup = () => onUpdate({ ...group, groups: [...group.groups, createGroup(fields)] })
  const updateCondition = (idx: number, c: QBCondition) => { const next = [...group.conditions]; next[idx] = c; onUpdate({ ...group, conditions: next }) }
  const removeCondition = (idx: number) => onUpdate({ ...group, conditions: group.conditions.filter((_, i) => i !== idx) })
  const updateSubGroup = (idx: number, g: QBGroup) => { const next = [...group.groups]; next[idx] = g; onUpdate({ ...group, groups: next }) }
  const removeSubGroup = (idx: number) => onUpdate({ ...group, groups: group.groups.filter((_, i) => i !== idx) })

  return (
    <div className={`relative rounded-lg border border-border/70 bg-card/50 ${isRoot ? "" : "mt-2"}`}>
      {/* Conjunction header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-xs font-medium">
          <button onClick={() => toggleConjunction("and")} className={`px-3 py-1 transition ${group.conjunction === "and" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>AND</button>
          <button onClick={() => toggleConjunction("or")} className={`px-3 py-1 transition ${group.conjunction === "or" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>OR</button>
        </div>
        <button onClick={addCondition} className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary" title="Add condition">
          <Plus className="h-3 w-3" />
        </button>
        {onRemove && (
          <button onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" title="Remove group">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Rules */}
      <div className="relative space-y-2 py-2 pl-5 pr-3">
        {(group.conditions.length + group.groups.length > 1) && (
          <div className="absolute bottom-4 left-3 top-4 w-px border-l border-dashed border-border/60" />
        )}

        {group.conditions.map((c, i) => (
          <ConditionRow key={c.id} condition={c} fields={fields} onUpdate={(u) => updateCondition(i, u)} onRemove={() => removeCondition(i)} />
        ))}

        {group.groups.map((sub, i) => (
          <GroupBlock key={sub.id} group={sub} fields={fields} onUpdate={(u) => updateSubGroup(i, u)} onRemove={() => removeSubGroup(i)} />
        ))}

        {group.conditions.length === 0 && group.groups.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">No conditions. Click + to add.</p>
        )}
      </div>

      {/* Footer — root only */}
      {isRoot && (
        <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2">
          <button onClick={addCondition} className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/5">+ Condition</button>
          <button onClick={addGroup} className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/5">+ Group</button>
        </div>
      )}
    </div>
  )
}

// ── Saved queries panel ────────────────────────────────────────────────

function SavedQueriesPanel({ storageKey, query, onApply }: {
  storageKey: string
  query: QBGroup
  onApply: (q: QBGroup) => void
}) {
  const [saved, setSaved] = useState<SavedQuery[]>([])
  const [name, setName] = useState("")
  const [showList, setShowList] = useState(false)

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setSaved(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [storageKey])

  // Persist
  const persist = useCallback((items: SavedQuery[]) => {
    setSaved(items)
    try { localStorage.setItem(storageKey, JSON.stringify(items)) } catch { /* ignore */ }
  }, [storageKey])

  const handleSave = () => {
    if (!name.trim()) return
    const entry: SavedQuery = { id: qbId(), name: name.trim(), query: JSON.parse(JSON.stringify(query)), createdAt: new Date().toISOString() }
    persist([entry, ...saved])
    setName("")
  }

  const handleDelete = (id: string) => {
    persist(saved.filter((s) => s.id !== id))
  }

  const handleApply = (sq: SavedQuery) => {
    onApply(JSON.parse(JSON.stringify(sq.query)))
    setShowList(false)
  }

  return (
    <div className="space-y-2">
      {/* Save row */}
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Save current query as..."
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
        />
        <button onClick={handleSave} disabled={!name.trim()} className="flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium transition hover:bg-muted disabled:opacity-40" title="Save query">
          <Save className="h-3 w-3" />
          Save
        </button>
        <button onClick={() => setShowList((v) => !v)} className={`flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium transition ${showList ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`} title="Saved queries">
          <FolderOpen className="h-3 w-3" />
          {saved.length > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">{saved.length}</span>}
        </button>
      </div>

      {/* Saved list */}
      {showList && saved.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2">
          {saved.map((sq) => (
            <div key={sq.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/50">
              <button onClick={() => handleApply(sq)} className="flex-1 text-left font-medium text-foreground hover:text-primary" title="Apply this query">
                {sq.name}
              </button>
              <span className="shrink-0 text-[10px] text-muted-foreground">{countRules(sq.query)} rules</span>
              <button onClick={() => handleDelete(sq.id)} className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" title="Delete">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {showList && saved.length === 0 && (
        <div className="rounded-md border border-border bg-background px-3 py-3 text-center text-xs text-muted-foreground">No saved queries yet</div>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────

export interface QueryBuilderProps {
  fields: QBField[]
  query: QBGroup
  onChange: (query: QBGroup) => void
  /** localStorage key for saved queries. If provided, shows save/load UI. */
  storageKey?: string
}

export function QueryBuilder({ fields, query, onChange, storageKey }: QueryBuilderProps) {
  const handleReset = () => onChange(createDefaultQuery(fields))
  const ruleCount = countRules(query)

  return (
    <div className="space-y-3">
      <GroupBlock group={query} fields={fields} onUpdate={onChange} isRoot />
      {storageKey && <SavedQueriesPanel storageKey={storageKey} query={query} onApply={onChange} />}
      {ruleCount > 0 && (
        <button onClick={handleReset} className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted">Reset All</button>
      )}
    </div>
  )
}
