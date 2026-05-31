"use client"

import { useEffect, useMemo, useState } from "react"

type AuthMe = { user_id: string; roles: string[]; permissions: string[] }
type IamRole = { role_key: string; role_name: string; description?: string; system_role?: boolean; permissions: string[] }
type IamUser = { user_id: string; display_name: string; email?: string; enabled: boolean; roles: string[] }
type IamAudit = { event_id: string; action: string; target_type: string; target_key: string; actor: string; created_at: string }

export function IamContent({ activeItem }: { activeItem: string }) {
  const [me, setMe] = useState<AuthMe | null>(null)
  const [roles, setRoles] = useState<IamRole[]>([])
  const [users, setUsers] = useState<IamUser[]>([])
  const [permissions, setPermissions] = useState<Array<{ permission_key: string; description?: string }>>([])
  const [audit, setAudit] = useState<IamAudit[]>([])
  const [message, setMessage] = useState("")
  const [newUser, setNewUser] = useState({ user_id: "", display_name: "", email: "", role: "viewer" })
  const [newRole, setNewRole] = useState({ role_key: "", role_name: "", description: "" })

  const tab = useMemo(() => {
    if (activeItem === "iam-users") return "users"
    if (activeItem === "iam-roles") return "roles"
    if (activeItem === "iam-permissions") return "permissions"
    if (activeItem === "iam-audit") return "audit"
    return "users"
  }, [activeItem])

  const canManageIam = useMemo(() => (me?.permissions ?? []).includes("iam.manage") || (me?.roles ?? []).includes("admin"), [me])

  useEffect(() => {
    void loadMe()
  }, [])

  useEffect(() => {
    if (!canManageIam) return
    if (tab === "users") void loadUsers()
    if (tab === "roles") void loadRoles()
    if (tab === "permissions") void loadPermissions()
    if (tab === "audit") void loadAudit()
  }, [tab, canManageIam])

  async function loadMe(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/auth/me")
    const data = await resp.json()
    if (data?.ok) setMe(data as AuthMe)
  }

  async function loadUsers(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/iam/users")
    const data = await resp.json()
    setUsers(data?.items ?? [])
  }

  async function loadRoles(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/iam/roles")
    const data = await resp.json()
    setRoles(data?.items ?? [])
  }

  async function loadPermissions(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/iam/permissions")
    const data = await resp.json()
    setPermissions(data?.items ?? [])
  }

  async function loadAudit(): Promise<void> {
    const resp = await fetch("/api/proxy/api/v1/iam/audit?limit=100")
    const data = await resp.json()
    setAudit(data?.items ?? [])
  }

  async function createUser(): Promise<void> {
    setMessage("")
    const createResp = await fetch("/api/proxy/api/v1/iam/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newUser),
    })
    const createData = await createResp.json()
    if (!createResp.ok || !createData?.ok) return setMessage(createData?.detail ?? "create user failed")

    await fetch(`/api/proxy/api/v1/iam/users/${encodeURIComponent(newUser.user_id)}/roles`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roles: [newUser.role] }),
    })
    setMessage("User created.")
    setNewUser({ user_id: "", display_name: "", email: "", role: "viewer" })
    await Promise.all([loadUsers(), loadAudit()])
  }

  async function createRole(): Promise<void> {
    setMessage("")
    const resp = await fetch("/api/proxy/api/v1/iam/roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...newRole, permissions: ["mdm.read"] }),
    })
    const data = await resp.json()
    if (!resp.ok || !data?.ok) return setMessage(data?.detail ?? "create role failed")
    setMessage("Role created.")
    setNewRole({ role_key: "", role_name: "", description: "" })
    await Promise.all([loadRoles(), loadAudit()])
  }

  if (!me) {
    return <div className="flex-1 p-6 text-sm text-muted-foreground">Loading IAM...</div>
  }

  if (!canManageIam) {
    return (
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold">Identity & Access Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">You do not have `iam.manage` permission.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-2xl font-semibold">Identity & Access Management</h1>
      <p className="mb-4 text-sm text-muted-foreground">Manage users, roles, permissions and authorization audits.</p>
      {message && <div className="mb-3 rounded border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{message}</div>}

      {tab === "users" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 text-sm font-semibold">Create User</div>
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-5">
              <input value={newUser.user_id} onChange={(e) => setNewUser((p) => ({ ...p, user_id: e.target.value }))} placeholder="user_id" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <input value={newUser.display_name} onChange={(e) => setNewUser((p) => ({ ...p, display_name: e.target.value }))} placeholder="display_name" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <input value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} placeholder="email" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))} className="rounded border border-border bg-background px-2 py-1.5 text-xs">
                <option value="viewer">viewer</option><option value="editor">editor</option><option value="approver">approver</option><option value="ops_admin">ops_admin</option><option value="admin">admin</option>
              </select>
              <button onClick={() => void createUser()} className="rounded bg-primary px-2 py-1.5 text-xs text-primary-foreground">Create</button>
            </div>
          </div>
          <Table cols={["User ID", "Name", "Email", "Enabled", "Roles"]} rows={users.map((u) => [u.user_id, u.display_name, u.email ?? "-", u.enabled ? "yes" : "no", (u.roles ?? []).join(", ")])} />
        </div>
      )}

      {tab === "roles" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 text-sm font-semibold">Create Role</div>
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-4">
              <input value={newRole.role_key} onChange={(e) => setNewRole((p) => ({ ...p, role_key: e.target.value }))} placeholder="role_key" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <input value={newRole.role_name} onChange={(e) => setNewRole((p) => ({ ...p, role_name: e.target.value }))} placeholder="role_name" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <input value={newRole.description} onChange={(e) => setNewRole((p) => ({ ...p, description: e.target.value }))} placeholder="description" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <button onClick={() => void createRole()} className="rounded bg-primary px-2 py-1.5 text-xs text-primary-foreground">Create</button>
            </div>
          </div>
          <Table cols={["Role", "Name", "System", "Permissions"]} rows={roles.map((r) => [r.role_key, r.role_name, r.system_role ? "yes" : "no", (r.permissions ?? []).join(", ")])} />
        </div>
      )}

      {tab === "permissions" && <Table cols={["Permission", "Description"]} rows={permissions.map((p) => [p.permission_key, p.description ?? "-"])} />}

      {tab === "audit" && <Table cols={["When", "Action", "Target", "Actor"]} rows={audit.map((a) => [String(a.created_at ?? "-"), String(a.action ?? "-"), `${a.target_type}:${a.target_key}`, String(a.actor ?? "-")])} />}
    </div>
  )
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <div className="overflow-auto rounded border border-border">
      <table className="min-w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>{cols.map((c) => <th key={c} className="px-2 py-2 text-left">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">{r.map((v, j) => <td key={j} className="px-2 py-2">{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

