# 架構、啟動流程、通訊機制

## 啟動流程（遊戲生命週期）

```
遊戲啟動
  ↓
LobbyScreen.show()
  ↓ 使用者選擇
  ├── [開新房間]
  │     RoomManager.createRoom()
  │     → 顯示房號給玩家複製分享
  │     → NetworkHost 開始監聽其他 Client 連線
  │     → SaveManager.loadWorld() 或 WorldGen.generate(seed)
  │     → TileMap.render() 和 Spawner.spawnAll()
  │     → GameLoop.start()
  │
  └── [加入房間]
        輸入房號
        RoomManager.joinRoom(code)
        → NetworkClient 連線到 Host
        → Host 傳送 state_full（完整世界+玩家狀態）
        → GameStateManager.set() 同步狀態
        → TileMap.render() + Player sprites 初始化
        → GameLoop.start()
```

## 網路架構（Host 和 Client 角色）

```
Host (AA)                      Client (BB)
─────────────────────────────────────────
RoomManager.createRoom()       RoomManager.joinRoom(code)
  ↓                              ↓
Peer(forager-room-XXXXX)       Peer(client-XXXXXXXX)
  ↓                              ↓
NetworkHost.init(peer)         NetworkClient.connect(peer, hostId)

連線建立後：
BB 加入 → 發送 join message
  → AA 收到 → GameState.setPlayer(BB) → sendTo(BB, state_full)
  → BB 收到 state_full → GameState.set() → 初始化世界和所有玩家

AA 開始遊戲 → startGame('host')
  → 生成世界 → broadcast(state_full) → BB 更新世界

移動同步（每幀）：
AA 按鍵 → applyInput(AA) + broadcast(state_delta{ AA position })
BB 按鍵 → ClientPrediction.predict(input) + NetworkClient.send(input)
  → AA 收到 → applyInput(BB) + broadcast(state_delta{ BB position })
  → BB 收到 state_delta → syncFromServer()（與伺服器狀態協調）

資源採集同步：
BB 點擊樹 → NetworkClient.send(harvest input)
  → AA 驗證距離 → ResourceNode.hit() → 廣播資源 HP delta
  → Inventory.add(BB) → 只回傳給 BB（不廣播）
```

## 模組初始化順序（main.ts）

1. **App** - PixiJS Application 建立
2. **GameState** - 遊戲狀態管理器
3. **EventBus** - 事件系統（其他模組依賴）
4. **Network** (RoomManager) - 連線管理
5. **World** (WorldGen, TileMap) - 地圖生成和渲染
6. **Player** - 玩家物件
7. **Resources** (Spawner) - 資源節點
8. **Inventory** - 背包系統
9. **Crafting** - 製作系統
10. **Building** - 建築系統
11. **UI** (LobbyScreen, HUD 等) - 使用者介面
12. **SaveManager** - 存檔管理
13. **GameLoop** - 主遊戲迴圈

> 順序很重要！被依賴的模組要先初始化。

## 事件流通圖（簡化版）

```
用戶操作
  ↓
輸入處理（main.ts 監聽鍵盤）
  ↓
Player.applyInput() / ClientPrediction.predict()
  ↓
EventBus.emit('player:moved') 或 network:input
  ↓
NetworkHost.broadcast() / NetworkClient.send()
  ↓
其他玩家接收 state_delta
  ↓
GameState 同步
  ↓
Sprite 更新位置
```

## Window 自訂事件（跨模組補充通訊）

除了 EventBus，main.ts 額外使用 window 自訂事件協調 UI 和核心邏輯：

| 事件名 | 觸發來源 | 處理者 | Payload |
|--------|---------|--------|---------|
| `game:start` | LobbyScreen | main.ts | `{ mode: 'host' \| 'client' }` |
| `client:state_full` | NetworkClient | main.ts | `{ worldData, players }` |
| `client:state_delta` | NetworkClient | main.ts | `{ playerId, x, y, ... }` |

這三個事件是 main.ts 內部協調，不要直接在模組中使用。

## 跨模組通訊禁止列表

❌ **禁止做**
```typescript
import { BuildingSystem } from '@/building'
BuildingSystem.place(playerId, buildingId, x, y)  // 直接呼叫！
```

✅ **要做**
```typescript
import { EventBus } from '@/core/EventBus'
EventBus.emit('build:placed', { playerId, buildingId, x, y })
```

> 例外：允許 import `@/core/EventBus` 和 `@/core/GameState`
