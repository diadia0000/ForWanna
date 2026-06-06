---
name: ui-index
description: Rebuild the ui barrel export — exact re-export list of all UI classes, helpers, and types.
---

# ui/index.ts

> 模組：ui｜角色：barrel 匯出檔，集中導出所有 UI 類別、定價系統、選取繪圖工具與型別

## 公開 API（完整內容）

```typescript
export { LobbyScreen } from './LobbyScreen'
export { HUD } from './HUD'
export { InventoryUI } from './InventoryUI'
export { CraftingUI } from './CraftingUI'
export { BuildingUI } from './BuildingUI'
export { HotbarUI } from './HotbarUI'
export { FurnaceUI } from './FurnaceUI'
export { MarketUI } from './MarketUI'
export { ResearchUI } from './ResearchUI'
export { MarketPricing, marketPricing } from './MarketPricing'
export { createSelectorGfx, paintSelectorGfx } from './SelectorGfx'
export { BagUI } from './BagUI'
export type { BagType } from './BagUI'
export { BaseCoreUI } from './BaseCoreUI'
export { BarracksUI } from './BarracksUI'
export { EquipUI } from './EquipUI'
```

## 依賴

- 同目錄所有 UI 模組

## 重建提示

- `marketPricing`（單例）與 `MarketPricing`（class）皆導出。
- `MarketPricing.test.ts` 不在 barrel 中（測試檔）。
- `BagType` 用 `export type` 導出（type-only）。
- `SelectorGfx` 導出的是兩個函式（`createSelectorGfx`/`paintSelectorGfx`），非 class。
- 外部（main.ts）一律從 `@/ui` 取用這些符號；保持此清單與新增 UI 同步。
