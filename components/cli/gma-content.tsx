"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Scale,
  Globe,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Plus,
  Filter,
  MoreVertical,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"
import { WorkbenchCard } from "@/components/ui/workbench-card"
import { QueryBuilder, QBField, QBGroup, createDefaultQuery } from "@/components/ui/query-builder"

interface Regulation {
  id: string
  name: string
  region: string
  category: string
  status: "active" | "pending" | "expired" | "draft"
  effectiveDate: string
  lastUpdated: string
  complianceRate: number
}

interface ComplianceCheck {
  id: string
  regulation: string
  product: string
  result: "compliant" | "non-compliant" | "pending-review"
  checkedDate: string
  nextReview: string
  findings: number
}

const mockRegulations: Regulation[] = [
  { id: "REG-EU-001", name: "CE Marking Directive 2014/30/EU", region: "European Union", category: "EMC", status: "active", effectiveDate: "2014-04-18", lastUpdated: "2024-01-10", complianceRate: 98 },
  { id: "REG-US-001", name: "FCC Part 15 - Radio Frequency Devices", region: "United States", category: "RF/Wireless", status: "active", effectiveDate: "2020-01-01", lastUpdated: "2024-01-05", complianceRate: 95 },
  { id: "REG-CN-001", name: "CCC Certification Requirements", region: "China", category: "Safety", status: "active", effectiveDate: "2022-07-01", lastUpdated: "2024-01-12", complianceRate: 92 },
  { id: "REG-JP-001", name: "PSE Mark - Electrical Appliance Safety", region: "Japan", category: "Safety", status: "active", effectiveDate: "2021-04-01", lastUpdated: "2023-12-20", complianceRate: 100 },
  { id: "REG-UK-001", name: "UKCA Marking Requirements", region: "United Kingdom", category: "General", status: "active", effectiveDate: "2023-01-01", lastUpdated: "2024-01-08", complianceRate: 88 },
]

const mockComplianceChecks: ComplianceCheck[] = [
  { id: "CHK-001", regulation: "CE Marking Directive", product: "Smart Controller v2.0", result: "compliant", checkedDate: "2024-01-14", nextReview: "2024-07-14", findings: 0 },
  { id: "CHK-002", regulation: "FCC Part 15", product: "Wireless Sensor Module", result: "pending-review", checkedDate: "2024-01-13", nextReview: "2024-01-20", findings: 2 },
  { id: "CHK-003", regulation: "CCC Certification", product: "Power Supply Unit", result: "non-compliant", checkedDate: "2024-01-12", nextReview: "2024-02-01", findings: 5 },
  { id: "CHK-004", regulation: "PSE Mark", product: "LED Driver Module", result: "compliant", checkedDate: "2024-01-10", nextReview: "2024-07-10", findings: 0 },
]

const kpiCards = [
  { label: "Total Regulations", value: "1,234", change: "+23", changeType: "up" as const, icon: <BookOpen className="h-5 w-5" /> },
  { label: "Monthly Updates", value: "23", change: "+5", changeType: "up" as const, icon: <TrendingUp className="h-5 w-5" /> },
  { label: "Compliance Rate", value: "94%", change: "+2%", changeType: "up" as const, icon: <Shield className="h-5 w-5" /> },
  { label: "Pending Reviews", value: "12", change: "-3", changeType: "down" as const, icon: <Clock className="h-5 w-5" /> },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
    case "compliant":
      return "bg-blue-100 text-blue-700"
    case "pending":
    case "pending-review":
      return "bg-amber-100 text-amber-700"
    case "expired":
    case "non-compliant":
      return "bg-red-100 text-red-700"
    case "draft":
      return "bg-gray-100 text-gray-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

const getComplianceColor = (rate: number) => {
  if (rate >= 95) return "bg-blue-500"
  if (rate >= 80) return "bg-amber-500"
  return "bg-red-500"
}

export function GmaContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<"regulations" | "compliance" | "countries">("regulations")
  const [searchQuery, setSearchQuery] = useState("")
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [queryGroup, setQueryGroup] = useState<QBGroup>(() => createDefaultQuery([]))
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterMenuColumn, setFilterMenuColumn] = useState<string | null>(null)

  useEffect(() => {
    setShowLeftPanel(false)
  }, [activeTab])

  const filteredRegulations = useMemo(() => {
    return mockRegulations.filter((reg) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesSearch = reg.id.toLowerCase().includes(q) ||
          reg.name.toLowerCase().includes(q) ||
          reg.region.toLowerCase().includes(q) ||
          reg.category.toLowerCase().includes(q) ||
          reg.status.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }
      return Object.entries(columnFilters).every(([key, filterValue]) => {
        if (!filterValue) return true
        const v = filterValue.toLowerCase()
        switch (key) {
          case "id": return reg.id.toLowerCase().includes(v)
          case "name": return reg.name.toLowerCase().includes(v)
          case "region": return reg.region.toLowerCase().includes(v)
          case "category": return reg.category.toLowerCase().includes(v)
          case "status": return reg.status.toLowerCase().includes(v)
          case "complianceRate": return String(reg.complianceRate).includes(v)
          case "lastUpdated": return reg.lastUpdated.toLowerCase().includes(v)
          default: return true
        }
      })
    })
  }, [searchQuery, columnFilters])

  const filteredComplianceChecks = useMemo(() => {
    return mockComplianceChecks.filter((check) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesSearch = check.id.toLowerCase().includes(q) ||
          check.regulation.toLowerCase().includes(q) ||
          check.product.toLowerCase().includes(q) ||
          check.result.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }
      return Object.entries(columnFilters).every(([key, filterValue]) => {
        if (!filterValue) return true
        const v = filterValue.toLowerCase()
        switch (key) {
          case "id": return check.id.toLowerCase().includes(v)
          case "regulation": return check.regulation.toLowerCase().includes(v)
          case "product": return check.product.toLowerCase().includes(v)
          case "result": return check.result.toLowerCase().includes(v)
          case "findings": return String(check.findings).includes(v)
          case "checkedDate": return check.checkedDate.toLowerCase().includes(v)
          case "nextReview": return check.nextReview.toLowerCase().includes(v)
          default: return true
        }
      })
    })
  }, [searchQuery, columnFilters])

  const renderFilterableHeader = (label: string, dataKey: string) => (
    <th className="relative px-4 py-3">
      <div className="flex items-center gap-1">
        {label}
        <button
          onClick={() => setFilterMenuColumn(filterMenuColumn === dataKey ? null : dataKey)}
          className={cn(
            "rounded p-0.5 hover:bg-muted",
            columnFilters[dataKey] ? "text-primary" : "text-muted-foreground/50"
          )}
        >
          <Filter className="h-3 w-3" />
        </button>
      </div>
      {filterMenuColumn === dataKey && (
        <ColumnFilterPopover
          column={dataKey}
          label={label}
          value={columnFilters[dataKey] ?? ""}
          onChange={(val) => setColumnFilters((prev) => ({ ...prev, [dataKey]: val }))}
          onClear={() => setColumnFilters((prev) => { const next = { ...prev }; delete next[dataKey]; return next })}
          onClose={() => setFilterMenuColumn(null)}
        />
      )}
    </th>
  )

  const queryFields: QBField[] = activeTab === "compliance"
    ? [
        { field: "id", label: "Check ID", type: "string" },
        { field: "regulation", label: "Regulation", type: "string" },
        { field: "product", label: "Product", type: "string" },
        { field: "result", label: "Result", type: "select", options: ["compliant", "non-compliant", "pending-review"] },
        { field: "findings", label: "Findings", type: "number" },
        { field: "checkedDate", label: "Checked Date", type: "date" },
        { field: "nextReview", label: "Next Review", type: "date" },
      ]
    : [
        { field: "id", label: "Regulation ID", type: "string" },
        { field: "name", label: "Name", type: "string" },
        { field: "region", label: "Region", type: "string" },
        { field: "category", label: "Category", type: "string" },
        { field: "status", label: "Status", type: "select", options: ["active", "pending", "expired", "draft"] },
        { field: "complianceRate", label: "Compliance", type: "number" },
        { field: "lastUpdated", label: "Last Updated", type: "date" },
      ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">GMA Market Access</h1>
              <p className="text-sm text-muted-foreground">Global regulations and compliance management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeftPanel((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${showLeftPanel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              Query
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Add Regulation
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  {kpi.icon}
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  kpi.label === "Pending Reviews"
                    ? (kpi.changeType === "down" ? "text-blue-600" : "text-red-600")
                    : (kpi.changeType === "up" ? "text-blue-600" : "text-red-600")
                )}>
                  {kpi.changeType === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.change}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex gap-6">
          {[
            { id: "regulations", label: "Regulations", count: 1234 },
            { id: "compliance", label: "Compliance Checks", count: 89 },
            { id: "countries", label: "Countries", count: 120 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content with Query panel */}
      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto">
        {showLeftPanel && (
          <aside className="relative w-[342px] shrink-0 space-y-3 self-stretch overflow-y-auto overflow-x-hidden p-4">
            <WorkbenchCard title="Query Conditions" badge={`${queryGroup.conditions.length + queryGroup.groups.length} rules`}>
              <QueryBuilder fields={queryFields} query={queryGroup} onChange={setQueryGroup} storageKey={`qb.gma.${activeTab}`} />
            </WorkbenchCard>
          </aside>
        )}
        <div className="flex-1 overflow-auto p-6">
        {activeTab === "regulations" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  {renderFilterableHeader("Regulation ID", "id")}
                  {renderFilterableHeader("Name", "name")}
                  {renderFilterableHeader("Region", "region")}
                  {renderFilterableHeader("Category", "category")}
                  {renderFilterableHeader("Status", "status")}
                  {renderFilterableHeader("Compliance", "complianceRate")}
                  {renderFilterableHeader("Last Updated", "lastUpdated")}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegulations.map((reg) => (
                  <tr key={reg.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{reg.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-[250px] truncate">{reg.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" />
                        {reg.region}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{reg.category}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(reg.status))}>
                        {reg.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", getComplianceColor(reg.complianceRate))}
                            style={{ width: `${reg.complianceRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{reg.complianceRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{reg.lastUpdated}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "compliance" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  {renderFilterableHeader("Check ID", "id")}
                  {renderFilterableHeader("Regulation", "regulation")}
                  {renderFilterableHeader("Product", "product")}
                  {renderFilterableHeader("Result", "result")}
                  {renderFilterableHeader("Findings", "findings")}
                  {renderFilterableHeader("Checked Date", "checkedDate")}
                  {renderFilterableHeader("Next Review", "nextReview")}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplianceChecks.map((check) => (
                  <tr key={check.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{check.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{check.regulation}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{check.product}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(check.result))}>
                        {check.result}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-sm font-medium",
                        check.findings === 0 ? "text-blue-600" : check.findings < 3 ? "text-amber-600" : "text-red-600"
                      )}>
                        {check.findings}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{check.checkedDate}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{check.nextReview}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "countries" && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <div className="text-center">
              <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Country-specific regulations coming soon</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}


