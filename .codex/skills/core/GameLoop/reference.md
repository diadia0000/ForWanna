---
name: core-game-loop
description: 實作固定 60 tick/s 的主迴圈，包裝 PixiJS Ticker、每幀遞增全域 tick、並分發 (delta, tick) 給註冊的 callbacks。重建任何需要「每幀更新」的系統（移動、戰鬥、怪物 AI、同步節流）前先讀這份。
---

# core/GameLoop.ts

> 模組：core｜角色：以 PixiJS Ticker 為底的中央遊戲迴圈，統一驅動所有逐幀邏輯並推進全域 tick 計數。

## 公開 API
- `GameLoop` — `GameLoopClass` 的單例 export。
- `GameLoop.start(app: PIXI.Application): void` — 綁定 app 的 ticker、設定 maxFPS、註冊主迴圈回呼。
- `GameLoop.stop(): void` — 停止 ticker（`this.ticker?.stop()`）。
- `GameLoop.addCallback(cb: (delta: number, tick: number) => void): void` — 註冊一個每幀回呼。
- `GameLoop.removeCallback(cb: (delta: number, tick: number) => void): void` — 移除回呼（用 indexOf + splice，需同參考）。
- `GameLoop.TICK_RATE: number`（`readonly`，值為 `60`）— 固定 tick 率常數。

`TickCallback` 型別 = `(delta: number, tick: number) => void`（未 export，但簽名即上述 callback 形狀）。

## 核心邏輯
- 整個 loop 把「tick 推進」與「tick 讀取」都委派給 `GameStateManager_`，自身不持有 tick 數值。核心是 `start` 裡 `ticker.add` 那段每幀回呼：

```typescript
type TickCallback = (delta: number, tick: number) => void

class GameLoopClass {
  private ticker: PIXI.Ticker | null = null  // 啟動後指向 app.ticker
  private callbacks: TickCallback[] = []
  readonly TICK_RATE = 60                     // 固定 60 tick/s

  start(app: PIXI.Application): void {
    this.ticker = app.ticker                  // 重用 Application 的 ticker，不另建
    this.ticker.maxFPS = this.TICK_RATE       // 上限鎖 60 FPS
    this.ticker.add((ticker) => {
      GameStateManager_.incrementTick()        // 1. 推進全域 tick
      const tick = GameStateManager_.get().tick // 2. 讀回最新 tick
      // 3. deltaTime 是「相對幀時間」（60FPS 時約 1），非毫秒
      this.callbacks.forEach(cb => cb(ticker.deltaTime, tick))
    })
  }

  stop(): void { this.ticker?.stop() }         // 可選鏈避免未 start 報錯；不清空 callbacks

  addCallback(cb: TickCallback): void { this.callbacks.push(cb) }

  removeCallback(cb: TickCallback): void {
    const idx = this.callbacks.indexOf(cb)     // 參考比對
    if (idx !== -1) this.callbacks.splice(idx, 1)
  }
}

export const GameLoop = new GameLoopClass()
```

- 邊界條件：重複 `start` 會再 add 一個 ticker 回呼（無去重保護）；`removeCallback` 需傳同參考。

## EventBus 互動
無（GameLoop 不直接 emit/on；逐幀邏輯交給 callbacks，事件由各 callback 自行處理）。

## 依賴
- `import * as PIXI from 'pixi.js'` — 取得 `PIXI.Ticker`、`PIXI.Application` 型別與 ticker。
- `import { EventBus } from './EventBus'` — 已 import（同 core 內部）。
- `import { GameStateManager_ } from './GameState'` — 呼叫 `incrementTick()` 與 `get().tick` 推進並讀取全域 tick。

## 重建提示
- 初始化順序：先 `createApp()` 拿到 app，再 `GameLoop.start(app)`；各系統在 start 前後 `addCallback` 掛上更新函數。
- 與 GameState 強耦合（tick 由它推進與保存），重建 GameState 時要保留 `incrementTick()` 與 `get().tick`。
- 易踩雷：(1) `ticker.deltaTime` 是相對值（非毫秒），用它做時間積分時要乘上對應係數；(2) maxFPS 鎖 60 但 deltaTime 仍會隨實際幀率浮動；(3) addCallback 無去重，重複註冊會多次執行。
