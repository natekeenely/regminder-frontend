"use client"

import { useState } from "react"
import {
  FlaskConical,
  Package,
  FolderKanban,
  Headset,
  Scale,
  Settings,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Mail,
  Cloud,
  HardDrive,
  Shield,
  Activity,
  Home,
  Users,
  Zap,
  Database,
  Brain,
  KeyRound,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Badge color palette for different modules
function getBadgeColor(badgeText: string): { bg: string; text: string } {
  const colorMap: Record<string, { bg: string; text: string }> = {
    Lab: { bg: "bg-blue-100", text: "text-blue-700" },
    Order: { bg: "bg-purple-100", text: "text-purple-700" },
    Project: { bg: "bg-indigo-100", text: "text-indigo-700" },
    Ticket: { bg: "bg-cyan-100", text: "text-cyan-700" },
    Master: { bg: "bg-amber-100", text: "text-amber-700" },
    Agent: { bg: "bg-green-100", text: "text-green-700" },
    Auth: { bg: "bg-orange-100", text: "text-orange-700" },
    Legal: { bg: "bg-rose-100", text: "text-rose-700" },
  }
  return colorMap[badgeText] || { bg: "bg-gray-100", text: "text-gray-700" }
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
      { id: "tickets", label: "Ticket List" },
      { id: "sla", label: "SLA Management" },
      { id: "kb", label: "Knowledge Base" },
    ],
  },
  {
    id: "mdm",
    label: "MDM",
    icon: <Database className="h-4 w-4" />,
    badge: "Master",
    childrenGroups: [
      {
        groupLabel: "Delivery",
        items: [
          { id: "mdm-delivery-org", label: "Delivery Org" },
          { id: "mdm-delivery-office", label: "Delivery Office" },
          { id: "mdm-delivery-team", label: "Delivery Team" },
        ],
      },
      {
        groupLabel: "Sales",
        items: [
          { id: "mdm-sales-org", label: "Sales Org" },
          { id: "mdm-sales-office", label: "Sales Office" },
          { id: "mdm-sales-team", label: "Sales Team" },
        ],
      },
      {
        groupLabel: "Purchase",
        items: [
          { id: "mdm-purchase-org", label: "Purchase Org" },
          { id: "mdm-purchase-office", label: "Purchase Office" },
          { id: "mdm-purchase-team", label: "Purchase Team" },
        ],
      },
      {
        groupLabel: "Organization",
        items: [
          { id: "mdm-legal-entity", label: "Legal Entity" },
          { id: "mdm-division", label: "Division" },
          { id: "mdm-cost-center", label: "Cost Center" },
          { id: "mdm-credit-area", label: "Credit Area" },
          { id: "mdm-org-mapping-set", label: "Org Mapping Set" },
          { id: "mdm-org-mapping-line", label: "Org Mapping Line" },
        ],
      },
      {
        groupLabel: "Service Catalog",
        items: [
          { id: "mdm-service-item", label: "Service Item" },
          { id: "mdm-service-bom", label: "Service BOM" },
          { id: "mdm-service-bom-line", label: "Service BOM Line" },
          { id: "mdm-activity", label: "Activity" },
        ],
      },
      {
        groupLabel: "Compliance",
        items: [
          { id: "mdm-regulation", label: "Regulation" },
          { id: "mdm-standard", label: "Standard" },
          { id: "mdm-service-item-regulation", label: "Service Item Regulation" },
          { id: "mdm-service-item-standard", label: "Service Item Standard" },
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
          { id: "mdm-region", label: "Region" },
          { id: "mdm-city", label: "City" },
        ],
      },
      {
        groupLabel: "Master Data",
        items: [
          { id: "mdm-customer", label: "Customer" },
          { id: "mdm-vendor", label: "Vendor" },
          { id: "mdm-product", label: "Product" },
          { id: "mdm-material", label: "Material" },
        ],
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    icon: <Brain className="h-4 w-4" />,
    badge: "Agent",
    children: [
      { id: "ai-skills", label: "Skills" },
      { id: "ai-memory", label: "Memory" },
      { id: "ai-audit", label: "Execution Audit" },
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
      { id: "iam-permissions", label: "Permissions" },
      { id: "iam-audit", label: "Audit" },
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
      { id: "compliance", label: "Compliance Check" },
    ],
  },
]

const connectors: NavItem[] = [
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
}

export function Sidebar({ activeItem, onSelectItem }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>(["lims"])
  const [foldedGroups, setFoldedGroups] = useState<string[]>([])
  const [expandedChildGroups, setExpandedChildGroups] = useState<string[]>([])

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
      <div className="flex-1 overflow-y-auto px-2 py-4">
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
          {systemModules.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (item.children || item.childrenGroups) {
                    toggleExpand(item.id)
                  }
                  onSelectItem(item.id)
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-sm transition-all duration-150",
                  activeItem === item.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary"
                )}
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
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
                      {child.label}
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
                          <span>{group.groupLabel}</span>
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
                                {child.label}
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
          ))}
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
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-all duration-150",
                activeItem === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        )}
      </div>

      {/* Bottom Section */}
      <div className="border-t border-border p-2">
        <div className="mb-2 flex items-center gap-2 rounded-md bg-success/10 px-3 py-2">
          <Activity className="h-4 w-4 text-success" />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">Hermes Agent</p>
            <p className="text-[10px] text-muted-foreground">Running - 8 tools</p>
          </div>
          <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
        </div>
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
            <Shield className="h-4 w-4" />
            <span>Permissions</span>
          </button>
          <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
            <Users className="h-4 w-4" />
            <span>Tenants</span>
          </button>
          <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
