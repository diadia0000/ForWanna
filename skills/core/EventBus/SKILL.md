---
name: core-event-bus
description: 實作型別安全的全域事件匯流排（on / off / emit / once），是所有跨模組通訊的唯一合法管道。重建任何「模組 A 通知模組 B」的功能前，先讀這份理解訂閱機制與型別綁定。
---

# core/EventBus.ts

> 模組：core｜角色：以 `GameEvents` 型別表為基礎的泛型 pub/sub 事件系統，是各模組解耦通訊的中心。

## 公開 API
- `EventBus` — `EventBusClass` 的單例 export（`export const EventBus = new EventBusClass()`）。
- `EventBus.on<K extends keyof GameEvents>(event: K, handler: (payload: GameEvents[K]) => void): void` — 註冊監聽器。
- `EventBus.off<K extends keyof GameEvents>(event: K, handler: (payload: GameEvents[K]) => void): void` — 移除監聽器（需傳入與註冊時相同的函數參考）。
- `EventBus.emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void` — 廣播事件給所有監聽器。
- `EventBus.once<K extends keyof GameEvents>(event: K, handler: (payload: GameEvents[K]) => void): void` — 註冊只觸發一次的監聽器。

`EventBusClass` 本身未 export，只透過單例對外。

## 核心邏輯
- 泛型約束的關鍵：所有方法都用 `K extends keyof GameEvents`，把 `event` 與 `handler` 的 payload 型別綁在一起，達成編譯期型別安全。內部 Map 用 `Handler<unknown>` 收斂存放，存取時 `as Handler<unknown>` / `as` 轉回。整支 class 是泛型 pub/sub 基礎建設，把這段照抄即可重建：

```typescript
type Handler<T> = (payload: T) => void

class EventBusClass {
  // key = 事件名稱字串；value = 該事件的 handler 陣列
  private listeners: Map<string, Handler<unknown>[]> = new Map()

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event)!.push(handler as Handler<unknown>)
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    const idx = handlers.indexOf(handler as Handler<unknown>)  // 靠參考相等比對
    if (idx !== -1) handlers.splice(idx, 1)
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach(h => h(payload))   // 同步逐一呼叫；無 try/catch
  }

  once<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    // wrapper 先跑真 handler，再用自身參考 off 掉自己（tricky 處）
    const wrapper: Handler<GameEvents[K]> = (payload) => {
      handler(payload)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }
}

export const EventBus = new EventBusClass()
```

- `emit` 沒有 try/catch — 任一 handler 拋錯會中斷後續 handler，重建時要意識到這點。
- `once` 移除的是 `wrapper` 而非原 handler，所以使用者無法靠原 handler 參考來 off 一個 once 監聽。
- 邊界條件：同一 handler 重複 `on` 會被加入多次（無去重），emit 時會被呼叫多次。

## EventBus 互動
本檔即事件系統實作本身。對外是泛型 pub/sub：事件名稱與 payload 形狀全部來自 `@/types` 的 `GameEvents` 介面（例如 `player:moved`、`resource:collected`、`network:connected`、`i18n:changed` 等）。新增事件名稱應由 event-architect 在 `@/types` 定義，不在此處硬寫任何特定事件。

## 依賴
- `import type { GameEvents } from '@/types'` — 只當型別用（`import type`），提供所有合法事件名稱與其 payload 形狀。

## 重建提示
- 先寫 `Handler<T>` 別名與 `Map<string, Handler<unknown>[]>` 狀態，再依序 on / off / emit / once。
- 保持「泛型、不含任何模組專屬邏輯」——core 規則禁止把特定模組行為塞進 bus。
- 易踩雷：(1) off 要傳同一參考，匿名箭頭函數無法被 off；(2) emit 是同步且無錯誤隔離；(3) once 移除的是內部 wrapper。
- 這是被最多模組直接 import 的核心物件，簽名一旦改動屬於 breaking change，需通知所有依賴方。
