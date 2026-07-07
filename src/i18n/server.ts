import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOCALE, isLocale, type Locale } from './config'
import { en, type Messages } from './locales/en'
import { fr } from './locales/fr'

/** Full dictionary for a locale. French falls back to English per-key by
 *  construction (fr is typed to cover every key), but merge defensively. */
export function getMessages(locale: Locale): Messages {
  return locale === 'fr' ? { ...en, ...fr } : en
}

/** Read the signed-in user's saved UI language.
 *  Tolerant by design: if the ui_locale column doesn't exist yet (migration
 *  not run) or anything else fails, the app simply stays English. */
export async function getUserLocale(userId: string): Promise<Locale> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('ui_locale')
      .eq('id', userId)
      .maybeSingle()
    if (error) return DEFAULT_LOCALE
    const value = (data as { ui_locale?: string } | null)?.ui_locale
    return isLocale(value) ? value : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}
