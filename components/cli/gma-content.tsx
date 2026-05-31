"use client"

import { useState } from "react"
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
  Search,
  Filter,
  MoreVertical,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
      return "bg-green-100 text-green-700"
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
  if (rate >= 95) return "bg-green-500"
  if (rate >= 80) return "bg-amber-500"
  return "bg-red-500"
}

export function GmaContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<"regulations" | "compliance" | "countries">("regulations")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
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
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Regulation
          </button>
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
                    ? (kpi.changeType === "down" ? "text-green-600" : "text-red-600")
                    : (kpi.changeType === "up" ? "text-green-600" : "text-red-600")
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

      {/* Search and Filter */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "regulations" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Regulation ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Compliance</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockRegulations.map((reg) => (
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
                  <th className="px-4 py-3">Check ID</th>
                  <th className="px-4 py-3">Regulation</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Findings</th>
                  <th className="px-4 py-3">Checked Date</th>
                  <th className="px-4 py-3">Next Review</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockComplianceChecks.map((check) => (
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
                        check.findings === 0 ? "text-green-600" : check.findings < 3 ? "text-amber-600" : "text-red-600"
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
  )
}
