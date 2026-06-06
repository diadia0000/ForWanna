---
name: inventory-data-items
description: 全物品定義表與稀有度系統 — 包含每個 itemId 的名稱/圖示/maxStack/賣價，以及 5 級稀有度設定；重建任何物品 UI、交易、背包疊加上限邏輯時必看此檔案。
---

# inventory/data/items.ts

> 模組：inventory｜角色：靜態資料層，以 Record 定義所有合法 itemId 的屬性，並提供稀有度分類與顯示設定，是背包系統合法性驗證的唯一資料來源。

## 公開 API

- `ITEMS: Record<string, ItemDef>` — 所有物品定義，key 為 itemId 字串。每個 `ItemDef` 包含 `{ id, name, icon, maxStack, sellPrice }`。
- `ItemRarity` (type) — `'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'`。
- `ITEM_RARITY: Record<string, ItemRarity>` — itemId → 稀有度的映射表。
- `RARITY_CONFIG: Record<ItemRarity, { label: string; color: string; priceMult: number }>` — 每個稀有度的顯示標籤（i18n lazy getter）、十六進位色碼、售價乘數。

## 核心邏輯

**ItemDef schema 與代表性條目（共約 58 種）：**

```typescript
// ItemDef: { id, name, icon, maxStack, sellPrice }
// 原料：maxStack 999，sellPrice 低
wood:    { id: 'wood',    name: '木材', icon: '🪵', maxStack: 999, sellPrice: 0.5 },
stone:   { id: 'stone',   name: '石頭', icon: '🪨', maxStack: 999, sellPrice: 0.5 },
iron:    { id: 'iron',    name: '鐵礦', icon: '⬛', maxStack: 999, sellPrice: 2   },
gold:    { id: 'gold',    name: '金礦', icon: '🟨', maxStack: 999, sellPrice: 5   },
crystal: { id: 'crystal', name: '水晶', icon: '💎', maxStack: 99,  sellPrice: 20  },

// 加工品
plank:      { id: 'plank',      name: '木板', icon: '🪵', maxStack: 999, sellPrice: 1  },
ingot:      { id: 'ingot',      name: '鐵錠', icon: '🔩', maxStack: 99,  sellPrice: 8  },
gold_ingot: { id: 'gold_ingot', name: '金錠', icon: '🏅', maxStack: 99,  sellPrice: 25 },

// 裝備（maxStack: 1）
stone_sword:   { ..., maxStack: 1, sellPrice: 20  },
iron_sword:    { ..., maxStack: 1, sellPrice: 60  },
gold_sword:    { ..., maxStack: 1, sellPrice: 150 },
magic_sword:   { ..., maxStack: 1, sellPrice: 400 },
mithril_sword: { ..., maxStack: 1, sellPrice: 800 },
leather_armor: { ..., maxStack: 1, sellPrice: 40  },
crystal_armor: { ..., maxStack: 1, sellPrice: 600 },

// 設計圖（Boss/遺跡掉落）
blueprint:   { id: 'blueprint',   name: '設計圖',        icon: '📜', maxStack: 10, sellPrice: 50    },
blueprint_1: { id: 'blueprint_1', name: '設計圖I（雷射槍）', icon: '📘', maxStack: 3,  sellPrice: 10000 },
// blueprint_2 ~ blueprint_5 同格式，maxStack: 3, sellPrice: 10000

// 不可售出（sellPrice: 0）
laser_tower:  { id: 'laser_tower',  name: '雷射塔', icon: '🔭', maxStack: 1, sellPrice: 0 },
cannon_tower: { id: 'cannon_tower', name: '加農砲', icon: '💣', maxStack: 1, sellPrice: 0 },
dungeon_map:  { id: 'dungeon_map',  name: '遺跡地圖', icon: '🗺️', maxStack: 9, sellPrice: 0 },
```

...等共 58 個 itemId。

**`ITEM_RARITY` schema 與代表性條目：**

```typescript
// common（15 種代表）
wood: 'common', stone: 'common', iron: 'common', bone: 'common',
feather: 'common', arrow: 'common', plank: 'common', bread: 'common',
// ... 農作物：berry, tomato, purple_grape, onion, carrot, pumpkin, watermelon

// uncommon（14 種代表）
gold: 'uncommon', leather: 'uncommon', ingot: 'uncommon',
axe: 'uncommon', pickaxe: 'uncommon', stone_sword: 'uncommon', grenade: 'uncommon',

// rare（18 種代表）
crystal: 'rare', gold_ingot: 'rare', iron_sword: 'rare', iron_pick: 'rare',
leather_armor: 'rare', iron_armor: 'rare', shield: 'rare', blueprint: 'rare',

// epic（15 種代表）
gold_sword: 'epic', magic_sword: 'epic', crystal_armor: 'epic',
laser_gun: 'epic', whirlwind_hammer: 'epic', bag_large: 'epic',
blueprint_1: 'epic', blueprint_2: 'epic', blueprint_3: 'epic',
blueprint_4: 'epic', blueprint_5: 'epic', dungeon_map: 'epic',

// legendary（2 種）
mithril_sword: 'legendary', ancient_crystal: 'legendary',
```

**`rarityEntry` 工廠函數 — label 的 i18n lazy getter：**

```typescript
function rarityEntry(key: string, fallback: string, color: string, priceMult: number) {
  return Object.defineProperty({ color, priceMult }, 'label', {
    get() { return t(key, undefined, fallback) },
    enumerable: true,
    configurable: true,
  }) as { label: string; color: string; priceMult: number }
}

export const RARITY_CONFIG = {
  common:    rarityEntry('item.rarity.common',    '普通', '#aaaaaa', 1.0),
  uncommon:  rarityEntry('item.rarity.uncommon',  '優良', '#4dcc4d', 1.5),
  rare:      rarityEntry('item.rarity.rare',      '稀有', '#4d9fff', 2.5),
  epic:      rarityEntry('item.rarity.epic',      '史詩', '#b04dff', 5.0),
  legendary: rarityEntry('item.rarity.legendary', '傳說', '#ff9900', 10.0),
}
```

`label` 是 getter，每次讀取時才呼叫 `t()`；`color` 和 `priceMult` 是普通屬性。不要對 RARITY_CONFIG entry 做 `JSON.stringify`，getter 不會被序列化。

## EventBus 互動

無。

## 依賴

- `@/types` — `ItemDef` 型別。
- `@/core/i18n` — `t()` 函數，用於 `RARITY_CONFIG` 的 lazy label getter。

## 重建提示

- 新增 item 時必須同時在 `ITEMS`、`ITEM_RARITY` 兩處加入；若遺漏 `ITEM_RARITY`，稀有度顯示會是 `undefined`，UI 會拿到 `undefined` 的 color/priceMult。
- `maxStack: 1` 的物品在 `Inventory.add` 時若已存在則疊加至 max 1，即無法重複持有——設計上 1 代表裝備類不可疊加。
- `sellPrice: 0` 的物品（laser_tower, cannon_tower, dungeon_map）在市場系統中不可出售，需在 UI 層額外判斷。
- `label` 的 lazy getter 不是 own enumerable property 的問題：雖然 `enumerable: true` 已設定，但 `JSON.stringify(entry)` 無法取得 getter 結果；不要對 RARITY_CONFIG entry 做 JSON 序列化。
- `t()` 的 key 格式：`item.rarity.common` / `.uncommon` / `.rare` / `.epic` / `.legendary`，對應 i18n locale 檔案需有這些 key。
