---
name: world-index
description: Look up here to understand what the world module exports and how external modules import from it.
---

# world/index.ts

> 模組：world｜角色：Barrel export — re-exports the public surface of the world module for consumers to import via `@/world`.

## 公開 API

All exports are re-exported from their respective implementation files:

- `WorldGen` — class; `WorldGen.generate(seed, unlockedIslands?, difficulty?)` → `WorldData`
- `WORLD_CONFIG` — const object; world dimension parameters (CHUNK_COUNT, CENTER_TILE, ISLAND_STRIDE, ISLAND_GRID_R, ISLAND_RADIUS, ISLAND_SAND_R, CENTER_X, CENTER_Y)
- `ISLAND_UNLOCK_COST` — `Record<number, number>`; ring index → gold cost
- `TileMap` — class; PixiJS tile renderer

## 核心邏輯

```typescript
export { WorldGen, WORLD_CONFIG, ISLAND_UNLOCK_COST } from './WorldGen'
export { TileMap } from './TileMap'
```

## EventBus 互動

None — this file is a pure re-export barrel.

## 依賴

- `./WorldGen` — `WorldGen`, `WORLD_CONFIG`, `ISLAND_UNLOCK_COST`
- `./TileMap` — `TileMap`

## 重建提示

- `ChunkManager` is listed in the agent contract (`agents.md`) but does not currently exist as a file — `ChunkManager.loadChunk(cx, cy)` is not yet implemented. Do not create `ChunkManager.ts` without the agent's instruction; simply note the gap.
- Consumers should import from `@/world` (the barrel), not from `@/world/WorldGen` directly, so that the public surface stays stable.
- No default exports — all named.
