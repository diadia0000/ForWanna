---
name: barracks-ui
description: Rebuild the barracks management panel — soldier stat formula per level, upgrade cost & preview.
---

# ui/BarracksUI.ts

> 模組：ui｜角色：兵營管理介面，顯示當前士兵屬性與下一級升級成本/預覽

## 公開 API

- `new BarracksUI()` — append `#barracks-ui`
- `BarracksUI.show(buildingId: string, level: number, inventory: InventoryItem[]): void`
- `BarracksUI.hide(): void`
- `BarracksUI.setOnUpgrade(fn: (buildingId: string) => void): void`
- getter `isVisible`

## 核心邏輯

### 士兵屬性公式（與 main.ts 同步的常數）

```typescript
const SOLDIER_MAX_PER_BARRACKS = 3
const SOLDIER_HP = 50, SOLDIER_ATK = 8, SOLDIER_SPEED = 80
const SOLDIER_SPAWN_INTERVAL = 30   // 秒
const SOLDIER_RESPAWN_MS = 60       // 秒（顯示用，固定）

function calcSoldierStats(lv: number) {
  return {
    maxSoldiers: SOLDIER_MAX_PER_BARRACKS + (lv - 1),                  // +1 名/級
    hp:          Math.round(SOLDIER_HP  * (1 + (lv - 1) * 0.3)),       // +30% HP/級
    atk:         Math.round(SOLDIER_ATK * (1 + (lv - 1) * 0.25)),      // +25% ATK/級
    speed:       Math.round(SOLDIER_SPEED * (1 + (lv - 1) * 0.1)),     // +10% SPD/級
    interval:    Math.max(10, SOLDIER_SPAWN_INTERVAL - (lv - 1) * 4),  // -4s/級，下限 10
  }
}
```

### 升級區（BUILDING_UPGRADES['barracks']）

```typescript
const upgrades = BUILDING_UPGRADES['barracks'] ?? []
const maxLv = upgrades.length
if (lv >= maxLv || !upgrades[lv]) {
  upgradeHTML = `<div class="barracks-max">${t('ui.barracks.max', { lv })}</div>`
} else {
  const nextUpgrade = upgrades[lv]            // upgrades[lv] = 升至 lv+1 的成本
  const nextStats = calcSoldierStats(lv + 1)
  const canAfford = nextUpgrade.cost.every(c => (invMap.get(c.itemId) ?? 0) >= c.amount)
  // costsHTML 逐項 req-ok/req-missing，空成本 fallback「免費」
  // preview 用 t('ui.barracks.preview', { diff, hp_from, hp_to, atk_from, atk_to, int_from, int_to })
}
// 升級鈕：onUpgrade(buildingId) 後 hide()
```

當前屬性區顯示 6 格（最大數/HP/ATK/速度/生成間隔/復活時間）。

## EventBus 互動

- on `i18n:changed` — 可見時 `_refresh()`
- `document` keydown `Escape` — 可見時 hide
- 升級走注入回呼 `onUpgrade`，非事件

## 依賴

- `@/building/data/buildings` BUILDING_UPGRADES、`@/inventory` ITEMS
- `@/types` InventoryItem、`@/render/ItemSpriteRegistry` getItemIconMarkup
- `@/core/i18n` t、`@/core/EventBus`

## 重建提示

- 所有 SOLDIER_* 常數與成長係數須與 main.ts 兵營邏輯逐字一致（UI 僅預覽，數值要對得上）。
- 同 BaseCoreUI 索引慣例：`upgrades[lv]` 是升到下一級的成本。
- 容器 `#barracks-ui` 顯示 `flex`；內容寫入 `#barracks-content`，`_refresh` 整塊重繪並重綁升級按鈕。
- preview 用單一 i18n key 帶 from/to 多參數，避免拆字串拼接。
