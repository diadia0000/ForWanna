import * as PIXI from 'pixi.js'

export type SelectorState = 'normal' | 'invalid'

export function createSelectorGfx(layer: PIXI.Container): PIXI.Graphics {
  const gfx = new PIXI.Graphics()
  paintSelectorGfx(gfx, 'normal')
  gfx.zIndex = 999999  // 永遠在所有世界物件最上層
  layer.addChild(gfx)
  gfx.visible = false
  return gfx
}

export function paintSelectorGfx(gfx: PIXI.Graphics, state: SelectorState): void {
  gfx.clear()

  if (state === 'invalid') {
    gfx.circle(0, 0, 4).fill({ color: 0xff3333, alpha: 0.95 })
    gfx.circle(0, 0, 6.5).stroke({ color: 0xff2222, alpha: 0.95, width: 2 })
    return
  }

  gfx.circle(0, 0, 2.5).fill({ color: 0xffff88, alpha: 0.98 })
  gfx.circle(0, 0, 4.5).stroke({ color: 0xffffff, alpha: 0.82, width: 1.5 })
}
