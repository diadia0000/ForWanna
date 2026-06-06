// Agent 8 負責 — src/save/SaveManager.ts
import type { WorldData, PlayerData } from '@/types'
import { db } from './GameDB'
import { EventBus } from '@/core/EventBus'

const DEFAULT_SAVE = 'autosave'

class SaveManagerClass {
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null

  async saveWorld(worldData: WorldData, saveName = DEFAULT_SAVE): Promise<void> {
    // 先刪同名舊紀錄，再新增——確保同 saveName 只存一筆
    await db.worlds.where('saveName').equals(saveName).delete()
    await db.worlds.add({ ...worldData, saveName })
    console.log(`[Save] 世界已儲存：${saveName}`)
  }

  async loadWorld(saveName = DEFAULT_SAVE): Promise<WorldData | null> {
    const record = await db.worlds.where('saveName').equals(saveName).first()
    if (!record) return null
    const { saveName: _, ...worldData } = record
    return worldData as WorldData
  }

  async savePlayer(playerData: PlayerData): Promise<void> {
    await db.players.put(playerData)
    // 同步存到 localStorage（Client 端加入新房間時帶過去）
    localStorage.setItem('forager_player', JSON.stringify(playerData))
  }

  async loadPlayer(playerId: string): Promise<PlayerData | null> {
    return await db.players.get(playerId) ?? null
  }

  startAutoSave(intervalMs = 30_000, getWorldData: () => WorldData, saveName = DEFAULT_SAVE): void {
    this.stopAutoSave()
    this.autoSaveInterval = setInterval(async () => {
      await this.saveWorld(getWorldData(), saveName)
      EventBus.emit('save:complete', {})
    }, intervalMs)
  }

  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
    }
  }

  async listSaves(): Promise<string[]> {
    const all = await db.worlds.toArray()
    return all.map(w => w.saveName)
  }

  async listWorldsWithInfo(): Promise<{ saveName: string; createdAt: number }[]> {
    const all = await db.worlds.toArray()
    return all
      .map(w => ({ saveName: w.saveName, createdAt: w.createdAt ?? 0 }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async deleteWorld(saveName: string): Promise<void> {
    await db.worlds.where('saveName').equals(saveName).delete()
    console.log(`[Save] 世界已刪除：${saveName}`)
  }

  async renameWorld(oldName: string, newName: string): Promise<void> {
    const record = await db.worlds.where('saveName').equals(oldName).first()
    if (!record) throw new Error(`找不到存檔：${oldName}`)
    await db.worlds.where('saveName').equals(oldName).delete()
    const { id: _id, ...rest } = record as typeof record & { id?: number }
    await db.worlds.add({ ...rest, saveName: newName })
    console.log(`[Save] 存檔已重命名：${oldName} → ${newName}`)
  }
}

export const SaveManager = new SaveManagerClass()
