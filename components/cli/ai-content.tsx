"use client"

import { useEffect, useMemo, useState } from "react"

type SkillDoc = {
  functionKey: string
  name?: string
  description?: string
  operation?: string
  scope?: string
  userId?: string
  updatedAt?: string
}

type AuditItem = {
  audit_id?: string
  action?: string
  provider?: string
  skill_key?: string
  actor?: string
  status?: string
  duration_ms?: number
  created_at?: string
}

export function AiContent({ activeItem }: { activeItem?: string }) {
  const [skills, setSkills] = useState<SkillDoc[]>([])
  const [memory, setMemory] = useState("")
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [skillName, setSkillName] = useState("")
  const [skillDesc, setSkillDesc] = useState("")
  const [memoryDraft, setMemoryDraft] = useState("")
  const [message, setMessage] = useState("")
  const [memoryEntity, setMemoryEntity] = useState("service-item")

  const tab = useMemo(() => {
    if (activeItem === "ai-memory") return "memory"
    if (activeItem === "ai-audit") return "audit"
    return "skills"
  }, [activeItem])

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    if (tab === "memory") void loadMemory()
    if (tab === "audit") void loadAudit()
    if (tab === "skills") void loadSkills()
  }, [tab, memoryEntity])

  async function loadAll(): Promise<void> {
    await Promise.all([loadSkills(), loadMemory(), loadAudit()])
  }

  async function loadSkills(): Promise<void> {
    const [sys, usr] = await Promise.all([
      fetch("/api/proxy/api/v1/skills?scope=system"),
      fetch("/api/proxy/api/v1/skills?scope=user&userId=demo-user"),
    ])
    const sysData = (await sys.json()) as { items?: SkillDoc[] }
    const usrData = (await usr.json()) as { items?: SkillDoc[] }
    setSkills([...(sysData.items ?? []), ...(usrData.items ?? [])])
  }

  async function loadMemory(): Promise<void> {
    const resp = await fetch(`/api/proxy/api/v1/memory/${encodeURIComponent(memoryEntity)}`)
    if (!resp.ok) return setMemory("No system memory yet.")
    const data = (await resp.json()) as { markdown?: string }
    setMemory(String(data.markdown ?? "No system memory yet."))
  }

  async function loadAudit(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/mcp/audit?limit=100")
    const data = (await resp.json()) as { items?: AuditItem[] }
    setAudit(data.items ?? [])
  }

  async function createUserSkill(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/skills/user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "demo-user", name: skillName, description: skillDesc, entity: "general" }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Skill create failed: ${data.detail ?? "unknown"}`)
    setMessage("User skill draft created")
    setSkillName("")
    setSkillDesc("")
    await Promise.all([loadSkills(), loadAudit()])
  }

  async function saveUserMemory(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/memory/user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "demo-user", entity: memoryEntity || "general", markdown: memoryDraft || "# user memory" }),
    })
    const data = (await resp.json()) as { ok?: boolean; detail?: string }
    if (!resp.ok || !data.ok) return setMessage(`Memory save failed: ${data.detail ?? "unknown"}`)
    setMessage("User memory draft saved")
    await Promise.all([loadMemory(), loadAudit()])
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-2xl font-semibold">AI Workspace</h1>
      <p className="mb-4 text-sm text-muted-foreground">Skills, memory, and MCP execution audit are managed here.</p>
      {message && <div className="mb-3 text-xs text-primary">{message}</div>}

      {tab === "skills" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Skills Registry</h3>
          <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
            <input value={skillName} onChange={(e) => setSkillName(e.target.value)} placeholder="Skill name" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
            <input value={skillDesc} onChange={(e) => setSkillDesc(e.target.value)} placeholder="Skill description" className="rounded border border-border bg-background px-2 py-1.5 text-xs xl:col-span-2" />
          </div>
          <button onClick={() => void createUserSkill()} className="mb-3 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">Create User Skill (Draft)</button>
          <div className="overflow-auto rounded border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Function Key</th>
                  <th className="px-2 py-2 text-left">Scope</th>
                  <th className="px-2 py-2 text-left">Operation</th>
                  <th className="px-2 py-2 text-left">Updated At</th>
                </tr>
              </thead>
              <tbody>
                {skills.slice(0, 300).map((s) => (
                  <tr key={s.functionKey} className="border-t border-border/60">
                    <td className="px-2 py-2 font-mono">{s.functionKey}</td>
                    <td className="px-2 py-2">{s.scope ?? (s.functionKey?.startsWith("user.") ? "user" : "system")}</td>
                    <td className="px-2 py-2">{s.operation ?? "-"}</td>
                    <td className="px-2 py-2">{s.updatedAt ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "memory" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Memory Management</h3>
          <div className="mb-3 flex items-center gap-2">
            <input value={memoryEntity} onChange={(e) => setMemoryEntity(e.target.value)} placeholder="Entity key (e.g. service-item)" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
            <button onClick={() => void loadMemory()} className="rounded border border-border px-2 py-1 text-xs">Load</button>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium">System Memory</div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded border border-border p-2 text-xs text-muted-foreground">{memory}</pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium">User Draft Memory (Non-functional)</div>
              <textarea value={memoryDraft} onChange={(e) => setMemoryDraft(e.target.value)} placeholder="User memory markdown" className="mb-2 h-80 w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <button onClick={() => void saveUserMemory()} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">Save User Memory Draft</button>
            </div>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">MCP Execution Audit Trail</h3>
            <button onClick={() => void loadAudit()} className="rounded border border-border px-2 py-1 text-xs">Refresh</button>
          </div>
          <div className="overflow-auto rounded border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Action</th>
                  <th className="px-2 py-2 text-left">Provider</th>
                  <th className="px-2 py-2 text-left">Actor</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Duration</th>
                  <th className="px-2 py-2 text-left">Created At</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a, i) => (
                  <tr key={`${a.audit_id ?? i}`} className="border-t border-border/60">
                    <td className="px-2 py-2 font-mono">{a.action ?? "-"}</td>
                    <td className="px-2 py-2">{a.provider ?? "-"}</td>
                    <td className="px-2 py-2">{a.actor ?? "-"}</td>
                    <td className="px-2 py-2">{a.status ?? "-"}</td>
                    <td className="px-2 py-2">{a.duration_ms ? `${a.duration_ms} ms` : "-"}</td>
                    <td className="px-2 py-2">{a.created_at ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
