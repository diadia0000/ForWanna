// Agent 6 負責 — src/inventory/Inventory.ts
import type { InventoryItem, PlayerId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { ITEMS } from './data/items'

class InventorySystem {
  private inventories: Map<PlayerId, InventoryItem[]> = new Map()
  private _resourceListenerRegistered = false

  init(playerId: PlayerId): void {
    if (!this.inventories.has(playerId)) {
      this.inventories.set(playerId, [])
    }
    // 採集事件監聽只需要全域註冊一次（避免重複呼叫 init 導致多重監聽）
    if (!this._resourceListenerRegistered) {
      this._resourceListenerRegistered = true
      EventBus.on('resource:collected', ({ playerId: pid, type, amount }) => {
        const itemId = this.resourceToItemId(type)
        if (itemId) this.add(pid, itemId, amount)
      })
    }
  }

  add(playerId: PlayerId, itemId: string, amount: number, emitChange = true): boolean {
    const inv = this.getOrCreate(playerId)
    const itemDef = ITEMS[itemId]
    if (!itemDef) return false

    const existing = inv.find(i => i.itemId === itemId)
    if (existing) {
      existing.amount = Math.min(existing.amount + amount, itemDef.maxStack)
    } else {
      inv.push({ itemId, amount: Math.min(amount, itemDef.maxStack) })
    }
    if (emitChange) EventBus.emit('inventory:changed', { playerId, inventory: [...inv] })
    return true
  }

  remove(playerId: PlayerId, itemId: string, amount: number): boolean {
    const inv = this.getOrCreate(playerId)
    const existing = inv.find(i => i.itemId === itemId)
    if (!existing || existing.amount < amount) return false
    existing.amount -= amount
    if (existing.amount === 0) {
      const idx = inv.indexOf(existing)
      inv.splice(idx, 1)
    }
    EventBus.emit('inventory:changed', { playerId, inventory: [...inv] })
    return true
  }

  get(playerId: PlayerId): InventoryItem[] {
    return this.getOrCreate(playerId)
  }

  /** Client 收到 Host 的背包快照時，直接覆蓋本地資料（不觸發 EventBus，由呼叫端負責） */
  setInventory(playerId: PlayerId, inventory: InventoryItem[]): void {
    this.inventories.set(playerId, [...inventory])
  }

  getAmount(playerId: PlayerId, itemId: string): number {
    return this.getOrCreate(playerId).find(i => i.itemId === itemId)?.amount ?? 0
  }

  private getOrCreate(playerId: PlayerId): InventoryItem[] {
    if (!this.inventories.has(playerId)) this.inventories.set(playerId, [])
    return this.inventories.get(playerId)!
  }

  private resourceToItemId(type: string): string | null {
    const map: Record<string, string> = {
      tree: 'wood', rock: 'stone', iron: 'iron', gold: 'gold', crystal: 'crystal',
      fire_node: 'fire_essence', ice_node: 'ice_essence',
    }
    return map[type] ?? null
  }
}

export const Inventory = new InventorySystem()
