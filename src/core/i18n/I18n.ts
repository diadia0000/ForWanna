import { EventBus } from '@/core/EventBus'
import { LOCALE_LOADERS, SUPPORTED_LOCALES, type Locale } from '@/locales'
import { detectLocale } from './detect'

type Params = Record<string, string | number>

let current: Locale = 'zh-TW'
let dict: Record<string, string> = {}

// 巢狀物件攤平成 dotted key：{ item: { wood: { name: '木材' } } } -> { 'item.wood.name': '木材' }
function flatten(obj: Record<string, any>, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = String(v)
  }
  return out
}

async function loadDict(lang: Locale): Promise<void> {
  const mod = await LOCALE_LOADERS[lang]()
  dict = flatten(mod.default)
  current = lang
}

export async function initI18n(): Promise<void> {
  await loadDict(detectLocale())
}

export function t(key: string, params?: Params, fallback?: string): string {
  let s = dict[key] ?? fallback ?? key
  if (params) s = s.replace(/\{(\w+)\}/g, (_, p) => (p in params ? String(params[p]) : `{${p}}`))
  return s
}

export async function setLocale(lang: Locale): Promise<void> {
  if (lang === current && Object.keys(dict).length > 0) return
  await loadDict(lang)
  try { localStorage.setItem('forager.lang', lang) } catch {}
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  EventBus.emit('i18n:changed', { lang })
}

export function getLocale(): Locale { return current }
export { SUPPORTED_LOCALES }
export type { Locale, Params }
