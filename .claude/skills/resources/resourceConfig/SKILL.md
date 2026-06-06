---
name: resources-resource-config
description: 所有資源類型的平衡數值表（HP、掉落物、respawn 秒數），重建時必須先填這張表才能讓採集系統正確計算傷害與產出。
---

# resources/resourceConfig.ts

> 模組：resources｜角色：靜態資料表，定義每種資源節點的血量、掉落物與重生時間，是採集平衡的唯一來源

## 公開 API

- `ResourceConfig` (interface) — 單一資源節點的設定結構
  ```
  {
    hp:          number                                  // 最大血量
    drops:       Array<{ itemId: string; amount: number }> // 掉落物清單
    respawnTime: number                                  // 重生秒數
  }
  ```
- `RESOURCE_CONFIG: Record<string, ResourceConfig>` — 以資源類型字串為鍵的設定物件

## 核心邏輯

純靜態資料，無函式邏輯。

```typescript
export interface ResourceConfig {
  hp:          number
  drops:       Array<{ itemId: string; amount: number }>
  respawnTime: number   // 單位：秒；Spawner 使用時乘 1000 轉 ms
}

export const RESOURCE_CONFIG: Record<string, ResourceConfig> = {
  // 工具效率：fist 0.5 / axe 2.0 / pickaxe 3.0 / iron_pick 5.0
  tree:    { hp: 5,  drops: [{ itemId: 'wood',    amount: 4 }], respawnTime: 30  },
  rock:    { hp: 8,  drops: [{ itemId: 'stone',   amount: 4 }], respawnTime: 45  },
  iron:    { hp: 10, drops: [{ itemId: 'iron',    amount: 3 }], respawnTime: 60  },
  gold:    { hp: 15, drops: [{ itemId: 'gold',    amount: 2 }], respawnTime: 90  },
  crystal: { hp: 20, drops: [{ itemId: 'crystal', amount: 2 }], respawnTime: 120 },
  berry:   { hp: 3,  drops: [{ itemId: 'berry',   amount: 3 }], respawnTime: 20  },
  tomato:  { hp: 3,  drops: [{ itemId: 'tomato',  amount: 3 }], respawnTime: 20  },
  purple_grape: { hp: 3, drops: [{ itemId: 'purple_grape', amount: 3 }], respawnTime: 20 },
  onion:   { hp: 3,  drops: [{ itemId: 'onion',   amount: 3 }], respawnTime: 20  },
  carrot:  { hp: 3,  drops: [{ itemId: 'carrot',  amount: 3 }], respawnTime: 20  },
  pumpkin: { hp: 3,  drops: [{ itemId: 'pumpkin', amount: 3 }], respawnTime: 20  },
  watermelon: { hp: 3, drops: [{ itemId: 'watermelon', amount: 3 }], respawnTime: 20 },
  fire_node: { hp: 12, drops: [{ itemId: 'fire_essence', amount: 2 }], respawnTime: 120 },
  ice_node:  { hp: 12, drops: [{ itemId: 'ice_essence',  amount: 2 }], respawnTime: 120 },
}
```

工具效率對應（非此檔內容，但同一設計文件）：fist 0.5、axe 2.0、pickaxe 3.0、iron_pick 5.0。這些係數乘以傷害後與 hp 比較。

所有食物資源 (berry 系列) hp 固定 3、drops ×3、respawnTime 20 秒，是同一批次定義的模式。

## EventBus 互動

無

## 依賴

無（純資料物件，無 import）

## 重建提示

- 先建這個檔案，因為 Spawner 和 ResourceNode 都要 import `RESOURCE_CONFIG`。
- `ResourceConfig` 的 `drops` 是陣列，支援多種掉落物（目前每種資源只有一筆，但架構上是陣列）。
- respawnTime 的單位是**秒**；Spawner 在排程 setTimeout 時乘以 1000 轉毫秒。
- 新增資源類型只需在 RESOURCE_CONFIG 加一筆，再配合 spawnConfig.ts 的 RESOURCE_SPAWN_RULES 加入生成規則即可。
- 注意 fire_node / ice_node 的 hp 是 12（高於普通 rock 的 8），確保特殊生物群資源需要鐵鎬才能高效採集。
