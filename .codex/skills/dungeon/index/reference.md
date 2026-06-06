---
name: dungeon-index
description: Look up here when rebuilding the dungeon module's public export surface — what to import and from where.
---

# dungeon/index.ts

> 模組：dungeon｜角色：公開介面匯出點 — 將 DungeonGenerator 與 DungeonScene 的符號集中對外暴露

## 公開 API

```typescript
export { generateDungeon } from './DungeonGenerator'
export type { DungeonLayout, DRoom, DCorridor } from './DungeonGenerator'
export { DungeonScene } from './DungeonScene'
export type { DungeonEnemy, DungeonChest } from './DungeonScene'
```

## 核心邏輯

此檔案為純 re-export barrel，無任何邏輯。全部 4 行，小於 50 LOC，直接完整保留如上。

## EventBus 互動

無 — 僅 re-export，不直接使用 EventBus。

## 依賴

- `./DungeonGenerator` — 生成函式與佈局型別
- `./DungeonScene` — PixiJS 場景類別與實體型別

## 重建提示

- `DungeonLayout`、`DRoom`、`DCorridor`、`DungeonEnemy`、`DungeonChest` 都是 `export type`，僅供型別使用，不會出現在 JS bundle 中。
- 消費方（如整合層）應從 `@/dungeon` 路徑引入，而非直接引入子檔案。
- 若新增 generator 的公開型別（例如未來的 `DFloor`），需同步更新此 barrel；遺漏會導致外部模組無法 type-import。
