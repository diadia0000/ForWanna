---
name: inventory-ui
description: Rebuild the 18-slot inventory grid with mouse drag-to-reorder, floating ghost, and bag-drop hand-off.
---

# ui/InventoryUI.ts

> 模組：ui｜角色：18 格（9×2）背包格網，支援滑鼠拖曳重排、浮動 ghost、與 HotbarUI 背包格的拖放交接

## 公開 API

- `new InventoryUI()` — append `#inventory-ui`
- `InventoryUI.show(inventory | null): void` / `hide(): void` / `toggle(inventory): void`
- `InventoryUI.render(inventory): void` — 舊版相容，等同 `_loadSlots`
- `InventoryUI.setOnReorder(fn: (newInv: InventoryItem[]) => void): void`
- `InventoryUI.acceptBagDrop(): InventoryItem | null` — HotbarUI 背包格接受拖曳時呼叫
- getter `isVisible`；public 欄位 `dragItem`、`onBagAccept`

## 核心邏輯

### 固定 18 格映射

```typescript
const TOTAL_SLOTS = 18
private _loadSlots(inventory: InventoryItem[]): void {
  this.slots = Array(TOTAL_SLOTS).fill(null)
  inventory.slice(0, TOTAL_SLOTS).forEach((item, i) => { this.slots[i] = item })
  this._renderSlots()
}
```

### 拖曳重排（自管 ghost，非 HTML5 DnD）

只接受左鍵 `mousedown`（`e.button !== 0` 忽略）；`contextmenu` 一律 `preventDefault` 防 ghost 卡住。

```typescript
private _startDrag(idx, item, slotEl, e): void {
  this._cancelDrag()
  document.querySelectorAll('.drag-ghost').forEach(el => el.remove())  // 清殘留
  this.dragFrom = idx
  this.dragItem = { itemId: item.itemId, amount: item.amount, fromIdx: idx }
  this.ghost = document.createElement('div'); this.ghost.className = 'drag-ghost'
  this.ghost.innerHTML = `<span class="item-icon">${getItemIconMarkup(item.itemId, def?.icon ?? '📦')}</span>`
  this._moveGhost(e.clientX, e.clientY); document.body.appendChild(this.ghost)
  slotEl.classList.add('item-slot--dragging')
  const onMove = (ev) => this._moveGhost(ev.clientX, ev.clientY)
  const onUp = () => { this._cancelDrag(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
}
private _moveGhost(cx, cy): void { this.ghost.style.left = `${cx - 32}px`; this.ghost.style.top = `${cy - 32}px` }
```

### Drop = 交換兩格 → 壓縮 → onReorder

```typescript
private _drop(toIdx: number): void {
  const from = this.dragFrom; this._cancelDrag()
  if (from === null || from === toIdx) return
  const newSlots = [...this.slots]
  const temp = newSlots[from]; newSlots[from] = newSlots[toIdx]; newSlots[toIdx] = temp
  this.slots = newSlots
  const newInv = newSlots.filter((s): s is InventoryItem => s !== null && s.itemId !== '' && s.amount > 0)
  this.onReorder?.(newInv)
  this._renderSlots()
}
```

### acceptBagDrop（給 HotbarUI 用）

移除來源格、過濾空格、`onReorder` 通知、清拖曳，回傳被移走的物品（找不到回 null）。

## EventBus 互動

- on `ui:close_inventory` — hide
- on `inventory:changed` `{ inventory }` — 可見時 `_loadSlots`
- on `i18n:changed` — 可見時 `_renderSlots`
- `document` keydown `Escape` — 可見時 `stopPropagation` 並 hide

## 依賴

- `@/types` InventoryItem、`@/core/EventBus`、`@/core/i18n` t
- `@/inventory` ITEMS、`@/render/ItemSpriteRegistry` getItemIconMarkup

## 重建提示

- `_cancelDrag` 兩度強清 `document.querySelectorAll('.drag-ghost')`——防 ghost 卡死的關鍵防護，保留。
- ghost 偏移固定 `-32px`（半格 64px 居中游標）。
- drop 的壓縮過濾條件含 `itemId !== ''` 與 `amount > 0`，避免空殼格混入。
- 容器 `#inventory-ui` 顯示用 `flex`，內含 `.inv-container > #inventory-grid.item-grid`。
- Escape 在這裡 `stopPropagation` 防止冒泡導致其他系統誤觸。
