// Agent 8 負責 — src/save/GameDB.ts
import Dexie, { type Table } from 'dexie'
import type { WorldData, PlayerData } from '@/types'

export class GameDB extends Dexie {
  worlds!:  Table<WorldData & { id?: number; saveName: string }>
  players!: Table<PlayerData & { id: string }>

  constructor() {
    super('ForagerMultiplayerDB')
    // 主鍵維持 ++id（Dexie 不支援升級時改主鍵）
    // saveName 作為 unique index；saveWorld() 負責刪舊再寫，確保同名只有一筆
    this.version(1).stores({
      worlds:  '++id, saveName',
      players: 'id',
      meta:    '++id, name',
    })
  }
}

export const db = new GameDB()
