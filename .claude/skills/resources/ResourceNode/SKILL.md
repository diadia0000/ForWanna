---
name: resources-resource-node
description: 資源節點的 PixiJS 視覺實體類別，實作精靈建構、受擊特效、HP 條、respawn 動畫，重建時參考它來還原所有節點的渲染與互動行為。
---

# resources/ResourceNode.ts

> 模組：resources｜角色：ResourceNodeEntity 視覺實體，封裝單一資源節點的 PixiJS Container、受擊動畫、HP 條、sprite 切換與 EventBus 事件發送

## 公開 API

- `class ResourceNodeEntity`
  - `constructor(data: ResourceNodeData): ResourceNodeEntity` — 傳入完整 ResourceNode 資料物件，建立 PixiJS Container 並立即繪製初始外觀
  - `readonly id: string` — 節點唯一 ID
  - `sprite: PIXI.Container` — PixiJS 顯示物件，外部透過此屬性加入場景
  - `hit(damage: number, _playerId: PlayerId): void` — 扣血、觸發 shake 動畫、刷新 HP 條，hp 歸零時 emit `resource:depleted`
  - `applyDelta(data: Partial<ResourceNodeData>): void` — Client 端接收網路 delta 時呼叫，同步 hp 差值並觸發視覺反饋
  - `update(delta: number): void` — 每幀呼叫，驅動 EntitySpriteDriver 的 IDLE 動畫（若已載入 manifest sprite）
  - `playRespawnAnim(): void` — 節點重生時播放彈入動畫（scale 從 0 到 1，easeOutElastic 曲線）
  - `get x(): number` — 節點世界 x 座標
  - `get y(): number` — 節點世界 y 座標
  - `get isDestroyed(): boolean` — 是否已銷毀
  - `getData(): ResourceNodeData` — 回傳當前資料的淺拷貝
  - `destroy(): void` — 清除 shake ticker、銷毀 PixiJS Container，設 `destroyed = true`

## 核心邏輯

### HP 條（`_refreshHpBar`）

尺寸 30×3 px，只在有受損時顯示（ratio < 1）。顏色三段閾值：

```typescript
const BAR_W = 30
const BAR_H = 3

private _refreshHpBar(): void {
  const ratio = Math.max(0, this.data.hp / this.data.maxHp)
  const damaged = ratio < 1
  this.hpBarBg.visible = damaged
  this.hpBarFg.visible = damaged
  if (!damaged) return
  const color = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xf44336
  this.hpBarFg.rect(-BAR_W / 2, barY, BAR_W * ratio, BAR_H).fill(color)
}
```

HP 條 Y 位置（`_barYFor`）：tree 20 / rock+iron+gold 26 / crystal+fire_node+ice_node 14 / 食物 18；有 driver 時委給 `driver.getHpBarY(fallback)`。

### 受擊特效（`hit`）

```typescript
hit(damage: number, _playerId: PlayerId): void {
  this.data.hp = Math.max(0, this.data.hp - damage)
  const visual = this.driver?.sprite ?? this.spr ?? this.gfx
  visual.tint = 0xffffff                          // 白色閃光
  this._shake()
  setTimeout(() => {
    if (!visual.destroyed) visual.tint = this._normalTint()
  }, 80)                                           // 80ms 後恢復
  this._refreshHpBar()
  if (this.data.hp <= 0) EventBus.emit('resource:depleted', { nodeId: this.id })
}
```

`_normalTint()` 依 hp 比例著色：< 0.33 → 紅，< 0.66 → 橘黃，其餘返回正常 tint（iron 0xa0b8e8 / gold 0xf0c840 / 其他 0xffffff）。

### 震動動畫（`_shake`）

320ms 內每幀 +16ms，正弦震盪 + 線性衰減：

```typescript
private _shake(): void {
  if (this.shakeTicker) return
  let elapsed = 0
  const tick = () => {
    elapsed += 16
    if (elapsed >= 320) { target.x = baseX; /* remove ticker */ return }
    const decay = 1 - elapsed / 320
    target.x = baseX + Math.sin(elapsed * 0.08 * Math.PI) * 4 * decay
  }
  PIXI.Ticker.shared.add(tick)
}
```

### Respawn 動畫（`playRespawnAnim`）

```typescript
playRespawnAnim(): void {
  this.sprite.scale.set(0)
  let p = 0
  const tick = () => {
    p += 0.06
    if (p >= 1) { this.sprite.scale.set(1); /* remove */ return }
    this.sprite.scale.set(easeOutElastic(p))
  }
  PIXI.Ticker.shared.add(tick)
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}
```

約 17 幀從 0 到 1，超出 1 後回彈產生彈性效果。

### 貼圖回退策略常數

```typescript
const SPRITE_SCALE:    Record<string, number> = { tree: 1.5, rock: 1.4, iron: 1.4, gold: 1.4 }
const SPRITE_ANCHOR_Y: Record<string, number> = { tree: 0.92, rock: 0.85, iron: 0.85, gold: 0.85 }
const ROCK_TINT: Partial<Record<string, number>> = { iron: 0xa0b8e8, gold: 0xf0c840 }
```

tree/rock 用 `RESOURCE_TEXTURES` 靜態貼圖；iron/gold 用 rock_grey 貼圖加 tint。無貼圖時：tree → `_drawTree()`、crystal → `_drawCrystal()`、berry 系列 → `_drawBerryBush()`、fire_node/ice_node 有專屬繪製函式、其餘 → `_drawBoulder(type)` 使用 palette + `hashId(id)` 微差。

### `applyDelta`（Client 端同步）

```typescript
applyDelta(data: Partial<ResourceNodeData>): void {
  if (data.hp !== undefined) {
    const prevHp = this.data.hp
    this.data.hp = data.hp
    if (data.hp < prevHp) {  // 觸發視覺反饋，但不 emit 事件
      visual.tint = 0xffffff
      this._shake()
      setTimeout(() => { visual.tint = this._normalTint() }, 80)
    }
  }
  this._refreshHpBar()
}
```

### 工具函式（模組私有）

- `hashId(id: string): number` — 31 倍多項式滾動雜湊：`h = (Math.imul(31, h) + charCode) | 0`，用於同類石塊視覺微差

## EventBus 互動

- emit `resource:depleted` — payload: `{ nodeId: string }`，觸發時機：`hit()` 後 hp 降為 0

## 依賴

- `pixi.js` — Container、Graphics、Sprite、Ticker
- `@/types` — `ResourceNode`（資料型別）、`ResourceType`、`PlayerId`
- `@/core/EventBus` — emit `resource:depleted`
- `@/render/AssetLoader` — `RESOURCE_TEXTURES`（靜態貼圖 map）
- `@/render` — `EntitySpriteDriver`（動態精靈表驅動器）

## 重建提示

- `_initManifestSprite` 是非同步的，constructor 結束時 driver 可能還未就緒；所有方法都要先 `if (!this.driver)` 或 `?. ` 保護。
- `destroyed` 旗標在每個 Ticker callback 開頭都要檢查，否則 sprite 被銷毀後繼續呼叫會拋錯。
- `applyDelta` 與 `hit` 的差異：`hit` 是本機計算扣血（Host 端直接交互），`applyDelta` 是接收網路 delta（Client 端同步），兩者都要觸發視覺反饋但不重複 emit 事件。
- zIndex 由外部 Spawner 設定（`entity.sprite.zIndex = data.y`），這個檔案不管 zIndex。
- `hashId` 讓同類石塊外觀略有差異，是純視覺功能，不影響邏輯。
