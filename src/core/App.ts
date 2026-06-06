// Agent 1 負責 — src/core/App.ts
import * as PIXI from 'pixi.js'

let instance: PIXI.Application | null = null

export async function createApp(): Promise<PIXI.Application> {
  const app = new PIXI.Application()
  await app.init({
    resizeTo: window,          // 自動跟瀏覽器視窗大小
    backgroundColor: 0x0d2a3e,  // 深海藍（世界邊界外的底色）
    antialias: false,
    autoDensity: true,         // CSS px 與 canvas px 對齊
    resolution: window.devicePixelRatio || 1,
  })
  document.getElementById('game-container')!.appendChild(app.canvas)
  instance = app
  return app
}

export function getApp(): PIXI.Application {
  if (!instance) throw new Error('App not initialized. Call createApp() first.')
  return instance
}
