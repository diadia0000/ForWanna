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
