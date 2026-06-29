"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Edit3,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ───────── types ───────── */

interface IamUserRef {
  user_id: string
  display_name: string
  email?: string
  enabled: boolean
}

interface UserSummary {
  user_id: string
  requests: number
  input_tokens: number | string
  output_tokens: number | string
  cost_usd: number | string
  avg_latency_ms: number
}

interface ModelDetail {
  user_id: string
  provider: string
  model: string
  requests: number
  input_tokens: number | string
  output_tokens: number | string
  cost_usd: number | string
  avg_latency_ms: number
}

interface DailyRow {
  date: string
  requests: number
  input_tokens: number | string
  output_tokens: number | string
  cost_usd: number | string
}

interface ModelTotal {
  provider: string
  model: string
  requests: number
  input_tokens: number | string
  output_tokens: number | string
  cost_usd: number | string
  avg_latency_ms: number
}

interface SummaryData {
  byUser: UserSummary[]
  byModel: ModelDetail[]
  daily: DailyRow[]
  modelTotals: ModelTotal[]
}

interface ModelPricing {
  model: string
  provider: string
  inputPer1M: number
  outputPer1M: number
  contextWindow: number
}

interface UserBudget {
  budget_id: string
  user_id: string
  user_name: string
  email: string
  monthly_limit_usd: number | string
  alert_threshold_pct: number
  enabled: boolean
  created_at: string
  updated_at: string
}

/* ───────── pricing ───────── */

const MODEL_PRICING: ModelPricing[] = [
  { model: "gpt-4o",          provider: "openai",       inputPer1M: 2.50,   outputPer1M: 10.00,  contextWindow: 128000 },
  { model: "gpt-4o-mini",     provider: "openai",       inputPer1M: 0.15,   outputPer1M: 0.60,   contextWindow: 128000 },
  { model: "gpt-4.1",         provider: "openai",       inputPer1M: 2.00,   outputPer1M: 8.00,   contextWindow: 1047576 },
  { model: "gpt-4.1-mini",    provider: "openai",       inputPer1M: 0.40,   outputPer1M: 1.60,   contextWindow: 1047576 },
  { model: "gpt-4.1-nano",    provider: "openai",       inputPer1M: 0.10,   outputPer1M: 0.40,   contextWindow: 1047576 },
  { model: "o3",              provider: "openai",       inputPer1M: 2.00,   outputPer1M: 8.00,   contextWindow: 200000 },
  { model: "o4-mini",         provider: "openai",       inputPer1M: 1.10,   outputPer1M: 4.40,   contextWindow: 200000 },
  { model: "gpt-4o",          provider: "azure-openai", inputPer1M: 2.50,   outputPer1M: 10.00,  contextWindow: 128000 },
  { model: "gpt-4o-mini",     provider: "azure-openai", inputPer1M: 0.15,   outputPer1M: 0.60,   contextWindow: 128000 },
  { model: "gpt-4.1",         provider: "azure-openai", inputPer1M: 2.00,   outputPer1M: 8.00,   contextWindow: 1047576 },
  { model: "claude-opus-4-8",   provider: "anthropic", inputPer1M: 15.00,  outputPer1M: 75.00,  contextWindow: 200000 },
  { model: "claude-sonnet-4-6", provider: "anthropic", inputPer1M: 3.00,   outputPer1M: 15.00,  contextWindow: 200000 },
  { model: "claude-haiku-4-5",  provider: "anthropic", inputPer1M: 0.80,   outputPer1M: 4.00,   contextWindow: 200000 },
  { model: "gemini-2.5-pro",    provider: "google-gemini", inputPer1M: 1.25,  outputPer1M: 10.00, contextWindow: 1048576 },
  { model: "gemini-2.5-flash",  provider: "google-gemini", inputPer1M: 0.15,  outputPer1M: 0.60,  contextWindow: 1048576 },
  { model: "deepseek-chat",     provider: "deepseek", inputPer1M: 0.27,   outputPer1M: 1.10,   contextWindow: 64000 },
  { model: "deepseek-reasoner", provider: "deepseek", inputPer1M: 0.55,   outputPer1M: 2.19,   contextWindow: 64000 },
  { model: "llama3.1",        provider: "ollama", inputPer1M: 0, outputPer1M: 0, contextWindow: 128000 },
  { model: "mistral",         provider: "ollama", inputPer1M: 0, outputPer1M: 0, contextWindow: 32000 },
  { model: "qwen2.5",         provider: "ollama", inputPer1M: 0, outputPer1M: 0, contextWindow: 128000 },
]

const PROVIDER_LOGOS: Record<string, string> = {
  openai: "/logos/openai.svg",
  "azure-openai": "/logos/azure-openai.svg",
  anthropic: "/logos/anthropic.svg",
  "google-gemini": "/logos/gemini.svg",
  deepseek: "/logos/deepseek.svg",
  ollama: "",
}

/* ───────── helpers ───────── */

function num(v: number | string): number { return typeof v === "string" ? parseFloat(v) || 0 : v }

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
}
function formatCost(n: number): string { return `$${n.toFixed(2)}` }
function formatCostPrecise(n: number): string { return `$${n.toFixed(4)}` }

type TabKey = "overview" | "users" | "budgets" | "pricing"

/* ───────── component ───────── */

export function AiUsageContent() {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [iamUsers, setIamUsers] = useState<IamUserRef[]>([])
  const [budgets, setBudgets] = useState<UserBudget[]>([])
  const [period, setPeriod] = useState<"7" | "14" | "30">("30")
  const [filterUserId, setFilterUserId] = useState<string>("__all__")
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [message, setMessage] = useState("")

  // expandable user rows
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // budget edit
  const [editBudgetId, setEditBudgetId] = useState<string | null>(null)
  const [editLimit, setEditLimit] = useState("")
  const [editThreshold, setEditThreshold] = useState("")

  // new budget
  const [showNewBudget, setShowNewBudget] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [newLimit, setNewLimit] = useState("50")
  const [newThreshold, setNewThreshold] = useState("80")

  useEffect(() => {
    void loadSummary()
    void loadIamUsers()
    void loadBudgets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void loadSummary() }, [period, filterUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSummary() {
    setBusy(true)
    try {
      const qs = new URLSearchParams({ days: period })
      if (filterUserId && filterUserId !== "__all__") qs.set("userId", filterUserId)
      const resp = await fetch(`/api/proxy/api/v1/ai-usage/summary?${qs}`)
      if (resp.ok) {
        const json = await resp.json()
        if (json.ok) { setSummary(json); setBusy(false); return }
      }
    } catch {}
    setBusy(false)
  }

  async function loadIamUsers() {
    try {
      const resp = await fetch("/api/proxy/api/v1/iam/users")
      if (resp.ok) {
        const json = (await resp.json()) as { items?: IamUserRef[] }
        if (json.items?.length) { setIamUsers(json.items); return }
      }
    } catch {}
    setIamUsers([
      { user_id: "u-001", display_name: "Nate K.", email: "nate.lzy78@gmail.com", enabled: true },
      { user_id: "u-002", display_name: "Sarah Chen", email: "sarah.chen@tic-global.com", enabled: true },
      { user_id: "u-003", display_name: "Marco Rossi", email: "marco.rossi@tic-global.com", enabled: true },
      { user_id: "u-004", display_name: "Yuki Tanaka", email: "yuki.tanaka@tic-global.com", enabled: true },
      { user_id: "u-005", display_name: "Anna Schmidt", email: "anna.schmidt@tic-global.com", enabled: true },
    ])
  }

  async function loadBudgets() {
    try {
      const resp = await fetch("/api/proxy/api/v1/ai-budget")
      if (resp.ok) {
        const json = await resp.json()
        if (json.ok) { setBudgets(json.items ?? []); return }
      }
    } catch {}
  }

  // Resolve user_id → display name
  function userName(userId: string): string {
    const u = iamUsers.find((u) => u.user_id === userId)
    return u?.display_name ?? userId
  }

  // Derived
  const selectedIamUser = useMemo(() => iamUsers.find((u) => u.user_id === selectedUserId), [iamUsers, selectedUserId])
  const availableUsersForBudget = useMemo(() => {
    const assigned = new Set(budgets.map((b) => b.user_id))
    return iamUsers.filter((u) => u.enabled && !assigned.has(u.user_id))
  }, [iamUsers, budgets])

  // Totals
  const totals = useMemo(() => {
    if (!summary) return { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0, avgLatency: 0, activeUsers: 0 }
    const t = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0, latencySum: 0, activeUsers: summary.byUser.length }
    for (const u of summary.byUser) {
      t.requests += u.requests
      t.inputTokens += num(u.input_tokens)
      t.outputTokens += num(u.output_tokens)
      t.cost += num(u.cost_usd)
      t.latencySum += (u.avg_latency_ms ?? 0) * u.requests
    }
    return { ...t, avgLatency: t.requests ? Math.round(t.latencySum / t.requests) : 0 }
  }, [summary])

  // Model details for expanded user
  const userModelDetails = useMemo(() => {
    if (!summary || !expandedUserId) return []
    return summary.byModel
      .filter((m) => m.user_id === expandedUserId)
      .sort((a, b) => num(b.cost_usd) - num(a.cost_usd))
  }, [summary, expandedUserId])

  // Daily chart data
  const dailyData = useMemo(() => summary?.daily ?? [], [summary])
  const maxCost = Math.max(...dailyData.map((d) => num(d.cost_usd)), 0.01)

  // Configured models
  const configuredModels = useMemo(() => {
    try {
      const raw = localStorage.getItem("hermes.aiProviders")
      if (!raw) return [] as string[]
      const d = JSON.parse(raw)
      return (d.providers ?? []).filter((p: any) => p.enabled !== false).flatMap((p: any) => (p.aiModels?.length ? p.aiModels : p.aiModel ? [p.aiModel] : []) as string[]).filter(Boolean)
    } catch { return [] as string[] }
  }, [])

  // Budget CRUD (API-backed)
  async function addBudget() {
    if (!selectedIamUser) return
    try {
      const resp = await fetch("/api/proxy/api/v1/ai-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedIamUser.user_id,
          userName: selectedIamUser.display_name,
          email: selectedIamUser.email ?? "",
          monthlyLimitUsd: parseFloat(newLimit) || 50,
          alertThresholdPct: parseInt(newThreshold) || 80,
        }),
      })
      if (resp.ok) {
        await loadBudgets()
        setShowNewBudget(false); setSelectedUserId(""); setNewLimit("50"); setNewThreshold("80")
        flash("Budget added")
      } else {
        const err = await resp.json().catch(() => ({}))
        flash((err as any).detail ?? "Failed to add budget")
      }
    } catch { flash("Network error") }
  }
  async function saveBudgetEdit(id: string) {
    try {
      const resp = await fetch(`/api/proxy/api/v1/ai-budget/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyLimitUsd: parseFloat(editLimit) || undefined,
          alertThresholdPct: parseInt(editThreshold) || undefined,
        }),
      })
      if (resp.ok) { await loadBudgets(); setEditBudgetId(null); flash("Budget updated") }
    } catch { flash("Network error") }
  }
  async function removeBudget(id: string) {
    try {
      await fetch(`/api/proxy/api/v1/ai-budget/${id}`, { method: "DELETE" })
      await loadBudgets()
    } catch {}
  }
  async function toggleBudget(id: string, enabled: boolean) {
    try {
      await fetch(`/api/proxy/api/v1/ai-budget/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      await loadBudgets()
    } catch {}
  }
  function flash(msg: string) { setMessage(msg); setTimeout(() => setMessage(""), 2000) }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />Usage & Budgets
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {message && <Badge variant="outline" className="text-xs text-green-600 border-green-500/30"><Check className="mr-1 h-3 w-3" />{message}</Badge>}
            <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="All Users" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Users</SelectItem>
                {iamUsers.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void loadSummary()} className="h-9 px-3 text-xs">
              <RefreshCw className={cn("mr-2 h-3.5 w-3.5", busy && "animate-spin")} />Refresh
            </Button>
          </div>
        </div>
        <div className="flex gap-1 mt-4 -mb-4">
          {([
            { key: "overview" as TabKey, label: "Overview", icon: <BarChart3 className="h-3.5 w-3.5" /> },
            { key: "users" as TabKey, label: "By User", icon: <Users className="h-3.5 w-3.5" /> },
            { key: "budgets" as TabKey, label: "Budgets & Limits", icon: <DollarSign className="h-3.5 w-3.5" /> },
            { key: "pricing" as TabKey, label: "Model Pricing", icon: <Settings2 className="h-3.5 w-3.5" /> },
          ]).map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
              activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{tab.icon}{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {!summary && busy && <div className="text-center text-xs text-muted-foreground py-12">Loading usage data...</div>}

        {/* ═══════ OVERVIEW ═══════ */}
        {activeTab === "overview" && summary && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Total Requests", value: formatNumber(totals.requests), icon: <Zap className="h-4 w-4" />, color: "text-primary bg-primary/10" },
                { label: "Total Tokens", value: formatNumber(totals.inputTokens + totals.outputTokens), icon: <Activity className="h-4 w-4" />, color: "text-blue-600 bg-blue-500/10" },
                { label: "Total Cost", value: formatCost(totals.cost), icon: <DollarSign className="h-4 w-4" />, color: "text-green-600 bg-green-500/10" },
                { label: "Avg Latency", value: `${totals.avgLatency}ms`, icon: <Clock className="h-4 w-4" />, color: "text-amber-600 bg-amber-500/10" },
                { label: "Active Users", value: String(totals.activeUsers), icon: <Users className="h-4 w-4" />, color: "text-purple-600 bg-purple-500/10" },
              ].map((card) => (
                <div key={card.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", card.color)}>{card.icon}</div>
                    <Badge variant="outline" className="text-[10px]">{period}d</Badge>
                  </div>
                  <div className="text-xl font-semibold text-foreground">{card.value}</div>
                  <div className="text-xs text-muted-foreground">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Daily Cost Chart */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-1 text-sm font-semibold text-foreground">Daily Cost (USD)</h2>
              <p className="mb-4 text-[11px] text-muted-foreground">Spending over the selected period</p>
              <div className="flex items-end gap-[2px] h-32">
                {dailyData.map((d) => {
                  const h = Math.max(2, (num(d.cost_usd) / maxCost) * 100)
                  return (
                    <div key={d.date} className="flex-1 group relative" title={`${d.date}: ${formatCost(num(d.cost_usd))}`}>
                      <div className="w-full rounded-t bg-green-500/70 transition-colors group-hover:bg-green-500" style={{ height: `${h}%` }} />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-foreground px-1.5 py-0.5 text-[9px] text-background whitespace-nowrap z-10">
                        {String(d.date).slice(5)}: {formatCost(num(d.cost_usd))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                <span>{String(dailyData[0]?.date ?? "").slice(5)}</span>
                <span>{String(dailyData[dailyData.length - 1]?.date ?? "").slice(5)}</span>
              </div>
            </div>

            {/* Model Breakdown */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Cost by Model</h2>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Model</th>
                      <th className="pb-2 pr-4 font-medium">Provider</th>
                      <th className="pb-2 pr-4 font-medium text-right">Requests</th>
                      <th className="pb-2 pr-4 font-medium text-right">Input Tokens</th>
                      <th className="pb-2 pr-4 font-medium text-right">Output Tokens</th>
                      <th className="pb-2 pr-4 font-medium text-right">Cost</th>
                      <th className="pb-2 font-medium text-right">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.modelTotals ?? []).map((m) => (
                      <tr key={`${m.provider}-${m.model}`} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 font-mono font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            {PROVIDER_LOGOS[m.provider] && <img src={PROVIDER_LOGOS[m.provider]} alt="" className="h-3.5 w-3.5" />}
                            {m.model}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{m.provider}</td>
                        <td className="py-2.5 pr-4 text-right">{formatNumber(m.requests)}</td>
                        <td className="py-2.5 pr-4 text-right">{formatNumber(num(m.input_tokens))}</td>
                        <td className="py-2.5 pr-4 text-right">{formatNumber(num(m.output_tokens))}</td>
                        <td className="py-2.5 pr-4 text-right text-green-600 font-medium">{formatCost(num(m.cost_usd))}</td>
                        <td className="py-2.5 text-right">{m.avg_latency_ms ?? 0}ms</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-medium">
                      <td className="py-2.5 pr-4" colSpan={2}>Total</td>
                      <td className="py-2.5 pr-4 text-right">{formatNumber(totals.requests)}</td>
                      <td className="py-2.5 pr-4 text-right">{formatNumber(totals.inputTokens)}</td>
                      <td className="py-2.5 pr-4 text-right">{formatNumber(totals.outputTokens)}</td>
                      <td className="py-2.5 pr-4 text-right text-green-600">{formatCost(totals.cost)}</td>
                      <td className="py-2.5 text-right">{totals.avgLatency}ms</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══════ BY USER (with expandable model breakdown) ═══════ */}
        {activeTab === "users" && summary && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />Usage by User
                <span className="text-[10px] text-muted-foreground font-normal ml-2">Click a row to expand model breakdown</span>
              </h2>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium w-6"></th>
                      <th className="pb-2 pr-4 font-medium">User</th>
                      <th className="pb-2 pr-4 font-medium text-right">Requests</th>
                      <th className="pb-2 pr-4 font-medium text-right">Input Tokens</th>
                      <th className="pb-2 pr-4 font-medium text-right">Output Tokens</th>
                      <th className="pb-2 pr-4 font-medium text-right">Cost (USD)</th>
                      <th className="pb-2 pr-4 font-medium text-right">Avg Latency</th>
                      <th className="pb-2 pr-4 font-medium">Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.byUser ?? []).map((u) => {
                      const cost = num(u.cost_usd)
                      const isExpanded = expandedUserId === u.user_id
                      const budget = budgets.find((b) => b.user_id === u.user_id && b.enabled)
                      const budgetLimit = budget ? num(budget.monthly_limit_usd) : 0
                      const pct = budgetLimit > 0 ? (cost / budgetLimit) * 100 : null
                      const overBudget = pct !== null && pct >= 100
                      const nearBudget = pct !== null && !overBudget && pct >= (budget?.alert_threshold_pct ?? 80)
                      const name = userName(u.user_id)
                      const details = isExpanded ? userModelDetails : []

                      return (
                        <React.Fragment key={u.user_id}>
                          <tr
                            className={cn("border-b border-border/50 cursor-pointer transition-colors",
                              isExpanded ? "bg-primary/5" : "hover:bg-muted/30"
                            )}
                            onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                          >
                            <td className="py-2.5 pr-2 text-center">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">{name.charAt(0)}</div>
                                <div>
                                  <div className="font-medium">{name}</div>
                                  <div className="text-[9px] text-muted-foreground">{u.user_id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-right">{formatNumber(u.requests)}</td>
                            <td className="py-2.5 pr-4 text-right">{formatNumber(num(u.input_tokens))}</td>
                            <td className="py-2.5 pr-4 text-right">{formatNumber(num(u.output_tokens))}</td>
                            <td className={cn("py-2.5 pr-4 text-right font-medium", overBudget ? "text-red-600" : "text-green-600")}>{formatCost(cost)}</td>
                            <td className="py-2.5 pr-4 text-right text-muted-foreground">{u.avg_latency_ms ?? 0}ms</td>
                            <td className="py-2.5 pr-4">
                              {budget ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className={cn(overBudget ? "text-red-600 font-medium" : nearBudget ? "text-amber-600" : "text-muted-foreground")}>
                                      {formatCost(cost)} / {formatCost(budgetLimit)}
                                    </span>
                                    {overBudget && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                    {nearBudget && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                  </div>
                                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                    <div className={cn("h-full rounded-full transition-all", overBudget ? "bg-red-500" : nearBudget ? "bg-amber-500" : "bg-green-500")} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">No limit</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded: per-model breakdown */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="p-0">
                                <div className="bg-muted/20 border-b border-border px-8 py-3">
                                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                    Token Usage by Model — {name}
                                  </div>
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="text-[10px] text-muted-foreground border-b border-border/50">
                                        <th className="pb-1.5 pr-3 text-left font-medium">Model</th>
                                        <th className="pb-1.5 pr-3 text-left font-medium">Provider</th>
                                        <th className="pb-1.5 pr-3 text-right font-medium">Requests</th>
                                        <th className="pb-1.5 pr-3 text-right font-medium">Input Tokens</th>
                                        <th className="pb-1.5 pr-3 text-right font-medium">Output Tokens</th>
                                        <th className="pb-1.5 pr-3 text-right font-medium">Total Tokens</th>
                                        <th className="pb-1.5 pr-3 text-right font-medium">Cost</th>
                                        <th className="pb-1.5 text-right font-medium">Avg Latency</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {details.map((d) => {
                                        const inTok = num(d.input_tokens)
                                        const outTok = num(d.output_tokens)
                                        const totalTok = inTok + outTok
                                        const totalUserTok = num(u.input_tokens) + num(u.output_tokens)
                                        const pctOfUser = totalUserTok > 0 ? (totalTok / totalUserTok) * 100 : 0
                                        return (
                                          <tr key={`${d.provider}-${d.model}`} className="border-b border-border/30 last:border-0">
                                            <td className="py-2 pr-3">
                                              <div className="flex items-center gap-2">
                                                {PROVIDER_LOGOS[d.provider] && <img src={PROVIDER_LOGOS[d.provider]} alt="" className="h-3 w-3" />}
                                                <span className="font-mono font-medium text-foreground">{d.model}</span>
                                              </div>
                                            </td>
                                            <td className="py-2 pr-3 text-muted-foreground">{d.provider}</td>
                                            <td className="py-2 pr-3 text-right">{formatNumber(d.requests)}</td>
                                            <td className="py-2 pr-3 text-right">{formatNumber(inTok)}</td>
                                            <td className="py-2 pr-3 text-right">{formatNumber(outTok)}</td>
                                            <td className="py-2 pr-3 text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                <span>{formatNumber(totalTok)}</span>
                                                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                                  <div className="h-full rounded-full bg-primary/50" style={{ width: `${pctOfUser}%` }} />
                                                </div>
                                                <span className="text-[9px] text-muted-foreground w-8 text-right">{pctOfUser.toFixed(0)}%</span>
                                              </div>
                                            </td>
                                            <td className="py-2 pr-3 text-right text-green-600 font-medium">{formatCostPrecise(num(d.cost_usd))}</td>
                                            <td className="py-2 text-right text-muted-foreground">{d.avg_latency_ms ?? 0}ms</td>
                                          </tr>
                                        )
                                      })}
                                      {details.length === 0 && (
                                        <tr><td colSpan={8} className="py-3 text-center text-muted-foreground">No model data</td></tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ BUDGETS & LIMITS ═══════ */}
        {activeTab === "budgets" && (
          <div className="space-y-4 max-w-4xl">
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />User Budget Limits</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Set monthly spending limits per user in USD.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowNewBudget(true)} className="h-8 text-xs"><Plus className="mr-1.5 h-3 w-3" />Add User Budget</Button>
              </div>

              {showNewBudget && (
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="text-xs font-medium text-primary">Add User Budget</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">User</label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select a user..." /></SelectTrigger>
                        <SelectContent>
                          {availableUsersForBudget.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">All users already have budgets</div>}
                          {availableUsersForBudget.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0">{u.display_name.charAt(0)}</div>
                                <span>{u.display_name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">Email</label>
                      <div className="flex h-8 items-center rounded-md border border-border bg-muted/50 px-3 text-xs text-muted-foreground">{selectedIamUser?.email || "—"}</div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">Monthly Limit (USD)</label>
                      <Input type="number" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} min={1} className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">Alert at (%)</label>
                      <Input type="number" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} min={1} max={100} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addBudget} className="h-8 text-xs" disabled={!selectedUserId}><Save className="mr-1.5 h-3 w-3" />Add</Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowNewBudget(false); setSelectedUserId("") }} className="h-8 text-xs"><X className="mr-1.5 h-3 w-3" />Cancel</Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {budgets.map((b) => {
                  const isEdit = editBudgetId === b.budget_id
                  const userUsage = summary?.byUser.find((u) => u.user_id === b.user_id)
                  const spent = userUsage ? num(userUsage.cost_usd) : 0
                  const pct = num(b.monthly_limit_usd) > 0 ? (spent / num(b.monthly_limit_usd)) * 100 : 0
                  const overBudget = pct >= 100
                  const nearBudget = !overBudget && pct >= b.alert_threshold_pct
                  return (
                    <div key={b.budget_id} className={cn("rounded-lg border p-4", overBudget ? "border-red-500/30 bg-red-500/5" : nearBudget ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-muted/20")}>
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">{b.user_name.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{b.user_name}</span>
                            {b.email && <span className="text-[10px] text-muted-foreground">{b.email}</span>}
                            <Switch checked={b.enabled} onCheckedChange={(v) => toggleBudget(b.budget_id, v)} />
                            {overBudget && <Badge variant="outline" className="text-[9px] text-red-600 border-red-500/30"><AlertTriangle className="mr-1 h-3 w-3" />Over limit</Badge>}
                            {nearBudget && <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30"><AlertTriangle className="mr-1 h-3 w-3" />Near limit</Badge>}
                          </div>
                          <div className="mt-2 flex items-center gap-4">
                            {isEdit ? (
                              <>
                                <div><label className="text-[10px] text-muted-foreground">Monthly Limit (USD)</label><Input type="number" value={editLimit} onChange={(e) => setEditLimit(e.target.value)} className="h-7 w-28 text-xs mt-0.5" /></div>
                                <div><label className="text-[10px] text-muted-foreground">Alert at (%)</label><Input type="number" value={editThreshold} onChange={(e) => setEditThreshold(e.target.value)} className="h-7 w-20 text-xs mt-0.5" /></div>
                                <div className="flex gap-1 mt-3">
                                  <Button size="sm" onClick={() => saveBudgetEdit(b.budget_id)} className="h-7 text-[10px]"><Check className="h-3 w-3" /></Button>
                                  <Button variant="outline" size="sm" onClick={() => setEditBudgetId(null)} className="h-7 text-[10px]"><X className="h-3 w-3" /></Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="space-y-1">
                                  <div className="text-[11px] text-muted-foreground">
                                    <span className={cn("font-medium", overBudget ? "text-red-600" : "text-foreground")}>{formatCost(spent)}</span>
                                    <span> / {formatCost(num(b.monthly_limit_usd))} monthly</span>
                                    <span className="ml-2 text-[10px]">(alert at {b.alert_threshold_pct}%)</span>
                                  </div>
                                  <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
                                    <div className={cn("h-full rounded-full transition-all", overBudget ? "bg-red-500" : nearBudget ? "bg-amber-500" : "bg-green-500")} style={{ width: `${Math.min(100, pct)}%` }} />
                                  </div>
                                </div>
                                {userUsage && (
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatNumber(num(userUsage.input_tokens) + num(userUsage.output_tokens))} tokens · {formatNumber(userUsage.requests)} requests
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {!isEdit && (
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { setEditBudgetId(b.budget_id); setEditLimit(String(num(b.monthly_limit_usd))); setEditThreshold(String(b.alert_threshold_pct)) }} className="rounded p-1.5 hover:bg-muted"><Edit3 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                            <button onClick={() => removeBudget(b.budget_id)} className="rounded p-1.5 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {budgets.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center">
                    <DollarSign className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No user budgets configured</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Add budgets to track and limit AI spending per user</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ MODEL PRICING ═══════ */}
        {activeTab === "pricing" && (
          <div className="space-y-4 max-w-5xl">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" />Token Pricing by Model</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Reference pricing per 1M tokens (USD). Models you have configured are highlighted.</p>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Provider</th>
                      <th className="pb-2 pr-4 font-medium">Model</th>
                      <th className="pb-2 pr-4 font-medium text-right">Input / 1M tokens</th>
                      <th className="pb-2 pr-4 font-medium text-right">Output / 1M tokens</th>
                      <th className="pb-2 pr-4 font-medium text-right">Context Window</th>
                      <th className="pb-2 pr-4 font-medium text-right">Est. cost / 1K req</th>
                      <th className="pb-2 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODEL_PRICING.filter((p, i, arr) => arr.findIndex((x) => x.model === p.model && x.provider === p.provider) === i).map((p) => {
                      const isConfigured = configuredModels.includes(p.model)
                      const costPer1kReq = ((800 / 1_000_000) * p.inputPer1M + (300 / 1_000_000) * p.outputPer1M) * 1000
                      return (
                        <tr key={`${p.provider}-${p.model}`} className={cn("border-b border-border/50 last:border-0", isConfigured && "bg-primary/5")}>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              {PROVIDER_LOGOS[p.provider] && <img src={PROVIDER_LOGOS[p.provider]} alt="" className="h-3.5 w-3.5" />}
                              <span className="text-muted-foreground">{p.provider}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 font-mono font-medium">{p.model}</td>
                          <td className="py-2.5 pr-4 text-right">{p.inputPer1M === 0 ? <span className="text-green-600">Free</span> : formatCost(p.inputPer1M)}</td>
                          <td className="py-2.5 pr-4 text-right">{p.outputPer1M === 0 ? <span className="text-green-600">Free</span> : formatCost(p.outputPer1M)}</td>
                          <td className="py-2.5 pr-4 text-right">{formatNumber(p.contextWindow)}</td>
                          <td className="py-2.5 pr-4 text-right text-green-600">{costPer1kReq === 0 ? "Free" : formatCost(costPer1kReq)}</td>
                          <td className="py-2.5 text-center">
                            {isConfigured ? <Badge variant="outline" className="text-[8px] text-green-600 border-green-500/30">Configured</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Cost Estimator</h2>
              <p className="text-[11px] text-muted-foreground">Estimate monthly cost based on expected usage per user.</p>
              <div className="grid gap-4 md:grid-cols-4">
                <CostEstimatorCard model="gpt-4o-mini" provider="openai" />
                <CostEstimatorCard model="claude-sonnet-4-6" provider="anthropic" />
                <CostEstimatorCard model="deepseek-chat" provider="deepseek" />
                <CostEstimatorCard model="gemini-2.5-flash" provider="google-gemini" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ───────── React import for Fragment ───────── */
import React from "react"

/* ───────── Cost Estimator Card ───────── */

function CostEstimatorCard({ model, provider }: { model: string; provider: string }) {
  const [reqPerDay, setReqPerDay] = useState(50)
  const [avgInputTokens, setAvgInputTokens] = useState(800)
  const [avgOutputTokens, setAvgOutputTokens] = useState(300)
  const [userCount, setUserCount] = useState(5)

  const pricing = MODEL_PRICING.find((p) => p.model === model && p.provider === provider)
  if (!pricing) return null

  const dailyCost = reqPerDay * userCount * ((avgInputTokens / 1_000_000) * pricing.inputPer1M + (avgOutputTokens / 1_000_000) * pricing.outputPer1M)
  const monthlyCost = dailyCost * 30

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        {PROVIDER_LOGOS[provider] && <img src={PROVIDER_LOGOS[provider]} alt="" className="h-3.5 w-3.5" />}
        <span className="text-xs font-mono font-medium">{model}</span>
      </div>
      <div className="space-y-1.5 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Requests/day/user</span>
          <Input type="number" value={reqPerDay} onChange={(e) => setReqPerDay(parseInt(e.target.value) || 0)} className="h-6 w-16 text-[10px] text-right" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Avg input tokens</span>
          <Input type="number" value={avgInputTokens} onChange={(e) => setAvgInputTokens(parseInt(e.target.value) || 0)} className="h-6 w-16 text-[10px] text-right" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Avg output tokens</span>
          <Input type="number" value={avgOutputTokens} onChange={(e) => setAvgOutputTokens(parseInt(e.target.value) || 0)} className="h-6 w-16 text-[10px] text-right" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Users</span>
          <Input type="number" value={userCount} onChange={(e) => setUserCount(parseInt(e.target.value) || 0)} className="h-6 w-16 text-[10px] text-right" />
        </div>
      </div>
      <div className="border-t border-border pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Monthly est.</span>
          <span className="font-semibold text-green-600">{formatCost(monthlyCost)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Per user/mo</span>
          <span className="text-muted-foreground">{formatCost(monthlyCost / (userCount || 1))}</span>
        </div>
      </div>
    </div>
  )
}
