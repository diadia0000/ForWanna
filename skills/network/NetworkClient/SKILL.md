---
name: network-client
description: Client 端 PeerJS 連線實作，重建時參考它處理「加入房間後收 state_full、持續收 state_delta、心跳保活、斷線清理」的完整流程——每個細節都有時序與邊界條件。
---

# network/NetworkClient.ts

> 模組：network｜角色：Client 端網路類，負責向 Host 建立 DataConnection、送出 join 訊息、處理所有入站訊息類型、維持心跳、並在斷線時清理狀態

## 公開 API

- `NetworkClient.connect(peer: Peer, hostPeerId: string, playerName: string): Promise<void>` — 建立 DataConnection 並完成 join 握手；在收到 `state_full` 或 `join_ack` 後 resolve，15 秒內未收到則 reject
- `NetworkClient.send(msg: NetMessage): void` — 透過已開啟的 DataConnection 送訊息給 Host；conn 未開啟時只 warn 不拋錯
- `NetworkClient.disconnect(): void` — 送 `leave` 訊息、停心跳、關閉 conn

`NetworkClient` 是 singleton（`new NetworkClientClass()` 匯出，不是 class）。

## 核心邏輯

### 連線建立流程（`connect`）

1. 呼叫 `loadLocalPlayerData(playerName)` 取得本機玩家資料（優先讀 `localStorage['forager_player']`，若無則建立新 PlayerData）。
2. 呼叫 `peer.connect(hostPeerId, { reliable: true })` 建立 DataConnection，設為可靠模式。
3. 設 15 秒 timeout；超時 reject 並提示 WebRTC 通道問題。
4. `conn.on('open')` 觸發時：
   - 讀取 `localStorage['forager_stable_id']`（若無則 `crypto.randomUUID()` 並寫回）作為跨 session 帳號識別碼。
   - 讀取 `localStorage['forager_map_pos']`（JSON，格式為 `Record<string, {x,y}>`）作為 per-map 位置記錄。
   - 送出 `join` 訊息，payload 含：`type:'join'`、`playerData`、`stableId`（帳號 ID）、`sessionId`（本次 session UUID，`crypto.randomUUID()` 在建構時產生）、`mapPositions`。
   - 呼叫 `startHeartbeat()`。
5. `conn.on('data')` 收到訊息後呼叫 `handleMessage`；若訊息為 `state_full` 或 `join_ack` 則 clearTimeout 並 resolve Promise。
6. `conn.on('error')` → clearTimeout + reject。
7. `conn.on('close')` → `stopHeartbeat()` + emit `network:disconnected`。

```typescript
async connect(peer: Peer, hostPeerId: string, playerName: string): Promise<void> {
  const playerData = this.loadLocalPlayerData(playerName)
  return new Promise((resolve, reject) => {
    const conn = peer.connect(hostPeerId, { reliable: true })
    this.conn = conn

    const timeout = setTimeout(() => reject(new Error('WebRTC 資料通道逾時（15秒）')), 15_000)

    conn.on('open', () => {
      let stableId = localStorage.getItem('forager_stable_id') ?? ''
      if (!stableId) {
        stableId = crypto.randomUUID()
        localStorage.setItem('forager_stable_id', stableId)
      }
      const mapPositions: Record<string, { x: number; y: number }> =
        JSON.parse(localStorage.getItem('forager_map_pos') ?? '{}')
      conn.send({ type: 'join', playerData, stableId, sessionId: this.sessionId, mapPositions } as NetMessage)
      this.startHeartbeat()
    })

    conn.on('data', (raw) => {
      const msg = raw as NetMessage
      this.handleMessage(msg)
      if (msg.type === 'state_full' || msg.type === 'join_ack') {
        clearTimeout(timeout)
        resolve()
      }
    })

    conn.on('error', (err) => { clearTimeout(timeout); reject(err) })
    conn.on('close', () => {
      this.stopHeartbeat()
      EventBus.emit('network:disconnected', { playerId: 'host' })
    })
  })
}
```

### 入站訊息處理（`handleMessage`）

| msg.type | 行為 |
|---|---|
| `state_full` | `GameStateManager_.set(msg.state)` 後 dispatch `window` CustomEvent `client:state_full`，detail 為 `msg.state` |
| `state_delta` | dispatch `window` CustomEvent `client:state_delta`，detail 為整個 `msg` |
| `player_list` | 對 `msg.players` 每個 player 呼叫 `GameStateManager_.setPlayer(p.id, p)`；dispatch `window` CustomEvent `client:player_list`，detail 為 `msg.players` |
| `kicked` | 呼叫 `alert`（使用 i18n key `network.kicked`，含 `reason` 插值） |

注意：`client:state_full` / `client:state_delta` / `client:player_list` 是 `window` CustomEvent，不是 EventBus，讓 `main.ts` 以 `window.addEventListener` 消費。

```typescript
private handleMessage(msg: NetMessage): void {
  switch (msg.type) {
    case 'state_full':
      GameStateManager_.set(msg.state)
      window.dispatchEvent(new CustomEvent('client:state_full', { detail: msg.state }))
      break
    case 'state_delta':
      window.dispatchEvent(new CustomEvent('client:state_delta', { detail: msg }))
      break
    case 'player_list':
      msg.players.forEach(p => GameStateManager_.setPlayer(p.id, p))
      window.dispatchEvent(new CustomEvent('client:player_list', { detail: msg.players }))
      break
    case 'kicked':
      alert(t('network.kicked', { reason: msg.reason ?? '' }, `被踢出：${msg.reason}`))
      break
  }
}
```

### 心跳機制

- `startHeartbeat()` 用 `setInterval` 每 **2000ms** 送一個 `{ type: 'heartbeat' }` 訊息。
- `stopHeartbeat()` 呼叫 `clearInterval` 並把計時器設為 null，冪等（null 時直接 return）。
- 斷線或 `disconnect()` 時一律呼叫 `stopHeartbeat()`，防止 timer leak。

```typescript
private startHeartbeat(): void {
  this.stopHeartbeat()
  this.heartbeatTimer = setInterval(() => {
    if (this.conn?.open) this.conn.send({ type: 'heartbeat' } as any)
  }, 2000)
}

private stopHeartbeat(): void {
  if (!this.heartbeatTimer) return
  clearInterval(this.heartbeatTimer)
  this.heartbeatTimer = null
}
```

### 本機玩家資料載入（`loadLocalPlayerData`）

- 先讀 `localStorage['forager_player']`；若存在，解析 JSON 並做向下相容補丁：`researchLevel` 若 undefined 則補值 `1`。
- 若無存檔，建立初始 PlayerData：`hp/maxHp=100`、`xp=0`、`level=1`、`researchLevel=1`、`gold=0`、`inventory=[]`、`unlockedSkills=[]`、`color=Math.random()*0xffffff`、`x=0,y=0`、`id=crypto.randomUUID()`。

```typescript
private loadLocalPlayerData(name: string): PlayerData {
  const saved = localStorage.getItem('forager_player')
  if (saved) {
    const data = JSON.parse(saved) as PlayerData
    if (data.researchLevel === undefined) data.researchLevel = 1  // 向下相容補丁
    return data
  }
  return {
    id: crypto.randomUUID(), name,
    x: 0, y: 0,
    hp: 100, maxHp: 100,
    xp: 0, level: 1,
    researchLevel: 1,
    gold: 0,
    inventory: [], unlockedSkills: [],
    color: Math.random() * 0xffffff,
  }
}
```

### 內部狀態

| 屬性 | 型別 | 說明 |
|---|---|---|
| `conn` | `DataConnection \| null` | 目前與 Host 的連線 |
| `sessionId` | `string` | `crypto.randomUUID()` 在物件建構時就確定，跨 connect 不變 |
| `heartbeatTimer` | `ReturnType<typeof setInterval> \| null` | 心跳計時器句柄 |

## EventBus 互動

- emit `network:disconnected` — payload `{ playerId: 'host' }`，當 `conn.on('close')` 觸發時（即與 Host 斷線）

（無 EventBus `on` 監聽）

## 訊息協定

| 訊息 type | 方向 | 何時送 | 關鍵欄位 |
|---|---|---|---|
| `join` | Client→Host | 資料通道 open 後立刻送 | `playerData`, `stableId`, `sessionId`, `mapPositions` |
| `heartbeat` | Client→Host | 每 2 秒一次（間隔） | 無額外欄位 |
| `leave` | Client→Host | `disconnect()` 時 | 無額外欄位 |
| `state_full` | Host→Client | 加入後 Host 回傳 | `state`, `tick` |
| `state_delta` | Host→Client | 每 tick 更新 | `msg` 整體轉發 |
| `player_list` | Host→Client | 有人加入/離開時 | `players[]` |
| `kicked` | Host→Client | 被踢 | `reason` (string) |

## 依賴

- `peerjs` — `Peer`（type import）、`DataConnection`（type import）
- `@/types` — `NetMessage`, `PlayerData`（type imports）
- `@/core/EventBus` — emit `network:disconnected`
- `@/core/GameState` — `GameStateManager_`，用 `.set()` / `.setPlayer()` 更新狀態
- `@/core/i18n` — `t()` 函數，用於 timeout 和 kicked 的本地化訊息

## 重建提示

- 實作順序：先寫 `connect()` 的 Promise wrapper，再補 `handleMessage` switch，最後加心跳。
- `state_full` / `state_delta` / `player_list` 用 `window.dispatchEvent(new CustomEvent(...))` 而非 `EventBus.emit`，因為消費者是 `main.ts` 的整合層，不是 network 模組自己。
- `sessionId` 在類別建構時生成一次，讓 Host 用 `stableId:sessionId` 組合鍵識別同一個玩家的不同視窗。
- `disconnect()` 需在 close conn 前先送 `leave`，但 conn 可能已關閉，需 guard `conn?.open`。
- `send()` 要 guard `conn?.open`，不要拋錯，只 warn，避免遊戲邏輯崩潰。
- 舊存檔向下相容補丁（`researchLevel`）放在 `loadLocalPlayerData` 內，每次讀取時套用。
