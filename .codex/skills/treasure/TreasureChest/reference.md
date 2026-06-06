---
name: treasure-chest-entity
description: Lookup for TreasureChestEntity — sprite construction, rarity colouring, glow animation, open() loot return, and interaction model.
---

# treasure/TreasureChest.ts

> 模組：treasure｜角色：寶箱實體 — PixiJS 視覺物件，持有 loot 資料，提供 open() 介面

## 公開 API

- `new TreasureChestEntity(data: TreasureChestData)` — 建立寶箱，sprite 已放至正確世界座標，eventMode 固定為 `'none'`（不使用 click，由外部 R 鍵觸發）
- `entity.sprite: PIXI.Container` — 掛到 stage 的容器，`zIndex = data.y + 60`
- `entity.id: string` — 唯一 ID，與 `TreasureChestData.id` 相同
- `entity.update(): void` — 每 tick 呼叫以驅動發光脈衝動畫（已開啟則自動停止）
- `entity.open(): Array<{ itemId: string; amount: number }>` — 標記已開啟、停止動畫、alpha 降至 0.5、返回預先決定的 loot；再次呼叫回傳 `[]`
- `entity.getData(): TreasureChestData` — 淺拷貝快照，供 Host 廣播
- `entity.isOpened(): boolean`
- `entity.destroy(): void` — 清除 ticker 與 sprite 資源

## 核心邏輯

### 稀有度色彩映射

三種稀有度各有箱體色與蓋子（glowColor）：

```typescript
const colors = {
  common: 0x8b7355,  // 棕色
  rare:   0x4169e1,  // 皇家藍
  epic:   0xffd700,  // 金色
}
const glows = {
  common: 0xc9a468,
  rare:   0x6fa8ff,
  epic:   0xffec80,
}
```

箱體尺寸：`TW = 88 px`（留 4 px 邊距，視覺上 2×2 格 = 96 px），`TH = 72 px`。  
座標原點在 sprite 中心；箱蓋在 `y ∈ [-TH*0.52, -TH*0.27]`，箱體在 `y ∈ [-TH*0.35, TH*0.30]`。

### 發光脈衝動畫（Glow Ticker）

```typescript
this.glowAlpha = 0
this.glowTicker = () => {
  this.glowAlpha += this.glowDirection * 0.025
  if (this.glowAlpha > 0.8) this.glowDirection = -1
  if (this.glowAlpha < 0)   this.glowDirection = 1
  this.gfx.alpha = 0.9 + this.glowAlpha * 0.12  // alpha 範圍 0.90 ~ 1.02 (clamp 1.0)
}
```

`update()` 只在 `!this.data.opened` 時執行 ticker，`open()` 後將 `glowTicker = null` 解除引用。

### open() 流程

```typescript
open(): Array<{ itemId: string; amount: number }> {
  if (this.data.opened) return []
  this.data.opened = true
  this.glowTicker = null
  this.gfx.alpha = 0.5        // 視覺變暗，表示已開啟
  return this.data.loot        // loot 在 spawnOne 時即已由 generateLoot() 決定
}
```

loot 在構造時由外部傳入 `TreasureChestData.loot`，`open()` 只是把它取出，**不重新 roll**。

### zIndex 策略

`this.sprite.zIndex = this.data.y + 60`  
偏移 +60 確保寶箱顯示在同 y 值的地板物件上方。

## EventBus 互動

TreasureChestEntity 本身**不 emit 任何事件**。事件由 `TreasureSpawner.openChest()` 在呼叫 `entity.open()` 後發出。

## 依賴

- `pixi.js` — PIXI.Container、PIXI.Graphics 圖形繪製
- `./treasureConfig` — `rollLootRarity`、`generateLoot`、`LootRarity` 型別（import 但實際 roll 在 Spawner 層完成，這裡只用型別）
- `@/types` — `NodeId`

## 重建提示

- `sprite.eventMode = 'none'`：寶箱不接收滑鼠事件，互動一律由外部（`TreasureSpawner.findNearbyChest` + R 鍵）發起。
- `_buildSprite()` 在 constructor 中呼叫，結束後 `glowTicker` 已設好，但需外部每 tick 呼叫 `update()` 才會執行。
- `getData()` 回傳淺拷貝（`{ ...this.data }`），loot 陣列是原始引用，修改外部拷貝不影響實體內部狀態，但若對 loot 陣列元素做 mutate 會有副作用。
- `destroy()` 呼叫 `this.gfx.destroy()` 再呼叫 `this.sprite.destroy()`，順序不可顛倒。
- 寶箱 sprite 不加入任何 stage，由 `TreasureSpawner` 負責 `container.addChild(entity.sprite)`。
