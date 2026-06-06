---
name: building-index
description: building/index.ts 是模組的對外入口，宣告哪些符號可被外部 import；重建時確認模組邊界、決定要不要把新 export 加進來時參考這裡。
---

# building/index.ts

> 模組：building｜角色：模組桶裝檔（barrel export），控制 building 模組的公開 API 邊界，外部使用者應透過此檔 import 而非直接引用子路徑。

## 公開 API

- `BuildingSystem` — re-export 自 `./BuildingSystem`，建築系統核心類別。
- `BUILDING_DEFS` — re-export 自 `./data/buildings`，所有建築靜態定義表。

## 核心邏輯

僅兩行 re-export，無任何邏輯。
`BUILDING_UPGRADES` 和 `TRAP_REPAIR_COST` 未從 index 匯出（屬模組內部使用）。

```typescript
export { BuildingSystem } from './BuildingSystem'
export { BUILDING_DEFS }  from './data/buildings'
```

若需新增 export，在此加一行即可：

```typescript
// 範例：把 BUILDING_UPGRADES 也公開（目前未公開）
export { BUILDING_UPGRADES } from './data/buildings'
// 範例：若 BuildingPlacer 升為跨模組 API
export { BuildingPlacer } from './BuildingPlacer'
```

## EventBus 互動

無。

## 依賴

- `./BuildingSystem` — BuildingSystem class
- `./data/buildings` — BUILDING_DEFS

## 重建提示

- 若新增 export（例如 BuildingPlacer 或 BUILDING_UPGRADES），須在此加一行 `export { ... } from '...'`。
- 外部模組（UI、Network 等）應 `import { BuildingSystem } from '@/building'` 而非 `import { BuildingSystem } from '@/building/BuildingSystem'`，保持邊界清晰。
- `BuildingPlacer` 目前未在此 export，因為它是渲染層前端元件，不屬於跨模組公開 API。
- `BUILDING_UPGRADES` 與 `TRAP_REPAIR_COST` 也未 export，表示設計上這兩張表只給 BuildingSystem 內部使用。
