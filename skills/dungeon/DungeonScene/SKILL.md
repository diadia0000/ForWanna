---
name: dungeon-scene
description: Look up here when rebuilding PixiJS dungeon rendering, enemy/chest/boss spawning, per-frame AI movement, hit detection, chest loot, and portal exit logic.
---

# dungeon/DungeonScene.ts

> 模組：dungeon｜角色：PixiJS 地牢場景管理器 — 將 DungeonLayout 渲染為可互動場景，管理敵人 AI、寶箱、Boss 擊殺回呼

## 公開 API

- `new DungeonScene(parent: PIXI.Container)` — 建立場景，掛到父容器，並監聽 `i18n:changed`
- `destroy(): void` — 移除 i18n 監聽 + 銷毀容器（避免記憶體洩漏）
- `setup(layout: DungeonLayout, seed: number): void` — 依佈局初始化地板/敵人/寶箱/入口
- `setBossKillCallback(fn: () => void): void` — 設定 Boss 被擊殺時的回呼
- `update(playerX, playerY, deltaMs, onDamage): void` — 每幀 AI 更新，觸發 onDamage 回呼
- `hitEnemy(id: string, dmg: number): boolean` — 對敵人施加傷害，返回 true 表示敵人死亡
- `findNearbyEnemy(x, y, range): DungeonEnemy | null` — 找最近存活敵人
- `findNearbyChest(x, y, range): DungeonChest | null` — 找最近未開箱子
- `openChest(id): { gold, loot, rarity } | null` — 開箱，返回獎勵
- `isFloor(wx, wy): boolean` — 判斷世界座標是否在地板區域內
- `isNearExit(wx, wy): boolean` — 判斷是否靠近出口傳送門（距離 < `2 * TILE`）
- `getSpawnPoint(): { x, y }` — 回傳出生房中心
- `peaceful: boolean` — 設為 true 時敵人不追蹤不攻擊（除錯模式）

### 介面型別

```typescript
export interface DungeonEnemy {
  id: string; x: number; y: number
  hp: number; maxHp: number; damage: number; speed: number
  gfx: PIXI.Graphics; hpBar: PIXI.Graphics
  alive: boolean; lastAttackMs: number; attackUntil: number
  isBoss: boolean
  driver: EntitySpriteDriver | null; holder: PIXI.Container | null
  visualScale: number; facingDir: EntityDirection
}

export interface DungeonChest {
  id: string; x: number; y: number
  opened: boolean; gfx: PIXI.Container
  gold: number; rarity: LootRarity
  loot: Array<{ itemId: string; amount: number }>
}
```

## 核心邏輯

### setup() 的 RNG（與 Generator 不同的 LCG）

```typescript
let rs = seed ^ 0xd00dfeed
const rng = () => { rs = (rs * 1664525 + 1013904223) & 0x7fffffff; return rs / 0x7fffffff }
```

使用 Numerical Recipes LCG（乘數 1664525，增量 1013904223），與 DungeonGenerator 的 Lehmer 不同，`&0x7fffffff` 保持 31-bit 正數。

### 敵人與 Boss 生成

```typescript
// 普通敵人：每房 2–4 隻，位置在房間內縮 1 TILE 的範圍內隨機
const ec = 2 + Math.floor(rng() * 3)
const ex = room.px + TILE + rng() * (room.pw - TILE * 2)
const ey = room.py + TILE + rng() * (room.ph - TILE * 2)

// Boss 備援圖形（Sprite 非同步載入前顯示）
gfx.circle(0,0,26).fill(0xaa1111)
gfx.circle(0,0,26).stroke({ color:0xff3333, width:3 })
gfx.circle(0,0,10).fill({ color:0xffcc00, alpha:0.6 })  // 金色核心

// 普通敵人備援
gfx.circle(0,0,14).fill(0xcc2222)
gfx.circle(0,0,14).stroke({ color:0xff5555, width:2 })
```

### 非同步貼圖掛載（防競態）

```typescript
private async _attachSprite(e: DungeonEnemy, type: string, scale: number): Promise<void> {
  const driver = await EntitySpriteDriver.create(`monster.${type}`)
  if (!driver || this.enemies.indexOf(e) === -1) return  // 防止 setup 重設後仍掛載
  const holder = new PIXI.Container()
  holder.x = e.x; holder.y = e.y
  if (scale !== 1) holder.scale.set(scale)
  holder.addChild(driver.sprite)
  this.container.addChild(holder)
  e.driver = driver; e.holder = holder
  e.gfx.visible = false
  if (!e.alive) holder.visible = false
  void driver.play('IDLE', 'DOWN')
}
```

### 地板繪製（棋盤格 + 灰邊框）

```typescript
private _drawFloor(px, py, pw, ph): void {
  const cols = Math.ceil(pw / TILE), rows = Math.ceil(ph / TILE)
  for (let tx = 0; tx < cols; tx++) {
    for (let ty = 0; ty < rows; ty++) {
      const c = (tx + ty) % 2 === 0 ? 0x2a2020 : 0x252525
      this.tileGfx.rect(px+tx*TILE, py+ty*TILE, TILE-1, TILE-1).fill(c)
    }
  }
  // 2px 灰色邊框（外擴 2px）
  this.tileGfx.rect(px-2, py-2, pw+4, 2).fill(0x686868)  // 上
  this.tileGfx.rect(px-2, py+ph, pw+4, 2).fill(0x686868) // 下
  this.tileGfx.rect(px-2, py-2, 2, ph+4).fill(0x686868)  // 左
  this.tileGfx.rect(px+pw, py-2, 2, ph+4).fill(0x686868) // 右
}
```

### HP 條顏色分段

```typescript
const col = hp/maxHp > 0.5 ? 0x44cc44 : hp/maxHp > 0.25 ? 0xccaa00 : 0xcc2222
// 綠 > 50%，黃 25–50%，紅 < 25%
const BAR_W = 40  // 普通敵人；Boss 相同寬度但偏移更大
```

### 寶箱品級機率

```typescript
// Boss 房：epic 50% / rare 35% / common 15%
// 一般房：common 70% / rare 25% / epic 5%
// 遺跡金幣：50 + floor(rng() * 451)  → 50–500
// 顏色：common 0x8b5e2e/0xa0722a，rare 0x3a5fcd/0x5a82e8，epic 0xc9961f/0xffd24a
```

### 敵人 AI（update 每幀）

```typescript
const aggroRange = e.isBoss ? 500 : 350
const hitRange   = e.isBoss ? 36 * e.visualScale : 28 * e.visualScale
// 攻擊冷卻 1000ms，攻擊動畫持續 420ms
if (dist < hitRange && now - e.lastAttackMs > 1000) {
  e.lastAttackMs = now; e.attackUntil = now + 420
  onDamage(e.damage)
}
// 移動速度：e.speed * deltaMs / 16（deltaMs = 16 時速度為 1x）
const spd = e.speed * deltaMs / 16
```

碰撞使用三點 isFloor 測試（中心 + 左右邊界或上下邊界）：

```typescript
const r = e.isBoss ? 24 * e.visualScale : 14 * e.visualScale
if (isFloor(nx, e.y) && isFloor(nx-r, e.y) && isFloor(nx+r, e.y)) e.x = nx
if (isFloor(e.x, ny) && isFloor(e.x, ny-r) && isFloor(e.x, ny+r)) e.y = ny
```

### Boss 擊殺後生成寶箱

```typescript
if (e.isBoss) {
  if (this._bossRoom) this._spawnChest(this._bossRoom, Math.random, true)
  this._bossKillCb?.()
}
```

注意：`Math.random` 直接傳入作為 rng 函式（非 LCG），Boss 後的寶箱品級隨機性來自原生 random。

### 傳送門脈衝動畫

```typescript
this.portalGfx.alpha = 0.75 + Math.sin(now / 400) * 0.25
// alpha 範圍 0.5–1.0，週期約 2.5 秒
```

### 出口偵測

```typescript
const sp = this.layout.rooms[0]  // rooms[0] 永遠是出生房
return Math.hypot(wx - (sp.px + TILE*1.5), wy - (sp.py + TILE*1.5)) < TILE * 2
// 傳送門放在出生房左上角偏移 1.5 tiles
```

## EventBus 互動

- listen `i18n:changed` — 重繪出口傳送門的文字標籤（`t('dungeon.portal.exit', undefined, '出口')`）

## 依賴

- `@/render` — `EntitySpriteDriver`（非同步貼圖）、`EntityDirection` 型別
- `@/treasure/treasureConfig` — `generateLoot`、`LootRarity`
- `@/core/i18n` — `t()` 翻譯函式
- `@/core/EventBus` — i18n 事件監聽
- `./DungeonGenerator` — `DungeonLayout`、`DRoom` 型別（type-only import）

## 重建提示

- `_attachSprite` 有防競態保護：`this.enemies.indexOf(e) === -1` 檢查在 await 之後，若 `setup()` 在載入期間被再次呼叫（切換地牢），舊場景的 enemies 已被清空，掛載會被放棄。
- `setup()` 清除容器時只移除非 tileGfx/portalGfx 的子節點，這兩個 Graphics 物件在整個場景生命週期內重用（`clear()` + 重繪），不重新創建。
- Boss 擊殺後的 `_spawnChest` 使用 `Math.random`（非 LCG rng），每次進入地牢 Boss 寶箱的物品組合不可復現。
- `hpBar` 的偏移量：普通敵人 `y - 28`（x offset `-20`），Boss `y - 42 * scale`（x offset `-30`）— 重建時需注意 boss 用 `e.visualScale` 縮放偏移。
- `peaceful = true` 只關閉追蹤與傷害，不影響貼圖動畫播放。
- `destroy()` 必須呼叫，否則 `i18n:changed` 的 handler 因閉包持有 `this` 而洩漏整個場景。
- 敵人視覺資源名稱格式：`monster.<type>`（如 `monster.goblin_warrior`），與 EntitySpriteDriver manifest key 對應。
