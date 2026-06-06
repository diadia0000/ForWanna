---
name: inventory-data-recipes
description: 全合成配方定義表 — 按解鎖等級分層列出所有配方的材料需求與產出；需要新增/調整合成配方或確認哪些配方在哪個等級解鎖時必看此檔案。
---

# inventory/data/recipes.ts

> 模組：inventory｜角色：純靜態資料層，定義所有可合成的配方（不含建築放置配方和金錠熔爐配方），是 `CraftingSystem` 的唯一資料來源。

## 公開 API

- `RECIPES: Record<string, RecipeDef>` — 所有配方，key 為 recipeId 字串。每個 `RecipeDef` 包含 `{ id, name, requires: Array<{ itemId, amount }>, produces: Array<{ itemId, amount }>, unlockLevel: number }`。

## 核心邏輯

**RecipeDef schema 與代表性條目（共 38 個 recipeId）：**

```typescript
// RecipeDef: { id, name, requires: [{itemId, amount}], produces: [{itemId, amount}], unlockLevel }

// Lv 1 — 基礎製作（4 種）
plank:      { id: 'plank',      requires: [{itemId:'wood',  amount:2}],
              produces: [{itemId:'plank', amount:4}], unlockLevel: 1 },
axe:        { id: 'axe',        requires: [{itemId:'wood',  amount:5}, {itemId:'stone', amount:3}],
              produces: [{itemId:'axe',   amount:1}], unlockLevel: 1 },
pickaxe:    { id: 'pickaxe',    requires: [{itemId:'plank', amount:3}, {itemId:'stone', amount:5}],
              produces: [{itemId:'pickaxe', amount:1}], unlockLevel: 1 },
stone_sword:{ id: 'stone_sword',requires: [{itemId:'stone', amount:6}, {itemId:'plank', amount:2}],
              produces: [{itemId:'stone_sword', amount:1}], unlockLevel: 1 },

// Lv 4 — 含 ingot 配方（注意 ingot 在表中但熔爐是正規來源）
ingot:      { id: 'ingot', requires: [{itemId:'iron', amount:3}, {itemId:'wood', amount:1}],
              produces: [{itemId:'ingot', amount:1}], unlockLevel: 4 },
iron_sword: { id: 'iron_sword', requires: [{itemId:'ingot', amount:4}, {itemId:'plank', amount:2}],
              produces: [{itemId:'iron_sword', amount:1}], unlockLevel: 4 },

// Lv 6 — 需設計圖（3 種材料）
grenade:    { id: 'grenade', requires: [{itemId:'stone',amount:5},{itemId:'ingot',amount:3},{itemId:'blueprint_4',amount:1}],
              produces: [{itemId:'grenade', amount:3}], unlockLevel: 6 },

// gourmet 的兩個 recipeId → 同一產物
gourmet_1:  { id: 'gourmet_1', requires: [{itemId:'meat',amount:1},{itemId:'spice',amount:1}],
              produces: [{itemId:'gourmet', amount:1}], unlockLevel: 6 },
gourmet_2:  { id: 'gourmet_2', requires: [{itemId:'meat',amount:2},{itemId:'spice',amount:2},{itemId:'seasoning',amount:1}],
              produces: [{itemId:'gourmet', amount:1}], unlockLevel: 8 },

// Lv 9~10
mithril_sword: { id: 'mithril_sword', requires: [{itemId:'ancient_crystal',amount:1},{itemId:'gold_sword',amount:1}],
                 produces: [{itemId:'mithril_sword', amount:1}], unlockLevel: 9 },
laser_orb:     { id: 'laser_orb', requires: [{itemId:'crystal',amount:3},{itemId:'gold_ingot',amount:2},{itemId:'blueprint',amount:1}],
                 produces: [{itemId:'laser_orb', amount:1}], unlockLevel: 10 },
```

**按 `unlockLevel` 的完整配方清單：**

**Lv 1（基礎製作，4 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| plank | wood×2 | plank×4 |
| axe | wood×5, stone×3 | axe×1 |
| pickaxe | plank×3, stone×5 | pickaxe×1 |
| stone_sword | stone×6, plank×2 | stone_sword×1 |

**Lv 2（工具與市場，3 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| bread | berry×2 | bread×1 |
| flashlight | ingot×5, crystal×2 | flashlight×1 |
| bed | wood×30, plank×15 | bed×1 |

**Lv 3（工具升級，2 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| iron_pick | ingot×3, plank×2 | iron_pick×1 |
| cooked_meat | meat×1 | cooked_meat×1 |

**Lv 4（弓箭與金武器，5 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| wood_bow | wood×10, leather×10 | wood_bow×1 |
| arrow | wood×10 | arrow×50 |
| ingot | iron×3, wood×1 | ingot×1 |
| iron_sword | ingot×4, plank×2 | iron_sword×1 |
| gold_sword | gold_ingot×4, plank×2 | gold_sword×1 |

**Lv 5（防具、弓箭升級、背包，8 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| bag_small | leather×30 | bag_small×1 |
| leather_armor | leather×10 | leather_armor×1 |
| iron_armor | iron×20 | iron_armor×1 |
| gold_armor | gold_ingot×4 | gold_armor×1 |
| iron_bow | iron×5, wood×10 | iron_bow×1 |
| fire_arrow | arrow×10, fire_essence×1 | fire_arrow×10 |
| ice_arrow | arrow×10, ice_essence×1 | ice_arrow×10 |
| shield | plank×8, iron×5 | shield×1 |

**Lv 6（防禦陷阱，5 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| spike_trap | wood×5, stone×5 | spike_trap×1 |
| fire_trap | wood×5, iron×3 | fire_trap×1 |
| grenade | stone×5, ingot×3, blueprint_4×1 | grenade×3 |
| laser_gun | crystal×3, ingot×5, blueprint_1×1 | laser_gun×1 |
| gourmet_1 | meat×1, spice×1 | gourmet×1 |

**Lv 7（進階魔法，4 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| ice_trap | wood×5, crystal×3 | ice_trap×1 |
| laser_tower | crystal×10, ingot×8, blueprint_2×1 | laser_tower×1 |
| cannon_tower | stone×15, ingot×10, blueprint_3×1 | cannon_tower×1 |
| magic_sword | crystal×5, gold_ingot×2, blueprint×1 | magic_sword×1 |

**Lv 8（魔法弓、裝備、大背包，5 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| bag_large | leather×1000 | bag_large×1 |
| magic_bow | crystal×3, blueprint×1 | magic_bow×1 |
| crystal_armor | crystal×5 | crystal_armor×1 |
| whirlwind_hammer | gold_ingot×10, crystal×5, blueprint_5×1 | whirlwind_hammer×1 |
| gourmet_2 | meat×2, spice×2, seasoning×1 | gourmet×1 |

**Lv 9（終極裝備，1 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| mithril_sword | ancient_crystal×1, gold_sword×1 | mithril_sword×1 |

**Lv 10（傳說級配方，1 種）：**
| recipeId | requires | produces |
|----------|----------|----------|
| laser_orb | crystal×3, gold_ingot×2, blueprint×1 | laser_orb×1 |

**設計規則（需遵守）：**

- 建築類配方（furnace、farm、market 等）和金錠配方（gold_ingot）不在此表——金錠來自熔爐，建築類不由 CraftingSystem 處理。
- `gourmet` 有兩個不同 recipeId（`gourmet_1`、`gourmet_2`），都產出同一個 `gourmet` itemId，但原料不同（Lv 6 / Lv 8）；這是刻意設計（多配方→相同產物）。
- 需要設計圖的配方：`grenade`(bp4)、`laser_gun`(bp1)、`laser_tower`(bp2)、`cannon_tower`(bp3)、`magic_sword`(bp 通用)、`magic_bow`(bp 通用)、`whirlwind_hammer`(bp5)、`laser_orb`(bp 通用)。

## EventBus 互動

無。

## 依賴

- `@/types` — `RecipeDef` 型別。

## 重建提示

- 新增配方時，確認 `requires` 中的所有 `itemId` 都存在於 `ITEMS` 表，否則 `Inventory.getAmount` 永遠回傳 0 導致永遠無法合成。
- `ingot` 配方（Lv 4）在表中存在，但設計說明指出熔爐才是正規金錠來源；若要把這個配方從 C menu 隱藏，在 UI 層過濾，不要從 RECIPES 移除（移除會讓 CraftingSystem.canCraft('ingot') 永遠失敗）。
- 建議 recipeId 與 produces itemId 保持一致（除 `gourmet_1`/`gourmet_2` 例外），這樣 `CraftingSystem.getAvailableRecipes` 的回傳陣列可以直接作為 itemId 用。
- 總共約 38 個 recipeId；未來若要從 UI 按等級分組，直接對 RECIPES 做 `Object.values().filter(r => r.unlockLevel === n)` 即可。
