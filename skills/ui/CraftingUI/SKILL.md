---
name: crafting-ui
description: Rebuild the two-column crafting UI — recipe list + detail with qty controls, weapon stats, lock/affordability.
---

# ui/CraftingUI.ts

> 模組：ui｜角色：合成介面，左欄配方列表 + 右欄細節（材料、武器數值、數量選擇、合成按鈕）

## 公開 API

- `new CraftingUI()` — append `#crafting-ui`
- `CraftingUI.show(recipes: Record<string,RecipeDef>, inventory: InventoryItem[], level: number): void`
- `CraftingUI.hide(): void` / `toggle(recipes, inventory, level): void`
- `CraftingUI.setOnCraft(fn: (recipeId: string, qty: number) => void): void`
- getter `isVisible`

## 核心邏輯

### 本地 WEAPON_STATS 副本（不可 import @/combat）

為避免循環依賴，UI 層維護工具/武器數值副本，依產物 itemId 查表顯示：

```typescript
const WEAPON_STATS: Record<string, { damage; resDmg; range; cooldown; arc }> = {
  fist: { damage:1, resDmg:0.5, range:1, cooldown:800, arc:180 },
  stone_sword: {...}, axe:{...}, pickaxe:{...}, iron_sword:{...}, iron_pick:{...},
  gold_sword:{...}, magic_sword:{damage:80,...}, mithril_sword:{...},
  wood_bow:{...}, iron_bow:{...}, magic_bow:{...}, laser_gun:{...},
  whirlwind_hammer:{ damage:30, resDmg:8, range:2, cooldown:1500, arc:360 },
}
```

### 列表：鎖定 / 可合成判定

```typescript
const locked = this.currentLevel < recipe.unlockLevel
const canCraft = !locked && recipe.requires.every(r => (invMap.get(r.itemId) ?? 0) >= r.amount)
// class: craft-row + (canCraft?' craft-row--ok':'') + (locked?' craft-row--locked':'') + (selected?' craft-row--selected':'')
```

鎖定列顯示 🔒；顯示產物 `produces[0]` 的 icon + i18n 名稱。

### 細節：數量夾取與最大可合成

```typescript
private _maxCraftable(id: string): number {
  const recipe = this.currentRecipes[id]
  if (!recipe || this.currentLevel < recipe.unlockLevel) return 0
  const invMap = this._invMap()
  let max = Infinity
  for (const req of recipe.requires) {
    const have = invMap.get(req.itemId) ?? 0
    max = Math.min(max, Math.floor(have / req.amount))
  }
  return max === Infinity ? 0 : Math.max(0, max)
}
// renderDetail：clamp 至當前 max（切換配方時）
this.craftQty = Math.max(1, Math.min(this.craftQty, maxQ || 1))
const canCraft = !locked && maxQ >= this.craftQty && this.craftQty > 0
```

材料列依 `need = req.amount * craftQty` 與 have 比較標 ok/miss。數量按鈕：◄/►/HALF(`floor(maxQ/2)`)/MAX(`maxQ`)，`setQty` 都 clamp `[1, maxQ||1]` 後 re-render。鎖定時顯示 `locked_msg`(需 `unlockLevel - 1` 級) 取代數量區。

## EventBus 互動

- on `ui:close_crafting` — hide
- on `inventory:changed` `{ inventory }` — 可見時更新 inventory、renderList + renderDetail
- on `i18n:changed` — 可見時重繪兩欄
- `document` keydown `Escape` — 可見時 hide
- 合成走注入回呼 `onCraft(id, qty)`，非事件

## 依賴

- `@/types` RecipeDef/InventoryItem、`@/core/EventBus`、`@/core/i18n` t
- `@/inventory` ITEMS、`@/render/ItemSpriteRegistry` getItemIconMarkup
- ⚠️ 禁止 import `@/combat`（用本地 WEAPON_STATS）

## 重建提示

- 容器 `#crafting-ui` 顯示 `flex`；兩欄 `.craft-list-col#crafting-list` + `.craft-detail-col#crafting-detail`。
- `buildHTML` 綁 `wheel` `stopPropagation`（`{passive:false}`）阻止滾輪冒泡到 Hotbar。
- 物品名用 i18n `item.{id}.name`，不做 `toUpperCase`，中文顯示。
- `show()` 預選 `Object.keys(recipes)[0]`。
