import * as PIXI from 'pixi.js'
import { EntitySpriteDriver } from '@/render'
import { t } from '@/core/i18n'

export type MonsterType =
  | 'slime'
  | 'slime_blue'
  | 'giant_slime'
  | 'giant_flame'
  | 'giant_spirit'
  | 'giant_frog'
  | 'giant_frog_2'
  | 'giant_raccoon'
  | 'giant_raccoon_gold'
  | 'goblin'
  | 'goblin_rogue'
  | 'goblin_shaman'
  | 'goblin_warrior'
  | 'skeleton'
  | 'skeleton_mage'
  | 'skeleton_rogue'
  | 'skeleton_warrior'
  | 'tengu_blue'
  | 'tengu_red'
  | 'giant_blue_samurai'
  | 'giant_red_samurai'

export interface MonsterStats {
  type: MonsterType
  hp: number
  maxHp: number
  damage: number
  speed: number
  detectRange: number
  attackRange: number
  attackCooldown: number
  goldReward: number
  xpReward: number
  boneDrop: number      // 掉骨頭機率
  meatDrop: number      // 掉肉類機率
  leatherDrop: number   // 掉皮革機率
  featherDrop: number   // 掉羽毛機率
}

/** 取得怪物的本地化名稱，以 type 作為 fallback */
export function getMonsterName(type: MonsterType): string {
  return t(`monster.${type}.name`, undefined, type)
}

export const MONSTER_STATS: Record<MonsterType, MonsterStats> = {
  // 史萊姆：肥嫩多汁，掉肉但沒皮革
  slime:      { type: 'slime',      hp: 4,  maxHp: 4,  damage: 1, speed: 0.9, detectRange: 4, attackRange: 1.2, attackCooldown: 1500, goldReward: 2,  xpReward: 5,  boneDrop: 0,   meatDrop: 0.30, leatherDrop: 0,    featherDrop: 0    },
  // 藍史萊姆：水系，偶爾掉羽毛（水鳥停在上面？）
  slime_blue: { type: 'slime_blue', hp: 4,  maxHp: 4,  damage: 1, speed: 0.9, detectRange: 4, attackRange: 1.2, attackCooldown: 1500, goldReward: 2,  xpReward: 5,  boneDrop: 0,   meatDrop: 0.20, leatherDrop: 0,    featherDrop: 0.15 },
  giant_slime: { type: 'giant_slime', hp: 18, maxHp: 18, damage: 3, speed: 0.75, detectRange: 5, attackRange: 1.4, attackCooldown: 1500, goldReward: 8, xpReward: 20, boneDrop: 0, meatDrop: 0.55, leatherDrop: 0, featherDrop: 0 },
  giant_flame: { type: 'giant_flame', hp: 26, maxHp: 26, damage: 5, speed: 0.8, detectRange: 6, attackRange: 1.5, attackCooldown: 1350, goldReward: 14, xpReward: 32, boneDrop: 0, meatDrop: 0.30, leatherDrop: 0, featherDrop: 0 },
  giant_spirit: { type: 'giant_spirit', hp: 24, maxHp: 24, damage: 4, speed: 1.0, detectRange: 7, attackRange: 1.5, attackCooldown: 1200, goldReward: 16, xpReward: 36, boneDrop: 0.20, meatDrop: 0, leatherDrop: 0, featherDrop: 0.30 },
  giant_frog: { type: 'giant_frog', hp: 14, maxHp: 14, damage: 2, speed: 1.35, detectRange: 5, attackRange: 1.3, attackCooldown: 1250, goldReward: 7, xpReward: 18, boneDrop: 0, meatDrop: 0.45, leatherDrop: 0.10, featherDrop: 0 },
  giant_frog_2: { type: 'giant_frog_2', hp: 16, maxHp: 16, damage: 3, speed: 1.25, detectRange: 5, attackRange: 1.3, attackCooldown: 1250, goldReward: 8, xpReward: 20, boneDrop: 0, meatDrop: 0.45, leatherDrop: 0.15, featherDrop: 0 },
  giant_raccoon: { type: 'giant_raccoon', hp: 20, maxHp: 20, damage: 4, speed: 1.25, detectRange: 6, attackRange: 1.3, attackCooldown: 1100, goldReward: 10, xpReward: 26, boneDrop: 0, meatDrop: 0.30, leatherDrop: 0.45, featherDrop: 0 },
  giant_raccoon_gold: { type: 'giant_raccoon_gold', hp: 28, maxHp: 28, damage: 5, speed: 1.15, detectRange: 6, attackRange: 1.4, attackCooldown: 1050, goldReward: 22, xpReward: 42, boneDrop: 0, meatDrop: 0.25, leatherDrop: 0.55, featherDrop: 0 },
  // 地精：有皮甲護著，掉皮革和肉
  goblin:     { type: 'goblin',     hp: 8,  maxHp: 8,  damage: 2, speed: 1.5, detectRange: 5, attackRange: 1.2, attackCooldown: 1200, goldReward: 5,  xpReward: 10, boneDrop: 0,   meatDrop: 0.25, leatherDrop: 0.35, featherDrop: 0    },
  goblin_rogue: { type: 'goblin_rogue', hp: 10, maxHp: 10, damage: 3, speed: 1.8, detectRange: 6, attackRange: 1.2, attackCooldown: 900, goldReward: 7, xpReward: 14, boneDrop: 0, meatDrop: 0.20, leatherDrop: 0.45, featherDrop: 0 },
  goblin_shaman: { type: 'goblin_shaman', hp: 12, maxHp: 12, damage: 4, speed: 1.25, detectRange: 7, attackRange: 1.6, attackCooldown: 1450, goldReward: 9, xpReward: 18, boneDrop: 0, meatDrop: 0.15, leatherDrop: 0.35, featherDrop: 0.10 },
  goblin_warrior: { type: 'goblin_warrior', hp: 18, maxHp: 18, damage: 4, speed: 1.25, detectRange: 6, attackRange: 1.3, attackCooldown: 1100, goldReward: 10, xpReward: 22, boneDrop: 0.10, meatDrop: 0.20, leatherDrop: 0.55, featherDrop: 0 },
  // 骷髏：乾骨頭，掉骨頭和羽毛（頭上別著羽毛）
  skeleton:   { type: 'skeleton',   hp: 14, maxHp: 14, damage: 3, speed: 1.2, detectRange: 6, attackRange: 1.3, attackCooldown: 1000, goldReward: 10, xpReward: 18, boneDrop: 0.6, meatDrop: 0,    leatherDrop: 0,    featherDrop: 0.25 },
  skeleton_mage: { type: 'skeleton_mage', hp: 16, maxHp: 16, damage: 5, speed: 1.05, detectRange: 7, attackRange: 1.6, attackCooldown: 1300, goldReward: 12, xpReward: 24, boneDrop: 0.70, meatDrop: 0, leatherDrop: 0, featherDrop: 0.20 },
  skeleton_rogue: { type: 'skeleton_rogue', hp: 15, maxHp: 15, damage: 4, speed: 1.65, detectRange: 7, attackRange: 1.2, attackCooldown: 850, goldReward: 12, xpReward: 24, boneDrop: 0.65, meatDrop: 0, leatherDrop: 0.10, featherDrop: 0.20 },
  skeleton_warrior: { type: 'skeleton_warrior', hp: 24, maxHp: 24, damage: 5, speed: 1.1, detectRange: 6, attackRange: 1.4, attackCooldown: 1050, goldReward: 15, xpReward: 30, boneDrop: 0.80, meatDrop: 0, leatherDrop: 0.10, featherDrop: 0.20 },
  tengu_blue: { type: 'tengu_blue', hp: 22, maxHp: 22, damage: 5, speed: 1.55, detectRange: 8, attackRange: 1.4, attackCooldown: 950, goldReward: 16, xpReward: 34, boneDrop: 0.10, meatDrop: 0, leatherDrop: 0.10, featherDrop: 0.75 },
  tengu_red: { type: 'tengu_red', hp: 28, maxHp: 28, damage: 6, speed: 1.45, detectRange: 8, attackRange: 1.5, attackCooldown: 900, goldReward: 20, xpReward: 44, boneDrop: 0.10, meatDrop: 0, leatherDrop: 0.15, featherDrop: 0.85 },
  giant_blue_samurai: { type: 'giant_blue_samurai', hp: 42, maxHp: 42, damage: 8, speed: 1.05, detectRange: 8, attackRange: 1.6, attackCooldown: 1050, goldReward: 28, xpReward: 60, boneDrop: 0.35, meatDrop: 0, leatherDrop: 0.45, featherDrop: 0.15 },
  giant_red_samurai: { type: 'giant_red_samurai', hp: 52, maxHp: 52, damage: 10, speed: 1.0, detectRange: 8, attackRange: 1.6, attackCooldown: 950, goldReward: 34, xpReward: 75, boneDrop: 0.40, meatDrop: 0, leatherDrop: 0.50, featherDrop: 0.15 },
}

export type AIState = 'idle' | 'wander' | 'chase' | 'attack'
export type MonsterKind = 'wild' | 'siege'
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

const BAR_W = 28
const BAR_H = 3
const DEFAULT_BAR_Y = 26
const DRIVER_ATTACK_MS = 420

export class MonsterEntity {
  readonly id: string
  readonly type: MonsterType
  sprite: PIXI.Container
  private gfx: PIXI.Graphics
  private hpBarBg: PIXI.Graphics
  private hpBarFg: PIXI.Graphics
  private driver: EntitySpriteDriver | null = null
  private destroyed = false
  private facingDir: Dir = 'DOWN'
  hp: number
  maxHp: number
  damage: number
  speed: number
  baseSpeed: number = 0   // 原始速度，用於狀態效果計算
  x: number
  y: number
  kind: MonsterKind = 'siege'
  aiState: AIState = 'idle'
  targetId: string | null = null
  targetBuildingId: string | null = null   // 攻擊建築目標
  idleTimer = 0
  wanderTarget: { x: number; y: number } | null = null
  lastAttackMs = 0
  facingLeft = false
  // 菁英/Boss 旗標
  isElite = false
  isBoss  = false
  // 狀態效果（debuffs）
  slowUntil:   number = 0   // 減速結束時間 ms
  burnUntil:   number = 0   // 灼燒結束時間 ms（每秒傷害）
  frozenUntil: number = 0   // 凍結結束時間 ms（無法移動）
  burnDmgPerSec = 0
  lastBurnMs   = 0
  private _animTick: (() => void) | null = null
  private _attackAnimStart = 0
  private _attackAnimUntil = 0
  private _damageAnimUntil = 0

  private _syncDriverPose(now = performance.now()): void {
    if (!this.driver) return
    const scale = this.driver.manifest.scale ?? 1
    const sign = this.facingLeft ? -1 : 1
    const baseX = this.driver.manifest.offset?.x ?? 0
    const baseY = this.driver.manifest.offset?.y ?? 0
    let offsetX = 0
    let offsetY = 0
    let squash = 0
    let rotation = 0

    if (now < this._attackAnimUntil) {
      const t = Math.max(0, Math.min(1, (now - this._attackAnimStart) / DRIVER_ATTACK_MS))
      const punch = Math.sin(t * Math.PI)
      const snap = t < 0.45 ? t / 0.45 : (1 - t) / 0.55
      const dir =
        this.facingDir === 'UP' ? { x: 0, y: -1 } :
        this.facingDir === 'DOWN' ? { x: 0, y: 1 } :
        { x: sign, y: 0 }

      offsetX = dir.x * punch * 9
      offsetY = dir.y * punch * 7
      squash = punch * 0.16
      rotation = sign * Math.max(0, snap) * 0.18
    }

    this.driver.sprite.x = baseX + offsetX
    this.driver.sprite.y = baseY + offsetY
    this.driver.sprite.rotation = rotation
    this.driver.sprite.scale.x = sign * scale * (1 + squash)
    this.driver.sprite.scale.y = scale * (1 - squash * 0.35)
  }

  constructor(id: string, type: MonsterType, x: number, y: number) {
    this.id = id
    this.type = type
    this.x = x
    this.y = y
    const s = MONSTER_STATS[type]
    this.hp = s.hp
    this.maxHp = s.maxHp
    this.damage = s.damage
    this.speed = s.speed
    this.baseSpeed = s.speed

    this.sprite = new PIXI.Container()
    this.gfx = new PIXI.Graphics()
    this.hpBarBg = new PIXI.Graphics()
    this.hpBarFg = new PIXI.Graphics()

    this._buildFallbackSprite()
    this.sprite.x = x
    this.sprite.y = y
    void this._initManifestSprite()
  }

  private async _initManifestSprite(): Promise<void> {
    const driver = await EntitySpriteDriver.create(`monster.${this.type}`)
    if (!driver) return
    if (this.destroyed || this.sprite.destroyed) {
      driver.sprite.destroy()
      return
    }
    this.driver = driver
    this.gfx.visible = false
    this.sprite.addChildAt(driver.sprite, 0)
    this._rebuildHpBar(driver.getHpBarY(DEFAULT_BAR_Y))
  }

  private _buildFallbackSprite(): void {
    this._drawBody()
    this._rebuildHpBar(DEFAULT_BAR_Y)
    this.sprite.addChild(this.gfx, this.hpBarBg, this.hpBarFg)
  }

  private _rebuildHpBar(barY: number): void {
    if (this.destroyed || this.hpBarBg.destroyed || this.hpBarFg.destroyed) return
    this.hpBarBg.clear()
    this.hpBarFg.clear()
    this.hpBarBg.rect(-(BAR_W / 2 + 1), barY - 1, BAR_W + 2, BAR_H + 2).fill(0x111111)
    this.hpBarBg.rect(-BAR_W / 2, barY, BAR_W, BAR_H).fill(0x2a2a2a)
    this.hpBarBg.visible = false
    this.hpBarFg.visible = false
  }

  private _drawBody(): void {
    const g = this.gfx
    switch (this.type) {
      case 'slime':
        g.ellipse(1, 14, 22, 7).fill({ color: 0x000000, alpha: 0.18 })
        g.ellipse(0, 2, 20, 16).fill(0x30c030)
        g.ellipse(0, 2, 20, 16).stroke({ color: 0x186018, width: 2 })
        g.ellipse(-5, -4, 7, 9).fill({ color: 0x70e870, alpha: 0.55 })
        g.circle(-5, 1, 3.5).fill(0xffffff)
        g.circle(5, 1, 3.5).fill(0xffffff)
        g.circle(-4, 1, 1.8).fill(0x202020)
        g.circle(6, 1, 1.8).fill(0x202020)
        break
      case 'slime_blue':
        g.ellipse(1, 14, 22, 7).fill({ color: 0x000000, alpha: 0.18 })
        g.ellipse(0, 2, 20, 16).fill(0x4da3ff)
        g.ellipse(0, 2, 20, 16).stroke({ color: 0x1c5fb0, width: 2 })
        g.ellipse(-5, -4, 7, 9).fill({ color: 0x90c8ff, alpha: 0.55 })
        g.circle(-5, 1, 3.5).fill(0xffffff)
        g.circle(5, 1, 3.5).fill(0xffffff)
        g.circle(-4, 1, 1.8).fill(0x202020)
        g.circle(6, 1, 1.8).fill(0x202020)
        break
      case 'goblin':
        g.ellipse(1, 20, 13, 5).fill({ color: 0x000000, alpha: 0.18 })
        g.roundRect(-7, 8, 5, 12, 1).fill(0x7a5010)
        g.roundRect(2, 8, 5, 12, 1).fill(0x7a5010)
        g.roundRect(-8, -4, 16, 14, 3).fill(0xa87828)
        g.roundRect(-8, -4, 16, 14, 3).stroke({ color: 0x6a4a10, width: 1.5 })
        g.roundRect(-13, -2, 5, 11, 2).fill(0x9a6a1a)
        g.roundRect(8, -2, 5, 11, 2).fill(0x9a6a1a)
        g.circle(0, -14, 11).fill(0xb88020)
        g.circle(0, -14, 11).stroke({ color: 0x7a5010, width: 1.5 })
        g.poly([-13, -18, -8, -8, -5, -18]).fill(0xb88020)
        g.poly([13, -18, 8, -8, 5, -18]).fill(0xb88020)
        g.circle(-4, -15, 2.5).fill(0xff3030)
        g.circle(4, -15, 2.5).fill(0xff3030)
        g.circle(-3.5, -15, 1).fill(0x000000)
        g.circle(4.5, -15, 1).fill(0x000000)
        g.rect(11, -10, 3, 16).fill(0x888888)
        g.rect(9, -13, 7, 3).fill(0xcccccc)
        break
      case 'skeleton':
        g.ellipse(1, 20, 12, 4).fill({ color: 0x000000, alpha: 0.18 })
        g.rect(-7, 8, 4, 6).fill(0xd8d0bc)
        g.rect(-7, 15, 4, 5).fill(0xc8c0ac)
        g.rect(3, 8, 4, 6).fill(0xd8d0bc)
        g.rect(3, 15, 4, 5).fill(0xc8c0ac)
        g.roundRect(-8, -4, 16, 13, 2).fill(0xd8d0bc)
        g.roundRect(-8, -4, 16, 13, 2).stroke({ color: 0x908878, width: 1 })
        for (let i = 0; i < 3; i++) {
          const ry = -2 + i * 4
          g.rect(-7, ry, 5, 2).fill(0x908878)
          g.rect(2, ry, 5, 2).fill(0x908878)
        }
        g.roundRect(-12, -2, 4, 9, 2).fill(0xd8d0bc)
        g.roundRect(8, -2, 4, 9, 2).fill(0xd8d0bc)
        g.circle(0, -15, 10).fill(0xe0d8c8)
        g.ellipse(0, -8, 8, 5).fill(0xd8d0bc)
        g.circle(-3.5, -16, 3).fill(0x404030)
        g.circle(3.5, -16, 3).fill(0x404030)
        for (let t = 0; t < 3; t++) g.rect(-4 + t * 3, -10, 2, 3).fill(0xf0e8d8)
        break
    }
  }

  refreshHpBar(): void {
    if (this.destroyed || this.hpBarBg.destroyed || this.hpBarFg.destroyed) return
    const ratio = Math.max(0, this.hp / this.maxHp)
    const damaged = ratio < 1
    this.hpBarBg.visible = damaged
    this.hpBarFg.visible = damaged
    if (!damaged) return
    const color = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xf44336
    const barY = this.driver?.getHpBarY(DEFAULT_BAR_Y) ?? DEFAULT_BAR_Y
    this.hpBarFg.clear()
    this.hpBarFg.rect(-BAR_W / 2, barY, BAR_W * ratio, BAR_H).fill(color)
  }

  takeDamage(dmg: number): void {
    if (this.destroyed) return
    this.hp = Math.max(0, this.hp - dmg)
    if (this.driver) {
      this._damageAnimUntil = performance.now() + 240
      void this.driver.play('HIT', this.facingDir, true)
    } else {
      this.gfx.tint = 0xff5050
      setTimeout(() => { if (this.gfx && !this.gfx.destroyed) this.gfx.tint = 0xffffff }, 120)
    }
    this.refreshHpBar()
  }

  attackAnim(): void {
    if (this.driver) {
      this._attackAnimStart = performance.now()
      this._attackAnimUntil = this._attackAnimStart + DRIVER_ATTACK_MS
      void this.driver.play('ATTACK', this.facingDir, true)
      this._syncDriverPose(this._attackAnimStart)
      return
    }
    if (this._animTick) return
    const sign = this.facingLeft ? -1 : 1
    let t = 0
    const tick = () => {
      if (!this.gfx || this.gfx.destroyed) {
        PIXI.Ticker.shared.remove(tick)
        this._animTick = null
        return
      }
      t += 0.09
      if (t >= 1) {
        this.gfx.scale.set(sign, 1)
        PIXI.Ticker.shared.remove(tick)
        this._animTick = null
        return
      }
      const s = 1 + Math.sin(t * Math.PI) * 0.45
      this.gfx.scale.set(sign * s, s)
    }
    this._animTick = tick
    PIXI.Ticker.shared.add(tick)
  }

  get isAttacking(): boolean {
    return performance.now() < this._attackAnimUntil || this._animTick !== null
  }

  setVariantVisual(isElite: boolean, isBoss: boolean): void {
    this.isBoss = isBoss
    this.isElite = isBoss ? false : isElite
    this.sprite.scale.set(isBoss ? 2.0 : isElite ? 1.5 : 1.0)
    ;(this.sprite as any).tint = isBoss ? 0xffd24a : isElite ? 0xff8a2a : 0xffffff
  }

  moveTo(x: number, y: number): void {
    const dx = x - this.x
    const dy = y - this.y
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
      this.facingLeft = dx < 0
      this.facingDir = dx < 0 ? 'LEFT' : 'RIGHT'
    } else if (dy !== 0) {
      this.facingDir = dy < 0 ? 'UP' : 'DOWN'
    }
    this.x = x
    this.y = y
    this.sprite.x = x
    this.sprite.y = y
    this.sprite.zIndex = y + 20
    this.gfx.scale.x = this.facingLeft ? -1 : 1
    this._syncDriverPose()
  }

  update(delta: number): void {
    if (!this.driver) return
    const now = performance.now()
    const state = now < this._attackAnimUntil
      ? 'ATTACK'
      : now < this._damageAnimUntil
        ? 'HIT'
      : this.aiState === 'idle'
        ? 'IDLE'
        : 'MOVE'
    void this.driver.play(state, this.facingDir)
    this.driver.update(delta)
    this._syncDriverPose(now)
  }

  get isAlive(): boolean { return this.hp > 0 }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this._animTick) {
      PIXI.Ticker.shared.remove(this._animTick)
      this._animTick = null
    }
    this.sprite.destroy({ children: true })
  }
}
