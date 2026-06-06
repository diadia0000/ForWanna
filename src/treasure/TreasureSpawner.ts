// Agent 5+ 負責（新增）— 寶箱生成管理
import * as PIXI from 'pixi.js'
import type { WorldData, NodeId } from '@/types'
import { TreasureChestEntity, type TreasureChestData } from './TreasureChest'
import { rollLootRarity, generateLoot } from './treasureConfig'
import { EventBus } from '@/core/EventBus'

export class TreasureSpawner {
  private chests: Map<string, TreasureChestEntity> = new Map()
  private container: PIXI.Container
  private clickHandler: ((chestId: string) => void) | null = null
  private totalChestsPerWorld = 30  // 全圖共 30 個寶箱
  private updateTicker: (() => void) | null = null
  private _isLandPos: ((x: number, y: number) => boolean) | null = null

  constructor(container: PIXI.Container) {
    this.container = container
  }

  /** 注入陸地檢查函數，spawnAll 時過濾水上位置 */
  setLandChecker(fn: (x: number, y: number) => boolean): void {
    this._isLandPos = fn
  }

  /**
   * 設定點擊 callback
   * Host：直接打開；Client：送網路輸入
   */
  setClickHandler(fn: (chestId: string) => void): void {
    this.clickHandler = fn
    // 對已存在的寶箱補上監聽
    for (const [, entity] of this.chests) {
      entity.sprite.removeAllListeners('pointerdown')
      entity.sprite.on('pointerdown', () => fn(entity.id))
    }
  }

  /**
   * 在 world 中生成寶箱
   *
   * 流程：
   * 1. seeded RNG 出 1-10，最少 5 → 決定本局寶箱總數
   * 2. 枚舉所有已解鎖島嶼（-3..3 × -3..3，中心不是水才算）
   * 3. 把總數平均分配到各島（ceil(total / islands)，最後一島取剩餘）
   * 4. 每島內用 angle+dist 重試放滿，避開資源節點及其他寶箱
   *
   * @param world 世界資料（含 resources 清單，用於避開資源節點）
   */
  // ── 共用常數 ─────────────────────────────────────────────────
  private static readonly TILE_SIZE      = 48
  private static readonly CENTER_TILE    = 104
  private static readonly ISLAND_STRIDE  = 22
  private static readonly ISLAND_R       = (6.5 - 1.8) * 48
  private static readonly MIN_RES_DIST   = 48 * 1.5
  private static readonly MIN_CHK_DIST   = 48 * 1.2
  private static readonly MIN_CENTER_DIST = 48 * 3   // 離島心至少 3 格，避免卡住玩家出生點

  /**
   * 全圖所有陸地島嶼生成寶箱（新世界首次使用）
   */
  spawnAll(world: WorldData): void {
    const placed: Array<{ x: number; y: number }> = []
    for (let ix = -4; ix <= 4; ix++) {
      for (let iy = -4; iy <= 4; iy++) {
        this._spawnIsland(world, ix, iy, placed)
      }
    }

    this.updateTicker = () => {
      for (const [, entity] of this.chests) entity.update()
    }
  }

  /**
   * 生成單個寶箱
   */
  spawnOne(data: TreasureChestData): void {
    const entity = new TreasureChestEntity(data)

    // 設定點擊事件
    if (this.clickHandler) {
      entity.sprite.on('pointerdown', () => this.clickHandler!(entity.id))
    }

    this.container.addChild(entity.sprite)
    this.chests.set(entity.id, entity)
  }

  /**
   * 打開寶箱並返回掉落物品
   * @param chestId 寶箱 ID
   * @returns 掉落物品陣列
   */
  openChest(chestId: string): Array<{ itemId: string; amount: number }> {
    const entity = this.chests.get(chestId)
    if (!entity || entity.isOpened()) return []

    const loot = entity.open()

    // 發出事件讓背包系統處理
    EventBus.emit('treasure:opened', { chestId, loot })

    return loot
  }

  /**
   * 移除已打開的寶箱（視覺效果）
   */
  removeChest(chestId: string): void {
    const entity = this.chests.get(chestId)
    if (entity) {
      entity.destroy()
      this.chests.delete(chestId)
    }
  }

  /**
   * 碰撞檢查：玩家是否被寶箱阻擋（供 isMovementBlockedAt 使用）
   * @param wx 玩家碰撞中心 x
   * @param wy 玩家碰撞中心 y
   * @param playerR 玩家碰撞半徑
   */
  isBlockedByChest(wx: number, wy: number, playerR: number): boolean {
    const CHEST_R = 32  // 寶箱碰撞半徑（視覺寬 88px，取一半留餘地）
    const combined = (CHEST_R + playerR) * (CHEST_R + playerR)
    for (const [, entity] of this.chests) {
      if (entity.isOpened()) continue
      const dx = wx - entity.sprite.x
      const dy = wy - entity.sprite.y
      if (dx * dx + dy * dy < combined) return true
    }
    return false
  }

  /**
   * 尋找距離玩家最近的寶箱（R 鍵開啟用）
   * @param x 玩家世界座標 x
   * @param y 玩家世界座標 y
   * @param range 偵測半徑（像素）
   */
  findNearbyChest(x: number, y: number, range: number): TreasureChestEntity | null {
    let nearest: TreasureChestEntity | null = null
    let minDist = range
    for (const [, entity] of this.chests) {
      if (entity.isOpened()) continue
      const d = Math.hypot(entity.sprite.x - x, entity.sprite.y - y)
      if (d < minDist) {
        minDist = d
        nearest = entity
      }
    }
    return nearest
  }

  /**
   * 取得所有寶箱資料（供 Host 廣播用）
   */
  getAllChestsData(): TreasureChestData[] {
    return Array.from(this.chests.values()).map(e => e.getData())
  }

  /**
   * 從快照還原寶箱狀態（Client 接收 Host 廣播）
   */
  restoreFromSnapshot(snapshot: TreasureChestData[]): void {
    this.chests.clear()
    for (const data of snapshot) {
      this.spawnOne(data)
    }
  }

  /**
   * 更新（tick 用）
   */
  update(): void {
    if (this.updateTicker) {
      this.updateTicker()
    }
  }

  /**
   * 清空所有寶箱
   */
  clear(): void {
    for (const [, entity] of this.chests) {
      entity.destroy()
    }
    this.chests.clear()
  }

  /**
   * 為單個新解鎖的島嶼生成寶箱（解鎖島嶼時追加用）
   * 不影響已存在的寶箱，只在 ix/iy 這座島上生成
   */
  spawnForIsland(world: WorldData, ix: number, iy: number): void {
    // 現有寶箱視為 placed，不重疊
    const placed = Array.from(this.chests.values()).map(e => ({ x: e.sprite.x, y: e.sprite.y }))
    this._spawnIsland(world, ix, iy, placed)
  }

  // ── 內部工具 ────────────────────────────────────────────────

  /**
   * 為指定島嶼（ix, iy）生成寶箱，結果追加到 placed 陣列
   */
  private _spawnIsland(
    world: WorldData,
    ix: number, iy: number,
    placed: Array<{ x: number; y: number }>,
  ): void {
    const { TILE_SIZE, CENTER_TILE, ISLAND_STRIDE, ISLAND_R,
            MIN_RES_DIST, MIN_CHK_DIST, MIN_CENTER_DIST } = TreasureSpawner

    const cx = (CENTER_TILE + ix * ISLAND_STRIDE) * TILE_SIZE
    const cy = (CENTER_TILE + iy * ISLAND_STRIDE) * TILE_SIZE

    // 只在陸地島嶼上生成
    const isLand = this._isLandPos ? this._isLandPos(cx, cy) : (ix === 0 && iy === 0)
    if (!isLand) return

    const seed      = world.seed
    const islandSeed = Math.abs((seed ^ (ix * 73856093)) ^ (iy * 19349663)) + 1
    const rng        = this._seededRandom(islandSeed)

    const ring      = Math.max(Math.abs(ix), Math.abs(iy))
    // 起始島（ring=0）不生成寶箱：島嶼半徑太小，任何位置都緊鄰出生點
    if (ring === 0) return
    const maxChests = ring <= 2 ? 2 : 1
    const count     = Math.floor(rng() * maxChests) + 1

    for (let ci = 0; ci < count; ci++) {
      // 如果此 ID 已存在（玩家之前開過），跳過（不補充）
      const chestId = `chest_${seed}_${ix + 4}_${iy + 4}_${ci}` as NodeId
      if (this.chests.has(chestId)) continue

      for (let attempt = 0; attempt < 40; attempt++) {
        const angle = rng() * Math.PI * 2
        const dist  = MIN_CENTER_DIST + rng() * (ISLAND_R - MIN_CENTER_DIST)
        const x = Math.floor(cx + Math.cos(angle) * dist)
        const y = Math.floor(cy + Math.sin(angle) * dist)

        if (this._isLandPos && !this._isLandPos(x, y)) continue
        if (Math.hypot(x - cx, y - cy) < MIN_CENTER_DIST) continue
        if (world.resources.some(r => Math.hypot(r.x - x, r.y - y) < MIN_RES_DIST)) continue
        if (placed.some(p => Math.hypot(p.x - x, p.y - y) < MIN_CHK_DIST)) continue

        placed.push({ x, y })
        const rarity = rollLootRarity()
        const loot   = generateLoot(rarity)
        this.spawnOne({ id: chestId, x, y, rarity, loot, opened: false })
        break
      }
    }
  }

  /**
   * Seeded RNG（Lehmer / Park-Miller）
   */
  private _seededRandom(seed: number) {
    let current = seed % 2147483647
    if (current <= 0) current += 2147483646
    return () => {
      current = (current * 16807) % 2147483647
      return (current - 1) / 2147483646
    }
  }
}
