---
name: core-i18n-detect
description: 實作初始語系偵測（localStorage 優先、其次瀏覽器語言、最後 fallback）。重建 i18n 啟動流程、決定預設語言、或處理語系記憶時先讀這份。
---

# core/i18n/detect.ts

> 模組：core｜角色：在 app 啟動時決定要載入哪個語系，回傳一個合法的 `Locale`。

## 公開 API
- `detectLocale(): Locale` — 回傳偵測到的語系（`'zh-TW' | 'en'`）。

## 核心邏輯
偵測優先序（由高到低）：(1) localStorage 記憶 → (2) 瀏覽器語言 → (3) fallback `'zh-TW'`。整支函數：

```typescript
export function detectLocale(): Locale {
  // 1. localStorage 記憶；空 catch 避免 SSR / 隱私模式拋錯
  try {
    const saved = localStorage.getItem('forager.lang')
    if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
      return saved as Locale
    }
  } catch {}

  // 2. 瀏覽器語言；typeof navigator 守衛，非瀏覽器環境 fallback 'zh-TW'
  const nav = (typeof navigator !== 'undefined' && navigator.language)
    ? navigator.language
    : 'zh-TW'

  // 3. 只看前綴 zh（涵蓋 zh / zh-TW / zh-CN / zh-HK …），否則 'en'
  if (nav.toLowerCase().startsWith('zh')) return 'zh-TW'
  return 'en'
}
```

- 關鍵常數字串：localStorage key 是 `'forager.lang'`（須與 I18n.ts `setLocale` 寫入一致）；預設 fallback 是 `'zh-TW'`（中文優先）。
- 邊界條件：localStorage 存了不在支援清單內的值時會被忽略，落到瀏覽器語言判斷；任何 localStorage 例外都被 catch 吞掉。

## EventBus 互動
無。

## 依賴
- `import { SUPPORTED_LOCALES, type Locale } from '@/locales'` — 支援語系清單（`['zh-TW', 'en'] as const`）與 `Locale` 型別，用於驗證與回傳型別。

## 重建提示
- 與 I18n.ts 搭配：`initI18n()` 會呼叫 `detectLocale()` 決定首次載入語言。
- 易踩雷：(1) localStorage key 必須與 I18n.ts `setLocale` 寫入的 key 完全一致（皆為 `'forager.lang'`）；(2) 一定要做 `typeof navigator` 守衛與 try/catch，否則非瀏覽器環境會炸；(3) 中文判斷只看前綴 `zh`，不要寫死成只比對 `zh-TW`。
