---
name: game-db
description: Dexie/IndexedDB schema definition — look here when rebuilding the database tables, version, primary keys, and indexes.
---

# save/GameDB.ts

> 模組：save｜角色：持久層定義，封裝 Dexie 資料庫，宣告所有 table schema

## 公開 API

- `GameDB` — Dexie 子類別，暴露 `worlds`、`players` 兩個 typed Table
- `db` — 全域單例 `GameDB` 實例，由 `SaveManager` 直接 import 使用

## 核心邏輯

### Dexie 繼承與 Table 宣告

TypeScript 需要先宣告 class field，Dexie 在 `this.version().stores()` 呼叫後才會填充它們。

```typescript
import Dexie, { type Table } from 'dexie'
import type { WorldData, PlayerData } from '@/types'

export class GameDB extends Dexie {
  worlds!:  Table<WorldData & { id?: number; saveName: string }>
  players!: Table<PlayerData & { id: string }>

  constructor() {
    super('ForagerMultiplayerDB')
    this.version(1).stores({
      worlds:  '++id, saveName',
      players: 'id',
      meta:    '++id, name',
    })
  }
}

export const db = new GameDB()
```

### Schema 細節

| Table | 主鍵 | 索引 | 行型別 |
|-------|------|------|--------|
| `worlds` | `++id`（自動遞增整數） | `saveName`（非 unique，靠應用層去重） | `WorldData & { id?: number; saveName: string }` |
| `players` | `id`（PlayerId string） | — | `PlayerData & { id: string }` |
| `meta` | `++id` | `name` | 保留表，目前未用 |

資料庫名稱：`ForagerMultiplayerDB`，schema version：`1`。

## EventBus 互動

（本檔案無 EventBus 呼叫，純粹為持久層定義）

## 依賴

- `dexie` — IndexedDB ORM，package.json 已有
- `@/types` — `WorldData`、`PlayerData` 型別（唯讀 import，不可修改）

## 重建提示

- `++id` 是 Dexie 自動遞增主鍵語法；Dexie **不支援** schema upgrade 時更改主鍵類型，若未來需要換主鍵必須建新 version 並 migrate 資料。
- `saveName` 故意設為普通索引（非 `&saveName` unique），因為 unique 索引在 `put` 時會衝突；去重邏輯移交給 `SaveManager.saveWorld()`（先 delete 同名再 add）。
- `meta` 表目前未使用但保留在 schema，不可刪——Dexie 只允許向前 migration，移除 store 需升 version。
- `players` 主鍵是 `id`（string UUID），直接 `put()` 即可 upsert。
- `db` 為模組級單例，避免重複建立多個 Dexie 連線。
