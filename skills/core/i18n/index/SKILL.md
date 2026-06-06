---
name: core-i18n-index
description: i18n 模組的公開出口（barrel re-export）。重建時若要決定 i18n 對外暴露哪些 API、或設定 import 路徑（@/core/i18n），參考這份。
---

# core/i18n/index.ts

> 模組：core｜角色：i18n 子模組的 barrel file，統一對外 re-export，讓外部以 `@/core/i18n` 取用而不必碰內部檔名。

## 公開 API
全部為 re-export，無自有實作：
- `t, setLocale, getLocale, initI18n, SUPPORTED_LOCALES`（值）— 來自 `./I18n`。
- 型別 `Locale, Params` — 來自 `./I18n`（用 `export type`）。

## 核心邏輯
- 兩行 barrel，值與型別分開（`export` vs `export type`），符合 `isolatedModules` / verbatimModuleSyntax 下對型別匯出的要求：

```typescript
export { t, setLocale, getLocale, initI18n, SUPPORTED_LOCALES } from './I18n'
export type { Locale, Params } from './I18n'
```

- 刻意不 re-export `detect.ts` 的 `detectLocale`（屬於 I18n 內部使用，不對外）。

## EventBus 互動
無。

## 依賴
- `from './I18n'` — 同目錄的 i18n 執行核心，是唯一來源。

## 重建提示
- 外部模組一律 `import { t, setLocale } from '@/core/i18n'`，不要直接指到 `@/core/i18n/I18n` 或 `@/core/i18n/detect`。
- 易踩雷：型別必須用 `export type` 才不會在純型別環境下被當成值匯出而報錯；新增 I18n 的對外 API 時記得同步在這裡補 re-export，否則外部拿不到。
