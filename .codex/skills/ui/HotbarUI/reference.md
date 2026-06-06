---
name: hotbar-ui
description: Rebuild the 9-slot hotbar — active slot selection, scroll-wheel cycling, bag right-click/drag-drop integration.
---

# ui/HotbarUI.ts

> 模組：ui｜角色：底部 9 格快捷欄，管理選中格、滾輪切換、背包格的右鍵開啟與拖曳放入

## 公開 API

- `new HotbarUI()` — append `#hotbar`，建 9 格
- `HotbarUI.show(inventory: InventoryItem[]): void` / `hide(): void`
- `HotbarUI.update(inventory: InventoryItem[]): void` — 可見時 re-render
- `HotbarUI.setInventoryUI(invUI: InventoryUI): void` — 注入拖曳放入背包用
- `HotbarUI.setOnBagRightClick(fn): void` — 背包格右鍵回呼
- getter `activeIndex: number` / `activeItem: InventoryItem | undefined` / `activeItemKind: HeldItemKind`

## 核心邏輯

### 滾輪循環 9 格（passive）

```typescript
window.addEventListener('wheel', (e) => {
  if (!this.visible) return
  this.activeSlot = e.deltaY > 0
    ? (this.activeSlot + 1) % 9
    : (this.activeSlot - 1 + 9) % 9
  this.updateActive()
}, { passive: true })
```

### 背包格互動（右鍵開啟 + 拖曳放入）

`BAG_ITEM_IDS = new Set(['bag_small', 'bag_large'])`。每格綁定：

```typescript
// 右鍵：若是背包物品 → 開 BagUI
slot.addEventListener('contextmenu', (e) => {
  const item = this.inventory[i]
  if (item && BAG_ITEM_IDS.has(item.itemId)) {
    e.preventDefault(); e.stopPropagation()
    this.onBagRightClick?.(item.itemId as 'bag_small' | 'bag_large')
  }
})
// mouseup：InventoryUI 拖曳中且本格是背包 → 接受 drop
slot.addEventListener('mouseup', () => {
  if (!this.invUI?.dragItem) return
  const item = this.inventory[i]
  if (!item || !BAG_ITEM_IDS.has(item.itemId)) return
  const dropped = this.invUI.acceptBagDrop()
  if (!dropped) return
  ;(EventBus as any).emit('bag:drag_drop', {
    bagType: item.itemId as 'bag_small' | 'bag_large',
    itemId: dropped.itemId, amount: dropped.amount,
  })
  slot.classList.add('hotbar-slot--bag-flash')
  setTimeout(() => slot.classList.remove('hotbar-slot--bag-flash'), 300)
})
// mouseenter/leave：拖曳時高亮背包格 (--bag-hover)
```

### TAB 壓住隱藏

`keydown Tab` → `display='none'`（若 visible），`keyup Tab` → `display='flex'`。

### render

每格顯示 icon（`getItemIconMarkup`）/數量/名稱（i18n `item.{id}.name`）；背包物品附 `bag_hint` 小字。

## EventBus 互動

- on `inventory:changed` `{ inventory }` — 更新並（可見時）render
- on `i18n:changed` — 可見時 render
- emit `bag:drag_drop` `{ bagType, itemId, amount }` — 拖曳物品落到背包格時，交給 main.ts 做資料轉移

## 依賴

- `@/types` InventoryItem、`@/core/EventBus`、`@/core/i18n` t
- `@/inventory` getHeldItemKind/ITEMS、type HeldItemKind
- `@/render/ItemSpriteRegistry` getItemIconMarkup
- `./InventoryUI`（僅 type import + 注入實例，讀 `dragItem`/呼 `acceptBagDrop`）

## 重建提示

- 容器 id `hotbar`，display `flex`；9 格固定。
- 與 InventoryUI 的拖曳整合是「拉式」：Hotbar 在 mouseup 主動讀 `invUI.dragItem` 並呼 `acceptBagDrop()`，由 InventoryUI 負責移除來源格。
- `EventBus as any` cast 用於 emit 非註冊型別事件 `bag:drag_drop`；保留以免 TS 報錯。
- 滾輪 listener 是 `{ passive:true }`，不能 preventDefault；CraftingUI/BuildingUI/FurnaceUI 用 stopPropagation 阻止滾輪冒泡到此處。
