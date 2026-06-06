---
name: inventory-data-item-kinds
description: 物品手持類型分類系統 — 定義所有手持類型 union 並提供 itemId → HeldItemKind 的查詢函數；需要判斷玩家手持物品類型（影響攻擊/採集/裝備行為）時必看此檔案。
---

# inventory/data/itemKinds.ts

> 模組：inventory｜角色：以硬編碼 Set 集合定義 itemId 的手持類型分類，提供兩個純函數供全域查詢，不依賴任何外部狀態。

## 公開 API

- `HeldItemKind` (type) — union 型別：`'none' | 'sword' | 'pickaxe' | 'axe' | 'bow' | 'armor' | 'tool' | 'weapon' | 'food' | 'building' | 'resource' | 'other'`（共 12 種）。
- `getHeldItemKind(itemId: string | null | undefined): HeldItemKind` — 輸入 itemId（含 null/undefined 安全），回傳對應的 `HeldItemKind`；未能分類則回傳 `'other'`。
- `isHeldItemKind(itemId: string | null | undefined, kind: HeldItemKind): boolean` — 等同於 `getHeldItemKind(itemId) === kind`，便利封裝。

## 核心邏輯

**型別定義：**

```typescript
export type HeldItemKind =
  | 'none' | 'sword' | 'pickaxe' | 'axe' | 'bow'
  | 'armor' | 'tool' | 'weapon' | 'food' | 'building'
  | 'resource' | 'other'
```

**分類 Set 定義（完整）：**

```typescript
const PICKAXE_IDS  = new Set(['pickaxe', 'iron_pick'])
const AXE_IDS      = new Set(['axe'])
const BOW_IDS      = new Set(['wood_bow', 'iron_bow', 'magic_bow'])
const ARMOR_IDS    = new Set(['leather_armor', 'iron_armor', 'gold_armor', 'crystal_armor', 'shield'])
const TOOL_IDS     = new Set(['flashlight'])
const WEAPON_IDS   = new Set(['laser_orb', 'laser_gun', 'whirlwind_hammer', 'grenade'])
const FOOD_IDS     = new Set(['berry', 'tomato', 'purple_grape', 'onion', 'carrot',
                               'pumpkin', 'watermelon', 'bread', 'meat', 'cooked_meat', 'gourmet'])
const BUILDING_IDS = new Set(['furnace', 'spike_trap', 'fire_trap', 'ice_trap',
                               'laser_tower', 'cannon_tower', 'bed'])
const RESOURCE_IDS = new Set(['wood', 'stone', 'iron', 'gold', 'crystal', 'bone',
                               'plank', 'ingot', 'gold_ingot', 'arrow', 'fire_arrow', 'ice_arrow',
                               'leather', 'feather', 'spice', 'seasoning', 'fire_essence', 'ice_essence',
                               'ancient_crystal', 'blueprint',
                               'blueprint_1', 'blueprint_2', 'blueprint_3', 'blueprint_4', 'blueprint_5',
                               'dungeon_map'])
```

**`getHeldItemKind` — if-else 鏈，順序即優先度：**

```typescript
export function getHeldItemKind(itemId: string | null | undefined): HeldItemKind {
  if (!itemId) return 'none'
  if (PICKAXE_IDS.has(itemId) || itemId.endsWith('_pick')) return 'pickaxe'
  if (AXE_IDS.has(itemId)) return 'axe'
  if (itemId.endsWith('_sword')) return 'sword'
  if (BOW_IDS.has(itemId) || itemId.endsWith('_bow')) return 'bow'
  if (ARMOR_IDS.has(itemId) || itemId.endsWith('_armor')) return 'armor'
  if (TOOL_IDS.has(itemId)) return 'tool'
  if (WEAPON_IDS.has(itemId)) return 'weapon'
  if (FOOD_IDS.has(itemId)) return 'food'
  if (BUILDING_IDS.has(itemId)) return 'building'
  if (RESOURCE_IDS.has(itemId)) return 'resource'
  return 'other'
}
```

**後綴規則說明：**

- `_sword`, `_pick`, `_bow`, `_armor` 四個後綴讓未來新物品自動命名即可歸類，不需修改此檔案。
- `_pick` 後綴規則和 `PICKAXE_IDS` Set 並行，Set 先檢查（若 `pickaxe` / `iron_pick` 已在 Set 裡，後綴規則其實是備援）。

## EventBus 互動

無。

## 依賴

無外部依賴（純資料 + 純函數，不 import 任何模組）。

## 重建提示

- 新增武器/工具時，**同時**要更新 `ITEMS`（定義）、對應的 Set（分類）、以及 `ITEM_RARITY`（稀有度）；三處缺一不可。
- `shield` 歸類在 `ARMOR_IDS`（不是 `WEAPON_IDS`），重建時注意這個非直覺分類。
- `BUILDING_IDS` 包含 `spike_trap`、`fire_trap`、`ice_trap`——陷阱是 building 類型，不是 weapon 類型；這影響放置邏輯。
- `laser_tower` 和 `cannon_tower` 也在 `BUILDING_IDS`（防禦塔放置物），不在 `WEAPON_IDS`。
- 函數是純函數（無副作用），所有 Set 是模組載入時建立的常數，效能極佳。
