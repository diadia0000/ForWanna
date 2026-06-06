---
name: bag-ui
description: Rebuild the bag panel (small/large) — capacity calc, put-in/take-out lists, amount prompt.
---

# ui/BagUI.ts

> 模組：ui｜角色：背包物品收納 UI（小背包 999 / 大背包 Infinity），兩欄「放入」/「內容」清單

## 公開 API

- `type BagType = 'bag_small' | 'bag_large'`
- `BAG_MAX_ITEMS: Record<BagType, number>` = `{ bag_small: 999, bag_large: Infinity }`
- `new BagUI()` — append `#bag-ui`
- `BagUI.show(type, contents: Record<string,number>, inventory): void` / `hide()` / `toggle(type, contents, inventory)`
- `BagUI.update(contents, inventory): void` — 可見時重繪
- `BagUI.setOnPutIn(fn: (itemId, amount) => void)` / `setOnTakeOut(fn)`
- getter `isVisible`

## 核心邏輯

### 容量計算

```typescript
private _usedCapacity(): number { return Object.values(this.contents).reduce((a, b) => a + b, 0) }
private _remainingCapacity(): number {
  const max = BAG_MAX_ITEMS[this.bagType]
  return max === Infinity ? Infinity : max - this._usedCapacity()
}
```

容量文字顏色：`remain <= 0` 紅 `#ff6060`，`< 50` 黃 `#ffcc44`，否則綠 `#a8d8a0`。

### 放入清單（過濾不可放入）

```typescript
const filteredInv = this.inventory.filter(item => {
  const def = ITEMS[item.itemId]
  if (!def) return false
  if (['bag_small', 'bag_large', 'furnace'].includes(item.itemId)) return false  // 背包/熔爐不可放入
  return true
})
```

放入按鈕：`maxCanPut = min(item.amount, remain===Infinity ? item.amount : remain)`；`maxCanPut===1` 直接放 1，否則 `_promptAmount` 詢問數量。remain<=0 時 disable。

### 取出清單

每個 content 列有「取一」(`onTakeOut(itemId,1)`) 與「全取」(`onTakeOut(itemId,amount)`)；過濾 `amt > 0`，空時顯示 `ui.bag.empty`。

### 數量輸入

```typescript
private _promptAmount(msg: string, min: number, max: number): number {
  if (max <= 1) return max
  const input = window.prompt(`${msg}（${min}～${max}）`, String(max))
  if (!input) return 0
  const n = parseInt(input, 10)
  if (isNaN(n) || n < min || n > max) return 0
  return n
}
```

## EventBus 互動

- on `i18n:changed` — 可見時 `_render()`
- `document` keydown `Escape` — 可見時 hide
- 不 emit 事件；資料變動透過注入的 `onPutIn`/`onTakeOut` 回呼交給 main.ts

## 依賴

- `@/types` InventoryItem、`@/inventory` ITEMS、`@/core/i18n` t、`@/core/EventBus`
- `@/render/ItemSpriteRegistry` getItemIconMarkup

## 重建提示

- 用 `document.getElementById` 取子元素（單例 UI，id 全域唯一）。
- `show()` 對 contents/inventory 做淺拷貝（`{...contents}` / `[...inventory]`）避免外部 mutation。
- 顯示用 `flex`；結構 `.bag-header`（標題/容量/✕）+ `.bag-body`（兩個 `.bag-section`）。
- 容量 999 與 Infinity 兩種文案分別走 `ui.bag.capacity_inf` 與 `ui.bag.capacity`。
