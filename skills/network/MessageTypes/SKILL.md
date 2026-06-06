---
name: network-message-types
description: 網路訊息型別的轉接層，重建時用來確認 network 模組內部引用型別的正確來源——所有 NetMessage / PlayerInput / StateDelta / PlayerId 都從這裡取，不要讓 network/*.ts 直接 import @/types。
---

# network/MessageTypes.ts

> 模組：network｜角色：型別橋接，把 `@/types` 的網路相關型別 re-export 到 network 模組內部，做到依賴單一窗口

## 公開 API

- `NetMessage` (type) — 所有網路訊息的 discriminated union，欄位由 `type` 字串決定具體結構
- `PlayerInput` (type) — 玩家輸入的 payload 型別（按鍵/移動向量等）
- `StateDelta` (type) — 狀態差量更新的 payload 型別
- `PlayerId` (type) — 玩家 ID 的型別別名（`string`）

所有項目均為 `export type`（僅型別，無執行期值）。

## 核心邏輯

純型別轉接，一行 `export type { ... } from '@/types'`。無執行期邏輯。

架構意圖：network 子模組（NetworkHost、NetworkClient、RoomManager）只需 `import type { ... } from './MessageTypes'`，不直接依賴 `@/types` 根路徑，方便之後替換型別來源時只改這一個檔案。

### NetMessage 判別聯合（來自 `@/types/index.ts`）

```typescript
// Client → Host
type NetMessage =
  | { type: 'input';       playerId: PlayerId; input: PlayerInput; tick: number }
  | { type: 'join';        playerData: PlayerData }
  | { type: 'save_request' }

  // Host → Client(s)
  | { type: 'state_full';  tick: number; state: GameState }
  | { type: 'state_delta'; tick: number; delta: StateDelta }
  | { type: 'join_ack';    playerId: PlayerId; roomCode: string }
  | { type: 'player_list'; players: PlayerData[] }
  | { type: 'kicked';      reason: string }
```

### PlayerInput 判別聯合

```typescript
type PlayerInput =
  | { type: 'move';    dx: number; dy: number }   // -1 | 0 | 1
  | { type: 'harvest'; targetId: NodeId }
  | { type: 'craft';   recipeId: RecipeId }
  | { type: 'build';   buildingDefId: BuildingId; x: number; y: number }
```

### StateDelta 介面

```typescript
interface StateDelta {
  players?:          Partial<Record<PlayerId, Partial<PlayerData>>>
  resources?:        Partial<Record<NodeId,   Partial<ResourceNode>>>
  buildings?:        Building[]     // 新增的建築
  removedResources?: NodeId[]
}
```

注意：`join` 訊息在 NetworkClient 實際送出時附帶了 `stableId`、`sessionId`、`mapPositions` 額外欄位（以 `as NetMessage` 強轉），這些欄位型別定義中沒有，Host 以 `(msg as any).stableId` 讀取。

## EventBus 互動

無

## 訊息協定（若適用）

無，此檔只定義型別，不實際發送/接收。

## 依賴

- `@/types` — 專案共用型別定義（由 event-architect 維護，禁止由 network agent 修改）

## 重建提示

- 先確認 `@/types/index.ts` 中確實有 export `NetMessage`、`PlayerInput`、`StateDelta`、`PlayerId` 這四個名稱，否則 tsc 會報錯。
- 若 `@/types` 新增了網路相關型別，在此補 re-export；但**不要直接改 `@/types/index.ts`**，需走 event-architect 流程。
- 此檔使用 `export type` 而非 `export`，確保 tree-shaking 友善，不引入執行期 bundle。
