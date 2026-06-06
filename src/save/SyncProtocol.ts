// Agent 8 負責 — src/save/SyncProtocol.ts
// Client 玩家加入房間時，把自己的存檔資料打包給 Host
import type { PlayerData } from '@/types'
import { WORLD_CONFIG } from '@/world/WorldGen'
import { t } from '@/core/i18n'

export class SyncProtocol {
  /** 將玩家資料序列化，準備透過網路發送 */
  static exportPlayerData(playerData: PlayerData): string {
    return JSON.stringify(playerData)
  }

  /** 反序列化玩家資料 */
  static importPlayerData(json: string): PlayerData {
    const data = JSON.parse(json) as PlayerData
    // 基本驗證
    if (!data.id || !data.name) throw new Error(t('save.invalidPlayerData', undefined, '無效的玩家資料'))
    return data
  }

  /** 從 localStorage 讀取本地玩家資料 */
  static getLocalPlayer(): PlayerData | null {
    const raw = localStorage.getItem('forager_player')
    if (!raw) return null
    try { return JSON.parse(raw) as PlayerData } catch { return null }
  }

  /** 儲存玩家資料到 localStorage */
  static saveLocalPlayer(data: PlayerData): void {
    localStorage.setItem('forager_player', JSON.stringify(data))
  }

  /** 建立全新玩家（第一次遊玩） */
  static createNewPlayer(name: string): PlayerData {
    return {
      id: crypto.randomUUID(),
      name,
      x: WORLD_CONFIG.CENTER_X, y: WORLD_CONFIG.CENTER_Y,
      hp: 100, maxHp: 100,
      xp: 0, level: 1,
      researchLevel: 1,
      gold: 0,
      inventory: [],
      unlockedSkills: [],
      color: Math.floor(Math.random() * 0xffffff),
    }
  }
}
