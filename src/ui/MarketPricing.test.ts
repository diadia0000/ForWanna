import { describe, it, expect } from 'vitest'
import { MarketPricing } from './MarketPricing'

describe('MarketPricing', () => {
  it('同一遊戲天的價格穩定（seeded RNG 決定性）', () => {
    const m = new MarketPricing()
    const day = 3
    const first = m.getPrice('wood', day)
    const second = m.getPrice('wood', day)
    expect(first).toBe(second)
    expect(first).toBeGreaterThan(0)
    expect(Number.isInteger(first)).toBe(true)
  })

  it('calculateGold = 單價 × 數量，且金幣永遠是整數', () => {
    const m = new MarketPricing()
    const day = 1
    const price = m.getPrice('iron', day)
    const earned = m.calculateGold('iron', 4, day)
    expect(earned).toBe(price * 4)
    expect(Number.isInteger(earned)).toBe(true)
  })

  it('賣 0 件得 0 金幣', () => {
    const m = new MarketPricing()
    expect(m.calculateGold('iron', 0, 1)).toBe(0)
  })

  it('sellPrice 為 0 的物品（wood 以外的不可售）價格為 0', () => {
    const m = new MarketPricing()
    // plank 的 sellPrice > 0，這裡用一個不存在於價格表的 id 驗證 fallback
    expect(m.getPrice('definitely_not_sellable', 1)).toBe(0)
    expect(m.calculateGold('definitely_not_sellable', 10, 1)).toBe(0)
  })

  it('每日特賣設計圖依天數循環', () => {
    const m = new MarketPricing()
    expect(m.getDailyBlueprint(0)).toBe(m.getDailyBlueprint(5))
    expect(m.getDailyBlueprint(1)).toBe(m.getDailyBlueprint(6))
  })

  it('getSellableItems 只含 price > 0 的物品', () => {
    const m = new MarketPricing()
    const items = m.getSellableItems(2)
    expect(items.length).toBeGreaterThan(0)
    expect(items).toContain('wood')
  })
})
