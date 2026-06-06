---
name: inventory-data-research-upgrade-costs
description: 研究所升級成本配置表 — 定義 Lv 2~10 每個研究等級所需材料、黃金和升級時間；需要重建研究系統升級邏輯或 UI 顯示升級成本時必看此檔案。
---

# inventory/data/researchUpgradeCosts.ts

> 模組：inventory｜角色：純靜態資料層，以 `ResearchUpgradeCost[]` 陣列定義研究所從目前等級升到下一等級的所有成本，供研究 UI 和研究升級邏輯查詢。

## 公開 API

- `ResearchUpgradeCost` (interface) — 單筆升級成本 schema：
  - `level: number` — 升級到此等級（即目標等級，範圍 2~10）。
  - `materials: Array<{ itemId: ItemId; amount: number }>` — 消耗材料（1~2 種）。
  - `gold: number` — 消耗黃金數量。
  - `durationSecs: number` — 升級所需秒數。
  - `unlocksDescription: string` — 此等級解鎖內容說明（i18n lazy getter）。
- `RESEARCH_UPGRADE_COSTS: ResearchUpgradeCost[]` — 9 筆升級成本陣列（Lv 1→2 到 Lv 9→10），以目標等級升序排列。
- `getResearchUpgradeCost(toLevel: number): ResearchUpgradeCost | undefined` — 查詢升到指定等級的成本；找不到（level 不在 2~10 範圍）回傳 `undefined`。

## 核心邏輯

**`ResearchUpgradeCost` interface：**

```typescript
export interface ResearchUpgradeCost {
  level: number                                   // 升級到此等級（2~10）
  materials: Array<{ itemId: ItemId; amount: number }>
  gold: number
  durationSecs: number
  unlocksDescription: string                      // lazy getter，讀取時才呼叫 t()
}
```

**`makeEntry` 工廠函數 — lazy getter 與 `rarityEntry` 同一模式：**

```typescript
function makeEntry(
  base: Omit<ResearchUpgradeCost, 'unlocksDescription'>,
  key: string,
  fallback: string,
): ResearchUpgradeCost {
  return Object.defineProperty({ ...base }, 'unlocksDescription', {
    get() { return t(key, undefined, fallback) },
    enumerable: true,
    configurable: true,
  }) as ResearchUpgradeCost
}
```

**代表性條目（共 9 筆，Lv 2~10）：**

```typescript
export const RESEARCH_UPGRADE_COSTS: ResearchUpgradeCost[] = [
  makeEntry({ level: 2, materials: [{itemId:'stone', amount:20}],          gold: 500,    durationSecs: 5   }, 'research.lv2.unlocks', '市場 + 食物配方'),
  makeEntry({ level: 3, materials: [{itemId:'ingot', amount:5}],           gold: 1000,   durationSecs: 10  }, 'research.lv3.unlocks', '工具升級配方'),
  makeEntry({ level: 4, materials: [{itemId:'gold_ingot', amount:10}],     gold: 3000,   durationSecs: 20  }, 'research.lv4.unlocks', '武器配方 + 弓箭'),
  makeEntry({ level: 5, materials: [{itemId:'crystal', amount:5}],         gold: 5000,   durationSecs: 30  }, 'research.lv5.unlocks', '防具配方'),
  makeEntry({ level: 6, materials: [{itemId:'crystal',amount:10},{itemId:'blueprint_1',amount:1}], gold: 10000, durationSecs: 60  }, 'research.lv6.unlocks', '防禦陷阱配方'),
  makeEntry({ level: 7, materials: [{itemId:'crystal',amount:20},{itemId:'blueprint_2',amount:1}], gold: 20000, durationSecs: 120 }, 'research.lv7.unlocks', '守城兵器升級'),
  makeEntry({ level: 8, materials: [{itemId:'crystal',amount:50},{itemId:'blueprint_3',amount:1}], gold: 50000, durationSecs: 180 }, 'research.lv8.unlocks', '進階魔法配方'),
  makeEntry({ level: 9,  materials: [{itemId:'ancient_crystal', amount:5}],                         gold: 100000, durationSecs: 300 }, 'research.lv9.unlocks',  '終極裝備配方'),
  makeEntry({ level: 10, materials: [{itemId:'ancient_crystal',amount:10},{itemId:'blueprint_5',amount:1}], gold: 200000, durationSecs: 600 }, 'research.lv10.unlocks', '傳說級配方'),
]
```

**`getResearchUpgradeCost` — 線性查找：**

```typescript
export function getResearchUpgradeCost(toLevel: number): ResearchUpgradeCost | undefined {
  return RESEARCH_UPGRADE_COSTS.find(c => c.level === toLevel)
}
```

**升級成本完整表（共 9 筆）：**

| 目標 Lv | 材料 | 黃金 | 升級秒數 | unlocksDescription fallback |
|--------|------|------|----------|----------------------------|
| 2 | stone×20 | 500 | 5 | 市場 + 食物配方 |
| 3 | ingot×5 | 1000 | 10 | 工具升級配方 |
| 4 | gold_ingot×10 | 3000 | 20 | 武器配方 + 弓箭 |
| 5 | crystal×5 | 5000 | 30 | 防具配方 |
| 6 | crystal×10, blueprint_1×1 | 10000 | 60 | 防禦陷阱配方 |
| 7 | crystal×20, blueprint_2×1 | 20000 | 120 | 守城兵器升級 |
| 8 | crystal×50, blueprint_3×1 | 50000 | 180 | 進階魔法配方 |
| 9 | ancient_crystal×5 | 100000 | 300 | 終極裝備配方 |
| 10 | ancient_crystal×10, blueprint_5×1 | 200000 | 600 | 傳說級配方 |

**`getResearchUpgradeCost` 實作：**

- `RESEARCH_UPGRADE_COSTS.find(c => c.level === toLevel)` — 線性查找。
- 查不到（toLevel = 1 或 > 10）回傳 `undefined`；呼叫端需做 optional chaining 或 undefined 判斷。

**i18n key 格式：**

- `research.lv2.unlocks` ~ `research.lv10.unlocks`（共 9 個 key）。

**設計特點：**

- `durationSecs` 從 5 秒（Lv 2）增長到 600 秒（Lv 10），呈非線性遞增（5→10→20→30→60→120→180→300→600）。
- `gold` 成本：500 → 200000，每級大幅增加。
- 高等級升級（Lv 6~10）需要設計圖（blueprint_1~5），玩家需先從遺跡/Boss 取得。
- Lv 9→10 的升級 blueprint_4 不在材料中（blueprint_5 才在），注意 Lv 8 升 9 只需 ancient_crystal，Lv 9 升 10 需要 blueprint_5。

## EventBus 互動

無。

## 依賴

- `@/types` — `ItemId` 型別。
- `@/core/i18n` — `t()` 函數，用於 `unlocksDescription` 的 lazy getter。

## 重建提示

- `RESEARCH_UPGRADE_COSTS` 陣列索引 0 對應升到 Lv 2；若要升到 Lv N，呼叫 `getResearchUpgradeCost(N)` 而非直接用陣列索引（避免 off-by-one）。
- 此資料表未從 `index.ts` 重新匯出，外部要存取需直接 `import { RESEARCH_UPGRADE_COSTS, getResearchUpgradeCost } from '@/inventory/data/researchUpgradeCosts'`（或相對路徑）。
- `unlocksDescription` 的 lazy getter 行為與 `RARITY_CONFIG.label` 相同：`JSON.stringify` 不會觸發 getter，序列化時需手動展開。
- 升級條件驗證（扣材料 + 扣黃金 + 開始計時）的邏輯不在此檔案，此檔案只有資料定義；實際扣除應由研究系統模組透過 EventBus 呼叫 Inventory.remove。
- `durationSecs` 是設計數值；若想讓升級即時完成（debug 用），可在研究系統模組暫時忽略此欄，但不要修改這個資料表。
