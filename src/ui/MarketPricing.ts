// src/ui/MarketPricing.ts — 市場價格系統（品級驅動）

import { ITEMS, ITEM_RARITY, RARITY_CONFIG } from '@/inventory'

/** 每日設計圖特賣 — 固定售價 */
export const BLUEPRINT_PRICE = 100_000
const DAILY_BLUEPRINTS = ['blueprint_1', 'blueprint_2', 'blueprint_3', 'blueprint_4', 'blueprint_5'] as const

function toGoldInt(value: number): number {
  return Math.max(0, Math.round(value))
}

/** 市場動態定價系統 */
export class MarketPricing {
  private todaysPrices: Map<string, number> = new Map()
  private lastDay = -1

  private _init(gameDay: number): void {
    if (this.lastDay === gameDay) return
    this.lastDay = gameDay
    this.todaysPrices.clear()

    // seeded RNG：同一天同樣的種子 → 同樣的價格
    let seed = (gameDay * 1103515245 + 12345) & 0x7fffffff
    const rng = (): number => {
      seed = (seed * 1664525 + 1013904223) & 0x7fffffff
      return seed / 0x7fffffff
    }

    for (const [id, def] of Object.entries(ITEMS)) {
      if ((def.sellPrice ?? 0) <= 0) continue
      const rarity   = ITEM_RARITY[id] ?? 'common'
      const mult     = RARITY_CONFIG[rarity].priceMult
      const variance = 0.8 + rng() * 0.4
      this.todaysPrices.set(id, Math.max(1, toGoldInt(def.sellPrice * mult * variance)))
    }
  }

  /** 取得物品的當前售價（傳入遊戲天數） */
  getPrice(itemId: string, gameDay = 0): number {
    this._init(gameDay)
    return this.todaysPrices.get(itemId) ?? 0
  }

  /** 計算售賣 X 件物品能得多少金幣 */
  calculateGold(itemId: string, amount: number, gameDay = 0): number {
    const price = this.getPrice(itemId, gameDay)
    return price > 0 && amount > 0 ? toGoldInt(price * amount) : 0
  }

  /** 取得所有可售物品的清單（price > 0） */
  getSellableItems(gameDay = 0): string[] {
    this._init(gameDay)
    return Array.from(this.todaysPrices.keys())
  }

  /** 今日特賣設計圖（同一遊戲天固定同一張，隔天換） */
  getDailyBlueprint(gameDay = 0): string {
    return DAILY_BLUEPRINTS[gameDay % DAILY_BLUEPRINTS.length]
  }
}

export const marketPricing = new MarketPricing()
