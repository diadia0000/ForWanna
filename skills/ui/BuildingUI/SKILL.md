---
name: building-ui
description: Rebuild the scrollable building placement menu — cost affordability, icon map, start-placement callback.
---

# ui/BuildingUI.ts

> 模組：ui｜角色：建築放置選單（可滾動清單），顯示各建築成本/效果，點擊開始放置

## 公開 API

- `new BuildingUI()` — append `#building-ui`
- `BuildingUI.show(defs: Record<string,BuildingDef>, inventory: InventoryItem[]): void`
- `BuildingUI.hide(): void`
- `BuildingUI.setOnStartPlacement(fn: (defId: string) => void): void`
- getter `isVisible`

## 核心邏輯

### 建築圖示對應（BuildingDef 無 icon 欄位）

```typescript
const BUILDING_ICONS: Record<string, string> = {
  chest:'📦', furnace:'🔥', farm:'🌾', market:'🏪', research_lab:'🛠️',
  wooden_bridge:'🌉', wall:'🧱', tower:'🗼', spike_trap:'🔪', fire_trap:'🔥',
  ice_trap:'❄️', base_core:'🏰', barracks:'🏟️', laser_tower:'🔵',
  cannon_tower:'💣', goddess_statue:'🗿',
}  // fallback '🏠'
```

### 清單渲染與可負擔判定

```typescript
const invMap = new Map<string, number>()
this.currentInventory.forEach(({ itemId, amount }) => invMap.set(itemId, amount))
for (const [id, def] of Object.entries(this.currentDefs)) {
  const canAfford = def.cost.every(c => (invMap.get(c.itemId) ?? 0) >= c.amount)
  const buildingName   = t('building.' + id + '.name',   undefined, def.name)
  const buildingEffect = t('building.' + id + '.effect', undefined, def.effect)
  const costs = def.cost.map(c => {
    const have = invMap.get(c.itemId) ?? 0
    const cls = have >= c.amount ? 'req-ok' : 'req-missing'
    return `<span class="${cls}">${getItemIconMarkup(c.itemId, ITEMS[c.itemId]?.icon ?? '?')} ×${c.amount}<small>(${have})</small></span>`
  }).join('')
  // card.className = 'recipe-card' + (canAfford ? ' craftable' : '')
  // 顯示 icon+名稱+尺寸 (def.size.x × def.size.y)、成本、效果、放置按鈕(canAfford 才 enable)
}
```

### 放置：先 hide 再回呼

```typescript
if (canAfford && this.onStartPlacement) {
  card.querySelector('.btn-place')!.addEventListener('click', () => {
    this.hide()
    this.onStartPlacement!(id)
  })
}
```

## EventBus 互動

- on `i18n:changed` — 可見時 `renderList()`
- 開窗由外部（HUD 發 `window 'ui:open_building'` 事件）→ main.ts 呼 `show()`；本檔不直接監聽
- 放置走注入回呼，非事件

## 依賴

- `@/types` BuildingDef/InventoryItem、`@/inventory` ITEMS、`@/core/i18n` t、`@/core/EventBus`
- `@/render/ItemSpriteRegistry` getItemIconMarkup

## 重建提示

- 容器 `#building-ui` 顯示 `flex`；面板用 `.panel.crafting-panel`，清單 `#building-list.building-list-scroll`（max-height 約 420px 可滾動，CSS 控制）。
- `buildHTML` 綁 `wheel` `stopPropagation`（`{passive:false}`）防滾輪冒泡到 Hotbar。
- 點放置先 `hide()` 再 `onStartPlacement(id)`，順序重要（讓玩家看到地圖放置游標）。
- 名稱/效果走 i18n `building.{id}.name` / `.effect`，fallback 到 def。
