"use client"

import { useState } from "react"
import {
  Package,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  MoreVertical,
  Plus,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Order {
  id: string
  customer: string
  type: string
  amount: string
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled"
  date: string
  dueDate: string
}

interface Quote {
  id: string
  customer: string
  services: string
  value: string
  status: "draft" | "sent" | "accepted" | "rejected"
  validUntil: string
}

const mockOrders: Order[] = [
  { id: "ORD-2024-0892", customer: "TechCorp Ltd", type: "Testing Service", amount: "$12,500", status: "in-progress", date: "2024-01-15", dueDate: "2024-02-15" },
  { id: "ORD-2024-0891", customer: "Global Motors", type: "Certification", amount: "$8,750", status: "pending", date: "2024-01-14", dueDate: "2024-02-10" },
  { id: "ORD-2024-0890", customer: "ElectroParts Inc", type: "Inspection", amount: "$4,200", status: "confirmed", date: "2024-01-13", dueDate: "2024-01-25" },
  { id: "ORD-2024-0889", customer: "SafetyFirst Co", type: "Testing Service", amount: "$15,800", status: "completed", date: "2024-01-12", dueDate: "2024-01-20" },
  { id: "ORD-2024-0888", customer: "MediDevice AG", type: "CE Marking", amount: "$22,000", status: "in-progress", date: "2024-01-11", dueDate: "2024-03-01" },
]

const mockQuotes: Quote[] = [
  { id: "QT-2024-0156", customer: "NewTech Solutions", services: "EMC + Safety Testing", value: "$18,500", status: "sent", validUntil: "2024-02-01" },
  { id: "QT-2024-0155", customer: "AutoParts GmbH", services: "Full Certification Package", value: "$45,000", status: "draft", validUntil: "2024-02-15" },
  { id: "QT-2024-0154", customer: "SmartHome Inc", services: "Wireless Testing", value: "$8,200", status: "accepted", validUntil: "2024-01-30" },
]

const kpiCards = [
  { label: "Monthly Orders", value: "156", change: "+12%", changeType: "up" as const, icon: <Package className="h-5 w-5" /> },
  { label: "Revenue MTD", value: "$428K", change: "+8%", changeType: "up" as const, icon: <DollarSign className="h-5 w-5" /> },
  { label: "Pending Quotes", value: "8", change: "-2", changeType: "down" as const, icon: <FileText className="h-5 w-5" /> },
  { label: "Collection Rate", value: "92%", change: "+3%", changeType: "up" as const, icon: <TrendingUp className="h-5 w-5" /> },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
    case "accepted":
      return "bg-green-100 text-green-700"
    case "in-progress":
    case "sent":
      return "bg-blue-100 text-blue-700"
    case "pending":
    case "draft":
      return "bg-amber-100 text-amber-700"
    case "confirmed":
      return "bg-purple-100 text-purple-700"
    case "cancelled":
    case "rejected":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

export function ErpContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<"orders" | "quotes" | "invoices">("orders")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">ERP Order Management</h1>
              <p className="text-sm text-muted-foreground">Manage orders, quotes, and invoices</p>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New Order
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  {kpi.icon}
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  kpi.changeType === "up" ? "text-green-600" : kpi.changeType === "down" ? "text-red-600" : "text-muted-foreground"
                )}>
                  {kpi.changeType === "up" ? <ArrowUpRight className="h-3 w-3" /> : kpi.changeType === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
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
            { id: "orders", label: "Orders", count: 156 },
            { id: "quotes", label: "Quotes", count: 8 },
            { id: "invoices", label: "Invoices", count: 42 },
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
        {activeTab === "orders" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{order.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{order.customer}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.type}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{order.amount}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(order.status))}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.dueDate}</td>
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

        {activeTab === "quotes" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Quote ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Services</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Valid Until</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockQuotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{quote.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{quote.customer}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{quote.services}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{quote.value}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(quote.status))}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{quote.validUntil}</td>
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

        {activeTab === "invoices" && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <div className="text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Invoice management coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
