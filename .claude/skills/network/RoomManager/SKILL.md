---
name: network-room-manager
description: PeerJS 房間的建立與加入入口，重建時參考它設定 Peer 物件、連接信令伺服器、產生6字元房號、處理信令斷線自動重連與 window CustomEvent 通知——這是整個網路層的啟動點。
---

# network/RoomManager.ts

> 模組：network｜角色：房間生命週期管理，Host 透過它建立 PeerJS 節點並取得房號，Client 透過它加入房間；管理信令伺服器連線狀態（斷線重連）及角色追蹤

## 公開 API

- `RoomManager.createRoom(): Promise<string>` — 建立新房間，回傳 6 字元房號（Host 用）
- `RoomManager.joinRoom(code: string, playerName: string): Promise<void>` — 加入指定房號的房間（Client 用）
- `RoomManager.leaveRoom(): void` — 離開/銷毀房間，清理 Peer 物件與狀態
- `RoomManager.roomCode: string` — 目前房號（唯讀 getter）
- `RoomManager.role: RoomRole` — 目前身分 `'host' | 'client' | null`（唯讀 getter）
- `RoomManager.myId: PlayerId` — 目前 PeerJS 分配的節點 ID（唯讀 getter）
- `RoomRole` (type export) — `'host' | 'client' | null`

`RoomManager` 是 singleton。

## 核心邏輯

### Peer Server 設定

從 Vite 環境變數讀取，提供預設值：

| 環境變數 | 預設值 | 說明 |
|---|---|---|
| `VITE_PEER_HOST` | `'localhost'` | 信令伺服器主機 |
| `VITE_PEER_PORT` | `9000` | 信令伺服器埠號（`Number()` 轉型） |
| `VITE_PEER_SECURE` | `false` | 是否用 wss（字串比對 `=== 'true'`） |

所有 Peer 實例都使用 path `/myapp`、key `'peerjs'`、pingInterval `3000`，以及兩個 STUN 伺服器：`stun:stun.l.google.com:19302` 和 `stun:stun1.l.google.com:19302`，debug level `2`。

### Peer Server 共用設定

所有 Peer 實例的共用選項：

```typescript
{
  host: PEER_HOST,   // 預設 'localhost'
  port: PEER_PORT,   // 預設 9000
  path: '/myapp',
  key: 'peerjs',
  secure: PEER_SECURE,
  pingInterval: 3000,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  },
  debug: 2,
}
```

### `createRoom()` 流程

1. `generateCode()` 產生 6 字元房號，設為 `_roomCode`。
2. 設 `_role = 'host'`。
3. 以 `toPeerId(_roomCode)` 作為 Peer ID（格式：`forager-room-XXXXXX`）建立 `new Peer(...)`。
4. 等待 `peer.on('open')` resolve（10 秒 timeout，逾時 reject）；open 後將 `id` 存入 `_myId`。
5. 呼叫 `setupReconnect()`。
6. 呼叫 `NetworkHost.init(peer)`。
7. 回傳 `_roomCode`。

```typescript
async createRoom(): Promise<string> {
  this._roomCode = this.generateCode()
  this._role = 'host'
  this.peer = new Peer(this.toPeerId(this._roomCode), { /* 共用選項 */ })

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('連線逾時（10秒）')), 10_000)
    this.peer!.on('open', (id) => { clearTimeout(timeout); this._myId = id; resolve() })
    this.peer!.on('error', (err) => { clearTimeout(timeout); reject(err) })
  })

  this.setupReconnect()
  NetworkHost.init(this.peer)
  return this._roomCode
}
```

### `joinRoom(code, playerName)` 流程

1. 設 `_roomCode = code.toUpperCase()`，`_role = 'client'`。
2. 產生隨機 Client Peer ID：`'client-' + Math.random().toString(36).substring(2, 10)`（8 字元隨機字串）。
3. 建立 `new Peer(clientId, ...)` 並等待 `open`（10 秒 timeout）；open 後存 `id` 到 `_myId`。
4. 呼叫 `setupReconnect()`。
5. 呼叫 `NetworkClient.connect(peer, toPeerId(_roomCode), playerName)`（這裡才真正建立 DataConnection 到 Host）。

```typescript
async joinRoom(code: string, playerName: string): Promise<void> {
  this._roomCode = code.toUpperCase()
  this._role = 'client'
  const clientId = 'client-' + Math.random().toString(36).substring(2, 10)
  this.peer = new Peer(clientId, { /* 共用選項 */ })

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('連線逾時（10秒）')), 10_000)
    this.peer!.on('open', (id) => { clearTimeout(timeout); this._myId = id; resolve() })
    this.peer!.on('error', (err) => { clearTimeout(timeout); reject(err) })
  })

  this.setupReconnect()
  await NetworkClient.connect(this.peer, this.toPeerId(this._roomCode), playerName)
}
```

### `leaveRoom()` 流程

1. 若 `_role === 'client'` → 呼叫 `NetworkClient.disconnect()`。
2. `peer?.destroy()`（Host 或 Client 都銷毀 Peer）。
3. 清零：`peer = null`、`_role = null`、`_roomCode = ''`。

### 信令伺服器斷線重連（`setupReconnect`）

綁定在 `peer` 物件上，在 `createRoom` 和 `joinRoom` 的 Peer open 後呼叫：

- `peer.on('disconnected')` → 發出 `window` CustomEvent `peer:signaling-lost`；3 秒後若 peer 未銷毀則呼叫 `peer.reconnect()`。
- `peer.on('open')` → 發出 `window` CustomEvent `peer:signaling-restored`（讓 UI 移除覆蓋層）。
- 注意：`everOpened` 旗標初始為 `true`（因為 Peer 在 `createRoom`/`joinRoom` 等待 open 的 Promise 解析後才呼叫 `setupReconnect`，此時已 open 過一次）；後續每次 reconnect 觸發的 `open` 都會 dispatch `peer:signaling-restored`。

```typescript
private setupReconnect(): void {
  if (!this.peer) return
  let everOpened = true   // setup 只在 open 後呼叫，已 open 過一次

  this.peer.on('disconnected', () => {
    window.dispatchEvent(new CustomEvent('peer:signaling-lost'))
    setTimeout(() => {
      if (this.peer && !this.peer.destroyed) this.peer.reconnect()
    }, 3000)
  })

  this.peer.on('open', () => {
    if (everOpened) {
      window.dispatchEvent(new CustomEvent('peer:signaling-restored'))
    }
    everOpened = true
  })
}
```

### 房號產生（`generateCode`）

字元集：`'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`（去掉 `I`、`O`、`1`、`0` 避免混淆），長度 **6**。

```typescript
private generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

private toPeerId(code: string): string {
  return `forager-room-${code}`   // e.g. AB3XYZ → forager-room-AB3XYZ
}
```

### 內部狀態

| 屬性 | 型別 | 初始值 |
|---|---|---|
| `peer` | `Peer \| null` | `null` |
| `_roomCode` | `string` | `''` |
| `_role` | `RoomRole` | `null` |
| `_myId` | `PlayerId` | `''` |

## EventBus 互動

無（此類別不使用 EventBus；跨模組通知透過 window CustomEvent）

## window CustomEvent（非 EventBus）

| 事件名稱 | 方向 | 觸發時機 |
|---|---|---|
| `peer:signaling-lost` | dispatch → UI 層消費 | 信令伺服器斷線時 |
| `peer:signaling-restored` | dispatch → UI 層消費 | 信令伺服器重連成功時 |

## 訊息協定（若適用）

無，RoomManager 本身不處理 DataConnection 訊息；訊息處理委派給 NetworkHost / NetworkClient。

## 依賴

- `peerjs` — `Peer`（實際 import，非 type），建立 PeerJS 節點
- `@/types` — `PlayerId`（type import）
- `@/core/EventBus` — import 但此檔案實際未使用（歷史 import，可能為日後預留）
- `@/core/i18n` — `t()` 函數，用於 timeout 錯誤訊息的本地化（key：`network.timeout_host`、`network.timeout_client`）
- `./NetworkHost` — `NetworkHost.init(peer)`，在 createRoom 後初始化
- `./NetworkClient` — `NetworkClient.connect(...)`、`NetworkClient.disconnect()`，在 joinRoom/leaveRoom 時呼叫

## 重建提示

- 實作順序：先寫 `generateCode` 和 `toPeerId` 這兩個純函數，再寫 `createRoom`，再寫 `joinRoom`，最後補 `setupReconnect` 和 `leaveRoom`。
- `createRoom` 和 `joinRoom` 的 Peer 初始化模式幾乎相同（都是 Promise wrapper + timeout）；可先抽一個私有 helper，但原始碼選擇重複，重建時兩種方式皆可。
- Host 的 PeerID 是固定的（由房號決定）；Client 的 PeerID 是隨機的（只要不衝突即可）。
- `VITE_PEER_SECURE === 'true'` 是字串比對，不是 boolean 轉型，要特別注意。
- `setupReconnect` 中 `everOpened = true` 從一開始就設定（非 `false`），是因為 setup 只在 open 後才被呼叫——這個實作細節容易看漏。
- 此類別與 `NetworkHost` 和 `NetworkClient` 強耦合，`peer` 物件的生命週期由這裡統一管理。
- `leaveRoom` 對 Host 不呼叫任何 NetworkHost 方法（只 destroy peer），Host 的連線清理依賴 PeerJS 的 connection close 事件傳遞給 NetworkHost。
