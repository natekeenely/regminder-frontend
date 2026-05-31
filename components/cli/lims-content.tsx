"use client"

import { useState } from "react"
import {
  FlaskConical,
  TestTube,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  MoreVertical,
  Plus,
  Eye,
  Microscope,
  Beaker,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Sample {
  id: string
  name: string
  client: string
  testType: string
  status: "received" | "in-testing" | "review" | "completed" | "rejected"
  receivedDate: string
  dueDate: string
  priority: "normal" | "urgent" | "rush"
}

interface TestResult {
  id: string
  sampleId: string
  testName: string
  result: string
  status: "pass" | "fail" | "pending"
  analyst: string
  completedDate: string
}

const mockSamples: Sample[] = [
  { id: "SMP-2024-1892", name: "Electronic Component A", client: "TechCorp Ltd", testType: "EMC Testing", status: "in-testing", receivedDate: "2024-01-15", dueDate: "2024-01-25", priority: "urgent" },
  { id: "SMP-2024-1891", name: "Power Supply Unit", client: "Global Motors", testType: "Safety Testing", status: "received", receivedDate: "2024-01-14", dueDate: "2024-01-28", priority: "normal" },
  { id: "SMP-2024-1890", name: "Medical Device Sensor", client: "MediDevice AG", testType: "Biocompatibility", status: "review", receivedDate: "2024-01-13", dueDate: "2024-01-20", priority: "rush" },
  { id: "SMP-2024-1889", name: "Wireless Module", client: "SmartHome Inc", testType: "RF Testing", status: "completed", receivedDate: "2024-01-12", dueDate: "2024-01-18", priority: "normal" },
  { id: "SMP-2024-1888", name: "Battery Pack", client: "ElectroParts Inc", testType: "Environmental", status: "in-testing", receivedDate: "2024-01-11", dueDate: "2024-01-22", priority: "urgent" },
]

const mockResults: TestResult[] = [
  { id: "TST-0892", sampleId: "SMP-2024-1889", testName: "Radiated Emissions", result: "Within limits", status: "pass", analyst: "Dr. Chen", completedDate: "2024-01-17" },
  { id: "TST-0891", sampleId: "SMP-2024-1889", testName: "Conducted Emissions", result: "Within limits", status: "pass", analyst: "Dr. Chen", completedDate: "2024-01-17" },
  { id: "TST-0890", sampleId: "SMP-2024-1890", testName: "Cytotoxicity", result: "Pending review", status: "pending", analyst: "Dr. Martinez", completedDate: "2024-01-16" },
  { id: "TST-0889", sampleId: "SMP-2024-1892", testName: "ESD Immunity", result: "8kV contact pass", status: "pass", analyst: "Dr. Kim", completedDate: "2024-01-15" },
]

const kpiCards = [
  { label: "Tests In Progress", value: "34", change: "+5", changeType: "up" as const, icon: <TestTube className="h-5 w-5" /> },
  { label: "Pending Samples", value: "12", change: "-3", changeType: "down" as const, icon: <FlaskConical className="h-5 w-5" /> },
  { label: "Completed Today", value: "8", change: "+2", changeType: "up" as const, icon: <CheckCircle2 className="h-5 w-5" /> },
  { label: "Equipment Utilization", value: "78%", change: "+4%", changeType: "up" as const, icon: <Microscope className="h-5 w-5" /> },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
    case "pass":
      return "bg-green-100 text-green-700"
    case "in-testing":
    case "pending":
      return "bg-blue-100 text-blue-700"
    case "received":
    case "review":
      return "bg-amber-100 text-amber-700"
    case "rejected":
    case "fail":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "rush":
      return "bg-red-100 text-red-700"
    case "urgent":
      return "bg-amber-100 text-amber-700"
    default:
      return "bg-gray-100 text-gray-600"
  }
}

export function LimsContent({ activeItem }: { activeItem?: string }) {
  const [activeTab, setActiveTab] = useState<"samples" | "results" | "equipment">("samples")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">LIMS Lab Management</h1>
              <p className="text-sm text-muted-foreground">Sample tracking, test results, and lab operations</p>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Register Sample
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">{kpi.icon}</div>
                <div className={cn("flex items-center gap-1 text-xs font-medium", kpi.changeType === "up" ? "text-green-600" : "text-amber-600")}>
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
      <div className="border-b border-border bg-card px-6">
        <div className="flex gap-6">
          {[
            { id: "samples", label: "Samples", icon: <Beaker className="h-4 w-4" /> },
            { id: "results", label: "Test Results", icon: <ClipboardList className="h-4 w-4" /> },
            { id: "equipment", label: "Equipment", icon: <Microscope className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "samples" | "results" | "equipment")}
              className={cn("flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors", activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeTab === "samples" ? "Search samples..." : activeTab === "results" ? "Search results..." : "Search equipment..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "samples" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Sample ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Test Type</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockSamples.map((sample) => (
                  <tr key={sample.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{sample.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{sample.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{sample.client}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{sample.testType}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getPriorityColor(sample.priority))}>{sample.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getStatusColor(sample.status))}>{sample.status.replace("-", " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{sample.dueDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="rounded p-1 hover:bg-accent">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="rounded p-1 hover:bg-accent">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "results" && (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Test ID</th>
                  <th className="px-4 py-3">Sample ID</th>
                  <th className="px-4 py-3">Test Name</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Analyst</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockResults.map((result) => (
                  <tr key={result.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{result.id}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{result.sampleId}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{result.testName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{result.result}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getStatusColor(result.status))}>{result.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{result.analyst}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{result.completedDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="rounded p-1 hover:bg-accent">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="rounded p-1 hover:bg-accent">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "equipment" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "EMC Chamber A", status: "in-use", utilization: "85%", nextAvailable: "2024-01-18 14:00" },
              { name: "Safety Test Bay 1", status: "available", utilization: "72%", nextAvailable: "Now" },
              { name: "Environmental Chamber", status: "in-use", utilization: "91%", nextAvailable: "2024-01-17 09:00" },
              { name: "RF Shielded Room", status: "maintenance", utilization: "0%", nextAvailable: "2024-01-20" },
              { name: "Vibration Test System", status: "available", utilization: "68%", nextAvailable: "Now" },
              { name: "Thermal Shock Chamber", status: "in-use", utilization: "78%", nextAvailable: "2024-01-18 16:00" },
            ].map((equip) => (
              <div key={equip.name} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Microscope className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      equip.status === "available" ? "bg-green-100 text-green-700" : equip.status === "in-use" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {equip.status.replace("-", " ")}
                  </span>
                </div>
                <h3 className="mt-3 font-medium text-foreground">{equip.name}</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Utilization</span>
                    <span className="font-medium text-foreground">{equip.utilization}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Next Available</span>
                    <span className="font-medium text-foreground">{equip.nextAvailable}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
