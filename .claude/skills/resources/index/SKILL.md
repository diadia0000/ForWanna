---
name: resources-index
description: resources 模組的公開出口檔，重建時第一個建立它來確認模組對外暴露的 API 邊界是否正確。
---

# resources/index.ts

> 模組：resources｜角色：barrel export，統一聚合 resources 子模組的所有公開符號，讓外部只需 `import { ... } from '@/resources'`

## 公開 API

- `ResourceNodeEntity` — re-export 自 `./ResourceNode`，PixiJS 視覺實體類別
- `Spawner` — re-export 自 `./Spawner`，資源節點的生成與管理器類別
- `RESOURCE_CONFIG` — re-export 自 `./resourceConfig`，所有資源類型的 HP/掉落/respawn 設定表（`Record<string, ResourceConfig>`）
- `ResourceConfig` (type) — re-export 自 `./resourceConfig`，單一資源設定的介面型別

## 核心邏輯

純 re-export 桶，無任何運行時邏輯。完整檔案內容：

```typescript
export { ResourceNodeEntity } from './ResourceNode'
export { Spawner }            from './Spawner'
export { RESOURCE_CONFIG }    from './resourceConfig'
export type { ResourceConfig } from './resourceConfig'
```

注意：`spawnConfig.ts` 的符號（`RESOURCE_SPAWN_RULES`、`pickResourceForSpawn` 等）並未從此入口暴露，屬於模組內部使用。

## EventBus 互動

無

## 依賴

- `./ResourceNode` — 引入 `ResourceNodeEntity`
- `./Spawner` — 引入 `Spawner`
- `./resourceConfig` — 引入 `RESOURCE_CONFIG` 與 `ResourceConfig`

## 重建提示

- 最後寫這個檔案：先確定 ResourceNode、Spawner、resourceConfig 三個檔案的 export 名稱固定後再填。
- `spawnConfig` 不對外暴露，如果外部需要 `canSpawnResourceOn`、`pickResourceForSpawn` 等工具函式，直接從 `@/resources/spawnConfig` 深層 import，不要加進這個 barrel。
- 保持 `export type` 語法（TypeScript isolatedModules 要求）。
