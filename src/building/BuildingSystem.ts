import * as PIXI from 'pixi.js'
import type { Building, PlayerId, BuildingId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { t } from '@/core/i18n'
import { Inventory } from '@/inventory'
import { GameStateManager_ } from '@/core/GameState'
import { EntitySpriteDriver } from '@/render/EntitySpriteDriver'
import { BUILDING_DEFS, BUILDING_UPGRADES, TRAP_REPAIR_COST } from './data/buildings'

const TILE_SIZE = 48

export class BuildingSystem {
  private container: PIXI.Container
  private sprites: Map<string, PIXI.Container> = new Map()
  private buildingProgress: Map<string, { startTime: number; duration: number }> = new Map()  // 建造進度追蹤
  private isWaterChecker: ((wx: number, wy: number) => boolean) | null = null
  /** 注入：取得所有玩家目前世界座標（用於放置碰撞檢查） */
  private _getPlayers: (() => Array<{ x: number; y: number }>) | null = null
  /** 注入：取得重生點世界座標（建築不可蓋在重生點保護區內） */
  private _getSpawnPoint: (() => { x: number; y: number }) | null = null

  /** buildingId -> name label（語言切換時重設文字） */
  private nameLabels: Map<string, { label: PIXI.Text; defId: string }> = new Map()

  // 玩家碰撞體：以腳部為中心，垂直中心向上偏移，橢圓半徑
  private static readonly PLAYER_COL_OFFSET_Y = 8   // 玩家碰撞中心 y 偏移（往上）
  private static readonly PLAYER_COL_R        = 18  // 碰撞圓半徑（px，放寬一點避免卡邊）

  private static rectsOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
  }

  constructor(container: PIXI.Container) {
    this.container = container

    // 語言切換時重新翻譯所有建築名稱標籤
    EventBus.on('i18n:changed', () => {
      for (const { label, defId } of this.nameLabels.values()) {
        const def = BUILDING_DEFS[defId]
        if (def) {
          label.text = t(`building.${defId}.name`, undefined, def.name)
        }
      }
    })
  }

  /** 注入水域檢查函數（main.ts 提供） */
  setWaterChecker(fn: (wx: number, wy: number) => boolean): void {
    this.isWaterChecker = fn
  }

  /** 注入玩家位置取得函數（main.ts 提供） */
  setPlayersGetter(fn: () => Array<{ x: number; y: number }>): void {
    this._getPlayers = fn
  }

  /** 注入重生點取得函數（main.ts 提供） */
  setSpawnPointGetter(fn: () => { x: number; y: number }): void {
    this._getSpawnPoint = fn
  }

  canPlace(buildingDefId: BuildingId, x: number, y: number, playerId: PlayerId): boolean {
    const def = BUILDING_DEFS[buildingDefId]
    if (!def) return false
    const hasMaterials = def.cost.every(c =>
      Inventory.getAmount(playerId, c.itemId) >= c.amount
    )
    if (!hasMaterials) return false

    // ── 水域檢查：木橋必須放在水上、其他建築不能放在水上 ──
    if (this.isWaterChecker) {
      const halfW = def.size.x * TILE_SIZE / 2
      const halfH = def.size.y * TILE_SIZE / 2
      const cx = x + halfW
      const cy = y + halfH
      const tileIsWater = this.isWaterChecker(cx, cy)
      if (buildingDefId === 'wooden_bridge') {
        // 木橋必須放在水上
        if (!tileIsWater) return false
      } else {
        // 其他建築不能放在水上
        if (tileIsWater) return false
      }
    }

    const world = GameStateManager_.getWorld()

    // 檢查與其他建築重疊。必須用兩個建築的完整 AABB，
    // 否則 2x2 建築用角落覆蓋 1x1 熔爐時會漏判。
    const candidateRect = {
      x,
      y,
      w: def.size.x * TILE_SIZE,
      h: def.size.y * TILE_SIZE,
    }
    const hasBuildingConflict = (world.buildings ?? []).some(b => {
      const bDef = BUILDING_DEFS[b.defId]
      if (!bDef) return false
      const existingRect = {
        x: b.x,
        y: b.y,
        w: bDef.size.x * TILE_SIZE,
        h: bDef.size.y * TILE_SIZE,
      }
      return BuildingSystem.rectsOverlap(candidateRect, existingRect)
    })
    if (hasBuildingConflict) return false

    // ── 重生點保護區：建築不可覆蓋重生點周圍（避免玩家重生後卡在建築裡） ──
    if (this._getSpawnPoint) {
      const sp = this._getSpawnPoint()
      const M = TILE_SIZE   // 保護範圍：重生點向外 1 格
      const spawnRect = { x: sp.x - M, y: sp.y - M, w: M * 2, h: M * 2 }
      if (BuildingSystem.rectsOverlap(candidateRect, spawnRect)) return false
    }

    // 檢查與資源節點重疊（建築不可放在樹木、礦石等之上）
    const buildingHalfW = def.size.x * TILE_SIZE / 2
    const buildingHalfH = def.size.y * TILE_SIZE / 2
    const buildingCX = x + buildingHalfW
    const buildingCY = y + buildingHalfH
    const hasResourceConflict = (world.resources ?? []).some(r => {
      // 資源節點半徑約半格
      const RESOURCE_R = TILE_SIZE * 0.5
      const dx = Math.abs(r.x - buildingCX) - buildingHalfW
      const dy = Math.abs(r.y - buildingCY) - buildingHalfH
      // AABB 與圓的碰撞判斷（簡化版：取最近距離點）
      const distX = Math.max(0, dx)
      const distY = Math.max(0, dy)
      return (distX * distX + distY * distY) < RESOURCE_R * RESOURCE_R
    })
    if (hasResourceConflict) return false

    // ── 玩家碰撞檢查：建築矩形不可覆蓋任何玩家身體 ──────────────
    // 陷阱類除外（玩家可以站在自己放的陷阱上）
    const isTrap = ['spike_trap', 'fire_trap', 'ice_trap'].includes(buildingDefId)
    if (!isTrap && this._getPlayers) {
      const R  = BuildingSystem.PLAYER_COL_R
      const oY = BuildingSystem.PLAYER_COL_OFFSET_Y
      const bx = x
      const by = y
      const bw = def.size.x * TILE_SIZE
      const bh = def.size.y * TILE_SIZE
      const hasPlayerConflict = this._getPlayers().some(p => {
        // 玩家碰撞圓心
        const pcx = p.x
        const pcy = p.y - oY
        // 找 AABB 上距離圓心最近的點
        const nearX = Math.max(bx, Math.min(pcx, bx + bw))
        const nearY = Math.max(by, Math.min(pcy, by + bh))
        const dx = pcx - nearX
        const dy = pcy - nearY
        return dx * dx + dy * dy < R * R
      })
      if (hasPlayerConflict) return false
    }

    return true
  }

  place(playerId: PlayerId, buildingDefId: BuildingId, x: number, y: number): Building | null {
    if (!this.canPlace(buildingDefId, x, y, playerId)) return null
    const def = BUILDING_DEFS[buildingDefId]
    def.cost.forEach(c => Inventory.remove(playerId, c.itemId, c.amount))

    const building: Building = {
      id: `building_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      defId: buildingDefId,
      x, y,
      ownerId:  playerId,
      placedAt: Date.now(),
      level: 1,
      hp: 100,
      maxHp: 100,
    }

    GameStateManager_.getWorld().buildings.push(building)
    this._renderBuilding(building)

    // 記錄建造時間（木橋 10 秒，其他建築立即完成）
    if (buildingDefId === 'wooden_bridge') {
      this.buildingProgress.set(building.id, {
        startTime: Date.now(),
        duration: 10_000,  // 10 秒
      })
    }

    EventBus.emit('build:placed', { playerId, buildingId: building.id, x, y })
    return building
  }

  private _renderBuilding(building: Building): void {
    const def = BUILDING_DEFS[building.defId]
    const w   = def.size.x * TILE_SIZE
    const h   = def.size.y * TILE_SIZE
    const c   = new PIXI.Container()
    c.x = building.x
    c.y = building.y
    // Y-sorting：建築物底部 y 作為深度，和資源節點、玩家統一排序
    // 木橋例外：作為地板使用，必須渲染在玩家/資源/建築下方
    c.zIndex = building.defId === 'wooden_bridge' ? building.y - 100 : building.y + h

    switch (building.defId) {
      case 'furnace':         this._drawFurnace(c, w, h, building.id);        break
      case 'research_lab':    this._drawResearchLab(c, w, h, building.id);    break
      case 'farm':            this._drawFarm(c, w, h, building.id);           break
      case 'market':          this._drawMarket(c, w, h, building.id);         break
      case 'goddess_statue':  this._drawGoddessStatue(c, w, h, building.id);  break
      case 'wooden_bridge':   this._drawWoodenBridge(c, w, h);                break
      case 'tower':           this._drawBlockSprite(c, w, h, 'block.tower', building.id, def); break
      case 'fire_trap':       this._drawBlockSprite(c, w, h, 'block.fire_trap', building.id, def); break
      case 'ice_trap':        this._drawBlockSprite(c, w, h, 'block.ice_trap', building.id, def); break
      default:                this._drawGeneric(c, w, h, building.id, def); break
    }

    // 添加建造計時器容器
    const timerContainer = new PIXI.Container()
    timerContainer.name = 'timer'
    c.addChild(timerContainer)

    this.container.addChild(c)
    this.sprites.set(building.id, c)
  }

  // ── 個別建築圖形 ──────────────────────────────────────────

  private _drawFurnace(c: PIXI.Container, w: number, h: number, buildingId: string): void {
    const g = new PIXI.Graphics()
    g.ellipse(w / 2, h - 2, w * 0.45, 5).fill({ color: 0x000000, alpha: 0.22 })
    // 石磚主體
    g.roundRect(2, 2, w - 4, h - 6, 3).fill(0x546e7a)
    g.roundRect(2, 2, w - 4, h - 6, 3).stroke({ color: 0x263238, width: 1.5 })
    // 磚紋
    g.rect(2, h * 0.3, w - 4, 2).fill({ color: 0x37474f, alpha: 0.6 })
    g.rect(2, h * 0.6, w - 4, 2).fill({ color: 0x37474f, alpha: 0.6 })
    g.rect(w / 2, 2, 2, h * 0.3).fill({ color: 0x37474f, alpha: 0.4 })
    // 爐口
    const ox = w * 0.2, oy = h * 0.42, ow = w * 0.6, oh = h * 0.38
    g.roundRect(ox, oy, ow, oh, 4).fill(0x1a1a1a)
    // 火焰
    g.ellipse(w / 2, oy + oh * 0.65, ow * 0.35, oh * 0.32).fill({ color: 0xff5722, alpha: 0.9 })
    g.ellipse(w / 2, oy + oh * 0.50, ow * 0.22, oh * 0.20).fill({ color: 0xffc107, alpha: 0.85 })
    g.ellipse(w / 2, oy + oh * 0.38, ow * 0.12, oh * 0.12).fill({ color: 0xffee58, alpha: 0.8 })
    // 煙囪
    g.rect(w * 0.3, 0, w * 0.15, 6).fill(0x455a64)
    g.rect(w * 0.55, 0, w * 0.15, 6).fill(0x455a64)
    c.addChild(g)
    const driver = EntitySpriteDriver.createSync('block.furnace')
    if (driver) {
      g.visible = false
      driver.sprite.x += w / 2
      driver.sprite.y += h
      c.addChild(driver.sprite)
    } else {
      g.visible = true
    }
    this._addLabel(c, buildingId, 'furnace', w, h, -10)
  }

  private _drawFarm(c: PIXI.Container, w: number, h: number, buildingId: string): void {
    const g = new PIXI.Graphics()
    // 農地
    g.roundRect(2, 2, w - 4, h - 4, 4).fill(0x5d4037)
    g.roundRect(2, 2, w - 4, h - 4, 4).stroke({ color: 0x3e2723, width: 1.5 })
    // 耕地條紋
    for (let row = 0; row < 3; row++) {
      const ry = 8 + row * ((h - 16) / 3)
      g.rect(4, ry, w - 8, (h - 16) / 3 - 3).fill({ color: 0x6d4c41, alpha: 0.7 })
    }
    // 作物
    const plantColor = [0x66bb6a, 0x81c784, 0xa5d6a7]
    for (let row = 0; row < 3; row++) {
      const py = 10 + row * ((h - 16) / 3)
      for (let col = 0; col < 4; col++) {
        const px = 8 + col * ((w - 16) / 4)
        const pc = plantColor[(row + col) % 3]
        g.rect(px + 3, py + 4, 2, 8).fill(0x4caf50)
        g.ellipse(px + 4, py + 4, 5, 4).fill(pc)
      }
    }
    c.addChild(g)
    this._addLabel(c, buildingId, 'farm', w, h)
  }

  private _drawResearchLab(c: PIXI.Container, w: number, h: number, buildingId: string): void {
    const g = new PIXI.Graphics()
    g.roundRect(2, h * 0.45, w - 4, h * 0.5, 4).fill(0x6d4c41)
    g.roundRect(2, h * 0.45, w - 4, h * 0.5, 4).stroke({ color: 0x3e2723, width: 2 })
    g.rect(10, h * 0.32, w - 20, h * 0.15).fill(0x8d6e63)
    c.addChild(g)

    const driver = EntitySpriteDriver.createSync('block.research_lab')
    if (driver) {
      g.visible = false
      driver.sprite.x += w / 2
      driver.sprite.y += h
      c.addChild(driver.sprite)
    }
    this._addLabel(c, buildingId, 'research_lab', w, h, -32)
  }

  private _drawMarket(c: PIXI.Container, w: number, h: number, buildingId: string): void {
    const g = new PIXI.Graphics()
    // 建築主體
    g.roundRect(2, h * 0.3, w - 4, h * 0.68, 3).fill(0xfff8e1)
    g.roundRect(2, h * 0.3, w - 4, h * 0.68, 3).stroke({ color: 0xf57f17, width: 1.5 })
    // 頂棚
    const pts = [0, h * 0.32, w, h * 0.32, w * 0.9, h * 0.2, w * 0.1, h * 0.2]
    g.poly(pts).fill(0xe53935)
    g.poly(pts).stroke({ color: 0xb71c1c, width: 1.5 })
    // 頂棚波浪
    for (let i = 0; i < 5; i++) {
      const tx = w * 0.1 + i * (w * 0.8 / 5)
      g.arc(tx + (w * 0.8 / 5) / 2, h * 0.32, w * 0.08, 0, Math.PI).fill(0xff7043)
    }
    // 攤台
    g.roundRect(4, h * 0.55, w - 8, 6, 1).fill(0x8d6e63)
    g.roundRect(4, h * 0.55, w - 8, 6, 1).stroke({ color: 0x5d4037, width: 1 })
    // 商品
    for (let i = 0; i < 3; i++) {
      g.circle(10 + i * 12, h * 0.5, 4).fill([0xff8f00, 0x43a047, 0x1565c0][i])
    }
    // 旗幟
    g.rect(w - 8, 2, 2, 18).fill(0x5d4037)
    g.poly([w - 6, 2, w + 6, 8, w - 6, 14]).fill(0xff7043)
    c.addChild(g)
    const driver = EntitySpriteDriver.createSync('block.market')
    if (driver) {
      g.visible = false
      driver.sprite.x += w / 2
      driver.sprite.y += h
      c.addChild(driver.sprite)
    } else {
      g.visible = true
    }
    this._addLabel(c, buildingId, 'market', w, h, -28)
  }

  private _drawGoddessStatue(c: PIXI.Container, w: number, h: number, buildingId: string): void {
    const g = new PIXI.Graphics()
    // 地面陰影
    g.ellipse(w / 2, h - 2, w * 0.42, 5).fill({ color: 0x000000, alpha: 0.2 })
    // 底座台階
    g.roundRect(w * 0.15, h * 0.72, w * 0.7, h * 0.26, 3).fill(0xCCBFA0)
    g.roundRect(w * 0.15, h * 0.72, w * 0.7, h * 0.26, 3).stroke({ color: 0x8B7355, width: 1.5 })
    g.roundRect(w * 0.22, h * 0.64, w * 0.56, h * 0.1, 2).fill(0xD4C8A8)
    g.roundRect(w * 0.22, h * 0.64, w * 0.56, h * 0.1, 2).stroke({ color: 0x9C8B6E, width: 1 })
    // 柱子
    g.roundRect(w * 0.4, h * 0.2, w * 0.2, h * 0.46, 2).fill(0xE8DCC8)
    g.roundRect(w * 0.4, h * 0.2, w * 0.2, h * 0.46, 2).stroke({ color: 0xB0A080, width: 1 })
    // 光暈（金色）
    g.circle(w * 0.5, h * 0.1, w * 0.13).fill({ color: 0xFFD700, alpha: 0.35 })
    g.circle(w * 0.5, h * 0.1, w * 0.1).fill({ color: 0xFFEE44, alpha: 0.6 })
    g.circle(w * 0.5, h * 0.1, w * 0.1).stroke({ color: 0xFFCC00, width: 1.5 })
    // 頭部
    g.circle(w * 0.5, h * 0.22, w * 0.065).fill(0xFFCC88)
    g.circle(w * 0.5, h * 0.22, w * 0.065).stroke({ color: 0xC08050, width: 1 })
    // 身體（法袍）
    const bx = w * 0.39, by = h * 0.28, bw = w * 0.22, bh = h * 0.26
    g.roundRect(bx, by, bw, bh, 4).fill(0x90B8D8)
    g.roundRect(bx, by, bw, bh, 4).stroke({ color: 0x5080A0, width: 1 })
    // 法袍細節
    g.rect(w * 0.49, by + 2, 1.5, bh - 4).fill({ color: 0x7098B8, alpha: 0.7 })
    // 手臂（展開）
    g.roundRect(w * 0.22, h * 0.30, w * 0.16, h * 0.06, 2).fill(0xFFCC88)
    g.roundRect(w * 0.22, h * 0.30, w * 0.16, h * 0.06, 2).stroke({ color: 0xC08050, width: 1 })
    g.roundRect(w * 0.62, h * 0.30, w * 0.16, h * 0.06, 2).fill(0xFFCC88)
    g.roundRect(w * 0.62, h * 0.30, w * 0.16, h * 0.06, 2).stroke({ color: 0xC08050, width: 1 })
    // 水晶（胸前）
    g.circle(w * 0.5, h * 0.39, 4).fill({ color: 0x9966FF, alpha: 0.9 })
    g.circle(w * 0.5, h * 0.39, 4).stroke({ color: 0xCC99FF, width: 1 })
    g.circle(w * 0.5, h * 0.39, 2).fill({ color: 0xFFCCFF, alpha: 0.8 })
    c.addChild(g)
    const driver = EntitySpriteDriver.createSync('block.goddess_statue')
    if (driver) {
      g.visible = false
      driver.sprite.x += w / 2
      driver.sprite.y += h
      c.addChild(driver.sprite)
    } else {
      g.visible = true
    }
    this._addLabel(c, buildingId, 'goddess_statue', w, h, -30)
  }

  private _drawWoodenBridge(c: PIXI.Container, w: number, h: number): void {
    const g = new PIXI.Graphics()
    // 木橋像素風格 — 堆疊的木板方塊
    const plankColor = 0xD2A679   // 木質黃棕色
    const darkColor = 0x8B6F47    // 深木色邊框
    const topColor = 0xE8C4A0     // 頂部亮色

    // 底層木板
    g.rect(4, h * 0.6, w - 8, h * 0.35).fill(plankColor)
    g.rect(4, h * 0.6, w - 8, h * 0.35).stroke({ color: darkColor, width: 1 })
    // 底層紋理（縱向木紋）
    g.rect(10, h * 0.62, 1, h * 0.3).fill({ color: darkColor, alpha: 0.4 })
    g.rect(25, h * 0.62, 1, h * 0.3).fill({ color: darkColor, alpha: 0.4 })

    // 中層木板
    g.rect(6, h * 0.35, w - 12, h * 0.25).fill(plankColor)
    g.rect(6, h * 0.35, w - 12, h * 0.25).stroke({ color: darkColor, width: 1 })
    // 中層紋理
    g.rect(12, h * 0.37, 1, h * 0.2).fill({ color: darkColor, alpha: 0.4 })
    g.rect(27, h * 0.37, 1, h * 0.2).fill({ color: darkColor, alpha: 0.4 })

    // 頂層木板（亮面）
    g.rect(8, h * 0.08, w - 16, h * 0.28).fill(topColor)
    g.rect(8, h * 0.08, w - 16, h * 0.28).stroke({ color: darkColor, width: 1.5 })
    // 頂層紋理
    g.rect(14, h * 0.1, 1, h * 0.24).fill({ color: darkColor, alpha: 0.3 })
    g.rect(29, h * 0.1, 1, h * 0.24).fill({ color: darkColor, alpha: 0.3 })

    // 邊框亮線（木橋的邊緣細節）
    g.rect(8, h * 0.08, w - 16, 1).fill({ color: 0xFFDDB3, alpha: 0.6 })

    c.addChild(g)
    // 不顯示標籤（木橋不需要文字標識）
  }

  private _drawGeneric(c: PIXI.Container, w: number, h: number, buildingId: string, def: typeof BUILDING_DEFS[string]): void {
    const g = new PIXI.Graphics()
    g.roundRect(2, 2, w - 4, h - 4, 3).fill(0x8d6e63)
    g.roundRect(2, 2, w - 4, h - 4, 3).stroke({ color: 0x5d4037, width: 2 })
    c.addChild(g)
    this._addLabel(c, buildingId, def.id, w, h)
  }

  private _drawBlockSprite(c: PIXI.Container, w: number, h: number, manifestId: string, buildingId: string, def: typeof BUILDING_DEFS[string]): void {
    const driver = EntitySpriteDriver.createSync(manifestId)
    if (!driver) {
      this._drawGeneric(c, w, h, buildingId, def)
      return
    }
    driver.sprite.x += w / 2
    driver.sprite.y += h
    c.addChild(driver.sprite)
  }

  private _addLabel(c: PIXI.Container, buildingId: string, defId: string, w: number, _h: number, y = 0): void {
    const def = BUILDING_DEFS[defId]
    const label = new PIXI.Text({
      text: t(`building.${defId}.name`, undefined, def?.name ?? defId),
      style: { fontSize: 9, fill: 0xffffff, dropShadow: { color: 0x000000, blur: 1, distance: 1, alpha: 0.9 } },
    })
    label.anchor.set(0.5, 1)
    label.x = w / 2
    label.y = y
    c.addChild(label)
    // 記錄以便語言切換時更新
    this.nameLabels.set(buildingId, { label, defId })
  }

  // ── Client 恢復建築 ───────────────────────────────────────

  restoreBuilding(building: Building): void {
    if (this.sprites.has(building.id)) return
    const world = GameStateManager_.getWorld()
    if (!world.buildings) world.buildings = []
    if (!world.buildings.some(b => b.id === building.id)) {
      world.buildings.push(building)
    }
    this._renderBuilding(building)
  }

  getAll(): Building[] {
    return GameStateManager_.getWorld().buildings
  }

  /** 拆除建築：移除 sprite 與世界狀態，回傳建築資料（供呼叫者計算返還材料） */
  demolish(buildingId: string): Building | null {
    const world = GameStateManager_.getWorld()
    if (!world?.buildings) return null
    const idx = world.buildings.findIndex(b => b.id === buildingId)
    if (idx === -1) return null
    const building = world.buildings[idx]
    world.buildings.splice(idx, 1)
    const sprite = this.sprites.get(buildingId)
    if (sprite) {
      this.container.removeChild(sprite)
      this.sprites.delete(buildingId)
    }
    this.buildingProgress.delete(buildingId)
    this.nameLabels.delete(buildingId)
    return building
  }

  getBuildingDefs() {
    return BUILDING_DEFS
  }

  // ── 檢查建築是否在建造中 ──────────────────────────────────
  isBuilding(buildingId: string): boolean {
    return this.buildingProgress.has(buildingId)
  }

  // ── 建造進度更新 ──────────────────────────────────────────
  update(): void {
    const now = Date.now()
    for (const [buildingId, progress] of this.buildingProgress.entries()) {
      const elapsed = now - progress.startTime
      const completedRatio = Math.min(elapsed / progress.duration, 1)
      const remainingMs = Math.max(progress.duration - elapsed, 0)
      const remainingSeconds = Math.ceil(remainingMs / 1000)

      const sprite = this.sprites.get(buildingId)
      if (sprite) {
        // 更新 alpha：從 0.4 漸進到 1.0（視覺上顯示建造進度）
        sprite.alpha = 0.4 + completedRatio * 0.6

        // 更新計時器文字
        const timerContainer = sprite.getChildByName('timer') as PIXI.Container
        if (timerContainer) {
          timerContainer.removeChildren()  // 清除舊的文字
          if (remainingSeconds > 0) {
            const timerText = new PIXI.Text({
              text: `${remainingSeconds}s`,
              style: {
                fontSize: 14,
                fill: 0xffff00,
                stroke: { color: 0x000000, width: 2 },
                fontWeight: 'bold',
              },
            })
            timerText.anchor.set(0.5, 0.5)
            timerText.x = 24
            timerText.y = 24
            timerContainer.addChild(timerText)
          }
        }

        // 建造完成時移除進度追蹤
        if (completedRatio >= 1) {
          this.buildingProgress.delete(buildingId)
          if (timerContainer) timerContainer.removeChildren()
        }
      }
    }
  }

  // ── 建築受傷（怪物/陷阱觸發後消耗） ─────────────────────────
  takeDamage(buildingId: string, damage: number): boolean {
    const building = GameStateManager_.getWorld().buildings.find(b => b.id === buildingId)
    if (!building) return false
    building.hp = Math.max(0, building.hp - damage)
    const sprite = this.sprites.get(buildingId)
    if (sprite) sprite.alpha = building.hp <= 0 ? 0.3 : 1.0
    EventBus.emit('building:damaged' as any, { buildingId, hp: building.hp, maxHp: building.maxHp })
    if (building.hp <= 0) {
      EventBus.emit('building:destroyed' as any, { buildingId, defId: building.defId })
    }
    return building.hp <= 0
  }

  /** 玩家靠近陷阱/建築按 R 修復（消耗材料，恢復 70% HP） */
  repair(playerId: PlayerId, buildingId: string): boolean {
    const building = GameStateManager_.getWorld().buildings.find(b => b.id === buildingId)
    if (!building) return false
    if (building.hp > 0) return false  // 未損壞不需修復
    const repairCost = TRAP_REPAIR_COST[building.defId]
    if (!repairCost) return false
    const canAfford = repairCost.every(c => Inventory.getAmount(playerId, c.itemId) >= c.amount)
    if (!canAfford) return false
    repairCost.forEach(c => Inventory.remove(playerId, c.itemId, c.amount))
    building.hp = Math.floor(building.maxHp * 0.7)
    const sprite = this.sprites.get(buildingId)
    if (sprite) sprite.alpha = 1.0
    EventBus.emit('building:repaired' as any, { buildingId, hp: building.hp })
    return true
  }

  /** 查詢建築是否損壞（hp <= 0，半透明失效狀態） */
  isDestroyed(buildingId: string): boolean {
    const b = GameStateManager_.getWorld().buildings.find(b => b.id === buildingId)
    return !b || b.hp <= 0
  }

  // ── 建築升級 ──────────────────────────────────────────────
  canUpgrade(building: Building): boolean {
    const upgrades = BUILDING_UPGRADES[building.defId as keyof typeof BUILDING_UPGRADES]
    if (!upgrades) return false
    return building.level < upgrades.length
  }

  upgrade(playerId: PlayerId, buildingId: string): boolean {
    const building = GameStateManager_.getWorld().buildings.find(b => b.id === buildingId)
    if (!building || building.ownerId !== playerId) return false

    const upgrades = BUILDING_UPGRADES[building.defId as keyof typeof BUILDING_UPGRADES]
    if (!upgrades || building.level >= upgrades.length) return false

    const nextUpgrade = upgrades[building.level]
    if (!nextUpgrade) return false

    // 檢查材料
    const canAfford = nextUpgrade.cost.every((req: any) =>
      Inventory.getAmount(playerId, req.itemId) >= req.amount
    )
    if (!canAfford) return false

    // 扣除材料
    nextUpgrade.cost.forEach((req: any) => Inventory.remove(playerId, req.itemId, req.amount))

    // 升級建築
    building.level += 1
    building.maxHp = nextUpgrade.hp
    building.hp = nextUpgrade.hp

    EventBus.emit('building:upgraded', { playerId, buildingId, newLevel: building.level })
    return true
  }
}
