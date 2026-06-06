import * as PIXI from 'pixi.js'
import type { ResourceType } from '@/types'

// ── 每種資源對應的粒子顏色 ────────────────────────────────────
const RES_COLOR: Record<string, number> = {
  tree:    0x2e7d32,
  rock:    0x9e9e9e,
  iron:    0x90a4ae,
  gold:    0xffd54f,
  crystal: 0xce93d8,
  berry:   0xFF3848,
  tomato:  0xE5462E,
  purple_grape: 0x7B3FC7,
  onion:   0xD8D0B0,
  carrot:  0xE57C22,
  pumpkin: 0xD8731E,
  watermelon: 0x5CB85C,
}

const RES_ICON: Record<string, string> = {
  tree:    '🪵',
  rock:    '🪨',
  iron:    '⬛',
  gold:    '🟨',
  crystal: '💎',
  berry:   '🍓',
  tomato:  '🍅',
  purple_grape: '🍇',
  onion:   '🧅',
  carrot:  '🥕',
  pumpkin: '🎃',
  watermelon: '🍉',
}

// ── 內部類型 ─────────────────────────────────────────────────
interface Particle {
  g:       PIXI.Graphics
  vx:      number
  vy:      number
  life:    number   // 1 → 0
  decay:   number
  gravity: number
}

interface FloatingText {
  t:     PIXI.Text
  vy:    number
  life:  number
  decay: number
}

// ── FxLayer ──────────────────────────────────────────────────
export class FxLayer {
  private container: PIXI.Container
  private particles:     Particle[]     = []
  private floatingTexts: FloatingText[] = []

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    this.container.eventMode = 'none'
    parent.addChild(this.container)
  }

  get displayObject(): PIXI.Container { return this.container }

  // ── 浮動文字 ────────────────────────────────────────────────

  spawnFloatingText(x: number, y: number, text: string, color = 0xffffff): void {
    const t = new PIXI.Text({
      text,
      style: {
        fontSize: 13,
        fill: color,
        fontWeight: 'bold',
        dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 0.8 },
      },
    })
    t.anchor.set(0.5, 1)
    t.x = x + (Math.random() - 0.5) * 12
    t.y = y - 10
    this.container.addChild(t)
    this.floatingTexts.push({ t, vy: -1.1, life: 1, decay: 0.018 })
  }

  // ── 採集特效（文字 + 粒子） ─────────────────────────────────

  spawnHarvest(x: number, y: number, type: ResourceType, amount: number = 1): void {
    const icon = RES_ICON[type] ?? '📦'
    const color = RES_COLOR[type] ?? 0xFFFFFF
    this.spawnFloatingText(x, y, `+${amount} ${icon}`, color)
    this._burst(x, y, color, 6, 1.2, 2.5, 0.05, 0.12)
  }

  // ── 資源耗盡爆炸 ────────────────────────────────────────────

  spawnDepletionBurst(x: number, y: number, type: ResourceType): void {
    const color = RES_COLOR[type]
    // 大顆粒子
    this._burst(x, y, color, 14, 1.8, 3.5, 0.035, 0.12)
    // 淡色環
    const light = blendColor(color, 0xffffff, 0.5)
    this._burst(x, y, light, 8, 2.5, 4.0, 0.025, 0.08)
  }

  // ── 重生閃光 ────────────────────────────────────────────────

  spawnRespawnSparkle(x: number, y: number): void {
    this._burst(x, y, 0xffd54f, 12, 0.5, 2.0, 0.022, 0.04)
    // 白色星芒
    this._burst(x, y, 0xffffff, 6, 0.5, 1.5, 0.028, 0.03)
  }

  // ── 水面閃光（淡藍色） ─────────────────────────────────────

  spawnMonsterBloodBurst(x: number, y: number): void {
    this._burst(x, y - 8, 0xd32f2f, 18, 1.8, 4.2, 0.026, 0.04)
    this._burst(x, y - 8, 0xff6b6b, 10, 1.2, 3.0, 0.03, 0.03)
  }

  spawnWaterShimmer(x: number, y: number): void {
    const g = new PIXI.Graphics()
    g.rect(-1.5, -1.5, 3, 3).fill({ color: 0x90caf9, alpha: 0.85 })
    g.x = x + (Math.random() - 0.5) * 24
    g.y = y + (Math.random() - 0.5) * 24
    this.container.addChild(g)
    this.particles.push({
      g, vx: (Math.random() - 0.5) * 0.4, vy: -0.3,
      life: 1, decay: 0.03, gravity: 0,
    })
  }

  // ── 通用粒子噴發 ────────────────────────────────────────────

  private _burst(
    x: number, y: number, color: number,
    count: number, minSpeed: number, maxSpeed: number,
    decay: number, gravity: number
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
      const size  = 2 + Math.random() * 3
      const g = new PIXI.Graphics()
      g.rect(-size / 2, -size / 2, size, size).fill(color)
      g.x = x; g.y = y
      this.container.addChild(g)
      this.particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        decay: decay + Math.random() * 0.015,
        gravity,
      })
    }
  }

  // ── 每幀更新 ────────────────────────────────────────────────

  update(_delta: number): void {
    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= p.decay
      if (p.life <= 0) {
        this.container.removeChild(p.g)
        p.g.destroy()
        this.particles.splice(i, 1)
        continue
      }
      p.vy  += p.gravity
      p.g.x += p.vx
      p.g.y += p.vy
      p.g.alpha = p.life
    }

    // 浮動文字
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]
      ft.life -= ft.decay
      if (ft.life <= 0) {
        this.container.removeChild(ft.t)
        ft.t.destroy()
        this.floatingTexts.splice(i, 1)
        continue
      }
      ft.t.y    += ft.vy
      ft.t.alpha = Math.min(1, ft.life * 1.5)  // 後半段才開始淡出
    }
  }
}

// ── 工具 ─────────────────────────────────────────────────────

function blendColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8)  |
     Math.round(ab + (bb - ab) * t)
  )
}
