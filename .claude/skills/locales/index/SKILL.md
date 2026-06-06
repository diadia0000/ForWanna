---
name: locales-index
description: locales 的組裝結構——根 barrel（src/locales/index.ts，定義支援語系/loader/標籤）與各語系 index.ts（把 22 個 namespace 組成單一 default export）。重建語系載入入口、新增語系、調整 namespace 匯入清單與順序時參考這份。
---

# locales/index.ts + zh-TW/index.ts + en/index.ts

> 模組：locales｜角色：把分檔的翻譯字串組裝成可被 i18n 核心動態載入的結構。字串內容本身見 locales-zh-tw / locales-en；本份只負責「組裝與入口」。

## 結構總覽
```
src/locales/
├── index.ts        ← 根 barrel：支援語系清單、動態 loader、語系顯示標籤
├── zh-TW/
│   ├── index.ts    ← 匯入 22 個 namespace，default export 組合物件
│   └── <namespace>.ts × 22
└── en/
    ├── index.ts    ← 結構與 zh-TW/index.ts 完全相同
    └── <namespace>.ts × 22
```

## 根 barrel：src/locales/index.ts
```typescript
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
```
重點：
- `SUPPORTED_LOCALES` 用 `as const`，型別 `Locale` 由它推導（`'zh-TW' | 'en'`）。
- `LOCALE_LOADERS` 是**動態 import** 的 loader map（懶載入語系包，回傳 `{ default: ... }`）。i18n 核心呼叫 `LOCALE_LOADERS[locale]()` 才會載入該語系。
- `LOCALE_LABELS` 給 UI 選單顯示用（繁體中文 / English）。
- 三個 export 的 key 集合都必須涵蓋每個 `Locale`（`Record<Locale, ...>` 強制）。

## 語系 index.ts（zh-TW 與 en 內容完全相同）
兩份檔案逐字一致，只差所在資料夾（各自 import 同資料夾下的 namespace）：
```typescript
import common from './common'
import item from './item'
import recipe from './recipe'
import research from './research'
import building from './building'
import weapon from './weapon'
import armor from './armor'
import monster from './monster'
import quest from './quest'
import resource from './resource'
import treasure from './treasure'
import dungeon from './dungeon'
import world from './world'
import network from './network'
import save from './save'
import render from './render'
import ui from './ui'
import lobby from './lobby'
import hud from './hud'
import game from './game'
import toast from './toast'

export default { common, item, recipe, research, building, weapon, armor, monster, quest, resource, treasure, dungeon, world, network, save, render, ui, lobby, hud, game, toast }
```
重點：
- 共 21 行 import + 1 行 default export，import 與 export 都是同樣 21 個資料 namespace（common…toast）。
- 釐清「22 個檔案」：每個語系資料夾有 22 個 `.ts` 檔 = 21 個資料 namespace 檔 + `index.ts` 本身。`index.ts` 是組裝檔，不算被匯入的資料 namespace，所以 import 清單是 21 行。
- default export 是一個物件，key = namespace 名、value = 各檔的 default export。i18n 核心載入後即用 `dict[ns][key]` 取字串。
- import 順序與 export 物件內鍵序一致（common 開頭、toast 結尾），重建時照抄此順序即可。

## 與 i18n 核心的銜接
- i18n 核心（core/i18n/I18n）持有目前語系，需要時呼叫 `LOCALE_LOADERS[locale]()` 取得 `{ default }`，把該 default 物件當成字典，再以 `t('ns.key.path')` 點號路徑查值。
- 巢狀 namespace（如 `ui.bag.title`、`quest.wood10.desc`）的第一段是 namespace 名（對應 index.ts 的 key），其餘為該檔內物件路徑。

## 依賴
- 根 index.ts → 依賴 `./zh-TW`、`./en` 兩個資料夾的 index（透過動態 import 字串，非靜態 import）。
- 各語系 index.ts → 依賴同資料夾 21 個 namespace 檔的 default export。

## 重建提示
- **新增語系（例如 ja）**：
  1. 建 `src/locales/ja/`，複製 21 個 namespace 檔並翻譯（key 結構必須與 zh-TW/en 完全一致）+ 一份相同結構的 `index.ts`。
  2. 在根 index.ts 的 `SUPPORTED_LOCALES` 加 `'ja'`、`LOCALE_LOADERS` 加 `'ja': () => import('./ja')`、`LOCALE_LABELS` 加 `'ja': '日本語'`。三處缺一會型別報錯或執行期取不到。
- **新增 namespace**：在「兩個」語系資料夾都新增該檔，並在「兩份」index.ts 都加一行 import + 在 default export 物件加上對應 key（順序保持一致）。漏掉任一語系會造成中英不對齊。
- **動態 import 路徑用字串字面量**（`import('./zh-TW')`），Vite 才能正確做 code-splitting / 懶載入；勿改成變數拼接路徑。
- `as const` 不可省，否則 `Locale` 會退化成 `string`，失去語系列舉的型別保護。
- 三個 `Record<Locale, ...>` map 的 key 必須與 `SUPPORTED_LOCALES` 完全對齊。
- 別把 `index.ts` 自己當成一個資料 namespace 去 import；它只是組裝檔。
