---
name: treasure-config
description: Lookup for treasureConfig — complete loot table with exact drop weights and amounts, rarity roll algorithm, and i18n label helpers.
---

# treasure/treasureConfig.ts

> 模組：treasure｜角色：掉落配置與工具函數 — 定義三個稀有度的 loot 表、機率與 roll 算法

## 公開 API

- `TREASURE_CHEST_CONFIG: TreasureChestConfig` — 完整配置物件
- `rollLootRarity(): LootRarity` — 根據機率表隨機返回 `'common' | 'rare' | 'epic'`
- `getLootTable(rarity): LootTableEntry[]` — 返回指定稀有度的掉落條目陣列
- `generateLoot(rarity): Array<{ itemId: string; amount: number }>` — 實際 roll 每個條目的數量，amount=0 的條目不加入結果
- `getRarityLabel(rarity, fallback?): string` — 稀有度本地化名稱（`treasure.rarity.{rarity}`）
- `getChestLabel(rarity): string` — 寶箱類型本地化名稱（`treasure.chest.{rarity}`），fallback 為 `"{rarity} Chest"`
- `type LootRarity = 'common' | 'rare' | 'epic'`
- `interface LootTableEntry { itemId: string; amountMin: number; amountMax: number }`
- `interface TreasureChestConfig { common/rare/epic: { chance: number; loot: LootTableEntry[] } }`

## 核心邏輯

### 完整 Loot 表（必須完整保留，數值不可猜）

```typescript
export const TREASURE_CHEST_CONFIG: TreasureChestConfig = {
  common: {                              // 70%
    chance: 70,
    loot: [
      { itemId: 'wood',    amountMin: 2, amountMax: 5 },
      { itemId: 'stone',   amountMin: 1, amountMax: 3 },
      { itemId: 'iron',    amountMin: 0, amountMax: 1 },
    ],
  },
  rare: {                                // 25%
    chance: 25,
    loot: [
      { itemId: 'iron',    amountMin: 1, amountMax: 2 },
      { itemId: 'gold',    amountMin: 1, amountMax: 1 },
      { itemId: 'crystal', amountMin: 0, amountMax: 1 },
    ],
  },
  epic: {                                // 5%
    chance: 5,
    loot: [
      { itemId: 'blueprint',  amountMin: 1, amountMax: 1 },
      { itemId: 'gold_ingot', amountMin: 1, amountMax: 2 },
      { itemId: 'crystal',    amountMin: 1, amountMax: 2 },
    ],
  },
}
```

機率合計 = 100%（70 + 25 + 5）。

### Rarity Roll 算法

```typescript
export function rollLootRarity(): LootRarity {
  const roll = Math.random() * 100
  if (roll < 70)        return 'common'   // 0 <= roll < 70
  if (roll < 70 + 25)   return 'rare'     // 70 <= roll < 95
  return 'epic'                           // 95 <= roll < 100
}
```

累加式比較，不用查表結構，新增稀有度需手動維護累加值。

### Loot 生成算法

```typescript
export function generateLoot(rarity: LootRarity) {
  const result: Array<{ itemId: string; amount: number }> = []
  for (const entry of getLootTable(rarity)) {
    const amount = Math.floor(
      Math.random() * (entry.amountMax - entry.amountMin + 1)
    ) + entry.amountMin
    if (amount > 0) result.push({ itemId: entry.itemId, amount })
  }
  return result
}
```

`amountMin: 0` 的條目有機率不出現（amount=0 被過濾）。所有條目均獨立 roll，結果是**多個條目同時掉落**，不互斥。

## EventBus 互動

此檔案無 EventBus 依賴，純粹計算邏輯。

## 依賴

- `@/core/i18n` — `t()` 函數，用於 `getRarityLabel` 與 `getChestLabel` 的本地化

## 重建提示

- `rollLootRarity` 使用 `Math.random()`（非 seeded），每次開箱結果不同，且在 `TreasureSpawner._spawnIsland` 中**生成時即呼叫**，不是開箱時才 roll——稀有度在世界生成時即鎖定。
- `common.iron` 的 `amountMin: 0` 表示普通箱可能不掉鐵；`rare.crystal` 同理。
- `epic` 的 `blueprint` 是設計圖，`amountMin/Max: 1`，必定掉落（只要進 epic 分支）。
- `getRarityLabel` / `getChestLabel` 的 fallback 機制：i18n key 找不到時，前者返回 `rarity` 字串本身，後者返回 `"{rarity} Chest"`。
- 若要新增稀有度等級，需同時修改：`LootRarity` 型別、`TREASURE_CHEST_CONFIG` 物件、`rollLootRarity` 的累加邏輯、`TreasureChestEntity._buildSprite` 的 colors/glows 映射。
