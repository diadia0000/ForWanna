---
name: inventory-crafting-system
description: 合成系統主控邏輯 — 驗證材料、扣除材料、給予產物並發射事件；需要重建合成功能時首先參考此檔案。
---

# inventory/CraftingSystem.ts

> 模組：inventory｜角色：以 `researchLevel` 和背包數量為閘門，執行配方查詢、材料扣除、產物添加，並向 EventBus 廣播合成結果。

## 公開 API

- `CraftingSystem` (class) — 以具名 export 匯出，呼叫端從 `@/inventory` 取得；不是 singleton，但實際上整個遊戲只會 `new CraftingSystem()` 一次並掛在需要的地方。
  - `canCraft(playerId: PlayerId, recipeId: RecipeId): boolean` — 同時檢查：① 配方存在、② 玩家 `researchLevel` >= `recipe.unlockLevel`、③ 背包內每種材料數量 >= 需求量；三者全滿足才回傳 `true`。
  - `craft(playerId: PlayerId, recipeId: RecipeId): boolean` — 先呼叫 `canCraft`，失敗即 `return false`；成功則依序扣除所有 `requires`、添加所有 `produces`、emit `craft:success`，最後回傳 `true`。
  - `getAvailableRecipes(playerId: PlayerId): string[]` — 回傳目前玩家可合成的所有 recipeId 陣列（對 `RECIPES` 全量做 `filter(id => canCraft(...))`）。
  - `getAllRecipes(): Record<string, RecipeDef>` — 直接回傳整個 `RECIPES` 物件（唯讀參考），供 UI 列舉所有配方。

## 核心邏輯

**`canCraft` — 三段式閘門：**

```typescript
canCraft(playerId: PlayerId, recipeId: RecipeId): boolean {
  const recipe = RECIPES[recipeId]
  if (!recipe) return false
  const researchLevel = GameStateManager_.getPlayer(playerId)?.researchLevel ?? 1
  if (researchLevel < recipe.unlockLevel) return false
  return recipe.requires.every(req =>
    Inventory.getAmount(playerId, req.itemId) >= req.amount
  )
}
```

**`craft` — 扣料、給物、emit（無事務回滾）：**

```typescript
craft(playerId: PlayerId, recipeId: RecipeId): boolean {
  if (!this.canCraft(playerId, recipeId)) return false
  const recipe = RECIPES[recipeId]
  recipe.requires.forEach(req => Inventory.remove(playerId, req.itemId, req.amount))
  recipe.produces.forEach(prod => Inventory.add(playerId, prod.itemId, prod.amount))
  EventBus.emit('craft:success', { playerId, recipeId, result: recipe.produces })
  return true
}
```

**`getAvailableRecipes` — 即時線性掃描（不快取）：**

```typescript
getAvailableRecipes(playerId: PlayerId): string[] {
  return Object.keys(RECIPES).filter(id => this.canCraft(playerId, id))
}
```

**邊界條件：**

- 配方不存在 → `canCraft` 直接 `false`，`craft` 不呼叫。
- `researchLevel` 預設為 1，未初始化的玩家仍可合成 Lv 1 配方。
- `getAvailableRecipes` 是即時計算（線性掃描全 RECIPES），不快取，呼叫頻率高時需注意效能。

## EventBus 互動

- emit `craft:success` — payload: `{ playerId: PlayerId, recipeId: RecipeId, result: Array<{ itemId: string, amount: number }> }`；於 `craft()` 成功扣料並給物後觸發。

## 依賴

- `@/types` — `PlayerId`, `RecipeId` 型別。
- `@/core/EventBus` — 發射 `craft:success`。
- `@/core/GameState` — `GameStateManager_.getPlayer(playerId)` 取玩家 `researchLevel`。
- `./Inventory` (模組內部) — `Inventory.getAmount`、`Inventory.remove`、`Inventory.add`。
- `./data/recipes` — `RECIPES` 配方表。

## 重建提示

- `CraftingSystem` 以 class 匯出（不是 singleton），使用者需自行 `new CraftingSystem()`；若改成 singleton 要同步更新 `index.ts` 的 export。
- `canCraft` 和 `craft` 的解鎖等級邏輯從 `GameStateManager_` 拉，不是從 EventBus 事件；重建時確認 `GameState` 的 API 是否有更名。
- 禁止 import `@/combat` — 武器 stat 只在 UI local copy，CraftingSystem 本身無需知道傷害數值。
- `craft:success` 的 `result` 欄位型別是 `produces` 陣列（`Array<{ itemId, amount }>`），不是單一產物，UI 端要迭代處理。
- 建議實作順序：先有 `RECIPES` 資料 → 再有 `Inventory` → 最後才實作 `CraftingSystem`。
