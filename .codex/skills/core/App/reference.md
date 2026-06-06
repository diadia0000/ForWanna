---
name: core-app
description: 實作 PixiJS Application 的建立與全域單例存取（createApp / getApp）。重建專案時，凡是要初始化 PIXI 畫布、設定背景色 / resize / DPR、或任何模組要拿到 app 實例，務必先參考這份。
---

# core/App.ts

> 模組：core｜角色：建立並持有唯一一個 PixiJS `Application` 實例，作為整個渲染與 ticker 的根。

## 公開 API
- `createApp(): Promise<PIXI.Application>` — 非同步建立並初始化 PixiJS Application，掛到 DOM，存進模組級單例後回傳。需在所有需要 app 的程式之前 await 一次。
- `getApp(): PIXI.Application` — 回傳已建立的單例。若尚未 `createApp()` 就呼叫，丟出 `Error('App not initialized. Call createApp() first.')`。

## 核心邏輯
- 模組頂層有一個私有變數 `let instance: PIXI.Application | null = null`，作為單例存放點。
- `createApp()` 流程（PixiJS v8 風格：建構子不帶參數，初始化靠 `await app.init(...)`）。`init` 的 options 數值是要點，務必照抄：

```typescript
let instance: PIXI.Application | null = null

export async function createApp(): Promise<PIXI.Application> {
  const app = new PIXI.Application()
  await app.init({
    resizeTo: window,                          // 畫布自動跟瀏覽器視窗大小
    backgroundColor: 0x0d2a3e,                 // 深海藍：世界邊界外底色
    antialias: false,
    autoDensity: true,                         // CSS px 與 canvas px 對齊
    resolution: window.devicePixelRatio || 1,  // 高 DPI 螢幕
  })
  // v8 是 app.canvas（不是 v7 的 app.view）；! 斷言 HTML 一定有 #game-container
  document.getElementById('game-container')!.appendChild(app.canvas)
  instance = app
  return app
}

export function getApp(): PIXI.Application {
  if (!instance) throw new Error('App not initialized. Call createApp() first.')
  return instance
}
```

- `getApp()`：單純的 null 檢查 + 拋錯守衛，確保使用方一定在初始化後才取用。
- 邊界條件：`createApp()` 重複呼叫會建立新的 app 並覆寫 instance（沒有冪等保護），實務上整個生命週期只應呼叫一次。

## EventBus 互動
無。

## 依賴
- `import * as PIXI from 'pixi.js'` — 用來建立 `Application`。
- 隱性依賴 DOM：`window`、`document.getElementById('game-container')`、`window.devicePixelRatio`。

## 重建提示
- 這是初始化順序最前面的一塊：通常 `main.ts` 會 `const app = await createApp()`，再把 app 傳給 `GameLoop.start(app)`、render 層等。
- 易踩雷：PixiJS v8 才有 `app.init()` 與 `app.canvas`；若用 v7 以下 API 會對不上（建構子要帶 options、用 `app.view`）。
- HTML 端必須存在 `<div id="game-container">`，否則 `!` 斷言會在 runtime 變成 `appendChild of null`。
- 不要把單例設計成 export 變數直接給人改；只透過 `getApp()` 取，維持「未初始化即拋錯」的保護。
