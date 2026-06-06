export const SUPPORTED_LOCALES = ['zh-TW', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const LOCALE_LOADERS: Record<Locale, () => Promise<{ default: Record<string, any> }>> = {
  'zh-TW': () => import('./zh-TW'),
  'en': () => import('./en'),
}

export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  'en': 'English',
}
