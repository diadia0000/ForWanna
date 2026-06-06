---
name: types-index
description: 全模組共用的 TypeScript 型別契約（Vec2 / PlayerData / InventoryItem / ResourceNode / Building / GameState / PlayerInput / NetMessage / StateDelta / GameEvents 等）。重建專案時這是最優先、最基礎的一塊——少了它所有模組都無法編譯；任何模組要 import 共用型別、定義 EventBus 事件、或對齊網路訊息格式，務必先參考並完整重建這份。
---

# types/index.ts

> 模組：root / types｜角色：整個專案的「型別契約」單一真實來源（single source of truth）。所有 Agent / 模組都從 `@/types`（`src/types`）import，禁止各自重新定義。少了它，幾乎每個檔案都會編譯失敗。

## 重建優先級：最高
- 這份是其他所有模組的相依根。重建順序上應該**第一個**還原，且必須**逐字完整**，不能省略任何 interface / type。
- 檔頭有明確聲明：「共用型別定義 — 禁止修改，所有 Agent 從這裡 import」。重建時保持此契約穩定，不要為了某模組方便而偷改欄位名或型別。

## 完整內容（逐字重建）

```typescript
// ============================================================
// 共用型別定義 — 禁止修改，所有 Agent 從這裡 import
// ============================================================

// ── 基礎 ────────────────────────────────────────────────────

export interface Vec2 {
  x: number
  y: number
}

export type PlayerId = string
export type ItemId = string
export type RecipeId = string
export type BuildingId = string
export type NodeId = string

// ── 玩家 ────────────────────────────────────────────────────

export interface PlayerData {
  id: PlayerId
  name: string
  x: number
  y: number
  hp: number
  maxHp: number
  xp: number
  level: number
  researchLevel: number
  gold: number
  inventory: InventoryItem[]
  unlockedSkills: string[]
  color: number // PixiJS 色碼，用於區分玩家
}

// ── 背包 ────────────────────────────────────────────────────

export interface InventoryItem {
  itemId: ItemId
  amount: number
}

export interface ItemDef {
  id: ItemId
  name: string
  icon: string       // 圖示路徑或 emoji
  maxStack: number
  sellPrice: number
}

// ── 製作 ────────────────────────────────────────────────────

export interface RecipeDef {
  id: RecipeId
  name: string
  requires: InventoryItem[]
  produces: InventoryItem[]
  unlockLevel: number
}

// ── 資源節點 ─────────────────────────────────────────────────

export type ResourceType = 'tree' | 'rock' | 'iron' | 'gold' | 'crystal'

export interface ResourceNode {
  id: NodeId
  type: ResourceType
  x: number
  y: number
  hp: number
  maxHp: number
  respawnTime: number // 秒
}

// ── 建築 ─────────────────────────────────────────────────────

export interface Building {
  id: string
  defId: BuildingId
  x: number
  y: number
  ownerId: PlayerId
  placedAt: number // timestamp
  level: number   // 建築等級（1-10）
  hp: number      // 建築耐久度（用於維修）
  maxHp: number   // 最大耐久度
}

export interface BuildingDef {
  id: BuildingId
  name: string
  cost: InventoryItem[]
  size: Vec2          // 佔幾格
  effect: string      // 描述效果
}

// ── 地圖 ─────────────────────────────────────────────────────

export type TileType = 'grass' | 'water' | 'sand' | 'stone' | 'snow'

export interface Chunk {
  cx: number
  cy: number
  tiles: TileType[][]   // 16x16
  seed: number
}

export interface WorldData {
  seed: number
  chunks: Chunk[]
  resources: ResourceNode[]
  buildings: Building[]
  createdAt: number
}

// ── 遊戲狀態 ─────────────────────────────────────────────────

export interface GameState {
  tick: number
  players: Record<PlayerId, PlayerData>
  world: WorldData
  hostId: PlayerId
}

// ── 網路訊息 ─────────────────────────────────────────────────

export type PlayerInput = {
  type: 'move'
  dx: number   // -1 | 0 | 1
  dy: number
} | {
  type: 'harvest'
  targetId: NodeId
} | {
  type: 'craft'
  recipeId: RecipeId
} | {
  type: 'build'
  buildingDefId: BuildingId
  x: number
  y: number
}

export type NetMessage =
  // Client → Host
  | { type: 'input';       playerId: PlayerId; input: PlayerInput; tick: number }
  | { type: 'join';        playerData: PlayerData }
  | { type: 'save_request' }

  // Host → Client(s)
  | { type: 'state_full';  tick: number; state: GameState }
  | { type: 'state_delta'; tick: number; delta: StateDelta }
  | { type: 'join_ack';    playerId: PlayerId; roomCode: string }
  | { type: 'player_list'; players: PlayerData[] }
  | { type: 'kicked';      reason: string }

export interface StateDelta {
  players?: Partial<Record<PlayerId, Partial<PlayerData>>>
  resources?: Partial<Record<NodeId, Partial<ResourceNode>>>
  buildings?: Building[]         // 新增的
  removedResources?: NodeId[]
}

// ── EventBus 事件 ─────────────────────────────────────────────

export interface GameEvents {
  'player:moved':       { playerId: PlayerId; x: number; y: number }
  'player:levelup':     { playerId: PlayerId; level: number }
  'player:died':        { playerId: PlayerId }
  'resource:collected': { playerId: PlayerId; type: ResourceType; amount: number }
  'resource:depleted':  { nodeId: NodeId }
  'inventory:changed':  { playerId: PlayerId; inventory: InventoryItem[] }
  'craft:success':      { playerId: PlayerId; recipeId: RecipeId; result: InventoryItem[] }
  'build:placed':       { playerId: PlayerId; buildingId: string; x: number; y: number }
  'building:upgraded':  { playerId: PlayerId; buildingId: string; newLevel: number }
  'network:input':      { playerId: PlayerId; input: PlayerInput }
  'network:connected':  { playerId: PlayerId }
  'network:disconnected': { playerId: PlayerId }
  'save:request':       Record<string, never>
  'save:complete':      Record<string, never>
  'ui:open_inventory':  Record<string, never>
  'ui:close_inventory': Record<string, never>
  'ui:open_crafting':   Record<string, never>
  'ui:close_crafting':  Record<string, never>
  'treasure:opened':    { chestId: NodeId; loot: Array<{ itemId: ItemId; amount: number }> }
  'i18n:changed':       { lang: string }
}
```

## 分區導覽（重建時的心智地圖）
- **基礎**：`Vec2`（座標/尺寸通用），以及五個 string 別名 `PlayerId / ItemId / RecipeId / BuildingId / NodeId`——刻意用別名而非裸 `string`，讓函式簽章自我說明。
- **玩家**：`PlayerData` 是核心實體，含座標、HP、XP/等級、研究等級、金幣、背包、已解鎖技能、`color`（PixiJS 色碼，用來區分多人）。
- **背包/物品**：`InventoryItem`（itemId + amount）、`ItemDef`（含 `icon` 可為路徑或 emoji、`maxStack`、`sellPrice`）。
- **製作**：`RecipeDef`（requires → produces，含 `unlockLevel`）。
- **資源**：`ResourceType` 是五種字面值聯集 `'tree' | 'rock' | 'iron' | 'gold' | 'crystal'`；`ResourceNode` 含 `respawnTime`（秒）。
- **建築**：`Building`（實體：含 `level` 1-10、`hp/maxHp` 維修用、`placedAt` timestamp）與 `BuildingDef`（定義：`cost`、`size: Vec2` 佔格、`effect` 描述）。
- **地圖**：`TileType` 五種地形字面值；`Chunk` 為 16×16 的 `tiles: TileType[][]`；`WorldData` 聚合 chunks/resources/buildings。
- **遊戲狀態**：`GameState`（tick、players record、world、hostId）是存檔與同步的根物件。
- **網路**：`PlayerInput` 是**判別聯集（discriminated union）**，以 `type` 分四種（move/harvest/craft/build）；`NetMessage` 同樣以 `type` 分判，並用註解明確分成 Client→Host 與 Host→Client 兩向；`StateDelta` 是增量同步用的 `Partial` 巢狀結構。
- **EventBus 事件**：`GameEvents` 是事件名 → payload 型別的對照表，給 `EventBus`（見 core/EventBus skill）做型別安全的發布/訂閱。

## 重建提示
- **第一個重建、且要完整**：任何 import 失敗的編譯錯誤，先回頭確認這份是否漏了某個 export。
- **判別聯集要保留 `type` 欄位**：`PlayerInput` 與 `NetMessage` 都靠 `type` 做 narrowing；少了 `type` 或拼錯，下游 `switch (msg.type)` 會整批失效。`NetMessage` 的方向註解（Client→Host / Host→Client）幫助對齊 network 模組（見 network 各 skill）。
- **`GameEvents` 必須與實際 emit/on 的事件名一字不差**：事件名是字串字面值（如 `'player:levelup'`），EventBus 用它做泛型索引；新增事件要同步補在這裡，否則 emit 端會型別報錯。`Record<string, never>` 代表「無 payload」事件（如 `save:request`、各 `ui:*`）。
- **別名 vs 裸 string**：`PlayerId` 等雖然底層都是 string，但簽章上請沿用別名，維持可讀性與未來可替換性。
- **數值/單位語意靠註解保存**：`color` 是 PixiJS 色碼、`respawnTime` 單位是秒、`tiles` 是 16×16、`level` 是 1-10——這些靠註解傳達，重建時連同註解一起還原。
- **契約穩定原則**：標頭寫明「禁止修改」。多個模組/Agent 平行重建時，這份要先定稿並當成不可變介面，避免各模組對欄位名/型別產生分歧而 link 不起來。
