---
name: base-core-ui
description: Rebuild the base-core upgrade panel — buff formula (hp/atk/regen per level), next-level cost preview.
---

# ui/BaseCoreUI.ts

> 模組：ui｜角色：基地核心升級介面，顯示當前等級加成與下一級成本/預覽（最高 Lv10）

## 公開 API

- `new BaseCoreUI()` — append `#base-core-ui`
- `BaseCoreUI.show(buildingId: string, level: number, inventory: InventoryItem[]): void`
- `BaseCoreUI.hide(): void`
- `BaseCoreUI.setOnUpgrade(fn: (buildingId: string) => void): void`
- getter `isVisible`

## 核心邏輯

### 加成公式（與 main.ts 同步）

```typescript
function calcBuffs(lv: number): { hpPct: number; atkPct: number; regen: number } {
  const hpPct  = lv > 1 ? Math.round((0.10 + (lv - 2) * 0.10) * 100) : 0  // Lv2=10%, +10%/lv
  const atkPct = lv > 1 ? Math.round((0.10 + (lv - 2) * 0.08) * 100) : 0  // Lv2=10%, +8%/lv
  const regen  = ([0, 5, 8, 10, 12, 15, 18, 22, 28, 35] as number[])[lv - 1] ?? 0
  return { hpPct, atkPct, regen }
}
```

### 升級區（成本來自 BUILDING_UPGRADES['base_core']）

```typescript
const upgrades = BUILDING_UPGRADES['base_core']
if (lv >= 10 || !upgrades || lv >= upgrades.length) {
  upgradeHTML = `<div class="bcu-max">${t('ui.base_core.max')}</div>`
} else {
  const nextUpgrade = upgrades[lv]   // upgrades[currentLevel] = 升至 lv+1 的成本
  const canAfford = nextUpgrade.cost.every(c => (invMap.get(c.itemId) ?? 0) >= c.amount)
  // cost.length===0 顯示「免費」；否則逐項 req-ok/req-missing
  const nextBuffs = calcBuffs(lv + 1)  // 預覽下一級
  // 顯示 upgrade_title、HP/ATK/regen 預覽、costsHTML、升級按鈕(canAfford 才 enable)
}
// 升級鈕：onUpgrade(buildingId) 後 hide()
```

## EventBus 互動

- on `i18n:changed` — 可見時 `_refresh()`
- `document` keydown `Escape` — 可見時 hide
- 升級走注入回呼 `onUpgrade(buildingId)`，非事件

## 依賴

- `@/building/data/buildings` BUILDING_UPGRADES
- `@/inventory` ITEMS、`@/types` InventoryItem、`@/render/ItemSpriteRegistry` getItemIconMarkup
- `@/core/i18n` t、`@/core/EventBus`

## 重建提示

- `calcBuffs` 必須與 main.ts 的基地核心加成公式逐字同步（HUD/邏輯各自算，數值要一致）。
- 索引慣例：`upgrades[currentLevel]` 才是「升到下一級」的成本（不是 `upgrades[lv-1]`）。
- 容器 `#base-core-ui` 顯示 `flex`；內容寫進 `#bcu-content`，每次 `_refresh` 整塊重繪並重綁升級按鈕。
- Lv10 或無下一級資料 → 顯示 max，不渲染升級按鈕。
