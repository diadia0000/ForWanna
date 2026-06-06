---
name: selector-gfx
description: Rebuild the PixiJS placement/target selector graphic — normal vs invalid state circles, top z-index.
---

# ui/SelectorGfx.ts

> 模組：ui｜角色：PixiJS 世界選取游標圖形（normal 黃點 / invalid 紅圈），永遠在最上層

## 公開 API

- `type SelectorState = 'normal' | 'invalid'`
- `createSelectorGfx(layer: PIXI.Container): PIXI.Graphics` — 建立、加入 layer、預設隱藏
- `paintSelectorGfx(gfx: PIXI.Graphics, state: SelectorState): void` — 重繪指定狀態

## 核心邏輯（完整 — 小檔）

```typescript
import * as PIXI from 'pixi.js'

export function createSelectorGfx(layer: PIXI.Container): PIXI.Graphics {
  const gfx = new PIXI.Graphics()
  paintSelectorGfx(gfx, 'normal')
  gfx.zIndex = 999999     // 永遠在所有世界物件最上層
  layer.addChild(gfx)
  gfx.visible = false     // 預設隱藏，由外部控制顯示
  return gfx
}

export function paintSelectorGfx(gfx: PIXI.Graphics, state: SelectorState): void {
  gfx.clear()
  if (state === 'invalid') {
    gfx.circle(0, 0, 4).fill({ color: 0xff3333, alpha: 0.95 })
    gfx.circle(0, 0, 6.5).stroke({ color: 0xff2222, alpha: 0.95, width: 2 })
    return
  }
  // normal
  gfx.circle(0, 0, 2.5).fill({ color: 0xffff88, alpha: 0.98 })
  gfx.circle(0, 0, 4.5).stroke({ color: 0xffffff, alpha: 0.82, width: 1.5 })
}
```

## EventBus 互動

- 無（純繪圖工具函式）

## 依賴

- `pixi.js`（PIXI.Container / PIXI.Graphics）

## 重建提示

- 用 PixiJS v8 Graphics API：`.circle(x,y,r).fill({color,alpha})` 與 `.stroke({color,alpha,width})`（非舊版 `beginFill`）。
- `zIndex = 999999` 確保壓在所有世界物件上；layer 須開啟 `sortableChildren` 才生效（由呼叫方保證）。
- 半徑很小（2.5~6.5），座標是世界座標系下的圓心 `(0,0)`，位置由 gfx.position 在外部設定。
- `paintSelectorGfx` 先 `clear()` 再重畫，可重複呼叫切換狀態。
