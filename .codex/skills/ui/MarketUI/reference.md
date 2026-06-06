---
name: market-ui
description: Rebuild the sell-only market UI — item list with rarity, sell qty/price detail, daily blueprint buy.
---

# ui/MarketUI.ts

> 模組：ui｜角色：市場交易選單（設計上「只賣不買」例外：每日設計圖可買），左欄物品清單+每日特賣，右欄賣出詳情

## 公開 API

- `new MarketUI()` — append `#market-ui`
- `MarketUI.show(inventory: InventoryItem[], gold = 0, gameDay = 1): void`
- `MarketUI.hide(): void`
- `MarketUI.refresh(inventory, gold?, gameDay?): void` — 賣/買後外部呼叫更新
- `MarketUI.setOnSell(fn: (itemId: ItemId, amount: number) => void)` / `setOnBuy(fn: (itemId: string) => void)`

## 核心邏輯

### 物品清單（跳過不可售、顯示稀有度）

```typescript
for (const item of this.inventory) {
  const def = ITEMS[item.itemId]; if (!def) continue
  const price = marketPricing.getPrice(item.itemId, this.gameDay)
  if (price <= 0) continue  // 跳過不可售
  const rarity = ITEM_RARITY[item.itemId] ?? 'common'
  const { color, label } = RARITY_CONFIG[rarity]
  // row：icon + 名稱(著色 + [稀有度]) + 單價 + 庫存；點擊 _selectItem(item.itemId)
}
if (listEl.children.length === 0) listEl.innerHTML = `<div class="market-empty">${t('ui.market.no_items')}</div>`
```

### 賣出詳情與數量

`_selectItem` 設 `maxStock = item.amount`、`qty = 1`，顯示 `#market-detail`(`display:block`)、icon/名稱(稀有色)/單價/庫存。數量按鈕 ◄/►/HALF(`floor(maxStock/2)`)/MAX(`maxStock`)，`_setQty` clamp `[1, maxStock]`。

```typescript
private _refreshDetail(): void {
  const total = marketPricing.calculateGold(this.selectedItem || 'wood', this.qty, this.gameDay)
  this.el.querySelector('#mq-num')!.textContent = String(this.qty)
  this.el.querySelector('#md-total')!.textContent = total.toFixed(2)
}
private _executeSell(): void {
  if (!this.selectedItem || this.qty <= 0 || !this.onSell) return
  this.onSell(this.selectedItem, this.qty)  // 賣後不關 UI，等外部 refresh()
}
```

### 每日設計圖（唯一買入路徑）

```typescript
private _refreshDaily(): void {
  const itemId = marketPricing.getDailyBlueprint(this.gameDay)
  const canBuy = this.gold >= BLUEPRINT_PRICE   // BLUEPRINT_PRICE = 100,000
  // 按鈕 .btn-buy-blueprint data-item-id=itemId，canBuy 才 enable
}
// 買入用事件委派（_build 內單一 click listener）：
wrap.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.btn-buy-blueprint') as HTMLElement | null
  if (!btn) return
  const itemId = btn.dataset.itemId
  if (itemId && this.onBuy) this.onBuy(itemId)
})
```

### refresh 後選中物品處理

`refresh` 重繪每日+清單，若選中物品仍在庫存則更新 maxStock/qty；若賣完則 `selectedItem=null` 並隱藏 detail。

## EventBus 互動

- on `i18n:changed` — 可見時 `_refreshItemList` + `_refreshDaily`
- `document` keydown `Escape` — 開啟時 hide
- 賣/買走注入回呼 `onSell`/`onBuy`，非事件

## 依賴

- `@/types` ItemId/InventoryItem、`./MarketPricing` marketPricing/BLUEPRINT_PRICE
- `@/inventory` ITEMS/ITEM_RARITY/RARITY_CONFIG、`@/render/ItemSpriteRegistry` getItemIconMarkup
- `@/core/i18n` t、`@/core/EventBus`

## 重建提示

- 賣後**不關閉** UI（連續賣），需外部呼 `refresh()` 同步庫存——這是刻意設計。
- 「sell-only」是設計，唯一買入是每日設計圖（用 event delegation，因每日區會重繪）。
- 容器 `#market-ui` 顯示 `flex`；`#market-detail` 預設 `display:none`，選物品後才 `block`。
- 價格/金額用 `toFixed(2)` 顯示小數。
