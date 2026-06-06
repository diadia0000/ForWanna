// src/dungeon/DungeonScene.ts
import * as PIXI from 'pixi.js'
import { EntitySpriteDriver } from '@/render'
import type { EntityDirection } from '@/render'
import type { DungeonLayout, DRoom } from './DungeonGenerator'
import { generateLoot, type LootRarity } from '@/treasure/treasureConfig'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

const TILE = 48

type DungeonMonsterVisual = {
  type: string
  scale: number
  hp: number
  damage: number
  speed: number
}

const DUNGEON_ENEMY_VISUALS: DungeonMonsterVisual[] = [
  { type: 'goblin_warrior', scale: 1.0, hp: 55, damage: 12, speed: 1.1 },
  { type: 'goblin_shaman', scale: 1.0, hp: 45, damage: 14, speed: 1.0 },
  { type: 'skeleton_mage', scale: 1.0, hp: 50, damage: 15, speed: 0.95 },
  { type: 'skeleton_warrior', scale: 1.05, hp: 70, damage: 14, speed: 0.9 },
  { type: 'tengu_blue', scale: 0.95, hp: 65, damage: 16, speed: 1.25 },
]

const DUNGEON_BOSS_VISUALS: DungeonMonsterVisual[] = [
  { type: 'giant_red_samurai', scale: 1.55, hp: 360, damage: 28, speed: 0.65 },
  { type: 'giant_blue_samurai', scale: 1.55, hp: 340, damage: 26, speed: 0.7 },
  { type: 'tengu_red', scale: 1.65, hp: 320, damage: 27, speed: 0.78 },
  { type: 'giant_raccoon_gold', scale: 1.75, hp: 330, damage: 25, speed: 0.72 },
]

function pickDungeonVisual(table: DungeonMonsterVisual[], rng: () => number): DungeonMonsterVisual {
  return table[Math.floor(rng() * table.length)] ?? table[0]
}

export interface DungeonEnemy {
  id: string
  x: number; y: number
  hp: number; maxHp: number
  damage: number; speed: number
  gfx: PIXI.Graphics
  hpBar: PIXI.Graphics
  alive: boolean
  lastAttackMs: number
  attackUntil: number
  isBoss: boolean
  driver: EntitySpriteDriver | null
  holder: PIXI.Container | null
  visualScale: number
  facingDir: EntityDirection
}

export interface DungeonChest {
  id: string
  x: number; y: number
  opened: boolean
  gfx: PIXI.Container
  gold: number
  rarity: LootRarity
  loot: Array<{ itemId: string; amount: number }>
}

export class DungeonScene {
  readonly container: PIXI.Container
  private tileGfx: PIXI.Graphics
  private portalGfx: PIXI.Graphics
  enemies: DungeonEnemy[] = []
  chests:  DungeonChest[]  = []
  private floorRects: Array<{x:number;y:number;w:number;h:number}> = []
  private layout: DungeonLayout | null = null
  private _bossKillCb?: () => void
  private _bossRoom: DRoom | null = null   // Boss 房：擊殺 Boss 後才在此生成寶箱
  peaceful = false   // [DEBUG] true 時遺跡怪不追擊、不攻擊玩家（純參觀）
  private _portalLabel: PIXI.Text | null = null
  private _i18nHandler: (payload: { lang: string }) => void

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.tileGfx  = new PIXI.Graphics()
    this.portalGfx = new PIXI.Graphics()
    this.container.addChild(this.tileGfx)
    this.container.addChild(this.portalGfx)

    // 語言切換時重繪入口文字
    this._i18nHandler = () => {
      if (this._portalLabel) {
        this._portalLabel.text = t('dungeon.portal.exit', undefined, '出口')
      }
    }
    EventBus.on('i18n:changed', this._i18nHandler)
  }

  /** 銷毀場景時移除 i18n 監聽，避免記憶體洩漏 */
  destroy(): void {
    EventBus.off('i18n:changed', this._i18nHandler)
    this.container.destroy({ children: true })
  }

  setBossKillCallback(fn: () => void): void { this._bossKillCb = fn }

  // 非同步載入怪物貼圖，載好後用 sprite 取代備援的 Graphics 圓圈
  private async _attachSprite(e: DungeonEnemy, type: string, scale: number): Promise<void> {
    const driver = await EntitySpriteDriver.create(`monster.${type}`)
    // 載入期間若場景已重設（換了一座遺跡），這隻怪已不在清單 → 放棄掛載
    if (!driver || this.enemies.indexOf(e) === -1) return
    const holder = new PIXI.Container()
    holder.x = e.x; holder.y = e.y
    if (scale !== 1) holder.scale.set(scale)
    holder.addChild(driver.sprite)
    this.container.addChild(holder)
    e.driver = driver
    e.holder = holder
    e.gfx.visible = false
    if (!e.alive) holder.visible = false
    void driver.play('IDLE', 'DOWN')
  }

  setup(layout: DungeonLayout, seed: number): void {
    this.layout = layout
    this.floorRects = []
    this.enemies = []
    this.chests  = []
    this._bossRoom = null
    this._portalLabel = null
    this.tileGfx.clear()
    this.portalGfx.clear()
    for (const c of [...this.container.children]) {
      if (c !== this.tileGfx && c !== this.portalGfx) this.container.removeChild(c)
    }

    let rs = seed ^ 0xd00dfeed
    const rng = () => { rs = (rs * 1664525 + 1013904223) & 0x7fffffff; return rs / 0x7fffffff }

    for (const c of layout.corridors) {
      this._drawFloor(c.px, c.py, c.pw, c.ph)
      this.floorRects.push({ x: c.px, y: c.py, w: c.pw, h: c.ph })
    }

    for (const room of layout.rooms) {
      this._drawFloor(room.px, room.py, room.pw, room.ph)
      this.floorRects.push({ x: room.px, y: room.py, w: room.pw, h: room.ph })

      if (!room.isSpawn) {
        const isBossRoom = room.id === layout.bossRoomId

        if (isBossRoom) {
          // Boss 房：1 個 Boss
          const bx = room.px + room.pw / 2
          const by = room.py + room.ph / 2
          const visual = pickDungeonVisual(DUNGEON_BOSS_VISUALS, rng)
          const gfx = new PIXI.Graphics()
          gfx.circle(0, 0, 26).fill(0xaa1111)
          gfx.circle(0, 0, 26).stroke({ color: 0xff3333, width: 3 })
          gfx.circle(0, 0, 10).fill({ color: 0xffcc00, alpha: 0.6 })  // 金色核心
          gfx.x = bx; gfx.y = by
          this.container.addChild(gfx)
          const hpBar = this._makeHpBar(visual.hp, visual.hp)
          hpBar.x = bx - 30; hpBar.y = by - 42
          this.container.addChild(hpBar)
          const boss: DungeonEnemy = { id: `boss_${room.id}`, x: bx, y: by, hp: visual.hp, maxHp: visual.hp, damage: visual.damage, speed: visual.speed, gfx, hpBar, alive: true, lastAttackMs: 0, attackUntil: 0, isBoss: true, driver: null, holder: null, visualScale: visual.scale, facingDir: 'DOWN' }
          this.enemies.push(boss)
          this._bossRoom = room   // 記住 Boss 房，擊殺後才生成寶箱
          void this._attachSprite(boss, visual.type, visual.scale)
        } else {
          // 普通敵人
          const ec = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < ec; i++) {
            const ex = room.px + TILE + rng() * (room.pw - TILE * 2)
            const ey = room.py + TILE + rng() * (room.ph - TILE * 2)
            const visual = pickDungeonVisual(DUNGEON_ENEMY_VISUALS, rng)
            const gfx = new PIXI.Graphics()
            gfx.circle(0, 0, 14).fill(0xcc2222)
            gfx.circle(0, 0, 14).stroke({ color: 0xff5555, width: 2 })
            gfx.x = ex; gfx.y = ey
            this.container.addChild(gfx)
            const hpBar = this._makeHpBar(visual.hp, visual.hp)
            hpBar.x = ex - 20; hpBar.y = ey - 28
            this.container.addChild(hpBar)
            const enemy: DungeonEnemy = { id:`de_${room.id}_${i}`, x:ex, y:ey, hp:visual.hp, maxHp:visual.hp, damage:visual.damage, speed:visual.speed, gfx, hpBar, alive:true, lastAttackMs:0, attackUntil: 0, isBoss: false, driver: null, holder: null, visualScale: visual.scale, facingDir: 'DOWN' }
            this.enemies.push(enemy)
            void this._attachSprite(enemy, visual.type, visual.scale)
          }
        }

        // 一般房 40% 機率生寶箱；Boss 房的寶箱改為擊殺 Boss 後才生成（見 hitEnemy）
        if (!isBossRoom && rng() < 0.4) {
          this._spawnChest(room, rng, false)
        }
      }
    }

    const sp = layout.rooms[0]
    this._drawPortal(sp.px + TILE*1.5, sp.py + TILE*1.5, 0x00ffaa, t('dungeon.portal.exit', undefined, '出口'))
  }

  private _makeHpBar(hp: number, maxHp: number): PIXI.Graphics {
    const g = new PIXI.Graphics()
    this._drawHpBar(g, hp, maxHp)
    return g
  }

  private _drawHpBar(g: PIXI.Graphics, hp: number, maxHp: number): void {
    const BAR_W = 40
    g.clear()
    g.rect(0, 0, BAR_W, 5).fill(0x330000)
    const fill = Math.max(0, Math.round(BAR_W * hp / maxHp))
    if (fill > 0) {
      const col = hp / maxHp > 0.5 ? 0x44cc44 : hp / maxHp > 0.25 ? 0xccaa00 : 0xcc2222
      g.rect(0, 0, fill, 5).fill(col)
    }
  }

  private _drawFloor(px: number, py: number, pw: number, ph: number): void {
    const cols = Math.ceil(pw / TILE), rows = Math.ceil(ph / TILE)
    for (let tx = 0; tx < cols; tx++) {
      for (let ty = 0; ty < rows; ty++) {
        const c = (tx + ty) % 2 === 0 ? 0x2a2020 : 0x252525
        this.tileGfx.rect(px + tx*TILE, py + ty*TILE, TILE-1, TILE-1).fill(c)
      }
    }
    this.tileGfx.rect(px-2, py-2, pw+4, 2).fill(0x686868)
    this.tileGfx.rect(px-2, py+ph, pw+4, 2).fill(0x686868)
    this.tileGfx.rect(px-2, py-2, 2, ph+4).fill(0x686868)
    this.tileGfx.rect(px+pw, py-2, 2, ph+4).fill(0x686868)
  }

  private _drawPortal(cx: number, cy: number, color: number, label: string): void {
    this.portalGfx.circle(cx, cy, 22).fill({ color, alpha: 0.35 })
    this.portalGfx.circle(cx, cy, 22).stroke({ color, width: 3 })
    const txt = new PIXI.Text({
      text: label,
      style: {
        fontSize: 11,
        fill: color,
        dropShadow: { color: 0, blur: 2, distance: 1, alpha: 0.9 },
      },
    })
    txt.anchor.set(0.5, 1); txt.x = cx; txt.y = cy - 26
    this.container.addChild(txt)
    this._portalLabel = txt
  }

  // 依房間決定品級：Boss 房高品級機率高，一般房低品級機率高
  private _rollRarity(rng: () => number, bossRoom: boolean): LootRarity {
    const r = rng() * 100
    if (bossRoom) {
      // Boss 房：epic 50% / rare 35% / common 15%
      if (r < 50) return 'epic'
      if (r < 85) return 'rare'
      return 'common'
    }
    // 一般房：common 70% / rare 25% / epic 5%
    if (r < 70) return 'common'
    if (r < 95) return 'rare'
    return 'epic'
  }

  private _spawnChest(room: DRoom, rng: () => number, isBossRoom: boolean): void {
    const cx = room.px + room.pw/2, cy = room.py + room.ph/2
    const rarity = this._rollRarity(rng, isBossRoom)
    const loot = generateLoot(rarity)
    // 遺跡寶箱每個都比一般箱子多 50~500 金幣
    const gold = 50 + Math.floor(rng() * 451)

    // 依品級著色（common 棕 / rare 藍 / epic 金）
    const body = { common: 0x8b5e2e, rare: 0x3a5fcd, epic: 0xc9961f }[rarity]
    const lid  = { common: 0xa0722a, rare: 0x5a82e8, epic: 0xffd24a }[rarity]

    const gfx = new PIXI.Container()
    const b = new PIXI.Graphics()
    b.rect(-18,-14,36,28).fill(body)
    b.rect(-18,-14,36, 9).fill(lid)
    b.rect(-5, -4,10,10).fill(0xffd700)
    if (rarity !== 'common') {
      // 稀有以上加描邊提示
      b.rect(-19,-15,38,30).stroke({ color: lid, width: 2, alpha: 0.9 })
    }
    gfx.addChild(b); gfx.x = cx; gfx.y = cy
    this.container.addChild(gfx)
    this.chests.push({ id:`dc_${room.id}`, x:cx, y:cy, opened:false, gfx, gold, rarity, loot })
  }

  isFloor(wx: number, wy: number): boolean {
    for (const r of this.floorRects) {
      if (wx >= r.x && wx <= r.x+r.w && wy >= r.y && wy <= r.y+r.h) return true
    }
    return false
  }

  isNearExit(wx: number, wy: number): boolean {
    if (!this.layout) return false
    const sp = this.layout.rooms[0]
    return Math.hypot(wx - (sp.px + TILE*1.5), wy - (sp.py + TILE*1.5)) < TILE * 2
  }

  getSpawnPoint(): { x: number; y: number } {
    if (!this.layout) return { x: 150_000, y: 150_000 }
    const sp = this.layout.rooms[0]
    return { x: sp.px + sp.pw/2, y: sp.py + sp.ph/2 }
  }

  findNearbyEnemy(x: number, y: number, range: number): DungeonEnemy | null {
    let best: DungeonEnemy | null = null, minD = range
    for (const e of this.enemies) {
      if (!e.alive) continue
      const d = Math.hypot(e.x-x, e.y-y)
      if (d < minD) { minD = d; best = e }
    }
    return best
  }

  hitEnemy(id: string, dmg: number): boolean {
    const e = this.enemies.find(en => en.id === id)
    if (!e || !e.alive) return false
    e.hp -= dmg
    this._drawHpBar(e.hpBar, Math.max(0, e.hp), e.maxHp)
    if (e.hp <= 0) {
      e.alive = false
      e.gfx.visible = false
      e.hpBar.visible = false
      if (e.holder) e.holder.visible = false
      if (e.isBoss) {
        // 擊殺 Boss 後才在 Boss 房生成寶箱（高品級機率高）
        if (this._bossRoom) this._spawnChest(this._bossRoom, Math.random, true)
        this._bossKillCb?.()
      }
    }
    return !e.alive
  }

  findNearbyChest(x: number, y: number, range: number): DungeonChest | null {
    let best: DungeonChest | null = null, minD = range
    for (const c of this.chests) {
      if (c.opened) continue
      const d = Math.hypot(c.x-x, c.y-y)
      if (d < minD) { minD = d; best = c }
    }
    return best
  }

  openChest(id: string): { gold: number; loot: Array<{ itemId: string; amount: number }>; rarity: LootRarity } | null {
    const c = this.chests.find(ch => ch.id === id)
    if (!c || c.opened) return null
    c.opened = true; c.gfx.alpha = 0.3
    return { gold: c.gold, loot: c.loot, rarity: c.rarity }
  }

  update(playerX: number, playerY: number, deltaMs: number,
         onDamage: (dmg: number) => void): void {
    const now = performance.now()
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = playerX - e.x, dy = playerY - e.y
      const dist = Math.hypot(dx, dy)
      const aggroRange = e.isBoss ? 500 : 350
      const moving = !this.peaceful && dist < aggroRange && dist > 1
      if (moving) {
        const spd = e.speed * deltaMs / 16
        const nx = e.x + (dx/dist) * spd
        const ny = e.y + (dy/dist) * spd
        const r = e.isBoss ? 24 * e.visualScale : 14 * e.visualScale
        if (this.isFloor(nx, e.y) && this.isFloor(nx - r, e.y) && this.isFloor(nx + r, e.y)) {
          e.x = nx
        }
        if (this.isFloor(e.x, ny) && this.isFloor(e.x, ny - r) && this.isFloor(e.x, ny + r)) {
          e.y = ny
        }
      }
      // 視覺更新（每幀，讓貼圖怪也能播放待機/移動動畫）
      if (e.driver && e.holder) {
        e.holder.x = e.x; e.holder.y = e.y
        const dir: EntityDirection =
          Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'LEFT' : 'RIGHT') : (dy < 0 ? 'UP' : 'DOWN')
        e.facingDir = dir
        const spriteScale = e.driver.manifest.scale ?? 1
        e.driver.sprite.scale.x = dx < 0 ? -spriteScale : spriteScale
        e.driver.sprite.scale.y = spriteScale
        const animState = now < e.attackUntil ? 'ATTACK' : moving ? 'MOVE' : 'IDLE'
        void e.driver.play(animState, dir)
        e.driver.update(deltaMs / 16)
      } else {
        e.gfx.x = e.x; e.gfx.y = e.y
      }
      // 血條跟隨
      const barOff = e.isBoss ? 42 * e.visualScale : 28 * e.visualScale
      const barHalf = e.isBoss ? 30 : 20
      e.hpBar.x = e.x - barHalf; e.hpBar.y = e.y - barOff
      const hitRange = e.isBoss ? 36 * e.visualScale : 28 * e.visualScale
      if (!this.peaceful && dist < hitRange && now - e.lastAttackMs > 1000) {
        e.lastAttackMs = now
        e.attackUntil = now + 420
        if (e.driver) void e.driver.play('ATTACK', e.facingDir, true)
        onDamage(e.damage)
      }
    }
    this.portalGfx.alpha = 0.75 + Math.sin(now / 400) * 0.25
  }
}
