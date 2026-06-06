import * as PIXI from 'pixi.js'
import type { ResourceNode as ResourceNodeData, ResourceType, PlayerId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { RESOURCE_TEXTURES } from '@/render/AssetLoader'
import { EntitySpriteDriver } from '@/render'

const BAR_W = 30
const BAR_H = 3

const SPRITE_SCALE: Record<string, number> = { tree: 1.5, rock: 1.4, iron: 1.4, gold: 1.4 }
const SPRITE_ANCHOR_Y: Record<string, number> = { tree: 0.92, rock: 0.85, iron: 0.85, gold: 0.85 }
const ROCK_TINT: Partial<Record<string, number>> = { iron: 0xa0b8e8, gold: 0xf0c840 }
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

export class ResourceNodeEntity {
  readonly id: string
  sprite: PIXI.Container
  private gfx: PIXI.Graphics
  private spr: PIXI.Sprite | null = null
  private hpBarBg: PIXI.Graphics
  private hpBarFg: PIXI.Graphics
  private data: ResourceNodeData
  private shakeTicker: (() => void) | null = null
  private driver: EntitySpriteDriver | null = null
  private destroyed = false

  constructor(data: ResourceNodeData) {
    this.id = data.id
    this.data = { ...data }
    this.sprite = new PIXI.Container()
    this.gfx = new PIXI.Graphics()
    this.hpBarBg = new PIXI.Graphics()
    this.hpBarFg = new PIXI.Graphics()
    this._buildSprite()
    this.sprite.x = data.x
    this.sprite.y = data.y
    this.sprite.eventMode = 'static'
    this.sprite.cursor = 'pointer'
    void this._initManifestSprite()
  }

  private async _initManifestSprite(): Promise<void> {
    const driver = await EntitySpriteDriver.create(`resource.${this.data.type}`)
    if (!driver) return
    if (this.destroyed || this.sprite.destroyed) {
      driver.sprite.destroy()
      return
    }
    this.driver = driver
    if (this.spr) this.spr.visible = false
    this.gfx.visible = false
    this.sprite.addChildAt(driver.sprite, 0)
    this._refreshHpBar()
  }

  private _buildSprite(): void {
    const type = this.data.type
    let tex: PIXI.Texture | null = null
    if (type === 'tree') tex = RESOURCE_TEXTURES.tree
    else if (type === 'rock') tex = RESOURCE_TEXTURES.rock
    else if (type === 'iron' || type === 'gold') tex = RESOURCE_TEXTURES.rock_grey

    const scale = SPRITE_SCALE[type] ?? 1.4
    const ancY = SPRITE_ANCHOR_Y[type] ?? 0.85
    const tint = ROCK_TINT[type]

    if (tex) {
      this.spr = new PIXI.Sprite(tex)
      this.spr.scale.set(scale)
      this.spr.anchor.set(0.5, ancY)
      if (tint !== undefined) this.spr.tint = tint
      this.sprite.addChild(this.spr)
    } else {
      switch (type) {
        case 'tree': this._drawTree(); break
        case 'crystal': this._drawCrystal(); break
        default:
          if (String(type) === 'berry')     this._drawBerryBush()
          else if (String(type) === 'fire_node') this._drawFireNode()
          else if (String(type) === 'ice_node')  this._drawIceNode()
          else this._drawBoulder(type)
          break
      }
      this.sprite.addChild(this.gfx)
    }

    this.sprite.addChild(this.hpBarBg, this.hpBarFg)
    this._refreshHpBar()
  }

  private _drawTree(): void {
    const g = this.gfx
    g.ellipse(1, 10, 20, 7).fill({ color: 0x000000, alpha: 0.18 })
    g.roundRect(-5, -4, 10, 18, 3).fill(0x7a3810)
    g.roundRect(-5, -4, 10, 18, 3).stroke({ color: 0x1a0a00, width: 2 })
    g.circle(-14, -26, 11).fill(0x3c9e1a)
    g.circle(-14, -26, 11).stroke({ color: 0x1a0a00, width: 2 })
    g.circle(14, -28, 10).fill(0x3c9e1a)
    g.circle(14, -28, 10).stroke({ color: 0x1a0a00, width: 2 })
    g.circle(0, -36, 16).fill(0x52c428)
    g.circle(0, -36, 16).stroke({ color: 0x1a0a00, width: 2 })
    g.circle(-6, -20, 9).fill(0x44b01e)
    g.circle(-6, -20, 9).stroke({ color: 0x1a0a00, width: 1.5 })
    g.circle(6, -21, 8).fill(0x44b01e)
    g.circle(6, -21, 8).stroke({ color: 0x1a0a00, width: 1.5 })
    g.circle(6, -43, 7).fill({ color: 0x90e050, alpha: 0.72 })
    g.circle(4, -45, 3).fill({ color: 0xccff88, alpha: 0.55 })
  }

  private _drawBoulder(type: ResourceType): void {
    const g = this.gfx
    const pals = {
      rock: { main: 0x8899aa, light: 0xc8d8e8, mid: 0x607080, shadow: 0x364048, outline: 0x1a2028 },
      iron: { main: 0x7080c0, light: 0xa8b8e0, mid: 0x4858a0, shadow: 0x242c58, outline: 0x101428 },
      gold: { main: 0xd89830, light: 0xf8e060, mid: 0xa86a10, shadow: 0x683808, outline: 0x281400 },
    } as const
    const p = pals[type as 'rock' | 'iron' | 'gold'] ?? pals.rock
    const h = hashId(this.data.id)
    g.ellipse(2, 18, 22, 7).fill({ color: 0x000000, alpha: 0.28 })
    const rx = 12 + (h % 5)
    g.ellipse(rx, -2, 13, 10).fill(p.mid)
    g.ellipse(rx, -2, 13, 10).stroke({ color: p.outline, width: 2 })
    g.ellipse(rx - 3, -7, 4, 3).fill({ color: p.light, alpha: 0.85 })
    g.ellipse(-2, 4, 18, 14).fill(p.main)
    g.ellipse(-2, 4, 18, 14).stroke({ color: p.outline, width: 2.5 })
    g.ellipse(-9, -4, 7, 5).fill({ color: p.light, alpha: 0.92 })
    g.ellipse(-7, -6, 3, 2).fill({ color: 0xffffff, alpha: 0.6 })
    g.ellipse(6, 10, 7, 4).fill({ color: p.shadow, alpha: 0.5 })
    if (type === 'iron') {
      const lx = -8 + (h % 6)
      g.rect(lx, 0, 10, 2).fill({ color: 0xd0e4ff, alpha: 0.8 })
      g.rect(lx + 3, 4, 7, 1).fill({ color: 0xd0e4ff, alpha: 0.6 })
    }
    if (type === 'gold') {
      g.circle(-4, -2, 3).fill({ color: 0xffff90, alpha: 0.95 })
      g.circle(3, 5, 2).fill({ color: 0xffff90, alpha: 0.8 })
      g.circle(-1, 8, 2).fill({ color: 0xffee40, alpha: 0.7 })
    }
  }

  private _drawCrystal(): void {
    const g = this.gfx
    g.ellipse(0, 8, 13, 4).fill({ color: 0x9030c0, alpha: 0.28 })
    g.poly([-10, 3, -5, 3, -7, -16]).fill(0x4a0890)
    g.poly([-10, 3, -5, 3, -7, -16]).stroke({ color: 0x000000, width: 1.5 })
    g.poly([5, 3, 10, 3, 8, -14]).fill(0x4a0890)
    g.poly([5, 3, 10, 3, 8, -14]).stroke({ color: 0x000000, width: 1.5 })
    g.poly([-7, 3, 7, 3, 3, -30, -3, -30]).fill(0x8020c0)
    g.poly([-7, 3, 7, 3, 3, -30, -3, -30]).stroke({ color: 0x000000, width: 2 })
    g.poly([-7, 3, 0, 3, -3, -30]).fill({ color: 0xc060e0, alpha: 0.68 })
    g.circle(0, -28, 3).fill({ color: 0xf0c0ff, alpha: 0.92 })
  }

  private _drawFireNode(): void {
    const g = this.gfx
    // 暗橘熔岩地台
    g.ellipse(0, 10, 16, 5).fill({ color: 0x301008, alpha: 0.45 })
    // 岩漿石底座
    g.ellipse(0, 6, 14, 9).fill(0x3a1808)
    g.ellipse(0, 6, 14, 9).stroke({ color: 0x181008, width: 2 })
    // 中央火焰晶石
    g.poly([-8, 4, 8, 4, 4, -20, -4, -20]).fill(0xc84010)
    g.poly([-8, 4, 8, 4, 4, -20, -4, -20]).stroke({ color: 0x200808, width: 2 })
    g.poly([-8, 4, 0, 4, -3, -20]).fill({ color: 0xff8030, alpha: 0.65 })
    // 側翼小晶體
    g.poly([-12, 4, -6, 4, -9, -12]).fill(0xb03008)
    g.poly([-12, 4, -6, 4, -9, -12]).stroke({ color: 0x200808, width: 1.5 })
    g.poly([6, 4, 12, 4, 9, -10]).fill(0xb03008)
    g.poly([6, 4, 12, 4, 9, -10]).stroke({ color: 0x200808, width: 1.5 })
    // 熔岩光點
    g.circle(0, -18, 3.5).fill({ color: 0xff9040, alpha: 0.95 })
    g.circle(-2, -22, 2).fill({ color: 0xffcc80, alpha: 0.75 })
    g.circle(3, -16, 1.5).fill({ color: 0xffcc80, alpha: 0.6 })
  }

  private _drawIceNode(): void {
    const g = this.gfx
    // 冰雪地台陰影
    g.ellipse(0, 10, 16, 5).fill({ color: 0x102040, alpha: 0.35 })
    // 雪地底座
    g.ellipse(0, 6, 14, 8).fill(0xb0d0e8)
    g.ellipse(0, 6, 14, 8).stroke({ color: 0x6090b8, width: 1.5 })
    // 中央冰晶柱
    g.poly([-7, 4, 7, 4, 4, -24, -4, -24]).fill(0x50a8d8)
    g.poly([-7, 4, 7, 4, 4, -24, -4, -24]).stroke({ color: 0x205080, width: 2 })
    g.poly([-7, 4, 0, 4, -3, -24]).fill({ color: 0xc8eeff, alpha: 0.70 })
    // 側翼冰晶
    g.poly([-12, 4, -5, 4, -8, -14]).fill(0x3880c0)
    g.poly([-12, 4, -5, 4, -8, -14]).stroke({ color: 0x205080, width: 1.5 })
    g.poly([5, 4, 12, 4, 8, -12]).fill(0x3880c0)
    g.poly([5, 4, 12, 4, 8, -12]).stroke({ color: 0x205080, width: 1.5 })
    // 冰晶高光
    g.circle(0, -22, 4).fill({ color: 0xe8f8ff, alpha: 0.92 })
    g.circle(-2, -26, 2).fill({ color: 0xffffff, alpha: 0.70 })
    g.circle(3, -20, 1.5).fill({ color: 0xffffff, alpha: 0.55 })
  }

  private _drawBerryBush(): void {
    const g = this.gfx
    g.ellipse(0, 10, 16, 5).fill({ color: 0x000000, alpha: 0.15 })
    g.circle(-9, -2, 10).fill(0x2e8b20)
    g.circle(-9, -2, 10).stroke({ color: 0x1a5010, width: 1.5 })
    g.circle(9, -2, 10).fill(0x2e8b20)
    g.circle(9, -2, 10).stroke({ color: 0x1a5010, width: 1.5 })
    g.circle(0, -8, 11).fill(0x3aaa28)
    g.circle(0, -8, 11).stroke({ color: 0x1a5010, width: 1.5 })
    g.circle(-8, 2, 3.5).fill(0xff3040)
    g.circle(-5, -6, 3).fill(0xff2838)
    g.circle(6, 1, 3.5).fill(0xff3040)
    g.circle(3, -10, 3).fill(0xff2030)
    g.circle(-1, -3, 3).fill(0xff3848)
    g.circle(9, -5, 2.5).fill(0xff2838)
    g.circle(-7, 1, 1.2).fill({ color: 0xffaaaa, alpha: 0.8 })
    g.circle(7, 0, 1.2).fill({ color: 0xffaaaa, alpha: 0.8 })
  }

  private _barYFor(type: ResourceType): number {
    const fallback = ({
      tree: 20, rock: 26, iron: 26, gold: 26, crystal: 14,
      berry: 18, tomato: 18, purple_grape: 18, onion: 18,
      carrot: 18, pumpkin: 18, watermelon: 18,
      fire_node: 14, ice_node: 14,
    } as Record<string, number>)[type] ?? 24
    return this.driver ? this.driver.getHpBarY(fallback) : fallback
  }

  private _refreshHpBar(): void {
    const ratio = Math.max(0, this.data.hp / this.data.maxHp)
    const damaged = ratio < 1
    const barY = this._barYFor(this.data.type)
    this.hpBarBg.clear()
    this.hpBarFg.clear()
    this.hpBarBg.rect(-(BAR_W / 2 + 1), barY - 1, BAR_W + 2, BAR_H + 2).fill(0x111111)
    this.hpBarBg.rect(-BAR_W / 2, barY, BAR_W, BAR_H).fill(0x2a2a2a)
    this.hpBarBg.visible = damaged
    this.hpBarFg.visible = damaged
    if (!damaged) return
    const color = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xf44336
    this.hpBarFg.rect(-BAR_W / 2, barY, BAR_W * ratio, BAR_H).fill(color)
  }

  private _normalTint(): number {
    const base = ROCK_TINT[this.data.type] ?? 0xffffff
    const r = this.data.hp / this.data.maxHp
    if (r < 0.33) return base === 0xffffff ? 0xff7070 : 0xff9090
    if (r < 0.66) return base === 0xffffff ? 0xffd080 : 0xffe0a0
    return base
  }

  private _shake(): void {
    if (this.shakeTicker) return
    const target = this.driver?.sprite ?? this.spr ?? this.gfx
    let elapsed = 0
    const tick = () => {
      if (this.destroyed || !target || target.destroyed) {
        PIXI.Ticker.shared.remove(tick)
        this.shakeTicker = null
        return
      }
      elapsed += 16
      if (elapsed >= 320) {
        target.x = this.driver ? (this.driver.manifest.offset?.x ?? 0) : 0
        PIXI.Ticker.shared.remove(tick)
        this.shakeTicker = null
        return
      }
      const decay = 1 - elapsed / 320
      const baseX = this.driver ? (this.driver.manifest.offset?.x ?? 0) : 0
      target.x = baseX + Math.sin(elapsed * 0.08 * Math.PI) * 4 * decay
    }
    this.shakeTicker = tick
    PIXI.Ticker.shared.add(tick)
  }

  playRespawnAnim(): void {
    this.sprite.scale.set(0)
    let p = 0
    const tick = () => {
      if (this.destroyed || !this.sprite || this.sprite.destroyed) {
        PIXI.Ticker.shared.remove(tick)
        return
      }
      p += 0.06
      if (p >= 1) {
        this.sprite.scale.set(1)
        PIXI.Ticker.shared.remove(tick)
        return
      }
      this.sprite.scale.set(easeOutElastic(p))
    }
    PIXI.Ticker.shared.add(tick)
  }

  hit(damage: number, _playerId: PlayerId): void {
    this.data.hp = Math.max(0, this.data.hp - damage)
    const visual = this.driver?.sprite ?? this.spr ?? this.gfx
    visual.tint = 0xffffff
    this._shake()
    setTimeout(() => {
      if (!visual.destroyed) visual.tint = this._normalTint()
    }, 80)
    this._refreshHpBar()
    if (this.data.hp <= 0) EventBus.emit('resource:depleted', { nodeId: this.id })
  }

  applyDelta(data: Partial<ResourceNodeData>): void {
    if (data.hp !== undefined) {
      const prevHp = this.data.hp
      this.data.hp = data.hp
      if (data.hp < prevHp) {
        const visual = this.driver?.sprite ?? this.spr ?? this.gfx
        visual.tint = 0xffffff
        this._shake()
        setTimeout(() => { if (!visual.destroyed) visual.tint = this._normalTint() }, 80)
      }
    }
    this._refreshHpBar()
  }

  update(delta: number): void {
    if (!this.driver) return
    void this.driver.play('IDLE', 'DOWN' as Dir)
    this.driver.update(delta)
  }

  get x(): number { return this.destroyed ? this.data.x : this.sprite.x }
  get y(): number { return this.destroyed ? this.data.y : this.sprite.y }
  get isDestroyed(): boolean { return this.destroyed }
  getData(): ResourceNodeData { return { ...this.data } }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.shakeTicker) {
      PIXI.Ticker.shared.remove(this.shakeTicker)
      this.shakeTicker = null
    }
    this.sprite.destroy()
  }
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return Math.abs(h)
}
