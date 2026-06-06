---
name: core-i18n
description: 實作 i18n 執行核心：載入語系字典、巢狀攤平成 dotted key、t() 翻譯與 {param} 插值、切換語系並廣播事件。重建任何顯示文字、多語切換、翻譯 key 查詢的功能前必讀。
---

# core/i18n/I18n.ts

> 模組：core｜角色：i18n 執行引擎，持有當前語系與攤平後的字典，提供翻譯、插值與語系切換。

## 公開 API
- `initI18n(): Promise<void>` — 啟動時呼叫，依 `detectLocale()` 載入字典。
- `t(key: string, params?: Params, fallback?: string): string` — 查字典翻譯並做插值。
- `setLocale(lang: Locale): Promise<void>` — 切換語系、載入新字典、記憶到 localStorage、更新 `<html lang>`、廣播事件。
- `getLocale(): Locale` — 回傳目前語系。
- `SUPPORTED_LOCALES`（re-export 自 `@/locales`）。
- 型別 export：`Locale`、`Params`（`Params = Record<string, string | number>`）。

## 核心邏輯
- 模組級狀態與型別：

```typescript
type Params = Record<string, string | number>

let current: Locale = 'zh-TW'        // 目前語系（預設中文）
let dict: Record<string, string> = {} // 攤平後的翻譯字典
```

- `flatten`（遞迴攤平巢狀 locale 物件成 dotted key），例如 `{ item: { wood: { name: '木材' } } }` → `{ 'item.wood.name': '木材' }`：

```typescript
function flatten(obj: Record<string, any>, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out) // 遞迴
    else out[key] = String(v)                            // 葉節點強制轉字串
  }
  return out
}
```

- `loadDict` / `initI18n`：動態 import 對應語系模組（code-splitting），攤平 default export：

```typescript
async function loadDict(lang: Locale): Promise<void> {
  const mod = await LOCALE_LOADERS[lang]()   // 動態 import → code-splitting
  dict = flatten(mod.default)
  current = lang
}

export async function initI18n(): Promise<void> {
  await loadDict(detectLocale())             // 首次依偵測語系載入
}
```

- `t(key, params?, fallback?)`：查字典 → 插值。fallback 順序 `dict[key] ?? fallback ?? key`；插值正則只比對 `\{(\w+)\}`，params 缺該 key 時**原樣保留** `{name}`（不丟錯）：

```typescript
export function t(key: string, params?: Params, fallback?: string): string {
  let s = dict[key] ?? fallback ?? key       // 查無 → fallback → key 本身
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (_, p) => (p in params ? String(params[p]) : `{${p}}`))
  }
  return s
}
```

- `setLocale(lang)`：早退守衛 → 載字典 → 記憶 localStorage → 更新 `<html lang>` → 廣播事件：

```typescript
export async function setLocale(lang: Locale): Promise<void> {
  if (lang === current && Object.keys(dict).length > 0) return  // 同語系且已載入 → 不重做
  await loadDict(lang)
  try { localStorage.setItem('forager.lang', lang) } catch {}   // key 與 detect.ts 一致
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  EventBus.emit('i18n:changed', { lang })                       // 讓 UI / render 重繪
}

export function getLocale(): Locale { return current }
```

- 邊界條件：插值正則只比對 `\w+`（字母數字底線）；缺值佔位符不丟錯而是原樣保留；localStorage / document 都有環境守衛。

## EventBus 互動
- emit `i18n:changed` — payload `{ lang }`（`lang: string`，即剛切換成的語系）。在 `setLocale` 成功載入新字典後觸發，讓 UI / render 層重繪文字。
- on：無。

## 依賴
- `import { EventBus } from '@/core/EventBus'` — 用來 emit `i18n:changed`。
- `import { LOCALE_LOADERS, SUPPORTED_LOCALES, type Locale } from '@/locales'` — 動態載入器表（`Record<Locale, () => Promise<{default}>>`）、支援清單、型別。
- `import { detectLocale } from './detect'` — 決定首次載入語系。

## 重建提示
- 初始化順序：app 啟動早期 `await initI18n()`，之後 UI 才開始 `t(...)`；語言切換走 `setLocale`。
- 與 detect.ts、`@/locales`（SUPPORTED_LOCALES / LOCALE_LOADERS / 各語系檔）緊耦合；localStorage key `'forager.lang'` 必須三處一致。
- 易踩雷：(1) 字典是攤平後的 dotted key，`t('item.wood.name')` 而非巢狀存取；(2) `t` 查無 key 時回傳 key 本身（容易在 UI 看到原始 key，代表翻譯缺漏）；(3) 監聽 `i18n:changed` 的元件要重新跑 `t()` 才會更新文字。
