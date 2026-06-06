---
name: combat-index
description: 重建 combat 模組的對外匯出桶（barrel）時查這裡——哪些類別/函式/型別對外公開、哪些是內部不匯出。
---

# combat/index.ts

> 模組：combat｜角色：模組對外的 barrel export。定義 combat 公開介面的邊界——只有列在這裡的符號才算對外契約。

## 公開 API

完整檔案內容（小檔，近乎全文）：

```typescript
export { MonsterSpawner } from './MonsterSpawner'
export { MonsterEntity, MONSTER_STATS, getMonsterName } from './Monster'
export { getWeaponDef, getWeaponName, WEAPON_DEFS, FIST_DEF } from './WeaponDefs'
export type { WeaponDef } from './WeaponDefs'
export type { MonsterType } from './Monster'
export type { MonsterDrop, MonsterDelta } from './MonsterSpawner'
export { getArmorDef, getArmorName, ARMOR_DEFS } from './ArmorDefs'
export type { ArmorDef } from './ArmorDefs'
```

## 核心邏輯

對外公開的符號分類：

- **值匯出**：`MonsterSpawner`、`MonsterEntity`、`MONSTER_STATS`、`getMonsterName`、`getWeaponDef`、`getWeaponName`、`WEAPON_DEFS`、`FIST_DEF`、`getArmorDef`、`getArmorName`、`ARMOR_DEFS`
- **型別匯出**（`export type`）：`WeaponDef`、`MonsterType`、`MonsterDrop`、`MonsterDelta`、`ArmorDef`

## EventBus 互動

- 無。

## 依賴

- 本模組內部檔案：`./Monster`、`./MonsterSpawner`、`./WeaponDefs`、`./ArmorDefs`

## 重建提示

- 刻意**不**匯出的內部符號：`MonsterStats`、`AIState`、`MonsterKind`、`Difficulty`、`BuildingTarget`、`MONSTER_STATS` 以外的常數表（DIFF_MULT、各 SPAWN 表、TRAP_DEF）、`getMonsterName` 以外的繪圖內部。這些是模組私有。
- 型別與值分開用 `export type` / `export`——`MonsterType`、`WeaponDef`、`ArmorDef`、`MonsterDrop`、`MonsterDelta` 都走 `export type`（isolatedModules 友善）。
- 外部模組應只從 `@/combat`（此 barrel）import，不要深入 `@/combat/Monster` 等子路徑。
