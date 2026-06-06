---
name: resources-spawner
description: 資源節點的生命週期管理器，處理批量生成、耗盡後 respawn 排程、Client 端 delta 同步，重建時參考它來還原 Host/Client 非對稱架構下資源的完整流轉。
---

# resources/Spawner.ts

> 模組：resources｜角色：Spawner 類別，管理場景中所有 ResourceNodeEntity 的生成、查詢、耗盡處理與 respawn 排程，並透過 callback 介面與網路層解耦

## 公開 API

- `class Spawner`
  - `constructor(container: PIXI.Container): Spawner` — 傳入 PixiJS Container，訂閱 `resource:depleted` 事件
  - `setClickHandler(fn: (nodeId: string) => void): void` — 設定指標點擊 callback（Host 直接呼叫 hit，Client 送網路），對已存在節點補上監聽
  - `setRespawnCallback(fn: (data: ResourceNode) => void): void` — Host 端設定：新節點 respawn 後廣播給 Client 的 callback
  - `setDepletedVisualCallback(fn: (data: ResourceNode) => void): void` — 節點耗盡時在 destroy 前觸發，用於爆炸特效
  - `spawnAll(worldData: WorldData): ResourceNodeEntity[]` — 清空現有節點後，批次生成 worldData.resources 內所有節點，回傳實體陣列
  - `spawnOne(data: ResourceNode): ResourceNodeEntity` — 生成單一節點：new ResourceNodeEntity → 設 zIndex = data.y → addChild → 掛 clickHandler
  - `applyResourceDelta(resources?: Partial<Record<NodeId, Partial<ResourceNode>>>, removedResources?: NodeId[]): void` — Client 端收到 state_delta 時呼叫，更新現有節點 HP 或生成 respawn 節點，移除耗盡節點
  - `getNode(nodeId: string): ResourceNodeEntity | undefined` — 依 id 查詢節點實體
  - `getAllNodes(): ResourceNodeEntity[]` — 回傳所有未銷毀的節點實體（過濾 isDestroyed）

## 核心邏輯

### 模組常數

```typescript
const TILE_SIZE    = 48   // 格子像素大小
const CHUNK_SIZE   = 16   // 每塊 chunk 的格數
const CENTER_TILE  = 104  // 地圖中心格座標
const ISLAND_STRIDE = 22  // 島嶼間距（格數）
```

### 座標工具函式（模組私有）

```typescript
function tileAtWorld(world: WorldData, x: number, y: number): string {
  const tx = Math.floor(x / TILE_SIZE)
  const ty = Math.floor(y / TILE_SIZE)
  const cx = Math.floor(tx / CHUNK_SIZE)
  const cy = Math.floor(ty / CHUNK_SIZE)
  const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const chunk = world.chunks.find(c => c.cx === cx && c.cy === cy)
  return chunk?.tiles?.[ly]?.[lx] ?? 'water'
}

function ringAtWorld(x: number, y: number): number {
  const tx = Math.floor(x / TILE_SIZE)
  const ty = Math.floor(y / TILE_SIZE)
  const ix = Math.round((tx - CENTER_TILE) / ISLAND_STRIDE)
  const iy = Math.round((ty - CENTER_TILE) / ISLAND_STRIDE)
  return Math.max(Math.abs(ix), Math.abs(iy))   // Chebyshev distance
}
```

### `buildRespawnNode` — 新位置搜尋演算法

最多 36 次嘗試，在原節點附近找合法格子，然後根據新位置的環形與地塊重選資源類型：

```typescript
function buildRespawnNode(original: ResourceNode): ResourceNode {
  const world = GameStateManager_.getWorld()
  let spot: { x: number; y: number; tileType: string } | null = null

  for (let attempt = 0; attempt < 36; attempt++) {
    const radius = TILE_SIZE * (1.5 + Math.random() * 4.5)  // 72px ~ 288px
    const angle  = Math.random() * Math.PI * 2
    // 貼齊格子中心
    const x = Math.floor((original.x + Math.cos(angle) * radius) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
    const y = Math.floor((original.y + Math.sin(angle) * radius) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
    const tileType = tileAtWorld(world, x, y)
    if (tileType === 'water') continue
    if (isPositionBlockedByBuilding(x, y)) continue
    const tooClose = (world.resources ?? []).some(r =>
      r.id !== original.id && Math.hypot(r.x - x, r.y - y) < TILE_SIZE * 1.7
    )
    if (tooClose) continue
    spot = { x, y, tileType }
    break
  }

  const x        = spot?.x ?? original.x
  const y        = spot?.y ?? original.y
  const tileType = spot?.tileType ?? tileAtWorld(world, original.x, original.y)
  const type     = pickResourceForSpawn(ringAtWorld(x, y), tileType as any) ?? 'rock'
  const cfg      = RESOURCE_CONFIG[type] ?? RESOURCE_CONFIG.rock
  return {
    id: `res_respawn_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: type as ResourceNode['type'],
    x, y,
    hp: cfg.hp, maxHp: cfg.hp,
    respawnTime: original.respawnTime,
  }
}
```

### `handleDepleted` — Host 端耗盡流程

```typescript
private handleDepleted(nodeId: string): void {
  const entity = this.nodes.get(nodeId)
  if (!entity) return
  const data = entity.getData()
  this.depletedVisualCallback?.(data)           // 爆炸特效（destroy 前）
  this.container.removeChild(entity.sprite)
  entity.destroy()
  this.nodes.delete(nodeId)

  const timer = setTimeout(() => {
    if (isPositionBlockedByBuilding(data.x, data.y)) {
      // 被建築佔用 → 30s 後重試
      const retryTimer = setTimeout(() => {
        const respawnData = buildRespawnNode(data)
        const newEntity = this.spawnOne(respawnData)
        newEntity.playRespawnAnim()
        this.respawnCallback?.(newEntity.getData())
        this.respawnTimers.delete(nodeId)
      }, 30_000)
      this.respawnTimers.set(nodeId, retryTimer)
      return
    }
    const respawnData = buildRespawnNode(data)
    const newEntity = this.spawnOne(respawnData)
    newEntity.playRespawnAnim()
    this.respawnCallback?.(newEntity.getData())
    this.respawnTimers.delete(nodeId)
  }, data.respawnTime * 1000)                   // respawnTime 單位秒 → ms
  this.respawnTimers.set(nodeId, timer)
}
```

### `applyResourceDelta` — Client 端 delta 同步

```typescript
applyResourceDelta(
  resources?: Partial<Record<NodeId, Partial<ResourceNode>>>,
  removedResources?: NodeId[]
): void {
  if (resources) {
    for (const [id, data] of Object.entries(resources)) {
      if (!data) continue
      const existing = this.nodes.get(id)
      if (existing) {
        existing.applyDelta(data)                 // 更新 HP
      } else if (data.id && data.type && data.x !== undefined && data.y !== undefined) {
        const newEntity = this.spawnOne(data as ResourceNode)  // respawn 新節點
        newEntity.playRespawnAnim()
      }
    }
  }
  if (removedResources) {
    for (const nodeId of removedResources) {
      const entity = this.nodes.get(nodeId)
      if (!entity) continue
      this.container.removeChild(entity.sprite)
      entity.destroy()
      this.nodes.delete(nodeId)                   // Client 不排計時器
    }
  }
}
```

### AABB 建築碰撞檢測

```typescript
function isPositionBlockedByBuilding(x: number, y: number): boolean {
  return (GameStateManager_.getWorld().buildings ?? []).some(b => {
    const bDef = BUILDING_DEFS[b.defId]
    if (!bDef) return false
    const bcX  = b.x + bDef.size.x * TILE_SIZE / 2
    const bcY  = b.y + bDef.size.y * TILE_SIZE / 2
    const halfW = bDef.size.x * TILE_SIZE / 2
    const halfH = bDef.size.y * TILE_SIZE / 2
    return Math.abs(x - bcX) < halfW + TILE_SIZE * 0.5
        && Math.abs(y - bcY) < halfH + TILE_SIZE * 0.5
  })
}
```

## EventBus 互動

- on `resource:depleted` — payload: `{ nodeId: string }`；收到後呼叫 `handleDepleted(nodeId)`，負責 Host 端完整的耗盡→重生流程

## 依賴

- `pixi.js` — Container（場景容器型別）
- `@/types` — `WorldData`、`ResourceNode`、`NodeId`
- `./ResourceNode` — `ResourceNodeEntity`（實體類別）
- `@/core/EventBus` — 訂閱 `resource:depleted`
- `@/core/GameState` — `GameStateManager_`，讀取 world 資料（建築列表、資源列表、chunks）
- `@/building/data/buildings` — `BUILDING_DEFS`，取得建築尺寸用於碰撞檢測
- `./resourceConfig` — `RESOURCE_CONFIG`，respawn 時取新類型的 hp/maxHp
- `./spawnConfig` — `pickResourceForSpawn`，respawn 時決定新資源類型

## 重建提示

- Spawner 是模組邊界違規的高風險點：它 import `BUILDING_DEFS`（來自 `@/building`），這是設計上的例外（用於避讓建築），需特別注意。
- `spawnAll` 必須先清空再重建，否則 worldData 更新後會有殭屍節點殘留在場景。
- `setClickHandler` 要對已存在節點補 `removeAllListeners('pointerdown')` 再重新綁定，避免多次呼叫疊加監聽。
- respawnTimers 以原 nodeId 為鍵存儲，即使新節點 id 不同也能找到並 delete 計時器。
- Client 端呼叫 `applyResourceDelta` 時，區分「現有節點更新」與「全量資料新增節點」的關鍵是：資料物件是否同時包含 `id`、`type`、`x`、`y` 四個欄位。
- `getAllNodes()` 有 `!n.isDestroyed` 過濾，避免已 destroy 但還在 map 中的邊界情況。
- respawn 後的新節點 id 格式為 `res_respawn_${Date.now()}_${random36}`，與初始世界的節點 id 不同，接收方需能處理未知 id。
