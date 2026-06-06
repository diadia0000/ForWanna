---
name: network-host
description: Host 端 PeerJS 連線管理，重建時參考它處理「多客戶端接入、stableId 重連去重、心跳掃描踢人、玩家 sprite 輪派、廣播/單播/排除廣播」等 Host 權威模型的核心邏輯。
---

# network/NetworkHost.ts

> 模組：network｜角色：Host 端網路類，接受所有 Client 的 DataConnection、驗證 join 訊息、維護連線表與心跳追蹤、廣播 state 更新，是 Host 權威模型的網路閘道

## 公開 API

- `NetworkHost.init(peer: Peer): void` — 傳入已開啟的 Peer 物件，設定 `connection` 事件監聽，啟動心跳掃描（每 3 秒一次），冪等（只啟動一次 sweep）
- `NetworkHost.broadcast(msg: NetMessage): void` — 送給所有已連線客戶端
- `NetworkHost.broadcastExcept(excludeId: PlayerId, msg: NetMessage): void` — 送給除 excludeId 以外的所有客戶端
- `NetworkHost.sendTo(playerId: PlayerId, msg: NetMessage): void` — 送給特定玩家；若無此連線則靜默
- `NetworkHost.getConnectedCount(): number` — 回傳目前連線數

`NetworkHost` 是 singleton。

## 核心邏輯

### 內部狀態

| 屬性 | 型別 | 說明 |
|---|---|---|
| `connections` | `Map<PlayerId, DataConnection>` | peerId → 連線物件 |
| `stableIds` | `Map<PlayerId, string>` | peerId → `stableId:sessionId` 複合鍵，用於重連去重 |
| `lastSeen` | `Map<PlayerId, number>` | peerId → 最後一次收到訊息的 timestamp (ms) |
| `heartbeatSweep` | interval handle | 每 3 秒呼叫 `sweepStaleConnections()` |
| `peer` | `Peer \| null` | 傳入的 PeerJS 物件，保留供日後擴充 |

### Sprite 輪派（`assignPlayerSprites`，模組頂層函數）

候選 spriteId 陣列：`['player', 'player.monk2', 'player.boy', 'player.eskimo']`（共 4 個，以 `% 4` 循環）。

排序規則：hostId 排第 0，其他玩家以 peerId 字典序排列。排序完後依 index mod 4 分派 `spriteId` 到 GameState player 物件。在任何玩家加入或離開後都必須呼叫，以確保 sprite 分配穩定。

```typescript
const PLAYER_SPRITE_IDS = ['player', 'player.monk2', 'player.boy', 'player.eskimo'] as const

function assignPlayerSprites(): void {
  const state = GameStateManager_.get()
  const ids = Object.keys(state.players)
  ids.sort((a, b) => {
    if (a === state.hostId) return -1
    if (b === state.hostId) return 1
    return a.localeCompare(b)
  })
  ids.forEach((id, index) => {
    const player = state.players[id] as any
    if (player) player.spriteId = PLAYER_SPRITE_IDS[index % PLAYER_SPRITE_IDS.length]
  })
}
```

### 處理新連線（`handleConnection`）

每個新 DataConnection 綁定三個事件：

**`conn.on('data')` 處理邏輯：**

- `type === 'join'`：
  1. 從 msg 提取 `stableId`（帳號 UUID）和 `sessionId`（本次視窗 UUID），組成複合鍵 `stableId:sessionId`。
  2. 遍歷現有 `connections`：若找到相同複合鍵的舊連線，關閉舊連線、從 connections/stableIds/GameState 移除舊玩家、emit `network:disconnected`（防止同帳號重複在線）。
  3. 決定出生位置：讀 `GameStateManager_.getWorld()?.seed`，在 `msg.mapPositions[seed]` 找到上次位置；若無，使用 `WORLD_CONFIG.CENTER_X / CENTER_Y` 作為預設出生點。
  4. 以 `conn.peer` 作為 playerId，存入 `connections`、`lastSeen`（`Date.now()`）、`stableIds`。
  5. `GameStateManager_.setPlayer(playerId, { ...msg.playerData, id: playerId, x: spawnX, y: spawnY })`。
  6. `assignPlayerSprites()`。
  7. `sendTo(playerId, { type: 'state_full', tick, state })` — 把完整 GameState 送給新玩家。
  8. `broadcastExcept(playerId, { type: 'player_list', players: [...] })` — 通知其他人有新玩家。
  9. `EventBus.emit('network:connected', { playerId })`。

- `type === 'input'`：更新 `lastSeen`；emit `network:input` 帶 `{ playerId: msg.playerId, input: msg.input }`。
- `type === 'heartbeat'`：只更新 `lastSeen`。
- `type === 'leave'`：呼叫 `removeConnection(conn.peer, conn, false)`（主動關閉）。

**`conn.on('close')`：**

呼叫 `removeConnection(conn.peer, conn, true)`（`alreadyClosed=true` 表示不需再呼叫 `conn.close()`）。

注意：原始碼中 `conn.on('close')` 的 `return` 語句後有無法執行的舊程式碼段落（dead code），重建時忽略即可，邏輯已全部移到 `removeConnection`。

```typescript
conn.on('data', (raw) => {
  const msg = raw as NetMessage | any
  if (msg.type === 'join') {
    const incomingStableId: string  = (msg as any).stableId  ?? ''
    const incomingSessionId: string = (msg as any).sessionId ?? ''
    const incomingStableKey = incomingStableId && incomingSessionId
      ? `${incomingStableId}:${incomingSessionId}` : ''

    // 重連去重：踢掉相同 stableKey 的舊連線
    if (incomingStableKey) {
      for (const [oldId, oldConn] of this.connections) {
        if (this.stableIds.get(oldId) === incomingStableKey) {
          oldConn.close()
          this.connections.delete(oldId)
          this.stableIds.delete(oldId)
          GameStateManager_.removePlayer(oldId)
          EventBus.emit('network:disconnected', { playerId: oldId })
          break
        }
      }
    }

    // 決定出生位置
    const worldSeed = GameStateManager_.getWorld()?.seed
    const mapPositions: Record<string, { x: number; y: number }> = (msg as any).mapPositions ?? {}
    const savedPos = worldSeed !== undefined ? mapPositions[String(worldSeed)] : null
    const spawnX = savedPos?.x ?? WORLD_CONFIG.CENTER_X
    const spawnY = savedPos?.y ?? WORLD_CONFIG.CENTER_Y

    // 登記玩家
    const playerId = conn.peer
    this.connections.set(playerId, conn)
    this.lastSeen.set(playerId, Date.now())
    if (incomingStableKey) this.stableIds.set(playerId, incomingStableKey)
    GameStateManager_.setPlayer(playerId, { ...msg.playerData, id: playerId, x: spawnX, y: spawnY })
    assignPlayerSprites()

    this.sendTo(playerId, { type: 'state_full', tick: GameStateManager_.get().tick, state: GameStateManager_.get() })
    this.broadcastExcept(playerId, { type: 'player_list', players: Object.values(GameStateManager_.get().players) })
    EventBus.emit('network:connected', { playerId })

  } else if (msg.type === 'input') {
    this.lastSeen.set(conn.peer, Date.now())
    EventBus.emit('network:input', { playerId: msg.playerId, input: msg.input })
  } else if (msg.type === 'heartbeat') {
    this.lastSeen.set(conn.peer, Date.now())
  } else if (msg.type === 'leave') {
    this.removeConnection(conn.peer, conn, false)
  }
})

conn.on('close', () => { this.removeConnection(conn.peer, conn, true) })
```

### 移除連線（`removeConnection`）

```typescript
private removeConnection(playerId: PlayerId, conn?: DataConnection, alreadyClosed = false): void {
  if (!this.connections.has(playerId) && !GameStateManager_.getPlayer(playerId)) return  // 冪等守衛
  this.connections.delete(playerId)
  this.stableIds.delete(playerId)
  this.lastSeen.delete(playerId)
  if (!alreadyClosed) conn?.close()
  GameStateManager_.removePlayer(playerId)
  assignPlayerSprites()
  EventBus.emit('network:disconnected', { playerId })
  this.broadcast({ type: 'player_list', players: Object.values(GameStateManager_.get().players) })
}
```

冪等守衛確保同一玩家不會被重複清理（重連去重步驟可能已先清理過）。

### 心跳掃描（`sweepStaleConnections`）

每 **3000ms** 觸發，遍歷 `connections`：若 `Date.now() - lastSeen > 8000ms`，視為超時，呼叫 `removeConnection(..., alreadyClosed=false)`（強制關閉連線）。

時間常數：心跳間隔 3s（sweep）；超時門檻 **8 秒**。

```typescript
private sweepStaleConnections(): void {
  const now = Date.now()
  for (const [playerId, conn] of this.connections) {
    const lastSeen = this.lastSeen.get(playerId) ?? now
    if (now - lastSeen > 8000) {
      this.removeConnection(playerId, conn, false)
    }
  }
}
```

`init()` 啟動時機：`this.heartbeatSweep = setInterval(() => this.sweepStaleConnections(), 3000)`，冪等（已有 sweep 時不重複建立）。

## EventBus 互動

- emit `network:connected` — payload `{ playerId: string }`，新玩家 join 成功後（已存入 GameState 後）
- emit `network:disconnected` — payload `{ playerId: string }`，玩家離線、被踢、或心跳超時後
- emit `network:input` — payload `{ playerId: string, input: PlayerInput }`，收到 client 的 input 訊息時

（無 EventBus `on` 監聽）

## 訊息協定

| 訊息 type | 方向 | 欄位 | 何時送 |
|---|---|---|---|
| `join` | Client→Host | `playerData`, `stableId`, `sessionId`, `mapPositions` | 連線 open 後 |
| `input` | Client→Host | `playerId`, `input` | 玩家每幀輸入 |
| `heartbeat` | Client→Host | 無 | 每 2 秒 |
| `leave` | Client→Host | 無 | 主動離開 |
| `state_full` | Host→Client | `tick`, `state` | join 後回傳給新玩家 |
| `player_list` | Host→Client | `players[]` | 有人加入或離開時廣播 |

## 依賴

- `peerjs` — `Peer`（type import）、`DataConnection`（type import）
- `@/types` — `NetMessage`, `PlayerId`（type imports）
- `@/core/EventBus` — emit `network:connected` / `network:disconnected` / `network:input`
- `@/core/GameState` — `GameStateManager_`，用 `.get()` / `.setPlayer()` / `.removePlayer()` / `.getWorld()` / `.getPlayer()`
- `@/world/WorldGen` — `WORLD_CONFIG`（`CENTER_X`, `CENTER_Y`），用於預設出生點座標

## 重建提示

- 實作順序：先寫 `init()` 和 `handleConnection()` 的骨架，再補 join 邏輯，最後加 `removeConnection` 和 `sweepStaleConnections`。
- 重連去重的複合鍵格式為 `${stableId}:${sessionId}`，只有當兩者都非空時才做比對；任一為空字串時跳過去重邏輯。
- `removeConnection` 的冪等守衛（同時檢查 `connections.has` 和 `GameState.getPlayer`）是防止 race condition 的關鍵，不可省略。
- `conn.on('close')` 的 dead code 段落（`return` 後的舊程式碼）是歷史痕跡，實際清理邏輯已在 `removeConnection`。
- `broadcastExcept` 在 join 時只通知已在線的其他玩家（不發給新加入者，因為新玩家收的是 state_full，裡面已包含所有玩家資訊）。
- `assignPlayerSprites` 是模組頂層函數（非 class method），用 `PLAYER_SPRITE_IDS` 陣列輪派，必須在每次玩家增減後都呼叫。
- 與 `NetworkClient.ts` 耦合：join 訊息的欄位（stableId / sessionId / mapPositions）兩端必須一致。
