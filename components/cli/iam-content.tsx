"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Filter, KeyRound, ListChecks, MoreVertical, Save, Search, ShieldCheck, SlidersHorizontal, UserCog, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkbenchCard } from "@/components/ui/workbench-card"
import { SelectShell } from "@/components/ui/select-shell"
import { QueryBuilder, QBField, QBGroup, createDefaultQuery } from "@/components/ui/query-builder"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"
import { cn } from "@/lib/utils"

type IamFunctionGrant = { function_key: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean; can_assign: boolean }
type IamDataScope = { entity_key: string; field_key: string; allowed_values: string[] }
type AuthMe = { user_id: string; roles: string[]; permissions: string[]; menus?: string[]; capabilities?: string[]; functions?: IamFunctionGrant[]; data_scopes?: IamDataScope[]; organizations?: string[]; user_data_scopes?: IamDataScope[] }
type IamPermission = { permission_key: string; description?: string }
type IamRole = { role_key: string; role_name: string; description?: string; system_role?: boolean; permissions: string[]; menus?: string[]; capabilities?: string[]; functions?: IamFunctionGrant[]; data_scopes?: IamDataScope[] }
type IamRoleFunction = IamFunctionGrant & { role_key: string; role_name?: string; granted_at?: string; granted_by?: string }
type IamUser = { user_id: string; display_name: string; email?: string; enabled: boolean; roles: string[]; organizations?: string[]; data_scopes?: IamDataScope[]; created_at?: string; updated_at?: string }
type IamAudit = { event_id: string; action: string; target_type: string; target_key: string; actor: string; created_at: string }
type IamTab = "users" | "roles" | "role-functions" | "permissions" | "audit"
type UserForm = { user_id: string; display_name: string; email: string; enabled: boolean; roles: string[]; organizations: string[]; cost_centers: string[]; data_scopes: IamDataScope[] }
type RoleForm = { role_key: string; role_name: string; description: string; permissions: string[]; menus: string[]; capabilities: string[]; functions: IamFunctionGrant[]; data_scopes: IamDataScope[] }
type EffectiveAccess = { menus: string[]; capabilities: string[]; functions: IamFunctionGrant[]; data_scopes: IamDataScope[] }
type PermissionForm = { permission_key: string; description: string }
type RoleFunctionForm = { role_key: string; function_key: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean; can_assign: boolean }

const emptyUser: UserForm = { user_id: "", display_name: "", email: "", enabled: true, roles: ["viewer"], organizations: [], cost_centers: [], data_scopes: [] }
const emptyRole: RoleForm = { role_key: "", role_name: "", description: "", permissions: ["mdm.read"], menus: ["home", "mdm"], capabilities: [], functions: [], data_scopes: [] }
const emptyPermission: PermissionForm = { permission_key: "", description: "" }
const emptyRoleFunction: RoleFunctionForm = { role_key: "", function_key: "", can_create: false, can_read: true, can_update: false, can_delete: false, can_assign: false }
const menuOptions = ["home", "lims", "orders", "projects", "tickets", "mdm", "ai", "iam", "gma", "connectors"]
const capabilityOptions = ["settings.edit", "record.assign", "workflow.approve", "workflow.execute", "bulk.import", "bulk.export", "ai.use", "audit.view"]
const functionOptions = ["mdm.legal-entity", "mdm.cost-center", "mdm.sales-org", "mdm.sales-office", "mdm.sales-team", "mdm.sales-channel", "mdm.delivery-org", "mdm.delivery-office", "mdm.delivery-team", "mdm.delivery-channel", "mdm.purchase-org", "mdm.purchase-office", "mdm.purchase-team", "mdm.purchase-channel", "mdm.service-item", "mdm.requirement", "mdm.regulation", "mdm.standard"]
const dataScopeFields = ["legal_entity_id", "cost_center_id", "country_code", "currency_code", "sales_org_id", "sales_office_id", "delivery_org_id", "delivery_office_id", "purchase_org_id", "purchase_office_id", "owner_user_id", "created_by", "updated_by", "status"]
const COST_CENTER_SCOPE_ENTITY = "cost-center"
const COST_CENTER_SCOPE_FIELD = "cost_center_id"

export function IamContent({ activeItem }: { activeItem: string }) {
  const [me, setMe] = useState<AuthMe | null>(null)
  const [roles, setRoles] = useState<IamRole[]>([])
  const [roleFunctions, setRoleFunctions] = useState<IamRoleFunction[]>([])
  const [users, setUsers] = useState<IamUser[]>([])
  const [permissions, setPermissions] = useState<IamPermission[]>([])
  const [audit, setAudit] = useState<IamAudit[]>([])
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [userForm, setUserForm] = useState(emptyUser)
  const [roleForm, setRoleForm] = useState(emptyRole)
  const [permissionForm, setPermissionForm] = useState(emptyPermission)
  const [roleFunctionForm, setRoleFunctionForm] = useState(emptyRoleFunction)
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [queryGroup, setQueryGroup] = useState<QBGroup>(() => createDefaultQuery([]))
  const [showRightPanel, setShowRightPanel] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null)
  const [editingRoleFunctionKey, setEditingRoleFunctionKey] = useState<string | null>(null)
  const [editingPermissionKey, setEditingPermissionKey] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: "user" | "role" | "role-function" | "permission"; key: string; label: string } | null>(null)

  const tab = useMemo<IamTab>(() => {
    if (activeItem === "iam-roles") return "roles"
    if (activeItem === "iam-role-functions") return "role-functions"
    if (activeItem === "iam-permissions") return "permissions"
    if (activeItem === "iam-audit") return "audit"
    return "users"
  }, [activeItem])
  const pageTitle = useMemo(() => {
    if (tab === "users") return "Users"
    if (tab === "roles") return "Roles"
    if (tab === "role-functions") return "Role Functions"
    if (tab === "permissions") return "Permissions"
    return "Audit"
  }, [tab])

  const canManageIam = useMemo(() => (me?.permissions ?? []).includes("iam.manage") || (me?.roles ?? []).includes("admin"), [me])
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => [u.user_id, u.display_name, u.email, ...(u.roles ?? []), ...(u.organizations ?? []), ...costCentersFromScopes(u.data_scopes ?? [])].some((v) => String(v ?? "").toLowerCase().includes(q)))
  }, [search, users])
  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roles
    return roles.filter((r) => [
      r.role_key,
      r.role_name,
      r.description,
      ...(r.permissions ?? []),
      ...(r.menus ?? []),
      ...(r.capabilities ?? []),
      ...(r.functions ?? []).map((item) => item.function_key),
      ...(r.data_scopes ?? []).map((item) => `${item.entity_key}.${item.field_key}`),
    ].some((v) => String(v ?? "").toLowerCase().includes(q)))
  }, [roles, search])
  const filteredPermissions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return permissions
    return permissions.filter((permission) => [permission.permission_key, permission.description].some((v) => String(v ?? "").toLowerCase().includes(q)))
  }, [permissions, search])
  const filteredRoleFunctions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roleFunctions
    return roleFunctions.filter((grant) => [
      grant.role_key,
      grant.role_name,
      grant.function_key,
      grant.granted_by,
      grant.can_create ? "create" : "",
      grant.can_read ? "read" : "",
      grant.can_update ? "update" : "",
      grant.can_delete ? "delete" : "",
      grant.can_assign ? "assign" : "",
    ].some((v) => String(v ?? "").toLowerCase().includes(q)))
  }, [roleFunctions, search])
  const effectiveUserAccess = useMemo(() => {
    const roleAccess = mergeRoleAccess(roles.filter((role) => userForm.roles.includes(role.role_key)))
    return {
      ...roleAccess,
      data_scopes: mergeDataScopes([...roleAccess.data_scopes, ...userForm.data_scopes]),
    }
  }, [roles, userForm.roles, userForm.data_scopes])
  const selectedUserForAction = useMemo(() => {
    if (editingUserId) return editingUserId
    return selectedUserIds.length === 1 ? selectedUserIds[0] : null
  }, [editingUserId, selectedUserIds])
  const userTableStats = useMemo(() => {
    const enabled = users.filter((user) => user.enabled).length
    const disabled = users.length - enabled
    const roleCount = new Set(users.flatMap((user) => user.roles ?? [])).size
    const scoped = users.filter((user) => (user.organizations?.length ?? 0) > 0 || (user.data_scopes?.length ?? 0) > 0).length
    return { enabled, disabled, roleCount, scoped }
  }, [users])
  const roleFunctionStats = useMemo(() => {
    const roleCount = new Set(roleFunctions.map((grant) => grant.role_key)).size
    const writable = roleFunctions.filter((grant) => grant.can_create || grant.can_update || grant.can_delete).length
    const assignable = roleFunctions.filter((grant) => grant.can_assign).length
    return { total: roleFunctions.length, roleCount, writable, assignable }
  }, [roleFunctions])

  useEffect(() => {
    setShowLeftPanel(false)
    setShowRightPanel(false)
    setShowRoleDialog(false)
    setSelectedUserIds([])
    setEditingUserId(null)
    setEditingRoleFunctionKey(null)
  }, [tab])

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    setSelectedUserIds((current) => current.filter((userId) => users.some((user) => user.user_id === userId)))
  }, [users])

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok === false) throw new Error(String(data?.detail ?? `Request failed with status ${response.status}`))
    return data as T
  }

  async function loadAll(): Promise<void> {
    setLoading(true)
    setMessage("")
    try {
      const meResp = await fetchJson<AuthMe & { ok: boolean }>("/api/proxy/api/v1/auth/me")
      setMe(meResp)
      const hasIam = (meResp.permissions ?? []).includes("iam.manage") || (meResp.roles ?? []).includes("admin")
      if (!hasIam) return
      const [userResp, roleResp, roleFunctionResp, permissionResp, auditResp] = await Promise.all([
        fetchJson<{ ok: boolean; items: IamUser[] }>("/api/proxy/api/v1/iam/users"),
        fetchJson<{ ok: boolean; items: IamRole[] }>("/api/proxy/api/v1/iam/roles"),
        fetchJson<{ ok: boolean; items: IamRoleFunction[] }>("/api/proxy/api/v1/iam/role-functions"),
        fetchJson<{ ok: boolean; items: IamPermission[] }>("/api/proxy/api/v1/iam/permissions"),
        fetchJson<{ ok: boolean; items: IamAudit[] }>("/api/proxy/api/v1/iam/audit?limit=100"),
      ])
      setUsers(userResp.items ?? [])
      setRoles(roleResp.items ?? [])
      setRoleFunctions(roleFunctionResp.items ?? [])
      setPermissions(permissionResp.items ?? [])
      setAudit(auditResp.items ?? [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load IAM data")
    } finally {
      setLoading(false)
    }
  }

  function editUser(user: IamUser): void {
    setUserForm({
      user_id: user.user_id,
      display_name: user.display_name,
      email: user.email ?? "",
      enabled: user.enabled,
      roles: user.roles?.length ? user.roles : ["viewer"],
      organizations: user.organizations ?? [],
      cost_centers: costCentersFromScopes(user.data_scopes ?? []),
      data_scopes: userDataScopesWithoutCostCenters(user.data_scopes ?? []),
    })
    setEditingUserId(user.user_id)
    setSelectedUserIds([user.user_id])
    setShowUserDialog(true)
  }

  function editRole(role: IamRole): void {
    setRoleForm({
      role_key: role.role_key,
      role_name: role.role_name,
      description: role.description ?? "",
      permissions: role.permissions?.length ? role.permissions : ["mdm.read"],
      menus: role.menus ?? [],
      capabilities: role.capabilities ?? [],
      functions: role.functions ?? [],
      data_scopes: role.data_scopes ?? [],
    })
    setEditingRoleKey(role.role_key)
    setShowRoleDialog(true)
  }

  function editRoleFunction(grant: IamRoleFunction): void {
    setRoleFunctionForm({
      role_key: grant.role_key,
      function_key: grant.function_key,
      can_create: grant.can_create,
      can_read: grant.can_read,
      can_update: grant.can_update,
      can_delete: grant.can_delete,
      can_assign: grant.can_assign,
    })
    setEditingRoleFunctionKey(roleFunctionRowKey(grant))
    setShowLeftPanel(true)
  }

  function editPermission(permission: IamPermission): void {
    setPermissionForm({
      permission_key: permission.permission_key,
      description: permission.description ?? "",
    })
    setEditingPermissionKey(permission.permission_key)
    setShowLeftPanel(true)
  }

  function startNewUser(): void {
    setUserForm(emptyUser)
    setEditingUserId(null)
    setSelectedUserIds([])
    setShowUserDialog(true)
  }

  function startNewRole(): void {
    setRoleForm(emptyRole)
    setEditingRoleKey(null)
    setShowRoleDialog(true)
  }

  function startNewRoleFunction(): void {
    setRoleFunctionForm({ ...emptyRoleFunction, role_key: roles[0]?.role_key ?? "", function_key: functionOptions[0] ?? "" })
    setEditingRoleFunctionKey(null)
    setShowLeftPanel(true)
  }

  function startNewPermission(): void {
    setPermissionForm(emptyPermission)
    setEditingPermissionKey(null)
    setShowLeftPanel(true)
  }

  function cancelUserEdit(): void {
    setUserForm(emptyUser)
    setEditingUserId(null)
    setSelectedUserIds([])
    setShowUserDialog(false)
  }

  function cancelRoleEdit(): void {
    setRoleForm(emptyRole)
    setEditingRoleKey(null)
    setShowRoleDialog(false)
  }

  function cancelRoleFunctionEdit(): void {
    setRoleFunctionForm(emptyRoleFunction)
    setEditingRoleFunctionKey(null)
  }

  function cancelPermissionEdit(): void {
    setPermissionForm(emptyPermission)
    setEditingPermissionKey(null)
  }

  async function deleteUser(userId: string): Promise<void> {
    setSaving(true)
    setMessage("")
    try {
      await fetchJson<{ ok: boolean }>("/api/proxy/api/v1/iam/users/" + encodeURIComponent(userId), { method: "DELETE" })
      setMessage(`User ${userId} deleted.`)
      setConfirmDelete(null)
      if (editingUserId === userId) cancelUserEdit()
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete user")
    } finally {
      setSaving(false)
    }
  }

  async function deleteRole(roleKey: string): Promise<void> {
    setSaving(true)
    setMessage("")
    try {
      await fetchJson<{ ok: boolean }>("/api/proxy/api/v1/iam/roles/" + encodeURIComponent(roleKey), { method: "DELETE" })
      setMessage(`Role ${roleKey} deleted.`)
      setConfirmDelete(null)
      if (editingRoleKey === roleKey) cancelRoleEdit()
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete role")
    } finally {
      setSaving(false)
    }
  }

  async function deleteRoleFunction(key: string): Promise<void> {
    const parsed = parseRoleFunctionRowKey(key)
    if (!parsed) {
      setMessage("Invalid role function selection.")
      return
    }
    setSaving(true)
    setMessage("")
    try {
      await fetchJson<{ ok: boolean }>("/api/proxy/api/v1/iam/roles/" + encodeURIComponent(parsed.role_key) + "/functions/" + encodeURIComponent(parsed.function_key), { method: "DELETE" })
      setMessage(`Role function ${parsed.role_key}:${parsed.function_key} deleted.`)
      setConfirmDelete(null)
      if (editingRoleFunctionKey === key) cancelRoleFunctionEdit()
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete role function")
    } finally {
      setSaving(false)
    }
  }

  async function deletePermission(permissionKey: string): Promise<void> {
    setSaving(true)
    setMessage("")
    try {
      await fetchJson<{ ok: boolean }>("/api/proxy/api/v1/iam/permissions/" + encodeURIComponent(permissionKey), { method: "DELETE" })
      setMessage(`Permission ${permissionKey} deleted.`)
      setConfirmDelete(null)
      if (editingPermissionKey === permissionKey) cancelPermissionEdit()
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete permission")
    } finally {
      setSaving(false)
    }
  }

  async function setSelectedUserEnabled(enabled: boolean): Promise<void> {
    const userIds = selectedUserIds.length ? selectedUserIds : editingUserId ? [editingUserId] : []
    if (!userIds.length) {
      setMessage(`Select a user row to ${enabled ? "enable" : "disable"}.`)
      return
    }
    setSaving(true)
    setMessage("")
    try {
      await Promise.all(userIds.map((userId) => fetchJson<{ ok: boolean }>("/api/proxy/api/v1/iam/users/" + encodeURIComponent(userId), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled }),
        })))
      setMessage(`${userIds.length} user${userIds.length === 1 ? "" : "s"} ${enabled ? "enabled" : "disabled"}.`)
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${enabled ? "enable" : "disable"} user`)
    } finally {
      setSaving(false)
    }
  }

  function setSelectedUserDraft(): void {
    if (!selectedUserIds.length && !editingUserId) {
      setMessage("Select a user row to set draft.")
      return
    }
    setMessage("Draft status is not available for IAM users.")
  }

  function handleUserSelection(userIds: string[]): void {
    setSelectedUserIds(userIds)
    if (userIds.length === 1) {
      setEditingUserId(userIds[0])
      return
    }
    setEditingUserId(null)
  }

  function setSelectedIamStatus(entityLabel: "role" | "permission", selectedKey: string | null, statusLabel: "draft" | "active" | "inactive"): void {
    if (!selectedKey) {
      setMessage(`Select a ${entityLabel} row to set ${statusLabel}.`)
      return
    }
    setMessage(`Status changes are not available for IAM ${entityLabel}s.`)
  }

  function exportIamCsv(): void {
    const csv =
      tab === "users"
        ? toCsv(["user_id", "display_name", "email", "enabled", "roles", "legal_entities", "cost_centers", "scope_count", "updated_at"], filteredUsers.map((user) => [
            user.user_id,
            user.display_name,
            user.email ?? "",
            String(user.enabled),
            (user.roles ?? []).join("|"),
            (user.organizations ?? []).join("|"),
            costCentersFromScopes(user.data_scopes ?? []).join("|"),
            String(user.data_scopes?.length ?? 0),
            user.updated_at ?? "",
          ]))
        : tab === "roles"
          ? toCsv(["role_key", "role_name", "description", "system_role", "permissions", "menus", "function_count", "scope_count"], filteredRoles.map((role) => [
              role.role_key,
              role.role_name,
              role.description ?? "",
              String(Boolean(role.system_role)),
              (role.permissions ?? []).join("|"),
              (role.menus ?? []).join("|"),
              String(role.functions?.length ?? 0),
              String(role.data_scopes?.length ?? 0),
            ]))
          : tab === "role-functions"
            ? toCsv(["role_key", "role_name", "function_key", "can_create", "can_read", "can_update", "can_delete", "can_assign", "granted_by", "granted_at"], filteredRoleFunctions.map((grant) => [
                grant.role_key,
                grant.role_name ?? "",
                grant.function_key,
                String(grant.can_create),
                String(grant.can_read),
                String(grant.can_update),
                String(grant.can_delete),
                String(grant.can_assign),
                grant.granted_by ?? "",
                grant.granted_at ?? "",
              ]))
          : tab === "permissions"
            ? toCsv(["permission_key", "description"], filteredPermissions.map((permission) => [permission.permission_key, permission.description ?? ""]))
            : toCsv(["created_at", "action", "target_type", "target_key", "actor"], audit.map((item) => [item.created_at, item.action, item.target_type, item.target_key, item.actor]))
    downloadText(`${tab}.csv`, csv, "text/csv;charset=utf-8;")
  }

  function toggleUserRole(roleKey: string): void {
    setUserForm((prev) => {
      const rolesNext = prev.roles.includes(roleKey) ? prev.roles.filter((role) => role !== roleKey) : [...prev.roles, roleKey]
      return { ...prev, roles: rolesNext.length ? rolesNext : ["viewer"] }
    })
  }

  function toggleRolePermission(permissionKey: string): void {
    setRoleForm((prev) => {
      const permissionsNext = prev.permissions.includes(permissionKey)
        ? prev.permissions.filter((permission) => permission !== permissionKey)
        : [...prev.permissions, permissionKey]
      return { ...prev, permissions: permissionsNext }
    })
  }

  function toggleRoleMenu(menuKey: string): void {
    setRoleForm((prev) => ({ ...prev, menus: toggleList(prev.menus, menuKey) }))
  }

  function toggleRoleCapability(capabilityKey: string): void {
    setRoleForm((prev) => ({ ...prev, capabilities: toggleList(prev.capabilities, capabilityKey) }))
  }

  function toggleFunctionGrant(functionKey: string, field: keyof Omit<IamFunctionGrant, "function_key">): void {
    setRoleForm((prev) => {
      const current = prev.functions.find((item) => item.function_key === functionKey) ?? emptyFunctionGrant(functionKey)
      const next = { ...current, [field]: !current[field] }
      const functions = prev.functions.filter((item) => item.function_key !== functionKey)
      const hasAny = next.can_create || next.can_read || next.can_update || next.can_delete || next.can_assign
      return { ...prev, functions: hasAny ? [...functions, next].sort((a, b) => a.function_key.localeCompare(b.function_key)) : functions }
    })
  }

  function addDataScope(): void {
    setRoleForm((prev) => ({ ...prev, data_scopes: [...prev.data_scopes, { entity_key: "legal-entity", field_key: "country_code", allowed_values: [] }] }))
  }

  function updateDataScope(index: number, patch: Partial<IamDataScope>): void {
    setRoleForm((prev) => ({
      ...prev,
      data_scopes: prev.data_scopes.map((scope, idx) => idx === index ? { ...scope, ...patch } : scope),
    }))
  }

  function removeDataScope(index: number): void {
    setRoleForm((prev) => ({ ...prev, data_scopes: prev.data_scopes.filter((_scope, idx) => idx !== index) }))
  }

  function updateUserOrganizations(value: string): void {
    setUserForm((prev) => ({ ...prev, organizations: splitComma(value) }))
  }

  function updateUserCostCenters(value: string): void {
    setUserForm((prev) => ({ ...prev, cost_centers: splitComma(value) }))
  }

  function addUserDataScope(): void {
    setUserForm((prev) => ({ ...prev, data_scopes: [...prev.data_scopes, { entity_key: "legal-entity", field_key: "legal_entity_id", allowed_values: [] }] }))
  }

  function updateUserDataScope(index: number, patch: Partial<IamDataScope>): void {
    setUserForm((prev) => ({
      ...prev,
      data_scopes: prev.data_scopes.map((scope, idx) => idx === index ? { ...scope, ...patch } : scope),
    }))
  }

  function removeUserDataScope(index: number): void {
    setUserForm((prev) => ({ ...prev, data_scopes: prev.data_scopes.filter((_scope, idx) => idx !== index) }))
  }

  async function saveUser(): Promise<void> {
    setSaving(true)
    setMessage("")
    try {
      const userId = userForm.user_id.trim()
      if (!userId || !userForm.display_name.trim()) throw new Error("User ID and display name are required")
      const dataScopes = materializeUserDataScopes(userForm)
      await fetchJson<{ ok: boolean; user_id: string }>("/api/proxy/api/v1/iam/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          display_name: userForm.display_name.trim(),
          email: userForm.email.trim() || null,
          enabled: userForm.enabled,
          organizations: userForm.organizations,
          data_scopes: dataScopes,
        }),
      })
      await fetchJson<{ ok: boolean }>("/api/proxy/api/v1/iam/users/" + encodeURIComponent(userId) + "/roles", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roles: userForm.roles }),
      })
      setMessage(`User ${userId} saved.`)
      setUserForm(emptyUser)
      setEditingUserId(null)
      setShowUserDialog(false)
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save user")
    } finally {
      setSaving(false)
    }
  }

  async function saveRole(): Promise<void> {
    setSaving(true)
    setMessage("")
    try {
      const roleKey = roleForm.role_key.trim().toLowerCase()
      if (!roleKey || !roleForm.role_name.trim()) throw new Error("Role key and role name are required")
      await fetchJson<{ ok: boolean; role_key: string }>("/api/proxy/api/v1/iam/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role_key: roleKey,
          role_name: roleForm.role_name.trim(),
          description: roleForm.description.trim() || null,
          permissions: roleForm.permissions,
          menus: roleForm.menus,
          capabilities: roleForm.capabilities,
          functions: roleForm.functions,
          data_scopes: roleForm.data_scopes,
        }),
      })
      setMessage(`Role ${roleKey} saved.`)
      setRoleForm(emptyRole)
      setEditingRoleKey(null)
      setShowRoleDialog(false)
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save role")
    } finally {
      setSaving(false)
    }
  }

  async function saveRoleFunction(): Promise<void> {
    setSaving(true)
    setMessage("")
    try {
      const roleKey = roleFunctionForm.role_key.trim().toLowerCase()
      const functionKey = roleFunctionForm.function_key.trim()
      if (!roleKey || !functionKey) throw new Error("Role and function are required")
      const payload = {
        can_create: roleFunctionForm.can_create,
        can_read: roleFunctionForm.can_read,
        can_update: roleFunctionForm.can_update,
        can_delete: roleFunctionForm.can_delete,
        can_assign: roleFunctionForm.can_assign,
      }
      await fetchJson<{ ok: boolean; item: IamRoleFunction }>("/api/proxy/api/v1/iam/roles/" + encodeURIComponent(roleKey) + "/functions/" + encodeURIComponent(functionKey), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      setMessage(`Role function ${roleKey}:${functionKey} saved.`)
      setRoleFunctionForm(emptyRoleFunction)
      setEditingRoleFunctionKey(null)
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save role function")
    } finally {
      setSaving(false)
    }
  }

  async function savePermission(): Promise<void> {
    setSaving(true)
    setMessage("")
    try {
      const permissionKey = permissionForm.permission_key.trim().toLowerCase()
      if (!permissionKey) throw new Error("Permission key is required")
      await fetchJson<{ ok: boolean; permission_key: string }>("/api/proxy/api/v1/iam/permissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          permission_key: permissionKey,
          description: permissionForm.description.trim() || permissionKey,
        }),
      })
      setMessage(`Permission ${permissionKey} saved.`)
      setPermissionForm(emptyPermission)
      setEditingPermissionKey(null)
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save permission")
    } finally {
      setSaving(false)
    }
  }

  const queryFields = useMemo<QBField[]>(() => {
    switch (tab) {
      case "users": return [
        { field: "user_id", label: "User", type: "string" },
        { field: "email", label: "Email", type: "string" },
        { field: "enabled", label: "Status", type: "boolean" },
        { field: "roles", label: "Roles", type: "string" },
        { field: "organizations", label: "Legal Entity", type: "string" },
        { field: "cost_centers", label: "Cost Center", type: "string" },
        { field: "updated_at", label: "Updated", type: "date" },
      ]
      case "roles": return [
        { field: "role_key", label: "Role", type: "string" },
        { field: "description", label: "Description", type: "string" },
        { field: "system_role", label: "Type", type: "boolean" },
        { field: "permissions", label: "Permissions", type: "string" },
      ]
      case "role-functions": return [
        { field: "role_key", label: "Role", type: "string" },
        { field: "function_key", label: "Function", type: "string" },
        { field: "can_create", label: "Create", type: "boolean" },
        { field: "can_read", label: "Read", type: "boolean" },
        { field: "can_update", label: "Update", type: "boolean" },
        { field: "can_delete", label: "Delete", type: "boolean" },
        { field: "can_assign", label: "Assign", type: "boolean" },
      ]
      case "permissions": return [
        { field: "permission_key", label: "Permission", type: "string" },
        { field: "description", label: "Description", type: "string" },
      ]
      case "audit": return [
        { field: "created_at", label: "When", type: "date" },
        { field: "action", label: "Action", type: "string" },
        { field: "target_key", label: "Target", type: "string" },
        { field: "actor", label: "Actor", type: "string" },
      ]
    }
  }, [tab])

  if (!me && loading) return <div className="flex-1 p-6 text-sm text-muted-foreground">Loading IAM...</div>

  if (!canManageIam) {
    return (
      <div className="flex-1 p-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">User & Access Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">You do not have `iam.manage` permission.</p>
        </div>
      </div>
    )
  }

  const selectedUser = selectedUserForAction ? users.find((user) => user.user_id === selectedUserForAction) : undefined
  const selectedRoleFunction = editingRoleFunctionKey ? roleFunctions.find((grant) => roleFunctionRowKey(grant) === editingRoleFunctionKey) : undefined
  const userToolbar = (
    <>
      <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users, email, roles..."
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none transition focus:border-primary"
        />
      </div>
      <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
        {selectedUserIds.length ? `${selectedUserIds.length} selected` : `${filteredUsers.length} shown`}
      </span>
      <Button variant="outline" size="sm" onClick={startNewUser} className="h-8 px-3 text-xs">Add</Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { if (selectedUser) editUser(selectedUser); else setMessage("Select one user row to edit.") }}
        disabled={!selectedUser || selectedUserIds.length > 1}
        className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { if (selectedUser) setConfirmDelete({ type: "user", key: selectedUser.user_id, label: selectedUser.display_name || selectedUser.user_id }); else setMessage("Select one user row to delete.") }}
        disabled={!selectedUser || selectedUserIds.length > 1}
        className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        Delete
      </Button>
      <Button variant="outline" size="sm" onClick={cancelUserEdit} className="h-8 px-3 text-xs">Clear</Button>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setShowBulkActions((value) => !value)}
        className={showBulkActions ? "border-primary/40 bg-primary/10 text-primary" : ""}
        title={showBulkActions ? "Hide user actions" : "Show user actions"}
        aria-label={showBulkActions ? "Hide user actions" : "Show user actions"}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </Button>
      {showBulkActions ? (
        <>
          <Button variant="outline" size="sm" disabled={(!selectedUserIds.length && !editingUserId) || saving} onClick={setSelectedUserDraft} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Draft</Button>
          <Button variant="outline" size="sm" disabled={(!selectedUserIds.length && !editingUserId) || saving} onClick={() => void setSelectedUserEnabled(true)} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Active</Button>
          <Button variant="outline" size="sm" disabled={(!selectedUserIds.length && !editingUserId) || saving} onClick={() => void setSelectedUserEnabled(false)} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Inactive</Button>
          <Button variant="outline" size="sm" disabled={saving} onClick={exportIamCsv} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Export CSV</Button>
        </>
      ) : null}
    </>
  )
  const roleToolbar = (
    <>
      <Button variant="outline" size="sm" onClick={startNewRole} className="h-8 px-3 text-xs">Add</Button>
      <Button variant="outline" size="sm" onClick={() => { const r = roles.find((x) => x.role_key === editingRoleKey); if (r) editRole(r); else setMessage("Select a role row to edit.") }} className="h-8 px-3 text-xs">Edit</Button>
      <Button variant="outline" size="sm" onClick={() => { if (editingRoleKey) { const r = roles.find((x) => x.role_key === editingRoleKey); if (r?.system_role) { setMessage("Cannot delete a system role") } else { setConfirmDelete({ type: "role", key: editingRoleKey, label: r?.role_name ?? editingRoleKey }) } } else setMessage("Select a role row to delete.") }} className="h-8 px-3 text-xs">Delete</Button>
      <Button variant="outline" size="sm" onClick={cancelRoleEdit} className="h-8 px-3 text-xs">Cancel</Button>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setShowBulkActions((value) => !value)}
        className={showBulkActions ? "border-primary/40 bg-primary/10 text-primary" : ""}
        title={showBulkActions ? "Hide role actions" : "Show role actions"}
        aria-label={showBulkActions ? "Hide role actions" : "Show role actions"}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </Button>
      {showBulkActions ? (
        <>
          <Button variant="outline" size="sm" disabled={!editingRoleKey || saving} onClick={() => setSelectedIamStatus("role", editingRoleKey, "draft")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Draft</Button>
          <Button variant="outline" size="sm" disabled={!editingRoleKey || saving} onClick={() => setSelectedIamStatus("role", editingRoleKey, "active")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Active</Button>
          <Button variant="outline" size="sm" disabled={!editingRoleKey || saving} onClick={() => setSelectedIamStatus("role", editingRoleKey, "inactive")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Inactive</Button>
          <Button variant="outline" size="sm" disabled={!editingRoleKey || saving} onClick={exportIamCsv} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Export CSV</Button>
        </>
      ) : null}
    </>
  )
  const roleFunctionToolbar = (
    <>
      <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search roles, functions, actions..."
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none transition focus:border-primary"
        />
      </div>
      <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
        {filteredRoleFunctions.length} shown
      </span>
      <Button variant="outline" size="sm" onClick={startNewRoleFunction} className="h-8 px-3 text-xs">Add</Button>
      <Button variant="outline" size="sm" onClick={() => { if (selectedRoleFunction) editRoleFunction(selectedRoleFunction); else setMessage("Select a role function row to edit.") }} className="h-8 px-3 text-xs">Edit</Button>
      <Button variant="outline" size="sm" onClick={() => { if (editingRoleFunctionKey) setConfirmDelete({ type: "role-function", key: editingRoleFunctionKey, label: editingRoleFunctionKey.replace("::", ":") }); else setMessage("Select a role function row to delete.") }} className="h-8 px-3 text-xs">Delete</Button>
      <Button variant="outline" size="sm" onClick={cancelRoleFunctionEdit} className="h-8 px-3 text-xs">Clear</Button>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setShowBulkActions((value) => !value)}
        className={showBulkActions ? "border-primary/40 bg-primary/10 text-primary" : ""}
        title={showBulkActions ? "Hide role function actions" : "Show role function actions"}
        aria-label={showBulkActions ? "Hide role function actions" : "Show role function actions"}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </Button>
      {showBulkActions ? (
        <Button variant="outline" size="sm" disabled={saving} onClick={exportIamCsv} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Export CSV</Button>
      ) : null}
    </>
  )
  const permissionToolbar = (
    <>
      <Button variant="outline" size="sm" onClick={startNewPermission} className="h-8 px-3 text-xs">Add</Button>
      <Button variant="outline" size="sm" onClick={() => { const p = permissions.find((x) => x.permission_key === editingPermissionKey); if (p) editPermission(p); else setMessage("Select a permission row to edit.") }} className="h-8 px-3 text-xs">Edit</Button>
      <Button variant="outline" size="sm" onClick={() => { if (editingPermissionKey) setConfirmDelete({ type: "permission", key: editingPermissionKey, label: editingPermissionKey }); else setMessage("Select a permission row to delete.") }} className="h-8 px-3 text-xs">Delete</Button>
      <Button variant="outline" size="sm" onClick={cancelPermissionEdit} className="h-8 px-3 text-xs">Cancel</Button>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setShowBulkActions((value) => !value)}
        className={showBulkActions ? "border-primary/40 bg-primary/10 text-primary" : ""}
        title={showBulkActions ? "Hide permission actions" : "Show permission actions"}
        aria-label={showBulkActions ? "Hide permission actions" : "Show permission actions"}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </Button>
      {showBulkActions ? (
        <>
          <Button variant="outline" size="sm" disabled={!editingPermissionKey || saving} onClick={() => setSelectedIamStatus("permission", editingPermissionKey, "draft")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Draft</Button>
          <Button variant="outline" size="sm" disabled={!editingPermissionKey || saving} onClick={() => setSelectedIamStatus("permission", editingPermissionKey, "active")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Active</Button>
          <Button variant="outline" size="sm" disabled={!editingPermissionKey || saving} onClick={() => setSelectedIamStatus("permission", editingPermissionKey, "inactive")} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Set Inactive</Button>
          <Button variant="outline" size="sm" disabled={!editingPermissionKey || saving} onClick={exportIamCsv} className="h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Export CSV</Button>
        </>
      ) : null}
    </>
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeftPanel((value) => !value)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${!showLeftPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              Query
            </button>
            <button
              onClick={() => setShowRightPanel((value) => !value)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${!showRightPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              Builder
            </button>
            {(tab === "users" || tab === "roles" || tab === "role-functions" || tab === "permissions") && (
              <button onClick={() => tab === "users" ? startNewUser() : tab === "roles" ? startNewRole() : tab === "role-functions" ? startNewRoleFunction() : startNewPermission()} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">+ Add</button>
            )}
          </div>
        </div>
      </div>

      {message && <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{message}</div>}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Confirm Delete</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete {confirmDelete.type} <span className="font-medium text-foreground">{confirmDelete.label}</span>? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={saving} className="h-9 px-4">Cancel</Button>
              <Button size="sm" onClick={() => confirmDelete.type === "user" ? void deleteUser(confirmDelete.key) : confirmDelete.type === "role" ? void deleteRole(confirmDelete.key) : confirmDelete.type === "role-function" ? void deleteRoleFunction(confirmDelete.key) : void deletePermission(confirmDelete.key)} disabled={saving} className="h-9 bg-destructive px-4 text-destructive-foreground hover:bg-destructive/90">{saving ? "Deleting..." : "Delete"}</Button>
            </div>
          </div>
        </div>
      )}

      {showUserDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold">{editingUserId ? "Edit User" : "Create User"}</h3>
                <p className="text-xs text-muted-foreground">Manage identity, role assignment, and user-level data scope.</p>
              </div>
              <button
                type="button"
                onClick={cancelUserEdit}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close user dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="User ID" value={userForm.user_id} onChange={(value) => setUserForm((prev) => ({ ...prev, user_id: value }))} />
                    <Field label="Display Name" value={userForm.display_name} onChange={(value) => setUserForm((prev) => ({ ...prev, display_name: value }))} />
                    <Field label="Email" value={userForm.email} onChange={(value) => setUserForm((prev) => ({ ...prev, email: value }))} />
                    <Field label="Legal Entity" value={userForm.organizations.join(", ")} onChange={updateUserOrganizations} />
                    <Field label="Cost Center" value={userForm.cost_centers.join(", ")} onChange={updateUserCostCenters} />
                    <label className="flex items-center gap-2 self-end rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm">
                      <input type="checkbox" checked={userForm.enabled} onChange={(e) => setUserForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
                      Enabled
                    </label>
                  </div>

                  <AccessSection icon={<UserCog className="h-3.5 w-3.5" />} title="Assigned Roles">
                    <div className="grid max-h-56 gap-2 overflow-auto rounded-lg border border-border p-2 sm:grid-cols-2">
                      {roles.map((role) => (
                        <label key={role.role_key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{role.role_key}</span>
                            <span className="block truncate text-xs text-muted-foreground">{role.role_name}</span>
                          </span>
                          <input type="checkbox" checked={userForm.roles.includes(role.role_key)} onChange={() => toggleUserRole(role.role_key)} />
                        </label>
                      ))}
                    </div>
                  </AccessSection>

                  <AccessSection icon={<KeyRound className="h-3.5 w-3.5" />} title="Organization and User Data">
                    <div className="space-y-3">
                      {userForm.data_scopes.map((scope, index) => (
                        <div key={index} className="grid gap-2 rounded-lg border border-border bg-background p-3 text-xs">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <select value={scope.entity_key} onChange={(event) => updateUserDataScope(index, { entity_key: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2">{functionOptions.map((item) => item.replace(/^mdm\./, "")).map((entityKey) => <option key={entityKey} value={entityKey}>{entityKey}</option>)}</select>
                            <select value={scope.field_key} onChange={(event) => updateUserDataScope(index, { field_key: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2">{dataScopeFields.map((field) => <option key={field} value={field}>{field}</option>)}</select>
                          </div>
                          <input value={scope.allowed_values.join(", ")} onChange={(event) => updateUserDataScope(index, { allowed_values: splitComma(event.target.value) })} placeholder="Allowed values, use @current_user for self" className="h-8 rounded-md border border-border bg-background px-2 outline-none focus:border-primary" />
                          <Button variant="outline" size="sm" onClick={() => removeUserDataScope(index)} className="h-8 justify-self-start px-3 text-xs">Remove Scope</Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addUserDataScope} className="h-8 text-xs">Add User Scope</Button>
                    </div>
                  </AccessSection>
                </div>
                <AccessLens access={effectiveUserAccess} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-4">
              <div className="text-xs text-muted-foreground">{editingUserId ? `Editing ${editingUserId}` : "New user"}</div>
              <div className="flex gap-2">
                {editingUserId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowUserDialog(false)
                      setConfirmDelete({ type: "user", key: editingUserId, label: userForm.display_name || editingUserId })
                    }}
                    disabled={saving}
                    className="h-9 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={cancelUserEdit} disabled={saving} className="h-9 px-4 text-xs">Cancel</Button>
                <Button size="sm" onClick={() => void saveUser()} disabled={saving} className="h-9 gap-2 px-4 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : editingUserId ? "Update User" : "Create User"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRoleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold">{editingRoleKey ? "Edit Role" : "Create Role"}</h3>
                <p className="text-xs text-muted-foreground">Manage role configuration, permissions, menus, and data scope.</p>
              </div>
              <button
                type="button"
                onClick={cancelRoleEdit}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close role dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role Builder</div>
                    <Field label="Role Key" value={roleForm.role_key} onChange={(value) => setRoleForm((prev) => ({ ...prev, role_key: value }))} />
                    <Field label="Role Name" value={roleForm.role_name} onChange={(value) => setRoleForm((prev) => ({ ...prev, role_name: value }))} />
                    <Field label="Description" value={roleForm.description} onChange={(value) => setRoleForm((prev) => ({ ...prev, description: value }))} />
                  </div>
                  <AccessSection icon={<ListChecks className="h-3.5 w-3.5" />} title="Menus">
                    <div className="grid grid-cols-2 gap-2">{menuOptions.map((menu) => <CheckRow key={menu} label={menu} checked={roleForm.menus.includes(menu)} onChange={() => toggleRoleMenu(menu)} />)}</div>
                  </AccessSection>
                  <AccessSection icon={<SlidersHorizontal className="h-3.5 w-3.5" />} title="Small Capabilities">
                    <div className="grid grid-cols-2 gap-2">{capabilityOptions.map((capability) => <CheckRow key={capability} label={capability} checked={roleForm.capabilities.includes(capability)} onChange={() => toggleRoleCapability(capability)} />)}</div>
                  </AccessSection>
                  <AccessSection icon={<ShieldCheck className="h-3.5 w-3.5" />} title="Function CRUD and Assignment">
                    <div className="max-h-48 overflow-auto rounded-lg border border-border">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground"><tr>{["Function", "C", "R", "U", "D", "Assign"].map((head) => <th key={head} className="px-2 py-2 text-left font-medium">{head}</th>)}</tr></thead>
                        <tbody>{functionOptions.map((functionKey) => {
                          const grant = roleForm.functions.find((item) => item.function_key === functionKey) ?? emptyFunctionGrant(functionKey)
                          return <tr key={functionKey} className="border-t border-border"><td className="px-2 py-2 font-medium">{functionKey}</td>{(["can_create", "can_read", "can_update", "can_delete", "can_assign"] as const).map((field) => <td key={field} className="px-2 py-2"><input type="checkbox" checked={Boolean(grant[field])} onChange={() => toggleFunctionGrant(functionKey, field)} /></td>)}</tr>
                        })}</tbody>
                      </table>
                    </div>
                  </AccessSection>
                  <AccessSection icon={<KeyRound className="h-3.5 w-3.5" />} title="Data Segregation">
                    <div className="space-y-2">
                      {roleForm.data_scopes.map((scope, index) => (
                        <div key={index} className="grid gap-2 rounded-lg border border-border bg-background p-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <select value={scope.entity_key} onChange={(event) => updateDataScope(index, { entity_key: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2">{functionOptions.map((item) => item.replace(/^mdm\./, "")).map((entityKey) => <option key={entityKey} value={entityKey}>{entityKey}</option>)}</select>
                            <select value={scope.field_key} onChange={(event) => updateDataScope(index, { field_key: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2">{dataScopeFields.map((field) => <option key={field} value={field}>{field}</option>)}</select>
                          </div>
                          <input value={scope.allowed_values.join(", ")} onChange={(event) => updateDataScope(index, { allowed_values: splitComma(event.target.value) })} placeholder="Allowed values, comma separated" className="h-8 rounded-md border border-border bg-background px-2 outline-none focus:border-primary" />
                          <Button variant="outline" size="sm" onClick={() => removeDataScope(index)} className="h-8 justify-self-start px-3 text-xs">Remove Scope</Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addDataScope} className="h-8 text-xs">Add Data Scope</Button>
                    </div>
                  </AccessSection>
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Permissions</div>
                    <div className="max-h-56 space-y-2 overflow-auto pr-1">{permissions.map((permission) => (
                      <label key={permission.permission_key} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        <span><span className="font-medium">{permission.permission_key}</span><span className="mt-0.5 block text-xs text-muted-foreground">{permission.description ?? "-"}</span></span>
                        <input type="checkbox" checked={roleForm.permissions.includes(permission.permission_key)} onChange={() => toggleRolePermission(permission.permission_key)} />
                      </label>
                    ))}</div>
                  </div>
                </div>
                <AccessLens access={roleFormToEffectiveAccess(roleForm)} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-4">
              <div className="text-xs text-muted-foreground">{editingRoleKey ? `Editing ${editingRoleKey}` : "New role"}</div>
              <div className="flex gap-2">
                {editingRoleKey && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowRoleDialog(false)
                      const r = roles.find((x) => x.role_key === editingRoleKey)
                      if (r?.system_role) { setMessage("Cannot delete a system role") } else { setConfirmDelete({ type: "role", key: editingRoleKey!, label: roleForm.role_name || editingRoleKey! }) }
                    }}
                    disabled={saving}
                    className="h-9 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={cancelRoleEdit} disabled={saving} className="h-9 px-4 text-xs">Cancel</Button>
                <Button size="sm" onClick={() => void saveRole()} disabled={saving} className="h-9 gap-2 px-4 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : editingRoleKey ? "Update Role" : "Create Role"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto p-6">
        {showLeftPanel && <aside className="relative w-[342px] shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden">
          <WorkbenchCard title="Query Conditions" badge={`${queryGroup.conditions.length + queryGroup.groups.length} rules`}>
            <QueryBuilder fields={queryFields} query={queryGroup} onChange={setQueryGroup} storageKey={`qb.iam.${tab}`} />
          </WorkbenchCard>
        </aside>}

        <main className="min-w-[760px] flex-1 overflow-y-auto">

      {tab === "users" && (
        <div className="block">
          <section className="hidden">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold"><UserCog className="h-4 w-4 text-primary" />User Profile</div>
            <div className="space-y-3">
              <Field label="User ID" value={userForm.user_id} onChange={(value) => setUserForm((prev) => ({ ...prev, user_id: value }))} />
              <Field label="Display Name" value={userForm.display_name} onChange={(value) => setUserForm((prev) => ({ ...prev, display_name: value }))} />
              <Field label="Email" value={userForm.email} onChange={(value) => setUserForm((prev) => ({ ...prev, email: value }))} />
              <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                <input type="checkbox" checked={userForm.enabled} onChange={(e) => setUserForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
                Enabled
              </label>
              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Assigned Roles</div>
                <div className="grid gap-2">
                  {roles.map((role) => (
                    <label key={role.role_key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <span><span className="font-medium">{role.role_key}</span><span className="ml-2 text-xs text-muted-foreground">{role.role_name}</span></span>
                      <input type="checkbox" checked={userForm.roles.includes(role.role_key)} onChange={() => toggleUserRole(role.role_key)} />
                    </label>
                  ))}
                </div>
              </div>
              <AccessLens access={effectiveUserAccess} />
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => void saveUser()} disabled={saving} className="h-9 flex-1 gap-2 text-xs"><Save className="h-3.5 w-3.5" />Save User</Button>
                <Button variant="outline" size="sm" onClick={() => setUserForm(emptyUser)} className="h-9 text-xs">Clear</Button>
              </div>
            </div>
          </section>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <IamMetric label="Enabled Users" value={userTableStats.enabled} />
            <IamMetric label="Inactive Users" value={userTableStats.disabled} />
            <IamMetric label="Assigned Roles" value={userTableStats.roleCount} />
            <IamMetric label="Scoped Users" value={userTableStats.scoped} />
          </div>
          <DataTable
            toolbar={userToolbar}
            columns={["User", "Display Name", "Email", "Status", "Roles", "Legal Entity", "Cost Center", "Access Scope", "Created", "Updated", "Actions"]}
            rowKeys={filteredUsers.map((user) => user.user_id)}
            selectedRowKeys={selectedUserIds}
            onSelectRows={handleUserSelection}
            onDoubleClickRow={(userId) => { const u = users.find((x) => x.user_id === userId); if (u) editUser(u) }}
            rows={filteredUsers.map((user) => [
              <div key="user" className="font-medium text-primary">{user.user_id}</div>,
              <span key="name">{user.display_name || "-"}</span>,
              user.email || "-",
              <span key="status" className={cn("rounded-full px-2 py-1 text-xs font-medium", user.enabled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600")}>{user.enabled ? "enabled" : "disabled"}</span>,
              <RolePills key="roles" roles={user.roles ?? []} />,
              <PermissionPills key="legal-entities" permissions={user.organizations ?? []} />,
              <PermissionPills key="cost-centers" permissions={costCentersFromScopes(user.data_scopes ?? [])} />,
              <AccessScopeCell key="scope" user={user} />,
              formatDate(user.created_at),
              formatDate(user.updated_at),
              <RowActionMenu
                key="actions"
                onAssist={() => setMessage(`AI Assist for user ${user.user_id}`)}
                onEdit={() => editUser(user)}
                onDelete={() => setConfirmDelete({ type: "user", key: user.user_id, label: user.display_name || user.user_id })}
              />,
            ])}
            empty="No users found."
          />
        </div>
      )}

      {tab === "roles" && (
        <div className="block">
          <section className="hidden">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold"><KeyRound className="h-4 w-4 text-primary" />Role & Permissions</div>
            <div className="space-y-3">
              <Field label="Role Key" value={roleForm.role_key} onChange={(value) => setRoleForm((prev) => ({ ...prev, role_key: value }))} />
              <Field label="Role Name" value={roleForm.role_name} onChange={(value) => setRoleForm((prev) => ({ ...prev, role_name: value }))} />
              <Field label="Description" value={roleForm.description} onChange={(value) => setRoleForm((prev) => ({ ...prev, description: value }))} />
              <AccessSection icon={<ListChecks className="h-3.5 w-3.5" />} title="Menus">
                <div className="grid grid-cols-2 gap-2">
                  {menuOptions.map((menu) => (
                    <CheckRow key={menu} label={menu} checked={roleForm.menus.includes(menu)} onChange={() => toggleRoleMenu(menu)} />
                  ))}
                </div>
              </AccessSection>
              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Permissions</div>
                <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                  {permissions.map((permission) => (
                    <label key={permission.permission_key} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <span><span className="font-medium">{permission.permission_key}</span><span className="mt-0.5 block text-xs text-muted-foreground">{permission.description ?? "-"}</span></span>
                      <input type="checkbox" checked={roleForm.permissions.includes(permission.permission_key)} onChange={() => toggleRolePermission(permission.permission_key)} />
                    </label>
                  ))}
                </div>
              </div>
              <AccessSection icon={<SlidersHorizontal className="h-3.5 w-3.5" />} title="Small Capabilities">
                <div className="grid grid-cols-2 gap-2">
                  {capabilityOptions.map((capability) => (
                    <CheckRow key={capability} label={capability} checked={roleForm.capabilities.includes(capability)} onChange={() => toggleRoleCapability(capability)} />
                  ))}
                </div>
              </AccessSection>
              <AccessSection icon={<ShieldCheck className="h-3.5 w-3.5" />} title="Function CRUD and Assignment">
                <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        {["Function", "C", "R", "U", "D", "Assign"].map((head) => <th key={head} className="px-2 py-2 text-left font-medium">{head}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {functionOptions.map((functionKey) => {
                        const grant = roleForm.functions.find((item) => item.function_key === functionKey) ?? emptyFunctionGrant(functionKey)
                        return (
                          <tr key={functionKey} className="border-t border-border">
                            <td className="px-2 py-2 font-medium">{functionKey}</td>
                            {(["can_create", "can_read", "can_update", "can_delete", "can_assign"] as const).map((field) => (
                              <td key={field} className="px-2 py-2">
                                <input type="checkbox" checked={Boolean(grant[field])} onChange={() => toggleFunctionGrant(functionKey, field)} />
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </AccessSection>
              <AccessSection icon={<KeyRound className="h-3.5 w-3.5" />} title="Data Segregation">
                <div className="space-y-2">
                  {roleForm.data_scopes.map((scope, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border border-border bg-background p-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <select value={scope.entity_key} onChange={(event) => updateDataScope(index, { entity_key: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2">
                          {functionOptions.map((item) => item.replace(/^mdm\./, "")).map((entityKey) => <option key={entityKey} value={entityKey}>{entityKey}</option>)}
                        </select>
                        <select value={scope.field_key} onChange={(event) => updateDataScope(index, { field_key: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2">
                          {dataScopeFields.map((field) => <option key={field} value={field}>{field}</option>)}
                        </select>
                      </div>
                      <input
                        value={scope.allowed_values.join(", ")}
                        onChange={(event) => updateDataScope(index, { allowed_values: splitComma(event.target.value) })}
                        placeholder="Allowed values, comma separated"
                        className="h-8 rounded-md border border-border bg-background px-2 outline-none focus:border-primary"
                      />
                      <Button variant="outline" size="sm" onClick={() => removeDataScope(index)} className="h-8 justify-self-start px-3 text-xs">Remove Scope</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addDataScope} className="h-8 text-xs">Add Data Scope</Button>
                </div>
              </AccessSection>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => void saveRole()} disabled={saving} className="h-9 flex-1 gap-2 text-xs"><Save className="h-3.5 w-3.5" />Save Role</Button>
                <Button variant="outline" size="sm" onClick={() => setRoleForm(emptyRole)} className="h-9 text-xs">Clear</Button>
              </div>
            </div>
          </section>
          <DataTable
            toolbar={roleToolbar}
            columns={["Role", "Description", "Type", "Menus", "Functions", "Permissions", "Actions"]}
            rowKeys={filteredRoles.map((role) => role.role_key)}
            selectedRowKey={editingRoleKey}
            onSelectRow={setEditingRoleKey}
            onDoubleClickRow={(roleKey) => { const r = roles.find((x) => x.role_key === roleKey); if (r) editRole(r) }}
            rows={filteredRoles.map((role) => [
              <div key="role"><div className="font-medium text-primary">{role.role_key}</div><div className="text-xs text-muted-foreground">{role.role_name}</div></div>,
              role.description || "-",
              role.system_role ? "system" : "custom",
              <PermissionPills key="menus" permissions={role.menus ?? []} />,
              <span key="functions" className="text-xs text-muted-foreground">{role.functions?.length ?? 0} function grants, {role.data_scopes?.length ?? 0} data scopes</span>,
              <PermissionPills key="permissions" permissions={role.permissions ?? []} />,
              <RowActionMenu
                key="actions"
                onAssist={() => setMessage(`AI Assist for role ${role.role_key}`)}
                onEdit={() => editRole(role)}
                onDelete={!role.system_role ? () => setConfirmDelete({ type: "role", key: role.role_key, label: role.role_name || role.role_key }) : undefined}
              />,
            ])}
            empty="No roles found."
          />
        </div>
      )}

      {tab === "role-functions" && (
        <div className="block">
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <IamMetric label="Function Grants" value={roleFunctionStats.total} />
            <IamMetric label="Roles Covered" value={roleFunctionStats.roleCount} />
            <IamMetric label="Write Grants" value={roleFunctionStats.writable} />
            <IamMetric label="Assign Grants" value={roleFunctionStats.assignable} />
          </div>
          <DataTable
            toolbar={roleFunctionToolbar}
            columns={["Role", "Function", "Allowed Actions", "Granted By", "Granted At", "Actions"]}
            rowKeys={filteredRoleFunctions.map(roleFunctionRowKey)}
            selectedRowKey={editingRoleFunctionKey}
            onSelectRow={setEditingRoleFunctionKey}
            rows={filteredRoleFunctions.map((grant) => [
              <div key="role"><div className="font-medium text-primary">{grant.role_key}</div><div className="text-xs text-muted-foreground">{grant.role_name ?? "-"}</div></div>,
              <span key="function" className="font-medium">{grant.function_key}</span>,
              <FunctionActionPills key="actions" grant={grant} />,
              grant.granted_by ?? "-",
              formatDate(grant.granted_at),
              <RowActionMenu
                key="row-actions"
                onAssist={() => setMessage(`AI Assist for ${grant.role_key}:${grant.function_key}`)}
                onEdit={() => editRoleFunction(grant)}
                onDelete={() => setConfirmDelete({ type: "role-function", key: roleFunctionRowKey(grant), label: `${grant.role_key}:${grant.function_key}` })}
              />,
            ])}
            empty="No role function grants found."
          />
        </div>
      )}

      {tab === "permissions" && (
        <DataTable
          toolbar={permissionToolbar}
          columns={["Permission", "Description", "Actions"]}
          rowKeys={filteredPermissions.map((permission) => permission.permission_key)}
          selectedRowKey={editingPermissionKey}
          onSelectRow={setEditingPermissionKey}
          rows={filteredPermissions.map((permission) => [
            <span key="permission" className="font-medium text-primary">{permission.permission_key}</span>,
            permission.description ?? "-",
            <RowActionMenu
              key="actions"
              onAssist={() => setMessage(`AI Assist for permission ${permission.permission_key}`)}
              onEdit={() => editPermission(permission)}
              onDelete={() => setConfirmDelete({ type: "permission", key: permission.permission_key, label: permission.permission_key })}
            />,
          ])}
          empty="No permissions found."
        />
      )}

      {tab === "audit" && (
        <DataTable
          columns={["When", "Action", "Target", "Actor"]}
          rows={audit.map((item) => [formatDate(item.created_at), item.action, `${item.target_type}:${item.target_key}`, item.actor])}
          empty="No IAM audit events found."
        />
      )}
        </main>

        {showRightPanel && <aside className="relative w-[262px] shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden">
          <WorkbenchCard title="Grid Settings">
            <div className="space-y-3">
              <SelectShell label="Saved Views" value="Select view" />
              <SelectShell label="Column menu" value="Default" />
              <SelectShell label="Group By" value="None" />
              <SelectShell label="Page Size" value="12" />
              <SelectShell label="Row Density" value="Cozy" />
              <SelectShell label="Column Preset" value="Default" />
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">Column Chooser</div>
                <div className="space-y-1 rounded-md border border-border bg-background p-2 text-sm">
                  {gridColumnsForTab(tab).map((column) => (
                    <label key={column} className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      {column}
                    </label>
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 w-full text-xs">Show All Columns</Button>
              <Button variant="outline" size="sm" className="h-8 w-full text-xs">Reset Grid Layout</Button>
            </div>
          </WorkbenchCard>
          <WorkbenchCard title="Approvals & Audit" badge={`${audit.length} total`}>
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium">AI Audit Trail</span>
                  <Button variant="outline" size="sm" onClick={() => void loadAll()} className="h-7 px-2 text-[11px]">Refresh</Button>
                </div>
                <div className="text-xs text-muted-foreground">{audit.length ? `${audit.length} IAM audit events loaded.` : "No audit events."}</div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium">Approvals</span>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]">Refresh</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SelectShell value="All status" />
                  <input placeholder="entity" className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none" />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">0 total</div>
              </div>
            </div>
          </WorkbenchCard>
        </aside>}
      </div>
    </div>
  )
}

function gridColumnsForTab(tab: IamTab): string[] {
  if (tab === "users") return ["User", "Display Name", "Email", "Status", "Roles", "Legal Entity", "Cost Center", "Access Scope", "Created", "Updated", "Actions"]
  if (tab === "roles") return ["Role", "Description", "Type", "Menus", "Functions", "Permissions", "Actions"]
  if (tab === "role-functions") return ["Role", "Function", "Allowed Actions", "Granted By", "Granted At", "Actions"]
  if (tab === "permissions") return ["Permission", "Description", "Actions"]
  return ["When", "Action", "Target", "Actor"]
}

function IamMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
    </label>
  )
}

function AccessSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">{icon}{title}</div>
      {children}
    </div>
  )
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
      <span className="truncate">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} />
    </label>
  )
}

function AccessLens({ access }: { access: EffectiveAccess }) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Effective Access Lens
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">role-derived</span>
      </div>
      <div className="grid gap-2 text-xs">
        <LensRow label="Menus" value={access.menus.join(", ") || "No menus"} />
        <LensRow label="Small Functions" value={access.capabilities.join(", ") || "No capabilities"} />
        <LensRow label="Function CRUD" value={`${access.functions.length} grant${access.functions.length === 1 ? "" : "s"}`} />
        <LensRow label="Data Segregation" value={access.data_scopes.length ? access.data_scopes.map((scope) => `${scope.entity_key}.${scope.field_key}=${scope.allowed_values.join("|")}`).join(", ") : "Tenant-wide"} />
      </div>
    </div>
  )
}

function LensRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  )
}

function RolePills({ roles }: { roles: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.length ? roles.map((role) => <span key={role} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{role}</span>) : <span className="text-muted-foreground">-</span>}
    </div>
  )
}

function PermissionPills({ permissions }: { permissions: string[] }) {
  const visible = permissions.slice(0, 6)
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((permission) => <span key={permission} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{permission}</span>)}
      {permissions.length > visible.length && <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">+{permissions.length - visible.length}</span>}
      {!permissions.length && <span className="text-muted-foreground">-</span>}
    </div>
  )
}

function FunctionActionPills({ grant }: { grant: IamFunctionGrant }) {
  const actions = [
    grant.can_create ? "create" : "",
    grant.can_read ? "read" : "",
    grant.can_update ? "update" : "",
    grant.can_delete ? "delete" : "",
    grant.can_assign ? "assign" : "",
  ].filter(Boolean)
  return <PermissionPills permissions={actions} />
}

function AccessScopeCell({ user }: { user: IamUser }) {
  const orgCount = user.organizations?.length ?? 0
  const scopeCount = user.data_scopes?.length ?? 0
  if (!orgCount && !scopeCount) return <span className="text-xs text-muted-foreground">Tenant-wide</span>
  return (
    <div className="space-y-1 text-xs">
      <div className="text-foreground">{orgCount} legal entit{orgCount === 1 ? "y" : "ies"}</div>
      <div className="text-muted-foreground">{scopeCount} user scope{scopeCount === 1 ? "" : "s"}</div>
    </div>
  )
}

function RowActionMenu({ onAssist, onEdit, onDelete }: { onAssist?: () => void; onEdit: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false)
  const runAction = (action?: () => void) => {
    setOpen(false)
    action?.()
  }

  return (
    <div className="relative flex justify-center">
      <button
        type="button"
        aria-label="Row actions"
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary",
          open && "border-primary bg-primary/10 text-primary"
        )}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-36 overflow-hidden rounded-md border border-border bg-card py-1 text-sm shadow-lg">
          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => runAction(onAssist)}>AI Assist</button>
          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => runAction(onEdit)}>Edit</button>
          {onDelete && <button type="button" className="block w-full px-3 py-2 text-left text-destructive hover:bg-destructive/10" onClick={() => runAction(onDelete)}>Delete</button>}
        </div>
      )}
    </div>
  )
}

function DataTable({
  columns,
  rows,
  empty,
  toolbar,
  rowKeys,
  selectedRowKey,
  selectedRowKeys,
  onSelectRow,
  onSelectRows,
  onDoubleClickRow,
}: {
  columns: string[]
  rows: React.ReactNode[][]
  empty: string
  toolbar?: React.ReactNode
  rowKeys?: string[]
  selectedRowKey?: string | null
  selectedRowKeys?: string[]
  onSelectRow?: (rowKey: string | null) => void
  onSelectRows?: (rowKeys: string[]) => void
  onDoubleClickRow?: (rowKey: string) => void
}) {
  const [columnOrder, setColumnOrder] = useState<string[]>(columns)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => Object.fromEntries(columns.map((column) => [column, defaultColumnWidth(column)])))
  const [dragColumn, setDragColumn] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<{ column: string; direction: "asc" | "desc" } | null>(null)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterMenuColumn, setFilterMenuColumn] = useState<string | null>(null)
  const [menuColumn, setMenuColumn] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const columnSignature = columns.join("\u001f")

  useEffect(() => {
    setColumnOrder((current) => {
      const retained = current.filter((column) => columns.includes(column))
      const missing = columns.filter((column) => !retained.includes(column))
      return [...retained, ...missing]
    })
    setColumnWidths((current) => {
      const next: Record<string, number> = {}
      columns.forEach((column) => {
        next[column] = current[column] ?? defaultColumnWidth(column)
      })
      return next
    })
    setColumnFilters((current) => {
      const next: Record<string, string> = {}
      columns.forEach((column) => {
        if (current[column]) next[column] = current[column]
      })
      return next
    })
    setSortBy((current) => (current && columns.includes(current.column) ? current : null))
  }, [columnSignature])

  const orderedColumns = useMemo(() => {
    const retained = columnOrder.filter((column) => columns.includes(column))
    const missing = columns.filter((column) => !retained.includes(column))
    return [...retained, ...missing]
  }, [columnOrder, columnSignature])

  const preparedRows = useMemo(() => {
    const indexedRows = rows.map((row, rowIndex) => ({ row, rowIndex, rowKey: rowKeys?.[rowIndex] }))
    const columnIndex = new Map(columns.map((column, index) => [column, index]))
    const filteredRows = indexedRows.filter(({ row }) => Object.entries(columnFilters).every(([column, value]) => {
      const query = value.trim().toLowerCase()
      if (!query) return true
      const index = columnIndex.get(column)
      if (index === undefined) return true
      return reactNodeText(row[index]).toLowerCase().includes(query)
    }))
    if (!sortBy) return filteredRows
    const sortIndex = columnIndex.get(sortBy.column)
    if (sortIndex === undefined) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const aText = reactNodeText(a.row[sortIndex])
      const bText = reactNodeText(b.row[sortIndex])
      const aNumber = Number(aText.replace(/,/g, ""))
      const bNumber = Number(bText.replace(/,/g, ""))
      const comparison = Number.isFinite(aNumber) && Number.isFinite(bNumber)
        ? aNumber - bNumber
        : aText.localeCompare(bText, undefined, { numeric: true, sensitivity: "base" })
      return sortBy.direction === "asc" ? comparison : -comparison
    })
  }, [columnFilters, columns, rows, rowKeys, sortBy])

  const moveColumn = (sourceColumn: string, targetColumn: string) => {
    if (sourceColumn === targetColumn) return
    setColumnOrder((current) => {
      const next = current.filter((column) => column !== sourceColumn)
      const targetIndex = next.indexOf(targetColumn)
      if (targetIndex < 0) return current
      next.splice(targetIndex, 0, sourceColumn)
      return next
    })
  }

  const resetColumns = () => {
    setColumnOrder(columns)
    setColumnWidths(Object.fromEntries(columns.map((column) => [column, defaultColumnWidth(column)])))
    setColumnFilters({})
    setSortBy(null)
    setMenuColumn(null)
    setFilterMenuColumn(null)
  }

  const startColumnResize = (column: string, event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = columnWidths[column] ?? defaultColumnWidth(column)
    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(560, Math.max(72, startWidth + moveEvent.clientX - startX))
      setColumnWidths((current) => ({ ...current, [column]: nextWidth }))
    }
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  const selectedRowKeySet = useMemo(() => new Set(selectedRowKeys ?? (selectedRowKey ? [selectedRowKey] : [])), [selectedRowKey, selectedRowKeys])
  const visibleRowKeys = preparedRows.map((row) => row.rowKey).filter((rowKey): rowKey is string => Boolean(rowKey))
  const allPreparedSelected = Boolean(visibleRowKeys.length && visibleRowKeys.every((rowKey) => selectedRowKeySet.has(rowKey)))
  const toggleAllVisibleRows = (checked: boolean) => {
    if (onSelectRows) {
      if (!checked) {
        const visible = new Set(visibleRowKeys)
        onSelectRows((selectedRowKeys ?? []).filter((rowKey) => !visible.has(rowKey)))
        return
      }
      onSelectRows(Array.from(new Set([...(selectedRowKeys ?? []), ...visibleRowKeys])))
      return
    }
    onSelectRow?.(checked ? preparedRows[0]?.rowKey ?? null : null)
  }
  const toggleRow = (rowKey: string | undefined, checked: boolean) => {
    if (!rowKey) return
    if (onSelectRows) {
      const current = selectedRowKeys ?? []
      onSelectRows(checked ? Array.from(new Set([...current, rowKey])) : current.filter((key) => key !== rowKey))
      return
    }
    onSelectRow?.(checked ? rowKey : null)
  }

  return (
    <div className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-card shadow-sm">
      <div
        onDragOver={(e) => { e.preventDefault() }}
        onDrop={(e) => { e.preventDefault(); if (dragColumn) setGroupBy(dragColumn); setDragColumn(null) }}
        className="flex items-center justify-between gap-2 border-b border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
      >
        {groupBy ? (
          <span>Grouped by: <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{groupBy}</span></span>
        ) : (
          <span>Drag a column header here to group</span>
        )}
        {groupBy && <button type="button" onClick={() => setGroupBy(null)} className="rounded px-1 hover:text-destructive">Clear</button>}
      </div>
      <div className="border-b border-border bg-muted/20 p-2">
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-20 bg-muted px-2 py-2 text-left" style={{ width: columnWidths["__select__"] ?? 36, minWidth: columnWidths["__select__"] ?? 36 }}>
                <div className="relative pr-3">
                  <input
                    type="checkbox"
                    aria-label="Select visible rows"
                    checked={allPreparedSelected}
                    onChange={(event) => toggleAllVisibleRows(event.target.checked)}
                  />
                  <span onMouseDown={(event) => startColumnResize("__select__", event)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                </div>
              </th>
              {orderedColumns.map((column) => {
                const isUtilityColumn = column === "Action" || column === "Actions"
                const filterValue = columnFilters[column] ?? ""
                return (
                  <th
                    key={column}
                    draggable
                    onDragStart={(e) => { setDragColumn(column); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", column) }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragColumn) moveColumn(dragColumn, column)
                      setDragColumn(null)
                    }}
                    onDragEnd={() => setDragColumn(null)}
                    className={`relative px-3 py-2 text-left ${dragColumn === column ? "bg-primary/5" : ""}`}
                    style={{ width: columnWidths[column], minWidth: columnWidths[column] }}
                  >
                    {isUtilityColumn ? (
                      <div className="relative pr-4">
                        {column}
                        <span onMouseDown={(event) => startColumnResize(column, event)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                      </div>
                    ) : (
                      <div className="relative flex items-center justify-between gap-2 pr-4">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => {
                            setSortBy((current) => {
                              if (current?.column !== column) return { column, direction: "asc" }
                              if (current.direction === "asc") return { column, direction: "desc" }
                              return null
                            })
                          }}
                        >
                          {column}
                          <span className={`text-[10px] ${sortBy?.column === column ? "text-primary" : "text-muted-foreground/50"}`}>{sortBy?.column === column ? (sortBy.direction === "asc" ? "▲" : "▼") : "↕"}</span>
                        </button>
                        <span className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setFilterMenuColumn((current) => (current === column ? null : column))
                              setMenuColumn(null)
                            }}
                            title={filterValue.trim() ? `Filtered: ${filterValue}` : "Filter this column"}
                            className={`rounded p-1 hover:bg-muted ${filterValue.trim() ? "text-primary" : "text-muted-foreground"}`}
                          >
                            <Filter size={13} fill={filterValue.trim() ? "currentColor" : "none"} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setMenuColumn((current) => (current === column ? null : column))
                              setFilterMenuColumn(null)
                            }}
                            className="rounded px-1 text-xs hover:bg-muted"
                          >
                            ⋮
                          </button>
                        </span>
                        {filterMenuColumn === column && (
                          <ColumnFilterPopover
                            column={column}
                            value={filterValue}
                            onChange={(v) => setColumnFilters((current) => ({ ...current, [column]: v }))}
                            onClear={() => setColumnFilters((current) => ({ ...current, [column]: "" }))}
                            onClose={() => setFilterMenuColumn(null)}
                          />
                        )}
                        {menuColumn === column && (
                          <div className="absolute right-0 top-6 z-20 w-40 rounded border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg">
                            <button type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={() => { setSortBy({ column, direction: "asc" }); setMenuColumn(null) }}>Sort Ascending</button>
                            <button type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={() => { setSortBy({ column, direction: "desc" }); setMenuColumn(null) }}>Sort Descending</button>
                            <button type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={() => { setColumnFilters((current) => ({ ...current, [column]: "" })); setMenuColumn(null) }}>Clear Filter</button>
                            <button type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={resetColumns}>Reset Columns</button>
                          </div>
                        )}
                        <span onMouseDown={(event) => startColumnResize(column, event)} className="absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize rounded bg-border/60 hover:bg-primary/70" title="Drag to resize" />
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {preparedRows.map(({ row, rowIndex, rowKey }) => (
              <tr key={rowKey ?? rowIndex} className={`border-b border-border/60 hover:bg-muted/30 last:border-0 ${rowKey && selectedRowKeySet.has(rowKey) ? "bg-primary/5" : ""}`} onDoubleClick={() => { if (rowKey && onDoubleClickRow) onDoubleClickRow(rowKey) }}>
                <td className="sticky left-0 z-10 bg-card px-2 py-3" style={{ width: columnWidths["__select__"] ?? 36, minWidth: columnWidths["__select__"] ?? 36 }}>
                  <input
                    type="checkbox"
                    aria-label={`Select row ${rowIndex + 1}`}
                    checked={Boolean(rowKey && selectedRowKeySet.has(rowKey))}
                    onChange={(event) => toggleRow(rowKey, event.target.checked)}
                  />
                </td>
                {orderedColumns.map((column) => {
                  const cellIndex = columns.indexOf(column)
                  return (
                    <td key={`${column}-${cellIndex}`} className="break-words px-3 py-3 align-top" style={{ width: columnWidths[column], minWidth: columnWidths[column] }}>
                      {row[cellIndex]}
                    </td>
                  )
                })}
              </tr>
            ))}
            {!preparedRows.length && <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-background px-4 py-2 text-xs text-muted-foreground">
        <span>Page 1 of 1 ({preparedRows.length} row{preparedRows.length === 1 ? "" : "s"})</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled className="h-7 px-2 text-xs">Prev</Button>
          <Button variant="outline" size="sm" disabled className="h-7 px-2 text-xs">Next</Button>
        </div>
      </div>
    </div>
  )
}

function defaultColumnWidth(column: string): number {
  const widths: Record<string, number> = {
    User: 220,
    "Display Name": 200,
    Email: 220,
    Status: 140,
    Roles: 160,
    "Legal Entity": 190,
    "Cost Center": 180,
    "Access Scope": 170,
    Created: 180,
    Updated: 190,
    Action: 110,
    Actions: 110,
    Role: 200,
    Function: 240,
    Description: 260,
    Type: 140,
    Menus: 220,
    Functions: 220,
    "Allowed Actions": 220,
    "Granted By": 170,
    "Granted At": 190,
    Permissions: 240,
    Permission: 240,
    When: 190,
    Target: 220,
    Actor: 180,
  }
  return widths[column] ?? Math.max(120, Math.min(260, column.length * 16 + 72))
}

function reactNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(reactNodeText).join(" ")
  if (typeof node === "object" && "props" in node) {
    return reactNodeText((node as { props?: { children?: React.ReactNode } }).props?.children)
  }
  return ""
}

function formatDate(value?: string): string {
  if (!value) return "-"
  return value.includes("T") ? value.slice(0, 19).replace("T", " ") : value
}

function emptyFunctionGrant(functionKey: string): IamFunctionGrant {
  return { function_key: functionKey, can_create: false, can_read: false, can_update: false, can_delete: false, can_assign: false }
}

function roleFunctionRowKey(grant: Pick<IamRoleFunction, "role_key" | "function_key">): string {
  return `${grant.role_key}::${grant.function_key}`
}

function parseRoleFunctionRowKey(key: string): Pick<IamRoleFunction, "role_key" | "function_key"> | null {
  const separator = key.indexOf("::")
  if (separator < 1) return null
  const roleKey = key.slice(0, separator)
  const functionKey = key.slice(separator + 2)
  if (!roleKey || !functionKey) return null
  return { role_key: roleKey, function_key: functionKey }
}

function toggleList(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort()
}

function splitComma(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function isCostCenterScope(scope: IamDataScope): boolean {
  return scope.entity_key === COST_CENTER_SCOPE_ENTITY && scope.field_key === COST_CENTER_SCOPE_FIELD
}

function costCentersFromScopes(scopes: IamDataScope[]): string[] {
  return Array.from(new Set(scopes.filter(isCostCenterScope).flatMap((scope) => scope.allowed_values))).sort()
}

function userDataScopesWithoutCostCenters(scopes: IamDataScope[]): IamDataScope[] {
  return scopes.filter((scope) => !isCostCenterScope(scope))
}

function materializeUserDataScopes(user: UserForm): IamDataScope[] {
  const scopes = userDataScopesWithoutCostCenters(user.data_scopes)
  if (user.cost_centers.length === 0) return scopes
  return [
    ...scopes,
    {
      entity_key: COST_CENTER_SCOPE_ENTITY,
      field_key: COST_CENTER_SCOPE_FIELD,
      allowed_values: Array.from(new Set(user.cost_centers)).sort(),
    },
  ]
}

function toCsv(headers: string[], rows: string[][]): string {
  const encode = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`
  return [headers.map(encode).join(","), ...rows.map((row) => row.map(encode).join(","))].join("\n")
}

function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function mergeRoleAccess(selectedRoles: IamRole[]): EffectiveAccess {
  const menus = new Set<string>()
  const capabilities = new Set<string>()
  const functionMap = new Map<string, IamFunctionGrant>()
  const dataScopes: IamDataScope[] = []
  selectedRoles.forEach((role) => {
    ;(role.menus ?? []).forEach((menu) => menus.add(menu))
    ;(role.capabilities ?? []).forEach((capability) => capabilities.add(capability))
    ;(role.functions ?? []).forEach((grant) => {
      const current = functionMap.get(grant.function_key) ?? emptyFunctionGrant(grant.function_key)
      functionMap.set(grant.function_key, {
        function_key: grant.function_key,
        can_create: current.can_create || grant.can_create,
        can_read: current.can_read || grant.can_read,
        can_update: current.can_update || grant.can_update,
        can_delete: current.can_delete || grant.can_delete,
        can_assign: current.can_assign || grant.can_assign,
      })
    })
    dataScopes.push(...(role.data_scopes ?? []))
  })
  return {
    menus: Array.from(menus).sort(),
    capabilities: Array.from(capabilities).sort(),
    functions: Array.from(functionMap.values()).sort((a, b) => a.function_key.localeCompare(b.function_key)),
    data_scopes: mergeDataScopes(dataScopes),
  }
}

function roleFormToEffectiveAccess(form: RoleForm): EffectiveAccess {
  return {
    menus: form.menus,
    capabilities: form.capabilities,
    functions: form.functions,
    data_scopes: form.data_scopes,
  }
}

function mergeDataScopes(scopes: IamDataScope[]): IamDataScope[] {
  const dataScopeMap = new Map<string, IamDataScope>()
  scopes.forEach((scope) => {
    const key = `${scope.entity_key}:${scope.field_key}`
    const current = dataScopeMap.get(key)
    dataScopeMap.set(key, {
      entity_key: scope.entity_key,
      field_key: scope.field_key,
      allowed_values: Array.from(new Set([...(current?.allowed_values ?? []), ...scope.allowed_values])).sort(),
    })
  })
  return Array.from(dataScopeMap.values()).sort((a, b) => `${a.entity_key}.${a.field_key}`.localeCompare(`${b.entity_key}.${b.field_key}`))
}
