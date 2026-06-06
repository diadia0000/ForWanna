---
name: player-player
description: 玩家實體的核心類別：管理 PixiJS sprite 渲染（fallback 幾何圖形 + EntitySpriteDriver manifest 動畫）、移動輸入、朝向、手持工具揮砍動畫，以及從 Host 同步狀態；重建玩家視覺與邏輯時必讀。
---

# player/Player.ts

> 模組：player｜角色：封裝單一玩家的所有本地狀態與渲染邏輯；既處理本地輸入（applyInput），也能接收 Host 廣播後同步（syncFromServer），並在每個 update tick 推進行走動畫與工具動畫。

## 公開 API

- `constructor(data: PlayerData): Player` — 以初始 PlayerData 建立玩家；初始化 PIXI.Container、嘗試同步載入 EntitySpriteDriver（sync manifest），失敗則建立 fallback 幾何 sprite，並非同步嘗試載入 manifest。
- `get x(): number` — 取得 `sprite.x`（目前位置 x）。
- `get y(): number` — 取得 `sprite.y`（目前位置 y）。
- `get currentFacingDir(): Dir` — 取得目前面向（`'UP' | 'DOWN' | 'LEFT' | 'RIGHT'`）。
- `sprite: PIXI.Container` — 供外部場景圖掛載的根容器（公開屬性）。
- `applyInput(input: PlayerInput): void` — 本地套用移動輸入、更新 sprite 位置與朝向、設 isMoving，並 emit `player:moved`。
- `syncFromServer(data: Partial<PlayerData>): void` — 接收 Host 廣播的部分狀態，覆寫 sprite 位置及 hp/maxHp/xp/level/gold，並更新朝向與 isMoving。
- `update(delta: number): void` — 每幀呼叫；若有 driver 則播放動畫；否則驅動 fallback 行走幀與腿部偏移；最後重置 isMoving 並刷新手持物品位置。
- `setHeldItem(icon: string | null): void` — 設定手持物品圖示（emoji/文字），null 表示隱藏；位置依 facingDir 偏移。
- `setHeldToolKind(kind: HeldItemKind): void` — 設定手持工具種類（delegatse 到 setHeldToolItem）。
- `setHeldToolItem(itemId: string | null, kind: HeldItemKind): void` — 載入對應工具貼圖並顯示；非合法工具種類（不在 sword/pickaxe/axe 集合）則隱藏。
- `setHeldToolAim(dx: number, dy: number): void` — 設定工具瞄準方向（atan2 角度），並同步更新 facingDir。
- `swingHeldTool(): void` — 觸發揮砍動畫（記錄 swingStart 為 `performance.now()`）。
- `setFacing(dx: number): void` — 強制設定左右朝向，並設 isMoving = true。
- `getData(): PlayerData` — 回傳目前資料快照（x/y 取自 sprite 位置）。
- `destroy(): void` — 銷毀 sprite（釋放 WebGL 資源）。

## 核心邏輯

### 關鍵常數與型別

**SPEED=10（≠ ClientPrediction 的 SPEED=3）；兩邊不一致是已知設計，reconcile 跳動時先確認。**

```typescript
const SPEED = 10          // ← Player.ts 專用，≠ ClientPrediction.ts 的 SPEED=3
const HEAD_R = 12
const SKIN_COLOR = 0xffcc80
const SHADOW_ALPHA = 0.22
const WALK_FRAMES = 4
const TICKS_PER_FRAME = 12
const HELD_TOOL_RADIUS = 16
const HELD_TOOL_SCALE = 1.875
const HELD_TOOL_SWING_MS = 130
const HELD_TOOL_SWING_RAD = Math.PI * 0.62

const LEG_OFFSETS: [number, number][] = [[0,0], [-5,5], [0,0], [5,-5]]

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
const HELD_TOOL_KINDS = new Set<HeldItemKind>(['sword', 'pickaxe', 'axe'])
```

### 關鍵 private 欄位

```typescript
private walkFrame = 0
private frameTicks = 0
private isMoving = false
private facingLeft = false
private facingDir: Dir = 'DOWN'
private driver: EntitySpriteDriver | null = null
private heldToolTextureToken = 0   // race condition 防護
private heldToolAimAngle = 0
private heldToolSwingStart = 0
```

### sprite 結構（fallback）

```
PIXI.Container (sprite, sortableChildren=true)
  PIXI.Container (body, zIndex=0)
    ellipse shadow
    leftLeg (Graphics)
    rightLeg (Graphics)
    torso (Graphics, roundRect 20x20 r=4)
    armL, armR (Graphics)
    head (Graphics, circle r=12 at 0,-18)
  PIXI.Text (nameLabel)
  [optional] EntitySpriteDriver.sprite
  [optional] heldItemLabel (PIXI.Text)
  [optional] heldToolSprite (PIXI.Sprite, zIndex=5)
```

### applyInput — 輸入 → 移動 + 事件

```typescript
applyInput(input: PlayerInput): void {
  if (input.type !== 'move') return
  this.sprite.x += input.dx * SPEED
  this.sprite.y += input.dy * SPEED
  this.data.x = this.sprite.x
  this.data.y = this.sprite.y
  this._updateFacing(input.dx, input.dy)
  if (input.dx !== 0 || input.dy !== 0) this.isMoving = true
  EventBus.emit('player:moved', { playerId: this.id, x: this.data.x, y: this.data.y })
}
```

### update — 每幀動畫推進

```typescript
update(delta: number): void {
  if (this.driver) {
    void this.driver.play(this.isMoving ? 'MOVE' : 'IDLE', this.facingDir)
    this.driver.update(delta)
    this.isMoving = false
    this._updateHeldItemPos()
    this._updateHeldToolPos()
    return
  }
  // fallback 幾何動畫
  this.body.scale.x = this.facingLeft ? -1 : 1
  if (this.isMoving) {
    this.frameTicks++
    if (this.frameTicks >= TICKS_PER_FRAME) {
      this.frameTicks = 0
      this.walkFrame = (this.walkFrame + 1) % WALK_FRAMES
    }
  } else {
    this.walkFrame = 0
    this.frameTicks = 0
  }
  const [lo, ro] = LEG_OFFSETS[this.walkFrame]
  this.leftLeg.y = lo
  this.rightLeg.y = ro
  this.isMoving = false
  // …updateHeldItemPos / updateHeldToolPos
}
```

### 朝向判斷（_updateFacing / _syncFacingFromAim — 邏輯相同）

```typescript
private _updateFacing(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return
  if (Math.abs(dx) >= Math.abs(dy)) {
    this.facingLeft = dx < 0
    this.facingDir = dx < 0 ? 'LEFT' : 'RIGHT'
  } else {
    this.facingDir = dy < 0 ? 'UP' : 'DOWN'
  }
}
```

### 手持工具位置計算 — 揮砍三角曲線

```typescript
private _updateHeldToolPos(): void {
  if (!this.heldToolSprite || !this.heldToolSprite.visible || !this.heldToolKind) return
  const elapsed = performance.now() - this.heldToolSwingStart
  const t = elapsed >= 0 && elapsed < HELD_TOOL_SWING_MS ? elapsed / HELD_TOOL_SWING_MS : 1
  const swing = t < 1 ? (1 - Math.abs(t * 2 - 1)) * HELD_TOOL_SWING_RAD : 0  // 峰值在 t=0.5
  const side = Math.cos(this.heldToolAimAngle) < 0 ? -1 : 1
  const angle = this.heldToolAimAngle + side * (-0.38 + swing)

  this.heldToolSprite.x = Math.cos(this.heldToolAimAngle) * HELD_TOOL_RADIUS
  this.heldToolSprite.y = Math.sin(this.heldToolAimAngle) * HELD_TOOL_RADIUS + 2
  this.heldToolSprite.rotation = angle + Math.PI / 2
  this.heldToolSprite.scale.x = Math.abs(this.heldToolSprite.scale.x) * side
  this.heldToolSprite.zIndex = Math.sin(this.heldToolAimAngle) < -0.35 ? -1 : 5
}
```

### darken 函數（模組私有）

```typescript
function darken(color: number, amount: number): number {
  const r = Math.round(((color >> 16) & 0xff) * (1 - amount))
  const g = Math.round(((color >> 8)  & 0xff) * (1 - amount))
  const b = Math.round((color & 0xff)          * (1 - amount))
  return (r << 16) | (g << 8) | b
}
```

### nameLabel 位置計算

- fallback：`y = -(HEAD_R * 2 + 14)` = -38 px。
- driver 存在：`y = (manifest.offset.y ?? 0) - (manifest.height ?? 0) * (manifest.scale ?? 1) * (manifest.anchor.y ?? 1) - 8`。

### EntitySpriteDriver 整合流程

1. 建構時先嘗試 `EntitySpriteDriver.createSync(spriteManifestId)`（同步）。
2. 若成功：直接使用 driver；跳過 fallback。
3. 若失敗且 `hasEntitySpriteManifest(id)` 為 true：先建 fallback（body 可見），同時非同步呼叫 `EntitySpriteDriver.create(id)`。
4. 非同步 driver 載入完成後：`body.visible = false`，`sprite.addChildAt(driver.sprite, 0)`，重新掛載 nameLabel。
5. update 時若 driver 存在，呼叫 `driver.play(isMoving ? 'MOVE' : 'IDLE', facingDir)` 與 `driver.update(delta)`。

## EventBus 互動

- emit `player:moved` — payload `{ playerId: string, x: number, y: number }`，在 `applyInput` 每次成功移動後觸發（即使 dx/dy=0 也會 emit，因為 input.type === 'move' 就觸發）。

無 `on` 監聽。

## 依賴

- `pixi.js`：PIXI.Container、PIXI.Graphics、PIXI.Text、PIXI.Sprite、PIXI.Assets — 全部渲染層元件。
- `@/types`：`PlayerData`（id、name、x、y、hp、maxHp、xp、level、gold、color 等）、`PlayerInput`（type、dx、dy）。
- `@/core/EventBus`：emit `player:moved`。
- `@/render`：`EntitySpriteDriver`（sprite manifest 驅動）、`hasEntitySpriteManifest`（檢查 manifest 是否存在）。
- `@/inventory`：`HeldItemKind`（type-only import，用於定義可持工具集合）。

## 重建提示

- Player 本身不呼叫 ClientPrediction，兩者需要在上層（GameLoop 或 PlayerManager）協調：applyInput 做本地預測，reconcile 後再呼叫 syncFromServer 或直接修改 sprite 座標。
- fallback sprite 的幾何結構（torso roundRect -10,-10,20,20、head circle r=12、armL/R 各 6px 寬）要完全正確，否則視覺明顯出錯。
- EntitySpriteDriver 的非同步載入使用 token（`heldToolTextureToken`）機制防止 race condition——工具貼圖的載入同理，token 不匹配時丟棄結果。
- `syncFromServer` 不設 isMoving=true 除非 x 或 y 有變化；這樣靜止的遠端玩家不會持續播放行走動畫。
- `setHeldToolItem` 與 `setHeldToolKind` 的區別：後者是前者的 itemId=null 的快捷；若 kind 不在 HELD_TOOL_KINDS（sword/pickaxe/axe）中，會隱藏所有手持物。
- zIndex 排序需要 `sprite.sortableChildren = true`，忘記設定會導致工具永遠在角色上層。
