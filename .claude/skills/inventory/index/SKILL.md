---
name: inventory-index
description: inventory 模組的公開出口彙整 — 定義外部可 import 的所有符號；重建 inventory 模組入口或確認哪些 symbol 對外暴露時參考此檔案。
---

# inventory/index.ts

> 模組：inventory｜角色：barrel export 檔，把 inventory 子模組的所有公開 API、型別、資料表統一從一個入口重新匯出，供其他模組以 `@/inventory` 取用。

## 公開 API

此檔案本身不定義任何邏輯，只做 re-export。以下是它匯出的全部符號：

**從 `./Inventory`：**
- `Inventory` (singleton instance) — 背包系統主入口。

**從 `./CraftingSystem`：**
- `CraftingSystem` (class) — 合成系統，需自行 `new CraftingSystem()`。

**從 `./data/items`：**
- `ITEMS` (`Record<string, ItemDef>`) — 全物品定義表。
- `ITEM_RARITY` (`Record<string, ItemRarity>`) — 物品 → 稀有度映射。
- `RARITY_CONFIG` (`Record<ItemRarity, { label: string; color: string; priceMult: number }>`) — 稀有度外觀與價格乘數設定。
- `ItemRarity` (type export) — `'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'`。

**從 `./data/itemKinds`：**
- `getHeldItemKind` (`(itemId: string | null | undefined) => HeldItemKind`) — 由 itemId 推導手持類型。
- `isHeldItemKind` (`(itemId: string | null | undefined, kind: HeldItemKind) => boolean`) — 便利比較函數。
- `HeldItemKind` (type export) — 所有合法手持類型的 union。

**從 `./data/recipes`：**
- `RECIPES` (`Record<string, RecipeDef>`) — 全配方定義表。

## 核心邏輯

無業務邏輯；單純 re-export。完整內容如下：

```typescript
export { Inventory } from './Inventory'
export { CraftingSystem } from './CraftingSystem'
export { ITEMS, ITEM_RARITY, RARITY_CONFIG } from './data/items'
export type { ItemRarity } from './data/items'
export { getHeldItemKind, isHeldItemKind } from './data/itemKinds'
export type { HeldItemKind } from './data/itemKinds'
export { RECIPES } from './data/recipes'
```

值得注意的是 `RESEARCH_UPGRADE_COSTS` 和 `getResearchUpgradeCost` 並未從 `index.ts` 重新匯出——研究升級成本表是內部資料，若需要從外部存取需直接 import `./data/researchUpgradeCosts`。

## EventBus 互動

無。

## 依賴

- `./Inventory`、`./CraftingSystem`、`./data/items`、`./data/itemKinds`、`./data/recipes`（全部是模組內部相對路徑）。

## 重建提示

- 這個檔案的重要性在於「決定公開介面」：`researchUpgradeCosts` 不在此列，表示它是半內部資料；重建時若需要公開它，在此加一行 export。
- 若新增了新的 data 檔案，記得同步更新此 index，否則外部模組 `import from '@/inventory'` 取不到。
- `CraftingSystem` 是 class（非 singleton），呼叫端需要 `new CraftingSystem()` — 若你把它改成 singleton，這裡的 export 寫法也要跟著調整（不再匯出 class，改匯出 instance）。
- `ItemRarity` 和 `HeldItemKind` 都是 `export type`，TypeScript 的 `isolatedModules` 下不能用 `export { X }` 混用值與型別，必須分開寫成 `export type { X }`。
