---
name: player-client-prediction
description: 實作 client-side prediction 與 server reconciliation：本地立即預測玩家移動、收到 Host 確認後修正誤差；只要重建多人移動不卡頓，就必須先來這裡。
---

# player/ClientPrediction.ts

> 模組：player｜角色：維護「未確認輸入的暫存佇列」，在本地立即應用移動輸入（predict），並在收到 Host 的權威狀態後重新播放仍未確認的輸入來修正位置（reconcile）。

## 公開 API

- `predict(input: PlayerInput, currentX: number, currentY: number, tick: number): { x: number; y: number }` — 立即將 input 套用到目前座標，把這一幀（tick、input、預測座標）推入 pendingFrames 佇列，回傳預測後的新座標。
- `reconcile(serverData: Partial<PlayerData>, serverTick: number): { x: number; y: number } | null` — 收到 Host 確認的 tick 與座標後，捨棄 tick <= serverTick 的舊幀，從 serverData.x/y 出發重新播放剩餘未確認幀，回傳修正後座標；若 serverData 缺少 x/y 則回傳 null。
- `clear(): void` — 清空 pendingFrames 佇列（斷線或重置時呼叫）。

## 核心邏輯

### 常數與內部型別

**SPEED 警告：ClientPrediction 的 SPEED=3，Player.ts 的 SPEED=10，兩者刻意不同；reconcile 後若位置跳動，先確認這裡。**

```typescript
const SPEED = 3  // ← ClientPrediction 專用，≠ Player.ts 的 SPEED=10

interface PredictionFrame {
  tick: number
  input: PlayerInput
  predictedX: number
  predictedY: number
}
```

### predict — 立即本地預測並入隊

```typescript
predict(input: PlayerInput, currentX: number, currentY: number, tick: number): { x: number; y: number } {
  let x = currentX
  let y = currentY

  if (input.type === 'move') {
    x += input.dx * SPEED
    y += input.dy * SPEED
  }

  this.pendingFrames.push({ tick, input, predictedX: x, predictedY: y })
  if (this.pendingFrames.length > 60) this.pendingFrames.shift()  // 最多保留 60 幀

  return { x, y }
}
```

### reconcile — 收到 Host 確認後重播未確認幀（THE hard algorithm）

```typescript
reconcile(serverData: Partial<PlayerData>, serverTick: number): { x: number; y: number } | null {
  // 1. 丟棄所有已被 Host 確認的幀
  this.pendingFrames = this.pendingFrames.filter(f => f.tick > serverTick)

  if (serverData.x === undefined || serverData.y === undefined) return null

  // 2. 從 Host 的權威座標出發，重播剩餘未確認輸入
  let x = serverData.x
  let y = serverData.y

  for (const frame of this.pendingFrames) {
    if (frame.input.type === 'move') {
      x += frame.input.dx * SPEED
      y += frame.input.dy * SPEED
    }
  }

  return { x, y }  // 呼叫端自行寫回 sprite.x/y
}
```

### clear

```typescript
clear(): void {
  this.pendingFrames = []
}
```

### 邊界條件

- 若 serverTick 超過所有已知幀，reconcile 後 pendingFrames 為空，直接從 serverData 座標接管。
- 非 'move' 類型的 PlayerInput 在 predict 與 reconcile 中均被忽略（只記錄 tick，但不影響座標）。
- reconcile 後的結果不會自動寫回任何狀態，完全依賴呼叫端消費回傳值。

## EventBus 互動

無

## 依賴

- `@/types`：`PlayerInput`（type、dx、dy）、`PlayerData`（x、y 等欄位），以 `import type` 僅取型別，無執行期依賴。

## 重建提示

- 必須在 `Player.ts` 的 `applyInput` 或上層 GameLoop 裡協調呼叫：先 `predict` 更新本地位置，等網路回傳後呼叫 `reconcile` 再把結果寫回 `sprite.x/y`。
- SPEED 常數要與 Player.ts 的 SPEED 保持一致（或故意區分），兩者不同會造成 reconcile 後跳動；本檔目前 SPEED=3，Player.ts 是 SPEED=10，務必確認設計意圖。
- pendingFrames 上限 60 是為了防止輸入堆積；若遊戲 tick rate 高可能需要調大。
- clear() 應在玩家重生、傳送、或重連時呼叫，避免舊幀污染新位置。
- 與 Player.ts 的耦合點：Player 暴露 `.x .y` 供 predict 取得 currentX/Y，reconcile 結果由外部寫回 `sprite.x/y`；本類別本身不持有 Player 引用，保持單純。
