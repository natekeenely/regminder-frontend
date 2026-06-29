"use client"

import * as React from "react"

export type Locale = "en" | "zh-CN" | "zh-TW"

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  "zh-CN": "ZH",
  "zh-TW": "TW",
}

export const LOCALE_LONG_LABELS: Record<Locale, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
}

const STORAGE_KEY = "regminder.ui.locale"

// Translations live in a JSON file so the .tsx stays ASCII-safe and avoids any
// editor-tool encoding issues when the dictionary mixes English and CJK glyphs.
// See lib/i18n-strings.json — adding a key/value there is enough; no code change.
type StringEntry = Partial<Record<Locale, string>> & { en: string }
type Dict = {
  strings: Record<string, StringEntry>
  text: Record<string, Partial<Record<Locale, string>>>
}
import dict from "./i18n-strings.json"
const DICT = dict as Dict

export type TKey = string

const LocaleContext = React.createContext<{
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TKey) => string
  tx: (text: string) => string
}>({
  locale: "en",
  setLocale: () => undefined,
  t: (key) => String(key),
  tx: (text) => text,
})

export function LocaleProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const [locale, setLocaleState] = React.useState<Locale>("en")

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null
      if (saved && (saved === "en" || saved === "zh-CN" || saved === "zh-TW")) {
        setLocaleState(saved)
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  const setLocale = React.useCallback((l: Locale): void => {
    setLocaleState(l)
    try { window.localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
    if (typeof document !== "undefined") document.documentElement.lang = l
  }, [])

  const t = React.useCallback((key: TKey): string => {
    const entry = DICT.strings[key]
    if (!entry) return key
    return entry[locale] ?? entry.en ?? key
  }, [locale])

  const tx = React.useCallback((text: string): string => {
    if (locale === "en") return text
    const entry = DICT.text[text]
    if (!entry) return text
    return entry[locale] ?? text
  }, [locale])

  const value = React.useMemo(() => ({ locale, setLocale, t, tx }), [locale, setLocale, t, tx])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useT(): { locale: Locale; setLocale: (l: Locale) => void; t: (key: TKey) => string; tx: (text: string) => string } {
  return React.useContext(LocaleContext)
}

// Update the labels above to display Chinese codes when the system has translations.
// Keep ASCII-safe in this file; localized chip text is read from the JSON dict.
export function getLocaleChip(locale: Locale): string {
  const entry = DICT.text[`__locale_chip_${locale}`]
  if (!entry) return LOCALE_LABELS[locale]
  return entry[locale] ?? LOCALE_LABELS[locale]
}
