"use client"

import { useState } from "react"
import {
  Bell,
  Search,
  ChevronDown,
  Globe,
  Moon,
  Sun,
  HelpCircle,
  Command,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { AppearanceDialog } from "@/components/appearance-dialog"
import { StorageSettingsDialog } from "@/components/storage-settings-dialog"
import { useT, LOCALE_LABELS, LOCALE_LONG_LABELS, type Locale } from "@/lib/i18n"

export function TopBar({ onNavigate }: { onNavigate?: (item: string) => void }) {
  const { resolvedTheme, setTheme } = useTheme()
  const { locale, setLocale, t } = useT()
  const [searchFocused, setSearchFocused] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [storageSettingsOpen, setStorageSettingsOpen] = useState(false)

  const notifications = [
    {
      id: "1",
      type: "approval",
      title: "New Approval Request",
      message: "Quotation QT-2024-0156 awaiting your approval",
      time: "2 min ago",
      unread: true,
    },
    {
      id: "2",
      type: "system",
      title: "Equipment Calibration Reminder",
      message: "EMC Chamber B calibration expires tomorrow",
      time: "15 min ago",
      unread: true,
    },
    {
      id: "3",
      type: "update",
      title: "Regulation Update",
      message: "EU RED 2024 revision has been published",
      time: "1 hour ago",
      unread: false,
    },
  ]

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      {/* Left Section - Global Search */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 transition-all",
            searchFocused ? "border-primary w-96" : "border-border w-72"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Global search... (Cmd+K)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Center Section - Context Breadcrumb */}
      <div className="hidden items-center gap-2 text-sm md:flex">
        <span className="text-muted-foreground">Shenzhen Lab</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">EMC Test Team</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Quick Actions */}
        <Button variant="ghost" size="sm" className="h-9 px-2.5 text-muted-foreground hover:text-foreground">
          <Command className="h-4 w-4" />
          <span className="hidden sm:inline">Command</span>
        </Button>

        {/* Language switcher */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLangMenu((v) => !v)}
            title={t("lang.switch")}
            className="h-9 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
          </Button>
          {showLangMenu && (
            <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-lg border border-border bg-card p-1 shadow-lg">
              {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => { setLocale(l); setShowLangMenu(false) }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted ${locale === l ? "text-primary" : "text-foreground"}`}
                >
                  <span>{LOCALE_LONG_LABELS[l]}</span>
                  <span className="text-xs text-muted-foreground">{LOCALE_LABELS[l]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <div className="relative">
          <Button
            onClick={() => setShowNotifications(!showNotifications)}
            variant="ghost"
            size="icon-sm"
            className="relative text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              2
            </span>
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card p-2 shadow-lg">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-sm font-medium text-foreground">Notifications</span>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary">
                  Mark all read
                </Button>
              </div>
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "rounded-md p-2 transition-colors hover:bg-muted",
                      notification.unread && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {notification.unread && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                      )}
                      <div className={cn(!notification.unread && "ml-4")}>
                        <p className="text-sm font-medium text-foreground">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <Button variant="ghost" size="sm" className="h-8 w-full text-xs text-primary hover:text-primary">
                  View all notifications
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <Button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

      </div>
      <AppearanceDialog open={appearanceOpen} onOpenChange={setAppearanceOpen} />
      <StorageSettingsDialog open={storageSettingsOpen} onOpenChange={setStorageSettingsOpen} />
    </header>
  )
}
