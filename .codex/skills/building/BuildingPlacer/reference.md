---
name: building-building-placer
description: BuildingPlacer 實作滑鼠跟隨的幽靈預覽（ghost）與點擊放置建築的互動邏輯；重建時凡涉及「建築放置前端互動、顏色回饋、游標切換」都參考這裡。
---

# building/BuildingPlacer.ts

> 模組：building｜角色：在玩家選擇建築時顯示可放置預覽（ghost sprite），追蹤滑鼠、判斷合法性並於點擊時觸發放置回呼。

## 公開 API

- `constructor(app: PIXI.Application, camera: PIXI.Container, buildingLayer: PIXI.Container, buildingSystem: BuildingSystem): BuildingPlacer` — 建立 ghost 容器並加到 buildingLayer，設定 pointermove/pointerdown 監聽，訂閱 `i18n:changed`。
- `setPlayerId(id: PlayerId): void` — 設定目前操作者的玩家 ID（用於材料與碰撞驗證）。
- `setOnPlace(cb: (defId: string, x: number, y: number) => void): void` — 注入放置成功時的回呼（通常在回呼中呼叫 BuildingSystem.place）。
- `start(defId: string, def: BuildingDef): void` — 進入放置模式：依 def.size 繪製半透明矩形 + 名稱文字，顯示 ghost，游標改為 crosshair。
- `cancel(): void` — 取消放置模式，隱藏 ghost，還原游標，清空狀態。
- `isPlacing(): boolean` — 回傳目前是否處於放置模式。

## 核心邏輯

### 常數
- `TILE_SIZE = 32`（注意：BuildingSystem 用 48，這裡是 32；兩個常數值不同，是已知的模組內差異）

### Ghost 渲染

`start()` 每次呼叫都先 `removeChildren()`，再建立 Graphics + Text，ghost Container 整體 alpha = 0.65：

```typescript
start(defId: string, def: BuildingDef): void {
  this.placingDefId = defId
  this.currentDef = def
  this.ghost.removeChildren()
  const g = new PIXI.Graphics()
  const w = def.size.x * TILE_SIZE   // TILE_SIZE = 32
  const h = def.size.y * TILE_SIZE
  g.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.55 })
  g.rect(0, 0, w, h).stroke({ color: 0xffffff, width: 2 })
  const label = new PIXI.Text({
    text: t(`building.${defId}.name`, undefined, def.name),
    style: { fontSize: 9, fill: 0xffffff },
  })
  label.x = 3
  label.y = 2
  this.ghostLabel = label
  this.ghost.addChild(g, label)
  this.ghost.visible = true
  document.body.style.cursor = 'crosshair'
}
```

### 滑鼠座標轉換（screenToWorld）

```typescript
private screenToWorld(clientX: number, clientY: number) {
  const rect = this.app.canvas.getBoundingClientRect()
  const sx = (clientX - rect.left) / rect.width  * this.app.screen.width
  const sy = (clientY - rect.top)  / rect.height * this.app.screen.height
  return { x: sx - this.camera.x, y: sy - this.camera.y }
}
```

### pointermove + pointerdown 處理

格子吸附、tint 回饋、點擊放置（canPlace 驗證兩次）：

```typescript
// pointermove
if (!this.placingDefId) return
const { x, y } = this.screenToWorld(e.clientX, e.clientY)
const sx = Math.floor(x / TILE_SIZE) * TILE_SIZE
const sy = Math.floor(y / TILE_SIZE) * TILE_SIZE
this.ghost.x = sx
this.ghost.y = sy
const ok = this.myPlayerId
  ? this.buildingSystem.canPlace(this.placingDefId, sx, sy, this.myPlayerId)
  : false
this.ghost.tint = ok ? 0x88ff88 : 0xff6666

// pointerdown（左鍵 button===0 才處理）
if (!this.placingDefId || !this.myPlayerId || e.button !== 0) return
// ... 同上吸附計算 ...
if (!this.buildingSystem.canPlace(this.placingDefId, sx, sy, this.myPlayerId)) return
this.onPlaceCb?.(this.placingDefId, sx, sy)
this.cancel()
```

### 語言切換

```typescript
EventBus.on('i18n:changed', () => {
  if (this.ghostLabel && this.placingDefId && this.currentDef) {
    this.ghostLabel.text = t(
      `building.${this.placingDefId}.name`,
      undefined,
      this.currentDef.name,
    )
  }
})
```

## EventBus 互動

- on `i18n:changed` — 更新 ghost 標籤文字到目前語言；觸發時機：玩家切換語言。
- 無 emit。

## 依賴

- `pixi.js` — PIXI.Application、PIXI.Container、PIXI.Graphics、PIXI.Text
- `@/types` — BuildingDef、PlayerId（型別）
- `./BuildingSystem` — BuildingSystem（型別，用於 canPlace 呼叫，建構子注入）
- `@/core/i18n` — `t()` 翻譯函數
- `@/core/EventBus` — 訂閱 `i18n:changed`

## 重建提示

- BuildingPlacer 的 TILE_SIZE 是 32，BuildingSystem 是 48，必須維持各自獨立——改任一個都要確認 ghost 和實際放置座標是否錯位。
- ghost 本身不知道放置是否成功，成功與否靠 canPlace 的回傳值改變 tint；實際扣料、加入世界狀態是在 onPlaceCb 回呼（通常就是 BuildingSystem.place）裡做。
- cancel() 在 pointerdown 成功後會自動呼叫，外部也可隨時呼叫（例如按 Escape）。
- setPlayerId 必須在 start() 之前設定；若 myPlayerId 為空字串，canPlace 會傳入空字串，多數情況會因材料不足而回傳 false，導致 ghost 永遠紅色。
- 與 BuildingSystem 的耦合點：僅有 canPlace 呼叫，不直接呼叫 place；保持這個邊界以防止 Host-only 邏輯漏出。
