---
name: market-pricing
description: Rebuild the market dynamic pricing algorithm — seeded daily RNG, rarity multiplier, daily blueprint rotation.
---

# ui/MarketPricing.ts

> 模組：ui｜角色：市場動態定價系統（品級驅動 + 每日 seeded RNG 波動），導出單例 `marketPricing`

## 公開 API

- `BLUEPRINT_PRICE = 100_000` — 每日設計圖固定售價
- `class MarketPricing`
  - `getPrice(itemId: string, gameDay = 0): number`
  - `calculateGold(itemId: string, amount: number, gameDay = 0): number`
  - `getSellableItems(gameDay = 0): string[]`
  - `getDailyBlueprint(gameDay = 0): string`
- `export const marketPricing = new MarketPricing()` — 全域單例

## 核心邏輯（完整算法）

### 每日價格表生成（seeded LCG，同天同價）

```typescript
private todaysPrices: Map<string, number> = new Map()
private lastDay = -1

private _init(gameDay: number): void {
  if (this.lastDay === gameDay) return       // 同天已算過直接返回
  this.lastDay = gameDay
  this.todaysPrices.clear()

  // seeded RNG：種子由 gameDay 決定 → 同天結果一致（多人同步關鍵）
  let seed = (gameDay * 1103515245 + 12345) & 0x7fffffff
  const rng = (): number => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff   // LCG
    return seed / 0x7fffffff
  }

  for (const [id, def] of Object.entries(ITEMS)) {
    if ((def.sellPrice ?? 0) <= 0) continue              // 無基礎售價跳過
    const rarity   = ITEM_RARITY[id] ?? 'common'
    const mult     = RARITY_CONFIG[rarity].priceMult     // 稀有度倍率
    const variance = 0.8 + rng() * 0.4                   // 每日波動 ±20%
    this.todaysPrices.set(id, Math.round(def.sellPrice * mult * variance * 100) / 100)  // 2 位小數
  }
}
```

### 查價 / 算總額 / 每日設計圖輪替

```typescript
getPrice(itemId, gameDay = 0): number {
  this._init(gameDay); return this.todaysPrices.get(itemId) ?? 0
}
calculateGold(itemId, amount, gameDay = 0): number {
  const price = this.getPrice(itemId, gameDay)
  return price > 0 ? Math.round(price * amount * 100) / 100 : 0
}
getSellableItems(gameDay = 0): string[] {
  this._init(gameDay); return Array.from(this.todaysPrices.keys())
}
getDailyBlueprint(gameDay = 0): string {
  return DAILY_BLUEPRINTS[gameDay % DAILY_BLUEPRINTS.length]
}
```

`DAILY_BLUEPRINTS = ['blueprint_1','blueprint_2','blueprint_3','blueprint_4','blueprint_5']`。

## 依賴

- `@/inventory` ITEMS / ITEM_RARITY / RARITY_CONFIG（讀 sellPrice / 稀有度 / priceMult）

## 重建提示

- 價格決定因子三項相乘：`sellPrice × rarity.priceMult × variance(0.8~1.2)`，再四捨五入到分。
- LCG 常數須完全保留（`1103515245/12345` 初始 seed、`1664525/1013904223` 迭代、mask `0x7fffffff`），否則 host/client 算出的每日價會不一致 → 多人交易不同步。
- `_init` 以 `lastDay` 快取，跨天才重算；`getPrice` 等所有方法都先呼 `_init` 保證表已建。
- `sellPrice <= 0` 視為不可售，不入表 → MarketUI `price <= 0` 跳過該物品。
- 純算法 + 資料，無 DOM、無 EventBus。
