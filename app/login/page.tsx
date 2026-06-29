import Image from "next/image"
import { BadgeCheck, FileCheck2, Globe2 } from "lucide-react"
import { LoginForm } from "@/components/login-form"
import type React from "react"

export default function LoginPage() {
  // .force-light pins the page to the light palette even when the app theme is dark.
  return (
    <main className="force-light grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col justify-center bg-white px-6 py-12 sm:px-12 lg:px-16">
        <LoginForm />
      </div>

      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        <Image
          src="/tic-facility.png"
          alt="TIC Lab Facility"
          fill
          priority
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/85 to-primary/55" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-primary-foreground/80" />
            ISO/IEC 17025 Accredited
          </div>
          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-tight">Trusted assurance across your supply chain.</h2>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/80">
              Manage testing programs, inspections, and certificates in one enterprise workspace.
            </p>
            <ul className="mt-8 space-y-4">
              <Feature icon={<FileCheck2 className="h-5 w-5" />}>Real-time certificates and reports</Feature>
              <Feature icon={<BadgeCheck className="h-5 w-5" />}>Compliance aligned with global standards</Feature>
              <Feature icon={<Globe2 className="h-5 w-5" />}>Delivery across 120+ countries</Feature>
            </ul>
          </div>
          <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} Hermes TIC Platform</p>
        </div>
      </aside>
    </main>
  )
}

function Feature({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/10 text-primary-foreground/80">
        {icon}
      </span>
      <span className="text-sm text-primary-foreground/90">{children}</span>
    </li>
  )
}
