---
name: render-index
description: Look up the public surface of the render module — which classes, functions and types are re-exported (and which internal files stay private).
---

# render/index.ts

> 模組：render｜角色：模組桶檔（barrel）— 對外只暴露 render 的公開 API；其餘消費者一律從 `@/render` import，不直接碰子檔。

## 公開 API（完整 re-export 清單）

```typescript
export { FxLayer } from './FxLayer'

export { DayNight } from './DayNight'
export type { DayPhase } from './DayNight'

export {
  EntitySpriteDriver,
  getEntitySpriteManifest,
  hasEntitySpriteManifest,
  loadEntitySpriteManifestCollection,
} from './EntitySpriteDriver'
export type {
  EntityAnimationState,
  EntityDirection,
  EntitySpriteFrame,
  EntitySpriteManifest,
} from './EntitySpriteDriver'

export {
  createTileSprite,
  createTileSpriteSync,
  hasAnyTileSprite,
  hasTileSprite,
  loadTileSpriteRegistry,
} from './TileSpriteRegistry'
```

## 未從 index 匯出（刻意私有 / 由其他入口取用）

- `AssetLoader.ts` — `loadGameAssets`、`RESOURCE_TEXTURES`、`TILE_TEXTURES` 等由啟動流程直接 import 子檔，**不**經 barrel。
- `ItemSpriteRegistry.ts` — `getItemPixiTexture`、`getItemIconMarkup`、`hasItemSprite`、`loadItemSpriteRegistry` 由 inventory/HUD 直接 import 子檔。
- `EntitySpriteDriver` 的 `createSync` / `preloadEntitySpriteManifestAssets` 也未經 barrel re-export。

## EventBus 互動

- 無。純 re-export。

## 依賴

- `./FxLayer`、`./DayNight`、`./EntitySpriteDriver`、`./TileSpriteRegistry`。

## 重建提示

- barrel 只挑「跨模組常用」的符號；新增公開 API 時記得在這裡補 export（type 用 `export type`，避免 isolatedModules 報錯）。
- 注意 AssetLoader 與 ItemSpriteRegistry **不在** barrel 中 — 重建時別誤以為它們是私有；它們由各自 consumer 直接 deep-import。
- `DayPhase`、`EntityAnimationState`、`EntityDirection`、`EntitySpriteFrame`、`EntitySpriteManifest` 全走 `export type`。
