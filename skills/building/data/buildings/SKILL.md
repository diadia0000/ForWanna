---
name: building-data-buildings
description: buildings.ts 定義所有建築的靜態設定（材料成本、尺寸、效果文字）、陷阱維修成本與升級配置表；重建時凡需要「知道有哪些建築、建築成本、升級材料、陷阱修復費用」都參考這裡。
---

# building/data/buildings.ts

> 模組：building｜角色：純資料配置層，不含任何邏輯；是 BuildingSystem 和 BuildingPlacer 的靜態查閱表。

## 公開 API

- `BUILDING_DEFS: Record<string, BuildingDef>` — 所有可建造建築的定義，key 為 defId 字串。
- `TRAP_REPAIR_COST: Record<string, Array<{ itemId: string; amount: number }>>` — 陷阱修復材料表（hp=0 後按 R）。
- `BUILDING_UPGRADES: Record<string, Array<{ level: number; cost: Array<{ itemId: string; amount: number }>; hp: number }>>` — 可升級建築的逐級配置。

## 核心邏輯

### BUILDING_DEFS 建築清單

`BuildingDef` 形狀：`{ id, name, cost: { itemId, amount }[], size: { x, y }, effect }`

```typescript
export const BUILDING_DEFS: Record<string, BuildingDef> = {
  furnace:        { id: 'furnace',        name: '熔爐',   cost: [{ itemId: 'stone', amount: 2 }],                                                         size: { x: 1, y: 1 }, effect: '...' },
  farm:           { id: 'farm',           name: '農場',   cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'stone', amount: 3 }],                           size: { x: 2, y: 2 }, effect: '...' },
  market:         { id: 'market',         name: '市場',   cost: [{ itemId: 'wood', amount: 8 }, { itemId: 'stone', amount: 5 }],                           size: { x: 2, y: 2 }, effect: '...' },
  research_lab:   { id: 'research_lab',   name: '工作站', cost: [{ itemId: 'wood', amount: 15 }, { itemId: 'stone', amount: 10 }, { itemId: 'iron', amount: 3 }],    size: { x: 3, y: 1 }, effect: '...' },
  wooden_bridge:  { id: 'wooden_bridge',  name: '木橋',   cost: [{ itemId: 'plank', amount: 4 }],                                                          size: { x: 1, y: 1 }, effect: '...' },
  wall:           { id: 'wall',           name: '石牆',   cost: [{ itemId: 'stone', amount: 8 }],                                                          size: { x: 1, y: 1 }, effect: '...' },
  tower:          { id: 'tower',          name: '瞭望塔', cost: [{ itemId: 'stone', amount: 12 }, { itemId: 'plank', amount: 6 }],                         size: { x: 1, y: 1 }, effect: '...' },
  spike_trap:     { id: 'spike_trap',     name: '刺製陷阱', cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'stone', amount: 5 }],                         size: { x: 1, y: 1 }, effect: '...' },
  fire_trap:      { id: 'fire_trap',      name: '火焰陷阱', cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'iron', amount: 3 }],                          size: { x: 1, y: 1 }, effect: '...' },
  ice_trap:       { id: 'ice_trap',       name: '冰凍陷阱', cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'crystal', amount: 3 }],                       size: { x: 1, y: 1 }, effect: '...' },
  base_core:      { id: 'base_core',      name: '基地核心', cost: [{ itemId: 'stone', amount: 30 }, { itemId: 'wood', amount: 10 }, { itemId: 'ingot', amount: 5 }], size: { x: 2, y: 2 }, effect: '...' },
  barracks:       { id: 'barracks',       name: '兵營',   cost: [{ itemId: 'stone', amount: 20 }, { itemId: 'ingot', amount: 8 }, { itemId: 'blueprint', amount: 1 }],  size: { x: 2, y: 2 }, effect: '...' },
  laser_tower:    { id: 'laser_tower',    name: '雷射塔', cost: [{ itemId: 'crystal', amount: 10 }, { itemId: 'ingot', amount: 8 }, { itemId: 'blueprint_2', amount: 1 }], size: { x: 1, y: 2 }, effect: '...' },
  cannon_tower:   { id: 'cannon_tower',   name: '加農砲', cost: [{ itemId: 'stone', amount: 15 }, { itemId: 'ingot', amount: 10 }, { itemId: 'blueprint_3', amount: 1 }], size: { x: 1, y: 2 }, effect: '...' },
  goddess_statue: { id: 'goddess_statue', name: '女神像', cost: [{ itemId: 'stone', amount: 30 }, { itemId: 'crystal', amount: 3 }, { itemId: 'gold_ingot', amount: 2 }], size: { x: 1, y: 1 }, effect: '...' },
}
```

### TRAP_REPAIR_COST 維修成本

```typescript
export const TRAP_REPAIR_COST: Record<string, Array<{ itemId: string; amount: number }>> = {
  spike_trap: [{ itemId: 'wood',    amount: 5 }],
  fire_trap:  [{ itemId: 'iron',    amount: 3 }],
  ice_trap:   [{ itemId: 'crystal', amount: 2 }],
}
```

### BUILDING_UPGRADES 升級表

型別：`Record<string, Array<{ level: number; cost: { itemId: string; amount: number }[]; hp: number }>>`

索引規則：`building.level` 直接作為陣列 index（剛放置時 level=1，index 1 = 第一次升級費用）。

```typescript
export const BUILDING_UPGRADES = {
  wall: [
    { level: 1, cost: [{ itemId: 'stone', amount: 8 }],                                           hp: 50  },
    { level: 2, cost: [{ itemId: 'stone', amount: 16 }],                                          hp: 75  },
    { level: 3, cost: [{ itemId: 'stone', amount: 24 }, { itemId: 'iron', amount: 5 }],           hp: 100 },
    { level: 4, cost: [{ itemId: 'stone', amount: 32 }, { itemId: 'iron', amount: 10 }],          hp: 125 },
    { level: 5, cost: [{ itemId: 'stone', amount: 40 }, { itemId: 'ingot', amount: 5 }],          hp: 150 },
  ],
  tower: [
    { level: 1, cost: [{ itemId: 'stone', amount: 12 }, { itemId: 'plank', amount: 6 }],          hp: 60  },
    { level: 2, cost: [{ itemId: 'stone', amount: 24 }, { itemId: 'plank', amount: 12 }],         hp: 90  },
    { level: 3, cost: [{ itemId: 'stone', amount: 36 }, { itemId: 'iron', amount: 8 }],           hp: 120 },
    { level: 4, cost: [{ itemId: 'stone', amount: 48 }, { itemId: 'ingot', amount: 6 }],          hp: 150 },
    { level: 5, cost: [{ itemId: 'stone', amount: 60 }, { itemId: 'ingot', amount: 12 }],         hp: 180 },
  ],
  spike_trap: [
    { level: 1, cost: [{ itemId: 'wood', amount: 5  }, { itemId: 'stone', amount: 5  }],          hp: 50  },
    { level: 2, cost: [{ itemId: 'wood', amount: 10 }, { itemId: 'stone', amount: 10 }],          hp: 75  },
    { level: 3, cost: [{ itemId: 'wood', amount: 15 }, { itemId: 'iron',  amount: 5  }],          hp: 100 },
  ],
  fire_trap: [
    { level: 1, cost: [{ itemId: 'wood', amount: 5  }, { itemId: 'iron',  amount: 3 }],           hp: 75  },
    { level: 2, cost: [{ itemId: 'wood', amount: 10 }, { itemId: 'iron',  amount: 6 }],           hp: 100 },
    { level: 3, cost: [{ itemId: 'wood', amount: 15 }, { itemId: 'ingot', amount: 4 }],           hp: 125 },
  ],
  ice_trap: [
    { level: 1, cost: [{ itemId: 'wood', amount: 5  }, { itemId: 'crystal', amount: 3  }],        hp: 100 },
    { level: 2, cost: [{ itemId: 'wood', amount: 10 }, { itemId: 'crystal', amount: 6  }],        hp: 125 },
    { level: 3, cost: [{ itemId: 'wood', amount: 15 }, { itemId: 'crystal', amount: 12 }],        hp: 150 },
  ],
  barracks: [
    { level: 1, cost: [{ itemId: 'stone', amount: 20 }, { itemId: 'ingot',   amount: 8  }],       hp: 300 },
    { level: 2, cost: [{ itemId: 'ingot', amount: 15 }, { itemId: 'stone',   amount: 30 }],       hp: 450 },
    { level: 3, cost: [{ itemId: 'ingot', amount: 25 }, { itemId: 'crystal', amount: 5  }],       hp: 600 },
  ],
  laser_tower: [
    { level: 1, cost: [{ itemId: 'crystal', amount: 10 }, { itemId: 'ingot',          amount: 8  }], hp: 120 },
    { level: 2, cost: [{ itemId: 'crystal', amount: 20 }, { itemId: 'ingot',          amount: 15 }], hp: 180 },
    { level: 3, cost: [{ itemId: 'crystal', amount: 30 }, { itemId: 'ancient_crystal', amount: 3  }], hp: 240 },
    { level: 4, cost: [{ itemId: 'crystal', amount: 45 }, { itemId: 'ancient_crystal', amount: 6  }], hp: 300 },
    { level: 5, cost: [{ itemId: 'ancient_crystal', amount: 10 }],                                    hp: 360 },
  ],
  cannon_tower: [
    { level: 1, cost: [{ itemId: 'stone', amount: 15 }, { itemId: 'ingot',           amount: 10 }], hp: 180 },
    { level: 2, cost: [{ itemId: 'stone', amount: 30 }, { itemId: 'ingot',           amount: 18 }], hp: 250 },
    { level: 3, cost: [{ itemId: 'ingot', amount: 25 }, { itemId: 'crystal',         amount: 8  }], hp: 320 },
    { level: 4, cost: [{ itemId: 'ingot', amount: 35 }, { itemId: 'crystal',         amount: 15 }], hp: 400 },
    { level: 5, cost: [{ itemId: 'crystal', amount: 20 }, { itemId: 'ancient_crystal', amount: 8 }], hp: 480 },
  ],
  base_core: [
    { level: 1,  cost: [],                                                                                       hp: 500  },
    { level: 2,  cost: [{ itemId: 'wood',            amount: 100 }, { itemId: 'stone',           amount: 50  }], hp: 650  },
    { level: 3,  cost: [{ itemId: 'wood',            amount: 200 }, { itemId: 'stone',           amount: 100 }], hp: 800  },
    { level: 4,  cost: [{ itemId: 'ingot',           amount: 100 }, { itemId: 'wood',            amount: 200 }], hp: 1000 },
    { level: 5,  cost: [{ itemId: 'ingot',           amount: 50  }, { itemId: 'gold',            amount: 100 }], hp: 1200 },
    { level: 6,  cost: [{ itemId: 'crystal',         amount: 100 }],                                             hp: 1500 },
    { level: 7,  cost: [{ itemId: 'crystal',         amount: 150 }, { itemId: 'ancient_crystal', amount: 50  }], hp: 1800 },
    { level: 8,  cost: [{ itemId: 'crystal',         amount: 200 }, { itemId: 'ancient_crystal', amount: 100 }], hp: 2200 },
    { level: 9,  cost: [{ itemId: 'crystal',         amount: 300 }, { itemId: 'ancient_crystal', amount: 150 }], hp: 2700 },
    { level: 10, cost: [{ itemId: 'crystal',         amount: 500 }, { itemId: 'ancient_crystal', amount: 250 }], hp: 3500 },
  ],
}
```

## EventBus 互動

無。

## 依賴

- `@/types` — `BuildingDef` 型別（只用於 BUILDING_DEFS 的型別標注）

## 重建提示

- `BUILDING_UPGRADES` 的 `level` 欄位與陣列 index 的對應關係：BuildingSystem.upgrade() 用 `building.level`（當前等級）做 index，取到的就是「升到下一級」的配置。建築剛放時 level=1，所以 index 1 是第一次升級的費用。
- base_core 的 level 1 cost 是空陣列（免費升第一次），是設計上的特例。
- 需要設計圖（blueprint、blueprint_2、blueprint_3）的建築（barracks、laser_tower、cannon_tower）目前在 BUILDING_DEFS 的 cost 裡已含設計圖，但 BUILDING_UPGRADES 的升級費用中不含設計圖。
- TRAP_REPAIR_COST 只涵蓋三種陷阱（spike/fire/ice），其他建築修復邏輯不在此定義。
- 型別 `BUILDING_UPGRADES` 用了 `Record<string, Array<{ level, cost: typeof BUILDING_DEFS['wall']['cost'], hp }>>` 這個略複雜的型別，重建時可簡化為 `Array<{ level: number; cost: { itemId: string; amount: number }[]; hp: number }>`。
