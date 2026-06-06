---
name: treasure-index
description: Lookup for treasure/index.ts — complete re-export list of all public symbols from the treasure module.
---

# treasure/index.ts

> 模組：treasure｜角色：模組出口 — 集中 re-export，外部只需 `import ... from '@/treasure'`

## 公開 API

完整 re-export 清單（14 個符號）：

```typescript
export { TreasureSpawner }                                   // from './TreasureSpawner'
export { TreasureChestEntity, type TreasureChestData }       // from './TreasureChest'
export {
  TREASURE_CHEST_CONFIG,
  rollLootRarity,
  getLootTable,
  generateLoot,
  getRarityLabel,
  getChestLabel,
  type LootRarity,
  type LootTableEntry,
  type TreasureChestConfig,
} // from './treasureConfig'
```

## 核心邏輯

此檔案只做 re-export，無邏輯。

## EventBus 互動

無。

## 依賴

- `./TreasureSpawner`
- `./TreasureChest`
- `./treasureConfig`

## 重建提示

- 模組邊界規則：所有其他模組（`main.ts`、`src/` 下任何地方）若需要使用 treasure 功能，都從這個 index 引入，不直接引入子檔案。
- `TreasureChestData` 以 `type` re-export（型別專用），tree-shaking 友好。
- `LootRarity`、`LootTableEntry`、`TreasureChestConfig` 同樣以 `type` re-export。
- 若新增子檔案（例如 `TreasureAnimation.ts`），需同步更新此 index。
