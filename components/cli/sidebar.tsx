"use client"

import { useEffect, useState } from "react"
import {
  FlaskConical,
  Package,
  FolderKanban,
  Headset,
  Scale,
  LogOut,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Mail,
  Cloud,
  HardDrive,
  Shield,
  Activity,
  Home,
  Zap,
  Database,
  Brain,
  KeyRound,
  FileText,
  Table,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n"

// Badge color palette for different modules
function getBadgeColor(badgeText: string): { bg: string; text: string } {
  const colorMap: Record<string, { bg: string; text: string }> = {
    Lab: { bg: "bg-blue-100", text: "text-blue-700" },
    Order: { bg: "bg-purple-100", text: "text-purple-700" },
    Project: { bg: "bg-indigo-100", text: "text-indigo-700" },
    Ticket: { bg: "bg-cyan-100", text: "text-cyan-700" },
    Master: { bg: "bg-amber-100", text: "text-amber-700" },
    Agent: { bg: "bg-blue-100", text: "text-blue-700" },
    Auth: { bg: "bg-orange-100", text: "text-orange-700" },
    Legal: { bg: "bg-rose-100", text: "text-rose-700" },
    Reg: { bg: "bg-emerald-100", text: "text-emerald-700" },
  }
  return colorMap[badgeText] || { bg: "bg-gray-100", text: "text-gray-700" }
}

/* Icon component wrapper — renders larger in collapsed mode */
function NavIcon({ icon, collapsed, active }: { icon: React.ReactNode; collapsed: boolean; active: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-center rounded-lg transition-all",
      collapsed ? "h-10 w-10" : "h-8 w-8",
      active ? "bg-primary/15" : "group-hover:bg-primary/10"
    )}>
      <span className={cn(
        "transition-all [&>svg]:transition-all",
        collapsed ? "[&>svg]:h-6 [&>svg]:w-6" : "[&>svg]:h-4 [&>svg]:w-4",
        active ? "text-primary" : "text-sidebar-foreground group-hover:text-primary"
      )}>
        {icon}
      </span>
    </div>
  )
}

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  badge?: string
  children?: { id: string; label: string }[]
  // For grouped children like MDM
  childrenGroups?: {
    groupLabel: string
    items: { id: string; label: string }[]
  }[]
}

const mdmChildrenGroups: NonNullable<NavItem["childrenGroups"]> = [
  {
    groupLabel: "Delivery",
    items: [
      { id: "mdm-delivery-org", label: "Delivery Org" },
      { id: "mdm-delivery-office", label: "Delivery Office" },
      { id: "mdm-delivery-team", label: "Delivery Team" },
      { id: "mdm-delivery-channel", label: "Define Delivery Channel" },
    ],
  },
  {
    groupLabel: "Sales",
    items: [
      { id: "mdm-sales-org", label: "Sales Org" },
      { id: "mdm-sales-office", label: "Sales Office" },
      { id: "mdm-sales-team", label: "Sales Team" },
      { id: "mdm-sales-channel", label: "Define Sales Channel" },
    ],
  },
  {
    groupLabel: "Purchase",
    items: [
      { id: "mdm-purchase-org", label: "Purchase Org" },
      { id: "mdm-purchase-office", label: "Purchase Office" },
      { id: "mdm-purchase-team", label: "Purchase Team" },
      { id: "mdm-purchase-channel", label: "Define Purchase Channel" },
    ],
  },
  {
    groupLabel: "Organization",
    items: [
      { id: "mdm-legal-entity", label: "Legal Entity" },
      { id: "mdm-division", label: "Division" },
      { id: "mdm-controlling-area", label: "Controlling Area" },
      { id: "mdm-cost-center-group", label: "Cost Center Group" },
      { id: "mdm-cost-center", label: "Cost Center" },
      { id: "mdm-profit-center", label: "Profit Center" },
      { id: "mdm-credit-area", label: "Credit Area" },
    ],
  },
  {
    groupLabel: "Service Catalog",
    items: [
      { id: "mdm-quotation-preview", label: "Quotation Preview" },
      { id: "mdm-service-domain", label: "Service Domain" },
      { id: "mdm-service-item", label: "Service" },
      { id: "mdm-deliverable", label: "Deliverable" },
      { id: "mdm-service-bom", label: "Service BOM" },
      { id: "mdm-service-bom-line", label: "Service BOM Line" },
      { id: "mdm-bom-applicability-rule", label: "BOM Applicability Rule" },
      { id: "mdm-bom-line-resource", label: "BOM Line Resource" },
      { id: "mdm-cost-rate", label: "Cost Rate" },
      { id: "mdm-activity", label: "Activity" },
    ],
  },
  {
    groupLabel: "Compliance Links",
    items: [
      { id: "mdm-service-item-regulation", label: "Service Item Regulation" },
      { id: "mdm-service-item-standard", label: "Service Item Standard" },
      { id: "mdm-regulation-change-event", label: "Regulation Change Event" },
      { id: "mdm-discovery-feed", label: "Discovery Feed" },
    ],
  },
  {
    groupLabel: "Pricing",
    items: [
      { id: "mdm-price-list", label: "Price List" },
      { id: "mdm-price-list-item", label: "Price List Item" },
    ],
  },
  {
    groupLabel: "Currency",
    items: [
      { id: "mdm-currency", label: "Currency" },
      { id: "mdm-exchange-rate", label: "Exchange Rate" },
    ],
  },
  {
    groupLabel: "Geography",
    items: [
      { id: "mdm-country", label: "Country" },
      { id: "mdm-city", label: "City" },
    ],
  },
  {
    groupLabel: "Product",
    items: [
      { id: "mdm-product-category", label: "HS Code" },
      { id: "mdm-product-line", label: "Product Line" },
      { id: "mdm-feature-of-product", label: "Product Feature" },
    ],
  },
  {
    groupLabel: "Master Data",
    items: [
      { id: "mdm-master-client", label: "Master Client" },
      { id: "mdm-customer", label: "Customer" },
      { id: "mdm-vendor", label: "Vendor" },
      { id: "mdm-material", label: "Material" },
    ],
  },
]

const systemModules: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <Home className="h-4 w-4" />,
  },
  {
    id: "lims",
    label: "LIMS",
    icon: <FlaskConical className="h-4 w-4" />,
    badge: "Lab",
    children: [
      { id: "samples", label: "Sample Management" },
      { id: "tests", label: "Test Tasks" },
      { id: "equipment", label: "Equipment" },
      { id: "reports", label: "Test Reports" },
      { id: "lims-audit", label: "Live Audit" },
    ],
  },
  {
    id: "erp",
    label: "ERP",
    icon: <Package className="h-4 w-4" />,
    badge: "Order",
    children: [
      { id: "orders", label: "Order Management" },
      { id: "quotations", label: "Quotations" },
      { id: "invoices", label: "Invoices" },
      { id: "customers", label: "Customers" },
    ],
  },
  {
    id: "pm",
    label: "PM",
    icon: <FolderKanban className="h-4 w-4" />,
    badge: "Project",
    children: [
      { id: "projects", label: "Project List" },
      { id: "tasks", label: "Task Assignment" },
      { id: "timeline", label: "Timeline" },
      { id: "resources", label: "Resource Allocation" },
    ],
  },
  {
    id: "sd",
    label: "Service Desk",
    icon: <Headset className="h-4 w-4" />,
    badge: "Ticket",
    children: [
      { id: "sd-tickets", label: "Ticket List" },
      { id: "sd-knowledge", label: "Knowledge Base" },
      { id: "sd-ticket-category", label: "Ticket Categories" },
      { id: "sd-sla", label: "SLA Management" },
      { id: "sd-brands", label: "Brands" },
      { id: "sd-ticket-types", label: "Ticket Types" },
      { id: "sd-priorities", label: "Priorities" },
      { id: "sd-tags", label: "Tags" },
      { id: "sd-templates", label: "Templates" },
      { id: "sd-macros", label: "Macros" },
      { id: "sd-worklog-config", label: "Worklog Config" },
      { id: "sd-csat-config", label: "CSAT Config" },
      { id: "sd-email-channels", label: "Email Channels" },
      { id: "sd-signatures", label: "Agent Signatures" },
      { id: "sd-languages", label: "Languages" },
    ],
  },
  {
    id: "mdm",
    label: "MDM",
    icon: <Database className="h-4 w-4" />,
    badge: "Master",
    childrenGroups: mdmChildrenGroups,
  },
  {
    id: "ai",
    label: "AI",
    icon: <Brain className="h-4 w-4" />,
    badge: "Agent",
    children: [
      { id: "ai-settings", label: "Settings" },
      { id: "ai-agents", label: "Agents" },
      { id: "ai-workflow", label: "Workflows" },
      { id: "ai-prompts", label: "Prompts" },
      { id: "ai-skills", label: "Skills" },
      { id: "ai-knowledge", label: "Knowledge" },
      { id: "ai-plugins", label: "Plugins" },
      { id: "ai-datasource", label: "Data Source" },
      { id: "ai-memory", label: "Memory" },
      { id: "ai-usage", label: "Usage" },
      { id: "ai-audit", label: "Audit" },
    ],
  },
  {
    id: "iam",
    label: "IAM",
    icon: <KeyRound className="h-4 w-4" />,
    badge: "Auth",
    children: [
      { id: "iam-users", label: "Users" },
      { id: "iam-roles", label: "Roles" },
      { id: "iam-role-functions", label: "Role Functions" },
      { id: "iam-permissions", label: "Permissions" },
      { id: "iam-audit", label: "Audit" },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: <Shield className="h-4 w-4" />,
    badge: "Reg",
    children: [
      { id: "compliance-dashboard", label: "Dashboard" },
      { id: "compliance-regulation", label: "Regulation" },
      { id: "compliance-standard", label: "Standard" },
      { id: "compliance-requirement", label: "Requirement" },
      { id: "compliance-requirement-service-item", label: "Requirement Service Item" },
    ],
  },
  {
    id: "gma",
    label: "GMA",
    icon: <Scale className="h-4 w-4" />,
    badge: "Legal",
    children: [
      { id: "regulations", label: "Regulations" },
      { id: "standards", label: "Standards" },
      { id: "gma-compliance", label: "Compliance Check" },
    ],
  },
]

const connectors: NavItem[] = [
  {
    id: "document-editor",
    label: "Document Editor",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "spreadsheet-editor",
    label: "Spreadsheet Editor",
    icon: <Table className="h-4 w-4" />,
  },
  {
    id: "pdf-generator",
    label: "PDF Generator",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "teams",
    label: "Teams/WeChat/Feishu",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    id: "mail",
    label: "Microsoft Mail",
    icon: <Mail className="h-4 w-4" />,
  },
  {
    id: "cloud",
    label: "Cloud Storage",
    icon: <Cloud className="h-4 w-4" />,
  },
  {
    id: "local",
    label: "Local Storage",
    icon: <HardDrive className="h-4 w-4" />,
  },
]

interface SidebarProps {
  activeItem: string
  onSelectItem: (id: string) => void
  collapsed: boolean
}

export function Sidebar({ activeItem, onSelectItem, collapsed }: SidebarProps) {
  const { tx } = useT()
  const [expandedItems, setExpandedItems] = useState<string[]>(["lims"])
  const [foldedGroups, setFoldedGroups] = useState<string[]>([])
  const [expandedChildGroups, setExpandedChildGroups] = useState<string[]>([])
  const [sidebarAvatar, setSidebarAvatar] = useState<string | null>(null)
  const [sidebarDisplayName, setSidebarDisplayName] = useState("Demo User")

  useEffect(() => {
    const av = window.localStorage.getItem("hermes.avatar")
    if (av) setSidebarAvatar(av)
    const dn = window.localStorage.getItem("hermes.displayName")
    if (dn) setSidebarDisplayName(dn)
  }, [])

  useEffect(() => {
    if (activeItem.startsWith("compliance-") || activeItem === "compliance") {
      setExpandedItems((prev) => (prev.includes("compliance") ? prev : [...prev, "compliance"]))
    }
  }, [activeItem])

  useEffect(() => {
    if (activeItem.startsWith("ai-") || activeItem === "ai") {
      setExpandedItems((prev) => (prev.includes("ai") ? prev : [...prev, "ai"]))
    }
  }, [activeItem])

  useEffect(() => {
    if (activeItem.startsWith("iam-") || activeItem === "iam") {
      setExpandedItems((prev) => (prev.includes("iam") ? prev : [...prev, "iam"]))
    }
  }, [activeItem])

  useEffect(() => {
    if (!activeItem.startsWith("mdm-") && activeItem !== "mdm") return
    setExpandedItems((prev) => (prev.includes("mdm") ? prev : [...prev, "mdm"]))

    const activeGroup = mdmChildrenGroups.find((group) =>
      group.items.some((child) => child.id === activeItem)
    )
    if (!activeGroup) return

    const groupKey = `mdm-${activeGroup.groupLabel}`
    setExpandedChildGroups((prev) => (prev.includes(groupKey) ? prev : [...prev, groupKey]))
  }, [activeItem])

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleGroup = (group: string) => {
    setFoldedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    )
  }

  const toggleChildGroup = (groupKey: string) => {
    setExpandedChildGroups((prev) =>
      prev.includes(groupKey) ? prev.filter((g) => g !== groupKey) : [...prev, groupKey]
    )
  }

  /* Helper: is this top-level module the active one (or contains the active child) */
  const isModuleActive = (item: NavItem) => {
    if (activeItem === item.id) return true
    if (item.children?.some((c) => c.id === activeItem)) return true
    if (item.childrenGroups?.some((g) => g.items.some((c) => c.id === activeItem))) return true
    return false
  }

  /* ─── COLLAPSED VIEW (YouTube-style icon rail) ─── */
  if (collapsed) {
    return (
      <aside className="flex h-full w-[72px] flex-col border-r border-border bg-sidebar">
        {/* Logo icon only */}
        <div className="flex items-center justify-center border-b border-border py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>

        {/* Icon rail */}
        <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
          {/* System modules */}
          {systemModules.map((item) => {
            const active = isModuleActive(item)
            return (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                title={tx(item.label)}
                className={cn(
                  "group flex w-full flex-col items-center gap-0.5 px-1 py-2 transition-colors",
                  active
                    ? "text-primary"
                    : "text-sidebar-foreground hover:text-primary"
                )}
              >
                <NavIcon icon={item.icon} collapsed active={active} />
                <span className={cn(
                  "text-[10px] leading-tight text-center",
                  active ? "font-semibold text-primary" : "text-muted-foreground group-hover:text-primary"
                )}>
                  {tx(item.label)}
                </span>
              </button>
            )
          })}

          {/* Separator */}
          <div className="mx-3 my-2 border-t border-border" />

          {/* Connectors */}
          {connectors.map((item) => {
            const active = activeItem === item.id
            return (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                title={tx(item.label)}
                className={cn(
                  "group flex w-full flex-col items-center gap-0.5 px-1 py-2 transition-colors",
                  active
                    ? "text-primary"
                    : "text-sidebar-foreground hover:text-primary"
                )}
              >
                <NavIcon icon={item.icon} collapsed active={active} />
                <span className={cn(
                  "text-[10px] leading-tight text-center truncate w-full",
                  active ? "font-semibold text-primary" : "text-muted-foreground group-hover:text-primary"
                )}>
                  {tx(item.label).split("/")[0]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Bottom: user profile + sign out */}
        <div className="flex flex-col items-center gap-1 border-t border-border py-3">
          <a
            href="/config?tab=profile"
            className="rounded-lg p-1 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            title="Profile & Settings"
          >
            {sidebarAvatar ? (
              <img src={sidebarAvatar} alt="Avatar" className="h-6 w-6 rounded-full object-cover ring-1 ring-border" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {sidebarDisplayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
          </a>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" })
              window.location.href = "/login"
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>
    )
  }

  /* ─── EXPANDED VIEW ─── */
  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">Hermes</h1>
          <p className="text-xs text-muted-foreground">TIC Enterprise</p>
        </div>
      </div>

      {/* System Modules */}
      <div className="flex-1 overflow-y-auto px-2 py-4 scrollbar-hide">
        <button
          onClick={() => toggleGroup("system")}
          className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent/30"
        >
          <span>System Modules</span>
          {foldedGroups.includes("system") ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
        {!foldedGroups.includes("system") && (
        <nav className="space-y-1 rounded-lg bg-sidebar-accent/20 p-1">
          {systemModules.map((item) => {
            const active = isModuleActive(item)
            return (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (item.children || item.childrenGroups) {
                    toggleExpand(item.id)
                  }
                  onSelectItem(item.id)
                }}
                className={cn(
                  "group flex w-full items-center justify-between rounded-md px-2 py-2 text-sm transition-all duration-150",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary"
                )}
              >
                <div className="flex items-center gap-2">
                  <NavIcon icon={item.icon} collapsed={false} active={active} />
                  <span>{tx(item.label)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", getBadgeColor(item.badge).bg, getBadgeColor(item.badge).text)}>
                      {item.badge}
                    </span>
                  )}
                  {(item.children || item.childrenGroups) && (
                    <>
                      {expandedItems.includes(item.id) ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </>
                  )}
                </div>
              </button>
              {item.children && expandedItems.includes(item.id) && (
                <div className="ml-6 mt-1 space-y-1 border-l border-border pl-2">
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => onSelectItem(child.id)}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                        activeItem === child.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      {tx(child.label)}
                    </button>
                  ))}
                </div>
              )}
              {/* Grouped children (e.g., MDM) */}
              {item.childrenGroups && expandedItems.includes(item.id) && (
                <div className="ml-6 mt-1 space-y-1 border-l border-border pl-2">
                  {item.childrenGroups.map((group) => {
                    const groupKey = `${item.id}-${group.groupLabel}`
                    const isExpanded = expandedChildGroups.includes(groupKey)
                    return (
                      <div key={groupKey}>
                        <button
                          onClick={() => toggleChildGroup(groupKey)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                        >
                          <span>{tx(group.groupLabel)}</span>
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="ml-2 mt-1 space-y-0.5 rounded-md bg-sidebar-accent/10 p-1">
                            {group.items.map((child) => (
                              <button
                                key={child.id}
                                onClick={() => onSelectItem(child.id)}
                                className={cn(
                                  "w-full rounded-md px-2 py-1 text-left text-xs transition-colors",
                                  activeItem === child.id
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                                )}
                              >
                                {tx(child.label)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )
          })}
        </nav>
        )}

        {/* Enterprise Connectors */}
        <button
          onClick={() => toggleGroup("connectors")}
          className="mb-2 mt-6 flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent/30"
        >
          <span>Enterprise Connectors</span>
          {foldedGroups.includes("connectors") ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
        {!foldedGroups.includes("connectors") && (
        <nav className="space-y-1 rounded-lg bg-sidebar-accent/20 p-1">
          {connectors.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-all duration-150",
                activeItem === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary"
              )}
            >
              <NavIcon icon={item.icon} collapsed={false} active={activeItem === item.id} />
              <span>{tx(item.label)}</span>
            </button>
          ))}
        </nav>
        )}
      </div>

      {/* Bottom Section — User Profile + Sign Out */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-1">
          <a
            href="/config?tab=profile"
            className="flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            {sidebarAvatar ? (
              <img src={sidebarAvatar} alt="Avatar" className="h-7 w-7 rounded-full object-cover ring-2 ring-border" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {sidebarDisplayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-left">
              <p className="text-xs font-medium text-sidebar-foreground">{sidebarDisplayName}</p>
              <p className="text-[10px] text-muted-foreground">Profile & Settings</p>
            </div>
          </a>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" })
              window.location.href = "/login"
            }}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
