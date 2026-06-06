---
name: furnace-ui
description: Rebuild the furnace smelting UI — iron/gold/gold-coin recipes, ratio math, qty controls, two-column layout.
---

# ui/FurnaceUI.ts

> 模組：ui｜角色：熔爐冶煉選單，左欄三配方（鐵錠3:1 / 金錠3:1 / 金幣1:1）+ 右欄詳細與數量

## 公開 API

- `new FurnaceUI()` — append `#furnace-ui`
- `FurnaceUI.show(ironCount: number, goldCount: number): void`
- `FurnaceUI.hide(): void`
- `FurnaceUI.setOnSmelt(fn: (recipe: SmeltRecipe, amount: number) => void): void`

## 核心邏輯

### 配方表

```typescript
type SmeltRecipe = 'iron' | 'gold' | 'gold_coin'
const SMELT_RECIPES: Record<SmeltRecipe, SmeltDef> = {
  iron:      { oreId:'iron', ingotId:'ingot',      oreIcon:'⛏️', ingotIcon:'🔩', ratio:3, ... },
  gold:      { oreId:'gold', ingotId:'gold_ingot', oreIcon:'🟨', ingotIcon:'🏅', ratio:3, ... },
  gold_coin: { oreId:'gold', ingotId:'gold_coin',  oreIcon:'🟨', ingotIcon:'🪙', ratio:1, isCurrency:true },
}
```

`oreCounts` 存 `{ iron, gold, gold_coin }`，注意 `gold_coin` 也用 gold 數量（`gold_coin: goldCount`）。

### show 自動選有礦配方

```typescript
show(ironCount, goldCount): void {
  this.oreCounts = { iron: ironCount, gold: goldCount, gold_coin: goldCount }
  this.activeRecipe = goldCount > 0 ? 'gold' : 'iron'
  this._switchRecipe(this.activeRecipe)
  this.el.style.display = 'flex'
}
```

### 切換配方 — 最大可冶煉「錠數」= floor(ore/ratio)

```typescript
private _switchRecipe(recipe: SmeltRecipe): void {
  this.activeRecipe = recipe
  const def = SMELT_RECIPES[recipe]; const ratio = def.ratio
  // 更新按鈕 active/--selected、礦/錠 icon+名、ratio 文字
  this.maxOre = Math.floor(this.oreCounts[recipe] / ratio)
  this.qty = Math.max(0, Math.min(this.qty, this.maxOre))
  if (this.qty <= 0 && this.maxOre > 0) this.qty = 1
  this._refresh()
}
private _setQty(n: number): void { this.qty = Math.max(0, Math.min(n, this.maxOre)); this._refresh() }
```

數量按鈕：◄/►/HALF(`floor(maxOre/2)`)/MAX(`maxOre`)。冶煉鈕在 `qty<=0 || maxOre<=0` 時 disable，點擊呼 `onSmelt(activeRecipe, qty)` 後 `hide()`。

### i18n 重建（保留狀態）

`i18n:changed` 時若可見：記住 iron/gold/active/qty → `_build()` 新 el → replaceWith → 還原 oreCounts/qty → `_switchRecipe(active)` → 顯示 flex。

## EventBus 互動

- on `i18n:changed` — 可見時整片重建並還原狀態
- `document` keydown `Escape` — 開啟時 hide
- 冶煉走注入回呼 `onSmelt`，非事件

## 依賴

- `@/render/ItemSpriteRegistry` getItemIconMarkup、`@/core/i18n` t、`@/core/EventBus`

## 重建提示

- 容器 `#furnace-ui` 顯示 `flex`；垂直兩欄 `.craft-list-col.furnace-list-col` + `.craft-detail-col.furnace-detail-col`（與 CraftingUI 共用 craft-* class）。
- `_build` 綁 `wheel` `stopPropagation`（`{passive:false}`）防滾輪冒泡到 Hotbar。
- `maxOre`/`qty` 語意是「產出錠數」非「投入礦數」；比例顯示 `ratio:1`。
- 配方按鈕同時切 `active` 與 `craft-row--selected` 兩個 class。
