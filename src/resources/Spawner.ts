// Agent 5 負責 — src/resources/Spawner.ts
import * as PIXI from 'pixi.js'
import type { WorldData, ResourceNode, NodeId } from '@/types'
import { ResourceNodeEntity } from './ResourceNode'
import { EventBus } from '@/core/EventBus'
import { GameStateManager_ } from '@/core/GameState'
import { BUILDING_DEFS } from '@/building/data/buildings'
import { RESOURCE_CONFIG } from './resourceConfig'
import { pickResourceForSpawn } from './spawnConfig'

const TILE_SIZE = 48
const CHUNK_SIZE = 16
const CENTER_TILE = 104
const ISLAND_STRIDE = 22

/** 檢查指定位置是否被建築佔用（資源重生時避開） */
function isPositionBlockedByBuilding(x: number, y: number): boolean {
  const world = GameStateManager_.getWorld()
  return (world.buildings ?? []).some(b => {
    const bDef = BUILDING_DEFS[b.defId]
    if (!bDef) return false
    const bcX = b.x + bDef.size.x * TILE_SIZE / 2
    const bcY = b.y + bDef.size.y * TILE_SIZE / 2
    const halfW = bDef.size.x * TILE_SIZE / 2
    const halfH = bDef.size.y * TILE_SIZE / 2
    const dx = Math.abs(x - bcX)
    const dy = Math.abs(y - bcY)
    return dx < halfW + TILE_SIZE * 0.5 && dy < halfH + TILE_SIZE * 0.5
  })
}

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
  return Math.max(Math.abs(ix), Math.abs(iy))
}

function buildRespawnNode(original: ResourceNode): ResourceNode {
  const world = GameStateManager_.getWorld()
  let spot: { x: number; y: number; tileType: string } | null = null

  for (let attempt = 0; attempt < 36; attempt++) {
    const radius = TILE_SIZE * (1.5 + Math.random() * 4.5)
    const angle = Math.random() * Math.PI * 2
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

  const x = spot?.x ?? original.x
  const y = spot?.y ?? original.y
  const tileType = spot?.tileType ?? tileAtWorld(world, original.x, original.y)
  const ring = ringAtWorld(x, y)
  const type = pickResourceForSpawn(ring, tileType as any) ?? 'rock'
  const cfg = RESOURCE_CONFIG[type] ?? RESOURCE_CONFIG.rock
  return {
    id: `res_respawn_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: type as ResourceNode['type'],
    x,
    y,
    hp: cfg.hp,
    maxHp: cfg.hp,
    respawnTime: original.respawnTime,
  }
}

export class Spawner {
  private nodes: Map<string, ResourceNodeEntity> = new Map()
  private container: PIXI.Container
  private respawnTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  /** 點擊 callback（Host/Client 各自設定不同邏輯） */
  private clickHandler: ((nodeId: string) => void) | null = null
  /** Host 端資源重生後的廣播 callback */
  private respawnCallback: ((data: ResourceNode) => void) | null = null
  /** 資源耗盡前呼叫（用於視覺特效） */
  private depletedVisualCallback: ((data: ResourceNode) => void) | null = null

  constructor(container: PIXI.Container) {
    this.container = container
    // Spawner 只在 Host 端排程重生；resource:depleted 由 EventBus 觸發
    EventBus.on('resource:depleted', ({ nodeId }) => this.handleDepleted(nodeId))
  }

  // ── 設定 callback ──────────────────────────────────────────

  /**
   * 設定點擊 callback。
   * Host：直接呼叫 hit() 並廣播；Client：送網路輸入。
   * 必須在 spawnAll 後呼叫（或在 spawnAll 前呼叫，之後 spawnOne 會自動套用）。
   */
  setClickHandler(fn: (nodeId: string) => void): void {
    this.clickHandler = fn
    // 對已存在的節點補上監聽
    for (const [id, entity] of this.nodes) {
      entity.sprite.removeAllListeners('pointerdown')
      entity.sprite.on('pointerdown', () => fn(id))
    }
  }

  /** Host 端資源重生後呼叫，用於廣播新資源給 Clients */
  setRespawnCallback(fn: (data: ResourceNode) => void): void {
    this.respawnCallback = fn
  }

  /** 資源耗盡爆炸特效 callback（在 entity 銷毀前觸發） */
  setDepletedVisualCallback(fn: (data: ResourceNode) => void): void {
    this.depletedVisualCallback = fn
  }

  // ── 生成 ──────────────────────────────────────────────────

  spawnAll(worldData: WorldData): ResourceNodeEntity[] {
    // 先清空舊的（避免重複叫用時堆疊）
    for (const [, entity] of this.nodes) {
      this.container.removeChild(entity.sprite)
      entity.destroy()
    }
    this.nodes.clear()
    worldData.resources.forEach(data => this.spawnOne(data))
    return Array.from(this.nodes.values())
  }

  spawnOne(data: ResourceNode): ResourceNodeEntity {
    const entity = new ResourceNodeEntity(data)
    this.nodes.set(data.id, entity)
    // Y-sorting：zIndex 以節點 y 座標為基準，讓靠近畫面底部的物件蓋過上方物件（2.5D 深度遮擋）
    entity.sprite.zIndex = data.y
    this.container.addChild(entity.sprite)
    if (this.clickHandler) {
      entity.sprite.on('pointerdown', () => this.clickHandler!(data.id))
    }
    return entity
  }

  // ── Client 端 delta 同步 ───────────────────────────────────

  /**
   * Client 收到 state_delta 時呼叫。
   * - resources: 更新 HP 或生成新節點（respawn）
   * - removedResources: 直接移除視覺，不排程重生（由 Host 管）
   */
  applyResourceDelta(
    resources?: Partial<Record<NodeId, Partial<ResourceNode>>>,
    removedResources?: NodeId[]
  ): void {
    if (resources) {
      for (const [id, data] of Object.entries(resources)) {
        if (!data) continue
        const existing = this.nodes.get(id)
        if (existing) {
          existing.applyDelta(data)
        } else if (data.id && data.type && data.x !== undefined && data.y !== undefined) {
          // 全量資料 → 是新生成的節點（respawn 或 state_full 中的新節點）
          const newEntity = this.spawnOne(data as ResourceNode)
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
        this.nodes.delete(nodeId)
        // 不在 Client 端排計時器；Host 重生後會廣播
      }
    }
  }

  // ── 內部：資源耗盡（Host 端） ──────────────────────────────

  private handleDepleted(nodeId: string): void {
    const entity = this.nodes.get(nodeId)
    if (!entity) return

    const data = entity.getData()

    // 觸發爆炸特效（在 destroy 前，才能取得位置）
    this.depletedVisualCallback?.(data)

    this.container.removeChild(entity.sprite)
    entity.destroy()
    this.nodes.delete(nodeId)

    // 排程重生
    const timer = setTimeout(() => {
      // 檢查目標位置是否被建築佔用，是的話延後重生
      if (isPositionBlockedByBuilding(data.x, data.y)) {
        // 30 秒後再嘗試
        this.respawnTimers.delete(nodeId)
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
      newEntity.playRespawnAnim()          // 彈入動畫
      this.respawnCallback?.(newEntity.getData())
      this.respawnTimers.delete(nodeId)
    }, data.respawnTime * 1000)
    this.respawnTimers.set(nodeId, timer)
  }

  // ── 查詢 ──────────────────────────────────────────────────

  getNode(nodeId: string): ResourceNodeEntity | undefined {
    return this.nodes.get(nodeId)
  }

  getAllNodes(): ResourceNodeEntity[] {
    // 過濾已銷毀的節點，避免訪問 destroyed sprite
    return Array.from(this.nodes.values()).filter(n => !n.isDestroyed)
  }
}
