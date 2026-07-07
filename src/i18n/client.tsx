"use client"

import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { DEFAULT_LOCALE, type Locale } from './config'
import { en, type MessageKey, type Messages } from './locales/en'

type I18nContextValue = {
  locale: Locale
  messages: Messages
}

// Default to English so components render sensibly even outside the provider
// (e.g. the login page, tests).
const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  messages: en,
})

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale
  messages: Messages
  children: ReactNode
}) {
  return (
    <I18nContext.Provider value={{ locale, messages }}>
      {children}
    </I18nContext.Provider>
  )
}

/** t('nav.children') → translated label. Unknown keys fall back to English, then the key itself. */
export function useTranslations() {
  const { messages } = useContext(I18nContext)
  return useCallback(
    (key: MessageKey): string => messages[key] ?? en[key] ?? key,
    [messages],
  )
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}
