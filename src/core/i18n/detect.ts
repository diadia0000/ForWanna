import { SUPPORTED_LOCALES, type Locale } from '@/locales'

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem('forager.lang')
    if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) return saved as Locale
  } catch {}
  const nav = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'zh-TW'
  if (nav.toLowerCase().startsWith('zh')) return 'zh-TW'
  return 'en'
}
