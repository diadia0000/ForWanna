---
name: resources-spawn-config
description: 資源生成規則表與加權隨機選取工具，重建時參考它來正確復現「哪個環形、哪種地塊可生成哪類資源」的生態分布邏輯。
---

# resources/spawnConfig.ts

> 模組：resources｜角色：靜態規則表 + 純函式工具，定義每種資源的可生成環形、地塊、權重，並提供加權隨機選取 API

## 公開 API

- `SpawnRingRange = number | { min: number; max?: number }` (type) — 單一環形範圍，數字表示精確環號，物件表示 min~max 區間（max 省略表示無上限）
- `SpawnRingRule = 'all' | SpawnRingRange | SpawnRingRange[]` (type) — 環形匹配規則，`'all'` 全環可用，陣列取聯集
- `ResourceSpawnRule` (interface):
  ```
  {
    id:     string           // 對應 RESOURCE_CONFIG 的鍵
    rings:  SpawnRingRule    // 適用環形
    tiles:  TileType[]       // 適用地塊類型
    weight: number           // 加權隨機權重
  }
  ```
- `FOOD_RESOURCE_IDS: readonly string[]` — 食物資源 id 陣列，共 7 項：berry、tomato、purple_grape、onion、carrot、pumpkin、watermelon
- `RESOURCE_SPAWN_RULES: ResourceSpawnRule[]` — 完整生成規則表（14 條，見下表）
- `canSpawnInRing(rule: SpawnRingRule, ring: number): boolean` — 判斷 ring 號是否符合給定的環形規則
- `canSpawnResourceOn(type: string, ring: number, tile: TileType): boolean` — 判斷指定資源能否在此環形、地塊上生成
- `getSpawnableResourceRules(ring: number, tile: TileType): ResourceSpawnRule[]` — 回傳在此環形、地塊上所有有效規則（weight > 0）
- `pickFoodResource(rng?: () => number): string` — 從 FOOD_RESOURCE_IDS 等機率隨機選一個；rng 預設 Math.random
- `pickResourceForSpawn(ring: number, tile: TileType, rng?: () => number): string | null` — 加權隨機選取一個資源類型，無合適規則時回傳 null

## 核心邏輯

### 類型定義

```typescript
export type SpawnRingRange = number | { min: number; max?: number }
export type SpawnRingRule  = 'all' | SpawnRingRange | SpawnRingRange[]

export interface ResourceSpawnRule {
  id:     string
  rings:  SpawnRingRule
  tiles:  TileType[]
  weight: number
}

export const FOOD_RESOURCE_IDS = [
  'berry', 'tomato', 'purple_grape', 'onion', 'carrot', 'pumpkin', 'watermelon',
] as const
```

### RESOURCE_SPAWN_RULES 完整表

```typescript
export const RESOURCE_SPAWN_RULES: ResourceSpawnRule[] = [
  { id: 'tree',         rings: 'all',      tiles: ['grass'],                       weight: 40 },
  { id: 'rock',         rings: 'all',      tiles: ['grass','stone','sand','snow'],  weight: 22 },
  { id: 'iron',         rings: { min: 1 }, tiles: ['stone','snow'],                weight: 35 },
  { id: 'gold',         rings: 'all',      tiles: ['grass','stone','sand','snow'],  weight: 12 },
  { id: 'crystal',      rings: { min: 1 }, tiles: ['stone','sand','snow'],         weight: 10 },
  { id: 'fire_node',    rings: { min: 1 }, tiles: ['sand'],                        weight: 16 },
  { id: 'ice_node',     rings: { min: 1 }, tiles: ['snow'],                        weight: 11 },
  { id: 'berry',        rings: 'all',      tiles: ['grass'],                       weight: 2  },
  { id: 'tomato',       rings: 'all',      tiles: ['grass'],                       weight: 2  },
  { id: 'purple_grape', rings: 'all',      tiles: ['grass'],                       weight: 2  },
  { id: 'onion',        rings: 'all',      tiles: ['grass'],                       weight: 2  },
  { id: 'carrot',       rings: 'all',      tiles: ['grass'],                       weight: 2  },
  { id: 'pumpkin',      rings: 'all',      tiles: ['grass'],                       weight: 2  },
  { id: 'watermelon',   rings: 'all',      tiles: ['grass'],                       weight: 2  },
]
```

重點：iron/crystal/fire_node/ice_node 限制 ring >= 1，表示只在中心島以外生成；食物每種 weight 只有 2（相對於 tree 40），極低機率出現。

### `canSpawnInRing` 遞迴邏輯

```typescript
export function canSpawnInRing(rule: SpawnRingRule, ring: number): boolean {
  if (rule === 'all') return true
  if (Array.isArray(rule)) return rule.some(part => canSpawnInRing(part, ring))
  if (typeof rule === 'number') return ring === rule
  if (ring < rule.min) return false
  return rule.max === undefined || ring <= rule.max
}
```

### `pickResourceForSpawn` 加權隨機

```typescript
export function pickResourceForSpawn(
  ring: number,
  tile: TileType,
  rng: () => number = Math.random,
): string | null {
  const rules = getSpawnableResourceRules(ring, tile)
  const total = rules.reduce((sum, rule) => sum + rule.weight, 0)
  if (total <= 0) return null
  let roll = rng() * total
  for (const rule of rules) {
    roll -= rule.weight
    if (roll <= 0) return rule.id
  }
  return rules[rules.length - 1]?.id ?? null   // 浮點誤差兜底
}
```

### `pickFoodResource`

等機率：`FOOD_RESOURCE_IDS[Math.floor(rng() * FOOD_RESOURCE_IDS.length)] ?? 'berry'`；長度固定 7。

## EventBus 互動

無

## 依賴

- `@/types` — `TileType`（地塊類型聯合型別）

## 重建提示

- `SpawnRingRule` 的型別嵌套允許 `[{ min: 1, max: 2 }, { min: 5 }]` 這種複合規則，但目前規則表只用 `'all'` 或 `{ min: N }` 兩種形式。
- `pickResourceForSpawn` 的 rng 參數讓測試可注入固定亂數，Host 端直接用 Math.random 即可。
- `FOOD_RESOURCE_IDS` 是 `as const` 定義，如果要新增食物需同時更新 RESOURCE_CONFIG、RESOURCE_SPAWN_RULES 及此陣列三處。
- `canSpawnResourceOn` 是單點查詢（一個類型、一個位置），`getSpawnableResourceRules` 是批次查詢（一個位置的所有候選）；Spawner 呼叫後者再傳給 `pickResourceForSpawn`。
- 此檔案不從 index.ts 對外暴露，Spawner 直接 `import { pickResourceForSpawn } from './spawnConfig'` 深層引用。
