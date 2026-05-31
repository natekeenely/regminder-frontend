"use client"

import { useState } from "react"
import {
  Headset,
  TicketIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Ticket {
  id: string
  subject: string
  requester: string
  category: string
  priority: "urgent" | "high" | "medium" | "low"
  status: "open" | "in-progress" | "pending" | "resolved" | "closed"
  assignee: string
  createdAt: string
  lastUpdate: string
}

const mockTickets: Ticket[] = [
  { id: "TKT-2024-0456", subject: "Cannot access test results portal", requester: "john@techcorp.com", category: "Access Issue", priority: "high", status: "in-progress", assignee: "Support Agent A", createdAt: "2024-01-15 09:30", lastUpdate: "10 min ago" },
  { id: "TKT-2024-0455", subject: "Certificate download not working", requester: "sarah@globalmotors.com", category: "Technical", priority: "urgent", status: "open", assignee: "Unassigned", createdAt: "2024-01-15 08:45", lastUpdate: "45 min ago" },
  { id: "TKT-2024-0454", subject: "Request for expedited testing", requester: "mike@safetyfirst.com", category: "Service Request", priority: "medium", status: "pending", assignee: "Support Agent B", createdAt: "2024-01-14 16:20", lastUpdate: "2 hours ago" },
  { id: "TKT-2024-0453", subject: "Billing inquiry for Q4 services", requester: "finance@electroparts.com", category: "Billing", priority: "low", status: "resolved", assignee: "Support Agent C", createdAt: "2024-01-14 14:10", lastUpdate: "4 hours ago" },
  { id: "TKT-2024-0452", subject: "Schedule change request for inspection", requester: "ops@medidevice.com", category: "Scheduling", priority: "medium", status: "in-progress", assignee: "Support Agent A", createdAt: "2024-01-14 11:30", lastUpdate: "6 hours ago" },
]

const kpiCards = [
  { label: "Open Tickets", value: "15", change: "+3", changeType: "up" as const, icon: <TicketIcon className="h-5 w-5" /> },
  { label: "Avg Response", value: "2.5h", change: "-30m", changeType: "down" as const, icon: <Timer className="h-5 w-5" /> },
  { label: "Resolution Rate", value: "94%", change: "+2%", changeType: "up" as const, icon: <CheckCircle2 className="h-5 w-5" /> },
  { label: "Satisfaction", value: "96%", change: "+1%", changeType: "up" as const, icon: <Star className="h-5 w-5" /> },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "resolved":
    case "closed":
      return "bg-green-100 text-green-700"
    case "in-progress":
      return "bg-blue-100 text-blue-700"
    case "open":
      return "bg-cyan-100 text-cyan-700"
    case "pending":
      return "bg-amber-100 text-amber-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700"
    case "high":
      return "bg-orange-100 text-orange-700"
    case "medium":
      return "bg-amber-100 text-amber-700"
    case "low":
      return "bg-green-100 text-green-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

export function SdContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<"tickets" | "knowledge" | "reports">("tickets")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const filteredTickets = mockTickets.filter(ticket => {
    if (filterStatus !== "all" && ticket.status !== filterStatus) return false
    if (searchQuery && !ticket.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
              <Headset className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">SD Service Desk</h1>
              <p className="text-sm text-muted-foreground">Manage support tickets and customer requests</p>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                  {kpi.icon}
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  kpi.label === "Avg Response" 
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
            { id: "tickets", label: "Tickets", count: 15 },
            { id: "knowledge", label: "Knowledge Base", count: 234 },
            { id: "reports", label: "Reports", count: null },
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
              {tab.count !== null && (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
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
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
          <Filter className="h-4 w-4" />
          More Filters
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "tickets" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Ticket ID</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Last Update</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{ticket.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate">{ticket.subject}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.requester}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.category}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getPriorityColor(ticket.priority))}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusColor(ticket.status))}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.assignee}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.lastUpdate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <MessageSquare className="h-4 w-4" />
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

        {activeTab === "knowledge" && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <div className="text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Knowledge base coming soon</p>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <div className="text-center">
              <ThumbsUp className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Service desk reports coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
